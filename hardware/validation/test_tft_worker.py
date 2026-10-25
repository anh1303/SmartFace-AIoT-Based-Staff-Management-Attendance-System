"""TFT threading/rate/ownership checks without SPI or Raspberry Pi libraries."""
import importlib.util
from pathlib import Path
from queue import Queue
import threading
import time
from unittest.mock import Mock, patch
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('tft_worker_policy', Path(__file__).resolve().parents[1]/'display/tft_st7789v.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TFTWorkerTests(unittest.TestCase):
    def start_display(self, action=None, fps=10):
        display = module.TFTDisplay(enabled=False, max_fps=fps)
        display.screen = Mock(size=(320,240))
        if action:
            display.screen.display.side_effect = action
        display.enabled = True
        transform = patch.object(module, 'frame_to_tft_image', side_effect=lambda frame, size: frame)
        transform.start()
        self.addCleanup(transform.stop)
        self.addCleanup(display.cleanup)
        display._start_worker()
        return display

    def force_offer(self, display, value):
        # Simulate the producer's next eligible interval without a real camera.
        with display._condition:
            display._last_submit_time = -float('inf')
        self.assertTrue(display.show_frame(np.full((4,4,3), value, np.uint8)))

    def test_slow_spi_keeps_only_latest_private_frame_and_never_blocks_producer(self):
        entered, release, second = threading.Event(), threading.Event(), threading.Event()
        seen, threads = [], []
        def send(frame):
            seen.append(int(frame[0,0,0])); threads.append(threading.get_ident())
            if len(seen)==1:
                entered.set()
                release.wait(2)
            else:
                second.set()
        display = self.start_display(send)
        self.addCleanup(release.set)
        source = np.full((4,4,3), 11, np.uint8)
        self.assertTrue(display.show_frame(source)); source[:]=99
        self.assertTrue(entered.wait(1))
        submitted = threading.Event()
        def produce():
            self.force_offer(display,22); self.force_offer(display,33); submitted.set()
        producer = threading.Thread(target=produce,daemon=True); producer.start()
        self.assertTrue(submitted.wait(.5), 'Camera blocked behind SPI')
        producer.join(1)
        with display._condition:
            self.assertEqual(int(display._pending_frame[0,0,0]),33)
        release.set(); self.assertTrue(second.wait(1))
        self.assertTrue(display.cleanup())
        self.assertEqual(seen,[11,33])
        self.assertTrue(all(t != threading.get_ident() for t in threads))
        display.screen.cleanup.assert_called_once()

    def test_rate_skips_copy_and_overlay_request(self):
        display = self.start_display()
        source = Mock(); source.copy.return_value = np.zeros((4,4,3),np.uint8)
        # Hold the producer lock so the tight assertions don't depend on scheduling.
        with display._condition:
            self.assertTrue(display.show_frame(source))
            self.assertFalse(display.wants_frame())
            for _ in range(20): self.assertFalse(display.show_frame(source))
        source.copy.assert_called_once()

    def test_worker_enforces_display_interval_even_with_forced_fast_submissions(self):
        timestamps=Queue()
        display=self.start_display(lambda frame: timestamps.put(time.monotonic()))
        starts=[]
        for value in range(3):
            self.force_offer(display,value)
            starts.append(timestamps.get(timeout=1))
        self.assertTrue(all(b-a >= .095 for a,b in zip(starts,starts[1:])))

    def test_shutdown_is_bounded_and_does_not_close_spi_during_write(self):
        entered,release=threading.Event(),threading.Event()
        def send(frame): entered.set(); release.wait(2)
        display=self.start_display(send);self.addCleanup(release.set)
        self.force_offer(display,1);self.assertTrue(entered.wait(1))
        self.force_offer(display,2)
        self.assertFalse(display.cleanup(timeout=.01))
        display.screen.cleanup.assert_not_called()
        self.assertIsNone(display._pending_frame)
        self.assertFalse(display.show_frame(np.zeros((4,4,3),np.uint8)))
        release.set();self.assertTrue(display.cleanup(timeout=1))
        display.screen.cleanup.assert_called_once()

    def test_failure_disables_output_and_releases_resources_once(self):
        display=self.start_display(Mock(side_effect=OSError('fake SPI error')))
        with patch('builtins.print'):
            self.force_offer(display,1)
            self.assertTrue(display._stop.wait(1))
            self.assertTrue(display.cleanup())
        self.assertFalse(display.wants_frame())
        display.cleanup();display.screen.cleanup.assert_called_once()

    def test_disabled_and_rate_bounds(self):
        for requested,expected in ((5,5),(10,10),(15,10),(0,1)):
            display=module.TFTDisplay(enabled=False,max_fps=requested)
            self.assertEqual(display.max_fps,expected)
            self.assertIsNone(display._worker)
            source=Mock();self.assertFalse(display.show_frame(source));source.copy.assert_not_called()
            self.assertTrue(display.cleanup())
        with self.assertRaises(ValueError):module.TFTDisplay(enabled=False,max_fps=float('nan'))

    def test_rgb565_contract_and_letterbox_are_preserved(self):
        from PIL import Image
        self.assertEqual(module.rgb565_bytes(Image.new('RGB',(1,1),(255,0,0))),b'\xf8\x00')
        frame=np.full((20,20,3),(255,0,0),np.uint8)
        result=module.frame_to_tft_image(frame,(40,20))
        self.assertEqual(result.getpixel((0,0)),(0,0,0))
        self.assertEqual(result.getpixel((20,10)),(0,0,255))
        exact=module.frame_to_tft_image(frame,(20,20))
        self.assertEqual(exact.size,(20,20))
        np.testing.assert_array_equal(np.asarray(exact),frame[:,:,::-1])
