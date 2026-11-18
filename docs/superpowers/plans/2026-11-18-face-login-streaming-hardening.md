# Kế hoạch sửa lỗi đăng nhập khuôn mặt bằng streaming

> Thực hiện tuần tự bằng `superpowers:executing-plans`: test tái hiện → xác nhận lỗi → sửa tối thiểu → kiểm tra. Đây là kế hoạch; chưa sửa code chức năng.

**Mục tiêu:** sửa trạng thái, phục hồi kết quả, thời gian chờ và tài nguyên. Điểm 9–9,5/10 chỉ đánh giá chất lượng phần mềm trong phạm vi kiểm tra.

**Kiến trúc:** giữ HTTP tuần tự, một request frame đang chờ mỗi lượt, một slot inference đăng nhập. Node quản lý danh tính/phiên đăng nhập; Python quản lý PAD và tính liên tục khuôn mặt.

**Công nghệ:** React, Express, FastAPI, Vitest, unittest hiện có. Không thêm dependency runtime, Redis, WebSocket hoặc migration.

**Tài liệu gốc:** `2026-11-17-face-login-streaming-revised.md`. Quyết định cookie, recovery và timeout bên dưới thay thế phần tương ứng của tài liệu gốc; dùng kế hoạch này để thực hiện đợt sửa lỗi.

## 1. Phạm vi

- Giữ model, tiền xử lý, ngưỡng PAD/matching, JPEG quality 0.85, cạnh dài 720 px và JPEG tối đa 200 KiB.
- Giữ TTL lượt 15 giây, độ mới verified 5 giây, cache complete 30 giây, tối đa 75 frame/lượt và 5 frame được chấp nhận/giây/lượt.
- Giữ EMPLOYEE, face JWT 30 phút, kiểm tra tài khoản/template và xác thực lại bằng mật khẩu. Không thay enrollment hoặc ghi attendance.
- Chỉ hỗ trợ một Node process, một Python worker. Không tăng worker để chữa quá tải.
- Frame không cấp cookie đăng nhập. Frontend không gửi danh tính, vector, ngưỡng hoặc số lần xác nhận.
- Không log ảnh, vector, JWT, binding hoặc danh tính trong số đo hiệu năng.
- Không tái cấu trúc toàn bộ AuthContext/apiFetch; không tự commit, publish hoặc deploy.

## 2. Danh sách lỗi

| Mã | Lỗi | Vị trí chính | Điều kiện đạt |
|---|---|---|---|
| F1 | Complete xóa binding làm recovery mất quyền hỏi status | routes, faceLoginApi, AuthContext | Cookie jar thật phục hồi đúng lượt |
| F2 | Deadline chỉ kiểm tra giữa các request | FaceLoginModal, faceLoginApi | Request treo không khóa giao diện vô hạn |
| F3 | Response complete cũ có thể ghi đè cookie logout | AuthContext, auth.controller, attempt store | Abort ngay; logout gửi sau cùng; cache cũ bị vô hiệu |
| F4 | Python không dọn session khi không có traffic mới | sessions.py, http.py | Dọn định kỳ không chặn event loop |
| F5 | Frame dùng chung quota complete/cancel/status | face-login.routes.ts | Quota frame không làm hết quota điều khiển |
| F6 | RPC đọc hết body rồi mới kiểm tra kích thước | face-login.engine.ts | Dừng đọc khi vượt 40.000 byte |
| F7 | Config/giao thức kiểm tra chưa chặt | service, engine, routes | Từ chối config sai, operation ID sai, Base64 sai |
| F8 | Cache frame xét trước trạng thái kết thúc | face-login.attempts.ts | Trạng thái kết thúc không trả frame cũ |
| F9 | Tài liệu còn mô tả challenge cũ | FACE_LOGIN_WEB.md | Tài liệu khớp hành vi sau sửa |

F3 phải có test tái hiện trước khi sửa. F4 không phải bộ nhớ tăng vô hạn: store có giới hạn và vẫn từ chối session hết hạn.

## 3. Quyết định đã chốt

### 3.1. Cookie và recovery

