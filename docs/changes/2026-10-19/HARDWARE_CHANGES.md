# Thay đổi code hardware/Pi — 19/10/2026

Code vận hành trong repo hiện tại nằm ở `hardware/`; tên `pi_edge/` là đường dẫn ở các trao đổi/bản triển khai trước. Chỉ cập nhật các file đúng thư mục của bản đang chạy trên Pi, không ghi đè `.env`, model hoặc môi trường Python.

## MQTT RPC và chống ghi trùng

`hardware/iot/thingsboard_client.py`:

- Kiểm tra mã trả về `publish().rc`; không trả request ID thành công nếu MQTT chưa nhận publish.
- Mỗi lượt quét có UUID `event_id` và timestamp capture cố định. Retry gửi lại cùng payload, cùng event ID để backend trả bản ghi đã lưu thay vì tạo lần điểm danh mới.
- Request ID MQTT khởi tạo ngẫu nhiên và nằm trong int32; event UUID là căn cứ tương quan bổ sung. [ThingsBoard MQTT RPC](https://thingsboard.io/docs/reference/mqtt-api/rpc/) quy định request/response theo cùng request ID và schema phản hồi dùng int32.
- Chỉ gọi callback khi request ID còn pending và `event_id` phản hồi khớp. Bỏ phản hồi lạ, phản hồi cũ hoặc nhận hai lần.
- Watchdog kiểm tra hạn: 8 giây/lần, tối đa 3 lượt gửi. Hết hạn trả trạng thái **uncertain**, không tự khẳng định thành công/thất bại ghi DB. Pending được giới hạn trong RAM.
- Dữ liệu vector đúng 512D, hữu hạn, norm khác 0; giữ đúng PAD 0,0 thay vì đổi thành 1,0. Vector tiếp tục gửi bằng RPC Base64 Float32, không đưa vào telemetry Timeseries.

## Latch, mode và phản hồi trên màn hình

`hardware/edge_client.py`:

- Chỉ khóa latch sau publish thành công. Phản hồi không thành công/timeout mở khả năng thử lại theo cooldown.
- Retry của cùng track/lần hiện diện/mode dùng lại event ID và timestamp; backend chống trùng ngay cả khi lần trước đã lưu nhưng phản hồi bị mất.
- Callback MQTT chỉ đưa kết quả vào queue. Vòng camera nhận kết quả sau cập nhật tracking và kiểm tra track, mode, generation mode/lần hiện diện. Kết quả của người/mode cũ không được áp vào người mới.
- Đổi mode reset latch và tạo phạm vi lượt quét mới. Có generation để xử lý cả tình huống IN→OUT→IN nhanh giữa hai frame.
- Dùng track chính ở cổng cho thao tác điểm danh với latch chung; các khuôn mặt khác không tranh callback/latch của người ở cổng.
- PAD score thiếu/0 không bị thay bằng 1,0; cần score hiện tại hợp lệ trước khi gửi điểm danh. Không đổi model, crop, ngưỡng hoặc thông số bỏ phiếu PAD.
- Sự kiện SPOOF được chuyển riêng tới webhook qua RPC, không chứa embedding và không tạo điểm danh; giới hạn báo theo track.
- Sự kiện đã lưu nhưng FLAGGED hiển thị cần kiểm tra, thay vì chỉ báo mọi trường hợp là công hợp lệ.

## Đồng bộ chế độ

- Server/dashboard RPC `setValue`/`getValue` vẫn tương thích boolean CHECK_IN/CHECK_OUT.
- Mode có revision, shared attribute cũ không ghi đè RPC mới trong phiên đang chạy.
- Đổi mode phát telemetry có `mode_changed_at`. Script ThingsBoard bổ sung nhánh **SmartFace Mode Relay** tới webhook backend có secret; backend kiểm tra mode thật rồi lưu Shared Attribute để phục hồi sau restart.
- Shared readback cùng mode không phát lại telemetry relay vô hạn.
- HTTP thông báo trực tiếp chỉ dùng khi có `BACKEND_BASE_URL` và secret, chạy trên daemon thread với timeout. Bỏ URL cứng `http://TB_HOST:3000` và chờ HTTP trong MQTT callback. Khi dùng Rule Chain relay, để direct HTTP trống.

## Camera và RTSP

- Camera không trả frame sẽ báo `CAMERA_ERROR/DEGRADED`; sau 100 lần lỗi liên tiếp thoát lỗi để service có thể restart. Không im lặng quay vòng mãi như đang online.
- Khởi động MQTT sau khi chuẩn bị pipeline/peripheral để tránh nhận phản hồi lúc trạng thái vòng chạy chưa sẵn sàng.
- `hardware/streaming/rtsp_streamer.py`: queue một frame, worker riêng, bỏ frame cũ khi nghẽn. Vòng camera không chờ FFmpeg ghi qua mạng.
- FFmpeg stdin dùng `select`/`os.write`, hạn ghi 2 giây; lỗi/nghẽn sẽ dọn process, đợi 3 giây và thử lại. Process cũ được terminate/wait, cần thì kill/wait trước khi thay mới; stop kết thúc worker và process.

## Kiểm chứng và phạm vi chưa bảo đảm

Đã chạy `py_compile` các file chỉnh sửa và test transport offline: publish lỗi, mất kết nối, payload retry giữ nguyên, phản hồi sai/duplicate, timeout, PAD 0/NaN, vector sai, shared mode cũ, chống vòng relay và sự kiện SPOOF không embedding. Hai test bổ sung dùng OS pipe đầy để xác minh việc gửi frame không chặn vòng camera và process treo được kill/reap; không chạy FFmpeg thật.

**Chưa chạy bản sửa này trên Pi thật.** Chưa kiểm chứng camera USB, TFT ST7789V, HC-SR04, FFmpeg RTSP thật, reboot/systemd, độ trễ mạng và độ chính xác nhận diện/PAD. Không dùng kết quả unit test thay cho nghiệm thu phần cứng.

Pending/retry nằm trong RAM, chưa có hàng đợi bền vững qua mất điện. Timeout nghĩa là kết quả chưa được xác nhận: không hứa gửi thành công khi Pi mất điện/mất mạng lâu. Khi cần bảo đảm lưu ngoại tuyến qua reboot phải thiết kế outbox bền vững và quy trình xử lý timestamp/replay riêng.

## Chu kỳ AI theo cấu hình vận hành

Cập nhật `hardware/.env`, `hardware/.env.example` và tham số/vị trí gọi trong `edge_client.py`: recognition 1,0 giây, detection 0,2 giây, PAD 0,2 giây. Recognition được chặn theo thời gian thật trước align/embedding, gồm khi gửi MQTT lỗi; không chỉ đặt giá trị trong constructor tracker rồi bỏ qua tại vòng lặp. Tham số cadence được log khi khởi động. Không đổi vote window, ngưỡng hay model.
