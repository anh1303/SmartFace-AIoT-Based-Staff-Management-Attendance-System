# Neon Network Transfer & Query Optimization — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task by task. `superpowers:subagent-driven-development` is an alternative if requested. Đây là đề xuất để xem xét, chưa triển khai runtime.

**Goal:** Giảm byte Neon truyền về ứng dụng và lượt truy vấn dư thừa trên toàn dự án, giữ đủ nghiệp vụ và tính nhất quán.

**Architecture:** Thu hẹp projection ngay tại SQL/Prisma, tái sử dụng dữ liệu trong cùng transaction, phân trang và tổng hợp tại DB, đồng bộ theo thay đổi. Giữ stack hiện tại; chưa thêm Redis hay thay ORM.

**Tech Stack:** Express, Prisma 5.x (package khai báo ^5.20.0), PostgreSQL/pgvector, React Query/Socket.IO, Python/psycopg_pool, ThingsBoard/IoT.

**Spec:** Yêu cầu trong hội thoại 2026-11-08: kiểm tra toàn dự án và lên kế hoạch gộp truy vấn hợp lý, ít nhưng không thiếu. Người dùng xác nhận lỗi Neon: **“You've used all of your monthly network transfer allowance for this project”**. Vì vậy ưu tiên byte DB trả về, không chỉ số câu SQL. Chưa yêu cầu triển khai code.

## Bản sửa sau review: phạm vi xử lý sự cố

P0 bên dưới là giả thuyết từ code, chưa phải xếp hạng có số đo. Chưa thể kết luận avatar/template là thủ phạm chính hoặc 22 truy vấn không gây ảnh hưởng. Cần xét byte kết quả × tần suất × số consumer.

**Đợt khẩn cấp:** chẩn đoán nhỏ Task1a → Task2 (auth/socket/permission projection) → Task4 (manifest nếu đang có thiết bị vân tay hoạt động) → Task3a (phân trang màn hình log thông thường). Đổi thứ tự theo số đo. Không chờ xây xong benchmark đầy đủ mới sửa projection rõ ràng không cần blob.

**Task2a bổ sung:** thumbnail cho avatar mới lúc enroll, dùng OpenCV đã có, độc lập với input embedding/PAD. Không cần storage service hoặc migration trong bước này.

**Hoãn:** Task1b (benchmark đầy đủ), Task3b (monitor read-model/summary/reporting), Task5/6/7/8/9. Đợt khẩn cấp không thay lock/payroll, không coalesce aggregation. Bỏ mục tiêu tùy ý 22→16; tối ưu writer chỉ khi số đo biện minh được lợi ích so với rủi ro.

### Task1a — Chẩn đoán chỉ trả kết quả tổng hợp

Dự kiến khoảng 10 phút thao tác nếu DB cho truy cập, không cam kết thời gian scan. Dùng role read-only; không tự bật extension hoặc xuất blob. SQL dưới đây mới được ghi vào kế hoạch, **chưa chạy**. Nếu quota chặn, ghi “chưa đo”, test local; không retry liên tục hay restore toàn DB chỉ để đo.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT count(*) AS employee_count,
       count(avatar_url) AS avatars_nonnull,
       avg(octet_length(avatar_url)) AS avg_avatar_bytes,
       max(octet_length(avatar_url)) AS max_avatar_bytes,
       sum(octet_length(avatar_url)) AS total_avatar_bytes
FROM employees;
SELECT status, count(*) AS template_count,
       avg(octet_length(ciphertext)) AS avg_ciphertext_bytes,
       max(octet_length(ciphertext)) AS max_ciphertext_bytes,
       sum(octet_length(ciphertext)) AS total_ciphertext_bytes
FROM fingerprint_templates GROUP BY status;
SELECT status, count(*) AS session_count,
       sum(octet_length(ciphertext)) AS total_session_ciphertext_bytes
