import {readFileSync, writeFileSync} from 'node:fs';
const p = process.argv[2];
let s = readFileSync(p, 'utf8');
const swap = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 90)); s = s.replace(a, b); };
swap(`    assert.deepEqual(picture['p:spPr']['a:xfrm'], choice['p:xfrm'], 'the same frame');`,
`    // The frame grown by its bleed (the outlines and miter joins outside it, and a pixel of antialiasing) on every side.
    const [frame, grown] = [choice['p:xfrm'], picture['p:spPr']['a:xfrm']].map(xfrm => [xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number));
    const bleed = frame[0] - grown[0];
    assert.ok(bleed > 9525 && bleed < 8 * 9525, \`\${kind}: a bleed of a few pixels (\${bleed} EMU)\`);
    assert.deepEqual(grown, [frame[0] - bleed, frame[1] - bleed, frame[2] + 2 * bleed, frame[3] + 2 * bleed], \`\${kind}: the frame grown by the bleed on every side\`);`);
const start = s.indexOf('// 2. The fallback is OPF'), end = s.indexOf('// 3. A reader that does not understand');
s = s.slice(0, start) + `// 2. The fallback is OPF's preview of the frame: the preview's own node outlines, and its pixels over the whole picture, including the
//    outline and miter joins outside the frame (the pyramid's base corners and apex) and the matrix diamond's tips, which the bleed holds.
const fallbackOf = (exported, number) => {
  const part = \`ppt/slides/slide\${number}.xml\`, slide = exported.text(part), relationships = relationshipsOf(exported.entries, part);
  const choice = slide.match(/<p:xfrm><a:off x="(\\d+)" y="(\\d+)"\\/><a:ext cx="(\\d+)" cy="(\\d+)"\\/>/).slice(1).map(value => Number(value) / 9525);
  return {svg: strFromU8(exported.entries[relationships.get(slide.match(/<asvg:svgBlip [^>]*r:embed="([^"]+)"/)[1])]),
    png: exported.entries[relationships.get(slide.match(/<mc:Fallback>[\\s\\S]*?<a:blip r:embed="([^"]+)"/)[1])], frame: {x: choice[0], y: choice[1], width: choice[2], height: choice[3]}};
};
for (const number of [1, 2]) {
  const preview = toSvg(deck, number, {trace: true}), {svg, png, frame} = fallbackOf(live, number);
  const outlines = [...preview.matchAll(/<(?:path|rect) [^>]*data-opf-arrangement-path=[^>]*>/g)].map(match => match[0].replace(/\\sdata-opf-[\\w-]+="[^"]*"/g, ''));
  assert.equal(outlines.length, 4);
  for (const outline of outlines) assert.ok(svg.includes(outline), \`slide \${number}: a node outline of the preview\`);
  const [, x, y, width, height] = svg.match(/viewBox="([\\d.]+) ([\\d.]+) ([\\d.]+) ([\\d.]+)"/).map(Number);
  assert.ok(x < frame.x && x + width > frame.x + frame.width && y < frame.y && y + height > frame.y + frame.height, 'the picture holds the frame with its bleed');
  const fallback = sharp(png), {width: w, height: h} = await fallback.metadata(), scale = w / width;
  assert.ok(w >= 1024 && Math.abs(w / h - width / height) < 0.01, "the raster is drawn at the export resolution (192 dpi), in the picture's proportions");
  const background = preview.match(/data-opf-path="slides\\.\\d+\\.design\\.background" fill="(#[0-9A-F]{6})"/)[1];
  const region = await sharp(await toPng(preview, {scale})).extract({left: Math.round(x * scale), top: Math.round(y * scale), width: w, height: h}).removeAlpha().raw().toBuffer();
  const drawn = await sharp({create: {width: w, height: h, channels: 3, background}}).composite([{input: await fallback.png().toBuffer()}]).removeAlpha().raw().toBuffer();
  const alpha = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer();
  const window = (cx, cy, size = 8) => {
    const left = Math.max(0, Math.round((cx - x - size / 2) * scale)), top = Math.max(0, Math.round((cy - y - size / 2) * scale));
    const right = Math.min(w, Math.round((cx - x + size / 2) * scale)), bottom = Math.min(h, Math.round((cy - y + size / 2) * scale));
    let total = 0, count = 0, outside = 0;
    for (let row = top; row < bottom; row++) for (let column = left; column < right; column++) {
      const at = (row * w + column) * 3;
      for (let channel = 0; channel < 3; channel++) total += Math.abs(region[at + channel] - drawn[at + channel]);
      count += 3;
      const px = x + (column + 0.5) / scale, py = y + (row + 0.5) / scale;
      if ((px < frame.x || px > frame.x + frame.width || py < frame.y || py > frame.y + frame.height) && alpha[row * w + column] > 64) outside += 1;
    }
    return {mean: total / count, outside};
  };
  let total = 0;
  for (let index = 0; index < region.length; index++) total += Math.abs(region[index] - drawn[index]);
  assert.ok(total / region.length < 2, \`slide \${number}: the fallback draws the preview's pixels (mean difference \${(total / region.length).toFixed(2)})\`);
  // The ink at the frame's edge: the base corners and apex of the pyramid (its outline's miter joins), the diamond's tips of the matrix.
  const diamond = number === 2 ? preview.match(/data-opf-arrangement="matrix"[^>]*><path [^>]*\\bd="M([\\d.]+) ([\\d.]+) L([\\d.]+) ([\\d.]+) L([\\d.]+) ([\\d.]+) L([\\d.]+) ([\\d.]+) Z"/).slice(1).map(Number) : [];
  const edges = number === 1
    ? [[frame.x, frame.y + frame.height], [frame.x + frame.width, frame.y + frame.height], [frame.x + frame.width / 2, frame.y]]
    : [0, 2, 4, 6].map(index => [diamond[index], diamond[index + 1]]);
  for (const [cx, cy] of edges) {
    const found = window(cx, cy);
    assert.ok(found.mean < 6, \`slide \${number}: the preview's pixels at (\${cx.toFixed(1)}, \${cy.toFixed(1)}) (mean difference \${found.mean.toFixed(2)})\`);
    if (number === 1) assert.ok(found.outside > 0, \`slide \${number}: the outline outside the frame at (\${cx.toFixed(1)}, \${cy.toFixed(1)}) is drawn, not clipped\`);
  }
}

` + s.slice(end);
swap('// 9. `smartArt: "shapes"` writes no wrapper', `// 9. \`typefaces: "safe"\`: the fallback is drawn in the Office-safe family the export writes and lays the nodes out with, not the
//    preview's: its glyph outlines are those of a deck that names that family itself, and differ from the selected family's.
{
  const fonts = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck});
  const latin = exported => exported.text('ppt/diagrams/data1.xml').match(/<a:latin typeface="([^"]+)"\\/>/)?.[1];
  const selected = await exported(deck, {fonts}), safe = await exported(deck, {fonts, typefaces: 'safe'});
  const face = latin(safe);
  assert.ok(face && face !== latin(selected), \`safe mode writes another family (\${latin(selected)} becomes \${face})\`);
  const glyphs = svg => [...svg.matchAll(/<path id="opf-g-[^"]*" d="([^"]+)"/g)].map(match => match[1]).sort();
  const scheme = Object.values(defaultCatalog.fontSchemes).find(record => record.major === face && record.minor === face);
  assert.ok(scheme, );
  const named = await exported({...deck, design: {fontScheme: scheme.id}}, {fonts});
  assert.equal(latin(named), face, 'the control deck names the safe family');
  assert.deepEqual(glyphs(fallbackOf(safe, 1).svg), glyphs(fallbackOf(named, 1).svg), "the fallback draws the safe family's glyphs");
  assert.notDeepEqual(glyphs(fallbackOf(safe, 1).svg), glyphs(fallbackOf(selected, 1).svg), "and not the selected family's");
}

// 10. \`smartArt: "shapes"\` writes no wrapper`);
swap(`import {fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';`, `import {defaultCatalog, fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';`);
swap(`import {toPng} from '@openpresentation/opf-render';`, `import {toPng} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';`);
writeFileSync(p, s);
console.log('ok');
