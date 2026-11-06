// SH-09: core's pyramids and matrices (SlideComposition.arrangements, core arrangements.ts) in the PPTX export and import.
//
// Export takes the first that fits (owner, 2026-11-06):
//
//   1. live SmartArt (`smartArt: "live"`, the default): a p:graphicFrame of PowerPoint's Basic Pyramid (pyramid1) or Basic Matrix
//      (matrix3) layout, where core's geometry is PowerPoint's own and the instance lies in the domain the PowerPoint comparison passed
//      (core smartArtUnavailable). PowerPoint lays a SmartArt out again from its data model on open, so the file carries what decides
//      that layout and nothing else of Microsoft's:
//        - the data model (ppt/diagrams/dataN.xml): the `doc` point naming the layout (loTypeId) and OPF's own quick style and colors
//          (qsTypeId, csTypeId), one point per entry with `custT="1"` (PowerPoint keeps the run size and sets the text margins from
//          it, instead of fitting the text again), runs with an explicit size (core's), typeface and language, the paragraph centered
//          at core's line pitch with no space before or after, and one `cxn` per entry from the doc point in entry order;
//        - OPF's colors and quick style parts (colorsN.xml, quickStyleN.xml), whose style labels cover every label the two layouts
//          use (node0, node1, bgShp, revTx and the transition labels), in the deck's theme colors: the nodes in accent1 outlined in bg1
//          (the theme's third line style, 1.5 pt), their text in core's readable color, the matrix's diamond accent1 lightened 80%;
//        - a drawing part (drawingN.xml) built from core's geometry, for readers that draw the cached shapes;
//        - no layout part: `r:lo` is empty, so PowerPoint resolves its built-in layout from loTypeId (docs/smartart.md records why
//          this is the most valid of the three forms the SH-09 spike found PowerPoint accepts). OPF never writes a layout definition.
//   2. native shapes (`smartArt: "shapes"`, or an instance outside the domain, reported as the info finding pptx/smartart-unavailable
//      with the reason): the diamond and nodes as presets (diamond, trapezoid with core's adjustment, roundRect) at core's boxes, under
//      the list's measured lines, centered on their nodes. Each shape is tagged OPF_ARRANGEMENT_V1 and import consumes it (the layout's
//      drawing, not content); the lines import as the list.
//
// In `full` provenance the SmartArt frame carries OPF_SMARTART_V1: the slide, the list path, the arrangement, the authored list and the
// text of every node as written. On import an unchanged tagged SmartArt is that list again; an edited one (a node's text changed, a
// node added or removed) imports its data model's nodes, as any PowerPoint pyramid1 or matrix3 does: the points in `cxn` order, their
// text and run properties, as a list in the `pyramid` or `matrix` layout. Import never stores a layout part.
import {SMART_ART_LAYOUTS, arrangementPaint, applyColorTransform, bindNoBreak, colorContrast, smartArtUnavailable} from '@openpresentation/opf/composition';
import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';

