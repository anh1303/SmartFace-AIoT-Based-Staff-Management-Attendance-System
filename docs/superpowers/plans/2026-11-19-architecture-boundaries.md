# Architecture Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đạt các tiêu chí nghiệm thu Modular Monolith cho backend và Feature-Based Architecture cho frontend của SmartFace. Pha 1 xử lý tám phát hiện và thiết lập kiểm tra tự động. Pha 2 xử lý phần nợ còn lại để đạt Definition of Done bên dưới.

**Architecture:** Backend quyết định ngày công, phạm vi quyền và chính sách lương. Frontend dùng dữ liệu API để dựng màn hình và dùng API công khai khi gọi feature khác. Các module backend trao đổi qua public API và port hiện có.

**Tech Stack:** TypeScript, React, TanStack Query, Express, Socket.IO, Prisma, PostgreSQL, Vitest.

**Spec:** Yêu cầu Pha 1 nằm trong Task 1–8. Tiêu chí nghiệm thu Pha 2 nằm trong bảng Definition of Done. [Evaluation](../reviews/2026-11-19-architecture-boundaries-evaluation.md) provides evidence and Phase 2 candidates.

## Global Constraints

- Giữ một Prisma Client và nguyên lịch sử `backend/prisma/migrations/`. Thay đổi hợp đồng API theo hướng bổ sung trước, triển khai backend trước frontend.
- Giữ thay đổi đang có trong workspace. Ghi nhận build/test baseline và lỗi đã tồn tại. Dùng fixture hoặc DB test riêng cho test có ghi.
- Tách từng task theo diff để review và hoàn tác. Xác minh mỗi task trước khi bắt đầu task phụ thuộc.
- Các đường dẫn tính từ gốc repo. Lệnh `npx vitest run validation/…` chạy trong package tương ứng. Khi PowerShell chặn script, dùng `npx.cmd` và `npm.cmd`.

## Review Focus

- Checkout vật lý ngày hôm sau khi UI chỉ tải một ngày — Task 1.
- Quản lý xem được phiếu của mình nhưng thiếu quyền sửa, hoặc quyền đổi sau khi tải — Task 2–3.
- Một khoản điều chỉnh dùng chính sách lịch sử trong transaction — Task 4.
- Tài khoản bị vô hiệu hóa sau khi socket kết nối — Task 5.
- Trang danh sách nhân viên có nhiều bản ghi và mẫu bất hoạt — Task 6.

## Task 0 — Ghi nhận baseline

- [x] Chạy `git status --short`, `git diff --stat` và rà chỉ dẫn repo áp dụng. Ghi riêng file người dùng đã sửa.
- [x] Chạy `npm run build` ở frontend và backend. Ghi lại lỗi baseline hoặc thiếu môi trường.
- [x] Chạy các test theo đường dẫn trong từng task trước khi sửa task đó. Với refactor, test hiện có phải xanh trước và sau. Với thay đổi hành vi, thêm ca hồi quy và xác nhận thất bại đúng nguyên nhân trước khi sửa.

**Cổng kiểm thử khi giao task:** Với thay đổi hành vi, giao rõ bốn bước riêng: viết test hồi quy → chạy và xác nhận test fail đúng lý do → sửa code → chạy lại và xác nhận pass. Với refactor giữ nguyên hành vi, chạy test xanh trước và sau. Áp dụng cổng này ngay cả khi phần triển khai gộp nhiều file trong một checkbox.

## Task 1 — Dùng ngày công do backend trả (#1)

**Interfaces / review contract:** Thêm `workDateOverride?: string` vào `determinePunctuality` trong `attendance.format.ts`. Formatter truyền ngày đã lưu khi có; test trường hợp ngày lưu khác ngày suy từ lịch. Đo EXPLAIN (ANALYZE, BUFFERS) trên DB test trước khi đề xuất index riêng.

**Hợp đồng:** Danh sách log có `work_date: string | null`. Dạng có giá trị là `YYYY-MM-DD`. `timestamp` là thời điểm sự kiện. Null biểu thị ngày công chưa xác định.

