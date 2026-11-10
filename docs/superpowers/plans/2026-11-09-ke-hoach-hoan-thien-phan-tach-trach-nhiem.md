# Kế hoạch hoàn thiện phân tách trách nhiệm và kiểm thử

**Mục tiêu:** Xử lý các kiểm thử tích hợp còn lỗi, kiểm tra những ranh giới trách nhiệm còn rủi ro và có bằng chứng về phạm vi đã rà soát trước khi kết luận công việc hoàn tất.

**Kiến trúc đích:** Backend quyết định và lưu nghiệp vụ chấm công, ca làm, lương và phân quyền; frontend hiển thị, quản lý tương tác và có thể tính toán phục vụ trình bày nếu kết quả đó không quyết định nghiệp vụ. Frontend tổ chức theo feature; backend là modular monolith với phụ thuộc giữa module qua hợp đồng công khai và composition root.

**Công nghệ:** React/TypeScript ở frontend; Node.js/TypeScript, Prisma và PostgreSQL ở backend; Neon branch riêng cho kiểm thử tích hợp.

**Tài liệu liên quan:** `docs/superpowers/plans/2026-11-08-responsibility-and-module-boundaries.md`, `docs/architecture/payroll-boundaries.md`, `docs/architecture/responsibility-audit.md`.

## Hiện trạng và giới hạn bằng chứng

- Lần chạy Neon gần nhất đối với 10 nhóm kiểm thử có 43 test đạt và 7 test lỗi: 5 lỗi trong `adjustments.integration.test.ts`, 1 trong `business-rules.integration.test.ts`, 1 trong `ui-extension.integration.test.ts`. Sáu nhóm còn lại đã đạt trong lần chạy trước. Các test adjustment đã được chỉnh sau lần chạy gần nhất nhưng **chưa được chạy lại**, vì vậy chưa thể kết luận đã sửa xong hay vẫn còn lỗi.
- Các lần chạy frontend/backend thông thường trước đó đều đạt các test đã chạy, nhưng có 73 test backend bị bỏ qua do cần cơ sở dữ liệu. Kết quả đó không thay thế cho lần chạy đầy đủ trên Neon sau các thay đổi cuối cùng.
- Kiểm tra kiến trúc hiện có phát hiện một phần vi phạm import và quyền sở hữu model; chưa chứng minh được mọi đường import động, alias, raw SQL, quan hệ Prisma hoặc mọi entrypoint. Bản kiểm kê hiện tại là rà soát tự động, chưa đồng nghĩa từng file đã được đọc thủ công.
- Một số mục dưới đây là **rủi ro cần xác minh**, không phải khẳng định đã có lỗi thực tế. Sửa test chỉ khi đối chiếu được với quy tắc nghiệp vụ; không sửa production code chỉ để làm xanh test.

## Nguyên tắc thực hiện

1. Giữ nguyên các thay đổi chưa commit; đọc diff và ngữ cảnh trước mỗi sửa đổi. Không ghi lại hoặc công bố URL kết nối, mật khẩu hay token.
2. Chỉ dùng branch Neon thử nghiệm đã cấu hình trong `backend/.env.testing`. Bộ chạy tạo database tạm riêng và chỉ migrate/reset database đó; kiểm tra cơ chế chặn database ứng dụng và việc dọn dẹp. Không reset hay sửa dữ liệu ứng dụng.
3. Làm tuần tự các lần chạy Neon để tránh xung đột tài nguyên; lưu kết quả trong `backend/tmp/neon-test-results/`, kiểm tra log không lộ thông tin nhạy cảm. Nếu dọn database tạm thất bại, ghi nhận và xử lý đúng database tạm đó.
4. Ưu tiên test mô tả hành vi và dữ liệu đầu vào/đầu ra; không đưa cách tính lương hoặc quyết định chấm công về frontend để vượt qua test.

## 1. Chốt baseline và phân loại 7 lỗi tích hợp

**File:** `backend/validation/payroll/adjustments.integration.test.ts`, `backend/validation/integration/business-rules.integration.test.ts`, `backend/validation/integration/ui-extension.integration.test.ts`, `backend/validation/tools/run-neon-tests.mjs`, các log trong `backend/tmp/`.

