"""Offline regression tests: no MQTT broker, camera, GPIO or backend writes."""
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tb_policy_client', ROOT / 'iot/thingsboard_client.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeMQTT:
    def __init__(self, rc=0): self.rc, self.sent = rc, []
    def publish(self, topic, payload, qos=0):
        self.sent.append((topic, json.loads(payload), qos))
        return SimpleNamespace(rc=self.rc)


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.tb = module.ThingsBoardClient('test.invalid', 1883, 'test-only')
        self.tb.client = FakeMQTT()
        self.tb.connected = True
        self.vector = np.ones(512, dtype=np.float32)
        self.results = []

    def scan(self, **kwargs):
        return self.tb.send_scan_rpc(self.vector, 0.9, 'CHECK_IN', self.results.append, **kwargs)

    def test_single_device_defaults_to_auto(self):
        self.assertEqual(self.tb.current_mode, 'AUTO')

    def response(self, request, payload):
        msg = SimpleNamespace(topic=f'v1/devices/me/rpc/response/{request}', payload=json.dumps(payload).encode())
        self.tb.on_message(self.tb.client, None, msg)

    def test_publish_failure_does_not_lock_or_keep_pending(self):
        self.tb.client.rc = 4
        self.assertEqual(self.scan(), -1)
        self.assertFalse(self.tb._pending_rpc_callbacks)

    def test_disconnected_returns_failure(self):
        self.tb.connected = False
        self.assertEqual(self.scan(), -1)

    def test_retries_identical_event_capture_and_payload(self):
        request = self.scan(event_id='stable-test-id', captured_at=123456789)
        info = self.tb._pending_rpc_callbacks[str(request)]
        info['deadline'] = 0
        self.tb.poll_pending()
        self.assertEqual(self.tb.client.sent[0], self.tb.client.sent[1])
        self.assertEqual(self.tb.client.sent[0][1]['params']['event_id'], 'stable-test-id')
        self.assertEqual(self.tb.client.sent[0][1]['params']['client_timestamp'], 123456789)

    def test_unknown_and_mismatched_responses_are_ignored(self):
        request = self.scan(event_id='expected-id')
        self.response(request + 1, {'event_id':'expected-id', 'success':True})
        self.response(request, {'event_id':'other-id', 'success':True})
        self.assertEqual(self.results, [])
        self.assertIn(str(request), self.tb._pending_rpc_callbacks)
        self.response(request, {'event_id':'expected-id', 'success':True})
        self.assertEqual(len(self.results), 1)
        self.response(request, {'event_id':'expected-id', 'success':True})
        self.assertEqual(len(self.results), 1)

    def test_timeout_is_bounded_and_explicitly_uncertain(self):
        request = self.scan(event_id='timeout-id')
        for _ in range(3):
            self.tb._pending_rpc_callbacks[str(request)]['deadline'] = 0
            self.tb.poll_pending()
        self.assertFalse(self.tb._pending_rpc_callbacks)
        self.assertTrue(self.results[0]['uncertain'])
        self.assertEqual(self.results[0]['event_id'], 'timeout-id')

    def test_relay_envelopes_preserve_event_correlation(self):
        for wrap in (lambda p: {'success': True, 'data': p}, json.dumps):
            with self.subTest(wrap=wrap):
                request = self.scan(event_id='relay-event-id')
                self.response(request, wrap({'event_id': 'wrong-event', 'success': True}))
                self.assertIn(str(request), self.tb._pending_rpc_callbacks)
                result = {'event_id': 'relay-event-id', 'success': True, 'matched': True}
                before = len(self.results)
                self.response(request, wrap(result))
                self.assertEqual(self.results[-1], result)
                self.response(request, wrap(result))
                self.assertEqual(len(self.results), before + 1)

    def test_late_success_after_timeout_is_delivered_once(self):
        request = self.scan(event_id='late-event-id')
        for _ in range(self.tb.max_attempts):
            self.tb._pending_rpc_callbacks[str(request)]['deadline'] = 0
            self.tb.poll_pending()
        result = {'event_id': 'late-event-id', 'success': True, 'matched': True}
        self.response(request, result)
        self.response(request, result)
        self.assertEqual(self.results, [self.results[0], result])
        self.assertTrue(self.results[0]['uncertain'])

    def test_pad_zero_is_preserved_and_nonfinite_or_bad_vectors_rejected(self):
        request = self.tb.send_scan_rpc(self.vector, 0.0, 'CHECK_IN')
        self.assertGreater(request, 0)
        self.assertEqual(self.tb.client.sent[-1][1]['params']['antispoof_score'], 0.0)
        self.assertEqual(self.tb.send_scan_rpc(self.vector, float('nan'), 'CHECK_IN'), -1)
        self.assertEqual(self.tb.send_scan_rpc(np.zeros(512), .9, 'CHECK_IN'), -1)
        self.assertEqual(self.tb.send_scan_rpc(np.ones(511), .9, 'CHECK_IN'), -1)

    def test_stale_shared_mode_cannot_revert_recent_rpc(self):
        self.tb.notify_backend_mode = lambda mode: None
        self.assertTrue(self.tb.set_mode('CHECK_OUT', 2000))
        self.assertFalse(self.tb.set_mode('CHECK_IN', 1000))
        self.assertEqual(self.tb.current_mode, 'CHECK_OUT')

    def test_attribute_readback_does_not_emit_relay_loop(self):
        self.tb.notify_backend_mode = lambda mode: None
        self.tb.set_mode('CHECK_OUT', 2000)
        count = len(self.tb.client.sent)
        self.tb.set_mode('CHECK_OUT', 3000)
        self.assertEqual(len(self.tb.client.sent), count)

    def test_security_event_contains_no_embedding(self):
        self.assertTrue(self.tb.send_spoof_event(0.1, 'CHECK_IN'))
        payload = self.tb.client.sent[-1][1]['params']
        self.assertEqual(payload['event_kind'], 'SPOOF')
        self.assertNotIn('embedding', payload)
        self.assertNotIn('embedding_b64', payload)

    def test_mode_notification_never_blocks_mqtt_callback(self):
        with patch.dict('os.environ', {'BACKEND_BASE_URL':'', 'TB_WEBHOOK_SECRET':''}):
            self.assertIsNone(self.tb.notify_backend_mode('CHECK_IN'))


if __name__ == '__main__':
    unittest.main()
