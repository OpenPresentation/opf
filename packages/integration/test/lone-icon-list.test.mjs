// A lone list of labels with descriptions and icons, slide 2 of a deck Claude wrote through the OPF MCP tools from the first prompt
// ("ten-slide pitch deck about a fictional meal-planning app"): with the fonts the engines draw, `opf validate` reported every icon
// `opf/icon-dropped` ("no room for its chip without setting text smaller") on a slide with plenty of room. The lone block's growth (LH-48,
// fillLoneBlock) measured the list with its chip column, which took a line from its descriptions, so the list filled LONE_FILL at its role
// size and did not grow, while the same list without icons grew a step to its display size; the guard then dropped the chips as costing
// that step. The chips are drawing, as a badge list's badges are: the list now grows as it would without them, as long as it fits with them.
//
// The slide's direction then chooses how the list is drawn (the owner, 2026-11-18): a row (composition.mode "row", or
// design.contentDirection "horizontal" where no mode is set) or no direction draws LH-165's icon cards side by side; a column ("column",
// or "vertical") draws the ruled rows of the list without icons, each entry's chip at the start of its row (the end in a right-to-left
// deck). A grid is a grid of cards. The choice reads the arrangement composition resolved, so the precedence stays in one place.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { convert, ensureIcons, resolveSlideContext, validate } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '@openpresentation/gallery';
import { galleryIconSets } from '@openpresentation/gallery/icon-sets';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { fromPptx } from '@openpresentation/opf-pptx';

const original = JSON.parse(fs.readFileSync(new URL('./fixtures/lone-icon-list.opf.json', import.meta.url), 'utf8'));
const catalogs = [gallery, galleryIconSets()];
const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: original });
const withoutIcons = (document) => ({ ...document, slides: document.slides.map((slide) => ({ ...slide, items: slide.items.map(({ icon: _icon, ...entry }) => entry) })) });
// The retest deck with its slide given `extra` (a direction setting, a layout).
const directed = (extra) => ({ ...structuredClone(original), slides: original.slides.map((slide) => ({ ...structuredClone(slide), ...extra })) });
const compose = async (document, measured = true) => {
  await ensureIcons(document, { catalogs });
  const context = resolveSlideContext(document, 0, measured ? { catalogs, fonts } : { catalogs });
  return composeSlide(context.slide, context.options);
};
const listOf = (composed) => composed.items.find((item) => item.field === 'items');
const listSize = (composed) => listOf(composed).text.fontSize;
const cardsOf = (composed) => composed.steps?.find((steps) => steps.form === 'tiles');
const dropped = (composed) => composed.diagnostics.filter((entry) => ['icon-dropped', 'text-overflow'].includes(entry.code));
// The drawing of the slide: what each engine reads from a composition (boxes, sizes, chips, cards), without the settings each item carries.
const drawing = (composed) => JSON.stringify({ items: composed.items, icons: composed.icons, steps: composed.steps, recomposed: composed.recomposed }, (key, value) => key === 'composition' ? undefined : value);

const ROW = [['no direction', {}], ['composition.mode row', { composition: { mode: 'row' } }], ['design.contentDirection horizontal', { design: { contentDirection: 'horizontal' } }], ['composition.mode grid', { composition: { mode: 'grid' } }], ['composition.mode auto', { composition: { mode: 'auto' } }], ['composition.mode row over contentDirection vertical', { design: { contentDirection: 'vertical' }, composition: { mode: 'row' } }]];
const COLUMN = [['composition.mode column', { composition: { mode: 'column' } }], ['design.contentDirection vertical', { design: { contentDirection: 'vertical' } }], ['composition.mode column over contentDirection horizontal', { design: { contentDirection: 'horizontal' }, composition: { mode: 'column' } }]];

test('a lone list of labeled entries with icons draws its chips at the size the list has without them', async () => {
  const document = structuredClone(original);
  const composed = await compose(document), plain = await compose(withoutIcons(structuredClone(original)));
  assert.equal(composed.icons.length, 3);
  assert.deepEqual(dropped(composed), []);
  assert.equal(listSize(composed), listSize(plain), 'the chips cost the list no size');
  assert.ok(listSize(plain) > 32, 'the list grows past its role size');
  const report = validate(document, { catalogs, fonts });
  assert.deepEqual(report.findings.filter((finding) => finding.ruleId === 'opf/icon-dropped').map((finding) => finding.path), []);
});

