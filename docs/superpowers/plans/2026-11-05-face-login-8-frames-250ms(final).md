# Kế hoạch tối ưu đăng nhập khuôn mặt web: 8 frame, 250 ms

> **Khi triển khai:** Sử dụng `superpowers:executing-plans`. Các mục chưa đánh dấu là công việc chưa thực hiện. Bản này thay thế kế hoạch `2026-11-05-face-login-optimization-practical.md` cho phạm vi yêu cầu hiện tại.

**Mục tiêu:** Giữ 8 frame mỗi lần đăng nhập, giảm thời gian chờ chụp từ 350 ms xuống 250 ms trước mỗi frame và đo hiệu quả thực tế cùng ảnh hưởng đến nhận diện, PAD và trải nghiệm.

**Công nghệ:** React/Vite, Express/TypeScript, FastAPI/Python, ONNX Runtime và PostgreSQL/pgvector. Áp dụng cho đăng nhập webcam trên web; điểm danh bằng thiết bị Pi là luồng riêng.

## 1. Phạm vi và những gì đã xác nhận

- [x] Frontend hiện đợi 350 ms trước mỗi lần trong 8 lần chụp và gửi một batch. Tổng thời gian chờ danh nghĩa là 2,8 giây, chưa gồm vẽ canvas, mã hóa, mạng và xử lý.
- [x] Camera có thêm 800 ms chờ sau `video.play()` trước khi cho phép bắt đầu quét; khoảng này xảy ra trước khi người dùng bấm quét và được đo riêng.
- [x] Đăng ký và đăng nhập dùng căn chỉnh 5 landmark; khung oval là hướng dẫn trực quan. Giữ model, căn chỉnh, ngưỡng, PAD, rolling window, reset embedding và so khớp từng embedding.
- [x] Backend, Python HTTP và pipeline đều yêu cầu đúng 8 frame. Challenge/cookie và giới hạn request là một phần của luồng hiện tại.
- [ ] Chưa đo baseline, chưa sửa lịch chụp và chưa đo hiệu quả trên camera thực tế.

**Lịch chụp cần thực hiện:** chờ 250 ms, chụp frame 1; lặp lại tương tự cho đến frame 8. Có **8 lần chờ × 250 ms = 2 giây chờ danh nghĩa**. Tổng thời gian thực từ bắt đầu quét đến khi đăng nhập thành công sẽ lớn hơn do cần chụp/mã hóa, truyền ảnh, suy luận và tạo phiên. Thời gian giữa hai lần chụp cũng bao gồm chi phí xử lý frame.

**Ngoài phạm vi hiện tại:** giảm số frame, early exit, bỏ căn chỉnh 5 landmark, đổi model, đổi precision hoặc threshold. Nếu sau này nghiên cứu xử lý gối đầu, vẫn phải thu và xử lý đủ 8 frame; đây là đề xuất riêng, không phải điều kiện hoàn thành thay đổi 250 ms.

## 2. Nguyên tắc đánh giá

- Ghi thời gian từ mở modal đến camera sẵn sàng và từ bấm quét đến kết quả; báo p50/p95 nếu có đủ phép đo và ghi cỡ dữ liệu thực tế. Không áp đặt mục tiêu p50 cụ thể.
- So sánh trước/sau: tỷ lệ đăng nhập đúng, số lần thử lại, nhận nhầm danh tính và kết quả PAD ở cấp phiên. Kiểm tra các trường hợp dữ liệu hiện có cho phép; không quy định số người tham gia.
- Báo rõ dữ liệu và loại trường hợp đã thử, số kết quả quan sát được và các giới hạn. Không thấy lỗi trên tập thử hữu hạn không chứng minh FAR hoặc tỷ lệ tấn công lọt không tăng.
- Không điều chỉnh threshold để làm đẹp kết quả. Không dùng tập test chính thức để chọn cấu hình.
- Chỉ sử dụng dữ liệu sinh trắc học được phép; không log ảnh, embedding, cookie, token hoặc secret. Không ghi đè các thay đổi hiện có trong workspace.

## 3. Các tệp liên quan

| Công việc | Tệp |
|---|---|
| Lịch chụp | `frontend/src/features/auth/components/FaceLoginModal.tsx` |
| Chụp và camera | `frontend/src/features/auth/lib/faceCamera.ts` |
| Test camera và modal | `frontend/validation/auth/face-login-camera.test.ts`, `frontend/validation/auth/face-login-modal.test.tsx` |
| API, challenge, so khớp | `backend/src/modules/auth/face-login/face-login.routes.ts`, `face-login.service.ts`, `face-login.policy.ts` |
| Xử lý ảnh và PAD | `face_auth/face_login/http.py`, `face_auth/face_login/pipeline.py` |
| Test backend và Python | `backend/validation/auth/face-login*.test.ts`, `face_auth/tests/test_face_login_http.py`, `test_face_login_parity.py` |

## 4. Giai đoạn 0 — Đo baseline gọn

