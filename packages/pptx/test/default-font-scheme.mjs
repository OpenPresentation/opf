import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {ENGINE_DEFAULT_FONT_SCHEME, resolveFontFamilies} from '@openpresentation/opf/composition';
import {paginate} from '@openpresentation/opf';
import {toPptx} from '../src/index.js';

// FF-35 (font-fidelity-everywhere), OPF 0.15. Every engine shares one last-resort font
// scheme, core's ENGINE_DEFAULT_FONT_SCHEME (Aptos Display / Aptos, engine-defaults.json),
// so core pagination, the renderer, the editor and this exporter agree. It applies when
// the resolved theme names no font scheme, or a font-scheme reference resolves nowhere.
// FF-17: code runs use the shared resolveFontFamilies() code role: the scheme's
// `code`, else Roboto Mono. Named schemes (roboto, consolas) come from the gallery
// snapshot, which the host registers explicitly (`catalogs: [defaultCatalog]`).

const theme = 'ppt/theme/theme1.xml';
const catalogs = [defaultCatalog];
const parts = async (presentation) => unzipSync(new Uint8Array(await toPptx(presentation, {strictAssets: true, catalogs})));
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
const bareThemes = {custom: {themes: {bare: {name: 'Bare'}}}};

// A custom theme without a font scheme reaches the last resort: the engine default.
const bare = await parts({name: 'No font scheme', design: {theme: 'bare'}, catalogs: bareThemes, slides: [textSlide]});
assert.deepEqual(themePair(bare), {major: 'Aptos Display', minor: 'Aptos'});
assert.deepEqual([...slideFaces(bare)].sort(), ['Aptos', 'Aptos Display']);

// Parity with core: core pagination measures the same deck in exactly the families exported here.
assert.equal(ENGINE_DEFAULT_FONT_SCHEME.major, 'Aptos Display');
assert.equal(ENGINE_DEFAULT_FONT_SCHEME.minor, 'Aptos');
{
  const measured = new Set();
  paginate(
    {name: 'No font scheme', design: {theme: 'bare'}, catalogs: bareThemes, slides: [textSlide]},
    {catalogs, fonts: {textMeasurement: {measure: (text, size, style) => { measured.add(style.fontFamily); return text.length * size * 0.5; }}}},
  );
  assert.deepEqual([...measured].sort(), [...slideFaces(bare)].sort());
}

// No design at all: the engine default supplies the same pair.
assert.deepEqual(themePair(await parts({name: 'Defaults', slides: [textSlide]})), {major: 'Aptos Display', minor: 'Aptos'});

// An explicit scheme always wins over the last resort.
const roboto = await parts({name: 'Roboto', design: {theme: 'bare', fontScheme: 'roboto'}, catalogs: bareThemes, slides: [textSlide]});
assert.deepEqual(themePair(roboto), {major: 'Roboto', minor: 'Roboto'});

// Code runs follow the scheme's code role, else the documented Roboto Mono fallback.
const codeFaces = async fontScheme => slideFaces(await parts({name: 'Code font', design: {fontScheme}, slides: [codeSlide]}));
const fallback = await codeFaces('aptos');
assert.equal(resolveFontFamilies({major: 'Aptos Display', minor: 'Aptos'}).code, 'Roboto Mono');
assert.ok(fallback.has('Roboto Mono') && !fallback.has('Consolas'));
const consolas = await codeFaces({id: 'consolas', code: 'Consolas'});
assert.deepEqual([...consolas], ['Consolas'], 'A Consolas scheme with a Consolas code role exports only Consolas');
// The registered record's code role (Consolas once the catalog carries it, FF-17) reaches the runs.
const registered = defaultCatalog.fontSchemes.consolas;
assert.ok((await codeFaces('consolas')).has(resolveFontFamilies(registered).code));

console.log(JSON.stringify({test: 'default-font-scheme', passed: true, lastResort: 'engine default'}));

// FF-35b, OPF 0.15: one rule for an unresolvable font scheme in every engine. The engine
// default is the base, sibling overrides still apply, and one `unresolved-reference`
// diagnostic names the reference (core's slide context; the same diagnostics core pagination reports).
const unknownCases = [
  ['string id', {design: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'design.fontScheme'],
  ['object id', {design: {fontScheme: {id: 'no-such-scheme'}}}, ['Aptos', 'Aptos Display'], 'design.fontScheme.id'],
  ['object id with a family pair', {design: {fontScheme: {id: 'no-such-scheme', major: 'Inter', minor: 'Inter'}}}, ['Inter'], 'design.fontScheme.id'],
  ['slide design', {slideDesign: {fontScheme: 'no-such-scheme'}}, ['Aptos', 'Aptos Display'], 'slides.0.design.fontScheme'],
  ['theme record', {design: {theme: 'bare-unknown'}, catalogs: {custom: {themes: {'bare-unknown': {name: 'Bare', fontScheme: 'no-such-scheme'}}}}}, ['Aptos', 'Aptos Display'], 'catalogs.custom.themes.bare-unknown.fontScheme'],
  ['inline scheme without id', {design: {fontScheme: {major: 'Inter', minor: 'Inter'}}}, ['Inter'], undefined],
  ['inline code role without id', {design: {fontScheme: {code: 'JetBrains Mono'}}}, ['Aptos', 'Aptos Display'], undefined],
];
const unknownDeck = ({design, slideDesign, catalogs: embedded}) => ({name: 'Unknown font scheme', ...(design ? {design} : {}), ...(embedded ? {catalogs: embedded} : {}), slides: [{id: 't', title: 'Title', text: 'Body', ...(slideDesign ? {design: slideDesign} : {})}, {id: 'u', title: 'Second', text: 'Body'}]});
const fontReferences = diagnostics => diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-reference' && diagnostic.kind === 'fontSchemes')
  .map(({kind, reference, path, fallback}) => ({kind, reference, path, fallback}));
const expectedDiagnostics = path => path ? [{kind: 'fontSchemes', reference: 'no-such-scheme', path, fallback: 'engine-default'}] : [];
// Core pagination agreement.
const corePagination = deck => {
  const diagnostics = [], measured = new Set();
  paginate(structuredClone(deck), {catalogs, onDiagnostic: diagnostic => diagnostics.push(diagnostic), fonts: {textMeasurement: {measure: (text, size, style) => { measured.add(style.fontFamily); return text.length * size * 0.5; }}}});
  return {diagnostics, families: [...measured].sort()};
};
for (const [name, input, expected, path] of unknownCases) {
  const deck = unknownDeck(input), diagnostics = [];
  // strictAssets alone would make the unresolved reference fail the export (strictReferences defaults to it).
  const entries = unzipSync(new Uint8Array(await toPptx(deck, {strictAssets: true, strictReferences: false, catalogs, onDiagnostic: diagnostic => diagnostics.push(diagnostic)})));
  assert.deepEqual([...slideFaces(entries)].sort(), expected, name);
  assert.deepEqual(fontReferences(diagnostics), expectedDiagnostics(path), name);
  const reference = corePagination(deck);
  assert.deepEqual(reference.families, expected, `core pagination: ${name}`);
  assert.deepEqual(fontReferences(reference.diagnostics), fontReferences(diagnostics), `core pagination: ${name}`);
  if (path) await assert.rejects(toPptx(deck, {strictAssets: true, catalogs}), error => error.code === 'unresolved-reference' && error.path === path, `strict export: ${name}`);
}
console.log(JSON.stringify({test: 'default-font-scheme', unresolved: 'engine default base and one diagnostic'}));
