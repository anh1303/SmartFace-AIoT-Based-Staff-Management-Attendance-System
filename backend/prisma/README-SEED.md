# Hướng dẫn tạo dữ liệu phân ca và check-in/check-out

Có hai seed chạy riêng:

| Seed | Lệnh npm | Dữ liệu tạo |
| --- | --- | --- |
| `seed-shifts.ts` | `prisma:seed:shifts` | Danh mục ca còn thiếu và lịch phân ca theo tháng |
| `seed-attendance.ts` | `prisma:seed:attendance` | Lượt check-in/out, bản tổng hợp công và khoản cần duyệt |

**Thứ tự: tạo phân ca → tạo check-in/out → kiểm tra công đã được tự chốt/duyệt → tính lại lương.** Cả hai seed lấy nhân viên `ACTIVE` từ database, không tạo hồ sơ nhân viên mới và không tạo dữ liệu trước ngày tuyển.

Các lệnh dưới đây dùng `npm.cmd` cho Windows PowerShell để tránh lỗi chặn `npm.ps1`. Nếu dùng Linux/macOS, thay `npm.cmd` bằng `npm`.

## 1. Chuẩn bị

Mở terminal tại thư mục gốc dự án, chuyển vào backend:

```powershell
cd backend
```

Nếu terminal đã ở `backend`, không cần chạy lại `cd backend`. Các lệnh còn lại trong hướng dẫn đều chạy tại đây.

Backend cần có dependencies, Prisma Client, cấu hình database trong `backend/.env`, và database đã áp dụng migrations. Nếu mới cài dự án, thực hiện theo thứ tự:

```powershell
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

`prisma:migrate` áp dụng migrations lên database được cấu hình; kiểm tra đúng database phát triển/demo trước khi chạy. Không cần khởi động server backend hoặc frontend để chạy seed.

Database cần có nhân viên `ACTIVE`. Nếu chưa có dữ liệu nền và database mới chỉ có schema, có thể chạy:

```powershell
npm.cmd run prisma:seed
```

**Chỉ chạy `prisma:seed` cho database chưa có dữ liệu nền.** Không chạy lại lệnh này trước mỗi lần tạo ca/chấm công; seed nền sẽ từ chối nếu đã có dữ liệu nền.

## 2. Cách nhanh nhất: tạo dữ liệu cả tháng

Ví dụ tạo lại toàn bộ phân ca và chấm công đủ điều kiện trong tháng 10/2026:

```powershell
npm.cmd run prisma:seed:shifts -- 2026-10 --mode overwrite
npm.cmd run prisma:seed:attendance -- 2026-10 --mode overwrite
```

Chờ lệnh đầu hoàn tất rồi mới chạy lệnh thứ hai. Thay `2026-10` bằng tháng muốn tạo. Giữ nguyên dấu `--` đầu tiên: đây là dấu phân cách để npm chuyển các tham số sau đó cho seed.

`overwrite` sẽ thay dữ liệu cũ trong phạm vi đủ điều kiện, trừ ngày/kỳ đã được bảo vệ ở mục 6. Nếu muốn giữ dữ liệu cũ và chỉ bổ sung phần thiếu, thay `overwrite` bằng `skip`.

## 3. Tạo phân ca theo tháng

### Nhập trực tiếp khi terminal hỏi

```powershell
npm.cmd run prisma:seed:shifts
```

Terminal hỏi tháng, nhập rồi nhấn Enter:

```text
Tháng phân ca (YYYY-MM): 2026-10
```

Sau đó chọn cách xử lý dữ liệu đã có:

```text
Dữ liệu đã có: 1. Xóa và tạo lại  2. Bỏ qua — chọn 1 hoặc 2: 1
```

Nhập `1` để thay ca cũ, hoặc `2` để giữ ca cũ và chỉ tạo những ngày còn thiếu.

### Truyền sẵn tháng và chế độ trong lệnh

```powershell
# Xóa phân ca cũ đủ điều kiện trong tháng, rồi tạo lại
npm.cmd run prisma:seed:shifts -- 2026-10 --mode overwrite

