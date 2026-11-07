import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/pptx/src/index.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`import { DIAGRAM_UNAVAILABLE, diagramName, diagramPlaceholderName, importDiagrams, tagDiagrams } from './diagram-provenance.js';`,
`import { DIAGRAM_UNAVAILABLE, diagramName, diagramPlaceholderName, importDiagramGroups, importDiagrams, tagDiagrams } from './diagram-provenance.js';`);
rep(`  if (asArray(tree?.['p:grpSp']).some(group => !isImagePlaceholderGroup(group))) options.onDiagnostic?.(`,
`  // SH-07: a diagram written as shapes is one group named for the diagram; when its tag is intact it is the diagram again (below).
  if (asArray(tree?.['p:grpSp']).some(group => !isImagePlaceholderGroup(group) && !/^OPF diagram \d+$/.test(String(group?.['p:nvGrpSpPr']?.['p:cNvPr']?.name ?? '')))) options.onDiagnostic?.(`);
rep(`  for (const [index, payload] of diagrams.shapes) {
    items.push({kind: 'diagram', bounds: shapeBounds(shapes[index]['p:spPr']?.['a:xfrm']), payload, sources: [\`sp:\${index}\`]});
  }`, `  for (const [index, payload] of diagrams.shapes) {
    items.push({kind: 'diagram', bounds: shapeBounds(shapes[index]['p:spPr']?.['a:xfrm']), payload, sources: [\`sp:\${index}\`]});
  }
  // SH-07: an intact diagram group (diagrams: "shapes") is its diagram block again; its member shapes are its drawing, not content.
  const diagramMembers = new Set();
  for (const {group, payload} of importDiagramGroups({groups: asArray(tree?.['p:grpSp']), relationships, entries, slideIndex,
    valid: candidate => isValidFormat({slides: [{blocks: [candidate]}]}), report: diagnostic => options.onDiagnostic?.(diagnostic)})) {
    const members = nativeTextShapes(group);
    for (const member of members) { diagramMembers.add(member); roles.set(shapeKeys.get(member), 'diagram'); }
    items.push({kind: 'diagram', bounds: shapeBounds(group['p:grpSpPr']?.['a:xfrm']), payload, sources: sourcesOf(members)});
  }`);
rep(`|| placeholders.consumed.has(index) || diagrams.shapes.has(index)) continue;`, `|| placeholders.consumed.has(index) || diagrams.shapes.has(index) || diagramMembers.has(shape)) continue;`);
fs.writeFileSync(f, s);
console.log('ok');
