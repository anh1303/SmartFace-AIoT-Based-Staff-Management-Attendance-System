"""Local webcam feasibility experiment. No API, session issuance or DB writes."""
import argparse
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import secrets
import subprocess
import sys
import time

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from face_login import evaluate_sequence, strict_align_face


def read_gallery(conninfo, participants, model_version):
    """Only explicitly consented trial participants; never query other templates."""
    import psycopg

    with psycopg.connect(conninfo, connect_timeout=5,
                         options='-c default_transaction_read_only=on -c statement_timeout=5000') as conn:
        rows = conn.execute('''
            SELECT e.employee_code, f.embedding::text
            FROM face_embeddings f
            JOIN employees e ON e.id = f.employee_id
            JOIN users u ON u.id = e.user_id
            JOIN roles r ON r.id = u.role_id
            WHERE e.employee_code = ANY(%s)
              AND e.status = 'ACTIVE' AND u.is_active = true
              AND upper(r.role_name) = 'EMPLOYEE'
              AND f.embedding_type = 'CENTROID' AND f.is_active = true
              AND f.model_version = %s AND f.embedding IS NOT NULL
            LIMIT 201
        ''', (participants, model_version)).fetchall()
    if len(rows) > 200 or {row[0] for row in rows} != set(participants):
        raise ValueError('Every trial participant needs a compatible active employee centroid')
    gallery = [(identity, np.asarray(json.loads(value), dtype=float)) for identity, value in rows]
    for _, value in gallery:
        if value.shape != (512,) or not np.isfinite(value).all() or np.linalg.norm(value) <= 1e-12:
            raise ValueError('Invalid gallery centroid')
    return gallery


def capture_sequence(camera_index, direction, interval=0.5, warmup=0.8):
    """Preview remains unmirrored; overlays never enter the captured JPEG frames."""
    camera = cv2.VideoCapture(camera_index)
    frames = []
    try:
        if not camera.isOpened():
            raise RuntimeError('Camera unavailable')
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        ready_at = time.monotonic() + warmup
        started, next_sample = False, 0.0
        while len(frames) < 5:
            ok, frame = camera.read()
            if not ok:
                raise RuntimeError('Camera frame unavailable')
            now = time.monotonic()
            preview = frame.copy()
            if not started:
                prompt = 'Look straight. SPACE: start | ESC: cancel'
            elif len(frames) < 2:
                prompt = 'Keep looking straight'
            else:
                prompt = 'Move nose LEFT <---' if direction == 'image_left' else 'Move nose RIGHT --->'
            cv2.putText(preview, prompt, (15, 35), cv2.FONT_HERSHEY_SIMPLEX,
                        0.65, (0, 255, 0), 2)
            cv2.imshow('Face login spike (unmirrored)', preview)
            key = cv2.waitKey(1) & 0xff
            if key == 27:
                raise KeyboardInterrupt
            if key == 32 and not started and now >= ready_at:
                started, next_sample = True, now + interval
            if started and now >= next_sample:
                frames.append(frame.copy())
                next_sample = now + interval
    finally:
        camera.release()
        cv2.destroyAllWindows()
    return frames


def public_trial_result(result, trial_type, expected_code):
    """Reduce a trial to non-identifying diagnostics before persistence."""
    identity = result['identity']
    accepted = identity is not None
    return {
        'reason': result['reason'], 'accepted': accepted,
        'correct_identity': identity == expected_code if expected_code and accepted else None,
        'false_accept': accepted and (trial_type != 'genuine' or identity != expected_code),
        'false_reject': trial_type == 'genuine' and not accepted,
        'jpeg_bytes': result['jpeg_bytes'], 'processing_ms': result['processing_ms'],
    }


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('--check', action='store_true', help='Check local model files only; no camera or database')
    result.add_argument('--participants', nargs='+', help='Employee codes of people consenting to this experiment')
    result.add_argument('--confirmed-consent', action='store_true')
    result.add_argument('--expected-code', help='Expected enrolled identity; never written to report')
    result.add_argument('--trial-type', choices=['genuine', 'unknown', 'print', 'screen', 'video'])
    result.add_argument('--split', choices=['calibration', 'evaluation'])
    result.add_argument('--match', type=float)
    result.add_argument('--margin', type=float)
    result.add_argument('--consistency', type=float)
    result.add_argument('--turn-delta', type=float)
    result.add_argument('--camera', type=int, default=0)
    result.add_argument('--long-edge', type=int, default=720)
    result.add_argument('--quality', type=int, default=85)
    result.add_argument('--interval', type=float, default=0.5)
    result.add_argument('--output', type=Path, help='New JSON report, outside version control')
    return result


