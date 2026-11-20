// LH-114, LH-06 (widened), LH-121, LH-122: a short quote under or over data as a pull line, a takeaway band after two or more charts
// or tables, a timeline's progress and status words, and a lead text in the timeline layout. Every rule reads block kinds, counts
// and lengths, never a slide id, and works right to left.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindRegions, composeSlide, layoutQuote, layoutTable, layoutTimeline, QUOTE_PULL_RULE, TIMELINE_STATUS_WORDS } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const layout = (id) => layouts[id];
const quote = { quote: { text: 'We did not leave over a feature. We left because nobody called.', attribution: 'Exit interview', role: 'Mid-market customer' } };
const table = { table: { columns: ['Vendor', 'Score', 'Price'], rows: [['Apex', 86, '$120K'], ['Brightline', 79, '$98K'], ['Cobalt', 72, '$85K']] } };
const list = (count) => ({ items: ['Low product usage in the first 90 days', 'Slow response on critical tickets', 'Price increase without notice', 'Missing integrations'].slice(0, count) });
const chart = (title) => ({ chart: { type: 'column', data: { columns: [title, 'Value'], rows: [['A', 3], ['B', 5], ['C', 4]] }, alt: `${title} values.` } });
const metric = { metric: { value: '92', label: 'Net promoter score' } };
const pull = (result) => result.items.find((item) => item.quoteLayout?.rule);
const card = (result) => result.items.find((item) => item.quoteLayout && !item.quoteLayout.rule);
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const lines = (fit) => (fit.richLines ?? fit.lines).length;
// Where a body item's drawn content ends: a table's last row, a text's last line, a chart's box.
const contentBottom = (item) => {
  if (item.field === 'table') return Math.max(...layoutTable(item.value, item.box, { minFontSize: item.composition.minFontSize, ...(item.tableGrowth ? { growth: item.tableGrowth } : {}) }).rows.flatMap((row) => row.cells.map((cell) => cell.box.y + cell.box.height)));
  if (item.text && (item.field === 'items' || item.field === 'text')) return item.box.y + item.text.lines.length * item.text.lineHeight;
  return item.box.y + item.box.height;
};

test('LH-114: a short quote under a table, a long list or two blocks is a full-width pull line one gap under the data', () => {
  for (const blocks of [[table, quote], [list(3), quote], [list(4), chart('Churn'), quote]]) {
    for (const direction of ['ltr', 'rtl']) {
      const slide = { title: 'Why customers churn', blocks };
      const result = composeSlide(slide, direction === 'rtl' ? { presentation: { language: 'ar', slides: [slide] }, slideIndex: 0 } : {});
      const item = pull(result);
      assert.ok(item, `${blocks.length} blocks ${direction}: a pull line`);
      assert.deepEqual(findings(result), []);
      const { rule, parts } = item.quoteLayout, [body, footer] = parts;
      assert.equal(rule.width, QUOTE_PULL_RULE.width);
      assert.equal(rule.height, QUOTE_PULL_RULE.height);
      // The rule sits at the start edge: the left in a left-to-right deck, the right in a right-to-left one.
      if (direction === 'rtl') assert.ok(Math.abs(rule.x + rule.width - (item.box.x + item.box.width)) < 0.01);
      else assert.ok(Math.abs(rule.x - item.box.x) < 0.01);
      assert.ok(lines(body.fit) <= 2, 'at most two lines');
      assert.ok(body.fit.fontSize >= 28 - 1e-9, 'the lead size, never under the body text size');
      assert.equal(footer.text, '— Exit interview, Mid-market customer');
      assert.equal(lines(footer.fit), 1, 'one caption line');
      // The pull line spans the body's width, below every other body block, and is the last item (reading order).
      assert.ok(Math.abs(item.box.width - result.contentBox.width) < 1);
      // The data and the pull line are one stack: the pull line sits one gap (24 px on this canvas) under the lowest content.
      const bottom = Math.max(...result.items.filter((entry) => entry !== item && entry.field !== 'title').map(contentBottom));
      assert.ok(bottom <= item.box.y + 0.5 && item.box.y - bottom <= 24 + 1, `${blocks.length} blocks ${direction}: ${bottom} -> ${item.box.y}`);
      assert.equal(result.items.at(-1), item);
    }
  }
});

