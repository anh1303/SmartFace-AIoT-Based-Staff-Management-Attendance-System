# Báo cáo sửa lỗi và kiểm chứng đăng nhập khuôn mặt bằng streaming

## 1. Baseline môi trường và cấu hình (Công việc 0)

- **Git revision baseline:** `6db8b225d91323db2d24b10d1687201d064b1271` (branch `giap`)
- **Node.js runtime:** `v26.7.0` (1 Node process)
- **Python runtime:** `3.11.9` trên `Windows-10-10.0.22631-SP0` (1 Python worker, 1 inference slot `BoundedSemaphore(1)`)
- **CPU / phần cứng đo:** `Intel64 Family 6 Model 183 Stepping 1, GenuineIntel` (16 logical cores)
- **ONNX Runtime:** `1.30.0` (`CPUExecutionProvider`)
- **Cấu hình sinh trắc học (không chứa secret):**
  - `MODEL_PACK_NAME` / `EMBEDDING_MODEL_VERSION`: `buffalo_s`
  - `PAD_MODEL_FILENAME`: `R7_SC_FULL_crop15.onnx` (SHA-256: `7b3008a040e155f7b96fca74f52dd38cc6296d88fee7a9424e653203c367a253`)
  - `PAD_MIN_VOTES`: `3`, `PAD_SMOOTH_WINDOW`: `5`
  - `DETECTOR_DET_SIZE`: `640x640`, `DETECTOR_MIN_FACE_SIZE`: `60`
  - `ATTENDANCE_STABLE_COUNT` mặc định: `3` (hợp lệ chuỗi số nguyên `1..6`)
  - Attempt TTL: `15.000 ms`, Verified freshness: `5.000 ms`, Completion cache: `30.000 ms`, Cookie binding TTL: `60.000 ms`

### Kết quả bộ focused tests baseline (trước khi sửa)

| Bộ kiểm thử | Kết quả baseline | Chi tiết |
|---|---|---|
| Backend focused (`6` files) | `29 passed / 0 failed / 0 skipped` | `face-login.test.ts` (7), `face-login-routes.test.ts` (3), `face-login-session.test.ts` (5), `revocation-and-session.test.ts` (7), `auth-projection.test.ts` (4), `auth-cookie.test.ts` (3) |
| Frontend focused (`5` files) | `20 passed / 0 failed / 0 skipped` | `face-login-camera.test.ts` (3), `face-login-modal.test.tsx` (10), `face-login-stepup.test.tsx` (1), `logout-login-race.test.tsx` (3), `session-isolation.test.tsx` (3) |
| Python focused (`3` suites) | `13 passed / 0 failed / 0 skipped` | `test_face_login_sessions`, `test_face_login_parity`, `test_face_login_http` |

---

## 2. Đính chính số đo và trạng thái năng lực dịch vụ

**Chưa đo được năng lực dịch vụ. Không dùng số đo cũ để đặt quota hoặc công bố số người đồng thời.**

- Fixture lần đo cũ là `metadata/plots/__results___15_1.png`, một ảnh biểu đồ trong kết quả huấn luyện, không phải fixture ảnh chân dung đã được xác nhận. Detector phát hiện một vùng giống mặt không chứng minh đó là ảnh khuôn mặt phù hợp.
- `pad_passes_naturally=false`; `_RealPadWithForcedPass` đã ép verdict PAD thành REAL ở cả đường detect/PAD và đường có embedding. Vì vậy cách gọi “ảnh khuôn mặt cục bộ” và mô tả không nêu ép verdict trong phiên bản báo cáo trước là không chính xác.
- Rút lại các số 31,20 fps, 15,50 fps và khuyến nghị 12 frame/giây như bằng chứng năng lực vận hành. Kết quả 2 client cũ chỉ cho thấy hành vi tranh slot trong chương trình đo, không chứng minh hai người đăng nhập đồng thời thành công.
- Script đã bỏ ép verdict và tự quét ảnh. Người chạy phải truyền `--image` trỏ tới ảnh chân dung có nguồn gốc được xác nhận; script từ chối ảnh không được detector/chất lượng/PAD chấp nhận tự nhiên. Các kiểm tra model không tự chứng minh nguồn gốc ảnh.
- Với mặc định 30 mẫu, chỉ đặt `measured=true` khi đủ 30/30 mẫu embedding:ok và đủ mẫu hợp lệ ở đường PAD. Mẫu lỗi có số lượng/thời gian riêng, không được tính thành throughput thành công; khi thiếu mẫu, fps của đường đó là null và kết quả tổng là measured=false.
- Kết quả luôn có `forced_pad_verdict=false`. Không còn trường `guideline_service_fps_floor`; ngay cả phép đo hợp lệ cũng chỉ là chi phí inference cục bộ, không phải năng lực HTTP/database toàn dịch vụ. Phiếu PAD chuẩn bị cho mỗi mẫu embedding đến từ model thật, được ghi rõ và nằm ngoài timing frame đo.
- Chưa có fixture chân dung được chỉ định cho lần sửa này, nên chưa đo lại model. Giữ nguyên quota; không suy ra số client hỗ trợ.

