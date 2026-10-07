// RR-38: the font policy's preview size multiplier (`replacement.sizeAdjust`). Arabic Typesetting is far narrower than the open face that
// previews it (Noto Naskh Arabic: its advances are 0.64 of the replacement's), so the preview drew Arabic lines and glyphs about 1.55 times
// as large as PowerPoint does. The registry, the script planner and the SVG apply the multiplier together: measurement and drawing agree,
// and the exported size and core's composed geometry are unchanged. Offline and deterministic.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {svgToPng, renderSvg} from '../dist/index.js';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {loadFonts} from '../dist/fonts-node.js';
import {FONT_POLICY, adjustedFontSize, baselineShift, createScriptFonts, fontPolicyFor, lineAscentFor, sizeAdjustFor} from '../dist/fonts.js';

const ADJUST = 0.64;
const TEXT = 'نظام تصميم موحد وإعدادات خطوط متسقة لعام 2026';
// The deck tests use words only: a trailing number wraps to a Latin line of its own in the composed title.
const WORDS = 'نظام تصميم موحد وإعدادات خطوط متسقة';
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

// 1. The policy row, and the helper that decides when the multiplier applies.
const row = fontPolicyFor('Arabic Typesetting');
assert.equal(row.replacement.family, 'Noto Naskh Arabic');
assert.equal(row.replacement.compatibility, 'visual');
assert.equal(row.replacement.sizeAdjust, ADJUST);
assert.match(row.replacement.sizeAdjustBasis, /advances/);
assert.deepEqual(FONT_POLICY.families.filter(item => item.replacement?.sizeAdjust !== undefined).map(item => item.family), ['Arabic Typesetting'], 'only Arabic Typesetting carries a multiplier');
assert.equal(sizeAdjustFor(row, 'Noto Naskh Arabic'), ADJUST);
assert.equal(sizeAdjustFor('Arabic Typesetting', 'noto naskh arabic'), ADJUST, 'by family name, case-insensitive');
assert.equal(sizeAdjustFor(row, 'Noto Sans Arabic'), undefined, 'the multiplier was measured on Noto Naskh Arabic only');
assert.equal(sizeAdjustFor(fontPolicyFor('Aptos'), 'Intos'), undefined, 'a metric row has none');
assert.equal(sizeAdjustFor(undefined, 'Noto Naskh Arabic'), undefined);

// The native baseline (RR-38 probe): 0.70 em below the line top for a line in the real font, 0.78 with another font in the line.
assert.deepEqual(lineAscentFor(row, 'Noto Naskh Arabic'), {lineAscent: 0.7, lineAscentMixed: 0.78});
assert.equal(lineAscentFor(row, 'Noto Sans Arabic'), undefined);
assert.equal(lineAscentFor(fontPolicyFor('Aptos'), 'Intos'), undefined);
assert.equal(baselineShift([]), 0);
assert.equal(baselineShift([{text: 'abc'}]), 0, 'a line with no replacement run is untouched');
const arabicRun = {text: 'x', lineAscent: 0.7, lineAscentMixed: 0.78};
near(baselineShift([arabicRun]), 0.3, 1e-9, 'all runs in the replacement: 1 - 0.70');
near(baselineShift([arabicRun], [{text: 'Latin'}]), 0.22, 1e-9, 'with another font in the line: 1 - 0.78');
near(baselineShift([arabicRun], [{text: ''}]), 0.3, 1e-9, 'an empty fragment does not count');

// The drawn size is size x multiplier on a quarter-pixel grid (Chromium on Linux keeps advances within 0.1 px only there), never below 0.25 px.
assert.equal(adjustedFontSize(54, ADJUST), 34.5);
assert.equal(adjustedFontSize(25, ADJUST), 16);
assert.equal(adjustedFontSize(100, ADJUST), 64);
assert.equal(adjustedFontSize(17, ADJUST), 11);
assert.equal(adjustedFontSize(0.1, ADJUST), 0.25);
assert.equal(adjustedFontSize(54, undefined), 54);

