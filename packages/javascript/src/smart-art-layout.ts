/**
 * SH-19: OPF's own SmartArt layout definitions (ECMA-376 Part 1, §21.4 `dgm:layoutDef`) and OPF's interpreter of them.
 *
 * Where PowerPoint's built-in SmartArt layouts do not draw an arrangement (OPF's ring and loops of a cycle, its stepped pyramid, its four
 * quadrants and card grids, its wrapped and snaking chevrons and flows), the PPTX export writes OPF's own layout definition of the design,
 * so the design is live, editable SmartArt in PowerPoint. The definition is a table of explicit constraints (SH-19 spike, 2026-11-07,
 * COM): a `composite` root with one `if` branch per node count, each placing every node at `l`/`t`/`w`/`h` as shares of the frame, a hidden
 * full-frame child that fixes the drawing's bounds, axis-aligned arrows as `sp` shapes turned by `rot`, and other arrows as `conn`
 * connectors between two node centers. PowerPoint evaluates such a definition with no algorithm of its own: every node lands within
 * 0.0001 pt of its constraints at any frame size. OPF's interpreter (evaluateLayoutDefinition) evaluates the same subset as PowerPoint
 * does, and returns the nodes and arrows in the shape of a composed arrangement (layoutArrangement), so render and pptx need no second
 * geometry path: the export builds the definition from the composed design, evaluates it, and writes it only when the result is the design.
 *
 * PowerPoint's rules the interpreter reproduces (measured through COM, docs/smartart.md):
 * - `composite`: each child at its constraints (shares of the root's `w` and `h`, or absolute millimeters); when the children's bounds do not
 *   reach the frame's edges the drawing is moved to the frame's center (OPF's definitions add a hidden full-frame child, so nothing moves);
 * - a shape turned by `rot` is the largest-area rectangle at that rotation inside its constraint box, centered in it (so a turn of 0, 90,
 *   180 or 270 degrees keeps the box);
 * - `conn` with `begPts`/`endPts` `ctr`: a connector shape on the line from the source node's center to the destination's, from `begPad`
 *   after the source center to `endPad` before the destination's, `h` thick, turned to the line's angle;
 * - names of layout nodes and `forEach` elements are unique in the whole definition (PowerPoint rejects a definition that repeats one);
 * - `hideLastTrans="0"` keeps the last node's transition (a loop's closing arrow).
 *
 * Pure data and geometry: no Node built-ins, so it runs on the edge runtimes as the rest of core.
 */
import { cardNodes, cycleLoop, cycleRing, matrixQuadrants, pyramidSteps, type Arrangement, type ArrangementArrow, type ArrangementNode, rightArrowPoints } from './arrangements.js';
import { linearDesign, type LinearArrangement } from './linear-arrangements.js';

interface Box { x: number; y: number; width: number; height: number }

// ---------------------------------------------------------------------------------------------------------------------------------
// The definition: the subset of §21.4 OPF writes and the interpreter evaluates.

/** An algorithm (`dgm:alg`) and its parameters. */
export interface LayoutAlgorithm { type: 'composite' | 'tx' | 'sp' | 'conn' | 'snake'; params?: Readonly<Record<string, string>> }
/** A shape (`dgm:shape`): its DrawingML preset, turn in degrees, adjustments (shares of 100000) and whether its geometry is hidden. */
export interface LayoutShapeType { type: string; rot?: number; hideGeom?: boolean; adj?: readonly number[] }
/**
 * A constraint (`dgm:constr`): `for: 'ch'` with `forName` sets a child's value, otherwise the node's own; the value is `fact` times the
 * reference (`refType`: the root's `w` or `h`, or the font size), or `val` (millimeters for lengths, points for a font size).
 */
