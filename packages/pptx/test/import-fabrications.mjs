// The package writes, and fromPptx reads back, only what the document authored: no `preencoded.png` alt text for a
// picture with none, chart gaps stay gaps (never zeros), and the colour scheme's hyperlink slots round-trip.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const decode = bytes => new TextDecoder().decode(bytes);
const fixture = fileURLToPath(new URL('fixtures/images/wide.png', import.meta.url));
const png = `data:image/png;base64,${(await readFile(fixture)).toString('base64')}`;
const imageOf = document => {
  const slide = document.slides[0];
  return slide.image ?? slide.blocks?.find(block => block.image)?.image;
};
const pictureTag = bytes => decode(unzipSync(bytes)['ppt/slides/slide1.xml']).match(/<p:pic>[\s\S]*?<p:cNvPr\b[^>]*>/)[0].match(/<p:cNvPr\b[^>]*>/)[0];
let checked = 0;

// --- Picture alt text and title -------------------------------------------------------------------------------------
for (const provenance of ['full', false]) {
  const exported = image => toPptx({name: 'Alt', slides: [{title: 'T', image}]}, {provenance});

  // No authored alt: none is written and none comes back.
  const bare = await exported(png);
  assert.ok(!/descr=|preencoded/.test(pictureTag(bare)), `no descr written (${provenance})`);
  assert.deepEqual(Object.keys(imageOf(await fromPptx(bare))), ['src'], `no alt invented (${provenance})`);

  // Authored alt and a distinct title come back; the escape of markup characters is exact.
  const authored = await exported({src: png, alt: 'A "wide" image & <more>', title: 'Tooltip'});
  assert.match(pictureTag(authored), /descr="A &quot;wide&quot; image &amp; &lt;more&gt;" title="Tooltip"/);
  const back = imageOf(await fromPptx(authored));
  assert.equal(back.alt, 'A "wide" image & <more>');
  assert.equal(back.title, 'Tooltip');

  // A title alone is the picture's description (as before): no separate title is invented.
  const titled = imageOf(await fromPptx(await exported({src: png, title: 'Only a title'})));
  assert.equal(titled.alt, 'Only a title');
  assert.equal(titled.title, undefined);
  checked++;
}

// A picture read from a local file path must not write that path as its description.
{
  const bytes = await toPptx({name: 'Path', slides: [{title: 'T', image: 'photo.png'}]}, {provenance: false, imageResolver: () => ({path: fixture})});
  assert.ok(!/descr=/.test(pictureTag(bytes)), 'the file path is not the description');
  assert.equal(imageOf(await fromPptx(bytes)).alt, undefined);
  checked++;
}

// A deck exported before this fix carries PptxGenJS's stand-in description: it is not authored alt text.
{
  const entries = unzipSync(await toPptx({name: 'Legacy', slides: [{title: 'T', image: {src: png, alt: 'KEEP'}}]}, {provenance: false}));
  entries['ppt/slides/slide1.xml'] = new TextEncoder().encode(decode(entries['ppt/slides/slide1.xml']).replace('descr="KEEP"', 'descr="preencoded.png"'));
  assert.equal(imageOf(await fromPptx(zipSync(entries))).alt, undefined);
  checked++;
}

