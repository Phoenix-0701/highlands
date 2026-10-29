import fs from 'node:fs';
const report = fs.readFileSync('docs/sources/Bao_Cao_BTL2_Highlands_Coffee_Nhom1.txt', 'utf8');
const ddl = report.slice(report.indexOf('CREATE DATABASE HighlandsCoffeeDB;'), report.indexOf('1.2. Dữ liệu mẫu'));
fs.writeFileSync('docs/sources/original-report.sql', ddl + '\n' + report.slice(report.indexOf('-- 1. DANH_MUC (5 hàng)'), report.indexOf('PHẦN III:')));
let schema = ddl.replace('CREATE DATABASE HighlandsCoffeeDB;', "IF DB_ID(N'HighlandsCoffeeDB') IS NULL\n    EXEC(N'CREATE DATABASE HighlandsCoffeeDB');");
schema = schema.replace('CREATE TABLE DANH_MUC (', "IF OBJECT_ID(N'dbo.SAN_PHAM') IS NOT NULL\n    THROW 51000, N'CSDL đã có bảng. Không chạy lại schema trên dữ liệu hiện có.', 1;\nGO\nCREATE TABLE DANH_MUC (");
schema = schema.replace('    Loai_SP VARCHAR(20) NOT NULL,', '    Loai_SP VARCHAR(20) NOT NULL,\n    CONSTRAINT UQ_SP_Loai UNIQUE (Ma_SP, Loai_SP),');
for (const [table, type] of [['BANH_NGOT','BANH_NGOT'],['MON_NUOC','MON_NUOC']]) {
  const old = `CONSTRAINT FK_${table === 'BANH_NGOT' ? 'BanhNgot' : 'MonNuoc'}_SanPham FOREIGN KEY (Ma_SP) REFERENCES SAN_PHAM(Ma_SP) ON DELETE CASCADE,`;
  schema = schema.replace(old, `Loai_SP VARCHAR(20) NOT NULL DEFAULT '${type}' CHECK (Loai_SP = '${type}'),\n    CONSTRAINT FK_${type}_PhanLoai FOREIGN KEY (Ma_SP, Loai_SP) REFERENCES SAN_PHAM(Ma_SP, Loai_SP) ON DELETE CASCADE,`);
  // MON_NUOC's only FK is the final table declaration (no comma).
  schema = schema.replace(old.slice(0,-1)+'\n', `Loai_SP VARCHAR(20) NOT NULL DEFAULT '${type}' CHECK (Loai_SP = '${type}'),\n    CONSTRAINT FK_${type}_PhanLoai FOREIGN KEY (Ma_SP, Loai_SP) REFERENCES SAN_PHAM(Ma_SP, Loai_SP) ON DELETE CASCADE\n`);
}
schema = schema.replace('CHECK (HSD > Ngay_doi)', 'CHECK (HSD > Ngay_doi)');
schema = schema.replace('Ma_LS VARCHAR(20) PRIMARY KEY', 'Ma_LS VARCHAR(50) PRIMARY KEY');
schema = schema.replace('    CONSTRAINT CHK_SanPham_LoaiSP', "    CONSTRAINT CHK_SP_Ma CHECK (Ma_SP LIKE 'SP[0-9][0-9]%' AND SUBSTRING(Ma_SP,3,20) NOT LIKE '%[^0-9]%'),\n    CONSTRAINT CHK_SP_Ten CHECK (LEN(LTRIM(RTRIM(Ten_SP))) >= 3),\n    CONSTRAINT CHK_SanPham_LoaiSP");
schema = schema.replace('CHECK (Don_gia > 0)', 'CHECK (Don_gia >= 5000)').replace('CHECK (Gia_ban > 0)', 'CHECK (Gia_ban >= 5000)');
schema += `\n-- Indexes for joins and reporting.\nCREATE INDEX IX_CTHD_SanPham ON dbo.CHI_TIET_HOA_DON(Ma_SP) INCLUDE(Ma_HD,So_luong,Thanh_tien);\nCREATE INDEX IX_HD_NgayTrangThai ON dbo.HOA_DON(Trang_thai,Ngay_tao) INCLUDE(Ma_CN,Ma_KH);\nCREATE INDEX IX_LSD_Khach ON dbo.LICH_SU_DIEM(Ma_KH) INCLUDE(Diem_thay_doi);\nGO\n`;
fs.writeFileSync('database/01-schema.sql', schema);
const functions = report.slice(report.indexOf('-- HÀM 1:'),report.indexOf('PHẦN IV:'));
fs.writeFileSync('database/04-functions.sql', 'USE HighlandsCoffeeDB;\nGO\n' + functions.replaceAll("FORMAT(@TongDoanhThuThuc, 'N0')", 'CONVERT(NVARCHAR(40),CAST(@TongDoanhThuThuc AS DECIMAL(18,0)))').replaceAll("FORMAT(@TongTienTroGia, 'N0')", 'CONVERT(NVARCHAR(40),CAST(@TongTienTroGia AS DECIMAL(18,0)))'));
