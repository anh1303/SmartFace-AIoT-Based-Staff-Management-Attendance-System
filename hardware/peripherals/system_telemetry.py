"""
SmartFace AIoT — Edge Hardware Telemetry Collector
Thu thập sức khỏe phần cứng Raspberry Pi 4 và trạng thái thiết bị ngoại vi:
- Nhiệt độ CPU (CPU Temperature)
- Mức tiêu thụ bộ nhớ RAM (RAM Usage %)
- Dung lượng bộ nhớ đĩa (Disk Usage %)
- Trạng thái Wi-Fi (SSID, Signal %, IP LAN)
- Trạng thái Loa Bluetooth (Tên loa, kết nối)
"""

import os
import re
import socket
import subprocess
from typing import Dict, Any, Optional, List


def get_cpu_temperature() -> float:
    """
    Đọc nhiệt độ CPU trực tiếp từ kernel Linux /sys/class/thermal/thermal_zone0/temp.
    Fallback sang vcgencmd measure_temp hoặc nhiệt độ an toàn mặc định (48.5°C).
    """
    thermal_path = "/sys/class/thermal/thermal_zone0/temp"
    try:
        if os.path.exists(thermal_path):
            with open(thermal_path, "r", encoding="utf-8") as f:
                raw = f.read().strip()
                if raw.isdigit():
                    return round(float(raw) / 1000.0, 1)
    except Exception:
        pass

    # Thử qua vcgencmd (chuẩn Raspberry Pi OS)
    try:
        res = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True, timeout=1)
        if res.returncode == 0 and "temp=" in res.stdout:
            # temp=48.5'C
            m = re.search(r"temp=([\d\.]+)", res.stdout)
            if m:
                return round(float(m.group(1)), 1)
    except Exception:
        pass

    return 48.5


