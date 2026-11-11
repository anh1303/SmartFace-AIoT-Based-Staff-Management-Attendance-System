# Kiểm kê mã nguồn

Danh sách được tạo bằng cách đọc tự động từng file mã nguồn trong `frontend/src` và `backend/src`. Bảng cho biết đường dẫn và import; chưa phải kết quả đánh giá thủ công từng file.

| File | Area | Lines | Feature/module imports |
|---|---|---:|---|
| `frontend/src/api/client.ts` | api | 194 |  |
| `frontend/src/api/index.ts` | api | 10 | `../features/auth/api/authApi`, `../features/employees/api/employeeApi`, `../features/attendances/api/attendanceApi`, `../features/schedules/api/shiftApi`, `../features/payrolls/api/payrollApi`, `../features/biometrics/api/biometricApi`, `../features/employees/api/positionApi`, `../features/employees/api/departmentApi`, `../features/devices/deviceApi` |
| `frontend/src/App.tsx` | App.tsx | 15 |  |
| `frontend/src/components/common/ActionFeedback.tsx` | components | 55 |  |
| `frontend/src/components/common/AttendanceEventBadge.tsx` | components | 4 |  |
| `frontend/src/components/common/Avatar.tsx` | components | 3 |  |
| `frontend/src/components/common/DonutChart.tsx` | components | 123 |  |
| `frontend/src/components/common/Drawer.tsx` | components | 128 |  |
| `frontend/src/components/common/ErrorBoundary.tsx` | components | 146 |  |
| `frontend/src/components/common/FilterBar.tsx` | components | 16 |  |
| `frontend/src/components/common/FilterSelect.tsx` | components | 207 |  |
| `frontend/src/components/common/index.ts` | components | 11 |  |
| `frontend/src/components/common/LoadingScreen.tsx` | components | 50 |  |
| `frontend/src/components/common/Modal.tsx` | components | 89 |  |
| `frontend/src/components/common/PageHeaderBanner.tsx` | components | 16 |  |
| `frontend/src/components/common/ReportExportButton.tsx` | components | 25 |  |
| `frontend/src/components/common/SearchInput.tsx` | components | 54 |  |
| `frontend/src/components/common/Table.tsx` | components | 349 |  |
| `frontend/src/components/common/Toast.tsx` | components | 49 | `../../features/notifications/components/NotificationContent` |
| `frontend/src/components/common/useDialogFocus.ts` | components | 45 |  |
| `frontend/src/components/layout/AppLayout.tsx` | components | 5 |  |
| `frontend/src/components/layout/QuickSettingsMenu.tsx` | components | 795 | `../../features/attendances/hooks/useDeviceSettings` |
| `frontend/src/components/layout/Sidebar.tsx` | components | 46 |  |
| `frontend/src/components/layout/Topbar.tsx` | components | 102 | `../../features/notifications` |
| `frontend/src/components/public/PublicThemeToggle.tsx` | components | 11 |  |
| `frontend/src/config/index.ts` | config | 11 |  |
| `frontend/src/content/solutionPlans.ts` | content | 1 |  |
| `frontend/src/context/AppContext.tsx` | context | 28 | `../features/notifications`, `../features/operations` |
| `frontend/src/context/AttendanceContext.tsx` | context | 48 | `../features/attendances/hooks/useAttendance` |
| `frontend/src/context/AuthContext.tsx` | context | 294 | `@/features/auth`, `../features/notifications` |
| `frontend/src/context/EmployeeContext.tsx` | context | 57 | `../features/employees/hooks/useEmployees` |
| `frontend/src/context/index.ts` | context | 8 |  |
| `frontend/src/context/PayrollContext.tsx` | context | 67 | `../features/payrolls/hooks/usePayroll` |
| `frontend/src/context/ShiftContext.tsx` | context | 45 | `../features/schedules/hooks/useShifts` |
| `frontend/src/context/ThemeContext.tsx` | context | 79 |  |
| `frontend/src/context/ToastContext.tsx` | context | 46 | `../features/notifications` |
| `frontend/src/features/account/components/AccountProfilePage.tsx` | account | 116 | `@/features/auth` |
| `frontend/src/features/account/components/PasswordForm.tsx` | account | 71 | `@/features/auth` |
| `frontend/src/features/account/index.ts` | account | 1 |  |
| `frontend/src/features/attendances/api/attendanceApi.ts` | attendances | 144 |  |
| `frontend/src/features/attendances/components/AttendanceDayDetails.tsx` | attendances | 246 |  |
| `frontend/src/features/attendances/components/AttendanceEditModal.tsx` | attendances | 346 |  |
| `frontend/src/features/attendances/components/AttendanceFilters.tsx` | attendances | 153 |  |
| `frontend/src/features/attendances/components/AttendanceHeader.tsx` | attendances | 95 |  |
| `frontend/src/features/attendances/components/AttendanceTable.tsx` | attendances | 384 |  |
| `frontend/src/features/attendances/components/DeviceStatusCards.tsx` | attendances | 74 |  |
| `frontend/src/features/attendances/components/LiveEventFeed.tsx` | attendances | 125 |  |
| `frontend/src/features/attendances/components/WebRTCPlayer.tsx` | attendances | 520 |  |
| `frontend/src/features/attendances/hooks/useAttendance.ts` | attendances | 89 |  |
| `frontend/src/features/attendances/hooks/useAttendanceLocks.ts` | attendances | 73 |  |
| `frontend/src/features/attendances/hooks/useAttendancePairs.ts` | attendances | 665 |  |
| `frontend/src/features/attendances/hooks/useAttendanceSocket.ts` | attendances | 244 |  |
| `frontend/src/features/attendances/hooks/useAttendanceSummaries.ts` | attendances | 211 |  |
| `frontend/src/features/attendances/hooks/useDevices.ts` | attendances | 36 |  |
| `frontend/src/features/attendances/hooks/useDeviceSettings.ts` | attendances | 410 |  |
| `frontend/src/features/attendances/hooks/useEmployeeAttendanceDetail.ts` | attendances | 95 |  |
| `frontend/src/features/attendances/hooks/useEmployeeOverview.ts` | attendances | 25 |  |
| `frontend/src/features/attendances/hooks/useRawLogsPagination.ts` | attendances | 69 |  |
| `frontend/src/features/attendances/index.ts` | attendances | 27 |  |
| `frontend/src/features/attendances/utils/csvExport.ts` | attendances | 90 |  |
| `frontend/src/features/auth/api/authApi.ts` | auth | 133 |  |
| `frontend/src/features/auth/api/faceLoginApi.ts` | auth | 27 |  |
| `frontend/src/features/auth/api/profileApi.ts` | auth | 5 |  |
| `frontend/src/features/auth/components/FaceLoginModal.tsx` | auth | 94 |  |
| `frontend/src/features/auth/components/PasswordReauthentication.tsx` | auth | 21 |  |
| `frontend/src/features/auth/index.ts` | auth | 5 |  |
| `frontend/src/features/auth/lib/faceCamera.ts` | auth | 27 |  |
| `frontend/src/features/biometrics/api/biometricApi.ts` | biometrics | 65 |  |
| `frontend/src/features/biometrics/components/BiometricsConfirmationModals.tsx` | biometrics | 259 |  |
| `frontend/src/features/biometrics/components/BiometricsEmployeeTable.tsx` | biometrics | 168 |  |
| `frontend/src/features/biometrics/components/BiometricsHeader.tsx` | biometrics | 9 |  |
| `frontend/src/features/biometrics/components/BiometricStatusBadge.tsx` | biometrics | 78 |  |
| `frontend/src/features/biometrics/components/CameraEkycModal.tsx` | biometrics | 620 |  |
| `frontend/src/features/biometrics/components/EmployeeBiometricsCard.tsx` | biometrics | 207 |  |
| `frontend/src/features/biometrics/components/FaceEnrollmentSection.tsx` | biometrics | 181 |  |
| `frontend/src/features/biometrics/components/FingerprintEnrollmentSection.tsx` | biometrics | 94 |  |
| `frontend/src/features/biometrics/components/ManageBiometricsModal.tsx` | biometrics | 173 |  |
| `frontend/src/features/biometrics/hooks/useBiometricEnrollment.ts` | biometrics | 473 |  |
| `frontend/src/features/biometrics/hooks/useFingerprintEnrollment.ts` | biometrics | 146 |  |
| `frontend/src/features/biometrics/index.ts` | biometrics | 12 |  |
| `frontend/src/features/dashboard/api/dashboardApi.ts` | dashboard | 98 |  |
| `frontend/src/features/dashboard/components/DashboardAlertsCard.tsx` | dashboard | 81 |  |
| `frontend/src/features/dashboard/components/DashboardDepartmentProgress.tsx` | dashboard | 146 |  |
| `frontend/src/features/dashboard/components/DashboardPunctualityDonut.tsx` | dashboard | 80 |  |
| `frontend/src/features/dashboard/components/DashboardRecentLogsTable.tsx` | dashboard | 115 |  |
| `frontend/src/features/dashboard/components/DashboardSummaryKpis.tsx` | dashboard | 93 |  |
| `frontend/src/features/dashboard/components/DashboardTodayShifts.tsx` | dashboard | 113 |  |
| `frontend/src/features/dashboard/hooks/useDashboard.ts` | dashboard | 22 |  |
| `frontend/src/features/dashboard/index.ts` | dashboard | 11 |  |
| `frontend/src/features/devices/components/DeviceKioskSettingsPanel.tsx` | devices | 691 |  |
| `frontend/src/features/devices/deviceApi.ts` | devices | 41 |  |
| `frontend/src/features/devices/deviceModeState.ts` | devices | 6 |  |
| `frontend/src/features/devices/index.ts` | devices | 4 |  |
| `frontend/src/features/devices/useDeviceRealtime.ts` | devices | 34 |  |
| `frontend/src/features/employees/api/departmentApi.ts` | employees | 43 |  |
| `frontend/src/features/employees/api/employeeApi.ts` | employees | 157 |  |
| `frontend/src/features/employees/api/positionApi.ts` | employees | 64 |  |
| `frontend/src/features/employees/components/AddEmployeeModal.tsx` | employees | 208 |  |
| `frontend/src/features/employees/components/DepartmentPositionDrawer.tsx` | employees | 262 |  |
| `frontend/src/features/employees/components/DepartmentTabContent.tsx` | employees | 390 |  |
| `frontend/src/features/employees/components/EditEmployeeModal.tsx` | employees | 204 |  |
| `frontend/src/features/employees/components/EmployeeAccountTab.tsx` | employees | 285 |  |
| `frontend/src/features/employees/components/EmployeeActionModals.tsx` | employees | 151 |  |
| `frontend/src/features/employees/components/EmployeeAttendanceTab.tsx` | employees | 204 | `@/features/attendances` |
| `frontend/src/features/employees/components/EmployeeDetailHeader.tsx` | employees | 255 |  |
| `frontend/src/features/employees/components/EmployeeListFilters.tsx` | employees | 78 |  |
| `frontend/src/features/employees/components/EmployeeListHeader.tsx` | employees | 68 |  |
| `frontend/src/features/employees/components/EmployeeMonthlyAverages.tsx` | employees | 41 |  |
| `frontend/src/features/employees/components/EmployeeOverviewTab.tsx` | employees | 181 | `@/features/biometrics` |
| `frontend/src/features/employees/components/EmployeePayrollTab.tsx` | employees | 108 |  |
| `frontend/src/features/employees/components/EmployeePayslipModal.tsx` | employees | 88 |  |
| `frontend/src/features/employees/components/EmployeeScheduleTab.tsx` | employees | 262 |  |
| `frontend/src/features/employees/components/EmployeeTable.tsx` | employees | 255 |  |
| `frontend/src/features/employees/components/PositionTabContent.tsx` | employees | 423 |  |
| `frontend/src/features/employees/hooks/useDepartmentPositionManager.ts` | employees | 377 |  |
| `frontend/src/features/employees/hooks/useDepartmentPositions.ts` | employees | 168 |  |
| `frontend/src/features/employees/hooks/useEmployees.ts` | employees | 115 |  |
| `frontend/src/features/employees/index.ts` | employees | 35 |  |
| `frontend/src/features/employees/utils/__tests__/employeeExport.test.ts` | employees | 120 |  |
| `frontend/src/features/employees/utils/employeeExport.ts` | employees | 79 |  |
| `frontend/src/features/employees/utils/employeeUtils.ts` | employees | 24 |  |
| `frontend/src/features/employees/utils/monthlyAverages.ts` | employees | 38 |  |
| `frontend/src/features/notifications/components/FloatingNotificationBubble.tsx` | notifications | 9 |  |
| `frontend/src/features/notifications/components/NotificationContent.tsx` | notifications | 34 |  |
| `frontend/src/features/notifications/components/NotificationEmptyState.tsx` | notifications | 27 |  |
| `frontend/src/features/notifications/components/NotificationItem.tsx` | notifications | 25 |  |
| `frontend/src/features/notifications/context/NotificationContext.tsx` | notifications | 217 |  |
| `frontend/src/features/notifications/hooks/useDraggable.ts` | notifications | 180 |  |
| `frontend/src/features/notifications/index.ts` | notifications | 17 |  |
| `frontend/src/features/notifications/notificationHistory.ts` | notifications | 17 |  |
| `frontend/src/features/notifications/types/notification.types.ts` | notifications | 28 |  |
| `frontend/src/features/notifications/utils/timeAgo.ts` | notifications | 42 |  |
| `frontend/src/features/operations/commandApi.ts` | operations | 99 |  |
| `frontend/src/features/operations/index.ts` | operations | 2 |  |
| `frontend/src/features/operations/OperationsProvider.tsx` | operations | 74 |  |
| `frontend/src/features/payrolls/api/payrollApi.ts` | payrolls | 112 |  |
| `frontend/src/features/payrolls/components/AdjustmentReviewPanel.tsx` | payrolls | 67 |  |
| `frontend/src/features/payrolls/components/EarlySettlementModal.tsx` | payrolls | 170 |  |
| `frontend/src/features/payrolls/components/PayrollActionModals.tsx` | payrolls | 144 |  |
| `frontend/src/features/payrolls/components/PayrollHeader.tsx` | payrolls | 114 |  |
| `frontend/src/features/payrolls/components/PayrollItemEditModal.tsx` | payrolls | 72 |  |
| `frontend/src/features/payrolls/components/PayrollPolicyModal.tsx` | payrolls | 201 |  |
| `frontend/src/features/payrolls/components/PayrollSummaryCards.tsx` | payrolls | 146 |  |
| `frontend/src/features/payrolls/components/PayrollTable.tsx` | payrolls | 56 |  |
| `frontend/src/features/payrolls/components/PayslipBreakdown.tsx` | payrolls | 38 |  |
| `frontend/src/features/payrolls/hooks/useEmployeePayrollDetail.ts` | payrolls | 41 |  |
| `frontend/src/features/payrolls/hooks/usePayroll.ts` | payrolls | 119 |  |
| `frontend/src/features/payrolls/index.ts` | payrolls | 13 |  |
| `frontend/src/features/payrolls/payrollExportEligibility.ts` | payrolls | 9 |  |
| `frontend/src/features/reports/api/reportsApi.ts` | reports | 30 |  |
| `frontend/src/features/reports/components/ExportReportsModal.tsx` | reports | 157 |  |
| `frontend/src/features/reports/components/ReportsBiometricAndPunctualityCharts.tsx` | reports | 304 |  |
| `frontend/src/features/reports/components/ReportsBreakdownAndLeaderboard.tsx` | reports | 193 |  |
| `frontend/src/features/reports/components/ReportsChartsSection.tsx` | reports | 144 |  |
| `frontend/src/features/reports/components/ReportsDateToolbar.tsx` | reports | 96 |  |
| `frontend/src/features/reports/components/ReportsDepartmentTable.tsx` | reports | 172 |  |
| `frontend/src/features/reports/components/ReportsEmployeeLeaderboard.tsx` | reports | 257 |  |
| `frontend/src/features/reports/components/ReportsHeader.tsx` | reports | 54 |  |
| `frontend/src/features/reports/components/ReportsSummaryKpis.tsx` | reports | 141 |  |
| `frontend/src/features/reports/hooks/useMonthlyReport.ts` | reports | 21 |  |
| `frontend/src/features/reports/index.ts` | reports | 12 |  |
| `frontend/src/features/reports/utils/__tests__/monthlyReportExport.test.ts` | reports | 38 |  |
| `frontend/src/features/reports/utils/monthlyReportExport.ts` | reports | 56 |  |
| `frontend/src/features/schedules/api/shiftApi.ts` | schedules | 33 |  |
| `frontend/src/features/schedules/components/BulkShiftModal.test.tsx` | schedules | 32 |  |
| `frontend/src/features/schedules/components/BulkShiftModal.tsx` | schedules | 299 |  |
| `frontend/src/features/schedules/components/ScheduleHeader.tsx` | schedules | 140 |  |
| `frontend/src/features/schedules/components/ScheduleLegend.tsx` | schedules | 27 |  |
| `frontend/src/features/schedules/components/ScheduleMatrixTable.tsx` | schedules | 180 |  |
| `frontend/src/features/schedules/components/ScheduleWeekNavigator.tsx` | schedules | 72 |  |
| `frontend/src/features/schedules/components/ShiftEditModal.tsx` | schedules | 229 |  |
| `frontend/src/features/schedules/components/ShiftTemplates.tsx` | schedules | 22 |  |
| `frontend/src/features/schedules/components/ShiftTimeInput.tsx` | schedules | 120 |  |
| `frontend/src/features/schedules/hooks/useShifts.ts` | schedules | 38 |  |
| `frontend/src/features/schedules/index.ts` | schedules | 14 |  |
| `frontend/src/features/schedules/utils/__tests__/scheduleExport.test.ts` | schedules | 215 |  |
| `frontend/src/features/schedules/utils/scheduleExport.ts` | schedules | 175 |  |
| `frontend/src/hooks/index.ts` | hooks | 2 | `../features/employees/hooks/useEmployees`, `../features/payrolls/hooks/usePayroll` |
| `frontend/src/lib/queryClient.ts` | lib | 41 |  |
| `frontend/src/main.tsx` | main.tsx | 10 |  |
| `frontend/src/mocks/demoAdapter.ts` | mocks | 233 | `@/features/payrolls`, `@/features/devices` |
| `frontend/src/pages/account/AccountProfilePage.tsx` | pages | 1 | `../../features/account` |
| `frontend/src/pages/employee/EmployeeAttendance.tsx` | pages | 34 | `../../features/employees` |
| `frontend/src/pages/employee/EmployeeBiometrics.tsx` | pages | 27 |  |
| `frontend/src/pages/employee/EmployeeDashboard.tsx` | pages | 56 | `../../features/notifications`, `../../features/attendances` |
| `frontend/src/pages/employee/employeePresentation.ts` | pages | 8 |  |
| `frontend/src/pages/employee/EmployeeProfile.tsx` | pages | 10 |  |
| `frontend/src/pages/employee/EmployeeSalaryEstimate.tsx` | pages | 31 | `../../features/payrolls` |
| `frontend/src/pages/employee/EmployeeSchedule.tsx` | pages | 58 |  |
| `frontend/src/pages/manager/hooks/useEmployeeDetailData.ts` | pages | 58 | `@/features/attendances`, `@/features/payrolls` |
| `frontend/src/pages/manager/ManagerAttendanceMonitor.tsx` | pages | 510 | `@/features/employees`, `@/features/attendances`, `@/features/attendances` |
| `frontend/src/pages/manager/ManagerBiometrics.tsx` | pages | 321 | `@/features/employees`, `@/features/biometrics` |
| `frontend/src/pages/manager/ManagerDashboard.tsx` | pages | 98 | `@/features/dashboard` |
| `frontend/src/pages/manager/ManagerDevices.tsx` | pages | 203 | `@/features/devices`, `../../features/devices` |
| `frontend/src/pages/manager/ManagerEmployeeDetail.tsx` | pages | 422 | `@/features/employees` |
| `frontend/src/pages/manager/ManagerEmployeeList.tsx` | pages | 337 | `@/features/employees` |
| `frontend/src/pages/manager/ManagerPayroll.tsx` | pages | 501 | `@/features/employees`, `@/features/payrolls`, `@/features/payrolls` |
| `frontend/src/pages/manager/ManagerReports.tsx` | pages | 115 | `@/features/reports`, `@/features/reports` |
| `frontend/src/pages/manager/ManagerSchedule.tsx` | pages | 442 | `../../features/operations`, `../../features/schedules`, `@/features/schedules`, `@/features/employees` |
| `frontend/src/pages/public/CompanyPolicyPage.tsx` | pages | 7 |  |
| `frontend/src/pages/public/LandingPage.tsx` | pages | 7 |  |
| `frontend/src/pages/public/LoginPage.tsx` | pages | 31 | `../../features/auth` |
| `frontend/src/pages/public/SolutionInquirySection.tsx` | pages | 7 |  |
| `frontend/src/providers/AppProviders.tsx` | providers | 40 |  |
| `frontend/src/providers/index.ts` | providers | 1 |  |
| `frontend/src/routes/accountRoutes.tsx` | routes | 6 |  |
| `frontend/src/routes/employeeRoutes.tsx` | routes | 45 |  |
| `frontend/src/routes/guards/AuthGuard.tsx` | routes | 44 |  |
| `frontend/src/routes/guards/PublicGuard.test.tsx` | routes | 19 |  |
| `frontend/src/routes/guards/PublicGuard.tsx` | routes | 36 |  |
| `frontend/src/routes/index.tsx` | routes | 30 |  |
| `frontend/src/routes/managerRoutes.tsx` | routes | 55 |  |
| `frontend/src/routes/publicRoutes.tsx` | routes | 28 |  |
| `frontend/src/routes/staffRoutes.tsx` | routes | 18 |  |
| `frontend/src/types/api.types.ts` | types | 21 |  |
| `frontend/src/types/attendance.types.ts` | types | 35 |  |
| `frontend/src/types/auth.types.ts` | types | 26 |  |
| `frontend/src/types/biometric.types.ts` | types | 15 |  |
| `frontend/src/types/common.types.ts` | types | 6 |  |
| `frontend/src/types/department.types.ts` | types | 22 |  |
| `frontend/src/types/employee.types.ts` | types | 34 |  |
| `frontend/src/types/index.ts` | types | 13 |  |
| `frontend/src/types/payroll.types.ts` | types | 48 |  |
| `frontend/src/types/shift.types.ts` | types | 14 |  |
| `frontend/src/utils/__tests__/excelExport.test.ts` | utils | 59 |  |
| `frontend/src/utils/__tests__/reportPrint.test.ts` | utils | 12 |  |
| `frontend/src/utils/__tests__/saveWorkbook.test.ts` | utils | 29 |  |
| `frontend/src/utils/confidence.ts` | utils | 7 |  |
| `frontend/src/utils/dateUtils.ts` | utils | 165 |  |
| `frontend/src/utils/excelExport.ts` | utils | 68 |  |
| `frontend/src/utils/index.ts` | utils | 5 |  |
| `frontend/src/utils/logger.ts` | utils | 64 |  |
| `frontend/src/utils/payrollUtils.ts` | utils | 22 |  |
| `frontend/src/utils/permissionUtils.ts` | utils | 93 |  |
| `frontend/src/utils/reportPrint.ts` | utils | 32 |  |
| `frontend/src/utils/saveWorkbook.ts` | utils | 21 |  |
| `frontend/src/utils/timeUtils.ts` | utils | 131 |  |
| `frontend/src/vite-env.d.ts` | vite-env.d.ts | 1 |  |
| `backend/src/__tests__/integration/employee-account-creation.test.ts` | __tests__ | 77 | `../../modules/employees/employee.service.js`, `../../modules/auth/auth.service.js` |
| `backend/src/__tests__/integration/security-api.test.ts` | __tests__ | 127 |  |
| `backend/src/__tests__/realtime/socket.test.ts` | __tests__ | 157 | `../../modules/attendance/attendance.gateway.js` |
| `backend/src/__tests__/unit/attendance-aggregation.test.ts` | __tests__ | 274 | `../../modules/attendance/attendance.payroll-port.js`, `../../modules/payroll/public.js`, `../../modules/attendance/attendance.service.js`, `../../modules/attendance/attendance.policy.js`, `../../modules/attendance/public.js`, `../../modules/payroll/payroll.service.js` |
| `backend/src/__tests__/unit/attendance-checkin.test.ts` | __tests__ | 99 | `../../modules/attendance/attendance.service.js` |
| `backend/src/__tests__/unit/attendance-lock.test.ts` | __tests__ | 143 | `../../modules/attendance/attendance.service.js` |
| `backend/src/__tests__/unit/auth-cookie.test.ts` | __tests__ | 116 | `../../modules/auth/auth.service.js` |
| `backend/src/__tests__/unit/device-mode-sync.test.ts` | __tests__ | 90 | `../../modules/devices/device.service.js` |
| `backend/src/__tests__/unit/utils-and-services.test.ts` | __tests__ | 175 | `../../modules/attendance/attendance.service.js`, `../../modules/devices/device.mqtt.handler.js` |
| `backend/src/app.ts` | app.ts | 37 |  |
| `backend/src/common/AppError.ts` | common | 39 |  |
| `backend/src/common/biometric-crypto.ts` | common | 13 |  |
| `backend/src/common/constants.ts` | common | 92 |  |
| `backend/src/common/date.schema.ts` | common | 9 |  |
| `backend/src/common/device-auth.ts` | common | 12 |  |
| `backend/src/common/email.service.ts` | common | 203 |  |
| `backend/src/common/event-bus.ts` | common | 110 |  |
| `backend/src/common/index.ts` | common | 7 |  |
| `backend/src/common/logger.ts` | common | 141 |  |
| `backend/src/common/payroll-history.ts` | common | 53 |  |
| `backend/src/common/payroll-policy.ts` | common | 31 |  |
| `backend/src/common/payroll-rates.ts` | common | 42 |  |
| `backend/src/common/response.ts` | common | 56 |  |
| `backend/src/common/utils.ts` | common | 172 |  |
| `backend/src/composition.ts` | composition.ts | 25 | `./modules/attendance/public.js`, `./modules/shifts/shift.attendance-port.js`, `./modules/employees/employee.integration-port.js`, `./modules/auth/public.js`, `./modules/biometrics/public.js`, `./modules/shifts/public.js`, `./modules/payroll/public.js`, `./modules/auth/auth.biometrics-port.js`, `./modules/attendance/attendance.payroll-port.js` |
| `backend/src/config/database.ts` | config | 5 |  |
| `backend/src/config/env.ts` | config | 54 |  |
| `backend/src/config/index.ts` | config | 3 |  |
| `backend/src/config/mqtt.ts` | config | 83 |  |
| `backend/src/middlewares/asyncHandler.ts` | middlewares | 18 |  |
| `backend/src/middlewares/auth.middleware.ts` | middlewares | 45 | `../modules/auth/public.js` |
| `backend/src/middlewares/errorHandler.ts` | middlewares | 47 |  |
| `backend/src/middlewares/index.ts` | middlewares | 5 |  |
| `backend/src/middlewares/rbac.middleware.ts` | middlewares | 15 |  |
| `backend/src/middlewares/validate.middleware.ts` | middlewares | 65 |  |
| `backend/src/modules/attendance/attendance.adjustments.ts` | attendance | 97 |  |
| `backend/src/modules/attendance/attendance.aggregation.ts` | attendance | 227 | `../employees/public.js`, `../shifts/public.js` |
| `backend/src/modules/attendance/attendance.alert-dedup.ts` | attendance | 14 |  |
| `backend/src/modules/attendance/attendance.alerts.ts` | attendance | 29 | `../employees/public.js`, `../auth/public.js` |
| `backend/src/modules/attendance/attendance.contract.ts` | attendance | 325 |  |
| `backend/src/modules/attendance/attendance.controller.ts` | attendance | 136 | `../employees/public.js` |
| `backend/src/modules/attendance/attendance.cron.ts` | attendance | 165 | `../auth/public.js` |
| `backend/src/modules/attendance/attendance.details.ts` | attendance | 41 |  |
| `backend/src/modules/attendance/attendance.dto.ts` | attendance | 57 |  |
| `backend/src/modules/attendance/attendance.fingerprint.ts` | attendance | 39 | `../biometrics/fingerprint.public.js` |
| `backend/src/modules/attendance/attendance.format.ts` | attendance | 159 | `../shifts/public.js` |
| `backend/src/modules/attendance/attendance.gateway.ts` | attendance | 82 |  |
| `backend/src/modules/attendance/attendance.interval.ts` | attendance | 10 |  |
| `backend/src/modules/attendance/attendance.lock.ts` | attendance | 17 |  |
| `backend/src/modules/attendance/attendance.log-queries.ts` | attendance | 12 |  |
| `backend/src/modules/attendance/attendance.missing-alerts.ts` | attendance | 85 | `../employees/public.js`, `../shifts/public.js`, `../auth/public.js` |
| `backend/src/modules/attendance/attendance.model.ts` | attendance | 20 |  |
| `backend/src/modules/attendance/attendance.notifications.service.ts` | attendance | 26 | `../employees/public.js`, `../auth/public.js` |
| `backend/src/modules/attendance/attendance.notifications.ts` | attendance | 26 |  |
| `backend/src/modules/attendance/attendance.overview.ts` | attendance | 24 |  |
| `backend/src/modules/attendance/attendance.payroll-port.ts` | attendance | 7 |  |
| `backend/src/modules/attendance/attendance.policy.ts` | attendance | 287 |  |
| `backend/src/modules/attendance/attendance.reasons.ts` | attendance | 42 |  |
| `backend/src/modules/attendance/attendance.recipients.ts` | attendance | 20 | `../employees/public.js` |
| `backend/src/modules/attendance/attendance.report-queries.ts` | attendance | 57 |  |
| `backend/src/modules/attendance/attendance.routes.ts` | attendance | 27 |  |
| `backend/src/modules/attendance/attendance.rpc-response.ts` | attendance | 16 |  |
| `backend/src/modules/attendance/attendance.service.ts` | attendance | 1761 | `../biometrics/fingerprint.public.js`, `../auth/public.js`, `../employees/public.js`, `../employees/public.js`, `../shifts/public.js` |
| `backend/src/modules/attendance/attendance.snapshot.ts` | attendance | 65 |  |
| `backend/src/modules/attendance/attendance.webhook.ts` | attendance | 295 | `../biometrics/public.js` |
| `backend/src/modules/attendance/index.ts` | attendance | 8 |  |
| `backend/src/modules/attendance/public.ts` | attendance | 10 |  |
| `backend/src/modules/attendance/recognition-confirmation.ts` | attendance | 29 |  |
| `backend/src/modules/audit-logs/audit.controller.ts` | audit-logs | 8 |  |
| `backend/src/modules/audit-logs/audit.model.ts` | audit-logs | 2 |  |
| `backend/src/modules/audit-logs/audit.repository.ts` | audit-logs | 18 |  |
| `backend/src/modules/audit-logs/audit.routes.ts` | audit-logs | 11 |  |
| `backend/src/modules/audit-logs/audit.service.ts` | audit-logs | 81 |  |
| `backend/src/modules/audit-logs/index.ts` | audit-logs | 5 |  |
| `backend/src/modules/audit-logs/public.ts` | audit-logs | 10 |  |
| `backend/src/modules/auth/auth.biometrics-port.ts` | auth | 7 |  |
| `backend/src/modules/auth/auth.controller.ts` | auth | 40 |  |
| `backend/src/modules/auth/auth.dto.ts` | auth | 21 |  |
| `backend/src/modules/auth/auth.read.ts` | auth | 35 |  |
| `backend/src/modules/auth/auth.repository.ts` | auth | 39 |  |
| `backend/src/modules/auth/auth.routes.ts` | auth | 20 |  |
| `backend/src/modules/auth/auth.service.ts` | auth | 497 | `../employees/public.js` |
| `backend/src/modules/auth/face-login/face-login.policy.ts` | auth | 26 |  |
| `backend/src/modules/auth/face-login/face-login.routes.ts` | auth | 54 |  |
| `backend/src/modules/auth/face-login/face-login.service.ts` | auth | 67 |  |
| `backend/src/modules/auth/face-login/require-password.ts` | auth | 8 |  |
| `backend/src/modules/auth/index.ts` | auth | 6 |  |
| `backend/src/modules/auth/inquiry.routes.ts` | auth | 9 |  |
| `backend/src/modules/auth/profile.dto.ts` | auth | 6 |  |
| `backend/src/modules/auth/profile.routes.ts` | auth | 18 |  |
| `backend/src/modules/auth/profile.service.ts` | auth | 90 | `../employees/public.js` |
| `backend/src/modules/auth/public.ts` | auth | 22 |  |
| `backend/src/modules/biometrics/biometric.controller.ts` | biometrics | 38 | `../employees/public.js` |
| `backend/src/modules/biometrics/biometric.dto.ts` | biometrics | 7 |  |
| `backend/src/modules/biometrics/biometric.jobs.ts` | biometrics | 40 | `../employees/public.js`, `../operations/public.js`, `../operations/public.js`, `../operations/public.js`, `../operations/public.js` |
| `backend/src/modules/biometrics/biometric.repository.ts` | biometrics | 22 |  |
| `backend/src/modules/biometrics/biometric.routes.ts` | biometrics | 26 | `../auth/public.js` |
| `backend/src/modules/biometrics/biometric.service.ts` | biometrics | 246 | `../operations/public.js`, `../employees/public.js` |
| `backend/src/modules/biometrics/face-login.repository.ts` | biometrics | 15 |  |
| `backend/src/modules/biometrics/fingerprint.attendance.ts` | biometrics | 25 |  |
| `backend/src/modules/biometrics/fingerprint.gateway.ts` | biometrics | 22 | `../employees/public.js` |
| `backend/src/modules/biometrics/fingerprint.public.ts` | biometrics | 1 |  |
| `backend/src/modules/biometrics/fingerprint.routes.ts` | biometrics | 87 | `../auth/public.js` |
| `backend/src/modules/biometrics/fingerprint.service.ts` | biometrics | 261 | `../employees/public.js`, `../devices/public.js` |
| `backend/src/modules/biometrics/index.ts` | biometrics | 6 |  |
| `backend/src/modules/biometrics/public.ts` | biometrics | 9 |  |
| `backend/src/modules/dashboard/dashboard.controller.ts` | dashboard | 8 |  |
| `backend/src/modules/dashboard/dashboard.dto.ts` | dashboard | 88 |  |
| `backend/src/modules/dashboard/dashboard.routes.ts` | dashboard | 12 |  |
| `backend/src/modules/dashboard/dashboard.service.ts` | dashboard | 424 | `../shifts/public.js`, `../employees/public.js`, `../attendance/public.js` |
| `backend/src/modules/dashboard/index.ts` | dashboard | 6 |  |
| `backend/src/modules/devices/device.controller.ts` | devices | 120 |  |
| `backend/src/modules/devices/device.dto.ts` | devices | 15 |  |
| `backend/src/modules/devices/device.gateway.ts` | devices | 56 |  |
| `backend/src/modules/devices/device.mqtt.handler.ts` | devices | 76 |  |
| `backend/src/modules/devices/device.repository.ts` | devices | 26 |  |
| `backend/src/modules/devices/device.routes.ts` | devices | 33 |  |
| `backend/src/modules/devices/device.service.ts` | devices | 916 |  |
| `backend/src/modules/devices/face-extraction.ts` | devices | 67 |  |
| `backend/src/modules/devices/index.ts` | devices | 8 |  |
| `backend/src/modules/devices/public.ts` | devices | 1 |  |
| `backend/src/modules/employees/department.controller.ts` | employees | 25 |  |
| `backend/src/modules/employees/department.repository.ts` | employees | 26 |  |
| `backend/src/modules/employees/department.routes.ts` | employees | 13 |  |
| `backend/src/modules/employees/department.service.ts` | employees | 213 |  |
| `backend/src/modules/employees/employee.code.ts` | employees | 35 |  |
| `backend/src/modules/employees/employee.controller.ts` | employees | 43 | `../operations/public.js` |
| `backend/src/modules/employees/employee.dto.ts` | employees | 29 |  |
| `backend/src/modules/employees/employee.format.ts` | employees | 70 |  |
| `backend/src/modules/employees/employee.integration-port.ts` | employees | 12 |  |
| `backend/src/modules/employees/employee.jobs.ts` | employees | 18 | `../operations/public.js`, `../operations/public.js`, `../operations/public.js` |
| `backend/src/modules/employees/employee.model.ts` | employees | 41 |  |
| `backend/src/modules/employees/employee.permission.ts` | employees | 122 |  |
| `backend/src/modules/employees/employee.queries.ts` | employees | 254 |  |
| `backend/src/modules/employees/employee.repository.ts` | employees | 32 |  |
| `backend/src/modules/employees/employee.routes.ts` | employees | 17 |  |
| `backend/src/modules/employees/employee.service.ts` | employees | 661 | `../operations/public.js` |
| `backend/src/modules/employees/employee.wage.ts` | employees | 46 |  |
| `backend/src/modules/employees/employees.report-queries.ts` | employees | 22 |  |
| `backend/src/modules/employees/index.ts` | employees | 11 |  |
| `backend/src/modules/employees/position.controller.ts` | employees | 25 |  |
| `backend/src/modules/employees/position.repository.ts` | employees | 26 |  |
| `backend/src/modules/employees/position.routes.ts` | employees | 13 |  |
| `backend/src/modules/employees/position.service.ts` | employees | 236 |  |
| `backend/src/modules/employees/public.ts` | employees | 25 |  |
| `backend/src/modules/operations/operation.contract.ts` | operations | 28 |  |
| `backend/src/modules/operations/operation.crypto.ts` | operations | 1 |  |
| `backend/src/modules/operations/operation.gateway.ts` | operations | 39 |  |
| `backend/src/modules/operations/operation.routes.ts` | operations | 22 |  |
| `backend/src/modules/operations/operation.service.ts` | operations | 79 |  |
| `backend/src/modules/operations/operation.worker.ts` | operations | 68 |  |
| `backend/src/modules/operations/public.ts` | operations | 4 |  |
| `backend/src/modules/payroll/index.ts` | payroll | 6 |  |
| `backend/src/modules/payroll/payroll.adjustments.ts` | payroll | 81 | `../employees/public.js`, `../attendance/public.js` |
| `backend/src/modules/payroll/payroll.controller.ts` | payroll | 84 |  |
| `backend/src/modules/payroll/payroll.dto.ts` | payroll | 53 |  |
| `backend/src/modules/payroll/payroll.format.ts` | payroll | 83 |  |
| `backend/src/modules/payroll/payroll.overrides.ts` | payroll | 28 |  |
| `backend/src/modules/payroll/payroll.report-queries.ts` | payroll | 23 |  |
| `backend/src/modules/payroll/payroll.routes.ts` | payroll | 22 |  |
| `backend/src/modules/payroll/payroll.service.ts` | payroll | 765 | `../attendance/public.js`, `../employees/public.js`, `../shifts/public.js`, `../attendance/public.js`, `../employees/public.js` |
| `backend/src/modules/payroll/public.ts` | payroll | 153 |  |
| `backend/src/modules/reports/index.ts` | reports | 6 |  |
| `backend/src/modules/reports/reports.controller.ts` | reports | 10 |  |
| `backend/src/modules/reports/reports.dto.ts` | reports | 76 |  |
| `backend/src/modules/reports/reports.routes.ts` | reports | 12 |  |
| `backend/src/modules/reports/reports.service.ts` | reports | 277 | `../attendance/public.js`, `../shifts/public.js`, `../payroll/public.js`, `../employees/public.js` |
| `backend/src/modules/shifts/index.ts` | shifts | 7 |  |
| `backend/src/modules/shifts/public.ts` | shifts | 18 |  |
| `backend/src/modules/shifts/shift-batch.service.ts` | shifts | 92 | `../employees/public.js`, `../operations/public.js`, `../operations/public.js`, `../operations/public.js`, `../operations/public.js` |
| `backend/src/modules/shifts/shift.attendance-port.ts` | shifts | 10 |  |
| `backend/src/modules/shifts/shift.controller.ts` | shifts | 30 |  |
| `backend/src/modules/shifts/shift.dto.ts` | shifts | 38 |  |
| `backend/src/modules/shifts/shift.queries.ts` | shifts | 346 |  |
| `backend/src/modules/shifts/shift.repository.ts` | shifts | 30 |  |
| `backend/src/modules/shifts/shift.routes.ts` | shifts | 28 |  |
| `backend/src/modules/shifts/shift.service.ts` | shifts | 495 | `../employees/public.js` |
| `backend/src/modules/shifts/shifts.report-queries.ts` | shifts | 32 |  |
| `backend/src/modules/shifts/template.dto.ts` | shifts | 4 |  |
| `backend/src/modules/shifts/template.service.ts` | shifts | 13 |  |
| `backend/src/routes.ts` | routes.ts | 33 | `./modules/operations/operation.routes.js`, `./modules/auth/index.js`, `./modules/employees/index.js`, `./modules/attendance/index.js`, `./modules/biometrics/index.js`, `./modules/devices/index.js`, `./modules/payroll/index.js`, `./modules/shifts/index.js`, `./modules/audit-logs/index.js`, `./modules/reports/index.js`, `./modules/dashboard/index.js` |
| `backend/src/server.ts` | server.ts | 118 | `./modules/biometrics/fingerprint.gateway.js`, `./modules/attendance/index.js`, `./modules/devices/index.js`, `./modules/operations/operation.gateway.js`, `./modules/operations/operation.worker.js`, `./modules/shifts/shift-batch.service.js`, `./modules/biometrics/biometric.jobs.js`, `./modules/employees/employee.jobs.js`, `./modules/employees/public.js`, `./modules/auth/public.js` |
| `backend/src/sockets/socket.auth.ts` | sockets | 108 | `../modules/auth/auth.read.js`, `../modules/auth/public.js` |

## Giới hạn

- Kiểm kê tự động chưa xác nhận tính đúng của từng file hoặc từng nhánh xử lý.
- Test kiến trúc bao phủ import và re-export tĩnh, không bao phủ các import động được tạo lúc chạy.
- Test tích hợp cơ sở dữ liệu cần một database thử nghiệm riêng.
