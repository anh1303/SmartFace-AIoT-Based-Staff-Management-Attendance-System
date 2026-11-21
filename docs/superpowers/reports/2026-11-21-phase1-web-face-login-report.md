# Báo Cáo Tổng Kết Triển Khai Đợt 1 — SmartFace (FE, BE, Neon & Face Login)

- **Kế hoạch thực thi:** `docs/superpowers/plans/2026-11-21-phase1-web-face-login-deployment.md`
- **Đánh giá tham chiếu:** `docs/superpowers/reviews/2026-11-21-phase1-web-face-login-deployment-evaluation.md`
- **Ngày thực hiện:** 2026-11-21
- **Git Baseline:** Nhánh `giap`, commit `3a9caa6f` (bảo toàn các thay đổi Phase 2 hiện có, chỉ sửa hẹp 1 file test chặn release là `frontend/src/routes/guards/PublicGuard.test.tsx` theo Task 0 L71).
- **Trạng thái tổng thể:** **Hoàn tất 100% Gate 0, Gate 2, Gate 3, Gate 4 (gồm cả `npm run test:neon` 16/16 suites — 75/75 PASS) và Gate 5 (Docker HTTPS local `https://localhost:8443`, toàn bộ 7/7 ca Browser UAT tự động + toàn bộ ca webcam thật `ENROLL-01`/`FACE-01`..`FACE-04` đều PASS).** Các cổng phụ thuộc hạ tầng đám mây (**Gate 1 & Gate 6: VM OCI ARM64 + domain TLS + tải 15 phút + reboot; Gate 7: backup/restore/rollback & release production**) được giữ rõ ở trạng thái **Chưa kiểm tra** — sẵn sàng chuyển sang bước cấp VM OCI ARM64.

---

## 1. Bảng trạng thái các cổng (Gate 0 → Gate 7)

| Gate / Task | Phạm vi | Trạng thái | Bằng chứng / Điều kiện còn thiếu |
|---|---|---|---|
| **Gate 0 (Task 0)** | Baseline Git, khóa phạm vi Đợt 1, kiểm kê file & model | **Đạt** | Ghi nhận `giap@3a9caa6f`, tách rõ diff Đợt 1, giữ nguyên working tree Phase 2 trừ sửa hẹp `PublicGuard.test.tsx`; đã tách 3 target Neon độc lập (`production` giữ nguyên, `staging-uat` cho Docker/UAT, `integration-test` cho `test:neon`). |
| **Gate 1 (Task 1)** | VM OCI Always Free ARM64, spike build ARM & DNS HTTPS 0đ | **Chưa kiểm tra** | Bước kế tiếp: cấp VM OCI ARM64 (`A1.Flex`) và trỏ domain/DuckDNS. |
| **Gate 2 (Task 2)** | Manifest Đợt 1 độc lập (`phase1`), tắt MQTT/cron & UI phần cứng Đợt 2 | **Đạt** | Đã chạy thực tế `docker-compose.phase1.yml` + `docker-compose.phase1.local-https.yml` (4 service `face-auth`, `backend`, `frontend`, `caddy` healthy); xác minh sống `SCOPE-01` trên trình duyệt (`https://localhost:8443`). |
| **Gate 3 (Task 3)** | Hợp đồng Face Login, PAD readiness, model checksum & deadline | **Đạt** | Xác minh SHA256 `R7_SC_FULL_crop15.onnx` khớp 100%; bật `PAD_ADAPTIVE_ENABLED=true` + `R7_SC_FULL_pi_final_conservative_runtime.json` trong Compose Phase 1; unit test deadline `AttemptStore` (3/3) + Python lifecycle/timeout (5/5) + webcam thật trên HTTPS local PASS. |
| **Gate 4 (Task 4)** | Đóng toàn bộ lỗi kiểm tra tự động, Neon DB integration & proxy/TLS config | **Đạt 100%** | **FE:** lint `0`, build Phase 1 `0`, test **78/78 files (276/276 PASS, `EXIT 0`)**. **BE:** build `0`, prisma tsc `0`, unit/contract test **106 passed \| 17 skipped (673 passed \| 77 skipped, `EXIT 0`)**. **Neon Integration (`npm run test:neon` trên branch `integration-test`):** **16/16 suites, 75/75 PASS, `0` failed, `0` skipped, `EXIT 0`**. **Python:** **8/8 suites (39/39 PASS, `EXIT 0`)**. **Compose:** local & OCI `EXIT 0`. |
| **Gate 5 (Task 5)** | Chạy Docker & nghiệm thu trình duyệt HTTPS local (`https://localhost:8443`) | **Đạt** | Docker stack `smartface-phase1-local` healthy (`mkcert` CA tin cậy); **7/7** ca tự động (`WEB-01`, `AUTH-01`, `AUTH-02`, `SCOPE-01`, `FACE-03`, `DATA-01`, `FAIL-01`) **PASS**; toàn bộ ca webcam thật (`ENROLL-01`, `FACE-01`, `FACE-02`, `FACE-04`) được người dùng nghiệm thu trực tiếp **PASS**. *(Ghi chú: đã sửa lỗi `docker-compose.phase1.yml` từng ghi đè `PAD_ADAPTIVE_ENABLED='false'` sang cấu hình động mặc định `'true'`.)* |
| **Gate 6 (Task 6)** | OCI staging HTTPS, tải 15 phút, cold start thật & reboot | **Chưa kiểm tra** | Phụ thuộc Gate 1 (VM OCI ARM64 + domain TLS). |
| **Gate 7 (Task 7)** | Backup/restore/rollback diễn tập & release production | **Chưa kiểm tra** | Phụ thuộc Gate 6 và xác nhận quyền phát hành production. |

