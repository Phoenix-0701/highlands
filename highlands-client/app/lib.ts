export type Category = { Ma_danh_muc: string; Ten_danh_muc: string };
export type Price = { Ma_size: string; Gia_ban: number };
export type Product = {
  Ma_SP: string;
  Ten_SP: string;
  Loai_SP: string;
  Mo_ta: string | null;
  Trang_thai: string;
  Gia_tu: number;
  Gia_den: number;
  Don_gia: number | null;
  Danh_muc: Category[];
  Bang_gia: Price[];
  So_hoa_don: number;
};
export type Customer = {
  Ma_KH: string;
  Ho: string;
  Ten: string;
  Diem_tich_luy: number;
  Hang_thanh_vien: string;
};
export type Voucher = {
  Ma_Voucher: string;
  Ten_Voucher: string;
  Diem_doi: number;
  Tgian_hieu_luc: number;
};
export type Branch = { Ma_CN: string; Ten_CN: string };
export type Lookups = {
  categories: Category[];
  sizes: { Ma_size: string; Ten_size: string }[];
  customers: Customer[];
  branches: Branch[];
  vouchers: Voucher[];
};
export type Order = {
  Ma_HD: string;
  Ngay_tao: string;
  Ten_KH: string;
  Ten_CN: string;
  Trang_thai: string;
  Tong_tien: number;
  So_tien_giam: number;
  Thanh_tien: number;
  Diem_tich_luy_nhan: number;
  Ma_VCCN: string | null;
};
export type Sale = {
  Ma_SP: string;
  Ten_SP: string;
  Tong_so_luong_ban: number;
  Tong_doanh_thu_mon: number;
  So_don_hang_xuat_hien: number;
  Doanh_thu_trung_binh_moi_luot: number;
};
export type LoyaltyData = {
  vouchers: {
    Ma_VCCN: string;
    Ten_Voucher: string;
    HSD: string;
    Trang_thai: string;
  }[];
  history: {
    Ma_LS: string;
    Thoi_gian: string;
    Noi_dung: string;
    Diem_thay_doi: number;
  }[];
};
export const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const date = (s: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" }).format(new Date(s));
export const labels: Record<string, string> = {
  CHO_POS_XAC_NHAN: "Chờ xác nhận",
  DANG_CHUAN_BI: "Đang chuẩn bị",
  HOAN_TAT: "Hoàn tất",
  DA_HUY: "Đã hủy",
  CHUA_SU_DUNG: "Chưa sử dụng",
  DA_SU_DUNG: "Đã sử dụng",
  HET_HAN: "Hết hạn",
};
export const initialLookups: Lookups = {
  categories: [],
  sizes: [],
  customers: [],
  branches: [],
  vouchers: [],
};

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Không kết nối được NestJS. Kiểm tra cổng 3001 và chạy npm run dev tại thư mục gốc.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.message ||
        "Máy chủ chưa sẵn sàng. Kiểm tra NestJS, MySQL và cấu hình kết nối.",
    );
  return data as T;
}
