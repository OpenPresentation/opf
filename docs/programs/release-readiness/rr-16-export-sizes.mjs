// RR-16: do the font sizes the preview draws match the `sz` the PPTX writes, across the example corpus (every slide size)?
// For each example deck that exports, per slide: how many preview font sizes are off PowerPoint's 0.01 pt grid, and whether
// the PPTX names a size the preview does not draw.
//
//   node --import ./scripts/register-local-opf.mjs docs/programs/release-readiness/rr-16-export-sizes.mjs \
//     --render <opf-render checkout> --pptx <opf-pptx checkout>
//
// Set OPF_CORE_DIST to measure another built core (see rr-16-corpus-impact.mjs). Read-only.
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
if (!args.render || !args.pptx) { console.error('Usage: rr-16-export-sizes.mjs --render <opf-render> --pptx <opf-pptx>'); process.exit(2); }
const {examples} = await import('@openpresentation/opf/examples');
const {renderSvgDeck} = await import(pathToFileURL(path.resolve(args.render, 'dist/index.js')).href);
const {toPptx} = await import(pathToFileURL(path.resolve(args.pptx, 'dist/index.js')).href);
const {unzipSync} = createRequire(path.resolve(args.pptx, 'package.json'))('fflate');
const decoder = new TextDecoder();
let decks = 0, slides = 0, previewSizesOffGrid = 0, slidesWithPptxOnlySize = 0;
const samples = [];
for (const {file, deck} of examples) {
  let svgs, zip;
  try {
    svgs = renderSvgDeck(deck, {trace: false});
    zip = unzipSync(new Uint8Array(await toPptx(deck)));
  } catch { continue; } // a deck that does not export (for example, an asset the export cannot read) is not measured
  decks++;
  for (const [index, svg] of svgs.entries()) {
    slides++;
    const preview = new Set(), written = new Set();
    for (const [, px] of svg.matchAll(/font-size="([\d.]+)"/g)) {
      const hundredths = Number(px) * 75; // px * 0.75 pt * 100; the preview prints px to 0.001, so allow 0.06
      if (Math.abs(hundredths - Math.round(hundredths)) > 0.06) previewSizesOffGrid++;
      preview.add(Math.round(hundredths));
    }
    const xml = decoder.decode(zip[`ppt/slides/slide${index + 1}.xml`] ?? new Uint8Array());
    for (const [, sz] of xml.matchAll(/<a:(?:rPr|endParaRPr|defRPr)\b[^>]*\bsz="(\d+)"/g)) written.add(Number(sz));
    const extra = [...written].filter(size => !preview.has(size));
    if (extra.length) { slidesWithPptxOnlySize++; if (samples.length < 10) samples.push(`${file.replace('examples/', '')}#${index}: sz ${extra.slice(0, 4)} not drawn by the preview`); }
  }
}
console.log(JSON.stringify({decksExported: decks, slides, previewSizesOffGrid, slidesWithPptxOnlySize}, null, 2));
if (samples.length) console.log(samples.join('\n'));
