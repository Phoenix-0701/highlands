# Highlands Coffee BTL2 — MySQL

Hệ thống bài tập lớn môn Hệ cơ sở dữ liệu: Next.js 16, NestJS 12 và **MySQL 8.4 LTS** trong Docker. Backend sử dụng `mysql2`; thêm/sửa/xóa và tìm kiếm sản phẩm gọi stored procedure thật. Các SQL trong `database/` hiện là MySQL, dùng `CALL`, `SIGNAL`, `DELIMITER`, `NEW`/`OLD` và `utf8mb4`.

## Mở lại hệ thống trên máy hiện tại

Dữ liệu đã chuyển từ SQL Server sang MySQL. Mở Docker Desktop ở chế độ Linux containers, sau đó tại thư mục `highlands`:

```powershell
npm.cmd run db:up
npm.cmd run dev
```

- Web: [http://localhost:3000](http://localhost:3000).
- API kiểm tra: [http://localhost:3001/api/health](http://localhost:3001/api/health), trả `engine: "MySQL"`, phiên bản và `tableCount: 18`.
- MySQL: `127.0.0.1:3306`, database `HighlandsCoffeeDB`.
- MySQL Workbench: tạo kết nối Standard TCP/IP với host/port trên. Tài khoản ứng dụng là `DB_USER` trong `.env`; mật khẩu đọc tại máy từ `.env`. Tài khoản này chỉ đọc và thực thi thủ tục được cấp; sửa DDL hoặc chạy bộ kiểm tra cần `root` với `MYSQL_ROOT_PASSWORD`.

Không chạy lại `db:init` trên database hiện có. Không xóa volume nếu cần giữ dữ liệu.

## Cài mới trên máy khác

Yêu cầu Node.js 24+, npm và Docker Desktop đang chạy.

```powershell
npm.cmd --prefix highlands-server install
npm.cmd --prefix highlands-client install
npm.cmd run setup
npm.cmd run db:up
npm.cmd run db:init
npm.cmd run db:check
npm.cmd run dev
```

`setup` tạo mật khẩu root và ứng dụng riêng, không in ra chat/log. `.env` ở gốc là nguồn cấu hình; `highlands-server/.env` được đồng bộ từ đó. FE chỉ biết địa chỉ backend, không chứa mật khẩu. Khi đã có cấu hình MySQL, `setup` giữ nguyên mật khẩu để tương thích volume hiện tại.

## Các lệnh khác

```powershell
# Cập nhật thủ tục, trigger, hàm; giữ bảng và dữ liệu
npm.cmd run db:update

# Kiểm tra dữ liệu và 10 nhóm phản ví dụ có rollback
npm.cmd run db:check

# Kiểm tra toàn bộ SQL + seed trên database thử riêng, tự dọn sau khi chạy
npm.cmd run test:db:fresh

# Kiểm thử HTTP qua Next.js -> NestJS -> MySQL; cần FE/BE đang chạy
npm.cmd run test:integration

# Kiểm tra và build mã nguồn
npm.cmd test
npm.cmd run build

# Dừng MySQL, giữ volume
npm.cmd run db:down
```

`db:init` và `db:migrate` từ chối database có bảng để tránh ghi đè. Nếu DDL bị lỗi giữa chừng và **mọi bảng còn rỗng**, script hỗ trợ `node scripts/database.mjs init --resume-empty` (hoặc `migrate --resume-empty`) để tiếp tục sau khi sửa lỗi; nó kiểm tra tên bảng và không cho tiếp tục nếu đã có dữ liệu. DDL MySQL có implicit commit; vì vậy cần đọc rõ tên file/câu lệnh lỗi, không xóa DB để thử lại.

## Chức năng và SQL

| Màn hình          | Xử lý                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Thực đơn          | `sp_TimKiemSanPham_Menu`: tìm kiếm, lọc, sắp xếp; mỗi sản phẩm một dòng                                   |
| Form sản phẩm     | `sp_InsertSanPham`, `sp_UpdateSanPham`: nhiều danh mục, nhiều giá size cho nước hoặc giá cố định cho bánh |
| Xóa sản phẩm      | `sp_DeleteSanPham`: chỉ xóa món chưa có hóa đơn; món đã bán chuyển Ngừng kinh doanh                       |
| Báo cáo           | `sp_ThongKeDoanhThuSanPham`: JOIN, WHERE, GROUP BY, HAVING, ORDER BY; doanh số món trước giảm giá hóa đơn |
| Hai hàm phân tích | Cursor MySQL, IF, LOOP; chuỗi ngày chi tiêu và ngân sách ưu đãi chi nhánh                                 |
| Hóa đơn           | `sp_ChuyenTrangThaiHoaDon`, trigger tính tiền/voucher/điểm và khóa đơn đã kết thúc                        |
| Điểm & voucher    | `sp_DoiVoucher`, trigger trừ điểm và tạo lịch sử trong cùng transaction                                   |

Tài khoản ứng dụng chỉ được SELECT và EXECUTE các routine cần thiết. Stored procedure dùng `SQL SECURITY DEFINER` và transaction để cập nhật các bảng liên quan; người dùng ứng dụng không được DML trực tiếp.

## Cấu trúc

```text
database/01-schema.sql       18 bảng, PK/FK, UNIQUE, CHECK, chỉ mục
database/02-procedures.sql   CRUD, tìm kiếm, thống kê, đổi voucher, trạng thái đơn
database/03-triggers.sql     BEFORE/AFTER theo từng dòng của MySQL
database/04-functions.sql    Hai hàm có cursor
database/05-seed.sql         Dữ liệu mẫu thông qua nghiệp vụ thật
docs/testing/sql/06-checks.sql  Kiểm tra tính nhất quán bằng SQL
docs/testing/check-database.mjs Phản ví dụ nghiệp vụ, luôn rollback
docs/testing/unit/             Unit test riêng của Highlands
docs/archive/                  Công cụ tạm, bản cũ và bản sao lưu
highlands-client/           Next.js
highlands-server/           NestJS + mysql2
compose.yaml                mysql:8.4 và volume highlands-mysql
```

## Chuyển từ SQL Server trên máy này

Đã sao lưu dữ liệu, SQL và cấu hình cũ vào `docs/archive/private-backups/sqlserver-before-mysql/` (được gitignore). Lệnh `db:migrate` nhập bản sao lưu vào MySQL rỗng theo thứ tự FK, sau đó cài trigger để không cộng/trừ điểm lần thứ hai khi nhập lịch sử. Đã đối chiếu toàn bộ giá trị từng dòng của 18 bảng bằng `npm.cmd run test:migration`; lệnh này chỉ dùng khi bản sao lưu còn tồn tại và trước khi tiếp tục thay đổi dữ liệu nghiệp vụ.

Volume SQL Server cũ được giữ để dự phòng; ứng dụng hiện không dùng nó. Các script chuyển đổi tạm đã nằm trong `docs/archive/scratch/`, công cụ `prepare-*` cũ nằm trong `docs/archive/tools/`; không chạy lại chúng để ghi đè SQL hiện tại. Các tài liệu Word/PDF/PPT nguồn trong Downloads là bản gốc, chưa được biên tập lại theo MySQL. Xem [danh mục lưu trữ](docs/README.md) để biết vị trí các file đã chuyển.

Đọc [ghi chú chuyển MySQL](docs/CHUYEN_SANG_MYSQL.md), [kịch bản demo](docs/DEMO_BTL2.md) và [kết quả kiểm thử](docs/KIEM_THU.md).

## Quy tắc nghiệp vụ và giới hạn

Giá chi tiết và topping là giá tại thời điểm chọn, giữ nguyên khi giá thực đơn đổi. Tiền dòng bằng `(giá món + tổng giá topping × số lượng topping mỗi món) × số lượng món`. Hóa đơn tổng hợp tiền dòng, giảm giá, rồi tính `FLOOR(thực trả/10000)` khi hoàn tất. Đơn dưới 10.000 không sinh lịch sử điểm. Hủy đơn chưa hoàn tất giải phóng voucher; đơn hoàn tất/đã hủy và lịch sử điểm không cho sửa/xóa.

Các hàm chỉ phân tích, không tự cộng điểm chuỗi lửa. Ràng buộc toàn phần sản phẩm/danh mục/size được duy trì qua thủ tục và quyền ứng dụng, đồng thời audit bằng `db:check`. Đơn chờ được tạm rỗng khi xây dựng; xác nhận/hoàn tất bắt buộc có món. Đây là ứng dụng quản lý cục bộ cho BTL2, chưa có đăng nhập người dùng, OTP, POS hay thanh toán thật. Kiểm thử chưa bao phủ tải lớn và mọi lịch xen kẽ đồng thời.
