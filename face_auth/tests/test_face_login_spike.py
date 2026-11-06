"""Offline contracts for the webcam spike; no camera, database or real models."""
import unittest
import importlib.util
from pathlib import Path
import tempfile
import io
import sys
from contextlib import redirect_stderr
from unittest.mock import patch

import cv2
import numpy as np

from face_login import aggregate_embeddings, match_identity, verify_turn, jpeg_roundtrip, evaluate_sequence


def vector(axis=0):
    value = np.zeros(512)
    value[axis] = 1
    return value


def landmarks(offset=0):
    return np.array([[30, 30], [70, 30], [50 + offset, 50], [35, 70], [65, 70]], dtype=float)


class AggregationTests(unittest.TestCase):
    def test_normalizes_each_frame_before_average(self):
        a, b = vector(), vector()
        b[1] = 0.1
        expected = a + b / np.linalg.norm(b)
        np.testing.assert_allclose(aggregate_embeddings([a * 10, b], 0.9), expected / np.linalg.norm(expected))

    def test_every_pair_must_agree(self):
        with self.assertRaises(ValueError):
            aggregate_embeddings([vector(), vector(1), vector()], 0.8)

    def test_rejects_invalid_vectors_and_thresholds(self):
        for bad in [np.zeros(512), np.ones(511), np.full(512, np.nan), np.full(512, np.inf)]:
            with self.subTest(bad=bad.shape), self.assertRaises(ValueError):
                aggregate_embeddings([bad, vector()], 0.8)
        for threshold in [float('nan'), -2, 2]:
            with self.assertRaises(ValueError):
                aggregate_embeddings([vector(), vector()], threshold)


class MatchTests(unittest.TestCase):
    def test_requires_two_distinct_people_and_margin(self):
        gallery = [('a', vector()), ('a', vector())]
        self.assertIsNone(match_identity(vector(), gallery, 0.8, 0.05))
        gallery.append(('b', vector(1)))
        self.assertEqual(match_identity(vector(), gallery, 0.8, 0.05), 'a')
        gallery.append(('c', vector()))
        self.assertIsNone(match_identity(vector(), gallery, 0.8, 0.05))

    def test_score_boundary_and_invalid_gallery_fail_closed(self):
        self.assertIsNone(match_identity(vector(2), [('a', vector()), ('b', vector(1))], 0.8, 0.05))
        with self.assertRaises(ValueError):
            match_identity(vector(), [('a', np.zeros(512)), ('b', vector(1))], 0.8, 0.05)


class ChallengeTests(unittest.TestCase):
    def test_neutral_then_correct_direction_required(self):
        frames = [landmarks(), landmarks(), landmarks(8), landmarks(12), landmarks(12)]
        self.assertTrue(verify_turn(frames, 'image_right', 0.2))
        self.assertFalse(verify_turn(frames, 'image_left', 0.2))
        self.assertFalse(verify_turn([landmarks()] * 5, 'image_right', 0.2))
        self.assertFalse(verify_turn([landmarks(12)] * 5, 'image_right', 0.2))

    def test_geometry_and_direction_are_validated(self):
        invalid = landmarks()
        invalid[1] = invalid[0]
        for frames in [[], [invalid] * 5, [np.zeros((4, 2))] * 5]:
            with self.assertRaises(ValueError):
                verify_turn(frames, 'image_right', 0.2)
        with self.assertRaises(ValueError):
            verify_turn([landmarks()] * 5, 'unknown', 0.2)


class JpegTests(unittest.TestCase):
    def test_resize_encode_decode_and_byte_count(self):
        image = np.zeros((720, 1280, 3), dtype=np.uint8)
        decoded, byte_count = jpeg_roundtrip(image, long_edge=640, quality=85)
        self.assertEqual(decoded.shape, (360, 640, 3))
        self.assertGreater(byte_count, 0)
        self.assertLessEqual(byte_count, 200 * 1024)

    def test_oversize_payload_is_not_decoded(self):
        with patch('cv2.imdecode') as decode, self.assertRaises(ValueError):
            jpeg_roundtrip(np.zeros((100, 100, 3), dtype=np.uint8), max_bytes=1)
        decode.assert_not_called()


