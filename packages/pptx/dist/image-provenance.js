import {XMLParser} from 'fast-xml-parser';
import {normalizeCrop, withoutSvgBlip} from './svg-image.js';
import {attachTextTags, decodeTextTag} from './code-provenance.js';

// FA-23 (OPF 0.15): image blocks and image backgrounds as native pictures.
//
// Every image block (core ComposedItem.image) exports as one native picture at core's frame. Its fit and focus are an
// a:srcRect; its treatments keep the DrawingML mapping 0.14's slide image used: the mask is a:prstGeom with core's guide
// values, the border an a:ln centered on the outline with a miter join, and the recolor and opacity a:grayscl or
// a:duotone then a:alphaModFix on the blip. An overlay is one native shape directly above its picture.
//
// An image background (core SlideComposition.backgroundImage) with alt text is a full-slide picture at the back of the
// slide (screen readers read its descr); without alt it is the native slide background fill (src/background.js), and its
// overlay is the first shape of the slide.
//
// OPF_IMAGE_V1 binds a picture to the image block's (or background's) own authored fields and the exact native geometry it
// was written with, so an unchanged picture imports back with its treatments and placement while an edited one stays an
// ordinary picture. OPF_IMAGE_OVERLAY_V1 does the same for an overlay shape: an edited overlay drops only the overlay.
export const IMAGE_TAG = 'OPF_IMAGE_V1', IMAGE_OVERLAY_TAG = 'OPF_IMAGE_OVERLAY_V1';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const EMUS_PER_INCH = 914400;
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const decoder = new TextDecoder('utf-8', {fatal:true}), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Whitespace-only text between elements is not identity: the vendored writer indents, PowerPoint drops it on save.
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().filter(key => !(key === '#text' && typeof item[key] === 'string' && !item[key].trim())).map(key => [key, item[key]])) : item);

/** An image block's own fields (everything but its type, asset, id, caption and extensions). */
export const IMAGE_TREATMENT_KEYS = Object.freeze(['fit', 'focus', 'shape', 'cornerRadius', 'border', 'opacity', 'recolor', 'overlay', 'aspectRatio', 'placement']);
/** An image background's own fields besides its source. */
export const BACKGROUND_IMAGE_KEYS = Object.freeze(['alt', 'fit', 'focus', 'opacity', 'recolor', 'overlay']);

export const imageName = number => `OPF image ${number}`;
export const imageOverlayName = pictureName => `${pictureName} overlay`;
export const backgroundImageName = slide => `OPF background ${slide}`;
export const backgroundOverlayName = slide => `OPF background overlay ${slide}`;

// DrawingML for the shared treatment: preset geometry (core guide values), a centered solid line, and blip
// recolor/alpha effects applied in that order.
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
  const {['a:blip']: blip, ...rest} = normalizeCrop(blipFill) ?? {};
  const {['r:embed']: _embed, ...blipRest} = withoutSvgBlip(blip) ?? {};
  return {...rest, 'a:blip': blipRest};
}

// The focus point in the stored picture's own axes. DrawingML crops (a:srcRect) the picture before it flips and turns it
// (the EXIF orientation is written as the frame's rot/flipH/flipV), so a point the author placed on the displayed
// picture maps back through that orientation.
function storedFocus({x, y}, orientation) {
  switch (orientation) {
    case 2: return {x: 1 - x, y};
    case 3: return {x: 1 - x, y: 1 - y};
    case 4: return {x, y: 1 - y};
    case 5: return {x: y, y: x};
    case 6: return {x: y, y: 1 - x};
    case 7: return {x: 1 - y, y: 1 - x};
    case 8: return {x: 1 - y, y: x};
    default: return {x, y};
  }
}

const srcRectValue = value => Math.round(value * 100000) || 0;

/**
 * The native frame and crop of a picture: `box` (inches) is core's picture frame, `fit` cover | contain | stretch,
 * `focus` core's focus point, `metadata` the embedded raster (width, height, orientation). `fitImage` is core's shared
 * fit math. A plain contain picture (`shrink`: a rectangle with no line or overlay) is framed by the picture itself, as
 * 0.14 content images were; every other picture keeps the frame and pads with negative a:srcRect insets, so the mask,
 * line and overlay apply to core's frame.
 */
