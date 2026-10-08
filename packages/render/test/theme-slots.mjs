// FF-49 / FF-50: the preview resolves the East Asian and complex-script slots from the same selections opf-pptx writes into
// the theme's major/minor a:ea and a:cs (core docs script-font-model.md, "Language contract" and "Theme slots"). opf-pptx
// writes a theme slot only where a script font is selected (the scheme's or the language's) and leaves it empty otherwise,
// as Office does; the preview needs a face for every slot, so its slot is the selected script font where the theme names
// one and the latin family where the theme is empty.
// OPF 0.15: `language` is a BCP-47 tag. A language's script, direction and default script fonts come from core's engine
// language vocabulary (`LANGUAGES`, `fonts.powerpoint` for PowerPoint), not from a catalog; font schemes are gallery records,
// so the documents render with the host catalog registered. A font scheme's `languages` lists the BCP-47 tags it serves.
// A language never changes the latin slot. The preview draws a slot's family first and the designated open
// replacement after it; the PPTX keeps the selected name. Offline and deterministic; no fonts are loaded.
import assert from 'node:assert/strict';
import {LANGUAGES, resolveScriptFonts, scriptFontRole} from '@openpresentation/opf/composition';
import {catalogs, defaultCatalog, resolvePresentation, renderSlideSvg} from './catalog-harness.mjs';

const fontSchemes = defaultCatalog.fontSchemes;
const scheme = id => fontSchemes[id];
const vocabulary = tag => LANGUAGES.find(entry => entry.tag === tag);
const profileOf = presentation => resolvePresentation(structuredClone(presentation)).slides[0].scriptFonts.profile;
const doc = (fontScheme, language, text = 'Text') => ({name: 'Theme slots', ...(language === undefined ? {} : {language}), design: {fontScheme}, slides: [{title: text, text}]});

// The four-row rule, derived from the gallery records and the language vocabulary (not from the resolver's own `sources`):
// 1 explicit slot on the design scheme, 2 the design scheme's own family when its languageFamily is the slot and it
// serves the language, 3 the language's script font when the language's script uses the slot, 4 the latin family.
const SLOT = {eastAsian: 'ea', complexScript: 'cs'};
const subtags = tag => tag.split('-');
// A scheme serves a language when its `languages` list is empty, or an entry has the language's language subtag and, when the
// entry names a script (`pa-Guru`), the language's script.
const serves = (design, language) => !design.languages?.length || design.languages.some(entry => {
  const [primary, ...rest] = subtags(entry), script = rest.find(part => /^[A-Za-z]{4}$/.test(part));
  return primary.toLowerCase() === subtags(language.tag)[0].toLowerCase() && (!script || script === language.script);
});
function expected(designId, tag) {
  const design = scheme(designId), language = vocabulary(tag);
  assert.ok(design && language, `${designId} is a gallery font scheme and ${tag} a vocabulary language`);
  const languageFont = language.fonts.powerpoint, languageRole = scriptFontRole(language.script);
  const out = {};
  for (const [role, latin] of [['heading', design.major], ['body', design.minor]]) {
    out[role] = {latin};
    for (const [slot, family] of Object.entries(SLOT)) {
      const own = design.languageFamily === family && serves(design, language);
      out[role][slot] = own ? design[role === 'heading' ? 'major' : 'minor'] : languageRole === slot ? languageFont[role === 'heading' ? 'major' : 'minor'] : latin;
    }
  }
  return out;
}

// 1. Every gallery font scheme in the default language: all three slots are the scheme's own families, never empty.
for (const [id, record] of Object.entries(fontSchemes)) {
  const profile = profileOf(doc(id));
  assert.deepEqual(profile.heading, {latin: record.major, eastAsian: record.major, complexScript: record.major}, `${id} heading slots`);
  assert.deepEqual(profile.body, {latin: record.minor, eastAsian: record.minor, complexScript: record.minor}, `${id} body slots`);
}

