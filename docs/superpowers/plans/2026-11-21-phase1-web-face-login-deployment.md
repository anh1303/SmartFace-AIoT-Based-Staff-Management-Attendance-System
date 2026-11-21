# SmartFace Đợt 1 — FE, BE, Neon và đăng nhập khuôn mặt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa ứng dụng web và đăng nhập mật khẩu/khuôn mặt lên Oracle + Neon bằng một release tái lập được, qua nghiệm thu browser HTTPS local và OCI staging trước production.

**Architecture:** Một VM Oracle chạy Caddy → frontend Nginx → Express/Socket.IO; Express gọi FastAPI face-auth nội bộ và Neon qua TLS. FastAPI chạy một worker CPU, có detector/embedder/PAD cùng model phù hợp dữ liệu. Không chạy dịch vụ phần cứng đợt 2.

**Tech Stack:** Docker Compose, Caddy, Nginx, React/Vite, Express/Prisma/Socket.IO, FastAPI/ONNX/psycopg_pool, Neon PostgreSQL/pgvector, mkcert cho HTTPS local.

**Spec:** Người dùng chốt ngày 21/11/2026: đợt 1 chỉ deploy FE, BE và face-auth cho đăng nhập khuôn mặt; Pi/phần cứng thuộc đợt 2. Căn cứ báo cáo `../reports/2026-11-21-oracle-neon-deployment-summary.md` và đối chiếu code hiện tại. Kế hoạch này thay thế phạm vi nghiệm thu đợt 1 trong kế hoạch toàn hệ thống, không thay đổi nghĩa vụ nghiệm thu phần cứng ở đợt 2.

## Global Constraints

- Chỉ lập kế hoạch trong lần tạo tài liệu này; không coi code/build/UAT/deploy đã đạt nếu chưa có bằng chứng mới.
- Ngân sách hạ tầng mục tiêu 0 đồng trong quota thực tế; không tự nâng PAYG, mua domain hay dùng credit trial như cam kết miễn phí lâu dài.
- Neon production hiện tại phải được bảo toàn. Staging UAT và test DB phá dữ liệu phải tách riêng khỏi production và khỏi nhau.
- Bắt buộc mở web đã build thật qua HTTPS trên local và OCI, thao tác và quan sát kết quả; curl/test terminal không thay thế.
- Không đổi model, preprocessing, threshold PAD/recognition hoặc bỏ PAD để đạt test/giảm tải. Không thay môi trường nghiên cứu ngoài phạm vi.
- Không tự reset/stash/commit thay đổi Phase 2. Baseline phải nêu rõ phần code được mang vào release.
- Không công khai API FastAPI, raw DB, Docker socket hoặc cổng thiết bị. Chỉ Caddy nhận public HTTP/HTTPS.
- Từng bước có kết quả Đạt/Không đạt/Chưa kiểm tra. Không sửa ngưỡng sau test chỉ để đạt; thay đổi yêu cầu phải có lý do và nghiệm thu lại.
- Không thể bảo đảm tuyệt đối không phát sinh lỗi; giảm rủi ro bằng thay đổi nhỏ, staging giống production, backup và rollback đã diễn tập.

## Review Focus

1. Face login thành công nhưng tạo sai danh tính/quyền/phiên: test với tài khoản có embedding đúng, tài khoản vô hiệu và context browser độc lập (Task 3, 5).
2. Compose không chạy broker nhưng BE vẫn đòi MQTT/cron: test bootstrap và dependency của manifest đợt 1 (Task 2).
3. PAD lỗi hoặc DB timeout bị che bằng live 200: kiểm tra readiness và lỗi trên UI, DB down từ boot lẫn sau boot (Task 3, 5).
4. Auth, Socket.IO, cookie lỗi sau proxy HTTPS hoặc khi logout: test tuyến proxy thật, rate limit, reconnect và refresh (Task 4, 5).
5. Image ARM/model/schema khác bản đã nghiệm thu hoặc rollback mất dữ liệu: ghi digest, model checksum, migration state và diễn tập phục hồi (Task 1, 6, 7).

## 1. Phạm vi chốt

| Có trong đợt 1 | Để đợt 2 |
|---|---|
| FE, API, đăng nhập mật khẩu và khuôn mặt, phân quyền, phiên/cookie | Pi, camera cổng và các cảm biến, servo, vân tay |
| FastAPI detector/embedder/PAD và kết nối DB mà service hiện cần | ThingsBoard, Mosquitto/MQTT và webhook thiết bị hoạt động |
| Đọc/ghi nghiệp vụ web đang công bố; Socket.IO cho tác vụ web | MediaMTX, RTSP/WebRTC live camera và VPN cho Pi |
| Cách chuẩn bị embedding hợp lệ cho tài khoản thử; enrollment web nếu dùng để tạo embedding | Chấm công thực tế từ thiết bị, offline/replay log thiết bị |
| Worker cho tác vụ web thực sự được bật | Mốc nghiệm thu ARM/video/ThingsBoard và tải AIoT toàn hệ thống |

Camera webcam dùng face login trên browser thuộc đợt 1; không nhầm với live camera từ Pi thuộc đợt 2. Trang công/lương vẫn phải hoạt động đúng nếu còn cung cấp cho người dùng, nhưng không yêu cầu chấm công thiết bị thật để nghiệm thu đợt 1. Không sửa thuật toán công/lương trong đợt này nếu không có lỗi liên quan release.