test('a row, a grid or no direction draws icon cards; the slide without a direction draws exactly what a row draws', async () => {
  const unset = await compose(directed({}));
  for (const [label, extra] of ROW) {
    const composed = await compose(directed(extra));
    assert.equal(cardsOf(composed)?.chips.length, 3, `${label}: three icon cards`);
    assert.equal(composed.icons.length, 3, label);
    assert.deepEqual(dropped(composed), [], label);
    assert.equal(drawing(composed), drawing(unset), `${label}: the same cards as the slide without a direction`);
  }
});

test('a column draws ruled rows with each chip at the start of its row, at the size of the rows without icons', async () => {
  for (const [label, extra] of COLUMN) {
    const document = directed(extra);
    const composed = await compose(document), plain = await compose(withoutIcons(directed(extra)));
    assert.equal(cardsOf(composed), undefined, `${label}: no cards`);
    assert.equal(composed.icons.length, 3, `${label}: every icon kept`);
    assert.deepEqual(dropped(composed), [], label);
    const list = listOf(composed), entries = list.text.listEntries;
    assert.equal(list.text.rules?.length, 2, `${label}: ruled rows`);
    assert.equal(listSize(composed), listSize(plain), `${label}: the chips cost the rows no size`);
    assert.ok(listSize(composed) > 32, `${label}: the rows grow past the role size, as the rows without icons do`);
    composed.icons.forEach((icon, index) => {
      const entry = entries[index];
      assert.ok(Math.abs(icon.chip.cx - entry.icon.cx) < .01, `${label}: the chip is the entry's`);
      assert.ok(icon.chip.cx + icon.chip.radius <= entry.textBox.x + .01, `${label}: the chip before the label`);
      assert.ok(entry.textBox.x + entry.textBox.width <= entry.descriptionBox.x + .01, `${label}: the description beside the label`);
    });
    // The rows keep the label column of the plain rows, moved over by the chip column.
    const plainEntries = listOf(plain).text.listEntries;
    assert.ok(Math.abs(entries[0].textBox.width - plainEntries[0].textBox.width) < .5, `${label}: the label column as wide as without icons`);
    const report = validate(document, { catalogs, fonts });
    assert.deepEqual(report.findings.filter((finding) => finding.ruleId === 'opf/icon-dropped').map((finding) => finding.path), [], label);
  }
});

test('right to left: a column puts each chip at the end of its row, a row draws the cards from the right', async () => {
  const arabic = (extra) => ({ name: 'Arabic', language: 'ar', design: { dimensions: '16:9' }, slides: [{ title: 'مشكلة الساعة الخامسة', items: [
    { text: 'إرهاق القرار', description: 'تقضي الأسر أكثر من أربع ساعات أسبوعيًا في تقرير ما تطبخه وتتسوقه.', icon: 'lucide:calendar' },
    { text: 'هدر الطعام', description: 'ترمي الأسرة المتوسطة طعامًا بقيمة 1500 دولار سنويًا تقريبًا.', icon: 'lucide:trash' },
    { text: 'تسوق مكرر', description: 'يعيد الناس شراء ما هو موجود في الثلاجة لأنهم لا يرونه.', icon: 'lucide:shopping-cart' },
  ], ...extra }] });
  // Core's portable measurement: composeSlide with the office pack's measurement has no Arabic face for the default display font.
  const rows = await compose(arabic({ composition: { mode: 'column' } }), false), cards = await compose(arabic({}), false);
  assert.equal(cardsOf(rows), undefined);
  assert.equal(rows.icons.length, 3);
  assert.deepEqual(dropped(rows), []);
  rows.icons.forEach((icon, index) => {
    const entry = listOf(rows).text.listEntries[index];
    assert.ok(icon.chip.cx - icon.chip.radius >= entry.textBox.x + entry.textBox.width - .01, 'the chip after the label, at the right');
    assert.ok(entry.descriptionBox.x + entry.descriptionBox.width <= entry.textBox.x + .01, 'the description to the left of the label');
  });
  assert.equal(cardsOf(cards)?.chips.length, 3);
  const chips = cardsOf(cards).chips.map((chip) => chip.box.x);
  assert.ok(chips[0] > chips[1] && chips[1] > chips[2], 'the first card at the right');
});

