"""Remote extraction transport and contract checks without camera/GPIO/network services."""
import base64
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from recognition.remote import RemoteFaceEmbedder, ARCFACE_SHA256
import edge_client as edge


class RemoteTests(unittest.TestCase):
    def setUp(self):
        self.client = RemoteFaceEmbedder("http://127.0.0.1:3000", "PI4_FRONT_GATE", "x" * 32)
        self.face = np.random.default_rng(7).integers(0, 256, (112, 112, 3), dtype=np.uint8)
        self.vector = np.ones(512, dtype=np.float32) / np.sqrt(np.float32(512))

    def response(self, request, **kwargs):
        data = json.loads(request.data)
        image = cv2.imdecode(np.frombuffer(base64.b64decode(data['image_png_b64']), np.uint8), cv2.IMREAD_COLOR)
        np.testing.assert_array_equal(image, self.face)
        self.assertEqual(request.get_header('Authorization'), 'Bearer ' + 'x' * 32)
        self.assertNotIn('antispoof_score', data)  # This endpoint cannot write attendance.
        data.pop('image_png_b64')
        data['embedding_b64'] = base64.b64encode(self.vector.astype('<f4').tobytes()).decode()
        data['inference_ms'] = 1.25
        return data

    def install_response(self, transform=lambda x: x):
        response = Mock()
        def open_request(request, **kwargs):
            response.read.return_value = json.dumps(transform(self.response(request))).encode()
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            return response
        self.client.opener.open = Mock(side_effect=open_request)

    def test_lossless_png_transport_and_float32_vector(self):
        self.install_response()
        np.testing.assert_array_equal(self.client.extract(self.face), self.vector)
        self.assertLess(self.client.last_metrics['upload_bytes'], 60000)
        self.assertEqual(self.client.last_metrics['inference_ms'], 1.25)

    def test_rejects_wrong_correlation_model_and_vector(self):
        for update in ({'request_id': '0'*32}, {'model_sha256':'0'*64}, {'model_version':'different'},
                       {'embedding_b64':base64.b64encode(np.zeros(512, '<f4')).decode()},
                       {'embedding_b64':'invalid!'}):
            with self.subTest(update=list(update)):
                self.install_response(lambda data: {**data, **update})
                with self.assertRaises(ValueError): self.client.extract(self.face)

    def test_network_errors_and_expired_results_are_not_identities(self):
        self.client.opener.open = Mock(side_effect=TimeoutError())
        with self.assertRaises(TimeoutError): self.client.extract(self.face)
        self.install_response()
        with patch('recognition.remote.time.monotonic', side_effect=[0, 4]):
            with self.assertRaises(TimeoutError): self.client.extract(self.face)

    def test_rejects_invalid_configuration(self):
        for url in ('', 'ftp://host', 'http://user:pass@host', 'http://host/path', 'http://host?x=1'):
            with self.assertRaises(ValueError): RemoteFaceEmbedder(url, 'PI', 'x'*32)
        with self.assertRaises(ValueError): RemoteFaceEmbedder('http://host', 'PI', '')

    def test_server_selection_never_constructs_local_arcface(self):
        # Stop immediately at camera setup, after all AI objects were selected.
        with patch.dict('os.environ', {'RECOGNITION_BACKEND':'server', 'BACKEND_BASE_URL':'http://127.0.0.1:3000', 'EDGE_RECOGNITION_TOKEN':'x'*32}), \
             patch.object(edge, 'FaceEmbedder') as local, \
             patch.object(edge, 'RemoteFaceEmbedder') as remote, \
             patch.object(edge, 'create_detector'), patch.object(edge, 'FaceTracker'), \
             patch.object(edge, 'AntiSpoofPredictor'), patch.object(edge, 'ThingsBoardClient'), \
             patch.object(edge.cv2, 'VideoCapture', side_effect=RuntimeError('stop-before-camera')), \
             patch('builtins.print'):
            with self.assertRaisesRegex(RuntimeError, 'stop-before-camera'): edge.main()
            local.assert_not_called()
            remote.assert_called_once()
            self.assertEqual(remote.call_args.args[3], ARCFACE_SHA256)


if __name__ == '__main__': unittest.main()