FROM fingerprint_sessions GROUP BY status;
SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements';
COMMIT;
```

Kết quả ít dòng giúp giảm transfer nhưng aggregate có thể scan/decompress cột lớn trên DB, không mặc nhiên rẻ về compute. Timeout thì ROLLBACK, thu hẹp mẫu/range và ghi rõ là mẫu, không tăng timeout vô hạn. AVG bỏ qua NULL; đọc cùng avatars_nonnull. Avatar có thể là URL hoặc base64, cần phân loại bằng số đếm/độ dài tại SQL, không tải nội dung về để kiểm tra. Nếu không có template/thiết bị đang chạy, giảm ưu tiên manifest.

Nếu pg_stat_statements đã có và role được đọc: lấy snapshot đầu/cuối cửa sổ theo queryid/calls/rows/total_exec_time, không reset thống kê project. View này **không đo network/result bytes theo query**: shared_blks_read là I/O DB, wal_bytes là WAL. Dùng nó chọn query thường gọi/trả nhiều dòng, kết hợp kích thước projection và tần suất workload để ước lượng. Xác nhận tổng transfer bằng Neon Console; query nhiều dòng nhất chưa chắc tốn byte nhất.

### Quyết định vận hành để khôi phục dịch vụ

Chủ tài khoản chọn (a) chấp nhận gián đoạn và chờ reset theo chu kỳ thực tế trong Console, hoặc (b) xem phương án nâng gói/tăng allowance được Console hay Neon support xác nhận để khôi phục sớm. Xác nhận chi phí và thời điểm hiệu lực; không mặc nhiên cho rằng nâng gói reset quota ngay hoặc có thể hạ gói tùy ý.

Đây là quyết định vận hành tách khỏi sửa code, không bị loại khỏi kế hoạch. Agent không tự thay billing. Trong lúc chờ có thể sửa/test local; không hứa code mới sẽ khôi phục allowance đã dùng.

## Phạm vi và giới hạn

Đã quét tĩnh điểm truy cập dữ liệu trong backend, face_auth và hardware; đọc schema/migration và lần theo middleware → service → helper/public API → transaction → aggregation/worker → socket → React Query. Rà các luồng attendance, auth, permission, employee, fingerprint, payroll, shifts, dashboard/report, notification; phân biệt script seed/repair/nghiên cứu với tải thường trực.

Đây là rà soát tĩnh theo rủi ro, không phải chứng nhận mọi dòng code. Chưa truy vấn Neon, chưa đọc secret, chưa chạy DB integration/load test, chưa có query plan hoặc byte production. Không đo DB/metrics nội bộ ThingsBoard. Chưa xác định phần trăm transfer của từng nguồn; các con số mục tiêu bên dưới cần được kiểm chứng.

## Kết luận và hướng đề xuất

Một request ít SQL vẫn có thể dùng nhiều transfer nếu tải ảnh base64, ciphertext template hoặc JSON lịch sử lớn. Cắt field sau khi query hay gzip HTTP backend → browser không giảm byte Neon đã gửi về backend. `Promise.all`/`$transaction` cũng không tự biến nhiều SQL thành một SQL.

| Ưu tiên | Phát hiện | Thay đổi đề xuất |
| --- | --- | --- |
| P0 | Avatar base64 bị đọc trong auth, socket scope, employee lookup | Projection nhẹ theo mục đích ngay trong query |
| P0 | Attendance mặc định 5.000 dòng, frontend tự tải nhiều trang; summary không giới hạn dòng | Phân trang thật, list/detail/export riêng, aggregate đúng tại DB |
| P0 | Manifest vân tay đọc mọi template mỗi 15s khi rảnh / 2s khi có session | Manifest metadata; tải template theo nhu cầu sync/recovery |
| P1 | Mỗi emit socket kiểm tra mọi socket, có thể lặp nhiều namespace | Batch theo user, projection nhẹ, giữ kiểm tra quyền hiện hành |
| P1 | Check-in đọc lại khóa ngày/kỳ lương/summary/ca trong cùng thao tác | Context trong transaction, batch state reads, reuse schedule |
| P1 | Scan tổng hợp riêng; cron quét cả hai tháng mỗi 30 phút | Coalesce employee/date, incremental + sweep theo hạn |
| P2 | Batch phân ca insert từng item; progress đọc cả danh sách sau mỗi item | Batch insert, aggregate counters, giảm nhịp progress |
| P2 | Payroll/chốt công còn write từng dòng, JSON rộng | Batch có điều kiện, projection, giữ snapshot/audit/locks |
| P2 | Worker rảnh 2 SQL/s; polling UI và realtime cùng hoạt động | Backoff/cleanup riêng, polling dự phòng theo kết nối |

Ba hướng đã cân nhắc:

1. **Projection + pagination + sync delta + batch trong stack hiện tại — khuyến nghị.** Giảm byte ngay, triển khai theo module và đo được, không thêm hạ tầng.
2. Cache dùng chung/materialized read model: chỉ thêm nếu đo xong vẫn nhiều read trùng giữa instances; cần invalidation quyền/dữ liệu và chi phí vận hành.
3. Stored procedure cho toàn check-in: giảm round trip nhưng không xử lý ảnh/template/lịch sử bị tải ở luồng khác, khó giữ logic/test đồng nhất. Chưa chọn ở đợt đầu.

Đây là khuyến nghị của người rà soát, chưa phải phương án người dùng đã duyệt triển khai.

## Bằng chứng và phân tích

### 1. Avatar base64: tải lớn trong truy vấn không cần ảnh

- `face_auth/api_service.py:218` truyền ảnh base64 đầu tiên làm avatar; `face_auth/enrollment/operation.py:41` lưu vào `employees.avatar_url`, kiểu TEXT. Đây là hành vi code cho phép, chưa đo ảnh đang lưu thật.
- `backend/src/modules/auth/auth.service.ts:355` include employee đầy đủ khi xác thực mỗi HTTP request; cuối hàm mới bỏ `avatar` khỏi kết quả. Byte ảnh đã truyền từ Neon trước khi bị bỏ.
- `backend/src/sockets/socket.auth.ts:35` cũng include toàn bộ employee mỗi refresh. `employee.queries.ts` dùng `employeeInclude` rộng; `getEmployeeScope` tải đầy đủ scalar của đồng nghiệp cùng position/department/role.
- `biometrics/biometric.service.ts:188` tìm face match cũng SELECT avatar; VERIFY_ONLY có thể tải lại ảnh dù chưa ghi attendance.
- Sửa: select chính xác auth/permission/socket fields; không tải ảnh, passwordHash, lịch sử lương, metadata sinh trắc khi không dùng. Giữ profile chứa token_version/password_changed_at, employee status, role, department và face-session existence.
- Avatar UI vẫn phải hiển thị. Đợt đầu loại ảnh khỏi read không cần ảnh; nơi cần ảnh tải theo nhu cầu/cached version. Task2a resize/nén avatar mới ngay lúc enroll; ảnh cũ vẫn giữ nguyên nên không hứa giảm toàn bộ blob hiện có. Chuyển storage chỉ xét sau số đo; không tự chuyển/xóa ảnh gốc.

### 2. Một check-in có thể kéo theo tải lại hàng nghìn dòng

- `attendance.service.ts:116`: mặc định 5.000 logs, tối đa 50.000 một page; không có ngày mặc định khi caller bỏ lọc.
- `frontend/src/features/attendances/api/attendanceApi.ts:34` tự lặp page, tới 50.000 dòng hoặc toàn range với fetchAllPages.
- `ManagerAttendanceMonitor.tsx:77` dùng fetchAllPages, mở rộng ngày hai phía để ghép ca đêm.
- `getDailySummaries` không phân trang và đọc toàn scalar/JSON summary trong range, hoặc toàn lịch sử nếu không lọc. `getEmployeeOverview` gọi nó dù tổng tháng cần ít cột và chi tiết hôm nay.
- `useAttendance.ts` invalidate sáu nhóm query; `useAttendanceSocket.ts` tiếp tục invalidate logs/summaries khi checked-in rồi summary-updated. Debounce 50ms ở một hook chưa gộp mọi nguồn/thời điểm.
- Sửa: list log 50 dòng mặc định, tối đa 200; lọc ngày/phòng ban/search tại DB. Summary list trả nhẹ, detail mới trả evidence. Export rõ ràng, đọc đủ theo trang/chunk; không âm thầm cắt dữ liệu.
- Monitor cần endpoint read-model employee/day tính đầy đủ phía server trong cửa sổ MAX_PAIR_MS. Không chỉ đổi fetchAllPages thành page1 rồi ghép ca trên dữ liệu thiếu.

### 3. Manifest vân tay tải template lặp dù đã đồng bộ

- `hardware/peripherals/fingerprint_worker.py:68` poll 15s rảnh / 2s có session.
- `fingerprint.service.ts:148` mỗi poll expire session, SELECT session đầy đủ và bindings include template đầy đủ. Cả template SYNCED vẫn được đọc/decrypt. Session VERIFIED/SYNCING cũng có ciphertext, phải thu hẹp cả projection này.
- Ví dụ minh họa, không phải số đo: 100 template × 1 KiB đọc/template × 5.760 poll/ngày ≈ **562,5 MiB/ngày/thiết bị**, chưa tính overhead/session. Code chấp nhận template thô 512/768 byte; ciphertext/SQL thực tế phải đo.
- Sửa manifest chỉ select public session và id/device/slot/revision/checksum/state. Tải template một binding qua endpoint device-auth riêng khi thực sự sync/recovery.
- `_sync` hiện cần template_b64 khi `_verified` trống sau restart: đổi backend + worker phối hợp, không đơn thuần bỏ field. Giữ checksum/revision/Flash readback, retry ack, REVOKED delete và chống ghi đè slot lạ.
- Giữ heartbeat đủ freshness `last_seen < 90s`, expiry/cancellation; không public-cache template hoặc cache quyền revoke quá hạn.

### 4. Socket nhân tải theo số kết nối

- `attendance.gateway.ts:29` refresh quyền mọi socket mỗi emit rồi lookup employee lấy room. `operation.gateway.ts` tương tự; `fingerprint.gateway.ts` refresh mọi socket trước khi xét owner.
- Một người có thể nhiều tab/namespace. Chi phí xấp xỉ events × sockets × auth-result bytes; avatar làm phần này nặng hơn.
- Sửa select nhẹ trước; batch user state theo user duy nhất trong cùng delivery, áp lại scope cho từng socket. JWT/expiry vẫn xét từng credential.
- Giữ sequence chống refresh cũ ghi đè mới. Mỗi delivery tiếp theo phải xác nhận role/department/active/face revocation hiện hành; không tin room cũ hoặc cache TTL dài. Cần kiểm thử thay quyền đồng thời, không hứa loại hết race chỉ bằng cache.

### 5. Check-in có đọc lại trong cùng transaction

Nhánh minh họa: FACE AUTO, event mới, một ngày ảnh hưởng, không cooldown/flagged/closed, không requester, syncSummary=false. Đếm lần gọi ORM/raw từ code, chưa tính SQL phụ do include, BEGIN/COMMIT, background hay UI:

| Nhóm | Lần gọi logic |
| --- | ---: |
| Vector match + AUTO lookup | 2 |
| Employee trước transaction | 1 |
| 3 payroll locks + employee lock | 4 |
| Maintenance + current employee | 2 |
| Replay lookup | 1 |
| Latest theo created_at + previous theo event_time | 2 |
| Ca lân cận | 1 |
| Closed payroll + day lock + summary | 3 |
| Insert log | 1 |
| affected: đọc lại ba trạng thái + upsert | 4 |
| Formatter đọc lại ca | 1 |
| **Tổng minh họa** | **22** |

Nguồn: `attendance.service.ts:421–648`, `attendance.webhook.ts`, `attendance.format.ts:139`. Nhánh manual/fingerprint/replay/ca đêm khác nhau, không dùng 22 làm số đo production.

- Bỏ ba read trạng thái lặp trong affected; formatter dùng schedule đã tải; hai latest có thể trả trong một SQL với hai subquery riêng; query trạng thái ngày chọn ít cột. Đây là backlog sau sự cố, không còn tiêu chí 22→16. Chỉ làm khi đo được lợi ích byte/latency đáng với rủi ro nghiệp vụ.
- Context chỉ tồn tại trong transaction, cập nhật/invalidate sau write. Giữ current employee recheck sau lock và kiểm tra fingerprint revoke/maintenance trong transaction.
- Không thay hai timeline receipt/captured bằng một ORDER BY. AUTO hiện resolve trước writer lock; khi hợp nhất phải resolve authoritative dưới lock, replay giữ mode gốc.
- Không tự bỏ/gộp khóa kỳ lương nếu chưa chứng minh thứ tự khóa và ca đêm qua tháng. Không ghép các lời gọi lock vào SQL có evaluation order không đảm bảo.

### 6. Aggregation: nhiều lần đọc cùng kỳ và evidence JSON

- Cron chạy tháng trước + hiện tại mỗi30 phút, startup, 00:05; missing-scan job mỗi phút. setImmediate sau scan chỉ rút ngắn response, không giảm tổng tải DB.
- Aggregation đã batch reads và JSON upsert chunk250, adjustment/audit batch: giữ phần tốt, không viết lại.
- Vẫn đọc employees gồm ảnh, logs, summaries đầy đủ gồm evidence/snapshot JSON; cron đọc cả kỳ dù ít nguồn đổi.
- Thu hẹp select; lấy riêng fingerprint/field so sánh từ JSON tại SQL khi không cần toàn evidence. Nhánh manual/reopened/snapshot vẫn đọc đủ dữ liệu cần tính đúng.
- Coalesce employee/date; marker policy_version=null đã ghi trong transaction có thể giúp phục hồi. Trước incremental phải kiểm kê mọi mutation: scan, shift/log edit, adjustment, policy, lock/unlock, import/repair, payroll.
- Không dùng dirty-only mù quáng: đến hạn shift/absent/missing checkout/OT cutoff vẫn phải tính khi không có source write; cần due sweep/catch-up sau restart và full rebuild đối soát.

### 7. Batch phân ca và progress

- enqueueOperation INSERT từng item, tối đa2.000 item/request. submitCopy query ca từng employee; submitBatch resolve quyền/employee từng người.
- executeShiftBatch refresh progress mỗi item: đọc toàn trạng thái items, update job, announce socket. N item tạo khoảng N² status rows truyền về backend.
- Batch insert chunk250, source shifts đọc một lần theo employeeIds, progress SQL COUNT FILTER trả counters; phát tối đa mỗi500ms và luôn phát kết quả cuối. Giữ per-item version/lease/partial success, không đổi thành all-or-nothing.

### 8. Các module còn lại và phần cần giữ

- Payroll generate đã batch source reads; finalize có updateMany. Các upsert từng employee và JSON lớn cần đo; toggleLock/autoClose còn read/update trong loop. Chỉ batch row độc lập, giữ snapshot/adjustment/audit/conflict checks.
- Dashboard/report đã batch helpers, không N+1 trong vòng tính KPI chính. Vấn đề là tải raw logs/employee rộng để đếm trong JS và poll dashboard30s. Dùng aggregate SQL + list cần hiển thị; tránh mega-JOIN nhân bản dòng.
- Notification đã take100 nhưng scope reload user sau authenticate và permission rộng; reuse auth context cùng read request, giữ ownership/scope và recheck write nhạy cảm khi cần.
- Face-session existence/revocation cần giữ; có thể gộp bằng EXISTS/projection, không bỏ.
- Python VectorDB có pool và trả metadata mặc định; vector chỉ khi include_vectors. Giữ health/reconnect safety; tăng pool không chữa bandwidth.
- Hardware không kết nối Neon trực tiếp ở attendance thường trực; đi qua API/ThingsBoard. Không cộng mọi HTTP/MQTT byte thành Neon transfer.
- Worker rảnh cleanup + claim mỗi giây: khoảng172.800 SQL/ngày/instance nếu chạy24h và tick không bị chặn. Result rỗng thường ít byte hơn ảnh/template, nên xếp sau payload lớn cho sự cố network hiện tại.
- Không xóa lịch sử công/lương, audit, dataset/test để chữa network quota. Hạn mức đã tiêu thụ không tự phục hồi sau sửa code.

## Global constraints

- Đo riêng Neon→backend bytes, API bytes, SQL count, latency, compute/storage; chưa nâng gói hoặc di chuyển DB.
- Giữ policy công/lương, threshold/stable count, MAX_PAIR_MS, múi giờ VN, scope manager/admin/employee và retention.
- Giữ event_key unique/idempotency, transaction/lock order, audit, expectedVersion, lease/heartbeat, revoke và maintenance checks.
- Không thêm Redis/ORM/framework hoặc migrate ảnh trong đợt đầu. Raw SQL phải parameterized, identifier whitelist.
- Cache khóa công/lương/quyền xuyên transaction không được thay read authoritative. Batch phải giữ lỗi và outcome từng dòng.
- Không đụng thay đổi chưa commit ngoài phạm vi; đặc biệt OperationsProvider và integration test đang có sửa sẵn.
- Không chạy DB integration/load test vào production. Neon đang hết allowance: ưu tiên PostgreSQL+pgvector local hoặc DB test tách biệt được xác nhận.

## Đo và tiêu chí nghiệm thu

1. Baseline cùng fixture/user/device/socket và thời gian: idle15 phút, request check-in→response, toàn bộ cascade→summary ổn định. Đếm SQL thật bằng opt-in Prisma query events ở test/staging, không log params/token/vector/base64.
2. Không mặc nhiên gắn query event với request bằng AsyncLocalStorage: xác minh tương quan trên engine đang cài; nếu không đảm bảo dùng tracing đã kiểm chứng hoặc workload cô lập.
3. Ghi row count/result-byte estimate, số lần đọc avatar/ciphertext/details. App JSON length không phải wire-byte chính xác; đối chiếu Neon Console theo cửa sổ và các consumer cùng project.
4. Đo kích thước DB bằng octet_length/pg_column_size, trả tổng/avg/p95 nhỏ; không SELECT toàn ảnh/template chỉ để đo. pg_stat_statements chỉ dùng nếu có extension/quyền.
5. Auth/permission/socket scope: **0 byte ảnh/template/evidence**; JSON auth profile cần token-version/password-change vẫn giữ. Manifest poll v2 ổn định: **0 ciphertext/template_b64 từ DB**, cold-start/sync đo riêng.
6. List log default50/max200; không auto-fetchAll ở màn hình thường. Export đủ range/scope; monitor vẫn đúng ca đêm. Summary list nhẹ, detail đủ evidence.
7. Mục tiêu fixture blob lớn: giảm≥70% result bytes nhóm auth+manifest; toàn hệ thống chốt tỷ lệ sau đo. Không dùng ngưỡng query tùy ý cho FACE AUTO; đo SQL/bytes/latency riêng từng nhánh trước khi chọn tối ưu writer.
8. 100 socket/20 user: auth DB read theo batch, không query mỗi socket; revoke/transfer vẫn chặn delivery. Batch2.000 items: ≤8 insert item với chunk250, progress trả counters cố định thay toàn danh sách.

## Tasks triển khai

### Task 1b — Baseline đầy đủ theo byte (sau đợt khẩn cấp; Task1a ở trên)

**Files:** `backend/src/config/database.ts`; tạo `backend/validation/performance/neon-transfer.integration.test.ts`, `docs/maintenance/neon-transfer-baseline.md`.

**Interfaces:** opt-in collector trả queryCount/resultBytesEstimate/rows/elapsedMs/scenario, không lưu parameter; các task sau dùng cùng fixture.

- [ ] Viết fixture local: avatar lớn, evidence JSON lớn,100 bindings, nhiều user/socket; test collector không lưu secret/blob.
- [ ] Chạy `npx vitest run validation/performance/neon-transfer.integration.test.ts` trong backend trên DB test; baseline idle/request/cascade và top queries theo bytes.
- [ ] Nếu thiếu DB test, ghi rõ chưa đo; chỉ đối chiếu Neon Console khi allowance/truy cập cho phép, không chạy production để tạo baseline.

### Task 2 — Projection auth/permission/lookup (P0)

**Files:** `backend/src/modules/auth/auth.service.ts`, `backend/src/sockets/socket.auth.ts`, `backend/src/modules/employees/employee.permission.ts`, `employee.queries.ts`, `employee.model.ts`, `backend/src/modules/biometrics/biometric.service.ts`.

**Interfaces:** giữ AuthUser/req.user, permission và API profile. Projection nội bộ theo mục đích; không đổi employeeInclude toàn cục cho mọi caller.

- [ ] Thêm test query không chọn ảnh/passwordHash/history, nhưng status/role/token-version/password-change/face revoke vẫn đúng. Test vào `backend/validation/auth/socket-auth.test.ts`, `socket-refresh-race.test.ts`, `backend/validation/employees/employee.scope.test.ts`.
- [ ] Đọc safeUser/callers trước khi thay select. Giữ manager detection theo role+position+department, không chỉ departmentId. UUID dùng unique lookup; employee code vẫn hỗ trợ.
- [ ] Reuse auth context trong cùng read request; write nhạy cảm giữ recheck transaction. VERIFY_ONLY không tải ảnh lặp nhưng UI thật cần ảnh vẫn có nguồn hiển thị.
- [ ] Chạy các test trên cùng auth/face-login/attendance-security regression, so projection/byte trên fixture local. Không chờ benchmark Task1b hoàn chỉnh để sửa read không cần blob. Commit riêng projection.

### Task 2a — Thumbnail avatar mới lúc enroll (thay đổi nhỏ, độc lập)

**Files:** `face_auth/api_service.py`, tạo `face_auth/enrollment/avatar.py` và `face_auth/tests/test_avatar_thumbnail.py`; giữ `face_auth/enrollment/operation.py` làm điểm ghi trong transaction hiện có.

**Interfaces:** `make_avatar_thumbnail(image: np.ndarray) -> str` trả data URI JPEG hiển thị được trong UI. Đề xuất cạnh dài nhất ≤320px, giữ tỷ lệ, không phóng lớn ảnh nhỏ; tổng chuỗi base64 UTF-8 lưu vào DB ≤40 KiB, tính cả prefix. Đây là ngân sách hiển thị đề xuất, cần kiểm tra độ rõ trên UI trước khi chốt.

- [ ] Viết test ảnh lớn/nhỏ/dọc/ngang, decode kết quả hợp lệ, tỷ lệ/cạnh/byte đúng; kiểm tra giới hạn trên chuỗi base64 cuối, không chỉ JPEG bytes. Dùng OpenCV đang có, không thêm thư viện.
- [ ] Dùng bản sao ảnh decode hợp lệ dành riêng cho avatar; thumbnail sau đường trích xuất nhận diện hiện có. Không thay ảnh gửi detector/PAD, crop/align, embedding, centroid, threshold hay dataset. Không tiếp tục lấy mù ảnh đầu tiên nếu ảnh đó decode không hợp lệ.
- [ ] JPEG quality khởi điểm80, hạ dần tới40 rồi giảm kích thước nếu cần để đạt40 KiB; kiểm tra lỗi encode. Không ghi chuỗi hỏng/ảnh gốc lớn làm fallback, không để lỗi tạo ảnh phụ phá hỏng ghi nhận enrollment đã hợp lệ: giữ avatar cũ hoặc NULL khi chưa có, cảnh báo an toàn và test hành vi này.
- [ ] Kiểm tra enrollment idempotency/receipt/transaction vẫn giữ; `avatar_url` mới chỉ là thumbnail, UI vẫn nhận data URI. Test trước/sau xác nhận input embedding không đổi.
- [ ] Chạy `python -m unittest discover -s face_auth/tests -p test_avatar_thumbnail.py` và enrollment regression phù hợp. Ảnh cũ không tự nhỏ đi; backfill nếu cần là tác vụ riêng có backup, phạm vi và quyết định giữ ảnh gốc. Không yêu cầu migration schema.

### Task 3 — Tách3a khẩn cấp và3b sau sự cố

**Files:** attendance service/controller/dto/report-queries/details; dashboard/reports service; frontend attendanceApi/useRawLogsPagination/useAttendanceSummaries/useEmployeeOverview/ManagerAttendanceMonitor và toàn bộ caller tìm bằng rg.

**Task3a, khẩn cấp:** list/raw-log có UI phân trang dùng page tường minh, default50/max200; không tự tải tất cả page sau event. Chuyển mọi caller bị ảnh hưởng cùng API, giữ export đủ dữ liệu. Không chỉ thay5000→50 ở server: monitor/KPI/ghép ca còn dùng dữ liệu toàn range phải giữ contract tới3b hoặc chuyển sang read-model đầy đủ trước khi giới hạn.

**Task3b, sau sự cố:** summary list/detail, employee overview, monitor read-model và aggregate dashboard/report. Các bước dưới thuộc3b trừ regression pagination/export và adapter cần ngay cho3a.

**Interfaces:** log page/limit/hasMore; summary list nhẹ/detail employee+date; monitor read-model đủ dữ liệu. Giữ DTO cũ bằng adapter khi chuyển callers, không âm thầm đổi array sang object.

- [ ] Test10.001 logs: list đầu50, export đủ10.001, page/cursor ổn định khi có scan mới. Monitor vẫn đúng ca qua ngày/tháng dù dữ liệu ngoài page, KPI không đếm trên page thiếu.
- [ ] Test summary list không SELECT evidence/snapshot; detail đủ events/pairs/manual review. Employee overview dùng aggregate tháng và detail hôm nay.
- [ ] Đưa filter/range/scope/search xuống SQL; list đúng trang; export tường minh theo chunk. Giữ time VN/work_date và mọi trường UI cần. Dashboard/report aggregate trước khi truyền DB result.
- [ ] Chạy backend `npx vitest run validation/attendance validation/dashboard validation/reports`; frontend attendance-pagination/details/display/live-pages và dashboard/report tương ứng. So bytes/contract rồi commit API+callers cùng boundary.

### Task 4 — Manifest metadata + template theo nhu cầu (P0)

**Files:** fingerprint.service/routes, hardware/peripherals/fingerprint_worker.py; backend/validation/biometrics/fingerprint.test.ts, hardware/validation/test_fingerprint_integration.py, hardware/test_fingerprint.py.

**Interfaces:** manifest v2 có manifest_version/public session/binding metadata; endpoint device-auth lấy một binding template. Giữ v1 trong giai đoạn worker cũ còn chạy, đo riêng traffic v1/v2.

- [ ] Test SYNCED v2 poll không SELECT ciphertext ở template lẫn session; fetch sai device hoặc binding revoked bị từ chối.
- [ ] Test restart mất _verified, Flash thiếu/hỏng, slot PENDING có dữ liệu lạ, retry ack/REVOKED. Download đúng lúc, checksum/revision/readback đủ, không ghi đè slot lạ.
- [ ] Chuyển backend+worker phối hợp, giữ expiry/cancel/heartbeat90s. Chỉ tắt v1 sau khi xác nhận mọi thiết bị nâng cấp.
- [ ] Chạy fingerprint backend và Python fake-sensor regressions; UART/WAK/Flash thật theo protocol hardware riêng. Commit theo contract version, chưa claim hardware thật nếu chưa thử.

### Task 5 — Context transaction check-in (hoãn; cần số đo biện minh)

**Files:** attendance.service/webhook/format/model, fingerprint.attendance, payroll/public, shifts/shift.queries; thêm attendance.capture-context.ts nếu helper làm service khó đọc.

**Interfaces:** `loadAttendanceDayStates(tx, employeeId, dates)` trả Map ngày→payrollClosed/dayLocked/reviewStatus/reopenedAt; chỉ sống trong transaction, invalidate/update sau write. Formatter nhận schedule đã có; writer nội bộ resolve AUTO/replay dưới lock.

- [ ] Dùng nhánh FACE AUTO bảng22 làm baseline quan sát, không áp query budget tùy ý; test outcome/response giống cũ và không đọc lại cùng day state trong affected.
- [ ] Test receipt/captured timeline khác nhau, backdated scan, cooldown, replay cũ sau event mới, collision eventId, ca đêm qua kỳ, employee inactive, revoke/maintenance giữa precheck và write.
- [ ] Batch state reads/reuse schedule sau locks; giữ lock order và currentEmployee recheck. Giảm include chỉ khi DTO vẫn đủ.
- [ ] Chạy attendance policy/security/min-event-interval/fingerprint regressions; races/safety/lock-concurrency integration qua DB tách biệt. Đo SQL/bytes/latency, giữ correctness; không yêu cầu đạt16 và không bỏ check để đạt query budget. Commit capture riêng nếu đáng triển khai.

### Task 6 — Coalesce aggregation và incremental theo hạn (hoãn)

**Files:** attendance.aggregation/cron/service/adjustments/missing-alerts và mutation shift/payroll đã kiểm kê.

**Interfaces:** dedupe employeeId/workDate; marker DB là nguồn phục hồi, không riêng Map/setImmediate. Giữ aggregateDailyAttendance để manual/full-rebuild đối soát.

- [ ] Test nhiều event một ngày coalesce, restart sau log commit vẫn tính bù, source đổi trong lúc aggregate không mất dirty marker.
- [ ] Test không scan mới nhưng tới hạn shift/absent/missing-checkout/OT; đổi policy/shift/review/unlock invalidation đủ; ca qua tháng đủ ngày.
- [ ] Thu hẹp SELECT trước, giữ batch SQL250/transaction. Sau đó candidate incremental+due sweep; không cắt cron trước khi mọi mutation và time-driven case có coverage.
- [ ] Đo idle cron/cascade, chạy production batch branch với RUN_BATCH_SQL_TESTS=1 trên DB test. Mock-only test không chứng minh SQL batch thật. Commit projection/coalesce/incremental theo bước.

### Task 7 — Realtime một nơi, batch quyền (P1)

**Files:** attendance.gateway/recipients, operation.gateway, fingerprint.gateway, socket.auth; frontend useAttendance/useAttendanceSocket và socket hooks khác, OperationsProvider.

**Interfaces:** một connection/subscription owner mỗi namespace/frontend session; một event/revision invalidate đúng slice. User-state snapshot chỉ trong delivery, JWT từng credential/refresh sequence vẫn giữ.

- [ ] Test100 socket/20 user: batch reads; revoke/transfer giữa events chặn lần tiếp theo; token hết hạn một tab không miễn kiểm tra tab khác.
- [ ] Test checked-in→summary-updated: không tải toàn raw list hai lần; summary chỉ refresh theo trạng thái thật; reconnect phục hồi đủ dữ liệu/quyền.
- [ ] Invalidate employee/date/domain, debounce250ms; chỉ update cache từ payload nếu đủ dữ liệu và đúng filter/page. Giữ polling dự phòng/reconciliation.
- [ ] Chạy socket-auth/refresh-race/scope, frontend attendance-live-pages và operations integration. Bảo toàn chỉnh sửa OperationsProvider đang có. Commit realtime riêng.

### Task 8 — Batch shifts/payroll/chốt công và notification (P2)

**Files:** operation.service, shift-batch.service, operation.gateway, payroll.service, attendance.service, attendance.notifications.service.

**Interfaces:** giữ idempotency/input-hash/expectedVersion/lease/per-item outcome; progress counters+revision, item errors đọc khi xem detail. Notification giữ ownership và scope.

- [ ] Test2.000 item chunk250, counters cố định, partial fail/retry/lease takeover đúng; manager đổi quyền giữa batch bị chặn tại write.
- [ ] createMany/parameterized JSON insert, source shifts batch, progress COUNT FILTER phát≤1 lần/500ms và trạng thái cuối; giữ per-item transaction khi API partial-success.
- [ ] Payroll/chốt công chỉ batch row độc lập sau validation trong lock; RETURNING/count để phát hiện conflict; giữ snapshot/adjustment/audit. Không skipDuplicates thay upsert cần update.
- [ ] Notification reuse actor cùng read request, query nhẹ. Chạy shifts/operations/payroll/notification-scope và scale integration trên DB test; commit module độc lập.

### Task 9 — Worker/polling (sau cùng; ưu tiên compute)

**Files:** operation.worker, OperationsProvider, NotificationContext, dashboard/device/attendance query hooks, useFingerprintEnrollment. Giữ fallback theo socket đã có ở useDeviceSettings.

**Interfaces:** local wake sau enqueue, idle backoff; multi-instance có recovery poll/lease heartbeat. Không tự đổi SLA chấp nhận việc.

- [ ] Test cleanup không chạy mỗi giây; expires_at vẫn chặn stagedInput tức thời; lease heartbeat20s giữ nguyên.
- [ ] Đề xuất claim backoff1→5→15→30s rảnh, reset khi local enqueue/có việc; cleanup60s. Instance khác có thể nhận việc chậm tối đa30s: cần xác nhận SLA trước khi áp dụng.
- [ ] Với idle30s+cleanup60s: khoảng4.320 SQL/ngày thay172.800 (~97,5% ít lượt worker-rảnh hơn), không phải97,5% network toàn hệ thống và không đảm bảo Neon suspend.
- [ ] UI dừng polling nhanh khi socket khỏe/tab ẩn, có slow reconciliation/reconnect. Fingerprint session poll khi active; heartbeat thiết bị vẫn đúng freshness.
- [ ] Chạy workload Task1 lại, regression các module thay đổi; report bytes/SQL/latency. Chỉ claim giảm network thực sau quan sát Neon usage khi truy cập được. Commit evidence/giới hạn.

## Review focus và rollout

1. Avatar UI vẫn hiển thị, auth/permission không tải blob (Task2/3).
2. Role/department/account/face revocation đúng trước event/write tiếp theo, nhiều tab/instance (Task2/5/7/8).
3. Cold-start sensor, slot conflict, revoked template và checksum/Flash readback (Task4).
4. Ca đêm qua ngày/tháng, backdated/cooldown/replay concurrency và payroll lock (Task3/5/6).
5. Pagination không làm thiếu export/monitor; catch-up/time-driven vẫn đúng sau restart (Task3/6).

Đợt khẩn cấp Task1a→2→4→3a, điều chỉnh theo byte và số thiết bị hoạt động; Task2a thumbnail là thay đổi nhỏ độc lập sau projection. Benchmark1b không chặn hotfix. Chỉ mở3b/5/6/7/8 khi đo sau hotfix vẫn cho thấy cần; Task9 sau cùng vì chủ yếu compute. Không gom mọi thay đổi rủi ro vào một PR. Mỗi task rollback riêng; manifest rollback phải phù hợp worker version. Không xóa ảnh gốc/lịch sử công/lương để rollback.

Neon đã hết allowance: sửa code không khôi phục số quota đã dùng. Chủ tài khoản chọn chờ reset hoặc phương án billing/allowance được Neon xác nhận ở phần quyết định vận hành. Test local/tách biệt trong lúc chờ; agent không tự nâng gói/tạo project/move database.

## Tài liệu kỹ thuật

- [Prisma query logging](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/logging): quan sát SQL; đối chiếu API Prisma5 đang cài trước triển khai.
- [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions): atomicity không đồng nghĩa gom SQL; Promise.all trong một connection không loại bỏ query round trip.
- [PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/17/pgstatstatements.html): calls/rows/time, DB blocks và WAL; không có metric network bytes/query.
- [Neon usage metrics — nguồn chính thức](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md): network transfer là metric riêng compute/storage.

## Trạng thái bàn giao

Đã được người dùng duyệt triển khai. Đợt khẩn cấp Task2/2a/4/3a đã được thực hiện và kiểm tra; Task1a đã chuẩn bị SQL chẩn đoán nhưng chưa chạy vì chưa có DB kiểm thử khả dụng và Neon hết allowance. Các task hoãn vẫn giữ nguyên phạm vi hoãn. Xem `docs/maintenance/neon-network-hotfix-2026-11-08.md` để biết kết quả, giới hạn đo và thứ tự rollout. Chưa commit/push/deploy hoặc thay billing.

Cập nhật theo yêu cầu tiếp theo ngày08/11: đã kết nối Neon lấy số đo thật, bật pg_stat_statements, backup và nén2 avatar lớn, triển khai/restart ba dịch vụ local được người dùng xác nhận. Đã kiểm chứng các SQL projection trên Neon bằng read-only và lấy delta tần suất thực tế. Chi tiết hiện hành ở `docs/maintenance/neon-local-rollout-2026-11-08.md`; không có hosting production mới, không đổi billing. Các redesign lock/payroll/incremental aggregation/backoff vẫn chưa triển khai.
