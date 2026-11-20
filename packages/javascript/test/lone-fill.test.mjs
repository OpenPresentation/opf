// LH-48, LH-65, LH-89: a body that fills too little of the slide grows on the type scale and moves to the middle; an empty column of
// a layout gives way; a nested group's default gap is the slide's.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, LONE_DISPLAY_SIZES, LONE_TARGET, MESSAGE_DISPLAY_SIZE } from '../dist/composition.js';

const { layouts } = gallery;
const body = (result) => result.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field));
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const middle = (box) => box.y + box.height / 2;
const statement = 'Close the audit evidence gaps before the external assessment, and make the operating tradeoffs clear to every stakeholder.';

test('a lone short paragraph steps up the type scale, at most to its display size, and sits in the middle of the body', () => {
  const slide = { title: 'Why this matters', text: statement };
  const result = composeSlide(slide), kept = composeSlide(slide, { fill: false });
  const [item] = body(result), [role] = body(kept);
  assert.deepEqual(findings(result), []);
  assert.equal(role.text.fontSize, 32, 'fill: false keeps the lead size of a lone block of two lines (WI-4)');
  // LH-09: a paragraph of at most 25 words is a short message, which grows on past LONE_DISPLAY_SIZES.text to MESSAGE_DISPLAY_SIZE.
  assert.ok(item.text.fontSize > LONE_DISPLAY_SIZES.text && item.text.fontSize <= MESSAGE_DISPLAY_SIZE, `${item.text.fontSize}`);
  assert.ok([49, 56].includes(item.text.fontSize), 'a step of the type scale');
  assert.ok(!item.text.overflow);
  assert.ok(Math.abs(middle(item.box) - middle(result.contentBox)) < 1, 'centered in the body');
  assert.ok(item.box.height <= LONE_TARGET * result.contentBox.height + 4, 'about 60% of the body at most');
  assert.ok(role.box.y < item.box.y, 'it left the top of the body');
});

test('a lone paragraph that already fills half the body keeps its size and place', () => {
  const long = Array.from({ length: 6 }, () => statement).join(' ');
  const slide = { title: 'Context', text: long };
  assert.deepEqual(composeSlide(slide).items.map((item) => [item.box, item.text.fontSize]), composeSlide(slide, { fill: false }).items.map((item) => [item.box, item.text.fontSize]));
});

test('a lone metric, quote and code panel grow every role with one factor and center, without overflow', () => {
  const cases = [
    [{ metric: { value: '99.9%', label: 'Validation pass rate', description: 'Example value.', delta: '+2.1 pts', trend: 'up' } }, 'metricLayout', 'value', 76],
    [{ quote: { text: 'The payload model stays predictable even as slide content varies.', attribution: 'OPF fixture' } }, 'quoteLayout', 'body', 40],
    [{ code: { source: 'export const valid = result.errors.length === 0;', language: 'ts', filename: 'validator.ts' } }, 'codeLayout', 'body', 22],
  ];
  for (const [payload, key, role, size] of cases) {
    const result = composeSlide({ title: 'Payload', ...payload }), kept = composeSlide({ title: 'Payload', ...payload }, { fill: false });
    const [item] = body(result), layout = item[key], part = layout.parts.find((entry) => entry.role === role);
    assert.deepEqual(findings(result), [], key);
    assert.equal(kept.items.at(-1)[key].parts.find((entry) => entry.role === role).fit.fontSize, size, `${key}: the role size without fill`);
    assert.ok(part.fit.fontSize > size, `${key}: ${part.fit.fontSize}`);
    for (const entry of layout.parts) if (entry.fit) assert.ok(entry.fit.fontSize >= entry.requestedFontSize - 1e-9, `${key} ${entry.role} keeps the size it asked for`);
    assert.ok(Math.abs(middle(item.box) - middle(result.contentBox)) < 2, `${key}: centered`);
    assert.ok(layout.bounds.y >= item.box.y - 0.01 && layout.bounds.y + layout.bounds.height <= item.box.y + item.box.height + 0.01, `${key}: inside its box`);
  }
});

