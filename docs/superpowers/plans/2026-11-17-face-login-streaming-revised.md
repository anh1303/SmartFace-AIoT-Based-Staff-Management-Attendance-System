# Face Login Streaming — Revised Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. This is a proposal for review, not authorization to implement.

**Goal:** Replace eight-frame batch login with sequential frame processing, early verification, and explicit login completion.

**Architecture:** React sends one fresh JPEG per acknowledged request. One Node process owns attempt lifecycle and identity confirmation; one FastAPI worker owns incremental PAD state. Frame responses never issue authentication cookies; only explicit completion can do so.

**Tech Stack:** Existing React, Express, FastAPI, ONNX predictor, pgvector and JWT cookies. No new transport or Redis dependency.

**Spec:** The design and protocol below form the proposed specification; all numeric operational limits are initial engineering choices requiring measurement.

## Evidence and corrections

- FE currently waits 200 ms eight times before submitting all frames; camera warm-up is separately 800 ms.
- `antispoof/predictor.py::predict_frame` crops one image and calls `predict_crops([face_crop])`; ONNX logits are per image. It does not consume a temporal clip. `Track.update_pad` performs temporal voting outside the model.
- `face_login/pipeline.py` requires exactly eight frames, tracks bounding-box IoU, selects the largest detected face, and resets consecutive embeddings on raw SPOOF. Default PAD window/minimum votes are 5/3; recognition confirmations default to 3. Environment overrides must be recorded before implementation.
- Current challenge storage is local to one Node process. Python Docker command does not specify multiple workers. Neither is proof of the production deployment topology; verify it before rollout.
- Current Python extraction has a global semaphore of one. Keep this inference limit initially; one worker does not itself mean only one concurrent handler.
- `createFaceSession` checks account/template/role and issues a face JWT. Existing logout clears the cookie; it does not revoke an individual JWT. Do not promise post-commit cancellation or individual revocation.

## Alternatives and decision

1. Sequential HTTP: selected proposal. Preserves existing REST/cookie mechanisms and supports backpressure with minimum new code.
2. Dedicated unauthenticated Socket.IO namespace: possible, but existing authenticated sockets cannot simply be reused. Adds handshake and lifecycle work without demonstrated performance need.
3. Redis/shared multi-worker state: defer. One Node process and one Python worker are explicit release constraints. Multi-instance operation requires ownership/routing plus coordinated lifecycle, not merely adding Redis.

## Global constraints

- Preserve model artifacts, preprocessing, thresholds, JPEG quality 0.85, long edge 720 px, and JPEG limit 200 KiB.
- Preserve EMPLOYEE-only face sessions, password step-up, JWT duration and account/template checks. No attendance writes or enrollment changes.
- Production HTTPS; pre-auth binding cookie is random, HttpOnly, Secure in production, with existing SameSite policy. It is never an authentication credential. Completion issues a fresh signed authentication JWT and clears the attempt binding cookie.
- Validate allowed Origin on every mutating public endpoint; use JSON-only payloads and existing credentials behavior. Validate actual deployment same-site/cross-origin behavior before release. CORS alone is not CSRF protection.
- Internal Python endpoints require the internal key, bounded bodies and private network access. FE cannot provide employee identity, embeddings, thresholds, or recognition counts.
- Do not log images, embeddings, JWTs, binding values or user identity in performance telemetry.
- No product code changes until review of this proposal.

## Attempt lifecycle and concurrency

Node states: READY -> PROCESSING -> READY or VERIFIED; VERIFIED -> COMPLETING -> COMPLETED. READY/PROCESSING/VERIFIED can become CANCELLED, EXPIRED or FAILED. Terminal states never reopen. COMPLETING reserves completion; cancellation returns conflict once this boundary is crossed.

Each attempt stores id, binding hash, deadline, epoch, next sequence, in-flight operation id, confirmation identity/count, verification time, and bounded last-result metadata. Store no raw frames. Use one synchronous compare-and-set section before any await in the single Node process; after each await recheck state, epoch, deadline and operation id.

