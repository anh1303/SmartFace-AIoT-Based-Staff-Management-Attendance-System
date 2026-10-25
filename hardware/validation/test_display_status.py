"""Display must not leak a held identity over invalid/pending/spoof verdicts."""
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from edge_client import face_status_label


class DisplayStatusTests(unittest.TestCase):
    def test_unverified_face_never_shows_cached_identity(self):
        for overrides, expected in (
            ({'pad_invalid_reason': 'face_too_close_to_frame_edge'}, 'INVALID'),
            ({'missing_frames': 1}, 'CHECKING'),
            ({'pad_ready': False}, 'CHECKING'),
            ({'is_spoof': True}, 'SPOOF'),
        ):
            with self.subTest(expected=expected, overrides=overrides):
                fields = dict(pad_invalid_reason=None, missing_frames=0,
                              pad_ready=True, is_spoof=False, is_real=True,
                              display_result=Mock(return_value=('EMP001', .99, True)))
                fields.update(overrides)
                track = SimpleNamespace(**fields)
                self.assertEqual(face_status_label(track)[0], expected)
                track.display_result.assert_not_called()

    def test_real_uses_existing_display_identity_without_score(self):
        for name in ('UNKNOWN', 'EMP001'):
            track = SimpleNamespace(pad_invalid_reason=None, missing_frames=0,
                                    pad_ready=True, is_spoof=False, is_real=True,
                                    display_result=Mock(return_value=(name, .98, False)))
            self.assertEqual(face_status_label(track)[0], 'REAL - '+name)
