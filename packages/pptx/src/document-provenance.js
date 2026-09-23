import {XMLParser} from 'fast-xml-parser';
import {decodeTextTag, encodeTextTag} from './code-provenance.js';

// FF-32: document and slide references survive a PPTX round trip.
//
// PPTX has no native field for an OPF catalog reference (design.colorScheme,
// fontScheme, theme, dimensions and background, a slide layout id) or for
// authoring metadata (narrative, tone, audience, purpose, language,
// organization, speaker ...). They are stored as standard PresentationML
// customer-data tags, the mechanism the other OPF provenance records already
// use: OPF_DOCUMENT_V1 on p:presentation/p:custDataLst and OPF_SLIDE_V1 on each
// slide's p:cSld/p:custDataLst. PowerPoint keeps tags through edits and saves,
// copies slide tags with a slide, and never shows them. Values are UTF-8 JSON as
// uppercase hex, because PowerPoint's Tags API is case-insensitive.
//
// Each design reference records the native evidence it produced (theme
// colors, theme fonts, slide size, slide background, slide object geometry).
// Import restores a reference only while that evidence is unchanged. After an
// edit the observed native values stay and a specific diagnostic names the
// reference that was not restored. Tags are untrusted input: they are parsed,
// size-limited, validated with the whole imported document, and never executed.

export const DOCUMENT_TAG = 'OPF_DOCUMENT_V1';
export const SLIDE_TAG = 'OPF_SLIDE_V1';
const REL_TAGS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const TAGS_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml';
const MAX_OMITTED = 256;
const MAX_FIELD_BYTES = 256 * 1024, MAX_CATALOG_BYTES = 1024 * 1024, MAX_TAG_CHARS = 16 * 1024 * 1024;

const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text', parseAttributeValue: false, parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const same = (a, b) => canonical(a) === canonical(b);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const own = (value, key) => object(value) && Object.hasOwn(value, key) && value[key] !== undefined;

// Deck-level fields. References are gated by native evidence; metadata has no
// native PowerPoint counterpart and round-trips from the stored value.
export const DESIGN_REFERENCES = Object.freeze(['theme', 'colorScheme', 'fontScheme', 'dimensions', 'background']);
export const COMPOSITION_HINTS = Object.freeze(['titleAlignment', 'contentAlignment', 'contentBox', 'contentDirection', 'chartPrimary', 'imageFill', 'listBullet']);
export const METADATA = Object.freeze(['narrative', 'tone', 'audience', 'purpose', 'language', 'organization', 'speaker', 'takeaway', 'duration', 'tags', 'variables']);
const STYLE_REFERENCES = ['theme', 'colorScheme', 'fontScheme'];
const SLIDE_STRUCTURE = ['layout', 'type', 'composition'];

// 53-bit non-cryptographic hash (cyrb53). Change detection only; tags are
// writable by anyone who can edit the file, so no authenticity is claimed.
const hash = text => hashUnits(text.length, index => text.charCodeAt(index));
const hashBytes = bytes => hashUnits(bytes.byteLength, index => bytes[index]);
function hashUnits(length, unit) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let index = 0; index < length; index += 1) {
    const code = unit(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

// ---------------------------------------------------------------------------
// Package helpers shared by export (final normalized parts) and import.

function relsPath(part) {
  const slash = part.lastIndexOf('/');
  return `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`;
}

function resolveTarget(source, target) {
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const raw = target.startsWith('/') ? target.slice(1) : source.slice(0, source.lastIndexOf('/') + 1) + target;
  const parts = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return parts.join('/');
}

function relationships(entries, part) {
  const map = new Map();
  const bytes = entries[relsPath(part)];
  if (!bytes) return map;
  for (const rel of array(parser.parse(dec.decode(bytes))?.Relationships?.Relationship)) {
    if (!rel?.Id) continue;
    map.set(rel.Id, {type: rel.Type ?? '', external: rel.TargetMode === 'External', path: rel.TargetMode === 'External' ? null : resolveTarget(part, rel.Target ?? '')});
  }
  return map;
}

function slidePaths(entries, presentationRoot, rels) {
  return array(presentationRoot?.['p:sldIdLst']?.['p:sldId']).map(node => rels.get(node?.['r:id']))
    .filter(rel => rel?.type.endsWith('/slide') && rel.path && entries[rel.path]).map(rel => rel.path);
}

function themePath(entries, presentationRoot, rels) {
  const masters = array(presentationRoot?.['p:sldMasterIdLst']?.['p:sldMasterId']).map(node => rels.get(node?.['r:id']))
    .filter(rel => rel?.type.endsWith('/slideMaster') && rel.path && entries[rel.path]);
  for (const master of masters) {
    const theme = [...relationships(entries, master.path).values()].find(rel => rel.type.endsWith('/theme') && rel.path && entries[rel.path]);
    if (theme) return theme.path;
  }
  return [...rels.values()].find(rel => rel.type.endsWith('/theme') && rel.path && entries[rel.path])?.path ?? null;
}

const THEME_SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

function colorValue(node) {
  if (!object(node)) return null;
  if (object(node['a:srgbClr']) || typeof node['a:srgbClr'] === 'string') {
    const color = node['a:srgbClr'], {val, ...rest} = object(color) ? color : {};
    return `srgb:${String(val ?? '').toUpperCase()}${Object.keys(rest).length ? canonical(rest) : ''}`;
  }
  // PowerPoint rewrites lastClr with the current system color; the reference is what persists.
  if (object(node['a:sysClr'])) return `sys:${node['a:sysClr'].val ?? ''}`;
  return canonical(withoutExtensions(node));
}

// Theme colors, theme fonts and slide size are the native counterparts of
// design.colorScheme, design.fontScheme (both via design.theme) and design.dimensions.
function nativeDocument(entries, presentationRoot, rels) {
  const path = themePath(entries, presentationRoot, rels);
  let elements;
  try { elements = path ? parser.parse(dec.decode(entries[path]))?.['a:theme']?.['a:themeElements'] : undefined; } catch { elements = undefined; }
  const scheme = elements?.['a:clrScheme'], fontScheme = elements?.['a:fontScheme'];
  const colors = object(scheme) ? Object.fromEntries(THEME_SLOTS.map(slot => [slot, colorValue(scheme[`a:${slot}`])])) : null;
  const face = (font, script) => { const node = fontScheme?.[font]?.[`a:${script}`]; return object(node) ? String(node.typeface ?? '') : null; };
  const fonts = object(fontScheme) ? Object.fromEntries(['major', 'minor'].map(kind => [kind, Object.fromEntries(['latin', 'ea', 'cs'].map(script => [script, face(`a:${kind}Font`, script)]))])) : null;
  const size = presentationRoot?.['p:sldSz'];
  return {colors, fonts, size: object(size) ? {cx: String(size.cx ?? ''), cy: String(size.cy ?? '')} : null};
}

function withoutExtensions(node) {
  if (Array.isArray(node)) return node.map(withoutExtensions);
  if (!object(node)) return node;
  return Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'a:extLst' && key !== 'p:extLst').map(([key, value]) => [key, withoutExtensions(value)]));
}

