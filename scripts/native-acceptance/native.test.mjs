// NT-05: `pnpm native` without any application: the arguments, the deck selection per tier (with the decks and slides that
// changelog fragments name), a whole run with a fake driver (its verbs copy prepared pictures and a prepared copy; the build
// is stubbed) reaching exit 0 and exit 1, a refused check, a target without a driver, --from-run, an output folder inside
// the repository, and --write-summary. Every deck, picture and run directory is made in a temp folder.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateSummary } from './core/classify/summary.mjs';
import { sharp } from './core/compare/picture.mjs';
import { picturePath } from './core/result/result.mjs';
import { exportHashes } from './core/select/slide-parts.mjs';
import { makePptx, sp } from './core/roundtrip/test-deck.mjs';
import { defaultOut, impressDeck, opfLine, insideRepository, lookForTarget, parseArgs, ROOT, resolveBaseline, runNative, selectFiles, UsageError } from './native.mjs';

const MANIFEST = {
  version: 'test',
  tiers: {
    smoke: { variants: 'default', decks: [{ deck: 'alpha' }], sources: ['native-fragments'] },
    release: { decks: 'all', variants: 'all' },
    full: { decks: 'all', variants: 'all', sources: ['native-fragments', 'examples'] },
  },
  sources: { 'native-fragments': 'The slides of unreleased fragments.', examples: 'Every example deck.' },
  decks: [
    { id: 'alpha', source: 'alpha.opf.json' },
    { id: 'beta', source: 'beta.opf.json', variants: [{ name: 'default', flags: [] }, { name: 'native-body', flags: ['--body-text', 'native'] }] },
  ],
  features: [],
};

const temp = (name) => mkdtempSync(path.join(tmpdir(), `nt05b-${name}-`));

