import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {decodeTextTag, encodeTextTag} from '../src/code-provenance.js';
import {chartDataRecord} from '../src/data-provenance.js';

const literal = 'slides.0.left';
const note = {text: literal, titleAlignment: 'left', [literal]: 'literal key'};
const text = value => typeof value === 'string' ? value : value.map(run => typeof run === 'string' ? run : run.text).join('');
const fixture = anchor => ({
  design: {fontScheme: 'roboto', titleAlignment: 'start'},
  extensions: note,
  slides: [{title: 'Decision', start: {id: 'message', text: [{text: 'Bonjour', language: 'fr-FR'}], extensions: note}, end: {text: literal},
    shapes: [{id: 'badge', shape: 'rect', decorative: true, at: {block: 'message', edge: 'center', ...anchor}}]},
  {title: 'Data', table: {columns: ['Field'], rows: [[literal], [{value: [{text: 'Bonjour', language: 'fr-FR'}], style: {align: 'start', borders: {left: {width: 2}}}}]]}}],
});

function rewriteTags(bytes, change) {
  const entries = unzipSync(bytes);
  let changed = 0;
  for (const name of Object.keys(entries).filter(name => /^ppt\/tags\/.+\.xml$/.test(name))) {
    const xml = strFromU8(entries[name]);
    entries[name] = strToU8(xml.replace(/<p:tag name="([^"]+)" val="([^"]*)"\/>/g, (tag, kind, encoded) => {
      const record = decodeTextTag(encoded), next = change(record, kind);
      if (next === record) return tag;
      changed++;
      return `<p:tag name="${kind}" val="${encodeTextTag(next)}"/>`;
    }));
  }
  assert.ok(changed > 0, 'the intended provenance tags were rewritten');
  return entries;
}

test('current vocabulary and explicit anchor units survive export/import without changing literals', async () => {
  const back = await fromPptx(await toPptx(fixture({width: 1.01, heightPx: 40})));
  assert.deepEqual(back.extensions, note);
  assert.equal(text(back.slides[0].start.text), 'Bonjour');
  assert.equal(text(back.slides[0].end.text), literal);
  assert.deepEqual(back.slides[0].start.extensions, note);
  assert.deepEqual(back.slides[0].shapes[0].at, {block: 'message', edge: 'center', width: 1.01, heightPx: 40});
  assert.equal(back.slides[0].start.text.some(run => run?.language === 'fr-FR'), true);
  assert.equal(back.slides[1].table.rows[0][0], literal);
  assert.equal(back.slides[1].table.rows[1][0].style.align, 'start');
  assert.deepEqual(back.slides[1].table.rows[1][0].style.borders.left, {width: 2});
});

test('legacy typed tags migrate logical words and pixel anchors; current native edits and literal data win', async () => {
  const bytes = await toPptx(fixture({widthPx: 1.01, heightPx: 40}));
  const entries = rewriteTags(bytes, (record, kind) => {
    if (kind === 'OPF_DOCUMENT_V1') {
      const {vocabulary: _marker, ...old} = record;
      if (old.design?.titleAlignment === 'start') old.design.titleAlignment = 'left';
      return old;
    }
    if (kind === 'OPF_SLIDE_V1') {
      const {vocabulary: _marker, ...old} = record;
      if (old.content?.form === 'regions') old.content.regions = Object.fromEntries(Object.entries(old.content.regions).map(([key, node]) => [key === 'start' ? 'left' : key === 'end' ? 'right' : key, node]));
      for (const [, shape] of old.overlays ?? []) if (shape.at) {
        const {widthPx, heightPx, ...rest} = shape.at;
        shape.at = {...rest, ...(widthPx !== undefined ? {width: widthPx} : {}), ...(heightPx !== undefined ? {height: heightPx} : {})};
      }
      return old;
    }
    if (kind === 'OPF_DATA_V1' && record.kind === 'table' && record.authored) {
      const {vocabulary: _marker, ...old} = record;
      const styled = old.authored.rows[1][0];
      styled.style.align = 'left';
      styled.value = styled.value.map(({language, ...run}) => ({...run, lang: language}));
      return old;
    }
    return record;
  });
  const slidePart = 'ppt/slides/slide1.xml';
  const xml = strFromU8(entries[slidePart]);
  assert.match(xml, /Bonjour/);
  entries[slidePart] = strToU8(xml.replace('Bonjour', 'Bonsoir'));
  const back = await fromPptx(zipSync(entries));
  assert.equal(text(back.slides[0].start.text), 'Bonsoir', 'stored legacy provenance cannot restore stale source words');
  assert.equal(text(back.slides[0].end.text), literal);
  assert.deepEqual(back.extensions, note);
  assert.deepEqual(back.slides[0].start.extensions, note);
  assert.deepEqual(back.slides[0].shapes[0].at, {block: 'message', edge: 'center', widthPx: 1.01, heightPx: 40});
  assert.equal(back.slides[1].table.rows[0][0], literal);
  assert.equal(back.slides[1].table.rows[1][0].style.align, 'start');
  assert.equal(back.slides[1].table.rows[1][0].value[0].language, 'fr-FR');
});

