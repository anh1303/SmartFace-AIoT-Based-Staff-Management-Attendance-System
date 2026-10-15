"""
Module Kết nối ThingsBoard IoT qua MQTT
Hỗ trợ gửi Telemetry và lắng nghe cập nhật Shared Attributes hai chiều.
"""

import json
import time
from typing import Callable, Optional


class ThingsBoardClient:
    def __init__(
        self,
        host: str,
        port: int,
        token: str,
        device_id: str = "PI4_FRONT_GATE",
        initial_mode: str = "CHECK_IN",
        on_mode_change: Optional[Callable[[str], None]] = None,
        on_attendance_result: Optional[Callable[[dict], None]] = None,
    ):
        self.host = host
        self.port = port
        self.token = token
        self.device_id = device_id
        self.current_mode = initial_mode
        self.on_mode_change = on_mode_change
        self.on_attendance_result = on_attendance_result
        self._rpc_request_id = 0
        self._pending_rpc_callbacks = {}
        self.connected = False
        self.client = None

        try:
            import paho.mqtt.client as mqtt
            self.mqtt = mqtt
            try:
                self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"smartface_{self.device_id}")
            except (AttributeError, TypeError):
                self.client = mqtt.Client(client_id=f"smartface_{self.device_id}")

            if self.token:
                self.client.username_pw_set(self.token)
            self.client.on_connect = self.on_connect
            self.client.on_message = self.on_message
            self.client.on_disconnect = self.on_disconnect
        except ImportError:
            print("[WARN] Thư viện paho-mqtt chưa được cài đặt!")

    def start(self):
        if not self.client:
            return
        try:
            print(f"[MQTT] Đang kết nối tới ThingsBoard tại {self.host}:{self.port} (Token: {self.token[:5]}***)...")
            self.client.connect_async(self.host, self.port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"[MQTT] Lỗi kết nối ThingsBoard: {e}")

    def on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            print(f"[MQTT] [OK] Đã kết nối thành công tới ThingsBoard ({self.host})")
            # 1. Đăng ký nhận thay đổi Shared Attributes
            client.subscribe("v1/devices/me/attributes")
            # 2. Đăng ký nhận RPC Request từ Switch / Điều khiển từ xa trên Dashboard
            client.subscribe("v1/devices/me/rpc/request/+")
            # 3. Đăng ký nhận RPC Response trả về từ Server/Backend (Two-way RPC)
            client.subscribe("v1/devices/me/rpc/response/+")
            # 4. Yêu cầu giá trị shared attribute hiện tại
            client.publish("v1/devices/me/attributes/request/1", json.dumps({"sharedKeys": "attendance_mode"}))
        else:
            print(f"[MQTT] [ERROR] Kết nối ThingsBoard thất bại, mã lỗi: {rc}")

    def on_disconnect(self, client, userdata, flags_or_rc, *args):
        self.connected = False
        print("[MQTT] Mất kết nối tới ThingsBoard, đang tự động kết nối lại...")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except Exception as e:
            print(f"[MQTT] Lỗi parse payload từ {topic}: {e}")
            return

        # ── (A) Xử lý RPC Request từ Dashboard (Switch Control / Buttons) ───
        if topic.startswith("v1/devices/me/rpc/request/"):
            request_id = topic.split("/")[-1]
            method = payload.get("method")
            params = payload.get("params")
            print(f"[MQTT] [RPC #{request_id}] Method: '{method}', Params: {params}")

            if method in ["getValue", "getMode", "getValueMethod"]:
                # Trả về trạng thái hiện tại cho switch (True nếu CHECK_IN, False nếu CHECK_OUT)
                is_checkin = (self.current_mode == "CHECK_IN")
                client.publish(f"v1/devices/me/rpc/response/{request_id}", json.dumps(is_checkin), qos=1)
                return
            elif method in ["setValue", "setMode", "setValueMethod"]:
                # Đổi mode theo switch (True -> CHECK_IN, False -> CHECK_OUT)
                if isinstance(params, bool):
                    new_mode = "CHECK_IN" if params else "CHECK_OUT"
                elif isinstance(params, str) and params.upper() in ["CHECK_IN", "CHECK_OUT"]:
                    new_mode = params.upper()
                else:
                    new_mode = "CHECK_IN" if params else "CHECK_OUT"

                print(f"[MQTT] [RPC] Chuyển chế độ sang: {new_mode}")
                self.current_mode = new_mode
                if self.on_mode_change:
                    self.on_mode_change(new_mode)

                # Phản hồi ThingsBoard để switch cập nhật trạng thái UI thành công
                client.publish(f"v1/devices/me/rpc/response/{request_id}", json.dumps(new_mode == "CHECK_IN"), qos=1)

                # Đồng bộ Shared Attribute và Telemetry lên ThingsBoard
                client.publish("v1/devices/me/attributes", json.dumps({"attendance_mode": new_mode}), qos=1)
                client.publish("v1/devices/me/telemetry", json.dumps({"current_mode": new_mode, "mode": new_mode}), qos=1)

                # Báo cho Web App Backend để Frontend tự động nhảy toggle
                self.notify_backend_mode(new_mode)
                return
            else:
                client.publish(f"v1/devices/me/rpc/response/{request_id}", json.dumps({"status": "unknown_method"}), qos=1)
                return

        # ── (C) Xử lý RPC Response từ Server/Backend (Kết quả đối soát Two-way RPC) ───
        if topic.startswith("v1/devices/me/rpc/response/"):
            request_id = topic.split("/")[-1]
            print(f"[MQTT] [RPC Response #{request_id}] Nhận kết quả từ Backend: {payload}")

            cb_info = self._pending_rpc_callbacks.pop(str(request_id), None)
            if cb_info:
                _, cb = cb_info
                try:
                    cb(payload)
                except Exception as ex:
                    print(f"[MQTT] Lỗi callback RPC #{request_id}: {ex}")

            if self.on_attendance_result:
                try:
                    self.on_attendance_result(payload)
                except Exception as ex:
                    print(f"[MQTT] Lỗi on_attendance_result: {ex}")
            return

        # ── (B) Xử lý Shared Attributes (khi đổi mode từ Web Admin API) ───
        try:
            new_mode = None
            if "attendance_mode" in payload:
                new_mode = payload["attendance_mode"]
            elif "shared" in payload and "attendance_mode" in payload["shared"]:
                new_mode = payload["shared"]["attendance_mode"]

            if new_mode in ["CHECK_IN", "CHECK_OUT"]:
                print(f"[MQTT] [ATTRIBUTE] Nhận cập nhật mode: {new_mode}")
                self.current_mode = new_mode
                if self.on_mode_change:
                    self.on_mode_change(new_mode)
                # Báo cho Web App Backend
                self.notify_backend_mode(new_mode)
        except Exception as e:
            print(f"[MQTT] Lỗi parse gói tin attributes: {e}")

    def notify_backend_mode(self, mode: str):
        """Thông báo đổi chế độ về Web App Backend qua HTTP để đồng bộ Socket.IO thời gian thực."""
        import urllib.request
        try:
            url = f"http://{self.host}:3000/api/devices/{self.device_id}/mode-notify"
            data = json.dumps({"mode": mode}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=1.5)
            print(f"[HTTP] >>> Đã đồng bộ mode '{mode}' về Web App Backend")
        except Exception:
            pass

    def send_scan_rpc(
        self,
        embedding,
        fas_score: float,
        mode: str,
        on_result: Optional[Callable[[dict], None]] = None,
    ) -> int:
        """
        Gửi Vector 512D qua Two-way MQTT RPC (Client-side RPC) được nén nhị phân Base64.
        Lợi ích cốt lõi:
        - TUYỆT ĐỐI KHÔNG lưu vector vào CSDL Timeseries (ts_kv) của ThingsBoard -> Không đầy ổ cứng.
        - Nén vector Float32 sang Base64 (~2.7KB thay vì ~7KB JSON text) -> Siêu nhẹ, tiết kiệm CPU cả 2 đầu.
        - ThingsBoard Rule Chain đẩy trực tiếp sang Node.js Backend xử lý đối soát pgvector.
        - Backend phản hồi kết quả trực tiếp về topic v1/devices/me/rpc/response/{requestId}.
        """
        if not self.connected or not self.client:
            print("[MQTT] Chưa kết nối ThingsBoard, bỏ qua gửi RPC đối soát.")
            return -1

        import base64
        import numpy as np

        if isinstance(embedding, str):
            embedding_b64 = embedding
        elif isinstance(embedding, np.ndarray):
            embedding_b64 = base64.b64encode(embedding.astype(np.float32).tobytes()).decode("ascii")
        elif isinstance(embedding, (list, tuple)):
            embedding_arr = np.array(embedding, dtype=np.float32)
            embedding_b64 = base64.b64encode(embedding_arr.tobytes()).decode("ascii")
        else:
            print("[MQTT] Định dạng embedding không hợp lệ (cần numpy array, list hoặc base64 string).")
            return -1

        self._rpc_request_id += 1
        req_id = self._rpc_request_id

        if on_result:
            self._pending_rpc_callbacks[str(req_id)] = (time.time(), on_result)

        payload = {
            "method": "verify_face",
            "params": {
                "device_id": self.device_id,
                "mode": mode,
                "current_mode": mode,
                "antispoof_score": round(float(fas_score), 4),
                "embedding_b64": embedding_b64,
                "client_timestamp": int(time.time() * 1000),
            },
        }
        topic = f"v1/devices/me/rpc/request/{req_id}"
        self.client.publish(topic, json.dumps(payload), qos=1)
        print(f"[MQTT RPC #{req_id}] >>> Đã gửi Vector 512D Base64 ({mode}, ~{len(embedding_b64)} chars) qua Two-way RPC!")
        return req_id

    def send_scan_telemetry(self, embedding, fas_score: float, mode: str) -> bool:
        """
        Tương thích ngược: Chuyển hướng sang Two-way RPC Base64 để không làm ô nhiễm Database của ThingsBoard.
        """
        req_id = self.send_scan_rpc(embedding, fas_score, mode)
        return req_id > 0

    def send_telemetry(self, data: dict):
        """
        Gửi dữ liệu trạng thái / cảm biến tùy biến (khoảng cách, AI state, FPS) lên ThingsBoard Telemetry.
        """
        if self.connected and self.client and isinstance(data, dict):
            try:
                self.client.publish("v1/devices/me/telemetry", json.dumps(data), qos=0)
            except Exception as e:
                pass

    def send_heartbeat(self, fps_val: float, mode: str, distance: Optional[float] = None, ai_state: Optional[str] = None):
        if self.connected and self.client:
            self.current_mode = mode
            hb = {
                "status": "ONLINE",
                "fps": round(fps_val, 1),
                "mode": mode,
                "current_mode": mode,
            }
            if distance is not None:
                hb["distance"] = round(distance, 1)
            if ai_state is not None:
                hb["ai_state"] = ai_state
            self.send_telemetry(hb)

    def stop(self):
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception:
                pass
