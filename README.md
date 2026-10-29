# Highlands Coffee BTL2

Hệ thống demo BTL2 môn Hệ cơ sở dữ liệu, tiếp tục hai project có sẵn: Next.js 16 cho giao diện và NestJS 12 cho API. Dữ liệu lưu trong Microsoft SQL Server 2022. CRUD và tìm kiếm sản phẩm thực sự gọi stored procedure; không có chế độ dữ liệu giả thay SQL Server.

Đọc [phân tích SQL gốc so với BTL1](docs/PHAN_TICH_SQL_BTL2.md) trước khi cập nhật báo cáo. Có những lỗi nghiệp vụ trong SQL gốc và các quyết định thiết kế cần giải thích khi nộp. Các tệp Word/PDF/PowerPoint trong Downloads được giữ nguyên.

## Chạy trên máy

Yêu cầu Node.js 24+, npm và Docker Desktop chạy Linux containers. Mở Docker Desktop và đợi engine sẵn sàng. Launcher của dự án tự tìm Docker ở PATH hoặc thư mục cài Docker Desktop của người dùng trên Windows. Dùng PowerShell tại thư mục `highlands`.

```powershell
npm.cmd --prefix highlands-server install
npm.cmd --prefix highlands-client install
npm.cmd run setup
npm.cmd run db:up
npm.cmd run db:init
npm.cmd run db:check
npm.cmd run dev
```

Trên Windows có chính sách chặn `npm.ps1`, dùng `npm.cmd` như trên; không cần đổi execution policy của máy. Trong CMD/macOS/Linux có thể dùng `npm`.

