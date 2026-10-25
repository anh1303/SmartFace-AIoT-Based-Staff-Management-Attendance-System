# Thu ảnh và thử nghiệm điều chỉnh ánh sáng PAD

## Chạy app thu thập

Dùng cùng Python environment, camera, kết nối DB và cấu hình của app realtime:

```bash
cd face_auth
python3 app_capture.py --camera 0 --subject person01 --condition "backlight_window"
```

Hoặc bật tính năng thu thập trên entrypoint gốc:

```bash
python3 app.py --capture-dir ./pad_captures --subject person01 --condition "dim_room"
```

- `C`: lưu tối đa `MAX_FACES_PER_FRAME` mặt đang theo dõi, không cần PAD REAL hoặc nhận diện khớp.
- `Q` / Esc: thoát; `P`: bật/tắt PAD; `F`: bật/tắt FPS như app.
- Mỗi lần chạy tạo session UUID riêng. Đổi điều kiện thì chạy lại với `--condition` mới.
- Chỉ chụp khi bạn thấy tình huống cần lưu; không tự ghi ảnh liên tục.
- Nếu một khung có nhiều người, sửa `subject_id` riêng cho từng ảnh sau khi chụp; `--subject` chỉ là giá trị khởi tạo.
- Không có mặt được detect/track thì không có crop để lưu.

`face_auth/pad_captures/` được loại khỏi Git. Mỗi phiên chụp có:

| File | Nội dung |
| --- | --- |
| `*_frame.png` | Frame camera nguyên bản chưa vẽ; lưu một lần cho các mặt trong cùng lượt C, dùng thử crop rộng hơn về sau |
| `*_crop.png` | Crop đã expand đúng factor/mode đang áp dụng, độ phân giải gốc, chưa gamma/align/vẽ chữ |
| `*_input.png` | Crop hình học trước tiền xử lý model; với MiniFASNet là crop resize về kích thước model |
| `labels.json` | Chỉ chứa tên file crop và nhãn do bạn gán: `null`, `real` hoặc `fake` |
| `metadata.json` | Thông số từng ảnh, tra theo cùng tên file crop: subject/session/condition, bbox/landmarks, model/config/threshold, kết quả PAD và thống kê độ sáng |

Chỉ cần mở **`labels.json`** để đánh nhãn cho cả phiên:

```json
{
  "abc_track1_crop.png": "real",
  "abc_track2_crop.png": "fake",
  "def_track1_crop.png": null
}
```

Giữ nguyên tên file (key), chỉ đổi giá trị thành `real`/`fake`; `null` là chưa gán nhãn. Lưu file trước khi chụp tiếp. App đọc lại nhãn mỗi lần chụp và chỉ thêm ảnh mới, giữ nhãn đã gán; nếu JSON sai cú pháp thì báo lỗi và không ghi đè. `metadata.json` không chứa nhãn thủ công. `capture_pad_result` là dự đoán, **không phải nhãn thật**. Không đưa cả crop và input của cùng mẫu vào tập đánh giá như hai ảnh độc lập.

Metadata mới có `frame_file` liên kết ảnh gốc của lượt chụp (schema v3). Định dạng này áp dụng cho ảnh chụp mới; các dữ liệu theo định dạng cũ không bị thay đổi. Thư mục pad_captures trong workspace đang trống khi cập nhật nên không có ảnh cũ cần chuyển đổi.

Ảnh đã expand: khi thử nghiệm phải resize/preprocess trực tiếp, **không detect/crop expand lần nữa**. Chế độ capture dùng bbox hiện tại, không smoothing hình học; JSON ghi rõ điều này. Điểm lúc chụp là inference riêng trên crop lưu, không thay đổi vote hoặc bộ đếm recognition. Inference bổ sung và ghi đĩa chỉ chạy khi nhấn C, có thể làm đứng hình ngắn lúc chụp.

## Giới hạn mặt

Trong `.env` và `.env.example` của cả face_auth và hardware:

```env
MAX_FACES_PER_FRAME=3
```

