"""Streaming face-login sessions: incremental PAD, resets, replay, fencing and HTTP contract."""
import base64
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException

from face_login.http import build_router
from face_login.pipeline import process_frame
from face_login.sessions import SessionStore
from tests.test_face_login_http import Client

FACE = {'bbox': (10, 10, 90, 90), 'score': 0.99,
        'landmarks': [[30, 30], [70, 30], [50, 50], [35, 70], [65, 70]]}
SHIFTED_FACE = {'bbox': (100, 100, 180, 180), 'score': 0.99,
                'landmarks': [[120, 120], [160, 120], [140, 140], [125, 160], [155, 160]]}
EDGE_FACE = {'bbox': (0, 0, 80, 80), 'score': 0.99,
             'landmarks': [[20, 20], [60, 20], [40, 40], [25, 60], [55, 60]]}
FRAME = np.zeros((200, 200, 3), dtype=np.uint8)


def models(votes, detect=None):
    scores = iter(votes)
    def predict(_frame, _bbox):
        real = next(scores)
        return {'is_real': real, 'pad_score': 2.0 if real else -2.0, 'threshold_logit': 0.0}
    vec = np.zeros(512); vec[0] = 1
    return dict(detector=SimpleNamespace(detect=detect or (lambda _f: [FACE])),
                predictor=SimpleNamespace(predict_frame=predict),
                embedder=SimpleNamespace(input_size=(112, 112), embed_aligned=lambda _f: vec),
                align_face=lambda *_a: np.zeros((112, 112, 3), dtype=np.uint8))


class IncrementalPipelineTests(unittest.TestCase):
    def run_votes(self, votes, **kw):
        with patch('face_login.sessions.config.PAD_MIN_VOTES', 3), \
             patch('face_login.sessions.config.PAD_SMOOTH_WINDOW', 5), \
             patch('face_login.sessions.config.PAD_SPOOF_MIN_RATIO', 0.6):
            store = SessionStore()
            store.create('a' * 32, 1, 15)
            m = models(votes, **kw)
            out = []
            for seq in range(1, len(votes) + 1):
                session, _, _ = store.begin('a' * 32, 1, seq, f'd{seq}')
                out.append(store.finish(session, seq, process_frame(session, FRAME, **m), f'd{seq}'))
            return out

    def test_all_real_produces_first_embedding_on_third_frame(self):
        statuses = [item['status'] for item in self.run_votes([True] * 5)]
        self.assertEqual(statuses, ['pending', 'pending', 'embedding', 'embedding', 'embedding'])

    def test_raw_spoof_and_rolling_spoof_reset_confirmation_eligibility_until_pad_recovers(self):
        raw = self.run_votes([True, True, False, True, True])
        self.assertEqual([item['status'] for item in raw], ['pending', 'pending', 'reset', 'embedding', 'embedding'])
        self.assertEqual(raw[2]['reason'], 'raw_spoof')
        rolling = self.run_votes([True, False, False, True, True, True, True])
        self.assertEqual(rolling[2], {'status': 'reset', 'reason': 'spoof'})
        self.assertEqual(rolling[-1]['status'], 'embedding')

    def test_no_face_quality_and_iou_track_break_reset_pad_continuity(self):
        seq_faces = iter([[FACE], [FACE], [], [FACE], [EDGE_FACE], [FACE], [SHIFTED_FACE], [SHIFTED_FACE], [SHIFTED_FACE], [SHIFTED_FACE]])
        out = self.run_votes([True] * 10, detect=lambda _f: next(seq_faces))
        reasons = [(item['status'], item['reason']) for item in out]
        self.assertEqual(reasons[2], ('reset', 'no_face'))
        self.assertEqual(reasons[4], ('reset', 'face_quality'))
        self.assertEqual(reasons[6], ('reset', 'track_changed'))
        # After track_changed at index 6, two more frames (7, 8) are pending before index 9 embeds.
        self.assertEqual([item['status'] for item in out[7:]], ['pending', 'pending', 'embedding'])

    def test_two_sessions_are_isolated(self):
        with patch('face_login.sessions.config.PAD_MIN_VOTES', 3):
            store = SessionStore()
            store.create('a' * 32, 1, 15)
            store.create('b' * 32, 1, 15)
            m_real = models([True] * 5)
            m_spoof = models([False] * 5)
            for seq in (1, 2):
                s_a, _, _ = store.begin('a' * 32, 1, seq, f'a{seq}')
                store.finish(s_a, seq, process_frame(s_a, FRAME, **m_real), f'a{seq}')
            s_b, _, _ = store.begin('b' * 32, 1, 1, 'b1')
            store.finish(s_b, 1, process_frame(s_b, FRAME, **m_spoof), 'b1')
            s_a, _, _ = store.begin('a' * 32, 1, 3, 'a3')
            res_a = store.finish(s_a, 3, process_frame(s_a, FRAME, **m_real), 'a3')
            self.assertEqual(res_a['status'], 'embedding')


