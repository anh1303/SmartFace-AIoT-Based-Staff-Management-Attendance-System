# Đánh Giá Kế Hoạch Triển Khai Đợt 1 (FE, BE, Neon & Face Login) — Góc Nhìn Triển Khai Liền Mạch Từ Đầu Đến Cuối

> **Review Gate:** Đánh giá kế hoạch Đợt 1 (`2026-11-21-phase1-web-face-login-deployment.md`) bằng cách đối chiếu trực tiếp với mã nguồn hiện tại và báo cáo triển khai `2026-11-21-oracle-neon-deployment-summary.md`, tập trung vào mục tiêu **triển khai hoàn tất liền mạch trong 1 đợt chạy từ đầu đến cuối mà không bị vấp giữa đường**.

- **Kế hoạch được đánh giá:** `docs/superpowers/plans/2026-11-21-phase1-web-face-login-deployment.md`
- **Ngày đánh giá:** 2026-11-21
- **Tệp đối chiếu bổ sung:** `backend/src/config/mqtt.ts`, `backend/src/modules/devices/device.mqtt.handler.ts`, `backend/src/modules/auth/face-login/face-login.service.ts`, `face-login.engine.ts`, `face-login.attempts.ts`, `frontend/src/routes/guards/PublicGuard.test.tsx`, `frontend/src/features/attendances/components/WebRTCPlayer.tsx`, `.venv/Lib/site-packages/starlette/testclient.py`, `docker/Caddyfile.oci.example`

---

## 1. Kết luận tổng quan (Verdict)

**Trạng thái:** **RẤT TỐT — ĐẠT CHUẨN TRIỂN KHAI ĐỢT 1 (GO).**

So với kế hoạch toàn hệ thống ban đầu (gộp cả Pi, ThingsBoard, MediaMTX, Tailscale VPN), bản kế hoạch Đợt 1 này **thực tế hơn, cắt giảm hơn nửa diện tích rủi ro và dễ hoàn tất trọn vẹn hơn rất nhiều**:
- Loại bỏ hoàn toàn các nguồn rủi ro lớn không cần thiết cho web ở Đợt 1: ThingsBoard ARM64/RAM, MediaMTX WebRTC ICE/UDP/TURN, Tailscale/WireGuard VPN và phần cứng Raspberry Pi.
- Kiến trúc OCI thu gọn còn đúng 4 container gọn nhẹ: **Caddy → Frontend Nginx → Express/Socket.IO → FastAPI (`face-auth`, 1 worker CPU)** + **Neon PostgreSQL/pgvector**.
- Xử lý thẳng toàn bộ lỗi tồn đọng từ lần chạy thử trước (`PublicGuard.test.tsx`, `demo-payroll.test.ts`, lỗi `TestClient`/`httpx2`, `SMTP_FROM`, cảnh báo `HSTS includeSubDomains`, và tách manifest `docker-compose.phase1*.yml`).

### Đánh giá khả năng "triển khai luôn trong 1 lần hoàn tất từ đầu đến cuối"

| Hạng mục | Có chạy thông 1 mạch được không? | Ghi chú thực tế |
|---|---|---|
| **Nhịp 1 — Code, Manifest Phase 1 & Test tự động (Task 0, 2, 3, 4)** | **CÓ — làm thông 100% trong 1 phiên** | Không phụ thuộc OCI hay phần cứng; có thể sửa gọn toàn bộ code/manifest/test để **FE, BE, Python, Compose đều đạt `exit 0`**. |
| **Nhịp 2 — Docker & Browser HTTPS Local (Task 5)** | **Cần 3 điều kiện máy local sẵn sàng** | Cần bật Docker Desktop, cài `mkcert`, sửa dòng `SMTP_FROM` trong `backend/.env` local, và thao tác trình duyệt + webcam thật trên `https://localhost:8443`. |
| **Nhịp 3 — OCI ARM64, Tải, Backup & Release (Task 1, 6, 7)** | **Cần 3 điều kiện hạ tầng ngoài sẵn sàng** | Cần tài khoản/VM OCI Always Free A1 ARM64, domain/DuckDNS trỏ về VM, và Neon staging UAT + Neon test branch tách biệt production. |

> **Chốt thực tế:** Kế hoạch **không có lỗ hổng thiết kế lớn**, nhưng muốn triển khai **1 mạch từ đầu đến cuối không phải dừng giữa chừng để sửa lặt vặt**, cần chú ý **5 điểm đối chiếu mã nguồn ở Mục 3** và chuẩn bị trước **5 đầu vào ở Mục 4**.

---

## 2. Những điểm kế hoạch Đợt 1 làm rất xuất sắc

