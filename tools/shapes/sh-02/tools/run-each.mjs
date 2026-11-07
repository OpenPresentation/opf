// node run-each.mjs <package dir> <log> [concurrency]: every test command of a package (run-tests --list), file by file, continuing past failures.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
const [dir, log, concurrency = '3'] = process.argv.slice(2);
const list = execFileSync(process.execPath, ['C:/opf-work/sh-02-shape-block/scripts/run-tests.mjs', '--list'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const out = fs.createWriteStream(log);
const failed = [];
let next = 0;
async function worker() {
  while (next < list.length) {
    const line = list[next++];
    const args = line.split(' ').slice(1);
    const started = Date.now();
    const code = await new Promise(resolve => {
      const child = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, OPF_AGENT_SLOTS: '0' } });
      let text = '';
      child.stdout.on('data', chunk => { text += chunk; });
      child.stderr.on('data', chunk => { text += chunk; });
      const timer = setTimeout(() => child.kill(), 900000);
      child.on('close', status => { clearTimeout(timer); if (status !== 0) out.write(`\n===== FAILED ${line}\n${text.slice(-6000)}\n`); resolve(status); });
    });
    out.write(`${code === 0 ? 'ok  ' : 'FAIL'} ${line} (${((Date.now() - started) / 1000).toFixed(1)} s)\n`);
    if (code !== 0) failed.push(line);
  }
}
await Promise.all(Array.from({ length: Number(concurrency) }, worker));
out.write(`\nDONE ${list.length} commands, ${failed.length} failed:\n${failed.join('\n')}\n`);
out.end();
console.log(`${list.length} commands, ${failed.length} failed`);
