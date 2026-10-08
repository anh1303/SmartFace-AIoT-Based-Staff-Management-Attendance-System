# 🗄️ SmartFace Prisma & Database Documentation

> Tài liệu chi tiết về Cấu trúc Cơ sở Dữ liệu (Database Schema), Quy trình Thiết lập trên Cloud (Neon Serverless PostgreSQL + `pgvector`), Quản lý Migration, Data Seeding và Hướng dẫn Kiểm tra Dữ liệu trong dự án **SmartFace AIoT**.

---

## 🛠 1. Tổng Quan Công Nghệ & Hạ Tầng CSDL

- **Database Engine**: PostgreSQL 16 (Hỗ trợ `UUID`, extension `pgvector` v0.8.6 cho 512-D face embeddings, `Timestamptz`).
- **Cloud Database Provider**: **Neon Serverless PostgreSQL** (Region: Singapore `ap-southeast-1` cho độ trễ thấp nhất).
- **ORM**: Prisma ORM (v5.20 / v5.22).
- **Driver**: `prisma-client-js` & `psycopg_pool` (Python AI Service).
- **Kiến trúc kết nối kép (Dual-Connection Architecture)**:
  - **Pooled Connection (`DATABASE_URL`)**: Kết nối qua PgBouncer của Neon, tối ưu kết nối đồng thời cho Backend REST API và Python Service.
  - **Direct Connection (`DIRECT_URL`)**: Kết nối trực tiếp tới Postgres Compute node (Port 5432), phục vụ cho các tác vụ DDL, Prisma Migration, Prisma Studio và Backup (`pg_dump`).

---

## 📁 2. Cấu Trúc Thư Mục `prisma/`

```text
backend/prisma/
├── migrations/                                       # Lịch sử các bản SQL Migration
│   ├── 20260924164121_init/                          # Bản migration khởi tạo ban đầu (14 bảng, extension vector, sequences)
│   ├── 20260930143422_add_embedding_type_to_face_embeddings/ # Bổ sung embedding_type (SAMPLE / CENTROID)
│   └── 20261001120000_rebuild_face_embeddings_contract/      # Chuẩn hóa vector(512), index HNSW và constraint
├── schema.prisma                                     # File định nghĩa Database Schema & datasource
├── seed.ts                                           # Script nạp dữ liệu mẫu ban đầu (Roles, Admin, Staff, Shifts...)
└── README.md                                         # 📖 Tài liệu chi tiết CSDL & Hướng dẫn Cloud (File này)
```

---

## 🧱 3. Chi Tiết 14 Models Trong `schema.prisma`

### 1. Phân Hệ Người Dùng & Phân Quyền (Auth & Access Control)
- **`roles`** (`roles`): Danh mục các vai trò trong hệ thống (`ADMIN`, `MANAGER`, `EMPLOYEE`).
- **`User`** (`users`): Tài khoản đăng nhập hệ thống, chứa mật khẩu mã hóa Bcrypt và liên kết 1-1 với `Employee`.

### 2. Phân Hệ Nhân Sự & Tổ Chức (Employee & Organization)
- **`Department`** (`departments`): Danh mục 4 phòng ban chuẩn (`Quản lý`, `Thu ngân`, `Nhân viên`, `Bảo vệ`).
- **`Employee`** (`employees`): Hồ sơ chi tiết nhân viên (Mã NV, Họ tên, Chức vụ, Email, Lương theo giờ, Trạng thái).

### 3. Phân Hệ Sinh Trắc Học & AI (Biometrics & Vector Search)
- **`face_embeddings`** (`face_embeddings`): Lưu trữ vector 512 chiều từ mô hình ArcFace sử dụng kiểu dữ liệu `pgvector vector(512)`, kèm chỉ mục tìm kiếm siêu nhanh `HNSW index` (`vector_cosine_ops`), phân loại vector (`SAMPLE` / `CENTROID`), điểm chất lượng `quality_score` và nhãn tư thế `sample_tag`.

