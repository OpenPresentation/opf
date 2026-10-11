// opf#361 local policy patch, NEVER committed: writes a patched copy of the published @openpresentation/opf font-policy chunk with the
// rule factors (and the natively measured lineAscent rows), and target.json naming the original chunk. hooks.mjs redirects the original
// chunk's URL to the patched copy for any process started with `node --import ./patched/register.mjs`. The installed package is untouched.
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(HERE, '..', 'node_modules', '@openpresentation', 'opf', 'dist');
export const ROWS = {
  'Angsana New': {sizeAdjust: 0.75, lineAscent: 0.85},
  DilleniaUPC: {sizeAdjust: 0.68},
  'Sakkal Majalla': {sizeAdjust: 0.89, lineAscent: 0.78, lineAscentMixed: 0.78},
  'Malgun Gothic': {sizeAdjust: 1.07},
  'Nirmala UI': {sizeAdjust: 1.07},
};
const chunk = readdirSync(dist).find(name => /^chunk-.*\.js$/.test(name) && readFileSync(path.join(dist, name), 'utf8').includes('var fontPolicySource = {'));
if (!chunk) throw new Error('font-policy chunk not found');
let src = readFileSync(path.join(dist, chunk), 'utf8');
for (const [family, row] of Object.entries(ROWS)) {
  const at = src.indexOf(`"family": "${family}",`);
  const rep = src.indexOf('"compatibility": "visual",', src.indexOf('"replacement": {', at));
  if (at < 0 || rep < 0 || rep - at > 2000) throw new Error(`row ${family} not found`);
  const basis = `opf#361 rule factor (scratch patch for the native re-run, not committed): ${JSON.stringify(row)}`;
  const fields = Object.entries(row).map(([k, v]) => `"${k}": ${v},`).join('\n        ') + `\n        "sizeAdjustBasis": ${JSON.stringify(basis)},` + (row.lineAscent ? `\n        "lineAscentBasis": "RR-38-style native baseline measured in the FF-46 run (opf#361 comment, 2026-10-05).",` : '');
  const end = rep + '"compatibility": "visual",'.length;
  src = `${src.slice(0, end)}\n        ${fields}${src.slice(end)}`;
}
writeFileSync(path.join(HERE, 'font-policy-chunk.patched.js'), src);
writeFileSync(path.join(HERE, 'target.json'), `${JSON.stringify({original: pathToFileURL(path.join(dist, chunk)).href, patched: pathToFileURL(path.join(HERE, 'font-policy-chunk.patched.js')).href, rows: ROWS}, null, 1)}\n`);
console.log(`patched ${chunk}: ${Object.keys(ROWS).join(', ')}`);
