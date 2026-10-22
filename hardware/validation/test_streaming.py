"""A full OS pipe simulates a stalled FFmpeg without launching FFmpeg or a network."""
import importlib.util
import os
import subprocess
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
import numpy as np

spec = importlib.util.spec_from_file_location('policy_streamer', Path(__file__).resolve().parents[1] / 'streaming/rtsp_streamer.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StreamTests(unittest.TestCase):
    def test_full_queue_reuses_one_private_snapshot(self):
        streamer = module.RTSPStreamer('unused',2,2,15,enabled=False)
        streamer.enabled = True  # Inspect the queue without starting FFmpeg.
        streamer._frames.put_nowait(np.zeros((2,2,3), np.uint8))
        source = np.full((2,2,3),7,np.uint8)
        frame = Mock(shape=source.shape)
        frame.copy.side_effect = source.copy
        streamer.write_frame(frame)
        frame.copy.assert_called_once()
        source[:] = 99
        self.assertEqual(streamer._frames.qsize(),1)
        np.testing.assert_array_equal(streamer._frames.get_nowait(),7)

    def test_stalled_pipe_does_not_block_camera_submission(self):
        read_fd, write_fd = os.pipe()
        os.set_blocking(write_fd, False)
        try:
            while True: os.write(write_fd, b'x' * 65536)
        except BlockingIOError:
            pass
        os.set_blocking(write_fd, True)
        pipe = os.fdopen(write_fd, 'wb', buffering=0)
        process = SimpleNamespace(stdin=pipe, poll=lambda: None, terminate=lambda: None, wait=lambda timeout: 0)
        streamer = None
        try:
            with patch.object(module.RTSPStreamer, 'start_ffmpeg', lambda self: setattr(self, 'process', process)):
                streamer = module.RTSPStreamer('rtsp://test.invalid/unused',2,2,15)
                submitted = threading.Event()
                def camera():
                    for value in range(100): streamer.write_frame(np.full((2,2,3),value,dtype=np.uint8))
                    submitted.set()
                producer = threading.Thread(target=camera,daemon=True)
                producer.start()
                self.assertTrue(submitted.wait(0.5), 'Camera submission blocked behind the full FFmpeg pipe')
                producer.join(timeout=1)
                self.assertLessEqual(streamer._frames.qsize(),1)
        finally:
            if streamer: streamer.stop()
            if not pipe.closed: pipe.close()
            os.close(read_fd)

    def test_stuck_process_is_killed_and_reaped(self):
        streamer = module.RTSPStreamer('unused',2,2,15,enabled=False)
        process = Mock()
        process.wait.side_effect = [subprocess.TimeoutExpired('fake',1), 0]
        streamer.process = process
        streamer._close_process()
        process.terminate.assert_called_once()
        process.kill.assert_called_once()
        self.assertEqual(process.wait.call_count,2)
        process.stdin.close.assert_called_once()
        self.assertIsNone(streamer.process)


if __name__ == '__main__': unittest.main()
