# SmartFace Oracle Cloud + Neon — kế hoạch triển khai và nghiệm thu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai SmartFace theo phương án A, không phụ thuộc laptop của thành viên, kiểm chứng nghiệp vụ bằng trình duyệt local trước khi nghiệm thu trên OCI.

**Architecture:** Oracle chạy frontend đã build qua Nginx, Express/Socket.IO, FastAPI và các dịch vụ IoT thuộc phạm vi nghiệm thu. Neon giữ PostgreSQL/pgvector; Node và Python có thể cùng truy cập DB. Pi tiếp tục chạy tại điểm chấm công. Web và API dùng cùng origin, FastAPI chỉ truy cập nội bộ.

**Tech Stack:** React/Vite, Nginx, Node.js/Express, Socket.IO, Python/FastAPI, Prisma, psycopg_pool, PostgreSQL/pgvector, Docker Compose, Raspberry Pi; ThingsBoard/MediaMTX theo phạm vi bên dưới.

**Spec:** Yêu cầu và bản kế hoạch người dùng cung cấp ngày 21/11/2026; phương án A đã được chọn. Tài liệu này hợp nhất kế hoạch gốc và các bổ sung, không phải báo cáo đã triển khai thành công.

**Review revision:** Đã đối chiếu `../reviews/2026-11-21-oracle-neon-deployment-evaluation.md` với code. Các quyết định và phản biện ở mục 7 là phần bắt buộc của kế hoạch, không phải chấp nhận nguyên văn review. Mục 7 thay thế các đề xuất còn mở trong phần trước khi có khác biệt.

## Global Constraints

- Chọn Oracle Cloud + Neon; không chuyển sang Vercel/Railway và không tự nâng cấp tài khoản trả phí.
- Không mất dữ liệu Neon hiện tại; dùng branch/database staging riêng cho thử nghiệm ghi, migration và lỗi phụ thuộc.
- Bắt buộc mở web local thật bằng trình duyệt và thao tác; terminal, API test và unit test không thay thế nghiệm thu UI.
- Nghiệm thu local dùng frontend production build qua Nginx; chỉ chạy Vite dev server chưa đủ.
- Các hành vi cookie Secure/HTTPS phải kiểm tra bằng HTTPS local và lặp lại trên OCI HTTPS. Không tắt Secure trên production để vượt kiểm thử.
- Không ghi secrets, khuôn mặt, embedding, token hoặc thông tin cá nhân thật vào bằng chứng công khai.
- Không reset/seed DB đang dùng, không xóa volume, không tự chạy migration phá dữ liệu.
- Không chỉnh các thay đổi đang có trong working tree ngoài phạm vi triển khai; không commit/push/deploy chỉ vì tài liệu này được tạo.
- Chỉ ghi Đạt khi có bằng chứng; chưa có camera/Pi, browser, VM hoặc tài khoản cần thiết thì ghi Chưa kiểm tra và nêu điều kiện còn thiếu.

## Review Focus

1. Migration/đổi model làm mất embedding hoặc nhận diện sai: kiểm tra SQL và hợp đồng model trước khi chạy (Task 2, 4).
2. Đăng nhập trên web thành công nhưng refresh/reconnect làm sai phiên: kiểm tra browser, cookie và Socket.IO (Task 5, 6).
3. Pi gửi lại sau mất mạng tạo chấm công trùng hoặc sửa kỳ đã khóa: kiểm tra luồng thiết bị và nghiệp vụ (Task 3, 5).
4. Neon suspend hoặc FastAPI lỗi khiến UI loading vô hạn: thử lỗi có kiểm soát trên staging và quan sát phục hồi (Task 5, 6).
5. VM/worker khởi động lại mất phiên PAD, file hoặc job chạy trùng: kiểm tra khôi phục và thông báo trên UI (Task 4, 6, 7).

## 1. Đánh giá thiếu/thừa và quyết định chốt

| Nội dung | Đánh giá | Điều chỉnh |
|---|---|---|
| Khung build → staging → kiểm thử → deploy → rollback | Giữ | Đúng thứ tự; bổ sung cổng nghiệm thu browser local trước OCI |
| FastAPI kết nối Neon nếu cần | Chưa cụ thể | Repo có `face_auth/database/vector_db.py` dùng psycopg_pool; xác minh những route sử dụng DB và cấu hình pool riêng |
| Luồng web → Node → FastAPI | Thiếu phạm vi | Bổ sung luồng Pi/ThingsBoard, sự kiện Socket.IO, camera MediaMTX |
| ARM64 | Giữ, đưa lên đầu | Phải chạy model thật trên ARM; build x86 trên Windows không chứng minh được |
| Migration/backup | Giữ, bổ sung kiểm tra SQL | Hướng dẫn hiện có cảnh báo migration rebuild embedding và seed xóa dữ liệu; không tự áp dụng |
| Hợp đồng embedding | Thiếu | Khớp model pack, model version, kích thước vector và tiền xử lý giữa web, Python, Pi, DB |
| Browser local | Thiếu tiêu chí cụ thể | Bổ sung ma trận thao tác, screenshot/video và bước refresh đọc lại dữ liệu |
| Pool/cold start | Giữ | Tính cả Prisma và psycopg_pool, mọi process/worker; không poll DB liên tục chỉ để chống suspend |
| HTTPS/camera/cookie | Thiếu phân biệt môi trường | HTTP localhost có thể dùng để smoke test; vẫn phải test cookie production và camera qua HTTPS |
| Transaction/retry/cron toàn hệ thống | Quá rộng nếu hiểu thành viết lại | Rà soát theo đường đi thật; chỉ sửa thiếu sót có bằng chứng, không refactor diện rộng |
| Liveness/readiness | Giữ, làm rõ | Kiểm tra ý nghĩa `/health`; healthcheck unhealthy không tự restart container còn chạy |
| Tải lớn/HA/Kubernetes | Không cần giai đoạn này | Đo tải đồ án dự kiến; không thêm nhiều worker/replica hoặc điều phối phức tạp trước khi cần |
| SSH, TLS, log, backup | Giữ | Có người phụ trách, lịch thực hiện và hướng dẫn phục hồi |
| Domain, quota, thu hồi VM | Thiếu cách xử lý | Xác minh endpoint HTTPS, giới hạn thực tế trong OCI; không cam kết miễn phí/ổn định tuyệt đối |

## 2. Phạm vi và căn cứ repository

| File/thư mục | Ý nghĩa và việc cần đối chiếu |
|---|---|
| `docker-compose.cloud.yml` | File độc lập, dùng DB ngoài, không tự migrate; backend mặc định development, web mặc định bind loopback |
| `frontend/nginx.conf` | HTTP 80, proxy `/api/`, `/socket.io/`, SPA fallback; cần chốt TLS/proxy headers |
| `backend/src/modules/auth/auth.controller.ts` | Cookie phụ thuộc NODE_ENV; kiểm thử đúng phiên production |
| `backend/src/config/env.ts` | Hợp đồng env backend; face login mặc định tắt |
| `face_auth/config.py`, `face_auth/database/vector_db.py` | URL Neon, pool psycopg, timeout, model và vector |
| `face_auth/Dockerfile`, `face_auth/requirements*.txt` | Tính tương thích ARM và model runtime |
| `docker/mosquitto.conf` | Anonymous đang bật cho broker nội bộ; không publish nguyên cấu hình này ra Internet |
| `docker-compose.iot.yml` | ThingsBoard, MediaMTX; cần chốt routing và bảo mật, pin phiên bản thay vì dựa vào latest |
| `hardware/RUN_ON_PI.md`, `hardware/README.md` | Pipeline thiết bị và cấu hình kết nối; phân biệt nhận diện tại Pi với face login web |
| `docs/tutorial/deployment/run_cloud_stack.md` | Runbook hiện có, có cảnh báo migration/seed; có thông tin PAD/đường dẫn có thể cũ, cần đối chiếu code thay vì sao chép |

