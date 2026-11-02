// LH-52, LH-71, LH-86: a two- or three-part split fills the body (panels stretch, text centers), two or three automatic blocks keep a
// row or a column by fill, and long texts in cards side by side are drawn one card per row.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const code = { code: { filename: 'rule.ts', language: 'ts', source: 'const score = urgency * confidence;\nif (score >= threshold) {\n  routeToSponsor(workstream);\n} else {\n  keepInWeeklyReview(workstream);\n}' } };
const paragraph = (name) => ({ text: `${name} should focus the next cycle on recovering at-risk renewals with executive sponsorship while making the operating tradeoffs clear to its stakeholders.` });
const table = { table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [['Community college', 'Program lead', 'At risk', 'Continue'], ['Data and reporting', 'Analytics', 'On track', 'Tighten metric definitions'], ['Field adoption', 'Operations', 'Watch', 'Add weekly office hours']] } };
const center = (box) => box.y + box.height / 2;
const body = (result) => result.contentBox;
const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;

for (const direction of ['ltr', 'rtl']) {
  test(`LH-52 (${direction}): a row that fills under 55% of the body stretches its code panel and centers its text`, () => {
    const result = composeSlide({ title: 'Decision options', composition: { mode: 'row' }, blocks: [code, paragraph('Oaktrail Animal Health')] }, { direction });
    assert.deepEqual(findings(result), []);
    const panel = result.items.find((item) => item.field === 'code'), text = result.items.find((item) => item.field === 'text');
    const area = body(result);
    assert.ok(near(panel.box.y, area.y) && near(panel.box.height, area.height), 'the panel takes the whole cell');
    const parts = panel.codeLayout.parts.map((part) => part.box);
    const top = Math.min(...parts.map((box) => box.y)), bottom = Math.max(...parts.map((box) => box.y + box.height));
    assert.ok(near((top + bottom) / 2, center(area), 24), 'the code sits in the middle of its panel');
    assert.ok(near(center(text.box), center(area), 4), 'the text is centered');
    assert.ok(text.text.fontSize >= 28 - 1e-9, 'nothing shrinks');
    // The same blocks at the top (wave 2) kept the same sizes: only the placement moves.
    assert.equal(panel.codeLayout.parts.find((part) => part.role === 'body').fit.fontSize, composeSlide({ title: 'Decision options', composition: { mode: 'row' }, blocks: [code] }, { direction }).items.find((item) => item.field === 'code').codeLayout.parts.find((part) => part.role === 'body').fit.fontSize);
  });
}

