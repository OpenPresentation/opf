// node fallback-sheet.mjs: SH-16's fallback picture as PowerPoint draws it when the mc:Choice requires an unknown namespace, beside the
// preview and the live SmartArt, one row per arrangement.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-17-linear-smartart/packages/pptx/package.json')('sharp');
const W = 480, H = 270, head = 22, rows = ['chevrons-4-short-wide', 'flow-4-short-wide', 'vertical-flow-4-short-wide'], comps = [];
const label = (text, width) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${head}"><text x="6" y="16" font-family="Arial" font-size="14">${text}</text></svg>`);
rows.forEach((id, r) => {
  const top = r * (H + head + 8);
  comps.push({ input: label(`${id}: preview | PowerPoint, live SmartArt | PowerPoint, the mc:Fallback picture (unknown namespace)`, 3 * W + 16), left: 0, top });
  ['../sweep2/preview/' + id + '-1.png', '../sweep2/ppt/' + id + '-1.png', '../com/fallback/' + id + '-unknown-ns-1.png'].forEach((f, i) => comps.push({ file: f, left: i * (W + 8), top: top + head }));
});
const inputs = await Promise.all(comps.map(async c => c.file ? { input: await sharp(c.file).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: c.left, top: c.top } : c));
await sharp({ create: { width: 3 * W + 16, height: rows.length * (H + head + 8), channels: 3, background: '#dddddd' } }).composite(inputs).png().toFile('../sheets/fallback-unknown-namespace.png');
console.log('../sheets/fallback-unknown-namespace.png');
