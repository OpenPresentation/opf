// design.slideImage exports as one native picture at the shared composition
// frame (crop/fit through a:srcRect) and imports back as design.slideImage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide } from '@openpresentation/opf/composition';
import { toPptx, fromPptx } from '../dist/index.js';

const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const decode = bytes => new TextDecoder().decode(bytes);
const wide = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const tall = await readFile(new URL('fixtures/images/tall.png', import.meta.url));
const uri = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const composeCompat = composeSlide({ title: 'probe', design: { slideImage: { src: 'x', position: 'left' } } });
// This suite runs against the linked coordinated core; a core without
// geometry.slideImage is a pinning error, not a reason to skip.
assert.ok(composeCompat.slideImage, 'Linked core composition has no geometry.slideImage; pin a core with FF-26 slide-image composition.');

async function exported(deck) {
  const diagnostics = [];
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, onDiagnostic: d => diagnostics.push(d) });
  const entries = unzipSync(bytes);
  const slide = parser.parse(decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
  return { bytes, entries, slide, pictures: array(slide['p:pic']), diagnostics };
}
const emu = value => Math.round(value / 96 * 914400);
const deckFor = (slideImage, extra = {}) => ({ assets: { hero: { src: uri(wide), alt: 'Harbor at dusk' } }, design: { theme: 'classic', ...(extra.design ?? {}) },
  slides: [{ title: 'Slide image', text: 'Body copy beside the image.', ...(extra.slide ?? {}), design: { slideImage, ...(extra.slideDesign ?? {}) } }] });

let checked = 0;
for (const position of ['background', 'left', 'right', 'top', 'bottom']) {
  for (const fill of ['crop', 'fit']) {
    const deck = deckFor({ src: 'asset:hero', position }, { slideDesign: { imageFill: fill } });
    const geometry = composeSlide(deck.slides[0], { width: 1280, height: 720, presentation: deck });
    const { entries, pictures, bytes, slide } = await exported(deck);
    assert.equal(pictures.length, 1, `${position} ${fill}: one native picture`);
    const picture = pictures[0];
    assert.equal(picture['p:nvPicPr']['p:cNvPr'].name, 'OPF slide image slides.0');
    assert.equal(picture['p:nvPicPr']['p:cNvPr'].descr, 'Harbor at dusk');
    const xfrm = picture['p:spPr']['a:xfrm'], box = geometry.slideImage.box;
    // The picture frame is the shared composition frame for both fills.
    assert.deepEqual([xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number), [box.x, box.y, box.width, box.height].map(emu), `${position} ${fill}`);
    const crop = picture['p:blipFill']['a:srcRect'];
    const aspect = box.width / box.height, source = 120 / 60;
    if (Math.abs(aspect - source) < 1e-9) assert.equal(crop, undefined);
    else {
      const l = Number(crop.l), r = Number(crop.r), t = Number(crop.t), b = Number(crop.b);
      assert.equal(l, r); assert.equal(t, b); assert.ok(l === 0 || t === 0);
      // Visible source aspect equals the frame aspect: crop trims (positive), fit pads (negative).
      assert.ok(Math.abs(120 * (1 - (l + r) / 100000) / (60 * (1 - (t + b) / 100000)) - aspect) < 1e-3, `${position} ${fill} aspect`);
      assert.ok(fill === 'crop' ? l >= 0 && t >= 0 : l <= 0 && t <= 0, `${position} ${fill} sign`);
    }
    // The picture is beneath all content shapes, and content avoids banded images.
    const xml = decode(entries['ppt/slides/slide1.xml']);
    assert.ok(xml.indexOf('<p:pic>') < xml.indexOf('<p:sp>'), `${position}: picture first`);
    if (position !== 'background') {
      for (const shape of array(slide['p:sp'])) {
        const off = shape['p:spPr']?.['a:xfrm']?.['a:off'], ext = shape['p:spPr']?.['a:xfrm']?.['a:ext'];
        if (!off) continue;
        const [x, y, w, h] = [off.x, off.y, ext.cx, ext.cy].map(Number), [bx, by, bw, bh] = [box.x, box.y, box.width, box.height].map(emu);
        assert.ok(x >= bx + bw - 2 || x + w <= bx + 2 || y >= by + bh - 2 || y + h <= by + 2, `${position}: content outside image band`);
      }
    }
    // Round trip: the unchanged tagged picture becomes design.slideImage again.
    const diagnostics = [];
    const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
    const importedImage = imported.slides[0].design.slideImage;
    assert.equal(importedImage.position, position);
    assert.equal(importedImage.src, uri(wide));
    // Document provenance (FF-32) restores the authored slide imageFill; the slide
    // image tag alone restores only a fitted frame.
    assert.equal(imported.slides[0].design.imageFill, fill);
    const tagOnly = await fromPptx(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, provenance: false }), { onDiagnostic: () => {} });
    assert.equal(tagOnly.slides[0].design.imageFill, fill === 'fit' ? 'fit' : undefined);
    assert.equal(tagOnly.slides[0].design.slideImage.position, position);
    assert.equal(JSON.stringify(imported).includes('"type":"image"'), false, 'slide image is not also imported as content');
    assert.equal(diagnostics.some(d => /slide-image|image-crop|reference-changed/.test(d.code)), false, JSON.stringify(diagnostics));
    const again = await exported(imported);
    assert.deepEqual(again.pictures[0]['p:spPr'], picture['p:spPr'], `${position} ${fill}: stable re-export`);
    assert.deepEqual(again.pictures[0]['p:blipFill']['a:srcRect'], picture['p:blipFill']['a:srcRect']);
    checked++;
  }
}

