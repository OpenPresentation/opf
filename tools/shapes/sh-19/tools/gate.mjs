// node gate.mjs <sweep-dir>: the SH-09 gate for every exported instance of a sweep.
// <sweep-dir>/pptx/<id>.pptx (OPF's export), <sweep-dir>/preview/<id>-<slide>.png (OPF's preview), <sweep-dir>/ppt/probe.json and
// <sweep-dir>/ppt/<id>-<slide>.png (PowerPoint through COM, tools/com-probe.ps1). For each SmartArt frame: every node rectangle PowerPoint
// lays out against core's (from OPF's drawing part, which core's geometry wrote), in points; the font size of every node against the
// data model's; and the pixel scores of the frame's crop and the ink offset in every node's text rectangle (tools/pairs.mjs, SH-07's gate).
// Writes <sweep-dir>/gate.json and <sweep-dir>/gate.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parseLayoutDefinition } from './layout-xml.mjs';
const core = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/javascript/dist/composition.js');
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/pptx/package.json');
const sharp = require('sharp');
const { unzipSync, strFromU8 } = require('fflate');
const dir = process.argv[2];
const probe = JSON.parse(readFileSync(`${dir}/ppt/probe.json`, 'utf8').replace(/^\uFEFF/, ''));
const decks = Array.isArray(probe) ? probe : [probe];
const meta = existsSync(`${dir}/meta.json`) ? JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8')) : {};
const EMU_PT = 12700, PX = 4 / 3;
const raw = async (file, box) => sharp(file).flatten({ background: '#ffffff' }).extract(box).removeAlpha().raw().toBuffer();
function score(x, y, W, H, block, limit = 24) {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  let blocks = 0, hot = 0;
  for (let by = 0; by < H; by += block) for (let bx = 0; bx < W; bx += block) {
    let d = 0, c = 0;
    for (let yy = by; yy < Math.min(by + block, H); yy++) for (let xx = bx; xx < Math.min(bx + block, W); xx++) for (let ch = 0; ch < 3; ch++) { const i = (yy * W + xx) * 3 + ch; d += x[i] - y[i]; c++; }
    blocks++; if (Math.abs(d / c) > limit) hot++;
  }
  return { mad: +(sum / x.length).toFixed(2), hot: +(hot / blocks * 100).toFixed(2) };
}
// The ink of a text box: the pixels near the color farthest from the box's most common color (the node's fill, so the text color), as a
// weighted centroid. Pixels of the slide's background where the box reaches past a pyramid level's slanted side are not text.
function ink(buffer, W, box) {
  const x0 = Math.max(0, Math.round(box.x)), y0 = Math.max(0, Math.round(box.y)), x1 = Math.min(W, Math.round(box.x + box.width)), y1 = Math.round(box.y + box.height);
  const counts = new Map(), at = (x, y) => { const i = (y * W + x) * 3; return [buffer[i], buffer[i + 1], buffer[i + 2]]; };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const [r, g, b] = at(x, y), key = (r >> 3) << 10 | (g >> 3) << 5 | b >> 3; counts.set(key, (counts.get(key) ?? 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0, fill = [(top >> 10) << 3, ((top >> 5) & 31) << 3, (top & 31) << 3];
  const distance = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
  let far = fill, best = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = at(x, y), d = distance(c, fill); if (d > best) { best = d; far = c; } }
  let w = 0, sx = 0, sy = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const c = at(x, y), d = distance(c, fill);
    if (d > 40 && distance(c, far) < distance(c, fill)) { w += d; sx += d * x; sy += d * y; }
  }
  return w > 500 ? { x: sx / w, y: sy / w } : undefined;
}
const rows = [];
for (const deck of decks) {
  const parts = unzipSync(readFileSync(`${dir}/pptx/${deck.file}.pptx`));
  for (const slide of deck.slides ?? []) {
    const xml = strFromU8(parts[`ppt/slides/slide${slide.index}.xml`]);
    const rels = strFromU8(parts[`ppt/slides/_rels/slide${slide.index}.xml.rels`]);
    const id = `${deck.file}-${slide.index}`, info = meta[id] ?? {};
    const frameXml = /<p:graphicFrame>(?:(?!<\/p:graphicFrame>)[\s\S])*drawingml\/2006\/diagram[\s\S]*?<\/p:graphicFrame>/.exec(xml)?.[0];
    if (!frameXml || !slide.smartArt?.length) {
      // Native shapes: which design core drew (the findings say), and the whole slide against the preview (SH-07's scores).
      const findings = (info.findings ?? []).join(' ');
      const shapes = xml.includes('name="OPF arrangement ');
      const drew = frameXml ? 'SmartArt (not live)' : !shapes ? 'list' : /drawn as (a card|a grid of cards)/.test(findings) ? 'OPF cards' : /OPF's own/.test(findings) ? 'OPF design' : 'SmartArt geometry as shapes';
      let slideScores;
      if (shapes) {
        const meta = await sharp(`${dir}/preview/${id}.png`).metadata(), box = { left: 0, top: 0, width: meta.width, height: meta.height };
        const [p, q] = [await raw(`${dir}/preview/${id}.png`, box), await raw(`${dir}/ppt/${id}.png`, box)];
        const full = score(p, q, meta.width, meta.height, 16), w = Math.round(meta.width / 4), h = Math.round(meta.height / 4);
        const small = score(await sharp(p, { raw: { width: meta.width, height: meta.height, channels: 3 } }).resize(w, h, { fit: 'fill' }).raw().toBuffer(), await sharp(q, { raw: { width: meta.width, height: meta.height, channels: 3 } }).resize(w, h, { fit: 'fill' }).raw().toBuffer(), w, h, 8);
        // The shapes alone: pixels inside the arrangement's shapes and outside every text line box (the general text offset left out).
        const xfrm = shape => { const m = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(shape); return m ? m.slice(1).map(v => Number(v) / 9525) : undefined; };
        const named = re => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m => m[0]).filter(sp => re.test(sp)).map(xfrm).filter(Boolean);
        const shapeBoxes = named(/name="OPF arrangement /), textBoxes = named(/name="OPF list /);
        const inside = (bx, px, py, pad = 0) => px >= bx[0] - pad && px < bx[0] + bx[2] + pad && py >= bx[1] - pad && py < bx[1] + bx[3] + pad;
        let blocks = 0, hotBlocks = 0, sum = 0, n = 0;
        for (let by = 0; by < meta.height; by += 16) for (let bx = 0; bx < meta.width; bx += 16) {
          let d = 0, c = 0;
          for (let py = by; py < Math.min(by + 16, meta.height); py++) for (let px = bx; px < Math.min(bx + 16, meta.width); px++) {
            if (!shapeBoxes.some(b => inside(b, px, py)) || textBoxes.some(b => inside(b, px, py, 3))) continue;
            for (let ch = 0; ch < 3; ch++) { const i = (py * meta.width + px) * 3 + ch; d += p[i] - q[i]; sum += Math.abs(p[i] - q[i]); c++; n++; }
          }
          if (c < 16 * 16 * 3 / 2) continue;
          blocks++; if (Math.abs(d / c) > 24) hotBlocks++;
        }
        slideScores = { mad: small.mad, hot: small.hot, mad1280: full.mad, hot1280: full.hot, shapesMad: +(n ? sum / n : 0).toFixed(2), shapesHot: blocks ? +(hotBlocks / blocks * 100).toFixed(2) : 0 };
      }
      rows.push({ id, ...info, live: false, drew, slideScores, result: drew.startsWith('SmartArt (') ? 'FAIL (not live in PowerPoint)' : drew === 'list' ? 'list (finding)' : 'native shapes' });
      continue;
    }
    const sa = slide.smartArt[0];
    const [fx, fy, fw, fh] = /<p:xfrm><a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(frameXml).slice(1).map(Number);
    const dataTarget = /Id="([^"]+)"[^>]*diagramData"[^>]*Target="\.\.\/diagrams\/([^"]+)"/.exec(rels) ?? /Type="[^"]*diagramData" Target="\.\.\/diagrams\/([^"]+)"/.exec(rels);
    const number = /<a:graphicData[\s\S]*?r:dm="([^"]+)"/.exec(frameXml)[1];
    const relOf = idValue => new RegExp(`<Relationship Id="${idValue}"[^>]*Target="\\.\\./diagrams/([^"]+)"`).exec(rels)[1];
    const data = strFromU8(parts[`ppt/diagrams/${relOf(number)}`]);
    const drawingFile = /<Relationship Id="[^"]+" Type="[^"]*diagramDrawing" Target="\.\.\/diagrams\/([^"]+)"/.exec(rels)?.[1];
    const drawing = strFromU8(parts[`ppt/diagrams/${drawingFile}`]);
    const sizes = [...data.matchAll(/<a:rPr[^>]*\bsz="(\d+)"/g)].map(m => Number(m[1]) / 100);
    const opf = [...drawing.matchAll(/<dsp:sp\b[\s\S]*?<\/dsp:sp>/g)].map(m => {
      const s = m[0], [x, y, w, h] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(s).slice(1).map(Number);
      const t = /<dsp:txXfrm><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(s)?.slice(1).map(Number);
      const ins = ['lIns', 'tIns', 'rIns', 'bIns'].map(key => Number(new RegExp(`${key}="(\\d+)"`).exec(s)?.[1] ?? 0) / EMU_PT * PX);
      return { arrow: /prst="rightArrow"/.test(s), ins, left: (fx + x) / EMU_PT, top: (fy + y) / EMU_PT, width: w / EMU_PT, height: h / EMU_PT, text: t ? { x: (fx + t[0]) / EMU_PT * PX, y: (fy + t[1]) / EMU_PT * PX, width: t[2] / EMU_PT * PX, height: t[3] / EMU_PT * PX } : undefined };
    });
    // SH-19: a SmartArt on OPF's own layout definition: what OPF's interpreter draws from the file's layout part (the export checked that
    // it is the composed design within 0.1 pt), in PowerPoint's drawing order.
    const loId = /<dgm:relIds[^>]*r:lo="([^"]*)"/.exec(frameXml)?.[1], opfLayout = loId ? data.includes("urn:openpresentation.org/smartart/layout/") : false;
    if (opfLayout) {
      const def = parseLayoutDefinition(strFromU8(parts[`ppt/diagrams/${relOf(loId)}`])), frame = { x: fx / 9525, y: fy / 9525, width: fw / 9525, height: fh / 9525 };
      const count = [...data.matchAll(/<dgm:pt modelId="[^"]+"(?: type="node")?>/g)].length, sizePx = (sizes[0] ?? 0) / .75;
      const shapes = core.evaluateLayoutDefinition(def, frame, count).filter(shape => !shape.hidden);
      opf.splice(0, opf.length, ...shapes.map(shape => {
        const text = shape.presents?.type === 'node' ? (shape.textOnly ? shape.box : core.presetTextRect(shape.preset, shape.box, shape.adjust[0])) : undefined;
        const ins = shape.margins ? shape.margins.map(m => m * sizePx) : [0, 0, 0, 0];
        return { arrow: shape.preset === 'rightArrow', rot: shape.rotation, ins, left: shape.box.x * .75, top: shape.box.y * .75, width: shape.box.width * .75, height: shape.box.height * .75, text };
      }));
    }
    // SH-17: PowerPoint lists a flow's shapes node, arrow, node, ...; OPF's drawing lists the nodes, then the arrows: compare each kind in order.
    const pptAll = sa.items ?? [], isArrow = item => item.type === 33;
    const ppt = [...pptAll.filter(item => !isArrow(item)), ...pptAll.filter(isArrow)];
    // The drawing lists each arrow after its node (SH-18): compare the nodes, then the arrows, on both sides.
    opf.splice(0, opf.length, ...opf.filter(shape => !shape.arrow), ...opf.filter(shape => shape.arrow));
    let rect = 0;
    const count = Math.min(opf.length, ppt.length);
    let turn = 0;
    for (let i = 0; i < count; i++) { rect = Math.max(rect, ...['left', 'top', 'width', 'height'].map(k => Math.abs(opf[i][k] - ppt[i][k]))); if (opf[i].rot !== undefined) turn = Math.max(turn, Math.abs((((opf[i].rot - (ppt[i].rotation ?? 0)) % 360) + 540) % 360 - 180)); }
    const pptSizes = ppt.filter(item => item.size !== undefined && item.size !== null && item.text).map(item => Number(item.size));
    const sizeEqual = pptSizes.length === sizes.length && pptSizes.every((size, i) => Math.abs(size - sizes[i]) < .01);
    // Pixels: the frame's crop (1280 x 720 slide), and each node's text rectangle for the ink offset.
    const crop = { left: Math.max(0, Math.floor(fx / EMU_PT * PX) - 2), top: Math.max(0, Math.floor(fy / EMU_PT * PX) - 2) };
    crop.width = Math.min(1280 - crop.left, Math.ceil(fw / EMU_PT * PX) + 4); crop.height = Math.min(720 - crop.top, Math.ceil(fh / EMU_PT * PX) + 4);
    const textBoxes = opf.filter(node => node.text).map(({ text, ins: [l, t, r, b] }) => ({ x: text.x - crop.left + l, y: text.y - crop.top + t, width: text.width - l - r, height: text.height - t - b }));
    // SH-19 review: the shapes check leaves out each node's text rectangle less its margins, grown by the 0.15 em the preview sets its
    // baselines below PowerPoint's (OPF's baseline model, docs/smartart.md; the native check measures that offset), so text ink is not
    // counted as a shape difference (a one-level pyramid's 36 pt line otherwise crosses its rectangle's top margin).
    const lift = .2 * (sizes[0] ?? 0) / .75;
    const textRects = textBoxes.map(box => ({ x: box.x, y: box.y - lift, width: box.width, height: box.height + 2 * lift }));
    const mid = values => values.length ? +[...values].sort((m, n) => m - n)[Math.floor((values.length - 1) / 2)].toFixed(2) : 0;
    // One comparison: the frame's crop at full size (16 px blocks) and at a quarter (8 px blocks), the same outside every text rectangle
    // (the shapes alone), and the ink offset in each text rectangle.
    const compare = async (a, b) => {
      const [x, y] = [await raw(a, crop), await raw(b, crop)], W = crop.width, H = crop.height, w = Math.max(1, Math.round(W / 4)), h = Math.max(1, Math.round(H / 4));
      const full = score(x, y, W, H, 16);
      const small = score(await sharp(x, { raw: { width: W, height: H, channels: 3 } }).resize(w, h, { fit: 'fill' }).raw().toBuffer(), await sharp(y, { raw: { width: W, height: H, channels: 3 } }).resize(w, h, { fit: 'fill' }).raw().toBuffer(), w, h, 8);
      // The shapes' own area (the union of the drawing's boxes), so a title beside a narrow frame is not counted.
      const ux0 = Math.min(...opf.map(o => o.left * PX)) - crop.left - 2, uy0 = Math.min(...opf.map(o => o.top * PX)) - crop.top - 2, ux1 = Math.max(...opf.map(o => (o.left + o.width) * PX)) - crop.left + 2, uy1 = Math.max(...opf.map(o => (o.top + o.height) * PX)) - crop.top + 2;
      const inShapes = (px, py) => px >= ux0 && px < ux1 && py >= uy0 && py < uy1;
      const inText = (px, py) => textRects.some(box => px >= box.x - 2 && px < box.x + box.width + 2 && py >= box.y - 2 && py < box.y + box.height + 2);
      let sum = 0, n = 0;
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { if (!inShapes(px, py) || inText(px, py)) continue; const i = (py * W + px) * 3; sum += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); n += 3; }
      // Visible local differences in the shapes (SH-07's hot measure): 16 x 16 blocks of the shapes' area outside the text whose mean differs by more than 24/255.
      let blocks = 0, hotBlocks = 0;
      for (let by = 0; by < H; by += 16) for (let bx = 0; bx < W; bx += 16) {
        let d = 0, c = 0;
        for (let py = by; py < Math.min(by + 16, H); py++) for (let px = bx; px < Math.min(bx + 16, W); px++) { if (!inShapes(px, py) || inText(px, py)) continue; for (let ch = 0; ch < 3; ch++) { const i = (py * W + px) * 3 + ch; d += x[i] - y[i]; c++; } }
        if (c < 16 * 16 * 3 / 2) continue;
        blocks++; if (Math.abs(d / c) > 24) hotBlocks++;
      }
      const geometryHot = blocks ? +(hotBlocks / blocks * 100).toFixed(2) : 0;
      const deltas = textBoxes.map(box => { const p = ink(x, W, box), q = ink(y, W, box); return p && q ? { dx: q.x - p.x, dy: q.y - p.y } : undefined; }).filter(Boolean);
      const offsets = deltas.map(d => Math.hypot(d.dx, d.dy));
      return { mad: small.mad, hot: small.hot, mad1280: full.mad, hot1280: full.hot, geometry: +(n ? sum / n : 0).toFixed(2), geometryHot, text: mid(offsets), textMax: offsets.length ? +Math.max(...offsets).toFixed(2) : 0, dx: mid(deltas.map(d => d.dx)), dy: mid(deltas.map(d => d.dy)) };
    };
    const preview = await compare(`${dir}/preview/${id}.png`, `${dir}/ppt/${id}.png`);
    const nativeFile = `${dir}/ppt-shapes/${id}.png`, native = existsSync(nativeFile) ? await compare(nativeFile, `${dir}/ppt/${id}.png`) : undefined;
    // OPF's native export against the preview: the same text offset as the SmartArt's shows it is OPF's text placement in PowerPoint, not SmartArt's.
    const nativePreview = existsSync(nativeFile) ? await compare(`${dir}/preview/${id}.png`, nativeFile) : undefined;
    const itemsMatch = ppt.length === opf.length;
    // The gate: PowerPoint lays out every node where core does at core's size; the shapes match the preview; and PowerPoint draws the live
    // SmartArt as it draws OPF's native export of the same slide (SH-07's thresholds), whose text is where OPF's native text export puts it.
    const checks = { layout: itemsMatch && rect <= .1 && turn <= .01, size: sizeEqual, geometry: preview.geometryHot <= .5 && preview.geometry <= 2.5, native: !!native && native.mad <= 1 && native.hot <= .5 && native.mad1280 <= 2 && native.hot1280 <= .5 && native.text <= 1.5 };
    const pass = Object.values(checks).every(Boolean);
    rows.push({ id, ...info, live: true, drew: opfLayout ? 'SmartArt (OPF layout)' : 'SmartArt (built-in)', layout: sa.layoutName, turn: +turn.toFixed(3), nodes: sa.nodes, rect: +rect.toFixed(3), sizes: [...new Set(sizes)].join('/'), pptSizes: [...new Set(pptSizes)].join('/'), sizeEqual, itemsMatch, preview, native, nativePreview, checks, result: pass ? 'pass' : `FAIL (${Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key).join(', ')})` });
  }
}
writeFileSync(`${dir}/gate.json`, JSON.stringify(rows, null, 2));
const head = '| Instance | Arrangement | Entries | Text | Frame | Script | Drawn as | Node rect max (pt) | Size (OPF / PowerPoint) | Shapes vs preview (mad 1280 outside text, hot) | Text vs preview, SmartArt / native export (dy px) | SmartArt vs native export (mad / hot / mad 1280 / hot 1280 / text px) | Result |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
writeFileSync(`${dir}/gate.md`, head + rows.map(r => `| ${r.id} | ${r.kind ?? ''} | ${r.count ?? ''} | ${r.text ?? ''} | ${r.aspect ?? ''} | ${r.script ?? ''} | ${r.drew} | ${r.rect ?? ''} | ${r.live ? `${r.sizes} / ${r.pptSizes}` : ''} | ${r.preview ? `${r.preview.geometry} (hot ${r.preview.geometryHot}%)` : r.slideScores ? `shapes: ${r.slideScores.shapesMad} (hot ${r.slideScores.shapesHot}%); whole slide with text: mad ${r.slideScores.mad}, hot 1280 ${r.slideScores.hot1280}%` : ''} | ${r.preview ? `${r.preview.dy} / ${r.nativePreview?.dy ?? ''}` : ''} | ${r.native ? `${r.native.mad} / ${r.native.hot} / ${r.native.mad1280} / ${r.native.hot1280} / ${r.native.text}` : ''} | ${r.result} |`).join('\n') + '\n');
console.log(`${rows.filter(r => r.result === 'pass').length} pass, ${rows.filter(r => r.result.startsWith('FAIL')).length} fail; drawn as: ${Object.entries(rows.reduce((m, r) => (m[r.drew] = (m[r.drew] ?? 0) + 1, m), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
for (const r of rows.filter(r => r.result.startsWith('FAIL'))) console.log(JSON.stringify(r));
