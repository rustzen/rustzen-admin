import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const env = {
  ...process.env,
  HOME: "/tmp/rustzen-cloud-preview-home",
  RUSTZEN_RUNTIME_ROOT: "/tmp/rustzen-cloud-preview-runtime",
  RUST_LOG: "info",
};

const definitions = [
  ["target/debug/rz-admin", ["serve"], root],
  ["target/debug/rz-monitor", ["controller"], root],
  ["target/debug/rz-insights", ["serve"], root],
  ["target/debug/rz-reports", ["serve"], root],
  [
    process.execPath,
    ["node_modules/vite-plus/bin/vp", "dev", ...process.argv.slice(2)],
    `${root}/apps/web`,
  ],
];

const children = definitions.map(([command, args, cwd]) => {
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    console.error(`${command} exited (code=${code}, signal=${signal})`);
  });
  return child;
});

function stop() {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
