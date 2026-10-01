// Content topology (spec-gap closure P1): the structure of a slide's content
// survives a PPTX round trip through the OPF_SLIDE_V1 record.
//
// PowerPoint has no native counterpart for OPF's content structure: nested
// groups, promoted regions (`left`, `top:left` ...), a root payload (`text`,
// `items` ...) versus `blocks`, block ids, block extensions and group
// composition. Import rebuilds flat blocks from the native shapes in reading
// order. The topology record stores the structure and the reference-pixel box
// of every leaf, taken from the same `composeSlide` geometry the exporter draws
// from. Import matches each imported block to the smallest stored leaf whose
// box contains the block's native bounds and rebuilds the authored form. The
// record holds ids, extensions, composition and boxes only: never text, images
// or payload values, which the native shapes supply.
//
// Record (stored as `content` in OPF_SLIDE_V1, `full` mode only):
//
//   Topology = {form: 'root', field, box?}                 // one root payload on the slide
//            | {form: 'root', fields: [{field, box?}]}     // root shorthand with several payloads
//            | {form: 'blocks', blocks: Node[]}
//            | {form: 'regions', regions: {[key]: Node}}   // key = promoted region key
//   Node     = {t: 'group', id?, ext?, comp?, typed?, blocks: Node[]}
//            | {t: 'leaf', k, id?, ext?, typed?, box?, lines?}   // box = [x, y, w, h] reference px, 1 decimal
//   typed = true when the authored block spelled out its `type`
//   lines = N (>= 2) when a rich-text `text` payload exported as N native line
//           shapes that are soft wraps of one paragraph (no hard break between
//           them); import joins those N imported lines back into the one payload
//
// Native line shapes of rich text carry no names or tags, so the soft wraps are
// recorded here as a count; a wrapped payload with any hard break is not marked.
//
// Tags are untrusted input: every field is type-, count- and depth-checked
// before use, and the rebuilt slide still has to validate with the document.

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export const CONTENT_KINDS = Object.freeze(['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline']);
export const ROOT_PAYLOAD_FIELDS = Object.freeze(['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline']);
const HORIZONTAL = ['left', 'center', 'right', 'left+center', 'center+right', 'left+center+right'];
const VERTICAL = ['top', 'middle', 'bottom', 'top+middle', 'middle+bottom', 'top+middle+bottom'];
export const REGION_KEYS = Object.freeze([...HORIZONTAL, ...VERTICAL, ...VERTICAL.flatMap(row => HORIZONTAL.map(column => `${row}:${column}`))]);
const REGION_KEY_PATTERN = /^[a-z]+(\+[a-z]+)*(:[a-z]+(\+[a-z]+)*)?$/;
const REGION_KEY_SET = new Set(REGION_KEYS);
// Groups nest at most this deep (a leaf inside three groups). Deeper structures
// are valid OPF but are not stored; the slide then imports as flat blocks.
export const MAX_GROUP_DEPTH = 3;
export const MAX_NODES = 256;
// Ids are any schema string up to this length (the empty string included); a
// longer id leaves the slide's topology unstored, and import rejects it the same way.
export const MAX_ID_LENGTH = 256;
// Native bounds may sit this far outside a stored leaf box (reference px).
export const BOX_TOLERANCE = 3;

const kindOfField = field => field === 'items' || field === 'bullets' ? 'list' : field;
const isGroup = block => object(block) && (block.type === 'group' || (block.type === undefined && Array.isArray(block.blocks)));
const round1 = value => Math.round(value * 10) / 10;
export const MAX_WRAPPED_LINES = 1000;

/**
 * The number of native line shapes a rich-text `text` item exported as, when
 * those lines are consecutive soft wraps of the authored runs: the line
 * fragments, concatenated in order, are exactly the concatenated run text, so
 * no line boundary stands for a hard break (a newline, a blank line, collapsed
 * or dropped characters). Undefined for a single line or when that cannot be
 * shown: nothing then marks the leaf and import keeps the separate blocks.
 */
