# Tổng Kết Triển Khai Kế Hoạch SmartFace Oracle Cloud + Neon

- **Kế hoạch tham chiếu:** `docs/superpowers/plans/2026-11-21-oracle-neon-deployment.md`
- **Đánh giá tham chiếu:** `docs/superpowers/reviews/2026-11-21-oracle-neon-deployment-evaluation.md`
- **Ngày thực hiện:** 2026-11-21
- **Git Baseline:** Nhánh `giap`, commit `3a9caa6f` (`chore(architecture): enforce Phase 2 Definition of Done zero-debt gates (Phase 2 Batch 6)`)
- **Trạng thái tổng thể:** **Hoàn thành toàn bộ Nhánh B (vá mã nguồn P0/P1, cấu hình Docker/Nginx/Caddy HTTPS local & OCI, bảo mật IoT mặc định, viết test TDD hồi quy và chạy bộ kiểm thử tự động).** Các hạng mục yêu cầu hạ tầng/phần cứng thật (**Docker Desktop đang chạy, `mkcert`, trình duyệt UAT local, VM OCI ARM64, Raspberry Pi, Neon Console, Tailscale/Domain**) được ghi trung thực ở trạng thái **Chưa kiểm tra — chờ điều kiện hạ tầng**. Không công bố sẵn sàng production trước khi hoàn tất các cổng còn thiếu.

---

## 1. Bảng trạng thái theo kế hoạch (Task 0 → Task 7)

| Task | Phạm vi | Trạng thái | Tóm tắt bằng chứng / điều kiện còn thiếu |
|---|---|---|---|
| **Task 0** | Baseline Git & tách 2 nhánh độc lập | **Hoàn thành (phần rà soát)** | Đã ghi nhận `giap@3a9caa6f` và giữ nguyên toàn bộ thay đổi Phase 2 closeout đang có trong working tree (không stash/reset/commit). Nhóm cần quyết định gộp hay tách nhánh trước khi đóng release image. |
| **Task 1** | Hạ tầng OCI, VM ARM64, Domain HTTPS 0đ, Tailscale | **Chưa kiểm tra** | Máy hiện tại không có CLI/tài khoản OCI, `tailscale`, `caddy`, `oci` và chưa có VM ARM64 thật. Cần chạy spike ARM64 cho `face-auth`, `thingsboard`, `mediamtx`. |
| **Task 2** | Neon staging, timeout Python, migration & restore | **Hoàn thành phần code** | Đã sửa timeout xuyên suốt cho `face_auth` (`config.py`, `vector_db.py`, `api_service.py`) và chứng minh bằng unit test. Backup/restore/migration thực tế trên Neon staging branch cần thực hiện khi có Docker/Neon staging. |
| **Task 3** | Cấu hình Production, TLS, Proxy, Env & IoT | **Hoàn thành phần cấu hình** | Đã sửa `app.ts`, `env.ts`, `nginx.conf`, `WebRTCPlayer.tsx`, `docker-compose.cloud.yml`, `docker-compose.iot.yml`, `.env.*.example`, `hardware/RUN_ON_PI.md`; tạo `docker-compose.local-https.yml`, `docker/Caddyfile.local`, `docker/Caddyfile.oci.example`. Đã kiểm chứng `docker compose config --quiet` (EXIT 0) cho cả 3 bộ file. |
| **Task 4** | Kiểm tra tự động & sửa tối thiểu (P0/P1) | **Hoàn thành (local unit/build)** | Backend build + 667 tests PASS; Frontend lint + build + 272 tests PASS (phát hiện 1 lỗi có sẵn từ Phase 2 ở `PublicGuard.test.tsx`); Python 33/33 tests PASS (ghi nhận 1 lỗi có sẵn thiếu `httpx2` trong `.venv` ở `test_remote_extraction.py`). `npm run test:neon` chưa chạy vì cần xác nhận branch test chuyên dụng. |
| **Task 5** | Nghiệm thu trình duyệt local (HTTP 8080 + HTTPS 8443) | **Chưa kiểm tra** | Bị chặn tại chỗ do Docker Desktop daemon chưa bật (`dockerDesktopLinuxEngine` không chạy), máy chưa cài `mkcert`, và `backend/.env` local có lỗi cú pháp `SMTP_FROM` dòng 51 với parser Docker Compose. |
| **Task 6** | OCI staging, tải 15 phút, cold start thật, reboot | **Chưa kiểm tra** | Phụ thuộc hoàn tất Task 1 và Task 5. |
| **Task 7** | Diễn tập rollback, backup OCI Object Storage, go-live | **Chưa kiểm tra** | Phụ thuộc hoàn tất Task 6 và xác nhận quyền thao tác production. |