test('a lone table grows its type and rows, and engines get its growth', () => {
  const table = { columns: ['Workstream', 'Owner', 'Status'], rows: [['Compliance', 'Program lead', 'On track'], ['Reporting', 'Analytics', 'Watch']] };
  const result = composeSlide({ title: 'Decision options', table }, { layout: layouts.table });
  const [item] = body(result);
  assert.deepEqual(findings(result), []);
  assert.ok(item.tableGrowth > 1, `${item.tableGrowth}`);
  assert.equal(composeSlide({ title: 'Decision options', table }, { layout: layouts.table, fill: false }).items.at(-1).tableGrowth, undefined);
  const region = result.regions.find((entry) => entry.name === 'table').box;
  assert.ok(Math.abs(middle(item.frameBox ?? item.box) - middle(region)) < 2, 'the table and its card sit in the middle of the body');
});

test('a layout\'s lone block takes the body: its region reaches the foot when the other regions are empty', () => {
  const result = composeSlide({ title: 'Signal trend', blocks: [{ text: statement }] }, { layout: layouts['three-column'] });
  const [item] = body(result), region = result.regions.find((entry) => entry.name === 'first').box;
  assert.deepEqual(findings(result), []);
  assert.ok(Math.abs(region.width - result.contentBox.width) < 1, 'the full width');
  assert.ok(item.text.fontSize > 28);
  assert.ok(Math.abs(middle(item.frameBox ?? item.box) - middle(region)) < 1, 'the card hugs it in the middle');
  // A stacked record (the statement) already centers its message; LH-129 grows it in the stack (template-fill.test.mjs), and
  // `fill: false` keeps its sizes.
  const stacked = composeSlide({ title: 'Statement', blocks: [{ text: statement }] }, { layout: layouts.statement });
  const kept = composeSlide({ title: 'Statement', blocks: [{ text: statement }] }, { layout: layouts.statement, fill: false });
  assert.ok(stacked.items.at(-1).text.fontSize > kept.items.at(-1).text.fontSize);
  assert.equal(stacked.items[0].text.fontSize, kept.items[0].text.fontSize, 'a title over a primary message keeps its size');
});

test('LH-65: two blocks in three columns draw 1:1; the empty column gives way', () => {
  // The second text is under 80 characters: two long texts would be full-width rows instead (LH-86), which collapse the other columns;
  // `emphasis: false` keeps it out of LH-06's foot band.
  const blocks = [{ text: statement }, { text: 'This fixture keeps identity metadata separate.', emphasis: false }];
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Decision options', blocks }, { layout: layouts['three-column'], direction, fill: false });
    const [first, second, third] = ['first', 'second', 'third'].map((name) => result.regions.find((entry) => entry.name === name));
    assert.ok(Math.abs(first.box.width - second.box.width) < 0.01, `${direction}: 1:1`);
    assert.ok(first.box.width + second.box.width > result.contentBox.width - 30, `${direction}: they share the width`);
    assert.equal(third.box.width, 0, `${direction}: the empty column takes no width`);
    assert.equal(third.collapsed, true);
    if (direction === 'rtl') assert.ok(first.box.x > second.box.x, 'mirrored');
  }
  // A lone block keeps the collapse into its neighbors, as before.
  const lone = composeSlide({ title: 'One', blocks: [{ text: 'Only one.' }] }, { layout: layouts['three-column'], fill: false });
  assert.ok(lone.regions.find((entry) => entry.name === 'second').box.width > 0);
});

