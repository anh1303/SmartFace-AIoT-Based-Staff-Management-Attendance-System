"""Offline worker/camera integration: no models, camera, GPIO, MQTT or DB."""
import importlib.util
from pathlib import Path
import sys
from threading import Event, get_ident
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from recognition.worker import RecognitionWorker, IdentityCache
import edge_client as edge


def wait_for(predicate, timeout=1):
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() >= deadline:
            raise AssertionError('Worker did not finish in time')
        time.sleep(.002)


class BlockingEmbedder:
    def __init__(self, output=None):
        self.entered, self.release = Event(), Event()
        self.output = np.ones(512, dtype=np.float32) if output is None else output
        self.input_size = (112, 112)
        self.thread_id = None
        self.face = None

    def extract(self, face):
        self.thread_id = get_ident()
        self.entered.set()
        if not self.release.wait(2):
            raise TimeoutError('Test did not release embedder')
        self.face = face.copy()
        if isinstance(self.output, Exception):
            raise self.output
        return self.output


class WorkerTests(unittest.TestCase):
    def start_worker(self, embedder):
        worker = RecognitionWorker(embedder, queue_size=1)
        self.addCleanup(worker.close)
        self.addCleanup(embedder.release.set)
        return worker

    def test_runs_off_camera_thread_and_copies_crop(self):
        embedder = BlockingEmbedder()
        worker = self.start_worker(embedder)
        face = np.zeros((112, 112, 3), np.uint8)
        self.assertTrue(worker.submit((1,), face, ('event', 123, .9)))
        self.assertTrue(embedder.entered.wait(1))
        face[:] = 255
        self.assertNotEqual(embedder.thread_id, get_ident())
        embedder.release.set()
        wait_for(lambda: not worker.results.empty())
        result, = worker.poll()
        self.assertFalse(embedder.face.any())
        self.assertEqual(result.context, ('event', 123, .9))
        self.assertEqual(result.embedding.shape, (512,))

    def test_capacity_includes_cancelled_and_completed_work(self):
        embedder = BlockingEmbedder()
        worker = self.start_worker(embedder)
        face = np.zeros((112, 112, 3), np.uint8)
        self.assertTrue(worker.submit((1,), face, ()))
        self.assertTrue(embedder.entered.wait(1))
        self.assertFalse(worker.submit((1,), face, ()))
        self.assertTrue(worker.submit((2,), face, ()))
        worker.retain(set())
        self.assertFalse(worker.submit((3,), face, ()))
        embedder.release.set()
        wait_for(lambda: worker.results.qsize() == 2)
        self.assertFalse(worker.submit((3,), face, ()))
        self.assertEqual(worker.poll(), [])
        self.assertTrue(worker.submit((3,), face, ()))

    def test_invalid_vector_and_inference_error_are_explicit_and_retryable(self):
        for output in (np.zeros(512), np.ones(511), np.full(512, np.nan), RuntimeError('private details')):
            with self.subTest(output=type(output).__name__):
                embedder = BlockingEmbedder(output)
                worker = self.start_worker(embedder)
                embedder.release.set()
                self.assertTrue(worker.submit((1,), np.zeros((1, 1, 3)), ()))
                wait_for(lambda: not worker.results.empty())
                result, = worker.poll()
                self.assertIn(result.error, ('ValueError', 'RuntimeError'))
                self.assertIsNone(result.embedding)
                self.assertNotIn('private details', result.error)
                self.assertTrue(worker.submit((1,), np.zeros((1, 1, 3)), ()))

    def test_close_cancels_and_rejects_new_jobs(self):
        embedder = BlockingEmbedder()
        worker = self.start_worker(embedder)
        embedder.release.set()
        self.assertTrue(worker.close())
        self.assertFalse(worker.submit((1,), np.zeros((1, 1, 3)), ()))


