// LH-02: core's automatic scrims under text on a picture background export as native rectangles in bg1 (a linear gradient whose stops
// carry alpha, or one alpha fill for a band of one opacity) at core's geometry, directly above the picture and below the content, and
// import back as no content. An overlay of the author's replaces them and `overlay: false` turns them off.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';

const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const deck = (background, design = {}) => ({name: 'Scrims', language: 'en-US', design: {fontScheme: 'roboto'}, slides: [{title: 'Field context', subtitle: 'Over a photograph', design: {background: {type: 'image', src, ...background}, titleAlignment: 'right', ...design}}]});
const emu = px => Math.round(px / 96 * 914400);
const shapes = xml => [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*<\/p:sp>/g)].map(([shape]) => shape);
const scrimShapes = xml => shapes(xml).filter(shape => /name="OPF background (scrim|tone (dark|light))/.test(shape));

// Header and footer text get scrims of their own: three native rectangles at core's boxes, each a bg1 gradient with core's stops.
{
  const document = deck({}, {header: {left: {text: 'Context'}}, footer: {left: {text: 'Market review'}}});
  const context = resolveSlideContext(document, 0);
  const scrims = composeSlide(context.slide, context.options).backgroundImage.scrims;
  assert.equal(scrims.length, 3);
  const xml = strFromU8(unzipSync(await toPptx(document))['ppt/slides/slide1.xml']);
  const written = scrimShapes(xml);
  assert.deepEqual(written.map(shape => /name="([^"]+)"/.exec(shape)[1]), ['OPF background scrim slides.0', 'OPF background scrim slides.0 2', 'OPF background scrim slides.0 3']);
  scrims.forEach((scrim, index) => {
    const shape = written[index];
    assert.match(shape, new RegExp(`<a:off x="${emu(scrim.box.x)}" y="${emu(scrim.box.y)}"/><a:ext cx="${emu(scrim.box.width)}" cy="${emu(scrim.box.height)}"/>`), `scrim ${index + 1} at core's box`);
    const stops = [...shape.matchAll(/<a:gs pos="(\d+)"><a:schemeClr val="bg1"><a:alpha val="(\d+)"\/><\/a:schemeClr><\/a:gs>/g)].map(([, pos, alpha]) => ({position: Number(pos) / 100000, opacity: Number(alpha) / 100000}));
    assert.deepEqual(stops, scrim.stops, `scrim ${index + 1}: core's stops in bg1`);
    assert.match(shape, new RegExp(`<a:lin ang="${scrim.axis === 'vertical' ? 5400000 : 0}" scaled="0"/>`));
  });
  assert.ok(xml.indexOf('<p:pic>') < xml.indexOf('OPF background scrim') && xml.indexOf('OPF background scrim') < xml.indexOf('Field context'), 'picture, scrims, then content');
  const imported = await fromPptx(await toPptx(document));
  assert.deepEqual(imported.slides[0].design.background, {type: 'image', src: imported.slides[0].design.background.src}, 'the background returns without an overlay');
  assert.equal(JSON.stringify(imported.slides[0]).includes('OPF background scrim'), false, 'the scrims are no content');
  assert.equal(imported.slides[0].blocks, undefined, 'no shape imports as a block');
}

// An overlay of the author's replaces the scrim, and overlay: false turns it off; both return as authored.
for (const background of [{overlay: {color: 'dark1', opacity: 0.5}}, {overlay: false}]) {
  const document = deck(background);
  const xml = strFromU8(unzipSync(await toPptx(document))['ppt/slides/slide1.xml']);
  assert.equal(scrimShapes(xml).length, 0, JSON.stringify(background));
  const imported = await fromPptx(await toPptx(document));
  assert.deepEqual(imported.slides[0].design.background.overlay, background.overlay, JSON.stringify(background));
}

console.log('picture-scrim passed: native gradient scrims at core geometry for the body, header and footer, no content on import, an author overlay and overlay: false.');
