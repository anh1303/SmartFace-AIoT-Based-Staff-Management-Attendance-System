# Quy tắc từ chấm công đến tính lương

**Phạm vi:** lịch ca, ghi nhận lượt vào/ra, tổng hợp công, cảnh báo, duyệt OT và các khoản phạt, tính và chốt lương.

**Múi giờ nghiệp vụ:** `Asia/Ho_Chi_Minh` (UTC+7).

**Căn cứ:** hành vi của mã nguồn hiện tại trong workspace, bao gồm các thay đổi chưa commit. Đây là tài liệu mô tả hệ thống, không phải xác nhận một chính sách lao động hay quy định pháp luật.

Tài liệu dùng từ **tự động** khi hệ thống tự làm; **đề xuất** khi hệ thống tạo khoản chờ quyết định; và **được duyệt** khi người có quyền đã xác nhận. Không đồng nhất ba việc này. Các ví dụ mặc định dùng ngày ca từ 29/10/2026, trừ khi ghi khác.

## 1. Luồng tổng thể

1. Phân lịch cho nhân viên theo ngày bắt đầu ca, gồm ca làm hoặc OFF.
2. Ghi nhận lượt `CHECK_IN` và `CHECK_OUT`. Mỗi lượt được lưu riêng cùng thời điểm và trạng thái.
3. Ghép các lượt hợp lệ thành cặp vào–ra, tính thời gian thực tế theo ca và tổng hợp ngày công.
4. Hệ thống đánh dấu ngày bất thường, gửi cảnh báo thiếu lượt khi đủ điều kiện, tạo đề xuất OT hoặc phạt theo từng ngày.
5. Quản lý kiểm tra ngày cần rà soát, điều chỉnh đề xuất khi cần và duyệt hoặc từ chối từng khoản.
6. Tính bảng lương tháng từ công ngày và các khoản đã duyệt; người có quyền chỉ sửa phụ cấp trên phiếu lương.
7. Kiểm tra lại dữ liệu và chốt kỳ khi đủ điều kiện. Phiếu đã chốt không bị tính lại đè lên.

Các bước ghi log, tổng hợp, duyệt và tính lương là các bước riêng. Việc có lượt quét không có nghĩa đã có cặp hợp lệ; có cặp hợp lệ không đồng nghĩa đủ điều kiện nhận công; có đề xuất OT hoặc phạt không đồng nghĩa khoản đó đã được đưa vào lương.

## 2. Lịch ca và ngày công

### 2.1. Thời gian ca

Mỗi lịch chỉ rõ ngày ca, loại ca, giờ bắt đầu và kết thúc. Hệ thống hỗ trợ các loại ca sau:

| Loại | Bắt đầu | Kết thúc |
|---|---:|---:|
| Hành chính | 08:00 | 17:00 |
| Sáng | 08:00 | 12:00 |
| Chiều | 13:00 | 17:00 |
| Ca khác (`OTHER`) | Giờ tùy chỉnh | Giờ tùy chỉnh |
| OFF | Ngày nghỉ | Không có công thường hoặc OT tự động |

**Ca khác** dùng khi giờ làm không trùng ba ca cố định. Người phân ca chọn giờ bắt đầu và giờ kết thúc khác nhau, hoặc dùng một mẫu ca đã tạo. Giờ kết thúc sau giờ bắt đầu là ca trong ngày; giờ kết thúc trước giờ bắt đầu là ca qua đêm và ngày được chọn là ngày bắt đầu ca. Các quy tắc ghép lượt, ngưỡng công, làm tròn, OT và trễ/sớm vẫn áp dụng theo thời lượng và giờ thực tế của ca này.

Ví dụ ca khác 10:00–19:00 dài 9 giờ; từ ngày 29/10/2026 cần ít nhất 6 giờ thực tế trong ca để được tính công thường cả ca. Ca khác 22:00 ngày 10–06:00 ngày 11 dài 8 giờ, thuộc ngày công 10 và chỉ được kết luận vắng sau khi ca kết thúc lúc 06:00 ngày 11.

Giờ thực tế của ca được lấy từ lịch đã phân; ví dụ trong tài liệu không thay thế lịch riêng của nhân viên. Không tự trừ một khoảng nghỉ trưa cố định. Khoảng giữa một lượt OUT và IN kế tiếp không phải thời gian được ghi nhận, nhưng cũng không tự tạo khoản phạt giữa ca.

