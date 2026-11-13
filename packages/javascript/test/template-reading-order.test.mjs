import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../dist/index.js';
import { layoutTemplate } from '../dist/composition.js';
import { layouts, payload } from './support/template-samples.mjs';

// OPF 0.19 (RR-79, RR-80 review): on a template slide the expected reading order is the binding order (the regions in
// reading order, then the blocks of each region, a grid row by row), not the visual order of the boxes. A template slide
// composed by its template never gets opf/reading-order. The fill follows the gallery's stability fixtures (gallery
// scripts/fixtures.mjs): three blocks in a flowing region, one in a `none` region, picture-and-text groups in a region
// whose first accepted kind is `group`, each pinned to its region.
const sample = (kind, index) => kind === 'group'
  ? { blocks: [payload('image', index, 'short'), { text: ['Ana Ruiz, Chief Executive', 'Sam Lee, Head of Product', 'Kai Moreau, Engineering Lead'][index % 3] }] }
  : payload(kind === 'video' ? 'image' : kind, index, 'short');

test('the 30 templates, filled as the gallery fixtures fill them, have no opf/reading-order finding', () => {
  const found = [];
  for (const [id, record] of Object.entries(layouts)) {
    const blocks = [], used = {};
    for (const region of layoutTemplate(record).regions) {
      const name = region.name;
      const kind = region.accepts[0], count = (region.flow ?? 'auto') === 'none' ? 1 : Math.min(3, region.max ?? 6);
      for (let index = 0; index < count; index++) { const n = used[kind] ?? 0; used[kind] = n + 1; blocks.push({ region: name, ...sample(kind, n) }); }
    }
    const deck = { catalogs: { custom: { layouts: { [id]: record } } }, slides: [{ layout: id, title: 'Quarterly operating plan', subtitle: 'Review for the leadership team', ...(blocks.length ? { blocks } : {}) }, { layout: id, title: 'Quarterly operating plan', subtitle: 'Review for the leadership team' }] };
    for (const finding of validate(deck, { only: ['accessibility'] }).findings) if (finding.ruleId === 'opf/reading-order') found.push(`${id}: ${finding.message}`);
  }
  assert.deepEqual(found, []);
});

test('slides without a template keep the visual check, a block read as one unit', () => {
  // RR-105 (coverage finding 13, owner decision): the same people as team's, on an automatic slide: two stacked picture-and-text groups in
  // a row read picture, text, picture, text, which is card by card, the order a person reads cards in. A group is one unit of the visual
  // order (its box), so this is no longer a warning (until 0.34 it was).
  const person = (index) => ({ blocks: [payload('image', index, 'short'), { text: `Person ${index + 1}` }], composition: { mode: 'column' } });
  const automatic = { slides: [{ title: 'x', composition: { mode: 'row' }, blocks: [person(0), person(1)] }] };
  assert.ok(!validate(automatic, { only: ['accessibility'] }).findings.some((finding) => finding.ruleId === 'opf/reading-order'));
  // Three cards too, and cards whose own items are composed in a row (the picture beside the name).
  const three = { slides: [{ title: 'x', blocks: [person(0), person(1), person(2)] }] };
  assert.ok(!validate(three, { only: ['accessibility'] }).findings.some((finding) => finding.ruleId === 'opf/reading-order'));
  const beside = (index) => ({ ...person(index), composition: { mode: 'row' } });
  const stacked = { slides: [{ title: 'x', composition: { mode: 'column' }, blocks: [beside(0), beside(1)] }] };
  assert.ok(!validate(stacked, { only: ['accessibility'] }).findings.some((finding) => finding.ruleId === 'opf/reading-order'));
  // The visual check still holds: a layout that draws the body above the title is read out of order.
  const upside = { name: 'Upside', direction: 'column', regions: [{ name: 'body', accepts: ['text'], role: 'primary' }, { name: 'title' }] };
  const above = { catalogs: { custom: { layouts: { upside } } }, slides: [{ layout: 'upside', title: 'x', text: 'Body' }] };
  assert.ok(validate(above, { only: ['accessibility'] }).findings.some((finding) => finding.ruleId === 'opf/reading-order'));
  // On the team template the same blocks read in binding order: no warning.
  const team = { catalogs: { custom: { layouts: { team: layouts.team } } }, slides: [{ layout: 'team', title: 'x', blocks: [person(0), person(1)] }] };
  assert.ok(!validate(team, { only: ['accessibility'] }).findings.some((finding) => finding.ruleId === 'opf/reading-order'));
  // A promoted-region slide on a template composes as in 0.18, in visual order.
  const promoted = { catalogs: { custom: { layouts: { text: layouts.text } } }, slides: [{ layout: 'text', title: 'x', 'top:end': { text: 'Right' }, 'top:start': { text: 'Left' } }] };
  assert.ok(!validate(promoted, { only: ['accessibility'] }).findings.some((finding) => finding.ruleId === 'opf/reading-order'));
});