test('LH-114: a quote authored first is the pull line under the headings', () => {
  const result = composeSlide({ title: 'Voices from the pilot', blocks: [quote, metric, list(3)] });
  const item = pull(result);
  assert.ok(item);
  assert.equal(result.items.indexOf(item), 1, 'right after the title');
  for (const other of result.items.filter((entry) => entry !== item && entry.field !== 'title')) assert.ok(other.box.y >= item.box.y + item.box.height - 0.5, other.path);
});

test('LH-114: a quote beside one compact block, a long quote and a quote in the middle keep their card', () => {
  for (const blocks of [[metric, quote], [{ text: 'Median time to first value fell from 21 days to 9.' }, quote], [chart('Engagement'), quote], [list(2), quote]]) {
    const result = composeSlide({ title: 'T', blocks });
    assert.equal(pull(result), undefined, JSON.stringify(blocks.map((block) => Object.keys(block)[0])));
    assert.ok(card(result).frameBox, 'the LH-78 card');
  }
  const long = { quote: { text: `${'The findings are fixable, but only if one named owner carries each of them. '.repeat(2)}`, attribution: 'Audit lead' } };
  assert.equal(pull(composeSlide({ title: 'T', blocks: [table, long] })), undefined, 'over 140 characters');
  assert.equal(pull(composeSlide({ title: 'T', blocks: [table, quote, list(3)] })), undefined, 'a quote in the middle');
  assert.equal(pull(composeSlide({ title: 'T', blocks: [table, { ...quote, emphasis: true }] })), undefined, 'its own emphasis');
});

test('LH-114: layoutQuote draws a pull line as rule, body and one caption line', () => {
  const laid = layoutQuote({ text: 'Apex answered every security question in writing.', attribution: 'Security reviewer', role: 'IT', source: 'Review notes' }, { x: 0, y: 0, width: 1000, height: 300 }, { pull: true, bodySize: 32, bodyLines: 2 });
  const [body, footer] = laid.parts;
  assert.deepEqual(laid.rule, { x: 0, y: 0, width: 80, height: 6 });
  assert.ok(body.box.y > laid.rule.y + laid.rule.height, 'the body under the rule');
  assert.equal(footer.text, '— Security reviewer, IT – Review notes');
  assert.deepEqual(footer.sources.map((source) => footer.text.slice(source.outputStart, source.outputEnd)), ['Security reviewer', 'IT', 'Review notes']);
  assert.ok(footer.box.y >= body.box.y + body.box.height, 'the caption under the body');
  assert.equal(laid.overflow, false);
  assert.equal(layoutQuote({ text: 'A plain quote.' }, { x: 0, y: 0, width: 600, height: 300 }).rule, undefined, 'only a pull line has a rule');
});

test('LH-06 (widened): a takeaway of up to 120 characters after two charts or tables is the foot band', () => {
  const takeaway = { text: 'Summer trips are 64% longer than winter ones, so we move fleet maintenance to the winter months.' };
  for (const blocks of [[chart('Rentals'), chart('Trips'), takeaway], [chart('Energy'), table, takeaway]]) {
    const result = composeSlide({ title: 'Seasonality in bike rentals', blocks });
    assert.equal(result.emphasis?.source, 'foot-band', blocks.map((block) => Object.keys(block)[0]).join(' '));
    assert.deepEqual(findings(result), []);
  }
  assert.equal(composeSlide({ title: 'T', blocks: [chart('Rentals'), takeaway] }).emphasis, undefined, 'one chart keeps the 60-character rule');
  const long = { text: `${takeaway.text} It also names the owner of the change and the date.` };
  assert.equal(composeSlide({ title: 'T', blocks: [chart('Rentals'), chart('Trips'), long] }).emphasis, undefined, 'over 120 characters');
});

