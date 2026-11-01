# Hồ sơ sửa logic điểm danh và tính lương — 19/10/2026

> Đây là hồ sơ phát hành ngày 19/10. Với nâng cấp ca đêm và duyệt từng khoản OT/phạt ngày 26/10/2026, đọc [hướng dẫn nâng cấp hiện tại](../../ATTENDANCE_OT_PENALTY_UPGRADE_2026-10-26.md) và [rule phiên bản 2026-10-26-v5](../../rule/COMPANY_POLICY.md). Trạng thái migration Neon bên dưới chỉ mô tả đợt 19/10, không xác nhận các migration mới đã áp dụng lên cloud.

Đọc theo thứ tự:

1. [Chính sách công ty đã chốt, công thức và ví dụ](../../rule/COMPANY_POLICY.md).
2. [Thay đổi backend và migration](../../changes/2026-10-19/BACKEND_CHANGES.md).
3. [Thay đổi frontend](../../changes/2026-10-19/FRONTEND_CHANGES.md).
4. [Thay đổi code Pi/hardware và giới hạn thực tế](../../changes/2026-10-19/HARDWARE_CHANGES.md).

## Trạng thái bàn giao

Code mới đang nằm trong workspace; chưa commit/push, chưa thay tiến trình backend/frontend đang chạy hoặc copy lên Pi. Migration `20261019100000_attendance_policy_and_ot_review` đã thêm cột/chỉ mục trên Neon; không có thao tác sửa/xóa giá trị nghiệp vụ hiện hữu. Chi tiết lần áp dụng và việc tách DB kiểm thử được ghi ở báo cáo backend.

Kiểm thử thao tác tạo log, duyệt công và tính lương dùng PostgreSQL tạm riêng. Không chạy các ca tạo/sửa dữ liệu đó trên Neon. Chưa xác nhận luồng camera → ThingsBoard mới → backend mới → trình duyệt ngoài thực địa.

## Chạy kiểm tra local

Từ thư mục gốc repo, sau khi đã cài dependencies theo lockfile:

```bash
npm run build --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix backend -- validation/attendance/attendance.policy.test.ts validation/devices/webhook-validation.test.ts validation/payroll/financial-validation.test.ts validation/payroll/policy-defaults.test.ts
npm test --prefix frontend -- validation/attendance/attendance-display.test.tsx validation/payroll/payroll-request.test.ts validation/attendance/time-rounding.test.ts
python3 -m unittest discover -s hardware/validation -p 'test_*.py' -v
python3 -m py_compile hardware/edge_client.py hardware/iot/thingsboard_client.py hardware/streaming/rtsp_streamer.py scripts/deploy_thingsboard_dashboard.py
```

Kiểm thử Socket.IO tạo listener localhost, không dùng DB:

```bash
cd backend
RUN_SOCKET_TESTS=1 npm test -- validation/auth/socket-auth.test.ts
cd ..
```

Các test PostgreSQL có thao tác ghi và yêu cầu DB kiểm thử cô lập. Bộ test hiện chỉ chấp nhận URL `policy_check` trên loopback; không thay đổi hoặc bỏ cơ chế bảo vệ này để chạy trực tiếp trên DB doanh nghiệp. Không chạy `migrate reset`, `db push` hoặc seed trên dữ liệu doanh nghiệp để kiểm thử.

## Đưa bản sửa vào vận hành

### Backend, frontend và ThingsBoard trên server

1. Giữ bản sao cấu hình và đối chiếu migration history trước mọi thay đổi schema tiếp theo. Migration của đợt này đã áp dụng trên Neon, không cần áp lại thủ công. Prisma dùng `DIRECT_URL` cho migration; luôn kiểm tra cả hai URL và datasource hiển thị trên CLI.
2. Tạo một secret riêng, tối thiểu 24 ký tự; đặt vào `backend/.env`:

   ```bash
   python3 -c 'import secrets; print(secrets.token_hex(32))'
   ```

   ```dotenv
   TB_WEBHOOK_SECRET=<giá-trị-vừa-tạo>
   ```

