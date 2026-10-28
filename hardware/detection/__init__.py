"""
Detection Package Factory
Hỗ trợ cả 2 mô hình:
- 'scrfd'  : InsightFace SCRFD (det_500m.onnx ~2.5 MB) - Độ chính xác cao, góc nghiêng tốt
- 'yunnet' : OpenCV YuNet INT8 (detector_quantized.onnx ~120 KB) - Siêu nhẹ, tối ưu cho Pi
"""

import os
from pathlib import Path
from .yunnet_detector import FaceDetector as YuNetDetector
from .scrfd_detector import SCRFDDetector


def create_detector(detector_type: str = None, input_size=(640, 480), conf_thresh: float = None, det_size=None, **kwargs):
    """
    Factory tạo detector dựa theo cấu hình.
    detector_type: 'scrfd' hoặc 'yunnet' (mặc định lấy từ biến APP_DETECTOR hoặc 'scrfd')
    """
    if detector_type is None:
        import config
        detector_type = getattr(config, "APP_DETECTOR", os.getenv("APP_DETECTOR", "scrfd")).strip().lower()

    if conf_thresh is None:
        import config
        conf_thresh = getattr(config, "DETECTOR_CONF_THRESH", 0.5)

    models_dir = Path(__file__).resolve().parent.parent / "models"

    if detector_type == "scrfd":
        import config
        p1 = models_dir / "detector_scrfd.onnx"
        p2 = models_dir / "det_500m.onnx"
        model_path = str(p1 if p1.exists() else p2)
        scrfd_det_size = det_size if det_size is not None else getattr(config, "DETECTOR_DET_SIZE", (640, 640))
        return SCRFDDetector(
            model_path=model_path,
            det_size=scrfd_det_size,
            conf_thresh=conf_thresh,
            min_face_size=getattr(config, "DETECTOR_MIN_FACE_SIZE", 60),
        )
    elif detector_type == "yunnet":
        import config
        model_path = str(models_dir / "detector_quantized.onnx")
        return YuNetDetector(
            model_path=model_path,
            input_size=getattr(config, "DETECTOR_INPUT_SIZE", input_size),
            conf_thresh=conf_thresh,
            nms_thresh=getattr(config, "DETECTOR_NMS_THRESH", 0.3),
            top_k=getattr(config, "DETECTOR_TOP_K", 5000),
            min_face_size=getattr(config, "DETECTOR_MIN_FACE_SIZE", 60),
            margin=getattr(config, "DETECTOR_MARGIN", 0.2),
        )
    else:
        raise ValueError(f"APP_DETECTOR '{detector_type}' không hợp lệ. Phải là 'scrfd' hoặc 'yunnet'.")


__all__ = ["create_detector", "YuNetDetector", "SCRFDDetector"]
