import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {framedPictureTransform} from './image-geometry.js';

// A slide-level image (design.slideImage) exports as one native picture. Its
// tag records the OPF placement and the exact native geometry, so an unchanged
// picture imports back as design.slideImage while an edited one stays ordinary.
const TAG = 'OPF_SLIDE_IMAGE_V1', OVERLAY_TAG = 'OPF_SLIDE_IMAGE_OVERLAY_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const EMUS_PER_INCH = 914400;
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const decoder = new TextDecoder('utf-8', {fatal:true}), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const POSITIONS = ['background', 'top', 'bottom', 'left', 'right'];

export const slideImageName = slidePath => `OPF slide image ${slidePath}`;
export const slideImageOverlayName = slidePath => `OPF slide image overlay ${slidePath}`;

// DrawingML for the shared treatment: preset geometry (core guide values), a
// centered solid line, and blip recolor/alpha effects applied in that order.
const presetXml = shape => `<a:prstGeom prst="${shape?.preset ?? 'rect'}"><a:avLst>${Object.entries(shape?.adjust ?? {}).map(([name, value]) => `<a:gd name="${name}" fmla="val ${value}"/>`).join('')}</a:avLst></a:prstGeom>`;
const colorXml = ({hex, alpha}, extraAlpha = 1) => {
  const value = Math.round(alpha * extraAlpha * 100000);
  return `<a:srgbClr val="${hex}">${value < 100000 ? `<a:alpha val="${value}"/>` : ''}</a:srgbClr>`;
};
const lineXml = border => border ? `<a:ln w="${Math.round(border.width / 96 * EMUS_PER_INCH)}" algn="ctr"><a:solidFill>${colorXml(border)}</a:solidFill><a:miter lim="800000"/></a:ln>` : '';
function blipEffects(effects) {
  let xml = '';
  if (effects?.recolor?.type === 'grayscale') xml += '<a:grayscl/>';
  if (effects?.recolor?.type === 'duotone') xml += `<a:duotone>${colorXml({...effects.recolor.dark, alpha: 1})}${colorXml({...effects.recolor.light, alpha: 1})}</a:duotone>`;
  if (typeof effects?.opacity === 'number') xml += `<a:alphaModFix amt="${Math.round(effects.opacity * 100000)}"/>`;
  return xml;
}

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
  const manifests = new Map(), overlays = new Map();
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
      const effects = image.effects;
      if (effects) {
        picture = picture.replace(/<a:prstGeom\b[\s\S]*?<\/a:prstGeom>/, presetXml(effects.shape) + lineXml(effects.border));
        const blip = blipEffects(effects);
        if (blip) picture = picture.replace(/<a:blip\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:blip>)/, (_, attributes, inner = '') => `<a:blip${attributes}>${blip}${inner}</a:blip>`);
      }
      const node = parser.parse(picture)['p:pic'];
      manifests.set(name, {v:1, slide:image.slide, position:image.treatment.position, fill:image.fill, treatment:image.treatment,
        properties:node['p:spPr'], blipFill:blipFillIdentity(node['p:blipFill'])});
      return picture;
    });
    const shaped = next.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const image = [...images.values()].find(candidate => slideImageOverlayName(candidate.slide) === name);
      const overlay = image?.effects?.overlay;
      if (!overlay) return shape;
      const emu = value => Math.round(value / 96 * EMUS_PER_INCH);
      shape = shape.replace(/<p:spPr>[\s\S]*?<\/p:spPr>/, `<p:spPr><a:xfrm><a:off x="${emu(overlay.box.x)}" y="${emu(overlay.box.y)}"/><a:ext cx="${emu(overlay.box.width)}" cy="${emu(overlay.box.height)}"/></a:xfrm>${presetXml(overlay.shape)}<a:solidFill>${colorXml(overlay, overlay.opacity)}</a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>`);
      const node = parser.parse(shape)['p:sp'];
      overlays.set(name, {v:1, slide:image.slide, properties:node['p:spPr']});
      return shape;
    });
    if (shaped !== xml) entries[part] = encoder.encode(shaped);
  }
  if (manifests.size !== images.size) throw new Error('Missing generated slide image picture.');
  attachTextTags(entries, manifests, TAG, 'opfSlideImage', 'slide image', {pictures:true});
  attachTextTags(entries, overlays, OVERLAY_TAG, 'opfSlideImageOverlay', 'slide image overlay');
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
export function importSlideImage(pictures, shapes, relationships, entries, slideIndex, readPicture, report) {
  const consumed = new Set(), consumedShapes = new Set(), found = [];
  for (const [index, picture] of pictures.entries()) {
    const {tags, unreadable} = readTags(picture['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
    const own = tags.filter(tag => tag.name?.toUpperCase() === TAG);
    if (!own.length) continue;
    found.push({index, picture, own, unreadable, others: tags.some(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== TAG)});
  }
  if (!found.length) return {consumed, consumedShapes};
  const invalid = () => report({code:'invalid-slide-image-provenance', message:'An edited, ambiguous or invalid tagged OPF slide image was imported as an ordinary picture. Its native placement is not reconstructed as design.slideImage.'});
  if (found.length > 1) { invalid(); return {consumed, consumedShapes}; }
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
    const treatment = {...manifest.treatment};
    if (treatment.overlay !== undefined) {
      // The scrim is a separate native shape; recover it only while it is unchanged.
      const overlay = findOverlay(shapes, relationships, entries, manifest.slide);
      if (overlay === null) {
        delete treatment.overlay;
        report({code:'invalid-slide-image-provenance', message:'The tagged OPF slide image overlay is missing, edited or ambiguous. The slide image is recovered without its overlay; any remaining native shape is imported as ordinary content.'});
      } else consumedShapes.add(overlay);
    }
    return {consumed, consumedShapes, design: {slideImage: {...treatment, src}, ...(manifest.fill === 'fit' ? {imageFill: 'fit'} : {})}};
  } catch {
    invalid();
    return {consumed, consumedShapes};
  }
}

function findOverlay(shapes, relationships, entries, slide) {
  const matches = [];
  for (const [index, shape] of shapes.entries()) {
    const {tags, unreadable} = readTags(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
    const own = tags.filter(tag => tag.name?.toUpperCase() === OVERLAY_TAG);
    if (!own.length) continue;
    try {
      if (unreadable || own.length !== 1 || tags.some(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== OVERLAY_TAG)) throw Error('Ambiguous overlay identity.');
      const manifest = decodeTextTag(own[0].val);
      if (manifest?.v !== 1 || manifest.slide !== slide || shape['p:nvSpPr']?.['p:cNvPr']?.name !== slideImageOverlayName(slide)) throw Error('Invalid overlay identity.');
      if (canonical(shape['p:spPr']) !== canonical(manifest.properties)) throw Error('Overlay changed.');
      matches.push(index);
    } catch { return null; }
  }
  return matches.length === 1 ? matches[0] : null;
}
