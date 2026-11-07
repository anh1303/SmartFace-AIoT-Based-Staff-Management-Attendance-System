#!/usr/bin/env python3
"""
Công cụ Đo mức Logic WAK Thời Gian Thực (Live WAK Oscilloscope)
Giúp quan sát chính xác phản ứng của chân WAK (GPIO 17) khi chạm và nhấc tay.
"""

import sys
import time
from pathlib import Path

try:
    from gpiozero import DigitalInputDevice
except ImportError:
    print("Vui lòng cài đặt gpiozero: pip install gpiozero")
    sys.exit(1)

def main():
    pin = 17
    # Thử nghiệm với Pull-Down nội
    d_pd = DigitalInputDevice(pin, pull_up=False)

    print("\n" + "=" * 65)
    print("   CÔNG CỤ KIỂM TRA TRẠNG THÁI CHÂN WAK (GPIO 17 / PIN 11)")
    print("=" * 65)
    print("  Quy ước hiển thị:")
    print("    [ 0 ] : Điện áp 0V  (Mức THẤP - LOW)")
    print("    [ 1 ] : Điện áp 3.3V (Mức CAO  - HIGH)")
    print("\n  👉 Bạn hãy THỬ ĐẶT TAY LÊN KÍNH rồi NHẤC TAY RA.")
    print("  👉 Bấm Ctrl+C bất cứ lúc nào để dừng.\n")
    print("-" * 65)

    last_val = -1
    stable_count = 0

    try:
        while True:
            val = d_pd.value
            status = "🔴 HIGH (3.3V - Đang phát hiện chạm)" if val == 1 else "⚪ LOW  (0V   - Trạng thái nghỉ/Không chạm)"
            
            # Chỉ in khi có sự thay đổi hoặc mỗi 1 giây để không tràn màn hình
            if val != last_val:
                print(f"[{time.strftime('%H:%M:%S')}] CHUYỂN MỨC -> {status}")
                last_val = val
                stable_count = 0
            else:
                stable_count += 1
                if stable_count % 10 == 0:  # Cứ 1 giây in 1 chấm giữ nhịp
                    print(f"[{time.strftime('%H:%M:%S')}] Hiện tại: {status}")

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\n[*] Đã dừng kiểm tra.")
    finally:
        d_pd.close()

if __name__ == "__main__":
    main()
