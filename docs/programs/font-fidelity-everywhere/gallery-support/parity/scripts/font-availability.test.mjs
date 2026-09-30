// Controls for the shared font availability helpers (FF-48). Run: node --test font-availability.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyChosenFamilies, hostRenderOutcome, hostRenderReason, resolveDrawnFamily, resolveFamily, slotsByFamily, svgTextRuns} from './font-availability.mjs';

// Rows shaped like core `fontPolicyFor()` results (spec/reference/font-policy.json).
const policy = {
  Aptos: {family: 'Aptos', licenseClass: 'proprietary-standard', replacement: {family: 'Intos', compatibility: 'metric'}, alternates: ['Roboto']},
  Tenorite: {family: 'Tenorite', licenseClass: 'proprietary-standard', replacement: {family: 'Figtree', compatibility: 'visual'}},
  Raleway: {family: 'Raleway', licenseClass: 'open', replacement: null},
  Roboto: {family: 'Roboto', licenseClass: 'open', replacement: null},
};
const fontPolicyFor = f => policy[f];
const bundledIn = () => [];
// A host stub: `faces` maps a requested family to what the registry resolves it to (throws when absent), like registry.resolveFont.
const hostWith = (faces, extra = {}) => ({registry: {resolveFont: ({fontFamily}) => { const f = faces[fontFamily]; if (!f) throw Object.assign(new Error('no face'), {code: 'font-unavailable'}); return f; }}, resolutions: new Map(), gate: {ok: true}, options: {}, ...extra});
const theme = (major, minor) => ({major: {latin: major}, minor: {latin: minor}});
const names = (...n) => ({latin: new Set(n), ea: new Set(n), cs: new Set(n)});
const run = (host, families, {roles = {heading: families[0], body: families[families.length - 1]}, th = theme(families[0], families[families.length - 1]), packageNames = new Set(families.map(f => f.toLowerCase()))} = {}) =>
  classifyChosenFamilies({host, chosenFamilies: new Set(families), roles, theme: th, previewSlots: new Map(families.map(f => [f, new Set(['latin'])])), pptxNamesBySlot: names(...families), packageNames, fontPolicyFor, bundledIn});

test('a policy replacement with the PPTX naming the selected family draws no failing reason (owner font policy)', () => {
  const host = hostWith({Aptos: {compatibility: 'metric', resolvedFamily: 'Intos'}, Tenorite: {compatibility: 'visual', resolvedFamily: 'Figtree'}});
  const r = run(host, ['Aptos', 'Tenorite']);
  assert.deepEqual(r.reasons.filter(x => x.status === 'fail'), []);
  assert.equal(r.fontRes.Aptos.verdict, 'pass'); assert.equal(r.fontRes.Aptos.tier, 'metric'); assert.equal(r.fontRes.Aptos.resolved, 'Intos');
  // A visual-only route is near (reported, not a gap).
  assert.equal(r.fontRes.Tenorite.verdict, 'near'); assert.match(r.reasons[0].reason, /visual-only replacement/);
});

test('an open family the host draws as itself is the real face', () => {
  const r = run(hostWith({Roboto: {compatibility: 'exact', resolvedFamily: 'Roboto'}}), ['Roboto']);
  assert.equal(r.fontRes.Roboto.verdict, 'pass'); assert.equal(r.fontRes.Roboto.tier, 'real'); assert.deepEqual(r.reasons, []);
});

test('a family the host draws in an unrouted fallback face stays a failure (Raleway drawn as Roboto)', () => {
  const r = run(hostWith({Raleway: {compatibility: 'generic', resolvedFamily: 'Roboto'}}), ['Raleway']);
  assert.equal(r.fontRes.Raleway.verdict, 'fail');
  assert.match(r.reasons[0].reason, /unexpected fallback face for Raleway: Roboto/);
});

test('a family with no face in the host fails with its policy route', () => {
  const r = run(hostWith({}), ['Aptos']);
  assert.equal(r.fontRes.Aptos.verdict, 'fail'); assert.match(r.reasons[0].reason, /preview has no face for Aptos/);
});

test('an export that names the replacement instead of the selected family fails', () => {
  const host = hostWith({Aptos: {compatibility: 'metric', resolvedFamily: 'Intos'}});
  const r = run(host, ['Aptos'], {th: theme('Intos', 'Intos'), packageNames: new Set(['intos'])});
  assert.equal(r.fontRes.Aptos.verdict, 'fail');
  assert.ok(r.reasons.some(x => /does not name the selected family Aptos/.test(x.reason) || /replacement name Intos/.test(x.reason)));
});

test('a family with no row in the policy table fails', () => {
  const r = run(hostWith({Zapf: {compatibility: 'exact', resolvedFamily: 'Zapf'}}), ['Zapf']);
  assert.equal(r.fontRes.Zapf.verdict, 'fail'); assert.match(r.reasons[0].reason, /no route in the FF-31 font policy table/);
});

