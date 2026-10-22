// FA-23: the DrawingML of image blocks and image backgrounds, from hand-built core composition values (FA-22 contract),
// and the OPF_IMAGE_V1 / OPF_IMAGE_OVERLAY_V1 round trip of the generated native objects. The fit math is passed in, as
// the exporter passes core's `fitImage`; `referenceFitImage` restates the contract's formula so this suite also pins it.
import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {pictureFrame, placeImages, importImages, imageOverlayName, backgroundImageName, backgroundOverlayName, IMAGE_TAG, IMAGE_OVERLAY_TAG} from '../dist/image-provenance.js';
import {nativeImageBackgroundFill, nativeTileScale} from '../dist/background.js';

const round = value => Math.round(value * 1e6) / 1e6 || value;
// The FA-22 fit contract: cover covers the frame and centers the focus point (clamped so the picture still covers it),
// contain fits and centers, stretch fills. crop = DrawingML srcRect insets as fractions (positive crops, negative pads).
function referenceFitImage(frame, fit, aspect, focus = {x: .5, y: .5}) {
  if (fit === 'stretch') return {image: {...frame}, crop: {left: 0, top: 0, right: 0, bottom: 0}};
  const wide = aspect > frame.width / frame.height, cover = fit === 'cover';
  const width = wide === cover ? frame.height * aspect : frame.width, height = wide === cover ? frame.height : frame.width / aspect;
  const place = (start, span, size, at) => cover ? Math.min(start, Math.max(start + span - size, start + span / 2 - at * size)) : start + (span - size) / 2;
  const image = {x: place(frame.x, frame.width, width, focus.x), y: place(frame.y, frame.height, height, focus.y), width, height};
  const crop = {left: round((frame.x - image.x) / width), top: round((frame.y - image.y) / height),
    right: round((image.x + width - frame.x - frame.width) / width), bottom: round((image.y + height - frame.y - frame.height) / height)};
  for (const key of Object.keys(crop)) if (Object.is(crop[key], -0)) crop[key] = 0;
  return {image: {x: round(image.x), y: round(image.y), width: round(width), height: round(height)}, crop};
}

let checked = 0;
const wide = {width: 120, height: 60}, box = {x: 1, y: 1, w: 4, h: 4};

// Cover: a centered crop is 0.14's (half the overflow on each side); a focus pins the crop toward that point.
{
  const center = pictureFrame(wide, {box, fit: 'cover'}, referenceFitImage);
  assert.deepEqual([center.x, center.y, center.w, center.h], [1, 1, 4, 4]);
  assert.deepEqual(center.crop, {l: 25000, t: 0, r: 25000, b: 0}, 'center cover crop');
  const left = pictureFrame(wide, {box, fit: 'cover', focus: {x: 0, y: .5}}, referenceFitImage);
  assert.deepEqual(left.crop, {l: 0, t: 0, r: 50000, b: 0}, 'focus at the left edge keeps the left half');
  const quarter = pictureFrame(wide, {box, fit: 'cover', focus: {x: .75, y: 0}}, referenceFitImage);
  assert.deepEqual(quarter.crop, {l: 50000, t: 0, r: 0, b: 0}, 'focus past the clamp keeps the right half');
  checked += 3;
}
// Contain: a plain picture in the flow shrinks its frame (0.14 content images); a treated or placed one pads.
{
  const shrunk = pictureFrame(wide, {box, fit: 'contain', shrink: true}, referenceFitImage);
  assert.deepEqual([shrunk.x, shrunk.y, shrunk.w, shrunk.h, shrunk.crop], [1, 2, 4, 2, null]);
  const padded = pictureFrame(wide, {box, fit: 'contain'}, referenceFitImage);
  assert.deepEqual([padded.x, padded.y, padded.w, padded.h], [1, 1, 4, 4]);
  assert.deepEqual(padded.crop, {l: 0, t: -50000, r: 0, b: -50000}, 'contain pads with negative insets');
  const stretched = pictureFrame(wide, {box, fit: 'stretch'}, referenceFitImage);
  assert.equal(stretched.crop, null);
  checked += 3;
}
// EXIF orientation 6 (stored picture turned a quarter clockwise for display): the frame swaps its axes and the focus maps
// into the stored picture, whose bottom edge is the displayed left edge.
{
  const turned = pictureFrame({...wide, orientation: 6}, {box: {x: 0, y: 0, w: 2, h: 4}, fit: 'cover', focus: {x: .5, y: 0}}, referenceFitImage);
  assert.equal(turned.rotation, 90);
  assert.deepEqual([turned.x, turned.y, turned.w, turned.h], [-1, 1, 4, 2]);
  assert.equal(turned.crop, null, 'a 2:1 picture turned into a 1:2 frame needs no crop');
  const left = pictureFrame({...wide, orientation: 6}, {box: {x: 0, y: 0, w: 2, h: 6}, fit: 'cover', focus: {x: 0, y: .5}}, referenceFitImage);
  assert.deepEqual(left.crop, {l: 0, t: 33333, r: 0, b: 0}, 'the displayed left is kept: the stored top is cropped');
  checked += 2;
}

