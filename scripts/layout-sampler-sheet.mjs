// Tiles PNGs into one labelled contact sheet: `node scripts/layout-sampler-sheet.mjs <dir> <out.png> [columns] [ids...]`.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {toPng} from '@openpresentation/opf-render';

const fail = (message, code = 1) => {
  console.error(`layout-sampler-sheet: ${message}`);
  process.exit(code);
};
const [dir, out, cols = '4', ...only] = process.argv.slice(2);
if (!dir || !out) fail('usage: node scripts/layout-sampler-sheet.mjs <dir> <out.png> [columns] [ids...]', 2);
const columns = Number(cols), w = 480, h = 270, label = 28;
if (!Number.isInteger(columns) || columns < 1) fail(`columns must be a whole number of 1 or more, not ${JSON.stringify(cols)}.`, 2);
let found;
try {
  found = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png')).sort();
} catch (error) {
  fail(`cannot read the folder ${dir}: ${error.code ?? error.message}.`);
}
const files = only.length ? only.map(id => `${id}.png`) : found;
if (!files.length) fail(`no .png files in ${dir}. Convert the deck into it first (opf convert deck.opf.json ${dir}/slide-{n}.png); if that printed an error, fix the deck before tiling.`);
const absent = files.filter(file => !found.includes(file));
if (absent.length) fail(`${absent.join(', ')} not found in ${dir}.`);
const rows = Math.ceil(files.length / columns);
const tiles = files.map((file, i) => {
  const x = (i % columns) * (w + 12), y = Math.floor(i / columns) * (h + label + 12);
  const data = readFileSync(path.join(dir, file)).toString('base64');
  return `<text x="${x}" y="${y + 20}" font-size="18" font-family="sans-serif">${file.replace(/\.png$/, '')}</text>`
    + `<rect x="${x}" y="${y + label}" width="${w}" height="${h}" fill="none" stroke="#999"/>`
    + `<image x="${x}" y="${y + label}" width="${w}" height="${h}" href="data:image/png;base64,${data}"/>`;
});
const width = columns * (w + 12), height = rows * (h + label + 12);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${tiles.join('')}</svg>`;
writeFileSync(out, await toPng(svg, {scale: 1}));
console.log(out, files.length);
