// O1: rename the logical left/right vocabulary of OPF documents to start/end. Operates on parsed JSON, keeps key order.
// usage: node o1-codemod.mjs [--check] <file.json>...     (decks, layout records, theme records)
import fs from 'node:fs';
const side = (value) => (value === 'left' ? 'start' : value === 'right' ? 'end' : value);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const ROWS = ['top', 'middle', 'bottom', 'top+middle', 'middle+bottom', 'top+middle+bottom'];
const COLS = ['left', 'center', 'right', 'left+center', 'center+right', 'left+center+right'];
const OLD_REGION_KEYS = new Set([...COLS, ...ROWS, ...ROWS.flatMap((row) => COLS.map((col) => `${row}:${col}`))]);
export const regionKey = (key) => (OLD_REGION_KEYS.has(key) ? key.split(':').map((part, index, parts) => (parts.length === 2 && index === 0 ? part : part.split('+').map(side).join('+'))).join(':') : key);
let changes = 0;
const set = (object, key, value) => { if (object[key] !== value) { object[key] = value; changes++; } };
/** Rebuild an object with some keys renamed, in the same order. */
function renameKeys(object, rename) {
  const out = {}; let renamed = false;
  for (const [key, value] of Object.entries(object)) { const next = rename(key); if (next !== key) { renamed = true; changes++; } if (Object.hasOwn(out, next)) throw new Error(`key collision on ${next}`); out[next] = value; }
  return renamed ? out : object;
}
function designHints(design) {
  if (!isObject(design)) return design;
  for (const key of ['titleAlignment', 'contentAlignment', 'chartPrimary']) if (typeof design[key] === 'string') set(design, key, side(design[key]));
  for (const key of ['header', 'footer']) if (isObject(design[key])) design[key] = renameKeys(design[key], (zone) => (['left', 'right'].includes(zone) ? side(zone) : zone));
  if (isObject(design.background) && isObject(design.background.overlay) && typeof design.background.overlay.edge === 'string') set(design.background.overlay, 'edge', side(design.background.overlay.edge));
  return design;
}
function cell(value) { if (isObject(value) && isObject(value.style) && typeof value.style.align === 'string') set(value.style, 'align', side(value.style.align)); }
function payload(node) {
  if (!isObject(node)) return;
  if (isObject(node.caption) && typeof node.caption.align === 'string') set(node.caption, 'align', side(node.caption.align));
  if (isObject(node.table)) { for (const entry of Array.isArray(node.table.columns) ? node.table.columns : []) cell(entry); for (const row of Array.isArray(node.table.rows) ? node.table.rows : []) if (Array.isArray(row)) row.forEach(cell); }
  if (isObject(node.overlay) && typeof node.overlay.edge === 'string') set(node.overlay, 'edge', side(node.overlay.edge));
  if (isObject(node.placement) && typeof node.placement.edge === 'string') set(node.placement, 'edge', side(node.placement.edge));
  if (Array.isArray(node.blocks)) node.blocks.forEach(payload);
}
function slide(value) {
  if (!isObject(value)) return value;
  let next = renameKeys(value, regionKey);
  if (isObject(next.design)) next.design = designHints(next.design);
  payload(next);
  for (const [key, entry] of Object.entries(next)) if (OLD_REGION_KEYS.has(key) || /^(?:[a-z+]+:)?(?:start|center|end)(?:\+(?:center|end))*$/.test(key) || ROWS.includes(key)) payload(entry);
  return next;
}
function record(kind, value) {
  if (!isObject(value)) return;
  if (isObject(value.design)) value.design = designHints(value.design);
}
/** O4: a text run's `lang` is `language`. A run is an object with a string `text` inside a rich-text array. */
function runs(value) {
  if (Array.isArray(value)) { value.forEach((entry, index) => { if (isObject(entry) && typeof entry.text === 'string' && typeof entry.lang === 'string' && entry.language === undefined) value[index] = renameKeys(entry, (key) => (key === 'lang' ? 'language' : key)); else runs(entry); }); return; }
  if (isObject(value)) for (const entry of Object.values(value)) runs(entry);
}
export function migrate(doc) {
  if (!isObject(doc)) return doc;
  if (Array.isArray(doc.slides)) runs(doc);
  if (Array.isArray(doc.slides)) {
    if (isObject(doc.design)) doc.design = designHints(doc.design);
    doc.slides = doc.slides.map(slide);
    if (isObject(doc.catalogs)) for (const group of Object.values(doc.catalogs)) if (isObject(group)) for (const kind of ['themes', 'layouts']) if (isObject(group[kind])) for (const entry of Object.values(group[kind])) record(kind, entry);
  } else if (typeof doc.$schema === 'string' && /opf-(layout|theme)\//.test(doc.$schema)) record('', doc);
  else if (isObject(doc.design) && (Array.isArray(doc.regions) || doc.colorScheme !== undefined)) record('', doc);
  return doc;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check'); let files = 0, edits = 0; const odd = [];
  for (const file of process.argv.slice(2).filter((arg) => !arg.startsWith('--'))) {
    const text = fs.readFileSync(file, 'utf8'); let doc;
    try { doc = JSON.parse(text); } catch { continue; }
    const canonical = JSON.stringify(doc, null, 2), newline = text.endsWith('\n') ? '\n' : '';
    changes = 0; const next = migrate(doc);
    if (!changes) continue;
    if (canonical + newline !== text) { odd.push(file); continue; }
    files++; edits += changes; if (process.argv.includes('--list')) console.log(`  ${file} (${changes})`);
    if (!check) fs.writeFileSync(file, JSON.stringify(next, null, 2) + newline);
  }
  console.log(`${check ? 'would change' : 'changed'} ${files} files, ${edits} edits`); if (odd.length) console.log('not canonical JSON (edit by hand):\n  ' + odd.join('\n  '));
}
