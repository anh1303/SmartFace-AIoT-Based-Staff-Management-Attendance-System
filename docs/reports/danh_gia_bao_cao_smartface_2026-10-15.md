# Đánh giá và đề xuất chỉnh sửa báo cáo PBL6 SmartFace

**Bản được đánh giá:** `bao-cao-pbl6-smartface-2026-10-14.docx`, tại `/Users/3t/Downloads/`.

**Ngày đánh giá:** 15/10/2026. **Ngữ cảnh mã nguồn:** working tree `/Users/coding/PBL6`, HEAD `320a0cc` (`update md`), có thay đổi chưa commit. Các nhận xét về triển khai là đối chiếu tĩnh với checkout này, không phải xác nhận một hệ thống đang vận hành.

**Cập nhật theo thông tin bổ sung của người dùng:** đã có kết quả CE-only trong `face_auth/md/ce_clean_fullscale_report.md`. Model đang chạy camera chỉ phục vụ thử nghiệm thực tế; **không xem việc khác model/cấu hình giữa camera và nghiên cứu là lỗi báo cáo hoặc vấn đề của kết quả nghiên cứu**. Bản đánh giá này đã cập nhật theo phạm vi đó.

**Kết luận chính:** Bản báo cáo có nội dung nghiên cứu đáng giữ và đã khá thận trọng khi diễn giải kết quả. Tuy nhiên, cần sửa một số số liệu và khẳng định thiếu bằng chứng trước khi chỉnh văn phong. Sau đó nên tổ chức lại theo mạch bài toán → yêu cầu → thiết kế → phương pháp → triển khai → đánh giá. Mục tiêu phù hợp là một báo cáo PBL6 giải thích được quyết định kỹ thuật và chứng minh được mức hoàn thành, đồng thời trình bày nghiên cứu PAD đủ sâu để bảo vệ.

## Cách sử dụng bản đánh giá

- **P0 — sửa trước khi nộp:** sai số liệu, kết luận bị ảnh hưởng, nguồn dẫn không đúng, thông tin chưa có bằng chứng nhưng được viết như đã đo.
- **P1 — sửa để báo cáo chặt chẽ:** giao thức, ranh giới tích hợp, đối chứng, kiểm thử, cách tổ chức lập luận.
- **P2 — sửa để dễ đọc:** rút gọn, chuyển phụ lục, hình thức, thuật ngữ và diễn đạt.
- **Đã xác nhận:** có đối chiếu trực tiếp với nội dung Word, mã nguồn hoặc artifact cụ thể.
- **Chưa đủ bằng chứng:** chưa tìm thấy nguồn hỗ trợ trong phạm vi đã kiểm tra; không đồng nghĩa chắc chắn chưa từng thực hiện.
- **Đề xuất:** thay đổi về cách viết hoặc thí nghiệm tiếp theo; không phải kết quả đã có.

Các số trang dưới đây lấy từ **mục lục lưu trong DOCX**, chỉ dùng định vị gần đúng. Số mục, bảng, hình là mốc chính xác hơn vì phân trang có thể đổi khi mở Word.

### Phạm vi kiểm tra và giới hạn

Đã đọc nội dung của cả 9 chương, phần đầu, tài liệu tham khảo và hai phụ lục; kiểm tra cấu trúc OOXML, công thức dạng Office Math và ảnh nhúng. Đã đối chiếu các kết quả full-scale C/P3/R7 chính với JSON per-run và `evaluation_freeze.json`; đếm lại ma trận nhầm lẫn R7 trên LCC từ CSV dự đoán. Với CE-only, sử dụng **báo cáo kết quả người dùng vừa cung cấp**, chưa đối chiếu được prediction/checkpoint CE-only gốc trong checkout; mức xác minh này được ghi riêng, không coi là thiếu kết quả. Đã đọc luồng camera/worker/tracker, truy hồi vector, schema Prisma và các đường nghiệp vụ liên quan. Một số nguồn học thuật quan trọng được kiểm tra trực tiếp trên trang tác giả/kỷ yếu.

**Chưa render và kiểm tra toàn bộ trang Word:** môi trường hiện không có LibreOffice/`soffice` để dùng trình render của skill documents. Đã xem trực tiếp sáu ảnh nhúng đại diện: pipeline, kết quả AUC, kiến trúc hệ thống, ERD, màn hình đăng ký khuôn mặt và biểu đồ tham chiếu mô hình. Vì vậy, các nhận xét về nội dung/hình đó có bằng chứng trực tiếp; nhận xét về ngắt trang, tràn bảng, cỡ chữ sau in là yêu cầu kiểm tra tiếp, không phải lỗi bố cục đã được xác nhận trên mọi trang.

Không chạy lại training, suy luận toàn dataset, camera, Raspberry Pi, cloud DB hoặc chuỗi tính lương thực tế. Không chỉnh sửa DOCX, mã nguồn, cấu hình hay dữ liệu. Những dòng chỉ dẫn biên tập nằm trong Word được xem là nội dung cần đánh giá, không được xem là yêu cầu điều khiển tác vụ.

## 1. Đánh giá tổng thể

### 1.1. Những điểm đang làm tốt và nên giữ

1. **Có đóng góp nghiên cứu cụ thể.** Cách tạo biến thể phổ trong huấn luyện, chọn worst-band theo lề và dùng Harmful Gate tạo thành một phương pháp có thể mô tả, triển khai và kiểm chứng. Đây là phần có giá trị nhất về chiều sâu kỹ thuật.
2. **Đã phân biệt huấn luyện và suy luận.** Việc không thêm nhánh FFT/DCT khi triển khai là một quyết định thiết kế rõ ràng; có artifact về số tham số và chi phí phép toán.
3. **Đã thừa nhận kết quả không đồng nhất.** Báo cáo không cố nói R7 luôn thắng P3, đã nêu khác biệt giữa 10K, 100K và full-scale, một lần chạy mỗi cấu hình, cùng giới hạn của giả thuyết nền ảnh.
4. **Phần nghiệp vụ có mô hình dữ liệu hợp lý để giải thích.** Tách sự kiện điểm danh, công ngày và phiếu lương giúp người đọc hiểu rằng nhận diện thành công chưa đủ để suy ra công/lương đúng.
5. **Đã có nhiều tuyên bố giới hạn đúng hướng.** Chưa kiểm chứng Pi, dữ liệu ứng dụng là mẫu và vân tay chưa tích hợp đều đã được nêu. Cần giữ sự trung thực này, nhưng đặt giới hạn ngay bên cạnh các kết quả liên quan. Riêng trạng thái CE-only trong Word đã cũ so với kết quả mới được cung cấp, cần cập nhật.
6. **Phụ lục B đã đi đúng hướng.** Từ điển dữ liệu từng cột nên nằm ở phụ lục; không nên đưa trở lại phần chính.

### 1.2. Vấn đề cốt lõi của bản hiện tại

**Báo cáo chưa thống nhất được câu chuyện của một đồ án hệ thống.** Chương 2–4 đưa người đọc vào nghiên cứu PAD khá sâu, đến Chương 5 mới giới thiệu yêu cầu nghiệp vụ, rồi Chương 6 quay lại kiến trúc tổng thể. Người đọc phải tự ghép “mô hình chống giả mạo” với “ứng dụng chấm công và quản lý nhân sự”.

**Mức chi tiết chưa phân bổ theo giá trị chứng minh.** Theo mục lục, Chương 8 kéo dài khoảng 16 trang với 22 hình giao diện; Chương 7 có ERD, sáu hình cấu trúc nhóm bảng, rồi Phụ lục B tiếp tục mô tả 111 cột. Trong khi đó, báo cáo chưa có một phần kiểm thử hệ thống đủ rõ để chứng minh dữ liệu từ các thành phần được xử lý đúng.

**Một số số liệu đang làm suy yếu phần vốn có thể bảo vệ tốt.** Sai EER, ma trận nhầm lẫn thiếu nhất quán, dẫn nguồn AENet sai và độ trễ chưa có provenance rõ là các điểm giảng viên có thể hỏi sâu. Thêm nhiều giải thích lý thuyết sẽ không khắc phục được các vấn đề này.

**Định hướng chỉnh sửa:** giảm phần liệt kê, tăng phần giải thích quyết định; giảm ảnh thao tác, tăng bằng chứng kiểm thử; trình bày kết quả đúng giao thức trước khi so sánh với công trình khác.

## 2. Những việc P0 cần sửa trước khi nộp

### 2.1. Bảng 4.1 có EER không khớp artifact gốc

**Vị trí:** Mục 4.3, Bảng 4.1, các nhận xét ngay sau bảng; khoảng trang 48–50.

Đã đối chiếu trực tiếp `metrics/lcc_combined_metrics.json` của ba run full-scale và `combined/video_metrics.json` của đánh giá CASIA. AUC trong bảng Word khớp ở độ làm tròn đang dùng, nhưng nhiều EER không khớp:

| Model | LCC Combined EER trong Word | LCC EER từ JSON | CASIA Combined video EER trong Word | CASIA EER từ JSON |
| --- | ---: | ---: | ---: | ---: |
| C_FULL_crop15 | 23,58% | **23,5793%** | 13,93% | **16,7289%** |
| P3_SF_FULL_crop15 | 22,84% | **21,7906%** | 13,88% | **17,4751%** |
| R7_SC_FULL_crop15 | 22,61% | **22,0559%** | 12,44% | **16,9154%** |

**Ảnh hưởng đến diễn giải:**

- Trên LCC Combined, P3 có cả AUC cao hơn một chút và EER thấp hơn R7. Câu “MAST-PAD có EER thấp hơn (22.61% so với 22.84%)” phải bỏ/sửa.
- Trên CASIA Combined, R7 có AUC cao nhất nhưng **C có EER thấp nhất** trong ba model. Không được suy rộng AUC tốt nhất thành tốt nhất ở mọi chỉ số.
- Với số đã sửa, chênh lệch EER của R7 so với C trên CASIA là **tăng khoảng 0,19 điểm phần trăm**, không phải giảm 1,49 điểm phần trăm.
- Các dòng delta, phần nhận xét, kết luận và mọi hình có chứa EER phải được cập nhật cùng nhau.

**Bảng AUC/EER có thể dùng sau khi ghi rõ population:**

| Model | LCC Combined AUC | LCC EER (%) | CASIA Combined video AUC | CASIA EER (%) |
| --- | ---: | ---: | ---: | ---: |
| C + Aux | 0,846011 | 23,58 | 0,920398 | 16,73 |
| WBST/P3_SF | 0,860831 | 21,79 | 0,922264 | 17,48 |
| MAST-PAD/R7_SC | 0,860272 | 22,06 | 0,935199 | 16,92 |

