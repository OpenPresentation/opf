// FF-35 (font-fidelity-everywhere) / FA-21: one shared last-resort font scheme for every engine, core's
// ENGINE_DEFAULT_FONT_SCHEME (Aptos Display / Aptos, code, no catalog lookup). A custom theme without a font scheme
// previews in the same fonts that core pagination, opf-editor and opf-pptx export use, and takes the same Aptos
// substitution path as a document with no design at all. Documents that name gallery records (`roboto`, `code-1x`)
// render with the gallery registered as the host catalog (./catalog-harness.mjs).
import assert from 'node:assert/strict';
import {ENGINE_DEFAULT_FONT_SCHEME, resolveFontFamilies} from '@openpresentation/opf/composition';
import {paginate} from '@openpresentation/opf/pagination';
import {catalogs, defaultCatalog, engineDefaults, toPng, toSvg} from './catalog-harness.mjs';
import { loadFonts } from '../dist/fonts-node.js';

// Parity with core's exported engine default: the renderer re-exports it, and it draws as the gallery's aptos scheme.
assert.deepEqual(engineDefaults.fontScheme, ENGINE_DEFAULT_FONT_SCHEME);
assert.deepEqual(resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME), {heading: 'Aptos Display', body: 'Aptos', code: 'Roboto Mono'});
assert.deepEqual(resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME), resolveFontFamilies(defaultCatalog.fontSchemes.aptos));

const slide = { id: 't', title: 'Quarterly operating review', text: 'Revenue grew in every region.' };
const custom = { name: 'Theme without font scheme', design: { theme: 'bare' }, catalogs: { custom: { themes: { bare: { name: 'Bare' } } } }, slides: [slide] };
const noDesign = { name: 'No design', slides: [slide] };
const families = svg => [...new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map(match => match[1]))].sort();

// Estimated layout: the SVG names the Aptos families, as a document with no design does.
assert.deepEqual(families(toSvg(custom, 1)), ['Aptos Display, sans-serif', 'Aptos, sans-serif']);
assert.deepEqual(families(toSvg(custom, 1)), families(toSvg(noDesign, 1)));
// A deck font scheme still wins over the last resort.
assert.deepEqual(families(toSvg({ ...custom, design: { theme: 'bare', fontScheme: 'roboto' } }, 1)), ['Roboto, sans-serif']);
// Aptos is not openly licensed and is not bundled. The default raster engine draws the
// unavailable family with its bundled sans-serif fallback.
assert.ok((await toPng(toSvg(custom, 1), { scale: 0.25 })).byteLength > 0);

// Measured layout takes the FF-31 font policy path (owner policy 2026-09-29): Aptos previews with
// Intos and Aptos Display with Intos Display, both metric.
const visual = await loadFonts({ pack: 'office', substitutionPolicy: 'visual' });
const measured = toSvg(custom, 1, {fonts: visual});
assert.deepEqual(families(measured), ['Intos Display, sans-serif', 'Intos, sans-serif']);
assert.deepEqual(
  visual.registry.substitutions.map(entry => `${entry.requestedFamily}->${entry.resolvedFamily}:${entry.compatibility}`).sort(),
  ['Aptos Display->Intos Display:metric', 'Aptos->Intos:metric'],
);
visual.registry.clearSubstitutions();
assert.deepEqual(families(toSvg(noDesign, 1, {fonts: visual})), families(measured));
assert.deepEqual(visual.registry.substitutions.map(entry => entry.requestedFamily).sort(), ['Aptos', 'Aptos Display']);
// The metric office registry previews the default scheme with Intos, and the same measured SVG comes out.
const metric = await loadFonts({ pack: 'office' });
for (const deck of [custom, noDesign]) assert.deepEqual(families(toSvg(deck, 1, {fonts: metric})), families(measured));
// With only the base pack there is no Aptos substitute, so measured preview fails explicitly.
const baseMetric = await loadFonts({ pack: 'base', substitutionPolicy: 'metric' });
for (const deck of [custom, noDesign]) assert.throws(() => toSvg(deck, 1, {fonts: baseMetric}), { code: 'font-unavailable' });

