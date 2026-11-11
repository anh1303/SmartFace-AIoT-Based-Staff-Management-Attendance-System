"""SmartFace gate output over Arduino USB Serial at 115200 baud."""
import time

from .servo_controller import ServoController


class ArduinoServoController(ServoController):
    def __init__(self, port: str, enabled: bool = True):
        self.port = port
        self._serial = None
        super().__init__(enabled=enabled)

    def _init_hardware(self):
        print(f"[SERVO] Arduino USB Serial: {self.port}")

    def initialize_closed(self):
        """Command the closed position before the kiosk starts processing scans."""
        if not self.enabled:
            return False
        try:
            self.set_angle(0.0)
            time.sleep(1.0)
            self.set_angle(None)
        except (OSError, RuntimeError, ImportError) as exc:
            print(f"[SERVO WARN] Chưa xác nhận được vị trí đóng lúc khởi động: {exc}")
            return False
        print("[SERVO] Uno đã xác nhận lệnh 0° và ngắt PWM lúc khởi động.")
        return True

    def _connect(self):
        import serial

        connection = serial.Serial(self.port, 115200, timeout=0.05,
                                   write_timeout=0.2, exclusive=True)
        try:
            # USB open can reset an Uno. Verify the sketch before moving the gate.
            deadline = time.monotonic() + 4
            while time.monotonic() < deadline and not self._stopping.is_set():
                connection.write(b"\nPING\n")
                for _ in range(4):
                    if connection.readline().strip() == b"PONG SMARTFACE_GATE":
                        self._serial = connection
                        return
            raise RuntimeError("Arduino did not identify as SMARTFACE_GATE")
        except Exception:
            connection.close()
            raise

    def _move_between(self, start: float, end: float, seconds: float):
        if self._serial is None and not self._stopping.is_set():
            self._connect()
        super()._move_between(start, end, seconds, smooth=True)

    def set_angle(self, angle):
        if self._serial is None:
            if self._stopping.is_set():
                return
            self._connect()
        pulse = None if angle is None else round(500 + angle * 2000 / 180)
        command = "DETACH" if pulse is None else f"SERVO {pulse}"
        try:
            packet = (command + "\n").encode("ascii")
            expected = ("OK " + command).encode("ascii")
            for _ in range(2):
                self._serial.write(packet)
                deadline = time.monotonic() + 0.12
                while time.monotonic() < deadline:
                    reply = self._serial.readline().strip()
                    if reply == expected:
                        super().set_angle(angle)
                        return
                    if reply.startswith(b"ERR "):
                        raise RuntimeError(f"Arduino rejected {command}: {reply!r}")
            raise RuntimeError(f"Arduino did not acknowledge {command}")
        except Exception:
            try:
                self._serial.write(b"\nDETACH\n")
            except OSError:
                pass
            finally:
                self._serial.close()
                self._serial = None
            raise

    def close(self):
        try:
            super().close()
        finally:
            if self._serial is not None:
                self._serial.close()
                self._serial = None
