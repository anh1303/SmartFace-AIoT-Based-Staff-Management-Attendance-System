# Chạy PBL6, migration, seed và gallery test

Chạy các lệnh Docker từ thư mục gốc repo. Compose có hai cách dùng:

- Mặc định: PostgreSQL; thêm `--profile tools` để chạy pgAdmin.
- `--profile app`: PostgreSQL, migration, Face Auth API CPU, MQTT nội bộ,
  backend và frontend Nginx. Camera OpenCV/PAD realtime chạy riêng trên host/Pi.

## 1. Chuẩn bị cấu hình

```bash
cp .env.compose.example .env.compose
cp backend/.env.example backend/.env
cp face_auth/.env.example face_auth/.env
```

Chỉ sao chép khi chưa có file cấu hình. Trong `.env.compose`, thay
`PBL6_POSTGRES_VOLUME` bằng volume PBL6 thực tế và `PBL6_POSTGRES_PASSWORD` bằng
mật khẩu hiện tại. Kiểm tra bằng:

```bash
docker ps -a
docker volume ls
docker inspect TEN_CONTAINER_DB_CU --format '{{json .Mounts}}'
```

Tên `backend_postgres_data` hoặc `face_auth_postgres_data` không tự chứng minh DB
bên trong là PBL6. Giữ volume nghiệp vụ đúng; dừng container PostgreSQL cũ trước
khi dùng cùng volume với Compose mới. Không cho hai PostgreSQL mở cùng PGDATA.
Không dùng `docker compose down -v` để đổi cấu hình.

Nếu muốn một DB **test mới hoàn toàn**, tạo volume riêng rồi đặt tên đó trong
`.env.compose`; đây không phải thao tác chuyển dữ liệu từ DB nghiệp vụ:

```bash
docker volume create pbl6_fresh_test_postgres
# .env.compose: PBL6_POSTGRES_VOLUME=pbl6_fresh_test_postgres
```

Backend container đọc secrets từ `backend/.env`; thay JWT/MQTT shared secret theo
môi trường. Compose ghi đè các URL thành hostname nội bộ `postgres`, `face-auth`,
`mqtt`. Khi chạy backend/Python trên host, đặt password/port tương ứng trong
`backend/.env` và `face_auth/.env` (hostname `localhost`). Nếu password có ký tự
đặc biệt của URL, cung cấp `PBL6_DOCKER_DATABASE_URL` với password URL-encoded,
hostname `postgres`, database `PBL6`, tham số `?schema=public`.

Frontend Docker dùng API cùng origin qua Nginx; không cần URL API trong trình duyệt.
Mặc định web ở `http://localhost:8080`; `NODE_ENV=development` dùng cookie cho HTTP
local. Khi triển khai HTTPS, đổi `PBL6_NODE_ENV=production` và `PBL6_CORS_ORIGIN`
sang origin HTTPS thực tế.

## 2. Database và Prisma

```bash
docker compose --env-file .env.compose up -d postgres
docker compose --env-file .env.compose exec postgres pg_isready -U postgres -d PBL6
```

Có thể quản lý Prisma từ host:

```bash
cd backend
npm ci
npm run prisma:generate
npm run prisma:migrate
```

`prisma:migrate` chạy **migrate deploy**, áp migration đã có. Migration
`20261001120000_rebuild_face_embeddings_contract` xóa toàn bộ embeddings cũ, sửa
`real[]` thành `vector(512) NOT NULL`, thêm SAMPLE/CENTROID và unique centroid active.
Các bảng nhân viên/chấm công/lương không bị xóa bởi migration này.

Nếu DB có schema sẵn nhưng thiếu `_prisma_migrations` và báo P3005, dừng ở đó để
inventory/baseline schema thực tế. Không mark tất cả migration là applied một cách
mù quáng, không `migrate reset` hoặc `db push --accept-data-loss` trên DB nghiệp vụ.

Seed chỉ dùng cho **DB test/dev có thể xóa dữ liệu**:

```bash
# Chạy trong backend, sau migrate. Seed xóa dữ liệu nhiều bảng rồi nạp mẫu.
npm run prisma:seed
```

Seed tạo roles, tài khoản `admin`/`manager`/`employee` (mật khẩu `Admin@123456`),
nhân viên và dữ liệu nghiệp vụ mẫu. Seed không tạo embeddings giả. Đăng ký ảnh
sau seed; nếu seed lại thì embeddings và hồ sơ test trước đó cũng bị xóa.

## 3. Chạy stack ứng dụng bằng Docker

Từ root, sau khi cấu hình volume/password:

