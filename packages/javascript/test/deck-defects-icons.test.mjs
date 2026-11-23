// Defects found writing the 0.34.1 sample decks. Four metrics with icons in two rows: the even row spacing (RR-105, finding 03) set the
// lower row's chips on the upper row's labels, because the rows' contents did not count the chip band. Icons in a promoted region were
// never loaded, drawn or reported, because the icon walk skipped the region keys. Icons on a list in a weighted column were dropped
// although compact chips cost no size there: the guard, after another rule cost a size, retried only the rules that fired, and icons
// fire none. Where there is truly no room, the finding names what bounds the block.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { galleryIconSets as gallerySets } from '@openpresentation/gallery/icon-sets';
import { composeSlide, documentIcons, ensureIcons } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const catalogs = [gallery, gallerySets()];
const deck = (slide, design = { theme: 'classic', colorScheme: 'corporate-blue', fontScheme: 'aptos' }) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design, slides: [slide] });
const compose = async (document) => {
  await ensureIcons(document, { catalogs });
  const context = resolveSlideContext(document, 0);
  return composeSlide(context.slide, context.options);
};
const withoutIcons = (document) => JSON.parse(JSON.stringify(document), (key, value) => (value && typeof value === 'object' && !Array.isArray(value) && 'icon' in value ? (({ icon: _icon, ...rest }) => rest)(value) : value));
const listSize = (composed, path) => composed.items.find((item) => item.path === path).text.fontSize;
const dropped = (composed) => composed.diagnostics.filter((entry) => entry.code === 'icon-dropped');

test('four metrics with icons in two rows: no chip meets another metric', async () => {
  const metric = (value, label, icon, unit) => ({ metric: { value, label, icon, ...(unit ? { unit } : {}) } });
  const document = {
    ...deck({ layout: 'metrics', title: 'One season on the water, and farms are re-ordering', blocks: [metric('412', 'Wet tons harvested', 'lucide:scale', 't'), metric('11', 'Farms under contract', 'lucide:map-pin'), metric('$640K', 'Annualized revenue', 'lucide:trending-up'), metric('9 of 11', 'Farms renewed', 'lucide:repeat')] }, { theme: 'bold', colorScheme: 'forest-green', fontScheme: 'georgia', footer: { start: { text: 'Kelpwright' }, end: { text: '{{slide.number}}' } } }),
  };
  const composed = await compose(document);
  assert.equal(composed.icons.length, 4);
  assert.equal(dropped(composed).length, 0);
  const metrics = composed.items.filter((item) => item.field === 'metric');
  for (const icon of composed.icons) {
    const top = icon.chip.cy - icon.chip.radius, bottom = icon.chip.cy + icon.chip.radius, left = icon.chip.cx - icon.chip.radius, right = icon.chip.cx + icon.chip.radius;
    for (const item of metrics) {
      if (icon.owner === item.path) continue;
      for (const part of item.metricLayout.parts.filter((entry) => entry.visible && entry.fit)) {
        const meets = part.box.y < bottom && part.box.y + part.box.height > top && part.box.x < right && part.box.x + part.box.width > left;
        assert.ok(!meets, `${icon.path} meets ${item.path} ${part.role}`);
      }
    }
  }
  // The rows are spaced evenly with their chips: the space between the upper row's foot and the lower row's chips is the space under
  // the lower row (before, it was that space less the chip band, so on a full body the chips met the labels above).
  const rowOf = (paths) => {
    const parts = metrics.filter((item) => paths.includes(item.path)).flatMap((item) => item.metricLayout.parts.filter((part) => part.visible && part.fit).map((part) => part.box));
    const chips = composed.icons.filter((icon) => paths.includes(icon.owner)).map((icon) => icon.chip.cy - icon.chip.radius);
    return [Math.min(...chips, ...parts.map((box) => box.y)), Math.max(...parts.map((box) => box.y + box.height))];
  };
  const upper = rowOf(metrics.slice(0, 2).map((item) => item.path)), lower = rowOf(metrics.slice(2).map((item) => item.path));
  const areaBottom = Math.max(...metrics.map((item) => item.box.y + item.box.height));
  const between = lower[0] - upper[1], below = areaBottom - lower[1];
  assert.ok(between > 0 && Math.abs(between - below) < 1.5, `between ${between}, below ${below}`);
  // The values keep the size they have without the icons' spacing.
  const plain = await compose(withoutIcons(document));
  const value = (result) => result.items.filter((item) => item.field === 'metric').map((item) => item.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize);
  assert.deepEqual(value(composed), value(plain));
});

test('icons in a block placed in a cell are drawn and walked', async () => {
  const slide = { title: 'Promoted regions', blocks: [{ region: 'start', items: [{ text: 'Activations up', icon: 'lucide:trending-up' }, { text: 'Five cities live', icon: 'lucide:map-pin' }, { text: 'Support ready', icon: 'lucide:life-buoy' }] }, { region: 'center+end', chart: { type: 'column', data: { columns: ['Month', 'Cards'], rows: [['Jan', 10], ['Feb', 14], ['Mar', 22], ['Apr', 31]] } } }] };
  assert.deepEqual(documentIcons(slide).map((found) => found.path), ['slide.blocks.0.items.0.icon', 'slide.blocks.0.items.1.icon', 'slide.blocks.0.items.2.icon']);
  const composed = await compose(deck(slide));
  assert.deepEqual(composed.icons.map((icon) => icon.path), ['slides.0.blocks.0.items.0.icon', 'slides.0.blocks.0.items.1.icon', 'slides.0.blocks.0.items.2.icon']);
  assert.equal(dropped(composed).length, 0);
  assert.equal(listSize(composed, 'slides.0.blocks.0.items'), listSize(await compose(withoutIcons(deck(slide))), 'slides.0.blocks.0.items'));
});

const relay = { diagram: { syntax: 'dot', source: 'digraph relay {\n rankdir=LR\n node [shape=box, style=rounded]\n Gateway -> Queue\n Queue -> Workers\n Workers -> Ledger\n}' } };
const points = [{ text: 'Fast acknowledgment', icon: 'lucide:zap' }, { text: 'Scale on queue depth', icon: 'lucide:layers' }, { text: 'Append-only ledger', icon: 'lucide:book' }];

test('icons on a list in a weighted column draw on compact chips where they cost no size', async () => {
  const document = deck({ title: 'Weighted column', composition: { mode: 'column', weights: [2, 1] }, blocks: [relay, { items: points }] });
  const composed = await compose(document);
  assert.equal(composed.icons.length, 3);
  assert.equal(dropped(composed).length, 0);
  assert.equal(listSize(composed, 'slides.0.blocks.1.items'), listSize(await compose(withoutIcons(document)), 'slides.0.blocks.1.items'));
});

test('icons with no room are reported with what bounds the block, and the text keeps the size it has without them', async () => {
  const document = deck({ title: 'Thin weighted column', composition: { mode: 'column', weights: [4, 1] }, blocks: [relay, { items: points }] });
  const composed = await compose(document);
  assert.equal((composed.icons ?? []).length, 0);
  assert.deepEqual(dropped(composed).map((entry) => entry.path), points.map((_, index) => `slides.0.blocks.1.items.${index}.icon`));
  assert.match(dropped(composed)[0].message, /composition\.weights/);
  assert.equal(listSize(composed, 'slides.0.blocks.1.items'), listSize(await compose(withoutIcons(document)), 'slides.0.blocks.1.items'));
});
