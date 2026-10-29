import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(root, ".env"));
const require = createRequire(
  path.join(root, "highlands-server", "package.json"),
);
const sql = require("mssql");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000/api";
async function request(route, status = 200, options) {
  const response = await fetch(`${base}/${route}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(
      `${route}: HTTP ${response.status}, phản hồi không phải JSON. Kiểm tra FE/BE đã khởi động xong.`,
    );
  }
  assert.equal(response.status, status, `${route}: ${JSON.stringify(body)}`);
  return body;
}
let pool;
const created = new Set();
try {
  const health = await request("health");
  assert.equal(health.connected, true);
  assert.equal(health.tableCount, 18);
  const products = await request("products");
  assert.equal(new Set(products.map((p) => p.Ma_SP)).size, products.length);
  assert(products.length >= 10);
  assert(
    products.every(
      (p) => Array.isArray(p.Danh_muc) && Array.isArray(p.Bang_gia),
    ),
  );
  const search = await request("products?search=SP03");
  assert.equal(search.length, 1);
  assert.equal(search[0].Ma_SP, "SP03");
  assert.equal(
    (await request("products?category=DM01&sort=GIA_ASC")).length,
    2,
  );
  assert.equal((await request("products?type=BANH_NGOT")).length, 5);
  assert.equal(
    (
      await request(
        `products?search=${encodeURIComponent("'; DROP TABLE SAN_PHAM;--")}`,
      )
    ).length,
    0,
  );
  console.log(
    "PASS: FE proxy -> NestJS -> SQL Server, menu, filters, typed search parameters",
  );

  for (const type of ["BANH_NGOT", "MON_NUOC"]) {
    const id = `SP${Date.now()}`;
    const data = {
      Ma_SP: id,
      Ten_SP: `Món kiểm thử tích hợp ${id}`,
      Loai_SP: type,
      Trang_thai: "Đang bán",
      Mo_ta: "Dữ liệu kiểm thử tạm thời",
      Danh_muc: type === "MON_NUOC" ? ["DM01", "DM05"] : ["DM04"],
      Bang_gia:
        type === "MON_NUOC"
          ? [
              { Ma_size: "S", Gia_ban: 29000 },
              { Ma_size: "M", Gia_ban: 39000 },
            ]
          : [],
      Don_gia: type === "BANH_NGOT" ? 35000 : null,
    };
    await request("products", 201, {
      method: "POST",
      body: JSON.stringify(data),
    });
    created.add(id);
    const inserted = (await request(`products?search=${id}`))[0];
    assert.equal(inserted.Ten_SP, data.Ten_SP);
    assert.equal(inserted.Danh_muc.length, data.Danh_muc.length);
    data.Ten_SP += " đã sửa";
    data.Trang_thai = "Hết hàng";
    if (type === "BANH_NGOT") data.Don_gia = 39000;
    else data.Bang_gia[0].Gia_ban = 31000;
    await request(`products/${id}`, 200, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const updated = (await request(`products?search=${id}`))[0];
    assert.equal(updated.Trang_thai, "Hết hàng");
    assert.equal(updated.Ten_SP, data.Ten_SP);
    assert.equal(updated.Gia_tu, type === "BANH_NGOT" ? 39000 : 31000);
    await request("products", 409, {
      method: "POST",
      body: JSON.stringify(data),
    });
    await request(`products/${id}`, 200, { method: "DELETE" });
    created.delete(id);
    assert.equal((await request(`products?search=${id}`)).length, 0);
  }
  const blocked = await request("products/SP03", 409, { method: "DELETE" });
  assert.match(blocked.message, /hóa đơn/);
  await request("products?minPrice=50000&maxPrice=10000", 400);
  await request("reports/revenue?from=2026-10-31&to=2026-10-01", 400);
  console.log(
    "PASS: real procedure CRUD for cakes/drinks, multi-category/size, duplicate and protected-delete errors",
  );

  const sales = await request(
    "reports/revenue?from=2026-10-01&to=2026-10-31&minQuantity=1&minRevenue=0",
  );
  assert(sales.length > 0);
  assert(sales.reduce((sum, row) => sum + row.Tong_doanh_thu_mon, 0) >= 518000);
  const streak = await request(
    "reports/streak?customer=KH01&from=2026-10-01&to=2026-10-31",
  );
  assert.match(streak.result, /Chuỗi lửa dài nhất/);
  const discount = await request(
    "reports/discount?branch=CN01&month=10&year=2026",
  );
  assert.match(discount.result, /Doanh thu thực/);
  assert((await request("orders")).length >= 12);
  const loyalty = await request("loyalty/KH01");
  assert(loyalty.history.length >= 3 && loyalty.vouchers.length >= 1);
  console.log(
    "PASS: aggregate report, both cursor functions, orders and loyalty read from SQL Server",
  );

  pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
  }).connect();
  const permissions = await pool
    .request()
    .query(
      "SELECT IS_SRVROLEMEMBER('sysadmin') sysadmin, HAS_PERMS_BY_NAME('dbo.SAN_PHAM','OBJECT','INSERT') canInsert, HAS_PERMS_BY_NAME('dbo.sp_InsertSanPham','OBJECT','EXECUTE') canExecute",
    );
  assert.equal(permissions.recordset[0].sysadmin, 0);
  assert.equal(permissions.recordset[0].canInsert, 0);
  assert.equal(permissions.recordset[0].canExecute, 1);
  await assert.rejects(
    pool.request().query("UPDATE dbo.SAN_PHAM SET Ten_SP=Ten_SP WHERE 1=0"),
    (error) => error.number === 229,
  );
  console.log(
    "PASS: application login is not sa/sysadmin, direct DML denied, procedure execution allowed",
  );
  console.log("ALL INTEGRATION CHECKS PASSED");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const id of created) {
    try {
      await request(`products/${id}`, 200, { method: "DELETE" });
    } catch {
      console.error(`Cần dọn sản phẩm kiểm thử ${id}.`);
      process.exitCode = 1;
    }
  }
  if (pool) await pool.close();
}