```bash
docker compose --env-file .env.compose --profile app build
docker compose --env-file .env.compose --profile app run --rm migrate
# Chỉ với DB test mới/có thể reset; bỏ qua trên DB nghiệp vụ:
docker compose --env-file .env.compose --profile app run --rm --no-deps migrate npm run prisma:seed
docker compose --env-file .env.compose --profile app --profile tools up -d
docker compose --env-file .env.compose --profile app --profile tools ps -a
```

Service migration phải thoát với code 0 trước khi API bắt đầu. Face Auth phải
healthcheck ready trước backend. InsightFace cần model pack `buffalo_s`; lần đầu
cache rỗng sẽ tải model. Để dùng cache có sẵn, đặt `PBL6_INSIGHTFACE_CACHE` bằng
đường dẫn tuyệt đối tới thư mục `.insightface` chứa `models/buffalo_s/*.onnx`.
Cache mặc định là named volume; không có PAD model trong API container vì API này
chỉ trích xuất embedding. Realtime host giữ cấu hình PAD của nó.

- Web: `http://localhost:8080`
- Backend: `http://localhost:3000/health`
- Face API: `http://localhost:5000/health`
- pgAdmin (tools): `http://localhost:5050`; DB hostname trong pgAdmin là `postgres`.

```bash
docker compose --env-file .env.compose --profile app logs --tail=100 migrate face-auth backend frontend
docker compose --env-file .env.compose --profile app --profile tools down
```

`down` giữ volumes. MQTT broker chỉ nằm trong mạng Compose; muốn phần cứng ngoài
host truy cập cần cấu hình publish/bảo vệ broker riêng. Face API/DB/backend mặc
định chỉ publish vào loopback; nếu Pi cần DB/backend trên LAN, cấu hình bind và
origin theo đúng máy chủ.

## 4. Chạy ứng dụng trên host với Docker database

```bash
docker compose --env-file .env.compose --profile tools up -d postgres pgadmin
```

Sau migrate/seed phù hợp, mở các terminal riêng:

```bash
# Terminal 1
cd backend
npm run dev
# Terminal 2
cd frontend
npm ci
npm run dev
# Terminal 3, dùng Python environment đã cài requirements
cd face_auth
python3 -m pip install -r requirements.txt
python3 -m uvicorn api_service:app --host 0.0.0.0 --port 5000
# Terminal 4, camera host/Pi
cd face_auth
python3 app.py
```

Web host ở `http://localhost:5173`. Không chạy đồng thời app container và app host
trên cùng các port. `run.sh`/`run.bat` vẫn là launcher host + Docker database;
menu 1/2 mở cả Face Auth API (ưu tiên Python trong `face_auth/.venv` nếu có),
backend và frontend. Cài requirements Python trước khi dùng launcher; menu 6
chỉ cài dependencies Node. Menu 7 chạy generate/migrate và không tự seed.

## 5. Enroll và xóa nhanh danh tính test

Đặt ảnh theo `face_auth/gallery/Ten day du/*.jpg`, hoặc thư mục mang employee_code
có sẵn. Một ảnh chỉ có một người. Script chỉ tạo nhân viên khi có embedding hợp lệ.

```bash
cd face_auth
python3 scripts/run_enroll.py --gallery gallery
python3 scripts/run_enroll.py --gallery gallery --ignore-duplicate
# Không tạo nhân viên mẫu:
python3 scripts/run_enroll.py --gallery gallery --existing-only
```

Khi thiếu employee, script giữ nguyên tên, sinh UUID, mã `TEST-<32 hex>`, email
`test-<cùng token>@example.invalid` và các thông tin mẫu. Chạy lại dùng cùng hồ sơ;
tên trùng nhiều người phải đổi folder thành employee_code. Embeddings luôn từ ảnh
thật, đúng model và được lưu SAMPLE/CENTROID.

```bash
# Xem trước, chưa xóa:
python3 scripts/delete_test_identities.py
# Xóa hồ sơ test và embeddings tương ứng:
python3 scripts/delete_test_identities.py --yes
```

Cleanup chỉ chọn hồ sơ có cả mã/email đúng dấu hiệu do script tạo và không có
tài khoản liên kết. Giữ lại hồ sơ có lịch ca, chấm công, tổng hợp ngày hoặc lương.
Không xóa nhân viên thật được enroll bằng folder employee_code.

Trong Docker, gallery được mount từ host:

```bash
# Chạy từ root, API đã ready:
docker compose --env-file .env.compose --profile app exec face-auth python scripts/run_enroll.py
docker compose --env-file .env.compose --profile app exec face-auth python scripts/delete_test_identities.py
docker compose --env-file .env.compose --profile app exec face-auth python scripts/delete_test_identities.py --yes
```
