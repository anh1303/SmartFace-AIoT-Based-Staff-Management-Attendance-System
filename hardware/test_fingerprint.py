#!/usr/bin/env python3
"""
Script kiểm thử độc lập Cảm biến Vân tay Quang học (ZA620_M5 / Adafruit 4690 / R307)
Dành cho Raspberry Pi 4 - SmartFace AIoT

Cách chạy:
    python3 test_fingerprint.py --port /dev/serial0 --baud 57600 --touch-pin 17
"""

import sys
import time
import argparse
import base64
from pathlib import Path

# Thêm đường dẫn thư mục cha để import driver
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from peripherals.fingerprint_sensor import FingerprintSensor


def print_banner():
    print("\n" + "=" * 65)
    print("   KIỂM THỬ CẢM BIẾN VÂN TAY QUANG HỌC (ZA620_M5 / ADAFRUIT 4690)")
    print("              SmartFace AIoT - Hardware Test Suite")
    print("=" * 65)


def test_handshake(sensor: FingerprintSensor):
    print("\n[*] Đang gửi lệnh bắt tay xác thực (Handshake)...")
    if sensor.connect():
        print("  -> [OK] Kết nối UART thành công với cảm biến!")
        params = sensor.read_sys_params()
        if params:
            print(f"  -> Dung lượng bộ nhớ (Capacity): {params['capacity']} dấu vân tay")
            print(f"  -> Tốc độ truyền (Baudrate):     {params['baudrate']} bps")
            print(f"  -> Cấp độ bảo mật (Security):    {params['security_level']} / 5")
        
        count = sensor.get_template_count()
        print(f"  -> Số vân tay hiện có trong Flash: {count} mẫu")
    else:
        print("  -> [LỖI] Không thể bắt tay với cảm biến!")
        if getattr(sensor, 'last_error', ''):
            print(f"     Chi tiết lỗi: {sensor.last_error}")
        print("\n     === HƯỚNG DẪN CẮM DÂY CHUẨN CHO CÁP ZA620_M5 (8 CHÂN) ===")
        print("     Nhìn mặt sau, giắc ở dưới: pin 1 bên PHẢI (dây đỏ).")
        print("     Đỏ Vi -> Pin 1 (3.3V); Đen TX -> Pin 10 (GPIO15 RX)")
        print("     Vàng RX -> Pin 8 (GPIO14 TX); Xanh lá GND -> Pin 6")
        print("     Xanh dương WAK -> Pin 11 (GPIO17); Trắng Vt -> Pin 17 (3.3V)")
        print("     Cam D+ / Nâu D- để trống. Không cấp 5V vào Vi!")



def test_led(sensor: FingerprintSensor):
    print("\n[*] Kiểm tra điều khiển đèn LED cảm biến:")
    print("  -> Đang bật đèn LED...")
    sensor.set_led(True)
    time.sleep(2.0)
    print("  -> Đang tắt đèn LED...")
    sensor.set_led(False)
    print("  -> [OK] Hoàn tất test LED.")


