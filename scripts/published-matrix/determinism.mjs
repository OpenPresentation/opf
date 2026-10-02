// FF-11: export and preview determinism of the published packages (RR-04).
//
// Re-runs the matrix's determinism subset (scripts/test-font-switch-ecosystem.mjs --determinism: PPTX bytes, SVG and PNG
// digests of a bounded set of decks, every script, every chart path) in child Node processes and requires every digest to
// equal the baseline child's (TZ=UTC, LANG=C, real clock), across:
//   * a time zone x locale grid: UTC, America/Los_Angeles, Asia/Kolkata, Pacific/Chatham against en-US, de-DE, ja-JP, ar;
//   * a different simulated wall clock in every child;
//   * a hostile default locale (Intl and toLocale* rebound to tr-TR, de-DE, ar-EG with Arabic digits, th-TH Thai calendar),
//     because Node on Windows ignores LANG for the ICU default locale;
//   * no host fonts: `node --permission` with reads limited to the consumer, the matrix scripts and the fixtures (system font
//     directories unreadable, no subprocesses) and an empty fontconfig, plus an fs audit that no child reads a font directory;
//   * host fonts visible to the rasterizer (resvg loadSystemFonts): PPTX and SVG still identical; PNG differences are only
//     recorded, because that option asks resvg to prefer host faces.
// The manifest (determinism.json) carries the environment probes and the baseline digests; compare.mjs compares across OSes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {diffDigests} from './digests.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = path.resolve(here, '..', '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const consumer = realpathSync(path.resolve(option('--consumer', path.join(core, 'artifacts', 'published-matrix', 'consumer'))));
const outDir = path.resolve(option('--out', path.join(core, 'artifacts', 'published-matrix', 'determinism')));
const concurrency = Number(option('--concurrency', '2'));
const matrixScript = path.join(core, 'scripts', 'test-font-switch-ecosystem.mjs');
const engines = path.join(consumer, 'engines-installed.mjs');
assert.ok(existsSync(engines), `prepare the consumer first: ${engines} is missing`);

