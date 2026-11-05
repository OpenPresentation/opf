// Wave 7 of the layout harvest, where its features meet (the integration's decisions), left to right and right to left:
// - LH-155 with LH-158: the closing stack over a picture is placed by LH-158's scores (one mechanism), textPlacement picks its anchor.
// - LH-09 with LH-155: a closing is never a statement message; LH-09's statement title rule stays under LH-155's guarded `title-rule`.
// - LH-09 with LH-05: a lone short text is a display message, a grid of short texts a compact grid; neither undoes the other.
// - LH-132 with LH-74: a team's pictures are portraits or avatars, never a picture that fills its card.
// - LH-14 with LH-132, LH-69, LH-05, LH-157 and LH-09: icons never cost text size (portraits win over a person's group chip, a lone
//   label's rule starts at its word, grids, metric rows and a lone metric keep the sizes they have without icons).
// - LH-14 with LH-94: icons take the theme's primary, not a chart series color.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const { layouts } = gallery;
const SET = { name: 'Brand', license: 'MIT', copyright: 'Copyright (c) 2026 Example', viewBox: [0, 0, 24, 24], style: 'stroke', strokeWidth: 2, icons: { star: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z', dot: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z' } };
const iconless = (value) => Array.isArray(value) ? value.map(iconless) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'icon').map(([key, entry]) => [key, iconless(entry)])) : value;
const deckOf = (slide, language) => ({ name: 'Wave 7', language, catalogs: { custom: { iconSets: { brand: SET } } }, slides: [slide] });
const compose = (deck) => { const context = resolveSlideContext(deck, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
// Every text size of a composition: paragraphs and lists (and a list's first entry, its display word), and each visible metric part.
const sizes = (result) => result.items.flatMap((item) => [
  ...(item.text ? [[item.path, item.text.fontSize], ...(item.text.listEntries ? [[`${item.path}#0`, item.text.listEntries[0].text.fontSize]] : [])] : []),
  ...(item.metricLayout ? item.metricLayout.parts.filter((part) => part.fit && part.visible !== false).map((part) => [`${item.path}#${part.role}`, part.fit.fontSize]) : []),
]);
const field = (result, name) => result.items.find((item) => item.field === name);
const face = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="100" height="140"><rect width="100" height="140" fill="#eee"/><circle cx="50" cy="56" r="22" fill="#a76"/></svg>').toString('base64')}`;
const PHOTO = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#101820"/></svg>').toString('base64')}`;
// A measured picture: dark and calm, or with its lower half busy.
const grid = (lower) => {
  const columns = 32, rows = 18, values = new Float32Array(columns * rows), high = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const busy = lower === 'busy' && row >= rows / 2, value = busy && (row + column) % 2 ? 0.6 : 0.004;
    values[row * columns + column] = value; high[row * columns + column] = busy ? 0.6 : 0.006;
  }
  return { columns, rows, values, high };
};

const TEXT = {
  en: { thanks: 'Start your free pilot this month', contact: 'Write to hello@northwind.example or book a walkthrough.', names: ['Amara Okafor', 'Daniel Reyes', 'Mei Tanaka', 'Samuel Adeyemi'], role: 'Chief executive', label: 'Owner', name: 'Sam Lee', description: 'Product lead', point: 'Fewer bad Mondays.', principles: ['Ship small', 'Measure first', 'Talk to users', 'Write it down'] },
  ar: { thanks: 'ابدأ تجربتك المجانية هذا الشهر', contact: 'راسلنا على البريد أو احجز جولة تعريفية.', names: ['أمارا أوكافور', 'دانيال رييس', 'مي تاناكا', 'صموئيل أديمي'], role: 'الرئيس التنفيذي', label: 'المسؤول', name: 'سام لي', description: 'قائد المنتج', point: 'أيام اثنين سيئة أقل.', principles: ['اشحن قليلا', 'قس أولا', 'تحدث مع المستخدمين', 'دوّن ذلك'] },
};

for (const [language, text] of Object.entries(TEXT)) {
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  test(`LH-155 with LH-158 (${direction}): the closing stack over a picture is placed by the picture-text scores`, () => {
    const slide = (placement) => ({ title: text.thanks, blocks: [{ region: 'details', text: text.contact }], design: { background: { type: 'image', src: PHOTO, tone: 'dark', ...(placement ? { textPlacement: placement } : {}) } } });
    const at = (extra, placement) => composeSlide(slide(placement), { layout: layouts.closing, direction, darkBackground: true, ...extra });
    const calm = at({ pictureLuminance: () => grid('calm') }), busy = at({ pictureLuminance: () => grid('busy') }), estimated = at({}), authored = at({}, 'top-start');
    const top = (result) => field(result, 'title').box.y;
    assert.equal(calm.pictureText.anchor, 'bottom', 'a calm picture keeps the low stack');
    assert.equal(busy.pictureText.anchor, 'top', 'a busy lower half sends the stack to the calm top');
    assert.ok(busy.pictureText.candidates.find((candidate) => candidate.anchor === 'top').reads);
    assert.equal(busy.pictureText.panel, undefined, 'a stack has no panel');
    assert.equal(estimated.pictureText, undefined, 'nothing measured, nothing scored');
    assert.ok(top(busy) < top(estimated) && top(estimated) < top(calm), 'top, middle (unmeasured), bottom');
    assert.equal(authored.pictureText.source, 'authored');
    assert.equal(top(authored), top(busy), "the author's textPlacement picks the anchor");
    for (const result of [calm, busy, estimated, authored]) {
      assert.equal(field(result, 'title').alignment, 'left', 'the stack keeps its start alignment');
      assert.ok(result.titleRule, 'and its rule');
    }
  });

  test(`LH-09 with LH-155 (${direction}): a closing is never a statement message; a statement keeps its rule only where it costs nothing`, () => {
    const closing = composeSlide({ title: text.thanks, blocks: [{ region: 'details', text: text.contact }] }, { layout: layouts.closing, direction });
    const contact = closing.items.find((item) => item.field === 'text');
    assert.ok(contact.text.fontSize < 56, `the contact line is no display message (${contact.text.fontSize})`);
    assert.ok(field(closing, 'title').text.fontSize >= 70 && closing.titleRule, 'the closing keeps its display title and rule');
    const statement = composeSlide({ title: `${text.thanks}.`, blocks: [{ text: text.contact }] }, { layout: layouts.statement, direction });
    assert.ok(statement.titleRule, 'a statement title over its paragraph is drawn under the rule');
  });

  test(`LH-09 with LH-05 (${direction}): a lone short text is a display message, a grid of short texts hugs`, () => {
    const lone = compose(deckOf({ title: text.label, blocks: [{ text: text.point }] }, language));
    const grown = lone.items.find((item) => item.field === 'text');
    assert.ok(grown.text.fontSize >= 56, `display size (${grown.text.fontSize})`);
    const grid = compose(deckOf({ title: text.label, blocks: text.principles.map((entry) => ({ text: entry })) }, language));
    const cells = grid.items.filter((item) => item.field === 'text');
    assert.equal(new Set(cells.map((cell) => cell.text.fontSize)).size, 1, 'one size across the grid');
    assert.ok(cells[0].text.fontSize < grown.text.fontSize + 1e-6, 'no sibling reads louder than a lone message');
    const rows = [...new Set(cells.map((cell) => Math.round(cell.box.y)))].sort((a, b) => a - b);
    assert.ok(rows.length === 2 && rows[1] - (rows[0] + cells[0].box.height) < 0.5 * grid.contentBox.height, 'the rows hug');
  });

  test(`LH-132 with LH-74 and LH-14 (${direction}): a team's pictures are portraits, and its group icons never cost the text`, () => {
    const person = (name, index, extra = {}) => ({ region: 'people', composition: { mode: 'column' }, ...extra, blocks: [{ image: { src: face, alt: name }, shape: 'circle' }, { items: [{ text: name, description: text.role }] }] });
    const team = (extra, first) => compose(deckOf({ layout: 'team', title: text.label, blocks: text.names.map((name, index) => index === 0 && first ? first(name) : person(name, index, extra)) }, language));
    const portraits = team({});
    assert.ok(portraits.items.filter((item) => item.image).every((item) => item.image.shape.kind === 'rounded'), 'portraits on the person cards');
    // An authored rectangle keeps its shape and focus: LH-74 does not make it fill a card.
    const own = team({}, (name) => ({ ...person(name, 0), blocks: [{ image: { src: face, alt: name }, shape: 'rectangle', focus: { x: 0.2, y: 0.1 } }, person(name, 0).blocks[1]] }));
    const first = own.items.find((item) => item.image);
    assert.equal(first.image.shape.kind, 'rectangle');
    assert.deepEqual(first.image.focus, { x: 0.2, y: 0.1 });
    // Group icons on people: the portraits stay, the chips are reported, no text is smaller than without the icons.
    const iconned = team({ icon: 'brand:star' });
    assert.deepEqual(sizes(iconned), sizes(portraits));
    assert.equal(iconned.icons, undefined);
    assert.equal(iconned.diagnostics.filter((entry) => entry.code === 'icon-dropped').length, text.names.length);
    // LH-74 still fills a card with a lone picture that is no person.
    const pictures = compose(deckOf({ layout: 'team', title: text.label, blocks: text.names.slice(0, 3).map((name) => ({ region: 'people', image: { src: face, alt: name }, fit: 'cover' })) }, language));
    assert.ok(pictures.items.filter((item) => item.image).every((item) => item.image.shape.kind === 'rounded' && !item.frameBox));
  });

  test(`LH-69 with LH-14 (${direction}): a lone label with an icon keeps its display word, the rule starts at the word`, () => {
    const slide = { title: text.label, items: [{ text: text.name, description: text.description, icon: 'brand:star' }] };
    const result = compose(deckOf(slide, language)), plain = compose(deckOf(iconless(slide), language));
    assert.deepEqual(sizes(result), sizes(plain), 'the icon costs no size');
    const list = field(result, 'items'), entry = list.text.listEntries[0], [rule] = list.text.rules;
    assert.equal(result.icons.length, 1);
    const start = direction === 'rtl' ? entry.textBox.x + entry.textBox.width - rule.width : entry.textBox.x;
    assert.ok(Math.abs(rule.x - start) < 1, `the rule starts at the word (${rule.x} vs ${start})`);
    const [plainRule] = field(plain, 'items').text.rules, plainList = field(plain, 'items');
    assert.ok(Math.abs((direction === 'rtl' ? plainRule.x + plainRule.width : plainRule.x) - (direction === 'rtl' ? plainList.box.x + plainList.box.width : plainList.box.x)) < 1, 'without a chip the rule starts at the box edge');
  });

  test(`LH-14 with LH-05, LH-157, LH-09 and LH-94 (${direction}): icons keep every size; their colors are the theme's`, () => {
    const slides = [
      { title: text.label, blocks: text.principles.map((entry, index) => ({ items: [{ text: entry, icon: index % 2 ? 'brand:dot' : 'brand:star' }] })) },
      { title: text.label, blocks: [{ metric: { value: 54, unit: 'ms', label: text.principles[0], icon: 'brand:star' } }, { metric: { value: 4.8, unit: 'k', label: text.principles[1], icon: 'brand:dot' } }, { metric: { value: 120, unit: 'GB', label: text.principles[2], icon: 'brand:star' } }] },
      { layout: 'statement', title: text.label, blocks: [{ metric: { value: '14', unit: 'months', label: text.description, icon: 'brand:star' } }] },
      { title: text.label, blocks: [{ metric: { value: 98, unit: '%', label: text.principles[0], icon: 'brand:star' } }, { chart: { type: 'column', categories: ['Q1', 'Q2', 'Q3'], series: [{ name: 'A', values: [3, 5, 4] }, { name: 'B', values: [2, 3, 6] }, { name: 'C', values: [4, 1, 2] }] } }] },
    ];
    for (const [index, slide] of slides.entries()) {
      const result = compose(deckOf(slide, language)), plain = compose(deckOf(iconless(slide), language));
      assert.deepEqual(sizes(result), sizes(plain), `slide ${index}: no text smaller or larger with icons`);
      assert.ok(result.icons?.length, `slide ${index}: icons drawn`);
      for (const icon of result.icons) assert.equal(icon.colors.chip.role, 'primary', `slide ${index}: the chip is the theme's primary`);
      const metrics = result.items.filter((item) => item.metricLayout?.parts.some((part) => part.role === 'value'));
      if (metrics.length > 1) assert.equal(new Set(metrics.map((item) => item.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize)).size, 1, 'the metric row shares one value size (LH-157)');
    }
  });
}
