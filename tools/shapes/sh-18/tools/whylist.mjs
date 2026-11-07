// For each list case of a sweep: why every cycle design fails at the floor size (real fonts): node geom, longest word, needed height.
import { readFileSync } from 'node:fs';
const P = 'file:///C:/opf-work/sh-18-cycle-smartart/packages';
const { resolvePresentation } = await import(`${P}/render/src/svg.js`);
const { loadFonts } = await import(`${P}/render/src/fonts-node.js`);
const comp = await import(`${P}/javascript/dist/composition.js`);
const { gallery } = await import(`${P}/gallery/dist/index.js`);
const [dir, ...ids] = process.argv.slice(2);
for (const id of ids) {
  const deck = JSON.parse(readFileSync(`${dir}/decks/${id}.opf.json`, 'utf8'));
  const fonts = await loadFonts({ pack: 'office', presentation: deck });
  const resolved = resolvePresentation(deck, { catalogs: [gallery], fonts }), slide = resolved.slides[0], g = slide.geometry;
  const list = g.items.find(i => i.field === 'items'), area = g.regions.find(r => r.name === 'stages').box, values = deck.slides[0].items;
  const scale = slide.width ? slide.width / 1280 : 1, floor = Math.min(list.text.fontSize, comp.LIST_NOMINAL_SIZE * (g.canvas?.width ?? 1280) / 1280);
  const size = 32 * Math.min(area.width, 9999) / Math.max(1, area.width) * (resolved.slides[0].scale ?? 1);
  const style = list.text.listEntries[0].text.richLines[0].fragments[0].style, measure = fonts.textMeasurement;
  const fontSize = comp.LIST_NOMINAL_SIZE;
  const width = word => measure ? measure.measure?.(word, { ...style, fontSize })?.width ?? measure(word, { ...style, fontSize }) : 0;
  const words = values.flatMap(v => v.split(/\s+/)), longest = words.reduce((a, w) => (wordW(w) > wordW(a) ? w : a), words[0]);
  function wordW(w) { try { return comp.textWidthMeasurer ? comp.textWidthMeasurer(style, measure)(w, fontSize) : width(w); } catch { return 0; } }
  const designs = { smartart: comp.cycleNodes(comp.cycleFrame(area, values.length), values.length).nodes, ring: comp.cycleRing(area, values.length, 24 * area.height / 604.8 * 0 + 24).nodes, loop2: comp.cycleLoop(area, values.length, 24)?.nodes, loop3: comp.cycleLoop(area, values.length, 24, false, 3)?.nodes };
  const out = [];
  for (const [name, nodes] of Object.entries(designs)) {
    if (!nodes) { out.push(`${name}: none`); continue; }
    const margin = (name === 'smartart' ? .1 : .2) * fontSize, inner = nodes.map(n => ({ width: n.textBox.width - 2 * margin, height: n.textBox.height - 2 * margin }));
    const narrow = Math.min(...inner.map(b => b.width)), low = Math.min(...inner.map(b => b.height));
    const need = Math.max(...values.map((v, k) => comp.fitList([v], { x: 0, y: 0, width: inner[k].width, height: 1e5 }, fontSize, fontSize, { style, textMeasurement: measure, bullet: 'none' }).height - inner[k].height));
    out.push(`${name}: inner ${narrow.toFixed(0)}x${low.toFixed(0)}, longest word "${longest}" ${wordW(longest).toFixed(0)}, height short by ${need.toFixed(0)}`);
  }
  console.log(`${id} (floor ${fontSize.toFixed(1)} px, region ${area.width.toFixed(0)}x${area.height.toFixed(0)}):\n  ${out.join('\n  ')}`);
}
