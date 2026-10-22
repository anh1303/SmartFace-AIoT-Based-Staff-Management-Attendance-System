# HƯỚNG DẪN TRIỂN KHAI SMARTFACE TRÊN RASPBERRY PI 4 (HARDWARE)

> Hướng dẫn cấu hình hiện tại: [RUN_ON_PI.md](RUN_ON_PI.md), gồm bộ cài
> `setup_pi.sh`, `configure.py`, `check_connection.py` và ThingsBoard cổng 8081.

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

## 4. Sơ đồ nối chân Màn hình TFT ST7789V SPI trên Raspberry Pi 4
| Chân màn hình TFT | Chân Raspberry Pi 4 (Header 40-pin) |
| :--- | :--- |
| **VCC** | Chân 1 hoặc 17 (3.3V Power) |
| **GND** | Chân 6, 9, 14, 20 hoặc 25 (Ground) |
| **SCL / SCK** | Chân 23 (GPIO 11 - SPI0 SCLK) |
| **SDA / MOSI** | Chân 19 (GPIO 10 - SPI0 MOSI) |
| **RES / RST** | Chân 18 (GPIO 24 - Configurable qua `TFT_RESET_PIN`) |
| **DC** | Chân 22 (GPIO 25 - Configurable qua `TFT_DC_PIN`) |
| **CS / CE0** | Chân 24 (GPIO 8 - SPI0 CE0) |
| **BLK / BL** | Nối 3.3V (Đèn nền sáng liên tục) |

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
