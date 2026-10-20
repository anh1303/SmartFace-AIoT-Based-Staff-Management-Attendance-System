# Chính sách công ty và quy tắc nghiệp vụ SmartFace

**Mã chính sách:** `2026-10-19-v2`  
**Phạm vi:** ghi nhận điểm danh, ghép công, duyệt tăng ca, tính lương, phân quyền và bảo toàn dữ liệu.  
**Múi giờ nghiệp vụ:** `Asia/Ho_Chi_Minh` — UTC+7.

Tài liệu này quy định cách hệ thống và người quản lý xử lý công, lương và các trường hợp ngoại lệ. Các phiên bản chính sách và quyết định điều chỉnh phải có dấu vết kiểm toán. Báo cáo kỹ thuật, lịch sử sửa lỗi và hướng dẫn triển khai được quản lý riêng trong `docs/changes/` và `docs/tutorial/`.

## 1. Lịch làm việc và đơn vị thời gian

Mỗi nhân viên được phân một ca hoặc ngày OFF cho từng ngày làm việc.

| Loại ca | Giờ bắt đầu | Giờ kết thúc |
|---|---|---|
| OFFICE_HOURS — Hành chính | 08:00 | 17:30 |
| MORNING — Ca sáng | 08:30 | 17:30 |
| AFTERNOON — Ca chiều | 13:00 | 21:30 |
| OFF — Ngày nghỉ | Không có công thường tự động | Không có OT tự động |

- Thời gian được trả lương bắt đầu từ giờ bắt đầu ca, kể cả khi nhân viên đến sớm.
- Không khấu trừ một khoảng nghỉ trưa/nghỉ giữa giờ cố định. Thời gian nhân viên vẫn ở trong một cặp IN→OUT hợp lệ được ghi nhận liên tục.
- Khoảng từ OUT đến IN tiếp theo không phải thời gian làm việc được ghi nhận.
- Giữ timestamp và số giây gốc để đối chiếu. Giờ dùng tính lương được làm tròn theo Điều 4.
- Ca tương lai chưa được tính thành vắng mặt hoặc phát sinh công.

## 2. Ghi nhận và ghép IN/OUT

### 2.1. Trình tự ghép

Xử lý sự kiện theo từng nhân viên, sắp xếp theo timestamp tăng dần. Khi timestamp bằng nhau, dùng ID bản ghi tăng dần để xác định thứ tự.

Chỉ ghép **IN→OUT liền kề**:

1. IN mở một lần chờ OUT.
2. Nếu có IN tiếp theo trước OUT, IN mới thay IN đang chờ. IN cũ vẫn được lưu nhưng không tạo công.
3. OUT ngay sau IN đóng cặp đó. OUT tiếp theo không kéo dài cặp đã đóng.
4. OUT không có IN chờ thì không tạo cặp.
5. Sự kiện bị đánh dấu không hợp lệ/FLAGGED hoặc sự kiện khác IN/OUT ngắt lần chờ; không nối xuyên qua sự kiện đó để tạo công.

`CHECK_IN` là IN; `CHECK_OUT` và giá trị lịch sử `TAN_CA` được hiểu là OUT.

### 2.2. Giới hạn cặp

OUT phải xảy ra **sau IN** và cách IN **không quá 24 giờ**. Đúng 24 giờ được ghép; trên 24 giờ, hai mốc bằng nhau hoặc cặp bị ngắt thì không tạo công hợp lệ và cần rà soát.

Cặp qua nửa đêm thuộc **ngày của IN**. Một OUT chỉ được dùng trong một cặp. Không tự tạo OUT cho IN thiếu, không tự tạo IN cho OUT lẻ và không thay thời gian thiếu bằng giờ ca.

| Chuỗi sự kiện | Cặp hợp lệ | Xử lý phần còn lại |
|---|---|---|
| IN 08:00 → OUT 12:00 → IN 13:00 → OUT 17:30 | 08:00–12:00 và 13:00–17:30 | Không tính khoảng 12:00–13:00 |
| IN 08:00 → IN 09:00 → OUT 17:30 | 09:00–17:30 | Lưu IN 08:00, không trả công từ mốc này |
| IN 08:00 → OUT 17:30 → OUT 19:00 | 08:00–17:30 | Lưu OUT 19:00, không phát sinh thêm OT |
| OUT 08:00 → IN 09:00 | Chưa có cặp | OUT lẻ; IN chờ OUT |
| IN ngày 02 lúc 08:00 → OUT ngày 03 lúc 08:00 | Cặp 24 giờ, thuộc ngày 02 | Vẫn xét OT và cờ rà soát |
| IN ngày 02 lúc 08:00 → OUT ngày 03 lúc 08:00:01 | Không ghép | Lưu và rà soát hai ngày liên quan |

