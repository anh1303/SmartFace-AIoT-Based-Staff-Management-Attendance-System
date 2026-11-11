# Kế hoạch tối ưu đăng nhập khuôn mặt web — bản thực dụng

> **Khi thực hiện:** Áp dụng `superpowers:executing-plans`; các ô chưa đánh dấu là công việc chưa làm. Đánh giá thử nghiệm là khảo sát cho tới khi có đủ dữ liệu và được phê duyệt cho phạm vi sử dụng tương ứng.

**Mục tiêu:** Giảm thời gian người dùng đăng nhập thành công, ưu tiên thời gian chờ camera và thu ảnh; theo dõi riêng lỗi nhận diện và chống giả mạo.

**Phạm vi:** Webcam web, React/Vite, Express, FastAPI, ONNX Runtime, pgvector. Giữ nguyên model, 5 landmark, ngưỡng, PAD, đăng ký mẫu và ranh giới backend/Python trong những bước đầu. Tối ưu điểm danh Pi là công việc riêng.

**Nguồn yêu cầu:** Các trao đổi và góp ý của người dùng ngày 05/11/2026. Bản này điều chỉnh thứ tự của `2026-11-05-face-login-optimization-revised.md`; giữ bản cũ để tham khảo.

## Những gì đã xác nhận và những gì chưa làm

- [x] Frontend chờ 350 ms trước mỗi lần trong 8 lần chụp, tương đương 2,8 giây chờ danh nghĩa, cộng chi phí chụp/mã hóa; chỉ sau đó gửi batch.
- [x] Camera đợi thêm 800 ms sau `video.play()` trước khi nút quét sẵn sàng. Hai khoảng này thuộc các giai đoạn khác nhau: thời gian từ mở modal đến thành công có thể gồm cả hai, còn thời gian từ lúc bấm quét không gồm 800 ms đó; không mặc định tổng thời gian người dùng luôn là 3,6 giây.
- [x] `get_input_face` căn chỉnh 5 landmark; đăng ký mẫu cũng dùng hàm này. Oval chỉ hướng dẫn người dùng.
- [x] Với K phiếu tối thiểu và M embedding, trường hợp thuận lợi nhất cần K + M − 1 frame; không có nghĩa được bỏ qua frame lỗi. Raw spoof xóa embedding; các lỗi mặt/track có thể kết thúc batch sớm.
- [x] Python login dùng semaphore không chờ; pipeline trả M embedding cuối và backend kiểm tra từng embedding trước khi cấp phiên.
- [ ] Chưa đo camera, mạng, Python, database hoặc độ chính xác của hệ thống thực tế. Chưa khẳng định warm-up, multipart hoặc thay ONNX tiết kiệm được bao nhiêu. Chưa triển khai thay đổi nào trong kế hoạch này.

## Nguyên tắc và mục tiêu khảo sát

