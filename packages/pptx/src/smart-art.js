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
//      SH-16: the frame is the mc:Choice of an mc:AlternateContent (Requires SMART_ART_REQUIRES) whose mc:Fallback is a picture of the
//      same frame, id and name: OPF's preview of the frame (smartArtRegionSvg) as an SVG over its PNG raster, the outline as alt text.
//      PowerPoint takes the Choice; an app that does not lay SmartArt out takes the picture. Without a fallback picture (no opf-render,
//      no rasterizer) the arrangement is native shapes.
//   2. native shapes (`smartArt: "shapes"`, or an instance outside the domain, reported as the info finding pptx/smartart-unavailable
//      with the reason): the diamond and nodes as presets (diamond, trapezoid with core's adjustment, roundRect) at core's boxes, under
//      the list's measured lines, centered on their nodes. Each shape is tagged OPF_ARRANGEMENT_V1 and import consumes it (the layout's
//      drawing, not content); the lines import as the list.
//
// In `full` provenance the SmartArt frame carries OPF_SMARTART_V1: the slide, the list path, the arrangement, the authored list and the
// text of every node as written. On import an unchanged tagged SmartArt is that list again; an edited one (a node's text changed, a
// node added or removed) imports its data model's nodes, as any PowerPoint pyramid1 or matrix3 does: the points in `cxn` order, their
// text and run properties, as a list in the `pyramid` or `matrix` layout. Import never stores a layout part.
import {SMART_ART_LAYOUTS, arrangementPaint, applyColorTransform, bindNoBreak, colorContrast, smartArtScript, smartArtUnavailable} from '@openpresentation/opf/composition';
import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {mediaKey} from './media-dedupe.js';
import {safeMeasurement} from './safe-typefaces.js';
import {svgBlipRelationship} from './svg-image.js';

export const SMART_ART_TAG = 'OPF_SMARTART_V1', ARRANGEMENT_TAG = 'OPF_ARRANGEMENT_V1';
export const SMART_ART_URI = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
export const smartArtName = path => `OPF smartart ${path}`;
// SH-16: the fallback picture's name while the package is written; attachSmartArtFallbacks gives it the frame's name and id.
export const smartArtFallbackName = path => `OPF smartart fallback ${path}`;
/**
 * SH-16: the namespace the mc:Choice of a SmartArt frame requires (docs/smartart.md records the PowerPoint evidence). Only Office's
 * SmartArt uses it, so an app that does not lay SmartArt out does not claim it and takes the mc:Fallback picture.
 */
export const SMART_ART_REQUIRES = Object.freeze({prefix: 'dgm1612', namespace: 'http://schemas.microsoft.com/office/drawing/2016/12/diagram'});
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

/** SH-16: the alt text of the fallback picture: the kind and size, then each entry on its own line, in entry order. */
export function smartArtOutline(kind, values) {
  const texts = values.map(plain), count = texts.length;
  const head = kind === 'pyramid' ? `Pyramid of ${count} level${count === 1 ? '' : 's'}, top to bottom` : `Matrix of ${count} ${count === 1 ? 'entry' : 'entries'}, in reading order`;
  return [`${head}:`, ...texts].join('\n');
}

// A tag of the renderer's SVG (quoted attribute values may hold `>`), a comment, CDATA or a processing instruction.
const SVG_TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g;
const svgAttribute = (attributes, name) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(attributes)?.[1];
const svgNumber = value => String(Number(value.toFixed(4)));

// The miter limit opf-render strokes the arrangement's nodes with (stroke-miterlimit) and the antialiasing margin of the fallback picture.
const MITER_LIMIT = 8, ANTIALIAS = 1;

/**
 * SH-16: how far the preview's ink reaches outside the SmartArt frame (canvas px): the nodes' outlines, centered on their edges, with
 * the miter joins of a polygon's corners (a pyramid level's base corners reach furthest), plus a pixel of antialiasing. The fallback
 * picture grows by it on every side, so it draws everything the preview draws. Rounded up to whole EMU.
 */
