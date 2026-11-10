# Kế hoạch tối ưu đăng nhập khuôn mặt trên web — bản điều chỉnh

> **Cho người thực hiện:** Dùng `superpowers:executing-plans` khi bắt đầu triển khai. Mỗi mục `[ ]` là việc chưa hoàn thành. Thực hiện từng thay đổi và đo riêng trước khi quyết định giữ lại.

**Mục tiêu:** Giảm thời gian đăng nhập thành công và dữ liệu truyền, đồng thời theo dõi ảnh hưởng đến độ chính xác nhận diện và chống giả mạo.

**Kiến trúc:** Đo luồng batch hiện có; sau đó thử tối ưu vận hành và kiểm tra tương đương; cuối cùng đánh giá riêng từng thay đổi với ảnh đầu vào, lịch chụp và số frame. Giữ căn chỉnh 5 landmark và chính sách cấp phiên hiện tại.

**Công nghệ:** React/Vite, TypeScript/Express, FastAPI/Python, OpenCV, InsightFace/ONNX Runtime, PostgreSQL/pgvector.

**Cơ sở:** Yêu cầu và lựa chọn của người dùng trong cuộc hội thoại ngày 05/11/2026. Bản này thay thế thứ tự trong `2026-11-05-face-login-performance-evaluation.md`; tài liệu cũ được giữ để tham khảo lịch sử.

## 1. Phạm vi và nguyên tắc

- Chỉ áp dụng cho **đăng nhập khuôn mặt bằng webcam trên web**. Điểm danh qua camera/Pi là luồng khác và không được xem là đã tối ưu bởi kế hoạch này.
- Nhóm 1 giữ nguyên số lượng, nội dung, thứ tự frame và các quy tắc sinh trắc học khi kiểm tra parity. Thay đổi thời điểm thu ảnh thực tế có thể đổi nội dung ảnh và được đánh giá như Nhóm 2.
- Nhóm 2 thử từng thay đổi: độ phân giải/JPEG, lịch chụp, số frame. Không gộp các thay đổi trước khi đo tác động riêng.
- Giữ model, căn chỉnh 5 landmark, chính sách PAD, ngưỡng, quy tắc reset, so khớp từng embedding và cấp phiên; giảm số frame là thay đổi thời gian quan sát và phải đánh giá riêng.
- **Ngoài phạm vi:** stateful pipelining, early exit, bỏ alignment, đổi model, lượng tử hóa, thay precision, huấn luyện lại hoặc đổi ngưỡng. Không mở rộng sang thiết bị Pi.
- Không giả định một tối ưu làm FAR/PAD không đổi hoặc sẽ đem lại mức cải thiện cụ thể. Parity trên tập hữu hạn không chứng minh tương đương cho mọi dữ liệu.
- Chỉ thu ảnh người tham gia có đồng ý, xác định nơi lưu, người được truy cập và thời hạn xóa. Không đưa ảnh, embedding, token, cookie hoặc secret vào log thông thường hay Git.
- Không dùng tập test chính thức để chọn cấu hình. Ghi lại model/config có hiệu lực; không tự động thay threshold để đạt kết quả mong muốn.
- Workspace hiện có các thay đổi chưa commit, bao gồm luồng face login. Kiểm tra lại diff và bảo toàn công việc hiện có; không tự ý reset, xóa hoặc commit thay người dùng.

## 2. Những gì đã xác nhận và chưa làm

**Đã xác nhận từ mã nguồn:**

- Frontend chụp 8 frame, đợi 350 ms trước mỗi frame, rồi gửi một batch; camera chờ thêm 800 ms sau khi phát video trước khi sẵn sàng.
- Camera đã được mở sau khi người dùng chọn đăng nhập khuôn mặt. Khung oval là hướng dẫn trực quan.
- Detector cung cấp 5 landmark; ảnh đăng nhập và đăng ký dùng `get_input_face` để căn chỉnh trước khi tạo embedding.
- Backend, Python HTTP và pipeline hiện đều kiểm tra đúng 8 frame. PAD dùng rolling window; raw spoof có thể xóa chuỗi embedding; backend so khớp từng embedding trước khi cấp phiên.
- Service Python dùng `BoundedSemaphore(1)` không chờ cho request login; backend hiện ánh xạ phản hồi service không thành công thành lỗi dịch vụ.

**Chưa hoàn thành:** Chưa đo baseline thực tế, chưa triển khai telemetry hay tối ưu, chưa đo FAR/PAD trên các cấu hình đề xuất và chưa đánh giá lợi ích trên webcam thật.

