"""Short local inference capacity measurement for streaming face login.

Follows Task 0 of docs/superpowers/plans/2026-11-18-face-login-streaming-hardening.md:
- Uses only existing Python libraries and local fixtures (no live camera, no secrets).
- 5 warmup iterations, 30 measured iterations.
- Separates detect+PAD-only path from detect+PAD+embedding path, resetting session
  state on each iteration so results are not skewed by cached state or missing faces.
- Runs 1 client for real inference throughput, and 2 concurrent clients against the
  router's single inference slot to record busy (429) responses.
- Never uses fake models to claim real capacity; if real models or a suitable face
  image fixture are unavailable, reports `measured: false` with the exact reason.
"""
from __future__ import annotations

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import platform
import statistics
import sys
import time
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
FACE_AUTH_DIR = REPO_ROOT / "face_auth"
if str(FACE_AUTH_DIR) not in sys.path:
    sys.path.insert(0, str(FACE_AUTH_DIR))


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    rank = (pct / 100.0) * (len(sorted_vals) - 1)
    low = int(rank)
    high = min(low + 1, len(sorted_vals) - 1)
    weight = rank - low
    return sorted_vals[low] * (1.0 - weight) + sorted_vals[high] * weight


def _summarize_ms(samples_ms: list[float], total_seconds: float) -> dict[str, float]:
    ordered = sorted(samples_ms)
    fps = (len(samples_ms) / total_seconds) if total_seconds > 0 else 0.0
    return {
        "count": len(samples_ms),
        "total_seconds": round(total_seconds, 4),
        "fps": round(fps, 2),
        "p50_ms": round(_percentile(ordered, 50), 2),
        "p95_ms": round(_percentile(ordered, 95), 2),
        "mean_ms": round(statistics.fmean(ordered), 2) if ordered else 0.0,
        "min_ms": round(ordered[0], 2) if ordered else 0.0,
        "max_ms": round(ordered[-1], 2) if ordered else 0.0,
    }


def _find_candidate_images(explicit_path: str | None) -> list[Path]:
    if explicit_path:
        p = Path(explicit_path).expanduser().resolve()
        return [p] if p.is_file() else []
    # Never infer fixture provenance from a detector hit in training plots.
    return []


def _select_valid_face_jpeg(
    detector: Any, predictor: Any, candidates: list[Path]
) -> tuple[Any, str, str, bool] | None:
    import cv2
    from vision_pipeline import _pad_face_skip_reason

    for path in candidates:
        img = cv2.imread(str(path))
        if img is None:
            continue
        h, w = img.shape[:2]
        if max(h, w) > 720:
            scale = 720.0 / float(max(h, w))
            img = cv2.resize(img, (max(1, int(round(w * scale))), max(1, int(round(h * scale)))))
        detections = detector.detect(img)
        if not detections:
            continue
        face = max(
            detections,
            key=lambda item: max(0, item["bbox"][2] - item["bbox"][0])
            * max(0, item["bbox"][3] - item["bbox"][1]),
        )
        if _pad_face_skip_reason(face, img.shape) is not None:
            continue
        ok, encoded = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not ok or len(encoded) > 200 * 1024:
            continue
        jpeg_b64 = base64.b64encode(encoded.tobytes()).decode("ascii")
        decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
        if decoded is None:
            continue
        dets2 = detector.detect(decoded)
        if not dets2:
            continue
        face2 = max(
            dets2,
            key=lambda item: max(0, item["bbox"][2] - item["bbox"][0])
            * max(0, item["bbox"][3] - item["bbox"][1]),
        )
        if _pad_face_skip_reason(face2, decoded.shape) is not None:
            continue
        verdict = predictor.predict_frame(decoded, face2["bbox"])
        if verdict.get("is_real") is True:
            return decoded, jpeg_b64, str(path.resolve()), True
    return None