export interface LayoutConstraint {
  type: 'l' | 't' | 'w' | 'h' | 'begPad' | 'endPad' | 'primFontSz' | 'lMarg' | 'rMarg' | 'tMarg' | 'bMarg';
  for?: 'ch';
  forName?: string;
  refType?: 'w' | 'h' | 'primFontSz';
  fact?: number;
  val?: number;
  op?: 'equ';
}
/** What a layout node presents (`dgm:presOf`): the point of its `forEach` (`desOrSelf` of a node, `self` of a transition), or nothing. */
export interface LayoutPresOf { axis: 'desOrSelf' | 'self'; ptType?: 'node' }
export interface LayoutNodeDefinition {
  kind: 'layoutNode';
  name: string;
  styleLbl?: string;
  alg?: LayoutAlgorithm;
  shape?: LayoutShapeType;
  presOf?: LayoutPresOf;
  constraints?: readonly LayoutConstraint[];
  children?: readonly LayoutChild[];
}
/** `dgm:forEach` over the data model: the doc's child nodes (`ch`, from `st`, `cnt` of them), or the transition after a node (`followSib`). */
export interface LayoutForEach { kind: 'forEach'; name: string; axis: 'ch' | 'followSib'; ptType: 'node' | 'sibTrans'; st?: number; cnt?: number; hideLastTrans?: boolean; children: readonly LayoutChild[] }
/** One `dgm:if` (`when` the doc's child-node count equals `count`) or the `dgm:else` (no `when`): what it adds to the enclosing node. */
export interface LayoutBranch { name: string; count?: number; alg?: LayoutAlgorithm; shape?: LayoutShapeType; constraints?: readonly LayoutConstraint[]; children?: readonly LayoutChild[] }
export interface LayoutChoose { kind: 'choose'; name: string; branches: readonly LayoutBranch[] }
export type LayoutChild = LayoutNodeDefinition | LayoutForEach | LayoutChoose;
/** A layout definition: its identity (what PowerPoint shows in Change Layout) and its root layout node. */
export interface LayoutDefinition { uniqueId: string; title: string; description: string; category: string; root: LayoutNodeDefinition }

/** The style labels OPF's definitions use for text-only nodes (no fill, no line): on the slide (`revTx`) and on a filled shape (`fgAcc1`). */
export const TEXT_ONLY_LABELS: readonly string[] = Object.freeze(['revTx', 'fgAcc1']);
/** Millimeters per canvas pixel (1/96 inch): a constraint's absolute lengths are in millimeters. */
export const MM_PER_PX = 25.4 / 96;

// ---------------------------------------------------------------------------------------------------------------------------------
// Preset geometry.

/** The text rectangle of a DrawingML preset at `box` with its first adjustment (of 100000), as PowerPoint sets a node's text in it. */
export function presetTextRect(preset: string, box: Box, adjust?: number): Box {
  const { x, y, width: w, height: h } = box, ss = Math.min(w, h);
  if (preset === 'roundRect') {
    const inset = .29289 * ss * Math.min(50000, Math.max(0, adjust ?? 16667)) / 100000;
    return { x: x + inset, y: y + inset, width: w - 2 * inset, height: h - 2 * inset };
  }
  if (preset === 'ellipse') {
    const ix = (1 - Math.SQRT1_2) / 2;
    return { x: x + ix * w, y: y + ix * h, width: Math.SQRT1_2 * w, height: Math.SQRT1_2 * h };
  }
  if (preset === 'chevron') {
    const d = ss * Math.min(100000 * w / ss, Math.max(0, adjust ?? 50000)) / 100000, left = Math.min(d, w / 2);
    return { x: x + left, y, width: Math.max(0, w - 2 * left), height: h };
  }
  return { ...box };
}

