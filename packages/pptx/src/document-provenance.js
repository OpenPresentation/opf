import {XMLParser} from 'fast-xml-parser';
import {decodeTextTag, encodeTextTag} from './code-provenance.js';
import {contentTopology, rebuildContent, validateTopology, listLineBreaks, validateListBreaks} from './content-topology.js';
import {runColorRecord, validateRunColors} from './run-colors.js';
// Namespace import: cores before FF-34 do not export resolveSocialProfile.
import * as opfCore from '@openpresentation/opf';

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
//
// Layout intent (FF-29) is part of each OPF_SLIDE_V1 record: the slide's
// layout id, type, composition and composition hints, plus `layoutRecord`,
// the document's inline catalogs.layouts record for that id. The record is
// kept on the slide as well as in the document's catalogs, so a slide keeps
// its layout when OPF_DOCUMENT_V1 is missing or unreadable (for example a
// slide pasted into another deck), and a pasted slide brings its own record.
//
// Spec-gap closure P1 adds, in `full` mode: the document `filename` and
// `extensions`, the whole `assets` registry, `design.logo` (BRAND_ASSETS, also
// per slide), the slide `section` and `extensions`, and the slide's content
// topology (`content`, src/content-topology.js): nested groups, promoted
// regions, the root payload form, block ids, block extensions and group
// composition, with the reference-pixel box of every leaf. A `data:` source
// that is not an exported media part is stored inline while its field stays
// under the per-field limit.

export const DOCUMENT_TAG = 'OPF_DOCUMENT_V1';
export const SLIDE_TAG = 'OPF_SLIDE_V1';
const REL_TAGS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const TAGS_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml';
const MAX_OMITTED = 256;
const MAX_AUTHOR_LENGTH = 4096;
const MAX_FIELD_BYTES = 256 * 1024, MAX_CATALOG_BYTES = 1024 * 1024, MAX_TAG_CHARS = 16 * 1024 * 1024;

const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text', parseAttributeValue: false, parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const same = (a, b) => canonical(a) === canonical(b);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const own = (value, key) => object(value) && Object.hasOwn(value, key) && value[key] !== undefined;
// Furniture socials re-import as the displayed profile URL (FF-34). While a line
// still shows exactly what the stored authored value formats to, keep the
// authored form (a handle stays a handle); an edited line keeps its new URL.
function authoredSocials(stored, observed, records) {
  if (!object(stored) || !object(observed) || typeof opfCore.resolveSocialProfile !== 'function') return observed;
  return Object.fromEntries(Object.entries(observed).map(([platform, value]) => {
    const authored = stored[platform];
    if (typeof authored !== 'string') return [platform, value];
    const profile = opfCore.resolveSocialProfile(platform, authored, records, 'organization');
    const shown = profile.href && !/^[a-z][a-z0-9+.-]*:/i.test(profile.text) ? `https://${profile.text}` : profile.text;
    return [platform, shown === value ? authored : value];
  }));
}

// Deck-level fields. References are gated by native evidence; metadata has no
// native PowerPoint counterpart and round-trips from the stored value.
export const DESIGN_REFERENCES = Object.freeze(['theme', 'colorScheme', 'fontScheme', 'dimensions', 'background']);
export const COMPOSITION_HINTS = Object.freeze(['titleAlignment', 'contentAlignment', 'contentBox', 'contentDirection', 'chartPrimary', 'imageFill', 'listBullet']);
// `references` (RR-34): the deck's cited sources. Like `author`, stored as a top-level key of OPF_DOCUMENT_V1 (importers up to
// 0.11.9 drop a tag with an unknown `supplement` field but ignore an unknown top-level key) and read back into metadata.
export const METADATA = Object.freeze(['narrative', 'tone', 'audience', 'purpose', 'language', 'organization', 'speaker', 'takeaway', 'duration', 'tags', 'variables', 'filename', 'extensions', 'author', 'references']);

// `author` is native (docProps/core.xml dc:creator), where several authors share one field joined by "; " (the join the
// schema documents). Import splits a creator on exactly that separator, and only when every part is a non-empty name
// with no outer whitespace (so the split joins back to the identical text); a single name is never cut. The authored form (an array, or a string that itself holds a "; ") returns from the stored record
// while the creator still equals it; plain PPTX has no record and gets the split. The record is the top-level `author`
// of OPF_DOCUMENT_V1: importers up to 0.11.8 reject an unknown key inside `supplement` (dropping the whole tag) but ignore
// an unknown top-level key.
export const joinAuthors = author => Array.isArray(author) ? author.join('; ') : author;
export function splitAuthors(creator) {
  if (typeof creator !== 'string') return creator;
  const parts = creator.split('; ');
  return parts.length > 1 && parts.every(part => part && part === part.trim()) ? parts : creator;
}
// The creator the package gets when the document names no author. An imported default is not an authored value.
export const DEFAULT_AUTHOR = 'OpenPresentation';
// Stored only when the native creator cannot carry the authored form by itself (or would read as the default).
const authorNeedsRecord = author => Array.isArray(author) || (typeof author === 'string' && (author === DEFAULT_AUTHOR || Array.isArray(splitAuthors(author))));
// Brand images have no native gate: they return from the stored value once
// their media and asset references resolve. The P2 logo picture (`OPF_LOGO_V1`)
// consumes the drawn logo; `design.logo` itself always returns from here.
export const BRAND_ASSETS = Object.freeze(['logo']);
const STYLE_REFERENCES = ['theme', 'colorScheme', 'fontScheme'];
const SLIDE_STRUCTURE = ['layout', 'type', 'composition'];
// Slide fields with no native counterpart, restored from the stored value.
const SLIDE_METADATA = ['section', 'extensions'];
const DESIGN_FIELDS = [...DESIGN_REFERENCES, ...COMPOSITION_HINTS, ...BRAND_ASSETS];
const SLIDE_DESIGN_FIELDS = [...STYLE_REFERENCES, 'background', ...COMPOSITION_HINTS, ...BRAND_ASSETS];
// Importers up to 0.11.6 reject a document tag whose `design` or `metadata`
// holds a key they do not know (the whole tag is then dropped), and a slide tag
// whose `design` does. Keys added since are written under `supplement`, a
// top-level container those importers ignore, and merged back on read. Add
// every new design or metadata key here, never to the legacy sections.
const DOCUMENT_SUPPLEMENT = Object.freeze({design: BRAND_ASSETS, metadata: Object.freeze(['filename', 'extensions'])});
const SLIDE_SUPPLEMENT = Object.freeze({design: BRAND_ASSETS});