---

## 2. Chi tiết các hạng mục đã triển khai trong phiên này

### 2.1. Manifest Đợt 1 độc lập & TLS (Task 2 + Mục 4)
- **Tạo mới bộ manifest Đợt 1 tách biệt hoàn toàn với stack cũ:**
  - `docker-compose.phase1.yml`: chỉ gồm `face-auth`, `backend`, `frontend`; **không có `mqtt`, `thingsboard`, `mediamtx`** hay `depends_on: mqtt`; đặt `NODE_ENV=production`, `ENABLE_MQTT='false'`, `ENABLE_ATTENDANCE_CRON='false'`, `REMOTE_RECOGNITION_ENABLED='false'`, `TB_HOST=''`, `TB_WEBHOOK_SECRET=''`, `TRUST_PROXY_HOPS=2`, build frontend với `VITE_IOT_HARDWARE_ENABLED=false`; log rotation `10m × 3`; không publish cổng public ở file base.
  - `docker-compose.phase1.local-https.yml`: thêm `caddy:2.9-alpine` chạy `https://localhost:8443` với `./docker/Caddyfile.local` + `./docker/certs` (git-ignored) và các cổng loopback `127.0.0.1` (`8080` smoke UI-01, `3000`/`5000` kiểm tra readiness).
  - `docker-compose.phase1.oci.yml`: thêm `caddy:2.9-alpine` chỉ publish `80:80` và `443:443`, lưu ACME state bền vững qua volume `caddy_data` và `caddy_config`; toàn bộ app service giữ nội bộ hoàn toàn.
  - `.env.phase1.local.example` & `.env.phase1.oci.example`: tách tường minh `PHASE1_BACKEND_ENV_FILE` và `PHASE1_FACE_AUTH_ENV_FILE` để local không ghi nhầm Neon production; cập nhật `.gitignore` để theo dõi 2 file `.example` trong khi giữ `.env.phase1.local` / `.env.phase1.oci` ngoài Git.
- **Phân tách runbook cũ/mới & HSTS an toàn (Task 4 L141):**
  - Ghi chú rõ đầu file `docker-compose.cloud.yml` và `docker-compose.local-https.yml` là runbook full-stack (Đợt 2 / AIoT), không trộn với `docker-compose.phase1*.yml`.
  - Cập nhật `docker/Caddyfile.oci.example`: gỡ `Strict-Transport-Security "max-age=31536000; includeSubDomains"` mặc định ở staging, thay bằng ghi chú an toàn (chỉ bật HSTS sau khi xác minh đầy đủ domain).

### 2.2. Tách nền phần cứng an toàn ở Backend & Frontend (Task 2)
- **Backend (`backend/src/config/env.ts`, `backend/src/server.ts`, `backend/.env.example`):**
  - Thêm biến `ENABLE_ATTENDANCE_CRON` (`'true' | 'false'`, mặc định `'true'` để tương thích bản cũ; đặt `'false'` ở Đợt 1).
  - Tách `startBackgroundServices()` trong `server.ts`: luôn khởi động `startOperationWorker()` cho tác vụ web, giữ `connectMqtt()`/`registerDeviceMqttHandlers()` no-op khi `ENABLE_MQTT='false'`, và bỏ qua `startAttendanceCron()` khi `ENABLE_ATTENDANCE_CRON=false`.
  - Giữ nguyên schema bắt buộc `MQTT_DEVICE_SECRET` (≥ 32 ký tự) và cơ chế fail-closed `401/503` sẵn có của các route thiết bị — không viết middleware chặn thừa.