- [x] Bổ sung test vào `backend/validation/attendance/compact-list.test.ts` và `frontend/validation/attendance/overnight-checkout.test.tsx`. Ca bắt đầu 18/11 lúc 22:00, checkout 19/11 lúc 06:10, API trả `work_date: '2026-11-18'`. Có checkout khác thuộc 19/11. Query chỉ ngày 18 phải trả checkout đầu tiên đúng một lần, kể cả summary vắng mặt. Log null vẫn xem được ở nhóm chưa xác định.
- [x] Trong `backend/src/modules/attendance/attendance.format.ts`, mở rộng `RawAttendanceLogDb` nếu cần và trả trường này từ `formatAttendanceRecord`. Trong `attendance.service.ts` cùng thư mục, rà query danh sách và nhánh compact. Với bộ lọc ngày công dùng `work_date` cho log đã có giá trị. Với log null, dùng khoảng timestamp để tìm và hiển thị ở nhóm chưa xác định, không gán ngày công từ timestamp. Giữ phạm vi actor, thứ tự và phân trang.
- [x] Trong `frontend/src/types/attendance.types.ts` cập nhật kiểu record. Trong `frontend/src/features/attendances/api/attendanceApi.ts` và `hooks/useAttendance.ts`, giữ `work_date` qua đường tải và chuẩn hóa. Cho phép vắng trường trong giai đoạn chuyển tiếp, xử lý như null.
- [x] Trong `frontend/src/features/attendances/hooks/useAttendancePairs.ts`, thay khối `isPlausibleOvernightCheckout` và nhóm sự kiện dùng ngày lịch bằng lập chỉ mục theo mã nhân viên và ngày công. Giữ cặp đã xác định từ summary, loại trùng theo ID và hiện log null tách khỏi tổng hợp công. Rà các lời gọi trong `frontend/src/pages/manager/ManagerAttendanceMonitor.tsx` và `frontend/src/features/employees/components/EmployeeAttendanceTab.tsx` để truyền đúng tập theo khoảng ngày.
- [x] Chạy backend `npx vitest run validation/attendance/compact-list.test.ts validation/attendance/attendance.policy.test.ts` và frontend `npx vitest run validation/attendance`. Kiểm tra ca thường, ca qua đêm, ngày chưa phân ca, log null và kết quả phân trang. Chốt diff Task 1.

## Task 2 — Một nguồn cho phạm vi xem và quyền sửa lương (#2)

**Interfaces / review contract:** Thêm và công bố `getManagedEmployeeIds(actor: EmployeeActor, employeeIds: readonly string[], tx?: Prisma.TransactionClient): Promise<Set<string>>` tại `employee.permission.ts` và `employees/public.ts`. Nếu `employeeIds.length === 0`, trả `new Set<string>()` ngay trước khi đọc scope hoặc truy vấn database. Kiểm thử trường hợp này và xác nhận không có truy vấn. Với danh sách có ID, query một lần với AND giữa danh sách ID và scope manage. `can_edit` dùng cùng predicate quyền và trạng thái với endpoint cập nhật. Quyền chốt/mở kỳ tách riêng. Rà mọi caller của `isAnotherManager` và `isDifferentDepartment`.

- [x] Dùng `backend/validation/integration/shared-resources.scope.test.ts` và `frontend/validation/payroll/payroll-authority.test.tsx` để khóa ma trận actor. Admin có phạm vi hiện hành. Manager thấy phiếu của mình và nhân viên được cấp quyền, nhưng không nhờ quyền đọc để sửa phiếu ngoài phạm vi manage. Cùng bộ phiếu API khi danh sách nhân viên chưa tải phải cho cùng tập hiển thị.
- [x] Rà `backend/src/modules/payroll/payroll.routes.ts` và `payroll.controller.ts`. Mọi đường gọi từ HTTP truyền actor vào các hàm đọc và ghi. Trong `payroll.service.ts`, giữ `getEmployeeScope(actor, 'read')` tại `list` và scope manage hiện có ở thao tác ghi. Bổ sung `can_edit: boolean` từ cùng điều kiện backend áp dụng cho chỉnh sửa. Tính theo scope/batch để tránh query cho từng phiếu. Endpoint ghi tiếp tục kiểm tra tại thời điểm yêu cầu.
- [x] Trong `frontend/src/pages/manager/ManagerPayroll.tsx`, sửa khối `allPeriodRecords`. Bỏ suy quyền qua email, tên phòng ban và `isAnotherManager`. Giữ lọc kỳ và các bộ lọc người dùng chọn. Đối chiếu `wasHiredByPayrollPeriod` với cách backend sinh và trả phiếu. Nếu điều kiện này cần loại phiếu khỏi tập kỳ, kiểm tra ngày tuyển theo phiên bản nghiệp vụ ở backend trước khi xóa khỏi UI, thêm test với phiếu lịch sử. Rà `controlledPeriodRecords` và các chỗ bật nút sửa để dùng quyền API thay vì suy từ mã nhân viên.
- [x] Chạy backend test scope trên môi trường test và frontend `npx vitest run validation/payroll/payroll-authority.test.tsx validation/payroll/payroll-hire-period.test.ts`. So sánh tập ID và quyền của từng actor, kể cả khi đổi phòng sau lần tải. Chốt diff Task 2.