class PipelineTests(unittest.TestCase):
    def run_trial(self, **overrides):
        from types import SimpleNamespace
        turns = iter([0, 0, 8, 12, 12])
        detector = SimpleNamespace(detect=lambda frame: [{
            'bbox': (10, 10, 90, 90), 'score': 0.99,
            'landmarks': landmarks(next(turns)),
        }])
        options = dict(
            detector=detector,
            predictor=SimpleNamespace(predict_frame=lambda frame, bbox: {'is_real': True, 'pad_score': 2}),
            embedder=SimpleNamespace(input_size=(112, 112), embed_aligned=lambda frame: vector()),
            align_face=lambda *args: np.zeros((112, 112, 3), dtype=np.uint8),
            gallery=[('a', vector()), ('b', vector(1))], direction='image_right',
            consistency=0.8, match=0.8, margin=0.05, turn_delta=0.2,
            min_face_size=40, min_confidence=0.8,
        )
        options.update(overrides)
        return evaluate_sequence([np.zeros((100, 100, 3), dtype=np.uint8)] * 5, **options)

    def test_valid_sequence_identifies_after_jpeg_pipeline(self):
        result = self.run_trial()
        self.assertEqual(result['identity'], 'a')
        self.assertEqual(result['reason'], 'accepted')
        self.assertEqual(len(result['jpeg_bytes']), 5)

    def test_spoof_or_nan_pad_never_accepts(self):
        from types import SimpleNamespace
        for verdict in [{'is_real': False, 'pad_score': -2}, {'is_real': True, 'pad_score': float('nan')}, {}]:
            result = self.run_trial(predictor=SimpleNamespace(predict_frame=lambda *args: verdict))
            self.assertIsNone(result['identity'])
            self.assertEqual(result['reason'], 'pad_rejected')

    def test_multiple_faces_and_model_errors_fail_closed(self):
        from types import SimpleNamespace
        result = self.run_trial(detector=SimpleNamespace(detect=lambda frame: [{}, {}]))
        self.assertEqual(result['reason'], 'face_count')
        with patch('cv2.imencode', side_effect=RuntimeError('private diagnostic')):
            result = self.run_trial()
        self.assertEqual(result['reason'], 'processing_error')
        self.assertNotIn('private diagnostic', str(result))

    def test_wrong_challenge_prevents_identification(self):
        result = self.run_trial(direction='image_left')
        self.assertEqual(result['reason'], 'challenge_rejected')
        self.assertIsNone(result['identity'])

    def test_model_diagnostics_are_not_leaked(self):
        from types import SimpleNamespace
        def failed_prediction(*args):
            print('private diagnostic /secret/path', file=sys.stderr)
            return {}
        output = io.StringIO()
        with redirect_stderr(output):
            result = self.run_trial(predictor=SimpleNamespace(predict_frame=failed_prediction))
        self.assertEqual(result['reason'], 'pad_rejected')
        self.assertEqual(output.getvalue(), '')


class CliTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('webcam_login_spike', Path(__file__).resolve().parents[1] / 'scripts/spike_webcam_login.py')
        cls.cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.cli)

    def test_report_excludes_identity_and_scores(self):
        raw = {'identity': 'private-employee', 'reason': 'accepted', 'jpeg_bytes': [100] * 5, 'processing_ms': 12}
        result = self.cli.public_trial_result(raw, 'genuine', 'private-employee')
        self.assertTrue(result['correct_identity'])
        self.assertNotIn('private-employee', str(result))
        self.assertFalse(result['false_accept'])
        self.assertTrue(self.cli.public_trial_result(raw, 'screen', 'private-employee')['false_accept'])
        self.assertTrue(self.cli.public_trial_result(raw, 'genuine', 'other-employee')['false_accept'])

    def test_camera_is_released_on_read_failure(self):
        from unittest.mock import MagicMock
        camera = MagicMock()
        camera.isOpened.return_value = True
        camera.read.return_value = (False, None)
        with patch('cv2.VideoCapture', return_value=camera), patch('cv2.destroyAllWindows'), self.assertRaises(RuntimeError):
            self.cli.capture_sequence(0, 'image_right')
        camera.release.assert_called_once()

    def test_cli_alignment_rejects_transform_failure_without_bbox_fallback(self):
        with patch('cv2.estimateAffinePartial2D', return_value=(None, None)):
            result = PipelineTests().run_trial(align_face=self.cli.strict_align_face)
        self.assertIsNone(result['identity'])
        self.assertEqual(result['reason'], 'alignment_rejected')

    def test_explicit_thresholds_consent_and_new_output_required(self):
        args = self.cli.parser().parse_args([])
        with self.assertRaises(ValueError):
            self.cli.validate_args(args)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'trial.json'
            values = ['--participants', 'a', 'b', '--confirmed-consent', '--expected-code', 'a',
                      '--trial-type', 'genuine', '--split', 'calibration', '--output', str(output),
                      '--match', '0.8', '--margin', '0.05', '--consistency', '0.8', '--turn-delta', '0.2']
            args = self.cli.parser().parse_args(values)
            self.cli.validate_args(args)
            output.write_text('{}')
            with self.assertRaises(ValueError):
                self.cli.validate_args(args)


if __name__ == '__main__':
    unittest.main()
