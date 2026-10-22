// Deterministic archive/rounding controls; these are not native-app observations.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import sharp from 'sharp';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {samePictureAspect, pictureFrame} from '../dist/image-provenance.js';
import {fitImage} from '@openpresentation/opf/composition';
import {toPptx, fromPptx} from '../dist/index.js';

// K08's exact published-export geometry: two successive rounding stages,
// not a stretched picture. One more EMU outside either cell must still fail.
assert.equal(samePictureAspect(10900294, 5450148, 120, 60), true);
assert.equal(samePictureAspect(10900293, 5450148, 120, 60), false);
assert.equal(samePictureAspect(10900297, 5450148, 120, 60), false);
assert.equal(samePictureAspect(5450148, 10900294, 60, 120), true);
assert.equal(samePictureAspect(5450148, 10900293, 60, 120), false);
// The cells touch only at an excluded upper endpoint: that is not overlap.
assert.equal(samePictureAspect(16459202, 5486400, 3, 1), false);
for (const dimensions of [[0, 1, 1, 1], [1.5, 1, 1, 1], [Infinity, 1, 1, 1], [1, 1, 0, 1], [1, 1, Number.MAX_SAFE_INTEGER + 1, 1]]) assert.equal(samePictureAspect(...dimensions), false);
const emu = inches => Math.round(inches * 914400);
for (const [width, height] of [[120, 60], [1279, 640], [3, 13], [640, 1279]]) {
  for (const h of [.000625, .123456789, 1.23456789, 5.9603536, 7.4999999]) {
    const frame = pictureFrame({width, height}, {box: {x: 0, y: 0, w: h * width / height, h}, fit: 'contain', shrink: true}, fitImage);
    assert.equal(samePictureAspect(emu(frame.w), emu(frame.h), width, height), true, `Actual pictureFrame serialization ${width}:${height} at ${h}`);
  }
}

const original = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const uri = bytes => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const source = {design: {fontScheme: {major: 'Arial', minor: 'Arial'}, dimensions: 'widescreen'}, slides: [{layout: 'image', title: 'K08 Replace this picture', image: {src: uri(original), alt: 'Current source image'}, design: {imageFit: 'contain'}, notes: 'Current source notes'}]};
const fonts = await loadFonts({pack: 'office'});
await fonts.ensure(source, {renderOptions: {catalogs: [gallery]}});
const options = {catalogs: [gallery], fonts, seed: 86, timestamp: '2026-10-15T00:00:00Z'};
const archive = unzipSync(await toPptx(source, options));
const slidePath = 'ppt/slides/slide1.xml', xml = strFromU8(archive[slidePath]);
const picture = xml.match(/<p:pic>[\s\S]*?<\/p:pic>/)[0];
assert.match(picture, /<a:ext cx="10900294" cy="5450148"\/>/, 'Authored contain exercises the actual two-EMU regression');
const diagnostics = [], unchanged = await fromPptx(zipSync(archive), {...options, onDiagnostic: d => diagnostics.push(d)});
assert.deepEqual(unchanged.slides[0].image, source.slides[0].image, 'Scalar image remains representable');
assert.equal(unchanged.slides[0].blocks, undefined);
assert.equal(unchanged.slides[0].design.imageFit, 'contain');
assert.equal(unchanged.slides[0].notes, source.slides[0].notes);
assert.ok(!diagnostics.some(d => d.code === 'invalid-document-provenance'), 'No false fit invalidates the scalar content');

const mediaTarget = strFromU8(archive['ppt/slides/_rels/slide1.xml.rels']).match(/Type="[^"]*\/image" Target="([^"]+)"/)[1];
const mediaPath = 'ppt/' + mediaTarget.replace(/^\.\.\//, '');
const edit = ({transform = value => value, media} = {}) => zipSync({...archive, [slidePath]: strToU8(xml.replace(picture, transform(picture)).replace('K08 Replace this picture', 'K08 CURRENT NATIVE TITLE')), ...(media ? {[mediaPath]: media} : {})});
const currentImage = doc => doc.slides[0].image ? {image: doc.slides[0].image} : doc.slides[0].blocks.find(block => block.image);
for (const cx of [10900293, 10900297]) {
  const changed = await fromPptx(edit({transform: value => value.replace('cx="10900294"', `cx="${cx}"`)}), options);
  assert.equal(currentImage(changed).fit, 'stretch', 'A real frame change just outside the serialization cell remains stretch');
  assert.equal(changed.slides[0].title, 'K08 CURRENT NATIVE TITLE', 'Stored title never replays over current text');
}
for (const [width, height, expectedFit] of [[120, 60, undefined], [60, 60, 'stretch']]) {
  const media = await sharp({create: {width, height, channels: 3, background: '#336699'}}).png().toBuffer();
  const changed = await fromPptx(edit({media, transform: value => value.replace(' descr="Current source image"', '')}), options);
  const block = currentImage(changed);
  assert.equal(block.image.src, uri(media), 'Current replacement bytes are authoritative');
  assert.equal(block.image.alt, undefined, 'A deleted native description stays deleted');
  assert.equal(block.fit, expectedFit, 'Fit follows the replacement raster aspect, never the original media');
  assert.equal(changed.slides[0].title, 'K08 CURRENT NATIVE TITLE');
}
const cropDiagnostics = [];
const cropped = await fromPptx(edit({transform: value => value.replace('<a:stretch>', '<a:srcRect l="1000"/><a:stretch>')}), {...options, onDiagnostic: d => cropDiagnostics.push(d)});
assert.equal(currentImage(cropped).fit, undefined, 'A current crop is not mislabeled as stretch');
assert.ok(cropDiagnostics.some(d => d.code === 'unsupported-image-crop'), 'Crop fidelity diagnostic remains explicit');
const cover = structuredClone(source); cover.slides[0].design.imageFit = 'cover';
assert.deepEqual((await fromPptx(await toPptx(cover, options), options)).slides[0].image, cover.slides[0].image, 'Existing authored cover behavior remains intact');
console.log('Image fit serialization: exact cells, boundary stretch, unchanged scalar contain, current replacement/text/deletion authority and crop/cover controls passed.');