// 2. The registry measures the replacement at its adjusted size, for the requested family only.
const prepared = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: ['Arab']});
const registryMeasure = prepared.textMeasurement;
const naskh = {fontFamily: 'Noto Naskh Arabic', fontWeight: 400, lang: 'ar'};
const typesetting = {...naskh, fontFamily: 'Arabic Typesetting'};
const direct = registryMeasure.measure(TEXT, 100, naskh);
near(registryMeasure.measure(TEXT, 100, typesetting) / direct, ADJUST, 1e-9, 'Arabic Typesetting measures at 0.64 of the replacement at the same size');
near(registryMeasure.measure(TEXT, 100, {...typesetting, fontWeight: 700}) / registryMeasure.measure(TEXT, 100, {...naskh, fontWeight: 700}), ADJUST, 1e-9, 'bold');
const ink = registryMeasure.outlineBounds(TEXT, 100, typesetting), plainInk = registryMeasure.outlineBounds(TEXT, 100, naskh);
for (const key of ['x', 'y', 'width', 'height']) near(ink[key], plainInk[key] * ADJUST, 1e-9, `outline ${key} scales with the multiplier`);
assert.equal(prepared.registry.resolveFont(typesetting).sizeAdjust, ADJUST, 'the resolution reports the multiplier');
assert.equal(prepared.registry.resolveFont(typesetting).resolvedFamily, 'Noto Naskh Arabic');
assert.equal(prepared.registry.resolveFont(naskh).sizeAdjust, undefined, 'the replacement itself is never adjusted');
assert.equal(prepared.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400}).sizeAdjust, undefined);
// A caller alias to another face does not inherit a multiplier measured on Noto Naskh Arabic.
const aliased = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: ['Arab'], aliases: {'Arabic Typesetting': 'Noto Sans Arabic'}});
assert.equal(aliased.registry.resolveFont(typesetting).resolvedFamily, 'Noto Sans Arabic');
assert.equal(aliased.registry.resolveFont(typesetting).sizeAdjust, undefined);
near(aliased.textMeasurement.measure(TEXT, 100, typesetting), aliased.textMeasurement.measure(TEXT, 100, {...naskh, fontFamily: 'Noto Sans Arabic'}), 1e-9, 'aliased face measures unadjusted');

// 3. The script planner: runs carry the multiplier, with and without a measurement provider.
const deck = (fontScheme, language, text = WORDS) => ({name: 'RR-38', language, ...(fontScheme ? {design: {fontScheme}} : {}), slides: [{id: 'a', title: text, text}]});
const profileOf = document => resolveScriptFonts(document);
const style = {fontFamily: 'Aptos', fontWeight: 400, path: 'slides.0.text'};
{
  const profile = profileOf(deck(undefined, 'arabic'));
  assert.equal(profile.body.complexScript, 'Arabic Typesetting');
  const measured = createScriptFonts(profile, registryMeasure);
  const runs = measured.plan(TEXT, style);
  assert.deepEqual(runs.map(run => [run.family, run.sizeAdjust]), [['Noto Naskh Arabic', ADJUST]]);
  near(measured.textMeasurement.measure(TEXT, 50, style), registryMeasure.measure(TEXT, 50, naskh) * ADJUST, 1e-9, 'the planned run measures at the adjusted size');
  near(measured.runWidths(runs, 50, style)[0], measured.textMeasurement.measure(TEXT, 50, style), 1e-9, 'runWidths agree');
  const bounds = measured.textMeasurement.outlineBounds(TEXT, 50, style), reference = registryMeasure.outlineBounds(TEXT, 50 * ADJUST, naskh);
  for (const key of ['x', 'y', 'width', 'height']) near(bounds[key], reference[key], 1e-9, `planned outline ${key}`);
  // Arabic with a Latin phrase: only the Arabic run is adjusted, the Latin run keeps its size.
  const mixed = measured.plan('أضاف المنتج PowerPoint أكثر من 50 لغة', style);
  assert.deepEqual(mixed.map(run => [run.family, run.sizeAdjust]), [['Noto Naskh Arabic', ADJUST], ['Intos', undefined], ['Noto Naskh Arabic', ADJUST]]);

  // No measurement provider: the stack names the replacement first and never the real font, and carries the multiplier.
  const estimated = createScriptFonts(profile);
  const [run] = estimated.plan(TEXT, style);
  assert.equal(run.sizeAdjust, ADJUST);
  assert.deepEqual(run.stack, ['Noto Naskh Arabic', 'Noto Sans Arabic']);
  assert.ok(!run.stack.includes('Arabic Typesetting'));
  assert.equal(run.family, 'Noto Naskh Arabic');
}
{
  // The explicit font scheme sets the slot the same way in a Latin-language deck.
  const profile = profileOf(deck('arabic-typesetting', 'english-us'));
  const [run] = createScriptFonts(profile).plan(TEXT, {...style, fontFamily: 'Arabic Typesetting'});
  assert.equal(run.sizeAdjust, ADJUST);
}
{
  // Faces with no measured multiplier are untouched: an Arabic phrase in a Latin deck (the slot repeats Aptos), Hebrew in David.
  const latinDeck = createScriptFonts(profileOf(deck(undefined, 'english-us')));
  const [arabic] = latinDeck.plan(TEXT, style);
  assert.equal(arabic.sizeAdjust, undefined);
  assert.deepEqual(arabic.stack, ['Aptos', 'Noto Sans Arabic', 'Noto Naskh Arabic']);
  const hebrew = createScriptFonts(profileOf(deck('calibri', 'hebrew')));
  const [run] = hebrew.plan('שלום עולם', {...style, fontFamily: 'Calibri'});
  assert.equal(run.sizeAdjust, undefined);
  assert.deepEqual(run.stack, ['David', 'Noto Sans Hebrew', 'Noto Serif Hebrew']);
}

