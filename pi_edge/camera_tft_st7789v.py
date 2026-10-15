#!/usr/bin/env python3
"""Hiển thị camera lên TFT ST7789V 240x320 qua SPI, dừng bằng Ctrl+C."""
import argparse
from time import monotonic, sleep

import cv2
import numpy as np
from PIL import Image, ImageDraw


CAMERA_ID = 0
CAMERA_WIDTH = 320
CAMERA_HEIGHT = 240
CAMERA_FPS = 15
DISPLAY_FPS = 15  # Giới hạn tốc độ gửi ảnh qua SPI, không phải FPS đo được.
SPI_SPEED = 32_000_000
DC_PIN = 25
RESET_PIN = 24
ROTATE = 0  # 0: ngang; 1/3: dọc; 2: ngang ngược.
TEST_COLORS = False  # True: chỉ hiện bảng màu, không mở camera.
BGR = False  # True nếu màu đỏ và xanh dương bị đảo.
INVERT = False # Thử False nếu màu bị âm bản.
CAMERA_FORMAT = "MJPG"  # "MJPG", "YUYV" hoặc "auto"; tùy webcam hỗ trợ.
CAMERA_CHECK_PATH = None  # Đặt "camera_raw.png" để lưu ảnh gốc kiểm tra màu.


def rgb565_bytes(image):
    pixels = np.asarray(image, dtype=np.uint16)
    packed = ((pixels[:, :, 0] >> 3) << 11) | (
        (pixels[:, :, 1] >> 2) << 5
    ) | (pixels[:, :, 2] >> 3)
    return packed.astype(">u2").tobytes()  # Byte cao trước, 2 byte/pixel.


def display_st7789v(screen, image, bgr=False, invert=True):
    if image.mode != "RGB" or image.size != screen.size:
        raise ValueError("Ảnh gửi TFT phải là RGB và đúng screen.size")
    image = screen.preprocess(image)  # Xoay phần mềm về bộ nhớ gốc 320x240.
    if image.size != (320, 240):
        raise ValueError("Cửa sổ ngang ST7789V cần ảnh 320x240")
    # MX=1, MV=1: quét ngang 320x240; mặc định màu RGB.
    screen.command(0x36, 0x60 | (0x08 if bgr else 0))
    screen.command(0x21 if invert else 0x20)
    screen.command(0x3A, 0x55)  # RGB565, phải khớp đúng 2 byte/pixel.
    screen.command(0x2A, 0, 0, 1, 0x3F)  # Cột 0..319.
    screen.command(0x2B, 0, 0, 0, 0xEF)  # Hàng 0..239.
    screen.command(0x2C)
    screen.data(rgb565_bytes(image))


