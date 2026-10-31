SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE HighlandsCoffeeDB;
DELIMITER $$
DROP FUNCTION IF EXISTS fn_TinhDiemThuongChuoiLua$$
CREATE FUNCTION fn_TinhDiemThuongChuoiLua(p_customer VARCHAR(20),p_from DATE,p_to DATE)
RETURNS VARCHAR(500) CHARACTER SET utf8mb4
NOT DETERMINISTIC READS SQL DATA SQL SECURITY DEFINER
BEGIN
 DECLARE v_done BOOLEAN DEFAULT FALSE;
 DECLARE v_day DATE;
 DECLARE v_previous DATE DEFAULT NULL;
 DECLARE v_total DECIMAL(19,2);
 DECLARE v_streak INT DEFAULT 0;
 DECLARE v_longest INT DEFAULT 0;
 DECLARE v_bonus INT DEFAULT 0;
 DECLARE cur_days CURSOR FOR SELECT DATE(Ngay_tao),SUM(Thanh_tien) FROM HOA_DON
  WHERE Ma_KH=p_customer AND Trang_thai='HOAN_TAT' AND Ngay_tao>=p_from AND Ngay_tao<DATE_ADD(p_to,INTERVAL 1 DAY)
  GROUP BY DATE(Ngay_tao) ORDER BY DATE(Ngay_tao);
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
 IF p_customer IS NULL OR NOT EXISTS(SELECT 1 FROM KHACH_HANG WHERE Ma_KH=p_customer) THEN RETURN 'Lỗi tham số: Khách hàng không tồn tại.'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RETURN 'Lỗi tham số: Khoảng thời gian không hợp lệ.'; END IF;
 OPEN cur_days;
 read_days: LOOP
  FETCH cur_days INTO v_day,v_total;
  IF v_done THEN LEAVE read_days; END IF;
  IF v_total>=50000 THEN
   IF v_previous IS NOT NULL AND DATEDIFF(v_day,v_previous)=1 THEN SET v_streak=v_streak+1;
   ELSE SET v_streak=1; END IF;
   IF v_streak=1 THEN SET v_bonus=v_bonus+2;
   ELSEIF v_streak=2 THEN SET v_bonus=v_bonus+4;
   ELSE SET v_bonus=v_bonus+8; END IF;
   SET v_longest=GREATEST(v_longest,v_streak);
   SET v_previous=v_day;
  ELSE SET v_streak=0; SET v_previous=NULL;
  END IF;
 END LOOP;
 CLOSE cur_days;
 RETURN CONCAT('Khách hàng ',p_customer,' | Chuỗi lửa dài nhất: ',v_longest,' ngày liên tiếp | Điểm thưởng Chuỗi lửa nhận thêm: +',v_bonus,' Drips');
END$$
DROP FUNCTION IF EXISTS fn_PhanTichGiaTriUuDaiChiNhanh$$
CREATE FUNCTION fn_PhanTichGiaTriUuDaiChiNhanh(p_branch VARCHAR(20),p_month INT,p_year INT)
RETURNS VARCHAR(500) CHARACTER SET utf8mb4
NOT DETERMINISTIC READS SQL DATA SQL SECURITY DEFINER
BEGIN
 DECLARE v_done BOOLEAN DEFAULT FALSE;
 DECLARE v_net DECIMAL(12,2);
 DECLARE v_discount DECIMAL(12,2);
 DECLARE v_total_net DECIMAL(19,2) DEFAULT 0;
 DECLARE v_total_discount DECIMAL(19,2) DEFAULT 0;
 DECLARE v_with INT DEFAULT 0;
 DECLARE v_without INT DEFAULT 0;
 DECLARE v_label VARCHAR(100);
 DECLARE cur_orders CURSOR FOR SELECT Thanh_tien,So_tien_giam FROM HOA_DON
  WHERE Ma_CN=p_branch AND Trang_thai='HOAN_TAT' AND MONTH(Ngay_tao)=p_month AND YEAR(Ngay_tao)=p_year;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
 IF p_branch IS NULL OR NOT EXISTS(SELECT 1 FROM CHI_NHANH WHERE Ma_CN=p_branch) THEN RETURN 'Lỗi tham số: Chi nhánh không tồn tại.'; END IF;
 IF p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 THEN RETURN 'Lỗi tham số: Tháng phải từ 1 đến 12.'; END IF;
 IF p_year IS NULL OR p_year NOT BETWEEN 2020 AND 2100 THEN RETURN 'Lỗi tham số: Năm phải từ 2020 đến 2100.'; END IF;
 OPEN cur_orders;
 read_orders: LOOP
  FETCH cur_orders INTO v_net,v_discount;
  IF v_done THEN LEAVE read_orders; END IF;
  SET v_total_net=v_total_net+v_net;
  SET v_total_discount=v_total_discount+v_discount;
  IF v_discount>0 THEN SET v_with=v_with+1; ELSE SET v_without=v_without+1; END IF;
 END LOOP;
 CLOSE cur_orders;
 IF v_with+v_without=0 THEN RETURN CONCAT('Chi nhánh ',p_branch,' không phát sinh hóa đơn hoàn tất trong tháng ',p_month,'/',p_year,'.'); END IF;
 IF v_total_discount>v_total_net*0.25 THEN SET v_label='Mức độ trợ giá CAO (>25% doanh thu thực)';
 ELSEIF v_total_discount>0 THEN SET v_label='Mức độ trợ giá HỢP LÝ (<=25% doanh thu thực)';
 ELSE SET v_label='Không tốn ngân sách trợ giá'; END IF;
 RETURN CONCAT('CN ',p_branch,' (',p_month,'/',p_year,'): Đơn có Voucher = ',v_with,', Đơn thường = ',v_without,
  ' | Doanh thu thực = ',CAST(v_total_net AS DECIMAL(19,0)),'đ | Trợ giá = ',CAST(v_total_discount AS DECIMAL(19,0)),'đ (',v_label,')');
END$$
DELIMITER ;
