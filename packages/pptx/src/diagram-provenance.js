import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {blipFillIdentity, canonical} from './image-provenance.js';
import {mediaKey} from './media-dedupe.js';
import {normalizeCrop, svgBlipRelationship} from './svg-image.js';

// Diagrams (OPF `diagram`, Mermaid source drawn by core's layoutDiagram and painted by paintDiagram in the slide's palette).
//
// A diagram exports as one native SVG picture (`OPF diagram N`, an `asvg:svgBlip` over its PNG fallback) at core's drawn box, its
// `descr` the diagram's alt text. One that cannot be drawn (a source error, or no rasterizer for the fallback) is the unavailable-
// diagram placeholder: one dashed rectangle `OPF diagram placeholder N` that reads "Diagram unavailable", as the preview draws it.
//
// In `full` provenance the picture or placeholder carries OPF_DIAGRAM_V1: the slide, the block path, the authored diagram value
// (the source, its syntax and alt as written), the alt text the picture was written with and, for a picture, the exact native
// geometry, the blip fill and the media key of the SVG part. On import an unchanged tagged picture (or an intact placeholder) is
// the diagram again; the picture's current description is its alt text. A picture that was replaced (Change Picture), recolored,
// cropped, moved or resized, a renamed one or one with a second OPF tag imports as an ordinary picture and reports
// `invalid-diagram-provenance`. Without the tag (`references-only`, `provenance: false`) the picture is an image.
//
// SH-07: a diagram written as shapes (`diagrams: "shapes"`) is one p:grpSp `OPF diagram N` whose OPF_DIAGRAM_V1 manifest has
// `shapes: true` and the group's signature (diagramGroupSignature: the name, frame and text of every member). An unchanged group imports
// as its diagram again, its description as the alt text; an edited one (a member moved, resized, renamed, added, removed or retyped)
// imports as its shapes and reports `invalid-diagram-provenance`.
export const DIAGRAM_TAG = 'OPF_DIAGRAM_V1';
export const diagramName = number => `OPF diagram ${number}`;
export const diagramPlaceholderName = number => `OPF diagram placeholder ${number}`;
export const DIAGRAM_UNAVAILABLE = 'Diagram unavailable';
const PICTURE_NAME = /^OPF diagram \d+$/, PLACEHOLDER_NAME = /^OPF diagram placeholder \d+$/;
const BLOCK_PATH = /^slides\.\d+(?:\.[A-Za-z0-9_:+-]{1,64}){1,32}$/;
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = value => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/**
 * Tag the generated diagram pictures and placeholders of a package. `records`: Map<object name, {v, slide, path, diagram, alt}>.
 * Runs after the SVG parts are attached (src/svg-image.js attachSvgPictures): a picture's manifest binds its geometry, blip fill
 * and the media key of its SVG. `relationshipsOf(entries, part)` reads a slide's relationships (Map<id, {path}>).
 */
export function tagDiagrams(entries, records, relationshipsOf) {
  if (!records.size) return;
  const manifests = new Map();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort()) {
    const xml = decoder.decode(entries[part]);
    let relationships;
    for (const [shape, kind] of xml.matchAll(/<p:(grpSp|sp|pic)>[\s\S]*?<\/p:\1>/g)) {
      const name = /<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(shape)?.[1];
      const record = records.get(name);
      if (!record) continue;
      if (kind === 'grpSp') {
        if (!record.shapes) throw new Error('A generated diagram group has no shapes record.');
        manifests.set(name, {...record, signature: diagramGroupSignature(parser.parse(shape)['p:grpSp'])});
        continue;
      }
      if (record.shapes) continue;
      if (kind === 'sp') { manifests.set(name, {...record, placeholder: true}); continue; }
      const node = parser.parse(shape)['p:pic'];
      relationships ??= relationshipsOf(entries, part);
      const svg = entries[relationships.get(svgBlipRelationship(node?.['p:blipFill']?.['a:blip']))?.path];
      if (!svg) throw new Error('A generated diagram picture has no SVG part.');
      manifests.set(name, {...record, properties: node['p:spPr'], blipFill: blipFillIdentity(node['p:blipFill']), svg: mediaKey(svg)});
    }
  }
  if (manifests.size !== records.size) throw new Error('Missing generated diagram shapes.');
  attachTextTags(entries, manifests, DIAGRAM_TAG, 'opfDiagram', 'diagram', {pictures: true, groups: true});
}

