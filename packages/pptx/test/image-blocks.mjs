// FA-23: image blocks (core 0.15 ComposedItem.image) export as one native picture at core's frame, with fit and focus as
// an a:srcRect, and placed blocks bleed to their edge band. An unchanged picture imports back as the same image block
// (OPF_IMAGE_V1); an edited one stays an ordinary image.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide, fitImage } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { toPptx, fromPptx } from '../dist/index.js';

const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const decode = bytes => new TextDecoder().decode(bytes);
const wide = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const tall = await readFile(new URL('fixtures/images/tall.png', import.meta.url));
const uri = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
// This suite runs against the linked coordinated core; a core without image block geometry is a pinning error.
assert.ok(composeSlide({ title: 'probe', blocks: [{ type: 'image', image: 'x', placement: { edge: 'left' } }] }).items.some(item => item.image?.placement),
  'Linked core composition has no ComposedItem.image placement; pin a core with the FA-22 image blocks.');

async function exported(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, onDiagnostic: d => diagnostics.push(d), ...options });
  const entries = unzipSync(bytes);
  const slide = parser.parse(decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
  return { bytes, entries, slide, pictures: array(slide['p:pic']), diagnostics };
}
const emu = value => Math.round(value / 96 * 914400);
// The slide's composition as the exporter composes it (core resolves the layout record and the design hints).
const imageItem = (deck, index = 0) => composeSlide(deck.slides[index], resolveSlideContext(deck, index, {}).options).items.find(item => item.field === 'image');
const deckFor = (block, extra = {}) => ({ assets: { hero: { src: uri(wide), alt: 'Harbor at dusk' } }, design: { ...(extra.design ?? {}) },
  slides: [{ title: 'Image block', blocks: [{ type: 'image', image: 'asset:hero', ...block }, { type: 'text', text: 'Body copy beside the image.' }], ...(extra.slide ?? {}) }] });

let checked = 0;
for (const edge of ['left', 'right', 'top', 'bottom']) {
  for (const fit of ['cover', 'contain', 'stretch']) {
    const deck = deckFor({ fit, placement: { edge, size: 0.4 } });
    const item = imageItem(deck);
    const { entries, pictures, bytes, slide } = await exported(deck);
    assert.equal(pictures.length, 1, `${edge} ${fit}: one native picture`);
    const picture = pictures[0];
    assert.match(picture['p:nvPicPr']['p:cNvPr'].name, /^OPF image \d+$/);
    assert.equal(picture['p:nvPicPr']['p:cNvPr'].descr, 'Harbor at dusk');
    const xfrm = picture['p:spPr']['a:xfrm'], box = item.image.box;
    // A placed picture keeps core's frame for every fit (as 0.14's slide image did).
    assert.deepEqual([xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number), [box.x, box.y, box.width, box.height].map(emu), `${edge} ${fit}`);
    assert.equal(item.image.box.x === 0 || item.image.box.y === 0 || item.image.box.x + item.image.box.width === 1280 || item.image.box.y + item.image.box.height === 720, true, `${edge}: bleeds to its edge`);
    const crop = picture['p:blipFill']['a:srcRect'];
    const expected = fitImage(box, fit, 120 / 60, item.image.focus).crop;
    const native = key => Number(crop?.[key] ?? 0) / 100000;
    for (const [key, side] of [['l', 'left'], ['t', 'top'], ['r', 'right'], ['b', 'bottom']]) assert.ok(Math.abs(native(key) - expected[side]) <= 1e-5, `${edge} ${fit} ${key}`);
    if (fit === 'stretch') assert.equal(crop, undefined);
    // The picture is beneath the slide's text, and content avoids the band.
    const xml = decode(entries['ppt/slides/slide1.xml']);
    // Core's item order: the headings, then the placed block, then the body.
    assert.ok(xml.indexOf('OPF heading slides.0.title') < xml.indexOf('<p:pic>') && xml.indexOf('<p:pic>') < xml.lastIndexOf('<p:sp>'), `${edge}: headings, picture, body`);
    for (const shape of array(slide['p:sp'])) {
      const off = shape['p:spPr']?.['a:xfrm']?.['a:off'], ext = shape['p:spPr']?.['a:xfrm']?.['a:ext'];
      if (!off) continue;
      const [x, y, w, h] = [off.x, off.y, ext.cx, ext.cy].map(Number), [bx, by, bw, bh] = [box.x, box.y, box.width, box.height].map(emu);
      assert.ok(x >= bx + bw - 2 || x + w <= bx + 2 || y >= by + bh - 2 || y + h <= by + 2, `${edge}: content outside the image band`);
    }
    // Round trip: the unchanged tagged picture is the same image block again.
    const diagnostics = [];
    const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
    const block = imported.slides[0].blocks.find(entry => entry.type === 'image');
    assert.deepEqual({ ...block, image: undefined }, { type: 'image', image: undefined, fit, placement: { edge, size: 0.4 } }, `${edge} ${fit}: treatment and placement return`);
    assert.equal(diagnostics.some(d => /image-provenance|image-crop|reference-changed/.test(d.code)), false, JSON.stringify(diagnostics));
    const tagOnly = await fromPptx(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, provenance: false }), { onDiagnostic: () => {} });
    assert.deepEqual(tagOnly.slides[0].blocks.find(entry => entry.type === 'image').placement, { edge, size: 0.4 }, 'the picture tag alone restores the placement');
    const again = await exported(imported);
    assert.deepEqual(again.pictures[0]['p:spPr'], picture['p:spPr'], `${edge} ${fit}: stable re-export`);
    assert.deepEqual(again.pictures[0]['p:blipFill']['a:srcRect'], picture['p:blipFill']['a:srcRect']);
    checked++;
  }
}

