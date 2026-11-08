"""Offline regression: no GPIO, UART device, templates in logs, or DB writes."""
import importlib.util
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import Mock, patch
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location('fp_sensor_test', ROOT/'peripherals/fingerprint_sensor.py')
module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
from attendance_coordinator import AttendanceCoordinator


def frame(pid, payload):
    body = bytes([pid])+(len(payload)+2).to_bytes(2,'big')+payload
    return bytes.fromhex('ef01ffffffff')+body+sum(body).to_bytes(2,'big')


class Serial:
    def __init__(self, incoming=b''):
        self.incoming = bytearray(incoming)
        self.written = []
        self.is_open = True
    def read(self, size):
        # Deliberately fragment every frame, including checksum and header.
        size=min(size,2)
        data=bytes(self.incoming[:size]);del self.incoming[:size]
        return data
    def write(self,data): self.written.append(data);return len(data)
    def flush(self): pass


class FingerprintTransportTests(unittest.TestCase):
    def sensor(self, incoming):
        s=module.FingerprintSensor(timeout=.01);s.ser=Serial(incoming);return s
    def test_fragmented_ack_is_reassembled_and_checksum_verified(self):
        s=self.sensor(frame(7,b'\x00\x00\x84'))
        self.assertEqual(s.match_buffers(), (0,132))
        self.assertEqual(s.ser.written[0],frame(1,b'\x03'))
    def test_non_ack_and_invalid_checksums_invalidate_connection(self):
        for data in [frame(2,b'\x00'),frame(7,b'\x00')[:-1]+b'\xff']:
            s=self.sensor(data)
            self.assertEqual(s._send_command(3)[0],0xfe)
            self.assertTrue(s._needs_reconnect)
            before=len(s.ser.written)
            s._send_command(3)
            self.assertEqual(len(s.ser.written),before)
    def test_partial_frame_timeout_never_reuses_late_ack(self):
        s=self.sensor(frame(7,b'\x00')[:8])
        self.assertEqual(s._send_command(3)[0],0xfe)
        s.ser.incoming.extend(frame(7,b'\x00'))
        self.assertEqual(s._send_command(3)[0],0xfe)
    def test_template_upload_obeys_end_packet_checksum_and_exact_size(self):
        template=bytes(range(256))*2
        data=frame(7,b'\x00')+frame(2,template[:256])+frame(8,template[256:])
        self.assertEqual(self.sensor(data).upload_template(),template)
        for bad in [frame(7,b'\x00')+frame(8,b'x'*128),frame(7,b'\x00')+frame(8,b'x'*256)[:-1]+b'\x00']:
            self.assertIsNone(self.sensor(bad).upload_template())
    def test_download_uses_negotiated_packet_length(self):
        for packet_size in [32,64,128,256]:
            s=self.sensor(frame(7,b'\x00'));s.packet_size=packet_size
            with patch.object(module.time,'sleep'):
                self.assertTrue(s.download_template(1,bytes(512)))
            packets=s.ser.written[1:]
            self.assertEqual(len(packets),512//packet_size)
            self.assertEqual(packets[-1][6],8)
            self.assertTrue(all(len(p)==packet_size+11 for p in packets))
            self.assertFalse(s.download_template(1,bytes(513)))
    def test_capacity_and_packet_size_come_from_sensor(self):
        params=bytes.fromhex('00000000012c0003ffffffff00020006')
        s=self.sensor(frame(7,b'\x00'+params))
        self.assertEqual(s.read_sys_params()['capacity'],300)
        self.assertEqual(s.packet_size,128)


class CoordinatorTests(unittest.TestCase):
    def test_face_and_fingerprint_cannot_submit_together(self):
        c=AttendanceCoordinator();barrier=threading.Barrier(3);results=[]
        def attempt(owner):
            barrier.wait();results.append(c.begin(owner,owner))
        threads=[threading.Thread(target=attempt,args=(name,)) for name in ['face','fingerprint']]
        for t in threads:t.start()
        barrier.wait()
        for t in threads:t.join()
        self.assertEqual(results.count(True),1)
    def test_uncertain_keeps_identity_locked_and_retries_same_request(self):
        c=AttendanceCoordinator();retry=Mock(return_value=42)
        self.assertTrue(c.begin('face','event-a'))
        c.response('event-a',{'uncertain':True},retry)
        self.assertFalse(c.begin('fingerprint','event-b'))
        c.retry_at=0;c.tick();retry.assert_called_once()
        self.assertEqual(c.token,'event-a')
        c.response('event-a',{'success':True},retry)
        self.assertTrue(c.begin('fingerprint','event-b'))
    def test_old_reply_cannot_release_current_identity(self):
        c=AttendanceCoordinator();c.begin('fingerprint','new')
        c.response('old',{'success':True},Mock())
        self.assertTrue(c.busy)


if __name__=='__main__':unittest.main()


class WorkerSyncTests(unittest.TestCase):
    def test_cold_start_recovers_all_assigned_bindings_not_just_active_employees(self):
        inactive = self.binding()
        inactive['id'] = 'inactive-binding'
        active = dict(self.binding(), id='active-binding', slot=3)
        encoded = inactive.pop('template_b64')
        active.pop('template_b64')
        w = self.worker(inactive)
        w.manifest['bindings'].append(active)
        w._http.return_value = {'revision': 1, 'checksum': inactive['checksum'], 'template_b64': encoded}
        w.sensor.load_template.return_value = 0
        w.sensor.upload_template.return_value = bytes(512)
        w._sync()
        self.assertEqual(w._verified, {'inactive-binding', 'active-binding'})
        self.assertEqual(w._http.call_count, 4)  # each download and ack completes

    def test_v2_refresh_keeps_the_health_heartbeat(self):
        w = self.worker(self.binding())
        w.sensor.is_connected = True
        w._http.return_value = {'manifest_version': 2, 'bindings': [], 'session': None, 'device': {}}
        w._refresh(force=True)
        path, body = w._http.call_args.args
        self.assertEqual(path, '/manifest')
        self.assertEqual(body['manifest_version'], 2)
        self.assertTrue(body['ready'])
        self.assertEqual(body['capacity'], 300)

    def test_download_rejects_a_changed_revision_without_writing_flash(self):
        b = self.binding()
        payload = {'template_b64': b.pop('template_b64'), 'revision': 99, 'checksum': b['checksum']}
        w = self.worker(b)
        w._http.return_value = payload
        with self.assertRaises(RuntimeError):
            w._sync()
        w.sensor.store_template.assert_not_called()
        self.assertNotIn(b['id'], w._verified)

    def test_metadata_only_manifest_downloads_once_then_reuses_verified_flash(self):
        b = self.binding()
        payload = {'template_b64': b.pop('template_b64'), 'revision': b['revision'], 'checksum': b['checksum']}
        w = self.worker(b)
        w._http.return_value = payload
        w.sensor.load_template.return_value = 0
        w.sensor.upload_template.return_value = bytes(512)
        w._sync()
        w._sync()
        w._http.assert_any_call('/bindings/binding-a/template', {'revision': b['revision'], 'checksum': b['checksum']})
        self.assertEqual(w._http.call_count, 2)  # one download + one ack
        w.sensor.store_template.assert_not_called()

    def test_revoked_metadata_never_downloads_a_template(self):
        b = self.binding()
        b.pop('template_b64')
        b['state'] = 'REVOKED'
        w = self.worker(b)
        w._sync()
        w._http.assert_called_once_with('/bindings/binding-a/ack', {'deleted': True})

    def worker(self, binding):
        from peripherals.fingerprint_worker import FingerprintWorker
        w=FingerprintWorker('PI_A',AttendanceCoordinator(),Mock(),lambda:'AUTO',Mock())
        w.sensor=Mock();w.sensor.capacity=300
        w.manifest={'bindings':[binding], 'session':None, 'device':{}}
        w._http=Mock(return_value={})
        return w
    def binding(self):
        import base64,hashlib
        data=bytes(512)
        return dict(id='binding-a',slot=2,template_b64=base64.b64encode(data).decode(),
                    checksum=hashlib.sha256(data).hexdigest(),revision=1,state='PENDING')
    def test_new_slot_is_written_read_back_and_acknowledged(self):
        b=self.binding();w=self.worker(b)
        w.sensor.load_template.side_effect=[0x0c,0]
        w.sensor.upload_template.return_value=bytes(512)
        w._sync()
        w.sensor.store_template.assert_called_once_with(2)
        w._http.assert_called_once_with('/bindings/binding-a/ack',{'checksum':b['checksum'],'revision':1})
        self.assertIn('binding-a',w._verified)
    def test_unknown_slot_is_never_overwritten(self):
        w=self.worker(self.binding());w.sensor.load_template.return_value=0
        w.sensor.upload_template.return_value=b'other-person'
        with self.assertRaises(RuntimeError):w._sync()
        w.sensor.store_template.assert_not_called()
        w._http.assert_called_once_with('/bindings/binding-a/ack',{'error':'SYNC_FAILED'})
        self.assertNotIn('binding-a',w._verified)
    def test_failed_readback_never_enables_mapping(self):
        w=self.worker(self.binding());w.sensor.load_template.side_effect=[0x0c,0]
        w.sensor.upload_template.return_value=b'corrupted'
        with self.assertRaises(RuntimeError):w._sync()
        self.assertNotIn('binding-a',w._verified)
        self.assertEqual(w._http.call_args.args[1],{'error':'SYNC_FAILED'})
    def test_revoked_slot_deleted_before_backend_ack(self):
        b=self.binding();b['state']='REVOKED';w=self.worker(b)
        w._sync();w.sensor.delete_template.assert_called_once_with(2)
        w._http.assert_called_once_with('/bindings/binding-a/ack',{'deleted':True})