- Giờ kết thúc nhỏ hơn giờ bắt đầu: ca kết thúc vào ngày hôm sau. Ví dụ ca 22:00 ngày 10 đến 06:00 ngày 11 thuộc ngày ca 10.
- Hai mốc bằng nhau: ca 0 giờ; không tự đề xuất phạt vắng. Quy trình tạo ca thông thường không cho tạo mẫu ca hoặc ca tùy chỉnh có hai mốc bằng nhau.
- Ca chưa kết thúc: chưa kết luận vắng hoàn toàn; ca qua đêm phải chờ đến giờ kết thúc thực tế.
- Ngày không có lịch: không tự gán một ca mặc định để trả lương hoặc phạt vắng.

### 2.2. Gán lượt vào ngày ca

Một cặp được gán theo ngày của lượt IN, có xét ca được phân. Lượt đến trong khoảng một giờ trước giờ bắt đầu ca hoặc trong ca có thể được gán vào ngày ca; IN quay lại sau nửa đêm trong ca đêm vẫn có thể thuộc ngày ca hôm trước. Khi có nhiều ca ứng viên, bộ chọn ưu tiên ca đang diễn ra theo thứ tự của hệ thống. Nếu không có ca phù hợp, dùng ngày lịch Việt Nam của IN.

Hệ thống đọc thêm log và ca lân cận khi tổng hợp để ghép cặp qua ngày hoặc qua tháng. Một cặp chỉ được tính cho một ngày ca, không cộng cả hai kỳ.

## 3. Ghi nhận lượt chấm công

### 3.1. Lưu lượt

Mỗi lượt lưu nhân viên, loại vào/ra, thời điểm sự kiện, ngày công được gán, phương thức, thiết bị và trạng thái. Dữ liệu gốc vẫn được giữ khi lượt thừa, không ghép được hoặc bị gắn cờ. `TAN_CA` trong dữ liệu cũ được hiểu là OUT.

Với điểm danh khuôn mặt, thiết bị gửi thời điểm chụp và mã sự kiện. Gửi lại cùng mã sự kiện của cùng thiết bị cho cùng nhân viên và loại lượt không tạo thêm lượt mới; hệ thống có thể thử tổng hợp lại. Hai mã khác nhau là hai lượt khác nhau. Chỉ coi việc ghi nhận thành công khi backend xác nhận; gửi lên thiết bị trung gian thành công chưa chứng minh đã lưu công.

Lượt điểm danh thủ công do Admin hoặc Manager thực hiện theo phạm vi được cấp, được phân biệt với lượt khuôn mặt và có nhật ký. Thời điểm quét quá tương lai trên 2 phút hoặc cũ hơn 24 giờ so với lúc nhận bị đánh dấu `FLAGGED`. Lượt đến sau khi ngày đã khóa hoặc phiếu lương của nhân viên đã chốt cũng được lưu và đánh dấu `FLAGGED`, không tự sửa kết quả đã khóa.

### 3.2. Xác thực khuôn mặt

Luồng nhận diện yêu cầu xác minh cùng nhân viên liên tiếp theo cơ chế xác nhận của thiết bị/backend, kèm kiểm tra chống giả mạo hợp lệ, trước khi ghi lượt. Retry cùng lượt nhận diện không được tính thành một lần xác nhận mới. Đổi người, mất điều kiện xác thực hoặc thay phiên theo dõi có thể làm chuỗi xác nhận bắt đầu lại. Kết quả giả mạo không phải lượt công hợp lệ.

### 3.3. Ví dụ lượt thừa hoặc không hợp lệ

| Các lượt theo thứ tự thời gian | Cách xử lý |
|---|---|
| IN 08:00 → OUT 12:00 → IN 13:00 → OUT 17:00 | Hai cặp; khoảng 12:00–13:00 không được tính là thời gian thực tế. |
| IN 08:00 → IN 09:00 → OUT 17:00 | IN 09:00 thay IN đang chờ; cặp là 09:00–17:00; IN 08:00 vẫn được lưu. |
| IN 08:00 → OUT 17:00 → OUT 19:00 | Cặp 08:00–17:00; OUT 19:00 không kéo dài cặp và không tự tạo OT. |
| OUT 08:00 không có IN | Không tạo cặp hoặc giờ làm từ lượt OUT đó. |
| IN → sự kiện `FLAGGED` → OUT | Sự kiện bị gắn cờ ngắt lượt đang chờ; không nối xuyên qua để tạo cặp. |

## 4. Ghép cặp và tổng hợp

### 4.1. Cặp hợp lệ