- Giao diện: [http://localhost:3000](http://localhost:3000)
- API và kiểm tra DB: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- SQL Server: `127.0.0.1,1433`, database `HighlandsCoffeeDB`.

`setup` tạo `.env` bằng hai mật khẩu ngẫu nhiên, riêng cho sa và tài khoản ứng dụng. Không in mật khẩu hoặc đưa vào mã nguồn. Cấu hình gốc `.env` là nguồn cấu hình cho script DB và được NestJS ưu tiên đọc; có bản sao `highlands-server/.env` để dùng khi tách riêng project. `.env.local` của FE chỉ có địa chỉ BE. Không đưa mật khẩu vào biến `NEXT_PUBLIC_*`.

`db:up` chờ healthcheck SQL Server thành công. `db:init` tạo bảng, thủ tục, trigger, hàm, seed rồi tạo login `highlands_app` có quyền SELECT và EXECUTE các thủ tục cần thiết. Login ứng dụng bị DENY INSERT/UPDATE/DELETE trực tiếp. Thủ tục dbo hoạt động qua ownership chaining.

`db:init` chỉ chạy cho DB mới; nó từ chối ghi đè khi đã có bảng. Không tự drop database hoặc xóa dữ liệu. Nếu một bước init bị lỗi, sửa lỗi dựa vào tên file/batch được báo trước khi chạy tiếp qua SSMS hoặc sqlcmd; không lặp init trên DB đã tạo một phần. Giữ nguyên `.env` khi khởi động lại Docker vì mật khẩu trong volume vẫn là mật khẩu đã khởi tạo lần đầu.

Cơ sở dữ liệu trên máy này đã được khởi tạo và kiểm thử thành công. Những lần mở lại chỉ cần `db:up` và `dev`, không chạy lại `db:init`. Khi sửa nội dung thủ tục, trigger hoặc hàm, dùng `npm.cmd run db:update` để áp dụng file 02-04, giữ nguyên bảng và dữ liệu mẫu.

```powershell
# Dừng SQL Server và giữ nguyên dữ liệu trong volume
npm.cmd run db:down

# Chạy lại SQL Server
npm.cmd run db:up

# Build, unit test, kiểm tra DB thật
npm.cmd run build
npm.cmd test
npm.cmd run db:check

# Khi FE và BE đang chạy: kiểm tra toàn bộ luồng API với DB thật
npm.cmd run test:integration
```

## Chức năng

| Màn hình | Chức năng | SQL chính |
| --- | --- | --- |
| Thực đơn | Tìm theo mã/tên, danh mục, loại, trạng thái, khoảng giá; sắp xếp | `sp_TimKiemSanPham_Menu` |
| Form sản phẩm | Thêm/sửa nhiều danh mục và giá nhiều size; giá cố định cho bánh | `sp_InsertSanPham`, `sp_UpdateSanPham` |
| Xóa sản phẩm | Chặn xóa món có hóa đơn, trả lỗi cụ thể | `sp_DeleteSanPham` |
| Báo cáo | Doanh số món theo ngày/chi nhánh, ngưỡng số lượng và doanh số | `sp_ThongKeDoanhThuSanPham` |
| Phân tích | Chuỗi lửa và ngân sách ưu đãi chi nhánh | Hai scalar UDF có cursor |
| Hóa đơn | Xác nhận, hoàn tất, hủy; khóa đơn đã kết thúc | `sp_ChuyenTrangThaiHoaDon` và trigger |
| Điểm & voucher | Xem số dư, lịch sử, ví voucher; đổi voucher | `sp_DoiVoucher` và trigger |

Ứng dụng là công cụ vận hành cục bộ phục vụ đề BTL2; không triển khai OTP, thanh toán hoặc POS thật. API chỉ lắng nghe loopback. Không có cơ chế đăng nhập/phân quyền người dùng ở giao diện. Tài khoản DB riêng bảo vệ đường ghi dữ liệu, không thay thế xác thực người dùng nếu sau này đưa lên mạng.

## Cấu trúc

```text
database/
  01-schema.sql        18 bảng, khóa và ràng buộc, chỉ mục
  02-procedures.sql    CRUD, menu, doanh số, đổi voucher
  03-triggers.sql      nghiệp vụ và tính thuộc tính dẫn xuất
  04-functions.sql     hai hàm cursor
  05-seed.sql          dữ liệu mẫu qua luồng nghiệp vụ
  06-checks.sql        assertions, phản ví dụ, transaction rollback
docs/
  PHAN_TICH_SQL_BTL2.md
  DEMO_BTL2.md
highlands-client/      Next.js
highlands-server/      NestJS + mssql
scripts/               setup, chạy app, khởi tạo/kiểm tra DB
compose.yaml           SQL Server và volume dữ liệu
```

Các tệp trong `docs/sources` và thư mục `tools` phục vụ trích xuất/kiểm tra tài liệu, không phải thành phần cần cài để chạy app. Không chạy lại các script `prepare-*` để ghi đè các file SQL đã hiệu chỉnh.

## Định nghĩa nghiệp vụ đã chọn

Giá tại CHI_TIET_HOA_DON và CHON_TOPPING là snapshot. Tiền dòng nước bằng `(đơn giá nước + tổng đơn giá topping × số lượng topping mỗi món) × số lượng món`. Hóa đơn tính tổng các dòng trước, giảm giá sau, rồi mới tính điểm `FLOOR(thực trả / 10000)` khi hoàn tất. Đơn dưới 10.000 không tạo lịch sử điểm.

Đổi voucher tính HSD từ số ngày hiệu lực, trừ điểm và tạo lịch sử trong cùng transaction. Hủy đơn trước hoàn tất đặt Ma_VCCN về NULL để tái dùng voucher. Đơn hoàn tất/đã hủy và lịch sử điểm đã ghi nhận không cho chỉnh sửa. Hai hàm phân tích chỉ trả kết quả, không ghi DB hoặc tự cộng điểm thưởng chuỗi lửa.

Khi hoàn tất hóa đơn có voucher, tổng tiền món phải đạt ngưỡng tối thiểu của voucher. Nếu không đủ, hệ thống yêu cầu bỏ voucher hoặc bổ sung món; không tiêu thụ voucher với mức giảm bằng 0.

Đơn chờ có thể tồn tại tạm thời chưa có món trong quá trình xây dựng; xác nhận/hoàn tất bắt buộc có ít nhất một dòng. Ràng buộc toàn phần của sản phẩm/danh mục/size được duy trì qua thủ tục và quyền ghi tài khoản ứng dụng, đồng thời được kiểm tra lại bằng `db:check`. Chi tiết sai khác và cách giải thích so với BTL1 nằm trong tài liệu phân tích.

## Kết quả kiểm tra hiện có

Đã build FE/BE thành công, chạy 32 unit test đạt và kiểm tra cú pháp cả sáu SQL script bằng Microsoft ScriptDOM cho SQL Server 2022. Đã chạy khởi tạo và seed trên SQL Server 2022 trong Docker; `db:check` trả `ALL CHECKS PASSED`, xác nhận 18 bảng, ít nhất 5 dòng/bảng và 14 nhóm kiểm tra nghiệp vụ.

Kiểm thử tích hợp qua proxy Next.js -> NestJS -> SQL Server đã đạt: CRUD thật cho bánh/nước, nhiều danh mục/size, tìm kiếm, lỗi trùng/chặn xóa, báo cáo và hai hàm. Login ứng dụng không có sysadmin và bị từ chối DML trực tiếp. Dữ liệu thử CRUD được dọn sau kiểm tra; bộ SQL dùng rollback. Đã xem thực đơn và form thêm sản phẩm trên Chrome với dữ liệu thật; chưa kiểm thử trực quan đầy đủ mọi màn hình/kích thước thiết bị. Xem [biên bản kiểm thử](docs/KIEM_THU.md).

`db:check` cần tài khoản sa trong `.env` để chạy các phản ví dụ ở tầng DB; mọi dữ liệu thử được rollback. Chạy trước demo, giữ tối thiểu 5 dòng/bảng để phần đếm dữ liệu mẫu đạt. Unit test có mock driver chỉ kiểm tra logic API, không giả lập SQL Server để chấm phần kết nối.
#   d a t a b a s e 2 5 2  
 