// Storage shape: move the supplement keys out of the legacy sections.
function toStoredShape(record, spec) {
  const result = {...record};
  const supplement = {};
  for (const [section, keys] of Object.entries(spec)) {
    if (!object(result[section])) continue;
    const kept = {}, moved = {};
    for (const [key, value] of Object.entries(result[section])) (keys.includes(key) ? moved : kept)[key] = value;
    if (Object.keys(moved).length) supplement[section] = moved;
    if (Object.keys(kept).length) result[section] = kept; else delete result[section];
  }
  if (Object.keys(supplement).length) result.supplement = supplement;
  return result;
}

// Read shape: validate the container and merge it back; a legacy section
// must not carry a supplement key (an old importer would reject the tag).
function fromStoredShape(value, spec) {
  if (value.supplement === undefined) return value;
  if (!object(value.supplement)) throw Error('Invalid supplement record.');
  const result = {...value};
  delete result.supplement;
  for (const [section, fields] of Object.entries(value.supplement)) {
    const keys = spec[section];
    if (!keys || !object(fields)) throw Error(`Invalid supplement section ${section}.`);
    for (const key of Object.keys(fields)) if (!keys.includes(key)) throw Error(`Unknown supplement field ${section}.${key}.`);
    if (result[section] !== undefined && !object(result[section])) throw Error(`Invalid ${section} record.`);
    result[section] = {...(result[section] ?? {}), ...fields};
  }
  return result;
}

// 53-bit non-cryptographic hash (cyrb53). Change detection only; tags are
// writable by anyone who can edit the file, so no authenticity is claimed.
const hash = text => hashUnits(text.length, index => text.charCodeAt(index));
export const hashText = hash;
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
  else if (object(value)) for (const [key, item] of Object.entries(value)) {
    // Socials keys are socialPlatforms catalog references (FF-34).
    if (key === 'socials' && object(item)) Object.keys(item).forEach(id => into.add(id));
    collectStrings(item, into);
  }
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

const layoutRecords = catalogs => array(Array.isArray(catalogs?.layouts) ? catalogs.layouts : catalogs?.layouts?.records);

// Presentation validation deliberately accepts arbitrary inline catalog objects.
// Recovered layouts must also pass their companion schema before composition
// can use them (for example, a null placeholder otherwise crashes rendering).
function validLayoutRecord(value) {
  // Inline catalogs already identify the kind. Supply only an omitted
  // standalone identifier for validation; never change the authored record.
  try { return object(value) && opfCore.validateCatalogRecord('layouts', {$schema: 'https://openpresentation.org/schema/opf-layout/v1', ...value}).valid; }
  catch { return false; }
}

function validatedLayoutCatalog(catalogs, entries, report, rejectedIds) {
  if (!object(catalogs) || catalogs.layouts === undefined) return catalogs;
  const current = catalogs.layouts;
  const records = layoutRecords(catalogs).flatMap((record, index) => {
    const {value, unresolved} = resolveMedia(record, entries);
    if (!unresolved && validLayoutRecord(value)) return [value];
    if (typeof record?.id === 'string') rejectedIds.add(record.id);
    const path = `catalogs.layouts.${Array.isArray(current) ? '' : 'records.'}${index}`;
    report({code: unresolved ? 'unresolved-asset-reference' : 'invalid-document-provenance', path,
      message: `The stored layout record at ${path} ${unresolved ? 'refers to unavailable media' : 'does not validate against the layouts catalog schema'}, so it was not restored.`});
    return [];
  });
  const result = {...catalogs};
  if (records.length) result.layouts = Array.isArray(current) ? records : {...current, records};
  else if (object(current) && current.source !== undefined) { result.layouts = {...current}; delete result.layouts.records; }
  else delete result.layouts;
  return Object.keys(result).length ? result : undefined;
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
  for (const key of DESIGN_FIELDS) {
    if (!own(presentation.design, key)) continue;
    if (referencesOnly && carriesSource(presentation.design[key])) continue;
    design[key] = clone(presentation.design[key]);
  }
  for (const key of METADATA) {
    if (!own(presentation, key)) continue;
    const value = presentation[key];
    if (key === 'author' && (referencesOnly || !authorNeedsRecord(value))) continue;
    if (referencesOnly) {
      const kind = METADATA_CATALOGS[key];
      const ids = typeof value === 'string' ? [value] : key === 'audience' && Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
      if (!kind || !ids || !ids.every(id => isCatalogId(kind, id))) continue;
    }
    metadata[key] = clone(value);
  }
  const slides = presentation.slides.map((slide, index) => {
    const record = {v: 1, slide: index};
    for (const key of [...(referencesOnly ? [] : ['id', ...SLIDE_METADATA]), 'beat', ...SLIDE_STRUCTURE]) if (own(slide, key)) record[key] = clone(slide[key]);
    const layoutRecord = typeof slide.layout === 'string' ? layoutRecords(presentation.catalogs).find(item => item?.id === slide.layout) : undefined;
    // The layout record is a catalog record. 'references-only' stores it only
    // when it names no image, file or URL; neither mode stores the assets it
    // references (as before FF-29, catalog records never pulled in assets).
    // A record's own $schema URL identifies its format and is not a source.
    if (layoutRecord && !(referencesOnly && carriesSource({...layoutRecord, $schema: undefined}))) record.layoutRecord = clone(layoutRecord);
    const slideDesign = {};
    for (const key of SLIDE_DESIGN_FIELDS) {
      if (!own(slide.design, key) || (referencesOnly && carriesSource(slide.design[key]))) continue;
      slideDesign[key] = clone(slide.design[key]);
    }
    if (Object.keys(slideDesign).length) record.design = slideDesign;
    return record;
  });
  const document = {v: 1, slides: slides.length};
  if (Object.keys(design).length) document.design = design;
  if (Object.keys(metadata).length) document.metadata = metadata;
  const stored = [design, metadata, slides];
  // 'full' stores the whole registry, so unreferenced assets return as authored;
  // 'references-only' stores no assets at all.
  if (!referencesOnly && object(presentation.assets) && Object.keys(presentation.assets).length) document.assets = clone(presentation.assets);
  const {catalogs, ...rest} = presentation;
  const catalogRecords = referencedCatalogs(catalogs, collectStrings(referencesOnly ? stored : rest));
  if (catalogRecords) document.catalogs = catalogRecords;
  // Slide content topology is added per slide by the exporter (recordContentTopology).
  const stated = Object.keys(design).length || Object.keys(metadata).length || document.assets !== undefined || slides.some(record => Object.keys(record).length > 2);
  return {mode, document, slides, report, stated: Boolean(stated)};
}