def get_ram_usage() -> float:
    """
    Đọc mức sử dụng RAM % từ /proc/meminfo (Linux kernel standard).
    Fallback sang 38.0% nếu không đọc được.
    """
    meminfo_path = "/proc/meminfo"
    try:
        if os.path.exists(meminfo_path):
            mem_total = None
            mem_avail = None
            with open(meminfo_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        parts = line.split()
                        mem_total = float(parts[1])
                    elif line.startswith("MemAvailable:"):
                        parts = line.split()
                        mem_avail = float(parts[1])
                    if mem_total is not None and mem_avail is not None:
                        break
            if mem_total and mem_avail is not None and mem_total > 0:
                used = mem_total - mem_avail
                return round((used / mem_total) * 100.0, 1)
    except Exception:
        pass

    return 38.0


def get_disk_usage(path: str = "/") -> float:
    """
    Đọc dung lượng ổ đĩa đã sử dụng % qua os.statvfs.
    Fallback sang 35.0%.
    """
    try:
        if hasattr(os, "statvfs"):
            st = os.statvfs(path)
            total = st.f_blocks * st.f_frsize
            free = st.f_bfree * st.f_frsize
            if total > 0:
                used_pct = (1.0 - (free / total)) * 100.0
                return round(used_pct, 1)
    except Exception:
        pass

    return 35.0


def get_local_ip() -> str:
    """
    Lấy địa chỉ IP mạng nội bộ chính xác mà không gửi gói tin ra ngoài.
    Trả về chuỗi rỗng nếu chưa kết nối mạng.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        pass

    try:
        res = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=1)
        if res.returncode == 0 and res.stdout.strip():
            ips = res.stdout.strip().split()
            if ips:
                return ips[0]
    except Exception:
        pass

    return ""


def get_wifi_info() -> Dict[str, Any]:
    """
    Lấy thông tin mạng Wi-Fi thực tế (SSID, Signal %, IP).
    Trả về ssid rỗng và connected=False nếu chưa kết nối Wi-Fi.
    """
    ip = get_local_ip()
    ssid = ""
    signal = 0

    # 1. Thử đọc qua iwgetid
    try:
        res = subprocess.run(["iwgetid", "-r"], capture_output=True, text=True, timeout=1)
        if res.returncode == 0 and res.stdout.strip():
            ssid = res.stdout.strip()
    except Exception:
        pass

    # 2. Thử đọc qua nmcli nếu iwgetid không có
    if not ssid:
        try:
            res = subprocess.run(
                ["nmcli", "-t", "-f", "active,ssid", "dev", "wifi"],
                capture_output=True,
                text=True,
                timeout=1,
            )
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    if line.startswith("yes:"):
                        ssid = line.split(":", 1)[1].strip()
                        break
        except Exception:
            pass

    # 3. Đọc mức sóng từ /proc/net/wireless nếu có kết nối
    if ssid:
        signal = 80  # Mức mặc định khi phát hiện có kết nối nhưng chưa đọc được /proc
        try:
            wireless_path = "/proc/net/wireless"
            if os.path.exists(wireless_path):
                with open(wireless_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    if len(lines) >= 3:
                        parts = lines[2].split()
                        if len(parts) >= 3:
                            link_val = float(parts[2].replace(".", ""))
                            calc_signal = min(100, int((link_val / 70.0) * 100.0))
                            if calc_signal > 0:
                                signal = calc_signal
        except Exception:
            pass

    return {
        "connected": bool(ssid),
        "ssid": ssid,
        "signal": signal,
        "ip": ip,
    }


def get_bluetooth_info() -> Dict[str, Any]:
    """
    Lấy thông tin thực tế của loa Bluetooth đang kết nối tới Pi qua bluetoothctl.
    Trả về connected=False nếu chưa kết nối loa nào.
    """
    try:
        res = subprocess.run(["bluetoothctl", "info"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0 and "Connected: yes" in res.stdout:
            device_name = ""
            device_addr = ""
            for line in res.stdout.splitlines():
                line = line.strip()
                if line.startswith("Name:"):
                    device_name = line.split(":", 1)[1].strip()
                elif line.startswith("Device"):
                    parts = line.split()
                    if len(parts) >= 2:
                        device_addr = parts[1]
            if device_name or device_addr:
                return {
                    "deviceName": device_name or "Bluetooth Speaker",
                    "connected": True,
                    "status": "connected",
                    "address": device_addr,
                }
    except Exception:
        pass

    return {
        "deviceName": "",
        "connected": False,
        "status": "disconnected",
        "address": "",
    }


def scan_bluetooth_devices() -> List[Dict[str, Any]]:
    """
    Quét danh sách các thiết bị loa Bluetooth thực tế (đã paired hoặc đang phát hiện).
    """
    devices: List[Dict[str, Any]] = []
    try:
        res = subprocess.run(["bluetoothctl", "devices"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                line = line.strip()
                if line.startswith("Device"):
                    parts = line.split(maxsplit=2)
                    if len(parts) >= 3:
                        devices.append({
                            "name": parts[2],
                            "address": parts[1],
                            "connected": False,
                            "paired": True,
                        })
    except Exception:
        pass
    return devices


def get_hardware_telemetry(settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Tổng hợp toàn bộ chỉ số phần cứng và ngoại vi để đẩy lên ThingsBoard Telemetry (QoS 0).
    """
    settings = settings or {}
    wifi = get_wifi_info()
    bt = get_bluetooth_info()

    return {
        "cpu_temp": get_cpu_temperature(),
        "ram_usage": get_ram_usage(),
        "disk_usage": get_disk_usage(),
        "wifi_ssid": wifi["ssid"],
        "wifi_signal": wifi["signal"],
        "wifi_ip": wifi["ip"],
        "wifi_connected": wifi["connected"],
        "bluetooth_device": bt["deviceName"],
        "bluetooth_connected": bt["connected"],
        "volume": int(settings.get("volume", 75)),
        "is_muted": bool(settings.get("is_muted", False)),
        "show_fps": bool(settings.get("show_fps", True)),
        "stream_enabled": bool(settings.get("stream_enabled", True)),
    }
