// SH-19 tools: read an OPF-written layout part (dgm:layoutDef) back into core's LayoutDefinition (smart-art-layout.ts), so OPF's
// interpreter can evaluate what the file holds (the gate, and the COM fixture of the interpreter's unit test).
import { createRequire } from 'node:module';
const { XMLParser } = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/pptx/package.json')('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true, parseAttributeValue: false });
const nameOf = item => Object.keys(item).find(key => key !== ':@');
const attr = item => item[':@'] ?? {};
const kids = item => item[nameOf(item)] ?? [];
const num = value => value === undefined ? undefined : Number(value);

function constraints(list) {
  return list.filter(item => nameOf(item) === 'dgm:constr').map(item => {
    const a = attr(item), c = { type: a.type };
    for (const key of ['for', 'forName', 'refType', 'op']) if (a[key] !== undefined) c[key] = a[key];
    if (a.fact !== undefined) c.fact = Number(a.fact);
    if (a.val !== undefined) c.val = Number(a.val);
    return c;
  });
}
function content(list) {
  const out = { children: [] };
  for (const item of list) {
    const name = nameOf(item), a = attr(item);
    if (name === 'dgm:alg') { const params = Object.fromEntries(kids(item).filter(p => nameOf(p) === 'dgm:param').map(p => [attr(p).type, attr(p).val])); out.alg = { type: a.type, ...(Object.keys(params).length ? { params } : {}) }; }
    else if (name === 'dgm:shape') {
      const adj = (kids(item).find(p => nameOf(p) === 'dgm:adjLst') ? kids(kids(item).find(p => nameOf(p) === 'dgm:adjLst')) : []).filter(p => nameOf(p) === 'dgm:adj').map(p => Math.round(Number(attr(p).val) * 100000));
      if (a.type !== undefined || adj.length || a.hideGeom || a.rot) out.shape = { type: a.type ?? 'none', ...(a.rot ? { rot: Number(a.rot) } : {}), ...(a.hideGeom === '1' || a.hideGeom === 'true' ? { hideGeom: true } : {}), adj };
    } else if (name === 'dgm:presOf') { if (a.axis) out.presOf = { axis: a.axis, ...(a.ptType ? { ptType: a.ptType } : {}) }; }
    else if (name === 'dgm:constrLst') out.constraints = constraints(kids(item));
    else if (name === 'dgm:layoutNode') out.children.push(node(item));
    else if (name === 'dgm:forEach') out.children.push({ kind: 'forEach', name: a.name, axis: a.axis, ptType: a.ptType, ...(a.st ? { st: num(a.st) } : {}), ...(a.cnt ? { cnt: num(a.cnt) } : {}), ...(a.hideLastTrans === '0' || a.hideLastTrans === 'false' ? { hideLastTrans: false } : {}), children: content(kids(item)).children });
    else if (name === 'dgm:choose') out.children.push({ kind: 'choose', name: a.name, branches: kids(item).filter(b => ['dgm:if', 'dgm:else'].includes(nameOf(b))).map(b => {
      const inner = content(kids(b)), ba = attr(b);
      if (nameOf(b) === 'dgm:if' && (ba.func !== 'cnt' || ba.op !== 'equ')) throw new Error(`unsupported if ${JSON.stringify(ba)}`);
      return { name: ba.name, ...(nameOf(b) === 'dgm:if' ? { count: Number(ba.val) } : {}), ...(inner.alg ? { alg: inner.alg } : {}), ...(inner.shape ? { shape: inner.shape } : {}), ...(inner.constraints ? { constraints: inner.constraints } : {}), children: inner.children };
    }) });
  }
  return out;
}
function node(item) {
  const a = attr(item), c = content(kids(item));
  return { kind: 'layoutNode', name: a.name, ...(a.styleLbl ? { styleLbl: a.styleLbl } : {}), ...(c.alg ? { alg: c.alg } : {}), ...(c.shape ? { shape: c.shape } : {}), ...(c.presOf ? { presOf: c.presOf } : {}), ...(c.constraints ? { constraints: c.constraints } : {}), children: c.children };
}
/** A layout part's text as core's LayoutDefinition. */
export function parseLayoutDefinition(xml) {
  const top = parser.parse(xml).find(item => nameOf(item) === 'dgm:layoutDef'), list = kids(top), a = attr(top);
  const val = name => attr(list.find(item => nameOf(item) === name) ?? {}).val ?? '';
  const category = attr(kids(list.find(item => nameOf(item) === 'dgm:catLst') ?? { x: [] })[0] ?? {}).type ?? 'other';
  return { uniqueId: a.uniqueId, title: val('dgm:title'), description: val('dgm:desc'), category, root: node(list.find(item => nameOf(item) === 'dgm:layoutNode')) };
}
