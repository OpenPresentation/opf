// RR-105 (opf#1293): theme font references. Design > Variants > Fonts (and applying another theme) restyles text only where a run names
// a theme font (`+mj-lt`, `+mn-lt`, ...): a run that names the family itself keeps it. The theme's font scheme already holds the deck's
// heading (major) and body (minor) families, so where a run's family is the one its slide's theme holds in that slot, the run names the
// slot instead. PowerPoint resolves the reference to the same family, so the text looks the same until the user picks other fonts.
//
// Parts: slides (runs, tables, paragraph and list defaults) and the SmartArt data and drawing parts they own; each takes its owner's
// theme. Chart parts keep their names: FF-08 writes the deck's body face into every chart text element explicitly, so a chart reads the
// same in any reader (and its embedded workbook, with its own Excel theme, matches it).
// The latin slot is compared with the theme's latin, ea with ea, cs with cs (a script slot only where the deck's script font is the
// theme's own). A family both slots hold is the heading's in a title or subtitle shape and the body's elsewhere. Other families, a
// bold face written under its style-link name (Roboto SemiBold) and empty slots keep their names. Layouts and masters already use
// references; notes text carries no typeface; an embedded workbook has its own Excel theme and keeps names.
const decoder = new TextDecoder(), encoder = new TextEncoder();
const unescapeXml = value => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"}[name]));
const SLOTS = {latin: 'lt', ea: 'ea', cs: 'cs'};

/** The theme's major and minor typefaces by slot: {mj: {lt, ea, cs}, mn: {...}}; an empty or missing slot is undefined. */
export function themeFontSlots(xml) {
  const result = {};
  for (const [key, tag] of [['mj', 'majorFont'], ['mn', 'minorFont']]) {
    const block = new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`).exec(xml)?.[1] ?? '';
    result[key] = {};
    for (const [element, slot] of Object.entries(SLOTS)) {
      const face = new RegExp(`<a:${element}\\b[^>]*?\\btypeface="([^"]*)"`).exec(block)?.[1];
      if (face) result[key][slot] = unescapeXml(face);
    }
  }
  return result;
}

/**
 * One part's text with theme references where a run's family is its theme's. `heading(context)` decides, for a family both slots hold,
 * whether the run is a heading's: the part's shapes are passed one at a time (the whole part when it has none).
 */
export function referenceThemeFonts(xml, fonts, {isHeading = () => false, keep = () => false} = {}) {
  if (!fonts || !xml.includes('typeface="')) return xml;
  const target = (element, face, heading) => {
    if (!face || face.startsWith('+')) return undefined;
    const family = unescapeXml(face), slot = SLOTS[element];
    const major = fonts.mj?.[slot] === family, minor = fonts.mn?.[slot] === family;
    if (!major && !minor) return undefined;
    return `+${major && minor ? (heading ? 'mj' : 'mn') : major ? 'mj' : 'mn'}-${slot}`;
  };
  const font = /<a:(latin|ea|cs)\b([^<>]*?)\btypeface="([^"]*)"([^<>]*?)\/>/g;
  // One run's properties at a time: where its latin and a script slot name one family on purpose (a Latin range of Arabic proofing names
  // its latin face in cs too), both are referenced or neither is, so the slots never part.
  const properties = (group, heading) => {
    const nodes = [...group.matchAll(font)].map(([node, element, , face]) => ({node, element, face, to: target(element, face, heading)}));
    const parted = new Set(nodes.filter(a => nodes.some(b => a.face === b.face && a.to !== b.to)).map(node => node.face));
    let next = group;
    // Only the typeface changes: the pitch family and character set the writer derived from the family stay with the reference.
    for (const {node, face, to} of nodes) if (to && !parted.has(face)) next = next.replace(node, node.replace(`typeface="${face}"`, `typeface="${to}"`));
    return next;
  };
  const rewrite = (part, heading) => part.replace(/<a:(rPr|defRPr|endParaRPr)\b[^>]*?(?:\/>|>[\s\S]*?<\/a:\1>)/g, group => properties(group, heading));
  // Shapes and graphic frames at any depth (a group's own shapes are reached one by one); a part without shapes is one context.
  if (!/<p:(?:sp|graphicFrame|cxnSp)>/.test(xml)) return rewrite(xml, false);
  return xml.replace(/<p:(sp|graphicFrame|cxnSp)>[\s\S]*?<\/p:\1>/g, node => keep(node) ? node : rewrite(node, isHeading(node)));
}

const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
const resolve = (from, target) => {
  const parts = from.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece && piece !== '.') parts.push(piece);
  }
  return parts.join('/');
};
const targets = (output, path, type) => {
  const rels = output[relsOf(path)];
  if (!rels) return [];
  return [...decoder.decode(rels[0]).matchAll(/<Relationship\b[^>]*>/g)].map(([node]) => node)
    .filter(node => new RegExp(`\\bType="[^"]*/${type}"`).test(node) && !/TargetMode="External"/.test(node))
    .map(node => resolve(path, /\bTarget="([^"]*)"/.exec(node)[1]));
};

const HEADING_SHAPE = /<p:cNvPr\b[^>]*\bname="OPF heading slides\.\d+\.(?:title|subtitle) line \d+"|<p:ph\b[^>]*\btype="(?:title|ctrTitle|subTitle)"/;

/**
 * The package pass: every slide part and the SmartArt data and drawing parts its relationships name, each with the theme of its slide's
 * master. `output` maps part paths to [bytes, zip options] and is rewritten in place. `owned` names the shapes whose runs the proofing and
 * fragment records fingerprint by their exact properties (script slots, source-bound fragments): their runs keep the family names, so
 * import still reads them as exported.
 */
export function writeThemeFontReferences(output, {owned = new Set()} = {}) {
  const keep = node => owned.has(unescapeXml(/<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(node)?.[1] ?? ''));
  const themes = new Map();
  const themeOf = slide => {
    const master = targets(output, targets(output, slide, 'slideLayout')[0] ?? '', 'slideMaster')[0];
    const theme = master && targets(output, master, 'theme')[0];
    if (!theme || !output[theme]) return undefined;
    if (!themes.has(theme)) themes.set(theme, themeFontSlots(decoder.decode(output[theme][0])));
    return themes.get(theme);
  };
  const write = (path, fonts, options) => {
    if (!output[path]) return;
    const xml = decoder.decode(output[path][0]), next = referenceThemeFonts(xml, fonts, options);
    if (next !== xml) output[path] = [encoder.encode(next), output[path][1]];
  };
  for (const slide of Object.keys(output).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const fonts = themeOf(slide);
    if (!fonts) continue;
    write(slide, fonts, {isHeading: node => HEADING_SHAPE.test(node), keep});
    for (const type of ['diagramData', 'diagramDrawing']) for (const part of targets(output, slide, type)) write(part, fonts);
  }
}