## 3. Tệp dự kiến

| Thành phần | Tệp cần xem/sửa khi đến bước tương ứng |
|---|---|
| Camera, thời gian chụp | `frontend/src/features/auth/components/FaceLoginModal.tsx`, `frontend/src/features/auth/lib/faceCamera.ts` |
| API frontend | `frontend/src/features/auth/api/faceLoginApi.ts`, `frontend/src/api/client.ts`, `frontend/src/context/AuthContext.tsx` |
| API và so khớp | `backend/src/modules/auth/face-login/face-login.routes.ts`, `face-login.service.ts`, `face-login.policy.ts` |
| Model/PAD | `face_auth/api_service.py`, `face_auth/face_login/http.py`, `face_auth/face_login/pipeline.py`, `face_auth/recognition/embedder.py`, `face_auth/antispoof/loader.py` |
| Kiểm thử | `frontend/validation/auth/face-login*.test.*`, `backend/validation/auth/face-login*.test.ts`, `face_auth/tests/test_face_login_http.py`, `test_face_login_parity.py` |
| Kết quả | Báo cáo tổng hợp mới trong `docs/experiments/`; dữ liệu nhạy cảm nằm ngoài Git. |

Không dùng `face_auth/scripts/spike_webcam_login.py` như benchmark chính thức của luồng web: spike này có chính sách khác.

## 4. Chuẩn bị phép đo

- [ ] Ghi commit, trạng thái diff liên quan, môi trường phần cứng, OS, trình duyệt, camera, mạng, số worker và tài nguyên server; không ghi secret.
- [ ] Ghi cấu hình thực tế: hash/version model, `PAD_MIN_VOTES`, `PAD_SMOOTH_WINDOW`, `PAD_SPOOF_MIN_RATIO`, `ATTENDANCE_STABLE_COUNT`, `FACE_MATCH_THRESHOLD`, kích thước/chất lượng ảnh, thread và provider ONNX. Giá trị trong `.env.example` không đủ chứng minh giá trị đang chạy.
- [ ] Trước khi chạy, xác định số người/phiên độc lập, điều kiện ánh sáng/khoảng cách, các loại tấn công được phép và tiêu chí chấp nhận tốc độ, từ chối nhầm, nhận nhầm và PAD. Nếu chưa xác định được giới hạn/cỡ mẫu phù hợp, ghi kết quả là khảo sát và không kết luận an toàn tương đương.
- [ ] Tách dữ liệu phát triển/đánh giá độc lập theo người và phiên phù hợp; cố định giao thức, ngẫu nhiên hóa hoặc cân bằng thứ tự thử nghiệm. Ghi số lần bỏ cuộc và chuyển mật khẩu.
- [ ] Ghi chính xác lệnh khởi động đang dùng, phiên bản, thời điểm và môi trường; giữ baseline để có thể chạy lại.

## 5. Giai đoạn 0 — Đo baseline tối thiểu

**Mục tiêu:** Xác định phần chiếm thời gian trước khi chọn tối ưu. Đo riêng cold start và warm start, đơn người và tải đồng thời.

- [ ] Thêm telemetry có thể bật/tắt cho môi trường đo; dùng đồng hồ đơn điệu từng tiến trình và ID tương quan ngẫu nhiên. Không so trực tiếp timestamp từ các máy khác đồng hồ.
- [ ] Đo frontend: bắt đầu mở camera → video sẵn sàng; thời gian mỗi lần chụp/encode và mốc thực giữa các frame; thời gian request đầu-cuối; kích thước body. Kích thước JSON không phải toàn bộ byte đường truyền; request đầu-cuối không phải thời gian upload thuần túy.
- [ ] Đo backend: thời gian RPC Python, tổng thời gian so khớp pgvector và cấp phiên. Đo Python: tổng request/processing, decode, detector, PAD, alignment, embedding và số lượt mỗi bước. Ghi số lỗi bận, timeout và các nhóm kết quả tổng quát.
- [ ] Kiểm tra telemetry bật/tắt không thay đổi kết quả cho cùng đầu vào; log không chứa ảnh, embedding, token hay cookie. Kiểm tra camera bị từ chối, request lỗi và dừng sớm vẫn có mốc hợp lệ.
- [ ] Báo cáo p50/p95, cỡ mẫu, tỷ lệ thành công lần đầu, số phiên thất bại/bỏ cuộc, TTSL kể cả retry, payload và tải. Ghi rõ số đo thuần từng tầng và các khoảng chồng lấn; không cộng các span lồng nhau như thể độc lập.
- [ ] Ghi kết quả ẩn danh vào báo cáo mới trong `docs/experiments/`. Nếu thiếu camera/model hoặc không đủ số liệu, ghi rõ giới hạn; không suy đoán con số.