// A slide picture: white with one black bar; `at` moves the bar, so two pictures with different `at` differ.
const picture = (at = 40) => sharp()(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#fff"/><rect x="${at}" y="60" width="120" height="40" fill="#000"/></svg>`)).png().toBuffer();

const deckBytes = () => makePptx({ slides: [{ shapes: [sp(2, 'Title 1', { ph: { type: 'title' }, box: [40, 40, 600, 80], paragraphs: ['One'] })] }, { shapes: [sp(2, 'Title 1', { ph: { type: 'title' }, box: [40, 40, 600, 80], paragraphs: ['Two'] })] }] });

/** A build stub: two-slide decks and their previews, and a build.json as qualification/build.mjs writes it. */
function fakeBuild(previewPng, manifest = MANIFEST) {
  const calls = [];
  const build = ({ out, decks }) => {
    calls.push(decks);
    const record = { manifestVersion: 'test', revision: 'abc', opfVersion: '0.37.0', decks: [] };
    for (const id of decks) {
      const deck = manifest.decks.find((item) => item.id === id);
      mkdirSync(path.join(out, 'preview', id), { recursive: true });
      mkdirSync(path.join(out, 'pptx'), { recursive: true });
      for (const n of [1, 2]) writeFileSync(path.join(out, 'preview', id, `slide-${n}.png`), previewPng);
      const variants = (deck.variants ?? [{ name: 'default', flags: [] }]).map((variant) => {
        const pptx = `pptx/${variant.name === 'default' ? id : `${id}~${variant.name}`}.pptx`;
        writeFileSync(path.join(out, pptx), deckBytes());
        return { name: variant.name, flags: variant.flags, pptx, ok: true, sha256: 'x', findings: [] };
      });
      record.decks.push({ id, source: deck.source, previewOk: true, previewSlides: 2, previewFindings: [], variants });
    }
    writeFileSync(path.join(out, 'build.json'), JSON.stringify(record));
    return { status: 0 };
  };
  build.calls = calls;
  return build;
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** A driver whose verbs copy prepared pictures (pictures[k] for slide k+1) and use the exported file as the application's copy. */
function fakeDriver({ refuse = false, failRender = false, pictures }) {
  const calls = [];
  const dir = (ctx, file) => path.join(ctx.runDir, 'files', file.id);
  return {
    calls,
    createContext: ({ runDir, warningsText }) => ({ runDir, warningsText, now: () => new Date('2026-11-25T12:00:00Z'), facts: null }),
    async check(ctx) {
      calls.push('check');
      if (refuse) return { status: 'refused', reasons: ['Keynote is not running. The owner starts it; the driver never does.'], facts: {} };
      ctx.facts = { application: { name: 'Keynote', version: '16.0', build: '7052.0.68' }, system: { os: 'macOS', version: '26.6.2' }, documents: [] };
      return { status: 'ready', reasons: [], facts: ctx.facts };
    },
    async open(ctx, file) {
      calls.push(`open ${file.id}`);
      mkdirSync(dir(ctx, file), { recursive: true });
      return { file, documentId: `DOC-${file.id}`, sha256Before: sha256(file.path), slideCount: 2, skipped: [], stop: false, verb: { status: 'done', seconds: 0.1, slideCount: 2, warnings: { status: 'not-read', source: null, lines: [] } } };
    },
    async probe(_ctx, handle) {
      calls.push(`probe ${handle.file.id}`);
      return { verb: { status: 'done', seconds: 0.1 }, probe: null };
    },
    async render(ctx, handle) {
      calls.push(`render ${handle.file.id}`);
      if (failRender) return { verb: { status: 'failed', seconds: 0.1, message: 'Keynote exported 0 pictures for 2 slides' }, pictures: {} };
      mkdirSync(path.join(dir(ctx, handle.file), 'slides'), { recursive: true });
      const written = {};
      pictures.forEach((bytes, k) => {
        writeFileSync(path.join(dir(ctx, handle.file), picturePath(k + 1)), bytes);
        written[k + 1] = picturePath(k + 1);
      });
      return { verb: { status: 'done', seconds: 0.1 }, pictures: written };
    },
    async resave(ctx, handle) {
      calls.push(`resave ${handle.file.id}`);
      copyFileSync(handle.file.path, path.join(dir(ctx, handle.file), 'resaved.pptx'));
      return { verb: { status: 'done', seconds: 0.1, path: 'resaved.pptx' } };
    },
    async close(_ctx, handle) {
      calls.push(`close ${handle.file.id}`);
      return { status: 'done', seconds: 0.1, state: 'CLOSED' };
    },
    sha256File: sha256,
  };
}

async function setup({ appPictures, refuse = false, failRender = false, fragments = [], manifest = MANIFEST } = {}) {
  const preview = await picture(40);
  const pictures = appPictures ?? [preview, preview];
  const driver = fakeDriver({ refuse, failRender, pictures: await Promise.all(pictures) });
  const build = fakeBuild(preview, manifest);
  const knownDir = temp('known');
  writeFileSync(path.join(knownDir, 'keynote.json'), JSON.stringify({ schemaVersion: 1, target: 'keynote', records: [] }));
  const lines = [];
  const deps = {
    log: (line) => lines.push(line),
    error: (line) => lines.push(line),
    manifest: () => manifest,
    fragments: () => fragments,
    workspace: () => ({ version: '0.37.0', commit: 'abc1234', built: true }),
    build,
    loadDriver: async () => driver,
    soffice: () => ({ program: null, pinned: '/opt/libreoffice26.8/program/soffice' }),
    importer: () => ({ status: 'imported', slideCount: 2 }),
    knownDir,
    runsDir: temp('runs'),
    home: temp('home'),
  };
  return { deps, driver, build, lines, out: path.join(temp('out'), 'native') };
}

test('arguments: defaults, lists, and the mistakes that exit 2', () => {
  const options = parseArgs(['keynote']);
  assert.equal(options.target, 'keynote');
  assert.equal(options.tier, 'smoke');
  assert.equal(options.sheets, true);
  assert.equal(options.writeSummary, false);
  const more = parseArgs(['impress', '--tier', 'release', '--decks', 'a,b', '--variants', 'default,native-body', '--look', 'a#1', '--look', 'b#2,b#3', '--baseline', 'none', '--no-sheets', '--write-summary', '--json']);
  assert.deepEqual([more.decks, more.variants, more.look, more.baseline, more.sheets, more.writeSummary, more.json], [['a', 'b'], ['default', 'native-body'], ['a#1', 'b#2', 'b#3'], 'none', false, true, true]);
  for (const argv of [[], ['word'], ['keynote', '--tier', 'huge'], ['keynote', '--look', 'a#0'], ['keynote', '--baseline', 'latest'], ['keynote', '--from-run', 'x', '--out', 'y'], ['keynote', '--from-run', 'x', '--decks', 'a'], ['keynote', '--inputs', 'x'], ['keynote', '--out'], ['keynote', '--frobnicate']]) {
    assert.throws(() => parseArgs(argv), UsageError, argv.join(' '));
  }
});

test('selection: the smoke tier, the decks fragments name, the look list, and sources the runner cannot resolve', () => {
  const fragments = [
    { fragment: 'fr-01-thing', deck: 'beta', slide: 2 },
    { fragment: 'fr-02-example', deck: 'technical/example', slide: 1 },
  ];
  const smoke = selectFiles({ manifest: MANIFEST, tier: 'smoke', fragments, look: ['alpha#1'] });
  assert.deepEqual(
    smoke.files.map((file) => file.id),
    ['alpha~default', 'beta~default'],
  );
  assert.deepEqual(smoke.look, [
    { deck: 'beta', slide: 2, reason: 'changes/fr-01-thing.md' },
    { deck: 'technical/example', slide: 1, reason: 'changes/fr-02-example.md' },
    { deck: 'alpha', slide: 1, reason: '--look' },
  ]);
  assert.equal(smoke.notRun.length, 1);
  assert.match(smoke.notRun[0].what, /technical\/example/u);
  assert.equal(smoke.notRun[0].blocking, true);

  const release = selectFiles({ manifest: MANIFEST, tier: 'release' });
  assert.deepEqual(
    release.files.map((file) => file.id),
    ['alpha~default', 'beta~default', 'beta~native-body'],
  );
  assert.deepEqual(
    selectFiles({ manifest: MANIFEST, tier: 'release', variants: ['native-body'] }).files.map((file) => file.id),
    ['beta~native-body'],
  );

  const full = selectFiles({ manifest: MANIFEST, tier: 'full' });
  assert.deepEqual(
    full.notRun.map((item) => [item.what, item.blocking]),
    [['source examples', true]],
  );
  const narrowed = selectFiles({ manifest: MANIFEST, tier: 'full', decks: ['beta'], fragments });
  assert.deepEqual(
    narrowed.files.map((file) => file.id),
    ['beta~default', 'beta~native-body'],
  );
  assert.ok(narrowed.notRun.every((item) => !item.blocking), 'a run narrowed by --decks is not stopped by a tier source');
  assert.throws(() => selectFiles({ manifest: MANIFEST, tier: 'smoke', decks: ['nope'] }), /no deck "nope"/u);

  assert.deepEqual(
    lookForTarget('impress', [{ deck: 'beta', slide: 2, reason: 'r' }], MANIFEST).map((item) => item.deck),
    ['beta', 'q-beta', 'q-beta.native-body'],
  );
  assert.equal(impressDeck('q-beta.native-body'), 'beta');
});

test('a run with a fake driver: nothing new is exit 0; the summary is written only when asked', async () => {
  const { deps, driver, build, lines, out } = await setup();
  const { exit, report } = await runNative(['keynote', '--out', out, '--baseline', 'none'], deps);
  assert.equal(exit, 0, lines.join('\n'));
  assert.deepEqual(build.calls, [['alpha']]);
  assert.deepEqual(driver.calls, ['check', 'check', 'open alpha~default', 'probe alpha~default', 'render alpha~default', 'resave alpha~default', 'close alpha~default']);
  assert.deepEqual(report.counts.slides, { same: 2, 'known-present': 0, 'known-gone': 0, new: 0, 'not-compared': 0 });
  const run = JSON.parse(readFileSync(path.join(out, 'run', 'run.json'), 'utf8'));
  assert.deepEqual([run.tier, run.baseline, run.opf], ['smoke', null, { version: '0.37.0', commit: 'abc1234' }]);
  assert.ok(existsSync(path.join(out, 'run', 'classify.json')));
  assert.ok(!existsSync(path.join(deps.runsDir, '0.37.0')), 'nothing written without --write-summary');
  assert.match(lines.join('\n'), /\[build\] done in/u);

  const again = await setup();
  const asked = await runNative(['keynote', '--out', again.out, '--baseline', 'none', '--write-summary', '--json'], again.deps);
  assert.equal(asked.exit, 0);
  const file = path.join(again.deps.runsDir, '0.37.0', 'keynote.json');
  assert.equal(asked.report.summary, file);
  assert.deepEqual(validateSummary(JSON.parse(readFileSync(file, 'utf8'))), { ok: true, errors: [] });
  const printed = JSON.parse(again.lines.at(-1));
  assert.equal(printed.exit, 0);
  assert.equal(printed.counts.files, 1);
});

test('a run with a fake driver: a slide that differs is new, exit 1, with its sheet; a changed slide is new too', async () => {
  const { deps, lines, out } = await setup({ appPictures: [picture(40), picture(180)], fragments: [{ fragment: 'fr-07-change', deck: 'alpha', slide: 1 }] });
  const { exit, report } = await runNative(['keynote', '--out', out, '--baseline', 'none'], deps);
  assert.equal(exit, 1, lines.join('\n'));
  assert.deepEqual(
    report.new.map((item) => [item.file, item.slide]),
    [
      ['alpha~default', 1],
      ['alpha~default', 2],
    ],
  );
  assert.match(report.new[0].reason, /changes\/fr-07-change\.md/u);
  assert.ok(report.new.every((item) => item.sheet && existsSync(item.sheet)), 'a sheet per new slide');
  assert.match(lines.join('\n'), /New \(look at each/u);
});

test('a refused check exits 2, opens nothing and builds nothing', async () => {
  const { deps, driver, build, lines, out } = await setup({ refuse: true });
  const { exit } = await runNative(['keynote', '--out', out], deps);
  assert.equal(exit, 2);
  assert.deepEqual(driver.calls, ['check']);
  assert.deepEqual(build.calls, []);
  assert.match(lines.join('\n'), /check refused; nothing was opened:\n {2}- Keynote is not running/u);
});

test('a verb that did not finish leaves the run unfinished: exit 2, and the report says which', async () => {
  const { deps, lines, out } = await setup({ failRender: true });
  const { exit, report } = await runNative(['keynote', '--out', out, '--baseline', 'none'], deps);
  assert.equal(exit, 2, lines.join('\n'));
  assert.equal(report.counts.slides['not-compared'], 2);
  assert.match(lines.join('\n'), /not run: render of alpha~default: failed: Keynote exported 0 pictures for 2 slides/u);
});

test('a target without a driver here exits 2 and says where its driver is', async () => {
  const { deps, build, lines } = await setup();
  assert.equal((await runNative(['powerpoint'], deps)).exit, 2);
  assert.match(lines.join('\n'), /runs on the release supervisor's Windows computer and writes a run directory; pass it with --from-run/u);
  assert.equal((await runNative(['powerpoint-mac'], deps)).exit, 2);
  assert.match(lines.join('\n'), /powerpoint-mac: no driver yet, opf#1314/u);
  assert.equal((await runNative(['impress'], deps)).exit, 2);
  assert.match(lines.join('\n'), /LibreOffice is not installed here/u);
  assert.deepEqual(build.calls, []);
});

test('--from-run classifies an existing run directory in place; a target that does not match is refused', async () => {
  const first = await setup();
  assert.equal((await runNative(['keynote', '--out', first.out, '--baseline', 'none'], first.deps)).exit, 0);
  const runDir = path.join(first.out, 'run');
  const { deps, driver, build, lines } = await setup();
  const { exit, report } = await runNative(['keynote', '--from-run', runDir, '--baseline', 'none', '--look', 'alpha#2'], deps);
  assert.equal(exit, 1, lines.join('\n'));
  assert.deepEqual(driver.calls, [], 'no driver for --from-run');
  assert.deepEqual(build.calls, []);
  assert.equal(report.steps.find((step) => step.name === 'round trip').message, 'kept: every file (and edit case) was round-tripped before');
  assert.deepEqual(
    report.new.map((item) => [item.file, item.slide, item.reason]),
    [['alpha~default', 2, 'named by a change: --look']],
  );
  assert.equal((await runNative(['impress', '--from-run', runDir], deps)).exit, 2);
  assert.match(lines.join('\n'), /is a keynote run, not impress/u);
});

test('an output folder inside the repository is refused before anything runs', async () => {
  const { deps, driver, build } = await setup();
  assert.equal((await runNative(['keynote', '--out', path.join(ROOT, 'artifacts', 'native-test')], deps)).exit, 2);
  assert.deepEqual([driver.calls, build.calls], [[], []]);
  assert.equal((await runNative(['keynote', '--from-run', path.join(ROOT, 'artifacts')], deps)).exit, 2);
  assert.ok(insideRepository(path.join(ROOT, 'scripts')));
  assert.ok(!insideRepository(tmpdir()));
});

test('the default output folder and the baseline', () => {
  const now = new Date('2026-11-25T09:08:07Z');
  const home = temp('home');
  assert.equal(defaultOut('keynote', now, { home, temp: '/tmp/x' }), path.join('/tmp/x', 'opf-native', 'keynote-20261125-090807'));
  mkdirSync(path.join(home, 'opf-work'));
  assert.equal(defaultOut('keynote', now, { home }), path.join(home, 'opf-work', 'native', 'keynote-20261125-090807'));
  const runs = temp('runs');
  for (const version of ['0.9.0', '0.36.0', '0.10.0']) {
    mkdirSync(path.join(runs, version));
    writeFileSync(path.join(runs, version, 'keynote.json'), '{}');
  }
  assert.equal(resolveBaseline('keynote', undefined, runs).version, '0.36.0');
  assert.equal(resolveBaseline('keynote', 'none', runs), null);
  assert.equal(resolveBaseline('impress', undefined, runs), null);
  assert.throws(() => resolveBaseline('keynote', '0.1.0', runs), /no runs\/0\.1\.0\/keynote\.json/u);
});

test('--release names the summary after the release, keeps the truth in run.json, and a summary is never replaced unasked', async () => {
  assert.throws(() => parseArgs(['keynote', '--release', 'next']), UsageError);
  assert.throws(() => parseArgs(['keynote', '--release', '0.37.0', '--baseline', '0.37.0']), /cannot be its own baseline/u);
  const { deps, lines, out } = await setup();
  mkdirSync(path.join(deps.runsDir, '0.36.0'));
  writeFileSync(path.join(deps.runsDir, '0.36.0', 'keynote.json'), 'the 0.36.0 baseline');
  // The workspace still says 0.37.0 here; the candidate is released as 0.38.0.
  const { exit, report } = await runNative(['keynote', '--out', out, '--baseline', 'none', '--write-summary', '--release', '0.38.0'], deps);
  assert.equal(exit, 0, lines.join('\n'));
  const file = path.join(deps.runsDir, '0.38.0', 'keynote.json');
  assert.equal(report.summary, file);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).opf, { version: '0.38.0', commit: 'abc1234' });
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'run', 'run.json'), 'utf8')).opf, { version: '0.37.0', commit: 'abc1234' });
  assert.equal(JSON.parse(readFileSync(path.join(out, 'run', 'files', 'alpha~default', 'result.json'), 'utf8')).opf.version, '0.37.0');
  assert.match(lines.join('\n'), /OPF workspace 0\.37\.0 at abc1234, release candidate 0\.38\.0/u);
  assert.equal(readFileSync(path.join(deps.runsDir, '0.36.0', 'keynote.json'), 'utf8'), 'the 0.36.0 baseline', 'the baseline is untouched');

  // --from-run writes the reviewed run later; an existing summary is refused (exit 2, after the report) unless forced.
  const runDir = path.join(out, 'run');
  const before = readFileSync(file, 'utf8');
  lines.length = 0;
  const refused = await runNative(['keynote', '--from-run', runDir, '--baseline', 'none', '--write-summary', '--release', '0.38.0'], deps);
  assert.equal(refused.exit, 2);
  assert.match(lines.join('\n'), /files opened[\s\S]*--write-summary: not written: .*0\.38\.0\/keynote\.json exists and would be replaced; pass --force-summary/u);
  assert.equal(readFileSync(file, 'utf8'), before);
  const forced = await runNative(['keynote', '--from-run', runDir, '--baseline', 'none', '--write-summary', '--release', '0.38.0', '--force-summary'], deps);
  assert.equal(forced.exit, 0);
  assert.equal(forced.report.summary, file);

  // Without --release the summary goes under the workspace version, and it too is not replaced unasked.
  const plain = await runNative(['keynote', '--from-run', runDir, '--baseline', 'none', '--write-summary'], deps);
  assert.equal(plain.exit, 0);
  assert.ok(existsSync(path.join(deps.runsDir, '0.37.0', 'keynote.json')));
  assert.equal((await runNative(['keynote', '--from-run', runDir, '--baseline', 'none', '--write-summary'], deps)).exit, 2);
});

