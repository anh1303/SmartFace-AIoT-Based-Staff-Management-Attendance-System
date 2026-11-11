# Bluetooth, vân tay và đường truyền — 11/11/2026

## HAVIT

HAVIT TW958 PRO trên Pi: 01:08:51:ED:08:B9. HCI báo PIN or Key Missing (0x06), Authentication Failure; kết nối lên rồi rớt. Xóa riêng bond HAVIT và ghép lại đã tạo kết nối ổn định, PipeWire sink HAVIT. Chạy test-audio qua service dự án/ThingsBoard; pw-play trả thành công. Người dùng xác nhận nghe rõ chuông sau lần phát lại. Âm lượng thử giữ 35%, không mute.

Sửa backend bỏ thành công mô phỏng cho connect/reconnect/disconnect/test-audio khi không có ACK thật. Frontend không ép connected=true từ response thất bại. Pi kiểm tra connected hiện tại thay vì chỉ tin chuỗi Connection successful; telemetry tìm thiết bị audio đang kết nối thay vì default bluetoothctl có thể cũ. Khi không có Bluetooth, âm thanh chấm công không tự phát nhầm ra HDMI. Chức năng phát vẫn bất đồng bộ: ACK queued không chứng minh người dùng nghe được, phải xem log pw-play và xác nhận thực tế.

## Vân tay

Hai binding SYNCED, sensor capacity 300, UART ready, roundtrip_verified=true; attendance_enabled=true đã tồn tại trước lượt này. Backend wak_verified=false, polling_fallback=false, error=WAK_UNVERIFIED. Không thay các cờ nghiệm thu để bỏ qua lỗi.

Lần người dùng thử chạm/nhấc: không có touch event trên client; pinctrl GPIO17 LOW, lần quan sát 15 giây không thấy chuyển mức. Đây chưa chứng minh dây/cảm biến WAK hỏng; cần kiểm tra vật lý đúng pin, mức điện áp và thời điểm thao tác.

Dừng client để một chủ sở hữu UART, chạy benchmark chỉ đọc trong 45 giây. Capture ACK=0 có 143 lần, ACK=2 có 2 lần. Ba lần gọi trích đặc trưng đều ACK=7 (quá ít đặc trưng). Không có mẫu match thành công nên chưa đo được latency vân tay đầu-cuối. Không ghi công, không mở cửa, không sửa Flash/template trong benchmark. Sau đó khôi phục client Pi.

Sửa worker: log capture/feature/search/RPC riêng; tìm vùng 0..max verified active slot thay vì toàn capacity; polling tái sử dụng ảnh vừa chụp, không capture hai lần; ưu tiên touch trước refresh manifest định kỳ khi manifest vẫn mới; backend vẫn kiểm tra binding/quyền/health khi ghi công. WAK cần chu kỳ chạm rồi nhấc mới đánh dấu verified. Backend chỉ đọc các trường authorization cần thiết, không tải ciphertext/avatar vào đường kiểm tra binding.

Không khẳng định tối ưu nhanh hơn trên phần cứng vì chưa có match hợp lệ. Bước vật lý: kiểm tra WAK đúng BCM17/GND, đặt phần giữa đầu ngón đủ diện tích, mặt kính sạch, không đổi mức bảo mật hay đăng ký đè để né lỗi. Thử lại UART capture/feature/search trước khi nghiệm thu chấm công.

## Đường trực tiếp và ThingsBoard

5 mẫu từ Pi; HTTP GET /health so với MQTT verify_face chứa unit-invalid vector toàn zero, được backend từ chối trước matching/DB/alerts/writes. Không dùng biometric thật hoặc tạo attendance.

- HTTP health ms: 62.49, 19.26, 16.99, 35.51, 22.06; median 22.06.
- ThingsBoard validation RPC ms: 57.26, 62.76, 31.61, 1076.14, 59.28; median 59.28.

Hai endpoint không giống hoàn toàn; mẫu nhỏ không phải p95 hay full attendance A/B. Độ chênh median khoảng 37 ms gợi ý đường trực tiếp giảm vài chục ms trong trạng thái bình thường; có thể tránh outlier queue/RPC. Không suy ra bỏ ThingsBoard biến 3 giây thành dưới 1 giây vì DB transaction còn chiếm phần lớn.

Kiến trúc đề xuất: Pi gửi request quyết định chấm công qua HTTPS trực tiếp backend; song song gửi telemetry FPS/PAD/device health và kết quả đã được xác nhận cho ThingsBoard. Backend là nơi duy nhất quyết định/lưu attendance; Pi chỉ mở cửa/phát thành công khi ACK commit hợp lệ. Không gửi hai request ghi công độc lập đồng thời qua cả hai đường. Nếu cần fallback, giữ cùng device_id/event_id/payload và có arbitration, timeout, dedup, replay/cooldown/uncertain tests; không fallback bằng event mới. Không đưa vector/template vào telemetry dashboard. Dùng credential riêng từng device, HTTPS khi qua mạng không tin cậy, không dùng webhook secret chung làm credential thiết bị.

Chưa đổi kiến trúc production trong lượt này; yêu cầu là đánh giá và đo. Thay đổi này cần endpoint device-auth riêng và test failure/idempotency trước khi bật.

## Kiểm thử

190 backend tests qua (attendance, fingerprint, Bluetooth, settings, model ownership); build backend và TypeScript frontend qua. Python: 4 Bluetooth status, 3 audio, 16 fingerprint, 4 feedback tests qua. Giữ giới hạn DB integration thiếu helper được ghi ở ATTENDANCE_LATENCY.md. Code Pi có backup hậu tố .bluetooth-fingerprint-backup-20261111.
