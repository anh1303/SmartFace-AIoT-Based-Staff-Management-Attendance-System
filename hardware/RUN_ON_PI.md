# Chạy Pi Edge và kết nối ThingsBoard

> Hướng dẫn tổng hợp toàn hệ thống: [THINGSBOARD_PI_SETUP.md](../docs/tutorial/thingsboard/THINGSBOARD_PI_SETUP.md).

## Đã chạy trên Pi thật (15/10/2026)

- SSH: `piuser@10.52.138.23`; thư mục `/home/piuser/test/pi_edge`.
- Pi dùng Debian 13 ARM64, Python 3.13.5 trong `.venv` hiện có, FFmpeg đã có.
- Đã xác nhận MQTT đăng nhập/đọc shared mode, SCRFD/PAD/ArcFace chạy ảnh tổng hợp,
  USB webcam đọc frame 640×480. Đã sửa file `check_connection.py` trên Pi bị chép
  nhầm nội dung; file trước sửa có đuôi `.before-deploy`.
- Chạy client thật đã khởi tạo TFT SPI 32 MHz và HC-SR04 TRIG=23/ECHO=27.
  ThingsBoard nhận telemetry, có mẫu khoảng cách 98.9 cm và `ai_state=SLEEP`;
  MediaMTX xác nhận nhận stream H.264 tại `pi4_cam`.
- Client được chạy nền bằng `nohup`, ghi nối tiếp vào `edge_client.log`, PID lưu
  trong `.edge_client.pid`. Chưa cài tự khởi động sau reboot.
- Chưa xác minh chất lượng hiển thị TFT bằng mắt, độ chính xác PAD/nhận diện hoặc
  điểm danh khuôn mặt thật. Số đo/FPS telemetry là mẫu vận hành, không phải benchmark.

Trên Pi, xem log hoặc dừng phiên chạy nền:

```bash
cd ~/test/pi_edge
tail -f edge_client.log
# Dừng client khi cần (Ctrl+C ở tail chỉ thoát xem log):
kill "$(cat .edge_client.pid)"
```

Sau khi đã dừng client, chạy lại trực tiếp:

```bash
cd ~/test/pi_edge
.venv/bin/python -u edge_client.py
```

## Trạng thái đã cấu hình trên máy hiện tại (15/10/2026)

- IP LAN server: `10.52.138.38` (cần cập nhật nếu đổi Wi-Fi/mạng).
- ThingsBoard: `http://10.52.138.38:8081`, MQTT `10.52.138.38:1883`.
- MediaMTX: RTSP `rtsp://10.52.138.38:8554/pi4_cam`.
- Đã tạo device `PI4_FRONT_GATE`, shared `attendance_mode=CHECK_IN`, nối nhánh
  RPC qua `http://backend:3000/api/attendance/tb-webhook` rồi RPC reply.
- Token thực tế đã lưu trong `pi_edge/.env` và `backend/.env` (file local bị Git
  bỏ qua). Khi copy nguyên `pi_edge` có `.env` sang Pi, không cần tạo lại device
  hoặc điền lại token. `setup_pi.sh` giữ `.env` đã có.
- Đã build lại riêng backend vì image cũ chưa chứa route webhook.
- Đã kiểm tra MQTT login, đọc shared attribute và RPC hai chiều bằng gói giả lập
  có `antispoof_score=0`: backend trả `Anti-spoofing rejected` trước bước so khớp
  và tạo điểm danh. Đây là thử đường truyền, chưa xác nhận nhận diện thật.
- `.env` local đã bật TFT/siêu âm theo bộ phần cứng USB camera + ST7789V + HC-SR04.
  Kết quả kiểm tra Pi thật được cập nhật ở phần đầu tài liệu.

Các bước bên dưới cũng dùng để cài lại trên máy server mới. Trên máy hiện tại,
có thể bắt đầu từ phần Raspberry Pi.

## Máy server chạy Docker

Thực hiện tại thư mục gốc PBL6. Backend đang chạy bằng `docker-compose.cloud.yml`
hoặc `docker-compose.yml` dùng project `pbl6`. File IoT dùng cùng project để truy cập
backend qua DNS `backend`, không phụ thuộc cổng backend chỉ bind localhost.

```bash
# Chỉ tạo khi chưa có; sửa IP LAN máy server trong file này.
test -f .env.iot || cp .env.iot.example .env.iot
nano .env.iot
docker compose --env-file .env.iot -f docker-compose.iot.yml up -d
docker compose --env-file .env.iot -f docker-compose.iot.yml logs --tail=80 thingsboard
```

Không chạy `down --remove-orphans`: các service ứng dụng dùng chung project.
Lần đầu cần tải image và chờ ThingsBoard khởi tạo database riêng. Không seed/reset
database ứng dụng để cấu hình IoT.