Luồng cần chứng minh riêng:

1. Web → Nginx → Express → Neon → giao diện.
2. Web face login/enrollment → Express → FastAPI → Neon theo route thực tế → giao diện.
3. Pi nhận diện → tuyến IoT/ThingsBoard/backend thực tế → Neon → Socket.IO → dashboard.
4. Pi phát video → MediaMTX → trình duyệt nếu xem camera từ xa là tính năng được nghiệm thu.

Web, API, auth, nhân viên, công, OT, khóa kỳ và lương là phạm vi chính. IoT chấm công là bắt buộc để công bố hoàn tất toàn bộ SmartFace. Có thể nghiệm thu web trước; video chỉ được loại khỏi đợt phát hành khi ghi rõ phạm vi, không âm thầm đánh dấu đạt. Hai broker MQTT nội bộ và ThingsBoard không mặc định thay thế được nhau.

## 3. Kế hoạch thực hiện

### Task 0: Baseline và thứ tự không phụ thuộc cấp VM

**Files:** Đọc Git status và `2026-11-20-phase2-closeout.md`; không tự sửa/commit các thay đổi Phase 2.

- [ ] Ghi rõ release cần gồm thay đổi Phase 2 nào. Tạo worktree từ commit đã chọn nếu chỉ triển khai code đã commit; cách này KHÔNG mang theo thay đổi chưa commit.
- [ ] Nếu cần Phase 2 chưa commit, giữ nguyên workspace hiện tại và hoàn tất/chụp snapshot có chủ đích trước khi đóng release. Không stash/reset/commit toàn bộ để làm sạch status.
- [ ] Mọi evidence ghi đúng commit và phần thay đổi đi kèm; local exploratory test được phép trên workspace hiện có nhưng không coi đó là release tái lập được.
- [ ] Thực hiện hai luồng công việc độc lập: (A) xin VM và spike ARM của TẤT CẢ image được chọn; (B) Neon staging, cấu hình và kiểm thử local. Không chặn B chỉ vì A chưa có capacity; đây là thứ tự công việc, không yêu cầu tạo subagent.
- [ ] Chỉ hợp nhất hai luồng ở cổng OCI staging: local UAT đạt, baseline được đóng gói và ARM/model đã chứng minh hoạt động.

**Đạt khi:** Có baseline tái lập và phạm vi release rõ; không mất hoặc vô tình bỏ thay đổi đang làm.

### Task 1: Chụp hiện trạng và kiểm chứng hạ tầng/ARM

**Files:** Đọc Compose/Dockerfile/package.json/requirements và hướng dẫn hiện có; cập nhật runbook tại `docs/tutorial/deployment/run_cloud_stack.md` khi đã xác minh.

**Interfaces:** Đầu vào là phiên bản repo và hạn mức OCI thực tế. Đầu ra là danh sách image/model chạy được trên ARM, phạm vi đợt phát hành và ngân sách tài nguyên.

- [ ] Ghi commit, thay đổi chưa commit và danh sách dịch vụ cần triển khai; không ghi nhận working tree bẩn là release đã đóng gói.
- [ ] Xác minh quota, shape, dung lượng, network, Always Free và khả năng tạo VM; phân biệt tài nguyên free với credit dùng thử.
- [ ] Chọn endpoint HTTPS hoạt động được với ngân sách 0 đồng; xác minh DNS, chứng chỉ và khả năng gia hạn. Không giả định đã có domain miễn phí.
- [ ] Build trên ARM thực tế; import thư viện, nạp model, inference ảnh thử được phép sử dụng, kết nối DB staging. Ghi peak RAM và thời gian khởi động.
- [ ] Đối chiếu đường dẫn model/PAD và checksum/version; xác định model đóng trong image, bind mount hay cache volume.
- [ ] Ghi số người dùng/phiên AI/thiết bị dự kiến và người phụ trách triển khai, DB, UI, Pi. Nếu ARM không chạy hoặc không cấp được VM thì ghi blocker, chưa chuyển sang deploy.

**Đạt khi:** Có log xác minh ARM cho face-auth, ThingsBoard nếu dùng, MediaMTX và các image còn lại; có tài nguyên thực cấp, không suy luận từ Windows/x86. Mục tiêu cấp VM là A1 2 OCPU/12 GB trong quota tài khoản; đây không phải cấu hình tối thiểu đã đo. Không chọn E2 Micro 1 GB cho toàn bộ stack này. Nếu sau 3–5 ngày chưa cấp được A1: ghi blocker, tiếp tục local, thử availability domain hợp lệ trong home region hoặc xem nguồn VM của trường; không tạo tài khoản mới/đổi region tùy tiện, không tự nâng PAYG. Budget alert không phải hard spending cap.

### Task 2: Neon staging, migration và khôi phục

**Files:** `backend/prisma/schema`, `backend/prisma/migrations`, `backend/.env.example`, `face_auth/.env.example` nếu đã có; bắt buộc sửa timeout tại `face_auth/api_service.py`, `face_auth/config.py`, `face_auth/database/vector_db.py` theo mục 7.2 và 8.2.

**Interfaces:** Cả Node/Python trỏ cùng DB staging; Prisma dùng direct endpoint cho migration và runtime dùng endpoint phù hợp từng driver.

- [ ] Tạo/chọn staging branch riêng và tài khoản test; branch có dữ liệu thật phải được kiểm soát truy cập hoặc làm sạch dữ liệu nhạy cảm.
- [ ] Kiểm tra TLS, schema, vector 512D/index và migration history. Không dùng reset để vượt lỗi baseline.
- [ ] Đọc SQL pending; xác định migration xóa/rebuild embedding, tác động dữ liệu và tương thích image trước/sau.
- [ ] Kiểm tra model/version/tiền xử lý với dữ liệu hiện có; cùng số chiều chưa đủ chứng minh cùng không gian embedding.
- [ ] Cấu hình tổng pool Prisma + psycopg_pool theo process/worker, timeout hữu hạn; không dùng tùy chọn của driver này cho driver khác.
- [ ] Backup DB và restore vào DB riêng; đối chiếu số bản ghi quan trọng và đọc dữ liệu qua ứng dụng.
- [ ] Thử migration trên staging, kiểm tra dữ liệu trước/sau và quyền runtime đủ dùng; không cấp quyền quản trị chỉ để bỏ qua lỗi.

**Đạt khi:** Có kết quả restore và migration staging, không mất dữ liệu ngoài kế hoạch. Seed chỉ chạy trên môi trường test riêng sau khi đã đọc tác động.

### Task 3: Cấu hình production và luồng IoT

**Files:** `docker-compose.cloud.yml`, `.env.compose.example`, env example của từng service, `frontend/nginx.conf`, `docker-compose.iot.yml`, `docker/mosquitto.conf`; cấu hình Pi theo hướng dẫn hiện có.

**Interfaces:** Một origin cho web/API/Socket.IO; Node → `http://face-auth:5000`; DB ngoài là Neon. Endpoint thiết bị phải định tuyến được từ nơi đặt Pi.

