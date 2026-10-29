import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = path.join(root, ".env");
if (!fs.existsSync(env)) {
  const password = () => `Hc!${randomBytes(24).toString("hex")}`;
  fs.writeFileSync(
    env,
    `MSSQL_SA_PASSWORD=${password()}\nDB_HOST=127.0.0.1\nDB_PORT=1433\nDB_NAME=HighlandsCoffeeDB\nDB_USER=highlands_app\nDB_PASSWORD=${password()}\nDB_ENCRYPT=false\nDB_TRUST_SERVER_CERTIFICATE=true\nPORT=3001\nFRONTEND_ORIGIN=http://localhost:3000\nBACKEND_URL=http://127.0.0.1:3001\n`,
    { flag: "wx" },
  );
  console.log("Đã tạo .env với hai mật khẩu ngẫu nhiên riêng biệt.");
} else console.log("Giữ nguyên .env hiện có.");
const server = path.join(root, "highlands-server", ".env");
if (!fs.existsSync(server))
  fs.copyFileSync(env, server, fs.constants.COPYFILE_EXCL);
const client = path.join(root, "highlands-client", ".env.local");
if (!fs.existsSync(client))
  fs.writeFileSync(client, "BACKEND_URL=http://127.0.0.1:3001\n", {
    flag: "wx",
  });
console.log(
  "Cấu hình sẵn sàng. Chạy npm run db:up rồi npm run db:init. Không xóa Docker volume nếu muốn giữ dữ liệu.",
);
