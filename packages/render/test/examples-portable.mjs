// FA-23 (OPF 0.15 portability): core's example decks embed every record they use, so they render with no host catalog,
// offline, without an unresolved-reference diagnostic, and exactly as they do with the gallery snapshot registered.
import assert from 'node:assert/strict';
import { examples } from '@openpresentation/opf/examples';
import { defaultCatalog } from '@openpresentation/opf/catalog';
import { renderSvg } from '../dist/index.js';

let slides = 0;
for (const { file, deck } of examples) {
  const unresolved = [];
  const bare = renderSvg(deck, { onDiagnostic: entry => { if (entry.code === 'unresolved-reference') unresolved.push(entry.reference); } });
  assert.deepEqual(unresolved, [], `${file}: every reference resolves from the document`);
  assert.deepEqual(bare, renderSvg(deck, { catalogs: [defaultCatalog] }), `${file}: the registered catalog changes nothing`);
  slides += bare.length;
}
console.log(`examples portable: ${examples.length} decks, ${slides} slides render the same with and without a host catalog`);
