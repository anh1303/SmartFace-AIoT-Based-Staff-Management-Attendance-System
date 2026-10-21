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

## Xác nhận check-in/out liên tiếp (20/10)

Dùng chung `ATTENDANCE_STABLE_COUNT=3` cho CHECK_IN và CHECK_OUT; đã cập nhật `.env` và `.env.example` của face_auth, hardware và backend. Không dùng biến mới trùng nghĩa `ATTENDANCE_RECOGNITION_CONFIRMATIONS`. Giá trị trước đây 5 trong face_auth chỉ nằm ở nhánh ghi công đã comment, không phải bộ đếm 5 giây đang áp dụng.

Hardware gửi hai RPC `event_kind=VERIFY_ONLY` để xác minh danh tính mà không ghi công; lần kế tiếp đủ mốc gửi `CONFIRMED_SCAN` với employee ID đã khớp. Mỗi inference có recognition_id riêng, retry giữ nguyên payload/ID. Backend đếm ba lượt khác nhau cho cùng device/mode/event và cùng nhân viên; lần cuối vẫn phải khớp expected_employee_id. UNKNOWN/đổi nhân viên bắt đầu lại; phần trạng thái xác minh tạm có TTL 30 giây, giới hạn 512 phiên và 64 recognition ID/phiên. Restart backend làm mất bộ đếm và yêu cầu xác minh lại, không tự ghi sớm.

Chỉ khi đã xác nhận đủ mới đi vào writer giao dịch/idempotency trước đây. Probe không tạo raw log/summary công; retry lần ghi cuối vẫn dùng event ID/capture cũ để không tạo thêm bản ghi. Bản ghi/cơ chế tính công, lương và dữ liệu Neon không bị sửa bởi các test. Trong face_auth, cùng biến điều khiển trạng thái CONFIRM 1/3 → 2/3 → sẵn sàng; không bật lại Python ghi DB trực tiếp. Số 2 của RECOGNITION_LABEL_CONFIRMATIONS vẫn chỉ ổn định việc đổi tên UI, không quyết định ghi công.

**Triển khai backend và hardware cùng phiên bản.** Backend mới từ chối face RPC kiểu cũ thiếu xác nhận; backend cũ từ chối các event_kind mới thay vì âm thầm ghi probe. Rule Chain phải chuyển nguyên params (event_kind, recognition_id, expected_employee_id) như các trường vector/event ID hiện tại. Chưa triển khai bản này lên server/Pi.

Kiểm chứng: build backend, unit counter/webhook; integration PostgreSQL tạm kiểm tra cả IN và OUT hai lần đầu có zero bản ghi, lần thứ ba thêm đúng một và retry không thêm bản ghi; mô phỏng camera/RPC với Track thật kiểm tra hai probe trước commit cho cả hai mode. Regression runtime/UI/worker tiếp tục đạt. Test database chỉ dùng localhost/policy_check, không dùng Neon; chưa kiểm chứng trên Pi/MQTT thực tế.

Cập nhật mốc xác nhận ngày 20/10: `ATTENDANCE_STABLE_COUNT=4` trong .env/.env.example và giá trị dự phòng của cả ba dịch vụ. Ba lượt đầu chỉ xác minh; lượt thứ tư mới ghi công. Mốc 3 trong mô tả triển khai ban đầu phía trên được thay bằng 4; PAD vẫn tối thiểu 3 phiếu trong cửa sổ 5.

Chốt lại ngày 20/10 theo yêu cầu: `ATTENDANCE_STABLE_COUNT=3` cho cả IN/OUT, đồng bộ .env/.env.example và fallback của face_auth/hardware/backend. Hai lượt đầu chỉ xác minh, lượt thứ ba cùng nhân viên mới ghi công. Giữ reset khi verdict PAD sau vote là SPOOF hoặc mất track; không thay cơ chế PAD vote/thông số model. Face_auth lưu tập track đã thấy ở frame trước để xóa chuỗi xác nhận và tăng verification_generation ngay cả khi danh sách tracked tạm rỗng; nhận lại cùng ID cũng bắt đầu 1/3. Test sau 2 kết quả khớp rồi SPOOF/mất track yêu cầu đủ 3 kết quả mới, không tiếp tục bộ đếm cũ. Face_auth vẫn là demo nhận diện/readiness, không bật lại writer DB trực tiếp.

### Giới hạn mặt và thu ảnh lỗi ánh sáng PAD (2026-10-21)

