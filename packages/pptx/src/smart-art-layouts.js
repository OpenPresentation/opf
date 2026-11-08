// SH-19: OPF's own SmartArt layout definitions, one per OPF design (core smart-art-layout.ts). Each is written from ECMA-376 Part 1, §21.4
// and OPF's design, never from PowerPoint's built-in parts: its identity below (the uniqueId in OPF's namespace, and the title and
// description PowerPoint shows), and its body, a table of explicit constraints per node count that core builds from the design
// (compositeLayoutDefinition). The export writes the definition only when OPF's interpreter, evaluating it as PowerPoint does, draws the
// composed design (within 0.1 pt): live SmartArt then shows exactly what the preview shows.
import {OPF_LAYOUT_KIND, OPF_LAYOUT_MAX, compositeLayoutDefinition, evaluateLayoutDefinition, layoutArrangement, opfLayoutGeometry} from '@openpresentation/opf/composition';

/** The namespace of OPF's layout definitions. */
export const OPF_LAYOUT_NAMESPACE = 'urn:openpresentation.org/smartart/layout/';
/** OPF's layout definitions: the identity and Change Layout category of each design (core OPF_LAYOUT_DESIGNS). */
export const OPF_LAYOUTS = Object.freeze({
  'cycle-ring': {title: 'OPF Cycle Ring', description: 'The steps of a loop as rounded rectangles on a ring, clockwise from the top, an arrow from each to the next.', category: 'cycle'},
  'cycle-loop': {title: 'OPF Cycle Loop', description: 'The steps of a loop in two rows, clockwise from the top left, an arrow from each to the next.', category: 'cycle'},
  'cycle-loop-3': {title: 'OPF Cycle Loop of Three Rows', description: 'The steps of a loop in three rows, clockwise from the top left, an arrow from each to the next.', category: 'cycle'},
  'pyramid-steps': {title: 'OPF Stepped Pyramid', description: 'Levels that build on each other as a stepped pyramid of rounded bars, each entry beside its level.', category: 'pyramid'},
  'matrix-quadrants': {title: 'OPF Quadrants', description: 'Four parts of a whole as rounded quadrants filling the frame two by two.', category: 'matrix'},
  'card-grid': {title: 'OPF Card Grid', description: 'Entries on cards in a grid, the last row centered.', category: 'list'},
  'chevron-rows': {title: 'OPF Chevron Rows', description: 'Stages as chevrons in one or more rows, left to right.', category: 'process'},
  'flow-rows': {title: 'OPF Snaking Flow', description: 'Steps as boxes with arrows between them in rows that snake, the second running back under the first.', category: 'process'},
  'vertical-flow-columns': {title: 'OPF Snaking Vertical Flow', description: 'Steps as boxes with arrows between them in columns that snake, top to bottom then back up.', category: 'process'},
});
/** The compact form of a linear design has its own definition (closer rooms, smaller arrows). */
const COMPACT = Object.freeze({title: ' (Compact)', description: ' Compact: closer boxes and smaller arrows.'});

/**
 * The uniqueId of OPF's layout definition of a recipe (core OpfLayoutRecipe) whose body is `body`: the design's name, then a digest of the
 * body. PowerPoint keeps the first definition it loads for a uniqueId for the rest of its session (the SH-19 sweep: a deck opened after
 * another with the same uniqueId and other tables was drawn with the first deck's tables), so every distinct table has its own id; two
 * exports of the same design at the same frame share one.
 */