## 6. Nhóm 1 — Tối ưu vận hành và parity

Thực hiện **mỗi nhiệm vụ độc lập**, chỉ tiếp tục khi số đo chỉ ra lợi ích tiềm năng. Khi so sánh, dùng cùng frame JPEG đã thu hợp lệ và cùng model/cấu hình. Kiểm tra ảnh giải mã, thứ tự, kết quả PAD, embedding với sai số số học được ghi rõ, danh tính và quyết định cuối; ưu tiên mẫu gần ngưỡng. Sai khác quyết định chưa giải thích được là lý do không nhận thay đổi.

### 1A. Warm-up model

- [ ] Đo chi phí khởi tạo model lần đầu, đặc biệt predictor PAD khởi tạo khi cần trong `face_auth/api_service.py`; so sánh request đầu với request sau.
- [ ] Nếu có lợi, thử khởi tạo hoặc warm-up khi service sẵn sàng bằng dữ liệu tổng hợp/hợp lệ được phép; không tạo tài khoản hay phiên thật, không dùng ảnh người thật tùy tiện, không ẩn lỗi khởi tạo.
- [ ] Test service tắt tính năng, model thiếu/lỗi và request thật đầu tiên; so sánh cold/warm, CPU/memory và kết quả parity. Giữ lazy loading nếu warm-up không có lợi hoặc tạo hồi quy.

### 1B. Camera và song song hóa việc độc lập

- [ ] Kiểm tra thời gian từ khi người dùng chủ động chọn face login đến camera sẵn sàng. Không tự mở camera khi chỉ vào trang đăng nhập.
- [ ] Chỉ thử chồng các thao tác độc lập sau hành động của người dùng nếu việc đó không thay đổi ảnh đầu vào hoặc chính sách. Mọi thay đổi 800 ms camera warm-up hoặc thời điểm chụp thuộc Nhóm 2.
- [ ] Test quyền camera bị từ chối, config lỗi, đóng modal khi camera đang mở, unmount và luồng thành công; mọi track phải dừng đúng lúc, không gọi đăng nhập sau hủy.
- [ ] Không chạy song song hoặc đổi thứ tự các frame qua rolling PAD. Đo lợi ích và các lỗi race dưới tải; bỏ thay đổi nếu không có cải thiện thực tế.

### 1C. Multipart JPEG

- [ ] Chỉ tiến hành nếu phép đo cho thấy kích thước body/upload đáng kể. Ghi rõ tối ưu chặng browser → Node; nếu Node → Python vẫn dùng Base64 thì tiếp tục tính overhead chặng đó.
- [ ] Trước hết gửi **cùng byte JPEG** qua hai đường Base64/multipart và so sánh byte sau nhận, ảnh decode và quyết định. Kiểm tra độc lập sự khác biệt encoder nếu chuyển `toDataURL` sang `toBlob`.
- [ ] Giữ ràng buộc challenge/cookie, số ảnh, kích thước từng ảnh/body, JPEG hợp lệ, kích thước giải mã, giới hạn bộ nhớ và kiểm soát lỗi ở cả hai tầng; test file rỗng, MIME giả, ảnh hỏng/quá lớn và hủy.
- [ ] So sánh body bytes, thời gian encode/decode, latency và tài nguyên; không coi overhead multipart hay cả hai chặng là bằng không.

### 1D. ONNX Runtime

- [ ] Chỉ thử nếu phép đo inference đáng kể. Ghi provider và cấu hình thread hiện tại cho detector, PAD và ArcFace; không mặc định ba model dùng cùng cấu hình.
- [ ] Thử từng cấu hình thread/session options trên cùng phần cứng và model; không thay model, precision, preprocessing hay ngưỡng. Đo cold/warm, p50/p95, CPU/memory, throughput và lỗi khi nhiều request.
- [ ] So sánh điểm PAD và embedding gần ngưỡng cùng quyết định cuối; ghi sai số và số trường hợp đổi quyết định. Chỉ giữ cấu hình không có hồi quy quyết định trong tập đánh giá và đáp ứng tiêu chí đã đặt; không suy ra FAR không đổi từ test nhỏ.