class StoreTests(unittest.TestCase):
    def test_replay_digest_conflict_gap_fencing_and_ttl(self):
        now = [0.0]
        store = SessionStore(clock=lambda: now[0], maximum=1, gap_seconds=2.0)
        store.create('a' * 32, 1, 15)
        with self.assertRaises(OverflowError):
            store.create('b' * 32, 1, 15)
        session, cached, gap = store.begin('a' * 32, 1, 1, 'digest-1')
        self.assertIsNone(cached)
        self.assertFalse(gap)
        with self.assertRaises(ValueError):  # concurrent caller
            store.begin('a' * 32, 1, 1, 'digest-1')
        store.finish(session, 1, {'status': 'pending'}, 'digest-1')
        self.assertEqual(store.begin('a' * 32, 1, 1, 'digest-1')[1], {'status': 'pending'})  # exact replay
        with self.assertRaises(ValueError):  # same seq, different image digest -> conflict
            store.begin('a' * 32, 1, 1, 'different-digest')
        with self.assertRaises(ValueError):  # future seq
            store.begin('a' * 32, 1, 5, 'd5')
        with self.assertRaises(LookupError):  # wrong epoch
            store.begin('a' * 32, 2, 2, 'd2')
        # Advance clock > 2.0s to trigger inter-frame receipt gap.
        now[0] = 2.5
        session, _, gap = store.begin('a' * 32, 1, 2, 'digest-2')
        self.assertTrue(gap)
        store.close('a' * 32)  # cancel while inference runs
        self.assertEqual(len(store), 1)  # physical cleanup waits for work
        self.assertIsNone(store.finish(session, 2, {'status': 'embedding'}, 'digest-2'))  # late result discarded
        store.sweep()
        self.assertEqual(len(store), 0)
        with self.assertRaises(LookupError):  # never recreated
            store.begin('a' * 32, 1, 3, 'digest-3')


class StreamingHttpTests(unittest.TestCase):
    def setUp(self):
        def auth(key):
            if key != 'k':
                raise HTTPException(401, 'Unauthorized')
        self.now = [0.0]
        self.calls = 0
        def predict(*_a):
            self.calls += 1
            return {'is_real': True, 'pad_score': 2.0, 'threshold_logit': 0.0}
        self.models = SimpleNamespace(detector=SimpleNamespace(detect=lambda _f: [FACE]), embedder=None,
                                      predictor=SimpleNamespace(predict_frame=predict))
        app = FastAPI()
        self.router = build_router(lambda: self.models, auth, store=SessionStore(clock=lambda: self.now[0]))
        app.include_router(self.router)
        self.client = Client(app)
        self.h = {'X-Face-Auth-Key': 'k'}
        ok, image1 = cv2.imencode('.jpg', FRAME)
        ok2, image2 = cv2.imencode('.jpg', np.ones((200, 200, 3), dtype=np.uint8) * 10)
        self.assertTrue(ok and ok2)
        self.jpeg = base64.b64encode(image1).decode()
        self.other_jpeg = base64.b64encode(image2).decode()

    def test_create_frame_replay_conflict_gap_busy_and_cancel(self):
        aid = 'c' * 32
        self.assertEqual(self.client.post('/internal/face-login/attempts', json={'attempt_id': aid, 'epoch': 1, 'ttl_ms': 15000}).status_code, 401)
        created = self.client.post('/internal/face-login/attempts', json={'attempt_id': aid, 'epoch': 1, 'ttl_ms': 15000}, headers=self.h)
        self.assertIn('boot_id', created.json())
        path = f'/internal/face-login/attempts/{aid}/frames'
        first = self.client.post(path, json={'epoch': 1, 'seq': 1, 'operation_id': 'op-1', 'frame': self.jpeg}, headers=self.h)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()['status'], 'pending')
        self.assertEqual(self.calls, 1)
        # Identical seq + digest replays cached result without running inference a second time.
        replay = self.client.post(path, json={'epoch': 1, 'seq': 1, 'operation_id': 'op-1b', 'frame': self.jpeg}, headers=self.h)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.json()['operation_id'], 'op-1b')
        self.assertEqual(self.calls, 1)
        # Same seq + different image -> 409 conflict.
        self.assertEqual(self.client.post(path, json={'epoch': 1, 'seq': 1, 'frame': self.other_jpeg}, headers=self.h).status_code, 409)
        # Busy inference semaphore -> 429 without advancing sequence.
        self.router.inference_slot.acquire()
        try:
            self.assertEqual(self.client.post(path, json={'epoch': 1, 'seq': 2, 'frame': self.jpeg}, headers=self.h).status_code, 429)
        finally:
            self.router.inference_slot.release()
        # Inter-frame receipt gap > 2.0s resets continuity and reports frame_gap.
        self.now[0] = 2.5
        gapped = self.client.post(path, json={'epoch': 1, 'seq': 2, 'frame': self.jpeg}, headers=self.h)
        self.assertEqual(gapped.status_code, 200)
        self.assertEqual(gapped.json()['status'], 'reset')
        self.assertEqual(gapped.json()['reason'], 'frame_gap')
        # Out-of-order seq -> 409.
        self.assertEqual(self.client.post(path, json={'epoch': 1, 'seq': 4, 'frame': self.jpeg}, headers=self.h).status_code, 409)
        self.client.post(f'/internal/face-login/attempts/{aid}/cancel', json={}, headers=self.h)
        self.assertEqual(self.client.post(path, json={'epoch': 1, 'seq': 3, 'frame': self.jpeg}, headers=self.h).status_code, 410)


if __name__ == '__main__':
    unittest.main()
