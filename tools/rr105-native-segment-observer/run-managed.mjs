import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const out = path.resolve("artifacts/segment-observer");
fs.mkdirSync(out, { recursive: true });
const attempt = process.argv[2] ?? "managed01";
if (!/^managed\d+$/u.test(attempt)) throw Error("Named fresh attempt required");
const target = path.join(out, attempt);
if (fs.existsSync(target)) throw Error("Fresh managed output required");
const env = {
  ...process.env,
  PSModulePath: [
    path.join(process.env.ProgramFiles, "WindowsPowerShell/Modules"),
    path.join(
      process.env.SystemRoot,
      "system32/WindowsPowerShell/v1.0/Modules",
    ),
  ].join(";"),
};
const args = [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  path.resolve("tools/rr105-native-segment-observer/managed.ps1"),
  "-Worker",
  path.resolve("tools/rr105-native-segment-observer/segment-worker.ps1"),
  "-Output",
  target,
];
const startedAt = new Date().toISOString();
const r = spawnSync(
  path.join(
    process.env.SystemRoot,
    "System32/WindowsPowerShell/v1.0/powershell.exe",
  ),
  args,
  { env, encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
);
fs.writeFileSync(path.join(out, attempt + ".stdout.log"), r.stdout ?? "", {
  flag: "wx",
});
fs.writeFileSync(path.join(out, attempt + ".stderr.log"), r.stderr ?? "", {
  flag: "wx",
});
const record = {
  startedAt,
  finishedAt: new Date().toISOString(),
  status: r.status,
  signal: r.signal,
  error: r.error ? { code: r.error.code, message: r.error.message } : null,
  officeInvoked: false,
  arguments: args,
};
fs.writeFileSync(
  path.join(out, attempt + ".exit.json"),
  JSON.stringify(record, null, 2) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify(record));
console.log(r.stdout);
console.error(r.stderr);
process.exitCode = r.status ?? 1;
