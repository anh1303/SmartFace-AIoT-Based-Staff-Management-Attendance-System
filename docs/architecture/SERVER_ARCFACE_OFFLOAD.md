# Thử nghiệm chuyển ArcFace từ Raspberry Pi lên server

Ngày triển khai mã: 28/10/2026. Nhánh: `feat/server-arcface-offload`.

## 1. Giao tiếp hiện tại đã kiểm tra từ source

| Công việc | Thành phần hiện tại | Kênh giao tiếp |
|---|---|---|
| Lấy hình, phát hiện, bám mặt, PAD theo nhiều khung | `hardware/edge_client.py`, `detection`, `tracking`, `antispoof` | Nội bộ Pi |
| Căn chỉnh mặt 5 điểm, trích xuất vector ArcFace 512 chiều | `hardware/alignment/aligner.py`, `hardware/recognition/embedder.py` | Nội bộ Pi |
| Gửi vector và điểm PAD, nhận kết quả | `hardware/iot/thingsboard_client.py` | MQTT ThingsBoard two-way RPC `verify_face` |
| Tìm danh tính, xác nhận nhiều lượt, ghi vào/ra | `backend/src/modules/attendance/attendance.service.ts` | ThingsBoard Rule Chain → `/api/attendance/tb-webhook` → PostgreSQL/pgvector |
| Chuyển chế độ vào/ra, nhịp báo trạng thái | Pi ↔ ThingsBoard ↔ backend | RPC, thuộc tính thiết bị, telemetry |
| Hiển thị trực tiếp video | `hardware/streaming/rtsp_streamer.py` → MediaMTX → trình duyệt | RTSP H.264; đầu vào stream là khung đã vẽ giao diện |
| Đăng ký sinh trắc học | Backend → `face_auth/api_service.py` | HTTP nội bộ; Face Auth đã có model recognition |

Backend vốn đã xác định nhân viên bằng vector. Phần còn nằm trên Pi và được chuyển đi trong bản thử nghiệm này là **trích xuất vector ArcFace**. Backend tiếp tục là nơi quyết định danh tính và ghi chấm công.

Luồng hiện tại truyền base64 của 512 float32: 2.048 byte dữ liệu vector, 2.732 ký tự base64, cộng thông tin sự kiện. Retry MQTT giữ nguyên event ID; recognition ID tách từng lần xác minh. Kết quả chỉ được dùng khi track, thế hệ xác minh, chế độ và sự hiện diện vẫn hợp lệ. Cache danh tính trên Pi chỉ dùng hiển thị, không cấp quyền ghi chấm công.

Không thay đổi các giới hạn/đặc điểm đang có: matcher webhook tìm vector đang hoạt động của nhân viên ACTIVE, ngưỡng mặc định 0,45; hiện truy vấn này chưa lọc riêng CENTROID/model_version. Việc sửa hợp đồng matcher cần đánh giá riêng, không đưa lẫn vào phép so sánh offload.

## 2. Phương án đã implement

```text
Camera → phát hiện/bám mặt → PAD → căn chỉnh 112×112 trên Pi
                                  ↓ worker hữu hạn, không chặn camera
                          PNG lossless + request ID
                                  ↓ HTTP(S), khóa riêng cho thiết bị
             Backend /api/devices/:id/face-embedding
                                  ↓ khóa nội bộ, giới hạn thời gian
             Face Auth /internal/face-embedding → ArcFace ONNX
                                  ↓ vector 512D đã chuẩn hóa
                               trả về Pi
                                  ↓ luồng MQTT verify_face hiện có
             ThingsBoard → backend matcher → xác nhận → ghi chấm công
```

Lý do giữ đường vector qua Pi: tái sử dụng Rule Chain, event ID, retry và xác nhận nhiều lượt đã có; kết quả trích xuất đến muộn còn phải qua kiểm tra PAD/track trên Pi trước khi được gửi đi. Endpoint trích xuất **không ghi chấm công**. Đây là bước thử nghiệm giảm tải với diện tích thay đổi nhỏ; chưa tối ưu hết lượt truyền mạng. Nếu bỏ lượt vector quay lại Pi ở bước sau, cần giao thức hai pha tương đương để không ghi từ một khung đã mất hiệu lực.

