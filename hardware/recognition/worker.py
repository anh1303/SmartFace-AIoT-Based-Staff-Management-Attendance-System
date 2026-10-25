"""Bounded ArcFace consumer; only the camera thread owns tracking/RPC state."""
from dataclasses import dataclass
from queue import Empty, Full, Queue
from threading import Event, Thread
import time

import numpy as np


@dataclass
class Request:
    key: tuple
    face: np.ndarray
    context: tuple
    cancelled: Event
    submitted: float


@dataclass
class Result:
    key: tuple
    context: tuple
    embedding: object
    latency: float
    error: str = ""


class RecognitionWorker:
    def __init__(self, embedder, queue_size=2):
        self.embedder = embedder
        self.requests = Queue(maxsize=queue_size)
        self.results = Queue(maxsize=queue_size + 1)
        self.pending = {}  # Owned exclusively by the camera thread.
        self.stop = Event()
        self.thread = Thread(target=self._run, name="face-recognition", daemon=True)
        self.thread.start()

    def submit(self, key, face, context):
        if self.stop.is_set() or key in self.pending or len(self.pending) >= self.requests.maxsize + 1:
            return False
        request = Request(key, face.copy(), context, Event(), time.monotonic())
        try:
            self.requests.put_nowait(request)
        except Full:
            return False
        self.pending[key] = request
        return True

    def retain(self, valid_keys):
        for key, request in self.pending.items():
            if key not in valid_keys:
                request.cancelled.set()

    def poll(self):
        completed = []
        while True:
            try:
                result = self.results.get_nowait()
            except Empty:
                break
            request = self.pending.pop(result.key, None)
            if request is not None and not request.cancelled.is_set():
                completed.append(result)
        return completed

    def _run(self):
        while not self.stop.is_set():
            try:
                request = self.requests.get(timeout=0.1)
            except Empty:
                continue
            embedding, error = None, ""
            if not request.cancelled.is_set():
                try:
                    embedding = np.asarray(self.embedder.extract(request.face), dtype=np.float32).reshape(-1)
                    if embedding.size != 512 or not np.isfinite(embedding).all() or np.linalg.norm(embedding) <= 0:
                        raise ValueError("Invalid recognition vector")
                except Exception as exc:
                    embedding, error = None, type(exc).__name__
            result = Result(request.key, request.context, embedding, time.monotonic() - request.submitted, error)
            while not self.stop.is_set():
                try:
                    self.results.put(result, timeout=0.1)
                    break
                except Full:
                    continue

    def close(self):
        self.stop.set()
        for request in self.pending.values():
            request.cancelled.set()
        self.thread.join(timeout=2)
        return not self.thread.is_alive()


class IdentityCache:
    """Confirmed scan-reference cache for display only; never authorizes attendance.

    Unlike face_auth's DB centroid cache, MQTT replies contain no centroid. Every
    actual attendance request must still go through backend verification.
    """
    def __init__(self, ttl=30.0, threshold=0.65):
        self.ttl, self.threshold = ttl, threshold
        self.entries = {}

    @staticmethod
    def normalise(vector):
        vector = np.asarray(vector, dtype=np.float32).reshape(-1)
        norm = np.linalg.norm(vector)
        if vector.size != 512 or not np.isfinite(vector).all() or not np.isfinite(norm) or norm <= 0:
            raise ValueError('Invalid recognition vector')
        return vector / norm

    def confirm(self, key, embedding, identity):
        self.entries.pop(key, None)
        if (self.ttl <= 0 or identity[0] is None or not np.isfinite(identity[2])
                or identity[2] < self.threshold):
            return
        if len(self.entries) >= 128:
            self.entries.pop(next(iter(self.entries)))
        self.entries[key] = (identity, self.normalise(embedding), time.monotonic() + self.ttl)

    def lookup(self, key, embedding):
        cached = self.entries.get(key)
        if cached is None:
            return None
        identity, reference, expires = cached
        if time.monotonic() >= expires:
            self.entries.pop(key, None)
            return None
        similarity = float(np.clip(np.dot(self.normalise(embedding), reference), -1, 1))
        if similarity < self.threshold:
            self.entries.pop(key, None)
            return None
        return (*identity[:2], similarity)

    def retain(self, keys):
        now = time.monotonic()
        self.entries = {k: value for k, value in self.entries.items() if k in keys and now < value[2]}