// Deck-level images apply only where the layout reserves a slide image.
{
  const deck = { design: { theme: 'classic', slideImage: { src: uri(wide), position: 'right' } },
    catalogs: { layouts: { records: [{ $schema: 'https://openpresentation.org/schema/opf-layout/v1', id: 'hero-right', name: 'Hero right', slideImage: true, slideImageAlignment: 'Right', placeholders: [{ type: 'title' }] }] } },
    slides: [{ title: 'Uses the deck image', layout: 'hero-right' }, { title: 'Default layout, no image' }] };
  const bytes = await toPptx(deck, { imageFormat: 'preserve' });
  const entries = unzipSync(bytes);
  assert.equal((decode(entries['ppt/slides/slide1.xml']).match(/<p:pic>/g) ?? []).length, 1);
  assert.equal((decode(entries['ppt/slides/slide2.xml']).match(/<p:pic>/g) ?? []).length, 0);
  checked++;
}

// A root image with the slide image's source is exported once, as the slide image.
{
  const deck = { design: { theme: 'classic' }, slides: [{ title: 'Once', image: { src: uri(tall), alt: 'Tall' }, design: { slideImage: { src: uri(tall), position: 'left' } } }] };
  const { pictures } = await exported(deck);
  assert.equal(pictures.length, 1);
  assert.equal(pictures[0]['p:nvPicPr']['p:cNvPr'].descr, 'Tall');
  checked++;
}

