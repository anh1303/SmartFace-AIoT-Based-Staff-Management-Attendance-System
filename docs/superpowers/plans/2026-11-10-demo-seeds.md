# Interactive shift and attendance seeds

Goal: implement two standalone terminal seeds using existing employees and schedules, with overwrite or skip per employee/work date.

Scope: five standard shift types including an OTHER overnight assignment; attendance cases calculated with the existing attendance policy. Existing locked days, reviewed days/adjustments and closed payrolls remain protected. No payroll approval, notifications or biometric enrollment is fabricated.

Implementation:
- [x] Add failing tests for date parsing, five-type schedule coverage, attendance scenarios, overnight ownership and skip/overwrite behavior.
- [x] Add shared CLI/date/database helpers and two seed entry points. Replace data atomically within the selected work dates; preserve neighboring overnight logs. Flag pending payrolls for recalculation.
- [x] Add npm commands and usage documentation. Run focused tests, full backend tests, backend and Prisma TypeScript checks, and CLI help checks without accessing a database.

Decisions: command arguments are optional; missing time/mode values are prompted. Skip preserves the entire employee-day if any attendance data exists. Attendance uses only existing assignments and completed shifts, never creates future scans. Shift replacement preserves raw scans and marks existing summaries for recalculation. Incomplete coverage is reported explicitly.

Verification: 23 seed tests passed; full backend suite 552 passed / 74 skipped. Backend and Prisma TypeScript checks passed. Both compiled CLI help entry points passed. Direct tsx startup failed in this Windows execution environment with `uv_os_get_passwd ENOMEM`, before seed code ran. No seed was executed against a live database.

Follow-up requested by user: replace equal rotation with realistic simulation. Schedules now use department/position, weekday office work, weekly frontline half-day rotations, IT on-call nights and recovery leave. Attendance uses 70/10/5/2/5/3/3/2 percent target groups, deterministic employee/date randomness and variable scan seconds. OFF days use 98% rest / 2% scans; post-night recovery always rests. Rare cases are reported rather than forced into small samples. Existing protected-data behavior is retained.

Follow-up verification: 27 seed tests passed; full suite 556 passed / 74 skipped. Backend and Prisma TypeScript checks passed. No live database seed was run.