## Task 3 — Xuất báo cáo lương chính thức (#3, sau Task 2)

**Interfaces / review contract:** Kiểm tra trên scope read của actor trước bộ lọc. Phiếu của chính manager còn PENDING sẽ chặn, phiếu ngoài scope không ảnh hưởng. Đây là giả định cần xác nhận trước khi phát hành. Endpoint trả 400 khi input sai, 409 khi kỳ chưa đủ điều kiện và 404 khi không có dòng trong phạm vi sau khi kiểm tra kỳ. DTO chứa `employee_name` và mọi cột xuất. Bỏ `employees.find(...)` khỏi phần dựng tệp.

**Quyết định trong kế hoạch:** Giữ yêu cầu kỳ đủ điều kiện xuất của nút hiện tại. Dùng một endpoint báo cáo có kiểm tra tại thời điểm xuất. Phạm vi xuất là các dòng thỏa bộ lọc UI, với danh sách ID gửi lên chỉ có tác dụng thu hẹp tập được cấp quyền.

- [x] Thêm `backend/validation/payroll/payroll-export.test.ts` và `frontend/validation/payroll/payroll-export.test.tsx`. Kiểm tra kỳ chỉ có quyết toán sớm, có phiếu chờ, đủ điều kiện, ID ngoài phạm vi, bộ lọc rỗng và kỳ bị mở lại sau lần tải.
- [x] Tạo `backend/src/modules/payroll/payroll.export.ts` với `buildPayrollExport(period, actor, recordIds): Promise<PayrollRecordDto[]>`, dùng kiểu trả về từ formatter payroll. Lấy phạm vi read theo actor. Đánh giá kỳ trên toàn tập được phép đọc trước bộ lọc, giữ điều kiện có ít nhất một phiếu thường và mọi phiếu thuộc FINALIZED/CONFIRMED/PAID. Chỉ trả giao của tập đó với ID yêu cầu. Phạm vi và dữ liệu báo cáo phải lấy từ cùng một lần đọc hợp lệ.
- [x] Trong `payroll.dto.ts` thêm schema kỳ hợp lệ và mảng ID không rỗng. Trong `payroll.controller.ts` thêm handler dùng actor hiện tại. Trong `payroll.routes.ts` thêm `POST /period/:period/export` với xác thực và role admin/manager. Trả lỗi theo quy ước API nếu kỳ không đủ điều kiện hoặc không còn dữ liệu trong phạm vi.
- [x] Trong `frontend/src/features/payrolls/api/payrollApi.ts` thêm `fetchPayrollExportApi(period: string, recordIds: string[]): Promise<PayrollRecord[]>`. Sửa `handleExportCSV` trong `ManagerPayroll.tsx` thành lấy dòng hiện tại, dừng khi rỗng, gọi endpoint và tạo tệp từ kết quả trả. Bỏ fallback sang toàn kỳ. Bỏ helper `payrollExportEligibility.ts` và export tương ứng sau khi rà hết caller. UI được phép hiển thị phản hồi kỳ chưa đủ điều kiện từ server.
- [x] Chạy hai test mới và toàn bộ nhóm `validation/payroll` thích hợp ở hai package. So sánh số dòng, tổng tiền và định dạng Excel/PDF trên fixture cũ. Chốt diff Task 3.

## Task 4 — Đưa chính sách và tính lương về payroll (#4)

