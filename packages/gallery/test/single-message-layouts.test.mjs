// WI-2 (whole-group placement): the single-message layouts place the title and what belongs to it as one group, and
// agenda-split joins the openers. Each changed record is checked against the geometry of its 0.26.10 form.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const GAP = 24; // the default gap at a 1280 x 720 canvas
const OLD = {
  closing: { id: 'closing', design: { titleAlignment: 'center', contentAlignment: 'center' }, direction: 'column', regions: [{ name: 'title', size: 1 }, { name: 'details', size: 'auto', accepts: ['text', 'list', 'image'], role: 'supporting', flow: 'auto' }] },
  statement: { id: 'statement', design: { titleAlignment: 'center', contentAlignment: 'center' }, direction: 'column', anchor: 'middle', regions: [{ name: 'title' }, { name: 'message', accepts: ['text', 'quote', 'metric'], role: 'primary', flow: 'none' }] },
  quote: { id: 'quote', direction: 'column', anchor: 'middle', regions: [{ name: 'title' }, { name: 'quotes', accepts: ['quote', 'group'], role: 'primary', flow: 'grid' }] },
  comparison: { id: 'comparison', design: { contentBox: false }, direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'first', accepts: ['text', 'list', 'metric', 'image', 'chart', 'table', 'group'], role: 'primary', flow: 'none' }, { name: 'second', accepts: ['text', 'list', 'metric', 'image', 'chart', 'table', 'group'], role: 'primary', flow: 'none' }] }, { name: 'verdict', size: 'auto', accepts: ['text'], role: 'supporting', flow: 'none' }] },
};
const compose = (layout, slide) => composeSlide(slide, { width: 1280, height: 720, layout: typeof layout === 'string' ? gallery.layouts[layout] : layout });
const field = (result, name) => result.items.find((item) => item.field === name);
const bottomOf = (item) => item.box.y + item.box.height;
const spanOf = (result) => ({ top: Math.min(...result.items.map((item) => item.box.y)), bottom: Math.max(...result.items.map(bottomOf)) });
const centred = (result) => { const { top, bottom } = spanOf(result), box = result.contentBox; return (top - box.y) - (box.y + box.height - bottom); };
const SUB = 'Illustrative example';

test('the title-only closing, statement, quote and comparison draw as they did in 0.26.10', () => {
  for (const id of ['closing', 'statement', 'quote', 'comparison']) {
    for (const slide of [{ title: 'One message' }, { title: 'One message', subtitle: SUB }]) {
      const before = compose(OLD[id], slide), after = compose(id, slide);
      assert.deepEqual(after.items.map((item) => [item.field, item.box, item.alignment]), before.items.map((item) => [item.field, item.box, item.alignment]), `${id} ${Object.keys(slide)}`);
    }
  }
});

test('closing and statement place the support within one gap of the heading group, centred as one stack', () => {
  const support = { blocks: [{ text: 'Next step: name the pilot lead and agree the start date.' }] };
  for (const id of ['closing', 'statement']) {
    const result = compose(id, { title: 'Agree the pilot team', subtitle: SUB, ...support });
    const gapBelow = field(result, 'text').box.y - bottomOf(field(result, 'subtitle'));
    assert.ok(gapBelow > 0 && gapBelow <= GAP + 1, `${id}: support ${gapBelow}px below the subtitle`);
    assert.ok(Math.abs(centred(result)) < 3, `${id}: equal space above and below the group`);
    assert.equal(result.diagnostics.length, 0, id);
    // Before, the support sat far below the title.
    const before = compose(OLD[id], { title: 'Agree the pilot team', subtitle: SUB, ...support });
    assert.ok(field(before, 'text').box.y - bottomOf(field(before, 'subtitle')) > 100, `${id}: the 0.26.10 gap was large`);
  }
});

test('statement keeps a quote and a metric support with the title', () => {
  for (const block of [{ quote: { text: 'We can now see where people need help.', attribution: 'Pilot lead' } }, { metric: { value: '84%', label: 'Task completion' } }]) {
    const result = compose('statement', { title: 'Start small enough to learn quickly', subtitle: SUB, blocks: [block] });
    const body = result.items.find((item) => item.field === 'quote' || item.field === 'metric');
    assert.ok(body.box.y - bottomOf(field(result, 'subtitle')) <= GAP + 1, Object.keys(block)[0]);
    assert.ok(Math.abs(centred(result)) < 30, `${Object.keys(block)[0]}: roughly centred`);
  }
});