export function smartArtBleed(arrangement) {
  const {frame} = arrangement, half = arrangement.lineWidth / 2, points = [];
  if (arrangement.background) {
    const {x, y, width, height} = arrangement.background;
    points.push([x, y], [x + width, y + height]);
  }
  for (const node of arrangement.nodes) {
    if (!node.points) {
      const {x, y, width, height} = node.box;
      points.push([x - half, y - half], [x + width + half, y + height + half]);
      continue;
    }
    node.points.forEach((point, index, all) => {
      const unit = ([dx, dy]) => { const length = Math.hypot(dx, dy) || 1; return [dx / length, dy / length]; };
      const previous = all[(index + all.length - 1) % all.length], next = all[(index + 1) % all.length];
      const u = unit([previous[0] - point[0], previous[1] - point[1]]), v = unit([next[0] - point[0], next[1] - point[1]]);
      // Each edge's stroke reaches half the width either side of it; a miter join reaches half the width over sin(angle / 2).
      for (const [dx, dy] of [u, v]) points.push([point[0] - dy * half, point[1] + dx * half], [point[0] + dy * half, point[1] - dx * half]);
      const sine = Math.sqrt(Math.max(0, (1 - (u[0] * v[0] + u[1] * v[1])) / 2));
      if (sine > 0 && 1 / sine <= MITER_LIMIT) {
        const bisector = unit([u[0] + v[0], u[1] + v[1]]);
        points.push([point[0] - bisector[0] * half / sine, point[1] - bisector[1] * half / sine]);
      }
    });
  }
  const reach = Math.max(0, ...points.flatMap(([x, y]) => [frame.x - x, frame.y - y, x - frame.x - frame.width, y - frame.y - frame.height]));
  return Math.ceil((reach + ANTIALIAS) * EMU) / EMU;
}

/**
 * SH-16: OPF's preview of one SmartArt frame, from the slide's SVG as opf-render draws it with `trace`: the arrangement's drawing and
 * its entries' text (each element with its ancestors, so their transforms and clips apply), with the definitions they use, cropped to
 * the frame grown by `bleed` on every side (smartArtBleed). Nothing else of the slide is drawn, so the picture is transparent around
 * the drawing.
 */
export function smartArtRegionSvg(svg, arrangement, bleed = 0) {
  const {path, frame} = arrangement, stack = [], found = [];
  let root;
  for (const match of svg.matchAll(SVG_TAG)) {
    const [text, closing, name, attributes = '', selfClosing] = match;
    if (!name) continue;
    if (closing) {
      const open = stack.pop();
      if (open?.kind) found.push({kind: open.kind, start: open.start, text: open.ancestors.map(entry => entry.text).join('') + svg.slice(open.start, match.index + text.length) + open.ancestors.map(entry => `</${entry.name}>`).reverse().join('')});
      continue;
    }
    if (root === undefined) { root = attributes; stack.push({name, text}); continue; }
    const inside = stack.some(entry => entry.kind);
    const kind = inside ? undefined : stack.length === 1 && (name === 'defs' || name === 'style') ? 'defs'
      : name === 'g' && svgAttribute(attributes, 'data-opf-arrangement') !== undefined ? 'arrangement'
        : name === 'g' && svgAttribute(attributes, 'data-opf-path') === path ? 'text' : undefined;
    const entry = {name, text, kind, start: match.index, ancestors: kind ? stack.slice(1).map(({name, text}) => ({name, text})) : []};
    if (!selfClosing) stack.push(entry);
    else if (kind) found.push({kind, start: entry.start, text: entry.ancestors.map(item => item.text).join('') + text + entry.ancestors.map(item => `</${item.name}>`).reverse().join('')});
  }
  const drawing = found.find(entry => entry.kind === 'arrangement' && entry.text.includes(`data-opf-arrangement-path="${path}.`));
  const entries = found.find(entry => entry.kind === 'text');
  if (root === undefined || !drawing || !entries) throw new Error(`the preview draws no ${arrangement.kind} at ${path}`);
  const strip = value => value.replace(/\sdata-opf-[\w-]+\s*=\s*"[^"]*"/g, '');
  const body = strip([drawing, entries].sort((a, b) => a.start - b.start).map(entry => entry.text).join(''));
  // The glyph outlines and other definitions the kept elements use; the slide's other glyphs are left out.
  const used = new Set([...body.matchAll(/(?:href="#|url\(#)([^")]+)/g)].map(match => match[1]));
  const definitions = strip(found.filter(entry => entry.kind === 'defs').sort((a, b) => a.start - b.start).map(entry => entry.text).join(''))
    .replace(/<path id="(opf-g-[^"]+)"[^>]*\/>/g, (all, id) => used.has(id) ? all : '');
  const namespaces = [...root.matchAll(/\s(xmlns(?::[\w.-]+)?)\s*=\s*"([^"]*)"/g)].filter(([, key]) => key !== 'xmlns').map(([, key, value]) => ` ${key}="${value}"`).join('');
  const [x, y, width, height] = [frame.x - bleed, frame.y - bleed, frame.width + 2 * bleed, frame.height + 2 * bleed].map(svgNumber);
  return `<svg xmlns="http://www.w3.org/2000/svg"${namespaces} width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${definitions}${body}</svg>`;
}

