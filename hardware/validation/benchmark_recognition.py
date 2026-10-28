"""Run each mode in a separate Pi process. Measures extraction only, not camera FPS."""
import argparse
import json
import os
from pathlib import Path
import platform
import resource
import sys
import time

import cv2
import numpy as np
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from recognition.remote import RemoteFaceEmbedder, ARCFACE_SHA256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', choices=('local', 'server'), required=True)
    parser.add_argument('--aligned-dir', type=Path, required=True, help='PNG images already aligned to BGR 112x112')
    parser.add_argument('--samples', type=int, default=30)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.samples < 1: parser.error('--samples must be positive')
    paths = sorted(args.aligned_dir.glob('*.png'))
    if not paths: parser.error('No aligned PNG images found')
    faces = [cv2.imread(str(path)) for path in paths]
    if any(face is None or face.shape != (112,112,3) for face in faces): parser.error('All images must be aligned 112x112 PNGs')
    load_dotenv(ROOT/'.env')
    if args.backend == 'local':
        from recognition.embedder import FaceEmbedder
        embedder = FaceEmbedder(intra_op_threads=int(os.getenv('RECOGNITION_INTRA_OP_THREADS','1')))
    else:
        embedder = RemoteFaceEmbedder(os.getenv('BACKEND_BASE_URL',''), os.getenv('DEVICE_ID','PI4_FRONT_GATE'),
            os.getenv('EDGE_RECOGNITION_TOKEN',''), os.getenv('REMOTE_ARCFACE_SHA256', ARCFACE_SHA256),
            os.getenv('EMBEDDING_MODEL_VERSION','buffalo_s'), float(os.getenv('REMOTE_RECOGNITION_TIMEOUT_SECONDS','3')))
    for _ in range(3): embedder.extract(faces[0])
    wall_ms, cpu_ms, errors, uploads = [], [], [], []
    for i in range(args.samples):
        wall, cpu = time.perf_counter(), time.process_time()
        try:
            embedder.extract(faces[i % len(faces)])
            wall_ms.append((time.perf_counter()-wall)*1000)
            cpu_ms.append((time.process_time()-cpu)*1000)
            if args.backend == 'server': uploads.append(embedder.last_metrics['upload_bytes'])
        except Exception as exc: errors.append(type(exc).__name__)
        time.sleep(1)  # Match the default recognition cadence; avoid artificial server bursts.
    def stats(values):
        return {'p50':round(float(np.percentile(values,50)),3), 'p95':round(float(np.percentile(values,95)),3)} if values else None
    result = {'backend':args.backend, 'platform':platform.platform(), 'scope':'extraction only; excludes detection, PAD, camera and streaming',
              'attempted':args.samples, 'successful':len(wall_ms), 'errors':errors,
              'wall_ms':stats(wall_ms), 'client_cpu_ms':stats(cpu_ms), 'upload_bytes':stats(uploads),
              'max_rss_mib':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024**2 if sys.platform=='darwin' else 1024),2)}
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return int(bool(errors))


if __name__ == '__main__': raise SystemExit(main())