- Complete không xóa `face_login_attempt`. Giữ cookie TTL 60 giây từ start, không gia hạn khi retry; giữ HttpOnly/Secure/SameSite/path hiện tại.
- Cache complete hết sau 30 giây từ commit; retry trả cùng user/token. Không dùng `/me` của tài khoản khác làm bằng chứng lượt đã thành công.
- Complete lỗi mạng/response mơ hồ: hỏi status, retry complete tối đa một lần; tổng tối đa hai POST complete, bốn lần status, khoảng cách status ít nhất 250 ms, trong tổng 10 giây.
- Logout có Origin hợp lệ vô hiệu attempt/cache cùng binding. Login mật khẩu thành công/password step-up bỏ recovery cũ trước khi đặt cookie mới.
- Tạo lượt mới chỉ bỏ cache COMPLETED sau create thành công; không hủy lượt active của tab khác.

### 3.2. Chốt `remainingMs` và timeout

Bắt buộc thêm `remainingMs: number` vào start/status. Node tính `Math.max(0, deadline - Date.now())` khi tạo response; giữ `expiresAt` để tương thích.

Frontend dùng `performance.now()`, không so đồng hồ client với `expiresAt`. Thời gian cục bộ còn lại = `max(0, remainingMs - tổng thời gian request)`, đo từ trước gửi đến lúc nhận response. Cách trừ này bảo thủ khi mạng chậm. Status chỉ được rút ngắn deadline cục bộ, không gia hạn lượt.

| Request | Giới hạn chờ |
|---|---:|
| Config/start | 4 giây |
| Frame | Nhỏ hơn giữa 4 giây và thời gian lượt còn lại |
| Status/cancel | 2 giây |
| Complete cùng recovery | Tổng 10 giây; mỗi POST complete tối đa 4 giây |
| Logout | 4 giây |

Mọi request còn phải nằm trong budget cha. Abort không chứng minh server đã rollback. Complete chưa rõ kết quả phải mở khóa UI và thông báo chưa xác định, không báo lỗi sinh trắc.

### 3.3. Logout chỉ chờ một chiều

1. Đặt cờ đang logout và tăng epoch ngay.
2. Abort complete/recovery; chặn retry/accept từ epoch cũ.
3. Lấy snapshot promise complete, chờ settle tối đa 1 giây; hết giới hạn vẫn đi tiếp. Promise muộn có catch, không unhandled rejection.
4. Gửi POST logout sau đó, timeout 4 giây, để cookie xóa đến sau trong luồng của cùng AuthProvider.
5. Server nhận logout với Origin hợp lệ: vô hiệu binding đồng bộ trước khi trả cookie xóa; complete đang await kiểm tra lại trạng thái trước commit.

Không có chiều chờ ngược: complete được gọi lúc logout phải trả hủy ngay, không await logout. Double complete cùng lượt dùng lại promise; khác lượt trả conflict cục bộ. Login mật khẩu trong lúc logout/complete chạy trả trạng thái bận để thử lại; không thêm hàng đợi auth.

Invalidation chỉ có hiệu lực khi server xử lý logout, không phải khi bấm nút. JWT đã cấp không bị thu hồi riêng. Không tuyên bố biến React giải quyết thứ tự cookie giữa các tab.

Headers complete có thể đến và đặt cookie trước khi abort. Abort không xóa cookie đã đặt; logout gửi sau phải xóa nó. Test trường hợp này phải xác nhận cả cookie cuối cùng và việc React không accept kết quả cũ, không chỉ xác nhận AbortSignal đã bật.

### 3.4. Logout không có Origin vẫn tương thích

Kiểm kê trong repo: frontend gọi qua AuthContext → logoutApi; demo adapter và test cookie có xử lý logout. Chưa thấy caller endpoint logout trong hardware/scripts/face_auth; không suy ra client ngoài repo cũng không có.

- Luôn trả logout thành công và xóa cookie token cùng binding, kể cả Origin thiếu/sai.
- Chỉ gọi invalidateFaceLoginBinding khi Origin thuộc allowlist hiện có; Origin thiếu/sai không thay đổi attempt/cache server.
- Không thêm middleware bắt buộc Origin cho toàn endpoint logout.
- Dev qua Vite proxy phải kiểm tra Origin thực tế tại backend. `backend/src/config/env.ts` và `backend/.env.example` hiện mặc định `http://localhost:5173`; `frontend/vite.config.ts` proxy `/api` tới `http://127.0.0.1:3000`. Config môi trường có thể ghi đè allowlist; `docker-compose.yml` mặc định các Origin cổng 8080, không dùng nó thay cấu hình dev.
- Trong Công việc 6, đối chiếu allowlist đang có hiệu lực với địa chỉ mở frontend (đủ scheme/host/port). Test logout qua proxy với `http://localhost:5173` phải vô hiệu attempt; thêm `http://127.0.0.1:5173` chỉ khi dùng địa chỉ đó. Không tự thêm localhost vào allowlist production hoặc dùng wildcard.

