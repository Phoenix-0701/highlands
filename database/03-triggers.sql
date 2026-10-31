SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE HighlandsCoffeeDB;

-- MySQL row triggers: BEFORE assigns NEW; AFTER updates related tables only.

DELIMITER $$

DROP TRIGGER IF EXISTS trg_LichSuDiem_BI$$
CREATE TRIGGER trg_LichSuDiem_BI BEFORE INSERT ON LICH_SU_DIEM FOR EACH ROW
BEGIN
 IF NEW.Ma_HD IS NOT NULL AND NOT EXISTS(SELECT 1 FROM HOA_DON h WHERE h.Ma_HD=NEW.Ma_HD AND h.Ma_KH=NEW.Ma_KH AND h.Trang_thai='HOAN_TAT' AND h.Diem_tich_luy_nhan=NEW.Diem_thay_doi) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51102,MESSAGE_TEXT='Điểm cộng phải khớp hóa đơn hoàn tất.'; END IF;
 IF NEW.Ma_VCCN IS NOT NULL AND NOT EXISTS(SELECT 1 FROM VOUCHER_CA_NHAN c JOIN VOUCHER v ON v.Ma_Voucher=c.Ma_Voucher WHERE c.Ma_VCCN=NEW.Ma_VCCN AND c.Ma_KH=NEW.Ma_KH AND NEW.Diem_thay_doi=-v.Diem_doi) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51103,MESSAGE_TEXT='Điểm trừ phải bằng điểm đổi voucher.'; END IF;
END$$

DROP TRIGGER IF EXISTS trg_LichSuDiem_AI$$
CREATE TRIGGER trg_LichSuDiem_AI AFTER INSERT ON LICH_SU_DIEM FOR EACH ROW
BEGIN

 UPDATE KHACH_HANG SET Diem_tich_luy=Diem_tich_luy+NEW.Diem_thay_doi WHERE Ma_KH=NEW.Ma_KH AND Diem_tich_luy+NEW.Diem_thay_doi>=0;
 IF ROW_COUNT()<>1 THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51108,MESSAGE_TEXT='Số dư điểm không đủ. Giao dịch bị hủy toàn bộ.'; END IF;
END$$

DROP TRIGGER IF EXISTS trg_LichSuDiem_BU$$
CREATE TRIGGER trg_LichSuDiem_BU BEFORE UPDATE ON LICH_SU_DIEM FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51101,MESSAGE_TEXT='Lịch sử điểm không được sửa hoặc xóa.';
END$$

DROP TRIGGER IF EXISTS trg_LichSuDiem_BD$$
CREATE TRIGGER trg_LichSuDiem_BD BEFORE DELETE ON LICH_SU_DIEM FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51101,MESSAGE_TEXT='Lịch sử điểm không được sửa hoặc xóa.';
END$$

DROP TRIGGER IF EXISTS trg_DoiVoucher_BI$$
CREATE TRIGGER trg_DoiVoucher_BI BEFORE INSERT ON VOUCHER_CA_NHAN FOR EACH ROW
BEGIN

 DECLARE v_points INT DEFAULT NULL;
 DECLARE v_cost INT DEFAULT NULL;
 DECLARE v_days INT DEFAULT NULL;
 SELECT Diem_tich_luy INTO v_points FROM KHACH_HANG WHERE Ma_KH=NEW.Ma_KH FOR UPDATE;
 SELECT Diem_doi,Tgian_hieu_luc INTO v_cost,v_days FROM VOUCHER WHERE Ma_Voucher=NEW.Ma_Voucher;
 IF v_points IS NULL THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51030,MESSAGE_TEXT='Khách hàng không tồn tại.'; END IF;
 IF v_cost IS NULL THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51031,MESSAGE_TEXT='Voucher không tồn tại.'; END IF;
 IF NEW.Trang_thai<>'CHUA_SU_DUNG' THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51106,MESSAGE_TEXT='Voucher mới phải chưa sử dụng.'; END IF;
 IF v_points<v_cost THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51108,MESSAGE_TEXT='Số dư điểm không đủ để đổi voucher.'; END IF;
 SET NEW.HSD=DATE_ADD(NEW.Ngay_doi,INTERVAL v_days DAY);
END$$