- [ ] Dùng riêng cloud Compose; kiểm tra cấu hình bằng `docker compose --env-file .env.compose -f docker-compose.cloud.yml config --quiet`. Không in config chứa secret.
- [ ] Đặt production env, origin thật, secrets và internal key; kiểm tra face login được bật/tắt nhất quán giữa Node/Python.
- [ ] Triển khai TLS theo mục 7.3: Caddy biên → Nginx frontend → Node; local dùng mkcert + override HTTPS 8443. Thiết lập Host/forwarded headers và trust proxy đúng tuyến tin cậy, giữ proxy API và upgrade Socket.IO; xem cổng quyết định ở mục 8.4.
- [ ] Tách env local/staging/production; local không được vô tình ghi Neon production. Env FE là dữ liệu công khai, không đặt DB URL/secrets trong đó.
- [ ] Liệt kê volume, quyền đọc/ghi, log rotation, restart policy và phiên bản image. Kiểm tra gallery read-only có phù hợp route enrollment thực tế hay không.
- [ ] Chốt tuyến Pi → ThingsBoard/backend và xác thực thiết bị. Broker anonymous nội bộ chỉ dùng nội bộ; nếu công khai phải cấu hình auth/TLS hoặc kênh riêng bảo mật.
- [ ] Nếu có video: kiểm tra RTSP, WHEP/WebRTC, public/ICE host, TCP/UDP và xác thực stream; bổ sung TURN chỉ khi đo thực tế cho thấy cần.
- [ ] Firewall OCI và VM chỉ mở cổng cần thiết; giới hạn SSH; không công khai FastAPI, DB hoặc trang quản trị IoT mặc định.

**Đạt khi:** Luồng truy cập được mô tả bằng endpoint thật, secrets không lộ, Pi không kết nối nhầm broker; có cấu hình local tái lập được.

### Task 4: Kiểm tra tự động và sửa tối thiểu

**Files:** Các module auth/attendance/payroll/socket/face-login và tests hiện có liên quan tới lỗi tìm được; không mặc định sửa toàn bộ module.

**Interfaces:** Kiểm tra tĩnh và hồi quy là điều kiện vào browser test, không phải thay thế browser test.

- [ ] Chạy frontend lint/build và backend build/test phù hợp bằng scripts trong package.json; ghi lệnh, exit code, thời điểm, lỗi có sẵn và lỗi mới.
- [ ] Chạy test Python hiện có phù hợp sau khi đọc `face_auth/AGENTS.md`; không tự đặt lệnh test không tồn tại.
- [ ] Với lỗi logic/security/tiền lương cần sửa: thêm test tái hiện thất bại, sửa tối thiểu, chạy lại test và các luồng liên quan.
- [ ] Hoàn tất các nhóm sửa đã xác minh ở mục 7.2 trước khi chạy staging dài ngày; kiểm tra job recovery, cron đúng hạn và Neon idle bằng test riêng.
- [ ] Kiểm tra transaction tại thao tác nhiều bảng, idempotency khi thiết bị retry, timezone nghiệp vụ Asia/Ho_Chi_Minh, quyền khóa/mở khóa và job chạy trùng.
- [ ] Không retry mù thao tác ghi; không đổi model hoặc thêm worker PAD khi chưa hiểu trạng thái phiên. Bắt đầu một worker nếu phiên lưu trong RAM.
- [ ] Xác minh health/readiness thật: tiến trình HTTP sống chưa chứng minh DB/model hoạt động. Lỗi dependency không nên tự gây restart loop phá phiên.

**Đạt khi:** Build và kiểm tra bắt buộc đạt; lỗi nghiêm trọng được sửa và có hồi quy. Nếu test hạ tầng bị chặn thì ghi Chưa kiểm tra.

### Task 5: Nghiệm thu bằng trình duyệt local — bắt buộc

**Files:** Không cần thêm framework E2E mới nếu công cụ browser hiện có đủ dùng. Lưu evidence theo mục 4.

**Interfaces:** Frontend production build qua Nginx, HTTP smoke tại `http://localhost:8080`; nghiệm thu production bắt buộc tại `https://localhost:8443` bằng mkcert + `docker-compose.local-https.yml` theo mục 7.3. Backend/Python dùng Neon staging, không dùng DB test tạm của runner làm DB UAT.

- [ ] Khởi động cloud stack local và mở ứng dụng bằng browser tương tác. Ghi URL, browser/version, commit, tài khoản theo vai trò và DB branch đã che thông tin nhạy cảm.
- [ ] Thực hiện toàn bộ ma trận dưới đây; nhìn kết quả render thật, không chỉ đọc DOM, gọi API hoặc xem terminal.
- [ ] HTTP chỉ smoke UI-01. Toàn bộ ca UAT thuộc phạm vi release phải đạt trên HTTPS local với `NODE_ENV=production`, bao gồm AUTH-01/02/03, FACE-01/02 và RT-01; không chỉ kiểm tra HTTPS ở trang đăng nhập. Đối chiếu ràng buộc thiết bị/video ở mục 8.4.
- [ ] Lưu ảnh/video ở bước quan trọng, kiểm tra Console/Network khi có lỗi; refresh hoặc mở phiên mới để xác nhận dữ liệu đã lưu.
- [ ] Test camera thật với sự cho phép của người tham gia; nếu dùng camera giả để kiểm tra UI thì ghi rõ, không coi đó là đạt PAD/nhận diện thật.
- [ ] Kiểm tra đồng thời bằng các browser context/phiên đăng nhập độc lập; nhiều tab chung cookie không chứng minh hai người dùng độc lập.
- [ ] Khi có lỗi: ghi bước tái hiện, sửa, chạy lại ca lỗi và ca liên quan trước khi chuyển OCI.

| ID | Thao tác thật trên web | Kỳ vọng/bằng chứng |
|---|---|---|
| UI-01 | Mở trang, vào URL con, refresh, back/forward | Không trắng trang/404; SPA và navigation đúng |
| AUTH-01 | Sai/đúng mật khẩu, refresh, logout, truy cập lại | Phiên tạo/hủy đúng; không hiện dữ liệu sau logout |
| AUTH-02 | Admin/manager/employee vào trang và thao tác vượt quyền | UI và API cùng kiểm soát; không chỉ ẩn nút |
| AUTH-03 | Hết hạn/thu hồi phiên khi đang mở web và Socket.IO | Từ chối đúng; không tiếp tục nhận dữ liệu trái quyền |
| EMP-01 | Thêm/sửa, dữ liệu sai/trùng, xóa theo quy tắc ứng dụng | Báo lỗi đúng, không báo thành công giả, refresh vẫn đúng |
| FACE-01 | Cho phép/từ chối camera, nhận diện, PAD fail, hủy/thử lại | Preview/trạng thái đúng, giải phóng camera/phiên |
| FACE-02 | Hai phiên độc lập; frame sai thứ tự/trùng qua test bổ trợ | Không trộn phiên/embedding, UI hiện kết quả đúng người |
| ATT-01 | Pi tạo lượt chấm công khi dashboard mở | Event thật xuất hiện không cần refresh; đọc lại vẫn tồn tại |
| ATT-02 | Thiếu lượt, ca qua đêm, log đến muộn và retry | Kết quả đúng bộ dữ liệu kỳ vọng; không nhân đôi |
| LOCK-01 | Khóa kỳ rồi gửi thêm log/chạy tổng hợp/điều chỉnh | Không sửa kết quả khóa trái quy trình; UI giải thích đúng |
| PAY-01 | Duyệt/từ chối OT, ngưỡng OT, hệ số và kỳ lương | Số tiền khớp bảng kỳ vọng lập trước, không lấy chính code làm oracle |
| FAIL-01 | Dừng FastAPI khi web đang dùng rồi bật lại | Lỗi hữu hạn, hết loading, thử lại được, không lộ chi tiết nội bộ |
| FAIL-02 | Làm DB staging mất kết nối; khôi phục; thử cold start thật | Không ghi trùng/báo thành công giả; tự phục hồi đúng thiết kế |
| RT-01 | Ngắt mạng browser rồi nối lại | Reconnect và đồng bộ lại dữ liệu, không phụ thuộc event đã mất |
| VIEW-01 | Desktop 1366×768 và màn hình hẹp 390×844 | Nút/form/bảng dùng được; không che thao tác chính |
| VIDEO-01 | Mở/tắt live camera nếu thuộc phạm vi | Stream thật phát được, quyền truy cập đúng, dọn kết nối khi rời trang |