# Giữ phân ca đã có, chỉ tạo phần còn thiếu
npm.cmd run prisma:seed:shifts -- 2026-10 --mode skip
```

Seed chỉ nhận **một tháng**, không nhận ngày riêng hoặc khoảng ngày. Các loại ca được dùng theo nhóm nhân viên, không chia đều:

| Loại ca | Giờ phân ca |
| --- | --- |
| `OFFICE_HOURS` — hành chính | 08:00–17:00 |
| `MORNING` — sáng | 08:00–12:00 |
| `AFTERNOON` — chiều | 13:00–17:00 |
| `OTHER` — ca đêm | 22:00–06:00 hôm sau |
| `OFF` — nghỉ | Không có giờ làm |

Danh mục ca chuẩn được bổ sung nếu thiếu. Quy tắc lịch mô phỏng:

- Quản lý của các phòng ban: ca hành chính từ thứ Hai đến thứ Sáu.
- Nhân viên Nhân sự, Kế toán, Marketing và phòng ban chưa có quy tắc riêng: ca hành chính từ thứ Hai đến thứ Sáu.
- Nhân viên Kinh doanh (`SALE`) và CSKH (`CS`): ca sáng/chiều, đổi theo tuần và chia theo nhóm trong phòng.
- Nhân viên IT: chủ yếu ca hành chính; mỗi tuần một nhân viên đủ điều kiện trực đêm thứ Ba, nghỉ thứ Tư. Quản lý IT không nằm trong nhóm trực.
- Thứ Bảy, Chủ Nhật: nghỉ. Nếu DB đang có ca đêm được giữ nguyên của ngày trước, seed tôn trọng thời gian nghỉ sau ca đó, kể cả qua tháng.

Nếu ngày nghỉ dự kiến sau ca đêm nằm ngoài phạm vi tạo lịch, đã khóa/duyệt, hoặc có ca làm phải giữ nguyên ở chế độ `skip`, seed không thêm ca đêm mới khi chưa bảo đảm được ngày nghỉ sau đó.

Đây là giả định phục vụ mô phỏng, chưa phải quy chế nhân sự thực tế của công ty. Không ép nhân viên văn phòng làm ca đêm để có đủ loại: nếu DB thiếu nhóm nhân viên phù hợp thì báo loại ca chưa được tạo. Có thể tạo phân ca cho tháng tương lai. Lịch dùng ngày lịch và danh sách nhân viên ổn định; việc chọn một khoảng ngắn không tự dịch vòng đổi ca.

## 4. Tạo dữ liệu check-in/out

Seed này dùng **lịch phân ca đang có trong DB**, không tự tạo phân ca. Có ba dạng thời gian được hỗ trợ.

### A. Cả tháng

```powershell
npm.cmd run prisma:seed:attendance -- 2026-10 --mode overwrite
```

Hoặc chỉ bổ sung những ngày công chưa có dữ liệu:

```powershell
npm.cmd run prisma:seed:attendance -- 2026-10 --mode skip
```

### B. Một ngày

```powershell
npm.cmd run prisma:seed:attendance -- 2026-10-20 --mode overwrite
```

Phân ca ngày `2026-10-20` phải tồn tại trước. Lệnh chỉ thay dữ liệu chấm công của ngày đó, không thay lịch phân ca.

### C. Khoảng ngày, gồm cả ngày bắt đầu và kết thúc

```powershell
npm.cmd run prisma:seed:attendance -- 2026-10-15 2026-10-25 --mode overwrite
```

Khoảng ngày được phép đi qua nhiều tháng. Ví dụ tạo dữ liệu từ 25/10 đến hết 02/11/2026:

```powershell
# Tạo lịch cho cả hai tháng trước nếu chưa có
npm.cmd run prisma:seed:shifts -- 2026-10 --mode skip
npm.cmd run prisma:seed:shifts -- 2026-11 --mode skip