Python stores attempt id, epoch, Track/PAD state, previous bbox, last receipt time, sequence and last bounded result. It never chooses the business identity or issues cookies. Use a real lock around session state because sync FastAPI handlers can run concurrently in a thread pool. Retain the existing process-wide inference semaphore; busy requests do not mutate session or consume sequence.

On Node-to-Python timeout, mark the attempt FAILED and prohibit further frames. Do not unlock it into READY: inference may still be running. Python keeps its execution slot until work actually finishes, discards late results for cancelled/expired generations, and never recreates a missing session on a frame request. A new attempt has a new id/epoch. Reject excess work rather than accumulating an unbounded queue.

Cancellation changes the logical state immediately, fences off late results, then requests Python cleanup. Python physical cleanup waits for any active work. TTL sweeping is mandatory even if cancel never arrives. Node/Python restart fails closed; a missing worker session terminates the attempt rather than silently rebuilding its PAD state. Service boot identifiers in internal create/frame responses detect Python restart.

## Proposed public API

Use the existing `/api/auth/face-login` prefix and its `/api/v1` alias; avoid introducing `/face-auth` as a second vocabulary.

| Endpoint | Request | Result |
| --- | --- | --- |
| POST /attempts | empty JSON | attemptId, expiresAt, intervalMs; binding cookie; creates internal Python session |
| POST /attempts/:id/frames | seq: positive integer, frame: Base64 JPEG | seq, state: pending/verified, nextSeq, coarse guidance; no auth cookie |
| POST /attempts/:id/complete | empty JSON | existing normalized login response; authentication cookie only here |
| POST /attempts/:id/cancel | empty JSON | cancelled, or conflict if completion reserved/committed |
| GET /attempts/:id | bound browser | lifecycle status only; supports completion recovery; no biometric scores/identity |

Use strict schemas, canonical Base64 validation, decoded byte limits, JPEG format/dimension limits and an early route-specific body cap of 300 KiB. Validate binding without consuming another browser's attempt. Return 409 for concurrent/out-of-order/conflicting work, 410 for expired attempts, 429 for admission/rate limits, and 503 for unavailable inference. Semantic terminal failures remain generic about identity.

Duplicate frame policy: cache the last accepted seq with its JPEG digest and bounded result until replaced/terminal cleanup. Same seq and digest returns that result without inference, PAD voting or identity count increment. Same seq with different image and stale/future seq are conflicts. Do not blindly retry ambiguous RPC failures. Internal calls bind attempt, epoch, seq, operation id, boot id and model version; validate all response fields and finite normalized 512-dimensional embeddings.

## Completion semantics and the remaining race

- VERIFIED is not logged in and never sets the token cookie. Stop frame processing immediately at verification.
- Completion checks browser binding, verification freshness and account eligibility. Account checks/token preparation may await; cancellation/expiry can still win during this preparation. Recheck all guards afterward.
- Then synchronously reserve VERIFIED -> COMPLETING and build the success response with the prepared token, transition COMPLETED and issue Set-Cookie without another await. This reservation is the user-visible point of no cancellation. A server state transition and browser cookie delivery are not a distributed atomic transaction.
- Before calling complete, FE checks its attempt generation is current, the modal is active and no logout is pending. During complete, show “Đang hoàn tất đăng nhập”; disable ordinary modal close and do not use AbortController as an authentication rollback mechanism.
- Completion retries must never mint another JWT: cache the same prepared completion result for 30 seconds, bound to the same browser. An explicit retry can reissue that same cookie; no token enters JSON/logs. Status GET never sets cookies. Reject completion retries while a logout is in flight; serialize these operations in AuthContext as the existing login/logout flow does.
- If completion response is lost, stop frame sending and reconcile via attempt status and existing `/me`. COMPLETED plus authenticated `/me` means accept the session; if cookie was not delivered, retry the same completion within the recovery window. If network is unavailable, report indeterminate completion and reconcile on connectivity/reload; do not claim cancellation succeeded.
- Cancel after COMPLETING/COMPLETED returns 409; UI offers explicit logout after reconciliation. Existing logout clears the browser cookie only. Individual server-side JWT revocation, cross-tab authentication ordering and guaranteed post-commit rollback are separate auth-system work; this release does not claim them.
- A terminal completion record remains only for its bounded recovery interval; account eligibility is checked before reissuing a cached token. Cancelled/expired attempts can never issue one.