1. **Cô lập hoàn toàn khỏi stack cũ (Task 2 & Mục 4):** Dùng riêng `docker-compose.phase1.yml`, `docker-compose.phase1.local-https.yml`, `docker-compose.phase1.oci.yml`, tên project riêng `-p smartface-phase1-local` và `.env.phase1.local` / `.env.phase1.oci` — không sợ đụng `docker-compose.cloud.yml` hay xóa nhầm volume local.
2. **Đóng dứt điểm mâu thuẫn test có sẵn (Task 0 L71 & Task 4 L134–L136):** Cho phép sửa hẹp `PublicGuard.test.tsx` (thay vì kẹt trong quy tắc không đụng Phase 2), yêu cầu điều tra `demo-payroll.test.ts` thay vì tăng timeout mù, và cảnh báo đúng bẫy `httpx2` trong báo cáo trước.
3. **Bắt đúng rủi ro `HSTS includeSubDomains` (Task 4 L138):** Kịp thời chặn việc bật `max-age=31536000; includeSubDomains` trong `docker/Caddyfile.oci.example` khi chưa xác minh toàn bộ domain/subdomain.
4. **Giữ đúng hợp đồng Face Login, không tự rút gọn `face-auth` (Mục 1 L45 & Task 3):** Tránh sinh ra nhánh code/model riêng làm lệch embedding với Đợt 2; bắt đúng vấn đề timeout cứng trong luồng face-login (`RPC_CAP_MS`, `ATTEMPT_TTL_MS`).
5. **Ma trận UAT 13 ca (`WEB-01` → `SCOPE-01`) rõ ràng, vừa sức Đợt 1:** Bổ sung `SCOPE-01` để đảm bảo nút Pi/vân tay/camera cổng không giả online và không phá nhầm webcam đăng nhập.

---

## 3. 5 Điểm đối chiếu mã nguồn cần tinh chỉnh để chạy thông 1 mạch

Đây là những chi tiết cụ thể trong codebase hiện tại. Nắm rõ trước khi làm sẽ giúp **không viết thừa, không vấp lúc build/test, và không phải quay lại sửa code sau khi lên OCI**:

### 3.1. Backend phần cứng đã fail-closed sẵn — tránh viết middleware chặn thừa (Task 2 L99–L103)
Đối chiếu mã nguồn thực tế:
- `backend/src/config/mqtt.ts:13-18`: `connectMqtt()` **đã tự bỏ qua** không kết nối broker khi `ENABLE_MQTT !== 'true'`.
- `backend/src/modules/devices/device.mqtt.handler.ts:46-48`: `registerDeviceMqttHandlers()` kiểm tra `if (!client) return` → **không phát sinh I/O** khi MQTT tắt.
- Các endpoint phần cứng **đã fail-closed sẵn**:
  - `POST /api/attendance/tb-webhook` → trả `503` khi `TB_WEBHOOK_SECRET` rỗng (`device.auth.ts:6-12`).
  - `POST /api/devices/:id/face-extraction` → trả `503` khi `REMOTE_RECOGNITION_ENABLED !== 'true'` (`face-extraction.ts:18`).
  - `/api/devices/:id/fingerprint/*` → trả `401` khi thiếu device credentials.
- **Lưu ý nhỏ dễ vấp ở `backend/src/config/env.ts:14`:** `MQTT_DEVICE_SECRET` hiện bắt buộc `min(32)` kể cả khi `ENABLE_MQTT=false`. Trong Đợt 1, cần nhớ luôn điền 1 chuỗi ngẫu nhiên ≥ 32 ký tự trong `backend/.env` (hoặc cho phép optional khi `ENABLE_MQTT=false`) để Zod không làm container backend thoát ngay lúc khởi động.

> **Cách làm gọn nhất cho Task 2 (BE):** Chỉ thêm `ENABLE_ATTENDANCE_CRON` (mặc định `true` để tương thích bản cũ, đặt `false` tường minh trong `docker-compose.phase1.yml`) + guard trong `server.ts` + unit test bootstrap. Không cần thêm lớp middleware chặn route phức tạp cho các route vốn đã fail-closed `401/503`.

### 3.2. Khoanh vùng chính xác UI phần cứng cho `SCOPE-01` (Task 2 L102 & Task 5 L169)
Các vị trí giao diện liên quan đến phần cứng Đợt 2 đã xác định trong `frontend/src/`:
- `frontend/src/features/attendances/components/WebRTCPlayer.tsx`: tự gọi `GET /api/devices/PI4_FRONT_GATE/mode` khi socket connect và cho phép bấm phát luồng `/camera/pi4_cam/whep`.
- `frontend/src/features/attendances/components/DeviceStatusCards.tsx`
- `frontend/src/features/biometrics/components/FingerprintEnrollmentSection.tsx` (và các nút vân tay trong `BiometricsEmployeeTable.tsx` / `EmployeeBiometricsCard.tsx`)
- `frontend/src/components/layout/Sidebar.tsx` / `QuickSettingsMenu.tsx` (mục thiết bị phần cứng nếu có).

