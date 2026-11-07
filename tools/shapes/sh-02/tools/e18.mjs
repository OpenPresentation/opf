const P = 'packages/pptx/src/index.js';
const B = 'packages/pptx/src/shape-blocks.js';
export default [
  [P, `  // Image pictures need the embedded dimensions (core's fitImage crops and pads them); document provenance (FF-32)
  // later records the placed frames as slide geometry evidence.
  try {
    placeImages(entries, context.images, context.imageOverlays, {`, `  // SH-02: a shape block's click link (a:hlinkClick in its p:cNvPr, with its slide's external hyperlink relationship).
  linkShapeBlocks(entries, context.shapeBlocks, {decode: decodeText, encode: encodeText});
  // Image pictures need the embedded dimensions (core's fitImage crops and pads them); document provenance (FF-32)
  // later records the placed frames as slide geometry evidence.
  try {
    placeImages(entries, context.images, context.imageOverlays, {`],
  [P, `import {lineXml, shapeBlockRecord, writeShapeBlocks} from './shape-blocks.js';`, `import {lineXml, linkShapeBlocks, shapeBlockRecord, writeShapeBlocks} from './shape-blocks.js';`],
  [P, `    ...(lineHeight ? {lineSpacing: Math.round(lineHeight * 100) / 100} : {}), fit: 'none', ...(shape.link ? {hyperlink: {url: shape.link}} : {})});
  deck.shapeBlocks.set(name, shapeBlockRecord(shape, paint, palette));`, `    ...(lineHeight ? {lineSpacing: Math.round(lineHeight * 100) / 100} : {}), fit: 'none'});
  deck.shapeBlocks.set(name, {...shapeBlockRecord(shape, paint, palette), ...(shape.link ? {link: shape.link} : {})});`],
  [B, `/** Replace the parts PptxGenJS wrote for every recorded shape block`, `const HYPERLINK = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
/**
 * Give every recorded shape block with a \`link\` its click link: an external hyperlink relationship in its slide's rels part and
 * a:hlinkClick in its p:cNvPr (PptxGenJS links a text shape's runs, not the shape). \`entries\` is the package (part name to bytes).
 */
export function linkShapeBlocks(entries, records, {decode, encode}) {
  const linked = [...(records?.entries() ?? [])].filter(([, record]) => record.link);
  if (!linked.length) return;
  const byName = new Map(linked);
  for (const part of Object.keys(entries).filter(path => /^ppt\\/slides\\/slide\\d+\\.xml$/.test(path))) {
    let xml = decode(entries[part]);
    if (!linked.some(([name]) => xml.includes(\`name="\${escape(name)}"\`))) continue;
    const relsPath = part.replace(/^ppt\\/slides\\//, 'ppt/slides/_rels/') + '.rels';
    let rels = entries[relsPath] ? decode(entries[relsPath]) : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const taken = new Set([...rels.matchAll(/\\bId="([^"]+)"/g)].map(match => match[1]));
    xml = xml.replace(/<p:cNvPr\\b([^>]*?\\bname="([^"]+)"[^>]*?)(\\/?)>/g, (match, attributes, name, close) => {
      const record = byName.get(name.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
      if (!record) return match;
      let n = 1, rid;
      do rid = \`rId\${n++}\`; while (taken.has(rid));
      taken.add(rid);
      rels = rels.replace('</Relationships>', \`<Relationship Id="\${rid}" Type="\${HYPERLINK}" Target="\${escape(record.link)}" TargetMode="External"/></Relationships>\`);
      const link = \`<a:hlinkClick r:id="\${rid}"/>\`;
      return close ? \`<p:cNvPr\${attributes}>\${link}</p:cNvPr>\` : \`<p:cNvPr\${attributes}>\${link}\`;
    });
    entries[part] = encode(xml);
    entries[relsPath] = encode(rels);
  }
}

/** Replace the parts PptxGenJS wrote for every recorded shape block`],
];
