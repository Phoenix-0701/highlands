USE HighlandsCoffeeDB;
GO
-- Internal validator shared by the two write procedures. JSON preserves M:N categories and all sizes.
CREATE OR ALTER PROCEDURE dbo.sp_ValidateSanPham
 @Ma_SP VARCHAR(20), @Ten_SP NVARCHAR(150), @Loai_SP VARCHAR(20),
 @Trang_thai NVARCHAR(50), @Danh_muc NVARCHAR(MAX), @Bang_gia NVARCHAR(MAX),
 @Don_gia DECIMAL(12,2) = NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Ma_SP IS NULL OR @Ma_SP NOT LIKE 'SP[0-9][0-9]%' OR SUBSTRING(@Ma_SP,3,20) LIKE '%[^0-9]%'
  THROW 51001,N'Mã sản phẩm phải là SP và ít nhất hai chữ số, ví dụ SP11.',1;
 IF @Ten_SP IS NULL OR LEN(TRIM(@Ten_SP)) < 3
  THROW 51002,N'Tên sản phẩm phải có ít nhất 3 ký tự.',1;
 IF @Loai_SP IS NULL OR @Loai_SP NOT IN ('MON_NUOC','BANH_NGOT')
  THROW 51003,N'Loại sản phẩm phải là MON_NUOC hoặc BANH_NGOT.',1;
 IF @Trang_thai IS NULL OR @Trang_thai NOT IN (N'Đang bán',N'Hết hàng',N'Ngừng kinh doanh')
  THROW 51004,N'Trạng thái bán không hợp lệ.',1;
 IF EXISTS(SELECT 1 FROM dbo.SAN_PHAM WHERE Ten_SP=TRIM(@Ten_SP) AND Ma_SP<>@Ma_SP)
  THROW 51005,N'Tên sản phẩm đã được dùng bởi một sản phẩm khác.',1;
 IF ISJSON(@Danh_muc)<>1 OR LEFT(LTRIM(@Danh_muc),1)<>'[' OR @Danh_muc IS NULL
  THROW 51006,N'Danh mục phải là một mảng JSON.',1;
 IF NOT EXISTS(SELECT 1 FROM OPENJSON(@Danh_muc))
  THROW 51007,N'Sản phẩm phải thuộc ít nhất một danh mục.',1;
 IF EXISTS(SELECT 1 FROM OPENJSON(@Danh_muc) j LEFT JOIN dbo.DANH_MUC d ON j.value=d.Ma_danh_muc WHERE d.Ma_danh_muc IS NULL OR j.type<>1)
  THROW 51008,N'Có mã danh mục không tồn tại.',1;
 IF EXISTS(SELECT value FROM OPENJSON(@Danh_muc) GROUP BY value HAVING COUNT(*)>1)
  THROW 51009,N'Danh sách danh mục có mã bị lặp.',1;
 IF ISJSON(@Bang_gia)<>1 OR LEFT(LTRIM(@Bang_gia),1)<>'[' OR @Bang_gia IS NULL
  THROW 51010,N'Bảng giá phải là một mảng JSON.',1;
 IF @Loai_SP='BANH_NGOT'
 BEGIN
  IF @Don_gia IS NULL OR @Don_gia<5000 THROW 51011,N'Giá bánh phải từ 5.000 đồng.',1;
  IF EXISTS(SELECT 1 FROM OPENJSON(@Bang_gia)) THROW 51012,N'Bánh ngọt không được có kích thước.',1;
 END
 ELSE
 BEGIN
  IF @Don_gia IS NOT NULL THROW 51013,N'Món nước sử dụng giá theo kích thước.',1;
  IF NOT EXISTS(SELECT 1 FROM OPENJSON(@Bang_gia)) THROW 51014,N'Món nước phải có ít nhất một kích thước.',1;
  IF EXISTS(SELECT 1 FROM OPENJSON(@Bang_gia) WHERE type<>5)
   THROW 51015,N'Mỗi dòng bảng giá phải chứa Ma_size và Gia_ban.',1;
  IF EXISTS(SELECT 1 FROM OPENJSON(@Bang_gia) j LEFT JOIN dbo.KICH_THUOC s ON JSON_VALUE(j.value,'$.Ma_size')=s.Ma_size
    WHERE j.type<>5 OR s.Ma_size IS NULL OR TRY_CONVERT(DECIMAL(12,2),JSON_VALUE(j.value,'$.Gia_ban')) IS NULL
      OR TRY_CONVERT(DECIMAL(12,2),JSON_VALUE(j.value,'$.Gia_ban'))<5000)
   THROW 51015,N'Kích thước không tồn tại hoặc giá theo size nhỏ hơn 5.000 đồng.',1;
  IF EXISTS(SELECT JSON_VALUE(value,'$.Ma_size') FROM OPENJSON(@Bang_gia) GROUP BY JSON_VALUE(value,'$.Ma_size') HAVING COUNT(*)>1)
   THROW 51016,N'Mỗi kích thước chỉ được khai báo một mức giá.',1;
 END
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_InsertSanPham
 @Ma_SP VARCHAR(20), @Ten_SP NVARCHAR(150), @Loai_SP VARCHAR(20),
 @Mo_ta NVARCHAR(500)=NULL, @Trang_thai NVARCHAR(50)=N'Đang bán',
 @Danh_muc NVARCHAR(MAX), @Bang_gia NVARCHAR(MAX)=N'[]', @Don_gia DECIMAL(12,2)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF EXISTS(SELECT 1 FROM dbo.SAN_PHAM WITH(UPDLOCK,HOLDLOCK) WHERE Ma_SP=@Ma_SP)
   THROW 51017,N'Mã sản phẩm đã tồn tại.',1;
  EXEC dbo.sp_ValidateSanPham @Ma_SP,@Ten_SP,@Loai_SP,@Trang_thai,@Danh_muc,@Bang_gia,@Don_gia;
  INSERT dbo.SAN_PHAM(Ma_SP,Ten_SP,Loai_SP,Mo_ta,Trang_thai) VALUES(@Ma_SP,TRIM(@Ten_SP),@Loai_SP,@Mo_ta,@Trang_thai);
  INSERT dbo.SAN_PHAM_THUOC_DANH_MUC SELECT @Ma_SP,value FROM OPENJSON(@Danh_muc);
  IF @Loai_SP='BANH_NGOT'
   INSERT dbo.BANH_NGOT(Ma_SP,Don_gia) VALUES(@Ma_SP,@Don_gia);
  ELSE
  BEGIN
   INSERT dbo.MON_NUOC(Ma_SP) VALUES(@Ma_SP);
   INSERT dbo.CHON_SIZE(Ma_SP,Ma_size,Gia_ban)
    SELECT @Ma_SP,Ma_size,Gia_ban FROM OPENJSON(@Bang_gia) WITH(Ma_size VARCHAR(10),Gia_ban DECIMAL(12,2));
  END
  COMMIT;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_UpdateSanPham
 @Ma_SP VARCHAR(20), @Ten_SP NVARCHAR(150), @Loai_SP VARCHAR(20),
 @Mo_ta NVARCHAR(500)=NULL, @Trang_thai NVARCHAR(50), @Danh_muc NVARCHAR(MAX),
 @Bang_gia NVARCHAR(MAX)=N'[]', @Don_gia DECIMAL(12,2)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @Loai_cu VARCHAR(20);
  SELECT @Loai_cu=Loai_SP FROM dbo.SAN_PHAM WITH(UPDLOCK,HOLDLOCK) WHERE Ma_SP=@Ma_SP;
  IF @Loai_cu IS NULL THROW 51018,N'Không tìm thấy sản phẩm cần cập nhật.',1;
  IF @Loai_cu<>@Loai_SP THROW 51019,N'Không được đổi loại sản phẩm. Hãy tạo một mã sản phẩm mới.',1;
  EXEC dbo.sp_ValidateSanPham @Ma_SP,@Ten_SP,@Loai_SP,@Trang_thai,@Danh_muc,@Bang_gia,@Don_gia;
  IF EXISTS(SELECT 1 FROM dbo.CHI_TIET_HOA_DON c WHERE c.Ma_SP=@Ma_SP AND c.Ma_size IS NOT NULL
     AND NOT EXISTS(SELECT 1 FROM OPENJSON(@Bang_gia) WITH(Ma_size VARCHAR(10)) j WHERE j.Ma_size=c.Ma_size))
   THROW 51020,N'Không thể bỏ kích thước đã được dùng trong hóa đơn. Hãy giữ kích thước và cập nhật giá.',1;
  UPDATE dbo.SAN_PHAM SET Ten_SP=TRIM(@Ten_SP),Mo_ta=@Mo_ta,Trang_thai=@Trang_thai WHERE Ma_SP=@Ma_SP;
  DELETE dbo.SAN_PHAM_THUOC_DANH_MUC WHERE Ma_SP=@Ma_SP;
  INSERT dbo.SAN_PHAM_THUOC_DANH_MUC SELECT @Ma_SP,value FROM OPENJSON(@Danh_muc);
  IF @Loai_SP='BANH_NGOT' UPDATE dbo.BANH_NGOT SET Don_gia=@Don_gia WHERE Ma_SP=@Ma_SP;
  ELSE
  BEGIN
   DELETE dbo.CHON_SIZE WHERE Ma_SP=@Ma_SP AND Ma_size NOT IN(SELECT Ma_size FROM OPENJSON(@Bang_gia) WITH(Ma_size VARCHAR(10)));
   UPDATE s SET Gia_ban=j.Gia_ban FROM dbo.CHON_SIZE s JOIN OPENJSON(@Bang_gia) WITH(Ma_size VARCHAR(10),Gia_ban DECIMAL(12,2)) j ON s.Ma_size=j.Ma_size WHERE s.Ma_SP=@Ma_SP;
   INSERT dbo.CHON_SIZE(Ma_SP,Ma_size,Gia_ban)
    SELECT @Ma_SP,j.Ma_size,j.Gia_ban FROM OPENJSON(@Bang_gia) WITH(Ma_size VARCHAR(10),Gia_ban DECIMAL(12,2)) j
    WHERE NOT EXISTS(SELECT 1 FROM dbo.CHON_SIZE WHERE Ma_SP=@Ma_SP AND Ma_size=j.Ma_size);
  END
  COMMIT;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_DeleteSanPham @Ma_SP VARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SAN_PHAM WITH(UPDLOCK,HOLDLOCK) WHERE Ma_SP=@Ma_SP)
   THROW 51018,N'Không tìm thấy sản phẩm cần xóa.',1;
  DECLARE @So_don INT=(SELECT COUNT(DISTINCT Ma_HD) FROM dbo.CHI_TIET_HOA_DON WHERE Ma_SP=@Ma_SP);
  IF @So_don>0
  BEGIN
   DECLARE @Loi NVARCHAR(500)=N'Sản phẩm đã xuất hiện trong '+CONVERT(NVARCHAR(20),@So_don)+N' hóa đơn. Hãy chuyển trạng thái sang Ngừng kinh doanh để giữ lịch sử giao dịch.';
   THROW 51021,@Loi,1;
  END
  DELETE dbo.SAN_PHAM WHERE Ma_SP=@Ma_SP;
  COMMIT;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
