"""Public CV contracts for face login; no sessions or DB writes."""
from .policy import aggregate_embeddings, match_identity, verify_turn
from .capture import jpeg_roundtrip, strict_align_face
from .spike_pipeline import evaluate_sequence

__all__ = ['aggregate_embeddings', 'match_identity', 'verify_turn', 'jpeg_roundtrip', 'strict_align_face', 'evaluate_sequence']
