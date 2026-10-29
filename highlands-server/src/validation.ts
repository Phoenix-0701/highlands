import { BadRequestException } from '@nestjs/common';

export function text(
  value: unknown,
  field: string,
  max: number,
  required = false,
): string | null {
  if (value == null || value === '') {
    if (required)
      throw new BadRequestException(`${field} không được để trống.`);
    return null;
  }
  if (typeof value !== 'string' || value.length > max)
    throw new BadRequestException(
      `${field} phải là chuỗi tối đa ${max} ký tự.`,
    );
  const result = value.trim();
  if (required && !result)
    throw new BadRequestException(`${field} không được để trống.`);
  return result || null;
}

export function choice(
  value: unknown,
  field: string,
  values: readonly string[],
  fallback?: string,
): string {
  const result = value == null || value === '' ? fallback : value;
  if (typeof result !== 'string' || !values.includes(result))
    throw new BadRequestException(`${field} không hợp lệ.`);
  return result;
}

export function number(
  value: unknown,
  field: string,
  min = 0,
  max = 9999999999.99,
  optional = true,
): number | null {
  if (value == null || value === '') {
    if (!optional)
      throw new BadRequestException(`${field} không được để trống.`);
    return null;
  }
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    throw new BadRequestException(`${field} phải là số.`);
  const result = Number(value);
  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max ||
    Math.abs(result * 100 - Math.round(result * 100)) > 0.0001
  ) {
    throw new BadRequestException(
      `${field} phải từ ${min} đến ${max}, tối đa 2 chữ số thập phân.`,
    );
  }
  return result;
}

export function date(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException(`${field} phải có định dạng YYYY-MM-DD.`);
  const result = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value ||
    value < '2020-01-01' ||
    value > '2100-12-31'
  ) {
    throw new BadRequestException(
      `${field} phải là ngày hợp lệ từ năm 2020 đến 2100.`,
    );
  }
  return result;
}

export function range(from: unknown, to: unknown): [Date, Date] {
  const a = date(from, 'Từ ngày'),
    b = date(to, 'Đến ngày');
  if (a > b) throw new BadRequestException('Từ ngày không được sau đến ngày.');
  return [a, b];
}

export const TYPES = ['MON_NUOC', 'BANH_NGOT'] as const;
export const STATUSES = ['Đang bán', 'Hết hàng', 'Ngừng kinh doanh'] as const;

export function product(body: unknown, id?: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Dữ liệu sản phẩm không hợp lệ.');
  const b = body as Record<string, unknown>;
  const code = text(id ?? b.Ma_SP, 'Mã sản phẩm', 20, true)!;
  if (!/^SP\d{2,18}$/.test(code))
    throw new BadRequestException(
      'Mã sản phẩm phải là SP và từ 2 đến 18 chữ số.',
    );
  const name = text(b.Ten_SP, 'Tên sản phẩm', 150, true)!;
  if (name.length < 3)
    throw new BadRequestException('Tên sản phẩm phải có ít nhất 3 ký tự.');
  const type = choice(b.Loai_SP, 'Loại sản phẩm', TYPES);
  const categories = b.Danh_muc;
  if (
    !Array.isArray(categories) ||
    categories.length < 1 ||
    categories.length > 50
  )
    throw new BadRequestException('Chọn từ 1 đến 50 danh mục.');
  const categoryIds = categories.map((x) => text(x, 'Mã danh mục', 20, true)!);
  if (new Set(categoryIds).size !== categoryIds.length)
    throw new BadRequestException('Danh mục bị trùng.');
  if (!Array.isArray(b.Bang_gia) || b.Bang_gia.length > 5)
    throw new BadRequestException('Bảng giá cần tối đa 5 kích thước.');
  const prices = b.Bang_gia.map((row: unknown) => {
    if (!row || typeof row !== 'object')
      throw new BadRequestException('Dòng bảng giá không hợp lệ.');
    const r = row as Record<string, unknown>;
    return {
      Ma_size: choice(r.Ma_size, 'Kích thước', ['XS', 'S', 'M', 'L', 'XL']),
      Gia_ban: number(r.Gia_ban, 'Giá theo size', 5000, 9999999999.99, false)!,
    };
  });
  if (new Set(prices.map((x) => x.Ma_size)).size !== prices.length)
    throw new BadRequestException('Kích thước bị trùng.');
  const price = number(b.Don_gia, 'Giá bánh', 5000);
  if (type === 'BANH_NGOT' && (price === null || prices.length))
    throw new BadRequestException(
      'Bánh ngọt cần giá cố định và không có size.',
    );
  if (type === 'MON_NUOC' && (!prices.length || price !== null))
    throw new BadRequestException(
      'Món nước cần bảng giá theo size và không có giá bánh.',
    );
  return {
    Ma_SP: code,
    Ten_SP: name,
    Loai_SP: type,
    Trang_thai: choice(b.Trang_thai, 'Trạng thái', STATUSES),
    Mo_ta: text(b.Mo_ta, 'Mô tả', 500),
    Danh_muc: categoryIds,
    Bang_gia: prices,
    Don_gia: price,
  };
}
