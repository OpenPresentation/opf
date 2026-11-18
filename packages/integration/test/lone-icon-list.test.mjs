// A lone list of labels with descriptions and icons, slide 2 of a deck Claude wrote through the OPF MCP tools from the first prompt
// ("ten-slide pitch deck about a fictional meal-planning app"): with the fonts the engines draw, `opf validate` reported every icon
// `opf/icon-dropped` ("no room for its chip without setting text smaller") on a slide with plenty of room. The lone block's growth (LH-48,
// fillLoneBlock) measured the list with its chip column, which took a line from its descriptions, so the list filled LONE_FILL at its role
// size and did not grow, while the same list without icons grew a step to its display size; the guard then dropped the chips as costing
// that step. The chips are drawing, as a badge list's badges are: the list now grows as it would without them, as long as it fits with them.
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
const compose = async (document) => {
  await ensureIcons(document, { catalogs });
  const context = resolveSlideContext(document, 0, { catalogs, fonts });
  return composeSlide(context.slide, context.options);
};
const listSize = (composed) => composed.items.find((item) => item.field === 'items').text.fontSize;

test('a lone list of labeled entries with icons draws its chips at the size the list has without them', async () => {
  const document = structuredClone(original);
  const composed = await compose(document), plain = await compose(withoutIcons(structuredClone(original)));
  assert.equal(composed.icons.length, 3);
  assert.deepEqual(composed.diagnostics.filter((entry) => ['icon-dropped', 'text-overflow'].includes(entry.code)), []);
  assert.equal(listSize(composed), listSize(plain), 'the chips cost the list no size');
  assert.ok(listSize(plain) > 32, 'the list grows past its role size');
  const report = validate(document, { catalogs, fonts });
  assert.deepEqual(report.findings.filter((finding) => finding.ruleId === 'opf/icon-dropped').map((finding) => finding.path), []);
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
