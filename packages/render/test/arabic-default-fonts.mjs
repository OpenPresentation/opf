// v0.35: Arabic, Persian and Urdu decks default to Times New Roman (headings) and Arial (body) for the Arabic script, as PowerPoint's
// Office theme does. Neither font is bundled: Arabic-script runs in them are measured and drawn with Noto Naskh Arabic at the policy's
// script multiplier (`replacement.scripts.Arab`: Times New Roman 0.95, Arial 0.96), while Latin text in them keeps Tinos and Arimo
// at the composed size. Also: a run with its own `language` keeps the multiplier when the deck's scheme itself names the Arabic font
// (it was drawn at full size). Offline and deterministic.
import assert from 'node:assert/strict';
import {catalogs, toSvg} from './catalog-harness.mjs';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {loadFonts} from '../dist/fonts-node.js';
import {adjustedFontSize, createScriptFonts, fontPolicyFor, lineAscentFor, sizeAdjustFor} from '../dist/fonts.js';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const HEADING = 0.95, BODY = 0.96;
const TEXT = 'نراجع اليوم نتائج الربع الثالث وخطة العام المقبل';

// 1. The policy: the script replacement applies to Arabic-script runs drawn in Noto Naskh Arabic only.
for (const [family, latin, adjust] of [['Times New Roman', 'Tinos', HEADING], ['Arial', 'Arimo', BODY]]) {
  const row = fontPolicyFor(family);
  assert.equal(sizeAdjustFor(row, 'Noto Naskh Arabic', 'Arab'), adjust, family);
  assert.equal(sizeAdjustFor(family, 'noto naskh arabic', 'Arab'), adjust, `${family}: by name, case-insensitive`);
  assert.equal(sizeAdjustFor(row, 'Noto Naskh Arabic'), undefined, `${family}: not for a run of another script`);
  assert.equal(sizeAdjustFor(row, 'Noto Sans Arabic', 'Arab'), undefined, `${family}: not on another face`);
  assert.equal(sizeAdjustFor(row, latin), undefined, `${family}: Latin text keeps ${latin} at the composed size`);
  assert.equal(sizeAdjustFor(row, latin, 'Latn'), undefined);
  assert.equal(lineAscentFor(row, 'Noto Naskh Arabic', 'Arab'), undefined, `${family}: no native baseline was measured`);
}

const prepared = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: ['Arab']});
const measure = prepared.textMeasurement;
const naskh = {fontFamily: 'Noto Naskh Arabic', fontWeight: 400, lang: 'ar'};
// The registry resolves the families themselves to their Latin replacements, unadjusted.
for (const [family, latin] of [['Times New Roman', 'Tinos'], ['Arial', 'Arimo']]) {
  const resolution = prepared.registry.resolveFont({fontFamily: family, fontWeight: 400});
  assert.deepEqual([resolution.resolvedFamily, resolution.compatibility, resolution.sizeAdjust], [latin, 'metric', undefined], family);
}

// 2. The default: an Arabic deck's complex-script slots name Times New Roman and Arial, and the planner draws their Arabic runs in
// Noto Naskh Arabic at 0.95 and 0.96, measured or not; the Latin run beside them stays in the Latin face at its own size.
const deck = (language, extra = {}) => ({name: 'v0.35', language, ...extra, slides: [{id: 'a', title: TEXT, text: TEXT}]});
for (const language of ['ar', 'fa', 'ur']) {
  const profile = resolveScriptFonts(deck(language), {catalogs});
  assert.deepEqual([profile.heading.complexScript, profile.body.complexScript], ['Times New Roman', 'Arial'], language);
  const measured = createScriptFonts(profile, measure);
  const estimated = createScriptFonts(profile);
  for (const [path, adjust, latinFamily] of [['slides.0.title', HEADING, 'Aptos Display'], ['slides.0.text', BODY, 'Aptos']]) {
    const style = {fontFamily: latinFamily, fontWeight: path.endsWith('title') ? 700 : 400, path};
    assert.deepEqual(measured.plan(TEXT, style).map(run => [run.family, run.sizeAdjust]), [['Noto Naskh Arabic', adjust]], `${language} ${path}`);
    const [run] = estimated.plan(TEXT, style);
    assert.deepEqual([run.family, run.sizeAdjust], ['Noto Naskh Arabic', adjust], `${language} ${path} without a measurement`);
    assert.ok(!run.stack.includes('Arial') && !run.stack.includes('Times New Roman'), 'the real font never enters the stack');
    near(measured.textMeasurement.measure(TEXT, 50, style), measure.measure(TEXT, adjustedFontSize(50, adjust), {...naskh, fontWeight: style.fontWeight}), 1e-9, `${language} ${path}: measured at the adjusted size`);
  }
  const mixed = measured.plan('أطلقنا تطبيق Acme Cloud 2.0 في 14 سوقاً', {fontFamily: 'Aptos', fontWeight: 400, path: 'slides.0.text'});
  assert.deepEqual(mixed.map(run => [run.family, run.sizeAdjust]), [['Noto Naskh Arabic', BODY], ['Intos', undefined], ['Noto Naskh Arabic', BODY]], language);
}