Với từng nhân viên, hệ thống sắp xếp lượt theo thời điểm tăng dần; cùng thời điểm thì theo ID. IN mở một lượt chờ; OUT kế tiếp đóng lượt đang chờ. OUT phải sau IN và cách IN **không quá 24 giờ**. Đúng 24 giờ được ghép; dài hơn 24 giờ hoặc hai mốc bằng nhau không tạo cặp hợp lệ. Không tự tạo lượt còn thiếu hay thay lượt thiếu bằng giờ bắt đầu/kết thúc ca.

Ví dụ IN 08:00 ngày 10 → OUT 08:00 ngày 11 là cặp 24 giờ. OUT lúc 08:00:01 ngày 11 vượt giới hạn và không tạo cặp hợp lệ. Cặp hợp lệ vẫn có thể cần rà soát vì OT dài hoặc điều kiện khác.

### 4.2. Thời điểm tổng hợp và phục hồi

Sau khi ghi lượt, backend tổng hợp các ngày liên quan; nếu tổng hợp lỗi, log gốc vẫn được giữ và việc gửi lại cùng sự kiện có thể thử lại. Tác vụ nền mặc định tổng hợp tháng hiện tại và tháng trước mỗi 30 phút, bắt đầu sau khi backend khởi động. Đây không phải cam kết tổng hợp chính xác vào 00:00.

Nhân viên đã đổi trạng thái vẫn được xét nếu có lịch ca trong khoảng tổng hợp. Nếu tác vụ bị gián đoạn và dữ liệu thuộc kỳ cũ hơn tháng trước, cần chủ động gọi tổng hợp lại kỳ đó. Nếu tác vụ tổng hợp kỳ thất bại, hệ thống ghi trạng thái lỗi, thông báo Admin và chặn khóa/chốt theo kiểm tra trạng thái tổng hợp.

### 4.3. Thời gian thực tế trong ca

Với mỗi cặp hợp lệ thuộc ngày ca, chỉ lấy phần giao giữa cặp và khoảng bắt đầu–kết thúc ca:

```text
thời gian trong ca của cặp = max(0, min(OUT, hết ca) - max(IN, bắt đầu ca))
thời gian thực tế trong ca của ngày = tổng thời gian trong ca của các cặp
```

Đến trước ca không làm tăng giờ công thường. Chỉ thời gian thực sự nằm sau giờ kết thúc ca của các cặp được xét làm OT; không tính khoảng đã OUT. Các khoảng thực tế được cộng bằng giây trước khi so với ngưỡng hoặc làm tròn.

## 5. Điều kiện được tính công thường

### 5.1. Ngưỡng theo ngày hiệu lực

| Ngày ca | Ngưỡng thời gian thực tế trong ca |
|---|---|
| Trước 29/10/2026 | Ít nhất 1/2 độ dài ca, chính sách `2026-10-26-v5`. |
| Từ 29/10/2026 | Ít nhất 2/3 độ dài ca, chính sách `2026-10-29-v6`. |

Nếu đạt ngưỡng, công thường tự động bằng **cả độ dài ca**, sau đó làm tròn theo mục 6. Nếu dưới ngưỡng, công thường, OT tự đề xuất và giờ phạt trễ/sớm tự động đều bằng 0. Nếu có cặp nhưng dưới ngưỡng, ngày được đánh dấu cần rà soát; không tự coi là vắng hoàn toàn.

Ví dụ ca 08:00–17:00 dài 9 giờ, ngưỡng 2/3 là 6 giờ. Đúng 6 giờ thực tế được ghi 9 giờ công thường; 5 giờ 59 phút 59 giây được ghi 0 giờ tự động và cần rà soát. Ca 4 giờ có ngưỡng 2 giờ 40 phút. Hai cặp trong cùng ngày được cộng phần thực tế trước khi so ngưỡng.

Nếu đạt ngưỡng dù có khoảng OUT→IN giữa ca, hệ thống vẫn ghi công cả ca và không tạo thêm phạt cho khoảng giữa. Ví dụ ca 08:00–17:00, IN 08:00–OUT 12:00 và IN 13:00–OUT 17:00: 8 giờ thực tế đạt ngưỡng, công thường là 9 giờ.

### 5.2. OFF, chưa có ca và ca 0 giờ

- **OFF:** lưu lượt nếu có; công thường và OT tự động bằng 0, không tự tạo phạt vắng. Người có quyền có thể đề xuất OT thủ công có lý do rồi duyệt riêng.
- **Chưa có ca:** không tự tính công, OT hay phạt vắng. Nếu có lượt, ngày cần rà soát; có thể phân ca rồi tổng hợp lại.
- **Ca 0 giờ:** không tự tạo phạt vắng. Không suy ra một ca làm có độ dài dương từ hai mốc bằng nhau.

