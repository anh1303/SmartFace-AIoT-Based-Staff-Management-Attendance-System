# HƯỚNG DẪN TRIỂN KHAI SMARTFACE TRÊN RASPBERRY PI 4 (HARDWARE)

> Hướng dẫn cấu hình hiện tại: [RUN_ON_PI.md](RUN_ON_PI.md), gồm bộ cài
> `setup_pi.sh`, `configure.py`, `check_connection.py` và ThingsBoard cổng 8081.

> Thử nghiệm chuyển ArcFace lên server: [SERVER_ARCFACE_OFFLOAD.md](../docs/architecture/SERVER_ARCFACE_OFFLOAD.md). Mặc định vẫn nhận diện cục bộ.

Thư mục `hardware/` (trước đây là `pi_edge/`) này là bản đóng gói độc lập, siêu nhẹ (chỉ gồm runtime và model triển khai, không kèm dữ liệu huấn luyện).
* **Đầy đủ cấu trúc Pipeline AIoT:**
  1. `detection/`   : Bộ dò khuôn mặt (SCRFD ONNX hoặc YuNet INT8 ONNX).
  2. `tracking/`    : **FaceTracker** (IOU association + Lucas-Kanade Optical Flow Cadence).
  3. `antispoof/`   : **MiniFASNet R7 FULL/100K** (mỗi ONNX khoảng 1.7 MB, chọn theo runtime JSON).
  4. `alignment/`   : ArcFace 5-point landmark affine transformation (112x112).
  5. `recognition/` : **ArcFace MobileFaceNet** (ONNX 13 MB, trích xuất vector 512D chuẩn L2).
  6. `iot/`         : **ThingsBoardClient** (MQTT v1/devices/me/telemetry + 2-way Shared Attributes).
  7. `streaming/`   : **RTSPStreamer** (FFmpeg H.264 pipe -> MediaMTX).
* SCRFD mặc định cần InsightFace và có thể cần biên dịch trên ARM64. Runtime dùng ONNX Runtime và OpenCV Headless; thời gian cài đặt phụ thuộc thiết bị/mạng.

---

## 1. Copy thư mục `hardware` sang Raspberry Pi 4
Dùng lệnh SCP từ máy tính (hoặc copy qua USB drive):
```bash
scp -r hardware pi@<IP_CỦA_PI>:~/
```

---

## 2. Cài đặt môi trường trên Raspberry Pi 4
Mở Terminal trên Pi và chạy các lệnh:

```bash
# 1. Cài đặt FFmpeg để nén video H.264
sudo apt update
sudo apt install -y ffmpeg

# 2. Di chuyển vào thư mục hardware
cd ~/hardware

# 3. Tạo môi trường ảo Python
python3 -m venv venv
source venv/bin/activate

# 4. Cài đặt các thư viện cần thiết
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Cấu hình file `.env`
Mở file `.env` bằng lệnh `nano .env` và kiểm tra các thông số quan trọng:
* `APP_DETECTOR=scrfd` : Mô hình phát hiện mặt (`scrfd` hoặc `yunnet`)
  - `scrfd`  : Model SCRFD (`det_500m.onnx` ~2.5 MB), độ chính xác cao, bắt góc nghiêng tốt (đang đặt mặc định).
  - `yunnet` : Model YuNet INT8 (`detector_quantized.onnx` ~120 KB), siêu nhẹ, chạy nhanh nhất trên Pi.
* `DETECTION_INTERVAL_SECONDS=0.2`: chu kỳ detector; Optical Flow bám mặt giữa các lần detect.
* `PAD_INTERVAL_SECONDS=0.2`: chu kỳ inference PAD cho mỗi track.
* `RECOGNIZE_INTERVAL_SECONDS=1.0`: khoảng cách tối thiểu giữa các lần nhận diện khi track đủ điều kiện; latch/cooldown vẫn kiểm soát việc gửi điểm danh.
* `MAX_FACES_PER_FRAME=1` : Giới hạn số lượng khuôn mặt lớn nhất được track/xử lý trên 1 frame (mặc định: `1` cho cổng điểm danh ưu tiên người đứng gần nhất; đặt `0` nếu không muốn giới hạn).
* `PAD_MIN_VOTES=3`, `PAD_SMOOTH_WINDOW=5`: tích lũy ít nhất 3 phiếu; cửa sổ giữ tối đa 5 phiếu mới nhất. `PAD_SPOOF_MIN_RATIO=0.6` quyết định verdict SPOOF; đây không phải yêu cầu 3 REAL liên tiếp.
* `SCAN_COOLDOWN_SECONDS=5.0` : Thời gian chờ trước khi cho phép quét lại cùng một người (Track ID).
* `TB_HOST=<IP_LAN_CỦA_MÁY_SERVER>` (Ví dụ: `10.52.138.36`)
* `RTSP_URL=rtsp://<IP_LAN_CỦA_MÁY_SERVER>:8554/pi4_cam`
* `TB_TOKEN=<DEVICE_ACCESS_TOKEN>` (lấy từ Credentials của thiết bị PI4_FRONT_GATE)
* `TFT_ENABLED=true` : Bật xuất hình ảnh trực tiếp lên màn hình LCD TFT ST7789V qua SPI (GPIO 25: DC, GPIO 24: RST).

