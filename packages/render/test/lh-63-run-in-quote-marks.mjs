import assert from 'node:assert/strict';
import {defaultCatalog, resolvePresentation, toSvg} from './catalog-harness.mjs';

// LH-63, LH-78: the preview draws a text's run-in heading in bold (core's runs) and a quote card's decorative mark where core placed it,
// in a text of its own inside the quote's group, in the primary color against the card (the text color where it falls under 4.5:1), left to
// right and right to left.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const chart = {chart: {type: 'column', data: {columns: ['Quarter', 'Pilot', 'Baseline'], rows: [['Q1', 19, 16], ['Q2', 23, 18], ['Q3', 26, 20], ['Q4', 30, 22]]}}};
const quotes = {
  'en-US': {text: 'The rollout took six weeks, not six months, and every store manager was using it by the second Monday.', attribution: 'Sofia Brandt', role: 'Head of procurement'},
  ar: {text: 'تم الإطلاق في ستة أسابيع وليس ستة أشهر، وكان كل مدير متجر يستخدمه بحلول الاثنين الثاني.', attribution: 'سلمى الحداد', role: 'رئيسة المشتريات'},
};
const texts = {
  'en-US': ['Option A: focused pilot\nTwo teams, six weeks. Low setup cost and a clear baseline against which to read the result.', 'Option B: broad rollout\nAll teams, three months. Wider reach with greater coordination needs.'],
  ar: ['الخيار أ: تجربة مركزة\nفريقان لمدة ستة أسابيع. تكلفة إعداد منخفضة وخط أساس واضح لقراءة النتيجة.', 'الخيار ب: إطلاق واسع\nكل الفرق لمدة ثلاثة أشهر. انتشار أوسع مع حاجة أكبر إلى التنسيق.'],
};
// A right-to-left line wraps its text in direction isolates (U+2066 to U+2069): the words are what is inside them.
const plain = (text) => text.replace(/[\u2066-\u2069\u200E\u200F]/g, '');
let checked = 0;
for (const language of ['en-US', 'ar']) {
  const deck = {name: 'Run-in and marks', language, design: {fontScheme: 'roboto'}, slides: [
    {title: 'Signal trend', blocks: [chart, {quote: quotes[language]}]},
    {title: 'Two options', blocks: texts[language].map((text) => ({text}))},
  ]};
  const svgs = toSvg(deck, {trace: true, catalogs: [defaultCatalog]});
  const bound = resolvePresentation(deck, {catalogs: [defaultCatalog]}).slides;
  const card = bound[0].geometry.items.find((item) => item.quoteLayout && item.frameBox), mark = card?.quoteLayout.mark;
  assert.ok(mark, `${language}: a quote card with a mark`);
  const group = svgs[0].match(/<g data-opf-quote-mark="true"[^>]*>([\s\S]*?)<\/g>/);
  assert.ok(group, `${language}: the mark is drawn`);
  const glyph = [...group[1].matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, a, text]) => ({...attrs(a), text}));
  assert.equal(glyph.length, 1, `${language}: one glyph`);
  assert.equal(plain(glyph[0].text), mark.text);
  assert.equal(glyph[0]['font-weight'], '700');
  assert.equal(Number(glyph[0]['font-size']), Number(mark.fit.fontSize.toFixed(3)), `${language}: at the size core fitted`);
  assert.ok([bound[0].design.colors.primary, bound[0].design.colors.text].map((hex) => hex.toUpperCase()).includes(glyph[0].fill.toUpperCase()), `${language}: the primary color, or the text color where the primary reads under 4.5:1 on the card`);
  // The heading line of a text is a bold run (a tspan), its body regular: core's runs, drawn. (The last of two texts is LH-06's band, which draws as written.)
  const headings = bound[1].geometry.items.filter((item) => item.field === 'text' && item.runs).map((item) => item.runs[0].text);
  assert.ok(headings.length >= 1 && headings.every((text, index) => text === texts[language][index].split('\n')[0]), `${language}: core's runs`);
  const spans = [...svgs[1].matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)].map(([, a, text]) => ({...attrs(a), text}));
  for (const heading of headings) assert.equal(spans.find((entry) => plain(entry.text) === heading)?.['font-weight'], '700', `${language}: ${heading} is bold in the preview`);
  assert.ok(spans.some((entry) => entry['font-weight'] === '400' && /\S/.test(plain(entry.text))), `${language}: the body is regular`);
  checked++;
}
assert.equal(checked, 2);
console.log('lh-63 run-in headings and lh-78 quote marks in the preview: ok');