## 6. Làm tròn giờ

Công thường, OT đề xuất và tổng trễ/sớm dùng quy tắc làm tròn xuống theo nửa giờ, sau khi cộng thời gian liên quan trong ngày:

| Tổng thời gian | Giá trị tính |
|---|---:|
| 29 phút 59 giây | 0 giờ |
| 30 phút đến dưới 60 phút | 0,5 giờ |
| 1 giờ 29 phút | 1 giờ |
| 1 giờ 30 phút đến dưới 2 giờ | 1,5 giờ |
| 1 giờ 45 phút | 1,5 giờ |

Tổng tháng là tổng giá trị đã làm tròn theo ngày, không cộng nguyên cả tháng rồi mới làm tròn. Các mốc đủ điều kiện 2/3 ca, trên 30 phút OT và trên 4 giờ OT được xét bằng thời gian gốc trước khi làm tròn. Do đó, đúng 30 phút tự làm tròn thành 0,5 giờ nhưng vẫn **không vượt** ngưỡng để tự đề xuất OT.

## 7. Thiếu lượt, cảnh báo và ngày cần rà soát

### 7.1. Cảnh báo thiếu lượt sau ca

Tác vụ cảnh báo mặc định kiểm tra mỗi phút. Với ca làm có thời lượng dương của nhân viên đang `ACTIVE`, từ **30 phút sau giờ kết thúc ca**, hệ thống kiểm tra xem có lượt IN và OUT hợp lệ được gán cho ca hay không. Nếu thiếu, hệ thống tạo thông báo cho nhân viên có tài khoản, Admin hoạt động và Manager phù hợp trong phạm vi phòng ban/quyền quản lý. OFF và ca 0 giờ không tạo cảnh báo này.

Thông báo phân biệt thiếu IN, thiếu OUT hoặc thiếu cả hai. Việc có cả một IN và một OUT hợp lệ chỉ thỏa điều kiện kiểm tra **thiếu loại lượt**; không thay thế việc kiểm tra chúng có ghép thành cặp và đủ điều kiện tính công hay không. Nếu dịch vụ dừng, tác vụ dùng mốc đã xử lý để tiếp tục khi chạy lại; mỗi lượt xử lý bù tối đa bảy ngày. Phạm vi cảnh báo hiện lọc nhân viên đang `ACTIVE` tại lúc kiểm tra.

### 7.2. Chỉ có một lần check-in

Ví dụ ca 08:00–17:00, chỉ có IN 08:00 và không có OUT:

1. IN vẫn được lưu trong database, nhưng chưa tạo thành cặp hợp lệ.
2. Từ 17:30, nếu các điều kiện cảnh báo ở mục 7.1 được đáp ứng, hệ thống tạo thông báo thiếu check-out.
3. Không có cặp hợp lệ khác thì công thường tự động của ngày là **0 giờ**; OT và trễ/sớm tự động cũng là 0. Ngày được đánh dấu thiếu OUT/cần rà soát.
4. Hệ thống **không tự tạo phạt vắng** cho ngày có lượt chưa hoàn chỉnh. Nếu không xử lý, trạng thái cần rà soát sẽ chặn khóa ngày hoặc chốt lương; không có bước tự chốt và tự trừ phạt vắng chỉ vì đã hết ngày.
5. Quản lý xác minh theo quyền và căn cứ thực tế. Điều chỉnh ngày hiện hỗ trợ xử lý cờ rà soát và đề xuất OT/trễ-sớm có lý do; nó không tự tạo OUT quá khứ hoặc tự sửa công thường thành một số giờ giả. Nếu có quyết định bù tiền, phụ cấp trên phiếu lương có thể được điều chỉnh kèm lý do.

Nếu đã có một hoặc nhiều cặp hợp lệ khác và còn một IN thiếu OUT, hệ thống tính điều kiện công từ các cặp hợp lệ đó, nhưng vẫn đánh dấu lượt đang mở để rà soát. Không lấy giờ ca làm OUT cho lượt thiếu.

### 7.3. Các trường hợp khác

