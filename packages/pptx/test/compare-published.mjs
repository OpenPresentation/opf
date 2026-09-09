// npm run test:compare-published -- <fresh 0.5.0 consumer> [report.json]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { examples } from '@openpresentation/opf/examples';
import { loadOfficeFontRegistry } from '@openpresentation/opf-render/fonts-node';
import { toPptx as candidate } from '../dist/index.js';
assert.ok(process.argv[2], 'Supply an isolated consumer with registry @openpresentation/opf-pptx@0.5.0 installed.');
const referenceRoot = path.resolve(process.argv[2]);
const require = createRequire(path.join(referenceRoot, 'package.json'));
const manifestPath = require.resolve('@openpresentation/opf-pptx/package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(manifest.version, '0.5.0');
const lock = JSON.parse(await readFile(path.join(referenceRoot, 'package-lock.json'), 'utf8'));
const source = lock.packages['node_modules/@openpresentation/opf-pptx'];
assert.equal(source.version, '0.5.0');
assert.equal(source.resolved, 'https://registry.npmjs.org/@openpresentation/opf-pptx/-/opf-pptx-0.5.0.tgz');
assert.equal(source.integrity, 'sha512-GKVmqWjQ8GRuEMmpJajPs+W+q35MPy6q8+FL8nWH+d17Sh+/O87BBBfSi6m9KLGxQZav2o1I/bfMoftP5DNEfg==');
const { toPptx: published } = await import(pathToFileURL(path.join(path.dirname(manifestPath), 'dist/index.js')).href);
const fonts = await loadOfficeFontRegistry({ fallbackFamily: 'Roboto', strictGlyphs: false });
const image = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const options = { textMeasurement: fonts.textMeasurement, imageResolver: async () => image };
const report = { reference: '@openpresentation/opf-pptx@0.5.0', integrity: source.integrity, decks: 0, slides: 0, equal: 0, mismatches: [], scope: 'Deterministic PPTX bytes with explicit image substitution and fallback fonts, not native viewer equivalence.' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const { file, deck } of examples) {
  const before = await published(deck, options);
  const after = await candidate(deck, options);
  report.decks++;
  report.slides += deck.slides.length;
  if (hash(before) === hash(after)) report.equal++;
  else report.mismatches.push({ file, before: hash(before), after: hash(after) });
}
if (process.argv[3]) await writeFile(path.resolve(process.argv[3]), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
assert.ok(report.decks > 0, 'The comparison must exercise the installed example corpus.');
assert.deepEqual(report.mismatches, []);
