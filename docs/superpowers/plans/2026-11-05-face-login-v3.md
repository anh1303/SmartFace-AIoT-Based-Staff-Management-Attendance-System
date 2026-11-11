# Kế hoạch đăng nhập tự nhận diện khuôn mặt — bản 3

> Yêu cầu mới nhất thay thế các điều kiện nhận diện riêng trong bản này: đăng nhập webcam dùng biểu quyết PAD, ngưỡng `FACE_MATCH_THRESHOLD` và số lần xác nhận `ATTENDANCE_STABLE_COUNT` như luồng Pi; không còn yêu cầu quay mặt, margin top-2 hoặc ngưỡng consistency riêng. Tài liệu hiện hành: `docs/tutorial/face_auth/FACE_LOGIN_WEB.md`.

> Yêu cầu mới nhất đã thay thế cơ chế opt-in trong bản kế hoạch này: nhân viên có Face ID hợp lệ đã đăng ký trong database được dùng đăng nhập khuôn mặt, không có công tắc riêng từng tài khoản. Giao diện/API cài đặt và điều kiện profile opt-in đã được gỡ; phiên mặt được kiểm tra theo mẫu Face ID đang hoạt động. Xem hành vi hiện tại trong hướng dẫn tính năng web.

> Cập nhật theo yêu cầu làm rõ: triển khai trực tiếp nút mở camera trên web để **đăng nhập tài khoản, không chấm công**. API/UI được phát triển để kiểm thử với cờ mặc định tắt; chưa coi spike là đạt và chưa bật nhận diện thật. Xem [hướng dẫn tính năng web](../../tutorial/face_auth/FACE_LOGIN_WEB.md) và [giao thức webcam thật](../../experiments/face-login-spike-report.md).

**Phạm vi:** Thử nghiệm trên một instance backend, `face_auth` và PostgreSQL, với vài người quen tự nguyện tham gia. Người vận hành dự án trực tiếp quyết định có tiếp tục sau thử nghiệm hay không. Người dùng chọn đăng nhập bằng camera máy tính; hệ thống tự nhận diện 1:N. Mật khẩu vẫn là phương án đăng nhập thay thế.

**Giới hạn:** Đây là thử nghiệm, không đủ dữ liệu để kết luận hệ thống an toàn cho toàn bộ nhân viên hay môi trường sản xuất. Khuôn mặt không phải bí mật; PAD, nonce và yêu cầu cử động không bảo đảm ngăn video phát lại, camera ảo hoặc deepfake. [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) yêu cầu sinh trắc được dùng cùng authenticator vật lý trong mô hình xác thực của tiêu chuẩn này; luồng mặt đơn lẻ ở đây không đáp ứng yêu cầu đó.

## Changelog so với bản 2

- Dùng `Map` có TTL và giới hạn số phần tử cho challenge trong một tiến trình; không thêm Redis.
- Một middleware kiểm tra `amr` bảo vệ một nhóm nhỏ thao tác nhạy cảm; xác thực lại bằng mật khẩu để có phiên đủ điều kiện.
- Đếm thất bại và ghi log tổng hợp; không xây dựng hệ thống cảnh báo theo ứng viên.
- Chỉ cho phép mạng LAN hoặc VPN được cấu hình tại proxy/firewall; không bổ sung mTLS/MDM.
- Bỏ thủ tục phê duyệt nội bộ và đánh giá độc lập phức tạp khỏi thử nghiệm cá nhân; giữ đồng ý tự nguyện, giảm dữ liệu và kiểm tra nghĩa vụ pháp lý thực tế trước khi thu thập.
- Bỏ kiểm thử đa instance, đánh giá timing chuyên sâu và kế hoạch chuyển đổi token cũ. Token thiếu `amr` bị chặn tại middleware thao tác nhạy cảm và người dùng đăng nhập lại bằng mật khẩu.

## 1. Luồng và phạm vi kỹ thuật