def test_enroll(sensor: FingerprintSensor):
    print("\n[*] --- BẮT ĐẦU QUY TRÌNH ĐĂNG KÝ VÂN TAY (2 BƯỚC) ---")
    
    # Nhập vị trí lưu (PageID)
    try:
        page_id_str = input("  Nhập vị trí PageID muốn lưu (0 - 999) [Mặc định: 1]: ").strip()
        page_id = int(page_id_str) if page_id_str else 1
    except ValueError:
        page_id = 1

    sensor.set_led(True)

    # BƯỚC 1: Lấy mẫu lần 1
    print("\n[Bước 1/2] ĐẶT NGÓN TAY lên mặt kính cảm biến...")
    while True:
        ack = sensor.capture_image()
        if ack == 0x00:
            print("  -> Đã chụp ảnh lần 1! Đang trích xuất đặc trưng...")
            ack2 = sensor.image_to_charbuffer(buffer_id=1)
            if ack2 != 0x00:
                print(f"  -> [LỖI] Không tạo được đặc trưng lần 1: {sensor.CONFIRMATION_CODES.get(ack2, 'Lỗi khác')}")
                sensor.set_led(False)
                return
            break
        elif ack == 0x02:
            time.sleep(0.1)  # Đang chờ đặt ngón tay
        else:
            print(f"  -> Lỗi đọc ảnh: {sensor.CONFIRMATION_CODES.get(ack, 'Chưa rõ')}")
            time.sleep(0.5)

    # YÊU CẦU NHẤC NGÓN TAY
    print("  -> [OK] Lần 1 thành công! VUI LÒNG NHẤC NGÓN TAY RA...")
    time.sleep(1.0)
    while sensor.capture_image() != 0x02:
        time.sleep(0.1)

    # BƯỚC 2: Lấy mẫu lần 2
    print("\n[Bước 2/2] ĐẶT LẠI CÙNG NGÓN TAY ĐÓ lên mặt kính một lần nữa...")
    while True:
        ack = sensor.capture_image()
        if ack == 0x00:
            print("  -> Đã chụp ảnh lần 2! Đang trích xuất đặc trưng...")
            ack2 = sensor.image_to_charbuffer(buffer_id=2)
            if ack2 != 0x00:
                print(f"  -> [LỖI] Không tạo được đặc trưng lần 2: {sensor.CONFIRMATION_CODES.get(ack2, 'Lỗi khác')}")
                sensor.set_led(False)
                return
            break
        elif ack == 0x02:
            time.sleep(0.1)
        else:
            time.sleep(0.5)

    # GHÉP 2 MẪU
    print("\n[*] Đang tổng hợp 2 lần quét thành Template chuẩn (RegModel)...")
    ack_model = sensor.create_model()
    if ack_model != 0x00:
        print(f"  -> [THẤT BẠI] Hai lần quét không khớp ngón tay! ({sensor.CONFIRMATION_CODES.get(ack_model, 'Lỗi')})")
        sensor.set_led(False)
        return

    # LƯU VÀO FLASH CỦA CẢM BIẾN
    ack_store = sensor.store_template(page_id=page_id, buffer_id=1)
    if ack_store == 0x00:
        print(f"  -> [THÀNH CÔNG] 🎉 Đã lưu vân tay vào bộ nhớ cảm biến tại PageID: {page_id}")
    else:
        print(f"  -> [CẢNH BÁO] Không lưu được vào Flash: {sensor.CONFIRMATION_CODES.get(ack_store)}")

    # TRÍCH XUẤT TEMPLATE 512 BYTES (Để chứng minh khả năng lưu vào Database)
    print("\n[*] Đang trích xuất Template 512 bytes từ cảm biến về Pi (UpChar)...")
    template_bytes = sensor.upload_template(buffer_id=1)
    if template_bytes and len(template_bytes) == 512:
        b64_str = base64.b64encode(template_bytes).decode('ascii')
        print(f"  -> [OK] Trích xuất thành công đúng {len(template_bytes)} bytes!")
        print(f"  -> Chuỗi Base64 (684 ký tự) sẵn sàng lưu vào PostgreSQL:")
        print(f"     \"{b64_str[:40]}...{b64_str[-40:]}\"")
    else:
        print("  -> [CẢNH BÁO] Chưa trích xuất được template qua lệnh UpChar.")

    sensor.set_led(False)


def test_search(sensor: FingerprintSensor):
    print("\n[*] --- CHẾ ĐỘ QUẸT VÂN TAY ĐIỂM DANH (SO KHỚP 1:N) ---")
    print("  -> Hãy chạm ngón tay vào cảm biến để kiểm tra.")
    print("  -> Nhấn Ctrl+C để dừng kiểm tra và quay lại menu.")

    sensor.set_led(True)
    try:
        last_match_time = 0.0
        while True:
            ack = sensor.capture_image()
            if ack == 0x00:
                # Đã chụp được ảnh ngón tay
                sensor.image_to_charbuffer(buffer_id=1)
                found, page_id, score = sensor.search_database(buffer_id=1, start_page=0, page_count=1000)
                
                now = time.time()
                if now - last_match_time > 1.5:  # Chống in log lặp liên tục
                    last_match_time = now
                    if found:
                        print(f"\n🎉 [ĐIỂM DANH THÀNH CÔNG] Tìm thấy PageID #{page_id} | Điểm tin cậy (Score): {score}/100")
                    else:
                        print("\n⚠️ [TỪ CHỐI] Vân tay lạ! Không tìm thấy trong cơ sở dữ liệu.")
                
                # Chờ nhấc tay ra
                time.sleep(0.5)
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n[*] Dừng chế độ quẹt vân tay.")
    finally:
        sensor.set_led(False)


