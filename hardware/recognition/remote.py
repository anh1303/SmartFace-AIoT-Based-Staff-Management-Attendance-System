"""Optional server ArcFace extractor. No model or inference session is loaded here."""
import base64
import json
import math
import time
import uuid
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

import cv2
import numpy as np

# SHA256 of the existing hardware/models/w600k_mbf.onnx; overrides must be explicit.
ARCFACE_SHA256 = "9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward device credentials to a different endpoint.


class RemoteFaceEmbedder:
    input_size = (112, 112)

    def __init__(self, base_url, device_id, token, model_sha256=ARCFACE_SHA256,
                 model_version="buffalo_s", timeout=3.0):
        parsed = urlparse(base_url)
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or parsed.path not in ("", "/")):
            raise ValueError("BACKEND_BASE_URL must be an HTTP(S) origin")
        if not device_id or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in device_id):
            raise ValueError("Invalid DEVICE_ID")
        if len(token) < 32 or not token.isascii() or any(c.isspace() for c in token):
            raise ValueError("EDGE_RECOGNITION_TOKEN must contain at least 32 non-whitespace ASCII characters")
        if len(model_sha256) != 64 or any(c not in "0123456789abcdef" for c in model_sha256):
            raise ValueError("Invalid REMOTE_ARCFACE_SHA256")
        if not math.isfinite(timeout) or not 0 < timeout <= 10:
            raise ValueError("REMOTE_RECOGNITION_TIMEOUT_SECONDS must be in (0, 10]")
        self.url = base_url.rstrip("/") + f"/api/devices/{device_id}/face-embedding"
        self.token, self.model_sha256 = token, model_sha256
        self.model_version, self.timeout = model_version, timeout
        self.opener = build_opener(NoRedirect())
        self.last_metrics = {}

    def extract(self, aligned_bgr):
        if aligned_bgr.shape != (112, 112, 3) or aligned_bgr.dtype != np.uint8:
            raise ValueError("Expected aligned uint8 BGR 112x112")
        started = time.monotonic()
        ok, png = cv2.imencode(".png", aligned_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 1])
        if not ok:
            raise ValueError("PNG encoding failed")
        request_id = uuid.uuid4().hex
        body = json.dumps({"request_id": request_id, "image_png_b64": base64.b64encode(png).decode("ascii"),
                           "model_sha256": self.model_sha256, "model_version": self.model_version}).encode()
        request = Request(self.url, data=body, headers={"Content-Type": "application/json",
                          "Authorization": "Bearer " + self.token})
        with self.opener.open(request, timeout=self.timeout) as response:
            raw = response.read(8193)
            if len(raw) > 8192:
                raise ValueError("Oversized recognition response")
            data = json.loads(raw)
        elapsed = time.monotonic() - started
        if elapsed > self.timeout:
            raise TimeoutError("Recognition result expired")
        if (data.get("request_id") != request_id or data.get("model_sha256") != self.model_sha256
                or data.get("model_version") != self.model_version):
            raise ValueError("Recognition response contract mismatch")
        vector_bytes = base64.b64decode(data["embedding_b64"], validate=True)
        vector = np.frombuffer(vector_bytes, dtype="<f4").copy()
        if vector.size != 512 or not np.isfinite(vector).all() or not np.isclose(np.linalg.norm(vector), 1, atol=1e-4):
            raise ValueError("Invalid server embedding")
        self.last_metrics = {"roundtrip_ms": round(elapsed * 1000, 2), "upload_bytes": len(body),
                             "inference_ms": data.get("inference_ms")}
        return vector
