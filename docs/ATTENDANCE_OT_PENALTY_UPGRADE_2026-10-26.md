# Nâng cấp chấm công, ca đêm và duyệt từng khoản OT/phạt

Rule chính thức đã đồng bộ trong [docs/rule/COMPANY_POLICY.md](rule/COMPANY_POLICY.md), phiên bản `2026-10-26-v5`.

Ngày: 26/10/2026. Nhánh: `feat/attendance-daily-adjustments`.

## 1. Phân tích luồng cũ và vấn đề

- Backend ghép log theo thời gian và tổng hợp vào `daily_attendance_summary`; payroll tổng hợp theo tháng. Đã có giới hạn cặp 24 giờ, rule nửa ca và duyệt OT ở cấp tổng hợp ngày.
- Frontend tổng quan tự chọn log vào đầu/ra cuối của ngày lịch, có thể dùng lượt ra không được ghép cặp, hoặc nhầm lượt ra thành lượt vào khi không có checkin.
- Có cộng nhiều khoảng làm việc nhưng chưa quy thuộc lượt quay lại sau nửa đêm về ca đêm hôm trước; ranh giới ngày/tháng dễ khiến tổng hợp và giao diện lệch nhau.
- Chưa có khoản phạt vắng ca, và chưa có sổ khoản OT/phạt riêng để ghi quyết định, ghi chú và kiểm soát thay đổi nguồn.
- Tổng phạt trễ/sớm được đưa vào lương trực tiếp. Giao diện sửa tổng kỳ cho phép ghi đè OT/phạt, không phản ánh quyết định từng ngày.

## 2. Rule được thống nhất

| Nội dung | Cách xử lý |
|---|---|
| Phạt vắng | `Số giờ ca chính xác × lương giờ nhân viên × 0,25`, làm tròn tiền đến đồng. Ví dụ ca 8h, lương 100.000 đ/h → đề xuất phạt 200.000 đ. |
| Tỷ lệ vắng | Admin có thể chỉnh riêng trong cấu hình thưởng/phạt; mặc định 25% tiền công ca. |
| Điều kiện đề xuất vắng | Có ca làm hợp lệ, ca đã kết thúc, không OFF, không ca 0 giờ, không có lượt ghi nhận thuộc ca cần xác minh. |
| Nghỉ có phép | Manager chọn **Không duyệt** khoản vắng của đúng ngày và ghi chú, ví dụ “Nghỉ có phép”. Không cần xóa log hay chỉnh cả tổng tháng. |
| Vào/ra nhiều lần | Cộng thời gian các cặp hợp lệ trong ca để kiểm tra nửa ca. Không tính khoảng ra ngoài giữa các cặp thành phạt trễ/sớm. |
| Rule nửa ca | Giữ rule hiện tại: thực tế trong ca đạt ít nhất 1/2 ca thì được công cả ca; dưới nửa ca có 0 công/OT tự động và cần xác minh. Không tự biến ca thiếu log/dưới nửa ca thành phạt vắng. |
| Trễ/sớm | Tính đầu/cuối ca từ các cặp thực tế; khoản đề xuất phạt cần duyệt riêng. Khoảng nghỉ giữa ca không cộng vào khoản này. |
| OT | Tính ngoài giờ kết thúc ca từ cặp hợp lệ, giữ điều kiện tổng OT thô **lớn hơn** 30 phút và làm tròn sau khi cộng. Mỗi ngày có một khoản OT được duyệt riêng, độc lập với phạt. |
| Làm tròn giờ | Giữ rule phần giờ: dư 0–29 phút bỏ phần dư; dư 30–59 phút cộng 0,5 giờ. Không làm tròn từng cặp rồi cộng. |
| Cặp không hợp lệ | Không ghép qua lượt INVALID/FLAGGED; IN liên tiếp dùng IN sau; OUT lẻ không tạo giờ công; cặp tối đa 24h. |
| Tổng quan theo ca | Lượt vào sớm nhất thuộc cặp có IN trong khoảng từ 1h trước ca đến hết ca; lượt ra cuối cùng có ghép cặp của ngày ca, kể cả cặp OT tách riêng sau ca. Toàn bộ log vẫn giữ trong chi tiết. |
| Ca đêm | Ca có giờ kết thúc nhỏ hơn giờ bắt đầu kéo sang ngày sau. Lượt quay lại sau 0h trong cửa sổ ca vẫn thuộc ngày bắt đầu ca. |
| Tiền lương | Công cơ bản + OT đã duyệt − trễ/sớm đã duyệt − phạt vắng đã duyệt + phụ cấp, chặn dưới tại 0. |

