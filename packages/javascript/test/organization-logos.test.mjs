import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LOGO_SHAPES, fromMarkdown, listBuiltinVariables, resolveSlideContext, resolveSlideVariables, resolveVariables, toMarkdown, validate} from '../dist/index.js';
import {FURNITURE_GAP, FURNITURE_IMAGE_SHARE, composeSlide, layoutFurniture, resolveLogo} from '../dist/composition.js';
import {fromYaml, toYaml} from '../dist/yaml.js';

// RR-71 (OPF 0.18): logos live on the organization, are placed through slide-scoped variable references, and a
// header/footer zone lays its parts out in one row. Decisions: docs/programs/release-readiness/rr-71-logos.md.
const asset = name => `./assets/${name}.svg`;
const titleOnly = {id: 'title', placeholders: [{type: 'title'}]};
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);
const deck = (organization, extra = {}) => ({$schema: 'https://openpresentation.org/schema/opf/v1', organization, slides: [{title: 'Cover'}], ...extra});
const codes = report => report.findings.filter(finding => finding.ruleId.startsWith('opf/variable-')).map(finding => [finding.ruleId, finding.severity, finding.path]);

test('the shapes are full, stacked, icon and wordmark', () => {
  assert.deepEqual([...LOGO_SHAPES], ['full', 'stacked', 'icon', 'wordmark']);
});

test('a single logo serves every shape and background', () => {
  const presentation = deck({id: 'acme', name: 'Acme', logo: asset('acme')});
  for (const shape of LOGO_SHAPES) for (const onDark of [false, true]) {
    const logo = resolveLogo(presentation, {}, {shape, onDark});
    assert.deepEqual(logo, {source: asset('acme'), path: 'organization.logo', shape, variant: 'default', reference: shape === 'full' ? 'var:organization.logo' : `var:organization.logo.${shape}`});
  }
  // An Asset object is a single logo too, with its alt.
  assert.deepEqual(resolveLogo(deck({id: 'acme', name: 'Acme', logo: {src: asset('acme'), alt: 'Acme'}}), {}).source, {src: asset('acme'), alt: 'Acme'});
});

test('a missing shape falls back to full, and full to the first defined of wordmark, stacked and icon', () => {
  const pick = (logo, shape) => resolveLogo(deck({id: 'acme', name: 'Acme', logo}), {}, {shape})?.path;
  const all = {full: asset('full'), stacked: asset('stacked'), icon: asset('icon'), wordmark: asset('wordmark')};
  for (const shape of LOGO_SHAPES) assert.equal(pick(all, shape), `organization.logo.${shape}`);
  assert.equal(pick({full: asset('full')}, 'icon'), 'organization.logo.full');
  assert.equal(pick({full: asset('full')}, 'stacked'), 'organization.logo.full');
  assert.equal(pick({icon: asset('icon'), stacked: asset('stacked'), wordmark: asset('wordmark')}, 'full'), 'organization.logo.wordmark');
  assert.equal(pick({icon: asset('icon'), stacked: asset('stacked')}, 'full'), 'organization.logo.stacked');
  assert.equal(pick({icon: asset('icon')}, 'full'), 'organization.logo.icon');
  // icon, then full, then full's own fallback.
  assert.equal(pick({wordmark: asset('wordmark')}, 'icon'), 'organization.logo.wordmark');
  assert.equal(pick({stacked: asset('stacked'), icon: asset('icon')}, 'wordmark'), 'organization.logo.stacked');
  // Empty sources do not count; a logo with nothing usable resolves to nothing.
  assert.equal(pick({full: '', icon: asset('icon')}, 'full'), 'organization.logo.icon');
  assert.equal(pick({full: {onLight: ' '}}, 'full'), undefined);
  assert.equal(resolveLogo(deck(undefined), {}), null);
  assert.equal(resolveLogo({}, {}), null);
  assert.throws(() => resolveLogo({}, {}, {shape: 'lockup'}), RangeError);
});

