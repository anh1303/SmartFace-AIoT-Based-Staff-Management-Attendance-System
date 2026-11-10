# Kế hoạch cập nhật giao diện tức thì và xử lý nền

> Trạng thái: đề xuất để review, chưa triển khai. Dùng superpowers:executing-plans khi triển khai từng task; không tự động triển khai từ tài liệu này.

**Goal:** Người dùng tiếp tục thao tác trong khi request đang chạy, nhìn rõ dữ liệu đang lưu và chỉ nhận thông báo thành công khi server xác nhận.

**Architecture:** Thao tác nhỏ dùng optimistic UI trên React Query, backend vẫn kiểm tra và commit trước khi trả thành công. Copy/phân lịch hàng loạt và enrollment khuôn mặt dùng job bền vững trong PostgreSQL, trả `202` sau khi lưu job; worker thực hiện, FE theo dõi qua Socket.IO và GET dự phòng.

**Tech Stack:** React, TanStack Query v5, Express, Prisma, PostgreSQL, Socket.IO, dịch vụ Python face_auth hiện có. Chưa cần thêm Redis/BullMQ.

## 1. Kết quả kiểm tra mã hiện tại

| Luồng | Hiện trạng | Nút thắt / vấn đề |
|---|---|---|
| Thêm nhân viên | `useEmployees.ts` gọi POST; controller await service; service tạo user + employee trong transaction, rồi await audit và gửi email | Request chờ cả email; success hook invalidate danh sách thay vì thêm kết quả vào cache |
| Modal thêm nhân viên | `ManagerEmployeeList.tsx:176` gọi `addEmployee()` dùng mutate rồi đóng modal ngay | FE đã không chờ ở modal, nhưng chưa có dòng pending hay khôi phục bản nháp khi thất bại |
| Sửa nhân viên | PUT → kiểm tra quyền/nghiệp vụ → transaction → response → invalidate employees | Chưa có optimistic update; dữ liệu thường chỉ đổi sau một lần GET nữa |
| Sửa khuôn mặt | FE await enroll-images → Express await `/internal/enroll` → Python trích vector và ghi DB → Express audit → trả kết quả | Chờ inference; sau đó FE gọi thêm PUT avatar không await; hai cập nhật không nguyên tử |
| Xóa khuôn mặt | FE await DELETE rồi gọi updateEmployee với `face_enrolled: false` | API updateEmployee không serialize face_enrolled; request thứ hai không làm việc như tên gọi gợi ý, cần refresh nguồn sinh trắc học đúng |
| Vân tay | Hook mô phỏng lấy mẫu bằng setTimeout; lưu bằng PUT fingerprint_enrolled | Toast thành công được phát trước khi PUT hoàn tất; chưa phải luồng lấy mẫu phần cứng thật |
| Copy tuần trước / phân lịch hàng loạt | `ManagerSchedule.tsx` lặp nhân viên × ngày, await từng POST; mỗi thành công invalidate shifts | Nhiều round trip và invalidation; chưa có một lệnh copy tại backend |
| Ghi một ca | Backend transaction kiểm tra quyền, trạng thái, ngày khóa/kỳ lương, ca liền kề; lưu ca + audit + tổng hợp chấm công các ngày liên quan | Có xử lý nghiệp vụ thật trong đường request; không được bỏ để làm UI nhanh |

Nguồn chính: `frontend/src/features/employees/hooks/useEmployees.ts`, `frontend/src/features/employees/api/employeeApi.ts`, `frontend/src/features/biometrics/hooks/useBiometricEnrollment.ts`, `frontend/src/features/schedules/hooks/useShifts.ts`, `frontend/src/pages/manager/ManagerSchedule.tsx`, `backend/src/modules/employees/employee.service.ts`, `backend/src/modules/biometrics/biometric.service.ts`, `backend/src/modules/shifts/shift.service.ts`, `face_auth/api_service.py`, `face_auth/database/vector_db.py`.

Đã có socket cho attendance/devices và room phân quyền trong `backend/src/sockets/socket.auth.ts`. Chưa thấy cơ chế job chung trong các đường mã đã kiểm tra.

## 2. Phương án và quyết định đề xuất

1. **Chỉ optimistic UI:** ít thay đổi, phù hợp CRUD nhỏ, nhưng copy vẫn lệ thuộc tab đang mở và enrollment vẫn giữ request dài.
2. **Optimistic UI + job cho tác vụ dài — đề xuất:** xử lý đúng hai loại độ trễ, tận dụng stack hiện có; phải bổ sung trạng thái job và xử lý chạy lại.
3. **Đưa mọi lần ghi vào queue:** thống nhất giao thức nhưng tăng độ phức tạp, độ trễ và trạng thái trung gian cho cả thao tác nhỏ; chưa cần thiết.