### 2.3. Phân biệt quét mới và gửi lại

Một lần quét vật lý có một `event_id` duy nhất và một timestamp capture cố định. Gửi lại cùng event ID do mất kết nối/phản hồi không tạo điểm danh mới. Hai lượt quét có ID khác nhau là hai sự kiện riêng và áp dụng quy tắc liền kề trên.

Mọi raw log phải được giữ để đối chiếu, gồm IN/OUT dư, ngày OFF, sự kiện không ghép được và sự kiện bị FLAGGED.

### 2.4. Xác nhận điểm danh khuôn mặt

CHECK_IN và CHECK_OUT cùng yêu cầu **3 kết quả recognition liên tiếp khớp cùng một nhân viên**, trong cùng phiên track/mode và khi PAD hợp lệ, trước khi backend ghi một sự kiện điểm danh. Hai lần đầu chỉ xác minh. Retry cùng một lượt recognition không tăng bộ đếm. Một lượt quét dùng chung event ID/timestamp capture cho tới khi được xác nhận; từng lượt recognition có ID riêng để loại retry.

Đổi người, kết quả UNKNOWN, lỗi recognition, mất track/PAD hoặc đổi mode yêu cầu bắt đầu lại chuỗi xác nhận. Bộ đếm là số kết quả, không phải số giây. Interval recognition 1 giây vẫn chịu thời gian inference/mạng nên không cam kết hoàn tất chính xác sau 3 giây. Số vote PAD (tối thiểu 3 trong cửa sổ 5) và số lần ổn định nhãn UI là các cơ chế riêng.

Khi verdict PAD sau vote là SPOOF hoặc mất track, toàn bộ số lần recognition đã tích lũy bị hủy. Nhận lại cùng track ID vẫn phải bắt đầu từ 1/3; kết quả bất đồng bộ của phiên cũ không được dùng. Một phiếu SPOOF thô đơn lẻ chưa làm verdict sau vote thành SPOOF không tự hủy chuỗi; cửa sổ PAD tiếp tục lọc nhiễu theo tỉ lệ đã quy định.

Điểm danh thủ công qua API quản lý giữ phân quyền và cơ chế riêng. Script face_auth chỉ cung cấp trạng thái sẵn sàng sau 3 lần khớp, không tự ghi attendance_logs; backend là writer duy nhất.

## 3. Công thường, OFF và chưa phân ca

Với mỗi cặp hợp lệ trong một ngày có ca làm việc:

```text
bắt đầu tính công = max(IN, giờ bắt đầu ca)
kết thúc tính công = min(OUT, giờ kết thúc ca)
giây công thường = max(0, kết thúc tính công − bắt đầu tính công)
```

Cộng giây công thường của tất cả cặp thuộc ngày/ca rồi làm tròn một lần. Không dùng khoảng từ IN đầu đến OUT cuối để trả tiền cho các khoảng nhân viên đã OUT.

**Ngày OFF:** cho phép IN/OUT và lưu đầy đủ; công thường bằng 0, OT tự đề xuất bằng 0. Người có quyền duyệt có thể bổ sung OT cho ngày đó, bắt buộc ghi lý do.

**Ngày chưa phân ca:** lưu log, không tự trả công hoặc tự đề xuất OT; đánh dấu cần rà soát. Người có quyền có thể phân ca rồi tính lại hoặc thực hiện điều chỉnh có lý do. Không tự gán một ca để trả tiền.

**Thiếu/không hợp lệ:** không phát sinh giờ thường từ phần chưa ghép. Các cặp hợp lệ khác trong ngày vẫn được cộng theo thời gian thực tế, nhưng ngày còn vấn đề phải được rà soát trước khi chốt. Khi sự cố làm thiếu giờ thường, người có quyền được điều chỉnh giờ trên phiếu lương và ghi lý do; raw log gốc vẫn được giữ.

