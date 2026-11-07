// Experiment 3: the conn algorithm between composite-placed nodes: center points, explicit src/dst, pads and thickness.
import { mkdirSync } from 'node:fs';
import { buildPptx, layoutDef, placeConstraints } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp3';
mkdirSync(dir, { recursive: true });
const W = 700, H = 450;
// 4 nodes on a diamond (top, right, bottom, left), so the arrows are at 45 degrees.
const boxes = [{ l: .4, t: 0, w: .2, h: .2 }, { l: .8, t: .4, w: .2, h: .2 }, { l: .4, t: .8, w: .2, h: .2 }, { l: 0, t: .4, w: .2, h: .2 }];
const num = v => String(Number(v.toFixed(9)));
function body(variant) {
  const c = boxes.map((b, i) => placeConstraints(`n${i + 1}`, b)).join('') + placeConstraints('bg', { l: 0, t: 0, w: 1, h: 1 });
  let arrowsRoot = '';
  const nodes = boxes.map((b, i) => {
    const src = `n${i + 1}`, dst = `n${(i + 1) % 4 + 1}`, a = `a${i + 1}`;
    const pad = .1 + .05 * i;
    let own = '';
    if (variant === 'root') arrowsRoot += `<dgm:constr type="begPad" for="ch" forName="${a}" refType="connDist" refFor="ch" refForName="${a}" fact="${num(pad)}"/><dgm:constr type="endPad" for="ch" forName="${a}" refType="connDist" refFor="ch" refForName="${a}" fact="${num(pad / 2)}"/><dgm:constr type="h" for="ch" forName="${a}" refType="w" fact="0.03"/>`;
    if (variant === 'own') own = `<dgm:constr type="begPad" refType="connDist" fact="${num(pad)}"/><dgm:constr type="endPad" refType="connDist" fact="${num(pad / 2)}"/><dgm:constr type="h" refType="connDist" fact="0.1"/>`;
    if (variant === 'abs') own = `<dgm:constr type="begPad" val="${num(5 + 2 * i)}"/><dgm:constr type="endPad" val="${num(3)}"/><dgm:constr type="h" val="8"/>`;
    const conn = `<dgm:alg type="conn"><dgm:param type="dim" val="2D"/><dgm:param type="begPts" val="ctr"/><dgm:param type="endPts" val="ctr"/><dgm:param type="srcNode" val="${src}"/><dgm:param type="dstNode" val="${dst}"/></dgm:alg>`;
    return `<dgm:forEach name="f${i + 1}" axis="ch" ptType="node" st="${i + 1}" cnt="1"><dgm:layoutNode name="${src}" styleLbl="node1"><dgm:alg type="tx"/><dgm:shape type="ellipse"><dgm:adjLst/></dgm:shape><dgm:presOf axis="desOrSelf" ptType="node"/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode><dgm:forEach name="s${i + 1}" axis="followSib" ptType="sibTrans" cnt="1"><dgm:layoutNode name="${a}" styleLbl="sibTrans2D1">${conn}<dgm:shape type="rightArrow"><dgm:adjLst><dgm:adj idx="1" val="0.6"/><dgm:adj idx="2" val="0.5"/></dgm:adjLst></dgm:shape><dgm:presOf axis="self"/><dgm:constrLst>${own}</dgm:constrLst><dgm:ruleLst/></dgm:layoutNode></dgm:forEach></dgm:forEach>`;
  }).join('');
  return `<dgm:layoutNode name="root"><dgm:alg type="composite"/><dgm:shape><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst>${c}${arrowsRoot}</dgm:constrLst><dgm:ruleLst/><dgm:layoutNode name="bg" styleLbl="bgShp"><dgm:alg type="sp"/><dgm:shape type="rect" hideGeom="1"><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>${nodes}</dgm:layoutNode>`;
}
for (const v of ['none', 'root', 'own', 'abs']) {
  const uid = `urn:openpresentation.org/smartart/layout/spike-conn-${v}`;
  buildPptx(`${dir}/conn-${v}.pptx`, [{ frame: { x: 100, y: 40, w: W, h: H }, layoutXml: layoutDef({ uniqueId: uid, title: `OPF conn ${v}`, body: body(v) }), loId: uid, nodes: [1, 2, 3, 4].map(i => ({ text: `N${i}`, sz: 14 })) }]);
}