Chọn các mặt lớn nhất nếu phát hiện nhiều hơn giới hạn; giới hạn trước khi đưa vào tracker và trước PAD/recognition, kể cả frame optical flow. Detector vẫn quét toàn khung để tìm ứng viên. Tham số phải >=1; khởi động lại app sau khi đổi. Đây không phải giới hạn tổng số track cũ còn được giữ trong bộ nhớ.

## Thu dữ liệu để chọn cách tối ưu

1. Thu cả mặt thật và spoof ở ánh sáng bình thường, tối, ngược sáng, sáng lệch một bên, cháy sáng; nhiều người và nhiều phiên. Với spoof ghi thêm loại tấn công vào condition, ví dụ màn hình điện thoại hoặc ảnh in.
2. Tách người/phiên cho tập thử tham số và tập đánh giá giữ riêng. Các ảnh gần nhau trong cùng phiên ở cùng tập; không chia ngẫu nhiên từng ảnh.
3. So từng phương pháp với ảnh gốc, giữ cùng model, crop và threshold trước; báo APCER (spoof lọt), BPCER (real bị chặn), phân bố d-t và thời gian xử lý/crop trên Pi.
4. Sau khi chọn tiền xử lý mới, hiệu chỉnh threshold nếu cần trên tập hiệu chỉnh; đánh giá giữ riêng, rồi thử camera/temporal vote. Export cấu hình riêng trước khi áp dụng.

## Các phương pháp nhẹ nên thử

Đây là các ứng viên thử nghiệm, chưa chứng minh cải thiện PAD trên camera hiện tại.

| Ưu tiên | Cách thử | Tham số ban đầu để thử | Điểm cần đo |
| --- | --- | --- | --- |
| 1 | Gamma thích nghi bằng LUT, chỉ bật khi tối | gamma giới hạn 0.7–1.3, deadband độ sáng, target Y 100/110/120 | Dùng luminance Y thay V, tránh kéo sáng mạnh làm mất texture spoof |
| 2 | Gain tuyến tính giới hạn trên luminance | gain 0.8–1.3; bỏ qua khi đủ sáng | Nhanh, nhưng dễ clip vùng sáng; đo tỷ lệ pixel bão hòa |
| 3 | CLAHE nhẹ trên Y hoặc L, blend với ảnh gốc | clipLimit 1.2/1.5/2.0; tile 4×4 hoặc 8×8; blend 0.2/0.4 | Có thể giúp sáng lệch nhưng tăng nhiễu/đổi texture, cần đo spoof lọt |
| 4 | Làm mượt tham số sáng theo từng track | EMA alpha 0.1/0.2; reset khi mất track | Giảm nhấp nháy; cần chuỗi video, ảnh tĩnh không chứng minh ổn định theo thời gian |

Thử từng thay đổi riêng trước khi ghép; chưa đổi gamma/threshold hoặc tiền xử lý đang chạy. Không ưu tiên denoise mạnh, sharpening mạnh, Retinex nhiều tỉ lệ hay mô hình enhancement cho Pi ở bước đầu. Ảnh đã cháy sáng/mất chi tiết không thể phục hồi texture chỉ bằng đổi độ sáng.

Nguồn thuật toán: [OpenCV — linear brightness/contrast, gamma và LUT](https://docs.opencv.org/4.x/d3/dc1/tutorial_basic_linear_transform.html), [OpenCV — CLAHE](https://docs.opencv.org/5.0/main_modules/classcv_1_1CLAHE.html). Các khoảng tham số trên là đề xuất thử nghiệm cho dự án, không phải kết quả đo.

## Kiểm chứng

Đã kiểm tra offline bằng ảnh tổng hợp: chọn tối đa 3 mặt lớn nhất, crop lưu khớp crop runtime, không sửa pixel gốc, label vẫn null khi PAD báo SPOOF và vẫn lưu khi PAD trả kết quả rỗng. Chưa nghiệm thu camera/GUI, FPS hoặc chất lượng PAD ngoài thực tế.
