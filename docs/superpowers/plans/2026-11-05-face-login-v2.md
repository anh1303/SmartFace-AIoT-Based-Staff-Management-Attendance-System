# Kế hoạch triển khai đăng nhập tự nhận diện khuôn mặt — bản 2

> **Đã thay thế:** Xem [kế hoạch bản 3](2026-11-05-face-login-v3.md) cho phạm vi một instance và nhóm thử nhỏ.

**Trạng thái:** Kế hoạch; chưa triển khai. Bản này thay thế `2026-11-05-face-login.md`. Ngày đối chiếu pháp lý: 05/11/2026. Dự kiến áp dụng tại Việt Nam; đơn vị vận hành phải xác nhận phạm vi pháp lý thực tế.

**Mục tiêu:** Người đã chủ động đồng ý dùng khuôn mặt cho mục đích đăng nhập có thể chọn camera webcam; hệ thống tự tìm danh tính 1:N và cấp phiên hạn chế. Mật khẩu vẫn sẵn có. ADMIN/MANAGER bị chặn cứng đăng nhập bằng mặt. Không tạo chấm công.

**Đường triển khai:** Trình duyệt → Node/Express → FastAPI `face_auth` → kết quả PAD/vector → Node tìm pgvector trong tập được phép → kiểm tra lại quyền, đồng ý → cấp cookie JWT có `amr`. Tất cả công việc sản phẩm bị chặn cho đến khi spike Công việc 0 đạt go; production và pilot có dữ liệu thật bị chặn thêm bởi các cổng pháp lý và an ninh.

**Lưu ý cốt lõi:** Theo [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), đặc điểm sinh trắc không phải bí mật và NIST yêu cầu dùng sinh trắc cùng authenticator vật lý; hệ thống này với chỉ camera không đáp ứng mô hình đó. Không gọi đây là MFA, chống phishing hay chống replay. Do hệ thống chứa dữ liệu nhân sự, phương án mặt đơn lẻ chỉ được pilot sau khi chủ hệ thống chấp nhận rủi ro bằng văn bản; nếu mức bảo đảm này không được chấp nhận thì **no-go mặt đơn lẻ**, chọn passkey/yếu tố vật lý trước khi phát hành.

## 1. Đánh giá góp ý và quyết định

| Góp ý | Quyết định |
|---|---|
| Spike webcam/PAD/1:N và domain shift | Chấp nhận; đo trước API/UI, gồm cả nguồn mẫu đăng ký. Chênh lệch hiệu năng là giả thuyết phải đo, không khẳng định chắc chắn. |
| 1:1, mặt làm yếu tố thứ hai, WebAuthn | So sánh bên dưới. 1:N giữ vì người dùng chọn tự nhận diện, không phải vì nó bắt buộc về kỹ thuật. |
| Opt-in và DPIA | Chấp nhận; đồng ý riêng cho đăng nhập và thu hồi tức thời; cơ sở pháp lý, thông báo, thời hạn và hồ sơ phải được đơn vị pháp chế xác minh. |
| `amr`, chặn quyền cao, bỏ remember | Chấp nhận: `amr=["face"]`, chặn ADMIN/MANAGER, session ngắn, không remember; thao tác nhạy cảm phải xác thực lại. |
| Nonce và hành động ngẫu nhiên | Chấp nhận như giảm rủi ro: nonce chống dùng lại giao dịch đã tiêu thụ; thử thách chỉ có tác dụng nếu được server xác minh từ dữ liệu thực. Không chứng minh camera thật hay ngăn deepfake/replay có thích nghi. |
| Gộp lỗi, theo dõi nhắm mục tiêu | Chấp nhận; phản hồi chung với kết quả an ninh. Cảnh báo theo ứng viên nội bộ có sai số, không tự khóa tài khoản nạn nhân. |
| Pairwise, centroid, margin | Chốt công thức; các giá trị 0,75 và 0,05–0,08 chỉ là ví dụ, không dùng mặc định sản xuất. Một ứng viên không có margin thì fail closed khi yêu cầu margin. |
| Resize/crop theo tỉ lệ webcam | Không tự thay crop dựa theo 16:9/4:3: giữ đúng cấu hình model, đo và hiệu chỉnh nếu có bằng chứng. JPEG quality 0,85 hay cạnh 640 không đảm bảo dưới 150 KiB; đo bytes thực tế. |
| Semaphore 0,5 giây/executor | Giới hạn hàng đợi và đồng thời là cần thiết; 0,5 giây chỉ là giá trị thử tải. Endpoint FastAPI `def` đã được chạy trong threadpool; không thêm executor hoặc `asyncio` máy móc. Timeout HTTP không đảm bảo dừng inference đã chạy. |
| Lỗi và timing | Gộp lỗi bảo mật; thông báo camera cục bộ vẫn hữu ích. Độ trễ ngẫu nhiên đơn thuần không xóa timing oracle; đo phân bố, giới hạn tần suất và thiết kế ngân sách thời gian có giới hạn, tránh tăng DoS. |