**Ví dụ ca đêm:** ca 30/09 22:00 → 01/10 06:00, các cặp 22:00→01:00 và 01:30→07:00 đều thuộc ca 30/09. Thực tế trong ca 7,5h, đạt nửa ca nên công ngày 8h; OT đề xuất 1h ở ngày 30/09, chưa được trả cho tới khi duyệt. Khoảng 01:00→01:30 không bị phạt. Dữ liệu này không được cộng lại sang công tháng 10.

## 3. Backend và database thay đổi gì

### Sổ khoản duyệt `attendance_adjustments`

Mỗi nhân viên/ngày ca/loại có một khoản, có khóa duy nhất để chạy tổng hợp lại không tạo trùng:

- `kind`: `OVERTIME`, `LATE_EARLY`, `ABSENCE`.
- `hours`: số giờ OT/phạt trễ-sớm; với vắng là số giờ ca làm căn cứ tính tiền.
- `amount`: tiền phạt vắng được chụp tại lần tính nguồn. Tiền OT/trễ-sớm hiển thị được tính từ `hours` và đơn giá snapshot của phiếu lương; nếu chưa có phiếu thì dùng cấu hình hiện tại. Không dùng cột `amount` của hai loại này để trả/trừ lương.
- `status`: `PENDING`, `APPROVED`, `REJECTED`, `VOID` (nguồn thay đổi khiến khoản không còn phát sinh).
- `note`, `reviewed_by`, `reviewed_at`, thời điểm tạo/cập nhật.
- `source_fingerprint`, `source_details`: dấu vết nguồn và căn cứ tính. Thay đổi log/ca ảnh hưởng khoản duyệt sẽ hủy hiệu lực quyết định cũ, đưa về chờ duyệt hoặc VOID và ghi audit. Ghi chú cũ vẫn giữ để tham khảo.

Bảng lương thêm `total_absence_penalty`; bảng chính sách thêm `absence_penalty_rate` mặc định `0.25`.

Migration mới:

1. `backend/prisma/migrations/20261026100000_daily_attendance_adjustments/migration.sql`: bảng khoản duyệt, ràng buộc, chỉ mục và hai cột tính lương/chính sách.
2. `backend/prisma/migrations/20261026110000_employee_fingerprint_flag/migration.sql`: thêm `fingerprint_enrolled` nếu chưa có. Cột này đã tồn tại trong Prisma schema cũ nhưng thiếu trong lịch sử migration; phát hiện khi cài database thử mới hoàn toàn. Không triển khai tính năng vân tay mới.

Đây là migration bổ sung. Không xóa bản ghi nghiệp vụ và không sửa file migration đã phát hành trước đó. Kỳ lương đã chốt/đã trả và ngày đã khóa được giữ nguyên; việc áp rule mới cho kỳ đã khóa cần mở khóa bằng quy trình hiện có.

### Ghép cặp và tổng hợp

- `backend/src/modules/attendance/attendance.policy.ts`: chuẩn hóa cửa sổ ca, quy thuộc ngày công theo ca, nhiều cặp qua đêm, điều kiện vắng, giờ thực tế từng cặp và cờ được tính giờ. Policy version mới `2026-10-26-v5`.
- `attendance.service.ts`: đọc log/ca lân cận ranh giới ngày/tháng; sau lượt quét tính lại cả ngày sở hữu checkin và ngày lịch bị ảnh hưởng, không phải đợi cron ngày mới. Khi ca nhân viên không có giờ override, dùng giờ của mẫu ca.
- Cron giữ chu kỳ hiện có 30 phút, tổng hợp tháng trước và tháng hiện tại; có tác dụng cập nhật ca không có lượt quét. Không kết luận vắng khi mới qua 0h mà ca đêm chưa kết thúc.
- `attendance.adjustments.ts`: đồng bộ sổ khoản trong cùng transaction với tổng hợp, đọc sổ một lần và gom tạo mới để giảm truy vấn DB cloud.
- Không còn nuốt lỗi upsert tổng hợp; tránh chạy cả upsert riêng từng dòng lẫn batch SQL ở production.
- Khóa ngày kiểm tra ca chưa kết thúc, ngày cần xác minh, OT/phạt chờ duyệt. Chốt lương tổng hợp lại dữ liệu, kiểm tra pending và dấu vết nguồn để không chốt từ tổng cũ.

