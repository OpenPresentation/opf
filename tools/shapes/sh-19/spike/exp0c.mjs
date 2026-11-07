import { buildPptx, layoutDef, compositeBody } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp0';
const nodes = [{ text: 'Alpha', sz: 18 }, { text: 'Beta', sz: 18 }, { text: 'Gamma', sz: 18 }];
const boxes = k => Array.from({ length: k }, (_, i) => ({ l: .1 + .25 * i, t: .1 + .2 * i, w: .2, h: .2 }));
const variants = {
  two: { max: 4, table: k => k >= 2 && k <= 3 ? { nodes: boxes(k) } : undefined },
  three: { max: 4, table: k => k >= 2 ? { nodes: boxes(k) } : undefined },
};
for (const [k, v] of Object.entries(variants)) {
  const uid = `urn:openpresentation.org/smartart/layout/bisect3-${k}`;
  let body = compositeBody(v);
  buildPptx(`${dir}/d-${k}.pptx`, [{ frame: { x: 100, y: 80, w: 600, h: 400 }, layoutXml: layoutDef({ uniqueId: uid, title: `OPF bisect3 ${k}`, body }), loId: uid, nodes }]);
  // unique names per branch
  let branch = 0;
  body = body.replace(/<dgm:if name="c(\d)"[\s\S]*?<\/dgm:if>/g, (m, c) => m.replace(/name="([nfas])(\d)"/g, `name="$1${c}_$2"`).replace(/forName="([na])(\d)"/g, `forName="$1${c}_$2"`));
  buildPptx(`${dir}/d-${k}-uniq.pptx`, [{ frame: { x: 100, y: 80, w: 600, h: 400 }, layoutXml: layoutDef({ uniqueId: uid + '-u', title: `OPF bisect3 ${k} uniq`, body }), loId: uid + '-u', nodes }]);
}
