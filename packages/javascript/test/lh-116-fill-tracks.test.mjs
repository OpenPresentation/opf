// LH-116, LH-101, LH-102 and the widened LH-80, LH-64, LH-47 and LH-10: a picture track starts under a title that wraps beside it, a
// lone code snippet grows and centers (code that fills the body takes it), an under-filled layout body sits in the middle, a row of cards of mixed kinds starts at one anchor,
// the automatic grid's short last row stretches, and a paragraph in a layout region keeps the reading measure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutCode } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#3f8a55"/></svg>`).toString('base64')}`;
const list = { items: ['Confirm lockout and tagout before opening any combiner box', 'Check module temperature before cleaning', 'Inspect cable trays for rodent damage', 'Verify grounding at every inverter pad', 'Photograph and log any cracked glass'] };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const item = (result, field) => result.items.find((entry) => entry.field === field);
const body = (result) => result.items.filter((entry) => !['title', 'subtitle', 'tag'].includes(entry.field));

for (const direction of ['ltr', 'rtl']) {
  test(`LH-116 (${direction}): a title that wraps beside a picture track takes the full width and the track starts at the body top`, () => {
    const result = composeSlide({ title: 'Field safety checklist for solar sites', blocks: [list, { image: svg(1600, 1000) }] }, { direction });
    const title = item(result, 'title'), picture = item(result, 'image');
    assert.equal(result.track?.kind, 'picture');
    assert.equal(title.text.lines.length, 1, 'one line across the slide');
    assert.ok(title.box.width > 1100, `${title.box.width}`);
    assert.ok(picture.image.box.y >= title.box.y + title.box.height, 'the track starts under the title');
    assert.equal(picture.image.box.y + picture.image.box.height, 720, 'and still bleeds to the foot');
    const edge = direction === 'rtl' ? picture.image.box.x === 0 : picture.image.box.x + picture.image.box.width === 1280;
    assert.ok(edge, 'and to its side');
    const text = item(result, 'items');
    assert.ok(direction === 'rtl' ? text.box.x >= picture.image.box.width : text.box.x + text.box.width <= picture.image.box.x, 'the body stays beside the track');
    assert.deepEqual(findings(result), []);
  });
}

test('LH-116: a title that fits one line beside the track keeps the full-height track', () => {
  const result = composeSlide({ title: 'Field checks', blocks: [list, { image: svg(1600, 1000) }] });
  const picture = item(result, 'image');
  assert.equal(result.track?.kind, 'picture');
  assert.deepEqual([picture.image.box.y, picture.image.box.height], [0, 720]);
  assert.ok(item(result, 'title').box.x + item(result, 'title').box.width <= picture.image.box.x);
});

test('LH-80 widened: a picture track never wraps a table cell the slide set on one line', () => {
  const table = { table: { columns: ['Store', 'City', 'Opening', 'Square feet'], rows: [['Harbor Point', 'Baltimore', 'Feb', '14,500'], ['Lakeshore', 'Chicago', 'Mar', '18,200'], ['Old Mill', 'Providence', 'Apr', '11,800'], ['Sunset Plaza', 'San Diego', 'May', '16,400'], ['Riverside', 'Sacramento', 'Jul', '13,900'], ['Peachtree', 'Atlanta', 'Aug', '17,300'], ['Bayou', 'New Orleans', 'Oct', '12,600'], ['Summit', 'Denver', 'Nov', '15,100']] } };
  const result = composeSlide({ title: 'Store openings planned for 2027', blocks: [table, { image: svg(1600, 1000) }] });
  assert.equal(result.track, undefined);
  assert.deepEqual(findings(result), []);
});

