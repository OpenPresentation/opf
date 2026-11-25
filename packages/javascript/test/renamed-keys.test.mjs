// OPF 0.37: eight released keys were renamed. A 0.36 deck fails validation with a finding that names the new key, `rename-key` and
// `rename-value` (both safe) repair it, `opf fix` reaches the records a deck embeds, and renameRecordKeys (the PowerPoint importer's reader
// of older files) changes nothing in a record that needs nothing.
import assert from 'node:assert/strict';
import test from 'node:test';

import { fix, renameRecordKeys, validate } from '../dist/index.js';

const schemaFindings = (deck) => validate(deck, { only: ['format'] }).findings.filter((entry) => entry.ruleId === 'opf/schema');
const byPath = (findings, path) => findings.find((entry) => entry.path === path);

// Every old key at once, in a deck that otherwise validates.
const oldDeck = () => ({
  name: 'Old keys',
  organization: [{ id: 'acme', name: 'Acme' }],
  speaker: { id: 'pat', name: 'Pat', organizationId: 'acme' },
  references: [{ id: 'r1', text: 'Report', url: 'https://example.com/report' }],
  catalogs: {
    local: {
      source: 'https://example.com/x',
      fontSchemes: { house: { name: 'House', major: 'Arial', minor: 'Arial', languageFamily: 'cs' } },
    },
  },
  design: { background: { type: 'image', src: 'https://example.com/hero.jpg', tone: 'dark' } },
  slides: [
    { id: 'one', title: 'Alpha', composition: { minFontSize: 16, maxFontSize: 40 }, text: 'Body', design: { background: { type: 'image', src: 'https://example.com/b.jpg', tone: 'light' } } },
    { id: 'two', title: 'Table', table: { columns: ['A', 'B'], rows: [[{ value: 'x', style: { verticalAlign: 'bottom' } }, 'y']] } },
    { id: 'three', title: 'Combo', chart: { type: 'combo', data: { columns: ['Q', 'Revenue', 'Margin'], rows: [['Q1', 10, 0.2], ['Q2', 12, 0.3]] }, line: ['Margin'], secondaryAxis: ['Margin'] } },
  ],
});

test('each old key is one finding at its own path that names the new key, with a safe rename-key fix', () => {
  const expected = {
    '/speaker/organizationId': 'organization',
    '/references/0/url': 'link',
    '/design/background/tone': 'appearance',
    '/slides/0/design/background/tone': 'appearance',
    '/slides/0/composition/minFontSize': 'minFontSizePx',
    '/slides/0/composition/maxFontSize': 'maxFontSizePx',
    '/slides/1/table/rows/0/0/style/verticalAlign': 'anchor',
    '/slides/2/chart/line': 'lineSeries',
    '/catalogs/local/fontSchemes/house/languageFamily': 'scriptGroup',
  };
  for (const [path, renamed] of Object.entries(expected)) {
    const finding = byPath(validate(oldDeck()).findings, path);
    assert.ok(finding, `a finding at ${path}: ${schemaFindings(oldDeck()).map((entry) => entry.path).join(', ')}`);
    const old = path.split('/').at(-1);
    assert.equal(finding.message, `"${old}" was renamed "${renamed}" in OPF 0.37.`, path);
    assert.doesNotMatch(finding.help, /later OPF release/, path);
    const fixes = finding.fixes ?? [];
    assert.deepEqual(fixes.map((entry) => [entry.id, entry.safe === true]), [['rename-key', true]], path);
    assert.notEqual(fixes[0].changesDrawing, true, path);
    assert.deepEqual(fixes[0].patch, [{ op: 'move', from: path, path: `${path.slice(0, path.lastIndexOf('/') + 1)}${renamed}` }], path);
  }
});

test('opf fix rewrites a deck that carries every old key, embedded records included, and the result validates', () => {
  const result = fix(oldDeck());
  assert.equal(result.stopped, 'stable');
  const text = JSON.stringify(result.document);
  for (const old of ['organizationId', 'languageFamily', 'verticalAlign', 'minFontSize', 'maxFontSize', 'url', 'tone', 'line']) assert.ok(!text.includes(`"${old}"`), old);
  assert.equal(result.document.speaker.organization, 'acme');
  assert.equal(result.document.references[0].link, 'https://example.com/report');
  assert.equal(result.document.catalogs.local.fontSchemes.house.scriptGroup, 'complexScript');
  assert.equal(result.document.design.background.appearance, 'dark');
  assert.deepEqual(result.document.slides[0].composition, { minFontSizePx: 16, maxFontSizePx: 40 });
  assert.equal(result.document.slides[1].table.rows[0][0].style.anchor, 'bottom');
  assert.deepEqual(result.document.slides[2].chart.lineSeries, ['Margin']);
  const left = validate(result.document, { only: ['format'] }).findings.filter((entry) => entry.severity === 'error');
  assert.deepEqual(left.map((entry) => entry.message), []);
  assert.ok(result.applied.every((entry) => entry.changesDrawing !== true), 'no fix changes what a slide draws');
});