test('resolveFamily caches on the host', () => {
  let calls = 0; const host = hostWith({}); host.registry.resolveFont = () => { calls++; return {compatibility: 'exact', resolvedFamily: 'Roboto'}; };
  assert.equal(resolveFamily(host, 'Roboto').ok, true); resolveFamily(host, 'Roboto'); assert.equal(calls, 1);
});

test('hostRenderOutcome: a finished gate and a render that does not throw is ok; the failures keep their code, family and cause', () => {
  const ok = {gate: {ok: true}, options: {a: 1}};
  assert.deepEqual(hostRenderOutcome(ok, {renderSvgDeck: (d, o) => { assert.deepEqual(o, {a: 1}); return []; }}, {}), {ok: true});
  const bad = hostRenderOutcome(ok, {renderSvgDeck: () => { throw Object.assign(new Error('boom'), {code: 'font-shaping-failed', details: {fontFamily: 'Noto Sans Mongolian', cause: 'Not a fixed size'}}); }}, {});
  assert.deepEqual(bad, {ok: false, code: 'font-shaping-failed', family: 'Noto Sans Mongolian', cause: 'Not a fixed size'});
  assert.equal(hostRenderReason(bad), 'the modelled host cannot draw this value: font-shaping-failed (Noto Sans Mongolian), Not a fixed size');
  const gate = hostRenderOutcome({gate: {ok: false, code: 'fonts-unavailable', message: 'x.woff2 did not finish loading'}, options: {}}, {renderSvgDeck: () => assert.fail('the gate failed, nothing is rendered')}, {});
  assert.deepEqual(gate, {ok: false, code: 'fonts-unavailable', family: null, cause: 'x.woff2 did not finish loading'});
});

test('svgTextRuns and slotsByFamily read the families and scripts the preview draws', () => {
  const svg = '<svg><text font-family="Aptos, sans-serif" x="0"><tspan>Hello</tspan><tspan font-family="Noto Sans JP">日本語</tspan></text><text aria-hidden="true" font-family="Hidden">x</text><text font-family="Roboto Mono">code</text></svg>';
  const runs = svgTextRuns(svg);
  assert.deepEqual(runs.map(r => [r.family, r.text]), [['Aptos', 'Hello'], ['Noto Sans JP', '日本語'], ['Roboto Mono', 'code']]);
  const slots = slotsByFamily(runs);
  assert.deepEqual([...slots.get('Aptos')], ['latin']); assert.deepEqual([...slots.get('Noto Sans JP')], ['ea']);
});

test('resolveDrawnFamily resolves the faces the document draws (face-level lazy loading), not an unloaded Regular', () => {
  const held = new Set(['Intos Display|700|false']);
  const host = {resolutions: new Map(), drawn: new Map([['aptos display', [{weight: 700, italic: false}]]]), registry: {resolveFont: ({fontFamily, fontWeight, italic}) => held.has(`${fontFamily}|${fontWeight}|${italic}`) || fontFamily === 'Aptos Display' && fontWeight === 700
    ? {compatibility: 'metric', resolvedFamily: 'Intos Display'} : {compatibility: 'visual', resolvedFamily: 'Carlito'}}};
  assert.equal(resolveFamily(host, 'Aptos Display').compatibility, 'visual', 'Regular is not loaded: the alternate');
  assert.deepEqual(resolveDrawnFamily(host, 'Aptos Display'), {ok: true, compatibility: 'metric', resolvedFamily: 'Intos Display'});
  assert.equal(resolveDrawnFamily(host, 'Roboto').compatibility, 'visual', 'no drawn face: Regular, as before');
  host.drawn.set('mixed', [{weight: 700, italic: false}, {weight: 400, italic: false}]);
  assert.equal(resolveDrawnFamily(host, 'Mixed').compatibility, 'visual', 'the weakest drawn face decides');
  host.resolutions.clear(); host.registry.resolveFont = () => { throw Object.assign(new Error('x'), {code: 'font-unavailable'}); };
  assert.deepEqual(resolveDrawnFamily(host, 'Mixed'), {ok: false, code: 'font-unavailable'});
});

test('resolveDrawnFamily: a family the document draws nothing in resolves through the registry that holds every vendored face', () => {
  const host = {resolutions: new Map(), drawn: new Map([['aptos display', [{weight: 700, italic: false}]]]),
    registry: {resolveFont: () => ({compatibility: 'visual', resolvedFamily: 'Roboto'})},
    unloaded: {resolutions: new Map(), registry: {resolveFont: ({fontFamily}) => ({compatibility: 'metric', resolvedFamily: fontFamily === 'Aptos' ? 'Intos' : fontFamily})}}};
  assert.deepEqual(resolveDrawnFamily(host, 'Aptos'), {ok: true, compatibility: 'metric', resolvedFamily: 'Intos'});
  assert.equal(resolveDrawnFamily({...host, drawn: undefined}, 'Aptos').compatibility, 'visual', 'a host that tracks no faces keeps the Regular resolution');
});
