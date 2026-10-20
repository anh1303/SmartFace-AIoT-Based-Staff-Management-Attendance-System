# Thay đổi backend — 19/10/2026

Quy tắc áp dụng: [COMPANY_POLICY.md](../../rule/COMPANY_POLICY.md), phiên bản `2026-10-19-v2`.

## 1. Điểm danh và tổng hợp công

| Lỗi/cơ chế cũ | Cách xử lý mới | Nguồn chính |
|---|---|---|
| Lấy IN đầu/OUT cuối, trả tiền cả khoảng không làm; chọn nhầm IN khi quét nhiều lần | Máy ghép sự kiện liền kề, IN sau thay IN trước chưa ghép; OUT dư không kéo dài cặp | `attendance.policy.ts` |
| Ràng buộc cùng ngày, không xử lý đúng OUT hôm sau | Ghép theo dòng sự kiện từng nhân viên; cặp ≤24h thuộc ngày IN; >24h không trả công và cần rà soát | `attendance.policy.ts`, `attendance.service.ts` |
| Tự suy diễn đầu/đuôi thiếu, trả đủ giờ lịch | Chỉ trả phần nằm trong cặp hợp lệ và cửa sổ ca | `attendance.policy.ts` |
| Đến sớm được tăng giờ; OFF 00:00 bị fallback thành giờ làm | Chặn trước giờ ca, giữ đúng 00:00, OFF/no-shift không tự trả công/OT | `attendance.policy.ts` |
| Các nơi dùng quy tắc làm tròn khác nhau | Giữ giây gốc; cộng cặp trong ngày rồi làm tròn theo ba mức phần lẻ <0,5 / 0,5–<0,75 / ≥0,75 | `attendance.policy.ts` |
| OT tự cộng ngay, tính cả phần không hiện diện | Tách giây OT, giờ đề xuất, trạng thái và giờ đã duyệt; xét ngưỡng >30 phút, cờ >4h trên số gốc | Schema, policy/service |
| Sửa tay bị cron ghi đè hoặc audit cũ khiến không tính lại mãi | Marker điều chỉnh + fingerprint nguồn; giữ duyệt khi nguồn không đổi, hủy duyệt khi nguồn đổi và lưu audit | `attendance.service.ts` |
| Request đồng thời tạo trùng, retry thành hai lần quét | `event_key` duy nhất theo thiết bị/event ID, transaction và advisory lock; replay trả bản ghi cũ | `attendance.service.ts` |
| Đồng hồ Pi sai/gửi muộn vẫn được tự trả tiền | Dùng `client_timestamp`; timestamp bất thường và sự kiện gửi vào kỳ đã chốt được FLAGGED | `attendance.service.ts` |
| Tương lai thành vắng mặt, cron chậm cập nhật/ghi chồng | Không tổng hợp ngày tương lai; tính lại ngay sau ghi log/đổi ca; cron chống chạy chồng, xử lý tháng hiện tại và tháng trước | Service, cron |

Giữ toàn bộ raw log, kể cả OFF, IN/OUT dư, sự kiện không ghép được. Bản ghi FLAGGED ngắt cặp và không tự đưa vào lương. Bản ghi thừa không bị xóa để “làm sạch” lịch sử.

Tổng hợp tháng khóa theo kỳ; đọc nguồn và ghi kết quả trong cùng transaction. Truy vấn nguồn/khóa/phiếu theo lô, ghi tổng hợp bằng `jsonb_to_recordset` có tham số và danh sách cột SQL cố định. Điều này tránh một vòng truy vấn DB cho mỗi nhân viên/ngày và tránh dùng nguồn đã đọc cũ sau khi chờ khóa. Kết quả không đổi không bị ghi lại liên tục.

### Quy tắc làm tròn thống nhất

`roundHours` được dùng cho tổng hợp ngày, duyệt OT và chỉnh giờ trên phiếu: phần lẻ <0,5 bỏ; từ 0,5 đến dưới 0,75 tính 0,5 giờ; từ 0,75 làm tròn lên. Ví dụ 1,49→1; 1,50→1,5; 1,74→1,5; 1,75→2. Ca đủ 08:00–17:30 là 9,5 giờ, 20 ca là 190 giờ. OT 40 phút đủ điều kiện được đề xuất 0,5 giờ; đúng 30 phút vẫn chưa đủ điều kiện tự đề xuất.

