# Giả lập thiết bị chấm công

Công cụ gửi HTTP tới backend để kiểm tra giao thức chấm công/realtime khi không có Raspberry Pi. Không kiểm chứng camera, PAD hoặc GPIO.

## Yêu cầu

- Backend đang chạy, database thử riêng và cấu hình `TB_WEBHOOK_SECRET`.
- Python; simulator dùng `httpx` nếu có và có nhánh dự phòng thư viện chuẩn.
- Dependencies backend/Prisma Client nếu dùng công cụ chọn nhân viên.

Scenario có thể tạo dữ liệu chấm công. Công cụ chọn nhân viên có thể thêm embedding giả nếu nhân viên chưa có vector; chỉ dùng trên dữ liệu thử, không dùng để đăng ký khuôn mặt thật.

## Chuẩn bị

Sao chép [.env.simulator.example](.env.simulator.example) thành `scripts/realtime/.env`, điền secret/nhân viên thử và giữ số lượt xác nhận khớp backend. Simulator chỉ nạp file `.env` đầu tiên tìm thấy.

Chạy từ thư mục gốc repository:

```sh
python -m pip install -r scripts/realtime/requirements-simulator.txt
python scripts/realtime/pi_simulator.py --help
```

Để chọn nhân viên, đặt `DATABASE_URL` trong môi trường chạy Node và dùng client đã sinh ở backend:

```sh
node scripts/realtime/select_test_employee.cjs
node scripts/realtime/select_test_employee.cjs NV-019
```

Lệnh đầu liệt kê; lệnh có đối số chọn nhân viên và xuất `scripts/realtime/known_face_embedding.json`. Embedding trong file không phải bằng chứng nhận diện khuôn mặt thật.

## Chạy simulator

```sh
python scripts/realtime/pi_simulator.py --scenarios basic
python scripts/realtime/pi_simulator.py --scenarios wrong_secret bad_payload spoof
python scripts/realtime/pi_simulator.py --scenarios multi_device --devices 10
```

Bỏ `--scenarios` để chạy tất cả. Các tên được hỗ trợ: `basic`, `debounce`, `unknown_face`, `spoof`, `wrong_secret`, `offline_queue`, `multi_device`, `bad_payload`. Đọc kết quả cùng response backend; gửi request thành công không đồng nghĩa đã ghi chấm công.

| Tham số | Ý nghĩa |
| --- | --- |
| `--base-url` | URL backend, mặc định `http://localhost:3000` |
| `--secret` | Ghi đè `TB_WEBHOOK_SECRET` |
| `--device` | Tên thiết bị giả lập |
| `--employee` | UUID nhân viên thử |
| `--devices` | Số thiết bị trong kịch bản tải, mặc định 5 |
| `--scenarios` | Danh sách kịch bản |

Các biến khác như `SIMULATOR_EMBEDDING_FILE`, `ATTENDANCE_STABLE_COUNT` được mô tả bởi `--help` và [mã nguồn](pi_simulator.py).

## Giao thức

Gửi `POST /api/attendance/tb-webhook`, kèm `X-TB-Webhook-Secret`, `X-Device-Name`. Payload gồm thiết bị/sự kiện, mode, thời điểm quét, liveness và embedding float32 Base64.

`VERIFY_ONLY` xác minh trước; `CONFIRMED_SCAN` xác nhận nhân viên theo số lượt yêu cầu. `event_id` chống trùng lặp; `recognition_id` phân biệt lượt nhận diện vật lý. Contract đầy đủ: [router](../../backend/src/modules/attendance/attendance.routes.ts) và [webhook](../../backend/src/modules/attendance/attendance.webhook.ts).