| Tình huống | Xử lý tự động và việc cần làm |
|---|---|
| Chỉ có OUT, không có IN | Không tạo cặp hoặc công từ OUT lẻ; cần rà soát. Sau hạn cảnh báo có thể gửi thiếu check-in. |
| Không có IN và không có OUT | Sau khi ca kết thúc, đủ điều kiện có thể tạo ngày vắng và khoản phạt vắng chờ duyệt; sau 30 phút có thể gửi cảnh báo thiếu cả hai. |
| Có IN và OUT nhưng cặp quá 24 giờ hoặc bị ngắt | Không coi là cặp hợp lệ; giữ log và yêu cầu rà soát. Không mặc nhiên coi việc có đủ hai loại lượt là có công. |
| Có cặp hợp lệ nhưng dưới ngưỡng | Công thường, OT và trễ/sớm tự động bằng 0; cần rà soát, không tự phát sinh phạt vắng. |
| Có log `FLAGGED` | Giữ log, đánh dấu cần rà soát; không dùng log này như lượt hợp lệ để tạo cặp. |
| Không có ca nhưng có lượt | Không tự cấp công/OT hay phạt vắng; cần rà soát lịch và dữ liệu. |
| OT thực tế trên 4 giờ | Đề xuất OT theo quy tắc, đồng thời gắn cờ cần rà soát; không tự cắt còn 4 giờ. |

## 8. Tăng ca (OT)

### 8.1. Khi nào tự đề xuất

Cần đồng thời có ca làm khác OFF, cặp hợp lệ, thời gian thực tế trong ca đạt ngưỡng của ngày và tổng thời gian làm sau ca **lớn hơn 30 phút**. Sau khi vượt ngưỡng, toàn bộ thời gian sau ca được làm tròn để đề xuất; không trừ 30 phút đầu.

| Ca 08:00–17:00 | OT thực tế | Kết quả |
|---|---:|---|
| IN 08:00, OUT 17:30 | 30 phút | Không tự đề xuất OT. |
| IN 08:00, OUT 17:40 | 40 phút | Đề xuất 0,5 giờ, chờ duyệt. |
| IN 08:00, OUT 21:00 | 4 giờ | Đề xuất 4 giờ, chờ duyệt. |
| IN 08:00, OUT 21:01 | 4 giờ 1 phút | Đề xuất 4 giờ sau làm tròn và gắn cờ OT trên 4 giờ. |
| IN 14:00, OUT 18:00 | 1 giờ sau ca | Dưới ngưỡng 2/3 của ca 9 giờ, không tự đề xuất OT. |

### 8.2. Xử lý OT

Mỗi nhân viên/ngày có khoản OT riêng. Quản lý có thể sửa số giờ đề xuất, kể cả lớn hơn số đo tự động để xử lý sự cố, nhưng phải có lý do; thao tác này không đồng nghĩa đã duyệt. Khoản sau đó cần được duyệt riêng. Chỉ giờ OT `APPROVED` được cộng vào lương; `REJECTED` không được cộng; `PENDING` chặn chốt. Đưa đề xuất về 0 có thể chuyển khoản không còn phát sinh thành `VOID`.

## 9. Đi trễ, về sớm và vắng ca

### 9.1. Trễ/sớm

Chỉ tự xét khi đạt ngưỡng công của ngày. Hệ thống lấy IN đầu và OUT cuối của các cặp hợp lệ thuộc ngày để tính thời gian sau giờ bắt đầu và trước giờ kết thúc ca, giới hạn mỗi phần theo độ dài ca. Cộng trễ và sớm rồi làm tròn một lần. Nhãn đi trễ được áp dụng khi trễ **trên 15 phút**; ngưỡng nhãn không tự quyết định giờ phạt sau làm tròn.

Ví dụ: trễ 20 phút được gắn nhãn trễ nhưng làm tròn giờ phạt còn 0; trễ 30 phút đề xuất 0,5 giờ; trễ 20 phút và về sớm 20 phút đề xuất 0,5 giờ. Khoản trễ/sớm phải được duyệt riêng; chỉ khoản `APPROVED` được trừ tiền.

### 9.2. Vắng hoàn toàn

Khoản vắng chỉ tự đề xuất khi đã có ca làm không phải OFF, thời lượng dương, ca đã kết thúc và không có sự kiện thuộc ngày ca hoặc vấn đề ghép cặp cần xác minh. Nghỉ có phép không được hệ thống tự suy ra: người có quyền xem xét khoản và có thể từ chối, kèm ghi chú.

```text
tiền phạt vắng đề xuất = làm tròn VNĐ(giờ ca chính xác × lương giờ × hệ số vắng)
```