export function pictureFrame(metadata, {box, fit, focus = {x: .5, y: .5}, shrink = false}, fitImage) {
  const orientation = metadata.orientation ?? 1;
  const target = orientation >= 5 ? {x: box.x + (box.w - box.h) / 2, y: box.y + (box.h - box.w) / 2, w: box.h, h: box.w} : box;
  const rotation = [0, 0, 0, 180, 0, 90, 90, 90, 270][orientation];
  const transform = {rotation, flipH: orientation === 2 || orientation === 7, flipV: orientation === 4 || orientation === 5};
  // A tiled picture fills its frame with the picture at its intrinsic size; nothing is cropped.
  if (fit === 'tile') return {...target, crop: null, ...transform};
  const placed = fitImage({x: target.x, y: target.y, width: target.w, height: target.h}, fit, metadata.width / metadata.height, storedFocus(focus, orientation));
  if (shrink && fit === 'contain') return {x: placed.image.x, y: placed.image.y, w: placed.image.width, h: placed.image.height, crop: null, ...transform};
  const crop = {l: srcRectValue(placed.crop.left), t: srcRectValue(placed.crop.top), r: srcRectValue(placed.crop.right), b: srcRectValue(placed.crop.bottom)};
  return {...target, crop: Object.values(crop).some(Boolean) ? crop : null, ...transform};
}

/**
 * Place each generated image picture at its frame, write its treatment, place its overlay shape, then bind the tagged
 * ones to their manifests. Runs after PptxGenJS embedded the bytes (the frame needs the raster's own size).
 * images: Map<objectName, {slide, role: 'block' | 'background', path, box (inches), fit, focus, shrink, effects, treatment}>;
 * `treatment` (the authored fields) is stored in OPF_IMAGE_V1 when present.
 * overlays: Map<objectName, {slide, owner, box (reference px), shape, hex, alpha, opacity, overlay}>; `owner` is the
 * picture's objectName, or 'background' for the overlay of a native slide background fill; `overlay` (the authored value)
 * is stored in OPF_IMAGE_OVERLAY_V1.
 */
export function placeImages(entries, images, overlays, {metadataFor, fail, fitImage}) {
  if (!images.size && !overlays.size) return;
  const manifests = new Map(), overlayManifests = new Map(), placed = new Set(), shaped = new Set();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const xml = decoder.decode(entries[part]);
    let next = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      const name = picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const image = images.get(name);
      if (!image) return picture;
      const embed = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      const metadata = metadataFor(part, embed);
      if (!metadata) fail(image.path);
      const frame = pictureFrame(metadata, image, fitImage);
      const emu = value => Math.round(value * EMUS_PER_INCH);
      const attributes = `${frame.rotation ? ` rot="${frame.rotation * 60000}"` : ''}${frame.flipH ? ' flipH="1"' : ''}${frame.flipV ? ' flipV="1"' : ''}`;
      picture = picture.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, `<a:xfrm${attributes}><a:off x="${emu(frame.x)}" y="${emu(frame.y)}"/><a:ext cx="${emu(frame.w)}" cy="${emu(frame.h)}"/></a:xfrm>`);
      picture = picture.replace(/<a:srcRect\b[^>]*\/>/, '');
      if (frame.crop) picture = picture.replace('<a:stretch>', `<a:srcRect l="${frame.crop.l}" t="${frame.crop.t}" r="${frame.crop.r}" b="${frame.crop.b}"/><a:stretch>`);
      if (image.fit === 'tile') picture = picture.replace(/<a:stretch>[\s\S]*?<\/a:stretch>|<a:stretch\/>/, `<a:tile tx="0" ty="0" sx="${srcRectValue((metadata.dpiX ?? 96) / 96)}" sy="${srcRectValue((metadata.dpiY ?? 96) / 96)}" flip="none" algn="tl"/>`);
      const effects = image.effects;
      if (effects) {
        picture = picture.replace(/<a:prstGeom\b[\s\S]*?<\/a:prstGeom>/, presetXml(effects.shape) + lineXml(effects.border));
        const blip = blipEffects(effects);
        if (blip) picture = picture.replace(/<a:blip\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:blip>)/, (_, attributes, inner = '') => `<a:blip${attributes}>${blip}${inner}</a:blip>`);
      }
      placed.add(name);
      if (image.treatment !== undefined) {
        const node = parser.parse(picture)['p:pic'];
        manifests.set(name, {v: 1, role: image.role, slide: image.slide, path: image.path, treatment: image.treatment, properties: node['p:spPr'], blipFill: blipFillIdentity(node['p:blipFill'])});
      }
      return picture;
    });
    next = next.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const overlay = overlays.get(name);
      if (!overlay) return shape;
      const emu = value => Math.round(value / 96 * EMUS_PER_INCH);
      shape = shape.replace(/<p:spPr>[\s\S]*?<\/p:spPr>/, `<p:spPr><a:xfrm><a:off x="${emu(overlay.box.x)}" y="${emu(overlay.box.y)}"/><a:ext cx="${emu(overlay.box.width)}" cy="${emu(overlay.box.height)}"/></a:xfrm>${presetXml(overlay.shape)}<a:solidFill>${colorXml(overlay, overlay.opacity)}</a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>`);
      const node = parser.parse(shape)['p:sp'];
      overlayManifests.set(name, {v: 1, slide: overlay.slide, owner: overlay.owner, overlay: overlay.overlay, properties: node['p:spPr']});
      shaped.add(name);
      return shape;
    });
    if (next !== xml) entries[part] = encoder.encode(next);
  }
  if (placed.size !== images.size) throw new Error('Missing generated image picture.');
  if (shaped.size !== overlays.size) throw new Error('Missing generated image overlay.');
  attachTextTags(entries, manifests, IMAGE_TAG, 'opfImage', 'image', {pictures: true});
  attachTextTags(entries, overlayManifests, IMAGE_OVERLAY_TAG, 'opfImageOverlay', 'image overlay');
}

