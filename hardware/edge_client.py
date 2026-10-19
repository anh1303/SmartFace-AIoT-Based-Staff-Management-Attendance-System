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
FPS = get_env_int("CAMERA_FPS", 15)

# Cấu hình AI & Tracking
APP_DETECTOR = get_env_str("APP_DETECTOR", "scrfd").lower()
FAS_LOGIT_THRESHOLD = get_env_float("FAS_LOGIT_THRESHOLD", -4.2998)
REQUIRED_CONSECUTIVE = get_env_int("CONSECUTIVE_REAL_FRAMES", 3)
COOLDOWN_SEC = get_env_float("SCAN_COOLDOWN_SECONDS", 5.0)

# Detection Cadence: chạy detector mỗi N giây; các frame ở giữa dùng optical flow tiết kiệm CPU Pi
DETECTION_INTERVAL_SECONDS = get_env_float("DETECTION_INTERVAL_SECONDS", 0.2)
TRACK_IOU_THRESHOLD = get_env_float("TRACK_IOU_THRESHOLD", 0.3)
TRACK_MAX_MISSING_FRAMES = get_env_int("TRACK_MAX_MISSING_FRAMES", 10)
MAX_FACES_PER_FRAME = get_env_int("MAX_FACES_PER_FRAME", 1)

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
TFT_DISPLAY_FPS = get_env_float("TFT_DISPLAY_FPS", 15.0)

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
from iot import ThingsBoardClient
from streaming import RTSPStreamer
from display import TFTDisplay
from peripherals import UltrasonicSensor

# Trạng thái toàn cục
current_mode = INITIAL_MODE


def on_mode_change(new_mode: str):
    global current_mode
    current_mode = new_mode
    print(f"\n[MODE SWITCH] Nhận lệnh từ ThingsBoard: Đổi sang {current_mode}!\n")


