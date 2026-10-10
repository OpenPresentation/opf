import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, resolveLogo} from '../dist/composition.js';
import { resolveLogo as rootResolveLogo } from '../dist/composition.js';
import {OPFPaginationError, paginate, paginateSlide} from '../dist/pagination.js';

// Logos: the cover logo box and picture bullets (spec-gap closure A1 and A5, organization logos since RR-71).
// Resolution (shapes, backgrounds, overrides, references) is covered by organization-logos.test.mjs.
// Decisions are recorded in docs/design-resolution.md.
const asset = name => `data:image/png;base64,${name}`;
// RR-71: logos live on the organization. A deck with one logo for every shape and background:
const withLogo = (logo, extra = {}) => ({organization: {id: 'acme', name: 'Acme', logo}, ...extra});
const titleOnly = {id: 'title', placeholders: [{type: 'title'}]};
const titleSubtitle = {id: 'title-subtitle', placeholders: [{type: 'title'}, {type: 'subtitle'}]};
const sectionDivider = {id: 'section-divider', placeholders: [{type: 'tag'}, {type: 'title'}, {type: 'subtitle'}]};
const text1x = {id: 'text-1x', placeholders: [{type: 'title'}, {type: 'text'}]};
const byField = (result, field) => result.items.find(item => item.field === field);

test('resolveLogo is exported from the composition entry', () => {
  assert.equal(rootResolveLogo, resolveLogo);
});

test('cover and section slides draw the full logo above the centered heading group', () => {
  const presentation = withLogo({full: {onLight: asset('default'), onDark: asset('light')}});
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}, {width: 1024, height: 768}]) {
    const scale = Math.min(dimensions.width, dimensions.height) / 720, padding = 0.08 * Math.min(dimensions.width, dimensions.height), gap = Math.min(dimensions.width, dimensions.height) / 30;
    for (const layout of [titleOnly, titleSubtitle, sectionDivider, undefined]) {
      const slide = {title: 'Cover title', ...(layout === titleOnly ? {} : {subtitle: 'Supporting line'}), ...(layout === sectionDivider ? {tag: 'Part one'} : {})};
      const without = composeSlide(slide, {...dimensions, layout});
      const result = composeSlide(slide, {...dimensions, layout, presentation});
      assert.ok(result.logo, `logo on ${layout?.id ?? 'no layout'}`);
      assert.deepEqual(result.logo, {box: result.logo.box, shape: 'full', path: 'organization.logo.full.onLight', source: asset('default'), variant: 'onLight', reference: 'var:organization.logo', anchor: 'left'});
      const expectedHeight = 56 * scale;
      assert.ok(Math.abs(result.logo.box.x - padding) < 1e-6);
      assert.ok(Math.abs(result.logo.box.y - padding) < 1e-6, 'the logo sits at the image-safe top');
      assert.ok(Math.abs(result.logo.box.height - expectedHeight) < 1e-6);
      assert.ok(Math.abs(result.logo.box.width - Math.min(4 * expectedHeight, dimensions.width - 2 * padding)) < 1e-6);
      const headings = result.items.filter(item => ['tag', 'title', 'subtitle'].includes(item.field));
      const top = Math.min(...headings.map(item => item.box.y)), bottom = Math.max(...headings.map(item => item.box.y + item.box.height));
      const span = {top: result.logo.box.y + result.logo.box.height + gap, bottom: dimensions.height - padding};
      assert.ok(top >= span.top - 1e-6, 'headings start below the logo and its gap');
      assert.ok(Math.abs((top + bottom) / 2 - (span.top + span.bottom) / 2) < 1e-6, 'headings center in the remaining span');
      assert.ok(top > Math.min(...without.items.map(item => item.box.y)), 'the group moves down compared with the same cover without a logo');
      for (const item of headings) assert.equal(item.box.width, byField(without, item.field).box.width);
      // Dark backgrounds take the onDark asset; the box is unchanged.
      const dark = composeSlide(slide, {...dimensions, layout, presentation, darkBackground: true});
      assert.equal(dark.logo.variant, 'onDark');
      assert.equal(dark.logo.source, asset('light'));
      assert.deepEqual(dark.logo.box, result.logo.box);
    }
  }
});