def validate_args(args):
    if args.check:
        return
    if not args.confirmed_consent:
        raise ValueError('Confirm informed consent before collecting webcam data')
    if not args.participants or not 2 <= len(set(args.participants)) <= 20:
        raise ValueError('Supply 2 to 20 distinct consenting gallery participants')
    if any(not code.strip() or len(code) > 50 for code in args.participants):
        raise ValueError('Invalid participant code')
    if not args.trial_type or not args.split or not args.output:
        raise ValueError('Supply trial type, split and a new output file')
    if args.trial_type == 'genuine' and args.expected_code not in args.participants:
        raise ValueError('Genuine trials need an expected gallery participant')
    if args.trial_type == 'unknown' and args.expected_code:
        raise ValueError('Unknown trials must not name an enrolled identity')
    for name, low, high in [('match', -1, 1), ('margin', 0.000001, 2),
                             ('consistency', -1, 1), ('turn_delta', 0.01, 1)]:
        value = getattr(args, name)
        if value is None or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('Supply finite explicit research thresholds within range')
    if (args.camera < 0 or not 1 <= args.long_edge <= 1920 or not 1 <= args.quality <= 100
            or not math.isfinite(args.interval) or not 0.2 <= args.interval <= 2):
        raise ValueError('Invalid capture settings')
    if args.output.exists():
        raise ValueError('Output already exists; use a new report filename')


def local_model_check(config):
    pack = Path.home() / '.insightface' / 'models' / config.MODEL_PACK_NAME
    return {'arcface_pack_present': pack.is_dir() and len(list(pack.glob('*.onnx'))) >= 2,
            'pad_model_present': Path(config.PAD_MODEL_PATH).is_file(),
            'model_version': config.EMBEDDING_MODEL_VERSION,
            'detector': 'scrfd', 'camera_opened': False, 'database_connected': False}


