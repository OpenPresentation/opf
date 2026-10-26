import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutTemplate} from '../dist/composition.js';

// WI-2: on a column record whose entries are all `auto`, the record's `anchor` places the whole stack, headings included.
// Any other record keeps today's placement: a region's anchor never moves the title.
const record = (anchor, regions) => ({id: 'stack', direction: 'column', ...(anchor ? {anchor} : {}), regions});
const allAuto = [{name: 'title'}, {name: 'details', size: 'auto', accepts: ['text'], flow: 'none'}];
const slide = {title: 'Thank you', blocks: [{text: 'Next step: book a call'}]};
const compose = (layout, value = slide, options = {}) => composeSlide(value, {width: 1280, height: 720, layout, ...options});
const top = result => Math.min(...result.items.map(item => item.box.y));
const bottom = result => Math.max(...result.items.map(item => item.box.y + item.box.height));
const free = result => ({top: result.contentBox.y, bottom: result.contentBox.y + result.contentBox.height});

test('the template reports the stack anchor only for a column of auto entries with a non-top anchor', () => {
  assert.equal(layoutTemplate(record('middle', allAuto)).stack, 'middle');
  assert.equal(layoutTemplate(record('bottom', allAuto)).stack, 'bottom');
  assert.equal(layoutTemplate(record('top', allAuto)).stack, undefined);
  assert.equal(layoutTemplate(record(undefined, allAuto)).stack, undefined);
  assert.equal(layoutTemplate(record('middle', [{name: 'title'}, {name: 'details', accepts: ['text']}])).stack, undefined);
  assert.equal(layoutTemplate(record('middle', [{name: 'title'}, {name: 'details', size: 2, accepts: ['text']}])).stack, undefined);
  assert.equal(layoutTemplate(record('middle', [{name: 'title'}, {direction: 'row', size: 'auto', regions: [{name: 'a'}, {name: 'b'}]}])).stack, 'middle', 'a split sized auto is an auto entry');
  assert.equal(layoutTemplate(record('middle', [{name: 'title'}, {direction: 'row', regions: [{name: 'a'}, {name: 'b'}]}])).stack, undefined, 'a split with the default size is a numeric track');
  assert.equal(layoutTemplate({id: 'row', direction: 'row', anchor: 'middle', regions: [{name: 'title'}, {name: 'details'}]}).stack, undefined);
});

test('an all-auto column with anchor middle centres the whole stack, title included', () => {
  const result = compose(record('middle', allAuto)), box = free(result);
  assert.ok(Math.abs((top(result) - box.top) - (box.bottom - bottom(result))) < 1.5, 'equal space above and below the stack');
  assert.ok(top(result) > compose(record(undefined, allAuto)).items[0].box.y + 100, 'the title moved down');
  assert.equal(result.diagnostics.length, 0);
});

test('anchor bottom sits the stack at the foot; top and no anchor are the unchanged top-down stack', () => {
  const result = compose(record('bottom', allAuto)), plain = compose(record(undefined, allAuto)), box = free(result);
  assert.ok(Math.abs(box.bottom - bottom(result)) < 1.5);
  for (const anchor of ['top', undefined]) assert.deepEqual(compose(record(anchor, allAuto)).items.map(item => item.box), plain.items.map(item => item.box));
  assert.ok(Math.abs(top(plain) - box.top) < 1.5);
});

test('the support sits one gap below the title in the stack, wherever the stack sits', () => {
  for (const anchor of [undefined, 'middle', 'bottom']) {
    const result = compose(record(anchor, allAuto)), title = result.items[0], text = result.items[1];
    const gap = text.box.y - (title.box.y + title.box.height);
    assert.ok(gap > 0 && gap < 40, `${anchor}: gap ${gap}`);
  }
});

test('the heading areas and regions move with the stack', () => {
  const result = compose(record('middle', allAuto));
  assert.ok(Math.abs(result.headingAreas[0].box.y - result.items[0].box.y) < 1);
  assert.ok(Math.abs(result.regions[0].box.y - result.items[1].box.y) < 4);
});

test('a column with any numeric entry never moves its title: the record anchor reaches the body regions only', () => {
  const mixed = [{name: 'title'}, {name: 'details', accepts: ['text'], flow: 'none'}];
  for (const anchor of ['middle', 'bottom']) {
    const anchored = compose(record(anchor, mixed)), plain = compose(record(undefined, mixed));
    assert.deepEqual(anchored.items[0].box, plain.items[0].box);
    assert.deepEqual(anchored.headingAreas, plain.headingAreas);
    assert.ok(anchored.items[1].box.y > plain.items[1].box.y, 'the body content is anchored in its own region');
  }
});

test('a title-only slide centres the title alone, and an empty optional region collapses', () => {
  const only = compose(record('middle', allAuto), {title: 'Thank you'}), box = free(only);
  assert.equal(only.items.length, 1);
  assert.ok(Math.abs((top(only) - box.top) - (box.bottom - bottom(only))) < 1.5);
  // The title-only slide is placed as it is with a numeric title row, where the title centres in the content box.
  const numeric = compose(record(undefined, [{name: 'title', size: 1}, {name: 'details', size: 'auto', accepts: ['text'], flow: 'none'}]), {title: 'Thank you'});
  assert.deepEqual(only.items.map(item => item.box), numeric.items.map(item => item.box));
  // The same title with a support region present but empty draws the same box.
  const empty = compose(record('middle', allAuto), {title: 'Thank you', blocks: []});
  assert.deepEqual(empty.items.map(item => item.box), only.items.map(item => item.box));
});

test('a long title with long support still fits the slide without overflow', () => {
  const value = {title: 'A closing title that runs to several words so that it needs more than one line to show', blocks: [{text: 'Supporting copy that is deliberately long so that the stack nearly fills the content box. '.repeat(6)}]};
  for (const anchor of ['middle', 'bottom']) {
    const result = compose(record(anchor, allAuto), value), box = free(result);
    assert.equal(result.diagnostics.length, 0, anchor);
    assert.ok(top(result) >= box.top - 1 && bottom(result) <= box.bottom + 1, anchor);
  }
});

test('a body region anchor does not move the title when the column has a numeric entry', () => {
  const layout = {id: 'region-anchor', direction: 'column', regions: [{name: 'title'}, {name: 'details', accepts: ['text'], flow: 'none', anchor: 'middle'}]};
  const result = compose(layout);
  assert.ok(Math.abs(result.items[0].box.y - compose(record(undefined, [{name: 'title'}, {name: 'details', accepts: ['text'], flow: 'none'}])).items[0].box.y) < 1);
});
