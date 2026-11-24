# Kho artifact nghiên cứu PAD

Artifact để đối chiếu và tái lập. Tên thư mục phản ánh nhánh nghiên cứu, không chỉ định model API/Pi đang sử dụng.

## Nhóm hiện có

| Thư mục | Nhóm thực nghiệm |
| --- | --- |
| [E1_v5_3_mnv3_small/](E1_v5_3_mnv3_small/) | Không gian MobileNetV3-Small |
| [E2_dct_v1/](E2_dct_v1/) | Miền tần số DCT |
| [E3_concat_v1/](E3_concat_v1/) | Kết hợp không gian và tần số |
| [cross_dataset_v1/](cross_dataset_v1/) | Đánh giá khác miền |

Một số thư mục có thể rỗng hoặc chỉ tồn tại cục bộ do quy tắc ignore. Cây thư mục không chứng minh mọi checkpoint/kết quả đã được đóng gói trong Git.

## Nội dung giữ cùng run

- Notebook/mã chạy, cấu hình và seed.
- Manifest, dataset và split.
- Checkpoint, phiên bản/hash và log huấn luyện/đánh giá.
- Dự đoán, bảng kết quả và protocol tính chỉ số.
- Nếu xuất triển khai: ONNX, runtime JSON, thứ tự nhãn và preprocessing.

Chỉ so sánh run có protocol tương thích. Số tham số, kích thước file và độ trễ phải lấy từ artifact/môi trường đo; README không duy trì bản sao bảng benchmark.

## Chọn artifact triển khai

Đối chiếu [config.py](../../../config.py), môi trường và [hợp đồng PAD runtime](../../../md/runtime/pad_runtime_config.md). Model runtime còn nằm trực tiếp tại thư mục cha `antispoof/models/`; kho archive này không đại diện toàn bộ model triển khai.

[Báo cáo nguồn](../../../md/source_of_truth/README.md) giữ số liệu/provenance; [chỉ mục notebook](../../notebooks/README.md) giúp tìm thử nghiệm. Giữ model/data versions và train/validation/test split khi tái lập.