### 3.5. File mới đã chốt

| File | Trách nhiệm |
|---|---|
| `backend/src/modules/auth/face-login/face-login.cookies.ts` | Tên cookie binding và hàm xóa cookie; options do caller truyền; không import controller |
| `frontend/src/features/auth/lib/faceLoginRequest.ts` | Ghép signal cha/timeout, dọn timer và listener |
| `backend/validation/auth/face-login-engine.test.ts` | Test RPC stream và hợp đồng response |
| `backend/validation/auth/face-login-lifecycle.test.ts` | Test trạng thái và request xen kẽ |
| `scripts/validation/measure_face_login_capacity.py` | Đo ngắn inference bằng JPEG cục bộ, không camera |
| `docs/validation/face-login-streaming-hardening.md` | Baseline, số đo, quota và kết quả test |

## Công việc 0 — Baseline và đo năng lực

**File:** script đo/báo cáo mục 3.5; đọc config/test hiện có. Chưa đổi quota.

- [ ] Ghi revision, model/runtime version, máy chạy, số worker và config không chứa secret.
- [ ] Chạy focused tests hiện có, lưu pass/fail/skip làm baseline.
- [ ] Script dùng thư viện Python đã có và JPEG fixture phù hợp: 5 lần làm nóng, 30 lần đo; tách detect/PAD và đường có embedding. Reset state để không đo cache hoặc chỉ đo frame thiếu mặt.
- [ ] Một client đo inference thật; hai client chạy ngắn để ghi busy. Báo frame thực xử lý/giây, p50/p95 và thời gian mẫu. Không đòi mỗi client đạt 5 fps; không dùng model giả để công bố năng lực.
- [ ] Thiếu model/JPEG phù hợp: ghi chưa đo được, giữ quota start/frame cũ, tiếp tục sửa lỗi. Không tự tăng giới hạn hoặc công bố số client hỗ trợ.
- [ ] Tái hiện F1/F2/F3/F4 bằng cookie, clock và promise điều khiển được.

**Hoàn tất:** có baseline và số đo, hoặc lý do thiếu số đo cùng quyết định giữ quota cũ. Không chặn sửa lỗi vì thiếu model.

## Công việc 1 — Trạng thái và invalidation

**Sửa:** `backend/src/modules/auth/face-login/{face-login.attempts.ts,face-login.service.ts,face-login.routes.ts}`; `backend/src/modules/auth/auth.controller.ts`. Tạo helper cookie đã chốt.

**Hàm:**

- `AttemptStore.invalidateBinding(binding: string): string[]`: đánh dấu active CANCELLED trước khi xóa khỏi map; xóa cache complete; trả ID để gửi engineCancel. Object đang await cũng mất quyền commit.
- `AttemptStore.dropCompletedRecovery(binding: string): void`: chỉ xóa entry/cache COMPLETED; start gọi sau create thành công, trước await engineCreate.
- `invalidateFaceLoginBinding(binding: string | undefined): void`: nối store với engineCancel; không import controller/router vào service.

- [ ] Test đỏ: invalidate trong account lookup; complete rồi logout; retry cookie cũ sau logout; lượt mới bỏ recovery cũ nhưng không phá active khác.
- [ ] Sửa logout theo mục 3.4; kiểm tra account/template/role giữ nguyên.
- [ ] Đưa deadline/trạng thái trước cache frame. Exact replay chỉ hợp lệ tại READY/VERIFIED; PROCESSING conflict; trạng thái kết thúc từ chối.
- [ ] Test xanh: duplicate không cộng count/inference; cùng seq khác ảnh vẫn conflict; terminal replay thất bại; logout thiếu/sai Origin xóa cookie nhưng không sửa store.
- [ ] Chạy backend face-login/service/routes/session và auth-cookie tests.

## Công việc 2 — Recovery và thời gian còn lại

**Sửa:** backend service/routes; `frontend/src/features/auth/api/faceLoginApi.ts`; phần recovery trong `frontend/src/context/AuthContext.tsx`.

