# Trạng thái thao tác tại nút — kế hoạch và tiến độ

Phạm vi đã được người dùng đồng ý: bỏ bảng tiến trình; đưa trạng thái chờ về nút/form gốc cho mọi thao tác ghi hiện có. Giữ worker, kiểm tra quyền, khóa nghiệp vụ, chống gửi trùng và khôi phục kết quả khi mất mạng. Không thêm nghiệp vụ CRUD chưa tồn tại.

- [x] Thành phần nút/form chờ, khóa hộp thoại, giữ form và lỗi khi thất bại.
- [x] Nhân viên, phòng ban/chức vụ, tài khoản và thông báo.
- [x] Công/tăng ca, lương, chốt/mở khóa.
- [x] Face ID, vân tay và phân lịch nền: chờ kết quả thực, xử lý lỗi một phần tại chỗ.
- [x] Thiết bị, xuất file, thao tác công khai; kiểm tra những màn hình đã có pending.
- [x] Kiểm thử hồi quy, TypeScript và build; rà lại diff.

Quyết định: thực hiện trong workspace hiện tại để người dùng xem trực tiếp. Không commit/push/deploy tự động. Dữ liệu lương/chốt công/sinh trắc học chỉ hiển thị thành công khi được xác nhận. Thông báo tiến trình toàn cục bị gỡ; phần cập nhật dữ liệu qua socket vẫn giữ.

Kiểm tra cần có: chống nhấn đúp; không đóng modal khi đang ghi; lỗi giữ dữ liệu; queued/running chưa phải thành công; lỗi một phần không chạy lại ô thành công; ngắt mạng không tạo yêu cầu trùng; Pi offline không báo đã đồng bộ.

Kết quả kiểm tra ngày 2026-11-08:

- `npm.cmd test -- --maxWorkers=4`: 59 file, 189 kiểm thử thành công.
- `npm.cmd run lint`: TypeScript thành công.
- `npm.cmd run build`: bản production build thành công.
- `git diff --check`: không có lỗi khoảng trắng.
- Rà soát độc lập đã phát hiện và xác nhận sửa khóa các nút chế độ thiết bị trong toàn bộ thời gian chờ ACK, và tách mã tác vụ lưu trong trình duyệt theo tài khoản. Có kiểm thử hồi quy cho cả hai trường hợp.
- Thông báo chờ phản hồi máy chủ trước khi xóa/đánh dấu đọc, bỏ qua kết quả đến muộn sau khi đổi tài khoản.
- Lỗi lịch một phần có nút thử lại ngay tại modal; kết quả chưa xác định có nút kiểm tra lại yêu cầu gốc, không dựng lại nội dung từ dữ liệu lịch đã thay đổi.

Giới hạn xác minh: kiểm thử giao diện bằng jsdom và API/ACK mô phỏng; chưa chạy phiên trình duyệt kết nối backend thật hoặc nghiệm thu với Pi/cảm biến thật. Không thay đổi schema/database hay worker backend.

## Cập nhật nội dung và hiển thị thông báo

- Tiêu đề ngắn nêu hành động và kết quả, ví dụ “Phân công ca làm việc thành công” hoặc “Không thể phân công ca làm việc”. Mô tả chứa tên/mã nhân viên, ngày, ca, kỳ lương, nguyên nhân hoặc hướng xử lý tương ứng.
- `showToast(description, type, title)` truyền riêng hai phần sang cả toast và lịch sử thông báo, giữ tương thích với các nơi dùng API cũ.
- Mặc định chỉ hiện tiêu đề; nhấn tiêu đề mở mô tả đầy đủ và đánh dấu đã đọc; nhấn lại thu gọn. Nút xóa độc lập, không làm mở mô tả.
- Thành công: xanh lá. Thông tin/cảnh báo: xanh lam. Thao tác bị từ chối/thất bại: đỏ. Màu tiêu đề không đổi khi đã đọc.
- Lưu tên và mã nhân viên trong ngữ cảnh thao tác xóa để thông báo vẫn xác định đúng người sau khi danh sách tải lại.
- Đã kiểm tra giao diện bằng jsdom: mở/đóng chi tiết, màu từng trạng thái, xóa độc lập, truyền tiêu đề/mô tả từ toast sang lịch sử, và giữ danh tính nhân viên bị xóa. Chưa xác minh bằng phiên trình duyệt thực tế.
- Kết quả sau cập nhật: 61 file / 195 kiểm thử thành công; TypeScript, production build và `git diff --check` đạt. Bộ kiểm tra giao diện Impeccable không báo phát hiện; rà soát độc lập không có phát hiện đáng kể trong phạm vi thông báo.

### Sửa thiếu danh tính trong thông báo ảnh mẫu

- Nhánh tải file và tất cả nhánh thêm ảnh camera ghi rõ tên + mã nhân viên; phân biệt ảnh đang chuẩn bị với Face ID đã lưu thành công.
- Bổ sung `currentEmp` vào phụ thuộc callback tải ảnh, chặn kết quả FileReader đến muộn sau khi đổi nhân viên/phiên đăng nhập.
- Đưa thông báo camera ra ngoài hàm cập nhật state: kiểm thử StrictMode đã tái hiện hai thông báo cho một lần thêm ảnh trước khi sửa, sau sửa chỉ còn một.
- Khôi phục lịch sử: đổi tiêu đề chung của các mẫu thông báo cũ; các bản ghi chưa lưu danh tính ghi rõ thiếu tên/mã, không tự suy ra từ nhân viên đang chọn.
- Kiểm tra cuối: 62 file / 201 kiểm thử đạt; TypeScript, production build và kiểm tra diff đạt. Rà soát độc lập không có phát hiện đáng kể trong phần sửa này. Chưa kiểm tra bằng trình duyệt thực tế.
