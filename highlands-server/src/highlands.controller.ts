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
import * as sql from 'mssql';
import { DatabaseService } from './database.service';
import * as v from './validation';

@Controller()
export class HighlandsController {
  constructor(private readonly db: DatabaseService) {}

  @Get('health')
  async health() {
    const p = await this.db.pool();
    const r = await p
      .request()
      .query(
        "SELECT DB_NAME() databaseName, (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo')) tableCount, CASE WHEN OBJECT_ID('dbo.sp_TimKiemSanPham_Menu','P') IS NULL THEN 0 ELSE 1 END ready",
      );
    if (!r.recordset[0].ready)
      throw new BadRequestException(
        'SQL Server đã kết nối nhưng chưa khởi tạo thủ tục. Chạy npm run db:init.',
      );
    return { connected: true, ...r.recordset[0] };
  }

  @Get('lookups')
  async lookups() {
    const p = await this.db.pool();
    const r = await p
      .request()
      .query(
        "SELECT Ma_danh_muc,Ten_danh_muc FROM dbo.DANH_MUC ORDER BY Ma_danh_muc; SELECT Ma_size,Ten_size FROM dbo.KICH_THUOC ORDER BY CASE Ma_size WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4 ELSE 5 END; SELECT Ma_CN,Ten_CN FROM dbo.CHI_NHANH ORDER BY Ma_CN; SELECT Ma_KH,Ho,Ten,Diem_tich_luy,Hang_thanh_vien FROM dbo.KHACH_HANG ORDER BY Ma_KH; SELECT * FROM dbo.VOUCHER ORDER BY Diem_doi;",
      );
    const sets = r.recordsets as sql.IRecordSet<unknown>[];
    return {
      categories: sets[0],
      sizes: sets[1],
      branches: sets[2],
      customers: sets[3],
      vouchers: sets[4],
    };
  }

  @Get('products')
  async products(@Query() q: Record<string, unknown>) {
    const low = v.number(q.minPrice, 'Giá từ'),
      high = v.number(q.maxPrice, 'Giá đến');
    if (low !== null && high !== null && low > high)
      throw new BadRequestException('Giá từ không được lớn hơn giá đến.');
    const p = await this.db.pool();
    const r = await p
      .request()
      .input('Tu_khoa', sql.NVarChar(150), v.text(q.search, 'Từ khóa', 150))
      .input('Ma_danh_muc', sql.VarChar(20), v.text(q.category, 'Danh mục', 20))
      .input(
        'Loai_SP',
        sql.VarChar(20),
        q.type ? v.choice(q.type, 'Loại', v.TYPES) : null,
      )
      .input(
        'Trang_thai',
        sql.NVarChar(50),
        q.status ? v.choice(q.status, 'Trạng thái', v.STATUSES) : null,
      )
      .input('Gia_tu', sql.Decimal(12, 2), low)
      .input('Gia_den', sql.Decimal(12, 2), high)
      .input(
        'Sap_xep_theo',
        sql.VarChar(20),
        v.choice(
          q.sort,
          'Sắp xếp',
          ['TEN_ASC', 'GIA_ASC', 'GIA_DESC'],
          'TEN_ASC',
        ),
      )
      .execute('dbo.sp_TimKiemSanPham_Menu');
    return r.recordset.map((row: Record<string, unknown>) => ({
      ...row,
      Danh_muc: JSON.parse(String(row.Danh_muc ?? '[]')) as unknown,
      Bang_gia: JSON.parse(String(row.Bang_gia ?? '[]')) as unknown,
    }));
  }

  private async save(body: unknown, id?: string) {
    const data = v.product(body, id);
    const p = await this.db.pool();
    await p
      .request()
      .input('Ma_SP', sql.VarChar(20), data.Ma_SP)
      .input('Ten_SP', sql.NVarChar(150), data.Ten_SP)
      .input('Loai_SP', sql.VarChar(20), data.Loai_SP)
      .input('Mo_ta', sql.NVarChar(500), data.Mo_ta)
      .input('Trang_thai', sql.NVarChar(50), data.Trang_thai)
      .input('Danh_muc', sql.NVarChar(sql.MAX), JSON.stringify(data.Danh_muc))
      .input('Bang_gia', sql.NVarChar(sql.MAX), JSON.stringify(data.Bang_gia))
      .input('Don_gia', sql.Decimal(12, 2), data.Don_gia)
      .execute(id ? 'dbo.sp_UpdateSanPham' : 'dbo.sp_InsertSanPham');
    return {
      message: id ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.',
      Ma_SP: data.Ma_SP,
    };
  }
  @Post('products') create(@Body() b: unknown) {
    return this.save(b);
  }
  @Put('products/:id') update(@Param('id') id: string, @Body() b: unknown) {
    return this.save(b, id);
  }
  @Delete('products/:id') async remove(@Param('id') id: string) {
    const p = await this.db.pool();
    await p
      .request()
      .input('Ma_SP', sql.VarChar(20), v.text(id, 'Mã sản phẩm', 20, true))
      .execute('dbo.sp_DeleteSanPham');
    return { message: 'Đã xóa sản phẩm chưa phát sinh giao dịch.' };
  }

