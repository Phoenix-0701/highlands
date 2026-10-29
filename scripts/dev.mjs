import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobs = [
  [
    "highlands-server",
    "node_modules/@nestjs/cli/bin/nest.js",
    ["start", "--watch"],
  ],
  ["highlands-client", "node_modules/next/dist/bin/next", ["dev"]],
];
const children = jobs.map(([folder, entry, args]) =>
  spawn(process.execPath, [entry, ...args], {
    cwd: path.join(root, folder),
    stdio: "inherit",
    windowsHide: true,
  }),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) =>
  c.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  }),
);
