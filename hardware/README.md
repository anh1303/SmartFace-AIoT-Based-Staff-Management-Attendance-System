# SmartFace Hardware

Runtime độc lập cho Raspberry Pi: camera, detector/tracking, PAD, nhận diện, giao tiếp chấm công, video và ngoại vi như TFT, siêu âm, servo, vân tay.

## Yêu cầu

- Raspberry Pi OS/Linux 64-bit ARM64; driver dùng `fcntl`, `termios` và GPIO nên không chạy nguyên trạng trên Windows.
- Camera tương thích OpenCV, Python và FFmpeg.
- Model/runtime JSON trong `models/`, cấu hình khớp backend và bộ embedding đã đăng ký.
- Backend/ThingsBoard/MediaMTX theo chế độ kết nối được chọn.

## Cài đặt trên Pi

Từ thư mục `hardware/` đã chép sang Pi:

```sh
bash setup_pi.sh
.venv/bin/python configure.py
.venv/bin/python check_connection.py
.venv/bin/python edge_client.py
```

`setup_pi.sh` cài gói hệ thống/dependencies, tạo `.venv` và giữ `.env` đã có. Dùng `configure.py` để nhập cấu hình, đối chiếu [.env.example](.env.example).

Cách vận hành chi tiết: [RUN_ON_PI.md](RUN_ON_PI.md). Cách nối dây: [hướng dẫn ThingsBoard/Pi](../docs/tutorial/thingsboard/THINGSBOARD_PI_SETUP.md). IP/kết quả thử có ngày trong tài liệu là hồ sơ lịch sử, không phải cấu hình mặc định cho máy mới.

## Cấu hình chính

| Nhóm | Tham số cần đối chiếu |
| --- | --- |
| Thiết bị | `DEVICE_ID`, `INITIAL_MODE` |
| ThingsBoard | `TB_HOST`, `TB_PORT`, `TB_TOKEN` |
| Camera | `CAMERA_INDEX`, `CAMERA_WIDTH`, `CAMERA_HEIGHT`, `CAMERA_FPS` |
| Sinh trắc học | `config.py`, model/embedding version, PAD runtime/adaptive config |
| Video | `STREAM_ENABLED`, `RTSP_URL` |
| Ngoại vi | `TFT_*`, `ULTRASONIC_*`, `SERVO_*` và cấu hình vân tay |

[edge_client.py](edge_client.py), [config.py](config.py) và `.env.example` là nguồn đối chiếu biến thực tế. Nhận diện cục bộ/từ xa và gửi chấm công phải dùng đúng hợp đồng server tương ứng.

PAD và ArcFace có cấu hình riêng. Không đổi crop, threshold hoặc preprocessing giữa runtime mà không kiểm tra contract. Điểm nhận diện, liveness và xác nhận chấm công có vai trò khác nhau.

## Cấu trúc

- `edge_client.py`: điều phối runtime/vòng đời thiết bị.
- `detection/`, `tracking/`, `antispoof/`, `alignment/`, `recognition/`: pipeline khuôn mặt.
- `iot/`: ThingsBoard và HTTP chấm công trực tiếp.
- `peripherals/`, `display/`: driver và TFT.
- `streaming/`: gửi video tới MediaMTX.
- `models/`: artifact triển khai; `validation/`: kiểm tra còn được giữ.

## Kiểm tra

Trên Pi đã cấu hình:

```sh
.venv/bin/python check_runtime.py
.venv/bin/python check_connection.py
```

Đọc công cụ trước khi chạy: kiểm tra kết nối có thể truy cập thiết bị/dịch vụ thật. Test còn lại chạy bằng `python -m unittest discover -s validation -p 'test_*.py'` tại thư mục này. Một số test cần Linux, GPIO hoặc model/cấu hình cụ thể; test offline không xác nhận toàn bộ phần cứng đạt.

Xem [Face Auth](../face_auth/README.md).