Hệ số mặc định là 2,0. Ví dụ ca 8 giờ, lương 100.000 đồng/giờ: đề xuất 8 × 100.000 × 2 = **1.600.000 đồng**. Khoản ở trạng thái `PENDING`, chỉ trừ khi `APPROVED`. Giờ ca tính khoản vắng là thời lượng chính xác, không phải giờ công đã làm tròn. Ngày chỉ có IN hoặc OUT không tự bị coi là vắng hoàn toàn như ví dụ này.

## 10. Sổ khoản theo ngày và quyết định duyệt

Hệ thống lưu riêng mỗi loại cho từng nhân viên/ngày: `OVERTIME` (OT), `LATE_EARLY` (trễ/sớm), `ABSENCE` (vắng). Mỗi khoản có căn cứ, số giờ, trạng thái, ghi chú và thông tin quyết định; khoản vắng lưu số tiền và căn cứ đơn giá/hệ số. OT và trễ/sớm được định giá theo số giờ và đơn giá/hệ số của phiếu tương ứng.

| Trạng thái | Ý nghĩa | Tác động đến chốt/tính lương |
|---|---|---|
| `PENDING` | Đề xuất đang chờ quyết định. | Không tính vào lương; chặn chốt. |
| `APPROVED` | Người có quyền duyệt. | Cộng OT hoặc trừ khoản phạt khi tính lại lương. |
| `REJECTED` | Người có quyền từ chối. | Không cộng/trừ khoản đó. |
| `VOID` | Căn cứ không còn phát sinh khoản. | Không tính tiền; khác với từ chối một khoản vẫn tồn tại. |

Khi nguồn log, ca hoặc căn cứ ảnh hưởng một khoản thay đổi, hệ thống có thể hủy hiệu lực quyết định cũ, đưa khoản về chờ duyệt hoặc `VOID`, đồng thời ghi nhật ký. Quyết định không tự được giữ nếu căn cứ đã thay đổi. Khi duyệt, phiên bản cập nhật của khoản phải còn mới; nếu dữ liệu đã đổi, người dùng tải lại trước khi quyết định.

Điều chỉnh OT/trễ-sớm theo ngày phải có lý do và được ghi cùng dữ liệu ngày và nhật ký. Sau thay đổi hoặc quyết định duyệt, phải tính lại phiếu lương trước khi chốt. Sửa phụ cấp không tự xác nhận các khoản còn chờ hoặc dữ liệu công đã thay đổi.

## 11. Khóa ngày công

Chỉ Admin được khóa/mở khóa ngày công toàn hệ thống. Trước khi khóa, hệ thống tổng hợp lại ngày và kiểm tra tình trạng tổng hợp, ca chưa kết thúc, ngày cần rà soát, thiếu phiên bản chính sách và các khoản OT/phạt đang chờ. Nếu còn vướng, thao tác bị từ chối.

Ngày đã khóa giữ kết quả tổng hợp. Lượt đến sau vẫn được lưu, đánh dấu `FLAGGED` và có cảnh báo theo luồng ngày khóa; không tự thay kết quả. Muốn xử lý thay đổi công phải mở khóa theo quyền, tổng hợp lại và xử lý các quyết định bị ảnh hưởng. Phiếu lương đã chốt của nhân viên cũng ngăn sửa công theo quy trình thông thường cho kỳ đó.

## 12. Đơn giá và công thức tính lương

### 12.1. Đơn giá

Lương giờ lấy từ hồ sơ nhân viên hoặc lịch sử/snapshot phù hợp với kỳ. Thay đổi lương giờ trong hồ sơ được áp dụng cho toàn tháng thay đổi theo giờ Việt Nam. Các tháng trước được xác định theo lịch sử hoặc snapshot đã có; không tự dùng một giá trị đã sửa trên phiếu cũ làm căn cứ gốc khi giá trị đó không đáng tin cậy.

Chính sách mặc định khi hệ thống áp dụng bộ mặc định:

| Thành phần | Hệ số mặc định |
|---|---:|
| OT được duyệt | 2,0 × lương giờ |
| Trễ/sớm được duyệt | 1,5 × lương giờ |
| Vắng được duyệt | 2,0 × tiền công của thời lượng ca vắng |

Admin có thể tạo chính sách hệ số với kỳ hiệu lực; quy tắc cập nhật thông thường chỉ cho hiệu lực từ tháng kế tiếp. Hệ số trên phiếu được lưu để giải thích kết quả; phiếu đã chốt không tự đổi tiền khi chính sách mới ra đời.

### 12.2. Tính tiền