3. Đối chiếu `TB_HOST`, `TB_HTTP_PORT`, `TB_USERNAME`, `TB_PASSWORD` với cách chạy backend. Trong Compose IoT cùng mạng: thường `thingsboard:9090`; backend trên host: `127.0.0.1:8081`. Script dashboard hiện dùng ThingsBoard host `http://127.0.0.1:8081`, thiết bị `PI4_FRONT_GATE`.
4. Script `scripts/deploy_thingsboard_dashboard.py` đã được cập nhật nhưng **chưa chạy triển khai trong đợt này**. Khi áp dụng, script sao lưu metadata/dashboard rồi bổ sung:
   - Secret vào header `X-TB-Webhook-Secret` của REST node điểm danh.
   - `X-Device-Name: ${deviceName}` để đối chiếu originator.
   - Nhánh telemetry có `mode_changed_at` → **SmartFace Mode Relay** → `/api/devices/${deviceName}/mode-notify`, cùng secret.
   - Giữ đường RPC verify_face → REST backend → RPC Reply; vector không đi vào Timeseries.

   Chạy khi backend `.env` đã có thông tin ThingsBoard và secret:

   ```bash
   python3 scripts/deploy_thingsboard_dashboard.py
   ```

   Script xuất file đã che secret; nếu import lại template/export thì phải cấu hình secret thật trong node. `smartface_root_rule_chain.json` là template có placeholder, không chứa secret hoạt động. Kiểm tra nhánh RPC cả Success/Failure trong Rule Chain; lỗi HTTP có thể dẫn tới timeout ở Pi, không được hiểu thành điểm danh đã xác nhận.
5. Build lại đúng stack đang dùng. Với stack cloud hiện có trong repo:

   ```bash
   docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --build --no-deps backend frontend
   ```

   Nếu chạy trực tiếp bằng npm thì build rồi restart tiến trình backend/frontend theo cách đang vận hành. Không khởi động một stack DB khác hoặc chạy seed chỉ để cập nhật code.

### Pi

Cập nhật có chọn lọc các file:

```text
hardware/edge_client.py
hardware/iot/thingsboard_client.py
hardware/streaming/rtsp_streamer.py
```

Giữ `.env`, model và venv trên Pi. Repo Pi trước đây được người dùng báo ở `~/test/pi_edge`; hãy đối chiếu thư mục thực tế đang chạy. Dừng bản cũ trước khi mở camera bằng bản mới.

Trong thư mục Pi tương ứng, với venv đang dùng:

```bash
python check_connection.py
python check_runtime.py --camera
python edge_client.py
```

Mặc định dùng Rule Chain Mode Relay, để `BACKEND_BASE_URL` và `TB_WEBHOOK_SECRET` phía Pi trống. Chỉ cấu hình direct HTTP nếu chủ đích dùng đường thay thế đó; không cần gửi secret backend xuống mọi thiết bị khi dùng relay của ThingsBoard.

### Nghiệm thu sau cập nhật

- IN hai lần rồi OUT: chỉ cặp IN gần nhất → OUT được tính. Gửi lại cùng `event_id`: chỉ một raw log.
- OFF vẫn lưu hai lượt, 0 giờ thường/OT tự đề xuất; duyệt bù có lý do mới tăng OT trả.
- Ca 08:00–17:30: IN 07:30, OUT 18:10 → 9,5 giờ thường và 0,5 giờ OT đề xuất, chưa trả trước duyệt.
- Đổi mode trên web và ThingsBoard; kiểm tra Pi phản hồi, web đọc lại đúng sau reload, Pi phục hồi đúng sau restart.
- Mất MQTT/REST/response: Pi hiển thị chờ/uncertain và retry cùng ID; đối chiếu DB không tạo trùng. Đổi người/mode trong lúc chờ không áp nhầm kết quả.
- Còn review hoặc OT PENDING thì không chốt; duyệt lại sau tạo lương thì phải tính/rà soát lại phiếu. FINALIZED/PAID giữ nguyên khi gọi tính lại.
- Thử camera USB, TFT ST7789V, HC-SR04, RTSP và khởi động lại service trên thiết bị thật. Không dùng các kiểm tra số học để kết luận chất lượng nhận diện.

## Bảo toàn dữ liệu và tài liệu cũ

Các tài liệu triển khai trước đợt này có thể còn mô tả cơ chế cũ. Bộ quy tắc tại `COMPANY_POLICY.md` là căn cứ nghiệp vụ cho bản sửa; tài liệu ThingsBoard/Pi trước đó tiếp tục dùng cho wiring, cài thư viện và cấu hình hạ tầng. Chưa tự tính lại hoặc chuyển đổi số tiền lịch sử trên Neon.