CASIA ở bảng này là **combined sau khử trùng lặp, video tái dựng từ ảnh trích xuất, 358/360 video chấm được**, không phải benchmark official subject-disjoint. Đừng đổi sang số test-only mà vẫn giữ nhãn/tiêu đề cũ.

**Nguồn repo:** [full-scale runs](../../face_auth/antispoof/notebooks/final/binary_crossdomain_v2/output/18_fullscale_C_P3SF_R7SC_crop15/runs), [CASIA runs](../../face_auth/antispoof/notebooks/final/binary_crossdomain_v2/output/casia_train_test_C_P3SF_R7SC_100k_fullscale/runs).

### 2.2. Ba dòng full-scale trong Phụ lục A cần đồng bộ lại

**Vị trí:** Bảng A.1, khoảng trang 94–95.

| Run | Trường | Word | Artifact hiện có |
| --- | --- | ---: | ---: |
| P3_SF_FULL_crop15 | Val ACER | 4,41% | **4,3548%** |
| R7_SC_FULL_crop15 | Val ACER | 4,25% | **4,3459%** |
| P3_SF_FULL_crop15 | LCC Eval AUC | 0,821104 | **0,819687** |
| R7_SC_FULL_crop15 | LCC Eval AUC | 0,824915 | **0,840060** |

C_FULL Val ACER 4,62% và LCC Eval AUC 0,811622 khớp ở độ làm tròn tương ứng. Các dòng full-scale phải cùng một checkpoint với `evaluation_freeze.json`; không ghép Val của lần chạy này với target metric của lần chạy khác.

Đây là những dòng đã kiểm tra trực tiếp. **Chưa tái kiểm toàn bộ từng dòng 01–17**, nên trước nộp cần xuất lại toàn bộ bảng A.1 từ per-run artifact thay vì sửa tay các ô đã phát hiện.

### 2.3. Bảng 4.4 không thể dùng như ma trận nhầm lẫn thực đo hiện tại

**Vị trí:** Mục 4.5.3, khoảng trang 55.

Bảng Word cho cả APCER và BPCER là 22,61%, kèm 1.940 real, 16.854 spoof và các số đếm 1.501/439/3.811/13.043. Có hai vấn đề:

1. 439/1.940 ≈ **22,63%**, không đúng 22,61% ghi trong bảng. Không thể lấy một EER rồi nhân với số mẫu, làm tròn và trình bày như số đếm dự đoán đã quan sát.
2. CSV dự đoán LCC Combined của R7 full-scale có **1.941 real và 16.853 attack** được chấm. Số đếm lớp trong Word lệch với population này.

Đếm lại trực tiếp CSV tại **ngưỡng nguồn đã khóa 4,66259765625** cho kết quả:

| Nhãn thật | Dự đoán Real | Dự đoán Attack | Tổng |
| --- | ---: | ---: | ---: |
| Real | **1.043** | **898** | **1.941** |
| Attack | **1.345** | **15.508** | **16.853** |

Tương ứng APCER **7,9808%**, BPCER **46,2648%**, ACER **27,1228%**. Trong CSV này `label=0` là real và `label=1` là attack; quyết định real được đếm theo score ≥ ngưỡng nguồn.

**Đề xuất:** dùng ma trận thực đếm ở ngưỡng triển khai/thực nghiệm đã công bố, nêu ngưỡng ngay dưới bảng. Nếu muốn minh họa ở điểm EER, phải tính từ score và một ngưỡng ROC xác định, đồng thời ghi đây là điểm chẩn đoán được chọn từ target scores, không phải hiệu năng tại ngưỡng nguồn. Với dữ liệu hữu hạn, APCER và BPCER ở một ngưỡng cụ thể không nhất thiết bằng nhau tuyệt đối.

Nguồn: [R7 LCC predictions](../../face_auth/antispoof/notebooks/final/binary_crossdomain_v2/output/18_fullscale_C_P3SF_R7SC_crop15/runs/R7_SC_FULL_crop15/predictions/lcc_combined_predictions.csv).

### 2.4. Khẳng định FAR < 0,001% tại τ = 0,35 chưa có bằng chứng hỗ trợ

**Vị trí:** cuối Mục 2.6.2, khoảng trang 34.

Notebook [lfw_identity_benchmark.ipynb](../../face_auth/evaluation/lfw_identity_benchmark.ipynb) đang lưu kết quả hiệu chỉnh theo **target FAR ≤ 1%**, với ngưỡng Mean **0,31**, Individual **0,33**. Bảng test lưu FAR khoảng **0,33%–1,50%** tùy gallery/phương pháp. Những kết quả này không hỗ trợ phát biểu FAR dưới 0,001% tại 0,35.

Không dùng bảng này để suy ra FAR của 0,35 theo chiều ngược lại: cần score thật và đúng giao thức tại ngưỡng đó. Cũng phải phân biệt verification theo cặp với open-set identification 1:N trong ứng dụng.

**Cách sửa an toàn nếu chưa có artifact khác:**

> Hệ thống hiện sử dụng ngưỡng tương đồng cosine 0,35. Giá trị này là cấu hình vận hành và chưa được xác nhận bằng một đánh giá độc lập tại môi trường triển khai. Thực nghiệm LFW được trình bày riêng với giao thức và ngưỡng hiệu chỉnh tương ứng.

Muốn giữ con số rất nhỏ phải cung cấp số impostor trials, số false accepts, score/manifest, cách chọn ngưỡng và đánh giá độc lập. Nếu không có lỗi trong một tập nhỏ, chỉ có thể báo “0/N lỗi quan sát được”; không tự kết luận một FAR cực thấp của quần thể.

### 2.5. Bảng độ trễ đang thiếu bằng chứng gốc và mô tả cấu hình chưa đủ

**Vị trí:** Mục 4.6, Bảng 4.5; các số lặp ở tóm tắt, Mục 1.2.2, 2.2.1, 2.3.3, 2.4 và 9.1.

Các thành phần 13,72 + 0,85 + 2,22 + 1,15 + 8,30 + 0,45 + 41,29 đúng là cộng ra **67,98 ms**. Tuy nhiên, phép cộng đúng không xác nhận đây là benchmark đã thực hiện. Trong phạm vi source/artifact đã kiểm tra, chưa tìm thấy log/script benchmark hỗ trợ đầy đủ tuyên bố **1.000 frame sau 50 warm-up**, trên **T4 kép/Xeon/32 GB RAM**, ở **720p**.

Các điểm cần làm rõ:

- Máy huấn luyện có T4 không có nghĩa ONNX inference chạy CUDA. SCRFD wrapper hiện dùng CPU; phải ghi provider thực tế theo từng model.
- Tracker hiện có **IoU + Lucas–Kanade optical flow**, không phải “IoU + Kalman Filter” như dòng Stage 2 trong bảng.
- Ghi rõ độ phân giải của đầu vào benchmark 720p, độc lập với cấu hình camera đang thử nghiệm. Không yêu cầu đồng bộ hai cấu hình này.
- So khớp 0,45 ms cần nói là dữ liệu cục bộ, cache, hay truy vấn cloud; gallery có bao nhiêu người/vector. Không thể xem đó là độ trễ Neon của hệ thống hiện tại.
- Đảo 67,98 ms thành 14,7 FPS chỉ mô tả thông lượng lý tưởng của phép đo tuần tự tương ứng. Không tự biến thành FPS camera đã quan sát, độ trễ hoàn tất xác thực hoặc tốc độ chuỗi chấm công.
- Nhận diện hiện chạy worker bất đồng bộ, có queue/cache. Tổng thời gian các stage không mô tả đầy đủ tốc độ hiển thị và thời gian đợi kết quả.

**Xử lý:** nếu có log gốc, bổ sung đường dẫn, commit, provider, threads, input, gallery, warm-up, số lần đo, median/p95, phạm vi timer và số khuôn mặt. Nếu chưa có, tạm bỏ số latency khỏi tóm tắt/kết luận và chuyển bảng vào mục “số liệu cần xác minh”; không thay bằng số mới tự ước đoán.

Nguồn đối chiếu: [app.py](../../face_auth/app.py), [tracker.py](../../face_auth/tracking/tracker.py), [detector.py](../../face_auth/detection/detector.py), [worker.py](../../face_auth/recognition/worker.py). Artifact `complexity_report.json` có thông số tính toán nhưng không phải chứng cứ benchmark camera.

### 2.6. Dẫn nguồn AENet đang sai đối tượng

**Vị trí:** tài liệu tham khảo [1], Bảng 4.2, Mục 3.2 và các phần dùng AENet.

