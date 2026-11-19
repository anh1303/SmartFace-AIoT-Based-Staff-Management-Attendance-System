# Kế Hoạch Triển Khai Pha 2 — Structural Alignment (Căn Chỉnh Cấu Trúc Theo Baseline Thực Tế)

**Mốc nền (Snapshot Pha 1):** commit `e395c9b8` / tag `snapshot/phase1-architecture-boundaries`  
**Tài liệu nền & Definition of Done:** [2026-11-19-architecture-boundaries.md](./2026-11-19-architecture-boundaries.md)  
**Báo cáo kết thúc Pha 1:** [2026-11-19-architecture-boundaries-phase1-report.md](../reports/2026-11-19-architecture-boundaries-phase1-report.md)  
**Nguồn số liệu đầu vào:**
- `backend/validation/architecture/boundary-baseline.json`
- `frontend/validation/architecture/boundary-baseline.json`

---

## 1. Bảng Baseline Đầu Vào (`initialCounts` cố định tại `e395c9b8`) & Đích Nghiệm Thu Pha 2

Hai file `boundary-baseline.json` tách biệt rõ:
- **`initialCounts`** (cố định, gắn `baselineSnapshot: "e395c9b8"`): không chỉnh sửa trong suốt Pha 2 để giữ mốc lịch sử đo tiến độ.
- **`currentCounts`**: cập nhật theo từng Batch, được test kiến trúc đối chiếu khớp trực tiếp với danh sách thực tế trong manifest và cưỡng chế `currentCounts[k] <= initialCounts[k]` (nợ chỉ được giảm, không được tăng).

| Phía | Hạng mục theo dõi trong `boundary-baseline.json` | `initialCounts` (`e395c9b8`) | `currentCounts` đích (Nghiệm thu Pha 2) |
| --- | --- | :---: | :---: |
| **Backend** | Ngoại lệ bootstrap chuyển tiếp (`routes.ts`, `server.ts`) | **7** | **0** |
| **Backend** | File `src/common/` ở trạng thái `pending-move` | **3** | **0** |
| **Backend** | Export trong `common/utils.ts` ở trạng thái `pending-move` | **6** | **0** |
| **Backend** | Chu trình runtime giữa các module | **0** | **0** (không tăng) |
| **Backend** | Ngoại lệ kiến trúc nối port tại `composition.ts` (`allowed`) | **4** | Giữ riêng có review (không đưa vào danh sách tạm) |
| **Frontend** | Cạnh phụ thuộc feature ghép đa domain (`pending-move`) | **3** | **0** |
| **Frontend** | File `src/utils/` ở trạng thái `pending-move` | **3** | **0** |
| **Frontend** | File `src/types/` ở trạng thái `pending-move` | **7** | **0** |
| **Frontend** | File `src/context/` ở trạng thái `pending-move` | **5** | **0** |
| **Frontend** | Chu trình phụ thuộc feature (tính cả `import type`) | **0** | **0** (không tăng) |
| **Frontend** | Ngoại lệ chuyển tiếp (`transitionalExceptions`) | **0** | **0** (không tăng) |

---

## 2. Thứ Tự Triển Khai Theo 6 Đợt (Batch 1 → Batch 6)

Nguyên tắc xuyên suốt:
- **Mỗi Batch chốt 1 commit độc lập**, luôn giữ xanh `module-boundary.test.ts`, `module-boundaries.test.ts`, `fingerprint-boundary.test.ts`, `model-ownership.test.ts`, `feature-boundary.test.ts`, `npm run build` (BE + FE) và không sinh thêm bất kỳ Prisma migration nào.
- **Không phá tính phi chu trình**: mọi phép di chuyển phải đảm bảo `0` chu trình runtime ở Backend và `0` chu trình kiến trúc (kể cả `import type`) ở Frontend.
- **Trước khi gộp/phát hành bất kỳ thay đổi nào đụng tới chấm công hoặc bảng lương**: bắt buộc chạy kiểm thử PostgreSQL trên nhánh Neon testing (`npm run test:neon`) và đối chiếu với baseline lỗi nền ở Mục 3.

---

### Batch 1 — Chuẩn hóa 7 import bootstrap trong `server.ts` và `routes.ts` (BẮT ĐẦU TẠI ĐÂY)

**Mục tiêu:** Đưa `currentCounts.transitionalExceptions` của Backend từ **7 → 0**, toàn bộ import vào module từ `backend/src/routes.ts` và `backend/src/server.ts` đi qua entry công khai `index.ts` hoặc `public.ts` theo hợp đồng bootstrap rõ ràng.

