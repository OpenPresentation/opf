// LH-14: icons. The reference forms, the path normalization, SVG intake (monochrome glyph, multicolor picture, refusals), resolution
// with near-name suggestions, the gallery's lazily loaded sets, validation, and composition's chips on list entries, metrics and groups
// (left to right and right to left), with the size guard dropping chips, never text.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { galleryIconSets } from '@openpresentation/gallery/icon-sets';
import { composeSlide, embedIcons, ensureIcons, iconColors, iconFromSvg, iconPathCommands, iconPathData, parseIconReference, resolveIcon } from '../dist/composition.js';
import { resolveSlideContext, validate } from '../dist/index.js';

const SET = { name: 'Brand', license: 'MIT', copyright: 'Copyright (c) 2026 Example', viewBox: [0, 0, 24, 24], style: 'stroke', strokeWidth: 2, icons: { star: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z', dot: 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0' } };
const MONO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4"><g transform="translate(2 2)"><circle cx="22" cy="22" r="20"/></g><path d="M14 24l7 7 13-14"/></svg>';
const MULTI = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="10" fill="#f00"/><rect x="5" width="5" height="10" fill="#00f"/></svg>';

test('an icon value is a set icon, a deck-local name or an SVG source', () => {
  assert.deepEqual(parseIconReference('lucide:truck'), { kind: 'set', set: 'lucide', name: 'truck' });
  assert.deepEqual(parseIconReference('brand-mark'), { kind: 'deck', name: 'brand-mark' });
  assert.deepEqual(parseIconReference('asset:logo'), { kind: 'source', src: 'asset:logo' });
  assert.deepEqual(parseIconReference('./a.svg'), { kind: 'source', src: './a.svg' });
  for (const bad of ['Truck', 'lucide:', ':x', 'a b', 3]) assert.equal(parseIconReference(bad), undefined, String(bad));
});

test('path data normalizes to absolute M, L, C and Z: relative commands, H and V, quadratics and arcs', () => {
  assert.equal(iconPathData(iconPathCommands('m2 2 2 0v2h-2z')), 'M2 2L4 2L4 4L2 4Z');
  const quad = iconPathCommands('M0 0Q3 3 6 0');
  assert.deepEqual(quad.map(command => command[0]), ['M', 'C']);
  // A half circle of radius 10 from (0,10) to (20,10): two quarter-turn cubics ending on the arc.
  const arc = iconPathCommands('M0 10A10 10 0 0 1 20 10');
  assert.equal(arc.length, 3);
  assert.deepEqual(arc.at(-1).slice(-2), [20, 10]);
  const mid = arc[1].slice(-2);
  assert.ok(Math.abs(Math.hypot(mid[0] - 10, mid[1] - 10) - 10) < 1e-6);
  // Flags written without separators.
  assert.equal(iconPathCommands('M0 0a5 5 0 1010 0').at(-1).at(-2), 10);
});

test('SVG intake: one paint is a glyph in the 24 unit box, several colors a picture, scripts and external references refused', () => {
  const mono = iconFromSvg(MONO);
  assert.equal(mono.ok, true);
  assert.equal(mono.parts.length, 2);
  // 48 units scale to 24: the stroke halves, the circle's transform is applied.
  assert.equal(mono.parts[0].stroke, 2);
  const xs = mono.parts[0].commands.flatMap(command => command[0] === 'C' ? [command[5]] : command[0] === 'Z' ? [] : [command[1]]);
  assert.ok(Math.min(...xs) >= 1.9 && Math.max(...xs) <= 22.1, JSON.stringify(xs));
  assert.ok(iconFromSvg(MULTI).picture);
  assert.equal(iconFromSvg(MULTI).parts, undefined);
  for (const [svg, why] of [
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>x()</script></svg>', /script/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="https://x/a.png"/></svg>', /image/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><use href="https://x/a.svg#i"/></svg>', /external/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="x()"><path d="M0 0L1 1"/></svg>', /event handler/],
    ['<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', /DOCTYPE/],
    ['<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>', /no size|viewBox/],
  ]) {
    const read = iconFromSvg(svg);
    assert.equal(read.ok, false, svg);
    assert.match(read.message, why);
  }
});