## Sampling and biometric policy

- Frame one is sent immediately. Subsequent start times are at least 200 ms apart; exactly one outstanding FE frame request. Schedule from acknowledgement/start timestamps, not setInterval. Capture the newest image only when a send is possible.
- Attempt lifetime is 15 seconds from Node admission, not extended by activity. At most 75 accepted frames. VERIFIED completion freshness is 5 seconds and never exceeds the original attempt deadline. Each RPC is capped by remaining attempt time and a provisional 3-second RPC cap; timeout fails the attempt. Revisit the cap using baseline inference measurements before camera rollout.
- Reset the PAD continuity state and Node confirmation counter after no face, quality failure, IoU track break or an inter-frame receipt gap over 2 seconds. Gap is measured by server monotonic clocks; client timestamps are untrusted. Validate this new reset policy experimentally.
- Preserve largest-face selection initially for parity; a one-face-only rule would be a separate explicit policy change. IoU is a continuity heuristic, not identity proof.
- A valid raw SPOOF clears consecutive recognition; retain existing rolling PAD rules. If rolling state is SPOOF, keep collecting until timeout rather than introducing an unmeasured permanent-rejection rule. Malformed/nonfinite inference fails closed.
- Each eligible embedding is matched by Node. Below-threshold/no-match/different-identity results reset the consecutive identity count; a new matching identity starts at one. Never combine confirmations across a reset/generation.
- Verify only after configured consecutive matches with valid current PAD. Freeze the recognition count/configuration for each attempt. Default count is 3; retain supported 1..6 range and configuration checks.
- With default 3 PAD votes and 3 eligible confirmations, an all-REAL sequence can be eligible around frame five (embedding on frames 3,4,5). This is structural reasoning, not a measured latency claim.
- Lower FPS does not violate a temporal model input contract here, but changes temporal coverage and IoU behavior. Early stopping and up to 75 chances change the authentication decision policy even with identical thresholds. Never treat per-frame matching error as the per-attempt error or assume independent frames.
- Cookie, seq and byte digests do not attest a physical webcam or stop virtual-camera/injected JPEG attacks. Exact duplicate handling prevents duplicate votes on retries; it is not general replay resistance.

## Resource admission: provisional values

- Creation: 10 attempts/minute/IP, 1 active attempt/browser binding; excess rejected, not silently replaced. Keep terminal attempt creation counts.
- Frames: 5 new accepted frames/second/attempt; duplicates also count toward request-abuse limits. Browser/IP aggregate limiter: initial 300 requests/minute/IP across frames/status/complete/cancel; measure shared-office NAT impact. Cancel remains usable under normal frame limits.
- Global caps: initially 20 active attempts in Node and Python, 1 active Python inference, no inference queue. Busy response includes retry guidance; FE delays fresh frame retry by at least 200 ms and never extends deadline. No sequence advancement when busy.
- Internal create must succeed before public admission succeeds. Enforce caps independently in both services; cleanup interval 1 second, bounded terminal recovery storage, and max frame count/deadline enforced in Python as well as Node.
- Check Express trusted-proxy configuration before relying on IP limits. Cap limiter key memory and all attempt caches. Load results may require lower admission limits; a cap of 20 is not a concurrency performance guarantee.

## Review Focus

1. Cancel/expiry during awaited account checks cannot issue a token; cancellation after completion reservation returns conflict.
2. A timed-out RPC still running in Python cannot overlap another update to its session or create a second vote on retry.
3. Lost completion response cannot cause silent UI/cookie disagreement or a second newly minted token.
4. Python restart, wrong epoch/model version, concurrent callers and reordered frames fail closed without shared PAD evidence.
5. Early stopping/more attempts cannot be declared equally secure from unit tests or unchanged similarity thresholds alone.

