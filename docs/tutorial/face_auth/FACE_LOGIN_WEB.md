# Đăng nhập tài khoản bằng camera máy tính

Tại `/login`, bấm **Đăng nhập bằng khuôn mặt** để mở hộp thoại camera. Chọn **Bắt đầu nhận diện** và nhìn thẳng vào camera. Sau khi đạt đủ số lần xác nhận danh tính liên tiếp với PAD hợp lệ, ứng dụng gọi bước hoàn tất (`complete`) để nhận cookie đăng nhập và mở dashboard của tài khoản nhân viên tương ứng.

Luồng này chỉ tạo cookie đăng nhập tại bước hoàn tất (`POST /attempts/:id/complete`). Các frame gửi lên không bao giờ cấp cookie đăng nhập, không gọi webhook ThingsBoard, không gọi check-in/check-out và không ghi `attendance_logs`.

## Bật trên môi trường thử nghiệm

Trên môi trường thử nghiệm, đăng nhập dùng cùng ngưỡng so khớp và số lần xác nhận được cấu hình cho chấm công (`ATTENDANCE_STABLE_COUNT` là chuỗi số nguyên `1..6`, mặc định `3`; cấu hình ngoài miền này sẽ vô hiệu hóa tính năng). Chất lượng webcam và ánh sáng vẫn có thể làm kết quả thực tế khác camera Pi.

Trong `backend/.env`, đặt khóa nội bộ ngẫu nhiên ít nhất 32 ký tự và các giá trị đã chọn từ thử nghiệm:

```dotenv
FACE_LOGIN_ENABLED=true
FACE_AUTH_INTERNAL_KEY=<khoa-noi-bo-ngau-nhien-dung-chung-voi-face-auth>
FACE_MATCH_THRESHOLD=0.45
ATTENDANCE_STABLE_COUNT=3
```

Các dòng có `<...>` là chỗ điền giá trị, không sao chép nguyên văn vào `.env`. Trong `face_auth/.env`, đặt cùng `FACE_AUTH_INTERNAL_KEY` và `FACE_LOGIN_ENABLED=true`. Khởi động lại backend và Face Auth. Dùng model version ArcFace giống dữ liệu đăng ký, và cấu hình PAD/runtime đúng với model hiện có. Các khóa và ngưỡng chỉ ở server.

Với `docker-compose.yml` cục bộ, đặt `FACE_LOGIN_ENABLED` và `FACE_AUTH_INTERNAL_KEY` trong tệp biến Compose, chẳng hạn `.env.compose`; backend đọc khóa, ngưỡng so khớp và số lần xác nhận từ `backend/.env`. Hai khóa phải giống nhau. Stack cloud đọc `backend/.env` và `face_auth/.env` riêng. Hai stack mount `hardware/models` vào `/app/login-models` chỉ đọc; đặt `FACE_LOGIN_PAD_RUNTIME_CONFIG_PATH` trong biến Compose trỏ tới runtime đã được thử, ví dụ `/app/login-models/R7_SC_FULL_crop15_runtime_config.json`. Cấu hình PAD và model trên Face Auth cần khớp thiết bị Pi nếu muốn so sánh cùng điều kiện; không thay đổi runtime của thiết bị chấm công.

## Vòng đời lượt nhận diện (Streaming Attempt) và giới hạn tài nguyên

- **Topology hỗ trợ:** chỉ chạy **một Node process** và **một Python worker** (1 slot inference đăng nhập `BoundedSemaphore(1)`). Khởi động lại Node hoặc Python làm các lượt đang chạy thất bại đóng (fail-closed, kiểm tra qua `boot_id` và `operation_id`), không tự dựng lại bằng chứng PAD.
- **Vòng đời lượt (`AttemptStore` & `SessionStore`):**
  - Thời gian sống của lượt (`ATTEMPT_TTL_MS`): **15 giây** kể từ khi tạo, không gia hạn theo hoạt động. Response `start` và `status` trả cả `expiresAt` và `remainingMs` (frontend dùng đồng hồ đơn điệu `performance.now()` kết hợp `remainingMs` đã trừ RTT mạng để không phụ thuộc đồng hồ máy khách).
  - Giới hạn toàn cục: tối đa **20 lượt active** đồng thời trên Node và Python; tối đa **1 lượt active** trên mỗi browser binding; tối đa **75 frame/lượt** và **5 frame được chấp nhận/giây/lượt**.
  - Độ mới trạng thái `VERIFIED`: phải gọi `complete` trong vòng **5 giây** kể từ khi đạt `VERIFIED` và trước hạn 15 giây của lượt.
  - Python có tác vụ dọn dẹp định kỳ mỗi 1 giây dùng `try_sweep()` không chặn event loop (`acquire(blocking=False)`), kết hợp dọn ngay trong `finish()` khi lượt đã đóng hoặc hết hạn sau khi inference kết thúc.