def main():
    global current_mode

    print("\n=======================================================")
    print("      SMARTFACE AIoT — RASPBERRY PI 4 EDGE CLIENT     ")
    print("=======================================================")
    print(f"  Device ID        : {DEVICE_ID}")
    print(f"  Initial Mode     : {current_mode}")
    print(f"  TB Host          : {TB_HOST}:{TB_PORT}")
    print(f"  RTSP URL         : {RTSP_URL} (Stream Enabled: {STREAM_ENABLED})")
    print(f"  Detector Backend : {APP_DETECTOR.upper()}")
    print(f"  Detection Cadence: Mỗi {DETECTION_INTERVAL_SECONDS}s (Optical Flow ở giữa)")
    print(f"  Tracking Config  : IOU={TRACK_IOU_THRESHOLD}, MaxMissing={TRACK_MAX_MISSING_FRAMES}")
    print(f"  Anti-Spoofing    : Ngưỡng logit={FAS_LOGIT_THRESHOLD}, Cần {REQUIRED_CONSECUTIVE} votes Real")
    print(f"  Max Faces/Frame  : {MAX_FACES_PER_FRAME if MAX_FACES_PER_FRAME > 0 else 'KHÔNG GIỚI HẠN (All faces)'}")
    print(f"  Cooldown         : {COOLDOWN_SEC}s mỗi Track")
    print(f"  TFT ST7789V SPI  : {'BẬT (320x240)' if TFT_ENABLED else 'TẮT'}")
    print(f"  Ultrasonic Sensor: {'BẬT (TRIG=' + str(ULTRASONIC_TRIG_PIN) + ', ECHO=' + str(ULTRASONIC_ECHO_PIN) + ', Ngưỡng=' + str(ULTRASONIC_TRIGGER_DISTANCE) + 'cm)' if ULTRASONIC_ENABLED else 'TẮT'}")
    print("=======================================================\n")

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
            status_banner = f"{emp_name} - {mode} THÀNH CÔNG ({sim:.2f})"
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
        on_attendance_result=on_attendance_result,
    )
    tb_client.start()

    # 2. Khởi tạo Pipeline AI: Detector + Tracker + AntiSpoof + Embedder
    print("[AI] Đang nạp các mô hình ONNX...")
    detector = create_detector(APP_DETECTOR, input_size=(WIDTH, HEIGHT))
    print(f"  [OK] Face Detector : {APP_DETECTOR.upper()}")

    tracker = FaceTracker(
        recognize_interval_seconds=1.0,
        iou_threshold=TRACK_IOU_THRESHOLD,
        max_missing_frames=TRACK_MAX_MISSING_FRAMES,
        pad_smooth_window=5,
        pad_spoof_min_ratio=0.6,
        pad_interval_seconds=0.2,
        pad_min_votes=REQUIRED_CONSECUTIVE,
        pad_stale_timeout=3.0,
    )
    print("  [OK] Face Tracker  : IOU Matching + LK Optical Flow Cadence")

    fas_predictor = AntiSpoofPredictor(threshold_logit=FAS_LOGIT_THRESHOLD)
    print("  [OK] Anti-Spoofing : MiniFASNet R7 (~1.7 MB)")

    embedder = FaceEmbedder()
    print("  [OK] Face Embedder : ArcFace MobileFaceNet (~13 MB)")

    # 3. Mở Camera
    cap = cv2.VideoCapture(CAM_INDEX)
    if not cap.isOpened():
        print(f"[ERROR] Không thể mở Camera tại index {CAM_INDEX}!")
        tb_client.stop()
        sys.exit(1)

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
    last_face_seen_time = 0.0
    last_active_track_id = None
    last_telemetry_time = 0.0

    print("\n[RUNNING] Hệ thống đang chạy. Nhấn Ctrl+C để dừng.\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            fps_counter += 1
            now_wall = time.time()
            now_mono = time.monotonic()

            # Heartbeat định kỳ 10 giây một lần gửi lên ThingsBoard
            if now_wall - last_hb_time >= 10.0:
                current_fps = fps_counter / (now_wall - last_hb_time)
                fps_counter = 0
                last_hb_time = now_wall

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
                        last_active_track_id = None

            # Cơ chế Hybrid Reset: Khi đang thức và đã khóa chốt, nếu mất mặt cũ trong FACE_LOST_RESET_SECONDS
            if is_awake and attendance_latch:
                if (now_wall - last_face_seen_time) >= FACE_LOST_RESET_SECONDS:
                    attendance_latch = False
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
            if not is_awake:
                # Trạng thái AI NGỦ: Không tốn CPU cho ONNX, chỉ hiển thị thông báo chờ
                sleep_text = f"AI: SLEEP (CHO NGUOI <= {int(ULTRASONIC_TRIGGER_DISTANCE)}cm)"
                if dist is not None:
                    sleep_text += f" | d: {dist:.0f}cm"
                cv2.putText(
                    frame,
                    sleep_text,
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
                        detections = detector.detect(frame)
                        # Ưu tiên các khuôn mặt có diện tích lớn nhất (gần camera nhất)
                        if MAX_FACES_PER_FRAME > 0 and len(detections) > MAX_FACES_PER_FRAME:
                            detections.sort(
                                key=lambda d: (d["bbox"][2] - d["bbox"][0]) * (d["bbox"][3] - d["bbox"][1]),
                                reverse=True,
                            )
                            detections = detections[:MAX_FACES_PER_FRAME]
                    except Exception as e:
                        print(f"[Detector Error] {e}")
                        detections = []
                    last_detection_time = now_mono
                    tracked = tracker.update(detections, frame=frame, detector_called=True)

                # Giới hạn số lượng track được xử lý
                if MAX_FACES_PER_FRAME > 0 and len(tracked) > MAX_FACES_PER_FRAME:
                    tracked.sort(
                        key=lambda item: (item[1].bbox[2] - item[1].bbox[0]) * (item[1].bbox[3] - item[1].bbox[1]),
                        reverse=True,
                    )
                    tracked = tracked[:MAX_FACES_PER_FRAME]

                # Cập nhật thời điểm nhìn thấy mặt và kiểm tra đổi người (Track ID mới)
                if len(tracked) > 0:
                    last_face_seen_time = now_wall
                    current_track_id = tracked[0][1].track_id
                    if attendance_latch and last_active_track_id is not None and current_track_id != last_active_track_id:
                        attendance_latch = False
                        print(f"[EDGE] 🔄 Phát hiện khuôn mặt mới (Track #{current_track_id} thay cho #{last_active_track_id}) -> Mở chốt điểm danh!")
                    last_active_track_id = current_track_id

                # ── 6. Xử lý từng Track (Anti-Spoofing & Biometric Extraction) ───
                for detection, track in tracked:
                    bbox = track.bbox
                    landmarks = track.landmarks
                    x1, y1, x2, y2 = [int(v) for v in bbox]

                    # (A) Cập nhật Anti-Spoofing theo chu kỳ của track
                    if track.needs_pad(interval_seconds=0.2):
                        try:
                            is_real, real_prob, _ = fas_predictor.predict(frame, bbox)
                            track.update_pad(is_real, real_prob)
                        except Exception as e:
                            pass

                    # (B) Đánh giá trạng thái PAD đa frame
                    if not track.pad_ready:
                        color = (0, 255, 255)  # Vàng: Đang tích lũy votes
                        status_label = f"#{track.track_id} CHECKING ({len(track._pad_window)}/{track.pad_min_votes})"
                    elif track.is_spoof:
                        color = (0, 0, 255)    # Đỏ: Giả mạo (ảnh/video)
                        status_label = f"#{track.track_id} SPOOF ({track.last_pad_score or 0.0:.2f})"
                    else:
                        # Người thật (REAL)
                        color = (0, 255, 0)    # Xanh lá: Hợp lệ
                        status_label = f"#{track.track_id} REAL ({track.last_pad_score or 1.0:.2f})"

                        # (C) Kiểm tra điều kiện gửi điểm danh (Chống Spam qua Latch Flag & Cooldown)
                        last_sent = getattr(track, "last_scan_sent", 0.0)
                        already_sent = getattr(track, "attendance_sent", False)

                        # Chỉ gửi nếu chốt chưa khóa (attendance_latch == False)
                        if not attendance_latch:
                            if not already_sent or (now_wall - last_sent >= COOLDOWN_SEC):
                                if landmarks is None or len(landmarks) != 5:
                                    last_detection_time = None
                                else:
                                    aligned_face = align_face(frame, landmarks)
                                    if aligned_face is not None:
                                        embedding = embedder.extract(aligned_face)
                                        if embedding is not None:
                                            req_id = tb_client.send_scan_rpc(
                                                embedding,
                                                float(track.last_pad_score or 1.0),
                                                current_mode
                                            )
                                            if req_id > 0:
                                                attendance_latch = True
                                                track.attendance_sent = True
                                                track.last_scan_sent = now_wall
                                                status_banner = f"TRACK #{track.track_id}: ĐANG ĐỐI SOÁT RPC..."
                                                status_banner_time = now_wall
                                                print(f"[EDGE] Track #{track.track_id} -> Đã gửi Two-way RPC (Khóa chốt chống spam thành công)!")

                        # Hiển thị trạng thái chốt trên nhãn bounding box
                        if attendance_latch:
                            status_label += " [DA GUI - CHO NGUOI MOI]"
                        else:
                            status_label += " [READY]"

                    # Vẽ Bounding Box & Nhãn Track lên khung hình
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

            # ── 7. Vẽ Thanh Thông Tin & Banners Lên Video ────────────────────
            # Top Banner: Trạng thái thiết bị, Chế độ Check In/Out, FPS, Trạng thái AI/Siêu âm
            if not is_awake:
                banner_bg = (50, 50, 50)  # Xám sẫm khi AI đang ngủ
                dist_str = f"{dist:.0f}cm" if dist is not None else ">100cm"
                banner_text = f"DEVICE: {DEVICE_ID} | AI: SLEEP (d: {dist_str}) | FPS: {current_fps:.1f}"
            else:
                banner_bg = (180, 100, 0) if current_mode == "CHECK_IN" else (0, 100, 200)
                dist_str = f"{dist:.0f}cm" if dist is not None else "?cm"
                latch_str = "LATCH: LOCKED" if attendance_latch else "LATCH: READY"
                banner_text = f"DEVICE: {DEVICE_ID} | {current_mode} | FPS: {current_fps:.1f} | d: {dist_str} | {latch_str}"

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
            if status_banner and (now_wall - status_banner_time < 3.0):
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

            # ── 8. Gửi Frame Vào Luồng RTSP Streamer ─────────────────────────
            streamer.write_frame(frame)

            # ── 9. Hiển thị lên Màn hình phần cứng TFT ST7789V ──────────────
            if tft_display.is_active():
                tft_display.show_frame(frame)

            # ── 10. Hiển thị GUI nếu được bật ───────────────────────────────
            if SHOW_GUI:
                try:
                    cv2.imshow("SmartFace Pi Edge", frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        break
                    elif key == ord('m'):
                        current_mode = "CHECK_OUT" if current_mode == "CHECK_IN" else "CHECK_IN"
                        print(f"[KEYBOARD] Đã chuyển mode: {current_mode}")
                except Exception:
                    pass

    except KeyboardInterrupt:
        print("\n[STOP] Đang dừng Pi Edge Client...")
    finally:
        cap.release()
        if SHOW_GUI:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass
        ultrasonic.stop()
        tft_display.cleanup()
        streamer.stop()
        tb_client.stop()
        print("[EXIT] Pi Edge Client đã tắt an toàn.")


if __name__ == "__main__":
    main()
