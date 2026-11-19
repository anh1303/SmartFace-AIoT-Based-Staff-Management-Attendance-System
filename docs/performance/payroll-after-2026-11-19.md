# Kết quả sau tối ưu tính lương — 19/11/2026

Đã triển khai bốn bước đã thống nhất, không đổi công thức hoặc schema database.

## Thay đổi

1. Tính dữ liệu từng phiếu như cũ, gom tối đa 250 phiếu vào một lệnh SQL có tham số, đọc kết quả một lần và dùng lại thông tin nhân viên đã tải. Giữ transaction, khóa kỳ, phạm vi quyền, snapshot và audit; SQL cũng không cập nhật phiếu ngoài trạng thái PENDING.
2. Bảng lương gọi API với `payroll_period` và có cache riêng từng tháng. Các màn hình cần lịch sử gọi truy vấn theo một nhân viên để giữ nguyên lịch sử và số liệu trung bình.
3. Generate cập nhật cache tháng từ kết quả trả về, giữ lại phiếu khóa/đã trả mà generate không trả về. Hủy truy vấn cũ cả trước mutation lẫn ngay trước khi cập nhật cache để tránh phản hồi chậm ghi đè số mới. Không tải lại tháng nếu đã có cache; trường hợp chưa tải tháng sẽ đọc bổ sung để không bỏ sót các phiếu đã khóa. Lịch sử và khoản phát sinh liên quan vẫn được invalidate.
4. Ngày đã khóa/duyệt được bỏ qua trước phép tính. Với ngày được phép xử lý, lưu hash đầu vào trong JSON calculation_details; ngày không đổi được dùng lại. Hash bao gồm lượt quét, kết quả ghép cặp, lượt bị bỏ qua, lượt vào chưa có ra, ca, chính sách, đơn giá, khoản phát sinh và mốc kết thúc ca. Dữ liệu cũ thiếu hash, ngày mở khóa hoặc chỉnh tay vẫn được kiểm tra/tính lại. Vẫn đọc nguồn để phát hiện thay đổi; không thêm cơ chế dirty flag dễ bị bỏ sót cập nhật.

## Đo một lượt sau sửa

Dữ liệu thật kỳ 2026-11 vẫn là 20 nhân viên, 772 lượt chấm công, 545 lịch và 545 tổng hợp ngày, 20 phiếu PENDING; 110 phiếu toàn lịch sử.

Chạy thêm một lượt bản cũ từ HEAD `9ee1c121406d8f41ca24e01b514751588fb430dd` để so sánh trên cùng dữ liệu và điều kiện mạng gần nhau. Sau đó chạy bản mới **một lượt**. Cả hai đều dùng harness rollback như báo cáo ban đầu.

| Công việc | Bản cũ đối chứng | Sau sửa | Thay đổi |
|---|---:|---:|---:|
| Generate toàn luồng | 6,792 giây | 2,431 giây | Giảm 64,2% |
| Giai đoạn tạo/lưu phiếu | 5,401 giây | 1,039 giây | Giảm 80,8% |
| Tổng hợp công tháng | 1,080 giây | 1,107 giây | Tương đương trong lượt đo này |
| Tổng số SQL trong generate | 127 | 31 | Giảm 75,6% |

Giai đoạn tạo/lưu gồm đọc nguồn, ghi và audit; không phải thời gian chỉ riêng một INSERT. Tổng thời gian có transaction/rollback và các bước chuẩn bị nên lớn hơn tổng hai giai đoạn.

So với trung vị lần đo ban đầu 9,821 giây, lần sau sửa 2,431 giây thấp hơn 75,2%. Tuy nhiên bản cũ chạy đối chứng lúc này cũng chỉ mất 6,792 giây: không nên quy toàn bộ chênh lệch với lần ban đầu cho thay đổi code. So sánh 64,2% cùng đợt đáng tin cậy hơn, nhưng vẫn là một mẫu sau sửa, không phải SLA hoặc p95.

Tải tháng đang xem trong lượt sau sửa: 1,202 giây / 20 phiếu. Tải toàn lịch sử trong cùng lượt: 1,212 giây / 110 phiếu. Đợt này chênh lệch tải nhỏ hơn lần đo đầu (trung vị 1,309 so với 3,922 giây), cho thấy độ trễ backend/mạng dao động. Lợi ích chắc chắn của bước cache là không gọi lại danh sách tháng sau generate đã có cache; điều này được kiểm thử ở frontend, không phải đo HTTP/trình duyệt.

Không quan sát được tổng hợp công nhanh hơn trong mẫu này. Database vẫn cần đọc/kiểm tra nguồn, và các ngày cũ chưa có hash phải tính một lần để khởi tạo. Phép thử chạy rollback nên hash khởi tạo cũng không được giữ lại trên database thật. Kiểm thử độc lập xác nhận lượt kế tiếp với dữ liệu không đổi không gọi calculateDay; thay đổi một ngày chỉ gọi lại ngày đó; khi ca kết thúc thì ngày vẫn tự chuyển từ SCHEDULED sang ABSENT.

## Kiểm chứng tính đúng và an toàn dữ liệu

- Hash SHA-256 kết quả nghiệp vụ của 20 phiếu bản cũ và mới **giống nhau**: gồm đơn giá, giờ công, OT, trễ/sớm, phạt vắng, số ca vắng, phụ cấp, thực lĩnh, hệ số, breakdown, fingerprint nguồn công/khoản phát sinh.
- Snapshot phiếu lương trước/sau rollback của cả hai lượt **giống nhau**.
- Rollback không hoàn tác PostgreSQL sequence; có thể xuất hiện khoảng trống số ID, không thay đổi nội dung phiếu.
- Đây là phép đo service + database thật, không bao gồm HTTP/render trình duyệt. Hai transaction con được chuyển vào một outer transaction để rollback an toàn, như lần đo đầu.
- Kiểm thử nghiệp vụ, phạm vi quyền, kỳ đã khóa, batch, cache chậm, lịch sử và incremental đã chạy; build backend/frontend và TypeScript được kiểm tra riêng. Các suite integration yêu cầu database test cách ly vẫn không chạy lên database nghiệp vụ.

Số liệu sau sửa: `payroll-after-2026-11-19.json`. Đối chứng bản cũ: `payroll-reference-2026-11-19-final.json`. Số liệu ban đầu: `payroll-measure-2026-11-19.json`.
