"""
Module Live Streaming video qua FFmpeg Stdin Pipe
Phát luồng H.264 qua RTSP tới MediaMTX Server.
"""

import subprocess
import cv2
import numpy as np


class RTSPStreamer:
    """Nén video H.264 thời gian thực qua FFmpeg pipe."""

    def __init__(self, rtsp_url: str, width: int, height: int, fps: int, enabled: bool = True):
        self.rtsp_url = rtsp_url
        self.width = width
        self.height = height
        self.fps = fps
        self.enabled = enabled
        self.process = None

        if self.enabled:
            self.start_ffmpeg()

    def start_ffmpeg(self):
        command = [
            "ffmpeg",
            "-y",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-pix_fmt", "bgr24",
            "-s", f"{self.width}x{self.height}",
            "-r", str(self.fps),
            "-i", "-",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-b:v", "800k",
            "-f", "rtsp",
            "-rtsp_transport", "tcp",
            self.rtsp_url
        ]
        try:
            self.process = subprocess.Popen(
                command, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL
            )
            print(f"[STREAM] Đang đẩy luồng video RTSP tới MediaMTX: {self.rtsp_url}")
        except FileNotFoundError:
            print("[STREAM WARN] Không tìm thấy lệnh 'ffmpeg'! Live stream tạm tắt.")
            self.process = None
        except Exception as e:
            print(f"[STREAM ERROR] Không thể khởi chạy FFmpeg: {e}")
            self.process = None

    def write_frame(self, frame: np.ndarray):
        if not self.enabled or self.process is None:
            return
        try:
            if frame.shape[1] != self.width or frame.shape[0] != self.height:
                frame = cv2.resize(frame, (self.width, self.height))
            self.process.stdin.write(frame.tobytes())
        except (BrokenPipeError, IOError):
            print("[STREAM] Mất kết nối MediaMTX RTSP, đang khởi động lại ống dẫn FFmpeg...")
            self.start_ffmpeg()

    def stop(self):
        if self.process:
            try:
                self.process.terminate()
            except Exception:
                pass
            self.process = None
