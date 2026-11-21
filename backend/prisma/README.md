# Database và Prisma

Backend dùng PostgreSQL với extension `vector`, một Prisma Client và schema chia theo nghiệp vụ. Mọi lệnh bên dưới chạy tại `backend/`.

## Cấu trúc

```text
prisma/
├── schema/
│   ├── schema.prisma       # Generator và datasource
│   └── domains/            # Models/enums theo nghiệp vụ
├── migrations/             # Lịch sử migration dùng chung
├── seeds/                  # Seed nền, phân ca và chấm công
└── README.md
```

[package.json](../package.json) trỏ Prisma CLI tới `prisma/schema/`. Không dùng đường dẫn schema/seed cũ hoặc chạy Prisma ở thư mục gốc repository.

## Kết nối

Tạo `backend/.env` từ [mẫu](../.env.example):

- `DATABASE_URL`: kết nối ứng dụng.
- `DIRECT_URL`: kết nối trực tiếp tới cùng database/schema để chạy migration.

Neon có thể cung cấp URL pooler/direct khác nhau. Đối chiếu database đích trước khi thay đổi schema hoặc seed.

## Các lệnh

```sh
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

| Lệnh | Tác dụng |
| --- | --- |
| `prisma:generate` | Sinh client; không áp dụng migration |
| `prisma:migrate` | Chạy `prisma migrate deploy`, áp dụng migrations đã có |
| `prisma:studio` | Mở công cụ xem/sửa dữ liệu, mặc định cổng 5555 |

Khi thay schema trên database phát triển riêng, dùng CLI cài trong backend để tạo migration. Kiểm tra SQL trước khi áp dụng ở môi trường khác. Không dùng `db push` hoặc reset để thay lịch sử migration của database đang vận hành.

## Phân chia dữ liệu

[schema/domains/](schema/domains/) bao gồm auth, employees, attendance, shifts, payroll, biometrics, devices, operations, notifications, inquiries và audit. Tách file không tạo nhiều database hoặc nhiều Prisma Client.

Vector khuôn mặt dùng kiểu `vector`; chỉ mục và SQL đặc thù nằm trong migrations. Giữ nhất quán embedding version giữa Python, backend và dữ liệu đã đăng ký khi nâng cấp mô hình.

## Seed và bảo trì

[Hướng dẫn seed](seeds/README-SEED.md) mô tả thứ tự và ảnh hưởng dữ liệu. Seed không bắt buộc mỗi lần khởi động.

Script bảo trì nằm trong `backend/scripts/`, gồm kiểm tra database, đối chiếu snapshot, benchmark và sửa đơn giá lương. Đọc mã, phạm vi dữ liệu và rollback trước khi chạy; không thay thao tác nghiệp vụ bằng seed hoặc script sửa dữ liệu.

## Kiểm tra

```sh
npm run prisma:generate
npm run build
```

Các lệnh kiểm tra sinh client và biên dịch, không xác nhận migrations đã áp dụng trên server cụ thể. Test tích hợp dùng database cô lập theo [README backend](../README.md).
