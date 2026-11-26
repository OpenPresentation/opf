// opf#1477, opf#1478: chart caches as Keynote rewrites them. The packages are OPF exports with the cache of one chart edited
// to the form Keynote 16.0 writes (the exact lines are in the issues), so no Keynote file is needed.
import assert from 'node:assert/strict';
import test from 'node:test';
import {unzipSync, zipSync, strToU8, strFromU8} from 'fflate';
import {validate} from '@openpresentation/opf';
const {toPptx, fromPptx} = await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');

const chartDeck = (data, extra = {}) => ({slides: [{chart: {type: 'column', data, ...extra}}]});
const exported = async deck => unzipSync(await toPptx(deck, {provenance: false}));
const chartParts = entries => Object.keys(entries).filter(path => /^ppt\/charts\/chart\d+\.xml$/.test(path)).sort();
const edit = (entries, part, change) => ({...entries, [part]: strToU8(change(strFromU8(entries[part])))});
async function read(entries) {
  const diagnostics = [];
  const document = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {document, diagnostics};
}
const chartOf = slide => slide.chart ?? slide.blocks?.find(block => block.chart)?.chart;

// The Keynote form of a value cache (#1477): c:ptCount is the number of c:pt present.
const keynoteCount = xml => xml.replace(/<c:numCache>(\s*<c:formatCode>[^<]*<\/c:formatCode>)?\s*<c:ptCount val="\d+"\/>([\s\S]*?)<\/c:numCache>/g, (all, format = '', points) =>
  `<c:numCache>${format}<c:ptCount val="${(points.match(/<c:pt /g) ?? []).length}"/>${points}</c:numCache>`);

test('#1477: a count below the highest index reads by the points\' own indexes (authored null)', async () => {
  const data = {columns: ['Month', 'Visits'], rows: [['Jul', 1200], ['Aug', 1350], ['Sep', null], ['Oct', 1610]]};
  const entries = await exported(chartDeck(data, {type: 'area', dataLabels: true}));
  const [part] = chartParts(entries);
  const edited = edit(entries, part, keynoteCount);
  assert.match(strFromU8(edited[part]), /<c:ptCount val="3"\/><c:pt idx="0">/, 'the fixture has the Keynote count');
  const {document, diagnostics} = await read(edited);
  assert.equal(validate(document, {only: ['format']}).valid, true);
  assert.deepEqual(chartOf(document.slides[0]).data, data);
  const repaired = diagnostics.filter(diagnostic => diagnostic.code === 'chart-cache-repaired');
  assert.equal(repaired.length, 1, 'one diagnostic for the chart');
  assert.match(repaired[0].path, /^slides\.0\.charts\.0/);
});

test('#1477: two sparse highlight series (the m-charts lines) keep their values at their rows', async () => {
  const entries = await exported(chartDeck({columns: ['Quarter', 'Visits', 'Highlight'], rows: [['Q1', null, 42], ['Q2', 28, null], ['Q3', null, 35], ['Q4', 31, null]]}));
  const [part] = chartParts(entries);
  const {document} = await read(edit(entries, part, keynoteCount));
  assert.deepEqual(chartOf(document.slides[0]).data.rows, [['Q1', null, 42], ['Q2', 28, null], ['Q3', null, 35], ['Q4', 31, null]]);
});

test('#1477: an unedited export raises no cache diagnostic', async () => {
  const entries = await exported(chartDeck({columns: ['Month', 'Visits'], rows: [['Jul', 1], ['Aug', null], ['Sep', 3]]}));
  const {diagnostics} = await read(entries);
  assert.equal(diagnostics.some(diagnostic => diagnostic.code === 'chart-cache-repaired'), false, 'an unedited export reads as before');
});

