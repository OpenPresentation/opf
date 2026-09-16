import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';

const titleSubtitle = {id: 'title-subtitle', placeholders: [{type: 'title'}, {type: 'subtitle'}]};
const titleOnly = {id: 'title', placeholders: [{type: 'title'}]};
const text1x = {id: 'text-1x', placeholders: [{type: 'title'}, {type: 'text'}]};
const overlaps = (a, b) => a.x < b.x + b.width - 1e-5 && a.x + a.width > b.x + 1e-5 && a.y < b.y + b.height - 1e-5 && a.y + a.height > b.y + 1e-5;
const byField = (result, field) => result.items.find(item => item.field === field);
const headingGroup = result => {
  const headings = result.items.filter(item => ['tag', 'title', 'subtitle'].includes(item.field));
  const top = Math.min(...headings.map(item => item.box.y));
  const bottom = Math.max(...headings.map(item => item.box.y + item.box.height));
  return {headings, top, bottom, height: bottom - top};
};

test('title and subtitle share the padded safe width', () => {
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}, {width: 1024, height: 768}]) {
    const result = composeSlide({title: 'Short title', subtitle: 'A short subtitle'}, {...dimensions, layout: titleSubtitle});
    const title = byField(result, 'title'), subtitle = byField(result, 'subtitle');
    assert.equal(title.box.x, subtitle.box.x);
    assert.equal(title.box.width, subtitle.box.width);
    const padding = 0.08 * Math.min(dimensions.width, dimensions.height);
    assert.ok(Math.abs(title.box.x - padding) < 1e-6);
    assert.ok(Math.abs(title.box.width - (dimensions.width - 2 * padding)) < 1e-6);
  }
});

test('cover layouts vertically center the heading group in the safe area', () => {
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}]) {
    for (const layout of [titleSubtitle, titleOnly, undefined]) {
      const slide = {title: 'A cover title', ...(layout === titleOnly ? {} : {subtitle: 'Supporting line'})};
      const result = composeSlide(slide, {...dimensions, layout});
      const padding = 0.08 * Math.min(dimensions.width, dimensions.height);
      const {top, bottom, height} = headingGroup(result);
      const mid = (top + bottom) / 2;
      assert.ok(Math.abs(mid - dimensions.height / 2) < 1, `cover group is vertically centered at ${dimensions.width}x${dimensions.height}`);
      assert.ok(top >= padding - 1e-6);
      assert.ok(bottom <= dimensions.height - padding + 1e-6);
      assert.ok(height > 0);
    }
  }
});

test('wrapped cover headings recenter as a group and keep outline origins with the boxes', () => {
  const measurement = {
    measure: (text, size) => text.length * size * 0.5,
    outlineBounds: (text, size) => text.trim() ? {x: -2, y: -size * 0.8, width: text.length * size * 0.5 + 4, height: size} : null,
  };
  const short = composeSlide({title: 'Short', subtitle: 'Also short'}, {layout: titleSubtitle, textMeasurement: measurement});
  const wrapped = composeSlide({
    title: 'A wrapping cover title that occupies more than one line on the slide',
    subtitle: 'Also short',
  }, {layout: titleSubtitle, textMeasurement: measurement});
  assert.ok(byField(wrapped, 'title').text.lines.length > byField(short, 'title').text.lines.length);
  const shortGroup = headingGroup(short), wrappedGroup = headingGroup(wrapped);
  assert.ok(wrappedGroup.height > shortGroup.height);
  assert.ok(Math.abs((shortGroup.top + shortGroup.bottom) / 2 - 360) < 1);
  assert.ok(Math.abs((wrappedGroup.top + wrappedGroup.bottom) / 2 - 360) < 1);
  const title = byField(wrapped, 'title');
  for (const line of title.text.placement.lines) {
    assert.ok(line.y >= title.box.y - 1e-6);
    assert.ok(line.y + line.height <= title.box.y + title.box.height + 1e-6);
  }
});