def main(argv=None):
    args = parser().parse_args(argv)
    validate_args(args)
    import config

    check = local_model_check(config)
    if args.check:
        print(json.dumps(check, indent=2))
        return 0 if check['arcface_pack_present'] and check['pad_model_present'] else 2
    if not check['arcface_pack_present'] or not check['pad_model_present']:
        raise RuntimeError('Local models missing; run --check and configure the existing runtime first')
    # Import only after CLI validation. Never trigger a model download in --help/--check.
    from antispoof.predictor import AntiSpoofPredictor
    from detection.detector import FaceDetector
    from recognition.embedder import FaceEmbedder

    # Match the API detector (SCRFD), and disable its small-face filtering so a
    # second small detected face is not silently removed before the count gate.
    with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
        detector = FaceDetector(model_name=config.MODEL_PACK_NAME, ctx_id=config.MODEL_CTX_ID,
                                det_size=config.DETECTOR_DET_SIZE,
                                conf_thresh=config.DETECTOR_CONF_THRESH, min_face_size=0)
        embedder = FaceEmbedder(model_name=config.MODEL_PACK_NAME, ctx_id=config.MODEL_CTX_ID)
        predictor = AntiSpoofPredictor()
    gallery = read_gallery(config.DB_CONN_INFO, args.participants, config.EMBEDDING_MODEL_VERSION)
    direction = secrets.choice(['image_left', 'image_right'])
    frames = capture_sequence(args.camera, direction, args.interval)
    result = evaluate_sequence(
        frames, detector=detector, predictor=predictor, embedder=embedder,
        align_face=strict_align_face, gallery=gallery, direction=direction,
        consistency=args.consistency, match=args.match, margin=args.margin,
        turn_delta=args.turn_delta, min_face_size=config.DETECTOR_MIN_FACE_SIZE,
        min_confidence=config.PAD_MIN_DETECTOR_CONFIDENCE,
        long_edge=args.long_edge, quality=args.quality,
    )
    capture_shapes = [list(frame.shape[:2]) for frame in frames]
    del frames
    try:
        revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT,
                                  capture_output=True, text=True, check=True).stdout.strip()
        dirty = bool(subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT,
                                    capture_output=True, text=True, check=True).stdout)
    except (OSError, subprocess.CalledProcessError):
        revision, dirty = 'unavailable', None
    report = {
        'schema_version': 1, 'created_at': datetime.now(timezone.utc).isoformat(),
        'revision': revision, 'working_tree_dirty': dirty,
        'decision': 'pending_operator_review', 'split': args.split,
        'trial_type': args.trial_type, 'gallery_people': len(set(args.participants)),
        'config': {
            'model_version': config.EMBEDDING_MODEL_VERSION, 'detector': 'scrfd',
            'pad_sha256': sha256(predictor.model_path),
            'arcface_sha256': sha256(embedder._model.model_file),
            'detector_sha256': sha256(detector._model.model_file),
            'pad_runtime_sha256': sha256(config.PAD_RUNTIME_CONFIG_PATH) if config.PAD_RUNTIME_CONFIG_PATH else None,
            'pad_logit_threshold': predictor.logit_threshold, 'pad_crop_mode': predictor.crop_mode,
            'pad_color_order': predictor.color_order, 'pad_input_size': predictor.model_img_size,
            'pad_bbox_expansion': predictor.bbox_expansion_factor,
            'pad_apply_gamma': predictor.apply_gamma,
            'pad_gamma_target': config.PAD_GAMMA_TARGET,
            'pad_mean': predictor.mean, 'pad_std': predictor.std,
            'pad_lighting_profile': predictor.lighting_transform.profile,
            'pad_adaptive_profile': predictor.threshold_adapter.profile,
            'jpeg_quality': args.quality, 'long_edge': args.long_edge,
            'capture_shapes_hw': capture_shapes,
            'interval_seconds': args.interval, 'frame_count': 5,
            'match': args.match, 'margin': args.margin, 'consistency': args.consistency,
            'turn_delta': args.turn_delta, 'direction': direction,
            'minimum_face_size': config.DETECTOR_MIN_FACE_SIZE,
            'minimum_detector_confidence': config.PAD_MIN_DETECTOR_CONFIDENCE,
            'challenge_method': 'five_landmark_nose_displacement_heuristic',
            'pad_aggregation': 'all_five_real', 'search': 'exact_numpy_gallery_baseline',
        },
        'source_sha256': {str(path.relative_to(ROOT)): sha256(path) for path in [
            Path(__file__).resolve(), *sorted((ROOT / 'face_login').glob('*.py')),
        ]},
        'environment': {'python': sys.version.split()[0], 'opencv': cv2.__version__, 'numpy': np.__version__},
        'result': public_trial_result(result, args.trial_type, args.expected_code),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
    print(json.dumps(report['result'], indent=2))
    print('Experiment complete; go/no-go remains pending operator review.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('Cancelled; camera released.', file=sys.stderr)
        sys.exit(130)
    except Exception as exc:
        # Connection/model errors can contain secrets or identifiers.
        print(f'Spike stopped ({type(exc).__name__}); check configuration and local prerequisites.', file=sys.stderr)
        sys.exit(2)