test('the cover logo respects header furniture and placed image bands, and wrapped headings recenter below it', () => {
  const presentation = withLogo(asset('deck'), {design: {header: {left: {text: 'Header'}}}});
  const result = composeSlide({title: 'Cover'}, {layout: titleOnly, presentation});
  assert.ok(result.logo.box.y >= result.furniture.headerBottom, 'below the header band');
  assert.ok(byField(result, 'title').box.y >= result.logo.box.y + result.logo.box.height);
  const banded = composeSlide({title: 'Cover', blocks: [{image: asset('photo'), placement: {edge: 'left'}}]}, {layout: titleOnly, presentation: withLogo(asset('deck'))});
  assert.ok(Math.abs(banded.logo.box.x - (banded.items.find(item => item.field === 'image').image.region.width + 0.08 * 720)) < 1e-6, 'inside the free area beside the band');
  assert.ok(banded.logo.box.width <= banded.contentBox.width + 1e-6);
  const tall = composeSlide({title: 'A very long cover title that wraps onto several lines of text to fill the whole safe area of the slide', subtitle: 'And a subtitle that is also long enough to wrap across the available width more than once on this canvas'}, {width: 400, height: 300, layout: titleSubtitle, presentation: withLogo(asset('deck'))});
  assert.ok(tall.logo);
  const title = byField(tall, 'title'), subtitle = byField(tall, 'subtitle');
  assert.ok(title.text.lines.length > 1, 'the title wraps');
  const spanTop = tall.logo.box.y + tall.logo.box.height + 300 / 30, spanBottom = 300 - 24;
  assert.ok(title.box.y >= spanTop - 1e-6);
  assert.ok(Math.abs((title.box.y + subtitle.box.y + subtitle.box.height) / 2 - (spanTop + spanBottom) / 2) < 1e-6, 'the wrapped group centers in the remaining span');
});

test('content slides never get an automatic logo', () => {
  const presentation = withLogo(asset('acme'));
  const cases = [
    [{title: 'Body', text: 'Content'}, titleOnly],
    [{title: 'Body', text: 'Content'}, undefined],
    [{title: 'Only a title'}, text1x],
    [{title: 'Blocks', blocks: [{text: 'a'}, {text: 'b'}]}, undefined],
    [{title: 'Regions', left: {text: 'a'}, right: {text: 'b'}}, undefined],
    [{title: 'Image', image: asset('photo')}, {id: 'image-1x', placeholders: [{type: 'title'}, {type: 'image'}]}],
  ];
  for (const [slide, layout] of cases) {
    const result = composeSlide(slide, {layout, presentation});
    assert.equal(result.logo, undefined);
    assert.deepEqual(result.items.map(item => item.box), composeSlide(slide, {layout}).items.map(item => item.box), 'geometry is unchanged');
  }
  // No logo source, no logo: the cover geometry is the pre-existing one.
  const plain = composeSlide({title: 'Cover'}, {layout: titleOnly, presentation: {design: {}}});
  assert.equal(plain.logo, undefined);
  assert.deepEqual(plain.items.map(item => item.box), composeSlide({title: 'Cover'}, {layout: titleOnly}).items.map(item => item.box));
});

test('listBullet image attaches the icon logo as a picture bullet without moving the markers', () => {
  const slide = {title: 'List', items: ['One', {text: 'Two', level: 1, description: 'More'}, 'Three']};
  const presentation = withLogo({full: asset('default'), icon: {onLight: asset('icon'), onDark: asset('iconLight')}}, {design: {listBullet: 'image'}});
  const partner = {organization: [{id: 'acme', name: 'Acme', logo: asset('acme')}, {id: 'beta', name: 'Beta', logo: {icon: asset('beta-icon')}}], design: {listBullet: 'image'}};
  const plain = composeSlide(slide, {});
  for (const [options, expectedPath, expectedSource] of [
    [{presentation}, 'organization.logo.icon.onLight', asset('icon')],
    [{presentation, darkBackground: true}, 'organization.logo.icon.onDark', asset('iconLight')],
    [{presentation: withLogo(asset('acme'), {design: {listBullet: 'image'}})}, 'organization.logo', asset('acme')],
    [{presentation: partner, slideIndex: 5}, 'organization.1.logo.icon', asset('beta-icon')],
  ]) {
    const source = options.slideIndex === 5 ? {...slide, design: {listBullet: 'image', logo: 'var:organization.beta.logo'}} : slide;
    const result = composeSlide(source, options);
    const item = byField(result, 'items');
    assert.deepEqual(item.bulletImage, {source: expectedSource, path: expectedPath});
    assert.equal(item.text.listEntries.length, 3);
    for (const entry of item.text.listEntries) assert.deepEqual(entry.bulletImage, item.bulletImage);
    assert.deepEqual(item.box, byField(plain, 'items').box);
    const geometry = entry => ({text: entry.marker.text, x: entry.marker.x, y: entry.marker.y, fontSize: entry.marker.fontSize, indent: entry.marker.indent});
    assert.deepEqual(item.text.listEntries.map(geometry), byField(plain, 'items').text.listEntries.map(geometry), 'marker geometry is unchanged');
    assert.deepEqual(result.diagnostics, []);
  }
  // bullets payloads and nested blocks get it too; character and absent values do not.
  const bullets = composeSlide({title: 'List', blocks: [{text: 'a'}, {bullets: ['x', 'y']}]}, {presentation});
  assert.equal(byField(bullets, 'bullets').bulletImage.path, 'organization.logo.icon.onLight');
  assert.equal(byField(bullets, 'text').bulletImage, undefined);
  assert.equal(byField(composeSlide(slide, {presentation: withLogo(asset('deck'), {design: {listBullet: 'character'}})}), 'items').bulletImage, undefined);
  assert.equal(byField(composeSlide(slide, {presentation: withLogo(asset('deck'))}), 'items').bulletImage, undefined);
  assert.equal(byField(composeSlide({...slide, design: {listBullet: 'character'}}, {presentation}), 'items').bulletImage, undefined, 'the slide design overrides the deck');
  assert.equal(byField(plain, 'items').text.listEntries[0].bulletImage, undefined);
});

