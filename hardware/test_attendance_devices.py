"""Manual fake-success test: real speaker/servo, no network attendance writes.

Presence is simulated for 3s, followed by 5s absence before closing.
Stop edge_client before running this physical device test.
"""
import argparse
import importlib.util
import os
from pathlib import Path
import time
import uuid


def main():
    root = Path(__file__).resolve().parent
    from dotenv import load_dotenv
    load_dotenv(root / '.env')
    from attendance_feedback import AttendanceFeedbackGuard

    def load(name):
        spec = importlib.util.spec_from_file_location(name, root / 'peripherals' / f'{name}.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['CHECK_IN', 'CHECK_OUT', 'BOTH'], default='BOTH')
    parser.add_argument('--name', default='Nhân viên thử nghiệm')
    parser.add_argument('--pin', type=int, default=int(os.getenv('SERVO_PIN', '18')))
    args = parser.parse_args()
    gate = load('servo_controller').ServoController(pin=args.pin, enabled=True)
    if gate._is_mock or gate._servo is None:
        print('[FAIL] Servo không khởi tạo GPIO thật; dừng test.')
        return 1
    audio = load('audio_manager').AudioManager(initial_volume=75, initial_muted=False)
    telemetry = load('system_telemetry')
    guard = AttendanceFeedbackGuard()
    try:
        for mode in (['CHECK_IN', 'CHECK_OUT'] if args.mode == 'BOTH' else [args.mode]):
            result = dict(success=True, matched=True, door_open=True, mode=mode,
                          event_id=uuid.uuid4().hex, employee=dict(full_name=args.name))
            if not guard.claim(result):
                raise RuntimeError('Fake success rejected by feedback guard')
            print(f'[SIMULATION] {mode} thành công — không ghi database. Presence giả lập 3s, rồi chờ 5s đóng.')
            bt = telemetry.get_bluetooth_info()
            queued = audio.speak_attendance(args.name, mode, target_mac=bt.get('address', ''),
                                            target_name=bt.get('deviceName', ''))
            print(f'[TEST] Audio request returned: {queued}; cần nghe loa thực tế.')
            started = time.monotonic()
            gate.open_gate_safe(mode, lambda: time.monotonic() - started < 3,
                                close_delay_seconds=5)
            gate._worker.join()
            time.sleep(2)
        print('[DONE] Đã gửi lệnh test cả loa và servo; đối chiếu tiếng loa và chuyển động thực tế.')
    except KeyboardInterrupt:
        print('\n[TEST] Dừng test.')
        return 130
    finally:
        gate.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
