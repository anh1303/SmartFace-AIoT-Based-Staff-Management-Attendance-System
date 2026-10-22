"""
Module Live Streaming video qua FFmpeg Stdin Pipe
Phát luồng H.264 qua RTSP tới MediaMTX Server.
"""

import subprocess
import os
import select
import threading
import queue
import time
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

        self._frames = queue.Queue(maxsize=1)
        self._stop = threading.Event()
        self._worker = None
        if self.enabled:
            self._worker = threading.Thread(target=self._run, daemon=True)
            self._worker.start()

    def start_ffmpeg(self):
        self._close_process()
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
            os.set_blocking(self.process.stdin.fileno(), False)
            print(f"[STREAM] Đang đẩy luồng video RTSP tới MediaMTX: {self.rtsp_url}")
        except FileNotFoundError:
            print("[STREAM WARN] Không tìm thấy lệnh 'ffmpeg'! Live stream tạm tắt.")
            self.process = None
        except Exception as e:
            print(f"[STREAM ERROR] Không thể khởi chạy FFmpeg: {e}")
            self.process = None

    def write_frame(self, frame: np.ndarray):
        if not self.enabled or self._stop.is_set():
            return
        if frame.shape[1] != self.width or frame.shape[0] != self.height:
            frame = cv2.resize(frame, (self.width, self.height))
        snapshot = frame.copy()
        try:
            self._frames.put_nowait(snapshot)
        except queue.Full:
            try: self._frames.get_nowait()
            except queue.Empty: pass
            try: self._frames.put_nowait(snapshot)
            except queue.Full: pass

    def _run(self):
        while not self._stop.is_set():
            if self.process is None or self.process.poll() is not None:
                self.start_ffmpeg()
                if self.process is None:
                    self._stop.wait(3)
                    continue
            try:
                frame = self._frames.get(timeout=0.2)
                data = memoryview(frame.tobytes())
                deadline = time.monotonic() + 2
                fd = self.process.stdin.fileno()
                while data and not self._stop.is_set():
                    if time.monotonic() > deadline:
                        raise TimeoutError('FFmpeg stdin bị nghẽn')
                    if select.select([], [fd], [], 0.1)[1]:
                        try: data = data[os.write(fd, data):]
                        except BlockingIOError: pass
            except queue.Empty:
                continue
            except (OSError, ValueError, TimeoutError) as exc:
                print(f'[STREAM] {exc}; khởi động lại sau 3 giây.')
                self._close_process()
                self._stop.wait(3)
        self._close_process()

    def _close_process(self):
        process, self.process = self.process, None
        if process:
            try:
                process.terminate()
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=1)
            finally:
                if process.stdin: process.stdin.close()

    def stop(self):
        self._stop.set()
        if self._worker:
            self._worker.join(timeout=4)
