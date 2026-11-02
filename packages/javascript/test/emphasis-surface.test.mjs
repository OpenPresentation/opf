import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorContrast, composeSlide, emphasisSurface, EMPHASIS_SURFACE_MIN_CONTRAST, EMPHASIS_TEXT_MIN_CONTRAST, layoutMetric, METRIC_TILE_VALUE_SHARE, resolveColorRoles } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

// LH-06: one emphasis surface per slide, authored (`emphasis: true` on a block or group) or automatic (a short last text after longer
// blocks as a foot band, one of 30 characters or fewer after a lone long text as a pill), coloured from the scheme's own slots.
// LH-68: a metric in a `metrics: "tile"` region (the gallery scorecard) is laid out from its whole card.
const { layouts } = gallery;
const long = (name) => `${name} should focus the next cycle on improving evaluation timelines and family communication while making the operating tradeoffs clear.`;
const surfaceItems = (result) => result.items.filter((item) => item.emphasis);
const inside = (box, outer) => box.x >= outer.x - 0.01 && box.y >= outer.y - 0.01 && box.x + box.width <= outer.x + outer.width + 0.01 && box.y + box.height <= outer.y + outer.height + 0.01;

test('LH-06: an authored emphasis draws one card around its block, the first one per slide', () => {
  const slide = { title: 'Decision', blocks: [{ text: long('Easton') }, { text: long('Tandem'), emphasis: true }, { text: 'Name the pilot lead.', emphasis: true }] };
  for (const layout of [undefined, layouts.pillars, layouts['three-column']]) {
    const result = composeSlide(slide, layout ? { layout } : {});
    assert.equal(result.emphasis?.path, 'slides.0.blocks.1');
    assert.equal(result.emphasis.shape, 'card');
    assert.equal(result.emphasis.source, 'authored');
    const items = surfaceItems(result);
    assert.deepEqual(items.map((item) => item.path), ['slides.0.blocks.1.text']);
    assert.equal(items[0].frameBox, undefined, 'the surface replaces the card');
    assert.ok(inside(items[0].box, result.emphasis.box));
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'emphasis-ignored').map((entry) => entry.path), ['slides.0.blocks.2']);
    // An authored emphasis turns the automatic rules off.
    assert.equal(result.items.find((item) => item.path === 'slides.0.blocks.2.text').emphasis, undefined);
  }
});

test('LH-06: an emphasized group is one surface; its children take no card of their own', () => {
  const slide = { title: 'Decision', blocks: [{ text: long('Easton') }, { emphasis: true, blocks: [{ metric: { value: '42%', label: 'Adoption' } }, { text: 'Up from 30% in the pilot.' }] }] };
  const result = composeSlide(slide, { layout: layouts.pillars });
  assert.equal(result.emphasis.path, 'slides.0.blocks.1');
  const items = surfaceItems(result);
  assert.deepEqual(items.map((item) => item.path), ['slides.0.blocks.1.blocks.0.metric', 'slides.0.blocks.1.blocks.1.text']);
  for (const item of items) {
    assert.equal(item.frameBox, undefined);
    assert.ok(inside(item.box, result.emphasis.box), `${item.path} inside the surface`);
  }
});

test('LH-06: a short last text after longer blocks is a band at the foot of the body, in every reading direction', () => {
  const slide = { title: 'Next steps', blocks: [{ text: long('Easton') }, { chart: { type: 'column', data: [['Quarter', 'Value'], ['Q1', 3], ['Q2', 5]] } }, { text: 'Next step: name the pilot lead.' }] };
  for (const direction of ['ltr', 'rtl']) for (const layout of [undefined, layouts['two-column']]) {
    const result = composeSlide(slide, { direction, ...(layout ? { layout } : {}) });
    const label = `${direction} ${layout ? 'two-column' : 'automatic'}`;
    assert.equal(result.emphasis?.shape, 'band', label);
    assert.equal(result.emphasis.source, 'foot-band');
    const band = result.emphasis.box, last = result.items.at(-1);
    assert.equal(last.path, 'slides.0.blocks.2.text', `${label}: the band text is the last item`);
    assert.ok(last.emphasis && inside(last.box, band));
    assert.ok(Math.abs(band.width - (result.width - 2 * band.x)) < 0.5, `${label}: full width`);
    for (const item of result.items) if (item !== last && !['title'].includes(item.field)) assert.ok(item.box.y + item.box.height <= band.y + 0.01, `${label}: ${item.path} above the band`);
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  }
});

test('LH-06: the automatic rules stay off for a short earlier text, emphasis: false and a lone block', () => {
  const short = 'Decide with the evidence.';
  assert.equal(composeSlide({ title: 'T', blocks: [{ text: long('A') }, { text: 'The deck-level language can be a catalog id.' }, { text: short }] }).emphasis, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: [{ text: long('A') }, { text: short, emphasis: false }] }).emphasis, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: [{ text: short }] }).emphasis, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: [{ text: long('A') }, { bullets: ['One', 'Two'] }] }).emphasis, undefined);
});