Chế độ `server` không tạo `FaceEmbedder`/ONNX session ArcFace trên Pi. `local` là mặc định; không tự chuyển về local khi mạng lỗi. Detector, tracker, PAD, alignment, model/ngưỡng PAD, phiếu PAD, matcher, chính sách chấm công và luồng điều khiển thiết bị giữ nguyên.

Ảnh PNG giữ nguyên pixel BGR sau encode/decode, không resize/crop/detect lại trên server. Server gọi session recognition hiện có với **đúng tiền xử lý Pi**: BGR → RGB, NCHW, `(pixel - 127.5) / 127.5`, float32 và L2 normalize. SHA-256 model và model_version phải khớp ở cả hai đầu. Artifact được kiểm tra:

```text
hardware/models/w600k_mbf.onnx
~/.insightface/models/buffalo_s/w600k_mbf.onnx
SHA256: 9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f
```

Không download hay thay thế model trong quá trình triển khai thử nghiệm.

### Vì sao chưa lấy trực tiếp RTSP?

Stream hiện tại được vẽ bbox/banner trước khi encode H.264. Nó có thể trễ, mất khung và không mang chung ID khung/track/thế hệ PAD. Một khung server giải mã không tự chứng minh đó là khung đã qua PAD trên Pi. H.264 còn thay đổi pixel, ảnh hưởng kiểm tra tương đương.

Tận dụng RTSP thực sự có thể tránh upload PNG riêng, nhưng cần luồng sạch trước overlay, timestamp/frame ID xuyên suốt encoder/decoder, metadata landmark/PAD gắn đúng frame, bộ đệm hữu hạn và logic loại khung cũ. Nếu chạy detector lại trên server, tải server cũng khác. Đó là hướng giai đoạn tiếp theo; phiên bản hiện tại chọn kiểm chứng việc bỏ ArcFace trên Pi trước.

## 3. Giới hạn tải và lỗi

- Khóa riêng từng thiết bị trong `EDGE_RECOGNITION_KEYS`; không sử dụng khóa webhook ThingsBoard trên Pi. Dùng HTTPS ngoài mạng thử nghiệm tin cậy. Client từ chối chuyển hướng HTTP để không chuyển tiếp khóa.
- Khóa `FACE_AUTH_INTERNAL_KEY` chỉ dùng giữa backend và Face Auth. Không mở cổng Face Auth ra Internet.
- Body chỉ nhận bốn trường; ảnh tối đa 60.000 ký tự base64. Kiểm tra PNG RGB8, kích thước 112×112 trước giải mã. Không lưu ảnh/vector request xuống đĩa hoặc log.
- Gateway giới hạn 120 request/phút/thiết bị và tối đa 4 request đồng thời mỗi process. Face Auth chỉ nhận 1 extraction đồng thời mỗi process, trả 429 khi bận; không xếp thêm hàng đợi inference.
- Gateway hủy fetch sau 2,5 giây. Pi mặc định socket timeout 3 giây và kiểm tra tuổi kết quả sau khi nhận. Timeout socket Python không phải một deadline cứng cho toàn bộ quá trình truyền; dữ liệu quá chậm vẫn không được dùng khi nhận xong. Inference đã chạy trên server không thể hủy giữa chừng bằng HTTP abort.
- Queue worker Pi giữ giới hạn hiện có; kết quả sai request/model/vector, quá hạn hoặc lỗi mạng không trở thành danh tính. Mất track/PAD/đổi chế độ loại kết quả cũ; lỗi trích xuất xóa chuỗi xác minh của lượt đó.

## 4. Bật thử trên hệ thống