DROP TRIGGER IF EXISTS trg_DoiVoucher_AI$$
CREATE TRIGGER trg_DoiVoucher_AI AFTER INSERT ON VOUCHER_CA_NHAN FOR EACH ROW
BEGIN

 INSERT INTO LICH_SU_DIEM(Ma_LS,Diem_thay_doi,Thoi_gian,Noi_dung,Ma_KH,Ma_HD,Ma_VCCN)
 SELECT CONCAT('VC:',NEW.Ma_VCCN),-v.Diem_doi,NEW.Ngay_doi,CONCAT('Đổi voucher ',NEW.Ma_Voucher),NEW.Ma_KH,NULL,NEW.Ma_VCCN FROM VOUCHER v WHERE v.Ma_Voucher=NEW.Ma_Voucher;
END$$

DROP TRIGGER IF EXISTS trg_DoiVoucher_BU$$
CREATE TRIGGER trg_DoiVoucher_BU BEFORE UPDATE ON VOUCHER_CA_NHAN FOR EACH ROW
BEGIN
 IF NEW.Ma_VCCN<>OLD.Ma_VCCN OR NEW.Ma_KH<>OLD.Ma_KH OR NEW.Ma_Voucher<>OLD.Ma_Voucher OR NEW.Ngay_doi<>OLD.Ngay_doi OR NEW.HSD<>OLD.HSD THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51105,MESSAGE_TEXT='Không được đổi chủ, loại hoặc thời hạn voucher.'; END IF;
 IF (NEW.Trang_thai='DA_SU_DUNG' AND NOT EXISTS(SELECT 1 FROM HOA_DON h WHERE h.Ma_VCCN=NEW.Ma_VCCN AND h.Trang_thai='HOAN_TAT')) OR (NEW.Trang_thai<>'DA_SU_DUNG' AND EXISTS(SELECT 1 FROM HOA_DON h WHERE h.Ma_VCCN=NEW.Ma_VCCN AND h.Trang_thai='HOAN_TAT')) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51107,MESSAGE_TEXT='Trạng thái voucher phải khớp hóa đơn hoàn tất.'; END IF;
END$$

DROP TRIGGER IF EXISTS trg_DoiVoucher_BD$$
CREATE TRIGGER trg_DoiVoucher_BD BEFORE DELETE ON VOUCHER_CA_NHAN FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51104,MESSAGE_TEXT='Không được xóa voucher đã cấp.';
END$$

DROP TRIGGER IF EXISTS trg_KhoaChinhSachVoucher$$
CREATE TRIGGER trg_KhoaChinhSachVoucher BEFORE UPDATE ON VOUCHER FOR EACH ROW
BEGIN
 IF EXISTS(SELECT 1 FROM VOUCHER_CA_NHAN WHERE Ma_Voucher=OLD.Ma_Voucher) AND (NEW.Ma_Voucher<>OLD.Ma_Voucher OR NEW.Diem_doi<>OLD.Diem_doi OR NEW.Phan_tram_giam<>OLD.Phan_tram_giam OR NEW.Giam_toi_da<>OLD.Giam_toi_da OR NEW.Dieu_kien<>OLD.Dieu_kien OR NEW.Tgian_hieu_luc<>OLD.Tgian_hieu_luc) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51109,MESSAGE_TEXT='Voucher đã cấp không được thay đổi chính sách.'; END IF;
END$$