**Phạm vi cụ thể từ `backend/validation/architecture/boundary-baseline.json`:**

| # | Consumer | Import cũ (`pending-move`) | Entry công khai đích | Ký hiệu cần xuất ở entry công khai |
| :-: | --- | --- | --- | --- |
| 1 | `routes.ts` | `./modules/operations/operation.routes.js` | `./modules/operations/index.js` *(tạo mới)* | `operationRouter` |
| 2 | `server.ts` | `./modules/operations/operation.gateway.js` | `./modules/operations/index.js` | `initializeOperationGateway` |
| 3 | `server.ts` | `./modules/operations/operation.worker.js` | `./modules/operations/index.js` | `startOperationWorker`, `stopOperationWorker`, `registerOperationHandler`, `setOperationActorLookup` |
| 4 | `server.ts` | `./modules/biometrics/fingerprint.gateway.js` | `./modules/biometrics/index.js` | `initializeFingerprintGateway` |
| 5 | `server.ts` | `./modules/biometrics/biometric.jobs.js` | `./modules/biometrics/index.js` | `executeEnrollment` |
| 6 | `server.ts` | `./modules/shifts/shift-batch.service.js` | `./modules/shifts/index.js` | `executeShiftBatch` |
| 7 | `server.ts` | `./modules/employees/employee.jobs.js` | `./modules/employees/index.js` | `executeAccountEmail` |

**Các bước thực hiện:**
- [x] **1.1.** Tạo `backend/src/modules/operations/index.ts` làm bootstrap entry của module `operations`, xuất hợp đồng router/gateway/worker phục vụ lắp ráp (`operationRouter`, `initializeOperationGateway`, `startOperationWorker`, `stopOperationWorker`, `registerOperationHandler`, `setOperationActorLookup`). Giữ nguyên `operations/public.ts` cho giao tiếp liên module.
- [x] **1.2.** Cập nhật 3 bootstrap entry hiện có:
  - `backend/src/modules/biometrics/index.ts`: bổ sung tái xuất `initializeFingerprintGateway` (từ `./fingerprint.gateway.js`) và `executeEnrollment` (từ `./biometric.jobs.js`).
  - `backend/src/modules/shifts/index.ts`: bổ sung tái xuất `executeShiftBatch` (từ `./shift-batch.service.js`).
  - `backend/src/modules/employees/index.ts`: bổ sung tái xuất `executeAccountEmail` (từ `./employee.jobs.js`).
- [x] **1.3.** Cập nhật `backend/src/routes.ts` nạp `operationRouter` từ `./modules/operations/index.js`.
- [x] **1.4.** Cập nhật `backend/src/server.ts` nạp đủ 6 ký hiệu trên từ `./modules/{operations,biometrics,shifts,employees}/index.js`.
- [x] **1.5.** Cập nhật `backend/validation/architecture/boundary-baseline.json`: xóa toàn bộ 7 ngoại lệ `kind: "bootstrap-deep-import"` và hạ `currentCounts.transitionalExceptions` về `0` (giữ nguyên `initialCounts.transitionalExceptions: 7` và 4 ngoại lệ `composition-port-wiring` có `status: "allowed"`).
- [x] **1.6.** Kiểm chứng Batch 1:
  - `cd backend && npx.cmd vitest run validation/architecture` (PASS đủ 4 bộ test kiến trúc, `0` chu trình module & file).
  - `cd backend && npm.cmd run build` (PASS).
  - **Kiểm tra khởi động `server.ts` với cấu hình test:** tách hoặc kiểm tra trực tiếp hàm đăng ký bootstrap trong `server.ts` (không chỉ dừng ở nạp `app.js` hay gọi `/health`), xác nhận:
    1. Toàn bộ 3 operation handler (`shifts.batch`, `biometric.enroll`, `employee.email`) đều được đăng ký đúng vào worker.
    2. Các gateway (`attendance`, `devices`, `fingerprint`, `operations`) và `startOperationWorker` / `stopOperationWorker` khởi chạy và dừng gọn không lỗi.
  - Chốt commit Batch 1.

---

### Batch 2 — Chuẩn hóa `backend/src/common/` (3 file) và `common/utils.ts` (6 export)

**Mục tiêu:** Đưa `currentCounts.pendingMoveCommonFiles` (3 → 0) và `currentCounts.pendingMoveCommonUtilsExports` (6 → 0) về **0**, giữ nguyên `runtimeModuleCycles = 0`.