const fontDirectories = process.platform === 'win32' ? [path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts')] : ['/usr/share/fonts', '/usr/local/share/fonts', '/Library/Fonts', '/System/Library/Fonts'];
const FONT_DIRECTORY = /(?:^|[\\/])(?:fonts?|\.fonts|fontconfig)(?:[\\/]|$)/i;
const TIMEZONES = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Chatham'];
const LOCALES = ['en_US.UTF-8', 'de_DE.UTF-8', 'ja_JP.UTF-8', 'ar_SA.UTF-8'];
const STRESS = ['tr-TR', 'de-DE', 'ar-EG-u-nu-arab', 'th-TH-u-nu-thai-ca-buddhist'];
const CLOCKS = ['1980-06-15T12:34:56.789Z', '2038-01-19T03:14:07Z', '2026-02-28T23:59:59Z', '2090-07-01T12:00:00Z', '2024-02-29T00:00:00Z', '2026-12-31T23:59:59.999Z'];
let clockIndex = 0;
const nextClock = () => CLOCKS[clockIndex++ % CLOCKS.length];

const scratch = path.join(tmpdir(), `opf-published-determinism-${process.pid}`);
rmSync(scratch, {recursive: true, force: true});
mkdirSync(scratch, {recursive: true});
const emptyFontconfig = path.join(scratch, 'fonts.conf');
writeFileSync(emptyFontconfig, '<?xml version="1.0"?><fontconfig></fontconfig>\n');
const noFontsEnv = {FONTCONFIG_FILE: emptyFontconfig, FONTCONFIG_PATH: scratch, XDG_DATA_DIRS: scratch, XDG_DATA_HOME: scratch};
const inside = (base, file) => {
  const relative = path.relative(base, file);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};

function sandboxFlags(childOut) {
  const reads = [consumer, path.join(core, 'scripts'), path.join(core, 'docs', 'fixtures')];
  // detect-libc (sharp) reads the running executable on Linux to tell glibc from musl.
  if (process.platform === 'linux') reads.push('/proc/self/exe', realpathSync(process.execPath));
  for (const base of reads) for (const fonts of fontDirectories) assert.ok(!inside(base, fonts), `sandbox read root ${base} would allow the font directory ${fonts}`);
  return ['--permission', ...reads.map((base) => `--allow-fs-read=${base}`), `--allow-fs-write=${childOut}`, '--allow-addons'];
}

// Decoy host fonts: bundled faces re-labelled (same-length family names patched in the name table) as the families a preview
// draws with, so a host font that shadowed a bundled face would change the PNG. The matrix proves the decoys draw differently
// when they are the only faces.
const decoys = path.join(scratch, 'decoy-fonts');
mkdirSync(decoys, {recursive: true});
const faces = path.join(consumer, 'node_modules', '@expo-google-fonts');
for (const [file, from, to] of [
  ['cousine/400Regular/Cousine_400Regular.ttf', 'Cousine', 'Carlito'],
  ['cousine/700Bold/Cousine_700Bold.ttf', 'Cousine', 'Carlito'],
  ['cousine/400Regular/Cousine_400Regular.ttf', 'Cousine', 'Gelasio'],
  ['arimo/400Regular/Arimo_400Regular.ttf', 'Arimo', 'Tinos'],
  ['arimo/400Regular/Arimo_400Regular.ttf', 'Arimo', 'Intos']
]) {
  const bytes = Buffer.from(readFileSync(path.join(faces, file)));
  assert.equal(from.length, to.length, 'decoy names keep the name table offsets');
  const utf16 = (text) => Buffer.from(text, 'utf16le').swap16();
  let patched = 0;
  for (const [a, b] of [[Buffer.from(from, 'latin1'), Buffer.from(to, 'latin1')], [utf16(from), utf16(to)]]) {
    for (let at = bytes.indexOf(a); at !== -1; at = bytes.indexOf(a, at + a.length)) {
      b.copy(bytes, at);
      patched++;
    }
  }
  assert.ok(patched > 0, `${file} carries the family name ${from}`);
  writeFileSync(path.join(decoys, `${to}-${path.basename(file)}`), bytes);
}

const scenarios = [{id: 'baseline', tz: 'UTC', locale: 'C'}];
for (const [index, tz] of TIMEZONES.entries()) {
  for (const locale of [LOCALES[index], LOCALES[(index + 1) % LOCALES.length]]) scenarios.push({id: `env ${tz} ${locale.split('.')[0]}`, tz, locale, clock: nextClock(), audit: true});
}
for (const [index, stress] of STRESS.entries()) scenarios.push({id: `stress ${stress}`, tz: TIMEZONES[(index + 2) % TIMEZONES.length], locale: LOCALES[(index + 3) % LOCALES.length], stress, clock: nextClock(), audit: true});
scenarios.push({id: 'no host fonts (sandbox)', tz: 'Pacific/Chatham', locale: 'tr_TR.UTF-8', clock: nextClock(), audit: true, sandbox: true});
scenarios.push({id: 'no host fonts (sandbox, ar)', tz: 'Asia/Kolkata', locale: 'ar_SA.UTF-8', stress: 'ar-EG-u-nu-arab', clock: nextClock(), audit: true, sandbox: true});
scenarios.push({id: 'host fonts named like the bundled faces', tz: 'Asia/Kolkata', locale: 'ja_JP.UTF-8', clock: nextClock(), audit: true, systemFonts: true, decoys: true});
scenarios.push({id: 'host fonts visible to resvg', tz: 'America/Los_Angeles', locale: 'de_DE.UTF-8', clock: nextClock(), audit: true, systemFonts: true, pngInformational: true});

function runChild(scenario) {
  const childOut = path.join(scratch, scenario.id.replace(/[^a-z0-9]+/gi, '-'));
  mkdirSync(childOut, {recursive: true});
  const env = {
    ...process.env,
    ...(scenario.tz ? {TZ: scenario.tz} : {}),
    ...(scenario.sandbox ? noFontsEnv : {}),
    OPF_MATRIX_ENGINES: engines,
    OPF_MATRIX_OUT: childOut,
    OPF_DET: JSON.stringify({clock: scenario.clock, stress: scenario.stress, audit: scenario.audit, sandbox: scenario.sandbox, fontDirectories}),
    ...(scenario.systemFonts ? {OPF_MATRIX_SYSTEM_FONTS: '1'} : {}),
    ...(scenario.decoys ? {OPF_MATRIX_FONT_DIRS: decoys} : {})
  };
  if (scenario.locale) Object.assign(env, {LANG: scenario.locale, LC_ALL: scenario.locale, LANGUAGE: scenario.locale.split('.')[0].split('_')[0]});
  const flags = scenario.sandbox ? sandboxFlags(childOut) : [];
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...flags, '--import', pathToFileURL(path.join(here, 'determinism-preload.mjs')).href, matrixScript, '--determinism'], {env, cwd: core, stdio: ['ignore', 'pipe', 'pipe']});
    let stderr = '';
    child.stdout.on('data', () => {});
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    const timer = setTimeout(() => child.kill(), 600000);
    child.on('close', (status) => {
      clearTimeout(timer);
      const read = (name) => (existsSync(path.join(childOut, name)) ? JSON.parse(readFileSync(path.join(childOut, name), 'utf8')) : null);
      const seconds = Math.round((Date.now() - started) / 1000);
      console.log(`${status === 0 ? 'ok  ' : 'FAIL'} ${scenario.id} (${seconds} s)`);
      resolve({scenario, status, seconds, stderr, digests: read('digests.json'), probe: read('probe.json'), audit: read('audit.json')});
    });
  });
}

