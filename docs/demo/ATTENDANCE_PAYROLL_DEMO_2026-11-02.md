# Demo chấm công và lương — 02/11/2026

Đã seed trực tiếp trên Neon. Dữ liệu liên tục theo ngày tuyển, lịch thường thứ Hai–thứ Sáu 08:00–17:00, OFF cuối tuần và các ngoại lệ trong bảng bên dưới. Không có lượt quét sau thời điểm seed. Hiện có 24 nhân viên (thêm một hồ sơ sau lần audit đầu có 23).

## Trạng thái chuẩn bị

- Tháng 9: 18 nhân viên đủ điều kiện, công APPROVED, 18 phiếu lương FINALIZED.
- Tháng 10: 22 phiếu PENDING. Ba ngày đang mở để demo: NV-002/26-10, NV-003/26-10, NV-005/27-10. NV-006/27-10 đã duyệt để demo mở khóa và sửa quyết định.
- Tháng 11: chỉ ngày 1 và 2, 24 phiếu PENDING. Ca sáng kết thúc đã có một số ngày duyệt để xem lương tạm tính; ca hành chính hôm nay còn mở. NV-022 chỉ có dữ liệu từ ngày tuyển 02/11.
- Giữ nguyên tháng 8 và ngoài tháng 9–11; không đổi nhân viên, tài khoản, phòng ban, chức vụ, chính sách, thiết bị hay embeddings. Hash dữ liệu bảo vệ đã đối chiếu trước/sau và trùng nhau.
- Script: `cd backend && node --import tsx prisma/seed-demo-2026.ts`. Mặc định chỉ dry-run; thêm `--apply` sẽ reset lại dữ liệu demo. Script giới hạn ngày chạy 02/11/2026; không chạy lại sau khi đã thực hiện demo nếu muốn giữ quyết định mới.

## Xem từng case