# Sau đó tạo check-in/out trong khoảng cần thiết
npm.cmd run prisma:seed:attendance -- 2026-10-25 2026-11-02 --mode overwrite
```

Hai lệnh phân ca trên bổ sung lịch cho **cả tháng** tương ứng; lệnh chấm công chỉ tác động khoảng ngày đã nhập. Khoảng chấm công tối đa 366 ngày, ngày bắt đầu phải không lớn hơn ngày kết thúc.

### Nhập thời gian và chế độ theo câu hỏi trên terminal

```powershell
npm.cmd run prisma:seed:attendance
```

Ở câu hỏi thời gian, nhập một trong ba dạng rồi Enter:

```text
2026-10
```

```text
2026-10-20
```

```text
2026-10-15 2026-10-25
```

Sau đó nhập `1` để xóa/tạo lại hoặc `2` để bỏ qua ngày đã có dữ liệu. Nếu đã truyền thời gian nhưng chưa truyền `--mode`, seed chỉ hỏi chế độ.

## 5. Các trường hợp chấm công được mô phỏng

Seed chọn trường hợp bằng xác suất có trọng số trên các ngày làm đủ điều kiện:

| Nhóm trường hợp | Tỉ lệ mục tiêu |
| --- | ---: |
| Đúng giờ, đủ ca | 70% |
| Đi trễ | 10% |
| Về sớm | 5% |
| Vừa trễ vừa sớm | 2% |
| Tăng ca | 5% (4,8% OT thông thường + 0,2% vượt 4 giờ) |
| Vắng | 3% |
| Thiếu lượt | 3% (1,5% thiếu check-in + 1,5% thiếu check-out) |
| Các trường hợp đặc biệt | 2% (mỗi loại dưới đây 0,4%) |

Năm trường hợp đặc biệt: dưới ngưỡng giờ làm, nhiều cặp vào/ra, check-in lặp, lượt không hợp lệ, và có làm thêm nhưng chưa đạt ngưỡng OT.

Các kịch bản được hỗ trợ:

- Đúng giờ, đi trễ, về sớm, vừa đi trễ vừa về sớm.
- Vắng hoàn toàn, thiếu check-in, thiếu check-out.
- Không đủ ngưỡng giờ làm, nhiều cặp vào/ra, check-in lặp, lượt không hợp lệ.
- OT dưới ngưỡng tính, OT thông thường 31–120 phút, OT vượt 4 giờ cần xem xét.
- Ngày nghỉ không quét, có quét trong ngày nghỉ và ca đêm qua ngày hôm sau.

Bản tổng hợp dùng chính sách tính công hiện tại; không tự duyệt công/OT và không tạo phiếu lương. Ngày `OFF` được xét riêng: khoảng 98% nghỉ không quét và 2% có lượt quét; ngày nghỉ ngay sau ca đêm luôn nghỉ không quét. Quét trên ca `OFF` có trong lượt gốc nhưng không tự được tính thành giờ làm hoặc OT theo chính sách hiện tại.

Giờ quét có dao động đến giây: người đúng giờ vào sớm tối đa 10 phút, ra muộn tối đa 10 phút; đi trễ phần lớn 16–25 phút (vượt ngưỡng 15 phút của chính sách), về sớm phần lớn 5–15 phút. OT thông thường chủ yếu 31–90 phút, tối đa 120 phút; trường hợp hiếm vượt ngưỡng là 241–300 phút. Khi giờ dự kiến còn ở tương lai, seed chuyển sang đúng giờ nếu phù hợp hoặc bỏ qua, không cắt cụt lượt quét. Kết quả được tái lập theo nhân viên + ngày; chạy lại cùng dữ liệu không tự xáo trộn tình huống.

**Đây là xác suất mục tiêu, không phải thống kê của công ty hoặc hạn ngạch bắt buộc.** Tỉ lệ thực tế dao động theo quy mô dữ liệu, lịch ca và trạng thái bảo vệ. Một ngày hoặc ít nhân viên có thể chỉ có tình huống bình thường; trường hợp hiếm không bị ép xuất hiện để làm sai phân bố. Cuối lần chạy có bảng số lượng, tỉ lệ mục tiêu/thực tế trên ngày làm vừa tạo và danh sách còn thiếu. Chọn khoảng đã kết thúc dài hơn để có nhiều ngày đủ điều kiện hơn.

## 6. “Xóa và tạo lại” khác “bỏ qua” thế nào?

| Seed | `overwrite` hoặc lựa chọn `1` | `skip` hoặc lựa chọn `2` |
| --- | --- | --- |
| Phân ca | Thay phân ca của nhân viên + ngày được chọn; giữ lượt quét hiện có và đánh dấu bản tổng hợp cũ cần tính lại | Nếu nhân viên + ngày đã có phân ca thì giữ nguyên |
| Check-in/out | Thay lượt quét, bản tổng hợp và khoản điều chỉnh của nhân viên + ngày được tạo lại; giữ phân ca | Có bất kỳ lượt quét, bản tổng hợp hoặc khoản điều chỉnh nào thì giữ nguyên toàn bộ ngày của nhân viên |

Cả hai chế độ đều giữ ngày đang khóa, ngày đã duyệt/điều chỉnh thủ công, khoản đã duyệt/từ chối và nhân viên có phiếu lương tháng đó không còn `PENDING`. Muốn thay dữ liệu được bảo vệ, xử lý trạng thái bằng quy trình nghiệp vụ của ứng dụng trước; seed không tự mở khóa hoặc hủy chốt lương.

Ngày công của ca đêm là **ngày bắt đầu ca**. Ví dụ ca 31/10 lúc 22:00 đến 01/11 lúc 06:00 thuộc ngày công 31/10; ghi đè chấm công ngày 01/11 sẽ giữ lượt check-out của ca 31/10.

Seed không tạo lượt quét tương lai và bỏ qua ca chưa kết thúc. Ví dụ chạy cho tháng đang diễn ra thì chỉ tạo dữ liệu đủ điều kiện đến thời điểm chạy. Chạy lại sau khi ca kết thúc để bổ sung phần trước đó được bỏ qua.

Các phiếu lương `PENDING` bị ảnh hưởng được đánh dấu cần tính lại. Mỗi lần chạy dùng một transaction: lỗi sẽ rollback cả lần chạy. Nên chạy seed trên DB phát triển/demo, khi không có tác vụ thu nhận chấm công thật chạy đồng thời.

## 7. Xem kết quả và xử lý lỗi thường gặp

Sau mỗi lần chạy, terminal in số bản ghi/ngày công được tạo, thay thế, bỏ qua, bảo vệ và bảng số lượng theo loại ca/kịch bản. Bảng đếm phản ánh **lần chạy vừa xong**, không phải toàn bộ dữ liệu đã có trong DB.

Mở ứng dụng để kiểm tra:

1. Trang phân ca: chọn đúng tháng đã tạo.
2. Trang theo dõi chấm công: chọn đúng ngày hoặc khoảng ngày, xem lượt quét và bản tổng hợp.
3. Kiểm tra các mục cần duyệt nếu có OT, thiếu lượt hoặc vi phạm.

Seed không tự duyệt công: ngày tạo mới ở trạng thái `NONE` hoặc `PENDING`. **Bảng lương chỉ cộng ngày công và khoản điều chỉnh đã `APPROVED`**, nên tính lương ngay sau seed có thể ra 0 giờ và chỉ còn phụ cấp. Với dữ liệu đã kiểm tra, Admin chọn khoảng ngày trên Theo dõi chấm công → **Chốt ca**, rồi quay lại Bảng lương chọn đúng tháng → **Tính lại lương**. Chốt ca áp dụng toàn bộ nhân viên trong ngày; đọc cảnh báo về thiếu lượt/vi phạm trước khi xác nhận.

Cron chốt lúc 00:05 VN, chạy bù sau khi khởi động backend và kiểm tra định kỳ 30 phút. Phần chạy bù xét mọi ngày công đã quá 00:05 hôm sau, kể cả bản tổng hợp tháng cũ vừa seed, không giới hạn hai tháng gần nhất. Sau khi seed dữ liệu quá khứ, chờ cron chạy bù trước khi tính lương; có thể khởi động lại backend để kích hoạt lượt chạy bù sau khoảng 10 giây. Ca qua đêm chưa kết thúc, công được mở khóa còn trong thời gian bảo vệ, và lương đã chốt/thanh toán vẫn được giữ nguyên. Cron xử lý các lô nhỏ và xét lại kỳ đang bận ở lần chạy sau. Seed không trực tiếp phê duyệt công.

| Thông báo / hiện tượng | Cách xử lý |
| --- | --- |
| Không có nhân viên `ACTIVE` | Tạo nhân viên đang hoạt động; chỉ dùng seed nền nếu DB chưa có dữ liệu nền |
| Không có lịch phân ca phù hợp | Chạy `prisma:seed:shifts` cho tháng chứa các ngày cần tạo |
| Nhiều ngày được bảo vệ | Kiểm tra khóa ngày, duyệt công, điều chỉnh thủ công và trạng thái lương |
| Chưa có chính sách phạt vắng được xác minh | Thiết lập chính sách hợp lệ cho kỳ lịch sử theo quy trình dự án; seed không tự sửa chính sách bất biến |
| Không tạo được đủ trường hợp | Mở rộng khoảng ngày đã kết thúc, kiểm tra số nhân viên và lịch ca đủ điều kiện |
| Chạy lại `skip` không thêm lượt quét | Ngày đã có dữ liệu sẽ được giữ nguyên; chọn `overwrite` nếu muốn thay cả ngày chưa được bảo vệ |
| Lỗi ngày/tháng | Dùng `YYYY-MM` hoặc `YYYY-MM-DD`, tháng/ngày phải tồn tại; không dùng `10/2026` hoặc `20/10/2026` |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` như các ví dụ trong tài liệu |
| Không kết nối được DB | Kiểm tra mạng, cấu hình `backend/.env` và chạy lệnh từ thư mục `backend` |

Xem cú pháp lệnh, không chạy seed hay truy cập database:

```powershell
npm.cmd run prisma:seed:shifts -- --help
npm.cmd run prisma:seed:attendance -- --help
```
