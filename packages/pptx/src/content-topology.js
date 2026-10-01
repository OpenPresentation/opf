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
//            | {t: 'leaf', k, id?, ext?, typed?, bullets?, box?, lines?, wrap?}   // box = [x, y, w, h] reference px, 1 decimal
//   typed = true when the authored block spelled out its `type`
//   bullets = true when the authored list block used the `bullets` key (import names every list `items`), also under `type: 'text'`
//   lines = N (>= 2) when a rich-text `text` payload exported as N native line
//           shapes that are soft wraps of one paragraph (no hard break between
//           them); import joins those N imported lines back into the one payload
//   wrap  = {lines: N, gaps} instead of `lines` when any line break was a hard
//           break (RR-09; an importer before RR-09 ignores `wrap` and keeps the
//           flat blocks rather than join lines without their separators). The
//           N native line shapes rebuild the authored runs exactly once joined
//           with gaps, the N - 1 separators between them: '' for a soft wrap
//           (nothing deleted), otherwise the whitespace the break held ("\n",
//           "\r\n", "\n\n" for a blank line, trimmed spaces); [whitespace, k]
//           when the first k characters end the previous line's last run (the
//           rest start the next one)
//
// Native line shapes of rich text carry no names or tags, so the lines are
// recorded here as a count and the separators as whitespace only: never a word.
// A payload whose runs cannot be shown to rebuild from the lines and separators
// exactly is not marked, and import keeps the flat blocks and its diagnostic.
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
// A break between two native lines holds only spaces, tabs and line endings: never words.
export const MAX_GAP_LENGTH = 256;
const GAP_CHARACTER = /^[ \t\r\n]$/;
const GAP_TEXT = /^[ \t\r\n]*$/;

const styleKey = run => JSON.stringify(Object.keys(run).filter(key => key !== 'text').sort().map(key => [key, run[key]]));
const sameRunStyle = (a, b) => styleKey(a) === styleKey(b);
// Adjacent runs that differ only in text are one run: a wrap or a break cut them apart, nothing else did.
function normalizeRuns(runs) {
  const merged = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = merged.at(-1);
    if (last && sameRunStyle(last, run)) last.text += run.text;
    else merged.push({...run});
  }
  return merged;
}
const gapParts = gap => Array.isArray(gap) ? {text: gap[0], keep: gap[1]} : {text: gap ?? '', keep: 0};

/**
 * The lines' text joined in order. `gaps[i]` is what separates line i from line
 * i + 1: '' for a soft wrap, the whitespace a hard break held otherwise. A gap
 * is a string (it starts the next line's first run) or [text, keep] (its first
 * `keep` characters end the previous line's last run). Runs are never invented
 * or dropped; at a seam the last run of one line and the first of the next
 * merge when they differ only in text (a run the wrap cut in two), the same
 * way a rejoined list does.
 */
export function joinWrappedText(parts, gaps = []) {
  if (parts.every(part => typeof part === 'string')) return parts.reduce((text, part, index) => text + (index ? gapParts(gaps[index - 1]).text : '') + part, '');
  const joined = [];
  parts.forEach((part, index) => {
    const runs = (typeof part === 'string' ? [{text: part}] : part).map(run => ({...run}));
    if (index) {
      const {text, keep} = gapParts(gaps[index - 1]);
      const last = joined.at(-1);
      if (last && keep) last.text += text.slice(0, keep);
      if (text.length > keep && runs.length) runs[0].text = text.slice(keep) + runs[0].text;
    }
    runs.forEach((run, position) => {
      const last = joined.at(-1);
      if (position === 0 && last && sameRunStyle(last, run)) last.text += run.text;
      else joined.push(run);
    });
  });
  return joined;
}

