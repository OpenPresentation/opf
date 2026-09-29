import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';

// Cover centering: a slide with no body payload on a heading-only layout centers its
// tag/title/subtitle group in the free heading area. Content slides are unchanged.
// Re-cut of the cover half of OpenPresentation/opf#94 onto the image-safe area (FF-26),
// explicit heading alignment (FF-29) and picture-slot removal.
const photo = 'data:image/png;base64,iVBORw0KGgo=';
const titleSubtitle = {id: 'title-subtitle', placeholders: [{type: 'title'}, {type: 'subtitle'}]};
const titleOnly = {id: 'title', placeholders: [{type: 'title'}]};
const text1x = {id: 'text-1x', placeholders: [{type: 'title'}, {type: 'text'}]};
const byField = (result, field) => result.items.find(item => item.field === field);
const headingGroup = result => {
  const headings = result.items.filter(item => ['tag', 'title', 'subtitle'].includes(item.field));
  const top = Math.min(...headings.map(item => item.box.y));
  const bottom = Math.max(...headings.map(item => item.box.y + item.box.height));
  return {headings, top, bottom, height: bottom - top};
};
const measurement = {
  measure: (text, size) => text.length * size * 0.5,
  outlineBounds: (text, size) => text.trim() ? {x: -2, y: -size * 0.8, width: text.length * size * 0.5 + 4, height: size} : null,
};

test('title and subtitle share the padded safe width', () => {
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}, {width: 1024, height: 768}]) {
    const result = composeSlide({title: 'Short title', subtitle: 'A short subtitle'}, {...dimensions, layout: titleSubtitle});
    const title = byField(result, 'title'), subtitle = byField(result, 'subtitle');
    const padding = 0.08 * Math.min(dimensions.width, dimensions.height);
    assert.equal(title.box.x, subtitle.box.x);
    assert.equal(title.box.width, subtitle.box.width);
    assert.ok(Math.abs(title.box.x - padding) < 1e-6);
    assert.ok(Math.abs(title.box.width - (dimensions.width - 2 * padding)) < 1e-6);
  }
});

test('cover layouts vertically center the heading group', () => {
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}]) {
    for (const layout of [titleSubtitle, titleOnly, undefined]) {
      const slide = {title: 'A cover title', ...(layout === titleOnly ? {} : {subtitle: 'Supporting line'})};
      const result = composeSlide(slide, {...dimensions, layout});
      const padding = 0.08 * Math.min(dimensions.width, dimensions.height);
      const {top, bottom, height} = headingGroup(result);
      assert.ok(Math.abs((top + bottom) / 2 - (padding + dimensions.height - padding) / 2) < 1e-6, `centered at ${dimensions.width}x${dimensions.height}`);
      assert.ok(top >= padding - 1e-6);
      assert.ok(bottom <= dimensions.height - padding + 1e-6);
      assert.ok(height > 0);
    }
  }
});

test('a layout whose placeholders are all headings is a cover, a layout with content placeholders is not', () => {
  const headingsOnly = {id: 'custom-cover', placeholders: [{type: 'tag'}, {type: 'title'}, {type: 'subtitle'}]};
  const cover = composeSlide({tag: 'Q1', title: 'Custom cover', subtitle: 'Line'}, {layout: headingsOnly});
  const {top, bottom} = headingGroup(cover);
  assert.ok(Math.abs((top + bottom) / 2 - 360) < 1e-6);
  const content = composeSlide({title: 'Only a title'}, {layout: text1x});
  assert.ok(Math.abs(byField(content, 'title').box.y - 0.08 * 720) < 1e-6, 'content layouts stay top-aligned without a body');
});

test('wrapped cover headings recenter as a group and keep line and outline origins with the boxes', () => {
  const short = composeSlide({title: 'Short', subtitle: 'Also short'}, {layout: titleSubtitle, textMeasurement: measurement});
  const wrapped = composeSlide({
    title: 'A wrapping cover title that occupies more than one line on the slide',
    subtitle: 'Also short',
  }, {layout: titleSubtitle, textMeasurement: measurement});
  assert.ok(byField(wrapped, 'title').text.lines.length > byField(short, 'title').text.lines.length);
  const shortGroup = headingGroup(short), wrappedGroup = headingGroup(wrapped);
  assert.ok(wrappedGroup.height > shortGroup.height);
  assert.ok(Math.abs((shortGroup.top + shortGroup.bottom) / 2 - 360) < 1e-6);
  assert.ok(Math.abs((wrappedGroup.top + wrappedGroup.bottom) / 2 - 360) < 1e-6);
  // Accepted placement is measured against the pre-shift origin; the shift must move it with the box.
  for (const result of [short, wrapped]) for (const item of result.items) {
    const {box, text} = item;
    assert.equal(text.placement.overflow, false);
    for (const line of text.placement.lines) {
      assert.ok(line.y >= box.y - 1e-6);
      assert.ok(line.y + line.height <= box.y + box.height + 1e-6);
      assert.ok(line.outline.y >= box.y - 1e-6);
      assert.ok(line.outline.y + line.outline.height <= box.y + box.height + 1e-6);
      // The baseline stays inside the line box exactly as when the group was not moved.
      assert.ok(line.baseline >= line.y && line.baseline <= line.y + line.height);
    }
  }
  // Placement lines are the same lines a top-anchored composition produces, translated by the shift.
  const unshifted = composeSlide({title: 'Short', subtitle: 'Also short', text: 'Body'}, {layout: {id: 'text-1x', placeholders: [{type: 'title'}, {type: 'subtitle'}, {type: 'text'}]}, textMeasurement: measurement});
  const dy = byField(short, 'title').box.y - byField(unshifted, 'title').box.y;
  assert.ok(dy > 0);
  const moved = byField(short, 'title').text.placement.lines, base = byField(unshifted, 'title').text.placement.lines;
  assert.equal(moved.length, base.length);
  moved.forEach((line, index) => {
    assert.ok(Math.abs(line.y - base[index].y - dy) < 1e-6);
    assert.ok(Math.abs(line.baseline - base[index].baseline - dy) < 1e-6);
    assert.ok(Math.abs(line.outline.y - base[index].outline.y - dy) < 1e-6);
    assert.equal(line.x, base[index].x);
  });
});

