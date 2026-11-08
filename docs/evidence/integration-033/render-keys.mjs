// Render the template-golden slides named in keys.json from the checkout this file is copied into (packages/render/artifacts/i033).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { toPng, toSvg } from '../../dist/index.js';
import { featureDecks, layouts, paginatedDecks, templateDeck } from '../../test/layout-template-fixture.mjs';
const [keysFile, out] = process.argv.slice(2);
const want = new Set(JSON.parse(readFileSync(keysFile, 'utf8')));
mkdirSync(out, { recursive: true });
for (const { keys, deck } of [...Object.keys(layouts).map(templateDeck), ...featureDecks(), ...paginatedDecks()]) {
  if (!keys.some((key) => want.has(key))) continue;
  const svgs = toSvg(deck);
  for (const [i, svg] of svgs.entries()) if (want.has(keys[i])) writeFileSync(`${out}/${keys[i].replaceAll(' ', '_')}.png`, await toPng(svg, { scale: 0.3 }));
}
console.log('rendered to', out);
