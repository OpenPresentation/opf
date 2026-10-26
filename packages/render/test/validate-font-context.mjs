// WI-1 (P24): validate and paginate measure with the font context the renderer draws with. The default Aptos scheme
// previews with Intos and Intos Display, which have weights 400 and 700 only; a metric value asks for 800 and a quote
// body for 600. The renderer resolves each role family once (Aptos Display -> Intos Display) and draws such a run with
// the nearest weight, recorded as a visual substitution. validate and paginate used the unresolved family, which the
// default (metric) policy refuses at those weights, so every metric, quote and timeline slide reported
// opf/layout-failed and skipped its geometry checks while toSvg drew it. A family no font resolves still fails.
import assert from 'node:assert/strict';
import { paginate, resolveDrawnFontFamilies, validate } from '@openpresentation/opf';
import { loadFonts } from '../dist/fonts-node.js';
import { catalogs, toSvg } from './catalog-harness.mjs';

const fonts = await loadFonts({ pack: 'office' });
const deck = (slides, extra = {}) => ({ name: 'Weights', language: 'en-US', ...extra, slides });
const failed = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/layout-failed');

// The registry still refuses a weight the metric claim does not cover when asked for the proprietary family directly
// (FF-31 policy, test/font-policy.mjs); this is what validate used to ask.
assert.throws(() => fonts.textMeasurement.resolveFont({ fontFamily: 'Aptos Display', fontWeight: 800 }), { code: 'font-unavailable' });

// The role families the renderer draws with: resolved once, so a run at 800 or 600 draws the nearest Intos weight.
const drawn = resolveDrawnFontFamilies({ heading: 'Aptos Display', body: 'Aptos', code: 'Consolas' }, fonts.textMeasurement);
// Consolas previews only under the visual policy: a role the host cannot draw keeps its name, so only a run in it fails.
assert.equal(drawn.code, 'Consolas');
assert.deepEqual([drawn.heading, drawn.body], ['Intos Display', 'Intos']);
const value = fonts.textMeasurement.resolveFont({ fontFamily: drawn.heading, fontWeight: 800 });
assert.deepEqual([value.resolvedFamily, value.resolvedWeight, value.compatibility], ['Intos Display', 700, 'visual']);
// A family that names its weight keeps its name (each run resolves it to the replacement's encoded weight), as in the renderer.
assert.equal(resolveDrawnFontFamilies({ heading: 'Segoe UI Semibold', body: 'Aptos' }, fonts.textMeasurement).heading, 'Segoe UI Semibold');
// Without a measurement that resolves styles the families are unchanged.
assert.deepEqual(resolveDrawnFontFamilies({ heading: 'Aptos Display', body: 'Aptos' }, undefined), { heading: 'Aptos Display', body: 'Aptos' });

// Gallery metrics, quote and timeline slides: validate with the fonts reports no opf/layout-failed and runs the geometry rules.
const metrics = { layout: 'metrics', title: 'Operating metrics', blocks: [{ metric: { value: '42%', label: 'Growth' } }, { metric: { value: '3.1 days', label: 'Cycle time' } }, { metric: { value: '98%', label: 'Uptime' } }, { text: 'All three moved in the right direction this quarter.' }] };
const quote = { layout: 'quote', title: 'In their words', quote: { text: 'Ship the smallest useful thing, then listen.', attribution: 'A. Author', role: 'Head of product' } };
const timeline = { layout: 'timeline', title: 'Rollout', timeline: { events: [{ when: 'Q1', what: 'Pilot' }, { when: 'Q2', what: 'Two teams' }, { when: 'Q3', what: 'Everyone' }] } };
const gallerySlides = deck([metrics, quote, timeline]);
const report = validate(gallerySlides, { fonts, catalogs });
assert.deepEqual(failed(report), [], JSON.stringify(failed(report), null, 1));
assert.equal(report.checks.layout, 'measured');
// The slides the renderer draws are the ones validate measured: toSvg draws all three with the same handle.
assert.equal(toSvg(gallerySlides, { fonts }).length, 3);
// Pagination measures the same way: nothing fails or splits.
assert.equal(paginate(gallerySlides, { fonts, catalogs }).presentation.slides.length, 3);

// A family no font resolves still fails the layout, and says why.
const unknown = validate(deck([metrics], { design: { fontScheme: { heading: 'No Such Family', body: 'No Such Family' } } }), { fonts, catalogs });
assert.equal(failed(unknown).length, 1, JSON.stringify(unknown.findings.map((finding) => finding.ruleId)));
assert.match(failed(unknown)[0].message, /No Such Family/);

console.log('validate font context: ok');
