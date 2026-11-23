// v0.35: the default font of every script ships with Windows (Nirmala UI for the Indic scripts, Leelawadee UI for Thai and Khmer,
// Segoe UI for Hebrew, Ebrima for Amharic, Yu Gothic for Japanese). None is bundled: each script's runs are measured and drawn with
// the open face the policy names for that script, at its measured multiplier. A script replacement (`replacement.scripts`) takes the
// family's place for runs of that script; Devanagari and Thai are their rows' own replacements. Ethiopic has no slot of its own, so
// its multiplier comes from the theme entry's family. Offline and deterministic.
import assert from 'node:assert/strict';
import {catalogs, toSvg} from './catalog-harness.mjs';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {loadFonts} from '../dist/fonts-node.js';
import {adjustedFontSize, createScriptFonts, fontPolicyFor, lineAscentFor, sizeAdjustFor} from '../dist/fonts.js';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

/** [language, script, the family the deck names, the open face that draws it, the multiplier, a sentence] */
const DEFAULTS = [
  ['hi', 'Deva', 'Nirmala UI', 'Noto Sans Devanagari', 1.07, 'आज हम तीसरी तिमाही के नतीजों की समीक्षा करेंगे'],
  ['bn', 'Beng', 'Nirmala UI', 'Noto Sans Bengali', 1.08, 'আজ আমরা তৃতীয় প্রান্তিকের ফলাফল পর্যালোচনা করব'],
  ['gu', 'Gujr', 'Nirmala UI', 'Noto Sans Gujarati', 1.13, 'આજે આપણે ત્રીજા ત્રિમાસિકના પરિણામોની સમીક્ષા કરીશું'],
  ['pa-Guru', 'Guru', 'Nirmala UI', 'Noto Sans Gurmukhi', 1.08, 'ਅੱਜ ਅਸੀਂ ਤੀਜੀ ਤਿਮਾਹੀ ਦੇ ਨਤੀਜਿਆਂ ਦੀ ਸਮੀਖਿਆ ਕਰਾਂਗੇ'],
  ['kn', 'Knda', 'Nirmala UI', 'Noto Sans Kannada', 1.17, 'ಇಂದು ನಾವು ಮೂರನೇ ತ್ರೈಮಾಸಿಕದ ಫಲಿತಾಂಶಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇವೆ'],
  ['ml', 'Mlym', 'Nirmala UI', 'Noto Sans Malayalam', 1.13, 'ഇന്ന് നമ്മൾ മൂന്നാം പാദത്തിലെ ഫലങ്ങൾ അവലോകനം ചെയ്യും'],
  ['or', 'Orya', 'Nirmala UI', 'Noto Sans Oriya', 0.98, 'ଆଜି ଆମେ ତୃତୀୟ ତ୍ରୈମାସିକର ଫଳାଫଳ ସମୀକ୍ଷା କରିବା'],
  ['ta', 'Taml', 'Nirmala UI', 'Noto Sans Tamil', 1.04, 'இன்று நாம் மூன்றாம் காலாண்டு முடிவுகளை மதிப்பாய்வு செய்வோம்'],
  ['te', 'Telu', 'Nirmala UI', 'Noto Sans Telugu', 1.17, 'ఈ రోజు మనం మూడవ త్రైమాసిక ఫలితాలను సమీక్షిస్తాము'],
  ['th', 'Thai', 'Leelawadee UI', 'Noto Sans Thai', 0.96, 'วันนี้เราจะทบทวนผลประกอบการไตรมาสที่สาม'],
  ['km', 'Khmr', 'Leelawadee UI', 'Noto Sans Khmer', 1.19, 'ថ្ងៃនេះ យើងនឹងពិនិត្យលទ្ធផលត្រីមាសទីបី'],
  ['he', 'Hebr', 'Segoe UI', 'Noto Sans Hebrew', 1.03, 'היום נסקור את תוצאות הרבעון השלישי'],
  ['am', 'Ethi', 'Ebrima', 'Noto Sans Ethiopic', 1.06, 'ዛሬ የሦስተኛውን ሩብ ዓመት ውጤቶች እንገመግማለን'],
];

// 1. The policy: each multiplier applies to runs of its script drawn in its open face, and to nothing else.
for (const [language, script, family, face, adjust] of DEFAULTS) {
  assert.equal(sizeAdjustFor(family, face, script), adjust, `${language}: ${family} draws ${script} with ${face}`);
  assert.equal(sizeAdjustFor(family, 'Noto Sans', script), undefined, `${language}: not on another face`);
  if (fontPolicyFor(family).replacement.scripts?.[script]) {
    assert.equal(sizeAdjustFor(family, face), undefined, `${language}: a script replacement is not for a run of another script`);
    assert.equal(lineAscentFor(family, face, script), undefined, `${language}: no native baseline was measured for it`);
  }
}
// Nirmala UI's native Devanagari baseline (opf#361) stays with Devanagari: a Bengali run in the same family does not take it.
assert.ok(lineAscentFor('Nirmala UI', 'Noto Sans Devanagari', 'Deva'));
assert.equal(lineAscentFor('Nirmala UI', 'Noto Sans Bengali', 'Beng'), undefined);
// Latin text in Segoe UI and Ebrima keeps their own replacements, at the composed size.
for (const family of ['Segoe UI', 'Ebrima']) assert.equal(sizeAdjustFor(family, fontPolicyFor(family).replacement.family), undefined, family);