Không dựng face-auth phiên bản rút gọn mới. Giữ service hiện có để tránh tách code/model contract; giới hạn quyền truy cập và chức năng công bố. Thiết lập face-auth “một tí” vẫn cần kiểm tra model, PAD, timeout và state vì đây là đường đăng nhập.

## 2. Vấn đề hiện tại và cách đóng

| Vấn đề từ báo cáo/code | Cách đóng trong kế hoạch | Bằng chứng bắt buộc |
|---|---|---|
| FE suite exit 1; PublicGuard mock đường dẫn cũ | Sửa mock theo import hiện tại, không sửa guard thật chỉ để test pass; điều tra timeout khi suite chạy chung | Suite FE đầy đủ exit 0, số test/skipped rõ |
| Python focused suite chưa bao gồm remote extraction chạy đúng env | Xác minh dependency TestClient trong môi trường tái lập; không tự cài gói tên `httpx2` chỉ theo báo cáo | Import/test lỗi tái hiện, dependency được xác minh, suite liên quan pass |
| `.env` thật lỗi SMTP_FROM | Sửa quoting có kiểm soát và validate env thật không in secret | Compose config exit 0 cho local và OCI |
| Chưa build/chạy Docker thật | Build và startup toàn stack đợt 1 | Container/log/readiness, web thật |
| Chưa baseline release | Chọn snapshot có chủ đích, ghi commit/diff/image | Manifest tái lập; không nhận commit cũ đại diện cho code chưa commit |
| Chưa UAT local, ARM, migration/restore | Các cổng Task 5–7 không được bỏ | Browser evidence, ARM inference, restore/migration report |
| Polling, proxy, timeout đã được sửa theo báo cáo | Kiểm tra lại diff và hồi quy, không mặc định báo cáo là xác minh mới | Test + đo runtime idle/cold start thực tế |
| Secret Neon từng ở example | Xác minh phạm vi lộ, thu hồi/đổi credential còn hiệu lực và cập nhật Node/Python | Credential cũ không dùng được; không ghi secret vào report |

## 3. Trình tự và điều kiện chuyển bước

Task 0 → local Task 2–5. Task 1 (capacity/ARM) có thể tiến hành độc lập khi đã xác định baseline cần thử. Chỉ lên OCI staging khi local UAT và ARM cùng đạt. Không để thiếu VM chặn sửa/test local. Chưa chạy production trước Task 7.

### Task 0: Baseline và dữ liệu thử

**Files:** Git status, báo cáo triển khai hiện tại, package lockfiles, env examples; không tự chỉnh code Phase 2 ngoài lỗi được xác minh.

**Interfaces:** Sản phẩm là release candidate định danh và ba DB target rõ: production, staging UAT, integration test.

- [ ] Lập danh sách thay đổi hiện có; chốt snapshot gồm Phase 2 và các bản vá triển khai nào. Worktree từ HEAD không chứa thay đổi chưa commit, không dùng nó để tuyên bố đã kiểm tra bản release có các thay đổi ấy.
- [ ] Nếu cần sửa PublicGuard test đang thuộc Phase 2, thay đổi hẹp vì lỗi này trực tiếp chặn release; không lấy quy tắc giữ working tree làm lý do giữ test fail vô thời hạn. Bảo toàn mọi sửa khác.
- [ ] Ghi branch/commit cùng patch nếu có; trước đóng image release phải có snapshot tái lập, không cần auto commit/push trong lúc review kế hoạch.
- [ ] Tạo/chọn Neon staging UAT riêng; xác minh branch ID và host direct/pooled, không chỉ so chuỗi hostname. Dùng dữ liệu thử, không sao chép sinh trắc học thật tùy tiện.
- [ ] Chuẩn bị admin/manager/employee theo vai trò thực sự được face login hỗ trợ; ít nhất một tài khoản có embedding hợp lệ và một tài khoản sai/không có embedding. Không mở rộng quyền face login vượt chính sách hiện có.
- [ ] Lập bảng nguồn env Node/Python/Compose; lưu secret riêng, không in DSN hoặc key. Kiểm tra credential từng lộ đã được xử lý.

**Gate 0:** Định danh release và DB target rõ, không tác động production.

### Task 1: Khả thi OCI ARM và HTTPS miễn phí

**Files:** Dockerfile/requirements/lockfile của FE/BE/face-auth và model runtime config được chọn.

**Interfaces:** VM đúng quota và image ARM chạy được; không cần ThingsBoard/MediaMTX trong spike.

- [ ] Xác minh Always Free trong tài khoản, cấp A1 trong quota. Mục tiêu 2 OCPU/12 GB nếu cấp được, không gọi đó là RAM tối thiểu đã đo. Chọn region gần Neon nếu có lựa chọn hợp lệ.
- [ ] Nếu không cấp được VM thì ghi blocker; tiếp tục local. Không tự nâng gói hoặc đưa cả stack lên Micro 1 GB rồi kết luận lỗi ứng dụng.
- [ ] Build ARM thực tế, import thư viện, load detector/embedder/PAD, inference mẫu và DB staging. Ghi CPU/peak RAM/thời gian startup, image digest, dependency/model version.
- [ ] Pin bộ dependency API đã chạy được; kiểm tra OpenCV/numpy/InsightFace/ONNX ABI, không thay model để vượt lỗi build. Không đoán tag có ARM chỉ vì image pull được ở Windows.
- [ ] Có domain sẵn hoặc subdomain miễn phí được cấp thật, DNS về VM; chốt Caddy auto TLS, lưu dữ liệu ACME bền vững. Kiểm tra DNS AAAA nếu không dùng IPv6 để tránh cấp cert/truy cập lệch.

