# SmartFace — tích hợp UI, hồ sơ và ca tùy chỉnh

**Cập nhật 30/10/2026:** môi trường test PostgreSQL bằng Docker được gỡ; các test mới dùng database tạm trên Neon testing qua `npm run test:neon`. Phần bên dưới ghi lại môi trường tại ngày kiểm chứng ban đầu.

Ngày kiểm chứng: 28/10/2026.

## Phạm vi

Áp dụng frontend theo phương án 1 vào source PBL6 hiện hữu: shell/điều hướng, dashboard, nhãn vào/ra, bảng lương/phụ cấp, duyệt OT/phạt theo ngày, thiết bị, landing/bảng giá/form đăng ký, chính sách tự nhiên, hồ sơ tài khoản và danh mục ca tùy chỉnh. Giữ stack, cookie auth, các route cũ, phân quyền backend, công thức công/lương và runtime Face Auth.

Nhánh tích hợp: `feat/enterprise-ui-profile-custom-shifts`. Nhánh nhận thay đổi: `feat/attendance-daily-adjustments`. Base: `dada806b68aecfd1edf98c2d34240e095448d0cd`.

## Migration và dữ liệu

Hai migration bổ sung đã được thử trên PostgreSQL tách biệt và áp dụng thành công lên database Neon được backend/.env và container đang chạy cùng sử dụng:

- `20261028060000_account_profile`: thêm users.profile JSONB và solution_inquiries.
- `20261028070000_shift_templates`: tạo danh mục mẫu ca, gồm kiểm tra giờ hợp lệ trong cùng ngày.

Prisma báo schema up to date với 10 migration. Không chạy seed/reset trên Neon. Số bản ghi users, employees, attendance_logs, employee_shifts, payroll_records và face_embeddings đối chiếu trước/sau đều không đổi; hai bảng mới ban đầu rỗng.

Bản backup custom-format PostgreSQL 18 đã tạo trước migration, kiểm tra archive và SHA256; lưu ngoài repository trong thư mục riêng quyền 700, file quyền 600. Không commit backup hoặc thông tin đăng nhập vào Git.

## Kiểm chứng trước merge

- Frontend TypeScript, production build và 35/35 tests đạt.
- Backend TypeScript build và 134/134 tests đạt, không bỏ qua DB/socket tests.
- Database test tạm là policy_check tại cổng loopback 55439, dùng pgvector/pg16. Chạy toàn bộ migration trên database sạch trước suite. Không dùng Neon để chạy fixture hoặc kiểm thử ghi dữ liệu.
- Sáu HTTP integration tests mới kiểm tra cookie auth thật, self-profile và hồ sơ công tác độc lập, avatar/cookie, đổi mật khẩu và cookie logout, yêu cầu tư vấn công khai, role của mẫu ca, trùng tên/giờ không hợp lệ và phân ca OTHER.
- Phát hiện và sửa lỗi ảnh đại diện có thể làm JWT/cookie quá lớn: ảnh được trả qua API nhưng không đưa vào token. Kiểm thử hồi quy xác nhận cookie dưới ngưỡng và API vẫn trả đúng ảnh.
- Lượt chạy lại trên database test cũ từng đụng vector fixture giống nhau. Đã chạy toàn bộ suite trên database tạm mới và đạt 134/134; không sửa logic nhận diện để né bài kiểm tra.
- Backend/frontend Docker image build thành công; hai container thay thế đều khỏe. Không recreate Face Auth, MQTT, ThingsBoard hoặc MediaMTX.
- HTTP /, /login, /policies và hai ảnh marketing trả 200; backend /health trả 200; API profile/templates không đăng nhập trả 401 đúng kỳ vọng.
- Browser bản Docker tại http://127.0.0.1:8080: landing mới render đúng, ảnh tải xong, không có chế độ demo, không có console error. Các thao tác ghi mới đã kiểm tra bằng HTTP/database cô lập, không tạo hồ sơ, lead hoặc ca giả trên Neon.

## Cách dùng và giới hạn

“Tạo ca tùy chỉnh” ở Lịch làm việc lưu tên/giờ/ghi chú. Khi chọn mẫu trong phân ca từng ngày hoặc hàng loạt, giờ và tên/ghi chú được sao chép vào hợp đồng OTHER hiện hữu; không đổi ca đã phân trước đó. Mẫu hiện hỗ trợ ca trong cùng ngày. Kết quả hàng loạt chỉ báo số ca API thực sự lưu được và báo rõ trường hợp thành công một phần.

Hồ sơ tài khoản dùng /app/account/profile cho các vai trò. Tên hiển thị/ảnh/liên hệ cá nhân tách khỏi hồ sơ công tác và lương. Đổi mật khẩu đăng xuất cookie ở trình duyệt hiện tại; JWT ở các trình duyệt khác giữ thời hạn hiện hữu.

Form tư vấn lưu database và trả mã tiếp nhận, chưa có bước gửi email/CRM tự động. Camera/Pi không được nghiệm thu lại bằng phần cứng trong lượt tích hợp này; mã/runtime Face Auth không thay đổi.

## Vận hành và quay lại

Bản chạy thật: http://127.0.0.1:8080, backend cổng 3000. VITE_DEMO_MODE=false khi nối backend thật; production build loại adapter minh họa. Bản thử riêng cổng 5175 không phải database thật.

Giữ các tag đã build `pbl6-backend:enterprise-ui-20261028`, `pbl6-frontend:enterprise-ui-20261028`. Image trước thay đổi được giữ tại `pbl6-backend:before-enterprise-ui-20261028` và `pbl6-frontend:before-enterprise-ui-20261028`. Khi cần rollback ứng dụng, gắn các tag trước thay đổi trở lại backend:local/frontend:latest và recreate chỉ hai service bằng docker-compose.cloud.yml. Migration là bổ sung, phiên bản cũ bỏ qua các cột/bảng mới; không tự xóa bảng hoặc restore database khi rollback ứng dụng.

32 file thay đổi/chưa theo dõi ngoài phạm vi đã được băm trước khi làm việc và đối chiếu để giữ nguyên. Không push lên remote trong lượt này.
