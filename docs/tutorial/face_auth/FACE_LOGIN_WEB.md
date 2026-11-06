# Đăng nhập tài khoản bằng camera máy tính

Tại `/login`, bấm **Đăng nhập bằng khuôn mặt** để mở hộp thoại camera. Chọn **Bắt đầu nhận diện** và nhìn thẳng vào camera. Sau khi xác thực, ứng dụng mở dashboard của tài khoản nhân viên tương ứng.

Luồng này chỉ tạo cookie đăng nhập. Nó không gọi webhook ThingsBoard, không gọi check-in/check-out và không ghi `attendance_logs`.

## Bật trên môi trường thử nghiệm

Trên môi trường thử nghiệm, đăng nhập dùng cùng ngưỡng so khớp và số lần xác nhận được cấu hình cho chấm công. Chất lượng webcam và ánh sáng vẫn có thể làm kết quả thực tế khác camera Pi.

Trong `backend/.env`, đặt khóa nội bộ ngẫu nhiên ít nhất 32 ký tự và các giá trị đã chọn từ thử nghiệm:

```dotenv
FACE_LOGIN_ENABLED=true
FACE_AUTH_INTERNAL_KEY=<khoa-noi-bo-ngau-nhien-dung-chung-voi-face-auth>
FACE_MATCH_THRESHOLD=0.45
ATTENDANCE_STABLE_COUNT=2
```

Các dòng có `<...>` là chỗ điền giá trị, không sao chép nguyên văn vào `.env`. Trong `face_auth/.env`, đặt cùng `FACE_AUTH_INTERNAL_KEY` và `FACE_LOGIN_ENABLED=true`. Khởi động lại backend và Face Auth. Dùng model version ArcFace giống dữ liệu đăng ký, và cấu hình PAD/runtime đúng với model hiện có. Các khóa và ngưỡng chỉ ở server.

Với `docker-compose.yml` cục bộ, đặt `FACE_LOGIN_ENABLED` và `FACE_AUTH_INTERNAL_KEY` trong tệp biến Compose, chẳng hạn `.env.compose`; backend đọc khóa, ngưỡng so khớp và số lần xác nhận từ `backend/.env`. Hai khóa phải giống nhau. Stack cloud đọc `backend/.env` và `face_auth/.env` riêng. Hai stack mount `hardware/models` vào `/app/login-models` chỉ đọc; đặt `FACE_LOGIN_PAD_RUNTIME_CONFIG_PATH` trong biến Compose trỏ tới runtime đã được thử, ví dụ `/app/login-models/R7_SC_FULL_crop15_runtime_config.json`. Cấu hình PAD và model trên Face Auth cần khớp thiết bị Pi nếu muốn so sánh cùng điều kiện; không thay đổi runtime của thiết bị chấm công.

Chỉ chạy một tiến trình backend. Map challenge có TTL 60 giây, giới hạn 100 mục, consume trước khi xử lý bất đồng bộ và ràng buộc bằng cookie browser. Khởi động lại hủy các challenge đang chờ. Dùng HTTPS khi truy cập qua mạng, hoặc localhost khi chạy trên máy cá nhân; giới hạn proxy/firewall vào LAN/VPN, không công khai Face Auth.

## Chuẩn bị tài khoản

1. Có tài khoản EMPLOYEE đang hoạt động và mẫu CENTROID tương thích đã đăng ký. Không yêu cầu hai nhân viên để so sánh margin.
2. Khi đã đăng ký Face ID và lưu mẫu hợp lệ trong database, nhân viên dùng ngay nút đăng nhập khuôn mặt. Không có công tắc bật/tắt riêng từng tài khoản.
3. Ảnh camera không được lưu thành mẫu mới; chỉnh sửa nguồn mẫu vẫn qua chức năng đăng ký sinh trắc hiện có. Mẫu dùng để đăng nhập phải đang hoạt động và đúng phiên bản model; mẫu bị xóa/vô hiệu hóa làm phiên mặt không còn hợp lệ.

ADMIN/MANAGER bị chặn đăng nhập bằng mặt. Phiên mặt sống tối đa 30 phút, không có “Ghi nhớ”. Thay đổi trạng thái/role, xóa/vô hiệu hóa Face ID hoặc tắt cờ server làm phiên mặt không còn hợp lệ tại lần xác thực tiếp theo. Các thao tác đổi mật khẩu/hồ sơ và quản lý sinh trắc yêu cầu phiên mật khẩu. Biểu mẫu đổi mật khẩu dùng mật khẩu hiện tại để xác thực lại; khi lưu hồ sơ bằng phiên mặt, ứng dụng hiển thị ô xác nhận mật khẩu rồi thử lưu lại. Các trường profile cũ liên quan công tắc đăng nhập không còn được đọc hoặc ghi; không cần sửa dữ liệu nhân viên để bỏ giới hạn này.