test('closing keeps its long title and long support inside the slide', () => {
  const result = compose('closing', { title: 'A closing title that runs to several words so that it needs more than one line to show', subtitle: SUB, blocks: [{ text: 'Start with one pilot team, measure the impact for six weeks and use the evidence to decide which workflows to extend. We will agree an accountable owner and a review date before the meeting ends.' }] });
  const { top, bottom } = spanOf(result), box = result.contentBox;
  assert.ok(top >= box.y - 1 && bottom <= box.y + box.height + 1);
  assert.equal(result.diagnostics.length, 0);
});

test('a contact or QR image on the closing is shown whole (contain), not cropped', () => {
  const image = { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIi8+', alt: 'Contact code' };
  const result = compose('closing', { title: 'Agree the pilot team', blocks: [{ image }, { text: 'Continue the conversation' }] });
  const picture = result.items.find((item) => item.field === 'image');
  assert.equal(picture.image.fit, 'contain');
  assert.equal(gallery.layouts.closing.design.imageFit, 'contain');
});

test('quote centres the title and the quotation as one group', () => {
  const quote = { text: 'We can now see where participants need help.', attribution: 'Pilot lead', source: 'Illustrative quotation' };
  const result = compose('quote', { title: 'A shared view makes decisions easier', subtitle: SUB, blocks: [{ quote }] });
  assert.ok(Math.abs(centred(result)) < 20, 'the group is centred');
  const q = result.items.find((item) => item.field === 'quote');
  assert.ok(q.box.y - bottomOf(field(result, 'subtitle')) <= 2 * GAP, 'the quote follows its title');
  assert.equal(result.diagnostics.length, 0);
});

test('comparison puts the verdict right under the options, with the title on top', () => {
  const slide = { title: 'Choose the smallest useful test', subtitle: SUB, blocks: [{ text: 'Option A: focused pilot\nTwo teams, six weeks.' }, { text: 'Option B: broad rollout\nAll teams, three months.' }, { text: 'Recommendation: establish the evidence with Option A.' }] };
  const result = compose('comparison', slide), before = compose(OLD.comparison, slide);
  const [first, second, verdict] = result.items.filter((item) => item.field === 'text');
  assert.equal(first.box.y, second.box.y);
  assert.ok(verdict.box.y - Math.max(bottomOf(first), bottomOf(second)) <= GAP + 2, 'the verdict follows the options');
  assert.equal(field(result, 'title').box.y, field(before, 'title').box.y, 'the title stays at the top');
  assert.ok(verdict.box.y < before.items.filter((item) => item.field === 'text')[2].box.y - 100, 'the verdict moved up from the foot');
  assert.equal(result.diagnostics.length, 0);
});

test('agenda-split binds three, six and nine entries without findings, the list beside the title', () => {
  const layout = gallery.layouts['agenda-split'];
  assert.ok(layout, 'the record exists');
  for (const count of [3, 6, 9]) {
    const items = Array.from({ length: count }, (_, index) => `Part ${index + 1}: a short agenda entry`);
    const result = compose('agenda-split', { title: 'From the problem to the next decision', subtitle: SUB, blocks: [{ items }] });
    assert.equal(result.diagnostics.length, 0, `${count} entries`);
    const title = field(result, 'title'), list = field(result, 'items');
    assert.ok(list.box.x >= title.box.x + title.box.width - 1 || list.box.x > title.box.x + 100, `${count}: the list is beside the title`);
    assert.ok(list.box.y >= result.contentBox.y - 1 && bottomOf(list) <= result.contentBox.y + result.contentBox.height + 1, `${count}: inside the content box`);
    assert.deepEqual(result.regions.map((region) => region.name), ['items']);
  }
});

test('the image record says the picture is shown whole', () => {
  const record = gallery.layouts.image;
  assert.match(record.summary, /shown whole/);
  assert.match(record.description, /whole/);
  assert.match(record.description, /cover/);
  assert.equal(record.design.imageFit, 'contain');
});