- Bảo toàn challenge/cookie, xác thực, giới hạn request, kiểm tra ảnh và tài nguyên; không tự mở camera khi người dùng chỉ vào trang đăng nhập.
- Không log ảnh, embedding, token, cookie hoặc danh tính trực tiếp; thu thập có sự đồng ý, có thời hạn lưu/xóa. Không ghi đè hoặc tự commit các thay đổi có sẵn trong workspace.
- Ghi cấu hình và hash model có hiệu lực; không dùng tập test chính thức để chọn cấu hình hay đổi ngưỡng để cải thiện kết quả.
- **Chỉ tiêu tham khảo, không phải kết quả hay tiêu chuẩn an toàn:** tỷ lệ thành công đúng danh tính lần đầu mục tiêu ≥95%; p50 <1,5 giây, p95 <2,5 giây tính từ lúc bấm bắt đầu nhận diện đến khi phiên được tạo; đồng thời báo riêng từ lúc mở modal và thời gian tới thành công sau retry. Giữ chỉ tiêu này là mục tiêu để xem xét, không tự coi là cam kết có thể đạt.
- Đo riêng tỷ lệ nhận nhầm người không đúng danh tính và tỷ lệ tấn công trình diện được chấp nhận, theo từng loại tấn công; không gộp vào tỷ lệ thành công người thật. Ghi số thành công/tổng mẫu, baseline và thay đổi quan sát được. Mục tiêu khảo sát là **không thấy thêm trường hợp nhận sai hoặc tấn công lọt so với baseline trên cùng bộ thử**, không đồng nghĩa chứng minh FAR/PAD không tăng.
- Khi baseline đã có lỗi, so sánh số trường hợp khác nhau trên cùng tập và từng loại; báo cả ca mới phát sinh lẫn ca cải thiện. Bất kỳ ca tấn công lọt hoặc nhận sai mới đều cần điều tra và không nhận thay đổi trước khi hiểu nguyên nhân.
- Cỡ mẫu gợi ý 10–20 người đồng ý, vài điều kiện ánh sáng/khoảng cách, các ca không có trong gallery và ảnh in/màn hình điện thoại; ghi số lượt thực tế, thử cả video nếu có điều kiện. Đây là **khảo sát nhỏ, không đủ chứng minh an toàn hoặc tương đương FAR thấp**. Ghi sự phụ thuộc giữa các lượt của cùng người và số lần bỏ cuộc.
- Kết quả thử nghiệm có thể được giữ trong môi trường thử nghiệm nếu không thấy hồi quy theo tiêu chí trên, nhưng không mô tả là đã xác minh an toàn hoặc tự động bật production. Nếu không có dữ liệu người thật/tấn công, chỉ báo parity kỹ thuật và chưa đánh giá tính phù hợp triển khai.

## Tệp chính và kiểm thử

- Camera: `frontend/src/features/auth/components/FaceLoginModal.tsx`, `frontend/src/features/auth/lib/faceCamera.ts`, `frontend/validation/auth/face-login-camera.test.ts`, `face-login-modal.test.tsx`.
- Backend: `backend/src/modules/auth/face-login/face-login.routes.ts`, `face-login.service.ts`, `face-login.policy.ts`, `backend/validation/auth/face-login*.test.ts`.
- Python: `face_auth/api_service.py`, `face_auth/face_login/http.py`, `face_auth/face_login/pipeline.py`, `face_auth/tests/test_face_login_http.py`, `test_face_login_parity.py`.
- Báo cáo kết quả ẩn danh trong `docs/experiments/`; script spike `face_auth/scripts/spike_webcam_login.py` có chính sách khác, không coi là benchmark sản phẩm.

## 0. Đo baseline gọn

- [ ] Ghi môi trường chạy, camera, mạng, số worker, hash/version model và cấu hình có hiệu lực của `PAD_MIN_VOTES`, `PAD_SMOOTH_WINDOW`, `PAD_SPOOF_MIN_RATIO`, `ATTENDANCE_STABLE_COUNT`, `FACE_MATCH_THRESHOLD`; không ghi secret.
- [ ] Đo 4 nhóm tối thiểu: thời gian thu ảnh từ lần đầu đến cuối và tổng thời gian capture/encode; body bytes; RPC Node → Python; tổng thời gian tìm kiếm pgvector. Đồng thời ghi tổng thời gian từ mở modal và từ bấm quét đến kết quả, thời gian camera sẵn sàng và kết quả phiên.
- [ ] Dùng đồng hồ đơn điệu theo từng tiến trình và ID tương quan ngẫu nhiên; không cộng span lồng nhau hoặc gọi toàn bộ request là upload. Đo cold start/warm start và khi có request đồng thời. Đo chi tiết detector/PAD/alignment/ArcFace chỉ khi RPC Python nổi bật.
- [ ] Chạy baseline người thật và tấn công theo bộ khảo sát, ghi số lượt, p50/p95, thành công lần đầu, bỏ cuộc, retry, sai danh tính và tấn công lọt. Nếu số mẫu quá ít cho p95 đáng tin, ghi phân vị ước tính và toàn bộ phạm vi quan sát.
- [ ] Đảm bảo telemetry không thay kết quả và không ghi dữ liệu sinh trắc học hoặc bí mật. Nếu camera/model không có sẵn, ghi kết quả chưa đo; không tự điền ước lượng.

