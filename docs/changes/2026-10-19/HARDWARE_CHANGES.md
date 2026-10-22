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
- PAD score thiếu/0 không bị thay bằng 1,0; cần score hiện tại hợp lệ trước khi gửi điểm danh. Model, crop, ngưỡng và thông số PAD dùng profile đồng bộ ở phần cuối tài liệu.
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

Cập nhật `hardware/.env`, `hardware/.env.example` và tham số/vị trí gọi trong `edge_client.py`: recognition 1,0 giây, detection 0,2 giây, PAD 0,2 giây. Recognition được chặn theo thời gian thật trước khi gửi crop vào worker, gồm khi gửi MQTT lỗi; không chỉ đặt giá trị trong constructor tracker rồi bỏ qua tại vòng lặp. Tham số cadence được log khi khởi động. Cấu hình model/vote/ngưỡng được đồng bộ theo runtime JSON ở phần cuối tài liệu.

## Recognition chạy trên worker riêng

`hardware/recognition/worker.py` tách ArcFace khỏi vòng đọc camera theo cơ chế producer/consumer của realtime `face_auth`. Vòng camera giữ detect, tracking, PAD và căn chỉnh ảnh; chỉ gửi bản sao crop vào queue. Một worker duy nhất chạy `FaceEmbedder.extract()`. Queue chứa tối đa hai yêu cầu chờ và tổng số công việc chưa thu kết quả không quá ba, kể cả công việc đã hủy; không tích lũy frame theo độ trễ inference.

Vòng camera nhận embedding rồi gửi RPC bất đồng bộ; backend tiếp tục đối sánh và ghi điểm danh. Không thêm DB/cache danh tính trên Pi. Cadence giữ 1,0/0,2/0,2 giây; model/PAD được đồng bộ theo profile ở phần dưới.

- Mỗi công việc gắn track ID, mode, generation mode và generation hiện diện. Mất track/PAD, lỗi inference PAD, ngủ hoặc lỗi camera hủy công việc đang chờ; kết quả đã hủy không được phục hồi khi track/PAD quay lại. Mode IN→OUT→IN vẫn vô hiệu hóa công việc của generation cũ.
- Chỉ vòng camera cập nhật track, latch và gửi RPC. Worker không sửa trạng thái điểm danh. Latch vẫn chỉ khóa khi publish thành công; event ID/timestamp tiếp tục ổn định cho retry sau khi đã thử gửi RPC.
- Màn hình phân biệt `WAIT EMBEDDING`, `QUEUE FULL` và lỗi recognition. Lỗi ArcFace/vector không hợp lệ không gửi RPC và không khóa latch; có thể thử lại theo interval. Shutdown hủy job và chờ worker tối đa hai giây; không ép ngắt một lệnh ONNX đang chạy.
- Kiểm thử offline: 34 test hardware đạt, gồm 22 test mới về worker và tích hợp vòng camera. Embedder mô phỏng bị chặn có chủ đích trong khi camera vẫn đọc/xuất frame; kiểm tra bỏ kết quả cũ sau đổi người/mode, mất PAD/track, giới hạn queue, copy crop, lỗi vector và dọn worker. Các test transport/RTSP trước đó tiếp tục đạt. Chưa đo FPS/CPU trên Pi hoặc chạy camera/model thật cho bản worker này.

Chạy kiểm tra từ thư mục gốc dự án:

```bash
python3 -m unittest discover -s hardware/validation -v
```

## Đồng bộ cấu hình và pipeline CV với face_auth

