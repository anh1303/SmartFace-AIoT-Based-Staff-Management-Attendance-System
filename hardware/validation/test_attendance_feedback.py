"""Server cooldown acknowledgement must never announce a successful attendance."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from attendance_feedback import AttendanceFeedbackGuard, is_accepted_attendance


class FeedbackTests(unittest.TestCase):
    def accepted(self, **patch):
        return dict(success=True, matched=True, door_open=True,
                    event_id='accepted-event', **patch)

    def test_auto_and_transactional_cooldown_do_not_trigger_feedback(self):
        for result in (
            dict(success=True, matched=True, ignored=True, cooldown=True, door_open=False),
            dict(success=True, matched=True, door_open=False,
                 attendance=dict(ignored=True, cooldown=True, duplicate=True)),
        ):
            self.assertFalse(is_accepted_attendance(result))
            self.assertFalse(AttendanceFeedbackGuard().claim(result))

    def test_verification_denial_and_missing_permission_are_not_accepted(self):
        for patch in (dict(verification_only=True), dict(success=False),
                      dict(door_open=False), dict(access_denied=True),
                      dict(attendance=dict(status='FLAGGED'))):
            result = self.accepted()
            result.update(patch)
            self.assertFalse(is_accepted_attendance(result))
        self.assertFalse(is_accepted_attendance(dict(success=True, matched=True)))

    def test_accepted_checkin_and_checkout_trigger_once_per_record(self):
        guard = AttendanceFeedbackGuard()
        for mode, record in [('CHECK_IN', '101'), ('CHECK_OUT', '102')]:
            result = self.accepted(mode=mode, attendance=dict(id=record, status='VALID'))
            self.assertTrue(guard.claim(result))
            self.assertFalse(guard.claim(result))
            result['event_id'] = 'new-rpc-same-record'
            self.assertFalse(guard.claim(result))

    def test_cooldown_does_not_consume_a_later_accepted_event(self):
        guard = AttendanceFeedbackGuard()
        self.assertFalse(guard.claim(self.accepted(ignored=True)))
        self.assertTrue(guard.claim(self.accepted()))


if __name__ == '__main__':
    unittest.main()
