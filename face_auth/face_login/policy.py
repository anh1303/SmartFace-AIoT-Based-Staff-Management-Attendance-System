"""Deterministic spike policies. Thresholds must be supplied by the experiment."""
import math

import numpy as np


def _unit(value):
    vector = np.asarray(value, dtype=np.float64)
    if vector.shape != (512,) or not np.isfinite(vector).all():
        raise ValueError('Expected a finite 512-dimensional embedding')
    norm = float(np.linalg.norm(vector))
    if not math.isfinite(norm) or norm <= 1e-12:
        raise ValueError('Invalid embedding norm')
    return vector / norm


def _threshold(value, minimum, maximum):
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError('Invalid experiment threshold')


def aggregate_embeddings(embeddings, consistency_threshold):
    _threshold(consistency_threshold, -1, 1)
    if len(embeddings) < 2:
        raise ValueError('At least two embeddings are required')
    units = np.stack([_unit(value) for value in embeddings])
    similarities = units @ units.T
    pairs = similarities[np.triu_indices(len(units), k=1)]
    if np.any(pairs < consistency_threshold):
        raise ValueError('Inconsistent frame identities')
    return _unit(units.mean(axis=0))


def match_identity(query, gallery, match_threshold, margin_threshold):
    """Exact cosine search over distinct, explicitly allowed experiment identities."""
    _threshold(match_threshold, -1, 1)
    _threshold(margin_threshold, 0, 2)
    query = _unit(query)
    scores = {}
    for identity, centroid in gallery:
        score = float(np.clip(query @ _unit(centroid), -1, 1))
        scores[identity] = max(scores.get(identity, -math.inf), score)
    if len(scores) < 2:
        return None
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    (identity, first), (_, second) = ranked[:2]
    # Equal candidates never identify a person, even if a trial sets margin=0.
    if first <= second or first < match_threshold or first - second < margin_threshold:
        return None
    return identity


def verify_turn(landmark_frames, direction, minimum_delta):
    """Five-landmark nose displacement heuristic, NOT camera/yaw attestation.

    Input is unmirrored. First two samples establish a neutral baseline and the
    last two must both move in the requested image direction relative to it.
    """
    if direction not in ('image_left', 'image_right'):
        raise ValueError('Unknown image direction')
    _threshold(minimum_delta, 0.01, 1)
    if len(landmark_frames) < 5:
        raise ValueError('At least five ordered landmark samples are required')
    offsets = []
    for values in landmark_frames:
        points = np.asarray(values, dtype=np.float64)
        if points.shape != (5, 2) or not np.isfinite(points).all():
            raise ValueError('Invalid face landmarks')
        eyes = points[1] - points[0]
        distance_squared = float(eyes @ eyes)
        if distance_squared <= 1e-12:
            raise ValueError('Degenerate eye geometry')
        offsets.append(float((points[2] - (points[0] + points[1]) / 2) @ eyes / distance_squared))
    if abs(offsets[0] - offsets[1]) > minimum_delta / 2:
        return False
    baseline = (offsets[0] + offsets[1]) / 2
    sign = 1 if direction == 'image_right' else -1
    return all(sign * (offset - baseline) >= minimum_delta for offset in offsets[-2:])