// Relationship ids are renumbered by editors; the target bytes identify an image.
function withResolvedRelationships(node, rels, entries) {
  if (Array.isArray(node)) return node.map(item => withResolvedRelationships(item, rels, entries));
  if (!object(node)) return node;
  return Object.fromEntries(Object.entries(node).map(([key, value]) => {
    if (/^r:(embed|link|id)$/.test(key) && typeof value === 'string') {
      const rel = rels.get(value);
      const bytes = rel?.path ? entries[rel.path] : null;
      return [key, bytes ? `bytes:${bytes.byteLength}:${hashBytes(bytes)}` : `rel:${rel?.type ?? ''}`];
    }
    return [key, withResolvedRelationships(value, rels, entries)];
  }));
}

function box(xfrm, frame) {
  if (!object(xfrm)) return 'inherit';
  const off = xfrm['a:off'], ext = xfrm['a:ext'];
  // Table rows grow when a viewer reflows cell text, so a table frame's height
  // is not layout structure. Position and width are.
  return [off?.x, off?.y, ext?.cx, frame ? '' : ext?.cy, xfrm.rot ?? '0', xfrm.flipH ?? '0', xfrm.flipV ?? '0'].map(value => String(value ?? '')).join(',');
}

function structure(tree) {
  const kinds = {};
  const add = (kind, value) => (kinds[kind] ??= []).push(value);
  for (const node of array(tree?.['p:sp'])) add('sp', box(node?.['p:spPr']?.['a:xfrm']));
  for (const node of array(tree?.['p:pic'])) add('pic', box(node?.['p:spPr']?.['a:xfrm']));
  for (const node of array(tree?.['p:cxnSp'])) add('cxnSp', box(node?.['p:spPr']?.['a:xfrm']));
  for (const node of array(tree?.['p:graphicFrame'])) add('graphicFrame', box(node?.['p:xfrm'], true));
  for (const node of array(tree?.['p:grpSp'])) add('grpSp', `${box(node?.['p:grpSpPr']?.['a:xfrm'])}[${structure(node)}]`);
  for (const kind of ['p:contentPart', 'mc:AlternateContent']) if (tree?.[kind] !== undefined) add(kind, String(array(tree[kind]).length));
  // Stacking order is not structure; object kinds, positions and sizes are.
  return canonical(Object.fromEntries(Object.entries(kinds).map(([kind, values]) => [kind, values.sort()])));
}

function styleSignature(tree) {
  const faces = new Set(), colors = new Set();
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!object(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (/^a:(latin|ea|cs|sym)$/.test(key)) for (const font of array(value)) if (object(font) && font.typeface !== undefined) faces.add(String(font.typeface));
      if (/^a:(srgbClr|schemeClr|sysClr|prstClr)$/.test(key)) for (const color of array(value)) colors.add(`${key}:${object(color) ? String(color.val ?? '').toUpperCase() : ''}`);
      visit(value);
    }
  };
  visit(tree);
  return canonical({faces: [...faces].sort(), colors: [...colors].sort()});
}

function nativeSlide(entries, path) {
  const root = parser.parse(dec.decode(entries[path]))?.['p:sld'];
  const cSld = root?.['p:cSld'], tree = cSld?.['p:spTree'];
  const rels = relationships(entries, path);
  return {
    structure: hash(structure(tree)),
    background: hash(canonical(withResolvedRelationships(withoutExtensions(cSld?.['p:bg'] ?? null), rels, entries))),
    style: hash(styleSignature(withoutExtensions(tree ?? null)))
  };
}

// ---------------------------------------------------------------------------
// Export

export const PROVENANCE_MODES = Object.freeze(['full', 'references-only']);
const sizeOf = value => enc.encode(JSON.stringify(value)).byteLength;
// The tag value is the UTF-8 JSON as uppercase hex: two characters per byte.
const tagChars = value => sizeOf(value) * 2;
const SOURCE_KEYS = new Set(['src', 'image', 'logo', 'photo']);
const SOURCE_PREFIX = /^(asset:|data:|https?:|file:)/i;
const METADATA_CATALOGS = Object.freeze({narrative: 'narratives', tone: 'tones', purpose: 'purposes', language: 'languages', audience: 'audiences'});

function collectStrings(value, into = new Set()) {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, into));
  else if (object(value)) Object.values(value).forEach(item => collectStrings(item, into));
  return into;
}

// True when a value names an image, logo, file or URL rather than only catalog ids and settings.
function carriesSource(value) {
  if (typeof value === 'string') return SOURCE_PREFIX.test(value);
  if (Array.isArray(value)) return value.some(carriesSource);
  if (object(value)) return Object.entries(value).some(([key, item]) => SOURCE_KEYS.has(key) || carriesSource(item));
  return false;
}

