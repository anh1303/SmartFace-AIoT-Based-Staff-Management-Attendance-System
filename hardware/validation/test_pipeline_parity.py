"""Offline CV parity, PAD invalidation and display-cache safety."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tracking.tracker import Track
from vision_pipeline import update_track_pad, _pad_face_skip_reason
from recognition.worker import IdentityCache
import config


def detection(score=.95):
    return dict(bbox=(80, 60, 180, 160), score=score,
                landmarks=[[110, 95], [150, 95], [130, 115], [115, 135], [145, 135]])


class PipelineTests(unittest.TestCase):
    def test_three_votes_required_and_window_remains_bounded_at_five(self):
        track = Track(1, (80, 60, 180, 160), pad_min_votes=3, pad_smooth_window=5)
        track.update_pad(True, 2)
        track.update_pad(True, 2)
        self.assertFalse(track.pad_ready)
        track.update_pad(True, 2)
        self.assertTrue(track.is_real)
        for _ in range(3):
            track.update_pad(False, -2)
        self.assertEqual(len(track._pad_window), 5)
        self.assertTrue(track.is_spoof)

    def test_pad_error_clears_old_real_votes_and_requires_three_fresh_votes(self):
        track = Track(1, (80, 60, 180, 160), pad_min_votes=3)
        for _ in range(3):
            track.update_pad(True, 2)
        predictor = Mock(bbox_expansion_factor=1.5, crop_mode='minifasnet_train_v1', model_img_size=80)
        predictor.predict_crops.return_value = []  # Inference failed, not a SPOOF vote.
        frame = np.zeros((240, 320, 3), np.uint8)
        with patch('builtins.print'):
            count = update_track_pad([(detection(), track)], frame, predictor, 0)
        self.assertEqual(count, 0)
        self.assertEqual(track.verification_generation, 1)
        self.assertFalse(track.pad_ready)
        self.assertEqual(len(track._pad_window), 0)
        track.update_pad(True, 2)
        track.update_pad(True, 2)
        self.assertFalse(track.pad_ready)
        track.update_pad(True, 2)
        self.assertTrue(track.is_real)

    def test_geometry_rejected_before_model_and_invalidates_cached_verdict(self):
        track = Track(1, (80, 60, 180, 160), pad_min_votes=3)
        for _ in range(3):
            track.update_pad(True, 2)
        predictor = Mock()
        update_track_pad([(detection(.1), track)], np.zeros((240, 320, 3), np.uint8), predictor, .2)
        predictor.predict_crops.assert_not_called()
        self.assertFalse(track.pad_ready)
        self.assertEqual(track.pad_invalid_reason, 'low_detector_confidence')
        bad = detection()
        bad['bbox'] = (0, 60, 180, 160)
        self.assertIsNotNone(_pad_face_skip_reason(bad, (240, 320, 3)))

    def test_nonfinite_batch_is_rejected_atomically(self):
        tracks = [Track(i, (80, 60, 180, 160), pad_min_votes=3) for i in (1, 2)]
        predictor = Mock(bbox_expansion_factor=1.5, crop_mode='minifasnet_train_v1', model_img_size=80)
        predictor.predict_crops.return_value = [{'is_real':True, 'pad_score':2.}, {'is_real':True, 'pad_score':float('nan')}]
        with patch('builtins.print'):
            self.assertEqual(update_track_pad([(detection(), t) for t in tracks], np.zeros((240, 320, 3), np.uint8), predictor, 0), 0)
        self.assertTrue(all(not t._pad_window and t.verification_generation == 1 for t in tracks))

    def test_both_model_artifacts_and_contracts_match_source(self):
        for variant in ('FULL', '100K'):
            for suffix in ('.onnx', '_runtime_config.json', '_runtime_config_casia.json'):
                name = 'R7_SC_' + variant + '_crop15' + suffix
                local = (ROOT / 'models' / name).read_bytes()
                source = (ROOT.parent / 'face_auth/antispoof/models' / name).read_bytes()
                self.assertEqual(hashlib.sha256(local).digest(), hashlib.sha256(source).digest())

    def test_effective_cv_settings_match_in_fresh_process_for_both_profiles(self):
        keys = ('PAD_MODEL_FILENAME', 'PAD_THRESHOLD_LOGIT', 'PAD_THRESHOLD', 'PAD_OUTPUT_CLASSES',
                'PAD_MODEL_IMG_SIZE', 'PAD_BBOX_EXPANSION_FACTOR', 'PAD_COLOR_ORDER', 'PAD_MEAN',
                'PAD_STD', 'PAD_GAMMA_ENABLED', 'PAD_CROP_MODE', 'PAD_CROP_SMOOTHING', 'PAD_MIN_VOTES',
                'PAD_SMOOTH_WINDOW', 'PAD_SPOOF_MIN_RATIO', 'PAD_STALE_TIMEOUT_SECONDS',
                'PAD_MIN_DETECTOR_CONFIDENCE', 'DETECTION_INTERVAL_SECONDS', 'PAD_INTERVAL_SECONDS',
                'RECOGNIZE_INTERVAL_SECONDS', 'DETECTOR_MIN_FACE_SIZE', 'DETECTOR_CONF_THRESH',
                'RECOGNITION_QUEUE_SIZE', 'RECOGNITION_INTRA_OP_THREADS', 'RECOGNITION_CACHE_TTL_SECONDS',
                'RECOGNITION_CACHE_THRESHOLD', 'MATCH_THRESHOLD')
        code = 'import config,json; print(json.dumps({k:getattr(config,k) for k in ' + repr(keys) + '}))'
        for variant in ('FULL', '100K'):
            outputs = []
            for folder, subdir in (('hardware','models'), ('face_auth','antispoof/models')):
                env = os.environ.copy()
                for key in keys:
                    env.pop(key, None)
                env['PAD_RUNTIME_CONFIG_PATH'] = f'{subdir}/R7_SC_{variant}_crop15_runtime_config_casia.json'
                result = subprocess.run([sys.executable, '-c', code], cwd=ROOT.parent/folder, env=env,
                                        text=True, capture_output=True, check=True)
                outputs.append(json.loads(result.stdout))
            self.assertEqual(outputs[0], outputs[1])
            self.assertEqual(outputs[0]['PAD_MIN_VOTES'], 3)
            self.assertEqual(outputs[0]['PAD_SMOOTH_WINDOW'], 5)


class CacheTests(unittest.TestCase):
    def test_cache_hit_does_not_extend_ttl_or_cross_generation(self):
        cache = IdentityCache(30, .65)
        key = (1, 0, 'CHECK_IN', 0, 0)
        vector = np.ones(512)
        with patch('recognition.worker.time.monotonic', return_value=100):
            cache.confirm(key, vector, ('NV1','Alice',.9))
        with patch('recognition.worker.time.monotonic', return_value=129):
            self.assertEqual(cache.lookup(key, vector)[0], 'NV1')
            self.assertIsNone(cache.lookup((1,1,'CHECK_IN',0,0), vector))
        with patch('recognition.worker.time.monotonic', return_value=130):
            self.assertIsNone(cache.lookup(key, vector))

    def test_low_match_or_cloud_miss_cannot_fall_back_to_old_identity(self):
        cache = IdentityCache()
        vector = np.ones(512)
        cache.confirm((1,), vector, ('NV1','Alice',.9))
        self.assertIsNone(cache.lookup((1,), -vector))
        cache.confirm((1,), vector, ('NV1','Alice',.9))
        cache.confirm((1,), vector, (None,'UNKNOWN',0))
        self.assertIsNone(cache.lookup((1,), vector))
        cache.confirm((1,), vector, ('NV1','Alice',.5))
        self.assertIsNone(cache.lookup((1,), vector))

    def test_invalidated_keys_and_disabled_cache_do_not_keep_identity(self):
        cache = IdentityCache()
        cache.confirm((1,), np.ones(512), ('NV1','Alice',.9))
        cache.retain(set())
        self.assertFalse(cache.entries)
        cache = IdentityCache(ttl=0)
        cache.confirm((1,), np.ones(512), ('NV1','Alice',.9))
        self.assertFalse(cache.entries)


if __name__ == '__main__':
    unittest.main()
