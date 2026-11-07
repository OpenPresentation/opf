// Which design composition draws for every deck of a sweep: node designs.mjs <sweep-dir>
import { readdirSync, readFileSync } from 'node:fs';
const W = 'file:///C:/opf-work/sh-18-cycle-smartart/packages';
const comp = await import(`${W}/javascript/dist/composition.js`);
const core = await import(`${W}/javascript/dist/index.js`);
const { gallery } = await import(`${W}/gallery/dist/index.js`);
const dir = process.argv[2], count = {};
for (const file of readdirSync(`${dir}/decks`)) {
  const deck = JSON.parse(readFileSync(`${dir}/decks/${file}`, 'utf8'));
  const ctx = core.resolveSlideContext(deck, 0, { catalogs: [gallery] });
  const g = comp.composeSlide(deck.slides[0], ctx.options), a = g.arrangements?.[0];
  const key = a ? a.design + (a.design === 'opf' ? `-${a.nodes.length > 2 && a.nodes[1].box.y === a.nodes[0].box.y ? 'loop' : 'ring'}` : '') : 'list';
  count[key] = (count[key] ?? 0) + 1;
  if (!a || process.env.V) console.log(file, key, a?.fontSize);
}
console.log(count);
