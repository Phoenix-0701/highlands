import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const localAppData =
  process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
const candidates = [
  process.env.DOCKER_BIN,
  "docker",
  ...(process.platform === "win32"
    ? [
        path.join(
          localAppData,
          "Programs",
          "DockerDesktop",
          "resources",
          "bin",
          "docker.exe",
        ),
        path.join(
          process.env.ProgramFiles ?? "C:\\Program Files",
          "Docker",
          "Docker",
          "resources",
          "bin",
          "docker.exe",
        ),
      ]
    : []),
].filter(Boolean);
const binary = candidates.find((candidate) => {
  if (candidate !== "docker" && !existsSync(candidate)) return false;
  return (
    spawnSync(candidate, ["--version"], { windowsHide: true, stdio: "ignore" })
      .status === 0
  );
});
if (!binary) {
  console.error(
    "Không tìm thấy Docker CLI. Mở Docker Desktop và mở lại terminal sau khi cài đặt.",
  );
  process.exitCode = 1;
} else {
  const child = spawn(binary, process.argv.slice(2), {
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", () => {
    console.error("Không chạy được Docker CLI.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