- **Cookie binding, phục hồi kết quả (`recovery`) và đăng xuất (`logout`):**
  - Khi tạo lượt, server đặt cookie `face_login_attempt` (`HttpOnly`, `Secure` ở production, `SameSite` theo cấu hình auth, `Path=/`, `maxAge=60000`). Cookie này chỉ dùng để ràng buộc trình duyệt với lượt nhận diện, không phải thông tin xác thực.
  - Bước `POST /attempts/:id/complete` **không xóa và không gia hạn** cookie `face_login_attempt`. Kết quả hoàn tất được lưu cache tối đa **30 giây** kể từ lúc commit để nếu mạng bị đứt sau khi server đã xử lý, trình duyệt vẫn dùng được cookie jar thật để hỏi `GET /attempts/:id` (tối đa 4 lần, cách nhau ít nhất 250 ms) và gọi lại `POST /attempts/:id/complete` (tối đa 1 lần retry trong tổng ngân sách 10 giây) nhằm nhận lại đúng user/token đã cấp mà không dùng `/me` của phiên khác.
  - Khi tạo lượt mới trên cùng binding hoặc khi đăng nhập mật khẩu / xác thực lại bằng mật khẩu (`password-session`) thành công, server xóa cache recovery `COMPLETED` cũ (`dropCompletedRecovery`).
  - Khi `POST /api/auth/logout` (hoặc `/api/v1/auth/logout`), server luôn xóa cả cookie `token` và `face_login_attempt`. Nếu header `Origin` thuộc danh sách `CORS_ORIGIN` cho phép (ví dụ `http://localhost:5173` khi dev qua Vite proxy), server đồng thời vô hiệu hóa ngay lượt active và cache recovery của binding đó (`invalidateFaceLoginBinding`). Ở frontend, `logout` chỉ chờ một chiều: tăng epoch, abort `complete` đang chạy, chờ settle tối đa 1 giây rồi gửi request logout.
- **Quota theo IP (tách biệt luồng gửi ảnh và luồng điều khiển):**
  - Tạo lượt (`POST /attempts`): **10 request/phút/IP** (`IP_RATE_LIMIT`).
  - Gửi ảnh (`POST /attempts/:id/frames`): **300 request/phút/IP** (`IP_RATE_LIMIT`).
  - Điều khiển (`GET /attempts/:id`, `POST /attempts/:id/complete`, `POST /attempts/:id/cancel`): **300 request/phút/IP** dùng bộ đếm riêng (`controlLimiter`), đảm bảo khi hết quota gửi frame thì vẫn gọi được `status`, `complete` hoặc `cancel`.
  - Các lỗi `429` trả trường `code` phân biệt rõ: `ENGINE_BUSY` (frontend đợi ngẫu nhiên 200–400 ms rồi chụp frame mới, không tăng `seq`), `FRAME_RATE_LIMIT`, `ATTEMPT_CAPACITY`, và `IP_RATE_LIMIT` (dừng quét, không retry mỗi 200 ms).

## Chuẩn bị tài khoản

1. Có tài khoản EMPLOYEE đang hoạt động và mẫu CENTROID tương thích đã đăng ký. Không yêu cầu hai nhân viên để so sánh margin.
2. Khi đã đăng ký Face ID và lưu mẫu hợp lệ trong database, nhân viên dùng ngay nút đăng nhập khuôn mặt. Không có công tắc bật/tắt riêng từng tài khoản.
3. Ảnh camera không được lưu thành mẫu mới; chỉnh sửa nguồn mẫu vẫn qua chức năng đăng ký sinh trắc hiện có. Mẫu dùng để đăng nhập phải đang hoạt động và đúng phiên bản model; mẫu bị xóa/vô hiệu hóa làm phiên mặt không còn hợp lệ.

ADMIN/MANAGER bị chặn đăng nhập bằng mặt. Phiên mặt sống tối đa 30 phút, không có “Ghi nhớ”. Thay đổi trạng thái/role, xóa/vô hiệu hóa Face ID hoặc tắt cờ server làm phiên mặt không còn hợp lệ tại lần xác thực tiếp theo. Các thao tác đổi mật khẩu/hồ sơ và quản lý sinh trắc yêu cầu phiên mật khẩu. Biểu mẫu đổi mật khẩu dùng mật khẩu hiện tại để xác thực lại; khi lưu hồ sơ bằng phiên mặt, ứng dụng hiển thị ô xác nhận mật khẩu rồi thử lưu lại.

## Ranh giới module

- Backend `modules/auth/face-login`: quản lý trạng thái lượt (`face-login.attempts.ts`), helper cookie binding (`face-login.cookies.ts`), đọc stream RPC có giới hạn 40.000 byte và kiểm tra `operation_id` (`face-login.engine.ts`), kiểm tra nguồn request/Base64 canonical/quota (`face-login.routes.ts`) và phối hợp xác thực danh tính (`face-login.service.ts`).
- Backend `modules/biometrics`: auth dùng `findBestFaceMatch` qua public contract như luồng chấm công; `face-login.repository.ts` chỉ kiểm tra mẫu đang hoạt động khi cấp/xác thực phiên.
- Frontend `features/auth`: modal (`FaceLoginModal.tsx`), helper timeout/AbortSignal (`faceLoginRequest.ts`), camera (`faceCamera.ts`), API (`faceLoginApi.ts`) và xác thực lại bằng mật khẩu (`PasswordReauthentication.tsx`).
- Python `face_login/http.py` & `sessions.py`: HTTP entrypoint nội bộ, giới hạn body 300 KiB và JPEG 200 KiB trước decode, quản lý `SessionStore` cùng sweeper định kỳ không chặn event loop. `pipeline.py` dùng biểu quyết PAD, theo dõi khuôn mặt và trích vector; không tìm danh tính hoặc cấp session.

## Kiểm thử

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

Chi tiết số đo năng lực inference, ma trận kiểm thử, giới hạn NAT và phạm vi nhiều tab/JWT được ghi tại [báo cáo kiểm chứng](../../validation/face-login-streaming-hardening.md).