test('LH-52: a picture and a quote in a row sit in the middle of the body; a row that fills more is unchanged', () => {
  const image = { image: { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAgMTAwIiB3aWR0aD0iMTYwMCIgaGVpZ2h0PSIxMDAwIi8+', alt: 'Hills' } };
  const quote = { quote: { text: 'The path is workable if we keep the metric simple and the decision owner visible.', attribution: 'Working group' } };
  const result = composeSlide({ title: 'Signal trend', composition: { mode: 'grid' }, blocks: [quote, image] }, {});
  assert.deepEqual(findings(result), []);
  const picture = result.items.find((item) => item.field === 'image'), said = result.items.find((item) => item.field === 'quote');
  assert.ok(near(center(picture.image.box), center(body(result)), 2), 'the picture is centered');
  assert.ok(near(center(said.box), center(body(result)), 4), 'the quote is centered');
  // Four long paragraphs fill the body: no split rule applies (more than three blocks).
  const full = composeSlide({ title: 'Four', composition: { mode: 'row' }, blocks: [paragraph('A'), paragraph('B'), paragraph('C'), paragraph('D')] }, {});
  assert.ok(full.items.filter((item) => item.field === 'text').every((item) => near(item.box.y, body(full).y)));
});

test('LH-71: a table that wraps in a row takes the whole width above its text, centered; texts alone keep their row', () => {
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Execution timeline', blocks: [table, paragraph('Metro Technical College')] }, { direction, explain: true });
    assert.deepEqual(findings(result), []);
    const grid = result.items.find((item) => item.field === 'table'), text = result.items.find((item) => item.field === 'text');
    assert.ok(near(grid.box.width, body(result).width), 'the table spans the body');
    assert.ok(text.box.y >= grid.box.y + grid.box.height, 'the text is below the table');
    assert.ok(text.box.y - (grid.box.y + grid.box.height) < 40, 'the text follows the table, not the foot of the body');
    const top = grid.box.y - body(result).y, bottom = body(result).y + body(result).height - (text.box.y + text.box.height);
    assert.ok(near(top, bottom, 8), 'the stack is centered');
    assert.equal(result.explanation.decisions[0].reason, 'split-fill');
    assert.equal(result.explanation.decisions[0].selectedColumns, 1);
  }
  // Two paragraphs fill the same either way, so the scored row stands.
  const texts = composeSlide({ title: 'Two', blocks: [paragraph('A'), paragraph('B')] }, { explain: true });
  assert.equal(texts.explanation.decisions[0].reason, 'lowest-score');
  assert.equal(texts.explanation.decisions[0].selectedColumns, 2);
  // An author's column is kept.
  const column = composeSlide({ title: 'Column', composition: { mode: 'column' }, blocks: [code, paragraph('Sable Systems')] }, { explain: true });
  assert.equal(column.explanation.decisions[0].reason, 'configured-mode');
  const [panel, text] = ['code', 'text'].map((field) => column.items.find((item) => item.field === field));
  assert.ok(text.box.y > panel.box.y + panel.box.height, 'still one column');
});

test('LH-86: two long texts in cards side by side are drawn one card per row, across the row, filling the body', () => {
  for (const id of ['two-column', 'three-column', 'pillars']) {
    for (const direction of ['ltr', 'rtl']) {
      const result = composeSlide({ title: 'Decision options', blocks: [paragraph('Evergreen CRM'), paragraph('Asteria Robotics')] }, { layout: layouts[id], direction });
      assert.deepEqual(findings(result), [], id);
      const texts = result.items.filter((item) => item.field === 'text');
      assert.equal(texts.length, 2);
      const [first, second] = texts.map((item) => item.frameBox);
      assert.ok(near(first.width, body(result).width, 1) && near(second.width, body(result).width, 1), `${id}: cards across the row`);
      assert.ok(second.y > first.y + first.height, `${id}: stacked in reading order`);
      assert.equal(texts[0].text.fontSize, texts[1].text.fontSize, `${id}: one size`);
      // The cards fill the region, and each text sits in the middle of its card.
      const region = result.regions.find((entry) => entry.arrangement === 'column');
      assert.ok(near(first.y, region.box.y, 1) && near(second.y + second.height, region.box.y + region.box.height, 1), `${id}: the rows share the region`);
      for (const item of texts) assert.ok(item.box.y - item.frameBox.y > 20 && item.frameBox.y + item.frameBox.height - (item.box.y + item.box.height) < item.box.y - item.frameBox.y + 4, `${id}: centered text`);
    }
  }
  // A short text (under 80 characters) beside a long one, or a slide without cards, keeps the layout's columns.
  const short = composeSlide({ title: 'Mixed', blocks: [paragraph('Evergreen CRM'), { text: 'Keep the recommendation short.' }] }, { layout: layouts['two-column'] });
  assert.equal(short.regions.filter((entry) => entry.content.length).length, 2);
  const plain = composeSlide({ title: 'Plain', blocks: [paragraph('Evergreen CRM'), paragraph('Asteria Robotics')] }, { layout: { ...layouts['two-column'], design: { ...layouts['two-column'].design, contentBox: false } } });
  assert.equal(plain.regions.filter((entry) => entry.content.length).length, 2);
});

test('LH-86: a few short paragraphs hug their text and center, and five long rows share the body at one size', () => {
  const brief = (name) => ({ text: `${name}: test with two teams for six weeks and measure task completion first.` });
  const hugged = composeSlide({ title: 'Opportunity', blocks: [brief('Northwind'), brief('Contoso')] }, { layout: layouts['two-column'] });
  const cards = hugged.items.filter((item) => item.field === 'text').map((item) => item.frameBox);
  const region = hugged.regions.find((entry) => entry.arrangement === 'column').box;
  assert.ok(cards[0].y - region.y > 40, 'the stack does not start at the top');
  assert.ok(near(cards[0].y - region.y, region.y + region.height - cards[1].y - cards[1].height, 2), 'the stack is centered');
  const rows = composeSlide({ title: 'Scope 3 reporting readiness', blocks: ['Lumina Foods', 'Cedarwell Properties', 'Brightpath Analytics', 'North Pier Advisory', 'RheinWorks Mobility'].map(paragraph) }, { layout: layouts['two-column'] });
  assert.deepEqual(findings(rows), []);
  const texts = rows.items.filter((item) => item.field === 'text');
  assert.equal(new Set(texts.map((item) => item.text.fontSize)).size, 1, 'one size');
  const stack = rows.regions.find((entry) => entry.arrangement === 'column').box, frames = texts.map((item) => item.frameBox);
  assert.ok(near(frames[0].y, stack.y, 1) && near(frames.at(-1).y + frames.at(-1).height, stack.y + stack.height, 1), 'the rows share the region');
});

test('wave 3: rows never set long texts smaller than the regions side by side; six-sentence texts fit as rows', () => {
  const sentence = 'Teams should focus the next cycle on recovering at-risk renewals with executive sponsorship and value proof while making the tradeoffs clear. ';
  // Sizes the regions side by side give (main + wave 2), by sentences per paragraph: two-column, three-column.
  const sideBySide = { 3: [28, 21], 4: [24, 18], 5: [21, 16], 6: [18, 16] };
  for (const [count, sizes] of Object.entries(sideBySide)) {
    ['two-column', 'three-column'].forEach((id, index) => {
      const blocks = Array.from({ length: index + 2 }, () => ({ text: sentence.repeat(Number(count)).trim() }));
      const result = composeSlide({ title: 'T', blocks }, { layout: layouts[id] });
      for (const item of result.items.filter((entry) => entry.field === 'text')) assert.ok(item.text.fontSize >= sizes[index] - 1e-9, `${id} ${count}: ${item.text.fontSize}`);
      // Three six-sentence paragraphs overflowed side by side; as rows they fit at the floor.
      assert.deepEqual(findings(result), [], `${id} ${count}`);
    });
  }
});
