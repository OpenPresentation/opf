// OPF tags written before 0.34.
//
// OPF 0.34 renamed the layout words that follow the deck's direction from `left` and `right` to `start` and `end` (alignments, header
// and footer zones, promoted regions, image placement and overlay bands, caption and cell alignment) and a text run's `lang` to
// `language`. A PPTX keeps the tags of the exporter that wrote it, and PowerPoint keeps them through edits and saves, so a deck
// exported earlier still carries the old words in its provenance records. The importer reads such a record through `upgradeTag`,
// which rewrites exactly those words where a record holds them and leaves everything else as it is; the document it returns is in
// the current vocabulary. The words that name physical sides (a chart's legend, cell border and padding sides, crop insets) are the
// same in both versions and are never touched. Tags are untrusted input: the walk is bounded and builds new objects only.

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const side = word => word === 'left' ? 'start' : word === 'right' ? 'end' : word;
const ROW = '(?:top|middle|bottom)(?:\\+(?:top|middle|bottom))*', COLUMN = '(?:left|center|right)(?:\\+(?:left|center|right))*';
// A promoted region key that spells a column: `left`, `center+right`, `top:left`. `center` alone and the rows have no old word.
const REGION = new RegExp(`^(?:(${ROW}):)?(${COLUMN})$`);
const regionKey = key => {
  const match = REGION.exec(key);
  return match ? `${match[1] ? `${match[1]}:` : ''}${match[2].split('+').map(side).join('+')}` : key;
};
// A dotted OPF path through a promoted region or a header or footer zone: `slides.2.top:left.caption`, `design.footer.right.text`.
const PATH = /^(?:slides\.\d+|design)(?:\.[^.\s]+)*$/;
const pathText = text => {
  if (text.length > 512 || !PATH.test(text)) return text;
  const parts = text.split('.');
  for (let index = 1; index < parts.length; index++) {
    if ((parts[index - 1] === 'header' || parts[index - 1] === 'footer') && parts[index - 2] === 'design') parts[index] = side(parts[index]);
    else if (index === 2 && parts[0] === 'slides') parts[index] = regionKey(parts[index]);
  }
  return parts.join('.');
};
const SLOT = /^(header|footer)\.(left|right)(\..+)?$/;
const CONTENT = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'blocks', 'shape'];
// The value of a bare `left` or `right` key is a region's payload (or its topology node) rather than a border, a padding or an inset.
const payloadLike = value => object(value) && (CONTENT.some(field => value[field] !== undefined) || typeof value.kind === 'string' || typeof value.form === 'string');
const MAX_DEPTH = 64;

function upgrade(value, depth, zones) {
  if (typeof value === 'string') return pathText(value);
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(entry => upgrade(entry, depth + 1, false));
  // Which bare `left`/`right` keys of this object are layout words: all of them in a set of zones or regions, else the payloads.
  const regions = value.form === 'regions' ? value.regions : undefined;
  const slideLike = Array.isArray(value.blocks) || typeof value.layout === 'string' || typeof value.title === 'string' || Object.keys(value).some(key => key !== regionKey(key) && /[+:]/.test(key));
  const run = typeof value.text === 'string' && typeof value.lang === 'string' && value.language === undefined;
  const caption = value.role === 'caption' || (value.text !== undefined && value.position !== undefined);
  const part = (value.kind === 'header' || value.kind === 'footer') && typeof value.zone === 'string';
  // Entries, then Object.fromEntries: every key becomes an own property, `__proto__` included.
  const out = [];
  for (const [name, entry] of Object.entries(value)) {
    let key = name, next;
    if (zones && (name === 'left' || name === 'right')) key = side(name);
    else if (SLOT.test(name)) key = name.replace(SLOT, (all, kind, zone, rest) => `${kind}.${side(zone)}${rest ?? ''}`);
    else if (name === 'left' || name === 'right') key = slideLike || payloadLike(entry) ? side(name) : name;
    else if (REGION.test(name) && /[+:]/.test(name)) key = regionKey(name);
    else if (PATH.test(name)) key = pathText(name);
    else if (run && name === 'lang') key = 'language';
    // A record that holds both spellings is not one an exporter wrote: its keys stay as they are.
    if (key !== name && Object.hasOwn(value, key)) key = name;
    if ((name === 'titleAlignment' || name === 'contentAlignment' || name === 'chartPrimary') && typeof entry === 'string') next = side(entry);
    else if ((name === 'header' || name === 'footer') && object(entry)) next = upgrade(entry, depth + 1, true);
    else if (name === 'value' && object(entry) && zones === 'definition') next = upgrade(entry, depth + 1, true);
    else if (name === 'definitions' && object(entry)) next = Object.fromEntries(Object.entries(entry).map(([kind, definition]) => [kind, kind === 'header' || kind === 'footer' ? upgrade(definition, depth + 1, 'definition') : upgrade(definition, depth + 1, false)]));
    else if (name === 'regions' && entry === regions && object(entry)) next = Object.fromEntries(Object.entries(entry).map(([region, node]) => [regionKey(region), upgrade(node, depth + 1, false)]));
    else if ((name === 'placement' || name === 'overlay') && object(entry) && typeof entry.edge === 'string') next = {...upgrade(entry, depth + 1, false), edge: side(entry.edge)};
    else if (name === 'edge' && typeof entry === 'string' && (value.size !== undefined || value.inset !== undefined) && value.block === undefined) next = side(entry);
    else if (name === 'align' && typeof entry === 'string' && caption) next = side(entry);
    else if (name === 'caption' && object(entry) && typeof entry.align === 'string') next = {...upgrade(entry, depth + 1, false), align: side(entry.align)};
    else if (name === 'style' && object(entry) && typeof entry.align === 'string') next = {...upgrade(entry, depth + 1, false), align: side(entry.align)};
    else if (name === 'zone' && part && typeof entry === 'string') next = side(entry);
    else next = upgrade(entry, depth + 1, false);
    out.push([key, next]);
  }
  return Object.fromEntries(out);
}

/** A decoded OPF tag in the current vocabulary: the record itself when it holds none of the words 0.34 renamed. */
export function upgradeTag(record) {
  if (record === null || typeof record !== 'object') return record;
  let text;
  try { text = JSON.stringify(record); } catch { return record; }
  // Nearly every record of a current export passes this test and is returned as it is.
  if (!/\b(?:left|right|lang)\b/.test(text)) return record;
  return upgrade(record, 0, false);
}
