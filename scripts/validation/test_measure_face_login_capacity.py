"""Offline regression tests for benchmark validity; no model/camera is loaded."""
import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import cv2
import numpy as np

spec = importlib.util.spec_from_file_location(
    'capacity', Path(__file__).with_name('measure_face_login_capacity.py'))
capacity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capacity)


class CapacityValidityTests(unittest.TestCase):
    def test_missing_photo_reports_unmeasured_without_loading_models(self):
        self.assertEqual(capacity.measure(), {
            'measured': False, 'forced_pad_verdict': False,
            'reason': 'explicit_face_image_required',
        })

    def test_no_automatic_fixture_search(self):
        self.assertEqual(capacity._find_candidate_images(None), [])

    def test_spoof_fixture_is_rejected_instead_of_forcing_pad(self):
        face = {'bbox': (10, 10, 90, 90)}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'fixture.jpg'
            cv2.imwrite(str(path), np.zeros((100, 100, 3), dtype=np.uint8))
            with patch('vision_pipeline._pad_face_skip_reason', return_value=None), \
                    patch.object(capacity, 'REPO_ROOT', Path(tmp)):
                result = capacity._select_valid_face_jpeg(
                    SimpleNamespace(detect=lambda _f: [face]),
                    SimpleNamespace(predict_frame=lambda *_a: {'is_real': False}), [path])
            self.assertIsNone(result)

    def test_no_face_fixture_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'no-face.jpg'
            cv2.imwrite(str(path), np.zeros((100, 100, 3), dtype=np.uint8))
            self.assertIsNone(capacity._select_valid_face_jpeg(
                SimpleNamespace(detect=lambda _f: []), None, [path]))

    def test_explicit_photo_outside_repo_can_pass_without_forcing_pad(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'fixture.jpg'
            cv2.imwrite(str(path), np.zeros((100, 100, 3), dtype=np.uint8))
            with patch('vision_pipeline._pad_face_skip_reason', return_value=None):
                result = capacity._select_valid_face_jpeg(
                    SimpleNamespace(detect=lambda _f: [{'bbox': (10, 10, 90, 90)}]),
                    SimpleNamespace(predict_frame=lambda *_a: {'is_real': True}), [path])
            self.assertEqual(result[2], str(path.resolve()))
            self.assertTrue(result[3])

    def test_failures_do_not_count_as_embedding_throughput(self):
        outcomes = iter([{'status': 'embedding', 'reason': 'ok'},
                         {'status': 'reset', 'reason': 'raw_spoof'}])
        result = capacity._measure_path(lambda: next(outcomes), 'embedding:ok', 2)
        self.assertEqual(result['success_count'], 1)
        self.assertEqual(result['failure_count'], 1)
        self.assertIsNone(result['fps'])
        self.assertEqual(result['outcomes']['reset:raw_spoof'], 1)

    def test_only_complete_successful_runs_publish_throughput(self):
        result = capacity._measure_path(
            lambda: {'status': 'embedding', 'reason': 'ok'}, 'embedding:ok', 30)
        self.assertEqual(result['success_count'], 30)
        self.assertEqual(result['failure_count'], 0)
        self.assertGreater(result['fps'], 0)

    def test_all_spoof_samples_never_publish_throughput(self):
        result = capacity._measure_path(
            lambda: {'status': 'reset', 'reason': 'raw_spoof'}, 'embedding:ok', 30)
        self.assertEqual(result['success_count'], 0)
        self.assertEqual(result['failure_count'], 30)
        self.assertIsNone(result['fps'])


if __name__ == '__main__':
    unittest.main()
