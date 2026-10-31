import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseError } from './database.service';
@Catch(DatabaseError)
export class DatabaseErrorFilter implements ExceptionFilter {
  catch(error: DatabaseError, host: ArgumentsHost) {
    let status = 400,
      message = 'Không thực hiện được thao tác dữ liệu.';
    const number = error.errno;
    if (number >= 51000 && number < 52000) {
      message = error.message;
      if ([51018, 51126].includes(number)) status = 404;
      if ([51005, 51017, 51020, 51021, 51108, 51111].includes(number))
        status = 409;
    } else if (number === 1062) {
      status = 409;
      message = 'Mã hoặc tên đã tồn tại. Hãy dùng giá trị khác.';
    } else if ([1451, 1452, 3819, 1048, 1264, 1406].includes(number)) {
      status = 409;
      message =
        'Dữ liệu vi phạm liên kết hoặc miền giá trị. Kiểm tra danh mục, kích thước và lịch sử giao dịch.';
    } else if ([1205, 1213].includes(number)) {
      status = 409;
      message = 'Dữ liệu đang thay đổi đồng thời. Vui lòng thử lại thao tác.';
    } else {
      status = 503;
      message =
        'MySQL chưa sẵn sàng. Kiểm tra Docker, cấu hình và khởi tạo cơ sở dữ liệu.';
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message, sqlNumber: number });
  }
}
