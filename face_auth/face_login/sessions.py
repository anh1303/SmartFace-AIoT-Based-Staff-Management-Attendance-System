"""Incremental (streaming) face-login session store.

Python owns only PAD/track continuity and embedding extraction. It never
chooses an identity, issues sessions or writes attendance. Node owns the
attempt lifecycle and identity confirmation.
"""
import threading
import time
import uuid

import config
from tracking.tracker import Track
from .pipeline import process_frame

__all__ = ['BOOT_ID', 'GAP_RESET_SECONDS', 'MAX_FRAMES', 'MAX_SESSIONS', 'LoginSession', 'SessionStore', 'process_frame']

BOOT_ID = uuid.uuid4().hex
MAX_SESSIONS = 20
MAX_FRAMES = 75
GAP_RESET_SECONDS = 2.0


def new_track():
    return Track(1, (0, 0, 0, 0), pad_smooth_window=config.PAD_SMOOTH_WINDOW,
                 pad_min_votes=config.PAD_MIN_VOTES, pad_spoof_min_ratio=config.PAD_SPOOF_MIN_RATIO)


class LoginSession:
    def __init__(self, attempt_id, epoch, ttl_seconds, now):
        self.id = attempt_id
        self.epoch = epoch
        self.deadline = now + ttl_seconds
        self.track = new_track()
        self.previous_bbox = None
        self.last_receipt_time = None
        self.next_seq = 1
        self.frames = 0
        self.busy = False
        self.closed = False
        self.last = None  # (seq, digest, result) for exact idempotent replay

    def reset(self):
        self.track = new_track()
        self.previous_bbox = None


class SessionStore:
    """Thread-safe bounded store. Sync FastAPI handlers run in a thread pool."""

    def __init__(self, clock=time.monotonic, maximum=MAX_SESSIONS, gap_seconds=GAP_RESET_SECONDS):
        self._clock = clock
        self._maximum = maximum
        self._gap_seconds = gap_seconds
        self._lock = threading.Lock()
        self._items = {}

    def _sweep_locked(self, now):
        for key in [k for k, s in self._items.items() if (s.closed or s.deadline <= now) and not s.busy]:
            del self._items[key]

    def sweep(self):
        now = self._clock()
        with self._lock:
            self._sweep_locked(now)

    def try_sweep(self) -> bool:
        """Non-blocking sweep for async periodic cleanup so the event loop never waits on threading.Lock."""
        if not self._lock.acquire(blocking=False):
            return False
        try:
            self._sweep_locked(self._clock())
            return True
        finally:
            self._lock.release()

    def create(self, attempt_id, epoch, ttl_seconds):
        self.sweep()
        with self._lock:
            if attempt_id in self._items:
                raise KeyError('exists')
            if len(self._items) >= self._maximum:
                raise OverflowError('capacity')
            self._items[attempt_id] = LoginSession(attempt_id, epoch, ttl_seconds, self._clock())

    def begin(self, attempt_id, epoch, seq, digest=''):
        """Reserve the session for one frame. Returns (session, cached_result|None, gap_expired)."""
        now = self._clock()
        with self._lock:
            session = self._items.get(attempt_id)
            if session is None or session.closed or session.epoch != epoch or session.deadline <= now:
                raise LookupError('missing')
            if session.last is not None and session.last[0] == seq:
                if session.last[1] != digest:
                    raise ValueError('conflict')
                return session, session.last[2], False
            if session.busy or seq != session.next_seq:
                raise ValueError('conflict')
            if session.frames >= MAX_FRAMES:
                raise LookupError('exhausted')
            gap_expired = (
                session.last_receipt_time is not None
                and (now - session.last_receipt_time) > self._gap_seconds
            )
            session.busy = True
            return session, None, gap_expired

    def abort(self, session):
        """Release without consuming a sequence (e.g. inference slot busy)."""
        with self._lock:
            session.busy = False

    def finish(self, session, seq, result, digest=''):
        now = self._clock()
        with self._lock:
            session.busy = False
            if session.closed or session.deadline <= now:
                if self._items.get(session.id) is session:
                    del self._items[session.id]
                return None  # fenced: late result after cancel/expiry is discarded and session is cleaned
            session.frames += 1
            session.next_seq = seq + 1
            session.last_receipt_time = now
            session.last = (seq, digest, result)
            return result

    def close(self, attempt_id):
        with self._lock:
            session = self._items.get(attempt_id)
            if session is None:
                return
            session.closed = True
            if not session.busy:
                del self._items[attempt_id]
            else:
                session.deadline = min(session.deadline, self._clock())

    def __len__(self):
        with self._lock:
            return len(self._items)
