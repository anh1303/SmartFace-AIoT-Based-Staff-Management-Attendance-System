"""
Driver giao tiếp Cảm biến Vân tay Quang học (ZA620_M5 / Adafruit 4690 / R307 / AS608)
Giao thức: UART TTL Serial (Baudrate: 57600)
Hỗ trợ:
  - Bắt tay & Đọc thông số hệ thống (dung lượng, số vân tay đã lưu)
  - Điều khiển đèn LED cảm biến
  - Đăng ký vân tay (Enrollment 2 bước -> Template 512 bytes)
  - So khớp vân tay (1:N Onboard Search)
  - Trích xuất Template 512 bytes (UpChar) & Nạp Template vào cảm biến (DownChar)
  - Quản lý ngắt cảm ứng chạm ngón tay qua chân Tch (Touch Interrupt)
"""

import time
import base64
import fcntl
import hashlib
import os
import struct
import termios
from typing import Optional, Tuple, Dict, Any


class FingerprintSensor:
    # Định dạng gói tin UART chuẩn
    HEADER = bytes([0xEF, 0x01])
    DEFAULT_ADDR = bytes([0xFF, 0xFF, 0xFF, 0xFF])
    
    # PID (Package Identifier)
    PID_COMMAND = 0x01
    PID_DATA = 0x02
    PID_ACK = 0x07
    PID_END_DATA = 0x08

    # Mã lệnh (Instructions)
    CMD_VERIFY_PWD = 0x13
    CMD_READ_SYSPARA = 0x0F
    CMD_TEMPLATE_NUM = 0x1D
    CMD_GEN_IMG = 0x01
    CMD_IMG2TZ = 0x02
    CMD_REG_MODEL = 0x05
    CMD_STORE = 0x06
    CMD_SEARCH = 0x04
    CMD_DELETE = 0x0C
    CMD_EMPTY = 0x0D
    CMD_UP_CHAR = 0x08
    CMD_DOWN_CHAR = 0x09
    CMD_LED_CONTROL = 0x17
    CMD_AURA_LED = 0x35

    # Bảng mã lỗi phản hồi từ cảm biến
    CONFIRMATION_CODES = {
        0x00: "Thành công",
        0x01: "Lỗi nhận gói tin",
        0x02: "Không phát hiện ngón tay trên mặt kính",
        0x03: "Không lấy được ảnh vân tay",
        0x06: "Ảnh vân tay quá mờ/rối",
        0x07: "Ảnh vân tay quá ít điểm đặc trưng (quá nhỏ)",
        0x08: "Không khớp vân tay",
        0x09: "Không tìm thấy trong cơ sở dữ liệu",
        0x0A: "Hai lần đặt ngón tay không khớp nhau (ghép mẫu thất bại)",
        0x0B: "Vị trí PageID vượt quá dung lượng",
        0x0C: "Lỗi đọc template từ bộ nhớ",
        0x0D: "Lỗi truyền dữ liệu",
        0x0E: "Không thể nhận tiếp gói tin",
        0x0F: "Lỗi lưu ảnh",
        0x10: "Lỗi xóa template",
        0x11: "Lỗi xóa sạch cơ sở dữ liệu",
        0x13: "Mật khẩu sai",
        0x21: "Lỗi giao tiếp flash"
    }

    def __init__(self, port: str = "/dev/serial0", baudrate: int = 57600, timeout: float = 1.0):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.ser = None
        self.is_connected = False
        self.capacity = 1000
        self.touch_device = None
        self.last_error = ""
        self._port_lock = None
        self.packet_size = 128

    def connect(self) -> bool:
        """One owner per physical UART, across app and standalone test processes."""
        self.close()
        try:
            import serial
            lock_name = hashlib.sha256(os.path.realpath(self.port).encode()).hexdigest()[:16]
            self._port_lock = open(f'/tmp/smartface-fingerprint-{lock_name}.lock', 'a')
            fcntl.flock(self._port_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.ser = serial.Serial(self.port, self.baudrate, timeout=.05,
                                     write_timeout=self.timeout, exclusive=True)
            fcntl.ioctl(self.ser.fileno(), termios.TIOCEXCL)
            self._needs_reconnect = False
            self.ser.reset_input_buffer()
            time.sleep(.1)
            ack, _ = self._send_command(self.CMD_VERIFY_PWD, bytes(4))
            if ack != 0:
                raise RuntimeError(f'Không xác thực được cảm biến (ACK={ack:#04x})')
            if not self.read_sys_params():
                raise RuntimeError('Không đọc được thông số cảm biến')
            self.is_connected, self.last_error = True, ''
            return True
        except Exception as exc:
            # Never include serial payloads or biometric bytes in error logs.
            self.last_error = f'UART không sẵn sàng: {type(exc).__name__}: {exc}'
            self.close()
            return False

    def close(self):
        if self.ser:
            try:
                if self.ser.is_open:
                    fcntl.ioctl(self.ser.fileno(), termios.TIOCNXCL)
                    self.ser.close()
            finally:
                self.ser = None
        if self._port_lock:
            self._port_lock.close()
            self._port_lock = None
        self.is_connected = False
        if self.touch_device:
            self.touch_device.close()
            self.touch_device = None

    # -------------------------------------------------------------------------
    # Các hàm gửi / nhận gói tin UART
    # -------------------------------------------------------------------------

    def _build_packet(self, pid: int, data: bytes) -> bytes:
        """Đóng gói packet UART: HEADER + ADDR + PID + LENGTH + DATA + CHECKSUM."""
        length = len(data) + 2  # data + 2 bytes checksum
        packet = self.HEADER + self.DEFAULT_ADDR + bytes([pid, (length >> 8) & 0xFF, length & 0xFF]) + data
        checksum = (pid + ((length >> 8) & 0xFF) + (length & 0xFF) + sum(data)) & 0xFFFF
        packet += bytes([(checksum >> 8) & 0xFF, checksum & 0xFF])
        return packet

    def _read_packet(self, deadline):
        def exact(count):
            out = bytearray()
            while len(out) < count and time.monotonic() < deadline:
                out.extend(self.ser.read(count - len(out)))
            if len(out) != count:
                raise TimeoutError('UART response timeout')
            return bytes(out)
        window = b''
        while time.monotonic() < deadline:
            window = (window + exact(1))[-2:]
            if window == self.HEADER:
                break
        else:
            raise TimeoutError('UART response timeout')
        header = exact(7)
        length = int.from_bytes(header[5:7], 'big')
        if header[:4] != self.DEFAULT_ADDR or not 3 <= length <= 258:
            raise ValueError('Invalid UART frame header')
        raw = exact(length)
        if (sum(header[4:]) + sum(raw[:-2])) & 65535 != int.from_bytes(raw[-2:], 'big'):
            raise ValueError('UART checksum mismatch')
        return header[4], raw[:-2]

    def _send_command(self, cmd: int, args=None) -> Tuple[int, bytes]:
        if not self.ser or not self.ser.is_open:
            return 0xFF, b''
        # No parallel commands. A timed-out command invalidates the connection;
        # caller must reconnect before any subsequent request.
        if getattr(self, '_needs_reconnect', False):
            return 0xFE, b''
        try:
            self.ser.write(self._build_packet(self.PID_COMMAND, bytes([cmd]) + bytes(args or [])))
            self.ser.flush()
            pid, data = self._read_packet(time.monotonic() + self.timeout)
            if pid != self.PID_ACK:
                raise ValueError('Expected ACK packet')
            return data[0], data[1:]
        except (TimeoutError, ValueError, OSError):
            self._needs_reconnect = True
            return 0xFE, b''

    def _read_ack(self):
        try:
            pid, data = self._read_packet(time.monotonic() + self.timeout)
            if pid != self.PID_ACK:
                raise ValueError('Expected ACK')
            return data[0], data[1:]
        except (TimeoutError, ValueError, OSError):
            self._needs_reconnect = True
            return 0xFE, b''

    def match_buffers(self):
        ack, data = self._send_command(0x03)
        return ack, int.from_bytes(data[:2], 'big') if len(data) >= 2 else None

    def load_template(self, page_id, buffer_id=1):
        return self._send_command(0x07, [buffer_id, page_id >> 8, page_id & 255])[0]

    # -------------------------------------------------------------------------
    # Các hàm chức năng hệ thống
    # -------------------------------------------------------------------------

    def read_sys_params(self) -> Optional[Dict[str, Any]]:
        """Đọc thông số phần cứng của cảm biến."""
        ack, payload = self._send_command(self.CMD_READ_SYSPARA)
        if ack != 0x00 or len(payload) < 16:
            return None

        status = (payload[0] << 8) | payload[1]
        sensor_type = (payload[2] << 8) | payload[3]
        capacity = (payload[4] << 8) | payload[5]
        sec_level = (payload[6] << 8) | payload[7]
        baud_mult = (payload[14] << 8) | payload[15]

        self.capacity = capacity
        self.packet_size = {0: 32, 1: 64, 2: 128, 3: 256}.get(int.from_bytes(payload[12:14], "big"), 128)
        return {
            "status": status,
            "sensor_type": sensor_type,
            "capacity": capacity,
            "security_level": sec_level,
            "baudrate": baud_mult * 9600,
        }

    def get_template_count(self) -> int:
        """Đọc số lượng vân tay hiện đang lưu trong Flash cảm biến."""
        ack, payload = self._send_command(self.CMD_TEMPLATE_NUM)
        if ack == 0x00 and len(payload) >= 2:
            return (payload[0] << 8) | payload[1]
        return -1

    def set_led(self, state: bool) -> bool:
        """Bật hoặc tắt đèn LED chiếu sáng mặt kính cảm biến."""
        # Thử lệnh LED Control 0x17
        cmd_arg = 0x01 if state else 0x00
        ack, _ = self._send_command(self.CMD_LED_CONTROL, [cmd_arg])
        if ack == 0x00:
            return True

        # Fallback thử lệnh Aura LED 0x35
        # 0x01: thở, 0x02: nhấp nháy, 0x03: luôn sáng, 0x04: tắt
        mode = 0x03 if state else 0x04
        ack2, _ = self._send_command(self.CMD_AURA_LED, [mode, 0x00, 0x01, 0x00])
        return ack2 == 0x00

    # -------------------------------------------------------------------------
    # Nhận diện & Lấy mẫu (Capture / Match / Enroll)
    # -------------------------------------------------------------------------

    def capture_image(self) -> int:
        """Chụp ảnh vân tay vào bộ đệm ImageBuffer (0x00 nếu có ngón tay)."""
        ack, _ = self._send_command(self.CMD_GEN_IMG)
        return ack

    def image_to_charbuffer(self, buffer_id: int = 1) -> int:
        """Trích xuất đặc trưng từ ImageBuffer sang CharBuffer (1 hoặc 2)."""
        ack, _ = self._send_command(self.CMD_IMG2TZ, [buffer_id])
        return ack

    def create_model(self) -> int:
        """Ghép 2 bộ đặc trưng ở CharBuffer1 và CharBuffer2 thành 1 Template hoàn chỉnh."""
        ack, _ = self._send_command(self.CMD_REG_MODEL)
        return ack

    def store_template(self, page_id: int, buffer_id: int = 1) -> int:
        """Lưu template từ CharBuffer vào bộ nhớ Flash tại vị trí page_id."""
        page_high = (page_id >> 8) & 0xFF
        page_low = page_id & 0xFF
        ack, _ = self._send_command(self.CMD_STORE, [buffer_id, page_high, page_low])
        return ack

    def search_database(self, buffer_id: int = 1, start_page: int = 0, page_count: int = 1000) -> Tuple[bool, int, int]:
        """
        Tìm kiếm 1:N trong bộ nhớ Flash của cảm biến.
        Trả về: (tìm_thấy, page_id, match_score)
        """
        args = [
            buffer_id,
            (start_page >> 8) & 0xFF,
            start_page & 0xFF,
            (page_count >> 8) & 0xFF,
            page_count & 0xFF,
        ]
        ack, payload = self._send_command(self.CMD_SEARCH, args)
        self.last_search_ack = ack
        if ack == 0x00 and len(payload) >= 4:
            page_id = (payload[0] << 8) | payload[1]
            score = (payload[2] << 8) | payload[3]
            return True, page_id, score
        return False, -1, 0

    def delete_template(self, page_id: int, count: int = 1) -> bool:
        """Xóa template tại page_id."""
        args = [
            (page_id >> 8) & 0xFF,
            page_id & 0xFF,
            (count >> 8) & 0xFF,
            count & 0xFF,
        ]
        ack, _ = self._send_command(self.CMD_DELETE, args)
        return ack == 0x00

    def empty_database(self) -> bool:
        """Xóa toàn bộ vân tay trong bộ nhớ Flash của cảm biến."""
        ack, _ = self._send_command(self.CMD_EMPTY)
        return ack == 0x00

    # -------------------------------------------------------------------------
    # Trích xuất Template 512 bytes (UpChar / DownChar)
    # -------------------------------------------------------------------------

    def upload_template(self, buffer_id: int = 1) -> Optional[bytes]:
        """Trích xuất template từ CharBuffer (1 hoặc 2) về host. Hỗ trợ 512B hoặc 768B (ZA620)."""
        ack, _ = self._send_command(self.CMD_UP_CHAR, [buffer_id])
        if ack != 0:
            return None
        result = bytearray()
        try:
            deadline = time.monotonic() + max(5, self.timeout)
            while True:
                pid, data = self._read_packet(deadline)
                if pid not in (self.PID_DATA, self.PID_END_DATA) or len(result) + len(data) > 1024:
                    raise ValueError('Invalid template transfer')
                result.extend(data)
                if pid == self.PID_END_DATA:
                    # Chấp nhận kích thước chuẩn: 512 bytes (4x128) hoặc 768 bytes (6x128 trên ZA620_M5)
                    return bytes(result) if len(result) in (512, 768, 1024) else None
        except (TimeoutError, ValueError, OSError):
            self._needs_reconnect = True
            return None

    def download_template(self, buffer_id: int = 1, template_bytes: bytes = None) -> bool:
        """Nạp template (512B hoặc 768B) từ host vào CharBuffer (1 hoặc 2) của cảm biến."""
        if not template_bytes or len(template_bytes) not in (512, 768, 1024):
            return False
        if self.ser and hasattr(self.ser, 'reset_input_buffer'):
            self.ser.reset_input_buffer()
        ack, _ = self._send_command(self.CMD_DOWN_CHAR, [buffer_id])
        if ack != 0:
            return False
        total_len = len(template_bytes)
        for i in range(0, total_len, self.packet_size):
            part = template_bytes[i:i + self.packet_size]
            pid = self.PID_END_DATA if i + len(part) == total_len else self.PID_DATA
            self.ser.write(self._build_packet(pid, part))
            self.ser.flush()
            time.sleep(0.015)
        time.sleep(0.05)
        if self.ser and getattr(self.ser, 'in_waiting', 0) > 0 and hasattr(self.ser, 'reset_input_buffer'):
            self.ser.reset_input_buffer()
        return True

    # -------------------------------------------------------------------------
    # Hỗ trợ Ngắt cảm ứng chạm (Touch Interrupt via GPIO 17 - Đã né chân TFT/Servo)
    # -------------------------------------------------------------------------

    def setup_touch_interrupt(self, gpio_pin: int = 17, on_touch_callback=None):
        """
        Cấu hình chân ngắt Tch trên Raspberry Pi.
        Mặc định: GPIO 17 (Pin 11) - Chân an toàn đã giải phóng, tránh xung đột TFT Reset (GPIO 24).
        Khi ngón tay chạm vào kính, cảm biến kéo chân Tch lên HIGH -> gọi callback.
        """
        try:
            from gpiozero import Button
            # Tch thường xuất mức HIGH khi chạm vào
            self.touch_device = Button(gpio_pin, pull_up=False, bounce_time=0.05)
            if on_touch_callback:
                self.touch_device.when_pressed = on_touch_callback
            return True
        except Exception as e:
            print(f"[Fingerprint] Không thể khởi tạo chân ngắt Tch GPIO {gpio_pin}: {e}")
            return False