### 4. Phân Hệ Điểm Danh & Chấm Công (Attendance & Tracking)
- **`attendance_logs`** (`attendance_logs`): Ghi lại từng giao dịch Check-in / Check-out điểm danh qua gương mặt (`FACE`) hoặc vân tay (`FINGERPRINT`), điểm `liveness_score` chống giả mạo.
- **`daily_attendance_summary`** (`daily_attendance_summary`): Bảng tổng hợp dữ liệu ngày của từng nhân viên (Giờ vào đầu tiên, Giờ ra cuối cùng, Tổng giờ làm `total_working_hours`, Giờ đi trễ/về sớm `late_early` và Giờ tăng ca `overtime` thống nhất toàn hệ thống theo đơn vị **Giờ** `Decimal(5,2)`).
- **`attendance_locks`** (`attendance_locks`): Lưu trữ trạng thái khóa chốt dữ liệu điểm danh theo từng ngày (`work_date`, `is_locked`, `locked_at`, `locked_by`).

### 5. Phân Hệ Quản Lý Ca Làm Việc (Work Shifts)
- **`work_shifts`** (`work_shifts`): Danh mục định nghĩa ca làm mẫu (Ca hành chính, Ca sáng, Ca chiều, Ca đêm).
- **`employee_shifts`** (`employee_shifts`): Lịch phân ca chi tiết từng ngày cho từng nhân viên.

### 6. Phân Hệ Tính Lương & Chính Sách (Payroll Engine)
- **`PayrollRecord`** (`payroll_records`): Bảng lương tính toán hàng tháng của nhân viên (Tổng giờ làm, OT, tiền phạt trễ, phụ cấp, lương thực nhận, trạng thái chốt sổ `PENDING`/`FINALIZED`).
- **`BonusPenalty`** (`bonus_penalty`): Chính sách quy định tỷ lệ nhân lương tăng ca (OT rate) và mức phạt đi trễ / về sớm.

### 7. Phân Hệ Thiết Bị & Kiểm Thử (Devices & Audit)
- **`Device`** (`devices`): Danh sách thiết bị AIoT Edge Camera / ESP32 Node, IP address và trạng thái kết nối (`ONLINE`/`OFFLINE`/`MAINTENANCE`).
- **`AuditLog`** (`audit_logs`): Ghi lại nhật ký các thao tác tạo/sửa/xóa dữ liệu quan trọng của người dùng.

---

## ☁️ 4. Quy Trình Thiết Lập Cơ Sở Dữ Liệu Trên Neon Cloud

