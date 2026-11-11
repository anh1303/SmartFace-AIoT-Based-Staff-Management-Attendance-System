# Đăng nhập bằng khuôn mặt tự nhận diện — kế hoạch triển khai

> **Đã thay thế:** Xem kế hoạch sửa đổi [2026-11-05-face-login-v2.md](2026-11-05-face-login-v2.md). Các quyết định và hợp đồng trong bản v2 được ưu tiên.

**Mục tiêu:** Người dùng đã đăng ký sinh trắc chọn đăng nhập bằng camera máy tính; hệ thống xác định nhân viên và cấp phiên hiện có sau khi các kiểm tra phía máy chủ thành công.

**Kiến trúc:** React chụp một chuỗi khung hình ngắn, gửi Node backend; backend gọi FastAPI nội bộ để phát hiện, kiểm tra PAD và trích xuất vector. Backend so khớp 1:N với centroid hợp lệ trong pgvector, kiểm tra tài khoản và cấp cookie hiện có. Tính năng mặc định tắt cho đến khi hoàn tất đánh giá thực tế.

**Công nghệ:** React/Vite, Express/TypeScript, FastAPI/OpenCV/ONNX Runtime, PostgreSQL/pgvector, JWT cookie. Không cần ThingsBoard hay thiết bị Raspberry Pi.

**Phạm vi thiết kế đã chọn:** Tự nhận diện không nhập tên; dùng dữ liệu đăng ký hiện có; giữ đăng nhập mật khẩu. Các tham số số học bên dưới là giới hạn thử nghiệm hoặc cấu hình khởi đầu, không phải ngưỡng bảo mật đã chứng minh.

## Thực trạng và ràng buộc

- `frontend/src/pages/public/LoginPage.tsx`, `frontend/src/features/auth/api/authApi.ts` và `frontend/src/context/AuthContext.tsx` xử lý đăng nhập hiện tại. Context có xử lý đồng bộ logout, xóa cache và đồng bộ session; đăng nhập mới phải dùng cùng cơ chế.
- `backend/src/modules/auth/auth.service.ts` kiểm tra `is_active`, trạng thái nhân viên và tạo JWT; `auth.controller.ts` đặt cookie HttpOnly. Phải chia sẻ các kiểm tra/cấp phiên thay vì tạo phiên theo đường riêng.
- `backend/src/modules/biometrics/biometric.service.ts` có `findBestFaceMatch`, chỉ xét CENTROID đang hoạt động, phiên bản model hiện tại và nhân viên hoạt động. Hàm hiện trả một ứng viên; cần đánh giá việc bổ sung ứng viên thứ hai và ngưỡng riêng cho đăng nhập.
- `face_auth/api_service.py` có detector, embedder, endpoint đăng ký và `/internal/face-embedding`. Endpoint cuối chỉ nhận mặt đã căn chỉnh, không chạy PAD hay tìm danh tính. `face_auth/antispoof/predictor.py`, `vision_pipeline.py` và tracking chứa các khối PAD hiện có; API chưa khởi tạo PAD cho đăng nhập.
- Không dùng webhook chấm công cho đăng nhập: webhook nhận điểm PAD và vector từ thiết bị, trong khi trình duyệt là nguồn không đáng tin. Đăng nhập không tạo bản ghi chấm công.
- Tính năng xử lý dữ liệu sinh trắc nhạy cảm: giới hạn quyền, mục đích, thời gian lưu và kiểm soát truy cập theo chính sách của đơn vị. Không đưa ảnh/vector/token vào log, analytics hoặc phản hồi trình duyệt.

## Hợp đồng dự kiến

