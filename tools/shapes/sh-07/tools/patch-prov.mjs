import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/pptx/src/diagram-provenance.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`// \`invalid-diagram-provenance\`. Without the tag (\`references-only\`, \`provenance: false\`) the picture is an image.`,
`// \`invalid-diagram-provenance\`. Without the tag (\`references-only\`, \`provenance: false\`) the picture is an image.
//
// SH-07: a diagram written as shapes (\`diagrams: "shapes"\`) is one p:grpSp \`OPF diagram N\` whose OPF_DIAGRAM_V1 manifest has
// \`shapes: true\` and the group's signature (diagramGroupSignature: the name, frame and text of every member). An unchanged group imports
// as its diagram again, its description as the alt text; an edited one (a member moved, resized, renamed, added, removed or retyped)
// imports as its shapes and reports \`invalid-diagram-provenance\`.`);
rep(`    for (const [shape, kind] of xml.matchAll(/<p:(sp|pic)>[\\s\\S]*?<\\/p:\\1>/g)) {
      const name = /<p:cNvPr\\b[^>]*\\bname="([^"]+)"/.exec(shape)?.[1];
      const record = records.get(name);
      if (!record) continue;
      if (kind === 'sp') { manifests.set(name, {...record, placeholder: true}); continue; }`,
`    for (const [shape, kind] of xml.matchAll(/<p:(grpSp|sp|pic)>[\\s\\S]*?<\\/p:\\1>/g)) {
      const name = /<p:cNvPr\\b[^>]*\\bname="([^"]+)"/.exec(shape)?.[1];
      const record = records.get(name);
      if (!record) continue;
      if (kind === 'grpSp') {
        if (!record.shapes) throw new Error('A generated diagram group has no shapes record.');
        manifests.set(name, {...record, signature: diagramGroupSignature(parser.parse(shape)['p:grpSp'])});
        continue;
      }
      if (record.shapes) continue;
      if (kind === 'sp') { manifests.set(name, {...record, placeholder: true}); continue; }`);
rep(`  attachTextTags(entries, manifests, DIAGRAM_TAG, 'opfDiagram', 'diagram', {pictures: true});
}`, `  attachTextTags(entries, manifests, DIAGRAM_TAG, 'opfDiagram', 'diagram', {pictures: true, groups: true});
}

// The text of a parsed DrawingML text body (every a:t, paragraphs joined by line breaks).
const bodyText = body => array(body?.['a:p']).map(paragraph => [...array(paragraph?.['a:r']), ...array(paragraph?.['a:fld'])].map(run => {
  const value = run?.['a:t'];
  return typeof value === 'object' && value !== null ? scalar(value['#text']) : scalar(value);
}).join('')).join('\\n');
const frameOf = properties => {
  const xfrm = properties?.['a:xfrm'];
  return [xfrm?.['a:off']?.x, xfrm?.['a:off']?.y, xfrm?.['a:ext']?.cx, xfrm?.['a:ext']?.cy, xfrm?.rot ?? 0, xfrm?.flipH ?? 0, xfrm?.flipV ?? 0].map(scalar).join(',');
};

/**
 * SH-07: the signature of a diagram group (a parsed p:grpSp): its frame and, for every member in any order, its kind, name, frame and
 * text. It changes when a member is moved, resized, rotated, renamed, added, removed or retyped, and not when PowerPoint saves the file.
 */
export function diagramGroupSignature(group) {
  const members = [];
  for (const [kind, nv, properties] of [['p:sp', 'p:nvSpPr', 'p:spPr'], ['p:cxnSp', 'p:nvCxnSpPr', 'p:spPr'], ['p:pic', 'p:nvPicPr', 'p:spPr'], ['p:grpSp', 'p:nvGrpSpPr', 'p:grpSpPr'], ['p:graphicFrame', 'p:nvGraphicFramePr', 'p:xfrm']]) {
    for (const member of array(group?.[kind])) {
      const frame = kind === 'p:graphicFrame' ? frameOf({'a:xfrm': member?.['p:xfrm']}) : frameOf(member?.[properties]);
      members.push([kind, scalar(member?.[nv]?.['p:cNvPr']?.name), frame, bodyText(member?.['p:txBody'])].join('|'));
    }
  }
  const text = [frameOf(group?.['p:grpSpPr']), ...members.sort()].join('\\n');
  // FNV-1a in two lanes: a compact key for change detection, not a security measure.
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return \`\${members.length}:\${a.toString(16).padStart(8, '0')}\${b.toString(16).padStart(8, '0')}\`;
}`);
rep(`export function importDiagrams({pictures, shapes, paragraphs, relationships, entries, slideIndex, valid, report}) {
  const slide = \`slides.\${slideIndex}\`;
  const found = {pictures: new Map(), shapes: new Map()};
  const invalid = message => report({code: 'invalid-diagram-provenance', path: slide, message});
  const check = manifest => manifest?.v === 1 && manifest.slide === slide && typeof manifest.path === 'string' && BLOCK_PATH.test(manifest.path)
    && manifest.path.startsWith(\`\${slide}.\`) && authoredValue(manifest.diagram) && typeof manifest.alt === 'string';`,
`const manifestFor = slide => manifest => manifest?.v === 1 && manifest.slide === slide && typeof manifest.path === 'string' && BLOCK_PATH.test(manifest.path)
  && manifest.path.startsWith(\`\${slide}.\`) && authoredValue(manifest.diagram) && typeof manifest.alt === 'string';

/**
 * SH-07: recover the diagram blocks of one slide written as shapes: its top-level groups (\`groups\`, parsed p:grpSp) that carry an
 * intact OPF_DIAGRAM_V1 group manifest. Returns [{group, payload}]; an edited or invalid tagged group is left to import as its shapes.
 */
export function importDiagramGroups({groups, relationships, entries, slideIndex, valid, report}) {
  const slide = \`slides.\${slideIndex}\`, check = manifestFor(slide), found = [];
  const invalid = message => report({code: 'invalid-diagram-provenance', path: slide, message});
  for (const group of groups) {
    let manifest;
    try { manifest = ownTag(group?.['p:nvGrpSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries); }
    catch { invalid('A tagged OPF diagram group is ambiguous; it was imported as its shapes.'); continue; }
    if (manifest === null) continue;
    const properties = group?.['p:nvGrpSpPr']?.['p:cNvPr'];
    if (!check(manifest) || manifest.shapes !== true || !PICTURE_NAME.test(scalar(properties?.name)) || diagramGroupSignature(group) !== manifest.signature) {
      invalid('An edited or invalid tagged OPF diagram group was imported as its shapes; its diagram source is not reconstructed.');
      continue;
    }
    const payload = {type: 'diagram', diagram: withAlt(manifest.diagram, manifest.alt, scalar(properties?.descr))};
    if (!valid(payload)) { invalid('A tagged OPF diagram group does not form a valid diagram block; it was imported as its shapes.'); continue; }
    found.push({group, payload});
  }
  return found;
}

export function importDiagrams({pictures, shapes, paragraphs, relationships, entries, slideIndex, valid, report}) {
  const slide = \`slides.\${slideIndex}\`;
  const found = {pictures: new Map(), shapes: new Map()};
  const invalid = message => report({code: 'invalid-diagram-provenance', path: slide, message});
  const check = manifestFor(slide);`);
fs.writeFileSync(f, s);
console.log('ok');
