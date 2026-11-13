// RR-105: an extended (chartex) chart's mc:Fallback, what Keynote, LibreOffice and older PowerPoint draw, is a picture of OPF's own
// preview of the chart, not a classic chart of its raw data (which drew 24 raw values for 4 histogram bins, a waterfall from zero and a
// box plot as columns). PowerPoint reads the mc:Choice, which stays byte-identical to the base this change was made on.
//
// 1. The mc:Choice, the chartEx part, its relationships, style and color parts and the embedded workbook, and the import of the
//    export, equal their digests recorded before the change (test/fixtures/rr-105-chartex-choice.json) for two qualification decks.
// 2. The mc:Fallback is one SVG picture over its PNG raster (OPF's preview of the chart, cropped to the frame) with the frame's p:cNvPr
//    (name, alt text) under an id of its own (an app's shape id says which branch it drew), its transform and its OPF_DATA_V1 tag.
// 3. The classic chart of that frame is gone: no chart part, relationship or content type remains for it, the workbook is related from
//    the chartEx part alone, and the package passes the integrity check.
// 4. Alt text: the chart's alt, an empty alt (decorative) and no alt, the same on the picture as on the frame.
// 5. A file in which only the picture survived (a reader saved the mc:Fallback alone) imports as an image block, with or without the tag.
// 6. Without a rasterizer the classic chart stays the fallback, with chartex-fallback-picture-unavailable.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';
import {chartexIdentity} from './helpers/chartex-identity.mjs';
import {packageIntegrity} from './helpers/package-integrity.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/rr-105-chartex-choice.json', import.meta.url), 'utf8'));
const slidesOf = entries => Object.keys(entries).filter(part => /^ppt\/slides\/slide\d+\.xml$/.test(part));
const relationshipsOf = (entries, part) => {
  const map = new Map(), relsPart = part.replace(/([^/]+)$/, '_rels/$1.rels');
  for (const [tag] of strFromU8(entries[relsPart] ?? new Uint8Array()).matchAll(/<Relationship\b[^>]*>/g)) {
    const attribute = name => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1], segments = part.split('/').slice(0, -1);
    for (const segment of attribute('Target').split('/')) segment === '..' ? segments.pop() : segments.push(segment);
    map.set(attribute('Id'), {type: attribute('Type'), path: segments.join('/')});
  }
  return map;
};
const alternatesOf = entries => slidesOf(entries).flatMap(slide => [...strFromU8(entries[slide]).matchAll(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g)]
  .map(([xml]) => ({slide, xml})).filter(({xml}) => /<cx:chart\b/.test(xml)));
