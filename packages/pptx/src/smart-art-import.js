// SH-08: SmartArt that PowerPoint users made, read into OPF.
//
// A SmartArt graphic is a data model (ppt/diagrams/dataN.xml: points and the connections between them), a layout named by the doc point's
// `loTypeId` and, when PowerPoint saved it, a drawing (dsp:drawing, the shapes PowerPoint laid out). Import reads the data model's outline
// (the `parOf` tree from the doc point, in `srcOrd` order: entries, nested entries and assistants), then takes the first that fits:
//
//   1. an OPF arrangement for PowerPoint's layout families that have one (pyramid, matrix, cycle, chevrons, flow, vertical flow): the
//      outline as a list on that layout (nested entries keep their level; composition draws a list where the arrangement draws one level);
//   2. the list and process families: the outline as a list on the `list` or `process` layout;
//   3. a hierarchy or organization chart: a Mermaid flowchart (top down, or left to right for a horizontal hierarchy), assistants on
//      dotted edges, a connection's own text as its edge label;
//   4. any other layout (Venn, radial, target, picture layouts...): the drawing as overlay shapes (SH-05's reader), the outline as the alt
//      text of the first; without a drawing, the outline as a list.
//
// Text is never lost silently: what none of these keeps (a transition's text, a node no connection reaches, a node's picture, run
// formatting a Mermaid label does not carry) is a finding naming it.
import {XMLParser} from 'fast-xml-parser';
import {SMART_ART_LAYOUTS} from '@openpresentation/opf/composition';
import {drawsLook, importNativeShape, loadedShapeGeometry, placement, readColor, readDrawnShapes} from './shape-import.js';
import {opfLayoutKind} from './smart-art-layouts.js';

const ordered = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true, parseAttributeValue: false, parseTagValue: false, trimValues: false});
const tagOf = node => { for (const key in node) if (key !== ':@' && key !== '#text') return key; return undefined; };
const kidsOf = node => { const tag = tagOf(node); return tag ? node[tag] ?? [] : []; };
const attrsOf = node => node?.[':@'] ?? {};
const find = (kids, tag) => (kids ?? []).find(node => tagOf(node) === tag);
const every = (kids, tag) => (kids ?? []).filter(node => tagOf(node) === tag);
const textOf = kids => (kids ?? []).map(node => typeof node['#text'] === 'string' || typeof node['#text'] === 'number' ? String(node['#text']) : '').join('');
const truthy = value => value === '1' || value === 'true';
const KIND_OF_LAYOUT = new Map(Object.entries(SMART_ART_LAYOUTS).map(([kind, id]) => [id, kind]));

// ---------------------------------------------------------------------------
// Text

const FORMAT = ['bold', 'italic', 'underline', 'strikethrough'];
/** A run's OPF formatting from its a:rPr attributes. */
function runFormat(properties) {
  const p = attrsOf(properties);
  return {...(truthy(p.b) ? {bold: true} : {}), ...(truthy(p.i) ? {italic: true} : {}), ...(p.u && p.u !== 'none' ? {underline: true} : {}), ...(p.strike && p.strike !== 'noStrike' ? {strikethrough: true} : {})};
}
const sameFormat = (a, b) => FORMAT.every(key => a[key] === b[key]);

/**
 * The paragraphs of a text body (the kids of dgm:t or dsp:txBody, ordered parse): each a list of runs `{text, bold, italic, underline,
 * strikethrough}` in order, a field's text as a run, a line break (a:br) as a newline; adjacent runs of one format joined.
 */
export function readParagraphs(kids) {
  return every(kids, 'a:p').map(paragraph => {
    const runs = [];
    for (const node of kidsOf(paragraph)) {
      const tag = tagOf(node);
      let run;
      if (tag === 'a:r' || tag === 'a:fld') run = {text: textOf(kidsOf(find(kidsOf(node), 'a:t'))).replace(/ /g, ' '), ...runFormat(find(kidsOf(node), 'a:rPr'))};
      else if (tag === 'a:br') run = {text: '\n', ...runFormat(find(kidsOf(node), 'a:rPr'))};
      if (!run?.text) continue;
      const last = runs.at(-1);
      if (last && sameFormat(last, run)) last.text += run.text;
      else runs.push(run);
    }
    return runs;
  });
}

