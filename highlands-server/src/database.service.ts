import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private connecting?: Promise<sql.ConnectionPool>;

  async pool(): Promise<sql.ConnectionPool> {
    if (!process.env.DB_PASSWORD) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình SQL Server. Chạy npm run setup, npm run db:up và npm run db:init tại thư mục gốc.',
      );
    }
    if (!this.connecting) {
      const pool = new sql.ConnectionPool({
        server: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 1433),
        database: process.env.DB_NAME ?? 'HighlandsCoffeeDB',
        user: process.env.DB_USER ?? 'highlands_app',
        password: process.env.DB_PASSWORD,
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate:
            process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
          enableArithAbort: true,
        },
        pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
        connectionTimeout: 5000,
        requestTimeout: 15000,
      });
      pool.on('error', () => {
        this.connecting = undefined;
      });
      this.connecting = pool.connect().catch(() => {
        this.connecting = undefined;
        throw new ServiceUnavailableException(
          'Không kết nối được SQL Server. Kiểm tra Docker, tệp .env và trạng thái khởi tạo cơ sở dữ liệu.',
        );
      });
    }
    return this.connecting;
  }

  async onApplicationShutdown() {
    if (this.connecting)
      await this.connecting.then((pool) => pool.close()).catch(() => undefined);
  }
}