1. Người tham gia đăng nhập bằng mật khẩu và chủ động bật đồng ý dùng mẫu khuôn mặt cho đăng nhập. Mẫu phải đã được đăng ký trong hệ thống; đồng ý cho chấm công không tự áp dụng cho đăng nhập.
2. Trang đăng nhập lấy trạng thái tính năng từ backend, mở camera sau thao tác người dùng và xin challenge.
3. Người dùng thực hiện cử động được yêu cầu; frontend gửi chuỗi JPEG cùng ID challenge qua LAN/VPN và HTTPS hoặc môi trường localhost an toàn.
4. Backend tiêu thụ challenge một lần, gọi `face_auth`. `face_auth` kiểm tra ảnh, đúng một mặt, PAD, tính nhất quán và hành động; sau đó trích xuất vector.
5. Backend tìm hai nhân viên phù hợp nhất trong tập đã opt-in, kiểm tra ngưỡng và vai trò. Nếu hợp lệ, cấp cookie phiên ngắn với `amr: ["face"]`; không ghi chấm công.

Các phần hiện có cần tận dụng: `face_auth/api_service.py`, detector/aligner/embedder và `antispoof/predictor.py`; `backend/src/modules/biometrics/biometric.service.ts` và bảng `face_embeddings`; `backend/src/modules/auth/`; `frontend/src/context/AuthContext.tsx` và `frontend/src/pages/public/LoginPage.tsx`. API trích vector hiện tại nhận ảnh đã căn chỉnh và chưa làm PAD cho login; cần luồng xử lý mới. Giữ nguyên hàm tìm mặt phục vụ chấm công.

## 2. Quyết định thiết kế

- **1:N:** Giữ theo yêu cầu không nhập tên. 1:1 giảm phạm vi tìm kiếm nhưng cần nhập danh tính; mật khẩu + mặt và passkey có bảo đảm khác và thêm bước/thiết bị. Nếu 1:N thử không đạt hoặc rủi ro không chấp nhận được thì dừng, không hạ ngưỡng để ép đạt.
- **Vai trò:** Chỉ cho phép role `EMPLOYEE`; kiểm tra khi tìm và khi xác thực request. Chặn `ADMIN`, `MANAGER` và role chưa biết. Vai trò thay đổi sau khi cấp token thì phiên mặt bị từ chối.
- **Phiên:** Cookie HttpOnly, Secure khi triển khai HTTPS, SameSite theo chính sách dự án; JWT mặt có `amr: ["face"]`, thời hạn thử nghiệm tối đa 30 phút. Không hỗ trợ `rememberMe` cho mặt. Kiểm tra trạng thái tài khoản, nhân viên, opt-in và token version trên mỗi request; socket phải áp dụng cùng điều kiện nếu cho phép kết nối.
- **Thao tác nhạy cảm:** Một middleware `requirePasswordAuth` kiểm tra claim đã được server ký; thiếu `amr` hoặc chỉ có `face` thì trả yêu cầu xác thực lại. Kiểm kê các route thực tế, trước mắt bảo vệ đổi mật khẩu, đổi email/thông tin khôi phục, bật/rút consent, quản lý sinh trắc và xuất dữ liệu cá nhân nếu route tồn tại. Nhóm này là nhóm chức năng, số endpoint thực tế có thể khác năm. Re-auth mật khẩu cấp phiên mới có `amr: ["pwd"]`; tái sử dụng logic kiểm tra mật khẩu và giới hạn số lần thử. Không gọi kết hợp này là MFA.
- **Dữ liệu:** Đồng ý cho mục đích đăng nhập là riêng biệt, có thể rút. Không lưu ảnh webcam hoặc vector truy vấn ra đĩa, log hay frontend storage. Mẫu dùng chung cho chấm công không tự xóa khi rút đồng ý đăng nhập.
- **Mạng:** Cấu hình proxy/firewall chỉ nhận yêu cầu từ LAN/VPN; backend và Face Auth không mở công khai. LAN/VPN giảm bề mặt truy cập nhưng không chứng minh thiết bị hoặc camera đáng tin. Dùng HTTPS cho truy cập từ máy khác; camera trình duyệt thường yêu cầu secure context.

## 3. Đồng ý và sử dụng dữ liệu thật

