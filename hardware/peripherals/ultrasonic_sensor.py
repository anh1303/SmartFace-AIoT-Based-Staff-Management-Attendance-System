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
    # Khóa dùng chung giữa nhiều cảm biến siêu âm để tránh phát sóng siêu âm cùng lúc gây nhiễu chéo (cross-talk)
    _SHARED_PING_LOCK = threading.Lock()

    def __init__(
        self,
        enabled: bool = True,
        trig_pin: int = 23,
        echo_pin: int = 27,
        max_distance: float = 100.0,
        trigger_distance: float = 20.0,
        poll_interval: float = 0.08,
        window_size: int = 3,
        debounce_duration: float = 0.5,
        name: str = "ULTRASONIC",
    ):
        """
        Khởi tạo cảm biến siêu âm.

        :param enabled: Bật/tắt tính năng cảm biến siêu âm.
        :param trig_pin: Chân GPIO xuất xung Trigger (BCM numbering).
        :param echo_pin: Chân GPIO nhận xung Echo (BCM numbering).
        :param max_distance: Khoảng cách tối đa hợp lệ (cm). Vượt quá ngưỡng này coi là không có người.
        :param trigger_distance: Khoảng cách ngưỡng để kích hoạt trạng thái THỨC / CHỌN MODE (cm).
        :param poll_interval: Chu kỳ đo giữa các lần phát xung (giây, mặc định 0.08s = 12.5Hz).
        :param window_size: Số lượng mẫu đo lưu trong hàng đợi để tính trung vị (Median Filter).
        :param debounce_duration: Thời gian duy trì trạng thái ổn định liên tục để chuyển đổi (giây, mặc định 0.5s).
        :param name: Tên định danh cảm biến (ví dụ: CHECK_IN, CHECK_OUT).
        """
        self.enabled = enabled
        self.name = name
        self.trig_pin = trig_pin
        self.echo_pin = echo_pin
        self.max_distance = float(max_distance)
        self.trigger_distance = float(trigger_distance)
        self.poll_interval = float(poll_interval)
        self.window_size = max(1, int(window_size))
        self.debounce_duration = max(0.0, float(debounce_duration))

        self._lock = threading.Lock()
        self._samples = collections.deque(maxlen=self.window_size)
        self._current_distance: Optional[float] = None
        self._presence_state = False
        self._candidate_state = False
        self._candidate_start_time = 0.0
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
            # Cho cảm biến 0.05s ổn định chân điện áp
            time.sleep(0.05)
            print(f"[{self.name}] Đã khởi tạo GPIO (BCM TRIG={self.trig_pin}, ECHO={self.echo_pin}, Ngưỡng={self.trigger_distance}cm)")
        except Exception as e:
            print(f"[{self.name}] [WARN] Không thể nạp RPi.GPIO ({e}). Kích hoạt Mock Dummy Mode!")
            self._mock_mode = True

    def start(self):
        """Bắt đầu worker thread đo khoảng cách định kỳ trong nền."""
        if not self.enabled:
            return

        self._is_active = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True, name=f"Ultrasonic_{self.name}")
        self._thread.start()
        print(f"[{self.name}] Background Thread đã chạy (Tần số: {1.0 / self.poll_interval:.1f}Hz, Ngưỡng: {self.trigger_distance}cm, Max: {self.max_distance}cm)")

    def _measure_once(self) -> Optional[float]:
        """
        Phát xung trigger 10us và đo độ rộng xung Echo để tính khoảng cách (cm).
        Có timeout an toàn 25ms và khóa chống nhiễu chéo giữa 2 cảm biến.
        """
        if self._mock_mode or self._gpio is None:
            # Ở chế độ giả lập không có GPIO, trả về None (không che cảm biến)
            return None

        GPIO = self._gpio
        with UltrasonicSensor._SHARED_PING_LOCK:
            try:
                # 1. Phát xung Trigger 10 microseconds
                GPIO.output(self.trig_pin, True)
                time.sleep(0.00001)
                GPIO.output(self.trig_pin, False)

                # 2. Chờ Echo lên mức HIGH (Timeout 25ms)
                start_wait = time.monotonic()
                pulse_start = start_wait
                while GPIO.input(self.echo_pin) == 0:
                    pulse_start = time.monotonic()
                    if pulse_start - start_wait > 0.025:
                        return None  # Timeout không thấy phản hồi

                # 3. Chờ Echo xuống mức LOW (Timeout 25ms)
                pulse_end = pulse_start
                while GPIO.input(self.echo_pin) == 1:
                    pulse_end = time.monotonic()
                    if pulse_end - pulse_start > 0.025:
                        return None  # Timeout xung quá dài

                # 4. Tính khoảng cách dựa trên vận tốc âm thanh 343 m/s = 34300 cm/s
                duration = pulse_end - pulse_start
                distance_cm = (duration * 34300.0) / 2.0

                # Giới hạn vật lý của cảm biến (khoảng 1.5cm đến max_distance cm)
                if 1.5 <= distance_cm <= (self.max_distance + 20.0):
                    return round(distance_cm, 1)
                return None
            except Exception:
                return None

    def _update_presence_state(self, now: float):
        """
        Cập nhật trạng thái người hiện diện có debounce 2 chiều:
        - Đưa tay vào: Phải liên tục <= trigger_distance trong >= debounce_duration (0.5s) mới chuyển True.
        - Rút tay ra: Phải liên tục > trigger_distance (hoặc None) trong >= debounce_duration (0.5s) mới chuyển False.
        """
        raw_present = (
            self._current_distance is not None
            and 1.5 <= self._current_distance <= self.trigger_distance
        )
        if self.debounce_duration <= 0.0:
            self._presence_state = raw_present
            return

        if raw_present != self._presence_state:
            if self._candidate_state != raw_present:
                self._candidate_state = raw_present
                self._candidate_start_time = now
            elif now - self._candidate_start_time >= self.debounce_duration:
                self._presence_state = raw_present
        else:
            self._candidate_state = self._presence_state
            self._candidate_start_time = now

    def _worker_loop(self):
        """Vòng lặp đọc dữ liệu liên tục trong thread ngầm."""
        while self._is_active:
            raw_dist = self._measure_once()
            now = time.monotonic()

            with self._lock:
                if raw_dist is not None:
                    self._samples.append(raw_dist)
                    # Tính trung vị (Median) để loại bỏ nhiễu spike đột ngột
                    if len(self._samples) >= 3:
                        median_val = statistics.median(self._samples)
                        self._current_distance = round(median_val, 1)
                    else:
                        self._current_distance = raw_dist
                else:
                    # Nếu đo lỗi nhiều lần liên tiếp, làm sạch mẫu để chuyển về trạng thái không có người
                    if len(self._samples) > 0:
                        self._samples.popleft()
                    if len(self._samples) == 0:
                        self._current_distance = None

                self._update_presence_state(now)

            time.sleep(self.poll_interval)

    def get_distance(self) -> Optional[float]:
        """
        Lấy giá trị khoảng cách đã được lọc nhiễu gần nhất (cm).
        Trả về None nếu không đo được hoặc nằm ngoài phạm vi.
        """
        with self._lock:
            return self._current_distance

    def set_mock_distance(self, dist: Optional[float], now: Optional[float] = None):
        """Hỗ trợ unit test và giả lập giá trị khoảng cách mà không cần GPIO."""
        with self._lock:
            self._current_distance = dist
            self._update_presence_state(now if now is not None else time.monotonic())

    def is_person_present(self) -> bool:
        """
        Kiểm tra xem có người/tay đưa vào vùng kích hoạt (khoảng cách <= trigger_distance) hay không.
        Đã được lọc trễ ổn định (debounce 0.5s) cả khi đưa tay vào và khi rút tay ra.
        """
        if not self.enabled:
            return False
        with self._lock:
            return self._presence_state

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
        print(f"[{self.name}] Cảm biến siêu âm đã tắt an toàn.")
