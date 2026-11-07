// node [--conditions=browser] lazy-diff.mjs <out.json>: the slide XML of examples/technical/diagrams.opf.json exported with no fonts.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json');
const { unzipSync, strFromU8 } = require('fflate');
const { toPptx } = await import('file:///C:/opf-work/sh-07-native-diagrams/packages/pptx/dist/index.js');
const deck = JSON.parse(readFileSync('C:/opf-work/sh-07-native-diagrams/examples/technical/diagrams.opf.json', 'utf8'));
const parts = unzipSync(await toPptx(deck, { seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z', imageResolver: async () => new Uint8Array() }));
const out = {};
for (const [k, v] of Object.entries(parts)) if (/^ppt\/slides\/slide\d+\.xml$/.test(k)) out[k] = strFromU8(v);
writeFileSync(process.argv[2], JSON.stringify(out));