test('onLight and onDark follow the background, and a missing one uses the other', () => {
  const logo = {full: {onLight: asset('dark-ink'), onDark: asset('white')}, icon: {onDark: asset('icon-white')}};
  const presentation = deck({id: 'acme', name: 'Acme', logo});
  assert.deepEqual(resolveLogo(presentation, {}, {}), {source: asset('dark-ink'), path: 'organization.logo.full.onLight', shape: 'full', variant: 'onLight', reference: 'var:organization.logo'});
  assert.deepEqual(resolveLogo(presentation, {}, {onDark: true}), {source: asset('white'), path: 'organization.logo.full.onDark', shape: 'full', variant: 'onDark', reference: 'var:organization.logo'});
  assert.equal(resolveLogo(presentation, {}, {shape: 'icon'}).path, 'organization.logo.icon.onDark', 'the only icon is used on light too');
  assert.equal(resolveLogo(presentation, {}, {shape: 'icon', onDark: true}).path, 'organization.logo.icon.onDark');
});

test('the primary organization is role primary, else the first; a partner is addressed by id', () => {
  const organizations = [{id: 'beta', name: 'Beta', role: 'partner', logo: {icon: asset('beta-icon')}}, {id: 'acme', name: 'Acme', role: 'primary', logo: asset('acme')}];
  const presentation = deck(organizations);
  assert.equal(resolveLogo(presentation, {}).path, 'organization.1.logo');
  assert.equal(resolveLogo(deck([{id: 'one', name: 'One', logo: asset('one')}, {id: 'two', name: 'Two', logo: asset('two')}]), {}).path, 'organization.0.logo');
  assert.deepEqual(resolveLogo(presentation, {}, {reference: 'var:organization.beta.logo.icon'}), {source: asset('beta-icon'), path: 'organization.0.logo.icon', shape: 'icon', variant: 'default', reference: 'var:organization.beta.logo.icon'});
  assert.equal(resolveLogo(presentation, {}, {reference: 'organization.beta.logo', shape: 'icon'}).path, 'organization.0.logo.icon', 'the shape option applies when the reference names none');
  assert.equal(resolveLogo(presentation, {}, {reference: 'var:organization.gamma.logo'}), null);
  assert.throws(() => resolveLogo(presentation, {}, {reference: 'var:organization.logo.banner'}), RangeError);
  assert.throws(() => resolveLogo(presentation, {}, {reference: 'var:organization.name'}), RangeError);
});

test('design.logo overrides which logo covers and bullets draw, or hides it with false', () => {
  const organizations = [{id: 'acme', name: 'Acme', logo: {full: asset('acme'), icon: asset('acme-icon'), wordmark: asset('acme-word')}}, {id: 'beta', name: 'Beta', logo: asset('beta')}, {id: 'gamma', name: 'Gamma'}];
  const presentation = deck(organizations, {design: {logo: 'var:organization.beta.logo'}});
  assert.deepEqual(resolveLogo(presentation, {}), {source: asset('beta'), path: 'organization.1.logo', shape: 'full', variant: 'default', reference: 'var:organization.beta.logo', designPath: 'design.logo'});
  // A shape the override names wins over the consumer's shape; otherwise the consumer's shape applies.
  const wordmark = deck(organizations, {design: {logo: 'var:organization.logo.wordmark'}});
  assert.equal(resolveLogo(wordmark, {}).path, 'organization.0.logo.wordmark');
  assert.equal(resolveLogo(wordmark, {}, {shape: 'icon'}).path, 'organization.0.logo.wordmark');
  assert.equal(resolveLogo(deck(organizations, {design: {logo: 'var:organization.logo'}}), {}, {shape: 'icon'}).path, 'organization.0.logo.icon');
  // The slide's design.logo wins over the deck's; false hides the logo at either level.
  assert.equal(resolveLogo(presentation, {design: {logo: 'var:organization.acme.logo'}}, {slideIndex: 3}).designPath, 'slides.3.design.logo');
  assert.equal(resolveLogo(presentation, {design: {logo: false}}), null);
  assert.equal(resolveLogo(deck(organizations, {design: {logo: false}}), {}), null);
  assert.equal(resolveLogo(deck(organizations, {design: {logo: false}}), {design: {logo: 'var:organization.logo'}}).path, 'organization.0.logo.full');
  // An override that names an organization without a logo draws nothing; it never falls back to another one.
  assert.equal(resolveLogo(deck(organizations, {design: {logo: 'var:organization.gamma.logo'}}), {}), null);
});

