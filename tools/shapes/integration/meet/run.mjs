import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { convert } = await import(pathToFileURL('C:/opf-work/sh-phase-2/packages/javascript/dist/index.js').href);
const dir = 'C:/opf-work/shapes/integration/meet';
const p = await convert(`${dir}/deck.opf.json`, `${dir}/deck.pptx`);
console.log('findings', (p.findings ?? []).map(f => `${f.severity} ${f.ruleId}`).join(', ') || 'none');
mkdirSync(`${dir}/preview/meet`, { recursive: true });
await convert(`${dir}/deck.opf.json`, `${dir}/preview/meet/s-{n}.png`);
