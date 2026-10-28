"""
Kiểm thử tự động các tính năng Hardware & Edge Sync:
- Thu thập Telemetry phần cứng Pi 4 (CPU Temp, RAM %, Disk %, Wi-Fi, Bluetooth)
- Điều khiển âm lượng và phát chuông kiểm tra (AudioManager)
- Điều phối RPC ThingsBoard (setVolume, setShowFps, setStreamEnabled, playTestSound, scanWifi, scanBluetooth, reconnectBluetooth)
- Đồng bộ hai chiều qua Shared Attributes
"""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from hardware.peripherals import (
    get_cpu_temperature,
    get_ram_usage,
    get_disk_usage,
    get_wifi_info,
    get_bluetooth_info,
    get_hardware_telemetry,
    AudioManager,
)
from hardware.iot import ThingsBoardClient


class FakeMQTT:
    def __init__(self, rc=0):
        self.rc = rc
        self.sent = []

    def publish(self, topic, payload, qos=0):
        self.sent.append((topic, json.loads(payload), qos))
        return SimpleNamespace(rc=self.rc)


class HardwareSettingsTests(unittest.TestCase):
    def setUp(self):
        self.tb = ThingsBoardClient("test.invalid", 1883, "token-123", device_id="PI4_TEST")
        self.tb.client = FakeMQTT()
        self.tb.connected = True

    def test_hardware_telemetry_fields(self):
        """Kiểm tra telemetry thu thập đầy đủ 12 trường dữ liệu phần cứng & cài đặt"""
        data = get_hardware_telemetry({
            "volume": 80,
            "is_muted": False,
            "show_fps": True,
            "stream_enabled": False,
        })
        self.assertIn("cpu_temp", data)
        self.assertIn("ram_usage", data)
        self.assertIn("disk_usage", data)
        self.assertIn("wifi_ssid", data)
        self.assertIn("wifi_signal", data)
        self.assertIn("wifi_ip", data)
        self.assertIn("bluetooth_device", data)
        self.assertIn("bluetooth_connected", data)
        self.assertEqual(data["volume"], 80)
        self.assertEqual(data["is_muted"], False)
        self.assertEqual(data["show_fps"], True)
        self.assertEqual(data["stream_enabled"], False)

    def test_audio_manager_volume_clamping(self):
        """Kiểm tra âm lượng luôn được giới hạn an toàn 0-100%"""
        mgr = AudioManager(initial_volume=120)
        self.assertEqual(mgr.volume, 100)

        mgr.set_volume(-15)
        self.assertEqual(mgr.volume, 0)

        mgr.set_volume(65)
        self.assertEqual(mgr.volume, 65)

    def test_audio_manager_play_test_sound(self):
        """Kiểm tra phát âm thanh test không gây exception"""
        mgr = AudioManager(initial_volume=50)
        res = mgr.play_test_sound()
        self.assertTrue(res)

    def test_tb_rpc_set_volume(self):
        """Kiểm tra nhận RPC setVolume từ ThingsBoard"""
        changed = []
        self.tb.on_settings_change = lambda p: changed.append(p)

        msg = SimpleNamespace(
            topic="v1/devices/me/rpc/request/101",
            payload=json.dumps({"method": "setVolume", "params": 90}).encode("utf-8"),
        )
        self.tb.on_message(self.tb.client, None, msg)

        self.assertEqual(self.tb.volume, 90)
        self.assertTrue(any("volume" in p and p["volume"] == 90 for p in changed))
        
        # Kiểm tra phản hồi RPC response
        resp_topic, resp_payload, _ = self.tb.client.sent[-1]
        self.assertEqual(resp_topic, "v1/devices/me/rpc/response/101")
        self.assertEqual(resp_payload.get("volume"), 90)

    def test_tb_rpc_set_show_fps(self):
        """Kiểm tra nhận RPC setShowFps"""
        msg = SimpleNamespace(
            topic="v1/devices/me/rpc/request/102",
            payload=json.dumps({"method": "setShowFps", "params": False}).encode("utf-8"),
        )
        self.tb.on_message(self.tb.client, None, msg)
        self.assertFalse(self.tb.show_fps)

    def test_tb_rpc_scan_actions(self):
        """Kiểm tra các lệnh RPC quét Wi-Fi và Bluetooth"""
        self.tb.on_action_request = lambda action, params: (
            [{"ssid": "MyRealWifi", "signal": 75}] if action == "scanWifi"
            else [{"name": "MySpeaker", "address": "AA:BB:CC:DD:EE:FF"}]
        )
        msg_wifi = SimpleNamespace(
            topic="v1/devices/me/rpc/request/103",
            payload=json.dumps({"method": "scanWifi", "params": {}}).encode("utf-8"),
        )
        self.tb.on_message(self.tb.client, None, msg_wifi)
        _, payload_wifi, _ = self.tb.client.sent[-1]
        self.assertIsInstance(payload_wifi, list)
        self.assertTrue(any(net.get("ssid") == "MyRealWifi" for net in payload_wifi))

        msg_bt = SimpleNamespace(
            topic="v1/devices/me/rpc/request/104",
            payload=json.dumps({"method": "scanBluetooth", "params": {}}).encode("utf-8"),
        )
        self.tb.on_message(self.tb.client, None, msg_bt)
        _, payload_bt, _ = self.tb.client.sent[-1]
        self.assertIsInstance(payload_bt, list)
        self.assertTrue(any("MySpeaker" in d.get("name", "") for d in payload_bt))

    def test_tb_shared_attributes_sync(self):
        """Kiểm tra đồng bộ qua Shared Attributes từ ThingsBoard"""
        updated = {}
        self.tb.on_settings_change = lambda p: updated.update(p)

        msg = SimpleNamespace(
            topic="v1/devices/me/attributes",
            payload=json.dumps({
                "shared": {
                    "volume": 85,
                    "is_muted": True,
                    "show_fps": False,
                    "stream_enabled": False,
                }
            }).encode("utf-8"),
        )
        self.tb.on_message(self.tb.client, None, msg)

        self.assertEqual(self.tb.volume, 85)
        self.assertTrue(self.tb.is_muted)
        self.assertFalse(self.tb.show_fps)
        self.assertFalse(self.tb.stream_enabled)
        self.assertEqual(updated["volume"], 85)
        self.assertTrue(updated["is_muted"])


if __name__ == "__main__":
    unittest.main()