-- SELECT-only procedure: one row per product, EXISTS avoids category x size duplication.
CREATE OR ALTER PROCEDURE dbo.sp_TimKiemSanPham_Menu
 @Tu_khoa NVARCHAR(150)=NULL, @Ma_danh_muc VARCHAR(20)=NULL,
 @Loai_SP VARCHAR(20)=NULL, @Trang_thai NVARCHAR(50)=NULL,
 @Gia_tu DECIMAL(12,2)=NULL, @Gia_den DECIMAL(12,2)=NULL, @Sap_xep_theo VARCHAR(20)='TEN_ASC'
AS
BEGIN
 SET NOCOUNT ON;
 SELECT sp.Ma_SP,sp.Ten_SP,sp.Loai_SP,sp.Mo_ta,sp.Trang_thai,
   Gia_tu=COALESCE(bn.Don_gia,p.Gia_tu),Gia_den=COALESCE(bn.Don_gia,p.Gia_den),bn.Don_gia,
   Danh_muc=JSON_QUERY((SELECT d.Ma_danh_muc,d.Ten_danh_muc FROM dbo.DANH_MUC d JOIN dbo.SAN_PHAM_THUOC_DANH_MUC m ON d.Ma_danh_muc=m.Ma_danh_muc WHERE m.Ma_SP=sp.Ma_SP ORDER BY d.Ma_danh_muc FOR JSON PATH)),
   Bang_gia=JSON_QUERY((SELECT s.Ma_size,s.Gia_ban FROM dbo.CHON_SIZE s WHERE s.Ma_SP=sp.Ma_SP ORDER BY s.Gia_ban,s.Ma_size FOR JSON PATH)),
   So_hoa_don=(SELECT COUNT(DISTINCT Ma_HD) FROM dbo.CHI_TIET_HOA_DON c WHERE c.Ma_SP=sp.Ma_SP)
 FROM dbo.SAN_PHAM sp LEFT JOIN dbo.BANH_NGOT bn ON sp.Ma_SP=bn.Ma_SP
 OUTER APPLY(SELECT MIN(Gia_ban) Gia_tu,MAX(Gia_ban) Gia_den FROM dbo.CHON_SIZE WHERE Ma_SP=sp.Ma_SP) p
 WHERE (@Tu_khoa IS NULL OR sp.Ten_SP LIKE N'%'+@Tu_khoa+N'%' OR sp.Ma_SP LIKE N'%'+@Tu_khoa+N'%')
   AND (@Ma_danh_muc IS NULL OR EXISTS(SELECT 1 FROM dbo.SAN_PHAM_THUOC_DANH_MUC WHERE Ma_SP=sp.Ma_SP AND Ma_danh_muc=@Ma_danh_muc))
   AND (@Loai_SP IS NULL OR sp.Loai_SP=@Loai_SP) AND (@Trang_thai IS NULL OR sp.Trang_thai=@Trang_thai)
   AND ((sp.Loai_SP='BANH_NGOT' AND (@Gia_tu IS NULL OR bn.Don_gia>=@Gia_tu) AND (@Gia_den IS NULL OR bn.Don_gia<=@Gia_den))
    OR (sp.Loai_SP='MON_NUOC' AND EXISTS(SELECT 1 FROM dbo.CHON_SIZE s WHERE s.Ma_SP=sp.Ma_SP AND (@Gia_tu IS NULL OR s.Gia_ban>=@Gia_tu) AND (@Gia_den IS NULL OR s.Gia_ban<=@Gia_den))))
 ORDER BY CASE WHEN @Sap_xep_theo='GIA_ASC' THEN COALESCE(bn.Don_gia,p.Gia_tu) END,
   CASE WHEN @Sap_xep_theo='GIA_DESC' THEN COALESCE(bn.Don_gia,p.Gia_tu) END DESC,
   CASE WHEN @Sap_xep_theo='TEN_ASC' THEN sp.Ten_SP END,sp.Ma_SP;