test('a body of short paragraphs grows together, keeps one size and sits in the middle', () => {
  const blocks = [{ text: 'State Workforce Board should prepare displaced workers for regional growth sectors.' }, { text: 'Asteria Robotics should prepare the quarter narrative for public-market investors.' }];
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Decision and follow through', blocks }, { layout: layouts.comparison, direction });
    const kept = composeSlide({ title: 'Decision and follow through', blocks }, { layout: layouts.comparison, direction, fill: false });
    const items = body(result), sizes = items.map((item) => item.text.fontSize);
    assert.deepEqual(findings(result), []);
    assert.equal(new Set(sizes).size, 1, `${direction}: one size (LH-43): ${sizes}`);
    assert.ok(sizes[0] > body(kept)[0].text.fontSize && sizes[0] <= LONE_DISPLAY_SIZES.list, `${direction}: ${sizes[0]}`);
    const top = Math.min(...items.map((item) => item.box.y)), bottom = Math.max(...items.map((item) => item.box.y + item.text.lines.length * item.text.lineHeight));
    const title = result.items.find((item) => item.field === 'title').box, end = result.contentBox.y + result.contentBox.height;
    assert.ok(Math.abs(top - (title.y + title.height) - (end - bottom)) < 40, `${direction}: about as much space above as below`);
  }
});

test('an overflowing or well-filled body does not grow', () => {
  const blocks = Array.from({ length: 6 }, (_, index) => ({ text: `${index + 1}. ${statement} ${statement}` }));
  const result = composeSlide({ title: 'Dense', blocks }, { layout: layouts['two-column'] });
  assert.deepEqual(body(result).map((item) => item.text.fontSize), body(composeSlide({ title: 'Dense', blocks }, { layout: layouts['two-column'], fill: false })).map((item) => item.text.fontSize));
});

test('LH-89: a nested group without a gap of its own is the slide\'s gap apart, capped so a small group fits', () => {
  const slide = { title: 'Nested', composition: { mode: 'column' }, blocks: [{ composition: { mode: 'row' }, blocks: [{ text: 'Left note.' }, { text: 'Right note.' }] }, { text: 'Below the row.' }] };
  const result = composeSlide(slide, { fill: false });
  const [left, right] = result.items.filter((item) => item.field === 'text' && item.path.includes('blocks.0.blocks'));
  assert.ok(Math.abs(right.box.x - (left.box.x + left.box.width) - 720 / 30) < 0.01, `${right.box.x - (left.box.x + left.box.width)}`);
  const own = composeSlide({ ...slide, blocks: [{ ...slide.blocks[0], composition: { mode: 'row', gap: 0.01 } }, slide.blocks[1]] }, { fill: false });
  const [a, b] = own.items.filter((item) => item.field === 'text' && item.path.includes('blocks.0.blocks'));
  assert.ok(b.box.x - (a.box.x + a.box.width) < 720 / 30, 'a group\'s own gap is a fraction of its own side');
});

test('LH-65 with the wave 3 rule: a column gives way only when no block reads smaller', () => {
  // A dense second block reads larger across the two columns it took in wave 2 than in half the row: the columns stay.
  const long = 'Give one owner responsibility from intake through decision. A shared queue makes exceptions visible and keeps routine work moving. '.repeat(7);
  const dense = composeSlide({ title: 'Dense', blocks: [{ text: 'Short.' }, { text: long }] }, { layout: layouts['three-column'], fill: false });
  const [first, second] = ['first', 'second'].map((name) => dense.regions.find((entry) => entry.name === name).box);
  assert.ok(second.width > first.width * 1.8, 'the wave 2 columns stand');
  assert.deepEqual(findings(dense), []);
  // A hero's empty media column, which no neighbor can absorb, gives way to its lone text.
  const hero = composeSlide({ title: 'Signal trend', blocks: [{ text: statement }] }, { layout: layouts.hero });
  const media = hero.regions.find((entry) => entry.name === 'media');
  assert.equal(media.box.width, 0);
  assert.equal(media.collapsed, true);
  assert.ok(Math.abs(hero.regions.find((entry) => entry.name === 'lead').box.width - hero.contentBox.width) < 1, 'the text takes the width');
});