1. `POST /api/auth/face-login`: JSON `{ frames: string[], rememberMe?: boolean }`, mỗi chuỗi là base64 JPEG không kèm data URI. Giới hạn thí điểm 3–5 ảnh, tối đa 200 KiB mỗi ảnh sau giải mã, tổng body tối đa 1,5 MiB; dùng parser riêng hoặc kiểm tra kích thước trước xử lý, vì parser toàn cục hiện cho phép 20 MB. Chỉ chấp nhận đúng trường khai báo. Bổ sung giới hạn kết nối tại proxy để từ chối body lớn trước parser toàn cục.
2. Backend gửi `POST /internal/face-login/extract` tới Face Auth cùng khóa nội bộ `X-Face-Auth-Key`, request ID và ảnh. API nội bộ trả kết quả có cấu trúc `{ request_id, status, model_version, embedding }` với status `ok`, `invalid_capture` hoặc `rejected`; embedding chỉ xuất hiện khi `ok`. Các lỗi bận/không sẵn sàng trả 429/503. Đây là hợp đồng mới, không thay đổi endpoint extraction thiết bị.
3. Backend xác thực phiên bản model, vector gồm 512 số hữu hạn và norm hợp lệ, chuẩn hóa trước so khớp; không chấp nhận điểm hoặc danh tính từ frontend. Khi thành công, trả cùng hình dạng `{ user }` và đặt cùng cookie như `/login`. Kết quả từ chối danh tính trả thông báo chung; lỗi cấp quyền camera và lỗi dịch vụ được thông báo phù hợp mà không tiết lộ tài khoản nào tồn tại.

**Giới hạn quan trọng:** Chuỗi ảnh do trình duyệt gửi có thể bị phát lại, chỉnh sửa hoặc thay bằng camera ảo. PAD nhiều ảnh không chứng minh nguồn camera đáng tin hoặc tính mới của dữ liệu. Không tuyên bố chống replay; chỉ bật cho môi trường thật khi đánh giá rủi ro chấp nhận được. Nếu cần bảo đảm mạnh hơn, thiết kế xác thực bổ sung như passkey hoặc yếu tố thứ hai và đánh giá riêng.

## Điều kiện trước khi phát hành

- Chốt chính sách xác thực: tài khoản đặc quyền có được đăng nhập chỉ bằng khuôn mặt hay bắt buộc yếu tố khác; mặc định đề xuất không bật cho ADMIN/MANAGER đến khi có quyết định.
- Thu thập dữ liệu đánh giá có sự đồng ý, tách người và phiên thu giữa tập hiệu chỉnh và tập đánh giá; bao gồm webcam, ánh sáng, người chưa đăng ký và ảnh/video giả mạo.
- Chủ hệ thống phê duyệt mục tiêu sai chấp nhận 1:N, tỷ lệ từ chối, phạm vi người dùng và rủi ro camera ảo/replay. Không lấy ngưỡng từ chấm công làm ngưỡng đăng nhập. Không đặt ngưỡng sản xuất nếu chưa có bằng chứng; thiếu dữ liệu thì giữ cờ tính năng tắt.
- Mẫu phải tương thích phiên bản ArcFace đang chạy. Nếu không tương thích, yêu cầu đăng ký lại theo quy trình quản trị hiện có, không âm thầm so sánh vector khác phiên bản.

## Công việc 1 — Khảo sát và khóa hợp đồng

**Tệp:** `face_auth/config.py`, `face_auth/antispoof/`, `face_auth/tracking/`, `backend/src/modules/biometrics/biometric.service.ts`, `backend/prisma/schema.prisma`, `docker-compose.yml`.

- [ ] Kiểm tra model ArcFace thực tế, kích thước/vector, định dạng ảnh đăng ký, cấu hình crop/PAD, model và runtime JSON sẵn có trong image `face-auth`; ghi model version và hash vào báo cáo đánh giá, không log dữ liệu người dùng.
- [ ] Kiểm tra liên kết `Employee.user_id`, điều kiện nhân viên hoạt động và mẫu CENTROID; thống kê tổng hợp số mẫu tương thích và trường hợp không đủ điều kiện, không xuất vector.
- [ ] Đo thời gian tải và inference PAD trên cấu hình triển khai; xác nhận Docker có model và dependencies. Nếu PAD không hoạt động, API phải trả 503, không bỏ qua PAD.
- [ ] Chốt giới hạn ảnh, số khung, timeout và dung lượng ở proxy, Node và Python; xác nhận cấu hình thực tế qua thử nghiệm request lớn. Mốc trên dùng thử nghiệm, điều chỉnh dựa trên đo đạc.

