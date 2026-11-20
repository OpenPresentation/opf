// OPF 0.35: fix() applies the safe fixes of a deck's findings, validating again after each round, until none is left; a fix not marked
// safe is never applied. Fixtures: the stale 0.34 copies of stale-embedded-records.test.mjs (fix() reaches the deck embed() refreshes).
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { DEFAULT_FIX_ROUNDS, embed, fix, validate } from '../dist/index.js';
import * as browser from '../dist/browser.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const catalogs = [gallery];
const applied = (result) => result.applied.map((entry) => `${entry.round} ${entry.path} ${entry.fix}`);
// A built-in layout pinned by its 0.34 region names, and a removed design key whose schema error hides the region check.
const pinned = {
  name: 'Pins',
  language: 'en-US',
  slides: [{ title: 'Start with a focused pilot', layout: 'metrics', design: { contentDirection: 'vertical' }, blocks: [{ text: 'Learn what works before scaling.', region: 'note' }, { metric: { value: 24, label: 'teams in the pilot' }, region: 'metrics' }] }],
};

describe('fix', () => {
  test('stale 0.34 copies: the record-wide fixes win over the per-key ones, and the deck is the one embed() refreshes', () => {
    const deck = fixture('stale-0.34-copies.opf.json');
    const before = structuredClone(deck);
    const result = fix(deck, { catalogs });
    assert.deepEqual(deck, before, 'the input is not changed');
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(result.applied.map((entry) => entry.fix).sort(), ['rename-layout', 'use-current-record']);
    assert.deepEqual(result.document, embed(deck, { catalogs }).document);
    assert.deepEqual(result.findings.filter((finding) => finding.severity !== 'info'), []);
    assert.deepEqual(result.report.findings, result.findings);
  });

  test('validates again after each round: the region pins are fixed in the second round', () => {
    const result = fix(pinned, { catalogs });
    assert.deepEqual(applied(result), ['1 /slides/0/design/contentDirection remove:contentDirection', '2 /slides/0/blocks/0/region rename-region', '2 /slides/0/blocks/1/region rename-region']);
    assert.equal(result.rounds, 2);
    assert.deepEqual(result.document.slides[0].blocks.map((block) => block.region), ['aside', 'body']);
    // The key was all the slide's design held: the fix removes the design with it (never an empty design).
    assert.deepEqual(result.applied[0].patch, [{ op: 'remove', path: '/slides/0/design' }]);
    assert.equal(result.applied[0].changesDrawing, true);
  });

  test('maxRounds caps the rounds and says so', () => {
    const result = fix(pinned, { catalogs, maxRounds: 1 });
    assert.equal(result.stopped, 'max-rounds');
    assert.equal(result.rounds, 1);
    assert.ok(result.findings.some((finding) => finding.ruleId === 'opf/region-unknown' && finding.fixes.some((entry) => entry.safe)));
    assert.equal(DEFAULT_FIX_ROUNDS, 10);
    assert.throws(() => fix(pinned, { maxRounds: 0 }), TypeError);
  });

  test('a fix not marked safe is never applied', () => {
    const deck = {
      name: 'Roles',
      slides: [{ title: 'Where we stand', layout: 'custom:summary', blocks: [{ text: 'Revenue grew.' }] }],
      catalogs: { custom: { layouts: { summary: { name: 'Summary', regions: [{ name: 'title' }, { name: 'main', accepts: ['text'], flow: 'none' }, { name: 'aside', accepts: ['metric'], role: 'secondary' }] } } } },
    };
    const result = fix(deck, { catalogs });
    assert.deepEqual(applied(result), ['1 /catalogs/custom/layouts/summary/regions/1/flow use-max-1']);
    assert.equal(result.stopped, 'stable');
    assert.equal(result.document.catalogs.custom.layouts.summary.regions[2].role, 'secondary');
    const [role] = result.findings.filter((finding) => finding.path === '/catalogs/custom/layouts/summary/regions/2/role');
    assert.deepEqual(role.fixes.map((entry) => entry.safe), [false, false]);
    assert.equal(validate(result.document, { catalogs }).valid, false);
  });

  test('a deck with nothing to fix comes back equal, in no round; the Node build registers the default catalog', () => {
    const deck = { name: 'Clean', language: 'en-US', slides: [{ title: 'Two columns', layout: 'two-column' }] };
    const result = fix(deck);
    assert.deepEqual([result.document, result.applied, result.rounds, result.stopped], [deck, [], 0, 'stable']);
    assert.deepEqual(result.findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference'), []);
    assert.equal(browser.fix(deck).findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference').length, 1, 'the browser build registers none');
  });
});