## Task 1: Baseline and protocol tests

**Files:** existing FE/Node/Python face-login validation suites; new `docs/experiments/2026-11-17-face-login-streaming.md` during execution.

- [ ] Record actual deployment processes, effective PAD settings, recognition count, model hash/version and inference provider, without secrets.
- [ ] Measure camera readiness, capture/encode, end-to-end frame/RPC, detector/PAD/embedder, matching and total cold/warm login. Use monotonic durations and random correlation IDs; avoid counting overlapping intervals twice.
- [ ] Add failing contract tests for no token from frame responses, illegal transitions, binding mismatch and expiry. Assertions: cookie absent until complete; terminal state never reopens; wrong binding does not destroy another attempt.
- [ ] Record baseline camera protocol and outcome definitions before changing policy. Do not invent benchmark results when models/camera are unavailable.

## Task 2: Incremental Python extraction

**Files:** modify `face_auth/face_login/pipeline.py`, `http.py`; create `face_auth/face_login/sessions.py`; extend `test_face_login_http.py`, `test_face_login_parity.py`; create `test_face_login_sessions.py`.

**Interfaces:** `process_frame(state, frame, *, detector, predictor, embedder, align_face)` returns PAD/reset status and optional normalized embedding. Internal POST `/internal/face-login/attempts`, `/attempts/{id}/frames`, `/attempts/{id}/cancel` accept only authenticated Node traffic and enforce epoch/seq/deadline contracts above.

- [ ] Add failing deterministic tests: per-image inference; exact existing vote streams produce equivalent intermediate votes; raw SPOOF clears confirmation eligibility; no-face/quality/IoU/gap resets; two sessions isolated.
- [ ] Add tests for identical seq replay without second inference, conflicting digest, semaphore busy, TTL cleanup, cancellation while inference blocks and restart/missing session. Assert no late result revives state and slot stays held until actual work ends.
- [ ] Implement incremental pipeline and thread-safe bounded store; preserve crop/alignment/model/threshold logic. Do not hold raw frames between calls. Isolate mutable predictor state; retain single global inference slot.
- [ ] Run from `face_auth`: `../.venv/Scripts/python.exe -m unittest tests.test_face_login_http tests.test_face_login_parity tests.test_face_login_sessions`. Expect all pass; document any model-dependent checks not run.

## Task 3: Node lifecycle, identity verification and completion

**Files:** modify `backend/src/modules/auth/face-login/{face-login.policy.ts,face-login.service.ts,face-login.routes.ts}`, `backend/src/app.ts`; create `face-login.attempts.ts`; extend existing `backend/validation/auth/face-login*.test.ts`.

**Interfaces:** attempt store exposes guarded startFrame/finishFrame/cancel/expire/reserveCompletion/finishCompletion operations; services expose startAttempt, processAttemptFrame, completeAttempt, cancelAttempt and status. Wire exact request/response schemas from this document. Reuse authBiometrics and createFaceSession; do not add DB writes to frame processing.

- [ ] Write failing tests for the five Review Focus cases using deferred promises/fake clocks; assert one match increment per accepted seq, no cookies from frames, and no token for stale/invalid model responses.
- [ ] Test 3 same identities verify; A,A,B restarts at one; no-match/raw-SPOOF/reset clears count. Test configured counts 1 and 6. Test disabled feature, inactive account, template removal and disallowed role at completion.
- [ ] Implement synchronous state guards before awaits and fenced completion afterward; split verification from token issuance. Add bounded lifecycle, rate/body limits and internal cleanup.
- [ ] Add completion tests: cancel wins during account lookup; completion reservation wins afterward; lost response/retry uses identical token; no Set-Cookie on status/cancel; recovery expiration rejects retry.
- [ ] Run `npm --prefix backend test -- validation/auth/face-login.test.ts validation/auth/face-login-routes.test.ts validation/auth/face-login-session.test.ts` and `npm --prefix backend run build`. Expect pass.

## Task 4: FE continuous capture and authentication reconciliation

