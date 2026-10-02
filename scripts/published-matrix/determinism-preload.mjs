// Preloaded (`node --import`) into each child of determinism.mjs before the matrix imports anything. It applies the
// environment the grid asks for and records what the child actually saw, so a control that changed nothing cannot pass:
//   clock    a fixed wall clock (Date and Date.now), so a stray `new Date()` shows up as a digest difference;
//   stress   rebinds every Intl constructor and toLocale* method that omits a locale to this one, because Node on Windows
//            ignores LANG for the ICU default locale;
//   audit    records every path the child reads, to prove no host font directory is consulted.
// The probe and the audit are written to OPF_MATRIX_OUT when the child exits.
import {mkdirSync} from 'node:fs';
import {createRequire, syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const config = JSON.parse(process.env.OPF_DET ?? '{}');
const out = process.env.OPF_MATRIX_OUT;
const require = createRequire(import.meta.url);
const fs = require('node:fs');
// Keep the unpatched writers for the exit hook.
const write = fs.writeFileSync.bind(fs);
const audit = new Set();

if (config.audit) {
  const names = ['readFile', 'readFileSync', 'readdir', 'readdirSync', 'opendir', 'opendirSync', 'stat', 'statSync', 'lstat', 'lstatSync', 'access', 'accessSync', 'existsSync', 'open', 'openSync', 'createReadStream', 'realpath', 'realpathSync'];
  for (const target of [fs, fs.promises]) {
    for (const name of names) {
      const original = target[name];
      if (typeof original !== 'function') continue;
      target[name] = function (first, ...rest) {
        try {
          audit.add(path.resolve(first instanceof URL ? fileURLToPath(first) : String(first)));
        } catch {
          audit.add('<unreadable path argument>');
        }
        return original.call(this, first, ...rest);
      };
    }
  }
  syncBuiltinESMExports();
}
if (config.clock) {
  const fixed = Date.parse(config.clock);
  const Native = Date;
  globalThis.Date = class ClockDate extends Native {
    constructor(...args) {
      if (args.length) super(...args);
      else super(fixed);
    }
    static now() {
      return fixed;
    }
  };
}
if (config.stress) {
  const locale = config.stress;
  const withLocale = (args) => [args[0] === undefined ? locale : args[0], ...args.slice(1)];
  for (const name of ['Collator', 'NumberFormat', 'DateTimeFormat', 'PluralRules', 'ListFormat', 'RelativeTimeFormat', 'Segmenter', 'DisplayNames']) {
    const Native = Intl[name];
    if (typeof Native !== 'function') continue;
    Intl[name] = new Proxy(Native, {
      apply: (target, _self, args) => target(...withLocale(args)),
      construct: (target, args, newTarget) => Reflect.construct(target, withLocale(args), newTarget === Intl[name] ? target : newTarget)
    });
  }
  const compare = String.prototype.localeCompare;
  String.prototype.localeCompare = function (that, loc, options) {
    return compare.call(this, that, loc ?? locale, options);
  };
  for (const [owner, method] of [[String.prototype, 'toLocaleUpperCase'], [String.prototype, 'toLocaleLowerCase'], [Number.prototype, 'toLocaleString'], [BigInt.prototype, 'toLocaleString'], [Date.prototype, 'toLocaleString'], [Date.prototype, 'toLocaleDateString'], [Date.prototype, 'toLocaleTimeString'], [Array.prototype, 'toLocaleString']]) {
    const native = owner[method];
    owner[method] = function (loc, ...rest) {
      return native.call(this, loc ?? locale, ...rest);
    };
  }
}

// The sandbox scenario must really deny host font discovery and subprocesses; the probe's own deliberate reads are not exporter reads.
const sandbox = config.sandbox
  ? (() => {
      const directories = config.fontDirectories ?? [];
      const cp = require('node:child_process');
      const denied = (run) => {
        try {
          run();
          return false;
        } catch (error) {
          return error.code === 'ERR_ACCESS_DENIED';
        }
      };
      const result = {
        fontDirectoriesDenied: directories.every((directory) => denied(() => fs.readdirSync(directory))),
        childProcessDenied: denied(() => cp.spawnSync(process.execPath, ['-e', '0'])),
        permission: directories.every((directory) => process.permission?.has('fs.read', directory) === false)
      };
      audit.clear();
      return result;
    })()
  : null;

const GRAPHEMES = ['\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}', '\u{1F1E9}\u{1F1EA}\u{1F1EB}\u{1F1F7}', 'e\u{301}', '\u{915}\u{94D}\u{937}', '\u{915}\u{94D}\u{200D}\u{937}', '\u{E01}\u{E47}', '\u{D55C}\u{AE00}', '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}', '\u{1F44D}\u{1F3FD}', '\u{1FAE9}', '\r\n', '\u{A15}\u{A4D}\u{A38}'];
process.on('exit', () => {
  if (!out) return;
  mkdirSync(out, {recursive: true});
  const probe = {
    node: process.version,
    icu: process.versions.icu,
    unicode: process.versions.unicode,
    tzdata: process.versions.tz,
    platform: process.platform,
    arch: process.arch,
    tz: process.env.TZ ?? null,
    offsetMinutes: new Date(2026, 0, 1, 12).getTimezoneOffset(),
    offsetMinutesSummer: new Date(2026, 6, 1, 12).getTimezoneOffset(),
    resolvedTimeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: process.env.LANG ?? null,
    lcAll: process.env.LC_ALL ?? null,
    icuDefaultLocale: new Intl.DateTimeFormat().resolvedOptions().locale,
    numberSample: (1234567.891).toLocaleString(),
    dateSample: new Date(Date.UTC(2026, 8, 29, 12)).toLocaleDateString(),
    // The reference names its locale: an unsupported tag would resolve to the host default and hide the change.
    turkishCollationDiffers: 'Id'.localeCompare('id') !== new Intl.Collator('en-US').compare('Id', 'id'),
    clock: new Date().toISOString(),
    // The matrix measures text with Intl.Segmenter('und', grapheme): locale independent, ICU version dependent.
    sandbox,
    graphemeSignature: GRAPHEMES.map((text) => Array.from(new Intl.Segmenter('und', {granularity: 'grapheme'}).segment(text)).length).join('')
  };
  write(path.join(out, 'probe.json'), `${JSON.stringify(probe, null, 1)}\n`);
  if (config.audit) write(path.join(out, 'audit.json'), `${JSON.stringify([...audit].sort(), null, 1)}\n`);
});