// 2. The default: a deck that only names its language plans its script's runs in the open face at the multiplier, with no real font
// in the stack, and the Latin words beside them in the Latin face at their own size.
const deck = (language, text) => ({name: 'v0.35', language, slides: [{id: 'a', title: text, text}]});
for (const [language, script, family, face, adjust, text] of DEFAULTS) {
  const profile = resolveScriptFonts(deck(language, text), {catalogs});
  assert.deepEqual([profile.script, profile.supplement.heading, profile.supplement.body], [script, family, family], language);
  const estimated = createScriptFonts(profile);
  for (const [path, latinFamily] of [['slides.0.title', 'Aptos Display'], ['slides.0.text', 'Aptos']]) {
    const style = {fontFamily: latinFamily, fontWeight: path.endsWith('title') ? 700 : 400, path};
    const plan = estimated.plan(text, style);
    assert.deepEqual([...new Set(plan.map(run => `${run.family} ${run.sizeAdjust}`))], [`${face} ${adjust}`], `${language} ${path}`);
    for (const run of plan) assert.ok(!run.stack.includes(family), `${language}: ${family} never enters the stack`);
  }
  const mixed = estimated.plan(`${text} Acme Cloud`, {fontFamily: 'Aptos', fontWeight: 400, path: 'slides.0.text'});
  assert.deepEqual([mixed[0].family, mixed[0].sizeAdjust], [face, adjust], `${language}: the script run`);
  assert.equal(mixed.at(-1).sizeAdjust, undefined, `${language}: the Latin words keep their size`);
  assert.notEqual(mixed.at(-1).family, face, `${language}: the Latin words keep the Latin face`);
}
// Japanese and the other scripts without a multiplier are planned as before: the family, then its open faces.
{
  const profile = resolveScriptFonts(deck('ja', '本日は第3四半期の業績を確認します'), {catalogs});
  assert.deepEqual([profile.heading.eastAsian, profile.body.eastAsian], ['Yu Gothic', 'Yu Gothic']);
  const [run] = createScriptFonts(profile).plan('本日は業績を確認します', {fontFamily: 'Aptos', fontWeight: 400, path: 'slides.0.text'});
  assert.deepEqual([run.family, run.sizeAdjust, run.stack.slice(0, 2)], ['Yu Gothic', undefined, ['Yu Gothic', 'Noto Sans JP']]);
}
// Armenian and Georgian (Sylfaen has no script replacement) still take the Latin family's row, as before.
{
  const profile = resolveScriptFonts(deck('hy', 'Այսօր մենք կվերանայենք արդյունքները'), {catalogs});
  const [run] = createScriptFonts(profile).plan('Այսօր մենք կվերանայենք', {fontFamily: 'Aptos', fontWeight: 400, path: 'slides.0.text'});
  assert.equal(run.sizeAdjust, undefined);
}

// 3. Measured, in the SVG: three kinds of default (a script replacement, a row's own replacement, a script of the Latin slot) are
// drawn in the open face at the multiplier of the composed size, each line pinned to the width measured at the drawn size, with no
// glyph fallback note for the script.
const drawn = (svg, face) => [...svg.matchAll(/<text\b([^>]*)>([^<]*)</g)].filter(match => match[1].includes(`font-family="${face}`))
  .map(([, tag, content]) => ({size: Number(/font-size="([\d.]+)"/.exec(tag)[1]), length: Number(/textLength="([\d.]+)"/.exec(tag)?.[1]), weight: Number(/font-weight="(\d+)"/.exec(tag)?.[1] ?? 400), text: content.replace(/[⁦-⁩]/g, '')}));
for (const [language, script, , face, adjust, text] of DEFAULTS.filter(([language]) => ['bn', 'th', 'am'].includes(language))) {
  const prepared = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: [script]});
  const diagnostics = [];
  const lines = drawn(toSvg(deck(language, text), {fonts: prepared, onDiagnostic: diagnostic => diagnostics.push(diagnostic)})[0], face);
  assert.ok(lines.length >= 2, `${language}: the title and the body are drawn in ${face} (${lines.length} lines)`);
  const style = {fontFamily: face, lang: language};
  for (const item of lines) near(item.length, prepared.textMeasurement.measure(item.text, item.size, {...style, fontWeight: item.weight}), 0.02, `${language}: textLength at the drawn size ${item.size}`);
  // The measured planner: the run is the open face at the multiplier, and its width is the face's width at the adjusted size.
  const measured = createScriptFonts(resolveScriptFonts(deck(language, text), {catalogs}), prepared.textMeasurement);
  for (const [path, latinFamily, weight] of [['slides.0.title', 'Aptos Display', 700], ['slides.0.text', 'Aptos', 400]]) {
    const own = {fontFamily: latinFamily, fontWeight: weight, path};
    assert.deepEqual([...new Set(measured.plan(text, own).map(run => `${run.family} ${run.sizeAdjust}`))], [`${face} ${adjust}`], `${language} ${path}, measured`);
    near(measured.textMeasurement.measure(text, 50, own), prepared.textMeasurement.measure(text, adjustedFontSize(50, adjust), {...style, fontWeight: weight}), 1e-9, `${language} ${path}: measured at the adjusted size`);
  }
  // A script replacement takes the family's place, so no note says the family's own preview face lacks the script. (Ethiopic is in
  // the Latin slot, whose face has no Ethiopic: that note is as before.)
  if (language !== 'am') assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.code === 'font-glyph-fallback'), [], `${language}: no glyph fallback note`);
}

console.log(JSON.stringify({test: 'script-default-fonts', passed: true, defaults: DEFAULTS.length}));