// Background fills.
{
  const image = {width: 200, height: 100, dpiX: 192, dpiY: 96};
  assert.deepEqual(nativeTileScale(image), {sx: 200000, sy: 100000}, 'a 192 dpi tile is drawn at twice its native size: 1 px = 1/96 in');
  const tile = nativeImageBackgroundFill('rId9', image, {fit: 'tile', width: 1280, height: 720, fitImage: referenceFitImage});
  assert.equal(tile, '<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rId9"></a:blip><a:tile tx="0" ty="0" sx="200000" sy="100000" flip="none" algn="tl"/></a:blipFill>');
  const stretch = nativeImageBackgroundFill('rId9', image, {fit: 'stretch', opacity: .4, width: 1280, height: 720, fitImage: referenceFitImage});
  assert.equal(stretch, '<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rId9"><a:alphaModFix amt="40000"/></a:blip><a:stretch><a:fillRect/></a:stretch></a:blipFill>');
  const square = {width: 100, height: 100};
  const cover = nativeImageBackgroundFill('rId9', square, {fit: 'cover', focus: {x: .5, y: 1}, width: 1280, height: 720, fitImage: referenceFitImage});
  assert.equal(cover, '<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rId9"></a:blip><a:srcRect t="43750"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>', 'focus at the bottom crops the top');
  const contain = nativeImageBackgroundFill('rId9', square, {fit: 'contain', width: 1280, height: 720, fitImage: referenceFitImage});
  assert.equal(contain, '<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rId9"></a:blip><a:srcRect/><a:stretch><a:fillRect l="21875" r="21875"/></a:stretch></a:blipFill>');
  checked += 5;
}

// placeImages writes the treatment, the overlay and both tags; importImages recovers them while unchanged.
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const pic = (id, name) => `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
const sp = (id, name) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="000000"/></a:solidFill></p:spPr></p:sp>`;
const encode = value => new TextEncoder().encode(value), decode = bytes => new TextDecoder().decode(bytes);
function packageWith(shapes) {
  return {
    '[Content_Types].xml': encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'),
    'ppt/slides/slide1.xml': encode(`<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`),
    'ppt/slides/_rels/slide1.xml.rels': encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>')
  };
}
const shape = {kind: 'rounded', preset: 'roundRect', adjust: {adj: 12000}, path: ''};
const treatment = {fit: 'cover', focus: {x: .2, y: .5}, shape: 'rounded', cornerRadius: .12, border: {color: 'dark1', width: 4}, opacity: .8, recolor: {dark: 'accent1', light: 'light1'}, placement: {edge: 'right', size: .45}};
const images = new Map([['OPF image 1', {slide: 'slides.0', role: 'block', path: 'slides.0.blocks.0', box: {x: 7, y: 0, w: 6, h: 7.5}, fit: 'cover', focus: {x: .2, y: .5}, shrink: false,
  effects: {shape, border: {hex: '101820', alpha: 1, width: 4}, opacity: .8, recolor: {type: 'duotone', dark: {hex: '1F5AA6', alpha: 1}, light: {hex: 'F4F1EA', alpha: 1}}}, treatment}],
  [backgroundImageName('slides.0'), {slide: 'slides.0', role: 'background', path: 'slides.0.design.background', box: {x: 0, y: 0, w: 13.333333, h: 7.5}, fit: 'tile', focus: {x: .5, y: .5}, shrink: false, effects: null, treatment: {alt: 'Harbour', fit: 'tile'}}]]);
