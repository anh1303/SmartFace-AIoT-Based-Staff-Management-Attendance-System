"""One bounded HTTP attendance worker. MQTT remains telemetry/control only.

A timeout is ambiguous: never switch transports or allocate another event ID.
The coordinator retries this immutable body and waits for a correlated commit ACK.
"""
import base64
import json
import threading
import time
import uuid
from queue import Queue, Full, Empty
from urllib.parse import quote, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class DirectAttendanceClient:
    def __init__(self, base, device_id, token, timeout=8, opener=None):
        parsed = urlparse(base)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
            raise ValueError('Invalid backend origin')
        if not device_id or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in device_id):
            raise ValueError('Invalid device ID')
        if len(token) < 32 or not token.isascii() or any(c.isspace() for c in token):
            raise ValueError('Invalid device credential')
        if not 0 < timeout <= 30:
            raise ValueError('Invalid attendance timeout')
        self.url = base.rstrip('/') + '/api/devices/' + device_id + '/attendance'
        self.device_id, self.token, self.timeout = device_id, token, timeout
        self.opener = opener or build_opener(NoRedirect())
        self.queue, self.stop = Queue(maxsize=1), threading.Event()
        self.counter = 0
        self._unconfirmed_event = None
        self.thread = threading.Thread(target=self._run, name='attendance-http', daemon=True)
        self.thread.start()

    def _submit(self, payload, callback):
        if self.stop.is_set() or payload.get('device_id') != self.device_id:
            return -1
        try:
            # Serialize on the caller: retries cannot observe mutated arrays/dicts.
            body = json.dumps(payload, allow_nan=False).encode()
            self.queue.put_nowait((body, payload['event_id'], callback))
        except (Full, ValueError, TypeError, KeyError):
            return -1
        self.counter += 1
        return self.counter

    def send_scan_rpc(self, embedding, fas_score, mode, on_result=None, event_id=None,
                      captured_at=None, event_kind=None, recognition_id=None, expected_employee_id=None):
        import numpy as np
        try:
            vector = np.asarray(embedding, dtype='<f4').reshape(-1)
            if vector.size != 512 or not np.isfinite(vector).all() or np.linalg.norm(vector) <= 0 or not 0 <= float(fas_score) <= 1:
                return -1
            payload = dict(device_id=self.device_id, mode=mode, antispoof_score=float(fas_score),
                           embedding_b64=base64.b64encode(vector.tobytes()).decode(),
                           client_timestamp=captured_at, event_id=event_id or uuid.uuid4().hex,
                           event_kind=event_kind, recognition_id=recognition_id)
            if expected_employee_id is not None:
                payload['expected_employee_id'] = expected_employee_id
            return self._submit(payload, on_result)
        except (ValueError, TypeError):
            return -1

    def send_fingerprint_rpc(self, scan, on_result):
        return self._submit(scan, on_result)

    def _request(self, body, event):
        started = time.monotonic()
        request = Request(self.url, data=body, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + self.token})
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                raw = response.read(16385)
            if len(raw) > 16384:
                raise ValueError('Oversized response')
            data = json.loads(raw)
            if not isinstance(data, dict) or data.get('event_id') != event or not isinstance(data.get('success'), bool):
                raise ValueError('Uncorrelated response')
            return data
        except Exception as exc:
            reason = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else type(exc).__name__
            print(f"[HTTP attendance] event={event} response_unconfirmed={reason} elapsed_ms={(time.monotonic()-started)*1000:.0f}", flush=True)
            # Even HTTP failures may follow a committed write. Keep identity locked.
            return dict(event_id=event, success=False, matched=False, door_open=False,
                        uncertain=True, retryable=True, code=503,
                        message='Chưa xác nhận được lưu công; đang đối soát cùng sự kiện')

    def _recorded_result(self, event):
        url = self.url + '/status/' + quote(event, safe='')
        request = Request(url, headers={'Authorization': 'Bearer ' + self.token})
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                data = json.loads(response.read(2049))
            if data.get('event_id') == event and data.get('recorded') is True:
                valid = data.get('status') == 'VALID'
                return dict(event_id=event, success=valid, reconciled=True, door_open=False,
                            mode=data.get('mode'), status=data.get('status'))
        except (OSError, ValueError, AttributeError):
            pass
        return None

    def _run(self):
        while not self.stop.is_set():
            try:
                body, event, callback = self.queue.get(timeout=.1)
            except Empty:
                continue
            result = self._recorded_result(event) if self._unconfirmed_event == event else None
            if result is None:
                result = self._request(body, event)
            self._unconfirmed_event = event if (
                result.get('uncertain') or result.get('retryable') or result.get('code') == 503
            ) else None
            if callback and not self.stop.is_set():
                try:
                    callback(result)
                except Exception as exc:
                    print('[HTTP attendance] Callback failed: ' + type(exc).__name__)

    def close(self):
        self.stop.set()
        self.thread.join(timeout=self.timeout + 1)
