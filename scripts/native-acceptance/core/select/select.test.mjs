// NT-13: the export hashes of a .pptx (slide-parts.mjs) and the release candidate's selection (select.mjs), on small decks
// made in memory (core/roundtrip/test-deck.mjs) and hand-written summaries. No application, no build.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classifyResults } from '../classify/classify.mjs';
import { baselineOf, summarize, validateSummary } from '../classify/summary.mjs';
import { emptyResult } from '../result/result.mjs';
import { chartFrame, makePptx, sp } from '../roundtrip/test-deck.mjs';
import { exportChange, exportsOfResults, hasHashes, selectCandidate, selectionTable, smokeIds } from './select.mjs';
import { exportHashes, HASH_DIGITS } from './slide-parts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { unzipSync, zipSync, strToU8, strFromU8 } = createRequire(path.join(root, 'packages/pptx/package.json'))('fflate');

const title = (text) => sp(2, 'Title 1', { ph: { type: 'title' }, box: [40, 40, 600, 80], paragraphs: [text] });
const plain = (text) => ({ shapes: [title(text)] });
const charted = (text, points = 3) => ({ shapes: [title(text), chartFrame(3, 'Chart 2', [40, 140, 600, 300], 'rIdChart')], charts: { rIdChart: { series: [{ name: 'A', points }] } } });

/** Unzips a deck, lets `change(files)` edit its parts (as text; null removes a part), and zips it again. */
function edited(bytes, change) {
  const parts = Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]));
  change(parts);
  const files = {};
  for (const [name, text] of Object.entries(parts)) if (text !== null) files[name] = typeof text === 'string' ? strToU8(text) : text;
  return zipSync(files);
}

test('a slide hash per slide in presentation order, and a deck hash; the same deck hashes the same', () => {
  const deck = makePptx({ slides: [plain('One'), charted('Two'), { ...plain('Three'), notes: 'Say three', links: { rLink: 'https://example.com/a' } }] });
  const hashes = exportHashes(deck);
  assert.equal(hashes.slides.length, 3);
  assert.ok([hashes.deck, ...hashes.slides].every((hash) => new RegExp(`^[0-9a-f]{${HASH_DIGITS}}$`, 'u').test(hash)));
  assert.equal(new Set(hashes.slides).size, 3);
  assert.deepEqual(exportHashes(makePptx({ slides: [plain('One'), charted('Two'), { ...plain('Three'), notes: 'Say three', links: { rLink: 'https://example.com/a' } }] })), hashes);
  assert.throws(() => exportHashes(zipSync({ 'word/document.xml': strToU8('<w/>') })), /not a presentation/u);
});

test('inserting a slide renumbers parts and relationship ids elsewhere but changes no other slide hash', () => {
  const before = exportHashes(makePptx({ slides: [plain('One'), charted('Two'), { ...charted('Three', 4), notes: 'Notes three' }] }));
  // A new slide 1 with a chart: chart1.xml becomes the new slide's, the old charts become chart2 and chart3, slide2.xml is slide3.xml.
  const after = exportHashes(makePptx({ slides: [charted('New'), plain('One'), charted('Two'), { ...charted('Three', 4), notes: 'Notes three' }] }));
  assert.deepEqual(after.slides.slice(1), before.slides);
  assert.equal(after.deck, before.deck, 'the slide list is not a deck-level part');
  // Renaming a relationship id inside one slide (rIdChart -> rId7 in the part and its .rels) changes nothing.
  const renamed = edited(makePptx({ slides: [plain('One'), charted('Two')] }), (parts) => {
    parts['ppt/slides/slide2.xml'] = parts['ppt/slides/slide2.xml'].replace('r:id="rIdChart"', 'r:id="rId7"');
    parts['ppt/slides/_rels/slide2.xml.rels'] = parts['ppt/slides/_rels/slide2.xml.rels'].replace('Id="rIdChart"', 'Id="rId7"');
  });
  assert.deepEqual(exportHashes(renamed).slides, exportHashes(makePptx({ slides: [plain('One'), charted('Two')] })).slides);
});

