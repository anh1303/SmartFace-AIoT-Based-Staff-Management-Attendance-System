# Ranh giới dữ liệu bảng lương

`GET /api/payroll` trả `approved_absence_count` là số khoản vắng đã duyệt được đưa vào snapshot của phiếu lương. Trường có giá trị `null` khi phiếu lịch sử chưa lưu số đã kiểm tra tính đầy đủ hoặc còn ca làm đến hết ngày hiện tại chưa có tổng hợp; giao diện không suy ra 0 từ dữ liệu thiếu. Đây là số khoản vắng trong phiếu, không phải thống kê toàn bộ ngày vắng mới nhất. Khi dữ liệu công thay đổi, trạng thái cần tính lại của phiếu vẫn áp dụng.

`POST /api/payroll/:id/preview` nhận `{ "allowance": 0, "updated_at": "..." }` và trả envelope thông thường với `data.net_salary` và `data.updated_at`. Endpoint yêu cầu ADMIN hoặc MANAGER có quyền trên nhân viên, không ghi dữ liệu và từ chối phiếu đã khóa, snapshot không hợp lệ hoặc phiên bản cũ. Thao tác PUT vẫn kiểm tra quyền, dữ liệu nguồn và phiên bản độc lập; nếu dữ liệu đã thay đổi, người dùng phải tải lại và xem lại trước khi lưu.

Các feature frontend công bố API qua `features/<tên>/index.ts`. Mã trong feature có thể dùng file nội bộ của chính nó; code thuộc feature khác và các trang dùng entry point công khai. Test `frontend/validation/integration/feature-boundaries.test.ts` kiểm tra các ranh giới này. Provider domain giữ vòng đời trước đây nhưng không còn ghép toàn bộ state vào một context.

Các module backend trao đổi qua `public.ts`; `biometrics/fingerprint.public.ts` là hợp đồng hẹp cho validation binding dùng trong giao dịch chấm công. `backend/src/composition.ts` nối các hợp đồng giữa chấm công, ca làm, nhân viên, lương và xác thực; các script gọi service trực tiếp phải import file này trước khi thực hiện nghiệp vụ. Các hàm nhận transaction tiếp tục dùng transaction do bên gọi cung cấp. `server.ts` nối operation gateway và worker với hàm tra cứu và xác thực socket.

Test `backend/validation/architecture/module-boundaries.test.ts` kiểm tra import/re-export tĩnh xuyên module, cùng đồ thị import runtime tĩnh trong `src`; import kiểu dữ liệu được loại khỏi đồ thị runtime. Test không bao phủ import động được xây dựng tại runtime hay phụ thuộc từ bên ngoài `src`.

Một số phép tính trình bày vẫn nằm ở frontend: trung bình theo tháng trong `features/employees/utils/monthlyAverages.ts`, thời lượng các cặp đang được lọc trong `AttendanceDayDetails.tsx`, và heuristic nhóm lượt quẹt qua đêm chưa gắn với summary trong `useAttendancePairs.ts`. Chúng không phải kết quả lương được lưu; heuristic qua đêm có thể cần đối chiếu thêm với backend khi thay đổi chính sách chấm công. Không dùng chúng làm căn cứ lưu hoặc chốt công.
