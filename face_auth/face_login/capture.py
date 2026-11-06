"""Webcam-to-JPEG simulation for the local spike; never saves image buffers."""
import cv2
import numpy as np


def strict_align_face(frame, bbox, landmarks, output_size):
    """Use the existing ArcFace transform without the attendance crop fallback."""
    from alignment.aligner import ARCFACE_DST_112, align_face

    points = np.asarray(landmarks, dtype=np.float32)
    if points.shape != (5, 2) or not np.isfinite(points).all():
        raise ValueError('Alignment requires five finite landmarks')
    scale = np.asarray(output_size, dtype=np.float32) / 112.0
    return align_face(frame, points, ARCFACE_DST_112 * scale, output_size)


def jpeg_roundtrip(frame, long_edge=720, quality=85, max_bytes=200 * 1024):
    if not isinstance(frame, np.ndarray) or frame.dtype != np.uint8 or frame.ndim != 3 or frame.shape[2] != 3:
        raise ValueError('Expected a BGR uint8 image')
    height, width = frame.shape[:2]
    if not 1 <= height <= 1080 or not 1 <= width <= 1920 or height * width > 2_073_600:
        raise ValueError('Camera image exceeds the spike pixel limit')
    if not 1 <= long_edge <= 1920 or not 1 <= quality <= 100 or max_bytes < 1:
        raise ValueError('Invalid JPEG experiment settings')
    if max(height, width) > long_edge:
        ratio = long_edge / max(height, width)
        frame = cv2.resize(frame, (max(1, round(width * ratio)), max(1, round(height * ratio))), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok or encoded.nbytes > max_bytes:
        raise ValueError('JPEG encoding failed or byte limit exceeded')
    # Only our bounded encoder output is decoded here; this is not a parser for
    # untrusted uploaded JPEGs. The future API needs its own header validation.
    decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if decoded is None or decoded.shape != frame.shape:
        raise ValueError('JPEG decoding failed')
    return decoded, int(encoded.nbytes)
