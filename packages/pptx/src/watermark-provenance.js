import {XMLParser} from 'fast-xml-parser';
import {decodeTextTag, encodeTextTag} from './code-provenance.js';
import {pictureTransform} from './image-geometry.js';

// design.watermark exports as one native picture per slide, placed first in the
// shape tree (beneath content) at the preview's frame: the centered 40% of the
// slide, fitted without cropping. Opacity is a native a:alphaModFix on the
// picture's blip. The tag records the exact native picture, so an unchanged
// picture imports back as design.watermark while an edited one stays ordinary.
const TAG = 'OPF_WATERMARK_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const EMUS_PER_INCH = 914400;
export const WATERMARK_DEFAULT_OPACITY = 0.08;
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const decoder = new TextDecoder('utf-8', {fatal:true}), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
// Whitespace-only text between elements is not identity: the vendored writer indents, PowerPoint drops it on save.
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().filter(key => !(key === '#text' && typeof item[key] === 'string' && !item[key].trim())).map(key => [key, item[key]])) : item);

export const watermarkName = () => 'OPF watermark';

// The preview's frame: x/y at 30% and a 40% by 40% box, in the slide's units.
export const watermarkBox = (width, height) => ({x: width * .3, y: height * .3, w: width * .4, h: height * .4});

// The preview reads opacity from an object form only; a string form is 0.08.
export function watermarkOpacity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return WATERMARK_DEFAULT_OPACITY;
  const opacity = value.opacity ?? WATERMARK_DEFAULT_OPACITY;
  return typeof opacity === 'number' && Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : WATERMARK_DEFAULT_OPACITY;
}

function blipFillIdentity(blipFill) {
  const {['a:blip']: blip, ...rest} = blipFill ?? {};
  const {['r:embed']: _embed, ...blipRest} = blip ?? {};
  return {...rest, 'a:blip': blipRest};
}

/**
 * Place each generated watermark picture at its frame, apply opacity, and bind
 * the picture to its manifest with a native tag.
 * marks: Map<slidePart, {slide, box (inches), opacity, path}>.
 */
export function placeWatermarks(entries, marks, metadataFor, fail) {
  if (!marks.size) return;
  const manifests = new Map();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const mark = marks.get(part);
    if (!mark) continue;
    const xml = decoder.decode(entries[part]);
    const emu = value => Math.round(value * EMUS_PER_INCH);
    let found = 0;
    const next = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      if (picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] !== watermarkName()) return picture;
      found++;
      const embed = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      const metadata = metadataFor(part, embed);
      if (!metadata) fail(mark.path);
      const placed = pictureTransform(metadata, mark.box, 'fit');
      const attributes = `${placed.rotation ? ` rot="${placed.rotation * 60000}"` : ''}${placed.flipH ? ' flipH="1"' : ''}${placed.flipV ? ' flipV="1"' : ''}`;
      picture = picture.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, `<a:xfrm${attributes}><a:off x="${emu(placed.x)}" y="${emu(placed.y)}"/><a:ext cx="${emu(placed.w)}" cy="${emu(placed.h)}"/></a:xfrm>`);
      picture = picture.replace(/<a:srcRect\b[^>]*\/>/, '');
      if (mark.opacity < 1) {
        const effect = `<a:alphaModFix amt="${Math.round(mark.opacity * 100000)}"/>`;
        picture = picture.replace(/<a:blip\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:blip>)/, (_, blipAttributes, inner = '') => `<a:blip${blipAttributes}>${effect}${inner}</a:blip>`);
      }
      const node = parser.parse(picture)['p:pic'];
      manifests.set(part, {v: 1, slide: mark.slide, opacity: mark.opacity, properties: node['p:spPr'], blipFill: blipFillIdentity(node['p:blipFill'])});
      return picture;
    });
    if (found !== 1) throw new Error('Missing generated watermark picture.');
    entries[part] = encoder.encode(next);
  }
  attachTags(entries, manifests);
}

