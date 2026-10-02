import {XMLParser} from 'fast-xml-parser';
import {normalizeCrop, withoutSvgBlip} from './svg-image.js';
import {decodeTextTag, encodeTextTag} from './code-provenance.js';
import {pictureTransform} from './image-geometry.js';

// The deck logo (core's `geometry.logo`: design.logo, a slide's own logo or the
// primary organization's logo on a cover or section slide) exports as one native
// picture per slide named `OPF logo`, after the watermark and before content. It
// is fitted into core's box without cropping, anchored left and vertically
// centered (the preview's `xMinYMid meet`). The native tag records the exact
// picture, so an unchanged picture is consumed on import (the logo itself returns
// from the document and slide design records) while an edited one stays an
// ordinary picture and reports `invalid-logo-provenance`.
const TAG = 'OPF_LOGO_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const EMUS_PER_INCH = 914400;
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const decoder = new TextDecoder('utf-8', {fatal:true}), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
// Whitespace-only text between elements is not identity: the vendored writer indents, PowerPoint drops it on save.
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().filter(key => !(key === '#text' && typeof item[key] === 'string' && !item[key].trim())).map(key => [key, item[key]])) : item);
// The OPF paths core reports for a logo source.
const LOGO_PATH = /^(?:slides\.\d{1,9}\.design\.logo|design\.logo|organization(?:\.\d{1,9})?\.logo)(?:\.[A-Za-z]{1,16})?$/;

export const LOGO_TAG = TAG;
export const logoName = () => 'OPF logo';

function blipFillIdentity(blipFill) {
  const {['a:blip']: blip, ...rest} = normalizeCrop(blipFill) ?? {};
  const {['r:embed']: _embed, ...blipRest} = withoutSvgBlip(blip) ?? {};
  return {...rest, 'a:blip': blipRest};
}

/**
 * The picture frame inside core's logo box: contained, anchored at the box's
 * left edge and vertically centered. A 90 degree EXIF orientation swaps the
 * frame's axes, so its visual width is the stored height.
 */
export function logoFrame(metadata, box, anchor = 'left') {
  const placed = pictureTransform(metadata, box, 'fit');
  const visualWidth = (metadata.orientation ?? 1) >= 5 ? placed.h : placed.w;
  // Right to left (RR-05): a cover logo sits at the top right, anchored to the box's right edge.
  return {...placed, x: placed.x + (anchor === 'right' ? 1 : -1) * (box.w - visualWidth) / 2};
}

/**
 * Place each generated logo picture at its frame and bind it to its manifest
 * with a native tag. logos: Map<slidePart, {slide, box (inches), path, variant}>.
 */
export function placeLogos(entries, logos, metadataFor, fail) {
  if (!logos.size) return;
  const manifests = new Map();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const logo = logos.get(part);
    if (!logo) continue;
    const xml = decoder.decode(entries[part]);
    const emu = value => Math.round(value * EMUS_PER_INCH);
    let found = 0;
    const next = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      if (picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] !== logoName()) return picture;
      found++;
      const embed = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      const metadata = metadataFor(part, embed);
      if (!metadata) fail(logo.path);
      const placed = logoFrame(metadata, logo.box, logo.anchor);
      const attributes = `${placed.rotation ? ` rot="${placed.rotation * 60000}"` : ''}${placed.flipH ? ' flipH="1"' : ''}${placed.flipV ? ' flipV="1"' : ''}`;
      picture = picture.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, `<a:xfrm${attributes}><a:off x="${emu(placed.x)}" y="${emu(placed.y)}"/><a:ext cx="${emu(placed.w)}" cy="${emu(placed.h)}"/></a:xfrm>`);
      picture = picture.replace(/<a:srcRect\b[^>]*\/>/, '');
      const node = parser.parse(picture)['p:pic'];
      manifests.set(part, {v: 1, slide: logo.slide, path: logo.path, variant: logo.variant, properties: node['p:spPr'], blipFill: blipFillIdentity(node['p:blipFill'])});
      return picture;
    });
    if (found !== 1) throw new Error('Missing generated logo picture.');
    entries[part] = encoder.encode(next);
  }
  attachTags(entries, manifests);
}

