# Kế hoạch đo và tối ưu tốc độ đăng nhập khuôn mặt web

> **Cho người thực hiện:** Dùng `superpowers:executing-plans` khi bắt đầu thực hiện kế hoạch. Các mục `[ ]` là công việc chưa thực hiện. Không triển khai các nhánh có điều kiện khi chưa có bằng chứng ở bước trước.

**Mục tiêu:** Giảm thời gian đến khi đăng nhập thành công và lượng dữ liệu truyền, đồng thời đo và kiểm soát ảnh hưởng đến nhận diện và chống giả mạo.

**Kiến trúc:** Đầu tiên đo luồng batch 8 ảnh hiện tại, sau đó thay đổi riêng thời điểm chụp và khoảng cách ảnh. Chỉ xem xét batch ngắn, truyền nhị phân hoặc xử lý gối đầu khi kết quả đo biện minh; early exit và bỏ căn chỉnh là các nghiên cứu riêng, không mặc định đưa vào sản phẩm.

**Công nghệ:** React/Vite, TypeScript/Express, FastAPI/Python, OpenCV, InsightFace/ONNX, PostgreSQL/pgvector.

**Cơ sở yêu cầu:** Trao đổi với người dùng trong cuộc hội thoại ngày 2026-11-05. Đây là kế hoạch nghiên cứu và triển khai có cổng quyết định, không phải xác nhận rằng các kết quả thử nghiệm đã đạt.

## Phạm vi và bất biến

- Phạm vi chính là **đăng nhập webcam trên web**, không phải điểm danh qua thiết bị Pi. Cần kế hoạch và phép đo riêng nếu muốn tối ưu Pi.
- Giữ detector, căn chỉnh 5 landmark, mô hình, preprocessing, ngưỡng, rolling PAD, quy tắc xóa embedding khi raw spoof, so khớp từng embedding và chính sách cấp phiên như hiện tại, trừ khi một thí nghiệm được mô tả rõ là thay đổi chính sách và được đánh giá riêng.
- Các giá trị mặc định không thay thế cấu hình thực tế; ghi cấu hình có hiệu lực và hash mô hình, không ghi secret.
- Không sử dụng tập test chính thức để chọn cấu hình, ngưỡng hay tiền xử lý. Không lưu ảnh, embedding, token hoặc cookie trong telemetry thông thường.
- Không ghi đè, xóa hoặc tự ý commit các thay đổi đang có trong workspace. Trước khi sửa, xem lại `git status` và nội dung diff liên quan.
- Chỉ thu dữ liệu sinh trắc học khi có sự đồng ý và phương án lưu/xóa phù hợp; mọi kết quả camera phải được đánh dấu theo điều kiện thử.

## Đã xác nhận; chưa thực hiện

- [x] Frontend chờ 350 ms trước mỗi lần trong 8 lần chụp và gửi một batch Base64; camera có thời gian chờ chuẩn bị 800 ms.
- [x] `get_input_face` dùng 5 landmark để căn chỉnh ArcFace; lúc đăng ký cũng dùng hàm này. Khung oval là hướng dẫn UI, không phải kiểm tra vị trí được thực thi.
- [x] Batch hiện được kiểm tra đúng 8 ảnh ở Node, Python HTTP và pipeline; pipeline dùng `Track`, rolling PAD, reset embedding theo raw spoof, chọn các embedding cuối và backend so khớp từng embedding.
- [x] Với mọi frame đều hợp lệ, số frame tối thiểu để tạo M embedding là K + M − 1; số này không bảo đảm chịu được frame lỗi. Python dùng semaphore không chờ cho request login.
- [ ] Chưa đo baseline, chưa triển khai telemetry hoặc thay đổi tối ưu, chưa chạy benchmark webcam và chưa đánh giá an toàn của các cấu hình mới.

## Các tệp dự kiến

