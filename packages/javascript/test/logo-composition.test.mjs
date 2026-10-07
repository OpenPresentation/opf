import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutFurniture, resolveLogo} from '../dist/composition.js';
import { resolveLogo as rootResolveLogo } from '../dist/composition.js';
import {OPFPaginationError, paginate, paginateSlide} from '../dist/pagination.js';

// Logos: resolveLogo precedence and variant chains, the cover logo box, furniture logo parts and
// picture bullets (spec-gap closure A1 and A5). Decisions are recorded in docs/design-resolution.md.
const asset = name => `data:image/png;base64,${name}`;
const fullSet = {
  default: asset('default'), light: asset('light'), dark: asset('dark'),
  stacked: asset('stacked'), stackedLight: asset('stackedLight'), stackedDark: asset('stackedDark'),
  icon: asset('icon'), iconLight: asset('iconLight'), iconDark: asset('iconDark'),
  wordmark: asset('wordmark'), wordmarkLight: asset('wordmarkLight'), wordmarkDark: asset('wordmarkDark'),
};
const only = keys => Object.fromEntries(keys.map(key => [key, fullSet[key]]));
const titleOnly = {id: 'title', placeholders: [{type: 'title'}]};
const titleSubtitle = {id: 'title-subtitle', placeholders: [{type: 'title'}, {type: 'subtitle'}]};
const sectionDivider = {id: 'section-divider', placeholders: [{type: 'tag'}, {type: 'title'}, {type: 'subtitle'}]};
const text1x = {id: 'text-1x', placeholders: [{type: 'title'}, {type: 'text'}]};
const byField = (result, field) => result.items.find(item => item.field === field);

test('resolveLogo is exported from the root entry and the composition entry', () => {
  assert.equal(rootResolveLogo, resolveLogo);
});

test('resolveLogo source precedence: slide design, deck design, then the primary organization', () => {
  const presentation = {
    design: {logo: asset('deck')},
    organization: [{id: 'partner', name: 'Partner', logo: asset('partner')}, {id: 'acme', name: 'Acme', role: 'primary', logo: asset('acme')}],
  };
  assert.deepEqual(resolveLogo(presentation, {design: {logo: asset('slide')}}, {slideIndex: 3}), {source: asset('slide'), path: 'slides.3.design.logo', variant: 'default', slot: 'lockup'});
  assert.deepEqual(resolveLogo(presentation, {}), {source: asset('deck'), path: 'design.logo', variant: 'default', slot: 'lockup'});
  assert.deepEqual(resolveLogo({organization: presentation.organization}, {}), {source: asset('acme'), path: 'organization.1.logo', variant: 'default', slot: 'lockup'});
  // Without a primary role the first organization is the source; an object organization has no index.
  assert.equal(resolveLogo({organization: [{name: 'First', logo: asset('first')}, {name: 'Second', logo: asset('second')}]}, {}).path, 'organization.0.logo');
  assert.deepEqual(resolveLogo({organization: {name: 'Solo', logo: {src: asset('solo'), alt: 'Solo'}}}, {}), {source: {src: asset('solo'), alt: 'Solo'}, path: 'organization.logo', variant: 'default', slot: 'lockup'});
  // Absence inherits; a level that yields no usable asset falls through to the next.
  assert.equal(resolveLogo({}, {}), null);
  assert.equal(resolveLogo({design: {logo: ''}}, {}), null);
  assert.equal(resolveLogo({design: {logo: {}}, organization: {logo: asset('org')}}, {}).path, 'organization.logo');
  assert.equal(resolveLogo({design: {logo: {light: ''}}, organization: {logo: asset('org')}}, {}).path, 'organization.logo');
  assert.equal(resolveLogo(undefined, undefined), null);
  assert.throws(() => resolveLogo({}, {}, {slot: 'banner'}), RangeError);
});

