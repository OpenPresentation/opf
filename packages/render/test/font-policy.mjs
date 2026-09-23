// FF-31: preview replacements come from the OPF font policy snapshot. Every proprietary text family
// in the table previews with its declared open replacement or, when that pack is not installed, a
// declared alternate that opf-render already bundles; never silently, and never by downloading.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {BUNDLED_FONT_MANIFEST, prepareNodeFonts} from '../dist/fonts-node.js';
import {FONT_COMPATIBILITY, FONT_POLICY, FONT_POLICY_DECISIONS, FONT_POLICY_SOURCE, fontPolicyFor} from '../dist/fonts.js';

// Snapshot shape and the provisional owner decisions (provisional, owner may revise).
assert.ok(FONT_POLICY.length >= 150 && Object.isFrozen(FONT_POLICY) && /^[0-9a-f]{64}$/.test(FONT_POLICY_SOURCE.sha256));
assert.match(FONT_POLICY_DECISIONS.status, /provisional, owner may revise/);
assert.equal(fontPolicyFor('aptos').replacement.family, 'Roboto');
assert.equal(fontPolicyFor('Aptos').replacement.decision, 'aptos-preview');
for (const family of ['Segoe UI', 'Segoe UI Semibold', 'Segoe UI Light', 'Segoe UI Semilight']) assert.equal(fontPolicyFor(family).replacement.family, 'Red Hat Display');
assert.deepEqual([fontPolicyFor('Cambria').replacement.family, fontPolicyFor('Cambria').replacement.compatibility], ['Caladea', 'visual']);
assert.equal(fontPolicyFor('Georgia').replacement.compatibility, 'visual');
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

// With only the bundled base+office packs, every proprietary Latin text family resolves: to its
// declared replacement when bundled, otherwise to its bundled alternate. Script families use the
// FF-19 script pack and are covered by test/script-fonts.mjs.
const bundled = new Set(BUNDLED_FONT_MANIFEST.packages.filter(pkg => pkg.pack === 'base' || pkg.pack === 'office').flatMap(pkg => pkg.faces.map(face => face.family.toLowerCase())));
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
assert.equal(aptos.measured.replacement, 'Roboto');
assert.ok(aptos.measured.meanAbsWidthDelta > 0.015 && aptos.measured.meanAbsWidthDelta < 0.03);
assert.equal(registry.textMeasurement.resolveFont({fontFamily: 'Roboto', fontWeight: 700}).substitute, false);

// A weight-named family selects its encoded weight in the replacement; bold still selects bold.
assert.equal(registry.resolveFont({fontFamily: 'Segoe UI Semibold', fontWeight: 400}).resolvedWeight, 600);
assert.equal(registry.resolveFont({fontFamily: 'Segoe UI Semibold', fontWeight: 700}).resolvedWeight, 700);

// Strict mode never falls back silently: the error names the replacement, its tier and the hook.
const strict = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'metric'});
assert.throws(() => strict.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.replacement === 'Roboto' && error.details.replacementCompatibility === 'visual' && error.details.decision === 'aptos-preview' && /visual only/.test(error.message) && /prepareNodeFonts\(\{faces\}\)/.test(error.message) && /PPTX names 'Aptos'/.test(error.message));
assert.equal(strict.registry.resolveFont({fontFamily: 'Calibri', fontWeight: 700}).compatibility, 'metric');
assert.equal(strict.registry.resolveFont({fontFamily: 'Cambria', fontWeight: 400}).compatibility, 'visual');
assert.throws(() => strict.registry.resolveFont({fontFamily: 'Georgia', fontWeight: 400}), {code: 'font-unavailable'});
assert.throws(() => strict.registry.resolveFont({fontFamily: 'Montserrat', fontWeight: 400}), error => error.details.licenseClass === 'open' && /no pinned renderer pack ships it yet/.test(error.message));
assert.throws(() => strict.registry.resolveFont({fontFamily: 'Brand Sans', fontWeight: 400}), error => error.details.licenseClass === 'unknown' && /not in the OPF font policy table/.test(error.message));

// Caller-supplied faces (for example a licensed copy of the real font) win as exact faces.
const carlito = BUNDLED_FONT_MANIFEST.packages.find(pkg => pkg.name === '@expo-google-fonts/carlito');
const file = fileURLToPath(new URL(carlito.faces[0].file, import.meta.resolve('@expo-google-fonts/carlito/package.json')));
const supplied = await prepareNodeFonts({pack: 'base', substitutionPolicy: 'visual', faces: [{path: file, family: 'Aptos', weight: 400}]});
const exact = supplied.registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400});
assert.deepEqual([exact.resolvedFamily, exact.compatibility, exact.substitute], ['Aptos', 'exact', false]);
assert.ok(supplied.options.fontFiles.includes(file));

console.log(JSON.stringify({test: 'font-policy', rows: FONT_POLICY.length, decisions: Object.keys(FONT_POLICY_DECISIONS).filter(key => key !== 'status'), bundledPreview: counts}));
