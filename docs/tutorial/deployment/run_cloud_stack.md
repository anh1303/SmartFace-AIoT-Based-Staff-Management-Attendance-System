# Chạy Docker với database cloud

Chạy các lệnh dưới đây từ `/Users/coding/PBL6`. Mở Docker Desktop trước.

`docker-compose.cloud.yml` là file Compose độc lập: dùng riêng file này, không
ghép với `docker-compose.yml`. Nó chạy backend, frontend, Face Auth API và MQTT;
đọc URL database từ `backend/.env` và `face_auth/.env`. File `.env.compose` chỉ
cung cấp các tùy chọn như cổng, CORS và model pack cho stack này; URL local
`PBL6_DOCKER_DATABASE_URL` trong đó không được sử dụng.

## 1. Kiểm tra cấu hình

- `backend/.env`: `DATABASE_URL` là URL Neon pooled, `DIRECT_URL` là URL Neon
  direct. Cả hai trỏ tới cùng database và có `sslmode=require`.
- `face_auth/.env`: `DATABASE_URL` trỏ tới cùng database cloud.
- `.env.compose`: cổng mặc định web `8080`, backend `3000`, Face Auth `5000`;
  `PBL6_CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080`.
- Giữ model pack phù hợp với embeddings đã lưu. Docker dùng
  `PBL6_FACE_MODEL_PACK` cho cả backend và Face Auth, giống stack local hiện có.

Đây là Face Auth API trích xuất embeddings chạy CPU. Camera/PAD realtime chạy
riêng trên máy/Pi. Container API giữ `PAD_RUNTIME_CONFIG_PATH` rỗng vì image hiện
tại không chứa thư mục PAD/model realtime.

## 2. Dừng stack cũ và dựng lại

Nếu đang chạy `bash run.sh`, dừng các tiến trình trong terminal ứng dụng bằng
Ctrl+C trước để tránh trùng cổng.

```bash
cd /Users/coding/PBL6
docker compose --env-file .env.compose --profile app --profile tools down
docker compose --env-file .env.compose -f docker-compose.cloud.yml config --quiet
docker compose --env-file .env.compose -f docker-compose.cloud.yml build
```

Lệnh `down` không có `-v`, giữ lại volumes database local và cache models.
Đổi URL database chỉ cần tạo lại containers; `build` dùng khi dựng lại images
hoặc có thay đổi source/dependencies. Không cần `--no-cache` cho lần chạy thông thường.

## 3. Kiểm tra schema cloud trước khi khởi động

```bash
docker compose --env-file .env.compose -f docker-compose.cloud.yml run --rm --no-deps backend npx --no-install prisma migrate status
```

Nếu cloud đã có schema đúng và các migration đã applied, chuyển sang bước 4.
Nếu có migration pending, đọc SQL trong `backend/prisma/migrations` và backup
database trước khi áp dụng. Migration
`20261001120000_rebuild_face_embeddings_contract` có lệnh xóa embeddings cũ.
Sau khi xác nhận các migration pending phù hợp với database đích, chạy:

```bash
docker compose --env-file .env.compose -f docker-compose.cloud.yml run --rm --no-deps backend npm run prisma:migrate
```

Stack cloud không tự chạy migration hoặc seed. Không chạy seed trên database
đang sử dụng vì script seed xóa dữ liệu nghiệp vụ. Nếu gặp P3005 do database đã
có bảng nhưng thiếu lịch sử Prisma, cần đối chiếu schema và baseline; không reset
database để vượt lỗi. Database phải có extension `vector` và schema phù hợp với
backend/Face Auth; đổi URL không tự chuyển dữ liệu từ local lên cloud.

## 4. Khởi động và kiểm tra

```bash
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d
docker compose --env-file .env.compose -f docker-compose.cloud.yml ps -a
docker compose --env-file .env.compose -f docker-compose.cloud.yml logs --tail=100 face-auth backend frontend
curl -fsS http://localhost:5000/health
curl -fsS http://localhost:3000/health
```

Mở web tại `http://localhost:8080`. Face Auth lần đầu cần tải model InsightFace;
backend đợi Face Auth healthy, frontend đợi backend healthy. Face Auth `/health`
kiểm tra kết nối database; backend `/health` chỉ xác nhận HTTP API đang chạy.
Kiểm tra thêm đăng nhập và một chức năng đọc dữ liệu để xác nhận backend dùng
database cloud thành công.

Nếu không lên, xem log từng service. Lỗi kết nối cloud cần kiểm tra URL, SSL và
mạng; lỗi bảng/vector cần kiểm tra schema. Không chia sẻ output `config` đầy đủ
vì nó có thể chứa credentials; dùng `config --quiet` để kiểm tra cấu hình.

## 5. Các lần chạy sau

```bash
# Chạy lại stack
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d

# Sau khi đổi .env, tạo lại containers để nhận cấu hình mới
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --force-recreate

# Sau khi đổi code/dependencies
docker compose --env-file .env.compose -f docker-compose.cloud.yml up -d --build

# Dừng stack
docker compose --env-file .env.compose -f docker-compose.cloud.yml down
```

`bash run.sh` → chọn **1** là cách chạy ứng dụng trực tiếp trên máy với database
cloud, web ở `http://localhost:5173`. Chọn **2/5** vẫn khởi động database local;
chúng không chuyển các URL cloud trong `.env` sang local. Không chạy ứng dụng
host và ứng dụng Docker đồng thời trên cùng cổng.