- [ ] Thêm remainingMs bắt buộc vào response và kiểu frontend. Test lệch clock client ±10 phút, trừ thời gian mạng, status không gia hạn deadline.
- [ ] Bỏ xóa binding ở complete; không gia hạn cookie/cache khi retry.
- [ ] Đổi test recovery tự gắn cookie cũ sang request.agent giữ cookie xuyên suốt start/frame/complete/status/retry.
- [ ] Test body mất sau headers: cookie jar thật lấy lại đúng user/token cache. Session B sẵn không được nhận làm kết quả lượt A.
- [ ] Áp giới hạn mục 3.1/3.2. 401/403/404/410 kết thúc; 409 đang xử lý chỉ hỏi status trong budget; mạng/5xx có thể chưa rõ kết quả.
- [ ] Test hai complete cùng lúc trả nhất quán cached token; không hứa account preparation chỉ chạy một lần khi chưa có cơ chế đó.
- [ ] Chạy routes/recovery/step-up tests.

## Công việc 3 — Timer và logout một chiều

**Sửa:** `frontend/src/features/auth/{api/faceLoginApi.ts,api/authApi.ts,components/FaceLoginModal.tsx}`, `frontend/src/context/AuthContext.tsx`. Tạo faceLoginRequest.ts.

**Hàm:** `faceLoginApi.complete(attemptId: string, signal?: AbortSignal)`; `logoutApi(signal?: AbortSignal): Promise<void>`. Caller cũ không truyền signal vẫn hợp lệ. AuthContext chỉ giữ epoch, cờ logout và ref `{attemptId, promise, controller}` cho complete.

- [ ] Test đỏ request không kết thúc: config/start/frame/status/complete. Mock fetch phải tôn trọng AbortSignal.
- [ ] Timer lượt độc lập vòng while, dùng performance.now và remainingMs. Đóng/camera ngắt/unmount dọn timer/listener; response trễ không complete/onSuccess.
- [ ] Thực hiện đúng logout mục 3.3; không thêm complete đợi logout hoặc hàng đợi hai chiều.
- [ ] Test logout trước complete trả hủy ngay; complete trước logout bị abort; logout trong recovery không retry; double logout một request; double complete một promise.
- [ ] Test promise giả không settle sau abort: logout vẫn gửi sau tối đa 1 giây; response muộn không accept session. Complete timeout mở khóa UI.
- [ ] Thêm test `logout_clears_cookie_already_set_by_complete_headers`: complete gửi headers đặt token rồi giữ body; sau đó logout abort complete và gửi request xóa cookie. Mong đợi cookie jar cuối không có token/binding, không gọi acceptSession/onSuccess từ complete cũ, không retry recovery. Test HTTP dùng cookie jar cho thứ tự Set-Cookie; test frontend kiểm tra abort/epoch và thứ tự gọi. Không coi jsdom là bằng chứng trình duyệt thật đã áp cookie từ fetch.
- [ ] Login mật khẩu lúc đang complete trả đúng câu: “Đang hoàn tất đăng nhập khuôn mặt. Vui lòng chờ rồi thử lại.”; lúc đang logout trả: “Đang đăng xuất. Vui lòng chờ rồi thử lại.”. Ưu tiên câu logout nếu cả hai cờ đang bật. Không gọi loginApi và không đặt cookie xen ngang; lúc rảnh giữ hành vi hiện có.
- [ ] Test thông báo so sánh chính xác hai chuỗi trên và xác nhận loginApi không được gọi. Thời gian chặn complete tối đa 10 giây; logout tối đa khoảng 5 giây (chờ settle 1 giây + request 4 giây), không bắt người dùng chờ thêm một complete mới.
- [ ] Logout mạng lỗi không thông báo server chắc chắn đã xóa phiên; abort không đồng nghĩa rollback.
- [ ] Chạy camera/modal/logout-login-race/session-isolation/step-up; frontend lint/build.

## Công việc 4 — Python cleanup không chặn event loop

**Sửa:** `face_auth/face_login/{sessions.py,http.py}`. Đăng ký startup/shutdown tại router hiện có; không chuyển toàn bộ lifecycle ứng dụng.

**Cách làm:** thêm `SessionStore.try_sweep() -> bool` dùng `threading.Lock.acquire(blocking=False)`. Không lấy được lock thì trả False, thử lại ở nhịp 1 giây tiếp theo. Giữ sweep đồng bộ cho create/test hiện có.