/**
 * Walk the native line fragments of `value` (a string or authored runs): the character range each non-empty line covers
 * and the whitespace each break deleted. Undefined when the lines do not account for the source exactly (leading or
 * trailing whitespace outside the lines, dropped or changed characters, fragments of one line not contiguous, a break
 * that is not whitespace or is too long). `gaps` is the separator list that rebuilds the authored runs from the lines
 * (plain strings, or split [text, keep] entries when a break straddles two styles) and is undefined when no form of it
 * can be shown to; `breaks` are the plain whitespace strings. `indexes` are the positions in `lines` of the non-empty ones.
 */
function analyzeLines(value, lines) {
  if (!Array.isArray(lines) || lines.length > MAX_WRAPPED_LINES) return undefined;
  const authored = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null;
  if (!authored) return undefined;
  const runs = [];
  for (const run of authored) {
    const text = typeof run === 'string' ? run : object(run) ? run.text : undefined;
    if (typeof text !== 'string') return undefined;
    runs.push(typeof run === 'string' ? {text} : run);
  }
  const source = runs.map(run => run.text).join('');
  let position = 0;
  const spans = [], breaks = [], indexes = [];
  for (const [lineIndex, line] of lines.entries()) {
    if (!Array.isArray(line?.fragments)) return undefined;
    if (!line.fragments.length) continue;
    const span = {start: position, end: position};
    for (const [index, fragment] of line.fragments.entries()) {
      const text = fragment?.text;
      if (typeof text !== 'string' || !text) return undefined;
      let at = position;
      // The first fragment of a line after the first may follow whitespace the break deleted.
      if (index === 0 && spans.length) {
        while (!source.startsWith(text, at)) {
          if (at - position >= MAX_GAP_LENGTH || !GAP_CHARACTER.test(source[at] ?? '')) return undefined;
          at += 1;
        }
        breaks.push(source.slice(position, at));
      } else if (!source.startsWith(text, at)) return undefined;
      if (index === 0) span.start = at;
      position = at + text.length;
    }
    span.end = position;
    spans.push(span);
    indexes.push(lineIndex);
  }
  if (!spans.length || spans[0].start !== 0 || position !== source.length) return undefined;
  // The offset at which each authored run starts.
  const starts = [];
  let offset = 0;
  for (const run of runs) { starts.push(offset); offset += run.text.length; }
  // The leading part of a break that the previous line's last run (and any run after it of the same style) holds.
  const kept = breaks.map((text, index) => {
    const from = spans[index].end, to = from + text.length;
    const owner = starts.findLastIndex((start, run) => start < from && runs[run].text);
    let keep = 0;
    for (let run = owner; run >= 0 && run < runs.length && starts[run] < to; run += 1) {
      if (run !== owner && runs[run].text && !sameRunStyle(runs[run], runs[owner])) break;
      keep = Math.max(0, Math.min(text.length, starts[run] + runs[run].text.length - from));
    }
    return keep ? [text, keep] : text;
  });
  const pieces = spans.map(span => runs.flatMap((run, index) => {
    const from = Math.max(span.start, starts[index]), to = Math.min(span.end, starts[index] + run.text.length);
    return from < to ? [{...run, text: run.text.slice(from - starts[index], to - starts[index])}] : [];
  }));
  const signature = list => JSON.stringify(normalizeRuns(list).map(run => [styleKey(run), run.text]));
  const authoredSignature = signature(runs);
  // Plain strings (a break belongs to the next line's first run) when that already rebuilds the runs; the split form otherwise.
  const gaps = [breaks, kept].find(candidate => signature(joinWrappedText(pieces, candidate)) === authoredSignature);
  return {spans, breaks, gaps, indexes};
}

/**
 * How a rich-text `text` item exported as native line shapes, when the authored
 * runs can be rebuilt from those lines exactly: `{lines, gaps?}`. `lines` is
 * the number of native line shapes (blank lines have none). Each line break
 * either deleted no characters (a soft wrap: gap '') or deleted whitespace
 * only (a hard break: a newline, a blank line, trimmed spaces); `gaps` lists
 * the N - 1 separators when any is not '' (see joinWrappedText) and is absent
 * for pure soft wraps. Only whitespace is ever stored, never a word. Undefined
 * for a single line or when the runs cannot be proven to rebuild (leading or
 * trailing whitespace outside the lines, dropped or changed characters, a gap
 * that spans a differently styled run): nothing then marks the leaf and import
 * keeps the separate blocks.
 */