Mô phỏng chỉ là bằng chứng bổ trợ. Không đánh dấu đạt phần cứng nếu chỉ gửi event giả. Không cố tình ngắt Neon production. Cold start chỉ đánh dấu đạt khi xác nhận compute thực sự suspend; không suspend được thì ghi chưa kiểm tra.

**Đạt khi:** Các ca bắt buộc được thao tác và quan sát trên browser local, có evidence. Không có browser/camera/Pi thì dừng tại trạng thái chưa nghiệm thu phần tương ứng, không thay bằng curl.

### Task 6: OCI staging, tải và phục hồi

**Files:** Runbook triển khai hiện có; cấu hình TLS/firewall và release image theo Task 3.

**Interfaces:** Release đã qua local → OCI HTTPS với Neon staging; không đổi sang DB production ở bước này.

- [ ] Deploy đúng image/commit đã kiểm tra; xác nhận HTTPS, gia hạn chứng chỉ, DNS và secret thật không xuất hiện trong frontend/log.
- [ ] Mở web OCI bằng browser; lặp lại auth, refresh, Socket.IO, một thao tác ghi/đọc, face login và Pi. Kiểm tra bằng mạng ngoài LAN, camera permission và mixed content.
- [ ] Kiểm tra Pi offline/reconnect, replay dữ liệu nếu hệ thống có hỗ trợ; nếu chưa có offline queue thì ghi đúng giới hạn, không cam kết tự bù log.
- [ ] Reboot VM và restart/thay container; quan sát dữ liệu còn nguyên, phiên đang dở báo lỗi hữu hạn và có thể bắt đầu lại.
- [ ] Tăng tải từ nhỏ tới tải mục tiêu đã ghi; theo dõi CPU, RAM/peak, swap/OOM, p50/p95, tỷ lệ lỗi, pool DB và thời gian AI.
- [ ] Kiểm tra tải web và AI cùng lúc; không dùng số RAM cấp phát để kết luận đủ hiệu năng CPU.
- [ ] Ghi kết quả latency tới Neon theo region thực tế. Không bật job keepalive vô hạn để né giới hạn free tier.

**Ngưỡng nghiệm thu đề xuất, chưa phải kết quả đo:** Dùng duy nhất bảng mục 7.4: 5 tài khoản web độc lập + 1 Pi + 1 phiên face login trong 15 phút; API warm p95 ≤2s, Pi → UI ≤3s, AI frame p95 ≤2s/phiên ≤10s, enrollment ≤15s, cold start ≤8s. Đo riêng từng loại và ghi số mẫu theo mục 8.5. Nếu nhóm có tải mục tiêu cao hơn, chốt trước khi đo.

**Đạt khi:** Browser OCI và tải đã đo đạt ngưỡng mục 7.4; reboot tự lên, dependency phục hồi. Không có kết quả đo AI/cold start thì hai mục đó chưa đủ điều kiện nghiệm thu.

Ngưỡng AI/cold start ban đầu được bổ sung ở mục 7.4 để không để trống. Nếu đo cho thấy không đạt thì ghi Không đạt và xử lý hoặc điều chỉnh yêu cầu có giải thích trước khi chạy lại, không sửa ngưỡng sau test chỉ để biến failure thành pass.

### Task 7: Release, rollback và bàn giao nhóm

**Files:** `docs/tutorial/deployment/run_cloud_stack.md` cập nhật theo kết quả thực tế; evidence và release manifest của đợt triển khai.

**Interfaces:** Staging đã nghiệm thu → release production có kiểm soát, backup và image trước đó sẵn sàng.

- [ ] Ghi phiên bản image/digest, code, model, schema, cấu hình không chứa secret và người chịu trách nhiệm; giữ image trước đó.
- [ ] Nhóm dùng PR và một tuyến deploy được kiểm soát; chỉ một tiến trình chạy migration/deploy mỗi lần. Không bắt buộc thêm CI/CD mới để hoàn tất đợt đầu.
- [ ] Xác minh backup/restore và tương thích schema với image rollback. Không mặc định rollback DB bằng migration ngược.
- [ ] Chốt điều kiện rollback: lỗi auth/phân quyền, sai công/lương, mất dữ liệu, nhận diện nhầm hoặc gián đoạn vượt ngưỡng đã ghi.
- [ ] Với schema phá tương thích: xác định dừng ghi, restore sang DB riêng/cutover hoặc forward fix, cùng nguy cơ mất dữ liệu sau thời điểm backup. Không restore đè mù.
- [ ] Trước thay đổi production, xác nhận phạm vi dữ liệu/backup và quyền thực hiện trong phiên làm việc; kế hoạch không tự cấp quyền thao tác phá dữ liệu.
- [ ] Khi được phép release: backup → migration đã thử → deploy → browser smoke test production với dữ liệu thử được kiểm soát → theo dõi.
- [ ] Bàn giao cách khởi động/dừng, xem log không lộ secret, đổi secret, backup, restore, SSH theo tài khoản riêng và xử lý VM bị thu hồi.
- [ ] Trong giai đoạn đồ án: đề xuất backup hàng ngày và trước migration, giữ 7 bản gần nhất ở nơi ngoài VM; người phụ trách xác minh dung lượng/chi phí và lịch thực hiện trước khi bật.
- [ ] Có bản Compose/config và image tái lập được ngoài VM; giữ backup dữ liệu ThingsBoard nếu dùng, không chỉ backup Neon.

**Đạt khi:** Diễn tập rollback trên staging thành công, người khác trong nhóm làm theo runbook được, production có browser smoke test và đầu mối theo dõi.

## 4. Hồ sơ kiểm thử và trạng thái

Đề xuất lưu kết quả mỗi đợt vào `docs/reports/deployment/<release-id>/`; chỉ tạo khi thực sự chạy kiểm thử. Screenshot/video chứa thông tin nhạy cảm lưu riêng có kiểm soát, trong báo cáo chỉ tham chiếu bằng tên đã làm sạch. Không commit .env, dump DB hoặc sinh trắc học vào Git.

| ID ca | Môi trường/URL | Code/image/model | Vai trò/dữ liệu thử | Kỳ vọng | Thực tế | Đạt/Không đạt/Chưa kiểm tra | Bằng chứng | Người thử/thời điểm |
|---|---|---|---|---|---|---|---|---|
| UI-01 | Chưa chạy | Chưa ghi | Chưa ghi | Theo ma trận | Chưa quan sát | Chưa kiểm tra | Chưa có | Chưa ghi |

Mỗi ca ghi các bước đủ tái hiện. Ảnh trang đăng nhập chỉ chứng minh trang đó được render; không chứng minh CRUD, công/lương, PAD hay IoT hoạt động. Test HTTP 200 chỉ là bằng chứng API; test DOM không có quan sát render chưa đủ cho yêu cầu xem web thật.

## 5. Cổng cho phép go-live

- [ ] ARM/model và tải dự kiến đã được kiểm chứng trên VM thật.
- [ ] Build và kiểm tra tự động bắt buộc đạt; không bỏ qua failure chưa hiểu nguyên nhân.
- [ ] **Các ca browser local bắt buộc đã đạt và có ảnh/video/kết quả quan sát.**
- [ ] Browser OCI HTTPS đã thử cookie, camera, Socket.IO và luồng đọc/ghi.
- [ ] Pi chấm công thật đã đạt; video đạt hoặc được ghi rõ ngoài phạm vi release.
- [ ] Không còn lỗi nghiêm trọng về dữ liệu, xác thực, phân quyền, PAD, công và lương.
- [ ] Migration/model tương thích dữ liệu; không seed/reset DB đang dùng.
- [ ] Pool/cold start/mất kết nối/reboot đã thử; các mục chưa kiểm tra không được ngụy trang thành đạt.
- [ ] Volume, backup ngoài VM, restore và rollback đã diễn tập.
- [ ] HTTPS, firewall, secret, xác thực thiết bị và quyền xem camera được kiểm tra.
- [ ] Có người theo dõi, runbook, giới hạn chi phí và phương án dựng lại khi mất VM.

