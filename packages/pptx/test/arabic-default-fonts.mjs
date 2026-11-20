// v0.35: an Arabic, Persian or Urdu deck that chooses no script font exports PowerPoint's Office theme fonts for the Arabic script:
// Times New Roman in the theme's major complex-script slot and Arab entry, Arial in the minor ones (it wrote Arabic Typesetting).
// The PPTX names the fonts the document chose and writes the composed size: the preview's script multiplier never reaches it.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const catalogs = [gallery];
const files = async presentation => {
  const entries = unzipSync(new Uint8Array(await toPptx(presentation, {catalogs})));
  return Object.fromEntries(Object.entries(entries).filter(([name]) => name.endsWith('.xml')).map(([name, value]) => [name, strFromU8(value)]));
};
const themeFonts = (xml, tag) => {
  const block = xml['ppt/theme/theme1.xml'].match(new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`))[0];
  return {cs: block.match(/<a:cs typeface="([^"]*)"/)[1], arab: block.match(/<a:font script="Arab" typeface="([^"]*)"/)?.[1]};
};
const slideXml = xml => Object.entries(xml).filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([, value]) => value).join('');
const sizes = xml => [...slideXml(xml).matchAll(/<a:rPr\b[^>]*\ssz="(\d+)"/g)].map(match => Number(match[1]));
const named = xml => new Set([...slideXml(xml).matchAll(/<a:(?:latin|ea|cs)\s+typeface="([^"]*)"/g)].map(match => match[1]));

const sample = {
  ar: ['خطة الإطلاق للربع القادم', 'نراجع اليوم نتائج الربع الثالث'],
  fa: ['برنامه عرضه در فصل آینده', 'امروز نتایج فصل سوم را بررسی می‌کنیم'],
  ur: ['اگلی سہ ماہی کا منصوبہ', 'آج ہم تیسری سہ ماہی کے نتائج دیکھیں گے'],
};
for (const [language, [title, text]] of Object.entries(sample)) {
  const deck = (extra = {}) => ({name: `Default ${language}`, language, ...extra, slides: [{title, text: [`${text} `, {text: 'Acme Cloud 2.0', bold: true}]}]});
  const xml = await files(deck());
  assert.deepEqual(themeFonts(xml, 'majorFont'), {cs: 'Times New Roman', arab: 'Times New Roman'}, `${language}: major complex-script slot and Arab entry`);
  assert.deepEqual(themeFonts(xml, 'minorFont'), {cs: 'Arial', arab: 'Arial'}, `${language}: minor complex-script slot and Arab entry`);
  // No run names the replacement that previews it, or the former default.
  for (const family of ['Noto Naskh Arabic', 'Noto Sans Arabic', 'Arabic Typesetting']) assert.ok(!named(xml).has(family), `${language}: ${family} is not written`);
  assert.ok(!xml['ppt/theme/theme1.xml'].includes('Arabic Typesetting'), `${language}: the theme no longer names Arabic Typesetting`);
  // The composed size: the same as a deck whose Arabic font is the open face itself (no multiplier anywhere), run for run.
  const control = await files(deck({language: {bcp47: language, fontScheme: 'noto-naksh-arabic'}}));
  assert.ok(sizes(xml).length >= 2, `${language}: runs carry sizes`);
  assert.deepEqual(sizes(xml), sizes(control), `${language}: run sizes are the composed sizes`);
  assert.deepEqual(themeFonts(control, 'minorFont'), {cs: 'Noto Naskh Arabic', arab: 'Noto Naskh Arabic'});
}

// Arabic Typesetting stays a choice: a deck that names it gets it, in both slots.
const chosen = await files({name: 'Chosen', language: 'ar', design: {fontScheme: 'arabic-typesetting'}, slides: [{title: sample.ar[0], text: sample.ar[1]}]});
assert.deepEqual([themeFonts(chosen, 'majorFont').cs, themeFonts(chosen, 'minorFont').cs], ['Arabic Typesetting', 'Arabic Typesetting']);

console.log(JSON.stringify({test: 'arabic-default-fonts', passed: true}));