/** One entry's runs: the paragraphs of a point joined with a space (a node's lines are one entry). */
const joinParagraphs = paragraphs => paragraphs.filter(runs => runs.length).flatMap((runs, index) => index ? [{text: ' '}, ...runs] : runs);
export const plainText = runs => runs.map(run => run.text).join('');
/** OPF text of runs: a string when no run is formatted, else the runs as objects (as SH-09's import gave them). */
export function textValue(runs) {
  if (runs.every(run => !FORMAT.some(key => run[key]))) return plainText(runs);
  return runs.map(run => ({...run}));
}

// ---------------------------------------------------------------------------
// The data model

/**
 * Read a SmartArt data model: `{layoutId, category, roots, dropped, pictures, drawingRelId}`. `roots` is the outline: entries `{runs,
 * assistant, detail, edge, children}` in `srcOrd` order (`detail`: a presentation point's own text, such as a name-and-title chart's title;
 * `edge`: the text of the connection from its parent). An entry without text gives its place to its children. `dropped` lists the text no
 * entry carries ({role, text}): transitions between siblings, presentation text not tied to an entry and nodes no connection reaches.
 * `pictures` counts the entries with a picture fill. Undefined when the part is not a data model.
 */
export function readSmartArtModel(xml) {
  let tree;
  try { tree = ordered.parse(xml); } catch { return undefined; }
  const model = find(tree, 'dgm:dataModel');
  if (!model) return undefined;
  const kids = kidsOf(model);
  const points = every(kidsOf(find(kids, 'dgm:ptLst')), 'dgm:pt').map(node => {
    const attributes = attrsOf(node), own = kidsOf(node), spPr = kidsOf(find(own, 'dgm:spPr'));
    const paragraphs = readParagraphs(kidsOf(find(own, 'dgm:t'))).filter(runs => plainText(runs).trim());
    return {id: attributes.modelId, type: attributes.type ?? 'node', cxnId: attributes.cxnId, set: attrsOf(find(own, 'dgm:prSet')),
      runs: joinParagraphs(paragraphs), paragraphs, picture: find(spPr, 'a:blipFill') !== undefined};
  });
  const connections = every(kidsOf(find(kids, 'dgm:cxnLst')), 'dgm:cxn').map(attrsOf);
  const doc = points.find(point => point.type === 'doc');
  if (!doc) return undefined;
  const byId = new Map(points.map(point => [point.id, point]));
  const childrenOf = new Map();
  for (const cxn of connections) {
    if ((cxn.type ?? 'parOf') !== 'parOf') continue;
    if (!childrenOf.has(cxn.srcId)) childrenOf.set(cxn.srcId, []);
    childrenOf.get(cxn.srcId).push(cxn);
  }
  // A presentation point with text of its own (custT) belongs to the entry it presents (presOf), as that entry's detail.
  const detailOf = new Map();
  const presOf = new Map(connections.filter(cxn => cxn.type === 'presOf').map(cxn => [cxn.destId, cxn.srcId]));
  const dropped = [];
  for (const point of points) {
    if (point.type !== 'pres' || !plainText(point.runs).trim()) continue;
    const owner = presOf.get(point.id);
    if (owner && byId.get(owner) && ['node', 'asst'].includes(byId.get(owner).type) && !detailOf.has(owner)) detailOf.set(owner, point.runs);
    else dropped.push({role: 'presentation', text: plainText(point.runs)});
  }
  // A sibling transition the layout presents (a presOf from it), such as a name-and-title chart's title box: the title of the entry its
  // connection leads to (the COM-made fixture: PowerPoint stores "Chief Executive" there).
  const presented = new Set(connections.filter(cxn => cxn.type === 'presOf').map(cxn => cxn.srcId)), usedTransitions = new Set();
  const byCxn = new Map(connections.filter(cxn => (cxn.type ?? 'parOf') === 'parOf').map(cxn => [cxn.modelId, cxn]));
  for (const point of points) {
    if (point.type !== 'sibTrans' || !presented.has(point.id) || !plainText(point.runs).trim()) continue;
    const owner = byCxn.get(point.cxnId)?.destId;
    if (owner && ['node', 'asst'].includes(byId.get(owner)?.type) && !detailOf.has(owner)) { detailOf.set(owner, point.runs); usedTransitions.add(point.id); }
  }
  const reached = new Set();
  const build = (parentId, seen) => (childrenOf.get(parentId) ?? []).slice().sort((a, b) => Number(a.srcOrd ?? 0) - Number(b.srcOrd ?? 0)).flatMap(cxn => {
    const point = byId.get(cxn.destId);
    if (!point || !['node', 'asst'].includes(point.type) || seen.has(point.id)) return [];
    reached.add(point.id);
    const children = build(point.id, new Set([...seen, point.id]));
    const edge = byId.get(cxn.parTransId);
    if (!plainText(point.runs).trim()) return children;
    if (edge && plainText(edge.runs).trim()) usedTransitions.add(edge.id);
    return [{runs: point.runs, paragraphs: point.paragraphs, assistant: point.type === 'asst', ...(detailOf.has(point.id) ? {detail: detailOf.get(point.id)} : {}),
      ...(edge && plainText(edge.runs).trim() ? {edge: edge.runs, edgeId: edge.id} : {}), picture: point.picture, children}];
  });
  const roots = build(doc.id, new Set([doc.id]));
  for (const point of points) {
    if (['node', 'asst'].includes(point.type) && !reached.has(point.id) && plainText(point.runs).trim()) dropped.push({role: 'node', text: plainText(point.runs)});
    if (['parTrans', 'sibTrans'].includes(point.type) && plainText(point.runs).trim() && !(point.type === 'sibTrans' && usedTransitions.has(point.id)))
      dropped.push({role: 'transition', text: plainText(point.runs), id: point.id, used: usedTransitions.has(point.id)});
  }
  const extension = (function search(nodes) {
    for (const node of nodes ?? []) {
      if (tagOf(node) === 'dsp:dataModelExt') return attrsOf(node).relId;
      const found = search(kidsOf(node));
      if (found) return found;
    }
    return undefined;
  })(kidsOf(find(kids, 'dgm:extLst')));
  const count = list => list.reduce((sum, entry) => sum + (entry.picture ? 1 : 0) + count(entry.children), 0);
  return {layoutId: doc.set.loTypeId ?? '', category: doc.set.loCatId ?? '', roots, dropped, pictures: count(roots), ...(extension ? {drawingRelId: extension} : {})};
}

