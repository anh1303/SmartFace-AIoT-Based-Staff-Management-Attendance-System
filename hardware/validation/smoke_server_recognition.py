"""Real HTTP Pi client -> Node gateway -> Python ONNX; isolated, no database/attendance."""
import importlib.util
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import build_opener, ProxyHandler

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'hardware'))
from recognition.remote import RemoteFaceEmbedder


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def main():
    ai_port, api_port = port(), port()
    token, internal = secrets.token_hex(24), secrets.token_hex(24)
    env = {**os.environ, 'FACE_AUTH_INTERNAL_KEY': internal, 'REMOTE_RECOGNITION_ENABLED': 'true',
           'EDGE_RECOGNITION_KEYS':json.dumps({'SMOKE_PI':token}), 'FACE_AUTH_URL':f'http://127.0.0.1:{ai_port}',
           'FACE_AUTH_MODEL_VERSION':'buffalo_s', 'DATABASE_URL':'postgresql://fixture:fixture@127.0.0.1:1/no_database',
           'DIRECT_URL':'postgresql://fixture:fixture@127.0.0.1:1/no_database',
           'JWT_SECRET':'isolated-smoke-jwt-'.ljust(40,'x'), 'MQTT_DEVICE_SECRET':'isolated-smoke-mqtt-'.ljust(40,'x'),
           'BIOMETRIC_ENCRYPTION_KEY':'0'*64, 'PAD_RUNTIME_CONFIG_PATH':'', 'PAD_ADAPTIVE_ENABLED':'false',
           'PYTHONDONTWRITEBYTECODE':'1', 'NO_PROXY':'127.0.0.1,localhost', 'no_proxy':'127.0.0.1,localhost'}
    python_code = f"""
import importlib.util, sys
sys.path.insert(0, {str(ROOT/'face_auth')!r})
import api_service as api
from remote_extraction import AlignedFaceExtractor
spec=importlib.util.spec_from_file_location('hardware_embedder', {str(ROOT/'hardware/recognition/embedder.py')!r})
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
model=module.FaceEmbedder({str(ROOT/'hardware/models/w600k_mbf.onnx')!r})
api.remote_extractor=AlignedFaceExtractor(model.session, {str(ROOT/'hardware/models/w600k_mbf.onnx')!r}, 'buffalo_s')
api.app.router.on_startup.clear()  # Fixture: never create VectorDB, detector or enrollment models.
import uvicorn
uvicorn.run(api.app, host='127.0.0.1', port={ai_port}, log_level='error', access_log=False)
"""
    node_code = f"""
import express from 'express';
import {{deviceRouter}} from './dist/modules/devices/device.routes.js';
import {{errorHandler}} from './dist/middlewares/errorHandler.js';
const app=express(); app.use(express.json({{limit:'80kb'}}));app.use('/api/devices',deviceRouter);app.use(errorHandler);
const server=app.listen({api_port},'127.0.0.1');process.on('SIGTERM',()=>server.close());
"""
    processes = []
    with tempfile.TemporaryFile(mode='w+') as log:
        try:
            processes.append(subprocess.Popen([sys.executable,'-c',python_code],env=env,stdout=log,stderr=log))
            processes.append(subprocess.Popen(['node','--input-type=module','-e',node_code],cwd=ROOT/'backend',env=env,stdout=log,stderr=log))
            opener=build_opener(ProxyHandler({}))
            for base in (f'http://127.0.0.1:{ai_port}',f'http://127.0.0.1:{api_port}'):
                deadline=time.monotonic()+20
                while True:
                    if any(p.poll() is not None for p in processes): raise RuntimeError('Fixture process exited')
                    try: opener.open(base, timeout=.2);break
                    except HTTPError: break  # 404 proves that the HTTP server is ready.
                    except OSError:
                        if time.monotonic()>deadline: raise TimeoutError('Fixture did not start')
                        time.sleep(.05)
            remote=RemoteFaceEmbedder(f'http://127.0.0.1:{api_port}', 'SMOKE_PI', token)
            spec=importlib.util.spec_from_file_location('local_pi_embedder', ROOT/'hardware/recognition/embedder.py')
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            local=module.FaceEmbedder(str(ROOT/'hardware/models/w600k_mbf.onnx'))
            for seed in range(3):
                face=np.random.default_rng(seed).integers(0,256,(112,112,3),dtype=np.uint8)
                np.testing.assert_array_equal(remote.extract(face),local.extract(face))
            denied=RemoteFaceEmbedder(f'http://127.0.0.1:{api_port}', 'SMOKE_PI','wrong'.ljust(40,'x'))
            try: denied.extract(face);raise AssertionError('Wrong credentials accepted')
            except HTTPError as exc: assert exc.code==401
            print(json.dumps({'status':'passed', 'samples':3, 'vector_parity':'bitwise equal',
                'transport':'real HTTP through production deviceRouter and FastAPI endpoint',
                'model':'existing hardware ONNX', 'database':'not connected; no attendance writes',
                'last_request':remote.last_metrics},indent=2))
        except Exception:
            log.seek(0);print(log.read(),file=sys.stderr);raise
        finally:
            for process in processes: process.terminate()
            for process in processes:
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill();process.wait()


if __name__=='__main__': main()
