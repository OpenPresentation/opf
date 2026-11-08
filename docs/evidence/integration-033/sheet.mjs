// Before/after sheet: each row is one slide, origin/main on the left and the integration on the right.
import { readFileSync, writeFileSync } from 'node:fs';
import { toPng } from '../../dist/index.js';
const [keysFile, before, after, out, title] = process.argv.slice(2);
const keys = JSON.parse(readFileSync(keysFile, 'utf8'));
const W = 384, H = 216, LABEL = 22, PAD = 8, COLS = 2; // two pairs per row
const pairW = W * 2 + PAD * 3, rowH = H + LABEL + PAD;
const rows = Math.ceil(keys.length / COLS), width = pairW * COLS + PAD, height = rows * rowH + 40;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = (file, x, y) => `<image x="${x}" y="${y}" width="${W}" height="${H}" href="data:image/png;base64,${readFileSync(file).toString('base64')}"/>`;
const parts = keys.map((key, i) => {
  const name = key.replaceAll(' ', '_') + '.png', x = (i % COLS) * pairW + PAD, y = Math.floor(i / COLS) * rowH + 40;
  return `<rect x="${x - 3}" y="${y - 3}" width="${pairW - PAD}" height="${rowH - 2}" fill="#fff"/>${img(`${before}/${name}`, x, y)}${img(`${after}/${name}`, x + W + PAD, y)}<text x="${x}" y="${y + H + 16}" font-size="14" font-family="Inter, sans-serif">${esc(key)}: main | integration</text>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#d9d9d9"/><text x="${PAD}" y="26" font-size="20" font-family="Inter, sans-serif">${esc(title)}</text>${parts}</svg>`;
writeFileSync(out, await toPng(svg));
console.log('wrote', out, width, 'x', height);