## 4. Làm tròn thời gian công

Công thường, OT và giờ đi trễ/về sớm áp dụng cùng quy tắc. Tách tổng số giờ thành **phần giờ nguyên H** và **phần lẻ f**:

| Phần lẻ f | Kết quả tính |
|---|---:|
| `0 ≤ f < 0,5` | H |
| `0,5 ≤ f < 0,75` | H + 0,5 |
| `0,75 ≤ f < 1` | H + 1 |

Tương ứng: dưới 30 phút bỏ phần lẻ; từ 30 phút đến dưới 45 phút tính thêm 0,5 giờ; từ 45 phút trở lên tính thêm 1 giờ. **Đúng 45 phút làm tròn lên.**

Cộng tất cả cặp hợp lệ trong cùng ngày/ca trước khi làm tròn một lần. Tổng tháng là tổng các giá trị đã làm tròn từng ngày. Số giờ điều chỉnh thủ công được chuẩn hóa theo cùng ba mức trên.

| Thời gian gốc | Giờ tính |
|---|---:|
| 1,49 giờ | 1 |
| 1,50 giờ | 1,5 |
| 1,74 giờ | 1,5 |
| 1,75 giờ | 2 |
| 29 phút 59 giây | 0 |
| 30 phút | 0,5 |
| 40 phút | 0,5 |
| 44 phút 59 giây | 0,5 |
| 45 phút | 1 |
| 9 giờ 30 phút | 9,5 |

Ca hành chính 08:00–17:30 có 9,5 giờ gốc, đi đủ ca được tính **9,5 giờ công thường**. Đi đủ 20 ca như vậy được cộng **190 giờ công thường**. Không làm tròn riêng từng cặp hoặc cộng cả tháng rồi mới làm tròn.

Ngưỡng đủ điều kiện OT và cờ OT bất thường được xét bằng thời gian gốc theo Điều 5, trước bước làm tròn. Vì vậy đúng 30 phút OT vẫn không đủ điều kiện tự đề xuất OT, dù phép làm tròn thời gian riêng lẻ cho kết quả 0,5 giờ.

## 5. Tăng ca — OT

### 5.1. Điều kiện tự đề xuất

Một ngày được tự đề xuất OT khi đồng thời thỏa mãn:

1. Đã được phân ca làm việc, không phải OFF.
2. Có cặp IN→OUT hợp lệ, tối đa 24 giờ.
3. Tổng thời gian thực sự làm việc sau giờ kết thúc ca **trên 30 phút**.

Mỗi cặp chỉ đóng góp phần nằm sau giờ kết thúc ca. Không tính thời gian đến sớm hoặc khoảng đã OUT. Khi đủ điều kiện, tính **toàn bộ phần OT**, không trừ 30 phút đầu.

- Đúng 30 phút OT gốc: không tự đề xuất OT.
- Trên 30 phút: làm tròn tổng OT theo Điều 4 để đề xuất.
- Trên 4 giờ OT gốc: gắn cờ `OT_OVER_4H` và yêu cầu rà soát; không tự cắt phần vượt 4 giờ.
- Đề xuất ở trạng thái PENDING; chưa đưa vào tiền lương.

### 5.2. Duyệt và điều chỉnh

- Mọi OT trả lương phải được người có quyền duyệt sau ghi nhận.
- Được duyệt ít hơn, bằng hoặc nhiều hơn số giờ máy ghi nhận để xử lý thiếu log/sự cố. **Bắt buộc ghi lý do**, người duyệt và thời điểm duyệt.
- Duyệt số giờ dương: APPROVED; duyệt 0 giờ: REJECTED.
- OFF hoặc ngày thiếu ghi nhận có thể được bổ sung OT thủ công kèm lý do.
- Nếu log/ca làm căn cứ thay đổi sau duyệt, hủy hiệu lực điều chỉnh cũ, gắn cờ và yêu cầu rà soát/duyệt lại. Tính lại từ nguồn không đổi phải giữ quyết định đã duyệt.

### 5.3. Ví dụ ca 08:00–17:30

