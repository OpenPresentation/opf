// NT-16: the facts check() needs about this Windows computer, each behind one small function so a test can replace it,
// the one process runner, and the run directory's lock. None of these starts PowerPoint or Excel or talks to COM: the
// process list comes from tasklist.exe, PowerPoint's install and version from the registry (reg.exe). PowerPoint's own
// version and build are read by powerpoint.ps1 once the run has started it.
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, release } from 'node:os';
import path from 'node:path';
import { windowsPowerShellEnvironment } from '../../windows-powershell-env.mjs';

/**
 * Runs one command and never throws for its exit: { code, stdout, stderr, timedOut, seconds }. onLine(line) receives each
 * stdout line as it arrives (the run's progress). code is null when the process was stopped by our own time limit
 * (timedOut true). The driver receives this as ctx.exec; tests pass a fake one.
 */
export function execCommand(command, args = [], { timeoutMs = 60_000, onLine, env } = {}) {
  const started = process.hrtime.bigint();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let pending = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(command, args, { windowsHide: true, env: env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: String(error.message), timedOut: false, seconds: 0 });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!onLine) return;
      pending += chunk;
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop();
      for (const line of lines) onLine(line);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const done = (code, error) => {
      clearTimeout(timer);
      if (onLine && pending) onLine(pending);
      pending = '';
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      resolve({ code: timedOut ? null : code, stdout, stderr: stderr || (error ? String(error.message) : ''), timedOut, seconds });
    };
    child.on('error', (error) => done(null, error));
    child.on('close', (code) => done(code));
  });
}

/** Windows PowerShell 5.1 (never pwsh): the one shell powerpoint.ps1 is written for. */
export function powershellPath(env = process.env) {
  return path.join(env.WINDIR ?? env.windir ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

/** The child environment of powershell.exe: the parent's without an inherited PSModulePath (windows-powershell-env.mjs). */
export const powershellEnvironment = () => windowsPowerShellEnvironment(process.env);

/** The image names of `tasklist /FO CSV /NH`, upper case. */
export function parseTasklist(text) {
  const names = [];
  for (const line of String(text).split(/\r?\n/u)) {
    const match = /^"([^"]+)"/u.exec(line.trim());
    if (match) names.push(match[1].toUpperCase());
  }
  return names;
}

export const OFFICE_PROCESSES = Object.freeze(['POWERPNT.EXE', 'EXCEL.EXE']);

/** Which of POWERPNT.EXE and EXCEL.EXE run now. Throws when the process list cannot be read. */
export async function officeProcesses(exec) {
  const { code, stdout, stderr } = await exec('tasklist', ['/FO', 'CSV', '/NH'], { timeoutMs: 30_000 });
  if (code !== 0) throw new Error(`tasklist failed (${code}): ${String(stderr).trim()}`);
  const running = new Set(parseTasklist(stdout));
  return OFFICE_PROCESSES.filter((name) => running.has(name));
}

/** One REG_SZ value of `reg query <key> /v <name>` (or /ve: name null), or null. */
export function parseRegValue(text, name) {
  for (const line of String(text).split(/\r?\n/u)) {
    const match = /^\s+(.+?)\s{2,}REG_(?:SZ|EXPAND_SZ)\s{2,}(.*)$/u.exec(line);
    if (match && (name === null ? match[1] === '(Default)' : match[1].toLowerCase() === name.toLowerCase())) return match[2].trim();
  }
  return null;
}

const CLICK_TO_RUN = 'HKLM\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration';
const APP_PATH = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\powerpnt.exe';

/**
 * PowerPoint's install from the registry, without starting it: { path, version } where version is Office's
 * VersionToReport (for example "16.0.20625.20108") or null. Null when there is no App Paths entry for powerpnt.exe.
 */
export async function powerpointInstall(exec) {
  const where = await exec('reg', ['query', APP_PATH, '/ve'], { timeoutMs: 15_000 });
  const file = where.code === 0 ? parseRegValue(where.stdout, null) : null;
  if (!file) return null;
  const version = await exec('reg', ['query', CLICK_TO_RUN, '/v', 'VersionToReport'], { timeoutMs: 15_000 });
  return { path: file, version: version.code === 0 ? parseRegValue(version.stdout, 'VersionToReport') : null };
}

/** "16.0.20625.20108" -> { version: "16.0", build: "20625.20108" }; anything else -> null. */
export function splitOfficeVersion(text) {
  const match = /^(\d+\.\d+)\.(\d+(?:\.\d+)*)$/u.exec(String(text ?? ''));
  return match ? { version: match[1], build: match[2] } : null;
}

/** The default facts; ctx.machine may replace any of them. */
export const defaultMachine = Object.freeze({
  platform: () => process.platform,
  windowsVersion: () => release(),
  officeProcesses,
  powerpointInstall,
});

// ---- the lock: one driver process per run directory ----------------------------------------------------------------

export const LOCK_NAME = 'powerpoint.lock';

/** True when a process with this id exists (signal 0 tests without signalling; EPERM means it exists). */
export function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/**
 * Takes <runDir>/powerpoint.lock: { ok: true, release() } or { ok: false, reason }. A lock whose process is gone (or that
 * cannot be read) is stale and taken over; a lock of a live process refuses.
 */
export function takeLock(runDir, { pid = process.pid, now = () => new Date(), alive = processAlive } = {}) {
  const file = path.join(runDir, LOCK_NAME);
  const body = `${JSON.stringify({ pid, host: hostname(), started: now().toISOString() })}\n`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(file, body, { flag: 'wx' });
      return {
        ok: true,
        file,
        release() {
          try {
            if (JSON.parse(readFileSync(file, 'utf8')).pid === pid) rmSync(file, { force: true });
          } catch {
            // Already gone.
          }
        },
      };
    } catch (error) {
      if (error.code !== 'EEXIST') return { ok: false, reason: `could not write the lock ${file}: ${error.message}` };
      let holder = null;
      try {
        holder = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        // Unreadable: stale.
      }
      if (holder && Number.isInteger(holder.pid) && holder.pid !== pid && alive(holder.pid)) {
        return { ok: false, reason: `another PowerPoint driver (process ${holder.pid}, started ${holder.started}) holds ${file}; one driver process runs at a time` };
      }
      rmSync(file, { force: true });
    }
  }
  return { ok: false, reason: `could not take the lock ${file}` };
}

/** Whether a live process holds the run directory's lock (check() reports it without taking it). */
export function lockHolder(runDir, { alive = processAlive } = {}) {
  try {
    const holder = JSON.parse(readFileSync(path.join(runDir, LOCK_NAME), 'utf8'));
    return Number.isInteger(holder.pid) && alive(holder.pid) ? holder : null;
  } catch {
    return null;
  }
}
