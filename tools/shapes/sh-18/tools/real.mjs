// Compose a deck's slide with real fonts (as the CLI does) and print the list and arrangement: node real.mjs <deck> [layoutOverride]
import { readFileSync } from 'node:fs';
const R = 'file:///C:/opf-work/sh-18-cycle-smartart/packages/render';
const { resolvePresentation } = await import(`${R}/src/svg.js`);
const { loadFonts } = await import(`${R}/src/fonts-node.js`).catch(() => import(`${R}/dist/fonts-node.js`));
const { gallery } = await import('file:///C:/opf-work/sh-18-cycle-smartart/packages/gallery/dist/index.js');
const deck = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (process.argv[3]) deck.slides[0].layout = process.argv[3];
const fonts = await loadFonts({ pack: 'office', presentation: deck });
const resolved = resolvePresentation(deck, { catalogs: [gallery], fonts });
const g = resolved.slides[0].geometry, list = g.items.find(i => i.field === 'items'), a = g.arrangements?.[0];
const text = list.text, bottom = text.listEntries ? Math.max(...text.listEntries.map(e => e.textBox.y + e.textBox.height)) : 0;
console.log('list', text.fontSize, 'box', JSON.stringify(list.box), 'text bottom', bottom, a ? `${a.design} ${a.fontSize}` : 'no arrangement', (g.diagnostics ?? []).map(d => d.code).join(','));
