"""Incremental webcam login inference with the same PAD vote policy as the Pi runtime."""
import io
import math
from contextlib import redirect_stderr, redirect_stdout

import numpy as np

import config
from tracking.tracker import compute_iou
from vision_pipeline import _pad_face_skip_reason


def process_frame(state, frame, *, detector, predictor, embedder, align_face):
    """Advance one frame on a LoginSession-compatible state. Never writes attendance or sessions."""
    try:
        detections = detector.detect(frame)
        if not detections:
            state.reset()
            return {'status': 'reset', 'reason': 'no_face'}
        # Pi tracks the largest face by default when multiple faces are visible.
        face = max(detections, key=lambda item: max(0, item['bbox'][2] - item['bbox'][0])
                   * max(0, item['bbox'][3] - item['bbox'][1]))
        bbox = face['bbox']
        if _pad_face_skip_reason(face, frame.shape) is not None:
            state.reset()
            return {'status': 'reset', 'reason': 'face_quality'}
        if state.previous_bbox is not None and compute_iou(state.previous_bbox, bbox) < config.TRACK_IOU_THRESHOLD:
            state.reset()
            state.previous_bbox = bbox
            return {'status': 'reset', 'reason': 'track_changed'}
        state.previous_bbox = bbox
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            verdict = predictor.predict_frame(frame, bbox)
        score = float(verdict.get('pad_score', verdict.get('logit_diff', float('nan'))))
        threshold = verdict.get('threshold_logit')
        if (not isinstance(verdict.get('is_real'), bool) or not math.isfinite(score)
                or (threshold is not None and not math.isfinite(float(threshold)))):
            return {'status': 'error', 'reason': 'pad_invalid'}
        raw_real = verdict['is_real']
        state.track.update_pad(raw_real, score, threshold)
        # Pi's backend rejects a raw spoof score and resets consecutive recognition,
        # even if the rolling PAD verdict is still REAL. Rolling SPOOF also clears
        # consecutive recognition while allowing collection until attempt timeout.
        if state.track.is_spoof or not raw_real:
            return {'status': 'reset', 'reason': 'spoof' if state.track.is_spoof else 'raw_spoof'}
        if not state.track.is_real:
            return {'status': 'pending', 'reason': 'pad_pending'}
        face_input = align_face(frame, bbox, face['landmarks'], embedder.input_size)
        embedding = np.asarray(embedder.embed_aligned(face_input), dtype=np.float64).reshape(-1)
        norm = float(np.linalg.norm(embedding))
        if embedding.size != 512 or not np.isfinite(embedding).all() or not math.isfinite(norm) or norm <= 1e-12:
            return {'status': 'error', 'reason': 'embedding_invalid'}
        return {'status': 'embedding', 'reason': 'ok', 'embedding': (embedding / norm).tolist()}
    except Exception:
        return {'status': 'error', 'reason': 'processing_error'}