def test_touch_interrupt(sensor: FingerprintSensor, pin: int):
    print(f"\n[*] Kiểm tra ngắt cảm ứng chân Tch (GPIO {pin}):")
    print("  -> Hãy chạm ngón tay vào mặt kính cảm biến...")
    print("  -> Nhấn Ctrl+C để dừng.")

    def on_touch():
        print("  👉 [PHÁT HIỆN CHẠM] Ngón tay vừa chạm vào mặt kính cảm biến! (Chân Tch -> HIGH)")

    ok = sensor.setup_touch_interrupt(gpio_pin=pin, on_touch_callback=on_touch)
    if not ok:
        print("  -> [LỖI] Không khởi tạo được chân ngắt. Đảm bảo đã cài gpiozero và chân không bị trùng.")
        return

    try:
        while True:
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n[*] Dừng kiểm tra chân Tch.")


def test_delete(sensor: FingerprintSensor):
    print("\n[*] Quản lý bộ nhớ Flash:")
    print("  1. Xóa 1 vân tay theo PageID")
    print("  2. XÓA SẠCH toàn bộ vân tay trong cảm biến (Cẩn thận!)")
    choice = input("  Chọn (1/2): ").strip()
    if choice == '1':
        pid_str = input("  Nhập PageID cần xóa: ").strip()
        try:
            pid = int(pid_str)
            if sensor.delete_template(page_id=pid):
                print(f"  -> [OK] Đã xóa thành công PageID {pid}")
            else:
                print(f"  -> [LỖI] Không xóa được PageID {pid}")
        except ValueError:
            print("  -> PageID không hợp lệ.")
    elif choice == '2':
        confirm = input("  Bạn có CHẮC CHẮN muốn xóa sạch toàn bộ? (yes/no): ").strip().lower()
        if confirm == 'yes':
            if sensor.empty_database():
                print("  -> [OK] Đã xóa sạch toàn bộ vân tay trong bộ nhớ cảm biến!")
            else:
                print("  -> [LỖI] Xóa sạch thất bại.")


def main():
    parser = argparse.ArgumentParser(description="Test Cảm biến Vân tay Quang học (SmartFace AIoT)")
    parser.add_argument("--port", type=str, default="/dev/serial0",
                        help="Cổng Serial UART (Mặc định: /dev/serial0 hoặc /dev/ttyAMA0)")
    parser.add_argument("--baud", type=int, default=57600,
                        help="Tốc độ Baudrate (Mặc định: 57600)")
    parser.add_argument("--touch-pin", type=int, default=17,
                        help="Chân GPIO BCM ngắt Tch (Mặc định: 17 [Pin vật lý 11 - Đã né TFT/Servo/Siêu âm])")
    args = parser.parse_args()

    sensor = FingerprintSensor(port=args.port, baudrate=args.baud)

    print_banner()
    print(f"Cấu hình: Cổng UART = {args.port} | Baudrate = {args.baud} | Chân Tch = GPIO {args.touch_pin}")

    # Thử kết nối ban đầu
    test_handshake(sensor)
    if not sensor.is_connected:
        sensor.close()
        return

    while True:
        print("\n" + "-" * 50)
        print("MENU KIỂM THỬ:")
        print("  1. Bắt tay & Đọc thông số cảm biến")
        print("  2. Bật / Tắt đèn LED cảm biến")
        print("  3. Đăng ký vân tay mới (2 bước lấy mẫu -> Trích xuất 512B)")
        print("  4. Quẹt vân tay điểm danh (So khớp 1:N tức thì)")
        print(f"  5. Kiểm tra chân ngắt chạm ngón tay Tch (GPIO {args.touch_pin})")
        print("  6. Xóa vân tay / Dọn dẹp bộ nhớ Flash")
        print("  0. Thoát")
        print("-" * 50)

        choice = input("Lựa chọn của bạn (0-6): ").strip()
        if choice == '1':
            test_handshake(sensor)
        elif choice == '2':
            test_led(sensor)
        elif choice == '3':
            test_enroll(sensor)
        elif choice == '4':
            test_search(sensor)
        elif choice == '5':
            test_touch_interrupt(sensor, args.touch_pin)
        elif choice == '6':
            test_delete(sensor)
        elif choice == '0':
            print("\nĐang đóng cổng Serial và thoát...")
            sensor.close()
            break
        else:
            print("Lựa chọn không hợp lệ, vui lòng chọn từ 0 đến 6.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nĐã hủy chương trình.")
        sys.exit(0)
