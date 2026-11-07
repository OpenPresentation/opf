// node grid.mjs out.png a.png b.png ... -> a 2-column contact sheet at 640x360 each
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-04-overlays-connectors/packages/render/package.json');
const sharp = require('sharp');
const [out, ...files] = process.argv.slice(2);
const W = 640, H = 360;
const tiles = await Promise.all(files.map(f => sharp(f).resize(W, H, { fit: 'contain', background: '#fff' }).png().toBuffer()));
const rows = Math.ceil(tiles.length / 2);
await sharp({ create: { width: W * 2, height: H * rows, channels: 3, background: '#888' } }).composite(tiles.map((input, i) => ({ input, left: (i % 2) * W, top: Math.floor(i / 2) * H }))).png().toFile(out);
