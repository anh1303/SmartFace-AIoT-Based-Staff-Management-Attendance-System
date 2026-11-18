"""Private incremental extraction API: never searches identities or writes attendance."""
import asyncio
import base64
import hashlib
import io
import re
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
from .pipeline import process_frame
from .sessions import BOOT_ID, MAX_FRAMES, SessionStore

MAX_BODY = 300 * 1024
ATTEMPT_ID = re.compile(r'^[a-f0-9]{32}$')


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


class AttemptCreate(BaseModel):
    model_config = {'extra': 'forbid'}
    attempt_id: str = Field(pattern=r'^[a-f0-9]{32}$')
    epoch: int = Field(ge=1)
    ttl_ms: int = Field(ge=1000, le=30000)


class AttemptFrame(BaseModel):
    model_config = {'extra': 'forbid'}
    epoch: int = Field(ge=1)
    seq: int = Field(ge=1, le=MAX_FRAMES)
    operation_id: str = Field(default='', max_length=32)
    frame: StrictStr = Field(max_length=273068)


def build_router(get_models, require_key, *, store=None):
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
    state_store = store if store is not None else SessionStore()
    router.state_store = state_store
    router.inference_slot = slot
    router.sweeper_task = None

    async def _periodic_sweep():
        try:
            while True:
                await asyncio.sleep(1.0)
                state_store.try_sweep()
        except asyncio.CancelledError:
            raise

    async def _start_sweeper():
        if router.sweeper_task is None or router.sweeper_task.done():
            router.sweeper_task = asyncio.create_task(_periodic_sweep())

    async def _stop_sweeper():
        task = router.sweeper_task
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    router.on_startup.append(_start_sweeper)
    router.on_shutdown.append(_stop_sweeper)

    @router.post('/attempts')
    def create_attempt(req: AttemptCreate):
        try:
            state_store.create(req.attempt_id, req.epoch, req.ttl_ms / 1000)
        except OverflowError:
            raise HTTPException(429, 'Busy') from None
        except KeyError:
            raise HTTPException(409, 'Exists') from None
        return {'attempt_id': req.attempt_id, 'boot_id': BOOT_ID, 'model_version': config.EMBEDDING_MODEL_VERSION}

    @router.post('/attempts/{attempt_id}/frames')
    def attempt_frame(attempt_id: str, req: AttemptFrame):
        if not ATTEMPT_ID.fullmatch(attempt_id):
            raise HTTPException(404, 'Missing')
        digest = hashlib.sha256(req.frame.encode('ascii', 'ignore')).hexdigest()
        try:
            session, cached, gap_expired = state_store.begin(attempt_id, req.epoch, req.seq, digest)
        except LookupError:
            raise HTTPException(410, 'Gone') from None
        except ValueError:
            raise HTTPException(409, 'Conflict') from None
        if cached is not None:
            return {**cached, 'operation_id': req.operation_id}
        if not slot.acquire(blocking=False):
            state_store.abort(session)
            raise HTTPException(429, 'Busy')
        try:
            try:
                models = get_models()
            except Exception:
                models = None
            if models is None:
                state_store.abort(session)
                raise HTTPException(503, 'Face login is unavailable')
            try:
                frame = decode_jpeg(req.frame)
                if gap_expired:
                    session.reset()
                    outcome = {'status': 'reset', 'reason': 'frame_gap'}
                else:
                    outcome = process_frame(session, frame, detector=models.detector, predictor=models.predictor,
                                            embedder=models.embedder, align_face=get_input_face)
            except ValueError:
                outcome = {'status': 'reset', 'reason': 'invalid_image'}
                session.reset()
            except Exception:
                outcome = {'status': 'error', 'reason': 'processing_error'}
        finally:
            slot.release()
        result = {'attempt_id': attempt_id, 'boot_id': BOOT_ID, 'seq': req.seq,
                  'operation_id': req.operation_id, 'model_version': config.EMBEDDING_MODEL_VERSION, **outcome}
        if state_store.finish(session, req.seq, result, digest) is None:
            raise HTTPException(410, 'Gone')
        return result

    @router.post('/attempts/{attempt_id}/cancel')
    def cancel_attempt(attempt_id: str):
        state_store.close(attempt_id)
        return {'status': 'cancelled'}

    return router