/**
 * Record the content topology of slide `index` from its composed geometry
 * items (`full` mode only). Structures the record cannot hold are reported as
 * `document-provenance-omitted` at `slides.N.content`.
 */
export function recordContentTopology(provenance, slide, index, items) {
  if (!provenance || provenance.mode !== 'full' || !provenance.slides[index]) return;
  // An unstorable structure is reported with the other omissions (storable) and recorded in the tag.
  const topology = contentTopology(slide, items, index, reason => { provenance.slides[index].omittedContent = reason; });
  if (!topology) return;
  provenance.slides[index].content = topology;
  // Variable, scheme-slot and role names of text runs (the native colour holds only what they resolve to).
  const colors = runColorRecord(slide);
  if (colors) provenance.slides[index].colors = colors;
  // Whitespace of the hard line breaks inside list items (their native lines carry no tag).
  const omittedLists = [];
  const lists = listLineBreaks(items, (path, reason) => omittedLists.push([path, reason]));
  if (lists) provenance.slides[index].lists = lists;
  if (omittedLists.length) provenance.slides[index].omittedLists = omittedLists;
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
const mediaKey = bytes => `${bytes.byteLength}:${hashBytes(bytes)}`;

// PowerPoint renames media parts (image-1-1.png becomes image1.png), renumbers relationships and merges identical
// images when it saves, so a stored $opfMedia part path can name another picture or none. The record therefore also
// carries `mediaHash` (a top-level key released importers ignore): the content key of every referenced part. On read a
// reference whose part no longer has those bytes follows the bytes to wherever the package keeps them now.
function mediaHashes(value, entries) {
  const hashes = {};
  const visit = item => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!object(item)) return;
    if (typeof item.$opfMedia === 'string') { if (entries[item.$opfMedia]) hashes[item.$opfMedia] = mediaKey(entries[item.$opfMedia]); return; }
    Object.values(item).forEach(visit);
  };
  visit(value);
  return hashes;
}

function remapMedia(value, entries) {
  const hashes = value.mediaHash;
  if (!object(hashes)) return value;
  let byKey;
  const find = key => {
    if (!byKey) {
      byKey = new Map();
      for (const [path, bytes] of Object.entries(entries)) if (/^ppt\/media\/[^/]+$/.test(path)) byKey.set(mediaKey(bytes), byKey.get(mediaKey(bytes)) ?? path);
    }
    return byKey.get(key);
  };
  const visit = item => {
    if (Array.isArray(item)) return item.map(visit);
    if (!object(item)) return item;
    if (typeof item.$opfMedia === 'string') {
      const key = hashes[item.$opfMedia];
      if (typeof key !== 'string' || (entries[item.$opfMedia] && mediaKey(entries[item.$opfMedia]) === key)) return item;
      const found = find(key);
      return found ? {...item, $opfMedia: found} : item;
    }
    return Object.fromEntries(Object.entries(item).map(([name, child]) => [name, visit(child)]));
  };
  const {mediaHash, ...rest} = value;
  return visit(rest);
}