## 1. Warm-up model khi có căn cứ

- [ ] So sánh request đầu và sau đó; `get_face_login_models` hiện khởi tạo PAD predictor khi cần. Xác định riêng thời gian tải model và inference; không giả định request đầu chậm gấp bao nhiêu lần.
- [ ] Nếu có lợi, thử khởi tạo/warm-up một lần khi service bật face login, dùng đầu vào tổng hợp hoặc được phép, không tạo phiên hay ghi DB; giữ lỗi model thiếu rõ ràng và không làm service sẵn sàng giả.
- [ ] Kiểm thử model lỗi, tính năng tắt, cold/warm, tải và quyết định trên cùng dữ liệu. Nếu không có lợi hoặc làm xấu kết quả, giữ thiết kế hiện tại.

## 2. Bỏ chờ đầu và đánh giá camera

- [ ] Giữ 8 frame, model, kích thước/JPEG và chính sách. So sánh baseline với chụp ngay frame đầu sau challenge, giữ 350 ms giữa các frame. Đo thời gian thực, thành công lần đầu và lỗi frame đầu.
- [ ] Thử thay 800 ms cố định bằng chờ điều kiện video đã phát, có kích thước khác 0 và đã có frame thực tế, có timeout/hủy. `readyState` hoặc sự kiện có frame không chứng minh ánh sáng/phơi sáng camera đã ổn định; khảo sát thêm chất lượng và tỷ lệ lỗi trước khi nhận.
- [ ] Sau khi biết ảnh hưởng riêng, có thể đo tổ hợp bỏ chờ đầu + camera theo sự kiện. Đối chiếu các ca người thật thất bại, nhận nhầm và tấn công trên cùng bộ thử; giữ quyền chủ động mở camera và dừng mọi track khi đóng/hủy.
- [ ] Nếu các thay đổi đầu đủ tốt và mục tiêu tốc độ đạt trong điều kiện khảo sát, không bắt buộc thực hiện các tối ưu còn lại.

## 3. Khoảng cách frame

- [ ] Trên cấu hình được chọn ở bước 2, thử 350 → 250 ms giữa frame, vẫn 8 ảnh. Ghi thời gian thực giữa lần chụp, gồm encode; không mặc định giá trị danh nghĩa là thời gian chính xác.
- [ ] So sánh tỷ lệ thành công, retry, sai danh tính và PAD cấp phiên với đối chứng; kiểm tra spoof muộn, ảnh đầu không hợp lệ, camera ngắt, hủy và challenge hết hạn. Chỉ giữ nếu phù hợp với các tiêu chí khảo sát đã nêu.

## 4. Nghiên cứu gối đầu và early exit nếu còn cần

Nhánh này là **thử nghiệm có điều kiện**, cần thiết kế riêng trước khi xây. Nó được khôi phục theo đề xuất mới; không mặc định triển khai vào sản phẩm.

- [ ] Đo xem inference đủ lớn so với thời gian chụp và độ trễ mạng để gối đầu có thể có ích. Nếu không, bỏ qua nhánh này.
- [ ] Đề xuất thiết kế xử lý tăng dần giữ backend quản lý challenge/cookie, so khớp từng embedding và cấp phiên; Python chỉ quản lý trạng thái xử lý ngắn hạn. Xác định TTL, số thứ tự frame, chống request trùng/lệch thứ tự, một kết quả cuối, timeout/hủy, backpressure, giới hạn tài nguyên và multi-worker.
- [ ] Tạo đối chứng xử lý gối đầu **đủ 8 frame**. Trên cùng chuỗi đầu vào, so sánh validation, chọn mặt, IoU, PAD, raw spoof reset, M embedding cuối và quyết định với batch cũ; test ảnh hỏng ở cuối và không âm thầm bỏ frame. Đo tải, race và lỗi bận.
- [ ] Early exit là thí nghiệm khác: đủ K/M là điều kiện cần nhưng không tương đương quyết định sau 8 frame, vì frame còn lại có thể chứa spoof, lỗi hoặc thay track; K là số phiếu tối thiểu của rolling window, không phải đơn giản K phiếu đều pass. Đánh giá các ca spoof muộn, hoán đổi người và nhận sai trên tập đã định. Không tuyên bố giữ nguyên chính sách hay đảm bảo 1–1,5 giây.
- [ ] Không dùng kết quả khảo sát nhỏ làm bằng chứng an toàn; chỉ cân nhắc bật trong môi trường thử theo tiêu chí khảo sát và ghi rõ hạn chế.