- [ ] Kiểm tra vùng giữ lock chỉ thao tác metadata tối đa 20 session; không inference/decode/I/O/await. Inference nằm ngoài lock.
- [ ] Startup tạo một tác vụ mỗi giây gọi try_sweep; shutdown cancel và await. Không chờ threading.Lock trên event loop.
- [ ] finish xóa ngay session closed/expired khi inference kết thúc, chỉ xóa đúng object; không giải phóng slot sớm để giả vờ hủy ONNX.
- [ ] Test clock giả: hết TTL không traffic vẫn dọn. Lifecycle không task mồ côi/duplicate sweeper.
- [ ] Test thread khác giữ lock: try_sweep trả False ngay, event loop vẫn chạy; thả lock rồi lần sau dọn được.
- [ ] Test Event/barrier: cancel/expiry trong inference; giữ slot tới khi xong; loại kết quả trễ; không tạo lại session thiếu.
- [ ] Chạy Python sessions/parity/HTTP tests, không nạp model thật trong test đơn vị.

## Công việc 5 — RPC, schema và quota

**Sửa:** backend engine/service/routes/attempts; frontend xử lý 429. Tạo engine tests.

- [ ] Đọc RPC theo chunk tối đa 40.000 byte; vượt thì reader.cancel; luôn releaseLock. Timeout gồm headers/body; không tin Content-Length.
- [ ] Test 40.000/40.001 byte, nhiều chunk/không header/header sai, JSON lỗi, body treo, timeout thật và cleanup reader.
- [ ] operation_id response bắt buộc khớp request. Test thiếu/sai ID, boot/model/seq sai, vector khác512/zero/norm sai/không hữu hạn.
- [ ] Parse ATTENDANCE_STABLE_COUNT toàn chuỗi sau trim: missing/blank dùng 3; chỉ 1..6 hợp lệ. Test 0,7,-1,2.5,3abc,NaN,Infinity; sai thì vô hiệu feature.
- [ ] Base64 decode/encode lại phải bằng chuỗi gốc; bytes 1..204800. Test cap body 300 KiB cả hai aliases; không lộ ảnh trong lỗi.
- [ ] Tách counter frame khỏi complete/cancel/status. Giữ start 10/phút/IP, frame 300/phút/IP, control 300/phút/IP; không tăng frame lên 1.800. Hai aliases dùng chung limiter theo từng loại.
- [ ] Ghi mức tải hướng dẫn từ Công việc 0: floor(0.8 × throughput inference) frame/giây toàn dịch vụ. Đây không phải quota IP hoặc throughput database; đối chiếu request end-to-end/busy trước khi công bố năng lực. Không có số đo thì không công bố số client hỗ trợ.
- [ ] Đợt này không tăng quota vì thêm client. Quota là chống lạm dụng; slot/semaphore mới chặn inference đồng thời. Quá tải trả busy, không queue. Thay đổi con số quota sau số đo là thay đổi riêng có bằng chứng, không chặn sửa lỗi hiện tại.
- [ ] 429 phân biệt ENGINE_BUSY, FRAME_RATE_LIMIT, IP_RATE_LIMIT, ATTEMPT_CAPACITY. Chỉ busy/frame rate retry trong deadline; busy đợi ngẫu nhiên 200–400 ms rồi chụp mới. IP/capacity không retry mỗi 200 ms.
- [ ] Test nhiều agent chung IP dùng hết quota frame vẫn gọi complete/cancel/status được; busy không cộng seq/count. Đây là test tách quota, không yêu cầu inference đạt 25 fps.
- [ ] Chạy engine/service/store/routes tests; ghi số đo và quota vào báo cáo.

## Công việc 6 — Tích hợp và tài liệu

**File:** face-login-lifecycle.test.ts; tests frontend/Python liên quan; `docs/tutorial/face_auth/FACE_LOGIN_WEB.md`; báo cáo mục 3.5.

