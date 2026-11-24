# Đánh Giá Kế Hoạch Kiến Trúc — Architecture Boundaries Plan

> **Superpowers Review Gate:** Áp dụng tiêu chuẩn đánh giá từ `superpowers:writing-plans` và `superpowers:requesting-code-review`, đối chiếu trực tiếp với mã nguồn thực tế trong repository.

- **Kế hoạch được đánh giá:** `docs/superpowers/plans/2026-11-19-architecture-boundaries.md`
- **Ngày đánh giá:** 2026-11-19
- **Mục tiêu đối chiếu:**
  1. Chuẩn **Modular Monolith** cho Backend (`backend/src`)
  2. Chuẩn **Feature-Based Architecture** cho Frontend (`frontend/src`)
  3. Độ sẵn sàng thực thi bằng agentic worker (`superpowers:subagent-driven-development` / `superpowers:executing-plans`)

---

## 1. Kết luận tổng quan (Verdict)

**Trạng thái:** **Đạt ở mức Pha 1 (Boundary Hardening) sau khi vá các điểm Critical/Important; CHƯA đủ để hoàn tất chuẩn hóa toàn bộ FE Feature-Based và BE Modular Monolith.**

Kế hoạch hiện tại giải quyết rất tốt **8 phát hiện ranh giới nghiệp vụ và import** theo hướng an toàn, cô lập diff và có kiểm thử hồi quy. Tuy nhiên, nếu mục tiêu là đưa toàn bộ codebase về đúng chuẩn **Feature-Based (FE)** và **Modular Monolith (BE)** thì kế hoạch này mới là **Pha 1 (dọn nợ ranh giới cấp bách)**, chưa xử lý các lớp cấu trúc còn phân mảnh (như `backend/src/common/`, entrypoint `server.ts`/`routes.ts`, global `frontend/src/context/`, `types/`, `utils/`, và cross-feature coupling ở `features/employees`).

### Bảng chấm điểm theo tiêu chuẩn (sau khi chạy trọn kế hoạch nguyên bản)

| Trục đánh giá | Mức ước lượng | Nhận xét ngắn |
|---|---|---|
| **Backend — Modular Monolith** | ~75–80% | Nền repo vốn tốt (`prisma/domains`, `public.ts`, `*-port.ts`, `composition.ts`), nhưng còn rò rỉ domain trong `common/`, deep import ở `server.ts`/`routes.ts`, chưa có DAG/cycle check. |
| **Frontend — Feature-Based** | ~60–65% | Dọn được barrel cũ và `Toast.tsx`, nhưng 5 domain context, domain types/utils/components vẫn ở global layer và `features/employees` vẫn coupling ngang với 4 feature khác. |
| **An toàn triển khai & Rollback** | ~90% | Rất tốt: additive API trước, BE trước FE, không đụng migrations, tách diff theo từng task. |
| **Độ sẵn sàng Superpowers Execution** | ~65% | Thiếu file spec độc lập trên đĩa, thiếu block `Interfaces (Consumes/Produces)` ở các task phụ thuộc nhau, độ mịn bước còn thô cho `subagent-driven-development`. |

---

## 2. Điểm mạnh đáng giữ của kế hoạch

1. **Giữ đúng nguyên tắc *Backend as Source of Truth* (Task 1–3):** Đưa quyền quyết định `work_date`, phạm vi đọc/sửa (`can_edit`), và điều kiện xuất bảng lương về backend thay vì để FE suy luận từ timestamp, email hay tên phòng ban.
2. **Chiến lược phát hành không phá vỡ hợp đồng (Global Constraints):** Bổ sung hợp đồng API theo hướng additive, triển khai BE trước FE, hoàn tác FE trước BE, giữ nguyên lịch sử `backend/prisma/migrations/`.
3. **Bắt đúng các failure mode nguy hiểm (Review Focus):**
   - Checkout vật lý ngày hôm sau của ca qua đêm khi UI chỉ tải 1 ngày (Task 1).
   - Quyền của Manager đối với phiếu của chính mình hoặc khi phòng ban thay đổi sau lần tải (Task 2–3).
   - Chính sách thưởng/phạt lịch sử trong transaction và rollback (Task 4).
   - Tài khoản bị vô hiệu hóa sau khi socket đã kết nối (Task 5).
   - Tránh N+1 query ở trang danh sách nhân viên và phân biệt mẫu khuôn mặt bất hoạt (Task 6).