Mở `http://<IP_SERVER>:8081`, đăng nhập tenant (cài mới mặc định
`tenant@thingsboard.org` / `tenant`). Tạo device `PI4_FRONT_GATE`, profile default,
Credentials loại Access token. Copy token từ thiết bị vào `.env` trên Pi.
Trong Attributes → Shared attributes, tạo chuỗi `attendance_mode=CHECK_IN`.

Trong Root Rule Chain, giữ các nhánh sẵn có và nối:

```text
Input → Message Type Switch
          └─ RPC Request from Device → REST API Call → Success → RPC Call Reply
```

REST API Call: POST, JSON, URL
`http://backend:3000/api/attendance/tb-webhook` nếu backend chạy trong Docker cùng
project. Nếu chạy `npm run dev` trên host, dùng
`http://host.docker.internal:3000/api/attendance/tb-webhook` và backend phải nghe
trên địa chỉ Docker truy cập được. Giữ payload `{method, params}` và metadata
`requestId` qua REST node để RPC Call Reply trả về đúng yêu cầu. Save rule chain.

Đây là **client-side two-way RPC**, không nối vector vào nhánh lưu telemetry.
Lệnh `check_connection.py` chỉ xác minh MQTT/attributes, chưa kiểm tra rule chain,
webhook hay khả năng so khớp khuôn mặt.

Để nút chuyển CHECK_IN/CHECK_OUT từ web hoạt động, điền vào `backend/.env`:

```dotenv
TB_HOST=thingsboard
TB_HTTP_PORT=9090
TB_USERNAME=tenant@thingsboard.org
TB_PASSWORD=<mật khẩu tenant thực tế>
TB_DEVICE_TOKEN=<token của PI4_FRONT_GATE>
TB_DEVICE_UUID=<Copy device ID trên ThingsBoard, không phải tên PI4_FRONT_GATE>
```

Nếu backend chạy trên host: dùng `TB_HOST=127.0.0.1`, `TB_HTTP_PORT=8081`.
Sau khi sửa, recreate riêng backend theo file compose đang dùng, ví dụ:

```bash
docker compose -f docker-compose.cloud.yml up -d --build --no-deps backend
```

Server cần cho Pi truy cập TCP 1883 (MQTT), 8554 (RTSP); trình duyệt xem video cần
8889/TCP và 8189/UDP. Không dùng IP localhost của server trong cấu hình Pi.

## Raspberry Pi 4, OS 64-bit

Từ máy tính copy thư mục đã cấu hình sang Pi:

```bash
scp -r pi_edge <USER_PI>@<IP_PI>:~/
```

Trên Pi:

```bash
cd ~/pi_edge
bash setup_pi.sh
.venv/bin/python configure.py
nano .env
.venv/bin/python check_connection.py
.venv/bin/python check_runtime.py --camera
.venv/bin/python edge_client.py
```

`configure.py` hỏi IP server và token bằng nhập ẩn, giữ các tham số AI.
Nếu ThingsBoard và MediaMTX khác máy, nhập IP riêng khi được hỏi.
Môi trường `.venv` tránh cài pip vào Python hệ thống trên Bookworm.
Giữ SCRFD mặc định: cần `insightface`, quá trình cài có thể biên dịch trên ARM64.
Không có cam kết thời gian cài đặt hoặc FPS trước khi đo trên Pi.

Cho lần thử với **USB webcam**, dùng `v4l2-ctl --list-devices` để chọn
`CAMERA_INDEX`, đặt `SHOW_GUI=false`, `TFT_ENABLED=false`,
`ULTRASONIC_ENABLED=false` nếu chưa nối ngoại vi. Với headless OpenCV,
`SHOW_GUI=true` không cung cấp cửa sổ desktop.

Với **camera CSI**, mã hiện tại dùng OpenCV VideoCapture. Kiểm tra camera bằng
`rpicam-hello --list-cameras` (Bookworm) và cài lớp tương thích trước khi thử:

```bash
sudo apt-get install -y libcamera-v4l2
libcamerify .venv/bin/python edge_client.py
```

CSI cần thử trên đúng camera/OS; nếu lớp tương thích không đọc được frame thì cần
tích hợp Picamera2, không coi việc liệt kê camera là pipeline đã hoạt động.

Trước khi chạy chính bằng CSI, có thể kiểm tra bằng
`libcamerify .venv/bin/python check_runtime.py --camera`.
`check_runtime.py` nạp detector/PAD/ArcFace và chạy ảnh tổng hợp, kiểm tra vector
512D, FFmpeg, rồi đọc một frame nếu có `--camera`. Không gọi `edge_client.main`,
không gửi MQTT hoặc điểm danh, không khởi tạo TFT/siêu âm. Nếu SCRFD fallback sang
YuNet, công cụ báo lỗi để bạn biết detector thực tế chưa đúng cấu hình.