**Quyết định kiến trúc đã chốt trước khi thực thi (không để phương án mở):**

1. **3 file `src/common/` ở trạng thái `pending-move`:**
   - **`common/device-auth.ts` (`assertDeviceWebhook`) → Di chuyển sang `modules/devices/device.auth.ts`:**
     - Xuất `assertDeviceWebhook` qua `modules/devices/public.ts`.
     - Cập nhật caller (`attendance.controller.ts`, `device.controller.ts`, `validation/devices/webhook-validation.test.ts`).
     - Đồ thị một chiều `attendance -> devices -> audit-logs` → **0 chu trình**.
   - **`common/biometric-crypto.ts` (`encryptPayload`, `decryptPayload`) → Tái định danh hạ tầng thành `common/payload-crypto.ts` (`owner: "shared"`, `status: "allowed"`):**
     - Hàm AES-256-GCM thuần dùng chung bởi cả `biometrics/fingerprint.service.ts` và `operations/operation.crypto.ts`; nếu chuyển vào `biometrics` sẽ tạo chu trình `operations <-> biometrics`.
     - Đổi tên file sang `common/payload-crypto.ts` để phản ánh đúng trách nhiệm hạ tầng mã hóa payload dùng chung, cập nhật caller và baseline.
   - **`common/attendance-timing.ts` (`traceAttendance`, `timeAttendanceStage`, `timeAttendanceQuery`) → Tổng quát hóa thành `common/perf-trace.ts` (`owner: "shared"`, `status: "allowed"`):**
     - Lý do chốt: `config/database.ts` là tầng hạ tầng dùng chung, đang trực tiếp đo thời gian truy vấn Prisma qua `timeAttendanceQuery`; hạ tầng không được phụ thuộc ngược vào `modules/attendance/`.
     - Chốt tổng quát hóa `AsyncLocalStorage` stage/query tracer tại `common/perf-trace.ts` (`owner: "shared"`, `status: "allowed"`), giữ tương thích tên hàm hoặc wrapper mỏng trong `modules/attendance/` và giữ nguyên toàn bộ test trong `validation/attendance/attendance-timing.test.ts`.

2. **6 export domain trong `backend/src/common/utils.ts` ở trạng thái `pending-move`:**
   - **`formatShiftTime`** (1 caller: `dashboard.service.ts`) → Chuyển sang `modules/shifts/` và xuất qua `modules/shifts/public.ts`.
   - **`buildEmployeeWhere`** (0 caller) → Xóa alias dư thừa.
   - **`buildIdOrCodeWhere`** (8 caller tại `attendance`, `employees`, `payroll`, `shifts`) → Chuyển sang `modules/employees/employee.model.ts` (hoặc `employee.queries.ts`) và xuất qua `modules/employees/public.ts`.
   - **`generateRandomPassword`** (1 caller prod: `employees/employee.service.ts`) → Chuyển sang `modules/auth/` và xuất qua `modules/auth/public.ts`, nối vào `employees` thông qua `employee.integration-port.ts` + `composition.ts` để không tạo cạnh runtime `employees -> auth`.
   - **`employeeLockKey` và `payrollPeriodLockKey` → Chốt chuyển sang file hạ tầng khóa dùng chung `common/lock-keys.ts` (`owner: "shared"`, `status: "allowed"`):**
     - Lý do chốt: `payrollPeriodLockKey` được gọi đồng thời bởi `payroll.service.ts`, `shift.service.ts` và `employee.service.ts` (hai module `shifts` và `employees` không được import runtime `payroll/public.ts`). Tập trung quy ước khóa PostgreSQL advisory lock tại `common/lock-keys.ts` vừa giữ 0 chu trình vừa bảo đảm một nguồn duy nhất cho không gian tên khóa.
     - **Test hợp đồng bắt buộc (Rolling-Deploy Lock Compatibility Test):** bổ sung unit test xác nhận byte-for-byte rằng `employeeLockKey('emp-123') === 'employee:emp-123'` và `payrollPeriodLockKey('2026-10') === 'payroll:2026-10'` giống hệt Pha 1, đảm bảo khi triển khai song song hai phiên bản backend vẫn khóa chung cùng một tài nguyên trong PostgreSQL.

