"""Cấu hình tương tác, giữ các tham số AI và token ngoài terminal history."""
import getpass
import os
from pathlib import Path

from dotenv import dotenv_values, set_key


def main():
    path = Path(__file__).resolve().parent / ".env"
    if not path.exists():
        path.write_text((path.parent / ".env.example").read_text())
    os.chmod(path, 0o600)
    current = dotenv_values(path)
    host = input(f"IP/hostname ThingsBoard [{current.get('TB_HOST', '')}]: ").strip() or current.get("TB_HOST", "")
    if not host or "://" in host or "/" in host:
        raise SystemExit("Nhập hostname/IP, không nhập URL hoặc port.")
    token = getpass.getpass("Device access token (Enter giữ token hiện tại): ").strip() or current.get("TB_TOKEN", "")
    if not token:
        raise SystemExit("Cần token lấy từ Credentials của thiết bị ThingsBoard.")
    set_key(path, "TB_HOST", host)
    set_key(path, "TB_TOKEN", token)
    stream_host = input(f"IP/hostname MediaMTX [{host}]: ").strip() or host
    set_key(path, "RTSP_URL", f"rtsp://{stream_host}:8554/pi4_cam")
    print("Đã lưu .env. Kiểm tra CAMERA_INDEX, TFT_ENABLED, ULTRASONIC_ENABLED theo phần cứng.")


if __name__ == "__main__":
    main()