---

## 2. Danh sách file đã thay đổi và tạo mới

> **Bảo toàn working tree:** Không chỉnh sửa bất kỳ file nào thuộc đợt refactor Phase 2 đang có sẵn trước phiên này.

### 2.1. File mã nguồn và cấu hình đã sửa (16 file)

| File | Nhóm | Nội dung thay đổi chính |
|---|---|---|
| `backend/src/modules/operations/operation.worker.ts` | P0 Neon Idle | Thay polling 1 giây cố định bằng `wakeOperationWorker()` + tự động drain hết hàng đợi khi đang có việc; thêm 1 lượt startup recovery sau 1 giây; nâng chu kỳ recovery/TTL fallback lên `env.OPERATION_RECOVERY_INTERVAL_MS` (mặc định 15 phút). Giữ nguyên lease heartbeat 20 giây khi job đang chạy và `currentActor`. |
| `backend/src/modules/attendance/attendance.cron.ts` | P0 Neon Idle | Thay chu kỳ `alertsInterval` cứng 60 giây bằng `env.ATTENDANCE_ALERTS_INTERVAL_MS` (mặc định 15 phút); giữ nguyên startup catch-up 10s, lịch chính xác `00:05 VN` và chu kỳ tổng hợp 30 phút. |
| `backend/src/config/env.ts` | P0 Proxy & Env | Thêm & validate `TRUST_PROXY_HOPS` (0..5), `OPERATION_RECOVERY_INTERVAL_MS`, `ATTENDANCE_ALERTS_INTERVAL_MS`, `TB_WEBHOOK_SECRET`, `REMOTE_RECOGNITION_ENABLED`, `EDGE_RECOGNITION_KEYS`. Xuất `validateEnvInput()` và bắt lỗi fail-fast nếu `NODE_ENV=production` có `TB_HOST` mà `TB_WEBHOOK_SECRET < 24` ký tự. |
| `backend/src/app.ts` | P0 Proxy | Thêm `configureTrustProxy(app, env.TRUST_PROXY_HOPS)` để Express đọc đúng IP client qua Nginx/Caddy và tương thích `express-rate-limit` v8. |
| `face_auth/config.py` | P0 Timeout | Thêm `DB_POOL_TIMEOUT_SECONDS` (mặc định `5.0`) và `DB_QUERY_TIMEOUT_MS` (mặc định `5000`). |
| `face_auth/database/vector_db.py` | P0 Timeout | Thêm `apply_query_timeout(conn)` dùng `SELECT set_config('statement_timeout', %s, true)` trong transaction (tương thích Neon pooler) và áp dụng xuyên suốt cho `validate_schema()`, `check_connection()`, `search()`, `upsert()`, `enrollment_receipt()`. |
| `face_auth/api_service.py` | P0 Readiness & Timeout | Truyền `pool_timeout` & `query_timeout_ms` vào `VectorDB`; thêm trạng thái `pad_state` (`disabled`/`loading`/`ready`/`failed`); tách `GET /health/live` (không query DB) và `GET /health/ready` (kiểm tra DB + bắt buộc PAD `ready` khi `FACE_LOGIN_ENABLED=true`, trả 503 không lộ path/DSN, không reload PAD mỗi request); giữ `/health` tương thích ngược; áp timeout cho `delete_employee_faces` và ẩn chi tiết lỗi DB thô trong `/internal/enroll`. |
| `frontend/src/features/attendances/components/WebRTCPlayer.tsx` | P0 Video HTTPS | Tách hàm `resolveDefaultWhepUrl()`: trên trang `https:` dùng relative same-origin `/camera/pi4_cam/whep`, **không bao giờ fallback về `http://:8889`** gây Mixed Content. |
| `frontend/nginx.conf` | P0 Proxy | Thêm `map $http_x_forwarded_proto` (dành cho tuyến nội bộ sau Caddy) và đồng bộ `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` cho cả `/api/(v1/)?auth/face-login`, `/api/` và `/socket.io/`. |
| `docker-compose.cloud.yml` | P0/P1 Compose | Chuyển healthcheck `face-auth` sang `/health/live` (cắt DB probe 10s); truyền `TRUST_PROXY_HOPS`, `OPERATION_RECOVERY_INTERVAL_MS`, `ATTENDANCE_ALERTS_INTERVAL_MS`, `DB_POOL_TIMEOUT_SECONDS`, `DB_QUERY_TIMEOUT_MS`; thêm `logging` rotation (`10m × 3`) cho mọi service. |
| `docker-compose.iot.yml` | P1 IoT Security | Đổi bind mặc định từ `0.0.0.0` sang `${IOT_BIND_IP:-127.0.0.1}` / `${TB_ADMIN_BIND_IP:-127.0.0.1}` / `${MEDIAMTX_MEDIA_BIND_IP:-127.0.0.1}`; thay `:latest` bằng tag có thể pin (`thingsboard/tb-postgres:3.8.1`, `bluenviron/mediamtx:1.9.3` — cần xác minh ARM64); thêm `logging` rotation (`10m × 3`). |
| `.env.compose.example` | P1 Env Hygiene | Bỏ khai báo trùng gây hiểu nhầm `FACE_LOGIN_ENABLED`/`FACE_AUTH_INTERNAL_KEY` (chốt 1 nguồn duy nhất ở `backend/.env` và `face_auth/.env`); thêm các biến `PBL6_TRUST_PROXY_HOPS`, `PBL6_HTTPS_*`, `PBL6_*_INTERVAL_MS`, `PBL6_FACE_DB_*`. |
| `.env.iot.example` | P1 IoT Security | Bổ sung biến bind IP an toàn và tag image pin mẫu. |
| `backend/.env.example` | P1 Env Hygiene | Thêm mẫu `TRUST_PROXY_HOPS`, `OPERATION_RECOVERY_INTERVAL_MS`, `ATTENDANCE_ALERTS_INTERVAL_MS`; **sửa cú pháp `SMTP_FROM` sang bọc ngoặc đơn `'...'`** để Docker Compose `env_file` không lỗi parse ký tự `<`. |
| `face_auth/.env.example` | P1 Security | **Gỡ chuỗi kết nối Neon chứa thông tin thật** ở dòng 7, thay bằng placeholder an toàn; bổ sung `DB_POOL_TIMEOUT_SECONDS` và `DB_QUERY_TIMEOUT_MS`. |
| `hardware/RUN_ON_PI.md` | P1 Docs | Bổ sung hướng dẫn cấu hình header bắt buộc `X-TB-Webhook-Secret` trong ThingsBoard REST API Call node (không lưu trên Pi). |