| Ghi nhận | Giờ thường gốc → tính | OT gốc | OT tự đề xuất |
|---|---|---:|---|
| IN 07:30, OUT 17:30 | 9,5 → 9,5 | 0 | 0 |
| IN 08:00, OUT 18:00 | 9,5 → 9,5 | 30 phút | 0 |
| IN 08:00, OUT 18:10 | 9,5 → 9,5 | 40 phút | 0,5 giờ, chờ duyệt |
| IN 09:00, OUT 18:10 | 8,5 → 8,5 | 40 phút | 0,5 giờ, chờ duyệt; xét phạt trễ riêng |
| IN 08:00, OUT 21:30 | 9,5 → 9,5 | 4 giờ | 4 giờ, chờ duyệt |
| IN 08:00, OUT 21:31 | 9,5 → 9,5 | 4 giờ 1 phút | 4 giờ, có cờ rà soát |
| OFF, IN 08:00, OUT 17:30 | 0 → 0 | Không tự xét | Quản lý có thể bổ sung có lý do |

4 giờ 1 phút vẫn có cờ dù làm tròn còn 4 giờ. 40 phút đủ điều kiện OT thì toàn bộ 40 phút được đưa vào bước làm tròn, không chỉ tính 10 phút vượt ngưỡng.

## 6. Đi trễ và về sớm

Chỉ sử dụng mốc trong **các cặp hợp lệ**:

```text
giây trễ = max(0, IN đầu trong các cặp hợp lệ − giờ bắt đầu ca)
giây về sớm = max(0, giờ kết thúc ca − OUT cuối trong các cặp hợp lệ)
```

Từng phần được giới hạn không vượt độ dài ca. Cộng giây trễ + về sớm rồi làm tròn theo Điều 4. Nếu không có cặp hợp lệ thì không suy diễn một cặp để tạo tiền phạt.

- Nhãn đi trễ áp dụng khi IN sau giờ bắt đầu ca **trên 15 phút**.
- Về trước giờ kết thúc ca được ghi nhận nhãn về sớm.
- Mốc 15 phút dùng phân loại trạng thái; số tiền phạt dựa trên tổng thời gian trễ/sớm đã làm tròn.
- Mất thời gian công thường và tiền phạt là hai thành phần riêng. Đi trễ 1 giờ có thể vừa giảm công thực làm vừa bị phạt 1 giờ.
- Các khoảng OUT→IN giữa ca làm giảm công thường, không tự phát sinh một khoản phạt bổ sung ngoài trễ đầu ca/về sớm cuối ca.

Ví dụ: trễ 20 phút, không về sớm → nhãn đi trễ nhưng giờ phạt làm tròn là 0; trễ 30 phút → 0,5 giờ phạt; trễ 20 phút và về sớm 20 phút → cộng 40 phút rồi tính 0,5 giờ phạt.

## 7. Đơn giá, phụ cấp và công thức lương

### 7.1. Mức áp dụng

| Thành phần | Quy định |
|---|---|
| Lương giờ thường | Theo `hourly_rate` trong hồ sơ từng nhân viên, đơn vị VNĐ/giờ |
| **Đơn giá OT** | **100.000 VNĐ cho mỗi giờ OT được duyệt**, không nhân thêm lương giờ thường |
| **Phạt đi trễ/về sớm** | **50.000 VNĐ cho mỗi giờ trễ/sớm đã tính** |
| **Phụ cấp trên phiếu mới** | **1.500.000 VNĐ/kỳ** |
| Phụ cấp phiếu đã có | Bảo toàn số tiền của phiếu khi tính lại, gồm cả giá trị 0; người có quyền được điều chỉnh và lưu audit |

Phụ cấp được cấp theo kỳ, không tự phân bổ theo số ngày/giờ làm. Một phiếu có 0 giờ thường vẫn có thể có phụ cấp. Không tự thay tổng công bằng 176 giờ hoặc bằng số giờ lịch.

Admin quản lý thay đổi đơn giá công ty. Khi thay đổi phải cập nhật phiên bản chính sách và cấu hình tương ứng. Mỗi phiếu phải lưu snapshot đơn giá áp dụng; thay đổi cấu hình không tự định giá lại phiếu đã có.

### 7.2. Công thức

```text
lương thường = tổng giờ thường đã tính × lương giờ của nhân viên
lương OT = tổng giờ OT được duyệt × 100.000
phạt = tổng giờ trễ/sớm đã tính × 50.000
thành tiền = max(0, làm tròn VNĐ(lương thường + lương OT − phạt + phụ cấp))
```

