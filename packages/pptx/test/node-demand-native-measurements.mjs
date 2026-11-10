import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync, strFromU8} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toSvg} from '@openpresentation/opf-render';
import {examples} from '@openpresentation/opf/examples';
import {gallery} from '@openpresentation/gallery';
import {toPptx, fromPptx} from '../dist/index.js';

const deck = {slides: [{title: 'Title', text: [
  {text: 'Bonjour 1\nWelcome 2 ', language: 'ar-SA', fontFamily: 'Georgia'},
  {text: 'Hello 2', language: 'ar-SA', fontFamily: 'Times New Roman'},
]}]};
const loading = {pack: 'office', substitutionPolicy: 'visual'};
const keys = fonts => fonts.registry.describeFaces().map(({family, weight, italic}) => `${family}/${weight}/${italic}`);
const xmlParts = bytes => Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name]) => /^ppt\/(slides|theme)\/.*\.xml$/.test(name)).map(([name, bytes]) => [name, strFromU8(bytes)]));
const outline = (document, fonts) => toSvg(document, 1, {fonts, text: 'paths'});

for (const typefaces of ['selected', 'safe']) test(`native ${typefaces} prepares the undrawn wrap face and preserves eager output`, async () => {
  const document = structuredClone(deck), original = structuredClone(document);
  const fonts = await loadFonts({...loading, presentation: document, scripts: 'auto'});
  const full = await loadFonts(loading);
  const initial = keys(fonts), preview = outline(document, fonts);
  assert.equal(initial.length, 3);
  assert.ok(!initial.includes('Intos/400/false'), 'SVG never asks for the undrawn Aptos body role');
  const options = {bodyText: 'native', typefaces, date: '2026-11-10'};
  const expected = await toPptx(document, {...options, fonts: full});
  const actual = await toPptx(document, {...options, fonts});
  assert.deepEqual(xmlParts(actual), xmlParts(expected), 'selected families and exact native boxes match the eager provider');
  const parts = xmlParts(actual), slide = parts['ppt/slides/slide1.xml'];
  assert.match(slide, /name="OPF native body slides\.0\.text"/);
  assert.match(slide, /Bonjour 1/);
  assert.match(slide, typefaces === 'selected' ? /typeface="Georgia"/ : /typeface="Times New Roman"/);
  assert.ok(keys(fonts).length < 10, 'preparation never loads the whole office pack');
  if (typefaces === 'selected') assert.deepEqual(keys(fonts).filter(key => !initial.includes(key)), ['Intos/400/false']);
  const prepared = keys(fonts);
  assert.deepEqual(xmlParts(await toPptx(document, {...options, fonts})), parts);
  assert.deepEqual(keys(fonts), prepared, 'repeated export adds no faces');
  assert.deepEqual(outline(document, fonts), preview, 'native preparation does not alter the SVG drawing');
  assert.deepEqual(await fromPptx(actual), await fromPptx(expected), 'imported authored text/styles match the existing native contract');
  assert.deepEqual(document, original);
});

test('measured exports do not request native-wrap fonts', async () => {
  const fonts = await loadFonts({...loading, presentation: deck, scripts: 'auto'}), initial = keys(fonts);
  await toPptx(deck, {fonts});
  assert.deepEqual(keys(fonts), initial);
  const ensure = fonts.ensure.bind(fonts), calls = [];
  fonts.ensure = (document, options) => { calls.push(options); return ensure(document, options); };
  await toPptx(deck, {fonts});
  assert.ok(calls.every(options => options.measurementRequests === undefined));
});

test('custom and no-font providers retain synchronous native measurement contracts', async () => {
  const full = await loadFonts(loading), calls = [];
  const custom = {textMeasurement: full.textMeasurement, ensure() {calls.push('unexpected'); throw new Error('custom ensure must not run');}};
  const options = {bodyText: 'native', date: '2026-11-10'};
  assert.deepEqual(xmlParts(await toPptx(deck, {...options, fonts: custom})), xmlParts(await toPptx(deck, {...options, fonts: full})));
  assert.deepEqual(calls, []);
  assert.ok((await toPptx({slides: [{title: 'Plain', text: 'Body'}]}, options)).byteLength > 0);
});