export function softWrappedLines(item) {
  const lines = item?.text?.richLines;
  if (item?.field !== 'text' || !Array.isArray(lines) || lines.length < 2 || lines.length > MAX_WRAPPED_LINES) return undefined;
  const runs = Array.isArray(item.value) ? item.value : typeof item.value === 'string' ? [item.value] : null;
  if (!runs) return undefined;
  let source = '';
  for (const run of runs) {
    const text = typeof run === 'string' ? run : object(run) ? run.text : undefined;
    if (typeof text !== 'string') return undefined;
    source += text;
  }
  let position = 0;
  for (const line of lines) {
    if (!Array.isArray(line?.fragments) || !line.fragments.length) return undefined;
    for (const fragment of line.fragments) {
      if (typeof fragment?.text !== 'string' || !source.startsWith(fragment.text, position)) return undefined;
      position += fragment.text.length;
    }
  }
  return position === source.length ? lines.length : undefined;
}

function blockKind(block) {
  if (typeof block.type === 'string' && block.type !== 'group') return CONTENT_KINDS.includes(block.type) ? block.type : null;
  for (const field of ROOT_PAYLOAD_FIELDS) if (block[field] !== undefined) return kindOfField(field);
  return null;
}

// ---------------------------------------------------------------------------
// Export

/**
 * The topology of `slide`'s content with leaf boxes from `items` (the
 * `composeSlide` geometry items of that slide). Returns undefined when the
 * slide has no content, or when its structure cannot be represented (an
 * unknown payload, groups nested deeper than MAX_GROUP_DEPTH, too many nodes);
 * `report(reason)` then names why.
 */
export function contentTopology(slide, items, slideIndex, report = () => {}) {
  if (!object(slide)) return undefined;
  const boxes = new Map(), wrapped = new Map();
  for (const item of items ?? []) if (typeof item?.path === 'string' && object(item.box)) {
    boxes.set(item.path, item.box);
    const lines = softWrappedLines(item);
    if (lines) wrapped.set(item.path, lines);
  }
  const base = `slides.${slideIndex}`;
  let nodes = 0;
  const fail = reason => { throw new TopologyError(reason); };
  const leafBox = path => {
    for (const field of ROOT_PAYLOAD_FIELDS) {
      const box = boxes.get(`${path}.${field}`);
      if (box) return [box.x, box.y, box.width, box.height].map(round1);
    }
    return undefined;
  };
  const identity = (block, node, path) => {
    if (typeof block.id === 'string') {
      if (block.id.length > MAX_ID_LENGTH) fail(`${path}.id is longer than ${MAX_ID_LENGTH} characters`);
      node.id = block.id;
    }
    if (object(block.extensions)) node.ext = clone(block.extensions);
    if (typeof block.type === 'string') node.typed = true;
    return node;
  };
  const node = (block, path, depth) => {
    if (!object(block)) fail(`${path} is not a content block`);
    if (++nodes > MAX_NODES) fail(`the slide has more than ${MAX_NODES} content nodes`);
    if (isGroup(block)) {
      if (depth >= MAX_GROUP_DEPTH) fail(`groups nest deeper than ${MAX_GROUP_DEPTH} levels`);
      const group = identity(block, {t: 'group'}, path);
      if (object(block.composition)) group.comp = clone(block.composition);
      group.blocks = (Array.isArray(block.blocks) ? block.blocks : []).map((child, index) => node(child, `${path}.blocks.${index}`, depth + 1));
      return group;
    }
    const kind = blockKind(block);
    if (!kind) fail(`${path} has no known content payload`);
    const leaf = identity(block, {t: 'leaf', k: kind}, path);
    const box = leafBox(path);
    if (box) leaf.box = box;
    if (kind === 'text' && wrapped.has(`${path}.text`)) leaf.lines = wrapped.get(`${path}.text`);
    return leaf;
  };
  try {
    // Core precedence: promoted regions win over blocks, blocks over a root payload.
    const regionKeys = Object.keys(slide).filter(key => REGION_KEY_SET.has(key) && object(slide[key]));
    if (regionKeys.length) return {form: 'regions', regions: Object.fromEntries(regionKeys.map(key => [key, node(slide[key], `${base}.${key}`, 0)]))};
    if (Array.isArray(slide.blocks)) {
      if (!slide.blocks.length) return undefined;
      return {form: 'blocks', blocks: slide.blocks.map((block, index) => node(block, `${base}.blocks.${index}`, 0))};
    }
    // Root shorthand: one payload is the common case; several payload fields
    // on one slide compose as one item each (`slides.N.<field>`).
    const fields = ROOT_PAYLOAD_FIELDS.filter(name => slide[name] !== undefined).map(field => {
      const box = boxes.get(`${base}.${field}`);
      const lines = field === 'text' ? wrapped.get(`${base}.text`) : undefined;
      return box ? {field, box: [box.x, box.y, box.width, box.height].map(round1), ...(lines ? {lines} : {})} : {field};
    });
    if (!fields.length) return undefined;
    if (fields.length === 1) return {form: 'root', ...fields[0]};
    return {form: 'root', fields};
  } catch (error) {
    if (!(error instanceof TopologyError)) throw error;
    report(error.message);
    return undefined;
  }
}