test('what a slide reaches is its content: a chart, its notes and a link; another slide is named by its number', () => {
  const base = exportHashes(makePptx({ slides: [plain('One'), { ...charted('Two'), notes: 'Speak' }] }));
  const chart = exportHashes(makePptx({ slides: [plain('One'), { ...charted('Two', 5), notes: 'Speak' }] }));
  assert.deepEqual([chart.slides[0] === base.slides[0], chart.slides[1] === base.slides[1]], [true, false], 'a chart part change is its slide');
  const notes = exportHashes(makePptx({ slides: [plain('One'), { ...charted('Two'), notes: 'Speak up' }] }));
  assert.notEqual(notes.slides[1], base.slides[1], 'notes are part of the slide');
  const link = (target) => exportHashes(makePptx({ slides: [{ ...plain('One'), links: { rSlideJump: target } }, plain('Two'), plain('Three')] })).slides[0];
  assert.notEqual(link('slide:2'), link('slide:3'));
  assert.notEqual(link('https://example.com/a'), link('https://example.com/b'));
  // A link to slide 2 hashes the same whatever slide 2 says.
  assert.equal(link('slide:2'), exportHashes(makePptx({ slides: [{ ...plain('One'), links: { rSlideJump: 'slide:2' } }, plain('Changed'), plain('Three')] })).slides[0]);
});

test('shared parts are the deck hash; docProps and an embedded workbook zip timestamp are not content', () => {
  const deck = makePptx({ slides: [plain('One'), charted('Two')] });
  const base = exportHashes(deck);
  const layout = exportHashes(edited(deck, (parts) => (parts['ppt/slideLayouts/slideLayout1.xml'] = parts['ppt/slideLayouts/slideLayout1.xml'].replace('[40, 30', '[41, 30').replace('<p:cSld name="Title and Content">', '<p:cSld name="Title and Content"><p:bg><p:bgRef idx="1001"/></p:bg>'))));
  assert.notEqual(layout.deck, base.deck, 'a used layout is deck-level');
  assert.deepEqual(layout.slides, base.slides);
  const master = exportHashes(edited(deck, (parts) => (parts['ppt/slideMasters/slideMaster1.xml'] = parts['ppt/slideMasters/slideMaster1.xml'].replace('char="•"', 'char="-"'))));
  assert.notEqual(master.deck, base.deck);
  assert.deepEqual(master.slides, base.slides);
  const props = exportHashes(
    edited(deck, (parts) => {
      parts['docProps/core.xml'] = '<cp:coreProperties><dcterms:created>2026-11-27T10:00:00Z</dcterms:created></cp:coreProperties>';
      parts['ppt/viewProps.xml'] = '<p:viewPr lastView="sldView"/>';
    }),
  );
  assert.deepEqual(props, base);

  const workbook = (mtime) => zipSync({ 'xl/worksheets/sheet1.xml': [strToU8('<worksheet><c r="A1"><v>3</v></c></worksheet>'), { mtime }], 'docProps/core.xml': [strToU8(`<modified>${mtime.toISOString()}</modified>`), { mtime }] });
  const withBook = (book) =>
    exportHashes(
      edited(deck, (parts) => {
        parts['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx'] = book;
        parts['ppt/charts/_rels/chart1.xml.rels'] =
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet1.xlsx"/></Relationships>';
      }),
    );
  const early = withBook(workbook(new Date('2026-01-01T00:00:00Z')));
  assert.deepEqual(withBook(workbook(new Date('2026-11-27T12:34:56Z'))), early);
  assert.notEqual(early.slides[1], base.slides[1], 'the workbook belongs to the chart slide');
  assert.equal(early.slides[0], base.slides[0]);
});