- `PAD_MIN_VOTES=3`, `PAD_SMOOTH_WINDOW=5` trong `.env`/`.env.example` của cả hai bản; fallback config tối thiểu 3. Giữ tỉ lệ SPOOF 0,6 và stale timeout 3 giây.
- Copy nguyên byte ONNX FULL/100K và bốn runtime JSON gốc/CASIA vào `hardware/models`; SHA256 đối chiếu với nguồn. Mặc định cả hai bản chọn FULL CASIA (logit 1,6586914); chọn 100K CASIA tự dùng logit −4,2998047. Không sửa artifact hoặc hiệu chuẩn lại ngưỡng.
- Hardware có `config.py` riêng chỉ chứa cấu hình CV, không chứa DB/điểm danh. Runtime JSON ưu tiên cho model/preprocessing và kiểm tra hash; riêng threshold thủ công trong `.env` ưu tiên hơn JSON. Hardware tự chạy độc lập, không import thư mục face_auth.
- Trích `update_track_pad`/kiểm tra chất lượng khuôn mặt ra `vision_pipeline.py` trong face_auth rồi đóng gói bản giống hệt sang hardware. Predictor, loader, crop/preprocessing PAD, alignment và YuNet cũng dùng cùng logic. Lỗi PAD/geometry/batch NaN xóa toàn bộ vote đang dùng và tăng phiên xác minh.
- SCRFD dùng input 640×640, confidence 0,5, mặt tối thiểu 60 px; YuNet dùng cùng lọc mặt/margin/NMS. Bỏ fallback âm thầm từ SCRFD sang YuNet. Chọn backend sai hoặc lỗi khởi tạo phải báo lỗi.
- Recognition queue 2; ONNX ArcFace một thread, inter-op 1, tắt spinning. Input inference là ảnh chưa vẽ bbox/chữ. Job/response gắn `verification_generation` bên cạnh track, mode và phiên hiện diện; kiểm tra cả callback RPC.
- Cache hardware dùng embedding tham chiếu đã được backend xác nhận, chỉ cho hiển thị; không phải centroid cache và không bỏ xác minh backend. TTL 30 giây, cosine tối thiểu max(MATCH_THRESHOLD, 0,65), tối đa 128 entry, reset phiên/không khớp/hết TTL xóa cache. Giữ chính sách xác nhận nhãn 2 lần, UNKNOWN 3 lần, hold 1,5 giây. Không thay truy vấn/threshold backend, DB hoặc nghiệp vụ ghi điểm danh.
- Đã chạy ONNX thật trên ảnh tổng hợp cho cả FULL/100K: hai runtime cho cùng margin/verdict, crop và alignment giống nhau. ArcFace ONNX của hardware khớp wrapper InsightFace trên cùng crop tổng hợp. Đây là kiểm tra tương đương runtime, không phải độ chính xác camera/Pi.
- Máy kiểm tra thiếu FFmpeg: `check_runtime.py` với stream bật báo thiếu FFmpeg; chạy `STREAM_ENABLED=false python3 hardware/check_runtime.py` thì phần AI đạt. Không đổi `.env` để che thiếu dependency; stream thật vẫn chưa nghiệm thu.

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

Bổ sung reset chuỗi xác nhận khi PAD đã kết luận SPOOF, mất track (kể cả cả danh sách tracked rỗng), camera lỗi hoặc AI ngủ. Vòng camera giữ tham chiếu các track đủ điều kiện của frame trước để tăng verification_generation và xóa recognition khi chúng biến mất; giữ nguyên cửa sổ PAD để vẫn hiển thị SPOOF. Khi trở lại cùng track ID, scan scope/event ID mới bắt đầu từ 1/4; callback/job cũ bị loại. Không thay threshold, số vote hay interval. Test camera/RPC với Track thật xác nhận chuỗi A1,A2,SPOOF/mất track,A1,A2,A3,A4 chỉ commit ở lượt cuối, cho cả IN/OUT. Toàn bộ 43 test hardware đạt; chưa nghiệm thu bản sửa trên Pi thật.

Chốt lại ngày 20/10 theo yêu cầu: `ATTENDANCE_STABLE_COUNT=3` cho cả IN/OUT, đồng bộ .env/.env.example và fallback của face_auth/hardware/backend. Hai lượt đầu chỉ xác minh, lượt thứ ba cùng nhân viên mới ghi công. Giữ reset khi verdict PAD sau vote là SPOOF hoặc mất track; không thay cơ chế PAD vote/thông số model. Face_auth lưu tập track đã thấy ở frame trước để xóa chuỗi xác nhận và tăng verification_generation ngay cả khi danh sách tracked tạm rỗng; nhận lại cùng ID cũng bắt đầu 1/3. Test sau 2 kết quả khớp rồi SPOOF/mất track yêu cầu đủ 3 kết quả mới, không tiếp tục bộ đếm cũ. Face_auth vẫn là demo nhận diện/readiness, không bật lại writer DB trực tiếp.

