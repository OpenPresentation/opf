// Experiment 1: composite with explicit constraints. Does PowerPoint place each child exactly at l/t/w/h (shares of the frame)? Does it
// scale or move the drawing when the children's bounds do not fill the frame? Are shape rot and adj honored? Does the per-count choose work?
import { mkdirSync } from 'node:fs';
import { buildPptx, layoutDef, compositeBody, placeConstraints } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp1';
mkdirSync(dir, { recursive: true });
const odd = [.0123457, .3141593, .2718282, .1618034, .4142136, .7320508];
// Fill: per count k, k nodes on a diagonal, the first touching the top left, the last the bottom right.
const fill = k => ({
  nodes: Array.from({ length: k }, (_, i) => {
    const w = .31 + odd[i % 6] / 10, h = .27 + odd[(i + 2) % 6] / 10;
    const l = k === 1 ? 0 : (1 - w) * i / (k - 1), t = k === 1 ? 0 : (1 - h) * i / (k - 1);
    return { l, t, w: k === 1 ? 1 : w, h: k === 1 ? 1 : h, adj: .123 + i * .05, shape: i % 2 ? 'ellipse' : 'roundRect' };
  }),
  arrows: Array.from({ length: k }, (_, i) => ({ l: .05 + .1 * i, t: .8, w: .09, h: .05, rot: 17 + 30 * i })),
});
const interior = k => ({ nodes: Array.from({ length: k }, (_, i) => ({ l: .1 + .15 * i, t: .2 + .1 * i, w: .13, h: .2 })) });
const exceed = k => ({ nodes: Array.from({ length: k }, (_, i) => ({ l: -.1 + .3 * i, t: .1, w: .35, h: 1.1 })) });
const nodes = k => Array.from({ length: k }, (_, i) => ({ text: `Node ${i + 1}`, sz: 18 }));
const bg = `<dgm:layoutNode name="bg" styleLbl="bgShp"><dgm:alg type="sp"/><dgm:shape type="rect" hideGeom="1"><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>`;
const variants = {
  fill: { table: fill },
  interior: { table: interior },
  exceed: { table: exceed },
  interiorBg: { table: k => ({ ...interior(k), bg: true }), bg: true },
};
const files = [];
for (const [key, v] of Object.entries(variants)) {
  let body = compositeBody({ max: 4, table: v.table, margin: .2, ...(v.bg ? { bg: { l: 0, t: 0, w: 1, h: 1 } } : {}) });
  const xml = layoutDef({ uniqueId: `urn:openpresentation.org/smartart/layout/spike-${key}`, title: `OPF spike ${key}`, body });
  for (const k of [3]) files.push(buildPptx(`${dir}/${key}-${k}.pptx`, [{ frame: { x: 100, y: 80, w: 600, h: 400 }, layoutXml: xml, loId: `urn:openpresentation.org/smartart/layout/spike-${key}`, nodes: nodes(k) }]));
}
console.log(files.join('\n'));
