// Wave 8 of the layout harvest and phase 1 of the shapes work, where their features meet (the integration's decisions), left to right and
// right to left:
// - LH-169 with LH-165: a figure list whose entries carry icons is a row of figures first; the icon cards are tried on top and win when no
//   text reads smaller (the larger text wins, the cards on a tie). Without icons it stays LH-169's row.
// - LH-18 with LH-165: the cards of a row share their label track, so the row's descriptions start on one line.
// - LH-63 with LH-170: a closing note on the band that opens with a short label draws the label bold inside the band (n18).
// - LH-164 with SH-02: a run color written as { color, lighten } on the message surface is drawn in a color that reads 4.5:1 there.
// - LH-165 on an accent surface: the card neutral keeps the slide's text at 4.5:1 (the mix towards the text stops before it falls under).
// - SH-02 with LH-162: a slide of short shape blocks is never taken by text tiles or icon cards.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { colorContrast, composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const SET = { name: 'Brand', license: 'MIT', copyright: 'Copyright (c) 2026 Example', viewBox: [0, 0, 24, 24], style: 'stroke', strokeWidth: 2, icons: { star: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z', dot: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', box: 'M5 5h14v14H5z' } };
const deckOf = (slide, language) => ({ name: 'Wave 8', language, catalogs: { custom: { iconSets: { brand: SET } } }, slides: [slide] });
const context = (deck) => resolveSlideContext(deck, 0, { catalogs: [gallery] });
const compose = (deck) => { const resolved = context(deck); return composeSlide(resolved.slide, resolved.options); };
const listOf = (result) => result.items.find((item) => item.field === 'items');
const ICONS = ['brand:star', 'brand:dot', 'brand:box'];
const LANGUAGES = [
  { language: 'en-US', rtl: false, title: 'Where the time goes', figures: [['62 minutes a day', 'spent searching for documents'], ['1 in 6 reports', 'sent with an outdated figure'], ['9 days', 'to close the quarter']],
    labels: [['Faster month-end closes', 'Reconcile in hours, not days.'], ['Shared truth', 'Finance, sales and operations read one number.'], ['Audit ready', 'Every change is logged.']] },
  { language: 'ar', rtl: true, title: 'أين يذهب الوقت', figures: [['٦٢ دقيقة يوميًا', 'في البحث عن المستندات'], ['١ من ٦ تقارير', 'تُرسل برقم قديم'], ['٩ أيام', 'لإغلاق الربع']],
    labels: [['إغلاق أسرع لنهاية كل شهر', 'تسوية في ساعات لا أيام.'], ['مصدر واحد', 'المالية والمبيعات والعمليات تقرأ رقمًا واحدًا.'], ['جاهز للتدقيق', 'كل تغيير مسجل.']] },
];

for (const { language, rtl, title, figures, labels } of LANGUAGES) {
  test(`LH-169 with LH-165: a figure list with icons takes the icon cards where its text reads larger (${language})`, () => {
    const entries = (icons) => figures.map(([text, description], index) => ({ text, description, ...(icons ? { icon: ICONS[index] } : {}) }));
    const row = compose(deckOf({ title, blocks: [{ items: entries(false) }] }, language));
    const rowList = listOf(row);
    assert.equal(rowList.listColumns?.length, 3, 'without icons the list is a row of figures');
    assert.ok(rowList.text.listEntries.every((entry) => entry.accent), 'the figures are accent entries');
    const cards = compose(deckOf({ title, blocks: [{ items: entries(true) }] }, language));
    assert.ok(cards.steps?.some((step) => step.form === 'tiles'), 'with icons it draws as icon cards');
    assert.equal(cards.icons?.length, 3, 'every icon is drawn');
    assert.ok(!cards.diagnostics.some((entry) => entry.code === 'icon-dropped'));
    const smallest = (list) => Math.min(...list.text.listEntries.flatMap((entry) => [entry.text.fontSize, entry.description?.fontSize ?? Infinity]));
    assert.ok(smallest(listOf(cards)) >= smallest(rowList) - 0.01, 'the cards set no text smaller than the row');
    const xs = listOf(cards).text.listEntries.map((entry) => entry.textBox.x);
    assert.ok(rtl ? xs[0] > xs[2] : xs[0] < xs[2], 'the cards keep reading order');
  });

  test(`LH-18 with LH-165: the descriptions of a row of icon cards start on one line (${language})`, () => {
    const result = compose(deckOf({ title, blocks: [{ items: labels.map(([text, description], index) => ({ text, description, icon: ICONS[index] })) }] }, language));
    assert.ok(result.steps?.some((step) => step.form === 'tiles'));
    const entries = listOf(result).text.listEntries;
    const heights = entries.map((entry) => entry.textBox.height), tops = entries.map((entry) => entry.descriptionBox.y);
    assert.ok(Math.max(...heights) - Math.min(...heights) > 1, 'one label takes more lines than the others');
    assert.ok(Math.max(...tops) - Math.min(...tops) < 0.5, `the descriptions start together (${tops.map((top) => top.toFixed(1)).join(', ')})`);
  });
}

