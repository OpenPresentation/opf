// node pair.mjs <sweep-dir> <id> <out.png>: preview | PowerPoint live | PowerPoint native, side by side at 640 px each.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-17-linear-smartart/packages/pptx/package.json')('sharp');
const [dir, id, out] = process.argv.slice(2), W = 640;
const files = [`${dir}/preview/${id}.png`, `${dir}/ppt/${id}.png`, `${dir}/ppt-shapes/${id}.png`];
const meta = await sharp(files[0]).metadata(), H = Math.round(W * meta.height / meta.width);
await sharp({ create: { width: 3 * W + 16, height: H, channels: 3, background: '#888' } }).composite(await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: i * (W + 8), top: 0 })))).png().toFile(out);