Ngưỡng >30 phút và cờ >4 giờ xét trên giây gốc. Version tính toán được lưu cùng summary/phiếu để yêu cầu tính hoặc rà soát lại dữ liệu khác phiên bản trước khi chốt; phiếu đã đóng được bảo toàn. Test có các mốc 30 phút, 44:59, 45 phút, số giờ nhiều phần nguyên và kiểm tra PostgreSQL lưu số giờ nửa giờ/duyệt 2,74→2,5. Không sửa số giờ hoặc số tiền lịch sử trên Neon để áp dụng thay đổi code này.

## 2. Duyệt OT, điều chỉnh, ca và khóa

- `PATCH /api/attendance/adjust`: bắt buộc lý do, số giờ hữu hạn không âm; duyệt cao/thấp hơn số ghi nhận; lưu người duyệt/thời điểm. Không tự biến việc duyệt OT thành trả đủ giờ ca.
- Quyền self/Manager khác/phòng ban áp dụng lại ở backend; giao diện không phải chốt bảo vệ duy nhất.
- Audit và thay đổi tài chính trong cùng transaction; audit thất bại thì rollback.
- Ngày khóa và phiếu đóng không bị cron ghi đè. Raw log mới vẫn được lưu để đối chiếu. Thay đổi nguồn dưới ngày khóa làm căn cứ cần rà soát lại khi mở khóa; kỳ đã chốt giữ số liệu đã chốt.
- Không khóa ngày khi còn ngày công/OT chưa được xử lý. Khóa ngày dùng cùng trật tự khóa kỳ → ngày với các thao tác sửa.
- Đổi ca cập nhật cả `employee_shifts.shift_id`, giờ và loại ca; tôn trọng khóa, ghi audit, vô hiệu căn cứ cũ và tổng hợp lại.
- Kiểm tra phiếu đóng theo nhân viên khi sửa công/ca; việc một người đã chốt không cấm duyệt công của người khác.

## 3. Tính lương

| Vấn đề | Bản sửa |
|---|---|
| Tổng công 0 bị thay bằng 176/giờ lịch; OT/trễ bằng 0 giữ số cũ | Dùng đúng tổng mới, gồm số 0 |
| OT nằm trong giờ thường rồi cộng thêm toàn bộ đơn giá OT | Giờ thường chỉ nằm trong ca; OT đã duyệt trả riêng |
| Tính lại ghi đè FINALIZED/CONFIRMED/PAID | Bỏ qua phiếu đóng khi tính hàng loạt; chỉ định phiếu đóng thì từ chối |
| API sửa thẳng trạng thái/phiếu đã trả | Tách thao tác chốt/mở khóa; PAID không mở lại bằng ghi đè |
| Chốt kỳ dù công/OT còn cần duyệt | Chặn review, OT PENDING, dữ liệu cũ chưa có policy version |
| Công được duyệt lại sau khi tạo lương nhưng vẫn chốt phiếu cũ | Lưu fingerprint nguồn công/OT trong phiếu và kiểm tra trước chốt |
| Chỉnh chính sách định giá lại toàn bộ lịch sử | Lưu snapshot đơn giá trong phiếu; đổi cấu hình không viết lại tiền cũ |
| Tính lại xóa phiếu chỉnh tay | Giữ phiếu có marker chỉnh tay; nguồn đổi phải rà soát/lưu lại trước chốt |
| Tính/chốt hàng loạt vượt quyền | Lọc nhân viên theo quyền sửa; không tự sửa lương mình hoặc Manager khác |
| Giờ/giá âm, NaN/Infinity, kỳ sai, số tiền tràn | DTO kiểm tra dữ liệu; công thức từ chối giá trị không hợp lệ hoặc vượt giới hạn trường tiền |

Đọc xác nhận bảng chính sách trên Neon ngày 19/10/2026: OT 100.000 VNĐ/giờ, phạt trễ/sớm 50.000 VNĐ/giờ. Không sửa hai giá trị đó trong DB. Đồng bộ fallback của service/repository/frontend về 100.000 VNĐ/giờ để trường hợp chưa có bản ghi chính sách không tự chuyển thành OT 1,5 lần. Phiếu lịch sử vẫn diễn giải snapshot đơn giá theo quy tắc `≤10`: hệ số, `>10`: VNĐ/giờ. Phụ cấp phiếu mới 1.500.000 VNĐ, phiếu đã có bảo toàn số tiền của phiếu. Không thực hiện chuyển tiền hoặc bổ sung thuế/bảo hiểm.

## 4. Webhook, RPC và Socket.IO