class TopologyError extends Error {}

// ---------------------------------------------------------------------------
// Import: validation

const validBox = value => value === undefined || (Array.isArray(value) && value.length === 4 && value.every(number => typeof number === 'number' && Number.isFinite(number) && Math.abs(number) < 1e7));
const validId = value => value === undefined || (typeof value === 'string' && value.length <= MAX_ID_LENGTH);
const validLines = value => value === undefined || (Number.isSafeInteger(value) && value >= 2 && value <= MAX_WRAPPED_LINES);
const validField = value => object(value) && ROOT_PAYLOAD_FIELDS.includes(value.field) && validBox(value.box) && validLines(value.lines) && (value.lines === undefined || value.field === 'text');
/** The root payload leaves of a root-form record: [{field, box?}]. */
export const rootFields = topology => topology.fields ?? [{field: topology.field, box: topology.box, lines: topology.lines}];

/** Throws when `value` is not a well-formed topology record. Returns it otherwise. */
export function validateTopology(value) {
  if (!object(value)) throw Error('Invalid content topology.');
  let nodes = 0;
  const node = (item, depth) => {
    if (!object(item)) throw Error('Invalid content node.');
    if (++nodes > MAX_NODES) throw Error(`Content topology has more than ${MAX_NODES} nodes.`);
    if (!validId(item.id)) throw Error('Invalid content node id.');
    if (item.ext !== undefined && !object(item.ext)) throw Error('Invalid content node extensions.');
    if (item.typed !== undefined && item.typed !== true) throw Error('Invalid content node type flag.');
    if (item.t === 'group') {
      if (depth >= MAX_GROUP_DEPTH) throw Error(`Content groups nest deeper than ${MAX_GROUP_DEPTH} levels.`);
      if (item.comp !== undefined && !object(item.comp)) throw Error('Invalid group composition.');
      if (!Array.isArray(item.blocks)) throw Error('Invalid group blocks.');
      for (const child of item.blocks) node(child, depth + 1);
      return;
    }
    if (item.t !== 'leaf') throw Error('Unknown content node type.');
    if (!CONTENT_KINDS.includes(item.k)) throw Error('Unknown content kind.');
    if (item.comp !== undefined) throw Error('A content leaf has no composition.');
    if (!validBox(item.box)) throw Error('Invalid content box.');
    if (!validLines(item.lines) || (item.lines !== undefined && item.k !== 'text')) throw Error('Invalid wrapped line count.');
  };
  switch (value.form) {
    case 'root': {
      if (value.fields !== undefined) {
        if (value.field !== undefined || value.box !== undefined) throw Error('Invalid root payload record.');
        if (!Array.isArray(value.fields) || !value.fields.length || value.fields.length > ROOT_PAYLOAD_FIELDS.length || !value.fields.every(validField)) throw Error('Invalid root payload fields.');
        if (new Set(value.fields.map(item => item.field)).size !== value.fields.length) throw Error('Repeated root payload field.');
        return value;
      }
      if (!ROOT_PAYLOAD_FIELDS.includes(value.field)) throw Error('Unknown root payload field.');
      if (!validBox(value.box)) throw Error('Invalid content box.');
      if (!validLines(value.lines) || (value.lines !== undefined && value.field !== 'text')) throw Error('Invalid wrapped line count.');
      return value;
    }
    case 'blocks':
      if (!Array.isArray(value.blocks) || !value.blocks.length) throw Error('Invalid content blocks.');
      for (const child of value.blocks) node(child, 0);
      return value;
    case 'regions': {
      if (!object(value.regions)) throw Error('Invalid content regions.');
      const keys = Object.keys(value.regions);
      if (!keys.length || keys.length > REGION_KEYS.length) throw Error('Invalid content regions.');
      for (const key of keys) {
        if (!REGION_KEY_PATTERN.test(key) || !REGION_KEY_SET.has(key)) throw Error(`Unknown region key ${key}.`);
        node(value.regions[key], 0);
      }
      return value;
    }
    default:
      throw Error('Unknown content form.');
  }
}