> **Cách làm gọn nhất cho `SCOPE-01`:** Dùng **1 flag duy nhất** (ví dụ `VITE_IOT_HARDWARE_ENABLED=false` truyền qua `ARG` khi build Docker phase1, mặc định `true` ở dev để không vỡ test cũ) để:
> 1. `WebRTCPlayer` và `FingerprintEnrollmentSection` hiển thị trạng thái rõ *"Tính năng phần cứng/camera cổng được triển khai ở Đợt 2"* và **không bắn request tới `/camera/...` hay thiết bị Pi**;
> 2. **Giữ nguyên 100%** luồng camera webcam của Face Login và Face Enrollment trên trình duyệt.

### 3.3. 4 Hằng số timeout cứng trong Face Login có thể làm trượt ca Neon Cold Start / 2 phiên ARM (Task 3 L121 & Task 6 L185–L192)
Đối chiếu trực tiếp mã nguồn:
- `backend/src/modules/auth/face-login/face-login.engine.ts:103`: `engineCreate` timeout cứng **`3000 ms`**.
- `backend/src/modules/auth/face-login/face-login.service.ts:10`: `RPC_CAP_MS` cho mỗi frame cứng **`3000 ms`**.
- `backend/src/modules/auth/face-login/face-login.attempts.ts:24-25`: `ATTEMPT_TTL_MS` cứng **`15_000 ms`**, `VERIFIED_FRESH_MS` cứng **`5_000 ms`**.

**Rủi ro khi chạy 1 mạch lên OCI ARM64:**
- Khi Neon đang suspend (ngưỡng cold start ở Task 6 là `≤ 8s`), bước `matchEmployee()` bên trong `processAttemptFrame()` có thể chiếm 4–7 giây, dễ chạm trần `ATTEMPT_TTL_MS = 15s` hoặc làm `completeAttempt()` vượt `VERIFIED_FRESH_MS = 5s`.
- Khi 2 người cùng thử Face Login trên 2 OCPU ARM (`face-auth` 1 worker CPU), thời gian chờ hàng đợi + inference có thể vượt `3000 ms` và bị cắt bởi `RPC_CAP_MS`.

> **Cách làm gọn nhất để không phải quay lại sửa code sau khi lên OCI:** Cho phép cấu hình `FACE_LOGIN_RPC_CAP_MS` (mặc định giữ nguyên `3000`) và `FACE_LOGIN_ATTEMPT_TTL_MS` (mặc định giữ nguyên `15000`) qua env có giới hạn biên an toàn trong `env.ts` — vừa giữ nguyên 100% hành vi hiện tại cho test cũ, vừa tinh chỉnh được ngay bằng env sau khi đo ARM thực tế ở Task 1/6 mà không phải build lại code.

### 3.4. Đã xác minh nguyên nhân gốc của 3 lỗi test tự động ở Task 4
1. **Lỗi `httpx2` ở `face_auth/tests/test_remote_extraction.py:59`:**
   - Đã kiểm tra trực tiếp `.venv/Lib/site-packages/starlette/testclient.py:35-51`: Starlette 1.x thử `import httpx2 as httpx`, nếu không có thì fallback `import httpx`; vì `.venv` hiện **không cài cả `httpx` lẫn `httpx2`** nên mới in thông báo đòi `httpx2`.
   - **Cách đóng sạch nhất (không thêm dependency vào runtime image):** Chuyển `test_remote_extraction.py` sang gọi ASGI trực tiếp (giống pattern `Client`/`AsgiClient` đã chạy ổn định trong `test_face_login_http.py` và `test_api_lifecycle_and_timeouts.py`), **hoặc** khai báo `httpx` trong file `face_auth/requirements-dev.txt` riêng ngoài `Dockerfile`.
2. **Lỗi `frontend/src/routes/guards/PublicGuard.test.tsx:6`:**
   - File đang mock đường dẫn cũ `vi.mock('../../context/AuthContext', ...)`, trong khi Phase 2 đã chuyển sang `@/features/auth/context/AuthContext` (hoặc `@/features/auth`). Chỉ cần sửa đúng 1 dòng mock path trong file test này là pass mà không đụng logic `PublicGuard.tsx`.
