import fs from 'node:fs';
const rep=(s,o,n)=>{ if(s.split(o).length!==2) throw Error('count '+o.slice(0,60)); return s.replace(o,n); };
let c=fs.readFileSync('packages/pptx/src/connectors.js','utf8');
c=rep(c,`/** The native name of a connector. */`,`/**
 * One native connector, p:cxnSp: the one writer of SH-04's overlay connectors and SH-07's glued diagram edges. \`cNvPr\` is its p:cNvPr
 * element, \`start\` and \`end\` the shapes it is glued to (\`{ id, site }\`: the native shape's p:cNvPr id and core's connection site index,
 * undefined for an end that is not glued), \`xfrm\` and \`geometry\` its frame and preset, \`ln\` its line and \`effects\` what follows the line.
 */
export function connectorXml({ cNvPr, start, end, xfrm, geometry, ln, effects = '' }) {
  const glue = (tag, at) => at ? \`<a:\${tag} id="\${at.id}" idx="\${at.site}"/>\` : '';
  return \`<p:cxnSp><p:nvCxnSpPr>\${cNvPr}<p:cNvCxnSpPr>\${glue('stCxn', start)}\${glue('endCxn', end)}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>\${xfrm}\${geometry}<a:noFill/>\${ln}\${effects}</p:spPr></p:cxnSp>\`;
}

/** The native name of a connector. */`);
c=rep(c,`    const glue = (tag, end) => { const id = end?.name !== undefined ? ids.get(end.name) : undefined; return id ? \`<a:\${tag} id="\${id}" idx="\${end.site}"/>\` : ''; };\n`,
`    const glued = end => { const id = end?.name !== undefined ? ids.get(end.name) : undefined; return id ? { id, site: end.site } : undefined; };\n`);
c=rep(c,"    return `<p:cxnSp><p:nvCxnSpPr>${cNvPr}<p:cNvCxnSpPr>${glue('stCxn', record.from)}${glue('endCxn', record.to)}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${record.xfrm}${record.geometry}<a:noFill/>${record.ln}</p:spPr></p:cxnSp>`;",
"    return connectorXml({ cNvPr, start: glued(record.from), end: glued(record.to), xfrm: record.xfrm, geometry: record.geometry, ln: record.ln });");
fs.writeFileSync('packages/pptx/src/connectors.js',c);
let d=fs.readFileSync('packages/pptx/src/diagram-shapes.js','utf8');
d=rep(d,"import { composeShape, presetMask, shapeSites } from '@openpresentation/opf/composition';","import { composeShape, presetMask, shapeSites } from '@openpresentation/opf/composition';\nimport { connectorXml } from './connectors.js';");
d=rep(d,"    const connection = ['stCxn', 'endCxn'].map((tag, index) => binding[index] ? `<a:${tag} id=\"${ID(binding[index].node.id)}\" idx=\"${binding[index].site.index}\"/>` : '').join('');\n    const spPr = `<p:spPr>${xfrm(frame, { flipH: x2 < x1, flipV: y2 < y1 })}<a:prstGeom prst=\"straightConnector1\"><a:avLst/></a:prstGeom><a:noFill/>${lineXml(main.line)}<a:effectLst/></p:spPr>`;\n    xml.push(`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id=\"${ID(nextId())}\" name=\"${xmlEscape(name)}\"/><p:cNvCxnSpPr>${connection}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>${spPr}</p:cxnSp>`);",
"    // SH-04's connector writer, so a glued diagram edge is the same p:cxnSp as an overlay connector (core's sites, the native ids).\n    const [start, end] = binding.map(bound => bound && { id: ID(bound.node.id), site: bound.site.index });\n    xml.push(connectorXml({ cNvPr: `<p:cNvPr id=\"${ID(nextId())}\" name=\"${xmlEscape(name)}\"/>`, start, end, xfrm: xfrm(frame, { flipH: x2 < x1, flipV: y2 < y1 }),\n      geometry: '<a:prstGeom prst=\"straightConnector1\"><a:avLst/></a:prstGeom>', ln: lineXml(main.line), effects: '<a:effectLst/>' }));");
fs.writeFileSync('packages/pptx/src/diagram-shapes.js',d);