test('LH-63 with LH-170: the verdict on the band draws its label bold (left to right and right to left)', () => {
  for (const [language, verdict, label] of [['en-US', 'Recommendation: negotiate a two-year term with exit rights before committing.', 'Recommendation:'], ['ar', 'التوصية: التفاوض على عقد لعامين مع حق الخروج قبل الالتزام.', 'التوصية:']]) {
    const side = (name, items) => ({ region: name, composition: { mode: 'column' }, blocks: [{ text: [{ text: name, bold: true }] }, { bullets: items }] });
    const deck = deckOf({ layout: 'comparison', title: 'Moving the warehouse', blocks: [side('first', ['Frees about $3.2M of capital', 'Peak capacity without hiring', 'Operator runs our carriers']), side('second', ['Per-order cost rises about 6%', 'Less control over packing', 'Exit takes six months']), { region: 'verdict', text: verdict }] }, language);
    const result = compose(deck);
    assert.equal(result.emphasis?.source, 'foot-band', `${language}: the verdict is the band`);
    const band = result.items.find((item) => item.emphasis && item.path === `${result.emphasis.path}.text`);
    assert.ok(band.runs, `${language}: the band's text draws runs`);
    assert.deepEqual(band.runs[0], { text: label, bold: true });
    assert.equal(band.runs.map((run) => (typeof run === 'string' ? run : run.text)).join(''), verdict, 'the runs hold every character');
    assert.equal(band.value, verdict, 'the document value is unchanged');
  }
});

test('LH-164 with SH-02: a lighter run color on the message surface is drawn where it reads 4.5:1', () => {
  for (const language of ['en-US', 'ar']) {
    const deck = { name: 'Wave 8', language, slides: [{ blocks: [{ text: ['Ship the pilot in March, ', { text: 'not June', bold: true, color: { color: 'accent1', lighten: 0.2 } }, '.'] }] }] };
    const resolved = context(deck);
    assert.ok(resolved.options.messageSurface, `${language}: the lone message takes the accent surface`);
    const result = composeSlide(resolved.slide, resolved.options);
    const text = result.items.find((item) => item.field === 'text');
    const colored = text.text.richLines.flatMap((line) => line.fragments).map((fragment) => fragment.run?.color).filter((color) => typeof color === 'string' && color.startsWith('#'));
    assert.ok(colored.length > 0, 'the run carries a drawn color');
    const background = resolved.options.roles.background;
    for (const color of colored) assert.ok(colorContrast(color, background) >= 4.5 - 1e-6, `${color} on ${background}`);
  }
});

test('LH-165 on an accent surface: the card keeps the slide text at 4.5:1', () => {
  for (const variant of ['accent1', 'dark1']) {
    const deck = { ...deckOf({ title: 'What the platform gives you', design: { variant }, blocks: [{ items: [['Faster closes', 'Reconcile in hours.'], ['Shared truth', 'One number for every team.'], ['Audit ready', 'Every change is logged.']].map(([text, description], index) => ({ text, description, icon: ICONS[index] })) }] }, 'en-US') };
    const resolved = context(deck), roles = resolved.options.roles;
    const neutrals = resolved.resolved.roles.neutrals;
    const card = neutrals?.card?.hex;
    assert.ok(card, `${variant}: the slide has a card neutral`);
    assert.ok(colorContrast(roles.text, card) >= 4.5 - 1e-6, `${variant}: text ${roles.text} on card ${card} reads ${colorContrast(roles.text, card).toFixed(2)}:1`);
  }
});

test('SH-02 with LH-162 and LH-165: a slide of short shape blocks keeps its shapes', () => {
  for (const [language, words] of [['en-US', ['Plan', 'Build', 'Test', 'Launch']], ['ar', ['خطة', 'بناء', 'اختبار', 'إطلاق']]]) {
    const result = compose(deckOf({ title: 'The four stages', blocks: words.map((text) => ({ shape: 'chevron', text })) }, language));
    assert.equal(result.items.filter((item) => item.field === 'shape').length, 4, `${language}: four shapes`);
    assert.ok(!result.steps?.some((step) => step.form === 'tiles'), `${language}: no tiles or cards`);
  }
});