### Đồng bộ giới hạn mặt (2026-10-21)

- `MAX_FACES_PER_FRAME=3` trong `.env`/`.env.example`, đọc qua config chung; giá trị phải >=1.
- Cùng quy tắc chọn 3 mặt lớn nhất với face_auth, giới hạn trước tracker và trước PAD/recognition; detector vẫn quét toàn khung.
- Helper crop MiniFASNet hỗ trợ lấy crop native bằng kích thước None phục vụ thu ảnh; đường inference truyền kích thước model vẫn giữ nguyên.
- Hardware validation: 44 tests pass; chưa đo FPS hoặc chạy camera trên Pi.

### Thử nghiệm PAD camera local80 và adaptive threshold (2026-10-21)

- Thêm profile lighting và adaptive threshold tùy chọn trong runtime JSON; profile mặc định không đổi. Gamma LUT được dùng tách khỏi gamma cũ để tránh áp dụng hai lần.
- Track giữ threshold từng crop; face_auth hiển thị đúng d-t; hardware dùng threshold thực khi chuyển liveness sang [0,1] gửi backend.
- Thêm profile portable `R7_SC_FULL_local80_candidate_runtime.json` cho model FULL, crop1.45, gamma0.4, adaptive brightness threshold; env active chưa chuyển, env/example có dòng hướng dẫn.
- Fit toàn bộ44real/36fake theo yêu cầu: clean FA0/FR7, ACER7.95%; đây là kết quả fit, chưa nghiệm thu camera/Pi. JPEG stress vẫn còn fake lọt.
- [Kế hoạch và báo cáo đầy đủ](../../experiments/2026-10-21-pad-domain/RESULTS.md).

### Công tắc profile adaptive và subset tuning realtime (2026-10-21)

- Thêm `PAD_ADAPTIVE_ENABLED=false` và `PAD_ADAPTIVE_CONFIG_PATH` trong env/example của cả face_auth/hardware. Khi bật, chọn profile adaptive và ưu tiên threshold/crop/gamma trong profile hơn env; khi tắt giữ logic cũ. Profile lỗi không âm thầm fallback.
- Profile mặc định vẫn là local80 thử nghiệm, công tắc để false; có thể trỏ sang adaptive_runtime.json mới sau khi tải và đặt cạnh model ONNX tương ứng. Không tự áp dụng kết quả tuning.

### PAD: cấu hình local98 cho vận hành

- `.env` bật `PAD_ADAPTIVE_ENABLED=true` và chọn `R7_SC_FULL_local98_shadow_runtime.json`; `.env.example` trỏ đến profile mới (bật adaptive khi sử dụng).
- Crop 1.45; gamma chuyển mượt 0.40–0.55 theo chênh lệch sáng toàn crop/vùng giữa; Gaussian 3×3 sigma 0.6 trộn 50%. Threshold gốc -2.809873753070831 cộng offset theo độ sáng vùng giữa và chênh lệch với toàn crop, giới hạn ±3. Đo độ sáng trước tiền xử lý. Một lượt PAD mỗi crop.
- Hiệu chỉnh trên toàn bộ 98 ảnh (61 real, 37 fake), không có tập giữ riêng: 0 fake lọt qua, 1 real bị từ chối. Đây là kết quả trên dữ liệu hiệu chỉnh, cần kiểm tra camera thực tế. Giữ profile local80 để quay lại.

### PAD: profile local842 từ ảnh camera đã làm sạch

- Thêm `wb_gamma` và `wb_exposure_gamma`: cân bằng màu giới hạn gain, gamma LUT cố định hoặc chuẩn hoá độ sáng vùng giữa. Một lượt PAD/crop; các profile trước giữ hành vi cũ.
- Lưu `R7_SC_FULL_local842_real_runtime.json` (crop1.2, 0 fake lọt/35 real bị chặn) và `R7_SC_FULL_local842_balanced_runtime.json` (crop1.1, 2 fake lọt/16 real bị chặn), cùng comment chọn profile trong `.env.example`; chưa đổi profile active.
- Hiệu chỉnh trên toàn bộ842 ảnh camera, 605real/237fake, sau khi người dùng yêu cầu xoá16crop không qua gate hình học vốn có. Không có holdout. Synthetic bbox/JPEG còn gây fake lọt, nên đây là ứng viên hiệu chỉnh miền cần test camera, không phải bảo đảm chống spoof tổng quát.
- Cả face_auth/hardware đã replay đủ842crop bằng config/predictor thực, xác nhận các số trên. Test whitebalance/exposuregamma xác minh parity, ảnh nguồn không bị sửa và validation tham số.

