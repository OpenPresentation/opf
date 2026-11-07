// node stats.mjs <sweep-dir>: each deck's composed arrangement as opf-render binds it (core composeSlide): design, recipe, size, and the
// facts the SmartArt domain reads (lines per entry, stable breaks, fill, ink). Writes <sweep-dir>/stats.json.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/render/package.json');
const { resolvePresentation } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/render/src/svg.js');
const { gallery } = await import(new URL('file:///' + req.resolve('@openpresentation/gallery').replace(/\\/g, '/')));
// The CLI's fonts (the bundled faces, so text is measured as the export measures it).
const { loadFonts } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/render/src/fonts-node.js');
const fonts = await loadFonts({ pack: 'office' });
const dir = process.argv[2], out = {};
for (const file of readdirSync(`${dir}/decks`).filter(name => name.endsWith('.opf.json'))) {
  const deck = JSON.parse(readFileSync(`${dir}/decks/${file}`, 'utf8')), id = file.replace(/\.opf\.json$/, '');
  try {
    const resolved = resolvePresentation(deck, { catalogs: [gallery], validate: false, fonts, ...(fonts?.textMeasurement ? { textMeasurement: fonts.textMeasurement } : {}) });
    const a = resolved.slides[0]?.geometry?.arrangements?.[0];
    out[`${id}-1`] = a ? { design: a.design, recipe: a.layout?.design, compact: a.layout?.compact, lines: a.smartArt.lines, stable: a.smartArt.stable, fill: a.smartArt.fill, ink: a.smartArt.ink, widest: a.smartArt.widest, fontSize: a.fontSize, frame: a.frame } : { design: 'list' };
  } catch (error) { out[`${id}-1`] = { error: String(error.message ?? error) }; }
}
writeFileSync(`${dir}/stats.json`, JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'decks');