console.log('shared engine default font scheme (Aptos Display / Aptos): estimated and measured previews match the no-design path');

// FF-35b: one rule for an unresolvable font scheme in every engine. The engine default font scheme is the base, sibling
// overrides still apply, and one `unresolved-reference` diagnostic names the reference. Same table as opf
// packages/javascript/test/font-scheme-defaults.test.mjs.
const unknownCases = [
  ['string id', {design: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'design.fontScheme'],
  ['object id', {design: {fontScheme: {id: 'no-such-scheme'}}}, ['Aptos', 'Aptos Display'], 'design.fontScheme.id'],
  ['object id with a family pair', {design: {fontScheme: {id: 'no-such-scheme', major: 'Inter', minor: 'Inter'}}}, ['Inter'], 'design.fontScheme.id'],
  ['slide design', {slideDesign: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'slides.0.design.fontScheme'],
  ['theme record', {design: {theme: 'bare-unknown'}, catalogs: {custom: {themes: {'bare-unknown': {name: 'Bare', fontScheme: 'no-such-scheme'}}}}}, ['Aptos', 'Aptos Display'], 'catalogs.custom.themes.bare-unknown.fontScheme'],
  ['inline scheme without id', {design: {fontScheme: {major: 'Inter', minor: 'Inter'}}}, ['Inter'], undefined],
  ['inline code role without id', {design: {fontScheme: {code: 'JetBrains Mono'}}}, ['Aptos', 'Aptos Display'], undefined],
];
const unknownDeck = ({design, slideDesign, catalogs: groups}) => ({name: 'Unknown font scheme', ...(design ? {design} : {}), ...(groups ? {catalogs: groups} : {}), slides: [{id: 't', title: 'Title', text: 'Body', ...(slideDesign ? {design: slideDesign} : {})}, {id: 'u', title: 'Second', text: 'Body'}]});
const expectedDiagnostics = path => path ? [{code: 'unresolved-reference', kind: 'fontSchemes', path, reference: 'no-such-scheme', fallback: 'engine-default'}] : [];
const essentials = diagnostics => diagnostics.map(({code, kind, path, reference, fallback}) => ({code, kind, path, reference, fallback}));
// Core pagination agreement: `paginate` measures with the fonts handle it is given (and the same host catalogs), so the families it
// asks for and the diagnostics it reports are the ones the renderer resolves.
const corePagination = deck => {
  const diagnostics = [], measured = new Set();
  paginate(structuredClone(deck), {catalogs, onDiagnostic: diagnostic => diagnostics.push(diagnostic), fonts: {textMeasurement: {measure: (text, size, style) => { measured.add(style.fontFamily); return text.length * size * 0.5; }}}});
  return {diagnostics, families: [...measured].sort()};
};
const checkCore = (deck, expected, diagnostics, name) => {
  const reference = corePagination(deck);
  assert.deepEqual(reference.families, expected, `core pagination: ${name}`);
  assert.deepEqual(reference.diagnostics, diagnostics, `core pagination: ${name}`);
};
for (const [name, input, expected, path] of unknownCases) {
  const deck = unknownDeck(input), diagnostics = [];
  const svg = toSvg(deck, 1, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.deepEqual(families(svg).map(stack => stack.replace(/, sans-serif$/, '')).sort(), expected, name);
  assert.deepEqual(essentials(diagnostics), expectedDiagnostics(path), name);
  for (const diagnostic of diagnostics) assert.match(diagnostic.message, /no-such-scheme/, `${name}: the message names the reference`);
  checkCore(deck, expected, diagnostics, name);
}
// A code role on an unresolved object reference still applies.
const codeDeck = {name: 'Code', design: {fontScheme: {id: 'no-such-scheme', code: 'JetBrains Mono'}}, slides: [{id: 'c', layout: 'code-1x', title: 'Rule', code: {source: 'const x = 1;', language: 'ts'}}]};
assert.ok(families(toSvg(codeDeck, 1)).includes('JetBrains Mono, monospace'));
console.log('unresolved font schemes: engine default base and one unresolved-reference diagnostic, as in every engine');