**Gate 1:** Chạy được face-auth ARM và có đường cấp HTTPS thực tế; không bắt buộc tạo VM để làm local UAT.

### Task 2: Manifest đợt 1, tách nền phần cứng an toàn

**Files:** Tạo `docker-compose.phase1.yml` độc lập; tái sử dụng Dockerfile/Nginx/env hiện có. Tạo `docker-compose.phase1.local-https.yml`, `docker-compose.phase1.oci.yml` cho TLS; sửa hẹp `backend/src/config/env.ts`, `backend/src/server.ts` và test bootstrap khi cần.

**Interfaces:** Base manifest chỉ có frontend, backend, face-auth; override chỉ thêm Caddy và env mạng/TLS. Không merge với cloud/iot Compose cũ để tránh dịch vụ thừa. Cùng code/image giữa staging và production, chỉ khác env/target DB.

- [ ] Viết test trước: mode đợt 1 không kết nối broker, không đăng ký listener thiết bị lên client thật và không gọi startAttendanceCron; operation worker web vẫn hoạt động. `connectMqtt()` đã bỏ qua khi ENABLE_MQTT khác 'true', handler đã return khi thiếu client: không bắt buộc cấm gọi các hàm no-op hoặc viết guard trùng chỉ để thỏa test.
- [ ] Giữ `ENABLE_MQTT=false`; kiểm tra function có thực sự tắt kết nối. Thêm flag `ENABLE_ATTENDANCE_CRON` parse boolean đúng, giữ hành vi mặc định tương thích bản cũ, đặt false tường minh ở phase1. Không dùng flag này để tắt worker web hoặc quyền kiểm tra nghiệp vụ.
- [ ] Không có `mqtt`, `thingsboard`, `mediamtx` hoặc `depends_on` tới chúng trong base mới. `TB_HOST`/`TB_WEBHOOK_SECRET` rỗng, remote edge recognition tắt, không provision device credentials đợt 1. Kiểm tra fail-closed 401/503 hiện có; chỉ thêm guard khi chứng minh có route vượt phạm vi vẫn có thể tác động thật, không viết middleware chặn thừa hoặc chặn API web dùng chung.
- [ ] `MQTT_DEVICE_SECRET` hiện vẫn bắt buộc ≥32 ký tự dù MQTT tắt: cấp secret ngẫu nhiên riêng trong env backend phase1 để tương thích schema. Không đổi validation thành optional nếu không có nhu cầu; không đưa secret này xuống FE.
- [ ] Dùng một flag FE build-time `VITE_IOT_HARDWARE_ENABLED`: phase1 truyền chuỗi 'false' qua build ARG/env trước `npm run build`, parse tường minh không dùng Boolean('false'). Khi chưa khai báo giữ hành vi cũ để tương thích đợt 2; kiểm tra cả hai mode. Không coi flag FE là bảo mật API.
- [ ] Rà WebRTCPlayer, DeviceStatusCards, FingerprintEnrollmentSection, BiometricsEmployeeTable, EmployeeBiometricsCard, Sidebar/QuickSettingsMenu và các provider/hook liên quan. Mode phase1 hiển thị thông báo đợt 2, không mount hook/polling/socket handler phần cứng và không gửi /camera hay lệnh Pi/vân tay. Không chỉ return null sau khi hook đã chạy; không gọi hook có điều kiện trong cùng component. Giữ webcam face login/enrollment và socket tác vụ web.
- [ ] Giữ bootstrap/socket gateway thuần nội bộ nếu không tạo I/O bên ngoài; không tháo mọi module phần cứng chỉ vì tên của chúng. Kiểm tra log/query thay vì refactor composition.
- [ ] FE là production build; backend production; FastAPI một worker. Service trong mạng Docker, host ports app chỉ loopback nếu cần debug hoặc không publish; Caddy public 80/443 ở OCI.
- [ ] Mọi service có log rotation, restart policy; model/ACME volume bền vững; không đặt resource limit quá nhỏ trước đo. Dùng tên project riêng để không dừng nhầm stack hiện có.
- [ ] Sửa SMTP_FROM ở env thật không in giá trị; `config --quiet` base và từng override đều đạt. Đổi env không đồng nghĩa bundle Vite đổi; ưu tiên API same-origin.
- [ ] Nếu tắt cron, ghi rõ đợt 1 không tự sinh/cập nhật công định kỳ. Trang dữ liệu lịch sử vẫn phải hiển thị đúng; nếu người dùng cần tính công tự động ngay thì phải giữ cron đó và nghiệm thu riêng, không cam kết chức năng đã tắt.

**Gate 2:** Stack không yêu cầu phần cứng/broker và không query nền ngoài nhu cầu web đã xác định; test mode cũ/phase1 không hồi quy.

### Task 3: Face login và hợp đồng dữ liệu

