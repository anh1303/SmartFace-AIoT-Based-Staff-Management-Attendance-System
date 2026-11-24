# Đánh Giá Kế Hoạch Triển Khai (Bản Cập Nhật v2) — Oracle Cloud + Neon

> **Review Gate (Revision 2):** Đánh giá lại bản kế hoạch sau khi tác giả tiếp thu review v1, phản biện kỹ thuật theo mã nguồn và bổ sung **Task 0** cùng **Mục 7**. Toàn bộ nhận định tiếp tục được đối chiếu trực tiếp với mã nguồn thực tế trong repository.

- **Kế hoạch được đánh giá:** `docs/superpowers/plans/2026-11-21-oracle-neon-deployment.md` (bản đã có `Task 0` và `Mục 7`)
- **Ngày đánh giá:** 2026-11-21 (v1 → v2)
- **Tệp đối chiếu bổ sung ở vòng v2:** `frontend/.dockerignore`, `backend/.dockerignore`, `face_auth/.dockerignore`, `backend/validation/tools/run-neon-tests.mjs`, `face_auth/api_service.py`, `face_auth/database/vector_db.py`

---

## 1. Kết luận tổng quan (Verdict v2)

**Trạng thái:** **ĐẠT ĐIỀU KIỆN BẮT ĐẦU THỰC THI (Conditional Go — sẵn sàng chạy từ Task 0).**