### Duyệt và tính lương

- `GET /api/payroll/adjustments?period=YYYY-MM&employeeId=...`: khoản chi tiết theo tháng, có thể lọc nhân viên.
- `PATCH /api/payroll/adjustments/:id`: gửi `status: APPROVED|REJECTED`, `note` tùy chọn và `updated_at` từ bản đang xem. Có kiểm tra dữ liệu đã thay đổi, phân quyền và khóa kỳ/ngày.
- Manager chỉ duyệt nhân viên thuộc phòng mình, không tự duyệt và không duyệt manager khác. Admin giữ quyền quản trị theo hệ thống hiện tại. Employee chỉ đọc khoản của bản thân.
- `payroll.adjustments.ts`: quyết định từng khoản và audit trong cùng transaction; từ chối ghi đè nếu bản dữ liệu đã cũ.
- `payroll.service.ts`, `common/utils.ts`: chỉ cộng các khoản APPROVED, thêm khấu trừ vắng, chụp fingerprint của sổ khoản vào phiếu lương. Có thay đổi quyết định phải tính lại lương trước khi chốt.
- Không sửa tổng OT/phạt tháng để vượt qua quy trình duyệt. Chỉnh tay lương cơ bản/giờ công/phụ cấp vẫn giữ; lần tính lại sau đó vẫn cập nhật OT/phạt đã duyệt, không bỏ qua cả phiếu chỉnh tay như trước.
- Form điều chỉnh ngày công lưu **đề xuất** OT/trễ-sớm và lý do. Sau đó duyệt từng khoản trong mục OT/phạt; lưu đề xuất không đồng nghĩa đã duyệt.
- Khi chuyển đổi, quyết định OT ngày cũ đã APPROVED/REJECTED được kế thừa nếu nguồn chưa bị thay đổi; các khoản phạt mới cần manager duyệt. Nguồn thay đổi hoặc cần tính lại theo policy mới có thể đưa khoản về chờ rà soát.

## 4. Frontend thay đổi gì và dùng như thế nào

### Trang bảng lương quản lý

1. Chọn kỳ, dùng **Tính lương** để tổng hợp/cập nhật các khoản.
2. Mục **Duyệt OT và các khoản phạt** hiển thị tổng theo nhân viên: số khoản chờ, OT đã duyệt, tiền phạt đã duyệt và tổng khoản chờ.
3. Mở nhân viên: mỗi dòng là một khoản của một ngày; nhập ghi chú rồi chọn **Duyệt khoản này** hoặc **Không duyệt**. OT và phạt cùng ngày là hai quyết định độc lập.
4. Duyệt xong, **Tính lương** lại, kiểm tra tổng, rồi mới chốt kỳ. Không còn nhập đè tổng OT/phạt trong modal sửa lương.
5. Khoản của ngày/kỳ đã khóa hiển thị để xem, không có nút duyệt.
6. Có cấu hình tỷ lệ phạt vắng và cột phạt vắng trong bảng lương/CSV.

Các file chính: `AdjustmentReviewPanel.tsx`, `ManagerPayroll.tsx`, `PayrollPolicyModal.tsx`, `PayrollItemEditModal.tsx`, `PayrollTable.tsx`, API/types/context/hook payroll.

### Chi tiết nhân viên và tổng quan chấm công

