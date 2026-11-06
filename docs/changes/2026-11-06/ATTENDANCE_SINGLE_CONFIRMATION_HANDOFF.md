# Điểm danh một lần xác nhận — bàn giao 06/11/2026

## Thay đổi đã thực hiện

- Chọn `ATTENDANCE_STABLE_COUNT=1` trong ba `.env.example` và ba `.env` runtime trên máy hiện tại.
- Pi gửi `CONFIRMED_SCAN` ngay sau lượt trích xuất hợp lệ đầu tiên. Trước đây, thiếu danh tính từ lượt VERIFY_ONLY đầu khiến count=1 vẫn cần hai RPC.
- Với server count=1, backend cho phép thiếu `expected_employee_id` và tự xác định nhân viên từ embedding. Nếu client có gửi danh tính dự kiến, danh tính đó vẫn phải khớp. Với count>1, danh tính dự kiến vẫn bắt buộc và số lần xác minh vẫn được kiểm tra.
- Giữ PAD, ngưỡng matching, transaction ghi công, event ID chống trùng, ngày/kỳ lương đã khóa và các điều kiện từ chối mở cửa.
- Fallback khi không khai báo biến vẫn là 3; muốn chạy một lần phải khai báo rõ count=1.
- Phần tổng hợp công vẫn được chờ đồng bộ trước khi trả thành công. Chưa triển khai worker nền hoặc thay truy vấn matcher bằng truy vấn gộp.

## Ước lượng thời gian từ đưa mặt đến báo thành công

Với cùng một người, PAD đạt yêu cầu, phiên liên tục và không retry:

```text
Trước (count=2): PAD → ArcFace 1 → VERIFY_ONLY RPC → ArcFace 2 → CONFIRMED_SCAN RPC → lưu và tổng hợp công → thành công
Sau   (count=1): PAD → ArcFace 1 → CONFIRMED_SCAN RPC → lưu và tổng hợp công → thành công

Thời gian tiết kiệm ≈ một lần ArcFace + một RPC VERIFY_ONLY
```

Đo read-only từ máy phát triển tới Neon ngày 06/11: `SELECT 1` sau khi nóng 49–72 ms; `findBestFaceMatch` sau khi nóng 595–659 ms và thực thi 10 câu SQL. Truy vấn gộp thử nghiệm thực thi 1 SQL trong 103–113 ms sau khi nóng, nhưng chưa được đưa vào code production. Mẫu nhỏ, không phải p95 hoặc phép đo toàn tuyến Pi.

Nếu giả định ArcFace trên Pi mất 0,3–1,0 giây và phần vận chuyển/xử lý ThingsBoard ngoài matching mất 0,1–0,3 giây, tiết kiệm dự kiến khoảng **1,0–2,0 giây/lượt** (0,3–1,0 + 0,1–0,3 + 0,595–0,659). Hai khoảng giả định này chưa được đo trên Pi hiện tại. Ví dụ nếu lượt cũ đo thực tế 5 giây, ước lượng sau thay đổi là khoảng 3–4 giây trong cùng điều kiện. Không suy ra tổng thời gian mới luôn đạt 2–3 giây.

Không tính cooldown 5 giây là thời gian được loại bỏ: code đã reset `last_scan_sent` và `last_recognition_time` sau VERIFY_ONLY hợp lệ. Timestamp DB so với timestamp capture cũng không đo được toàn bộ PAD/commit/tổng hợp và phụ thuộc đồng hồ thiết bị.

Để đo thật: lấy ít nhất 20 lượt CHECK_IN/CHECK_OUT trong phiên hoạt động, ghi thời điểm mặt vào khung và thời điểm nhận ACK thành công; tách trường hợp khởi động lạnh, mất track và retry. Log `extraction=...s` hiện có cho biết chi phí ArcFace. Chưa chạy camera/Pi hoặc tạo lượt chấm công giả để kiểm tra lần này.

## Các file bị ignore cần đồng bộ riêng

| File | Thay đổi local | Teammate cần làm |
|---|---|---|
| `backend/.env` | Count từ 2 xuống 1; DATABASE_URL và DIRECT_URL chuyển sang Neon mới | Đặt count=1; lấy hai URL Neon qua kênh riêng |
| `face_auth/.env` | Count từ 2 xuống 1; DATABASE_URL chuyển sang Neon mới | Đặt count=1; lấy DATABASE_URL qua kênh riêng |
| `hardware/.env` | Count từ 2 xuống 1 | Đặt count=1 trên Pi thật |

Các file này không được đưa lên Git; pull không thay đổi `.env` đã có. Không chép lại toàn bộ `.env.example` đè cấu hình thiết bị. `pi_edge/.env` và `.env.compose` không thay đổi trong công việc này. Các URL có mật khẩu không nằm trong tài liệu này.

## Thứ tự triển khai

1. Pull code và đặt count=1 trên backend; cập nhật URL Neon đúng môi trường. Build/recreate backend để nạp code và env mới. Backend count=1 vẫn nhận client cũ gửi VERIFY_ONLY rồi CONFIRMED_SCAN.
2. Cập nhật/restart Face Auth để nạp URL Neon mới nếu service đang dùng cấu hình cũ.
3. Pull code trên Pi, đặt `hardware/.env` count=1 rồi restart edge client. Pi count=1 gửi trước khi backend cập nhật sẽ bị server nhiều-lượt từ chối vì thiếu expected identity.
4. Xác nhận lần đầu gửi CONFIRMED_SCAN, nhận ACK thành công và có đúng một lượt DB. Retry cùng event ID không tạo thêm lượt.

## Kiểm tra và giới hạn

- TypeScript `tsc --noEmit` qua.
- Tích hợp trên `origin/main` tại `e9a10d1`, giữ luồng AUTO/cooldown và các cập nhật thiết bị mới của teammate.
- 74 test backend qua trên 9 file: devices/gateway, count 1/2/3, AUTO/cooldown, chống trùng và attendance.security; riêng test modeNotify có sẵn được ghi nhận lỗi rồi loại khỏi lần chạy xác nhận cuối.
- 16 test offline hardware qua: 5 test camera/RPC kiểm tra count 1/2/3 trong cả hai mode và reset khi mất track/PAD; 11 test transport kiểm tra retry, payload không đổi, AUTO, timeout và response lệch phiên.
- Một test có sẵn về `modeNotify` trong webhook-validation đang lỗi: endpoint cho phép thiếu secret khi biến secret không cấu hình, khác kỳ vọng test. Các source xác thực mode không thay đổi trong patch này.
- Chưa triển khai code/restart service trên Pi hoặc server đang vận hành; commit/push không tự triển khai.

Ưu tiên tối ưu tiếp: phản hồi sau durable commit kèm hàng đợi tổng hợp bền vững; gộp matcher 10→1 SQL; giảm truy vấn lặp và thời gian giữ khóa kỳ lương. Đo lại toàn tuyến sau mỗi bước.
