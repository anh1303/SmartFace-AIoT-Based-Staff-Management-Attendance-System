"""Physical gate timing with a fake clock; no GPIO or real waits."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('servo_presence_driver', Path(__file__).resolve().parents[1] / 'peripherals/servo_controller.py')
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)


class ServoPresenceTests(unittest.TestCase):
    def run_gate(self, sensor, mode='CHECK_IN', **kwargs):
        clock = SimpleNamespace(now=0.)
        gate = driver.ServoController(enabled=False)
        gate.enabled = True
        commands = []
        original = gate.set_angle
        def set_angle(angle):
            commands.append((clock.now, angle))
            original(angle)
        def sleep(seconds):
            clock.now += seconds
            if clock.now > 100:
                raise AssertionError('Gate failed to close')
        def thread(target, **kwargs):
            return SimpleNamespace(start=target)
        gate.set_angle = set_angle
        with patch.object(driver.time, 'monotonic', lambda: clock.now), patch.object(driver.time, 'sleep', sleep), patch.object(driver.threading, 'Thread', thread):
            gate.open_gate_safe(mode, lambda: sensor(clock.now), close_delay_seconds=5, **kwargs)
        return commands

    def test_holds_beyond_old_fifteen_second_limit_then_waits_five_seconds(self):
        commands = self.run_gate(lambda now: now < 30)
        self.assertEqual(commands[0][1], 90)
        closed = next(t for t, angle in commands if angle == 0)
        self.assertGreaterEqual(closed, 35)
        self.assertLess(closed, 35.3)
        self.assertIsNone(commands[-1][1])
        closing_index = next(i for i, (_, angle) in enumerate(commands) if angle == 0)
        self.assertFalse(any(angle is None for _, angle in commands[:closing_index]))
        self.assertGreaterEqual(commands[-1][0] - commands[closing_index][0], 1.0)

    def test_returning_person_restarts_full_countdown(self):
        commands = self.run_gate(lambda now: now < 2 or 4 <= now < 8, mode='CHECK_OUT')
        self.assertEqual(commands[0][1], 90)
        closed = next(t for t, angle in commands if angle == 0)
        self.assertGreaterEqual(closed, 13)
        self.assertLess(closed, 13.3)

    def test_sensor_error_does_not_close_gate_and_resets_countdown(self):
        def sensor(now):
            if 3 <= now < 15:
                raise RuntimeError('sensor unavailable')
            return False
        commands = self.run_gate(sensor)
        closed = next(t for t, angle in commands if angle == 0)
        self.assertGreaterEqual(closed, 20)
        self.assertLess(closed, 20.3)

    def test_repeated_request_does_not_queue_another_movement(self):
        gate = driver.ServoController(enabled=False)
        gate.enabled = True
        gate._lock.acquire()
        try:
            with patch.object(driver.threading, 'Thread') as thread:
                gate.open_gate_safe('CHECK_IN', lambda: True)
                thread.assert_not_called()
        finally:
            gate._lock.release()

    def test_max_hold_seconds_and_detach_after_move(self):
        commands = self.run_gate(lambda now: True, max_hold_seconds=8.0, detach_after_move=True)
        self.assertEqual(commands[0][1], 90)
        closed = next(t for t, angle in commands if angle == 0)
        self.assertGreaterEqual(closed, 8.6)
        self.assertLess(closed, 9.0)
        self.assertIsNone(commands[-1][1])


if __name__ == '__main__':
    unittest.main()
