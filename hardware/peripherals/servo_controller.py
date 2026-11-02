"""
Driver điều khiển Động cơ Servo (SG90 / MG995 / MG996R) mô phỏng đóng/mở cổng:
- Vị trí mặc định (Cửa đóng): 90°
- Chiều Vào ca (CHECK_IN): 0°
- Chiều Ra ca (CHECK_OUT): 180°
- Cơ chế an toàn (Obstacle safety): Giữ cửa mở nếu cảm biến siêu âm vẫn phát hiện người
- Cơ chế chống giật (Anti-jitter): Ngắt xung PWM (servo.angle = None) khi cửa đã đóng
- Hỗ trợ Mock Mode tự động khi chạy trên môi trường không có GPIO/Pi
"""

import threading
import time
from typing import Optional, Callable


class ServoController:
    def __init__(
        self,
        pin: int = 18,
        enabled: bool = True,
        min_pulse_width: float = 0.0005,
        max_pulse_width: float = 0.0025,
    ):
        self.pin = pin
        self.enabled = enabled
        self.min_pulse_width = min_pulse_width
        self.max_pulse_width = max_pulse_width

        self._servo = None
        self._is_mock = False
        self._lock = threading.Lock()

        # Trạng thái cửa: "CLOSED" (90°), "OPEN_IN" (0°), "OPEN_OUT" (180°)
        self.door_state = "CLOSED"
        self.current_angle: Optional[float] = None

        if self.enabled:
            self._init_hardware()

    def _init_hardware(self):
        try:
            from gpiozero import AngularServo
            self._servo = AngularServo(
                self.pin,
                min_angle=0,
                max_angle=180,
                min_pulse_width=self.min_pulse_width,
                max_pulse_width=self.max_pulse_width,
            )
            # Khởi tạo vị trí 90 độ, sau đó ngắt xung để chống giật
            self._servo.angle = 90
            time.sleep(0.5)
            self._servo.angle = None
            self._is_mock = False
            self.current_angle = None
            print(f"[SERVO] Khởi tạo thành công trên GPIO {self.pin} (Trạng thái: ĐÓNG 90°, PWM Detached).")
        except Exception as e:
            self._is_mock = True
            self._servo = None
            self.current_angle = None
            print(f"[SERVO] [WARN] Không thể khởi tạo gpiozero AngularServo ({e}). Sử dụng Mock Mode!")

    def set_angle(self, angle: Optional[float]):
        """
        Thiết lập góc quay cho Servo.
        Khi angle = None, ngắt tín hiệu PWM để chống rung lắc (jitter) và tránh nóng motor.
        """
        if self._servo and not self._is_mock:
            try:
                self._servo.angle = angle
            except Exception as e:
                print(f"[SERVO] Lỗi đặt góc {angle}: {e}")

        if angle is None:
            self.current_angle = None
        else:
            self.current_angle = float(angle)
            if self.current_angle <= 45.0:
                self.door_state = "OPEN_IN"
            elif self.current_angle >= 135.0:
                self.door_state = "OPEN_OUT"
            else:
                self.door_state = "CLOSED"

    def open_gate_safe(
        self,
        mode: str,
        is_person_present_fn: Optional[Callable[[], bool]] = None,
        open_seconds: float = 3.0,
        max_hold_seconds: float = 15.0,
        on_state_change: Optional[Callable[[str], None]] = None,
    ):
        """
        Mở cửa an toàn theo mode trong một luồng riêng biệt (Non-blocking):
        - mode == 'CHECK_IN': quay 0° (Mở vào)
        - mode == 'CHECK_OUT': quay 180° (Mở ra)
        - Chờ open_seconds (mặc định 3s).
        - Nếu is_person_present_fn() vẫn trả về True, tiếp tục giữ cửa mở (tối đa max_hold_seconds).
        - Khi người đã bước qua, quay về 90° (Đóng), chờ 0.5s rồi ngắt xung (servo.angle = None).
        """
        if not self.enabled:
            return

        def _action():
            with self._lock:
                normalized = mode.upper() if mode else "CHECK_IN"
                target_angle = 0 if normalized == "CHECK_IN" else 180
                action_label = "MỞ VÀO (0°)" if target_angle == 0 else "MỞ RA (180°)"
                self.door_state = "OPEN_IN" if target_angle == 0 else "OPEN_OUT"

                print(f"[SERVO] 🚪 Kích hoạt mở cổng {normalized}: Quay {action_label}...")
                self.set_angle(target_angle)
                if on_state_change:
                    on_state_change(self.door_state)

                try:
                    # Giữ mở trong thời gian tối thiểu
                    time.sleep(open_seconds)

                    # Kiểm tra an toàn: Nếu người vẫn đứng trước cảm biến (<= 50cm), tiếp tục giữ mở
                    if is_person_present_fn:
                        start_hold = time.time()
                        while is_person_present_fn():
                            if time.time() - start_hold >= max_hold_seconds:
                                print("[SERVO] ⚠️ Cảnh báo: Vượt quá thời gian giữ cửa tối đa (15s); buộc phải đóng cửa!")
                                break
                            print("[SERVO] ⏳ Người vẫn đang ở cổng (d <= 50cm) -> Tiếp tục giữ cửa mở an toàn...")
                            time.sleep(0.5)
                except Exception as exc:
                    print(f"[SERVO] Ngoại lệ trong khi giữ cửa mở: {exc}")
                finally:
                    # Đóng cửa về vị trí 90 độ và ngắt PWM chống giật
                    print("[SERVO] 🚪 Đóng cổng: Quay về vị trí chờ 90°...")
                    self.set_angle(90)
                    self.door_state = "CLOSED"
                    if on_state_change:
                        on_state_change(self.door_state)

                    time.sleep(0.5)  # Chờ 0.5s để motor quay về tới vị trí cơ khí hoàn chỉnh

                    # Triệt tiêu hoàn toàn xung PWM chống rung giật và chống nóng động cơ
                    print("[SERVO] 🔌 Ngắt xung PWM (servo.angle = None) -> Động cơ nghỉ hoàn toàn, không rung lắc.")
                    self.set_angle(None)

        thread = threading.Thread(target=_action, daemon=True)
        thread.start()

    def close(self):
        """Giải phóng tài nguyên phần cứng."""
        try:
            self.set_angle(90)
            time.sleep(0.2)
            self.set_angle(None)
            if self._servo:
                self._servo.close()
                self._servo = None
        except Exception:
            pass
