USE HighlandsCoffeeDB;
GO
-- Append-only ledger. This single atomic UPDATE serializes competing redemptions per customer.
CREATE OR ALTER TRIGGER dbo.trg_LichSuDiem ON dbo.LICH_SU_DIEM AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted) THROW 51101,N'Lịch sử điểm đã ghi nhận không được sửa hoặc xóa.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.HOA_DON h ON i.Ma_HD=h.Ma_HD
   WHERE h.Trang_thai<>'HOAN_TAT' OR i.Diem_thay_doi<>h.Diem_tich_luy_nhan)
  THROW 51102,N'Điểm cộng phải khớp hóa đơn đã hoàn tất.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.VOUCHER_CA_NHAN c ON i.Ma_VCCN=c.Ma_VCCN
   JOIN dbo.VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher WHERE i.Diem_thay_doi<>-v.Diem_doi)
  THROW 51103,N'Điểm trừ phải bằng điểm đổi của voucher.',1;
 ;WITH d AS(SELECT Ma_KH,SUM(Diem_thay_doi) Diem FROM inserted GROUP BY Ma_KH)
 UPDATE k WITH(UPDLOCK) SET Diem_tich_luy=k.Diem_tich_luy+d.Diem
 FROM dbo.KHACH_HANG k JOIN d ON k.Ma_KH=d.Ma_KH;
 -- CHECK Diem_tich_luy >= 0 rejects the entire transaction, including the voucher, if insufficient.
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_DoiVoucher ON dbo.VOUCHER_CA_NHAN AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF TRIGGER_NESTLEVEL(OBJECT_ID(N'dbo.trg_DoiVoucher'))>1 RETURN;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON d.Ma_VCCN=i.Ma_VCCN WHERE i.Ma_VCCN IS NULL)
  THROW 51104,N'Không được xóa voucher đã cấp vì phải bảo toàn lịch sử điểm.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.Ma_VCCN=d.Ma_VCCN
   WHERE i.Ma_KH<>d.Ma_KH OR i.Ma_Voucher<>d.Ma_Voucher OR i.Ngay_doi<>d.Ngay_doi OR i.HSD<>d.HSD)
  THROW 51105,N'Không được đổi chủ sở hữu, loại voucher hoặc thời hạn của voucher đã cấp.',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON i.Ma_VCCN=d.Ma_VCCN WHERE d.Ma_VCCN IS NULL AND i.Trang_thai<>'CHUA_SU_DUNG')
  THROW 51106,N'Voucher mới đổi phải ở trạng thái chưa sử dụng.',1;
 IF EXISTS(SELECT 1 FROM inserted i WHERE
   (i.Trang_thai='DA_SU_DUNG' AND NOT EXISTS(SELECT 1 FROM dbo.HOA_DON h WHERE h.Ma_VCCN=i.Ma_VCCN AND h.Trang_thai='HOAN_TAT'))
   OR (i.Trang_thai<>'DA_SU_DUNG' AND EXISTS(SELECT 1 FROM dbo.HOA_DON h WHERE h.Ma_VCCN=i.Ma_VCCN AND h.Trang_thai='HOAN_TAT')))
  THROW 51107,N'Trạng thái sử dụng voucher phải khớp hóa đơn hoàn tất.',1;
 UPDATE c SET HSD=DATEADD(DAY,v.Tgian_hieu_luc,c.Ngay_doi)
 FROM dbo.VOUCHER_CA_NHAN c JOIN inserted i ON c.Ma_VCCN=i.Ma_VCCN
 LEFT JOIN deleted d ON i.Ma_VCCN=d.Ma_VCCN JOIN dbo.VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher
 WHERE d.Ma_VCCN IS NULL;
 -- Friendly error before ledger CHECK; locking also covers a multi-row redemption.
 IF EXISTS(SELECT 1 FROM dbo.KHACH_HANG k WITH(UPDLOCK,HOLDLOCK)
  JOIN(SELECT i.Ma_KH,SUM(v.Diem_doi) Can_doi FROM inserted i LEFT JOIN deleted d ON i.Ma_VCCN=d.Ma_VCCN
    JOIN dbo.VOUCHER v ON i.Ma_Voucher=v.Ma_Voucher WHERE d.Ma_VCCN IS NULL GROUP BY i.Ma_KH) x ON k.Ma_KH=x.Ma_KH
  WHERE k.Diem_tich_luy<x.Can_doi)
  THROW 51108,N'Số dư điểm không đủ để đổi voucher. Giao dịch đã được hủy toàn bộ.',1;
 INSERT dbo.LICH_SU_DIEM(Ma_LS,Diem_thay_doi,Thoi_gian,Noi_dung,Ma_KH,Ma_HD,Ma_VCCN)
  SELECT 'VC:'+i.Ma_VCCN,-v.Diem_doi,i.Ngay_doi,N'Đổi voucher '+i.Ma_Voucher,i.Ma_KH,NULL,i.Ma_VCCN
  FROM inserted i LEFT JOIN deleted d ON i.Ma_VCCN=d.Ma_VCCN JOIN dbo.VOUCHER v ON i.Ma_Voucher=v.Ma_Voucher WHERE d.Ma_VCCN IS NULL;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_KhoaChinhSachVoucher ON dbo.VOUCHER AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.Ma_Voucher=d.Ma_Voucher
   WHERE EXISTS(SELECT 1 FROM dbo.VOUCHER_CA_NHAN c WHERE c.Ma_Voucher=i.Ma_Voucher)
   AND (i.Diem_doi<>d.Diem_doi OR i.Phan_tram_giam<>d.Phan_tram_giam OR i.Giam_toi_da<>d.Giam_toi_da OR i.Dieu_kien<>d.Dieu_kien OR i.Tgian_hieu_luc<>d.Tgian_hieu_luc))
  THROW 51109,N'Voucher đã cấp không được thay đổi chính sách. Hãy tạo chương trình voucher mới.',1;