// 4. The SVG: drawn size = composed size x multiplier, in the replacement's own face, measured or not. The control deck names the
// replacement itself (font scheme noto-naksh-arabic, an English deck), so its composed sizes are the ones the multiplier scales.
const fontSizes = svg => [...svg.matchAll(/<text\b[^>]*>/g)].map(match => match[0]).filter(tag => !/font-family="(?:Aptos|Intos)/.test(tag))
  .map(tag => ({size: Number(/font-size="([\d.]+)"/.exec(tag)[1]), family: /font-family="([^"]*)"/.exec(tag)[1], length: /textLength="([\d.]+)"/.exec(tag)?.[1]}));
// Estimated layout: the same handle without its measurement (the faces still embed and rasterize).
const estimatedFonts = {embeddedFonts: prepared.embeddedFonts, fontFiles: prepared.fontFiles, useBundledFonts: false};
const estimatedOptions = {fonts: estimatedFonts};
{
  const adjusted = fontSizes(renderSvg(deck(undefined, 'arabic'), estimatedOptions)[0]);
  const control = fontSizes(renderSvg(deck('noto-naksh-arabic', 'english-us'), estimatedOptions)[0]);
  assert.ok(adjusted.length >= 2 && adjusted.length === control.length);
  for (const [index, item] of adjusted.entries()) {
    near(item.size, adjustedFontSize(control[index].size, ADJUST), 1e-9, `estimated line ${index}: drawn size is 0.64 of the composed size, on the quarter-pixel grid`);
    near(item.size / control[index].size, ADJUST, 0.125 / control[index].size + 1e-9, `estimated line ${index}: within one grid step of 0.64`);
    assert.ok(item.family.startsWith('Noto Naskh Arabic'), item.family);
    assert.ok(!item.family.includes('Arabic Typesetting'), 'the real font never enters the stack');
  }
  assert.equal(control[0].family.split(',')[0], 'Noto Naskh Arabic');

  // Measured: the line is pinned to the width the registry measures at the size that is drawn, so measurement and drawing agree.
  const measuredSvg = renderSvg(deck(undefined, 'arabic'), {fonts: prepared})[0];
  const lines = fontSizes(measuredSvg);
  assert.ok(lines.length >= 2);
  for (const item of lines) {
    assert.equal(item.family.split(',')[0], 'Noto Naskh Arabic');
    assert.ok(item.length, 'a measured line carries a textLength');
  }
  const bodyLine = lines.at(-1);
  near(Number(bodyLine.length), registryMeasure.measure(WORDS, bodyLine.size, naskh), 0.01, 'textLength equals the replacement measured at the drawn size');
}
{
  // Mixed Arabic and Latin, measured and not: the Arabic fragments are drawn at the adjusted size, the Latin run at the line's size.
  const document = {name: 'RR-38', language: 'arabic', slides: [{id: 'a', title: 'Title', text: ['أضاف المنتج ', {text: 'PowerPoint 365', bold: true}, ' أكثر من 50 لغة']}]};
  for (const options of [{fonts: prepared}, estimatedOptions]) {
    const svg = renderSvg(document, options)[0];
    const elements = [...svg.matchAll(/<(?:text|tspan)\b[^>]*font-family="([^"]*)"[^>]*font-size="([0-9.]+)"[^>]*>/g)].map(match => ({family: match[1], size: Number(match[2])}));
    const arabic = elements.filter(item => item.family.startsWith('Noto Naskh Arabic')), latin = elements.filter(item => /^(?:Aptos|Intos)(?:,|$)/.test(item.family) && item.size < 40);
    assert.ok(arabic.length >= 2 && latin.length >= 1, 'Arabic fragments and a Latin fragment are drawn');
    for (const item of arabic) near(item.size, adjustedFontSize(latin[0].size, ADJUST), 1e-9, 'Arabic fragment size against the Latin fragment size');
  }
}

{
  // The font scheme names Arabic Typesetting for every slot (the latin slot too), and the registry has no presentation: core resolves the
  // style to the replacement's name before measuring, and the line is still pinned to the width at the drawn (adjusted) size. This is the
  // path where an unadjusted measurement would pin the glyphs 1.56 times too wide.
  const svg = renderSvg(deck('arabic-typesetting', 'arabic'), {fonts: prepared})[0];
  const lines = fontSizes(svg);
  assert.ok(lines.length >= 2);
  for (const item of lines) {
    assert.equal(item.family.split(',')[0], 'Noto Naskh Arabic');
    near(Number(item.length), registryMeasure.measure(WORDS, item.size, {...naskh, fontWeight: item === lines[0] ? 700 : 400}), 0.01, `textLength equals the advance at the drawn size ${item.size}`);
  }
  const control = fontSizes(renderSvg(deck('noto-naksh-arabic', 'english-us'), {fonts: prepared})[0]);
  near(lines[0].size, adjustedFontSize(control[0].size, ADJUST), 1e-9, 'the title is drawn at 0.64 of the composed size, on the quarter-pixel grid');
}

{
  // Baselines: PowerPoint puts an Arabic Typesetting line's baseline 0.70 em below the line top (0.78 with a Latin run), core one em. The
  // control deck names the replacement itself, so its baselines are core's. Estimated and measured previews both move the line up.
  const baselines = svg => [...svg.matchAll(/<text\b[^>]*>/g)].map(match => match[0]).filter(tag => /font-family="Noto Naskh Arabic|font-family="(?:Aptos|Intos)/.test(tag))
    .map(tag => ({size: Number(/font-size="([0-9.]+)"/.exec(tag)[1]), y: Number(/ y="([0-9.]+)"/.exec(tag)[1]), family: /font-family="([^"]*)"/.exec(tag)[1]}));
  const estimated = estimatedOptions;
  const arabic = baselines(renderSvg(deck(undefined, 'arabic'), estimated)[0]).filter(item => item.family.startsWith('Noto Naskh Arabic'));
  const control = baselines(renderSvg(deck('noto-naksh-arabic', 'english-us'), estimated)[0]);
  assert.equal(arabic.length, control.length);
  for (const [index, item] of arabic.entries()) near(control[index].y - item.y, 0.3 * control[index].size, 0.002, `estimated line ${index} moves up 0.30 em of the composed size`);
  // Measured: the same shift on the line's baseline (core's placed baseline of the same ink, minus 0.30 em).
  const measuredArabic = baselines(renderSvg(deck(undefined, 'arabic'), {fonts: prepared})[0]).filter(item => item.family.startsWith('Noto Naskh Arabic'));
  assert.ok(measuredArabic.every(item => Number.isFinite(item.y)));
  // A line holding a Latin run moves up 0.22 em of the composed size; a Latin-only line in the same deck does not move.
  const mixed = {name: 'RR-38', language: 'arabic', slides: [{id: 'a', title: 'Title', text: ['أضاف المنتج ', {text: 'PowerPoint', bold: true}, ' أكثر']}]};
  const mixedControl = {name: 'RR-38', language: 'english-us', design: {fontScheme: 'aptos'}, slides: [{id: 'a', title: 'Title', text: ['x ', {text: 'PowerPoint', bold: true}, ' y']}]};
  const mixedLine = baselines(renderSvg(mixed, estimated)[0]).filter(item => item.size < 40), mixedBase = baselines(renderSvg(mixedControl, estimated)[0]).filter(item => item.size < 40);
  const latinOnly = baselines(renderSvg({name: 'RR-38', language: 'arabic', slides: [{id: 'a', title: 'Quarterly', text: 'Plain Latin text'}]}, estimated)[0]);
  const latinControl = baselines(renderSvg({name: 'RR-38', language: 'english-us', slides: [{id: 'a', title: 'Quarterly', text: 'Plain Latin text'}]}, estimated)[0]);
  assert.deepEqual(latinOnly.map(item => item.y), latinControl.map(item => item.y), 'Latin-only lines keep core baselines');
  near(mixedBase[0].y - mixedLine[0].y, 0.22 * mixedBase[0].size, 0.002, 'a mixed line moves up 0.22 em');
  for (const item of mixedLine) near(item.y, mixedLine[0].y, 1e-9, 'every fragment of the line shares the shifted baseline');
}

// 5. Raster: the drawn ink is as wide as the adjusted advance says it should be (resvg draws the replacement at the adjusted size).
{
  const document = deck(undefined, 'arabic', WORDS);
  const svg = renderSvg(document, estimatedOptions)[0];
  const body = fontSizes(svg).at(-1);
  const png = await svgToPng(svg, {scale: 1, fonts: estimatedFonts});
  const {data, info} = await sharp(png).raw().toBuffer({resolveWithObject: true});
  // Ink columns of the body line: pixels brighter than the slide background, within the body line's rows.
  const bodyTag = [...svg.matchAll(/<text\b[^>]*>/g)].map(match => match[0]).filter(tag => /font-family="Noto Naskh Arabic/.test(tag)).at(-1);
  const baseline = Number(/ y="([\d.]+)"/.exec(bodyTag)[1]);
  const top = Math.max(0, Math.floor(baseline - body.size * 1.1)), bottom = Math.min(info.height, Math.ceil(baseline + body.size * 0.5));
  const background = [data[0], data[1], data[2]];
  let left = info.width, right = -1;
  for (let y = top; y < bottom; y += 1) for (let x = 0; x < info.width; x += 1) {
    const i = (y * info.width + x) * info.channels;
    if (Math.abs(data[i] - background[0]) + Math.abs(data[i + 1] - background[1]) + Math.abs(data[i + 2] - background[2]) > 120) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  const inkWidth = right - left + 1, advance = registryMeasure.measure(WORDS, body.size, naskh);
  near(inkWidth / advance, 1, 0.08, `ink width ${inkWidth} px against the adjusted advance ${advance.toFixed(1)} px`);
  // And it is the narrow preview PowerPoint's Arabic Typesetting calls for, not the 1.55 times wider one the unadjusted preview drew.
  assert.ok(inkWidth < registryMeasure.measure(WORDS, body.size / ADJUST, naskh) * 0.75);
}

console.log(JSON.stringify({test: 'arabic-size-adjust', passed: true, sizeAdjust: ADJUST, replacement: row.replacement.family}));
