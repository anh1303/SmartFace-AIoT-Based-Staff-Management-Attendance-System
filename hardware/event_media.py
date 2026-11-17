"""One best-effort photo delivery per confirmed gate or attendance event."""
import base64
import json
import threading
import time
from collections import OrderedDict
from queue import Full, Queue
from urllib.parse import quote
from urllib.request import Request, urlopen

import cv2


class EventMedia:
    def __init__(self, base, device, token):
        self.url = f"{base.rstrip('/')}/api/devices/{quote(device, safe='')}/events" if base else ""
        self.token = token
        self.lock = threading.Lock()
        self.latest = None
        self.pending = OrderedDict()
        self.jobs = Queue(maxsize=12)
        if self.url and self.token:
            threading.Thread(target=self._run, daemon=True).start()

    def update_frame(self, frame):
        # The main loop must replace, rather than draw on, this snapshot.
        self.latest = (time.monotonic(), frame.copy()) if frame is not None else None

    def current_frame(self):
        frame = self.latest
        return frame[1] if frame and time.monotonic() - frame[0] <= 1.5 else None

    def pin(self, event, frame=None, *, use_latest=True):
        with self.lock:
            if event and event not in self.pending:
                candidate = self.current_frame() if frame is None and use_latest else frame
                self.pending[event] = candidate
                if len(self.pending) > 8:
                    self.pending.popitem(last=False)

    def attendance_result(self, event, accepted):
        with self.lock:
            if event not in self.pending:
                return
            frame = self.pending.pop(event)
        if accepted:
            self.enqueue(event, "attendance", frame)

    def enqueue(self, event, kind, frame=None, status=None):
        if not self.url or not self.token:
            return
        try:
            self.jobs.put_nowait((event, kind, frame, status))
        except Full:
            print("[EVENT PHOTO] Queue full; event continues without photo.")

    def _post(self, path, data):
        req = Request(self.url + path, data=json.dumps(data).encode(), headers={
            "Authorization": "Bearer " + self.token,
            "Content-Type": "application/json",
        })
        with urlopen(req, timeout=15) as response:
            response.read(4096)

    def _run(self):
        while True:
            event, kind, frame, status = self.jobs.get()
            try:
                if status:
                    self._post(f"/gate/{event}/status", {"status": status})
                    continue
                encoded = None
                if frame is not None:
                    ratio = min(1, 1280 / max(frame.shape[:2]))
                    if ratio < 1:
                        frame = cv2.resize(frame, None, fx=ratio, fy=ratio, interpolation=cv2.INTER_AREA)
                    ok, result = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    if ok and result.nbytes <= 1024 * 1024:
                        encoded = base64.b64encode(result).decode("ascii")
                self._post(f"/capture/{event}", {"kind": kind, "jpeg": encoded})
            except Exception as exc:
                print(f"[EVENT PHOTO] event={event} request failed: {type(exc).__name__}")
