// FF-11: local export-determinism control (Node exporter only).
//
// The parent spawns child Node processes. Each child exports the same authored
// decks and reports SHA-256 digests for the PPTX, every part inside it, and every
// embedded workbook part. The parent requires every digest to equal the baseline
// child's (TZ=UTC, LANG=C, real clock, no patches) across:
//   * TZ x LANG/LC_ALL grid (UTC, America/Los_Angeles, Asia/Kolkata,
//     Pacific/Chatham x C, en_US, de_DE, tr_TR, ja_JP);
//   * a different simulated wall clock in every child (Date and Date.now), so
//     vendored `new Date()` calls cannot pass by luck of timing;
//   * a hostile default-locale mode (tr-TR, de-DE, ar-EG, th-TH Buddhist/Thai
//     digits) that rebinds every Intl constructor and toLocale* method that
//     omits a locale. Windows Node ignores LANG for the ICU default locale, so
//     the environment grid alone is not enough evidence there;
//   * a no-system-fonts sandbox: `node --permission` with reads limited to this
//     checkout and no child processes, plus an fs audit and an empty fontconfig.
// This file establishes nothing about other operating systems or Node/ICU builds.
// Run it on each OS and compare `manifest.json` (see OPF_DETERMINISM_ARTIFACTS).
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire, syncBuiltinESMExports} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');
// System font directories the sandbox must keep unreadable.
function fontDirectories() {
  return process.platform === 'win32' ? [path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts')]
    : ['/usr/share/fonts', '/Library/Fonts', '/System/Library/Fonts', '/usr/local/share/fonts'];
}
const contains = (base, file) => { const relative = path.relative(base, file); return !relative.startsWith('..') && !path.isAbsolute(relative); };
// The directory that owns a dependency resolved outside this checkout: its git checkout
// (sibling checkouts from link-ecosystem, which also hold their own dependencies), else
// the outermost node_modules directory it lives in (a shared store), else its own real path.
function ownerOf(real) {
  for (let dir = real; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) break;
  }
  const segments = real.split(path.sep), first = segments.indexOf('node_modules');
  return first > 0 ? segments.slice(0, first + 1).join(path.sep) : real;
}
// Directories a child may read, from real paths: this checkout plus the owner of every
// installed package (top-level and scoped) that a symlink or junction sends elsewhere.
// Nothing here is font-specific, and a root that would contain a font directory is refused.
function readRoots() {
  const checkout = realpathSync(root);
  const roots = new Set([root, checkout]);
  const modules = path.join(checkout, 'node_modules');
  const packages = [];
  const list = directory => { try { return readdirSync(directory, {withFileTypes: true}); } catch { return []; } };
  for (const entry of list(modules)) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) for (const child of list(path.join(modules, entry.name))) packages.push(path.join(modules, entry.name, child.name));
    else packages.push(path.join(modules, entry.name));
  }
  for (const link of packages) {
    let real;
    try { real = realpathSync(link); } catch { continue; } // dangling link: nothing to read
    if (!contains(checkout, real)) roots.add(ownerOf(real));
  }
  for (const base of roots) {
    assert.ok(path.dirname(base) !== base, `read root ${base} is a filesystem root`);
    for (const fonts of fontDirectories()) assert.ok(!contains(base, fonts), `read root ${base} would allow the font directory ${fonts}`);
  }
  // detect-libc (used by sharp) reads the ELF header of the running executable via
  // /proc/self/exe to tell glibc from musl. Allow exactly that file, never a directory.
  if (process.platform === 'linux') for (const file of ['/proc/self/exe', realpathSync(process.execPath)]) roots.add(file);
  return [...roots];
}
const FONT_DIRECTORY = /(?:^|[\\/])(?:fonts?|\.fonts|fontconfig)(?:[\\/]|$)/i;

const TIMEZONES = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Chatham'];
const LOCALES = ['C', 'en_US.UTF-8', 'de_DE.UTF-8', 'tr_TR.UTF-8', 'ja_JP.UTF-8'];
const STRESS = ['tr-TR', 'de-DE', 'ar-EG', 'th-TH-u-nu-thai-ca-buddhist'];
const CLOCKS = ['1980-06-15T12:34:56.789Z', '2038-01-19T03:14:07Z', '2026-02-28T23:59:59Z', '2090-07-01T12:00:00Z', '2024-02-29T00:00:00Z'];

