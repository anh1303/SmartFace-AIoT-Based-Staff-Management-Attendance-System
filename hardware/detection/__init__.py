"""
Detection Package Factory
Hỗ trợ cả 2 mô hình:
- 'scrfd'  : InsightFace SCRFD (det_500m.onnx ~2.5 MB) - Độ chính xác cao, góc nghiêng tốt
- 'yunnet' : OpenCV YuNet INT8 (detector_quantized.onnx ~120 KB) - Siêu nhẹ, tối ưu cho Pi
"""

import os
from .yunnet_detector import FaceDetector as YuNetDetector
from .scrfd_detector import SCRFDDetector


def create_detector(detector_type: str = None, input_size=(640, 480), conf_thresh: float = 0.5):
    """
    Factory tạo detector dựa theo cấu hình.
    detector_type: 'scrfd' hoặc 'yunnet' (mặc định lấy từ biến APP_DETECTOR hoặc 'scrfd')
    """
    if detector_type is None:
        detector_type = os.getenv("APP_DETECTOR", "scrfd").strip().lower()

    if detector_type == "scrfd":
        try:
            return SCRFDDetector(det_size=input_size, conf_thresh=conf_thresh)
        except Exception as e:
            print(f"[WARN] Không thể khởi tạo SCRFD ({e}), tự động chuyển sang YuNet...")
            return YuNetDetector(input_size=input_size, score_threshold=conf_thresh)
    else:
        return YuNetDetector(input_size=input_size, score_threshold=conf_thresh)


__all__ = ["create_detector", "YuNetDetector", "SCRFDDetector"]