**Files:** modify `frontend/src/features/auth/components/FaceLoginModal.tsx`, `api/faceLoginApi.ts`, `frontend/src/context/AuthContext.tsx`; reuse `faceCamera.ts`; update `frontend/validation/auth/face-login-modal.test.tsx`, `face-login-stepup.test.tsx`, `logout-login-race.test.tsx`.

**Interfaces:** API start/frame/status/cancel/complete correspond to public contract. AuthContext replaces batch loginWithFace with attempt completion and reuses existing normalized login response/acceptSession and logout serialization.

- [ ] Add failing fake-timer tests: immediate first capture; minimum 200 ms spacing; one outstanding request even at 500 ms response time; fresh capture after response; stop on verified/timeout/camera end/unmount.
- [ ] Test busy guidance without sequence increment, generation guard, new attempt on retry, cancel before complete, complete close lock, lost-response `/me` reconciliation, and logout serialized with completion.
- [ ] Implement loop and UI states. Close during scanning marks generation inactive before async cancel; completion checks generation immediately before request. Do not silently accept a stale attempt response.
- [ ] Run `npm --prefix frontend test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx validation/auth/face-login-stepup.test.tsx validation/auth/logout-login-race.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`. Expect pass.

## Task 5: Integration, biometric comparison and deletion

**Files:** existing route/integration tests; experiment report; batch-only code/tests and historical plan references as appropriate; deployment documentation and `face_auth/Dockerfile` if explicit worker pin is required.

- [ ] Test real HTTP cookie handling end to end, both API aliases, deployment Origin/SameSite behavior, unavailable Python, two browsers, malformed bodies and simultaneous frame/complete/cancel requests.
- [ ] Compare old/new with same cameras, models, subjects, lighting, network and declared attack scenarios. Report per-attempt genuine success/failure, attack acceptance observations and uncertainty; no statistical security claim from a small demo.
- [ ] Report p50/p95 from button press to accepted login including complete RPC, frames/bytes, timeout/busy rates and CPU/memory under 1/3/5 simultaneous clients. Proposed performance target: warm p50 at least 30% lower without material p95/success regression; revise explicitly from baseline if infeasible.
- [ ] Only after integration passes, delete batch FE array/loop, old loginBody length(8), old challenge consume path, batch recognizeLogin/extract API and extract_sequence if no remaining callers. Replace batch tests with incremental coverage; retain relevant PAD regression fixtures and mark historical plans superseded rather than erasing history.
- [ ] Search all callers, mocks, aliases and docs for `frames`, `recognizeLogin`, `extract_sequence`, `/extract`, `/challenges`, and loginWithFace. Keep unrelated enrollment, attendance and research/spike APIs intact. Reduce face-login body limits after batch removal.
- [ ] Re-run focused suites/builds after deletion. Verify no attendance write, enrollment change, new dependency or DB migration was introduced.

## Rollout and rollback

- Release FE/Node/Python as one compatible set; drain/expire in-flight attempts before restart. Pin one Node process and one FastAPI worker; reject unsupported multi-worker deployment. Do not use rolling mixed protocol versions without explicit routing/versioning work.
- Enable using existing FACE_LOGIN_ENABLED for a controlled window; retain password fallback. Monitor aggregate latency, failure/busy/timeout and bounded memory. No automated full biometric claims from telemetry.
- Roll back all three components together to previous artifacts; pending attempts become invalid and users retry. No enrollment/DB rollback is needed. Keep old artifacts rather than maintaining two permanent code paths.
- If tests/models/camera/load evidence is unavailable, mark the corresponding acceptance checks pending. Do not report production readiness or measured speedup.

## References and scope boundaries

- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html — pre/post-auth separation, cookie attributes and renewal after authentication.
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b/authenticators/ — facial PAD and limitations of biometrics. This project is not declared NIST compliant; face-only login is not upgraded into high-assurance MFA by adding streaming.
- Passkeys, sensor attestation, broad replay/injection prevention, Redis scaling and individual JWT revocation are separate decisions; do not bundle them into this latency change or imply they already exist.
