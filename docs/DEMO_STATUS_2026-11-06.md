# Bản demo: cập nhật realtime, tác vụ nền và chống chấm công lặp

## Đã triển khai

- Thêm/sửa nhân viên có thông báo đang lưu, thành công hoặc lỗi; sửa hiển thị ngay và đối soát dữ liệu backend. Giữ bản nháp khi lỗi; chống response cũ ghi sang phiên đăng nhập khác và phục hồi phiên bản sau conflict.
- Copy tuần trước/phân lịch hàng loạt gửi một lệnh, chạy nền trong PostgreSQL. Bảng Hoạt động giữ tiến độ khi chuyển trang, hiện lỗi từng ca và cho thử lại ca lỗi. Không ghi đè ca đã bị người khác sửa.
- Khuôn mặt xử lý nền, ảnh staging mã hóa, kết quả/vector/avatar/audit được ghi cùng transaction phía Python; không báo enrolled trước khi lưu. Vân tay được ghi rõ là mô phỏng.
- Email tài khoản gửi nền; lỗi SMTP được báo riêng, không báo việc tạo nhân viên thất bại giả.
- Chấm công phát sự kiện cập nhật cache chung cho attendance, tổng hợp, dashboard và payroll; không cần refresh trình duyệt. Gộp sự kiện trong 50 ms để tránh tải lại nhiều lần cho cùng lượt quét. Nhân viên/lịch có socket cập nhật theo quyền; khi mất kết nối socket, FE đối soát mỗi 5 giây ở tab đang hiển thị.
- Tìm nhân viên bằng vector được gộp từ 3 truy vấn DB thành 1 truy vấn JOIN, vẫn lọc ACTIVE, đúng model và CENTROID. Không đổi threshold, model hoặc logic hardware. Chưa benchmark độ trễ đầu-cuối trên Pi thật.
- Chống quét lặp kiểm tra trong transaction có khóa theo nhân viên. Quét bị bỏ qua không tạo log mới, không tổng hợp lại công và không phát sự kiện chấm công thành công mới.
- Request lịch sử của FE dùng `compact=true`, không lấy/lặp ảnh nhân viên theo từng log. Đo trên DB demo: cùng trang 5.000 log giảm từ 141.030.698 xuống 1.098.085 byte; ảnh danh sách nhân viên và response quét mặt được giữ nguyên. Lượt quét bị bỏ qua hiện thông báo thông tin thay vì toast thành công mới.
- Đã sửa các lỗi test cũ: fixture thiếu API transaction, ngày test phụ thuộc đồng hồ, dữ liệu dashboard, truy vấn chéo module, đường dẫn/file tạm Windows. Callback trạng thái thiết bị yêu cầu webhook secret ngay cả khi cấu hình bị thiếu.

## Cấu hình khoảng cách ghi nhận

Đã thêm vào `backend/.env` và `.env.example`:

```dotenv
ATTENDANCE_MIN_EVENT_INTERVAL_SECONDS=600
```

- Chấp nhận số nguyên từ **1 đến 1800 giây**, mặc định 600 giây; demo có thể đặt 5 giây. Đổi giá trị cần restart backend.
- Áp dụng giữa hai lượt chấm công hợp lệ liên tiếp của **cùng một nhân viên**, dùng chung CHECK_IN và CHECK_OUT, kể cả khác thiết bị. Tính theo thời gian server ghi nhận; timestamp thiết bị không thể rút ngắn khoảng cách.
- Trong khoảng chờ: response có `ignored: true`, `cooldown: true`, `retry_after_seconds` và thông báo rõ; webhook trả `door_open: false`. Không đổi mã hardware.
- Khi demo check-in rồi checkout ngay cùng người, checkout sẽ bị bỏ qua đúng cấu hình. Dùng nhân viên khác hoặc chờ đủ thời gian; điều chỉnh công hành chính vẫn dùng luồng điều chỉnh riêng.

## Database và cách chạy thử

