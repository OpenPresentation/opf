// NT-04c: the classification rule, the command's exit codes, the summary and the committed 0.36.0 baseline, on small
// hand-built JSON (no picture, deck or log).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { emptyResult, runFileEntry } from '../result/result.mjs';
import { classesFromGrades, gradedFileId, parseArgs, summaryTier } from './baseline-from-round.mjs';
import { activeRecords, CALIBRATION, classifyResults, classifyRun, classifySlide, importCode, kindTotals, lookList, recordsExplaining, sameExport, validateClassify } from './classify.mjs';
import { main } from './classify-run.mjs';
import { baselineOf, formatSummary, summarize, validateSummary } from './summary.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = mkdtempSync(path.join(tmpdir(), 'nt-04c-classify-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const T = CALIBRATION.threshold;
const TOL = CALIBRATION.tolerance;
const sha = 'a'.repeat(64);

const record = (id, where, extra = {}) => ({ id, status: 'open', feature: 'charts', firstSeen: { application: '16.0', opf: '0.35.1' }, where, ...extra });
const known = {
  schemaVersion: 1,
  target: 'keynote',
  records: [
    record('kn-chart-title', [{ deck: 'charts', slide: 2 }]),
    record('kn-native-only', [{ deck: 'charts', variant: 'native', slide: 3 }], { feature: 'text' }),
    record('kn-retired', [{ deck: 'charts', slide: 3 }], { status: 'retired' }),
    record('kn-later', [{ deck: 'later', slide: 2 }], { firstSeen: { application: '16.0', opf: '0.36.0' } }),
    record('kn-missing-fonts', [], { scope: 'default-theme', feature: 'fonts', warning: ['The font Aptos is missing. Your text might look different.'] }),
    record('kn-unsupported-media', [], { scope: 'default-theme', feature: 'warnings', warning: 'Unsupported media were removed. Slide Layout(s): Cover, Gallery' }),
    record('kn-import-chart', [{ deck: 'charts', slide: 1 }], { feature: 'round-trip', importError: 'invalid-chart-cache' }),
    record('kn-other-round-trip', [{ deck: 'words', slide: 1 }], { feature: 'round-trip' }),
  ],
};

/** A valid result: one slide per score (null = hidden slide, undefined = not compared yet). */
function result(deck, variant, scores, { open = 'done', lines = [], importStatus, outcomes = [] } = {}) {
  const value = emptyResult({
    target: 'keynote',
    application: { name: 'Keynote', version: '16.0' },
    system: { os: 'macOS', version: '26.6.2' },
    opf: { version: '0.37.0' },
    file: { deck, variant, path: `${deck}/${variant}.pptx`, sha256: sha },
    started: '2026-11-25T10:00:00Z',
  });
  value.verbs.open = { status: open, slideCount: scores.length, warnings: { status: lines.length ? 'read' : 'not-read', source: lines.length ? 'screen' : null, lines } };
  value.verbs.render = { status: 'done' };
  if (importStatus) value.verbs.resave = { status: 'done', path: 'resaved.pptx', import: { status: importStatus, ...(importStatus === 'failed' ? { error: 'invalid-chart-cache: Invalid chart cache: point index is outside its declared count.' } : {}) } };
  value.slides = scores.map((score, position) => {
    const index = position + 1;
    const hidden = score === null;
    const slide = { index, hidden, layout: null, picture: hidden ? null : `slides/slide-00${index}.png`, notes: null, objects: [] };
    if (score !== undefined) slide.compare = hidden ? { preview: null, score: null, note: 'hidden slide: the application exported no picture' } : { preview: `preview/${deck}/slide-${index}.png`, score };
    return slide;
  });
  value.slides[0]?.objects.push(...outcomes.map(([kind, outcome]) => ({ kind, outcome })));
  return value;
}