```text
giờ công tháng = tổng giờ công thường đã tổng hợp từng ngày trong kỳ
giờ OT tháng = tổng giờ OT của các khoản APPROVED
giờ trễ/sớm tháng = tổng giờ của các khoản LATE_EARLY APPROVED
phạt vắng tháng = tổng tiền các khoản ABSENCE APPROVED

lương thường = giờ công tháng × lương giờ
tiền OT = giờ OT tháng × lương giờ × hệ số OT
phạt trễ/sớm = giờ trễ/sớm tháng × lương giờ × hệ số trễ/sớm
thực lĩnh = max(0, làm tròn VNĐ(lương thường + tiền OT
                - phạt trễ/sớm - phạt vắng tháng + phụ cấp))
```

Ví dụ: công thường 180 giờ, lương giờ 100.000 đồng, OT duyệt 2 giờ hệ số 2, trễ/sớm duyệt 0,5 giờ hệ số 1,5, không có phạt vắng và phụ cấp 1.500.000 đồng:

| Thành phần | Số tiền |
|---|---:|
| Lương thường: 180 × 100.000 | 18.000.000 đồng |
| OT: 2 × 100.000 × 2 | +400.000 đồng |
| Trễ/sớm: 0,5 × 100.000 × 1,5 | −75.000 đồng |
| Phụ cấp | +1.500.000 đồng |
| **Thực lĩnh** | **19.825.000 đồng** |

Các con số đầu vào phải hữu hạn và không âm. Thực lĩnh không âm; nếu tổng trước giới hạn nhỏ hơn 0 thì bằng 0. Hệ thống kiểm tra giới hạn lưu trữ tiền.

### 12.3. Phụ cấp và quyền sửa phiếu

Phiếu lương mới được tạo có phụ cấp mặc định **1.500.000 đồng** theo mã hiện tại; phiếu đã có giữ phụ cấp khi tính lại. Phụ cấp không tự chia theo ngày hoặc giờ làm, nên phiếu 0 giờ vẫn có thể có phụ cấp.

Trên phiếu `PENDING`, người có quyền chỉ được sửa **phụ cấp**, kèm lý do khi có thay đổi. API từ chối trường sửa lương giờ, tổng giờ công, OT, trễ/sớm hoặc trạng thái trong thao tác này. Giờ và các khoản theo ngày phải được xử lý từ chấm công, rồi tính lại bảng lương. Việc chỉnh phụ cấp không làm thay đổi log gốc hoặc tự duyệt OT/phạt.

## 13. Tính lại, chốt và mở khóa kỳ lương

### 13.1. Tính lương

Admin hoặc Manager theo phạm vi quyền có thể tạo/tính lại kỳ hiện tại hoặc kỳ trước; không tính kỳ tương lai. Trước khi tính, backend tổng hợp công; sau đó lấy tổng công ngày và các khoản `APPROVED`, lưu căn cứ, hệ số và kết quả vào phiếu `PENDING`. Kết quả tạm tính có thể chưa phản ánh khoản đang chờ duyệt và chưa đồng nghĩa đủ điều kiện chốt.

Phiếu đã `FINALIZED`, `CONFIRMED` hoặc `PAID` không bị ghi đè khi tính lại. Với phiếu `PENDING` đời cũ từng sửa trực tiếp công hoặc đơn giá, tính lại lấy công ngày và lương giờ từ hồ sơ/lịch sử có thể xác định, giữ phụ cấp và lưu dấu vết giá trị chỉnh tay trước đó. Nếu tháng cũ thiếu lịch sử cần thiết để khôi phục đơn giá đáng tin cậy, hệ thống báo lỗi, không tự đoán. Phiếu có hệ số lịch sử chưa xác định cũng cần xử lý dữ liệu lịch sử trước khi tính/chốt.

### 13.2. Điều kiện chốt thông thường

Kỳ chỉ được chốt sau khi đã sang ngày đầu tháng sau theo giờ Việt Nam; ca qua đêm chưa kết thúc vẫn là lý do chặn. Trước khi chốt, hệ thống tổng hợp lại và kiểm tra, trong phạm vi các phiếu được chốt:

- Không còn ngày cần rà soát, OT chờ duyệt, khoản phạt/OT `PENDING` hoặc thiếu phiên bản chính sách cần thiết.
- Không có ca chưa kết thúc; không có lỗi tổng hợp đang chặn kỳ.
- Dữ liệu công và các khoản chưa đổi so với lần tính phiếu gần nhất; lương giờ chưa thay đổi so với căn cứ hợp lệ.
- Hệ số và dấu vết tính lương phải xác định; phiếu cũ còn giờ/đơn giá chỉnh tay phải được tính lại hoặc xử lý căn cứ trước.
- Người thực hiện có quyền với các nhân viên tương ứng.