- **Đã áp dụng thành công** migration duy nhất còn chờ `20261106080000_background_operations` lên database cấu hình trong `backend/.env`. Migration thêm bảng job/staging/receipt và phiên bản ca; không xóa dữ liệu hiện có.
- Build frontend, TypeScript frontend và build backend đã qua. Toàn bộ suite cuối: **174 test FE pass; 450 test BE pass, 73 test DB skip theo điều kiện sẵn có; không có failure FE/BE**. Kết quả trong `frontend-release.log`, `backend-release.log` (log local, không commit).
- Smoke test thật đã qua: DB kết nối và migration/receipt table có đủ; 10 request API admin/nhân viên trả HTTP200; Edge headless mở 10 trang dashboard/nhân viên/lịch/chấm công/sinh trắc học/bảng lương, không có JavaScript runtime error hoặc HTTP500. Chỉ đọc dữ liệu với phiên QA ngắn hạn, không tạo chấm công/nhân viên giả. Bằng chứng local: `backend/tmp/release/smoke.json` và ảnh dashboard.
- Nếu server đang mở từ trước, restart backend/FE để nhận cấu hình và mã mới. Chạy tại repo:

```powershell
npm.cmd --prefix backend run dev
npm.cmd --prefix frontend run dev
```

Hai lệnh chạy ở hai terminal. FE mặc định port 5173, backend 3000. Đăng nhập, mở Dashboard ở một tab và Chấm công ở tab khác; tạo một lượt hợp lệ và kiểm tra dashboard/bảng công tự đổi. Sau đó quét lại để kiểm tra thông báo bỏ qua lượt lặp. Copy lịch phải hiện bảng Hoạt động và kết quả từng ca.

## Việc còn lại / giới hạn đã biết

1. **Python research suite chưa xanh toàn bộ:** lần chạy gần nhất 118 pass, 3 lỗi import thiếu PyTorch tại `test_r7_casia_notebook`, `test_r7_gate_ablation_notebook`, `test_r7_runtime`. Không skip để che lỗi và chưa cài dependency nặng. Chi tiết: `face_auth/md/validation-blockers-2026-11-06.md`. Các test enrollment/receipt/replay và ONNX extraction tập trung đã qua; không suy ra toàn bộ PAD đã kiểm chứng.
2. **73 test backend DB integration đang skip theo điều kiện vốn có.** Chưa chạy chống tranh chấp bằng nhiều worker/Pi thật trên database test cô lập. Test mock kiểm tra thứ tự transaction/lease/replay; không thay thế kiểm thử lock PostgreSQL thực tế. Không chạy test phá dữ liệu trên DB demo.
3. Face enrollment nền cần phiên bản Python mới và `FACE_AUTH_INTERNAL_KEY` giống nhau ở backend/face_auth (ít nhất 32 ký tự); cần khởi động dịch vụ inference và có model đúng cấu hình. Không tạo key mới hoặc thay model/threshold đang dùng để né lỗi.
4. SMTP phải cấu hình thực tế. Nếu process chết sau khi SMTP đã gửi nhưng trước ack, email có thể gửi lặp; SMTP hiện không bảo đảm exactly-once. Secret staging mã hóa hết hạn sau 24 giờ và được xóa khi job kết thúc.
5. Vân tay chưa kết nối cảm biến thật; giao diện đã công khai chế độ mô phỏng. Không dùng kết quả mô phỏng để kết luận phần cứng hoạt động.
6. Chưa benchmark latency đầu-cuối và chưa kiểm thử camera/hardware trực tiếp. Khi tích hợp main mới (`237ec53f`), giữ tối ưu webhook trả sau khi lưu log, tổng hợp tiếp ở backend và phát sự kiện khi hoàn tất; luồng web đồng bộ giữ nguyên. Nếu process chết giữa tổng hợp webhook, nguồn log vẫn bền vững và lịch cron tính lại; đây chưa phải một job tổng hợp riêng có lease. Giữ batch 5.000 cho response compact để tránh vòng lặp nhiều request 100 dòng; tham số limit tường minh vẫn được tôn trọng. Những thay đổi hardware/audio có sẵn từ main được giữ nguyên, không tự sửa logic hardware.
7. Người dùng đã yêu cầu commit, push và tích hợp vào main sau kiểm tra. Các thay đổi portal/chấm công liên quan được giữ trong bản bàn giao; `.env`, log, ảnh QA và tài liệu thí nghiệm ngoài phạm vi không đưa lên Git. Bản main cục bộ cũ được giữ bằng nhánh backup nếu cần cập nhật main do lịch sử đang phân kỳ.