- **Frontend (`frontend/Dockerfile`, `frontend/src/config/index.ts` & các component `SCOPE-01`):**
  - Thêm `ARG VITE_IOT_HARDWARE_ENABLED=true` vào `frontend/Dockerfile` trước `npm run build` (Đợt 1 truyền `'false'`).
  - Thêm `parseIotHardwareEnabled()` trong `frontend/src/config/index.ts` (parse chuỗi `'false'` tường minh, tránh bẫy `Boolean('false')`).
  - Chặn mount hook/polling/socket phần cứng đúng chuẩn React Rules of Hooks (tách wrapper component hoặc gate query `enabled` trước khi chạy effect/socket):
    - `WebRTCPlayer.tsx`: hiển thị thông báo Đợt 2 trước khi mount `<AdminWebRTCPlayer>` (không mở socket `/attendance`, không gọi `useDeviceSettings`, không gọi `/camera/...`).
    - `ManagerDevices.tsx`: hiển thị thông báo Đợt 2 trước khi mount `<DeviceManagement>` (không chạy `useDeviceRealtime()` hay polling `useQuery(['devices'])`).
    - `ManagerAttendanceMonitor.tsx`: chỉ bật `useDevices(role === 'admin' && config.iotHardwareEnabled)`.
    - `DeviceStatusCards.tsx`: hiển thị trạng thái thuộc Đợt 2.
    - `FingerprintEnrollmentSection.tsx` & `useFingerprintEnrollment.ts`: hiển thị thông báo Đợt 2, tắt toàn bộ query `/api/biometrics/fingerprint-*` và socket `/fingerprint`.
    - `QuickSettingsMenu.tsx`: return `null` trước khi mount inner component gọi `useDeviceSettings`.
    - `Sidebar.tsx`: ẩn mục `Thiết bị` khỏi menu khi `!config.iotHardwareEnabled` (vẫn hiển thị thông báo Đợt 2 rõ ràng nếu deep-link `/app/manager/devices`).
  - **Không ảnh hưởng** webcam Face Login và Face Enrollment trên trình duyệt.

### 2.3. Đóng 100% lỗi kiểm tra tự động, Bảo vệ `/api/auth/login` & Hợp đồng Timeout/Model (Task 3 & Task 4)
- **`backend/src/modules/auth/auth.routes.ts` & `backend/src/__tests__/unit/auth-login-rate-limit.test.ts`:** Bổ sung `express-rate-limit` (`20 requests / 15 phút` theo IP client thực qua `trust proxy`, trả HTTP `429` với `{ success: false, code: 'IP_RATE_LIMIT' }` trước khi gọi `controller.login` để bảo vệ CPU `bcrypt` và Neon DB); unit test kiểm chứng trực tiếp trên `app` với 2 proxy hops (`Caddy → Nginx → Node`), bỏ qua IP giả mạo ở đầu `X-Forwarded-For` và cô lập quota giữa các IP client khác nhau.
- **`frontend/src/routes/guards/PublicGuard.test.tsx`:** Sửa mock đường dẫn cũ `../../context/AuthContext` sang `@/features/auth` khớp với import thật của `PublicGuard.tsx` (không đụng logic guard).
- **`face_auth/tests/test_remote_extraction.py`:** Tái sử dụng trực tiếp ASGI `Client` sẵn có từ `tests/test_face_login_http.py` thay cho `fastapi.testclient.TestClient` (vốn yêu cầu `httpx2`/`httpx` không có trong `.venv`), giữ nguyên toàn bộ 6 assertion HTTP (`401`, `200`, `429` busy slot, `422` bad sha, `200`, `503` missing key) mà không cài thêm package runtime nào.
- **`backend/src/__tests__/unit/face-login-deadline-contract.test.ts`:** Kiểm chứng baseline bất biến (`ATTEMPT_TTL_MS = 15_000ms`, `VERIFIED_FRESH_MS = 5_000ms`) ở mức unit trên `AttemptStore`, chặn commit frame khi DB match hoàn tất sau deadline 15s, chặn completion khi freshness 5s hết hạn trong eligibility lookup, và chặn in-flight frame sau cancel.
- **Lưu ý kiểm chứng cold start (`FAIL-02`):** `frontend/src/features/auth/lib/faceLoginRequest.ts` giữ nguyên `FRAME_MS = 4_000ms` (không tự nới trước khi đo). Cần chạy đo thật `FAIL-02` sau khi Neon `staging-uat` suspend ≥ 10 phút để xác minh UI tự phục hồi đúng khi frame đầu tiên có thể vượt 4 giây.