export const opfLayoutId = (recipe, body = '') => `${OPF_LAYOUT_NAMESPACE}${recipe.design}${recipe.compact ? '-compact' : ''}${body ? `/${digest(body)}` : ''}`;
/** A 64-bit FNV-1a digest of a string, as 16 hexadecimal digits (deterministic, no platform hashing). */
function digest(text) {
  let high = 0xcbf29ce4, low = 0x84222325;
  for (let index = 0; index < text.length; index++) {
    low ^= text.charCodeAt(index);
    // Multiply the 64-bit state by the FNV prime 0x100000001b3: low * 0x1b3, and high * 0x1b3 + low * 0x100 (the prime's high word).
    const lo = low * 0x1b3, carry = Math.floor(lo / 0x100000000);
    high = (high * 0x1b3 + low * 0x100 + carry) >>> 0;
    low = lo >>> 0;
  }
  return high.toString(16).padStart(8, '0') + low.toString(16).padStart(8, '0');
}
/** The arrangement an OPF layout uniqueId draws (import), or undefined. */
export function opfLayoutKind(uniqueId) {
  if (typeof uniqueId !== 'string' || !uniqueId.startsWith(OPF_LAYOUT_NAMESPACE)) return undefined;
  return OPF_LAYOUT_KIND[uniqueId.slice(OPF_LAYOUT_NAMESPACE.length).split('/')[0].replace(/-compact$/, '')];
}

/** SH-23: the entry counts OPF's layout definitions carry a table for (OPF draws at most OPF_LAYOUT_MAX; PowerPoint users add more). */
export const OPF_LAYOUT_TABLES = 12;

const PT = .75, TOLERANCE = .1 / PT; // 0.1 pt in canvas pixels
const near = (a, b) => Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE && Math.abs(a.width - b.width) <= TOLERANCE && Math.abs(a.height - b.height) <= TOLERANCE;
const turn = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180) <= .01;

/**
 * OPF's layout definition of a composed arrangement (core ComposedArrangement with `layout`): the tables of its design for 1 to 8 entries
 * at its frame (its own count from the composed geometry), its paint and text. Returns {definition} when OPF's interpreter draws the
 * composed arrangement from it within 0.1 pt, else {reason}.
 */
export function opfLayoutDefinition(arrangement, item) {
  const recipe = arrangement.layout;
  if (!recipe || !OPF_LAYOUTS[recipe.design]) return {reason: 'its design has no OPF layout definition'};
  const identity = OPF_LAYOUTS[recipe.design], count = arrangement.nodes.length, frame = arrangement.frame, size = arrangement.fontSize;
  // Each entry's text anchored at the top where OPF's composition starts its first line (the list column's box in the text rectangle).
  const textTops = arrangement.nodes.map((node, index) => { const box = item?.listColumns?.[index]?.box; return box ? Math.max(0, (box.y - node.textBox.y) / size) : undefined; });
  const own = {nodes: arrangement.nodes, arrows: arrangement.arrows ?? [], ...(textTops.every(top => top !== undefined) ? {textTops} : {})};
  const margins = (arrangement.margins ?? [arrangement.textMargin, arrangement.textMargin, arrangement.textMargin, arrangement.textMargin]).map(value => value / size);
  const card = arrangement.paint === 'card';
  // SH-23: tables up to OPF_LAYOUT_TABLES entries, so entries a user adds in PowerPoint past OPF's 8 keep OPF's design (where every larger
  // table holds; else the tables stop at 8 and a ninth entry takes the 8-entry table, as before).
  const build = max => compositeLayoutDefinition({uniqueId: opfLayoutId(recipe), title: identity.title + (recipe.compact ? COMPACT.title : ''), description: identity.description + (recipe.compact ? COMPACT.description : ''), category: identity.category},
    frame, max, k => k === count ? own : opfLayoutGeometry(recipe, k), {node: card ? 'alignNode1' : 'node1', text: arrangement.text, align: arrangement.align, margins, fontSize: size * PT});
  let definition = build(OPF_LAYOUT_TABLES);
  if (definition.reason) definition = build(OPF_LAYOUT_MAX);
  if (definition.reason) return definition;
  let drawn;
  try { drawn = layoutArrangement(evaluateLayoutDefinition(definition, frame, count)); }
  catch (error) { return {reason: `OPF's layout definition cannot be evaluated (${error.message})`}; }
  const same = drawn.nodes.length === count && drawn.nodes.every((node, index) => near(node.box, own.nodes[index].box) && near(node.textBox, own.nodes[index].textBox) && node.preset === own.nodes[index].preset)
    && drawn.arrows.length === own.arrows.length && drawn.arrows.every((arrow, index) => near(arrow.box, own.arrows[index].box) && turn(arrow.rotation, own.arrows[index].rotation));
  if (!same) return {reason: "OPF's interpreter does not draw the design from its layout definition"};
  return {definition: {...definition, uniqueId: opfLayoutId(recipe, layoutDefinitionXml({...definition, uniqueId: ''}))}};
}

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));
const num = value => String(Number(Number(value).toFixed(9)));
const attrs = entries => entries.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join('');

