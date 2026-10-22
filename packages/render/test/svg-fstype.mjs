// RR-76: an SVG never embeds a face whose OS/2 fsType forbids it. Restricted License (0x0002) and bitmap-only (0x0200: an SVG
// carries outlines) faces are left out of @font-face; the SVG still names the family (a viewer without the font draws the
// generic family) and `font-embedding-restricted` says why. No-subsetting (0x0100), preview & print (0x0004) and editable
// (0x0008) faces are embedded (no-subsetting ones whole). The fsType is read from the data URL without decoding the face.
import assert from 'node:assert/strict';
import { loadFonts } from '../dist/fonts-node.js';
import { loadFonts as loadBrowserFonts } from '../dist/fonts-browser.js';
import { dataUrlFsType, fsTypeOf } from '../dist/font-fstype.js';
import { toSvg } from '../dist/index.js';

const base = await loadFonts({ pack: 'base' });
const described = base.registry.describeFaces(), exported = base.registry.exportFaces();
const robotoAt = (weight) => exported[described.findIndex((face) => face.family === 'Roboto' && face.weight === weight && !face.italic)].data;
const withFsType = (value, weight = 400) => {
  const copy = Uint8Array.from(robotoAt(weight)), view = new DataView(copy.buffer);
  for (let index = 0; index < view.getUint16(4); index++) { const at = 12 + index * 16; if (String.fromCharCode(...copy.subarray(at, at + 4)) === 'OS/2') view.setUint16(view.getUint32(at + 8) + 8, value); }
  return copy;
};
const dataUrl = (bytes) => `data:font/ttf;base64,${Buffer.from(bytes).toString('base64')}`;

// The data URL reader agrees with the byte reader, for every bundled face and for each permission bit.
for (const face of base.embeddedFonts) assert.equal(dataUrlFsType(face.dataUrl), fsTypeOf(new Uint8Array(Buffer.from(face.dataUrl.split(',')[1], 'base64'))), face.family);
for (const value of [0, 0x0002, 0x0004, 0x0008, 0x0100, 0x0200, 0x0302]) assert.equal(dataUrlFsType(dataUrl(withFsType(value))), value);

const deck = { name: 'Licensed', design: { fontScheme: 'x-one' }, catalogs: { custom: { fontSchemes: { 'x-one': { name: 'Host', app: 'powerpoint', languageFamily: 'latin', languages: [], major: 'Host', minor: 'Host', textSample: 'x', type: 'sans-serif' } } } }, slides: [{ title: 'Quarterly review', text: 'Revenue grew.' }] };
const render = async (value, load = loadFonts, extra = {}) => {
  const fonts = await load({ pack: 'base', ...extra, faces: [{ data: withFsType(value), family: 'Host', weight: 400 }, { data: withFsType(value, 700), family: 'Host', weight: 700 }] });
  const diagnostics = [];
  const svg = toSvg(deck, 1, { fonts, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  return { svg, restricted: diagnostics.filter((diagnostic) => diagnostic.code === 'font-embedding-restricted').flatMap((diagnostic) => diagnostic.faces.map((face) => ({ ...face, message: diagnostic.message }))), fonts };
};
const hostFaces = (svg) => [...svg.matchAll(/@font-face\{font-family:"Host";font-weight:(\d+);[^}]*base64,([^"]+)"/g)].map(([, weight, base64]) => [Number(weight), base64.length]);

// Restricted and bitmap-only: never embedded, the family is still named, one diagnostic per face.
for (const value of [0x0002, 0x0200, 0x0302]) {
  const { svg, restricted } = await render(value);
  assert.deepEqual(hostFaces(svg), [], `fsType 0x${value.toString(16)}: no @font-face for the face`);
  assert.match(svg, /font-family="Host, sans-serif"/, 'the SVG still names the family, so the generic family draws it');
  assert.deepEqual(restricted.map((diagnostic) => [diagnostic.fontFamily, diagnostic.weight, diagnostic.fsType]).sort(), [['Host', 400, value], ['Host', 700, value]]);
  assert.match(restricted[0].message, /'Host' forbid embedding \(OS\/2 fsType\)/);
}

// Installable, preview & print, editable and no-subsetting faces are embedded (a host face is never subset, RR-65).
for (const value of [0, 0x0004, 0x0008, 0x0100]) {
  const { svg, restricted } = await render(value);
  assert.deepEqual(hostFaces(svg).map(([weight]) => weight).sort(), [400, 700], `fsType 0x${value.toString(16)}: embedded`);
  // fsType 0 leaves the bytes identical to the bundled Roboto, which RR-65 may subset; changed bytes are a host face, kept whole.
  if (value) for (const [weight, length] of hostFaces(svg)) assert.equal(length, Buffer.from(withFsType(value, weight)).toString('base64').length, `the ${weight} face is embedded whole`);
  assert.deepEqual(restricted, []);
}

// The browser handle follows the same rule.
{
  class Face { constructor(family, bytes, descriptors) { Object.assign(this, { family, bytes, descriptors }); } async load() { return this; } }
  const set = new Set(); set.ready = Promise.resolve();
  const document = { fonts: set, defaultView: { FontFace: Face } };
  // The browser handle holds what the host gives it: the base faces (the deck's code font is Roboto Mono) and the host faces.
  const baseFaces = described.map((face, index) => ({ family: face.family, weight: face.weight, italic: face.italic, data: exported[index].data }));
  const browserLoad = ({ faces }) => loadBrowserFonts({ faces: [...baseFaces, ...faces], document });
  const { svg, restricted } = await render(0x0002, browserLoad);
  assert.deepEqual(hostFaces(svg), [], 'the browser handle never embeds a restricted face');
  assert.equal(restricted.length, 2);
}

// Text as paths: a restricted run stays text and is still not embedded.
{
  const fonts = await loadFonts({ pack: 'base', faces: [{ data: withFsType(0x0002), family: 'Host', weight: 400 }, { data: withFsType(0x0002, 700), family: 'Host', weight: 700 }] });
  const svg = toSvg(deck, 1, { fonts, text: "paths", onDiagnostic: () => {} });
  assert.match(svg, /<text [^>]*font-family="Host, sans-serif"[^>]*>Quarterly review<\/text>/, 'the restricted run stays text');
  assert.deepEqual(hostFaces(svg), [], 'and its face is not embedded');
}
console.log('SVG fsType: restricted and bitmap-only faces are never embedded (Node and browser handles, text as paths), named with a diagnostic; permitted faces are embedded.');
