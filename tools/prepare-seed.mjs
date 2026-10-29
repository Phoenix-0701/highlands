import fs from 'node:fs';
const report=fs.readFileSync('docs/sources/Bao_Cao_BTL2_Highlands_Coffee_Nhom1.txt','utf8');
let catalogue=report.slice(report.indexOf('-- 1. DANH_MUC (5 hàng)'),report.indexOf('-- 14. VOUCHER_CA_NHAN (5 hàng)'));
catalogue=catalogue.replace('INSERT INTO BANH_NGOT VALUES','INSERT INTO BANH_NGOT(Ma_SP,Don_gia) VALUES').replace('INSERT INTO MON_NUOC VALUES','INSERT INTO MON_NUOC(Ma_SP) VALUES');
catalogue=catalogue.replace(/(2026-\d\d-\d\d \d\d:\d\d:\d\d', )\d+(, ')/g,'$10$2');
let seed=`USE HighlandsCoffeeDB;\nGO\nSET XACT_ABORT ON;\nBEGIN TRANSACTION;\n${catalogue}\n`;
// Opening points are earned through actual completed catering orders, never assigned manually.
for(let n=1;n<=5;n++){
const s=String(n).padStart(2,'0');
seed+=`INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('BD${s}','2026-09-${24+n}T09:00:00','CN${s}','PT${s}','KH${s}');\nINSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('BD${s}',1,'SP05','M',N'Đá',50);\nEXEC dbo.sp_ChuyenTrangThaiHoaDon 'BD${s}','HOAN_TAT';\n`;
}
for(let n=1;n<=5;n++){
const s=String(n).padStart(2,'0');
seed+=`EXEC dbo.sp_DoiVoucher 'VCCN${s}','KH${s}','VC${s}','2026-10-10T08:00:00';\n`;
}
seed+=`INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES
('HD01','2026-10-11T08:15:00','CN01','PT01','KH01','VCCN01'),
('HD02','2026-10-12T13:20:00','CN04','PT02','KH02','VCCN02'),
('HD03','2026-10-13T18:00:00','CN05','PT01','KH03','VCCN03'),
('HD04','2026-10-14T09:10:00','CN02','PT05','KH04',NULL),
('HD05','2026-10-15T19:30:00','CN03','PT03','KH05',NULL),
('HD06','2026-10-20T10:00:00','CN01','PT01','KH04',NULL),
('HD07','2026-10-20T11:00:00','CN02','PT02','KH05',NULL);
INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong,Ghi_chu) VALUES
('HD01',1,'SP03','M',N'Đá',1,N'Ít ngọt, thêm củ năng'),
('HD01',2,'SP06',NULL,NULL,1,NULL),
('HD02',1,'SP04','L',N'Đá',1,N'Hạt sen và thạch đào'),
('HD02',2,'SP01','M',N'Đá',1,NULL),
('HD03',1,'SP05','M',N'Đá',2,N'Kem sữa và sữa đặc'),
('HD04',1,'SP02','S',N'Nóng',2,NULL),
('HD05',1,'SP03','S',N'Đá',1,NULL),
('HD05',2,'SP09',NULL,NULL,1,NULL),
('HD06',1,'SP01','S',N'Đá',2,NULL),
('HD07',1,'SP08',NULL,NULL,1,NULL);
INSERT dbo.CHON_TOPPING(Ma_HD,Ma_chi_tiet,Ma_topping,Don_gia,So_luong) VALUES
('HD01',1,'TP01',9000,1),('HD02',1,'TP02',15000,1),('HD02',1,'TP05',10000,1),
('HD03',1,'TP04',9000,1),('HD03',1,'TP03',5000,1),('HD05',1,'TP05',10000,1);
UPDATE dbo.HOA_DON SET Trang_thai='HOAN_TAT' WHERE Ma_HD IN('HD01','HD02','HD03','HD04','HD05');
-- A product without invoice references demonstrates a successful physical DELETE.
EXEC dbo.sp_InsertSanPham 'SP11',N'Trà Quả Mọng Anh Đào','MON_NUOC',N'Món mới cho thực đơn mùa thu',N'Đang bán',N'["DM02","DM05"]',N'[{"Ma_size":"S","Gia_ban":49000},{"Ma_size":"M","Gia_ban":59000}]',NULL;
COMMIT;
GO
`;
fs.writeFileSync('database/05-seed.sql',seed);
