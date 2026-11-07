import { toPptx } from 'file:///C:/opf-work/sh-02-shape-block/packages/pptx/dist/index.js';
import fs from 'node:fs';
const deck = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = await toPptx(deck, { onDiagnostic: d => console.log('diag', d.code, d.path, d.message?.slice(0, 120)) });
fs.writeFileSync(process.argv[3], Buffer.from(out.data ?? out));
console.log('wrote', process.argv[3]);