- `MAX_FACES_PER_FRAME=3` trong `.env`/`.env.example`; chọn tối đa 3 mặt lớn nhất trước tracker và giới hạn lại trước PAD/recognition trên frame optical flow.
- `app_capture.py` dùng nguyên app realtime, thêm C để lưu crop expand native, crop đầu vào model và metadata chưa gán nhãn; thu cả REAL/SPOOF và ảnh PAD không trả kết quả. Không đổi tiền xử lý đang chạy.
- Hướng dẫn thu thập, gán nhãn và ứng viên thuật toán nhẹ: [PAD_LIGHTING_CAPTURE](../../tutorial/face_auth/PAD_LIGHTING_CAPTURE.md).
- Kiểm tra offline face_auth: 38 tests pass; camera/GUI và chất lượng PAD thực tế chưa nghiệm thu.

### Tách file nhãn PAD và metadata (2026-10-21)

- Mỗi phiên capture dùng `labels.json` (tên crop → null/real/fake) và `metadata.json` (tên crop → thông số); không còn tạo JSON riêng từng ảnh.
- Các lần chụp tiếp theo đọc lại labels để giữ nhãn đã gán; ghi JSON qua file tạm rồi replace; JSON sai cú pháp báo lỗi trước khi lưu ảnh.
- Chỉ thay định dạng lưu dữ liệu, không thay model hoặc tiền xử lý PAD.

### Thử nghiệm PAD camera local80 và adaptive threshold (2026-10-21)

- Thêm profile lighting và adaptive threshold tùy chọn trong runtime JSON; profile mặc định không đổi. Gamma LUT được dùng tách khỏi gamma cũ để tránh áp dụng hai lần.
- Track giữ threshold từng crop; face_auth hiển thị đúng d-t; hardware dùng threshold thực khi chuyển liveness sang [0,1] gửi backend.
- Thêm profile portable `R7_SC_FULL_local80_candidate_runtime.json` cho model FULL, crop1.45, gamma0.4, adaptive brightness threshold; env active chưa chuyển, env/example có dòng hướng dẫn.
- Fit toàn bộ44real/36fake theo yêu cầu: clean FA0/FR7, ACER7.95%; đây là kết quả fit, chưa nghiệm thu camera/Pi. JPEG stress vẫn còn fake lọt.
- [Kế hoạch và báo cáo đầy đủ](../../experiments/2026-10-21-pad-domain/RESULTS.md).
- Capture mới lưu frame nguyên bản cho mỗi lượt C và liên kết frame_file, dùng chung giữa nhiều mặt; các capture cũ không bị sửa.

### Công tắc profile adaptive và subset tuning realtime (2026-10-21)

- Thêm `PAD_ADAPTIVE_ENABLED=false` và `PAD_ADAPTIVE_CONFIG_PATH` trong env/example của cả face_auth/hardware. Khi bật, chọn profile adaptive và ưu tiên threshold/crop/gamma trong profile hơn env; khi tắt giữ logic cũ. Profile lỗi không âm thầm fallback.
- Profile mặc định vẫn là local80 thử nghiệm, công tắc để false; có thể trỏ sang adaptive_runtime.json mới sau khi tải và đặt cạnh model ONNX tương ứng. Không tự áp dụng kết quả tuning.
- Notebook23 độc lập: fit15K CelebA Train phân tầng spoof/lighting/brightness, chọn cấu hình bằng subset5K CelebA Test và600LCC evaluation với mean ACER hai miền; C/P3/R7 best.pth. Test labels dùng để chọn tham số theo yêu cầu realtime, không gọi là independent evaluation. Xuất report.md, CSV/JSON/PNG và profile R7 riêng.

### PAD: cấu hình local98 cho vận hành

- `.env` bật `PAD_ADAPTIVE_ENABLED=true` và chọn `R7_SC_FULL_local98_shadow_runtime.json`; `.env.example` trỏ đến profile mới (bật adaptive khi sử dụng).
- Crop 1.45; gamma chuyển mượt 0.40–0.55 theo chênh lệch sáng toàn crop/vùng giữa; Gaussian 3×3 sigma 0.6 trộn 50%. Threshold gốc -2.809873753070831 cộng offset theo độ sáng vùng giữa và chênh lệch với toàn crop, giới hạn ±3. Đo độ sáng trước tiền xử lý. Một lượt PAD mỗi crop.
- Hiệu chỉnh trên toàn bộ 98 ảnh (61 real, 37 fake), không có tập giữ riêng: 0 fake lọt qua, 1 real bị từ chối. Đây là kết quả trên dữ liệu hiệu chỉnh, cần kiểm tra camera thực tế. Giữ profile local80 để quay lại.