- Webhook điểm danh và mode-notify yêu cầu header `X-TB-Webhook-Secret`; thiếu cấu hình trả 503, sai secret trả 401. Không yêu cầu JWT người dùng cho ThingsBoard, nhưng phải xác thực thiết bị qua chốt riêng này.
- Kiểm tra mode, event ID, timestamp, điểm PAD hữu hạn trong [0,1], vector đúng 512 phần tử hữu hạn và có norm khác 0. Không mặc định thiếu PAD thành người thật.
- Nếu Rule Chain gửi `X-Device-Name`, đối chiếu với `device_id` trong body. Script triển khai thêm header từ metadata originator; không fallback tùy tiện về PI4 khi thiếu thiết bị.
- Sự kiện SPOOF có thể chuyển lên màn hình giám sát mà không gửi embedding hoặc tạo điểm danh.
- Phản hồi chứa `event_id`; lưu điểm nhận diện/PAD thực. Retry đã lưu không phát lại sự kiện điểm danh mới.
- Cả namespace `/attendance` và `/devices` tự áp dụng JWT middleware; hỗ trợ cookie HttpOnly giống HTTP API. Broadcast dùng phòng quyền, loại bỏ phát trùng namespace + room.
- Sự kiện công cá nhân có thể gửi vào room user của chính nhân viên; các cảnh báo chưa xác định người chỉ gửi cho Admin/Manager. Tập hợp room dùng broadcast union để người thuộc hai room vẫn nhận một lần.
- Đổi mode phải gọi ThingsBoard RPC và nhận xác nhận của Pi. Chỉ sau ACK mới lưu Shared Attribute, phát sự kiện và trả thành công. API đọc mode cũng hỏi Pi.
- ThingsBoard 401 làm refresh JWT một lần; lỗi HTTP/timeout không bị nuốt thành thành công. Tra đúng thiết bị theo tên/UUID yêu cầu thay vì dùng một UUID cho mọi thiết bị.
- Danh sách thiết bị dựa trên dữ liệu thật và thời gian hoạt động, không tự dựng thiết bị ONLINE khi API lỗi.

## 5. Schema và trạng thái Neon

Migration cộng thêm: `backend/prisma/migrations/20261019100000_attendance_policy_and_ot_review/migration.sql`.

- `attendance_logs`: `event_key`, `work_date`; unique index event key và chỉ mục employee/date.
- `daily_attendance_summary`: giây gốc, OT đề xuất/trạng thái/lý do/người duyệt, review, marker chỉnh tay, chi tiết nguồn và phiên bản chính sách.
- `payroll_records`: snapshot đơn giá OT/phạt và chi tiết căn cứ tính.

**Migration này đã được áp dụng lên Neon đang cấu hình trong phiên làm việc.** Nó chỉ `ADD COLUMN`/`CREATE INDEX`; không có DELETE, UPDATE tiền lương, DROP hoặc reset. Người dùng đã xác nhận cho phép bổ sung cột/chỉ mục miễn không sửa/xóa dữ liệu khác. Các cột cũ và giá trị nghiệp vụ cũ không được sửa bởi migration này.

Lần chạy ban đầu định nhắm DB tạm nhưng `DIRECT_URL` vẫn trỏ Neon; đã thông báo ngay và giữ nguyên các cột cộng thêm. Sau đó migration và mọi thử nghiệm tạo/sửa công/lương đều chạy trên DB tạm với **cả `DATABASE_URL` và `DIRECT_URL`** được gán rõ ràng. Không chạy seed/reset trên Neon. Backend/Frontend/Pi mới chưa được triển khai vào các tiến trình đang chạy.

Dữ liệu tổng hợp cũ có `policy_version = NULL`; hệ thống yêu cầu tổng hợp/rà soát lại khi tính lương. Ngày/phiếu đã khóa không được tự chuyển đổi số tiền lịch sử.

## 6. Kiểm chứng

- Backend TypeScript build thành công.
- Unit policy: các mốc làm tròn, IN lặp, OUT lặp, nhiều cặp, đi sớm, OFF, cặp 24h/>24h, OT >30m/>4h, sự kiện FLAGGED và thiếu cặp.
- Webhook: thiếu/sai PAD, vector không hữu hạn, event ID/mode sai, SPOOF không embedding, UNKNOWN có tương quan, xác thực secret.
- PostgreSQL tạm có pgvector: chạy toàn bộ chuỗi migration, retry đồng thời chỉ một log, giữ OT duyệt qua tổng hợp lại, duyệt cao hơn số ghi nhận, tổng 0 không fallback, snapshot giá, chốt phiếu cũ bị chặn, bảo vệ FINALIZED/PAID, OFF, đổi FK ca, cặp >24h, rollback khi audit lỗi và phân quyền hàng loạt.
- Socket.IO localhost: thiếu/hết hạn token bị từ chối trên từng namespace; broadcast không lộ cho Employee và không bị phát trùng.