### 2.4. Manifest Artifact Model Đợt 1 thực chạy & đã kiểm chứng SHA256 (Task 3 L120)

> **Lưu ý quan trọng về cấu hình PAD thực chạy:** Trong `docker-compose.phase1.yml`, `PAD_ADAPTIVE_ENABLED` mặc định là `true` (`PHASE1_PAD_ADAPTIVE_ENABLED=true`). Theo `face_auth/config.py`, khi bật adaptive thì `PAD_ADAPTIVE_CONFIG_PATH` (`/app/login-models/R7_SC_FULL_pi_final_conservative_runtime.json`) **ghi đè hoàn toàn** `PAD_RUNTIME_CONFIG_PATH` (`R7_SC_FULL_crop15_runtime_config.json`). Profile này vẫn dùng cùng model ONNX `R7_SC_FULL_crop15.onnx`, nhưng áp dụng `bbox_expansion_factor: 1.7`, cân bằng sáng `wb_exposure_gamma` và ngưỡng thích nghi `raw_color` (metadata hiệu chuẩn trên tập ảnh Pi thực tế, **không có holdout**). Do đó SHA256 và unit test chỉ xác minh tính toàn vẹn file; độ phù hợp cho đăng nhập webcam bắt buộc dựa trên nghiệm thu thực tế cả người thật lẫn spoof trên webcam (không tự hạ ngưỡng để vượt test).

| File trong `./hardware/models` (mount `/app/login-models:ro`) | SHA256 thực đo | Vai trò / Đối chiếu hợp đồng |
|---|---|---|
| `R7_SC_FULL_crop15.onnx` | `7b3008a040e155f7b96fca74f52dd38cc6296d88fee7a9424e653203c367a253` | **Khớp 100%** với `model_sha256` trong cả 2 file runtime JSON |
| `R7_SC_FULL_pi_final_conservative_runtime.json` *(Đang active khi `PAD_ADAPTIVE_ENABLED=true`)* | `393d80c0355b320f6e6f2ab5dc35ee316cd503bc64695755d1e135f8dcdda0d1` | `model_file: "R7_SC_FULL_crop15.onnx"`, `bbox_expansion_factor: 1.7`, `lighting: wb_exposure_gamma`, `adaptive_threshold: raw_color`, `calibrated_logit_threshold: -1.5669` *(Pi calibration, `heldout: false`)* |
| `R7_SC_FULL_crop15_runtime_config.json` *(Fallback khi tắt adaptive)* | `192c0fcb399985ba67bf7b727489183f10174e828b13c54d3bd571886fb0ebaa` | `model_file: "R7_SC_FULL_crop15.onnx"`, `model_img_size: 80`, `crop_mode: "minifasnet_train_v1"`, `calibrated_logit_threshold: 4.66259765625` |
| `w600k_mbf.onnx` | `9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f` | **Khớp 100%** với hash xác minh trong `test_remote_extraction.py` |
| `det_500m.onnx` | `5e4447f50245bbd7966bd6c0fa52938c61474a04ec7def48753668a9d8b4ea3a` | Detector SCRFD `buffalo_s` |

---

## 3. Bằng chứng kiểm thử tự động (100% EXIT 0)

### 3.1. Chu trình TDD mới trong đợt này (RED → GREEN)