  @Get('reports/revenue') async revenue(@Query() q: Record<string, unknown>) {
    const [from, to] = v.range(q.from, q.to);
    const minQuantity =
      v.number(q.minQuantity, 'Số lượng tối thiểu', 1, 2147483647) ?? 1;
    if (!Number.isInteger(minQuantity))
      throw new BadRequestException('Số lượng tối thiểu phải là số nguyên.');
    const p = await this.db.pool();
    const r = await p
      .request()
      .input('Tu_ngay', sql.Date, from)
      .input('Den_ngay', sql.Date, to)
      .input('Ma_CN', sql.VarChar(20), v.text(q.branch, 'Chi nhánh', 20))
      .input('So_luong_ban_toi_thieu', sql.Int, minQuantity)
      .input(
        'Doanh_thu_toi_thieu',
        sql.Decimal(18, 2),
        v.number(q.minRevenue, 'Doanh số tối thiểu', 0) ?? 0,
      )
      .execute('dbo.sp_ThongKeDoanhThuSanPham');
    return r.recordset;
  }

  @Get('reports/streak') async streak(@Query() q: Record<string, unknown>) {
    const [from, to] = v.range(q.from, q.to);
    const p = await this.db.pool();
    const r = await p
      .request()
      .input(
        'customer',
        sql.VarChar(20),
        v.text(q.customer, 'Khách hàng', 20, true),
      )
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(
        'SELECT dbo.fn_TinhDiemThuongChuoiLua(@customer,@from,@to) result',
      );
    return r.recordset[0] as { result: string };
  }

  @Get('reports/discount') async discount(@Query() q: Record<string, unknown>) {
    const month = v.number(q.month, 'Tháng', 1, 12, false)!,
      year = v.number(q.year, 'Năm', 2020, 2100, false)!;
    if (!Number.isInteger(month) || !Number.isInteger(year))
      throw new BadRequestException('Tháng và năm phải là số nguyên.');
    const p = await this.db.pool();
    const r = await p
      .request()
      .input('branch', sql.VarChar(20), v.text(q.branch, 'Chi nhánh', 20, true))
      .input('month', sql.Int, month)
      .input('year', sql.Int, year)
      .query(
        'SELECT dbo.fn_PhanTichGiaTriUuDaiChiNhanh(@branch,@month,@year) result',
      );
    return r.recordset[0] as { result: string };
  }

  @Get('orders') async orders() {
    const p = await this.db.pool();
    return (
      await p
        .request()
        .query(
          "SELECT TOP(200) h.*,k.Ho+N' '+k.Ten Ten_KH,c.Ten_CN FROM dbo.HOA_DON h JOIN dbo.KHACH_HANG k ON h.Ma_KH=k.Ma_KH JOIN dbo.CHI_NHANH c ON h.Ma_CN=c.Ma_CN ORDER BY h.Ngay_tao DESC,h.Ma_HD",
        )
    ).recordset;
  }
  @Patch('orders/:id/status') async status(
    @Param('id') id: string,
    @Body() b: { status?: unknown },
  ) {
    const status = v.choice(b?.status, 'Trạng thái', [
      'DANG_CHUAN_BI',
      'HOAN_TAT',
      'DA_HUY',
    ]);
    const p = await this.db.pool();
    await p
      .request()
      .input('Ma_HD', sql.VarChar(20), v.text(id, 'Hóa đơn', 20, true))
      .input('Trang_thai', sql.VarChar(30), status)
      .execute('dbo.sp_ChuyenTrangThaiHoaDon');
    return {
      message: 'Đã cập nhật hóa đơn; trigger đã tính tiền, voucher và điểm.',
    };
  }

  @Get('loyalty/:id') async loyalty(@Param('id') id: string) {
    const p = await this.db.pool();
    const r = await p
      .request()
      .input('id', sql.VarChar(20), v.text(id, 'Khách hàng', 20, true))
      .query(
        'SELECT c.*,v.Ten_Voucher FROM dbo.VOUCHER_CA_NHAN c JOIN dbo.VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher WHERE c.Ma_KH=@id ORDER BY c.Ngay_doi DESC; SELECT * FROM dbo.LICH_SU_DIEM WHERE Ma_KH=@id ORDER BY Thoi_gian DESC,Ma_LS;',
      );
    const sets = r.recordsets as sql.IRecordSet<unknown>[];
    return { vouchers: sets[0], history: sets[1] };
  }
  @Post('loyalty/redeem') async redeem(
    @Body() b: { customer?: unknown; voucher?: unknown },
  ) {
    const p = await this.db.pool();
    const id = 'VC' + crypto.randomUUID().replaceAll('-', '').slice(0, 18);
    await p
      .request()
      .input('Ma_VCCN', sql.VarChar(20), id)
      .input(
        'Ma_KH',
        sql.VarChar(20),
        v.text(b?.customer, 'Khách hàng', 20, true),
      )
      .input(
        'Ma_Voucher',
        sql.VarChar(20),
        v.text(b?.voucher, 'Voucher', 20, true),
      )
      .execute('dbo.sp_DoiVoucher');
    return {
      message: 'Đổi voucher thành công. Điểm đã được trừ và ghi vào lịch sử.',
      Ma_VCCN: id,
    };
  }
}