4. **Nâng cấp kiểm thử kiến trúc lên AST/Resolver (Task 8):** Thay thế hướng kiểm tra regex thủ công trong `backend/validation/architecture/fingerprint-boundary.test.ts` bằng TypeScript resolver/AST cho cả FE và BE.

---

## 3. Phân tích khoảng trống theo chuẩn **Modular Monolith** (Backend)

### 3.1. `backend/src/common/` vẫn rò rỉ logic nghiệp vụ domain (Critical ở Task 4)
Task 4 chỉ nêu di chuyển `backend/src/common/payroll-policy.ts` và `SalaryCalculationInput`/`calculateNetSalary` từ `backend/src/common/utils.ts` về `backend/src/modules/payroll/`.

**Bằng chứng thực tế trong mã nguồn:**
- `backend/src/common/payroll-rates.ts` mới là nơi định nghĩa `SalaryCalculationInput`, `PayrollBreakdown` và `computePayrollBreakdown` (`utils.ts` dòng 1–3 chỉ re-export lại từ file này).
- `backend/src/common/payroll-history.ts` chứa toàn bộ `reconciliationSchema`, `historicalAdjustmentAmount`, `historicalBreakdown`.
- Ngoài payroll, `backend/src/common/` vẫn chứa file đặc thù từng module khác:
  - `backend/src/common/attendance-timing.ts` (thuộc `attendance`)
  - `backend/src/common/biometric-crypto.ts` (thuộc `biometrics`)
  - `backend/src/common/device-auth.ts` (thuộc `devices`)
  - `buildIdOrCodeWhere`, `buildEmployeeWhere`, `employeeLockKey`, `payrollPeriodLockKey` trong `backend/src/common/utils.ts` (thuộc `employees` và `payroll`).

**Hệ quả:** Nếu thực thi Task 4 đúng như văn bản hiện tại, `payroll.calculation.ts` vẫn phải phụ thuộc ngược vào `common/payroll-rates.ts`, và `common/` vẫn còn phần lớn logic payroll.

### 3.2. Điểm lắp ráp (`server.ts`, `routes.ts`) vẫn deep-import nội bộ module (Important)
**Bằng chứng thực tế:**
- `backend/src/server.ts` (dòng 2, 14–18) đang import thẳng 6 file nội bộ:
  - `modules/biometrics/biometric.jobs.js`
  - `modules/biometrics/fingerprint.gateway.js`
  - `modules/employees/employee.jobs.js`
  - `modules/operations/operation.gateway.js`
  - `modules/operations/operation.worker.js`
  - `modules/shifts/shift-batch.service.js`
- `backend/src/routes.ts` (dòng 2) import thẳng `modules/operations/operation.routes.js` vì module `operations` chưa có `index.ts`.

**Hệ quả:** Khi bật `module-boundary.test.ts` ở Task 8, buộc phải whitelist nhiều dòng cho `server.ts` và `routes.ts` thay vì đưa toàn bộ entrypoint của module về `index.ts` hoặc `public.ts`.

### 3.3. Data Ownership và thỏa hiệp Read-Projection (Important)
- `backend/src/modules/employees/employee.model.ts` (dòng 11–41) hiện join Prisma trực tiếp sang 3 domain khác: `users`/`roles` (`auth`), `employee_shifts`/`work_shifts` (`shifts`), và `face_embeddings` (`biometrics`).
- `backend/src/modules/payroll/payroll.service.ts` (dòng 194, 225, 269) cũng include sâu `employee -> department, position, users -> roles`.
- Task 6 mới tách `face_embeddings` bằng cách xuất Prisma query descriptor từ `biometrics/public.ts`. Đây là **thỏa hiệp thực dụng để giữ 1 câu SQL tránh N+1**, nhưng vẫn để lộ kiểu/cấu trúc Prisma của `biometrics` qua public contract. Cần ghi nhận rõ đây là ngoại lệ *read-projection*, không nhân rộng sang các thao tác ghi.