**Kiểm chứng Batch 2:**
- [x] Cập nhật `backend/validation/architecture/boundary-baseline.json` (`currentCounts.pendingMoveCommonFiles: 0`, `currentCounts.pendingMoveCommonUtilsExports: 0`; giữ nguyên `initialCounts`).
- [x] Chạy `npm.cmd run build`, `npx.cmd tsc --noEmit -p prisma/tsconfig.json`, `npx.cmd vitest run validation`.
- [x] Chạy `npm.cmd run test:neon` cho các bộ integration chạm tới `attendance`, `payroll`, `employees`, `shifts`.
- [x] Chốt commit Batch 2.

---

### Batch 3 — Tách 3 cạnh ghép đa feature của `employees` lên tầng `pages/` (LÀM TRƯỚC BATCH 4–5)

**Lý do đảo thứ tự (làm trước Batch 4 & Batch 5):**
- Feature `biometrics` hiện đang dùng cả kiểu `Employee` (từ `src/types/employee.types.ts`) và `permissionUtils` (từ `src/utils/permissionUtils.ts`).
- Nếu di chuyển `permissionUtils` hoặc `employee.types.ts` vào `features/employees` trước khi gỡ cạnh `employees -> biometrics`, sẽ ngay lập tức phát sinh chu trình hai chiều `employees <-> biometrics` và làm đỏ `feature-boundary.test.ts`.
- Gỡ 3 cạnh ghép đa feature của `employees` trước sẽ cắt đứt chiều `employees -> {attendances, biometrics, payrolls}`, tạo mặt bằng DAG sạch cho Batch 4 và Batch 5.

**3 cạnh cần xử lý từ `frontend/validation/architecture/boundary-baseline.json`:**
- `employees -> attendances` (`EmployeeAttendanceTab.tsx`, `EmployeeMonthlyAverages.tsx`)
- `employees -> biometrics` (`EmployeeOverviewTab.tsx`)
- `employees -> payrolls` (`EmployeeAttendanceTab.tsx`, `EmployeeMonthlyAverages.tsx`, `EmployeePayslipModal.tsx`)

**Các bước thực hiện:**
- [x] Đưa các view lắp ghép đa domain lên tầng `frontend/src/pages/manager/ManagerEmployeeDetail.tsx` (hoặc tách thành slot/props do `pages/` lắp ghép từ entry công khai của từng feature `attendances`, `biometrics`, `payrolls`, `employees`).
- [x] Cập nhật `frontend/validation/architecture/boundary-baseline.json` (`currentCounts.pendingMoveFeatureEdges: 0`, xóa 3 cạnh đã gỡ khỏi `featureDependencyMatrix`; giữ nguyên `initialCounts`).
- [x] Kiểm chứng: `cd frontend && npm.cmd run build && npx.cmd vitest run validation src/utils/__tests__`.
- [x] Chốt commit Batch 3.

---

### Batch 4 — Di chuyển 3 domain utils và 7 domain types ở Frontend

**Mục tiêu:** Đưa `currentCounts.pendingMoveUtilFiles` (3 → 0) và `currentCounts.pendingMoveTypeFiles` (7 → 0) về **0**, chỉ giữ lại các tiện ích và kiểu thực sự dùng chung trong `frontend/src/utils/` và `frontend/src/types/`.

**Danh sách di chuyển từ `frontend/validation/architecture/boundary-baseline.json`:**
1. **3 file `src/utils/`:**
   - `utils/confidence.ts` → `features/attendances/utils/confidence.ts` (xuất qua `features/attendances/index.ts`; cập nhật 3 caller).
   - `utils/payrollUtils.ts` → `features/payrolls/utils/payrollUtils.ts` (xuất qua `features/payrolls/index.ts`; cập nhật 4 caller + 3 file test payroll).
   - `utils/permissionUtils.ts` → `features/employees/utils/permissionUtils.ts` (xuất qua `features/employees/index.ts`; sau Batch 3 cạnh `biometrics -> employees` là một chiều hoàn toàn hợp lệ, đăng ký rõ lý do trong `featureDependencyMatrix` nếu `biometrics` còn dùng).
2. **7 file `src/types/`:**
   - `types/attendance.types.ts` → `features/attendances/types.ts` (`export type *` qua `features/attendances/index.ts`).
   - `types/auth.types.ts` → `features/auth/types.ts` (`export type *` qua `features/auth/index.ts`).
   - `types/biometric.types.ts` → `features/biometrics/types.ts` (`export type *` qua `features/biometrics/index.ts`).
   - `types/department.types.ts` & `types/employee.types.ts` → `features/employees/types.ts` (`export type *` qua `features/employees/index.ts`).
   - `types/payroll.types.ts` → `features/payrolls/types.ts` (`export type *` qua `features/payrolls/index.ts`).
   - `types/shift.types.ts` → `features/schedules/types.ts` (`export type *` qua `features/schedules/index.ts`).
   - Kiểm soát ma trận phụ thuộc kiểu (vì `feature-boundary.test.ts` tính cả `import type` vào đồ thị chu trình): mọi kiểu chia sẻ nhiều feature (như `Role`) chốt một hướng duy nhất (ví dụ các feature khác phụ thuộc một chiều vào `auth` hoặc `types/common.types.ts`), tuyệt đối không tạo cạnh hai chiều.