END;
GO
-- One invoice trigger owns validation, discount, status and loyalty to avoid trigger-order dependencies.
CREATE OR ALTER TRIGGER dbo.trg_HoaDon ON dbo.HOA_DON AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF TRIGGER_NESTLEVEL(OBJECT_ID(N'dbo.trg_HoaDon'))>1 RETURN;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON d.Ma_HD=i.Ma_HD WHERE i.Ma_HD IS NULL)
  THROW 51110,N'Hãy hủy hóa đơn thay vì xóa lịch sử giao dịch.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.Ma_HD=d.Ma_HD WHERE d.Trang_thai IN('HOAN_TAT','DA_HUY'))
  THROW 51111,N'Hóa đơn hoàn tất hoặc đã hủy không được chỉnh sửa.',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON i.Ma_HD=d.Ma_HD WHERE d.Ma_HD IS NULL AND i.Trang_thai<>'CHO_POS_XAC_NHAN')
  THROW 51112,N'Hóa đơn mới phải ở trạng thái Chờ POS xác nhận.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.Ma_HD=d.Ma_HD WHERE d.Trang_thai='DANG_CHUAN_BI' AND i.Trang_thai='CHO_POS_XAC_NHAN')
  THROW 51113,N'Không được đưa hóa đơn đang chuẩn bị về trạng thái chờ xác nhận.',1;
 IF EXISTS(SELECT 1 FROM inserted i WHERE i.Trang_thai IN('DANG_CHUAN_BI','HOAN_TAT')
   AND NOT EXISTS(SELECT 1 FROM dbo.CHI_TIET_HOA_DON c WHERE c.Ma_HD=i.Ma_HD))
  THROW 51114,N'Hóa đơn cần ít nhất một món trước khi xác nhận hoặc hoàn tất.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.VOUCHER_CA_NHAN c WITH(UPDLOCK,HOLDLOCK) ON i.Ma_VCCN=c.Ma_VCCN
   WHERE i.Trang_thai<>'DA_HUY' AND (c.Trang_thai<>'CHUA_SU_DUNG' OR i.Ngay_tao>c.HSD OR i.Ngay_tao<c.Ngay_doi))
  THROW 51115,N'Voucher chưa được đổi tại thời điểm lập hóa đơn, đã sử dụng hoặc hết hạn.',1;
 IF EXISTS(SELECT 1 FROM inserted i
   JOIN dbo.VOUCHER_CA_NHAN c ON i.Ma_VCCN=c.Ma_VCCN JOIN dbo.VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher
   WHERE i.Trang_thai='HOAN_TAT' AND COALESCE((SELECT SUM(d.Thanh_tien) FROM dbo.CHI_TIET_HOA_DON d WHERE d.Ma_HD=i.Ma_HD),0)<v.Dieu_kien)
  THROW 51116,N'Hóa đơn chưa đạt giá trị tối thiểu để áp dụng voucher. Hãy bỏ voucher hoặc bổ sung món trước khi hoàn tất.',1;
 ;WITH totals AS(
  SELECT i.Ma_HD,COALESCE(SUM(c.Thanh_tien),0) Tong FROM inserted i LEFT JOIN dbo.CHI_TIET_HOA_DON c ON c.Ma_HD=i.Ma_HD GROUP BY i.Ma_HD
 ), discounts AS(
  SELECT t.Ma_HD,t.Tong,Giam=CASE WHEN h.Trang_thai<>'DA_HUY' AND t.Tong>=v.Dieu_kien
    THEN CASE WHEN ROUND(t.Tong*v.Phan_tram_giam/100,0)>v.Giam_toi_da THEN v.Giam_toi_da ELSE ROUND(t.Tong*v.Phan_tram_giam/100,0) END ELSE 0 END
  FROM totals t JOIN dbo.HOA_DON h ON h.Ma_HD=t.Ma_HD LEFT JOIN dbo.VOUCHER_CA_NHAN c ON h.Ma_VCCN=c.Ma_VCCN LEFT JOIN dbo.VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher
 )
 UPDATE h SET Tong_tien=x.Tong,So_tien_giam=x.Giam,Thanh_tien=x.Tong-x.Giam,
   Diem_tich_luy_nhan=CASE WHEN h.Trang_thai='HOAN_TAT' THEN FLOOR((x.Tong-x.Giam)/10000) ELSE 0 END,
   Ma_VCCN=CASE WHEN h.Trang_thai='DA_HUY' THEN NULL ELSE h.Ma_VCCN END
 FROM dbo.HOA_DON h JOIN discounts x ON h.Ma_HD=x.Ma_HD;
 UPDATE c SET Trang_thai='DA_SU_DUNG' FROM dbo.VOUCHER_CA_NHAN c JOIN dbo.HOA_DON h ON c.Ma_VCCN=h.Ma_VCCN JOIN inserted i ON h.Ma_HD=i.Ma_HD WHERE h.Trang_thai='HOAN_TAT';
 INSERT dbo.LICH_SU_DIEM(Ma_LS,Diem_thay_doi,Thoi_gian,Noi_dung,Ma_KH,Ma_HD,Ma_VCCN)
  SELECT 'HD:'+h.Ma_HD,h.Diem_tich_luy_nhan,h.Ngay_tao,N'Tích điểm từ hóa đơn '+h.Ma_HD,h.Ma_KH,h.Ma_HD,NULL
  FROM dbo.HOA_DON h JOIN inserted i ON h.Ma_HD=i.Ma_HD
  WHERE h.Trang_thai='HOAN_TAT' AND h.Diem_tich_luy_nhan>0 AND NOT EXISTS(SELECT 1 FROM dbo.LICH_SU_DIEM l WHERE l.Ma_HD=h.Ma_HD);
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_ChiTietHoaDon ON dbo.CHI_TIET_HOA_DON AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF TRIGGER_NESTLEVEL(OBJECT_ID(N'dbo.trg_ChiTietHoaDon'))>1 RETURN;
 IF EXISTS(SELECT 1 FROM(SELECT Ma_HD FROM inserted UNION SELECT Ma_HD FROM deleted) a
   JOIN dbo.HOA_DON h WITH(UPDLOCK,HOLDLOCK) ON a.Ma_HD=h.Ma_HD WHERE h.Trang_thai IN('HOAN_TAT','DA_HUY'))
  THROW 51120,N'Không được sửa chi tiết hóa đơn đã hoàn tất hoặc đã hủy.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.SAN_PHAM p ON i.Ma_SP=p.Ma_SP
   WHERE (p.Loai_SP='MON_NUOC' AND (i.Ma_size IS NULL OR i.Dang_mon IS NULL))
      OR (p.Loai_SP='BANH_NGOT' AND (i.Ma_size IS NOT NULL OR i.Dang_mon IS NOT NULL
          OR EXISTS(SELECT 1 FROM dbo.CHON_TOPPING t WHERE t.Ma_HD=i.Ma_HD AND t.Ma_chi_tiet=i.Ma_chi_tiet))))
  THROW 51121,N'Món nước cần size và dạng món; bánh ngọt không được có size, dạng món hoặc topping.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.SAN_PHAM p ON i.Ma_SP=p.Ma_SP LEFT JOIN deleted d ON i.Ma_HD=d.Ma_HD AND i.Ma_chi_tiet=d.Ma_chi_tiet
   WHERE p.Trang_thai<>N'Đang bán' AND (d.Ma_HD IS NULL OR i.Ma_SP<>d.Ma_SP))
  THROW 51122,N'Không thể đặt sản phẩm hết hàng hoặc ngừng kinh doanh.',1;
 -- Snapshot catalogue prices only at insertion or when the selected item/size changes.
 UPDATE c SET Don_gia=g.Gia,Thanh_tien=(g.Gia+COALESCE(t.Gia,0))*c.So_luong
 FROM dbo.CHI_TIET_HOA_DON c JOIN inserted i ON c.Ma_HD=i.Ma_HD AND c.Ma_chi_tiet=i.Ma_chi_tiet
 LEFT JOIN deleted d ON i.Ma_HD=d.Ma_HD AND i.Ma_chi_tiet=d.Ma_chi_tiet
 LEFT JOIN dbo.BANH_NGOT b ON c.Ma_SP=b.Ma_SP LEFT JOIN dbo.CHON_SIZE s ON c.Ma_SP=s.Ma_SP AND c.Ma_size=s.Ma_size
 CROSS APPLY(SELECT CASE WHEN d.Ma_HD IS NOT NULL AND d.Ma_SP=c.Ma_SP AND ISNULL(d.Ma_size,'')=ISNULL(c.Ma_size,'') THEN d.Don_gia ELSE COALESCE(b.Don_gia,s.Gia_ban) END Gia) g
 OUTER APPLY(SELECT SUM(Don_gia*So_luong) Gia FROM dbo.CHON_TOPPING WHERE Ma_HD=c.Ma_HD AND Ma_chi_tiet=c.Ma_chi_tiet) t;
 -- Trigger on HOA_DON recomputes totals and discount from the freshly calculated lines.
 UPDATE h SET Tong_tien=h.Tong_tien FROM dbo.HOA_DON h
 JOIN(SELECT Ma_HD FROM inserted UNION SELECT Ma_HD FROM deleted) a ON a.Ma_HD=h.Ma_HD;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_ChonTopping ON dbo.CHON_TOPPING AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF TRIGGER_NESTLEVEL(OBJECT_ID(N'dbo.trg_ChonTopping'))>1 RETURN;
 IF EXISTS(SELECT 1 FROM(SELECT Ma_HD FROM inserted UNION SELECT Ma_HD FROM deleted) a
   JOIN dbo.HOA_DON h WITH(UPDLOCK,HOLDLOCK) ON a.Ma_HD=h.Ma_HD WHERE h.Trang_thai IN('HOAN_TAT','DA_HUY'))
  THROW 51123,N'Không được sửa topping của hóa đơn đã hoàn tất hoặc đã hủy.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.CHI_TIET_HOA_DON c ON i.Ma_HD=c.Ma_HD AND i.Ma_chi_tiet=c.Ma_chi_tiet
   JOIN dbo.SAN_PHAM p ON c.Ma_SP=p.Ma_SP WHERE p.Loai_SP<>'MON_NUOC')
  THROW 51124,N'Topping chỉ được thêm vào món nước.',1;
 UPDATE t SET Don_gia=COALESCE(d.Don_gia,p.Don_gia)
 FROM dbo.CHON_TOPPING t JOIN inserted i ON t.Ma_HD=i.Ma_HD AND t.Ma_chi_tiet=i.Ma_chi_tiet AND t.Ma_topping=i.Ma_topping
 LEFT JOIN deleted d ON i.Ma_HD=d.Ma_HD AND i.Ma_chi_tiet=d.Ma_chi_tiet AND i.Ma_topping=d.Ma_topping
 JOIN dbo.TOPPING p ON t.Ma_topping=p.Ma_topping;
 UPDATE c SET Thanh_tien=c.Thanh_tien FROM dbo.CHI_TIET_HOA_DON c
 JOIN(SELECT Ma_HD,Ma_chi_tiet FROM inserted UNION SELECT Ma_HD,Ma_chi_tiet FROM deleted) a ON c.Ma_HD=a.Ma_HD AND c.Ma_chi_tiet=a.Ma_chi_tiet;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_ChuyenTrangThaiHoaDon @Ma_HD VARCHAR(20),@Trang_thai VARCHAR(30)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @Trang_thai IS NULL OR @Trang_thai NOT IN('DANG_CHUAN_BI','HOAN_TAT','DA_HUY') THROW 51125,N'Trạng thái đích không hợp lệ.',1;
 UPDATE dbo.HOA_DON SET Trang_thai=@Trang_thai WHERE Ma_HD=@Ma_HD;
 IF @@ROWCOUNT=0 THROW 51126,N'Không tìm thấy hóa đơn.',1;
END;
GO