---

## 4. Sơ đồ nối chân phần cứng toàn bộ thiết bị trên Raspberry Pi 4

### 4.1. Bảng sơ đồ trực quan Header 40-pin Raspberry Pi 4
Dưới đây là sơ đồ gán chân vật lý thực tế trên bo mạch Raspberry Pi 4 cho toàn bộ các thiết bị ngoại vi (Màn hình LCD TFT ST7789V, Cảm biến Siêu âm #1 Check-in, Cảm biến Siêu âm #2 Check-out):

```text
                                Raspberry Pi 4 GPIO Header (40-Pin)
                                     +--------------------+
[TFT VCC]            3.3V Power  (01) | o  o | (02)  5V Power          [VCC Siêu âm #1]
                     GPIO 2      (03) | o  o | (04)  5V Power          [VCC Siêu âm #2]
                     GPIO 3      (05) | o  o | (06)  Ground            [GND Siêu âm #1]
                     GPIO 4      (07) | o  o | (08)  GPIO 14 (TXD)
                     Ground      (09) | o  o | (10)  GPIO 15 (RXD)
[TRIG Siêu âm #2]    GPIO 17     (11) | o  o | (12)  GPIO 18
[ECHO Siêu âm #1]    GPIO 27     (13) | o  o | (14)  Ground            [GND Siêu âm #2]
[ECHO Siêu âm #2]    GPIO 22     (15) | o  o | (16)  GPIO 23           [TRIG Siêu âm #1]
[TFT BLK Đèn nền]    3.3V Power  (17) | o  o | (18)  GPIO 24           [TFT RESET / RST]
[TFT MOSI / SDA]     GPIO 10     (19) | o  o | (20)  Ground            [TFT GND]
                     GPIO 9      (21) | o  o | (22)  GPIO 25           [TFT DC]
[TFT SCLK / SCL]     GPIO 11     (23) | o  o | (24)  GPIO 8 (CE0)      [TFT CS]
                     Ground      (25) | o  o | (26)  GPIO 7 (CE1)
                     GPIO 0      (27) | o  o | (28)  GPIO 1
                     GPIO 5      (29) | o  o | (30)  Ground
                     GPIO 6      (31) | o  o | (32)  GPIO 12
                     GPIO 13     (33) | o  o | (34)  Ground
                     GPIO 19     (35) | o  o | (36)  GPIO 16
                     GPIO 26     (37) | o  o | (38)  GPIO 20
                     Ground      (39) | o  o | (40)  GPIO 21
                                     +--------------------+
```

---

### 4.2. Bảng tổng hợp chân cắm toàn bộ thiết bị (Master Pinout Table)

| Thiết bị ngoại vi | Chân trên Module | Chân vật lý Pi 4 | Số hiệu BCM GPIO | Điện áp / Chức năng | Ghi chú & Cấu hình |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Màn hình LCD TFT (ST7789V SPI)** | **VCC** | **Chân 1** | — | 3.3V Power | Nguồn cấp cho màn hình |
| | **GND** | **Chân 20** | — | Ground | Nối đất màn hình |
| | **SCL / SCK** | **Chân 23** | **GPIO 11** | SPI0 SCLK | Xung nhịp đồng hồ SPI phần cứng |
| | **SDA / MOSI** | **Chân 19** | **GPIO 10** | SPI0 MOSI | Dữ liệu hình ảnh từ Pi sang màn |
| | **RES / RST** | **Chân 18** | **GPIO 24** | Output (Reset) | Khởi động lại phần cứng màn hình (`TFT_RESET_PIN=24`) |
| | **DC** | **Chân 22** | **GPIO 25** | Output (Data/Cmd) | Phân biệt lệnh và dữ liệu hình ảnh (`TFT_DC_PIN=25`) |
| | **CS** | **Chân 24** | **GPIO 8** | SPI0 CE0 | Chọn chip SPI (Chip Select 0) |
| | **BLK / BL** | **Chân 17** | — | 3.3V Power | Cấp nguồn liên tục cho đèn nền LED màn hình |
| **Cảm biến Siêu âm #1 (CHECK_IN — Vào ca)** | **VCC** | **Chân 2** | — | 5V Power | Nguồn nuôi HC-SR04 (hoặc 3.3V nếu dùng HC-SR04P) |
| | **TRIG** | **Chân 16** | **GPIO 23** | Output (Trigger) | Cố định trong code: phát xung kích hoạt siêu âm 10µs |
| | **ECHO** | **Chân 13** | **GPIO 27** | Input (Echo) | Cố định trong code: nhận xung phản xạ (qua cầu phân áp 3.3V) |
| | **GND** | **Chân 6** | — | Ground | Nối đất chung |
| **Cảm biến Siêu âm #2 (CHECK_OUT — Ra ca)** | **VCC** | **Chân 4** | — | 5V Power | Nguồn nuôi HC-SR04 (hoặc 3.3V nếu dùng HC-SR04P) |
| | **TRIG** | **Chân 11** | **GPIO 17** | Output (Trigger) | Cố định trong code: phát xung kích hoạt siêu âm 10µs |
| | **ECHO** | **Chân 15** | **GPIO 22** | Input (Echo) | Cố định trong code: nhận xung phản xạ (qua cầu phân áp 3.3V) |
| | **GND** | **Chân 14** | — | Ground | Nối đất chung |
| **Camera (Nhận diện)** | **Cáp Ribbon CSI** | **Cổng CSI** | — | Giao tiếp MIPI CSI-2 | Cắm cáp ribbon vào khe CAMERA trên Pi 4 |
| | *hoặc USB* | **Cổng USB 3.0/2.0**| — | USB Video Class (UVC) | Cắm trực tiếp webcam vào cổng USB |
| **Tai nghe / Loa (Phát âm thanh)** | **Bluetooth A2DP** | **Onboard Bluetooth**| — | Kết nối không dây BlueZ | Tự động ghép đôi và phát âm thanh qua PipeWire (`pw-play`) |
| | *hoặc Loa 3.5mm* | **Cổng Jack 3.5mm** | — | Analog Stereo Audio | Cắm trực tiếp jack loa 3.5mm vào cổng audio trên bo mạch |

---

### 4.3. Lưu ý kỹ thuật khi đấu dây:

1. **Cầu phân áp điện trở cho chân ECHO cảm biến HC-SR04 5V:**
   - Chân GPIO của Raspberry Pi 4 chỉ chịu được tối đa điện áp **3.3V**.
   - Nếu bạn dùng cảm biến **HC-SR04 (bản chạy 5V)**, chân ECHO phát ra xung 5V. Để bảo vệ an toàn cho Raspberry Pi, **bắt buộc** nối chân ECHO qua cầu phân áp:
     ```text
     Chân ECHO cảm biến -----> [ Điện trở R1 = 1kΩ ] ----+-----> Chân GPIO Pi 4 (GPIO 27 hoặc GPIO 22)
                                                         |
                                                [ Điện trở R2 = 2kΩ ]
                                                         |
                                                        GND (Đất chung)
     ```
   - *Nếu bạn dùng cảm biến **HC-SR04P** hoặc **RCWL-1601** (hỗ trợ cấp nguồn 3.3V)*: Có thể cắm trực tiếp chân ECHO vào GPIO Pi 4 mà không cần thêm điện trở.

2. **Cơ chế lọc trễ chống rung 2 chiều (Debounce 0.5s):**
   - Cả 2 cảm biến siêu âm hoạt động với chu kỳ đo 12.5Hz trong luồng ngầm.
   - **Khi đưa tay vào ($\le 20\text{cm}$):** Phải giữ tay cố định liên tục ít nhất **$0.5\text{s}$** (`ULTRASONIC_DEBOUNCE_SECONDS=0.5`) thì chế độ tương ứng (`CHECK_IN` hoặc `CHECK_OUT`) mới kích hoạt.
   - **Khi rút tay ra ($> 20\text{cm}$):** Phải rút tay ra hoàn toàn liên tục ít nhất **$0.5\text{s}$** thì chế độ mới chuyển về tắt (`OFF`).

3. **Nối đất chung (Common Ground):**
   - Tất cả các chân GND của màn hình TFT LCD và 2 cảm biến siêu âm phải được nối chung về hệ thống chân GND của Raspberry Pi 4 để đảm bảo điện thế tham chiếu đồng nhất.

---

## 5. Khởi chạy hệ thống
```bash
python edge_client.py
```

* **Trạng thái hoạt động:**
  - Kết nối MQTT lên ThingsBoard $\rightarrow$ báo `[MQTT] [OK] Đã kết nối thành công`.
  - Mở camera đọc từng frame $\rightarrow$ Detection Cadence (Detector + Optical Flow).
  - Gom vote Anti-Spoofing theo từng khuôn mặt $\rightarrow$ tích lũy ít nhất 3 phiếu trong cửa sổ 5 $\rightarrow$ Căn chỉnh khuôn mặt $\rightarrow$ Đưa crop vào queue $\rightarrow$ Worker riêng trích xuất vector 512D ArcFace.
  - Vector 512D Base64 được gửi qua client-side RPC `v1/devices/me/rpc/request/{id}`.
  - ThingsBoard Rule Chain kiểm tra và đẩy qua webhook backend để so khớp sinh trắc học `pgvector`.
  - Xuất trực tiếp hình ảnh có vẽ khung nhận diện + nhãn Real/Spoof + banner điểm danh lên màn hình **TFT ST7789V**!
  - Video stream song song được nén H.264 đẩy về máy chủ qua RTSP port 8554.

## Phân luồng recognition

Vòng camera chạy detect/tracking/PAD và căn chỉnh crop; ArcFace chạy trên một worker riêng (`recognition/worker.py`). Queue giới hạn hai job chờ, tối đa ba job chưa thu kết quả (kể cả job đã hủy). Camera không chờ embedding hoặc phản hồi RPC. Kết quả được kiểm tra lại track, mode và phiên hiện diện trước khi gửi backend; mất PAD/track sẽ hủy job cũ. Nhãn khuôn mặt chỉ hiển thị `REAL - UNKNOWN`/tên hoặc ID đã xác nhận, `SPOOF`, `CHECKING`, `INVALID`. Giữ chế độ check-in/out và kết quả điểm danh; FPS được log ở terminal mỗi 10 giây qua `SHOW_FPS=true`.

Backend vẫn chịu trách nhiệm đối sánh danh tính/ghi điểm danh. Interval giữ recognition 1,0 giây, detection/PAD 0,2 giây. Detect/PAD và camera vẫn dùng vòng camera; TFT có worker riêng cho resize/chuyển màu/truyền SPI. Chưa đo FPS trực tiếp trên Pi cho bản TFT worker mới.

## TFT worker và giới hạn cập nhật

`TFT_DISPLAY_FPS=10` là mặc định trong `.env.example`; đặt `5` để giảm tải thêm. Driver chặn tối đa 10 FPS, kể cả `.env` cũ còn đặt 15. Chỉ một worker TFT, một frame đang gửi và tối đa một frame chờ; frame mới thay frame chờ cũ. Những frame chưa đến lượt cập nhật không bị copy/chuyển màu cho TFT. Khi chỉ TFT xuất video, vòng camera cũng bỏ copy/vẽ overlay ở frame TFT sẽ bỏ qua. GUI/stream hoạt động vẫn nhận overlay bình thường.

Worker tự resize/chuyển màu/đóng gói RGB565/truyền SPI. Camera chỉ giao snapshot riêng, không chờ SPI. Khi tắt, chờ worker tối đa một giây; nếu driver SPI chưa trả về, worker daemon giữ quyền sở hữu rồi tự cleanup khi ghi xong, tránh đóng SPI trong lúc ghi. Lỗi render/SPI sẽ tắt đầu ra TFT và báo terminal một lần; AI/điểm danh vẫn tiếp tục.

Test offline: `python3 -m unittest discover -s hardware/validation -v`. Các test dùng màn hình giả/SPI giả, không chứng minh FPS hay chất lượng hiển thị trên Pi. Không đổi model, profile PAD, tần suất nhận diện hoặc điều kiện điểm danh.

## Chọn model PAD đồng bộ với face_auth

Cả `.env` và `.env.example` mặc định:

```dotenv
PAD_RUNTIME_CONFIG_PATH=models/R7_SC_FULL_crop15_runtime_config_casia.json
PAD_MIN_VOTES=3
PAD_SMOOTH_WINDOW=5
RECOGNITION_QUEUE_SIZE=2
RECOGNITION_INTRA_OP_THREADS=1
RECOGNITION_CACHE_TTL_SECONDS=30
RECOGNITION_CACHE_THRESHOLD=0.65
```

Để dùng 100K, thay duy nhất dòng đường dẫn bằng `PAD_RUNTIME_CONFIG_PATH=models/R7_SC_100K_crop15_runtime_config_casia.json`, rồi restart tiến trình. Cả ONNX FULL/100K và các JSON gốc/CASIA đã có trong `models/`; JSON quyết định hash model, ngưỡng mặc định, crop, màu, gamma và chuẩn hóa; threshold thủ công trong `.env` được ưu tiên. FULL dùng logit 1,6586914; 100K CASIA dùng −4,2998047. Không tái sử dụng ngưỡng giữa hai model. `FAS_LOGIT_THRESHOLD` và `CONSECUTIVE_REAL_FRAMES` đã được thay bằng runtime JSON và `PAD_MIN_VOTES`.

Hardware dùng cùng kiểm tra chất lượng mặt và cập nhật PAD nguyên tử với `face_auth`: lỗi crop/inference, NaN hoặc hình học không hợp lệ xóa vote cũ và tăng `verification_generation`. Phiên xác minh này được kiểm tra cả khi nhận embedding và phản hồi RPC. Tất cả inference dùng ảnh sạch; bbox/chữ chỉ vẽ lên bản sao để hiển thị.

Cache hardware chỉ lưu tên đã được backend xác nhận và embedding tham chiếu của lượt quét cho cùng track/phiên/mode. TTL cố định 30 giây, cosine tối thiểu 0,65; hit không gia hạn, reset phiên hoặc cloud không khớp sẽ xóa. Cache phục vụ hiển thị, mọi lần gửi điểm danh vẫn phải được backend xác minh. `face_auth` có centroid từ DB nên cache có thể bỏ truy vấn DB; RPC hiện tại không trả centroid nên hardware không giả lập quyền xác nhận đó. Danh sách nhân viên, ngưỡng/mẫu truy vấn backend, latch cổng và cơ chế ghi điểm danh không thuộc việc đồng bộ CV này.

### Ghi đè threshold PAD

Đặt một trong hai biến trong `.env`:

```dotenv
# Ví dụ so trực tiếp hai logits (d >= 0); chỉ là ví dụ, không tự đặt làm mặc định.
PAD_THRESHOLD_LOGIT=0
PAD_THRESHOLD=
```

Hoặc đặt `PAD_THRESHOLD` trong khoảng (0,1); code tự tính logit tương ứng. Để cả hai trống sẽ dùng ngưỡng trong runtime JSON. Nếu đặt cả hai, xác suất phải bằng sigmoid(logit), sai khác sẽ báo lỗi. NaN/Infinity/giá trị không phải số cũng báo lỗi. Restart tiến trình sau khi sửa `.env`. Biến môi trường đã export vào tiến trình vẫn ưu tiên hơn file `.env` theo python-dotenv; CLI threshold của face_auth vẫn được áp dụng sau cấu hình.

## Số lần nhận diện trước khi ghi điểm danh

`ATTENDANCE_STABLE_COUNT=3` áp dụng cho cả CHECK_IN/CHECK_OUT. Hai lượt đầu chỉ xác minh qua RPC, lượt thứ ba khớp cùng employee mới ghi công. Mỗi recognition có ID riêng, retry không được tính thêm lần; event ID và timestamp capture của lượt điểm danh giữ nguyên. Đổi track/PAD/mode hoặc không khớp sẽ yêu cầu xác nhận lại. Con số này không phải thời gian giây và không phải `RECOGNITION_LABEL_CONFIRMATIONS` của UI.

Cần triển khai backend hỗ trợ VERIFY_ONLY/CONFIRMED_SCAN trước khi chạy hardware mới; không thể dùng client/server khác phiên bản để điểm danh. Face_auth chỉ hiển thị sẵn sàng sau cùng mốc 3, không trực tiếp ghi attendance_logs.