test('LH-06: one of 30 characters or fewer after a lone long text is a pill at the start of the content alignment', () => {
  const slide = { title: 'Decision options', blocks: [{ text: long('North Metro') }, { text: 'Signal' }] };
  for (const layout of [undefined, layouts.hero, layouts['two-column']]) {
    const ltr = composeSlide(slide, layout ? { layout } : {}), rtl = composeSlide(slide, { direction: 'rtl', ...(layout ? { layout } : {}) });
    for (const [result, start] of [[ltr, 'left'], [rtl, 'right']]) {
      const pill = result.emphasis;
      assert.equal(pill?.shape, 'pill');
      assert.ok(pill.box.width < result.width / 4, 'the pill hugs its text');
      assert.equal(pill.radius, pill.box.height / 2);
      const margin = start === 'left' ? pill.box.x : result.width - pill.box.x - pill.box.width;
      assert.ok(Math.abs(margin - result.contentBox.x) < 0.5 || margin < result.width * 0.1, `pill at the ${start}`);
      assert.ok(inside(result.items.at(-1).box, pill.box));
    }
  }
});

test('LH-06: the surface keeps every text role at 4.5:1 and stands off the slide at 3:1, for every gallery theme, scheme and tone', () => {
  let checked = 0;
  for (const theme of Object.keys(gallery.themes)) for (const colorScheme of Object.keys(gallery.colorSchemes)) for (const variant of [undefined, 'dark1', 'dark2', 'light2']) {
    const deck = { design: { theme, colorScheme, ...(variant ? { variant } : {}) }, slides: [{ title: 'T', text: 'x' }] };
    const { resolved } = resolveSlideContext(deck, 0, { catalogs: [gallery] });
    const surface = emphasisSurface(resolved.colorScheme, resolved.roles);
    const label = `${theme} ${colorScheme} ${variant ?? 'default'}`;
    for (const role of ['text', 'textSecondary', 'primary', 'secondary', 'accent']) assert.ok(colorContrast(surface.roles[role].slice(0, 7), surface.fill) >= EMPHASIS_TEXT_MIN_CONTRAST, `${label}: ${role} ${surface.roles[role]} on ${surface.fill}`);
    assert.ok(colorContrast(surface.fill, resolved.roles.background.slice(0, 7)) >= EMPHASIS_SURFACE_MIN_CONTRAST, `${label}: ${surface.fill} on ${resolved.roles.background}`);
    // A light slide takes a dark surface, a dark one an accent (or light1).
    assert.ok(resolved.roles.dark ? surface.variant.background !== 'dark1' && surface.variant.background !== 'dark2' : !/^light/.test(surface.variant.background), label);
    checked++;
  }
  assert.ok(checked > 100);
  // No colour is invented: the fill is one of the scheme's slots.
  const scheme = gallery.colorSchemes['cool-horizon'];
  const fill = emphasisSurface(scheme, resolveColorRoles(scheme)).fill;
  assert.ok(Object.values(scheme).some((value) => typeof value === 'string' && value.toUpperCase().startsWith(fill)));
});

test('LH-68: a tile metric leads with its label, sizes its value from the tile and sets the rest at its foot', () => {
  const metric = { value: '$4.8M', label: 'Primary signal', description: 'Shift the library to research services first', trend: 'up' };
  for (const height of [240, 480, 900]) {
    const box = { x: 100, y: 100, width: 520, height };
    const tile = layoutMetric(metric, box, { tile: true, align: 'left' });
    const part = (role) => tile.parts.find((entry) => entry.role === role);
    assert.equal(tile.overflow, false, `${height}`);
    assert.ok(part('label').box.y < part('value').box.y, 'the label is the eyebrow');
    const wanted = Math.min(152, Math.max(76, height * METRIC_TILE_VALUE_SHARE));
    assert.ok(part('value').fit.fontSize <= wanted + 0.5 && part('value').fit.fontSize >= Math.min(wanted, 76) - 24, `${height}: value ${part('value').fit.fontSize} for ${wanted}`);
    const foot = Math.max(...['description', 'trend'].map((role) => part(role).box.y + part(role).box.height));
    assert.ok(Math.abs(foot - (box.y + box.height)) < 0.5, `${height}: the foot ends at the tile's bottom`);
    assert.ok(part('description').box.y > part('value').box.y + part('value').box.height);
  }
  // Without `tile` the metric is the stacked block it was.
  const stacked = layoutMetric(metric, { x: 0, y: 0, width: 520, height: 480 }, {});
  assert.ok(stacked.parts.find((entry) => entry.role === 'value').box.y < stacked.parts.find((entry) => entry.role === 'label').box.y);
});

test('LH-68: the scorecard draws its metrics as tiles that fill their cards, one value size per row of siblings (LH-43)', () => {
  const metric = (value, description) => ({ metric: { value, label: 'Primary signal', description, trend: 'up' } });
  const slide = { title: 'Why this matters', blocks: [metric('18%', 'Qualify suppliers'), metric('31%', 'Move analytics workloads with minimal reporting disruption'), metric('18%', 'Recover weekday occupancy')] };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide(slide, { layout: layouts.scorecard, direction });
    const metrics = result.items.filter((item) => item.metricLayout);
    assert.equal(metrics.length, 3);
    assert.equal(new Set(metrics.map((item) => item.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize)).size, 1, 'one value size');
    for (const item of metrics) {
      const value = item.metricLayout.parts.find((part) => part.role === 'value'), label = item.metricLayout.parts.find((part) => part.role === 'label');
      assert.ok(label.box.y < value.box.y);
      assert.ok(value.fit.fontSize > 76, `${direction}: the value grows past its role size in a tall tile`);
      assert.ok(item.frameBox && item.frameBox.height > result.contentBox.height * 0.6, 'the card fills its cell');
      if (direction === 'ltr') assert.equal(item.metricLayout.alignment, 'left');
    }
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  }
});