END;
GO
-- SELECT-only aggregate procedure: item sales before invoice discount, explicitly named.
CREATE OR ALTER PROCEDURE dbo.sp_ThongKeDoanhThuSanPham
 @Tu_ngay DATE, @Den_ngay DATE, @Ma_CN VARCHAR(20)=NULL,
 @So_luong_ban_toi_thieu INT=1, @Doanh_thu_toi_thieu DECIMAL(18,2)=0
AS
BEGIN
 SET NOCOUNT ON;
 SELECT sp.Ma_SP,sp.Ten_SP,sp.Loai_SP,COUNT(DISTINCT hd.Ma_HD) So_don_hang_xuat_hien,
   SUM(c.So_luong) Tong_so_luong_ban,SUM(c.Thanh_tien) Tong_doanh_thu_mon,
   CAST(AVG(c.Thanh_tien) AS DECIMAL(18,2)) Doanh_thu_trung_binh_moi_luot
 FROM dbo.SAN_PHAM sp JOIN dbo.CHI_TIET_HOA_DON c ON sp.Ma_SP=c.Ma_SP
 JOIN dbo.HOA_DON hd ON c.Ma_HD=hd.Ma_HD JOIN dbo.CHI_NHANH cn ON hd.Ma_CN=cn.Ma_CN
 WHERE hd.Trang_thai='HOAN_TAT' AND hd.Ngay_tao>=@Tu_ngay AND hd.Ngay_tao<DATEADD(DAY,1,@Den_ngay)
   AND (@Ma_CN IS NULL OR cn.Ma_CN=@Ma_CN)
 GROUP BY sp.Ma_SP,sp.Ten_SP,sp.Loai_SP
 HAVING SUM(c.So_luong)>=@So_luong_ban_toi_thieu AND SUM(c.Thanh_tien)>=@Doanh_thu_toi_thieu
 ORDER BY Tong_doanh_thu_mon DESC,Tong_so_luong_ban DESC,sp.Ma_SP;