test('resolution: the deck icons, an embedded set, the gallery sets once loaded, with the nearest names when one is unknown', async () => {
  const deck = { icons: { mark: MONO, multi: MULTI, bad: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>' }, catalogs: { custom: { iconSets: { brand: SET } } }, slides: [{ items: [{ text: 'a', icon: 'tabler:rocket' }] }] };
  assert.equal(resolveIcon(deck, 'mark').icon.kind, 'deck');
  assert.ok(resolveIcon(deck, 'multi').icon.picture);
  assert.equal(resolveIcon(deck, 'bad').code, 'icon-invalid');
  assert.deepEqual(resolveIcon(deck, 'brand:sta').suggestions, ['brand:star']);
  assert.equal(resolveIcon(deck, 'brand:star').icon.license, 'MIT');
  assert.equal(resolveIcon(deck, 'nope:x').code, 'icon-unknown');
  assert.equal(resolveIcon(deck, 'marc').suggestions[0], 'mark');
  const loaded = await ensureIcons(deck, { catalogs: [gallery, galleryIconSets] });
  assert.ok(loaded.sets.includes('tabler'));
  const rocket = resolveIcon(deck, 'tabler:rocket', { catalogs: [gallery, galleryIconSets] });
  assert.equal(rocket.ok, true);
  assert.equal(rocket.icon.parts[0].linecap, 'round');
  await ensureIcons({ slides: [{ items: [{ text: 'a', icon: 'lucide:truck' }] }] }, { catalogs: [gallery, galleryIconSets] });
  assert.ok(resolveIcon({}, 'lucide:truk', { catalogs: [gallery, galleryIconSets] }).suggestions.includes('lucide:truck'));
  // embedIcons copies only the icons the deck uses, with the set's license and copyright, into the default group with its source.
  const embedded = embedIcons({ slides: [{ items: [{ text: 'a', icon: 'lucide:truck' }] }] }, { catalogs: [gallery, galleryIconSets] }).document;
  assert.deepEqual(Object.keys(embedded.catalogs.default.iconSets.lucide.icons), ['truck']);
  assert.equal(embedded.catalogs.default.source, gallery.source);
  assert.equal(embedded.catalogs.default.iconSets.lucide.license, 'ISC');
  assert.equal(validate(embedded).findings.filter(finding => finding.ruleId.startsWith('opf/icon') || finding.ruleId === 'opf/catalog-record').length, 0);
});

test('validation reports an unknown icon with suggestions and an unusable SVG', () => {
  const deck = { name: 'Icons', language: 'en', icons: { bad: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>' }, catalogs: { custom: { iconSets: { brand: SET } } },
    slides: [{ title: 'T', items: [{ text: 'a', icon: 'brand:sta' }, { text: 'b', icon: 'bad' }, { text: 'c', icon: 'brand:star' }] }] };
  const findings = validate(deck).findings;
  const unknown = findings.find(finding => finding.ruleId === 'opf/icon-unknown');
  assert.equal(unknown.path, '/slides/0/items/0/icon');
  assert.deepEqual(unknown.suggestions.map(entry => entry.value), ['brand:star']);
  assert.equal(findings.find(finding => finding.ruleId === 'opf/icon-invalid').path, '/slides/0/items/1/icon');
});

const compose = (deck, index = 0) => { const context = resolveSlideContext(deck, index); return composeSlide(context.slide, context.options); };
const iconless = value => Array.isArray(value) ? value.map(iconless) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'icon').map(([key, entry]) => [key, iconless(entry)])) : value;
const sizes = composition => composition.items.filter(item => item.text).map(item => [item.path, item.text.fontSize]);

test('composition: a list draws its icons on chips in the marker column, left to right and right to left, at the sizes it has without them', () => {
  for (const language of ['en', 'ar']) {
    const items = language === 'en' ? [{ text: 'Offline mode', description: 'Keep working without a connection.', icon: 'brand:star' }, { text: 'Shared workspaces', description: 'One place for files.', icon: 'brand:dot' }, { text: 'Faster search', description: 'Results in 200 ms.' }]
      : [{ text: 'العمل دون اتصال', description: 'تابع عملك دون إنترنت.', icon: 'brand:star' }, { text: 'مساحات عمل مشتركة', description: 'مكان واحد للملفات.', icon: 'brand:dot' }, { text: 'بحث أسرع', description: 'نتائج في لحظة.' }];
    const deck = { name: 'Icons', language, catalogs: { custom: { iconSets: { brand: SET } } }, slides: [{ title: 'New', items }] };
    const result = compose(deck), plain = compose(iconless(deck));
    assert.deepEqual(result.icons.map(icon => icon.path), ['slides.0.items.0.icon', 'slides.0.items.1.icon'], language);
    assert.deepEqual(sizes(result), sizes(plain), `${language}: no block smaller`);
    const list = result.items.find(item => item.field === 'items'), entry = list.text.listEntries[0], icon = result.icons[0];
    assert.ok(Math.abs(icon.chip.cx - entry.icon.cx) < .01);
    // The chip sits at the start of the entry: before its text in left to right, after it (on the right) in right to left.
    if (language === 'en') assert.ok(icon.chip.cx + icon.chip.radius <= entry.textBox.x + .01);
    else assert.ok(icon.chip.cx - icon.chip.radius >= entry.textBox.x + entry.textBox.width - .01);
    assert.ok(icon.parts[0].stroke > 0 && icon.parts[0].commands.length > 3);
    assert.equal(icon.colors.chip.role, 'primary');
    assert.equal(result.diagnostics.filter(diagnostic => diagnostic.code === 'icon-dropped').length, 0);
  }
});

test('composition: metrics and groups take their chips above their content; an icon nothing can mark is dropped with a finding, its text kept', () => {
  const deck = { name: 'Icons', language: 'en', catalogs: { custom: { iconSets: { brand: SET } } }, slides: [
    { title: 'Numbers', blocks: [{ metric: { value: '98%', label: 'Uptime', icon: 'brand:star' } }, { metric: { value: '12k', label: 'Users', icon: 'brand:dot' } }] },
    { title: 'Groups', blocks: [{ icon: 'brand:star', blocks: [{ text: 'Speed' }, { text: 'Pages load in under a second.' }] }, { icon: 'brand:dot', blocks: [{ text: 'Security' }, { text: 'SSO on every plan.' }] }] },
    { title: 'Steps', items: [{ text: 'Sign up', icon: 'brand:star' }, { text: 'Invite the team' }], numbering: 'arabic' },
  ] };
  const metrics = compose(deck, 0);
  assert.equal(metrics.icons.length, 2);
  for (const icon of metrics.icons) {
    const item = metrics.items.find(entry => entry.path === icon.owner);
    const top = Math.min(...item.metricLayout.parts.filter(part => part.visible && part.fit).map(part => part.box.y));
    assert.ok(icon.chip.cy + icon.chip.radius <= top, 'the chip is above the metric');
  }
  const groups = compose(deck, 1);
  assert.deepEqual(groups.icons.map(icon => icon.owner), ['slides.1.blocks.0', 'slides.1.blocks.1']);
  const eyebrow = groups.items.find(item => item.path.startsWith('slides.1.blocks.0.') && item.eyebrow);
  assert.ok(groups.icons[0].chip.cy + groups.icons[0].chip.radius <= eyebrow.box.y, 'the chip is above the group heading');
  const numbered = compose(deck, 2);
  assert.equal(numbered.icons, undefined);
  assert.deepEqual(numbered.diagnostics.filter(diagnostic => diagnostic.code === 'icon-dropped').map(diagnostic => diagnostic.path), ['slides.2.items.0.icon']);
  assert.deepEqual(sizes(numbered), sizes(compose(iconless(deck), 2)));
});

test('a slide without icons composes as before', () => {
  const deck = { name: 'Plain', language: 'en', slides: [{ title: 'New', items: [{ text: 'Offline mode', description: 'Keep working.' }, { text: 'Search', description: 'Fast.' }] }] };
  const result = compose(deck);
  assert.equal(result.icons, undefined);
  assert.ok(result.items.find(item => item.field === 'items').text.listEntries.every(entry => entry.icon === undefined));
});

test('icon colors: a tint of the primary with the glyph in the primary, the inverse on a dark slide', () => {
  const light = iconColors({ primary: '#2874A6', text: '#000000', background: '#FFFFFF' }, false);
  assert.deepEqual([light.chip.lumMod, light.chip.lumOff, light.glyph.hex], [20000, 80000, '#2874A6']);
  const dark = iconColors({ primary: '#2874A6', text: '#FFFFFF', background: '#000000' }, true);
  assert.equal(dark.chip.hex, '#2874A6');
  assert.equal(dark.glyph.hex, '#FFFFFF');
});