test('missing subtitle and tag leave no reserved gap on covers or content slides', () => {
  const cover = composeSlide({title: 'Only a title'}, {layout: titleSubtitle});
  assert.equal(cover.items.length, 1);
  assert.equal(byField(cover, 'subtitle'), undefined);
  const withSub = composeSlide({title: 'Heading', subtitle: 'Present', text: 'Body'});
  const withoutSub = composeSlide({title: 'Heading', text: 'Body'});
  const bodyWith = byField(withSub, 'text'), bodyWithout = byField(withoutSub, 'text');
  assert.ok(bodyWith.box.y > bodyWithout.box.y, 'an authored subtitle occupies space; omitting it does not');
  const tagged = composeSlide({tag: 'Q1', title: 'Heading', text: 'Body'});
  assert.ok(byField(tagged, 'text').box.y > bodyWithout.box.y);
});

test('content slides keep body origin stable across typical one- and two-line titles', () => {
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}]) {
    const one = composeSlide({title: 'Short title', text: 'Body stays here.'}, {...dimensions, layout: text1x});
    const two = composeSlide({
      title: 'First heading line\nSecond heading line',
      text: 'Body stays here.',
    }, {...dimensions, layout: text1x});
    const titleOne = byField(one, 'title'), titleTwo = byField(two, 'title');
    assert.equal(titleOne.text.lines.length, 1);
    assert.equal(titleTwo.text.lines.length, 2);
    assert.ok(Math.abs(byField(one, 'text').box.y - byField(two, 'text').box.y) < 1e-6);
    assert.ok(titleOne.box.y < byField(one, 'text').box.y);
    assert.equal(titleOne.box.x, titleTwo.box.x);
    assert.equal(titleOne.box.width, titleTwo.box.width);
  }
  const wideOne = composeSlide({title: 'Short title', text: 'Body stays here.'}, {layout: text1x});
  const wideWrap = composeSlide({
    title: 'A longer content title that wraps onto a second line for this canvas',
    text: 'Body stays here.',
  }, {layout: text1x});
  assert.equal(byField(wideWrap, 'title').text.lines.length, 2);
  assert.ok(Math.abs(byField(wideOne, 'text').box.y - byField(wideWrap, 'text').box.y) < 1e-6);
});

test('explicit composition, regions and overflow stay authoritative', () => {
  const weighted = composeSlide({title: 'Keep weights', composition: {mode: 'row', weights: [2, 1]}, blocks: [{text: 'Wide'}, {text: 'Narrow'}]});
  assert.ok(Math.abs(weighted.items[1].box.width / weighted.items[2].box.width - 2) < 1e-5);
  const regions = composeSlide({title: 'Promoted', left: {text: 'A'}, right: {text: 'B'}});
  assert.ok(byField(regions, 'text').box.x < regions.items.find(item => item.value === 'B').box.x);
  const huge = 'Never lose my text. '.repeat(400);
  const overflow = composeSlide({title: 'Keep', text: huge});
  assert.equal(overflow.diagnostics[0].code, 'text-overflow');
  assert.ok(overflow.items.find(item => item.field === 'text').text.lines.join(' ').includes('Never lose my text.'));
  for (const item of overflow.items) for (const other of overflow.items.filter(candidate => candidate !== item)) {
    assert.equal(overlaps(item.box, other.box), false);
  }
});

test('headers and footers still bound the heading safe area', () => {
  const presentation = {design: {header: {left: {text: 'Header'}}, footer: {right: {slideNumber: true}}}};
  const result = composeSlide({title: 'Cover with furniture', subtitle: 'Still centered in remaining space'}, {
    layout: titleSubtitle, presentation, slideNumber: 3,
  });
  const {top, bottom} = headingGroup(result);
  const safeTop = result.furniture.headerBottom;
  const safeBottom = result.furniture.footerTop;
  assert.ok(top >= safeTop - 1e-6);
  assert.ok(bottom <= safeBottom + 1e-6);
  assert.ok(top > 57.6 + 8, 'furniture covers are not stuck at the top padding');
});

test('content layouts stay top-aligned even without a body payload', () => {
  const result = composeSlide({title: 'Only a title'}, {layout: text1x});
  const title = byField(result, 'title');
  const padding = 0.08 * 720;
  assert.ok(Math.abs(title.box.y - padding) < 1e-6);
  assert.ok(title.box.y + title.box.height < 360);
});