## Pipeline CV và chế độ vận hành

- Mặc định chọn FULL qua `PAD_RUNTIME_CONFIG_PATH=models/R7_SC_FULL_crop15_runtime_config_casia.json`; có sẵn 100K và runtime JSON đi kèm để chuyển profile. Nếu cần ghi đè ngưỡng, đặt `PAD_THRESHOLD_LOGIT` hoặc `PAD_THRESHOLD` trong `.env`; để trống dùng JSON.
- PAD dùng tối thiểu 3 phiếu, cửa sổ 5; recognition 1,0 giây, detection/PAD 0,2 giây. Camera yêu cầu 640×480/30 FPS theo cấu hình chung; giá trị thật phụ thuộc camera/driver.
- ArcFace chạy worker riêng, một thread ONNX; queue 2, không chờ inference trong vòng camera. Lỗi PAD xóa vote và yêu cầu xác minh lại; kết quả cũ bị chặn theo track/mode/phiên xác minh.
- Cache danh tính trên Pi dùng cho hiển thị, không thay thế xác nhận backend. TTL 30 giây, cosine tối thiểu 0,65.
- MQTT watchdog thử lại tối đa 3 lượt; timeout trả trạng thái chưa xác nhận. Event ID giữ ổn định cho retry. Latch chỉ khóa sau publish thành công.
- Đồng bộ mode qua ThingsBoard; HTTP relay trực tiếp chỉ bật khi đặt `BACKEND_BASE_URL`/secret. Không mặc định gọi `TB_HOST:3000`.
- Camera lỗi sẽ báo DEGRADED, sau 100 lần đọc lỗi liên tiếp thoát để service có thể restart. Dùng `--camera` trước khi bật dịch vụ.

TFT chạy worker riêng, không chờ SPI trong vòng camera. Mặc định `TFT_DISPLAY_FPS=10`; đặt `5` nếu muốn giảm tải. Driver giới hạn tối đa 10 FPS. `SHOW_FPS=true` in FPS trung bình vòng camera ở terminal mỗi 10 giây, độc lập FPS cập nhật TFT. Bản worker mới chưa có benchmark FPS trên Pi.

Chỉ bật TFT khi đã nối đúng chân và bật SPI (`sudo raspi-config` → Interface
Options → SPI; khởi động lại nếu được yêu cầu). Đấu chân theo DEPLOYMENT_GUIDE.md.
Chỉ bật HC-SR04 sau khi nối dây; ECHO 5V phải qua phân áp xuống mức 3.3V.

Với bộ USB webcam + ST7789V + HC-SR04 đã chọn, trên Pi chạy:

```bash
sudo raspi-config nonint do_spi 0
sudo reboot
```

Sau khi SSH lại, kiểm tra và khởi động:

```bash
cd ~/pi_edge
ls /dev/spidev0.0
v4l2-ctl --list-devices
.venv/bin/python check_connection.py
.venv/bin/python check_runtime.py --camera
.venv/bin/python edge_client.py
```

Cấu hình local đã đặt `TFT_ENABLED=true`, `ULTRASONIC_ENABLED=true`,
`SHOW_GUI=false`, `CAMERA_INDEX=0`. GPIO dùng đánh số BCM:
TFT DC=25, RESET=24, SCLK=11, MOSI=10, CS=8; HC-SR04 TRIG=23, ECHO=27.
Nếu webcam không phải index 0, sửa `CAMERA_INDEX` trước khi chạy. Khi siêu âm bật,
AI chỉ thức khi đo được người ở khoảng cách 2–50 cm. Nếu chưa nối hoặc cảm biến
không trả khoảng cách, đặt tạm `ULTRASONIC_ENABLED=false` để thử riêng camera/AI.

Kết quả mong đợi của công cụ kiểm tra: đăng nhập MQTT thành công và đọc được
shared attributes. Sau đó chạy camera, kiểm tra heartbeat `fps`, `mode`, `status`
trong Latest telemetry của thiết bị, video tại
`http://<IP_SERVER>:8889/pi4_cam`, rồi thử khuôn mặt đã đăng ký để kiểm tra RPC
và kết quả backend. Đổi mạng cần cập nhật cả `.env.iot` trên server và `.env` trên
Pi, rồi recreate MediaMTX. Thay token trong ThingsBoard cần cập nhật cả Pi/backend.

Tham khảo giao thức: [ThingsBoard MQTT attributes](https://thingsboard.io/docs/reference/mqtt-api/attributes/)
và [Raspberry Pi camera software](https://www.raspberrypi.com/documentation/computers/camera_software.html).
