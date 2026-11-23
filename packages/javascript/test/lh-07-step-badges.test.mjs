// LH-07: a layout's `steps` or `numbered` region (its `arrangement`) draws its steps under numbered badges joined by a connector (blocks side by side, a list's entries
// down a badge column); a lone list of 2 to 8 one- or two-word entries draws Basic Process (OPF 0.35); steps keep the size they have without it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitList, LONE_DISPLAY_SIZES, STEP_BADGE, STEP_BADGE_GAP, listNumberLabel } from '../dist/composition.js';
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
    // The size guard: every step keeps the size it has without the badges, and nothing overflows. LH-102: a plain layout body under half full
    // grows on past a list's display size; a layout that may draw its body keeps LH-48's three steps (up to that display size) there.
    assert.deepEqual(items.map((entry) => entry.text.fontSize), body(without).map((entry) => Math.min(entry.text.fontSize, LONE_DISPLAY_SIZES.list)));
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
  assert.deepEqual(body(result).map((entry) => entry.text.fontSize), body(without).map((entry) => Math.min(entry.text.fontSize, LONE_DISPLAY_SIZES.list)));
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
    // The list keeps at least the size it grows to without the badges (LH-48; LH-102 grows a short agenda on past the list display size,
    // where the same list drawn as numerals keeps it), and the badges stay on the slide body.
    assert.ok(list.text.fontSize >= body(without)[0].text.fontSize - 1e-6);
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
  assert.ok(body(result)[0].text.fontSize >= Math.min(body(without)[0].text.fontSize, LONE_DISPLAY_SIZES.list) - 1e-6);
});

test('LH-07: the unnumbered lists of one agenda count on from one list to the next', () => {
  const slide = { title: 'Agenda', blocks: [{ items: ['Results', 'Drivers', 'Plan'] }, { items: ['Risks', 'Decisions'] }] };
  const result = composeSlide(slide, { layout: agenda }), without = composeSlide(slide, { layout: plain(agenda) });
  const labels = (result.steps ?? []).map((entry) => entry.badges.map((badge) => badge.label));
  assert.deepEqual(labels, [['1', '2', '3'], ['4', '5']]);
  // The count runs over the whole agenda: with a list that cannot take badges (one entry), the unnumbered lists keep their markers.
  const partial = composeSlide({ title: 'Agenda', blocks: [{ items: ['Results', 'Drivers', 'Plan'] }, { items: [{ text: 'Decisions', description: 'What we need today' }] }] }, { layout: agenda });
  assert.equal(partial.steps, undefined);
  assert.deepEqual(body(result).map((entry) => entry.text.fontSize), body(without).map((entry) => Math.min(entry.text.fontSize, LONE_DISPLAY_SIZES.list)));
});

for (const direction of ['ltr', 'rtl']) {
  test(`0.35 (${direction}): a lone list of 2 to 8 one- or two-word steps draws Basic Process, at the size its steps have or larger`, () => {
    const lists = [['Queue', 'Route'], ['Queue', 'Route', 'Resolve', 'Follow up'], ['Plan', 'Scope work', 'Build it', 'Test it', 'Fix bugs', 'Review', 'Release', 'Measure']];
    for (const items of lists) {
      const result = composeSlide({ title: 'How support works', blocks: [{ items }] }, { layout: processLayout, direction });
      // The same entries numbered are no candidate: they draw as they did before 0.35 (steps, or a plain list where badges would cost a size).
      const stepped = composeSlide({ title: 'How support works', blocks: [{ items, numbering: 'arabic' }] }, { layout: processLayout, direction });
      assert.equal(result.steps, undefined, 'a process draws no badges');
      assert.equal(result.arrangements?.length, 1);
      const [process] = result.arrangements, list = body(result)[0];
      assert.deepEqual([process.kind, process.region, process.path], ['process', 'body', list.path]);
      assert.equal(process.nodes.length, items.length);
      assert.equal(list.listColumns.length, items.length);
      assert.ok(process.fontSize >= body(stepped)[0].text.fontSize - 1e-6, `${items.length} entries: ${process.fontSize} is under the steps' ${body(stepped)[0].text.fontSize}`);
      assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'arrangement-adapted'), []);
      assert.deepEqual(findings(result), []);
    }
  });
}

test('0.35: other lone lists of a steps region draw as before: 9 entries, a three-word entry, a description, numbering', () => {
  const nine = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  // Nine entries: no process; the badges would set the list smaller, so it is a plain list, as in 0.34.
  const long = composeSlide({ title: 'Steps', blocks: [{ items: nine }] }, { layout: processLayout });
  assert.deepEqual([long.arrangements, long.steps], [undefined, undefined]);
  for (const block of [{ items: ['Plan', 'Build the prototype', 'Ship'] }, { items: ['Plan', { text: 'Build', description: 'Two weeks' }, 'Ship'] }, { items: ['Plan', 'Build', 'Ship'], numbering: 'arabic' }]) {
    const result = composeSlide({ title: 'Steps', blocks: [block] }, { layout: processLayout });
    assert.equal(result.arrangements, undefined);
    assert.deepEqual(result.steps?.map((entry) => entry.form), ['column']);
  }
  // A short list beside a paragraph in the region: the blocks are steps side by side. (A short closing line is the foot band instead, LH-06,
  // and leaves the list alone in the region.)
  const mixed = composeSlide({ title: 'Steps', blocks: [{ items: ['Plan', 'Build', 'Ship'] }, { text: 'Each step ends with a short review before the next one starts.' }] }, { layout: processLayout });
  assert.equal(mixed.arrangements, undefined);
  assert.deepEqual(mixed.steps?.map((entry) => entry.form), ['row']);
});

test('0.35: a short list that Basic Process does not hold at its size draws as steps (the slide is composed again)', () => {
  const items = ['Internationalizations', 'Telecommunications', 'Interoperabilities', 'Institutionalization', 'Counterrevolutionary', 'Electroencephalogram', 'Characterizations', 'Incomprehensibility'];
  // A portrait slide: no row or column of boxes holds eight long words at the list's size.
  const result = composeSlide({ title: 'Steps', blocks: [{ items }] }, { layout: processLayout, width: 720, height: 1280 });
  assert.equal(result.arrangements, undefined);
  assert.deepEqual(result.steps?.map((entry) => entry.form), ['column']);
  assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'arrangement-adapted'), [], 'no finding: the steps are the drawing');
  // On a landscape slide the same list draws Basic Process.
  assert.equal(composeSlide({ title: 'Steps', blocks: [{ items }] }, { layout: processLayout }).arrangements?.[0]?.kind, 'process');
});

test('LH-07: a list of longer entries in a steps region draws beside badges, numbered in arabic', () => {
  const slide = { title: 'Five stages of the rollout', blocks: [{ items: ['Agree scope and owners', 'Run two teams for six weeks', 'Measure completion and task time', 'Scale to every regional team'] }] };
  const result = composeSlide(slide, { layout: processLayout });
  assert.deepEqual(result.steps?.map((entry) => entry.form), ['column']);
  assert.deepEqual(result.steps[0].badges.map((badge) => badge.label), ['1', '2', '3', '4']);
  // The list has no numbering of its own, so no badge claims one for it.
  assert.ok(result.steps[0].badges.every((badge) => badge.list === undefined));
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
