// FR-02 (CR 6): the ids of list items, bullets, timeline events and table rows survive a PPTX round trip.
//
// PowerPoint has no field for them: a list is paragraphs of one text box, a timeline is shapes, a table row is a native row. They are
// stored in the slide's OPF_SLIDE_V1 record (`full` provenance only), next to the block ids of the content topology:
//
//   entryIds = [[path, field, fingerprints, ids], ...]
//     path         the payload, relative to the slide: '' for the slide itself, else 'blocks.1', 'blocks.0.blocks.2' (the authored form)
//     field        'items' | 'bullets' | 'events' | 'rows'
//     fingerprints one 8-hex-digit hash per entry, in order: what the entry said when it was exported (never the words themselves)
//     ids          one per entry, in order: the entry's id, or null
//
// Import restores an id only while the entry it belongs to is still recognizable. The stored fingerprints are aligned with the entries
// PowerPoint now shows: entries that say what they said (a longest common subsequence) take their id; between two such anchors, as many
// entries as were exported as are now there are the same entries edited in place and take theirs by position. Entries PowerPoint added
// come back without ids, ids of removed entries are dropped, and ONE finding names how many ids were not restored. A slide whose native
// structure changed restores none (its block ids are not restored either). A deck with no entry ids records nothing, so its export is
// byte-for-byte the export it was before ids existed.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const MAX_ENTRY_LISTS = 512;
export const MAX_ENTRIES = 5000;
const MAX_ID = 256;
const FIELDS = ['items', 'bullets', 'events', 'rows'];

// 32-bit FNV-1a as 8 hex digits. Change detection, not security.
function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) { h ^= text.charCodeAt(index); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const runsText = value => Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : typeof run?.text === 'string' ? run.text : '').join('') : typeof value === 'string' ? value : '';
const squash = text => text.replace(/\s+/g, ' ').trim();
// A number, and text that is only a formatted number ("46%", "$12.4", "1,200"), says the same to the matcher: a cell's number format changes
// how it reads, never which row it is.
const NUMBER_TEXT = /^[\s\d.,%$€£¥+\-–−()]*\d[\s\d.,%$€£¥+\-–−()]*$/;
function cellText(cell) {
  const value = object(cell) && Object.hasOwn(cell, 'value') ? cell.value : object(cell) && typeof cell.name === 'string' ? cell.name : cell;
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return '#';
  const text = squash(runsText(value));
  return NUMBER_TEXT.test(text) ? '#' : text;
}

/** What an entry said, as the matcher compares it. */
function entryText(field, entry) {
  if (field === 'rows') return (Array.isArray(entry) ? entry : object(entry) && Array.isArray(entry.cells) ? entry.cells : []).map(cellText).join('\t');
  if (field === 'events') return object(entry) ? [entry.when, entry.what, entry.description].map(value => squash(runsText(value))).join('\n') : '';
  if (object(entry)) return `${squash(runsText(entry.text))}\n${squash(runsText(entry.description))}`;
  return `${squash(runsText(entry))}\n`;
}

const entriesOf = (node, field) => {
  if (!object(node)) return undefined;
  if (field === 'items' || field === 'bullets') return Array.isArray(node[field]) ? node[field] : undefined;
  if (field === 'rows') return object(node.table) && Array.isArray(node.table.rows) ? node.table.rows : undefined;
  const timeline = node.timeline;
  return Array.isArray(timeline) ? timeline : object(timeline) && Array.isArray(timeline.events) ? timeline.events : undefined;
};

const payloadAt = (slide, path) => {
  let node = slide;
  if (path === '') return node;
  const tokens = path.split('.');
  for (let index = 0; index < tokens.length; index += 2) {
    if (tokens[index] !== 'blocks' || !object(node) || !Array.isArray(node.blocks)) return undefined;
    node = node.blocks[Number(tokens[index + 1])];
    if (!object(node)) return undefined;
  }
  return node;
};

/**
 * The record of one slide (the slide as composed, with its variables substituted): every payload that has an entry with an id, as
 * `[path, field, fingerprints, ids]`. Undefined when no entry has an id, so a deck without ids stores nothing.
 */
export function entryIdRecord(slide) {
  if (!object(slide)) return undefined;
  const lists = [];
  const payloads = [];
  const walk = (node, path) => {
    payloads.push([node, path]);
    if (Array.isArray(node.blocks)) node.blocks.forEach((block, index) => { if (object(block)) walk(block, path === '' ? `blocks.${index}` : `${path}.blocks.${index}`); });
  };
  walk(slide, '');
  for (const [node, path] of payloads) {
    for (const field of FIELDS) {
      const entries = entriesOf(node, field);
      if (!entries || entries.length > MAX_ENTRIES) continue;
      const ids = entries.map(entry => object(entry) && typeof entry.id === 'string' && entry.id !== '' && entry.id.length <= MAX_ID ? entry.id : null);
      if (ids.every(id => id === null)) continue;
      lists.push([path, field, entries.map(entry => fingerprint(entryText(field, entry))), ids]);
    }
  }
  return lists.length && lists.length <= MAX_ENTRY_LISTS ? lists : undefined;
}