Trước khi thu ảnh thử nghiệm, nói rõ cho từng người: mục đích tự nhận diện để đăng nhập, ảnh được xử lý như thế nào, mẫu đăng ký có được dùng lại không, người có quyền truy cập, thời gian dự kiến lưu kết quả thử và cách rút đồng ý. Cho phép từ chối mà vẫn dùng mật khẩu. Chỉ thu lượng dữ liệu cần thiết; báo cáo thử nghiệm dùng số liệu tổng hợp, không commit ảnh hay vector thật.

Lưu trạng thái đồng ý theo `employee_id`, mục đích `FACE_LOGIN`, phiên bản nội dung, thời điểm bật/rút và phiên bản trạng thái. Khi rút, loại khỏi truy vấn và từ chối mọi phiên mặt còn hiệu lực bằng kiểm tra trạng thái/version; không ảnh hưởng phiên mật khẩu và dữ liệu chấm công hợp lệ.

Nếu dữ liệu người thật được xử lý tại Việt Nam, kiểm tra nghĩa vụ áp dụng theo [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=) và quy định liên quan. Quy mô nhỏ hay sự đồng ý không tự miễn mọi nghĩa vụ; kế hoạch không khẳng định một thời hạn lưu hay thủ tục cụ thể khi chưa xác định bối cảnh. Không cần dựng quy trình phê duyệt nội bộ chỉ để chạy thử.

## 4. Công việc 0 — spike go/no-go trước API và UI

**Tệp dự kiến:** `face_auth/scripts/spike_webcam_login.py`, `face_auth/tests/test_face_login_spike.py`, `docs/experiments/face-login-spike-report.md`. Script thử nghiệm không cấp cookie và không thay đổi API sản phẩm.

- [ ] Với sự đồng ý, kiểm tra vài người đã đăng ký: nguồn mẫu đăng ký, phiên bản model, độ rõ và sự khác biệt về camera, ánh sáng, góc; không giả định tất cả mẫu được chụp bằng Raspberry Pi.
- [ ] Chạy đúng pipeline dự kiến: webcam → resize/encode JPEG → decode → phát hiện → PAD theo cấu hình model hiện có → căn chỉnh → embedding → tổng hợp → so khớp 1:N. Ghi điều kiện, số lần thử và kết quả tổng hợp; không thay crop PAD chỉ vì ảnh 16:9/4:3.
- [ ] Với từng người thử nhiều lần và có lần thử người chưa đăng ký; thử ít nhất ảnh in, ảnh trên màn hình và video phát lại nếu có thể. Kiểm tra nhiều mặt, thiếu sáng, mất mặt; đo thời gian xử lý và xem các cử động challenge có thực sự phân biệt được theo chuỗi khung.
- [ ] Tách các lần dùng để chọn cấu hình khỏi các lần kiểm tra lại; ghi số lượng và kết quả từng nhóm. Nhóm nhỏ chỉ giúp phát hiện vấn đề rõ ràng, không chứng minh tỷ lệ lỗi thấp.
- [ ] Người vận hành quyết định **go** nếu luồng hoạt động đủ ổn định cho thử nghiệm, từ chối được các trường hợp giả đã thử và chấp nhận được giới hạn; **no-go** nếu nhận nhầm/giả mạo hoặc challenge không khả thi. Ghi rõ trường hợp chưa thử. Thiếu dữ liệu thì chỉ kết luận chưa đủ bằng chứng, không tuyên bố an toàn.

Không bắt đầu các công việc API/UI sau đây cho đến khi spike cho thấy khả thi; nếu chưa đủ an toàn để dùng thực tế thì giữ cờ tắt.

## 5. Challenge và hợp đồng API

### Challenge trong một tiến trình

