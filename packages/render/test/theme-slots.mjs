// FF-49 / FF-50: the preview resolves the East Asian and complex-script slots from the same selections opf-pptx writes into
// the theme's major/minor a:ea and a:cs (core docs script-font-model.md, "Language contract" and "Theme slots"). opf-pptx
// writes a theme slot only where a script font is selected (the scheme's or the language's) and leaves it empty otherwise,
// as Office does; the preview needs a face for every slot, so its slot is the selected script font where the theme names
// one and the latin family where the theme is empty.
// A language never changes the latin slot. The preview draws a slot's family first and the designated open
// replacement after it; the PPTX keeps the selected name. Offline and deterministic; no fonts are loaded.
import assert from 'node:assert/strict';
import {catalogs} from '@openpresentation/opf';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {resolvePresentation, renderSlideSvg} from '../dist/index.js';

const scheme = id => catalogs.fontSchemes.find(record => record.id === id);
const profileOf = presentation => resolvePresentation(structuredClone(presentation)).slides[0].scriptFonts.profile;
const doc = (fontScheme, language, text = 'Text') => ({name: 'Theme slots', ...(language === undefined ? {} : {language}), design: {fontScheme}, slides: [{title: text, text}]});

// The four-row rule, derived from the catalogs (not from the resolver's own `sources`):
// 1 explicit slot on the design scheme, 2 the design scheme's own family when its languageFamily is the slot and it
// serves the language, 3 the language's script font when the language's script uses the slot, 4 the latin family.
const SLOT = {eastAsian: 'ea', complexScript: 'cs'};
const languageNames = record => new Set([record.name.toLowerCase(), record.name.split(' (')[0].toLowerCase()]);
function expected(designId, languageId) {
  const design = scheme(designId), language = catalogs.languages.find(record => record.id === languageId);
  const languageFont = scheme(language.fontScheme);
  const resolved = resolveScriptFonts({language: languageId, design: {fontScheme: designId}});
  const out = {};
  for (const [role, latin] of [['heading', design.major], ['body', design.minor]]) {
    out[role] = {latin};
    for (const [slot, family] of Object.entries(SLOT)) {
      const serves = design.languageFamily === family && (!design.languages?.length || design.languages.some(name => languageNames(language).has(name.toLowerCase())));
      const languageUses = resolved.scriptRole === slot;
      out[role][slot] = serves ? design[role === 'heading' ? 'major' : 'minor'] : languageUses ? languageFont[role === 'heading' ? 'major' : 'minor'] : latin;
    }
  }
  return out;
}

// 1. Every catalog font scheme in the default language: all three slots are the scheme's own families, never empty.
for (const record of catalogs.fontSchemes) {
  const profile = profileOf(doc(record.id));
  assert.deepEqual(profile.heading, {latin: record.major, eastAsian: record.major, complexScript: record.major}, `${record.id} heading slots`);
  assert.deepEqual(profile.body, {latin: record.minor, eastAsian: record.minor, complexScript: record.minor}, `${record.id} body slots`);
}

// 2. Schemes x languages: the documented rule, the latin slot untouched, no empty slot.
const languageIds = ['english-us', 'french', 'russian', 'greek', 'armenian', 'georgian', 'amharic', 'japanese', 'chinese-simplified',
  'chinese-traditional', 'korean', 'arabic', 'hebrew', 'persian', 'hindi', 'bengali', 'tamil', 'thai', 'khmer'];
let combinations = 0;
for (const designId of ['aptos', 'calibri', 'georgia', 'meiryo', 'arabic-typesetting', 'mangal', 'noto-sans-jp']) {
  for (const languageId of languageIds) {
    const profile = profileOf(doc(designId, languageId)), want = expected(designId, languageId), label = `${designId} + ${languageId}`;
    assert.deepEqual(profile.heading, want.heading, `${label} heading slots`);
    assert.deepEqual(profile.body, want.body, `${label} body slots`);
    assert.equal(profile.heading.latin, scheme(designId).major, `${label}: the language never replaces the latin scheme`);
    for (const slots of [profile.heading, profile.body]) for (const value of Object.values(slots)) assert.ok(value, `${label}: no empty slot`);
    combinations += 1;
  }
}

// 3. A slot an explicit design scheme sets wins, and the other slot still repeats latin.
{
  const explicit = {id: 'aptos', eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}};
  const profile = profileOf({name: 'Explicit', language: 'english-us', design: {fontScheme: explicit}, slides: [{title: 'T'}]});
  assert.deepEqual(profile.heading, {latin: 'Aptos Display', eastAsian: 'Noto Sans JP', complexScript: 'Aptos Display'});
  assert.deepEqual(profile.body, {latin: 'Aptos', eastAsian: 'Noto Sans JP', complexScript: 'Aptos'});
}

// 4. What the preview draws: a run's first family is the slot's family, then the designated open replacement. The
// slot's family is the selected name (never the replacement) and the fallback chain follows it.
const families = svg => [...new Set([...svg.matchAll(/font-family="([^"]*)"/g)].map(match => match[1]))];
const chain = (designId, languageId, text) => families(renderSlideSvg(doc(designId, languageId, text), 0));
assert.ok(chain('aptos', 'japanese', '日本語のテキスト').includes('Meiryo, Noto Sans JP, Noto Serif JP, sans-serif'), 'Japanese text: Meiryo, then the open replacement');
// RR-38: Arabic Typesetting carries a preview size multiplier measured on its replacement, so the run names that replacement first (the face a
// registry resolves it to) and not the selected name: a host with the real font installed would otherwise draw it at the reduced size.
assert.ok(chain('aptos', 'arabic', 'مرحبا بالعالم').includes('Noto Naskh Arabic, Noto Sans Arabic, sans-serif'), 'Arabic text: the multiplier-measured replacement, then the designated faces');
assert.ok(chain('calibri', 'hebrew', 'שלום עולם').includes('David, Noto Sans Hebrew, Noto Serif Hebrew, sans-serif'), 'Hebrew text: David, then the open replacement');
assert.ok(chain('aptos', 'hindi', 'नमस्ते दुनिया').includes('Mangal, Noto Sans Devanagari, Noto Serif Devanagari, sans-serif'), 'Hindi text: Mangal, then the open replacement');
// Japanese text in a Latin-language deck: the ea slot repeats the latin family, then the script fallback.
assert.ok(chain('aptos', 'english-us', '日本語のテキスト').includes('Aptos Display, Noto Sans JP, Noto Serif JP, sans-serif'), 'Latin deck: the ea slot repeats latin, then the script fallback');
// A Latin sentence keeps the latin family in every language.
for (const languageId of ['japanese', 'arabic', 'thai']) {
  assert.ok(chain('calibri', languageId, 'Plain Latin text').every(family => family.startsWith('Calibri, ')), `${languageId}: Latin text keeps the scheme`);
}

console.log(JSON.stringify({test: 'theme-slots', passed: true, fontSchemes: catalogs.fontSchemes.length, combinations}));
