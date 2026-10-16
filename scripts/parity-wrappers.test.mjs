// Static controls plus Windows-only fake-command behavior; other hosts explicitly skip that unqualified execution.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
const directory = new URL('../docs/programs/font-fidelity-everywhere/gallery-support/parity/', import.meta.url);
const source = name => readFileSync(new URL(name, directory), 'utf8');
const checked = command => `${command}[^\\n]*\\n\\s*if \\(\\$LASTEXITCODE -ne 0\\) \\{ throw `;
test('Windows build checks each install before build, checks each build, and propagates failed jobs', () => {
  const build = source('build.ps1');
  assert.match(build, /\$ErrorActionPreference = "Stop"/);
  assert.match(build, /param\(\$T,\$S,\$L,\$Prefix\) \$ErrorActionPreference="Stop"/);
  assert.match(build, /param\(\$T,\$S,\$L,\$r,\$npm,\$Prefix\) \$ErrorActionPreference="Stop"/);
  assert.match(build, /install --frozen-lockfile[^;]*; if \(\$LASTEXITCODE -ne 0\) \{ throw "core install failed[^}]*\}; & pnpm.cmd -r --if-present build[^;]*; if \(\$LASTEXITCODE -ne 0\) \{ throw "core build failed/);
  assert.match(build, /ci --no-audit --no-fund[^;]*; if \(\$LASTEXITCODE -ne 0\) \{ throw "\$r install failed[^}]*\}; & node.exe \$npm run build[^;]*; if \(\$LASTEXITCODE -ne 0\) \{ throw "\$r build failed/);
  assert.match(build, /Wait-Job \| Out-Null[\s\S]*\$failed = @\(\$jobs \| Where-Object \{ \$_.State -ne 'Completed' \}\)/);
  assert.match(build, /Receive-Job -ErrorAction Continue\s+if \(\$failed.Count -gt 0\) \{ throw /);
  assert.match(build, /finally \{ \$jobs \| Remove-Job -Force \}/);
});
test('Windows run checks fetch, checkout, snippets and parity before proceeding to summary', () => {
  const run = source('run.ps1');
  assert.match(run, /\$ErrorActionPreference = "Stop"/);
  for (const command of ['& git -C \\$map\\[\\$k\\] fetch -q origin', '& git -c core.longpaths=true[^\\n]* checkout -q --detach origin/main', '& node.exe gen-snippets.mjs \\| Select-Object -Last 1', '& node.exe --import [^\\n]* parity.mjs']) {
    assert.match(run, new RegExp(checked(command)));
  }
  assert.ok(run.indexOf('throw "Parity measurement failed') < run.indexOf('$md ='));
  assert.match(run, /& "\$P\\build.ps1" -Prefix \$Prefix/);
  assert.match(run, /summarize.mjs \$Out \$md \}\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Parity summary failed/);
  assert.match(run, /finally \{ Pop-Location \}/);
  assert.match(run, /\[switch\]\$SkipSnippets/);
});

// Exercise the real maintained PowerShell control flow with disposable commands,
// never package managers, Git remotes or Office. This is deliberately not a
// PowerShell pass on hosts without Windows PowerShell.
const windows = process.platform === 'win32';
const behavior = async (t, mode, fail = '', options = []) => {
  const {mkdtemp, mkdir, writeFile, copyFile, readFile, rm} = await import('node:fs/promises');
  const {spawnSync} = await import('node:child_process');
  const path = await import('node:path');
  const base = path.join(process.env.SystemDrive ?? 'C:', 'opf-work');
  await mkdir(base, {recursive: true});
  const root = await mkdtemp(path.join(base, 'parity-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const parity = path.join(root, 'dimension-audit', 'parity');
  const scripts = path.join(parity, 'scripts');
  const toolchain = path.join(root, 'tools');
  const bin = path.join(toolchain, '.bin');
  const log = path.join(root, 'calls.jsonl');
  const output = path.join(parity, 'parity-results.json');
  for (const directory of [scripts, bin, ...['opf', 'opf-render', 'opf-pptx', 'pptx-gallery'].map(name => path.join(root, 'sources', `parity-${name}`))]) await mkdir(directory, {recursive: true});
  for (const name of ['build.ps1', 'run.ps1']) {
    const bytes = readFileSync(new URL(name, directory));
    await copyFile(new URL(name, directory), path.join(parity, name));
    assert.deepEqual(await readFile(path.join(parity, name)), bytes, 'Fixture executes exact maintained wrapper bytes.');
  }
  await writeFile(output, 'old measurement');
  await writeFile(path.join(parity, 'PARITY.md'), 'old summary');
  const fake = path.join(root, 'fake.cjs');
  await writeFile(fake, `const fs=require('node:fs'),path=require('node:path');
const [kind,...args]=process.argv.slice(2), repo=path.basename(process.cwd());
const step=kind==='pnpm'?(args[0]==='--version'?'version':args[0]==='install'?'install':'build'):kind==='npm'?(args[0]==='ci'?'install':'build'):kind==='git'?args.includes('fetch')?'fetch':'checkout':kind;
const key=repo+':'+step;fs.appendFileSync(process.env.PARITY_FAKE_LOG,JSON.stringify({kind,repo,step,args})+'\\n');
if(process.env.PARITY_FAKE_FAIL===step||process.env.PARITY_FAKE_FAIL===key)process.exit(17);
if(kind==='parity')fs.writeFileSync(process.env.OUT,'new measurement');
if(kind==='summary')fs.writeFileSync(args[1],'new summary');
`);
  const launch = kind => `@"${process.execPath}" "${fake}" ${kind} %*\r\n@exit /b %errorlevel%\r\n`;
  await writeFile(path.join(bin, 'pnpm.cmd'), launch('pnpm'));
  await writeFile(path.join(bin, 'git.cmd'), launch('git'));
  const npm = path.join(root, 'npm.cjs');
  await writeFile(npm, `process.argv.splice(2,0,'npm');require(${JSON.stringify(fake)});`);
  for (const [file, kind] of [['gen-snippets.mjs', 'snippets'], ['parity.mjs', 'parity'], ['summarize.mjs', 'summary']]) {
    await writeFile(path.join(scripts, file), `process.argv.splice(2,0,${JSON.stringify(kind)});await import(${JSON.stringify(pathToFileURL(fake).href)});`);
  }
  // Node's --import receives the normal loader path, kept as an empty fixture.
  await mkdir(path.join(root, 'sources', 'parity-opf', 'scripts'), {recursive: true});
  await writeFile(path.join(root, 'sources', 'parity-opf', 'scripts', 'register-local-opf.mjs'), '');
  const shell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const env = {...process.env, NODE_TOOLCHAIN: toolchain, NPM_CLI: npm, PARITY_FAKE_LOG: log, PARITY_FAKE_FAIL: fail, OPF_REPOS: path.join(root, 'sources')};
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env.PATH = `${path.dirname(process.execPath)};${process.env.PATH}`;
  const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-File', path.join(parity, `${mode}.ps1`), ...options], {
    cwd: root, env, encoding: 'utf8', timeout: 60000,
  });
  assert.ifError(result.error);
  const calls = (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  return {result, calls, measurement: await readFile(output, 'utf8'), summary: await readFile(path.join(parity, 'PARITY.md'), 'utf8')};
};
for (const repo of ['opf', 'opf-render']) test(`Windows behavior: failed ${repo} install prevents its build and fails parent`, {skip: !windows && 'UNQUALIFIED: Windows PowerShell fake-command execution requires Windows/full-ci'}, async t => {
  const {result, calls} = await behavior(t, 'build', `parity-${repo}:install`);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(calls.some(call => call.repo === `parity-${repo}` && call.step === 'install'));
  assert.ok(!calls.some(call => call.repo === `parity-${repo}` && call.step === 'build'));
});
test('Windows behavior: successful background builds complete all install/build pairs', {skip: !windows && 'UNQUALIFIED: requires Windows/full-ci'}, async t => {
  const {result, calls} = await behavior(t, 'build');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const repo of ['opf', 'opf-render', 'opf-pptx']) assert.deepEqual(calls.filter(call => call.repo === `parity-${repo}`).map(call => call.step), ['install', 'build']);
});
for (const failure of ['snippets', 'parity']) test(`Windows behavior: failed ${failure} prevents later stages and stale summary`, {skip: !windows && 'UNQUALIFIED: requires Windows/full-ci'}, async t => {
  const {result, calls, summary} = await behavior(t, 'run', failure);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(calls.map(call => call.step), failure === 'snippets' ? ['snippets'] : ['snippets', 'parity']);
  assert.equal(summary, 'old summary');
});
for (const options of [[], ['-SkipSnippets']]) test(`Windows behavior: successful run ${options.join(' ')} reaches measurement and summary`, {skip: !windows && 'UNQUALIFIED: requires Windows/full-ci'}, async t => {
  const {result, calls, measurement, summary} = await behavior(t, 'run', '', options);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(calls.map(call => call.step), options.length ? ['parity', 'summary'] : ['snippets', 'parity', 'summary']);
  assert.equal(measurement, 'new measurement'); assert.equal(summary, 'new summary');
});
for (const failure of ['fetch', 'checkout']) test(`Windows behavior: failed ${failure} prevents update rebuild and measurement`, {skip: !windows && 'UNQUALIFIED: requires Windows/full-ci'}, async t => {
  const {result, calls} = await behavior(t, 'run', failure, ['-Update']);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(calls.map(call => call.step), failure === 'fetch' ? ['fetch'] : ['fetch', 'checkout']);
});

test('Windows behavior: failed background build propagates to the parent', {skip: !windows && 'UNQUALIFIED: requires Windows/full-ci'}, async t => {
  const {result, calls} = await behavior(t, 'build', 'parity-opf:build');
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(calls.filter(call => call.repo === 'parity-opf').map(call => call.step), ['install', 'build']);
});
test('Windows behavior: summary errors fail the run', {skip: !windows && 'UNQUALIFIED: requires Windows/full-ci'}, async t => {
  const {result, calls} = await behavior(t, 'run', 'summary');
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(calls.map(call => call.step), ['snippets', 'parity', 'summary']);
});
