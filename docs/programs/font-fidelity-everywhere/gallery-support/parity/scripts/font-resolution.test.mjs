// Controls for the FF-38 fontResolution classifier. Run: node --test font-resolution.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFontResolution, legacyPasses, legacyStatus, sameFamilyGroup} from './font-resolution.mjs';

// Rows shaped like core `fontPolicyFor()` results (spec/reference/font-policy.json).
const row = {
  'Aptos Display': {family: 'Aptos Display', licenseClass: 'proprietary-standard', replacement: {family: 'Carlito', compatibility: 'visual'}, alternates: ['Roboto']},
  Aptos: {family: 'Aptos', licenseClass: 'proprietary-standard', replacement: {family: 'Roboto', compatibility: 'visual'}, alternates: ['Carlito']},
  Calibri: {family: 'Calibri', licenseClass: 'proprietary-standard', replacement: {family: 'Carlito', compatibility: 'metric'}},
  'Segoe UI': {family: 'Segoe UI', licenseClass: 'proprietary-standard', replacement: {family: 'Red Hat Display', compatibility: 'visual'}, alternates: ['Open Sans', 'Arimo']},
  'Segoe UI Semibold': {family: 'Segoe UI Semibold', licenseClass: 'proprietary-standard', replacement: {family: 'Red Hat Display', compatibility: 'visual'}, alternates: ['Roboto']},
  Roboto: {family: 'Roboto', licenseClass: 'open', replacement: null},
  'Open Sans': {family: 'Open Sans', licenseClass: 'open', replacement: null},
  Meiryo: {family: 'Meiryo', licenseClass: 'proprietary-standard', replacement: {family: 'Noto Sans JP', compatibility: 'visual'}},
};
const ok = (compatibility, resolvedFamily) => ({ok: true, compatibility, resolvedFamily});
const named = {named: true, replacementNames: []};
const run = (family, preview, pptx = named, extra = {}) => classifyFontResolution({family, policyRow: row[family], preview, pptx, ...extra});