**Trạng thái tại lúc lập file:** Chỉ hoàn thành rà soát kế hoạch và một số cấu hình nguồn. Chưa có bằng chứng build, browser local, ARM, OCI, migration/restore hoặc tải trong lần rà soát này. Không công bố hệ thống sẵn sàng production từ tài liệu này.

## 6. Phần chủ động không làm trong đợt này

Không chuyển database khỏi Neon; không thêm Kubernetes/HA/microservice mới; không tách frontend sang nền tảng khác; không viết lại toàn bộ auth/công/lương/cron; không tăng worker PAD khi chưa kiểm chứng trạng thái; không viết E2E trùng lặp mọi unit test. Chỉ bổ sung tự động hóa cho hồi quy quan trọng và giữ nghiệm thu browser trực tiếp.

Hạn mức/dịch vụ miễn phí có thể thay đổi. Cần xác minh trong console và tài liệu nhà cung cấp khi triển khai; kế hoạch không cam kết uptime, miễn phí vô điều kiện hoặc hiệu năng khi chưa đo.

## 7. Xử lý nhận xét review và quyết định kỹ thuật bổ sung

### 7.1. Phần chấp nhận và phần cần phản biện

| Nhận xét | Kết luận sau đối chiếu |
|---|---|
| Worker 1s, health Python 10s, alerts 60s liên tục truy cập Neon | Xác nhận code. Phải sửa trước staging dài ngày; còn cần kiểm tra truy vấn định kỳ khác, pool và dashboard browser để đo idle thật |
| Đổi poll thành 5–10 phút là giải quyết suspend | Chỉ chấp nhận một phần. Chu kỳ 5 phút có thể không tạo cửa sổ idle đủ; nhiều timer lệch nhau cũng giữ DB thức. Không hứa tiết kiệm 70–85%; đo CU-hours và suspend thực tế |
| Python có thể treo vô hạn, truyền hai tham số là đủ | Sửa cách diễn đạt: pool có timeout mặc định hữu hạn, nhưng timeout socket/query chưa được cấu hình đầy đủ. `query_timeout_ms` hiện chỉ được dùng ở một đường truy vấn, không tự bao phủ health/schema/enrollment khi chỉ truyền vào constructor |
| Proxy sai chắc chắn làm hai người khóa lẫn nhau | Thiếu IP thật là đúng; khóa phụ thuộc số request trong cửa sổ rate limit. Bổ sung test nhiều client và giả mạo header, không suy diễn failure chắc chắn từ số phiên |
| Hardcode trust proxy=2 | Không áp dụng mù. Hai hop chỉ đúng cho tuyến Caddy → Nginx → Node cố định, không có đường public ngắn hơn. Không tin header do client gửi; proxy biên phải chuẩn hóa header |
| Compose thiếu face env nên biến hoàn toàn không tới container | Chỉ đúng với nguồn `.env.compose`: interpolation không tự đưa tất cả biến vào container. `env_file` backend/face_auth vẫn có thể đã cung cấp; phải chọn một nguồn và test hiệu lực, không tuyên bố biến luôn mất |
| Không nằm trong Zod đồng nghĩa env bị bỏ | Không đúng với các route đọc `process.env` trực tiếp. Vấn đề là thiếu validation sớm/nguồn thống nhất, không phải biến bị Zod xóa khỏi process.env |
| Cứ profile hóa mqtt là xong | Có thể làm backend không khởi động vì `depends_on: mqtt`. Chỉ bỏ service khi sửa đồng bộ dependency, MQTT_URL và ENABLE_MQTT; không mặc định gọi broker là legacy |
| HTTPS bắt buộc cho mọi getUserMedia | HTTPS bắt buộc trên web từ xa; localhost là ngoại lệ secure-context. Vẫn dùng HTTPS local để nghiệm thu cookie production, không hạ Secure |
| Tailscale/WireGuard giải quyết toàn bộ mạng mà không cần thay đổi | VPN là hướng phù hợp, nhưng còn ACL, route, binding Docker và identity thiết bị. WireGuard server cần UDP endpoint; không thể mặc định chỉ mở TCP 80/443/22 cho mọi VPN |
| Chỉ proxy WHEP qua HTTPS là đủ video | Chưa đủ. Signaling HTTPS và auth không tự giải quyết ICE/media UDP/TCP/TURN. Cần kiểm tra quyền POST/PATCH/DELETE phiên WHEP, đường media và cleanup |
| Loại video khỏi Đợt 1 | Không tự thay phạm vi người dùng đã chốt. Mặc định giữ tính năng hiện có để nghiệm thu; nếu thiếu đường media an toàn thì video là blocker phần video, chỉ tách release khi nhóm chốt rõ |
| Tar volume ThingsBoard đang chạy hoặc chỉ export JSON là đủ backup | Không đúng. Tar DB đang ghi không đảm bảo nhất quán; export cấu hình không chứa mọi device credential/telemetry. Phải dump nhất quán hoặc dừng ghi để snapshot và thử restore |
| OCI lifecycle giữ đúng 7 bản, pg_dump rồi nén thêm | Lifecycle thường theo tuổi/điều kiện object, không mặc định giữ N bản. Dùng manifest/script retention theo số bản nếu muốn đúng 7; custom pg_dump đã có compression, không bắt buộc nén thêm |
| Thang điểm, RAM tối thiểu, <15 phút dựng lại | Nhận định reviewer, chưa phải số đo. Không đưa thành kết quả hoặc cam kết; lấy thời gian restore, peak RAM thực tế làm bằng chứng |

### 7.2. Nhóm sửa bắt buộc, file và bằng chứng hồi quy

**P0 — Neon idle mà vẫn giữ đúng nghiệp vụ**

- [ ] `backend/src/modules/operations/operation.worker.ts`: tận dụng wake-on-enqueue, drain hết queue khi có việc; giữ lease heartbeat khi chạy job, cleanup và recovery sau crash. Thay polling idle 1 giây bằng cơ chế recovery có khoảng idle lớn hơn thời gian suspend thực tế. Không chỉ tăng interval rồi làm job đã xếp hàng chờ 10 phút.
- [ ] Test: enqueue nhiều job phải được xử lý kịp mà không cần tick định kỳ; enqueue lúc worker busy không mất wake; job hết lease được nhận lại; job hoàn thành không chạy trùng; input hết TTL được dọn theo chính sách.
- [ ] `face_auth/api_service.py`, cloud Compose: thêm `/health/live` không query DB, `/health/ready` kiểm tra model và DB có timeout. Giữ `/health` tương thích caller cũ hoặc cập nhật tất cả caller có chủ đích. Docker dùng liveness; readiness chạy ở deployment và theo nhu cầu, không tạo DB keepalive mới. Live kiểm tra tiến trình, ready mới xác nhận model/PAD đã bật sẵn sàng; không lẫn hai ý nghĩa.
- [ ] `backend/src/modules/attendance/attendance.cron.ts`: lịch cảnh báo theo ca/mốc nghiệp vụ hoặc khoảng quét được định nghĩa rõ; giữ aggregation/auto-close, catch-up sau downtime và chống trùng. Không giảm tần suất âm thầm nếu làm cảnh báo trễ trái yêu cầu.
- [ ] Test: idle không tạo truy vấn định kỳ dưới cửa sổ suspend; mốc ca và 00:05 VN vẫn chạy đúng, missed schedule sau restart được xử lý. Chạy một bài đo suspend không traffic ngoài hệ thống và một bài tải sử dụng thật riêng biệt.
- [ ] Dự toán compute từ số giờ active × CU trung bình và quota dashboard thực tế; nếu yêu cầu cảnh báo 24/7 khiến DB không thể ngủ thì ghi xung đột với ngân sách 0 đồng thay vì hứa cả hai.

