// FF-31: preview replacements come from the OPF font policy snapshot. Every proprietary text family
// in the table previews with its declared open replacement or, when that pack is not installed, a
// declared alternate that opf-render already bundles; never silently, and never by downloading.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {BUNDLED_FONT_MANIFEST, prepareNodeFonts} from '../dist/fonts-node.js';
import {createFontRegistry, EXPERIMENTAL_FONT_CANDIDATES, FONT_COMPATIBILITY, FONT_POLICY, FONT_POLICY_DECISIONS, FONT_POLICY_SOURCE, disabledFeaturesFor, fontPolicyFor} from '../dist/fonts.js';

// Snapshot shape and the provisional owner decisions (provisional, owner may revise).
assert.ok(FONT_POLICY.length >= 150 && Object.isFrozen(FONT_POLICY) && /^[0-9a-f]{64}$/.test(FONT_POLICY_SOURCE.sha256));
assert.match(FONT_POLICY_DECISIONS.status, /provisional, owner may revise/);
// Owner policy 2026-09-29: Aptos previews with the metric-compatible Intos (office pack); Roboto and Carlito are the fallbacks.
assert.deepEqual([fontPolicyFor('aptos').replacement.family, fontPolicyFor('aptos').replacement.compatibility], ['Intos', 'metric']);
assert.deepEqual(fontPolicyFor('aptos').alternates, ['Roboto', 'Carlito']);
assert.equal(fontPolicyFor('Aptos').replacement.decision, 'aptos-preview');
for (const [family, replacement] of [['Aptos Display', 'Intos Display'], ['Aptos Narrow', 'Intos Narrow'], ['Aptos Serif', 'Intos Serif']]) {
  const row = fontPolicyFor(family);
  assert.deepEqual([row.replacement.family, row.replacement.compatibility, row.replacement.measured.replacement], [replacement, 'metric', replacement], family);
  assert.match(row.replacement.source, /^https:\/\/github\.com\/muglug\/intos\/tree\/[0-9a-f]{40}$/, family);
}
// Every metric claim clears the bar in all four styles (mean < 0.1%, max <= 0.3%).
for (const row of FONT_POLICY) if (row.replacement?.compatibility === 'metric') assert.ok(row.replacement.measured.meanAbsWidthDelta < 0.001 && row.replacement.measured.maxAbsWidthDelta <= 0.003 && row.replacement.measured.styles === 4, row.family);
// Selawik was measured for Segoe UI and rejected; Red Hat Display stays.
assert.equal(fontPolicyFor('Segoe UI').replacement.compatibility, 'visual');
assert.ok(EXPERIMENTAL_FONT_CANDIDATES.every(item => item.requestedFamily === 'Segoe UI' && item.substitute === 'Selawik') && !JSON.stringify(EXPERIMENTAL_FONT_CANDIDATES).includes('Akasia'));
for (const family of ['Segoe UI', 'Segoe UI Semibold', 'Segoe UI Light', 'Segoe UI Semilight']) assert.equal(fontPolicyFor(family).replacement.family, 'Red Hat Display');
assert.deepEqual([fontPolicyFor('Cambria').replacement.family, fontPolicyFor('Cambria').replacement.compatibility], ['Caladea', 'visual']);
// Georgia -> Gelasio is metric only with liga and clig off (FF-31); the row says so and opf-render applies it.
assert.equal(fontPolicyFor('Georgia').replacement.compatibility, 'metric');
assert.deepEqual(fontPolicyFor('Georgia').replacement.disabledFeatures, ['liga', 'clig']);
assert.ok(fontPolicyFor('Georgia').replacement.measured.maxAbsWidthDelta <= 0.003);
assert.deepEqual(FONT_POLICY.filter(row => row.replacement?.disabledFeatures).map(row => row.family), ['Georgia']);
assert.deepEqual([...FONT_COMPATIBILITY.find(entry => entry.requestedFamily === 'Georgia').disabledFeatures], ['liga', 'clig']);
assert.deepEqual([...disabledFeaturesFor('gelasio')], ['liga', 'clig']);
assert.equal(disabledFeaturesFor('Carlito'), undefined);
assert.equal(fontPolicyFor('Cambria').replacement.metricModeFallback, true);
assert.equal(fontPolicyFor('Consolas').replacement.family, 'Cousine');
for (const row of FONT_POLICY) {
  if (row.licenseClass !== 'open') assert.equal(row.embeddableByOpf, false, `${row.family} is never embeddable`);
  if (!row.replacement) continue;
  const rule = FONT_COMPATIBILITY.find(entry => entry.requestedFamily === row.family);
  assert.deepEqual([...rule.substitutes], [row.replacement.family, ...(row.alternates ?? [])], row.family);
  assert.equal(rule.compatibility, row.replacement.compatibility, row.family);
  if (row.replacement.measured) assert.equal(row.replacement.measured.replacement, row.replacement.family, `${row.family}: measurement is of the current replacement`);
}

