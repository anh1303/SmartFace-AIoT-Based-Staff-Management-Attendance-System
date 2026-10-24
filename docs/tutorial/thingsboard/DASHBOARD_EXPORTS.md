# SmartFace ThingsBoard dashboard

> Server, Rule Chain, dashboard và Pi được tổng hợp tại
> [THINGSBOARD_PI_SETUP.md](THINGSBOARD_PI_SETUP.md).

Dashboard đã tạo từ `smartface_dashboard.json`, đối chiếu đường RPC với
`smartface_root_rule_chain.json` ở thư mục gốc. Template Rule Chain được bổ sung xác thực webhook; script triển khai cấu hình nhánh Mode Relay. Các JSON trong `docs/assets/thingsboard/` là bản chụp cấu hình ngày 15/10; xem [bản sửa ngày 19/10](../../changes/2026-10-19/README.md) và [hướng dẫn áp dụng](../deployment/ATTENDANCE_PAYROLL_RELEASE.md) trước khi import để vận hành bản mới.

Mở [SmartFace AIoT Gate Monitor](http://10.52.138.38:8081/dashboards/7c26ed80-c879-11f1-b81a-93872484301c)
và đăng nhập tài khoản tenant hiện tại.

Năm widget giữ bố cục của mẫu:

1. Đồng hồ FPS từ telemetry `fps`.
2. Biểu đồ `antispoof_score`, mỗi lượt Pi gửi RPC `verify_face`.
3. Trạng thái cổng với `current_mode`, `status` và FPS đo được.
4. Công tắc RPC `getValue` / `setValue`: bật CHECK_IN, tắt CHECK_OUT.
5. Thẻ HC-SR04 với `distance`, `ai_state`, `attendance_latch`, `person_present`.

Alias và RPC target đã thay UUID cũ bằng thiết bị `PI4_FRONT_GATE` trên tenant
hiện tại. Placeholder HTML đã sửa đúng định dạng của widget đang cài; trạng thái
ONLINE không còn là chuỗi ghi cố định.

Root Rule Chain đang hoạt động được giữ lại; bổ sung nhánh:

```text
Message Type Switch / RPC Request from Device
  → SmartFace Has Liveness Score
  → True → SmartFace Score Only
  → Success → Save Timeseries
```

Nhánh bổ sung chỉ lưu `antispoof_score`. Không lưu `embedding`/`embedding_b64`.
Luồng RPC qua webhook `http://backend:3000/api/attendance/tb-webhook` và RPC reply
hiện tại được giữ nguyên. Biểu đồ chưa có điểm cho đến khi có lượt gửi thật sau
khi triển khai; Pi chỉ gửi đối soát sau khi PAD cho phép, nên đây không phải đồ
thị PAD của mọi frame và không phản ánh tất cả lần phát hiện spoof.

Đã kiểm tra: đọc lại dashboard 5 widget, UUID/alias, bố cục không chồng nhau,
RPC `getValue` nhận được `true` từ Pi, telemetry thật có FPS/khoảng cách/trạng thái.
Script TBEL lọc và trích điểm đã chạy qua API `testScript`: đầu ra chỉ có score
và giữ metadata RPC. Dữ liệu test không được ghi vào telemetry. Chưa kiểm tra
dashboard bằng trình duyệt trong phiên này.

File `*.deployed.json` là bản export sau cấu hình; `*_before_*.json` là backup.
Để cập nhật lại dashboard cùng tên trên server hiện tại:

```bash
cd /Users/coding/PBL6
python3 scripts/deploy_thingsboard_dashboard.py
```

Script đọc tài khoản tenant từ `backend/.env`, không ghi token/mật khẩu vào export.