END;
GO
-- BTL1 1.3.h: trigger creates debit history in the same transaction.
CREATE OR ALTER PROCEDURE dbo.sp_DoiVoucher @Ma_VCCN VARCHAR(20),@Ma_KH VARCHAR(20),@Ma_Voucher VARCHAR(20),@Ngay_doi DATETIME=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  SET @Ngay_doi=COALESCE(@Ngay_doi,GETDATE());
  IF NOT EXISTS(SELECT 1 FROM dbo.KHACH_HANG WITH(UPDLOCK,HOLDLOCK) WHERE Ma_KH=@Ma_KH)
   THROW 51030,N'Khách hàng không tồn tại.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.VOUCHER WHERE Ma_Voucher=@Ma_Voucher)
   THROW 51031,N'Voucher không tồn tại.',1;
  INSERT dbo.VOUCHER_CA_NHAN(Ma_VCCN,Ngay_doi,HSD,Trang_thai,Ma_Voucher,Ma_KH)
   SELECT @Ma_VCCN,@Ngay_doi,DATEADD(DAY,Tgian_hieu_luc,@Ngay_doi),'CHUA_SU_DUNG',Ma_Voucher,@Ma_KH FROM dbo.VOUCHER WHERE Ma_Voucher=@Ma_Voucher;
  COMMIT;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
