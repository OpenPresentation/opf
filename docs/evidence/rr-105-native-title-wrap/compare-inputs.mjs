// Re-export every accepted native input at the current source, without Office or golden mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const [{examples}, {loadFonts}, {gallery}, {toPptx}] = await Promise.all(['packages/javascript/dist/examples.js', 'packages/render/dist/fonts-node.js', 'packages/gallery/dist/index.js', 'packages/pptx/dist/index.js'].map(load));
const manifest = JSON.parse(await fs.readFile(new URL('corrected-manifest.json', import.meta.url), 'utf8'));
const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'}), rows = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.cases.length, 50);
for (const entry of manifest.cases) {
  const source = examples.find(example => example.file === entry.file);
  assert.ok(source, entry.file);
  const deck = {...source.deck, slides: [source.deck.slides[entry.slide - 1]]};
  const bytes = await toPptx(deck, {fonts, catalogs: [gallery], bodyText: 'native', seed: 1127, timestamp: '2026-11-08T00:00:00Z', zipDate: '2026-11-08T00:00:00Z'});
  const sha256 = hash(bytes);
  rows.push({name: entry.name, accepted: entry.after.sha256, candidate: sha256, identical: sha256 === entry.after.sha256});
}
const report = {sourceCommit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), acceptedSource: manifest.sourceCommit, cases: rows, total: rows.length, identical: rows.filter(row => row.identical).length, sourceHashes: {}};
for (const file of ['packages/pptx/src/index.js', 'packages/pptx/src/native-body.js', 'packages/pptx/dist/index.js', 'packages/pptx/dist/native-body.js']) report.sourceHashes[file] = hash(await fs.readFile(path.join(root, file)));
await fs.writeFile(new URL('writer-font-input-comparison.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
assert.equal(report.identical, 50, JSON.stringify(rows.filter(row => !row.identical)));
console.log('All 50 accepted PPTX inputs remain byte-identical after the serialized-font measurement correction; existing native receipts apply.');