**Files:** `backend/src/modules/auth/face-login/*`, `auth.service.ts`, `face_auth/api_service.py`, `face_auth/config.py`, `face_auth/database/vector_db.py`, `face_auth/face_login/*`; model mount và examples.

**Interfaces:** Browser → Node attempt/session → FastAPI PAD/embedding → Node match/quyền → cookie; xác minh đường đi thực tế. Không chuyển việc tạo phiên đăng nhập sang Python.

- [ ] `FACE_LOGIN_ENABLED=true` cả Node/Python, internal key ≥32 ký tự và giống nhau, recognition count hợp lệ; không dùng key browser hoặc token Pi thay thế.
- [ ] Xác minh path runtime JSON nằm trong container và TẤT CẢ path model mà JSON tham chiếu. Có checksum, quyền đọc và artifact đúng; giữ model pack/version/preprocess phù hợp embedding Neon.
- [ ] Tài khoản thử có embedding bằng enrollment hợp lệ đang được hỗ trợ. Nếu thiếu dữ liệu thì dùng flow enrollment web giới hạn quyền và nghiệm thu nó; không tự seed/reset hoặc chèn vector giả để chứng minh login.
- [ ] Kiểm tra `/health/live` không query DB; `/health/ready` 503 nếu PAD bật mà thiếu/hỏng, DB/schema lỗi; live 200 không đủ cho go-live. Startup DB failure có timeout và recovery hữu hạn.
- [ ] Đối chiếu ngân sách timeout thực tế: backend có RPC cap theo từng bước, TTL attempt và limit payload riêng; không chỉ tăng `FACE_AUTH_TIMEOUT_MS` vì có đường không dùng nó. Đo ARM rồi cấu hình timeout nhất quán, giữ backpressure/rate limit.
- [ ] Kiểm tra spoof/no-match/disabled user, expiry, cancel, retry, frame sai thứ tự/trùng, backend/Python restart và hai phiên độc lập. Không suy luận độ chính xác PAD tổng quát từ vài mẫu UAT; giữ threshold đã kiểm chứng trước đó.
- [ ] Mọi lần lỗi không tạo session, không nhận nhầm user/role; camera/media track và session được cleanup; mật khẩu vẫn là đường khôi phục khi AI lỗi.
- [ ] Pool/statement timeout phủ health/schema/enrollment/search; không sửa transaction semantics/commit vì thêm timeout. Tránh probe DB thường xuyên làm Neon không suspend.

**Gate 3:** Có regression tests và định nghĩa model/identity/session đúng; chưa gọi đạt face login thực tế trước browser Task 5.

### Task 4: Đóng lỗi kiểm tra tự động và proxy/TLS

**Files:** `frontend/src/routes/guards/PublicGuard.test.tsx`, test timeout liên quan, lockfiles/API constraints nếu cần, `frontend/nginx.conf`, Caddyfiles, proxy/auth tests hiện có.

**Interfaces:** Bộ kiểm tra chạy bằng dependency tái lập được; Caddy → Nginx → Node là tuyến cố định hai proxy ở local HTTPS và OCI.

- [ ] Sửa test PublicGuard mock theo import thực tế. Chạy test lỗi riêng rồi suite đầy đủ; không skip/delete test để có exit 0.
- [ ] Điều tra demo-payroll timeout bằng resource/worker config phù hợp, chỉ giới hạn parallelism khi có bằng chứng contention. Chạy lại suite cùng một cấu hình ổn định, không tăng mọi timeout vô hạn.
- [ ] Xác minh Python dùng unittest/pytest theo test thực tế. Lỗi TestClient/dependency phải tái hiện trong venv sạch từ manifest; kiểm tra import/version trước khi cài package. Tách dependency test khỏi image runtime nếu không cần ở runtime.
- [ ] Proxy biên chuẩn hóa XFF/proto, Nginx chỉ tin Caddy trên mạng nội bộ, app không có tuyến bypass public. Kiểm tra Host/Origin, IP rate limit, XFF giả, cookie Secure/HttpOnly/SameSite và Socket.IO.
- [ ] TLS local dùng mkcert CA tin cậy, không bypass certificate warning. OCI lưu ACME volume và kiểm tra renewal. Tránh HSTS includeSubDomains dài hạn trước khi xác minh toàn bộ domain; bật chính sách phù hợp sau thử nghiệm.
- [ ] Đánh dấu cloud + local-https Compose cũ là runbook full-stack, phase1 chỉ dùng phase1 base/override. Không xóa file cũ đang được dùng cho đợt 2; thêm chú thích và lệnh chuẩn vào tài liệu để tránh ghép nhầm. Staging mặc định không bật HSTS hoặc dùng max-age=300 không includeSubDomains; khi kết thúc TLS thử nghiệm xác minh header hiệu lực và tình trạng HSTS đã cache trước đó.
- [ ] Frontend: `npm run lint`, `npm run build`, `npm test`; backend: `npm run build`, `npm test`, kiểm tra Prisma types theo script hiện có. Ghi exit code, test pass/fail/skipped; suite exit 1 là chưa đạt dù lỗi có sẵn.
- [ ] Python: chạy `python -m unittest tests.test_api_lifecycle_and_timeouts tests.test_vector_db_logic tests.test_enrollment_operation tests.test_remote_extraction tests.test_face_login_http tests.test_face_login_sessions tests.test_face_login_parity tests.test_pad_predictor -v` trong venv đúng; mở rộng khi thay đổi ảnh hưởng test khác.
- [ ] `npm run test:neon` sau khi đọc runner: endpoint test riêng, quyền CREATE/DROP, guard URL/TLS đúng; runner chỉ reset/drop DB tạm nó tạo, không DB UAT. Ghi cleanup và skipped, không ép chạy guard bằng URL production.