## 7. Nhóm 2 — Thay đổi ảnh và lịch quan sát

Mỗi thay đổi so với cấu hình đối chứng đã chốt sau Nhóm 1. Ghi p50/p95, tỷ lệ thành công lần đầu, TTSL và bỏ cuộc; đo người thật bị từ chối, nhận nhầm danh tính và khả năng chấp nhận tấn công trình diện theo từng loại/điều kiện. Báo cáo cỡ mẫu và khoảng tin cậy; nếu dữ liệu không đủ, không khẳng định an toàn tương đương và chưa nhận thay đổi.

### 2A. Độ phân giải và JPEG

- [ ] Giữ nguyên số frame, lịch chụp và PAD. Thử riêng cạnh dài 720 → 640 px, sau đó JPEG 0,85 → 0,80; giữ tỷ lệ khung hình. Đây là giá trị thử nghiệm, không phải cấu hình đã được kiểm chứng.
- [ ] So sánh ảnh người thật và tấn công ở các điều kiện đã định; nén/giảm kích thước có thể làm mất texture quan trọng cho PAD. Đo payload và thời gian encode/inference, không mặc định đây là thay đổi rủi ro thấp nhất.
- [ ] Giữ hoặc loại từng thay đổi theo tiêu chí định trước, không điều chỉnh ngưỡng trên tập test để bù kết quả.

### 2B. Warm-up camera và lịch chụp

- [ ] Giữ 8 frame và thông số ảnh đã chọn. So sánh baseline chờ trước frame đầu và các frame, 350 ms; chụp ngay frame đầu với 350 ms giữa frame; sau đó thử 250 ms giữa frame. Đánh giá 800 ms warm-up camera riêng nếu phép đo cho thấy đáng kể.
- [ ] Kiểm tra các mốc thực bao gồm thời gian vẽ/mã hóa, không chỉ thời gian sleep. Test fake timers, đủ frame, hủy, camera ngắt và challenge hết hạn.
- [ ] Đo thất bại ở frame đầu, khả năng người dùng kịp ổn định và spoof qua toàn bộ phiên. Không gọi việc bỏ chờ đầu là miễn phí về độ chính xác.

### 2C. Số frame

- [ ] Chỉ thử sau 2A/2B; so sánh 8, 6 và 5 frame với cùng thông số còn lại. Với cấu hình K phiếu tối thiểu và M embedding, K + M − 1 là số frame thuận lợi tối thiểu, không phải số frame có khả năng chịu lỗi.
- [ ] Thay validation đồng bộ tại Node, Python HTTP và pipeline trong nhánh thử; test số frame sai, frame không mặt, chất lượng kém, đổi track, raw spoof sau embedding, spoof xuất hiện muộn, sai model và challenge hết hạn.
- [ ] So sánh dữ liệu tấn công và người thật ở cấp phiên với 8 frame. Không chấp nhận thay đổi chỉ vì tốc độ tốt hơn: số frame ít hơn làm giảm thời gian quan sát và có thể đổi quyết định.

## 8. Kiểm tra và báo cáo hoàn tất

- [ ] Chạy test liên quan sau từng thay đổi: `npm --prefix frontend test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx`; `npm --prefix backend test -- validation/auth/face-login.test.ts validation/auth/face-login-routes.test.ts validation/auth/face-login-session.test.ts`; từ `face_auth`: `../.venv/Scripts/python.exe -m unittest tests.test_face_login_http tests.test_face_login_parity` (điều chỉnh đường dẫn Python theo môi trường).
- [ ] Sau thay đổi frontend chạy `npm --prefix frontend run lint` và `npm --prefix frontend run build`; sau thay đổi backend chạy `npm --prefix backend run build`. Ghi chính xác các lệnh và kết quả, kể cả kiểm tra chưa chạy.
- [ ] Với mỗi phương án ghi: đã thử hay bỏ qua, cấu hình và hash, dữ liệu/cỡ mẫu, p50/p95, thời gian tới thành công, bytes, sai khác parity, chỉ số sai lệch nhận diện/PAD, giới hạn và kết luận giữ/loại.
- [ ] Kiểm tra diff và bảo toàn các thay đổi có sẵn. Không chuyển production hoặc thay dữ liệu đăng ký từ kết quả khảo sát; báo rõ các quyết định và phép thử còn thiếu.
