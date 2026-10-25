# Thay đổi frontend — 19/10/2026

Nguồn nghiệp vụ: [COMPANY_POLICY.md](../../rule/COMPANY_POLICY.md). Backend là nơi quyết định ghép cặp và số giờ tính lương.

## Giám sát và lịch sử công

- Bỏ việc tìm một IN/một OUT trong danh sách log sắp xếp giảm dần, tự tạo đầu/đuôi thay thế và tự tính OT theo công thức riêng.
- `useAttendanceSummaries` lấy đúng khoảng ngày đang xem, trả đầy đủ kết quả backend: giờ thường, giây gốc, OT đã duyệt/đề xuất, trạng thái, lý do review và các cặp thực tế.
- `useAttendancePairs` dùng số giờ và cặp từ summary; log chỉ bổ sung phương thức/thiết bị/điểm xác thực. Không dựng điểm tin cậy 0,99/0,80 hoặc tên camera giả khi thiếu dữ liệu.
- Hiển thị OFF và ngày chưa phân ca có summary; Manager có thể xử lý OT ngày OFF. Sự kiện lẻ vẫn có thể hiển thị từ chi tiết raw events, nhưng không tự tạo giờ công.
- Bảng công hiển thị giờ thường, từng khoảng IN→OUT hợp lệ, OT đề xuất/chờ duyệt/đã duyệt và cờ cần rà soát. Dữ liệu cũ chưa có policy version có cảnh báo riêng.
- Modal điều chỉnh bỏ giới hạn OT không được vượt thời gian máy ghi nhận; bắt buộc lý do, chuẩn hóa giờ theo quy tắc 0 / 0,5 / 1 cho phần lẻ, đợi API thành công rồi đóng. API lỗi giữ form để sửa.
- Lịch sử raw log được phân trang tiếp thay vì dừng âm thầm ở 5.000 bản ghi toàn hệ thống.

Các file chính: `src/hooks/useAttendancePairs.ts`, `src/features/attendance/hooks/useAttendanceSummaries.ts`, `AttendanceEditModal.tsx`, `AttendanceTable.tsx`, `ManagerAttendanceMonitor.tsx`, `EmployeeAttendanceTab.tsx`, `api/attendanceApi.ts`.

### Đầu vào giờ công và OT

`roundPayableHours` chuẩn hóa đầu vào điều chỉnh theo phần lẻ <0,5 / 0,5–<0,75 / ≥0,75. Form lương chấp nhận bước 0,5 giờ. Ví dụ 1,50 giờ giữ 1,5 giờ; 1,75 giờ thành 2 giờ. Backend tiếp tục quyết định kết quả tài chính. Regression test frontend kiểm tra chính xác các mốc 30 phút, 44:59 và 45 phút; bảng công sử dụng số giờ mới do backend trả về.

## Đồng bộ Pi ↔ backend ↔ trình duyệt

- Sửa mode API từ POST sang PATCH theo route backend; chỉ hiển thị đổi thành công khi body có mode đúng và `confirmed=true` từ ACK của Pi.
- Đọc lại mode thật khi kết nối/reconnect; lần đầu chưa được xác nhận hiển thị “CHƯA XÁC NHẬN”. Không mặc định rằng Pi luôn đang CHECK_IN sau khi tải trang.
- Socket.IO gửi cookie HttpOnly với credentials, dùng origin trình duyệt hoặc `VITE_SOCKET_URL`; Vite proxy `/socket.io` có hỗ trợ WebSocket.
- Sửa tên trường realtime: timestamp, device ID, verification score, tên/avatar nhân viên; dùng ID bản ghi để tránh thêm sự kiện hai lần.
- Sửa query key từ tên không khớp sang `attendanceSummaries`; nhận sự kiện summary và lấy lại dữ liệu sau reconnect.
- Hook dữ liệu công kết nối realtime theo phiên đăng nhập, giúp lịch sử cá nhân cập nhật khi backend gửi sự kiện riêng; không chỉ trang giám sát của Manager mới có cập nhật.
- Danh sách thiết bị không fallback thành bốn thiết bị ONLINE giả. Không nhận được dữ liệu thì hiển thị danh sách rỗng/offline theo dữ liệu backend.
- WebRTC có timeout, thu thập ICE trước offer, hủy request cũ khi refresh/unmount và giải phóng phiên WHEP khi có Location. Nhãn LIVE dựa vào trạng thái ICE, bỏ khẳng định độ trễ cố định chưa đo. Mất luồng hiển thị lỗi và cho thử lại.

Các file chính: `useAttendanceSocket.ts`, `useAttendance.ts`, `WebRTCPlayer.tsx`, `useDevices.ts`, `vite.config.ts`.

## Phiếu lương

- Loại bỏ fallback 176 giờ ở bảng và form.
- Gửi lý do chỉnh giờ/OT từ modal qua API thật, không đánh rơi trường `reason` ở bước tạo request.
- `mutateAsync` giúp form chỉ đóng sau khi lưu thành công; không báo thành công ngay khi vừa bấm nút.
- Dùng đơn giá snapshot của phiếu trong preview nếu có, thay vì lấy cấu hình mới áp lên phiếu cũ.
- Bổ sung kiểu trạng thái CONFIRMED/PAID; chặn sửa các phiếu khác PENDING. Backend vẫn là chốt bảo vệ cuối.
- Phân biệt đã chốt và đã thanh toán: FINALIZED không tự được ghi nhãn “đã thanh toán”.

Các file chính: `ManagerPayroll.tsx`, `PayrollItemEditModal.tsx`, `PayrollTable.tsx`, `usePayroll.ts`, `payrollApi.ts`, các context/type lương và màn hình phiếu lương cá nhân.

## Kiểm chứng và giới hạn

TypeScript lint và Vite production build đã chạy thành công trong đợt sửa. Regression test kiểm tra giao diện dùng giờ backend, giữ OFF để duyệt bù, hiển thị nhiều cặp, không dựng điểm/giờ và request chỉnh lương truyền lý do cùng số 0.

Đây là kiểm chứng build và component/API adapter trên máy phát triển. Chưa nghiệm thu trình duyệt với camera Pi, server ThingsBoard đang vận hành, mất mạng thật, hoặc UI sau reboot Pi. Cần deploy đồng bộ backend + frontend + Rule Chain + hardware trước khi kết luận luồng thực tế đã chạy đúng.