**Hoàn thành khi:** Có bảng tương thích và cấu hình được ghi trong tài liệu vận hành, xác định chính xác model/runtime sử dụng; hợp đồng trên có thể chạy end-to-end.

## Công việc 2 — Xử lý ảnh và PAD phía Face Auth

**Tệp dự kiến:** sửa `face_auth/api_service.py`; tạo `face_auth/face_login.py`; thêm `face_auth/tests/test_face_login.py`.

- [ ] Viết test API với detector, PAD và embedder giả lập: khóa nội bộ sai, model chưa sẵn sàng, body sai, base64 sai, ảnh không giải mã, ảnh quá lớn hoặc số ảnh ngoài giới hạn đều bị từ chối; không trả vector.
- [ ] Viết test mỗi khung hình phải có đúng một khuôn mặt hợp lệ; không mặt, nhiều mặt, mặt quá nhỏ/cắt cạnh hoặc thiếu landmark làm thất bại phiên. Kiểm tra số pixel trước inference để tránh ảnh nén gây cạn bộ nhớ.
- [ ] Viết test PAD: verdict giả, chưa đủ dữ liệu, NaN, lỗi inference hoặc timeout đều từ chối; nhiều khung phải thuộc cùng một khuôn mặt theo tracking nhất quán, thay đổi đối tượng phải từ chối. Không chọn khuôn mặt lớn nhất khi có nhiều người.
- [ ] Tải `AntiSpoofPredictor` một lần tại startup; kiểm tra readiness và bảo vệ giới hạn đồng thời bằng semaphore. Tái sử dụng preprocessing/runtime hiện tại đúng crop, thứ tự màu và ngưỡng logit; không nhầm logit với xác suất. Lựa chọn quy tắc bỏ phiếu sau khi đo thực nghiệm, mặc định không chấp nhận verdict thiếu.
- [ ] Với các khung hợp lệ, căn chỉnh và trích xuất vector bằng embedder hiện tại; kiểm tra chất lượng và tính nhất quán danh tính giữa khung trước khi tổng hợp vector. Kiểm tra số chiều, hữu hạn, norm và trả model version; không ghi ảnh lên đĩa hay log.
- [ ] Thêm endpoint nội bộ có `require_internal_key`, Pydantic strict, giới hạn body tại ASGI/proxy, thời gian xử lý và cơ chế release semaphore ngay cả khi có lỗi. Bảo vệ đường mạng nội bộ; không công khai endpoint ra internet.
- [ ] Chạy `cd face_auth; python -m pytest tests/test_face_login.py -q` và các test PAD/runtime liên quan. Dùng fixture giả lập, không commit ảnh sinh trắc thật.

**Hoàn thành khi:** Endpoint chỉ trả vector cho phiên hợp lệ; mọi lỗi AI fail closed và test xác nhận không có vector trong phản hồi lỗi.

## Công việc 3 — So khớp 1:N và cấp phiên

**Tệp dự kiến:** `backend/src/modules/auth/auth.routes.ts`, `auth.controller.ts`, `auth.dto.ts`, `auth.service.ts`, `backend/src/modules/biometrics/biometric.service.ts`, `public.ts`, `backend/src/config/env.ts`; test tương ứng trong `backend/validation` theo cấu trúc hiện có.