test('the default baseline of a release candidate is the newest summary below the release', () => {
  const runs = temp('runs');
  for (const version of ['0.36.0', '0.37.0']) {
    mkdirSync(path.join(runs, version));
    writeFileSync(path.join(runs, version, 'keynote.json'), '{}');
  }
  assert.equal(resolveBaseline('keynote', undefined, runs).version, '0.37.0');
  assert.equal(resolveBaseline('keynote', undefined, runs, '0.37.0').version, '0.36.0');
  assert.equal(opfLine({ opf: { version: '0.36.0', commit: '0123456789abcdef' }, release: '0.37.0' }), 'OPF workspace 0.36.0 at 012345678, release candidate 0.37.0');
  assert.equal(opfLine({ opf: { version: '0.36.0' }, release: null }), 'OPF 0.36.0');
});

test('--tier candidate builds the release tier and opens the smoke tier and the files whose slides changed since the baseline', async () => {
  assert.equal(parseArgs(['keynote', '--tier', 'candidate']).tier, 'candidate');
  const { deps, driver, build, lines, out } = await setup();
  // The baseline: alpha and beta as the fake build exports them, beta's native-body export with another slide 2.
  const same = exportHashes(deckBytes());
  const file = (id, slides) => ({ id, sha256: 'a'.repeat(64), open: 'done', slideCount: 2, scores: [0.001, 0.001], classes: 'ss', known: {}, export: { deck: same.deck, slides } });
  const baseline = {
    schemaVersion: 1,
    target: 'keynote',
    application: { name: 'Keynote', version: '16.0' },
    system: { os: 'macOS', version: '26.6.2' },
    opf: { version: '0.36.0' },
    tier: 'release',
    date: '2026-11-25',
    settings: { threshold: 0.005, tolerance: 0.002 },
    counts: { files: 3, slides: { same: 6, 'known-present': 0, 'known-gone': 0, new: 0, 'not-compared': 0 } },
    warnings: [],
    files: [file('alpha~default', same.slides), file('beta~default', same.slides), file('beta~native-body', [same.slides[0], 'f'.repeat(16)])],
  };
  assert.deepEqual(validateSummary(baseline), { ok: true, errors: [] });
  mkdirSync(path.join(deps.runsDir, '0.36.0'));
  writeFileSync(path.join(deps.runsDir, '0.36.0', 'keynote.json'), JSON.stringify(baseline));
  const { exit, report } = await runNative(['keynote', '--tier', 'candidate', '--out', out, '--release', '0.37.0'], deps);
  assert.equal(exit, 0, lines.join('\n'));
  assert.deepEqual(build.calls, [['alpha', 'beta']], 'the whole release tier is built');
  assert.deepEqual(
    driver.calls.filter((call) => call.startsWith('open')),
    ['open alpha~default', 'open beta~native-body'],
  );
  assert.deepEqual(report.selection.skipped, ['beta~default']);
  assert.deepEqual(
    report.selection.selected.map((item) => [item.id, item.reasons]),
    [
      ['alpha~default', ['smoke tier']],
      ['beta~native-body', ['1 slide(s) changed since 0.36.0: 2']],
    ],
  );
  const text = lines.join('\n');
  assert.match(text, /files in the release tier {2}3[\s\S]*unchanged, skipped {9}1[\s\S]*selected {19}2[\s\S]*slides changed {13}1/u);
  assert.match(text, /slides whose export changed since 0\.36\.0 {2}1/u);
  assert.equal(JSON.parse(readFileSync(path.join(out, 'run', 'run.json'), 'utf8')).tier, 'candidate');
  const classified = JSON.parse(readFileSync(path.join(out, 'run', 'classify.json'), 'utf8'));
  const native = classified.files.find((item) => item.id === 'beta~native-body');
  assert.deepEqual(native.export, { deck: same.deck, slides: same.slides });
  assert.deepEqual(
    native.slides.map((slide) => slide.changed ?? false),
    [false, true],
  );
});

test('--tier candidate builds the source decks the release tier names (NT-10 groups), not the rest of their group', async () => {
  const manifest = {
    ...MANIFEST,
    tiers: { ...MANIFEST.tiers, release: { ...MANIFEST.tiers.release, sources: [{ source: 'stress', decks: [{ deck: 'gamma', why: 'a known record names it' }] }] } },
    sources: { ...MANIFEST.sources, stress: 'Stress decks.' },
    decks: [...MANIFEST.decks, { id: 'gamma', source: 'gamma.opf.json', group: 'stress' }, { id: 'delta', source: 'delta.opf.json', group: 'stress' }],
  };
  const { deps, build, lines, out } = await setup({ manifest });
  const { exit, report } = await runNative(['keynote', '--tier', 'candidate', '--out', out, '--baseline', 'none'], deps);
  assert.ok(exit === 0 || exit === 1, lines.join('\n'));
  assert.deepEqual(build.calls, [['alpha', 'beta', 'gamma']], 'the release tier with its source deck is built');
  assert.equal(report.selection.total, 4, 'gamma~default is among the hashed release files');
  assert.deepEqual(report.notRun, []);
});
