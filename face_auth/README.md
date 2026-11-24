# SmartFace Face Auth

Dịch vụ Python xử lý khuôn mặt và chống giả mạo (PAD), gồm API FastAPI và ứng dụng camera OpenCV. Pipeline sử dụng detector, căn chỉnh khuôn mặt, embedding ArcFace, tracking và PAD theo cấu hình runtime.

Backend sở hữu nghiệp vụ chấm công. Python không trực tiếp ghi nhật ký chấm công để thay thế backend.

## Yêu cầu

- Python 3.11 cho API, tương ứng [Dockerfile](Dockerfile).
- Thư viện theo [requirements.txt](requirements.txt); API dùng thêm [constraints](requirements-api-constraints.txt).
- ONNX và runtime JSON tương ứng; một số model/dataset/artifact cần tải riêng hoặc chỉ có cục bộ.
- PostgreSQL/pgvector khi enrollment hoặc tìm kiếm nhận diện.
- Camera và desktop GUI khi chạy `app.py`; API không cần mở camera.

## Cài đặt

Từ thư mục gốc:

```sh
cd face_auth
python -m venv .venv
```

Kích hoạt trên Linux/macOS:

```sh
source .venv/bin/activate
```

Hoặc trên PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Cài môi trường API theo Dockerfile:

```sh
python -m pip install cython setuptools wheel
python -m pip install --no-build-isolation -r requirements.txt -c requirements-api-constraints.txt
```

Sao chép [.env.example](.env.example) thành `.env`. Cấu hình `DATABASE_URL`, `MODEL_PACK_NAME`, `EMBEDDING_MODEL_VERSION`, `FACE_AUTH_INTERNAL_KEY` và PAD phù hợp với môi trường. Dùng cùng internal key/embedding version với backend.

## Chạy API

Chạy tại `face_auth/`, trong môi trường Python đã cài dependencies:

```sh
python -m uvicorn api_service:app --host 127.0.0.1 --port 5000
```

| Endpoint | Vai trò |
| --- | --- |
| `GET /health/live` | Kiểm tra tiến trình |
| `GET /health/ready` | Kiểm tra trạng thái sẵn sàng |
| `GET /health` | Health tổng hợp/tương thích |
| `POST /internal/enroll` | Xử lý đăng ký khuôn mặt |
| `POST /internal/face-embedding` | Trích xuất embedding nội bộ |

API nội bộ yêu cầu xác thực theo [api_service.py](api_service.py). Face login có router/phiên xử lý riêng trong `face_login/`, bật qua `FACE_LOGIN_ENABLED` theo cấu hình triển khai. Không công khai trực tiếp API nội bộ ra Internet.

## Chạy camera

```sh
python app.py --camera 0
```

`--no-fps` tắt hiển thị FPS. `--no-pad` chỉ dùng chẩn đoán; kết quả đó không kiểm chứng chống giả mạo. Không đổi threshold/model chỉ để tăng tỷ lệ nhận diện.

Cấu hình hiệu lực nằm trong [config.py](config.py). Đọc [hợp đồng PAD runtime](md/runtime/pad_runtime_config.md) trước khi chọn `PAD_RUNTIME_CONFIG_PATH` hoặc adaptive config. JSON phải khớp ONNX, preprocessing, nhãn và cách tính điểm; tên model trong báo cáo cũ không xác định model đang chạy.

## Mã nguồn và tài liệu

- `api_service.py`: API và vòng đời tài nguyên.
- `detection/`, `alignment/`, `recognition/`, `tracking/`, `antispoof/`: pipeline thị giác.
- `database/`, `enrollment/`, `face_login/`: dữ liệu, đăng ký và đăng nhập.
- [Tài liệu](md/README.md), [notebook](antispoof/notebooks/README.md), [artifact nghiên cứu](antispoof/models/smartface_pad_artifacts/README.md).
- [LFW](data/data_readme.md) là dữ liệu nghiên cứu tùy chọn, không bắt buộc để chạy API.

## Kiểm tra offline

```sh
python -m unittest tests.test_runtime tests.test_tracker tests.test_recognition_worker tests.test_enrollment_math tests.test_enrollment_operation tests.test_identity_display tests.test_detection tests.test_vector_db_logic
```

Chạy tại `face_auth/`. Trên Windows, nếu subprocess/log tiếng Việt lỗi mã hóa, đặt `PYTHONUTF8=1` và `PYTHONIOENCODING=utf-8`. Test offline không thay thế đánh giá camera/phần cứng thật.
