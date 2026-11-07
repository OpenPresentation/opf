import { buildPptx, layoutDef, compositeBody } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp0';
const nodes = [{ text: 'Alpha', sz: 18 }, { text: 'Beta', sz: 18 }, { text: 'Gamma', sz: 18 }];
const boxes = k => Array.from({ length: k }, (_, i) => ({ l: .1 + .25 * i, t: .1 + .2 * i, w: .2, h: .2 }));
const variants = {
  plain: { table: k => ({ nodes: boxes(k) }) },
  adj: { table: k => ({ nodes: boxes(k).map(b => ({ ...b, adj: .2 })) }) },
  arrows: { table: k => ({ nodes: boxes(k), arrows: boxes(k).map(b => ({ ...b, t: b.t + .25, h: .05 })) }) },
  arrowsRot: { table: k => ({ nodes: boxes(k), arrows: boxes(k).map(b => ({ ...b, t: b.t + .25, h: .05, rot: 30 })) }) },
  only3: { table: k => k === 3 ? { nodes: boxes(k) } : undefined },
};
for (const [k, v] of Object.entries(variants)) {
  const uid = `urn:openpresentation.org/smartart/layout/bisect2-${k}`;
  buildPptx(`${dir}/c-${k}.pptx`, [{ frame: { x: 100, y: 80, w: 600, h: 400 }, layoutXml: layoutDef({ uniqueId: uid, title: `OPF bisect2 ${k}`, body: compositeBody({ max: 4, ...v }) }), loId: uid, nodes }]);
}