## 2. Các phương án và lý do lựa chọn

- **1:N mặt đơn lẻ — được chọn cho nghiên cứu/pilot:** Không cần nhập tên, đáp ứng yêu cầu. Đánh đổi: khả năng nhận nhầm theo quy mô thư viện, dữ liệu sinh trắc tập trung, khó giới hạn thử theo tài khoản và webcam không đáng tin. Không đủ căn cứ coi an toàn cho sản xuất chỉ nhờ PAD.
- **1:1 bằng tên đăng nhập + mặt:** Giảm tập so khớp, thuận tiện kiểm soát số lần thử, nhưng yêu cầu nhập danh tính và vẫn chịu giả mạo/replay. Không chọn làm luồng chính vì trái yêu cầu tự nhận diện; có thể dùng làm phương án thay thế nếu spike 1:N thất bại.
- **Mật khẩu + mặt làm yếu tố thứ hai:** Giảm phụ thuộc vào một bằng chứng nhưng vẫn cần bảo vệ mẫu và chống injection; không tương đương phương án của NIST yêu cầu authenticator vật lý. Không chọn cho pilot do thêm bước và không thực hiện mục tiêu đăng nhập chỉ bằng mặt.
- **WebAuthn/passkey:** Đăng nhập dựa trên khóa công khai gắn thiết bị/tài khoản, có thể dùng sinh trắc cục bộ; phù hợp hơn cho chống phishing và không cần thư viện mặt tập trung cho xác thực. Không được chọn làm phạm vi hiện tại vì không tận dụng pipeline `face_auth`/1:N và cần đăng ký thiết bị; đây là phương án ưu tiên thay thế nếu yêu cầu an ninh không cho phép mặt đơn lẻ.

**Quyết định 1:N:** Cần thiết cho trải nghiệm “không nhập danh tính” đã được chọn, không phải yêu cầu bảo mật. Nếu rủi ro còn lại hoặc độ chính xác không đạt mục tiêu thì dừng thay vì nới ngưỡng; trình bày phương án thay thế cho chủ hệ thống.

## 3. Threat model và chính sách

**Tài sản:** cookie/phiên, tài khoản và quyền, hồ sơ nhân sự, ảnh và template, hồ sơ đồng ý, hệ thống AI và tài nguyên xử lý. **Ranh giới tin cậy:** browser/webcam không đáng tin → backend; backend → Face Auth có xác thực; backend → DB và audit. Không để browser quyết định PAD, hành động challenge, danh tính, ngưỡng hay vai trò.