- [ ] Viết test endpoint: JSON sai, quá nhiều ảnh, quá dung lượng, vượt rate limit và phản hồi AI sai/timeout đều không cấp cookie; không chấp nhận trường embedding, employee ID hoặc PAD score từ client.
- [ ] Thêm cờ `FACE_LOGIN_ENABLED` mặc định false, timeout, giới hạn đồng thời và cấu hình ngưỡng đăng nhập riêng. Validate cấu hình khi bật: giá trị hữu hạn, model version đúng, khóa nội bộ đủ mạnh; ngưỡng chưa được phê duyệt thì không bật.
- [ ] Tạo client Face Auth chỉ ở backend, có timeout, giới hạn response và xác thực nội bộ; kiểm tra request ID, status, version và vector trước khi dùng. Mọi lỗi mạng, timeout, model mismatch và kết quả không hợp lệ đều fail closed.
- [ ] Mở rộng hợp đồng biometrics để lấy tối đa hai **nhân viên khác nhau** từ centroid đang hoạt động, đúng model version và nhân viên ACTIVE; tính cosine similarity trên vector đã kiểm tra. Chỉ chấp nhận ứng viên đầu khi đạt ngưỡng 1:N đã hiệu chỉnh; nếu dùng khoảng cách với ứng viên thứ hai, hiệu chỉnh và xác định hành vi một ứng viên một cách rõ ràng, không tự đặt ngưỡng tùy ý.
- [ ] Viết test có danh sách rỗng, mẫu vô hiệu/sai version, điểm sát ngưỡng, hai người gần nhau, vector NaN/norm 0, nhân viên bị ngưng và trường hợp chỉ có một ứng viên. Kiểm tra không lộ tên hoặc similarity khi thất bại.
- [ ] Từ employee ID tìm tài khoản liên kết; kiểm tra lại tài khoản, nhân viên và quyền tại thời điểm cấp phiên. Trích xuất logic kiểm tra và tạo session dùng chung với mật khẩu; giữ JWT token version, cookie flags và `rememberMe`. Đảm bảo không cấp phiên nếu employee không có user hoặc thay đổi trạng thái giữa lúc so khớp và cấp phiên.
- [ ] Áp dụng rate limit theo IP cùng giới hạn tải toàn hệ thống và chính sách proxy đáng tin; tránh khóa tài khoản tùy ý vì 1:N chưa biết người dùng. Kiểm tra CORS/Origin và CSRF cho endpoint tạo cookie, dùng HTTPS và cookie hiện hành; thử request chéo nguồn.
- [ ] Ghi audit tối thiểu: thời gian, request ID, kết quả tổng quát; chỉ ghi user ID sau khi xác định hợp lệ theo chính sách. Không lưu ảnh, vector, khóa, cookie hoặc điểm chi tiết. Kiểm tra log HTTP/error hiện có không ghi request body.
- [ ] Chạy test Vitest mục tiêu, `npm test` và `npm run build` trong `backend`; test tích hợp phải khẳng định cookie và `/api/auth/me` hoạt động và endpoint không tạo attendance.

**Hoàn thành khi:** Face login dùng chính sách tài khoản và phiên giống mật khẩu, không có cookie trong mọi nhánh thất bại và tìm kiếm chỉ xét dữ liệu hợp lệ.

## Công việc 4 — Giao diện camera và quản lý session

**Tệp dự kiến:** `frontend/src/pages/public/LoginPage.tsx`, `frontend/src/features/auth/api/authApi.ts`, `frontend/src/context/AuthContext.tsx`, component camera mới trong `frontend/src/features/auth/components/`; kiểm thử frontend tương ứng.

- [ ] Thêm nút mở quy trình khi cờ tính năng công khai cho frontend được bật; chỉ gọi `getUserMedia` sau thao tác của người dùng. Hiển thị mục đích camera và trạng thái cấp quyền, chuẩn bị, đang xử lý, thành công, thất bại.
- [ ] Chụp 3–5 JPEG liên tiếp trong giới hạn hợp đồng; không dùng timestamp từ client làm bằng chứng chống replay. Gửi duy nhất khi chụp xong, không gửi luồng video liên tục; vô hiệu nút gửi lặp và hỗ trợ hủy.
- [ ] Dừng mọi `MediaStreamTrack` khi hủy, thành công, lỗi, component unmount hoặc người dùng rời trang; hủy request khi cần. Không lưu ảnh vào localStorage/sessionStorage hoặc log.
- [ ] Thêm hàm API dùng cùng chuẩn `apiFetch`; tái sử dụng chuyển đổi user/role và xử lý hoàn tất phiên của AuthContext, bao gồm chờ logout đang chạy, xóa cache/thông báo và điều hướng như đăng nhập hiện tại. Kiểm tra race giữa logout và face login.
- [ ] Thông báo rõ các lỗi camera không có/không được phép, quá nhiều mặt, không thể xác thực và dịch vụ tạm gián đoạn; cho thử lại hoặc đăng nhập mật khẩu. Thông báo phù hợp bàn phím và trình đọc màn hình.
- [ ] Test mock `getUserMedia`, track stop, từ chối quyền, hủy/unmount, gửi lặp, thành công, thất bại và session role. Chạy `npm test`, `npm run lint`, `npm run build` trong `frontend`.

