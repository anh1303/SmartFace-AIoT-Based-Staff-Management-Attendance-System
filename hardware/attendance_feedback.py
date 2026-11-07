"""Only a committed attendance result may trigger success feedback."""
from collections import OrderedDict


def is_accepted_attendance(result):
    if not isinstance(result, dict):
        return False
    attendance = result.get('attendance') or {}
    return (
        result.get('success') is True and result.get('matched') is True
        and result.get('door_open') is True
        and not result.get('verification_only')
        and not any(result.get(key) or attendance.get(key)
                    for key in ('ignored', 'cooldown', 'access_denied'))
        and attendance.get('status') != 'FLAGGED'
    )


class AttendanceFeedbackGuard:
    """Suppress repeated feedback for a replayed committed event in this process."""
    def __init__(self, capacity=256):
        self.seen = OrderedDict()
        self.capacity = capacity

    def claim(self, result):
        if not is_accepted_attendance(result):
            return False
        attendance = result.get('attendance') or {}
        key = str(attendance.get('id') or result.get('event_id') or '')
        if not key or key in self.seen:
            return False
        self.seen[key] = None
        if len(self.seen) > self.capacity:
            self.seen.popitem(last=False)
        return True
