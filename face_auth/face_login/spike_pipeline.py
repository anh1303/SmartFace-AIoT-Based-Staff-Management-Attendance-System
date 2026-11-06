"""Face-login CV pipeline; adapters supply models and the allowed trial gallery."""
import math
import time
from contextlib import redirect_stderr, redirect_stdout
import io

import numpy as np

from .capture import jpeg_roundtrip
from .policy import aggregate_embeddings, match_identity, verify_turn


def extract_sequence(frames, *, detector, predictor, embedder, align_face,
                     direction, consistency, turn_delta, min_face_size,
                     min_confidence, long_edge=720, quality=85, already_decoded=False):
    """Extract a vector after all five frames pass quality, PAD and movement gates.

    Reasons are internal diagnostics. The HTTP adapter coalesces rejection reasons
    and only returns the verified vector to its authenticated backend caller.
    """
    started = time.perf_counter()
    sizes, points, embeddings = [], [], []

    def result(reason, embedding=None):
        return {'reason': reason, 'embedding': embedding, 'jpeg_bytes': sizes,
                'processing_ms': round((time.perf_counter() - started) * 1000, 2)}

    if len(frames) != 5:
        return result('frame_count')
    try:
        for raw in frames:
            frame, size = (raw, 0) if already_decoded else jpeg_roundtrip(raw, long_edge=long_edge, quality=quality)
            sizes.append(size)
            detections = detector.detect(frame)
            if len(detections) != 1:
                return result('face_count')
            face = detections[0]
            bbox = np.asarray(face['bbox'], dtype=float)
            landmarks = np.asarray(face['landmarks'], dtype=float)
            score = float(face['score'])
            height, width = frame.shape[:2]
            if (bbox.shape != (4,) or landmarks.shape != (5, 2)
                    or not np.isfinite(bbox).all() or not np.isfinite(landmarks).all()
                    or not math.isfinite(score) or score < min_confidence):
                return result('face_quality')
            x1, y1, x2, y2 = bbox
            if (x2 - x1 < min_face_size or y2 - y1 < min_face_size
                    or x1 <= 1 or y1 <= 1 or x2 >= width - 1 or y2 >= height - 1
                    or np.any(landmarks[:, 0] <= x1) or np.any(landmarks[:, 0] >= x2)
                    or np.any(landmarks[:, 1] <= y1) or np.any(landmarks[:, 1] >= y2)):
                return result('face_quality')
            # Existing predictor catches and prints native exceptions. The local
            # single-threaded spike retains only the sanitized verdict/reason.
            with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                verdict = predictor.predict_frame(frame, face['bbox'])
            pad_score = float(verdict.get('pad_score', verdict.get('logit_diff', float('nan'))))
            if verdict.get('is_real') is not True or not math.isfinite(pad_score):
                return result('pad_rejected')
            try:
                aligned = align_face(frame, face['bbox'], landmarks, embedder.input_size)
            except (ValueError, TypeError):
                return result('alignment_rejected')
            if aligned is None:
                return result('alignment_rejected')
            embeddings.append(embedder.embed_aligned(aligned))
            points.append(landmarks)
        try:
            query = aggregate_embeddings(embeddings, consistency)
        except ValueError:
            return result('identity_inconsistent')
        if not verify_turn(points, direction, turn_delta):
            return result('challenge_rejected')
        return result('verified', query)
    except Exception:
        # Native-model diagnostics may contain paths or inputs; keep them out of
        # the experiment record. Fail closed, never fall back to recognition.
        return result('processing_error')


def evaluate_sequence(frames, *, gallery, match, margin, **options):
    """Local experiment adapter: extraction followed by exact in-memory search."""
    result = extract_sequence(frames, **options)
    embedding = result.pop('embedding')
    result['identity'] = None
    if embedding is not None:
        try:
            identity = match_identity(embedding, gallery, match, margin)
            result.update(identity=identity, reason='accepted' if identity is not None else 'match_rejected')
        except ValueError:
            result['reason'] = 'processing_error'
    return result