| Đe dọa | Kiểm soát | Rủi ro còn lại |
|---|---|---|
| Ảnh in/màn hình/video | PAD và thử thách được kiểm tra server, test theo loại tấn công | PAD có thể thất bại với môi trường và loại giả chưa thấy. |
| Replay HTTP | Challenge ngẫu nhiên một lần, TTL, tiêu thụ nguyên tử và ràng buộc luồng | Có thể ghép ảnh cũ vào challenge mới; nonce không ký được nguồn ảnh. |
| Camera ảo, deepfake, máy khách bị chiếm | Hạn chế mạng/thiết bị quản lý nếu vận hành được; giới hạn quyền phiên | Browser thông thường không chứng thực camera hoặc nội dung. Không khẳng định chống injection. |
| Dò PAD/danh tính và nhắm mục tiêu | Gộp lỗi, giới hạn tốc độ, kiểm tra phân bố thời gian, cảnh báo nội bộ | Timing và điểm số có thể bị suy đoán; giới hạn 1:N theo người không chính xác. |
| Mẫu/phiên bị lộ, lạm quyền | TLS, cô lập dịch vụ, phân quyền DB, mã hóa và quản lý khóa, audit không chứa sinh trắc, cookie HttpOnly | Sinh trắc không thể đổi như mật khẩu; dự phòng và máy chủ vẫn là mục tiêu. |
| Gây quá tải bằng ảnh/request | Kiểm tra header trước decode, giới hạn pixel/body, hàng đợi và concurrency, timeout | CPU native có thể tiếp tục chạy sau khi client ngắt; cần giới hạn container và kiểm thử tải. |
| Dùng mẫu sau khi rút đồng ý | Lọc trước tìm kiếm và kiểm tra lại trước cấp phiên, phiên gắn phiên bản đồng ý | Cần xử lý cạnh tranh giao dịch và thu hồi phiên đã cấp. |

**Mạng/thiết bị:** Mặc định pilot chỉ qua VPN hoặc mạng tổ chức nếu thực sự có và kiểm tra tại proxy đáng tin. IP không chứng minh danh tính, chia sẻ NAT và thay đổi mạng có thể gây khóa nhầm; không coi cookie thiết bị tự khai là thiết bị tin cậy. Nếu dùng thiết bị quản lý, yêu cầu bằng chứng xác thực thiết bị thực tế (ví dụ mTLS/MDM), thiết kế và kiểm tra riêng; không tự phát minh fingerprint.

## 4. Pháp lý, đồng ý và vòng đời

