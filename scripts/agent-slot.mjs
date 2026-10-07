#!/usr/bin/env node
// RR-57: a machine-wide semaphore for heavy commands (the type check, the full test suite). Several agent sessions
// work on the same machine from different worktrees; this keeps at most OPF_AGENT_SLOTS (default 3) heavy commands
// running at once, whichever worktree or repository they start from, so they do not starve each other or the
// machine of memory.
//   node scripts/agent-slot.mjs -- <command> [args...]
// A slot is a file created with the `wx` flag under ~/.cache/opf-agent-slots (OPF_AGENT_SLOT_DIR overrides the
// directory, for tests) that holds the pid, the start time and the command. A slot is stale, and reclaimed, when its
// process is gone or it is older than two hours. The command runs with inherited stdio and its exit code is ours.
// With CI set, with OPF_AGENT_SLOTS=0, or inside a command that already holds a slot, the command just runs.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SLOTS = 3;
export const STALE_MS = 2 * 60 * 60 * 1000;
const POLL_MS = 500;
const PARTIAL_WRITE_MS = 10_000;
const HELD_ENV = 'OPF_AGENT_SLOT_HELD';

export function slotDir(env = process.env) {
  return env.OPF_AGENT_SLOT_DIR || path.join(homedir(), '.cache', 'opf-agent-slots');
}

/** OPF_AGENT_SLOTS as a count: unset or empty is the default, 0 turns the limit off. Throws on anything else. */
export function slotCount(env = process.env) {
  const raw = env.OPF_AGENT_SLOTS;
  if (raw === undefined || raw === '') return DEFAULT_SLOTS;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 0) throw new Error(`OPF_AGENT_SLOTS must be a non-negative integer, not ${raw}`);
  return count;
}

/** True when this process must not take a slot: CI, the limit off, or a parent that already holds one. */
export function isPassthrough(env = process.env) {
  const ci = env.CI;
  return (ci !== undefined && ci !== '' && ci !== 'false' && ci !== '0') || slotCount(env) === 0 || Boolean(env[HELD_ENV]);
}

export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH'; // EPERM: the process exists but belongs to someone else
  }
}

function readSlot(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { missing: true };
    throw error;
  }
  try {
    const data = JSON.parse(text);
    if (Number.isInteger(data.pid)) return { data };
  } catch {
    // Unparseable: the owner may be between creating the file and writing it.
  }
  return { partial: true };
}

/** Whether the slot file is stale: owner gone, older than STALE_MS, or never finished being written. */
export function slotIsStale(file, now = Date.now()) {
  const slot = readSlot(file);
  if (slot.missing) return false;
  if (slot.partial) {
    try {
      return now - statSync(file).mtimeMs > PARTIAL_WRITE_MS;
    } catch {
      return false;
    }
  }
  const started = Date.parse(slot.data.startedAt);
  return !isAlive(slot.data.pid) || (Number.isFinite(started) && now - started > STALE_MS);
}

