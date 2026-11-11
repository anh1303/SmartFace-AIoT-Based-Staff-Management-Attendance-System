"""A slow Bluetooth command must not delay gate control or the camera loop."""
from pathlib import Path
import sys
from threading import Event, get_ident
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from peripherals.audio_manager import AudioManager


class AudioFeedbackTests(unittest.TestCase):
    def test_bluetooth_discovery_and_playback_setup_run_off_caller_thread(self):
        manager = AudioManager.__new__(AudioManager)
        manager.is_muted = False
        entered, release, played = Event(), Event(), Event()
        calls = []

        def discover():
            calls.append(get_ident())
            entered.set()
            release.wait(2)
            return {'address': 'test-device', 'deviceName': 'speaker', 'connected': True}

        def speak(*args):
            calls.append(args)
            played.set()

        manager.speak_attendance = speak
        try:
            self.assertTrue(manager.queue_attendance('Employee', 'CHECK_OUT', discover))
            self.assertTrue(entered.wait(1))
            self.assertNotEqual(calls[0], get_ident())
            self.assertFalse(played.is_set())
        finally:
            release.set()
        self.assertTrue(played.wait(1))
        self.assertEqual(calls[1], ('Employee', 'CHECK_OUT', 'test-device', 'speaker'))

    def test_disconnected_bluetooth_never_plays_to_the_default_hdmi_output(self):
        manager = AudioManager.__new__(AudioManager)
        manager.is_muted = False
        from unittest.mock import Mock, patch
        manager.speak_attendance = Mock()
        # Execute the worker synchronously to assert its completed decision.
        with patch('peripherals.audio_manager.threading.Thread') as thread:
            thread.side_effect = lambda **kw: Mock(start=kw['target'])
            manager.queue_attendance('Employee', 'CHECK_IN', lambda: {'connected': False})
        manager.speak_attendance.assert_not_called()

    def test_muted_feedback_does_not_discover_or_play(self):
        manager = AudioManager.__new__(AudioManager)
        manager.is_muted = True
        self.assertFalse(manager.queue_attendance('Employee', 'CHECK_IN', lambda: self.fail('discovery called')))


if __name__ == '__main__':
    unittest.main()