for (const type of ['line', 'area', 'column']) {
  test(`#1477: a ${type} chart reads short counts on every cache role`, async () => {
    const rows = [['x', 1, null], ['y', null, 2], ['z', 3, null], ['w', null, 4]];
    const entries = await exported(chartDeck({columns: ['Month', 'A', 'B'], rows}, {type}));
    const [part] = chartParts(entries);
    // Short counts on the category cache and the value caches together.
    const short = edit(entries, part, xml => keynoteCount(xml).replace(/(<c:strCache>\s*<c:ptCount val=")(\d+)/g, (all, head, count) => `${head}${Math.max(1, Number(count) - 2)}`));
    const {document} = await read(short);
    assert.deepEqual(chartOf(document.slides[0]).data.rows, rows);
  });
}

test('#1477: a scatter chart with short counts on its x and y caches imports its points', async () => {
  const entries = await exported(chartDeck({columns: ['Point', 'X', 'Y'], rows: [['1', 1, 2], ['2', null, 5], ['3', 3, null]]}, {type: 'scatter'}));
  const [part] = chartParts(entries);
  const {document} = await read(edit(entries, part, keynoteCount));
  assert.equal(chartOf(document.slides[0]).type, 'scatter');
  assert.deepEqual(chartOf(document.slides[0]).data.rows.map(row => row.slice(1)), [[1, 2], [null, 5], [3, null]]);
});

// The Keynote form of a category cache (#1478): the inner level holds, per index, the part after ": " and the whole label; the
// outer level holds the part before it.
const keynoteLevels = (labels, {whole = true} = {}) => {
  const split = labels.map(label => label.split(': '));
  const inner = split.map(([, rest], index) => `<c:pt idx="${index}"><c:v>${rest}</c:v></c:pt>${whole ? `<c:pt idx="${index}"><c:v>${labels[index]}</c:v></c:pt>` : ''}`).join('');
  const outer = split.map(([first], index) => `<c:pt idx="${index}"><c:v>${first}</c:v></c:pt>`).join('');
  return `<c:multiLvlStrRef><c:f>Sheet1!$A$2:$A$${labels.length + 1}</c:f><c:multiLvlStrCache><c:ptCount val="${labels.length}"/><c:lvl>${inner}</c:lvl><c:lvl>${outer}</c:lvl></c:multiLvlStrCache></c:multiLvlStrRef>`;
};
const withLevels = (entries, part, cache) => edit(entries, part, xml => xml.replace(/<c:cat>\s*<c:strRef>[\s\S]*?<\/c:strRef>\s*<\/c:cat>/g, `<c:cat>${cache}</c:cat>`));
const colon = ['January: northern hubs', 'February: coastal depots', 'March: inland warehouses'];

test('#1478: Keynote\'s two-level "Month: place" categories read as the single labels', async () => {
  const data = {columns: ['Month', 'Parcels', 'Returns'], rows: [[colon[0], 64, 3], [colon[1], 69, 4], [colon[2], 72, 5]]};
  const entries = await exported(chartDeck(data));
  const [part] = chartParts(entries);
  const edited = withLevels(entries, part, keynoteLevels(colon));
  assert.match(strFromU8(edited[part]), /<c:multiLvlStrRef>/);
  const {document, diagnostics} = await read(edited);
  assert.equal(validate(document, {only: ['format']}).valid, true);
  assert.deepEqual(chartOf(document.slides[0]).data, data);
  const flattened = diagnostics.filter(diagnostic => diagnostic.code === 'chart-categories-flattened');
  assert.equal(flattened.length, 1, 'one diagnostic however many series repeat the cache');
  assert.doesNotMatch(flattened[0].message, /joining the levels/, 'the cached whole labels were used');
});

test('#1478: levels without a cached whole label join outer to inner with ": " and say so', async () => {
  const entries = await exported(chartDeck({columns: ['Month', 'Parcels'], rows: colon.map((label, index) => [label, index + 1])}));
  const [part] = chartParts(entries);
  const {document, diagnostics} = await read(withLevels(entries, part, keynoteLevels(colon, {whole: false})));
  assert.deepEqual(chartOf(document.slides[0]).data.rows.map(row => row[0]), colon);
  assert.match(diagnostics.find(diagnostic => diagnostic.code === 'chart-categories-flattened').message, /joining the levels with ": "/);
});

test('#1478: a hierarchy with a count below its indexes and a missing point is still read', async () => {
  const entries = await exported(chartDeck({columns: ['Month', 'Parcels'], rows: colon.map((label, index) => [label, index + 1])}));
  const [part] = chartParts(entries);
  const cache = keynoteLevels(colon).replace('<c:ptCount val="3"/>', '<c:ptCount val="2"/>').replace(/<c:pt idx="1"><c:v>[^<]*<\/c:v><\/c:pt>/g, '');
  const {document} = await read(withLevels(entries, part, cache));
  assert.deepEqual(chartOf(document.slides[0]).data.rows.map(row => row[0]), [colon[0], null, colon[2]]);
});

// Layer 2: one chart that cannot be read costs that chart, never the deck.
test('an unreadable chart cache imports as a placeholder with one diagnostic and the other slides intact', async () => {
  const deck = {slides: [
    {title: 'First slide', bullets: ['one', 'two']},
    chartDeck({columns: ['Month', 'Visits'], rows: [['Jul', 1], ['Aug', 2]]}).slides[0],
    {title: 'Last slide', bullets: ['three']},
  ]};
  const reference = await read(await exported(deck));
  const entries = await exported(deck);
  const [part] = chartParts(entries);
  // A duplicate point index stays unreadable: nothing says which value is right.
  const broken = edit(entries, part, xml => xml.replace('<c:pt idx="1">', '<c:pt idx="0">'));
  const {document, diagnostics} = await read(broken);
  assert.equal(document.slides.length, 3);
  assert.deepEqual(document.slides[0], reference.document.slides[0]);
  assert.deepEqual(document.slides[2], reference.document.slides[2]);
  assert.equal(chartOf(document.slides[1]), undefined, 'the unreadable chart is not imported as data');
  assert.match(JSON.stringify(document.slides[1]), /PowerPoint chart/);
  const unreadable = diagnostics.filter(diagnostic => diagnostic.code === 'chart-unreadable');
  assert.equal(unreadable.length, 1);
  assert.match(unreadable[0].path, /^slides\.1\.charts\./);
  assert.match(unreadable[0].message, /duplicate point index/);
  assert.equal(validate(document, {only: ['format']}).valid, true);
});

for (const [name, change] of [
  ['an unsigned integer that is not one', xml => xml.replace(/<c:ptCount val="2"\/>/, '<c:ptCount val="two"/>')],
  ['a repeated cache container', xml => xml.replace(/<c:val>[\s\S]*?<\/c:val>/, match => match + match)],
  ['an out-of-range exponent', xml => xml.replace(/<c:v>2<\/c:v>/, '<c:v>1e999</c:v>')],
]) {
  test(`${name} costs the chart, not the deck`, async () => {
    const entries = await exported({slides: [{title: 'Before'}, chartDeck({columns: ['Month', 'Visits'], rows: [['Jul', 1], ['Aug', 2]]}).slides[0], {title: 'After'}]});
    const [part] = chartParts(entries);
    const {document, diagnostics} = await read(edit(entries, part, change));
    assert.equal(document.slides.length, 3);
    assert.equal(diagnostics.filter(diagnostic => diagnostic.code === 'chart-unreadable').length, 1);
  });
}