Nếu không đạt, hệ thống trả lỗi; quản lý xử lý nguyên nhân và tính lại trước khi thử chốt. Ví dụ duyệt OT sau khi đã tạo phiếu sẽ làm căn cứ khoản thay đổi: phải tính lại để OT được đưa vào lương trước khi chốt.

### 13.3. Trạng thái và mở khóa

- `PENDING`: phiếu đang tính hoặc chờ chốt.
- `FINALIZED`/`CONFIRMED`: phiếu đã chốt; không sửa trực tiếp hoặc ghi đè bằng tính lại thông thường.
- `PAID`: trạng thái đã trả; không mở bằng quy trình mở khóa kỳ thông thường.

Admin có thể mở khóa các phiếu đủ điều kiện trong kỳ chưa trả để xử lý tiếp; thao tác được ghi nhật ký. Phiếu quyết toán sớm được giữ riêng khi mở khóa chung. Luồng hiện tại dừng ở chốt `FINALIZED`; quy trình xác nhận thanh toán `PAID` và xử lý điều chỉnh tiền đã trả chưa được mô tả như chức năng vận hành hoàn chỉnh.

### 13.4. Quyết toán sớm

Quyết toán sớm dùng cho nhân viên có ngày kết thúc trước khi hết kỳ. Người có quyền xem trước tác động và cung cấp ngày cutoff, lý do. Backend kiểm tra lại khi xác nhận; nếu còn lượt hợp lệ, công thực tế hoặc khoản đã duyệt sau cutoff thì chặn để xử lý trước. Các ngày/công/khoản đang cần xử lý cũng không được bỏ qua. Khi thành công, hệ thống chốt phiếu đến cutoff, chuyển nhân viên sang `TERMINATED`, xử lý lịch/dữ liệu tương lai theo quy trình và ghi nhật ký. Phiếu cũ còn giờ/đơn giá sửa tay phải tính lại từ nguồn trước khi quyết toán.

## 14. Phân quyền, dấu vết và giới hạn

- Nhân viên xem dữ liệu trong phạm vi được cấp. Admin/Manager thao tác theo quyền và phạm vi nhân viên; Manager không được tự duyệt/sửa dữ liệu kiểm soát của mình hoặc quản lý khác ngoài giới hạn cho phép.
- Admin quản lý chính sách hệ số và khóa/mở khóa ngày; Manager có quyền xử lý nhân viên trong phạm vi quản lý. Từng thao tác vẫn được backend kiểm tra quyền.
- Điều chỉnh ngày, quyết định khoản, cập nhật phụ cấp và thao tác khóa/chốt có nhật ký; các quyết định quan trọng gắn với giá trị nguồn và thời điểm.
- Không tự xóa log gốc hoặc ghi đè phiếu đã chốt/đã trả để giải quyết ngoại lệ. Những thay đổi nguồn sau khi duyệt phải được xử lý lại trước khi chốt.
- Cảnh báo thiếu lượt phụ thuộc tác vụ nền hoạt động và hiện chọn nhân viên `ACTIVE`; tổng hợp công và cảnh báo là hai tác vụ khác nhau. Không hiểu cảnh báo là bằng chứng đã có công hoặc đã có khoản phạt.
- Kiểm thử tích hợp cần cơ sở dữ liệu thử nghiệm tách biệt. Kết quả vận hành thực tế còn phụ thuộc dịch vụ, thiết bị, cấu hình và dữ liệu đã triển khai.

## 15. Mã nguồn đối chiếu

| Nội dung | Tệp chính |
|---|---|
| Ghép cặp, ngưỡng ca, OT, trễ/sớm và vắng | `backend/src/modules/attendance/attendance.policy.ts` |
| Ghi lượt, tổng hợp ngày, điều chỉnh và khóa ngày | `backend/src/modules/attendance/attendance.service.ts` |
| Lịch tổng hợp và cảnh báo thiếu lượt | `backend/src/modules/attendance/attendance.cron.ts`, `attendance.missing-alerts.ts` |
| Tạo khoản theo ngày và duyệt khoản | `backend/src/modules/attendance/attendance.adjustments.ts`, `backend/src/modules/payroll/payroll.adjustments.ts` |
| Tính, sửa phụ cấp, chốt và quyết toán | `backend/src/modules/payroll/payroll.service.ts`, `payroll.dto.ts` |
| Công thức và lịch sử đơn giá | `backend/src/common/payroll-rates.ts`, `backend/src/modules/employees/employee.wage.ts` |
