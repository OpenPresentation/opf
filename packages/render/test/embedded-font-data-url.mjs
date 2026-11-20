// Large real script-font data URIs must validate without depending on the runtime's regexp stack.
import assert from 'node:assert/strict';
import { loadFonts } from '../dist/fonts-node.js';
import { toSvg } from './catalog-harness.mjs';

const deck = { design: { fontScheme: 'roboto' }, slides: [{ title: 'Embedded font URL' }] };
const render = face => toSvg(deck, 1, { fonts: { embeddedFonts: [face] } });
const invalid = { code: 'invalid-embedded-font' };
const faceFor = dataUrl => ({ family: 'Unused host face', weight: 400, dataUrl });

// This is the complete, pinned Noto face used by the actual Jpan loader, not an inflated synthetic payload.
const handle = await loadFonts({ pack: 'base', scripts: ['Jpan'] });
const source = handle.registry.selectEmbeddedFonts(face => face.family === 'Noto Sans JP' && face.weight === 400 && !face.italic)[0];
assert.ok(source, 'the actual Japanese regular face is present');
assert.ok(source.dataUrl.length > 1_000_000, 'exercise a genuine multi-megabyte script-font URL');
const font = { ...source, embed: 'always' };
const svg = render(font);
assert.ok(svg.includes(font.dataUrl), 'the complete real font URL is embedded unchanged');
assert.equal(render(font), svg, 'the same face and URL can be rendered again through the cache');
const original = font.dataUrl;
font.dataUrl = `${original.slice(0, -1)}!`;
assert.throws(() => render(font), invalid, 'a malformed final character cannot reuse the old cached URL');
font.dataUrl = 'data:font/ttf;base64,';
assert.throws(() => render(font), invalid, 'an empty replacement cannot reuse the old cache entry');
font.dataUrl = original;
assert.equal(render(font), svg, 'restoring the original exact URL renders normally');
font.family = 'bad";family';
assert.throws(() => render(font), invalid, 'a cached URL does not bypass the family guard');
font.family = source.family;
font.weight = 1001;
assert.throws(() => render(font), invalid, 'a cached URL does not bypass the weight guard');
font.weight = source.weight;
assert.equal(render(font), svg);

// The existing URI syntax is deliberately not a base64 decoder: padding is allowed anywhere, for all four MIME types.
for (const type of ['ttf', 'otf', 'woff', 'woff2']) {
  for (const payload of ['A', '=', '==A=', 'A===A', 'AZaz09+/=']) {
    const face = faceFor(`data:font/${type};base64,${payload}`);
    assert.doesNotThrow(() => render(face), `${type}/${payload}: accept the existing syntax even for an unused face`);
  }
}
const refused = [
  '', 'https://example.com/font.ttf', 'data:image/ttf;base64,A', 'data:application/font-woff;base64,A',
  'data:font/woff3;base64,A', 'data:font/TTF;base64,A', 'DATA:font/ttf;base64,A',
  'data:font/ttf;BASE64,A', 'data:font/ttf;base64,', 'data:font/ttf;base64,A!',
  'data:font/ttf;base64,A A', 'data:font/ttf;base64,A-', 'data:font/ttf;base64,A_',
  ' data:font/ttf;base64,A', 'data:font/ttf;base64,A,',
];
for (const ending of ['\n', '\r', '\r\n', '\u2028', '\u2029', '\u0000', '\t', '\n\n', 'é']) refused.push(`data:font/ttf;base64,A${ending}`);
for (const dataUrl of refused) assert.throws(() => render(faceFor(dataUrl)), invalid, `reject ${JSON.stringify(dataUrl)}`);

// Preserve the former RegExp coercion boundary; these faces are unused, so no font-byte decoder is involved.
assert.doesNotThrow(() => render(faceFor({ toString: () => 'data:font/ttf;base64,A' })));
assert.doesNotThrow(() => render(faceFor(Object('data:font/ttf;base64,A'))));
assert.throws(() => render(faceFor(null)), invalid);
assert.throws(() => render(faceFor(Symbol('font'))), TypeError);
const sentinel = new Error('host URI conversion failed');
assert.throws(() => render(faceFor({ toString() { throw sentinel; } })), error => error === sentinel);

console.log(`Embedded-font data URLs: actual Noto Sans JP ${original.length} characters, whole-byte embedding/cache mutations, four MIME types, exact alphabet/endings and coercion passed.`);
