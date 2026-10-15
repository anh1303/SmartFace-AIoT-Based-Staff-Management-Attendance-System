"""
Module UltrasonicSensor: Điều khiển cảm biến siêu âm (HC-SR04 / HC-SR04P / RCWL-1601)
trên Raspberry Pi 4 để thực hiện cơ chế Wake-on-Presence (Đánh thức khi có người).

Đặc tính:
1. Chạy trên một Background Daemon Thread riêng biệt (10Hz - 15Hz), không block luồng camera.
2. Có bộ lọc trung vị (Median Filter) 5 mẫu để triệt tiêu xung nhiễu (0cm hoặc gai spike do phản xạ).
3. Có cơ chế Timeout an toàn chống treo CPU nếu cảm biến bị mất kết nối hoặc rút dây.
4. Tự động chuyển sang Mock Dummy nếu không chạy trên môi trường Linux/Raspberry Pi (tránh crash khi dev/test).
"""

import collections
import statistics
import threading
import time
from typing import Optional


class UltrasonicSensor:
    def __init__(
        self,
        enabled: bool = True,
        trig_pin: int = 23,
        echo_pin: int = 27,
        max_distance: float = 100.0,
        trigger_distance: float = 50.0,
        poll_interval: float = 0.08,
        window_size: int = 5,
    ):
        """
        Khởi tạo cảm biến siêu âm.

        :param enabled: Bật/tắt tính năng cảm biến siêu âm.
        :param trig_pin: Chân GPIO xuất xung Trigger (BCM numbering).
        :param echo_pin: Chân GPIO nhận xung Echo (BCM numbering).
        :param max_distance: Khoảng cách tối đa hợp lệ (cm). Vượt quá ngưỡng này coi là không có người.
        :param trigger_distance: Khoảng cách ngưỡng để kích hoạt trạng thái THỨC (cm).
        :param poll_interval: Chu kỳ đo giữa các lần phát xung (giây, mặc định 0.08s = 12.5Hz).
        :param window_size: Số lượng mẫu đo lưu trong hàng đợi để tính trung vị (Median Filter).
        """
        self.enabled = enabled
        self.trig_pin = trig_pin
        self.echo_pin = echo_pin
        self.max_distance = float(max_distance)
        self.trigger_distance = float(trigger_distance)
        self.poll_interval = float(poll_interval)
        self.window_size = max(3, int(window_size))

        self._lock = threading.Lock()
        self._samples = collections.deque(maxlen=self.window_size)
        self._current_distance: Optional[float] = None
        self._is_active = False
        self._thread: Optional[threading.Thread] = None
        self._gpio = None
        self._mock_mode = False

        if not self.enabled:
            return

        # Khởi tạo GPIO trên Raspberry Pi
        try:
            import RPi.GPIO as GPIO

            self._gpio = GPIO
            self._gpio.setmode(GPIO.BCM)
            self._gpio.setwarnings(False)
            self._gpio.setup(self.trig_pin, GPIO.OUT)
            self._gpio.setup(self.echo_pin, GPIO.IN)
            self._gpio.output(self.trig_pin, False)
            # Cho cảm biến 0.1s ổn định chân điện áp
            time.sleep(0.1)
            print(f"[ULTRASONIC] Đã khởi tạo GPIO (BCM TRIG={self.trig_pin}, ECHO={self.echo_pin})")
        except Exception as e:
            print(f"[ULTRASONIC] [WARN] Không thể nạp RPi.GPIO ({e}). Kích hoạt Mock Dummy Mode!")
            self._mock_mode = True

    def start(self):
        """Bắt đầu worker thread đo khoảng cách định kỳ trong nền."""
        if not self.enabled:
            return

        self._is_active = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True, name="UltrasonicThread")
        self._thread.start()
        print(f"[ULTRASONIC] Background Thread đã chạy (Tần số: {1.0 / self.poll_interval:.1f}Hz, Ngưỡng: {self.trigger_distance}cm, Max: {self.max_distance}cm)")

    def _measure_once(self) -> Optional[float]:
        """
        Phát xung trigger 10us và đo độ rộng xung Echo để tính khoảng cách (cm).
        Có timeout an toàn 30ms (tương đương max ~5m) để chống treo thread.
        """
        if self._mock_mode or self._gpio is None:
            # Ở chế độ test trên máy tính, trả về khoảng cách giả lập (30cm: luôn có người)
            return 30.0

        GPIO = self._gpio
        try:
            # 1. Phát xung Trigger 10 microseconds
            GPIO.output(self.trig_pin, True)
            time.sleep(0.00001)
            GPIO.output(self.trig_pin, False)

            # 2. Chờ Echo lên mức HIGH (Timeout 30ms)
            start_wait = time.monotonic()
            pulse_start = start_wait
            while GPIO.input(self.echo_pin) == 0:
                pulse_start = time.monotonic()
                if pulse_start - start_wait > 0.03:
                    return None  # Timeout không thấy phản hồi

            # 3. Chờ Echo xuống mức LOW (Timeout 30ms)
            pulse_end = pulse_start
            while GPIO.input(self.echo_pin) == 1:
                pulse_end = time.monotonic()
                if pulse_end - pulse_start > 0.03:
                    return None  # Timeout xung quá dài

            # 4. Tính khoảng cách dựa trên vận tốc âm thanh 343 m/s = 34300 cm/s
            duration = pulse_end - pulse_start
            distance_cm = (duration * 34300.0) / 2.0

            # Giới hạn vật lý của cảm biến (khoảng 2cm đến max_distance cm)
            if 2.0 <= distance_cm <= (self.max_distance + 20.0):
                return round(distance_cm, 1)
            return None
        except Exception:
            return None

    def _worker_loop(self):
        """Vòng lặp đọc dữ liệu liên tục trong thread ngầm."""
        while self._is_active:
            raw_dist = self._measure_once()

            if raw_dist is not None:
                with self._lock:
                    self._samples.append(raw_dist)
                    # Tính trung vị (Median) để loại bỏ nhiễu spike đột ngột
                    if len(self._samples) >= 3:
                        median_val = statistics.median(self._samples)
                        self._current_distance = round(median_val, 1)
                    else:
                        self._current_distance = raw_dist
            else:
                # Nếu đo lỗi nhiều lần liên tiếp, làm sạch mẫu để chuyển về trạng thái không có người
                with self._lock:
                    if len(self._samples) > 0:
                        self._samples.popleft()
                    if len(self._samples) == 0:
                        self._current_distance = None

            time.sleep(self.poll_interval)

    def get_distance(self) -> Optional[float]:
        """
        Lấy giá trị khoảng cách đã được lọc nhiễu gần nhất (cm).
        Trả về None nếu không đo được hoặc nằm ngoài phạm vi.
        """
        with self._lock:
            return self._current_distance

    def is_person_present(self) -> bool:
        """
        Kiểm tra xem có người đứng trong vùng kích hoạt (khoảng cách <= trigger_distance) hay không.
        """
        if not self.enabled:
            return True  # Nếu tắt cảm biến siêu âm, luôn coi là có người (AI chạy liên tục)

        dist = self.get_distance()
        if dist is None:
            return False
        return 2.0 <= dist <= self.trigger_distance

    def stop(self):
        """Dừng worker thread và dọn dẹp GPIO."""
        self._is_active = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=0.5)

        if self._gpio is not None:
            try:
                self._gpio.cleanup((self.trig_pin, self.echo_pin))
            except Exception:
                pass
        print("[ULTRASONIC] Cảm biến siêu âm đã tắt an toàn.")