Lệnh đo khi có fixture phù hợp: `python scripts/validation/measure_face_login_capacity.py --image <duong-dan-anh-chan-dung> --warmup 5 --iterations 30`. Không truyền ảnh trả `measured=false`, lý do `explicit_face_image_required`, trước khi nạp model.

---

## 3. Các lỗi đã sửa và bằng chứng kiểm thử (F1–F9)

| Mã | Nội dung sửa | File sản phẩm | Test chứng minh |
|---|---|---|---|
| **F1** | `POST /attempts/:id/complete` giữ nguyên cookie `face_login_attempt` (không xóa, không gia hạn TTL); frontend recovery hỏi `status` + retry `complete` idempotent bằng cookie jar thật, không dùng `/me` của tài khoản khác | `face-login.routes.ts`, `AuthContext.tsx` | `face-login-routes.test.ts` (`streams frames without issuing auth cookies...`), `logout-login-race.test.tsx` (`reconciles a lost face-login completion response...`) |
| **F2** | Thêm `remainingMs` vào `start`/`status`; tạo `withBoundedSignal` (`faceLoginRequest.ts`); timer deadline độc lập vòng `while` theo `performance.now()` và `remainingMs` đã trừ RTT | `face-login.service.ts`, `faceLoginRequest.ts`, `faceLoginApi.ts`, `FaceLoginModal.tsx` | `face-login-modal.test.tsx` (`uses remainingMs with performance.now()...`, `aborts hung frame/start requests...`) |
| **F3** | Logout một chiều ở `AuthContext` (đặt cờ logout, tăng epoch, abort complete, chờ settle tối đa 1s rồi gửi `logoutApi` timeout 4s); server thêm `invalidateBinding`, `dropCompletedRecovery`, `invalidateFaceLoginBinding`; login mật khẩu lúc đang complete/logout trả đúng chuỗi báo bận | `face-login.attempts.ts`, `face-login.service.ts`, `face-login.cookies.ts`, `auth.controller.ts`, `AuthContext.tsx` | `face-login.test.ts`, `face-login-routes.test.ts` (`logout_clears_cookie_already_set_by_complete_headers`), `logout-login-race.test.tsx` |
| **F4** | Thêm `SessionStore.try_sweep()` dùng `lock.acquire(blocking=False)`; đăng ký task sweeper mỗi 1s khi router startup và hủy/await khi shutdown; `finish()` xóa ngay session `closed`/expired khi inference xong | `face_auth/face_login/sessions.py`, `face_auth/face_login/http.py` | `test_face_login_sessions.py` (`test_try_sweep_non_blocking...`, `test_concurrent_try_sweep_begin_finish_close...`) |
| **F5** | Tách `controlLimiter` (300/phút/IP) cho `status`/`complete`/`cancel` khỏi `frameLimiter` (300/phút/IP) và `limiter` (10/phút/IP); 429 trả `code` phân biệt `ENGINE_BUSY`, `FRAME_RATE_LIMIT`, `IP_RATE_LIMIT`, `ATTEMPT_CAPACITY` | `face-login.routes.ts`, `face-login.service.ts`, `FaceLoginModal.tsx` | `face-login-routes.test.ts` (`distinguishes 429 error codes...`), `face-login-modal.test.tsx` |
| **F6** | Đọc RPC stream từng chunk với giới hạn cứng 40.000 byte (`reader.cancel()` ngay khi vượt, `releaseLock()` trong `finally`), không tin `Content-Length`, timeout bao trùm cả headers và body | `face-login.engine.ts` | `face-login-engine.test.ts` (`accepts multi-chunk body up to 40,000 bytes...`, `enforces timeout across both fetch headers and stalled chunked body...`) |
| **F7** | Bắt buộc `operation_id` khớp request khi gửi `operationId`; parse `ATTENDANCE_STABLE_COUNT` toàn chuỗi chữ số nguyên `1..6` sau trim; kiểm tra Base64 canonical trước khi gọi RPC | `face-login.engine.ts`, `face-login.service.ts`, `face-login.routes.ts` | `face-login-engine.test.ts`, `face-login.test.ts`, `face-login-routes.test.ts` |
| **F8** | Đưa kiểm tra deadline và trạng thái kết thúc (`EXPIRED`, `CANCELLED`, `FAILED`, `COMPLETED`, `COMPLETING`, `PROCESSING`) lên trước bước tra cache replay trong `AttemptStore.startFrame` | `face-login.attempts.ts` | `face-login.test.ts` (`checks terminal and deadline states before replay cache lookup...`) |
| **F9** | Cập nhật tài liệu vận hành khớp attempt 15s, tối đa 20 active, cookie/recovery mới, quota tách biệt và topology 1 Node / 1 Python worker | `docs/tutorial/face_auth/FACE_LOGIN_WEB.md` | Đối chiếu trực tiếp với code và bộ test nghiệm thu |