// --- Chart gaps -----------------------------------------------------------------------------------------------------
const chartRows = async (type, rows, columns = ['Category', 'One', 'Two'], provenance = 'full') => {
  const bytes = await toPptx({name: 'Gaps', slides: [{title: 'T', chart: {type, data: {columns, rows}}}]}, {provenance});
  const entries = unzipSync(bytes);
  const chart = decode(entries[Object.keys(entries).find(path => /^ppt\/charts\/chart\d+\.xml$/.test(path))]);
  const workbook = unzipSync(entries[Object.keys(entries).find(path => path.endsWith('.xlsx'))]);
  const document = await fromPptx(bytes);
  const imported = document.slides[0].chart ?? document.slides[0].blocks.find(block => block.chart).chart;
  return {chart, sheet: decode(workbook['xl/worksheets/sheet1.xml']), rows: imported.data.rows};
};
for (const type of ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'radar']) {
  const two = type === 'pie' || type === 'doughnut' ? ['Category', 'One'] : ['Category', 'One', 'Two'];
  const data = two.length === 2
    ? [['a', 1], ['b', null], ['c', 0], ['d', 'n/a'], ['e', '12%'], ['f', true]]
    : [['a', 1, 2], ['b', null, 3], ['c', 0, null], ['d', 'n/a', ''], ['e', '12%', 5], ['f', true, 6]];
  const {chart, sheet, rows} = await chartRows(type, data, two);
  const points = [...chart.matchAll(/<c:numCache>[\s\S]*?<\/c:numCache>/g)][0][0];
  assert.match(points, /<c:ptCount val="6"\/>/, `${type}: the cache keeps its row count`);
  assert.ok(!/<c:pt idx="\d+"><c:v><\/c:v>/.test(points), `${type}: no empty point`);
  assert.ok(!/<c:pt idx="1">/.test(points), `${type}: the null cell has no point`);
  assert.match(points, /<c:pt idx="2"><c:v>0<\/c:v><\/c:pt>/, `${type}: a real zero is a zero`);
  assert.match(points, /<c:pt idx="4"><c:v>12<\/c:v><\/c:pt>/, `${type}: numeric strings still parse`);
  assert.ok(!/<v><\/v>/.test(sheet), `${type}: no empty numeric workbook cell`);
  assert.match(sheet, /<c r="B3"\/>/, `${type}: the null cell is blank in the workbook`);
  assert.deepEqual(rows.map(row => row[1]), [1, null, 0, null, 12, null], `${type}: gaps and zeros import as authored`);
  checked++;
}
// The same without provenance tags, and for a scatter chart (an X column and one Y column).
{
  const {rows} = await chartRows('column', [['a', 1, null], ['b', null, 2]], undefined, false);
  assert.deepEqual(rows, [['a', 1, null], ['b', null, 2]]);
  const scatter = await chartRows('scatter', [['p', 1, 2], ['q', null, 3], ['r', 3, null]], ['Point', 'X', 'Y']);
  assert.deepEqual(scatter.rows.map(row => row.slice(1)), [[1, 2], [null, 3], [3, null]]);
  checked++;
}

// --- Colour scheme hyperlink slots ------------------------------------------------------------------------------------
for (const provenance of ['full', false]) {
  for (const slots of [{hyperlink: '#AA00AA', followedHyperlink: '#00AAAA'}, {hyperlink: '#0000EE', followedHyperlink: '#551A8B'}]) {
    const colorScheme = {accent1: '#FF0000', accent2: '#00FF00', dark1: '#101010', light1: '#FAFAFA', dark2: '#202020', light2: '#EEEEEE', ...slots};
    const bytes = await toPptx({name: 'Links', design: {colorScheme}, slides: [{title: 'T'}]}, {provenance});
    const theme = decode(unzipSync(bytes)['ppt/theme/theme1.xml']);
    assert.ok(theme.includes(`<a:hlink><a:srgbClr val="${slots.hyperlink.slice(1)}"`), 'hlink written');
    assert.ok(theme.includes(`<a:folHlink><a:srgbClr val="${slots.followedHyperlink.slice(1)}"`), 'folHlink written');
    // A re-imported scheme names a catalog record plus the slots that differ from it, so a slot that equals the record's
    // own value is carried by the id. Re-export the import: the theme must hold the same hyperlink colours.
    const again = decode(unzipSync(await toPptx(await fromPptx(bytes), {provenance: false}))['ppt/theme/theme1.xml']);
    assert.equal(again.match(/<a:hlink>.*?<\/a:hlink>/)[0], theme.match(/<a:hlink>.*?<\/a:hlink>/)[0], `hlink survives the round trip (${provenance})`);
    assert.equal(again.match(/<a:folHlink>.*?<\/a:folHlink>/)[0], theme.match(/<a:folHlink>.*?<\/a:folHlink>/)[0], `folHlink survives the round trip (${provenance})`);
    checked++;
  }
}

console.log(`Import fabrication checks passed (${checked}).`);
