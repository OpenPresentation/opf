// Parallel run of one package's suite: the commands `scripts/run-tests.mjs --list` prints, N at a time, never stopping at a failure.
// usage: node ptest.mjs <package dir> [--only <regex>] [--jobs N]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2), dir = path.resolve(args[0]);
const opt = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const only = opt('--only') ? new RegExp(opt('--only')) : null, jobs = Number(opt('--jobs', 4));
const listed = spawnSync('node', [path.resolve(dir, '../../scripts/run-tests.mjs'), '--list'], { cwd: dir, encoding: 'utf8' });
if (listed.status !== 0) { console.error(listed.stderr); process.exit(2); }
let commands = listed.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
// The node:test batch is one command of many files: split it so the files spread over the workers.
commands = commands.flatMap((command) => { const parts = command.split(/\s+/); const files = parts.filter((part) => part.startsWith('test/')); return parts.includes('--test') && files.length > 1 ? files.map((file) => `node --test ${file}`) : [command]; });
if (only) commands = commands.filter((command) => only.test(command));
const failures = []; let next = 0, done = 0; const started = Date.now();
const logDir = path.join(process.env.PTEST_LOGS ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'ptest-logs'), path.basename(dir)); fs.mkdirSync(logDir, { recursive: true });
await Promise.all(Array.from({ length: jobs }, async () => {
  while (next < commands.length) {
    const command = commands[next++], parts = command.split(/\s+/).slice(1);
    const result = await new Promise((resolve) => { const child = spawn(process.execPath, parts, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; }); child.on('close', (code) => resolve({ code, out })); });
    done++;
    if (result.code !== 0) { const name = parts.at(-1).replace(/[^\w.-]/g, '_'); fs.writeFileSync(path.join(logDir, name + '.log'), result.out); failures.push(command); }
  }
}));
console.log(`${path.basename(dir)}: ${commands.length} commands, ${failures.length} failed, ${Math.round((Date.now() - started) / 1000)}s`);
for (const failure of failures.sort()) console.log('  FAIL ' + failure);
process.exit(failures.length ? 1 : 0);
