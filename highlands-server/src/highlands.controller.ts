import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { DatabaseService } from './database.service';
import * as v from './validation';
const day = (value: Date) => value.toISOString().slice(0, 10);
@Controller()
export class HighlandsController {
  constructor(private readonly db: DatabaseService) {}
  @Get('health') async health() {
    const [row] = await this.db.query(
      "SELECT DATABASE() databaseName, VERSION() version, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE') tableCount, (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='sp_TimKiemSanPham_Menu') ready",
    );
    if (!row.ready)
      throw new BadRequestException(
        'MySQL đã kết nối nhưng chưa khởi tạo thủ tục. Chạy npm run db:init.',
      );
    return { connected: true, engine: 'MySQL', ...row };
  }
  @Get('lookups') async lookups() {
    const [categories, sizes, branches, customers, vouchers] =
      await Promise.all([
        this.db.query(
          'SELECT Ma_danh_muc,Ten_danh_muc FROM DANH_MUC ORDER BY Ma_danh_muc',
        ),
        this.db.query(
          "SELECT Ma_size,Ten_size FROM KICH_THUOC ORDER BY FIELD(Ma_size,'XS','S','M','L','XL')",
        ),
        this.db.query('SELECT Ma_CN,Ten_CN FROM CHI_NHANH ORDER BY Ma_CN'),
        this.db.query(
          'SELECT Ma_KH,Ho,Ten,Diem_tich_luy,Hang_thanh_vien FROM KHACH_HANG ORDER BY Ma_KH',
        ),
        this.db.query('SELECT * FROM VOUCHER ORDER BY Diem_doi'),
      ]);
    return { categories, sizes, branches, customers, vouchers };
  }
  @Get('products') async products(@Query() q: Record<string, unknown>) {
    const low = v.number(q.minPrice, 'Giá từ'),
      high = v.number(q.maxPrice, 'Giá đến');
    if (low !== null && high !== null && low > high)
      throw new BadRequestException('Giá từ không được lớn hơn giá đến.');
    const rows = await this.db.call('sp_TimKiemSanPham_Menu', [
      v.text(q.search, 'Từ khóa', 150),
      v.text(q.category, 'Danh mục', 20),
      q.type ? v.choice(q.type, 'Loại', v.TYPES) : null,
      q.status ? v.choice(q.status, 'Trạng thái', v.STATUSES) : null,
      low,
      high,
      v.choice(
        q.sort,
        'Sắp xếp',
        ['TEN_ASC', 'GIA_ASC', 'GIA_DESC'],
        'TEN_ASC',
      ),
    ]);
    const list = (value: unknown): Record<string, unknown>[] =>
      (typeof value === 'string' ? JSON.parse(value) : (value ?? [])) as Record<
        string,
        unknown
      >[];
    return rows.map((row) => ({
      ...row,
      Danh_muc: list(row.Danh_muc).sort((a, b) =>
        String(a.Ma_danh_muc).localeCompare(String(b.Ma_danh_muc)),
      ),
      Bang_gia: list(row.Bang_gia).sort(
        (a, b) =>
          ['XS', 'S', 'M', 'L', 'XL'].indexOf(String(a.Ma_size)) -
          ['XS', 'S', 'M', 'L', 'XL'].indexOf(String(b.Ma_size)),
      ),
    }));
  }
  private async save(body: unknown, id?: string) {
    const d = v.product(body, id);
    await this.db.call(id ? 'sp_UpdateSanPham' : 'sp_InsertSanPham', [
      d.Ma_SP,
      d.Ten_SP,
      d.Loai_SP,
      d.Mo_ta,
      d.Trang_thai,
      JSON.stringify(d.Danh_muc),
      JSON.stringify(d.Bang_gia),
      d.Don_gia,
    ]);
    return {
      message: id ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.',
      Ma_SP: d.Ma_SP,
    };
  }
  @Post('products') create(@Body() b: unknown) {
    return this.save(b);
  }
  @Put('products/:id') update(@Param('id') id: string, @Body() b: unknown) {
    return this.save(b, id);
  }
  @Delete('products/:id') async remove(@Param('id') id: string) {
    await this.db.call('sp_DeleteSanPham', [
      v.text(id, 'Mã sản phẩm', 20, true),
    ]);
    return { message: 'Đã xóa sản phẩm chưa phát sinh giao dịch.' };
  }
  @Get('reports/revenue') async revenue(@Query() q: Record<string, unknown>) {
    const [from, to] = v.range(q.from, q.to),
      quantity =
        v.number(q.minQuantity, 'Số lượng tối thiểu', 1, 2147483647) ?? 1;
    if (!Number.isInteger(quantity))
      throw new BadRequestException('Số lượng tối thiểu phải là số nguyên.');
    return this.db.call('sp_ThongKeDoanhThuSanPham', [
      day(from),
      day(to),
      v.text(q.branch, 'Chi nhánh', 20),
      quantity,
      v.number(q.minRevenue, 'Doanh số tối thiểu', 0) ?? 0,
    ]);
  }
  @Get('reports/streak') async streak(@Query() q: Record<string, unknown>) {
    const [from, to] = v.range(q.from, q.to);
    return (
      await this.db.query('SELECT fn_TinhDiemThuongChuoiLua(?,?,?) result', [
        v.text(q.customer, 'Khách hàng', 20, true),
        day(from),
        day(to),
      ])
    )[0];
  }
  @Get('reports/discount') async discount(@Query() q: Record<string, unknown>) {
    const month = v.number(q.month, 'Tháng', 1, 12, false)!,
      year = v.number(q.year, 'Năm', 2020, 2100, false)!;
    if (!Number.isInteger(month) || !Number.isInteger(year))
      throw new BadRequestException('Tháng và năm phải là số nguyên.');
    return (
      await this.db.query(
        'SELECT fn_PhanTichGiaTriUuDaiChiNhanh(?,?,?) result',
        [v.text(q.branch, 'Chi nhánh', 20, true), month, year],
      )
    )[0];
  }
  @Get('orders') async orders() {
    return this.db.query(
      "SELECT h.*,CONCAT(k.Ho,' ',k.Ten) Ten_KH,c.Ten_CN FROM HOA_DON h JOIN KHACH_HANG k ON k.Ma_KH=h.Ma_KH JOIN CHI_NHANH c ON c.Ma_CN=h.Ma_CN ORDER BY h.Ngay_tao DESC,h.Ma_HD LIMIT 200",
    );
  }
  @Patch('orders/:id/status') async status(
    @Param('id') id: string,
    @Body() b: { status?: unknown },
  ) {
    await this.db.call('sp_ChuyenTrangThaiHoaDon', [
      v.text(id, 'Hóa đơn', 20, true),
      v.choice(b?.status, 'Trạng thái', [
        'DANG_CHUAN_BI',
        'HOAN_TAT',
        'DA_HUY',
      ]),
    ]);
    return {
      message: 'Đã cập nhật hóa đơn; trigger đã tính tiền, voucher và điểm.',
    };
  }
  @Get('loyalty/:id') async loyalty(@Param('id') id: string) {
    const customer = v.text(id, 'Khách hàng', 20, true);
    const [vouchers, history] = await Promise.all([
      this.db.query(
        'SELECT c.*,v.Ten_Voucher FROM VOUCHER_CA_NHAN c JOIN VOUCHER v ON v.Ma_Voucher=c.Ma_Voucher WHERE c.Ma_KH=? ORDER BY c.Ngay_doi DESC',
        [customer],
      ),
      this.db.query(
        'SELECT * FROM LICH_SU_DIEM WHERE Ma_KH=? ORDER BY Thoi_gian DESC,Ma_LS',
        [customer],
      ),
    ]);
    return { vouchers, history };
  }
  @Post('loyalty/redeem') async redeem(
    @Body() b: { customer?: unknown; voucher?: unknown },
  ) {
    const id = 'VC' + crypto.randomUUID().replaceAll('-', '').slice(0, 18);
    await this.db.call('sp_DoiVoucher', [
      id,
      v.text(b?.customer, 'Khách hàng', 20, true),
      v.text(b?.voucher, 'Voucher', 20, true),
      null,
    ]);
    return {
      message: 'Đổi voucher thành công. Điểm đã được trừ và ghi vào lịch sử.',
      Ma_VCCN: id,
    };
  }
}