// ---------------------------------------------------------------------------
// Import: rebuild

const compatible = (leafKind, kind) => leafKind === kind || (['text', 'list'].includes(leafKind) && ['text', 'list'].includes(kind));
const containsOrigin = (box, bounds) => bounds.x >= box[0] - BOX_TOLERANCE && bounds.y >= box[1] - BOX_TOLERANCE
  && bounds.x <= box[0] + box[2] + BOX_TOLERANCE && bounds.y <= box[1] + box[3] + BOX_TOLERANCE;
const contains = (box, bounds) => containsOrigin(box, bounds)
  && bounds.x + bounds.width <= box[0] + box[2] + BOX_TOLERANCE && bounds.y + bounds.height <= box[1] + box[3] + BOX_TOLERANCE;

const textRuns = value => typeof value === 'string' || (Array.isArray(value) && value.length > 0 && value.every(run => object(run) && typeof run.text === 'string'));
const sameRunStyle = (a, b) => JSON.stringify({...a, text: ''}) === JSON.stringify({...b, text: ''});
// The lines' text joined in order. Runs are never invented or dropped; at a seam the
// last run of one line and the first of the next merge when they differ only in text
// (a run the wrap cut in two), the same way a rejoined list does.
function joinWrappedText(parts) {
  if (parts.every(part => typeof part === 'string')) return parts.join('');
  const joined = [];
  for (const part of parts) {
    const runs = typeof part === 'string' ? [{text: part}] : part;
    runs.forEach((run, position) => {
      const last = joined.at(-1);
      if (position === 0 && last && sameRunStyle(last, run)) last.text += run.text;
      else joined.push({...run});
    });
  }
  return joined;
}

/**
 * Rebuild the authored content form from the imported flat `blocks` and their
 * native `bounds` (reference px, one entry per block, null when unknown).
 * Returns {fields} (slide properties to set: root field, `blocks` or region
 * keys; a `null` value removes the property) and the restored block ids, or
 * {reason} when a block matches no leaf or several blocks land on one leaf.
 * Leaves with no block are dropped: empty payloads export nothing.
 */