- [ ] Ma trận tự động: frame/frame, frame/cancel, frame/expiry, complete/complete, complete/cancel trước/sau commit, complete/logout, logout/recovery, binding sai.
- [ ] Test Node/Python restart: lượt cũ thất bại đóng; không dựng lại bằng chứng PAD/nhận dạng.
- [ ] HTTP/ASGI tests dùng model giả nhưng cookie/JSON/headers/body thật. Test body mất sau headers bằng response bị cắt, không chỉ mock status completed.
- [ ] Kiểm tra hai aliases, Origin logout đúng/thiếu/sai, template xóa, account vô hiệu, role đổi và password step-up. Không làm yếu verifyAndLoadActiveUser để recovery qua test.
- [ ] Giữ test R,R,R,R,R,S,S,S ghi nhận khác biệt dừng sớm; không sửa PAD để giả kết quả cũ/mới giống nhau.
- [ ] Chạy focused tests/build bên dưới; full backend/frontend suite một lần; phân loại failure cũ bằng baseline, không xóa/skip test để làm xanh.
- [ ] Tài liệu đúng attempt 15 giây, tối đa 20 active, cookie/recovery mới, quota và một Node/một Python worker.
- [ ] Báo cáo ghi rõ giới hạn NAT: cả văn phòng chung một IP dùng chung 10 request start/phút và 300 request frame/phút, kể cả frame bị trả busy sau limiter. Tương đương trung bình 5 request frame/giây trong cửa sổ một phút, không phải giới hạn cứng 5 request ở mọi giây; burst vẫn có thể dùng hết quota sớm. Các lần mở/thử lại cùng tính quota start, không đồng nghĩa 10 nhân viên đăng nhập thành công/phút.
- [ ] Báo cáo số người đồng thời ước tính kèm giả định: với r request frame/giây/người, trần do quota dài hạn là `floor(5 / r)` (ví dụ r=5 → 1; r=2,5 → 2; r=1 → 5). Đây chỉ là trần quota, không bảo đảm inference đáp ứng; còn phụ thuộc số đo Công việc 0, busy/retry và TTL. Ghi số client đã thực sự thử, số ước tính riêng và cảnh báo giờ cao điểm có thể gặp 429. Thiếu số đo thì ghi chưa xác định năng lực đồng thời, không biến ví dụ thành cam kết.
- [ ] Kiểm tra cấu hình dev qua Vite proxy: Origin frontend thuộc allowlist thực tế; logout phải xóa cookie và invalidate attempt. Test tự động Origin localhost đúng, Origin sai/thiếu giữ tương thích; kiểm tra cấu hình không in secret hoặc sửa `.env` cá nhân ngoài phạm vi.
- [ ] Báo cáo lỗi đã sửa, test chứng minh, số đo hoặc nguyên nhân chưa đo và giới hạn nhiều tab/JWT. Không tự deploy.

## 4. Lệnh kiểm tra

Chạy từ gốc repo trong PowerShell. Chỉ thêm file test mới vào lệnh sau khi tạo file.

```powershell
npm.cmd --prefix backend test -- validation/auth/face-login.test.ts validation/auth/face-login-session.test.ts validation/auth/face-login-routes.test.ts validation/auth/face-login-engine.test.ts validation/auth/face-login-lifecycle.test.ts validation/auth/revocation-and-session.test.ts validation/auth/auth-projection.test.ts src/__tests__/unit/auth-cookie.test.ts
npm.cmd --prefix frontend test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx validation/auth/face-login-stepup.test.tsx validation/auth/logout-login-race.test.tsx validation/integration/session-isolation.test.tsx
Push-Location face_auth
python -m unittest tests.test_face_login_sessions tests.test_face_login_parity tests.test_face_login_http
Pop-Location
npm.cmd --prefix backend run build
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

## 5. Nghiệm thu

| Điều kiện | Bằng chứng |
|---|---|
| Đúng logic | F1–F8 có test tái hiện rồi xanh; không nhận sai account; terminal không hồi sinh |
| Chờ có giới hạn | Request treo, abort, response trễ, logout/recovery kết thúc đúng giới hạn |
| Tương thích | Logout thiếu/sai Origin vẫn xóa cookie; caller cũ không cần signal; hai aliases qua test |
| Tài nguyên | RPC có byte cap; lock không inference/I/O; sweeper không chặn event loop; cleanup qua test |
| Tải | Quota frame/control độc lập; không tăng quota trước số đo; busy không cộng bằng chứng |
| Hồi quy | Focused tests/build qua; full suite không lỗi mới do bản sửa; tài liệu khớp code |

**9/10 cho phần mềm:** tất cả điều kiện trên đạt, không còn lỗi nghiêm trọng đã biết thuộc đợt sửa.

**9,5/10 cho phần mềm:** thêm kiểm tra chéo độc lập diff/đường gọi; mất headers/body, logout trong recovery và lock bị chiếm đều có test thực thi; không còn lỗi cao/vừa chưa xử lý thuộc phạm vi.

Điểm số không thay thế bằng chứng test và không khẳng định độ chính xác sinh trắc. Chưa sửa code hoặc chạy lại bộ test trong lượt chỉnh kế hoạch.
