"""
SmartFace AIoT — Raspberry Pi 4 Edge Client (Modularized with Tracking)

Orchestrator kết nối toàn diện các module:
- detection   : SCRFD / YuNet FaceDetector
- tracking    : FaceTracker (IOU association + Lucas-Kanade optical flow cadence)
- antispoof   : MiniFASNet AntiSpoofPredictor (temporal voting qua rolling window)
- alignment   : ArcFace 5-point landmark affine aligner
- recognition : ArcFace MobileFaceNet FaceEmbedder (512D)
- iot         : ThingsBoardClient (MQTT Telemetry + Two-way Shared Attributes)
- streaming   : RTSPStreamer (FFmpeg pipe -> MediaMTX WebRTC/HLS/RTSP)
"""

import queue
import uuid
import os
import sys
import time
import subprocess
from pathlib import Path
import cv2
import numpy as np
from dotenv import load_dotenv

try:
    import onnxruntime as ort
    ort.set_default_logger_severity(3)
except ImportError:
    pass

# Tải biến môi trường
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()
import config as vision


# Helper đọc biến môi trường
def get_env_str(key: str, default: str) -> str:
    val = os.getenv(key)
    return val.strip() if val and val.strip() else default


def get_env_int(key: str, default: int) -> int:
    val = os.getenv(key)
    if not val or not val.strip():
        return default
    try:
        return int(val.strip())
    except ValueError:
        return default


def get_env_float(key: str, default: float) -> float:
    val = os.getenv(key)
    if not val or not val.strip():
        return default
    try:
        return float(val.strip())
    except ValueError:
        return default


def get_env_bool(key: str, default: bool) -> bool:
    val = os.getenv(key)
    if not val or not val.strip():
        return default
    return val.strip().lower() in ("true", "1", "yes", "y", "on")


# Cấu hình thiết bị & server
DEVICE_ID = get_env_str("DEVICE_ID", "PI4_FRONT_GATE")
INITIAL_MODE = get_env_str("INITIAL_MODE", "OFF")

TB_HOST = get_env_str("TB_HOST", "127.0.0.1")
TB_PORT = get_env_int("TB_PORT", 1883)
TB_TOKEN = get_env_str("TB_TOKEN", "")

STREAM_ENABLED = get_env_bool("STREAM_ENABLED", True)
RTSP_URL = get_env_str("RTSP_URL", "rtsp://127.0.0.1:8554/pi4_cam")
CAM_INDEX = get_env_int("CAMERA_INDEX", 0)
WIDTH = get_env_int("CAMERA_WIDTH", 640)
HEIGHT = get_env_int("CAMERA_HEIGHT", 480)
FPS = vision.CAMERA_FPS

# Cấu hình AI & Tracking
APP_DETECTOR = vision.APP_DETECTOR
FAS_LOGIT_THRESHOLD = vision.PAD_THRESHOLD_LOGIT
REQUIRED_CONSECUTIVE = vision.PAD_MIN_VOTES
COOLDOWN_SEC = get_env_float("SCAN_COOLDOWN_SECONDS", 5.0)

# Detection Cadence: chạy detector mỗi N giây; các frame ở giữa dùng optical flow tiết kiệm CPU Pi
DETECTION_INTERVAL_SECONDS = vision.DETECTION_INTERVAL_SECONDS
RECOGNIZE_INTERVAL_SECONDS = vision.RECOGNIZE_INTERVAL_SECONDS
PAD_INTERVAL_SECONDS = vision.PAD_INTERVAL_SECONDS
TRACK_IOU_THRESHOLD = vision.TRACK_IOU_THRESHOLD
TRACK_MAX_MISSING_FRAMES = vision.TRACK_MAX_MISSING_FRAMES
MAX_FACES_PER_FRAME = vision.MAX_FACES_PER_FRAME

SHOW_GUI = get_env_bool("SHOW_GUI", False)

# Cấu hình Màn hình phần cứng TFT ST7789V SPI
TFT_ENABLED = get_env_bool("TFT_ENABLED", False)
TFT_WIDTH = get_env_int("TFT_WIDTH", 320)
TFT_HEIGHT = get_env_int("TFT_HEIGHT", 240)
TFT_ROTATE = get_env_int("TFT_ROTATE", 0)
TFT_SPI_MHZ = get_env_int("TFT_SPI_MHZ", 32)
TFT_DC_PIN = get_env_int("TFT_DC_PIN", 25)
TFT_RESET_PIN = get_env_int("TFT_RESET_PIN", 24)
TFT_BGR = get_env_bool("TFT_BGR", False)
TFT_INVERT = get_env_bool("TFT_INVERT", False)
TFT_DISPLAY_FPS = get_env_float("TFT_DISPLAY_FPS", 10.0)

# Cấu hình 2 Cảm biến siêu âm chọn chế độ CHECK_IN / CHECK_OUT & Wake-on-Presence
ULTRASONIC_ENABLED = get_env_bool("ULTRASONIC_ENABLED", True)
# Chân GPIO cố định phần cứng (BCM numbering, cố định trong mã nguồn):
# Cảm biến #1: CHECK_IN (Vào ca)  -> TRIG = Pin 16 (GPIO 23), ECHO = Pin 13 (GPIO 27)
ULTRASONIC_CHECKIN_TRIG_PIN = 23
ULTRASONIC_CHECKIN_ECHO_PIN = 27
# Cảm biến #2: CHECK_OUT (Ra ca) -> TRIG = Pin 11 (GPIO 17), ECHO = Pin 15 (GPIO 22)
ULTRASONIC_CHECKOUT_TRIG_PIN = 17
ULTRASONIC_CHECKOUT_ECHO_PIN = 22
# Ngưỡng khoảng cách đưa tay vào kích hoạt chế độ (mặc định <= 20.0 cm)
ULTRASONIC_TRIGGER_DISTANCE = get_env_float("ULTRASONIC_TRIGGER_DISTANCE", 20.0)
ULTRASONIC_MAX_DISTANCE = get_env_float("ULTRASONIC_MAX_DISTANCE", 100.0)
ULTRASONIC_DEBOUNCE_SECONDS = get_env_float("ULTRASONIC_DEBOUNCE_SECONDS", 0.5)
ULTRASONIC_SLEEP_DELAY = get_env_float("ULTRASONIC_SLEEP_DELAY", 0.5)
FACE_LOST_RESET_SECONDS = get_env_float("FACE_LOST_RESET_SECONDS", 1.5)