/** The largest-area rectangle turned by `rotation` degrees that fits in `box`, centered in it (PowerPoint's rule for a turned shape). */
export function turnedShapeBox(box: Box, rotation: number): Box {
  const folded = ((rotation % 180) + 180) % 180, theta = folded * Math.PI / 180, c = Math.abs(Math.cos(theta)), s = Math.abs(Math.sin(theta));
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, W = box.width, H = box.height;
  const at = (w: number, h: number): Box => ({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });
  if (s < 1e-9) return { ...box };
  if (c < 1e-9) return at(H, W);
  const fits = (w: number, h: number) => w > 0 && h > 0 && w * c + h * s <= W + 1e-9 && w * s + h * c <= H + 1e-9;
  const candidates: [number, number][] = [[H / (2 * s), H / (2 * c)], [W / (2 * c), W / (2 * s)]];
  const det = c * c - s * s;
  if (Math.abs(det) > 1e-12) candidates.push([(W * c - H * s) / det, (H * c - W * s) / det]);
  let best: [number, number] = [0, 0];
  for (const [w, h] of candidates) if (fits(w, h) && w * h > best[0] * best[1]) best = [w, h];
  return at(best[0], best[1]);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The interpreter.

/** One shape the definition draws, in drawing order: its layout node, what it presents, its preset, box and turn. */
export interface LayoutShape {
  name: string;
  styleLbl?: string;
  /** The data-model point it presents: an entry (`node`) or the transition after one (`sibTrans`), 0-based; absent for a shape of the layout. */
  presents?: { type: 'node' | 'sibTrans'; index: number };
  preset: string;
  /** Unturned box, canvas pixels. */
  box: Box;
  rotation: number;
  adjust: readonly number[];
  hidden: boolean;
  /** A text-only node (TEXT_ONLY_LABELS): its box is the entry's text rectangle. */
  textOnly: boolean;
  /** The text insets (left, top, right, bottom) as shares of the font size, and the font size in points, of a node that presents an entry. */
  margins?: [number, number, number, number];
  fontSize?: number;
}

interface Instance { def: LayoutNodeDefinition; point?: { type: 'node' | 'sibTrans'; index: number } }

/** Collect a layout node's own content with its active `choose` branches, for a doc with `count` entries. */
function resolved(def: LayoutNodeDefinition, count: number) {
  let alg = def.alg, shape = def.shape;
  const constraints = [...(def.constraints ?? [])], children: LayoutChild[] = [];
  const visit = (items: readonly LayoutChild[]) => {
    for (const item of items) {
      if (item.kind !== 'choose') { children.push(item); continue; }
      const branch = item.branches.find(entry => entry.count === undefined || entry.count === count);
      if (!branch) continue;
      alg = branch.alg ?? alg; shape = branch.shape ?? shape;
      constraints.push(...(branch.constraints ?? []));
      visit(branch.children ?? []);
    }
  };
  visit(def.children ?? []);
  return { alg, shape, constraints, children };
}

/** The layout node instances of `children` in tree order, each with the point its `forEach` gives it. */
function instances(children: readonly LayoutChild[], count: number, point: Instance['point'], out: Instance[] = []): Instance[] {
  for (const child of children) {
    if (child.kind === 'layoutNode') { out.push({ def: child, ...(point ? { point } : {}) }); continue; }
    if (child.kind === 'choose') {
      const branch = child.branches.find(entry => entry.count === undefined || entry.count === count);
      if (branch?.children) instances(branch.children, count, point, out);
      continue;
    }
    if (child.axis === 'ch' && child.ptType === 'node') {
      const start = (child.st ?? 1) - 1, end = child.cnt ? Math.min(count, start + child.cnt) : count;
      for (let index = start; index < end; index++) instances(child.children, count, { type: 'node', index }, out);
    } else if (child.axis === 'followSib' && child.ptType === 'sibTrans' && point?.type === 'node') {
      // The transition after a node; the last node's only when hideLastTrans is off.
      if (point.index < count - 1 || child.hideLastTrans === false) instances(child.children, count, { type: 'sibTrans', index: point.index }, out);
    }
  }
  return out;
}

const valueOf = (constraint: LayoutConstraint, frame: Box, fontSize: number) => constraint.refType === 'w' ? (constraint.fact ?? 1) * frame.width
  : constraint.refType === 'h' ? (constraint.fact ?? 1) * frame.height : constraint.refType === 'primFontSz' ? (constraint.fact ?? 1) * fontSize
    : (constraint.val ?? 0) / MM_PER_PX;

/**
 * Evaluate a definition for a data model of `count` entries (each with its transition) in a frame (canvas pixels), as PowerPoint lays
 * it out: the shapes in drawing order. Throws on what OPF's definitions never use (another algorithm at the root, a child without a box,
 * a drawing that reaches outside its frame).
 */
export function evaluateLayoutDefinition(definition: LayoutDefinition, frame: Box, count: number): LayoutShape[] {
  const root = resolved(definition.root, count);
  if (root.alg?.type !== 'composite') throw new Error(`OPF's interpreter evaluates a composite root, not ${root.alg?.type ?? 'none'}`);
  const children = instances(root.children, count, undefined);
  const placed: { instance: Instance; own: ReturnType<typeof resolved>; box?: Box }[] = children.map(instance => ({ instance, own: resolved(instance.def, count) }));
  // The root's constraints on its children, by name.
  for (const entry of placed) {
    const value: Partial<Record<'l' | 't' | 'w' | 'h', number>> = {};
    for (const constraint of root.constraints) if (constraint.for === 'ch' && constraint.forName === entry.instance.def.name && ['l', 't', 'w', 'h'].includes(constraint.type))
      value[constraint.type as 'l' | 't' | 'w' | 'h'] = valueOf(constraint, frame, 0);
    if (entry.own.alg?.type === 'conn') continue;
    if (value.l === undefined || value.t === undefined || value.w === undefined || value.h === undefined) throw new Error(`layout node ${entry.instance.def.name} has no box`);
    entry.box = { x: frame.x + value.l, y: frame.y + value.t, width: value.w, height: value.h };
  }
  // PowerPoint moves a drawing whose bounds do not reach the frame's edges to the frame's center; one that reaches outside it is scaled.
  const boxes = placed.flatMap(entry => entry.box ? [entry.box] : []);
  if (boxes.length) {
    const x0 = Math.min(...boxes.map(b => b.x)), y0 = Math.min(...boxes.map(b => b.y)), x1 = Math.max(...boxes.map(b => b.x + b.width)), y1 = Math.max(...boxes.map(b => b.y + b.height));
    if (x0 < frame.x - 1e-6 || y0 < frame.y - 1e-6 || x1 > frame.x + frame.width + 1e-6 || y1 > frame.y + frame.height + 1e-6) throw new Error('the drawing reaches outside its frame');
    const dx = frame.x + (frame.width - (x1 - x0)) / 2 - x0, dy = frame.y + (frame.height - (y1 - y0)) / 2 - y0;
    if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) for (const entry of placed) if (entry.box) entry.box = { ...entry.box, x: entry.box.x + dx, y: entry.box.y + dy };
  }
  const byName = new Map(placed.map(entry => [entry.instance.def.name, entry]));
  const shapes: LayoutShape[] = [];
  for (const entry of placed) {
    const { def, point } = entry.instance, own = entry.own, shape = own.shape ?? { type: 'rect' };
    const fontConstraint = own.constraints.find(c => c.type === 'primFontSz') ?? root.constraints.find(c => c.type === 'primFontSz' && c.forName === def.name);
    const fontSize = fontConstraint?.val, presents = def.presOf && point ? point : undefined;
    let box: Box, rotation = shape.rot ?? 0;
    if (own.alg?.type === 'conn') {
      const params = own.alg.params ?? {}, source = byName.get(params.srcNode ?? ''), target = byName.get(params.dstNode ?? '');
      if (!source?.box || !target?.box || params.begPts !== 'ctr' || params.endPts !== 'ctr') throw new Error(`connector ${def.name} does not join two node centers`);
      const p = [source.box.x + source.box.width / 2, source.box.y + source.box.height / 2], q = [target.box.x + target.box.width / 2, target.box.y + target.box.height / 2];
      const length = Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!), ux = (q[0]! - p[0]!) / length, uy = (q[1]! - p[1]!) / length;
      const own1 = (type: LayoutConstraint['type']) => { const c = own.constraints.find(entry1 => entry1.type === type && !entry1.for); return c ? valueOf(c, frame, 0) : 0; };
      const start = own1('begPad'), drawn = length - start - own1('endPad'), thick = own1('h'), at = start + drawn / 2;
      box = { x: p[0]! + ux * at - drawn / 2, y: p[1]! + uy * at - thick / 2, width: drawn, height: thick };
      rotation = ((Math.atan2(uy, ux) * 180 / Math.PI) % 360 + 360) % 360;
    } else box = rotation ? turnedShapeBox(entry.box!, rotation) : entry.box!;
    const margin = (type: LayoutConstraint['type']) => own.constraints.find(c => c.type === type && c.refType === 'primFontSz')?.fact ?? 0;
    shapes.push({ name: def.name, ...(def.styleLbl ? { styleLbl: def.styleLbl } : {}), ...(presents ? { presents } : {}), preset: shape.type, box, rotation,
      adjust: shape.adj ?? [], hidden: shape.hideGeom === true, textOnly: TEXT_ONLY_LABELS.includes(def.styleLbl ?? ''),
      ...(presents?.type === 'node' ? { margins: [margin('lMarg'), margin('tMarg'), margin('rMarg'), margin('bMarg')] as [number, number, number, number] } : {}),
      ...(fontSize !== undefined ? { fontSize } : {}) });
  }
  return shapes;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const roundBox = (box: Box): Box => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });

/**
 * The interpreter's shapes as a composed arrangement's nodes and arrows (core ComposedArrangement): one node per entry (its shape, with
 * the shape's text rectangle, or a text-only node's box beside or over the shape before it), an arrow per transition shape, and a shape
 * of the layout before the first node as the background (a matrix's diamond). Hidden shapes are left out.
 */
export function layoutArrangement(shapes: readonly LayoutShape[]): { nodes: ArrangementNode[]; arrows: ArrangementArrow[]; background?: Box } {
  const nodes: ArrangementNode[] = [], arrows: ArrangementArrow[] = [];
  let background: Box | undefined, pending: LayoutShape | undefined;
  // A shape of the layout that no text-only node follows is the background (it comes before the first node).
  const settle = () => { if (pending && !nodes.length && !background) background = roundBox(pending.box); pending = undefined; };
  for (const shape of shapes) {
    if (shape.hidden) continue;
    if (shape.presents?.type === 'sibTrans') {
      const box = roundBox(shape.box), rotation = round(shape.rotation), adjust = [shape.adjust[0] ?? 50000, shape.adjust[1] ?? 50000] as const;
      arrows.push({ index: shape.presents.index, box, rotation, adjust, points: rightArrowPoints(box, rotation, adjust) });
      continue;
    }
    if (shape.presents?.type === 'node') {
      const index = shape.presents.index;
      if (shape.textOnly && pending) {
        // Text on the slide (revTx) beside its shape, or text over a shape in a rectangle other than the preset's own.
        nodes.push({ ...nodeOf(pending, index), textBox: roundBox(shape.box), ...(shape.styleLbl === 'revTx' ? { beside: true as const } : {}) });
        pending = undefined;
      } else { settle(); nodes.push(nodeOf(shape, index)); }
      continue;
    }
    settle();
    pending = shape;
  }
  settle();
  return { nodes, arrows, ...(background ? { background } : {}) };
}