test('covers draw the primary full logo, the override, or nothing', () => {
  const organizations = [{id: 'acme', name: 'Acme', logo: {full: {onLight: asset('acme'), onDark: asset('acme-white')}, icon: asset('acme-icon')}}, {id: 'beta', name: 'Beta', logo: asset('beta')}];
  const cover = presentation => composeSlide({title: 'Cover'}, {layout: titleOnly, presentation});
  const plain = cover(deck(organizations));
  assert.deepEqual({...plain.logo, box: undefined}, {box: undefined, shape: 'full', path: 'organization.0.logo.full.onLight', source: asset('acme'), variant: 'onLight', reference: 'var:organization.logo', anchor: 'left'});
  assert.equal(composeSlide({title: 'Cover'}, {layout: titleOnly, presentation: deck(organizations), darkBackground: true}).logo.source, asset('acme-white'));
  const partner = cover(deck(organizations, {design: {logo: 'var:organization.beta.logo'}}));
  assert.equal(partner.logo.source, asset('beta'));
  assert.deepEqual(partner.logo.box, plain.logo.box, 'the same box, another logo');
  const hidden = cover(deck(organizations, {design: {logo: false}}));
  assert.equal(hidden.logo, undefined);
  assert.deepEqual(hidden.items.map(item => item.box), composeSlide({title: 'Cover'}, {layout: titleOnly}).items.map(item => item.box));
});

test('var:organization.logo references are slide-scoped: kept by resolveVariables, resolved per slide', () => {
  const presentation = deck([{id: 'acme', name: 'Acme', logo: {full: {onLight: asset('acme'), onDark: asset('acme-white')}, icon: asset('acme-icon')}}, {id: 'beta', name: 'Beta', logo: {wordmark: asset('beta-word')}}, {id: 'gamma', name: 'Gamma'}], {
    slides: [{
      title: 'Partners',
      image: 'var:organization.logo',
      blocks: [{image: 'var:organization.beta.logo.wordmark'}, {image: 'var:organization.logo.icon'}, {image: 'var:organization.gamma.logo'}],
      design: {logo: 'var:organization.beta.logo'},
    }],
    variables: {client: {type: 'text', value: 'Globex'}},
  });
  presentation.slides[0].subtitle = 'For {{client}}';
  const resolved = resolveVariables(presentation);
  assert.equal(resolved.complete, true);
  const slide = resolved.presentation.slides[0];
  assert.equal(slide.subtitle, 'For Globex');
  assert.equal(slide.image, 'var:organization.logo');
  assert.equal(slide.blocks[0].image, 'var:organization.beta.logo.wordmark');
  assert.equal(slide.design.logo, 'var:organization.beta.logo');
  // The organization without a logo is reported, and nothing else.
  assert.deepEqual(resolved.diagnostics.map(entry => [entry.code, entry.path]), [['variable-builtin-missing', '/slides/0/blocks/2/image']]);
  // Per slide: the background picks onLight or onDark; a logo-less organization's image is omitted; design.logo stays.
  const light = resolveSlideVariables(slide, {slideNumber: 1, presentation: resolved.presentation});
  assert.equal(light.image, asset('acme'));
  assert.deepEqual(light.blocks.map(block => block.image), [asset('beta-word'), asset('acme-icon'), undefined]);
  assert.equal(light.design.logo, 'var:organization.beta.logo');
  const dark = resolveSlideVariables(slide, {slideNumber: 1, presentation: resolved.presentation, darkBackground: true});
  assert.equal(dark.image, asset('acme-white'));
  // Without the presentation the references stay, and the input is never mutated.
  assert.equal(resolveSlideVariables(slide, {slideNumber: 1}), slide);
  assert.equal(slide.image, 'var:organization.logo');
});

