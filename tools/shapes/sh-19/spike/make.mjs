// SH-19 spike: build a PPTX whose slide holds SmartArt frames with an OPF-authored layout definition (layoutN.xml, written here from
// ECMA-376 Part 1 21.4, never from PowerPoint's parts). The package shell is an OPF export (base.pptx: OPF's master, theme, quick style
// and colors parts); the slide's shapes are replaced by the frames below.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { unzipSync, zipSync, strFromU8, strToU8 } = require('C:/opf-work/sh-19-smartart-layouts/node_modules/.pnpm/fflate@0.8.3/node_modules/fflate');
const BASE = 'C:/opf-work/shapes/sh-19/spike/base.pptx';
export const NS = { dgm: 'http://schemas.openxmlformats.org/drawingml/2006/diagram', a: 'http://schemas.openxmlformats.org/drawingml/2006/main' };
const EMU = 12700; // per point
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const id = (n, role, i = 0) => `{${String(n).padStart(8, '0')}-${String(role).padStart(4, '0')}-4${String(i).padStart(3, '0')}-8000-000000000000}`;

export function dataXml(number, loId, nodes, { custT = true, lang = 'en-US', face = 'Source Sans 3', pitch } = {}) {
  const doc = id(number, 1), pts = [`<dgm:pt modelId="${doc}" type="doc"><dgm:prSet loTypeId="${esc(loId)}" loCatId="" qsTypeId="urn:openpresentation.org/opf/smartart/quickstyle/flat" qsCatId="simple" csTypeId="urn:openpresentation.org/opf/smartart/colors/primary" csCatId="accent1"/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${lang}"/></a:p></dgm:t></dgm:pt>`], cx = [];
  nodes.forEach((node, k) => {
    const n = id(number, 2, k), p = id(number, 3, k), s = id(number, 4, k), c = id(number, 5, k);
    const sz = node.sz ? ` sz="${Math.round(node.sz * 100)}"` : '';
    const lnSpc = pitch ? `<a:lnSpc><a:spcPts val="${Math.round(pitch * 100)}"/></a:lnSpc>` : '';
    pts.push(`<dgm:pt modelId="${n}"><dgm:prSet${custT && node.sz ? ' custT="1"' : ''}/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${node.algn ?? 'ctr'}">${lnSpc}<a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr><a:r><a:rPr lang="${node.lang ?? lang}"${sz} dirty="0"><a:latin typeface="${face}"/></a:rPr><a:t>${esc(node.text)}</a:t></a:r></a:p></dgm:t></dgm:pt>`,
      `<dgm:pt modelId="${p}" type="parTrans" cxnId="${c}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${lang}"/></a:p></dgm:t></dgm:pt>`,
      `<dgm:pt modelId="${s}" type="sibTrans" cxnId="${c}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${lang}"/></a:p></dgm:t></dgm:pt>`);
    const parent = node.parent === undefined ? doc : id(number, 2, node.parent), ord = nodes.slice(0, k).filter(o => o.parent === node.parent).length;
    cx.push(`<dgm:cxn modelId="${c}" srcId="${parent}" destId="${n}" srcOrd="${ord}" destOrd="0" parTransId="${p}" sibTransId="${s}"/>`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:dataModel xmlns:dgm="${NS.dgm}" xmlns:a="${NS.a}"><dgm:ptLst>${pts.join('')}</dgm:ptLst><dgm:cxnLst>${cx.join('')}</dgm:cxnLst><dgm:bg/><dgm:whole/></dgm:dataModel>`;
}

/** diagrams: [{ frame: {x, y, w, h} (pt), layoutXml, loId, nodes: [{text, sz, algn}], wrap: true (mc:AlternateContent without fallback picture: bare frame) }] */
export function buildPptx(out, diagrams, { slide = { w: 960, h: 540 } } = {}) {
  const z = unzipSync(readFileSync(BASE));
  for (const key of Object.keys(z)) if (/^ppt\/(diagrams|media)\//.test(key) || /^ppt\/tags\/opf(SmartArt|Heading|Slide)/.test(key)) delete z[key];
  let ct = strFromU8(z['[Content_Types].xml']).replace(/<Override PartName="\/ppt\/(diagrams\/[^"]+|tags\/opf(SmartArt|Heading|Slide)[^"]*)"[^>]*\/>/g, '');
  const rels = ['<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout7.xml"/>'];
  const frames = [];
  diagrams.forEach((d, k) => {
    const n = k + 1, r = name => `rId${name}${n}`;
    z[`ppt/diagrams/data${n}.xml`] = strToU8(d.dataXml ?? dataXml(n, d.loId, d.nodes, d.dataOptions));
    if (d.layoutXml !== null) z[`ppt/diagrams/layout${n}.xml`] = strToU8(d.layoutXml);
    z[`ppt/diagrams/quickStyle${n}.xml`] = unzipSync(readFileSync(BASE))['ppt/diagrams/quickStyle1.xml'];
    z[`ppt/diagrams/colors${n}.xml`] = unzipSync(readFileSync(BASE))['ppt/diagrams/colors1.xml'];
    ct = ct.replace('</Types>', `<Override PartName="/ppt/diagrams/data${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml"/>${d.layoutXml !== null ? `<Override PartName="/ppt/diagrams/layout${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramLayout+xml"/>` : ''}<Override PartName="/ppt/diagrams/quickStyle${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramStyle+xml"/><Override PartName="/ppt/diagrams/colors${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramColors+xml"/></Types>`);
    rels.push(`<Relationship Id="${r('Dm')}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data${n}.xml"/>`,
      ...(d.layoutXml !== null ? [`<Relationship Id="${r('Lo')}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout" Target="../diagrams/layout${n}.xml"/>`] : []),
      `<Relationship Id="${r('Qs')}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramQuickStyle" Target="../diagrams/quickStyle${n}.xml"/>`,
      `<Relationship Id="${r('Cs')}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramColors" Target="../diagrams/colors${n}.xml"/>`);
    const f = d.frame, e = v => Math.round(v * EMU);
    const gf = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${10 + n}" name="${esc(d.name ?? `SA ${n}`)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${e(f.x)}" y="${e(f.y)}"/><a:ext cx="${e(f.w)}" cy="${e(f.h)}"/></p:xfrm><a:graphic><a:graphicData uri="${NS.dgm}"><dgm:relIds xmlns:dgm="${NS.dgm}" r:dm="${r('Dm')}" r:lo="${d.layoutXml !== null ? r('Lo') : ''}" r:qs="${r('Qs')}" r:cs="${r('Cs')}"/></a:graphicData></a:graphic></p:graphicFrame>`;
    frames.push(d.alternate ? `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:${d.alternate.prefix}="${d.alternate.ns}" Requires="${d.alternate.prefix}">${gf}</mc:Choice><mc:Fallback>${d.alternate.fallback}</mc:Fallback></mc:AlternateContent>` : gf);
  });
  z['[Content_Types].xml'] = strToU8(ct);
  z['ppt/slides/_rels/slide1.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  z['ppt/slides/slide1.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="${NS.a}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${frames.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
  z['ppt/presentation.xml'] = strToU8(strFromU8(z['ppt/presentation.xml']).replace(/<p:sldSz[^>]*\/>/, `<p:sldSz cx="${slide.w * EMU}" cy="${slide.h * EMU}"/>`));
  // The notes slide of the shell stays; it refers to slide1 only.
  writeFileSync(out, zipSync(z));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Layout definition builders (ECMA-376 Part 1, 21.4).
const num = v => String(Number(v.toFixed(9)));
export function layoutDef({ uniqueId, title, desc, cat = 'other', body }) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:layoutDef xmlns:dgm="${NS.dgm}" xmlns:a="${NS.a}" uniqueId="${esc(uniqueId)}"><dgm:title val="${esc(title)}"/><dgm:desc val="${esc(desc ?? title)}"/><dgm:catLst><dgm:cat type="${cat}" pri="99000"/></dgm:catLst>${body}</dgm:layoutDef>`;
}
const constr = (type, forName, fact, refType, extra = '') => `<dgm:constr type="${type}" for="ch" forName="${forName}" refType="${refType}" fact="${num(fact)}"${extra}/>`;
/** One shape child's constraints: l/t/w/h as fractions of the root's w and h. */
export const placeConstraints = (name, box) => constr('l', name, box.l, 'w') + constr('t', name, box.t, 'h') + constr('w', name, box.w, 'w') + constr('h', name, box.h, 'h');
const margins = (fact) => ['lMarg', 'rMarg', 'tMarg', 'bMarg'].map(t => `<dgm:constr type="${t}" refType="primFontSz" fact="${num(fact)}"/>`).join('');
/**
 * A composite layout: per node count (1..max) an `if` branch holding the root's constraints for nodes n1..nk and arrows a1..ak, and the
 * forEach that makes them. table(k) -> { nodes: [{l,t,w,h, shape, adj, rot}], arrows: [{l,t,w,h, rot, shape, adj}] } in shares of W and H.
 */
export function compositeBody({ max, table, margin = .2, txParams = '', rules = '', nodeStyle = 'node1', arrowStyle = 'sibTrans2D1', text = 'ctr', extraRoot = '', bg }) {
  const branches = [];
  for (let k = 1; k <= max; k++) {
    const t = table(k);
    if (!t) continue;
    const c = [...t.nodes.map((b, i) => placeConstraints(`n${k}_${i + 1}`, b)), ...(t.arrows ?? []).map((b, i) => b ? placeConstraints(`a${k}_${i + 1}`, b) : ''), ...(bg ? [placeConstraints(`bg${k}`, bg)] : [])].join('');
    const back = bg ? `<dgm:layoutNode name="bg${k}" styleLbl="bgShp"><dgm:alg type="sp"/><dgm:shape type="rect"${bg.hide === false ? '' : ' hideGeom="1"'}><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode>` : '';
    const each = t.nodes.map((b, i) => {
      const adj = b.adj !== undefined ? `<dgm:adjLst><dgm:adj idx="1" val="${num(b.adj)}"/></dgm:adjLst>` : '<dgm:adjLst/>';
      const a = t.arrows?.[i];
      const arrow = a ? `<dgm:forEach name="s${k}_${i + 1}" axis="followSib" ptType="sibTrans" cnt="1"><dgm:layoutNode name="a${k}_${i + 1}" styleLbl="${arrowStyle}"><dgm:alg type="sp"/><dgm:shape type="${a.shape ?? 'rightArrow'}"${a.rot ? ` rot="${num(a.rot)}"` : ''}><dgm:adjLst>${(a.adj ?? [.6, .5]).map((v, j) => `<dgm:adj idx="${j + 1}" val="${num(v)}"/>`).join('')}</dgm:adjLst></dgm:shape><dgm:presOf axis="self"/><dgm:constrLst/><dgm:ruleLst/></dgm:layoutNode></dgm:forEach>` : '';
      return `<dgm:forEach name="f${k}_${i + 1}" axis="ch" ptType="node" st="${i + 1}" cnt="1"><dgm:layoutNode name="n${k}_${i + 1}" styleLbl="${nodeStyle}"><dgm:varLst><dgm:bulletEnabled val="1"/></dgm:varLst><dgm:alg type="tx">${txParams}</dgm:alg><dgm:shape type="${b.shape ?? 'roundRect'}"${b.rot ? ` rot="${num(b.rot)}"` : ''}>${adj}</dgm:shape><dgm:presOf axis="desOrSelf" ptType="node"/><dgm:constrLst>${margins(margin)}</dgm:constrLst><dgm:ruleLst>${rules}</dgm:ruleLst></dgm:layoutNode>${arrow}</dgm:forEach>`;
    }).join('');
    branches.push(`<dgm:if name="c${k}" func="cnt" axis="ch" ptType="node" op="equ" val="${k}"><dgm:alg type="composite"/><dgm:shape><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst>${c}</dgm:constrLst><dgm:ruleLst/>${back}${each}</dgm:if>`);
  }
  return `<dgm:layoutNode name="root">${extraRoot}<dgm:choose name="byCount">${branches.join('')}<dgm:else name="other"><dgm:alg type="composite"/><dgm:shape><dgm:adjLst/></dgm:shape><dgm:presOf/><dgm:constrLst/><dgm:ruleLst/></dgm:else></dgm:choose></dgm:layoutNode>`;
}
