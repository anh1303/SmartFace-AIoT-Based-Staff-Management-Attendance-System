# Phase 2 Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for sequential execution or superpowers:subagent-driven-development when explicitly chosen. Check off each verified step.

**Goal:** Restore strict Phase 2 acceptance, resolve the four known PostgreSQL failures, and remove duplicated HTTP/socket session decisions without changing the intended payroll rules.

**Architecture:** Keep one owner for each session and payroll rule. Preserve existing API contracts, PostgreSQL migrations, advisory lock keys, transaction boundaries and socket refresh ordering.

**Tech Stack:** TypeScript, Vitest, Express, Socket.IO, Prisma 5.22, PostgreSQL/Neon.

**Spec:** [Phase 2 plan and Neon comparison](./2026-11-19-architecture-boundaries-phase2.md) and the workspace audit. The same four PostgreSQL assertions failed before Phase 1. Treat them as known failures, not evidence of a new Phase 2 regression.

## Global constraints

- Run PostgreSQL suites only through the guarded backend runner `npm.cmd run test:neon -- <file> ...`. Never use application credentials or invoke a reset on a persistent DB.
- Keep all existing semantic manifest edits except the two phase flags unless a separate diff explains a change (if the working-tree diff on `boundary-baseline.json` is only `phase: 2 -> 1` plus JSON formatting/EOF newline noise, restore clean HEAD formatting with `phase: 2`). No schema or migration edits are expected.
- Red means the named assertion fails for the intended reason. A skip, connection error, compile error or unrelated failure does not count. Record results before and after each change.
- Separate strict acceptance, adjustment persistence, payroll fixtures and auth into independent diffs. Do not change an error message or remove an assertion merely to obtain green.

## Review Focus

- A green architecture run can omit strict checks if a phase flag is downgraded (Task 1).
- Batch and single adjustment writes must preserve review notes without preserving revoked authorization (Task 2).
- Provisional payroll must still exclude the current Vietnam work date and an unfinished overnight shift (Task 3).
- A stale or superseded socket refresh must not apply identity or room state after an async read (Task 4).

## Task 1 — Restore strict acceptance

**Files:** Both `{backend,frontend}/validation/architecture/boundary-baseline.json` and the corresponding `module-boundary.test.ts` / `feature-boundary.test.ts`.

**Interface:** The current manifests must have `phase: 2`, with initial counts fixed and all transitional counts zero.

- [x] Save the baseline diff and check whether each change is formatting, manifest content or the phase downgrade.
- [x] Red: make the architecture test require phase 2 unconditionally. Run `npx.cmd --no-install vitest run validation/architecture` in each package. With the current phase 1 flags, expect a failure specifically on the phase assertion.
- [x] Restore both manifest files from HEAD, including formatting and phase 2, only after the semantic comparison passes. Keep the existing strict checks for actual manifest lists and graph, including zero pending moves and zero temporary exceptions. Make those checks unconditional or keep them behind the now required phase assertion.
- [x] Green: rerun both architecture suites. As a negative control, temporarily use a phase-1 fixture or change the flag and restore it after proving the test fails. Confirm the final workspace flags are 2.

## Task 2 — Preserve adjustment notes in both write paths

**Files:** `backend/src/modules/attendance/attendance.adjustments.ts` at `syncDayAdjustments` and the batch UPSERT. Investigate callers and explicit review writes in `backend/src/modules/attendance/attendance.service.ts`. Test in `backend/validation/payroll/adjustments.integration.test.ts`.

**Interface:** After source invalidation, old note remains as text and prior decision remains in audit. Status and current reviewer fields follow the new review state.

- [x] Red: run `npm.cmd run test:neon -- validation/payroll/adjustments.integration.test.ts` in backend. At the fixed Oct 20 Vietnam time, expect the two named tests 'invalidates reviewed absence when scans arrive' and 'batch-updates an already reviewed item' to fail on null versus the existing notes. Assert the actual API review operation first persists the note before invalidation; confirm audit previous status/note and that reviewer ID/time are cleared when review is revoked.
- [x] Add Red cases for approving an existing PENDING row with a null note, reapproving with a different reason but identical fingerprint/status, and ordinary PENDING → APPROVED producing no invalidation audit. Test both single and batch writes.
- [x] In syncDayAdjustments, compute nextNote before the no-op check. Prefer the current approved reason (approval_reason, then overtime_reason), then previous.note, then null. Include a note comparison in the no-op guard and write nextNote in both create and update branches. On invalidation, preserve the previous note while clearing reviewer fields according to the new review state.
- [x] Only emit INVALIDATE_ADJUSTMENT_REVIEW when a previously APPROVED decision is invalidated: previous.status === 'APPROVED' and (next status is not APPROVED or source fingerprint changed). A fingerprint change on an unreviewed row alone does not invalidate a decision. Keep old status, note and fingerprint in audit; verify a note-only reapproval does not generate an invalidation. Keep notes and audit in the same transaction.
- [x] In the batch UPSERT, use COALESCE(EXCLUDED.note, attendance_adjustments.note) as a fallback for source sync. A new non-null note must win. Keep explicit user note clearing on its own existing update path so COALESCE does not swallow that action.
- [x] Green: rerun the full adjustments suite. The affected rows must still transition to VOID or PENDING as appropriate, preserve the old note and audit, and no longer count revoked amounts as approved payroll. Check idempotent reaggregation and both batch and single write paths.

## Task 3 — Align the payroll integration scenarios with the existing cutoff

**Files:** `backend/validation/attendance/attendance.integration.test.ts`, cases at the generation and finalize assertions. Reference `backend/src/modules/payroll/payroll.service.ts` at `generate` (calculationEnd) and `finalizePeriod` (source fingerprints and period-end guard).