Dùng Admin tại [Theo dõi chấm công](http://localhost:8080/app/manager/attendance). Chọn ngày, tìm mã nhân viên, mở dòng để xem lượt gốc. Dùng **Lọc lượt chấm công**: tất cả / ghép cặp / được tính công để thấy lượt bị loại. Giao diện dev port 5173 có cùng đường dẫn.

| Case | Nhân viên | Ngày công | Giờ quét VN | Mục đích |
|---|---|---|---|---|
| 01 | NV-002 | 2026-10-05 | 07:55 → 17:00 | Đúng giờ |
| 02 | NV-003 | 2026-10-05 | 08:15 → 17:00 | Ân hạn đúng 15 phút |
| 03 | NV-005 | 2026-10-05 | 08:15:01 → 17:00 | Trễ 15 phút 1 giây, chưa đủ nửa giờ phạt |
| 04 | NV-006 | 2026-10-05 | 08:20 → 17:00 | Trễ 20 phút, phạt làm tròn 0 |
| 05 | NV-002 | 2026-10-06 | 08:35 → 17:00 | Trễ 35 phút → 0,5 giờ phạt |
| 06 | NV-003 | 2026-10-06 | 08:00 → 16:30 | Về sớm 30 phút |
| 07 | NV-005 | 2026-10-06 | 08:40 → 16:20 | Trễ 40 phút và về sớm 40 phút |
| 08 | NV-006 | 2026-10-06 | 07:00 → 17:00 | Đến sớm không tự tính OT |
| 09 | NV-008 | 2026-10-07 | 08:00 → 10:00 → 12:00 → 17:00 | Ra ngoài 2 giờ, tổng 7 giờ thực tế, đủ ngưỡng |
| 10 | NV-009 | 2026-10-07 | 08:00 → 09:00 → 10:00 → 12:00 → 13:00 → 17:00 | Vào ra ba cặp |
| 11 | NV-011 | 2026-10-08 | 08:00 → 17:30 | OT đúng 30 phút không phát sinh khoản OT |
| 12 | NV-012 | 2026-10-08 | 08:00 → 17:30:01 | OT 30 phút 1 giây → 0,5 giờ |
| 13 | NV-014 | 2026-10-08 | 08:00 → 17:45 | OT 45 phút → 0,5 giờ |
| 14 | NV-015 | 2026-10-08 | 08:00 → 18:30 | OT 1,5 giờ |
| 15 | NV-017 | 2026-10-09 | 08:00 → 22:00 | OT 5 giờ chỉ duyệt tối đa 4 giờ |
| 16 | NV-018 | 2026-10-09 | Không quét | Vắng mặt cả ca, phạt vắng theo hệ số 2 |
| 17 | NV-002 | 2026-10-12 | 08:00 | Quên check-out |
| 18 | NV-003 | 2026-10-12 | 17:00 | Quên check-in |
| 19 | NV-005 | 2026-10-13 | 08:00 → 09:00 → 17:00 | Hai IN liên tiếp: IN sau thay IN trước |
| 20 | NV-006 | 2026-10-13 | 08:00 → 17:00 → 19:00 | OUT dư không được tính OT |
| 21 | NV-008 | 2026-10-14 | 08:00 → 12:00 → 17:00 | Lượt bị đánh dấu làm gián đoạn cặp |
| 22 | NV-009 | 2026-10-14 | Không quét | Ca OFF không phạt vắng |
| 23 | NV-011 | 2026-10-17 | 09:00 → 14:00 | Làm ngày OFF 5 giờ, OT thủ công có thể vượt 4 giờ |
| 24 | NV-012 | 2026-10-19 | 09:00 → 12:00 | Có quét nhưng chưa phân ca |
| 25 | NV-014 | 2026-10-21 | 08:00 → 12:00 | Ca sáng 4 giờ |
| 26 | NV-015 | 2026-10-21 | 13:00 → 17:00 | Ca chiều 4 giờ |
| 27 | NV-014 | 2026-10-28 | 08:00 → 13:00 | Chính sách cũ: 5/9 giờ đủ nửa ca |
| 28 | NV-014 | 2026-10-29 | 08:00 → 13:00 | Chính sách mới: 5/9 giờ không đủ 2/3 ca |
| 29 | NV-017 | 2026-10-29 | 08:00 → 13:59:59 | Thiếu 1 giây so với 2/3 ca |
| 30 | NV-018 | 2026-10-29 | 08:00 → 14:00 | Đúng 6/9 giờ đủ 2/3 ca |
| 31 | NV-018 | 2026-10-31 | 22:00 → hôm sau 06:00 | Ca đêm qua tháng: 22h → 06h hôm sau |
| 32 | NV-002 | 2026-10-26 | 08:40 → 17:00 | CHỜ DUYỆT: miễn phạt trễ vì có lý do |
| 33 | NV-003 | 2026-10-26 | 08:00 → 18:30 | CHỜ DUYỆT: OT 1,5 giờ, có thể chỉ duyệt 1 giờ |
| 34 | NV-005 | 2026-10-27 | 08:00 → 18:30 | CHỜ DUYỆT: từ chối OT bằng cách đặt 0 |
| 35 | NV-006 | 2026-10-27 | 08:35 → 17:00 | Đã duyệt phạt: mở khóa để sửa quyết định |
| 36 | NV-017 | 2026-11-01 | 09:00 → 12:00 | CHỜ DUYỆT: làm thêm ngày nghỉ 3 giờ |
| 37 | NV-018 | 2026-11-01 | 22:00 → hôm sau 06:00 | Ca đêm 22h → 06h ngày 2 |
| 38 | NV-018 | 2026-11-02 | Không quét | Nghỉ sau ca đêm |
| 39 | NV-002 | 2026-11-02 | 08:15 | Dòng vào đầu ca: đúng giờ 08:15 |
| 40 | NV-003 | 2026-11-02 | 08:15:01 | Dòng vào đầu ca: đi trễ 08:15:01 |
| 41 | NV-019 | 2026-11-02 | 08:30 | Dòng vào đầu ca: đi trễ 08:30 |
| 42 | NV-008 | 2026-11-02 | 08:35 → 12:00 | Ca sáng trễ 35 phút |
| 43 | NV-009 | 2026-11-02 | 08:00 → 10:39:59 | Ca sáng thiếu 1 giây so với 2/3 ca |
| 44 | NV-011 | 2026-11-02 | Không quét | Ca sáng vắng mặt |
| 45 | NV-012 | 2026-11-02 | Không quét | Ca chưa kết thúc, chưa quét: chưa kết luận vắng |
| 46 | NV-022 | 2026-11-02 | 07:55 → 12:00 | Nhân viên mới, chỉ có dữ liệu từ ngày tuyển |

“hôm sau” nghĩa là lượt OUT thuộc ngày tiếp theo, công/lương vẫn thuộc ngày bắt đầu ca. Lượt giữa ca là bằng chứng từng sự kiện; đánh giá cả ngày dùng các biên hợp lệ, không cộng phạt riêng khoảng ra ngoài rồi quay lại.

## Trình tự demo duyệt và chốt lương

1. Ngày **26/10**, **NV-002** → **Xét duyệt** → đổi trễ/sớm 0,5 thành 0 → lý do “Có giấy khám bệnh, quản lý chấp nhận” → **Lưu thay đổi**. Lượt 08:40 vẫn còn. Khi tính lại lương sẽ giảm 82.500đ tiền phạt (110.000đ/giờ × 1,5 × 0,5 giờ).
2. Cùng ngày, **NV-003**: duyệt OT 1,5 giờ hoặc chấp nhận 1 giờ, ghi lý do.
3. Ngày **27/10**, **NV-005**: đặt OT 0, lý do “OT chưa được phân công”. Khoản OT thành VOID khi ngày được duyệt, không phải một bước duyệt khoản độc lập.
4. Ngày **27/10**, **NV-006**: **Mở khóa** ngày đã duyệt → **Xét duyệt** → đổi trễ/sớm 0,5 về 0 hoặc giữ nguyên, ghi lý do và lưu. Đây là case sửa quyết định đã có.
5. [Bảng lương](http://localhost:8080/app/manager/payroll) → **Kỳ lương: 10/2026** → **Theo dõi OT & khoản phạt** → **Đối chiếu trên bảng chấm công**. Thử chốt trước khi xử lý ba ngày chờ: hệ thống chặn.
6. Dòng **NV-005** → **Sửa** → **Điều chỉnh phụ cấp**: 1.500.000đ thành 1.800.000đ, lý do “Hỗ trợ đi lại tháng 10”. Tiền phụ cấp tăng 300.000đ. Đây là cập nhật có lý do, chưa có hàng đợi duyệt phụ cấp riêng.
7. Xử lý hết ba ngày chờ và NV-006 nếu đã mở khóa → **Tính lại lương** → đối chiếu → **Chốt kỳ lương**. Chỉ chốt khi muốn kết thúc demo tháng 10. Admin có **Mở khóa sửa bảng lương** để mở lại; quản lý không tự mở kỳ đã chốt.
8. Chọn **09/2026** xem lịch sử đã chốt; chọn **11/2026** xem nháp đầu tháng. Tháng 11 chưa kết thúc nên chưa chốt định kỳ được.
9. Dùng **NV-001**, quản lý Nhân sự: thao tác NV-002/003 trong phòng; kiểm tra không sửa bản thân, quản lý khác hoặc nhân viên phòng khác. Dùng Admin cho case các phòng khác.
10. Phía nhân viên: **Chấm công**, **Lương tạm tính**, **Lịch sử lương** để so sánh trước/sau duyệt.

## Quy tắc và giới hạn cần nói rõ

- Ca 08–17 dài 9 giờ, chưa trừ nghỉ trưa. Trước 29/10 áp ngưỡng nửa ca; từ 29/10 áp 2/3 ca. Đúng 6 giờ được ghi 9 giờ; 5:59:59 chưa đủ. Dưới ngưỡng mới vẫn ghi trễ/sớm thực tế từ cặp hợp lệ.
- 08:15:00 còn ân hạn, 08:15:01 là trễ. Nhãn trễ khác giờ phạt: 20 phút làm tròn 0, 35 phút thành 0,5 giờ. Cộng trễ+sớm rồi làm tròn xuống theo nửa giờ.
- OT chỉ tự đề xuất khi vượt 30 phút và đủ công; đúng 30 phút là 0. Ca thường duyệt tối đa 4 giờ; OFF có thể hơn 4 nhưng không quá thời gian thực tế.
- Hệ số hiện hành: OT 2; phạt trễ/sớm 1,5; phạt vắng 2. Phụ cấp mặc định 1.500.000đ/kỳ, không tự chia theo số ngày làm. Phiếu đầu tháng có thể có phụ cấp dù công chưa duyệt.
- Ngày quản lý chủ động mở sẽ không bị cron tự chốt lại; các case chờ giữ được để demo.
- Chưa có API gửi giải trình từ dashboard nhân viên, luồng duyệt phụ cấp độc lập hoặc màn miễn riêng phạt vắng. Demo chấp nhận lý do trễ bằng quản lý nhập lý do trong Xét duyệt. Không trình bày các luồng chưa có như đã hoạt động.
- Quyết toán sớm chuyển nhân viên sang TERMINATED và xóa lịch tương lai, nên không đưa vào seed mặc định.

## Sửa lỗi và stack đang chạy

- Dòng vào đầu ca dùng đúng trạng thái LATE của lượt gốc khi tổng hợp ngày đang INCOMPLETE.
- Nhãn ca đêm dùng mốc thời gian đầy đủ và phân ca ngày trước: OUT 05:00 của ca 22–06 là về sớm; OUT 06:05 đúng giờ.
- Dashboard dùng lượt vào hợp lệ đầu tiên mỗi nhân viên để đếm đến đúng giờ/đi trễ; vào lại sau nghỉ không tăng số nhân viên.
- Chính sách công ty đã cập nhật cho khớp dưới 2/3 ca và quy trình duyệt ngày công.
- Backend và Face Auth cùng dùng Neon; Face Auth tìm thấy NV-011. Smoke test ba ảnh gallery qua trích xuất tới bước tìm nhân viên. Không gán các ảnh gallery vào nhân viên thật.
- Mismatch DB gây lỗi 404 đã sửa. Lỗi 400 không phát hiện mặt là nhánh ảnh đầu vào riêng, nay có lý do rõ: không đọc được ảnh, không thấy mặt, nhiều mặt, lỗi căn chỉnh hoặc embedding. Không hạ ngưỡng model. Chưa xác nhận lại bằng chính các ảnh từng bị lỗi của người dùng.
- `.env.compose` đã chọn `COMPOSE_FILE=docker-compose.cloud.yml`. Lệnh `docker compose --env-file .env.compose --profile app up -d --build` dùng Neon; tránh chạy hai stack cùng project để đổi DB qua lại.
- Vite port 5173 dùng proxy rõ `127.0.0.1:3000` tránh chọn nhầm backend IPv6 trên localhost.

[Kết quả seed và hash đối soát](./seed-demo-2026-11-02-result.json) · [Audit trước seed](./neon-audit-2026-11-02.json).
Bản sao dữ liệu bị thay nằm trong `/private/tmp`, quyền 0600, không commit.
