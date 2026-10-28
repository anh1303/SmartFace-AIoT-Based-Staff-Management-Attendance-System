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
INITIAL_MODE = get_env_str("INITIAL_MODE", "CHECK_IN")

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

# Cấu hình Cảm biến siêu âm Wake-on-Presence (Tiết kiệm CPU & Chống Spam)
ULTRASONIC_ENABLED = get_env_bool("ULTRASONIC_ENABLED", True)
ULTRASONIC_TRIG_PIN = get_env_int("ULTRASONIC_TRIG_PIN", 23)
ULTRASONIC_ECHO_PIN = get_env_int("ULTRASONIC_ECHO_PIN", 27)
ULTRASONIC_TRIGGER_DISTANCE = get_env_float("ULTRASONIC_TRIGGER_DISTANCE", 50.0)
ULTRASONIC_MAX_DISTANCE = get_env_float("ULTRASONIC_MAX_DISTANCE", 100.0)
ULTRASONIC_SLEEP_DELAY = get_env_float("ULTRASONIC_SLEEP_DELAY", 5.0)
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
from peripherals import UltrasonicSensor

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
    print(f"  Ultrasonic Sensor: {'BẬT (TRIG=' + str(ULTRASONIC_TRIG_PIN) + ', ECHO=' + str(ULTRASONIC_ECHO_PIN) + ', Ngưỡng=' + str(ULTRASONIC_TRIGGER_DISTANCE) + 'cm)' if ULTRASONIC_ENABLED else 'TẮT'}")
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

    # 1. Khởi động kết nối MQTT ThingsBoard với cơ chế Two-way RPC
    tb_client = ThingsBoardClient(
        host=TB_HOST,
        port=TB_PORT,
        token=TB_TOKEN,
        device_id=DEVICE_ID,
        initial_mode=current_mode,
        on_mode_change=on_mode_change,
        on_attendance_result=None,
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

    # 3. Mở Camera
    cap = cv2.VideoCapture(CAM_INDEX)
    if not cap.isOpened():
        print(f"[ERROR] Không thể mở Camera tại index {CAM_INDEX}!")
        tb_client.stop()
        sys.exit(1)

    if vision.CAMERA_BUFFER_SIZE > 0:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, vision.CAMERA_BUFFER_SIZE)
    if vision.CAMERA_FORCE_RESOLUTION:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, FPS)

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

    # 6. Khởi tạo Cảm biến siêu âm Wake-on-Presence
    ultrasonic = UltrasonicSensor(
        enabled=ULTRASONIC_ENABLED,
        trig_pin=ULTRASONIC_TRIG_PIN,
        echo_pin=ULTRASONIC_ECHO_PIN,
        max_distance=ULTRASONIC_MAX_DISTANCE,
        trigger_distance=ULTRASONIC_TRIGGER_DISTANCE,
    )
    ultrasonic.start()

    last_hb_time = time.time()
    last_detection_time = None
    fps_counter = 0
    current_fps = 0.0

    status_banner = ""
    status_banner_time = 0.0

    # Trạng thái máy hữu hạn Wake-on-Presence & Chống Spam Latch
    is_awake = not ULTRASONIC_ENABLED
    last_present_time = time.time() if not ULTRASONIC_ENABLED else 0.0
    attendance_latch = False
    last_mode_generation = mode_generation
    presence_generation = 0
    last_submission = None
    camera_failures = 0
    last_face_seen_time = 0.0
    last_active_track_id = None
    last_telemetry_time = 0.0
    frame_id = 0
    last_submission_embedding = None
    previous_recognition_tracks = {}

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
            render_output = SHOW_GUI or STREAM_ENABLED or tft_due

            # Heartbeat định kỳ 10 giây một lần gửi lên ThingsBoard
            if now_wall - last_hb_time >= 10.0:
                current_fps = fps_counter / (now_wall - last_hb_time)
                fps_counter = 0
                last_hb_time = now_wall
                if vision.SHOW_FPS:
                    print(f"[FPS] {current_fps:.1f} (average over 10s)")

            # ── 4.1. Đánh giá Trạng thái Siêu âm (Wake-on-Presence) ───────────
            dist = ultrasonic.get_distance() if ULTRASONIC_ENABLED else None
            person_present = ultrasonic.is_person_present() if ULTRASONIC_ENABLED else True

            if person_present:
                if not is_awake:
                    print(f"[EDGE] ⚡ PHÁT HIỆN NGƯỜI (d = {dist}cm <= {ULTRASONIC_TRIGGER_DISTANCE}cm) -> AI THỨC DẬY!")
                is_awake = True
                last_present_time = now_wall
            else:
                if ULTRASONIC_ENABLED:
                    if is_awake and (now_wall - last_present_time >= ULTRASONIC_SLEEP_DELAY):
                        print(f"[EDGE] 💤 Không có người trong {ULTRASONIC_SLEEP_DELAY}s (Khoảng cách: {dist}cm) -> AI CHUYỂN SANG NGỦ!")
                        is_awake = False
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
                    "distance": round(dist, 1) if dist is not None else -1.0,
                    "person_present": person_present,
                    "ai_state": "AWAKE" if is_awake else "SLEEP",
                    "attendance_latch": "LOCKED" if attendance_latch else "READY",
                    "current_mode": current_mode,
                    "mode": current_mode,
                    "status": "ONLINE",
                })
                last_telemetry_time = now_wall

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
                    continue
                on_attendance_result(response)
                if not (response.get('success') and response.get('matched')):
                    attendance_latch = False
                    if not response.get('uncertain'):
                        last_submission = None

            # ── 7. Vẽ Thanh Thông Tin & Banners Lên Video ────────────────────
            # Compact status; telemetry still carries FPS/distance for diagnostics.
            if not is_awake:
                banner_bg = (50, 50, 50)  # Xám sẫm khi AI đang ngủ
                banner_text = f"{current_mode} | SLEEP"
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
        cap.release()
        if SHOW_GUI:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass
        ultrasonic.stop()
        if tft_display.cleanup() is False:
            print("[TFT] Worker còn chờ SPI; sẽ tự đóng tài nguyên khi driver trả về.")
        streamer.stop()
        tb_client.stop()
        print("[EXIT] Pi Edge Client đã tắt an toàn.")


if __name__ == "__main__":
    main()
