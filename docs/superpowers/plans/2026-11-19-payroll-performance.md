# Payroll performance implementation plan

**Goal:** Implement the four performance changes approved in the conversation, preserving financial results, authorization and locking, then repeat the rollback benchmark once.

**Architecture:** Keep existing service calculations and transaction boundaries. Replace sequential payroll writes with parameterized batches, scope frontend monthly queries and update their cache from mutation responses. History consumers explicitly fetch employee history. Skip protected attendance dates before calculation and cache unchanged day inputs with policy/time/reopen invalidation.

**Constraints:** No schema migration or new dependency. No committed benchmark changes to live payroll. Retain snapshots, audit, finalized/paid protection, and manager scope. Do not include unrelated existing workspace changes.

1. Backend batch writes: add focused batch SQL helper/test; collect calculated rows in generate; batch write and one result read; reuse employee projection. Check unit fixtures and financial/scope tests.
2. Frontend monthly queries: API accepts period and employee; monthly query key includes period; preserve employee history via dedicated history query in history consumers. Test switching months and auth loading.
3. Frontend mutation cache: merge generated rows into that period, preserving locked records omitted by generate; cancel in-flight reads before mutation; invalidate history and adjustment views without a redundant monthly fetch. Test slow/stale requests, locked rows, and failures.
4. Attendance incremental calculation: move lock/review decisions ahead of calculation; fingerprint exact day calculation inputs and adjustment dependencies, retaining rebuild for legacy inputs, clock transitions, reopen, changed sources or policy. Test unchanged/changed logs and overnight pairs, policy, schedule, rates, time transitions, locked dates and manual reviews.
5. Verification: run backend/frontend builds and affected tests; compare old/new output on real data in rollback; run one post-change timing benchmark with the previous period and method. Save raw JSON and a short before/after report with measurement limits.

Completed all five steps. Backend payroll/attendance suites passed (305 tests plus 2 incremental integration-unit checks; database-isolated suites skipped), frontend affected suites passed after fixing public entry-point imports, and a reviewer-identified stale-read race was fixed with a regression test. Real-data result hashes and rollback snapshots match. See `docs/performance/payroll-after-2026-11-19.md` and its raw JSON files for one post-change timing run and the same-session reference.
