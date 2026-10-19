# Thay đổi face_auth — Chu kỳ realtime

Theo yêu cầu cấu hình vận hành:

```dotenv
RECOGNIZE_INTERVAL_SECONDS=1.0
DETECTION_INTERVAL_SECONDS=0.2
PAD_INTERVAL_SECONDS=0.2
```

Đã sửa cả `face_auth/.env` và `face_auth/.env.example`. `config.py` có fallback tương ứng 1,0/0,2/0,2 giây; PAD và detection độc lập với recognition và số phiếu trong cửa sổ PAD. Bỏ mô tả cũ buộc PAD bằng recognition/window.

Đã truy vết `config.py` → tracker → `submit_recognition_step`/vòng PAD/detection trong `app.py`, kiểm tra giá trị import thực tế và chạy 16 test tracker thành công. Các biến môi trường ngoài ba interval được đối chiếu để bảo toàn. Không đổi model, ngưỡng, preprocessing, temporal votes, cache hoặc artifact nghiên cứu.

Chưa chạy camera bằng cấu hình mới. Cần restart tiến trình để đọc `.env` mới; cadence là lịch chạy cấu hình, không phải kết quả đo FPS/thời gian inference thực tế.