// ---------------------------------------------------------------------------
// Which OPF form

/** The last segment of a layout id (`urn:microsoft.com/office/officeart/2005/8/layout/pyramid3` is `pyramid3`). */
export const layoutStem = id => String(id ?? '').split('/').pop();

/**
 * The OPF form of a SmartArt layout: `{arrangement}` (an OPF arrangement, `exact` when it is the layout OPF writes), `{layout: 'list' |
 * 'process'}`, `{hierarchy: 'TD' | 'LR'}` or `{drawing: true}`. By the layout id's family first, then by the category the doc point names.
 */
export function smartArtForm(layoutId, category) {
  const exact = KIND_OF_LAYOUT.get(layoutId) ?? opfLayoutKind(layoutId);
  if (exact) return {arrangement: exact, exact: true};
  const stem = layoutStem(layoutId);
  if (/^(venn|radial|target|balance|funnel|gear|equation|arrow|bracket|opposingIdeas|counterbalance|plus|converging|diverging|hexagon|circleRelationship)/i.test(stem)) return {drawing: true};
  if (/^pyramid\d*$/i.test(stem)) return {arrangement: 'pyramid'};
  if (/^matrix\d*$/i.test(stem)) return {arrangement: 'matrix'};
  if (/^cycle\d*$/i.test(stem)) return {arrangement: 'cycle'};
  if (/chevron/i.test(stem)) return {arrangement: 'chevrons'};
  if (/^hierarchy2$|horizontal.*(hierarchy|organi[sz]ation)/i.test(stem)) return {hierarchy: 'LR'};
  if (/^(orgChart|hierarchy)\d*$|organi[sz]ation|hierarchy/i.test(stem)) return {hierarchy: 'TD'};
  switch (category) {
    case 'pyramid': return {arrangement: 'pyramid'};
    case 'matrix': return {arrangement: 'matrix'};
    case 'cycle': return {arrangement: 'cycle'};
    case 'hierarchy': return {hierarchy: 'TD'};
    case 'process': return {layout: 'process'};
    case 'list': return {layout: 'list'};
    default: return {drawing: true};
  }
}