### 2.2. File mới tạo (8 file)

| File | Mục đích |
|---|---|
| `docker-compose.local-https.yml` | Override Docker Compose chạy Caddy local trên `https://localhost:8443` với `NODE_ENV=production` và `TRUST_PROXY_HOPS=2` để nghiệm thu cookie `Secure` và camera ở Task 5. |
| `docker/Caddyfile.local` | Cấu hình Caddy local dùng chứng chỉ `mkcert` tại `./docker/certs/` (đã git-ignore), chuẩn hóa `X-Forwarded-*`. |
| `docker/Caddyfile.oci.example` | Mẫu Caddy biên cho OCI production (auto Let's Encrypt HTTPS, HSTS, chuẩn hóa header, hướng dẫn proxy `/camera/` có auth). |
| `backend/src/__tests__/unit/operation-worker-idle.test.ts` | TDD hồi quy: kiểm chứng 10 phút idle = 0 query DB, recovery sau 15 phút, 1 lần wake drain 3 job liên tiếp, kiểm tra quyền actor `currentActor`. |
| `backend/src/__tests__/unit/attendance-cron-idle.test.ts` | TDD hồi quy: kiểm chứng 10 phút idle không poll `runMissingScanAlerts` mỗi 60s, lịch 15 phút và mốc `00:05 VN` vẫn chạy đúng, `stopAttendanceCron` dọn timer sạch. |
| `backend/src/__tests__/unit/trust-proxy-and-rate-limit.test.ts` | TDD hồi quy: cô lập rate limit theo IP thật qua 1-hop và 2-hop proxy, chặn giả mạo `X-Forwarded-For` bên trái, không sinh `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, kiểm tra fail-fast `TB_WEBHOOK_SECRET` ở production. |
| `face_auth/tests/test_api_lifecycle_and_timeouts.py` | TDD hồi quy (Mục 8.2): kiểm chứng `statement_timeout` trên 5 đường DB của `VectorDB`, và 4+2 kịch bản startup/readiness (`/health/live` không gọi DB, PAD disabled/ready/failed trả 503 không lộ path, DB down lúc boot fail-fast, DB down sau boot live=200/ready=503 không lộ DSN và phục hồi không reload PAD). |
| `frontend/validation/attendance/webrtc-whep-url.test.ts` | TDD hồi quy: kiểm chứng `resolveDefaultWhepUrl` không fallback `http://:8889` trên trang HTTPS. |

---

## 3. Bằng chứng kiểm thử tự động (Task 4)

### 3.1. Chu trình TDD (RED → GREEN) cho các bản vá mới

| Bộ test mới | Kết quả RED (trước khi sửa) | Kết quả GREEN (sau khi sửa) |
|---|---|---|
| `operation-worker-idle.test.ts` | **FAIL (2/3):** 10 phút idle bắn **1.204 query** thay vì 4; chỉ drain 2/3 job. | **PASS (3/3)** |
| `attendance-cron-idle.test.ts` | **FAIL (1/2):** 10 phút idle gọi `runMissingScanAlerts` **11 lần** thay vì 1. | **PASS (2/2)** |
| `trust-proxy-and-rate-limit.test.ts` | **FAIL (3/3):** thiếu `configureTrustProxy` & `validateEnvInput`. | **PASS (3/3)** |
| `test_api_lifecycle_and_timeouts.py` | **FAIL/ERROR (4/5):** thiếu `pool_timeout`, thiếu `statement_timeout` ngoài `search()`, thiếu `/health/live` & PAD state. | **PASS (5/5)** |
| `webrtc-whep-url.test.ts` | **FAIL:** chưa có `resolveDefaultWhepUrl` và code cũ fallback `http://:8889`. | **PASS (3/3)** |

### 3.2. Kết quả toàn bộ bộ kiểm tra tự động sau khi hoàn tất chỉnh sửa

| Thành phần | Lệnh thực thi | Exit Code | Kết quả thực tế | Ghi chú lỗi có sẵn / phạm vi |
|---|---|---:|---|---|
| **Backend Build** | `npm.cmd run build` (trong `backend/`) | `0` | Thành công (`tsc`) | Không có lỗi mới |
| **Backend Prisma Types** | `npx.cmd --no-install tsc --noEmit -p prisma/tsconfig.json` | `0` | Thành công | Không có lỗi mới |
| **Backend Test Suite** | `npm.cmd test` (trong `backend/`) | `0` | **104 passed** \| 17 skipped (121 files); **667 passed** \| 77 skipped (744 tests) | `module-boundary.test.ts` (6/6) & `operation.worker.test.ts` (7/7) PASS. 17 file skip là integration DB yêu cầu runner Neon riêng. |
| **Frontend Lint** | `npm.cmd run lint` (trong `frontend/`) | `0` | Thành công (`tsc --noEmit`) | Không có lỗi mới |
| **Frontend Build** | `npm.cmd run build` (trong `frontend/`) | `0` | Thành công (`vite build`, 2561 modules, 43.85s) | Không có lỗi mới |
| **Frontend Test Suite** | `npm.cmd test` (trong `frontend/`) | `1` | **75 passed** \| 2 failed (77 files); **272 passed** \| 2 failed (274 tests) | `feature-boundary.test.ts` (5/5) & `webrtc-whep-url.test.ts` (3/3) PASS. 2 fail đã xác minh: (1) `demo-payroll.test.ts` PASS **2/2** khi chạy riêng (`EXIT=0`, chỉ timeout 5s khi tranh CPU với 77 worker song song); (2) `src/routes/guards/PublicGuard.test.tsx` là **lỗi có sẵn từ Phase 2** (mock đường dẫn cũ `../../context/AuthContext`, giữ nguyên theo Global Constraint #8). |
| **Face Auth Python** | `..\.venv\Scripts\python.exe -m unittest tests.test_api_lifecycle_and_timeouts tests.test_vector_db_logic tests.test_enrollment_operation tests.test_face_login_http tests.test_face_login_sessions tests.test_face_login_parity tests.test_pad_predictor -v` | `0` | **33 passed**, 0 failed (2.11s) | Lưu ý: `.venv` không cài `pytest` (toàn bộ test dùng `unittest`), và `test_remote_extraction.py` có 1 lỗi có sẵn do `.venv` thiếu gói `httpx2` cho `starlette.testclient` (5/6 test còn lại PASS). |
| **Docker Compose (Example Envs)** | `docker compose --env-file ... config --quiet` cho `cloud`, `cloud + local-https`, `iot` | `0 / 0 / 0` | Cả 3 cấu hình hợp lệ | Kiểm tra bằng bộ `.env.*.example` (không in secret). |
| **Git Diff Hygiene** | `git diff --check` | `0` | Không có lỗi whitespace/conflict | Chỉ có cảnh báo CRLF bình thường trên Windows. |

### 3.3. Phát hiện thực tế quan trọng trên máy local cần xử lý trước khi chạy Docker

1. **Lỗi cú pháp trong `backend/.env` local (dòng 51):** Khi chạy `docker compose --env-file .env.compose -f docker-compose.cloud.yml config --quiet` trên file thật của máy, Docker Compose báo lỗi `unexpected character "<" in variable name` ở dòng `SMTP_FROM` (giá trị cá nhân đã được ẩn khỏi báo cáo này).
   - **Cách sửa trên máy bạn:** Bọc toàn bộ giá trị `SMTP_FROM` bằng dấu nháy đơn giống bản mẫu đã sửa trong `backend/.env.example`, ví dụ: `SMTP_FROM='"SmartFace AIoT" <email-cua-ban>'`.
2. **Bảo mật `face_auth/.env.example`:** Trước phiên này, dòng 7 chứa chuỗi kết nối Neon có username/password thật. Đã thay bằng placeholder; **khuyến nghị xoay (rotate) mật khẩu DB Neon đó** trên Neon Console nếu repo từng được push lên remote.

---

## 4. Bản nháp Hồ sơ Quyết định Cổng 1 (Mục 8.4 — cần nhóm chốt trước OCI Staging)

| Quyết định | Trạng thái hiện tại | Việc nhóm cần điền/chốt trước Task 6 |
|---|---|---|
| **Baseline** | `giap@3a9caa6f` + 50 file Phase 2 + 24 file (16 sửa, 8 mới) của đợt triển khai này | Chốt commit Phase 2 hay tạo nhánh release sạch + ghi digest image & checksum model |
| **TLS / Public origin** | Đã có sẵn `docker/Caddyfile.oci.example` (Caddy → Nginx → Node, 2 hops) và `docker-compose.local-https.yml` (`https://localhost:8443`) | Đăng ký domain/DuckDNS thật, xác nhận DNS A/AAAA, kiểm tra gia hạn Let's Encrypt trên OCI |
| **VPN (Pi ↔ OCI)** | `docker-compose.iot.yml` đã đổi bind sang `${IOT_BIND_IP:-127.0.0.1}` | Xác minh điều kiện gói Tailscale miễn phí của nhóm (ACL, key expiry/reboot) hoặc chốt WireGuard UDP port + NSG |
| **Live camera (`VIDEO-01`)** | `WebRTCPlayer.tsx` đã bỏ fallback HTTP trên HTTPS | Chọn dứt khoát **(a)** Admin vào VPN, **(b)** Public WHEP HTTPS + auth ADMIN + mở/đo `8189/udp` (và TURN nếu 4G/NAT chặn), hoặc **(c)** tách Đợt 2 có thông báo rõ trên UI |
| **ThingsBoard** | Đã có `X-TB-Webhook-Secret` trong `RUN_ON_PI.md` và `env.ts` production check | Xác minh image ARM64 (pin digest), đổi mật khẩu tenant mặc định, cấu hình backup DB nhất quán |
| **Models** | Đã xác nhận `face_auth/.dockerignore` loại `antispoof/models`, container đọc qua `./hardware/models:/app/login-models:ro` | Ghi manifest checksum + đường dẫn `FACE_LOGIN_PAD_RUNTIME_CONFIG_PATH` thực tế và chứng minh `/health/ready` = 200 |
| **Backup** | Đã thiết kế hướng `pg_dump --format=custom --no-owner` + OCI Object Storage | Xác minh quota miễn phí bucket thật, tạo IAM tối thiểu, chạy thử backup + restore và đo thời gian thực tế |

---

## 5. Thứ tự thao tác tiếp theo để bạn hoàn tất nghiệm thu và Go-Live

### Bước 1 — Khởi chạy và nghiệm thu trình duyệt Local (Task 5)
1. Sửa dòng `SMTP_FROM` trong `backend/.env` local bằng dấu nháy đơn `'...'` rồi kiểm tra lại:
   ```powershell
   docker compose --env-file .env.compose -f docker-compose.cloud.yml config --quiet
   ```
2. Mở **Docker Desktop** và cài **mkcert** (Windows: `winget install FiloSottile.mkcert` hoặc `choco install mkcert`):
   ```powershell
   mkdir docker\certs -Force
   mkcert -install
   mkcert -cert-file docker\certs\localhost.pem -key-file docker\certs\localhost-key.pem localhost 127.0.0.1 ::1
   ```
3. Đảm bảo `backend/.env` và `face_auth/.env` trỏ tới **Neon staging branch** (tuyệt đối không trỏ DB production), rồi chạy:
   ```powershell
   # Smoke HTTP (UI-01)
   docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --build
   # Nghiệm thu HTTPS production (https://localhost:8443 — toàn bộ ma trận 16 ca UAT)
   docker compose --env-file .env.compose -f docker-compose.cloud.yml -f docker-compose.local-https.yml up -d --build
   ```
4. Kiểm tra readiness trước khi mở trình duyệt:
   ```powershell
   curl.exe -fsS http://127.0.0.1:5000/health/ready
   curl.exe -fsS http://127.0.0.1:3000/health
   ```
5. Thực hiện đầy đủ 16 ca UAT (`UI-01` → `VIDEO-01`) trên trình duyệt thật tại `https://localhost:8443`, lưu bằng chứng đã che thông tin nhạy cảm vào `docs/reports/deployment/<release-id>/`.

### Bước 2 — Chạy bộ integration DB Neon (Mục 8.3)
- Tạo branch/endpoint test riêng trên Neon (khác cả UAT staging lẫn production), điền vào `backend/.env.testing` với đầy đủ `sslmode=require&channel_binding=require`, rồi chạy:
  ```powershell
  cd backend
  npm.cmd run test:neon
  ```

### Bước 3 — Spike OCI ARM64 & Staging (Task 1 & Task 6)
1. Cấp VM OCI ARM64 (`A1.Flex`, mục tiêu 2 OCPU / 12 GB trong quota Always Free).
2. Build & chạy thử trên ARM thật: `face-auth` (đo thời gian khởi động, peak RAM, p95 frame AI), `thingsboard` và `mediamtx`.
3. Cài Tailscale nối Pi ↔ OCI VM, dựng Caddy biên từ `docker/Caddyfile.oci.example`, xác minh từ máy ngoài không truy cập được cổng `1883/8554/8081/7070/8889/5000/3000`.
4. Chạy đo tải 15 phút (≥ 100 request API warm, ≥ 20 frame AI), đo Neon idle suspend thật (≥ 10 phút không traffic), thử cold-start ≤ 8s và reboot VM.

### Bước 4 — Diễn tập Rollback & Release Production (Task 7)
- Diễn tập backup (`pg_dump --format=custom --no-owner` + backup ThingsBoard DB nhất quán) → restore sang DB riêng → rollback image trên staging thành công trước khi chuyển sang production.
