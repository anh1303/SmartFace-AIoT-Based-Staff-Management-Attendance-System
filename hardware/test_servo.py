"""Manual physical servo test, independent of camera, MQTT and database."""
import argparse
import importlib.util
import os
from pathlib import Path
import time


def main():
    root = Path(__file__).resolve().parent
    try:
        from dotenv import load_dotenv
        load_dotenv(root / '.env')
    except ImportError:
        pass
    parser = argparse.ArgumentParser(description='Test servo thật: 0° → 90° → 0° → 90° → 0°')
    parser.add_argument('--pin', type=int, default=int(os.getenv('SERVO_PIN', '18')),
                        help='Số GPIO BCM, mặc định SERVO_PIN trong hardware/.env hoặc 18 (chân vật lý 12)')
    parser.add_argument('--hold', type=float, default=2, help='Thời gian giữ mỗi vị trí, giây')
    args = parser.parse_args()
    if args.hold < .5:
        parser.error('--hold phải >= 0.5 giây')
    # Load only the actual application driver, without unrelated peripherals.
    spec = importlib.util.spec_from_file_location('servo_test_driver', root / 'peripherals/servo_controller.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    print(f'[TEST] GPIO BCM {args.pin}. Đóng chương trình edge_client trước khi test.')
    servo = module.ServoController(pin=args.pin, enabled=True)
    if servo._is_mock or servo._servo is None:
        print('[FAIL] Không khởi tạo được GPIO thật; không coi Mock Mode là test thành công.')
        return 1
    try:
        for label, angle in [('ĐÓNG', 0), ('MỞ CHECK_IN', 90), ('ĐÓNG', 0),
                             ('MỞ CHECK_OUT', 90), ('ĐÓNG', 0)]:
            print(f'[TEST] {label}: {angle}° — quan sát servo thực tế')
            servo.set_angle(angle)
            time.sleep(1.0)
            servo.set_angle(None)
            time.sleep(max(0.0, args.hold - 1.0))
        print('[DONE] Đã gửi chuỗi lệnh; hãy đối chiếu với chuyển động thực tế.')
        return 0
    except KeyboardInterrupt:
        print('\n[TEST] Dừng test, đưa servo về 0°.')
        return 130
    finally:
        servo.close()


if __name__ == '__main__':
    raise SystemExit(main())