test('LH-101: a lone code snippet grows and its panel hugs it in the middle of the body; code that fills the body takes the whole panel', () => {
  // Wave 4 golden review: a five-line snippet on a full-body panel left most of a dark panel empty. A snippet grows in type-scale steps
  // (up to the code display size) and its panel hugs it, centered; only code that fills at least LONE_TARGET of the body is the body.
  const code = { code: { source: 'export const valid = result.errors.length === 0;', language: 'ts', filename: 'validator.ts' } };
  const result = composeSlide({ title: 'Code payload', blocks: [code] }), panel = item(result, 'code');
  const top = item(result, 'title').box.y + item(result, 'title').box.height, bottom = result.contentBox.y + result.contentBox.height;
  assert.ok(panel.box.height < 0.6 * (bottom - top), 'the panel hugs the snippet');
  assert.ok(Math.abs(panel.box.y - top - (bottom - panel.box.y - panel.box.height)) < 0.25 * (bottom - top), 'in the middle of the body');
  const source = panel.codeLayout.parts.find((part) => part.role === 'body');
  const hugging = item(composeSlide({ title: 'Code payload', blocks: [code] }, { fill: false }), 'code');
  assert.ok(source.fit.fontSize > hugging.codeLayout.parts.find((part) => part.role === 'body').fit.fontSize, 'the code grew');
  assert.deepEqual(findings(result), []);
  const long = { code: { source: Array.from({ length: 13 }, (_, line) => `const value${line} = compute(${line});`).join('\n'), language: 'ts', filename: 'values.ts' } };
  const full = composeSlide({ title: 'Code payload', blocks: [long] }), whole = item(full, 'code');
  assert.ok(Math.abs(whole.box.y + whole.box.height - (full.contentBox.y + full.contentBox.height)) < 1, 'code that fills the body takes the whole panel');
  assert.equal(whole.codeLayout.bounds.height, whole.box.height);
  assert.deepEqual(findings(full), []);
});

test('LH-101: layoutCode `fill` sets the lines in the middle of the box and reports the box as the panel', () => {
  const box = { x: 0, y: 0, width: 800, height: 400 };
  const hug = layoutCode({ source: 'a = 1', language: 'py' }, box), fill = layoutCode({ source: 'a = 1', language: 'py' }, box, { fill: true });
  const lines = (layout) => layout.parts.find((part) => part.role === 'body');
  assert.ok(hug.bounds.height < 200);
  assert.deepEqual(fill.bounds, box);
  assert.ok(Math.abs(lines(fill).box.y + lines(fill).box.height / 2 - 200) < 1);
  assert.equal(lines(fill).fit.fontSize, lines(hug).fit.fontSize);
  // The lines never move above the metadata.
  const header = fill.parts.find((part) => part.role === 'language');
  assert.ok(lines(fill).box.y >= header.box.y + header.box.height);
});

const pricing = { table: { columns: ['Region', 'Our price', 'Competitor average', 'Change'], rows: [['Northeast', '$42', '$41', 'Hold'], ['Southeast', '$38', '$44', '+3%'], ['Southwest', '$36', '$41', '+3%']] } };
for (const direction of ['ltr', 'rtl']) {
  test(`LH-102 (${direction}): an under-filled layout body of a table and a text sits in the middle of the body, at the same sizes`, () => {
    const slide = { title: 'Regional pricing review', blocks: [{ text: 'Prices rise 3% in the two regions where we trail competitors by more than 10%.' }, pricing] };
    const result = composeSlide(slide, { layout: layouts['table-beside'], direction }), top = composeSlide(slide, { layout: layouts['table-beside'], direction, fill: false });
    const y = (composed) => Math.min(...body(composed).map((entry) => entry.box.y));
    assert.ok(y(result) > y(top) + 50, `${y(result)} vs ${y(top)}`);
    const end = result.contentBox.y + result.contentBox.height, last = Math.max(...body(result).map((entry) => entry.box.y + entry.box.height));
    const title = item(result, 'title'), above = y(result) - (title.box.y + title.box.height);
    assert.ok(Math.abs(above - (end - last)) < 0.15 * (end - title.box.y), `${above} above, ${end - last} below`);
    assert.equal(item(result, 'text').text.fontSize, item(top, 'text').text.fontSize);
    assert.deepEqual(findings(result), []);
  });
}

