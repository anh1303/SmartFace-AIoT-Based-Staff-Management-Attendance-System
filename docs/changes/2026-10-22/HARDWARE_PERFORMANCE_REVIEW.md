# Review các thay đổi giảm tải hardware — 22/10/2026

Phạm vi: `hardware/`, từ bản đồng bộ sáu profile PAD `934c092` đến bản tối ưu hiển thị/TFT. Đây là thay đổi vận hành sản phẩm; không tối ưu lại model hoặc hiệu chỉnh threshold. Chưa có benchmark FPS trên Raspberry Pi cho bản này.

## 1. Các nội dung đã lược bỏ khỏi video/TFT

| Trước đây | Sau thay đổi | Mục đích và ảnh hưởng |
|---|---|---|
| Nhãn `#track_id CHECKING (votes/min_votes)` | `CHECKING`, màu vàng | Bỏ track ID và số vote thay đổi liên tục; cách tích lũy vote giữ nguyên. |
| Nhãn `#track_id SPOOF (pad_score)` | `SPOOF`, màu đỏ | Không format/vẽ điểm PAD trên khuôn mặt. Điểm và threshold vẫn dùng để quyết định và gửi sự kiện. |
| Nhãn `#track_id REAL (pad_score)` | `REAL - UNKNOWN` hoặc `REAL - tên/ID hiển thị đã xác nhận`, màu xanh | Bỏ điểm PAD; giữ cơ chế ổn định/hold danh tính đang có. Không dùng tên đang hiển thị để quyết định ghi công. |
| Khuôn mặt không hợp lệ dễ chỉ hiện đang chờ PAD | `INVALID`, màu cam | Lý do hình học không hợp lệ được ưu tiên hơn tên cũ; đây là thay đổi hiển thị, không thêm gate. Mất track/PAD chưa sẵn sàng hiện `CHECKING`. |
| Các hậu tố `WAIT EMBEDDING`, `QUEUE FULL`, `ERROR <type>`, `STALE`, `READY`, `DA GUI - CHO NGUOI MOI` trong nhãn khuôn mặt | Không còn các hậu tố này | Đơn giản hóa nhãn. Worker/queue/cooldown/latch vẫn hoạt động; queue đầy vẫn không nhận thêm job. Lỗi alignment vẫn reset chuỗi recognition; mất thông tin lỗi chi tiết trên bbox là đánh đổi cần biết khi debug. |
| Header gồm device ID, FPS, khoảng cách siêu âm và nhãn latch dài | Chỉ chế độ check-in/out và `READY`/`WAIT NEXT PERSON`/`SLEEP` | Bỏ số nhảy liên tục. Device ID vẫn có ở log khởi động; telemetry vẫn có FPS, distance, ai_state, latch và mode. |
| Thông báo sleep có ngưỡng/khoảng cách hiện tại | `SLEEP` | Cảm biến và điều kiện thức/ngủ giữ nguyên. |
| Banner lặp `TRACK #...: ĐANG ĐỐI SOÁT RPC...` và `DA NHAN DIEN - CHUA GHI CONG` | Không còn hai banner này | Nhận diện thành công thể hiện qua nhãn REAL/danh tính; không hiển thị xác minh đơn thuần như một kết quả ghi công. Thông báo kết quả điểm danh và lỗi worker/backend còn giữ. |
| FPS trên video | Log `[FPS] ... (average over 10s)` ở terminal | `SHOW_FPS=true` bật log trung bình mỗi khoảng 10 giây; đây là FPS vòng camera xử lý frame thành công, không phải số lần PAD/recognition suy luận mỗi giây hoặc FPS TFT. |

Code: `hardware/edge_client.py`, helper `face_status_label()` và các nhánh render/banner. Các số liệu phục vụ quyết định PAD và RPC không bị xóa.

## 2. Các công việc tính toán/copy đã loại bỏ

| Công việc trước đây | Cách thực hiện mới | Khi nào tiết kiệm |
|---|---|---|
| Camera phải resize/chuyển màu/truyền SPI xong mới xử lý frame kế tiếp | Camera chỉ giao snapshot; worker TFT thực hiện phần còn lại | SPI chậm không chặn vòng camera. Tổng chi phí CPU/SPI vẫn tồn tại. |
| TFT mặc định tối đa 15 FPS | `TFT_DISPLAY_FPS=10` trong code và example/local env; driver clamp 1–10 FPS | Có thể chọn 5 FPS để giảm tải thêm. `.env` cũ còn 15 cũng không vượt 10. Không đổi FPS yêu cầu của camera hoặc stream. |
| Mỗi frame đều có thể đi qua phần vẽ dù chỉ dùng TFT và TFT chưa đến lượt cập nhật | `wants_frame()` quyết định có cần vẽ cho TFT hay không | Khi GUI/stream tắt, frame TFT sẽ bỏ qua không bị copy/vẽ overlay. GUI hoặc stream bật thì vẫn vẽ phục vụ các đầu ra đó. |
| Copy và vẽ frame dù tất cả đầu ra video không hoạt động | Bỏ copy/vẽ khi GUI, stream và TFT đều không cần ảnh | Inference, tracking, telemetry và điểm danh vẫn chạy. |
| Frame gửi TFT có thể phải chờ công việc hiển thị trước | Chỉ một frame đang xử lý và tối đa một frame chờ; mới thay cũ | Không tích hàng đợi gây trễ. Frame chưa đến kỳ gửi bị bỏ trước khi copy; không resize/chuyển màu frame đã bị bỏ. Không cắt ngắn một lượt SPI đang chạy. |
| Hàng đợi stream đầy: copy frame cho lần put thất bại, rồi copy lại khi thay frame cũ | Tạo một snapshot riêng và tái dùng cho lần put thay thế | Tránh copy lần hai khi FFmpeg chưa tiêu thụ kịp; vẫn không chia sẻ buffer camera đang thay đổi. |
| Tạo nền đen và paste ảnh kể cả ảnh đã vừa đúng kích thước màn hình | Trả thẳng ảnh RGB khi đã đúng kích thước | Bỏ một lần cấp phát/copy canvas ở trường hợp không cần letterbox. Khi lệch tỷ lệ vẫn có nền đen như trước. |

