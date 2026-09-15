import * as hb from 'harfbuzzjs';

// Diagnostic adapter only: one supplied static SFNT face, one horizontal script
// run, default features. This is not a replacement font registry or bidi engine.
export const engineVersion = hb.versionString();
export function createProbeShaper(bytes) {
  const blob = new hb.Blob(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const face = new hb.Face(blob), font = new hb.Font(face), buffer = new hb.Buffer();
  font.setScale(face.upem, face.upem);
  return {
    unitsPerEm: face.upem,
    shape(text) {
      if (typeof text !== 'string' || !text.isWellFormed()) throw new TypeError('Supply well-formed source text.');
      buffer.reset();
      // addText uses hb_buffer_add_utf16: clusters index the original JS string.
      // Do not normalize, trim, rewrite or reconstruct the source from glyphs.
      buffer.addText(text);
      buffer.setLanguage('und');
      buffer.guessSegmentProperties();
      hb.shape(font, buffer);
      const positions = buffer.getGlyphPositions();
      const glyphs = buffer.getGlyphInfos().map((info, index) => ({id: info.codepoint, cluster: info.cluster, ...positions[index]}));
      let x = 0, y = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const glyph of glyphs) {
        const bounds = font.glyphExtents(glyph.id);
        if (bounds && bounds.width !== 0 && bounds.height !== 0) {
          const left = x + glyph.xOffset + bounds.xBearing, top = y + glyph.yOffset + bounds.yBearing;
          minX = Math.min(minX, left, left + bounds.width); maxX = Math.max(maxX, left, left + bounds.width);
          minY = Math.min(minY, top, top + bounds.height); maxY = Math.max(maxY, top, top + bounds.height);
        }
        x += glyph.xAdvance; y += glyph.yAdvance;
      }
      return {glyphs, width: x / face.upem, outline: Number.isFinite(minX)
        ? {x: minX / face.upem, y: -maxY / face.upem, width: (maxX - minX) / face.upem, height: (maxY - minY) / face.upem} : null};
    },
  };
}