### 3.4. Chưa khóa hướng phụ thuộc giữa các module (DAG / Acyclic Dependencies)
Quét import hiện tại cho thấy các module gọi chéo `public.ts` khá dày (`attendance`, `payroll`, `shifts`, `employees`, `auth`, `biometrics`), một số chiều đã dùng `*-port.ts` (`attendance.payroll-port.ts`, `shift.attendance-port.ts`, `auth.biometrics-port.ts`, `employee.integration-port.ts`) để tránh circular dependency. Tuy nhiên:
- Kế hoạch chưa quy định **Module Dependency Matrix** (module lõi nào chỉ được bị gọi, không được gọi ngược module nghiệp vụ cấp trên).
- Chưa có rule kiểm tra **không tồn tại chu trình import giữa các module** và **cấm `common/` import từ `modules/`** trong Task 8.
- Chưa đề cập vai trò của `backend/src/common/event-bus.ts` khi xử lý side-effect liên module.

---

## 4. Phân tích khoảng trống theo chuẩn **Feature-Based Architecture** (Frontend)

### 4.1. Domain state vẫn nằm ở tầng global `frontend/src/context/` (Important)
Hiện có 5 context nghiệp vụ nằm ngoài `features/`:
- `frontend/src/context/AttendanceContext.tsx`
- `frontend/src/context/EmployeeContext.tsx`
- `frontend/src/context/PayrollContext.tsx`
- `frontend/src/context/ShiftContext.tsx`
- `frontend/src/context/AuthContext.tsx`

Trong khi đó, `features/notifications/context` và `features/operations/OperationsProvider.tsx` đã theo đúng chuẩn đặt state/provider bên trong feature. Task 8 chỉ sửa đường import trong 5 file context trên để gọi `features/<name>/index.ts`, **chưa di chuyển chúng về đúng feature**.

### 4.2. Phân mảnh domain types, domain utils và domain components ở thư mục global (Important)
- **`frontend/src/types/`:** Toàn bộ domain types (`attendance.types.ts`, `payroll.types.ts`, `shift.types.ts`, `biometric.types.ts`, `employee.types.ts`, `department.types.ts`, `auth.types.ts`) vẫn nằm tập trung bên ngoài `features/`.
- **`frontend/src/utils/`:** Chứa logic nghiệp vụ thuộc từng feature như `payrollUtils.ts`, `permissionUtils.ts`, `confidence.ts`, `reportPrint.ts`.
- **`frontend/src/components/common/`:** Vẫn chứa component đặc thù domain như `AttendanceEventBadge.tsx` và `ReportExportButton.tsx`.

### 4.3. Cross-feature coupling ngang hàng chưa có giới hạn (Important)
Quét import thực tế trong `frontend/src/features/` cho thấy:
- `features/employees` đang import trực tiếp từ **4 feature khác** (`attendances`, `payrolls`, `biometrics`, `operations`) thông qua:
  - `EmployeeAttendanceTab.tsx` (`attendances`, `payrolls`)
  - `EmployeeMonthlyAverages.tsx` (`attendances`, `payrolls`)
  - `EmployeeOverviewTab.tsx` (`biometrics`)
  - `EmployeePayslipModal.tsx` (`payrolls`)
  - `employeeApi.ts`, `useEmployees.ts` (`operations`)
- `features/account` import `auth`; `features/biometrics` và `features/schedules` import `operations`.

Theo chuẩn Feature-Based (như Bulletproof React / FSD), feature không nên phụ thuộc ngang hàng nhiều chiều như vậy. Các view tổng hợp nhiều domain (ví dụ hồ sơ chi tiết nhân viên gồm tab Chấm công, Bảng lương, Sinh trắc học) nên được lắp ráp ở tầng `pages/` (`ManagerEmployeeDetail.tsx`), chỉ truyền slot/props xuống.