### Phiên hiệu chỉnh Pi cuối — 2026-10-22

- Thêm adaptive threshold `raw_color`, dùng Y/Cb/Cr của ảnh raw trước lighting, offset giới hạn; các profile cũ giữ nguyên hành vi. OpenCV dùng thứ tự Y,Cr,Cb; kiểm tra kênh và parity bằng test riêng. Không thêm model forward hoặc quality gate.
- Lưu `R7_SC_FULL_pi_final_conservative_runtime.json` (crop1.7, 0fake/28real bị chặn) và `R7_SC_FULL_pi_final_balanced_runtime.json` (crop2.2, 1fake/1real bị chặn) trên cùng682ảnh cóframegốc=426real+256fake. Cảhai đạt0/0 trên40real+254fake Pi mới hợp lệ. Đây là dữ liệu đã dùng hiệu chỉnh, không cóholdout.
- Thêm `R7_SC_FULL_pi_final_common_runtime.json` (crop1.2, 0fake/76real bị chặn), kiểmtra đủ1136ảnh hợp lệ=645real+491fake; Pi mới0/1. 454ảnh không cònframe không được tính vào kết quả crop rộng. Ba ảnh mới không qua gate hình học được giữ nhưng loại khỏi hiệu chỉnh.
- Cảhai runtime đã replay đủ ảnh qua config/predictor thật, xác nhận các số trên. Syntheticbbox/JPEG còn fake lọt; không coi kết quả calibration là bảođảm vận hành. Chưa đo FPS/camera live trênPi.
- `.env.example` có dòng chọn cả3profile ở dạngcomment; activeprofile giữ nguyên. Model, detector/recognition,tracking,vote,attendance không đổi. Artifact/script hiệu chỉnh được gitignore; JSONruntime vàtests vẫn versionable.

### Chốt profile trên toàn tập — vòng 2, 2026-10-22

- Tối ưu đủ1.136ảnh hợp lệ (645real/491fake); 454ảnh không cóframe gốc giới hạn crop tối đa1.5. Giữ nguyên dữ liệu và model, không thêm forward hoặc sửa pipeline.
- Lưu ba `R7_SC_FULL_pi_all1136_{strict,balanced,real}_runtime.json` đồng bộ hai phía: strict crop1.2=0FA/76FR; balanced crop1.1=2FA/49FR; real crop1.2=4FA/31FR. Pi mới lần lượt0FA/1FR,0FA/2FR,0FA/2FR trên40real/254fake.
- Đây là lựa chọn test mới thay thế profile rộng crop1.7/2.2; khi replay toàn tập với crop lưu trữ giới hạn1.5, profile rộng cũ cho10FA/29FR và26FA/1FR. Không dùng kết quả subset682 để khẳng định toàn tập.
- `.env` và `.env.example` thêm comment chọn cả3profile; giữ nguyên activevalues. Khuyến nghị test balanced trước. Runtime config/predictor cảhai phía xác nhận cùng kết quả từngảnh, test priority và raw-color đều pass. Artifact/scripts search được gitignore; profile JSON có thểtrack.
- Không có holdout. Brightness/bbox stress cònfake lọt; chưa đoPi FPS hoặc kiểm chứng camera/góc khung hình trực tiếp. Chi tiết và rawoutputs ở `face_auth/output/pad_domain/2026-10-22_final_pi/round2/`.

- Đồng bộ bản chia sẻ: `.env.example` mặc định bật adaptive và chọn `pi_all1136_balanced`; giữ `strict`/`real` dạng comment, đánh dấu profile vòng 1 là bản đối chiếu. `.env` riêng đang chạy không thay đổi.
- Kiểm tra trước push: 55 tests hardware và 3 tests capture pass; smoke nạp balanced từ `.env.example` chạy ONNX thành công ở cảhai phía. Bốn test predictor legacy không chạy vì thiếu artifact model E1/MiniFASNet cũ; không phải model R7 FULL của profile mới.

