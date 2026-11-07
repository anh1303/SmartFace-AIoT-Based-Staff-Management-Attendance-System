"""Single UART owner. Authenticated manifests, RAM enrollment, verified Flash sync.

Disabled by default until explicitly configured. No template data is logged.
"""
import base64
import hashlib
import json
import os
import threading
import time
import urllib.request
import uuid
from .fingerprint_sensor import FingerprintSensor


class EnrollmentError(RuntimeError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class FingerprintWorker:
    def __init__(self, device_id, coordinator, send_attendance, current_mode, on_result):
        self.enabled = os.getenv('FINGERPRINT_ENABLED', 'false').lower() == 'true'
        self.device_id, self.coordinator = device_id, coordinator
        self.send_attendance, self.current_mode, self.on_result = send_attendance, current_mode, on_result
        self.base = os.getenv('BACKEND_BASE_URL', '').rstrip('/') + f'/api/devices/{device_id}/fingerprint'
        self.key = os.getenv('EDGE_RECOGNITION_TOKEN', '')
        self.sensor = FingerprintSensor(os.getenv('FINGERPRINT_PORT', '/dev/serial0'),
                                        int(os.getenv('FINGERPRINT_BAUD', '57600')), timeout=3)
        self.stop_event, self.wake_event = threading.Event(), threading.Event()
        self.thread = None
        self.touch = None
        self.wak_verified = False
        self.roundtrip_verified = False
        self.error = 'WAK_UNVERIFIED'
        self.manifest = {'session': None, 'bindings': [], 'device': {}}
        self._last_manifest = 0
        self._verified = set()
        self._needs_lift = True
        self._last_touch = False
        self._touched = False
        self._last_session = None

    def start(self):
        if not self.enabled:
            return
        if not self.key or not self.base.startswith(('https://', 'http://')):
            print('[FINGERPRINT] Missing backend URL/device credentials; disabled')
            return
        self.thread = threading.Thread(target=self._run, name='Fingerprint-UART', daemon=True)
        self.thread.start()

    @property
    def maintenance(self):
        return bool(self.manifest.get("session") or any(b["state"] != "SYNCED" or b["id"] not in self._verified for b in self.manifest["bindings"]))

    def wake(self):
        self.wake_event.set()
        return {'success': True, 'queued': True}

    def _http(self, path, data):
        request = urllib.request.Request(self.base + path, data=json.dumps(data).encode(),
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {self.key}'})
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.load(response)

    def _refresh(self, force=False):
        has_active_session = bool(self.manifest and self.manifest.get('session'))
        interval = 2 if (force or has_active_session) else 15
        if not force and time.monotonic() - self._last_manifest < interval:
            return
        health = {'capacity': self.sensor.capacity, 'ready': self.sensor.is_connected,
                  'roundtrip_verified': self.roundtrip_verified, 'wak_verified': self.wak_verified,
                  'error': self.error}
        self.manifest = self._http('/manifest', health)
        self._last_manifest = time.monotonic()

    def _progress(self, session, status, **data):
        self._http(f"/sessions/{session['id']}/progress", dict(status=status, **data))
        session['status'] = status

    def _present(self):
        return bool(self.touch and self.touch.is_active)

    def _check_cancel(self, session, deadline):
        if self.stop_event.is_set() or time.monotonic() >= deadline:
            raise TimeoutError('Enrollment timed out')
        self._refresh()
        current = self.manifest.get('session')
        if not current or current['id'] != session['id'] or current['status'] in ('CANCELLED', 'EXPIRED', 'FAILED'):
            raise RuntimeError('Enrollment cancelled')

    def _ack(self, code):
        if code >= 0xf9:
            raise ConnectionError('UART lost synchronization')
        return code

    def _capture(self, buffer, session, overall):
        end = min(time.monotonic() + 60, overall)
        while True:
            self._check_cancel(session, end)
            if self.touch and not self._present() and not self.manifest['device'].get('polling_fallback'):
                self.stop_event.wait(.1)
                continue
            code = self._ack(self.sensor.capture_image())
            if code == 0:
                result = self._ack(self.sensor.image_to_charbuffer(buffer))
                if result == 0:
                    return
                if result not in (6, 7):
                    raise RuntimeError('Unable to extract fingerprint features')
            self.stop_event.wait(.2)

    def _lift(self, session, overall):
        end = min(time.monotonic() + 60, overall)
        stable = None
        while True:
            self._check_cancel(session, end)
            absent = not self._present() if self.touch else self._ack(self.sensor.capture_image()) == 2
            if absent:
                stable = stable or time.monotonic()
                if time.monotonic() - stable >= .2:
                    return
            else:
                stable = None
            self.stop_event.wait(.1)

    def _enroll(self, session):
        overall = time.monotonic() + 180
        if session['status'] != 'QUEUED':
            self._progress(session, 'FAILED')  # Cannot reuse RAM after restart.
            return
        self._progress(session, 'WAITING_TOUCH_1')
        self._capture(1, session, overall)
        matched, slot, _ = self.sensor.search_database(page_count=self.sensor.capacity)
        if getattr(self.sensor, '_needs_reconnect', False):
            raise ConnectionError('Duplicate check transport failed')
        if getattr(self.sensor, 'last_search_ack', 0) not in (0, 9):
            raise EnrollmentError('TRANSPORT_ERROR')
        duplicate = next((b for b in self.manifest['bindings'] if b['slot'] == slot and b['state'] != 'REVOKED'), None)
        if matched and (not duplicate or duplicate['employee_id'] != session['employee_id']):
            raise EnrollmentError('DUPLICATE_FINGER')
        self._progress(session, 'LIFT_FINGER')
        self._lift(session, overall)
        self._progress(session, 'WAITING_TOUCH_2')
        self._capture(2, session, overall)
        code, score = self.sensor.match_buffers()
        if self._ack(code) != 0 or score is None:
            raise EnrollmentError('NO_MATCH')
        if self._ack(self.sensor.create_model()) != 0:
            raise RuntimeError('Unable to create model')
        template = self.sensor.upload_template(1)
        if not template or len(template) not in (512, 768):
            raise RuntimeError('Invalid template upload')
        # Prove exact template portability through RAM before promising DB backup.
        if not self.sensor.download_template(2, template) or self.sensor.upload_template(2) != template:
            raise EnrollmentError('ROUNDTRIP_FAILED')
        code, _ = self.sensor.match_buffers()
        if self._ack(code) != 0:
            raise RuntimeError('Restored model does not match original')
        self.roundtrip_verified, self.error = True, None
        self._refresh(force=True)
        self._progress(session, 'VERIFIED', template_b64=base64.b64encode(template).decode(),
                       match_score=score, roundtrip_verified=True,
                       duplicate_binding_id=duplicate['id'] if duplicate else None)
        print('[FINGERPRINT] Enrollment verified in RAM; awaiting Web confirmation')

    def _sync(self):
        for binding in self.manifest['bindings']:
            if binding['state'] == 'REVOKED':
                if not self.sensor.delete_template(binding['slot']):
                    raise RuntimeError('Cannot erase revoked slot')
                self._http(f"/bindings/{binding['id']}/ack", {'deleted': True})
                self._verified.discard(binding['id'])
                continue
            if binding['id'] in self._verified:
                continue
            template = base64.b64decode(binding['template_b64'], validate=True)
            if len(template) not in (512, 768) or hashlib.sha256(template).hexdigest() != binding['checksum']:
                raise RuntimeError('Invalid manifest template')
            try:
                existing = self.sensor.load_template(binding['slot'])
                stored = self.sensor.upload_template(1) if existing == 0 else None
                if existing == 0 and stored != template and binding['state'] == 'PENDING':
                    raise RuntimeError('Allocated slot contains an unmanaged template; refusing overwrite')
                if existing != 0 or stored != template:
                    if not self.sensor.download_template(1, template) or not self.sensor.store_template(binding['slot']):
                        raise RuntimeError('Cannot write template')
                    if self.sensor.load_template(binding['slot']) != 0 or self.sensor.upload_template(1) != template:
                        raise RuntimeError('Flash readback mismatch')
                self._http(f"/bindings/{binding['id']}/ack", {'checksum': binding['checksum'], 'revision': binding['revision']})
                self._verified.add(binding['id'])
                self.roundtrip_verified = True
            except Exception:
                self._http(f"/bindings/{binding['id']}/ack", {'error': 'SYNC_FAILED'})
                raise

    def _scan(self, token):
        if self._ack(self.sensor.capture_image()) != 0 or self._ack(self.sensor.image_to_charbuffer(1)) != 0:
            self.coordinator.finish(token)
            return
        matched, slot, score = self.sensor.search_database(page_count=self.sensor.capacity)
        self._ack(0xfe if getattr(self.sensor, '_needs_reconnect', False) else 0)
        binding = next((b for b in self.manifest['bindings'] if b['slot'] == slot and b['state'] == 'SYNCED' and b['id'] in self._verified), None)
        if not matched or not binding:
            self.coordinator.finish(token)
            print('[FINGERPRINT] No active fingerprint match')
            return
        scan = {'event_kind': 'FINGERPRINT_SCAN', 'device_id': self.device_id, 'event_id': token,
                'client_timestamp': int(time.time()*1000), 'mode': self.current_mode(),
                'binding_id': binding['id'], 'slot': slot, 'revision': binding['revision'], 'match_score': score}
        def callback(response):
            self.coordinator.response(token, response, resend)
            self.on_result(response)
        def resend():
            return self.send_attendance(scan, callback)
        if resend() < 0:
            # Network failures never release an ambiguous request to another identity.
            self.coordinator.response(token, {'uncertain': True}, resend)

    def _run(self):
        try:
            from gpiozero import DigitalInputDevice
            self.touch = DigitalInputDevice(int(os.getenv('FINGERPRINT_TOUCH_PIN', '17')), pull_up=False, bounce_time=.1)
        except Exception:
            self.error = 'WAK_UNVERIFIED'
        while not self.stop_event.is_set():
            token = None
            try:
                if not self.sensor.is_connected or getattr(self.sensor, '_needs_reconnect', False):
                    self._verified.clear()
                    if not self.sensor.connect():
                        self.error = 'UART_UNAVAILABLE'
                        self._refresh(force=True)
                        self.stop_event.wait(3)
                        continue
                present = self._present()
                if present:
                    self._touched = True
                    self.wak_verified = True
                elif self._touched:
                    self.wak_verified = True
                    self._needs_lift = False
                self.error = None if self.wak_verified or self.manifest['device'].get('polling_fallback') else 'WAK_UNVERIFIED'
                if self.wake_event.is_set():
                    self.wake_event.clear()
                    self._refresh(force=True)
                else:
                    self._refresh()
                session = self.manifest.get('session')
                needs_sync = any(b['state'] == 'REVOKED' or b['id'] not in self._verified for b in self.manifest['bindings'])
                if session or needs_sync:
                    self._needs_lift = True
                    self._last_touch = present
                    token = 'maintenance-' + (session['id'] if session else self.device_id)
                    if self.coordinator.begin('maintenance', token):
                        if needs_sync:
                            self._sync()
                            self._refresh(force=True)
                        if session and session['status'] in ('QUEUED','WAITING_TOUCH_1','LIFT_FINGER','WAITING_TOUCH_2'):
                            self._enroll(session)
                        # Hold maintenance ownership between heartbeats until server
                        # has completed/cancelled the session, without blocking HTTP.
                        self.coordinator.finish(token)
                    self.stop_event.wait(.1)
                    continue
                polling = self.manifest['device'].get('polling_fallback')
                if polling:
                    present = self._ack(self.sensor.capture_image()) == 0
                trigger = present and not self._last_touch and not self._needs_lift
                self._last_touch = present
                if trigger:
                    self._needs_lift = True
                    token = uuid.uuid4().hex
                    if self.current_mode() in ('AUTO','CHECK_IN','CHECK_OUT') and self.manifest['device'].get('attendance_enabled') and self.coordinator.begin('fingerprint', token):
                        self._scan(token)
                if not present:
                    self._needs_lift = False
                self.stop_event.wait(.1 if self.touch else .5)
            except Exception as exc:
                if token:
                    self.coordinator.finish(token)
                self.error = 'SENSOR_ERROR'
                # Only an allowlisted class name is logged, never request contents.
                print(f'[FINGERPRINT] Operation failed ({type(exc).__name__}); retrying safely')
                current = self.manifest.get('session')
                if current and current.get('status') in ('QUEUED','WAITING_TOUCH_1','LIFT_FINGER','WAITING_TOUCH_2'):
                    try:
                        reason = getattr(exc, 'code', 'CAPTURE_TIMEOUT' if isinstance(exc, TimeoutError) else 'TRANSPORT_ERROR')
                        self._progress(current, 'FAILED', error_code=reason)
                    except Exception:
                        pass
                self.sensor.close()
                self.stop_event.wait(3)
        self.sensor.close()
        if self.touch:
            self.touch.close()

    def close(self):
        self.stop_event.set()
        self.wake_event.set()
        if self.thread:
            self.thread.join(timeout=10)