test('explicit measurement preparation refuses missing faces and recovers its queue', async () => {
  const fonts = await loadFonts({...loading, presentation: deck, scripts: 'auto'}), initial = keys(fonts);
  await assert.rejects(fonts.ensure(deck, {measurementRequests: [{text: 'abcdefghijklmnopqrstuvwxyz', size: 24, style: {fontFamily: 'Absent Never Font', fontWeight: 400}}]}), error => error.code === 'font-unavailable');
  assert.deepEqual(keys(fonts), initial);
  const result = await fonts.ensure(deck, {measurementRequests: [{text: 'abcdefghijklmnopqrstuvwxyz', size: 24, style: {fontFamily: 'Aptos', fontWeight: 400}}]});
  assert.deepEqual(result.lazy.map(({family, weight, italic}) => `${family}/${weight}/${italic}`), ['Intos/400/false']);
  assert.deepEqual(fonts.pending(deck), []);
});

test('rich styles, aliases and in-place edits preserve exact native geometry', async () => {
  const document = structuredClone(deck);
  document.slides[0].text[0].bold = true;
  document.slides[0].text[1].italic = true;
  const aliasOptions = {...loading, aliases: {Georgia: 'Gelasio'}};
  const full = await loadFonts(aliasOptions), fonts = await loadFonts({...aliasOptions, presentation: document, scripts: 'auto'});
  for (const text of ['Hello 2', 'Updated 3']) {
    document.slides[0].text[1].text = text;
    const options = {bodyText: 'native', date: '2026-11-10'};
    assert.deepEqual(xmlParts(await toPptx(document, {...options, fonts})), xmlParts(await toPptx(document, {...options, fonts: full})));
  }
  assert.ok(keys(fonts).includes('Gelasio/700/false'));
  assert.ok(keys(fonts).includes('Tinos/400/true'));
  assert.ok(keys(fonts).includes('Intos/400/false'));
  assert.ok(keys(fonts).length < 10);
});

test('malformed additional requests fail without poisoning later normal preparation', async () => {
  const fonts = await loadFonts({...loading, presentation: deck, scripts: 'auto'}), before = keys(fonts);
  for (const measurementRequests of [{}, [{text: 'a', size: NaN, style: {fontFamily: 'Aptos'}}], [{text: 'a', size: 12, style: {fontFamily: 'Aptos', fontWeight: 0}}]])
    await assert.rejects(fonts.ensure(deck, {measurementRequests}), error => error.code === 'invalid-font-measurement-request');
  await fonts.ensure(deck);
  assert.deepEqual(keys(fonts), before);
});

test('ineligible native bodies do not load an undrawn default face', async () => {
  const document = structuredClone(deck);
  document.slides[0].text[0].text = 'Bonjour\t1';
  const fonts = await loadFonts({...loading, presentation: document, scripts: 'auto'}), initial = keys(fonts), diagnostics = [];
  await toPptx(document, {fonts, bodyText: 'native', onDiagnostic: item => diagnostics.push(item)});
  assert.ok(diagnostics.some(item => item.code === 'native-body-fallback' && item.reason === 'unsupported-text'));
  assert.deepEqual(keys(fonts), initial);
});


test('a genuinely wrapped native title executes exporter measurement preparation with eager geometry', async () => {
  const fixture = examples.find(entry => entry.file.endsWith('engineering-capacity-planning.opf.json'));
  assert.ok(fixture);
  const document = {...fixture.deck, slides: [fixture.deck.slides[0]]}, catalogs = [gallery];
  const full = await loadFonts(loading), fonts = await loadFonts({...loading, presentation: document, scripts: 'auto', renderOptions: {catalogs}});
  const ensure = fonts.ensure.bind(fonts), requests = [];
  fonts.ensure = (document, options) => { requests.push(...(options?.measurementRequests ?? [])); return ensure(document, options); };
  const options = {bodyText: 'native', date: '2026-11-10', catalogs};
  const actual = await toPptx(document, {...options, fonts}), expected = await toPptx(document, {...options, fonts: full});
  assert.deepEqual(xmlParts(actual), xmlParts(expected));
  assert.ok(requests.some(request => request.style.path === 'slides.0.title'), 'actual wrapped-title dependency channel ran');
  const titleShapes = [...xmlParts(actual)['ppt/slides/slide1.xml'].matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => shape.includes('name="OPF heading slides.0.title line '));
  assert.equal(titleShapes.length, 1, 'multiple measured lines became one coherent native title');
  assert.match(titleShapes[0], /<p:ph type="(?:ctrTitle|title)"\/>/);
  assert.match(titleShapes[0], /<a:noAutofit\/>/);
  assert.equal((await fromPptx(actual)).slides[0].title, document.slides[0].title);
});