// ---- the selection
/** A fake hash from a short label (hex of its characters, padded to the stored length). */
const hex = (label) => Buffer.from(label).toString('hex').padEnd(HASH_DIGITS, '0');
const summaryFile = (id, slides, { deck = 'd0', exported = true } = {}) => ({
  id,
  sha256: 'a'.repeat(64),
  open: 'done',
  slideCount: slides.length,
  scores: slides.map(() => 0.01),
  classes: 'k'.repeat(slides.length),
  known: {},
  ...(exported ? { export: { deck: hex(deck), slides: slides.map(hex) } } : {}),
});
const summary = (files) => ({
  schemaVersion: 1,
  target: 'keynote',
  application: { name: 'Keynote', version: '16.0' },
  system: { os: 'macOS', version: '26.6.2' },
  opf: { version: '0.37.0' },
  tier: 'release',
  date: '2026-11-27',
  settings: { threshold: 0.005, tolerance: 0.002 },
  counts: { files: files.length, slides: { same: 0, 'known-present': files.reduce((sum, file) => sum + file.slideCount, 0), 'known-gone': 0, new: 0, 'not-compared': 0 } },
  warnings: [],
  files,
});
const hashes = (slides, deck = 'd0') => ({ deck: hex(deck), slides: slides.map(hex) });
const built = (id, slides, deck) => ({ id, deck: id.split('~')[0], variant: id.split('~')[1], hashes: slides ? hashes(slides, deck) : null });

test('exportChange: unknown without hashes, new file, deck change, changed and added slides, same', () => {
  const base = summaryFile('a~default', ['a1', 'a2']);
  assert.deepEqual(exportChange(hashes(['a1', 'a2']), base, false), { status: 'unknown', slides: [] });
  assert.deepEqual(exportChange(hashes(['a1', 'a2']), null), { status: 'new', slides: [1, 2] });
  assert.deepEqual(exportChange(hashes(['a1', 'a2'], 'd1'), base), { status: 'deck', slides: [1, 2] });
  assert.deepEqual(exportChange(hashes(['a1', 'b2', 'b3']), base), { status: 'slides', slides: [2, 3] });
  assert.deepEqual(exportChange(hashes(['a1', 'a2']), base), { status: 'same', slides: [] });
});

test('a candidate opens the smoke tier, the named decks and the changed files; the rest is skipped', () => {
  const baseline = summary([summaryFile('s~default', ['s1']), summaryFile('a~default', ['a1', 'a2']), summaryFile('a~native-body', ['n1', 'n2']), summaryFile('b~default', ['b1']), summaryFile('c~default', ['c1']), summaryFile('f~default', ['f1'])]);
  assert.deepEqual(validateSummary(baseline), { ok: true, errors: [] });
  const files = [built('s~default', ['s1']), built('a~default', ['a1', 'a2']), built('a~native-body', ['n1', 'x2']), built('b~default', ['b1'], 'd9'), built('c~default', ['c1']), built('e~default', ['e1']), built('f~default', ['f1']), built('g~default', null)];
  const smoke = smokeIds([{ deck: 's', variants: ['default'] }]);
  for (const base of [baseline, baselineOf(baseline)]) {
    const selection = selectCandidate({ files, smoke, named: [{ deck: 'f', reason: 'named by changes/fr-01.md' }], baseline: base, baselineVersion: '0.37.0' });
    assert.equal(selection.hashes, true);
    assert.deepEqual(
      selection.selected.map((item) => [item.id, item.reasons.join(' | ')]),
      [
        ['s~default', 'smoke tier'],
        ['a~native-body', '1 slide(s) changed since 0.37.0: 2'],
        ['b~default', 'deck-level parts changed since 0.37.0 (masters, layouts, theme or presentation properties): every slide'],
        ['e~default', 'not in the 0.37.0 baseline'],
        ['f~default', 'named by changes/fr-01.md'],
        ['g~default', 'its slides could not be hashed'],
      ],
    );
    assert.deepEqual(selection.skipped, ['a~default', 'c~default']);
    assert.equal(selection.changedSlides, 3);
    assert.deepEqual(selection.deckChanged, ['b~default']);
    const table = selectionTable(selection, { total: files.length, baselineVersion: '0.37.0' }).join('\n');
    assert.match(table, /files in the release tier {2}8/u);
    assert.match(table, /unchanged, skipped {9}2/u);
    assert.match(table, /deck-level change in 1 file\(s\)/u);
  }
});