Đây là lựa chọn đề xuất của người lập kế hoạch, chưa phải quyết định đã được người dùng phê duyệt. Phạm vi ưu tiên là các luồng nêu trên; không tuyên bố đã rà soát toàn bộ mutation trong repo.

## 3. Hợp đồng hành vi

- CRUD nhỏ: FE kiểm tra biểu mẫu → hiển thị bản pending ngay → gửi API → thay bằng bản chuẩn từ server hoặc đánh dấu lỗi/khôi phục. DB và backend vẫn là nguồn sự thật.
- Job dài: gửi lệnh → server kiểm tra quyền + input và lưu job → `202 { jobId, status: 'queued' }` → UI cho tiếp tục làm việc → worker cập nhật trạng thái → FE nhận kết quả chuẩn.
- Trạng thái job: `queued | running | succeeded | partially_succeeded | failed`; progress gồm `total, completed, succeeded, failed, skipped`. Chỉ dùng phần trăm nếu biết total; enrollment chưa biết tiến độ thì hiển thị giai đoạn.
- UI dùng “Đang lưu”, “Đang xử lý”, “Chưa lưu được”; không gọi dữ liệu pending là đã lưu. Face ID chỉ chuyển enrolled sau kết quả xác nhận; không tự tạo số vector hay chất lượng giả.
- Khi mất mạng/timeout chưa biết server đã commit hay chưa: đối soát theo operationId trước khi retry hoặc rollback; không tự động gửi lại POST tạo mới bằng ID khác.
- Mỗi lệnh có operationId/idempotency key gắn actor + loại lệnh + hash payload; gửi lặp cùng payload trả cùng kết quả/job, khác payload trả conflict. Không lưu mật khẩu tạm trong kết quả job hoặc socket.
- Chặn/tuần tự hóa mutation cùng nhân viên hoặc ô lịch. Khi có cập nhật đồng thời, dùng expectedVersion kiểm tra nguyên tử và trả 409; không để rollback cũ ghi đè bản mới.
- Theo dõi job đặt ở cấp ứng dụng, tồn tại qua chuyển trang. Refresh/reconnect lấy job chưa hoàn tất của user và refetch các dữ liệu liên quan; socket chỉ là thông báo, GET là đối soát.
- Giữ nguyên kiểm tra quyền/phòng ban, nhân viên nghỉ việc, ngày quá khứ, khóa kỳ lương, ca chồng lấn và audit. Worker kiểm tra lại quyền/trạng thái khi thực thi.
- Không dùng fire-and-forget Promise hoặc setTimeout làm queue. Không kéo tổng hợp chấm công ra khỏi transaction trong đợt đầu.

## 4. Các task triển khai

### Task 1 — Mutation nhỏ phản hồi tức thì

**Modify:** `frontend/src/features/employees/hooks/useEmployees.ts`, `frontend/src/features/employees/api/employeeApi.ts`, `frontend/src/context/EmployeeContext.tsx`, `frontend/src/pages/manager/ManagerEmployeeList.tsx`, các component bảng/form liên quan.

**Create:** `frontend/validation/integration/employee-optimistic-mutations.test.tsx`.

- [ ] Viết test request chậm: dòng nhân viên xuất hiện/đổi ngay với trạng thái pending; lỗi giữ bản nháp và cho retry; request cũ lỗi không ghi đè chỉnh sửa mới; ID tạm không được dùng để phân lịch/enroll.
- [ ] Thêm onMutate, hủy refetch đang chạy, patch cache theo bản ghi; onSuccess thay bằng dữ liệu server (ID/mã chuẩn), onError phục hồi đúng bản ghi hoặc giữ dòng lỗi. Không rollback nguyên danh sách.
- [ ] Đưa metadata pending/error ngoài kiểu Employee nghiệp vụ; expose trạng thái mutation qua context, giữ bản nháp sau đóng modal. Một thao tác chỉ phát một toast cuối cùng.
- [ ] Kiểm kê query key của detail/dashboard liên quan trước khi nối invalidation; setQueryData cho bản chuẩn và invalidate có phạm vi, tránh GET toàn bộ sau mỗi bản ghi.
- [ ] Test contract response → model FE; không đưa initial_account/temporary_password vào cache danh sách.
- [ ] Chạy `npm --prefix frontend test -- validation/integration/employee-optimistic-mutations.test.tsx` và `npm --prefix frontend run lint`.

### Task 2 — Nền tảng job bền vững, theo dõi và chống ghi trùng

**Modify:** `backend/prisma/schema.prisma`, migration mới, `backend/src/app.ts`, `backend/src/server.ts`.