- Hồ sơ nhân viên → nhật ký chấm công → mở từng ngày để xem tất cả cặp và toàn bộ lượt ghi nhận.
- Chọn bộ lọc **Tất cả lượt**, **Chỉ lượt ghép cặp hợp lệ**, hoặc **Chỉ lượt được ghép cặp và tính giờ**. Lượt ghép cặp hợp lệ vẫn xem được khi OFF/dưới nửa ca; lọc được tính giờ chỉ giữ cặp đủ điều kiện. Mỗi bộ lọc giữ cả IN/OUT của cặp.
- Dòng checkout ghi thời gian thực tế trong ca của cặp, và OT đủ điều kiện đề xuất. OT này chưa đồng nghĩa được trả lương.
- Hiển thị ngày đầy đủ ở lượt quét, nên checkout ngày hôm sau không bị hiểu thành cùng ngày checkin.
- **Giờ thực tế của cặp** khác **công trả lương ghi tại checkout**. Công cả ca ghi một lần ở checkout đầu tiên đưa tổng thực tế đạt nửa ca; các checkout sau không cộng trùng. JSON từng cặp lưu `credited_regular_seconds` và `credit_reason`; tổng công ghi tại các checkout bằng công ngày.
- Tổng quan sử dụng mốc giờ do backend tính; mở chi tiết được cả ngày chỉ có một lượt/lượt lẻ. Nhận diện ca qua đêm qua khung giờ ca.
- Có cùng mục xem/duyệt khoản ngày trong hồ sơ nhân viên. Mục này lấy **tháng của ngày bắt đầu bộ lọc**, nếu không chọn thì tháng hiện tại; để xem tháng khác hãy đổi ngày bắt đầu. Nhật ký vẫn lọc theo toàn khoảng ngày đã chọn.
- Phiếu lương/lịch sử/ước tính nhân viên bổ sung phạt vắng, dùng đơn giá snapshot của phiếu, và giữ đúng trường hợp thực lĩnh bằng 0.

Các file chính: `AttendanceDayDetails.tsx`, `useAttendancePairs.ts`, `useAttendanceSummaries.ts`, `AttendanceTable.tsx`, `EmployeeAttendanceTab.tsx`, `EmployeePayrollTab.tsx`, `EmployeePayslipModal.tsx`, `useEmployeePayrollDetail.ts`, `EmployeeSalaryEstimate.tsx`.

## 5. Lỗi tình cờ phát hiện và đã sửa

| Lỗi | Tác dụng sửa |
|---|---|
| OUT lẻ bị dùng làm IN; giờ tổng quan lấy OUT cuối dù không ghép cặp | Tổng quan dùng dữ liệu backend, log lẻ chỉ hiện ở chi tiết. |
| Frontend đọc `needs_review` trong khi API trả `requires_review` | Hiện đúng cờ cần xác minh. |
| Cột `fingerprint_enrolled` thiếu migration | Database dựng từ lịch sử migration đọc được Employee theo schema hiện tại. |
| Mất cập nhật OT/phạt ở phiếu đã chỉnh tay | Tính lại vẫn cập nhật khoản duyệt, giữ phần chỉnh tay của công/lương/phụ cấp. |
| Đơn giá phạt trên một số phiếu lấy nhầm tên trường | Dùng `late_penalty_rate` đã snapshot để hiển thị đúng phiếu cũ. |
| Ước tính dùng fallback khi thực lĩnh là 0 | Dùng kiểm tra tồn tại thay vì truthy. |
| Thống kê độ tin cậy tự điền điểm khi không có số đo | Không tạo điểm AI giả từ log thiếu điểm. |
| Phát socket nhiều lần từ controller/service/domain event, gửi room cá nhân sai trường | Giảm phát trùng; hỗ trợ `employee_user_id`; union các room gửi một lần cho người nhận thuộc nhiều room; retry transport không phát thêm lượt quét mới. |
| Test thông báo còn đòi chữ tiếng Anh; test Socket.IO dùng đường dẫn module cũ; test giờ công còn kỳ vọng rule cũ | Đồng bộ test với giao diện tiếng Việt, vị trí gateway hiện tại và rule cả ca đã có trước thay đổi này. |

## 6. Kiểm chứng đã chạy