// With only the bundled base, office and open-family packs, every proprietary Latin text family resolves: to its
// declared replacement when bundled, otherwise to its bundled alternate. Script families use the
// FF-19 script pack and are covered by test/script-fonts.mjs.
const bundled = new Set(BUNDLED_FONT_MANIFEST.packages.filter(pkg => ['base', 'office', 'open'].includes(pkg.pack)).flatMap(pkg => pkg.faces.map(face => face.family.toLowerCase())));
const isBundled = family => bundled.has(family.toLowerCase());
const {registry} = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'});
const counts = {latin: 0, declared: 0, alternate: 0, unavailable: []};
for (const row of FONT_POLICY) {
  if (row.licenseClass === 'open' || !row.replacement) continue;
  const candidates = [row.replacement.family, ...(row.alternates ?? [])];
  if (!candidates.some(isBundled)) { counts.unavailable.push(row.family); continue; }
  counts.latin++;
  const resolved = registry.resolveFont({fontFamily: row.family, fontWeight: 400});
  const expected = candidates.find(isBundled);
  assert.ok(resolved.resolvedFamily.toLowerCase().startsWith(expected.toLowerCase()), `${row.family}: ${expected}, got ${resolved.resolvedFamily}`);
  assert.equal(resolved.substitute, true, row.family);
  // Only the declared replacement can be metric; an alternate is always visual.
  assert.equal(resolved.compatibility, row.replacement.compatibility === 'metric' && expected === row.replacement.family ? 'metric' : 'visual', row.family);
  counts[expected === row.replacement.family ? 'declared' : 'alternate']++;
}
// Every unavailable proprietary family is a non-Latin script family (FF-19 script pack) or has no
// text replacement at all (symbol, math and emoji fonts).
for (const family of counts.unavailable) {
  const replacement = fontPolicyFor(family).replacement.family;
  assert.match(replacement, /^Noto /, `${family}: ${replacement} must be a script replacement`);
}
// The measured replacement delta reaches the resolution record.
const aptos = registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400});
assert.equal(aptos.decision, 'aptos-preview');
assert.equal(aptos.measured.replacement, 'Intos');
assert.deepEqual([aptos.resolvedFamily, aptos.compatibility, aptos.substitute], ['Intos', 'metric', true]);
assert.ok(aptos.measured.meanAbsWidthDelta < 0.001 && aptos.measured.maxAbsWidthDelta <= 0.003);
// Without the Intos faces the declared visual alternates take over, reported as visual.
const withoutIntos = createFontRegistry(registry.embeddedFonts.filter(face => !/^Intos/.test(face.family)).map(face => ({family: face.family, weight: face.weight, italic: face.italic, data: new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64'))})), {substitutionPolicy: 'visual'});
assert.deepEqual(['Aptos', 'Aptos Display', 'Aptos Narrow', 'Aptos Serif'].map(family => { const r = withoutIntos.resolveFont({fontFamily: family, fontWeight: 400}); return `${r.resolvedFamily}:${r.compatibility}`; }), ['Roboto:visual', 'Carlito:visual', 'Carlito:visual', 'Tinos:visual']);
assert.equal(registry.textMeasurement.resolveFont({fontFamily: 'Roboto', fontWeight: 700}).substitute, false);

// A weight-named family selects its encoded weight in the replacement; bold still selects bold.
// Red Hat Display ships a real 600 face (FF-43: static instances with OS/2 weight 600 from @expo-google-fonts; the upstream SemiBold declares 707, which
// would out-rank Bold in resvg), so Segoe UI Semibold selects it at its encoded weight. Bold still selects the Bold face through the style link.
assert.deepEqual(['Red Hat Display', 600], (({resolvedFamily, resolvedWeight}) => [resolvedFamily, resolvedWeight])(registry.resolveFont({fontFamily: 'Segoe UI Semibold', fontWeight: 400})));
assert.equal(registry.resolveFont({fontFamily: 'Segoe UI Light', fontWeight: 400}).resolvedWeight, 300);
assert.equal(registry.resolveFont({fontFamily: 'Segoe UI Semibold', fontWeight: 700}).resolvedWeight, 700);

// Strict mode never falls back silently: the error names the replacement, its tier and the hook.
const strict = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'metric'});
// Strict metric mode resolves the Aptos family with the office pack; with only the base pack it names the pack.
const strictBase = await prepareNodeFonts({pack: 'base', substitutionPolicy: 'metric'});
assert.throws(() => strictBase.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.replacement === 'Intos' && error.details.replacementCompatibility === 'metric' && error.details.packs.includes('office') && /load the 'office'/.test(error.message));
const strictAptos = strict;
for (const [family, resolved] of [['Aptos', 'Intos'], ['Aptos Display', 'Intos Display'], ['Aptos Narrow', 'Intos Narrow'], ['Aptos Serif', 'Intos Serif']]) for (const weight of [400, 700]) for (const italic of [false, true]) {
  const r = strictAptos.registry.resolveFont({fontFamily: family, fontWeight: weight, italic});
  assert.deepEqual([r.resolvedFamily, r.resolvedWeight, r.italic, r.compatibility, r.substitute], [resolved, weight, italic, 'metric', true], `${family} ${weight} ${italic}`);
}
// A weight the metric claim does not cover is never metric: strict mode refuses it, visual mode reports visual.
assert.throws(() => strictAptos.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 600}), {code: 'font-unavailable'});
assert.equal(registry.resolveFont({fontFamily: 'Aptos', fontWeight: 600}).compatibility, 'visual');
// A decision id and the caller hook reach the error, and the PPTX still names Aptos.
assert.throws(() => strictBase.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400}), error => error.details.decision === 'aptos-preview' && /prepareNodeFonts\(\{faces\}\)/.test(error.message) && /PPTX names 'Aptos'/.test(error.message));
assert.equal(strict.registry.resolveFont({fontFamily: 'Calibri', fontWeight: 700}).compatibility, 'metric');
assert.equal(strict.registry.resolveFont({fontFamily: 'Cambria', fontWeight: 400}).compatibility, 'visual');
assert.equal(strict.registry.resolveFont({fontFamily: 'Georgia', fontWeight: 400}).compatibility, 'metric');
assert.throws(() => strict.registry.resolveFont({fontFamily: 'Georgia', fontWeight: 500}), {code: 'font-unavailable'});
// Liberation Sans, Serif and Mono are not shipped (Reserved Font Name Liberation, about 4.4 MB): RR-17 routes them to the Croscore faces Liberation 2 is built from (Arimo, Tinos, Cousine), metric in all four styles, so a document that names them previews with faces that have their advances and glyph boxes.
for (const [family, replacement] of [['Liberation Sans', 'Arimo'], ['Liberation Serif', 'Tinos'], ['Liberation Mono', 'Cousine']]) for (const [fontWeight, italic] of [[400, false], [700, false], [400, true], [700, true]]) {
  const r = strict.registry.resolveFont({fontFamily: family, fontWeight, italic});
  assert.deepEqual([r.resolvedFamily, r.resolvedWeight, r.italic, r.compatibility, r.substitute], [replacement, fontWeight, italic, 'metric', true], `${family} ${fontWeight} ${italic}`);
}
// An open family the office pack ships (Montserrat, FF-31; Raleway and Playfair Display, FF-43) points at that pack when only the base pack is loaded.
assert.equal(strict.registry.resolveFont({fontFamily: 'Montserrat', fontWeight: 400}).compatibility, 'exact');
for (const family of ['Raleway', 'Playfair Display']) assert.equal(strict.registry.resolveFont({fontFamily: family, fontWeight: 700, italic: true}).compatibility, 'exact', family);
const baseOnly = await prepareNodeFonts({pack: 'base'});
assert.throws(() => baseOnly.registry.resolveFont({fontFamily: 'Montserrat', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.pack === 'office' && /load the 'office' font pack/.test(error.message));
assert.throws(() => strict.registry.resolveFont({fontFamily: 'Brand Sans', fontWeight: 400}), error => error.details.licenseClass === 'unknown' && /not in the OPF font policy table/.test(error.message));

// Caller-supplied faces (for example a licensed copy of the real font) win as exact faces.
// FF-31: Carlito is vendored in this package (fonts/carlito), not an npm dependency.
const carlito = BUNDLED_FONT_MANIFEST.packages.find(pkg => pkg.vendored && pkg.faces.some(face => face.family === 'Carlito'));
const file = fileURLToPath(new URL(`../${carlito.vendored}/${carlito.faces[0].file}`, import.meta.url));
const supplied = await prepareNodeFonts({pack: 'base', substitutionPolicy: 'visual', faces: [{path: file, family: 'Aptos', weight: 400}]});
const exact = supplied.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400});
assert.deepEqual([exact.resolvedFamily, exact.compatibility, exact.substitute], ['Aptos', 'exact', false]);
assert.ok(supplied.options.fontFiles.includes(file));

console.log(JSON.stringify({test: 'font-policy', rows: FONT_POLICY.length, decisions: Object.keys(FONT_POLICY_DECISIONS).filter(key => key !== 'status'), bundledPreview: counts}));
