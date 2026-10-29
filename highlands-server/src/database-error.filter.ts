import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { RequestError } from 'mssql';

@Catch(RequestError)
export class DatabaseErrorFilter implements ExceptionFilter {
  catch(error: RequestError, host: ArgumentsHost) {
    let status = 400;
    const number = error.number ?? 0;
    let message = 'Không thực hiện được thao tác dữ liệu.';
    if (number >= 51000 && number < 52000) {
      message = error.message;
      if ([51018, 51126].includes(number)) status = 404;
      if ([51005, 51017, 51020, 51021, 51108, 51111].includes(number))
        status = 409;
    } else if ([2601, 2627].includes(number)) {
      status = 409;
      message = 'Mã hoặc tên đã tồn tại. Hãy dùng một giá trị khác.';
    } else if (error.number === 547) {
      status = 409;
      message = error.message.includes('CHK_KhachHang_Diem')
        ? 'Số dư điểm không đủ. Giao dịch đã được hủy.'
        : 'Thao tác vi phạm dữ liệu liên kết hoặc miền giá trị. Kiểm tra danh mục, kích thước và lịch sử giao dịch.';
    } else if (error.code === 'ETIMEOUT' || error.code === 'ECONNCLOSED') {
      status = 503;
      message = 'SQL Server chưa phản hồi. Vui lòng thử lại.';
    } else if (error.number === 1205) {
      status = 409;
      message =
        'Dữ liệu vừa được thay đổi đồng thời. Vui lòng thử lại thao tác.';
    } else {
      status = 503;
      message =
        'Cơ sở dữ liệu chưa sẵn sàng hoặc chưa cài đầy đủ script. Kiểm tra cấu hình và chạy db:init.';
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message, sqlNumber: error.number });
  }
}