test('the short script group values are written long by rename-value; the long names and latin are untouched', () => {
  const deck = { slides: [{ title: 'A' }], catalogs: { local: { source: 'https://example.com/x', fontSchemes: {
    ea: { name: 'EA', major: 'A', minor: 'B', scriptGroup: 'ea' },
    long: { name: 'Long', major: 'A', minor: 'B', scriptGroup: 'eastAsian' },
  } } } };
  const findings = validate(deck).findings;
  const finding = byPath(findings, '/catalogs/local/fontSchemes/ea/scriptGroup');
  assert.ok(finding);
  assert.equal(finding.message, '"ea" is written "eastAsian" since OPF 0.37.');
  assert.deepEqual(finding.fixes.map((entry) => [entry.id, entry.safe]), [['rename-value', true]]);
  assert.equal(byPath(findings, '/catalogs/local/fontSchemes/long/scriptGroup'), undefined);
  assert.equal(fix(deck).document.catalogs.local.fontSchemes.ea.scriptGroup, 'eastAsian');
});

test('a renamed key whose new key is already present has no safe fix', () => {
  const deck = { organization: [{ id: 'acme', name: 'Acme' }], speaker: { id: 'pat', name: 'Pat', organizationId: 'acme', organization: 'acme' }, slides: [{ title: 'A' }] };
  const finding = byPath(validate(deck, { only: ['format'] }).findings, '/speaker/organizationId');
  assert.ok(finding);
  assert.match(finding.message, /this object has both/);
  assert.deepEqual(finding.fixes ?? [], []);
  assert.equal(fix(deck).stopped, 'stable');
});

test('a reference link without its scheme offers Add https:// that is not safe, and fix leaves it', () => {
  const deck = { references: [{ id: 'r1', text: 'Report', link: 'acme.com/report' }], slides: [{ title: 'A', text: 'x' }] };
  const finding = byPath(validate(deck, { only: ['format'] }).findings, '/references/0/link');
  assert.ok(finding);
  assert.deepEqual(finding.fixes.map((entry) => [entry.id, entry.title, entry.safe]), [['add-https', 'Add https://', false]]);
  assert.deepEqual(fix(deck).applied, []);
  assert.equal(validate({ references: [{ id: 'r1', text: 'Report', link: 'mailto:a@acme.com' }], slides: [{ title: 'A' }] }, { only: ['format'] }).findings.filter((entry) => entry.severity === 'error').length, 0);
});

test('a slide link is not a reference link', () => {
  const deck = { references: [{ id: 'r1', text: 'Report', link: 'slide:one' }], slides: [{ id: 'one', title: 'A' }] };
  assert.ok(byPath(validate(deck, { only: ['format'] }).findings, '/references/0/link'));
});

test('renameRecordKeys renames the old keys by place, never copies a record that needs nothing, and leaves authored data alone', () => {
  const current = { speaker: { organization: 'acme' }, design: { background: { appearance: 'dark' }, fontScheme: { scriptGroup: 'eastAsian' } }, tone: 'formal', slides: [{ chart: { lineSeries: ['A'] } }] };
  assert.equal(renameRecordKeys(current), current, 'the same object when nothing changes');
  const old = { speaker: { organizationId: 'acme' }, design: { background: { tone: 'dark' }, fontScheme: { languageFamily: 'ea' } }, tone: 'formal', references: [{ url: 'https://a.example' }], extensions: { tone: 'x', line: [1], verticalAlign: 'top' }, datasets: { d: { rows: [{ line: 1, url: 2 }] } } };
  const next = renameRecordKeys(old);
  assert.deepEqual(next.speaker, { organization: 'acme' });
  assert.deepEqual(next.design, { background: { appearance: 'dark' }, fontScheme: { scriptGroup: 'eastAsian' } });
  assert.equal(next.tone, 'formal', "the deck's own tone is another key");
  assert.deepEqual(next.references, [{ link: 'https://a.example' }]);
  assert.deepEqual(next.extensions, old.extensions);
  assert.equal(next.datasets, old.datasets);
  assert.deepEqual(old.speaker, { organizationId: 'acme' }, 'the input is never changed');
  assert.deepEqual(renameRecordKeys({ speaker: { organizationId: 'a', organization: 'b' } }), { speaker: { organizationId: 'a', organization: 'b' } }, 'both present: left for the author');
});