const overlays = new Map([[imageOverlayName('OPF image 1'), {slide: 'slides.0', owner: 'OPF image 1', box: {x: 672, y: 0, width: 576, height: 720}, shape, hex: '000000', alpha: 1, opacity: .3, overlay: {color: 'dark1', opacity: .3}}],
  [backgroundOverlayName('slides.0'), {slide: 'slides.0', owner: 'background', box: {x: 0, y: 540, width: 1280, height: 180}, shape: {kind: 'rectangle', preset: 'rect', adjust: {}, path: ''}, hex: '101820', alpha: .5, opacity: .75, overlay: {color: '#10182080', opacity: .75, edge: 'bottom', size: .25}}]]);
const entries = packageWith(pic(2, backgroundImageName('slides.0')) + sp(3, backgroundOverlayName('slides.0')) + pic(4, 'OPF image 1') + sp(5, imageOverlayName('OPF image 1')));
placeImages(entries, images, overlays, {metadataFor: () => ({width: 120, height: 60, mediaType: 'image/png'}), fail: path => { throw Error(path); }, fitImage: referenceFitImage});
const xml = decode(entries['ppt/slides/slide1.xml']);
{
  const block = /<p:pic><p:nvPicPr><p:cNvPr id="4"[\s\S]*?<\/p:pic>/.exec(xml)[0];
  assert.match(block, /<a:blip r:embed="rId2"><a:duotone><a:srgbClr val="1F5AA6"><\/a:srgbClr><a:srgbClr val="F4F1EA"><\/a:srgbClr><\/a:duotone><a:alphaModFix amt="80000"\/><\/a:blip>/, 'recolor then alpha on the blip');
  assert.match(block, /<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 12000"\/><\/a:avLst><\/a:prstGeom><a:ln w="38100" algn="ctr"><a:solidFill><a:srgbClr val="101820"><\/a:srgbClr><\/a:solidFill><a:miter lim="800000"\/><\/a:ln>/, 'mask, then a centered mitered line');
  // A 2:1 picture in a 6 x 7.5 in frame: cover keeps 0.4 of its width; the focus at 0.2 pins the crop to the left edge.
  assert.match(block, /<a:srcRect l="0" t="0" r="60000" b="0"\/><a:stretch>/);
  assert.match(block, /<a:off x="6400800" y="0"\/><a:ext cx="5486400" cy="6858000"\/>/);
  assert.match(block, /<p:custDataLst><p:tags r:id="rIdOpfImage\d+"\/><\/p:custDataLst>/);
  const background = /<p:pic><p:nvPicPr><p:cNvPr id="2"[\s\S]*?<\/p:pic>/.exec(xml)[0];
  assert.match(background, /<a:tile tx="0" ty="0" sx="100000" sy="100000" flip="none" algn="tl"\/>/, 'a tiled back picture');
  assert.doesNotMatch(background, /<a:srcRect/);
  const bandOverlay = /<p:sp><p:nvSpPr><p:cNvPr id="3"[\s\S]*?<\/p:sp>/.exec(xml)[0];
  assert.match(bandOverlay, /<a:off x="0" y="5143500"\/><a:ext cx="12192000" cy="1714500"\/><\/a:xfrm><a:prstGeom prst="rect"><a:avLst><\/a:avLst><\/a:prstGeom><a:solidFill><a:srgbClr val="101820"><a:alpha val="37500"\/><\/a:srgbClr><\/a:solidFill><a:ln><a:noFill\/><\/a:ln>/);
  assert.ok(xml.indexOf('id="4"') < xml.indexOf('id="5"'), 'overlay directly above its picture');
  const tags = Object.keys(entries).filter(path => path.startsWith('ppt/tags/'));
  assert.deepEqual(tags.sort(), ['ppt/tags/opfImage1.xml', 'ppt/tags/opfImage2.xml', 'ppt/tags/opfImageOverlay1.xml', 'ppt/tags/opfImageOverlay2.xml']);
  assert.ok(tags.every(path => decode(entries[path]).includes(path.includes('Overlay') ? `name="${IMAGE_OVERLAY_TAG}"` : `name="${IMAGE_TAG}"`)));
  checked += 9;
}

// Import: read the generated slide as the importer does.
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text', parseAttributeValue: false, parseTagValue: false, trimValues: false});
function nativeSlide(parts) {
  const tree = parser.parse(decode(parts['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
  const rels = new Map([...decode(parts['ppt/slides/_rels/slide1.xml.rels']).matchAll(/<Relationship Id="([^"]+)" Type="([^"]+)" Target="([^"]+)"/g)]
    .map(([, id, type, target]) => [id, {type, path: `ppt/${target.replace('../', '')}`}]));
  const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
  return {pictures: list(tree['p:pic']), shapes: list(tree['p:sp']), relationships: rels};
}
const recover = (parts, extra = {}) => {
  const reports = [];
  const result = importImages({...nativeSlide(parts), entries: parts, slideIndex: 0, readPicture: () => ({payload: {type: 'image', image: {src: 'data:image/png;base64,AA=='}}}),
    valid: () => true, report: diagnostic => reports.push(diagnostic), ...extra});
  return {...result, reports};
};
{
  const result = recover(entries);
  assert.deepEqual(result.reports, []);
  assert.deepEqual(result.blocks.get(1), {...treatment, overlay: {color: 'dark1', opacity: .3}});
  assert.deepEqual(result.background, {type: 'image', src: 'data:image/png;base64,AA==', alt: 'Harbour', fit: 'tile'});
  assert.deepEqual(result.backgroundOverlay, {color: '#10182080', opacity: .75, edge: 'bottom', size: .25});
  assert.deepEqual([...result.consumed], [0]);
  assert.deepEqual([...result.consumedShapes].sort(), [0, 1]);
  checked += 6;
}
{
  // An edited overlay drops only the overlay; an edited picture becomes an ordinary image.
  const edited = {...entries, 'ppt/slides/slide1.xml': encode(xml.replace('<a:alpha val="37500"/>', '<a:alpha val="50000"/>').replace('r="60000"', 'r="50000"'))};
  const result = recover(edited);
  assert.equal(result.blocks.has(1), false, 'a re-cropped picture is an ordinary image');
  assert.equal(result.backgroundOverlay, undefined);
  assert.equal(result.background.alt, 'Harbour');
  // The edited picture, the edited background overlay, and the block's unchanged overlay that lost its picture.
  assert.deepEqual(result.reports.map(report => report.code), ['invalid-image-provenance', 'invalid-image-provenance', 'invalid-image-provenance']);
  assert.equal(result.consumedShapes.size, 0, 'both overlays stay ordinary shapes');
  // A recovered block that would not validate stays ordinary.
  const rejected = recover(entries, {valid: kind => kind !== 'block'});
  assert.equal(rejected.blocks.size, 0);
  checked += 5;
}
console.log(`FA-23 image DrawingML: ${checked} checks passed`);