**P0 — Timeout Python xuyên suốt**

- [ ] `face_auth/api_service.py`, `face_auth/config.py`, `face_auth/database/vector_db.py`: truyền config timeout hợp lệ vào VectorDB, bao phủ checkout/connect/query cho health, startup/schema, enrollment và recognition. Dùng transaction-local statement timeout khi cần phù hợp pooled endpoint; không mặc định startup `options` được pooler hỗ trợ.
- [ ] Đề xuất ban đầu: pool acquire 5s, connect 5s, query 5s; đây là ngân sách từng bước, không phải toàn request 5s. Căn chỉnh timeout Node/Nginx và cold start; đo end-to-end, kiểm tra thread/connection được trả sau timeout.
- [ ] Test mất DB/slow query cho từng route liên quan; timeout hữu hạn, không lộ conninfo và browser hết loading. Không cam kết constructor timeout tự giới hạn mọi câu SQL.

**P0 — Proxy, IP và quyền thiết bị/video**

- [ ] `backend/src/app.ts`, `config/env.ts`, `frontend/nginx.conf`: cấu hình trust proxy theo topology cố định, validate giá trị; proxy API/face-login/Socket.IO truyền Host/IP/proto nhất quán. Caddy biên bỏ qua header client giả; Nginx chỉ nhận forwarded proto từ Caddy tin cậy. Không copy `$http_x_forwarded_proto` vô điều kiện ở tuyến public.
- [ ] Test client IP đúng, không chia quota cho mọi người, header giả không né rate limit, không lỗi unexpected XFF, cookie production và redirect đúng HTTPS.
- [ ] `docker-compose.iot.yml`, MediaMTX config, `WebRTCPlayer.tsx`, frontend build/proxy: không fallback HTTP khi trang HTTPS, không dùng role FE làm ranh giới bảo mật. Ưu tiên URL signaling cùng origin với xác thực ADMIN phía server, kiểm tra mọi phương thức/session URL WHEP; cấu hình media path độc lập.
- [ ] Với env Vite: runtime container env không đổi bundle đã build; dùng relative URL hoặc truyền build arg có chủ đích. `.env` được COPY lúc build còn có thể làm lộ cấu hình, phải kiểm tra `.dockerignore`.
- [ ] Test ngoài tailnet không vào được IoT/admin/raw stream; trong kênh riêng vẫn cần device/webhook credentials. Không publish 1883/8554/8081/7070/8889 rộng ra Internet. Xác minh cả NSG và Docker firewall bằng kết nối từ máy ngoài, không chỉ nhìn UFW.

**P1 — Env, model, dependency và log**

- [ ] Thống nhất nguồn face env giữa `.env.compose`, `backend/.env`, `face_auth/.env`; sửa examples và kiểm tra flag/key nhận đúng nhưng không in giá trị secret.
- [ ] Validate `TB_WEBHOOK_SECRET` khi bật route IoT (≥24 ký tự theo code); `REMOTE_RECOGNITION_ENABLED`/`EDGE_RECOGNITION_KEYS` chỉ bắt buộc khi dùng offload. Không bắt Pi giữ webhook secret của ThingsBoard; cấu hình `X-TB-Webhook-Secret` trong REST node server và kiểm thử header sai/thiếu.
- [ ] Chốt giữ/bỏ Mosquitto sau đối chiếu tuyến thật; khi dùng profile sửa cả dependency và test cả hai mode khởi động. Bổ sung log rotation mọi service phù hợp.
- [ ] Models được đóng gói hoặc đồng bộ bằng manifest/checksum trước startup; thiếu model khi face login bật phải lộ readiness failure, không healthy giả.
- [ ] Pin image/tag/digest và bộ dependency API đã kiểm chứng ARM. Headless OpenCV là ứng viên, không tự đổi khi chưa kiểm tra dependency kéo cả hai OpenCV/ABI/model; giữ nguyên môi trường nghiên cứu/PAD ngoài phạm vi.

### 7.3. Chốt TLS, VPN và backup để triển khai được

**TLS:** Giữ Nginx frontend để ít thay đổi; thêm Caddy ngoài cùng tại OCI, domain sẵn có hoặc DuckDNS được cấp thực tế. Caddy → Nginx → Node là tuyến cố định; public chỉ 80/443, SSH giới hạn hoặc qua VPN. Không thêm Cloudflare proxy/CDN ngầm làm thay đổi số hop. Local dùng mkcert cho `localhost`, `127.0.0.1`, `::1`, CA được tin cậy trên máy test; override `docker-compose.local-https.yml` và Caddyfile local phục vụ `https://localhost:8443`. Không commit private key/CA. Không bỏ lỗi chứng chỉ khi nghiệm thu. Kiểm tra nghĩa vụ và khả năng cấp chứng chỉ domain trước khi công bố endpoint hoạt động; không coi mọi domain dùng chung chắc chắn bị rate limit.

**VPN:** Chọn Tailscale làm mặc định đề xuất cho Pi ↔ OCI sau khi xác minh điều kiện free của tài khoản/nhóm; ACL chỉ cấp cổng cần thiết, bảo vệ enrollment key và xử lý node expiry/reboot. Không coi WireGuard là lựa chọn thay thế không cần cấu hình: nếu dùng phải ghi UDP listen port, peer, firewall và keepalive. Bind IoT vào VPN IP hoặc giữ nội bộ + tuyến proxy riêng; loopback một mình không cho Pi từ xa kết nối. Với live video cho browser ngoài VPN, HTTPS signaling chưa đủ: phải nghiệm thu ICE/media an toàn hoặc yêu cầu browser vào VPN có ACL phù hợp, và ghi rõ giới hạn truy cập.

**Backup:** Dùng job `pg_dump --format=custom --no-owner` với client tương thích major Postgres, direct endpoint TLS, secret ngoài command/log; upload bucket private ngoài VM. OCI Object Storage là đích đề xuất, phải xác minh quota miễn phí cả dung lượng/request/retention trong tài khoản trước khi bật; không hardcode 20 GB là bảo đảm. IAM tối thiểu, mã hóa và đường tải phục hồi được kiểm chứng. Cron cùng VM chỉ là lịch chạy, không phải bảo vệ nếu VM mất trước lần dump; giám sát thời điểm backup thành công cuối cùng.

Giữ 7 bản ngày và bản trước migration bằng script/manifest; lifecycle theo tuổi chỉ dùng nếu chấp nhận semantics đó. ThingsBoard backup DB nhất quán hoặc dừng ghi trước snapshot; export dashboard/rule chain chỉ là bổ trợ. Restore vào môi trường riêng, kiểm tra app, credential, telemetry cần giữ và đo thời gian. Không cam kết dựng lại <15 phút trước diễn tập. Lịch backup cũng đánh thức Neon, cần tính vào ngân sách và đo idle.

### 7.4. Lệnh kiểm tra và ngưỡng ban đầu

Các lệnh dưới đây dành cho lúc thực thi kế hoạch, chưa được chạy trong lần sửa tài liệu này. Chạy trong đúng thư mục, không nối tiếp bằng dấu `;` để che failure; dừng khi bước bắt buộc lỗi.