- `frontend/src/features/auth/components/FaceLoginModal.tsx`, `frontend/src/features/auth/lib/faceCamera.ts`: mốc camera/chụp và các biến thể lịch chụp.
- `frontend/src/features/auth/api/faceLoginApi.ts`, `frontend/src/context/AuthContext.tsx`: đường đi request khi cần đo; giữ hợp đồng đăng nhập công khai.
- `backend/src/modules/auth/face-login/face-login.routes.ts`, `face-login.service.ts`: đo RPC, so khớp, mã lỗi; giữ challenge/cookie/giới hạn.
- `face_auth/face_login/http.py`, `pipeline.py`: đo decode, detector, PAD, căn chỉnh và embedding, không thay logic ở giai đoạn baseline.
- `frontend/validation/auth/face-login-camera.test.ts`, `face-login-modal.test.tsx`, `backend/validation/auth/face-login*.test.ts`, `face_auth/tests/test_face_login_http.py`, `test_face_login_parity.py`: kiểm thử tương ứng.
- Tạo báo cáo tổng hợp trong `docs/experiments/` sau khi đo, không đặt dữ liệu sinh trắc học thô trong Git. `face_auth/scripts/spike_webcam_login.py` là spike dùng chính sách khác, không coi kết quả của nó là benchmark luồng sản phẩm.

## Các trường hợp cần kiểm tra

1. Camera bị từ chối, mất kết nối hoặc đóng modal: báo lỗi phù hợp, dừng track và hủy công việc.
2. Frame đầu không có mặt, mặt nhỏ hoặc thay đổi track: giữ nguyên kết quả từ chối hiện tại, không bỏ qua frame.
3. Raw spoof xuất hiện sau khi đã có embedding: xóa chuỗi như hiện tại; không cấp phiên sai.
4. Service bận, request hết hạn hoặc người dùng thử lại: phân biệt lỗi vận hành với kết luận sinh trắc học và không tạo phiên trùng.
5. Ảnh không hợp lệ, quá lớn, response sai model hoặc sai request ID: giữ các giới hạn và cơ chế từ chối hiện có.

## Bước 0 — Khóa điều kiện thử

- [ ] Ghi lại commit, diff và file chưa theo dõi liên quan; không đưa nội dung nhạy cảm vào báo cáo.
- [ ] Ghi môi trường: phần cứng, OS, camera, trình duyệt, mạng, số worker/instance, cấu hình có hiệu lực của `PAD_MIN_VOTES`, `PAD_SMOOTH_WINDOW`, `PAD_SPOOF_MIN_RATIO`, `ATTENDANCE_STABLE_COUNT`, `FACE_MATCH_THRESHOLD`, version/hash model và ảnh nén. Không suy từ `.env.example`.
- [ ] Xác định trước tập người tham gia, các điều kiện ánh sáng/khoảng cách, số lần thử độc lập, loại tấn công được phép, ngưỡng chấp nhận về độ trễ, tỷ lệ từ chối và nhận sai. Nếu chưa đủ dữ liệu để đặt giới hạn, báo cáo là khảo sát, không kết luận tương đương an toàn.
- [ ] Chia dữ liệu phát triển và đánh giá độc lập theo người/phiên phù hợp; cố định giao thức và thứ tự hoặc ngẫu nhiên hóa thứ tự cấu hình. Ghi cả số trường hợp bỏ cuộc/chuyển mật khẩu.

## Bước 1 — Instrumentation và baseline

**Đầu ra:** Số đo có thể đối chiếu theo request, không thay đổi quyết định đăng nhập.

