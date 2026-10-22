// opf-render#125: a measurement is a function of its inputs, never of what the same process measured or drew before.
// fontkit caches one glyph object per glyph id with the code points of the call that created it, and its layout read the
// input's code points back from that cache. Bounding an outline that holds Bengali ra (U+09B0, a composite drawn with the nukta
// glyph U+09BC as a component) cached the nukta glyph with no code points, so every later run with a nukta was shaped as a
// broken cluster with a dotted circle: 'আয় বেড়েছে কিন্তু খরচ অপরিবর্তিত' at 25 px measured 380.4 instead of 354.9, and the
// font-switch matrix drew it 367.65 or 354.9 wide depending on the decks rendered before it. The registry's faces now hand
// every glyph request the code points it asked for (font-registry.js pinGlyphCodePoints).
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';
import { loadFonts } from '../dist/fonts-node.js';

const BODY = 'আয় বেড়েছে কিন্তু খরচ অপরিবর্তিত';
const bengali = { fontFamily: 'Noto Sans Bengali', fontWeight: 400 };
const fresh = async () => loadFonts({ pack: 'base', scripts: ['Beng', 'Deva', 'Taml', 'Arab', 'Thai', 'Khmr'] });

// 1. The trigger sequence in one process equals isolated runs. 354.9 is the width HarfBuzz (a browser's shaper) gives the
// string in Noto Sans Bengali 400 at 25 px, and the width a fresh process measured before and after the fix.
const isolated = (await fresh()).registry.textMeasurement.measure(BODY, 25, bengali);
assert.equal(isolated, 354.9, 'a fresh registry measures the Bengali body at the browser width');
const triggers = [
  ['outline bounds of ra', m => m.outlineBounds('র', 25, bengali)],
  ['outline bounds of a title with ra', m => m.outlineBounds('ত্রৈমাসিক পর্যালোচনা', 25, bengali)],
  ['outline bounds of bold ra', m => m.outlineBounds('র', 25, { ...bengali, fontWeight: 700 })],
  ['a measure of other Bengali text', m => m.measure('খরচ স্থির রয়েছে', 25, bengali)],
];
const shared = (await fresh()).registry.textMeasurement;
for (const [label, trigger] of triggers) {
  const { registry } = await fresh();
  trigger(registry.textMeasurement);
  assert.equal(registry.textMeasurement.measure(BODY, 25, bengali), isolated, `after ${label}, the body measures as in a fresh process`);
  trigger(shared);
}
assert.equal(shared.measure(BODY, 25, bengali), isolated, 'after every trigger in one registry, the body measures as in a fresh process');
// The outline bounds are as pure as the advance: bounding the body after the triggers equals bounding it in a fresh registry.
assert.deepEqual(shared.outlineBounds(BODY, 25, bengali), (await fresh()).registry.textMeasurement.outlineBounds(BODY, 25, bengali), 'the body ink box does not depend on earlier measurement');

// 2. Script decks rendered in different orders draw the same SVG as each deck rendered alone. The Bengali decks put ra in a
// title (bounded for the cover's ink box) and a nukta in the body, the pair that broke pairwise-50; the others cover the
// Indic, Arabic, Thai and Khmer shapers.
const deck = (language, title, text, bullets) => ({
  $schema: 'https://openpresentation.org/schema/opf/v1', name: `Determinism ${language}`, language, design: { fontScheme: 'roboto' },
  slides: [{ title, subtitle: text }, { title, text }, { title, bullets }],
});
const decks = {
  'bn-title': deck('bn', 'ত্রৈমাসিক পর্যালোচনা', 'ফলাফল ও পরবর্তী পদক্ষেপ', ['আয় বৃদ্ধি', 'খরচ স্থির', 'মার্জিন উন্নত']),
  'bn-body': deck('bn', 'আয় বেড়েছে', BODY, ['বেড়েছে', 'নয়া দিগন্ত', 'আয়']),
  hi: deck('hi', 'त्रैमासिक समीक्षा', 'राजस्व बढ़ा जबकि लागत स्थिर रही', ['ज़रूरी फ़ैसला', 'लागत स्थिर', 'मार्जिन बेहतर']),
  ta: deck('ta', 'காலாண்டு மதிப்பாய்வு', 'வருவாய் உயர்ந்தது செலவுகள் மாறவில்லை', ['வருவாய் உயர்வு', 'செலவு நிலையானது', 'இலாபம் மேம்பட்டது']),
  ar: deck('ar', 'مراجعة ربع سنوية', 'ارتفعت الإيرادات بينما بقيت التكاليف ثابتة', ['ارتفاع الإيرادات', 'ثبات التكاليف', 'تحسن الهامش']),
  th: deck('th', 'ทบทวนรายไตรมาส', 'รายได้เพิ่มขึ้นขณะที่ต้นทุนคงที่', ['รายได้เพิ่มขึ้น', 'ต้นทุนคงที่', 'อัตรากำไรดีขึ้น']),
  km: deck('km', 'ការពិនិត្យប្រចាំត្រីមាស', 'ប្រាក់ចំណូលកើនឡើង ខណៈចំណាយនៅដដែល', ['ចំណូលកើន', 'ចំណាយថេរ', 'ប្រាក់ចំណេញប្រសើរ']),
};
const names = Object.keys(decks);
const render = (fonts, name) => toSvg(structuredClone(decks[name]), { fonts }).join('\0');
const alone = {};
for (const name of names) alone[name] = render(await fresh(), name);
assert.ok(alone['bn-body'].includes('textLength="354.9"'), 'the Bengali body is drawn at its browser width');
for (const [label, order] of [['in order', names], ['in reverse', [...names].reverse()], ['interleaved', names.filter((_, index) => index % 2).concat(names.filter((_, index) => !(index % 2)))]]) {
  const fonts = await fresh();
  for (const name of order) assert.equal(render(fonts, name), alone[name], `${name} rendered ${label} after ${order.slice(0, order.indexOf(name)).join(', ') || 'nothing'} equals ${name} rendered alone`);
  // A second pass over warm caches draws the same again.
  for (const name of order) assert.equal(render(fonts, name), alone[name], `${name} rendered again ${label} equals ${name} rendered alone`);
}
console.log(`Measurement determinism passed: ${triggers.length} trigger sequences leave the Bengali body at ${isolated} px, ${names.length} script decks render alike alone, in order, in reverse and interleaved.`);