const cNvPrOf = xml => xml.match(/<p:cNvPr\b[^>]*?(?:\/>|>[\s\S]*?<\/p:cNvPr>)/)?.[0];
const idOf = xml => xml.match(/<p:cNvPr\b[^>]*\bid="(\d+)"/)?.[1];
const withoutId = xml => xml?.replace(/(<p:cNvPr\b[^>]*\bid=")\d+"/, '$1#"');
const xfrmOf = xml => xml.match(/<(?:p|a):xfrm>([\s\S]*?)<\/(?:p|a):xfrm>/)?.[1];
const tagOf = xml => xml.match(/<p:custDataLst>([\s\S]*?)<\/p:custDataLst>/)?.[1];
const pngSize = bytes => ({width: Buffer.from(bytes).readUInt32BE(16), height: Buffer.from(bytes).readUInt32BE(20)});
let checks = 0;

// The picture form of every chartex chart of a package (2, 3).
function assertPictureFallbacks(entries, label) {
  const alternates = alternatesOf(entries);
  assert.ok(alternates.length > 0, `${label}: has chartex charts`);
  for (const {slide, xml} of alternates) {
    const choice = xml.match(/<mc:Choice\b[\s\S]*?<\/mc:Choice>/)[0], fallback = xml.match(/<mc:Fallback>([\s\S]*?)<\/mc:Fallback>/)[1];
    const name = choice.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)[1], where = `${label} ${slide} ${name}`;
    assert.match(fallback, /^<p:pic>[\s\S]*<\/p:pic>$/, `${where}: the fallback is one picture`);
    assert.doesNotMatch(fallback, /<c:chart\b|<p:graphicFrame\b/, `${where}: no classic chart in the fallback`);
    assert.equal(withoutId(cNvPrOf(fallback)), withoutId(cNvPrOf(choice)), `${where}: the picture has the frame's name and alt text`);
    assert.notEqual(idOf(fallback), idOf(choice), `${where}: the picture has an id of its own`);
    assert.equal(xfrmOf(fallback), xfrmOf(choice), `${where}: the picture has the frame's transform`);
    assert.equal(tagOf(fallback), tagOf(choice), `${where}: the picture shares the frame's data tag`);
    const relationships = relationshipsOf(entries, slide);
    const png = relationships.get(fallback.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)[1]);
    const svg = relationships.get(fallback.match(/<asvg:svgBlip\b[^>]*\br:embed="([^"]+)"/)[1]);
    assert.ok(png?.type.endsWith('/image') && /\.png$/.test(png.path) && entries[png.path], `${where}: a PNG raster`);
    assert.ok(svg?.type.endsWith('/image') && /\.svg$/.test(svg.path) && entries[svg.path], `${where}: an SVG picture`);
    // OPF's preview of the chart: the chart's group of the slide's SVG, cropped to the frame (96 px an inch), drawn at 192 dpi or more
    // (the raster's long side rounds up to its step, at most its cap).
    const [cx, cy] = xfrmOf(choice).match(/<a:ext cx="(\d+)" cy="(\d+)"/).slice(1).map(Number), [x, y] = xfrmOf(choice).match(/<a:off x="(\d+)" y="(\d+)"/).slice(1).map(Number);
    const image = strFromU8(entries[svg.path]), viewBox = image.match(/^<svg\b[^>]*\bviewBox="([^"]+)"/)?.[1].split(' ').map(Number);
    assert.ok(viewBox, `${where}: the SVG has a viewBox`);
    [x, y, cx, cy].forEach((emu, index) => assert.ok(Math.abs(emu / 9525 - viewBox[index]) < 0.01, `${where}: the SVG is the frame's region of the slide (${viewBox})`));
    assert.doesNotMatch(image, /data-opf-|<script|href="http/i, `${where}: no trace attributes, scripts or external references`);
    const raster = pngSize(entries[png.path]);
    assert.ok(Math.abs(raster.width / raster.height - cx / cy) < 2 / raster.height, `${where}: the raster has the frame's proportions`);
    assert.ok(raster.width / (cx / 914400) >= 180, `${where}: the raster is about 192 dpi (${raster.width} px over ${(cx / 914400).toFixed(2)} in)`);
  }
  // 3. No classic chart part is left for a chartex frame: every classic chart part is related once, from a plain chart frame.
  const classicFrames = slidesOf(entries).flatMap(slide => {
    const outside = strFromU8(entries[slide]).replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g, '');
    return [...outside.matchAll(/<c:chart\b[^>]*\br:id="([^"]+)"/g)].map(match => relationshipsOf(entries, slide).get(match[1]).path);
  });
  const classicParts = Object.keys(entries).filter(part => /^ppt\/charts\/chart\d+\.xml$/.test(part));
  assert.deepEqual(classicParts.sort(), [...new Set(classicFrames)].sort(), `${label}: the classic chart parts are exactly those of plain chart frames`);
  const related = slidesOf(entries).flatMap(slide => [...relationshipsOf(entries, slide).values()]).filter(entry => entry.type.endsWith('/chart')).map(entry => entry.path);
  assert.deepEqual(related.sort(), classicParts.sort(), `${label}: no slide relates a removed chart part`);
  const types = strFromU8(entries['[Content_Types].xml']);
  for (const part of [...types.matchAll(/PartName="\/(ppt\/charts\/[^"]+)"/g)].map(match => match[1])) assert.ok(entries[part], `${label}: ${part} has a content type and exists`);
  // The workbook of each chartex chart stays, related from its chartEx part alone.
  for (const workbook of Object.keys(entries).filter(part => /^ppt\/embeddings\/.*\.xlsx$/.test(part))) {
    const owners = Object.keys(entries).filter(part => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(part) && [...relationshipsOf(entries, part).values()].some(entry => entry.path === workbook));
    assert.equal(owners.length, 1, `${label}: ${workbook} has one owner (${owners})`);
  }
  assert.deepEqual(packageIntegrity(entries), [], `${label}: ${JSON.stringify(packageIntegrity(entries))}`);
  return alternates.length;
}

// 1-3. The qualification decks: the mc:Choice and its parts, and the import, as before; the picture form.
for (const [id, {source, importSha256, identity}] of Object.entries(fixture.decks)) {
  const file = path.join(root, source), directory = path.dirname(file);
  const deck = JSON.parse(await readFile(file, 'utf8'));
  const imageResolver = async src => typeof src !== 'string' || /^[a-z]+:/i.test(src) ? undefined : new Uint8Array(await readFile(path.join(directory, src)));
  const bytes = await toPptx(deck, {catalogs: [gallery], imageResolver});
  const entries = unzipSync(bytes);
  assert.deepEqual(chartexIdentity(entries), identity, `${id}: the mc:Choice, chartEx parts and workbooks are byte-identical to the base (ids masked)`);
  assert.equal(sha256(JSON.stringify(await fromPptx(bytes, {catalogs: [gallery]}))), importSha256, `${id}: the export imports to the same document as before`);
  assert.equal(assertPictureFallbacks(entries, id), identity.length, `${id}: every chartex chart has its picture`);
  checks += 3;
}