test('a baseline without hashes falls back to the smoke tier and the named decks, and says so', () => {
  const baseline = summary([summaryFile('s~default', ['s1'], { exported: false }), summaryFile('a~default', ['a1'], { exported: false })]);
  assert.equal(hasHashes(baseline), false);
  assert.equal(hasHashes(null), false);
  const selection = selectCandidate({ files: [built('s~default', ['s1']), built('a~default', ['zz']), built('f~default', ['f1'])], smoke: ['s~default'], named: [{ deck: 'f', reason: '--look' }], baseline, baselineVersion: '0.36.0' });
  assert.deepEqual(
    selection.selected.map((item) => item.id),
    ['s~default', 'f~default'],
  );
  assert.deepEqual(selection.skipped, ['a~default']);
  const table = selectionTable(selection, { total: 3, baselineVersion: '0.36.0' });
  assert.match(table[0], /baseline 0\.36\.0 has no export hashes/u);
  assert.match(table.join('\n'), /slides changed {13}unknown/u);
});

// ---- classification and summary carry the hashes
function result(deck, scores) {
  const value = emptyResult({ target: 'keynote', application: { name: 'Keynote', version: '16.0' }, system: { os: 'macOS', version: '26.6.2' }, opf: { version: '0.37.0' }, file: { deck, variant: 'default', path: `pptx/${deck}.pptx`, sha256: 'b'.repeat(64) }, started: '2026-11-27T12:00:00Z' });
  value.verbs.open = { status: 'done', seconds: 1, slideCount: scores.length, warnings: { status: 'read', source: 'test', lines: [] } };
  value.slides = scores.map((score, index) => ({ index: index + 1, hidden: false, picture: `slides/slide-${index + 1}.png`, compare: { score, preview: 'p.png', note: null }, objects: [] }));
  return value;
}

test('classify marks the slides whose export changed and keeps the hashes; the summary writes them', () => {
  const baseline = baselineOf(summary([summaryFile('a~default', ['a1', 'a2', 'a3'])]));
  const results = [result('a', [0.01, 0.01, 0.01])];
  const exports = new Map([['a~default', hashes(['a1', 'b2', 'a3'])]]);
  const classified = classifyResults({ results, known: { records: [] }, baseline, options: { exports } });
  const [file] = classified.files;
  assert.deepEqual(file.export, hashes(['a1', 'b2', 'a3']));
  assert.deepEqual(
    file.slides.map((slide) => [slide.class, slide.changed ?? false]),
    [
      ['known-present', false],
      ['known-present', true],
      ['known-present', false],
    ],
    'the class does not change',
  );
  const written = summarize({ run: { target: 'keynote', application: { name: 'Keynote', version: '16.0' }, system: { os: 'macOS', version: '26.6.2' }, opf: { version: '0.37.1' }, tier: 'candidate', finished: '2026-11-28T10:00:00Z' }, results, classified: classified.files, settings: classified.settings });
  assert.deepEqual(written.files[0].export, hashes(['a1', 'b2', 'a3']));
  assert.deepEqual(validateSummary(written), { ok: true, errors: [] });
  written.files[0].export.slides.pop();
  assert.match(validateSummary(written).errors.join('\n'), /2 slide hashes but 3 scores/u);
  // Without a baseline that has hashes nothing is marked changed.
  const plainRun = classifyResults({ results, known: { records: [] }, baseline: baselineOf(summary([summaryFile('a~default', ['a1', 'a2', 'a3'], { exported: false })])), options: { exports } });
  assert.ok(plainRun.files[0].slides.every((slide) => !slide.changed));
});

test('exportsOfResults hashes the files beside a run and leaves out a file that is not the one opened', () => {
  const results = [result('a', [0.01]), result('b', [0.01]), result('c', [0.01])];
  const { exports, notes } = exportsOfResults(results, '/build', {
    hash: (file) => {
      if (file.endsWith('c.pptx')) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      return hashes([file.slice(-6, -5)]);
    },
    sha256: (file) => (file.endsWith('b.pptx') ? 'c'.repeat(64) : 'b'.repeat(64)),
  });
  assert.deepEqual([...exports.keys()], ['a~default']);
  assert.match(notes.join('\n'), /b~default: the exported file beside the run is not the file that was opened/u);
  assert.match(notes.join('\n'), /c~default: no export hashes \(the exported file is missing\)/u);
  assert.match(exportsOfResults(results, null).notes[0], /no exported files beside the run/u);
});
