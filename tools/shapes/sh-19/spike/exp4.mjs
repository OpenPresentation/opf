// Experiment 4: text under a composite layout: explicit sz (custT), margins, alignment, anchoring, rules, added nodes, scripts.
// Experiment 5 (same files): two frames with the same uniqueId and different content.
import { mkdirSync } from 'node:fs';
import { buildPptx, layoutDef, compositeBody } from './make.mjs';
const dir = 'C:/opf-work/shapes/sh-19/spike/exp4';
mkdirSync(dir, { recursive: true });
const W = 600, H = 400;
const boxes = k => Array.from({ length: k }, (_, i) => ({ l: (i % 2) * .52, t: Math.floor(i / 2) * .52, w: .48, h: .48, adj: .16667 }));
const long = 'Customers who stay and refer others every single week';
const texts = [{ text: 'Plan the work', sz: 24 }, { text: long, sz: 24, algn: 'l' }, { text: 'Ship it', sz: 30 }];
const mk = (name, opts, nodes = texts, frameDiagrams = 1) => {
  const uid = opts.uid ?? `urn:openpresentation.org/smartart/layout/spike-text-${name}`;
  const xml = layoutDef({ uniqueId: uid, title: `OPF text ${name}`, body: compositeBody({ max: 4, table: k => ({ nodes: boxes(k) }), bg: { l: 0, t: 0, w: 1, h: 1 }, ...opts }) });
  return { xml, uid };
};
const variants = {
  base: {},
  margin6: { margin: .6 },
  anchorTop: { txParams: '<dgm:param type="txAnchorVert" val="t"/>' },
  alignLeft: { txParams: '<dgm:param type="parTxLTRAlign" val="l"/><dgm:param type="parTxRTLAlign" val="r"/>' },
  rules: { rules: '<dgm:rule type="primFontSz" val="5" fact="NaN" max="NaN"/>' },
  primSz: { extraRoot: '' },
};
for (const [name, opts] of Object.entries(variants)) {
  let { xml, uid } = mk(name, opts);
  if (name === 'primSz') xml = xml.replace(/(<dgm:if name="c(\d)"[^>]*><dgm:alg type="composite"\/><dgm:shape><dgm:adjLst\/><\/dgm:shape><dgm:presOf\/><dgm:constrLst>)/g, (m, a, k) => a + Array.from({ length: +k }, (_, i) => `<dgm:constr type="primFontSz" for="ch" forName="n${k}_${i + 1}" op="equ" val="20"/>`).join(''));
  buildPptx(`${dir}/text-${name}.pptx`, [{ frame: { x: 100, y: 60, w: W, h: H }, layoutXml: xml, loId: uid, nodes: texts }]);
}
// Scripts.
{
  const { xml, uid } = mk('ja', {});
  buildPptx(`${dir}/text-ja.pptx`, [{ frame: { x: 100, y: 60, w: W, h: H }, layoutXml: xml, loId: uid, nodes: [{ text: '目標と計画', sz: 24, lang: 'ja-JP' }, { text: 'チームと基盤を整える', sz: 24, lang: 'ja-JP' }, { text: 'ビジョン', sz: 30, lang: 'ja-JP' }], dataOptions: { lang: 'ja-JP' } }]);
  const ar = mk('ar', {});
  buildPptx(`${dir}/text-ar.pptx`, [{ frame: { x: 100, y: 60, w: W, h: H }, layoutXml: ar.xml, loId: ar.uid, nodes: [{ text: 'الرؤية', sz: 24, lang: 'ar-SA' }, { text: 'الأهداف والفرق والمنصة', sz: 24, lang: 'ar-SA' }, { text: 'البرامج', sz: 30, lang: 'ar-SA' }], dataOptions: { lang: 'ar-SA', face: 'Noto Sans Arabic' } }]);
}
// Experiment 5: two frames, one uniqueId, different tables.
{
  const uid = 'urn:openpresentation.org/smartart/layout/spike-same';
  const one = layoutDef({ uniqueId: uid, title: 'OPF same (A)', body: compositeBody({ max: 4, table: k => ({ nodes: boxes(k) }), bg: { l: 0, t: 0, w: 1, h: 1 } }) });
  const two = layoutDef({ uniqueId: uid, title: 'OPF same (B)', body: compositeBody({ max: 4, table: k => ({ nodes: boxes(k).map(b => ({ ...b, l: b.l / 2, w: b.w / 2 })) }), bg: { l: 0, t: 0, w: 1, h: 1 } }) });
  buildPptx(`${dir}/same-uid.pptx`, [{ frame: { x: 20, y: 60, w: 400, h: 300 }, layoutXml: one, loId: uid, nodes: texts }, { frame: { x: 500, y: 60, w: 400, h: 300 }, layoutXml: two, loId: uid, nodes: texts }]);
}
