"""One in-flight attendance across face/fingerprint; ambiguity retains its event."""
import threading
import time


class AttendanceCoordinator:
    def __init__(self):
        self._lock = threading.RLock()
        self.owner = None
        self.token = None
        self.retry = None
        self.retry_at = 0

    def begin(self, owner, token):
        with self._lock:
            if self.owner is not None:
                return False
            self.owner, self.token = owner, token
            return True

    def finish(self, token):
        with self._lock:
            if token == self.token:
                self.owner = self.token = self.retry = None

    def response(self, token, result, resend):
        with self._lock:
            if token != self.token:
                return
            if result.get('uncertain') or result.get('retryable') or result.get('code') == 503:
                self.retry, self.retry_at = resend, time.monotonic() + 5
            else:
                self.owner = self.token = self.retry = None

    def tick(self):
        with self._lock:
            if self.retry is None or time.monotonic() < self.retry_at:
                return
            retry = self.retry
            self.retry = None
        if retry() < 0:
            with self._lock:
                self.retry, self.retry_at = retry, time.monotonic() + 5

    @property
    def busy(self):
        with self._lock:
            return self.owner is not None
