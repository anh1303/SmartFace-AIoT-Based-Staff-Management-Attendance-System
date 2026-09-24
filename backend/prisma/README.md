# 🗄️ SmartFace Prisma & Database Documentation

> Tài liệu chi tiết về Cấu trúc Cơ sở Dữ liệu (Database Schema), Quy trình Migration, Data Seeding và Hướng dẫn thao tác với Prisma ORM trong dự án **SmartFace AIoT**.

---

## 🛠 Tổng Quan Công Nghệ

- **Database Engine**: PostgreSQL 16 (Hỗ trợ `UUID`, `pgvector` cho 512-D face embeddings, `Timestamptz`).
- **ORM**: Prisma ORM (v6.4 / v5.20+).
- **Driver**: `prisma-client-js`.
- **Database URL format**: `postgresql://<user>:<password>@<host>:<port>/<database_name>`

---

## 📁 Cấu Trúc Thư Mục `prisma/`

```text
backend/prisma/
├── migrations/             # Lịch sử các bản SQL Migration được sinh tự động
│   └── 2026xxxxxx_init/    # Bản migration khởi tạo ban đầu
├── schema.prisma           # File định nghĩa 13 Models Database Schema chính
├── seed.ts                 # Script nạp dữ liệu mẫu ban đầu (Roles, Admin, Staff, Shifts...)
└── README.md               # 📖 Tài liệu chi tiết Cơ sở Dữ liệu & Prisma (File này)
```

---

## 🧱 Chi Tiết 13 Models Trong `schema.prisma`

### 1. Phân Hệ Người Dùng & Phân Quyền (Auth & Access Control)
- **`roles`** (`roles`): Danh mục các vai trò trong hệ thống (`ADMIN`, `MANAGER`, `EMPLOYEE`).
- **`User`** (`users`): Tài khoản đăng nhập hệ thống, chứa mật khẩu mã hóa Bcrypt và liên kết 1-1 với `Employee`.

### 2. Phân Hệ Nhân Sự & Tổ Chức (Employee & Organization)
- **`Department`** (`departments`): Danh mục phòng ban (Kỹ thuật, Nhân sự, R&D, Kinh doanh...).
- **`Employee`** (`employees`): Hồ sơ chi tiết nhân viên (Mã NV, Họ tên, Chức vụ, Email, Lương theo giờ, Trạng thái).

### 3. Phân Hệ Sinh Trắc Học (Biometrics & AI)
- **`face_embeddings`** (`face_embeddings`): Lưu trữ mảng vector float đặc trưng gương mặt (512 chiều từ ArcFace), điểm chất lượng `quality_score` và nhãn tư thế `sample_tag`.

### 4. Phân Hệ Điểm Danh & Chấm Công (Attendance & Tracking)
- **`attendance_logs`** (`attendance_logs`): Ghi lại từng giao dịch Check-in / Check-out điểm danh qua gương mặt (`FACE`) hoặc vân tay (`FINGERPRINT`), điểm `liveness_score` chống giả mạo.
- **`daily_attendance_summary`** (`daily_attendance_summary`): Bảng tổng hợp dữ liệu ngày của từng nhân viên (Giờ vào đầu tiên, Giờ ra cuối cùng, Tổng giờ làm, Giờ trễ/về sớm, Trạng thái đi làm).

### 5. Phân Hệ Quản Lý Ca Làm Việc (Work Shifts)
- **`work_shifts`** (`work_shifts`): Danh mục định nghĩa ca làm mẫu (Ca hành chính, Ca sáng, Ca chiều, Ca đêm).
- **`employee_shifts`** (`employee_shifts`): Lịch phân ca chi tiết từng ngày cho từng nhân viên.

### 6. Phân Hệ Tính Lương & Chính Sách (Payroll Engine)
- **`PayrollRecord`** (`payroll_records`): Bảng lương tính toán hàng tháng của nhân viên (Tổng giờ làm, OT, tiền phạt trễ, phụ cấp, lương thực nhận, trạng thái chốt sổ `PENDING`/`FINALIZED`).
- **`BonusPenalty`** (`bonus_penalty`): Chính sách quy định tỷ lệ nhân lương tăng ca (OT rate) và mức phạt đi trễ / về sớm.

### 7. Phân Hệ Thiết Bị & Kiểm Thử (Devices & Audit)
- **`Device`** (`devices`): Danh sách thiết bị AIoT Edge Camera / ESP32 Node, IP address và trạng thái kết nối (`ONLINE`/`OFFLINE`).
- **`AuditLog`** (`audit_logs`): Ghi lại nhật ký các thao tác tạo/sửa/xóa dữ liệu quan trọng của người dùng.

---

## ⚡ Các Lệnh Prisma Thường Dùng (Prisma CLI Cheat Sheet)

| Thao tác | Câu lệnh Terminal | Mô tả chi tiết |
| :--- | :--- | :--- |
| **Generate Client** | `npx prisma generate` | Biên dịch lại `@prisma/client` SDK sau khi sửa `schema.prisma` |
| **Create Migration** | `npx prisma migrate dev --name <migration_name>` | Tạo và áp dụng bản migration SQL mới lên DB |
| **Run Seed Data** | `npx prisma db seed` *(hoặc `npm run prisma:seed`)* | Thực thi file `prisma/seed.ts` để nạp dữ liệu mẫu |
| **Open Studio GUI** | `npx prisma studio` *(hoặc `npm run prisma:studio`)* | Bật giao diện web đồ họa truy vấn dữ liệu trực quan tại `localhost:5555` |
| **Format Schema** | `npx prisma format` | Tự động căn chỉnh & format lại syntax file `schema.prisma` |
| **Push Schema DB** | `npx prisma db push` | Đẩy trực tiếp schema lên DB không tạo file migration history (dành cho thử nghiệm) |

---

## 🌱 Quy Trình Seed Dữ Liệu Mẫu (`seed.ts`)

File [seed.ts](file:///e:/PBL6/SmartFace-AIoT-Based-Staff-Management-Attendance-System/backend/prisma/seed.ts) tự động nạp sẵn dữ liệu chuẩn cho môi trường Development:

1. **3 Roles mẫu**: `ADMIN`, `MANAGER`, `EMPLOYEE`.
2. **3 Tài khoản mẫu**:
   - `admin` (Mật khẩu: `Admin@123`)
   - `manager` (Mật khẩu: `Manager@123`)
   - `staff01` (Mật khẩu: `Staff@123`)
3. **4 Phòng ban**: Phòng Kỹ Thuật, Phòng Nhân Sự, Phòng Kinh Doanh, Phòng R&D.
4. **6 Hồ sơ nhân viên mẫu** kèm theo lịch ca làm việc và dữ liệu vector đặc trưng gương mặt.
5. **Dữ liệu chấm công lịch sử & Bảng lương mẫu**.

Khởi chạy seed bất cứ lúc nào bằng lệnh:
```bash
npm run prisma:seed
```

---

## 🛡️ Best Practices Khi Cập Nhật Schema

1. Luôn chỉnh sửa cấu trúc bảng trong file [`schema.prisma`](file:///e:/PBL6/SmartFace-AIoT-Based-Staff-Management-Attendance-System/backend/prisma/schema.prisma).
2. Chạy `npx prisma format` để đảm bảo định dạng file chuẩn xác.
3. Chạy `npx prisma migrate dev --name update_feature_name` để tạo bản migration mới.
4. Kiểm tra mã nguồn TypeScript để đảm bảo không bị lỗi sai kiểu dữ liệu khi gọi `prisma.<model>`.
