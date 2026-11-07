// node grid.mjs <out.png> <png>...: the PNGs two by two at 640 px wide.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-17-linear-smartart/packages/pptx/package.json')('sharp');
const [out, ...files] = process.argv.slice(2), W = 640;
const meta = await sharp(files[0]).metadata(), H = Math.round(W * meta.height / meta.width);
const rows = Math.ceil(files.length / 2);
await sharp({ create: { width: 2 * W + 8, height: rows * (H + 8), channels: 3, background: '#888' } }).composite(await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: (i % 2) * (W + 8), top: Math.floor(i / 2) * (H + 8) })))).png().toFile(out);