---

## 4. Quota, giới hạn NAT văn phòng và ước tính số người dùng đồng thời

### Bảng quota hiện hành (áp dụng chung cho cả `/api/auth/face-login` và `/api/v1/auth/face-login`)

| Nhóm endpoint | Giới hạn theo IP | Giới hạn theo lượt / toàn cục | Mã lỗi 429 |
|---|---|---|---|
| `POST /attempts` | 10 request / phút / IP | 1 active / browser binding; 20 active toàn cục | `IP_RATE_LIMIT` / `ATTEMPT_CAPACITY` |
| `POST /attempts/:id/frames` | 300 request / phút / IP | 5 frame được chấp nhận / giây / lượt; tối đa 75 frame / lượt; 1 slot inference | `IP_RATE_LIMIT` / `FRAME_RATE_LIMIT` / `ENGINE_BUSY` |
| `GET /attempts/:id`, `POST /complete`, `POST /cancel` | 300 request / phút / IP (bộ đếm `controlLimiter` riêng) | Ràng buộc theo browser binding | `IP_RATE_LIMIT` |

### Giới hạn NAT khi nhiều nhân viên dùng chung một IP văn phòng

- Khi server triển khai ngoài Internet/cloud hoặc sau reverse proxy và toàn bộ văn phòng đi ra qua một địa chỉ IP công cộng (NAT), **cả văn phòng dùng chung ngân sách 10 request `start`/phút và 300 request `frame`/phút** trên IP đó, **kể cả các frame trả về `429 ENGINE_BUSY` sau khi đã đi qua `frameLimiter`**.
- `300 request frame/phút/IP` tương đương trung bình **5 request frame/giây** trong cửa sổ 1 phút (không phải giới hạn cứng 5 request ở mọi giây đơn lẻ; một đợt burst đầu phút vẫn có thể tiêu thụ hết ngân sách 300 request trước khi hết phút).
- Mỗi lần người dùng bấm mở nhận diện hoặc bấm "Thử lại" đều tiêu thụ 1 lượt trong quota `10 start/phút/IP`; do đó `10 start/phút/IP` không đồng nghĩa chắc chắn 10 nhân viên đăng nhập thành công mỗi phút nếu có lượt thất bại hoặc thử lại.
- Nếu triển khai sau Nginx / Docker reverse proxy, Express phải được cấu hình `trust proxy` khớp với số tầng proxy tin cậy để limiter tính theo IP client thực thay vì gộp toàn bộ người dùng vào IP của proxy.

### Ước tính số người đồng thời dưới cùng một IP NAT

Với tốc độ gửi trung bình $r$ request frame/giây/người, trần số người quét đồng thời dài hạn do quota `300 frame/phút/IP` (trung bình 5 frame/giây/IP) quy định là:

$$\text{Trần quota đồng thời} = \lfloor 5 / r \rfloor$$

- Ví dụ minh họa theo giả định $r$:
  - Nếu mỗi client gửi ở tốc độ tối đa $r = 5\text{ fps}$ (khoảng cách 200 ms, mạng và inference phản hồi tức thì): $\lfloor 5 / 5 \rfloor = 1$ người quét liên tục.
  - Nếu giả định mỗi client gửi trung bình $r = 2,5\text{ fps}$ (chưa đo được ở môi trường vận hành): $\lfloor 5 / 2,5 \rfloor = 2$ người đồng thời theo quota.
  - Nếu mỗi lượt chỉ kéo dài ngắn (ví dụ 5–8 frame rồi hoàn tất) hoặc tốc độ trung bình $r = 1\text{ fps}$: $\lfloor 5 / 1 \rfloor = 5$ người.
- **Lưu ý quan trọng:** công thức $\lfloor 5 / r \rfloor$ chỉ là trần ngân sách quota theo IP, không phải cam kết hiệu năng đồng thời. Trong đợt kiểm chứng này:
  - Chưa có phép đo hợp lệ để công bố năng lực inference hoặc số người đồng thời. Các số đo dùng ảnh biểu đồ và ép PAD ở bản báo cáo cũ đã được rút lại tại mục 2.
  - Vào giờ cao điểm buổi sáng nếu nhiều nhân viên cùng một IP văn phòng mở đăng nhập khuôn mặt cùng lúc, người dùng có thể gặp `429` (`ENGINE_BUSY` hoặc `IP_RATE_LIMIT`) và cần chờ hoặc dùng mật khẩu dự phòng.

