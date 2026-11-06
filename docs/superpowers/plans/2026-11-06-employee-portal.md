# Employee portal implementation plan

**Goal:** Implement the employee portal confirmed by the user on 2026-11-06, using the supplied screenshots and existing light/dark themes.

**Architecture:** React renders scoped API data. Backend aggregates persisted daily attendance from month start through today; no attendance or payroll recalculation is triggered by viewing a page. Preserve both existing profile pages.

**Constraints:** Six menu items in two groups. Two overview items per row. No shift exchange, attendance editing, enrollment, payroll export, seeded values or invented fallback amounts. Loading and errors must remain distinguishable from missing data.

- [x] Add and test a read-only attendance overview endpoint using existing employee authorization and persisted summaries. Verify month/date boundaries, work-day credit, absence and approved OT.
- [x] Replace employee dashboard with eight requested items; use backend overview, payroll and notifications.
- [x] Replace employee schedule with searchable read-only week/month navigation and assigned shifts, using existing schedule styles and DB times.
- [x] Rename attendance and reuse the journal, adjustments and daily evidence sections from the last reference image.
- [x] Add read-only biometric status page; simplify payroll presentation and consolidate old salary URLs; update menu and breadcrumbs without changing profile components.
- [x] Verify TypeScript, production build, frontend/backend suites and rendered light/dark desktop/mobile states when tooling permits. Review diff for writes and profile changes.

Review focus: prior-month and future records excluded; no profile means no broad query; missing data versus request errors; overnight/multiple shifts; no client wage or attendance-policy calculations.

## Verification — 2026-11-06

- Frontend TypeScript and production build: passed. Backend TypeScript build: passed.
- Targeted employee portal regressions: 8 frontend tests and 17 backend tests passed.
- Chrome production-preview review with intercepted API fixtures: all five changed pages at 1440px and 390px, light/dark themes, missing payroll and request errors. Checked attendance scan/adjustment rendering, no page-wide horizontal overflow, no runtime exceptions and no mutation requests across 109 intercepted API requests. Screenshots and detailed logs are in ignored `temp/employee-review/`.
- Design detector: no findings. `git diff --check`: passed. Both existing profile components unchanged.
- Independent review: missing monthly summaries initially appeared as zero; corrected to nullable totals displayed as `—`, with regression coverage. No other definite findings.
- Full frontend suite: 148 passed, 1 failed. `validation/attendance/manager-dashboard-arrivals.test.tsx` lacks a QueryClient provider.
- Full backend suite: 402 passed, 4 failed, 73 skipped. Failures: `validation/architecture/model-ownership.test.ts` (ownership accesses in existing modules), `validation/auth/revocation-and-session.test.ts` (mock lacks employee.updateMany), `validation/devices/webhook-validation.test.ts` (modeNotify rejection expectation), `validation/shifts/shift-assignment.test.ts` (fixed 2026-11-05 date is now in the past). These failures are outside the changed portal behavior and were not repaired in this task.
- Not verified: authenticated requests against a live database; database integration suites remained skipped. Browser fixture values exist only in the ignored review harness, never in production pages. Viewing the portal does not seed, calculate or update database records.
