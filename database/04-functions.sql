USE HighlandsCoffeeDB;
GO
-- HÀM 1: Tính điểm thưởng Chuỗi lửa tích điểm (Streak Bonus Drips)
CREATE OR ALTER FUNCTION fn_TinhDiemThuongChuoiLua
(
    @Ma_KH VARCHAR(20),
    @Tu_ngay DATE,
    @Den_ngay DATE
)
RETURNS NVARCHAR(500)
AS
BEGIN
    IF @Ma_KH IS NULL OR LTRIM(RTRIM(@Ma_KH)) = ''
        RETURN N'Lỗi tham số: Mã khách hàng không được để trống!';
    IF NOT EXISTS (SELECT 1 FROM KHACH_HANG WHERE Ma_KH = @Ma_KH)
        RETURN N'Lỗi tham số: Mã khách hàng "' + @Ma_KH + N'" không tồn tại trong hệ thống!';
    IF @Tu_ngay IS NULL OR @Den_ngay IS NULL OR @Tu_ngay > @Den_ngay
        RETURN N'Lỗi tham số: Khoảng thời gian (@Tu_ngay, @Den_ngay) không hợp lệ!';

    DECLARE @NgayGiaoDich DATE, @TongChiTieuNgay DECIMAL(12, 2);
    DECLARE @NgayTruoc DATE = NULL, @ChuoiHienTai INT = 0, @ChuoiDaiNhat INT = 0, @TongDiemBonus INT = 0;

    DECLARE cur_LichSuMua CURSOR LOCAL FAST_FORWARD FOR
        SELECT CAST(Ngay_tao AS DATE) AS NgayGD, SUM(Thanh_tien) AS TongChiNgay
        FROM HOA_DON
        WHERE Ma_KH = @Ma_KH AND Trang_thai = 'HOAN_TAT'
          AND CAST(Ngay_tao AS DATE) BETWEEN @Tu_ngay AND @Den_ngay
        GROUP BY CAST(Ngay_tao AS DATE)
        ORDER BY NgayGD ASC;

    OPEN cur_LichSuMua;
    FETCH NEXT FROM cur_LichSuMua INTO @NgayGiaoDich, @TongChiTieuNgay;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF @TongChiTieuNgay >= 50000
        BEGIN
            IF @NgayTruoc IS NOT NULL AND DATEDIFF(DAY, @NgayTruoc, @NgayGiaoDich) = 1
                SET @ChuoiHienTai = @ChuoiHienTai + 1;
            ELSE
                SET @ChuoiHienTai = 1;

            IF @ChuoiHienTai = 1 SET @TongDiemBonus = @TongDiemBonus + 2;
            ELSE IF @ChuoiHienTai = 2 SET @TongDiemBonus = @TongDiemBonus + 4;
            ELSE SET @TongDiemBonus = @TongDiemBonus + 8;

            IF @ChuoiHienTai > @ChuoiDaiNhat SET @ChuoiDaiNhat = @ChuoiHienTai;
            SET @NgayTruoc = @NgayGiaoDich;
        END
        ELSE
        BEGIN
            SET @ChuoiHienTai = 0;
            SET @NgayTruoc = NULL;
        END
        FETCH NEXT FROM cur_LichSuMua INTO @NgayGiaoDich, @TongChiTieuNgay;
    END

    CLOSE cur_LichSuMua;
    DEALLOCATE cur_LichSuMua;

    RETURN N'Khách hàng ' + @Ma_KH + N' | Chuỗi lửa dài nhất: ' + CAST(@ChuoiDaiNhat AS NVARCHAR(10)) 
         + N' ngày liên tiếp | Điểm thưởng Chuỗi lửa nhận thêm: +' + CAST(@TongDiemBonus AS NVARCHAR(10)) + N' Drips';
END;
GO

