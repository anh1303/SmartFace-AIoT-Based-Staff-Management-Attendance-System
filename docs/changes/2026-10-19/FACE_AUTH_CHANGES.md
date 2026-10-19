# Thay đổi face_auth — Pipeline realtime

Theo yêu cầu cấu hình vận hành:

```dotenv
RECOGNIZE_INTERVAL_SECONDS=1.0
DETECTION_INTERVAL_SECONDS=0.2
PAD_INTERVAL_SECONDS=0.2
```

Đã sửa cả `face_auth/.env` và `face_auth/.env.example`. `config.py` có fallback tương ứng 1,0/0,2/0,2 giây; PAD và detection độc lập với recognition và số phiếu trong cửa sổ PAD. Bỏ mô tả cũ buộc PAD bằng recognition/window.

Đã truy vết `config.py` → tracker → `submit_recognition_step`/vòng PAD/detection trong `app.py`, kiểm tra giá trị import thực tế và chạy 16 test tracker thành công. Các thay đổi đồng bộ bổ sung trong cùng đợt được mô tả dưới đây; artifact nghiên cứu không bị sửa.

Chưa chạy camera bằng cấu hình mới. Cần restart tiến trình để đọc `.env` mới; cadence là lịch chạy cấu hình, không phải kết quả đo FPS/thời gian inference thực tế.

## Cấu hình thống nhất với hardware

`PAD_MIN_VOTES=3`, `PAD_SMOOTH_WINDOW=5` trong cả `.env` và `.env.example`; fallback `config.py` tối thiểu 3. Cửa sổ giữ tối đa 5 verdict gần nhất và dùng tỉ lệ SPOOF 0,6; không yêu cầu 3 REAL liên tiếp. Cả hai file môi trường mặc định chọn `R7_SC_FULL_crop15_runtime_config_casia.json` (FULL, logit 1,6586914). Đổi sang JSON CASIA 100K sẽ chọn đúng ONNX/ngưỡng −4,2998047 tương ứng, không cần sửa code.

Logic `_pad_face_skip_reason` và `update_track_pad` được chuyển nguyên vẹn sang `vision_pipeline.py`; `app.py` import lại, giữ API cho các test/caller. Hardware đóng gói cùng mã để kiểm tra geometry, crop, batch output, vote và reset khi inference lỗi. Không thay định nghĩa mô hình, tensor preprocessing, calibration, checkpoint hoặc notebook nghiên cứu.

Cache centroid của face_auth tiếp tục có TTL 30 giây/ngưỡng cosine 0,65 và kiểm tra track/verification generation; hardware chỉ có cache hiển thị do RPC không cung cấp centroid. Không mở kết nối DB mới cho hardware, không đổi logic ghi điểm danh/backend.

Kiểm chứng: 50 test tracker/worker/display/runtime đạt trên cấu hình FULL hiện chọn; 4 test R7 frozen notebook17 đạt khi chạy với `PAD_RUNTIME_CONFIG_PATH=antispoof/models/R7_SC_100K_crop15_runtime_config.json` như contract nghiên cứu của test. Bộ test R7 này cố ý yêu cầu 100K/gốc, không dùng để khẳng định profile FULL phải có ngưỡng 100K. ONNX FULL/100K và preprocessing đã đối chiếu với hardware trên ảnh tổng hợp; chưa nghiệm thu camera/Pi.

## Ưu tiên threshold thủ công

Cả `hardware/config.py` và `face_auth/config.py` áp dụng thứ tự: threshold được đặt rõ trong môi trường/`.env` → threshold runtime JSON → giá trị dự phòng. `PAD_THRESHOLD_LOGIT` là hiệu hai logits; `PAD_THRESHOLD` là xác suất P(REAL). Đặt một biến thì suy ra biến còn lại; đặt cả hai phải nhất quán. Biến trống/khoảng trắng không ghi đè JSON; giá trị 0 của logit là override hợp lệ. Số không hữu hạn, sai định dạng, xác suất ngoài (0,1) hoặc cặp mâu thuẫn làm startup báo lỗi thay vì âm thầm dùng JSON.

Đã bổ sung hướng dẫn và hai biến trống vào `.env`/`.env.example` của cả hai bản; giữ nguyên ngưỡng mặc định hiện chọn khi không override. `PAD_THRESHOLD_SOURCE` cho biết nguồn đang dùng. Model/hash/crop/màu/gamma, vote và artifact JSON không bị thay đổi. Trên hardware, phép chuyển margin sang điểm liveness truyền RPC cũng dùng threshold hiệu lực này. Biến export của tiến trình ưu tiên hơn `.env`; CLI của face_auth tiếp tục ghi đè cấu hình khi được chỉ định.

Regression test `hardware/validation/test_threshold_override.py` tạo `.env` tạm và import config trong tiến trình mới cho cả hai bản: profile FULL/100K, để trống, logit 0/âm/dương, xác suất, cặp nhất quán/mâu thuẫn, NaN/Infinity/sai định dạng. Predictor ONNX thực tế của cả hai bản được kiểm tra nhận threshold 0 và phân loại đúng ở hai phía ranh giới. Các kiểm tra không sửa `.env` thật hay artifact model/JSON.

Kiểm chứng bổ sung cho override: 6 test threshold mới và 9 test parity đạt; 16 test runtime face_auth đạt. Bốn test legacy trong `tests.test_pad_predictor` không hoàn tất vì thiếu các ONNX MiniFASNetV2SE/MobileNet cũ; không phải lỗi nạp FULL/100K đang chọn. Không tạo artifact thay thế để làm các test legacy này qua.
