# Execution ledger — 2026-11-06-background-mutations.md

- User approved implementation, with explicit visible feedback for every change.
- Working in existing giap checkout to retain the uncommitted employee portal/attendance work used by this feature. Do not commit unrelated work.
- Baseline: frontend 161 passed / 1 failed; backend 417 passed / 4 failed / 73 skipped. Logs: frontend-baseline.log, backend-baseline.log. Existing failures will be distinguished in final verification.
- Ruling: encrypted staging uses a separate PostgreSQL bytea table, not a filesystem volume or base64 job payload. This works with the existing cloud/local DB and survives container replacement. Uses existing BIOMETRIC_ENCRYPTION_KEY; staged payload expires after 24 hours.
- Pre-flight: Task 1 retries depend on Task 2 idempotency. Implement operation foundation before connecting retries; no automatic POST retries.
- Ruling: owner-scoped operation history is durable and visible across navigation/reload; domain change signals invalidate scoped viewers and announce updates. Pending values never imply committed biometric enrollment.
- Final code implemented; see `docs/DEMO_STATUS_2026-11-06.md` for the consolidated handoff and unresolved checks.
- Database: confirmed the new migration was the only pending migration, then successfully ran `prisma migrate deploy` against configured DB. No existing data deletion.
- Attendance follow-up: added ATTENDANCE_MIN_EVENT_INTERVAL_MINUTES=10 (validated range10..30) to backend/.env and example; no hardware changes. Guard runs inside employee lock, uses latest VALID server receipt time, and returns ignored without second insert/aggregation/event.
- Latency follow-up: face matching now reads active identity + current-model CENTROID in one query instead of3 round trips. Existing thresholds unchanged; actual end-to-end latency not benchmarked.
- Realtime follow-up: attendance events update dashboard/attendance/payroll caches globally;50ms event coalescing and5s visible-tab fallback when the operations socket is disconnected.
- Final checks: frontend173passed; backend449passed,73existing conditional skips; frontend lint/build and backend build passed. Python118passed,3missing-PyTorch research import errors, documented without masking.
- Independent review findings (session leakage after logout and stale version after409) fixed with regression tests. Worker replay and Python transaction-composition tests added; live multi-worker lock validation remains deferred.
- Release follow-up authorized commit/push/main integration. Live backend and Vite started; database connectivity, migration and main API reads verified. Review found no severe backend issue; ignored-scan toast fixed. Compact history response reduced repeated-photo payload from141MB to1.1MB. Final frontend174passed, backend450passed/73conditional skips; builds passed. No hardware/model changes.