-- HÀM 2: Phân tích ngân sách trợ giá Voucher và hiệu quả doanh thu tại Chi nhánh
CREATE OR ALTER FUNCTION fn_PhanTichGiaTriUuDaiChiNhanh
(
    @Ma_CN VARCHAR(20),
    @Thang INT,
    @Nam INT
)
RETURNS NVARCHAR(500)
AS
BEGIN
    IF @Ma_CN IS NULL OR NOT EXISTS (SELECT 1 FROM CHI_NHANH WHERE Ma_CN = @Ma_CN)
        RETURN N'Lỗi tham số: Mã chi nhánh không hợp lệ hoặc không tồn tại!';
    IF @Thang IS NULL OR @Thang NOT BETWEEN 1 AND 12
        RETURN N'Lỗi tham số: Tháng phải nằm trong khoảng từ 1 đến 12!';
    IF @Nam IS NULL OR @Nam < 2020 OR @Nam > 2100
        RETURN N'Lỗi tham số: Năm thống kê không hợp lệ!';

    DECLARE @Ma_HD VARCHAR(20), @Tong_tien DECIMAL(12, 2), @So_tien_giam DECIMAL(12, 2), @Thanh_tien DECIMAL(12, 2);
    DECLARE @SoDonCoVoucher INT = 0, @SoDonKhongVoucher INT = 0;
    DECLARE @TongDoanhThuThuc DECIMAL(19, 2) = 0, @TongTienTroGia DECIMAL(19, 2) = 0;

    DECLARE cur_HoaDonCN CURSOR LOCAL FAST_FORWARD FOR
        SELECT Ma_HD, Tong_tien, So_tien_giam, Thanh_tien
        FROM HOA_DON
        WHERE Ma_CN = @Ma_CN AND Trang_thai = 'HOAN_TAT'
          AND MONTH(Ngay_tao) = @Thang AND YEAR(Ngay_tao) = @Nam;

    OPEN cur_HoaDonCN;
    FETCH NEXT FROM cur_HoaDonCN INTO @Ma_HD, @Tong_tien, @So_tien_giam, @Thanh_tien;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @TongDoanhThuThuc = @TongDoanhThuThuc + @Thanh_tien;
        SET @TongTienTroGia = @TongTienTroGia + @So_tien_giam;

        IF @So_tien_giam > 0 SET @SoDonCoVoucher = @SoDonCoVoucher + 1;
        ELSE SET @SoDonKhongVoucher = @SoDonKhongVoucher + 1;

        FETCH NEXT FROM cur_HoaDonCN INTO @Ma_HD, @Tong_tien, @So_tien_giam, @Thanh_tien;
    END

    CLOSE cur_HoaDonCN;
    DEALLOCATE cur_HoaDonCN;

    IF (@SoDonCoVoucher + @SoDonKhongVoucher) = 0
        RETURN N'Chi nhánh ' + @Ma_CN + N' không phát sinh hóa đơn hoàn tất nào trong tháng ' + CAST(@Thang AS NVARCHAR(2)) + N'/' + CAST(@Nam AS NVARCHAR(4)) + N'.';

    DECLARE @DanhGia NVARCHAR(100);
    IF @TongTienTroGia > (@TongDoanhThuThuc * 0.25)
        SET @DanhGia = N'Mức độ trợ giá CAO (>25% doanh thu thực)';
    ELSE IF @TongTienTroGia > 0
        SET @DanhGia = N'Mức độ trợ giá HỢP LÝ (<=25% doanh thu thực)';
    ELSE
        SET @DanhGia = N'Không tốn ngân sách trợ giá';

    RETURN N'CN ' + @Ma_CN + N' (' + CAST(@Thang AS NVARCHAR(2)) + N'/' + CAST(@Nam AS NVARCHAR(4)) + N'): '
         + N'Đơn có Voucher = ' + CAST(@SoDonCoVoucher AS NVARCHAR(10))
         + N', Đơn thường = ' + CAST(@SoDonKhongVoucher AS NVARCHAR(10))
         + N' | Doanh thu thực = ' + CONVERT(NVARCHAR(40),CAST(@TongDoanhThuThuc AS DECIMAL(18,0))) + N'đ'
         + N' | Trợ giá = ' + CONVERT(NVARCHAR(40),CAST(@TongTienTroGia AS DECIMAL(18,0))) + N'đ (' + @DanhGia + N')';
END;
GO