**Interfaces / review contract:** Chuyển cả `backend/src/common/payroll-rates.ts` và `backend/src/common/payroll-history.ts` vào `backend/src/modules/payroll/`. Đặt wrapper `calculateNetSalary` cạnh `computePayrollBreakdown` trong `payroll-rates.ts`, bỏ tái xuất qua `common/utils.ts`. Rà `PayrollBreakdown`, `SalaryCalculationInput`, `historicalBreakdown`, `historicalAdjustmentAmount` và `reconciliationSchema` trong code, test, seed và script. Attendance lấy nghiệp vụ payroll qua public API/port.

- [x] Ghi nhận kết quả fixture trong `backend/validation/payroll/policy-history.test.ts`, `policy-defaults.test.ts` và `financial-validation.test.ts`. Bổ sung ca policy lịch sử trong transaction vào `backend/validation/payroll/adjustments.integration.test.ts`, kiểm tra cùng hệ số và rollback.
- [x] Chuyển `backend/src/common/payroll-policy.ts` sang `backend/src/modules/payroll/payroll.policy.ts`. Chuyển `calculateNetSalary` từ `backend/src/common/utils.ts` sang `backend/src/modules/payroll/payroll-rates.ts`. Cập nhật import ở `payroll.service.ts` và `payroll.adjustments.ts`. Giữ nguyên công thức, rounding, snapshot và fallback.
- [x] Trong `backend/src/modules/payroll/public.ts`, xuất `getAdjustmentPolicy` với cùng chữ ký và kiểu trả về của `policyForPeriod`, gồm tham số database/transaction hiện có. Thêm vào `backend/src/modules/attendance/attendance.payroll-port.ts`. `backend/src/composition.ts` truyền public API payroll vào port. Sửa mọi lời gọi trong `attendance.service.ts` và `attendance.aggregation.ts` để dùng port và giữ đối số transaction.
- [x] Đổi import ở `backend/prisma/seeds/attendance.ts`, `demo-2026.ts`, hai file `backend/scripts/maintenance/rebuild-attendance-*.ts` và các test tìm được bằng `rg -n 'policyForPeriod|calculateNetSalary|computePayrollBreakdown|PayrollBreakdown|SalaryCalculationInput|historicalBreakdown|historicalAdjustmentAmount|reconciliationSchema|common/payroll-' backend`. Khi test mock port, cập nhật fixture để kiểm tra cùng transaction. Rà đường khởi động server/worker để phát hiện vòng import.
- [x] Chạy `npx vitest run validation/payroll/policy-history.test.ts validation/payroll/policy-defaults.test.ts validation/payroll/financial-validation.test.ts` và các test attendance/adjustments liên quan. Chạy `npx tsc --noEmit -p prisma/tsconfig.json`. Chốt diff khi kết quả tính không đổi.

## Task 5 — Socket auth qua API công khai (#5)

**Interfaces / review contract:** Giữ hành vi HTTP/socket hiện tại. Việc hợp nhất xác thực session thuộc Pha 2 sau khi đối chiếu vòng đời và scope hai adapter.

- [x] Dùng `backend/validation/auth/socket-auth.test.ts` và `socket-refresh-race.test.ts` khóa handshake, reconnect, scope khi refresh, tài khoản bị vô hiệu hóa và phiên khuôn mặt hết hạn.
- [x] Trong `backend/src/modules/auth/public.ts` tái xuất `readAuthUser` từ `auth.read.ts` với chữ ký hiện có. Trong `backend/src/sockets/socket.auth.ts`, đổi import nội bộ sang public API. Giữ xác minh token, thứ tự refresh và quản lý room tại adapter. Cập nhật mock theo import mới.
- [x] Chạy `npx vitest run validation/auth/socket-auth.test.ts validation/auth/socket-refresh-race.test.ts`. Chốt diff độc lập.

## Task 6 — Biometrics sở hữu `face_enrolled` (#6)

**Interfaces / review contract:** Công bố `faceEnrollmentSummarySelect` và `hasActiveFaceEnrollment(samples: readonly unknown[] | null | undefined): boolean` từ biometrics. Đây là ngoại lệ Prisma chỉ đọc. Giữ tiêu chí hiện tại và phân biệt với `hasFaceLoginTemplate`.