// 2. Schemes x languages: the documented rule, the latin slot untouched, no empty slot; the language's script and direction are
// the vocabulary's.
const languageTags = ['en-US', 'fr', 'ru', 'el', 'hy', 'ka', 'am', 'ja', 'zh-Hans', 'zh-Hant', 'ko', 'ar', 'he', 'fa', 'hi', 'bn', 'ta', 'th', 'km'];
let combinations = 0;
for (const designId of ['aptos', 'calibri', 'georgia', 'meiryo', 'arabic-typesetting', 'mangal', 'noto-sans-jp']) {
  for (const tag of languageTags) {
    const profile = profileOf(doc(designId, tag)), want = expected(designId, tag), label = `${designId} + ${tag}`;
    assert.deepEqual(profile.heading, want.heading, `${label} heading slots`);
    assert.deepEqual(profile.body, want.body, `${label} body slots`);
    assert.equal(profile.heading.latin, scheme(designId).major, `${label}: the language never replaces the latin scheme`);
    for (const slots of [profile.heading, profile.body]) for (const value of Object.values(slots)) assert.ok(value, `${label}: no empty slot`);
    const language = vocabulary(tag), core = resolveScriptFonts(doc(designId, tag), {catalogs});
    assert.deepEqual([core.bcp47, core.script, core.direction], [tag, language.script, language.direction], `${label}: tag, script and direction from the vocabulary`);
    assert.deepEqual([core.heading, core.body], [profile.heading, profile.body], `${label}: the preview profile is core's`);
    combinations += 1;
  }
}

// 3. A slot an explicit design scheme sets wins, and the other slot still repeats latin.
{
  const explicit = {id: 'aptos', eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}};
  const profile = profileOf({name: 'Explicit', language: 'en-US', design: {fontScheme: explicit}, slides: [{title: 'T'}]});
  assert.deepEqual(profile.heading, {latin: 'Aptos Display', eastAsian: 'Noto Sans JP', complexScript: 'Aptos Display'});
  assert.deepEqual(profile.body, {latin: 'Aptos', eastAsian: 'Noto Sans JP', complexScript: 'Aptos'});
}

// 4. What the preview draws: a run's first family is the slot's family, then the designated open replacement. The
// slot's family is the selected name (never the replacement) and the fallback chain follows it.
const families = svg => [...new Set([...svg.matchAll(/font-family="([^"]*)"/g)].map(match => match[1]))];
const chain = (designId, tag, text) => families(renderSlideSvg(doc(designId, tag, text), 0));
assert.ok(chain('aptos', 'ja', '日本語のテキスト').includes('Meiryo, Noto Sans JP, Noto Serif JP, sans-serif'), 'Japanese text: Meiryo, then the open replacement');
// RR-38: Arabic Typesetting carries a preview size multiplier measured on its replacement, so the run names that replacement first (the face a
// registry resolves it to) and not the selected name: a host with the real font installed would otherwise draw it at the reduced size.
assert.ok(chain('aptos', 'ar', 'مرحبا بالعالم').includes('Noto Naskh Arabic, Noto Sans Arabic, sans-serif'), 'Arabic text: the multiplier-measured replacement, then the designated faces');
assert.ok(chain('calibri', 'he', 'שלום עולם').includes('David, Noto Sans Hebrew, Noto Serif Hebrew, sans-serif'), 'Hebrew text: David, then the open replacement');
assert.ok(chain('aptos', 'hi', 'नमस्ते दुनिया').includes('Mangal, Noto Sans Devanagari, Noto Serif Devanagari, sans-serif'), 'Hindi text: Mangal, then the open replacement');
// Japanese text in a Latin-language deck: the ea slot repeats the latin family, then the script fallback.
assert.ok(chain('aptos', 'en-US', '日本語のテキスト').includes('Aptos Display, Noto Sans JP, Noto Serif JP, sans-serif'), 'Latin deck: the ea slot repeats latin, then the script fallback');
// A Latin sentence keeps the latin family in every language.
for (const tag of ['ja', 'ar', 'th']) {
  assert.ok(chain('calibri', tag, 'Plain Latin text').every(family => family.startsWith('Calibri, ')), `${tag}: Latin text keeps the scheme`);
}

console.log(JSON.stringify({test: 'theme-slots', passed: true, fontSchemes: Object.keys(fontSchemes).length, combinations}));