Không sửa `.env` thật, không migrate/seed database, không thay container đang chạy. Trước khi bật, server phải có model recognition đúng SHA ở trên. Hai Compose hiện tại đã đọc `backend/.env` và `face_auth/.env`; Dockerfile Face Auth đã bổ sung module mới.

Tạo hai bí mật khác nhau bằng trình tạo ngẫu nhiên, ví dụ chạy `python3 -c 'import secrets; print(secrets.token_hex(32))'` hai lần. Không dùng nguyên placeholder dưới đây.

Trong `backend/.env`:

```dotenv
REMOTE_RECOGNITION_ENABLED=true
EDGE_RECOGNITION_KEYS='{"PI4_FRONT_GATE":"<khoa-rieng-cho-pi-it-nhat-32-ky-tu>"}'
FACE_AUTH_INTERNAL_KEY=<khoa-noi-bo-khac-it-nhat-32-ky-tu>
```

Trong `face_auth/.env`:

```dotenv
FACE_AUTH_INTERNAL_KEY=<cung-khoa-noi-bo-voi-backend>
```

Trong `hardware/.env` trên Pi:

```dotenv
RECOGNITION_BACKEND=server
BACKEND_BASE_URL=https://<dia-chi-backend>
EDGE_RECOGNITION_TOKEN=<khoa-cua-PI4_FRONT_GATE-trong-EDGE_RECOGNITION_KEYS>
REMOTE_RECOGNITION_TIMEOUT_SECONDS=3
EMBEDDING_MODEL_VERSION=buffalo_s
REMOTE_ARCFACE_SHA256=9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f
```

`BACKEND_BASE_URL` là origin, không thêm `/api`; phải truy cập được từ Pi qua reverse proxy hoặc LAN thử nghiệm. Cổng 3000/8080 đang bind loopback trong cấu hình Compose không tự truy cập được từ Pi. Giữ `TB_HOST`, `TB_TOKEN` và Rule Chain như hiện tại. Để `TB_WEBHOOK_SECRET` trống trên Pi khi đã dùng ThingsBoard Mode Relay.

Sau khi kiểm tra cấu hình, build/recreate riêng hai service:

```bash
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --build --no-deps face-auth backend
```

Chờ Face Auth ready rồi khởi động lại chương trình Pi. Dòng startup phải là `SERVER (ArcFace is not loaded on Pi)`. Các request 401/422/429/503 cần xử lý cấu hình/tải trước khi đánh giá tốc độ. Không thay ngưỡng để che lỗi.

Quay lại: đặt `RECOGNITION_BACKEND=local`, khởi động lại Pi; cần giữ file ArcFace cục bộ. Có thể đặt `REMOTE_RECOGNITION_ENABLED=false` rồi recreate backend để đóng endpoint thử nghiệm.

## 5. Bằng chứng kiểm tra tại máy phát triển

Đã thực hiện ngày 28/10/2026:

- Backend TypeScript build đạt.
- 21 test backend: gateway mới, webhook, xác nhận nhận diện; không sử dụng database thật.
- 19 test hardware: worker/camera cũ và transport mới; camera/GPIO/MQTT được giả lập.
- 6 test Face Auth: PNG, tiền xử lý, quyền truy cập, busy/error recovery và model ONNX thật. Session InsightFace của server cũng được kiểm tra trực tiếp với model-pack đang có; sai khác lớn nhất bằng 0 trên 3 ảnh tổng hợp.
- 3 ảnh tổng hợp được trích xuất bằng ONNX thật qua HTTP client → production `deviceRouter` → endpoint FastAPI. Vector giống từng giá trị float32 với đường local. Khóa sai bị từ chối. Không khởi tạo VectorDB hoặc ghi attendance.

Các test tương đương dùng ảnh tổng hợp, chỉ chứng minh tương đương số học/truyền tải; không đo độ chính xác nhận diện người, PAD, mạng Pi hoặc chất lượng camera. Không dùng con số latency loopback máy phát triển để dự báo Pi.

Chạy lại từ root dự án:

```bash
(cd backend && npm run build && npm test -- validation/devices/face-extraction.test.ts validation/devices/webhook-validation.test.ts validation/devices/recognition-confirmation.test.ts)
PYTHONDONTWRITEBYTECODE=1 PAD_ADAPTIVE_ENABLED=false PAD_RUNTIME_CONFIG_PATH= python3 -m unittest discover -s hardware/validation -p 'test*recognition*.py' -v
PYTHONDONTWRITEBYTECODE=1 PAD_ADAPTIVE_ENABLED=false PAD_RUNTIME_CONFIG_PATH= python3 -m unittest discover -s face_auth/tests -p test_remote_extraction.py -v
PYTHONDONTWRITEBYTECODE=1 python3 hardware/validation/smoke_server_recognition.py
```

Smoke test khởi chạy hai process tạm trên loopback và dừng sau khi xong; dùng khóa ngẫu nhiên, URL DB không hoạt động và model có sẵn. Cần build backend trước, Python có dependencies API/CV và `uvicorn`; test FastAPI cần `httpx` trong môi trường phát triển. Không gọi enrollment hoặc chấm công.

## 6. Đo trên Pi trước khi kết luận

Lợi ích dự kiến: bỏ inference ArcFace và bộ nhớ session/model đó. Chi phí thêm: encode PNG, HTTP, băng thông và chờ server. Detector/PAD/TFT và FFmpeg `libx264 ultrafast` 800 kbit/s vẫn chạy trên Pi. Vì vậy chưa thể khẳng định tăng FPS đáng kể.

Dùng cùng tập ảnh mặt đã căn chỉnh 112×112 PNG. Chạy **hai process riêng**, cùng Pi và server thử nghiệm đã cấu hình:

```bash
cd hardware
python3 validation/benchmark_recognition.py --backend local --aligned-dir /path/to/aligned112 --samples 30 --output /tmp/arcface-local.json
python3 validation/benchmark_recognition.py --backend server --aligned-dir /path/to/aligned112 --samples 30 --output /tmp/arcface-server.json
```

Benchmark có warmup, giữ nhịp 1 giây, xuất CPU milliseconds/request, latency p50/p95, số lỗi, kích thước upload và peak RSS. Nó chỉ đo trích xuất, không đo FPS toàn pipeline. Không bật `server` trên chương trình camera cùng lúc chạy benchmark để tránh tranh tài nguyên. Có thể dùng `--help` để kiểm tra CLI mà không nạp model.

Sau đó chạy camera thật 2–3 phút cho mỗi chế độ, cùng camera/ánh sáng/người, giữ nguyên detector/PAD/stream/TFT và cấu hình. Ghi FPS 10 giây từ terminal, CPU/RAM cả Python và FFmpeg (ví dụ `pidstat -u -r -p <PID_PYTHON>,<PID_FFMPEG> 1` nếu có), nhiệt độ/throttling và thời gian từ đứng trước camera đến nhận diện/ghi thành công. Kiểm tra riêng VERIFY_ONLY rồi CONFIRMED_SCAN, CHECK_IN/CHECK_OUT, SPOOF, người lạ, mất mặt rồi quay lại, đổi mode khi đang chờ, ngắt mạng HTTP và ngắt MQTT. Xác nhận không phát sinh ghi nhận trùng hoặc ghi từ lượt cũ trên môi trường kiểm thử được cấp phép.

Không coi phép đo thành công nếu nhiều request server timeout/429 hoặc giảm độ chính xác. PNG ảnh tổng hợp ngẫu nhiên ở smoke test khoảng 50,7 KB JSON/request (~406 kbit/s khi 1 request/giây); ảnh mặt thực có thể nén khác, cần đo `upload_bytes` thực tế. Nếu CPU ArcFace chiếm tỷ trọng nhỏ, điểm nghẽn tiếp theo có thể là detector, PAD hoặc encoder video; cần số đo trước khi chọn tối ưu tiếp.
