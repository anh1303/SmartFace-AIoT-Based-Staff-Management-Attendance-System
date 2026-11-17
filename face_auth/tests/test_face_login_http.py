"""HTTP streaming login contract. No camera, real database or attendance dependency."""
import asyncio
import base64
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException

from face_login.http import build_router, decode_jpeg


class Client:
    def __init__(self, app):
        self.app = app

    def post(self, path, *, json: dict = None, raw: bytes = None, headers=None):
        payload = raw if raw is not None else __import__('json').dumps(json or {}).encode()
        messages = []
        async def run():
            sent = False
            async def receive():
                nonlocal sent
                if not sent:
                    sent = True
                    return {'type': 'http.request', 'body': payload, 'more_body': False}
                return {'type': 'http.disconnect'}
            async def send(message):
                messages.append(message)
            raw_headers = [(b'content-type', b'application/json'), (b'content-length', str(len(payload)).encode())]
            raw_headers += [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()]
            await self.app({'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                            'method': 'POST', 'scheme': 'http', 'path': path, 'raw_path': path.encode(),
                            'query_string': b'', 'headers': raw_headers, 'server': ('test', 80),
                            'client': ('127.0.0.1', 1), 'root_path': ''}, receive, send)
        asyncio.run(run())
        body = b''.join(item.get('body', b'') for item in messages)
        return SimpleNamespace(status_code=messages[0]['status'], json=lambda: __import__('json').loads(body))


class FaceLoginHttpTests(unittest.TestCase):
    def setUp(self):
        def auth(key):
            if key != 'internal-test-key':
                raise HTTPException(401, 'Unauthorized')
        face = {'bbox': (10, 10, 90, 90), 'score': 0.99,
                'landmarks': [[30, 30], [70, 30], [50, 50], [35, 70], [65, 70]]}
        vec = np.zeros(512, dtype=np.float32); vec[0] = 1
        self.models = SimpleNamespace(
            detector=SimpleNamespace(detect=lambda _f: [face]),
            embedder=SimpleNamespace(input_size=(112, 112), embed_aligned=lambda _f: vec),
            predictor=SimpleNamespace(predict_frame=lambda *_a: {'is_real': True, 'pad_score': 2.0, 'threshold_logit': 0.0}),
        )
        app = FastAPI()
        self.router = build_router(lambda: self.models, auth)
        app.include_router(self.router)
        self.client = Client(app)
        self.headers = {'X-Face-Auth-Key': 'internal-test-key'}
        ok, image = cv2.imencode('.jpg', np.zeros((100, 100, 3), dtype=np.uint8))
        self.assertTrue(ok)
        self.jpeg = base64.b64encode(image).decode()
        self.attempt_id = 'a' * 32

    def test_internal_key_required_extra_fields_rejected_and_body_cap_enforced(self):
        create_body = {'attempt_id': self.attempt_id, 'epoch': 1, 'ttl_ms': 15000}
        self.assertEqual(self.client.post('/internal/face-login/attempts', json=create_body).status_code, 401)
        self.assertEqual(self.client.post('/internal/face-login/attempts',
                                          json={**create_body, 'employee_id': 'x'}, headers=self.headers).status_code, 422)
        self.client.post('/internal/face-login/attempts', json=create_body, headers=self.headers)
        self.assertEqual(
            self.client.post(f'/internal/face-login/attempts/{self.attempt_id}/frames',
                             json={'epoch': 1, 'seq': 1, 'frame': self.jpeg, 'employee_id': 'x'},
                             headers=self.headers).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(f'/internal/face-login/attempts/{self.attempt_id}/frames',
                             raw=b'x' * (300 * 1024 + 1), headers=self.headers).status_code,
            413,
        )

    def test_decode_rejects_invalid_non_jpeg_and_large_pixels_before_cv_decode(self):
        with self.assertRaises(ValueError):
            decode_jpeg('not base64')
        _, png = cv2.imencode('.png', np.zeros((10, 10, 3), dtype=np.uint8))
        with self.assertRaises(ValueError):
            decode_jpeg(base64.b64encode(png).decode())
        with patch('PIL.Image.open') as image_open, patch('cv2.imdecode') as decode:
            image_open.return_value.__enter__.return_value.size = (10000, 10000)
            image_open.return_value.__enter__.return_value.format = 'JPEG'
            with self.assertRaises(ValueError):
                decode_jpeg(self.jpeg)
            decode.assert_not_called()

    def test_streaming_frames_never_return_identity_and_emit_embedding_only_when_pad_ready(self):
        with patch('face_login.sessions.config.PAD_MIN_VOTES', 3):
            self.client.post('/internal/face-login/attempts',
                             json={'attempt_id': self.attempt_id, 'epoch': 1, 'ttl_ms': 15000}, headers=self.headers)
            path = f'/internal/face-login/attempts/{self.attempt_id}/frames'
            first = self.client.post(path, json={'epoch': 1, 'seq': 1, 'operation_id': 'op1', 'frame': self.jpeg}, headers=self.headers).json()
            second = self.client.post(path, json={'epoch': 1, 'seq': 2, 'operation_id': 'op2', 'frame': self.jpeg}, headers=self.headers).json()
            third = self.client.post(path, json={'epoch': 1, 'seq': 3, 'operation_id': 'op3', 'frame': self.jpeg}, headers=self.headers).json()
        self.assertEqual(first['status'], 'pending')
        self.assertNotIn('embedding', first)
        self.assertEqual(second['status'], 'pending')
        self.assertEqual(third['status'], 'embedding')
        self.assertEqual(third['operation_id'], 'op3')
        self.assertEqual(len(third['embedding']), 512)
        self.assertNotIn('employee_id', third)

    def test_login_detector_counts_small_secondary_faces(self):
        from detection.detector import FaceDetector
        detector = FaceDetector.__new__(FaceDetector)
        detector.min_face_size = 60
        detector._model = SimpleNamespace(detect=lambda *args, **kwargs: (
            np.array([[10, 10, 90, 90, .99], [110, 10, 130, 30, .99]]),
            np.zeros((2, 5, 2)),
        ))
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        self.assertEqual(len(detector.detect(frame)), 1)
        self.assertEqual(len(detector.detect(frame, min_face_size=0)), 2)


if __name__ == '__main__':
    unittest.main()
