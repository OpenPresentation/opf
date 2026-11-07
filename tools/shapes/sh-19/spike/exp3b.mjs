// The closing arrow of a loop (last node to the first) with conn.
import { mkdirSync } from 'node:fs';
import { buildPptx, layoutDef, placeConstraints } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp3b';
mkdirSync(dir, { recursive: true });
const W = 700, H = 450;
const boxes = [{ l: .4, t: 0, w: .2, h: .2 }, { l: .8, t: .4, w: .2, h: .2 }, { l: .4, t: .8, w: .2, h: .2 }, { l: 0, t: .4, w: .2, h: .2 }];
const bg = '<dgm:layoutNode name="bg" styleLbl="bgShp"><dgm:alg type="sp"/><dgm:shape type="rect" hideGeom="1"><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>';
const node = i => `<dgm:layoutNode name="n${i}" styleLbl="node1"><dgm:alg type="tx"/><dgm:shape type="ellipse"><dgm:adjLst/></dgm:shape><dgm:presOf axis="desOrSelf" ptType="node"/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>`;
const arrow = (a, src, dst, presOf = '<dgm:presOf axis="self"/>', pts = 'ctr') => `<dgm:layoutNode name="${a}" styleLbl="sibTrans2D1"><dgm:alg type="conn"><dgm:param type="dim" val="2D"/><dgm:param type="begPts" val="${pts}"/><dgm:param type="endPts" val="${pts}"/>${src ? `<dgm:param type="srcNode" val="${src}"/>` : ''}${dst ? `<dgm:param type="dstNode" val="${dst}"/>` : ''}</dgm:alg><dgm:shape type="rightArrow"><dgm:adjLst><dgm:adj idx="1" val="0.6"/><dgm:adj idx="2" val="0.5"/></dgm:adjLst></dgm:shape>${presOf}<dgm:constrLst><dgm:constr type="begPad" val="5"/><dgm:constr type="endPad" val="3"/><dgm:constr type="h" val="8"/></dgm:constrLst><dgm:ruleLst/></dgm:layoutNode>`;
const each = (i, inner) => `<dgm:forEach name="f${i}" axis="ch" ptType="node" st="${i}" cnt="1">${inner}</dgm:forEach>`;
const sib = (i, inner) => `<dgm:forEach name="s${i}" axis="followSib" ptType="sibTrans" cnt="1">${inner}</dgm:forEach>`;
const c = boxes.map((b, i) => placeConstraints(`n${i + 1}`, b)).join('') + placeConstraints('bg', { l: 0, t: 0, w: 1, h: 1 });
const root = inner => `<dgm:layoutNode name="root"><dgm:alg type="composite"/><dgm:shape><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst>${c}</dgm:constrLst><dgm:ruleLst/>${bg}${inner}</dgm:layoutNode>`;
const variants = {
  // the closing arrow in a forEach after all nodes
  after: root([1, 2, 3, 4].map(i => each(i, node(i) + (i < 4 ? sib(i, arrow(`a${i}`, `n${i}`, `n${i + 1}`)) : ''))).join('') + each(4, sib('4b', arrow('a4', 'n4', 'n1')))),
  // all arrows after all nodes
  allAfter: root([1, 2, 3, 4].map(i => each(i, node(i))).join('') + [1, 2, 3, 4].map(i => each(`${i}b`, sib(i, arrow(`a${i}`, `n${i}`, `n${i % 4 + 1}`))).replace(`st="${i}b"`, `st="${i}"`)).join('')),
  // the closing arrow first in the tree
  first: root(each('4b', sib(4, arrow('a4', 'n4', 'n1'))).replace('st="4b"', 'st="4"') + [1, 2, 3, 4].map(i => each(i, node(i) + (i < 4 ? sib(i, arrow(`a${i}`, `n${i}`, `n${i + 1}`)) : ''))).join('')),
  // a closing arrow that presents nothing (no sibTrans), after the nodes
  noPres: root([1, 2, 3, 4].map(i => each(i, node(i) + (i < 4 ? sib(i, arrow(`a${i}`, `n${i}`, `n${i + 1}`)) : ''))).join('') + arrow('a4', 'n4', 'n1', '<dgm:presOf/>')),
  // auto points (the nodes' outlines)
  autoPts: root([1, 2, 3, 4].map(i => each(i, node(i) + (i < 4 ? sib(i, arrow(`a${i}`, `n${i}`, `n${i + 1}`, undefined, 'auto')) : ''))).join('')),
};
for (const [v, body] of Object.entries(variants)) {
  const uid = `urn:openpresentation.org/smartart/layout/spike-close-${v}`;
  buildPptx(`${dir}/close-${v}.pptx`, [{ frame: { x: 100, y: 40, w: W, h: H }, layoutXml: layoutDef({ uniqueId: uid, title: `OPF close ${v}`, body }), loId: uid, nodes: [1, 2, 3, 4].map(i => ({ text: `N${i}`, sz: 14 })) }]);
}
