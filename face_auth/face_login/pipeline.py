"""Webcam login inference with the same PAD vote policy as the Pi runtime."""
import io
import math
from contextlib import redirect_stderr, redirect_stdout

import numpy as np

import config
from tracking.tracker import Track, compute_iou
from vision_pipeline import _pad_face_skip_reason


def extract_sequence(frames, *, detector, predictor, embedder, align_face,
                     recognition_count=3, already_decoded=False):
    """Return consecutive eligible embeddings; never write attendance or sessions."""
    if not already_decoded or len(frames) != 8 or not 1 <= recognition_count <= 6:
        return {'reason': 'frame_count', 'embeddings': []}
    track = Track(1, (0, 0, 0, 0), pad_smooth_window=config.PAD_SMOOTH_WINDOW,
                  pad_min_votes=config.PAD_MIN_VOTES, pad_spoof_min_ratio=config.PAD_SPOOF_MIN_RATIO)
    embeddings = []
    previous_bbox = None
    last_real = False
    try:
        for frame in frames:
            detections = detector.detect(frame)
            if not detections:
                return {'reason': 'face_count', 'embeddings': []}
            # Pi tracks the largest face by default when multiple faces are visible.
            face = max(detections, key=lambda item: max(0, item['bbox'][2] - item['bbox'][0])
                       * max(0, item['bbox'][3] - item['bbox'][1]))
            bbox = face['bbox']
            if _pad_face_skip_reason(face, frame.shape) is not None:
                return {'reason': 'face_quality', 'embeddings': []}
            if previous_bbox is not None and compute_iou(previous_bbox, bbox) < config.TRACK_IOU_THRESHOLD:
                return {'reason': 'track_changed', 'embeddings': []}
            previous_bbox = bbox
            with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                verdict = predictor.predict_frame(frame, bbox)
            score = float(verdict.get('pad_score', verdict.get('logit_diff', float('nan'))))
            threshold = verdict.get('threshold_logit')
            if (not isinstance(verdict.get('is_real'), bool) or not math.isfinite(score)
                    or (threshold is not None and not math.isfinite(float(threshold)))):
                return {'reason': 'pad_rejected', 'embeddings': []}
            last_real = verdict['is_real']
            track.update_pad(last_real, score, threshold)
            # Pi's backend rejects a raw spoof score and resets consecutive
            # recognition, even if the rolling PAD verdict is still REAL.
            if track.is_spoof or not last_real:
                embeddings.clear()
            if track.is_real and last_real:
                face_input = align_face(frame, bbox, face['landmarks'], embedder.input_size)
                embedding = np.asarray(embedder.embed_aligned(face_input), dtype=np.float64).reshape(-1)
                norm = float(np.linalg.norm(embedding))
                if embedding.size != 512 or not np.isfinite(embedding).all() or not math.isfinite(norm) or norm <= 1e-12:
                    return {'reason': 'embedding_invalid', 'embeddings': []}
                embeddings.append(embedding / norm)
        if not track.is_real or not last_real or len(embeddings) < recognition_count:
            return {'reason': 'pad_rejected', 'embeddings': []}
        return {'reason': 'verified', 'embeddings': embeddings[-recognition_count:]}
    except Exception:
        return {'reason': 'processing_error', 'embeddings': []}
