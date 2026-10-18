# HƯỚNG DẪN TRIỂN KHAI SMARTFACE TRÊN RASPBERRY PI 4

Thư mục `pi_edge/` này là bản đóng gói độc lập, siêu nhẹ (**~18 MB** thay vì 1.8 GB của toàn bộ source code huấn luyện AI).
* **Đầy đủ cấu trúc Pipeline AIoT:**
  1. `detection/`   : Bộ dò khuôn mặt (SCRFD ONNX hoặc YuNet INT8 ONNX).
  2. `tracking/`    : **FaceTracker** (IOU association + Lucas-Kanade Optical Flow Cadence).
  3. `antispoof/`   : **MiniFASNet R7** (ONNX 1.7 MB, Temporal Voting qua rolling window).
  4. `alignment/`   : ArcFace 5-point landmark affine transformation (112x112).
  5. `recognition/` : **ArcFace MobileFaceNet** (ONNX 13 MB, trích xuất vector 512D chuẩn L2).
  6. `iot/`         : **ThingsBoardClient** (MQTT v1/devices/me/telemetry + 2-way Shared Attributes).
  7. `streaming/`   : **RTSPStreamer** (FFmpeg H.264 pipe -> MediaMTX).
* **Không cần cài đặt InsightFace, PyTorch hay trình biên dịch C++:** Chỉ dùng ONNX Runtime và OpenCV Headless, cài đặt trong chưa tới 1 phút trên Raspberry Pi OS 64-bit!

---

## 1. Copy thư mục `pi_edge` sang Raspberry Pi 4
Dùng lệnh SCP từ máy tính (hoặc copy qua USB drive):
```bash
scp -r pi_edge pi@<IP_CỦA_PI>:~/
```

---

## 2. Cài đặt môi trường trên Raspberry Pi 4
Mở Terminal trên Pi và chạy các lệnh:

```bash
# 1. Cài đặt FFmpeg để nén video H.264
sudo apt update
sudo apt install -y ffmpeg

# 2. Di chuyển vào thư mục pi_edge
cd ~/pi_edge

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
* `DETECTION_INTERVAL_SECONDS=0.2` : Chu kỳ chạy Detector (0.2s giúp giảm >50% tải CPU cho Pi 4 nhờ dùng Optical Flow bám mặt ở các frame xen kẽ).
* `MAX_FACES_PER_FRAME=1` : Giới hạn số lượng khuôn mặt lớn nhất được track/xử lý trên 1 frame (mặc định: `1` cho cổng điểm danh ưu tiên người đứng gần nhất; đặt `0` nếu không muốn giới hạn).
* `CONSECUTIVE_REAL_FRAMES=3` : Cần 3 votes REAL liên tiếp từ MiniFASNet để xác nhận liveness (chống spoofing).
* `SCAN_COOLDOWN_SECONDS=5.0` : Thời gian chờ trước khi cho phép quét lại cùng một người (Track ID).
* `TB_HOST=<IP_LAN_CỦA_MÁY_SERVER>` (Ví dụ: `10.52.138.36`)
* `RTSP_URL=rtsp://<IP_LAN_CỦA_MÁY_SERVER>:8554/pi4_cam`
* `TB_TOKEN=ivu62ZoR6gkXyqqoDobJ` (Token thiết bị PI4_FRONT_GATE)
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
  - Gom vote Anti-Spoofing theo từng khuôn mặt $\rightarrow$ đạt đủ 3 votes REAL $\rightarrow$ Căn chỉnh khuôn mặt $\rightarrow$ Trích xuất vector 512D ArcFace.
  - Vector 512D được bắn lên ThingsBoard qua MQTT topic `v1/devices/me/telemetry`.
  - ThingsBoard Rule Chain kiểm tra và đẩy qua webhook backend để so khớp sinh trắc học `pgvector`.
  - Xuất trực tiếp hình ảnh có vẽ khung nhận diện + nhãn Real/Spoof + banner điểm danh lên màn hình **TFT ST7789V**!
  - Video stream song song được nén H.264 đẩy về máy chủ qua RTSP port 8554.
