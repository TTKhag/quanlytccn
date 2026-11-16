# Changelog — Dark Finance

## [1.0.0] — 2026-11-16

### Hoàn thành

#### Module Số dư & Tài khoản
- Quản lý tiền mặt với điều chỉnh số dư
- Tạo / sửa / ẩn nhiều tài khoản ngân hàng (danh sách NH Việt Nam)
- Chuyển tiền nội bộ (mặt ↔ NH, NH ↔ NH)
- Tổng số dư = tiền mặt + tổng số dư tài khoản

#### Module Thu Chi
- Ghi nhận thu nhập / chi tiêu theo danh mục
- Chọn nguồn: tiền mặt, tài khoản NH, hoặc từ nợ
- Sửa / xóa giao dịch kèm hoàn tác số dư
- Lọc theo khoảng thời gian và loại

#### Module Nợ phải trả
- Nợ ngân hàng/tín dụng (bắt buộc số TK)
- Nợ tiền mặt (họ tên bắt buộc, thông tin khác tùy chọn)
- Tính lãi tích lũy (lãi đơn theo ngày/tháng hoặc cố định)
- Thanh toán phân biệt gốc / lãi
- Lãi thực trả ghi nhận là chi phí

#### Module Vay & Cho vay
- Tạo khoản vay nhận tiền (tăng tiền + tăng nợ)
- Tạo khoản cho vay (trừ tiền → khoản phải thu)
- Trả vay / thu hồi với phân tách gốc–lãi
- Theo dõi đến hạn / quá hạn trên Dashboard

#### Module Quỹ
- Tạo quỹ, nạp / rút tiền
- Tính lãi tích lũy
- Nhận lãi: cộng vào quỹ / về tiền mặt / về tài khoản NH
- Lãi chỉ ghi thu nhập một lần

#### Module Dự kiến
- Thu / chi dự kiến theo ngày
- Không ảnh hưởng số dư thực tế
- Đánh dấu xác nhận

#### Dashboard & Báo cáo
- Tổng quan: tiền mặt, NH, cho vay, quỹ, nợ, tài sản ròng
- Biểu đồ phân bổ tài sản & thu chi
- Cảnh báo sắp đến hạn / quá hạn
- Báo cáo thu chi theo khoảng thời gian, theo danh mục

#### Lịch sử biến động
- Audit log mọi thao tác tạo/sửa/xóa/chuyển/trả
- Lọc theo module và thời gian
- Không cho chỉnh sửa qua giao diện

#### Hệ thống
- Lưu trữ IndexedDB (Dexie)
- Backup / Restore JSON với kiểm tra phiên bản
- Giao diện tối, sang trọng, responsive
- Triển khai được trên GitHub Pages

### Công thức tài sản ròng
```
Tổng tài sản = Tiền mặt + Tiền NH + Gốc cho vay còn lại + Số dư quỹ
Tổng nợ phải trả = Gốc nợ còn + Lãi nợ chưa trả + Gốc vay còn + Lãi vay chưa trả
Tài sản ròng = Tổng tài sản − Tổng nợ phải trả
```
(Lãi tích lũy chưa thực nhận không cộng vào tài sản)