DROP TRIGGER IF EXISTS trg_HoaDon_BI$$
CREATE TRIGGER trg_HoaDon_BI BEFORE INSERT ON HOA_DON FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30) DEFAULT NULL;
 DECLARE v_from DATETIME;
 DECLARE v_expiry DATETIME;
 DECLARE v_min DECIMAL(12,2);
 DECLARE v_percent DECIMAL(5,2);
 DECLARE v_cap DECIMAL(12,2);
 IF NEW.Trang_thai<>'CHO_POS_XAC_NHAN' THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51112,MESSAGE_TEXT='Hóa đơn mới phải ở trạng thái chờ xác nhận.'; END IF;
 SET NEW.Tong_tien=0;

 SET NEW.So_tien_giam=0;
 IF NEW.Trang_thai='DA_HUY' THEN SET NEW.Ma_VCCN=NULL; END IF;
 IF NEW.Ma_VCCN IS NOT NULL THEN
  SELECT c.Trang_thai,c.Ngay_doi,c.HSD,v.Dieu_kien,v.Phan_tram_giam,v.Giam_toi_da INTO v_status,v_from,v_expiry,v_min,v_percent,v_cap
   FROM VOUCHER_CA_NHAN c JOIN VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher WHERE c.Ma_VCCN=NEW.Ma_VCCN AND c.Ma_KH=NEW.Ma_KH FOR UPDATE;
 IF v_status IS NULL OR v_status<>'CHUA_SU_DUNG' OR NEW.Ngay_tao<v_from OR NEW.Ngay_tao>v_expiry THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51115,MESSAGE_TEXT='Voucher sai chủ, chưa được đổi, đã dùng hoặc hết hạn.'; END IF;
 IF NEW.Trang_thai='HOAN_TAT' AND NEW.Tong_tien<v_min THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51116,MESSAGE_TEXT='Đơn chưa đủ giá trị tối thiểu. Hãy bỏ voucher hoặc bổ sung món.'; END IF;
  IF NEW.Tong_tien>=v_min THEN SET NEW.So_tien_giam=LEAST(ROUND(NEW.Tong_tien*v_percent/100,0),v_cap); END IF;
 END IF;
 SET NEW.Thanh_tien=NEW.Tong_tien-NEW.So_tien_giam;
 SET NEW.Diem_tich_luy_nhan=IF(NEW.Trang_thai='HOAN_TAT',FLOOR(NEW.Thanh_tien/10000),0);
END$$

DROP TRIGGER IF EXISTS trg_HoaDon_BU$$
CREATE TRIGGER trg_HoaDon_BU BEFORE UPDATE ON HOA_DON FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30) DEFAULT NULL;
 DECLARE v_from DATETIME;
 DECLARE v_expiry DATETIME;
 DECLARE v_min DECIMAL(12,2);
 DECLARE v_percent DECIMAL(5,2);
 DECLARE v_cap DECIMAL(12,2);
 IF OLD.Trang_thai IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51111,MESSAGE_TEXT='Hóa đơn hoàn tất hoặc đã hủy không được sửa.'; END IF;
 IF NEW.Ma_HD<>OLD.Ma_HD OR (OLD.Trang_thai='DANG_CHUAN_BI' AND NEW.Trang_thai='CHO_POS_XAC_NHAN') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51113,MESSAGE_TEXT='Không được đổi mã hoặc đưa đơn đang chuẩn bị về chờ.'; END IF;
 IF NEW.Trang_thai IN('DANG_CHUAN_BI','HOAN_TAT') AND NOT EXISTS(SELECT 1 FROM CHI_TIET_HOA_DON WHERE Ma_HD=NEW.Ma_HD) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51114,MESSAGE_TEXT='Hóa đơn cần ít nhất một món trước khi xác nhận hoặc hoàn tất.'; END IF;
 SET NEW.Tong_tien=(SELECT COALESCE(SUM(Thanh_tien),0) FROM CHI_TIET_HOA_DON WHERE Ma_HD=NEW.Ma_HD);

 SET NEW.So_tien_giam=0;
 IF NEW.Trang_thai='DA_HUY' THEN SET NEW.Ma_VCCN=NULL; END IF;
 IF NEW.Ma_VCCN IS NOT NULL THEN
  SELECT c.Trang_thai,c.Ngay_doi,c.HSD,v.Dieu_kien,v.Phan_tram_giam,v.Giam_toi_da INTO v_status,v_from,v_expiry,v_min,v_percent,v_cap
   FROM VOUCHER_CA_NHAN c JOIN VOUCHER v ON c.Ma_Voucher=v.Ma_Voucher WHERE c.Ma_VCCN=NEW.Ma_VCCN AND c.Ma_KH=NEW.Ma_KH FOR UPDATE;
 IF v_status IS NULL OR v_status<>'CHUA_SU_DUNG' OR NEW.Ngay_tao<v_from OR NEW.Ngay_tao>v_expiry THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51115,MESSAGE_TEXT='Voucher sai chủ, chưa được đổi, đã dùng hoặc hết hạn.'; END IF;
 IF NEW.Trang_thai='HOAN_TAT' AND NEW.Tong_tien<v_min THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51116,MESSAGE_TEXT='Đơn chưa đủ giá trị tối thiểu. Hãy bỏ voucher hoặc bổ sung món.'; END IF;
  IF NEW.Tong_tien>=v_min THEN SET NEW.So_tien_giam=LEAST(ROUND(NEW.Tong_tien*v_percent/100,0),v_cap); END IF;
 END IF;
 SET NEW.Thanh_tien=NEW.Tong_tien-NEW.So_tien_giam;
 SET NEW.Diem_tich_luy_nhan=IF(NEW.Trang_thai='HOAN_TAT',FLOOR(NEW.Thanh_tien/10000),0);