| Thư mục | Lệnh |
|---|---|
| `frontend/` | `npm run lint`, `npm run build`, `npm test` (ba lần chạy riêng) |
| `backend/` | `npm run build`, `npm test`; `npm run test:neon` chỉ sau khi đọc runner và xác minh target staging riêng |
| `face_auth/` | `python -m pytest tests/test_vector_db_logic.py tests/test_enrollment_operation.py tests/test_remote_extraction.py tests/test_face_login_http.py tests/test_face_login_sessions.py tests/test_face_login_parity.py tests/test_pad_predictor.py` trong đúng venv đã có dependency |
| Repo root | `docker compose --env-file .env.compose -f docker-compose.cloud.yml config --quiet`, sau đó `build`, `up -d` cùng bộ file/env đã kiểm tra |
| Repo root, HTTPS local | `docker compose --env-file .env.compose -f docker-compose.cloud.yml -f docker-compose.local-https.yml up -d --build` sau khi file override/cert đã được tạo và kiểm tra |

Đọc AGENTS và cấu hình test trước khi chạy Python; không lấy focused tests thay cho suite bắt buộc của thay đổi. Test frontend có `--passWithNoTests`, nên phải ghi số test thực chạy, không coi 0 test là bằng chứng hồi quy. Không chạy Neon runner khi chưa biết nó ghi/xóa dữ liệu gì.

| Hạng mục | Ngưỡng dự kiến để nghiệm thu, không phải benchmark đã đạt |
|---|---|
| Web/API warm, 5 user + 1 Pi + 1 phiên AI, 15 phút | p95 ≤2s, không có 5xx bất ngờ ở happy path; negative test được phép lỗi đúng hợp đồng |
| Pi → UI | ≤3s trong mạng ổn định; lưu timestamp đầu/cuối để phân biệt độ trễ mạng/UI |
| AI | p95 xử lý frame ≤2s đo riêng thời gian server; một phiên face login ≤10s tính từ frame hợp lệ đầu tiên tới kết quả, loại thời gian người dùng cấp permission/đứng đúng vị trí |
| Enrollment 3–5 ảnh | Job hoàn tất và UI xác nhận ≤15s từ submit, tính cả queue; không nhầm thời gian API trả accepted với hoàn tất |
| Cold start | Request đầu tiên có kết quả hợp lệ ≤8s sau khi DB suspend thật; mọi lớp timeout phải tương thích, có retry giới hạn chỉ khi an toàn |
| VM | Không OOM/swap thrashing; RAM 75% và disk 70% là mốc cảnh báo điều tra, không phải lỗi sản phẩm tự động vì Linux cache |
| Neon idle | Không traffic người/Pi/browser poll/readiness/backup trong cửa sổ đo; xác nhận compute suspend trên console. Chọn cửa sổ ≥10 phút khi không có job đến hạn, ghi cả truy vấn cron còn lại và CU-hours 24h đại diện |

Giữ nguyên browser local bắt buộc: HTTP smoke trước, HTTPS production bắt buộc AUTH-01/02/03, FACE-01/02, RT-01 và luồng ghi/đọc chính. Chạy lại tương ứng trên OCI. Khi thiếu thiết bị/camera thật, đánh dấu Chưa kiểm tra, không dùng mô phỏng để kết luận đạt.

Làm rõ sau review v2: danh sách HTTPS trên là mức tối thiểu nhấn mạnh auth/camera, không miễn các ca còn lại. Toàn bộ UAT thuộc phạm vi release phải đạt trên HTTPS production ở Task 5.

### 7.5. Nguồn xác minh bổ trợ