test('a layout slide: the direction that arranges the list region chooses; the region\'s own flow does not', async () => {
  assert.equal(cardsOf(await compose(directed({ layout: 'list' })))?.chips.length, 3, 'layout list: the cards');
  assert.equal(cardsOf(await compose(directed({ layout: 'list', composition: { mode: 'row' } })))?.chips.length, 3, 'layout list, mode row: the cards');
  for (const extra of [{ design: { contentDirection: 'vertical' } }, { composition: { mode: 'column' } }]) {
    const composed = await compose(directed({ layout: 'list', ...extra }));
    assert.equal(cardsOf(composed), undefined, `layout list, ${JSON.stringify(extra)}: ruled rows`);
    assert.equal(composed.icons.length, 3);
    assert.deepEqual(dropped(composed), []);
  }
});

test('both engines draw the three chips', async () => {
  const document = structuredClone(original);
  await ensureIcons(document, { catalogs });
  const svg = await convert(document, { format: 'svg', fonts, catalogs, date: '2026-11-18' });
  assert.equal(svg.files.length, 1);
  assert.equal((new TextDecoder().decode(svg.files[0].bytes).match(/<circle/g) ?? []).length, 3, 'three chips in the preview');
  const pptx = await convert(document, { format: 'pptx', fonts, catalogs, date: '2026-11-18' });
  const imported = await fromPptx(pptx.files[0].bytes, { signals: true, catalogs });
  const names = imported.signals.slides[0].shapes.map((shape) => shape.name ?? '');
  for (const index of [0, 1, 2]) assert.ok(names.includes(`OPF icon slides.0.items.${index}.icon chip`), names.join(', '));
});

test('both engines draw the ruled rows with their chips where composition places them, and an import gives the icons back', async () => {
  const document = directed({ composition: { mode: 'column' } });
  await ensureIcons(document, { catalogs });
  const composed = await compose(structuredClone(document));
  const svg = new TextDecoder().decode((await convert(document, { format: 'svg', fonts, catalogs, date: '2026-11-18' })).files[0].bytes);
  const circles = [...svg.matchAll(/<circle\b[^>]*>/g)].map(([tag]) => [Number(/\bcx="([-\d.]+)"/.exec(tag)?.[1]), Number(/\bcy="([-\d.]+)"/.exec(tag)?.[1])]);
  assert.equal(circles.length, 3, 'three chips in the preview');
  for (const [index, icon] of composed.icons.entries()) {
    assert.ok(Math.abs(circles[index][0] - icon.chip.cx) < 1 && Math.abs(circles[index][1] - icon.chip.cy) < 1, `chip ${index} where composition puts it: ${circles[index]} ${icon.chip.cx},${icon.chip.cy}`);
  }
  const pptx = await convert(document, { format: 'pptx', fonts, catalogs, date: '2026-11-18' });
  const imported = await fromPptx(pptx.files[0].bytes, { signals: true, catalogs });
  const shapes = imported.signals.slides[0].shapes, names = shapes.map((shape) => shape.name ?? '');
  assert.ok(!names.some((name) => name.startsWith('OPF steps')), 'no cards');
  assert.equal(names.filter((name) => name.startsWith('OPF list rule')).length, 2, 'the rules between the rows');
  for (const [index, icon] of composed.icons.entries()) {
    const chip = shapes.find((shape) => shape.name === `OPF icon slides.0.items.${index}.icon chip`);
    assert.ok(chip, names.join(', '));
    assert.ok(Math.abs(chip.box.px.x + chip.box.px.w / 2 - icon.chip.cx) < 1 && Math.abs(chip.box.px.y + chip.box.px.h / 2 - icon.chip.cy) < 1, `chip ${index} where composition puts it`);
  }
  assert.deepEqual(imported.presentation.slides[0].items.map((entry) => entry.icon), ['lucide:calendar', 'lucide:trash', 'lucide:shopping-cart']);
});