// ---------------------------------------------------------------------------
// Into OPF

/**
 * The outline as list items: depth first, a nested entry with its `level`, a detail as the item's description. With `split`, each paragraph
 * of an entry is an item of its own at the entry's level (the list and process layouts hold their bullets as one node's paragraphs: the
 * COM-made fixture's Vertical Bullet List and Accent Process take one child node a parent); else an entry's paragraphs are one item.
 */
export function outlineItems(roots, {split = false} = {}) {
  const items = [];
  const item = (runs, level, detail) => level === 0 && !detail ? textValue(runs) : {text: textValue(runs), ...(detail ? {description: textValue(detail)} : {}), ...(level ? {level} : {})};
  const visit = (entries, level) => {
    for (const entry of entries) {
      const parts = split && entry.paragraphs?.length > 1 ? entry.paragraphs : [entry.runs];
      parts.forEach((runs, index) => items.push(item(runs, level, index === 0 ? entry.detail : undefined)));
      visit(entry.children, level + 1);
    }
  };
  visit(roots, 0);
  return items;
}

/** The outline as text: one entry a line, indented two spaces a level, a detail after a comma. */
export function outlineText(roots) {
  const lines = [];
  const visit = (entries, level) => {
    for (const entry of entries) {
      lines.push(`${'  '.repeat(level)}${plainText(entry.runs).replace(/\s*\n\s*/g, ' ')}${entry.detail ? `, ${plainText(entry.detail).replace(/\s*\n\s*/g, ' ')}` : ''}`);
      visit(entry.children, level + 1);
    }
  };
  visit(roots, 0);
  return lines.join('\n');
}

