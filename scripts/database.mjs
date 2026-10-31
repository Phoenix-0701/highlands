import fs from "node:fs/promises";
import path from "node:path";
import { mysql, config, root, splitSql } from "./mysql.mjs";
const mode = process.argv[2];
const resumeEmpty = process.argv.includes("--resume-empty");
let db;
const tables = [
  "DANH_MUC",
  "KICH_THUOC",
  "SAN_PHAM",
  "SAN_PHAM_THUOC_DANH_MUC",
  "BANH_NGOT",
  "MON_NUOC",
  "CHON_SIZE",
  "TOPPING",
  "CHI_NHANH",
  "SDT_CN",
  "PTTT",
  "KHACH_HANG",
  "VOUCHER",
  "VOUCHER_CA_NHAN",
  "HOA_DON",
  "CHI_TIET_HOA_DON",
  "CHON_TOPPING",
  "LICH_SU_DIEM",
];
async function file(name) {
  const statements = splitSql(
    await fs.readFile(
      path.join(
        root,
        name === "06-checks.sql" ? "docs/testing/sql" : "database",
        name,
      ),
      "utf8",
    ),
  );
  for (let i = 0; i < statements.length; i++) {
    try {
      const [result] = await db.query(statements[i]);
      if (mode === "check") {
        const sets =
          Array.isArray(result) && Array.isArray(result[0]) ? result : [result];
        for (const rows of sets) {
          if (!Array.isArray(rows) || !rows.length) continue;
          if (Object.hasOwn(rows[0], "Ket_qua"))
            for (const row of rows) console.log(row.Ket_qua);
          else if (Object.hasOwn(rows[0], "Bang")) console.table(rows);
        }
      }
    } catch (e) {
      if (
        resumeEmpty &&
        name === "01-schema.sql" &&
        [1050, 1061].includes(e.errno)
      )
        continue;
      throw new Error(`${name}, statement ${i + 1}: ${e.message}`);
    }
  }
  console.log(`OK ${name}`);
}
async function provision() {
  const user = process.env.DB_USER;
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(user) || user === "root")
    throw new Error("DB_USER phải là tài khoản ứng dụng riêng.");
  const account = mysql.escape(user) + "@'%'";
  await db.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ?`, [
    process.env.DB_PASSWORD,
  ]);
  await db.query(`ALTER USER ${account} IDENTIFIED BY ?`, [
    process.env.DB_PASSWORD,
  ]);
  await db.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${account}`);
  await db.query(`GRANT SELECT ON HighlandsCoffeeDB.* TO ${account}`);
  for (const name of [
    "sp_InsertSanPham",
    "sp_UpdateSanPham",
    "sp_DeleteSanPham",
    "sp_TimKiemSanPham_Menu",
    "sp_ThongKeDoanhThuSanPham",
    "sp_DoiVoucher",
    "sp_ChuyenTrangThaiHoaDon",
  ])
    await db.query(
      `GRANT EXECUTE ON PROCEDURE HighlandsCoffeeDB.${name} TO ${account}`,
    );
  for (const name of [
    "fn_TinhDiemThuongChuoiLua",
    "fn_PhanTichGiaTriUuDaiChiNhanh",
  ])
    await db.query(
      `GRANT EXECUTE ON FUNCTION HighlandsCoffeeDB.${name} TO ${account}`,
    );
  console.log(
    "Tài khoản ứng dụng: SELECT và EXECUTE cần thiết; không có quyền ghi trực tiếp.",
  );
}
try {
  if (!["init", "migrate", "update", "check"].includes(mode))
    throw new Error("Chọn init, migrate, update hoặc check.");
  db = await mysql.createConnection(config(true));
  if (["init", "migrate"].includes(mode)) {
    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'",
    );
    if (count) {
      if (!resumeEmpty)
        throw new Error(
          "MySQL đã có bảng. Không ghi đè. Dùng db:update hoặc db:check.",
        );
      const [existing] = await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'",
      );
      for (const row of existing) {
        const name = row.TABLE_NAME ?? row.table_name;
        if (!tables.includes(name))
          throw new Error("Có bảng ngoài thiết kế; không tiếp tục.");
        const [[r]] = await db.query(
          `SELECT COUNT(*) count FROM ${mysql.escapeId(name)}`,
        );
        if (r.count)
          throw new Error("Có dữ liệu hiện có; không tiếp tục khởi tạo.");
      }
      console.log("Tiếp tục DDL đã chạy dở; mọi bảng hiện có đều rỗng.");
    }
    let snapshot;
    if (mode === "migrate") {
      snapshot = JSON.parse(
        await fs.readFile(
          path.join(
            root,
            "docs/archive/private-backups/sqlserver-before-mysql/data.json",
          ),
          "utf8",
        ),
      );
      if (
        tables.some((t) => !Array.isArray(snapshot.tables[t])) ||
        Object.keys(snapshot.tables).length !== 18
      )
        throw new Error("Bản sao lưu không đủ 18 bảng.");
    }
    await file("01-schema.sql");
    if (snapshot) {
      await db.beginTransaction();
      try {
        for (const name of tables) {
          const [columns] = await db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?",
            [name],
          );
          const allowed = new Set(
            columns.map((c) => c.COLUMN_NAME ?? c.column_name),
          );
          for (const row of snapshot.tables[name]) {
            const keys = Object.keys(row);
            if (keys.some((k) => !allowed.has(k)))
              throw new Error(`Cột không hợp lệ trong ${name}.`);
            const values = keys.map((k) =>
              typeof row[k] === "string" &&
              /^\d{4}-\d\d-\d\dT\d\d:\d\d:/.test(row[k])
                ? row[k].slice(0, 19).replace("T", " ")
                : row[k],
            );
            await db.query(
              `INSERT INTO ${mysql.escapeId(name)} (${keys.map(mysql.escapeId).join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
              values,
            );
          }
        }
        await db.commit();
      } catch (e) {
        await db.rollback();
        throw e;
      }
      console.log(
        "Đã chuyển dữ liệu 18 bảng từ SQL Server, giữ nguyên giá, tiền và lịch sử.",
      );
    }
    for (const name of [
      "02-procedures.sql",
      "03-triggers.sql",
      "04-functions.sql",
    ])
      await file(name);
    if (!snapshot) await file("05-seed.sql");
    await provision();
    if (snapshot) {
      for (const name of tables) {
        const [[{ count }]] = await db.query(
          `SELECT COUNT(*) count FROM ${mysql.escapeId(name)}`,
        );
        if (count !== snapshot.tables[name].length)
          throw new Error(`Số dòng ${name} chưa khớp.`);
      }
      console.log("Đối chiếu số dòng 18/18 bảng khớp bản sao lưu.");
    }
  } else if (mode === "update") {
    for (const name of [
      "02-procedures.sql",
      "03-triggers.sql",
      "04-functions.sql",
    ])
      await file(name);
    await provision();
  } else {
    await file("06-checks.sql");
    const { runDatabaseChecks } =
      await import("../docs/testing/check-database.mjs");
    await runDatabaseChecks(db);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
