// Controls for the image-treatment probe (audit A, 2026-09-30). Run: node --test image-treatment.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeTreatmentImages, declaredImages } from './image-treatment.mjs';

const enc = (s) => new TextEncoder().encode(s);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const OTHER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const uri = (b) => `data:image/png;base64,${b.toString('base64')}`;
const REL = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const rels = (...r) => enc(`<Relationships>${r.join('')}</Relationships>`);
const pic = (name, embed, alpha) => `<p:pic><p:nvPicPr><p:cNvPr id="2" name="${name}"/></p:nvPicPr><p:blipFill><a:blip r:embed="${embed}">${alpha ? `<a:alphaModFix amt="${alpha}"/>` : ''}</a:blip></p:blipFill></p:pic>`;
const slideXml = (body, bg = '') => enc(`<p:sld>${bg}<p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`);
const base = (over = {}) => ({
  'ppt/slides/slide1.xml': slideXml(pic('OPF image 1', 'rId1')),
  'ppt/slides/_rels/slide1.xml.rels': rels(REL('rId1', 'image', '../media/image1.png'), REL('rId2', 'slideLayout', '../slideLayouts/slideLayout1.xml')),
  'ppt/media/image1.png': PNG,
  'ppt/slideLayouts/slideLayout1.xml': enc('<p:sldLayout/>'),
  ...over,
});
const doc = { design: {}, slides: [{ blocks: [{ type: 'image', image: { src: uri(PNG) } }] }] };
const svgs = [`<svg><image data-opf-path="slides.0.blocks.0.image" href="${uri(PNG)}"/></svg>`];

test('declaredImages counts image objects, asset references and the watermark once each', () => {
  const d = { assets: { hero: { src: uri(PNG) } }, design: { watermark: { src: 'asset:hero', opacity: 0.1 }, background: { type: 'image', image: { src: 'asset:hero' } } }, slides: [{ blocks: [{ type: 'image', image: { src: uri(PNG) } }] }] };
  assert.equal(declaredImages(d).length, 3);
  assert.ok(declaredImages(d).every((i) => i.hash));
});

test('a native picture with the preview bytes that re-imports is native and retained', () => {
  const p = probeTreatmentImages({ doc, svgs, files: base(), imported: doc });
  assert.deepEqual(p.reasons, []); assert.equal(p.native, true); assert.deepEqual(p.reimport.missing, []);
});

test('an export without the picture is not native', () => {
  const p = probeTreatmentImages({ doc, svgs, files: base({ 'ppt/slides/slide1.xml': slideXml('') }), imported: doc });
  assert.equal(p.native, false); assert.match(p.reasons.join('|'), /the preview draws 1 images, the export has 0 native image references/);
});

test('different bytes in the export are reported', () => {
  const p = probeTreatmentImages({ doc, svgs, files: base({ 'ppt/media/image1.png': OTHER }), imported: doc });
  assert.equal(p.native, false); assert.match(p.reasons.join('|'), /image bytes differ/);
});

test('a picture whose relationship does not resolve is reported', () => {
  const p = probeTreatmentImages({ doc, svgs, files: base({ 'ppt/slides/_rels/slide1.xml.rels': rels(REL('rId1', 'image', '../media/missing.png')) }), imported: doc });
  assert.equal(p.native, false); assert.match(p.reasons.join('|'), /no resolvable image part/);
});

test('an image background is a native blipFill with its opacity as alphaModFix', () => {
  const d = { design: { background: { type: 'image', image: { src: uri(PNG) }, opacity: 0.55 } }, slides: [{ blocks: [] }] };
  const sv = [`<svg><image data-opf-path="slides.0.design.background.image" href="${uri(PNG)}"/></svg>`];
  const bg = (alpha) => `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId1">${alpha ? `<a:alphaModFix amt="${alpha}"/>` : ''}</a:blip></a:blipFill></p:bgPr></p:bg>`;
  const ok = probeTreatmentImages({ doc: d, svgs: sv, files: base({ 'ppt/slides/slide1.xml': slideXml('', bg(55000)) }), imported: d });
  assert.deepEqual(ok.reasons, []); assert.equal(ok.native, true);
  const bad = probeTreatmentImages({ doc: d, svgs: sv, files: base({ 'ppt/slides/slide1.xml': slideXml('', bg()) }), imported: d });
  assert.match(bad.reasons.join('|'), /opacity 0.55 exports as alphaModFix none/);
});

test('a watermark is the picture named OPF watermark with alphaModFix equal to its opacity', () => {
  const d = { design: { watermark: { src: uri(PNG), opacity: 0.12 } }, slides: [{ blocks: [] }] };
  const sv = [`<svg><image data-opf-path="design.watermark" href="${uri(PNG)}"/></svg>`];
  const ok = probeTreatmentImages({ doc: d, svgs: sv, files: base({ 'ppt/slides/slide1.xml': slideXml(pic('OPF watermark', 'rId1', 12000)) }), imported: d });
  assert.deepEqual(ok.reasons, []);
  const wrong = probeTreatmentImages({ doc: d, svgs: sv, files: base({ 'ppt/slides/slide1.xml': slideXml(pic('OPF watermark', 'rId1', 50000)) }), imported: d });
  assert.match(wrong.reasons.join('|'), /opacity 0.12 exports as alphaModFix 50000/);
  const renamed = probeTreatmentImages({ doc: d, svgs: sv, files: base({ 'ppt/slides/slide1.xml': slideXml(pic('OPF image 1', 'rId1', 12000)) }), imported: d });
  assert.match(renamed.reasons.join('|'), /0 "OPF watermark" pictures/);
});

test('a re-import that drops the image, the background or the watermark is not retained', () => {
  const d = { design: { imageFill: 'crop', watermark: { src: uri(PNG), opacity: 0.12 } }, slides: [{ blocks: [{ type: 'image', image: { src: uri(PNG) } }] }] };
  const sv = [`<svg><image href="${uri(PNG)}"/><image data-opf-path="design.watermark" href="${uri(PNG)}"/></svg>`];
  const files = base({ 'ppt/slides/slide1.xml': slideXml(pic('OPF image 1', 'rId1') + pic('OPF watermark', 'rId1', 12000)) });
  const full = probeTreatmentImages({ doc: d, svgs: sv, files, imported: d });
  assert.deepEqual(full.reimport.missing, []);
  const dropped = probeTreatmentImages({ doc: d, svgs: sv, files, imported: { design: {}, slides: [{ blocks: [] }] } });
  assert.match(dropped.reimport.missing.join('|'), /re-import returns 0 images, the preview draws 2/);
  assert.match(dropped.reimport.missing.join('|'), /design.imageFill crop is not returned/);
  assert.match(dropped.reimport.missing.join('|'), /design.watermark is not returned/);
  const retypes = probeTreatmentImages({ doc: d, svgs: sv, files, imported: { ...d, slides: [{ blocks: [{ type: 'image', image: { src: uri(OTHER) } }] }], design: { ...d.design, watermark: { src: uri(PNG), opacity: 0.12 } } } });
  assert.match(retypes.reimport.missing.join('|'), /different image bytes|returns 1 images/);
});
