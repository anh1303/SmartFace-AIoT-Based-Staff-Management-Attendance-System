# Tổng hợp triển khai ThingsBoard, Dashboard và Raspberry Pi Edge

> Sau khi gộp `origin/main` ngày 19/10/2026, source local đã đổi từ `pi_edge/`
> thành `hardware/`. Script cài đặt/kiểm tra đã được chuyển sang `hardware/`;
> đường triển khai trên Pi thật vẫn là `/home/piuser/test/pi_edge`. Các lệnh
> copy source cũ bên dưới dùng tên thư mục tại thời điểm triển khai 15/10.

Cập nhật ngày **15/10/2026**. Tài liệu tổng hợp cấu hình, thao tác và kết quả đã
thực hiện trong phiên triển khai. Dùng tài liệu này làm điểm bắt đầu; các hướng
dẫn chi tiết cũ được liên kết ở cuối. IP và UUID dưới đây thuộc lần cài hiện tại,
cần đối chiếu lại khi đổi mạng hoặc dựng server mới.

## 1. Địa chỉ và trạng thái triển khai

| Thành phần | Địa chỉ / đường dẫn |
| --- | --- |
| Máy Mac chạy Docker | `10.52.138.38`, dự án `/Users/coding/PBL6` |
| Raspberry Pi | SSH `piuser@10.52.138.23` |
| Dự án trên Pi | `/home/piuser/test/pi_edge` |
| Python trên Pi | `/home/piuser/test/pi_edge/.venv/bin/python` |
| Thiết bị ThingsBoard | `PI4_FRONT_GATE` |
| UUID thiết bị hiện tại | `f9f424f0-c872-11f1-b81a-93872484301c` |
| ThingsBoard Web UI | <http://10.52.138.38:8081> |
| MQTT cho Pi | `10.52.138.38:1883` |
| Video RTSP Pi phát lên | `rtsp://10.52.138.38:8554/pi4_cam` |
| Xem video WebRTC | <http://10.52.138.38:8889/pi4_cam/> |
| Web ứng dụng trên Mac | <http://localhost:8080> |
| Backend trên Mac | `http://127.0.0.1:3000` |
| Face Auth API trên Mac | `http://127.0.0.1:5000` |

