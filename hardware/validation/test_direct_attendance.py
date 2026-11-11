import json
from pathlib import Path
import sys
from threading import Event
import unittest
from unittest.mock import Mock
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from iot.direct_attendance import DirectAttendanceClient

class Response:
    def __init__(self, data): self.data = data
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, count): return json.dumps(self.data).encode()

class DirectTests(unittest.TestCase):
    def client(self, opener):
        c = DirectAttendanceClient('http://backend.local:3000', 'PI_A', 'x'*32, opener=opener)
        self.addCleanup(c.close)
        return c

    def test_correlated_commit_is_delivered_and_credentials_are_device_scoped(self):
        opener=Mock();opener.open.return_value=Response(dict(event_id='event-a',success=True,matched=True,door_open=True))
        c=self.client(opener);done=Event();results=[]
        c.send_scan_rpc(np.ones(512), .9, 'AUTO', lambda r:(results.append(r),done.set()), event_id='event-a',captured_at=123,event_kind='CONFIRMED_SCAN',recognition_id='recognition-a')
        self.assertTrue(done.wait(2));self.assertTrue(results[0]['door_open'])
        request=opener.open.call_args.args[0]
        self.assertTrue(request.full_url.endswith('/PI_A/attendance'))
        self.assertEqual(request.get_header('Authorization'),'Bearer '+'x'*32)
        self.assertEqual(json.loads(request.data)['recognition_id'],'recognition-a')

    def test_timeout_bad_json_wrong_event_and_http_failure_never_authorize(self):
        for reply in [None, {}, dict(event_id='other',success=True,door_open=True)]:
            opener=Mock()
            if reply is None: opener.open.side_effect=TimeoutError()
            else: opener.open.return_value=Response(reply)
            c=self.client(opener);r=c._request(b'{}','event-a')
            self.assertFalse(r['door_open']);self.assertTrue(r['uncertain']);self.assertEqual(r['event_id'],'event-a')

    def test_payload_is_copied_and_retry_keeps_event_and_identity(self):
        opener=Mock();opener.open.side_effect=TimeoutError()
        c=self.client(opener);done=Event();scan=dict(device_id='PI_A',event_id='same-event',slot=2)
        c.send_fingerprint_rpc(scan,lambda r:done.set());scan['slot']=9
        self.assertTrue(done.wait(2));first=opener.open.call_args.args[0].data
        self.assertEqual(json.loads(first)['slot'],2)
        c.send_fingerprint_rpc(dict(device_id='PI_A',event_id='same-event',slot=2),lambda r:None)
        self.assertEqual(json.loads(first)['event_id'],'same-event')

    def test_invalid_inputs_and_other_device_are_rejected(self):
        c=self.client(Mock())
        self.assertEqual(c.send_fingerprint_rpc(dict(device_id='OTHER',event_id='a'),None),-1)
        self.assertEqual(c.send_scan_rpc(np.zeros(512),.9,'AUTO'),-1)
        self.assertEqual(c.send_scan_rpc(np.ones(512),float('nan'),'AUTO'),-1)
        c.close();self.assertEqual(c.send_fingerprint_rpc(dict(device_id='PI_A',event_id='a'),None),-1)

if __name__=='__main__':unittest.main()

class DirectFailureTests(unittest.TestCase):
    def test_queue_is_bounded_and_camera_does_not_wait_for_http(self):
        entered, release, done = Event(), Event(), Event()
        opener=Mock()
        def block(*args, **kwargs):
            entered.set();release.wait(2)
            return Response(dict(event_id='event-a',success=True,door_open=False))
        opener.open.side_effect=block
        c=DirectAttendanceClient('http://backend.local','PI_A','x'*32,opener=opener)
        try:
            scan=dict(device_id='PI_A',event_id='event-a')
            self.assertGreater(c.send_fingerprint_rpc(scan,lambda r:done.set()),0)
            self.assertTrue(entered.wait(1))
            self.assertGreater(c.send_fingerprint_rpc(scan,None),0)
            self.assertEqual(c.send_fingerprint_rpc(scan,None),-1)
            self.assertFalse(done.is_set())
            release.set();self.assertTrue(done.wait(1))
        finally:
            release.set();c.close()

    def test_redirects_and_origin_credentials_are_rejected(self):
        from iot.direct_attendance import NoRedirect
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,'','', 'http://other'))
        for origin in ['http://user:pass@host','http://host/path','ftp://host','http://host?token=x']:
            with self.assertRaises(ValueError): DirectAttendanceClient(origin,'PI_A','x'*32)

class LostAckTests(unittest.TestCase):
    def test_committed_but_lost_ack_retries_identical_body_and_feedback_only_once(self):
        from attendance_coordinator import AttendanceCoordinator
        from attendance_feedback import AttendanceFeedbackGuard
        coordinator=AttendanceCoordinator();guard=AttendanceFeedbackGuard();committed={};bodies=[]
        opener=Mock()
        def server(request, **kwargs):
            body=request.data;bodies.append(body);event=json.loads(body)['event_id']
            committed.setdefault(event,dict(event_id=event,success=True,matched=True,door_open=True,attendance={'id':'record-1','status':'VALID'}))
            if len(bodies)==1:raise TimeoutError('response lost after commit')
            return Response(committed[event])
        opener.open.side_effect=server
        c=DirectAttendanceClient('http://backend.local','PI_A','x'*32,opener=opener)
        try:
            body=json.dumps(dict(device_id='PI_A',event_id='stable-event',slot=1)).encode()
            coordinator.begin('fingerprint','stable-event')
            first=c._request(body,'stable-event')
            coordinator.response('stable-event',first,lambda:1)
            self.assertTrue(coordinator.busy);self.assertFalse(guard.claim(first))
            second=c._request(body,'stable-event')
            coordinator.response('stable-event',second,lambda:1)
            self.assertFalse(coordinator.busy);self.assertTrue(guard.claim(second));self.assertFalse(guard.claim(second))
            self.assertEqual(len(committed),1);self.assertEqual(bodies[0],bodies[1])
        finally:c.close()


class ReconciliationTests(unittest.TestCase):
    def test_retry_reads_committed_event_without_resending_scan_or_granting_access(self):
        opener = Mock()
        opener.open.side_effect = [
            TimeoutError(),
            Response(dict(event_id='stable-event', recorded=True, status='VALID', mode='CHECK_IN')),
        ]
        client = DirectAttendanceClient('http://backend.local', 'PI_A', 'x'*32, opener=opener)
        self.addCleanup(client.close)
        received = Event()
        results = []

        def callback(result):
            results.append(result)
            received.set()

        payload = dict(device_id='PI_A', event_id='stable-event', slot=1)
        client.send_fingerprint_rpc(payload, callback)
        self.assertTrue(received.wait(2))
        self.assertTrue(results[0]['uncertain'])
        received.clear()
        client.send_fingerprint_rpc(payload, callback)
        self.assertTrue(received.wait(2))
        self.assertTrue(results[1]['reconciled'])
        self.assertFalse(results[1]['door_open'])
        self.assertEqual([call.args[0].get_method() for call in opener.open.call_args_list], ['POST', 'GET'])