export function wrappedLines(item) {
  if (item?.field !== 'text' || !Array.isArray(item.text?.richLines) || item.text.richLines.length < 2) return undefined;
  const analysis = analyzeLines(item.value, item.text.richLines);
  if (!analysis?.gaps || analysis.spans.length < 2) return undefined;
  return {lines: analysis.spans.length, ...(analysis.breaks.some(Boolean) ? {gaps: analysis.gaps} : {})};
}

/** The number of native line shapes when the lines are consecutive soft wraps only (no hard break between them). */
export const softWrappedLines = item => {
  const wrapped = wrappedLines(item);
  return wrapped && !wrapped.gaps ? wrapped.lines : undefined;
};

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
    const lines = wrappedLines(item);
    if (lines) wrapped.set(item.path, wrapRecord(lines));
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
    if (block.bullets !== undefined && block.items === undefined && ['list', 'text'].includes(kind)) leaf.bullets = true;
    if (kind === 'text' && wrapped.has(`${path}.text`)) Object.assign(leaf, wrapped.get(`${path}.text`));
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
      return box ? {field, box: [box.x, box.y, box.width, box.height].map(round1), ...lines} : {field};
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
// Hard line breaks inside list items
//
// A list exports one native shape per line of every entry: `OPF list <path> line N`, the entry's text lines (the first
// bulleted), then its description lines, numbered in that order. Import joins an entry's continuation lines without a
// separator (a soft wrap deletes no character) and tells description lines from text lines by size, so a newline inside an
// item was dropped and a blank line became an empty description. The slide record's `lists` stores, per list path, the
// whitespace each hard break deleted, keyed by the number of the line that follows the break:
//
//   lists = [[path, [[line, gap], ...]], ...]    // gap as in `wrap`: whitespace, or [whitespace, keep]

export const MAX_LIST_PATHS = 256;
export const MAX_LIST_BREAKS = 20000;
const LIST_PATH = /^slides\.\d+(?:\.[A-Za-z0-9_:+-]{1,64}){1,32}$/;

/**
 * The `lists` record of a slide from its composed geometry `items`, or undefined when no list item holds a hard break.
 * `omit(path, reason)` names a list whose breaks could not be accounted for exactly (the characters of an item do not
 * equal its native lines plus whitespace, leading or trailing whitespace outside the lines): import then joins that
 * list's lines as before, and the export reports the omission.
 */
export function listLineBreaks(items, omit = () => {}) {
  const lists = [];
  for (const item of items ?? []) {
    const entries = item?.text?.listEntries;
    if ((item?.field !== 'items' && item?.field !== 'bullets') || !Array.isArray(entries) || typeof item.path !== 'string') continue;
    const recorded = [];
    let line = 0, failed = false;
    for (const entry of entries) {
      for (const [value, rich] of [[entry?.value, entry?.text?.richLines], [entry?.descriptionValue, entry?.description?.richLines]]) {
        if (!Array.isArray(rich)) continue;
        const first = line;
        line += rich.length;
        if (rich.filter(part => part?.fragments?.length).length < 2) continue;
        const analysis = analyzeLines(value, rich);
        if (!analysis) {
          const source = (Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run?.text ?? '') : [typeof value === 'string' ? value : '']).join('');
          if (/[\r\n]/.test(source)) failed = true;
          continue;
        }
        const gaps = analysis.gaps ?? analysis.breaks;
        gaps.forEach((gap, index) => { if (Array.isArray(gap) || gap) recorded.push([first + analysis.indexes[index + 1], gap]); });
      }
    }
    if (failed) omit(item.path, 'a line break inside a list item could not be recorded exactly');
    if (recorded.length) lists.push([item.path, recorded]);
  }
  const total = lists.reduce((sum, [, entries]) => sum + entries.length, 0);
  return lists.length && lists.length <= MAX_LIST_PATHS && total <= MAX_LIST_BREAKS ? lists : undefined;
}

