# Kết quả thực nghiệm Face Auth

Kho báo cáo, notebook và output để truy vết thực nghiệm PAD. Model trong ứng dụng vẫn do `config.py`, môi trường và runtime JSON quyết định.

## Báo cáo nguồn

| Tài liệu | Nội dung |
| --- | --- |
| [FULLSCALE_RESULTS_SOURCE_OF_TRUTH.md](FULLSCALE_RESULTS_SOURCE_OF_TRUTH.md) | Kết quả/provenance theo phương pháp và run |
| [FULLSCALE_3SEEDS_SUMMARY_REPORT.md](FULLSCALE_3SEEDS_SUMMARY_REPORT.md) | Tổng hợp nhiều seed; xem tập seed và quy ước thống kê từng bảng |
| [R7_HARMFUL_GATE_ABLATION_SOURCE_OF_TRUTH.md](R7_HARMFUL_GATE_ABLATION_SOURCE_OF_TRUTH.md) | Ablation của harmful gate |
| [Hướng dẫn checkpoint ngày 27/10/2026](MAST_PAD_THREE_SEED_SELECTED_CHECKPOINT_REVISION_GUIDE_2026-10-27.md) | Đối chiếu checkpoint được chọn và sửa báo cáo |
| [ADAPTIVE_PAD_TARGET_DOMAIN_SOURCE_OF_TRUTH.md](ADAPTIVE_PAD_TARGET_DOMAIN_SOURCE_OF_TRUTH.md) | Hồ sơ PAD adaptive trên miền đích |

[notebooks/](notebooks/) giữ notebook nguồn; [outputs/](outputs/) giữ artifact theo nhóm notebook/seed. File nén, mảng lớn và một số dữ liệu cục bộ có thể không được theo dõi trong Git.

## Đối chiếu và cập nhật

1. Xác định notebook, phương pháp, run ID, seed, dataset/split và checkpoint trước khi lấy số liệu.
2. Đối chiếu output gốc, manifest và hash nếu có. Tên “source of truth” không thay bước kiểm chứng artifact.
3. Giữ riêng frame-level, video-level, threshold cố định và threshold hiệu chỉnh; không gộp protocol khác nhau.
4. Ghi đúng số seed và quy ước độ lệch chuẩn. Không chép lại bảng số vào README để tránh nhiều bản lệch nhau.
5. Khi thêm run, giữ notebook/config/manifest, phiên bản dữ liệu và checkpoint; cập nhật báo cáo nguồn liên quan.

Không đổi seed/split hoặc điều chỉnh threshold trên tập test để khớp bảng báo cáo. Không có bước checkout, commit hoặc push tự động khi cập nhật tài liệu.

Xem [chỉ mục tài liệu](../README.md) và [quy tắc nghiên cứu](../../AGENTS.md).