// Inline catalog records are kept only when referenced, so restored ids
// resolve without copying unrelated catalog content.
function pruneCatalogs(catalogs, referenced) {
  if (!object(catalogs)) return undefined;
  const result = {};
  for (const [kind, entry] of Object.entries(catalogs)) {
    if (Array.isArray(entry)) {
      const records = entry.filter(record => typeof record?.id === 'string' && referenced.has(record.id));
      if (records.length) result[kind] = records;
    } else if (object(entry)) {
      const records = array(entry.records).filter(record => typeof record?.id === 'string' && referenced.has(record.id));
      const kept = {...(entry.source !== undefined ? {source: entry.source} : {}), ...(records.length ? {records} : {})};
      if (Object.keys(kept).length) result[kind] = kept;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

// A referenced record can itself refer to another inline record (a theme to its color scheme).
function referencedCatalogs(catalogs, referenced) {
  let pruned = pruneCatalogs(catalogs, referenced);
  for (let pass = 0; pass < 3 && pruned; pass += 1) {
    const ids = new Set(referenced);
    for (const entry of Object.values(pruned)) for (const record of array(Array.isArray(entry) ? entry : entry?.records)) collectStrings(record, ids);
    const next = pruneCatalogs(catalogs, ids);
    if (same(next, pruned)) break;
    pruned = next;
  }
  return pruned;
}

const assetReferences = value => [...collectStrings(value)].filter(item => item.startsWith('asset:')).map(item => item.slice(6));

/**
 * The references and metadata to persist, before package-dependent checks.
 * Only values the document states are stored; engine defaults are not.
 *
 * mode 'full' stores deck design references and composition defaults, the
 * METADATA fields, slide id/beat/layout/type/composition and slide design
 * references, the assets those values reference, and referenced inline
 * catalog records. mode 'references-only' stores catalog references only:
 * design references and hints that name no image, file or URL, slide
 * layout/type/composition/beat and slide design references of that kind,
 * narrative/tone/purpose/language/audience only as catalog ids, and the inline
 * catalog records those ids need. It stores no organization, speaker,
 * free-text metadata, slide ids or assets.
 */
export function documentProvenance(presentation, {mode = 'full', isCatalogId = () => false, report = () => {}} = {}) {
  const referencesOnly = mode === 'references-only';
  const design = {}, metadata = {};
  for (const key of [...DESIGN_REFERENCES, ...COMPOSITION_HINTS]) {
    if (!own(presentation.design, key)) continue;
    if (referencesOnly && carriesSource(presentation.design[key])) continue;
    design[key] = clone(presentation.design[key]);
  }
  for (const key of METADATA) {
    if (!own(presentation, key)) continue;
    const value = presentation[key];
    if (referencesOnly) {
      const kind = METADATA_CATALOGS[key];
      const ids = typeof value === 'string' ? [value] : key === 'audience' && Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
      if (!kind || !ids || !ids.every(id => isCatalogId(kind, id))) continue;
    }
    metadata[key] = clone(value);
  }
  const slides = presentation.slides.map((slide, index) => {
    const record = {v: 1, slide: index};
    for (const key of [...(referencesOnly ? [] : ['id']), 'beat', ...SLIDE_STRUCTURE]) if (own(slide, key)) record[key] = clone(slide[key]);
    const slideDesign = {};
    for (const key of [...STYLE_REFERENCES, 'background', ...COMPOSITION_HINTS]) {
      if (!own(slide.design, key) || (referencesOnly && carriesSource(slide.design[key]))) continue;
      slideDesign[key] = clone(slide.design[key]);
    }
    if (Object.keys(slideDesign).length) record.design = slideDesign;
    return record;
  });
  const stated = Object.keys(design).length || Object.keys(metadata).length || slides.some(record => Object.keys(record).length > 2);
  if (!stated) return null;
  const document = {v: 1, slides: slides.length};
  if (Object.keys(design).length) document.design = design;
  if (Object.keys(metadata).length) document.metadata = metadata;
  const stored = [design, metadata, slides];
  const assetIds = [...new Set(assetReferences(stored))].filter(id => own(presentation.assets, id));
  if (assetIds.length) document.assets = Object.fromEntries(assetIds.map(id => [id, clone(presentation.assets[id])]));
  const {catalogs, ...rest} = presentation;
  const catalogRecords = referencedCatalogs(catalogs, collectStrings(referencesOnly ? stored : rest));
  if (catalogRecords) document.catalogs = catalogRecords;
  return {mode, document, slides, report};
}

function base64ToBytes(value) {
  const binary = atob(value.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

const sameBytes = (a, b) => a.byteLength === b.byteLength && a.every((value, index) => value === b[index]);

// Embedded data: sources are never copied into a tag. A data URI whose bytes
// are an exported media part becomes a reference to that part; any other data
// URI makes the value unstorable.
function mediaExternalizer(entries) {
  const media = new Map();
  for (const [path, bytes] of Object.entries(entries)) {
    if (!/^ppt\/media\/[^/]+$/.test(path)) continue;
    const key = `${bytes.byteLength}:${hashBytes(bytes)}`;
    media.set(key, [...(media.get(key) ?? []), path]);
  }
  const find = bytes => (media.get(`${bytes.byteLength}:${hashBytes(bytes)}`) ?? []).find(path => sameBytes(entries[path], bytes));
  return function externalize(value) {
    let missing = false;
    const visit = item => {
      if (typeof item === 'string' && /^data:/i.test(item)) {
        const match = item.match(/^data:([\w.+-]+\/[\w.+-]+)?((?:;[^;,]*)*?)(;base64)?,([\s\S]*)$/i);
        let bytes = null;
        try { if (match) bytes = match[3] ? base64ToBytes(match[4]) : enc.encode(decodeURIComponent(match[4])); } catch { bytes = null; }
        const path = bytes && find(bytes);
        if (!path) { missing = true; return item; }
        return {$opfMedia: path, prefix: `data:${match[1] || 'application/octet-stream'};base64,`};
      }
      if (Array.isArray(item)) return item.map(visit);
      if (object(item)) return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, visit(value)]));
      return item;
    };
    const result = visit(value);
    return {value: result, missing};
  };
}

function tagPart(name, value) {
  return enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${name}" val="${encodeTextTag(value)}"/></p:tagLst>`);
}

function freeId(relsXml, base) {
  const ids = new Set([...relsXml.matchAll(/\bId="([^"]+)"/g)].map(match => match[1]));
  let id = base;
  while (ids.has(id)) id += '_';
  return id;
}

/**
 * Make the collected provenance storable against the final package: data:
 * sources become media-part references, per-field size limits apply, fields
 * that name an unstorable asset are dropped, and the whole tag must stay below
 * the import limit. Every omission is reported with its OPF path.
 */
function storable(entries, provenance) {
  const report = provenance.report ?? (() => {});
  // Omitted paths are recorded so import knows the source stated them and keeps observed values.
  const omitted = [];
  const omit = (path, reason) => { omitted.push(path); report({code: 'document-provenance-omitted', path, message: `${path} is not stored in the PPTX because ${reason}; reimport keeps the values observed in the PPTX instead.`}); };
  const externalize = mediaExternalizer(entries);
  const prepare = (path, value, limit = MAX_FIELD_BYTES) => {
    const {value: result, missing} = externalize(value);
    if (missing) { omit(path, 'it embeds a data: source that is not one of the exported media parts'); return undefined; }
    if (sizeOf(result) > limit) { omit(path, `it is larger than ${limit / 1024} KiB`); return undefined; }
    return result;
  };
  const source = provenance.document;
  const document = {v: 1, slides: source.slides};
  const assets = {};
  for (const [id, asset] of Object.entries(source.assets ?? {})) {
    const value = prepare(`assets.${id}`, asset);
    if (value !== undefined) assets[id] = value;
  }
  const unstoredAsset = value => assetReferences(value).some(id => !Object.hasOwn(assets, id) && own(source.assets, id));
  for (const section of ['design', 'metadata']) {
    const fields = {};
    for (const [key, value] of Object.entries(source[section] ?? {})) {
      const path = section === 'design' ? `design.${key}` : key;
      // A design reference is only restorable together with its asset.
      if (section === 'design' && unstoredAsset(value)) { omit(path, 'the asset it references could not be stored'); continue; }
      const prepared = prepare(path, value);
      if (prepared !== undefined) fields[key] = prepared;
    }
    if (Object.keys(fields).length) document[section] = fields;
  }
  if (Object.keys(assets).length) document.assets = assets;
  if (source.catalogs !== undefined) {
    const catalogs = prepare('catalogs', source.catalogs, MAX_CATALOG_BYTES);
    if (catalogs !== undefined) document.catalogs = catalogs;
  }
  const slides = provenance.slides.map((record, index) => {
    const result = {v: 1, slide: index};
    for (const key of ['id', 'beat', ...SLIDE_STRUCTURE]) {
      if (record[key] === undefined) continue;
      const value = prepare(`slides.${index}.${key}`, record[key]);
      if (value !== undefined) result[key] = value;
    }
    const slideDesign = {};
    for (const [key, value] of Object.entries(record.design ?? {})) {
      const path = `slides.${index}.design.${key}`;
      if (unstoredAsset(value)) { omit(path, 'the asset it references could not be stored'); continue; }
      const prepared = prepare(path, value);
      if (prepared !== undefined) slideDesign[key] = prepared;
    }
    if (Object.keys(slideDesign).length) result.design = slideDesign;
    return result;
  });
  // Keep the whole tag importable: shed the largest optional content first.
  const budget = MAX_TAG_CHARS - 64 * 1024;
  const shed = (holder, path) => { omit(path, `the tag would exceed the ${MAX_TAG_CHARS / (1024 * 1024)} MiB import limit`); };
  while (tagChars(document) > budget) {
    if (document.catalogs) { delete document.catalogs; shed(document, 'catalogs'); continue; }
    if (document.assets) { delete document.assets; shed(document, 'assets'); continue; }
    const candidates = ['metadata', 'design'].flatMap(section => Object.entries(document[section] ?? {}).map(([key, value]) => ({section, key, size: sizeOf(value)})));
    if (!candidates.length) break;
    const largest = candidates.sort((a, b) => b.size - a.size)[0];
    delete document[largest.section][largest.key];
    shed(document, largest.section === 'design' ? `design.${largest.key}` : largest.key);
  }
  for (const [index, record] of slides.entries()) {
    while (tagChars(record) > budget) {
      const candidates = [...['id', 'beat', ...SLIDE_STRUCTURE].filter(key => record[key] !== undefined).map(key => ({key, size: sizeOf(record[key])})),
        ...Object.keys(record.design ?? {}).map(key => ({key, design: true, size: sizeOf(record.design[key])}))];
      if (!candidates.length) break;
      const largest = candidates.sort((a, b) => b.size - a.size)[0];
      if (largest.design) delete record.design[largest.key]; else delete record[largest.key];
      shed(record, `slides.${index}.${largest.design ? 'design.' : ''}${largest.key}`);
    }
  }
  for (const path of omitted.slice(0, MAX_OMITTED)) {
    const slide = path.match(/^slides\.(\d+)\.(.+)$/);
    const holder = slide ? slides[Number(slide[1])] : document;
    (holder.omitted ??= []).push(slide ? slide[2] : path);
  }
  return {document, slides};
}

/**
 * Record native evidence from the final normalized parts and write the tags.
 * `entries` maps part paths to bytes and is updated in place.
 */
export function attachDocumentProvenance(entries, provenance) {
  if (!provenance) return;
  const presentationXml = dec.decode(entries['ppt/presentation.xml']);
  const presentationRoot = parser.parse(presentationXml)['p:presentation'];
  const rels = relationships(entries, 'ppt/presentation.xml');
  const paths = slidePaths(entries, presentationRoot, rels);
  if (paths.length !== provenance.slides.length) throw Error('Generated slide count differs from the document.');
  const prepared = storable(entries, provenance);
  const types = [];
  const document = {...prepared.document, native: nativeDocument(entries, presentationRoot, rels)};

  // CT_Presentation: custDataLst follows photoAlbum and precedes kinsoku/defaultTextStyle/modifyVerifier/extLst.
  const documentPart = 'ppt/tags/opfDocument.xml';
  if (entries[documentPart] || /<p:custDataLst\b/.test(presentationXml)) throw Error('Colliding presentation customer data.');
  let presentationRels = dec.decode(entries['ppt/_rels/presentation.xml.rels']);
  const documentId = freeId(presentationRels, 'rIdOpfDocument');
  const anchor = presentationXml.search(/<p:(kinsoku|defaultTextStyle|modifyVerifier|extLst)\b|<\/p:presentation>/);
  if (anchor < 0) throw Error('Generated presentation part has no closing element.');
  entries['ppt/presentation.xml'] = enc.encode(`${presentationXml.slice(0, anchor)}<p:custDataLst><p:tags r:id="${documentId}"/></p:custDataLst>${presentationXml.slice(anchor)}`);
  entries['ppt/_rels/presentation.xml.rels'] = enc.encode(presentationRels.replace('</Relationships>', `<Relationship Id="${documentId}" Type="${REL_TAGS}" Target="tags/opfDocument.xml"/></Relationships>`));
  entries[documentPart] = tagPart(DOCUMENT_TAG, document);
  types.push(documentPart);

  for (const [index, path] of paths.entries()) {
    const record = {...prepared.slides[index], native: nativeSlide(entries, path)};
    const tag = `<p:tag name="${SLIDE_TAG}" val="${encodeTextTag(record)}"/>`;
    let xml = dec.decode(entries[path]);
    const slideRels = relsPath(path);
    let relsXml = dec.decode(entries[slideRels]);
    // CT_CustomerDataList allows one p:tags: join the slide's existing tag list (furniture) when present.
    const existing = xml.match(/<\/p:spTree>\s*<p:custDataLst>\s*<p:tags r:id="([^"]+)"\s*\/>/);
    if (existing) {
      const target = relationships(entries, path).get(existing[1]);
      if (target?.type !== REL_TAGS || !target.path || !entries[target.path]) throw Error('Generated slide tag relationship is missing.');
      entries[target.path] = enc.encode(dec.decode(entries[target.path]).replace('</p:tagLst>', `${tag}</p:tagLst>`));
      continue;
    }
    if (!xml.includes('</p:spTree>') || /<\/p:spTree>\s*<p:custDataLst\b/.test(xml)) throw Error('Generated slide has no shape tree or unexpected customer data.');
    const part = `ppt/tags/opfSlide${index + 1}.xml`;
    if (entries[part]) throw Error('Colliding slide tag part.');
    const id = freeId(relsXml, 'rIdOpfSlide');
    entries[path] = enc.encode(xml.replace('</p:spTree>', `</p:spTree><p:custDataLst><p:tags r:id="${id}"/></p:custDataLst>`));
    entries[slideRels] = enc.encode(relsXml.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL_TAGS}" Target="../tags/opfSlide${index + 1}.xml"/></Relationships>`));
    entries[part] = enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}">${tag}</p:tagLst>`);
    types.push(part);
  }
  const contentTypes = dec.decode(entries['[Content_Types].xml']);
  entries['[Content_Types].xml'] = enc.encode(contentTypes.replace('</Types>', types.map(part => `<Override PartName="/${part}" ContentType="${TAGS_TYPE}"/>`).join('') + '</Types>'));
}

// ---------------------------------------------------------------------------
// Import

function readTag(entries, container, rels, name) {
  const found = [];
  let unreadable = false;
  for (const link of array(container?.['p:tags'])) {
    const rel = rels.get(link?.['r:id']);
    if (rel?.type !== REL_TAGS || rel.external || rel.targetMode === 'External' || !rel.path || !entries[rel.path]) { unreadable = true; continue; }
    try { found.push(...array(parser.parse(dec.decode(entries[rel.path]))?.['p:tagLst']?.['p:tag']).filter(tag => String(tag?.name ?? '').toUpperCase() === name)); }
    catch { unreadable = true; }
  }
  if (!found.length) return {missing: true, unreadable};
  if (found.length > 1) throw Error(`Multiple ${name} tags.`);
  const value = found[0].val;
  if (typeof value !== 'string' || value.length > MAX_TAG_CHARS) throw Error(`Oversized or empty ${name} tag.`);
  return {value: decodeTextTag(value)};
}

function validateOmitted(value) {
  if (value !== undefined && (!Array.isArray(value) || value.length > MAX_OMITTED || !value.every(path => typeof path === 'string' && /^[A-Za-z0-9_.:+-]{1,256}$/.test(path)))) throw Error('Invalid omitted field list.');
}

function validateDocument(value) {
  if (!object(value) || value.v !== 1 || !Number.isSafeInteger(value.slides) || value.slides < 1) throw Error('Unsupported document provenance version.');
  for (const key of ['design', 'metadata', 'catalogs', 'assets']) if (value[key] !== undefined && !object(value[key])) throw Error(`Invalid ${key} record.`);
  if (!object(value.native)) throw Error('Missing native evidence.');
  for (const key of Object.keys(value.design ?? {})) if (![...DESIGN_REFERENCES, ...COMPOSITION_HINTS].includes(key)) throw Error(`Unknown design field ${key}.`);
  for (const key of Object.keys(value.metadata ?? {})) if (!METADATA.includes(key)) throw Error(`Unknown metadata field ${key}.`);
  validateOmitted(value.omitted);
  return value;
}

function validateSlide(value) {
  if (!object(value) || value.v !== 1 || !Number.isSafeInteger(value.slide) || value.slide < 0) throw Error('Unsupported slide provenance version.');
  if (!object(value.native) || typeof value.native.structure !== 'string' || typeof value.native.background !== 'string' || typeof value.native.style !== 'string') throw Error('Missing slide native evidence.');
  if (value.design !== undefined && !object(value.design)) throw Error('Invalid slide design record.');
  for (const key of Object.keys(value.design ?? {})) if (![...STYLE_REFERENCES, 'background', ...COMPOSITION_HINTS].includes(key)) throw Error(`Unknown slide design field ${key}.`);
  validateOmitted(value.omitted);
  return value;
}

const label = value => typeof value === 'string' ? `'${value}'` : object(value) && typeof value.id === 'string' ? `'${value.id}' (with inline overrides)` : 'inline value';

function changedSlots(stored, observed) {
  if (!object(stored) || !object(observed)) return 'theme missing';
  const keys = [...new Set([...Object.keys(stored), ...Object.keys(observed)])].filter(key => !same(stored[key], observed[key]));
  return keys.join(', ') || 'unreadable';
}

// Media references back to data: URIs from the current package bytes.
function resolveMedia(value, entries) {
  let unresolved = false;
  const visit = item => {
    if (Array.isArray(item)) return item.map(visit);
    if (!object(item)) return item;
    if (Object.hasOwn(item, '$opfMedia')) {
      const {$opfMedia: path, prefix} = item;
      const bytes = typeof path === 'string' && /^ppt\/media\/[^/]+$/.test(path) ? entries[path] : undefined;
      if (!bytes || Object.keys(item).length !== 2 || typeof prefix !== 'string' || !/^data:[\w.+-]+\/[\w.+-]+;base64,$/.test(prefix)) { unresolved = true; return null; }
      return prefix + bytesToBase64(bytes);
    }
    return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, visit(value)]));
  };
  const result = visit(value);
  return {value: result, unresolved};
}