END$$

DROP TRIGGER IF EXISTS trg_HoaDon_AU$$
CREATE TRIGGER trg_HoaDon_AU AFTER UPDATE ON HOA_DON FOR EACH ROW
BEGIN

 IF NEW.Trang_thai='HOAN_TAT' AND OLD.Trang_thai<>'HOAN_TAT' THEN
  IF NEW.Ma_VCCN IS NOT NULL THEN UPDATE VOUCHER_CA_NHAN SET Trang_thai='DA_SU_DUNG' WHERE Ma_VCCN=NEW.Ma_VCCN; END IF;
  IF NEW.Diem_tich_luy_nhan>0 THEN
   INSERT INTO LICH_SU_DIEM(Ma_LS,Diem_thay_doi,Thoi_gian,Noi_dung,Ma_KH,Ma_HD,Ma_VCCN)
   VALUES(CONCAT('HD:',NEW.Ma_HD),NEW.Diem_tich_luy_nhan,NEW.Ngay_tao,CONCAT('Tích điểm từ hóa đơn ',NEW.Ma_HD),NEW.Ma_KH,NEW.Ma_HD,NULL);
  END IF;
 END IF;
END$$

DROP TRIGGER IF EXISTS trg_HoaDon_BD$$
CREATE TRIGGER trg_HoaDon_BD BEFORE DELETE ON HOA_DON FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51110,MESSAGE_TEXT='Hãy hủy hóa đơn để giữ lịch sử giao dịch.';
END$$

DROP TRIGGER IF EXISTS trg_ChiTietHoaDon_BI$$
CREATE TRIGGER trg_ChiTietHoaDon_BI BEFORE INSERT ON CHI_TIET_HOA_DON FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30) DEFAULT NULL;
 DECLARE v_type VARCHAR(20);
 DECLARE v_selling VARCHAR(50);
 DECLARE v_price DECIMAL(12,2);
 SELECT Trang_thai INTO v_status FROM HOA_DON WHERE Ma_HD=NEW.Ma_HD FOR UPDATE;
 IF v_status IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51120,MESSAGE_TEXT='Không được sửa chi tiết hoặc topping của đơn đã kết thúc.'; END IF;

 SELECT Loai_SP,Trang_thai INTO v_type,v_selling FROM SAN_PHAM WHERE Ma_SP=NEW.Ma_SP;
 IF (v_type='MON_NUOC' AND (NEW.Ma_size IS NULL OR NEW.Dang_mon IS NULL)) OR (v_type='BANH_NGOT' AND (NEW.Ma_size IS NOT NULL OR NEW.Dang_mon IS NOT NULL OR EXISTS(SELECT 1 FROM CHON_TOPPING WHERE Ma_HD=NEW.Ma_HD AND Ma_chi_tiet=NEW.Ma_chi_tiet))) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51121,MESSAGE_TEXT='Nước cần size và dạng món; bánh không có size, dạng món, topping.'; END IF;
 IF v_selling<>'Đang bán' THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51122,MESSAGE_TEXT='Không thể đặt sản phẩm hết hàng hoặc ngừng kinh doanh.'; END IF;

  IF v_type='BANH_NGOT' THEN SELECT Don_gia INTO v_price FROM BANH_NGOT WHERE Ma_SP=NEW.Ma_SP;
  ELSE SELECT Gia_ban INTO v_price FROM CHON_SIZE WHERE Ma_SP=NEW.Ma_SP AND Ma_size=NEW.Ma_size; END IF;

 SET NEW.Don_gia=v_price;
 SET NEW.Thanh_tien=(v_price+(SELECT COALESCE(SUM(Don_gia*So_luong),0) FROM CHON_TOPPING WHERE Ma_HD=NEW.Ma_HD AND Ma_chi_tiet=NEW.Ma_chi_tiet))*NEW.So_luong;
END$$

