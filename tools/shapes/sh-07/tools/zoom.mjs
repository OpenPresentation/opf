// node zoom.mjs <mode> <id> <x> <y> <w> <h> [scale]: preview and PowerPoint crops of one region (1280x720 frame) side by side, enlarged.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('sharp');
const [mode, id, x, y, w, h, s = '4'] = process.argv.slice(2);
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const region = { left: +x, top: +y, width: +w, height: +h }, scale = +s;
const crop = async (file) => sharp(await sharp(file).resize(1280, 720, { fit: 'fill' }).flatten({ background: '#fff' }).png().toBuffer()).extract(region).resize(region.width * scale, region.height * scale, { kernel: 'nearest' }).png().toBuffer();
const a = await crop(`${root}/preview/${id}-1.png`), b = await crop(`${root}/${mode}/ppt/${id}/1.png`);
const W = region.width * scale, H = region.height * scale;
await sharp({ create: { width: W, height: H * 2 + 6, channels: 3, background: '#ff00ff' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 0, top: H + 6 }]).png().toFile(`${root}/zoom-${id}.png`);
console.log(`${root}/zoom-${id}.png`);