Xem lệnh tái hiện tại [hướng dẫn kiểm tra và triển khai](../../tutorial/deployment/ATTENDANCE_PAYROLL_RELEASE.md). Chưa chứng minh chịu tải Neon, độ chính xác nhận diện thật, hoặc luồng MQTT/REST/RPC của Rule Chain mới trên server đang vận hành.

## Xác nhận check-in/out liên tiếp (20/10)

Dùng chung `ATTENDANCE_STABLE_COUNT=3` cho CHECK_IN và CHECK_OUT; đã cập nhật `.env` và `.env.example` của face_auth, hardware và backend. Không dùng biến mới trùng nghĩa `ATTENDANCE_RECOGNITION_CONFIRMATIONS`. Giá trị trước đây 5 trong face_auth chỉ nằm ở nhánh ghi công đã comment, không phải bộ đếm 5 giây đang áp dụng.

Hardware gửi hai RPC `event_kind=VERIFY_ONLY` để xác minh danh tính mà không ghi công; lần kế tiếp đủ mốc gửi `CONFIRMED_SCAN` với employee ID đã khớp. Mỗi inference có recognition_id riêng, retry giữ nguyên payload/ID. Backend đếm ba lượt khác nhau cho cùng device/mode/event và cùng nhân viên; lần cuối vẫn phải khớp expected_employee_id. UNKNOWN/đổi nhân viên bắt đầu lại; phần trạng thái xác minh tạm có TTL 30 giây, giới hạn 512 phiên và 64 recognition ID/phiên. Restart backend làm mất bộ đếm và yêu cầu xác minh lại, không tự ghi sớm.

Chỉ khi đã xác nhận đủ mới đi vào writer giao dịch/idempotency trước đây. Probe không tạo raw log/summary công; retry lần ghi cuối vẫn dùng event ID/capture cũ để không tạo thêm bản ghi. Bản ghi/cơ chế tính công, lương và dữ liệu Neon không bị sửa bởi các test. Trong face_auth, cùng biến điều khiển trạng thái CONFIRM 1/3 → 2/3 → sẵn sàng; không bật lại Python ghi DB trực tiếp. Số 2 của RECOGNITION_LABEL_CONFIRMATIONS vẫn chỉ ổn định việc đổi tên UI, không quyết định ghi công.

**Triển khai backend và hardware cùng phiên bản.** Backend mới từ chối face RPC kiểu cũ thiếu xác nhận; backend cũ từ chối các event_kind mới thay vì âm thầm ghi probe. Rule Chain phải chuyển nguyên params (event_kind, recognition_id, expected_employee_id) như các trường vector/event ID hiện tại. Chưa triển khai bản này lên server/Pi.

Kiểm chứng: build backend, unit counter/webhook; integration PostgreSQL tạm kiểm tra cả IN và OUT hai lần đầu có zero bản ghi, lần thứ ba thêm đúng một và retry không thêm bản ghi; mô phỏng camera/RPC với Track thật kiểm tra hai probe trước commit cho cả hai mode. Regression runtime/UI/worker tiếp tục đạt. Test database chỉ dùng localhost/policy_check, không dùng Neon; chưa kiểm chứng trên Pi/MQTT thực tế.

Cập nhật mốc xác nhận ngày 20/10: `ATTENDANCE_STABLE_COUNT=4` trong .env/.env.example và giá trị dự phòng của cả ba dịch vụ. Ba lượt đầu chỉ xác minh; lượt thứ tư mới ghi công. Mốc 3 trong mô tả triển khai ban đầu phía trên được thay bằng 4; PAD vẫn tối thiểu 3 phiếu trong cửa sổ 5.

Chốt lại ngày 20/10 theo yêu cầu: `ATTENDANCE_STABLE_COUNT=3` cho cả IN/OUT, đồng bộ .env/.env.example và fallback của face_auth/hardware/backend. Hai lượt đầu chỉ xác minh, lượt thứ ba cùng nhân viên mới ghi công. Giữ reset khi verdict PAD sau vote là SPOOF hoặc mất track; không thay cơ chế PAD vote/thông số model. Face_auth lưu tập track đã thấy ở frame trước để xóa chuỗi xác nhận và tăng verification_generation ngay cả khi danh sách tracked tạm rỗng; nhận lại cùng ID cũng bắt đầu 1/3. Test sau 2 kết quả khớp rồi SPOOF/mất track yêu cầu đủ 3 kết quả mới, không tiếp tục bộ đếm cũ. Face_auth vẫn là demo nhận diện/readiness, không bật lại writer DB trực tiếp.