// Reclaim under a short-lived guard file, re-checking after taking it, so that two waiters that both saw the same
// stale slot cannot delete the new owner's file. Returns true when the slot file is gone.
function reclaim(file) {
  const guard = `${file}.reclaim`;
  try {
    writeFileSync(guard, String(process.pid), { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    try {
      if (Date.now() - statSync(guard).mtimeMs > PARTIAL_WRITE_MS) unlinkSync(guard);
    } catch {
      // Someone else released it first.
    }
    return false;
  }
  try {
    if (!slotIsStale(file)) return false;
    unlinkSync(file);
    return true;
  } catch (error) {
    return error.code === 'ENOENT';
  } finally {
    try {
      unlinkSync(guard);
    } catch {
      // Already gone.
    }
  }
}

/** Describe the busy slots, for the waiting line. */
export function describeBusy(dir, count, now = Date.now()) {
  const busy = [];
  for (let index = 0; index < count; index += 1) {
    const slot = readSlot(path.join(dir, `slot-${index}.lock`));
    if (slot.data) {
      const minutes = Math.max(0, Math.round((now - Date.parse(slot.data.startedAt)) / 60_000));
      busy.push(`pid ${slot.data.pid} ${String(slot.data.command).slice(0, 60)} ${minutes}m`);
    } else if (slot.partial) busy.push('starting');
  }
  return busy;
}

/** Try each slot once. Returns the held slot {file, release} or null when all are taken by live owners. */
export function tryAcquire(dir, count, command, now = Date.now()) {
  mkdirSync(dir, { recursive: true });
  const content = JSON.stringify({ pid: process.pid, startedAt: new Date(now).toISOString(), command });
  for (let index = 0; index < count; index += 1) {
    const file = path.join(dir, `slot-${index}.lock`);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        writeFileSync(file, content, { flag: 'wx' });
        return {
          file,
          release() {
            try {
              if (readSlot(file).data?.pid === process.pid) unlinkSync(file);
            } catch {
              // Already gone.
            }
          },
        };
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (!slotIsStale(file, now) || !reclaim(file)) break;
      }
    }
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for a slot. `onWait(busy)` is called once, the first time every slot is taken. */
export async function acquire({ dir = slotDir(), count = slotCount(), command, pollMs = POLL_MS, onWait = () => {} } = {}) {
  let announced = false;
  for (;;) {
    const held = tryAcquire(dir, count, command);
    if (held) return held;
    if (!announced) {
      announced = true;
      onWait(describeBusy(dir, count));
    }
    await sleep(pollMs);
  }
}

function quote(arg) {
  return /[\s"&|<>^()%!]/.test(arg) || arg === '' ? `"${arg.replaceAll('"', '\\"')}"` : arg;
}

function run(argv, held) {
  return new Promise((resolve) => {
    const env = held ? { ...process.env, [HELD_ENV]: '1' } : process.env;
    const child =
      process.platform === 'win32'
        ? spawn(argv.map(quote).join(' '), { stdio: 'inherit', shell: true, env })
        : spawn(argv[0], argv.slice(1), { stdio: 'inherit', env });
    const forward = (signal) => () => {
      child.kill(signal);
    };
    const handlers = { SIGINT: forward('SIGINT'), SIGTERM: forward('SIGTERM') };
    for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);
    const done = (code) => {
      for (const [signal, handler] of Object.entries(handlers)) process.off(signal, handler);
      resolve(code);
    };
    child.on('error', (error) => {
      console.error(`agent-slot: could not start ${argv[0]}: ${error.message}`);
      done(127);
    });
    child.on('close', (code, signal) => done(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)));
  });
}

export async function main(argv, env = process.env) {
  const separator = argv.indexOf('--');
  const command = separator === -1 ? argv : argv.slice(separator + 1);
  if (!command.length) {
    console.error('usage: node scripts/agent-slot.mjs -- <command> [args...]');
    return 2;
  }
  if (isPassthrough(env)) return run(command, false);
  const label = command.join(' ');
  let waiting = true;
  let held = null;
  const release = () => held?.release();
  const interrupted = (code) => () => {
    if (waiting) {
      release();
      process.exit(code);
    }
  };
  process.on('SIGINT', interrupted(130));
  process.on('SIGTERM', interrupted(143));
  process.on('exit', release);
  held = await acquire({
    dir: slotDir(env),
    count: slotCount(env),
    command: label,
    pollMs: Number(env.OPF_AGENT_SLOT_POLL_MS) || POLL_MS,
    onWait: (busy) => console.error(`agent-slot: waiting for a heavy-check slot (${busy.length} busy: ${busy.join('; ')})`),
  });
  waiting = false;
  try {
    return await run(command, true);
  } finally {
    release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`agent-slot: ${error.message}`);
      process.exit(1);
    },
  );
}
