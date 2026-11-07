// Try: each entry's text anchored at the top of its text rectangle, inset to where OPF's composition puts the entry's first line.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/render/package.json');
const { unzipSync, zipSync, strFromU8, strToU8 } = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/pptx/package.json')('fflate');
const { resolvePresentation } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/render/src/svg.js');
const { gallery } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/gallery/dist/index.js');
const { loadFonts } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/render/src/fonts-node.js');
const fonts = await loadFonts({ pack: 'office' });
const [input, deckFile, output] = process.argv.slice(2);
const deck = JSON.parse(readFileSync(deckFile, 'utf8'));
const g = resolvePresentation(deck, { catalogs: [gallery], validate: false, fonts, textMeasurement: fonts.textMeasurement }).slides[0].geometry;
const a = g.arrangements[0], item = g.items.find(i => i.path === a.path), size = a.fontSize;
const z = unzipSync(readFileSync(input)); let l = strFromU8(z['ppt/diagrams/layout1.xml']);
const k = a.nodes.length;
a.nodes.forEach((node, i) => {
  const col = item.listColumns[i].box, top = (col.y - node.textBox.y) / size;
  console.log(i, 'textBox y', node.textBox.y, 'column y', col.y, 'h', col.height, 'top share', top.toFixed(4));
  for (const name of [`t${k}_${i + 1}`, `n${k}_${i + 1}`]) {
    const start = l.indexOf(`<dgm:layoutNode name="${name}"`); if (start < 0) continue;
    const end = l.indexOf('</dgm:layoutNode>', start), node1 = l.slice(start, end);
    if (!node1.includes('<dgm:alg type="tx"/>')) continue;
    const next = node1.replace('<dgm:alg type="tx"/>', '<dgm:alg type="tx"><dgm:param type="txAnchorVert" val="t"/></dgm:alg>').replace(/<dgm:constr type="tMarg" refType="primFontSz" fact="[^"]*"\/>/, `<dgm:constr type="tMarg" refType="primFontSz" fact="${top.toFixed(6)}"/>`);
    l = l.slice(0, start) + next + l.slice(end);
  }
});
writeFileSync(output, zipSync({ ...z, 'ppt/diagrams/layout1.xml': strToU8(l) }));
console.log((l.match(/txAnchorVert/g) || []).length, 'anchored');
