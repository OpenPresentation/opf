// Legacy native provenance is a typed interchange format, not an arbitrary JSON
// tree. Only the known reader selects a family below. Authored strings, data
// keys, extensions, XML evidence and unknown fields are never searched/replaced.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const side = value => value === 'left' ? 'start' : value === 'right' ? 'end' : value;
const MAX_DEPTH = 64;
const OLD_REGION = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*:)?(?:left|center|right)(?:\+(?:left|center|right))*$/;
const region = value => typeof value === 'string' && OLD_REGION.test(value) ? value.replace(/left|right/g, side) : value;
const slot = value => typeof value === 'string' ? value.replace(/^(header|footer)\.(left|right)(?=\.|$)/, (_all, kind, zone) => `${kind}.${side(zone)}`) : value;

// Called only for a field declared to hold a structural OPF path.
const path = value => {
  if (typeof value !== 'string' || value.length > 512 || !/^(?:slides\.\d+|design)(?:\.[^.\s]+)*$/.test(value)) return value;
  const parts = value.split('.');
  if (parts[0] === 'slides' && parts.length > 2) parts[2] = region(parts[2]);
  for (let index = 2; index < parts.length; index++)
    if (parts[index - 2] === 'design' && ['header', 'footer'].includes(parts[index - 1])) parts[index] = side(parts[index]);
  return parts.join('.');
};

function fields(value, handlers, depth = 0, keyOf = key => key) {
  if (!object(value)) return value;
  if (depth > MAX_DEPTH) throw Error('Legacy provenance exceeds the typed migration depth limit.');
  let changed = false;
  const entries = Object.entries(value).map(([name, entry]) => {
    const key = keyOf(name);
    if (key !== name && own(value, key)) throw Error(`Ambiguous legacy provenance fields ${name} and ${key}.`);
    const next = own(handlers, name) ? handlers[name](entry, depth + 1) : entry;
    changed ||= key !== name || next !== entry;
    return [key, next];
  });
  return changed ? Object.fromEntries(entries) : value;
}
const list = (value, visitor, depth = 0) => {
  if (!Array.isArray(value)) return value;
  if (depth > MAX_DEPTH) throw Error('Legacy provenance exceeds the typed migration depth limit.');
  const next = value.map(entry => visitor(entry, depth + 1));
  return next.some((entry, index) => entry !== value[index]) ? next : value;
};
const keyed = (value, visitor, depth = 0, keyOf) => fields(value, object(value)
  ? Object.fromEntries(Object.keys(value).map(key => [key, visitor])) : {}, depth, keyOf);

const rich = (value, depth) => list(value, (run, at) => fields(run, {
  footnote: (note, next) => fields(note, {text: rich}, next),
}, at, key => key === 'lang' ? 'language' : key), depth);
const caption = (value, depth) => fields(value, {text: rich, align: side}, depth);
const edge = (value, depth) => fields(value, {edge: side}, depth);
const background = (value, depth) => fields(value, {overlay: edge}, depth);
const image = (value, depth) => fields(value, {placement: edge, overlay: edge, caption}, depth);
const zone = (value, depth) => fields(value, {text: rich}, depth);
const zones = (value, depth) => keyed(value, zone, depth, side);
const design = (value, depth) => fields(value, {
  titleAlignment: side, contentAlignment: side, chartPrimary: side,
  header: zones, footer: zones, background,
}, depth);
const cell = (value, depth) => Array.isArray(value) ? rich(value, depth) : fields(value, {
  value: rich,
  style: (style, at) => fields(style, {align: side}, at),
}, depth);
const table = (value, depth) => fields(value, {
  columns: (columns, at) => list(columns, cell, at),
  rows: (rows, at) => list(rows, (row, next) => list(row, cell, next), at),
}, depth);
const layoutRecord = (value, depth) => fields(value, {design}, depth);
const catalogs = (value, depth) => keyed(value, (group, at) => fields(group, {
  layouts: (records, next) => keyed(records, layoutRecord, next),
  themes: (records, next) => keyed(records, layoutRecord, next),
}, at), depth);

