import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from peripherals.arduino_servo import ArduinoServoController


class ArduinoServoTests(unittest.TestCase):
    def test_identifies_sketch_and_acknowledges_angles_and_detach(self):
        gate = ArduinoServoController("/dev/ttyACM0")
        connection = Mock()
        connection.readline.side_effect = [
            b"READY SMARTFACE_GATE\r\n",
            b"PONG SMARTFACE_GATE\r\n",
            b"OK SERVO 500\r\n",
            b"OK SERVO 1500\r\n",
            b"OK DETACH\r\n",
        ]
        with patch.dict(sys.modules, {"serial": Mock(Serial=Mock(return_value=connection))}):
            gate.set_angle(0)
        gate.set_angle(90)
        self.assertEqual(gate.door_state, "OPEN_IN")
        gate.set_angle(None)
        self.assertEqual([call.args[0] for call in connection.write.call_args_list],
                         [b"\nPING\n", b"SERVO 500\n", b"SERVO 1500\n", b"DETACH\n"])

    def test_startup_commands_closed_then_detaches(self):
        gate = ArduinoServoController("/dev/ttyACM0")
        with patch.object(gate, "set_angle") as set_angle, patch("peripherals.arduino_servo.time.sleep"):
            self.assertTrue(gate.initialize_closed())
        self.assertEqual([call.args for call in set_angle.call_args_list], [(0.0,), (None,)])

    def test_bad_ack_does_not_update_gate_state(self):
        gate = ArduinoServoController("/dev/ttyACM0")
        connection = Mock()
        connection.readline.return_value = b"ERR INVALID_COMMAND\n"
        gate._serial = connection
        with self.assertRaisesRegex(RuntimeError, "rejected"):
            gate.set_angle(90)
        connection.close.assert_called_once()
        self.assertIsNone(gate._serial)
        self.assertEqual(gate.door_state, "CLOSED")


if __name__ == "__main__":
    unittest.main()