### Bước 1: Khởi tạo Project trên Neon Console
1. Truy cập [Neon Console](https://console.neon.tech/) và tạo project mới.
2. Chọn phiên bản **PostgreSQL 16** (hoặc 17), Region **Singapore (`ap-southeast-1`)**.
3. Tại trang **Connection Details**, sao chép 2 chuỗi kết nối:
   - **Pooled URL** (bật tick *Connection Pooling*):
     `postgresql://<user>:<password>@<endpoint>-pooler.ap-southeast-1.aws.neon.tech/<dbname>?sslmode=require`
   - **Direct URL** (bỏ tick *Connection Pooling*):
     `postgresql://<user>:<password>@<endpoint>.ap-southeast-1.aws.neon.tech/<dbname>?sslmode=require`

### Bước 2: Khai báo trong `schema.prisma`
Đảm bảo [schema.prisma](file:///e:/PBL6/SmartFace-AIoT-Based-Staff-Management-Attendance-System/backend/prisma/schema.prisma) hỗ trợ `directUrl` cho migration:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}
```

### Bước 3: Cấu hình biến môi trường `.env`
- Trong file `backend/.env`:
  ```env
  DATABASE_URL="postgresql://<USER>:<PASS>@<ENDPOINT>-pooler.ap-southeast-1.aws.neon.tech/PBL6?sslmode=require"
  DIRECT_URL="postgresql://<USER>:<PASS>@<ENDPOINT>.ap-southeast-1.aws.neon.tech/PBL6?sslmode=require"
  ```
- Trong file `face_auth/.env`:
  ```env
  DATABASE_URL="postgresql://<USER>:<PASS>@<ENDPOINT>-pooler.ap-southeast-1.aws.neon.tech/PBL6?sslmode=require"
  ```

### Bước 4: Thực thi Migration DDL lên Cloud
```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```
*Kết quả:* Cả 3 bản migration sẽ được áp dụng lần lượt; extension `vector` được kích hoạt và index HNSW được khởi tạo tự động.

### Bước 5: Nạp dữ liệu mẫu (Seeding)
```bash
npm run prisma:seed
```
*Script sẽ tự động khởi tạo:*
- 3 Roles (`ADMIN`, `MANAGER`, `EMPLOYEE`).
- 4 Phòng ban & 3 Ca làm việc.
- 3 Tài khoản quản trị (`admin`, `manager`, `employee` - Mật khẩu: `Admin@123456`).
- 6 Nhân viên mẫu (`NV-001` đến `NV-006`) và đồng bộ `employee_code_seq`.
- Ca làm việc, Chấm công lịch sử, Bảng lương, Audit logs và Khóa chấm công.

---

## 🔍 5. Hướng Dẫn Kiểm Tra & Quản Lý Dữ Liệu

### 1. Kiểm tra trực quan với Prisma Studio
```bash
npm run prisma:studio
```
Truy cập `http://localhost:5555` để xem và chỉnh sửa trực tiếp các bảng nghiệp vụ (`users`, `employees`, `attendance_logs`, `payroll_records`...).

> ⚠️ **Lưu ý quan trọng:** Prisma Studio web UI có giới hạn khi deserialize kiểu dữ liệu tùy biến từ extension như `vector(512)`. Hãy dùng Neon SQL Editor hoặc `psql` để xem/truy vấn cột `embedding` của bảng `face_embeddings`.

### 2. Kiểm tra Extension `pgvector` & Kiểu `vector(512)` qua SQL
Thực thi trên Neon SQL Editor hoặc `psql`:
```sql
-- 1. Kiểm tra extension pgvector
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 2. Kiểm tra chính xác kiểu dữ liệu vector(512)
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS data_type 
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid 
WHERE c.relname = 'face_embeddings' AND a.attname = 'embedding';

-- 3. Kiểm tra chỉ mục HNSW
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'face_embeddings' AND indexname = 'idx_face_embeddings_embedding_hnsw';
```

### 3. Kiểm tra Truy vấn Cosine Distance (`<=>`)
Sau khi đã đăng ký ít nhất 1 khuôn mặt CENTROID cho nhân viên:
```sql
SELECT 
    e.employee_code, 
    e.full_name, 
    1 - (f.embedding <=> '<VECTOR_512D>'::vector) AS similarity
FROM face_embeddings f
JOIN employees e ON e.id = f.employee_id
WHERE f.embedding_type = 'CENTROID' AND f.is_active = true
ORDER BY f.embedding <=> '<VECTOR_512D>'::vector
LIMIT 5;
```

### 4. Kiểm tra Sequence Mã Nhân Viên (`employee_code_seq`)
```sql
SELECT sequencename, last_value FROM pg_sequences WHERE sequencename = 'employee_code_seq';
```

---

## 🛡️ 6. Các Lưu Ý Vận Hành Quan Trọng (Production Safeguards)

1. **Cảnh báo về Migration 3 (`rebuild_face_embeddings_contract`):**
   - Bản migration này có câu lệnh `DELETE FROM "face_embeddings";`. 
   - Lệnh này hoàn toàn an toàn khi khởi tạo DB mới rỗng, nhưng **tuyệt đối không được re-run hoặc reset tùy tiện trên database production đã có dữ liệu khuôn mặt thật**.
2. **Neon Serverless Auto-suspend (Cold Start):**
   - Neon sẽ tự động đưa compute node về trạng thái ngủ sau thời gian không có truy vấn. Lần request đầu tiên sẽ mất khoảng ~1s để wake up. Thêm `&connect_timeout=15` vào connection string nếu cần nới rộng thời gian chờ kết nối.
3. **Sao lưu dữ liệu định kỳ (Backup):**
   - Sử dụng `DIRECT_URL` (không dùng Pooled URL) khi chạy `pg_dump`:
     ```bash
     pg_dump "<DIRECT_URL>" -F c -b -v -f smartface_neon_backup.dump
     ```
4. **Bảo mật biến môi trường:**
   - Luôn thêm `.env`, `.env.local` vào `.gitignore`.
   - Giữ tham số `sslmode=require` trong connection string kết nối tới Neon Cloud.