OT không nằm trong tổng giờ thường. Không cộng lại lương cơ bản cho cùng phần thời gian OT. Số giờ/đơn giá/phụ cấp phải hữu hạn và không âm. Giá trị 0 là một giá trị hợp lệ, không được thay bằng số cũ.

Phiếu lịch sử có snapshot đơn giá khác áp dụng snapshot của chính phiếu đó. Với dữ liệu biểu diễn đơn giá dạng hệ số, giá trị ≤10 nghĩa là số lần lương giờ; giá trị >10 nghĩa là VNĐ/giờ. Mức 100.000 và 50.000 trong bảng trên đều là **VNĐ/giờ**.

### 7.3. Ví dụ tính tiền

Nhân viên có lương thường 100.000 VNĐ/giờ; kỳ lương gồm 9 giờ thường, 2 giờ OT đã duyệt, 1 giờ trễ/sớm và phụ cấp 1.500.000 VNĐ:

```text
9 × 100.000 + 2 × 100.000 − 1 × 50.000 + 1.500.000
= 2.550.000 VNĐ
```

Nếu 2 giờ OT còn PENDING thì chưa cộng 200.000 VNĐ; thành tiền tạm tính là 2.350.000 VNĐ và chưa được chốt kỳ.

`net_salary` là tên trường chứa kết quả công thức trên. Công thức chưa bao gồm thuế thu nhập, bảo hiểm hoặc các khoản khấu trừ ngoài tiền phạt/phụ cấp được quy định tại đây. Đã chốt phiếu lương không đồng nghĩa đã chuyển tiền.

## 8. Phân quyền và trách nhiệm

| Vai trò | Quyền và giới hạn |
|---|---|
| EMPLOYEE | Ghi nhận/xem điểm danh của mình; xem phiếu lương của mình; không duyệt OT, sửa dữ liệu kiểm soát hoặc chốt lương |
| MANAGER | Xem dữ liệu của mình; xử lý công, ca, OT và phiếu lương của nhân viên thường trong phạm vi phụ trách; không tự sửa/duyệt dữ liệu kiểm soát của mình và không sửa của Manager/Admin khác |
| ADMIN | Quản trị nhân viên, ca, công, OT, đơn giá; điều chỉnh/chốt phiếu trong toàn hệ thống; mở khóa kỳ theo Điều 9 |

Phạm vi phòng ban của Manager được xác định từ phòng ban gắn với hồ sơ Manager. Khi có phòng ban, chỉ xử lý nhân viên thuộc phòng ban đó. Manager chưa được gắn phòng ban có phạm vi phụ trách toàn bộ nhân viên thường, nhưng vẫn không được sửa chính mình hoặc Manager/Admin khác.

Admin/Manager có quyền ghi điểm danh thủ công qua API quản lý; bản ghi phải có phương thức MANUAL để phân biệt với xác thực khuôn mặt. Điều chỉnh giờ công/OT/phạt cần lý do và audit.

Thao tác hàng loạt phải tuân thủ cùng phạm vi quyền với thao tác từng người. Manager tính/chốt cả kỳ chỉ tác động các nhân viên mình được phép xử lý; phiếu của chính Manager cần Admin xử lý.

## 9. Rà soát, khóa ngày và chốt kỳ lương

### 9.1. Những trường hợp phải rà soát

- IN chưa có OUT; OUT lẻ khi không có cặp hoàn chỉnh trong ngày.
- Cặp vượt 24 giờ, không có thời lượng dương hoặc bị ngắt bởi sự kiện không hợp lệ.
- Sự kiện FLAGGED, ngày có log chưa phân ca, OT gốc trên 4 giờ.
- Log/ca làm căn cứ thay đổi sau một quyết định duyệt/điều chỉnh.
- Dữ liệu tổng hợp chưa có phiên bản chính sách để xác định công thức đã áp dụng.

Người có quyền phải lưu quyết định và lý do khi xác minh. Không biến sự kiện thiếu thành thời gian đã làm mà không có điều chỉnh có kiểm soát.

### 9.2. Khóa ngày

