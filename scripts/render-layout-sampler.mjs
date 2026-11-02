// Renders every slide of examples/technical/layout-sampler.opf.json to PNG, named by slide id, for before/after
// layout reviews: `node scripts/render-layout-sampler.mjs <out dir> [scale]`.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gallery} from '@openpresentation/gallery';
import {toPng, toSvg} from '@openpresentation/opf-render';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? 'artifacts/layout-sampler');
const scale = Number(process.argv[3] ?? '1');
const deck = JSON.parse(readFileSync(path.join(root, 'examples/technical/layout-sampler.opf.json'), 'utf8'));
// The deck embeds the records it was written with; drop them so the render shows the gallery of this checkout.
delete deck.catalogs;
mkdirSync(out, {recursive: true});
const svgs = toSvg(deck, {catalogs: [gallery]});
for (const [index, svg] of svgs.entries()) {
  writeFileSync(path.join(out, `${deck.slides[index].id}.png`), await toPng(svg, {scale}));
}
console.log(`${svgs.length} slides -> ${out}`);