test('resolveLogo LogoSet variant chains by slot and tone', () => {
  const chain = (set, options) => {
    const order = [];
    let remaining = {...set};
    for (;;) {
      const resolved = resolveLogo({design: {logo: remaining}}, {}, options);
      if (!resolved) break;
      order.push(resolved.variant);
      assert.equal(resolved.path, `design.logo.${resolved.variant}`);
      assert.equal(resolved.source, set[resolved.variant]);
      assert.equal(resolved.slot, options.slot ?? 'lockup');
      remaining = {...remaining, [resolved.variant]: undefined};
    }
    return order;
  };
  assert.deepEqual(chain(fullSet, {onDark: true}), ['light', 'default', 'stackedLight', 'stacked', 'wordmarkLight', 'wordmark', 'iconLight', 'icon', 'dark', 'stackedDark', 'wordmarkDark', 'iconDark']);
  assert.deepEqual(chain(fullSet, {}), ['dark', 'default', 'stackedDark', 'stacked', 'wordmarkDark', 'wordmark', 'iconDark', 'icon', 'light', 'stackedLight', 'wordmarkLight', 'iconLight']);
  assert.deepEqual(chain(fullSet, {onDark: false, slot: 'lockup'}).slice(0, 2), ['dark', 'default']);
  assert.deepEqual(chain(fullSet, {slot: 'icon', onDark: true}).slice(0, 4), ['iconLight', 'icon', 'light', 'default']);
  assert.deepEqual(chain(fullSet, {slot: 'icon'}).slice(0, 4), ['iconDark', 'icon', 'dark', 'default']);
  assert.deepEqual(chain(fullSet, {slot: 'stacked', onDark: true}).slice(0, 4), ['stackedLight', 'stacked', 'light', 'default']);
  assert.deepEqual(chain(fullSet, {slot: 'stacked'}).slice(0, 4), ['stackedDark', 'stacked', 'dark', 'default']);
  // Partial sets: the icon slot falls back to the lockup chain, and the opposite tone is last.
  assert.equal(resolveLogo({design: {logo: only(['default', 'light'])}}, {}, {slot: 'icon'}).variant, 'default');
  assert.equal(resolveLogo({design: {logo: only(['light'])}}, {}, {}).variant, 'light');
  assert.equal(resolveLogo({design: {logo: only(['dark'])}}, {}, {onDark: true}).variant, 'dark');
  assert.equal(resolveLogo({design: {logo: only(['stacked', 'icon', 'wordmark'])}}, {}, {}).variant, 'stacked');
  // Asset objects are valid variants; empty sources are skipped.
  assert.equal(resolveLogo({design: {logo: {default: {src: asset('o')}, light: ''}}}, {}, {onDark: true}).variant, 'default');
});

test('cover and section slides draw the lockup logo above the centered heading group', () => {
  const presentation = {design: {logo: {default: asset('default'), light: asset('light')}}};
  for (const dimensions of [{width: 1280, height: 720}, {width: 720, height: 1280}, {width: 1024, height: 768}]) {
    const scale = Math.min(dimensions.width, dimensions.height) / 720, padding = 0.08 * Math.min(dimensions.width, dimensions.height), gap = Math.min(dimensions.width, dimensions.height) / 30;
    for (const layout of [titleOnly, titleSubtitle, sectionDivider, undefined]) {
      const slide = {title: 'Cover title', ...(layout === titleOnly ? {} : {subtitle: 'Supporting line'}), ...(layout === sectionDivider ? {tag: 'Part one'} : {})};
      const without = composeSlide(slide, {...dimensions, layout});
      const result = composeSlide(slide, {...dimensions, layout, presentation});
      assert.ok(result.logo, `logo on ${layout?.id ?? 'no layout'}`);
      assert.deepEqual(result.logo, {box: result.logo.box, slot: 'lockup', path: 'design.logo.default', source: asset('default'), variant: 'default', anchor: 'left'});
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
      // Dark backgrounds take the light variant; the box is unchanged.
      const dark = composeSlide(slide, {...dimensions, layout, presentation, darkBackground: true});
      assert.equal(dark.logo.variant, 'light');
      assert.deepEqual(dark.logo.box, result.logo.box);
    }
  }
});

