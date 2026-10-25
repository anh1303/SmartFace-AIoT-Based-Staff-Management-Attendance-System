# SmartFace - Raspberry Pi Device Simulator

Bộ công cụ giả lập thiết bị chấm công **Raspberry Pi (AIoT Device)** giao tiếp trực tiếp với Backend SmartFace qua HTTP Webhook.

---

## 📌 Mục đích & Nguyên lý hoạt động

Backend không cần biết và không thể phân biệt bên gửi là Raspberry Pi thật hay một script giả lập, miễn là client tuân thủ **đúng hợp đồng giao thức (Contract/Protocol)**:

```
[Camera AI / Pi Simulator]
        │
        │ POST /api/attendance/tb-webhook
        │ Headers: X-TB-Webhook-Secret, X-Device-Name
        │ Payload: Float32 Base64 (512-D), recognition_id, event_kind, ...
        ▼
   [Backend API] ──(pgvector cosine distance)──► [Database]
        │
        └──────(Socket.IO Realtime Event)──────► [Admin Dashboard]
```

### Ưu điểm của giải pháp giả lập:
1. **Zero External Dependencies**: Viết hoàn toàn bằng thư viện chuẩn của Python (`urllib.request`, `json`, `struct`, `asyncio`), **không cần cài đặt bất kỳ thư viện `pip` nào**.
2. **Kiểm thử độc lập**: Không cần phần cứng Raspberry Pi vật lý, camera hay mạng LAN phức tạp.
3. **Bao phủ 8 kịch bản nghiệp vụ**: Kiểm tra từ nhận diện thành công, chống trùng lặp (debounce), chống giả mạo (anti-spoofing), bảo mật secret, gửi bù mất mạng (offline queue), đến đo tải đa thiết bị.

---

## 📋 Hợp đồng giao tiếp (Contract Specifications)

* **Endpoint**: `POST /api/attendance/tb-webhook`
* **Headers**:
  * `Content-Type`: `application/json`
  * `X-TB-Webhook-Secret`: Khóa bí mật chung (tối thiểu 24 ký tự, cấu hình trong `.env`)
  * `X-Device-Name`: Mã định danh thiết bị (ví dụ: `PI4_FRONT_GATE`)
* **Payload JSON**:
  | Trường | Kiểu | Mô tả |
  | :--- | :--- | :--- |
  | `device_id` | `string` | Tên thiết bị (phải khớp header `X-Device-Name`) |
  | `mode` | `string` | `CHECK_IN` hoặc `CHECK_OUT` |
  | `event_id` | `string (UUID)` | Định danh duy nhất cho một phiên điểm danh (dùng để debounce) |
  | `client_timestamp` | `int (epoch ms)` | Thời điểm camera ghi nhận khuôn mặt thực tế |
  | `antispoof_score` | `float [0..1]` | Điểm tin cậy chống giả mạo (yêu cầu $\ge 0.5$) |
  | `event_kind` | `string` | `VERIFY_ONLY` (quét thử) hoặc `CONFIRMED_SCAN` (chốt điểm danh) |
  | `recognition_id` | `string (UUID)` | Định danh lượt quét vật lý (mỗi khung hình 1 mã khác nhau) |
  | `expected_employee_id` | `string (UUID)` | UUID nhân viên (chỉ gửi ở lần quét `CONFIRMED_SCAN`) |
  | `embedding_b64` | `string (Base64)`| 512 số float32 LE (2048 bytes), chuẩn L2-normalized |

* **Giao thức xác thực 2 pha (ATTENDANCE_STABLE_COUNT = N, mặc định 3)**:
  * Lần quét 1 đến $N-1$: Gửi `event_kind = VERIFY_ONLY` $\rightarrow$ Backend chỉ xác minh độ tương đồng, **chưa ghi vào database**.
  * Lần quét $N$: Gửi `event_kind = CONFIRMED_SCAN` kèm `expected_employee_id` $\rightarrow$ Backend chốt ghi sổ chấm công (`attendance_logs`) và phát sự kiện Socket.IO ra Dashboard.

---

## 🚀 Hướng dẫn sử dụng nhanh (Quick Start)

### 1. Điều kiện tiên quyết
* Backend đã được cấu hình `TB_WEBHOOK_SECRET` trong `backend/.env` (tối thiểu 24 ký tự).
* Backend đang chạy trên cổng `http://localhost:3000`:
  ```bash
  cd backend
  npm run dev
  ```

---

### 2. Chọn nhân viên cần test

Dùng script tiện ích `select_test_employee.cjs` để xem danh sách và chọn nhân viên:

```bash
# Xem danh sách toàn bộ nhân viên trong công ty
node scripts/realtime/select_test_employee.cjs

# Chọn nhân viên muốn test bằng Mã NV (ví dụ: NV-019 hoặc NV-002)
node scripts/realtime/select_test_employee.cjs NV-019

# Hoặc chọn theo họ tên
node scripts/realtime/select_test_employee.cjs "Lê Thu Trang"
```

> **Cơ chế tự động:**
> * Nếu nhân viên đã đăng ký khuôn mặt: Script tự trích xuất vector khuôn mặt thật từ database ra `scripts/realtime/known_face_embedding.json`.
> * Nếu nhân viên chưa có khuôn mặt: Script tự động khởi tạo vector khuôn mặt mẫu chuẩn (512 chiều) và lưu vào database cho nhân viên đó.

