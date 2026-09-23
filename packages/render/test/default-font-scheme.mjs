// FF-35 (font-fidelity-everywhere): one shared last-resort font scheme, aptos, for
// every engine. A custom theme without a font scheme previews in the same fonts
// that core pagination, opf-editor and opf-pptx export use, and takes the same
// Aptos substitution path as a document with no design at all.
import assert from 'node:assert/strict';
import * as core from '@openpresentation/opf';
import { engineDefaults, renderSvg, svgToPng } from '../dist/index.js';
import { prepareNodeFonts } from '../dist/fonts-node.js';

assert.equal(engineDefaults.fontScheme.pptx.latin, 'aptos');
// Parity with core's exported constant once the installed core publishes it.
if ('DEFAULT_FONT_SCHEME' in core) assert.equal(engineDefaults.fontScheme.pptx.latin, core.DEFAULT_FONT_SCHEME);
// Kept only as the default for a future Google Slides target; no renderer path reads it.
assert.equal(engineDefaults.fontScheme.google.latin, 'roboto');

const slide = { id: 't', title: 'Quarterly operating review', text: 'Revenue grew in every region.' };
const bare = { $schema: 'https://openpresentation.org/schema/opf-theme/v1', id: 'bare', name: 'Bare' };
const custom = { name: 'Theme without font scheme', design: { theme: 'bare' }, catalogs: { themes: { records: [bare] } }, slides: [slide] };
const noDesign = { name: 'No design', slides: [slide] };
const families = svg => [...new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map(match => match[1]))].sort();

// Estimated layout: the SVG names the Aptos families, as the default minimal theme does.
assert.deepEqual(families(renderSvg(custom)), ['Aptos Display, sans-serif', 'Aptos, sans-serif']);
assert.deepEqual(families(renderSvg(custom)), families(renderSvg(noDesign)));
// A deck font scheme still wins over the last resort.
assert.deepEqual(families(renderSvg({ ...custom, design: { theme: 'bare', fontScheme: 'roboto' } })), ['Roboto, sans-serif']);
// Aptos is not openly licensed and is not bundled. The default raster engine draws the
// unavailable family with its bundled sans-serif fallback.
assert.ok((await svgToPng(renderSvg(custom), { scale: 0.25 })).byteLength > 0);

// Measured layout takes the FF-31 font policy path (provisional, owner may revise): Aptos previews
// with Roboto and Aptos Display with Carlito, both visual.
const visual = await prepareNodeFonts({ pack: 'office', substitutionPolicy: 'visual' });
const measured = renderSvg(custom, visual.options);
assert.deepEqual(families(measured), ['Carlito, sans-serif', 'Roboto, sans-serif']);
assert.deepEqual(
  visual.registry.substitutions.map(entry => `${entry.requestedFamily}->${entry.resolvedFamily}:${entry.compatibility}`).sort(),
  ['Aptos Display->Carlito:visual', 'Aptos->Roboto:visual'],
);
visual.registry.clearSubstitutions();
assert.deepEqual(families(renderSvg(noDesign, visual.options)), families(measured));
assert.deepEqual(visual.registry.substitutions.map(entry => entry.requestedFamily).sort(), ['Aptos', 'Aptos Display']);
// Without a visual substitution policy there is no metric Aptos substitute, so measured
// preview fails explicitly, exactly as it already does for a document with no design.
const metric = await prepareNodeFonts({ pack: 'office' });
for (const deck of [custom, noDesign]) assert.throws(() => renderSvg(deck, metric.options), { code: 'font-unavailable' });

console.log('shared default font scheme (aptos): estimated and measured previews match the default theme path');

// FF-35b: one rule for an unresolvable font scheme in every engine. The default
// (aptos) record is the base, sibling overrides still apply, and one
// `unresolved-font-scheme` diagnostic names the reference. Same table as opf
// packages/javascript/test/font-scheme-defaults.test.mjs.
const unknownCases = [
  ['string id', {design: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'design.fontScheme'],
  ['object id', {design: {fontScheme: {id: 'no-such-scheme'}}}, ['Aptos', 'Aptos Display'], 'design.fontScheme'],
  ['object id with a family pair', {design: {fontScheme: {id: 'no-such-scheme', major: 'Inter', minor: 'Inter'}}}, ['Inter'], 'design.fontScheme'],
  ['slide design', {slideDesign: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'slides.0.design.fontScheme'],
  ['theme record', {design: {theme: 'bare-unknown'}, catalogs: {themes: {records: [{$schema: 'https://openpresentation.org/schema/opf-theme/v1', id: 'bare-unknown', name: 'Bare', fontScheme: 'no-such-scheme'}]}}}, ['Aptos', 'Aptos Display'], 'design.theme'],
  ['inline scheme without id', {design: {fontScheme: {major: 'Inter', minor: 'Inter'}}}, ['Inter'], undefined],
  ['inline code role without id', {design: {fontScheme: {code: {family: 'JetBrains Mono'}}}}, ['Aptos', 'Aptos Display'], undefined],
];
const unknownDeck = ({design, slideDesign, catalogs}) => ({name: 'Unknown font scheme', ...(design ? {design} : {}), ...(catalogs ? {catalogs} : {}), slides: [{id: 't', title: 'Title', text: 'Body', ...(slideDesign ? {design: slideDesign} : {})}, {id: 'u', title: 'Second', text: 'Body'}]});
const expectedDiagnostics = path => path ? [{code: 'unresolved-font-scheme', path, id: 'no-such-scheme', fallback: 'aptos', message: "Font scheme 'no-such-scheme' is not in the inline or bundled catalogs; using the default font scheme 'aptos'."}] : [];
// Core pagination agreement, checked once the installed core exports
// resolveFontSchemeReference (opf after FF-35b). Published core 0.11.0 lacks it,
// so the check is skipped until the sibling installs a core release that has it.
const corePagination = deck => {
  const diagnostics = [], measured = new Set();
  core.paginatePresentation(structuredClone(deck), {onDiagnostic: diagnostic => diagnostics.push(diagnostic), textMeasurement: {measure: (text, size, style) => { measured.add(style.fontFamily); return text.length * size * 0.5; }}});
  return {diagnostics, families: [...measured].sort()};
};
const checkCore = (deck, expected, diagnostics, name) => {
  if (!('resolveFontSchemeReference' in core)) return;
  const reference = corePagination(deck);
  assert.deepEqual(reference.families, expected, `core pagination: ${name}`);
  assert.deepEqual(reference.diagnostics, diagnostics, `core pagination: ${name}`);
};
for (const [name, input, expected, path] of unknownCases) {
  const deck = unknownDeck(input), diagnostics = [];
  const svg = renderSvg(deck, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.deepEqual(families(svg).map(stack => stack.replace(/, sans-serif$/, '')).sort(), expected, name);
  assert.deepEqual(diagnostics, expectedDiagnostics(path), name);
  checkCore(deck, expected, diagnostics, name);
}
// A code role on an unresolved object reference still applies.
const codeDeck = {name: 'Code', design: {fontScheme: {id: 'no-such-scheme', code: {family: 'JetBrains Mono'}}}, slides: [{id: 'c', layout: 'code-1x', title: 'Rule', code: {source: 'const x = 1;', language: 'ts'}}]};
assert.ok(families(renderSvg(codeDeck)).includes('JetBrains Mono, monospace'));
console.log('unresolved font schemes: default base and one diagnostic, as in every engine');