3. **Lỗi timeout `frontend/validation/payroll/demo-payroll.test.ts` khi chạy chung 77 file:**
   - Chạy riêng mất `3.08s` (PASS 2/2), chỉ chạm trần `5000ms` khi Vitest spawn 77 worker song song trên máy Windows. Có thể cấu hình `maxWorkers` hợp lý trong script test hoặc ghi nhận cấu hình chạy ổn định (không cần tăng timeout toàn cục vô hạn).

### 3.5. Dọn trùng file Compose & chỉnh `HSTS` để không rối vận hành
- Trước đó repo đã tạo `docker-compose.local-https.yml` (override cho `docker-compose.cloud.yml`). Khi tạo `docker-compose.phase1.yml` + `docker-compose.phase1.local-https.yml` + `docker-compose.phase1.oci.yml`, nên **gỡ bỏ hoặc đánh dấu rõ file cũ** để nhóm không chạy nhầm file override.
- Trong `docker/Caddyfile.oci.example:10`: bỏ `includeSubDomains` và dùng `max-age` thấp (ví dụ `max-age=300` ở staging) cho tới khi xác minh toàn bộ domain theo đúng yêu cầu Task 4 L138.

---

## 4. Checklist 5 đầu vào bắt buộc để chạy thông 1 mạch (Pre-Flight)

Nếu bạn muốn sau khi hoàn tất phần code/test local là **chạy liền 1 mạch qua Local HTTPS → OCI Staging → Production Release** mà không bị ngắt quãng, hãy chuẩn bị sẵn 5 mục sau ngay từ đầu:

| # | Đầu vào cần bạn chuẩn bị | Vì sao chặn nếu thiếu |
|---|---|---|
| **1** | **Docker Desktop (Linux engine) đang chạy + cài `mkcert`** | Không chạy được `docker compose build/up` và không tạo được chứng chỉ HTTPS tin cậy cho `https://localhost:8443` (Task 5). |
| **2** | **Sửa `SMTP_FROM` trong `backend/.env` local + xoay mật khẩu Neon từng lộ ở `face_auth/.env.example`** | `docker compose` hiện báo lỗi parse dòng 51 `backend/.env`; credential Neon cũ phải được thu hồi/đổi trước khi đóng cổng bảo mật (Task 0 & Task 2). |
| **3** | **3 Neon target tách biệt:** (a) Production (giữ nguyên), (b) Staging UAT bền vững, (c) Branch test riêng cho `npm run test:neon` (điền `backend/.env.testing`) | Không trộn dữ liệu thử/reset DB tạm vào production hoặc UAT (Task 0, 4, 5). |
| **4** | **Tài khoản OCI + VM ARM64 (`A1.Flex`, mục tiêu 2 OCPU / 12 GB) + 1 domain/DuckDNS trỏ IPv4 về VM** | Bắt buộc cho spike build ARM64 thật và Let's Encrypt HTTPS công khai (Task 1 & Task 6). |
| **5** | **1 tài khoản test đã có embedding hợp lệ + webcam thật trên máy kiểm thử** | Bắt buộc để nghiệm thu `FACE-01` → `FACE-04` trên trình duyệt thật (Task 5 & Task 6). |

---

## 5. Lộ trình thực thi đề xuất theo 2 nhịp gọn nhất

1. **Nhịp 1 — Làm xong 100% phần Code, Manifest & Test tự động ngay bây giờ (không cần chờ hạ tầng):**
   - Tạo `docker-compose.phase1.yml`, `docker-compose.phase1.local-https.yml`, `docker-compose.phase1.oci.yml`, `.env.phase1.example`; chỉnh `HSTS` trong `docker/Caddyfile.oci.example`.
   - Thêm `ENABLE_ATTENDANCE_CRON` + unit test bootstrap (`server.ts`/`env.ts`); thêm env tùy chọn cho `FACE_LOGIN_RPC_CAP_MS`/`ATTEMPT_TTL_MS` (giữ mặc định hiện tại); thêm flag `SCOPE-01` vô hiệu gọn nút phần cứng Đợt 2 ở FE.
   - Sửa `PublicGuard.test.tsx`, ổn định `demo-payroll.test.ts`, thay `TestClient` trong `test_remote_extraction.py` bằng ASGI thuần để **cả 3 bộ test FE / BE / Python và `docker compose config --quiet` đều đạt `exit 0`**.
2. **Nhịp 2 — Chạy liền mạch Local HTTPS → OCI Staging → Production (khi đủ 5 đầu vào ở Mục 4):**
   - Chạy `npm run test:neon` trên branch test riêng → chạy `https://localhost:8443` và nghiệm thu đủ 13 ca UAT (Task 5) → build ARM64 trên VM OCI + đo tải 15 phút / cold start / reboot (Task 1 & 6) → diễn tập backup/restore/rollback → go-live production (Task 7).