**Kiểm chứng Batch 4:**
- [ ] Cập nhật `frontend/validation/architecture/boundary-baseline.json` (`currentCounts.pendingMoveUtilFiles: 0`, `currentCounts.pendingMoveTypeFiles: 0`; giữ nguyên `initialCounts`).
- [ ] Chạy `cd frontend && npm.cmd run build && npx.cmd vitest run validation src/utils/__tests__`.
- [ ] Chốt commit Batch 4.

---

### Batch 5 — Di chuyển 5 domain providers khỏi `frontend/src/context/`

**Mục tiêu:** Đưa `currentCounts.pendingMoveContextFiles` (5 → 0). `frontend/src/context/` chỉ còn lại `AppContext.tsx`, `ThemeContext.tsx`, `ToastContext.tsx`, `index.ts`.

**Thứ tự di chuyển theo bán kính ảnh hưởng tăng dần:**
1. `context/AttendanceContext.tsx` (3 caller) → `features/attendances/context/AttendanceContext.tsx`
2. `context/PayrollContext.tsx` (5 caller) → `features/payrolls/context/PayrollContext.tsx`
3. `context/ShiftContext.tsx` (9 caller) → `features/schedules/context/ShiftContext.tsx`
4. `context/EmployeeContext.tsx` (14 caller) → `features/employees/context/EmployeeContext.tsx`
5. `context/AuthContext.tsx` (49 caller) → `features/auth/context/AuthContext.tsx`

**Quy tắc bắt buộc chống vòng lặp self-barrel:**
- Mọi consumer **bên ngoài** feature (như `AppContext.tsx`, `providers/`, `pages/`, feature khác) gọi provider qua entry công khai `features/<name>/index.ts`.
- Mọi file **bên trong cùng feature** (hooks, components, api) phải import provider theo **đường dẫn tương đối nội bộ** (ví dụ `../context/AuthContext`), **không** đi vòng qua `features/<name>/index.ts` đang tái xuất chính provider đó.

**Kiểm chứng Batch 5:**
- [ ] Cập nhật `frontend/validation/architecture/boundary-baseline.json` (`currentCounts.pendingMoveContextFiles: 0`; giữ nguyên `initialCounts`).
- [ ] Chạy `cd frontend && npm.cmd run build && npx.cmd vitest run validation src/utils/__tests__` (kiểm tra kỹ `logout-login-race.test.tsx`, `attendance-live-pages.test.tsx`, `face-login-modal.test.tsx`).
- [ ] Chốt commit Batch 5.

---

### Batch 6 — Nghiệm Thu Pha 2 Theo Definition of Done

- [ ] Giữ nguyên `initialCounts` (mốc cố định tại `e395c9b8`) trong cả hai file `boundary-baseline.json` làm lịch sử đối chiếu, đồng thời mở rộng `module-boundary.test.ts` và `feature-boundary.test.ts` cưỡng chế trực tiếp điều kiện nghiệm thu Pha 2 (`phase: 2`):
  - Backend: mọi mục trong `currentCounts` thuộc danh sách chuyển tiếp (`pendingMoveCommonFiles`, `pendingMoveCommonUtilsExports`, `transitionalExceptions`, `runtimeModuleCycles`) đều bằng **`0`**; 4 ngoại lệ nối port tại `composition.ts` nằm riêng trong danh sách `allowed`.
  - Frontend: mọi mục trong `currentCounts` (`pendingMoveContextFiles`, `pendingMoveTypeFiles`, `pendingMoveUtilFiles`, `pendingMoveFeatureEdges`, `transitionalExceptions`, `featureCycles`) đều bằng **`0`**.
- [ ] Chạy đồng thời:
  - `cd backend && npm.cmd run build && npx.cmd tsc --noEmit -p prisma/tsconfig.json && npx.cmd vitest run validation`
  - `cd backend && npm.cmd run test:neon` (đối chiếu cả phần xanh và danh sách lỗi nền Mục 3)
  - `cd frontend && npm.cmd run build && npx.cmd vitest run validation src/utils/__tests__`