test('missing subtitle and tag leave no reserved gap', () => {
  const cover = composeSlide({title: 'Only a title'}, {layout: titleSubtitle});
  assert.equal(cover.items.length, 1);
  const {top, bottom} = headingGroup(cover);
  assert.ok(Math.abs((top + bottom) / 2 - 360) < 1e-6);
  const withSub = composeSlide({title: 'Heading', subtitle: 'Present', text: 'Body'});
  const withoutSub = composeSlide({title: 'Heading', text: 'Body'});
  assert.ok(byField(withSub, 'text').box.y > byField(withoutSub, 'text').box.y);
});

test('explicit heading alignment survives centering', () => {
  const slide = {title: 'Aligned cover', subtitle: 'Aligned subtitle'};
  const result = composeSlide(slide, {layout: titleSubtitle, titleAlignment: 'center', contentAlignment: 'right', textMeasurement: measurement});
  assert.equal(byField(result, 'title').alignment, 'center');
  assert.equal(byField(result, 'subtitle').alignment, 'right');
  assert.equal(byField(result, 'title').text.placement.alignment, 'center');
  assert.equal(byField(result, 'subtitle').text.placement.alignment, 'right');
  const plain = composeSlide(slide, {layout: titleSubtitle, textMeasurement: measurement});
  assert.equal(byField(plain, 'title').alignment, 'left');
  // Alignment moves ink inside the box, never the vertical position.
  assert.equal(byField(result, 'title').box.y, byField(plain, 'title').box.y);
  assert.equal(byField(result, 'title').box.x, byField(plain, 'title').box.x);
});

test('headers and footers bound the centered group', () => {
  const presentation = {design: {header: {left: {text: 'Header'}}, footer: {right: {slideNumber: true}}}};
  const result = composeSlide({title: 'Cover with furniture', subtitle: 'Centered in remaining space'}, {
    layout: titleSubtitle, presentation, slideNumber: 3,
  });
  const {top, bottom} = headingGroup(result);
  const padding = 0.08 * 720, gap = 720 / 30;
  const safeTop = Math.max(padding, result.furniture.headerBottom + gap * 0.5);
  const safeBottom = Math.min(720 - padding, result.furniture.footerTop - gap * 0.5);
  assert.ok(top >= safeTop - 1e-6 && bottom <= safeBottom + 1e-6);
  assert.ok(Math.abs((top + bottom) / 2 - (safeTop + safeBottom) / 2) < 1e-6);
});

test('slide image bands: the cover centers inside the image-safe area', () => {
  const regions = {
    left: {x: 0, y: 0, width: 640, height: 720}, right: {x: 640, y: 0, width: 640, height: 720},
    top: {x: 0, y: 0, width: 1280, height: 360}, bottom: {x: 0, y: 360, width: 1280, height: 360},
  };
  const padding = 0.08 * 720;
  for (const [position, region] of Object.entries(regions)) {
    const presentation = {design: {slideImage: {src: photo, position}}};
    const result = composeSlide({title: 'Cover beside a photo', subtitle: 'Centered in what is left'}, {presentation, layout: {...titleSubtitle, slideImage: true}});
    assert.equal(result.slideImage.position, position);
    const area = {
      left: position === 'left' ? region.width : 0, right: position === 'right' ? region.x : 1280,
      top: position === 'top' ? region.height : 0, bottom: position === 'bottom' ? region.y : 720,
    };
    const {headings, top, bottom} = headingGroup(result);
    assert.ok(Math.abs((top + bottom) / 2 - ((area.top + padding) + (area.bottom - padding)) / 2) < 1e-6, `${position} band center`);
    for (const {box} of headings) {
      assert.ok(Math.abs(box.x - (area.left + padding)) < 1e-6, `${position} band x starts at the free area`);
      assert.ok(Math.abs(box.x + box.width - (area.right - padding)) < 1e-6);
      assert.ok(box.y >= area.top + padding - 1e-6 && box.y + box.height <= area.bottom - padding + 1e-6);
    }
  }
  // Background images do not reserve an area; the cover centers on the whole slide.
  const background = composeSlide({title: 'Cover on a photo', subtitle: 'Full bleed'}, {presentation: {design: {slideImage: {src: photo, position: 'background'}}}, layout: {...titleSubtitle, slideImage: true}});
  const {top, bottom} = headingGroup(background);
  assert.ok(Math.abs((top + bottom) / 2 - 360) < 1e-6);
});

