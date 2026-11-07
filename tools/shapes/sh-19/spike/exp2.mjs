// Experiment 2: rotated shapes (arrows): give the constraint box as the rotated bounding box of the wanted shape; read adjustments.
import { mkdirSync } from 'node:fs';
import { buildPptx, layoutDef, compositeBody } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp2';
mkdirSync(dir, { recursive: true });
const W = 800, H = 500;
const rots = [0, 10, 30, 45, 60, 90, 120, 170, 200, 270, 330, 359];
const aspects = [1, 2, 3.5, 6];
export const cases = [];
for (const a of aspects) for (const r of rots) {
  const h = 20, w = h * a, rad = r * Math.PI / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const bw = w * c + h * s, bh = w * s + h * c;
  cases.push({ a, r, w, h, bw, bh });
}
// One diagram per aspect: 12 nodes (one per rotation) in a row, each node a rightArrow (not an arrow sibTrans: a node, rot on the shape).
const files = [];
aspects.forEach((a, ai) => {
  const mine = cases.filter(c => c.a === a);
  const table = k => k === mine.length ? { nodes: mine.map((c, i) => ({ l: (20 + (i % 4) * 190) / W, t: (20 + Math.floor(i / 4) * 160) / H, w: c.bw / W, h: c.bh / H, shape: 'rightArrow', rot: c.r, adj: undefined })) } : undefined;
  const body = compositeBody({ max: mine.length, table, bg: { l: 0, t: 0, w: 1, h: 1 } }).replace(/<dgm:adjLst\/><\/dgm:shape><dgm:presOf axis="desOrSelf"/g, '<dgm:adjLst><dgm:adj idx="1" val="0.6"/><dgm:adj idx="2" val="0.5"/></dgm:adjLst></dgm:shape><dgm:presOf axis="desOrSelf"');
  const uid = `urn:openpresentation.org/smartart/layout/spike-rot-${ai}`;
  files.push(buildPptx(`${dir}/rot-${ai}.pptx`, [{ frame: { x: 80, y: 20, w: W, h: H }, layoutXml: layoutDef({ uniqueId: uid, title: `OPF rot ${a}`, body }), loId: uid, nodes: mine.map((c, i) => ({ text: '' + c.r, sz: 8 })) }], { slide: { w: 960, h: 540 } }));
});
console.log(files.length);