export const SMART_ART_TAG = 'OPF_SMARTART_V1', ARRANGEMENT_TAG = 'OPF_ARRANGEMENT_V1';
export const SMART_ART_URI = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
export const smartArtName = path => `OPF smartart ${path}`;
const NS = Object.freeze({
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  dgm: SMART_ART_URI,
  dsp: 'http://schemas.microsoft.com/office/drawing/2008/diagram',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
});
export const SMART_ART_RELATIONSHIPS = Object.freeze({
  data: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData',
  layout: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout',
  quickStyle: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramQuickStyle',
  colors: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramColors',
  drawing: 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing',
});
const CONTENT_TYPES = Object.freeze({
  data: 'application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml',
  quickStyle: 'application/vnd.openxmlformats-officedocument.drawingml.diagramStyle+xml',
  colors: 'application/vnd.openxmlformats-officedocument.drawingml.diagramColors+xml',
  drawing: 'application/vnd.ms-office.drawingml.diagramDrawing+xml',
});
/** OPF's own quick style and colors definitions (uniqueId): not Microsoft's, whose content differs. */
export const OPF_QUICK_STYLE = 'urn:openpresentation.org/opf/smartart/quickstyle/flat';
export const OPF_COLORS = 'urn:openpresentation.org/opf/smartart/colors/primary';
const LAYOUT_CATEGORY = Object.freeze({pyramid: 'pyramid', matrix: 'matrix'});
const KIND_OF_LAYOUT = new Map(Object.entries(SMART_ART_LAYOUTS).map(([kind, id]) => [id, kind]));
const EMU = 9525; // per canvas pixel (1/96 inch)
const emu = value => Math.round(value * EMU);
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));
const decoder = new TextDecoder(), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const RTL = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
// The script the PowerPoint comparison passed: Latin (with the common punctuation, digits and marks).
const COVERED = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;
// The run properties a SmartArt node carries as written (others, such as links, citations, code or a run size, keep the shapes).
const RUN_KEYS = new Set(['text', 'bold', 'italic', 'underline', 'strikethrough', 'lang']);

const runsOf = value => {
  const text = value && typeof value === 'object' && !Array.isArray(value) ? value.text : value;
  return typeof text === 'string' ? [{text}] : Array.isArray(text) ? text.map(run => typeof run === 'string' ? {text: run} : run) : [];
};
const plain = value => runsOf(value).map(run => run?.text ?? '').join('');

/**
 * Whether an arrangement can be live SmartArt: undefined when it can, else the reason (pptx/smartart-unavailable). `values` are the
 * list's entries as authored.
 */
export function smartArtReason(arrangement, values, rtl) {
  if (values.some(value => runsOf(value).some(run => !run || typeof run.text !== 'string' || Object.keys(run).some(key => !RUN_KEYS.has(key)))))
    return 'an entry has text formatting a SmartArt node does not carry (a link, a citation, code or its own size)';
  if (values.some(value => /[\r\n\t]/.test(plain(value)))) return 'an entry holds a line break or a tab';
  const text = values.map(plain).join('');
  const script = COVERED.test(text) ? undefined : CJK.test(text) ? 'cjk' : 'other';
  return smartArtUnavailable({kind: arrangement.kind, count: values.length, frame: arrangement.frame, rtl: rtl || RTL.test(text),
    nodes: arrangement.smartArt.lines.map((lines, index) => ({lines, stable: arrangement.smartArt.stable[index]})), ...(script ? {script} : {})});
}

/** The paint of the slide's arrangements (core arrangementPaint) from the slide's export context. */
export function exportPaint(context) {
  const hex = value => `#${String(value).replace(/^#/, '').slice(0, 6).toUpperCase()}`;
  const roles = context.roles;
  return arrangementPaint(hex(context.colors.accent), hex(roles?.background ?? context.colors.background), hex(roles?.text ?? context.colors.text), colorContrast, applyColorTransform);
}

/**
 * Draw a slide's arrangements (core `geometry.arrangements`) before its content. Returns the paths of the lists written as live
 * SmartArt (their lines are not drawn) and the text color and alignment of the others' lines. `records` collects each SmartArt frame
 * (attachSmartArt), `tags` each native shape's OPF_ARRANGEMENT_V1 record and `smartArtTags` each frame's OPF_SMARTART_V1 record.
 */
