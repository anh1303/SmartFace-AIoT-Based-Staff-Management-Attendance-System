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

    import config
    from pathlib import Path
    if detector_type == "scrfd":
        return SCRFDDetector(det_size=config.DETECTOR_DET_SIZE,
                             conf_thresh=config.DETECTOR_CONF_THRESH,
                             min_face_size=config.DETECTOR_MIN_FACE_SIZE)
    if detector_type != "yunnet":
        raise ValueError("APP_DETECTOR phải là scrfd hoặc yunnet")
    return YuNetDetector(
        model_path=str(Path(__file__).resolve().parent.parent / "models" / "detector_quantized.onnx"),
        input_size=config.DETECTOR_INPUT_SIZE, conf_thresh=config.DETECTOR_CONF_THRESH,
        nms_thresh=config.DETECTOR_NMS_THRESH, top_k=config.DETECTOR_TOP_K,
        min_face_size=config.DETECTOR_MIN_FACE_SIZE, margin=config.DETECTOR_MARGIN,
    )


__all__ = ["create_detector", "YuNetDetector", "SCRFDDetector"]
