import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {framedPictureTransform} from './image-geometry.js';

// A slide-level image (design.slideImage) exports as one native picture. Its
// tag records the OPF placement and the exact native geometry, so an unchanged
// picture imports back as design.slideImage while an edited one stays ordinary.
const TAG = 'OPF_SLIDE_IMAGE_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const EMUS_PER_INCH = 914400;
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const decoder = new TextDecoder('utf-8', {fatal:true}), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const POSITIONS = ['background', 'top', 'bottom', 'left', 'right'];

export const slideImageName = slidePath => `OPF slide image ${slidePath}`;

// Native blip fill without its package-local relationship id.
function blipFillIdentity(blipFill) {
  const {['a:blip']: blip, ...rest} = blipFill ?? {};
  const {['r:embed']: _embed, ...blipRest} = blip ?? {};
  return {...rest, 'a:blip': blipRest};
}

/**
 * Place each generated slide-image picture at its frame (crop/fit through
 * a:srcRect), then bind the picture to its manifest with a native tag.
 * images: Map<objectName, {slide, box (inches), fill, treatment, path}>.
 */
export function placeSlideImages(entries, images, metadataFor, fail) {
  if (!images.size) return;
  const manifests = new Map();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const xml = decoder.decode(entries[part]);
    const next = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      const name = picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const image = images.get(name);
      if (!image) return picture;
      const embed = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      const metadata = metadataFor(part, embed);
      if (!metadata) fail(image.path);
      const placed = framedPictureTransform(metadata, image.box, image.fill);
      const emu = value => Math.round(value * EMUS_PER_INCH);
      const attributes = `${placed.rotation ? ` rot="${placed.rotation * 60000}"` : ''}${placed.flipH ? ' flipH="1"' : ''}${placed.flipV ? ' flipV="1"' : ''}`;
      picture = picture.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, `<a:xfrm${attributes}><a:off x="${emu(placed.x)}" y="${emu(placed.y)}"/><a:ext cx="${emu(placed.w)}" cy="${emu(placed.h)}"/></a:xfrm>`);
      picture = picture.replace(/<a:srcRect\b[^>]*\/>/, '');
      if (placed.crop) picture = picture.replace('<a:stretch>', `<a:srcRect l="${placed.crop.l}" t="${placed.crop.t}" r="${placed.crop.r}" b="${placed.crop.b}"/><a:stretch>`);
      const node = parser.parse(picture)['p:pic'];
      manifests.set(name, {v:1, slide:image.slide, position:image.treatment.position, fill:image.fill, treatment:image.treatment,
        properties:node['p:spPr'], blipFill:blipFillIdentity(node['p:blipFill'])});
      return picture;
    });
    if (next !== xml) entries[part] = encoder.encode(next);
  }
  if (manifests.size !== images.size) throw new Error('Missing generated slide image picture.');
  attachTextTags(entries, manifests, TAG, 'opfSlideImage', 'slide image', {pictures:true});
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

function validTreatment(treatment, position) {
  return treatment && typeof treatment === 'object' && !Array.isArray(treatment) && treatment.position === position
    && POSITIONS.includes(position) && treatment.src === undefined;
}

/**
 * Recover design.slideImage from an unchanged tagged picture. Returns the
 * consumed picture indexes and the slide design fields to restore.
 * readPicture(picture) returns the ordinary imported image payload.
 */
export function importSlideImage(pictures, relationships, entries, slideIndex, readPicture, report) {
  const consumed = new Set(), found = [];
  for (const [index, picture] of pictures.entries()) {
    const {tags, unreadable} = readTags(picture['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
    const own = tags.filter(tag => tag.name?.toUpperCase() === TAG);
    if (!own.length) continue;
    found.push({index, picture, own, unreadable, others: tags.some(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== TAG)});
  }
  if (!found.length) return {consumed};
  const invalid = () => report({code:'invalid-slide-image-provenance', message:'An edited, ambiguous or invalid tagged OPF slide image was imported as an ordinary picture. Its native placement is not reconstructed as design.slideImage.'});
  if (found.length > 1) { invalid(); return {consumed}; }
  const [{index, picture, own, unreadable, others}] = found;
  try {
    if (unreadable || others || own.length !== 1) throw Error('Ambiguous slide image identity.');
    const manifest = decodeTextTag(own[0].val);
    if (manifest?.v !== 1 || manifest.slide !== `slides.${slideIndex}` || !['crop', 'fit'].includes(manifest.fill) || !validTreatment(manifest.treatment, manifest.position)) throw Error('Invalid slide image manifest.');
    if (picture['p:nvPicPr']?.['p:cNvPr']?.name !== slideImageName(manifest.slide)) throw Error('Slide image identity changed.');
    if (canonical(picture['p:spPr']) !== canonical(manifest.properties) || canonical(blipFillIdentity(picture['p:blipFill'])) !== canonical(manifest.blipFill)) throw Error('Slide image geometry or effects changed.');
    const item = readPicture(picture);
    const src = item?.payload?.image?.src;
    if (typeof src !== 'string') throw Error('Slide image bytes are unavailable.');
    consumed.add(index);
    return {consumed, design: {slideImage: {...manifest.treatment, src}, ...(manifest.fill === 'fit' ? {imageFill: 'fit'} : {})}};
  } catch {
    invalid();
    return {consumed};
  }
}
