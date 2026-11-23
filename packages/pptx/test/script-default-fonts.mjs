// v0.35: a deck that only names its language exports the script default that ships with Windows: Nirmala UI for the Indic scripts,
// Leelawadee UI for Thai and Khmer, Segoe UI for Hebrew, Ebrima for Amharic, Yu Gothic for Japanese, and Times New Roman with Arial
// for Pashto and Punjabi (Shahmukhi) as for Arabic. The theme names the family in the script's slot and in its script entry. The
// open face that previews it and the font of the earlier default are never written.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const catalogs = [gallery];
const files = async presentation => {
  const entries = unzipSync(new Uint8Array(await toPptx(presentation, {catalogs})));
  return Object.fromEntries(Object.entries(entries).filter(([name]) => name.endsWith('.xml')).map(([name, value]) => [name, strFromU8(value)]));
};
const themeFonts = (xml, tag, script) => {
  const block = xml['ppt/theme/theme1.xml'].match(new RegExp(`<a:${tag}>[\\s\\S]*?</a:${tag}>`))[0];
  return {ea: block.match(/<a:ea typeface="([^"]*)"/)[1], cs: block.match(/<a:cs typeface="([^"]*)"/)[1], entry: block.match(new RegExp(`<a:font script="${script}" typeface="([^"]*)"`))?.[1]};
};
const slideXml = xml => Object.entries(xml).filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([, value]) => value).join('');
const named = xml => new Set([...slideXml(xml).matchAll(/<a:(?:latin|ea|cs)\s+typeface="([^"]*)"/g)].map(match => match[1]));

/** [language, the theme's script entry, the slot the family fills (none for a script of the Latin slot), heading, body, the earlier default, a title] */
const DEFAULTS = [
  ['hi', 'Deva', 'cs', 'Nirmala UI', 'Nirmala UI', 'Mangal', 'तीसरी तिमाही के नतीजे'],
  ['bn', 'Beng', 'cs', 'Nirmala UI', 'Nirmala UI', 'Shonar Bangla', 'তৃতীয় প্রান্তিকের ফলাফল'],
  ['gu', 'Gujr', 'cs', 'Nirmala UI', 'Nirmala UI', 'Shruti', 'ત્રીજા ત્રિમાસિકના પરિણામો'],
  ['pa-Guru', 'Guru', 'cs', 'Nirmala UI', 'Nirmala UI', 'Raavi', 'ਤੀਜੀ ਤਿਮਾਹੀ ਦੇ ਨਤੀਜੇ'],
  ['kn', 'Knda', 'cs', 'Nirmala UI', 'Nirmala UI', 'Tunga', 'ಮೂರನೇ ತ್ರೈಮಾಸಿಕದ ಫಲಿತಾಂಶಗಳು'],
  ['ml', 'Mlym', 'cs', 'Nirmala UI', 'Nirmala UI', 'Kartika', 'മൂന്നാം പാദത്തിലെ ഫലങ്ങൾ'],
  ['or', 'Orya', 'cs', 'Nirmala UI', 'Nirmala UI', 'Kalinga', 'ତୃତୀୟ ତ୍ରୈମାସିକର ଫଳାଫଳ'],
  ['ta', 'Taml', 'cs', 'Nirmala UI', 'Nirmala UI', 'Latha', 'மூன்றாம் காலாண்டு முடிவுகள்'],
  ['te', 'Telu', 'cs', 'Nirmala UI', 'Nirmala UI', 'Gautami', 'మూడవ త్రైమాసిక ఫలితాలు'],
  ['th', 'Thai', 'cs', 'Leelawadee UI', 'Leelawadee UI', 'Angsana New', 'ผลประกอบการไตรมาสที่สาม'],
  ['km', 'Khmr', 'cs', 'Leelawadee UI', 'Leelawadee UI', 'DaunPenh', 'លទ្ធផលត្រីមាសទីបី'],
  ['he', 'Hebr', 'cs', 'Segoe UI', 'Segoe UI', 'David', 'תוצאות הרבעון השלישי'],
  ['am', 'Ethi', undefined, 'Ebrima', 'Ebrima', 'Nyala', 'የሦስተኛው ሩብ ዓመት ውጤቶች'],
  ['ja', 'Jpan', 'ea', 'Yu Gothic', 'Yu Gothic', 'Meiryo', '第3四半期の業績'],
  ['ps', 'Arab', 'cs', 'Times New Roman', 'Arial', 'Arial Black', 'د دریمې ربعې پایلې'],
  ['pa-Arab', 'Arab', 'cs', 'Times New Roman', 'Arial', 'Arial Black', 'تیجی تماہی دے نتیجے'],
];
const OPEN = /^Noto (?:Sans|Serif|Naskh|Nastaliq)\b/;
for (const [language, script, slot, heading, body, earlier, title] of DEFAULTS) {
  const xml = await files({name: `Default ${language}`, language, slides: [{title, text: [`${title} `, {text: 'Acme Cloud 2.0', bold: true}]}]});
  const major = themeFonts(xml, 'majorFont', script), minor = themeFonts(xml, 'minorFont', script);
  assert.deepEqual([major.entry, minor.entry], [heading, body], `${language}: the ${script} theme entries`);
  if (slot) assert.deepEqual([major[slot], minor[slot]], [heading, body], `${language}: the ${slot} slots`);
  // Neither an open preview face nor the earlier default is written, in the theme or on a run.
  const theme = xml['ppt/theme/theme1.xml'];
  assert.ok(!theme.includes(`typeface="${earlier}"`), `${language}: the theme no longer names ${earlier}`);
  for (const family of named(xml)) assert.ok(!OPEN.test(family) && family !== earlier, `${language}: a run names ${family}`);
  assert.doesNotMatch(theme, /typeface="Noto /, `${language}: the theme names no open preview face`);
}

// The fonts of the earlier defaults stay a choice: a deck that names the scheme gets it.
for (const [language, fontScheme, script, family] of [['hi', 'mangal', 'Deva', 'Mangal'], ['th', 'angsana-new', 'Thai', 'Angsana New'], ['ja', 'meiryo', 'Jpan', 'Meiryo']]) {
  const chosen = await files({name: 'Chosen', language, design: {fontScheme}, slides: [{title: 'x', text: 'y'}]});
  assert.equal(themeFonts(chosen, 'minorFont', script).entry, family, `${language}: ${fontScheme}`);
}

console.log(JSON.stringify({test: 'script-default-fonts', passed: true, defaults: DEFAULTS.length}));