test('resolveSlideContext resolves logo references for the slide background', () => {
  const organization = {id: 'acme', name: 'Acme', logo: {full: {onLight: asset('acme'), onDark: asset('acme-white')}}};
  const presentation = deck(organization, {slides: [{title: 'Light', image: 'var:organization.logo', design: {background: '#ffffff'}}, {title: 'Dark', image: 'var:organization.logo', design: {background: '#000000'}}]});
  const light = resolveSlideContext(presentation, 0), dark = resolveSlideContext(presentation, 1);
  assert.equal(light.options.darkBackground, false);
  assert.equal(light.slide.image, asset('acme'));
  assert.equal(dark.options.darkBackground, true);
  assert.equal(dark.slide.image, asset('acme-white'));
});

test('outside slides and furniture a logo reference resolves deck-wide, as on a light background', () => {
  const presentation = deck({id: 'acme', name: 'Acme', logo: {full: {onLight: asset('acme'), onDark: asset('acme-white')}}}, {design: {watermark: 'var:organization.logo', footer: {left: {image: 'var:organization.logo.icon'}}}});
  const {presentation: resolved, diagnostics} = resolveVariables(presentation);
  assert.deepEqual(diagnostics, []);
  assert.equal(resolved.design.watermark, asset('acme'));
  assert.equal(resolved.design.footer.left.image, 'var:organization.logo.icon', 'zone images resolve per slide in layoutFurniture');
});

test('validation: unknown shapes and organizations are errors, a missing logo warns, inline logo tokens are errors', () => {
  const organizations = [{id: 'acme', name: 'Acme', logo: asset('acme')}, {id: 'gamma', name: 'Gamma'}];
  const findings = slide => codes(validate(deck(organizations, {slides: [slide]}), {only: ['format', 'content']}));
  assert.deepEqual(findings({title: 'x', image: 'var:organization.logo.icon'}), []);
  assert.deepEqual(findings({title: 'x', image: 'var:organization.acme.logo.full'}), []);
  assert.deepEqual(findings({title: 'x', image: 'var:organization.logo.banner'}), [['opf/variable-unknown-builtin', 'error', '/slides/0/image']]);
  assert.deepEqual(findings({title: 'x', image: 'var:organization.nobody.logo.icon'}), [['opf/variable-unknown-builtin', 'error', '/slides/0/image']]);
  assert.deepEqual(findings({title: 'x', image: 'var:organization.gamma.logo'}), [['opf/variable-builtin-missing', 'warning', '/slides/0/image']]);
  assert.deepEqual(findings({title: '{{organization.logo}}'}), [['opf/variable-unknown-builtin', 'error', '/slides/0/title']]);
  // A missing logo for the primary organization (no organization at all) is the same warning.
  assert.deepEqual(codes(validate(deck(undefined, {slides: [{title: 'x', design: {footer: {left: {image: 'var:organization.logo.icon'}}}}]}), {only: ['format', 'content']})), [['opf/variable-builtin-missing', 'warning', '/slides/0/design/footer/left/image']]);
});

test('the schema: shapes and backgrounds on the organization, design.logo a reference or false, no LogoSet, no zone logo flag', () => {
  const valid = document => validate(document, {only: ['format']}).valid;
  assert.ok(valid(deck({id: 'acme', name: 'Acme', logo: {full: {onLight: asset('a'), onDark: {src: asset('b'), alt: 'Acme'}}, icon: asset('c'), stacked: {onDark: asset('d')}, wordmark: asset('e')}})));
  assert.ok(valid(deck({id: 'acme', name: 'Acme', logo: {src: asset('a'), alt: 'Acme'}})));
  assert.ok(!valid(deck({id: 'acme', name: 'Acme', logo: {}})));
  assert.ok(!valid(deck({id: 'acme', name: 'Acme', logo: {lockup: asset('a')}})));
  assert.ok(!valid(deck({id: 'acme', name: 'Acme', logo: {full: {light: asset('a')}}})));
  for (const logo of ['var:organization.logo', 'var:organization.logo.icon', 'var:organization.acme.logo', 'var:organization.acme.logo.wordmark', false]) assert.ok(valid(deck({id: 'acme', name: 'Acme', logo: asset('a')}, {design: {logo}})), String(logo));
  for (const logo of [asset('a'), {default: asset('a')}, 'var:organization.name', 'var:organization.logo.banner', true]) assert.ok(!valid(deck({id: 'acme', name: 'Acme', logo: asset('a')}, {design: {logo}})), JSON.stringify(logo));
  assert.ok(!valid(deck({id: 'acme', name: 'Acme', logo: asset('a')}, {design: {footer: {left: {logo: true}}}})));
  assert.ok(valid(deck({id: 'acme', name: 'Acme', logo: asset('a')}, {design: {footer: {left: {image: 'var:organization.logo.icon', text: '{{organization.name}}'}}}})));
});

