import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = path.join(root, ".env");
const backup = path.join(
  root,
  "docs/archive/private-backups",
  "sqlserver-before-mysql",
);
const password = () => `Hc!${randomBytes(24).toString("hex")}`;
if (
  fs.existsSync(env) &&
  !/^DB_ENGINE=mysql\s*$/m.test(fs.readFileSync(env, "utf8"))
) {
  fs.mkdirSync(backup, { recursive: true });
  for (const [source, name] of [
    [env, "legacy.env"],
    [path.join(root, "highlands-server", ".env"), "legacy-server.env"],
  ]) {
    if (fs.existsSync(source) && !fs.existsSync(path.join(backup, name)))
      fs.copyFileSync(
        source,
        path.join(backup, name),
        fs.constants.COPYFILE_EXCL,
      );
  }
  const previous = fs.readFileSync(env, "utf8");
  const value = (key, fallback) =>
    previous.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1].trim() || fallback;
  fs.writeFileSync(
    env,
    `DB_ENGINE=mysql\nMYSQL_ROOT_PASSWORD=${password()}\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_NAME=HighlandsCoffeeDB\nDB_USER=highlands_app\nDB_PASSWORD=${password()}\nPORT=${value("PORT", "3001")}\nFRONTEND_ORIGIN=${value("FRONTEND_ORIGIN", "http://localhost:3000")}\nBACKEND_URL=${value("BACKEND_URL", "http://127.0.0.1:3001")}\n`,
  );
  console.log(
    "Đã sao lưu cấu hình SQL Server và chuyển .env sang MySQL, cổng 3306.",
  );
} else if (!fs.existsSync(env)) {
  fs.writeFileSync(
    env,
    `DB_ENGINE=mysql\nMYSQL_ROOT_PASSWORD=${password()}\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_NAME=HighlandsCoffeeDB\nDB_USER=highlands_app\nDB_PASSWORD=${password()}\nPORT=3001\nFRONTEND_ORIGIN=http://localhost:3000\nBACKEND_URL=http://127.0.0.1:3001\n`,
    { flag: "wx" },
  );
  console.log("Đã tạo cấu hình MySQL với hai mật khẩu riêng.");
} else console.log("Giữ nguyên cấu hình MySQL hiện có.");
fs.copyFileSync(env, path.join(root, "highlands-server", ".env"));
const client = path.join(root, "highlands-client", ".env.local");
if (!fs.existsSync(client))
  fs.writeFileSync(client, "BACKEND_URL=http://127.0.0.1:3001\n", {
    flag: "wx",
  });
console.log(
  "Cấu hình sẵn sàng: db:up rồi db:init (DB mới) hoặc db:migrate (dữ liệu SQL Server đã sao lưu).",
);