**Gate 4:** Các kiểm tra bắt buộc exit 0; skip do IoT đợt 2 được giải thích riêng, integration auth/DB liên quan đợt 1 không bị bỏ qua.

### Task 5: Chạy Docker và nghiệm thu browser HTTPS local

**Files:** Manifest phase1, cert local git-ignored; evidence dưới `docs/reports/deployment/phase1-<release-id>/` khi thực sự chạy.

**Interfaces:** Local URL `https://localhost:8443`, production build và NODE_ENV=production, staging UAT Neon. HTTP 8080 chỉ smoke, không đại diện nghiệm thu auth production.

- [ ] Docker Desktop Linux engine hoạt động; cài mkcert theo quyền máy được phép, tạo cert cho localhost/127.0.0.1/::1, không commit CA/key.
- [ ] `config --quiet` với env thật → build → up → live/ready. Xác minh đúng DB branch bằng thông tin không nhạy cảm, không chỉ nhìn env example.
- [ ] Mở browser tương tác thật, nhìn màn hình đã render và thao tác toàn bộ ma trận. Dùng context riêng cho user khác; chụp bằng chứng đã che thông tin.

| ID | Ca local HTTPS bắt buộc | Điều kiện đạt |
|---|---|---|
| WEB-01 | Mở web, deep link, refresh/back, desktop/mobile | Không trắng/404, form/nút dùng được |
| AUTH-01 | Password sai/đúng, refresh, logout, truy cập lại | Phiên/quyền đúng, không lộ dữ liệu sau logout |
| AUTH-02 | Từng role, URL/API vượt quyền, phiên hết hạn/thu hồi | UI và API cùng bảo vệ, Socket.IO không giữ quyền cũ |
| FACE-01 | Face login người đã enroll bằng webcam thật | Đúng user/role, vào trang hợp lệ, refresh giữ phiên |
| FACE-02 | Không có embedding/no-match/spoof/PAD failure | Không tạo phiên, lỗi/hướng dẫn rõ và dùng password được |
| FACE-03 | Camera bị từ chối, không camera, cancel/retry/rời trang | Không loading vô hạn, camera/session cleanup |
| FACE-04 | Hai context độc lập và session hết TTL/restart | Không trộn embedding/phiên, thử lại có kiểm soát |
| DATA-01 | Một CRUD thực sự công bố và đọc lại sau refresh | FE/DB nhất quán, không success giả khi ghi lỗi |
| ENROLL-01 | Enrollment nếu là cách cấp embedding đợt 1 | Chỉ role hợp lệ, job/UI hoàn tất, dùng embedding để login được |
| RT-01 | Socket.IO tác vụ web, mất mạng/reconnect | Auth/reconnect đúng, đọc lại state không mất kết quả |
| FAIL-01 | Dừng FastAPI rồi bật lại khi web đang dùng | Face lỗi hữu hạn, password vẫn dùng, phục hồi không reload sai state |
| FAIL-02 | DB staging mất kết nối/cold start thật | Không ghi trùng/treo UI, lỗi đúng và phục hồi được |
| SCOPE-01 | Các nút Pi/fingerprint/live camera | Không giả online, không gọi endpoint dịch vụ không deploy; webcam login không bị tắt nhầm |

- [ ] Console/Network không có lỗi bất ngờ ở happy path; không mixed content, không cookie bị chặn; xác nhận lưu/đọc thật sau refresh.
- [ ] Regression retry/double submit không tạo tài khoản/embedding trùng theo hợp đồng. Nếu UI còn cho tính công/lương thì đối chiếu một bộ kỳ vọng trước, không giả định phần này đúng vì không dùng Pi.

**Gate 5:** Tất cả ca áp dụng đạt và có evidence. Không webcam/browser thì FACE UAT là Chưa kiểm tra, không thay bằng mock hoặc curl. Pi không phải điều kiện đợt 1.

### Task 6: OCI staging, tải, cold start và restart

**Files:** `docker-compose.phase1.oci.yml`, Caddyfile production thực tế, release manifest không chứa secrets.

**Interfaces:** Cùng code và artifact tương ứng ARM được kiểm chứng; config staging giống production về TLS/proxy/worker, Neon staging UAT riêng.

- [ ] Build/deploy image ARM định danh; kiểm tra model digest/schema compatibility. Không đưa image x86 lên ARM bằng emulation rồi bỏ qua hiệu năng.
- [ ] OCI NSG và Docker chỉ public 80/443, SSH giới hạn; xác minh từ máy ngoài không truy cập app/Python, không có cổng đợt 2. Không coi UFW đủ bảo vệ Docker published ports.
- [ ] Mở domain HTTPS từ browser ngoài LAN; lặp lại password, face login webcam, role, refresh/logout, CRUD/enroll và Socket.IO. Local HTTPS đạt không thay kết quả domain thật.
- [ ] Đo 5 user web độc lập + tối đa 2 phiên face login, 15 phút; API warm ít nhất 100 request, AI ít nhất 20 frame hợp lệ. Giữ rate limit thật, không tạo lượt attempt quá quota rồi gọi đó là failure AI.