Không khóa ngày khi còn vấn đề công hoặc OT chờ xử lý. Ngày đã khóa giữ kết quả tổng hợp. Raw log đến sau vẫn được lưu và đánh dấu cần đối chiếu; muốn cập nhật công phải mở khóa, tính lại và duyệt lại khi căn cứ thay đổi.

### 9.3. Trạng thái phiếu và chốt kỳ

- **PENDING:** phiếu đang soạn/tạm tính.
- **FINALIZED/CONFIRMED:** phiếu đã chốt; không sửa trực tiếp hoặc ghi đè bằng thao tác tính lại.
- **PAID:** phiếu đã ghi trạng thái trả lương; không mở khóa bằng quy trình ghi đè phiếu.

Chặn chốt nếu còn review, OT PENDING, dữ liệu chưa có phiên bản chính sách hoặc căn cứ công/OT thay đổi sau lần tạo phiếu. Phiếu chỉnh tay phải được bảo toàn khi tính lại hàng loạt; nếu nguồn đổi, người có quyền phải rà soát và lưu lại phiếu trước khi chốt.

Admin được mở khóa kỳ chưa PAID để điều chỉnh. Phiếu PAID phải xử lý bằng quy trình điều chỉnh riêng. Việc một nhân viên đã chốt không tự khóa việc duyệt công của nhân viên khác.

Các thay đổi công/OT/lương và audit tương ứng phải cùng thành công hoặc cùng rollback. Audit chứa người thao tác, đối tượng, giá trị trước/sau, lý do khi bắt buộc và thời điểm.

## 10. Quy tắc dữ liệu và đồng bộ của dự án

- Backend là nơi xác định cặp hợp lệ, công thường, đề xuất OT và số tiền; frontend hiển thị kết quả đó, không tự suy diễn một công thức tính công riêng.
- Pi gửi timestamp capture và event ID; retry phải giữ nguyên hai giá trị. Chỉ phản hồi đúng request/event và đúng phạm vi track/mode/lần hiện diện mới được cập nhật trạng thái trên thiết bị.
- Chỉ báo điểm danh thành công sau phản hồi xác nhận của backend. Hết thời gian chờ phải thể hiện kết quả chưa xác nhận, không coi MQTT publish thành công là đã ghi công thành công.
- Timestamp Pi ở tương lai trên 2 phút hoặc cũ hơn 24 giờ so với lúc backend nhận được FLAGGED. Kiểm tra timestamp này tách biệt với điều kiện độ dài cặp tối đa 24 giờ.
- Webhook ThingsBoard phải có shared secret; Socket.IO phải có phiên JWT hợp lệ. Nhân viên chỉ nhận sự kiện cá nhân; cảnh báo chưa xác định người thuộc màn hình quản lý.
- Đổi chế độ từ giao diện phải có ACK của Pi trước khi xác nhận thành công; chế độ đã xác nhận được lưu để đọc lại/phục hồi.
- Vector xác thực phải đúng 512 phần tử Float32 hữu hạn và có norm khác 0; gửi bằng RPC, không lưu vector vào telemetry Timeseries.
- Điểm liveness phải hữu hạn trong [0,1]; thiếu điểm hoặc điểm thấp hơn 0,5 không được dùng tạo điểm danh khuôn mặt. Không thay điểm 0 thành 1 hoặc gán điểm tin cậy giả.
- Sự kiện SPOOF là cảnh báo bảo mật, không phải một cặp điểm danh hoặc một khoản công.
- Không tự xóa raw log, ghi đè tiền lương đã chốt hoặc dùng seed/reset trên dữ liệu doanh nghiệp để xử lý lỗi vận hành.

### Chu kỳ AI realtime

Cấu hình vận hành cho `hardware` và `face_auth`:

| Công đoạn | Interval cấu hình |
|---|---:|
| Recognition — align/embedding/đối soát danh tính | 1,0 giây |
| Detection — phát hiện khuôn mặt | 0,2 giây |
| PAD — đánh giá chống giả mạo | 0,2 giây |

Ba interval cấu hình độc lập trong `.env` và `.env.example`. Khi một người đã điểm danh, latch/cooldown tiếp tục điều khiển việc gửi sự kiện; interval recognition không tạo quyền ghi lặp điểm danh. Kết quả chưa đủ điều kiện PAD hoặc sai tương quan không được dùng để tạo công.
