# Chấm công trực tiếp Pi → backend — 11/11/2026

## Hành vi

- Pi gửi mặt và vân tay tới `POST /api/devices/:id/attendance` bằng Bearer credential riêng từng device trong `EDGE_RECOGNITION_KEYS`. Body device_id phải khớp URL; request hỗ trợ VERIFY_ONLY, CONFIRMED_SCAN, FINGERPRINT_SCAN. Không phụ thuộc cờ remote extraction.
- Endpoint dùng lại `handleThingsBoardWebhook`/writer và transaction hiện có: PAD, matching, confirmations, binding, trạng thái nhân viên, cooldown, event dedup, khóa công/lương, commit trước ACK không đổi. Response loại avatar/payload lớn; no-store; rate limit 120/phút/device.
- MQTT vẫn telemetry, settings, điều khiển Bluetooth/camera. Khi có kết quả direct, Pi publish transport/event_id/accepted/mode để giám sát, không gửi embedding/template hoặc một yêu cầu ghi công thứ hai.
- Client HTTP worker bất đồng bộ, queue tối đa một pending, không chặn camera. Timeout mặc định 8 giây, response tối đa 16 KiB, chặn redirect để không chuyển credential qua host khác.
- Timeout, lỗi HTTP, sai event ID hoặc JSON không hợp lệ trả kết quả uncertain, door_open=false. Coordinator giữ ownership và retry sau 5 giây với cùng body/event/recognition ID. Không fallback song song sang MQTT, không dùng ID mới để né timeout. Phản hồi không rõ không mở cửa/phát thành công.
- HTTP error hiện được coi là uncertain kể cả credential/config sai: thiết bị giữ lượt để đối soát, cần sửa cấu hình nếu lỗi kéo dài; không tự nhả sang danh tính khác. Không có durable queue qua reboot: khi process/reboot trong trạng thái uncertain vẫn phải đối soát log DB. Không cam kết exactly-once delivery; DB event key và guard bảo đảm replay không tạo feedback/row trùng trong phạm vi hiện có.

## Cấu hình và triển khai

`hardware/.env.example` đặt `ATTENDANCE_TRANSPORT=direct`, `ATTENDANCE_HTTP_TIMEOUT_SECONDS=8`. Runtime mặc định khi thiếu biến vẫn thingsboard để tương thích checkout cũ. Đã đặt direct trong `.env` local và Pi; không commit secret. Dùng BACKEND_BASE_URL/DEVICE_ID/EDGE_RECOGNITION_TOKEN hiện có, không dùng webhook secret ThingsBoard cho endpoint direct.

Pi `/home/piuser/test/hardware` đã nhận `iot/direct_attendance.py` và edge_client.py; khởi động bằng `/home/piuser/tflite-env/bin/python`, log `/tmp/smartface-edge-direct.log`. Backup edge và env: `.before-direct`. Backend dev process đã nạp endpoint mới. Rollback: đặt ATTENDANCE_TRANSPORT=thingsboard rồi restart client; không bật hai writer cho cùng lượt. Runtime LAN hiện dùng HTTP theo URL cấu hình hiện có; khi qua mạng không tin cậy phải cấu hình HTTPS để bảo vệ Bearer/biometric. Không triển khai TLS certificate hay đổi network trong patch này.

## Số đo thật

| Lượt | Trước extraction ms | Worker extraction ms | HTTP request/ACK ms | Phiên → ACK ms | Backend ms |
|---|---:|---:|---:|---:|---:|
| 1 | 257,6 | 370,5 | 2.442,4 | 3.281,6 | 2.290 |
| 2 | 285,2 | 366,6 | 1.438,6 | 2.219,6 | 1.316 |
| 3 | 272,0 | 363,0 | 2.186,1 | 2.962,5 | 2.131 |

Ba lượt hợp lệ, không uncertain/retry, pw-play thành công tới HAVIT. Thời gian bắt đầu ở phiên tracking, không phải lúc mặt vật lý vào khung; không phải p95. Backend/DB vẫn chiếm chủ yếu nên không hứa dưới 1 giây. So với outlier ThingsBoard 27,6 giây trước đó, mẫu mới không gặp chờ RPC 12 giây, nhưng 3 mẫu chưa chứng minh loại hết outlier DB/network.

Read-only database kiểm tra mỗi event đúng 1 row, cả 3 VALID. Đã đọc telemetry thật ThingsBoard: attendance_transport=direct, accepted=true, mode=CHECK_IN và FPS mới; không chỉ dựa mock. Vân tay đã nối cùng direct transport và test payload/contract, nhưng test vật lý vẫn bị WAK/feature ACK7 đã ghi ở báo cáo Bluetooth; không tuyên bố vân tay thật đã chấm công thành công.

## Kiểm thử

- Build backend qua; hồi quy 186 test backend trước khi bổ sung thêm 2 case endpoint; các test mới bao gồm sai credential/device, loại event, cooldown denial, service failure và response compact.
- Python: 7 direct transport tests gồm timeout/sai event, snapshot request, bounded queue, redirect, lost ACK sau simulated commit/replay và feedback một lần; 6 camera confirmation tests chạy cả direct và ThingsBoard; 14 worker/camera; 16 fingerprint; 4 feedback.
- Fixture camera ép transport mock rõ ràng để không vô tình dùng URL/token trong `.env` khi kiểm thử offline.
- DB integration suite vẫn thiếu helper `src/__tests__/helpers/cloud-test-db.mjs`; không chạy suite phá dữ liệu trên DB vận hành. Test lost ACK là mô phỏng; không cố tình cắt mạng lúc ghi công thật. Có 3 lượt Pi/camera/DB/âm thanh thật để kiểm tra happy path.

## Trạng thái cuối và sự cố USB độc lập

Sau các lượt đo, kernel ghi USB hub reset/descriptor error -71, camera mất `/dev/video0` rồi đăng ký thành `/dev/video1`. Client dừng đúng nhánh lỗi camera sau 100 lần đọc. Không quy lỗi này cho HTTP transport. Đã khởi động lại bằng override `CAMERA_INDEX=1`; `.env` camera index không bị đổi. Nếu USB đổi node lần nữa, dùng `/dev/v4l/by-id/usb-SunplusIT_Inc_HP_Wide_Vision_FHD_Camera_01.00.00-video-index0` để xác định index thực. Throttled=0x0 trong lần kiểm tra; chưa chứng minh nguyên nhân reset là nguồn/cáp/hub. Cần xử lý vật lý nếu reset lặp lại. Endpoint tests cuối 8/8 qua (tổng coverage backend liên quan 188 test đã qua qua các lần chạy).
