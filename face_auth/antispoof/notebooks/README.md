# Notebook nghiên cứu PAD

Notebook khám phá dữ liệu, huấn luyện, tìm cấu hình và đánh giá chống giả mạo khuôn mặt. Notebook nghiên cứu không phải entry point API/Pi.

## Nhóm hiện có

| Thư mục | Vai trò |
| --- | --- |
| [eda/](eda/) | Khám phá dữ liệu và chẩn đoán detector |
| [micro_frequency_search/](micro_frequency_search/) | Thử nghiệm biểu diễn miền tần số quy mô nhỏ |
| [final/](final/) | Tài nguyên/notebook giai đoạn cuối; có thể chỉ có trên máy |

Notebook full-scale còn được lưu tại [source_of_truth/notebooks](../../md/source_of_truth/notebooks/). Không mặc định các nhánh E1/E2/E3 cũ vẫn có notebook trong bản checkout mới.

## Trước khi chạy

- Đọc cell cấu hình, protocol và đường dẫn dữ liệu của notebook; không có một lệnh chung cho mọi thử nghiệm.
- Xác nhận runtime, dependencies, GPU/CPU, dung lượng và quyền truy cập dataset.
- Giữ seed, manifest, split, preprocessing và phiên bản model/dữ liệu khi tái lập.
- Tách train/validation/test; không dùng test chính thức để chọn threshold hoặc tham số.

Notebook mở được chưa chứng minh đã chạy hoàn tất. Sử dụng kết quả cần đối chiếu output, checkpoint và báo cáo nguồn tương ứng.

## Kết quả và triển khai

- [Báo cáo/output nguồn](../../md/source_of_truth/README.md).
- [Artifact nghiên cứu](../models/smartface_pad_artifacts/README.md).
- [Hợp đồng PAD runtime](../../md/runtime/pad_runtime_config.md).

Cấu hình triển khai phải khớp ONNX, nhãn và preprocessing. Không chọn model từ nhãn “active” hoặc độ trễ trong README của thực nghiệm cũ.
