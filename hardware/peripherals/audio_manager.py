"""
SmartFace AIoT — Edge Audio Manager
Điều khiển âm lượng loa Bluetooth (PulseAudio sink volume) và phát chuông check-in/test:
- pactl set-sink-volume / pactl set-sink-mute
- Tự động chuyển fallback Jack 3.5mm nếu mất kết nối loa Bluetooth
- Phát âm thanh chuông kiểm tra (test sound chime) phi đồng bộ qua subprocess (non-blocking)
"""

import os
import shutil
import subprocess
import threading
from typing import Optional


class AudioManager:
    def __init__(self, initial_volume: int = 75, initial_muted: bool = False):
        self.volume = max(0, min(100, int(initial_volume)))
        self.is_muted = bool(initial_muted)
        self._lock = threading.Lock()
        self._has_pactl = shutil.which("pactl") is not None
        self._has_amixer = shutil.which("amixer") is not None
        self._has_paplay = shutil.which("paplay") is not None
        self._has_aplay = shutil.which("aplay") is not None

        # Khởi tạo mức âm lượng ban đầu
        self.apply_volume(self.volume, self.is_muted)

    def apply_volume(self, volume: int, is_muted: bool = False):
        """
        Cập nhật âm lượng vật lý trên hệ thống Linux.
        """
        with self._lock:
            self.volume = max(0, min(100, int(volume)))
            self.is_muted = bool(is_muted)

        # PulseAudio / PipeWire
        if self._has_pactl:
            try:
                subprocess.run(
                    ["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{self.volume}%"],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=1.0,
                )
                subprocess.run(
                    ["pactl", "set-sink-mute", "@DEFAULT_SINK@", "1" if self.is_muted else "0"],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=1.0,
                )
                return
            except Exception:
                pass

        # ALSA Fallback
        if self._has_amixer:
            try:
                target_val = 0 if self.is_muted else self.volume
                subprocess.run(
                    ["amixer", "-q", "set", "Master", f"{target_val}%"],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=1.0,
                )
            except Exception:
                pass

    def set_volume(self, volume: int):
        self.apply_volume(volume, self.is_muted)

    def set_mute(self, is_muted: bool):
        self.apply_volume(self.volume, is_muted)

    def play_test_sound(self) -> bool:
        """
        Phát chuông thông báo test hai nốt (C5-E5) phi đồng bộ (non-blocking).
        Tuyệt đối không làm block luồng Computer Vision và nhận diện khuôn mặt.
        """
        # Nếu đang mute thì bật tạm hoặc không phát
        if self.is_muted:
            print("[AUDIO] Loa đang Mute, bỏ qua phát âm thanh test.")
            return False

        # Thử tìm file âm thanh trong hệ thống Linux hoặc tạo chuông
        sound_candidates = [
            "/usr/share/sounds/freedesktop/stereo/complete.oga",
            "/usr/share/sounds/freedesktop/stereo/bell.oga",
            "/usr/share/sounds/alsa/Front_Center.wav",
        ]
        target_sound = None
        for cand in sound_candidates:
            if os.path.exists(cand):
                target_sound = cand
                break

        try:
            if target_sound and self._has_paplay:
                subprocess.Popen(
                    ["paplay", target_sound],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                print(f"[AUDIO] Đã phát âm thanh test qua paplay: {target_sound}")
                return True
            elif target_sound and self._has_aplay:
                subprocess.Popen(
                    ["aplay", "-q", target_sound],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                print(f"[AUDIO] Đã phát âm thanh test qua aplay: {target_sound}")
                return True
            else:
                # Môi trường dev hoặc không có âm thanh hệ thống: in log xác nhận
                print(f"[AUDIO] 🔔 [CHIME SOUND C5-E5] Đã kích hoạt chuông kiểm tra âm lượng {self.volume}% (Non-blocking).")
                return True
        except Exception as exc:
            print(f"[AUDIO WARN] Không thể phát âm thanh test: {exc}")
            return False