### 4.4. Quy ước thư mục nội bộ mỗi feature chưa thống nhất (Minor)
- `attendances`, `employees`, `payrolls`, `reports`, `schedules` dùng cấu trúc thư mục con `api/`, `components/`, `hooks/`, `utils/`.
- `devices` (`deviceApi.ts`, `deviceModeState.ts`, `useDeviceRealtime.ts`) và `operations` (`commandApi.ts`, `OperationsProvider.tsx`) để file phẳng tại root feature.
- Kế hoạch chưa quy định layout chuẩn khi thêm hoặc di chuyển file (Task 7 tạo `features/devices/hooks/useDeviceSettings.ts`, tạo thêm sự pha trộn giữa phẳng và thư mục con ngay trong `devices`).

---

## 5. Rà soát kỹ thuật chi tiết từng Task (Actionable Findings)

| Task | Mức độ | Phát hiện cụ thể từ mã nguồn | Khuyến nghị chỉnh sửa |
|---|---|---|---|
| **Task 1** (`work_date`) | **Important** | 1) `attendance.format.ts` (dòng 111–117) gọi `determinePunctuality` tự tính lại `attendanceWorkDate(eventDate, shifts)`, có thể lệch với `log.work_date` đã lưu trong DB.<br>2) `attendance_logs` trong `backend/prisma/domains/attendance.prisma` mới có `@@index([employee_id, work_date])`, chưa có index độc lập theo `work_date` (hoặc partial index cho `work_date IS NULL`). Query lọc `OR` theo `work_date` + `null` dễ quét bảng rộng khi Manager xem toàn phòng. | 1) Chốt rõ quy tắc: ưu tiên `log.work_date` khi có giá trị và truyền đồng bộ sang tính `punctuality` (hoặc giải thích rõ nếu cố ý tách).<br>2) Kiểm tra query plan với tập log lớn; nếu chậm, ghi rõ hạng mục thêm index vào kế hoạch migration riêng. |
| **Task 2** (`can_edit` & scope payroll) | **Important** | 1) `getEmployeeScope(actor, 'manage')` trong `employee.permission.ts` trả `Prisma.EmployeeWhereInput` (`{ id: { in: ids } }` hoặc `{}`). `payroll.service.ts` không nên inspect trực tiếp object Prisma `where` để tính `can_edit`.<br>2) Chưa làm rõ `can_edit` chỉ phản ánh *quyền quản lý nhân sự* hay gồm cả *trạng thái phiếu (`PENDING`)*; cũng chưa rà các màn hình khác đang dùng `frontend/src/utils/permissionUtils.ts`. | 1) Xuất helper public rõ ràng từ `employees/public.ts`, ví dụ `getManagedEmployeeIds(actor): Promise<'ALL' \| Set<string>>`.<br>2) Khóa định nghĩa tường minh của `can_edit` (và phân biệt với quyền thao tác cấp kỳ như finalize/unlock).<br>3) Quét toàn bộ caller của `isAnotherManager` / `isDifferentDepartment` để đảm bảo không sót lỗi phân quyền ở màn hình khác. |
| **Task 3** (Export lương) | **Important** | 1) Điều kiện *"đánh giá kỳ trên toàn tập được phép đọc trước bộ lọc"* có 2 cách hiểu nghiệp vụ với Manager: (a) phiếu của chính Manager nằm trong tập read nên nếu phiếu Manager còn `PENDING` sẽ chặn xuất; (b) phòng ban khác còn `PENDING` nhưng Manager vẫn xuất được phòng mình.<br>2) `ManagerPayroll.tsx` (dòng 344) đang `employees.find(...)` để lấy tên nhân viên khi dựng Excel/PDF. | 1) Xác nhận rõ quy tắc nghiệp vụ: kiểm tra điều kiện đủ chuẩn xuất theo *scope read của actor* hay *toàn kỳ hệ thống*.<br>2) Đảm bảo `PayrollRecordDto` từ `POST /period/:period/export` chứa đủ `employee_name` (và metadata cần cho Excel/PDF) để bỏ phụ thuộc vào state `employees` ở client. |
| **Task 4** (Payroll policy & calculation) | **Critical** | Bỏ sót `backend/src/common/payroll-rates.ts` và `backend/src/common/payroll-history.ts`. `utils.ts` hiện chỉ re-export `SalaryCalculationInput`, `PayrollBreakdown`, `computePayrollBreakdown` từ `payroll-rates.ts`. | Bổ sung vào Task 4 việc di chuyển cả `payroll-rates.ts` và `payroll-history.ts` về `backend/src/modules/payroll/` (gộp hoặc giữ tên tương ứng trong module payroll) và cập nhật toàn bộ import/test/scripts bằng `rg`. |
| **Task 5** (Socket auth) | **Minor / Important** | Chỉ đổi import `readAuthUser` sang `auth/public.ts` mới sửa phần *cú pháp ranh giới*. Toàn bộ logic kiểm tra `jwt.verify`, `is_active`, `token_version`, `password_changed_at`, `assertFaceSession` vẫn nằm trong `backend/src/sockets/socket.auth.ts` (dòng 25–62) và trùng lặp với `middlewares/auth.middleware.ts`. | Có thể giữ Task 5 gọn như kế hoạch ở Pha 1 để tránh đổi hành vi ngoài phạm vi, nhưng nên ghi nhận tách `resolveAuthenticatedSession(token)` về `auth/public.ts` ngay ở Pha 2 (hoặc gộp luôn nếu test đã phủ đủ). |
| **Task 6** (`face_enrolled`) | **Minor** | Đã phát hiện tốt khả năng khác biệt giữa `employee.model.ts` (không check `embedding IS NOT NULL`) và `face-login.repository.ts` (có check `embedding IS NOT NULL`). | Đặt tên export trong `biometrics/public.ts` thật tường minh (ví dụ `faceEnrollmentSummarySelect` + `hasActiveFaceEnrollment` khác biệt rõ với `hasFaceLoginTemplate`) để không bị dùng nhầm về sau. |
| **Task 7** (`useDeviceSettings`) | **Minor** | Hợp lý, gọn, rõ caller. Chỉ lưu ý cấu trúc thư mục của `features/devices/` hiện đang phẳng (`deviceApi.ts`, `useDeviceRealtime.ts`), thêm `hooks/useDeviceSettings.ts` sẽ tạo trạng thái nửa phẳng nửa phân cấp. | Ghi nhận chuẩn hóa toàn bộ `features/devices/` (`api/`, `hooks/`, `components/`, `utils/`) trong Pha 2, hoặc giữ nhất quán theo convention mới ngay từ Task 7. |
| **Task 8** (Public API & Boundary tests) | **Important** | 1) Allowlist ngoại lệ dễ biến thành "ngoại lệ vĩnh viễn" nếu không có kiểm tra dọn dẹp.<br>2) Chưa liệt kê luật cấm `common/` import ngược `modules/`, cấm circular dependency giữa các module BE, và cấm `components/common/` hoặc `utils/` của FE import `features/`. | 1) Thêm **stale-allowlist check** trong cả 2 test kiến trúc (file nằm trong allowlist mà không còn vi phạm thì test phải fail).<br>2) Bổ sung 3 rule cấm trên ngay từ lần bật đầu tiên. |