class CameraIntegrationTests(unittest.TestCase):
    def run_camera(self, invalidate=None, publish_result=1, reply_after_reset=False, force_cache_hit=False):
        embedder = BlockingEmbedder()
        tb, streamer, display, ultrasonic = Mock(), Mock(), Mock(), Mock()
        tb.send_scan_rpc.return_value = publish_result
        display.is_active.return_value = False
        display.wants_frame.return_value = False
        track = SimpleNamespace(track_id=1, bbox=(0, 0, 100, 100), landmarks=np.zeros((5, 2)),
                                missing_frames=0, pad_ready=True, is_spoof=False, is_real=True,
                                verification_generation=0, pad_invalid_reason=None,
                                update_display_identity=Mock(), update_result=Mock(), invalidate_recognition=Mock(),
                                display_result=lambda *a: ("UNKNOWN", 0.0, False),
                                _pad_window=[], pad_min_votes=3,
                                last_pad_score=.9, last_pad_threshold=None, needs_pad=lambda **kw: False,
                                needs_recognition=lambda *a, **kw: True)
        tracker = Mock()
        tracker.needs_redetection.return_value = False
        tracker.update.side_effect = lambda *a, **kw: [({'bbox': track.bbox}, track)]
        detector = Mock()
        detector.detect.return_value = []
        workers = []
        cache = IdentityCache()
        if force_cache_hit:
            cache.lookup = Mock(return_value=("NV1", "Alice", .9))

        def make_worker(*a, **kw):
            worker = RecognitionWorker(*a, **kw)
            workers.append(worker)
            return worker

        reads = []
        old_event = []
        camera = Mock()
        camera.isOpened.return_value = True

        def read():
            nonlocal track
            reads.append(len(reads) + 1)
            if len(reads) == 2:
                self.assertTrue(embedder.entered.wait(1))
                # This read happens while embedding is still blocked.
                self.assertFalse(embedder.release.is_set())
                old_event.append(next(iter(workers[0].pending.values())).context[0])
                if invalidate:
                    replacement = invalidate(track)
                    if replacement is not None:
                        track = replacement
            if len(reads) == 3:
                # Restore PAD/visibility to verify an old job stays cancelled.
                track.pad_ready, track.missing_frames = True, 0
                embedder.release.set()
                wait_for(lambda: not workers[0].results.empty())
            if len(reads) == 4 and reply_after_reset:
                track.verification_generation += 1
                callback = tb.send_scan_rpc.call_args.kwargs['on_result']
                callback({'matched': True, 'success': True, 'similarity': .9,
                          'employee': {'id': 'NV1', 'full_name': 'Alice'}})
            if len(reads) > (4 if reply_after_reset else 3):
                raise KeyboardInterrupt()
            return True, np.zeros((480, 640, 3), np.uint8)

        camera.read.side_effect = read
        replacements = dict(
            FaceEmbedder=lambda **kw: embedder, RecognitionWorker=make_worker, IdentityCache=lambda *a: cache,
            FaceTracker=lambda **kw: tracker, create_detector=lambda *a, **kw: detector,
            AntiSpoofPredictor=Mock(), ThingsBoardClient=lambda **kw: tb,
            RTSPStreamer=lambda *a, **kw: streamer, TFTDisplay=lambda **kw: display,
            UltrasonicSensor=lambda **kw: ultrasonic, get_input_face=lambda *a: np.zeros((112, 112, 3), np.uint8),
            update_track_pad=lambda *a, **kw: 0,
            ULTRASONIC_ENABLED=False, SHOW_GUI=False, current_mode='CHECK_IN', mode_generation=0,
        )
        try:
            with patch.multiple(edge, **replacements), patch.object(edge.cv2, 'VideoCapture', return_value=camera), patch('builtins.print'):
                edge.main()
                if reply_after_reset:
                    track.update_result.assert_not_called()
                    self.assertFalse(cache.entries)
                elif invalidate:
                    for call in tb.send_scan_rpc.call_args_list:
                        self.assertNotEqual(call.kwargs["event_id"], old_event[0])
                else:
                    self.assertEqual(tb.send_scan_rpc.call_count, 1)
                if not invalidate and not reply_after_reset:
                    args, kwargs = tb.send_scan_rpc.call_args
                    self.assertAlmostEqual(args[1], edge.liveness_score(track.last_pad_score))
                    self.assertEqual(args[2], 'CHECK_IN')
                    self.assertTrue(kwargs['event_id'])
                    self.assertIsInstance(kwargs['captured_at'], int)
                self.assertGreaterEqual(streamer.write_frame.call_count, 3)
        finally:
            embedder.release.set()
            for worker in workers:
                self.assertTrue(worker.close())
        camera.release.assert_called_once()

    def test_camera_keeps_reading_while_embedding_waits_then_sends_rpc(self):
        self.run_camera()

    def test_no_overlay_when_all_video_outputs_are_disabled(self):
        with patch.object(edge, 'STREAM_ENABLED', False), \
             patch.object(edge.cv2, 'putText') as text, \
             patch.object(edge.cv2, 'rectangle') as rectangle:
            self.run_camera()
        text.assert_not_called()
        rectangle.assert_not_called()

    def test_mode_roundtrip_discards_old_embedding(self):
        def invalidate(track):
            edge.mode_generation += 2  # CHECK_IN -> CHECK_OUT -> CHECK_IN
        self.run_camera(invalidate)

    def test_new_track_discards_old_embedding(self):
        def new_track(track):
            fresh = SimpleNamespace(**vars(track))
            fresh.track_id = 2
            for attr in ('scan_scope', 'scan_event_id', 'scan_captured_at', 'last_scan_sent', 'last_recognition_time'):
                if hasattr(fresh, attr):
                    delattr(fresh, attr)
            return fresh
        self.run_camera(new_track)

    def test_pad_loss_cancels_embedding_even_when_pad_recovers(self):
        self.run_camera(lambda track: setattr(track, 'pad_ready', False))

    def test_missing_track_cancels_embedding_even_when_track_returns(self):
        self.run_camera(lambda track: setattr(track, 'missing_frames', 1))

    def test_verification_reset_with_same_track_and_ready_pad_discards_old_job(self):
        self.run_camera(lambda track: setattr(track, "verification_generation", track.verification_generation + 1))

    def test_rpc_reply_from_old_verification_session_is_ignored(self):
        self.run_camera(reply_after_reset=True)

    def test_display_cache_hit_still_requires_backend_rpc(self):
        self.run_camera(force_cache_hit=True)

    def test_publish_failure_does_not_crash_or_block_camera(self):
        self.run_camera(publish_result=-1)


if __name__ == '__main__':
    unittest.main()