---

### 3. Chạy giả lập điểm danh

```bash
# 1. Chạy bài test điểm danh cơ bản (Check-in & Check-out của nhân viên đã chọn):
python scripts/realtime/pi_simulator.py --scenarios basic

# 2. Chạy toàn bộ 8 bài test toàn diện:
python scripts/realtime/pi_simulator.py

# 3. Test nhanh các bài test bảo vệ & chống giả mạo (không cần dữ liệu nhân viên):
python scripts/realtime/pi_simulator.py --scenarios wrong_secret bad_payload spoof

# 4. Test chịu tải song song nhiều thiết bị (giả lập 10 máy Pi quét dồn dập):
python scripts/realtime/pi_simulator.py --scenarios multi_device --devices 10
```


---

## 🧪 Chi tiết 8 Kịch bản kiểm thử (Test Scenarios)

| STT | Kịch bản | Tên scenario | Hành vi giả lập | Kết quả mong đợi |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Điểm danh chuẩn 2 pha** | `basic` | Quét 3 lần (`VERIFY_ONLY` $\rightarrow$ `CONFIRMED_SCAN`) cho cả Check-in và Check-out. | `200 OK`, `matched=true`, ghi nhận điểm danh đúng nhân viên. |
| **2** | **Chống trùng lặp (Debounce)** | `debounce` | Giả lập mạng chập chờn khiến Pi gửi lặp lại 5 lần cùng một `event_id`. | Backend chỉ ghi 1 lần duy nhất, các lần sau trả kết quả cũ (Idempotent). |
| **3** | **Khuôn mặt người lạ** | `unknown_face` | Gửi vector ngẫu nhiên không có trong database. | `200 OK`, `matched=false`, bắn cảnh báo `UNKNOWN_FACE`. |
| **4** | **Chống gian lận (Anti-Spoofing)** | `spoof` | Gửi điểm liveness thấp (`antispoof_score = 0.3`, nghi ngờ dùng ảnh chụp màn hình). | Backend từ chối chấm công, cảnh báo ảnh giả mạo. |
| **5** | **Xác thực bảo mật thiết bị** | `wrong_secret` | Gửi header `X-TB-Webhook-Secret` sai. | Backend chặn đứng với mã lỗi `401 Unauthorized`. |
| **6** | **Hàng đợi ngoại tuyến** | `offline_queue` | Xếp hàng 3 sự kiện khi mất mạng, sau đó gửi bù với timestamp quá khứ (5 phút trước). | Backend chấp nhận timestamp gốc của thiết bị, xử lý thành công `3/3`. |
| **7** | **Đa thiết bị đồng thời** | `multi_device` | Khởi tạo $N$ thiết bị giả lập gửi request song song cùng một lúc. | Đo thời gian phản hồi trung bình (latency) và tỷ lệ thành công. |
| **8** | **Chặn Payload lỗi/dị tật** | `bad_payload` | Gửi 4 dạng dữ liệu sai (thiếu ID, sai mode, thiếu liveness, v.v.). | Backend từ chối hợp lệ bằng mã `4xx`, **không bị crash 500**. |

---

## 🛠 Danh mục tham số dòng lệnh (CLI Arguments)

```bash
python scripts/pi_simulator.py [OPTIONS]
```

| Tham số | Ý nghĩa | Mặc định |
| :--- | :--- | :--- |
| `--scenarios` | Danh sách kịch bản muốn chạy (`basic`, `debounce`, `unknown_face`, `spoof`, `wrong_secret`, `offline_queue`, `multi_device`, `bad_payload`) | Tất cả |
| `--employee` | Chỉ định mã nhân viên hoặc UUID muốn test | Lấy từ `known_face_embedding.json` |
| `--devices` | Số lượng thiết bị song song trong scenario `multi_device` | `5` |
| `--base-url` | Địa chỉ Backend URL | `http://localhost:3000` |
| `--secret` | Khóa bí mật Webhook (ghi đè cấu hình) | Đọc từ `backend/.env` |
| `--device` | Tên thiết bị giả lập | `PI4_FRONT_GATE` |

---

## 🔍 Khắc phục sự cố thường gặp (Troubleshooting)

1. **Lỗi `Connection refused — backend dang tat?` (Mã mạng -1)**:
   * **Nguyên nhân**: Backend chưa được khởi động trên cổng 3000.
   * **Xử lý**: Mở một terminal mới, chuyển vào thư mục `backend` và chạy `npm run dev`.

2. **Lỗi `401 Unauthorized` ở bài test basic**:
   * **Nguyên nhân**: Giá trị `TB_WEBHOOK_SECRET` giữa backend và client không khớp, hoặc chưa đủ 24 ký tự.
   * **Xử lý**: Kiểm tra dòng `TB_WEBHOOK_SECRET=...` trong file `backend/.env`.

3. **Scenario `basic` báo `matched=false`**:
   * **Nguyên nhân**: Nhân viên đang test chưa có vector khuôn mặt trong CSDL.
   * **Xử lý**: Chạy lệnh `node scripts/select_test_employee.cjs <MÃ_NV>` để công cụ tự tạo vector nhận diện cho nhân viên đó trước khi chạy test.