**Hoàn thành khi:** Từ trang login, người dùng có thể mở/hủy camera, đăng nhập thành công và vào đúng màn hình theo vai trò; camera luôn được giải phóng.

## Công việc 5 — Hiệu chỉnh, kiểm thử hệ thống và triển khai

- [ ] Xây dựng bộ đánh giá có đồng ý và phân tách tập hiệu chỉnh/kiểm thử độc lập theo người và phiên; ghi số người, số lần thử, loại camera, ánh sáng, mẫu giả, các trường hợp không có mẫu và điều kiện thu. Không commit dữ liệu sinh trắc thật.
- [ ] Đo riêng PAD, nhận diện 1:N và toàn bộ luồng; báo cáo false accept/false reject theo số lần thử, khoảng tin cậy và phân nhóm có đủ dữ liệu. Kiểm tra khả năng giả mạo bằng ảnh in, màn hình, video, replay request và camera ảo; ghi giới hạn của phép thử. Số lần thử không đủ để chứng minh mục tiêu thì không tuyên bố đạt.
- [ ] Chọn ngưỡng bằng tập hiệu chỉnh, khóa cấu hình rồi đánh giá trên tập độc lập; ghi phiên bản model, ngưỡng, dữ liệu và kết quả. Đánh giá lại khi model, số lượng nhân viên hoặc môi trường camera thay đổi đáng kể.
- [ ] Kiểm thử trên trình duyệt desktop được hỗ trợ, HTTPS, nhiều camera, ánh sáng yếu, mất mạng, dịch vụ AI dừng/bận, nhiều yêu cầu đồng thời và người dùng đổi trạng thái khi đăng nhập. Kiểm tra độ trễ và giới hạn tài nguyên thực tế.
- [ ] Tài liệu vận hành: biến cấu hình, phân phối khóa, TLS/proxy, kích thước body, readiness, lưu giữ và xóa dữ liệu, cách đăng ký lại mẫu, giám sát tổng hợp, hướng dẫn hỗ trợ và cách tắt cờ. Bật thử nghiệm cho nhóm nhỏ sau khi chủ hệ thống phê duyệt tiêu chí.
- [ ] Rollback: tắt `FACE_LOGIN_ENABLED` ở backend và ẩn nút frontend, kiểm tra API không cấp phiên mới; phiên mật khẩu vẫn dùng được. Nếu sự cố liên quan phiên đã cấp, áp dụng thu hồi theo cơ chế token version hiện có và quy trình vận hành.

**Hoàn thành khi:** Các kiểm thử tự động và thực tế đạt tiêu chí được duyệt; có báo cáo hiệu chỉnh, người chịu trách nhiệm chấp nhận rủi ro và hướng dẫn rollback.

## Thứ tự thực hiện và điểm quyết định

1. Công việc 1 → 2 → 3 → 4 → 5; các test được viết trước logic của từng công việc.
2. Không đưa ra cam kết an toàn sinh trắc hoặc thời gian hoàn thành dựa trên tài liệu này: kết quả phụ thuộc chất lượng mẫu, camera và năng lực PAD đã đo.
3. Trước khi bật thực tế cần quyết định quyền ADMIN/MANAGER, tiêu chí sai chấp nhận/từ chối và phương án khi rủi ro replay không được chấp nhận. Những quyết định này không cản trở phát triển và thử nghiệm với cờ tắt.