- [ ] Viết test dùng đồng hồ/mô hình giả cho trường hợp thành công, từ chối và lỗi; khẳng định bật/tắt telemetry không đổi kết quả, không ghi ảnh/embedding/secret và các khoảng thời gian không âm.
- [ ] Dùng đồng hồ đơn điệu tại mỗi tiến trình, ID tương quan ngẫu nhiên và log cấu trúc chỉ bật trong môi trường đo. Không trừ timestamp giữa các máy. Không trả chi tiết điểm sinh trắc học hoặc lý do nội bộ cho client chưa xác thực.
- [ ] Đo frontend: mở camera đến sẵn sàng, thời gian từ bấm đến challenge xong, từng lần chụp/mã hóa, thời gian giữa các frame, kích thước body và thời gian request đầu-cuối. JSON byte size là kích thước body, không phải tổng byte đường truyền; không gọi RTT toàn phần là upload time.
- [ ] Đo backend: thời gian nhận request/body, RPC tới face_auth, số lượng và tổng thời gian truy vấn pgvector, thời gian cấp phiên và trạng thái tổng quát. Đo Python: decode, detector/kiểm tra hình học, PAD, căn chỉnh, embedding, số lần gọi, tổng và trạng thái bận. Semaphore hiện không xếp hàng: 429 là bận.
- [ ] Chạy test liên quan: `npm --prefix frontend test -- validation/auth/face-login-camera.test.ts validation/auth/face-login-modal.test.tsx`; `npm --prefix backend test -- validation/auth/face-login.test.ts validation/auth/face-login-routes.test.ts validation/auth/face-login-session.test.ts`; từ `face_auth`: `../.venv/Scripts/python.exe -m unittest tests.test_face_login_http tests.test_face_login_parity`. Điều chỉnh đường dẫn Python theo môi trường, ghi lỗi dependency nếu có.
- [ ] Đo baseline bằng chính luồng web trên các điều kiện đã khóa: cold start và warm start, lần đầu và retry, một người và tải đồng thời. Báo cáo p50/p95 kèm cỡ mẫu, số phiên không thành công, tỷ lệ thành công lần đầu, TTSL tính cả thời gian retry, tỷ lệ bỏ cuộc và payload.
- [ ] Lưu báo cáo đã ẩn danh trong `docs/experiments/`; ghi rõ cỡ mẫu, khoảng tin cậy phù hợp, điều kiện thử và phân biệt latency từ các công đoạn chồng lấn. **Cổng:** nếu chưa đo được camera/mô hình, dừng tại đây và ghi chính xác lý do, không bịa số.

## Bước 2 — Thử lịch chụp, giữ 8 frame

**Đầu ra:** So sánh một thay đổi mỗi lần; chỉ chọn thay đổi khi đạt tiêu chí Bước 0.

- [ ] Tạo test với fake timers/camera: 8 frame theo thứ tự; hủy không gửi ảnh tiếp; camera lỗi không gọi đăng nhập; challenge hết hạn vẫn từ chối. Kiểm tra lịch của cả ba cấu hình dưới đây.
- [ ] So sánh: A baseline chờ trước frame đầu và mỗi frame, 350 ms; B chụp ngay frame đầu, 350 ms giữa các lần; C giống B, 250 ms giữa các lần. Không đồng thời thay kích thước, chất lượng JPEG, PAD hoặc ngưỡng. Thời điểm thực tế bao gồm cả thời gian capture/encode.
- [ ] Thử theo giao thức đã khóa; báo cáo TTSL, độ trễ mỗi lần, tỷ lệ thất bại, bỏ cuộc và sai số/độ bất định so với A. Nếu B hoặc C giảm thời gian chờ nhưng làm kết quả sinh trắc học xấu hơn giới hạn đã đặt, không chọn cấu hình đó.
- [ ] Chỉ đưa cấu hình thắng vào thay đổi sản phẩm sau khi chạy test frontend, backend và Python ở Bước 1, kiểm tra build frontend `npm --prefix frontend run lint` và `npm --prefix frontend run build`.

## Bước 3 — Các thí nghiệm có điều kiện

Thực hiện từng nhánh riêng sau Bước 2; không kết hợp nhiều thay đổi trước khi biết ảnh hưởng của từng nhánh.

### 3A. Batch ngắn — chỉ khi thời gian thu ảnh vẫn là nút thắt

- [ ] So sánh 5, 6, 8 frame với cùng lịch đã chọn. Tính K + M − 1 theo cấu hình có hiệu lực; số frame vượt mức tối thiểu không bảo đảm chịu được frame lỗi.
- [ ] Cập nhật đồng bộ validation ở frontend, Node, Python HTTP và pipeline trong nhánh thử nghiệm; giữ thuật toán PAD và so khớp. Thêm test cho số frame sai, mặt không hợp lệ ở đầu/cuối, đổi track và spoof sau embedding.
- [ ] Báo cáo thay đổi tỷ lệ chấp nhận/từ chối so với 8 frame, đặc biệt spoof muộn. Giảm số frame làm thay đổi thời gian quan sát, vì vậy chỉ chọn sau khi thỏa tiêu chí sinh trắc học định trước.

