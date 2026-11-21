# Tài liệu Face Auth

Danh mục tài liệu runtime và nghiên cứu. Cài/chạy: [README Face Auth](../README.md). Quy tắc thay đổi nghiên cứu: [AGENTS.md](../AGENTS.md).

## Runtime

- [PAD runtime config](runtime/pad_runtime_config.md): hợp đồng model, preprocessing và cấu hình.
- [Crop smoothing](runtime/pad_crop_smoothing_experiment.md): hành vi, cách bật/tắt và giới hạn kiểm chứng.
- [Đề xuất hợp nhất database](runtime/database_unification_proposal.md): hồ sơ đề xuất, không xác nhận đã triển khai.

Cấu hình hiệu lực cần đối chiếu [config.py](../config.py), môi trường và artifact đang nạp. Tên model trong báo cáo cũ không xác định model đang chạy.

## Nghiên cứu và số liệu

- [Source of truth](source_of_truth/README.md): báo cáo, notebook và output từng run.
- [Notebook PAD](../antispoof/notebooks/README.md).
- [Kho artifact](../antispoof/models/smartface_pad_artifacts/README.md).

`research/` chứa thiết kế/nghiên cứu; `plan/` chứa kế hoạch/đánh giá chỉnh sửa; `archive/` giữ ngữ cảnh lịch sử. Một số tài liệu/dataset/output được ignore nên có thể chỉ tồn tại trên máy nghiên cứu.

## Cách sử dụng

Dùng báo cáo nguồn cùng notebook, run ID, seed, manifest và checkpoint tương ứng khi trích số liệu. Phân biệt huấn luyện, kiểm thử độc lập và đo camera/runtime. Không dùng test chính thức để chọn threshold hoặc preprocessing.

Tài liệu có ngày là snapshot. Kiểm tra artifact và trạng thái triển khai trước khi làm theo; vị trí trong `source_of_truth/` không tự chứng minh nội dung đã hoàn thành.