---

## 6. Đánh giá theo chuẩn Superpowers (`writing-plans` & Agentic Execution)

Kế hoạch ghi ở dòng 3: *`REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans`*. Nếu giao thẳng file kế hoạch hiện tại cho các subagent độc lập (không có lịch sử hội thoại), sẽ gặp 4 điểm nghẽn:

1. **Thiếu tài liệu Spec trên đĩa:** Dòng 11 ghi *"Kế hoạch năm đợt và tám phát hiện đã thống nhất trong cuộc trao đổi"*. Subagent chạy trong context mới sẽ **không thấy cuộc trao đổi trước đó** — mọi ràng buộc nghiệp vụ ngầm định cần được viết rõ ngay trong kế hoạch hoặc lưu thành file spec riêng tại `docs/superpowers/specs/`.
2. **Thiếu block `Files:` và `Interfaces (Consumes / Produces):` ở từng task:**
   - Task 2 và Task 3 phụ thuộc nhau nhưng không khóa rõ interface chia sẻ (`can_edit`, helper scope từ `employees/public.ts`, mã lỗi HTTP cụ thể khi export thất bại).
   - Task 6 không ghi tên chính xác của descriptor và hàm chuyển đổi xuất từ `biometrics/public.ts`.
3. **Độ mịn step còn gộp nhiều hành động:** Nhiều checkbox gộp chung viết test + sửa 3–4 file + xử lý edge case trong một gạch đầu dòng, khó dùng làm cổng review Red → Verify Fail → Implement → Verify Pass → Commit cho từng bước.
4. **Thiếu lệnh xác minh đầu ra kỳ vọng (Expected output / exact command):** Một số task chỉ ghi chung *"chạy test danh sách liên quan"* hoặc *"kiểm tra menu tại môi trường thử nghiệm"* mà chưa liệt kê đường dẫn file test cụ thể.

