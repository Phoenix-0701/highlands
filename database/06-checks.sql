USE HighlandsCoffeeDB;
GO
SET NOCOUNT ON;
-- Read-only invariants plus transactional regression cases. Every demo write is rolled back.
SELECT t.name Bang,SUM(p.rows) So_hang INTO #Counts
FROM sys.tables t JOIN sys.partitions p ON t.object_id=p.object_id AND p.index_id IN(0,1)
WHERE t.schema_id=SCHEMA_ID('dbo') GROUP BY t.name;
SELECT * FROM #Counts ORDER BY Bang;
IF (SELECT COUNT(*) FROM #Counts)<>18 THROW 52001,N'Không đủ 18 bảng dbo.',1;
IF EXISTS(SELECT 1 FROM #Counts WHERE So_hang<5) THROW 52002,N'Có bảng chưa đủ 5 hàng dữ liệu.',1;
DROP TABLE #Counts;
IF EXISTS(SELECT 1 FROM dbo.SAN_PHAM s WHERE
  (s.Loai_SP='MON_NUOC' AND (NOT EXISTS(SELECT 1 FROM dbo.MON_NUOC m WHERE m.Ma_SP=s.Ma_SP) OR NOT EXISTS(SELECT 1 FROM dbo.CHON_SIZE z WHERE z.Ma_SP=s.Ma_SP)))
  OR (s.Loai_SP='BANH_NGOT' AND NOT EXISTS(SELECT 1 FROM dbo.BANH_NGOT b WHERE b.Ma_SP=s.Ma_SP))
  OR NOT EXISTS(SELECT 1 FROM dbo.SAN_PHAM_THUOC_DANH_MUC m WHERE m.Ma_SP=s.Ma_SP))
 THROW 52003,N'Vi phạm toàn phần lớp con, bảng giá hoặc danh mục.',1;
IF EXISTS(SELECT 1 FROM dbo.CHI_TIET_HOA_DON c
 OUTER APPLY(SELECT SUM(t.Don_gia*t.So_luong) Tong FROM dbo.CHON_TOPPING t WHERE t.Ma_HD=c.Ma_HD AND t.Ma_chi_tiet=c.Ma_chi_tiet) x
 WHERE c.Thanh_tien<>(c.Don_gia+COALESCE(x.Tong,0))*c.So_luong)
 THROW 52004,N'Sai thành tiền chi tiết.',1;
IF EXISTS(SELECT 1 FROM dbo.HOA_DON h OUTER APPLY(SELECT SUM(c.Thanh_tien) Tong FROM dbo.CHI_TIET_HOA_DON c WHERE c.Ma_HD=h.Ma_HD) x
 WHERE h.Tong_tien<>COALESCE(x.Tong,0) OR h.Thanh_tien<>h.Tong_tien-h.So_tien_giam OR h.Diem_tich_luy_nhan<>CASE WHEN h.Trang_thai='HOAN_TAT' THEN FLOOR(h.Thanh_tien/10000) ELSE 0 END)
 THROW 52005,N'Sai tiền hoặc điểm của hóa đơn.',1;
IF EXISTS(SELECT 1 FROM dbo.KHACH_HANG k OUTER APPLY(SELECT SUM(l.Diem_thay_doi) Diem FROM dbo.LICH_SU_DIEM l WHERE l.Ma_KH=k.Ma_KH) x
 WHERE k.Diem_tich_luy<>COALESCE(x.Diem,0)) THROW 52006,N'Số dư điểm không khớp lịch sử.',1;
IF EXISTS(SELECT 1 FROM dbo.VOUCHER_CA_NHAN c JOIN dbo.VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher
 WHERE c.HSD<>DATEADD(DAY,v.Tgian_hieu_luc,c.Ngay_doi) OR NOT EXISTS(SELECT 1 FROM dbo.LICH_SU_DIEM l WHERE l.Ma_VCCN=c.Ma_VCCN AND l.Diem_thay_doi=-v.Diem_doi))
 THROW 52007,N'Sai hạn dùng hoặc thiếu lịch sử đổi voucher.',1;
SELECT N'PASS: 18 bảng, đủ dữ liệu, tổng tiền, toàn phần, lịch sử điểm và HSD' Ket_qua;
GO
-- CRUD, multi-category and multi-size price update; transaction is rolled back.
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC dbo.sp_InsertSanPham 'SP99998',N'Sản phẩm kiểm tra 99998','MON_NUOC',NULL,N'Đang bán',N'["DM01","DM05"]',N'[{"Ma_size":"S","Gia_ban":29000},{"Ma_size":"M","Gia_ban":39000}]',NULL;
 IF (SELECT COUNT(*) FROM dbo.CHON_SIZE WHERE Ma_SP='SP99998')<>2 THROW 52010,N'Không tạo đủ kích thước.',1;
 EXEC dbo.sp_UpdateSanPham 'SP99998',N'Sản phẩm kiểm tra 99998 đã sửa','MON_NUOC',NULL,N'Hết hàng',N'["DM02"]',N'[{"Ma_size":"S","Gia_ban":31000}]',NULL;
 IF NOT EXISTS(SELECT 1 FROM dbo.CHON_SIZE WHERE Ma_SP='SP99998' AND Ma_size='S' AND Gia_ban=31000) THROW 52011,N'Sửa giá thất bại.',1;
 EXEC dbo.sp_DeleteSanPham 'SP99998';
 IF EXISTS(SELECT 1 FROM dbo.SAN_PHAM WHERE Ma_SP='SP99998') THROW 52012,N'Xóa thất bại.',1;
 ROLLBACK;
 SELECT N'PASS: thêm/sửa/xóa, đa danh mục và đa kích thước' Ket_qua;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC dbo.sp_DeleteSanPham 'SP03';
 THROW 52013,N'Đáng lẽ phải chặn xóa sản phẩm đã bán.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>51021 THROW;
 SELECT N'PASS: chặn xóa sản phẩm có hóa đơn' Ket_qua;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT dbo.MON_NUOC(Ma_SP) VALUES('SP06');
 THROW 52014,N'Đáng lẽ phải chặn chồng lấp lớp con.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>547 THROW;
 SELECT N'PASS: CHECK + FK phức hợp bảo vệ lớp con rời nhau' Ket_qua;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('TEST_CAKE','2026-10-20T08:00:00','CN01','PT01','KH01');
 INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,So_luong) VALUES('TEST_CAKE',1,'SP06',1);
 INSERT dbo.CHON_TOPPING(Ma_HD,Ma_chi_tiet,Ma_topping,Don_gia,So_luong) VALUES('TEST_CAKE',1,'TP01',9000,1);
 THROW 52015,N'Đáng lẽ phải chặn topping cho bánh.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>51124 THROW;
 SELECT N'PASS: chặn topping cho bánh ngọt' Ket_qua;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 UPDATE dbo.CHI_TIET_HOA_DON SET So_luong=So_luong+1 WHERE Ma_HD='HD01';
 THROW 52016,N'Đáng lẽ phải chặn sửa đơn hoàn tất.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>51120 THROW;
 SELECT N'PASS: khóa chi tiết đơn hoàn tất' Ket_qua;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT dbo.VOUCHER VALUES('TEST_EXPENSIVE',N'Voucher thử thiếu điểm',2147483647,10,10000,0,30);
 EXEC dbo.sp_DoiVoucher 'TEST_NO_POINTS','KH01','TEST_EXPENSIVE','2026-10-19T08:00:00';
 THROW 52017,N'Đáng lẽ phải từ chối khi thiếu điểm.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>51108 THROW;
 IF EXISTS(SELECT 1 FROM dbo.VOUCHER_CA_NHAN WHERE Ma_VCCN='TEST_NO_POINTS') THROW 52018,N'Voucher bị ghi một phần dù thiếu điểm.',1;
 SELECT N'PASS: thiếu điểm rollback cả voucher và lịch sử' Ket_qua;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC dbo.sp_DoiVoucher 'TEST_REUSE','KH04','VC01','2026-10-19T08:00:00';
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES('TEST_CANCEL','2026-10-20T08:00:00','CN01','PT01','KH04','TEST_REUSE');
 EXEC dbo.sp_ChuyenTrangThaiHoaDon 'TEST_CANCEL','DA_HUY';
 IF EXISTS(SELECT 1 FROM dbo.HOA_DON WHERE Ma_HD='TEST_CANCEL' AND Ma_VCCN IS NOT NULL) THROW 52019,N'Đơn hủy chưa giải phóng mã voucher.',1;
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES('TEST_REUSE_HD','2026-10-21T08:00:00','CN01','PT01','KH04','TEST_REUSE');
 INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('TEST_REUSE_HD',1,'SP01','M',N'Đá',2);
 EXEC dbo.sp_ChuyenTrangThaiHoaDon 'TEST_REUSE_HD','HOAN_TAT';
 IF NOT EXISTS(SELECT 1 FROM dbo.VOUCHER_CA_NHAN WHERE Ma_VCCN='TEST_REUSE' AND Trang_thai='DA_SU_DUNG') THROW 52020,N'Voucher chưa chuyển đã dùng.',1;
 IF (SELECT COUNT(*) FROM dbo.LICH_SU_DIEM WHERE Ma_HD='TEST_REUSE_HD')<>1 THROW 52021,N'Điểm hoàn tất phải ghi đúng một lần.',1;
 ROLLBACK;
 SELECT N'PASS: đổi voucher, hủy, tái sử dụng và cộng điểm đúng một lần' Ket_qua;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('TEST_PRICE','2026-10-20T08:00:00','CN01','PT01','KH01');
 INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('TEST_PRICE',1,'SP01','S',N'Đá',2);
 DECLARE @Gia_cu DECIMAL(12,2)=(SELECT Don_gia FROM dbo.CHI_TIET_HOA_DON WHERE Ma_HD='TEST_PRICE' AND Ma_chi_tiet=1);
 UPDATE dbo.CHON_SIZE SET Gia_ban=Gia_ban+1000 WHERE Ma_SP='SP01' AND Ma_size='S';
 UPDATE dbo.CHI_TIET_HOA_DON SET So_luong=3 WHERE Ma_HD='TEST_PRICE' AND Ma_chi_tiet=1;
 IF (SELECT Don_gia FROM dbo.CHI_TIET_HOA_DON WHERE Ma_HD='TEST_PRICE' AND Ma_chi_tiet=1)<>@Gia_cu THROW 52022,N'Giá thời điểm đã bị thay đổi.',1;
 INSERT dbo.CHON_TOPPING(Ma_HD,Ma_chi_tiet,Ma_topping,Don_gia,So_luong) VALUES('TEST_PRICE',1,'TP03',5000,2);
 IF (SELECT Thanh_tien FROM dbo.CHI_TIET_HOA_DON WHERE Ma_HD='TEST_PRICE' AND Ma_chi_tiet=1)<>(@Gia_cu+10000)*3 THROW 52023,N'Sai dây chuyền topping -> chi tiết.',1;
 IF (SELECT Tong_tien FROM dbo.HOA_DON WHERE Ma_HD='TEST_PRICE')<>(@Gia_cu+10000)*3 THROW 52024,N'Sai dây chuyền chi tiết -> hóa đơn.',1;
 DELETE dbo.CHON_TOPPING WHERE Ma_HD='TEST_PRICE';
 IF (SELECT Tong_tien FROM dbo.HOA_DON WHERE Ma_HD='TEST_PRICE')<>@Gia_cu*3 THROW 52025,N'Xóa topping chưa tính lại tổng.',1;
 ROLLBACK;
 SELECT N'PASS: snapshot giá và dây chuyền INSERT/UPDATE/DELETE topping' Ket_qua;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC dbo.sp_DoiVoucher 'TEST_BOUNDARY','KH04','VC01','2026-10-19T08:00:00';
 DECLARE @HSD DATETIME=(SELECT HSD FROM dbo.VOUCHER_CA_NHAN WHERE Ma_VCCN='TEST_BOUNDARY');
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES('TEST_BOUNDARY_HD',@HSD,'CN01','PT01','KH04','TEST_BOUNDARY');
 ROLLBACK;
 SELECT N'PASS: thời điểm đúng HSD được chấp nhận (BTL1 dùng <=)' Ket_qua;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC dbo.sp_DoiVoucher 'TEST_EXPIRED','KH04','VC01','2026-10-19T08:00:00';
 DECLARE @SauHSD DATETIME=DATEADD(SECOND,1,(SELECT HSD FROM dbo.VOUCHER_CA_NHAN WHERE Ma_VCCN='TEST_EXPIRED'));
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES('TEST_EXPIRED_HD',@SauHSD,'CN01','PT01','KH04','TEST_EXPIRED');
 THROW 52026,N'Đáng lẽ phải chặn voucher hết hạn.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>51115 THROW;
 SELECT N'PASS: quá HSD bị từ chối' Ket_qua;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC dbo.sp_InsertSanPham 'SP99997',N'Bánh thử giá 5000','BANH_NGOT',NULL,N'Đang bán',N'["DM04"]',N'[]',5000;
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES('TEST_SMALL','2026-10-22T08:00:00','CN01','PT01','KH01');
 INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,So_luong) VALUES('TEST_SMALL',1,'SP99997',1);
 EXEC dbo.sp_ChuyenTrangThaiHoaDon 'TEST_SMALL','HOAN_TAT';
 IF EXISTS(SELECT 1 FROM dbo.LICH_SU_DIEM WHERE Ma_HD='TEST_SMALL') THROW 52027,N'Đơn dưới 10000 không được sinh lịch sử điểm.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.HOA_DON WHERE Ma_HD='TEST_SMALL' AND Diem_tich_luy_nhan=0 AND Thanh_tien=5000) THROW 52028,N'Sai điểm hoặc tiền đơn nhỏ.',1;
 ROLLBACK;
 SELECT N'PASS: đơn dưới 10000 không tích điểm' Ket_qua;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH) VALUES
 ('TEST_STREAK1','2026-10-20T08:00:00','CN01','PT01','KH01'),
 ('TEST_STREAK2','2026-10-21T08:00:00','CN01','PT01','KH01'),
 ('TEST_STREAK3','2026-10-22T08:00:00','CN01','PT01','KH01');
 INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES
 ('TEST_STREAK1',1,'SP05','M',N'Đá',1),('TEST_STREAK2',1,'SP05','M',N'Đá',1),('TEST_STREAK3',1,'SP05','M',N'Đá',1);
 UPDATE dbo.HOA_DON SET Trang_thai='HOAN_TAT' WHERE Ma_HD IN('TEST_STREAK1','TEST_STREAK2','TEST_STREAK3');
 DECLARE @Result NVARCHAR(500)=dbo.fn_TinhDiemThuongChuoiLua('KH01','2026-10-20','2026-10-22');
 IF @Result NOT LIKE N'%3 ngày liên tiếp%' OR @Result NOT LIKE N'%+14 Drips%' THROW 52029,N'Sai kết quả cursor chuỗi lửa.',1;
 IF (SELECT COUNT(*) FROM dbo.LICH_SU_DIEM WHERE Ma_HD IN('TEST_STREAK1','TEST_STREAK2','TEST_STREAK3'))<>3 THROW 52030,N'Trigger chưa xử lý đầy đủ nhiều hóa đơn.',1;
 ROLLBACK;
 SELECT N'PASS: DML nhiều dòng và cursor chuỗi lửa 3 ngày = 2+4+8 điểm' Ket_qua;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 -- VC04 requires 150000; this 29000 invoice must not consume the voucher.
 INSERT dbo.HOA_DON(Ma_HD,Ngay_tao,Ma_CN,Ma_PT,Ma_KH,Ma_VCCN) VALUES('TEST_MINIMUM','2026-10-20T08:00:00','CN01','PT01','KH04','VCCN04');
 INSERT dbo.CHI_TIET_HOA_DON(Ma_HD,Ma_chi_tiet,Ma_SP,Ma_size,Dang_mon,So_luong) VALUES('TEST_MINIMUM',1,'SP01','S',N'Đá',1);
 EXEC dbo.sp_ChuyenTrangThaiHoaDon 'TEST_MINIMUM','HOAN_TAT';
 THROW 52031,N'Đơn chưa đủ giá trị tối thiểu đã sử dụng được voucher.',1;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 IF ERROR_NUMBER()<>51116 THROW;
 SELECT N'PASS: không tiêu thụ voucher khi đơn chưa đủ giá trị tối thiểu' Ket_qua;
END CATCH;
GO
EXEC dbo.sp_TimKiemSanPham_Menu @Ma_danh_muc='DM01',@Gia_tu=20000,@Gia_den=50000,@Sap_xep_theo='GIA_ASC';
EXEC dbo.sp_ThongKeDoanhThuSanPham @Tu_ngay='2026-10-01',@Den_ngay='2026-10-31',@So_luong_ban_toi_thieu=1;
SELECT dbo.fn_TinhDiemThuongChuoiLua('KH01','2026-10-01','2026-10-31') Chuoi_lua,
 dbo.fn_PhanTichGiaTriUuDaiChiNhanh('CN01',10,2026) Uu_dai;
SELECT N'ALL CHECKS PASSED' Ket_qua;
GO