- [x] Đọc điều kiện Prisma hiện hành tại `backend/src/modules/employees/employee.model.ts` và đối chiếu trạng thái ở `backend/src/modules/biometrics/public.ts` cùng các repository tương ứng. Viết test trong `backend/validation/biometrics/employee-face-enrollment-status.test.ts` cho không có mẫu, có mẫu hoạt động, chỉ có mẫu bất hoạt. Khóa đúng hành vi hiện tại của trường `face_enrolled`. Nếu điều kiện đủ quyền đăng nhập khác, giữ hai ý nghĩa riêng.
- [x] Chuyển điều kiện chọn mẫu sang `backend/src/modules/biometrics/face-enrollment-status.ts`. Xuất descriptor truy vấn có kiểu Prisma qua `biometrics/public.ts`, cùng phép chuyển kết quả quan hệ sang boolean. Dùng descriptor trong `employee.model.ts` để giữ truy vấn gộp hiện có. Bỏ phép suy mảng trong `employee.format.ts` và đọc boolean từ phép chiếu do biometrics sở hữu. Nếu import tạo vòng, nối qua `employee.integration-port.ts` và `composition.ts`.
- [x] Rà caller `employeeInclude` và `formatEmployee` trong `employee.service.ts`, `employee.queries.ts` và `employee.repository.ts`. Xác nhận list, detail, create/replay và update vẫn trả trường boolean. Đường query không yêu cầu trạng thái tiếp tục hành xử như baseline. Không thêm query cho mỗi nhân viên.
- [x] Chạy test mới, `npx vitest run validation/employees/employee-connection.test.ts validation/biometrics/model-version-filter.test.ts` và test danh sách liên quan. So sánh số truy vấn của một trang. Chốt diff Task 6.

## Task 7 — Đổi chủ sở hữu hook thiết bị (#7)

**Interfaces / review contract:** Đặt `useDeviceSettings.ts` cạnh `useDeviceRealtime.ts` ở root feature devices. Giữ layout phẳng hiện hành.

- [x] Di chuyển `frontend/src/features/attendances/hooks/useDeviceSettings.ts` sang `frontend/src/features/devices/useDeviceSettings.ts`. Xuất hook và `BluetoothDevice` từ `features/devices/index.ts`. Bỏ tái xuất cũ trong `features/attendances/index.ts`.
- [x] Sửa caller ở `frontend/src/components/layout/QuickSettingsMenu.tsx`, `features/devices/components/DeviceKioskSettingsPanel.tsx` và `features/attendances/components/WebRTCPlayer.tsx` theo danh sách `rg -n 'useDeviceSettings|BluetoothDevice' frontend`. Giữ URL, payload, socket event và cleanup.
- [x] Chạy frontend build, backend `npx vitest run validation/device-settings.test.ts`, và kiểm tra menu tại môi trường thử nghiệm. Đổi thiết bị, cập nhật âm lượng, quét Wi-Fi/Bluetooth, ngắt kết nối và mount/unmount. Xác nhận phản hồi thiết bị trước không ghi đè trạng thái thiết bị mới. Chốt diff Task 7.

## Task 8 — API feature công khai và kiểm tra ranh giới (#8)

**Interfaces / review contract:** Chặn runtime import `common → modules` ở backend và `components/common` hoặc `utils → features` ở frontend. Kiểm tra chu trình runtime giữa các module, loại cạnh chỉ dùng type. Với chu trình baseline, ghi từng chu trình và chặn chu trình mới. Ngoại lệ theo source, target và loại vi phạm; kiểm tra thất bại nếu ngoại lệ không còn khớp. Chuyển bootstrap sang entry công khai khi phù hợp, ghi chính xác phần còn lại cho Pha 2.

- [x] Tạo hai baseline JSON cạnh test kiến trúc tại `backend/validation/architecture/boundary-baseline.json` và `frontend/validation/architecture/boundary-baseline.json`. Backend kiểm kê `src/common/` và từng export có quyền sở hữu riêng trong `common/utils.ts`. Frontend kiểm kê `src/context/`, `src/types/`, `src/utils/` và lập ma trận phụ thuộc feature có hướng từ kết quả resolver, gồm import kiểu. Mỗi mục ghi đường dẫn hoặc cặp nguồn → đích, chủ sở hữu, lý do và trạng thái được phép hay chờ di chuyển. Ghi số lượng ban đầu của mục chờ di chuyển, chu trình và ngoại lệ chuyển tiếp ở mỗi phía. Test đọc cùng baseline để kiểm tra mục chưa phân loại, cạnh mới và ngoại lệ không còn khớp. Baseline chỉ ghi nhận hiện trạng của Pha 1. Khi nghiệm thu Pha 2, các danh sách chuyển tiếp phải rỗng theo Definition of Done.

