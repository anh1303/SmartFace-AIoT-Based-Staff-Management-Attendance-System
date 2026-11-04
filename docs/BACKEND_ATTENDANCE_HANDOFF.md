# Tài Liệu Bàn Giao: Cơ Chế Điểm Danh Tự Động & Hợp Đồng Giao Tiếp Edge - Backend

## 1. Bối Cảnh Hệ Thống
Phần cứng Raspberry Pi Edge của hệ thống SmartFace đã được tinh gọn:
- Sử dụng **1 cảm biến siêu âm duy nhất** đo khoảng cách trước hệ thống. Khi có người đứng trước kiosk trong phạm vi $\le 50\text{cm}$ (ổn định $\ge 0.5\text{s}$), hệ thống tự động đánh thức AI (`AWAKE`).
- Không còn 2 cảm biến siêu âm riêng biệt gán cứng cho Vào ca hay Ra ca.
- Tích hợp thêm **Động cơ Servo Barrier** mô phỏng cửa mở tự động 2 chiều:
  - Cửa đóng: góc **`90°`**.
  - Check-in: góc **`0°`** (Mở vào).
  - Check-out: góc **`180°`** (Mở ra).
  - Ngắt xung PWM (`servo.angle = None`) sau khi đóng cửa để chống rung giật và chống nóng động cơ.

---

## 2. Dữ Liệu Pi Edge Gửi Lên Backend
Khi nhận diện thành công khuôn mặt thật, Pi Edge gửi gói tin điểm danh qua Webhook / RPC:
- `device_id`: Mã thiết bị (ví dụ: `"PI4_FRONT_GATE"`, `"PI4_FRONT_GATE1"`)
- `mode`: `"AUTO"` (hoặc để trống)
- `embedding` / `embedding_b64`: Vector 512 chiều trích xuất từ ArcFace
- `antispoof_score`: Điểm liveness từ MiniFAS (0.0 đến 1.0)
- `client_timestamp`: Thời điểm quét (mili-giây)
- `event_id`: Mã định danh duy nhất của lượt quét
- `event_kind`: `"VERIFY_ONLY"` hoặc `"CONFIRMED_SCAN"`

---

## 3. Logic Xử Lý Tại Backend ([attendance.webhook.ts](../backend/src/modules/attendance/attendance.webhook.ts))
Một máy dùng `AUTO` cho cả vào và ra. Backend dùng cửa sổ ghép cặp 24 giờ của chính sách chấm công, kể cả ca qua đêm. Khi triển khai, đặt `INITIAL_MODE=AUTO` trong `hardware/.env` và `attendance_mode=AUTO` trong shared attributes của ThingsBoard.

```typescript
// 1. Tìm lượt hợp lệ gần nhất trong cửa sổ ghép cặp, không cắt ở 00:00.
const lastLog = await prisma.attendance_logs.findFirst({
  where: {
    employee_id: match.emp_id,
    status: 'VALID',
    event_time: { gte: new Date(capturedAt - MAX_PAIR_MS), lte: new Date(capturedAt) },
  },
  orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
});

// 2. Phân định: Chưa có lượt nào (hoặc lượt trước là CHECK_OUT) -> Lần này là CHECK_IN
let resolvedMode = (!lastLog || lastLog.type === 'CHECK_OUT') ? 'CHECK_IN' : 'CHECK_OUT';

// 3. Cơ chế Cooldown chống quét nhầm linh hoạt (cấu hình qua ATTENDANCE_COOLDOWN_SECONDS trong .env):
const cooldownMs = (Number(process.env.ATTENDANCE_COOLDOWN_SECONDS) || 60) * 1000;
// VERIFY_ONLY luôn chỉ xác minh; CONFIRMED_SCAN phải đủ xác nhận liên tiếp.
// PAD thất bại hoặc không khớp khuôn mặt sẽ reset chuỗi xác nhận AUTO.
// Trong cooldown sau cả CHECK_IN lẫn CHECK_OUT: không ghi thêm công,
// trả cooldown=true, success=false, door_open=false.
```

Nếu không có lượt hợp lệ trong 24 giờ, lần quét tiếp theo bắt đầu một lượt vào mới. Việc quên quét ra cần quản lý kiểm tra và điều chỉnh; một cảm biến hiện diện không xác định được hướng di chuyển thực tế.

---

## 4. Dữ Liệu Backend Trả Về Cho Pi Edge
Phản hồi JSON của Webhook trả về cho Pi Edge:
```json
{
  "success": true,
  "door_open": true,
  "matched": true,
  "mode": "CHECK_IN", // Hoặc "CHECK_OUT"
  "employee": {
    "id": "emp_uuid",
    "employee_code": "NV001",
    "full_name": "Nguyễn Văn A"
  },
  "similarity": 0.852,
  "message": "Check-in thành công"
}
```

### Cách Pi Edge phản hồi:
- Khi nhận được `door_open: true`:
  - Nếu `mode == "CHECK_IN"`: Servo quay **`0°`** (Mở vào) và Loa phát: *"Chào [Tên], Check-in thành công"*.
  - Nếu `mode == "CHECK_OUT"`: Servo quay **`180°`** (Mở ra) và Loa phát: *"Chào [Tên], Check-out thành công"*.
  - Cửa giữ mở 3s, kiểm tra an toàn bằng cảm biến siêu âm ($\le 50\text{cm}$ giữ tiếp, $> 50\text{cm}$ thì đóng về `90°`), sau đó tự động ngắt xung `servo.angle = None`.
- Khi `door_open: false` (hoặc mặt giả / người lạ):
  - Cửa giữ nguyên ở vị trí đóng **`90°`**, loa phát âm thanh từ chối.

---

## 5. Tự Động Hóa Giờ Làm Thêm (OT - Overtime)
Hệ thống chấm công tự động ghép cặp `(CHECK_IN, CHECK_OUT)`:
- Nhân viên làm việc vượt quá giờ kết thúc ca (ví dụ ca kết thúc lúc 17:00, nhưng 19:30 mới Check-out) $\rightarrow$ Thời gian dôi ra tự động được chuyển thành **Giờ làm thêm (OT)** trong bảng `daily_attendance_summary`.
- Nhân viên làm thêm ca tối riêng (Check-out 17:00, quay lại Check-in 18:30, Check-out 21:30) $\rightarrow$ Cặp `(18:30, 21:30)` tự động được tính trọn vẹn $3.0\text{ giờ}$ OT.

---

## 6. Hướng Dẫn Cấu Hình Khi Chấm Demo
Trong file `backend/.env`:
- Khi chạy thực tế: `ATTENDANCE_COOLDOWN_SECONDS=60`
- Khi chấm demo trước hội đồng: đặt `ATTENDANCE_COOLDOWN_SECONDS=5`
  $\rightarrow$ Cho phép người thuyết trình quét Check-in xong, chỉ 5 giây sau là có thể quét tiếp Check-out để hội đồng thấy ngay cả 2 chiều mở cửa của Servo!
