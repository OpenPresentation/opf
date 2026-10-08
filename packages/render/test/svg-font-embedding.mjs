// RR-61: the fonts handle is safe to pass to every preview. An SVG embeds as @font-face data only the faces its own text draws
// (family, weight and style), whatever list it is given; `embed: "always"` keeps a face in every SVG; `embedFonts: false` embeds
// none. The PDF export still gets every face its pages draw from the SVG's own @font-face data.
import assert from 'node:assert/strict';
import { loadFonts } from '../dist/fonts-node.js';
import { renderSlideSvg, renderSvg, svgToPdf } from '../dist/index.js';

const fonts = await loadFonts({ pack: 'office' });
const eager = new Set(fonts.registry.embeddedFonts.map(face => face.family));
assert.ok(['Carlito', 'Tinos', 'Arimo', 'Roboto'].every(family => eager.has(family)), 'the eager list holds the npm pack families');

const schemeDeck = (family, slides) => ({
  design: { fontScheme: 'x-one' },
  catalogs: { custom: { fontSchemes: { 'x-one': { name: family, app: 'powerpoint', languageFamily: 'latin', languages: [], major: family, minor: family, textSample: 'x', type: 'sans-serif' } } } },
  slides,
});
const faces = svg => [...svg.matchAll(/@font-face\{font-family:"([^"]+)";font-weight:(\d+);font-style:(\w+)/g)].map(match => `${match[1]} ${match[2]} ${match[3]}`).sort();
const families = svg => [...new Set(faces(svg).map(face => face.replace(/ \d+ \w+$/, '')))];

// A slide using one family embeds only that family, and only the weights and styles it draws.
const carlito = schemeDeck('Carlito', [
  { title: 'Quarterly review', text: 'Revenue grew in every region.' },
  { title: 'Emphasis', text: [{ text: 'Plain, then ' }, { text: 'italic', italic: true }] },
]);
const [plain, italic] = renderSvg(carlito, { fonts });
assert.deepEqual(families(plain), ['Carlito'], 'a Carlito slide embeds Carlito only');
assert.ok(faces(plain).every(face => face.endsWith(' normal')), `no italic face on a slide without italic text: ${faces(plain)}`);
assert.ok(faces(italic).includes('Carlito 400 italic'), 'an italic run brings the italic face');
assert.equal(renderSlideSvg(carlito, 0, { fonts }), plain, 'renderSlideSvg embeds the same faces');
const tinos = renderSlideSvg(schemeDeck('Tinos', [{ title: 'Quarterly review', text: 'Revenue grew in every region.' }]), 0, { fonts });
assert.deepEqual(families(tinos), ['Tinos'], 'a Tinos slide embeds Tinos only');

// Size: the faces a slide draws, not every face of the handle.
const everyFace = fonts.embeddedFonts.reduce((total, face) => total + face.dataUrl.length, 0);
assert.ok(plain.length < everyFace / 5, `the Carlito slide (${(plain.length / 1e6).toFixed(2)} MB) is far below every face of the handle (${(everyFace / 1e6).toFixed(2)} MB)`);

// A plain embeddedFonts list (no embed flags) is filtered the same way; embed: "always" keeps a face in every SVG.
const arimo = fonts.embeddedFonts.find(face => face.family === 'Arimo' && face.weight === 400 && !face.italic);
const list = { textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts.map(({ embed, ...face }) => face) };
assert.deepEqual(families(renderSlideSvg(carlito, 0, { fonts: list })), ['Carlito']);
const always = { ...list, embeddedFonts: [...list.embeddedFonts, { ...arimo, embed: 'always' }] };
assert.deepEqual(faces(renderSlideSvg(carlito, 0, { fonts: always })).filter(face => face.startsWith('Arimo')), ['Arimo 400 normal'], 'embed: "always" is embedded on a slide that does not draw it');

// embedFonts: false: the handle still measures, nothing is embedded, and the markup is otherwise the same.
const bare = renderSlideSvg(carlito, 0, { fonts, embedFonts: false });
assert.doesNotMatch(bare, /@font-face/);
assert.equal(bare, renderSlideSvg(carlito, 0, { fonts: { textMeasurement: fonts.textMeasurement } }));
assert.equal(bare, plain.replace(/<style>[^<]*<\/style>(<metadata>[^<]*<\/metadata>)?\n/, ''), 'only the style sheet and its license metadata differ');

// The vector PDF of the self-contained SVGs embeds Carlito from their @font-face data alone (no font files, no bundled pack).
const embedded = [];
const pdf = await svgToPdf([plain, italic], { fonts: { fontFiles: [], useBundledFonts: false }, onDiagnostic: diagnostic => { if (diagnostic.code === 'pdf-font-embedded') embedded.push(diagnostic); } });
assert.equal(Buffer.from(pdf.subarray(0, 4)).toString(), '%PDF');
assert.ok(embedded.length === 3 && embedded.every(diagnostic => /^carlito$/i.test(diagnostic.family)), `the PDF embeds the three Carlito faces the pages draw (regular, bold, italic): ${embedded.map(diagnostic => diagnostic.family)}`);

console.log(`SVG font embedding passed: one family per one-family slide (Carlito ${faces(plain).length} faces, ${(plain.length / 1e6).toFixed(2)} MB vs ${(everyFace / 1e6).toFixed(1)} MB of faces in the handle), embed "always", embedFonts false, PDF from @font-face data.`);