test('LH-121: a timeline with status draws its progress to the current event and a status word under each label', () => {
  const events = [{ when: 'Jan', what: 'Design freeze', status: 'done' }, { when: 'Mar', what: 'EU cutover', status: 'done' }, { when: 'May', what: 'US cutover', status: 'current' }, { when: 'Aug', what: 'APAC cutover', status: 'planned' }];
  for (const direction of ['ltr', 'rtl']) {
    const laid = layoutTimeline(events, { x: 0, y: 0, width: 1100, height: 300 }, { statusWords: true, direction });
    const current = laid.markers[2], first = laid.markers[0];
    assert.deepEqual(laid.progress, { x1: Math.min(first.x, current.x), y1: first.y, x2: Math.max(first.x, current.x), y2: current.y });
    assert.deepEqual(laid.statusLabels.map((label) => label.text), events.map((event) => TIMELINE_STATUS_WORDS[event.status]));
    assert.ok(laid.parts.every((part) => part.role !== 'status'), 'status words are not source parts');
    for (const label of laid.statusLabels) {
      const what = laid.parts.find((part) => part.role === 'what' && part.eventIndex === label.eventIndex);
      assert.ok(label.box.y >= what.box.y + what.box.height - 0.5, 'under its label');
      assert.deepEqual(label.sources, []);
    }
  }
  // Done events only: the progress reaches the last one. No done or current event: no progress.
  assert.equal(layoutTimeline(events.map((event, index) => ({ ...event, status: index < 2 ? 'done' : 'planned' })), { x: 0, y: 0, width: 1100, height: 300 }).progress.x2, layoutTimeline(events, { x: 0, y: 0, width: 1100, height: 300 }).markers[1].x);
  assert.equal(layoutTimeline(events.map((event) => ({ ...event, status: 'planned' })), { x: 0, y: 0, width: 1100, height: 300 }).progress, undefined);
  // Words only when asked for; localized words share the same generated-label contract.
  assert.equal(layoutTimeline(events, { x: 0, y: 0, width: 1100, height: 300 }).statusLabels, undefined);
  assert.deepEqual(layoutTimeline(events, { x: 0, y: 0, width: 1100, height: 300 }, { statusWords: true, language: 'de' }).statusLabels.map(label=>label.text), ['Abgeschlossen','Abgeschlossen','Aktuell','Geplant']);
  // In composition the words are a guarded rule: a timeline that fits them keeps its size and gets them.
  const result = composeSlide({ title: 'Platform migration roadmap', blocks: [{ timeline: events }] });
  assert.equal(result.items.find((item) => item.timelineLayout).timelineLayout.statusLabels?.length, 4);
});

test('LH-122: in the timeline layout a text before the timeline is the lead, a text after it a note', () => {
  const record = layout('timeline');
  const timeline = { timeline: [{ when: 'Jan', what: 'Design freeze' }, { when: 'Mar', what: 'Cutover' }] };
  const text = { text: 'We migrate one region at a time.' };
  const regions = (blocks) => Object.fromEntries(bindRegions({ blocks }, record).regions.filter((region) => region.blocks.length).map((region) => [region.name, region.blocks.map((block) => block.block)]));
  assert.deepEqual(regions([text, timeline]), { lead: [0], timeline: [1] });
  assert.deepEqual(regions([timeline, text]), { timeline: [0], notes: [1] });
  assert.deepEqual(regions([text, timeline, { text: 'Each cutover runs clean for 30 days.' }]), { lead: [0], timeline: [1], notes: [2] });
  assert.deepEqual(regions([{ items: ['One', 'Two', 'Three'] }, timeline]), { timeline: [1], notes: [0] }, 'the lead takes text only');
  const result = composeSlide({ layout: 'timeline', title: 'Platform migration roadmap', blocks: [text, timeline] }, { layout: record });
  const [lead, drawn] = [result.items.find((item) => item.field === 'text'), result.items.find((item) => item.field === 'timeline')];
  assert.ok(lead.box.y + lead.box.height <= drawn.box.y + 0.5, 'the lead is drawn above the timeline');
  assert.deepEqual(findings(result), []);
});