- Prisma generate và TypeScript backend; TypeScript frontend; frontend production build.
- Backend: **115 tests passed**, gồm PostgreSQL thật ở database `policy_check` tạm riêng (cổng 55439) và Socket.IO localhost.
- Frontend: **28 tests passed**, gồm tương tác React/DOM cho bộ lọc lượt được tính giờ, checkout qua đêm, mở tổng theo nhân viên và chỉ gửi quyết định cho khoản được chọn.
- Database kiểm thử được dựng mới từ toàn bộ 8 migrations; không dùng database ứng dụng/cloud để test. Có kiểm thử nhánh SQL batch dùng ở production.
- Các tình huống đã kiểm: 25% tiền công ca, duyệt/từ chối và giữ ghi chú, chỉ khoản đã duyệt vào lương, chặn bản duyệt cũ, khóa kỳ, nguồn đổi làm khoản VOID, nhiều cặp qua 0h/xuyên tháng, lượt quét trực tiếp cập nhật ngày/tháng trước, ngăn khóa ca chưa kết thúc, quyền manager/self/peer/phòng ban, rollback khi audit lỗi.
- Thông báo lỗi FK ở ca test rollback là lỗi được chủ động tạo để chứng minh transaction rollback; test đó PASS.
- Docker build backend/frontend thành công với tag thử riêng `pbl6-backend:attendance-adjustments-check` và `pbl6-frontend:attendance-adjustments-check`; không thay tag/container ứng dụng đang chạy.
- Chưa kiểm chứng bằng Pi/camera thật, phiên người dùng trên cloud hoặc đo hiệu năng DB cloud. Kiểm thử frontend là React/DOM, chưa phải nghiệm thu giao diện trong browser thật.

## 7. Cập nhật database cloud

### Chuẩn bị

1. Backup/snapshot database bằng công cụ của nhà cung cấp; chọn khung bảo trì, tạm dừng thao tác chấm công/duyệt khi chuyển phiên bản.
2. Dùng checkout của nhánh trên cùng các migration mới. Không ghi URL/mật khẩu vào Git, tài liệu hoặc ảnh chụp.
3. Trong `backend/.env`: `DATABASE_URL` là kết nối runtime cloud; `DIRECT_URL` là endpoint trực tiếp cho migration tới **cùng database/schema**. Nếu provider dùng pooler cho runtime, lấy direct endpoint theo cấu hình của provider. Đây là dự án Prisma 5.22 đang khóa bằng package-lock; không nâng Prisma theo hướng dẫn của phiên bản mới khác.
4. Cloud stack hiện tại là `docker-compose.cloud.yml`, chạy riêng file này. File `docker-compose.yml` dành cho database local có thể override `DATABASE_URL` sang container `postgres`; không trộn hai stack khi muốn cập nhật cloud.

Các file mẫu đã được cập nhật: `backend/.env.example` thêm `DIRECT_URL` và hướng dẫn endpoint cloud; `.env.compose.example` phân biệt cấu hình cloud/local; `frontend/.env.example` giải thích Socket.IO cùng origin và biến Vite tại thời điểm build. Không chép đè file `.env` thật đang sử dụng; chỉ bổ sung biến còn thiếu. Các rule OT/phạt mới không cần biến môi trường mới: tỷ lệ phạt vắng nằm trong `bonus_penalty.absence_penalty_rate`, mặc định `0.25` sau migration và chỉnh qua giao diện Admin.

### Cách A: migrate qua máy triển khai đã có Node

Chạy từ thư mục gốc repo, sau khi đã kiểm tra `.env` trỏ đúng cloud:

```bash
npm ci --prefix backend
cd backend
npx prisma migrate status
npm run prisma:migrate
npm run prisma:generate
npx prisma migrate status
cd ..
```

`prisma:migrate` của repo là `prisma migrate deploy`: áp dụng migration đang chờ theo lịch sử. Theo [tài liệu Prisma về deploy migration](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate), nên đưa bước này vào quy trình triển khai; ở đây có thể chạy thủ công có kiểm soát với phiên bản đã khóa của repo.

Không chạy `migrate reset`, `db push --accept-data-loss` hay seed để cập nhật cloud. Seed hiện tại là dữ liệu nghiệp vụ mẫu, không cần cho nâng cấp này. Nếu migrate báo lịch sử khác hoặc migration đã từng sửa tay, dừng để đối chiếu trạng thái; không tự đánh dấu migration “đã áp dụng” khi chưa kiểm tra SQL.

### Cách B: migrate bằng image Docker đã build