- `GET /api/auth/face-login/config` trả `{ faceLoginEnabled: boolean }`, `Cache-Control: no-store`; UI tải lại khi vào trang. Backend luôn tự kiểm tra cờ. Thay biến môi trường cần restart tiến trình; tab đang mở cập nhật khi gọi lại config.
- `POST /api/auth/face-login/challenges`: khi bật tính năng và chưa vượt giới hạn, sinh ID CSPRNG tối thiểu 128 bit và chọn ngẫu nhiên một hành động đã được spike chứng minh có thể kiểm tra, chẳng hạn quay trái hoặc phải. Trả `{ challengeId, challenge, expiresAt }`.
- Lưu `Map<challengeId, { action, expiresAt }>` với TTL thử nghiệm 60 giây, số phần tử tối đa và dọn phần tử hết hạn; khi đầy trả 429. Xóa challenge **đồng bộ trước mọi `await`** khi nhận request, nên chỉ request đầu trong tiến trình có thể dùng; sai/hết hạn/đã dùng phải xin cái mới. Khởi động lại làm mất challenge và yêu cầu người dùng bắt đầu lại.
- Map chỉ đúng khi mọi request tới **cùng một tiến trình**. Không chạy cluster, nhiều worker hay nhiều bản sao backend; nếu mở rộng, phải thay bằng kho dùng chung có thao tác consume nguyên tử trước khi bật lại tính năng.

### Đăng nhập

- `POST /api/auth/face-login`: `{ challengeId, frames }`, không nhận username, embedding, PAD score, role hay `rememberMe`. Thử nghiệm bắt đầu với 3–5 ảnh JPEG base64, mỗi ảnh tối đa 200 KiB sau giải mã và tổng request tối đa 1,5 MiB; điều chỉnh số khung/nhịp nếu spike cho thấy không đủ xác minh cử động.
- Backend gửi `{ requestId, challenge, frames }` tới endpoint nội bộ mới `POST /internal/face-login/extract`, dùng `X-Face-Auth-Key` và giới hạn timeout. Face Auth chỉ trả `{ requestId, status, modelVersion, embedding }` khi hợp lệ; backend kiểm tra request ID, model version và vector 512 chiều hữu hạn, norm hợp lệ.
- Lỗi PAD, không khớp, chưa đồng ý, tài khoản bị khóa, role không hợp lệ hoặc challenge không đạt: cùng HTTP 401 và thông báo chung, không lộ điểm/tên. Lỗi request sai cấu trúc, quá lớn, quá tải và dịch vụ không sẵn sàng có thể trả 400/413/429/503 theo loại kỹ thuật. Lỗi quyền camera xử lý cục bộ.
- Nonce làm challenge đã dùng không thể gửi lại nguyên giao dịch; kẻ tấn công vẫn có thể gửi ảnh/video cũ trong challenge mới. Chỉ chấp nhận cử động khi **server thực sự phân tích được** chuỗi ảnh; không tin boolean hay timestamp do browser cung cấp.

## 6. Xử lý sinh trắc và so khớp

- Mỗi khung phải decode hợp lệ, có đúng một khuôn mặt đủ rõ; kiểm tra nhất quán cùng người, PAD và challenge bằng model/runtime đã được spike xác nhận. Mọi lỗi model, thiếu dữ liệu hoặc kết quả không hữu hạn phải từ chối.
- Với N vector hợp lệ `v_i`: chuẩn hóa `u_i = v_i / ||v_i||₂`; yêu cầu mỗi cặp có cosine `u_i · u_j >= T_consistency`; tính `m = Σu_i/N`, trả `q = m/||m||₂`. Từ chối norm bằng 0 hoặc không hữu hạn. `T_consistency` chọn từ spike; 0,75 chỉ là ví dụ, không phải mặc định an toàn.
- Tìm chính xác trong PostgreSQL/pgvector trên các CENTROID đang hoạt động, đúng model version, thuộc nhân viên ACTIVE, user ACTIVE, role EMPLOYEE và consent đăng nhập còn hiệu lực. Lọc **trước** xếp hạng; lấy hai nhân viên phân biệt có similarity cao nhất. Không dùng kết quả tìm chấm công rồi lọc sau top-K.
- Chấp nhận nếu `s1 >= T_match` và `s1 - s2 >= T_margin`; nếu không đủ hai ứng viên thì từ chối trong thử nghiệm này. Hai ngưỡng chọn dựa trên spike, không tự lấy từ chấm công hay giá trị mẫu 0,05–0,08. Nếu cần vận hành với một người đã opt-in, phải thiết kế và đánh giá chính sách riêng trước.
- Xác nhận truy vấn là exact bằng `EXPLAIN` và đối chiếu với dữ liệu thử có đáp án; không dùng ANN/HNSW cho luồng này nếu làm kết quả top 2 gần đúng. Không sửa `findBestFaceMatch` dùng bởi attendance.
- Kiểm tra chất lượng và phiên bản các mẫu đăng ký; không âm thầm thay mẫu đang dùng chấm công. Nếu mẫu không phù hợp webcam, đề xuất đăng ký lại qua quy trình hiện có và chỉ sau sự đồng ý của người dùng.