// A data URI whose bytes are an exported media part becomes a reference to
// that part (no duplication). Any other data: source (an undrawn logo, a
// speaker photo, an unused asset) stays inline; the per-field size limit then
// decides whether the field is stored.
function mediaExternalizer(entries) {
  const media = new Map();
  for (const [path, bytes] of Object.entries(entries)) {
    if (!/^ppt\/media\/[^/]+$/.test(path)) continue;
    const key = `${bytes.byteLength}:${hashBytes(bytes)}`;
    media.set(key, [...(media.get(key) ?? []), path]);
  }
  const find = bytes => (media.get(`${bytes.byteLength}:${hashBytes(bytes)}`) ?? []).find(path => sameBytes(entries[path], bytes));
  return function externalize(value) {
    const visit = item => {
      if (typeof item === 'string' && /^data:/i.test(item)) {
        const match = item.match(/^data:([\w.+-]+\/[\w.+-]+)?((?:;[^;,]*)*?)(;base64)?,([\s\S]*)$/i);
        let bytes = null;
        try { if (match) bytes = match[3] ? base64ToBytes(match[4]) : enc.encode(decodeURIComponent(match[4])); } catch { bytes = null; }
        const path = bytes && find(bytes);
        if (!path) return item;
        return {$opfMedia: path, prefix: `data:${match[1] || 'application/octet-stream'};base64,`};
      }
      if (Array.isArray(item)) return item.map(visit);
      if (object(item)) return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, visit(value)]));
      return item;
    };
    return {value: visit(value)};
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
    const {value: result} = externalize(value);
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
      if (section === 'metadata' && (key === 'author' || key === 'references')) {
        const prepared = prepare(path, value);
        if (prepared !== undefined) document[key] = prepared;
        continue;
      }
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
    if (record.omittedContent) omit(`slides.${index}.content`, record.omittedContent);
    for (const [path, reason] of record.omittedLists ?? []) omit(path, reason);
    for (const key of ['id', 'beat', ...SLIDE_STRUCTURE, ...SLIDE_METADATA, 'content', 'colors', 'lists']) {
      if (record[key] === undefined) continue;
      const value = prepare(`slides.${index}.${key}`, record[key]);
      if (value !== undefined) result[key] = value;
    }
    // The layout record is only meaningful with its layout id and assets.
    if (record.layoutRecord !== undefined && result.layout !== undefined) {
      if (unstoredAsset(record.layoutRecord)) omit(`slides.${index}.layoutRecord`, 'the asset it references could not be stored');
      else {
        const value = prepare(`slides.${index}.layoutRecord`, record.layoutRecord);
        if (value !== undefined) result.layoutRecord = value;
      }
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
      const candidates = [...['id', 'beat', ...SLIDE_STRUCTURE, ...SLIDE_METADATA, 'content', 'colors', 'lists', 'layoutRecord'].filter(key => record[key] !== undefined).map(key => ({key, size: sizeOf(record[key])})),
        ...Object.keys(record.design ?? {}).map(key => ({key, design: true, size: sizeOf(record.design[key])}))];
      if (!candidates.length) break;
      const largest = candidates.sort((a, b) => b.size - a.size)[0];
      if (largest.design) delete record.design[largest.key]; else delete record[largest.key];
      if (largest.key === 'layout' && record.layoutRecord !== undefined) { delete record.layoutRecord; shed(record, `slides.${index}.layoutRecord`); }
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
  // A document that states nothing (no references, metadata, slide fields or
  // content topology) gets no tags and its bytes are unchanged.
  if (!provenance || !(provenance.stated || provenance.slides.some(record => record.content !== undefined))) return;
  const presentationXml = dec.decode(entries['ppt/presentation.xml']);
  const presentationRoot = parser.parse(presentationXml)['p:presentation'];
  const rels = relationships(entries, 'ppt/presentation.xml');
  const paths = slidePaths(entries, presentationRoot, rels);
  if (paths.length !== provenance.slides.length) throw Error('Generated slide count differs from the document.');
  const prepared = storable(entries, provenance);
  const types = [];
  const documentHashes = mediaHashes(prepared.document, entries);
  const document = toStoredShape({...prepared.document, ...(Object.keys(documentHashes).length ? {mediaHash: documentHashes} : {}), native: nativeDocument(entries, presentationRoot, rels)}, DOCUMENT_SUPPLEMENT);

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
    const slideHashes = mediaHashes(prepared.slides[index], entries);
    const record = toStoredShape({...prepared.slides[index], ...(Object.keys(slideHashes).length ? {mediaHash: slideHashes} : {}), native: nativeSlide(entries, path)}, SLIDE_SUPPLEMENT);
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

function validateDocument(stored) {
  if (!object(stored) || stored.v !== 1 || !Number.isSafeInteger(stored.slides) || stored.slides < 1) throw Error('Unsupported document provenance version.');
  const value = fromStoredShape(stored, DOCUMENT_SUPPLEMENT);
  for (const key of ['design', 'metadata', 'catalogs', 'assets']) if (value[key] !== undefined && !object(value[key])) throw Error(`Invalid ${key} record.`);
  for (const [section, keys] of Object.entries(DOCUMENT_SUPPLEMENT)) for (const key of keys) if (object(stored[section]) && stored[section][key] !== undefined) throw Error(`Supplement field ${section}.${key} stored in the legacy section.`);
  if (!object(value.native)) throw Error('Missing native evidence.');
  for (const key of Object.keys(value.design ?? {})) if (!DESIGN_FIELDS.includes(key)) throw Error(`Unknown design field ${key}.`);
  for (const key of Object.keys(value.metadata ?? {})) if (!METADATA.includes(key)) throw Error(`Unknown metadata field ${key}.`);
  if (value.metadata?.filename !== undefined && typeof value.metadata.filename !== 'string') throw Error('Invalid filename record.');
  if (value.metadata?.extensions !== undefined && !object(value.metadata.extensions)) throw Error('Invalid extensions record.');
  const author = stored.author;
  if (author !== undefined && !((typeof author === 'string' && author.length <= MAX_AUTHOR_LENGTH * 256) || (Array.isArray(author) && author.length > 0 && author.length <= 256 && author.every(name => typeof name === 'string' && name.length <= MAX_AUTHOR_LENGTH)))) throw Error('Invalid author record.');
  const references = stored.references;
  if (references !== undefined && (!Array.isArray(references) || references.length > 4096 || !references.every(object))) throw Error('Invalid references record.');
  validateOmitted(value.omitted);
  if (author !== undefined || references !== undefined) {
    const {author: _author, references: _references, ...rest} = value;
    return {...rest, metadata: {...rest.metadata, ...(author !== undefined ? {author} : {}), ...(references !== undefined ? {references} : {})}};
  }
  return value;
}

function validateSlide(stored) {
  if (!object(stored) || stored.v !== 1 || !Number.isSafeInteger(stored.slide) || stored.slide < 0) throw Error('Unsupported slide provenance version.');
  if (!object(stored.native) || typeof stored.native.structure !== 'string' || typeof stored.native.background !== 'string' || typeof stored.native.style !== 'string') throw Error('Missing slide native evidence.');
  if (stored.design !== undefined && !object(stored.design)) throw Error('Invalid slide design record.');
  for (const key of SLIDE_SUPPLEMENT.design) if (object(stored.design) && stored.design[key] !== undefined) throw Error(`Supplement field design.${key} stored in the legacy section.`);
  const value = fromStoredShape(stored, SLIDE_SUPPLEMENT);
  for (const key of Object.keys(value.design ?? {})) if (!SLIDE_DESIGN_FIELDS.includes(key)) throw Error(`Unknown slide design field ${key}.`);
  if (value.layoutRecord !== undefined && (!object(value.layoutRecord) || typeof value.layoutRecord.id !== 'string')) throw Error('Invalid slide layout record.');
  if (value.section !== undefined && typeof value.section !== 'string') throw Error('Invalid slide section record.');
  if (value.extensions !== undefined && !object(value.extensions)) throw Error('Invalid slide extensions record.');
  if (value.content !== undefined) validateTopology(value.content);
  if (value.colors !== undefined) validateRunColors(value.colors);
  if (value.lists !== undefined) validateListBreaks(value.lists);
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
 * The hard line breaks stored for the lists of one slide: Map(list path -> Map(line number -> gap)), or null when the slide
 * carries none, its record is unreadable, or its arrangement changed since export (the lines are then no longer the exported
 * ones). Read before the slide's shapes are merged into list blocks; any damage is reported later by restoreDocumentProvenance.
 */
export function slideListBreaks(entries, path, root, rels) {
  try {
    const found = readTag(entries, root?.['p:cSld']?.['p:custDataLst'], rels, SLIDE_TAG);
    if (found.missing) return null;
    const record = validateSlide(found.value);
    if (record.lists === undefined || record.native.structure !== nativeSlide(entries, path).structure) return null;
    return new Map(record.lists.map(([list, lines]) => [list, new Map(lines)]));
  } catch {
    return null;
  }
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
 *
 * `slides[i].contentBounds` are the native bounds (reference px) of the
 * imported blocks of slide i, in block order, for content topology matching.
 * `nativeSections` is the package's native section list as one name (or
 * undefined) per slide, or null when the package has no list.
 */
export function restoreDocumentProvenance(imported, {entries, presentationRoot, presentationRels, slides, organizationConflict = false, speakerConflict = false, socialPlatformRecords, nativeSections = null}, report) {
  const invalid = message => report({code: 'invalid-document-provenance', path: '', message: `${message} Ordinary import keeps the values observed in the PPTX.`});
  let document;
  try {
    const found = readTag(entries, presentationRoot?.['p:custDataLst'], presentationRels, DOCUMENT_TAG);
    if (found.missing) { if (found.unreadable) invalid('Presentation customer data could not be read.'); }
    else document = remapMedia(validateDocument(found.value), entries);
  } catch (error) { invalid(`${error.message}`); document = undefined; }

  const rejectedLayoutIds = new Set();
  if (document) document = {...document, catalogs: validatedLayoutCatalog(document.catalogs, entries, report, rejectedLayoutIds)};

  const slideRecords = slides.map(({root, relationships: rels, path}, index) => {
    try {
      const found = readTag(entries, root?.['p:cSld']?.['p:custDataLst'], rels, SLIDE_TAG);
      if (found.missing) return null;
      return {record: remapMedia(validateSlide(found.value), entries), native: nativeSlide(entries, path)};
    } catch (error) {
      report({code: 'invalid-document-provenance', path: `slides.${index}`, message: `${error.message} This slide keeps the values observed in the PPTX.`});
      return null;
    }
  });
  const groups = [];
  const group = (field, ops, contentPaths) => groups.push({field, ops, ...(contentPaths ? {contentPaths} : {})});
  const set = (path, value) => ({path, value});
  const remove = path => ({path, remove: true});
  const intent = layoutIntent(document ? layoutRecords(document.catalogs) : [], Boolean(document), slideRecords, entries, group, report, rejectedLayoutIds);

  // Slide and block ids must stay unique across the document; a duplicated
  // slide carries copies of both, and the first occurrence keeps them.
  const seenIds = new Set();
  // Content topology: while the slide's arrangement is unchanged, the imported
  // flat blocks are matched to the stored leaves and the authored form returns
  // (root payload, blocks with nested groups, or promoted regions). The slide
  // `type` joins that group, since it is only valid with the authored form.
  const restoreContent = (index, {record, native: observed}) => {
    if (record.content === undefined) return false;
    // The stored `type` belongs to the authored form: when that form is not restored, neither is the type.
    const typeNote = record.type === undefined ? '' : ` The stored slide type ${JSON.stringify(record.type)} was not restored either.`;
    if (record.native.structure !== observed.structure) {
      report({code: 'slide-reference-changed', path: `slides.${index}.content`, message: `The slide's objects were moved, resized, added or removed since export, so the authored content structure of slides.${index} (groups, regions, block ids) was not restored; the imported slide keeps its flat blocks.`});
      if (record.type !== undefined) report({code: 'slide-reference-changed', path: `slides.${index}.type`, message: `The slide's objects were moved, resized, added or removed since export, so slides.${index}.type ${JSON.stringify(record.type)} was not restored; the imported slide keeps its observed arrangement.`});
      return false;
    }
    let placedPaths;
    const result = rebuildContent(record.content, imported.slides[index]?.blocks ?? [], slides[index]?.contentBounds ?? [], paths => { placedPaths = paths; });
    if (result.reason) {
      report({code: 'content-structure-changed', path: `slides.${index}`, message: `The slide's content no longer matches its stored structure (${result.reason}), so the authored groups, regions and block ids of slides.${index} were not restored; the imported slide keeps its flat blocks.${typeNote}`});
      return false;
    }
    const dedupe = (value, path) => {
      if (Array.isArray(value)) { value.forEach((item, position) => dedupe(item, `${path}.${position}`)); return; }
      if (!object(value)) return;
      if (typeof value.id === 'string') {
        if (seenIds.has(value.id)) { report({code: 'duplicate-block-id', path: `${path}.id`, message: `Block id '${value.id}' appears more than once (a duplicated slide); the first keeps it.`}); delete value.id; }
        else seenIds.add(value.id);
      }
      if (Array.isArray(value.blocks)) dedupe(value.blocks, `${path}.blocks`);
    };
    const ops = [];
    for (const [key, value] of Object.entries(result.fields)) {
      if (value === null) { ops.push(remove(['slides', index, key])); continue; }
      if (key === 'blocks') dedupe(value, `slides.${index}.blocks`); else if (record.content.form === 'regions') dedupe(value, `slides.${index}.${key}`);
      ops.push(set(['slides', index, key], value));
    }
    if (record.type !== undefined) ops.push(set(['slides', index, 'type'], clone(record.type)));
    group(`slides.${index}.content`, ops, {slide: index, paths: placedPaths});
    return true;
  };

  // Sections: three sources can name a slide's section. The native section
  // list (PowerPoint's sections pane), the section text a footer shows, and the
  // stored OPF_SLIDE_V1 value. The list is native data and wins, except when
  // the list still equals the stored value and the footer text differs: then
  // the footer was edited and its text is kept, as before. Without a list the
  // stored value is the fallback for a slide whose footer shows none.
  // Labels compare the way the native list stores them: tab, LF and CR are
  // spaces in an XML attribute, and a blank label is no section.
  const blank = value => typeof value !== 'string' || value.trim() === '';
  const normalized = value => blank(value) ? '' : value.replace(/[\t\n\r]/g, ' ');
  const sameSection = (a, b) => normalized(a) === normalized(b);
  const reconcileSection = (index, stored) => {
    const shown = imported.slides[index]?.section;
    if (!nativeSections) {
      if (stored !== undefined && shown === undefined) group(`slides.${index}.section`, [set(['slides', index, 'section'], clone(stored))]);
      return;
    }
    const listed = nativeSections[index];
    if (sameSection(shown, listed) || (stored !== undefined && sameSection(listed, stored) && shown !== undefined)) return;
    if (shown !== undefined) report({code: 'section-reference-changed', path: `slides.${index}.section`, message: `The footer of slides.${index} shows section '${shown}' but PowerPoint's section list ${listed === undefined ? 'has the slide in no named section' : `names '${listed}'`}; the section list wins and the footer keeps its current text.`});
    group(`slides.${index}.section`, [listed === undefined ? remove(['slides', index, 'section']) : set(['slides', index, 'section'], listed)]);
  };

  // Without document provenance (a slide pasted into another deck, or a
  // missing or unreadable OPF_DOCUMENT_V1), each OPF_SLIDE_V1 still restores
  // its layout intent and content topology, and the native section list
  // applies; deck references, metadata, slide ids, stored sections and
  // extensions need the document record and are not restored.
  if (!document) {
    const layouts = imported.slides.map((_, index) => slideRecords[index] ? intent.slide(index, slideRecords[index], (restoreContent(index, slideRecords[index]), slideRecords[index].record.content !== undefined)).entry : {structure: 'untagged'});
    if (nativeSections) imported.slides.forEach((_, index) => reconcileSection(index, undefined));
    return {groups, slides: layouts, finalize: doc => intent.finalize(doc)};
  }

  // Stored assets resolve against current media parts; a missing part leaves the asset unavailable.
  const storedAssets = {};
  for (const [id, asset] of Object.entries(object(document.assets) ? document.assets : {})) {
    const {value, unresolved} = resolveMedia(asset, entries);
    if (!unresolved) storedAssets[id] = value;
  }
  const available = id => own(imported.assets, id) || Object.hasOwn(storedAssets, id);
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
  // Brand images have no native gate (the P2 logo picture is consumed separately).
  for (const key of BRAND_ASSETS) {
    if (storedDesign[key] === undefined) continue;
    const value = restorable(`design.${key}`, storedDesign[key]);
    if (value !== undefined) group(`design.${key}`, [set(['design', key], value)]);
  }

  // Slide-level references.
  const layouts = [];
  let allStructure = slideRecords.length === document.slides && slideRecords.every(Boolean);
  const backgroundInheritors = [];
  for (const [index, slide] of imported.slides.entries()) {
    const entry = slideRecords[index];
    if (!entry) { layouts.push({structure: 'untagged'}); allStructure = false; reconcileSection(index, undefined); continue; }
    const {record, native: observed} = entry;
    const at = (...path) => ['slides', index, ...path];
    if (record.id !== undefined) {
      if (seenIds.has(record.id)) report({code: 'duplicate-slide-id', path: `slides.${index}.id`, message: `Slide id '${record.id}' appears on more than one slide (a duplicated slide); the first keeps it.`});
      else { seenIds.add(record.id); group(`slides.${index}.id`, [set(at('id'), clone(record.id))]); }
    }
    const {entry: layoutEntry, structureMatch} = intent.slide(index, entry, (restoreContent(index, entry), entry.record.content !== undefined));
    if (!structureMatch) allStructure = false;
    layouts.push(layoutEntry);
    if (record.beat !== undefined) group(`slides.${index}.beat`, [set(at('beat'), clone(record.beat))]);
    reconcileSection(index, record.section);
    if (record.extensions !== undefined) group(`slides.${index}.extensions`, [set(at('extensions'), clone(record.extensions))]);
    const recordDesign = record.design ?? {};
    for (const key of BRAND_ASSETS) {
      if (recordDesign[key] === undefined) continue;
      const value = restorable(`slides.${index}.design.${key}`, recordDesign[key]);
      if (value !== undefined) group(`slides.${index}.design.${key}`, [set(at('design', key), value)]);
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
  // The exporter writes the default creator when no author was authored: with the document record present, that default is not the author.
  if (metadata.author === undefined && imported.author === DEFAULT_AUTHOR) group('author', [remove(['author'])]);
  for (const key of METADATA) {
    if (metadata[key] === undefined) continue;
    if (key === 'organization' && organizationConflict) {
      report({code: 'metadata-reference-changed', path: 'organization', message: 'Slides now show different organization names in their furniture, so the stored organization was not restored; each slide keeps its visible text.'});
      continue;
    }
    if (key === 'speaker' && speakerConflict) {
      report({code: 'metadata-reference-changed', path: 'speaker', message: 'Slides now show different speaker names in their furniture, so the stored speaker was not restored; each slide keeps its visible text.'});
      continue;
    }
    if (key === 'author') {
      // Native evidence: the stored authored form only stands for the creator it was joined into.
      if (joinAuthors(imported.author) === joinAuthors(metadata.author)) group('author', [set(['author'], clone(metadata.author))]);
      else report({code: 'metadata-reference-changed', path: 'author', message: 'The PowerPoint author field no longer matches the stored author, so the stored author was not restored; the current field is kept.'});
      continue;
    }
    let value = restorable(key, metadata[key], {prune: true});
    if (value === undefined) continue;
    if (key === 'organization' && object(imported.organization)) {
      const observed = imported.organization;
      // Same order as export: inline records, then the document source, host catalogs and bundled records.
      const hostRecords = typeof socialPlatformRecords === 'function' ? socialPlatformRecords(document.catalogs) : (opfCore.catalogs?.socialPlatforms ?? []);
      const records = [...array(document.catalogs?.socialPlatforms?.records ?? document.catalogs?.socialPlatforms), ...hostRecords].filter(object);
      const merge = (stored, current) => object(current.socials) && object(stored?.socials) ? {...current, socials: authoredSocials(stored.socials, current.socials, records)} : current;
      const list = array(value);
      const index = list.findIndex(item => object(item) && item.id === observed.id);
      if (index < 0) value = clone(observed);
      else if (Array.isArray(value)) value[index] = {...list[index], ...merge(list[index], clone(observed))};
      else value = {...value, ...merge(value, clone(observed))};
    }
    if (key === 'speaker' && object(imported.speaker)) {
      // The furniture speaker line (name and title) is native content and wins over the stored speaker with the same id.
      const observed = imported.speaker, list = array(value), index = list.findIndex(item => object(item) && item.id === observed.id);
      const merged = stored => { const {title: _title, ...rest} = stored; return {...rest, ...clone(observed)}; };
      if (index < 0) value = clone(observed);
      else if (Array.isArray(value)) value[index] = merged(list[index]);
      else value = merged(value);
    }
    group(key, [set([key], value)]);
  }

  // The whole stored asset registry returns; an id the import already provides
  // (a media asset read from a video placeholder) keeps its observed value.
  for (const [id, asset] of Object.entries(storedAssets)) if (!own(imported.assets, id)) group(`assets.${id}`, [set(['assets', id], clone(asset))]);

  // Assets and inline catalog records follow what the restored document references.
  const finalize = doc => {
    const needed = [...new Set(assetReferences(doc))].filter(id => !own(doc.assets, id) && Object.hasOwn(storedAssets, id));
    if (needed.length) doc.assets = {...(object(doc.assets) ? doc.assets : {}), ...Object.fromEntries(needed.map(id => [id, clone(storedAssets[id])]))};
    if (object(document.catalogs)) {
      const {catalogs: _ignored, ...rest} = doc;
      const {value, unresolved} = resolveMedia(referencedCatalogs(document.catalogs, collectStrings(rest)), entries);
      if (value && !unresolved) doc.catalogs = value;
    }
    return intent.finalize(doc);
  };
  return {groups, slides: layouts, finalize};
}

/**
 * Layout intent of the tagged slides (FF-29): layout id, type, composition and
 * composition hints are restored while a slide's arrangement is unchanged.
 * Each layout id resolves to exactly one record, in this order:
 * - the document's inline record (OPF_DOCUMENT_V1);
 * - a bundled layout. A slide's override of a bundled id is used only when
 *   there is no document record, or its record for that id was rejected, and
 *   every restored slide with that id carries the same override, so it never
 *   changes another slide's layout;
 * - the first restored slide's `layoutRecord`.
 * A slide whose own record disagrees with the chosen one keeps its content
 * without the layout id (`layout-reference-changed`), and an id that resolves
 * to no record is not restored (`unresolved-layout-reference`), so the
 * imported document always renders. `finalize` adds the slide-level records
 * that the imported document references.
 */
function layoutIntent(documentRecords, hasDocument, slideRecords, entries, group, report, rejectedDocumentIds) {
  const bundled = id => array(opfCore.catalogs?.layouts).find(item => item?.id === id);
  const owns = slideRecords.map(entry => {
    if (!entry) return null;
    const {record, native: observed} = entry;
    const structureMatch = record.native.structure === observed.structure;
    const layout = typeof record.layout === 'string' ? record.layout : undefined;
    let own = record.layoutRecord, problem;
    // A record for another id is ignored and reported.
    if (own !== undefined && own.id !== layout) { problem = layout === undefined ? undefined : 'mismatch'; own = undefined; }
    else if (own !== undefined) {
      const {value, unresolved} = resolveMedia(own, entries);
      if (unresolved) { own = undefined; problem = 'media'; }
      else if (!validLayoutRecord(value)) { own = undefined; problem = 'schema'; }
      else own = value;
    }
    return {structureMatch, layout, own, problem, stated: record.layoutRecord};
  });
  const resolved = new Map();
  for (const id of new Set(owns.filter(item => item?.structureMatch && item.layout !== undefined).map(item => item.layout))) {
    const members = owns.filter(item => item?.structureMatch && item.layout === id);
    const fromDocument = documentRecords.find(item => item?.id === id), builtIn = bundled(id);
    if (fromDocument) resolved.set(id, {record: fromDocument, source: 'document'});
    else if (builtIn) {
      const overrides = members.filter(item => item.own && !same(item.own, builtIn));
      if ((!hasDocument || rejectedDocumentIds.has(id)) && overrides.length && overrides.length === members.length && overrides.every(item => same(item.own, overrides[0].own))) resolved.set(id, {record: overrides[0].own, source: 'slides', add: true});
      else resolved.set(id, {record: builtIn, source: 'bundled'});
    } else {
      const first = members.find(item => item.own);
      if (first) resolved.set(id, {record: first.own, source: 'slides', add: true});
    }
  }
  const chosen = new Map([...resolved].filter(([, item]) => item.add).map(([id, item]) => [id, item.record]));
  const against = {document: 'the document', bundled: 'the built-in layout', slides: 'another slide'};
  // `typeInContent`: the slide stores a content topology, so its `type` is restored with that group (or not at all).
  const slide = (index, {record}, typeInContent = false) => {
    const {structureMatch, layout, own, problem, stated} = owns[index];
    const {native: _native, ...recordValue} = record;
    if (structureMatch && problem === 'mismatch') report({code: 'invalid-document-provenance', path: `slides.${index}.layoutRecord`, message: `The stored layout record '${stated?.id}' does not match slides.${index}.layout '${layout}', so it was not restored.`});
    if (structureMatch && problem === 'media') report({code: 'unresolved-asset-reference', path: `slides.${index}.layoutRecord`, message: `slides.${index}.layoutRecord refers to a picture that is no longer in the PPTX, so the slide's stored layout record was not restored.`});
    if (structureMatch && problem === 'schema') report({code: 'invalid-document-provenance', path: `slides.${index}.layoutRecord`, message: `slides.${index}.layoutRecord does not validate against the layouts catalog schema, so the slide's stored layout record was not restored.`});
    const target = layout === undefined ? undefined : resolved.get(layout);
    let restoreLayout = structureMatch;
    if (structureMatch && layout !== undefined) {
      if (!target) {
        restoreLayout = false;
        report({code: 'unresolved-layout-reference', path: `slides.${index}.layout`, message: `Layout '${layout}' is not a bundled layout and the PPTX carries no inline record for it, so slides.${index}.layout was not restored; the imported slide keeps its observed arrangement.`});
      } else if (own && !same(own, target.record)) {
        restoreLayout = false;
        report({code: 'layout-reference-changed', path: `slides.${index}.layout`, message: `This slide stores a different record for layout '${layout}' than ${against[target.source]}, so slides.${index}.layout was not restored; the imported slide keeps its observed arrangement.`});
      }
    }
    const catalogRecord = target && target.source !== 'bundled' ? target.record : undefined;
    const at = (...path) => ['slides', index, ...path];
    for (const key of SLIDE_STRUCTURE) {
      if (record[key] === undefined || (key === 'type' && typeInContent)) continue;
      if (!structureMatch) report({code: key === 'layout' ? 'layout-reference-changed' : 'slide-reference-changed', path: `slides.${index}.${key}`,
        message: `The slide's objects were moved, resized, added or removed since export, so slides.${index}.${key} ${label(record[key])} was not restored; the imported slide keeps its observed arrangement.`});
      else if (key !== 'layout' || restoreLayout) group(`slides.${index}.${key}`, [{path: at(key), value: clone(record[key])}]);
    }
    for (const key of COMPOSITION_HINTS) {
      const value = record.design?.[key];
      if (value === undefined) continue;
      if (structureMatch) group(`slides.${index}.design.${key}`, [{path: at('design', key), value: clone(value)}]);
      else report({code: 'design-reference-changed', path: `slides.${index}.design.${key}`, message: `The slide's objects changed since export, so slides.${index}.design.${key} was not restored.`});
    }
    return {structureMatch, entry: {layout, structure: structureMatch ? 'match' : 'changed', record: clone(recordValue), ...(catalogRecord !== undefined ? {catalogRecord: clone(catalogRecord)} : {})}};
  };
  const finalize = doc => {
    const needed = [...chosen].filter(([id]) => array(doc.slides).some(item => item?.layout === id) && !layoutRecords(doc.catalogs).some(item => item?.id === id));
    if (!needed.length) return doc;
    const catalogs = object(doc.catalogs) ? doc.catalogs : {}, current = catalogs.layouts, records = needed.map(([, record]) => clone(record));
    doc.catalogs = {...catalogs, layouts: Array.isArray(current) ? [...current, ...records] : {...(object(current) ? current : {}), records: [...array(current?.records), ...records]}};
    return doc;
  };
  return {slide, finalize};
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
  if (validate(all).valid) { for (const item of groups) item.applied = true; return all; }
  const accepted = [];
  for (const item of groups) {
    if (validate(build([...accepted, item])).valid) { accepted.push(item); item.applied = true; }
    else report({code: 'invalid-document-provenance', path: item.field, message: `The stored ${item.field} does not form a valid document with the imported content, so it was not restored; the imported document keeps the values observed in the PPTX.`});
  }
  const result = finalize(build(accepted));
  if (validate(result).valid) return result;
  report({code: 'invalid-document-provenance', path: 'catalogs', message: 'Stored inline catalog records or assets do not validate with the imported document and were not restored.'});
  return build(accepted);
}