- [ ] Đọc diff của ba suite và các log gần nhất; phân loại từng lỗi thành lỗi dữ liệu test, kỳ vọng cũ, lỗi nghiệp vụ hay lỗi môi trường. Ghi lại cả các chỉnh sửa test đã có nhưng chưa được kiểm chứng.
- [ ] Kiểm tra guard kết nối: nhận diện cả endpoint pooler/direct của database ứng dụng, từ chối database ứng dụng, tạo tên database tạm ngẫu nhiên và luôn thử dọn dẹp khi có lỗi. Chạy test guard hiện có.
- [ ] Chạy riêng ba suite sau trên Neon; giữ nguyên thứ tự và ghi lại số pass/fail/skip:

```powershell
cd backend
npm.cmd run test:neon -- validation/payroll/adjustments.integration.test.ts
npm.cmd run test:neon -- validation/integration/business-rules.integration.test.ts
npm.cmd run test:neon -- validation/integration/ui-extension.integration.test.ts
```

**Hoàn thành khi:** Có kết quả mới cho từng suite, không lộ kết nối và không để database tạm tồn đọng. Nếu lỗi khác xuất hiện, điều tra nguyên nhân trước khi chỉnh sửa.

## 2. Hoàn thiện test điều chỉnh lương và bất biến chấm công

**File:** `backend/validation/payroll/adjustments.integration.test.ts`; khi cần đối chiếu `backend/src/modules/payroll/`, `backend/src/modules/attendance/`, `backend/src/modules/shifts/`.

- [ ] Xác minh năm tình huống đã chỉnh nhưng chưa chạy lại: thông báo bảng lương cần tính lại; mở khóa chấm công trước khi sửa; bản tổng hợp nghỉ đã duyệt sau khi sửa dữ liệu; ghép lượt qua nửa đêm khi thời gian ứng dụng và `created_at` của database khác nhau; cập nhật hàng loạt sau khi đã duyệt.
- [ ] Tạo fixture thời gian nhất quán cho đồng hồ ứng dụng và timestamp thực lưu trong database. Không thay đổi đồng hồ hay dữ liệu production để phục vụ test.
- [ ] Kiểm tra test vẫn giữ ý nghĩa: sửa chấm công/ca sau duyệt phải qua luồng mở khóa được phép, có dấu vết thao tác, làm bảng lương cũ cần tính lại; không âm thầm ghi đè kết quả đã duyệt.
- [ ] Nếu phát hiện lỗi nghiệp vụ thật, viết test tái hiện trước, sửa tại module sở hữu quy tắc, sau đó chạy lại suite và test liên quan.

**Hoàn thành khi:** Năm tình huống đạt trên PostgreSQL thực, các kiểm tra về phân quyền, audit và tính nhất quán không bị bỏ hoặc làm yếu đi.

## 3. Thống nhất hiệu lực thay đổi mức lương giờ

**File:** `backend/validation/integration/business-rules.integration.test.ts`, `backend/src/modules/employees/employee.service.ts`, các phần đọc lịch sử trong module nhân viên và payroll, `backend/validation/employees/employee.scope.test.ts`.

- [ ] Đối chiếu quy tắc hiện hành: service ghi thay đổi lương giờ có hiệu lực từ kỳ lương kế tiếp, và test phạm vi nhân viên hiện cũng mô tả quy tắc đó. Test đang kỳ vọng mức tháng 10 khác kết quả database; cần xác nhận lịch sử dữ liệu trước khi sửa kỳ vọng.
- [ ] Với dữ liệu baseline 50.000 và thay đổi lần lượt cuối tháng 10, tháng 11, xác minh theo quy tắc trên rằng các kỳ tháng 10/11/12 lần lượt dùng 50.000/60.000/70.000. Nếu tài liệu nghiệp vụ hoặc dữ liệu lịch sử quy định khác, làm rõ và sửa quy tắc tại backend cùng các test liên quan, không tự chọn kỳ vọng cho qua test.
- [ ] Bổ sung hoặc xác minh test cho kỳ chưa tạo và kỳ đã chốt, nhiều lần đổi mức, múi giờ Việt Nam tại ranh giới tháng, giá trị 0 và trường hợp có mức ghi đè. Bảng lương lịch sử đã chốt không được tự thay đổi ngoài quy trình điều chỉnh hợp lệ.
- [ ] Chạy lại suite nghiệp vụ, test phạm vi nhân viên và các test payroll liên quan.

**Hoàn thành khi:** Quy tắc hiệu lực có một nguồn quyết định ở backend và kết quả từng kỳ được chứng minh bằng test có dữ liệu lịch sử thực tế.

## 4. Phân biệt lỗi xác thực và thiếu quyền trong API ca làm

**File:** `backend/validation/integration/ui-extension.integration.test.ts`, `backend/src/modules/auth/auth.service.ts`, middleware bảo vệ endpoint mẫu ca.