// ---------------------------------------------------------------------------
// Import

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

// The one tag of `name` on a shape, decoded, or null (absent); throws when it is ambiguous or sits beside another OPF tag.
function ownTag(container, relationships, entries, name) {
  const {tags, unreadable} = readTags(container, relationships, entries);
  const own = tags.filter(tag => tag.name?.toUpperCase() === name);
  if (!own.length) return null;
  if (unreadable || own.length !== 1 || tags.some(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== name)) throw Error('Ambiguous image identity.');
  return decodeTextTag(own[0].val);
}

const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));

/**
 * Recover image blocks and an image background from unchanged tagged pictures and overlays of one slide.
 * - `blocks`: Map<picture index, fields> to merge into the ordinary image block read from that picture;
 * - `background`: the slide's image background from its tagged back picture, with the picture's index in `consumed`;
 * - `backgroundOverlay`: the authored overlay of a native slide background fill;
 * - `consumedShapes`: the overlay shapes recovered (they are no content).
 * readPicture(picture) returns the ordinary imported image payload; `valid(kind, value)` checks a recovered image block
 * (`kind` 'block') or background (`kind` 'background') against the OPF format.
 */
export function importImages({pictures, shapes, relationships, entries, slideIndex, readPicture, valid, report}) {
  const slide = `slides.${slideIndex}`;
  const blocks = new Map(), consumed = new Set(), consumedShapes = new Set();
  let background, backgroundOverlay;
  const invalid = (path, message) => report({code: 'invalid-image-provenance', path, message});
  // Overlay shapes first: each names the picture (or the slide background) it belongs to.
  const overlays = new Map();
  for (const [index, shape] of shapes.entries()) {
    let manifest;
    try { manifest = ownTag(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries, IMAGE_OVERLAY_TAG); }
    catch { invalid(slide, 'A tagged OPF image overlay is ambiguous; it was imported as an ordinary shape.'); continue; }
    if (manifest === null) continue;
    const name = shape['p:nvSpPr']?.['p:cNvPr']?.name;
    const expected = manifest?.owner === 'background' ? backgroundOverlayName(slide) : typeof manifest?.owner === 'string' ? imageOverlayName(manifest.owner) : undefined;
    if (manifest?.v !== 1 || manifest.slide !== slide || name !== expected || !object(manifest.overlay) || canonical(shape['p:spPr']) !== canonical(manifest.properties)) {
      overlays.set(manifest?.owner, {index, edited: true});
      continue;
    }
    if (overlays.has(manifest.owner)) { overlays.set(manifest.owner, {index, edited: true}); continue; }
    overlays.set(manifest.owner, {index, overlay: manifest.overlay});
  }
  const takeOverlay = (owner, path) => {
    const found = overlays.get(owner);
    if (!found) return undefined;
    if (found.edited) {
      invalid(path, 'The tagged OPF image overlay is missing, edited or ambiguous, so the image is recovered without its overlay; the remaining native shape is imported as ordinary content.');
      return undefined;
    }
    consumedShapes.add(found.index);
    return found.overlay;
  };
  const edges = new Set();
  for (const [index, picture] of pictures.entries()) {
    let manifest;
    try { manifest = ownTag(picture['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries, IMAGE_TAG); }
    catch { invalid(slide, 'A tagged OPF image is ambiguous; it was imported as an ordinary picture.'); continue; }
    if (manifest === null) continue;
    const name = picture['p:nvPicPr']?.['p:cNvPr']?.name;
    const role = manifest?.role;
    const path = role === 'background' ? `${slide}.design.background` : slide;
    try {
      if (manifest?.v !== 1 || manifest.slide !== slide || !['block', 'background'].includes(role) || !object(manifest.treatment)) throw Error('Invalid image manifest.');
      if (role === 'block' ? !/^OPF image \d+$/.test(name ?? '') : name !== backgroundImageName(slide)) throw Error('Image identity changed.');
      if (canonical(picture['p:spPr']) !== canonical(manifest.properties) || canonical(blipFillIdentity(picture['p:blipFill'])) !== canonical(normalizeCrop(manifest.blipFill))) throw Error('Image geometry or effects changed.');
    } catch {
      invalid(path, `An edited, ambiguous or invalid tagged OPF ${role === 'background' ? 'background picture' : 'image'} was imported as an ordinary picture; its OPF ${role === 'background' ? 'background' : 'treatment and placement'} are not reconstructed.`);
      continue;
    }
    if (role === 'background') {
      const item = readPicture(picture);
      const src = item?.payload?.image?.src;
      const fields = pick(manifest.treatment, BACKGROUND_IMAGE_KEYS.filter(key => key !== 'overlay'));
      const overlay = takeOverlay(name, `${path}.overlay`);
      const value = {type: 'image', src, ...fields, ...(overlay ? {overlay} : {})};
      if (typeof src !== 'string' || background || !valid('background', value)) { invalid(path, 'A tagged OPF background picture does not form a valid image background; it was imported as an ordinary picture.'); continue; }
      background = value;
      consumed.add(index);
      continue;
    }
    const fields = pick(manifest.treatment, IMAGE_TREATMENT_KEYS.filter(key => key !== 'overlay'));
    const overlay = takeOverlay(name, `${path}.overlay`);
    if (overlay) fields.overlay = overlay;
    // At most one placed block per edge: a copied tagged picture keeps its other fields and flows.
    const edge = fields.placement?.edge;
    if (edge !== undefined && edges.has(edge)) { delete fields.placement; invalid(path, `Two tagged OPF images are placed on the ${edge} edge; the second imports without its placement.`); }
    else if (edge !== undefined) edges.add(edge);
    const item = readPicture(picture);
    const candidate = {...item?.payload, ...fields};
    if (!item?.payload || !valid('block', candidate)) { invalid(path, 'A tagged OPF image does not form a valid image block; it was imported as an ordinary picture.'); if (edge !== undefined) edges.delete(edge); continue; }
    blocks.set(index, fields);
  }
  // The overlay of a native slide background fill.
  backgroundOverlay = takeOverlay('background', `${slide}.design.background.overlay`);
  const backgroundOverlayShape = backgroundOverlay ? overlays.get('background').index : undefined;
  for (const [owner, found] of overlays) if (!found.edited && !consumedShapes.has(found.index) && owner !== 'background') {
    invalid(`${slide}`, 'A tagged OPF image overlay no longer has its picture; it was imported as an ordinary shape.');
  }
  return {blocks, background, backgroundOverlay, backgroundOverlayShape, consumed, consumedShapes};
}
