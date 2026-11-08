"""Display-only thumbnails. Never modify images used by the recognition pipeline."""
import base64
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)
PREFIX = 'data:image/jpeg;base64,'
MAX_BYTES = 40 * 1024


def make_avatar_thumbnail(image: np.ndarray) -> str:
    height, width = image.shape[:2]
    scale = min(1.0, 320 / max(height, width))
    thumbnail = cv2.resize(image, (max(1, round(width * scale)), max(1, round(height * scale))),
                           interpolation=cv2.INTER_AREA)
    while True:
        for quality in (80, 70, 60, 50, 40):
            ok, encoded = cv2.imencode('.jpg', thumbnail, [cv2.IMWRITE_JPEG_QUALITY, quality])
            if not ok:
                raise ValueError('Avatar encoding failed')
            uri = PREFIX + base64.b64encode(encoded).decode('ascii')
            if len(uri.encode('utf-8')) <= MAX_BYTES:
                return uri
        height, width = thumbnail.shape[:2]
        if max(height, width) <= 1:
            raise ValueError('Avatar exceeds byte budget')
        thumbnail = cv2.resize(thumbnail, (max(1, round(width * .8)), max(1, round(height * .8))),
                               interpolation=cv2.INTER_AREA)


def enrollment_avatar(image: np.ndarray | None) -> str | None:
    if image is None:
        return None
    try:
        return make_avatar_thumbnail(image)
    except Exception:
        # Avatar failure must not lose valid enrollment; never log image data.
        logger.warning('Avatar thumbnail unavailable; keeping existing avatar')
        return None