function nodeOf(shape: LayoutShape, index: number): ArrangementNode {
  const preset = shape.preset as ArrangementNode['preset'], adjust = shape.adjust[0] ?? (preset === 'roundRect' ? 16667 : 0), box = roundBox(shape.box);
  const radius = preset === 'roundRect' ? round(Math.min(box.width, box.height) * adjust / 100000) : undefined;
  return { index, box, preset, adjust, ...(radius !== undefined ? { radius } : {}), textBox: roundBox(presetTextRect(preset, shape.box, adjust)) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The builder: a constraint table per node count.

/** One count's drawing in its frame (canvas pixels): composed nodes and arrows, and an optional background shape. */
/**
 * One count's drawing in its frame (canvas pixels): composed nodes and arrows, an optional background shape, and (the composed count)
 * where each entry's first line starts below its text rectangle's top, as a share of the font size: those entries' text is anchored at
 * the top at that inset, as OPF's composition sets it (PowerPoint's centering of a block of lines differs from OPF's by up to a pixel).
 */
export interface LayoutTable { nodes: readonly ArrangementNode[]; arrows?: readonly ArrangementArrow[]; background?: Box; textTops?: readonly (number | undefined)[] }
/** How a definition paints and sets its text: style labels, the text insets as shares of the font size, the font size in points. */
export interface LayoutStyle { node: string; text: 'node' | 'slide'; arrow?: string; margins: readonly [number, number, number, number]; fontSize: number }

const share = (value: number, of: number) => Number((value / of).toFixed(9));
const mm = (px: number) => Number((px * MM_PER_PX).toFixed(6));
const near = (a: Box, b: Box, tolerance = .01) => Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
const place = (name: string, box: Box, frame: Box): LayoutConstraint[] => [
  { type: 'l', for: 'ch', forName: name, refType: 'w', fact: share(box.x - frame.x, frame.width) }, { type: 't', for: 'ch', forName: name, refType: 'h', fact: share(box.y - frame.y, frame.height) },
  { type: 'w', for: 'ch', forName: name, refType: 'w', fact: share(box.width, frame.width) }, { type: 'h', for: 'ch', forName: name, refType: 'h', fact: share(box.height, frame.height) }];
/** The rotated bounding box of a box turned about its center (the constraint box of a turned `sp` shape). */
function turnedBounds(box: Box, rotation: number): Box {
  const theta = rotation * Math.PI / 180, c = Math.abs(Math.cos(theta)), s = Math.abs(Math.sin(theta)), w = box.width * c + box.height * s, h = box.width * s + box.height * c;
  return { x: box.x + box.width / 2 - w / 2, y: box.y + box.height / 2 - h / 2, width: w, height: h };
}

/**
 * A composite definition from one table per node count (1 to `max`; `table(k)` undefined leaves k to the `else` branch, a snake of
 * rounded rectangles). Returns the definition, or the reason a table cannot be one (an arrow neither axis-aligned nor on the line between
 * two node centers, two arrows after one node, a shape outside the frame). Layout node names carry the count (`n3_2`: node 2 of 3), as
 * PowerPoint needs every name unique.
 */
export function compositeLayoutDefinition(identity: Omit<LayoutDefinition, 'root'>, frame: Box, max: number, table: (count: number) => LayoutTable | undefined, style: LayoutStyle): LayoutDefinition | { reason: string } {
  const branches: LayoutBranch[] = [], primFontSz = Number(style.fontSize.toFixed(2));
  const margins = (['lMarg', 'tMarg', 'rMarg', 'bMarg'] as const).map((type, side) => ({ type, refType: 'primFontSz' as const, fact: Number(style.margins[side]!.toFixed(6)) }));
  const textLabel = style.text === 'slide' ? 'revTx' : 'fgAcc1';
  const branchOf = (k: number, t: LayoutTable, p: string, count?: number): LayoutBranch | { reason: string } => {
    if (t.nodes.length !== k) return { reason: `the design of ${k} entries has ${t.nodes.length} nodes` };
    const constraints: LayoutConstraint[] = [...place(`${p}bg${k}`, frame, frame)], children: LayoutChild[] = [];
    const inside = (box: Box) => box.x >= frame.x - .01 && box.y >= frame.y - .01 && box.x + box.width <= frame.x + frame.width + .01 && box.y + box.height <= frame.y + frame.height + .01;
    children.push({ kind: 'layoutNode', name: `${p}bg${k}`, styleLbl: 'bgShp', alg: { type: 'sp' }, shape: { type: 'rect', hideGeom: true } });
    if (t.background) {
      constraints.push(...place(`${p}d${k}`, t.background, frame));
      children.push({ kind: 'layoutNode', name: `${p}d${k}`, styleLbl: 'bgShp', alg: { type: 'sp' }, shape: { type: 'diamond' } });
    }
    for (const [i, node] of t.nodes.entries()) {
      if (!inside(node.box) || !inside(node.textBox)) return { reason: `node ${i + 1} of ${k} reaches outside the frame` };
      if (node.flip) return { reason: 'a mirrored shape (a chevron pointing left) has no form in a layout definition' };
      const name = `${p}n${k}_${i + 1}`, own = presetTextRect(node.preset, node.box, node.adjust), text = near(own, node.textBox) && !node.beside;
      const adjust = node.preset === 'roundRect' || node.preset === 'chevron' || node.preset === 'trapezoid' ? [node.adjust] : [];
      const inner: LayoutChild[] = [];
      const font = [{ type: 'primFontSz' as const, val: primFontSz, op: 'equ' as const }], top = t.textTops?.[i];
      const own1 = top === undefined ? margins : margins.map(margin => margin.type === 'tMarg' ? { ...margin, fact: Number(top.toFixed(6)) } : margin);
      const tx: LayoutAlgorithm = top === undefined ? { type: 'tx' } : { type: 'tx', params: { txAnchorVert: 't' } };
      if (text) {
        inner.push({ kind: 'layoutNode', name, styleLbl: style.node, alg: tx, shape: { type: node.preset, adj: adjust }, presOf: { axis: 'desOrSelf', ptType: 'node' }, constraints: [...font, ...own1] });
        constraints.push(...place(name, node.box, frame));
      } else {
        // The shape, then a text-only node at the entry's text rectangle (beside a level, or a rectangle other than the preset's own).
        inner.push({ kind: 'layoutNode', name, styleLbl: style.node, alg: { type: 'sp' }, shape: { type: node.preset, adj: adjust } },
          { kind: 'layoutNode', name: `${p}t${k}_${i + 1}`, styleLbl: node.beside ? 'revTx' : textLabel, alg: tx, shape: { type: 'rect' }, presOf: { axis: 'desOrSelf', ptType: 'node' }, constraints: [...font, ...own1] });
        constraints.push(...place(name, node.box, frame), ...place(`${p}t${k}_${i + 1}`, node.textBox, frame));
      }
      const after = (t.arrows ?? []).filter(arrow => arrow.index === i);
      if (after.length > 1) return { reason: `two arrows follow node ${i + 1} of ${k}` };
      const arrow = after[0];
      if (arrow) {
        const a = `${p}a${k}_${i + 1}`, quarter = Math.abs(arrow.rotation / 90 - Math.round(arrow.rotation / 90)) < 1e-6;
        let node1: LayoutNodeDefinition;
        if (quarter) {
          const bounds = turnedBounds(arrow.box, arrow.rotation);
          if (!inside(bounds)) return { reason: `the arrow after node ${i + 1} of ${k} reaches outside the frame` };
          constraints.push(...place(a, bounds, frame));
          node1 = { kind: 'layoutNode', name: a, styleLbl: style.arrow ?? 'sibTrans2D1', alg: { type: 'sp' }, shape: { type: 'rightArrow', ...(Math.round(arrow.rotation) % 360 ? { rot: Math.round(arrow.rotation) % 360 } : {}), adj: [...arrow.adjust] }, presOf: { axis: 'self' } };
        } else {
          // A turned arrow: a connector from this node's center to the next's, if it lies on that line.
          const next = t.nodes[(i + 1) % k]!, from = center(node.box), q = center(next.box), c = center(arrow.box), length = Math.hypot(q[0] - from[0], q[1] - from[1]);
          const ux = (q[0] - from[0]) / length, uy = (q[1] - from[1]) / length, along = (c[0] - from[0]) * ux + (c[1] - from[1]) * uy, off = Math.abs((c[0] - from[0]) * uy - (c[1] - from[1]) * ux);
          const angle = ((Math.atan2(uy, ux) * 180 / Math.PI) % 360 + 360) % 360, turn = ((arrow.rotation % 360) + 360) % 360;
          if (off > .01 || Math.abs(angle - turn) > .01) return { reason: `the arrow after node ${i + 1} of ${k} is not on the line between two node centers` };
          node1 = { kind: 'layoutNode', name: a, styleLbl: style.arrow ?? 'sibTrans2D1', alg: { type: 'conn', params: { dim: '2D', begPts: 'ctr', endPts: 'ctr', srcNode: name, dstNode: `${p}n${k}_${(i + 1) % k + 1}` } },
            shape: { type: 'rightArrow', adj: [...arrow.adjust] }, presOf: { axis: 'self' },
            constraints: [{ type: 'begPad', val: mm(along - arrow.box.width / 2) }, { type: 'endPad', val: mm(length - along - arrow.box.width / 2) }, { type: 'h', val: mm(arrow.box.height) }] };
        }
        inner.push({ kind: 'forEach', name: `${p}s${k}_${i + 1}`, axis: 'followSib', ptType: 'sibTrans', cnt: 1, ...(i === k - 1 ? { hideLastTrans: false } : {}), children: [node1] });
      }
      children.push({ kind: 'forEach', name: `${p}f${k}_${i + 1}`, axis: 'ch', ptType: 'node', st: i + 1, cnt: 1, children: inner });
    }
    return { name: count === undefined ? 'other' : `c${k}`, ...(count !== undefined ? { count } : {}), alg: { type: 'composite' }, constraints, children };
  };
  let last: [number, LayoutTable] | undefined;
  for (let k = 1; k <= max; k++) {
    const t = table(k);
    if (!t) continue;
    const branch = branchOf(k, t, '', k);
    if ('reason' in branch) return branch;
    branches.push(branch);
    last = [k, t];
  }
  // More entries than the tables cover (nodes added in PowerPoint): the largest table again, under its own names (PowerPoint rejects a
  // repeated name, and a forEach over every node in another branch).
  if (last) { const other = branchOf(last[0], last[1], 'x'); if (!('reason' in other)) branches.push(other); }
  return { ...identity, root: { kind: 'layoutNode', name: 'root', children: [{ kind: 'choose', name: 'byCount', branches }] } };
}
const center = (box: Box): [number, number] => [box.x + box.width / 2, box.y + box.height / 2];

// ---------------------------------------------------------------------------------------------------------------------------------
// OPF's designs, for any count: what a composed arrangement carries (ComposedArrangement.layout) so the export can write its design's
// table for every count of a definition (an entry added or deleted in PowerPoint keeps OPF's design).

/** OPF's designs that have a layout definition of their own. */
export const OPF_LAYOUT_DESIGNS = ['cycle-ring', 'cycle-loop', 'cycle-loop-3', 'pyramid-steps', 'matrix-quadrants', 'card-grid', 'chevron-rows', 'flow-rows', 'vertical-flow-columns'] as const;
export type OpfLayoutDesign = typeof OPF_LAYOUT_DESIGNS[number];
/** The inputs of one composed OPF design: its region, its gap and corner, its direction and (rows, columns, compact, `need`) its shape. */
export interface OpfLayoutRecipe {
  design: OpfLayoutDesign;
  area: Box;
  gap: number;
  radius?: number;
  rtl?: boolean;
  /** A card grid's columns, or a linear design's rows (columns of a vertical flow). */
  columns?: number;
  lines?: number;
  compact?: boolean;
  /** A linear design's text height (linearDesign `need`). */
  need?: number;
}
/** The most entries a definition's tables cover (ARRANGEMENT_MAX and ARRANGEMENT_CARDS_MAX). */
export const OPF_LAYOUT_MAX = 8;

/** OPF's design of `recipe` for `count` entries, as composition draws it (undefined where the design cannot hold that many). */
export function opfLayoutGeometry(recipe: OpfLayoutRecipe, count: number): LayoutTable | undefined {
  const { area, gap, rtl = false } = recipe, radius = recipe.radius ?? 0;
  const grid = (k: number, columns: number) => ({ nodes: cardNodes(area, k, Math.max(1, Math.min(columns, k)), gap, radius) });
  switch (recipe.design) {
    case 'cycle-ring': return cycleRing(area, count, gap, rtl);
    case 'cycle-loop': case 'cycle-loop-3': return cycleLoop(area, count, gap, rtl, recipe.design === 'cycle-loop-3' ? 3 : 2) ?? cycleRing(area, count, gap, rtl);
    case 'pyramid-steps': return { nodes: pyramidSteps(area, count, gap, radius) };
    case 'matrix-quadrants': return count === 4 ? { nodes: matrixQuadrants(area, gap) } : grid(count, Math.ceil(Math.sqrt(count)));
    case 'card-grid': return grid(count, recipe.columns ?? Math.ceil(Math.sqrt(count)));
    default: {
      const kind: LinearArrangement = recipe.design === 'chevron-rows' ? 'chevrons' : recipe.design === 'flow-rows' ? 'flow' : 'vertical-flow';
      return linearDesign(kind, area, count, gap, rtl, Math.min(recipe.lines ?? 1, count), recipe.need, recipe.compact === true)
        ?? linearDesign(kind, area, count, gap, rtl, 1, recipe.need, recipe.compact === true);
    }
  }
}

/** The arrangement each of OPF's designs draws. */
export const OPF_LAYOUT_KIND: Readonly<Record<OpfLayoutDesign, Arrangement>> = Object.freeze({
  'cycle-ring': 'cycle', 'cycle-loop': 'cycle', 'cycle-loop-3': 'cycle', 'pyramid-steps': 'pyramid', 'matrix-quadrants': 'matrix', 'card-grid': 'matrix',
  'chevron-rows': 'chevrons', 'flow-rows': 'flow', 'vertical-flow-columns': 'vertical-flow',
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The domain: where PowerPoint draws OPF's definitions as the preview does (the SH-19 COM sweep, docs/smartart.md).

/**
 * SH-19's safe domain for OPF's own layout definitions, from the PowerPoint COM sweep (docs/smartart.md): the instances for which PowerPoint
 * laid every node out within 0.1 pt of the composed design (it did for all 310 live instances), at OPF's size, and drew the SmartArt as it
 * draws OPF's native export of the same slide (SH-07's gate). An instance outside it is exported as native shapes with the reason.
 */
export const SMART_ART_OPF_DOMAIN = Object.freeze({
  /**
   * The entries per design that passed (a design or a count the sweep did not pass stays native shapes): OPF's ring and loops of a cycle,
   * its quadrants and the compact rows held their entries only at a text density above the limit below.
   */
  count: Object.freeze({ 'pyramid-steps': [1, 8], 'card-grid': [1, 6], 'chevron-rows': [6, 8], 'flow-rows': [6, 8], 'vertical-flow-columns': [5, 6] }) as Readonly<Partial<Record<OpfLayoutDesign, readonly [number, number]>>>,
  /** The most lines one entry may wrap to (every entry that passed had one or two). */
  lines: 2,
  /**
   * The most of the frame the entries' text may cover (each line's width times the size, over the frame's area): PowerPoint sets the lines
   * of a SmartArt up to a pixel from where it sets OPF's native lines, which a frame dense with text shows above SH-07's mean-difference
   * gate (every instance at 0.075 or less passed; above it some did not).
   */
  ink: .075,
});

/** The facts of one composed OPF design the domain is checked on (ComposedArrangement.layout and .smartArt). */
export interface OpfSmartArtCandidate {
  design: OpfLayoutDesign;
  compact?: boolean;
  count: number;
  lines: readonly number[];
  /** Whether each entry's line breaks hold within SMART_ART_DOMAIN.slack of its width. */
  stable?: readonly boolean[];
  ink?: number;
  rtl: boolean;
  script?: 'cjk' | 'other';
}

/** Whether PowerPoint draws an OPF design's layout definition as the preview does: undefined when it does, else the reason. */
export function opfSmartArtUnavailable(candidate: OpfSmartArtCandidate): string | undefined {
  const domain = SMART_ART_OPF_DOMAIN, range = candidate.compact ? undefined : domain.count[candidate.design];
  if (!range) return `OPF's ${candidate.compact ? 'compact ' : ''}${candidate.design} layout did not pass PowerPoint's comparison`;
  if (candidate.count < range[0] || candidate.count > range[1]) return `OPF's ${candidate.design} layout passed PowerPoint's comparison for ${range[0]} to ${range[1]} entries, not ${candidate.count}`;
  if (candidate.rtl) return "right-to-left text sits off center in PowerPoint's SmartArt";
  if (candidate.script === 'cjk') return "Chinese and Japanese text sits several pixels off in PowerPoint's SmartArt";
  if (candidate.script === 'other') return 'its text uses a script the PowerPoint comparison did not cover';
  const index = candidate.lines.findIndex(lines => lines > domain.lines);
  if (index >= 0) return `entry ${index + 1} wraps to ${candidate.lines[index]} lines (at most ${domain.lines} matched PowerPoint)`;
  const unstable = candidate.stable?.findIndex(stable => !stable) ?? -1;
  if (unstable >= 0) return `entry ${unstable + 1} wraps too close to its node's width for PowerPoint to break the same lines`;
  if (candidate.ink !== undefined && candidate.ink > domain.ink + 1e-6) return `its text covers ${Math.round(candidate.ink * 100)}% of the frame (at most ${domain.ink * 100}% matched PowerPoint's text placement)`;
  return undefined;
}