# Tự động phát hiện môi trường Headless (SSH trên Pi) để tránh lỗi Qt xcb abort()
if SHOW_GUI and sys.platform.startswith("linux"):
    has_display = bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
    if not has_display:
        print("[WARN] Không phát hiện màn hình X11/Wayland (phiên SSH hoặc Pi không cắm màn).")
        print("[WARN] Tự động chuyển sang chế độ Headless (SHOW_GUI=False). Luồng video được truyền qua RTSP/TFT.")
        SHOW_GUI = False

# Import các module nội bộ
from detection import create_detector
from tracking import FaceTracker
from antispoof import AntiSpoofPredictor
from alignment import align_face
from recognition import FaceEmbedder
from recognition.worker import RecognitionWorker, IdentityCache
from recognition.remote import RemoteFaceEmbedder, ARCFACE_SHA256
from vision_pipeline import update_track_pad, limit_faces
from alignment.aligner import get_input_face
from iot import ThingsBoardClient
from streaming import RTSPStreamer
from display import TFTDisplay
from peripherals import (
    UltrasonicSensor,
    AudioManager,
    get_hardware_telemetry,
    scan_bluetooth_devices,
    get_bluetooth_info,
)

# Trạng thái toàn cục
current_mode = INITIAL_MODE
mode_generation = 0


def on_mode_change(new_mode: str):
    global current_mode, mode_generation
    if new_mode != current_mode:
        mode_generation += 1
    current_mode = new_mode
    print(f"\n[MODE SWITCH] Nhận lệnh từ ThingsBoard: Đổi sang {current_mode}!\n")


def liveness_score(logit, threshold=None):
    """Map raw PAD margin to backend's existing [0,1] transport contract."""
    delta = float(logit) - (vision.PAD_THRESHOLD_LOGIT if threshold is None else float(threshold))
    return float(1 / (1 + np.exp(-max(-60.0, min(60.0, delta)))))


def face_status_label(track):
    """Display only; never use a held identity to override the PAD verdict."""
    if track.pad_invalid_reason:
        return "INVALID", (0, 165, 255)
    if track.missing_frames or not track.pad_ready:
        return "CHECKING", (0, 255, 255)
    if track.is_spoof:
        return "SPOOF", (0, 0, 255)
    if not track.is_real:
        return "CHECKING", (0, 255, 255)
    name, _, _ = track.display_result(vision.RECOGNITION_LABEL_HOLD_SECONDS)
    return f"REAL - {name}", (0, 255, 0)


def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description="SmartFace AIoT — Raspberry Pi 4 Edge Client")
    parser.add_argument('--capture-dir', default=os.getenv("PAD_CAPTURE_DIR", None),
                        help='Thư mục lưu crop PAD; nhấn C để chụp')
    parser.add_argument('--subject', default=os.getenv("PAD_CAPTURE_SUBJECT", 'unspecified'),
                        help='Mã người được chụp (không phải nhãn real/spoof)')
    parser.add_argument('--condition', default=os.getenv("PAD_CAPTURE_CONDITION", 'unspecified'),
                        help='Điều kiện ánh sáng / camera của phiên')
    parser.add_argument('--label', choices=['real', 'fake'], default=os.getenv("PAD_CAPTURE_LABEL", None),
                        help='Gán nhãn ground-truth tự động cho phiên chụp (real hoặc fake)')
    return parser.parse_known_args()[0]