/**
 * SH-16: the slide's SVG as the preview draws it (opf-render, an optional peer), traced, its text as glyph outlines when the fonts
 * handle has them, so the fallback picture needs no font. `presentation` is the exported deck (variables resolved).
 */
export async function smartArtSlideSvg(presentation, slideNumber, options) {
  // In try, so a bundler leaves the optional peer out when the host does not install it (as the other opf-render imports).
  let toSvg;
  try {
    ({toSvg} = await import('@openpresentation/opf-render/svg'));
  } catch (error) {
    throw Object.assign(new Error('it needs the optional peer @openpresentation/opf-render', {cause: error}), {code: 'smartart-renderer-unavailable'});
  }
  const base = {trace: true, validate: false, strictAssets: false, onDiagnostic: () => {}, ...(options.catalogs ? {catalogs: options.catalogs} : {}),
    ...(options.date ? {date: options.date} : {}), ...(typeof options.pictureLuminance === 'function' ? {pictureLuminance: options.pictureLuminance} : {})};
  if (!options.fonts) return toSvg(presentation, slideNumber, base);
  // `typefaces: "safe"`: the slide is laid out and drawn with the Office-safe families the export writes, as the export lays it out.
  const fonts = options.safeTypeface && options.fonts.textMeasurement
    ? Object.create(options.fonts, {textMeasurement: {value: safeMeasurement(options.fonts.textMeasurement, options.safeTypeface), enumerable: true}}) : options.fonts;
  try { return toSvg(presentation, slideNumber, {...base, fonts, text: 'paths'}); }
  catch (error) {
    if (error?.code !== 'text-as-paths-needs-fonts') throw error;
    return toSvg(presentation, slideNumber, {...base, fonts});
  }
}
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
// The run properties a SmartArt node carries as written (others, such as links, citations, code or a run size, keep the shapes).
const RUN_KEYS = new Set(['text', 'bold', 'italic', 'underline', 'strikethrough', 'lang']);