**Create:** `backend/src/modules/operations/{operation.routes,operation.service,operation.worker,operation.gateway}.ts`, `frontend/src/features/operations/{operationApi,useOperations}.ts`, test tại `backend/validation/operations/` và `frontend/validation/integration/operations.test.tsx`.

**Interfaces đề xuất:** `GET /api/operations/:id`, `GET /api/operations?active=true`; socket `/operations` phát `operation.updated { jobId, revision, status, progress }`. Mọi truy vấn giới hạn theo user/quyền; socket không mang ảnh, vector, mật khẩu hoặc payload nghiệp vụ đầy đủ.

- [ ] Test submit trùng, conflict payload, user khác đọc job, hai worker claim cùng job, process chết giữa chừng, event sai thứ tự và reconnect.
- [ ] Lưu operation: owner, type, payloadRef/payload an toàn, status, progress, result/error an toàn, revision, idempotency key/hash, attempts, leaseUntil, timestamps; item job có khóa duy nhất theo job + đối tượng + ngày.
- [ ] Claim nguyên tử bằng khóa hàng/skip locked, lease + heartbeat; recovery sau restart. Tác dụng DB và item completion cùng transaction khi có thể; handler bên ngoài phải hỗ trợ idempotency riêng.
- [ ] Thêm operationId và kết quả đối soát cho create employee trước khi bật retry tạo mới ở Task 1; expectedVersion/409 cho cập nhật cạnh tranh. Chưa có contract này thì không retry tự động.
- [ ] Worker chạy cùng process backend giai đoạn đầu, giới hạn song song; shutdown ngừng nhận job và để lease phục hồi phần chưa xong. Poll DB định kỳ để không phụ thuộc signal trong RAM.
- [ ] FE poll GET mỗi 3 giây khi còn job active; socket thúc đẩy GET sớm; bỏ event revision cũ. Unmount trang không hủy job; logout xóa dữ liệu theo dõi của user.
- [ ] Chạy `npm --prefix backend test -- validation/operations` và `npm --prefix frontend test -- validation/integration/operations.test.tsx`.

### Task 3 — Copy tuần trước và phân ca hàng loạt tại backend

**Modify:** `backend/src/modules/shifts/shift.{routes,controller,service}.ts`, `frontend/src/pages/manager/ManagerSchedule.tsx`, `frontend/src/features/schedules/{api/shiftApi,hooks/useShifts}.ts`.

**Create:** `backend/src/modules/shifts/shift-batch.service.ts`, `backend/validation/shifts/shift-batch.test.ts`, `frontend/validation/integration/schedule-background.test.tsx`.

**Interfaces:** `POST /api/shifts/copy-week { sourceMonday, targetMonday, employeeIds, expectedTargetVersions }`; `POST /api/shifts/batch { assignments, expectedTargetVersions }`; cả hai nhận idempotency key và trả 202 + jobId sau commit nhận lệnh.

- [ ] Test copy đúng tuần, nguồn không có ca, ngày quá khứ, người khác phòng, nhân viên inactive, kỳ lương khóa, ca qua đêm/chồng lấn, đích bị người khác sửa, retry sau worker crash và thành công một phần.
- [ ] Backend đọc nguồn từ DB khi nhận lệnh, lưu snapshot danh sách nguồn/phiên bản và item theo thứ tự nhân viên/ngày; không tin bản lịch cache của FE. Giữ hành vi ghi đè ca đích nhưng báo conflict nếu phiên bản đích đã đổi từ lúc nhận lệnh.
- [ ] Tái sử dụng nghiệp vụ assignOrUpdate; refactor nhận transaction client nếu cần để ghi item completion cùng transaction ca + audit + tổng hợp. Tuần tự hóa các ca cùng nhân viên, không Promise.all vô hạn.
- [ ] Một ca thất bại không hủy cả job; result có saved/failed/skipped và lý do từng ô, retry chỉ các item lỗi đủ điều kiện sau kiểm tra lại.
- [ ] FE thay vòng lặp request bằng một lệnh; preview ô lịch dạng pending, đối soát bản thật khi hoàn tất; invalidation theo batch/progress được gộp, không mỗi ô một lần. Chặn sửa ô đang chạy để tránh xung đột từ cùng FE.
- [ ] Chạy `npm --prefix backend test -- validation/shifts` và `npm --prefix frontend test -- validation/integration/schedule-background.test.tsx`.

### Task 4 — Enrollment nền và sửa trạng thái sinh trắc học

**Modify:** `backend/src/modules/biometrics/biometric.{routes,controller,service}.ts`, `frontend/src/features/biometrics/{api/biometricApi,hooks/useBiometricEnrollment}.ts`; `face_auth/api_service.py`, `face_auth/database/vector_db.py` nếu cần idempotency và khóa ghi.