DROP TRIGGER IF EXISTS trg_ChiTietHoaDon_BU$$
CREATE TRIGGER trg_ChiTietHoaDon_BU BEFORE UPDATE ON CHI_TIET_HOA_DON FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30) DEFAULT NULL;
 DECLARE v_type VARCHAR(20);
 DECLARE v_selling VARCHAR(50);
 DECLARE v_price DECIMAL(12,2);
 SELECT Trang_thai INTO v_status FROM HOA_DON WHERE Ma_HD=NEW.Ma_HD FOR UPDATE;
 IF v_status IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51120,MESSAGE_TEXT='Không được sửa chi tiết hoặc topping của đơn đã kết thúc.'; END IF;
 IF NEW.Ma_HD<>OLD.Ma_HD OR NEW.Ma_chi_tiet<>OLD.Ma_chi_tiet THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51120,MESSAGE_TEXT='Không được đổi khóa dòng hóa đơn.'; END IF;
 SELECT Loai_SP,Trang_thai INTO v_type,v_selling FROM SAN_PHAM WHERE Ma_SP=NEW.Ma_SP;
 IF (v_type='MON_NUOC' AND (NEW.Ma_size IS NULL OR NEW.Dang_mon IS NULL)) OR (v_type='BANH_NGOT' AND (NEW.Ma_size IS NOT NULL OR NEW.Dang_mon IS NOT NULL OR EXISTS(SELECT 1 FROM CHON_TOPPING WHERE Ma_HD=NEW.Ma_HD AND Ma_chi_tiet=NEW.Ma_chi_tiet))) THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51121,MESSAGE_TEXT='Nước cần size và dạng món; bánh không có size, dạng món, topping.'; END IF;
 IF v_selling<>'Đang bán' AND NEW.Ma_SP<>OLD.Ma_SP THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51122,MESSAGE_TEXT='Không thể đặt sản phẩm hết hàng hoặc ngừng kinh doanh.'; END IF;
 IF NEW.Ma_SP=OLD.Ma_SP AND NEW.Ma_size<=>OLD.Ma_size THEN SET v_price=OLD.Don_gia;
 ELSE
  IF v_type='BANH_NGOT' THEN SELECT Don_gia INTO v_price FROM BANH_NGOT WHERE Ma_SP=NEW.Ma_SP;
  ELSE SELECT Gia_ban INTO v_price FROM CHON_SIZE WHERE Ma_SP=NEW.Ma_SP AND Ma_size=NEW.Ma_size; END IF;
 END IF;
 SET NEW.Don_gia=v_price;
 SET NEW.Thanh_tien=(v_price+(SELECT COALESCE(SUM(Don_gia*So_luong),0) FROM CHON_TOPPING WHERE Ma_HD=NEW.Ma_HD AND Ma_chi_tiet=NEW.Ma_chi_tiet))*NEW.So_luong;
END$$

DROP TRIGGER IF EXISTS trg_ChiTietHoaDon_BD$$
CREATE TRIGGER trg_ChiTietHoaDon_BD BEFORE DELETE ON CHI_TIET_HOA_DON FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30);
 SELECT Trang_thai INTO v_status FROM HOA_DON WHERE Ma_HD=OLD.Ma_HD FOR UPDATE;
 IF v_status IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51120,MESSAGE_TEXT='Không được sửa chi tiết hoặc topping của đơn đã kết thúc.'; END IF;
END$$

DROP TRIGGER IF EXISTS trg_ChiTietHoaDon_AI$$
CREATE TRIGGER trg_ChiTietHoaDon_AI AFTER INSERT ON CHI_TIET_HOA_DON FOR EACH ROW
BEGIN
 UPDATE HOA_DON SET Tong_tien=Tong_tien WHERE Ma_HD=NEW.Ma_HD;
END$$

DROP TRIGGER IF EXISTS trg_ChiTietHoaDon_AU$$
CREATE TRIGGER trg_ChiTietHoaDon_AU AFTER UPDATE ON CHI_TIET_HOA_DON FOR EACH ROW
BEGIN
 UPDATE HOA_DON SET Tong_tien=Tong_tien WHERE Ma_HD=NEW.Ma_HD;
END$$

DROP TRIGGER IF EXISTS trg_ChiTietHoaDon_AD$$
CREATE TRIGGER trg_ChiTietHoaDon_AD AFTER DELETE ON CHI_TIET_HOA_DON FOR EACH ROW
BEGIN
 UPDATE HOA_DON SET Tong_tien=Tong_tien WHERE Ma_HD=OLD.Ma_HD;