Code: `hardware/display/tft_st7789v.py`, `hardware/edge_client.py`, `hardware/streaming/rtsp_streamer.py`.

Producer và worker đều kiểm tra cadence vì hai mục đích khác nhau: producer tránh copy thừa, worker bảo đảm thời điểm gửi thật không vượt giới hạn. Đây không phải hai lần resize hoặc hai lần gửi SPI.

## 3. Thay đổi vòng đời TFT cần review

- Chỉ thêm một thread daemon TFT; không thêm tiến trình hoặc lượt inference model.
- Snapshot riêng bảo đảm worker không đọc frame camera đang bị sửa.
- Resize/chuyển màu/SPI thực hiện ngoài lock hàng đợi; producer không phải lấy lock đang giữ xuyên suốt lượt SPI.
- Cleanup báo dừng, bỏ frame chờ và chờ worker tối đa một giây. Nếu SPI chưa trả về thì main tiếp tục dừng các module khác; worker tự đóng tài nguyên khi driver trả về. Không thể cưỡng bức hủy một lệnh driver đang kẹt bằng Python thread. Nếu tiến trình bị kết thúc trước khi driver trả về, không bảo đảm cleanup phần cứng hoàn tất.
- Render/SPI lỗi: tắt đầu ra TFT, bỏ frame chờ và báo lỗi ở terminal một lần; inference/điểm danh tiếp tục. Khác với trước đây, lỗi không bị nuốt rồi thử lại mỗi frame. Cần khởi động lại client để khởi tạo lại TFT sau lỗi.
- Không thay thứ tự màu RGB/BGR, RGB565, register ST7789V, cấu hình inversion hoặc rotation.

## 4. Các đoạn đã rà nhưng không lược bỏ

- Tracker chuyển gray: `update(..., detector_called=False)` return sớm sang optical flow; không có hai lần chuyển gray do rơi tiếp vào nhánh detector trong cùng lượt update.
- Gate hình học PAD chạy cả giữa hai lượt inference: cần phát hiện face sát mép/landmark hỏng và vô hiệu hóa verdict cũ kịp thời, không đợi đến lần PAD kế tiếp.
- Validate toàn bộ batch PAD trước khi cập nhật vote: ngăn kết quả batch sai/một phần được chấp nhận; không bỏ vì đã validate crop trước đó.
- Kiểm tra track/PAD/mode/generation lúc tạo job, thu kết quả worker và thu phản hồi RPC: trạng thái có thể thay đổi giữa các thời điểm; giữ để chặn kết quả cũ.
- Giới hạn khuôn mặt trước detector matching và sau tracker: hai đầu vào khác nhau; chưa bỏ một trong hai chỉ vì cùng gọi `limit_faces`.
- Temporal votes, số recognition khớp liên tiếp, cooldown, cache danh tính, latch điểm danh và verify/commit RPC giữ nguyên.
- Sáu JSON profile PAD, trọng số model, preprocessing PAD và interval detect/PAD/recognition giữ nguyên. Không đồng bộ thay đổi UI/TFT sang face_auth.
- Không thay codec, độ phân giải hoặc yêu cầu FPS stream/camera; không tự tắt stream hay siêu âm.

## 5. Cấu hình và kiểm tra

```dotenv
# hardware/.env và hardware/.env.example
TFT_DISPLAY_FPS=10
SHOW_FPS=true
```

Đổi `TFT_DISPLAY_FPS=5` nếu cần giảm tải màn hình thêm. Không ghi đè `.env` đang chứa host/token bằng example khi pull code.

Lệnh kiểm tra:

```bash
python3 -m unittest discover -s hardware/validation -v
```

Kết quả trước push: **66 tests pass**. Gồm 7 test TFT (rate, worker, latest-frame, snapshot ownership, SPI kẹt/shutdown, cleanup khi lỗi, RGB565/letterbox), test stream chỉ copy một lần khi queue đầy, nhãn INVALID/SPOOF không lộ danh tính cũ, và kiểm tra recognition/điểm danh/transport/config parity.

Các test TFT dùng màn hình/driver giả; không chạy SPI thật, không đo nhiệt độ, tải CPU hoặc FPS trên Pi. Chưa kết luận mức tăng FPS. Sau pull, so sánh FPS terminal cùng camera, profile PAD, ánh sáng và số người; thử cả stream bật/tắt và TFT 5/10 FPS. Vòng camera có thể nhanh hơn nhưng màn hình vẫn chủ động giới hạn ở mức đã đặt.
