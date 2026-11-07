// node sheets.mjs <sweep-dir> <out-dir>: preview | PowerPoint (live SmartArt, or the native shapes the export wrote) | PowerPoint's
// drawing of OPF's native export, one row per instance, one sheet per arrangement and slide size (and one for the scripts), each row
// labelled with the instance and its gate result.
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-17-linear-smartart/packages/pptx/package.json')('sharp');
const [dir, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const gate = JSON.parse(readFileSync(`${dir}/gate.json`, 'utf8'));
const W = 400, gap = 6, head = 20;
const groups = new Map();
for (const row of gate) {
  const key = row.script && row.script !== 'latin' ? 'scripts' : `${row.kind}-${row.aspect}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
for (const [key, rows] of groups) {
  const comps = [];
  let top = 0;
  for (const row of rows) {
    const files = [`${dir}/preview/${row.id}.png`, `${dir}/ppt/${row.id}.png`, `${dir}/ppt-shapes/${row.id}.png`];
    const meta = await sharp(files[0]).metadata(), H = Math.round(W * meta.height / meta.width);
    const label = `${row.id}: ${row.drew ?? ""} · ${row.result}${row.live ? ` · rect ${row.rect} pt · ${row.sizes} pt` : ''}`;
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * W + 4 * gap}" height="${head}"><text x="6" y="15" font-family="Arial" font-size="13">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`), left: 0, top });
    for (const [index, file] of files.entries()) if (existsSync(file)) comps.push({ input: await sharp(file).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: gap + index * (W + gap), top: top + head });
    top += head + H + gap;
  }
  const header = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * W + 4 * gap}" height="24"><text x="6" y="17" font-family="Arial" font-size="15" font-weight="bold">${key}: preview | PowerPoint (live SmartArt, or the native shapes written) | PowerPoint, OPF's native-shape export</text></svg>`);
  await sharp({ create: { width: 3 * W + 4 * gap, height: top + 24, channels: 3, background: '#dddddd' } })
    .composite([{ input: header, left: 0, top: 0 }, ...comps.map(comp => ({ ...comp, top: comp.top + 24 }))]).png().toFile(`${out}/${key}.png`);
  console.log(`${out}/${key}.png`);
}
