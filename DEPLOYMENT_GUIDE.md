# 🚀 HƯỚNG DẪN TRIỂN KHAI VÀ VẬN HÀNH HỆ THỐNG SMARTFACE AIoT
*(Dành cho thành viên dự án và người mới tiếp cận cài đặt hệ thống từ A-Z)*

Tài liệu này hướng dẫn chi tiết từng bước để một người bạn hoặc thành viên mới có thể kéo mã nguồn từ GitHub về và chạy thành công toàn bộ hệ thống **SmartFace AIoT — Staff Management & Attendance System** trên máy tính cá nhân hoặc kết hợp với Raspberry Pi 4.

---

## 📑 MỤC LỤC
1. [Kiến trúc tổng quan hệ thống](#1-kiến-trúc-tổng-quan-hệ-thống)
2. [Yêu cầu phần mềm trước khi cài đặt](#2-yêu-cầu-phần-mềm-trước-khi-cài-đặt)
3. [Bước 1: Clone Repository & Chuẩn bị cấu hình .env](#bước-1-clone-repository--chuẩn-bị-cấu-hình-env)
4. [Bước 2: Khởi động Hạ tầng IoT bằng Docker (Postgres, ThingsBoard, MediaMTX)](#bước-2-khởi-động-hạ-tầng-iot-bằng-docker)
5. [Bước 3: Cấu hình Thiết bị & Webhook trên ThingsBoard (2 phút)](#bước-3-cấu-hình-thiết-bị--webhook-trên-thingsboard)
6. [Bước 4: Khởi động Backend (Node.js REST API & Socket.IO)](#bước-4-khởi-động-backend)
7. [Bước 5: Khởi động Frontend Web App (React + Vite)](#bước-5-khởi-động-frontend-web-app)
8. [Bước 6: Khởi chạy AI Edge Client (Chọn 1 trong 2 kịch bản)](#bước-6-khởi-chạy-ai-edge-client)
   - [Kịch bản 6A: Chạy test ngay trên Máy tính (Dùng Webcam PC - Không cần Pi)](#kịch-bản-6a-chạy-test-ngay-trên-máy-tính-bằng-webcam-pc)
   - [Kịch bản 6B: Chạy trên Raspberry Pi 4 thực tế](#kịch-bản-6b-chạy-trên-raspberry-pi-4-thực-tế)
9. [Bước 7: Quy trình kiểm thử toàn diện (End-to-End Checklist)](#bước-7-quy-trình-kiểm-thử-toàn-diện)
10. [Bước 8: Khắc phục các lỗi thường gặp (Troubleshooting FAQ)](#bước-8-khắc-phục-các-lỗi-thường-gặp)

---

## 1. Kiến trúc tổng quan hệ thống

Hệ thống được thiết kế theo mô hình **AIoT biên đám mây (Edge-Cloud AIoT)** kết hợp:

```
[ Camera / Webcam ] 
        │
        ▼
[ Edge Client (Pi 4 hoặc PC) ] 
   ├── 1. SCRFD Face Detection & 5-Landmark
   ├── 2. ByteTrack/IOU Tracker + Lucas-Kanade Optical Flow
   ├── 3. MiniFASNet Face Anti-Spoofing (Liveness Check)
   ├── 4. ArcFace MobileFaceNet 512D Embedding
   ├── 5. Stream RTSP H.264 ───────────────► [ MediaMTX (Port 8554) ]
   └── 6. MQTT Two-Way RPC (Base64 Vector) ──► [ ThingsBoard (Port 1883) ]
                                                        │
                                                        ▼ (Webhook RPC)
                                             [ Node.js Backend (Port 3000) ]
                                                        │
                                                        ▼ (Cosine Similarity)
                                             [ PostgreSQL pgvector (5432) ]
                                                        │
                                                        ▼ (Socket.IO Realtime)
                                             [ React Frontend (Port 5173) ]
                                             (Xem Live WebRTC qua MediaMTX 8889)
```

---

## 2. Yêu cầu phần mềm trước khi cài đặt

Cài đặt sẵn các công cụ sau trên máy tính của bạn:
1. **Git**: Kiểm tra bằng lệnh `git --version`
2. **Docker & Docker Compose**: Để chạy ThingsBoard, MediaMTX và PostgreSQL. (Trên Windows/Mac cài **Docker Desktop**, trên Linux cài `docker` và `docker-compose-plugin`).
3. **Node.js**: Phiên bản **v18.x** hoặc **v20.x trở lên** (kèm `npm`). Kiểm tra bằng `node -v` và `npm -v`.
4. **Python**: Phiên bản **3.9 - 3.11** (kèm `pip`). Kiểm tra bằng `python --version` hoặc `python3 --version`.

---

## Bước 1: Clone Repository & Chuẩn bị cấu hình .env

### 1.1. Tải mã nguồn về máy:
```bash
git clone https://github.com/anh1303/SmartFace-AIoT-Based-Staff-Management-Attendance-System.git
cd SmartFace-AIoT-Based-Staff-Management-Attendance-System
```

### 1.2. Xác định Địa chỉ IP máy tính:
> 💡 **Quy tắc địa chỉ IP:**
> - **Nếu bạn chạy toàn bộ trên 1 máy tính** (Server + Backend + Frontend + Edge Client dùng Webcam máy tính): Sử dụng địa chỉ `127.0.0.1` (hoặc `localhost`).
> - **Nếu bạn dùng thêm Raspberry Pi 4 thật**: Bạn cần tìm địa chỉ IP mạng LAN của máy tính (ví dụ: `192.168.1.50` hoặc `10.74.201.36`).
>   - Trên Windows: gõ `ipconfig` (tìm dòng *IPv4 Address* của Wi-Fi hoặc Ethernet).
>   - Trên Linux/macOS: gõ `ip a` hoặc `ifconfig`.

### 1.3. Khởi tạo các file cấu hình `.env`:
Sao chép các file mẫu sang file chạy thực tế:

```bash
# File Docker Database
cp .env.compose.example .env.compose

# File Backend
cp backend/.env.example backend/.env

# File Frontend
cp frontend/.env.example frontend/.env

# File Pi Edge Client (Hardware)
cp hardware/.env.example hardware/.env
```

Kiểm tra nội dung các file cấu hình quan trọng:
* **`backend/.env`**:
  - `PORT=3000`
  - `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/PBL6?schema=public"`
  - `CORS_ORIGIN=http://localhost:5173`
* **`frontend/.env`**:
  - `VITE_API_BASE=""` *(để trống để Vite tự động proxy sang backend)*
  - `VITE_SOCKET_URL="http://localhost:3000"`

---

## Bước 2: Khởi động Hạ tầng IoT bằng Docker

Hạ tầng gồm 3 dịch vụ Docker chính:
1. **PostgreSQL 16 (kèm tiện ích mở rộng pgvector)**
2. **ThingsBoard IoT Platform (Web UI 8080, MQTT Broker 1883)**
3. **MediaMTX Video Server (RTSP 8554, WebRTC 8889)**

Mở Terminal tại thư mục gốc của dự án và chạy 2 lệnh sau:

```bash
# 1. Khởi động PostgreSQL có pgvector
docker compose --env-file .env.compose -f docker-compose.yml up -d postgres

# 2. Khởi động ThingsBoard và MediaMTX
docker compose -f docker-compose.iot.yml up -d
```

Kiểm tra trạng thái các container:
```bash
docker ps
```
Bạn sẽ thấy 3 container đang chạy ổn định:
- `pbl6-postgres-1` (hoặc `smartface_postgres`)
- `smartface_thingsboard`
- `smartface_mediamtx`

---

## Bước 3: Cấu hình Thiết bị & Webhook trên ThingsBoard

*(Chỉ cần thực hiện 1 lần duy nhất khi khởi tạo hệ thống mới - mất khoảng 2 phút)*

> 💡 **Mẹo:** Bạn có thể xem toàn bộ hướng dẫn tạo Widgets và 1-Click Import file JSON tại tài liệu riêng: **[THINGSBOARD_GUIDE.md](./THINGSBOARD_GUIDE.md)**!

1. Mở trình duyệt truy cập giao diện ThingsBoard: **`http://localhost:8080`** (hoặc `http://<IP_LAN>:8080`).
2. Đăng nhập tài khoản Tenant mặc định:
   - **Tài khoản**: `tenant@thingsboard.org`
   - **Mật khẩu**: `tenant`
3. **Tạo Thiết bị Edge Gate**:
   - Vào menu bên trái: **Device groups** $\rightarrow$ **All** (hoặc **Entities** $\rightarrow$ **Devices**).
   - Nhấn dấu **`+`** (Add device) $\rightarrow$ **Add new device**.
   - Đặt tên thiết bị: **`PI4_FRONT_GATE`**.
   - Mục **Device profile**: chọn `default`.
   - Bấm **Next: Credentials** $\rightarrow$ Chọn loại xác thực: **Access token**.
   - Điền Access token: **`ivu62ZoR6gkXyqqoDobJ`** *(Token này đã được cấu hình sẵn trong `.env`)*.
   - Nhấn **Add**.
4. **Cấu hình Rule Chain Webhook đối soát điểm danh (Two-Way RPC)**:
   - Cách nhanh nhất: Vào **Rule chains** $\rightarrow$ Bấm nút `Import rule chain` $\rightarrow$ Chọn file `thingsboard_config/smartface_root_rule_chain.json`.
   - Hoặc làm thủ công: Trong **Root Rule Chain**, kéo node **`message type switch`** $\rightarrow$ nối nhánh `RPC Request from Device` vào node **`rest api call`** (Endpoint: `http://host.docker.internal:3000/api/attendance/tb-webhook`, Method: `POST`) $\rightarrow$ nối nhánh `Success` vào node **`rpc call reply`** $\rightarrow$ Nhấn **Save**.
5. **Import Dashboard Giám sát**:
   - Vào menu **Dashboards** $\rightarrow$ Bấm biểu tượng **`Import dashboard`** $\rightarrow$ Chọn file `thingsboard_config/smartface_dashboard.json`.
   - Toàn bộ 5 widget giám sát (Khoảng cách siêu âm, FPS, Liveness Score, Công tắc chuyển mode, Trạng thái cổng) sẽ hiển thị ngay lập tức!

---

## Bước 4: Khởi động Backend

Mở một Terminal mới tại thư mục dự án và thực hiện:

```bash
cd backend

# 1. Cài đặt các thư viện Node.js
npm install

# 2. Sinh Prisma Client
npm run prisma:generate

# 3. Chạy Database Migrations (Tạo các bảng trong PostgreSQL)
npm run prisma:migrate

# 4. Nạp dữ liệu mẫu (Tài khoản Admin, Phòng ban, Ca làm việc, Nhân viên & Vector khuôn mặt mẫu)
npm run prisma:seed

# 5. Khởi chạy Backend Server ở chế độ phát triển
npm run dev
```

Khi khởi động thành công, màn hình sẽ thông báo:
```text
[Server] Database connected successfully
[CronJob] Dịch vụ tổng hợp chấm công tự động đã được kích hoạt
[Server] API listening on http://localhost:3000
```

---

## Bước 5: Khởi động Frontend Web App

Mở một Terminal mới khác:

```bash
cd frontend

# 1. Cài đặt các thư viện React
npm install

# 2. Khởi chạy Vite Dev Server
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:5173`**
Đăng nhập vào hệ thống bằng tài khoản quản trị:
* **Tên đăng nhập**: `admin`
* **Mật khẩu**: `Admin@123456`

---

## Bước 6: Khởi chạy AI Edge Client

Bạn có thể lựa chọn 1 trong 2 cách sau tùy theo thiết bị bạn đang có:

---

### Kịch bản 6A: Chạy test ngay trên Máy tính (bằng Webcam PC)
> 🌟 **Khuyên dùng nếu bạn chưa có Raspberry Pi hoặc muốn kiểm thử code AI nhanh chóng!**

1. Mở file **`hardware/.env`** và cấu hình các dòng sau:
   ```env
   # Kết nối ThingsBoard cục bộ
   TB_HOST=127.0.0.1
   TB_PORT=1883
   TB_TOKEN=ivu62ZoR6gkXyqqoDobJ

   # RTSP Stream về MediaMTX trên máy tính
   STREAM_ENABLED=true
   RTSP_URL=rtsp://127.0.0.1:8554/pi4_cam

   # Dùng webcam tích hợp của máy tính
   CAMERA_INDEX=0

   # Mở cửa sổ hiển thị video OpenCV trực quan trên màn hình
   SHOW_GUI=true

   # TẮT các phần cứng đặc thù của Raspberry Pi (tránh lỗi thiếu chân GPIO SPI)
   TFT_ENABLED=false
   ULTRASONIC_ENABLED=false
   ```

2. Tạo môi trường Python và cài đặt thư viện:
   ```bash
   cd hardware

   # Tạo môi trường ảo
   python -m venv venv

   # Kích hoạt môi trường:
   # Trên Windows:
   venv\Scripts\activate
   # Trên macOS / Linux:
   source venv/bin/activate

   # Cài đặt thư viện AI & Streaming
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. Khởi chạy Client:
   ```bash
   python edge_client.py
   ```

Màn hình webcam máy tính sẽ xuất hiện:
- Có khung chữ nhật bám theo khuôn mặt của bạn.
- Hiển thị nhãn **REAL (Độ tin cậy)** hoặc **SPOOF**.
- Khi đứng vào giữa khung hình, hệ thống sẽ tự động trích xuất vector 512D gửi lên ThingsBoard $\rightarrow$ Backend so khớp $\rightarrow$ Báo điểm danh thành công!

---

### Kịch bản 6B: Chạy trên Raspberry Pi 4 thực tế

1. **Chuẩn bị Raspberry Pi:**
   - Cài đặt hệ điều hành **Raspberry Pi OS 64-bit** (Debian Bullseye hoặc Bookworm).
   - Kết nối Pi 4 chung mạng Wi-Fi/LAN với máy tính chạy Server.

2. **Sao chép thư mục `hardware` sang Pi 4:**
   ```bash
   # Chạy lệnh này từ máy tính của bạn:
   scp -r hardware piuser@<IP_CỦA_PI>:~/
   ```

3. **Cài đặt môi trường trên Pi 4 (qua SSH hoặc Terminal của Pi):**
   ```bash
   sudo apt update
   sudo apt install -y ffmpeg libcamera-tools v4l-utils

   cd ~/hardware
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Sơ đồ đấu nối phần cứng ngoại vi trên Raspberry Pi 4:**

   * **A. Cảm biến siêu âm HC-SR04 (Wake-on-Presence):**
     - **VCC**: Chân 2 hoặc 4 (5V)
     - **GND**: Chân 6, 9 hoặc 14 (Ground)
     - **TRIG**: Chân 16 (GPIO 23)
     - **ECHO**: Chân 13 (GPIO 27) *(Nên qua cầu phân áp 1kΩ / 2kΩ để hạ từ 5V xuống 3.3V bảo vệ chân GPIO của Pi)*

   * **B. Màn hình LCD SPI TFT ST7789V (240x320):**
     - **VCC**: Chân 1 hoặc 17 (3.3V)
     - **GND**: Chân 20 hoặc 25 (GND)
     - **SCL / SCK**: Chân 23 (GPIO 11 - SPI0 SCLK)
     - **SDA / MOSI**: Chân 19 (GPIO 10 - SPI0 MOSI)
     - **RES / RST**: Chân 18 (GPIO 24)
     - **DC**: Chân 22 (GPIO 25)
     - **CS / CE0**: Chân 24 (GPIO 8 - SPI0 CE0)
     - **BLK / BL**: Nối vào 3.3V (Đèn nền màn hình sáng liên tục)

5. **Cấu hình file `~/hardware/.env` trên Pi 4:**
   ```env
   # Trỏ về IP LAN máy tính Server của bạn (ví dụ: 192.168.1.50)
   TB_HOST=192.168.1.50
   TB_PORT=1883
   TB_TOKEN=ivu62ZoR6gkXyqqoDobJ

   RTSP_URL=rtsp://192.168.1.50:8554/pi4_cam
   STREAM_ENABLED=true

   # Bật đầy đủ ngoại vi phần cứng
   TFT_ENABLED=true
   ULTRASONIC_ENABLED=true
   SHOW_GUI=false
   ```

6. **Khởi chạy trên Raspberry Pi 4:**
   - **Nếu dùng Camera cáp dẹt CSI (Pi Camera Module v1/v2/v3):**
     ```bash
     libcamerify python edge_client.py
     ```
   - **Nếu dùng USB Webcam:**
     ```bash
     python edge_client.py
     ```

---

## Bước 7: Quy trình kiểm thử toàn diện

1. **Kiểm tra Live Stream WebRTC:**
   - Đăng nhập vào Web: `http://localhost:5173` $\rightarrow$ Vào trang **Giám sát chấm công (Attendance Monitor)**.
   - Bạn sẽ nhìn thấy video từ Camera truyền về trực tiếp với độ trễ siêu thấp (< 0.3 giây).

2. **Kiểm tra Điểm danh VÀO CA (Check-in):**
   - Đứng trước camera khoảng cách dưới 50cm $\rightarrow$ Cảm biến siêu âm đánh thức AI.
   - Khuôn mặt được nhận diện (Khung xanh lá + nhãn REAL).
   - Âm thanh "Ting" vang lên trên giao diện web, một dòng chấm công mới xuất hiện tức thì trong danh sách.
   - Màn hình TFT trên Pi (hoặc cửa sổ OpenCV) hiện banner: `[TÊN NHÂN VIÊN] - CHECK_IN THÀNH CÔNG!`.

3. **Kiểm tra Đổi chế độ Điều khiển Cổng từ xa (Remote IoT Control):**
   - Trên giao diện Web, bấm nút chuyển sang **TAN CA (Check-out)**.
   - Quan sát Terminal của Edge Client và màn hình camera: Chế độ đổi ngay lập tức sang `CHECK_OUT` mà không cần khởi động lại client.

4. **Kiểm tra Tính năng Chống Giả Mạo (Anti-Spoofing):**
   - Dùng điện thoại mở một bức ảnh chân dung và giơ trước camera.
   - Hệ thống phát hiện ánh sáng phản chiếu màn hình $\rightarrow$ Khung đổi sang **màu đỏ** kèm nhãn **SPOOF**.
   - Edge Client từ chối gửi lệnh điểm danh, bảo vệ hệ thống tuyệt đối khỏi gian lận.

---

## Bước 8: Khắc phục các lỗi thường gặp

### ❌ 1. Lỗi `can't open camera by index` hoặc `Not a video capture device`
- **Nguyên nhân**: Trên Linux / Pi 4, OpenCV cố mở nhầm node giải mã phần cứng (`/dev/video10` của chip VideoCore).
- **Khắc phục**:
  - Nếu dùng cáp dẹt CSI trên Pi: Luôn khởi chạy bằng lệnh `libcamerify python edge_client.py`.
  - Nếu dùng USB Webcam: Kiểm tra cổng bằng `v4l2-ctl --list-devices` và đặt lại `CAMERA_INDEX=1` (hoặc `2`) trong file `.env`.
  - Nếu dùng laptop: Đảm bảo không có ứng dụng nào khác (Zoom, Teams, Camera app) đang chiếm quyền sử dụng webcam.

### ❌ 2. Lỗi `[MQTT] [ERROR] Không thể kết nối tới ThingsBoard`
- **Nguyên nhân**: Container ThingsBoard chưa khởi động xong (ThingsBoard cần khoảng 30 - 60 giây để khởi động toàn bộ dịch vụ Java nội bộ) hoặc sai IP LAN.
- **Khắc phục**:
  - Kiểm tra xem cổng 8080 trên web đã vào được chưa.
  - Kiểm tra xem địa chỉ IP trong `TB_HOST` có đúng với IP máy chạy Docker không.
  - Kiểm tra tường lửa (Firewall) trên máy tính có đang chặn cổng `1883` không.

### ❌ 3. Lỗi WebRTC trên Web hiện màn hình đen hoặc `Could not connect to WebRTC stream`
- **Nguyên nhân**: MediaMTX chưa nhận được luồng RTSP từ Edge Client, hoặc trình duyệt chặn kết nối IP LAN.
- **Khắc phục**:
  - Đảm bảo Edge Client đã chạy và báo `[RTSP] Đang đẩy luồng video...`.
  - Kiểm tra file `docker-compose.iot.yml`, đảm bảo biến `MTX_WEBRTCADDITIONALHOSTS` được đặt đúng bằng IP LAN máy tính của bạn.

### ❌ 4. Lỗi Prisma `Can't reach database server at localhost:5432`
- **Nguyên nhân**: Container Postgres chưa chạy.
- **Khắc phục**:
  - Chạy lại lệnh: `docker compose --env-file .env.compose -f docker-compose.yml up -d postgres`.
  - Đảm bảo không có dịch vụ PostgreSQL cục bộ nào khác cài sẵn trên Windows/Linux chiếm cổng 5432.

---

Chúc bạn cài đặt và trải nghiệm thành công hệ thống **SmartFace AIoT**! 🎉  
Nếu gặp bất kỳ khó khăn nào trong quá trình cài đặt, vui lòng mở mục **Issues** trên GitHub hoặc liên hệ người quản trị dự án.
