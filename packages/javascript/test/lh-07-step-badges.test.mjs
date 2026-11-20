// LH-07: a layout's `steps` or `numbered` region (its `arrangement`) draws its steps under numbered badges joined by a connector (blocks side by side, a list's entries
// down a badge column); an unnumbered lone list draws Basic Process at any length (OPF 0.35); steps keep the size they have without it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitList, STEP_BADGE, STEP_BADGE_GAP, listNumberLabel } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const { process: processLayout, agenda } = layouts;
// The same record without its steps or numbered arrangement: what the slide draws without LH-07.
const plain = (record) => ({ ...record, regions: record.regions.map(({ arrangement, ...region }) => arrangement === 'steps' || arrangement === 'numbered' ? region : { ...region, ...(arrangement ? { arrangement } : {}) }) });
const step = (text, description, start) => ({ region: 'body', items: [{ text, description, start }], numbering: 'arabic' });
const sampler = { title: 'Three steps from evidence to decision', blocks: [
  step('Establish a baseline', 'Measure the current completion rate and task time.', 1),
  step('Run the pilot', 'Test with two teams and review feedback each week.', 2),
  step('Decide what to scale', 'Compare outcomes with the baseline and agree the next step.', 3),
] };
const body = (result) => result.items.filter((entry) => !['title', 'subtitle', 'tag'].includes(entry.field));
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const top = (entry) => entry.text.listEntries?.[0]?.textBox.y ?? entry.text.placement?.lines[0]?.y ?? entry.box.y;

test('the gallery process layout lists steps and the agendas numbered steps', () => {
  assert.equal(processLayout.regions.find((region) => region.name === 'body').arrangement, 'steps');
  for (const id of ['agenda']) assert.equal(layouts[id].regions.find((region) => region.name === 'body').arrangement, 'numbered');
});

for (const direction of ['ltr', 'rtl']) {
  test(`LH-07 (${direction}): steps side by side get a badge each on one connector, and keep their size`, () => {
    const result = composeSlide(sampler, { layout: processLayout, direction }), without = composeSlide(sampler, { layout: plain(processLayout), direction });
    assert.equal(result.steps?.length, 1);
    const [row] = result.steps, items = body(result);
    assert.equal(row.form, 'row');
    assert.deepEqual(row.badges.map((badge) => badge.label), ['1', '2', '3']);
    assert.deepEqual(row.badges.map((badge) => badge.path), ['slides.0.blocks.0', 'slides.0.blocks.1', 'slides.0.blocks.2']);
    // Reading order: the first step is the leftmost, or the rightmost in a right-to-left deck.
    const xs = row.badges.map((badge) => badge.cx);
    assert.deepEqual(xs, [...xs].sort((a, b) => direction === 'rtl' ? b - a : a - b));
    // One line through the centers, from the first badge to the last.
    assert.deepEqual([row.connector.x1, row.connector.x2], [xs[0], xs.at(-1)]);
    for (const [index, badge] of row.badges.entries()) {
      const entry = items[index], size = entry.text.fontSize;
      assert.equal(badge.radius * 2, STEP_BADGE * size, 'the badge is STEP_BADGE times the step text across');
      assert.equal(badge.fontSize, size, 'its numeral is at the step text size');
      assert.equal(badge.cy, row.badges[0].cy, 'every badge of the row on one line');
      assert.ok(Math.abs(badge.cy + badge.radius + STEP_BADGE_GAP * 2 * badge.radius - top(entry)) < 1e-6 || badge.cy + badge.radius < top(entry), 'above its text');
      // At the start of its block: its left edge (its right edge in a right-to-left deck).
      assert.ok(Math.abs(direction === 'rtl' ? entry.box.x + entry.box.width - badge.cx - badge.radius : badge.cx - badge.radius - entry.box.x) < 1e-6);
      // The badge draws the number, so the one-entry list is a heading over its description without its marker, its number kept.
      assert.equal(entry.text.listEntries[0].heading, true);
      assert.equal(badge.list.path, entry.path);
      assert.equal(badge.list.number.value, index + 1);
    }
    // The size guard: every step keeps the size it has without the badges, and nothing overflows.
    assert.deepEqual(items.map((entry) => entry.text.fontSize), body(without).map((entry) => entry.text.fontSize));
    assert.deepEqual(findings(result), []);
    // The region's cell holds its badges.
    const region = result.regions.find((entry) => entry.name === 'body');
    for (const badge of row.badges) assert.ok(badge.cy - badge.radius >= region.box.y - 1e-6 && badge.cy - badge.radius >= result.contentBox.y);
  });
}