test('listBullet image without a logo keeps the glyph and reports unresolved content once per slide', () => {
  const slide = {title: 'List', blocks: [{items: ['One']}, {bullets: ['Two']}]};
  const deck = composeSlide(slide, {presentation: {design: {listBullet: 'image'}}, slideIndex: 2});
  assert.deepEqual(deck.diagnostics, [{code: 'unresolved-content', path: 'design.listBullet', message: 'Picture bullets (listBullet: image) need an organization logo (the primary organization, or the one design.logo names); the marker glyph is drawn instead.'}]);
  assert.equal(byField(deck, 'items').bulletImage, undefined);
  assert.equal(byField(deck, 'items').text.listEntries[0].marker.text, '•');
  const local = composeSlide({...slide, design: {listBullet: 'image'}}, {slideIndex: 2});
  assert.equal(local.diagnostics[0].path, 'slides.2.design.listBullet');
  // A slide without a list is silent; so is a resolvable logo.
  assert.deepEqual(composeSlide({title: 'Text', text: 'Body'}, {presentation: {design: {listBullet: 'image'}}}).diagnostics, []);
  assert.deepEqual(composeSlide(slide, {presentation: withLogo(asset('deck'), {design: {listBullet: 'image'}})}).diagnostics, []);
});

test('pagination ignores the picture-bullet notice: it neither splits nor rejects a slide for it', () => {
  const short = {title: 'List', items: ['One', 'Two']};
  const noLogo = {design: {listBullet: 'image'}, slides: [short]};
  // A fitting slide stays one page although composeSlide reports unresolved-content.
  const single = paginateSlide(short, {presentation: noLogo, slideIndex: 0});
  assert.equal(single.slides.length, 1);
  assert.deepEqual(single.slides[0].items, short.items);
  // An overflowing list still splits, and every page keeps the source design (the notice repeats per page, as a host would see it).
  const long = {title: 'List', items: Array.from({length: 40}, (_, i) => `Item ${i + 1} with enough words to take some horizontal room on the slide`)};
  const split = paginateSlide(long, {presentation: {design: {listBullet: 'image'}, slides: [long]}, slideIndex: 0, minFontSize: 28});
  assert.ok(split.slides.length > 1);
  assert.equal(split.slides.flatMap(page => page.items).length, 40);
  for (const page of split.slides) assert.deepEqual(composeSlide(page, {presentation: noLogo}).diagnostics.map(d => d.code), ['unresolved-content']);
  // With a logo the pages carry picture bullets and no diagnostic.
  const logoDeck = withLogo(asset('deck'), {design: {listBullet: 'image'}, slides: [long]});
  const pages = paginate(logoDeck);
  assert.ok(pages.presentation.slides.length > 1);
  for (const [index, page] of pages.presentation.slides.entries()) {
    const result = composeSlide(page, {presentation: logoDeck, slideIndex: index});
    assert.deepEqual(result.diagnostics, []);
    assert.equal(byField(result, 'items').bulletImage.path, 'organization.logo');
  }
  // Unresolved furniture (a zone logo reference without a logo) still rejects pagination like any other unresolved repeated content.
  assert.throws(() => paginateSlide(short, {presentation: {design: {footer: {left: {image: 'var:organization.logo.icon'}}}, slides: [short]}, slideIndex: 0}), OPFPaginationError);
});