export function rebuildContent(topology, blocks, bounds) {
  if (!Array.isArray(blocks) || !Array.isArray(bounds) || blocks.length !== bounds.length) return {reason: 'the imported blocks carry no native bounds'};
  const leaves = [];
  const collect = item => {
    if (item.t === 'group') { for (const child of item.blocks) collect(child); return; }
    leaves.push({node: item, kind: item.k, box: item.box, matches: []});
  };
  if (topology.form === 'root') for (const item of rootFields(topology)) leaves.push({node: item, field: item.field, kind: kindOfField(item.field), box: item.box, matches: []});
  else if (topology.form === 'blocks') topology.blocks.forEach(collect);
  else Object.values(topology.regions).forEach(collect);
  const kindOf = block => blockKind(block) ?? 'text';
  for (const [index, block] of blocks.entries()) {
    const native = bounds[index];
    if (!object(native)) return {reason: `block ${index} has no native bounds`};
    const kind = kindOf(block);
    const smallest = (a, b) => (a.box[2] * a.box[3]) - (b.box[2] * b.box[3]) || (a.kind === kind ? -1 : 0) - (b.kind === kind ? -1 : 0);
    let candidates = leaves.filter(leaf => leaf.box && compatible(leaf.kind, kind) && contains(leaf.box, native)).sort(smallest);
    // Overflowing content (overflow: 'warn') runs past its box: the lines of a
    // long list or timeline still start inside it, so the origin decides.
    if (!candidates.length) candidates = leaves.filter(leaf => leaf.box && compatible(leaf.kind, kind) && containsOrigin(leaf.box, native)).sort(smallest);
    if (!candidates.length) return {reason: `block ${index} (${kind}) lies in no stored content box`};
    candidates[0].matches.push(index);
  }
  for (const leaf of leaves) {
    if (leaf.matches.length <= 1) continue;
    // A list's native lines can arrive as several bullet blocks when another
    // object interleaves with them in reading order; they rejoin their list.
    if (leaf.kind === 'list' && leaf.matches.every(index => blocks[index]?.type === 'list' && Array.isArray(blocks[index].items))) {
      const merged = {...blocks[leaf.matches[0]], items: leaf.matches.flatMap(index => blocks[index].items)};
      leaf.matches = [leaf.matches[0]];
      leaf.payload = merged;
      continue;
    }
    // Rich text that wrapped exports one native line shape per soft wrap and
    // imports as one text block per line. The record counted those lines at
    // export (see softWrappedLines) and the slide's shapes are unchanged since
    // (the structure hash was checked before this rebuild), so exactly that many
    // text blocks in the leaf are its consecutive lines: they rejoin in reading
    // order, with no separator, because a soft wrap deletes no characters.
    if (leaf.kind === 'text' && leaf.node.lines === leaf.matches.length && leaf.matches.every(index => blocks[index]?.type === 'text' && textRuns(blocks[index].text))) {
      const ordered = leaf.matches.map((index, position) => ({index, y: bounds[index].y, position})).sort((a, b) => a.y - b.y || a.position - b.position).map(entry => entry.index);
      leaf.payload = {...blocks[ordered[0]], text: joinWrappedText(ordered.map(index => blocks[index].text))};
      leaf.matches = [ordered[0]];
      continue;
    }
    return {reason: `${leaf.matches.length} blocks lie in one stored content box`};
  }
  const ids = [];
  const payloadOf = leaf => {
    if (!leaf.matches.length) return undefined;
    const payload = clone(leaf.payload ?? blocks[leaf.matches[0]]);
    // The imported block always names its type; the authored one may have left it implicit.
    if (!leaf.node.typed) delete payload.type;
    if (leaf.node.id !== undefined) { payload.id = leaf.node.id; ids.push(leaf.node.id); }
    if (leaf.node.ext !== undefined) payload.extensions = clone(leaf.node.ext);
    return payload;
  };
  const build = item => {
    if (item.t !== 'group') {
      const leaf = leaves.find(entry => entry.node === item);
      return leaf ? payloadOf(leaf) : undefined;
    }
    const children = item.blocks.map(build).filter(Boolean);
    if (!children.length) return undefined;
    const group = item.typed ? {type: 'group'} : {};
    if (item.id !== undefined) { group.id = item.id; ids.push(item.id); }
    if (item.ext !== undefined) group.extensions = clone(item.ext);
    if (item.comp !== undefined) group.composition = clone(item.comp);
    group.blocks = children;
    return group;
  };
  const fields = {blocks: null};
  if (topology.form === 'root') {
    for (const leaf of leaves) {
      const payload = payloadOf(leaf);
      if (payload === undefined) continue;
      // The slide `type` is restored separately; the imported block names any
      // list by `items`, so an authored `bullets` payload takes its key back.
      const {type: _type, ...rest} = payload;
      if (leaf.field === 'bullets' && rest.items !== undefined && rest.bullets === undefined) { rest.bullets = rest.items; delete rest.items; }
      Object.assign(fields, rest);
    }
    return {fields, ids};
  }
  if (topology.form === 'blocks') {
    const rebuilt = topology.blocks.map(build).filter(Boolean);
    if (rebuilt.length) fields.blocks = rebuilt;
    return {fields, ids};
  }
  for (const [key, item] of Object.entries(topology.regions)) {
    const host = build(item);
    if (host !== undefined) fields[key] = host;
  }
  return {fields, ids};
}
