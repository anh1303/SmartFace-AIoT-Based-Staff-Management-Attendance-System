# Kiểm chứng tích hợp ngày 2026-10-01

Kiểm tra các thay đổi trong working tree trên macOS/arm64. Dùng PostgreSQL và
volume test riêng; không migrate/seed hoặc xóa dữ liệu trong volume nghiệp vụ.
Hướng dẫn vận hành: [run_full_stack.md](run_full_stack.md).

## Kết quả đã chạy

- Backend: Prisma generate và TypeScript build thành công.
- Frontend: TypeScript check và Vite build thành công; còn cảnh báo kích thước chunk.
- Build thành công cả ba image backend, frontend và Face Auth API CPU.
- Compose profile `app` + `tools`: PostgreSQL, Face API và backend healthy;
  frontend, MQTT, pgAdmin chạy; service migration thoát code 0.
- Prisma áp đủ ba migration và seed thành công trên DB mới: sáu nhân viên,
  không có embeddings giả.
- Gallery `Nguyen Quang Anh` có ba ảnh thật: enroll trên host và trong container
  tạo ba SAMPLE + một CENTROID. Tự so khớp centroid trả đúng người với score > 0.999;
  đây là kiểm tra nhất quán dữ liệu, không phải đo độ chính xác nhận diện.
- Qua Nginx: tải web, login bằng cookie, đọc nhân viên, enroll ảnh qua backend
  và đọc bốn embeddings thành công. Ảnh base64 lỗi trả 400 và giữ vectors cũ;
  endpoint raw vector trả 404; ghi `face_enrolled=false` không ghi đè trạng thái
  được suy ra từ centroid.
- DB logic: lọc đúng model/ACTIVE/CENTROID, chuẩn hóa vectors, từ chối zero/NaN/
  sai chiều; enroll lỗi rollback và giữ embeddings trước đó.
- Mô phỏng schema `real[]` cũ trên DB test: migration sửa về `vector(512)` và
  xóa embeddings cũ, giữ số lượng nhân viên.
- Cleanup preview không xóa; `--yes` xóa hồ sơ test và embeddings, giữ nhân viên
  seed và hồ sơ test có ca làm. Sau cleanup Docker: sáu nhân viên, zero embeddings.
- 34 unit tests trong enrollment math, VectorDB logic, tracker và runtime đều pass.
  Test low-confidence đặt ngưỡng riêng trong fixture, không phụ thuộc `.env` local.
- Python compile, shell syntax, Compose config và kiểm tra whitespace đều pass.

## Phạm vi còn cần xác nhận khi vận hành

Database nghiệp vụ hiện hữu cần chọn đúng volume và kiểm tra lịch sử migration
trước khi áp dụng. Nếu chưa có `_prisma_migrations`, cần baseline theo schema thực tế.
Seed là thao tác xóa dữ liệu mẫu cũ, chỉ dùng cho DB dev/test có thể reset.

Chưa kiểm thử camera realtime/PAD trên phần cứng. Chạy `python3 app.py` trên
host/Pi với model pack và DB giống API; theo dõi thông báo lỗi nhận diện và score.
Kiểm tra Docker đã dùng cache `buffalo_s` có sẵn, chưa kiểm chứng tải model lần đầu
trên mạng của máy triển khai. Camera và MQTT từ thiết bị ngoài Compose cần cấu hình
kết nối phù hợp; các cổng dịch vụ mặc định bind vào loopback.
