"""Private extraction API: never searches identities or writes attendance."""
import base64
import io
from threading import BoundedSemaphore
import warnings

import cv2
import numpy as np
from PIL import Image
from fastapi import APIRouter, HTTPException, Request
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field, StrictStr

import config
from alignment.aligner import get_input_face
from .pipeline import extract_sequence

MAX_BODY = 2_250_000


def decode_jpeg(value):
    try:
        if not isinstance(value, str) or len(value) > 273068:
            raise ValueError('Invalid image')
        data = base64.b64decode(value, validate=True)
        if not data or len(data) > 200 * 1024:
            raise ValueError('Invalid image')
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size
                if image.format != 'JPEG' or not (1 <= width <= 1920 and 1 <= height <= 1080) or width * height > 2_073_600:
                    raise ValueError('Invalid image dimensions')
        frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None or frame.shape != (height, width, 3):
            raise ValueError('Invalid decoded image')
        return frame
    except Exception as exc:
        raise ValueError('Invalid JPEG') from exc


class LoginExtraction(BaseModel):
    model_config = {'extra': 'forbid'}
    request_id: str = Field(pattern=r'^[a-f0-9]{32}$')
    frames: list[StrictStr] = Field(min_length=8, max_length=8)
    recognition_count: int = Field(ge=1, le=6)


def extract_login_embeddings(frames, models, recognition_count):
    result = extract_sequence(
        frames, detector=models.detector, embedder=models.embedder, predictor=models.predictor,
        align_face=get_input_face, recognition_count=recognition_count, already_decoded=True,
    )
    return result['embeddings']


def build_router(get_models, require_key):
    class LimitedRoute(APIRoute):
        def get_route_handler(self):
            original = super().get_route_handler()
            async def bounded(request: Request):
                require_key(request.headers.get('x-face-auth-key', ''))
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > MAX_BODY:
                        raise HTTPException(413, 'Request too large')
                    body.extend(chunk)
                # Starlette caches body in this field; bound it before JSON parsing.
                request._body = bytes(body)
                return await original(request)
            return bounded

    router = APIRouter(prefix='/internal/face-login', route_class=LimitedRoute)
    slot = BoundedSemaphore(1)

    @router.post('/extract')
    def extract(req: LoginExtraction):
        if not slot.acquire(blocking=False):
            raise HTTPException(429, 'Busy')
        try:
            try:
                models = get_models()
            except Exception:
                raise HTTPException(503, 'Face login is unavailable') from None
            if models is None:
                raise HTTPException(503, 'Face login is unavailable')
            try:
                frames = [decode_jpeg(value) for value in req.frames]
            except ValueError:
                return {'request_id': req.request_id, 'status': 'rejected'}
            embeddings = extract_login_embeddings(frames, models, req.recognition_count)
            if not embeddings:
                return {'request_id': req.request_id, 'status': 'rejected'}
            return {'request_id': req.request_id, 'status': 'ok',
                    'model_version': config.EMBEDDING_MODEL_VERSION,
                    'embeddings': [embedding.tolist() for embedding in embeddings]}
        finally:
            slot.release()

    return router