// ---------------------------------------------------------------------------
// Child process
// ---------------------------------------------------------------------------
// The renderer ships its own vendored faces (fonts/carlito, fonts/open: hash-pinned, opf-render#50) in a `fonts` directory
// of its package. Reading them is bundled-font loading, not host fonts, so they do not count as font-directory reads.
function rendererFontsDirectory() {
  try {
    const manifest = realpathSync(createRequire(import.meta.url).resolve('@openpresentation/opf-render/package.json'));
    return path.join(path.dirname(manifest), 'fonts') + path.sep;
  } catch { return undefined; }
}

async function worker(config) {
  const bundledFonts = rendererFontsDirectory();
  const audit = [];
  const auditedNames = ['readFile', 'readFileSync', 'readdir', 'readdirSync', 'opendir', 'opendirSync', 'stat', 'statSync',
    'lstat', 'lstatSync', 'access', 'accessSync', 'existsSync', 'open', 'openSync', 'createReadStream', 'realpath', 'realpathSync'];
  if (config.audit) {
    const fs = createRequire(import.meta.url)('node:fs');
    for (const target of [fs, fs.promises]) {
      for (const name of auditedNames) {
        const original = target[name];
        if (typeof original !== 'function') continue;
        target[name] = function (first, ...rest) {
          try { audit.push(path.resolve(first instanceof URL ? fileURLToPath(first) : String(first))); } catch { audit.push('<unreadable path argument>'); }
          return original.call(this, first, ...rest);
        };
      }
    }
    syncBuiltinESMExports();
  }
  if (config.clock) {
    const fixed = Date.parse(config.clock), Native = Date;
    class ClockDate extends Native {
      constructor(...args) { args.length ? super(...args) : super(fixed); }
      static now() { return fixed; }
    }
    globalThis.Date = ClockDate;
  }
  if (config.stress) {
    const locale = config.stress;
    for (const name of ['Collator', 'NumberFormat', 'DateTimeFormat', 'PluralRules', 'ListFormat', 'RelativeTimeFormat', 'Segmenter']) {
      const Native = Intl[name];
      if (typeof Native !== 'function') continue;
      const withLocale = args => [args[0] === undefined ? locale : args[0], ...args.slice(1)];
      Intl[name] = new Proxy(Native, {
        apply: (target, self, args) => target(...withLocale(args)),
        construct: (target, args, newTarget) => Reflect.construct(target, withLocale(args), newTarget === Intl[name] ? target : newTarget)
      });
    }
    const nativeCompare = String.prototype.localeCompare;
    String.prototype.localeCompare = function (that, loc, options) { return nativeCompare.call(this, that, loc ?? locale, options); };
    for (const [owner, method] of [[String.prototype, 'toLocaleUpperCase'], [String.prototype, 'toLocaleLowerCase'],
      [Number.prototype, 'toLocaleString'], [BigInt.prototype, 'toLocaleString'], [Date.prototype, 'toLocaleString'],
      [Date.prototype, 'toLocaleDateString'], [Date.prototype, 'toLocaleTimeString']]) {
      const native = owner[method];
      owner[method] = function (loc, ...rest) { return native.call(this, loc ?? locale, ...rest); };
    }
  }
  const probe = {
    tz: process.env.TZ ?? null,
    offsetMinutes: new Date(2026, 0, 1, 12).getTimezoneOffset(),
    lang: process.env.LANG ?? null,
    lcAll: process.env.LC_ALL ?? null,
    icuDefaultLocale: new Intl.DateTimeFormat().resolvedOptions().locale,
    numberSample: (1234567.891).toLocaleString(),
    // The reference must name a locale: V8 resolves an unsupported tag such as 'und' to the host default,
    // which follows LANG on Linux (tr_TR would then equal the hostile locale and hide the change).
    turkishCollationDiffers: 'Id'.localeCompare('id') !== new Intl.Collator('en-US').compare('Id', 'id'),
    // toUpperCase/toLowerCase are locale-independent by specification.
    plainCase: ['i'.toUpperCase(), 'I'.toLowerCase(), '\u{130}'.toLowerCase().length],
    clock: new Date().toISOString(),
    // Core measures with Intl.Segmenter('und', grapheme): locale-independent, but ICU/Unicode-version dependent.
    graphemeSignature: ['\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}', '\u{1F1E9}\u{1F1EA}\u{1F1EB}\u{1F1F7}', 'e\u{301}', '\u{915}\u{94D}\u{937}', '\u{915}\u{94D}\u{200D}\u{937}', '\u{E01}\u{E47}',
      '\u{D55C}\u{AE00}', '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}', '\u{1F44D}\u{1F3FD}', '\u{1FAE9}', '\r\n', '\u{A15}\u{A4D}\u{A38}']
      .map(text => Array.from(new Intl.Segmenter('und', {granularity: 'grapheme'}).segment(text)).length).join(''),
    node: process.version, icu: process.versions.icu, unicode: process.versions.unicode, tzdata: process.versions.tz,
    platform: process.platform, arch: process.arch
  };
  if (config.sandbox) {
    // The permission model must actually deny host font discovery.
    const require = createRequire(import.meta.url), fs = require('node:fs'), cp = require('node:child_process');
    const directories = fontDirectories();
    probe.sandbox = {
      fontDirectoriesDenied: directories.every(directory => { try { fs.readdirSync(directory); return false; } catch (error) { return error.code === 'ERR_ACCESS_DENIED'; } }),
      childProcessDenied: (() => { try { cp.spawnSync(process.execPath, ['-e', '0']); return false; } catch (error) { return error.code === 'ERR_ACCESS_DENIED'; } })(),
      permission: process.permission?.has('fs.read', directories[0]) === false
    };
    audit.length = 0; // the probe's own deliberate font-directory reads are not exporter reads
  }
  const {suites} = await import(pathToFileURL(path.join(root, 'test', 'determinism-fixtures.mjs')).href);
  const cases = await suites[config.suite](config);
  const inside = file => config.roots.some(base => contains(base, file));
  // sharp's libc detection (detect-libc) reads the running node binary, or ldd when that read is denied, when the renderer
  // loads sharp. That is process introspection, identical for every run, and not a host font, clock or locale read.
  const LIBC_DETECTION = new Set(['/proc/self/exe', '/usr/bin/ldd']);
  const outsideRoot = [...new Set(audit)].filter(file => !inside(file) && !LIBC_DETECTION.has(file));
  process.stdout.write(JSON.stringify({probe, cases, audit: {total: audit.length, outsideRoot, fontDirectoryReads: audit.filter(file => FONT_DIRECTORY.test(file) && !/(?:^|[\\/])node_modules[\\/]/.test(file) && !(bundledFonts && file.startsWith(bundledFonts)))}}));
}