// 3. The SVG of the default Arabic deck: the title's Arabic is drawn at 0.95 and the body's at 0.96 of the composed size, in Noto Naskh
// Arabic, each line pinned to the width the registry measures at the drawn size.
const fontSizes = svg => [...svg.matchAll(/<text\b([^>]*)>([^<]*)</g)].filter(match => /font-family="Noto Naskh Arabic/.test(match[1]))
  .map(([, tag, content]) => ({size: Number(/font-size="([\d.]+)"/.exec(tag)[1]), length: Number(/textLength="([\d.]+)"/.exec(tag)?.[1]), weight: Number(/font-weight="(\d+)"/.exec(tag)?.[1] ?? 400), text: content.replace(/[⁦-⁩]/g, '')}));
{
  // The control deck names the replacement itself, so its drawn sizes are the composed sizes the multiplier scales.
  const control = fontSizes(toSvg(deck('en-US', {design: {fontScheme: 'noto-naksh-arabic'}}), {fonts: prepared})[0]);
  const lines = fontSizes(toSvg(deck('ar'), {fonts: prepared})[0]);
  assert.ok(lines.length >= 2 && lines.length === control.length, `${lines.length} lines`);
  near(lines[0].size, adjustedFontSize(control[0].size, HEADING), 1e-9, 'the title line is drawn at 0.95 of its composed size');
  near(lines.at(-1).size, adjustedFontSize(control.at(-1).size, BODY), 1e-9, 'the body line is drawn at 0.96 of its composed size');
  for (const item of lines) near(item.length, measure.measure(item.text, item.size, {...naskh, fontWeight: item.weight}), 0.02, `textLength at the drawn size ${item.size}`);
}

// 4. Latin text in the Arial and Times New Roman schemes is unchanged: Arimo and Tinos at the composed size, with no Noto face.
for (const [fontScheme, faces] of [['arial', /font-family="(?:Montserrat|Arimo)/], ['times-new-roman', /font-family="Tinos/]]) {
  const svg = toSvg({name: 'Latin', language: 'en-US', design: {fontScheme}, slides: [{id: 'a', title: 'Quarterly review', text: 'Revenue grew twelve percent'}]}, {fonts: prepared})[0];
  assert.match(svg, faces, fontScheme);
  assert.doesNotMatch(svg, /Noto Naskh Arabic|Noto Sans Arabic/, fontScheme);
}

// 5. A run with its own language, in an English deck whose scheme names the Arabic font: the run is drawn at the scheme's multiplier,
// like the deck's other Arabic text. It was drawn at full size: its profile was built from the families the registry draws (the
// replacement, Noto Naskh Arabic, whose own policy row has no multiplier) instead of the families the scheme names.
for (const [fontScheme, adjust] of [['arabic-typesetting', 0.64], ['sakkal-majalla', 0.89]]) {
  const document = {name: 'run language', language: 'en-US', design: {fontScheme}, slides: [{id: 'a', title: 'Plan', text: [{text: TEXT, language: 'ar'}, `\n${TEXT}`]}]};
  // The Arabic pieces only: the Latin title in these schemes is drawn by the same replacement at the composed size.
  const sizes = svg => [...svg.matchAll(/<(?:text|tspan)\b[^>]*font-family="Noto Naskh Arabic[^"]*"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)/g)].filter(match => /[؀-ۿ]/.test(match[2])).map(match => Number(match[1]));
  for (const options of [{fonts: prepared}, {fonts: {embeddedFonts: prepared.embeddedFonts, fontFiles: prepared.fontFiles, useBundledFonts: false}}]) {
    const drawn = sizes(toSvg(document, options)[0]);
    assert.ok(drawn.length >= 2, `${fontScheme}: both Arabic lines are drawn in the replacement`);
    assert.equal(new Set(drawn).size, 1, `${fontScheme}: the ar run and the deck's Arabic line share one drawn size (${drawn.join(', ')})`);
    const composed = drawn[0] / adjust;
    near(drawn[0], adjustedFontSize(composed, adjust), 0.13, `${fontScheme}: drawn at ${adjust}`);
    assert.ok(drawn[0] < 50, `${fontScheme}: not the full composed size`);
  }
}

console.log(JSON.stringify({test: 'arabic-default-fonts', passed: true, heading: HEADING, body: BODY}));