---

## 5. Cấu hình dev qua Vite proxy và giới hạn phạm vi (Nhiều tab / JWT)

- **Kiểm tra Origin qua Vite dev proxy:**
  - `backend/src/config/env.ts` và `backend/.env.example` mặc định `CORS_ORIGIN=http://localhost:5173`.
  - `frontend/vite.config.ts` proxy `/api` tới `http://127.0.0.1:3000`. Khi mở frontend tại `http://localhost:5173`, trình duyệt gửi header `Origin: http://localhost:5173` qua proxy tới backend.
  - Đã kiểm thử tự động trong `backend/validation/auth/face-login-lifecycle.test.ts`: request `POST /api/auth/logout` và `POST /api/v1/auth/logout` với `Origin: http://localhost:5173` xóa cả hai cookie (`token`, `face_login_attempt`) và gọi `invalidateFaceLoginBinding` xóa ngay recovery/attempt trên server; trong khi logout thiếu hoặc sai `Origin` vẫn xóa cookie để giữ tương thích nhưng không thay đổi store trên server.
- **Giới hạn nhiều tab và thu hồi JWT:**
  - Cơ chế epoch và `AbortController` trong `AuthContext` bảo đảm thứ tự mutation trong cùng một `AuthProvider` (cùng một tab). Giữa nhiều tab trình duyệt độc lập chia sẻ chung cookie jar, một response `Set-Cookie` đã commit từ tab khác vẫn tuân theo cơ chế cookie của trình duyệt.
  - `invalidateFaceLoginBinding` khi logout ngăn chặn hoàn toàn việc cấp lại cookie từ completion cache hoặc commit một lượt đang chờ, nhưng không thu hồi riêng lẻ một JWT đã được ký và sao chép ra ngoài (các JWT đã cấp vẫn tuân theo `token_version`, thời hạn 30 phút và kiểm tra `verifyAndLoadActiveUser` / mẫu Face ID còn hoạt động).

---

## 6. Kết quả chạy kiểm thử nghiệm thu sau khi sửa

| Lệnh kiểm tra | Kết quả |
|---|---|
| Backend focused (`8` files, gồm `face-login-engine.test.ts` và `face-login-lifecycle.test.ts`) | **42 passed / 0 failed** (`8/8` test files) |
| Frontend focused (`5` files) | **24 passed / 0 failed** (`5/5` test files) |
| Python focused (`test_face_login_sessions`, `test_face_login_parity`, `test_face_login_http`) | **16 passed / 0 failed** |
| `npm.cmd --prefix backend run build` (`tsc`) | **Exit 0 (Pass)** |
| `npm.cmd --prefix frontend run lint` (`tsc --noEmit`) | **Exit 0 (Pass)** |
| `npm.cmd --prefix frontend run build` (`vite build`) | **Exit 0 (Pass)** |
| Full backend suite (`npm.cmd --prefix backend test`) | **623 passed / 74 skipped / 0 failed** (`93` passed files) |
| Full frontend suite (`npm.cmd --prefix frontend test`) | **250 passed / 0 failed** (`70` passed files) |

## 7. Kiểm tra lại sau đính chính benchmark và bổ sung cookie test

- `python -m unittest discover -s scripts/validation -p test_measure_face_login_capacity.py`: **8 test qua**, gồm toàn bộ 30 mẫu raw_spoof, mẫu lỗi xen kẽ, ảnh không có mặt/PAD không đạt, ảnh ngoài repo và không tự tìm fixture.
- Chạy script không có `--image`: trả `measured=false`, `forced_pad_verdict=false`, `reason=explicit_face_image_required`. Không nạp/chạy lại model thật trong lần sửa này.
- Test HTTP đã kiểm tra endpoint echo cookie: trước abort, agent thực sự gửi token và binding; sau logout, agent không gửi cả hai cookie. Nhánh giữ body dùng content type không buffer để Superagent xử lý Set-Cookie ngay tại headers; nhánh body JSON bị cắt vẫn giữ riêng. Đây là bằng chứng cookie jar HTTP, không được trình bày như test browser thật.
- Full backend sau sửa: **623 qua, 74 bỏ qua, 0 lỗi**; backend build qua. Python focused: **16 qua**. Các kết quả frontend tại mục 6 là lần kiểm tra trước; đợt đính chính này không thay frontend.
- Đã xóa helper `clearBinding` và import không dùng trong face-login.routes.ts. Việc rút gọn timeout bọc hai lớp chưa thực hiện trong đợt sửa này.
