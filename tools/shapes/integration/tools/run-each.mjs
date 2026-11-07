// Runs every test command of one package file by file (from run-tests.mjs --list), N at a time, and prints a summary.
// node run-each.mjs <package dir> <log dir> [concurrency] [filter regex]
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [dir, logDir, conc = '4', filter] = process.argv.slice(2);
const root = path.resolve(dir, '../..');
const list = spawnSync(process.execPath, [path.join(root, 'scripts/run-tests.mjs'), '--list'], { cwd: dir, encoding: 'utf8' });
let commands = list.stdout.trim().split('\n').filter(Boolean);
if (filter) commands = commands.filter((line) => new RegExp(filter).test(line));
mkdirSync(logDir, { recursive: true });
const results = [];
let next = 0;
const started = Date.now();
async function worker() {
  while (next < commands.length) {
    const command = commands[next++];
    const args = command.split(' ').slice(1);
    const t = Date.now();
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, FORCE_COLOR: '0' } });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { out += d; });
      const timer = setTimeout(() => child.kill(), 30 * 60 * 1000);
      child.on('close', (c) => { clearTimeout(timer); writeFileSync(path.join(logDir, path.basename(args.at(-1)) + '.log'), out); resolve(c); });
    });
    results.push({ command, code, ms: Date.now() - t });
    process.stdout.write(`${code === 0 ? 'ok  ' : 'FAIL'} ${((Date.now() - t) / 1000).toFixed(0)}s ${command}\n`);
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
const failed = results.filter((r) => r.code !== 0);
console.log(`\n${results.length - failed.length}/${results.length} passed in ${((Date.now() - started) / 1000).toFixed(0)}s`);
for (const f of failed) console.log('FAILED', f.command);