// Units changed along with the vocabulary. An unmarked pre-0.34 tag's anchor
// width > 1 means reference pixels; a newly written marker-2 tag's width 1.01
// means 101% of its target. Never guess from the numeric value of a current tag.
const anchor = (value, depth) => {
  let next = fields(value, {edge: side}, depth);
  if (!object(next)) return next;
  for (const [fraction, pixels] of [['width', 'widthPx'], ['height', 'heightPx']]) {
    if (typeof next[fraction] !== 'number' || next[fraction] <= 1) continue;
    if (own(next, pixels)) throw Error(`Ambiguous legacy anchor ${fraction} and ${pixels}.`);
    next = Object.fromEntries(Object.entries(next).map(([key, entry]) => [key === fraction ? pixels : key, entry]));
  }
  return next;
};
const topologyNode = (value, depth) => fields(value, {
  blocks: (blocks, at) => list(blocks, topologyNode, at),
}, depth);
const topology = (value, depth) => fields(value, {
  blocks: (blocks, at) => list(blocks, topologyNode, at),
  regions: (regions, at) => keyed(regions, topologyNode, at, region),
}, depth);
const pathRows = (value, depth) => list(value, (row, at) => {
  if (!Array.isArray(row) || row.length !== 2) return row;
  if (at > MAX_DEPTH) throw Error('Legacy provenance exceeds the typed migration depth limit.');
  const next = path(row[0]);
  return next === row[0] ? row : [next, row[1]];
}, depth);
const overlays = (value, depth) => list(value, (row, at) => {
  if (!Array.isArray(row) || row.length !== 2) return row;
  const next = fields(row[1], {at: anchor}, at);
  return next === row[1] ? row : [row[0], next];
}, depth);

const documentRecord = (value, depth) => fields(value, {
  design, catalogs,
  references: (refs, at) => list(refs, (ref, next) => fields(ref, {text: rich}, next), at),
  metadata: (metadata, at) => fields(metadata, {
    references: (refs, next) => list(refs, (ref, further) => fields(ref, {text: rich}, further), next),
  }, at),
  supplement: (supplement, at) => fields(supplement, {design}, at),
}, depth);
const slideRecord = (value, depth) => fields(value, {
  design, content: topology, overlays,
  layoutRecord: (stored, at) => fields(stored, {record: layoutRecord}, at),
  lists: pathRows, listRuns: pathRows, listRoles: pathRows, listScalars: pathRows,
  supplement: (supplement, at) => fields(supplement, {design}, at),
}, depth);
const dataRecord = (value, depth) => {
  if (value?.kind !== 'table') return value;
  return fields(value, {
    table, authored: table,
    headers: (rows, at) => list(rows, (row, next) => {
      if (!Array.isArray(row) || row.length < 2) return row;
      const header = cell(row[1], next);
      return header === row[1] ? row : [row[0], header, ...row.slice(2)];
    }, at),
  }, depth);
};
const imageRecord = (value, depth) => fields(value, {path, treatment: image, overlay: edge}, depth);
const annotationRecord = (value, depth) => fields(value, {path, field: path, source: path, align: side}, depth);
const furniturePart = (value, depth) => fields(value, {zone: side, slot}, depth);
const furnitureRecord = (value, depth) => fields(value, {
  definitions: (definitions, at) => fields(definitions, {
    header: (definition, next) => fields(definition, {value: zones}, next),
    footer: (definition, next) => fields(definition, {value: zones}, next),
  }, at),
  images: (images, at) => keyed(images, entry => entry, at, slot),
  templates: (templates, at) => keyed(templates, entry => entry, at, slot),
  formats: (formats, at) => keyed(formats, entry => entry, at, slot),
  shared: (shared, at) => keyed(shared, entry => entry, at, slot),
  parts: (parts, at) => list(parts, furniturePart, at),
  zone: side, slot,
}, depth);
const readers = {document: documentRecord, slide: slideRecord, data: dataRecord,
  datasets: datasets => datasets,
  image: imageRecord, annotation: annotationRecord, furniture: furnitureRecord};
const regionOrders = new WeakMap();
/** Legacy color-slot ordering is internal evidence, never an authored property. */
export const legacyRegionOrder = record => regionOrders.get(record);
/** A path already identified structurally by an owned native-name reader. */
export const logicalProvenancePath = path;

/** Stamp newly written typed records; this key belongs only to native provenance. */
export const currentTag = record => object(record) ? {...record, vocabulary: 2} : record;
/** Stamp a shape-name map without modifying the caller's records. */
export const currentTags = records => new Map([...records].map(([name, record]) => [name, currentTag(record)]));
/** Adapt a decoded record only through the schema family selected by its reader. */
export function upgradeTag(record, family) {
  if (!own(readers, family) || !object(record)) return record;
  // DATASETS is a map whose keys are authored ids, including "vocabulary".
  if (family !== 'datasets') {
    if (record.vocabulary === 2) return record;
    if (record.vocabulary !== undefined) throw Error('Unsupported native provenance vocabulary.');
  }
  const upgraded = readers[family](record, 0);
  if (family === 'slide' && record.content?.form === 'regions' && object(record.content.regions))
    regionOrders.set(upgraded, Object.keys(record.content.regions).sort().map(region));
  return upgraded;
}