| Chỉ tiêu ban đầu | Mốc nghiệm thu |
|---|---|
| API nghiệp vụ warm | p95 ≤2s, không 5xx bất ngờ ở happy path |
| Face login | p95 frame server ≤2s; phiên ≤10s từ frame hợp lệ đầu tới kết quả, không tính permission/đứng đúng vị trí |
| Enrollment nếu bật | Hoàn tất job và UI ≤15s cho 3–5 ảnh, không nhầm accepted với hoàn tất |
| Cold start Neon | Request đầu hợp lệ ≤8s sau suspend được xác nhận; phù hợp RPC cap thực tế, không retry ghi mù |
| Memory/disk | Không OOM/swap thrashing; RAM >75% hoặc disk >70% là cảnh báo điều tra, không coi cache Linux là leak |
| Idle | Đo cửa sổ ≥10 phút không browser traffic/job/probe DB/backup, xác nhận suspend; đo CU-hours thực tế và dự toán theo quota tài khoản |

- [ ] Ghi số mẫu/p95, CPU/RAM/connection/error thực tế. Negative tests tách khỏi happy-path tỷ lệ lỗi. Nếu fail ngưỡng, điều tra model/thread/timeout trước khi đổi yêu cầu; không giảm PAD hoặc đổi threshold để chạy nhanh.
- [ ] Restart FastAPI/Node khi có phiên rồi reboot VM; phiên dở báo lỗi có thể thử lại, data/model/cert còn nguyên, không job trùng. Nêu rõ mất session RAM là hành vi dự kiến, không hứa tiếp tục phiên sau reboot.
- [ ] Mất DB từ boot và sau boot, readiness phản ánh đúng; log hữu hạn, không restart loop liên tục hoặc lộ secrets.

**Gate 6:** Browser OCI và các phép đo đạt; DB/model/backup vẫn nguyên sau reboot. Chưa có bằng chứng thì chưa nghiệm thu staging.

### Task 7: Backup, rollback và release

**Files:** Runbook đợt 1 `docs/tutorial/deployment/phase1-web-face-login.md` cần tạo lúc thực thi; manifest và evidence.

**Interfaces:** Có backup restore được và image trước đó; production thao tác theo phạm vi được phép, không mặc định migration tự động lúc container start.

- [ ] Kiểm tra migration status/SQL pending. Nếu schema hiện tại đủ, không tạo migration mới chỉ vì deploy. Không chạy seed/reset production.
- [ ] Nếu cần migration: thử staging, kiểm tra trước/sau/rollback compatibility; đặc biệt migration xóa embedding. Tách quyền runtime và migration.
- [ ] Backup Neon qua direct TLS với pg_dump client tương thích; restore DB riêng và mở app đọc/face login lại với dữ liệu thử phù hợp. Lưu backup ngoài VM có mã hóa/quyền hạn, kiểm tra quota đích thực tế.
- [ ] Giữ model manifest, image digest, config template và ACME state cần thiết; không lưu secret/private key vào Git. Không cần backup ThingsBoard vì không deploy đợt 1.
- [ ] Diễn tập rollback image trên staging. Nếu schema không tương thích, có forward fix hoặc restore/cutover cụ thể, ghi dữ liệu phát sinh có nguy cơ mất; không auto đảo migration.
- [ ] Chốt lịch backup hàng ngày + trước migration, retention và người kiểm tra backup failure. Mục tiêu ban đầu RPO ≤24h khi backup ngày thành công; RTO phải ghi thời gian restore đã diễn tập, không hứa số chưa đo.
- [ ] Đóng snapshot release, chỉ một tuyến deploy/migration; backup → migration cần thiết → deploy đúng digest → browser smoke production với dữ liệu thử có kiểm soát.
- [ ] Nếu auth sai quyền/sai danh tính, dữ liệu hỏng, AI không sẵn sàng hoặc tỷ lệ lỗi vượt tiêu chí: dừng phát hành/rollback theo runbook; không tắt bảo vệ để tiếp tục.
- [ ] Theo dõi lỗi/readiness, tài nguyên và auth ít nhất 24h đầu; không probe DB liên tục làm sai bài toán free tier. Sau ổn định cập nhật hướng dẫn người khác trong nhóm có thể dựng lại.

**Gate 7:** Backup/restore/rollback thật đã đạt, chủ dự án chấp nhận phạm vi đợt 1, browser production smoke đạt. Không dùng “điểm readiness cao” thay gate thiếu.

## 4. Lệnh theo manifest mới

Các file phase1 trong tài liệu là đầu ra cần tạo, CHƯA tồn tại hoặc chưa được nghiệm thu chỉ vì được nêu ở đây. Không chạy lệnh trước khi kiểm tra file/env target. Dùng `.env.phase1.local` và `.env.phase1.oci` git-ignored cho interpolation; Node/Python env file thực tế tách local/staging/prod và đường dẫn được ghi rõ trong manifest. Không để đổi file interpolation nhưng vẫn dùng `backend/.env` production khi chạy local.