// The text of a parsed DrawingML text body (every a:t, paragraphs joined by line breaks).
const bodyText = body => array(body?.['a:p']).map(paragraph => [...array(paragraph?.['a:r']), ...array(paragraph?.['a:fld'])].map(run => {
  const value = run?.['a:t'];
  return typeof value === 'object' && value !== null ? scalar(value['#text']) : scalar(value);
}).join('')).join('\n');
const frameOf = properties => {
  const xfrm = properties?.['a:xfrm'];
  return [xfrm?.['a:off']?.x, xfrm?.['a:off']?.y, xfrm?.['a:ext']?.cx, xfrm?.['a:ext']?.cy, xfrm?.rot ?? 0, xfrm?.flipH ?? 0, xfrm?.flipV ?? 0].map(scalar).join(',');
};

/**
 * SH-07: the signature of a diagram group (a parsed p:grpSp): its frame and, for every member in any order, its kind, name, frame and
 * text. It changes when a member is moved, resized, rotated, renamed, added, removed or retyped, and not when PowerPoint saves the file.
 */
export function diagramGroupSignature(group) {
  const members = [];
  for (const [kind, nv, properties] of [['p:sp', 'p:nvSpPr', 'p:spPr'], ['p:cxnSp', 'p:nvCxnSpPr', 'p:spPr'], ['p:pic', 'p:nvPicPr', 'p:spPr'], ['p:grpSp', 'p:nvGrpSpPr', 'p:grpSpPr'], ['p:graphicFrame', 'p:nvGraphicFramePr', 'p:xfrm']]) {
    for (const member of array(group?.[kind])) {
      const frame = kind === 'p:graphicFrame' ? frameOf({'a:xfrm': member?.['p:xfrm']}) : frameOf(member?.[properties]);
      members.push([kind, scalar(member?.[nv]?.['p:cNvPr']?.name), frame, bodyText(member?.['p:txBody'])].join('|'));
    }
  }
  const text = [frameOf(group?.['p:grpSpPr']), ...members.sort()].join('\n');
  // FNV-1a in two lanes: a compact key for change detection, not a security measure.
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `${members.length}:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

// The one OPF_DIAGRAM_V1 tag of a shape, decoded, or null (absent); throws when it is unreadable, repeated or beside another OPF tag.
function ownTag(container, relationships, entries) {
  const tags = [];
  let unreadable = false;
  for (const link of array(container?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) { unreadable = true; continue; }
    try { tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])); } catch { unreadable = true; }
  }
  const own = tags.filter(tag => String(tag.name ?? '').toUpperCase() === DIAGRAM_TAG);
  if (!own.length) return null;
  if (unreadable || own.length !== 1 || tags.some(tag => /^OPF_/i.test(String(tag.name ?? '')) && String(tag.name).toUpperCase() !== DIAGRAM_TAG)) throw Error('Ambiguous diagram identity.');
  return decodeTextTag(own[0].val);
}

const authoredValue = value => (typeof value === 'string' && value.length > 0) || (object(value) && typeof value.source === 'string');

// The diagram value with the picture's current description as its alt text: unchanged when the description is the one written.
function withAlt(value, written, current) {
  if (current === written) return structuredClone(value);
  const base = typeof value === 'string' ? {source: value} : structuredClone(value);
  if (current) base.alt = current;
  else delete base.alt;
  return typeof value === 'string' && base.alt === undefined ? value : base;
}

/**
 * Recover the diagram blocks of one slide from its tagged pictures and placeholder shapes. `pictures` and `shapes` are the slide's
 * native pictures and text shapes (nativePictures and nativeTextShapes order), `paragraphs` the shapes' paragraphs (each `{text}`);
 * `valid(payload)` checks a recovered diagram block against the OPF format. Returns Map<index, payload> for `pictures` and `shapes`.
 */
const manifestFor = slide => manifest => manifest?.v === 1 && manifest.slide === slide && typeof manifest.path === 'string' && BLOCK_PATH.test(manifest.path)
  && manifest.path.startsWith(`${slide}.`) && authoredValue(manifest.diagram) && typeof manifest.alt === 'string';

/**
 * SH-07: recover the diagram blocks of one slide written as shapes: its top-level groups (`groups`, parsed p:grpSp) that carry an
 * intact OPF_DIAGRAM_V1 group manifest. Returns [{group, payload}]; an edited or invalid tagged group is left to import as its shapes.
 */
export function importDiagramGroups({groups, relationships, entries, slideIndex, valid, report}) {
  const slide = `slides.${slideIndex}`, check = manifestFor(slide), found = [];
  const invalid = message => report({code: 'invalid-diagram-provenance', path: slide, message});
  for (const group of groups) {
    let manifest;
    try { manifest = ownTag(group?.['p:nvGrpSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries); }
    catch { invalid('A tagged OPF diagram group is ambiguous; it was imported as its shapes.'); continue; }
    if (manifest === null) continue;
    const properties = group?.['p:nvGrpSpPr']?.['p:cNvPr'];
    if (!check(manifest) || manifest.shapes !== true || !PICTURE_NAME.test(scalar(properties?.name)) || diagramGroupSignature(group) !== manifest.signature) {
      invalid('An edited or invalid tagged OPF diagram group was imported as its shapes; its diagram source is not reconstructed.');
      continue;
    }
    const payload = {type: 'diagram', diagram: withAlt(manifest.diagram, manifest.alt, scalar(properties?.descr))};
    if (!valid(payload)) { invalid('A tagged OPF diagram group does not form a valid diagram block; it was imported as its shapes.'); continue; }
    found.push({group, payload});
  }
  return found;
}

export function importDiagrams({pictures, shapes, paragraphs, relationships, entries, slideIndex, valid, report}) {
  const slide = `slides.${slideIndex}`;
  const found = {pictures: new Map(), shapes: new Map()};
  const invalid = message => report({code: 'invalid-diagram-provenance', path: slide, message});
  const check = manifestFor(slide);
  for (const [index, picture] of pictures.entries()) {
    let manifest;
    try { manifest = ownTag(picture?.['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries); }
    catch { invalid('A tagged OPF diagram picture is ambiguous; it was imported as an ordinary picture.'); continue; }
    if (manifest === null) continue;
    const name = scalar(picture?.['p:nvPicPr']?.['p:cNvPr']?.name);
    const svg = entries[relationships.get(svgBlipRelationship(picture?.['p:blipFill']?.['a:blip']))?.path];
    if (!check(manifest) || manifest.placeholder || !PICTURE_NAME.test(name) || !svg || mediaKey(svg) !== manifest.svg
      || canonical(picture['p:spPr']) !== canonical(manifest.properties)
      || canonical(blipFillIdentity(picture['p:blipFill'])) !== canonical(normalizeCrop(manifest.blipFill))) {
      invalid('An edited, replaced or invalid tagged OPF diagram picture was imported as an ordinary picture; its diagram source is not reconstructed.');
      continue;
    }
    const payload = {type: 'diagram', diagram: withAlt(manifest.diagram, manifest.alt, scalar(picture['p:nvPicPr']?.['p:cNvPr']?.descr))};
    if (!valid(payload)) { invalid('A tagged OPF diagram picture does not form a valid diagram block; it was imported as an ordinary picture.'); continue; }
    found.pictures.set(index, payload);
  }
  for (const [index, shape] of shapes.entries()) {
    let manifest;
    try { manifest = ownTag(shape?.['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries); }
    catch { invalid('A tagged OPF diagram placeholder is ambiguous; it was imported as ordinary content.'); continue; }
    if (manifest === null) continue;
    const name = scalar(shape?.['p:nvSpPr']?.['p:cNvPr']?.name);
    const text = (paragraphs[index] ?? []).map(paragraph => paragraph.text).join('\n');
    if (!check(manifest) || manifest.placeholder !== true || !PLACEHOLDER_NAME.test(name) || text !== DIAGRAM_UNAVAILABLE) {
      invalid('An edited or invalid tagged OPF diagram placeholder was imported as ordinary content; its diagram source is not reconstructed.');
      continue;
    }
    const payload = {type: 'diagram', diagram: structuredClone(manifest.diagram)};
    if (!valid(payload)) { invalid('A tagged OPF diagram placeholder does not form a valid diagram block; it was imported as ordinary content.'); continue; }
    found.shapes.set(index, payload);
  }
  return found;
}