## Ranh giới module

- Backend `modules/auth/face-login`: challenge, kiểm tra nguồn request, cookie và gọi dịch vụ AI; `auth.service.ts` ký/xác thực phiên và kiểm tra mẫu Face ID qua public contract của biometrics.
- Backend `modules/biometrics`: auth dùng `findBestFaceMatch` qua public contract như luồng chấm công; `face-login.repository.ts` chỉ kiểm tra mẫu đang hoạt động khi cấp/xác thực phiên.
- Frontend `features/auth`: modal, camera, API và xác thực lại bằng mật khẩu. Trang login chỉ mở modal; không có màn hình bật/tắt riêng.
- Python `face_login/http.py`: HTTP entrypoint nội bộ, giới hạn body/JPEG trước decode. `pipeline.py` dùng biểu quyết PAD, theo dõi khuôn mặt và trích vector; không tìm danh tính hoặc cấp session.

## Kiểm thử và giới hạn

```powershell
Push-Location backend
npm.cmd test -- validation/auth/face-login.test.ts validation/auth/face-login-session.test.ts validation/auth/face-login-routes.test.ts
npm.cmd run build
Pop-Location
Push-Location frontend
npm.cmd test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx
npm.cmd run lint
npm.cmd run build
Pop-Location
Push-Location face_auth
..\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_face_login*.py' -v
Pop-Location
```

Test tự động kiểm tra challenge/cookie, phiên 30 phút, Face ID bị xóa/vô hiệu hóa, role, ảnh quá lớn, PAD/biến đổi lỗi và luồng không ghi attendance. Các phép thử dùng model giả lập hoặc dữ liệu tổng hợp; chưa chứng minh độ chính xác trên webcam thật. Hướng dẫn spike và cách thử các kiểu ảnh/video nằm tại [báo cáo spike](../../experiments/face-login-spike-report.md).

Không còn yêu cầu quay mặt theo hướng ngẫu nhiên. Mã yêu cầu dùng một lần chỉ hạn chế tái gửi cùng giao dịch; camera trình duyệt và PAD không bảo đảm chống mọi dạng video/deepfake. Đối chiếu ngưỡng giống chấm công giúp hành vi dễ dùng hơn nhưng có thể tăng nguy cơ nhận nhầm so với ngưỡng đăng nhập trước đó.

## Bằng chứng kiểm tra trong phiên triển khai

- Backend: 15 test riêng của login khuôn mặt qua; thêm 2 test socket refresh qua; TypeScript build qua. Test xác nhận mẫu Face ID hiện hữu không cần công tắc profile và mẫu bị xóa làm phiên mặt không còn hợp lệ.
- Frontend: 7 test camera/modal/xác thực lại qua, thêm test hồi quy logout/login và cô lập session qua; lint và production build qua.
- Python: 25 test của feature và spike qua. Smoke import theo bố cục source Docker qua, không chạy startup/DB/camera.
- Full backend suite: 400 pass, 73 skip và 3 failure tại `architecture/model-ownership`, một fixture trong `auth/revocation-and-session` thiếu `employee.updateMany`, và `devices/webhook-validation`. Các đường gọi của feature mới giữ ownership auth/biometrics qua public contract; không sửa những phần ngoài phạm vi để làm suite xanh.
- Full frontend suite: 141 pass và 1 failure tại `attendance/manager-dashboard-arrivals` do thiếu QueryClient trong fixture.
- Full Python suite: 116 tests, còn 2 failure và 13 errors; một test runtime thất bại trong toàn bộ suite nhưng chạy riêng thì qua, các lỗi còn lại liên quan đến model cũ/torch/matplotlib/NamedTemporaryFile và dấu phân cách đường dẫn Windows.
- Đã kiểm tra backend `enabled: true`, Face Auth health `ready` với database đang dùng và lượt ảnh tổng hợp không mặt bị từ chối. Chưa kiểm tra nhận diện người thật qua camera. Kiểm tra trình duyệt headless không hoàn thành do GPU sandbox của môi trường; test React/jsdom không thay thế kiểm tra hình ảnh trên trình duyệt thực tế.
- Chưa build/chạy container: Docker daemon không hoạt động. Compose cloud còn bị chặn bởi cú pháp tệp `backend/.env` hiện hữu (dòng 51); không chỉnh nội dung riêng của người vận hành. Runtime/model cần cấu hình trước khi bật.

Log kiểm thử cục bộ nằm trong `.local/face-login-pi-parity-*-tests.log`; không có ảnh/vector người thật. Cấu hình mặc định của dự án vẫn tắt tính năng, nhưng môi trường cục bộ hiện tại đã được bật.
