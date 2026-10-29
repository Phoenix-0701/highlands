import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(
  path.join(root, "highlands-server", "package.json"),
);
const sql = require("mssql");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  throw new Error("Chưa có .env. Chạy npm run setup trước.");
}
if (process.env.DB_NAME !== "HighlandsCoffeeDB")
  throw new Error("Các script BTL2 sử dụng DB_NAME=HighlandsCoffeeDB.");
const config = {
  server: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 1433),
  user: "sa",
  password: process.env.MSSQL_SA_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
  connectionTimeout: 8000,
  requestTimeout: 120000,
  pool: { max: 1, min: 0 },
};
let pool;
try {
  const mode = process.argv[2];
  if (!["init", "check", "update"].includes(mode))
    throw new Error("Chọn init, update hoặc check.");
  pool = await new sql.ConnectionPool({
    ...config,
    database: "master",
  }).connect();
  if (mode === "init")
    await pool
      .request()
      .batch(
        "IF DB_ID(N'HighlandsCoffeeDB') IS NULL EXEC(N'CREATE DATABASE HighlandsCoffeeDB');",
      );
  await pool.close();
  pool = await new sql.ConnectionPool({
    ...config,
    database: "HighlandsCoffeeDB",
  }).connect();
  if (mode === "init") {
    const existing = await pool
      .request()
      .query("SELECT OBJECT_ID('dbo.SAN_PHAM') id");
    if (existing.recordset[0].id)
      throw new Error(
        "CSDL đã có bảng. db:init không ghi đè dữ liệu hiện có. Dùng db:check để kiểm tra.",
      );
  }
  const files =
    mode === "init"
      ? [
          "01-schema.sql",
          "02-procedures.sql",
          "03-triggers.sql",
          "04-functions.sql",
          "05-seed.sql",
        ]
      : mode === "update"
        ? ["02-procedures.sql", "03-triggers.sql", "04-functions.sql"]
        : ["06-checks.sql"];
  for (const name of files) {
    const content = await fs.readFile(
      path.join(root, "database", name),
      "utf8",
    );
    const batches = content.split(/^\s*GO\s*(?:--[^\r\n]*)?\r?$/gim);
    let index = 0;
    for (const batch of batches) {
      index++;
      if (
        !batch.trim() ||
        (name === "01-schema.sql" && /CREATE DATABASE/.test(batch))
      )
        continue;
      try {
        const result = await pool.request().batch(batch);
        if (mode === "check") {
          for (const rows of result.recordsets ?? []) {
            if (!rows.length) continue;
            if (Object.hasOwn(rows[0], "Ket_qua")) {
              for (const row of rows) console.log(row.Ket_qua);
            } else if (Object.hasOwn(rows[0], "Bang")) console.table(rows);
            else
              console.log(`Đã gọi truy vấn/hàm: ${rows.length} dòng kết quả.`);
          }
        }
      } catch (error) {
        throw new Error(`${name}, batch ${index}: ${error.message}`);
      }
    }
    console.log(`OK ${name}`);
  }
  if (mode === "init") {
    // Passwords are supplied as typed parameters, never placed on a command line or logged.
    await pool
      .request()
      .input("login", sql.NVarChar(128), process.env.DB_USER)
      .input("password", sql.NVarChar(128), process.env.DB_PASSWORD).batch(`
   IF SUSER_ID(@login) IS NULL
   BEGIN
    DECLARE @create NVARCHAR(MAX)=N'CREATE LOGIN '+QUOTENAME(@login)+N' WITH PASSWORD='+QUOTENAME(@password,'''')+N', CHECK_POLICY=ON;';
    EXEC(@create);
   END;
   IF DATABASE_PRINCIPAL_ID(@login) IS NULL
   BEGIN
    DECLARE @user NVARCHAR(MAX)=N'CREATE USER '+QUOTENAME(@login)+N' FOR LOGIN '+QUOTENAME(@login)+N';'; EXEC(@user);
   END;
   IF DATABASE_PRINCIPAL_ID('highlands_application') IS NULL CREATE ROLE highlands_application;
   DECLARE @member NVARCHAR(MAX)=N'ALTER ROLE highlands_application ADD MEMBER '+QUOTENAME(@login)+N';'; EXEC(@member);
   GRANT SELECT ON SCHEMA::dbo TO highlands_application;
   DENY INSERT,UPDATE,DELETE ON SCHEMA::dbo TO highlands_application;
   GRANT EXECUTE ON dbo.sp_InsertSanPham TO highlands_application;
   GRANT EXECUTE ON dbo.sp_UpdateSanPham TO highlands_application;
   GRANT EXECUTE ON dbo.sp_DeleteSanPham TO highlands_application;
   GRANT EXECUTE ON dbo.sp_TimKiemSanPham_Menu TO highlands_application;
   GRANT EXECUTE ON dbo.sp_ThongKeDoanhThuSanPham TO highlands_application;
   GRANT EXECUTE ON dbo.sp_DoiVoucher TO highlands_application;
   GRANT EXECUTE ON dbo.sp_ChuyenTrangThaiHoaDon TO highlands_application;
   GRANT EXECUTE ON dbo.fn_TinhDiemThuongChuoiLua TO highlands_application;
   GRANT EXECUTE ON dbo.fn_PhanTichGiaTriUuDaiChiNhanh TO highlands_application;
  `);
    console.log(
      "Đã tạo tài khoản ứng dụng: chỉ đọc và gọi thủ tục, không DML trực tiếp. Chạy npm run db:check.",
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}
