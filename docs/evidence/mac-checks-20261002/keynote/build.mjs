// Export every deck in lib/decks.mjs with the published packages and write manifest.json.
// Usage: node build.mjs        (needs: npm install in this directory)
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {validatePresentation} from '@openpresentation/opf';
import {toPptx} from '@openpresentation/opf-pptx';
import {decks} from './lib/decks.mjs';
import {inspectPptx} from './lib/inspect-pptx.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const versions = {};
for (const name of ['opf', 'opf-pptx', 'opf-render']) versions[`@openpresentation/${name}`] = JSON.parse(await readFile(path.join(root, 'node_modules/@openpresentation', name, 'package.json'), 'utf8')).version;
await mkdir(path.join(root, 'decks'), {recursive: true});
const manifest = {generated: 'by build.mjs', packages: versions, decks: {}};
for (const deck of decks) {
  const result = validatePresentation(deck.doc);
  if (!result.valid) throw new Error(`${deck.id}: ${JSON.stringify(result.errors).slice(0, 600)}`);
  const bytes = await toPptx(deck.doc, {zipDate: '2026-10-02'});
  await writeFile(path.join(root, 'decks', `${deck.id}.opf.json`), JSON.stringify(deck.doc, null, 2) + '\n');
  await writeFile(path.join(root, 'decks', `${deck.id}.pptx`), bytes);
  const facts = await inspectPptx(await JSZip.loadAsync(bytes));
  manifest.decks[deck.id] = {title: deck.title, checks: deck.checks, validationWarnings: result.warnings?.length ?? 0, ...facts};
  console.log(deck.id, `${facts.slideCount} slides`, `${facts.charts.length} charts`, `${facts.pictures} pictures`, `${bytes.length} bytes`);
}
await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