test('LH-07: paragraph steps are numbered by their position', () => {
  const result = composeSlide({ title: 'How a request reaches a decision', blocks: ['Intake', 'Triage', 'Review', 'Decide'].map((text) => ({ text })) }, { layout: processLayout });
  assert.deepEqual(result.steps?.map((entry) => entry.form), ['row']);
  assert.deepEqual(result.steps[0].badges.map((badge) => badge.label), ['1', '2', '3', '4']);
  assert.ok(result.steps[0].badges.every((badge) => badge.list === undefined));
});

test('LH-07: steps that would get smaller under their badges draw as before (the size guard)', () => {
  const long = 'Write down the decision the board must take, the evidence it needs, the date it needs it by and who owns each part of it.';
  const slide = { title: 'Six steps to a funded program', blocks: Array.from({ length: 6 }, (_, index) => step(`Step number ${index + 1} of the program`, long, index + 1)) };
  const result = composeSlide(slide, { layout: processLayout }), without = composeSlide(slide, { layout: plain(processLayout) });
  assert.equal(result.steps, undefined);
  assert.deepEqual(body(result).map((entry) => entry.text.fontSize), body(without).map((entry) => entry.text.fontSize));
});

for (const direction of ['ltr', 'rtl']) {
  test(`LH-07 (${direction}): a numbered agenda draws each entry beside its badge, down one connector`, () => {
    // An entry's badge is on the side its own paragraph starts: Arabic entries in a right-to-left deck start at the right.
    const items = direction === 'rtl' ? ['أين نحن اليوم', 'ما أظهرته التجربة', 'ما نقترح توسيعه', 'القرار المطلوب'] : ['Where we are today', 'What the pilot showed', 'What we propose to scale', 'The decision we need'];
    const slide = { title: 'Today’s agenda', blocks: [{ numbering: 'arabic', items }] };
    const result = composeSlide(slide, { layout: agenda, direction }), without = composeSlide(slide, { layout: plain(agenda), direction });
    assert.equal(result.steps?.length, 1);
    const [column] = result.steps, list = body(result)[0];
    assert.equal(column.form, 'column');
    assert.deepEqual(column.badges.map((badge) => badge.label), ['1', '2', '3', '4']);
    assert.equal(column.connector.x1, column.connector.x2, 'the connector runs down the badge column');
    for (const [index, entry] of list.text.listEntries.entries()) {
      const badge = column.badges[index];
      assert.equal(entry.marker.none, true, 'the badge replaces the marker');
      assert.equal(entry.marker.number.value, index + 1, 'and the entry keeps its number');
      // The text starts after the badge column (before it, in a right-to-left deck).
      assert.equal(entry.direction, direction === 'rtl' ? 'rtl' : undefined);
      assert.ok(direction === 'rtl' ? entry.textBox.x + entry.textBox.width <= badge.cx - badge.radius : entry.textBox.x >= badge.cx + badge.radius);
      if (index) assert.ok(badge.cy - badge.radius - (column.badges[index - 1].cy + column.badges[index - 1].radius) >= STEP_BADGE_GAP * 2 * badge.radius - 1e-6, 'badges stay apart');
    }
    // The list keeps the size it grows to without the badges (LH-48), and the badges stay on the slide body.
    assert.equal(list.text.fontSize, body(without)[0].text.fontSize);
    assert.deepEqual(findings(result), []);
  });
}