/** Throws when `value` is not a well-formed entry-id record (untrusted input). Returns it otherwise. */
export function validateEntryIdRecord(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ENTRY_LISTS) throw Error('Invalid entry id record.');
  const seen = new Set();
  let total = 0;
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== 4) throw Error('Invalid entry id record row.');
    const [path, field, prints, ids] = row;
    if (typeof path !== 'string' || path.length > 512 || !/^(blocks\.\d{1,5}(\.blocks\.\d{1,5})*)?$/.test(path)) throw Error('Invalid entry id record path.');
    if (!FIELDS.includes(field) || seen.has(`${path}:${field}`)) throw Error('Invalid entry id record field.');
    seen.add(`${path}:${field}`);
    if (!Array.isArray(prints) || !Array.isArray(ids) || prints.length !== ids.length || !prints.length || prints.length > MAX_ENTRIES) throw Error('Invalid entry id record entries.');
    total += prints.length;
    if (total > MAX_ENTRIES * 4) throw Error('Entry id record too large.');
    if (!prints.every(print => typeof print === 'string' && /^[0-9a-f]{8}$/.test(print))) throw Error('Invalid entry fingerprint.');
    if (!ids.every(id => id === null || (typeof id === 'string' && id !== '' && id.length <= MAX_ID)) || ids.every(id => id === null)) throw Error('Invalid entry ids.');
    if (new Set(ids.filter(id => id !== null)).size !== ids.filter(id => id !== null).length) throw Error('Duplicate entry ids.');
  }
  return value;
}

/**
 * Pair the stored entries with the imported ones: `pairs[i]` is the stored index of imported entry i, or -1. A longest common subsequence
 * of equal fingerprints anchors the alignment; a gap between anchors that holds as many stored as imported entries pairs them by position.
 */
export function alignEntries(stored, current) {
  const m = stored.length, n = current.length;
  const table = Array.from({length: m + 1}, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i -= 1) for (let j = n - 1; j >= 0; j -= 1) table[i][j] = stored[i] === current[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const pairs = Array(n).fill(-1);
  const anchors = [];
  for (let i = 0, j = 0; i < m && j < n;) {
    if (stored[i] === current[j]) { pairs[j] = i; anchors.push([i, j]); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  let previousI = -1, previousJ = -1;
  for (const [i, j] of [...anchors, [m, n]]) {
    const gapStored = i - previousI - 1, gapCurrent = j - previousJ - 1;
    if (gapStored === gapCurrent) for (let step = 1; step <= gapCurrent; step += 1) pairs[previousJ + step] = previousI + step;
    previousI = i; previousJ = j;
  }
  return pairs;
}

/**
 * Give the imported slide its entry ids back. `changed` is true while the slide's native structure or content topology no longer matches
 * the export (nothing is restored then). `taken` is the set of ids the imported document already uses (changed here: restored ids join it).
 * Returns the number of stored ids that were not restored.
 */
export function restoreEntryIds(slide, record, {changed, taken}) {
  const stored = record.reduce((sum, [, , , ids]) => sum + ids.filter(id => id !== null).length, 0);
  if (changed || !object(slide)) return stored;
  let restored = 0;
  for (const [path, field, prints, ids] of record) {
    const node = payloadAt(slide, path), entries = entriesOf(node, field);
    if (!entries) continue;
    const pairs = alignEntries(prints, entries.map(entry => fingerprint(entryText(field, entry))));
    pairs.forEach((from, index) => {
      const id = from < 0 ? null : ids[from];
      if (id === null) return;
      const entry = entries[index];
      // The table's own data record may already have returned the row with its id.
      if (object(entry) && entry.id !== undefined) { if (entry.id === id) restored += 1; return; }
      if (taken.has(id)) return;
      if (field === 'rows') {
        const cells = Array.isArray(entry) ? entry : object(entry) && Array.isArray(entry.cells) ? entry.cells : undefined;
        if (!cells) return;
        entries[index] = {id, cells};
      } else if (field === 'events') {
        if (!object(entry)) return;
        entries[index] = {id, ...entry};
      } else entries[index] = object(entry) ? {id, ...entry} : {id, text: entry};
      taken.add(id);
      restored += 1;
    });
  }
  return stored - restored;
}

/** The ids an imported document's slides, blocks, overlay shapes, items, bullets, events and rows already use. */
export function usedIdsOf(imported) {
  const ids = new Set();
  const add = value => { if (object(value) && typeof value.id === 'string') ids.add(value.id); };
  const payload = node => {
    if (!object(node)) return;
    add(node);
    for (const field of FIELDS) for (const entry of entriesOf(node, field) ?? []) add(entry);
    for (const shape of Array.isArray(node.shapes) ? node.shapes : []) add(shape);
    if (Array.isArray(node.blocks)) node.blocks.forEach(payload);
  };
  for (const slide of Array.isArray(imported?.slides) ? imported.slides : []) payload(slide);
  return ids;
}