### Rút gọn hiển thị hardware — 2026-10-22

- Nhãn khuôn mặt chỉ còn `REAL - UNKNOWN`/tên hoặc ID đã xác nhận, `SPOOF`, `CHECKING`, `INVALID`. Bỏ số PAD/vote/track, workerqueue và latency khỏi nhãn. INVALID ưu tiên trước nhãn cũ để không hiển thị danh tính khi crop không hợp lệ. Giữ nguyên temporal verdict, display identity hold, nhận diện và điều kiện điểm danh.
- Header giữ chế độ check-in/out và trạng thái ready/chờ người tiếp theo/sleep; bỏ FPS/khoảng cách. Bỏ banner đối soát RPC lặp lại, giữ thông báo kết quả điểm danh/lỗi.
- `SHOW_FPS=true` trong `.env`/`.env.example` hardware in FPS trung bình ở terminal mỗi10giây; telemetry vẫn gửi FPS/khoảng cách. Không thêm log mỗiframe.
- Khi GUI, stream và TFT đều tắt/không hoạt động, bỏ copy/vẽ frame; inference và RPC vẫn chạy. Không đổi model/profile, interval, độ phân giải camera hay driver TFT/stream. Chưa đo FPS trên Pi; rút gọn overlay không phải bảo đảm tăng FPS cụ thể.

### Worker TFT và loại bỏ xử lý thừa — 2026-10-22

- TFT có một worker chuyên resize/chuyển màu/đóng gói RGB565/gửi SPI; vòng camera chỉ giao snapshot riêng. Tối đa một frame đang xử lý và một frame chờ mới nhất, không tích hàng đợi. Giới hạn mặc định10FPS trong code/`.env`/`.env.example`; có thể chọn5FPS. Driver clamp1–10FPS, nên `.env` cũ15FPS cũng không vượt10.
- Chỉ copy frame cho TFT khi đến lượt cập nhật; worker cũng giới hạn thời điểm gửi. Khi TFT là đầu ra duy nhất, vòng camera bỏ copy/vẽ overlay trên frame TFT không nhận. Nếu mọi đầu ra tắt thì bỏ copy/vẽ toàn bộ, inference/RPC vẫn hoạt động.
- Cleanup chờ tối đa1giây, không đóng SPI đồng thời với worker đang ghi. Nếu driver bị kẹt thì main không chờ vô hạn, worker daemon tự đóng tài nguyên khi driver trả về. Lỗi render/SPI tắt TFT và báo một lần. Không thay register/màu/rotation của ST7789V.
- Loại bỏ copy frame lần2 khi queue stream đầy: tái dùng snapshot riêng đã tạo. Bỏ tạo/paste canvas letterbox khi ảnh resize đã đúng kích thước TFT. Không thay codec/resolution/FPS của stream hoặc camera.
- Rà tracker: nhánh opticalflow return sớm, không có chuyển gray hai lần trong cùng lượt update. Giữ các gate hình học mỗi frame, atomic batch validation và kiểm tra track/PAD/mode/generation lúc thu worker/RPC: các lần kiểm tra này bảo vệ khỏi kết quả cũ, không phải phép tính dư có thể bỏ. Không sửa model/profile PAD hoặc logic xác nhận điểm danh.
- Kiểm tra: 66 tests hardware pass, gồm7 test TFT về thread riêng, latestframe, giới hạnFPS, snapshot ownership, shutdown khi SPIkẹt, cleanup sau lỗi và RGB565/letterbox; thêmtest stream queuefull chỉcopy1lần. Đây là mock/offline, chưa đo FPS hoặc SPI/camera trực tiếp trên Pi.

- Bản review đầy đủ các nội dung đã lược bỏ/giữ lại, thay đổi vòng đời TFT và giới hạn kiểm thử: [HARDWARE_PERFORMANCE_REVIEW.md](../2026-10-22/HARDWARE_PERFORMANCE_REVIEW.md).