- [ ] Ghi lại trạng thái workspace, cấu hình thực tế và phiên bản/hash model, camera, máy, mạng và trình duyệt; không ghi secret.
- [ ] Đo thời gian camera sẵn sàng, tổng thời gian vòng chụp, thời gian từng frame, kích thước body, thời gian request từ frontend, RPC Python và tổng thời gian so khớp pgvector.
- [ ] Đo riêng cold start và warm start; ghi tỷ lệ thành công, lỗi, số lần retry và các chỉ số PAD/nhận nhầm có thể kiểm tra bằng dữ liệu sẵn có.
- [ ] Nếu cần instrumentation, dùng đồng hồ đơn điệu và ID ngẫu nhiên; test bật/tắt instrumentation không làm đổi kết quả. Không cộng các khoảng đo lồng nhau hoặc gọi toàn bộ request là upload time.
- [ ] Ghi kết quả baseline và giới hạn đo trong báo cáo ẩn danh tại `docs/experiments/`; nếu chưa có camera hoặc model, ghi rõ chưa đo.

## 5. Giai đoạn 1 — Đổi lịch chụp thành 250 ms

**Phạm vi thay đổi:** `FaceLoginModal.tsx` và test modal liên quan; giữ nguyên cấu trúc vòng lặp, chụp đủ 8 frame và gửi đúng một batch.

- [ ] Viết test fake timers xác nhận: trước 250 ms chưa chụp; sau mỗi 250 ms chụp thêm một frame; sau 8 lần chờ có đúng 8 frame theo thứ tự và chỉ một request xác thực.
- [ ] Kiểm tra test thất bại với giá trị cũ 350 ms; thay `cameraDelay(350, signal)` thành `cameraDelay(250, signal)` trong vòng lặp chụp.
- [ ] Chỉ đổi đúng một dòng cameraDelay(350, signal); nếu FaceLoginModal.tsx còn chỗ khác dùng 350 (hằng số, test, tài liệu), tìm hết rồi đổi đồng bộ.
- [ ] Test hủy/đóng modal, camera không còn sẵn sàng, challenge hết hạn và request thất bại: không gửi batch thiếu ảnh và không tiếp tục sử dụng camera sau cleanup.
- [ ] Chạy test frontend liên quan; so sánh trên cùng điều kiện trước/sau, báo thời gian thực, số lần thử lại và các kết quả nhận diện/PAD hiện có. Không thay JPEG, độ phân giải hoặc warm-up trong cùng phép so sánh.
- [ ] Nếu phát hiện hồi quy sinh trắc học hoặc lỗi camera, điều tra và báo kết quả trước khi kết luận thay đổi phù hợp.

## 6. Giai đoạn 2 — Tối ưu có điều kiện

Thực hiện từng mục nếu baseline hoặc số đo sau Giai đoạn 1 cho thấy đó là nút thắt; mỗi mục được đo và kiểm thử riêng.

### Warm-up model

- [ ] Nếu request đầu chậm vì khởi tạo predictor, thử khởi tạo/warm-up khi service sẵn sàng, dùng dữ liệu tổng hợp hoặc được phép; không tạo phiên hay ghi DB.
- [ ] Kiểm thử model thiếu, tính năng tắt, thời gian cold/warm và kết quả parity trên cùng đầu vào. Không che lỗi khởi tạo.

### Camera sẵn sàng

- [ ] Nếu 800 ms ảnh hưởng đáng kể, thử chờ video có frame và kích thước hợp lệ, có timeout/hủy. Video sẵn sàng không tự chứng minh phơi sáng đã ổn định; so sánh chất lượng và tỷ lệ lỗi trên camera thực tế.
- [ ] Không tự mở camera khi người dùng chỉ vào trang đăng nhập; dừng track khi modal đóng hoặc hủy.

### Kích thước và chất lượng JPEG

- [ ] Nếu ảnh hưởng của upload hoặc inference đáng kể, thử riêng cạnh dài 720 → 640 → 480 px và JPEG 0,85 → 0,80; giữ tỷ lệ ảnh và đúng 8 frame.
- [ ] So sánh lỗi detector, nhận diện và PAD trên dữ liệu hiện có; ảnh toàn cảnh nhỏ hơn không đảm bảo khuôn mặt đủ chi tiết dù ArcFace nhận crop 112×112. Ghi giới hạn của dữ liệu thử.

### Giai đoạn 0 → Giai đoạn 1 → xem số đo → mới quyết định Giai đoạn 2

### ONNX và multipart

- [ ] Chỉ thử ONNX thread/session options nếu Python/inference là nút thắt; giữ model, provider, preprocessing và precision; so sánh hiệu năng và kết quả gần ngưỡng.
- [ ] Chỉ thử multipart nếu upload đáng kể; kiểm tra cùng byte JPEG ở hai đường truyền, thứ tự ảnh, giới hạn body/file, JPEG hợp lệ, xử lý lỗi và challenge/cookie. Ghi rõ chặng Node → Python còn dùng Base64 hay không.

## 7. Kiểm thử và bàn giao

- [ ] Chạy `npm --prefix frontend test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx`, `npm --prefix frontend run lint` và `npm --prefix frontend run build`.
- [ ] Nếu có thay đổi backend, chạy `npm --prefix backend test -- validation/auth/face-login.test.ts validation/auth/face-login-routes.test.ts validation/auth/face-login-session.test.ts` và `npm --prefix backend run build`.
- [ ] Nếu có thay đổi Python, từ thư mục `face_auth` chạy `../.venv/Scripts/python.exe -m unittest tests.test_face_login_http tests.test_face_login_parity`, điều chỉnh đường dẫn Python cho môi trường thực tế.
- [ ] Báo cáo những thay đổi đã làm, kết quả test, thời gian trước/sau, kết quả nhận diện/PAD và các giới hạn còn lại. Không tự triển khai production hoặc thay dữ liệu đăng ký.
