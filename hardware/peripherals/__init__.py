"""
Module peripherals: Chứa các driver và dịch vụ giao tiếp phần cứng ngoại vi (Sensors, Displays, Actuators, Audio).
"""

from .ultrasonic_sensor import UltrasonicSensor
from .audio_manager import AudioManager
from .system_telemetry import (
    get_cpu_temperature,
    get_ram_usage,
    get_disk_usage,
    get_wifi_info,
    get_bluetooth_info,
    scan_bluetooth_devices,
    get_hardware_telemetry,
)

__all__ = [
    "UltrasonicSensor",
    "AudioManager",
    "get_cpu_temperature",
    "get_ram_usage",
    "get_disk_usage",
    "get_wifi_info",
    "get_bluetooth_info",
    "scan_bluetooth_devices",
    "get_hardware_telemetry",
]