END$$

DROP TRIGGER IF EXISTS trg_ChonTopping_BI$$
CREATE TRIGGER trg_ChonTopping_BI BEFORE INSERT ON CHON_TOPPING FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30);
 SELECT Trang_thai INTO v_status FROM HOA_DON WHERE Ma_HD=NEW.Ma_HD FOR UPDATE;
 IF v_status IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51123,MESSAGE_TEXT='Không được sửa chi tiết hoặc topping của đơn đã kết thúc.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM CHI_TIET_HOA_DON c JOIN SAN_PHAM p ON p.Ma_SP=c.Ma_SP WHERE c.Ma_HD=NEW.Ma_HD AND c.Ma_chi_tiet=NEW.Ma_chi_tiet AND p.Loai_SP='MON_NUOC') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51124,MESSAGE_TEXT='Topping chỉ được thêm vào món nước.'; END IF;
 SET NEW.Don_gia=(SELECT Don_gia FROM TOPPING WHERE Ma_topping=NEW.Ma_topping);
END$$

DROP TRIGGER IF EXISTS trg_ChonTopping_AI$$
CREATE TRIGGER trg_ChonTopping_AI AFTER INSERT ON CHON_TOPPING FOR EACH ROW
BEGIN
 UPDATE CHI_TIET_HOA_DON SET Thanh_tien=Thanh_tien WHERE Ma_HD=NEW.Ma_HD AND Ma_chi_tiet=NEW.Ma_chi_tiet;
END$$

DROP TRIGGER IF EXISTS trg_ChonTopping_BU$$
CREATE TRIGGER trg_ChonTopping_BU BEFORE UPDATE ON CHON_TOPPING FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30);
 SELECT Trang_thai INTO v_status FROM HOA_DON WHERE Ma_HD=NEW.Ma_HD FOR UPDATE;
 IF v_status IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51123,MESSAGE_TEXT='Không được sửa chi tiết hoặc topping của đơn đã kết thúc.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM CHI_TIET_HOA_DON c JOIN SAN_PHAM p ON p.Ma_SP=c.Ma_SP WHERE c.Ma_HD=NEW.Ma_HD AND c.Ma_chi_tiet=NEW.Ma_chi_tiet AND p.Loai_SP='MON_NUOC') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51124,MESSAGE_TEXT='Topping chỉ được thêm vào món nước.'; END IF;
 IF NEW.Ma_HD<>OLD.Ma_HD OR NEW.Ma_chi_tiet<>OLD.Ma_chi_tiet OR NEW.Ma_topping<>OLD.Ma_topping THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51124,MESSAGE_TEXT='Không được đổi khóa lựa chọn topping.'; END IF;
 SET NEW.Don_gia=OLD.Don_gia;
END$$

DROP TRIGGER IF EXISTS trg_ChonTopping_AU$$
CREATE TRIGGER trg_ChonTopping_AU AFTER UPDATE ON CHON_TOPPING FOR EACH ROW
BEGIN
 UPDATE CHI_TIET_HOA_DON SET Thanh_tien=Thanh_tien WHERE Ma_HD=NEW.Ma_HD AND Ma_chi_tiet=NEW.Ma_chi_tiet;
END$$

DROP TRIGGER IF EXISTS trg_ChonTopping_BD$$
CREATE TRIGGER trg_ChonTopping_BD BEFORE DELETE ON CHON_TOPPING FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(30);
 SELECT Trang_thai INTO v_status FROM HOA_DON WHERE Ma_HD=OLD.Ma_HD FOR UPDATE;
 IF v_status IN('HOAN_TAT','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO=51123,MESSAGE_TEXT='Không được sửa chi tiết hoặc topping của đơn đã kết thúc.'; END IF;
END$$

DROP TRIGGER IF EXISTS trg_ChonTopping_AD$$
CREATE TRIGGER trg_ChonTopping_AD AFTER DELETE ON CHON_TOPPING FOR EACH ROW
BEGIN
 UPDATE CHI_TIET_HOA_DON SET Thanh_tien=Thanh_tien WHERE Ma_HD=OLD.Ma_HD AND Ma_chi_tiet=OLD.Ma_chi_tiet;
END$$

DELIMITER ;
