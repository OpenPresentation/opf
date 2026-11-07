globalThis.__arrDebug = process.env.ARR === "1";
// Print the composed arrangement (or the list) of every slide of a deck: node 'geom.mjs deck.opf.json'
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire('C:/opf-work/sh-09-smartart-tier1/packages/pptx/package.json');
const core = await import('file:///C:/opf-work/sh-09-smartart-tier1/packages/javascript/dist/index.js');
const comp = await import('file:///C:/opf-work/sh-09-smartart-tier1/packages/javascript/dist/composition.js');
const {gallery: defaultCatalog} = await import('file:///C:/opf-work/sh-09-smartart-tier1/packages/gallery/dist/index.js');
const deck = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (let i = 0; i < deck.slides.length; i++) {
  const ctx = core.resolveSlideContext(deck, i, {catalogs: [defaultCatalog]});
  const g = comp.composeSlide(deck.slides[i], ctx.options);
  const list = g.items.find(item => item.field === 'items' || item.field === 'bullets');
  const region = g.regions?.find(r => r.name === list?.region);
  console.log(`slide ${i + 1}: list size ${list?.text?.fontSize} box ${JSON.stringify(list?.box)} region ${JSON.stringify(region?.box)}`);
  for (const a of g.arrangements ?? []) console.log(`  ${a.kind} size ${a.fontSize} frame ${JSON.stringify(a.frame)} lines ${a.smartArt.lines} stable ${a.smartArt.stable}`);
}
