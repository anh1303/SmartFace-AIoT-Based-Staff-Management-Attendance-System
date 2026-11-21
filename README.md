# SmartFace AIoT

Hệ thống quản lý nhân sự và chấm công bằng khuôn mặt/vân tay, gồm ứng dụng web, API nghiệp vụ, dịch vụ xử lý khuôn mặt và thiết bị Raspberry Pi.

## Thành phần

| Thư mục | Vai trò | Hướng dẫn |
| --- | --- | --- |
| `frontend/` | React, TypeScript, Vite; giao diện quản trị và nhân viên | [Frontend](frontend/README.md) |
| `backend/` | Express, Prisma; nhân sự, công, ca, lương và realtime | [Backend](backend/README.md) |
| `face_auth/` | FastAPI, OpenCV, ONNX Runtime; sinh trắc học và PAD | [Face Auth](face_auth/README.md) |
| `hardware/` | Camera, cảm biến và giao tiếp thiết bị trên Pi | [Hardware](hardware/README.md) |
| `docs/` | Quy định nghiệp vụ, kiến trúc và vận hành | [Tài liệu](docs/README.md) |

Backend xử lý nghiệp vụ và ghi nhận chấm công. Frontend gọi API/Socket.IO; Python xử lý sinh trắc học. Pi kết nối theo cấu hình HTTP/ThingsBoard của thiết bị.

## Yêu cầu

- Node.js 22 và npm cho backend/frontend, tương ứng Dockerfile của hai thành phần.
- Python 3.11 cho API Face Auth, tương ứng Dockerfile của dịch vụ.
- PostgreSQL có extension `vector`, chạy riêng tại máy hoặc trên cloud.
- Raspberry Pi OS 64-bit và phần cứng tương ứng nếu chạy `hardware/`.

Cài dependencies riêng cho từng thành phần bằng manifest/lockfile tương ứng. Prisma CLI và schema của ứng dụng nằm tại `backend/`; chạy mọi lệnh Prisma tại đó.

## Chạy phát triển

1. Cài backend, tạo `.env`, cấu hình database và áp dụng migrations theo [Backend](backend/README.md).
2. Cài/chạy API Python theo [Face Auth](face_auth/README.md) nếu dùng tính năng khuôn mặt.
3. Mở terminal khác để cài/chạy [Frontend](frontend/README.md).
4. Cấu hình [Hardware](hardware/README.md) nếu cần phần cứng chấm công.

| Thành phần | Địa chỉ mặc định khi chạy trực tiếp |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3000` |
| Face Auth | `http://localhost:5000` |

Các ví dụ dùng `npm`; trên PowerShell bị chặn `npm.ps1`, dùng `npm.cmd`. Không commit `.env`, khóa truy cập hoặc dữ liệu sinh trắc học.

## Docker

Xem [stack local](docs/tutorial/deployment/run_full_stack.md), [stack dùng database cloud](docs/tutorial/deployment/run_cloud_stack.md) và [ThingsBoard/Pi](docs/tutorial/thingsboard/THINGSBOARD_PI_SETUP.md).

`docker-compose.phase1.yml` là stack riêng cho web/backend/Face Auth. Dùng cùng override `docker-compose.phase1.local-https.yml` hoặc `docker-compose.phase1.oci.yml`, với mẫu `.env.phase1.local.example` hoặc `.env.phase1.oci.example`. Không ghép base này với stack local/cloud/IoT khác.

## Kiểm tra

```sh
npm --prefix backend run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

Cách chạy các test còn được giữ lại nằm trong README từng thành phần. Test tích hợp database chỉ chạy với database kiểm thử cô lập.
