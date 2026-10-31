import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const mysql = createRequire(
  path.join(root, "highlands-server/package.json"),
)("mysql2/promise");
export function config(admin = false) {
  process.loadEnvFile(path.join(root, ".env"));
  if (process.env.DB_ENGINE !== "mysql")
    throw new Error("Chạy npm run setup để cấu hình MySQL.");
  if (process.env.DB_NAME !== "HighlandsCoffeeDB")
    throw new Error("Bộ script BTL2 sử dụng DB_NAME=HighlandsCoffeeDB.");
  return {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? "HighlandsCoffeeDB",
    user: admin ? "root" : process.env.DB_USER,
    password: admin ? process.env.MYSQL_ROOT_PASSWORD : process.env.DB_PASSWORD,
    charset: "utf8mb4_0900_ai_ci",
    timezone: "Z",
    decimalNumbers: true,
    connectTimeout: 8000,
    multipleStatements: false,
  };
}
// DELIMITER is a client directive, not SQL. Each routine is sent as one statement.
export function splitSql(source) {
  let delimiter = ";",
    buffer = "";
  const out = [];
  for (const line of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const directive = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (directive) {
      if (buffer.trim() && !/^(\s*--[^\n]*(\n|$))*\s*$/.test(buffer))
        throw new Error("DELIMITER giữa câu SQL.");
      buffer = "";
      delimiter = directive[1];
      continue;
    }
    buffer += line + "\n";
    if (line.trimEnd().endsWith(delimiter)) {
      const sql = buffer.trimEnd().slice(0, -delimiter.length).trim();
      if (sql) out.push(sql);
      buffer = "";
    }
  }
  if (buffer.trim() && !/^(\s*--[^\n]*(\n|$))*\s*$/.test(buffer))
    throw new Error("SQL thiếu dấu kết thúc câu.");
  return out;
}
