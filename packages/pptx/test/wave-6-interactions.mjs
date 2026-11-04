// Layout harvest wave 6 in the PPTX export, where two wave 6 features meet and the integration decided.
// LH-146 with LH-134: a numeral beside a ruled row (a takeaway or an agenda row) is, like a step badge's numeral, an en-US run in a
// right-to-left deck, so PowerPoint draws it in the bold body face and not in the complex-script face of the deck language; a
// left-to-right deck writes no run language of its own.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const deck = language => ({
  name: 'Wave 6',
  language,
  slides: [
    {layout: 'list', title: language === 'ar' ? 'ثلاثة أمور للتذكر' : 'Three things to remember', blocks: [{region: 'body', numbering: 'arabic', items: (language === 'ar'
      ? [['خفض الفرز التراكم بنسبة 41%', 'استفادت الحسابات المميزة أكثر.'], ['الإعداد الموجه قلص وقت القيمة', 'من 21 يومًا إلى 9.'], ['التسعير الإقليمي يضيف 2.1 مليون', 'منطقتان تتأخران عن المنافسين.']]
      : [['Triage cut the backlog by 41%', 'Premium accounts gained the most.'], ['Guided setup halved time to value', 'From 21 days to 9.'], ['Regional pricing adds $2.1M', 'Two regions trail competitors.']]).map(([text, description]) => ({text, description}))}]},
    {layout: 'agenda', title: language === 'ar' ? 'جدول الأعمال' : 'Today’s agenda', blocks: [{items: (language === 'ar'
      ? [['أين نقف', 'نتائج تسعة أشهر'], ['ما الذي تغير', 'العوامل وراء الأرقام'], ['الخطة', 'ثلاث رهانات']]
      : [['Where we stand', 'Results from nine months'], ['What changed', 'The drivers behind the numbers'], ['The plan', 'Three bets']]).map(([text, description]) => ({text, description}))}]},
  ],
});
const numerals = async language => {
  const files = unzipSync(await toPptx(deck(language), {catalogs: [gallery]}));
  return [1, 2].map(index => [...strFromU8(files[`ppt/slides/slide${index}.xml`]).matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF steps [^"]* numeral \d+"[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape));
};
const arabic = await numerals('ar'), english = await numerals('en-US');
let checks = 0;
for (const [index, shapes] of arabic.entries()) {
  assert.ok(shapes.length >= 3, `Arabic slide ${index + 1} draws its numerals as text boxes`);
  for (const shape of shapes) assert.match(shape, /<a:rPr lang="en-US" altLang="en-US"[^>]*b="1"[\s\S]*?<a:t>\d+<\/a:t>/, `Arabic slide ${index + 1}: the numeral is an en-US run`);
  checks += 1 + shapes.length;
}
for (const [index, shapes] of english.entries()) {
  assert.ok(shapes.length >= 3, `English slide ${index + 1} draws its numerals as text boxes`);
  for (const shape of shapes) assert.doesNotMatch(shape, /altLang/, `English slide ${index + 1}: no run language of its own`);
  checks += 1 + shapes.length;
}
console.log(`wave 6 interactions passed: ${checks} checks (numerals beside ruled rows are en-US runs in a right-to-left deck).`);
