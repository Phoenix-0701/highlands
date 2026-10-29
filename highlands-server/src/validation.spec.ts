import { BadRequestException } from '@nestjs/common';
import * as v from './validation';

const water = {
  Ma_SP: 'SP12',
  Ten_SP: 'Trà sen mới',
  Loai_SP: 'MON_NUOC',
  Trang_thai: 'Đang bán',
  Danh_muc: ['DM02'],
  Bang_gia: [{ Ma_size: 'S', Gia_ban: 29000 }],
  Don_gia: null,
};
describe('Validation before SQL parameters', () => {
  it('preserves Unicode and multi-category/multi-size input', () => {
    const data = v.product({
      ...water,
      Danh_muc: ['DM02', 'DM05'],
      Bang_gia: [
        { Ma_size: 'S', Gia_ban: 29000 },
        { Ma_size: 'M', Gia_ban: 39000 },
      ],
    });
    expect(data.Ten_SP).toBe('Trà sen mới');
    expect(data.Danh_muc).toHaveLength(2);
    expect(data.Bang_gia).toHaveLength(2);
  });
  it.each([
    { Ma_SP: 'SP12;DROP TABLE SAN_PHAM' },
    { Ma_SP: 'SP01abc' },
    { Ten_SP: '  ' },
    { Loai_SP: null },
    { Trang_thai: null },
    { Danh_muc: [] },
    { Danh_muc: ['DM01', 'DM01'] },
    { Bang_gia: [] },
    { Bang_gia: [{ Ma_size: 'S', Gia_ban: 4999 }] },
    {
      Bang_gia: [
        { Ma_size: 'S', Gia_ban: 29000 },
        { Ma_size: 'S', Gia_ban: 30000 },
      ],
    },
    { Don_gia: 29000 },
  ])('rejects malformed product %p', (patch) => {
    expect(() => v.product({ ...water, ...patch })).toThrow(
      BadRequestException,
    );
  });
  it('rejects cake with size and accepts a fixed-price cake', () => {
    expect(() =>
      v.product({ ...water, Loai_SP: 'BANH_NGOT', Don_gia: 19000 }),
    ).toThrow('Bánh ngọt');
    expect(
      v.product({
        ...water,
        Loai_SP: 'BANH_NGOT',
        Don_gia: 19000,
        Bang_gia: [],
      }).Don_gia,
    ).toBe(19000);
  });
  it.each(['2026-02-30', '2026-13-01', '01/10/2026', '', null])(
    'rejects invalid calendar date %p',
    (s) => expect(() => v.date(s, 'Ngày')).toThrow(BadRequestException),
  );
  it('rejects reversed dates and accepts leap day', () => {
    expect(() => v.range('2026-10-31', '2026-10-01')).toThrow('Từ ngày');
    expect(v.date('2024-02-29', 'Ngày').toISOString()).toContain('2024-02-29');
  });
  it.each([true, {}, NaN, Infinity, 'abc', -1, 1.001])(
    'rejects malformed amount %p',
    (x) => expect(() => v.number(x, 'Giá')).toThrow(BadRequestException),
  );
});