- [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=) có hiệu lực từ 01/01/2026; [Điều về dữ liệu sinh trắc](https://xaydungchinhsach.chinhphu.vn/quy-dinh-bao-ve-du-lieu-ca-nhan-doi-voi-du-lieu-vi-tri-ca-nhan-du-lieu-sinh-trac-hoc-119250730155653784.htm) nêu các biện pháp bảo vệ. Xem thêm [Nghị định 356/2025/NĐ-CP](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/356-nd.signed.pdf). Xác minh văn bản sửa đổi, nghĩa vụ cụ thể, thời hạn và cơ quan tiếp nhận tại thời điểm triển khai; không suy đoán thời hạn lưu hoặc nộp hồ sơ từ kế hoạch này.
- Pháp chế/đơn vị vận hành xác định vai trò kiểm soát/xử lý, cơ sở pháp lý cho mục đích mới, thông báo và sự đồng ý, nghĩa vụ hồ sơ đánh giá tác động xử lý dữ liệu, chuyển dữ liệu ra nước ngoài nếu có, thông báo sự cố, các ngoại lệ và thời hạn áp dụng. DPIA nội bộ không tự thay thế hồ sơ pháp định. Quan hệ lao động có thể ảnh hưởng tính tự nguyện; không ép buộc, không gây bất lợi khi từ chối, cung cấp mật khẩu thay thế.
- Trước khi opt-in, hiển thị phiên bản nội dung: mục đích nhận diện đăng nhập 1:N; loại dữ liệu và nguồn mẫu chấm công tái sử dụng; bên xử lý/địa điểm lưu; rủi ro nhận nhầm/giả mạo; thời hạn cụ thể theo chính sách đã duyệt; quyền rút, cách liên hệ, xử lý ảnh và template sau rút; phương án mật khẩu. Không gộp đồng ý chấm công với đăng nhập.
- Lưu bằng chứng tối thiểu: `employee_id`, mục đích `FACE_LOGIN`, phiên bản nội dung, thời gian cấp/rút, trạng thái và phiên bản đồng ý; không lưu ảnh chứng minh. Thay đổi đáng kể mục đích/nội dung cần xem xét lấy lại đồng ý; trạng thái mặc định từ chối.
- Thu hồi làm mẫu không còn trong tập tìm ngay cả khi mẫu vẫn được phép dùng cho chấm công. Không xóa template dùng chung khi chưa xác minh nghĩa vụ của mục đích khác. Vô hiệu các phiên mặt của người đó qua kiểm tra phiên bản đồng ý ở mỗi request và socket, kể cả challenge đang xử lý; giữ phiên mật khẩu nếu chính sách cho phép.
- Ảnh và vector truy vấn xử lý trong bộ nhớ, xóa tham chiếu sau giao dịch, không lưu ảnh thô/log/trace; tránh tuyên bố có thể xóa chắc mọi bản sao RAM. TTL challenge/audit và lưu chứng cứ đồng ý phải theo lịch đã được duyệt; cấm ghi vào backup/telemetry không được kiểm soát. Mã hóa dữ liệu lưu và đường truyền theo hạ tầng, quản lý khóa ngoài mã nguồn, kiểm soát quyền/backup và xử lý sự cố.

## 5. Công việc 0 — Spike go/no-go trước API/UI

**Tệp dự kiến:** `face_auth/scripts/spike_webcam_login.py`, `face_auth/tests/test_face_login_spike.py`, `docs/experiments/face-login-spike-report.md` (báo cáo chỉ chứa thống kê, không dữ liệu sinh trắc). Script thử nghiệm riêng, không endpoint và không cấp cookie. Việc thu mẫu thật chỉ sau thông báo/đồng ý thử nghiệm và kiểm tra pháp lý tương ứng.

- [ ] Chốt trước người chịu trách nhiệm, mục tiêu tỷ lệ sai 1:N/PAD, số người, số phiên và khoảng tin cậy đủ hẹp; nếu chưa có mục tiêu hoặc cỡ mẫu đủ, kết luận **chưa đủ bằng chứng**, không gọi là go.
- [ ] Ghi nguồn và điều kiện mẫu CENTROID (ảnh đăng ký, camera, model version, kích thước mặt, ánh sáng, số mẫu, chất lượng); không giả định mẫu đến từ Pi. Bố trí đánh giá webcam với người tham gia, nhiều máy, ánh sáng và khoảng cách; tách tập chọn tham số và tập đánh giá theo người/phiên, không dùng cùng ảnh ở hai tập.
- [ ] Thực hiện mô phỏng đúng pipeline dự kiến: thu camera → resize canvas tương đương → JPEG encode/decode đúng quality và giới hạn → detector → crop/runtime PAD gốc → alignment → ArcFace → tổng hợp → 1:N chính xác. So sánh nguồn mẫu và điều kiện webcam; đánh giá thêm tỷ lệ khung hỏng và ảnh hưởng nén. Không thay hình học PAD chỉ dựa vào tỉ lệ màn hình.
- [ ] Thử dải số khung, thời điểm chụp, chất lượng JPEG, các ngưỡng PAD/nhất quán/match/margin chỉ trên tập hiệu chỉnh; test ảnh in, màn hình, replay và camera ảo có quyền. Thử cả việc phát hiện hành động challenge trên các khung theo thứ tự; nếu không xác minh được thì không đánh dấu challenge đạt.
- [ ] Đo FPIR/FNIR 1:N ở quy mô thư viện dự kiến, PAD theo loại tấn công, end-to-end, phân nhóm đủ cỡ mẫu, độ trễ p50/p95, RAM và CPU. Nêu mẫu số, khoảng tin cậy, phân phối điểm và giới hạn; kiểm tra tác động khi mở rộng thư viện. Với tập test độc lập, khóa mọi ngưỡng trước đo.
- [ ] Kết luận **go** chỉ khi mục tiêu định trước đạt, model/runtime tương thích, luồng challenge kiểm chứng được, tài nguyên đáp ứng và rủi ro đã được chủ hệ thống chấp nhận. **No-go** nếu không đạt hoặc không thể thực hiện đáng tin; **chưa đủ bằng chứng** nếu mẫu/giả định thiếu. Ghi hướng 1:1/passkey, không tự hạ chuẩn để lấy go.

## 6. Hợp đồng challenge, khung và API

**Các tham số thử nghiệm ban đầu, không phải ngưỡng đã xác thực:** 3–5 khung, JPEG tối đa 200 KiB/khung, tổng JSON tối đa 1,5 MiB; tối đa 1920×1080 và 2.073.600 pixel, tối thiểu và kích thước mặt theo spike; video warm-up thử 500–800 ms, khoảng khung thử 200–250 ms. Spike có thể quyết định cần nhiều khung hoặc luồng khác để xác minh chuyển động; thay hợp đồng trước triển khai, không giả vờ ba ảnh chứng minh được chuyển động.

- `GET /api/auth/face-login/config`: trạng thái enabled thực tế từ backend, `Cache-Control: no-store`, không lộ chính sách nội bộ. UI đọc lại khi vào trang/hiển thị tab. Tắt backend là chặn ngay API; nếu env chỉ đọc lúc khởi động, rollback cần restart tất cả instance, UI chỉ cập nhật sau khi fetch lại, không bảo đảm tức thời trên tab cũ.
- `POST /api/auth/face-login/challenges`: kiểm tra enabled, Origin và giới hạn lưu lượng; server sinh nonce ngẫu nhiên bằng CSPRNG tối thiểu 128 bit, ID riêng, một thử thách trong tập đã kiểm thử (ví dụ quay trái/phải), thời hạn thử 60 giây. Trả `{challengeId, challenge, expiresAt}`. Lưu hash nonce hoặc ID không đoán được và trạng thái pending trong kho dùng chung có TTL; tránh ràng buộc cứng IP khi dùng NAT/di động. Challenge không phải bằng chứng thiết bị.
- `POST /api/auth/face-login`: `{challengeId, frames}`; client không truyền tên, vector, score, role hoặc `rememberMe`. Xác minh Origin/body và consume challenge nguyên tử trước inference (một request thắng; lỗi phải yêu cầu challenge mới), từ chối hết hạn/đã dùng. State dùng chung cho nhiều instance; test race, restart và TTL. Có thể dùng cookie phiên thử ngẫu nhiên HttpOnly SameSite để ràng buộc challenge với browser, vẫn không phải chứng thực camera.
- `POST /internal/face-login/extract`: backend gửi `{requestId, challenge, frames}` qua TLS/mạng nội bộ và `X-Face-Auth-Key`; trả `{requestId,status,modelVersion,embedding}` chỉ khi `ok`. Kiểm tra server trình tự hình học/landmark cho hành động đã chọn, cùng một người, chất lượng và PAD; fail closed nếu thiếu khung/thời gian hoặc không xác minh được. Timestamp do client cung cấp chỉ là metadata không đáng tin; không chấp nhận boolean challenge từ browser.
- Công khai: lỗi PAD, sai match, người chưa opt-in, bị khóa, quyền cao hoặc challenge sai đều cùng HTTP 401, response và kích thước thông báo chung. 400 cho body sai cú pháp, 413 kích thước, 429 quota và 503 sự cố hệ thống chỉ nếu không phụ thuộc kết quả danh tính/PAD; không phản hồi tên, ứng viên, điểm hoặc lý do. Lỗi quyền camera nằm trên máy client. Nếu cung cấp lỗi kỹ thuật chất lượng ảnh, xác nhận qua threat model/timing rằng không tạo oracle; mặc định gộp.
- Server xác thực response AI, request ID, version, 512 số hữu hạn và norm; không log ảnh/vector. 200 thành công `{user}` với cookie HttpOnly/Secure/SameSite như chính sách hiện hành, tuổi thọ ngắn và `Cache-Control: no-store`.

## 7. Quy tắc sinh trắc và truy vấn chính xác

- Mỗi khung phải giải mã hợp lệ, đúng một mặt đạt tiêu chí hình học; tất cả khung cùng một track; PAD bắt buộc đủ số vote hợp lệ và ngưỡng/vote đã khóa sau spike. Xác minh thứ tự challenge từ khung thật phía server; mọi sai lệch, đổi người, NaN, model lỗi hoặc thiếu vote đều thất bại.
- Với N vector hợp lệ `v_i`, kiểm tra 512 chiều, finite và norm > epsilon; `u_i = v_i / ||v_i||₂`. Tất cả cặp `u_i·u_j >= T_consistency`. Tính `m = (Σu_i)/N`, nếu norm m không hợp lệ thì từ chối; `q = m/||m||₂`. `T_consistency` được hiệu chỉnh bằng bộ độc lập; 0,75 chỉ là ví dụ.
- Tập so khớp chỉ gồm employee ACTIVE, user ACTIVE role EMPLOYEE, đồng ý FACE_LOGIN chưa rút đúng phiên bản, CENTROID active đúng model/version. Lọc trong chính truy vấn trước xếp hạng, sau đó kiểm tra lại dưới cùng chính sách trước cấp phiên. Không lọc sau top-K vì có thể bỏ lọt ứng viên hợp lệ; không thay `findBestFaceMatch` đang dùng cho chấm công.
- Với mỗi nhân viên, lấy cosine similarity cao nhất nếu tồn tại nhiều centroid hợp lệ, rồi xếp hạng hai **nhân viên phân biệt**. Chấp nhận nếu `s1 >= T_match` và `s1-s2 >= T_margin`; nếu ít hơn hai nhân viên hợp lệ, mặc định fail closed (không có margin), chỉ thay nếu thiết kế được hiệu chỉnh riêng và chấp thuận. Không suy ra một ngưỡng hay margin cụ thể từ dữ liệu chấm công.
- Ở quy mô pilot dùng **exact search**, xác nhận `EXPLAIN (ANALYZE, BUFFERS)` và đối chiếu brute-force; index HNSW/IVFFlat có thể làm top-2 gần đúng hoặc lọc sau index gây thiếu ứng viên. Nếu sau này cần ANN, đo recall top-2 và hiệu năng theo tập lọc, có cơ chế exact fallback và chấp thuận lại; test người thắng, hạng hai và margin với dữ liệu kiểm soát.
- Đăng ký: kiểm tra số mẫu và chất lượng, một mặt, đa dạng góc/ánh sáng, nguồn/model version, centroid hợp lệ; không tự ghi đè mẫu chấm công khi người dùng bật opt-in. Spike xác định có cần quy trình bổ sung mẫu webcam tách biệt và bảo vệ đăng ký trước khi triển khai; tránh mẫu xấu hoặc kẻ khác đăng ký thay.

## 8. Công việc triển khai sau spike

### 8.1 Đồng ý và dữ liệu

**Tệp:** `backend/prisma/schema.prisma`, migration, `backend/src/modules/biometrics/`, `frontend/src/features/account/`, test tương ứng.

- [ ] Tạo cấu trúc đồng ý theo mục đích với mặc định không đồng ý, unique employee + purpose, version/revocation và audit; migration không bật cho nhân viên hiện hữu.
- [ ] Làm endpoint authenticated cho người dùng xem/bật/rút sau khi tái xác thực mật khẩu; cập nhật nguyên tử và tăng version. Hiển thị nội dung đã pháp chế phê duyệt; admin không thể bật thay người dùng.
- [ ] Test chưa opt-in, opt-in, rút khi AI đang xử lý, rút sau cấp cookie, đổi phiên bản thông báo, đồng thời và trạng thái tài khoản; kiểm tra chấm công vẫn dùng mẫu theo chính sách riêng.

### 8.2 Face Auth và giới hạn tài nguyên

**Tệp:** `face_auth/api_service.py`, `face_auth/face_login.py`, `face_auth/tests/test_face_login.py`, cấu hình container.

- [ ] Test trước: sai khóa/body, ảnh hỏng, 0/nhiều mặt, kích thước và pixel quá giới hạn, JPEG header giả/truncated, spoof, thiếu challenge, đổi track, NaN, AI lỗi/bận đều không trả vector. Fuzz parser JPEG giới hạn và test ảnh nén nhỏ có kích thước lớn.
- [ ] Kiểm tra chữ ký JPEG, kích thước header và tổng pixel **trước** `cv2.imdecode`; từ chối metadata sai/mâu thuẫn, kiểm tra lại shape sau decode. Cấu hình giới hạn OpenCV trước import chỉ là lớp bổ sung; giới hạn số lượng, body, RAM/container và buffer đồng thời.
- [ ] Tải detector/embedder/PAD một lần theo runtime hiện có; giữ crop/color/threshold đúng model và xác thực hash/version. Dùng bounded semaphore không chờ vô hạn, trả 429 khi bận; worker/threadpool và số process phải được tính theo tài nguyên và thread ONNX, tránh oversubscription. Đo health trong lúc tải. Timeout không coi là hủy native inference; không giải phóng slot cho đến khi việc thực sự kết thúc.
- [ ] Thực hiện thuật toán mục 7, xác minh challenge thực tế; không cho endpoint nội bộ truy cập công khai. Test giả lập và smoke model thực trên fixture được phép. Chạy `python -m pytest tests/test_face_login.py tests/test_pad_predictor.py tests/test_runtime.py -q` tại `face_auth`.

### 8.3 Backend, phiên và bảo vệ thao tác nhạy cảm

**Tệp:** `backend/src/modules/auth/`, `backend/src/modules/biometrics/`, `backend/src/middlewares/`, `backend/src/sockets/socket.auth.ts`, cấu hình, test trong `backend/validation/`.

- [ ] Tạo routes config/challenge/face-login, shared store có atomic consume (ví dụ Redis nếu đã vận hành; nếu không bổ sung và tài liệu hóa dependency), TTL, quota theo IP/nguồn và giới hạn toàn hệ thống. Parser giới hạn tại proxy và trước `express.json({limit:'20mb'})` trong `backend/src/app.ts`; parser riêng sau parser toàn cục không ngăn cấp phát sớm.
- [ ] Truy vấn exact riêng cho đăng nhập theo mục 7, không sửa ngữ nghĩa `findBestFaceMatch` của attendance. Recheck đồng ý, role, user, employee ngay trước phát hành; đảm bảo các bản cập nhật cạnh tranh không cấp phiên còn hiệu lực sau thu hồi/đổi quyền bằng version kiểm tra mỗi request.
- [ ] Chia sẻ logic cấp phiên nhưng JWT mặt phải có `amr:["face"]`, thời điểm xác thực, consent version và expiration ngắn có cấu hình, ví dụ thử nghiệm tối đa 30 phút; cookie session không `rememberMe`, `Max-Age` không vượt JWT. Không tin `amr` từ frontend. Token mật khẩu mới có `amr:["pwd"]`; token cũ thiếu claim coi là chưa đủ bảo đảm cho thao tác nhạy cảm, cần đăng nhập/xác thực lại, có kế hoạch tương thích.
- [ ] Chặn cứng ADMIN/MANAGER khi tìm và ngay trước cấp token, và khi kiểm tra token nếu role thay đổi. Cập nhật middleware JWT, types và socket auth; test token giả/thiếu/sai amr, role thay đổi, rút đồng ý, hết hạn, token version và socket. Mọi service/consumer giải JWT phải được rà soát, không chỉ HTTP middleware.
- [ ] Lập danh sách route nhạy cảm bằng audit routes thực tế: đổi mật khẩu/thông tin xác thực, quản lý sinh trắc/đồng ý, đổi email hoặc thông tin nhận khôi phục, xuất dữ liệu và thao tác nhân sự/lương theo quyền. Chặn mặc định với phiên mặt đến khi xác thực lại mật khẩu thành công; kiểm tra server-side từng route, không chỉ ẩn UI. Step-up phát hành token mới `amr:["face","pwd"]`, `auth_time`/thời hạn step-up ngắn; không coi đây là MFA theo NIST. Kiểm tra chéo danh sách với owner trước khi bật.
- [ ] Gộp phản hồi theo mục 6, đo timing các nhánh; không thêm sleep ngẫu nhiên như giải pháp duy nhất. Rate limit theo nguồn, toàn cục và theo challenge. Bảo vệ CORS, Origin, CSRF/login CSRF, TLS, cookie; phân quyền mạng nội bộ.
- [ ] Cảnh báo nội bộ khi nhiều thất bại gần cùng ứng viên hoặc nguồn bất thường: chỉ tính khi kết quả nội bộ đủ tin cậy và được phép lưu, dùng định danh giả danh/HMAC, cửa sổ và ngưỡng do vận hành cấu hình, TTL ngắn, quyền truy cập hạn chế. Không khẳng định chắc nhắm vào người, không khóa tài khoản nạn nhân dựa trên dự đoán; tránh lưu điểm/vector; test false alert và DoS.
- [ ] Test tích hợp cookie, auth/me, quyền và re-auth, opt-in/revocation/race, challenge race/replay, account inactive, ADMIN/MANAGER, empty/one/two candidates, lỗi/timing, giới hạn ảnh và không tạo attendance. Chạy `npm test` và `npm run build` trong `backend`, bổ sung kiểm thử có PostgreSQL/pgvector thực.

### 8.4 Frontend

**Tệp:** `frontend/src/pages/public/LoginPage.tsx`, `frontend/src/features/auth/api/authApi.ts`, `frontend/src/context/AuthContext.tsx`, component camera và tests.

- [ ] Chỉ hiển thị nút sau khi lấy config runtime enabled; backend vẫn là nguồn quyết định. Xin camera theo click, video preview có khung oval/hướng dẫn, quyền truy cập bàn phím và thông báo phù hợp.
- [ ] Đợi metadata và warm-up theo spike; tạo challenge ngay trước lúc thu, hiển thị đúng hành động, ghi chuỗi ảnh có đủ thông tin để server kiểm tra. Resize/quality theo cấu hình đã thử; kiểm tra bytes từng ảnh thực tế và tổng, thông báo chụp lại nếu vượt, không khẳng định quality 0,85 bảo đảm dung lượng.
- [ ] Không lưu ảnh vào storage/log; giải phóng tracks khi hủy, lỗi, thành công, unmount hoặc đổi trang; abort request nếu có thể. Chặn double submit, hết hạn challenge phải tạo challenge mới. Xử lý không có camera, từ chối quyền và phương án mật khẩu.
- [ ] Dùng cùng xử lý session/role, chờ logout và dọn cache như luồng hiện có. Không gửi `rememberMe` cho mặt; dùng UI re-auth mật khẩu cho thao tác yêu cầu. Test streams được stop, race, config tắt, challenge hết hạn, retry và session. Chạy `npm test`, `npm run lint`, `npm run build` trong `frontend`.

## 9. Kiểm thử hồi quy, phát hành và rollback

- [ ] Chạy toàn bộ test backend/frontend và test `face_auth` liên quan; kiểm tra ghi danh, deactivate/xóa biometrics, nhận diện/chấm công ThingsBoard và pipeline Raspberry Pi không đổi. Có test cố định đảm bảo `findBestFaceMatch` attendance không lọc opt-in đăng nhập và không tạo log chấm công từ face login.
- [ ] Kiểm thử concurrency, decode bomb, quota, DB bị lỗi, model mismatch, quá tải, user rút đồng ý/đổi role ngay khi inference, khởi động lại nhiều instance, race challenge, token socket và step-up. Đo timing và độ trễ dưới tải; xác nhận không rò ảnh/vector trong logs, traces, proxy hoặc crash reports.
- [ ] Chạy đánh giá độc lập đã khóa ngưỡng, báo cáo FPIR/FNIR, tấn công presentation/injection, dữ liệu/mẫu số và khoảng tin cậy. Không suy ra an toàn nếu thử nghiệm quá nhỏ; kiểm tra lại khi model, dữ liệu, quy mô thư viện hoặc môi trường thay đổi.
- [ ] Chỉ bật pilot sau phê duyệt hồ sơ pháp lý, bảo mật, policy mặt đơn lẻ, danh sách route nhạy cảm, tiêu chí đo, nguồn lực và rollback; opt-in từng người. Pilot mạng hạn chế nếu được vận hành và vẫn coi endpoint không đáng tin.
- [ ] Rollback: tắt cờ server trên mọi instance, kiểm tra challenge và login đều từ chối, frontend ẩn sau lần tải config; nếu cần thu hồi phiên mặt đã cấp, dùng session/version riêng hoặc tăng token version theo chính sách (có thể thu hồi cả phiên mật khẩu nếu dùng token version hiện tại). Không tuyên bố tắt cờ tự thu hồi cookie đã phát hành. Ghi người trực và kiểm tra khôi phục mật khẩu.

## 10. Điểm dừng và bàn giao

Thứ tự: pháp lý/thiết kế spike → **Công việc 0 go/no-go** → opt-in + AI + backend + frontend → hồi quy và đánh giá độc lập → phê duyệt pilot. Nếu spike không đạt, thiếu dữ liệu, không xác minh được challenge hoặc owner không chấp nhận rủi ro mặt đơn lẻ, dừng trước sản phẩm hoặc giữ cờ tắt và xem xét 1:1/passkey. Không lấy nhận xét pháp lý trong tài liệu này thay cho xác nhận của đơn vị có trách nhiệm.