### 3B. Binary và chất lượng ảnh — chỉ khi payload/upload đáng kể

- [ ] Thử multipart JPEG binary độc lập với các thay đổi kích thước/chất lượng; sau đó thử cạnh dài 640 px và JPEG 0,8 trong phép so sánh riêng. Giữ tỷ lệ ảnh, không ép vuông.
- [ ] Duy trì kiểm tra số ảnh, kích thước body/file, JPEG thật, kích thước giải mã, kiểm soát bộ nhớ và xác thực ở cả hai lớp. Test ảnh giả MIME, ảnh rỗng/quá lớn, lỗi giải mã, hủy request.
- [ ] So sánh byte body và thời gian đầu-cuối, đồng thời đánh giá PAD và nhận diện trên người thật và các loại tấn công đã định. Không suy ra hiệu năng chỉ từ tiết kiệm Base64.

### 3C. Căn chỉnh — chỉ nghiên cứu khi bước này đáng kể trong baseline

- [ ] Giữ 5 landmark trong sản phẩm. Trên dữ liệu được phép và tập thử tách biệt, so sánh căn chỉnh hiện tại với crop bbox, dùng cùng ảnh, model và ngưỡng; đo thời gian, tỷ lệ nhận đúng/nhầm và tính tương thích với gallery đăng ký hiện tại.
- [ ] Đánh giá các trường hợp nghiêng, lệch tâm, khoảng cách khác nhau. Nếu cần thay preprocessing hoặc ngưỡng, coi đó là hợp đồng model mới và xây dựng giao thức đánh giá độc lập; không thay đổi gallery hoặc ngưỡng sản phẩm từ kết quả khảo sát.

## Bước 4 — Pipelining, chỉ nếu inference còn đáng kể

- [ ] Viết thiết kế riêng trước khi sửa: backend quản lý challenge/cookie và cấp phiên; Python giữ trạng thái tạm cùng logic `Track`; định nghĩa TTL, số thứ tự frame, chống trùng, hủy, backpressure, giới hạn tài nguyên, đồng bộ theo process/instance, giới hạn rate và lỗi bận.
- [ ] Chế độ đối chứng xử lý đủ 8 frame, không drop frame; có test so sánh cùng chuỗi đầu vào với batch cũ cho ảnh lỗi, thay track, PAD/embedding, spoof muộn, sai thứ tự, retry, timeout và cạnh tranh kết thúc phiên. Kiểm tra semaphore và khả năng nhiều session dưới tải.
- [ ] Đo tổng thời gian, queue, CPU, số request, lỗi 429/503, công bằng và bảo mật; không mặc định inference ẩn hết trong thời gian chụp. Chỉ tiếp tục nếu cải thiện vượt chi phí độ phức tạp và đạt tiêu chí Bước 0.
- [ ] Early exit là nhánh thử nghiệm riêng: so với đối chứng 8 frame trên dữ liệu người thật và tấn công, đặc biệt spoof muộn. Không phát hành chỉ dựa trên K + M − 1 hoặc test đơn vị.

## Bước 5 — Tổng kết và quyết định

- [ ] Ghi rõ từng phương án đã thử/chưa thử, cấu hình, dữ liệu, phiên bản, các phép đo, cỡ mẫu, giới hạn và tiêu chí đạt/không đạt; nêu đề xuất giữ hoặc loại từng thay đổi.
- [ ] Kiểm tra lại các test mục tiêu, lint/build frontend, kiểm tra an toàn và diff; báo cáo lệnh, kết quả và những kiểm tra chưa chạy. Dừng nếu thiếu dữ liệu hoặc có hồi quy chưa giải quyết.
- [ ] Không tự triển khai production, thay threshold, thay preprocessing hoặc xóa dữ liệu đăng ký từ kết quả thử nghiệm.