test('the cover logo respects header furniture and slide-image bands, and wrapped headings recenter below it', () => {
  const presentation = {design: {logo: asset('deck'), header: {left: {text: 'Header'}}}};
  const result = composeSlide({title: 'Cover'}, {layout: titleOnly, presentation});
  assert.ok(result.logo.box.y >= result.furniture.headerBottom, 'below the header band');
  assert.ok(byField(result, 'title').box.y >= result.logo.box.y + result.logo.box.height);
  const banded = composeSlide({title: 'Cover', design: {slideImage: {src: asset('photo'), position: 'left'}}}, {layout: titleOnly, presentation: {design: {logo: asset('deck')}}});
  assert.ok(Math.abs(banded.logo.box.x - (banded.slideImage.region.width + 0.08 * 720)) < 1e-6, 'inside the free area beside the band');
  assert.ok(banded.logo.box.width <= banded.contentBox.width + 1e-6);
  const tall = composeSlide({title: 'A very long cover title that wraps onto several lines of text to fill the whole safe area of the slide', subtitle: 'And a subtitle that is also long enough to wrap across the available width more than once on this canvas'}, {width: 400, height: 300, layout: titleSubtitle, presentation: {design: {logo: asset('deck')}}});
  assert.ok(tall.logo);
  const title = byField(tall, 'title'), subtitle = byField(tall, 'subtitle');
  assert.ok(title.text.lines.length > 1, 'the title wraps');
  const spanTop = tall.logo.box.y + tall.logo.box.height + 300 / 30, spanBottom = 300 - 24;
  assert.ok(title.box.y >= spanTop - 1e-6);
  assert.ok(Math.abs((title.box.y + subtitle.box.y + subtitle.box.height) / 2 - (spanTop + spanBottom) / 2) < 1e-6, 'the wrapped group centers in the remaining span');
});

