// Renders the named layout-template golden slides of the checkout this runs from, at 0.5 scale, into <out>/<n>.png.
// node render-keys.mjs <render package dir> <out dir> <keys.json>
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [pkg, out, keysFile] = process.argv.slice(2);
const wanted = JSON.parse(readFileSync(keysFile, 'utf8'));
const {layouts, templateDeck, featureDecks, paginatedDecks} = await import(pathToFileURL(path.join(pkg, 'test/layout-template-fixture.mjs')).href);
const {toSvg, toPng} = await import(pathToFileURL(path.join(pkg, 'dist/index.js')).href);
mkdirSync(out, {recursive: true});
for (const {keys, deck} of [...Object.keys(layouts).map(templateDeck), ...featureDecks(), ...paginatedDecks()]) {
  if (!keys.some(key => wanted.includes(key))) continue;
  const svgs = toSvg(deck, {trace: true});
  for (const [index, svg] of svgs.entries()) {
    const at = wanted.indexOf(keys[index]);
    if (at >= 0) writeFileSync(path.join(out, `${String(at).padStart(2, '0')}.png`), await toPng(svg, {scale: 0.375}));
  }
}
console.log('rendered', out);