function algXml(alg) {
  if (!alg) return '<dgm:alg type="sp"/>';
  const params = Object.entries(alg.params ?? {}).map(([type, val]) => `<dgm:param type="${type}" val="${escapeXml(val)}"/>`).join('');
  return `<dgm:alg type="${alg.type}"${params ? `>${params}</dgm:alg>` : '/>'}`;
}
function shapeXml(shape) {
  if (!shape) return '<dgm:shape><dgm:adjLst/></dgm:shape>';
  const adj = (shape.adj ?? []).map((value, index) => `<dgm:adj idx="${index + 1}" val="${num(value / 100000)}"/>`).join('');
  return `<dgm:shape${attrs([['type', shape.type], ['rot', shape.rot ? num(shape.rot) : undefined], ['hideGeom', shape.hideGeom ? '1' : undefined]])}><dgm:adjLst>${adj}</dgm:adjLst></dgm:shape>`;
}
const constrXml = list => `<dgm:constrLst>${(list ?? []).map(c => `<dgm:constr${attrs([['type', c.type], ['for', c.for], ['forName', c.forName], ['refType', c.refType], ['fact', c.fact !== undefined ? num(c.fact) : undefined], ['val', c.val !== undefined ? num(c.val) : undefined], ['op', c.op]])}/>`).join('')}</dgm:constrLst>`;
const presOfXml = presOf => presOf ? `<dgm:presOf${attrs([['axis', presOf.axis], ['ptType', presOf.ptType]])}/>` : '<dgm:presOf/>';
function childXml(child) {
  if (child.kind === 'layoutNode') return nodeXml(child);
  if (child.kind === 'forEach') return `<dgm:forEach${attrs([['name', child.name], ['axis', child.axis], ['ptType', child.ptType], ['st', child.st], ['cnt', child.cnt], ['hideLastTrans', child.hideLastTrans === false ? '0' : undefined]])}>${child.children.map(childXml).join('')}</dgm:forEach>`;
  return `<dgm:choose name="${escapeXml(child.name)}">${child.branches.map(branch => {
    const body = `${branch.alg ? `${algXml(branch.alg)}${shapeXml(branch.shape)}<dgm:presOf/>` : ''}${constrXml(branch.constraints)}<dgm:ruleLst/>${(branch.children ?? []).map(childXml).join('')}`;
    return branch.count === undefined ? `<dgm:else name="${escapeXml(branch.name)}">${body}</dgm:else>`
      : `<dgm:if name="${escapeXml(branch.name)}" func="cnt" axis="ch" ptType="node" op="equ" val="${branch.count}">${body}</dgm:if>`;
  }).join('')}</dgm:choose>`;
}
function nodeXml(node) {
  const bullets = node.alg?.type === 'tx' ? '<dgm:varLst><dgm:bulletEnabled val="1"/></dgm:varLst>' : '';
  const own = node.alg || node.shape || node.presOf || node.constraints ? `${bullets}${algXml(node.alg)}${shapeXml(node.shape)}${presOfXml(node.presOf)}${constrXml(node.constraints)}<dgm:ruleLst/>` : '';
  return `<dgm:layoutNode${attrs([['name', node.name], ['styleLbl', node.styleLbl]])}>${own}${(node.children ?? []).map(childXml).join('')}</dgm:layoutNode>`;
}

/** The layout part (`dgm:layoutDef`) of a definition. */
export function layoutDefinitionXml(definition) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" uniqueId="${escapeXml(definition.uniqueId)}"><dgm:title val="${escapeXml(definition.title)}"/><dgm:desc val="${escapeXml(definition.description)}"/><dgm:catLst><dgm:cat type="${escapeXml(definition.category)}" pri="99000"/></dgm:catLst>${nodeXml(definition.root)}</dgm:layoutDef>`;
}