Thực hiện theo mục 8: build image mới trước, dùng container one-off của backend để chạy migration, sau đó mới thay container backend/frontend. Không chạy cả A và B như hai quy trình khác nhau; chọn một cách migrate.

## 8. Build lại Docker cho cloud stack

Từ gốc repo. `.env.compose` giữ cấu hình port/runtime đang dùng; URL cloud vẫn lấy từ `backend/.env` theo file compose cloud.

```bash
# Build code/schema mới, chưa restart dịch vụ đang chạy.
docker compose --env-file .env.compose -f docker-compose.cloud.yml build backend frontend

# Kiểm tra lịch sử migration bằng cấu hình cloud của backend.
docker compose --env-file .env.compose -f docker-compose.cloud.yml run --rm --no-deps backend npx prisma migrate status

# Chỉ chạy sau khi đã backup và xác nhận DATABASE_URL / DIRECT_URL đúng cloud.
docker compose --env-file .env.compose -f docker-compose.cloud.yml run --rm --no-deps backend npm run prisma:migrate

docker compose --env-file .env.compose -f docker-compose.cloud.yml run --rm --no-deps backend npx prisma migrate status

# Thay hai container ứng dụng; các dịch vụ phụ thuộc hiện có cần đang chạy/khỏe.
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --no-deps backend frontend

docker compose --env-file .env.compose -f docker-compose.cloud.yml ps
docker compose --env-file .env.compose -f docker-compose.cloud.yml logs --tail=100 backend frontend
curl --fail http://127.0.0.1:3000/health
```