- [x] Rà caller của `frontend/src/api/index.ts` và `frontend/src/hooks/index.ts` bằng import tĩnh, tái xuất và alias. Thêm hoặc dùng `features/<name>/index.ts` theo từng feature. Sửa `frontend/src/context/{Shift,Payroll,Employee,Attendance,Auth}Context.tsx` để gọi API feature công khai. Chuyển caller còn lại rồi xóa barrel nếu không còn sử dụng. Giữ HTTP client trong `frontend/src/api/client.ts`.
- [x] Trong `frontend/src/components/common/Toast.tsx`, chuyển phụ thuộc NotificationContext thành props/callback. Gắn hành vi tại `frontend/src/context/ToastContext.tsx` hoặc nơi lắp provider đang render Toast. Giữ hành vi khi thiếu NotificationProvider. Dùng `frontend/validation/notifications/{toast-content,persistence,toolbar-errors}.test.tsx` để khóa nội dung, đóng toast và lưu lịch sử.
- [x] Mở rộng quy ước từ `backend/validation/architecture/fingerprint-boundary.test.ts`. Tạo `backend/validation/architecture/module-boundary.test.ts` và `frontend/validation/architecture/feature-boundary.test.ts`. Dùng TypeScript resolver/AST để kiểm tra import, export-from và import động literal theo đường đã resolve. Frontend chặn import mã backend và deep import từ feature khác. Backend chặn gọi nội bộ từ module khác, chấp nhận entry public được quy ước như `public.ts` và `fingerprint.public.ts`. Cho phép ngoại lệ hẹp cho các điểm lắp ráp hiện hành. Ghi rõ từng ngoại lệ và tránh whitelist nguyên thư mục consumer.
- [x] Xác nhận test nhận diện import hợp lệ, deep import tương đối, alias deep import và tái xuất sai. Dọn hoặc ghi riêng ngoại lệ có bằng chứng khi bật kiểm tra lần đầu. Chạy các test notifications và architecture, build hai package. Chốt diff Task 8.

## Bàn giao và hoàn tác

- [x] Đối chiếu checklist: #1 ở Task 1, #2 ở Task 2, #3 ở Task 3, #4 ở Task 4, #5 ở Task 5, #6 ở Task 6, #7 ở Task 7, #8 ở Task 8.
- [x] Chạy build và test các nhóm đã chạm ở hai package. Chạy bài kiểm thử tích hợp với cơ sở dữ liệu test khi có sẵn. Ghi tên các kiểm tra đã chạy và các hạn chế môi trường.
- [x] Kiểm tra thực tế ca qua đêm, xuất lương có bộ lọc, socket reconnect, trạng thái khuôn mặt và menu thiết bị. Với API bổ sung, triển khai backend trước frontend. Khi hoàn tác, quay frontend về bản cũ trước khi gỡ hợp đồng API bổ sung.
- [x] Kiểm tra `git diff --check` và diff migrations. Các task trên không sinh migration. Công việc sửa dữ liệu cũ, nếu phát hiện cần thiết, có kế hoạch riêng.

## Phase 2 — Structural alignment (separate plan)

- Audit remaining domain helpers in backend common, normalize server/routes entry points, and compare HTTP/socket contracts before extracting shared authentication. Use ports for synchronous dependencies that need inversion; reserve events for side effects that can run asynchronously.
- Di chuyển provider, type và util theo phân loại trong manifest của Definition of Done. Xử lý hết danh sách chờ trước khi nghiệm thu. Rà các view ghép nhiều feature theo ma trận phụ thuộc. Keep valid one-way feature dependencies through public APIs and shared read projections with explicit owners. Avoid a uniform folder layout as a completion criterion.


## Definition of Done — Nghiệm thu Pha 2

Hai bộ test cố ý xử lý cạnh chỉ dùng kiểu khác nhau. Backend bỏ cạnh type-only khỏi phép kiểm tra chu trình **runtime** vì chúng không nạp module khi chạy. Frontend vẫn tính cạnh đó trong ma trận và phép kiểm tra chu trình **kiến trúc** vì dùng kiểu của feature khác vẫn tạo phụ thuộc vào hợp đồng của feature đó. Quy tắc sử dụng entry công khai áp dụng cả cho import kiểu.

