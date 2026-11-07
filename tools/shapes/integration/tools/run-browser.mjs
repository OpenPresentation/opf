// Runs the browser suites of one package (test/browser-suites.json) file by file: each suite's setup once, then every test
// command on its own, N at a time, logging each. node run-browser.mjs <package dir> <log dir> [concurrency] [suite filter] [test filter]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [dir, logDir, conc = '2', suiteFilter, testFilter] = process.argv.slice(2);
const suites = JSON.parse(readFileSync(path.join(dir, 'test/browser-suites.json'), 'utf8')).suites;
mkdirSync(logDir, { recursive: true });
const sh = (command, log) => new Promise((resolve) => {
  const t = Date.now();
  const child = spawn(command, { cwd: dir, shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const timer = setTimeout(() => child.kill(), 20 * 60 * 1000);
  child.on('close', (code) => { clearTimeout(timer); writeFileSync(log, out); resolve({ code, ms: Date.now() - t }); });
});
const results = [];
const setupsDone = new Set();
for (const [name, suite] of Object.entries(suites)) {
  if (suiteFilter && !new RegExp(suiteFilter).test(name)) continue;
  for (const command of suite.setup ?? []) {
    if (setupsDone.has(command)) continue;
    setupsDone.add(command);
    const r = await sh(command, path.join(logDir, `setup-${setupsDone.size}.log`));
    console.log(`${r.code === 0 ? 'ok  ' : 'FAIL'} setup ${command}`);
  }
  const tests = suite.tests.filter((test) => !testFilter || new RegExp(testFilter).test(test.id));
  let next = 0;
  await Promise.all(Array.from({ length: Number(conc) }, async () => {
    while (next < tests.length) {
      const test = tests[next++];
      const r = await sh(test.command, path.join(logDir, `${test.id.replace(/[^a-z0-9-]+/gi, '_')}.log`));
      results.push({ id: test.id, ...r });
      console.log(`${r.code === 0 ? 'ok  ' : 'FAIL'} ${(r.ms / 1000).toFixed(0)}s ${name} ${test.id}`);
    }
  }));
}
const failed = results.filter((r) => r.code !== 0);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
for (const f of failed) console.log('FAILED', f.id);
