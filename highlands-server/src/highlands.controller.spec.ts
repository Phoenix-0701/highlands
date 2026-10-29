import { HighlandsController } from './highlands.controller';
import { DatabaseService } from './database.service';

describe('Application uses parameterized SQL procedures', () => {
  const input = jest.fn(),
    execute = jest.fn(),
    query = jest.fn();
  const request = { input, execute, query };
  const pool = jest.fn();
  const controller = new HighlandsController({
    pool,
  } as unknown as DatabaseService);
  beforeEach(() => {
    jest.clearAllMocks();
    input.mockReturnValue(request);
    execute.mockResolvedValue({ recordset: [] });
    pool.mockResolvedValue({ request: () => request });
  });
  const cake = {
    Ma_SP: 'SP12',
    Ten_SP: 'Bánh Tiramisu',
    Loai_SP: 'BANH_NGOT',
    Trang_thai: 'Đang bán',
    Danh_muc: ['DM04'],
    Bang_gia: [],
    Don_gia: 35000,
  };
  it('calls the INSERT procedure, never an ad-hoc write', async () => {
    await controller.create(cake);
    expect(execute).toHaveBeenCalledWith('dbo.sp_InsertSanPham');
    expect(query).not.toHaveBeenCalled();
    expect(input).toHaveBeenCalledWith(
      'Danh_muc',
      expect.anything(),
      '["DM04"]',
    );
  });
  it('calls UPDATE and DELETE procedures', async () => {
    await controller.update('SP12', cake);
    expect(execute).toHaveBeenLastCalledWith('dbo.sp_UpdateSanPham');
    await controller.remove('SP12');
    expect(execute).toHaveBeenLastCalledWith('dbo.sp_DeleteSanPham');
  });
  it('keeps SQL-shaped search text in a typed parameter', async () => {
    const search = "'; DROP TABLE SAN_PHAM;--";
    await controller.products({ search });
    expect(input).toHaveBeenCalledWith('Tu_khoa', expect.anything(), search);
    expect(execute).toHaveBeenCalledWith('dbo.sp_TimKiemSanPham_Menu');
  });
  it('blocks invalid product and reversed price interval before connecting', async () => {
    await expect(controller.create({ ...cake, Don_gia: 0 })).rejects.toThrow(
      'Giá bánh',
    );
    await expect(
      controller.products({ minPrice: '50000', maxPrice: '10000' }),
    ).rejects.toThrow('Giá từ');
    expect(pool).not.toHaveBeenCalled();
  });
  it('passes dates and HAVING inputs to the aggregate procedure', async () => {
    await controller.revenue({
      from: '2026-10-01',
      to: '2026-10-31',
      minQuantity: '2',
      minRevenue: '50000',
    });
    expect(execute).toHaveBeenCalledWith('dbo.sp_ThongKeDoanhThuSanPham');
    expect(input).toHaveBeenCalledWith(
      'So_luong_ban_toi_thieu',
      expect.anything(),
      2,
    );
  });
});