Lệnh `run --rm --no-deps` tạo container one-off theo env của service, không khởi động lại Face Auth/MQTT; `up -d` tạo lại container khi image thay đổi và giữ volume, theo [Docker run](https://docs.docker.com/reference/cli/docker/compose/run/) và [Docker up](https://docs.docker.com/reference/cli/docker/compose/up/). Nếu dùng port backend khác, thay `3000` theo `.env.compose`.

Nếu toàn stack đang dừng, sau khi migrate thành công dùng `up -d` với cùng file cloud để khởi động phụ thuộc. Không dùng `down -v`; không cần build lại Face Auth/Pi/ThingsBoard cho thay đổi nghiệp vụ này.

### Sau triển khai

1. Reload frontend; đăng nhập Admin/Manager, chọn kỳ đang mở, dùng **Tính lương** để sinh lại tổng hợp và sổ khoản.
2. Kiểm tra nhân viên có ca 8h vắng: đề xuất bằng 25% công ca; từ chối với ghi chú nghỉ phép thì không trừ lương.
3. Kiểm tra ca đêm có nhiều lượt ra/vào; checkout sáng hôm sau hiện ở chi tiết ngày bắt đầu ca, không cộng trùng ngày/tháng mới.
4. Bật/tắt bộ lọc lượt tính giờ; đối chiếu dòng checkout với từng cặp và công ngày theo rule nửa ca.
5. Duyệt riêng OT và phạt, tính lại lương, xác minh tổng tiền rồi chốt. Khoản đang chờ phải chặn chốt.
6. Với dữ liệu ca đêm cũ đã khóa/chốt sai từ trước, Admin cần mở khóa theo quy trình hiện có rồi tổng hợp lại; hệ thống không tự sửa phiếu đã trả.

## 9. Trạng thái bàn giao

Mã nguồn, migration, test và tài liệu của đợt này được quản lý trên nhánh `feat/attendance-daily-adjustments`. Phần chẩn đoán cloud và bản sửa checkout bổ sung được ghi ở mục 10; kết quả build/test không tự xác nhận bản sửa đã được triển khai vào container đang chạy. Các thay đổi `.vscode/settings.json` và `docs/presentation_2026-10-25/` có sẵn trước phiên này được giữ ngoài commit nghiệp vụ.


## 10. Bổ sung: ghi công ngay sau checkout và sửa hiển thị lịch sử (26/10)

### Nguyên nhân đã xác minh từ hệ thống đang chạy

- Backend đang chạy policy v5, nhưng log cron có lỗi transaction `P2028`: giới hạn 60.000ms, commit sau 87.389ms nên rollback. Các bản tổng hợp vẫn ở v4. Đây là bằng chứng lỗi tổng hợp trên cloud, không phải nhân viên phải chờ qua ngày mới.
- Với ảnh ngày 25/10, DB lưu hai cặp ngắn hợp lệ nhưng đó là ngày OFF, công bằng 0. Với ảnh ngày 26/10 07:52:43→17:47:36, DB đã ghi 10h công, `meetsHalfShift=true`; JSON cặp v4 chưa có trường `counted`/giây công chi tiết. Giao diện cũ mặc định các trường thiếu thành false/0 nên báo “Chưa tính công” sai.
- Chỉ đọc dữ liệu và log để xác minh, không tạo dữ liệu test hoặc tính lại thủ công trên cloud trong quá trình sửa này.

### Cách sửa

1. Tổng hợp checkout chỉ đọc đúng nhân viên/ngày cần cập nhật và cửa sổ log/ca lân cận để ghép xuyên đêm; không tải cả tháng rồi mới lọc ngày. Các ngày liên quan vẫn được cập nhật trước phản hồi thành công; response có `summaries` chứa tổng công đã commit, OT chưa duyệt vẫn bằng 0 ở trường `overtime`.
2. Gom cả INSERT/UPDATE khoản OT/phạt và audit thành batch. Trước đó bản ghi đã tồn tại vẫn upsert/audit riêng từng khoản, có thể gây hàng trăm lượt DB trong một transaction. Test xác minh 100 khoản thay đổi chỉ dùng một lệnh upsert batch và một lệnh audit batch. Không chỉ tăng timeout để che lỗi.
3. `attendance.details.ts` tính `credited_regular_seconds` theo từng checkout: khi lần đầu đạt nửa ca thì ghi công cả ca, những lượt sau ghi thêm 0; thời gian thực tế và OT được trình bày riêng. Không thay rule nửa ca hoặc tự duyệt OT.
4. API đọc tổng hợp chiếu thêm metadata từ căn cứ đã lưu cho JSON v4, gồm cả ngày đã khóa, **không ghi lại database hay đổi số công/quyết định đã lưu**. Không mặc định trường thiếu là chưa tính công.
5. Trang chi tiết nhân viên có nút **Xem lịch sử checkin / checkout** ở tab tổng quan và lịch sử ở tab Nhật ký chấm công. Truy vấn log theo riêng nhân viên/khoảng ngày, tải các trang đầy đủ; ngày mới nhất mở sẵn. Có bộ lọc chung ba chế độ; row checkout luôn có thời lượng cặp, thời gian hợp lệ và công ghi nhận nếu đã có kết quả.
6. Không để snapshot tổng hợp cũ che log mới: giữ các raw log vừa đến, hiển thị trạng thái chờ tổng hợp khi chưa có kết quả; lỗi tải summary phải được báo thay vì âm thầm kết luận không có cặp.
7. Metadata có `details_version=2`; nâng metadata đơn thuần không làm mất quyết định duyệt khi nguồn tính công không đổi.

Ví dụ ca 08:00–18:00, cặp 07:52:43→17:47:36: thời gian trong ca là 09:47:36; công ghi nhận tại checkout là +10:00:00 vì đạt nửa ca. Nếu nhiều cặp, công 10h chỉ ghi tại checkout đầu tiên đạt ngưỡng, không ghi lại 10h ở mỗi lượt ra.

### Áp dụng bản sửa bổ sung

Không có migration hoặc biến môi trường mới cho phần bổ sung này. Cần build và thay **cả backend/frontend** để API trả metadata mới và giao diện đọc đúng:

```bash
docker compose --env-file .env.compose -f docker-compose.cloud.yml build backend frontend
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --no-deps backend frontend
docker compose --env-file .env.compose -f docker-compose.cloud.yml logs --tail=100 backend
```

Sau đó reload frontend, mở Chi tiết nhân viên → Nhật ký chấm công. API đã hiển thị được công từ bản tổng hợp v4 ngay cả trước khi cron ghi lại metadata. Theo dõi log cron để xác minh lần tổng hợp cloud mới hoàn tất; không tự kết luận hiệu năng cloud đã được nghiệm thu từ test local. Không dùng reset/seed hoặc sửa các mốc raw log để chữa lỗi hiển thị.