Bản Word ghi [1] là “Adversarial Erasing Network for Face Anti-Spoofing”, tác giả Y. Chen et al., ECCV 2020. Nguồn chính thức CelebA-Spoof giới thiệu AENet là **Auxiliary Information Embedding Network**, nằm trong công trình của **Yuanhan Zhang et al.** về CelebA-Spoof, vốn đã xuất hiện ở [8]. Cần sửa/ghép lại tham khảo; không dùng [1] hiện tại để chống lưng cho AENet. [Nguồn chính thức](https://arxiv.org/abs/2007.12342), [repo tác giả](https://github.com/ZhangYuanhan-AI/CelebA-Spoof).

Ở Mục 3.2, các dẫn [1], [6] cũng chưa hợp lý để chứng minh nhận xét về mạng hai nhánh phổ. [6] là SA-FAS về separability/alignment. Một nguồn có nội dung hai luồng không gian–phổ–thời gian phù hợp để xem xét là bài [9] đang có trong danh mục, nhưng phải đọc đúng phần hỗ trợ luận điểm trước khi thay citation. [Bài gốc 2002.03723](https://arxiv.org/abs/2002.03723).

### 2.7. Loại bỏ phần còn để dạng chỉ dẫn biên tập

**Vị trí:** Hình 6.2 và đoạn ngay sau, khoảng trang 65; bảng phân công khoảng trang 13.

- Vẫn có `[CHÈN ẢNH 6.2 ...]` và đoạn “Ảnh cần bổ sung: ...”. Đây là nội dung bản thảo, không nên xuất hiện trong bản nộp.
- Nếu chưa có ảnh/log phần cứng thật, bỏ placeholder và caption tương ứng; hoặc thay bằng sơ đồ **thiết kế dự kiến** được ghi nhãn rõ. Không dùng ảnh minh họa để thay thế bằng chứng tích hợp.
- Bảng phân công có tên nhưng các cột nhiệm vụ/tỷ lệ hoàn thành còn trống. Cần điền dựa trên công việc thật của nhóm; không tự phân chia hay tự đặt tỷ lệ cho đủ bảng.

### 2.8. Cập nhật CE-only: đã có kết quả, cần đưa vào mạch thực nghiệm chính

**Vị trí cần sửa trong Word:** Mục 4.2.4, Bảng 4.1, Phụ lục A, Mục 9.2 và các câu “thí nghiệm CE-clean chưa hoàn thành/chưa có kết quả”. Đây là thông tin mới so với bản Word, không phải kết luận rằng tác giả đã bỏ qua kết quả ở thời điểm viết.

Theo [ce_clean_fullscale_report.md](../../face_auth/md/ce_clean_fullscale_report.md), run `CE_CLEAN_FULL_crop15` chỉ tối ưu **CE_clean**, không có spectral selection, CE_worst hay L_aux; các module auxiliary chỉ là compatibility placeholders được freeze. Recipe được báo cáo là matched với notebook18 về dữ liệu, crop, pretrained trunk/seed, optimizer và ngân sách. Các metric trong file là **fraction**, cần nhân 100 khi trình bày tỷ lệ lỗi (%).

| Population của CE-only | AUC | EER (%) | APCER (%) | BPCER (%) | ACER (%) | Scored/candidates |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| CelebA Test-as-Val | 0,992144 | 4,48 | 5,07 | 3,83 | 4,45 | 66.379/67.170 |
| LCC Combined, image-level | 0,843988 | 24,46 | 7,30 | 51,73 | 29,52 | 18.794/18.827 |
| CASIA Combined, reconstructed video-level | 0,898300 | 16,54 | 0,37 | 73,33 | 36,85 | 358/360 |

Các operating-point metric trên là ngưỡng nguồn đã hiệu chỉnh/khóa rồi áp sang target. File CE-clean gọi policy là `source-calibrated`; khi đặt cạnh C/P3/R7 nên ghi rõ **source-calibrated, target-frozen**, tránh bị hiểu là hiệu chỉnh trên LCC hoặc CASIA. Không ghép metric CASIA train-calibrated vào các dòng này.

**Bảng chính nên bổ sung đủ bốn recipe:**

| Recipe | LCC Combined AUC | LCC EER (%) | CASIA Combined video AUC | CASIA EER (%) |
| --- | ---: | ---: | ---: | ---: |
| CE-only | 0,843988 | 24,46 | 0,898300 | **16,54** |
| C + Aux | 0,846011 | 23,58 | 0,920398 | 16,73 |
| WBST/P3_SF | **0,860831** | **21,79** | 0,922264 | 17,48 |
| MAST-PAD/R7_SC | 0,860272 | 22,06 | **0,935199** | 16,92 |

**Ý nghĩa cần viết lại:**

- C + Aux cao hơn CE-only khoảng **0,20 điểm phần trăm AUC trên LCC** và **2,21 điểm phần trăm trên CASIA Combined video**. Đây là đối chứng trực tiếp hơn để thảo luận ảnh hưởng của recipe có giám sát phụ trợ; vẫn là quan sát một seed, chưa phải kết luận có ý nghĩa thống kê.
- R7 cao hơn CE-only khoảng **1,63 điểm phần trăm AUC trên LCC**, **3,69 điểm phần trăm trên CASIA**. Đây là lợi ích tổng thể của recipe R7 so với CE-only, **không phải riêng Harmful Gate** vì còn có Aux, spectral treatment và trọng số loss khác.
- Để thảo luận can thiệp phổ, tiếp tục so với C + Aux. Để cô lập gate, vẫn cần đối chứng có cùng sigma và các tham số khác; CE-only mới không tự giải quyết giới hạn này.
- CE-only có EER CASIA Combined thấp nhất trong bốn recipe dù AUC thấp nhất. Đây là ví dụ thực tế rất tốt cho việc AUC cao nhất không đồng nghĩa tốt nhất ở mọi vùng ROC hay mọi metric.
- Có thể bỏ hạn chế “chưa có CE-only để đánh giá Aux”, thay bằng **đã có đối chứng CE-only nhưng chỉ một seed; cần đánh giá độ ổn định và phạm vi tổng quát hóa**.

**Bổ sung metadata vào phụ lục, không trì hoãn sử dụng kết quả:** best epoch, ngưỡng nguồn, checkpoint/manifest hash và đường dẫn artifact CE-only. File mới chứa metric nhưng chưa ghi cụ thể các giá trị metadata này; trong checkout hiện tại mới tìm thấy báo cáo/notebook/protocol, chưa thấy output CE-only tương ứng để kiểm tra lại. Có thể dùng kết quả được cung cấp trong bản chỉnh sửa, kèm nguồn này và bổ sung provenance khi đóng gói hồ sơ cuối.

File kết quả mới còn câu cuối “No new-model results exist until training/evaluation completes.” Câu này mang tính mẫu và không còn phù hợp với bảng metric đã điền; khi đưa sang hồ sơ báo cáo nên bỏ hoặc thay bằng trạng thái thực tế. Tài liệu `FULLSCALE_MODEL_RESULTS_SOURCE_OF_TRUTH.md` cũ cũng vẫn ghi CE-only chưa có kết quả; cần cập nhật ở một tác vụ đồng bộ tài liệu riêng nếu muốn dùng làm nguồn tổng hợp cuối, không lấy trạng thái cũ để phủ nhận kết quả mới.

## 3. Các vấn đề P1 về phương pháp và độ chặt chẽ

### 3.1. Giao thức dữ liệu phải xuất hiện trước bảng kết quả

Hiện báo cáo đã có các giới hạn ở 9.2, nhưng người đọc phải đi đến cuối mới hiểu đầy đủ tính chất của số liệu ở Chương 4. Nên thêm một bảng giao thức ngắn ở đầu chương thực nghiệm:

| Population | Vai trò | Đơn vị | Dùng chọn model/ngưỡng? | Cách trình bày |
| --- | --- | --- | --- | --- |
| CelebA usable train: 484.561/494.405 | Huấn luyện full-scale | Ảnh | Huấn luyện trọng số | Nêu cả candidates và usable |
| CelebA Test-as-Val: 66.379/67.170 | Chọn checkpoint và ngưỡng nguồn | Ảnh | **Có** | Không gọi là held-out test độc lập |
| LCC Combined: 18.794/18.827 | Khảo sát ngoại miền, gộp train/dev/eval | Ảnh | Không fit ngưỡng tại đánh giá đã khóa | Nêu rõ pooled union, không phải riêng official evaluation |
| CASIA copy test: 2.408 frame; 352/360 video chấm được | Đánh giá trên copy được khảo sát | Frame hoặc video tái dựng | Tách source-frozen và calibrated | Không gọi official subject-disjoint benchmark |
| CASIA copy combined: 2.660 frame; 358/360 video | Gộp, khử trùng lặp | Frame hoặc video tái dựng | Có chứa dữ liệu calibration nếu dùng train-calibrated | Kết quả bổ trợ, không xác nhận độc lập |

**Hai lớp giới hạn cần phân biệt:**

1. **Trùng lặp trong bản CASIA:** artifact ghi overlap **20 subject IDs, 240 video IDs, 1.403 frame IDs** giữa train/test copy. Đây mạnh hơn cách nói “chồng lấn danh tính nhất định” hiện nay. Video ID được tái dựng từ tên file; tối thiểu bốn frame hợp lệ mới chấm video; score video là trung bình frame score.
2. **Lựa chọn phương pháp qua nhiều vòng:** báo cáo dùng kết quả LCC qua nhiều vòng để lựa chọn crop/cấu hình. Dù không gradient-train hoặc fit ngưỡng trên LCC, quá trình xem LCC để phát triển phương pháp làm LCC chưa phải một final test hoàn toàn chưa từng được sử dụng. Nên gọi là **khảo sát ngoại miền trong quá trình phát triển** và giải thích lịch sử lựa chọn. Muốn xác nhận cuối cùng cần một miền hoặc holdout mới được khóa trước.

Không gộp hai vấn đề này thành một chữ “leakage” chung chung. Trùng dữ liệu, chọn checkpoint bằng source Test-as-Val, và thích nghi quyết định nghiên cứu theo target metrics là ba cơ chế khác nhau, cần mô tả đúng.

### 3.2. Phần giới thiệu CASIA đang trộn quy mô gốc với bản dùng thực nghiệm

Mục 1.3.3 viết “50 đối tượng với 360 đoạn video”. **CASIA-FASD gốc có 600 video của 50 người**, còn 360 là quy mô tập test gốc. Phải tách:

- Thông tin dataset gốc, trích nguồn.
- Quy mô và cấu trúc **bản trích xuất màu thực sự được sử dụng**.
- Số candidates, số chấm được, overlap và cách dedup của bản này.

Nguồn sơ cấp xác nhận 600 video, 12 video/người: [Zhang et al., ICB 2012](https://nlpr.ia.ac.cn/2012papers/gjhy/gh69.pdf). Chỉ cần một đoạn mô tả và một bảng thống kê; các ảnh ví dụ/chi tiết thiết bị có thể đưa phụ lục nếu không trực tiếp giải thích thí nghiệm.

### 3.3. Không dùng camera thử nghiệm làm tiêu chí đánh giá kết quả nghiên cứu

Theo xác nhận của người dùng, model camera đang phục vụ test thực tế và không quyết định kết quả nghiên cứu. Vì vậy **không yêu cầu model, threshold, cadence hoặc độ phân giải của camera hiện tại trùng với protocol nghiên cứu**; không liệt kê sự khác nhau này như một lỗi cần sửa.

Trong báo cáo chỉ cần mô tả rõ cấu hình của **thí nghiệm được báo cáo** khi nó cần thiết để hiểu số đo. Benchmark nghiên cứu dùng artifact đã khóa của run tương ứng; demo camera được mô tả theo vai trò minh họa/thử nghiệm thực tế. Không cần thêm một mục giải trình vì sao đang chạy model khác, cũng không cần đưa bảng `.env` camera hiện tại vào main.

### 3.4. Tên baseline và phép so sánh phải thể hiện đúng đối chứng

Bản Word đã ghi C có Aux ở Phụ lục A, nhưng nhãn ngắn “Clean Baseline” ở các bảng/hình dễ khiến người đọc hiểu là CE-only. Nay đã có kết quả CE-only được cung cấp, việc phân biệt hai baseline càng cần rõ; các câu chưa hoàn thành ở 4.2.4/9.2 phải cập nhật.

Nên thống nhất bốn dòng:

| Tên dùng trong báo cáo | Loss sau warm-up | Trạng thái |
| --- | --- | --- |
| C + Aux | CE_clean + L_aux | Có kết quả |
| WBST/P3_SF | 0,75 CE_clean + 0,25 CE_worst + L_aux | Có kết quả |
| MAST-PAD/R7_SC | 0,75 CE_clean + 0,25 CE_harmful + L_aux | Có kết quả |
| CE-only | CE_clean | **Đã có kết quả trong báo cáo CE-clean mới**, dùng đúng số run CE-only |

**Một giới hạn đối chứng quan trọng:** P3_SF dùng sigma ≈ **0,05556**, R7_SC dùng sigma **0,1**. Vì vừa khác gate vừa khác độ rộng bộ lọc, so sánh hai cấu hình này là so sánh **hai recipe**, chưa cô lập tác động riêng Harmful Gate. Giữ nhận xét kết quả quan sát được; giảm các câu quy lợi ích cho riêng gate.

Đề xuất ablation tiếp theo: giữ cùng crop, centers, sigma, loss weights, khởi tạo, data order và ngân sách; chỉ đổi gate bật/tắt. Không cần chạy thí nghiệm này để sửa văn bản, nhưng cần ghi rõ nếu chưa có bằng chứng.

### 3.5. Bổ sung warm-up, checkpoint policy và trường hợp không có harmful sample

Mục phương pháp nên nói rõ:

- P3/R7 có một epoch clean+aux warm-up; checkpoint cuối chỉ eligible từ epoch 2 trong recipe full-scale hiện có.
- Chọn checkpoint theo calibrated source ACER, AUC để phá hòa; early stopping có pha là vấn đề khác với eligibility.
- Khi không có harmful sample, spectral loss bằng 0; không để công thức chia cho 0.
- Gate và chọn worst-band không backprop qua phép chọn rời rạc; cần khớp với `eval/no_grad` và nhánh forward dùng để tính gradient thực tế.
- **Preserve DC** có trong config thực nghiệm; công thức/giải thích bộ lọc cần đề cập. Khi giữ DC, nói LOW “mô phỏng thay đổi chiếu sáng toàn cục” là quá mạnh; nên mô tả đó là suy giảm thành phần tần số thấp và chỉ nêu liên hệ chiếu sáng như trực giác.

Mục 3.4.5 hiện có phân tích gradient nhưng giá trị chứng minh hạn chế so với độ dài. Giữ một câu về stop-gradient trong phần chính, chuyển khai triển sang phụ lục; không cần trình bày như một kết quả lý thuyết mới.

### 3.6. Chẩn đoán Harmful Gate cần ghi mốc epoch và mẫu số

Mục 4.5.1 nói khoảng 83,2% “theo số liệu tổng hợp”. CSV cho thấy **83,2135% là giá trị epoch 11**; không nên mặc nhiên gọi là trung bình toàn quá trình. File bắt đầu ở epoch 2 và kết thúc epoch 11, tức **10 dòng active-phase diagnostics**, dù training có 11 epoch tính cả warm-up.

Ở epoch 11: LOW **42,65%**, MID **27,30%**, HIGH **30,05%**. Ở epoch 2, LOW khoảng **50,34%**. Vì vậy câu “phân bố tương đối cân bằng, không có dải nào chi phối” cần mềm hơn: **cả ba dải đều được chọn; LOW xuất hiện nhiều hơn, tỷ lệ thay đổi theo epoch**. Nếu báo số trung bình, phải tính và chỉ rõ trung bình theo epoch hay gộp theo số mẫu.

Tỷ lệ harmful cao không tự chứng minh gate ít tác dụng: loss được chuẩn hóa trên harmful subset, nên việc bỏ 17% mẫu không tương đương giảm 17% độ lớn gradient. Tương tự, giảm lề không đồng nghĩa lật nhãn, và lề theo dấu logit quanh 0 không đồng nghĩa quyết định ở ngưỡng deployment khác 0. Cần phân biệt các khái niệm này khi diễn giải.

Nguồn: [spectral_diagnostics.csv](../../face_auth/antispoof/notebooks/final/binary_crossdomain_v2/output/18_fullscale_C_P3SF_R7SC_crop15/runs/R7_SC_FULL_crop15/spectral_diagnostics.csv).

### 3.7. AUC cần đi cùng operating point phục vụ ứng dụng

Chỉ báo AUC/EER chưa trả lời “người thật bị từ chối bao nhiêu, tấn công lọt bao nhiêu ở ngưỡng sẽ dùng”. Với R7 full-scale, LCC Combined source-frozen có BPCER khoảng **46,26%** dù AUC khoảng 86,03%. Đây là thông tin quan trọng để đánh giá mức sẵn sàng ứng dụng.

Trong phần chính nên có một bảng nhỏ gồm **APCER, BPCER, ACER tại ngưỡng nguồn**, bên cạnh AUC. CASIA train-calibrated phải thành bảng riêng hoặc phụ lục với nhãn rõ; không thay operating point tốt hơn vào bảng source-frozen.

ACER/HTER trong code hiện là cùng trung bình lỗi nhị phân theo population đang xét. Không nên định nghĩa thành hai công thức khác nhau hoặc nói mọi metric đang được báo cáo đều là một phép kiểm thử tuân thủ ISO hoàn chỉnh. Cần nêu lớp dương, cách nội suy/tìm EER, cách pooled các loại tấn công, coverage và xử lý mẫu không chấm được.

### 3.8. So sánh công trình khác chỉ nên làm phần định vị ngắn

Lưu ý “khác giao thức” hiện có là cần thiết, nhưng biểu đồ đặt tất cả model trên cùng trục AUC vẫn dễ tạo cảm giác xếp hạng trực tiếp. Nên:

- Giữ khoảng nửa đến một trang tổng quan bối cảnh trong phần chính.
- Bổ sung cột train domains, target split, frame/video, preprocessing và nguồn bảng/trang.
- Chuyển biểu đồ xếp hạng CASIA và bảng dài sang phụ lục nếu không đủ mô tả giao thức.
- Dùng “model nhỏ hơn về số tham số” thay cho “tỷ lệ AUC trên số tham số thuận lợi”. AUC/params không phải thước đo chuẩn cho chất lượng triển khai.
- Không suy từ số tham số sang FPS, điện năng hay RAM peak; những điều đó cần đo riêng.
- Bổ sung đối chiếu các model nhẹ nếu có nguồn cùng giao thức, tránh chỉ chọn những backbone lớn. Artifact tham chiếu trong repo cũng có các dòng MobileNetV3 cần xem xét trước khi chọn đối tượng so sánh.

Trong bài ESANN 2023, Bảng 1 thực sự có Graph Transformer AUC 0,833 và AENet 0,868, nhưng **đó là nơi tái báo số AENet**, không có nghĩa con số được xác minh trực tiếp từ bài AENet gốc. Bài ESANN còn có đoạn mô tả kết quả không nhất quán với bảng; khi trích cần chỉ rõ đang lấy Bảng 1 và tránh gộp các đoạn khác. [Bài gốc ESANN](https://www.esann.org/sites/default/files/proceedings/2023/ES2023-14.pdf).

## 4. Những nội dung còn thiếu về hệ thống PBL6

### 4.1. Ma trận yêu cầu – triển khai – bằng chứng

Đây là phần nên bổ sung trước khi thêm hình giao diện. Mỗi chức năng cần trả lời “đã có source”, “đã có kết quả chạy”, hay “mới là thiết kế”.

| Yêu cầu | Thành phần thực hiện | Bằng chứng cần có | Cách ghi khi chưa chạy |
| --- | --- | --- | --- |
| Đăng nhập/phân quyền | Auth middleware, routes | Test ADMIN/MANAGER/EMPLOYEE, 401/403, truy cập dữ liệu người khác | Có triển khai, chưa xác nhận toàn ma trận quyền |
| Đăng ký khuôn mặt | Frontend → backend → Face Auth → DB | Request/result, SAMPLE/CENTROID theo model, lỗi đầu vào | Có đường tích hợp; ảnh UI không đủ chứng minh transaction |
| PAD + nhận diện camera | app/tracker/worker | Real/print/replay, reset track, cloud chậm, UNKNOWN | Chưa có bộ test triển khai độc lập |
| Ghi chấm công từ thiết bị | Publisher → MQTT/API → backend | Cùng event đi qua thiết bị, server, DB; kiểm tra trùng | Đường publisher từ app camera chưa hoàn tất |
| Tổng hợp công | Attendance service | Input log/ca và output kỳ vọng cho từng ca biên | Có logic, cần kiểm thử tính đúng |
| Lập/chốt lương | Payroll service | Case tính tiền và case từ chối sửa sau chốt | Có chức năng, chưa bảo đảm mọi bất biến |
| Tra cứu cá nhân | Employee portal/API | Chỉ thấy dữ liệu của chính chủ | Cần chứng cứ API, không chỉ ảnh màn hình |

Không đánh dấu “đạt” chỉ vì có route, một ảnh UI hoặc tên hàm. Bảng kết quả thực tế phải ghi rõ cách kiểm tra, ngày và artifact; bảng trên là đề xuất cấu trúc đánh giá.

### 4.2. Làm rõ hai luồng Face Auth và ranh giới tích hợp

Một sequence diagram ngắn cho mỗi luồng sẽ hữu ích hơn việc lặp lại các API:

1. **Đăng ký:** manager → web → backend đã xác thực → Face Auth API `/internal/enroll` → phát hiện/căn chỉnh/embedding → lọc mẫu → ghi SAMPLE/CENTROID trong transaction.
2. **Camera realtime:** camera → detection/tracking/PAD → worker ArcFace → cache hoặc DB → kết quả về track còn hợp lệ → hiển thị danh tính.
3. **Nghiệp vụ chấm công:** sự kiện từ thiết bị/API → backend → attendance log → aggregate → payroll. Phần chưa nối từ camera cần nét đứt và ghi “chưa tích hợp/kiểm chứng”.

Source hiện tại xác nhận Python camera **không trực tiếp ghi `attendance_logs`**, các hook cũ đã comment; backend là nơi ghi nghiệp vụ. Vì vậy không nên dùng một sơ đồ end-to-end liền mạch để khiến người đọc nghĩ nhận diện đang tự sinh đầy đủ check-in/check-out.

Hình 6.1 hiện có phân biệt Face Auth API và chương trình camera, đây là điểm tốt cần giữ. Bổ sung chiều mũi tên, tên dữ liệu và ranh giới host/Pi/cloud; không cần thêm quá nhiều framework vào hình.

### 4.3. Một tiểu mục ngắn về trạng thái, lỗi và kết quả bất đồng bộ

Chương pipeline hiện thiên về luồng tuần tự lý tưởng. Nên thêm khoảng một trang giải thích:

- PENDING/REAL/SPOOF/INVALID/UNKNOWN có ý nghĩa khác nhau.
- Chỉ PAD REAL mới đủ điều kiện submit nhận diện khi PAD bật; thiếu phiếu hoặc dữ liệu cũ không được tự chấp nhận.
- Worker chỉ trả kết quả cho đúng track và `verification_generation`; mất continuity hoặc PAD lỗi làm kết quả cũ hết hiệu lực.
- Queue có giới hạn; cloud chậm không chặn camera loop, nhưng startup/detection/PAD/alignment vẫn có xử lý đồng bộ.
- Cache giúp giảm DB lookup; không thay thế bước embedding/PAD. Nhãn ổn định trên UI phải tách khỏi quyết định xác thực thô.
- Ngưỡng PAD, cosine matching, cache và lọc outlier enrollment là bốn ngưỡng khác nhau.

Giữ nguyên lý và một sơ đồ trạng thái trong phần chính. TTL, số thread, queue capacity, timeout SQL và tên class chuyển phụ lục nếu không phải đối tượng thực nghiệm chính.

### 4.4. Cần kiểm thử nghiệp vụ có kết quả kỳ vọng

Chương 5 đã có ví dụ số học tốt, nhưng chưa chứng minh code tạo ra kết quả đó. Nên có bảng case tối thiểu sau, ghi trạng thái **chưa chạy** cho case chưa có chứng cứ:

| Nhóm | Case cần kiểm tra | Điều phải đối chiếu |
| --- | --- | --- |
| Attendance | Thiếu check-out; check-out trước check-in; gửi trùng | Có tạo công sai hoặc log trùng không |
| Thời gian | Ca qua đêm; nghỉ giữa ca; nhiều lượt ra/vào; biên múi giờ | Ngày nghiệp vụ và số giờ được tính |
| Làm tròn | Trễ 14/15/16 phút, OT sát 30 phút | Ân hạn khác thời lượng khấu trừ như thế nào |
| Điều chỉnh | Aggregate lại sau khi manager đã điều chỉnh | Có giữ điều chỉnh không |
| Payroll | Không có công; 0 giờ công; có OT; thay policy | Có fallback 176 giờ hoặc cộng trùng OT không |
| Khóa dữ liệu | Sửa/tính lại sau FINALIZED hoặc sau khóa ngày | Server có từ chối, không chỉ UI khóa nút |
| Quyền | Nhân viên gọi API cho ID khác; token cũ của tài khoản bị khóa | Từ chối đúng phía server |
| MQTT | Sai chữ ký, thiếu chữ ký, quá hạn, cùng packet gửi lại | Hành vi theo môi trường và chống trùng/phát lại |

Mã hiện có thực sự dùng fallback **176 giờ** ở payroll; `generateForPeriod` có thể upsert về PENDING; `updateItem` chưa thấy guard FINALIZED trong đường đã đọc. Mục 9.2 đã nhận diện nhiều giới hạn này đúng hướng. Nên đưa bảng “quy tắc mong muốn – hành vi hiện tại – hạn chế” vào phần đánh giá thay vì chỉ dồn các vấn đề vào kết luận.

Ví dụ 160 giờ + 2 giờ OT trong Mục 5.8 cho kết quả số học 17.775.000 đồng là đúng với giả định đã nêu, nhưng cần định nghĩa **160 giờ đã loại OT hay chưa**. Nếu aggregate cộng cả thời gian ở lại vào giờ công rồi tiếp tục trả OT toàn phần, cách giải thích phải phản ánh đúng logic hiện tại và giới hạn của nó.

### 4.5. Bổ sung ranh giới tin cậy và dữ liệu sinh trắc, ở mức vừa đủ

Đề tài có dữ liệu khuôn mặt, danh tính và lương; một tiểu mục khoảng một trang là phù hợp, không cần biến báo cáo thành audit bảo mật toàn diện:

- Ai được đăng ký/cập nhật/xóa vector; API nội bộ được giới hạn truy cập ra sao.
- Vector gắn model_version, trạng thái active và employee ACTIVE; không coi vector là dữ liệu vô danh hoặc “không thể bị lạm dụng”.
- Lưu ảnh gốc/vector trong bao lâu, quy trình xóa/re-enroll và giới hạn của bản thử nghiệm.
- JWT/role check không tự đảm bảo tài khoản vừa bị vô hiệu hóa sẽ hết quyền ngay; middleware hiện đọc token và verify, không tự truy vấn lại trạng thái tài khoản mỗi request.
- MQTT HMAC xác thực nội dung trong cửa sổ thời gian không tự chống phát lại cùng packet trong cửa sổ đó. Handler hiện kiểm chữ ký khi có signature hoặc ở production; bản dev có thể chấp nhận thiếu chữ ký. Không viết rằng mọi packet ở mọi môi trường đều bị bắt buộc ký.
- Face Auth API `/internal/enroll` chưa có dependency xác thực ứng dụng trong đoạn route đã đọc; Compose bind host port về 127.0.0.1 là một lớp hạn chế truy cập. Mô tả rõ giả định mạng nội bộ, không tự nói đã có service-to-service authentication.

Các điểm này là mô tả thiết kế và giới hạn source, chưa phải kết quả penetration test. Không cần viện dẫn luật để kết luận đồ án “đạt chuẩn” hay “không tuân thủ”.

## 5. Đề xuất chi tiết theo từng phần của bản Word

| Phần hiện tại | Đánh giá | Nên giữ ở phần chính | Nên rút/bỏ/chuyển | Cần bổ sung hoặc sửa |
| --- | --- | --- | --- | --- |
| Lời mở đầu | Đúng ngữ cảnh nhưng trùng tóm tắt | Động cơ dự án, lời cảm ơn ngắn | Giảm diễn giải kỹ thuật, không lặp pipeline | Tách lời cảm ơn nếu mẫu khoa yêu cầu |
| Tóm tắt | Có bài toán, phương pháp, kết quả và giới hạn | 250–350 từ nếu không có quy định riêng | Không liệt kê hết framework/14 bảng | Sửa nhãn CASIA, số chấm được; xử lý latency chưa có provenance |
| Chương 1 | Có thông tin nhưng datasets quá sớm, tổng quan thuật ngữ dài | Bài toán, mục tiêu đo được, phạm vi, đóng góp | Chuyển mô tả datasets sang thiết lập thực nghiệm; gộp bảng loại tấn công | Thêm câu hỏi nghiên cứu và tiêu chí hoàn thành hệ thống |
| Chương 2 | Pipeline hữu ích, nhiều giải thích phổ thông có thể ngắn hơn | Sơ đồ luồng, input/output, gating, tracking, matching | Rút các bảng khảo sát detector/backbone thiếu đo cùng điều kiện; giảm đoạn lặp nguy cơ spoof | Làm rõ kỹ thuật của phiên bản được mô tả, thêm worker và trạng thái; không bắt đồng bộ camera test |
| Chương 3 | Trọng tâm nghiên cứu nên giữ | Trực giác, bộ sinh phổ, margin, worst-band, gate, loss, scale-aware | Chuyển khai triển DFT/gradient và R7_SEV sang phụ lục | Đổi tên chương; thêm warm-up/preserve DC; hạ mức khẳng định cơ chế vật lý |
| Chương 4 | Cần sửa kỹ nhất | Protocol, bảng kết quả chính, ablation, operating point, giới hạn sát kết quả | Chuyển lịch sử vòng 01–16 và so sánh paper dài xuống phụ lục | Sửa số liệu, thêm CE-only mới; chỉ rõ source-frozen/calibrated; bổ sung provenance latency và kiểm thử hệ thống |
| Chương 5 | Thực chất, có ví dụ hữu ích | Tác nhân, luồng nghiệp vụ, quy tắc công/lương và ngoại lệ | Gộp mô tả thao tác trùng Chương 8 | Đưa lên trước kiến trúc AI; tách yêu cầu mong muốn khỏi hành vi thử nghiệm |
| Chương 6 | Có phân biệt thành phần và mức tích hợp | Sơ đồ triển khai, hai sequence quan trọng, phân quyền, giao thức thiết bị | Chuyển danh sách API đầy đủ sang phụ lục | Loại placeholder; ghi ranh giới cloud/host/Pi, môi trường MQTT |
| Chương 7 | Đúng hướng nhưng lặp nhiều mức | ERD logic, ràng buộc chính, thời gian/tiền, SAMPLE/CENTROID | Chuyển Hình 7.2–7.7 xuống cùng từ điển dữ liệu hoặc bỏ vì trùng | Kiểm cardinality, unique centroid trong migrations; phân biệt index thiết kế với live DB |
| Chương 8 | Đang giống hướng dẫn sử dụng hơn phần chứng minh đồ án | 5–7 hình/cụm hình đại diện theo workflow | Chuyển các form, tab cá nhân và ảnh trạng thái gần nhau sang phụ lục sử dụng | Mỗi hình gắn yêu cầu, hành động, kết quả và giới hạn; bổ sung bằng chứng tích hợp |
| Chương 9 | Trung thực nhưng dài, nhiều ý lặp | Mục tiêu nào đạt, bằng chứng nào hỗ trợ, hạn chế quan trọng, ưu tiên tiếp theo | Gộp 9.1 và 9.4; rút phần so sánh paper lặp Chương 4 | Sửa EER/latency/nhãn CASIA; bỏ trạng thái CE-only chưa có kết quả; ưu tiên kiểm chứng hiện tại trước TTA/Deepfake |
| Tham khảo | Cần sửa nội dung và metadata | Nguồn thật sự được dùng | Loại mục không được trích hoặc không phục vụ lập luận | Sửa AENet; bổ sung nguồn LCC/InsightFace/thuật toán được mô tả, rà số trang/DOI |
| Phụ lục A | Cần để tái lập, nhưng đang trộn số | Run IDs và cấu hình từng vòng | Không kể lại toàn lịch sử trong main | Sinh bảng từ artifact, ghi protocol/threshold/population theo nhóm |
| Phụ lục B | Vị trí hợp lý | Mô tả cột, kiểu, constraint | Không cần lặp 6 hình cấu trúc cùng nội dung | Đối chiếu cả schema và migration cho CHECK/index không biểu diễn đủ trong Prisma |

### 5.1. Sửa một số chi tiết kỹ thuật và diễn đạt

- **Tên Chương 3:** đổi thành “Phương pháp huấn luyện MAST-PAD” hoặc “Chống giả mạo bằng huấn luyện phổ có chọn lọc”. Tên hiện tại quá dài và khiến người đọc kỳ vọng một nghiên cứu quang học sâu hơn nội dung thực có.
- **Tên Chương 4:** “Thiết lập thực nghiệm và đánh giá” là đủ; không cần nhấn “các công trình đã công bố” ngay ở tiêu đề chương.
- **“Gán danh tính liên tục”:** dùng “duy trì mã track” ở phần tracking. Track ID chưa phải danh tính nhân viên đã được nhận diện.
- **“5 điểm mốc giải phẫu”:** dùng “5 điểm mốc khuôn mặt”, gồm tâm mắt, mũi và khóe miệng; cách gọi hiện tại nặng mà không tăng chính xác.
- **“Căn chỉnh về tư thế chính diện”:** biến đổi tương đồng 2D chuẩn hóa scale/roll/translation; không tái tạo được khuôn mặt frontal 3D từ yaw/pitch lớn. Nên viết “căn chỉnh về hệ tọa độ tham chiếu”.
- **“Affine” và “similarity”:** nêu một lần similarity là trường hợp hạn chế của affine; sau đó dùng thống nhất “biến đổi tương đồng 2D”.
- **“Adversarial Counterfactual Generator”:** giải thích đây là chọn dải bất lợi trong tập biến thể hữu hạn, không phải mặc nhiên có tối ưu tấn công gradient hoặc ràng buộc perceptual. Có thể dùng “bộ sinh biến thể phổ” để nhẹ và chính xác hơn.
- **“Không tăng chi phí suy luận”:** đổi thành “giữ nguyên kiến trúc clean inference và số phép toán được đếm theo cùng quy ước”. Runtime latency bằng nhau cần benchmark; không suy từ kiến trúc ra chính xác 2,22 ms.
- **Margin ≥/≤ 0:** phân loại theo dấu logit là diễn giải ở ngưỡng 0; deployment dùng ngưỡng hiệu chỉnh khác 0. Thêm một câu tránh đồng nhất hai quyết định.
- **Edge margin 5 px:** nếu mô tả thuật toán như đang có trong source thì công thức hiện là `max(2 px, 2% min(box_w, box_h))`. Nếu 5 px thuộc cấu hình của thí nghiệm/bản triển khai được báo cáo, giữ đúng snapshot đó, không sửa chỉ để khớp camera đang test. Cần phân biệt bbox/landmark gate với yêu cầu expanded crop nằm trọn trong frame.
- **Tích lũy 5 phiếu:** đó là 5 lần PAD hợp lệ, không nhất thiết 5 camera frame liên tiếp. Khoảng từ phiếu đầu đến phiếu thứ năm có bốn khoảng chu kỳ; độ trễ từ lúc người vào camera còn có lịch detection/PAD, xử lý và reset. Không dùng 5×interval như một thời gian xác thực được bảo đảm.
- **Bảng khảo sát kiến trúc:** các câu như “YOLO tốn GPU”, “YunNet dễ bỏ sót khi nghiêng quá…”, “MobileNetV3 tổng quát hóa kém hơn”, “EfficientNet trên 15 ms” cần nguồn hoặc phép đo cùng điều kiện. Nếu không có, bỏ phán quyết định lượng và rút còn tiêu chí lựa chọn backbone.
- **Nguồn cấu hình phổ:** Bảng 3.2 ghi các tâm [0,15; 0,45; 0,75] là “kế thừa từ Silent-Face framework”. Không nên gán bộ lọc phổ do nghiên cứu của nhóm dùng cho framework gốc chỉ vì checkpoint/crop 2,7 xuất phát từ Silent-Face. Tách rõ nguồn backbone/crop và nguồn thiết kế spectral recipe; cần citation nếu muốn giữ quy gán đó.
- **Vật lý và FFT:** tránh nói từng dải đã “mô phỏng” một hiện tượng cụ thể như thể được xác nhận. Chỉ nên dùng làm động cơ thiết kế; cơ chế thực tế còn phụ thuộc sensor, crop, resize, màn hình và ánh sáng.
- **Bản sao CASIA:** không gọi mean-score trên một số frame là mô hình học temporal video. Mạng vẫn dự đoán từng ảnh, video-level chỉ là bước tổng hợp.

## 6. Nội dung nên ở phần chính và phụ lục

### 6.1. Nguyên tắc phân chia

Giữ một nội dung ở phần chính nếu bỏ nó đi khiến người đọc không hiểu **bài toán, quyết định kỹ thuật, đóng góp hoặc độ tin cậy của kết quả**. Đưa xuống phụ lục nếu nội dung phục vụ **tái lập chi tiết, tra cứu, thao tác sử dụng hoặc lịch sử phát triển**.

Không giấu điều kiện làm thay đổi ý nghĩa kết quả ở phụ lục. CASIA overlap, Test-as-Val, một seed, khác sigma giữa P3/R7 và ranh giới tích hợp chưa hoàn tất phải được thấy ngay trong phần chính.

| Nội dung | Phần chính | Phụ lục |
| --- | --- | --- |
| Bài toán, tác nhân, yêu cầu và tiêu chí nghiệm thu | Đầy đủ nhưng ngắn | Biểu mẫu yêu cầu chi tiết nếu có |
| Kiến trúc hệ thống và ranh giới đã tích hợp | Một hình tổng thể, 2–3 sequence/trạng thái | Danh sách service, port, lệnh chạy |
| Pipeline AI | Sơ đồ, contract đầu vào/ra, quyết định xử lý lỗi | Chi tiết lớp mạng, tọa độ template, key config |
| Phương pháp MAST-PAD | Trực giác + 4–6 công thức cốt lõi + pseudocode | DFT đầy đủ, gradient, biến thể R7_SEV |
| Giao thức thực nghiệm | Bắt buộc đủ train/selection/eval, population, threshold | Manifest/hash, package versions, full config |
| Kết quả nghiên cứu | Full-scale, 100K bổ trợ, ablation crop/gate, operating point | Các vòng 01–16, bảng per-split/per-frame đầy đủ |
| So sánh công trình | Định vị ngắn, không xếp hạng trái giao thức | Bảng paper chi tiết, nguồn từng số |
| Cơ sở dữ liệu | ERD và 5–7 ràng buộc quan trọng | Từ điển 111 cột, DDL/index/check chi tiết |
| API | 2–3 luồng trọng tâm và nguyên tắc quyền | Danh sách endpoint/request/response/error |
| Giao diện | 5–7 hình/cụm hình đại diện | Các hình còn lại trong 22 hình hiện có |
| Kiểm thử | Ma trận bao phủ và các kết quả quan trọng | Full test cases, log, payload mẫu đã ẩn bí mật |
| Hạn chế | Phải ở main, sát kết quả và kết luận | Phân tích lỗi dài, trường hợp bổ trợ |

### 6.2. Đề xuất cụ thể cho 22 hình giao diện

**Giữ trong phần chính, có thể ghép thành cụm:**

1. Hình 8.2: tổng quan và nhật ký, để giới thiệu sản phẩm.
2. Hình 8.3 hoặc 8.5: chọn một hình hồ sơ/nhân sự đại diện.
3. Hình 8.7 + 8.8: một cụm đăng ký khuôn mặt và phản hồi xử lý. Phần caption phải phân biệt xử lý ảnh thành công với độ chính xác nhận diện.
4. Hình 8.9: phân ca.
5. Hình 8.11: dữ liệu vào/ra và cách trình bày công.
6. Hình 8.13 hoặc 8.14: chọn một hình bảng/phiếu lương theo mục tiêu giải thích.
7. Một hình employee portal, ưu tiên chứng minh dữ liệu cá nhân khớp cùng kỳ ở phía quản lý.

**Chuyển phụ lục:** hình đăng nhập 8.1; form thêm 8.4; màn hình trước đăng ký 8.6; form ca 8.10; form điều chỉnh 8.12; các tab cá nhân 8.16–8.22 không được chọn; ảnh báo cáo 8.15 nếu chỉ lặp thông tin mà chưa chứng minh phép tính. Các hình này hữu ích cho hướng dẫn sử dụng nhưng không cần mỗi ảnh một đoạn trong main.

Giảm từ 22 xuống 5–7 hình/cụm có thể rút đáng kể Chương 8, đồng thời dành chỗ cho kiểm thử. Không cần xóa ảnh gốc; chuyển và đánh lại tham chiếu.

### 6.3. Cấu trúc phụ lục đề nghị

- **A. Thực nghiệm và tái lập:** bảng đầy đủ các run, protocol groups, hyperparameters, hash, checkpoint, source threshold, coverage và metric per-split.
- **B. Thiết kế dữ liệu chi tiết:** từ điển dữ liệu hiện có, index/CHECK/unique và DDL liên quan; không lặp nguyên cả hình lẫn bảng nếu cùng thông tin.
- **C. API và cấu hình triển khai:** endpoint, quyền, request/response tiêu biểu, phân biệt local/cloud Compose, cách chạy; tuyệt đối không chép secrets.
- **D. Hướng dẫn sử dụng:** ảnh thao tác được chuyển từ Chương 8, theo luồng manager/employee.
- **E. Kiểm thử và minh chứng bổ trợ:** case đầy đủ, output/log, ảnh phần cứng khi đã có, lỗi đã biết.

Nếu quy định khoa giới hạn phụ lục, có thể gộp C–E; không cần tạo nhiều phụ lục ngắn chỉ để đủ tên.

## 7. Đề cương bản cuối được khuyến nghị

**Khuyến nghị 7 chương** để giữ cả chiều sâu AI và tính hoàn chỉnh của PBL6. Ngân sách dưới đây là định hướng biên tập, không thay thế mẫu/quy định của khoa. Theo mục lục hiện tại, main khoảng 76 trang (15–90); có thể hướng về **57–65 trang main**, chưa tính phần đầu, tham khảo và phụ lục.

| Chương đề nghị | Nội dung | Khoảng trang |
| --- | --- | ---: |
| 1. Giới thiệu bài toán và mục tiêu | Bối cảnh, mục tiêu, phạm vi, đóng góp, câu hỏi nghiên cứu | 5–6 |
| 2. Yêu cầu và kiến trúc hệ thống | Tác nhân, workflow, quy tắc công/lương, kiến trúc, ranh giới tích hợp | 9–10 |
| 3. Thiết kế thành phần xác thực khuôn mặt | Pipeline, contract, tracking/PAD gate, worker, enrollment/matching, lỗi | 8–9 |
| 4. Phương pháp huấn luyện MAST-PAD | Động cơ, phổ, margin/gate/loss, scale-aware, giới hạn đối chứng | 8–9 |
| 5. Hiện thực ứng dụng và dữ liệu | ERD, constraint, API/sequence cốt lõi, giao diện chọn lọc | 8–9 |
| 6. Thực nghiệm và kiểm thử | Protocol AI, kết quả, ablation, operating point, hệ thống, latency có chứng cứ | 15–17 |
| 7. Kết luận và phát triển | Mục tiêu đạt/chưa đạt, hạn chế và ưu tiên tiếp theo | 3–4 |

Không phải ép mọi chương đúng số trang. Nếu kiểm thử thật có nhiều kết quả cần phân tích, tăng Chương 6 và giảm ảnh UI; đừng rút phương pháp đến mức không tái lập được.

### 7.1. Mục lục chi tiết gợi ý

**Chương 1:** bối cảnh; mục tiêu hệ thống và nghiên cứu; phạm vi tấn công/phần cứng; đóng góp; cấu trúc báo cáo.

**Chương 2:** tác nhân và use cases; workflow hồ sơ → sinh trắc → ca → log → công → phiếu; quy tắc/ngoại lệ; yêu cầu phi chức năng; sơ đồ deployment; bảng mức hoàn thành.

**Chương 3:** dữ liệu qua pipeline; detection/tracking; raw PAD và temporal decision; alignment/ArcFace; centroid search; enrollment; worker/cache và invalidation; phân biệt kết quả xác thực với nhãn hiển thị.

**Chương 4:** giới hạn của baseline; biến thể phổ; margin và worst-band; gate và loss; BN-safe/warm-up; crop/scale-aware; đối chứng và giả thuyết cần kiểm chứng.

**Chương 5:** ERD logic; constraint và thời gian/tiền; transaction enrollment; trách nhiệm ghi dữ liệu; luồng API nghiệp vụ; 5–7 hình sản phẩm có chú giải.

**Chương 6:** dataset/roles/coverage; recipe và selection policy; chỉ số/ngưỡng; kết quả chính full-scale; 100K/crop/gate ablation; CASIA bổ trợ; chẩn đoán lỗi; ma trận kiểm thử chức năng và quyền; latency/provenance; thảo luận giới hạn.

**Chương 7:** kết quả theo mục tiêu; mức sẵn sàng triển khai; hạn chế; thứ tự phát triển thực tế.

### 7.2. Nếu muốn giữ 9 chương để ít xáo trộn

Vẫn có thể cải thiện tốt bằng các sửa đổi nhỏ hơn:

1. Đưa một trang kiến trúc tổng thể và phạm vi đã tích hợp vào Chương 1.
2. Rút datasets ở Chương 1 còn bảng tóm tắt, chuyển protocol sang Chương 4.
3. Đổi tên Chương 3 theo phương pháp MAST-PAD.
4. Chuyển lịch sử thí nghiệm từ 4.2 xuống Phụ lục A; viết main theo câu hỏi thực nghiệm.
5. Rút Chương 7 còn ERD + ràng buộc, Chương 8 còn 5–7 hình/cụm.
6. Thêm mục “Kiểm thử tích hợp và nghiệp vụ” trước kết luận, tránh kết thúc hệ thống ở mức ảnh UI.
7. Gộp 9.1 và 9.4, giữ hạn chế ngắn và có thứ tự ưu tiên.

Phương án này phù hợp khi đã gần hạn nộp. Không bắt buộc tổ chức lại toàn bộ để sửa được các lỗi P0.

## 8. Cách viết để cân bằng chi tiết, chặt chẽ và dễ đọc

### 8.1. Mỗi tiểu mục nên trả lời một câu hỏi

Ví dụ phần tracking chỉ cần làm rõ: **Vì sao cần track? Track giữ trạng thái gì? Khi nào trạng thái bị hủy?** Không cần lặp lại ba lần chuyện một frame bị sai do chớp mắt/ánh sáng. Phần gate cần làm rõ: **Biến thể nào được chọn? Khi nào thêm loss? Khác baseline ở đâu? Bằng chứng hiện hỗ trợ đến mức nào?**

Một cấu trúc đoạn hiệu quả là: quyết định → lý do → cơ chế → giới hạn/bằng chứng. Tránh liên tiếp nhiều định nghĩa thuật ngữ trước khi nói hệ thống thực sự làm gì.

### 8.2. Giảm ba kiểu lặp phổ biến

- Pipeline sáu bước đã có ở tóm tắt, đóng góp và Chương 2: chỉ Chương 2/3 mới cần giải thích đầy đủ; nơi khác tóm tắt một câu.
- “Không thêm FFT khi suy luận”, “0,434M tham số”, “2,22 ms” lặp nhiều nơi: giữ đặc tính kiến trúc, bỏ lặp latency nếu chưa có nguồn đo.
- Kết quả AUC ở bảng, hình, bullet và kết luận: dùng bảng để tra cứu, hình cho xu hướng, đoạn văn để giải thích ý nghĩa. Không đọc lại từng ô bằng lời.

### 8.3. Chuẩn hóa thuật ngữ và con số

- Tiếng Việt trước, tiếng Anh trong ngoặc ở lần đầu; sau đó dùng một cách gọi nhất quán.
- Dùng “điểm phần trăm” cho chênh lệch 86,03% − 84,60% = 1,43 điểm phần trăm; không gọi là tăng 1,43% tương đối.
- Chọn thống nhất AUC dạng 0–1 hoặc phần trăm trong cùng một bảng/hình; cột phải ghi đơn vị.
- Main dùng AUC 4 chữ số thập phân, tỷ lệ lỗi 2 chữ số sau dấu phẩy là thường đủ; precision đầy đủ để artifact/phụ lục.
- Viết 484.561 mẫu dùng được và 494.405 candidates rõ ràng; “485K” là nhãn quy mô làm tròn, không phải một population khác.
- Giải thích “bona fide = người thật” một lần; không cần luân phiên Real/Bona Fide/Live tùy đoạn nếu không có lý do.
- Không dùng “tối ưu”, “triệt tiêu”, “khẳng định”, “đảm bảo” khi evidence chỉ cho thấy xu hướng trong một số cấu hình.

### 8.4. Gợi ý viết lại một số đoạn then chốt

**Mô tả đóng góp:**

> Nhóm xây dựng các thành phần của hệ thống SmartFace và nghiên cứu MAST-PAD cho bài toán chống giả mạo khuôn mặt. MAST-PAD bổ sung hàm mất mát trên biến thể phổ làm giảm lề phân loại trong huấn luyện; mô hình suy luận giữ nguyên kiến trúc CNN không gian. Thực nghiệm đánh giá ảnh hưởng của crop và recipe huấn luyện trên các tập ngoại miền được khảo sát. Mức hoàn thành tích hợp ứng dụng được báo cáo tách biệt với kết quả benchmark mô hình.

**Diễn giải full-scale sau khi sửa số:**

> Trên LCC Combined, CE-only và C + Aux đạt AUC 0,8440 và 0,8460, còn WBST và MAST-PAD đạt 0,8608 và 0,8603. WBST có EER thấp hơn MAST-PAD trong population này. Trên CASIA Combined tái dựng từ ảnh trích xuất, MAST-PAD có AUC cao nhất, 0,9352, trong khi CE-only có EER thấp nhất, khoảng 16,54%. Các kết quả được quan sát từ một lần huấn luyện mỗi cấu hình; do khác biệt độ rộng bộ lọc và giới hạn dữ liệu CASIA, chưa thể quy toàn bộ chênh lệch cho riêng Harmful Gate.

**Diễn giải trạng thái sản phẩm:**

> Phiên bản hiện có cung cấp luồng quản lý hồ sơ, đăng ký khuôn mặt, phân ca và tra cứu công/lương trên dữ liệu minh họa. Chương trình camera thực hiện PAD và nhận diện, còn backend đảm nhiệm ghi sự kiện nghiệp vụ. Đường tích hợp từ camera đến ghi nhận đầy đủ lượt vào/ra chưa được xác nhận end-to-end; các kết quả mô hình không thay thế kiểm thử tính đúng của dữ liệu công và phiếu lương.

**Kết luận nghiên cứu:**

> Can thiệp phổ trong huấn luyện cho thấy khả năng cải thiện AUC ngoại miền so với đối chứng C + Aux mà không thêm nhánh suy luận. Lợi ích riêng của Harmful Gate chưa nhất quán giữa các quy mô và cần được kiểm tra trong ablation đồng nhất siêu tham số. Các operating point hiện có chưa đủ để kết luận hệ thống đáp ứng yêu cầu bảo mật và thuận tiện trong môi trường triển khai thực tế.

Đây là các mẫu diễn đạt có thể dùng sau khi đồng bộ bảng/hình, không phải một bản tóm tắt thay thế hoàn chỉnh đã đáp ứng mọi biểu mẫu của khoa.

## 9. Hình, bảng, công thức và tài liệu tham khảo

### 9.1. Những gì đã thấy trực tiếp ở ảnh nhúng

- Hình pipeline 2.1 minh họa dễ hiểu, nhưng mang tính tuyến tính; cần chú thích đó là **luồng chức năng**, còn điều phối thời gian/worker mô tả ở sơ đồ riêng. Hình căn chỉnh minh họa không chứng minh xử lý được yaw/pitch như frontalization.
- Hình kết quả AUC 4.3 có chú thích CASIA 358/360 video và dedup ở chân hình, chính xác hơn caption/văn bản xung quanh. Nên chuyển điều kiện này vào caption và bảng, không chỉ để chữ nhỏ trong ảnh.
- Hình kiến trúc 6.1 đã ghi riêng camera worker, Face Auth enrollment, MQTT/ThingsBoard dự kiến; nên giữ nội dung này làm mốc kiến trúc chung.
- ERD 7.1 có các bảng chính và ba bảng vận hành độc lập; nên giữ, nhưng dùng ký hiệu cardinality rõ ở hai đầu quan hệ và giải thích nullable. Không cần sáu hình cấu trúc nhóm bảng nối tiếp trong main.
- Ảnh đăng ký 8.7 có nhiều vùng nền tối, thanh điều hướng và danh sách ít liên quan, kèm một số avatar không tải được. Nên chụp lại/crop vùng thao tác chính; ưu tiên theme sáng khi in nếu sản phẩm có sẵn, không chỉnh ảnh để tạo trạng thái chức năng không có thật.
- Biểu đồ AUC–params 4.5 đã ghi “protocols differ”; nên giữ ghi chú đó nếu dùng và bỏ kết luận xếp hạng hiệu quả vượt quá giao thức.

### 9.2. Các kiểm tra Word phải làm ở lượt dàn trang cuối

DOCX có 62 media assets, 47 bảng và 135 đối tượng Office Math; số assets không đồng nghĩa số hình khoa học vì có logo, công thức hoặc ảnh ghép. Trích xuất chỉ `w:t` sẽ bỏ sót công thức, nên **không được coi các khoảng trống trong bản text extraction là công thức bị mất trong Word**.

Cấu trúc đã có heading riêng, TOC/PAGEREF và nhiều header row lặp. Giữ các cơ chế tự động này; sau sửa cần cập nhật toàn bộ fields. Một số run trong XML có cỡ 9–9,5 pt; cần xem bản render để xác định có phải phần chữ nội dung/bảng đang quá nhỏ hay chỉ là vùng phụ trợ.

Checklist dàn trang:

1. Bảng rộng như 4.1, 4.5, A.1: đọc được khi in A4 ở 100%; nếu quá chật, tách nhóm cột hoặc dùng trang ngang cho phụ lục, không thu toàn bảng xuống chữ rất nhỏ.
2. Heading không nằm đơn độc cuối trang; caption đi cùng hình/bảng; hàng tiêu đề lặp đúng trên bảng nhiều trang.
3. Kích thước chữ trong ảnh sau khi chèn đủ đọc; không chỉ xem ảnh PNG ở kích thước gốc.
4. Mỗi hình có vai trò trong lập luận và được dẫn trong văn bản; caption ghi population/đơn vị/ngưỡng hoặc “minh họa” nếu cần.
5. Không lặp một đoạn số liệu ở cả caption dài, danh mục hình và thân bài. Danh mục hình nên ngắn, điều kiện chi tiết để caption thật.
6. Kiểm tra công thức ở cả Word và PDF xuất: ký hiệu, chỉ số, dấu căn/phân số, dấu âm và chữ tiếng Việt.
7. Kiểm tra số trang sau sửa. XML có hai section đều có thiết lập bắt đầu số trang từ 1; cần xác nhận điều này khớp quy định phần bìa/phần đầu và mục lục.
8. Giữ trang A4 và lề theo mẫu khoa; không đổi sang preset Letter chỉ vì một công cụ tạo tài liệu có mặc định khác.

### 9.3. Rà tài liệu tham khảo có chọn lọc nhưng bắt buộc chính xác

**Sửa ngay:** [1]/AENet như Mục 2.6. Với [7], kiểm tra tên tác giả và trang thật: PDF ESANN có trang **477–482**, không nên để chung `pp. 1–6`. [12] là một bài có metadata ghi nhận được chấp nhận **CVPRW 2024**; có thể cập nhật venue nếu dùng bản kỷ yếu chính thức, thay vì chỉ để arXiv. [Trang tác giả arXiv](https://arxiv.org/abs/2406.12258).

**Rà tiếp:** các mục đang ghi `pp. 1–10`, tên tác giả viết tắt/sai, DOI và năm. Chỉ trích nguồn khi thực sự dùng; [22] Adam có thể bỏ nếu phần phương pháp không dùng Adam hoặc không thảo luận công trình áp dụng nó. Nguồn cho LCC và nguồn InsightFace nên được bổ sung nếu đang mô tả dataset/model package như một thành phần chính.

Đừng suy ra 11 đầu ra spoof-type và 5 đầu ra lighting là số loại attack/điều kiện có thật tương ứng: số output có thể bao gồm real/nhãn dự phòng. Cần giải thích mapping từ code và dataset annotation; nguồn CelebA mô tả 10 spoof types và 4 illumination conditions, trong khi head của nhóm có kích thước lớn hơn. [Mô tả dataset của tác giả](https://arxiv.org/abs/2007.12342).

Không tuyên bố đã xác minh toàn bộ 28 tài liệu tham khảo trong lượt này. Phạm vi kiểm tra ngoài repo tập trung vào các nguồn gây ảnh hưởng trực tiếp đến CASIA, AENet và bảng LCC tham chiếu.

## 10. Thứ tự chỉnh sửa thực tế

### Lượt 1 — Làm cho mọi khẳng định có thể bảo vệ

- [ ] Sửa Bảng 4.1 và mọi kết luận/delta EER liên quan.
- [ ] Sinh lại ba dòng full-scale Phụ lục A từ checkpoint đã khóa; rà lại các vòng còn lại.
- [ ] Thay Bảng 4.4 bằng số đếm thật tại ngưỡng rõ ràng.
- [ ] Bỏ hoặc cung cấp artifact cho FAR < 0,001% và benchmark latency.
- [ ] Sửa AENet, quy mô CASIA và dẫn nguồn không phù hợp.
- [ ] Bổ sung kết quả CE-only mới vào bảng chính, hình và kết luận; bỏ các câu “chưa có kết quả”.
- [ ] Xóa placeholder và hoàn thiện phân công theo thực tế.

### Lượt 2 — Làm rõ nghiên cứu và mức hoàn thành hệ thống

- [ ] Đặt bảng protocol trước kết quả; đưa overlap, Test-as-Val và target reuse vào main.
- [ ] Đổi nhãn baseline thành C + Aux; ghi rõ sigma P3/R7 khác nhau.
- [ ] Bổ sung operating point APCER/BPCER/ACER và coverage.
- [ ] Mô tả pipeline, worker và trạng thái theo phiên bản được báo cáo; không yêu cầu khớp model/cadence camera đang thử nghiệm.
- [ ] Thêm ma trận yêu cầu–triển khai–kiểm thử và bảng case nghiệp vụ.
- [ ] Gắn mỗi tuyên bố “đã kiểm thử/đã hoàn thành” với artifact; để “chưa xác nhận” khi thiếu.

### Lượt 3 — Rút gọn có chủ đích

- [ ] Chuyển lịch sử vòng 01–16, khai triển DFT/gradient, R7_SEV xuống phụ lục.
- [ ] Chuyển Hình 7.2–7.7 khỏi main hoặc bỏ nếu từ điển dữ liệu đã đủ.
- [ ] Chọn 5–7 hình/cụm UI, đưa các thao tác còn lại xuống phụ lục.
- [ ] Rút so sánh paper về vai trò định vị; bỏ tỷ lệ AUC/params và xếp hạng trái giao thức.
- [ ] Gộp kết luận bị lặp; ưu tiên hướng tiếp theo: sửa dữ liệu/protocol → ablation → tích hợp → đo trên thiết bị.

### Lượt 4 — Dàn trang và kiểm tra chéo

- [ ] Dùng cùng một nguồn số cho bảng, hình, tóm tắt và kết luận.
- [ ] Cập nhật TOC, danh mục hình/bảng và cross-references sau khi di chuyển nội dung.
- [ ] Xuất PDF, xem từng trang ở kích thước in, kiểm bảng rộng/công thức/caption.
- [ ] Kiểm tra lại văn bản không còn ghi chú biên tập hoặc câu “cần chèn”.
- [ ] Đối chiếu phân công, yêu cầu biểu mẫu và dung lượng theo quy định của khoa.

## 11. Các câu hỏi cần chuẩn bị cho buổi bảo vệ

1. CE-only mới cho biết thêm gì về giám sát phụ trợ? So sánh nào đo lợi ích toàn recipe và so sánh nào có thể cô lập Harmful Gate?
2. AUC 86% nhưng BPCER ở ngưỡng nguồn hơn 46% trên LCC thì mô hình đang hữu ích đến đâu?
3. Nếu P3 và R7 khác sigma, làm sao biết cải thiện đến từ gate?
4. Có dùng LCC để chọn crop/recipe qua nhiều vòng không? Vậy final test độc lập là tập nào?
5. CASIA copy bị overlap đến mức nào? Tại sao vẫn báo combined? Metric đó hỗ trợ kết luận nào và không hỗ trợ kết luận nào?
6. Vì sao CE-only có EER tốt hơn R7 trên CASIA Combined nhưng AUC thấp hơn? Hai chỉ số mô tả điều gì khác nhau?
7. Khi cloud trả chậm hoặc người rời camera, vì sao kết quả cũ không bị áp cho người mới?
8. Một lượt MATCH hiện có tự sinh attendance log không? Đường nào đã chạy thật, đường nào mới có handler?
9. Lương của người 0 giờ công sẽ ra sao? FINALIZED có được bảo vệ tại server không?
10. Số 2,22 ms và 67,98 ms đo ở đâu, provider nào, có log và script tái lập không?

Các câu trả lời tốt nên chỉ vào bảng protocol, sơ đồ trạng thái, artifact và bảng kiểm thử đã có; không cần tăng số thuật ngữ để trả lời.

## 12. Danh sách nguồn repo đã dùng để đối chiếu

Các đường dẫn dưới đây là nguồn trong checkout tại ngày đánh giá. Tài liệu trạng thái dùng làm bản đồ, còn số liệu và hành vi quan trọng đã đối chiếu với source/config/artifact tương ứng.

| Nguồn | Dùng để kiểm tra |
| --- | --- |
| [Full-scale source of truth](../../face_auth/md/FULLSCALE_MODEL_RESULTS_SOURCE_OF_TRUTH.md) | Quy ước metric, bảng đối chiếu, đường dẫn artifact |
| [CE-clean full-scale report mới](../../face_auth/md/ce_clean_fullscale_report.md) | Kết quả CE-only do người dùng cung cấp; cập nhật trạng thái cũ trong Word/tài liệu tổng hợp |
| [Experiment 18](../../face_auth/antispoof/notebooks/final/binary_crossdomain_v2/output/18_fullscale_C_P3SF_R7SC_crop15) | Per-run config, freeze, test/LCC metrics, predictions, complexity |
| [CASIA evaluation output](../../face_auth/antispoof/notebooks/final/binary_crossdomain_v2/output/casia_train_test_C_P3SF_R7SC_100k_fullscale) | Combined/test, overlap, aggregation và threshold policies |
| [Runtime PAD JSON](../../face_auth/antispoof/models/R7_SC_100K_crop15_runtime_config_casia.json) | Đã xem để hiểu repo; không dùng sự khác model camera làm tiêu chí phê bình nghiên cứu |
| [Config](../../face_auth/config.py) | Thứ tự ưu tiên config, cadence, ngưỡng và temporal votes |
| [Camera app](../../face_auth/app.py) | PAD quality gates, worker integration, attendance hook tắt |
| [Tracker](../../face_auth/tracking/tracker.py) | IoU/LK, generation invalidation và display identity |
| [Recognition worker](../../face_auth/recognition/worker.py) | Queue, bất đồng bộ, cache và DB lookup |
| [Vector DB](../../face_auth/database/vector_db.py) | Schema contract, lọc CENTROID/model/active, ghi enrollment |
| [Face Auth API](../../face_auth/api_service.py) | Luồng enrollment HTTP và ranh giới auth nội bộ |
| [LFW benchmark notebook](../../face_auth/evaluation/lfw_identity_benchmark.ipynb) | Output calibration và bảng test đang lưu; không phải rerun |
| [Prisma schema](../../backend/prisma/schema.prisma) | Bảng, kiểu, quan hệ và unique constraints |
| [Attendance service](../../backend/src/modules/attendance/attendance.service.ts) | Log, tổng hợp, điều chỉnh và khóa công |
| [Payroll service](../../backend/src/modules/payroll/payroll.service.ts) | Fallback 176 giờ, cập nhật/generate/finalize |
| [Device MQTT handler](../../backend/src/modules/devices/device.mqtt.handler.ts) | HMAC/timestamp, điều kiện môi trường và check-in handler |
| [Auth middleware](../../backend/src/middlewares/auth.middleware.ts) | Kiểm JWT và giới hạn xác nhận trạng thái tài khoản |
| [Compose local](../../docker-compose.yml), [Compose cloud](../../docker-compose.cloud.yml), [run.sh](../../run.sh) | Ranh giới service, bind API và lựa chọn cách chạy |

**Tiêu chuẩn để chốt bản báo cáo:** mỗi con số quan trọng có nguồn và đúng population; mỗi kết luận nằm trong giới hạn của phép đo; mỗi chức năng có trạng thái hoàn thành rõ; mỗi hình/bảng trong main phục vụ một luận điểm. Phần phụ lục giữ khả năng tra cứu và tái lập, còn phần chính dẫn người đọc qua những quyết định và bằng chứng quan trọng nhất.
