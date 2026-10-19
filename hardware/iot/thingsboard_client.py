"""ThingsBoard MQTT: correlated, bounded retries with stable attendance event IDs."""
import base64
import json
import math
import os
import threading
import time
import uuid
from typing import Callable, Optional


class ThingsBoardClient:
    def __init__(self, host: str, port: int, token: str, device_id='PI4_FRONT_GATE',
                 initial_mode='CHECK_IN', on_mode_change: Optional[Callable] = None,
                 on_attendance_result: Optional[Callable] = None):
        self.host, self.port, self.token, self.device_id = host, port, token, device_id
        self.current_mode = initial_mode
        self.on_mode_change, self.on_attendance_result = on_mode_change, on_attendance_result
        # TB RPC protobuf requestId is int32. UUID event_id provides durable correlation.
        self._rpc_request_id = uuid.uuid4().int % (2 ** 30)
        self._pending_rpc_callbacks = {}
        self._lock = threading.RLock()
        self._stopped = threading.Event()
        self._worker = None
        self._mode_version = 0
        self.connected, self.client = False, None
        self.rpc_timeout = 8.0
        self.max_attempts = 3
        try:
            import paho.mqtt.client as mqtt
            self.mqtt = mqtt
            try:
                self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f'smartface_{device_id}')
            except (AttributeError, TypeError):
                self.client = mqtt.Client(client_id=f'smartface_{device_id}')
            self.client.username_pw_set(token)
            self.client.on_connect, self.client.on_message, self.client.on_disconnect = self.on_connect, self.on_message, self.on_disconnect
        except ImportError:
            print('[MQTT] Thiếu paho-mqtt; không thể gửi điểm danh.')

    def start(self):
        if not self.client:
            return
        self._stopped.clear()
        self.client.connect_async(self.host, self.port, 60)
        self.client.loop_start()
        self._worker = threading.Thread(target=self._watchdog, daemon=True)
        self._worker.start()

    def on_connect(self, client, userdata, flags, rc, properties=None):
        self.connected = rc == 0
        if not self.connected:
            return
        for topic in ['attributes', 'attributes/response/+', 'rpc/request/+', 'rpc/response/+']:
            client.subscribe(f'v1/devices/me/{topic}', qos=1)
        client.publish('v1/devices/me/attributes/request/1', json.dumps({'sharedKeys': 'attendance_mode,mode_changed_at'}), qos=1)

    def on_disconnect(self, client, userdata, flags_or_rc, *args):
        self.connected = False

    def set_mode(self, mode, version=None):
        if mode not in ('CHECK_IN', 'CHECK_OUT'):
            return False
        supplied_version = version
        version = int(version) if version is not None else max(int(time.time() * 1000), self._mode_version + 1)
        if version < self._mode_version:
            return False
        changed = self.current_mode != mode
        self.current_mode, self._mode_version = mode, version
        if changed and self.on_mode_change:
            self.on_mode_change(mode)
        # Shared-attribute readback must not create an HTTP/attribute relay loop.
        if changed or supplied_version is None:
            self.send_telemetry({'current_mode': mode, 'mode': mode, 'mode_changed_at': version})
        if changed:
            self.notify_backend_mode(mode)
        return True

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            topic, request_id = msg.topic, msg.topic.rsplit('/', 1)[-1]
            if topic.startswith('v1/devices/me/rpc/response/'):
                with self._lock:
                    info = self._pending_rpc_callbacks.get(request_id)
                    # Reject unsolicited, late or mismatched responses.
                    if not info or not isinstance(payload, dict) or payload.get('event_id') != info['event_id']:
                        return
                    self._pending_rpc_callbacks.pop(request_id, None)
                self._deliver(info, payload)
            elif topic.startswith('v1/devices/me/rpc/request/') and isinstance(payload, dict):
                method, params = payload.get('method'), payload.get('params')
                if method in ('getValue', 'getMode', 'getValueMethod'):
                    response = self.current_mode == 'CHECK_IN'
                elif method in ('setValue', 'setMode', 'setValueMethod'):
                    mode = ('CHECK_IN' if params else 'CHECK_OUT') if isinstance(params, bool) else params
                    if not self.set_mode(mode):
                        response = {'error': 'invalid_mode'}
                    else:
                        response = self.current_mode == 'CHECK_IN'
                else:
                    response = {'error': 'unknown_method'}
                client.publish(f'v1/devices/me/rpc/response/{request_id}', json.dumps(response), qos=1)
            elif isinstance(payload, dict):
                shared = payload.get('shared', payload)
                mode = shared.get('attendance_mode')
                if mode:
                    # A legacy unversioned shared value cannot override a newer RPC.
                    self.set_mode(mode, shared.get('mode_changed_at') or 1)
        except (ValueError, TypeError, AttributeError) as exc:
            print(f'[MQTT] Payload không hợp lệ: {exc}')

    def notify_backend_mode(self, mode):
        """Optional asynchronous relay. Prefer ThingsBoard's authenticated rule-chain relay."""
        base, secret = os.getenv('BACKEND_BASE_URL', '').rstrip('/'), os.getenv('TB_WEBHOOK_SECRET', '')
        if not base or not secret:
            return
        def notify():
            import urllib.request
            try:
                req = urllib.request.Request(f'{base}/api/devices/{self.device_id}/mode-notify',
                    data=json.dumps({'mode': mode}).encode(),
                    headers={'Content-Type': 'application/json', 'X-TB-Webhook-Secret': secret})
                with urllib.request.urlopen(req, timeout=3) as response:
                    response.read()
            except Exception as exc:
                print(f'[MQTT] Chưa đồng bộ mode tới web: {exc}')
        threading.Thread(target=notify, daemon=True).start()

    def _publish(self, request_id, info):
        try:
            result = self.client.publish(f'v1/devices/me/rpc/request/{request_id}', info['payload'], qos=1)
            return result.rc == 0
        except Exception:
            return False

    def send_scan_rpc(self, embedding, fas_score: float, mode: str, on_result=None,
                      event_id=None, captured_at=None) -> int:
        if not self.connected or not self.client or mode not in ('CHECK_IN', 'CHECK_OUT'):
            return -1
        import numpy as np
        if not math.isfinite(float(fas_score)) or not 0 <= float(fas_score) <= 1:
            return -1
        try:
            vector = np.frombuffer(base64.b64decode(embedding, validate=True), dtype='<f4') if isinstance(embedding, str) else np.asarray(embedding, dtype='<f4').reshape(-1)
            if vector.size != 512 or not np.isfinite(vector).all() or np.linalg.norm(vector) <= 0:
                return -1
            encoded = base64.b64encode(vector.tobytes()).decode('ascii')
        except (ValueError, TypeError):
            return -1
        event_id = event_id or uuid.uuid4().hex
        params = {'device_id': self.device_id, 'mode': mode, 'antispoof_score': float(fas_score),
                  'embedding_b64': encoded, 'client_timestamp': captured_at or int(time.time() * 1000), 'event_id': event_id}
        info = {'payload': json.dumps({'method': 'verify_face', 'params': params}), 'event_id': event_id,
                'callback': on_result, 'deadline': time.monotonic() + self.rpc_timeout, 'attempts': 1}
        with self._lock:
            if len(self._pending_rpc_callbacks) >= 4: return -1
            self._rpc_request_id = self._rpc_request_id % (2 ** 31 - 2) + 1
            request_id = str(self._rpc_request_id)
            self._pending_rpc_callbacks[request_id] = info
            if not self._publish(request_id, info):
                self._pending_rpc_callbacks.pop(request_id, None)
                return -1
        return int(request_id)

    def _deliver(self, info, payload):
        callback = info['callback'] or self.on_attendance_result
        if callback:
            try:
                callback(payload)
            except Exception as exc:
                print(f'[MQTT] Lỗi callback: {exc}')

    def poll_pending(self):
        expired = []
        with self._lock:
            for request_id, info in list(self._pending_rpc_callbacks.items()):
                if time.monotonic() < info['deadline']:
                    continue
                if info['attempts'] < self.max_attempts:
                    info['attempts'] += 1
                    info['deadline'] = time.monotonic() + self.rpc_timeout
                    if self.connected:
                        self._publish(request_id, info)
                else:
                    self._pending_rpc_callbacks.pop(request_id, None)
                    expired.append(info)
        for info in expired:
            self._deliver(info, {'event_id': info['event_id'], 'success': False, 'matched': False,
                'uncertain': True, 'message': 'Hết thời gian chờ; chưa xác nhận được kết quả. Thử lại cùng event ID.'})

    def _watchdog(self):
        while not self._stopped.wait(0.25):
            self.poll_pending()

    def send_spoof_event(self, score, mode):
        if not self.connected or not self.client or not math.isfinite(float(score)) or not 0 <= score < 0.5:
            return False
        with self._lock:
            self._rpc_request_id = self._rpc_request_id % (2 ** 31 - 2) + 1
            payload = {'method': 'verify_face', 'params': {'event_id': uuid.uuid4().hex,
                'event_kind': 'SPOOF', 'device_id': self.device_id, 'mode': mode,
                'antispoof_score': float(score), 'client_timestamp': int(time.time() * 1000)}}
            return self.client.publish(f'v1/devices/me/rpc/request/{self._rpc_request_id}', json.dumps(payload), qos=1).rc == 0

    def send_scan_telemetry(self, embedding, fas_score, mode):
        return self.send_scan_rpc(embedding, fas_score, mode) > 0

    def send_telemetry(self, data):
        if self.connected and self.client and isinstance(data, dict):
            try:
                return self.client.publish('v1/devices/me/telemetry', json.dumps(data), qos=0).rc == 0
            except Exception:
                pass
        return False

    def send_heartbeat(self, fps_val, mode, distance=None, ai_state=None):
        data = {'status': 'ONLINE', 'fps': round(fps_val, 1), 'mode': mode, 'current_mode': mode}
        if distance is not None: data['distance'] = round(distance, 1)
        if ai_state is not None: data['ai_state'] = ai_state
        self.send_telemetry(data)

    def stop(self):
        self._stopped.set()
        if self._worker:
            self._worker.join(timeout=1)
        if self.client:
            self.client.disconnect()
            self.client.loop_stop()
        self.connected = False