test('LH-07: an agenda is ordered by nature: an unnumbered list draws beside badges, as drawing only', () => {
  const slide = { title: 'Agenda', blocks: [{ items: ['Where we are today', 'What the pilot showed', 'The decision we need'] }] };
  const before = structuredClone(slide), result = composeSlide(slide, { layout: agenda }), without = composeSlide(slide, { layout: plain(agenda) });
  assert.deepEqual(result.steps?.map((entry) => entry.form), ['column']);
  assert.deepEqual(result.steps[0].badges.map((badge) => badge.label), ['1', '2', '3']);
  // The numbers are the badges' drawing: no badge names a list number, and the document is unchanged.
  assert.ok(result.steps[0].badges.every((badge) => badge.list === undefined));
  assert.deepEqual(slide, before);
  assert.equal(body(result)[0].payload.numbering, undefined);
  assert.equal(body(result)[0].text.fontSize, body(without)[0].text.fontSize);
});

test('LH-07: the unnumbered lists of one agenda count on from one list to the next', () => {
  const slide = { title: 'Agenda', blocks: [{ items: ['Results', 'Drivers', 'Plan'] }, { items: ['Risks', 'Decisions'] }] };
  const result = composeSlide(slide, { layout: agenda }), without = composeSlide(slide, { layout: plain(agenda) });
  const labels = (result.steps ?? []).map((entry) => entry.badges.map((badge) => badge.label));
  assert.deepEqual(labels, [['1', '2', '3'], ['4', '5']]);
  // The count runs over the whole agenda: with a list that cannot take badges (one entry), the unnumbered lists keep their markers.
  const partial = composeSlide({ title: 'Agenda', blocks: [{ items: ['Results', 'Drivers', 'Plan'] }, { items: [{ text: 'Decisions', description: 'What we need today' }] }] }, { layout: agenda });
  assert.equal(partial.steps, undefined);
  assert.deepEqual(body(result).map((entry) => entry.text.fontSize), body(without).map((entry) => entry.text.fontSize));
});

// OPF 0.35, the owner's decision: a process list is drawn as Basic Process. Every unnumbered lone list of a `steps` region, of any length
// and count, draws as boxes joined by arrows, at the size the list would have as steps (its numbered twin) or larger, never smaller.
const entrySize = (result) => Math.min(...body(result)[0].text.listEntries.filter((entry) => (entry.level ?? 0) === 0).map((entry) => entry.text.fontSize));
const longEntries = ['Agree scope and owners', 'Run two teams for six weeks', 'Measure completion and task time', 'Scale to every regional team'];
const nine = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const twelve = ['Intake', 'Triage', 'Assign', 'Reproduce', 'Diagnose', 'Fix', 'Review', 'Test', 'Merge', 'Release', 'Notify', 'Close'];
const longEight = ['Write the problem statement', 'Interview ten target customers', 'Sketch three candidate solutions', 'Test the riskiest assumption', 'Build the smallest useful version', 'Release it to one region', 'Measure adoption every week', 'Decide to scale or stop'];
for (const direction of ['ltr', 'rtl']) {
  test(`0.35 (${direction}): every unnumbered lone list of a steps region draws Basic Process, at the size its steps have or larger`, () => {
    const lists = [['Queue', 'Route'], ['Queue', 'Route', 'Resolve', 'Follow up'], ['Plan', 'Scope work', 'Build it', 'Test it', 'Fix bugs', 'Review', 'Release', 'Measure'],
      ['Plan', 'Build the prototype', 'Ship'], longEntries, nine, twelve, longEight];
    for (const size of [{}, { width: 720, height: 1280 }]) for (const items of lists) {
      const result = composeSlide({ title: 'How support works', blocks: [{ items }] }, { layout: processLayout, direction, ...size });
      // The same entries numbered keep their steps (or a plain list where badges would cost a size): the size before the decision.
      const stepped = composeSlide({ title: 'How support works', blocks: [{ items, numbering: 'arabic' }] }, { layout: processLayout, direction, ...size });
      const label = `${items.length} entries${size.width ? ', portrait' : ''}`;
      assert.equal(result.steps, undefined, `${label}: a process draws no badges`);
      assert.equal(result.arrangements?.length, 1, label);
      const [process] = result.arrangements, list = body(result)[0];
      assert.deepEqual([process.kind, process.region, process.path], ['process', 'body', list.path]);
      assert.equal(process.nodes.length, items.length);
      assert.equal(list.listColumns.length, items.length);
      assert.ok(entrySize(result) >= entrySize(stepped) - 1e-6, `${label}: ${entrySize(result)} is under the steps' ${entrySize(stepped)}`);
      assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'arrangement-adapted'), [], label);
      assert.deepEqual(findings(result), [], label);
    }
  });
}