// A Mermaid label in double quotes: the quote and the characters Mermaid reads as markup are entity codes; a line break is <br/>.
const label = runs => plainText(runs).trim().replace(/[#"<>]/g, char => ({'#': '#35;', '"': '#quot;', '<': '#lt;', '>': '#gt;'}[char])).replace(/[ \t]*\n[ \t]*/g, '<br/>');

/**
 * A hierarchy or organization chart as a Mermaid flowchart (`direction` TD or LR): one node per entry, `n1` on, its text (and detail on a
 * second line) as its label; an edge from each parent, dotted to an assistant, labelled with the connection's own text. Returns
 * `{source, alt, formatted}` (`formatted`: some run had formatting a label does not carry).
 */
export function hierarchyDiagram(roots, direction, noun) {
  const lines = [`flowchart ${direction}`];
  let next = 0, formatted = false;
  const visit = (entries, parent) => {
    for (const entry of entries) {
      const id = `n${++next}`;
      if ([...entry.runs, ...(entry.detail ?? [])].some(run => FORMAT.some(key => run[key]))) formatted = true;
      lines.push(`  ${id}["${label(entry.runs)}${entry.detail ? `<br/>${label(entry.detail)}` : ''}"]`);
      if (parent) lines.push(`  ${parent} ${entry.assistant ? '-.->' : '-->'}${entry.edge ? `|"${label(entry.edge)}"|` : ''} ${id}`);
      visit(entry.children, id);
    }
  };
  visit(roots, undefined);
  return {source: lines.join('\n'), alt: `${noun}, top level first:\n${outlineText(roots)}`, formatted};
}

// ---------------------------------------------------------------------------
// The drawing as a slide's shapes

// Color transforms of value 0 and an empty 3-D shape change nothing (PowerPoint writes them on SmartArt shapes); SH-05's reader would
// report them as dropped properties.
const NO_OP = /<a:(?:hueOff|satOff|lumOff|alphaOff)\s+val="0"\s*\/>|<a:sp3d\s*\/>/g;
const xfrmXml = ({x, y, cx, cy, rot = 0, flipH, flipV}) => `<a:xfrm${rot ? ` rot="${rot}"` : ''}${flipH ? ' flipH="1"' : ''}${flipV ? ' flipV="1"' : ''}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm>`;

/**
 * A SmartArt's drawing part (dsp:drawing) as a slide part SH-05's reader reads (readDrawnShapes): its shapes in a group that maps the
 * drawing's space (the frame's, origin at its corner) onto the frame `xfrm` ({x, y, cx, cy, rot, flipH, flipV}, EMU on the slide). Each
 * shape is named `${name} ${k}`; `bodies[k]` is its text: `{paragraphs, box}` (`box` the text's own rectangle, dsp:txXfrm, in the drawing's
 * space, when PowerPoint wrote one). Undefined when the part has no shapes.
 */
export function drawingSlide(xml, xfrm, name) {
  const tree = /<dsp:spTree\b[^>]*>([\s\S]*)<\/dsp:spTree>/.exec(String(xml).replace(NO_OP, ''))?.[1];
  if (!tree) return undefined;
  const bodies = [];
  let k = 0;
  const shapes = tree.replace(/^\s*<dsp:nvGrpSpPr>[\s\S]*?<\/dsp:nvGrpSpPr>\s*(?:<dsp:grpSpPr\s*\/>|<dsp:grpSpPr>[\s\S]*?<\/dsp:grpSpPr>)/, '')
    .replace(/<dsp:sp\b[^>]*>[\s\S]*?<\/dsp:sp>/g, shape => {
      const index = k++;
      const box = /<dsp:txXfrm\b([^>]*)>\s*<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/.exec(shape);
      const body = /<dsp:txBody>[\s\S]*?<\/dsp:txBody>/.exec(shape)?.[0];
      let paragraphs = [];
      try { paragraphs = body ? readParagraphs(kidsOf(find(ordered.parse(body), 'dsp:txBody'))) : []; } catch { paragraphs = []; }
      bodies[index] = {paragraphs, ...(box ? {box: {x: Number(box[2]), y: Number(box[3]), cx: Number(box[4]), cy: Number(box[5]), rot: Number(/\brot="(-?\d+)"/.exec(box[1])?.[1] ?? 0)}} : {})};
      return shape.replace(/<dsp:txXfrm\b[\s\S]*?<\/dsp:txXfrm>/, '').replace(/<dsp:cNvPr\b[^>]*?(\/?)>/, (_, close) => `<dsp:cNvPr id="${index + 1}" name="${String(name).replace(/[&<>"]/g, '')} ${index}"${close}>`);
    })
    .replace(/<(\/?)dsp:/g, '<$1p:');
  if (!k) return undefined;
  const slide = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:grpSp><p:nvGrpSpPr><p:cNvPr id="0" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrmXml(xfrm)}</p:grpSpPr>${shapes}</p:grpSp></p:spTree></p:cSld></p:sld>`;
  return {xml: slide, bodies};
}

/** A shape's text from its paragraphs: runs joined with a newline between paragraphs (OPF text: a string or runs). */
export function drawingText(paragraphs) {
  const runs = paragraphs.filter(runs => runs.length).flatMap((runs, index) => index ? [{text: '\n'}, ...runs] : runs);
  if (!plainText(runs).trim()) return undefined;
  return textValue(runs);
}

const EMU_PER_PX = 9525;
const INSETS = {l: 91440, t: 45720, r: 91440, b: 45720};

/**
 * SH-08: a SmartArt's drawing (importSmartArt's `shapes` result) as overlay shapes of the slide, through SH-05's reader (`context` is the
 * slide's shape-import context; `z` the frame's place in the slide's z order). A shape that draws something keeps its text where its own
 * text rectangle holds PowerPoint's (the inset becomes its padding); text PowerPoint set elsewhere (beside a shape, across an overlap) is a
 * text-only overlay at PowerPoint's text rectangle. Text that is not the slide's text color keeps its color. The first shape carries the
 * outline as its alt text.
 */
export function importSmartArtShapes(result, {context, z = 0}) {
  const geometry = loadedShapeGeometry();
  const turned = result.frame.rot || result.frame.flipH || result.frame.flipV;
  let outline = result.outline;
  for (const [order, entry] of readDrawnShapes(result.slide.xml).entries()) {
    if (entry.tag !== 'p:sp' || !entry.frame) continue;
    const name = String(entry.props['p:nvSpPr']?.['p:cNvPr']?.name ?? '');
    const body = result.slide.bodies[Number(/ (\d+)$/.exec(name)?.[1])] ?? {paragraphs: []};
    // The text color the shape's style names (dsp:style a:fontRef); the slide's text color (tx1) is the default and is not stated.
    const fontRef = entry.props['p:style']?.['a:fontRef'];
    const color = fontRef?.['a:schemeClr']?.val === 'tx1' ? undefined : readColor(fontRef, {mapping: context.mapping})?.ref;
    const plain = drawingText(body.paragraphs), text = plain === undefined || color === undefined ? plain
      : (typeof plain === 'string' ? [plain] : plain).map(run => typeof run === 'string' ? {text: run, color} : {...run, color});
    const look = drawsLook(entry.props);
    if (!look.visible && text === undefined) continue;
    const before = context.state.overlays.length;
    importNativeShape(entry, 'overlay', {...context, text});
    const overlay = context.state.overlays[before];
    if (!overlay) continue;
    overlay.z = z + (order + 1) / 1000;
    const bodyPr = entry.props['p:txBody']?.['a:bodyPr'] ?? {};
    const inset = side => Number.isFinite(Number(bodyPr[`${side}Ins`])) && bodyPr[`${side}Ins`] !== '' ? Number(bodyPr[`${side}Ins`]) : INSETS[side];
    const px = value => Math.round(Math.max(0, value) / EMU_PER_PX / context.scale * 10000) / 10000;
    // Where PowerPoint set the text (dsp:txXfrm, on the slide), against the shape's own text rectangle.
    if (text !== undefined && body.box && !body.box.rot && !turned && !entry.frame.rot && geometry) {
      const box = {x: result.frame.x + body.box.x, y: result.frame.y + body.box.y, cx: body.box.cx, cy: body.box.cy};
      const {shape = 'rect', adjust, path} = overlay.entry, frame = entry.frame;
      let own = {x: 0, y: 0, width: frame.cx, height: frame.cy};
      if (!path && shape !== 'rect') { try { own = geometry.presetGeometry(shape, frame.cx, frame.cy, adjust).textRect; } catch { /* the whole box */ } }
      const sides = {left: box.x + inset('l') - (frame.x + own.x), top: box.y + inset('t') - (frame.y + own.y),
        right: frame.x + own.x + own.width - (box.x + box.cx - inset('r')), bottom: frame.y + own.y + own.height - (box.y + box.cy - inset('b'))};
      if (Object.values(sides).every(value => value >= -EMU_PER_PX)) {
        const padding = Object.fromEntries(Object.entries(sides).map(([side, value]) => [side, px(value)]));
        overlay.entry.padding = Object.values(padding).every(value => value === padding.top) ? padding.top : {top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left};
      } else if (look.visible) {
        // The text lies outside the shape's text rectangle: a text-only overlay at PowerPoint's.
        delete overlay.entry.text;
        const place = placement(box, context, context.report, name, context.slideIndex);
        const padding = {top: px(inset('t')), right: px(inset('r')), bottom: px(inset('b')), left: px(inset('l'))};
        const anchor = {t: 'top', b: 'bottom'}[bodyPr.anchor];
        context.state.overlays.push({z: overlay.z + 0.0005, name: `${name} text`, frame: box, opaque: false,
          entry: {...place, shape: 'rect', fill: 'none', stroke: 'none', style: 'none', text, ...(anchor ? {anchor} : {}), padding: Object.values(padding).every(value => value === padding.top) ? padding.top : padding}});
      }
    }
    if (outline && overlay.entry.alt === undefined && !overlay.entry.decorative) { overlay.entry.alt = outline; outline = undefined; }
  }
}