- [ ] Xác minh token tạo thủ công sau khi đổi mật khẩu không còn hợp lệ vì phiên bản token đã thay đổi; test token cũ phải nhận 401.
- [ ] Đăng nhập bằng mật khẩu mới để lấy phiên hợp lệ, dùng phiên nhân viên gọi API mẫu ca và xác nhận 403. Kiểm tra quản trị viên được phép theo hợp đồng, quản lý bị từ chối nếu chính sách hiện tại quy định như vậy.
- [ ] Không tắt kiểm tra phiên bản token, không ghi mật khẩu/token vào log, không thay chính sách phân quyền để sửa test.
- [ ] Chạy lại suite UI extension và test xác thực/đổi mật khẩu liên quan.

**Hoàn thành khi:** Test chứng minh riêng 401 cho phiên không hợp lệ và 403 cho phiên hợp lệ nhưng thiếu quyền.

## 5. Loại bỏ nguy cơ frontend tự suy đoán ngày công qua đêm

**File:** `frontend/src/features/attendances/hooks/useAttendancePairs.ts`, `frontend/src/features/attendances/api/attendanceApi.ts`, `frontend/src/types/attendance.types.ts`, `backend/src/modules/attendance/attendance.format.ts`, các luồng đọc/sự kiện chấm công, `frontend/validation/attendance/overnight-checkout.test.tsx`.

- [ ] Truy vết đầy đủ dữ liệu API compact, API thường, phân trang, socket và các màn hình/export có dùng bản ghi. Hook frontend hiện dùng các ngưỡng thời gian để suy đoán lượt qua đêm; trước tiên tạo test chứng minh trường hợp hiển thị khác `work_date` backend hoặc xác nhận rủi ro không xảy ra với hợp đồng hiện tại.
- [ ] Nếu cần thay đổi, backend trả `work_date` từ dữ liệu đã lưu theo định dạng ngày `YYYY-MM-DD`, với `null` rõ ràng khi bản ghi cũ không có giá trị; cập nhật các đường response và kiểu dữ liệu tương ứng. Không tự gán ngày lịch sử khi thiếu bằng chứng.
- [ ] Frontend dùng ngày backend cung cấp để nhóm và hiển thị. Với `null`, hiển thị bản ghi chưa xác định thay vì âm thầm ẩn hoặc tự quyết định ngày công; giữ đúng bộ lọc, phân trang và quyền truy cập.
- [ ] Test ca qua nửa đêm/cuối tháng, nhiều lượt checkout, không có ca hoặc check-in trước đó, `work_date` null, cập nhật realtime và không nhân đôi bản ghi. Kiểm tra hiển thị frontend khớp kết quả backend trong cùng fixture.

**Hoàn thành khi:** Quyết định ngày công có nguồn thẩm quyền rõ ràng ở backend; dữ liệu cũ không bị giấu và mọi đường response chịu ảnh hưởng được kiểm thử.

## 6. Củng cố snapshot lương, preview và composition