test('0.35: a box holds its entry\'s description and the entries nested under it, never smaller than the list', () => {
  const described = [{ text: 'Baseline', description: 'Measure completion rate and task time.' }, { text: 'Pilot', description: 'Two teams for six weeks, weekly review.' }, 'Decide'];
  const nested = ['Prepare', { text: 'Collect data', level: 1 }, { text: 'Book rooms', level: 1 }, 'Run', { text: 'Workshops', level: 1 }, 'Report'];
  for (const [items, nodes] of [[described, 3], [nested, 3]]) {
    const result = composeSlide({ title: 'Steps', blocks: [{ items }] }, { layout: processLayout });
    const plainList = composeSlide({ title: 'Steps', blocks: [{ items }] }, { layout: plain(processLayout) });
    const [process] = result.arrangements ?? [], list = body(result)[0];
    assert.equal(process?.kind, 'process');
    assert.equal(process.nodes.length, nodes, 'one box per first-level entry');
    // Each box's column spans its entry and the entries nested under it; the node is named by its first-level entry.
    assert.deepEqual(list.listColumns.map((column) => [column.start, column.end]), items === nested ? [[0, 3], [3, 5], [5, 6]] : [[0, 1], [1, 2], [2, 3]]);
    assert.deepEqual(process.nodes.map((node) => node.path), list.listColumns.map((column) => `${list.path}.${column.start}${typeof items[column.start] === 'object' ? '.text' : ''}`));
    // Every line of an entry and its description lies in its box.
    for (const [index, column] of list.listColumns.entries()) {
      const box = process.nodes[index].box;
      for (const entry of column.text.listEntries) for (const part of [entry.textBox, entry.description ? entry.descriptionBox : undefined].filter(Boolean)) {
        assert.ok(part.x >= box.x - 1e-6 && part.x + part.width <= box.x + box.width + 1e-6 && part.y >= box.y - 1e-6, `entry ${entry.index} in box ${index}`);
      }
    }
    const entries = list.text.listEntries, size = process.fontSize;
    assert.ok(entries.filter((entry) => entry.level === 0).every((entry) => Math.abs(entry.text.fontSize - size) < 1e-6), 'every first-level entry at the process size');
    for (const entry of entries) if (entry.description) assert.ok(Math.abs(entry.description.richLines[0].fragments[0].fontSize - .82 * size) < .01, 'a description at 0.82 of it');
    for (const entry of entries.filter((each) => each.level > 0)) assert.ok(entry.text.fontSize <= size + 1e-6 && entry.text.fontSize >= body(plainList)[0].text.fontSize - 1e-6, 'a nested entry between the list size and the box size');
    assert.ok(size >= body(plainList)[0].text.fontSize - 1e-6, `${size} is under the list's ${body(plainList)[0].text.fontSize}`);
  }
});