// Focus: a cover crop keeps the focus point in view.
{
  for (const focus of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.25, y: 0.5 }]) {
    const deck = deckFor({ fit: 'cover', focus, placement: { edge: 'left', size: 0.2 } });
    const item = imageItem(deck);
    const crop = (await exported(deck)).pictures[0]['p:blipFill']['a:srcRect'];
    const l = Number(crop.l ?? 0) / 100000, r = Number(crop.r ?? 0) / 100000;
    assert.ok(focus.x >= l - 1e-5 && focus.x <= 1 - r + 1e-5, `focus ${JSON.stringify(focus)} stays in the visible crop`);
    assert.deepEqual(item.image.focus, focus);
  }
  checked++;
}

// A flowed, untreated contain picture is framed by the picture itself (0.14 content images): no negative insets.
{
  const deck = deckFor({ fit: 'contain' });
  const item = imageItem(deck);
  const picture = (await exported(deck)).pictures[0], ext = picture['p:spPr']['a:xfrm']['a:ext'];
  assert.equal(picture['p:blipFill']['a:srcRect'], undefined);
  assert.ok(Math.abs(Number(ext.cx) / Number(ext.cy) - 2) < 1e-4, 'the frame has the picture aspect');
  assert.ok(Number(ext.cx) <= emu(item.image.box.width) + 1 && Number(ext.cy) <= emu(item.image.box.height) + 1);
  checked++;
}

// design.imageFit is the default fit of every image block; a plain block carries no OPF_IMAGE_V1 tag.
{
  const deck = { design: { imageFit: 'contain' }, slides: [{ title: 'Default fit', image: { src: uri(tall), alt: 'Tall' } }] };
  assert.equal(imageItem(deck).image.fit, 'contain');
  const { entries, bytes } = await exported(deck);
  assert.equal(Object.keys(entries).some(path => /^ppt\/tags\/opfImage\d+\.xml$/.test(path)), false, 'no tag for an untreated block');
  const imported = await fromPptx(bytes, { onDiagnostic: () => {} });
  assert.equal(imported.design.imageFit, 'contain', 'document provenance restores the deck default');
  assert.deepEqual(imported.slides[0].image, { src: uri(tall), alt: 'Tall' });
  checked++;
}

// A layout's image placeholder places the slide's image: the placement is the layout's, not the block's.
{
  const deck = { catalogs: { custom: { layouts: { 'hero-left': { name: 'Hero left', placeholders: [{ type: 'title' }, { type: 'image', placement: { edge: 'left', size: 0.45 } }, { type: 'text' }] } } } },
    slides: [{ layout: 'hero-left', title: 'Layout kept', text: 'Body', image: { src: uri(wide), alt: 'Wide' } }] };
  const item = imageItem(deck);
  assert.equal(item.image.placement.path, 'layout.placeholders.1.placement');
  const { bytes, pictures } = await exported(deck);
  assert.equal(Number(pictures[0]['p:spPr']['a:xfrm']['a:off'].x), 0);
  const diagnostics = [];
  const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
  assert.deepEqual(diagnostics.filter(d => /reference-changed|document-provenance|image-provenance/.test(d.code)), []);
  assert.equal(imported.slides[0].layout, 'hero-left');
  assert.deepEqual(imported.slides[0].image, { src: uri(wide), alt: 'Wide' }, 'no placement written onto the block');
  // Moving the picture is a structural edit: the layout is not restored and the picture stays ordinary.
  const entries = unzipSync(bytes), path = 'ppt/slides/slide1.xml';
  entries[path] = new TextEncoder().encode(decode(entries[path]).replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`));
  const moved = [];
  const edited = await fromPptx(zipSync(entries), { onDiagnostic: d => moved.push(d) });
  assert.equal(edited.slides[0].layout, undefined);
  assert.ok(moved.some(d => d.code === 'layout-reference-changed' && d.path === 'slides.0.layout'));
  checked++;
}

// An edited image block stays an ordinary picture with a diagnostic.
{
  const { entries } = await exported(deckFor({ placement: { edge: 'left' } }), { provenance: false });
  const path = 'ppt/slides/slide1.xml';
  entries[path] = new TextEncoder().encode(decode(entries[path]).replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`));
  const diagnostics = [];
  const imported = await fromPptx(zipSync(entries), { onDiagnostic: d => diagnostics.push(d) });
  const block = imported.slides[0].blocks.find(entry => entry.type === 'image');
  assert.equal(block.placement, undefined);
  assert.ok(diagnostics.some(d => d.code === 'invalid-image-provenance' && d.path === 'slides.0'));
  checked++;
}

// Unresolved image blocks draw the unavailable-image panel in their frame.
{
  const bytes = await toPptx({ slides: [{ title: 'Missing', blocks: [{ type: 'image', image: 'asset:missing', placement: { edge: 'left' } }] }] }, { onDiagnostic: () => {} });
  const xml = decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  assert.equal((xml.match(/<p:pic>/g) ?? []).length, 0);
  assert.match(xml, /name="OPF image placeholder 1"/);
  await assert.rejects(toPptx({ slides: [{ title: 'Missing', blocks: [{ type: 'image', image: 'asset:missing' }] }] }, { strictAssets: true }), { code: 'missing-asset' });
  checked++;
}
console.log(`image blocks: ${checked} native picture checks passed`);
