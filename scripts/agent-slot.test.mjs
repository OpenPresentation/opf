import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isAlive, isPassthrough, slotCount, slotIsStale } from './agent-slot.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-slot.mjs');

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'opf-agent-slot-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Run `node agent-slot.mjs -- <command>`; resolves {code, stdout, stderr}.
function slot(args, env) {
  const child = spawn(process.execPath, [script, '--', ...args], {
    env: { ...process.env, CI: '', OPF_AGENT_SLOT_HELD: '', OPF_AGENT_SLOT_POLL_MS: '30', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  return { child, result };
}

// A job that marks itself running in `running/`, records the highest number of marks it saw, holds for `ms`, unmarks.
const job = `
const fs = require('node:fs');
const path = require('node:path');
const [dir, id, ms] = process.argv.slice(2);
const mark = path.join(dir, 'running', id);
fs.writeFileSync(mark, '');
const peak = path.join(dir, 'peak');
const now = fs.readdirSync(path.join(dir, 'running')).length;
fs.appendFileSync(peak, now + '\\n');
setTimeout(() => { fs.unlinkSync(mark); }, Number(ms));
`;

test('slotCount and isPassthrough read the environment', () => {
  assert.equal(slotCount({}), 3);
  assert.equal(slotCount({ OPF_AGENT_SLOTS: '' }), 3);
  assert.equal(slotCount({ OPF_AGENT_SLOTS: '5' }), 5);
  for (const bad of ['-1', '1.5', 'many']) assert.throws(() => slotCount({ OPF_AGENT_SLOTS: bad }), /non-negative integer/);
  assert.equal(isPassthrough({}), false);
  assert.equal(isPassthrough({ CI: 'true' }), true);
  assert.equal(isPassthrough({ CI: 'false' }), false);
  assert.equal(isPassthrough({ OPF_AGENT_SLOTS: '0' }), true);
  assert.equal(isPassthrough({ OPF_AGENT_SLOT_HELD: '1' }), true);
});

test('at most OPF_AGENT_SLOTS jobs run at once, and every job runs', async (t) => {
  const dir = tempDir(t);
  mkdirSync(path.join(dir, 'running'));
  const env = { OPF_AGENT_SLOT_DIR: path.join(dir, 'slots'), OPF_AGENT_SLOTS: '2' };
  const jobFile = path.join(dir, 'job.cjs');
  writeFileSync(jobFile, job);
  const runs = Array.from({ length: 5 }, (_, index) => slot(['node', jobFile, dir, String(index), '300'], env).result);
  const results = await Promise.all(runs);
  assert.deepEqual(
    results.map((result) => result.code),
    [0, 0, 0, 0, 0],
  );
  const peaks = readFileSync(path.join(dir, 'peak'), 'utf8').trim().split('\n').map(Number);
  assert.equal(peaks.length, 5);
  assert.ok(Math.max(...peaks) <= 2, `more than 2 jobs ran at once: ${peaks.join(',')}`);
  assert.equal(Math.max(...peaks), 2, 'two jobs should have run side by side');
  assert.ok(results.filter((result) => /waiting for a heavy-check slot/.test(result.stderr)).length >= 3);
  assert.deepEqual(readdirSync(path.join(dir, 'slots')), [], 'every slot is released');
});

test('the exit code of the command is the exit code of agent-slot', async (t) => {
  const dir = tempDir(t);
  const { code } = await slot(['node', '-e', 'process.exit(7)'], { OPF_AGENT_SLOT_DIR: dir }).result;
  assert.equal(code, 7);
  assert.deepEqual(readdirSync(dir), []);
});

test('a slot of a dead process, and a slot older than two hours, are reclaimed', async (t) => {
  const dir = tempDir(t);
  const dead = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => dead.on('close', resolve));
  assert.equal(isAlive(dead.pid), false);
  assert.equal(isAlive(process.pid), true);
  const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  writeFileSync(path.join(dir, 'slot-0.lock'), JSON.stringify({ pid: dead.pid, startedAt: new Date().toISOString(), command: 'dead' }));
  writeFileSync(path.join(dir, 'slot-1.lock'), JSON.stringify({ pid: process.pid, startedAt: old, command: 'old but alive' }));
  assert.equal(slotIsStale(path.join(dir, 'slot-0.lock')), true);
  assert.equal(slotIsStale(path.join(dir, 'slot-1.lock')), true);
  const env = { OPF_AGENT_SLOT_DIR: dir, OPF_AGENT_SLOTS: '2' };
  const sleeper = path.join(dir, 'sleep.cjs');
  writeFileSync(sleeper, 'setTimeout(() => {}, 300);');
  // Two runs at once need both slots, so both stale ones must be reclaimed without a wait.
  const results = await Promise.all([slot(['node', sleeper], env).result, slot(['node', sleeper], env).result]);
  for (const { code, stderr } of results) {
    assert.equal(code, 0);
    assert.doesNotMatch(stderr, /waiting/);
  }
  assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith('.lock')), []);
});

test('a live, fresh slot blocks until it is released; CI and nested runs pass straight through', async (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'slot-0.lock');
  writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), command: 'someone else' }));
  const env = { OPF_AGENT_SLOT_DIR: dir, OPF_AGENT_SLOTS: '1' };
  assert.equal(slotIsStale(file), false);

  const passthrough = await slot(['node', '-e', ''], { ...env, CI: 'true' }).result;
  assert.equal(passthrough.code, 0);
  assert.doesNotMatch(passthrough.stderr, /waiting/);
  const nested = await slot(['node', '-e', ''], { ...env, OPF_AGENT_SLOT_HELD: '1' }).result;
  assert.equal(nested.code, 0);
  assert.ok(existsSync(file), 'a passthrough run leaves other slots alone');

  const blocked = slot(['node', '-e', ''], env);
  let finished = false;
  blocked.result.then(() => {
    finished = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(finished, false, 'the run waits while the only slot is busy');
  rmSync(file);
  const { code, stderr } = await blocked.result;
  assert.equal(code, 0);
  assert.match(stderr, /waiting for a heavy-check slot \(1 busy: pid \d+ someone else/);
  assert.equal(stderr.match(/waiting for a heavy-check slot/g).length, 1, 'the waiting line is printed once');
});

// #525: the command and its arguments reach the program intact when the path or an argument has a space (Windows used to
// join them into a cmd.exe command line).
test('a script path and arguments with spaces reach the command, with and without a slot', async (t) => {
  const parent = tempDir(t);
  const dir = path.join(parent, 'a folder with spaces');
  mkdirSync(dir);
  const script = path.join(dir, 'print args.cjs');
  writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
  for (const env of [{ OPF_AGENT_SLOT_DIR: path.join(parent, 'slots'), OPF_AGENT_SLOTS: '1' }, { OPF_AGENT_SLOTS: '0' }]) {
    const { code, stdout } = await slot([process.execPath, script, 'one arg', 'two'], env).result;
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(stdout), ['one arg', 'two']);
  }
});
