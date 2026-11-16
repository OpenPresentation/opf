// Tiles PNGs into one labelled contact sheet: `node scripts/layout-sampler-sheet.mjs <dir> <out.png> [columns] [ids...]`.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {toPng} from '@openpresentation/opf-render';

const [dir, out, cols = '4', ...only] = process.argv.slice(2);
const files = only.length ? only.map(id => `${id}.png`) : readdirSync(dir).filter(f => f.endsWith('.png')).sort();
const columns = Number(cols), w = 480, h = 270, label = 28;
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
