import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

// RR-87: the owned-copy native helper. Offline: it reads the scripts and, on Windows, runs the fake-Office controls
// (test/native-playground-check.ps1). No PowerPoint process is started and the helper itself is never run.
const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const helper = await read('native-playground.ps1');
const lib = await read('native-playground-lib.ps1');

// Static shape of the workflow (every platform).
assert.doesNotMatch(helper, /Retired unsafe native helper/, 'the helper is the maintained workflow, not the retired stub');
assert.doesNotMatch(helper + lib, /Presentations\.Open\(\$(inputPath|Owned\.fixture|fixture)\b/, 'the fixture path is never opened');
assert.match(lib, /Presentations\.Open\(\$Owned\.copy, 0, 0, 0\)/, 'the owned copy is opened, read-write and without a window');
assert.match(lib, /Assert-OpfPathsNotOpen/, 'an already-open exact path is refused');
assert.match(lib, /Invoke-OpfNativeStage/, 'Office calls run behind the failure latch');
assert.match(lib, /Close-OpfOwnedPresentation/, 'only an identified owned presentation is closed');
assert.match(helper, /Invoke-OpfNativeWorker/, 'the helper runs as a bounded worker');
assert.doesNotMatch(helper + lib, /Stop-Process|taskkill|\.Quit\(\)/i, 'Office is never terminated');
assert.match(helper, /native-attempts/, 'each attempt writes into a fresh directory');
assert.match(await read('../docs/native-harness-retirement.md'), /bounded owned-copy/, 'the documentation names the replacement');

if (process.platform === 'win32') {
  const directory = await mkdtemp(path.join(tmpdir(), 'opf-native-controls-'));
  try {
    const report = path.join(directory, 'report.json');
    const shell = process.env.WINDIR ? path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe') : 'powershell.exe';
    const run = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-File', new URL('native-playground-check.ps1', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '-ReportPath', report], { encoding: 'utf8', timeout: 120000 });
    assert.equal(run.status, 0, `the offline controls pass: ${run.stdout}${run.stderr}`);
    const result = JSON.parse((await readFile(report, 'utf8')).replace(/^﻿/, ''));
    assert.deepEqual(result.cases.map((entry) => entry.case), ['ownership', 'already-open', 'failure-latch', 'close-only-owned', 'fresh-attempt', 'timeout']);
    assert.ok(result.cases.every((entry) => entry.passed));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  console.log('Native playground helper: static shape and the six offline ownership, refusal, latch, close, attempt and timeout controls pass. No Office automation used.');
} else {
  console.log('Native playground helper: static shape checked; the PowerShell controls run on Windows only.');
}
