import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';

export class DatabaseError extends Error {
  constructor(
    readonly errno: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private connectionPool?: Pool;
  private pool(): Pool {
    if (!process.env.DB_PASSWORD || process.env.DB_ENGINE !== 'mysql') {
      throw new ServiceUnavailableException(
        'Chưa cấu hình MySQL. Chạy npm run setup tại thư mục gốc.',
      );
    }
    this.connectionPool ??= createPool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME ?? 'HighlandsCoffeeDB',
      user: process.env.DB_USER ?? 'highlands_app',
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4_0900_ai_ci',
      timezone: 'Z',
      decimalNumbers: true,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 100,
      connectTimeout: 5000,
      multipleStatements: false,
    });
    return this.connectionPool;
  }
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: (string | number | null)[] = [],
  ): Promise<T[]> {
    try {
      const [rows] = await this.pool().execute<RowDataPacket[]>(sql, params);
      return rows as T[];
    } catch (e) {
      this.rethrow(e);
    }
  }
  async call(
    name: string,
    params: unknown[] = [],
  ): Promise<Record<string, unknown>[]> {
    if (!/^sp_[A-Za-z0-9_]+$/.test(name))
      throw new Error('Tên thủ tục không hợp lệ.');
    try {
      const [sets] = await this.pool().query(
        `CALL ${name}(${params.map(() => '?').join(',')})`,
        params,
      );
      const rows = sets as unknown as unknown[];
      return Array.isArray(rows[0])
        ? (rows[0] as Record<string, unknown>[])
        : [];
    } catch (e) {
      this.rethrow(e);
    }
  }
  private rethrow(error: unknown): never {
    if (error instanceof ServiceUnavailableException) throw error;
    const e = error as { errno?: number; code?: string; sqlMessage?: string };
    throw new DatabaseError(
      e.errno ?? 0,
      e.code ?? '',
      e.sqlMessage ?? 'Không kết nối được MySQL. Kiểm tra Docker và cấu hình.',
    );
  }
  async onApplicationShutdown() {
    if (this.connectionPool) await this.connectionPool.end();
  }
}