// One tag part per slide, related from the picture's application properties.
// (attachTextTags is keyed by shape name, and every slide's watermark shares one.)
function attachTags(entries, manifests) {
  const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main', types = [];
  let count = 0;
  for (const [part, manifest] of manifests) {
    const relPath = part.replace('/slides/', '/slides/_rels/') + '.rels';
    const rels = decoder.decode(entries[relPath]);
    const ids = new Set([...rels.matchAll(/\bId="([^"]+)"/g)].map(match => match[1]));
    const tagPart = `ppt/tags/opfWatermark${++count}.xml`;
    let id = `rIdOpfWatermark${count}`;
    while (ids.has(id)) id += '_';
    entries[tagPart] = encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${TAG}" val="${encodeTextTag(manifest)}"/></p:tagLst>`);
    types.push(`<Override PartName="/${tagPart}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`);
    entries[relPath] = encoder.encode(rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL}" Target="../tags/opfWatermark${count}.xml"/></Relationships>`));
    let attached = false;
    const xml = decoder.decode(entries[part]).replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      if (attached || picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] !== watermarkName()) return picture;
      attached = true;
      picture = picture.replace(/<p:nvPr\s*\/>/, '<p:nvPr></p:nvPr>');
      if (!picture.includes('</p:nvPr>')) throw new Error('Generated watermark picture has no native application properties.');
      return picture.replace('</p:nvPr>', `<p:custDataLst><p:tags r:id="${id}"/></p:custDataLst></p:nvPr>`);
    });
    entries[part] = encoder.encode(xml);
  }
  entries['[Content_Types].xml'] = encoder.encode(decoder.decode(entries['[Content_Types].xml']).replace('</Types>', types.join('') + '</Types>'));
}

function readTags(container, relationships, entries) {
  const tags = [];
  let unreadable = false;
  for (const link of array(container?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) { unreadable = true; continue; }
    try { tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])); } catch { unreadable = true; }
  }
  return {tags, unreadable};
}

/**
 * Recover design.watermark from an unchanged tagged picture. Returns the
 * consumed picture indexes and the slide design fields to restore.
 * readPicture(picture) returns the ordinary imported image payload.
 */
export function importWatermark(pictures, relationships, entries, slideIndex, readPicture, report) {
  const consumed = new Set(), found = [];
  for (const [index, picture] of pictures.entries()) {
    const {tags, unreadable} = readTags(picture['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
    const own = tags.filter(tag => tag.name?.toUpperCase() === TAG);
    if (!own.length) continue;
    found.push({index, picture, own, unreadable, others: tags.some(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== TAG)});
  }
  if (!found.length) return {consumed};
  const invalid = () => report({code: 'invalid-watermark-provenance', message: 'An edited, ambiguous or invalid tagged OPF watermark was imported as an ordinary picture. It is not reconstructed as design.watermark.'});
  if (found.length > 1) { invalid(); return {consumed}; }
  const [{index, picture, own, unreadable, others}] = found;
  try {
    if (unreadable || others || own.length !== 1) throw Error('Ambiguous watermark identity.');
    const manifest = decodeTextTag(own[0].val);
    if (manifest?.v !== 1 || manifest.slide !== `slides.${slideIndex}` || typeof manifest.opacity !== 'number' || !(manifest.opacity >= 0 && manifest.opacity <= 1)) throw Error('Invalid watermark manifest.');
    if (picture['p:nvPicPr']?.['p:cNvPr']?.name !== watermarkName()) throw Error('Watermark identity changed.');
    if (canonical(picture['p:spPr']) !== canonical(manifest.properties) || canonical(blipFillIdentity(picture['p:blipFill'])) !== canonical(manifest.blipFill)) throw Error('Watermark geometry or opacity changed.');
    const item = readPicture(picture);
    const src = item?.payload?.image?.src;
    if (typeof src !== 'string') throw Error('Watermark bytes are unavailable.');
    consumed.add(index);
    return {consumed, design: {watermark: {src, opacity: manifest.opacity}}};
  } catch {
    invalid();
    return {consumed};
  }
}
