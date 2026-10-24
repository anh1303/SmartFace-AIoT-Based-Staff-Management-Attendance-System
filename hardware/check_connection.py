"""Kiểm tra MQTT đăng nhập + đọc attributes; không gửi vector/điểm danh."""
import json
import os
import threading
from pathlib import Path

import paho.mqtt.client as mqtt
from dotenv import load_dotenv


def main():
    load_dotenv(Path(__file__).resolve().parent / ".env")
    host = os.getenv("TB_HOST", "").strip()
    token = os.getenv("TB_TOKEN", "").strip()
    if not host or not token:
        raise SystemExit("Thiếu TB_HOST/TB_TOKEN. Chạy configure.py trước.")
    done = threading.Event()
    result = {"ok": False}
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.username_pw_set(token)

    def connected(client, userdata, flags, reason, properties):
        if reason != 0:
            print(f"FAIL: MQTT từ chối đăng nhập: {reason}")
            done.set()
            return
        print("OK: MQTT đã đăng nhập ThingsBoard.")
        client.subscribe("v1/devices/me/attributes/response/+")

    def subscribed(client, userdata, mid, reasons, properties):
        if any(reason.is_failure for reason in reasons):
            print("FAIL: Không được phép subscribe attributes.")
            done.set()
            return
        client.publish("v1/devices/me/attributes/request/1", json.dumps({"sharedKeys": "attendance_mode"}))

    def message(client, userdata, msg):
        payload = json.loads(msg.payload.decode())
        mode = payload.get("shared", {}).get("attendance_mode", "chưa đặt")
        print(f"OK: Đọc được shared attributes; attendance_mode={mode}")
        result["ok"] = True
        done.set()

    client.on_connect = connected
    client.on_subscribe = subscribed
    client.on_message = message
    try:
        client.connect_async(host, int(os.getenv("TB_PORT", "1883")), 30)
        client.loop_start()
        if not done.wait(15):
            print("FAIL: Timeout. Kiểm tra IP, port 1883, firewall, ThingsBoard và token.")
    finally:
        client.disconnect()
        client.loop_stop()
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