test('listBuiltinVariables lists every logo shape as a slide-scoped image', () => {
  const presentation = deck([{id: 'acme', name: 'Acme', logo: {icon: asset('icon')}}, {id: 'beta', name: 'Beta'}], {slides: [{title: 'x', image: 'var:organization.logo.icon'}]});
  const logos = listBuiltinVariables(presentation).filter(entry => entry.kind === 'image' && entry.name.startsWith('organization.'));
  assert.deepEqual(logos.map(entry => [entry.name, entry.scope, entry.available, 'value' in entry]), [
    ['organization.logo', 'slide', true, false], ['organization.logo.stacked', 'slide', true, false], ['organization.logo.icon', 'slide', true, false], ['organization.logo.wordmark', 'slide', true, false],
    ['organization.acme.logo', 'slide', true, false], ['organization.acme.logo.stacked', 'slide', true, false], ['organization.acme.logo.icon', 'slide', true, false], ['organization.acme.logo.wordmark', 'slide', true, false],
    ['organization.beta.logo', 'slide', false, false], ['organization.beta.logo.stacked', 'slide', false, false], ['organization.beta.logo.icon', 'slide', false, false], ['organization.beta.logo.wordmark', 'slide', false, false],
  ]);
  assert.deepEqual(logos.find(entry => entry.name === 'organization.logo.icon').uses, [{id: 'organization.logo.icon', path: '/slides/0/image', form: 'reference'}]);
});

test('a zone image logo reference resolves for the slide background and keeps the reference', () => {
  const presentation = deck([{id: 'acme', name: 'Acme', logo: {icon: {onLight: asset('icon'), onDark: asset('icon-white')}}}, {id: 'beta', name: 'Beta', logo: asset('beta')}, {id: 'gamma', name: 'Gamma'}], {
    design: {footer: {left: {image: 'var:organization.logo.icon'}, right: {image: 'var:organization.beta.logo'}}},
  });
  const light = layoutFurniture({}, {presentation}), dark = layoutFurniture({}, {presentation, darkBackground: true});
  assert.deepEqual(light.diagnostics, []);
  assert.deepEqual(light.parts.map(part => [part.field, part.image, part.sourcePath, part.reference, part.generated]), [
    ['image', asset('icon'), 'organization.0.logo.icon.onLight', 'var:organization.logo.icon', false],
    ['image', asset('beta'), 'organization.1.logo', 'var:organization.beta.logo', false],
  ]);
  assert.equal(dark.parts[0].image, asset('icon-white'));
  // An organization without a logo, or an unknown shape, is unresolved content at the zone image.
  for (const image of ['var:organization.gamma.logo', 'var:organization.logo.banner', 'var:organization.nobody.logo']) {
    const layout = layoutFurniture({}, {presentation: {...presentation, design: {footer: {left: {image, text: 'Acme'}}}}});
    assert.deepEqual(layout.diagnostics.map(entry => [entry.code, entry.path]), [['unresolved-content', 'design.footer.left.image']], image);
    assert.deepEqual(layout.parts.map(part => part.field), ['text']);
  }
});