export function addArrangements(slide, arrangements, {context, mode = 'live', items, slideIndex, records, tags, smartArtTags, provenance, report, fontOf}) {
  const live = new Set();
  if (!arrangements?.length) return live;
  const paint = exportPaint(context), inches = value => value / 96, box = area => ({x: inches(area.x), y: inches(area.y), w: inches(area.width), h: inches(area.height)});
  for (const arrangement of arrangements) {
    const item = items.find(entry => entry.path === arrangement.path), values = Array.isArray(item?.value) ? item.value : [];
    const reason = mode === 'live' ? smartArtReason(arrangement, values, context.direction === 'rtl') : undefined;
    if (mode === 'live' && reason === undefined) {
      const objectName = smartArtName(arrangement.path);
      // A placeholder at the frame: attachSmartArt makes it the SmartArt frame once the package is written.
      slide.addShape('rect', {...box(arrangement.frame), fill: {color: paint.fill.hex.slice(1)}, line: {type: 'none'}, objectName});
      records.set(objectName, {arrangement, values, item, paint, lang: context.deckLang ?? 'en-US', fontOf, rtl: context.direction === 'rtl'});
      if (provenance === 'full') smartArtTags.set(objectName, {v: 1, slide: slideIndex, path: arrangement.path, region: arrangement.region, kind: arrangement.kind, items: structuredClone(values), texts: values.map(plain)});
      live.add(arrangement.path);
      continue;
    }
    if (mode === 'live') report?.({code: 'smartart-unavailable', path: arrangement.path, reason,
      message: `The ${arrangement.kind} is exported as native shapes, not live SmartArt: ${reason}.`});
    const name = role => `OPF arrangement ${arrangement.path} ${role}`, tag = (objectName, role, extra = {}) => tags.set(objectName, {v: 1, path: arrangement.path, kind: arrangement.kind, role, ...extra});
    const line = {color: paint.line.hex.slice(1), width: arrangement.lineWidth * .75};
    if (arrangement.background) {
      const objectName = name('background');
      slide.addShape('diamond', {...box(arrangement.background), fill: {color: paint.background.hex.slice(1)}, line: {type: 'none'}, objectName});
      tag(objectName, 'background');
    }
    for (const node of arrangement.nodes) {
      const objectName = name(`node ${node.index}`);
      slide.addShape(node.preset === 'trapezoid' ? 'trapezoid' : 'roundRect', {...box(node.box), fill: {color: paint.fill.hex.slice(1)}, line, objectName,
        ...(node.preset === 'roundRect' ? {rectRadius: inches(node.radius ?? 0)} : {})});
      tag(objectName, 'node', {index: node.index, adjust: node.adjust, preset: node.preset, ...(node.path ? {entry: node.path} : {})});
    }
  }
  return live;
}

/** A trapezoid's adjustment (pptxgenjs writes the preset's default): core's `adj`, by object name, in the finished slide parts. */
export function writeArrangementAdjustments(entries, tags) {
  if (!tags.size) return;
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const xml = decoder.decode(entries[part]);
    const next = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      const record = tags.get(shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1]);
      if (record?.role !== 'node' || record.preset !== 'trapezoid') return shape;
      return shape.replace(/<a:prstGeom prst="trapezoid">\s*(?:<a:avLst\s*\/>|<a:avLst>[\s\S]*?<\/a:avLst>)\s*<\/a:prstGeom>/, `<a:prstGeom prst="trapezoid"><a:avLst><a:gd name="adj" fmla="val ${record.adjust}"/></a:avLst></a:prstGeom>`);
    });
    if (next !== xml) entries[part] = encoder.encode(next);
  }
}

/** Tag the native arrangement shapes (OPF_ARRANGEMENT_V1) and the SmartArt placeholders (OPF_SMARTART_V1, full provenance). */
export function attachArrangementTags(entries, tags, smartArtTags) {
  attachTextTags(entries, tags, ARRANGEMENT_TAG, 'opfArrangement', 'arrangement');
  attachTextTags(entries, smartArtTags, SMART_ART_TAG, 'opfSmartArt', 'SmartArt');
}

// Deterministic model ids (GUIDs): the SmartArt's number, the point's role and its index.
const modelId = (number, role, index = 0) => `{${String(number).padStart(8, '0')}-${String(role).padStart(4, '0')}-4${String(index).padStart(3, '0')}-8000-000000000000}`;
const ROLE = Object.freeze({doc: 1, node: 2, parent: 3, sibling: 4, connection: 5, shape: 6});
const srgb = '<a:scrgbClr r="0" g="0" b="0"/>';
const schemeXml = color => color.lumMod !== undefined ? `<a:schemeClr val="${color.slot}"><a:lumMod val="${color.lumMod}"/><a:lumOff val="${color.lumOff}"/></a:schemeClr>` : `<a:schemeClr val="${color.slot}"/>`;