**File:** `backend/src/modules/payroll/payroll.absence-count.ts`, module payroll và attendance, `backend/src/composition.ts`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/prisma/`, frontend feature payroll và test liên quan.

- [ ] Kiểm tra snapshot số ngày nghỉ được duyệt: ngày nghỉ/ca OFF, dữ liệu chấm công chưa đầy đủ, ngày hiện tại, thay đổi sau khi tạo bảng lương, bản ghi lịch sử không có count và trạng thái cần tính lại. `null` phải được UI trình bày là chưa xác định, không chuyển thành 0 hoặc tự tính lại ở frontend.
- [ ] Kiểm tra preview không ghi dữ liệu; từ chối phiên bản bảng lương cũ và quyền không hợp lệ, xử lý input thiếu, lỗi mạng và kết quả trả về không theo thứ tự; khi ca/chấm công/điều chỉnh thay đổi, không hiển thị kết quả cũ như kết quả còn hiệu lực.
- [ ] Rà các entrypoint server, app test, script Prisma, seed, job/worker: mỗi nơi cần cổng liên module đều cấu hình composition trước khi dùng; thiếu cấu hình phải lỗi rõ ràng, không fallback im lặng.
- [ ] Test hợp đồng cổng, giao dịch liên module và rollback: lỗi ở bước sau không để dữ liệu ghi dở; giữ cùng transaction khi nghiệp vụ yêu cầu. Xác minh test không phụ thuộc thứ tự khởi tạo toàn cục.

**Hoàn thành khi:** Các tình huống cốt lõi có test đơn vị hoặc tích hợp phù hợp và không có entrypoint đang dùng phụ thuộc chưa cấu hình.

## 7. Rà soát từng file và siết ranh giới kiến trúc

**File:** `docs/architecture/responsibility-audit.md`, `frontend/validation/integration/feature-boundaries.test.ts`, `backend/validation/architecture/module-boundaries.test.ts`, `backend/validation/architecture/model-ownership.test.ts`, toàn bộ mã nguồn frontend/backend trong phạm vi kiểm kê.

- [ ] Lập sổ rà soát theo file hoặc nhóm file có danh sách file cụ thể: trách nhiệm, luồng dữ liệu, phụ thuộc, kết luận, bằng chứng/test, việc cần sửa hoặc lý do loại trừ. Đọc lần lượt thay vì đánh dấu toàn bộ dựa trên kết quả quét tự động; ưu tiên attendance, shifts, payroll, employees, authentication.
- [ ] Truy từ UI/API đến service và database đối với phép tính ảnh hưởng quyền, ngày công, tiền lương hoặc trạng thái duyệt. Tính trung bình, định dạng và nhóm dữ liệu thuần hiển thị có thể ở frontend nếu không trở thành nguồn quyết định nghiệp vụ; ghi rõ nơi sử dụng để phân biệt.
- [ ] Kiểm tra import sâu giữa feature, bao gồm `frontend/src/context/`, `frontend/src/api/index.ts` và entrypoint. Dùng public API khi phù hợp; ghi ngoại lệ có lý do và test, tránh tạo vòng phụ thuộc chỉ để mọi import đi qua barrel.
- [ ] Rà import tĩnh/động, alias và các quan hệ phụ thuộc module backend; mở rộng kiểm tra tự động ở những trường hợp công cụ có thể kiểm tra đáng tin cậy. Kiểm tra thủ công raw SQL, alias động, truy cập Prisma xuyên module và relation lồng nhau; không tuyên bố công cụ tĩnh bao phủ các trường hợp này nếu chưa có test chứng minh.
- [ ] Sửa các vi phạm xác nhận được tại module/feature sở hữu chức năng, giữ hợp đồng công khai và bổ sung test hành vi hoặc test ranh giới thực sự cần thiết.

**Hoàn thành khi:** Mọi file trong phạm vi đã có trạng thái đã rà soát hoặc loại trừ kèm lý do; các vi phạm xác nhận được đã xử lý hoặc được ghi riêng cùng ảnh hưởng và quyết định chấp nhận.

## 8. Kiểm thử cuối, đối chiếu và bàn giao

- [ ] Chạy toàn bộ test Neon sau khi hoàn tất sửa đổi, không chỉ chạy lại ba suite lỗi:

```powershell
cd backend
npm.cmd run test:neon
```

- [ ] Xác nhận toàn bộ suite tích hợp dự kiến được phát hiện, không fail và không skip ngoài trường hợp được giải thích, đồng thời database tạm được dọn. So sánh số lượng test thực tế với baseline; điều tra test biến mất.
- [ ] Chạy test backend thông thường, kiểm tra kiến trúc, build backend và TypeScript của Prisma; chạy test, lint và build frontend theo script trong từng `package.json`. Dùng các lệnh thực tế của repository, ghi kết quả và lý do nếu môi trường không hỗ trợ.
- [ ] Kiểm tra thủ công một luồng chấm công qua đêm, duyệt/mở khóa và tính lại lương, preview cùng phiên hết hạn hoặc thiếu quyền; đối chiếu UI với response backend và dữ liệu thử nghiệm.
- [ ] Cập nhật tài liệu kiến trúc và sổ rà soát với bằng chứng, các ngoại lệ, các giới hạn kiểm tra và hướng dẫn chạy Neon an toàn. Đọc diff cuối để phát hiện thay đổi ngoài phạm vi hoặc thông tin nhạy cảm.
- [ ] Nếu cần triển khai, chuẩn bị phương án quay lại phiên bản mã trước và kiểm tra tương thích hợp đồng API. Kế hoạch này không yêu cầu migration dữ liệu production; nếu phát sinh migration, phải lập riêng phương án chuyển đổi và khôi phục trước khi chạy.

**Tiêu chí bàn giao:** Ba suite từng lỗi và toàn bộ bộ kiểm thử liên quan đạt trên phiên bản mã cuối; test tích hợp có database thật chạy đầy đủ; build/lint đạt; sổ rà soát hoàn tất; mọi rủi ro còn lại được nêu rõ và không có kết luận vượt quá bằng chứng.