## 7. Các bước triển khai sau spike

### 7.1 Đồng ý và cấu hình

**Tệp dự kiến:** `backend/prisma/schema.prisma`, migration, `backend/src/modules/biometrics/`, `frontend/src/features/account/`.

- [ ] Thêm bảng/trạng thái consent theo người và mục đích, mặc định tắt; migration không tự opt-in người đang có mẫu.
- [ ] Tạo chức năng xem, bật và rút consent trong tài khoản sau xác thực mật khẩu; admin không bật thay. Rút làm mọi phiên mặt của người đó hết hiệu lực tại lần kiểm tra tiếp theo.
- [ ] Thêm `FACE_LOGIN_ENABLED=false` mặc định, cấu hình TTL, ngưỡng và URL/khóa nội bộ; khi thiếu cấu hình cần thiết thì fail closed.
- [ ] Kiểm thử chưa đồng ý, đồng ý, rút, đổi trạng thái khi đang xử lý, role đổi và chấm công vẫn dùng mẫu theo mục đích riêng.

### 7.2 Face Auth và chống quá tải

**Tệp dự kiến:** `face_auth/api_service.py`, `face_auth/face_login.py`, `face_auth/tests/test_face_login.py`.

- [ ] Thêm endpoint nội bộ với `require_internal_key`, validate số lượng/định dạng ảnh và khởi tạo detector, embedder, PAD một lần. Giữ preprocessing và crop theo model đã kiểm tra.
- [ ] Kiểm tra chữ ký/header JPEG và kích thước trước `cv2.imdecode`; giới hạn thử nghiệm 1920×1080 và 2.073.600 pixel, kiểm tra lại sau decode. Từ chối header sai, ảnh hỏng và ảnh nén nhỏ nhưng kích thước lớn. Giới hạn body tại proxy và trước parser Node toàn cục 20 MB.
- [ ] Giới hạn số inference đồng thời bằng semaphore; khi bận trả lỗi, không xếp hàng vô hạn. Đặt timeout cho request nhưng chỉ trả slot sau khi inference thực sự kết thúc; HTTP timeout không tự dừng ONNX. Giới hạn CPU/RAM container và kiểm thử tải đơn giản.
- [ ] Viết test không mặt/nhiều mặt, ảnh hỏng/quá lớn, spoof, sai challenge, đổi người, lỗi PAD, vector NaN, model chưa sẵn sàng; tất cả không trả vector. Test công thức vector và nhận diện cử động dựa trên fixture được phép.
- [ ] Chạy `python -m pytest tests/test_face_login.py tests/test_pad_predictor.py tests/test_runtime.py -q` trong `face_auth` và smoke test model thực tế.

### 7.3 Backend và bảo vệ phiên

**Tệp dự kiến:** `backend/src/modules/auth/`, `backend/src/modules/biometrics/`, `backend/src/middlewares/`, `backend/src/sockets/socket.auth.ts`, `backend/src/app.ts`.