def _measure_path(run, expected_outcome: str, iterations: int, prepare=None) -> dict[str, Any]:
    successful_ms: list[float] = []
    failed_ms: list[float] = []
    outcomes: dict[str, int] = {}
    started = time.perf_counter()
    for _ in range(iterations):
        state = prepare() if prepare is not None else None
        before = time.perf_counter()
        out = run(state) if prepare is not None else run()
        elapsed = (time.perf_counter() - before) * 1000.0
        key = f"{out.get('status')}:{out.get('reason')}"
        outcomes[key] = outcomes.get(key, 0) + 1
        (successful_ms if key == expected_outcome else failed_ms).append(elapsed)
    # Exclude setup/PAD warmup from this per-frame stage timing; record wall time separately.
    summary = _summarize_ms(successful_ms, sum(successful_ms + failed_ms) / 1000.0)
    summary.update({
        'success_count': len(successful_ms), 'failure_count': len(failed_ms),
        'outcomes': outcomes, 'failed_samples_ms': failed_ms,
        'wall_seconds_including_setup': time.perf_counter() - started,
    })
    if failed_ms or len(successful_ms) != iterations or iterations <= 0:
        summary['fps'] = None
    return summary


def measure(image_arg: str | None = None, warmup: int = 5, iterations: int = 30) -> dict[str, Any]:
    if not image_arg:
        return {'measured': False, 'forced_pad_verdict': False, 'reason': 'explicit_face_image_required'}
    if warmup < 0 or iterations < 1:
        return {'measured': False, 'forced_pad_verdict': False, 'reason': 'invalid_iteration_count'}
    import config
    import onnxruntime as ort

    info: dict[str, Any] = {
        "measured": False,
        "forced_pad_verdict": False,
        "measurement_scope": "local_model_inference_only_not_service_capacity",
        "environment": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "processor": platform.processor(),
            "cpu_count": os.cpu_count(),
            "onnxruntime_version": ort.__version__,
            "onnxruntime_providers": ort.get_available_providers(),
            "node_workers": 1,
            "python_workers": 1,
        },
        "config": {
            "model_pack_name": config.MODEL_PACK_NAME,
            "embedding_model_version": config.EMBEDDING_MODEL_VERSION,
            "pad_model_filename": config.PAD_MODEL_FILENAME,
            "pad_model_sha256": config.PAD_RUNTIME_MODEL_SHA256,
            "pad_min_votes": config.PAD_MIN_VOTES,
            "pad_smooth_window": config.PAD_SMOOTH_WINDOW,
            "detector_det_size": list(config.DETECTOR_DET_SIZE),
            "detector_min_face_size": config.DETECTOR_MIN_FACE_SIZE,
        },
    }

    try:
        from alignment.aligner import get_input_face
        from antispoof.predictor import AntiSpoofPredictor
        from detection.detector import FaceDetector
        from face_login.http import build_router
        from face_login.pipeline import process_frame
        from face_login.sessions import LoginSession, SessionStore
        from recognition.embedder import FaceEmbedder
    except Exception as exc:
        info["reason"] = f"import_failed: {type(exc).__name__}: {exc}"
        return info

    try:
        detector = FaceDetector(
            model_name=config.MODEL_PACK_NAME,
            ctx_id=config.MODEL_CTX_ID,
            det_size=config.DETECTOR_DET_SIZE,
            conf_thresh=config.DETECTOR_CONF_THRESH,
            min_face_size=config.DETECTOR_MIN_FACE_SIZE,
        )
        embedder = FaceEmbedder(
            model_name=config.MODEL_PACK_NAME,
            ctx_id=config.MODEL_CTX_ID,
        )
        predictor = AntiSpoofPredictor()
    except Exception as exc:
        info["reason"] = f"model_load_failed: {type(exc).__name__}: {exc}"
        return info

    selected = _select_valid_face_jpeg(detector, predictor, _find_candidate_images(image_arg))
    if selected is None:
        info["reason"] = "no_valid_face_fixture_found"
        return info

    frame_bgr, jpeg_b64, fixture_rel, pad_passes_naturally = selected
    info["fixture"] = {
        "path": fixture_rel,
        "shape": list(frame_bgr.shape),
        "jpeg_base64_length": len(jpeg_b64),
        "pad_passes_naturally": pad_passes_naturally,
    }

    def run_pad_only_once() -> dict[str, Any]:
        session = LoginSession("a" * 32, 1, 15.0, time.monotonic())
        return process_frame(
            session,
            frame_bgr,
            detector=detector,
            predictor=predictor,
            embedder=embedder,
            align_face=get_input_face,
        )

    def prepare_embedding_session():
        session = LoginSession("b" * 32, 1, 15.0, time.monotonic())
        # Build eligibility from real PAD outcomes; do not fabricate votes.
        for _ in range(max(0, config.PAD_MIN_VOTES - 1)):
            process_frame(session, frame_bgr, detector=detector, predictor=predictor,
                          embedder=embedder, align_face=get_input_face)
        return session

    def run_with_embedding_once(session) -> dict[str, Any]:
        return process_frame(
            session,
            frame_bgr,
            detector=detector,
            predictor=predictor,
            embedder=embedder,
            align_face=get_input_face,
        )

    # Warmup
    for _ in range(warmup):
        run_pad_only_once()
        run_with_embedding_once(prepare_embedding_session())

    pad_outcome = 'pending:pad_pending' if config.PAD_MIN_VOTES > 1 else 'embedding:ok'
    pad_summary = _measure_path(run_pad_only_once, pad_outcome, iterations)
    emb_summary = _measure_path(run_with_embedding_once, 'embedding:ok', iterations,
                                prepare=prepare_embedding_session)
    info['embedding_pad_warmup_frames_per_sample'] = max(0, config.PAD_MIN_VOTES - 1)
    info['warmup_iterations'] = warmup
    info['measured_iterations'] = iterations
    info['single_client'] = {
        'detect_and_pad': pad_summary, 'detect_pad_and_embedding': emb_summary,
    }
    if pad_summary['fps'] is None or emb_summary['fps'] is None:
        info['reason'] = 'incomplete_successful_samples'
        return info

    # Two concurrent clients against router's single inference slot to verify busy (429)
    import threading
    from fastapi import FastAPI
    from types import SimpleNamespace
    from tests.test_face_login_http import Client

    barrier = threading.Barrier(2)

    class _BarrierPredictor:
        def __init__(self, inner: Any):
            self._inner = inner

        def predict_frame(self, frm: Any, bbox: Any) -> dict[str, Any]:
            try:
                barrier.wait(timeout=0.05)
            except threading.BrokenBarrierError:
                pass
            return self._inner.predict_frame(frm, bbox)

    models_ns = SimpleNamespace(
        detector=detector,
        embedder=embedder,
        predictor=_BarrierPredictor(predictor),
    )
    app = FastAPI()
    router = build_router(lambda: models_ns, lambda _k: None, store=SessionStore())
    app.include_router(router)
    client = Client(app)

    aid1 = "1" * 32
    aid2 = "2" * 32
    client.post("/internal/face-login/attempts", json={"attempt_id": aid1, "epoch": 1, "ttl_ms": 15000})
    client.post("/internal/face-login/attempts", json={"attempt_id": aid2, "epoch": 1, "ttl_ms": 15000})

    start_gate = threading.Barrier(2)

    def send_client_frames(aid: str, count: int) -> dict[str, int]:
        counts = {"200": 0, "429": 0, "other": 0}
        seq = 1
        start_gate.wait(timeout=2.0)
        for i in range(count):
            res = client.post(
                f"/internal/face-login/attempts/{aid}/frames",
                json={"epoch": 1, "seq": seq, "operation_id": f"op-{i}", "frame": jpeg_b64},
            )
            if res.status_code == 200:
                counts["200"] += 1
                seq += 1
            elif res.status_code == 429:
                counts["429"] += 1
            else:
                counts["other"] += 1
        return counts

    t_two_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(send_client_frames, aid1, 10)
        f2 = pool.submit(send_client_frames, aid2, 10)
        c1 = f1.result()
        c2 = f2.result()
    t_two_total = time.perf_counter() - t_two_start

    info["measured"] = True
    info["two_concurrent_clients"] = {
        "total_seconds": round(t_two_total, 4),
        "client_1": c1,
        "client_2": c2,
        "total_accepted_200": c1["200"] + c2["200"],
        "total_busy_429": c1["429"] + c2["429"],
    }
    return info


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure local face-login inference capacity.")
    parser.add_argument("--image", default=None, help="Required for measurement: verified face photo fixture, never a training plot.")
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--iterations", type=int, default=30)
    args = parser.parse_args()
    result = measure(args.image, warmup=args.warmup, iterations=args.iterations)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
