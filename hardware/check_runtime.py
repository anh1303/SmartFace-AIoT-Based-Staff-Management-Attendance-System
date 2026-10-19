"""Kiểm tra AI/FFmpeg và tùy chọn camera; không kết nối MQTT hoặc gửi điểm danh."""
import argparse
import shutil
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera", action="store_true", help="Mở và đọc một frame camera")
    args = parser.parse_args()
    try:
        import cv2
        import numpy as np
        # Import cấu hình và module theo đúng entrypoint, không gọi main().
        import edge_client as edge

        if edge.APP_DETECTOR not in ("scrfd", "yunnet"):
            raise RuntimeError("APP_DETECTOR phải là scrfd hoặc yunnet")
        if edge.SHOW_GUI and "GUI:                           NONE" in cv2.getBuildInformation():
            raise RuntimeError("OpenCV headless: đặt SHOW_GUI=false")

        model_names = ["R7_SC_100K_crop15.onnx", "w600k_mbf.onnx"]
        model_names.append("det_500m.onnx" if edge.APP_DETECTOR == "scrfd" else "detector_quantized.onnx")
        for name in model_names:
            path = edge.BASE_DIR / "models" / name
            if not path.is_file() or path.stat().st_size < 1024:
                raise RuntimeError(f"Thiếu model hoặc file chưa tải đầy đủ: {path}")

        detector = edge.create_detector(edge.APP_DETECTOR, input_size=(edge.WIDTH, edge.HEIGHT))
        if edge.APP_DETECTOR == "scrfd":
            from detection.scrfd_detector import SCRFDDetector
            if not isinstance(detector, SCRFDDetector):
                raise RuntimeError("SCRFD khởi tạo lỗi và đã fallback YuNet. Xem log phía trên.")
        blank = np.zeros((edge.HEIGHT, edge.WIDTH, 3), dtype=np.uint8)
        detector.detect(blank)
        pad = edge.AntiSpoofPredictor(threshold_logit=edge.FAS_LOGIT_THRESHOLD)
        _, score, margin = pad.predict(blank, (0, 0, edge.WIDTH, edge.HEIGHT))
        if not np.isfinite(score) or not np.isfinite(margin):
            raise RuntimeError("PAD trả về giá trị không hữu hạn")
        embedder = edge.FaceEmbedder()
        vector = embedder.extract(np.zeros((112, 112, 3), dtype=np.uint8))
        if vector is None or vector.shape != (512,) or not np.isfinite(vector).all():
            raise RuntimeError("Embedder không trả vector 512D hữu hạn")
        print("OK: Detector, PAD và ArcFace nạp/chạy được trên ảnh tổng hợp.")

        if edge.STREAM_ENABLED and shutil.which("ffmpeg") is None:
            raise RuntimeError("STREAM_ENABLED=true nhưng thiếu ffmpeg; chạy setup_pi.sh")
        print("OK: Có FFmpeg." if edge.STREAM_ENABLED else "SKIP: Stream đang tắt, không yêu cầu FFmpeg.")

        if args.camera:
            cap = cv2.VideoCapture(edge.CAM_INDEX)
            try:
                if not cap.isOpened():
                    raise RuntimeError(f"Không mở được CAMERA_INDEX={edge.CAM_INDEX}")
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, edge.WIDTH)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, edge.HEIGHT)
                cap.set(cv2.CAP_PROP_FPS, edge.FPS)
                ok, frame = cap.read()
                if not ok or frame is None or frame.size == 0:
                    raise RuntimeError("Camera mở được nhưng không đọc được frame")
                print(f"OK: Camera đọc frame {frame.shape[1]}x{frame.shape[0]}.")
            finally:
                cap.release()
        print("Chưa kiểm tra GPIO, stream thực tế hoặc độ chính xác nhận diện/PAD.")
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