test('0.35: what still draws as steps: a numbered list, blocks side by side; an icon list keeps its chips', () => {
  for (const block of [{ items: ['Plan', 'Build', 'Ship'], numbering: 'arabic' }, { items: longEntries, numbering: 'arabic' }]) {
    const result = composeSlide({ title: 'Steps', blocks: [block] }, { layout: processLayout });
    assert.equal(result.arrangements, undefined);
    assert.deepEqual(result.steps?.map((entry) => entry.form), ['column']);
  }
  // A short list beside a paragraph in the region: the blocks are steps side by side. (A short closing line is the foot band instead, LH-06,
  // and leaves the list alone in the region.)
  const mixed = composeSlide({ title: 'Steps', blocks: [{ items: ['Plan', 'Build', 'Ship'] }, { text: 'Each step ends with a short review before the next one starts.' }] }, { layout: processLayout });
  assert.equal(mixed.arrangements, undefined);
  assert.deepEqual(mixed.steps?.map((entry) => entry.form), ['row']);
  const icons = composeSlide({ title: 'Steps', blocks: [{ items: [{ text: 'Plan', icon: 'lucide:map' }, { text: 'Build', icon: 'lucide:hammer' }, { text: 'Ship', icon: 'lucide:rocket' }] }] }, { layout: processLayout });
  assert.equal(icons.arrangements, undefined);
});

test('0.35: a list that no Basic Process holds at its size stays the list it would be (arrangement-adapted), never smaller', () => {
  const sentence = 'collect every open request from every channel into one shared queue that the whole team can see and sort by impact before the weekly review';
  const items = Array.from({ length: 10 }, (_, index) => `Step ${index + 1}: ${sentence}`);
  for (const size of [{}, { width: 720, height: 1280 }]) {
    const result = composeSlide({ title: 'Steps', blocks: [{ items }] }, { layout: processLayout, ...size }), stepped = composeSlide({ title: 'Steps', blocks: [{ items, numbering: 'arabic' }] }, { layout: processLayout, ...size });
    assert.equal(result.arrangements, undefined);
    assert.equal(result.steps, undefined, 'never steps');
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'arrangement-adapted').map((entry) => entry.path), [body(result)[0].path]);
    assert.ok(entrySize(result) >= entrySize(stepped) - 1e-6, `${entrySize(result)} is under the steps' ${entrySize(stepped)}`);
  }
});

test('LH-07: a numbered list of longer entries in a steps region draws beside badges, with its own numbers', () => {
  const slide = { title: 'Five stages of the rollout', blocks: [{ items: longEntries, numbering: 'arabic' }] };
  const result = composeSlide(slide, { layout: processLayout });
  assert.deepEqual(result.steps?.map((entry) => entry.form), ['column']);
  assert.deepEqual(result.steps[0].badges.map((badge) => badge.label), ['1', '2', '3', '4']);
});

test('LH-07: fitList badges replace the markers with badges in the marker column', () => {
  const style = { fontFamily: 'sans-serif', fontWeight: 400 };
  const fit = fitList(['One', 'Two', 'Three'], { x: 100, y: 50, width: 800, height: 600 }, 30, 30, { style, numbering: 'roman-upper', badges: true });
  assert.deepEqual(fit.listEntries.map((entry) => entry.badge.label), ['I', 'II', 'III']);
  for (const entry of fit.listEntries) {
    assert.equal(entry.badge.diameter, STEP_BADGE * 30);
    assert.equal(entry.badge.cx, 100 + entry.badge.diameter / 2);
    assert.ok(entry.textBox.x >= 100 + entry.badge.diameter);
    assert.ok(entry.badge.cy - entry.badge.diameter / 2 >= 50 - 1e-6, 'the first badge stays in the box');
  }
  assert.equal(listNumberLabel({ value: 4, style: 'roman-lower' }), 'iv');
  // Nested entries keep their markers.
  const nested = fitList(['One', { text: 'Inner', level: 1 }], { x: 0, y: 0, width: 800, height: 600 }, 30, 30, { style, numbering: 'arabic', badges: true });
  assert.ok(nested.listEntries.every((entry) => entry.badge === undefined && !entry.marker.none));
});