const runsOf = value => {
  const text = value && typeof value === 'object' && !Array.isArray(value) ? value.text : value;
  return typeof text === 'string' ? [{text}] : Array.isArray(text) ? text.map(run => typeof run === 'string' ? {text: run} : run) : [];
};
const hex6 = value => String(value).replace(/^#/, '').slice(0, 6).toUpperCase();
const plain = value => runsOf(value).map(run => run?.text ?? '').join('');

/**
 * Whether an arrangement can be live SmartArt: undefined when it can, else the reason (pptx/smartart-unavailable). `values` are the
 * list's entries as authored.
 */
export function smartArtReason(arrangement, values, rtl) {
  if (values.some(value => runsOf(value).some(run => !run || typeof run.text !== 'string' || Object.keys(run).some(key => !RUN_KEYS.has(key)))))
    return 'an entry has text formatting a SmartArt node does not carry (a link, a citation, code or its own size)';
  if (values.some(value => /[\r\n\t]/.test(plain(value)))) return 'an entry holds a line break or a tab';
  const {rtl: rightToLeft, script} = smartArtScript(values.map(plain));
  return smartArtUnavailable({kind: arrangement.kind, count: values.length, frame: arrangement.frame, rtl: rtl || rightToLeft,
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
export async function addArrangements(slide, arrangements, {context, mode = 'live', items, slideIndex, records, tags, smartArtTags, provenance, report, fontOf, fallback}) {
  const drawn = new Set();
  if (!arrangements?.length) return drawn;
  const paint = exportPaint(context), inches = value => value / 96, box = area => ({x: inches(area.x), y: inches(area.y), w: inches(area.width), h: inches(area.height)});
  for (const arrangement of arrangements) {
    const item = items.find(entry => entry.path === arrangement.path), values = Array.isArray(item?.value) ? item.value : [];
    // Only PowerPoint's own design can be live SmartArt; OPF's design and a card grid are always native shapes.
    const design = arrangement.design ?? 'smartart';
    let reason = mode !== 'live' || design === 'cards' ? undefined : design === 'opf' ? `${arrangement.instead ?? `its entries do not fit PowerPoint's Basic ${arrangement.kind === 'pyramid' ? 'Pyramid' : 'Matrix'}`}, so OPF's own ${arrangement.kind} is drawn` : smartArtReason(arrangement, values, context.direction === 'rtl');
    // SH-16: the picture every app without SmartArt shows (OPF's preview of the frame). Without one the arrangement is native shapes.
    const candidate = mode === 'live' && design === 'smartart' && reason === undefined;
    const fallbackName = smartArtFallbackName(arrangement.path), alt = candidate ? smartArtOutline(arrangement.kind, values) : undefined;
    const picture = candidate ? (fallback ? await fallback(arrangement, {name: fallbackName, alt}) : 'no fallback picture can be drawn for apps without SmartArt') : undefined;
    if (typeof picture === 'string') reason = picture;
    if (candidate && reason === undefined) {
      const objectName = smartArtName(arrangement.path);
      // A placeholder at the frame, then its fallback picture: attachSmartArt makes the two the frame's mc:AlternateContent.
      slide.addShape('rect', {...box(arrangement.frame), fill: {color: paint.fill.hex.slice(1)}, line: {type: 'none'}, objectName});
      const bleed = picture();
      const tag = provenance === 'full' ? {v: 1, slide: slideIndex, path: arrangement.path, region: arrangement.region, kind: arrangement.kind, items: structuredClone(values), texts: values.map(plain)} : undefined;
      records.set(objectName, {arrangement, values, item, paint, lang: context.deckLang ?? 'en-US', fontOf, rtl: context.direction === 'rtl', fallback: {name: fallbackName, alt, tag, bleed}});
      if (tag) smartArtTags.set(objectName, tag);
      drawn.add(arrangement.path);
      continue;
    }
    if (reason !== undefined) report?.({code: 'smartart-unavailable', path: arrangement.path, reason,
      message: `The ${arrangement.kind} is exported as native shapes, not live SmartArt: ${reason}.`});
    const name = role => `OPF arrangement ${arrangement.path} ${role}`, tag = (objectName, role, extra = {}) => tags.set(objectName, {v: 1, path: arrangement.path, kind: arrangement.kind, role, ...extra});
    // A card grid in the card neutral with its border, as every OPF card; the other designs in the primary with the background's outline.
    const card = arrangement.paint === 'card', fill = card ? hex6(context.roles?.neutrals?.card?.hex ?? context.colors.surface) : paint.fill.hex.slice(1);
    const line = {color: card ? hex6(context.roles?.neutrals?.cardBorder?.hex ?? context.colors.border) : paint.line.hex.slice(1), width: arrangement.lineWidth * .75};
    if (arrangement.background) {
      const objectName = name('background');
      slide.addShape('diamond', {...box(arrangement.background), fill: {color: paint.background.hex.slice(1)}, line: {type: 'none'}, objectName});
      tag(objectName, 'background');
    }
    for (const node of arrangement.nodes) {
      const objectName = name(`node ${node.index}`);
      slide.addShape(node.preset === 'trapezoid' ? 'trapezoid' : 'roundRect', {...box(node.box), fill: {color: fill}, line, objectName,
        ...(node.preset === 'roundRect' ? {rectRadius: inches(node.radius ?? 0)} : {})});
      tag(objectName, 'node', {index: node.index, adjust: node.adjust, preset: node.preset, ...(node.path ? {entry: node.path} : {})});
    }
  }
  return drawn;
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
  const overrides = [], fallbacks = new Set([...records.values()].map(record => record.fallback?.name).filter(Boolean));
  let number = 0, seen = 0;
  for (const part of slides) {
    const relsPart = part.replace(/([^/]+)$/, '_rels/$1.rels');
    let rels = decoder.decode(entries[relsPart]), changed = false;
    let nextId = Math.max(0, ...[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match => Number(match[1]))) + 1;
    // SH-16: each fallback picture leaves its place (right after its placeholder) for its frame's mc:Fallback.
    const pictures = new Map();
    const source = decoder.decode(entries[part]).replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      const name = picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      if (!fallbacks.has(name)) return picture;
      pictures.set(name, picture);
      return '';
    });
    const xml = source.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
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
      const graphicFrame = `<p:graphicFrame><p:nvGraphicFramePr>${named}<p:cNvGraphicFramePr/>${nvPr}</p:nvGraphicFramePr><p:xfrm><a:off x="${emu(frame.x)}" y="${emu(frame.y)}"/><a:ext cx="${emu(frame.width)}" cy="${emu(frame.height)}"/></p:xfrm><a:graphic><a:graphicData uri="${SMART_ART_URI}"><dgm:relIds xmlns:dgm="${NS.dgm}" r:dm="${ids.data}" r:lo="" r:qs="${ids.quickStyle}" r:cs="${ids.colors}"/></a:graphicData></a:graphic></p:graphicFrame>`;
      // SH-16: PowerPoint takes the mc:Choice (the live SmartArt); an app that does not claim SMART_ART_REQUIRES takes the mc:Fallback,
      // OPF's preview of the frame as a picture (attachSmartArtFallbacks names, tags and describes it once its SVG part is attached).
      const picture = pictures.get(record.fallback?.name);
      if (!picture) throw new Error('A SmartArt frame has no fallback picture.');
      pictures.delete(record.fallback.name);
      return `<mc:AlternateContent xmlns:mc="${MC}"><mc:Choice xmlns:${SMART_ART_REQUIRES.prefix}="${SMART_ART_REQUIRES.namespace}" Requires="${SMART_ART_REQUIRES.prefix}">${graphicFrame}</mc:Choice><mc:Fallback>${picture}</mc:Fallback></mc:AlternateContent>`;
    });
    if (pictures.size) throw new Error('A SmartArt fallback picture has no frame.');
    if (!changed) continue;
    entries[part] = encoder.encode(xml);
    entries[relsPart] = encoder.encode(rels);
  }
  if (seen !== records.size) throw new Error('Missing generated SmartArt placeholders.');
  entries['[Content_Types].xml'] = encoder.encode(decoder.decode(entries['[Content_Types].xml']).replace('</Types>', `${overrides.join('')}</Types>`));
}

/**
 * SH-16: finish each fallback picture once its SVG part is attached (src/svg-image.js attachSvgPictures). In `full` provenance it carries
 * OPF_SMARTART_V1 too: the frame's record with `fallback: true` and the media keys of its SVG and PNG, so a file in which only the
 * picture survived imports as the same list on the same layout. Then it takes the frame's name and id (the two are one object, in the
 * mc:Choice or the mc:Fallback) and the outline as its description, one entry a line. `relationshipsOf(entries, part)` reads a slide's
 * relationships (Map<id, {path}>).
 */
export function attachSmartArtFallbacks(entries, records, relationshipsOf) {
  const fallbacks = new Map([...records.values()].filter(record => record.fallback).map(record => [record.fallback.name, record]));
  if (!fallbacks.size) return;
  const manifests = new Map();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    let relationships;
    for (const [picture] of decoder.decode(entries[part]).matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      const record = fallbacks.get(picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1]);
      if (!record?.fallback.tag) continue;
      relationships ??= relationshipsOf(entries, part);
      const png = entries[relationships.get(picture.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1])?.path];
      const svg = entries[relationships.get(picture.match(/<asvg:svgBlip\b[^>]*\br:embed="([^"]+)"/)?.[1])?.path];
      if (!png || !svg) throw new Error('A SmartArt fallback picture has no SVG or PNG part.');
      manifests.set(record.fallback.name, {...record.fallback.tag, fallback: true, svg: mediaKey(svg), png: mediaKey(png), bleed: Math.round((record.fallback.bleed ?? 0) * EMU)});
    }
  }
  attachTextTags(entries, manifests, SMART_ART_TAG, 'opfSmartArtFallback', 'SmartArt fallback', {pictures: true});
  let seen = 0;
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const xml = decoder.decode(entries[part]), next = xml.replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g, alternate => {
      const picture = alternate.match(/<mc:Fallback><p:pic>[\s\S]*?<\/p:pic><\/mc:Fallback>/)?.[0], name = picture?.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const record = fallbacks.get(name);
      if (!record) return alternate;
      seen += 1;
      const id = alternate.match(/<mc:Choice\b[\s\S]*?<p:cNvPr\b[^>]*\bid="(\d+)"/)?.[1];
      if (!id) throw new Error('A SmartArt frame has no id.');
      const descr = escapeXml(record.fallback.alt).replace(/\n/g, '&#10;');
      // The frame grown by the bleed on every side, from the frame's own EMU, so the picture and the frame share one center.
      const [, x, y] = alternate.match(/<p:xfrm><a:off x="(-?\d+)" y="(-?\d+)"\/>/) ?? [], [, cx, cy] = alternate.match(/<p:xfrm>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"\/>/) ?? [];
      if (x === undefined || cx === undefined) throw new Error('A SmartArt frame has no transform.');
      const bleed = Math.round((record.fallback.bleed ?? 0) * EMU);
      const grown = `<a:xfrm><a:off x="${Number(x) - bleed}" y="${Number(y) - bleed}"/><a:ext cx="${Number(cx) + 2 * bleed}" cy="${Number(cy) + 2 * bleed}"/></a:xfrm>`;
      const named = picture.replace(/<p:cNvPr\b[^>]*?(\/?)>/, (_, close) => `<p:cNvPr id="${id}" name="${escapeXml(smartArtName(record.arrangement.path))}" descr="${descr}"${close}>`);
      return alternate.replace(picture, named.replace(/<a:xfrm>[\s\S]*?<\/a:xfrm>/, grown));
    });
    if (next !== xml) entries[part] = encoder.encode(next);
  }
  if (seen !== fallbacks.size) throw new Error('Missing generated SmartArt fallback pictures.');
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

/**
 * SH-16, import: the slide's pictures that are the fallback of a SmartArt OPF wrote (a file another app saved with only the
 * mc:Fallback): a picture named for its list, carrying OPF_SMARTART_V1 with `fallback: true` whose SVG or PNG is still the one written.
 * Returns Map<picture index, {kind, layout, frame (the SmartArt frame's a:xfrm), payload}>; a tagged picture that was replaced or renamed imports as an ordinary picture.
 */
export function importSmartArtFallbacks({pictures, relationships, entries, slideIndex, report}) {
  const out = new Map();
  for (const [index, picture] of pictures.entries()) {
    let stored;
    for (const link of array(picture?.['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== TAG_REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== SMART_ART_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.fallback === true) stored = record;
        }
      } catch { /* an unreadable tag leaves the picture to import as a picture */ }
    }
    if (!stored) continue;
    const blip = picture?.['p:blipFill']?.['a:blip'], png = entries[relationships.get(blip?.['r:embed'])?.path], svg = entries[relationships.get(svgBlipRelationship(blip))?.path];
    const valid = stored.v === 1 && SMART_ART_LAYOUTS[stored.kind] !== undefined && typeof stored.path === 'string' && Array.isArray(stored.items) && stored.items.length > 0
      && scalar(picture?.['p:nvPicPr']?.['p:cNvPr']?.name) === smartArtName(stored.path)
      && ((svg && mediaKey(svg) === stored.svg) || (png && mediaKey(png) === stored.png));
    if (!valid) {
      report?.({code: 'invalid-smartart-provenance', path: `slides.${slideIndex}`, message: 'A tagged OPF SmartArt fallback picture was replaced, renamed or damaged; it imports as an ordinary picture.'});
      continue;
    }
    // The frame the picture was grown from (its bleed on every side), where the list lies.
    const xfrm = picture?.['p:spPr']?.['a:xfrm'], bleed = Number.isInteger(stored.bleed) && stored.bleed >= 0 ? stored.bleed : 0;
    const frame = xfrm?.['a:off'] && xfrm?.['a:ext'] ? {...xfrm, 'a:off': {...xfrm['a:off'], x: String(Number(xfrm['a:off'].x) + bleed), y: String(Number(xfrm['a:off'].y) + bleed)},
      'a:ext': {...xfrm['a:ext'], cx: String(Number(xfrm['a:ext'].cx) - 2 * bleed), cy: String(Number(xfrm['a:ext'].cy) - 2 * bleed)}} : xfrm;
    out.set(index, {kind: stored.kind, layout: `default:${stored.kind}`, frame, payload: {type: 'list', items: structuredClone(stored.items)}});
  }
  return out;
}