```powershell
# Root, từng lệnh riêng; dừng khi có lỗi. Tên project tách stack cũ.
docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml config --quiet
docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml build
docker compose -p smartface-phase1-local --env-file .env.phase1.local -f docker-compose.phase1.yml -f docker-compose.phase1.local-https.yml up -d
```

OCI dùng cùng base + `.oci.yml`, project riêng và env staging trước. Không đồng thời publish cùng host port của stack cũ; xác minh stack sở hữu port rồi dừng đúng project nếu cần, không `down -v` hoặc xóa volume để giải quyết lỗi startup.

## 5. Bằng chứng và checklist chốt

Mỗi ca ghi release/image/model, URL, DB branch không chứa secret, browser/version, role, thao tác, kỳ vọng/thực tế, thời điểm, số mẫu, kết quả và link ảnh/video đã che thông tin. Giữ dump và dữ liệu sinh trắc học ngoài repo. Báo cáo lỗi có sẵn phải chỉ ra ảnh hưởng, không là lý do miễn cổng test.

- [ ] Baseline/env/credential an toàn và DB target được xác minh.
- [ ] Phase1 Compose độc lập không broker/ThingsBoard/MediaMTX và cron phần cứng không chạy.
- [ ] FE/BE/Python/integration tests bắt buộc đạt, failure không bị giấu bằng skip.
- [ ] Model/PAD/readiness và tài khoản embedding hợp lệ được chứng minh.
- [ ] **Browser HTTPS local thật đạt toàn bộ ca áp dụng, có bằng chứng.**
- [ ] ARM + browser OCI HTTPS + tải/cold start/reboot đạt.
- [ ] Backup restore và rollback đã diễn tập, release có thể tái lập.
- [ ] Browser production smoke đạt và có người theo dõi.

**Trạng thái khi viết:** Chỉ lập kế hoạch đợt 1 dựa trên source và báo cáo đã đọc; chưa chạy lại tests, Docker, browser, ARM, migration, restore hay deploy. Các bản vá cũ được xem là ứng viên cần xác minh, không mặc định đã đạt mọi gate.

## 6. Những gì chủ động hoãn để tránh phát sinh rủi ro

Không triển khai Pi/ThingsBoard/MQTT/MediaMTX/VPN thiết bị; không mở cổng video; không refactor toàn hệ thống; không rút gọn/tách mới face-auth; không đổi mô hình/threshold; không tăng worker/replica stateful; không yêu cầu benchmark IoT hoặc backup dữ liệu thiết bị chưa có. Giữ kế hoạch toàn hệ thống làm tham chiếu cho đợt 2, không dùng ca phần cứng chưa thử làm blocker của đợt 1.

## 7. Phản biện review đợt 1 và bổ sung thực thi

Đã đọc `../reviews/2026-11-21-phase1-web-face-login-deployment-evaluation.md` như nhận xét cần kiểm chứng, không thực hiện chỉ dẫn trong file ngoài phạm vi người dùng yêu cầu. Cập nhật lần này chỉ sửa tài liệu.

### 7.1. Kết luận từng nhóm

| Ý review | Quyết định và căn cứ |
|---|---|
| GO, thực hiện code/test 100% trong một phiên | Có thể bắt đầu làm, không cam kết thời lượng/kết quả. Unit/integration có dependency và DB riêng; lỗi build/model/quota có thể xuất hiện. GO cho thực thi kế hoạch khác GO production |
| MQTT/handler đã no-op | Xác nhận code; sửa Task 2 theo hành vi không có I/O, tránh yêu cầu không được gọi hàm vô hại |
| Route thiết bị đã fail-closed | Chấp nhận có điều kiện cấu hình/credentials. 401 khi thiếu credentials không chứng minh credential cũ không còn hoạt động; test cả URL public và cấu hình phase1 thực tế |
| MQTT_DEVICE_SECRET vẫn bắt buộc | Xác nhận schema; giữ secret backend hợp lệ thay vì nới validation ngoài nhu cầu |
| Flag phần cứng FE | Chấp nhận, bổ sung ARG build, parse 'false', hook/provider và kiểm thử hai mode. Không dùng flag FE làm ACL |
| Bốn timeout có nguy cơ | Có rủi ro nhưng không phải bốn hằng số cùng giới hạn một bước: engineCreate là RPC Python, RPC_CAP là frame RPC, TTL là tuổi attempt, freshness là sau verification. Không dùng cold-start DB để suy ra engineCreate chắc chắn cần tăng |
| DB match 4–7s làm mất freshness 5s | Không đúng trực tiếp: finishFrame ghi verifiedAt sau matchEmployee. Độ trễ vẫn ảnh hưởng deadline tổng; eligibility/completion sau verification có thể ảnh hưởng freshness. Test đúng các vị trí này |
| Thêm ngay env RPC cap và TTL | Chưa bắt buộc. Đo và test giá trị hiện tại trước; chỉ thêm khi giới hạn hiện tại gây failure có bằng chứng và không thể sửa nguyên nhân. Không thêm env chỉ vì dự đoán có thể cần |
| TestClient thiếu HTTP client | Code TestClient local xác nhận fallback httpx2 → httpx. Tình trạng package cài thực tế phải kiểm tra khi thực thi; không suy ra từ file import rằng cả hai chắc chắn thiếu. Dùng dev dependency được pin tương thích là mặc định; tái dùng ASGI helper hiện có nếu helper giữ đủ semantics và ít thay đổi hơn, không tự viết transport mới |
| PublicGuard sửa một dòng là pass | Mock cũ có cơ sở; vẫn phải đọc import thật và chạy test để kết luận. Không cam kết pass chỉ từ diff một dòng |
| Vitest spawn đúng 77 worker là nguyên nhân timeout | 77 file không chứng minh 77 worker chạy đồng thời. Kiểm tra cấu hình/CPU/scheduling và benchmark suite; maxWorkers là phương án nếu xác nhận contention, không kết luận sẵn |
| Xóa Compose cũ | Không xóa tự động; gắn phạm vi full-stack và runbook phase1 riêng để giữ đường đợt 2 |
| HSTS 300s staging | Phù hợp như tùy chọn, không bắt buộc HSTS ở staging. Bỏ header mới không xóa cache HSTS cũ trên browser |

