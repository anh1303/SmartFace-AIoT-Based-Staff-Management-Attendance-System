from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from peripherals.system_telemetry import get_bluetooth_info


class BluetoothStatusTests(unittest.TestCase):
    def reply(self, text, code=0):
        return SimpleNamespace(returncode=code, stdout=text)

    def test_enumerates_connected_audio_instead_of_using_the_last_disconnected_default(self):
        with patch('peripherals.system_telemetry.subprocess.run', side_effect=[
            self.reply('Device 01:08:51:ED:08:B9 HAVIT TW958 PRO\n'),
            self.reply('Device 01:08:51:ED:08:B9\n Name: HAVIT TW958 PRO\n Icon: audio-headset\n Connected: yes\n'),
        ]) as run:
            self.assertEqual(get_bluetooth_info()['deviceName'], 'HAVIT TW958 PRO')
        self.assertEqual(run.call_args_list[0].args[0], ['bluetoothctl', 'devices', 'Connected'])

    def test_does_not_misidentify_a_connected_keyboard_as_the_audio_output(self):
        with patch('peripherals.system_telemetry.subprocess.run', side_effect=[
            self.reply('Device AA:BB:CC:DD:EE:FF Keyboard\n'),
            self.reply('Name: Keyboard\n Icon: input-keyboard\n Connected: yes\n'),
        ]):
            self.assertFalse(get_bluetooth_info()['connected'])

    def test_explicit_device_requires_current_connected_state(self):
        with patch('peripherals.system_telemetry.subprocess.run', return_value=self.reply('Name: HAVIT\n Connected: no\n')):
            self.assertFalse(get_bluetooth_info('01:08:51:ED:08:B9')['connected'])

    def test_no_connected_devices_is_disconnected(self):
        with patch('peripherals.system_telemetry.subprocess.run', return_value=self.reply('')):
            self.assertFalse(get_bluetooth_info()['connected'])


if __name__ == '__main__':
    unittest.main()