Các tiêu chí dưới đây là chuẩn của dự án. Task 8 tạo test, ghi baseline và chặn vi phạm mới. Pha 2 mở rộng cùng bộ test để kiểm tra các tiêu chí đích. Xong Pha 1 chưa đồng nghĩa với đạt các tiêu chí này.

| Trục | Điều kiện đạt | Cách kiểm chứng |
| --- | --- | --- |
| Backend — quyền sở hữu | Mọi file trong `backend/src/common/` và mọi export nghiệp vụ đang trộn trong `common/utils.ts` đều đã được phân loại. Phần thuộc một module có chủ sở hữu và nằm trong module đó. Phần dùng chung có mô tả trách nhiệm và các caller đại diện. | Kiểm kê từng file và từng export hỗn hợp, gồm attendance-timing, biometric-crypto, device-auth và helper định danh/khóa. Test đối chiếu manifest với mã nguồn và chặn import từ common vào modules. Reviewer xác nhận phân loại theo trách nhiệm thay vì chỉ đếm caller. |
| Backend — public API và chu trình | Mọi import vào module từ `server.ts` và `routes.ts` đi qua entry công khai `index.ts` hoặc `public.ts`. Các nhóm entry được phép ở điểm lắp ráp phải có hợp đồng rõ. Số chu trình runtime giữa module bằng 0. | Test resolver kiểm tra đường import đã phân giải và đồ thị runtime. Cạnh chỉ dùng kiểu không tính vào chu trình runtime. `composition.ts` được nối port tại điểm lắp ráp với các ngoại lệ được liệt kê riêng. |
| Frontend — vị trí đặt state, type và util | `frontend/src/context/` chỉ chứa provider dùng chung hoặc provider lắp ráp ứng dụng, với danh sách khởi điểm Theme, Toast và App. Auth, Employee, Attendance, Shift và Payroll thuộc feature tương ứng. Từng file trong `src/types/` và `src/utils/` có chủ sở hữu rõ. Danh sách chờ di chuyển rỗng khi nghiệm thu. | Test đối chiếu các thư mục với manifest và chặn import từ shared vào feature. Reviewer xác nhận trường hợp dùng chung và kiểm tra các component nghiệp vụ từng nằm trong common. |
| Frontend — hướng phụ thuộc | Mọi import và tái xuất xuyên feature, kể cả import kiểu, đi qua API công khai và khớp ma trận có hướng. Đồ thị phụ thuộc feature không có chu trình, kể cả phụ thuộc hai chiều. | Test resolver kiểm tra mỗi cạnh với cặp nguồn → đích đã liệt kê, rồi kiểm tra chu trình. Mỗi cạnh được phép có lý do. View cần lắp nhiều domain có thể ghép ở pages. |
| Kiểm soát nợ | Allowlist chuyển tiếp của cả hai test kiến trúc giảm dần về 0. Ngoại lệ kiến trúc còn hiệu lực nằm trong danh sách riêng được review, có cặp nguồn → đích, loại ngoại lệ và lý do. | Task 8 ghi danh sách và số lượng ban đầu. CI chặn vi phạm mới và ngoại lệ không còn khớp. Reviewer đối chiếu diff từng đợt để tránh chuyển nợ từ danh sách tạm sang ngoại lệ lâu dài. |
| Hành vi sản phẩm | Các kiểm thử hồi quy của Pha 1 và build hai ứng dụng vẫn pass sau các đợt di chuyển của Pha 2. | Chạy task kiểm thử kiến trúc và các nhóm hồi quy đã liệt kê. Ghi kết quả và danh sách ngoại lệ cuối cùng khi bàn giao. |

Pha 2 cần một file kế hoạch thực thi riêng sau khi đo baseline bằng Task 8. Kế hoạch đó phải liệt kê file và export cần di chuyển, entry bootstrap cần thêm, ma trận phụ thuộc thực tế và ngoại lệ dự kiến giữ. Mỗi đợt bàn giao báo số chu trình runtime, số vi phạm chuyển tiếp và danh sách phần còn chờ di chuyển. Nghiệm thu theo bảng trên, không theo điểm ước lượng.