// Remove properties and list items whose asset: reference does not resolve.
function pruneDangling(value, dangling, path, removed) {
  const isDangling = item => (typeof item === 'string' && item.startsWith('asset:') && dangling(item.slice(6)))
    || (object(item) && typeof item.src === 'string' && item.src.startsWith('asset:') && dangling(item.src.slice(6)));
  if (Array.isArray(value)) return value.flatMap((item, index) => isDangling(item) ? (removed.push(`${path}.${index}`), []) : [pruneDangling(item, dangling, `${path}.${index}`, removed)]);
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => isDangling(item) ? (removed.push(`${path}.${key}`), []) : [[key, pruneDangling(item, dangling, `${path}.${key}`, removed)]]));
}

/**
 * Read OPF_DOCUMENT_V1 / OPF_SLIDE_V1 and decide what still matches the
 * package. Nothing is modified here: the result lists restore groups (one per
 * OPF field; background deduplication belongs to design.background) for
 * applyDocumentProvenance, and per-slide layout evidence.
 *
 * slides[i] = {layout, structure: 'match' | 'changed' | 'untagged', record, catalogRecord}
 * is the contract for layout-structure recovery (FF-29): `record` is the
 * validated OPF_SLIDE_V1 value (layout, type, composition, design hints, ...),
 * `catalogRecord` the stored inline layouts record for `layout`, if any.
 */
