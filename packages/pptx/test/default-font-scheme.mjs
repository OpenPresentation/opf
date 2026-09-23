import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fontSchemes} from '@openpresentation/opf';
import {resolveFontFamilies} from '@openpresentation/opf/composition';
import {toPptx} from '../src/index.js';

// FF-17 (font-fidelity-everywhere). The exporter's last-resort font scheme is
// `aptos` (engine-defaults.json fontScheme.pptx.latin). Core pagination, the
// renderer and the editor use `roboto`. The difference only applies when the
// resolved theme names no font scheme, and is documented in opf
// docs/design-resolution.md ("Engine default font scheme"). Code runs use the
// shared resolveFontFamilies() code role: the scheme's `code`, else Roboto Mono.

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
