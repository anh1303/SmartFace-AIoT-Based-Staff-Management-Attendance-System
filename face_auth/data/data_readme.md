# Dữ liệu nghiên cứu Face Auth

Dữ liệu cục bộ cho đánh giá/benchmark. LFW là lựa chọn nghiên cứu nhận diện, không bắt buộc để chạy API và không thay gallery nhân viên đã đăng ký.

## Chuẩn bị

Tải LFW từ nguồn phân phối mà bạn có quyền sử dụng, đọc điều kiện truy cập/sử dụng và kiểm tra phiên bản trước khi giải nén. Ghi nguồn, phiên bản, checksum và protocol cho mỗi thực nghiệm.

Cấu trúc cục bộ dự kiến:

```text
data/
├── data_readme.md
├── lfw/
│   └── <identity>/
│       └── <image>.jpg
└── lfw_metadata/
    └── <metadata>.csv
```

`lfw/`, `lfw_metadata/` được ignore; checkout mới không tự có dataset. Số ảnh/metadata phụ thuộc gói tải và bước chuẩn bị; đối chiếu manifest nguồn đã chọn.

## Kiểm tra tại máy

Chạy từ `face_auth/`:

```sh
python -c "from pathlib import Path; p=Path('data/lfw'); print('identities:', sum(d.is_dir() for d in p.iterdir()) if p.exists() else 0); print('jpg:', sum(1 for _ in p.rglob('*.jpg')))"
```

Lệnh chỉ đếm file/thư mục, không xác nhận nhãn, split, checksum hoặc chất lượng ảnh. Đọc notebook/script sử dụng dữ liệu để xác định đường dẫn/metadata chính xác.

## Đánh giá

Tách enrollment/gallery và dữ liệu đánh giá theo protocol. Chọn threshold trên tập phù hợp, không tối ưu bằng test chính thức. Không đưa ảnh/embedding nghiên cứu vào database nhân viên đang vận hành.

Xem [Face Auth](../README.md), [notebook PAD](../antispoof/notebooks/README.md) và [báo cáo nguồn](../md/source_of_truth/README.md). LFW dùng cho nhận diện danh tính, không tự cung cấp protocol đánh giá tấn công giả mạo PAD.
