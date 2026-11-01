"""
SmartFace AIoT — Edge Audio Manager
Điều khiển âm lượng loa/tai nghe Bluetooth và phát chuông check-in/test:
- Tự động phát hiện và định tuyến âm thanh tới Bluetooth Sink (PipeWire / WirePlumber / PulseAudio / BlueALSA)
- Tự động sinh file chuông 2 nốt C5-E5 (Ding-Dong) chuẩn PCM WAV 44.1kHz
- Phát âm thanh phi đồng bộ (non-blocking) qua pw-play / ffplay / paplay / aplay
"""

import hashlib
import os
import re
import shutil
import subprocess
import threading
import urllib.parse
import urllib.request
from typing import Optional


class AudioManager:
    def __init__(self, initial_volume: int = 75, initial_muted: bool = False):
        self.volume = max(0, min(100, int(initial_volume)))
        self.is_muted = bool(initial_muted)
        self._lock = threading.Lock()
        self._has_pactl = shutil.which("pactl") is not None
        self._has_wpctl = shutil.which("wpctl") is not None
        self._has_pw_play = shutil.which("pw-play") is not None
        self._has_paplay = shutil.which("paplay") is not None
        self._has_ffplay = shutil.which("ffplay") is not None
        self._has_aplay = shutil.which("aplay") is not None
        self._has_amixer = shutil.which("amixer") is not None

        # Khởi tạo mức âm lượng ban đầu
        self.apply_volume(self.volume, self.is_muted)

    def route_to_bluetooth(self, target_mac: Optional[str] = None, target_name: Optional[str] = None) -> Optional[str]:
        """
        Tự động tìm sink Bluetooth và chuyển thành Default Sink.
        Tuyệt đối không match từ 'audio' hay các card HDMI/Analog trên bo mạch.
        """
        # 1. Thử qua wpctl (PipeWire / WirePlumber trên Debian 12 Bookworm)
        if self._has_wpctl:
            try:
                res = subprocess.run(["wpctl", "status"], capture_output=True, text=True, timeout=1.5)
                if res.returncode == 0:
                    in_sinks = False
                    for line in res.stdout.splitlines():
                        if "Sinks:" in line:
                            in_sinks = True
                            continue
                        if in_sinks:
                            if any(header in line for header in ["Sink endpoints:", "Sources:", "Streams:"]):
                                break
                            m = re.search(r"\b(\d+)\.\s+(.+?)(?:\[|$)", line)
                            if m:
                                node_id = m.group(1)
                                node_name = m.group(2).strip().lower()

                                # Chỉ match đúng thiết bị Bluetooth:
                                is_bt = False
                                if target_name and target_name.strip().lower() in node_name:
                                    is_bt = True
                                elif target_mac and target_mac.lower().replace(":", "") in node_name:
                                    is_bt = True
                                elif any(k in node_name for k in ["bluez", "havit", "hoco", "tw9", "tw958", "airpod", "tws"]):
                                    is_bt = True

                                if is_bt:
                                    subprocess.run(["wpctl", "set-default", node_id], timeout=1.0)
                                    vol_float = f"{self.volume / 100.0:.2f}"
                                    subprocess.run(["wpctl", "set-volume", node_id, vol_float], timeout=1.0)
                                    print(f"[AUDIO] Đã kích hoạt Bluetooth Sink #{node_id} ({m.group(2).strip()})")
                                    return node_id
            except Exception:
                pass

        # 2. Thử qua pactl (PulseAudio)
        if self._has_pactl:
            try:
                res = subprocess.run(["pactl", "list", "short", "sinks"], capture_output=True, text=True, timeout=1.5)
                if res.returncode == 0:
                    for line in res.stdout.splitlines():
                        parts = line.split()
                        if len(parts) >= 2:
                            sink_name = parts[1]
                            is_bt = False
                            if "bluez" in sink_name.lower():
                                is_bt = True
                            elif target_mac and target_mac.lower().replace(":", "_") in sink_name.lower():
                                is_bt = True
                            elif target_name and target_name.lower() in sink_name.lower():
                                is_bt = True
                            if is_bt:
                                subprocess.run(["pactl", "set-default-sink", sink_name], timeout=1.0)
                                subprocess.run(["pactl", "set-sink-volume", sink_name, f"{self.volume}%"], timeout=1.0)
                                subprocess.run(["pactl", "set-sink-mute", sink_name, "0"], timeout=1.0)
                                print(f"[AUDIO] Đã kích hoạt Bluetooth Sink (PulseAudio): {sink_name}")
                                return sink_name
            except Exception:
                pass

        return None

    def apply_volume(self, volume: int, is_muted: bool = False):
        """
        Cập nhật âm lượng vật lý trên hệ thống Linux.
        """
        with self._lock:
            self.volume = max(0, min(100, int(volume)))
            self.is_muted = bool(is_muted)

        # PulseAudio / PipeWire qua pactl
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
            except Exception:
                pass

        # PipeWire qua wpctl
        if self._has_wpctl:
            try:
                vol_float = f"{0.0 if self.is_muted else (self.volume / 100.0):.2f}"
                subprocess.run(
                    ["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", vol_float],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=1.0,
                )
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

    def ensure_chime_wav(self) -> str:
        """
        Tạo file chuông 2 nốt C5-E5 (Ding-Dong) chuẩn PCM WAV 44.1kHz nếu chưa tồn tại.
        """
        path = "/tmp/smartface_chime.wav"
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            return path
        try:
            import wave, struct, math
            sample_rate = 44100
            duration = 0.55
            num_samples = int(sample_rate * duration)
            with wave.open(path, 'wb') as f:
                f.setnchannels(1)
                f.setsampwidth(2)
                f.setframerate(sample_rate)
                frames = bytearray()
                for i in range(num_samples):
                    t = i / sample_rate
                    if t < 0.22:
                        freq = 523.25  # C5
                        env = math.exp(-t * 6.5)
                    else:
                        freq = 659.25  # E5
                        t2 = t - 0.22
                        env = math.exp(-t2 * 5.0)
                    sample = int(32767.0 * 0.75 * env * math.sin(2.0 * math.pi * freq * t))
                    sample = max(-32768, min(32767, sample))
                    frames.extend(struct.pack('<h', sample))
                f.writeframes(frames)
            return path
        except Exception:
            return "/usr/share/sounds/alsa/Front_Center.wav"

    def generate_tts_file(self, text: str) -> Optional[str]:
        """
        Sinh file âm thanh tiếng Việt từ chuỗi văn bản (TTS) và lưu cache tại /tmp/smartface_tts/.
        Ưu tiên tải từ Google Translate TTS (giọng chuẩn tiếng Việt rõ ràng, tự nhiên).
        Tự động chuyển đổi MP3 sang WAV 16-bit PCM nếu có ffmpeg để đảm bảo tương thích tuyệt đối.
        """
        if not text or not text.strip():
            return None

        clean_text = text.strip()
        cache_dir = "/tmp/smartface_tts"
        try:
            os.makedirs(cache_dir, exist_ok=True)
        except Exception:
            pass

        h = hashlib.md5(clean_text.encode("utf-8")).hexdigest()[:12]
        wav_path = os.path.join(cache_dir, f"{h}.wav")
        mp3_path = os.path.join(cache_dir, f"{h}.mp3")

        # 1. Trả về ngay nếu đã có trong cache
        if os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
            return wav_path
        if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 500:
            if shutil.which("ffmpeg"):
                try:
                    subprocess.run(["ffmpeg", "-y", "-i", mp3_path, wav_path], capture_output=True, timeout=3.0)
                    if os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
                        return wav_path
                except Exception:
                    pass
            return mp3_path

        # 2. Tải giọng đọc tiếng Việt qua Google TTS
        try:
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q={urllib.parse.quote(clean_text)}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = resp.read()
            if data and len(data) > 500:
                with open(mp3_path, "wb") as f:
                    f.write(data)
                if shutil.which("ffmpeg"):
                    try:
                        subprocess.run(["ffmpeg", "-y", "-i", mp3_path, wav_path], capture_output=True, timeout=3.0)
                        if os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
                            return wav_path
                    except Exception:
                        pass
                return mp3_path
        except Exception as e:
            print(f"[AUDIO TTS WARN] Không thể tải TTS online ({e}), thử fallback offline...")

        # 3. Fallback offline: espeak-ng / espeak / spd-say nếu có
        if shutil.which("espeak-ng"):
            try:
                subprocess.run(["espeak-ng", "-v", "vi", "-w", wav_path, clean_text], capture_output=True, timeout=3.0)
                if os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
                    return wav_path
            except Exception:
                pass

        return None

    def play_sound_file(
        self,
        sound_file: str,
        target_mac: Optional[str] = None,
        target_name: Optional[str] = None,
        sound_label: str = "âm thanh",
    ) -> bool:
        """
        Phát một file âm thanh bất kỳ phi đồng bộ (non-blocking) qua tai nghe/loa Bluetooth:
        Hỗ trợ định dạng WAV / MP3 qua các driver PipeWire, PulseAudio, BlueALSA, FFmpeg, ALSA.
        """
        if self.is_muted:
            print(f"[AUDIO] Loa đang Mute, bỏ qua phát {sound_label}.")
            return False

        if not sound_file or not os.path.exists(sound_file):
            print(f"[AUDIO WARN] File {sound_file} không tồn tại.")
            return False

        # 1. Kích hoạt định tuyến Bluetooth Sink & âm lượng
        self.apply_volume(self.volume, self.is_muted)
        bt_sink = self.route_to_bluetooth(target_mac, target_name)

        def _play_worker():
            # Thử 1: PipeWire pw-play (Chuẩn Raspberry Pi OS 12 Bookworm)
            if self._has_pw_play:
                try:
                    cmd = ["pw-play"]
                    if bt_sink and str(bt_sink).isdigit():
                        cmd.extend(["--target", str(bt_sink)])
                    cmd.append(sound_file)
                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=5.0)
                    if res.returncode == 0:
                        print(f"[AUDIO] ✅ Đã phát {sound_label} qua PipeWire (pw-play) tới {bt_sink or 'default'}")
                        return
                    else:
                        print(f"[AUDIO WARN] pw-play trả về mã {res.returncode}: {res.stderr.strip() or res.stdout.strip()}")
                except Exception as e:
                    print(f"[AUDIO WARN] pw-play lỗi: {e}")

            # Thử 2: PulseAudio paplay
            if self._has_paplay:
                try:
                    cmd = ["paplay"]
                    if bt_sink and not str(bt_sink).isdigit():
                        cmd.extend(["-d", str(bt_sink)])
                    cmd.append(sound_file)
                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=5.0)
                    if res.returncode == 0:
                        print(f"[AUDIO] ✅ Đã phát {sound_label} qua PulseAudio (paplay) tới {bt_sink or 'default'}")
                        return
                    else:
                        print(f"[AUDIO WARN] paplay trả về mã {res.returncode}: {res.stderr.strip()}")
                except Exception as e:
                    print(f"[AUDIO WARN] paplay lỗi: {e}")

            # Thử 3: BlueALSA trực tiếp tới địa chỉ MAC Bluetooth nếu có
            if target_mac and self._has_aplay:
                try:
                    bluealsa_dev = f"bluealsa:DEV={target_mac.upper()},PROFILE=a2dp"
                    res = subprocess.run(["aplay", "-q", "-D", bluealsa_dev, sound_file], capture_output=True, text=True, timeout=5.0)
                    if res.returncode == 0:
                        print(f"[AUDIO] ✅ Đã phát {sound_label} qua BlueALSA tới {bluealsa_dev}")
                        return
                    else:
                        print(f"[AUDIO WARN] BlueALSA ({bluealsa_dev}) trả về mã {res.returncode}: {res.stderr.strip()}")
                except Exception as e:
                    print(f"[AUDIO WARN] BlueALSA lỗi: {e}")

            # Thử 4: FFmpeg ffplay
            if self._has_ffplay:
                try:
                    res = subprocess.run(["ffplay", "-nodisp", "-autoexit", "-loglevel", "error", sound_file], capture_output=True, text=True, timeout=5.0)
                    if res.returncode == 0:
                        print(f"[AUDIO] ✅ Đã phát {sound_label} qua FFmpeg (ffplay)")
                        return
                    else:
                        print(f"[AUDIO WARN] ffplay trả về mã {res.returncode}: {res.stderr.strip()}")
                except Exception as e:
                    print(f"[AUDIO WARN] ffplay lỗi: {e}")

            # Thử 5: ALSA default fallback
            if self._has_aplay:
                try:
                    res = subprocess.run(["aplay", "-q", sound_file], capture_output=True, text=True, timeout=5.0)
                    if res.returncode == 0:
                        print(f"[AUDIO] ✅ Đã phát {sound_label} qua ALSA default: {sound_file}")
                        return
                    else:
                        print(f"[AUDIO WARN] aplay default trả về mã {res.returncode}: {res.stderr.strip()}")
                except Exception as e:
                    print(f"[AUDIO WARN] aplay default lỗi: {e}")

        threading.Thread(target=_play_worker, daemon=True).start()
        return True

    def play_test_sound(self, target_mac: Optional[str] = None, target_name: Optional[str] = None) -> bool:
        """
        Phát chuông thông báo test hai nốt (C5-E5) phi đồng bộ (non-blocking) qua tai nghe/loa Bluetooth.
        """
        chime_file = self.ensure_chime_wav()
        return self.play_sound_file(chime_file, target_mac, target_name, sound_label="chuông test (Ding-Dong)")

    def speak_attendance(
        self,
        emp_name: str,
        mode: str = "CHECK_IN",
        target_mac: Optional[str] = None,
        target_name: Optional[str] = None,
    ) -> bool:
        """
        Phát giọng đọc thông báo điểm danh qua tai nghe/loa Bluetooth:
        Ví dụ: '{emp_name} check in thành công' hoặc '{emp_name} check out thành công'.
        Nếu chưa tải được TTS, tự động fallback về chuông báo chuẩn.
        """
        name = (emp_name or "").strip()
        is_generic = not name or name.lower() in ("nhân viên", "nhan vien", "unknown", "none")

        mode_upper = (mode or "").strip().upper()
        if mode_upper == "CHECK_IN":
            action_phrase = "check in"
        elif mode_upper == "CHECK_OUT":
            action_phrase = "check out"
        else:
            action_phrase = "điểm danh"

        if is_generic:
            speech_text = f"{action_phrase.capitalize()} thành công"
        else:
            speech_text = f"{name} {action_phrase} thành công"

        print(f"[AUDIO] 📢 Chuẩn bị phát thông báo điểm danh: '{speech_text}'")

        def _speak_worker():
            # Sinh file âm thanh giọng nói tiếng Việt (chạy ngầm, không block camera)
            audio_file = self.generate_tts_file(speech_text)
            if audio_file and os.path.exists(audio_file):
                self.play_sound_file(
                    audio_file,
                    target_mac=target_mac,
                    target_name=target_name,
                    sound_label=f"thông báo '{speech_text}'",
                )
            else:
                # Fallback về chuông Ding-Dong nếu không tạo được file giọng nói
                print("[AUDIO] Fallback về chuông thông báo Ding-Dong...")
                self.play_test_sound(target_mac=target_mac, target_name=target_name)

        threading.Thread(target=_speak_worker, daemon=True).start()
        return True