// The baseline first, then the rest with bounded concurrency.
const results = [await runChild(scenarios[0])];
const queue = scenarios.slice(1);
await Promise.all(
  Array.from({length: Math.max(1, concurrency)}, async () => {
    while (queue.length) results.push(await runChild(queue.shift()));
  })
);
const baseline = results.find((result) => result.scenario.id === 'baseline');
assert.equal(baseline.status, 0, `baseline failed:\n${baseline.stderr}`);
const failures = [];
const informational = [];
const states = Object.keys(baseline.digests.digests);
assert.ok(states.length >= 80, `the baseline has ${states.length} states`);
for (const result of results) {
  const {scenario} = result;
  if (result.status !== 0 || !result.digests) {
    failures.push(`${scenario.id}: exit ${result.status}\n${result.stderr}`);
    continue;
  }
  const {differing, informational: pngOnly} = diffDigests(baseline.digests.digests, result.digests.digests, {ignore: scenario.pngInformational ? ['png'] : []});
  informational.push(...pngOnly);
  if (differing.length) failures.push(`${scenario.id}: ${differing.length} digests differ from the baseline, for example ${differing.slice(0, 6).join(', ')}`);
  if (scenario.sandbox && JSON.stringify(result.probe?.sandbox) !== JSON.stringify({fontDirectoriesDenied: true, childProcessDenied: true, permission: true})) failures.push(`${scenario.id}: the sandbox must deny font directories and subprocesses: ${JSON.stringify(result.probe?.sandbox)}`);
  if (result.audit) {
    const fontReads = result.audit.filter((file) => FONT_DIRECTORY.test(file) && !/(?:^|[\\/])node_modules[\\/]/.test(file));
    if (fontReads.length) failures.push(`${scenario.id}: read a font directory: ${fontReads.slice(0, 5).join(', ')}`);
  }
}
// The controls only mean something if they moved the environment.
const probes = results.filter((result) => result.probe).map((result) => result.probe);
const distinct = (key) => new Set(probes.map((probe) => probe[key])).size;
const controls = {offsets: distinct('offsetMinutes'), clocks: distinct('clock'), numberFormats: distinct('numberSample'), icuDefaultLocales: distinct('icuDefaultLocale')};
if (controls.offsets < 4) failures.push(`the time zone grid changed the host offset in only ${controls.offsets} ways`);
if (controls.clocks < 5) failures.push(`the clock grid changed Date in only ${controls.clocks} ways`);
if (controls.numberFormats < 3) failures.push(`the locale controls changed number formatting in only ${controls.numberFormats} ways`);
if (!probes.some((probe) => probe.turkishCollationDiffers)) failures.push('the Turkish locale controls did not change collation');
if (new Set(probes.map((probe) => probe.graphemeSignature)).size !== 1) failures.push('Intl.Segmenter grapheme segmentation depends on the locale or time zone');
if (new Set(probes.map((probe) => probe.tzdata)).size !== 1) failures.push('children saw different tz databases');

mkdirSync(outDir, {recursive: true});
writeFileSync(path.join(outDir, 'baseline-digests.json'), `${JSON.stringify(baseline.digests, null, 1)}\n`);
const manifest = {
  test: 'published-determinism',
  passed: failures.length === 0,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  icu: process.versions.icu,
  unicode: process.versions.unicode,
  tzdata: process.versions.tz,
  graphemeSignature: baseline.probe.graphemeSignature,
  states: states.length,
  children: results.length,
  controls,
  pngInformationalDifferences: informational.length,
  scenarios: results
    .map((result) => ({id: result.scenario.id, tz: result.scenario.tz, locale: result.scenario.locale, stress: result.scenario.stress ?? null, clock: result.scenario.clock ?? null, sandbox: Boolean(result.scenario.sandbox), systemFonts: Boolean(result.scenario.systemFonts), status: result.status, seconds: result.seconds, icuDefaultLocale: result.probe?.icuDefaultLocale, resolvedTimeZone: result.probe?.resolvedTimeZone, numberSample: result.probe?.numberSample, auditedReads: result.audit?.length ?? null}))
    .sort((a, b) => a.id.localeCompare(b.id, 'en')),
  failures
};
writeFileSync(path.join(outDir, 'determinism.json'), `${JSON.stringify(manifest, null, 1)}\n`);
rmSync(scratch, {recursive: true, force: true});
console.log(JSON.stringify({test: 'published-determinism', passed: manifest.passed, children: manifest.children, states: manifest.states, controls, pngInformationalDifferences: informational.length}));
assert.deepEqual(failures, [], `Outputs differ across the determinism grid:\n${failures.join('\n')}`);