test('a zone lays out image, text, socials and date in one row aligned to its edge', () => {
  const organization = {id: 'acme', name: 'Acme', logo: asset('acme'), socials: {x: '@acme'}};
  const zone = {image: 'var:organization.logo', text: 'Acme Corp', socials: true, date: '2026'};
  const measure = (text, size) => [...text].length * size / 2;
  for (const side of ['left', 'center', 'right']) {
    const layout = layoutFurniture({}, {presentation: deck(organization, {design: {footer: {[side]: zone}}}), textMeasurement: {measure}});
    assert.deepEqual(layout.diagnostics, []);
    const parts = layout.parts;
    assert.deepEqual(parts.map(part => part.field), ['image', 'text', 'socials', 'date']);
    const center = parts[0].box.y + parts[0].box.height / 2;
    for (const [index, part] of parts.entries()) {
      near(part.box.y + part.box.height / 2, center, `${side} ${part.field} is vertically centered`);
      assert.equal(part.alignment, side);
      if (index) near(part.box.x, parts[index - 1].box.x + parts[index - 1].box.width + FURNITURE_GAP, `${side} ${part.field} follows with one gap`);
      if (part.type === 'text') assert.equal(part.fit.lines.length, 1, `${side} ${part.field} keeps one line`);
    }
    const zoneX = 1280 * (0.07 + ['left', 'center', 'right'].indexOf(side) * 0.3), zoneWidth = 1280 * 0.26;
    const start = parts[0].box.x, end = parts.at(-1).box.x + parts.at(-1).box.width;
    if (side === 'left') near(start, zoneX, 'starts at the left edge');
    if (side === 'right') near(end, zoneX + zoneWidth, 'ends at the right edge');
    if (side === 'center') near((start + end) / 2, zoneX + zoneWidth / 2, 'centered in the zone');
    // The text box is as wide as its line.
    near(parts[1].box.width, measure('Acme Corp', parts[1].fit.fontSize), 'text box hugs its line');
  }
  // A zone with one text part keeps the whole zone width, as before.
  const lone = layoutFurniture({}, {presentation: deck(organization, {design: {footer: {right: {text: 'Only'}}}})}).parts[0];
  near(lone.box.width, 1280 * 0.26, 'one text part spans the zone');
  // \n still breaks lines inside a part.
  const lines = layoutFurniture({}, {presentation: deck(organization, {design: {footer: {left: {image: 'var:organization.logo', text: 'One\nTwo'}}}})}).parts[1];
  assert.equal(lines.fit.lines.length, 2);
});

test('a right-to-left deck runs the row from the right', () => {
  const presentation = deck({id: 'acme', name: 'Acme', logo: asset('acme')}, {language: 'ar', design: {footer: {left: {image: 'var:organization.logo', text: 'نص'}}}});
  const [image, text] = layoutFurniture({}, {presentation}).parts;
  assert.equal(image.alignment, 'right');
  near(image.box.x + image.box.width, 1280 * (0.07 + 2 * 0.3) + 1280 * 0.26, 'the image is at the start (right) edge');
  near(text.box.x + text.box.width + FURNITURE_GAP, image.box.x, 'the text follows to its left');
});

test('a row wider than its zone wraps its text, and reports overflow when it cannot fit', () => {
  const organization = {id: 'acme', name: 'Acme', logo: asset('acme')};
  const long = 'Confidential and proprietary information prepared for the board';
  const layout = layoutFurniture({}, {presentation: deck(organization, {design: {footer: {left: {image: 'var:organization.logo', text: long, date: '2026'}}}})});
  assert.deepEqual(layout.diagnostics, []);
  const [image, text, date] = layout.parts;
  assert.ok(text.fit.lines.length > 1, 'the long text wraps');
  assert.equal(date.fit.lines.length, 1, 'the short date keeps its width');
  near(date.box.x + date.box.width - image.box.x, 1280 * 0.26, 'the row fills the zone exactly');
  // A very wide logo is capped beside text, so the text keeps room; a word that still cannot fit its share is overflow.
  const wide = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100"/>').toString('base64')}`;
  const capped = layoutFurniture({}, {presentation: deck({...organization, logo: wide}, {design: {footer: {left: {image: 'var:organization.logo', text: 'Acme'}}}})});
  assert.deepEqual(capped.diagnostics, []);
  near(capped.parts[0].box.width, 1280 * 0.26 * 0.4, 'the logo takes at most 40% of the zone');
  const overflow = layoutFurniture({composition: {minFontSize: 32}}, {presentation: deck({...organization, logo: wide}, {design: {footer: {left: {image: 'var:organization.logo', text: 'Supercalifragilistic', date: '2026'}}}})});
  assert.equal(overflow.overflow, true);
  assert.deepEqual(overflow.diagnostics.map(entry => [entry.code, entry.path]), [['text-overflow', 'design.footer.left.text']]);
});