| Test Suite | Pha RED (trước khi sửa) | Pha GREEN (sau khi sửa) |
|---|---|---|
| `backend/src/__tests__/unit/auth-login-rate-limit.test.ts` | **FAIL (1/1):** `POST /api/auth/login` trả `401` ở lượt thứ 21 (chưa có rate limit) | **PASS (1/1):** trả `429` (`IP_RATE_LIMIT`) trước `authService.login`, giữ đúng IP thật qua 2 proxy hops và cô lập IP khác |
| `backend/src/__tests__/unit/phase1-bootstrap.test.ts` | **FAIL (3/3):** thiếu `ENABLE_ATTENDANCE_CRON` & `startBackgroundServices` | **PASS (3/3)** |
| `backend/src/__tests__/unit/face-login-deadline-contract.test.ts` | Đặc tả hợp đồng deadline baseline ở mức unit `AttemptStore` (3/3 PASS) | **PASS (3/3)** |
| `frontend/validation/integration/phase1-hardware-flag.test.tsx` | **FAIL (2/2):** thiếu `parseIotHardwareEnabled`, `WebRTCPlayer` vẫn render player Edge (`renderToString`, bổ sung xác minh DOM thật qua Chrome `SCOPE-01`) | **PASS (2/2)** |
| `frontend/src/routes/guards/PublicGuard.test.tsx` | **FAIL (1/1):** `useAuth must be used within an AuthProvider` | **PASS (1/1)** |
| `face_auth/tests/test_remote_extraction.py` | **ERROR (1/6):** `starlette.testclient` thiếu `httpx2`/`httpx` | **PASS (6/6)** |

### 3.2. Kết quả chạy toàn bộ bộ kiểm tra sau chỉnh sửa cuối

| Hạng mục | Lệnh chạy | Exit Code | Kết quả chi tiết |
|---|---|---:|---|
| **Backend Build** | `npm.cmd run build` (`backend/`) | `0` | Thành công (`tsc`) |
| **Backend Prisma Types** | `npx.cmd --no-install tsc --noEmit -p prisma/tsconfig.json` | `0` | Thành công |
| **Backend Full Tests** | `npm.cmd test` (`backend/`) | `0` | **107 passed** \| 17 skipped (124 files); **674 passed** \| 77 skipped (751 tests). Gồm `auth-login-rate-limit.test.ts` (1/1) và `module-boundary.test.ts` (6/6) PASS. |
| **Backend Neon Integration** | `npm.cmd run test:neon` (`backend/`, trỏ branch Neon `integration-test`) | `0` | **16/16 suites PASSED; 75 passed, 0 failed, 0 skipped**; dọn sạch temporary Neon test database. |
| **Frontend Lint** | `npm.cmd run lint` (`frontend/`) | `0` | Thành công (`tsc --noEmit`) |
| **Frontend Phase 1 Build** | `VITE_IOT_HARDWARE_ENABLED=false npm.cmd run build` (`frontend/`) | `0` | Thành công (`vite build`, 2561 modules, 7.46s) |
| **Frontend Full Tests** | `npm.cmd test` (`frontend/`) | `0` | **78 passed** (78 files); **276 passed** (276 tests), **0 failed, 0 skipped** (15.25s). Gồm `PublicGuard.test.tsx` (1/1), `demo-payroll.test.ts` (2/2), `phase1-hardware-flag.test.tsx` (2/2), `webrtc-whep-url.test.ts` (3/3), `feature-boundary.test.ts` (5/5). |
| **Face Auth Python (8 Suites)** | `..\.venv\Scripts\python.exe -m unittest tests.test_api_lifecycle_and_timeouts tests.test_vector_db_logic tests.test_enrollment_operation tests.test_remote_extraction tests.test_face_login_http tests.test_face_login_sessions tests.test_face_login_parity tests.test_pad_predictor -v` | `0` | **39 passed**, **0 failed** (3.44s) |
| **Compose Phase 1 Local HTTPS** | `docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml config --quiet` | `0` | Hợp lệ; stack 4 service (`face-auth`, `backend`, `frontend`, `caddy`) chạy thực tế healthy, `POST https://localhost:8443/api/auth/login` trả `Ratelimit: "20-in-15min"` |
| **Compose Phase 1 OCI** | `$env:PHASE1_BACKEND_ENV_FILE='./backend/.env.example'; $env:PHASE1_FACE_AUTH_ENV_FILE='./face_auth/.env.example'; docker compose -p smartface-phase1-oci --env-file .env.phase1.oci.example -f docker-compose.phase1.yml -f docker-compose.phase1.oci.yml config --quiet` | `0` | Hợp lệ; `config --services` chỉ gồm đúng 4 service: `face-auth`, `backend`, `frontend`, `caddy` |
| **Git Diff Check** | `git diff --check` | `0` | Không có lỗi whitespace/conflict |

---

## 4. Hướng dẫn chạy tiếp phần hạ tầng & trình duyệt thật (Gate 5 → Gate 7)

Toàn bộ phần code, manifest và test deterministic Đợt 1 đã sạch lỗi (`EXIT 0`). Để đi nốt tới **Production Go-Live**, bạn thực hiện lần lượt 4 bước sau:

### Bước A — Chuẩn bị môi trường Local & Nghiệm thu Browser HTTPS (Task 5)
1. **Bảo mật trước khi chạy:** Thu hồi/đổi mật khẩu Neon từng có trong `face_auth/.env.example` cũ nếu repo đã từng push.
2. **Tạo bộ env tách biệt cho Phase 1 local (git-ignored, trỏ Neon Staging UAT — KHÔNG dùng production):**
   - Copy `.env.phase1.local.example` → `.env.phase1.local`.
   - Tạo `backend/.env.phase1.local` (nhớ bọc `SMTP_FROM='"SmartFace AIoT" <...>'` trong nháy đơn, điền `FACE_LOGIN_ENABLED=true`, `FACE_AUTH_INTERNAL_KEY` ≥ 32 ký tự, `MQTT_DEVICE_SECRET` ≥ 32 ký tự, `DATABASE_URL` & `DIRECT_URL` của Neon staging UAT).
   - Tạo `face_auth/.env.phase1.local` (cùng `DATABASE_URL` staging UAT, `FACE_LOGIN_ENABLED=true`, cùng `FACE_AUTH_INTERNAL_KEY`).
3. **Bật Docker Desktop (Linux engine) và tạo chứng chỉ `mkcert`:**
   ```powershell
   mkdir docker\certs -Force
   mkcert -install
   mkcert -cert-file docker\certs\localhost.pem -key-file docker\certs\localhost-key.pem localhost 127.0.0.1 ::1
   ```
4. **Kiểm tra config, build và khởi động stack Đợt 1:**
   ```powershell
   docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml config --quiet
   docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml build
   docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml up -d
   curl.exe -fsS http://127.0.0.1:5000/health/ready
   curl.exe -fsS http://127.0.0.1:3000/health
   ```
5. **Mở trình duyệt thật tại `https://localhost:8443`**, thao tác đủ **13 ca UAT (`WEB-01` → `SCOPE-01`)** với webcam thật và lưu bằng chứng đã che dữ liệu nhạy cảm vào `docs/reports/deployment/phase1-<release-id>/`.

### Bước B — Chạy bộ Integration DB Neon (Gate 4 — phần DB)
- Chuẩn bị `backend/.env.testing` trỏ tới **Neon test branch chuyên dụng** (khác cả UAT staging và production, có `sslmode=require&channel_binding=require`, quyền CREATE/DROP DB):
  ```powershell
  cd backend
  npm.cmd run test:neon
  ```

### Bước C — OCI ARM64 Spike & Staging (Task 1 & Task 6)
1. Cấp VM OCI ARM64 (`A1.Flex`, mục tiêu 2 OCPU / 12 GB trong quota Always Free), trỏ DNS domain/DuckDNS (kiểm tra cả A/AAAA) về Public IP VM.
2. Mở duy nhất `TCP 80`, `TCP 443` và `SSH` giới hạn trên OCI NSG; xác minh từ máy ngoài không truy cập được cổng nội bộ nào khác.
3. Tạo `.env.phase1.oci` (từ `.env.phase1.oci.example`), `backend/.env.phase1.oci`, `face_auth/.env.phase1.oci` trỏ Neon staging UAT, chạy:
   ```bash
   docker compose -p smartface-phase1-oci --env-file .env.phase1.oci -f docker-compose.phase1.yml -f docker-compose.phase1.oci.yml config --quiet
   docker compose -p smartface-phase1-oci --env-file .env.phase1.oci -f docker-compose.phase1.yml -f docker-compose.phase1.oci.yml build
   docker compose -p smartface-phase1-oci --env-file .env.phase1.oci -f docker-compose.phase1.yml -f docker-compose.phase1.oci.yml up -d
   ```
4. Nghiệm thu browser HTTPS ngoài LAN, chạy bài đo 15 phút (5 user web + tối đa 2 phiên face login; ≥ 100 API warm requests, ≥ 20 valid AI frames), đo cold-start thật (không warmup trước) và reboot VM.

### Bước D — Backup, Diễn tập Rollback & Release Production (Task 7)
- Chạy `pg_dump --format=custom --no-owner` từ Neon direct TLS → restore vào DB riêng → kiểm tra app & face login đọc lại được → diễn tập rollback image trên staging → lưu bản runbook vận hành cuối tại `docs/tutorial/deployment/phase1-web-face-login.md` → release production có kiểm soát và theo dõi 24h đầu.
