"""Camera/RPC integration with real Track counters and no hardware/network."""
from pathlib import Path
import sys
import time
from unittest.mock import Mock, patch
import unittest

import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import edge_client as edge
from tracking.tracker import Track


class ConfirmationFlowTests(unittest.TestCase):
    def test_both_modes_verify_twice_before_the_commit_rpc(self):
        for mode in ('CHECK_IN', 'CHECK_OUT'):
            with self.subTest(mode=mode):
                self.run_mode(mode)

    def test_spoof_verdict_restarts_three_confirmations_in_both_modes(self):
        for mode in ('CHECK_IN', 'CHECK_OUT'):
            with self.subTest(mode=mode): self.run_mode(mode, interruption='spoof')

    def test_disappeared_track_restarts_even_if_same_track_object_returns(self):
        for mode in ('CHECK_IN', 'CHECK_OUT'):
            with self.subTest(mode=mode): self.run_mode(mode, interruption='lost')

    def run_mode(self, mode, interruption=None):
        track = Track(1, (100,100,200,200), pad_min_votes=3)
        track.landmarks = [[130,135],[170,135],[150,155],[135,175],[165,175]]
        for _ in range(3): track.update_pad(True,3.)
        track.needs_recognition = lambda *a, **kw: True  # Fast deterministic clock for this flow test.
        tracker, camera, tb = Mock(), Mock(), Mock()
        tracker.needs_redetection.return_value = False
        visible = True
        tracker.update.side_effect = lambda *a, **kw: [({'bbox':track.bbox}, track)] if visible else []
        camera.isOpened.return_value = True
        sent = []
        counts = {}
        def rpc(embedding, score, rpc_mode, on_result=None, **kwargs):
            sent.append(kwargs)
            self.assertEqual(rpc_mode, mode)
            event = kwargs["event_id"]
            counts[event] = counts.get(event, 0) + 1
            index = counts[event]
            readonly = index < 3
            self.assertEqual(kwargs['event_kind'], 'VERIFY_ONLY' if readonly else 'CONFIRMED_SCAN')
            self.assertEqual(kwargs['expected_employee_id'], None if readonly else 'employee-a')
            on_result(dict(event_id=kwargs['event_id'], success=True, matched=True,
                           verification_only=readonly, confirmation_count=index,
                           similarity=.95, mode=mode, employee={'id':'employee-a','full_name':'Alice'}))
            return len(sent)
        tb.send_scan_rpc.side_effect = rpc
        reads = 0
        interruption_stage = 0
        target = 5 if interruption else 3
        def read():
            nonlocal reads, visible, interruption_stage
            reads += 1
            if len(sent) == target: raise KeyboardInterrupt()
            if interruption and len(sent) == 2 and interruption_stage == 0:
                interruption_stage = 1
                if interruption == 'spoof':
                    for _ in range(3): track.update_pad(False,-3.)
                    self.assertTrue(track.is_spoof)
                else:
                    visible = False
            elif interruption_stage == 1:
                self.assertEqual(track.stable_recognitions, 0)
                interruption_stage = 2
                visible = True
                for _ in range(5): track.update_pad(True,3.)
            if reads > 200: raise AssertionError('Confirmation flow stalled')
            time.sleep(.002)  # Yield to the actual embedding worker.
            return True, np.zeros((480,640,3),np.uint8)
        camera.read.side_effect = read
        display = Mock();display.is_active.return_value=False
        embedder=Mock(input_size=(112,112));embedder.extract.return_value=np.ones(512,dtype=np.float32)
        detector=Mock();detector.detect.return_value=[]
        replacements=dict(FaceEmbedder=lambda **kw:embedder, FaceTracker=lambda **kw:tracker,
                          create_detector=lambda *a, **kw:detector, AntiSpoofPredictor=Mock(),
                          ThingsBoardClient=lambda **kw:tb, RTSPStreamer=Mock(), TFTDisplay=lambda **kw:display,
                          UltrasonicSensor=Mock(), update_track_pad=lambda *a, **kw:0,
                          get_input_face=lambda *a:np.zeros((112,112,3),np.uint8),
                          ULTRASONIC_ENABLED=False, SHOW_GUI=False, current_mode=mode, mode_generation=0)
        with patch.multiple(edge, **replacements), patch.object(edge.cv2,'VideoCapture',return_value=camera), patch('builtins.print'):
            edge.main()
        self.assertEqual(len(sent),target)
        self.assertEqual(track.stable_recognitions,3)
        self.assertEqual(len({x['recognition_id'] for x in sent}),target)
        self.assertEqual(list(counts.values()), [2,3] if interruption else [3])
        for event in counts:
            self.assertEqual(len({x['captured_at'] for x in sent if x['event_id'] == event}),1)
        self.assertTrue(track.attendance_sent)


if __name__ == '__main__': unittest.main()