// One tag part per slide, related from the picture's application properties.
function attachTags(entries, manifests) {
  const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main', types = [];
  let count = 0;
  for (const [part, manifest] of manifests) {
    const relPath = part.replace('/slides/', '/slides/_rels/') + '.rels';
    const rels = decoder.decode(entries[relPath]);
    const ids = new Set([...rels.matchAll(/\bId="([^"]+)"/g)].map(match => match[1]));
    const tagPart = `ppt/tags/opfLogo${++count}.xml`;
    let id = `rIdOpfLogo${count}`;
    while (ids.has(id)) id += '_';
    entries[tagPart] = encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${TAG}" val="${encodeTextTag(manifest)}"/></p:tagLst>`);
    types.push(`<Override PartName="/${tagPart}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`);
    entries[relPath] = encoder.encode(rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL}" Target="../tags/opfLogo${count}.xml"/></Relationships>`));
    let attached = false;
    const xml = decoder.decode(entries[part]).replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      if (attached || picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] !== logoName()) return picture;
      attached = true;
      picture = picture.replace(/<p:nvPr\s*\/>/, '<p:nvPr></p:nvPr>');
      if (!picture.includes('</p:nvPr>')) throw new Error('Generated logo picture has no native application properties.');
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
 * The panel an unresolved logo draws is a rectangle named "OPF image placeholder N" carrying a role "placeholder" logo
 * tag for this slide, plus its text lines and icon strokes named after it. A valid tag consumes all of them: they are
 * a status indicator, not content. Without a valid tag they stay ordinary shapes. Returns the consumed shape indexes.
 */
export function importLogoPlaceholders(shapes, relationships, entries, slideIndex) {
  const consumed = new Set(), names = shapes.map(shape => shape['p:nvSpPr']?.['p:cNvPr']?.name);
  for (const [index, shape] of shapes.entries()) {
    const name = names[index];
    if (typeof name !== 'string' || !/^OPF image placeholder \d+$/.test(name)) continue;
    const {tags} = readTags(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
    const own = tags.filter(tag => tag.name?.toUpperCase() === TAG);
    try {
      if (own.length !== 1) continue;
      const manifest = decodeTextTag(own[0].val);
      if (manifest?.v !== 1 || manifest.role !== 'placeholder' || manifest.slide !== `slides.${slideIndex}` || typeof manifest.path !== 'string' || !LOGO_PATH.test(manifest.path)) continue;
    } catch { continue; }
    consumed.add(index);
    for (const [other, otherName] of names.entries()) if (typeof otherName === 'string' && otherName.startsWith(`${name} text line `) || otherName?.startsWith(`${name} icon `)) consumed.add(other);
  }
  return consumed;
}

/**
 * Consume an unchanged tagged logo picture: it is generated from design.logo (or
 * the organization's logo), never content. Returns the consumed picture indexes
 * and `fallback`, the picture's own `{path, image}`: the caller uses it for the
 * logo only when the stored document and slide design did not restore one (an
 * export without provenance, or one that omitted the field), so the logo is never
 * lost. An edited, ambiguous or damaged tagged picture stays an ordinary picture
 * and is reported. readPicture(picture) returns the ordinary imported payload.
 */
export function importLogo(pictures, relationships, entries, slideIndex, readPicture, report) {
  const consumed = new Set(), found = [];
  for (const [index, picture] of pictures.entries()) {
    const {tags, unreadable} = readTags(picture['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
    const own = tags.filter(tag => tag.name?.toUpperCase() === TAG);
    // A header/footer logo picture carries the same tag with role "furniture"; furniture import owns it.
    if (!own.length || own.every(tag => { try { return decodeTextTag(tag.val)?.role === 'furniture'; } catch { return false; } })) continue;
    found.push({index, picture, own, unreadable, others: tags.some(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== TAG)});
  }
  if (!found.length) return {consumed};
  const invalid = () => report({code: 'invalid-logo-provenance', message: 'An edited, ambiguous or invalid tagged OPF logo was imported as an ordinary picture. design.logo returns only from the stored document design.'});
  if (found.length > 1) { invalid(); return {consumed}; }
  const [{index, picture, own, unreadable, others}] = found;
  try {
    if (unreadable || others || own.length !== 1) throw Error('Ambiguous logo identity.');
    const manifest = decodeTextTag(own[0].val);
    if (manifest?.v !== 1 || manifest.slide !== `slides.${slideIndex}` || typeof manifest.path !== 'string' || !LOGO_PATH.test(manifest.path) || typeof manifest.variant !== 'string' || manifest.variant.length > 32) throw Error('Invalid logo manifest.');
    if (picture['p:nvPicPr']?.['p:cNvPr']?.name !== logoName()) throw Error('Logo identity changed.');
    if (canonical(picture['p:spPr']) !== canonical(manifest.properties) || canonical(blipFillIdentity(picture['p:blipFill'])) !== canonical(normalizeCrop(manifest.blipFill))) throw Error('Logo geometry changed.');
    const image = readPicture(picture)?.payload?.image;
    consumed.add(index);
    return {consumed, ...(typeof image?.src === 'string' ? {fallback: {path: manifest.path, image: {src: image.src, ...(typeof image.alt === 'string' ? {alt: image.alt} : {})}}} : {})};
  } catch {
    invalid();
    return {consumed};
  }
}