Bản cập nhật v2 có bước nhảy vọt rõ rệt về **độ chính xác kỹ thuật, tính trung thực khoa học và khả năng thực thi**:
- Đã giải quyết toàn bộ **6 nhóm lỗ hổng nghiêm trọng (Critical #1–#6)** nêu ở review v1 bằng các hạng mục cụ thể trong **Task 0** và **Mục 7.2–7.4**.
- Đặc biệt đáng ghi nhận: **Mục 7.1 không chấp nhận review một cách mù quáng**, mà đối chiếu ngược lại mã nguồn và **chỉ ra chính xác những chỗ review v1 diễn đạt quá mức hoặc chưa đủ sâu** (chi tiết ở Mục 2 bên dưới).
- Không còn điểm chặn cứng (blocker) nào ở mức thiết kế kế hoạch; chỉ còn **4 điểm tinh chỉnh nhỏ** (chủ yếu là đồng bộ câu chữ giữa Mục 3 và Mục 7 + 1 chi tiết code tại `api_service.py:77-81` để tránh sót khi triển khai).

### Đối chiếu mức độ sẵn sàng (v1 → v2)

| Trục đánh giá | Bản v1 | Bản v2 | Thay đổi chính |
|---|---|---|---|
| **Kỷ luật bằng chứng & UAT** | Rất tốt | **Xuất sắc** | Bổ sung cảnh báo `--passWithNoTests` ở FE, tách rõ đo idle vs tải thật, cấm sửa ngưỡng sau test để biến fail thành pass. |
| **Độ khớp với mã nguồn thực tế** | Chưa đủ | **Rất tốt** | Đã bắt đúng `operation.worker.ts`, `/health/live` vs `/health/ready`, `attendance.cron.ts`, `vector_db.py` (`query_timeout_ms` chỉ phủ `search()`), `trust proxy`, `WebRTCPlayer.tsx`, `TB_WEBHOOK_SECRET`. |
| **Bảo mật Proxy / TLS / IoT** | Chưa chốt | **Tốt** | Chốt Caddy biên (không tin header client giả), `mkcert` HTTPS local (`8443`), Tailscale đề xuất cho Pi ↔ OCI, kiểm chứng firewall từ máy ngoài thay vì chỉ xem UFW. |
| **Tính thực thi & Gỡ Deadlock** | Chưa đủ | **Đạt** | Có Task 0 tách 2 nhánh song song (xin VM/ARM vs sửa code/UAT local), giải quyết deadlock working tree Phase 2, có lệnh test cụ thể và ngưỡng đo ban đầu ở Mục 7.4. |

*(Các mức trên là nhận định đánh giá tài liệu, không phải số đo benchmark hệ thống.)*

---

## 2. Hiệu đính các phản biện từ Mục 7.1 (Tiếp thu ngược cho Review)

Toàn bộ các điểm phản biện cốt lõi trong **Mục 7.1** của kế hoạch là **chính xác và có căn cứ kỹ thuật vững**. Review v2 ghi nhận và hiệu đính lại các phát biểu chưa chặt ở bản v1 như sau:

1. **Timeout ở `face_auth/database/vector_db.py` (điểm phát hiện xuất sắc của bản v2):**
   - Bản v1 nói *"có thể treo vô hạn"* và *"chỉ cần truyền `pool_timeout` + `query_timeout_ms` ở `api_service.py`"*.
   - **Thực tế đúng hơn:** `psycopg_pool.ConnectionPool` có `timeout=30.0` mặc định (hữu hạn cho bước acquire pool), nhưng socket/query timeout chưa được cấu hình. Quan trọng hơn, `self.query_timeout_ms` trong `vector_db.py:111-114` hiện **chỉ được áp dụng trong `search()`**, chưa phủ `check_connection()`, `validate_schema()`, `upsert()`, `enrollment_receipt()`. Do đó **bắt buộc sửa cả `vector_db.py`**, không thể chỉ sửa mỗi dòng khởi tạo ở `api_service.py`.
2. **Neon Scale-to-Zero & mức tiết kiệm CU-hours:**
   - Đổi chu kỳ poll thành 5–10 phút không tự đảm bảo compute ngủ (cửa sổ suspend mặc định của Neon là 5 phút; nhiều timer lệch pha, dashboard browser hoặc lịch backup vẫn có thể giữ DB thức). Không nên ước lượng cứng "tiết kiệm 70–85%" trước khi đo CU-hours thực tế.
3. **Reverse Proxy & `trust proxy`:**
   - Không hardcode `trust proxy = 2` mù quáng và **tuyệt đối không copy `$http_x_forwarded_proto` vô điều kiện** từ client công khai. Chỉ hợp lệ khi topology `Caddy → Nginx → Node` là tuyến cố định duy nhất và Caddy biên chuẩn hóa/ghi đè header từ client.
4. **Cơ chế biến môi trường & Zod:**
   - `env_file` trong `docker-compose.cloud.yml` vẫn có thể truyền `FACE_LOGIN_ENABLED` / `FACE_AUTH_INTERNAL_KEY` nếu có trong `backend/.env` và `face_auth/.env`; vấn đề đúng là **tách đôi nguồn cấu hình** gây lệch giữa `.env.compose.example` và `*.env`.
   - Tương tự, Zod ở `backend/src/config/env.ts` không xóa biến khỏi `process.env`; vấn đề đúng là **thiếu fail-fast validation lúc khởi động** cho `TB_WEBHOOK_SECRET` và các biến đọc trực tiếp từ `process.env`.
5. **Mosquitto (`mqtt`) & `depends_on`:**
   - Đưa `mqtt` vào Compose profile mà không sửa đồng bộ `depends_on: mqtt`, `MQTT_URL` và `ENABLE_MQTT` sẽ làm `backend` không khởi động được.
6. **HTTPS, VPN và WebRTC Video:**
   - `http://localhost` vốn là Secure Context cho `getUserMedia()`; HTTPS local bắt buộc chủ yếu để kiểm thử cookie `Secure` của `NODE_ENV=production` và hành vi gần OCI nhất.
   - Tailscale/WireGuard không phải "zero-config": cần ACL, định tuyến, bind đúng VPN IP (không phải `127.0.0.1` đơn thuần) và cổng UDP nếu tự dựng WireGuard.
   - Proxy WHEP qua HTTPS mới giải quyết tầng signaling + auth, chưa tự giải quyết đường media/ICE (UDP/TCP/TURN) và các phương thức `POST/PATCH/DELETE` phiên WHEP.
   - Việc giữ hay tách Live Video khỏi Đợt 1 phải do nhóm quyết định tường minh, không tự ý cắt giảm phạm vi.
7. **Backup & OCI Free Tier:**
   - Không tar nóng volume ThingsBoard đang ghi; export JSON chỉ là bổ trợ vì không chứa toàn bộ credential/telemetry.
   - OCI Object Storage lifecycle là cơ chế theo tuổi (age-based), muốn giữ đúng 7 bản phải dùng script/manifest; `pg_dump --format=custom` đã có nén sẵn; không hứa hẹn mốc `<15 phút` dựng lại hay `20 GB` cố định trước khi xác minh/diễn tập; OCI Budget Alert **không phải** hard spending cap.

---

## 3. Trạng thái xử lý 6 lỗ hổng từ Review v1

| ID (v1) | Vấn đề | Trạng thái ở Kế hoạch v2 | Vị trí trong kế hoạch |
|---|---|---|---|
| **Critical #1** | 3 vòng lặp poll Neon 24/7 (`operation.worker` 1s, `face-auth` health 10s, `alerts` 60s) | **Đã xử lý triệt để** — yêu cầu wake-on-enqueue + drain queue, tách `/health/live` vs `/health/ready`, thiết kế lại lịch cảnh báo, đo suspend và CU-hours riêng. | Mục `7.2` (P0), `7.4` |
| **Critical #2** | Thiếu timeout `VectorDB` ở `face_auth` | **Đã xử lý sâu hơn cả v1** — phủ đủ checkout/connect/query cho cả health, schema, enrollment, recognition bằng transaction-local timeout. | Mục `7.1`, `7.2` (P0) |
| **Critical #3** | Thiếu `trust proxy` + Nginx forwarded headers + `express-rate-limit` v8 | **Đã xử lý chặt chẽ** — gắn với topology cố định, chống giả mạo header XFF/proto, yêu cầu test nhiều client & header giả. | Mục `7.2` (P0), `7.3` |
| **Critical #4** | ThingsBoard ARM64/RAM, Mixed Content & auth MediaMTX, bảo mật IoT public & Docker bypass UFW | **Đã xử lý đầy đủ** — yêu cầu kiểm chứng ARM cho cả ThingsBoard/MediaMTX, không fallback HTTP trên HTTPS, auth ADMIN server-side cho WHEP + media path, Tailscale + test firewall từ máy ngoài. | `Task 1`, Mục `7.2` (P0), `7.3`, `7.5` |
| **Critical #5** | Lệch biến env, `TB_WEBHOOK_SECRET`, bind-mount model, Mosquitto, log rotation, pin ARM deps | **Đã xử lý đầy đủ** — thống nhất nguồn env, validate `TB_WEBHOOK_SECRET`, manifest/checksum model, log rotation, pin tag/digest, giữ nguyên môi trường nghiên cứu PAD. | Mục `7.2` (P1) |
| **Critical #6** | Deadlock working tree bẩn, OCI ARM capacity, thiếu phương án HTTPS 0 đồng & backup | **Đã xử lý thực tế** — thêm `Task 0` (2 nhánh song song + quản lý Phase 2 sạch), chốt hướng xử lý capacity A1 không vi phạm constraint, chốt Caddy + DuckDNS/domain + `mkcert` local `8443`, chốt `pg_dump` custom + Object Storage. | `Task 0`, `Task 1`, Mục `7.3`, `7.4` |

---

## 4. 4 Điểm nhỏ còn lại cần lưu ý / tinh chỉnh nhẹ

Không điểm nào dưới đây là blocker, nhưng xử lý gọn trước hoặc ngay lúc thực thi sẽ tránh nhầm lẫn cho người/agent chạy `superpowers:executing-plans`:

### 4.1. Đồng bộ câu chữ cũ ở Mục 3 với quyết định mới ở Mục 7 (tránh đọc nhầm)
Hiện kế hoạch đặt toàn bộ quyết định bổ sung vào Mục 7 với quy ước *"Mục 7 thay thế các đề xuất còn mở khi có khác biệt"*. Tuy nhiên vẫn còn 4 câu cũ ở Mục 3 dễ gây hiểu nhầm nếu đọc từng Task riêng lẻ:
- **Task 2 (`Files`, dòng 109):** Vẫn ghi *"`face_auth/database/vector_db.py` chỉ sửa khi phát hiện lỗi"* — thực tế Mục `7.1` & `7.2` (dòng 271, 298) đã xác nhận **phải sửa `vector_db.py`** để áp `statement_timeout` cho các đường truy vấn ngoài `search()`.
- **Task 3 (dòng 131):** Vẫn ghi *"Chốt nơi kết thúc TLS"* — thực tế Mục `7.3` (dòng 320) đã chốt **Caddy ngoài cùng → Nginx → Node**.
- **Task 5 (dòng 160 & bảng UAT):** Chưa dẫn chiếu trực tiếp `https://localhost:8443` (`mkcert` + `docker-compose.local-https.yml`) và chưa đánh dấu trực tiếp trên bảng 16 ca những ca bắt buộc chạy lại ở HTTPS production (hiện thông tin này nằm tận dòng 352 ở cuối Mục `7.4`).
- **Task 6 (dòng 206):** Vẫn còn câu *"ngưỡng tối đa phải ghi số cụ thể từ yêu cầu trải nghiệm trước khi kết luận đạt"* ngay phía trên dòng 210 trỏ xuống Mục `7.4`.

> **Hướng sửa gọn:** Chỉ cần chỉnh 4 dòng ngắn trong Task 2, 3, 5, 6 trỏ thẳng tới Mục `7.2` / `7.3` / `7.4` (hoặc thêm cột `HTTP / HTTPS` vào bảng UAT Task 5).

### 4.2. Chi tiết code cụ thể cần khóa chặt khi viết `/health/ready` (`face_auth/api_service.py:77-81`)
- Trong `face_auth/api_service.py:77-81`, `startup_event()` hiện **bắt và nuốt mọi `Exception`** khi preload PAD (`except Exception as exc: print(...)`) rồi vẫn in `[api_service] Ready on :5000`.
- Để thực thi đúng yêu cầu ở Mục `7.2` (dòng 315: *"thiếu model khi face login bật phải lộ readiness failure, không healthy giả"*), khi tách `/health/live` và `/health/ready` cần:
  1. Lưu trạng thái lỗi preload PAD (hoặc kiểm tra `login_pad is not None` khi `FACE_LOGIN_ENABLED=true`) ngay trong `/health/ready` → trả **HTTP 503** nếu thiếu/hỏng model PAD.
  2. Kiểm tra lại `depends_on: face-auth: condition: service_healthy` ở `docker-compose.cloud.yml:62-64`: khi Docker healthcheck chuyển sang `/health/live`, cần bảo đảm `startup_event()` vẫn load xong detector/embedder trước khi Uvicorn mở cổng (FastAPI `@app.on_event("startup")` đảm bảo điều này), nên `backend` vẫn đợi được `face-auth` nạp xong model mà không tạo truy vấn DB mỗi 10 giây.

### 4.3. Hai xác minh thực tế từ repo giúp rút ngắn thao tác ở Task 3 & Task 4
- **`.dockerignore` đã kiểm chứng:** Cả 3 file `frontend/.dockerignore`, `backend/.dockerignore`, `face_auth/.dockerignore` **đều đã có `.env*`**. Riêng `face_auth/.dockerignore:5-6` loại trừ `antispoof/**` (chỉ giữ `!antispoof/*.py`), xác nhận chắc chắn rằng model PAD trong Docker **chỉ đi qua bind mount `./hardware/models:/app/login-models:ro`** (hoặc phải copy có chủ đích vào image khi build OCI).
- **`npm run test:neon` đã kiểm chứng (`backend/validation/tools/run-neon-tests.mjs`):** Script đã có cơ chế bảo vệ tốt — đọc `backend/.env.testing`, tự kiểm tra chống trùng host với `backend/.env` và `.env.compose` (`assertTestingNeonEndpoint`), rồi tạo DB tạm `smartface_test_<hex>` cô lập để chạy 7+ bộ integration/race/scale test. Ở Task 4 chỉ cần tạo `backend/.env.testing` trỏ tới **Neon branch/endpoint riêng khác host ứng dụng** là chạy an toàn.

### 4.4. 2 Quyết định vận hành cần chốt tại Cổng 1 (sau khi hoàn tất Spike Task 1)
Đây không phải thiếu sót của kế hoạch (kế hoạch đã nêu đúng giới hạn kỹ thuật), chỉ cần chốt dứt điểm bằng 1 dòng trong hồ sơ triển khai trước khi lên OCI staging:
1. **Cách truy cập Live Camera (`VIDEO-01`):** Chọn rõ 1 trong 3 phương án cho Đợt 1:
   - (a) Admin bật Tailscale khi xem camera (an toàn nhất, không mở cổng media ra public);
   - (b) Proxy WHEP có auth ADMIN qua Caddy + mở cổng media `8189/udp` có cấu hình `MTX_WEBRTCADDITIONALHOSTS` (và kiểm tra thực tế từ mạng ngoài/4G xem có cần TURN không);
   - (c) Tách Live Video sang Đợt 2 có ghi rõ trong biên bản phạm vi release.
2. **Xác minh gói Tailscale miễn phí của nhóm:** Kiểm tra sớm giới hạn số user/device trên tài khoản dự kiến dùng; nếu chuyển sang WireGuard tự dựng trên OCI thì ghi rõ cổng UDP lắng nghe và rule NSG tương ứng trong Task 3.

---

## 5. Khuyến nghị bước tiếp theo

Kế hoạch [2026-11-21-oracle-neon-deployment.md](file:///e:/PBL6/SmartFace-AIoT-Based-Staff-Management-Attendance-System/docs/superpowers/plans/2026-11-21-oracle-neon-deployment.md) đã đạt độ chín kỹ thuật để **chuyển từ giai đoạn lập kế hoạch sang thực thi**. Thứ tự hành động hợp lý nhất ngay lúc này:

1. *(Tùy chọn, mất ~5 phút)* Chỉnh 4 câu nhỏ ở Task 2, 3, 5, 6 cho khớp 100% với Mục 7 để loại bỏ khả năng đọc nhầm.
2. **Chạy Task 0:** Chốt phạm vi baseline Git đối với các thay đổi Phase 2 đang có trong working tree.
3. **Chạy song song 2 nhánh:**
   - **Nhánh A (Task 1):** Xác minh quota OCI, tạo VM A1 ARM64, kiểm chứng chạy thật `face-auth` + `thingsboard` + `mediamtx` trên ARM64, kiểm tra Tailscale & DuckDNS/domain.
   - **Nhánh B (Mục 7.2 + Task 2–5):** Triển khai các bản vá P0 (`operation.worker.ts`, `/health/live` & `/health/ready`, `attendance.cron.ts`, `vector_db.py` + `api_service.py` timeout, `trust proxy` + `nginx.conf`, env/Compose) → chạy test tự động (Task 4) → nghiệm thu trình duyệt local cả HTTP `8080` lẫn HTTPS `8443` (Task 5).
4. Chỉ tiến vào **Task 6 (OCI staging)** khi cả hai nhánh đều đạt cổng nghiệm thu.