export function restoreDocumentProvenance(imported, {entries, presentationRoot, presentationRels, slides, organizationConflict = false}, report) {
  const untagged = {groups: [], slides: slides.map(() => ({structure: 'untagged'})), finalize: doc => doc};
  const invalid = message => report({code: 'invalid-document-provenance', path: '', message: `${message} Ordinary import keeps the values observed in the PPTX.`});
  let document;
  try {
    const found = readTag(entries, presentationRoot?.['p:custDataLst'], presentationRels, DOCUMENT_TAG);
    if (found.missing) {
      if (found.unreadable) invalid('Presentation customer data could not be read.');
      return untagged;
    }
    document = validateDocument(found.value);
  } catch (error) { invalid(`${error.message}`); return untagged; }

  const slideRecords = slides.map(({root, relationships: rels, path}, index) => {
    try {
      const found = readTag(entries, root?.['p:cSld']?.['p:custDataLst'], rels, SLIDE_TAG);
      if (found.missing) return null;
      return {record: validateSlide(found.value), native: nativeSlide(entries, path)};
    } catch (error) {
      report({code: 'invalid-document-provenance', path: `slides.${index}`, message: `${error.message} This slide keeps the values observed in the PPTX.`});
      return null;
    }
  });

  // Stored assets resolve against current media parts; a missing part leaves the asset unavailable.
  const storedAssets = {};
  for (const [id, asset] of Object.entries(object(document.assets) ? document.assets : {})) {
    const {value, unresolved} = resolveMedia(asset, entries);
    if (!unresolved) storedAssets[id] = value;
  }
  const available = id => own(imported.assets, id) || Object.hasOwn(storedAssets, id);
  const groups = [];
  const changed = (path, message) => report({code: 'design-reference-changed', path, message});
  // A value is restorable only when its media and asset references resolve.
  const restorable = (field, value, {prune = false} = {}) => {
    const {value: resolved, unresolved} = resolveMedia(value, entries);
    if (unresolved) { report({code: 'unresolved-asset-reference', path: field, message: `${field} refers to a picture that is no longer in the PPTX, so it was not restored; the imported document keeps the values observed in the PPTX.`}); return undefined; }
    const missing = [...new Set(assetReferences(resolved).filter(id => !available(id)))];
    if (!missing.length) return resolved;
    if (!prune) { report({code: 'unresolved-asset-reference', path: field, message: `${field} refers to asset '${missing[0]}', which the PPTX no longer provides, so it was not restored; the imported document keeps the values observed in the PPTX.`}); return undefined; }
    const removed = [];
    const pruned = pruneDangling(resolved, id => !available(id), field, removed);
    for (const path of removed) report({code: 'unresolved-asset-reference', path, message: `${path} refers to an asset the PPTX no longer provides and was left out of the restored ${field}.`});
    return pruned;
  };
  const group = (field, ops) => groups.push({field, ops});
  const set = (path, value) => ({path, value});
  const remove = path => ({path, remove: true});

  const notStored = path => report({code: 'document-provenance-omitted', path, message: `${path} was stated in the source document but not stored at export, so the imported document keeps the values observed in the PPTX.`});
  for (const path of array(document.omitted)) notStored(path);
  for (const [index, entry] of slideRecords.entries()) for (const path of array(entry?.record.omitted)) notStored(`slides.${index}.${path}`);

  const native = nativeDocument(entries, presentationRoot, presentationRels);
  const stored = document.native;
  const match = {colors: same(stored.colors, native.colors) && native.colors !== null, fonts: same(stored.fonts, native.fonts) && native.fonts !== null, size: same(stored.size, native.size)};
  const storedDesign = document.design ?? {};
  const gates = {
    theme: [match.colors && match.fonts, () => `The PPTX theme colors or fonts changed since export (${[match.colors ? '' : changedSlots(stored.colors, native.colors), match.fonts ? '' : `${changedSlots(stored.fonts, native.fonts)} font`].filter(Boolean).join('; ')}).`],
    colorScheme: [match.colors, () => `The PPTX theme colors changed since export (${changedSlots(stored.colors, native.colors)}).`],
    fontScheme: [match.fonts, () => `The PPTX theme fonts changed since export (${changedSlots(stored.fonts, native.fonts)} font).`],
    dimensions: [match.size, () => `The PPTX slide size changed since export.`]
  };
  const restoredStyle = {};
  for (const key of ['theme', 'colorScheme', 'fontScheme', 'dimensions']) {
    const [ok, why] = gates[key];
    // Keys FF-24 recovers that the source never stated (a theme-only deck
    // gains its colorScheme) are left as observed; see docs/document-roundtrip.md.
    if (storedDesign[key] === undefined) continue;
    if (!ok) { restoredStyle[key] = false; changed(`design.${key}`, `${why()} design.${key} ${label(storedDesign[key])} was not restored; the imported document keeps the values observed in the PPTX.`); continue; }
    const value = restorable(`design.${key}`, storedDesign[key]);
    if (value === undefined) { restoredStyle[key] = false; continue; }
    restoredStyle[key] = true;
    group(`design.${key}`, [set(['design', key], value)]);
  }
  const styleIntact = STYLE_REFERENCES.every(key => restoredStyle[key] !== false);

  // Slide-level references.
  const layouts = [];
  const seenIds = new Set();
  const storedLayouts = document.catalogs?.layouts;
  const layoutRecords = array(Array.isArray(storedLayouts) ? storedLayouts : storedLayouts?.records);
  let allStructure = slideRecords.length === document.slides && slideRecords.every(Boolean);
  const backgroundInheritors = [];
  for (const [index, slide] of imported.slides.entries()) {
    const entry = slideRecords[index];
    if (!entry) { layouts.push({structure: 'untagged'}); allStructure = false; continue; }
    const {record, native: observed} = entry;
    const structureMatch = record.native.structure === observed.structure;
    if (!structureMatch) allStructure = false;
    const {native: _native, ...recordValue} = record;
    const layout = typeof record.layout === 'string' ? record.layout : undefined;
    layouts.push({layout, structure: structureMatch ? 'match' : 'changed', record: clone(recordValue),
      ...(layout && layoutRecords.some(item => item?.id === layout) ? {catalogRecord: clone(layoutRecords.find(item => item?.id === layout))} : {})});
    const at = (...path) => ['slides', index, ...path];
    if (record.id !== undefined) {
      if (seenIds.has(record.id)) report({code: 'duplicate-slide-id', path: `slides.${index}.id`, message: `Slide id '${record.id}' appears on more than one slide (a duplicated slide); the first keeps it.`});
      else { seenIds.add(record.id); group(`slides.${index}.id`, [set(at('id'), clone(record.id))]); }
    }
    if (record.beat !== undefined) group(`slides.${index}.beat`, [set(at('beat'), clone(record.beat))]);
    for (const key of SLIDE_STRUCTURE) {
      if (record[key] === undefined) continue;
      if (structureMatch) group(`slides.${index}.${key}`, [set(at(key), clone(record[key]))]);
      else report({code: key === 'layout' ? 'layout-reference-changed' : 'slide-reference-changed', path: `slides.${index}.${key}`,
        message: `The slide's objects were moved, resized, added or removed since export, so slides.${index}.${key} ${label(record[key])} was not restored; the imported slide keeps its observed arrangement.`});
    }
    const recordDesign = record.design ?? {};
    for (const key of COMPOSITION_HINTS) {
      if (recordDesign[key] === undefined) continue;
      if (structureMatch) group(`slides.${index}.design.${key}`, [set(at('design', key), clone(recordDesign[key]))]);
      else changed(`slides.${index}.design.${key}`, `The slide's objects changed since export, so slides.${index}.design.${key} was not restored.`);
    }
    const styleMatch = record.native.style === observed.style;
    for (const key of STYLE_REFERENCES) {
      if (recordDesign[key] === undefined) continue;
      if (!styleMatch) { changed(`slides.${index}.design.${key}`, `The slide's fonts or colors changed since export, so slides.${index}.design.${key} ${label(recordDesign[key])} was not restored; the slide keeps its observed formatting.`); continue; }
      const value = restorable(`slides.${index}.design.${key}`, recordDesign[key]);
      if (value !== undefined) group(`slides.${index}.design.${key}`, [set(at('design', key), value)]);
    }
    const backgroundMatch = record.native.background === observed.background;
    if (recordDesign.background !== undefined) {
      if (!backgroundMatch) { changed(`slides.${index}.design.background`, `The slide background changed since export, so slides.${index}.design.background ${label(recordDesign.background)} was not restored; the slide keeps its observed background.`); continue; }
      const value = restorable(`slides.${index}.design.background`, recordDesign.background);
      if (value !== undefined) group(`slides.${index}.design.background`, [set(at('design', 'background'), value)]);
    } else if (!array(record.omitted).includes('design.background')) backgroundInheritors.push({index, backgroundMatch});
  }

  // A deck background is evidenced by the slides that inherit it. It is kept
  // while at least one of them still shows it (edited slides keep a local
  // override) or when every slide overrides it. Unchanged inheriting slides
  // then drop the background import observed on them.
  const backgroundOps = [];
  let deckBackground = storedDesign.background === undefined && !array(document.omitted).includes('design.background');
  if (storedDesign.background !== undefined) {
    if (!backgroundInheritors.length || backgroundInheritors.some(item => item.backgroundMatch)) {
      const value = restorable('design.background', storedDesign.background);
      if (value !== undefined) { backgroundOps.push(set(['design', 'background'], value)); deckBackground = true; }
    } else changed('design.background', `Every slide that inherited the deck background now shows a different background, so design.background ${label(storedDesign.background)} was not restored; slides keep their observed backgrounds.`);
  }
  if (deckBackground && styleIntact) {
    for (const {index, backgroundMatch} of backgroundInheritors) {
      if (backgroundMatch) { if (imported.slides[index]?.design?.background !== undefined) backgroundOps.push(remove(['slides', index, 'design', 'background'])); }
      else if (storedDesign.background !== undefined) changed(`slides.${index}.design.background`, `This slide's background changed since export; it is kept as a slide background override instead of inheriting design.background.`);
    }
  }
  if (backgroundOps.length) group('design.background', backgroundOps);

  for (const key of COMPOSITION_HINTS) {
    if (storedDesign[key] === undefined) continue;
    if (allStructure) group(`design.${key}`, [set(['design', key], clone(storedDesign[key]))]);
    else changed(`design.${key}`, `Slides were added, removed or rearranged since export, so the deck default design.${key} was not restored.`);
  }

  // Authoring metadata has no native counterpart. Fields read from native
  // content (the furniture organization name, linked socials) win over their
  // stored values; stored-only fields (logo, role ...) return.
  const metadata = document.metadata ?? {};
  for (const key of METADATA) {
    if (metadata[key] === undefined) continue;
    if (key === 'organization' && organizationConflict) {
      report({code: 'metadata-reference-changed', path: 'organization', message: 'Slides now show different organization names in their furniture, so the stored organization was not restored; each slide keeps its visible text.'});
      continue;
    }
    let value = restorable(key, metadata[key], {prune: true});
    if (value === undefined) continue;
    if (key === 'organization' && object(imported.organization)) {
      const observed = imported.organization;
      const list = array(value);
      const index = list.findIndex(item => object(item) && item.id === observed.id);
      if (index < 0) value = clone(observed);
      else if (Array.isArray(value)) value[index] = {...list[index], ...clone(observed)};
      else value = {...value, ...clone(observed)};
    }
    group(key, [set([key], value)]);
  }

  // Assets and inline catalog records follow what the restored document references.
  const finalize = doc => {
    const needed = [...new Set(assetReferences(doc))].filter(id => !own(doc.assets, id) && Object.hasOwn(storedAssets, id));
    if (needed.length) doc.assets = {...(object(doc.assets) ? doc.assets : {}), ...Object.fromEntries(needed.map(id => [id, clone(storedAssets[id])]))};
    if (object(document.catalogs)) {
      const {catalogs: _ignored, ...rest} = doc;
      const {value, unresolved} = resolveMedia(referencedCatalogs(document.catalogs, collectStrings(rest)), entries);
      if (value && !unresolved) doc.catalogs = value;
    }
    return doc;
  };
  return {groups, slides: layouts, finalize};
}