/** A baseline as readBaseline returns it, from { id: [classes string, scores, known] }. */
function baseline(files, warnings = []) {
  return baselineOf({
    schemaVersion: 1,
    target: 'keynote',
    application: { name: 'Keynote', version: '16.0' },
    system: { os: 'macOS', version: '26.6.2' },
    opf: { version: '0.36.0' },
    tier: null,
    date: '2026-11-25',
    settings: { ...CALIBRATION },
    counts: { files: 0, slides: { same: 0, 'known-present': 0, 'known-gone': 0, new: 0, 'not-compared': 0 } },
    warnings,
    files: Object.entries(files).map(([id, [classes, scores, knownIds = {}, extra = {}]]) => ({ id, sha256: sha, open: 'done', slideCount: scores.length, scores, classes, known: knownIds, ...extra })),
  });
}

test('the rule: every branch of one slide', () => {
  const ambient = ['kn-missing-fonts'];
  const one = (score, named = [], base = null) => classifySlide({ score, named, base, ambient, threshold: T, tolerance: TOL });
  assert.equal(one(null).class, 'not-compared');
  assert.equal(one(T).class, 'same');
  assert.deepEqual(one(0.001, ['kn-a']), { class: 'known-gone', known: ['kn-a'], reasons: [`score 0.001 <= ${T}: the named records no longer show`] });
  assert.deepEqual(one(0.05, ['kn-a']).known, ['kn-a']);
  assert.equal(one(0.05, ['kn-a']).class, 'known-present');
  assert.equal(one(0.05).class, 'new');
  assert.match(one(0.05, [], { class: 'new', score: 0.05, known: [] }).reasons[0], /left it new/);
  assert.match(one(0.05, [], { class: 'not-compared', score: null, known: [] }).reasons[0], /did not compare/);
  assert.match(one(0.05, [], { class: 'known-present', score: 0.05 + TOL * 2, known: [] }).reasons[0], /moved/);
  assert.deepEqual(one(0.05, [], { class: 'known-present', score: 0.05 + TOL, known: ['kn-b'] }).known, ['kn-b']);
  assert.deepEqual(one(0.05, [], { class: 'same', score: 0.0505, known: [] }), {
    class: 'known-present',
    known: ambient,
    reasons: [`reviewed in the baseline (same, score 0.0505), unchanged within ${TOL}`],
  });
  assert.equal(one(0.05, [], { class: 'known-gone', score: 0.05, known: [] }).class, 'known-present');
  // A record does not mask a move: a reviewed baseline slide that moved is looked at again, with a direction.
  assert.deepEqual(classifySlide({ score: 0.08, named: ['kn-a'], base: { class: 'known-present', score: 0.05, known: ['kn-a'] }, baseOpf: '0.36.0', ambient, threshold: T, tolerance: TOL }), {
    class: 'new',
    known: ['kn-a'],
    direction: 'up',
    reasons: ['moved since the 0.36.0 baseline: 0.05 → 0.08'],
  });
  assert.equal(one(0.03, ['kn-a'], { class: 'same', score: 0.05, known: [] }).direction, 'down');
  // A move at or below T is same (or known-gone), not new; an unreviewed baseline slide falls through to the record.
  assert.equal(one(0.004, [], { class: 'known-present', score: 0.05, known: [] }).class, 'same');
  assert.equal(one(0.08, ['kn-a'], { class: 'new', score: 0.05, known: [] }).class, 'known-present');
  // A slide a change names is new whatever the score, even when it has no picture pair.
  const looked = (score) => classifySlide({ score, named: [], base: { class: 'same', score, known: [] }, ambient, threshold: T, tolerance: TOL, look: 'MX-01 flush lines' });
  assert.deepEqual(looked(0.001), { class: 'new', known: [], reasons: ['named by a change: MX-01 flush lines'] });
  assert.equal(looked(0.05).class, 'new');
  assert.equal(looked(null).class, 'new');
});