- [ ] Viết endpoint config/challenge/login, Map TTL, validate body và giới hạn tốc độ theo IP cùng giới hạn tổng. Cấu hình trusted proxy chính xác; không tin IP do client tự khai. Đếm thất bại theo nguồn/cửa sổ và log sự kiện tổng quát; không log ảnh, vector, điểm, token hay nội dung request.
- [ ] Gọi Face Auth, so khớp exact theo mục 6 và kiểm tra lại consent, trạng thái, role ngay trước cấp cookie. Kiểm tra lại trạng thái/version trên request và socket để thay đổi đồng ý/vai trò vô hiệu phiên mặt.
- [ ] Dùng chung phần tạo phiên với đăng nhập hiện có; phát `amr: ["pwd"]` cho đăng nhập mật khẩu và `amr: ["face"]` cho mặt, với giới hạn thời gian theo mục 2. Không nhận `amr` từ frontend.
- [ ] Thêm middleware `requirePasswordAuth` cho các route nhạy cảm được kiểm kê. Token cũ thiếu `amr` bị chặn ở các route đó và yêu cầu đăng nhập lại bằng mật khẩu; test chính sách này. Xác thực lại mật khẩu sử dụng endpoint/quy trình sẵn có với rate limit và cấp phiên mật khẩu mới.
- [ ] Kiểm thử challenge dùng một lần/hết hạn, quota, lỗi dịch vụ, so khớp rỗng/một/hai ứng viên, consent, quyền, cookie và thao tác nhạy cảm. Chạy `npm test` và `npm run build` trong `backend`; kiểm thử truy vấn với PostgreSQL/pgvector thực.

### 7.4 Frontend

**Tệp dự kiến:** `frontend/src/pages/public/LoginPage.tsx`, `frontend/src/features/auth/api/authApi.ts`, `frontend/src/context/AuthContext.tsx`, component camera mới.

- [ ] Lấy config runtime và chỉ hiện nút khi bật; xin camera sau click, hiển thị preview, khung hướng dẫn và challenge. Hỗ trợ bàn phím, thông báo quyền camera và phương án mật khẩu.
- [ ] Đợi camera ổn định theo kết quả spike; chụp JPEG theo nhịp đã thử, kiểm tra kích thước thực tế trước gửi. Không giả định quality hay độ phân giải cố định luôn tạo tệp nhỏ hơn giới hạn.
- [ ] Tắt toàn bộ tracks khi hủy, lỗi, thành công hoặc unmount; không lưu ảnh trong storage/log. Vô hiệu submit lặp; challenge hết hạn hoặc lỗi cần tạo mới.
- [ ] Dùng lại xử lý session/role, chờ logout và xóa cache của `AuthContext`; không gửi `rememberMe` khi đăng nhập bằng mặt. Hiển thị đường đăng nhập lại bằng mật khẩu khi gặp thao tác nhạy cảm.
- [ ] Test camera bị từ chối, unmount/hủy, stop tracks, request trùng và đăng nhập thành công/thất bại; chạy `npm test`, `npm run lint`, `npm run build` trong `frontend`.

## 8. Kiểm tra cuối và rollback

- [ ] Kiểm thử thủ công end-to-end với nhóm đã opt-in qua LAN/VPN và HTTPS: thành công, chưa opt-in, người lạ, ảnh/video, nhiều mặt, lỗi camera, rút đồng ý, ADMIN/MANAGER và thao tác nhạy cảm.
- [ ] Chạy test liên quan của `face_auth`, backend và frontend. Kiểm tra hồi quy đăng ký/xóa mẫu, chấm công, webhook attendance và thiết bị Raspberry Pi; face login không tạo attendance và consent đăng nhập không làm thay đổi kết quả tìm mặt chấm công.
- [ ] Ghi kết quả thử và giới hạn: số người/lần, model, ngưỡng, môi trường, kết quả nhận nhầm/từ chối và các kiểu giả chưa thử. Vài người quen không đủ để khẳng định tỷ lệ lỗi hoặc khả năng bảo vệ cho production.
- [ ] Khi cần tắt: đặt `FACE_LOGIN_ENABLED=false`, restart instance và kiểm tra endpoint không cấp phiên mới. Tắt cờ không tự thu hồi phiên đã cấp; nếu cần thu hồi ngay, vô hiệu consent hoặc tăng token version theo cơ chế hiện có và kiểm tra tác động tới phiên mật khẩu.

**Mở rộng sau này:** Trước khi chạy nhiều worker/instance, cần kho challenge chung có consume nguyên tử, rate limit dùng chung và kiểm tra lại vận hành. Trước khi dùng rộng, cần đánh giá lại an ninh, chất lượng mô hình, quyền riêng tư và các nghĩa vụ pháp lý tương ứng với bối cảnh mới.