// FF-53: a root `image` with the slide image's source (or one a source-less
// treatment places) is the slide image, not content (core `replacesContent`).
// The one native picture imports back as both design.slideImage and slide.image
// with its alt text; a slide whose content image differs keeps today's import.
{
  const cases = [
    ['same source', { title: 'Same source', image: { src: 'asset:hero', alt: 'Harbor at dusk' }, design: { slideImage: { src: 'asset:hero', position: 'background' } } }, 'background'],
    ['source-less treatment', { title: 'Placed', image: { src: uri(tall), alt: 'Tall' }, design: { slideImage: { position: 'left' } } }, 'left'],
  ];
  for (const [label, slide, position] of cases) {
    const deck = { assets: { hero: { src: uri(wide), alt: 'Harbor at dusk' } }, design: { theme: 'classic' }, slides: [slide] };
    assert.equal(composeSlide(slide, { presentation: deck }).slideImage.replacesContent, true, `${label}: core replaces content`);
    const { pictures, bytes } = await exported(deck);
    assert.equal(pictures.length, 1, `${label}: one native picture`);
    const diagnostics = [];
    const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
    const src = slide.image.src === 'asset:hero' ? uri(wide) : slide.image.src;
    assert.deepEqual(imported.slides[0].image, { src, alt: slide.image.alt }, `${label}: slide.image restored with its alt text`);
    assert.equal(imported.slides[0].design.slideImage.position, position, `${label}: design.slideImage restored`);
    assert.equal(imported.slides[0].design.slideImage.src, src);
    assert.equal(imported.slides[0].blocks, undefined, `${label}: no content image block`);
    assert.equal(composeSlide(imported.slides[0], { presentation: imported }).slideImage.replacesContent, true, `${label}: the import composes as the same slide image`);
    assert.deepEqual(diagnostics.filter(d => /slide-image|image-crop|reference-changed/.test(d.code)), [], label);
    // Re-export of the import places the same picture; provenance off restores nothing.
    assert.equal((await exported(imported)).pictures.length, 1, `${label}: re-export keeps one picture`);
    const tagOnly = await fromPptx(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, provenance: false }), { onDiagnostic: () => {} });
    assert.deepEqual(tagOnly.slides[0].image, { src, alt: slide.image.alt }, `${label}: the picture tag alone restores slide.image`);
    assert.equal(tagOnly.slides[0].design.slideImage.position, position);
    checked++;
  }
  // A content image with another source stays content beside the slide image.
  const separate = { assets: { hero: { src: uri(wide), alt: 'Harbor at dusk' } }, design: { theme: 'classic' }, slides: [{ title: 'Separate', image: { src: uri(tall), alt: 'Tall' }, design: { slideImage: { src: 'asset:hero', position: 'right' } } }] };
  assert.equal(composeSlide(separate.slides[0], { presentation: separate }).slideImage.replacesContent, false);
  const { pictures, bytes, entries } = await exported(separate);
  assert.equal(pictures.length, 2);
  const imported = await fromPptx(bytes, { onDiagnostic: () => {} });
  // The slide image tag never claims the content picture; the content topology
  // (OPF_SLIDE_V1 `content`) returns it as the authored root `image` payload.
  assert.deepEqual(imported.slides[0].image, { src: uri(tall), alt: 'Tall' }, 'a separate content image returns as the root image payload, not as the slide image');
  assert.equal(imported.slides[0].design.slideImage.position, 'right');
  assert.equal(imported.slides[0].blocks, undefined, 'the content image is the root payload, not a block');
  const untagged = await fromPptx(await toPptx(separate, { imageFormat: 'preserve', strictAssets: true, provenance: false }), { onDiagnostic: () => {} });
  assert.equal(untagged.slides[0].image, undefined, 'without provenance a separate content image is not restored as slide.image');
  assert.ok(JSON.stringify(untagged.slides[0].blocks).includes('"type":"image"'), 'the content image stays a content block');
  // The content flag never rides on an edited picture: it stays an ordinary picture.
  const path = 'ppt/slides/slide1.xml';
  const edited = unzipSync(await toPptx({ design: { theme: 'classic' }, slides: [cases[0][1]], assets: separate.assets }, { imageFormat: 'preserve', strictAssets: true }));
  edited[path] = new TextEncoder().encode(decode(edited[path]).replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`));
  const moved = await fromPptx(zipSync(edited), { onDiagnostic: () => {} });
  assert.equal(moved.slides[0].image, undefined);
  assert.equal(moved.slides[0].design?.slideImage, undefined);
  assert.ok(JSON.stringify(moved.slides[0].blocks).includes('"type":"image"'));
  void entries;
  checked++;
}

// An edited slide image stays an ordinary picture with a diagnostic.
{
  const { entries } = await exported(deckFor({ src: 'asset:hero', position: 'left' }));
  const path = 'ppt/slides/slide1.xml';
  entries[path] = new TextEncoder().encode(decode(entries[path]).replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`));
  const diagnostics = [];
  const imported = await fromPptx(zipSync(entries), { onDiagnostic: d => diagnostics.push(d) });
  assert.equal(imported.slides[0].design?.slideImage, undefined);
  assert.ok(diagnostics.some(d => d.code === 'invalid-slide-image-provenance' && d.path === 'slides.0.design.slideImage'));
  assert.ok(JSON.stringify(imported.slides[0].blocks).includes('"type":"image"'));
  checked++;
}