- [ ] Kiểm tra `git diff --check`, xác nhận không sinh migration mới, lập báo cáo nghiệm thu Pha 2.

---

## 3. Bằng Chứng Tiền Phát Hành: Đường `prisma migrate deploy` & Baseline 4 Test Đỏ Neon

### 3.1. Kiểm chứng đường triển khai `prisma migrate deploy` thực tế (Neon DB cô lập)
Đã sửa cấu hình `prismaSchemaFolder` theo chuẩn Prisma 5.22 (`backend/prisma/schema/` + `"prisma": { "schema": "prisma/schema" }` trong `backend/package.json`) và chạy kiểm chứng trực tiếp trên DB tạm cô lập (`smartface_test_779032cd5e955290` tại nhánh Neon testing):
- **Lần chạy 1 (`prisma migrate deploy`):** Exit `0` — `Prisma schema loaded from prisma\schema`, tìm thấy đủ **23 migrations** trong `prisma/migrations`, `All migrations have been successfully applied.`
- **Lần chạy 2 (`prisma migrate deploy`):** Exit `0` — `23 migrations found in prisma/migrations`, `No pending migrations to apply.`
- **Trạng thái (`prisma migrate status`):** Exit `0` — `Database schema is up to date!`
- **Dọn dẹp:** DB tạm đã được `DROP DATABASE ... WITH (FORCE)` sau khi kiểm chứng.

### 3.2. Bằng chứng đối chứng 4 test đỏ trên mốc trước Pha 1 (`327aae1a`)
Đã dựng git worktree độc lập tại commit `327aae1a` (*"Fix provisional payroll cutoff and align sorting indicators"*, ngay trước Pha 1) và chạy đúng 2 bộ test `adjustments.integration.test.ts` và `attendance.integration.test.ts` trên DB tạm Neon cô lập với cùng fixture và cùng mốc thời gian cố định (`vi.setSystemTime`):

| # | File & Vị trí | Tên test | Mốc thời gian cố định | Assertion tại `327aae1a` (trước Pha 1) | Assertion tại Pha 1 | Kết luận |
| :-: | --- | --- | --- | --- | --- | --- |
| 1 | `validation/payroll/adjustments.integration.test.ts:104` | `invalidates reviewed absence when scans arrive, retaining the old decision in audit` | `2026-10-20T20:00:00+07:00` | `AssertionError: expected null to be 'Vắng'` | Trùng khớp 100% | **Lỗi nền có sẵn trước Pha 1** |
| 2 | `validation/payroll/adjustments.integration.test.ts:197` | `batch-updates an already reviewed item when its source shift changes` | `2026-10-20T20:00:00+07:00` | `AssertionError: expected null to be 'Đã xác nhận'` | Trùng khớp 100% | **Lỗi nền có sẵn trước Pha 1** |
| 3 | `validation/attendance/attendance.integration.test.ts:103` | `generates zero-safe wages, snapshots rates and blocks stale finalize` | `2026-10-02T22:00:00+07:00` | `AssertionError: expected +0 to be 9.5` | Trùng khớp 100% | **Lỗi nền có sẵn trước Pha 1** (cutoff `work_date < today` từ `327aae1a`) |
| 4 | `validation/attendance/attendance.integration.test.ts:114` | `preserves finalized wages and blocks edits/generation on a closed row` | `2026-10-02T22:00:00+07:00` | `AssertionError: expected [Function] to throw /chưa kết thúc/ but got 'Các khoản OT/phạt đã thay đổi; cần tí…'` | Trùng khớp 100% | **Lỗi nền có sẵn trước Pha 1** (hệ quả từ cutoff ca #3) |

> [!WARNING]
> Mặc dù 4 test trên đã được chứng minh là lỗi nền tồn tại sẵn tại `327aae1a` (không phải hồi quy do Pha 1), **không được coi toàn bộ suite Neon là đã xanh hoàn toàn** cho tới khi 4 test nền này được rà soát và xử lý ở một hạng mục riêng trước khi phát hành chính thức. Các bài kiểm thử mới của Pha 1 (`phase1-overnight-payroll-export.integration.test.ts`: **2/2 PASS**), toàn bộ các ca **ca qua đêm** trong `adjustments.integration.test.ts`, và các suite `workflow.regression`, `approval-aggregation`, `policy-storage`, `socket-auth` đều **PASS 100%** trên Neon.