**Create:** test job biometric trong `backend/validation/biometrics/`, test FE trong `frontend/validation/integration/biometric-background.test.tsx`.

- [ ] Test upload chưa xong, inference chậm, không có mặt hợp lệ, timeout sau Python đã commit, audit lỗi sau lưu, avatar lỗi và hai enrollment/xóa đồng thời.
- [ ] Enrollment trả 202 sau khi ảnh được lưu bền vững, có giới hạn dung lượng và quyền truy cập; upload vẫn cần thời gian. Dùng vùng staging có TTL và mã hóa, không nhét base64 vào bảng job, localStorage hoặc log. Chốt storage thực tế từ cấu hình deploy trước khi triển khai task này.
- [ ] Worker gọi face_auth bằng operationId. Python ghi operationId/result cùng transaction embeddings, có endpoint đối soát; retry sau timeout trả lại kết quả cũ, không ghi đè lần enrollment mới hơn. Khóa/kiểm tra phiên bản nhân viên được dùng chung cho Python và lệnh xóa.
- [ ] Giữ ảnh/vector cũ cho tới khi bộ mới hợp lệ và commit. Gom cập nhật avatar về server; nếu chưa thể nguyên tử giữa Python và Express thì theo dõi từng bước và báo rõ “Face ID đã lưu, avatar chưa cập nhật”, không rollback giả hoặc enroll lại chỉ vì avatar lỗi.
- [ ] FE cho đóng modal khi đã nhận job, hiển thị tiến độ trong app; bật Face ID sau đối soát kết quả; xóa request PUT face_enrolled không có hiệu lực và invalidate đúng nguồn.
- [ ] Vân tay vẫn ghi rõ mô phỏng; chỉ báo lưu thành công sau PUT xác nhận. Kết nối phần cứng thật là phạm vi riêng.
- [ ] Chạy `npm --prefix backend test -- validation/biometrics` và `npm --prefix frontend test -- validation/integration/biometric-background.test.tsx`; nếu sửa Python, xác định và chạy test enrollment tập trung theo AGENTS.md của face_auth.

### Task 5 — Tách email khỏi thời gian tạo nhân viên và hoàn thiện kiểm chứng

**Modify:** `backend/src/modules/employees/employee.service.ts`, handler email trong operations, toast nhân viên trong `useEmployees.ts`; tests trong `backend/validation/employees/`.

- [ ] Test DB commit nhưng SMTP lỗi, worker restart, gửi lặp, audit lỗi; phản hồi tạo nhân viên không được báo thất bại giả sau khi bản ghi đã tạo.
- [ ] Tạo employee + user + audit + email outbox trong cùng transaction. API trả bản ghi sau commit với emailStatus queued; worker gửi email sau. Không đưa mật khẩu thuần vào job/log/socket: dùng secret mã hóa thời hạn ngắn và xóa khi xong, hoặc thiết kế lời mời đặt mật khẩu riêng trước khi đổi contract hiện tại.
- [ ] UI phân biệt “Đã tạo nhân viên” và “Email đang gửi/Gửi email thất bại”; bỏ toast mặc định khẳng định email luôn thành công. Nêu rõ SMTP có thể gửi trùng khi chết sau gửi nhưng trước ack nếu nhà cung cấp không hỗ trợ idempotency.
- [ ] Chạy regression employee/shift/biometric/socket auth, frontend lint/build và backend build. Kiểm tra refresh, đổi trang, mất socket, mất mạng và restart worker trong môi trường test.
- [ ] Đo trước/sau bằng cùng dữ liệu: độ trễ từ click tới pending, số request copy, thời gian request tạo nhân viên, thời gian hoàn tất job. Mục tiêu UI pending dưới 100 ms khi không có xử lý đồng bộ nặng; đây là tiêu chí cần đo, chưa phải kết quả đã đạt.

## 5. Thứ tự rollout và giới hạn

Task 1 → Task 2 → Task 3 → Task 4 → Task 5. Task 1 không bật retry POST cho tới khi chống trùng tại Task 2 hoàn tất. Bật theo từng luồng; giữ API đồng bộ cũ trong giai đoạn chuyển tiếp, không cho hai cơ chế cùng sửa một operation.

Năm điểm phải review: rollback ghi đè thao tác mới; timeout sau commit gây trùng; worker chạy lại gây tác dụng lặp; quyền thay đổi khi job đang chờ; Python đã lưu nhưng Express/FE chưa biết. Test tương ứng nằm ở Task 1–5.

Không thay đổi model/ngưỡng nhận diện, quy tắc tính công/lương hoặc kết nối vân tay thật. Chưa chạy ứng dụng, truy cập DB thực hay benchmark; kết luận hiện trạng dựa trên đọc mã, không khẳng định độ trễ thực tế.
