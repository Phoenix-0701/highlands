USE HighlandsCoffeeDB;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
-- 1. DANH_MUC (5 hàng)
INSERT INTO DANH_MUC VALUES
('DM01', N'Cà Phê Phin', N'Cà phê rang xay truyền thống đậm đà hương vị Việt'),
('DM02', N'Trà Trái Cây & Sen', N'Trà thảo mộc kết hợp trái cây tươi và hạt sen'),
('DM03', N'Freeze Đá Xay', N'Thức uống đá xay mát lạnh kết hợp thạch và kem whipping'),
('DM04', N'Bánh Ngọt & Bánh Mì', N'Các loại bánh mì que và bánh kem dùng kèm đồ uống'),
('DM05', N'Món Nổi Bật', N'Danh mục các sản phẩm bán chạy nhất tại Highlands Coffee');

-- 2. KICH_THUOC (5 hàng)
INSERT INTO KICH_THUOC VALUES
('XS', N'Cỡ Rất Nhỏ (Extra Small)'),
('S',  N'Cỡ Nhỏ (Small - 12oz)'),
('M',  N'Cỡ Vừa (Medium - 16oz)'),
('L',  N'Cỡ Lớn (Large - 20oz)'),
('XL', N'Cỡ Đại (Extra Large - 24oz)');

-- 3. SAN_PHAM (10 hàng: 5 Món nước + 5 Bánh ngọt)
INSERT INTO SAN_PHAM VALUES
('SP01', N'Phin Sữa Đá', 'MON_NUOC', N'Cà phê Phin truyền thống kết hợp sữa đặc', N'Đang bán'),
('SP02', N'Bạc Xỉu', 'MON_NUOC', N'Nhiều sữa ít cà phê, vị ngọt béo dễ uống', N'Đang bán'),
('SP03', N'Trà Sen Vàng (Củ Năng)', 'MON_NUOC', N'Trà Ô long kết hợp hương sen, củ năng và kem sữa', N'Đang bán'),
('SP04', N'Trà Thạch Đào', 'MON_NUOC', N'Trà đào thanh mát kèm miếng đào và thạch đào', N'Đang bán'),
('SP05', N'Freeze Trà Xanh', 'MON_NUOC', N'Đá xay trà xanh matcha đậm vị kèm thạch', N'Đang bán'),
('SP06', N'Bánh Mì Que Pate', 'BANH_NGOT', N'Bánh mì que giòn rụm nhân pate truyền thống', N'Đang bán'),
('SP07', N'Bánh Mì Que Gà Phô Mai', 'BANH_NGOT', N'Bánh mì que nhân gà xé sốt phô mai béo ngậy', N'Đang bán'),
('SP08', N'Bánh Croissant 55gr', 'BANH_NGOT', N'Bánh sừng bò ngàn lớp thơm bơ Pháp', N'Đang bán'),
('SP09', N'Bánh Mousse Cacao', 'BANH_NGOT', N'Bánh mousse sô cô la mềm mịn đậm đà', N'Đang bán'),
('SP10', N'Bánh Phô Mai Chanh Dây', 'BANH_NGOT', N'Bánh cheesecake vị chanh dây chua ngọt', N'Đang bán');

-- 4. SAN_PHAM_THUOC_DANH_MUC (13 hàng)
INSERT INTO SAN_PHAM_THUOC_DANH_MUC VALUES
('SP01', 'DM01'), ('SP01', 'DM05'),
('SP02', 'DM01'),
('SP03', 'DM02'), ('SP03', 'DM05'),
('SP04', 'DM02'),
('SP05', 'DM03'), ('SP05', 'DM05'),
('SP06', 'DM04'), ('SP07', 'DM04'), ('SP08', 'DM04'), ('SP09', 'DM04'), ('SP10', 'DM04');

-- 5. BANH_NGOT (5 hàng)
INSERT INTO BANH_NGOT(Ma_SP,Don_gia) VALUES
('SP06', 19000), ('SP07', 19000), ('SP08', 29000), ('SP09', 35000), ('SP10', 35000);

-- 6. MON_NUOC (5 hàng)
INSERT INTO MON_NUOC(Ma_SP) VALUES ('SP01'), ('SP02'), ('SP03'), ('SP04'), ('SP05');

-- 7. CHON_SIZE (15 hàng)
INSERT INTO CHON_SIZE VALUES
('SP01', 'S', 29000), ('SP01', 'M', 39000), ('SP01', 'L', 45000),
('SP02', 'S', 29000), ('SP02', 'M', 39000), ('SP02', 'L', 45000),
('SP03', 'S', 45000), ('SP03', 'M', 55000), ('SP03', 'L', 65000),
('SP04', 'S', 45000), ('SP04', 'M', 55000), ('SP04', 'L', 65000),
('SP05', 'S', 55000), ('SP05', 'M', 65000), ('SP05', 'L', 69000);

-- 8. TOPPING (5 hàng)
INSERT INTO TOPPING VALUES
('TP01', N'Củ Năng', 9000),
('TP02', N'Hạt Sen', 15000),
('TP03', N'Sữa Đặc', 5000),
('TP04', N'Kem Sữa Macchiato', 9000),
('TP05', N'Thạch Đào', 10000);

