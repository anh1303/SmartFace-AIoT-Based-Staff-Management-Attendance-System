# Đo và giảm độ trễ chấm công — 11/11/2026

## Kết quả đo thật

Pi chạy `/home/piuser/test/hardware/edge_client.py` bằng
`/home/piuser/tflite-env/bin/python`; ArcFace local, 1 inference thread,
PAD interval 0,2 s / tối thiểu 2 phiếu, attendance confirmation count = 1.
Backend dùng Neon PostgreSQL vùng Singapore. Không đổi model, preprocessing,
ngưỡng matching/PAD, số phiếu PAD, cooldown, database hay rule chain.

| Chặng | Trước sửa | Sau sửa, các mẫu đã thu |
|---|---:|---:|
| Backend toàn request hợp lệ | 4.112 ms | 2.119–2.400 ms ở bản cuối |
| Lookup nhân viên trước transaction | 1.044 ms | 104–119 ms |
| Transaction lưu lượt | 2.321 ms | 1.708–1.933 ms |
| INSERT kèm quan hệ | 494–639 ms | 108–117 ms |
| Định dạng phản hồi | 433 ms | 0–2 ms |
| Chuẩn bị âm thanh trên luồng chính | 162,3 ms | 0,5–0,9 ms |

Mẫu cuối trên Pi: trước extraction 274,6 ms, worker extraction 268,1 ms,
RPC khứ hồi 2.511,9 ms, từ bắt đầu phiên track tới ACK 3.118,9 ms.
Đây **không phải** phép đo đầy đủ từ lúc mặt bước vào khung vật lý đến lúc nghe
loa hoặc servo chuyển động. Mốc đầu nằm sau lần tracking quan sát được mặt.
Worker extraction bao gồm thời gian chờ queue; RPC bao gồm xử lý backend.
Không cộng RPC và backend lần nữa.

Backend giảm khoảng 42–48% so với mẫu 4.112 ms, nhưng chưa đạt dưới 1 giây.
Số mẫu ít, khác thời điểm/loại vào-ra; không phải p95 hoặc kết quả benchmark tải.

Lượt trước sửa còn có một matching read kéo dài 17.952 ms và retry RPC;
Pi nhận ACK sau khoảng 29 giây. Phép đo chỉ khoanh vùng ở thao tác DB qua Prisma,
chưa tách được cold query-engine/type setup, mở connection, pool wait hay lỗi
mạng cloud. Không khẳng định đã chứng minh nguyên nhân chính xác của outlier này.
Các lượt sau sửa không retry trong mẫu đã quan sát.

## Những gì đã sửa

- Lookup phục vụ ghi công từ edge chỉ chọn identity/status cần thiết, không tải
  toàn bộ phòng ban, chức vụ, tài khoản, lịch ca và thông tin sinh trắc học.
- Tái sử dụng kiểm tra ngày/kỳ đã đọc trong cùng transaction và các khóa đang giữ;
  ngày/kỳ khác vẫn được kiểm tra. Không cache quyền mở cửa qua các request.
- Tái sử dụng lịch ca trong transaction để format lượt edge mới, giữ cách lọc
  ngày và tính punctuality. Luồng web đồng bộ và replay vẫn có đường đọc lịch riêng.
- INSERT edge không truy vấn lại quan hệ employee/department/position; payload web
  giữ tên, mã, user ID và avatar từ employee snapshot vừa được đọc trong transaction.
- Làm nóng truy vấn matching bằng unit vector tổng hợp trước khi API nhận request.
  Đây là read-only, không tạo chấm công. Log startup cho biết thời gian warmup.
- Dò Bluetooth/định tuyến/phát âm thanh chạy ngoài luồng camera và điều khiển gate.
  Chỉ xếp âm thanh sau ACK hợp lệ và qua feedback dedup guard.
- Phản hồi không cấp quyền từ verification generation cũ không được cập nhật danh
  tính lên track mới. ACK thành công đã commit vẫn được tiếp nhận khi track mất tạm.
- Pi xử lý SIGINT/SIGTERM qua cleanup, kể cả khi chạy bằng nohup.
- `run.sh` nhận `FACE_AUTH_PYTHON` override và tìm cả venv ở gốc dự án; kiểm tra
  dependency trước khi khởi động nhóm dịch vụ, khắc phục lỗi thiếu uvicorn trước đó.

## Phép đo và vận hành

Đặt `ATTENDANCE_PERF_LOG=true` trong environment khi khởi động backend/Pi để bật log.
Backend ghi stage duration và tên/thời gian Prisma operation, không ghi SQL,
embedding, tên nhân viên hoặc credentials vào timing log. Pi ghi thời gian theo
monotonic clock, bounded timing map 32 event. Timing scope reset khi phiên đổi.

Bằng chứng số đo đã loại thông tin nhân viên:
[`attendance-latency-evidence.json`](attendance-latency-evidence.json).
Log runtime của lần điều tra trên máy phát triển nằm ở `/tmp/smartface-backend-latency.log`;
Pi dùng `/tmp/smartface-edge.log` ở bản đang chạy. `/tmp` không phải nơi lưu trữ lâu dài.
Code Pi trước sửa được sao lưu với hậu tố `.latency-backup-20261111` ở cạnh file.

Đã triển khai code edge/audio lên Pi và khởi động backend bản mới.
Frontend chạy bằng `npm run dev` thông thường: root và transform App.tsx đều HTTP 200;
backend `/health` thành công, Face Auth `/health` trả `ready`.

## Kiểm chứng và giới hạn

- Backend build qua; 168 test unit chấm công/architecture qua.
- Python: 14 test worker/camera, 5 test confirmation flow, 13 test transport,
  4 test feedback authorization/dedup, 2 test audio không chặn qua.
- Sửa fixture camera cũ thiếu `recognized_once`, mock đầy đủ peripheral để test
  không mở thiết bị/mạng, và cập nhật test camera-off theo hành vi camera toggle
  hiện tại. Không dùng test giả lập để thay thế kết quả quét trên Pi.
- Kiểm tra read-only DB: bốn event quét thật có đúng bốn row, mỗi event một row,
  trạng thái VALID; retry của event đầu không tạo row thứ hai. Không xóa/sửa các
  lượt quét thật này.
- Tám suite DB integration hiện không load được vì import helper không tồn tại
  `src/__tests__/helpers/cloud-test-db.mjs`. Chưa chạy chúng trên DB test cô lập;
  không chạy suite ghi/xóa dữ liệu trên DB vận hành để né thiếu helper.
- Độ trễ còn lại chủ yếu là transaction với các roundtrip cloud khoảng 60–140 ms
  mỗi thao tác trong mẫu. Cần benchmark nhiều mẫu hơn và cân nhắc đặt backend gần
  DB hoặc gom thêm truy vấn có kiểm chứng concurrency nếu yêu cầu dưới 1 giây.
  Không đạt mục tiêu đó bằng cách mở cửa trước commit hoặc bỏ kiểm tra công/lương.