def color_test(size):
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    width, height = size
    colors = [("RED", "red"), ("GREEN", "lime"), ("BLUE", "blue"),
              ("WHITE", "white"), ("BLACK", "black")]
    for i, (label, color) in enumerate(colors):
        left, right = i * width // 5, (i + 1) * width // 5
        draw.rectangle((left, 0, right - 1, height - 1), fill=color)
        draw.text((left + 3, height // 2), label,
                  fill="black" if label in ("GREEN", "WHITE") else "white")
    draw.rectangle((0, 0, width - 1, height - 1), outline="yellow", width=2)
    draw.text((5, 5), "TOP LEFT", fill="white")
    draw.text((5, height - 18), "BOTTOM LEFT", fill="white")
    return image


def camera_image(frame, size):
    # Giữ tỷ lệ ảnh, thêm viền đen nếu tỷ lệ màn hình khác camera.
    width, height = size
    h, w = frame.shape[:2]
    scale = min(width / w, height / h)
    resized = cv2.resize(
        frame, (max(1, round(w * scale)), max(1, round(h * scale))),
        interpolation=cv2.INTER_AREA,
    )
    if resized.ndim == 2:
        rgb = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
    elif resized.ndim == 3 and resized.shape[2] == 3:
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    else:
        raise RuntimeError(f"Định dạng frame không phải BGR/gray: {resized.shape}")
    image = Image.fromarray(rgb)
    screen = Image.new("RGB", size, "black")
    screen.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
    return screen


def check_camera_frame(frame, path):
    # Lưu ảnh trước mọi xử lý TFT để kiểm tra màu từ camera.
    if not cv2.imwrite(path, frame):
        raise RuntimeError(f"Không lưu được ảnh kiểm tra: {path}")
    if frame.ndim == 2:
        print("Camera trả ảnh xám một kênh.")
    elif frame.ndim == 3 and frame.shape[2] == 3:
        pixels = frame.astype(np.int16)
        difference = np.mean(pixels.max(axis=2) - pixels.min(axis=2))
        print(f"Độ chênh B/G/R trung bình: {difference:.1f}/255")
        if difference < 2:
            print("Ảnh gốc gần như xám. Thử đặt vật đỏ/xanh trước camera.")
    print(f"Ảnh gốc camera: {path}, kích thước={frame.shape}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rotate", type=int, choices=[0, 1, 2, 3], default=ROTATE,
                        help="0: không xoay; 1/2/3: xoay 90/180/270 độ")
    parser.add_argument("--spi-mhz", type=int, choices=[4, 8, 16, 32, 64],
                        default=SPI_SPEED // 1_000_000)
    parser.add_argument("--test-colors", action=argparse.BooleanOptionalAction,
                        default=TEST_COLORS,
                        help="Thử màu và hướng màn hình, không mở camera")
    parser.add_argument("--bgr", action=argparse.BooleanOptionalAction, default=BGR,
                        help="Đổi thứ tự màu nếu đỏ và xanh dương bị đảo")
    parser.add_argument("--invert", action=argparse.BooleanOptionalAction,
                        default=INVERT, help="Bật/tắt inversion theo panel")
    parser.add_argument("--camera-check", metavar="PNG", default=CAMERA_CHECK_PATH,
                        help="Lưu một ảnh gốc camera sau 2 giây để kiểm tra màu")
    parser.add_argument("--camera-format", choices=["auto", "MJPG", "YUYV"],
                        default=CAMERA_FORMAT, help="Yêu cầu định dạng webcam nếu hỗ trợ")
    args = parser.parse_args()

    from luma.core.interface.serial import spi
    from luma.lcd.device import st7789
    import spidev

    spi_device = spidev.SpiDev()
    # luma không nhận 64 MHz trong danh sách tốc độ; đặt lại qua spidev.
    serial = spi(spi=spi_device, port=0, device=0, gpio_DC=DC_PIN, gpio_RST=RESET_PIN,
                 bus_speed_hz=min(args.spi_mhz, 32) * 1_000_000,
                 reset_hold_time=0.1, reset_release_time=0.15)
    screen = None
    camera = None
    try:
        spi_device.max_speed_hz = args.spi_mhz * 1_000_000
        # Ghi cả màn hình bằng RGB565, kể cả lúc driver clear()/cleanup().
        class ST7789VRGB565(st7789):
            def display(self, image):
                display_st7789v(self, image, bgr=args.bgr, invert=args.invert)

        # Cửa sổ quét ngang 320x240 được đặt rõ bằng MADCTL trong display().
        screen = ST7789VRGB565(serial, width=320, height=240, rotate=args.rotate,
                        backlight=lambda enabled: None)  # BL nối thẳng 3.3V.
        print(f"TFT ST7789V: {screen.size}, SPI={args.spi_mhz} MHz")
        print("DC=25, RST=24, SPI0/CE0. Nhấn Ctrl+C để dừng.")
        if args.test_colors:
            image = color_test(screen.size)
            while True:
                screen.display(image)
                sleep(0.5)

        camera = cv2.VideoCapture(CAMERA_ID)
        if args.camera_format != "auto":
            accepted = camera.set(cv2.CAP_PROP_FOURCC,
                                  cv2.VideoWriter_fourcc(*args.camera_format))
            print(f"Yêu cầu {args.camera_format}: {'chấp nhận' if accepted else 'không hỗ trợ'}")
        camera.set(cv2.CAP_PROP_CONVERT_RGB, 1)  # OpenCV trả ảnh BGR đã giải mã.
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
        camera.set(cv2.CAP_PROP_FPS, CAMERA_FPS)
        camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Tùy backend camera hỗ trợ.
        if not camera.isOpened():
            raise RuntimeError("Không mở được camera")

        last_display = 0
        started = monotonic()
        camera_checked = False
        report_time = started
        displayed_frames = 0
        while True:
            success, frame = camera.read()
            if not success:
                raise RuntimeError("Không đọc được hình từ camera")
            now = monotonic()
            if args.camera_check and not camera_checked and now - started >= 2:
                check_camera_frame(frame, args.camera_check)
                camera_checked = True
            if now - last_display >= 1 / DISPLAY_FPS:
                screen.display(camera_image(frame, screen.size))
                last_display = now
                displayed_frames += 1
                finished = monotonic()
                if finished - report_time >= 2:
                    print(f"TFT: {displayed_frames / (finished - report_time):.1f} FPS; "
                          f"xử lý/gửi frame: {(finished - now) * 1000:.0f} ms")
                    report_time = finished
                    displayed_frames = 0
    except KeyboardInterrupt:
        pass
    finally:
        if camera is not None:
            camera.release()
        if screen is not None:
            screen.cleanup()
        else:
            serial.cleanup()


if __name__ == "__main__":
    main()