## 5. Giảm số frame

- [ ] Nếu vẫn cần sau các bước trước, thử batch 8 → 6 → 5 với cùng các điều kiện khác. Kiểm tra K/M thực tế; sửa validation đồng bộ ở Node, Python HTTP và pipeline trong nhánh thử.
- [ ] Test thiếu/thừa frame, ảnh hỏng, không mặt, track thay đổi, reset khi raw spoof, spoof cuối và logic M embedding. So sánh PAD và nhận diện ở cấp phiên: ít frame hơn đồng nghĩa ít thời gian quan sát.
- [ ] Báo ca mới lọt/từ chối, TTSL và giới hạn mẫu trước khi chọn cấu hình thử.

## 6. Độ phân giải và JPEG

- [ ] Thử riêng cạnh dài 720 → 640 → 480 px và chất lượng 0,85 → 0,80; giữ tỷ lệ khung hình. Cạnh dài 480 là toàn ảnh, không đảm bảo mặt đủ pixel cho detector hoặc PAD, dù ArcFace nhận crop 112×112.
- [ ] Đo detector fail, điểm/độ chính xác nhận diện và PAD riêng ở khoảng cách, ánh sáng và loại tấn công khác nhau. Không đổi threshold trên tập đánh giá; ghi bytes và latency.
- [ ] Chọn cấu hình thử chỉ khi đáp ứng tiêu chí khảo sát. Không xem JPEG/resolution là chắc chắn ít rủi ro vì PAD có thể phụ thuộc texture.

## 7. ONNX thread và multipart nếu đo thấy cần

- [ ] Nếu Python/inference còn là nút thắt, thử riêng thread/session options, giữ model, provider, preprocessing và precision; đo CPU, memory, p50/p95, throughput và parity trên mẫu gần ngưỡng. Không đổi model hoặc lượng tử hóa trong kế hoạch này.
- [ ] Nếu upload/body đáng kể, thử multipart, bắt đầu so sánh cùng byte JPEG trước/sau hai đường truyền và kết quả giải mã. Ghi rõ Node → Python còn Base64 hay không; test MIME giả, file rỗng/hỏng/quá lớn và giới hạn bộ nhớ ở cả hai tầng.
- [ ] Nếu không thấy lợi ích đủ lớn, bỏ qua các thay đổi này; không thêm độ phức tạp chỉ vì có thể làm.

## 8. Xác minh và kết luận

- [ ] Chạy test tập trung sau mỗi thay đổi: `npm --prefix frontend test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx`; `npm --prefix backend test -- validation/auth/face-login.test.ts validation/auth/face-login-routes.test.ts validation/auth/face-login-session.test.ts`; từ `face_auth`, `../.venv/Scripts/python.exe -m unittest tests.test_face_login_http tests.test_face_login_parity` (đổi đường dẫn Python theo môi trường).
- [ ] Chạy `npm --prefix frontend run lint`, `npm --prefix frontend run build`, và `npm --prefix backend run build` khi có thay đổi liên quan. Ghi lệnh và kết quả, kể cả lỗi môi trường hoặc test chưa chạy.
- [ ] Báo phương án đã thử/bỏ qua, mẫu và kết quả, sai khác so với baseline, cỡ mẫu và hạn chế; phân biệt mục tiêu, kết quả đo được và kết luận. Không tự triển khai production, thay ngưỡng hoặc thay gallery.