test('a root image drawn as the slide image counts as body and keeps the content origin', () => {
  const presentation = {design: {slideImage: {src: photo, position: 'left'}}};
  const layout = {...titleSubtitle, placeholders: [{type: 'title'}, {type: 'subtitle'}, {type: 'picture'}]};
  const result = composeSlide({title: 'Image slide', subtitle: 'Not a cover', image: {src: photo, alt: 'Harbor'}}, {presentation, layout});
  assert.equal(result.slideImage.replacesContent, true);
  const padding = 0.08 * 720;
  assert.ok(Math.abs(byField(result, 'title').box.y - padding) < 1e-6);
  // The same slide without the image is a cover.
  const cover = composeSlide({title: 'Image slide', subtitle: 'Not a cover'}, {presentation, layout: {...titleSubtitle, slideImage: true}});
  assert.ok(byField(cover, 'title').box.y > padding + 1);
  // Picture-slot removal is untouched: no picture placeholder box remains for the replaced image.
  assert.equal(result.items.filter(item => item.field === 'image').length, 0);
});

test('content and region slides keep the pre-centering geometry', () => {
  const padding = 0.08 * 720;
  const content = composeSlide({title: 'Content', text: 'Body'}, {layout: text1x});
  assert.ok(Math.abs(byField(content, 'title').box.y - padding) < 1e-6);
  assert.ok(byField(content, 'text').box.y >= byField(content, 'title').box.y + byField(content, 'title').box.height, 'body follows the title');
  const blocks = composeSlide({title: 'Blocks', blocks: [{text: 'A'}, {text: 'B'}]});
  assert.ok(Math.abs(byField(blocks, 'title').box.y - padding) < 1e-6);
  const regions = composeSlide({title: 'Promoted', left: {text: 'A'}, right: {text: 'B'}});
  assert.ok(Math.abs(byField(regions, 'title').box.y - padding) < 1e-6);
  const weighted = composeSlide({title: 'Keep weights', composition: {mode: 'row', weights: [2, 1]}, blocks: [{text: 'Wide'}, {text: 'Narrow'}]});
  assert.ok(Math.abs(weighted.items[1].box.width / weighted.items[2].box.width - 2) < 1e-5);
  // A body payload on a heading-only layout is not a cover.
  const bodyOnCover = composeSlide({title: 'Has body', text: 'Body'}, {layout: titleSubtitle});
  assert.ok(Math.abs(byField(bodyOnCover, 'title').box.y - padding) < 1e-6);
});

test('empty body payloads are not body: such title slides center too', () => {
  const centered = result => {
    const {top, bottom} = headingGroup(result);
    return Math.abs((top + bottom) / 2 - 360) < 1e-6;
  };
  const reference = headingGroup(composeSlide({title: 'Empty payloads', subtitle: 'Still a cover'}, {layout: titleSubtitle}));
  const empties = {
    'empty blocks': {blocks: []},
    'empty text': {text: ''},
    'whitespace text': {text: ' \n\t '},
    'empty rich text': {text: []},
    'empty items': {items: []},
    'empty regions': {left: {}, bottom: {blocks: []}},
  };
  for (const [name, payload] of Object.entries(empties)) {
    for (const layout of [titleSubtitle, undefined]) {
      const result = composeSlide({title: 'Empty payloads', subtitle: 'Still a cover', ...payload}, {layout});
      assert.ok(centered(result), `${name} centers${layout ? '' : ' without a layout'}`);
      assert.ok(Math.abs(headingGroup(result).top - reference.top) < 1e-6, `${name} matches the payload-free cover`);
      assert.deepEqual(result.diagnostics, [], `${name} adds no diagnostics`);
    }
  }
  // A blank region text or empty list still centers; its empty cell keeps its item in the smaller remaining area and may report small-cell.
  const blankRegion = composeSlide({title: 'Empty payloads', subtitle: 'Still a cover', 'top:right': {text: ' '}}, {layout: titleSubtitle});
  assert.ok(centered(blankRegion));
  // Any real payload, however small, still makes it a content slide.
  for (const payload of [{blocks: [{text: 'x'}]}, {text: 'x'}, {items: ['x']}, {image: photo}, {left: {text: 'x'}}, {blocks: [{}]}]) {
    const result = composeSlide({title: 'Real payload', subtitle: 'Not a cover', ...payload}, {layout: titleSubtitle});
    assert.ok(Math.abs(byField(result, 'title').box.y - 0.08 * 720) < 1e-6, `${JSON.stringify(payload).slice(0, 30)} keeps the top origin`);
  }
});