// ---------------------------------------------------------------------------
// Parent process
// ---------------------------------------------------------------------------
function run(config, {tz, locale, env = {}, flags = []}) {
  const childEnv = {...process.env, ...(tz ? {TZ: tz} : {}), ...env};
  if (locale) Object.assign(childEnv, {LANG: locale, LC_ALL: locale, LANGUAGE: locale.split('.')[0].split('_')[0]});
  const child = spawnSync(process.execPath, [...flags, here, '--worker', JSON.stringify(config)], {
    env: childEnv, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024, cwd: root
  });
  const label = `${config.suite} TZ=${tz ?? '-'} LANG=${locale ?? '-'}${config.stress ? ' stress=' + config.stress : ''}${config.sandbox ? ' sandbox' : ''}`;
  assert.equal(child.error, undefined, label);
  assert.equal(child.status, 0, `${label}\n${child.stderr}`);
  return {label, ...JSON.parse(child.stdout)};
}

function describeDifferences(baseline, other) {
  const lines = [];
  for (const name of new Set([...Object.keys(baseline.cases), ...Object.keys(other.cases)])) {
    const a = baseline.cases[name], b = other.cases[name];
    if (!a || !b) { lines.push(`${name}: missing in ${a ? other.label : baseline.label}`); continue; }
    if (a.sha256 === b.sha256) continue;
    const parts = [...new Set([...Object.keys(a.parts ?? {}), ...Object.keys(b.parts ?? {})])].filter(part => a.parts?.[part] !== b.parts?.[part]);
    lines.push(`${name}: ${a.sha256.slice(0, 12)} != ${b.sha256.slice(0, 12)}${parts.length ? ' in ' + parts.slice(0, 8).join(', ') : ''}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Static inventory of host-dependent APIs (code inspection made enforceable)
// ---------------------------------------------------------------------------
// Each entry is a reviewed use. A new occurrence fails this test until a person
// decides whether it can change exported bytes and updates docs/export-determinism.md.
const VENDOR = 'vendor/pptxgenjs/pptxgen.es.js';
const HOST_APIS = [
  // The importer's tie-breaks use code-unit comparison (see importTieBreaks in the fixtures).
  ['localeCompare', /\blocaleCompare\b/, {}],
  ['toLocale*', /\btoLocale\w*/, {}],
  ['Intl', /\bIntl\b/, {}],
  // Vendored (pptxgenjs-plus 4.3.4): the font embedder's default TTF head date (addFont only; toPptx embeds no font through it).
  ['Date.now', /\bDate\.now\b|performance\.now/, {[VENDOR]: 1}],
  // Vendored, counted by line: docProps timestamps (2 PPTX-level lines, 1 workbook line with both), which
  // normalizeCoreProperties overwrites; a throttle helper (2) and the font reader (1) that never reach the package;
  // comment and revision-info dates (2), features toPptx does not use.
  ['new Date()', /new Date\(\)/, {[VENDOR]: 8}],
  // Vendored chart-colour fallback picks (3); src/index.js seeds Math.random for each export (3 lines in withDeterministicRandom).
  ['Math.random', /\bMath\.random\b/, {'src/index.js': 3, [VENDOR]: 3}],
  // Vendored debug switch (PPTXGENJS_DEBUG / NODE_DEBUG): console diagnostics only, never package bytes.
  ['process env/platform', /\bprocess\.(?:env|platform|arch|cwd|hrtime)\b/, {[VENDOR]: 2}],
  ['node builtins', /from\s+['"]node:|\brequire\(['"](?:node:)?(?:fs|os|child_process|worker_threads|net|http|https|dns)['"]/, {}],
  // Vendored getUuid (crypto.getRandomValues; 4.0.1 used Math.random). Its callers are comments, web extensions,
  // pptxgenjs sections and summary zoom, pptxgenjs chartex series and custom scatter label fields: toPptx uses none of
  // them (it writes its own sections and chartex parts), so no UUID reaches an export. The grid would catch one.
  ['random ids', /crypto\.(?:randomUUID|getRandomValues)/, {[VENDOR]: 1}]
];
function staticGuard() {
  const files = [...readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.js')).map(name => 'src/' + name), VENDOR];
  const problems = [];
  for (const [label, pattern, allowed] of HOST_APIS) {
    for (const file of files) {
      const found = readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).filter(line => pattern.test(line)).length;
      if (found !== (allowed[file] ?? 0)) problems.push(`${file}: ${label} occurs ${found} times, reviewed count is ${allowed[file] ?? 0}`);
    }
  }
  assert.deepEqual(problems, [], 'Unreviewed host-dependent API use; see docs/export-determinism.md:\n' + problems.join('\n'));
  return files.length;
}

async function parent() {
  const scanned = staticGuard();
  const started = Date.now(), results = [], failures = [];
  const scratch = mkdtempSync(path.join(tmpdir(), 'opf-determinism-'));
  const emptyFontconfig = path.join(scratch, 'fonts.conf');
  writeFileSync(emptyFontconfig, '<?xml version="1.0"?><fontconfig></fontconfig>\n');
  const noFontsEnv = {FONTCONFIG_FILE: emptyFontconfig, FONTCONFIG_PATH: scratch, XDG_DATA_DIRS: scratch, XDG_DATA_HOME: scratch};
  const roots = readRoots();
  const sandboxFlags = ['--permission', ...roots.map(base => `--allow-fs-read=${base}`)];
  try {
    const baselines = {};
    const record = (config, environment) => {
      const result = run({...config, roots}, environment);
      results.push(result);
      return result;
    };
    const compare = (result, suite) => {
      const differences = describeDifferences(baselines[suite], result);
      if (differences.length) failures.push(`${result.label}:\n  ${differences.join('\n  ')}`);
    };
    // Baseline: real clock, no patches.
    for (const suite of ['plain', 'registry', 'webp']) {
      baselines[suite] = record({suite}, {tz: 'UTC', locale: 'C'});
      assert.ok(Object.keys(baselines[suite].cases).length >= 4, suite + ' baseline has cases');
    }
    let index = 0;
    const nextClock = () => CLOCKS[index++ % CLOCKS.length];
    // Full TZ x LANG grid for the general suite.
    for (const tz of TIMEZONES) for (const locale of LOCALES) {
      if (tz === 'UTC' && locale === 'C') continue;
      compare(record({suite: 'plain', clock: nextClock(), audit: true}, {tz, locale}), 'plain');
    }
    // Diagonal grid for the slower registry and WebP suites.
    for (const suite of ['registry', 'webp']) TIMEZONES.forEach((tz, i) => {
      compare(record({suite, clock: nextClock(), audit: true}, {tz, locale: LOCALES[(i + 1) % LOCALES.length]}), suite);
    });
    // Hostile default locale, combined with unusual zones.
    for (const suite of ['plain', 'registry', 'webp']) STRESS.forEach((stress, i) => {
      compare(record({suite, stress, clock: nextClock(), audit: true}, {tz: TIMEZONES[(i + 2) % TIMEZONES.length], locale: LOCALES[(i + 3) % LOCALES.length]}), suite);
    });
    // No host fonts: permission sandbox (fonts unreadable, no subprocesses) and an empty fontconfig.
    const sandboxed = [];
    for (const suite of ['plain', 'registry', 'webp']) {
      const flags = suite === 'webp' ? [...sandboxFlags, '--allow-addons'] : sandboxFlags;
      const result = record({suite, sandbox: true, audit: true, clock: nextClock()}, {tz: 'Pacific/Chatham', locale: 'tr_TR.UTF-8', env: noFontsEnv, flags});
      sandboxed.push(result);
      compare(result, suite);
    }
    for (const result of sandboxed) {
      assert.deepEqual(result.probe.sandbox, {fontDirectoriesDenied: true, childProcessDenied: true, permission: true}, `${result.label}: sandbox must deny fonts and processes`);
    }
    // Every audited child, sandboxed or not, must stay inside this checkout.
    for (const result of results.filter(item => item.audit)) {
      assert.deepEqual(result.audit.fontDirectoryReads, [], `${result.label}: font directory read`);
      assert.deepEqual(result.audit.outsideRoot, [], `${result.label}: read outside the checkout`);
    }
    // The controls are only meaningful if they moved something.
    assert.equal(new Set(results.map(item => item.probe.offsetMinutes)).size >= 4, true, 'the TZ grid changed the host offset');
    assert.equal(new Set(results.map(item => item.probe.clock)).size >= 5, true, 'the clock grid changed Date');
    const stressed = results.filter(item => item.label.includes('stress='));
    assert.ok(stressed.every(item => item.probe.numberSample !== baselines.plain.probe.numberSample), 'hostile locale changed number formatting');
    assert.ok(stressed.every(item => item.probe.icuDefaultLocale !== baselines.plain.probe.icuDefaultLocale), 'hostile locale changed the ICU default locale');
    assert.ok(stressed.some(item => item.probe.turkishCollationDiffers), 'hostile Turkish locale changed collation: ' + JSON.stringify(stressed.map(item => ({label: item.label, lang: item.probe.lang, lcAll: item.probe.lcAll, icu: item.probe.icuDefaultLocale, differs: item.probe.turkishCollationDiffers}))));
    assert.deepEqual(failures, [], 'Exports differ across the determinism grid:\n' + failures.join('\n'));
    const localeEffective = new Set(results.filter(item => !item.label.includes('stress=')).map(item => item.probe.icuDefaultLocale));
    const manifest = {
      test: 'determinism', node: process.version, platform: process.platform, arch: process.arch, icu: process.versions.icu, unicode: process.versions.unicode,
      children: results.length, staticGuardFiles: scanned, graphemeSignature: baselines.plain.probe.graphemeSignature, envGridChangedIcuDefaultLocale: localeEffective.size > 1, icuDefaultLocalesSeen: [...localeEffective],
      scope: 'Local single-OS evidence only. Compare this manifest between operating systems for cross-OS identity.',
      cases: Object.fromEntries(['plain', 'registry', 'webp'].flatMap(suite => Object.entries(baselines[suite].cases).map(([name, value]) => [suite + ':' + name, value.sha256])))
    };
    const artifacts = process.env.OPF_DETERMINISM_ARTIFACTS;
    if (artifacts) {
      mkdirSync(path.resolve(artifacts), {recursive: true});
      writeFileSync(path.join(path.resolve(artifacts), 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    console.log(JSON.stringify({test: 'determinism', passed: true, ...manifest, cases: Object.keys(manifest.cases).length, seconds: Math.round((Date.now() - started) / 1000)}));
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}

if (process.argv[2] === '--worker') await worker(JSON.parse(process.argv[3]));
else await parent();