test('content slides never get an automatic logo', () => {
  const presentation = {design: {logo: asset('deck')}, organization: {name: 'Acme', logo: asset('acme')}};
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

test('furniture logo: true generates an icon image part before the zone image, with the icon variant', () => {
  const presentation = {
    design: {logo: {default: asset('default'), icon: asset('icon'), iconLight: asset('iconLight')}, footer: {left: {logo: true, image: asset('badge'), text: 'Acme'}, right: {slideNumber: true}}},
    organization: {name: 'Acme'},
  };
  for (const [width, height] of [[1280, 720], [720, 1280]]) {
    const result = composeSlide({title: 'Slide', text: 'Body'}, {width, height, presentation, slideIndex: 2});
    const parts = result.furniture.parts.filter(part => part.zone === 'left');
    assert.deepEqual(parts.map(part => part.field), ['logo', 'image', 'text']);
    const [logo, image] = parts;
    assert.equal(logo.type, 'image');
    assert.equal(logo.generated, true);
    assert.equal(logo.image, asset('icon'));
    assert.equal(logo.path, 'design.footer.left.logo');
    assert.equal(logo.sourcePath, 'design.logo.icon');
    assert.deepEqual({...logo.box, y: 0}, {...image.box, y: 0}, 'same box as a zone image');
    assert.ok(Math.abs(image.box.y - (logo.box.y + logo.box.height)) < 1e-6, 'the image stacks under the logo');
    assert.ok(parts[2].box.y >= image.box.y + image.box.height - 1e-6);
    assert.deepEqual(result.diagnostics, []);
    const dark = layoutFurniture({title: 'Slide'}, {width, height, presentation, darkBackground: true});
    assert.equal(dark.parts.find(part => part.field === 'logo').image, asset('iconLight'));
    assert.equal(dark.parts.find(part => part.field === 'logo').sourcePath, 'design.logo.iconLight');
  }
  // A slide-level logo and an organization logo are sources too.
  const local = layoutFurniture({design: {logo: asset('slide')}}, {presentation, slideIndex: 4});
  assert.equal(local.parts.find(part => part.field === 'logo').sourcePath, 'slides.4.design.logo');
  const organization = layoutFurniture({}, {presentation: {design: {header: {center: {logo: true}}}, organization: [{name: 'Acme', role: 'primary', logo: asset('acme')}]}});
  assert.equal(organization.parts.find(part => part.field === 'logo').sourcePath, 'organization.0.logo');
  assert.equal(organization.parts[0].kind, 'header');
});

test('furniture logo: true without a logo reports unresolved content at the flag', () => {
  const presentation = {design: {footer: {center: {logo: true, text: 'Acme'}}}, organization: {name: 'Acme'}};
  const result = composeSlide({title: 'Slide', text: 'Body'}, {presentation});
  assert.deepEqual(result.diagnostics, [{code: 'unresolved-content', path: 'design.footer.center.logo', message: 'Generated logo needs design.logo or a primary organization logo.'}]);
  assert.deepEqual(result.furniture.parts.map(part => part.field), ['text'], 'the other fields still render');
  const local = composeSlide({title: 'Slide', text: 'Body', design: {footer: {left: {logo: true}}}}, {presentation, slideIndex: 1});
  assert.equal(local.diagnostics[0].path, 'slides.1.design.footer.left.logo');
  // Strict composition rejects the unresolved part like every other unresolved-content diagnostic.
  assert.throws(() => composeSlide({title: 'Slide', text: 'Body', composition: {overflow: 'error'}}, {presentation}), error => error.code === 'layout-overflow');
  // Other values are ignored, as for the other generated flags.
  assert.deepEqual(composeSlide({title: 'Slide'}, {presentation: {design: {footer: {center: {logo: false, text: 'x'}}}}}).diagnostics, []);
});

test('listBullet image attaches the icon logo as a picture bullet without moving the markers', () => {
  const slide = {title: 'List', items: ['One', {text: 'Two', level: 1, description: 'More'}, 'Three']};
  const presentation = {design: {listBullet: 'image', logo: {default: asset('default'), icon: asset('icon'), iconLight: asset('iconLight')}}};
  const plain = composeSlide(slide, {});
  for (const [options, expectedPath, expectedSource] of [
    [{presentation}, 'design.logo.icon', asset('icon')],
    [{presentation, darkBackground: true}, 'design.logo.iconLight', asset('iconLight')],
    [{presentation: {organization: {name: 'Acme', logo: asset('acme')}, design: {listBullet: 'image'}}}, 'organization.logo', asset('acme')],
    [{presentation: {design: {}}, slideIndex: 5}, 'slides.5.design.logo', asset('slide')],
  ]) {
    const withLogo = options.slideIndex === 5 ? {...slide, design: {listBullet: 'image', logo: asset('slide')}} : slide;
    const result = composeSlide(withLogo, options);
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
  assert.equal(byField(bullets, 'bullets').bulletImage.path, 'design.logo.icon');
  assert.equal(byField(bullets, 'text').bulletImage, undefined);
  assert.equal(byField(composeSlide(slide, {presentation: {design: {listBullet: 'character', logo: asset('deck')}}}), 'items').bulletImage, undefined);
  assert.equal(byField(composeSlide(slide, {presentation: {design: {logo: asset('deck')}}}), 'items').bulletImage, undefined);
  assert.equal(byField(composeSlide({...slide, design: {listBullet: 'character'}}, {presentation}), 'items').bulletImage, undefined, 'the slide design overrides the deck');
  assert.equal(byField(plain, 'items').text.listEntries[0].bulletImage, undefined);
});

test('listBullet image without a logo keeps the glyph and reports unresolved content once per slide', () => {
  const slide = {title: 'List', blocks: [{items: ['One']}, {bullets: ['Two']}]};
  const deck = composeSlide(slide, {presentation: {design: {listBullet: 'image'}}, slideIndex: 2});
  assert.deepEqual(deck.diagnostics, [{code: 'unresolved-content', path: 'design.listBullet', message: 'Picture bullets (listBullet: image) need design.logo or a primary organization logo; the marker glyph is drawn instead.'}]);
  assert.equal(byField(deck, 'items').bulletImage, undefined);
  assert.equal(byField(deck, 'items').text.listEntries[0].marker.text, '•');
  const local = composeSlide({...slide, design: {listBullet: 'image'}}, {slideIndex: 2});
  assert.equal(local.diagnostics[0].path, 'slides.2.design.listBullet');
  // A slide without a list is silent; so is a resolvable logo.
  assert.deepEqual(composeSlide({title: 'Text', text: 'Body'}, {presentation: {design: {listBullet: 'image'}}}).diagnostics, []);
  assert.deepEqual(composeSlide(slide, {presentation: {design: {listBullet: 'image', logo: asset('deck')}}}).diagnostics, []);
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
  const withLogo = {design: {listBullet: 'image', logo: asset('deck')}, slides: [long]};
  const pages = paginate(withLogo);
  assert.ok(pages.presentation.slides.length > 1);
  for (const [index, page] of pages.presentation.slides.entries()) {
    const result = composeSlide(page, {presentation: withLogo, slideIndex: index});
    assert.deepEqual(result.diagnostics, []);
    assert.equal(byField(result, 'items').bulletImage.path, 'design.logo');
  }
  // Unresolved furniture (logo: true without a logo) still rejects pagination like any other unresolved repeated content.
  assert.throws(() => paginateSlide(short, {presentation: {design: {footer: {left: {logo: true}}}, slides: [short]}, slideIndex: 0}), OPFPaginationError);
});