### 7.2. Hợp đồng timeout — bổ sung Task 3/6

- [ ] Lập timeline create → frame/PAD → DB match → VERIFIED → account eligibility → complete/cookie. Ghi timeout/TTL của FE, Nginx, Node, Python và Prisma thật, kiểm tra cancel/abort có dọn state hay chỉ đóng request.
- [ ] Kiểm tra TTL mà Node truyền có được Python chấp nhận trong router/schema; không nới Node TTL mà Python vẫn giữ cap cũ hoặc FE dùng thời hạn hardcode.
- [ ] Test bằng clock giả: đúng trước/tại/sau deadline, RPC abort, match xong sau deadline, verified freshness hết hạn trong eligibility lookup, cancel hoặc attempt mới lúc request cũ đang chạy. Không được phát cookie từ kết quả quá hạn/stale hoặc phiên đã bị thay thế.
- [ ] Giữ RPC 3000ms, TTL 15000ms, freshness 5000ms như hiện tại ở baseline đầu tiên. Nếu cần env sau phép đo, dùng validation số nguyên hữu hạn và giới hạn rõ: RPC 1000–5000ms, TTL 15000–30000ms là biên đề xuất ban đầu, phải xác minh cap Python/FE trước áp dụng. Không nới freshness 5000ms để che DB chậm.
- [ ] RPC mỗi frame không vượt thời gian còn lại của attempt; frame/DB work sau timeout không được commit phiên. Tăng TTL tăng số phiên/ảnh lưu RAM và thời gian bị lạm dụng, nên phải test capacity/memory/rate limit và cleanup.
- [ ] Bài cold start đo riêng: password/API DB đầu tiên và face login đầu tiên sau suspend, không warmup DB trước rồi gọi kết quả đó là cold face login. Nếu không đạt ngân sách, ghi Không đạt và ưu tiên sửa query/pool/deadline handling; không bỏ PAD hoặc retry mutation mù.
- [ ] Hai phiên đồng thời chỉ đạt khi cả hai đúng danh tính, không trộn session và đạt trải nghiệm đã định. Nếu overload trả 429 đúng hợp đồng thì đánh giá backpressure riêng; không gọi đó là đạt mục tiêu hai phiên thành công.

### 7.3. Pre-flight không chặn công việc độc lập

| Cổng | Đầu vào phải kiểm tra | Thiếu thì làm gì |
|---|---|---|
| Trước sửa/test local | Baseline đã nhận diện, dependency/lockfile; test branch khi chạy integration | Có thể sửa và chạy deterministic tests; không giả integration pass |
| Trước Docker local | Docker Linux engine, env phase1 thật hợp lệ, staging UAT, model manifest | Sửa env/template/cấu hình; không chạy nhầm DB production |
| Trước browser HTTPS local | mkcert CA tin cậy, HTTPS 8443, webcam, account đủ điều kiện/embedding | UI không camera vẫn thử được; FACE UAT ghi Chưa kiểm tra nếu thiếu camera/embedding |
| Trước integration Neon | Branch test chuyên dụng và quyền CREATE/DROP, TLS/guard URL, cleanup plan | Không dùng UAT/prod thay thế; local UAT dùng staging riêng vẫn tiến hành được |
| Trước OCI staging | VM ARM cấp thật, model/image đã chạy, domain/DNS/TLS và quyền truy cập | Tiếp tục local; không tự nâng gói hoặc hứa deploy xong trong một phiên |
| Trước production | Tất cả gate áp dụng, secret đã xử lý, backup restore/rollback, phạm vi được chốt | Giữ staging; không lấy readiness điểm cao hay review GO thay bằng chứng |

Credential từng lộ phải thu hồi nếu còn hiệu lực và cập nhật cả Node/Python, test trước production. Lỗi SMTP_FROM kiểm tra ở env phase1 được chọn thực tế; không nhất thiết sửa `backend/.env` cũ nếu phase1 không dùng file đó. Domain, account, webcam và quyền cài CA là điều kiện phải xác minh, không phải mặc định đã có.

**Tự kiểm tra cuối khi thực thi:** manifest không có service đợt 2; FE flag không đụng camera login; API fail-closed thật; auth deadline không bị nới mất an toàn; old/new runbook không lẫn; toàn bộ browser local và OCI có bằng chứng. Không tạo thêm middleware, package runtime, env tuning hoặc ASGI client khi công cụ hiện có đã đủ giải quyết.