Dashboard đã tạo:
[SmartFace AIoT Gate Monitor](http://10.52.138.38:8081/dashboards/7c26ed80-c879-11f1-b81a-93872484301c).

Server dùng hai file Compose có chung project `pbl6`:

- `docker-compose.cloud.yml`: backend, frontend, Face Auth và Mosquitto nội bộ;
  giữ cấu hình database cloud hiện có.
- `docker-compose.iot.yml`: ThingsBoard và MediaMTX.

Mosquitto nội bộ là service riêng của ứng dụng. **Pi gửi dữ liệu vào MQTT của
ThingsBoard tại cổng 1883 được publish ra host**, không trỏ sang service Mosquitto.
ThingsBoard dùng database/volumes riêng, không dùng database chấm công của backend.

## 2. Lệnh vận hành nhanh cho hệ thống hiện có

### Trên Mac: khởi động server

Mở Docker Desktop, sau đó:

```bash
cd /Users/coding/PBL6
docker compose -f docker-compose.cloud.yml up -d
docker compose --env-file .env.iot -f docker-compose.iot.yml up -d
docker ps
```

Nếu vừa đổi source backend, build lại riêng backend:

```bash
docker compose -f docker-compose.cloud.yml up -d --build --no-deps backend
```

Nếu chỉ đổi `backend/.env`, `up -d --no-deps backend` tạo lại backend để nhận
cấu hình mới khi Compose phát hiện thay đổi. Không cần chạy migration/seed để
thêm ThingsBoard hoặc dashboard.

Hai file Compose dùng chung project nên có thể báo orphan containers của file
còn lại. **Không thêm `--remove-orphans`** vì sẽ xóa các container đang cần dùng.
Không dùng `down -v` khi muốn giữ dữ liệu ThingsBoard.

### Trên Pi: xem client đang chạy

```bash
ssh piuser@10.52.138.23
cd ~/test/pi_edge
ps -p "$(cat .edge_client.pid)" -o pid,etime,args
tail -f edge_client.log
```

Trong lần triển khai này client được chạy nền bằng `nohup`. `Ctrl+C` trong
`tail -f` chỉ thoát xem log. Kiểm tra PID ở trên đúng là `edge_client.py` trước
khi dừng:

```bash
kill "$(cat .edge_client.pid)"
```

Sau khi client đã dừng, chạy trực tiếp:

```bash
cd ~/test/pi_edge
.venv/bin/python -u edge_client.py
```

Hoặc chạy nền lại, **chỉ khi chưa có client khác đang chạy**:

```bash
cd ~/test/pi_edge
nohup .venv/bin/python -u edge_client.py >> edge_client.log 2>&1 </dev/null &
printf '%s\n' "$!" > .edge_client.pid
```

Chưa cài service tự khởi động sau reboot. Sau khi Pi khởi động lại, cần chạy
client lại. Không mở hai client hoặc chương trình test camera cùng lúc.

## 3. Các file cấu hình cần giữ

### `.env.iot` trên Mac

Đã có file thực tế. Trên server mới, tạo từ `.env.iot.example` nếu chưa có:

```bash
test -f .env.iot || cp .env.iot.example .env.iot
```

```dotenv
IOT_SERVER_HOST=10.52.138.38
TB_WEB_PORT=8081
```

`IOT_SERVER_HOST` là IP LAN server để MediaMTX quảng bá địa chỉ WebRTC.
ThingsBoard dùng cổng 8081 để tránh trùng frontend Docker ở 8080.

### `backend/.env` trên Mac

Giữ nguyên các biến database, JWT, mã hóa và Face Auth đang dùng. Các biến IoT:

```dotenv
TB_HOST=thingsboard
TB_HTTP_PORT=9090
TB_USERNAME=tenant@thingsboard.org
TB_PASSWORD=<mật khẩu tenant thực tế>
TB_DEVICE_TOKEN=<access token của PI4_FRONT_GATE>
TB_DEVICE_UUID=f9f424f0-c872-11f1-b81a-93872484301c
```

`thingsboard:9090` là địa chỉ **bên trong Docker**, khác với địa chỉ Pi truy cập.
Nếu chạy backend trực tiếp trên host thay vì Docker, dùng
`TB_HOST=127.0.0.1`, `TB_HTTP_PORT=8081`.

### `/home/piuser/test/pi_edge/.env` trên Pi

```dotenv
DEVICE_ID=PI4_FRONT_GATE
INITIAL_MODE=CHECK_IN
TB_HOST=10.52.138.38
TB_PORT=1883
TB_TOKEN=<cùng access token của thiết bị ThingsBoard>
STREAM_ENABLED=true
RTSP_URL=rtsp://10.52.138.38:8554/pi4_cam
CAMERA_INDEX=0
CAMERA_WIDTH=640
CAMERA_HEIGHT=480
CAMERA_FPS=15
APP_DETECTOR=scrfd
SHOW_GUI=false
TFT_ENABLED=true
ULTRASONIC_ENABLED=true
ULTRASONIC_TRIG_PIN=23
ULTRASONIC_ECHO_PIN=27
ULTRASONIC_TRIGGER_DISTANCE=50.0
```

Đây là phần cấu hình cần đối chiếu, không phải toàn bộ file `.env`. Giữ lại các
tham số TFT, tracking, PAD và cooldown còn lại trong file hiện có. Không thay
token thật bằng chuỗi placeholder ở tài liệu. Token/mật khẩu nằm trong `.env`
local bị Git bỏ qua; không chép các giá trị đó vào Markdown.

## 4. Thiết lập ThingsBoard lần đầu trên server mới

Hệ thống hiện tại đã xong phần này; chỉ làm lại khi dựng instance mới.

1. Khởi động ThingsBoard/MediaMTX theo mục 2, đợi ThingsBoard tạo database riêng.
2. Mở Web UI cổng 8081. Bản cài mới đang dùng tài khoản tenant mặc định
   `tenant@thingsboard.org` / `tenant`; nếu đã đổi mật khẩu, dùng mật khẩu thực tế.
3. Vào Devices, tạo `PI4_FRONT_GATE`, profile `default`, Credentials loại Access
   token. Lấy token tại Credentials của thiết bị, không dùng token trong mẫu cũ.
4. Copy device ID của instance mới vào `TB_DEVICE_UUID` ở backend. UUID không
   phải tên `PI4_FRONT_GATE`; không giữ UUID cũ khi tạo thiết bị mới.
5. Điền cùng token vào `TB_TOKEN` trên Pi và `TB_DEVICE_TOKEN` ở backend.
6. Trong Shared attributes của device, tạo chuỗi `attendance_mode=CHECK_IN`.
7. Tạo nhánh Root Rule Chain ở mục 5, rồi recreate backend để nạp cấu hình.

Để xem log khởi tạo:

```bash
docker compose --env-file .env.iot -f docker-compose.iot.yml logs --tail=100 thingsboard
```

## 5. Rule Chain và các luồng dữ liệu

### Điểm danh bằng client-side two-way RPC

```text
USB webcam → SCRFD → Tracking → MiniFASNet R7 → ArcFace vector 512D
  → MQTT v1/devices/me/rpc/request/{id}
  → Message Type Switch / RPC Request from Device
  → REST API Call → Success → RPC Call Reply
  → MQTT v1/devices/me/rpc/response/{id} → kết quả hiển thị trên Pi
```

REST API Call dùng:

- Method: `POST`.
- URL: `http://backend:3000/api/attendance/tb-webhook`.
- Header: `Content-Type: application/json`.
- Body giữ gói `{method: "verify_face", params: {...}}` từ Pi.
- Giữ metadata `serviceId`, `sessionId`, `requestId` để RPC Call Reply trả đúng phiên.

Backend giải mã `embedding_b64` thành vector 512 float32, kiểm tra đầu vào/PAD,
so khớp pgvector và xử lý nghiệp vụ điểm danh. Đường `backend:3000` chỉ dùng khi
ThingsBoard/backend ở cùng mạng Docker `pbl6`. Nếu backend chạy trực tiếp trên
Mac, URL thay thế là `http://host.docker.internal:3000/api/attendance/tb-webhook`;
cần kiểm tra địa chỉ đó truy cập được từ container.

### Telemetry vận hành và điểm liveness cho dashboard

Pi gửi `fps`, `distance`, `person_present`, `ai_state`, `attendance_latch`,
`current_mode`, `mode`, `status` qua `v1/devices/me/telemetry`.

Nhánh dashboard được thêm song song với nhánh RPC đối soát:

```text
Message Type Switch / RPC Request from Device
  → SmartFace Has Liveness Score
  → True → SmartFace Score Only
  → Success → Save Timeseries
```

Filter TBEL:

```javascript
return msg.method == 'verify_face' && msg.params != null && msg.params.antispoof_score != null;
```

Transformation TBEL chỉ xuất điểm:

```javascript
return {
  msg: {antispoof_score: msg.params.antispoof_score},
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
```

Không nối nguyên gói RPC chứa `embedding`/`embedding_b64` vào Save Timeseries.
Biểu đồ liveness chỉ có điểm khi Pi gửi lượt RPC; không phải dữ liệu PAD của mọi
frame và không thể dùng biểu đồ này để đếm tất cả lần phát hiện spoof.

### Điều khiển chế độ và video

- Dashboard gọi RPC `getValue`/`setValue` tới Pi. `true` là CHECK_IN, `false` là
  CHECK_OUT. Client cập nhật chế độ và telemetry.
- Web ứng dụng cập nhật ThingsBoard shared attribute `attendance_mode` qua
  Tenant REST API; Pi nhận qua MQTT.
- Pi nén H.264 bằng FFmpeg, phát RTSP về MediaMTX; trình duyệt xem qua WebRTC.
- Client còn có HTTP `mode-notify` tới `http://TB_HOST:3000`. Log bài chạy thử có
  lần gọi thành công, nhưng cấu hình Docker hiện tại chỉ publish backend trên
  localhost. Không dùng lần thành công đó làm đảm bảo đường Pi → HTTP backend
  luôn truy cập được; cần thử riêng nếu yêu cầu đồng bộ switch dashboard về web.

## 6. Dashboard từ hai file JSON

File nguồn được giữ nguyên:

- [smartface_dashboard.json](../../../smartface_dashboard.json): bố cục và widget mẫu.
- [smartface_root_rule_chain.json](../../../smartface_root_rule_chain.json): Rule Chain tham chiếu.

Đã tạo **SmartFace AIoT Gate Monitor** với 5 widget:

| Widget | Dữ liệu / điều khiển |
| --- | --- |
| Đồng hồ FPS | `fps` |
| Biểu đồ liveness | `antispoof_score` theo từng lượt RPC |
| Trạng thái cổng | `status`, `current_mode`, `fps` |
| Công tắc chế độ | RPC `getValue` / `setValue` |
| HC-SR04 | `distance`, `ai_state`, `attendance_latch`, `person_present` |

Thay đổi khi triển khai: gắn alias/target vào UUID Pi hiện tại, sửa placeholder
HTML theo widget đang cài, lấy `status` từ telemetry thay vì ghi cố định ONLINE,
đọc trạng thái switch bằng RPC và thêm nhánh chỉ lưu điểm liveness.

Script cập nhật dashboard cùng tên và xuất backup:

```bash
cd /Users/coding/PBL6
python3 scripts/deploy_thingsboard_dashboard.py
```

Script cần Python có `python-dotenv`, đọc tài khoản từ `backend/.env` và gọi
ThingsBoard tại `http://127.0.0.1:8081`. Nếu môi trường host thiếu thư viện, có thể
tạo venv tại gốc dự án rồi chạy bằng Python của venv:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install python-dotenv
.venv/bin/python scripts/deploy_thingsboard_dashboard.py
```

Script **không tự tạo device hoặc nhánh webhook ban đầu**: instance mới phải
xong mục 4–5 trước. Script giữ nhánh RPC hiện có, bổ sung nhánh score nếu chưa có.
Không import thẳng file mẫu với UUID/URL server cũ lên instance mới.

Export/backup ở [tài nguyên ThingsBoard](DASHBOARD_EXPORTS.md):

- `smartface_dashboard.deployed.json`.
- `smartface_root_rule_chain.deployed.json`.
- `root_rule_chain_before_*.json`, và `dashboard_before_*.json` nếu cập nhật lại
  dashboard đã tồn tại.

## 7. Chuẩn bị Pi và ngoại vi

Pi thực tế đã có Debian 13 ARM64, Python 3.13.5, `.venv`, FFmpeg và các thư viện
cần thiết. Đã dùng môi trường này, không cài lại `tflite-env` của người dùng.

Nếu dựng Pi mới, tạo thư mục đích rồi copy từ Mac:

```bash
ssh piuser@10.52.138.23 'mkdir -p ~/test'
scp -r pi_edge piuser@10.52.138.23:~/test/
```

Đây là lệnh cho đích mới. Nếu Pi đã có source hoặc `.env` riêng, sao lưu/đối
chiếu trước khi copy đè. Môi trường Python từ Mac không dùng thay cho venv ARM64;
Pi mới phải tạo môi trường trên Pi.

Trên Pi mới:

```bash
cd ~/test/pi_edge
bash setup_pi.sh
.venv/bin/python configure.py
sudo raspi-config nonint do_spi 0
sudo reboot
```

`setup_pi.sh` yêu cầu Linux ARM64, cài `python3-venv`, `python3-dev`, công cụ
biên dịch, FFmpeg, v4l-utils rồi cài requirements vào `.venv`. SCRFD cần
`insightface`; quá trình cài có thể biên dịch trên ARM64. Script giữ `.env` đã có.

### Nối ST7789V (BCM)

| TFT | GPIO / chân vật lý Pi |
| --- | --- |
| VCC | 3.3V, chân 1 hoặc 17 |
| GND | GND |
| SCK/SCL | GPIO11, chân 23 |
| MOSI/SDA | GPIO10, chân 19 |
| CS | GPIO8/CE0, chân 24 |
| DC | GPIO25, chân 22 |
| RESET | GPIO24, chân 18 |
| BL | 3.3V |

### Nối HC-SR04 (BCM)

| HC-SR04 | GPIO / chân vật lý Pi |
| --- | --- |
| VCC | 5V, chân 2 hoặc 4 |
| GND | GND |
| TRIG | GPIO23, chân 16 |
| ECHO | GPIO27, chân 13, qua phân áp xuống 3.3V |

Không nối ECHO 5V trực tiếp vào GPIO. Khi siêu âm bật, khoảng cách 2–50 cm đánh
thức AI; ở xa hơn AI có thể ở SLEEP. Nếu chưa nối siêu âm, đặt
`ULTRASONIC_ENABLED=false` để thử riêng camera/AI.

## 8. Kiểm tra theo từng lớp

Dừng client đang chạy trước khi dùng công cụ test có mở camera.

```bash
cd ~/test/pi_edge
ls /dev/spidev0.0
v4l2-ctl --list-devices
.venv/bin/python check_connection.py
.venv/bin/python check_runtime.py --camera
```

- `check_connection.py`: đăng nhập MQTT và đọc shared attributes; không kiểm tra
  toàn bộ webhook, không gửi vector hoặc tạo điểm danh.
- `check_runtime.py`: nạp/chạy detector, PAD và ArcFace trên ảnh tổng hợp; kiểm
  tra vector 512D hữu hạn, FFmpeg; `--camera` đọc một frame camera. Không khởi tạo
  TFT/siêu âm hay gửi MQTT. SCRFD fallback YuNet sẽ được báo lỗi để phát hiện rõ.
- `edge_client.py`: mới chạy toàn bộ camera, AI, ngoại vi, MQTT và RTSP.

Trên server:

```bash
cd /Users/coding/PBL6
docker logs --tail=80 pbl6-backend-1
docker compose --env-file .env.iot -f docker-compose.iot.yml logs --tail=80 thingsboard mediamtx
curl -fsS http://127.0.0.1:3000/health
```

Trong ThingsBoard: Devices → PI4_FRONT_GATE → Latest telemetry. Kiểm tra timestamp
của dữ liệu; `status=ONLINE` là giá trị Pi đã gửi, không tự chứng minh dữ liệu vẫn
đang cập nhật. Trong MediaMTX, log `is publishing to path 'pi4_cam'` xác nhận đã có
publisher; kiểm tra thêm video trên trình duyệt để xác nhận phần xem.

## 9. Những gì đã làm và bằng chứng

| Công việc | Kết quả của phiên triển khai |
| --- | --- |
| Khởi động ThingsBoard/MediaMTX | Đã chạy container và kiểm tra dịch vụ |
| Tránh trùng cổng frontend | ThingsBoard chuyển sang 8081; frontend vẫn 8080 |
| Kết nối Docker | Cùng project `pbl6`; webhook dùng DNS `backend:3000` |
| Tạo device/shared mode | PI4_FRONT_GATE, `attendance_mode=CHECK_IN` |
| Đồng bộ credentials | Token/UUID lưu trong `.env` Pi và backend |
| Sửa lỗi backend image cũ | Build lại backend vì image trước chưa chứa route webhook, gây 401 |
| RPC toàn tuyến | Gói giả lập `antispoof_score=0` trả Anti-spoofing rejected trước so khớp/ghi điểm danh |
| SSH Pi | Sửa đích từ IP cũ không truy cập được sang `10.52.138.23` |
| Công cụ trên Pi | Khôi phục check_connection.py bị chép nhầm; có file `.before-deploy` |
| Model/camera trên Pi | Chạy model ảnh tổng hợp; webcam đọc 640×480 |
| Ngoại vi Pi | TFT khởi tạo SPI 32 MHz; HC-SR04 có mẫu đo 98.9 cm |
| Telemetry/video Pi thật | ThingsBoard nhận dữ liệu; MediaMTX nhận H.264 |
| Chạy nền | `nohup`, log nối tiếp, PID file; chưa có autostart |
| Dashboard | Tạo 5 widget, đọc lại alias/layout qua API; RPC getValue trả true từ Pi |
| Script score | API testScript TBEL xác nhận filter và output chỉ có score, giữ metadata; không ghi dữ liệu test vào telemetry |

Các mẫu FPS/khoảng cách là quan sát vận hành, không phải benchmark. Chưa xác
minh điểm danh khuôn mặt thật, độ chính xác PAD/nhận diện, màu/hình TFT bằng mắt,
hoặc render dashboard trong trình duyệt của phiên này.

## 10. Lỗi đã gặp và cách xử lý

| Hiện tượng | Kiểm tra / xử lý |
| --- | --- |
| SSH timeout / Host is down | Trên Pi chạy `hostname -I`; dùng IP LAN hiện tại; bật `sudo systemctl enable --now ssh` |
| MQTT timeout / đăng nhập lỗi | IP server, TCP1883, firewall, token đúng device; chạy check_connection.py |
| Webhook trả 401 dù source có route | Đối chiếu image đang chạy; build/recreate riêng backend |
| Không thấy biểu đồ liveness | Cần lượt RPC mới sau khi thêm nhánh score; không bơm dữ liệu giả để lấp biểu đồ |
| AI luôn SLEEP | Xem distance; kiểm tra HC-SR04 và ngưỡng 50 cm; tắt siêu âm tạm để cô lập lỗi |
| Camera mở lỗi hoặc không có frame | Dừng client khác, xem v4l2-ctl, kiểm tra CAMERA_INDEX; test --camera |
| Không có /dev/spidev0.0 | Bật SPI, khởi động lại, kiểm tra quyền nhóm spi/gpio |
| Không thấy video | Client/FFmpeg, RTSP8554, log MediaMTX; WebRTC8889 và UDP8189 |
| Bị khóa ở ĐANG ĐỐI SOÁT | Xem Rule Chain/backend; client chưa có timeout riêng mở chốt nếu mất reply; rời khung hình/đổi track để reset lượt |
| Đổi mạng | Cập nhật TB_HOST/RTSP_URL trên Pi và IOT_SERVER_HOST trên server; recreate MediaMTX; lấy lại IP SSH Pi |

## 11. Tài liệu và file liên quan

- [DEPLOYMENT_GUIDE.md](../deployment/DEPLOYMENT_GUIDE.md): hướng dẫn tổng thể ban đầu; các token,
  IP/cổng ví dụ cũ phải được thay bằng cấu hình trong tài liệu này.
- [pi_edge/RUN_ON_PI.md](../../../hardware/RUN_ON_PI.md): chi tiết các công cụ Pi và lưu ý runtime.
- [Dashboard exports](DASHBOARD_EXPORTS.md): dashboard, export, backup.
- [Chạy stack cloud](../deployment/run_cloud_stack.md): database cloud và stack ứng dụng.
- [DATA_FLOWS.md](../../architecture/DATA_FLOWS.md): kiến trúc và cấu trúc gói tin.
- [pi_edge/ULTRASONIC_EDGE_PLAN.md](../../../hardware/ULTRASONIC_EDGE_PLAN.md): thiết kế wake-on-presence.
- [scripts/deploy_thingsboard_dashboard.py](../../../scripts/deploy_thingsboard_dashboard.py): cập nhật widget/nhánh score.
- [pi_edge/setup_pi.sh](../../../hardware/setup_pi.sh), [configure.py](../../../hardware/configure.py),
  [check_connection.py](../../../hardware/check_connection.py), [check_runtime.py](../../../hardware/check_runtime.py),
  [edge_client.py](../../../hardware/edge_client.py): bộ cài, cấu hình, kiểm tra và entrypoint.