// 4. Alt text: the chart's alt on both forms; an empty alt marks both decorative; without one neither has a descr.
{
  const data = {columns: ['Stage', 'Count'], rows: [['Visit', 900], ['Trial', 300], ['Buy', 90]]};
  const deck = {slides: [
    {title: 'With alt', chart: {type: 'funnel', alt: 'Funnel: 900 visits, 300 trials, 90 purchases', data}},
    {title: 'Decorative', chart: {type: 'funnel', alt: '', data}},
    {title: 'No alt', chart: {type: 'funnel', data}},
  ]};
  const entries = unzipSync(await toPptx(deck));
  assertPictureFallbacks(entries, 'alt');
  for (const slide of slidesOf(entries)) {
    const ids = [...strFromU8(entries[slide]).matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${slide}: every object id is unique, the fallback picture's included`);
  }
  const pictures = alternatesOf(entries).map(({xml}) => cNvPrOf(xml.match(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/)[0]));
  assert.match(pictures[0], /\bdescr="Funnel: 900 visits, 300 trials, 90 purchases"/);
  assert.match(pictures[1], /<adec:decorative\b[^>]*\bval="1"/);
  assert.doesNotMatch(pictures[1], /\bdescr=/);
  assert.doesNotMatch(pictures[2], /\bdescr=|decorative/);
  checks += 4;
}

// 5. Only the picture survived: a reader without extended charts saved the mc:Fallback alone. It imports as an image block (OPF's
// preview, with the chart's alt), never as a chart, whether the picture kept the chart's OPF_DATA_V1 tag or lost it.
{
  const deck = {slides: [{title: 'Delivery', chart: {type: 'histogram', alt: 'Delivery times', data: {columns: [{name: 'Days', format: '0.0'}], rows: [[1.2], [2.5], [3.1], [4.4], [5], [6.2], [8.6]]}}}]};
  const bytes = await toPptx(deck);
  const entries = unzipSync(bytes), slide = strFromU8(entries['ppt/slides/slide1.xml']);
  assert.match(tagOf(slide.match(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/)[0]) ?? '', /rIdOpfData/, 'the picture carries the chart data tag');
  const restored = await fromPptx(bytes);
  assert.deepEqual(restored.slides[0].chart, deck.slides[0].chart, 'the export itself imports the chart, from the mc:Choice');
  for (const keepTag of [true, false]) {
    let xml = slide.replace(/<mc:AlternateContent\b[\s\S]*?<mc:Fallback>([\s\S]*?)<\/mc:Fallback><\/mc:AlternateContent>/g, (_, picture) => picture);
    if (!keepTag) xml = xml.replace(/<p:custDataLst><p:tags r:id="rIdOpfData\d+"\/><\/p:custDataLst>/g, '');
    assert.doesNotMatch(xml, /AlternateContent|cx:chart/);
    const diagnostics = [];
    const imported = await fromPptx(zipSync({...entries, 'ppt/slides/slide1.xml': strToU8(xml)}), {onDiagnostic: entry => diagnostics.push(entry)});
    const [only] = imported.slides;
    assert.equal(only.chart, undefined, `tag ${keepTag}: no chart`);
    assert.ok(!JSON.stringify(imported).includes('"type":"histogram"'), `tag ${keepTag}: no stale chart anywhere`);
    const images = (only.blocks ?? [only]).filter(block => block.image ?? block.type === 'image');
    assert.equal(images.length, 1, `tag ${keepTag}: one image block`);
    assert.match(images[0].image.src, /^data:image\/svg\+xml;base64,/, `tag ${keepTag}: the preview's SVG`);
    assert.equal(images[0].image.alt, 'Delivery times', `tag ${keepTag}: with the chart's alt`);
    assert.ok(!diagnostics.some(entry => /data-provenance|invalid/.test(entry.code)), `tag ${keepTag}: the data tag of a picture is neither read nor reported: ${JSON.stringify(diagnostics)}`);
  }
  checks += 3;
}

// 6. Without a rasterizer for the picture the classic chart stays the fallback (as before RR-105), and a diagnostic says so.
{
  const diagnostics = [];
  const svgRasterizer = async () => { throw Object.assign(new Error('no rasterizer'), {code: 'svg-rasterizer-unavailable'}); };
  const entries = unzipSync(await toPptx({slides: [{title: 'Funnel', chart: {type: 'funnel', data: {columns: ['Stage', 'Count'], rows: [['A', 3], ['B', 2]]}}}]}, {svgRasterizer, onDiagnostic: entry => diagnostics.push(entry)}));
  const [{xml}] = alternatesOf(entries);
  assert.match(xml, /<mc:Fallback><p:graphicFrame>[\s\S]*<c:chart\b[\s\S]*<\/mc:Fallback>/, 'the classic chart is the fallback');
  assert.ok(entries['ppt/charts/chart1.xml'], 'with its part');
  assert.deepEqual(diagnostics.filter(entry => entry.code === 'chartex-fallback-picture-unavailable').map(entry => [entry.path, entry.reason?.includes('rasterizer')]), [['slides.0.chart', true]]);
  assert.deepEqual(packageIntegrity(entries), []);
  checks += 3;
}

console.log(`RR-105 chartex picture fallback passed: ${checks} checks (Choice and import identical to the base, picture form, classic part removal, alt text, picture-only import, rasterizer fallback).`);