function applyOp(doc, {path, value, remove: removing}) {
  let holder = doc;
  for (const key of path.slice(0, -1)) {
    if (!object(holder[key]) && !Array.isArray(holder[key])) { if (removing) return; holder[key] = {}; }
    holder = holder[key];
  }
  const last = path.at(-1);
  if (removing) delete holder[last]; else holder[last] = clone(value);
}

function tidy(doc) {
  for (const slide of doc.slides ?? []) if (object(slide.design) && !Object.keys(slide.design).length) delete slide.design;
  if (object(doc.design) && !Object.keys(doc.design).length) delete doc.design;
  return doc;
}

/**
 * Apply restore groups to a copy of `imported`. When the combined result does
 * not validate, groups are applied one at a time and only the groups that make
 * the document invalid are left out, each with a diagnostic at its path.
 */
export function applyDocumentProvenance(imported, {groups, finalize}, validate, report) {
  const build = accepted => {
    const doc = structuredClone(imported);
    for (const item of accepted) for (const op of item.ops) applyOp(doc, op);
    return tidy(doc);
  };
  const all = finalize(build(groups));
  if (validate(all).valid) return all;
  const accepted = [];
  for (const item of groups) {
    if (validate(build([...accepted, item])).valid) accepted.push(item);
    else report({code: 'invalid-document-provenance', path: item.field, message: `The stored ${item.field} does not form a valid document with the imported content, so it was not restored; the imported document keeps the values observed in the PPTX.`});
  }
  const result = finalize(build(accepted));
  if (validate(result).valid) return result;
  report({code: 'invalid-document-provenance', path: 'catalogs', message: 'Stored inline catalog records or assets do not validate with the imported document and were not restored.'});
  return build(accepted);
}
