// Experiment 7: does PowerPoint cap a text node's width? Text-only rect nodes (revTx, fgAcc1, node1) at several widths.
import { mkdirSync } from 'node:fs';
import { buildPptx, layoutDef, placeConstraints } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp7'; mkdirSync(dir, { recursive: true });
const widths = [.3, .5, .55, .57, .6, .8, .95];
for (const [label, shape] of [['revTx', 'rect'], ['fgAcc1', 'rect'], ['node1', 'rect'], ['node1', 'roundRect'], ['revTx', 'roundRect']]) {
  const nodes = widths.map((w, i) => `<dgm:forEach name="f${i}" axis="ch" ptType="node" st="${i + 1}" cnt="1"><dgm:layoutNode name="n${i}" styleLbl="${label}"><dgm:alg type="tx"/><dgm:shape type="${shape}"><dgm:adjLst/></dgm:shape><dgm:presOf axis="desOrSelf" ptType="node"/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode></dgm:forEach>`).join('');
  const c = widths.map((w, i) => placeConstraints(`n${i}`, { l: 1 - w, t: i * .14, w, h: .12 })).join('') + placeConstraints('bg', { l: 0, t: 0, w: 1, h: 1 });
  const body = `<dgm:layoutNode name="root"><dgm:alg type="composite"/><dgm:shape><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst>${c}</dgm:constrLst><dgm:ruleLst/><dgm:layoutNode name="bg" styleLbl="bgShp"><dgm:alg type="sp"/><dgm:shape type="rect" hideGeom="1"><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>${nodes}</dgm:layoutNode>`;
  const uid = `urn:openpresentation.org/smartart/layout/spike-width-${label}-${shape}`;
  buildPptx(`${dir}/w-${label}-${shape}.pptx`, [{ frame: { x: 40, y: 20, w: 800, h: 500 }, layoutXml: layoutDef({ uniqueId: uid, title: uid, body }), loId: uid, nodes: widths.map(w => ({ text: `Text ${w}`, sz: 14, algn: 'l' })) }]);
}
