"""
Driver điều khiển Động cơ Servo (SG90 / MG995 / MG996R) mô phỏng đóng/mở cổng:
- Vị trí mặc định (Cửa đóng): 0°
- Chiều Vào ca (CHECK_IN): 90°
- Chiều Ra ca (CHECK_OUT): 90°
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
        self._stopping = threading.Event()
        self._worker = None

        # Trạng thái cửa: "CLOSED" (0°), "OPEN_IN" / "OPEN_OUT" (90°)
        self._open_state = "OPEN_IN"
        self.door_state = "CLOSED"
        self.current_angle: Optional[float] = None

        if self.enabled:
            self._init_hardware()

    def _init_hardware(self):
        try:
            from gpiozero import AngularServo
            pin_factory = None
            try:
                from gpiozero.pins.pigpio import PiGPIOFactory
                pin_factory = PiGPIOFactory()
                print("[SERVO] Sử dụng pigpio DMA Hardware PWM (triệt tiêu 100% jitter).")
            except Exception:
                pin_factory = None

            self._servo = AngularServo(
                self.pin,
                min_angle=0,
                max_angle=180,
                min_pulse_width=self.min_pulse_width,
                max_pulse_width=self.max_pulse_width,
                pin_factory=pin_factory,
            )
            # Khởi tạo vị trí 0 độ, sau đó ngắt xung để chống giật
            self._servo.angle = 0
            time.sleep(1.0)
            self._servo.angle = None
            self._is_mock = False
            self.current_angle = None
            print(f"[SERVO] Khởi tạo thành công trên GPIO {self.pin} (Trạng thái: ĐÓNG 0°, PWM Detached).")
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
                self.door_state = "CLOSED"
            else:
                self.door_state = self._open_state

    def open_gate_safe(
        self,
        mode: str,
        is_person_present_fn: Optional[Callable[[], bool]] = None,
        open_seconds: float = 3.0,
        close_delay_seconds: float = 5.0,
        max_hold_seconds: Optional[float] = None,
        detach_after_move: bool = False,
        on_state_change: Optional[Callable[[str], None]] = None,
    ):
        """Hold open while occupied, then close after continuous absence.

        - detach_after_move=True: Ngắt xung PWM (servo.angle = None) sau 0.6s quay để triệt tiêu
          nhiệt lượng cuộn dây, chống rung lắc (jitter) và chống sụt áp nguồn 5V (theo dht11_servo.py).
          Khi đóng cửa, tự động re-arm PWM tại góc mở và lướt mượt về 0° qua các góc trung gian để
          triệt tiêu hoàn toàn hiện tượng PWM Re-attach Glitch (khựng/nhích ngược) và chống sụt áp tức thời.
        - max_hold_seconds: Giới hạn thời gian mở tối đa chống kẹt cổng vô hạn khi test tại bàn.
        """
        if not self.enabled or self._stopping.is_set():
            return
        if not self._lock.acquire(blocking=False):
            print('[SERVO] Cổng đang mở; không xếp thêm chu kỳ mở/đóng.')
            return

        def _action():
            try:
                normalized = (mode or 'CHECK_IN').upper()
                self._open_state = 'OPEN_IN' if normalized == 'CHECK_IN' else 'OPEN_OUT'
                target_angle = 90.0
                print(f'[SERVO] Mở cổng {normalized}: {target_angle}°')
                self.set_angle(target_angle)
                if on_state_change:
                    on_state_change(self.door_state)
                # Cho motor quay đến góc đích rồi ngắt xung nếu detach_after_move để triệt tiêu rung lắc tại góc 90°
                move_time = 0.6 if detach_after_move else 1.0
                time.sleep(move_time)
                if detach_after_move:
                    self.set_angle(None)
                    print('[SERVO] 🔌 Đã ngắt xung PWM tại 90° -> Triệt tiêu rung lắc, motor nghỉ mát.')

                if is_person_present_fn is None:
                    self._stopping.wait(max(0.0, open_seconds - move_time))
                else:
                    absent_since = None
                    sensor_error = False
                    start_open = time.monotonic()
                    while not self._stopping.is_set():
                        # Timeout an toàn tối đa: Tránh kẹt mở vô hạn khi ngồi test tại bàn
                        if max_hold_seconds is not None and (time.monotonic() - start_open) >= max_hold_seconds:
                            print(f'[SERVO] ⚠️ Đạt thời gian mở tối đa ({max_hold_seconds}s) -> Tự động đóng cổng an toàn.')
                            break
                        try:
                            present = is_person_present_fn()
                            sensor_error = False
                        except Exception as exc:
                            # An unreadable sensor cannot confirm an empty doorway.
                            if not sensor_error:
                                print(f'[SERVO WARN] Không đọc được cảm biến; giữ mở: {exc}')
                            sensor_error = True
                            absent_since = None
                            time.sleep(0.1)
                            continue
                        if present:
                            if absent_since is not None:
                                print('[SERVO] Có người trở lại; hủy đếm đóng cửa.')
                            absent_since = None
                        else:
                            if absent_since is None:
                                absent_since = time.monotonic()
                                print(f'[SERVO] Không còn người; chờ {close_delay_seconds:g}s trước khi đóng.')
                            if time.monotonic() - absent_since >= close_delay_seconds:
                                break
                        time.sleep(0.1)
            finally:
                try:
                    print('[SERVO] Đóng cổng: 0°')
                    if detach_after_move:
                        # Ổn định lại xung tại 90° (80ms) trước khi kéo về 0° để triệt tiêu glitch giật ngược
                        self.set_angle(target_angle)
                        time.sleep(0.08)
                    self.set_angle(0.0)
                    if on_state_change:
                        on_state_change(self.door_state)
                    time.sleep(1.0)
                    self.set_angle(None)
                    print('[SERVO] 🔌 Đã đóng cổng 0° và ngắt xung PWM -> Motor nghỉ mát, 0 power.')
                finally:
                    self._lock.release()

        self._worker = threading.Thread(target=_action, daemon=True)
        try:
            self._worker.start()
        except Exception:
            self._lock.release()
            raise

    def close(self):
        """Giải phóng tài nguyên phần cứng."""
        self._stopping.set()
        if self._worker and self._worker is not threading.current_thread():
            self._worker.join(timeout=1.0)
        try:
            self.set_angle(0)
            time.sleep(1.0)
            self.set_angle(None)
            if self._servo:
                self._servo.close()
                self._servo = None
        except Exception:
            pass