/** Throws when `value` is not a well-formed `lists` record (untrusted input). Returns it otherwise. */
export function validateListBreaks(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_LIST_PATHS) throw Error('Invalid list breaks record.');
  let total = 0;
  const paths = new Set();
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !LIST_PATH.test(entry[0]) || paths.has(entry[0]) || !Array.isArray(entry[1]) || !entry[1].length) throw Error('Invalid list breaks entry.');
    paths.add(entry[0]);
    let previous = -1;
    for (const item of entry[1]) {
      if (!Array.isArray(item) || item.length !== 2 || !Number.isSafeInteger(item[0]) || item[0] <= previous || item[0] > MAX_LIST_BREAKS || !validGap(item[1]) || (item[1] === '')) throw Error('Invalid list break.');
      previous = item[0];
      if (++total > MAX_LIST_BREAKS) throw Error('Too many list breaks.');
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Import: validation

const validBox = value => value === undefined || (Array.isArray(value) && value.length === 4 && value.every(number => typeof number === 'number' && Number.isFinite(number) && Math.abs(number) < 1e7));
const validId = value => value === undefined || (typeof value === 'string' && value.length <= MAX_ID_LENGTH);
const validLines = value => value === undefined || (Number.isSafeInteger(value) && value >= 2 && value <= MAX_WRAPPED_LINES);
// gaps: one entry per line break, a whitespace string or [whitespace, characters kept by the previous line's last run].
const validGap = gap => (typeof gap === 'string' && gap.length <= MAX_GAP_LENGTH && GAP_TEXT.test(gap))
  || (Array.isArray(gap) && gap.length === 2 && typeof gap[0] === 'string' && gap[0].length <= MAX_GAP_LENGTH && GAP_TEXT.test(gap[0]) && Number.isSafeInteger(gap[1]) && gap[1] > 0 && gap[1] <= gap[0].length);
const validGaps = (gaps, lines) => gaps === undefined || (lines !== undefined && Array.isArray(gaps) && gaps.length === lines - 1 && gaps.every(validGap));
// `wrap` = {lines, gaps?} (RR-09) is the general record; `lines` alone (a count of pure soft wraps) is the form importers
// before RR-09 read, and the only one written for pure soft wraps. A leaf with a hard break stores `wrap` alone, so an
// older importer, which ignores the unknown key, keeps the flat blocks instead of joining lines without their separators.
const validWrap = wrap => wrap === undefined || (object(wrap) && Number.isSafeInteger(wrap.lines) && validLines(wrap.lines) && validGaps(wrap.gaps, wrap.lines));
const validWrapOf = value => validLines(value.lines) && validWrap(value.wrap) && ((value.lines === undefined && value.wrap === undefined) || value.k === 'text' || value.field === 'text');
/** The wrapped-line record of a stored leaf: {lines, gaps?}, or undefined. */
export const wrapOf = node => node.wrap ?? (node.lines === undefined ? undefined : {lines: node.lines});
/** The leaf fields that record `wrapped` ({lines, gaps?} from wrappedLines). */
const wrapRecord = wrapped => wrapped.gaps ? {wrap: wrapped} : {lines: wrapped.lines};
const validField = value => object(value) && ROOT_PAYLOAD_FIELDS.includes(value.field) && validBox(value.box) && validWrapOf(value);
/** The root payload leaves of a root-form record: [{field, box?}]. */
export const rootFields = topology => topology.fields ?? [{field: topology.field, box: topology.box, lines: topology.lines, wrap: topology.wrap}];

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
    if (item.bullets !== undefined && (item.bullets !== true || !['list', 'text'].includes(item.k))) throw Error('Invalid bullets flag.');
    if (!validWrapOf(item)) throw Error('Invalid wrapped line record.');
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
      if (!validWrapOf(value)) throw Error('Invalid wrapped line record.');
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

// Rename an imported list payload's `items` to `bullets`, unless an item holds a description (only list items may).
// `bullets` is valid beside type 'text' only, so an authored `type` comes back as 'text'.
function bulletsKey(payload, typed) {
  if (payload.items === undefined || payload.bullets !== undefined || !Array.isArray(payload.items)) return;
  if (payload.items.some(item => object(item) && !Array.isArray(item) && item.description !== undefined)) return;
  payload.bullets = payload.items;
  delete payload.items;
  if (typed) payload.type = 'text';
}
const textRuns = value => typeof value === 'string' || (Array.isArray(value) && value.length > 0 && value.every(run => object(run) && typeof run.text === 'string'));
/**
 * Rebuild the authored content form from the imported flat `blocks` and their
 * native `bounds` (reference px, one entry per block, null when unknown).
 * Returns {fields} (slide properties to set: root field, `blocks` or region
 * keys; a `null` value removes the property) and the restored block ids, or
 * {reason} when a block matches no leaf or several blocks land on one leaf.
 * Leaves with no block are dropped: empty payloads export nothing.
 */
export function rebuildContent(topology, blocks, bounds, placed) {
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
    // Every flat block that rejoins here lands at this leaf (reported to `placed`), not only the first.
    leaf.rejoined = leaf.matches;
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
    const wrap = wrapOf(leaf.node);
    if (leaf.kind === 'text' && wrap?.lines === leaf.matches.length && leaf.matches.every(index => blocks[index]?.type === 'text' && textRuns(blocks[index].text))) {
      const ordered = leaf.matches.map((index, position) => ({index, y: bounds[index].y, position})).sort((a, b) => a.y - b.y || a.position - b.position).map(entry => entry.index);
      leaf.payload = {...blocks[ordered[0]], text: joinWrappedText(ordered.map(index => blocks[index].text), wrap.gaps)};
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
    // The imported block names every list `items`; a payload authored as `bullets` takes its key back (a bullet has no description).
    if (leaf.node.bullets === true) bulletsKey(payload, leaf.node.typed);
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
  // Where each imported flat block lands under the slide (reported to `placed`, for import signals): the path of its leaf in the rebuilt form.
  const paths = new Map();
  const built = item => item.t !== 'group' ? Boolean(leaves.find(entry => entry.node === item)?.matches.length) : item.blocks.some(built);
  const place = (item, prefix) => {
    if (item.t !== 'group') {
      const leaf = leaves.find(entry => entry.node === item);
      if (leaf) for (const index of leaf.rejoined ?? leaf.matches) paths.set(index, prefix);
      return;
    }
    let position = 0;
    for (const child of item.blocks) if (built(child)) place(child, `${prefix}.blocks.${position++}`);
  };
  if (topology.form === 'root') { for (const leaf of leaves) for (const index of leaf.rejoined ?? leaf.matches) paths.set(index, leaf.field); }
  else if (topology.form === 'blocks') { let position = 0; for (const item of topology.blocks) if (built(item)) place(item, `blocks.${position++}`); }
  else for (const [key, item] of Object.entries(topology.regions)) if (built(item)) place(item, key);
  const fields = {blocks: null};
  if (topology.form === 'root') {
    for (const leaf of leaves) {
      const payload = payloadOf(leaf);
      if (payload === undefined) continue;
      // The slide `type` is restored separately; the imported block names any
      // list by `items`, so an authored `bullets` payload takes its key back.
      const {type: _type, ...rest} = payload;
      if (leaf.field === 'bullets') bulletsKey(rest);
      Object.assign(fields, rest);
    }
    placed?.(paths);
    return {fields, ids};
  }
  if (topology.form === 'blocks') {
    const rebuilt = topology.blocks.map(build).filter(Boolean);
    if (rebuilt.length) fields.blocks = rebuilt;
    placed?.(paths);
    return {fields, ids};
  }
  for (const [key, item] of Object.entries(topology.regions)) {
    const host = build(item);
    if (host !== undefined) fields[key] = host;
  }
  placed?.(paths);
  return {fields, ids};
}