def main(args=None):
    global current_mode
    if args is None:
        args = parse_args()

    capture = None
    if args.capture_dir:
        try:
            from pad_capture import PADCapture
            capture = PADCapture(args.capture_dir, args.subject, args.condition, label=args.label)
            label_info = f" [nhãn tự động: '{args.label}']" if args.label else " [chưa gán nhãn]"
            print(f"[Capture] Đã bật chế độ chụp mẫu PAD: lưu vào {capture.directory}{label_info}")
        except Exception as exc:
            print(f"[Capture Warning] Không thể khởi tạo PADCapture: {exc}")

    print("\n=======================================================")
    print("      SMARTFACE AIoT — RASPBERRY PI 4 EDGE CLIENT     ")
    print("=======================================================")
    print(f"  Device ID        : {DEVICE_ID}")
    print(f"  Initial Mode     : {current_mode}")
    print(f"  TB Host          : {TB_HOST}:{TB_PORT}")
    masked_token = f"{TB_TOKEN[:4]}...{TB_TOKEN[-4:]}" if TB_TOKEN and len(TB_TOKEN) >= 8 else (TB_TOKEN or "CHƯA ĐẶT")
    print(f"  TB Token         : {masked_token}")
    print(f"  RTSP URL         : {RTSP_URL} (Stream Enabled: {STREAM_ENABLED})")
    print(f"  Detector Backend : {APP_DETECTOR.upper()}")
    print(f"  Detection Cadence: Mỗi {DETECTION_INTERVAL_SECONDS}s (Optical Flow ở giữa)")
    print(f"  Recognition Every: {RECOGNIZE_INTERVAL_SECONDS}s | PAD Every: {PAD_INTERVAL_SECONDS}s")
    print(f"  Tracking Config  : IOU={TRACK_IOU_THRESHOLD}, MaxMissing={TRACK_MAX_MISSING_FRAMES}")
    print(f"  Anti-Spoofing    : Ngưỡng logit={FAS_LOGIT_THRESHOLD}, tối thiểu {REQUIRED_CONSECUTIVE}/{vision.PAD_SMOOTH_WINDOW} phiếu")
    print(f"  Max Faces/Frame  : {MAX_FACES_PER_FRAME if MAX_FACES_PER_FRAME > 0 else 'KHÔNG GIỚI HẠN (All faces)'}")
    print(f"  Cooldown         : {COOLDOWN_SEC}s mỗi Track")
    print(f"  TFT ST7789V SPI  : {'BẬT (320x240)' if TFT_ENABLED else 'TẮT'}")
    print(f"  Ultrasonic #1 IN : {'BẬT (TRIG=GPIO' + str(ULTRASONIC_CHECKIN_TRIG_PIN) + ' [Pin 16], ECHO=GPIO' + str(ULTRASONIC_CHECKIN_ECHO_PIN) + ' [Pin 13], <= ' + str(ULTRASONIC_TRIGGER_DISTANCE) + 'cm, delay=' + str(ULTRASONIC_DEBOUNCE_SECONDS) + 's)' if ULTRASONIC_ENABLED else 'TẮT'}")
    print(f"  Ultrasonic #2 OUT: {'BẬT (TRIG=GPIO' + str(ULTRASONIC_CHECKOUT_TRIG_PIN) + ' [Pin 11], ECHO=GPIO' + str(ULTRASONIC_CHECKOUT_ECHO_PIN) + ' [Pin 15], <= ' + str(ULTRASONIC_TRIGGER_DISTANCE) + 'cm, delay=' + str(ULTRASONIC_DEBOUNCE_SECONDS) + 's)' if ULTRASONIC_ENABLED else 'TẮT'}")
    print("=======================================================\n")

    result_queue = queue.SimpleQueue()

    # Callback khi nhận kết quả đối soát điểm danh Two-way RPC từ Backend
    def on_attendance_result(res: dict):
        nonlocal status_banner, status_banner_time
        if not isinstance(res, dict):
            return

        is_matched = res.get("matched", False)
        is_success = res.get("success", False)
        sim = res.get("similarity", 0.0)
        mode = res.get("mode", current_mode)

        if is_matched and is_success:
            emp = res.get("employee", {})
            emp_name = emp.get("full_name") or emp.get("employee_code") or "Nhân viên"
            review = res.get("attendance", {}).get("status") == "FLAGGED"
            status_banner = f"{emp_name} - {mode}: {'ĐÃ LƯU, CẦN KIỂM TRA' if review else 'THÀNH CÔNG'} ({sim:.2f})"
            status_banner_time = time.time()
            print(f"[EDGE] 🎉 ĐIỂM DANH THÀNH CÔNG: {emp_name} ({mode}) - Similarity: {sim:.2f}")
            try:
                bt_info = get_bluetooth_info()
                audio_manager.speak_attendance(
                    emp_name=emp_name,
                    mode=mode,
                    target_mac=bt_info.get("address", ""),
                    target_name=bt_info.get("deviceName", ""),
                )
            except Exception as e:
                print(f"[AUDIO WARN] Lỗi phát âm thanh điểm danh: {e}")
        elif is_matched and not is_success:
            emp = res.get("employee", {})
            emp_name = emp.get("full_name") or emp.get("employee_code") or "Nhân viên"
            msg = res.get("message", "Đã điểm danh")
            status_banner = f"{emp_name}: {msg}"
            status_banner_time = time.time()
            print(f"[EDGE] ℹ️ {emp_name}: {msg}")
        else:
            status_banner = f"KHÔNG KHỚP NHÂN VIÊN (Sim: {sim:.2f})"
            status_banner_time = time.time()
            print(f"[EDGE] ⚠️ KHÔNG KHỚP: {res.get('message', 'Không tìm thấy')} (Sim: {sim:.2f})")

    # Quản lý cài đặt ngoại vi & âm thanh
    current_show_fps = vision.SHOW_FPS
    current_stream_enabled = STREAM_ENABLED
    current_max_faces = MAX_FACES_PER_FRAME
    current_volume = 75
    current_is_muted = False
    audio_manager = AudioManager(initial_volume=current_volume, initial_muted=current_is_muted)

    def _persist_env_max_faces(val: int):
        env_path = BASE_DIR / ".env"
        if not env_path.exists():
            return
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            updated_lines = []
            found = False
            for line in lines:
                if line.strip().startswith("MAX_FACES_PER_FRAME="):
                    updated_lines.append(f"MAX_FACES_PER_FRAME={val}\n")
                    found = True
                else:
                    updated_lines.append(line)
            if not found:
                updated_lines.append(f"\nMAX_FACES_PER_FRAME={val}\n")
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(updated_lines)
        except Exception as exc:
            print(f"[SETTINGS] Không thể ghi MAX_FACES_PER_FRAME vào .env: {exc}")

    def on_settings_change(new_settings: dict):
        nonlocal current_show_fps, current_stream_enabled, current_max_faces, current_volume, current_is_muted
        if "show_fps" in new_settings:
            current_show_fps = bool(new_settings["show_fps"])
            print(f"[SETTINGS] Đã đổi FPS LCD: {current_show_fps}")
        if "stream_enabled" in new_settings:
            current_stream_enabled = bool(new_settings["stream_enabled"])
            streamer.set_enabled(current_stream_enabled)
            tb_client.send_telemetry({"stream_enabled": current_stream_enabled})
            print(f"[SETTINGS] Đã đổi trạng thái Camera (phần cứng + stream): {'BẬT' if current_stream_enabled else 'TẮT'}")
        if "max_faces" in new_settings:
            current_max_faces = max(1, min(10, int(new_settings["max_faces"])))
            vision.MAX_FACES_PER_FRAME = current_max_faces
            _persist_env_max_faces(current_max_faces)
            print(f"[SETTINGS] Đã đổi số khuôn mặt nhận diện tối đa (MAX_FACES_PER_FRAME): {current_max_faces}")
        if "volume" in new_settings:
            current_volume = int(new_settings["volume"])
            audio_manager.set_volume(current_volume)
            print(f"[SETTINGS] Đã đổi âm lượng: {current_volume}%")
        if "is_muted" in new_settings:
            current_is_muted = bool(new_settings["is_muted"])
            audio_manager.set_mute(current_is_muted)

    def on_action_request(action: str, params: dict):
        if action == "playTestSound":
            bt_info = get_bluetooth_info()
            target_mac = bt_info.get("address", "")
            target_name = bt_info.get("deviceName", "")
            success = audio_manager.play_test_sound(target_mac=target_mac, target_name=target_name)
            return {"success": success, "message": "Played test sound"}
        if action == "scanBluetooth":
            devices = scan_bluetooth_devices()
            print(f"[BLUETOOTH] Quét thực tế phát hiện {len(devices)} thiết bị")
            return devices
        if action == "scanWifi":
            return []
        if action == "reconnectBluetooth":
            bt_info = get_bluetooth_info()
            addr = bt_info.get("address", "")
            if not addr:
                try:
                    res_p = subprocess.run(["bluetoothctl", "devices", "Paired"], capture_output=True, text=True, timeout=3)
                    for l in res_p.stdout.splitlines():
                        if l.strip().startswith("Device"):
                            parts = l.split()
                            if len(parts) >= 2:
                                addr = parts[1]
                                break
                except Exception:
                    pass
            if addr:
                try:
                    subprocess.run(["bluetoothctl", "connect", addr], capture_output=True, text=True, timeout=6)
                except Exception:
                    pass
            return get_bluetooth_info()
        if action == "connectBluetooth":
            target_name = params.get("name", "") if isinstance(params, dict) else ""
            target_addr = params.get("address", "") if isinstance(params, dict) else ""
            print(f"[BLUETOOTH] Đang kết nối tới: {target_name} ({target_addr})")
            connected = False
            if target_addr:
                try:
                    subprocess.run(["bluetoothctl", "pair", target_addr], capture_output=True, text=True, timeout=6)
                    subprocess.run(["bluetoothctl", "trust", target_addr], capture_output=True, text=True, timeout=3)
                    res = subprocess.run(["bluetoothctl", "connect", target_addr], capture_output=True, text=True, timeout=6)
                    info_res = subprocess.run(["bluetoothctl", "info", target_addr], capture_output=True, text=True, timeout=2)
                    connected = "Connected: yes" in (info_res.stdout or "") or (res.returncode == 0 and "Connection successful" in (res.stdout or ""))
                except Exception as e:
                    print(f"[BLUETOOTH] Lỗi kết nối {target_addr}: {e}")
            if connected:
                tb_client.send_telemetry({"bluetooth_device": target_name, "bluetooth_connected": True})
            return {
                "success": True,
                "connected": connected,
                "deviceName": target_name,
                "address": target_addr,
                "status": "connected" if connected else "disconnected",
            }
        if action == "disconnectBluetooth":
            target_addr = params.get("address", "") if isinstance(params, dict) else ""
            print(f"[BLUETOOTH] Đang ngắt kết nối loa Bluetooth ({target_addr or 'mặc định'})")
            try:
                if target_addr:
                    subprocess.run(["bluetoothctl", "disconnect", target_addr], capture_output=True, text=True, timeout=5)
                else:
                    subprocess.run(["bluetoothctl", "disconnect"], capture_output=True, text=True, timeout=5)
            except Exception as e:
                print(f"[BLUETOOTH] Lỗi khi ngắt kết nối: {e}")
            tb_client.send_telemetry({"bluetooth_device": "", "bluetooth_connected": False})
            return {
                "success": True,
                "connected": False,
                "deviceName": "",
                "status": "disconnected",
            }
        return {"success": True, "message": f"Handled action {action}"}

    # 1. Khởi động kết nối MQTT ThingsBoard với cơ chế Two-way RPC & Settings Sync
    tb_client = ThingsBoardClient(
        host=TB_HOST,
        port=TB_PORT,
        token=TB_TOKEN,
        device_id=DEVICE_ID,
        initial_mode=current_mode,
        on_mode_change=on_mode_change,
        on_attendance_result=None,
        initial_volume=current_volume,
        initial_show_fps=current_show_fps,
        initial_stream_enabled=current_stream_enabled,
        initial_max_faces=current_max_faces,
        on_settings_change=on_settings_change,
        on_action_request=on_action_request,
    )

    # 2. Khởi tạo Pipeline AI: Detector + Tracker + AntiSpoof + Embedder
    print("[AI] Đang nạp các mô hình ONNX...")
    detector = create_detector(APP_DETECTOR, input_size=(WIDTH, HEIGHT))
    print(f"  [OK] Face Detector : {APP_DETECTOR.upper()}")

    tracker = FaceTracker(
        recognize_interval_seconds=RECOGNIZE_INTERVAL_SECONDS,
        iou_threshold=TRACK_IOU_THRESHOLD,
        max_missing_frames=TRACK_MAX_MISSING_FRAMES,
        pad_smooth_window=vision.PAD_SMOOTH_WINDOW,
        pad_spoof_min_ratio=vision.PAD_SPOOF_MIN_RATIO,
        pad_interval_seconds=PAD_INTERVAL_SECONDS,
        pad_min_votes=REQUIRED_CONSECUTIVE,
        pad_stale_timeout=vision.PAD_STALE_TIMEOUT_SECONDS,
    )
    print("  [OK] Face Tracker  : IOU Matching + LK Optical Flow Cadence")

    if not vision.PAD_ENABLED:
        raise ValueError("Hardware điểm danh yêu cầu PAD_ENABLED=true")
    fas_predictor = AntiSpoofPredictor()
    print("  [OK] Anti-Spoofing : MiniFASNet R7 (~1.7 MB)")

    recognition_backend = get_env_str("RECOGNITION_BACKEND", "local").lower()
    if recognition_backend == "server":
        embedder = RemoteFaceEmbedder(
            get_env_str("BACKEND_BASE_URL", ""), DEVICE_ID,
            get_env_str("EDGE_RECOGNITION_TOKEN", ""),
            get_env_str("REMOTE_ARCFACE_SHA256", ARCFACE_SHA256),
            get_env_str("EMBEDDING_MODEL_VERSION", "buffalo_s"),
            get_env_float("REMOTE_RECOGNITION_TIMEOUT_SECONDS", 3.0),
        )
        print("  [OK] Face Embedder : SERVER (ArcFace is not loaded on Pi)")
    elif recognition_backend == "local":
        embedder = FaceEmbedder(intra_op_threads=vision.RECOGNITION_INTRA_OP_THREADS)
        print("  [OK] Face Embedder : LOCAL ArcFace MobileFaceNet (~13 MB)")
    else:
        raise ValueError("RECOGNITION_BACKEND must be local or server")

    # 3. Mở Camera (chỉ mở khi camera đang được bật; có thể tắt/bật lại từ xa)
    def open_camera():
        camera = cv2.VideoCapture(CAM_INDEX)
        if not camera.isOpened():
            camera.release()
            return None
        if vision.CAMERA_BUFFER_SIZE > 0:
            camera.set(cv2.CAP_PROP_BUFFERSIZE, vision.CAMERA_BUFFER_SIZE)
        if vision.CAMERA_FORCE_RESOLUTION:
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
        camera.set(cv2.CAP_PROP_FPS, FPS)
        return camera

    cap = None
    if current_stream_enabled:
        cap = open_camera()
        if cap is None:
            print(f"[ERROR] Không thể mở Camera tại index {CAM_INDEX}!")
            tb_client.stop()
            sys.exit(1)
    else:
        print("[CAMERA] Camera đang TẮT (camera_enabled=False); không mở phần cứng camera.")

    camera_off_frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    cv2.putText(camera_off_frame, "CAMERA OFF", (max(10, WIDTH // 2 - 120), HEIGHT // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (180, 180, 180), 2, cv2.LINE_AA)

    # 4. Khởi tạo Live Streamer (RTSP -> MediaMTX)
    streamer = RTSPStreamer(RTSP_URL, WIDTH, HEIGHT, FPS, enabled=STREAM_ENABLED)

    # 5. Khởi tạo Màn hình phần cứng TFT ST7789V SPI
    tft_display = TFTDisplay(
        enabled=TFT_ENABLED,
        width=TFT_WIDTH,
        height=TFT_HEIGHT,
        rotate=TFT_ROTATE,
        spi_mhz=TFT_SPI_MHZ,
        dc_pin=TFT_DC_PIN,
        reset_pin=TFT_RESET_PIN,
        bgr=TFT_BGR,
        invert=TFT_INVERT,
        max_fps=TFT_DISPLAY_FPS,
    )

    # 6. Khởi tạo 2 Cảm biến siêu âm (Sensor 1: CHECK_IN, Sensor 2: CHECK_OUT)
    ultrasonic_checkin = UltrasonicSensor(
        enabled=ULTRASONIC_ENABLED,
        trig_pin=ULTRASONIC_CHECKIN_TRIG_PIN,
        echo_pin=ULTRASONIC_CHECKIN_ECHO_PIN,
        max_distance=ULTRASONIC_MAX_DISTANCE,
        trigger_distance=ULTRASONIC_TRIGGER_DISTANCE,
        debounce_duration=ULTRASONIC_DEBOUNCE_SECONDS,
        name="ULTRASONIC_CHECKIN",
    )
    ultrasonic_checkout = UltrasonicSensor(
        enabled=ULTRASONIC_ENABLED,
        trig_pin=ULTRASONIC_CHECKOUT_TRIG_PIN,
        echo_pin=ULTRASONIC_CHECKOUT_ECHO_PIN,
        max_distance=ULTRASONIC_MAX_DISTANCE,
        trigger_distance=ULTRASONIC_TRIGGER_DISTANCE,
        debounce_duration=ULTRASONIC_DEBOUNCE_SECONDS,
        name="ULTRASONIC_CHECKOUT",
    )
    ultrasonic_checkin.start()
    ultrasonic_checkout.start()

    last_hb_time = time.time()
    last_detection_time = None
    fps_counter = 0
    current_fps = 0.0

    status_banner = ""
    status_banner_time = 0.0

    # Trạng thái máy hữu hạn Wake-on-Presence & Chọn Chế Độ Cảm Biến Đôi
    is_awake = current_mode in ("CHECK_IN", "CHECK_OUT")
    last_sensor_mode = "OFF"
    attendance_latch = False
    last_mode_generation = mode_generation
    presence_generation = 0
    last_submission = None
    camera_failures = 0
    last_face_seen_time = 0.0
    last_active_track_id = None
    last_telemetry_time = 0.0
    last_hw_telemetry_time = 0.0
    frame_id = 0
    last_submission_embedding = None
    previous_recognition_tracks = {}

    def _evaluate_ultrasonic_mode():
        nonlocal last_sensor_mode
        d_in = ultrasonic_checkin.get_distance() if ULTRASONIC_ENABLED else None
        d_out = ultrasonic_checkout.get_distance() if ULTRASONIC_ENABLED else None
        in_trig = ultrasonic_checkin.is_person_present() if ULTRASONIC_ENABLED else False
        out_trig = ultrasonic_checkout.is_person_present() if ULTRASONIC_ENABLED else False

        if ULTRASONIC_ENABLED:
            if in_trig and out_trig:
                s_mode = "CHECK_IN" if (d_in or 999.0) <= (d_out or 999.0) else "CHECK_OUT"
            elif in_trig:
                s_mode = "CHECK_IN"
            elif out_trig:
                s_mode = "CHECK_OUT"
            else:
                s_mode = "OFF"

            if s_mode in ("CHECK_IN", "CHECK_OUT"):
                if current_mode != s_mode:
                    d_active = d_in if s_mode == "CHECK_IN" else d_out
                    print(f"[SENSOR] 🖐️ Cảm biến {s_mode} kích hoạt ổn định (d = {d_active}cm <= {ULTRASONIC_TRIGGER_DISTANCE}cm trong >= {ULTRASONIC_DEBOUNCE_SECONDS}s) -> BẬT {s_mode}!")
                    tb_client.set_mode(s_mode)
            elif last_sensor_mode in ("CHECK_IN", "CHECK_OUT") and s_mode == "OFF":
                if current_mode != "OFF":
                    print(f"[SENSOR] 💤 Đã rút tay khỏi cảm biến {last_sensor_mode} ổn định (trong >= {ULTRASONIC_DEBOUNCE_SECONDS}s) -> TẮT chế độ điểm danh (OFF)!")
                    tb_client.set_mode("OFF")

            last_sensor_mode = s_mode

        return d_in, d_out, in_trig, out_trig

    recognition_worker = RecognitionWorker(embedder, queue_size=vision.RECOGNITION_QUEUE_SIZE)
    identity_cache = IdentityCache(vision.RECOGNITION_CACHE_TTL_SECONDS,
                                   max(vision.MATCH_THRESHOLD, vision.RECOGNITION_CACHE_THRESHOLD))
    try:
        tb_client.start()
        print("\n[RUNNING] Hệ thống đang chạy. Nhấn Ctrl+C để dừng.\n")
        while True:
            if mode_generation != last_mode_generation:
                attendance_latch = False
                last_submission = None
                last_mode_generation = mode_generation

            # ── 0. Bật/Tắt camera phần cứng từ xa (camera_enabled) ───────────
            if not current_stream_enabled:
                _evaluate_ultrasonic_mode()
                if cap is not None:
                    cap.release()
                    cap = None
                    print('[CAMERA] Đã TẮT camera phần cứng (ngừng lấy frame).')
                    for track in previous_recognition_tracks.values():
                        if getattr(track, 'recognition_eligible', False):
                            track.verification_generation += 1
                            track.invalidate_recognition()
                            track.recognition_eligible = False
                    previous_recognition_tracks = {}
                    attendance_latch = False
                    last_submission = None
                    recognition_worker.retain(set())
                    camera_failures = 0
                    tb_client.send_telemetry({'ai_state': 'CAMERA_OFF', 'fps': 0.0, 'status': 'ONLINE',
                                              'stream_enabled': False})
                recognition_worker.poll()
                now_idle = time.time()
                if now_idle - last_hw_telemetry_time >= 10.0:
                    tb_client.send_telemetry(get_hardware_telemetry({
                        'volume': current_volume,
                        'is_muted': current_is_muted,
                        'show_fps': current_show_fps,
                        'stream_enabled': False,
                        'max_faces': current_max_faces,
                    }))
                    last_hw_telemetry_time = now_idle
                if now_idle - last_telemetry_time >= 5.0:
                    tb_client.send_telemetry({'ai_state': 'CAMERA_OFF', 'fps': 0.0, 'status': 'ONLINE'})
                    last_telemetry_time = now_idle
                if tft_display.wants_frame():
                    tft_display.show_frame(camera_off_frame)
                time.sleep(0.2)
                continue
            if cap is None:
                cap = open_camera()
                if cap is None:
                    camera_failures += 1
                    if camera_failures == 1:
                        print('[CAMERA] Không thể mở lại camera; sẽ thử lại.')
                        tb_client.send_telemetry({'ai_state': 'CAMERA_ERROR', 'status': 'DEGRADED'})
                    time.sleep(1.0)
                    continue
                camera_failures = 0
                print('[CAMERA] Đã BẬT lại camera phần cứng.')

            ret, frame = cap.read()
            if not ret:
                camera_failures += 1
                for track in previous_recognition_tracks.values():
                    if getattr(track, 'recognition_eligible', False):
                        track.verification_generation += 1
                        track.invalidate_recognition()
                        track.recognition_eligible = False
                previous_recognition_tracks = {}
                attendance_latch = False
                last_submission = None
                recognition_worker.retain(set())
                recognition_worker.poll()
                if camera_failures == 1:
                    print('[CAMERA] Không đọc được hình; tạm dừng nhận diện.')
                    tb_client.send_telemetry({'ai_state': 'CAMERA_ERROR', 'status': 'DEGRADED'})
                if camera_failures >= 100:
                    raise RuntimeError('Camera không trả hình sau 100 lần đọc; cần kiểm tra camera hoặc khởi động lại service.')
                time.sleep(0.05)
                continue
            camera_failures = 0

            frame_id += 1
            fps_counter += 1
            now_wall = time.time()
            now_mono = time.monotonic()
            tft_due = tft_display.wants_frame()
            render_output = SHOW_GUI or current_stream_enabled or tft_due

            # Heartbeat định kỳ 10 giây một lần gửi lên ThingsBoard
            if now_wall - last_hb_time >= 10.0:
                current_fps = fps_counter / (now_wall - last_hb_time)
                fps_counter = 0
                last_hb_time = now_wall
                if current_show_fps:
                    print(f"[FPS] {current_fps:.1f} (average over 10s)")

            # ── 4.1. Đánh giá 2 Cảm biến Siêu âm (CHECK_IN & CHECK_OUT <= 20cm) ──
            dist_in, dist_out, in_present, out_present = _evaluate_ultrasonic_mode()

            person_present = in_present or out_present
            was_awake = is_awake
            is_awake = current_mode in ("CHECK_IN", "CHECK_OUT")
            if was_awake and not is_awake:
                attendance_latch = False
                last_submission = None
                presence_generation += 1
                last_active_track_id = None

            # Cơ chế Hybrid Reset: Khi đang thức và đã khóa chốt, nếu mất mặt cũ trong FACE_LOST_RESET_SECONDS
            if is_awake and attendance_latch:
                if (now_wall - last_face_seen_time) >= FACE_LOST_RESET_SECONDS:
                    attendance_latch = False
                    last_submission = None
                    presence_generation += 1
                    last_active_track_id = None
                    print(f"[EDGE] 🔄 Reset chốt điểm danh (Không thấy mặt cũ trong {FACE_LOST_RESET_SECONDS}s) -> Sẵn sàng đón người tiếp theo!")

            # ── 4.2. Đồng bộ Telemetry Cảm biến lên ThingsBoard Dashboard (mỗi 1.0s) ──
            if now_wall - last_telemetry_time >= 1.0:
                calc_fps = current_fps if current_fps > 0 else (fps_counter / max(0.1, (now_wall - last_hb_time)))
                tb_client.send_telemetry({
                    "fps": round(calc_fps, 1),
                    "distance": round(dist_in, 1) if dist_in is not None else -1.0,
                    "distance_checkin": round(dist_in, 1) if dist_in is not None else -1.0,
                    "distance_checkout": round(dist_out, 1) if dist_out is not None else -1.0,
                    "person_present": person_present,
                    "checkin_active": current_mode == "CHECK_IN",
                    "checkout_active": current_mode == "CHECK_OUT",
                    "ai_state": "AWAKE" if is_awake else "SLEEP",
                    "attendance_latch": "LOCKED" if attendance_latch else "READY",
                    "current_mode": current_mode,
                    "mode": current_mode,
                    "status": "ONLINE",
                })
                last_telemetry_time = now_wall

            # ── 4.3. Đồng bộ Sức Khỏe Phần Cứng Pi 4 & Ngoại Vi (mỗi 10s non-blocking) ──
            if now_wall - last_hw_telemetry_time >= 10.0:
                hw_telemetry = get_hardware_telemetry({
                    "volume": current_volume,
                    "is_muted": current_is_muted,
                    "show_fps": current_show_fps,
                    "stream_enabled": current_stream_enabled,
                    "max_faces": current_max_faces,
                })
                tb_client.send_telemetry(hw_telemetry)
                last_hw_telemetry_time = now_wall

            # ── 5. Detection Cadence + Tracking Stage (Chỉ chạy khi THỨC) ─────
            tracked = []
            recognition_eligible = {}
            if not is_awake:
                for track in previous_recognition_tracks.values():
                    if getattr(track, 'recognition_eligible', False):
                        track.verification_generation += 1
                        track.invalidate_recognition()
                        track.recognition_eligible = False
                previous_recognition_tracks = {}
                # Trạng thái AI NGỦ: Không tốn CPU cho ONNX, chỉ hiển thị thông báo chờ
                if render_output:
                    cv2.putText(
                        frame,
                        "SLEEP",
                        (20, HEIGHT // 2),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (0, 255, 255),
                        2,
                        cv2.LINE_AA,
                    )
            else:
                # Trạng thái AI THỨC: Chạy SCRFD theo chu kỳ và optical flow ở giữa
                detector_due = (
                    last_detection_time is None
                    or DETECTION_INTERVAL_SECONDS <= 0
                    or (now_mono - last_detection_time) >= DETECTION_INTERVAL_SECONDS
                    or tracker.needs_redetection()
                )

                if not detector_due:
                    tracked = tracker.update([], frame=frame, detector_called=False)
                else:
                    try:
                        detections = limit_faces(detector.detect(frame))
                    except Exception as e:
                        print(f"[Detector Error] {e}")
                        detections = []
                    last_detection_time = now_mono
                    tracked = tracker.update(detections, frame=frame, detector_called=True)

                # Giới hạn số lượng track được xử lý
                selected_ids = {id(d) for d in limit_faces([d for d, _ in tracked])}
                tracked = [(d, t) for d, t in tracked if id(d) in selected_ids]

                # Cập nhật thời điểm nhìn thấy mặt và kiểm tra đổi người (Track ID mới)
                if len(tracked) > 0:
                    last_face_seen_time = now_wall
                    current_track_id = tracked[0][1].track_id
                    if attendance_latch and last_active_track_id is not None and current_track_id != last_active_track_id:
                        attendance_latch = False
                        last_submission = None
                        presence_generation += 1
                        print(f"[EDGE] 🔄 Phát hiện khuôn mặt mới (Track #{current_track_id} thay cho #{last_active_track_id}) -> Mở chốt điểm danh!")
                    last_active_track_id = current_track_id

                update_track_pad(tracked, frame, fas_predictor, PAD_INTERVAL_SECONDS,
                                 frame_id, detector_due, vision.PAD_DIAGNOSTIC_LOG,
                                 crop_smoothing=vision.PAD_CROP_SMOOTHING)
                # Match face_auth: loss of PAD/track eligibility invalidates the
                # recognition session, without erasing the SPOOF vote window.
                visible_tracks = {track.track_id: track for _, track in tracked}
                all_tracks = {**previous_recognition_tracks, **visible_tracks}
                for track_id, track in all_tracks.items():
                    eligible = (track_id in visible_tracks and track.missing_frames == 0 and track.pad_ready and track.is_real
                                and not track.is_spoof and not track.pad_invalid_reason)
                    if eligible:
                        track.recognition_eligible = True
                    elif getattr(track, 'recognition_eligible', False):
                        track.verification_generation += 1
                        track.invalidate_recognition()
                        track.stable_recognitions = 0
                        track.recognition_eligible = False
                previous_recognition_tracks = visible_tracks
                inference_frame = frame
                if render_output:
                    frame = frame.copy()  # Never draw on model input.
                if last_submission is not None and attendance_latch:
                    same_session = any(track.track_id == last_submission[0]
                                       and track.verification_generation == last_submission[5]
                                       for _, track in tracked)
                    if not same_session:
                        attendance_latch = False
                        last_submission = None
                frame_mode = (current_mode, mode_generation, presence_generation)

                # ── 6. Xử lý từng Track (Anti-Spoofing & Biometric Extraction) ───
                for detection, track in tracked:
                    bbox = track.bbox
                    landmarks = track.landmarks
                    x1, y1, x2, y2 = [int(v) for v in bbox]

                    # (B) Đánh giá trạng thái PAD đa frame
                    if track.pad_ready and track.is_spoof:
                        if not getattr(track, 'spoof_reported', False):
                            track.spoof_reported = tb_client.send_spoof_event(liveness_score(track.last_pad_score, track.last_pad_threshold), current_mode)
                    elif track.pad_ready:
                        # Người thật (REAL)

                        # (C) Camera owns tracks; ArcFace runs only on the worker.
                        scope = (track.verification_generation, *frame_mode)
                        if getattr(track, 'scan_scope', None) != scope:
                            track.scan_scope = scope
                            track.last_scan_sent = 0.0
                            track.scan_event_id = uuid.uuid4().hex
                            track.scan_captured_at = None
                            track.last_recognition_time = None
                            track.stable_recognitions = 0
                            track.employee_id = None
                        key = (track.track_id, *scope)
                        if (track.track_id == last_active_track_id and not attendance_latch
                                and track.missing_frames == 0 and track.last_pad_score is not None
                                and not track.pad_invalid_reason):
                            recognition_eligible[key] = track
                            if (key not in recognition_worker.pending
                                  and now_wall - track.last_scan_sent >= COOLDOWN_SEC
                                  and track.needs_recognition(RECOGNIZE_INTERVAL_SECONDS, pad_enabled=True)):
                                track.last_recognition_time = now_mono
                                if landmarks is None or len(landmarks) != 5:
                                    last_detection_time = None
                                else:
                                    try:
                                        aligned_face = get_input_face(inference_frame, bbox, landmarks, embedder.input_size)
                                        if aligned_face is None:
                                            raise ValueError("Alignment failed")
                                        captured_at = track.scan_captured_at or int(now_wall * 1000)
                                        context = (track.scan_event_id, captured_at, liveness_score(track.last_pad_score, track.last_pad_threshold))
                                        recognition_worker.submit(key, aligned_face, context)
                                    except Exception:
                                        track.stable_recognitions = 0
                                        track.scan_event_id = uuid.uuid4().hex
                                        track.scan_captured_at = None

                    # Vẽ Bounding Box & Nhãn Track lên khung hình
                    if render_output:
                        status_label, color = face_status_label(track)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(
                            frame,
                            status_label,
                            (x1, max(18, y1 - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.52,
                            color,
                            2,
                            cv2.LINE_AA
                        )

            # Discard jobs as soon as PAD/track/presence continuity is lost.
            # Cancelled jobs still count towards queue capacity until consumed.
            recognition_worker.retain(set(recognition_eligible))
            for result in recognition_worker.poll():
                track = recognition_eligible.get(result.key)
                if (track is None or result.key[2:] != (current_mode, mode_generation, presence_generation)
                        or attendance_latch or not is_awake):
                    continue
                if result.error:
                    track.last_recognition_time = time.monotonic()
                    track.recognition_error = True
                    track.stable_recognitions = 0
                    track.scan_event_id = uuid.uuid4().hex
                    track.scan_captured_at = None
                    track.recognition_status = f"ERROR {result.error}"
                    status_banner = f"RECOGNITION ERROR: {result.error}"
                    status_banner_time = now_wall
                    print(f"[Recognition] track={track.track_id} ERROR {result.error}")
                    continue
                cached = identity_cache.lookup(result.key, result.embedding)
                if cached is not None:
                    track.update_display_identity(cached, vision.RECOGNITION_LABEL_CONFIRMATIONS,
                                                  vision.RECOGNITION_LABEL_UNKNOWN_CONFIRMATIONS)
                    track.recognition_status = "CACHE (DISPLAY ONLY)"
                event_id, captured_at, pad_score = result.context
                expected_employee = getattr(track, 'employee_id', None)
                commit = (getattr(track, 'stable_recognitions', 0) >= vision.ATTENDANCE_STABLE_COUNT - 1
                          and bool(expected_employee))
                event_kind = 'CONFIRMED_SCAN' if commit else 'VERIFY_ONLY'
                submission = (track.track_id, result.key[2], event_id, result.key[3], result.key[4], result.key[1], event_kind)
                track.scan_captured_at = captured_at
                req_id = tb_client.send_scan_rpc(
                    result.embedding, pad_score, result.key[2],
                    on_result=lambda response, token=submission: result_queue.put((token, response)),
                    event_id=event_id, captured_at=captured_at,
                    event_kind=event_kind, recognition_id=uuid.uuid4().hex,
                    expected_employee_id=expected_employee if commit else None,
                )
                if req_id > 0:
                    last_submission = submission
                    last_submission_embedding = result.embedding.copy()
                    attendance_latch = True
                    track.attendance_sent = commit
                    track.last_scan_sent = now_wall
                    print(f"[Recognition] track={track.track_id} backend={recognition_backend} extraction={result.latency:.2f}s -> RPC {req_id}")
                elif not tb_client.connected:
                    status_banner = "TB MQTT DISCONNECTED"
                    status_banner_time = now_wall

            live_keys = {(track.track_id, track.verification_generation, current_mode, mode_generation, presence_generation)
                         for _, track in tracked if track.missing_frames == 0 and track.is_real and not track.pad_invalid_reason}
            identity_cache.retain(live_keys)
            while not result_queue.empty():
                submission, response = result_queue.get()
                if submission != last_submission or submission[1] != current_mode or submission[0] != last_active_track_id or submission[3] != mode_generation or submission[4] != presence_generation or not is_awake or now_wall - last_face_seen_time > FACE_LOST_RESET_SECONDS:
                    continue
                response_track = next((track for _, track in tracked
                                       if track.track_id == submission[0]
                                       and track.verification_generation == submission[5]
                                       and track.missing_frames == 0 and track.is_real
                                       and not track.pad_invalid_reason), None)
                if response_track is None:
                    continue
                if response.get('matched') and last_submission_embedding is not None:
                    employee = response.get('employee') or {}
                    identity = (employee.get('id') or employee.get('employee_code'),
                                employee.get('full_name') or employee.get('employee_code') or 'Nhân viên',
                                float(response.get('similarity', 0)))
                    key = (submission[0], submission[5], submission[1], submission[3], submission[4])
                    identity_cache.confirm(key, last_submission_embedding, identity)
                    response_track.update_result(*identity)
                    response_track.update_display_identity(identity, vision.RECOGNITION_LABEL_CONFIRMATIONS,
                                                           vision.RECOGNITION_LABEL_UNKNOWN_CONFIRMATIONS)
                    response_track.recognition_status = 'CLOUD'
                elif not response.get('matched'):
                    key = (submission[0], submission[5], submission[1], submission[3], submission[4])
                    identity_cache.entries.pop(key, None)
                    response_track.update_result(None, "UNKNOWN", float(response.get("similarity", 0)))
                    response_track.update_display_identity((None, 'UNKNOWN', 0.0),
                                                           vision.RECOGNITION_LABEL_CONFIRMATIONS,
                                                           vision.RECOGNITION_LABEL_UNKNOWN_CONFIRMATIONS)
                if response.get('verification_only') and response.get('matched') and response.get('success'):
                    count = max(0, int(response.get('confirmation_count', 0)))
                    response_track.stable_recognitions = count
                    attendance_latch = False
                    last_submission = None
                    response_track.last_scan_sent = 0.0
                    response_track.last_recognition_time = None
                    continue
                on_attendance_result(response)
                if not (response.get('success') and response.get('matched')):
                    attendance_latch = False
                    if not response.get('uncertain'):
                        last_submission = None

            # ── 7. Vẽ Thanh Thông Tin & Banners Lên Video ────────────────────
            # Compact status; telemetry still carries FPS/distance for diagnostics.
            if not is_awake or current_mode == "OFF":
                banner_bg = (50, 50, 50)  # Xám sẫm khi cả 2 cảm biến đều tắt (IDLE/SLEEP)
                banner_text = "IDLE (OFF) | DUA TAY VAO CAM BIEN (<20CM)"
            else:
                banner_bg = (180, 100, 0) if current_mode == "CHECK_IN" else (0, 100, 200)
                latch_str = "WAIT NEXT PERSON" if attendance_latch else "READY"
                banner_text = f"{current_mode} | {latch_str}"

            if render_output:
                cv2.rectangle(frame, (0, 0), (WIDTH, 36), banner_bg, -1)
                cv2.putText(
                    frame,
                    banner_text,
                    (10, 24),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA
                )
                if current_show_fps:
                    calc_fps = current_fps if current_fps > 0 else (fps_counter / max(0.1, (now_wall - last_hb_time)))
                    cv2.putText(
                        frame,
                        f"{calc_fps:.1f} FPS",
                        (WIDTH - 110, 24),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 255, 255),
                        2,
                        cv2.LINE_AA,
                    )

            # Bottom Banner: Thông báo điểm danh vừa gửi thành công
            if render_output and status_banner and (now_wall - status_banner_time < 3.0):
                cv2.rectangle(frame, (0, HEIGHT - 32), (WIDTH, HEIGHT), (0, 180, 0), -1)
                cv2.putText(
                    frame,
                    status_banner,
                    (15, HEIGHT - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA
                )

            if capture is not None:
                lbl_tag = f" [{capture.label}]" if capture.label else ""
                capture_text = f"C: Save sample{lbl_tag} | Captured: {capture.saved_count}"
                cv2.putText(frame, capture_text, (10, HEIGHT - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2, cv2.LINE_AA)

            # ── 8. Gửi Frame Vào Luồng RTSP Streamer ─────────────────────────
            streamer.write_frame(frame)

            # ── 9. Hiển thị lên Màn hình phần cứng TFT ST7789V ──────────────
            if tft_due:
                tft_display.show_frame(frame)

            # ── 10. Hiển thị GUI nếu được bật ───────────────────────────────
            if SHOW_GUI:
                try:
                    cv2.imshow("SmartFace Pi Edge", frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        break
                    elif key == ord('m'):
                        tb_client.set_mode("CHECK_OUT" if current_mode == "CHECK_IN" else "CHECK_IN")
                        print(f"[KEYBOARD] Đã chuyển mode: {current_mode}")
                    elif (key == ord('c') or key == ord('C')) and capture is not None:
                        try:
                            paths = capture.save(frame, tracked, fas_predictor)
                            if paths:
                                print(f"[Capture] +{len(paths)} mặt mới -> Tổng số ảnh đã chụp: {capture.saved_count} ({capture.directory})")
                            else:
                                print("[Capture] Không phát hiện khuôn mặt để chụp!")
                        except Exception as exc:
                            print(f"[Capture Error] {exc}")
                except Exception:
                    pass

    except KeyboardInterrupt:
        print("\n[STOP] Đang dừng Pi Edge Client...")
    finally:
        stopped = recognition_worker.close()
        print(f"[Recognition worker] stopped={stopped}")
        if cap is not None:
            cap.release()
        if SHOW_GUI:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass
        ultrasonic_checkin.stop()
        ultrasonic_checkout.stop()
        if tft_display.cleanup() is False:
            print("[TFT] Worker còn chờ SPI; sẽ tự đóng tài nguyên khi driver trả về.")
        streamer.stop()
        try:
            tb_client.send_telemetry({"status": "OFFLINE", "ai_state": "OFFLINE", "fps": 0.0})
        except Exception:
            pass
        tb_client.stop()
        print("[EXIT] Pi Edge Client đã tắt an toàn.")


if __name__ == "__main__":
    main()
