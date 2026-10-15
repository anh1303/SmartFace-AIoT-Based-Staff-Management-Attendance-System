"""
Module điều khiển màn hình TFT ST7789V 240x320 qua SPI trên Raspberry Pi.
Sử dụng driver SPI phần cứng và nén RGB565 trực tiếp để tối ưu hóa tốc độ hiển thị.
"""

from time import monotonic
import cv2
import numpy as np
from PIL import Image


def rgb565_bytes(image: Image.Image) -> bytes:
    """Đóng gói mảng RGB uint8 thành chuỗi byte RGB565 (2 byte/pixel, big-endian)."""
    pixels = np.asarray(image, dtype=np.uint16)
    packed = ((pixels[:, :, 0] >> 3) << 11) | (
        (pixels[:, :, 1] >> 2) << 5
    ) | (pixels[:, :, 2] >> 3)
    return packed.astype(">u2").tobytes()


def display_st7789v(screen, image: Image.Image, bgr: bool = False, invert: bool = False):
    """Ghi trực tiếp ảnh RGB565 vào bộ nhớ framebuffer của IC ST7789V."""
    if image.mode != "RGB" or image.size != screen.size:
        raise ValueError(f"Ảnh gửi TFT phải là RGB và đúng kích thước {screen.size}")
    image = screen.preprocess(image)  # Xoay phần mềm về bộ nhớ gốc 320x240
    if image.size != (320, 240):
        raise ValueError("Cửa sổ ngang ST7789V cần ảnh 320x240")

    # MX=1, MV=1: quét ngang 320x240; mặc định màu RGB
    screen.command(0x36, 0x60 | (0x08 if bgr else 0))
    screen.command(0x21 if invert else 0x20)
    screen.command(0x3A, 0x55)  # RGB565, đúng 2 byte/pixel
    screen.command(0x2A, 0, 0, 1, 0x3F)  # Cột 0..319
    screen.command(0x2B, 0, 0, 0, 0xEF)  # Hàng 0..239
    screen.command(0x2C)
    screen.data(rgb565_bytes(image))


def frame_to_tft_image(frame: np.ndarray, size: tuple) -> Image.Image:
    """
    Chuyển đổi frame BGR OpenCV sang định dạng PIL RGB
    với tỷ lệ tương ứng màn hình TFT (thêm letterbox đen nếu lệch tỷ lệ).
    """
    width, height = size
    h, w = frame.shape[:2]
    scale = min(width / w, height / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))

    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    if resized.ndim == 2:
        rgb = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
    elif resized.ndim == 3 and resized.shape[2] == 3:
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    else:
        raise RuntimeError(f"Định dạng frame không hợp lệ: {resized.shape}")

    img = Image.fromarray(rgb)
    canvas = Image.new("RGB", size, "black")
    canvas.paste(img, ((width - new_w) // 2, (height - new_h) // 2))
    return canvas


class TFTDisplay:
    """Lớp giao tiếp và điều khiển màn hình TFT ST7789V qua SPI."""

    def __init__(
        self,
        enabled: bool = True,
        width: int = 320,
        height: int = 240,
        rotate: int = 0,
        spi_mhz: int = 32,
        dc_pin: int = 25,
        reset_pin: int = 24,
        bgr: bool = False,
        invert: bool = False,
        max_fps: float = 15.0,
    ):
        self.enabled = enabled
        self.width = width
        self.height = height
        self.rotate = rotate
        self.spi_mhz = spi_mhz
        self.dc_pin = dc_pin
        self.reset_pin = reset_pin
        self.bgr = bgr
        self.invert = invert
        self.max_fps = max(float(max_fps), 1.0)
        self.min_interval = 1.0 / self.max_fps

        self.screen = None
        self.serial = None
        self.last_display_time = 0.0

        if not self.enabled:
            return

        try:
            import spidev
            from luma.core.interface.serial import spi
            from luma.lcd.device import st7789

            spi_device = spidev.SpiDev()
            self.serial = spi(
                spi=spi_device,
                port=0,
                device=0,
                gpio_DC=self.dc_pin,
                gpio_RST=self.reset_pin,
                bus_speed_hz=min(self.spi_mhz, 32) * 1_000_000,
                reset_hold_time=0.1,
                reset_release_time=0.15,
            )
            spi_device.max_speed_hz = self.spi_mhz * 1_000_000

            bgr_flag = self.bgr
            inv_flag = self.invert

            class ST7789VRGB565(st7789):
                def display(self, image):
                    display_st7789v(self, image, bgr=bgr_flag, invert=inv_flag)

            self.screen = ST7789VRGB565(
                self.serial,
                width=self.width,
                height=self.height,
                rotate=self.rotate,
                backlight=lambda enabled: None,
            )
            print(f"[TFT] [OK] Đã kết nối màn hình TFT ST7789V ({self.screen.size}, SPI={self.spi_mhz} MHz)")
        except ImportError as e:
            print(f"[TFT] [INFO] Không tìm thấy thư viện SPI/Luma ({e}). Tự động tắt màn hình TFT.")
            self.enabled = False
        except Exception as e:
            print(f"[TFT] [INFO] Không mở được thiết bị SPI ({e}). Tự động tắt màn hình TFT.")
            self.enabled = False

    def is_active(self) -> bool:
        """Kiểm tra màn hình TFT có đang sẵn sàng hoạt động hay không."""
        return self.enabled and self.screen is not None

    def show_frame(self, frame: np.ndarray):
        """Gửi frame ảnh (OpenCV BGR) đã vẽ bounding box/nhãn lên màn hình TFT."""
        if not self.is_active():
            return
        now = monotonic()
        if now - self.last_display_time >= self.min_interval:
            try:
                tft_img = frame_to_tft_image(frame, self.screen.size)
                self.screen.display(tft_img)
                self.last_display_time = now
            except Exception:
                pass

    def cleanup(self):
        """Dọn dẹp tài nguyên và tắt SPI khi kết thúc."""
        if self.screen is not None:
            try:
                self.screen.cleanup()
            except Exception:
                pass
        elif self.serial is not None:
            try:
                self.serial.cleanup()
            except Exception:
                pass
