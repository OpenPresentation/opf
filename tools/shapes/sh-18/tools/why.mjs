import { readFileSync } from 'node:fs';
const W = 'file:///C:/opf-work/sh-18-cycle-smartart/packages';
const comp = await import(`${W}/javascript/dist/composition.js`);
const core = await import(`${W}/javascript/dist/index.js`);
const { gallery } = await import(`${W}/gallery/dist/index.js`);
const deck = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ctx = core.resolveSlideContext(deck, 0, { catalogs: [gallery] });
const g = comp.composeSlide(deck.slides[0], ctx.options), a = g.arrangements?.[0];
console.log(a?.design, a?.fontSize, a?.instead, JSON.stringify(a?.frame), a?.smartArt);