test('a legacy dataset keeps rich language and chart/table references after its typed migration changes the stored hash input', async () => {
  const dataset = {columns: ['Category', 'Value', 'Note'], rows: [['A', 10, [{text: literal, language: 'fr-FR'}]], ['B', 20, [{text: 'Bonjour', language: 'fr-FR'}]]]};
  const chart = {type: 'column', data: {dataset: 'vocabulary', fields: ['Category', 'Value']}};
  const table = {dataset: 'vocabulary', fields: ['Category', 'Note']};
  const source = {design: {fontScheme: 'roboto'}, datasets: {vocabulary: dataset}, slides: [{title: 'Values', chart}, {title: 'Notes', table}]};
  const bytes = await toPptx(source);
  const current = await fromPptx(bytes);
  assert.deepEqual(current.slides[0].chart.data, chart.data);
  assert.deepEqual(current.slides[1].table, table);
  assert.deepEqual(current.datasets.vocabulary, dataset);

  const legacyDataset = structuredClone(dataset);
  for (const row of legacyDataset.rows) row[2] = row[2].map(({language, ...run}) => ({...run, lang: language}));
  const legacyHash = chartDataRecord(chart, {vocabulary: legacyDataset}).dataset;
  assert.notEqual(legacyHash, chartDataRecord(chart, {vocabulary: dataset}).dataset, 'the regression must exercise different legacy/current fingerprints');
  const entries = rewriteTags(bytes, (record, kind) => {
    if (kind === 'OPF_DATASETS_V1') return {vocabulary: legacyDataset};
    if (kind === 'OPF_DATA_V1') {
      const {vocabulary: _marker, ...old} = record;
      if (old.kind === 'chart') old.dataset = legacyHash;
      return old;
    }
    return record;
  });
  const diagnostics = [];
  const back = await fromPptx(zipSync(entries), {onDiagnostic: finding => diagnostics.push(finding)});
  assert.deepEqual(back.datasets.vocabulary, dataset);
  assert.deepEqual(back.slides[0].chart.data, chart.data, 'legacy hash binding survives only the known typed transformation');
  assert.deepEqual(back.slides[1].table, table);
  assert.equal(diagnostics.some(finding => finding.code === 'chart-dataset-unavailable'), false);

  // A Save-like value edit changes the actual native cache. Provenance must not
  // replay the old dataset reference over that current edited value.
  const chartPart = Object.keys(entries).find(name => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  const native = strFromU8(entries[chartPart]);
  assert.match(native, /<c:v>10<\/c:v>/);
  entries[chartPart] = strToU8(native.replace('<c:v>10</c:v>', '<c:v>11</c:v>'));
  const edited = await fromPptx(zipSync(entries));
  assert.notDeepEqual(edited.slides[0].chart.data, chart.data);
  assert.equal(edited.slides[0].chart.data.rows[0][1], 11);
});
