// RR-65: macOS small-text rasterization needs named reference glyphs absent from the authored text.
// Check actual subset font contents, not just HarfBuzz flags, across office regular/bold/italic faces.
import assert from 'node:assert/strict';
import { create } from 'fontkit';
import { loadFonts } from '../dist/fonts-node.js';

const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual' });
const text = 'Revenue 12% — affine';
assert.ok(!/[Xo]/.test(text), 'the authored sample has neither reference character');
let checked = 0;
for (const face of fonts.embeddedFonts.filter(face => ['Intos', 'Intos Display'].includes(face.family))) {
  const whole = create(Buffer.from(face.dataUrl.split(',')[1], 'base64'));
  const url = fonts.subsets.subsetDataUrl(face, [...text].map(character => character.codePointAt(0)));
  const cut = create(Buffer.from(url.split(',')[1], 'base64'));
  for (const character of ['X', 'o']) {
    const glyph = cut.glyphForCodePoint(character.codePointAt(0));
    assert.ok(glyph.id > 0, `${face.family} ${face.weight}: retains ${character}`);
    assert.equal(glyph.name, whole.glyphForCodePoint(character.codePointAt(0)).name, 'the actual glyph name is preserved');
  }
  assert.ok(cut.numGlyphs * 10 < whole.numGlyphs, 'reference glyphs do not prevent a small subset');
  const shape = font => font.layout(text).positions.map(({ xAdvance, yAdvance, xOffset, yOffset }) => [xAdvance, yAdvance, xOffset, yOffset]);
  assert.deepEqual(shape(cut), shape(whole), 'authored sample shaping remains identical');
  checked++;
}
assert.equal(checked, 8, 'regular, bold, italic and bold italic in Intos and Intos Display');
console.log(`Subset reference glyphs: ${checked} actual font subsets retain named X/o and identical sample shaping.`);