test('LH-102: a body that fills the layout keeps its place', () => {
  const tall = { table: { columns: ['Plan', 'Seats', 'Price'], rows: Array.from({ length: 12 }, (_, row) => [`Plan ${row + 1}`, String(row), `$${row}`]) } };
  const full = { title: 'Plans', blocks: [{ text: 'All plans.' }, tall] };
  assert.deepEqual(body(composeSlide(full, { layout: layouts['table-beside'] })).map((entry) => entry.box), body(composeSlide(full, { layout: layouts['table-beside'], fill: false })).map((entry) => entry.box));
});

for (const direction of ['ltr', 'rtl']) {
  test(`LH-64 widened (${direction}): a list, a table and a quote in a row of cards start at one anchor`, () => {
    // A quote over 140 characters keeps its card (a shorter one beside a table is LH-114's pull line: layout-interactions.test.mjs).
    const slide = { title: 'Vendor selection shortlist', blocks: [{ items: ['Must support single sign-on', 'Data stays in region', 'Implementation under 90 days'] }, { table: { columns: ['Vendor', 'Score', 'Price'], rows: [['Apex', '86', '$120K'], ['Brightline', '79', '$98K'], ['Cobalt', '72', '$85K']] } }, { quote: { text: 'Apex answered every security question in writing, in two days, and its references described the same speed after go-live, through two audits.', attribution: 'Security reviewer' } }] };
    const result = composeSlide(slide, { layout: layouts['three-column'], direction, fill: false });
    const tops = body(result).map((entry) => Math.round(entry.box.y));
    assert.equal(new Set(tops).size, 1, `${tops}`);
    assert.deepEqual(findings(result), []);
  });
}

test('LH-47 widened: two pictures and a text draw a row of pictures over a full-width text, not a grid with an empty cell', () => {
  const text = 'The renovation opened the lobby to daylight, doubled the seating and moved reception to the entrance. Visitor wait times fell from seven minutes to three.';
  const result = composeSlide({ title: 'Before and after: the lobby renovation', blocks: [{ image: svg(1600, 1000) }, { image: svg(1600, 1000) }, { text }] });
  const [first, second] = result.items.filter((entry) => entry.field === 'image'), paragraph = item(result, 'text');
  assert.equal(first.box.y, second.box.y);
  assert.ok(paragraph.box.y > first.box.y + first.box.height);
  // The text's cell spans the row: the text is wider than a column, at its reading measure (about 70 characters of its size).
  assert.ok(paragraph.box.width > first.box.width + 100, `${paragraph.box.width}`);
  // A grid of pictures only keeps one cell width.
  const pictures = composeSlide({ title: 'Gallery', blocks: [{ image: svg(1600, 1000) }, { image: svg(1600, 1000) }, { image: svg(1600, 1000) }, { image: svg(1600, 1000) }, { image: svg(1600, 1000) }] });
  assert.equal(new Set(pictures.items.filter((entry) => entry.field === 'image').map((entry) => Math.round(entry.box.width))).size, 1);
});

test('LH-10: a paragraph in a full-width layout region keeps a reading measure of about 70 characters', () => {
  const verdict = 'Teams above eight people save money on Business once they pass the shared storage limit, and smaller teams stay on Starter.';
  const slide = { title: 'Plan comparison', blocks: [{ text: 'Starter: five users, 50 GB.' }, { text: 'Business: fifty users, 1 TB.' }, { text: verdict }] };
  const result = composeSlide(slide, { layout: layouts.comparison, fill: false });
  const text = result.items.find((entry) => entry.value === verdict);
  assert.ok(text.box.width <= 70 * 0.5 * text.text.fontSize + 1, `${text.box.width} at ${text.text.fontSize}`);
  assert.deepEqual(findings(result), []);
});