---

## 7. Lộ trình đề xuất để đạt đúng chuẩn hoàn chỉnh

Không nên nhồi toàn bộ refactor cấu trúc vào kế hoạch 8 task hiện tại (sẽ làm phình phạm vi và tăng rủi ro regression). Đề xuất tách thành **2 Pha rõ ràng**:

### Pha 1 — Củng cố kế hoạch hiện tại & thực thi (Boundary Hardening)
Trước khi bắt đầu Task 0, cập nhật nhanh `2026-11-19-architecture-boundaries.md` với 5 chỉnh sửa bắt buộc:
- [ ] **Task 4:** Thêm `backend/src/common/payroll-rates.ts` và `backend/src/common/payroll-history.ts` vào phạm vi di chuyển về `modules/payroll/`.
- [ ] **Task 2:** Chốt chữ ký helper `employees/public.ts` để tính `can_edit` theo batch và định nghĩa rõ ý nghĩa `can_edit`.
- [ ] **Task 1 & Task 3:** Ghi rõ quy tắc đồng bộ `work_date` với `punctuality` (Task 1) và phạm vi kiểm tra đủ điều kiện xuất lương của Manager (Task 3).
- [ ] **Task 8:** Bổ sung `stale-allowlist check`, luật cấm `common -> modules`, luật chặn circular dependency ở BE, và luật cấm `components/common` / `utils` import `features` ở FE.
- [ ] **Superpowers format:** Thêm block `Files` + `Interfaces (Consumes / Produces)` cho Task 1–8 để sẵn sàng cho `subagent-driven-development`.

### Pha 2 — Kế hoạch chuẩn hóa cấu trúc đầy đủ (Structural Alignment — tách file plan riêng sau khi Pha 1 xanh)
- **Backend (Modular Monolith hoàn chỉnh):**
  1. Dọn nốt domain files khỏi `backend/src/common/` (`attendance-timing.ts`, `biometric-crypto.ts`, `device-auth.ts`, các helper domain trong `utils.ts`).
  2. Tạo `backend/src/modules/operations/index.ts`; gom toàn bộ import trong `server.ts` và `routes.ts` qua `index.ts` / `public.ts` của từng module.
  3. Rút logic xác thực session dùng chung từ `socket.auth.ts` và `auth.middleware.ts` về `modules/auth/public.ts`.
  4. Khóa **Module Dependency Matrix (DAG)** trong `module-boundary.test.ts` và định nghĩa ranh giới rõ giữa direct public API, port, và `event-bus`.
- **Frontend (Feature-Based hoàn chỉnh):**
  1. Di chuyển 5 domain context (`Auth`, `Employee`, `Attendance`, `Shift`, `Payroll`) từ `src/context/` vào `src/features/<name>/context/` (hoặc chuyển sang TanStack Query hooks trực tiếp ở nơi không cần context toàn cục).
  2. Di chuyển domain types (`src/types/*.types.ts`), domain utils (`payrollUtils.ts`, `permissionUtils.ts`, `confidence.ts`, `reportPrint.ts`), và domain components (`AttendanceEventBadge.tsx`, `ReportExportButton.tsx`) về đúng chủ sở hữu feature.
  3. Tách ghép đa-feature trong `features/employees` (`EmployeeAttendanceTab`, `EmployeeMonthlyAverages`, `EmployeeOverviewTab`, `EmployeePayslipModal`) lên tầng composition `pages/` để giảm coupling ngang giữa các feature.
  4. Chuẩn hóa layout thư mục nội bộ (`api/`, `components/`, `hooks/`, `types/`, `utils/`, `index.ts`) cho toàn bộ `src/features/*` (đặc biệt `devices` và `operations`).
