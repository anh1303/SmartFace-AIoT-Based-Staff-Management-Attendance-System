"""Deterministic checks for webcam/Pi PAD and recognition parity."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from face_login.pipeline import extract_sequence


def vector():
    result = np.zeros(512, dtype=np.float32)
    result[0] = 1
    return result


class WebcamParityTests(unittest.TestCase):
    def evaluate(self, votes):
        scores = iter(votes)
        face = {'bbox': (10, 10, 90, 90), 'score': 0.99,
                'landmarks': [[30, 30], [70, 30], [50, 50], [35, 70], [65, 70]]}
        def predict(_frame, _bbox):
            real = next(scores)
            return {'is_real': real, 'pad_score': 2.0 if real else -2.0, 'threshold_logit': 0.0}
        models = dict(detector=SimpleNamespace(detect=lambda _frame: [face]),
                      predictor=SimpleNamespace(predict_frame=predict),
                      embedder=SimpleNamespace(input_size=(112, 112), embed_aligned=lambda _face: vector()),
                      align_face=lambda *_args: np.zeros((112, 112, 3), dtype=np.uint8))
        with patch('face_login.pipeline.config.PAD_MIN_VOTES', 3), \
             patch('face_login.pipeline.config.PAD_SMOOTH_WINDOW', 5), \
             patch('face_login.pipeline.config.PAD_SPOOF_MIN_RATIO', 0.6):
            return extract_sequence([np.zeros((100, 100, 3), dtype=np.uint8)] * 8,
                                    **models, already_decoded=True)

    def test_mixed_pad_votes_allow_straight_face_when_pi_verdict_is_real(self):
        result = self.evaluate([True, False, True, True, False, True, True, True])
        self.assertEqual(result['reason'], 'verified')
        self.assertGreaterEqual(len(result['embeddings']), 3)
        self.assertTrue(all(len(embedding) == 512 for embedding in result['embeddings']))

    def test_spoof_majority_is_rejected(self):
        result = self.evaluate([True, False, False, True, False, False, False, False])
        self.assertEqual(result['reason'], 'pad_rejected')
        self.assertEqual(result['embeddings'], [])

    def test_raw_spoof_vote_resets_consecutive_recognition_like_pi_backend(self):
        result = self.evaluate([True, True, False, True, True, False, True, True])
        self.assertEqual(result['reason'], 'pad_rejected')
        self.assertEqual(result['embeddings'], [])


if __name__ == '__main__':
    unittest.main()