// Unresolved slide images use the ordinary placeholder, like content images.
{
  const bytes = await toPptx({ design: { theme: 'classic' }, slides: [{ title: 'Missing', design: { slideImage: { src: 'asset:missing', position: 'left' } } }] });
  assert.equal((decode(unzipSync(bytes)['ppt/slides/slide1.xml']).match(/<p:pic>/g) ?? []).length, 0);
  await assert.rejects(toPptx({ slides: [{ title: 'Missing', design: { slideImage: { src: 'asset:missing', position: 'left' } } }] }, { strictAssets: true }), { code: 'missing-asset' });
  checked++;
}
// FF-32: slide geometry evidence is recorded after the slide image is placed, so
// an unchanged slide with a slide image restores its layout reference.
{
  const deck = { design: { theme: 'classic', imageFill: 'crop' },
    catalogs: { layouts: { records: [{ $schema: 'https://openpresentation.org/schema/opf-layout/v1', id: 'hero-left', name: 'Hero left', slideImage: true, slideImageAlignment: 'Left', placeholders: [{ type: 'title' }, { type: 'text' }] }] } },
    slides: [{ layout: 'hero-left', title: 'Layout kept', text: 'Body', design: { slideImage: { src: uri(wide), position: 'left' } } },
      { layout: 'hero-left', title: 'Background', design: { slideImage: { src: uri(tall), position: 'background' } } }] };
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
  const diagnostics = [];
  const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
  assert.deepEqual(diagnostics.filter(d => /reference-changed|document-provenance|slide-image/.test(d.code)), []);
  assert.deepEqual(imported.slides.map(slide => slide.layout), ['hero-left', 'hero-left']);
  assert.deepEqual(imported.slides.map(slide => slide.design.slideImage.position), ['left', 'background']);
  assert.equal(imported.design.imageFill, 'crop');
  // Re-export of the import places the same pictures, so its evidence matches again.
  const again = await fromPptx(await toPptx(imported, { imageFormat: 'preserve', strictAssets: true }), { onDiagnostic: d => diagnostics.push(d) });
  assert.deepEqual(again.slides.map(slide => slide.layout), ['hero-left', 'hero-left']);
  assert.deepEqual(diagnostics.filter(d => /reference-changed|document-provenance|slide-image/.test(d.code)), []);
  // Moving the slide image is a structural edit: the layout is not restored and the picture stays ordinary.
  const entries = unzipSync(bytes), path = 'ppt/slides/slide1.xml';
  entries[path] = new TextEncoder().encode(decode(entries[path]).replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`));
  const moved = [];
  const edited = await fromPptx(zipSync(entries), { onDiagnostic: d => moved.push(d) });
  assert.equal(edited.slides[0].layout, undefined);
  assert.ok(moved.some(d => d.code === 'layout-reference-changed' && d.path === 'slides.0.layout'));
  assert.ok(moved.some(d => d.code === 'invalid-slide-image-provenance'));
  assert.equal(edited.slides[1].layout, 'hero-left');
  checked++;
}
console.log(`slide image: ${checked} native picture checks passed`);
