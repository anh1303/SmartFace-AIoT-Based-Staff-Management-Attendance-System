"""HTTP login contract. No camera, real database or attendance dependency."""
import base64
import asyncio
import json
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException

from face_login.http import build_router, decode_jpeg


class Client:
    def __init__(self, app):
        self.app = app

    def post(self, path, *, json: dict, headers=None):
        payload = __import__('json').dumps(json).encode()
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
        self.models = SimpleNamespace(detector=object(), embedder=object(), predictor=object())
        app = FastAPI()
        app.include_router(build_router(lambda: self.models, auth))
        self.client = Client(app)
        ok, image = cv2.imencode('.jpg', np.zeros((100, 100, 3), dtype=np.uint8))
        self.assertTrue(ok)
        self.jpeg = base64.b64encode(image).decode()
        self.body = dict(request_id='a' * 32, frames=[self.jpeg] * 8, recognition_count=3)

    def test_internal_key_required_and_extra_fields_rejected(self):
        self.assertEqual(self.client.post('/internal/face-login/extract', json=self.body).status_code, 401)
        self.assertEqual(self.client.post('/internal/face-login/extract', json={**self.body, 'employee_id': 'x'},
                                        headers={'X-Face-Auth-Key': 'internal-test-key'}).status_code, 422)

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

    def test_rejection_does_not_return_vector_and_success_is_extraction_only(self):
        headers = {'X-Face-Auth-Key': 'internal-test-key'}
        with patch('face_login.http.extract_login_embeddings', return_value=[]):
            result = self.client.post('/internal/face-login/extract', json=self.body, headers=headers)
        self.assertEqual(result.json()['status'], 'rejected')
        self.assertNotIn('embeddings', result.json())
        with patch('face_login.http.extract_login_embeddings', return_value=[np.ones(512) / np.sqrt(512)] * 3):
            result = self.client.post('/internal/face-login/extract', json=self.body, headers=headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.json()['embeddings']), 3)
        self.assertEqual(len(result.json()['embeddings'][0]), 512)
        self.assertNotIn('employee_id', result.json())

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