/** The `a:pPr` and `a:r` elements of one node: core's size, the entry's runs with their typeface, weight, slant and language. */
function nodeParagraph(record, index) {
  const {arrangement, values, lang, fontOf, rtl} = record, column = record.item?.listColumns?.[index] ?? (index === 0 ? {text: record.item?.text} : undefined);
  const entry = column?.text?.listEntries?.[0], size = Math.round(arrangement.fontSize * 75), pitch = Math.round((entry?.text?.lineHeight ?? arrangement.fontSize * 1.2) * 75);
  const fragments = entry?.text?.richLines?.flatMap(line => line.fragments) ?? [];
  const runs = runsOf(values[index]).map((run, runIndex) => {
    const style = fragments.find(fragment => fragment.runIndex === runIndex)?.style ?? entry?.marker?.style;
    const font = style ? fontOf(style) : {};
    const bold = run.bold ?? font.bold, italic = run.italic ?? font.italic;
    // The Latin face only: East Asian and complex-script text takes the theme's script fonts, as the exporter's text boxes do (FF-07).
    const face = font.fontFace ? `<a:latin typeface="${escapeXml(font.fontFace)}"/>` : '';
    // LH-11: the spaces core's line breaker never breaks at are no-break spaces, as the native body writes them.
    const text = bindNoBreak(run.text);
    return `<a:r><a:rPr lang="${escapeXml(run.lang ?? lang)}" sz="${size}"${bold ? ' b="1"' : ''}${italic ? ' i="1"' : ''}${run.underline ? ' u="sng"' : ''}${run.strikethrough ? ' strike="sngStrike"' : ''} dirty="0">${face}</a:rPr><a:t>${escapeXml(text)}</a:t></a:r>`;
  }).join('');
  const paragraphRtl = rtl || RTL.test(plain(values[index]));
  return `<a:pPr algn="ctr"${paragraphRtl ? ' rtl="1"' : ''}><a:lnSpc><a:spcPts val="${pitch}"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>${runs}`;
}