**Interface:** Provisional generation excludes Vietnam today. Regular finalization requires an ended period, no unfinished eligible shifts, and a current snapshot. Early settlement remains separate.

- [x] Red: run `npm.cmd run test:neon -- validation/attendance/attendance.integration.test.ts`. Record the known 0 vs 9.5 hours failure and the fingerprint-conflict vs period-end failure. Keep Date-only fake timers and restore timers after tests.
- [x] In 'generates zero-safe wages, snapshots rates and blocks stale finalize', assert that generation on Oct 2 excludes the current work date. Advance to Oct 3 Vietnam time before asserting 9.5 regular hours, 2.5 overtime and the expected net amount. Retain the historical multiplier assertion. For stale finalize, move beyond the period end, produce a fresh baseline snapshot, change attendance, and assert that a stale snapshot independently blocks finalization and leaves the row unfinalized.
- [x] In 'preserves finalized wages and blocks edits/generation on a closed row', generate a valid snapshot on Oct 3, then attempt regular finalize while October is open. The snapshot must be fresh so the assertion actually reaches the period guard. Advance to Nov 1 at 08:00 Vietnam time and finalize a fresh row, then verify both writes reject and the stored finalized values remain equal. For the edit, send a valid payload and assert the closed-state rejection, since invalid input can fail before the guard.
- [x] Do not reorder production guards just to satisfy a test with two simultaneous conflicts. If the product requires period-end error precedence, document and test that as a separate behavior change. If the corrected scenarios still fail, trace source and adjustment fingerprints before changing production code.
- [x] Green: run the attendance integration suite plus `validation/attendance/workflow.regression.integration.test.ts`, `validation/payroll/approval-aggregation.regression.test.ts` and `validation/integration/phase1-overnight-payroll-export.integration.test.ts` through the Neon runner. Verify the boundary for an unfinished overnight shift independently of the monthly cutoff.

## Task 4 — Make auth own the shared session decision

**Files:** `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/public.ts`, `backend/src/sockets/socket.auth.ts`. Reuse the HTTP middleware contract in `backend/src/middlewares/auth.middleware.ts`. Tests in `backend/validation/auth/socket-auth.test.ts`, `socket-refresh-race.test.ts`, `revocation-and-session.test.ts`, `face-login-session.test.ts`, and `backend/src/__tests__/realtime/socket.test.ts`.

**Interface:** Auth resolves verified claims and current principal via a shared typed result (`ok: true` with verified claims, HTTP user projection, and socket scope `{ userId, role, employeeId: employees?.id, departmentId: employees?.departmentId }`; or `ok: false` with canonical failure reason). Note the `employeeId` contract split: HTTP `safeUser` keeps `employee_code || user.id`, while Socket keeps raw employee UUID `employees?.id` and numeric `departmentId`. HTTP maps failures to existing Vietnamese `AppError(401)` messages; Socket owns token transport, refresh sequencing, room effects, and existing English `Error('Authentication failed: ...')` messages.

- [x] Move database-read mocks in socket-auth.test.ts and socket-refresh-race.test.ts to modules/auth/auth.read.js. Do not replace auth/public.js with a partial export object. Exercise the real resolver; for async face checks use a lower dependency seam or an explicit test dependency, since re-export mocks cannot intercept calls within auth.service.ts. Preserve the delayed-result race coverage.
- [x] Characterize expired and invalid tokens, inactive account/employee, token version, password-change grace window, revoked face session and department/role changes. Add assertions that HTTP retains the employee code/fallback user ID, while socket uses the employee UUID and department ID for room names. Add a case where an obsolete refresh returns failure after a newer refresh starts: it must not disconnect or update the current socket.
- [x] Add a shared resolver in auth.service.ts, re-exported from auth/public.ts. Return a discriminated union: success includes verified claims, the existing HTTP projection, and socket scope with user ID, role, employee UUID and department ID. Failure returns a typed reason for each existing rejection. Use the identity from verified claims. Keep the existing HTTP wrapper mapping to AppError and preserve socket adapter Error text. Unexpected infrastructure errors retain existing adapter behavior.
- [x] In refreshSocketScope, check _refreshSeq immediately after awaiting the resolver, before mapping a failure or writing socket.data/joining rooms. If infrastructure errors can throw instead of returning a failure, apply the same stale check in the catch path. Preserve existing serialization and room cleanup; avoid a second database read.
- [x] Green: run npx.cmd --no-install vitest run validation/auth validation/architecture src/__tests__/realtime/socket.test.ts. Run npm.cmd run test:neon -- validation/auth/socket-auth.test.ts separately. Compare HTTP and socket error contracts, scope IDs, stale success and stale failure.

## Final verification

- [x] Backend: `npm.cmd run build`, `npx.cmd --no-install tsc --noEmit -p prisma/tsconfig.json`, `npx.cmd --no-install vitest run validation`.
- [x] Frontend: `npm.cmd run build`, `npx.cmd --no-install tsc --noEmit`, `npx.cmd --no-install vitest run validation src/utils/__tests__`.
- [x] Run the complete Neon runner on the isolated branch and explicitly include the new overnight/export regression suite if it is absent from the default list. Record per-suite pass/fail/skip and temporary DB cleanup. A blocked run leaves PostgreSQL verification open. *(17/17 suites PASS, 77/77 tests, 0 failed, 0 skipped; temporary DBs dropped.)*
- [x] Check both manifest flags, zero transitional debt and no migration diff. Run `git diff --check`. Any newly failing test stops acceptance until diagnosed.