test('Aptos Display -> Carlito (visual) with the PPTX naming Aptos Display is near, tier reported', () => {
  const r = run('Aptos Display', ok('visual', 'Carlito'));
  assert.equal(r.verdict, 'near'); assert.equal(r.tier, 'visual'); assert.equal(r.route, 'replacement'); assert.equal(r.policyTier, 'visual');
  assert.match(r.reasons[0].reason, /visual-only replacement \(no metric-compatible open font for Aptos Display\)/);
});
test('Aptos -> Roboto (visual) with the PPTX naming Aptos is near', () => {
  const r = run('Aptos', ok('visual', 'Roboto'));
  assert.equal(r.verdict, 'near'); assert.equal(r.route, 'replacement');
});
test('selected Aptos previewed with Carlito (a listed alternate) and PPTX "Aptos" is near, route alternate', () => {
  const r = run('Aptos', ok('visual', 'Carlito'));
  assert.equal(r.verdict, 'near'); assert.equal(r.route, 'alternate'); assert.match(r.reasons[0].reason, /listed alternate/);
});
test('Calibri -> Carlito (metric-compatible) with the PPTX naming Calibri passes', () => {
  const r = run('Calibri', ok('metric', 'Carlito'));
  assert.equal(r.verdict, 'pass'); assert.equal(r.tier, 'metric'); assert.deepEqual(r.reasons, []);
});
test('metric route the registry could only serve at a fallback weight is visual, so near', () => {
  const r = run('Calibri', ok('visual', 'Carlito'));
  assert.equal(r.verdict, 'near'); assert.equal(r.tier, 'visual'); assert.equal(r.policyTier, 'metric');
});
test('open bundled family rendering with its real face passes', () => {
  const r = run('Roboto', ok('exact', 'Roboto'));
  assert.equal(r.verdict, 'pass'); assert.equal(r.tier, 'real'); assert.equal(r.route, 'real');
});
test('a licensed family with a caller-supplied real face passes', () => {
  const r = run('Aptos', ok('exact', 'Aptos'));
  assert.equal(r.verdict, 'pass'); assert.equal(r.tier, 'real');
});
test('the PPTX writing the replacement name Carlito instead of Aptos Display fails', () => {
  const r = run('Aptos Display', ok('visual', 'Carlito'), {named: false, slot: 'theme major latin', replacementNames: ['Carlito']});
  assert.equal(r.verdict, 'fail');
  assert.ok(r.reasons.some(x => x.status === 'fail' && /PPTX writes replacement name Carlito instead of the selected family Aptos Display/.test(x.reason)));
  assert.ok(r.reasons.some(x => x.status === 'fail' && /does not name the selected family Aptos Display in theme major latin/.test(x.reason)));
});
test('a metric replacement written into the PPTX still fails (Calibri -> Carlito)', () => {
  assert.equal(run('Calibri', ok('metric', 'Carlito'), {named: true, replacementNames: ['Carlito']}).verdict, 'fail');
});
test('the preview using an unrouted host/system font fails', () => {
  const r = run('Aptos', ok('visual', 'Segoe UI Emoji'));
  assert.equal(r.verdict, 'fail'); assert.match(r.reasons[0].reason, /not the policy route for Aptos: Segoe UI Emoji/);
});
test('a generic fallback face (fallbackFamily) is never the policy route', () => {
  const r = run('Aptos', ok('generic', 'Roboto'));
  assert.equal(r.verdict, 'fail'); assert.match(r.reasons[0].reason, /unexpected fallback face/);
});
test('an open family rendered as some other face fails', () => {
  assert.equal(run('Roboto', ok('visual', 'Carlito')).verdict, 'fail');
});
test('a family missing from the policy table fails, even when the preview has a face', () => {
  const r = classifyFontResolution({family: 'Zapfino Custom', policyRow: undefined, preview: ok('exact', 'Zapfino Custom'), pptx: named});
  assert.equal(r.verdict, 'fail'); assert.match(r.reasons[0].reason, /no route in the FF-31 font policy table: Zapfino Custom/);
});
test('a policy route that is not loaded in the preview fails, naming the route and the pack', () => {
  const r = run('Meiryo', {ok: false, code: 'font-unavailable'}, named, {bundledIn: ['scripts']});
  assert.equal(r.verdict, 'fail'); assert.match(r.reasons[0].reason, /preview has no face for Meiryo; policy route Noto Sans JP is not loaded; bundled in the scripts pack/);
});
test('an open family with no face in the preview fails', () => {
  const r = run('Open Sans', {ok: false, code: 'font-unavailable'});
  assert.equal(r.verdict, 'fail'); assert.match(r.reasons[0].reason, /preview has no face for open family Open Sans/);
});
test('weight-named faces belong to their family group (Segoe UI Semibold -> Roboto SemiBold via alternate Roboto)', () => {
  assert.ok(sameFamilyGroup('Roboto SemiBold', 'Roboto'));
  assert.ok(!sameFamilyGroup('Roboto Slab', 'Roboto'));
  const r = run('Segoe UI Semibold', ok('visual', 'Roboto SemiBold'));
  assert.equal(r.verdict, 'near'); assert.equal(r.route, 'alternate');
});
test('legacy definition: only the real face or a metric substitute passes', () => {
  assert.equal(legacyStatus(ok('exact', 'Roboto')), 'real'); assert.ok(legacyPasses(ok('exact', 'Roboto')));
  assert.ok(legacyPasses(ok('metric', 'Carlito')));
  assert.ok(!legacyPasses(ok('visual', 'Carlito'))); assert.equal(legacyStatus(ok('visual', 'Carlito')), 'visual-substitute');
  assert.ok(!legacyPasses({ok: false})); assert.equal(legacyStatus({ok: false}), 'missing');
  assert.equal(legacyStatus(ok('generic', 'Roboto')), 'missing');
});