-- 9. CHI_NHANH (5 hàng)
INSERT INTO CHI_NHANH VALUES
('CN01', N'HC - Lý Thường Kiệt Hóc Môn', N'27/5A Lý Thường Kiệt, TT. Hóc Môn, TP.HCM', N'Mở cửa'),
('CN02', N'HC - Lê Thị Hà Hóc Môn', N'1/71 Ấp Đình, Xã Tân Xuân, Hóc Môn, TP.HCM', N'Mở cửa'),
('CN03', N'HC - Đặng Thúc Vịnh HCMC', N'84/1 Đặng Thúc Vịnh, Thới Tam Thôn, Hóc Môn, TP.HCM', N'Mở cửa'),
('CN04', N'HC - Đại học Bách Khoa Q10', N'268 Lý Thường Kiệt, Phường 14, Quận 10, TP.HCM', N'Mở cửa'),
('CN05', N'HC - Vincom Đồng Khởi Q1', N'72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP.HCM', N'Mở cửa');

-- 10. SDT_CN (6 hàng)
INSERT INTO SDT_CN VALUES
('CN01', '02838911234'), ('CN01', '0901234561'),
('CN02', '02838912345'), ('CN03', '02838913456'),
('CN04', '02838654321'), ('CN05', '02838229999');

-- 11. PTTT (5 hàng)
INSERT INTO PTTT VALUES
('PT01', N'Ví điện tử MoMo'),
('PT02', N'Thẻ Trả Trước Highlands'),
('PT03', N'Thẻ Quốc Tế (Visa/Mastercard/JCB)'),
('PT04', N'Thẻ Nội Địa (NAPAS)'),
('PT05', N'Chuyển Khoản Ngân Hàng (VietQR)');

-- 12. KHACH_HANG (5 hàng)
INSERT INTO KHACH_HANG VALUES
('KH01', N'Phạm Nguyễn Đức', N'Thành', '0912345671', 'thanh.pham@hcmut.edu.vn', '2026-01-10 08:00:00', 0, 'GOLD'),
('KH02', N'Nguyễn Quốc', N'Hưng', '0912345672', 'hung.nguyen@hcmut.edu.vn', '2026-02-15 09:30:00', 0, 'SILVER'),
('KH03', N'Nguyễn Đăng', N'Khoa', '0912345673', 'khoa.nguyen@hcmut.edu.vn', '2026-03-20 14:15:00', 0, 'DIAMOND'),
('KH04', N'Phạm Nguyễn Thế', N'Anh', '0912345674', 'anh.pham@hcmut.edu.vn', '2026-04-05 16:45:00', 0, 'MEMBER'),
('KH05', N'Bùi Ngọc', N'Sơn', '0912345675', 'son.bui@hcmut.edu.vn', '2026-05-12 19:00:00', 0, 'SILVER');

-- 13. VOUCHER (5 hàng)
INSERT INTO VOUCHER VALUES
('VC01', N'Giảm 20% Tối đa 10K', 65, 20.00, 10000, 45000, 30),
('VC02', N'Giảm 10% Tối đa 50K', 90, 10.00, 50000, 100000, 30),
('VC03', N'Ưu đãi 25% Tối đa 30K cho đơn từ 120K', 120, 25.00, 30000, 120000, 15),
('VC04', N'Đặc quyền Gold giảm 30% tối đa 39K', 145, 30.00, 39000, 150000, 15),
('VC05', N'Siêu Deal giảm 50% tối đa 50K', 200, 50.00, 50000, 160000, 7);


INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('BD01','2026-09-25T09:00:00','CN01','PT01','KH01');
INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('BD01',1,'SP05','M',N'Đá',50);
EXEC dbo.sp_ChuyenTrangThaiHoaDon 'BD01','HOAN_TAT';
INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('BD02','2026-09-26T09:00:00','CN02','PT02','KH02');
INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('BD02',1,'SP05','M',N'Đá',50);
EXEC dbo.sp_ChuyenTrangThaiHoaDon 'BD02','HOAN_TAT';
INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('BD03','2026-09-27T09:00:00','CN03','PT03','KH03');
INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('BD03',1,'SP05','M',N'Đá',50);
EXEC dbo.sp_ChuyenTrangThaiHoaDon 'BD03','HOAN_TAT';
INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('BD04','2026-09-28T09:00:00','CN04','PT04','KH04');
INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('BD04',1,'SP05','M',N'Đá',50);
EXEC dbo.sp_ChuyenTrangThaiHoaDon 'BD04','HOAN_TAT';
INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('BD05','2026-09-29T09:00:00','CN05','PT05','KH05');
INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('BD05',1,'SP05','M',N'Đá',50);
EXEC dbo.sp_ChuyenTrangThaiHoaDon 'BD05','HOAN_TAT';
EXEC dbo.sp_DoiVoucher 'VCCN01','KH01','VC01','2026-10-10T08:00:00';
EXEC dbo.sp_DoiVoucher 'VCCN02','KH02','VC02','2026-10-10T08:00:00';
EXEC dbo.sp_DoiVoucher 'VCCN03','KH03','VC03','2026-10-10T08:00:00';
EXEC dbo.sp_DoiVoucher 'VCCN04','KH04','VC04','2026-10-10T08:00:00';
EXEC dbo.sp_DoiVoucher 'VCCN05','KH05','VC05','2026-10-10T08:00:00';
INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES
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