test('look lists and import codes', () => {
  assert.deepEqual([...lookList(['charts#2', { deck: 'words', slide: 3, reason: 'M16' }])], [
    ['charts#2', 'listed to look at'],
    ['words#3', 'M16'],
  ]);
  assert.throws(() => lookList(['charts']), /is not deck#slide/);
  assert.throws(() => lookList(['charts#0']), /is not deck#slide/);
  assert.equal(importCode('invalid-chart-cache: Invalid chart cache'), 'invalid-chart-cache');
  assert.equal(importCode('unsupported-chart-cache'), 'unsupported-chart-cache');
  assert.equal(importCode('Error: something else'), null);
  assert.equal(importCode(undefined), null);
  assert.deepEqual(kindTotals({ 'text.native': 2, 'text.changed': 1, 'chart.picture': 1 }), { text: 3, chart: 1 });
});

test('records: open only, an absent variant is default, native-body is native, knownBefore, warnings without the layout list', () => {
  assert.equal(sameExport(undefined, 'default'), true);
  assert.equal(sameExport(undefined, 'native'), false);
  assert.equal(sameExport('native', 'native-body'), true);
  assert.equal(sameExport('native', 'static'), false);
  const ids = (options) => activeRecords(known, options).map((item) => item.id);
  assert.equal(ids().includes('kn-retired'), false);
  assert.equal(ids().includes('kn-later'), true);
  assert.equal(ids({ knownBefore: '0.36.0' }).includes('kn-later'), false);
  const records = activeRecords(known);
  assert.deepEqual(recordsExplaining(records, { text: 'Unsupported media were removed.', layouts: ['Cover', 'Hero'] }), ['kn-unsupported-media']);
  assert.deepEqual(recordsExplaining(records, { text: 'The font Aptos is missing. Your text might look different.' }), ['kn-missing-fonts']);
  assert.deepEqual(recordsExplaining(records, { text: 'SVG images were converted to PNG.' }), []);
});

test('classifyResults: slides by record, by baseline and new; known-gone listed; counts', () => {
  const results = [result('charts', 'default', [0.002, 0.04, 0.05, 0.06, null]), result('charts', 'native-body', [0.04, 0.04, 0.04])];
  const base = baseline({ 'charts~default': ['skkkk', [0.01, 0.04, 0.0505, 0.03, 0.02], { 4: ['kn-chart-title'] }] });
  const out = classifyResults({ results, known, baseline: base });
  const [first, second] = out.files;
  assert.deepEqual(
    first.slides.map((slide) => [slide.class, slide.known]),
    [
      ['known-gone', ['kn-import-chart']],
      ['known-present', ['kn-chart-title']],
      ['known-present', ['kn-missing-fonts']],
      ['new', []],
      ['not-compared', []],
    ],
  );
  assert.deepEqual(first.slides[3].reasons, ['moved since the 0.36.0 baseline: 0.03 → 0.06']);
  assert.equal(first.slides[3].direction, 'up');
  // A change names charts#2: new in every variant of the deck.
  const named = classifyResults({ results, known, baseline: base, options: { look: [{ deck: 'charts', slide: 2, reason: 'M16' }] } });
  assert.deepEqual(
    named.files.map((file) => file.slides[1].class),
    ['new', 'new'],
  );
  assert.equal(named.settings.look, 1);
  assert.deepEqual(
    second.slides.map((slide) => slide.class),
    ['new', 'new', 'known-present'],
  );
  assert.deepEqual(second.slides[2].known, ['kn-native-only']);
  assert.deepEqual(out.knownGone, [{ record: 'kn-import-chart', deck: 'charts', variant: 'default', slide: 1 }]);
  assert.deepEqual(out.counts.slides, { same: 0, 'known-present': 3, 'known-gone': 1, new: 3, 'not-compared': 1 });
  assert.equal(out.counts.new, 3);
  // The retired record names charts#3 and does not count; kn-later is left out with knownBefore.
  assert.equal(out.files[0].slides[2].known.includes('kn-retired'), false);
  const later = [result('later', 'default', [0.04, 0.04])];
  assert.deepEqual(
    classifyResults({ results: later, known }).files[0].slides.map((slide) => slide.class),
    ['new', 'known-present'],
  );
  assert.deepEqual(
    classifyResults({ results: later, known, options: { knownBefore: '0.36.0' } }).files[0].slides.map((slide) => slide.class),
    ['new', 'new'],
  );
});

test('classifyResults: file-level findings for open, warnings, import and outcomes', () => {
  const lines = [{ text: 'Unsupported media were removed.', layouts: ['Cover'] }, { text: 'SVG images were converted to PNG.' }, { text: 'The font Roboto is missing. Your text might look different.' }];
  const results = [
    result('charts', 'default', [0.04], { lines, importStatus: 'failed', outcomes: [['chart', 'native']] }),
    result('tables', 'default', [], { open: 'failed' }),
    result('words', 'default', [0.002], { importStatus: 'failed', outcomes: [['text', 'native'], ['text', 'changed']] }),
    result('lists', 'default', [0.002], { importStatus: 'failed', outcomes: [['list', 'native']] }),
  ];
  const base = baseline(
    {
      'tables~default': ['', [], {}, { open: 'failed' }],
      'words~default': ['s', [0.002], {}, { outcomes: { 'text.native': 2 } }],
      'lists~default': ['s', [0.002], {}, { outcomes: { 'list.native': 2 }, import: 'failed', importError: 'invalid-chart-cache' }],
    },
    [{ text: 'SVG images were converted to PNG.', files: 1 }],
  );
  const out = classifyResults({ results, known, baseline: base });
  const findings = out.files.map((file) => file.findings.map((finding) => [finding.kind, finding.class, finding.known]));
  assert.deepEqual(findings[0], [
    ['warning', 'known-present', ['kn-unsupported-media']],
    ['warning', 'known-present', []],
    ['warning', 'new', []],
    ['import', 'known-present', ['kn-import-chart']],
  ]);
  assert.deepEqual(findings[1], [['open', 'known-present', []]]);
  // words: a round-trip record names the file but carries no importError, so it does not explain the failure.
  assert.deepEqual(findings[2], [
    ['import', 'new', []],
    ['outcomes', 'new', []],
  ]);
  assert.match(out.files[2].findings[1].text, /text\.changed 0 -> 1, text\.native 2 -> 1/);
  // lists: the baseline's import failed the same way; one list instead of two, so the outcomes are not compared.
  assert.deepEqual(findings[3], [['import', 'known-present', []]]);
  assert.deepEqual(out.files[3].notes, ['content changed since the baseline; outcome counts not compared']);
  assert.deepEqual(out.counts.findings, { 'known-present': 5, new: 3 });
  assert.equal(out.counts.new, 3);
  // The same failure with another code is not covered by the baseline.
  const otherCode = baseline({ 'lists~default': ['s', [0.002], {}, { import: 'failed', importError: 'unsupported-chart-cache' }] });
  assert.equal(classifyResults({ results: [results[3]], known, baseline: otherCode }).files[0].findings[0].class, 'new');
  // Without a baseline the failed open is new and outcomes are not compared.
  const alone = classifyResults({ results, known });
  assert.deepEqual(
    alone.files[1].findings.map((finding) => finding.class),
    ['new'],
  );
  assert.equal(
    alone.files[2].findings.some((finding) => finding.kind === 'outcomes'),
    false,
  );
});

/** A run directory with these results. */
function writeRun(name, results, { check = { status: 'ready', reasons: [] } } = {}) {
  const dir = path.join(scratch, name);
  for (const item of results) {
    mkdirSync(path.join(dir, 'files', item.file.id), { recursive: true });
    writeFileSync(path.join(dir, 'files', item.file.id, 'result.json'), JSON.stringify(item));
  }
  const run = {
    schemaVersion: 1,
    target: 'keynote',
    application: { name: 'Keynote', version: '16.0' },
    system: { os: 'macOS', version: '26.6.2' },
    fonts: 'installed',
    opf: { version: '0.37.0' },
    tier: 'smoke',
    baseline: null,
    started: '2026-11-25T10:00:00Z',
    finished: '2026-11-25T10:05:00Z',
    check,
    files: results.map(runFileEntry),
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run));
  return dir;
}

test('classifyRun writes a valid classify.json; the command exits 0, 1 and 2', async () => {
  const knownFile = path.join(scratch, 'known.json');
  writeFileSync(knownFile, JSON.stringify(known));
  const quiet = { log: () => {} };
  const clean = writeRun('clean', [result('charts', 'default', [0.002, 0.04])]);
  assert.equal(await main(['--run', clean, '--known', knownFile], quiet), 0);
  const written = JSON.parse(readFileSync(path.join(clean, 'classify.json'), 'utf8'));
  assert.deepEqual(validateClassify(written), { ok: true, errors: [] });
  const lookFile = path.join(scratch, 'look.json');
  writeFileSync(lookFile, JSON.stringify([{ deck: 'charts', slide: 1, reason: 'M16' }]));
  assert.equal(await main(['--run', clean, '--known', knownFile, '--look', 'charts#2'], quiet), 1);
  assert.equal(await main(['--run', clean, '--known', knownFile, '--look-file', lookFile], quiet), 1);
  assert.equal(await main(['--run', clean, '--known', knownFile, '--look', 'charts'], quiet), 2);
  assert.equal(await main(['--run', clean, '--known', knownFile], quiet), 0);
  assert.equal(written.tier, 'smoke');
  assert.equal(written.baseline, null);

  const lines = [];
  const fresh = writeRun('fresh', [result('charts', 'default', [0.002, 0.04, 0.04])]);
  assert.equal(await main(['--run', fresh, '--known', knownFile], { log: (line) => lines.push(line) }), 1);
  assert.ok(lines.some((line) => line.startsWith('new: charts~default slide 3')));

  assert.equal(await main(['--run', path.join(scratch, 'missing'), '--known', knownFile], quiet), 2);
  assert.equal(await main(['--run', writeRun('refused', [result('charts', 'default', [0.04])], { check: { status: 'refused', reasons: ['the screen is locked'] } }), '--known', knownFile], quiet), 2);
  assert.equal(await main(['--run', writeRun('uncompared', [result('charts', 'default', [undefined])]), '--known', knownFile], quiet), 2);
  assert.equal(await main(['--run', clean], quiet), 2);
  assert.equal(await main(['--run', clean, '--known', knownFile, '--bogus'], quiet), 2);
  assert.throws(() => classifyRun({ runDir: clean, known: { ...known, target: 'impress' } }), /known records are for impress/);
});

test('summary: compact, valid, and read back as the same baseline', async () => {
  const results = [result('charts', 'default', [0.002, 0.04, 0.05, null], { lines: [{ text: 'SVG images were converted to PNG.' }], importStatus: 'imported', outcomes: [['chart', 'native']] }), result('words', 'native', [0.1])];
  const classified = classifyResults({ results, known });
  const summary = summarize({ run: { target: 'keynote', application: results[0].application, system: results[0].system, opf: results[0].opf, tier: null, finished: '2026-11-25T10:05:00Z' }, results, classified: classified.files, settings: CALIBRATION, note: 'test' });
  assert.deepEqual(validateSummary(summary), { ok: true, errors: [] });
  assert.equal(summary.files[0].classes, 'gkn-');
  assert.deepEqual(summary.files[0].known, { 1: ['kn-import-chart'], 2: ['kn-chart-title'] });
  assert.deepEqual(summary.files[0].outcomes, { 'chart.native': 1 });
  assert.equal(summary.files[0].import, 'imported');
  const failed = summarize({ run: { target: 'keynote', application: results[0].application, system: results[0].system, opf: results[0].opf, tier: null, finished: '2026-11-25T10:05:00Z' }, results: [result('lists', 'default', [0.04], { importStatus: 'failed' })], classified: classifyResults({ results: [result('lists', 'default', [0.04], { importStatus: 'failed' })], known }).files, settings: CALIBRATION });
  assert.equal(failed.files[0].importError, 'invalid-chart-cache');
  assert.equal(baselineOf(failed).files.get('lists~default').importError, 'invalid-chart-cache');
  assert.deepEqual(summary.warnings, [{ text: 'SVG images were converted to PNG.', files: 1 }]);
  const text = formatSummary(summary);
  assert.equal(text.split('\n').filter((line) => line.includes('"sha256"')).length, 2, 'one line per file');
  const file = path.join(scratch, 'summary.json');
  writeFileSync(file, text);
  const back = baselineOf(JSON.parse(readFileSync(file, 'utf8')));
  assert.deepEqual(back.files.get('charts~default').slides, [
    { class: 'known-gone', score: 0.002, known: ['kn-import-chart'] },
    { class: 'known-present', score: 0.04, known: ['kn-chart-title'] },
    { class: 'new', score: 0.05, known: [] },
    { class: 'not-compared', score: null, known: [] },
  ]);
  // Against itself, only the slides that were new stay new.
  const again = classifyResults({ results, known, baseline: back });
  assert.equal(again.counts.slides.new, 2);
  const broken = { ...summary, files: [{ ...summary.files[0], classes: 'gk' }] };
  assert.equal(validateSummary(broken).ok, false);
});

test('baseline from a round: grade rows to file ids and classes', () => {
  const ids = new Set(['diagrams~picture', 'layout-sampler~native-body', 'lang-latin-1~native', 'charts~default']);
  assert.equal(gradedFileId({ deck: 'diagrams~picture', mode: 'picture' }, ids), 'diagrams~picture');
  assert.equal(gradedFileId({ deck: 'layout-sampler', mode: 'native' }, ids), 'layout-sampler~native-body');
  assert.equal(gradedFileId({ deck: 'lang-latin-1', mode: 'native' }, ids), 'lang-latin-1~native');
  assert.equal(gradedFileId({ deck: 'nowhere', mode: 'default' }, ids), null);
  const results = [result('charts', 'default', [0.04, 0.04, 0.04, 0.04, 0.04, null])];
  const graded = (slide, grade, finding = '', knownText = '') => ({ ver: '036', deck: 'charts', mode: 'default', slide, layout_or_row: '', grade, what: 'x', finding, known: knownText });
  const withFinding = { ...known, records: [...known.records, record('kn-finding', [], { finding: 'MX-09' })] };
  const grades = [graded(1, 'same'), graded(2, 'small', '', 'Chart title'), graded(3, 'wrong', 'MX-09'), graded(4, 'small', '', 'font substituted'), graded(5, 'small', '', 'preview problem, not Keynote'), graded(6, 'same')];
  const { classified, unplaced, ties } = classesFromGrades({ results, grades, known: withFinding });
  assert.deepEqual(
    classified[0].slides.map((slide) => [slide.class, slide.known]),
    [
      ['same', []],
      ['known-present', ['kn-chart-title']],
      ['known-present', ['kn-finding']],
      ['known-present', ['kn-missing-fonts']],
      ['known-present', []],
      ['not-compared', []],
    ],
  );
  assert.deepEqual(
    unplaced.map((item) => item.slide),
    ['charts~default#5', 'charts~default#6'],
  );
  assert.deepEqual(ties['kn-missing-fonts'], ['charts~default#4']);
  assert.throws(() => classesFromGrades({ results, grades: [], known }), /has no grade/);
  const plain = classesFromGrades({ results: [result('charts', 'default', [0.004, 0.04])], known, ungraded: 'reviewed' });
  assert.deepEqual(
    plain.classified[0].slides.map((slide) => [slide.class, slide.known]),
    [
      ['same', []],
      ['known-present', ['kn-missing-fonts']],
    ],
  );
});

test('baseline from a round: export hashes travel to the summary and a tier run keeps its tier', () => {
  const results = [result('charts', 'default', [0.004, 0.04]), result('words', 'default', [0.04])];
  const grades = [
    { deck: 'charts', mode: 'default', slide: 1, grade: 'same' },
    { deck: 'charts', mode: 'default', slide: 2, grade: 'small', known: 'font substituted' },
    { deck: 'words', mode: 'default', slide: 1, grade: 'small', known: 'font substituted' },
  ];
  const hashes = { deck: '0123456789abcdef', slides: ['1111111111111111', '2222222222222222'] };
  const { classified } = classesFromGrades({ results, grades, known, exports: new Map([['charts~default', hashes]]) });
  assert.deepEqual(classified[0].export, hashes);
  assert.equal('export' in classified[1], false, 'a file without hashes has no export');
  const run = { target: 'keynote', application: { name: 'Keynote', version: '16.0' }, system: { os: 'macOS', version: '26.6.2' }, opf: { version: '0.37.0' }, finished: '2026-11-27T17:48:33Z' };
  const summary = summarize({ run: { ...run, tier: summaryTier([{ tier: 'release' }]) }, results, classified, settings: CALIBRATION });
  assert.deepEqual(validateSummary(summary), { ok: true, errors: [] });
  assert.deepEqual(summary.files[0].export, hashes);
  assert.equal(summary.tier, 'release');
  assert.equal(summaryTier([{ tier: 'release' }, { tier: 'release' }]), 'release');
  assert.equal(summaryTier([{ tier: 'release' }, { tier: 'smoke' }]), null, 'runs of different tiers');
  assert.equal(summaryTier([{}, {}]), null, 'a recorded round has no tier');
  assert.equal(parseArgs(['--run', 'r', '--inputs', 'b']).inputs, 'b');
});

test('the committed 0.37.0 PowerPoint baseline: the reviewed release run, with export hashes and only known record ids', () => {
  const file = path.join(here, '../../runs/0.37.0/powerpoint.json');
  const text = readFileSync(file, 'utf8');
  const summary = JSON.parse(text);
  assert.deepEqual(validateSummary(summary), { ok: true, errors: [] });
  assert.equal(text, formatSummary(summary), 'written by formatSummary');
  assert.ok(statSync(file).size < 150 * 1024, 'well under 150 KB');
  assert.equal(summary.target, 'powerpoint');
  assert.equal(summary.tier, 'release');
  assert.equal(summary.opf.version, '0.37.0');
  assert.match(summary.opf.commit, /^[0-9a-f]{40}$/u);
  assert.match(summary.application.build, /^\d+\.\d+$/u);
  const records = JSON.parse(readFileSync(path.join(here, '../../known/powerpoint.json'), 'utf8')).records;
  const ids = new Set(records.map((item) => item.id));
  for (const entry of summary.files) for (const list of Object.values(entry.known)) for (const id of list) assert.ok(ids.has(id), `${entry.id} names ${id}, which known/powerpoint.json does not have`);
  assert.ok(summary.files.every((entry) => entry.export), 'every file has export hashes');
  assert.doesNotMatch(text, /"\/|[A-Za-z]:\\\\|\/Users\/|\/home\//u, 'no absolute path');
  assert.equal(summary.counts.slides.new, 0);
  assert.equal(summary.counts.files, 74);
  assert.equal(summary.files.reduce((sum, entry) => sum + entry.classes.length, 0), 645);
  // Every reviewed slide that differs carries the record that explains it (the text offset's ambient record or a placed one).
  const back = baselineOf(summary);
  for (const [id, entry] of back.files) {
    for (const [position, slide] of entry.slides.entries()) {
      if (slide.class === 'known-present') assert.ok(slide.known.length > 0, `${id}#${position + 1} is known-present without a record id`);
    }
  }
});

test('the committed 0.36.0 Keynote baseline is valid, small, names only known record ids and no absolute path', () => {
  const file = path.join(here, '../../runs/0.36.0/keynote.json');
  const text = readFileSync(file, 'utf8');
  const summary = JSON.parse(text);
  assert.deepEqual(validateSummary(summary), { ok: true, errors: [] });
  assert.equal(text, formatSummary(summary), 'written by formatSummary');
  assert.ok(statSync(file).size < 150 * 1024, 'well under 150 KB');
  assert.equal(summary.tier, null);
  assert.equal(summary.opf.version, '0.36.0');
  const ids = new Set(JSON.parse(readFileSync(path.join(here, '../../known/keynote.json'), 'utf8')).records.map((item) => item.id));
  for (const entry of summary.files) for (const list of Object.values(entry.known)) for (const id of list) assert.ok(ids.has(id), `${entry.id} names ${id}, which known/keynote.json does not have`);
  assert.doesNotMatch(text, /"\/|[A-Za-z]:\\\\|\/Users\/|\/home\//u, 'no absolute path');
  assert.equal(summary.counts.slides.new, 0);
  const slides = summary.files.reduce((sum, entry) => sum + entry.classes.length, 0);
  assert.equal(slides, 1286);
});