- [Docker: published ports và UFW](https://docs.docker.com/engine/network/packet-filtering-firewalls/): Docker có thể chuyển traffic trước rule UFW; kiểm tra từ ngoài là bắt buộc.
- [Neon: Scale to Zero](https://neon.com/docs/introduction/scale-to-zero): thời gian idle và nguồn query quyết định suspend; tăng timer không tự đảm bảo tiết kiệm.
- [Tailscale: free plans](https://tailscale.com/docs/account/manage-plans/free-plans-discounts): kiểm tra điều kiện và số người được phép theo tài khoản, không giả định nhóm bất kỳ đều được gói Personal.

**Phạm vi lần cập nhật review:** Chỉ sửa kế hoạch; chưa sửa worker, timeout, proxy, video, env, backup hay triển khai Caddy/VPN. Tất cả checkbox kỹ thuật vẫn chưa hoàn thành cho tới khi thực thi và có bằng chứng.

## 8. Rà soát review v2 — điều kiện thực thi và điểm còn thiếu

### 8.1. Kết luận và phản biện

Review v2 phù hợp ở kết luận có thể bắt đầu Task 0 và công việc local, nhưng không đủ căn cứ khẳng định hệ thống hết blocker triển khai. Các vấn đề kỹ thuật mới được đưa vào kế hoạch, chưa được sửa hoặc chứng minh đạt. Không dùng các cụm “đã xử lý triệt để” trong bảng review như trạng thái hoàn thành checklist. Blocker thực tế như capacity ARM, model, quyền DB, chứng chỉ và đường media chỉ được gỡ bằng bằng chứng lúc thực thi.

| Nhận xét v2 | Quyết định cập nhật |
|---|---|
| Đồng bộ Task 2/3/5/6 với mục 7 | Chấp nhận: sửa trực tiếp task, thống nhất HTTPS 8443 và bảng ngưỡng duy nhất |
| PAD preload bị bắt lỗi nhưng vẫn log ready | Xác nhận code; thêm trạng thái khởi tạo và readiness 503 có điều kiện khi tính năng bật, không chỉ nhìn log |
| Startup FastAPI hoàn tất trước khi mở HTTP nên có thể dựa vào liveness | Đúng về startup hiện tại, nhưng startup còn tạo VectorDB và validate schema. Tách endpoint không loại bỏ phụ thuộc DB lúc khởi động; phải test DB down từ đầu và tránh restart loop |
| Ba `.dockerignore` đã loại `.env*` | Xác nhận; giữ kiểm tra hiệu lực build context/image cuối, không diễn đạt như chưa biết cấu hình hiện tại |
| PAD chỉ có thể qua mount hardware/models | Chưa đủ căn cứ để nói “chỉ”: còn phụ thuộc đường dẫn config, artifact ngoài context hoặc cách đóng gói mới. Xác nhận model trong antispoof bị loại khỏi build, rồi chứng minh path thực tế đọc được trong container |
| Chỉ cần `.env.testing` host khác ứng dụng là chạy an toàn | Chưa đủ. Guard có ràng buộc URL/TLS, quyền CREATE/DROP và chỉ biết những host được cung cấp; không nhận diện mọi alias/endpoint cùng branch |
| Chốt video và VPN tại cổng phạm vi | Chấp nhận, phải ghi endpoint, ai được truy cập, đường media và người quyết định; VPN không thay thế xác thực ADMIN |

### 8.2. Readiness, PAD và startup — tiêu chí hồi quy cụ thể

**Files:** `face_auth/api_service.py`, config, tests HTTP/lifecycle hiện có và `docker-compose.cloud.yml`.

- [ ] Lưu trạng thái preload PAD một cách tường minh: disabled/loading/ready/failed hoặc biểu diễn tương đương. `FACE_LOGIN_ENABLED=true` mà PAD thiếu/hỏng phải làm `/health/ready` trả 503; disabled thì không bắt buộc PAD, nhưng nhận diện/enrollment vẫn cần detector/embedder và DB phù hợp.
- [ ] `/health/ready` kiểm tra trạng thái đã có, không tải lại model trên mỗi request; loại bỏ log “Ready” gây hiểu nhầm khi tính năng bắt buộc lỗi. Response không lộ path model nội bộ, secret hoặc DSN.
- [ ] Live không query DB; endpoint HTTP chỉ xuất hiện sau startup hiện tại. Xác minh timeout của `VectorDB.validate_schema()` để DB unavailable từ lúc boot không giữ startup treo không giới hạn. Đợt đầu giữ fail-fast có timeout khi schema/DB không sẵn sàng, không thêm cơ chế startup degraded phức tạp; ghi rõ recovery nhờ restart policy và backoff thực tế.
- [ ] Health live 200 không có nghĩa PAD/DB ready. Vì Compose chờ `service_healthy` theo live, backend có thể lên khi PAD failed; bước readiness riêng sau deploy phải chặn go-live, route face login trả lỗi hữu hạn. Không đổi health live thành DB probe định kỳ để che khoảng trống này.
- [ ] Test bốn cấu hình: face login tắt; bật với PAD đúng; bật với PAD thiếu/hỏng; DB lỗi từ trước startup. Sau DB phục hồi phải khởi động được và giữ ngân sách retry hợp lý.
- [ ] Test DB mất sau startup: live vẫn trả nhanh, ready 503, browser lỗi rõ; phục hồi không tải lại PAD mỗi lần, không tạo rò pool/thread hoặc restart loop do healthcheck.
- [ ] Nếu recovery backlog/cron/readiness/backup có truy vấn cùng lúc, đo tổng thời gian request; 5s acquire + 5s query không mặc nhiên đáp ứng cold-start end-to-end ≤8s. Điều chỉnh kiến trúc timeout/retry theo số đo, không cộng các timeout mù.

### 8.3. Test Neon runner — ngoại lệ phá dữ liệu có ranh giới

Đã đọc `backend/validation/tools/run-neon-tests.mjs` và `backend/src/__tests__/helpers/cloud-test-db.mjs`: runner tạo `smartface_test_<16 hex>`, chạy `prisma migrate reset --force --skip-seed --skip-generate` trước từng suite, chèn role test rồi `DROP DATABASE ... WITH (FORCE)` khi cleanup. Đây là hành vi phá dữ liệu có chủ đích, CHỈ được phép trong database tạm do runner tạo trên môi trường test chuyên dụng. Không mâu thuẫn quy tắc cấm reset DB đang dùng, không được nới guard để chạy trên branch UAT/production.

- [ ] Tạo endpoint/branch test riêng khác branch staging UAT và production; liệt kê đầy đủ endpoint direct/pooled, read replica hoặc alias liên quan để đối chiếu branch ID thực tế. Host khác không chứng minh dữ liệu khác.
- [ ] `.env.testing` cần DIRECT_URL hợp lệ theo guard hiện tại: `postgresql:`, direct Neon AWS hostname được regex chấp nhận, path `/neondb`, `sslmode=require`, `channel_binding=require`. Không in URL thật và không tắt TLS/guard để chạy cho qua.
- [ ] Tài khoản test được quyền tạo/xóa DB trong branch test riêng; không dùng runtime least-privilege của ứng dụng nếu thiếu quyền. Không cấp quyền cao thêm cho runtime production để phục vụ test.
- [ ] Xác minh các nguồn host mà guard đọc: `process.env`, `backend/.env`, `.env.compose`; guard không tự biết mọi môi trường/alias ngoài danh sách. Nếu nhà cung cấp dùng hostname không khớp regex, ghi blocker và sửa guard có hồi quy thay vì bypass.
- [ ] Lưu số suite/test pass/fail/skipped và kiểm tra database tạm đã cleanup; timeout/runner bị kill có thể để DB thừa, chỉ dọn database tên test đã xác minh và thuộc lượt chạy đó.
- [ ] Dữ liệu ca UAT browser dùng branch staging bền vững riêng; không mở web trỏ vào DB runner đang reset. Test kết nối live/suspend không chạy đồng thời runner/load test.

### 8.4. Hồ sơ quyết định Cổng 1 — bắt buộc trước OCI staging

Tạo bản ghi trong hồ sơ release thực tế, không coi các ô dưới là đã chốt bởi reviewer. Có thể hoàn thành cấu hình và UAT local trước khi cấp được VM; OCI staging chỉ được bắt đầu khi tất cả mục áp dụng có giá trị cụ thể.

| Quyết định | Giá trị cần ghi và điều kiện |
|---|---|
| Baseline | Commit/image/model manifest và các thay đổi Phase 2 được gồm/loại rõ ràng |
| TLS/public origin | Domain thực cấp, IP, Caddy → Nginx → Node, CA local, đường gia hạn; kiểm tra IPv4/IPv6 nếu có DNS AAAA |
| VPN | Tailscale tài khoản/gói/quota user-device đã kiểm tra; ACL từng node/cổng, key expiry/reboot. Nếu không đáp ứng free thì ghi blocker hoặc chọn WireGuard với UDP/firewall cụ thể |
| Live camera | (a) Admin vào VPN; (b) public WHEP HTTPS + server auth + đường media được thử; hoặc (c) tách release có chủ dự án chốt phạm vi. Không tự mặc định (c) |
| Video (a) | Admin browser phải có route tới signaling/media qua VPN, chứng chỉ HTTPS tin cậy, không mixed content, auth ADMIN phía server; không dùng HTTP VPN từ trang HTTPS |
| Video (b) | Chỉ mở media port cần thiết sau khi cấu hình ICE và quyền publish/read; test 4G/NAT, UDP bị chặn, WHEP POST/PATCH/DELETE và Location URL, session hết hạn/logout. Mở 8189/udp không đồng nghĩa ai cũng được xem, nhưng cũng không đủ chứng minh stream đã được bảo vệ |
| Video (c) | Ẩn/tắt thao tác chưa được hỗ trợ và thông báo phạm vi rõ trên UI, không để player timeout giả; chỉ nghiệm thu bản web có giới hạn đã được chấp nhận |
| ThingsBoard | Image ARM chạy được, credential/default admin đã thay, webhook secret chỉ nằm phía server, backup DB nhất quán |
| Models | Path trong container, mount tồn tại/quyền đọc, runtime JSON và mọi relative path bên trong resolve đúng, checksum/model version khớp DB/Pi |
| Backup | Bucket/quota/IAM thật, retention, lịch + người theo dõi backup failure; kết quả restore và đường tải khi VM mất |

Không cần thêm tool triển khai mới ngoài Caddy/mkcert/VPN đã chọn nếu công cụ hiện có đáp ứng; không tự tạo tài khoản trả phí hoặc cắt tính năng để đóng cổng này.

### 8.5. Chất lượng bằng chứng và tiêu chí dừng

- [ ] Mỗi mẫu latency ghi điểm bắt đầu/kết thúc, thành công/thất bại và số lượng. p95 chỉ có ý nghĩa khi báo số mẫu; đề xuất ít nhất 100 request API warm và 20 frame AI hợp lệ. Báo riêng số phiên login/enrollment; không coi 15 phút là đủ khi gần như không có request.
- [ ] Negative tests không tính chung tỷ lệ 5xx happy path; cold-start đo riêng ít nhất một lần suspend được xác nhận, không lấy trung bình warm che cold-start failure.
- [ ] Khi sửa worker/cron phải có test quyền actor lúc thực thi, lease/retry/idempotency và thời hạn lưu input; tiết kiệm compute không được đổi bảo mật hoặc làm input nhạy cảm tồn tại vô hạn.
- [ ] Nếu một bước thiếu quyền/tài nguyên thì ghi blocker cùng phần còn làm độc lập được. “Có thể bắt đầu Task 0” không có nghĩa được deploy production hoặc đánh dấu lỗi đã sửa.

**Kết quả rà soát v2:** Đồng bộ bốn điểm câu chữ; bổ sung PAD readiness/startup, giới hạn guard Neon test, model path và Cổng 1. Chỉ thay đổi kế hoạch, không chạy integration/reset/drop, không tạo VM, không thay đổi code hay dữ liệu và chưa mở browser UAT trong lần này.