/** The data model of one SmartArt: the doc point, one point per entry and the connections in entry order. */
export function smartArtDataXml(record, number, drawingRelId) {
  const {arrangement, values} = record, doc = modelId(number, ROLE.doc);
  const points = [`<dgm:pt modelId="${doc}" type="doc"><dgm:prSet loTypeId="${SMART_ART_LAYOUTS[arrangement.kind]}" loCatId="${LAYOUT_CATEGORY[arrangement.kind]}" qsTypeId="${OPF_QUICK_STYLE}" qsCatId="simple" csTypeId="${OPF_COLORS}" csCatId="accent1"/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${escapeXml(record.lang)}"/></a:p></dgm:t></dgm:pt>`];
  const connections = [];
  values.forEach((_, index) => {
    const id = modelId(number, ROLE.node, index), parent = modelId(number, ROLE.parent, index), sibling = modelId(number, ROLE.sibling, index), cxn = modelId(number, ROLE.connection, index);
    points.push(`<dgm:pt modelId="${id}"><dgm:prSet custT="1"/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p>${nodeParagraph(record, index)}</a:p></dgm:t></dgm:pt>`,
      `<dgm:pt modelId="${parent}" type="parTrans" cxnId="${cxn}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${escapeXml(record.lang)}"/></a:p></dgm:t></dgm:pt>`,
      `<dgm:pt modelId="${sibling}" type="sibTrans" cxnId="${cxn}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${escapeXml(record.lang)}"/></a:p></dgm:t></dgm:pt>`);
    connections.push(`<dgm:cxn modelId="${cxn}" srcId="${doc}" destId="${id}" srcOrd="${index}" destOrd="0" parTransId="${parent}" sibTransId="${sibling}"/>`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:dataModel xmlns:dgm="${NS.dgm}" xmlns:a="${NS.a}"><dgm:ptLst>${points.join('')}</dgm:ptLst><dgm:cxnLst>${connections.join('')}</dgm:cxnLst><dgm:bg/><dgm:whole/><dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram"><dsp:dataModelExt xmlns:dsp="${NS.dsp}" relId="${drawingRelId}" minVer="http://schemas.openxmlformats.org/drawingml/2006/diagram"/></a:ext></dgm:extLst></dgm:dataModel>`;
}

// The style labels pyramid1 and matrix3 use (node1, revTx, bgShp), the first node's (node0) and the transition labels, so no shape
// takes PowerPoint's black default for a label the part leaves out.
const LABELS = ['node0', 'node1', 'bgShp', 'revTx', 'sibTrans2D1', 'parChTrans1D1', 'trBgShp'];

/** OPF's colors definition in the deck's theme: arrangementPaint's slots. */
export function smartArtColorsXml(paint) {
  const none = '<a:schemeClr val="bg1"><a:alpha val="0"/></a:schemeClr>';
  const list = (name, fill, line, text) => `<dgm:styleLbl name="${name}"><dgm:fillClrLst meth="repeat">${fill}</dgm:fillClrLst><dgm:linClrLst meth="repeat">${line}</dgm:linClrLst><dgm:effectClrLst/><dgm:txLinClrLst/><dgm:txFillClrLst meth="repeat">${text}</dgm:txFillClrLst><dgm:txEffectClrLst/></dgm:styleLbl>`;
  const labels = LABELS.map(name => name === 'bgShp' || name === 'trBgShp' ? list(name, schemeXml(paint.background), schemeXml(paint.line), schemeXml(paint.text))
    : name === 'revTx' ? list(name, none, none, '<a:schemeClr val="tx1"/>')
      : list(name, schemeXml(paint.fill), schemeXml(paint.line), schemeXml(paint.text)));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:colorsDef xmlns:dgm="${NS.dgm}" xmlns:a="${NS.a}" uniqueId="${OPF_COLORS}"><dgm:title val="OPF primary"/><dgm:desc val="OPF: the nodes in the primary color, outlined in the background"/><dgm:catLst><dgm:cat type="accent1" pri="11000"/></dgm:catLst>${labels.join('')}</dgm:colorsDef>`;
}

/** OPF's quick style: flat (no effects, no 3-D), a node's line the theme's third line style (1.5 pt), the diamond without a line. */
export function smartArtQuickStyleXml() {
  const scene = '<dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d><dgm:sp3d/><dgm:txPr/>';
  const style = (line, fill) => `<dgm:style><a:lnRef idx="${line}">${srgb}</a:lnRef><a:fillRef idx="${fill}">${srgb}</a:fillRef><a:effectRef idx="0">${srgb}</a:effectRef><a:fontRef idx="minor"/></dgm:style>`;
  const labels = LABELS.map(name => `<dgm:styleLbl name="${name}">${scene}${name === 'bgShp' || name === 'trBgShp' ? style(0, 1) : name === 'revTx' ? style(0, 0) : style(3, 1)}</dgm:styleLbl>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:styleDef xmlns:dgm="${NS.dgm}" xmlns:a="${NS.a}" uniqueId="${OPF_QUICK_STYLE}"><dgm:title val="OPF flat"/><dgm:desc val="OPF: flat nodes with a 1.5 pt outline"/><dgm:catLst><dgm:cat type="simple" pri="10100"/></dgm:catLst><dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d>${labels.join('')}</dgm:styleDef>`;
}

/** The cached drawing from core's geometry, relative to the frame (EMU). */
export function smartArtDrawingXml(record, number) {
  const {arrangement, paint} = record, origin = arrangement.frame, margin = emu(arrangement.textMargin);
  const xfrm = (box, tag = 'a:xfrm') => `<${tag}><a:off x="${emu(box.x - origin.x)}" y="${emu(box.y - origin.y)}"/><a:ext cx="${emu(box.width)}" cy="${emu(box.height)}"/></${tag}>`;
  const shapes = [];
  if (arrangement.background) shapes.push(`<dsp:sp modelId="${modelId(number, ROLE.shape, 99)}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr>${xfrm(arrangement.background)}<a:prstGeom prst="diamond"><a:avLst/></a:prstGeom><a:solidFill>${schemeXml(paint.background)}</a:solidFill><a:ln><a:noFill/></a:ln></dsp:spPr><dsp:style><a:lnRef idx="0">${srgb}</a:lnRef><a:fillRef idx="1">${srgb}</a:fillRef><a:effectRef idx="0">${srgb}</a:effectRef><a:fontRef idx="minor"/></dsp:style></dsp:sp>`);
  for (const node of arrangement.nodes) {
    const index = node.index, text = node.path !== undefined ? nodeParagraph(record, index) : '';
    const geometry = node.preset === 'trapezoid' ? `<a:prstGeom prst="trapezoid"><a:avLst><a:gd name="adj" fmla="val ${node.adjust}"/></a:avLst></a:prstGeom>` : '<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>';
    shapes.push(`<dsp:sp modelId="${modelId(number, ROLE.shape, index)}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr>${xfrm(node.box)}${geometry}<a:solidFill>${schemeXml(paint.fill)}</a:solidFill><a:ln w="${emu(arrangement.lineWidth)}"><a:solidFill>${schemeXml(paint.line)}</a:solidFill></a:ln></dsp:spPr><dsp:style><a:lnRef idx="3">${srgb}</a:lnRef><a:fillRef idx="1">${srgb}</a:fillRef><a:effectRef idx="0">${srgb}</a:effectRef><a:fontRef idx="minor">${schemeXml(paint.text)}</a:fontRef></dsp:style><dsp:txBody><a:bodyPr wrap="square" lIns="${margin}" tIns="${margin}" rIns="${margin}" bIns="${margin}" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p>${text || `<a:endParaRPr lang="${escapeXml(record.lang)}"/>`}</a:p></dsp:txBody>${xfrm(node.textBox, 'dsp:txXfrm')}</dsp:sp>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dsp:drawing xmlns:dgm="${NS.dgm}" xmlns:dsp="${NS.dsp}" xmlns:a="${NS.a}"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>${shapes.join('')}</dsp:spTree></dsp:drawing>`;
}

/**
 * Replace every SmartArt placeholder (addArrangements `records`, by object name) with its p:graphicFrame and add its parts, in slide
 * order. Runs on the unzipped package after the placeholders are tagged (their p:nvPr, with the tag, moves to the frame).
 */
export function attachSmartArt(entries, records) {
  if (!records.size) return;
  const slides = Object.keys(entries).filter(part => /^ppt\/slides\/slide\d+\.xml$/.test(part)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  const overrides = [];
  let number = 0, seen = 0;
  for (const part of slides) {
    const relsPart = part.replace(/([^/]+)$/, '_rels/$1.rels');
    let rels = decoder.decode(entries[relsPart]), changed = false;
    let nextId = Math.max(0, ...[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match => Number(match[1]))) + 1;
    const xml = decoder.decode(entries[part]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1], record = records.get(name);
      if (!record) return shape;
      seen += 1; number += 1; changed = true;
      const ids = {data: `rId${nextId++}`, quickStyle: `rId${nextId++}`, colors: `rId${nextId++}`, drawing: `rId${nextId++}`};
      entries[`ppt/diagrams/data${number}.xml`] = encoder.encode(smartArtDataXml(record, number, ids.drawing));
      entries[`ppt/diagrams/quickStyle${number}.xml`] = encoder.encode(smartArtQuickStyleXml());
      entries[`ppt/diagrams/colors${number}.xml`] = encoder.encode(smartArtColorsXml(record.paint));
      entries[`ppt/diagrams/drawing${number}.xml`] = encoder.encode(smartArtDrawingXml(record, number));
      for (const kind of ['data', 'quickStyle', 'colors', 'drawing']) {
        overrides.push(`<Override PartName="/ppt/diagrams/${kind}${number}.xml" ContentType="${CONTENT_TYPES[kind]}"/>`);
        rels = rels.replace('</Relationships>', `<Relationship Id="${ids[kind]}" Type="${SMART_ART_RELATIONSHIPS[kind]}" Target="../diagrams/${kind}${number}.xml"/></Relationships>`);
      }
      const cNvPr = shape.match(/<p:cNvPr\b[^>]*?(?:\/>|>[\s\S]*?<\/p:cNvPr>)/)?.[0] ?? `<p:cNvPr id="${1000 + number}" name="${escapeXml(name)}"/>`;
      const nvPr = shape.match(/<p:nvPr\s*\/>|<p:nvPr>[\s\S]*?<\/p:nvPr>/)?.[0] ?? '<p:nvPr/>';
      const {frame} = record.arrangement, alt = record.values.map(plain).join(', ');
      const named = cNvPr.includes(' descr=') ? cNvPr : cNvPr.replace(/<p:cNvPr\b/, `<p:cNvPr descr="${escapeXml(alt)}"`);
      // `r:lo` is empty: no layout part, so PowerPoint resolves its built-in layout from the data model's loTypeId (docs/smartart.md).
      return `<p:graphicFrame><p:nvGraphicFramePr>${named}<p:cNvGraphicFramePr/>${nvPr}</p:nvGraphicFramePr><p:xfrm><a:off x="${emu(frame.x)}" y="${emu(frame.y)}"/><a:ext cx="${emu(frame.width)}" cy="${emu(frame.height)}"/></p:xfrm><a:graphic><a:graphicData uri="${SMART_ART_URI}"><dgm:relIds xmlns:dgm="${NS.dgm}" r:dm="${ids.data}" r:lo="" r:qs="${ids.quickStyle}" r:cs="${ids.colors}"/></a:graphicData></a:graphic></p:graphicFrame>`;
    });
    if (!changed) continue;
    entries[part] = encoder.encode(xml);
    entries[relsPart] = encoder.encode(rels);
  }
  if (seen !== records.size) throw new Error('Missing generated SmartArt placeholders.');
  entries['[Content_Types].xml'] = encoder.encode(decoder.decode(entries['[Content_Types].xml']).replace('</Types>', `${overrides.join('')}</Types>`));
}

// ---------------------------------------------------------------------------
// Import

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false, isArray: name => ['dgm:pt', 'dgm:cxn', 'a:p', 'a:r', 'p:tag'].includes(name)});
const TAG_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const scalar = value => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : value && typeof value === 'object' ? String(value['#text'] ?? '') : '';

/** The text runs of a data-model point (`dgm:t`): each run's text and the properties OPF keeps (bold, italic, underline, strike, lang). */
function pointRuns(point) {
  return array(point?.['dgm:t']?.['a:p']).flatMap((paragraph, index) => {
    const runs = array(paragraph?.['a:r']).map(run => {
      const properties = run?.['a:rPr'] ?? {}, text = scalar(run?.['a:t']).replace(/ /g, ' ');
      return {text, ...(properties.b === '1' || properties.b === 'true' ? {bold: true} : {}), ...(properties.i === '1' || properties.i === 'true' ? {italic: true} : {}),
        ...(properties.u && properties.u !== 'none' ? {underline: true} : {}), ...(properties.strike && properties.strike !== 'noStrike' ? {strikethrough: true} : {})};
    }).filter(run => run.text.length);
    return index && runs.length ? [{text: ' '}, ...runs] : runs;
  });
}
const entryOf = runs => runs.length === 1 && Object.keys(runs[0]).length === 1 ? runs[0].text : runs.length ? runs : '';

/**
 * Import: a slide's SmartArt frames that are a pyramid1 or matrix3 (by the data model's loTypeId), as lists. `frames` are the slide's
 * p:graphicFrame nodes; returns Map<frame index, {kind, payload, layout, tagged}>. An unchanged frame OPF wrote (OPF_SMARTART_V1, whose
 * node texts equal the data model's) gives back the authored list; any other reads the data model's nodes in `cxn` order.
 */
export function importSmartArt({frames, relationships, entries, slideIndex, report}) {
  const out = new Map();
  for (const [index, frame] of frames.entries()) {
    const data = frame?.['a:graphic']?.['a:graphicData'];
    if (data?.uri !== SMART_ART_URI) continue;
    const ids = data['dgm:relIds'] ?? {}, dataPart = relationships.get(ids['r:dm'])?.path;
    if (!dataPart || !entries[dataPart]) continue;
    let model;
    try { model = parser.parse(decoder.decode(entries[dataPart]))['dgm:dataModel']; } catch { continue; }
    const points = array(model?.['dgm:ptLst']?.['dgm:pt']), doc = points.find(point => point.type === 'doc');
    const kind = KIND_OF_LAYOUT.get(doc?.['dgm:prSet']?.loTypeId);
    if (!kind) continue;
    const byId = new Map(points.map(point => [point.modelId, point]));
    const children = array(model?.['dgm:cxnLst']?.['dgm:cxn']).filter(cxn => (cxn.type ?? 'parOf') === 'parOf' && cxn.srcId === doc.modelId)
      .sort((a, b) => Number(a.srcOrd ?? 0) - Number(b.srcOrd ?? 0)).map(cxn => byId.get(cxn.destId)).filter(point => point && (point.type ?? 'node') === 'node');
    const nested = array(model?.['dgm:cxnLst']?.['dgm:cxn']).some(cxn => (cxn.type ?? 'parOf') === 'parOf' && children.some(point => point.modelId === cxn.srcId));
    if (nested) report?.({code: 'smartart-flattened', path: `slides.${slideIndex}`, message: `A ${kind} SmartArt has nested entries; only its top level is imported as the list.`});
    const items = children.map(point => entryOf(pointRuns(point)));
    const texts = items.map(item => typeof item === 'string' ? item : item.map(run => run.text).join(''));
    // The tag (full provenance): the list as written, when the frame's node texts are still the ones OPF wrote.
    let stored;
    for (const link of array(frame?.['p:nvGraphicFramePr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== TAG_REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== SMART_ART_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.v === 1 && record.kind === kind && Array.isArray(record.items) && Array.isArray(record.texts)) stored = record;
        }
      } catch { /* an unreadable tag leaves the frame to its data model */ }
    }
    const unchanged = stored && stored.texts.length === texts.length && stored.texts.every((text, at) => text.replace(/ /g, ' ') === texts[at]);
    if (stored && !unchanged) report?.({code: 'smartart-edited', path: stored.path ?? `slides.${slideIndex}`, message: `The ${kind} was edited in PowerPoint; its list is read from the SmartArt's nodes.`});
    out.set(index, {kind, layout: `default:${kind}`, tagged: unchanged === true, payload: {type: 'list', items: unchanged ? structuredClone(stored.items) : items}});
  }
  return out;
}

/** Import: the shapes of a slide that carry a valid OPF_ARRANGEMENT_V1 tag (the layout's drawing of a pyramid or matrix, consumed). */
export function importArrangementShapes(shapes, relationships, entries) {
  const consumed = new Set();
  for (const shape of shapes) {
    for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== TAG_REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== ARRANGEMENT_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.v === 1 && typeof record.path === 'string' && typeof record.role === 'string') consumed.add(shape);
        }
      } catch { /* an unreadable tag leaves the shape as ordinary content */ }
    }
  }
  return consumed;
}
