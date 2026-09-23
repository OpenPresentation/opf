import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import * as core from '@openpresentation/opf';
import {resolveFontFamilies} from '@openpresentation/opf/composition';
import {paginatePresentation} from '@openpresentation/opf/pagination';
import {toPptx} from '../src/index.js';

// FF-35 (font-fidelity-everywhere). Every engine shares one last-resort font
// scheme, `aptos` (core DEFAULT_FONT_SCHEME, engine-defaults.json
// fontScheme.pptx.latin), so core pagination, the renderer, the editor and this
// exporter agree. It only applies when the resolved theme names no font scheme
// (opf docs/design-resolution.md, "Engine default font scheme").
// FF-17: code runs use the shared resolveFontFamilies() code role: the scheme's
// `code`, else Roboto Mono.

const {fontSchemes} = core;

const theme = 'ppt/theme/theme1.xml';
const parts = async (presentation) => unzipSync(new Uint8Array(await toPptx(presentation, {strictAssets: true})));
const themePair = entries => {
  const xml = strFromU8(entries[theme]);
  return {
    major: xml.match(/<a:majorFont><a:latin typeface="([^"]*)"/)?.[1],
    minor: xml.match(/<a:minorFont><a:latin typeface="([^"]*)"/)?.[1],
  };
};
const slideFaces = entries => new Set(Object.entries(entries)
  .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  .flatMap(([, value]) => [...strFromU8(value).matchAll(/<a:latin typeface="([^"]*)"/g)].map(match => match[1])));

const textSlide = {id: 'text', title: 'Title', text: 'Body copy'};
const codeSlide = {id: 'code', layout: 'code-1x', title: 'Rule', code: {source: 'const score = urgency * confidence;', language: 'ts'}};
const bareTheme = {$schema: 'https://openpresentation.org/schema/opf-theme/v1', id: 'bare', name: 'Bare'};

// A custom theme without a font scheme reaches the last resort: aptos.
const bare = await parts({name: 'No font scheme', design: {theme: 'bare'}, catalogs: {themes: {records: [bareTheme]}}, slides: [textSlide]});
assert.deepEqual(themePair(bare), {major: 'Aptos Display', minor: 'Aptos'});
assert.deepEqual([...slideFaces(bare)].sort(), ['Aptos', 'Aptos Display']);

// Parity with core. Once the installed core exports DEFAULT_FONT_SCHEME (FF-35),
// core pagination measures the same deck in exactly the families exported here.
// Published cores without the constant fall back to roboto in pagination, so the
// check waits for them.
if ('DEFAULT_FONT_SCHEME' in core) {
  assert.equal(core.DEFAULT_FONT_SCHEME, 'aptos');
  const measured = new Set();
  paginatePresentation(
    {name: 'No font scheme', design: {theme: 'bare'}, catalogs: {themes: {records: [bareTheme]}}, slides: [textSlide]},
    {textMeasurement: {measure: (text, size, style) => { measured.add(style.fontFamily); return text.length * size * 0.5; }}},
  );
  assert.deepEqual([...measured].sort(), [...slideFaces(bare)].sort());
}

// No design at all: the default `minimal` theme supplies aptos too.
assert.deepEqual(themePair(await parts({name: 'Defaults', slides: [textSlide]})), {major: 'Aptos Display', minor: 'Aptos'});

// An explicit scheme always wins over the last resort.
const roboto = await parts({name: 'Roboto', design: {theme: 'bare', fontScheme: 'roboto'}, catalogs: {themes: {records: [bareTheme]}}, slides: [textSlide]});
assert.deepEqual(themePair(roboto), {major: 'Roboto', minor: 'Roboto'});

// Code runs follow the scheme's code role, else the documented Roboto Mono fallback.
const codeFaces = async fontScheme => slideFaces(await parts({name: 'Code font', design: {fontScheme}, slides: [codeSlide]}));
const fallback = await codeFaces('aptos');
assert.equal(resolveFontFamilies({major: 'Aptos Display', minor: 'Aptos'}).code, 'Roboto Mono');
assert.ok(fallback.has('Roboto Mono') && !fallback.has('Consolas'));
const consolas = await codeFaces({id: 'consolas', code: {family: 'Consolas'}});
assert.deepEqual([...consolas], ['Consolas'], 'A Consolas scheme with a Consolas code role exports only Consolas');
// The bundled record's code role (Consolas once core carries it, FF-17) reaches the runs.
const bundled = fontSchemes.find(record => record.id === 'consolas');
assert.ok((await codeFaces('consolas')).has(resolveFontFamilies(bundled).code));

console.log(JSON.stringify({test: 'default-font-scheme', passed: true, lastResort: 'aptos'}));

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
  const entries = unzipSync(new Uint8Array(await toPptx(deck, {strictAssets: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic)})));
  const fontDiagnostics = diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-font-scheme');
  assert.deepEqual([...slideFaces(entries)].sort(), expected, name);
  assert.deepEqual(fontDiagnostics, expectedDiagnostics(path), name);
  checkCore(deck, expected, fontDiagnostics, name);
}
console.log(JSON.stringify({test: 'default-font-scheme', unresolved: 'default base and one diagnostic'}));
