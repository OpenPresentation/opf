// NT-02: the facts check() needs about this Mac, each behind one small function so a test can replace it, and the one
// process runner every command of the driver goes through. None of these sends Keynote an Apple event: whether Keynote
// is running comes from the process list, its build from its bundle's Info.plist. Keynote's version is Keynote's own
// answer to the `info` verb (driver.mjs), asked only while it is running.
import { execFile } from 'node:child_process';

/**
 * Runs one command and never throws for its exit: { code, stdout, stderr, timedOut, seconds }. code is null when the
 * process was killed (timedOut true when our own timeout killed it). The driver receives this as ctx.exec; tests pass a
 * fake one, so no test runs osascript.
 */
export function execCommand(command, args = [], { timeoutMs = 60_000 } = {}) {
  const started = process.hrtime.bigint();
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, killSignal: 'SIGTERM', maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      if (!error) return resolve({ code: 0, stdout, stderr, timedOut: false, seconds });
      const timedOut = error.killed === true && error.signal === 'SIGTERM';
      const code = typeof error.code === 'number' ? error.code : null;
      resolve({ code, stdout: stdout ?? '', stderr: stderr || (code === null && !timedOut ? String(error.message) : ''), timedOut, seconds });
    });
  });
}

export const KEYNOTE_BUNDLE_ID = 'com.apple.Keynote';
/** Keynote's process name (the installed app may show another display name; the bundle id and the process stay). */
export const KEYNOTE_PROCESS = 'Keynote';

/** True when a process named exactly Keynote runs (`pgrep -x Keynote`). */
export async function keynoteRunning(exec) {
  const { code } = await exec('pgrep', ['-x', KEYNOTE_PROCESS], { timeoutMs: 10_000 });
  return code === 0;
}

/** Reads the session's lock state from `ioreg -n Root -d1 -a` (CGSSessionScreenIsLocked); absent means unlocked. */
export function parseScreenLocked(ioregXml) {
  const match = /<key>CGSSessionScreenIsLocked<\/key>\s*<(true|false)\s*\/>/u.exec(String(ioregXml));
  return match?.[1] === 'true';
}

export async function screenLocked(exec) {
  const { code, stdout } = await exec('ioreg', ['-n', 'Root', '-d1', '-a'], { timeoutMs: 10_000 });
  if (code !== 0) throw new Error('screenLocked: ioreg failed');
  return parseScreenLocked(stdout);
}

/** macOS's version (`sw_vers -productVersion`), for example "26.6.2". */
export async function macosVersion(exec) {
  const { code, stdout } = await exec('sw_vers', ['-productVersion'], { timeoutMs: 10_000 });
  const version = stdout.trim();
  if (code !== 0 || version === '') throw new Error('macosVersion: sw_vers failed');
  return version;
}

async function plistValue(exec, plist, key) {
  const { code, stdout } = await exec('plutil', ['-extract', key, 'raw', '-o', '-', plist], { timeoutMs: 10_000 });
  return code === 0 ? stdout.trim() : null;
}

/**
 * Keynote's bundle, found by its bundle id (Spotlight first, then /Applications/Keynote.app), and its build
 * (CFBundleVersion, for example "7052.0.68") and short version from Info.plist: { path, build, version } or null.
 */
export async function keynoteBundle(exec) {
  const { code, stdout } = await exec('mdfind', [`kMDItemCFBundleIdentifier == '${KEYNOTE_BUNDLE_ID}'`], { timeoutMs: 20_000 });
  const found = code === 0 ? stdout.split('\n').map((line) => line.trim()).filter((line) => line.endsWith('.app')) : [];
  // Prefer the copy in /Applications; Spotlight also finds copies on backup volumes.
  const candidates = [...found.filter((app) => app.startsWith('/Applications/')), ...found.filter((app) => !app.startsWith('/Applications/')), '/Applications/Keynote.app'];
  for (const app of [...new Set(candidates)]) {
    const plist = `${app}/Contents/Info.plist`;
    if ((await plistValue(exec, plist, 'CFBundleIdentifier')) !== KEYNOTE_BUNDLE_ID) continue;
    return { path: app, build: await plistValue(exec, plist, 'CFBundleVersion'), version: await plistValue(exec, plist, 'CFBundleShortVersionString') };
  }
  return null;
}

/** The default facts; ctx.machine may replace any of them. */
export const defaultMachine = Object.freeze({ keynoteRunning, screenLocked, macosVersion, keynoteBundle });