test('a deck with organization logos round-trips through YAML and Markdown', () => {
  const presentation = deck([{id: 'acme', name: 'Acme', role: 'primary', logo: {full: {onLight: asset('acme'), onDark: asset('acme-white')}, icon: asset('icon')}}, {id: 'beta', name: 'Beta', logo: asset('beta')}], {
    design: {logo: 'var:organization.beta.logo', footer: {left: {image: 'var:organization.logo.icon', text: '{{organization.name}}'}}},
    slides: [{title: 'Cover', image: 'var:organization.beta.logo.wordmark'}],
  });
  assert.ok(validate(presentation, {only: ['format']}).valid);
  assert.deepEqual(fromYaml(toYaml(presentation).yaml).presentation, presentation);
  assert.deepEqual(fromMarkdown(toMarkdown(presentation).markdown).presentation, presentation);
});

const png = (width, height) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
};

test('beside other parts an image is capped at FURNITURE_IMAGE_SHARE of the zone; alone it keeps its width', () => {
  assert.equal(FURNITURE_IMAGE_SHARE, 0.4);
  const zoneWidth = 1280 * 0.26;
  const zone = content => layoutFurniture({}, {presentation: deck({id: 'acme', name: 'Acme', logo: png(400, 100)}, {design: {header: {left: content}}})}).parts;
  const [alone] = zone({image: 'var:organization.logo'});
  near(alone.box.width, alone.box.height * 4, 'a lone 4:1 logo keeps its proportions');
  const [image, text] = zone({image: 'var:organization.logo', text: 'Acme'});
  near(image.box.width, zoneWidth * FURNITURE_IMAGE_SHARE, 'the wide logo is capped beside text');
  near(image.box.height, alone.box.height, 'at the same height (consumers fit the image inside the box)');
  near(text.box.x, image.box.x + image.box.width + FURNITURE_GAP, 'the text follows');
  // An image narrower than the share keeps its own width.
  const [square] = layoutFurniture({}, {presentation: deck({id: 'acme', name: 'Acme', logo: png(100, 100)}, {design: {header: {left: {image: 'var:organization.logo', text: 'Acme'}}}})}).parts;
  near(square.box.width, square.box.height, 'a square logo is not stretched');
});

test('portrait: a logo beside text never breaks a word silently at the readability floor', () => {
  // The renderer's case: a 720 px wide portrait canvas, a header-left logo beside text, a 32 px floor.
  const layout = (logo, text) => layoutFurniture({composition: {minFontSize: 32}}, {width: 720, height: 1280, presentation: deck({id: 'acme', name: 'Acme', logo}, {design: {header: {left: {image: 'var:organization.logo', text}}}})});
  for (const logo of [png(400, 100), png(100, 100), './assets/acme.svg']) {
    const result = layout(logo, 'Keep both');
    assert.deepEqual(result.diagnostics, [], 'the words fit their share whole');
    const text = result.parts.find(part => part.type === 'text');
    assert.equal(text.fit.fontSize, 32);
    assert.deepEqual(text.fit.lines.map(line => line.trim()), ['Keep', 'both'], 'it wraps between the words, never inside one');
  }
  // A word wider than its share would break inside the word: that is text-overflow at the part, never silent.
  const long = layout(png(400, 100), 'Confidentiality');
  assert.deepEqual(long.diagnostics.map(entry => [entry.code, entry.path]), [['text-overflow', 'design.header.left.text']]);
  assert.match(long.diagnostics[0].message, /break inside the word/);
  assert.equal(long.overflow, true);
  // Scripts written without spaces break between characters as usual.
  assert.deepEqual(layout(png(100, 100), '東京都の会議資料です').diagnostics, []);
  // A lone text part keeps its 0.17 behavior: no new diagnostic for a long word in a single-part zone.
  const single = layoutFurniture({composition: {minFontSize: 32}}, {width: 720, height: 1280, presentation: deck(undefined, {design: {header: {left: {text: 'Confidentiality-assessment'}}}})});
  assert.ok(single.diagnostics.every(entry => !/break inside the word/.test(entry.message)));
});
