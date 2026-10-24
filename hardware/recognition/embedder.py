"""
Module Trích xuất Vector đặc trưng khuôn mặt (ArcFace Embedder)
Sử dụng ONNX Runtime với mô hình w600k_mbf.onnx (ArcFace MobileFaceNet 512D).
"""

import os
import numpy as np
from pathlib import Path


class FaceEmbedder:
    """ArcFace MobileFaceNet Feature Embedder (512D) sử dụng ONNX Runtime."""

    def __init__(self, model_path: str = None, intra_op_threads=1):
        import onnxruntime as ort

        if model_path is None:
            model_path = str(Path(__file__).resolve().parent.parent / "models" / "w600k_mbf.onnx")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Không tìm thấy model ArcFace tại: {model_path}")

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = max(1, int(intra_op_threads))
        opts.inter_op_num_threads = 1
        opts.add_session_config_entry("session.intra_op.allow_spinning", "0")
        opts.add_session_config_entry("session.inter_op.allow_spinning", "0")
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        self.session = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.input_size = (112, 112)

    def extract(self, aligned_bgr: np.ndarray) -> np.ndarray:
        """
        Trích xuất vector 512 chiều từ ảnh mặt đã căn chỉnh (112x112 BGR).
        Vector trả về đã được chuẩn hóa L2 norm = 1.0.
        """
        if aligned_bgr is None:
            return None

        # InsightFace ArcFace tiền xử lý: BGR -> RGB, trừ 127.5, chia 127.5, shape (1, 3, 112, 112)
        rgb = aligned_bgr[:, :, ::-1].astype(np.float32)
        blob = (rgb.transpose((2, 0, 1)) - 127.5) / 127.5
        blob = np.expand_dims(blob, axis=0).astype(np.float32)

        feat = self.session.run(None, {self.input_name: blob})[0].flatten()
        norm = np.linalg.norm(feat)
        if norm == 0 or not np.isfinite(norm):
            return None

        return feat / norm
