// FR-06 (core docs/chart-table-data.md, "A metric computed from data"): a metric linked to data draws the computed numbers as the native
// shapes of a typed metric, and its OPF_METRIC_V1 tag holds the 0.36 form of what is drawn as `value` (a 0.36.0 importer reads a plain
// metric) and the 0.37 part (`data`, `better`, `format`, which keys were derived, the numbers behind formatted text) in a top-level `link`
// key. Import restores the link while the native value and change text are unchanged; an edit in PowerPoint is the author's.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const arr = {
  columns: [{name: 'Month', type: 'date', role: 'dimension'}, {name: 'Region', type: 'text', role: 'dimension'}, {name: 'ARR', format: '$#,##0.0M', type: 'number', role: 'measure', unit: 'USD'}, {name: 'Churn', format: '0.0%', type: 'number', role: 'measure'}, {name: 'ARR change', format: '+$#,##0.0M;-$#,##0.0M;$0', type: 'number', role: 'measure', unit: 'USD'}],
  rows: [['2026-09', 'EMEA', 3.9, 0.041, null], ['2026-10', 'EMEA', 4.2, 0.036, 0.3], ['2026-11', 'EMEA', 4.4, 0.044, 0.2]],
};
const link = (extra = {}) => ({dataset: 'arr', field: 'ARR', aggregate: 'last', ...extra});
const metrics = {
  previous: {label: 'EMEA ARR', value: 4.4, delta: 0.2, data: link({filter: [{field: 'Region', op: '=', value: 'EMEA'}], delta: {compare: 'previous'}})},
  churn: {label: 'Monthly churn', value: 0.044, delta: 0.2222222222222222, better: 'down', data: link({field: 'Churn', delta: {compare: 'previous', as: 'percent'}})},
  baseline: {label: 'ARR since September', value: 4.4, delta: 0.5, data: link({delta: {compare: {filter: [{field: 'Month', op: '=', value: '2026-09'}]}}})},
  column: {label: 'EMEA ARR', value: 4.4, delta: 0.2, data: link({delta: {field: 'ARR change'}})},
  fixed: {label: 'ARR against plan', value: 4.4, delta: 0.4, data: link({delta: {compare: {value: 4}}})},
  valueOnly: {label: 'Peak churn', value: 0.044, data: link({field: 'Churn', aggregate: 'max'})},
  unlinked: {label: 'Gross margin', value: 0.724, format: '0.0%', delta: 0.012, trend: 'up'},
};
const deck = {
  name: 'Computed metrics',
  language: 'en-US',
  datasets: {arr},
  slides: Object.entries(metrics).map(([id, metric]) => ({id, title: id, metric})),
};

const exported = async (source, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(source), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, parts: unzipSync(bytes), diagnostics};
};
const imported = async bytes => {
  const diagnostics = [];
  const result = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {deck: result, diagnostics};
};
const slideText = (parts, index) => [...strFromU8(parts[`ppt/slides/slide${index + 1}.xml`]).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
const tagsOf = parts => Object.entries(parts).filter(([path]) => /^ppt\/tags\/.*\.xml$/.test(path)).flatMap(([, bytes]) => [...strFromU8(bytes).matchAll(/<p:tag name="OPF_METRIC_V1" val="([0-9A-F]+)"/g)].map(match => JSON.parse(Buffer.from(match[1], 'hex').toString('utf8'))));
const anchors = parts => tagsOf(parts).filter(tag => tag.role === 'anchor').sort((left, right) => Number(left.group) - Number(right.group));

// --- the drawing is the computed numbers, and the tag keeps both forms -----------------------------------------

{
  const {parts, bytes, diagnostics} = await exported(deck);
  assert.deepEqual(diagnostics.filter(entry => /metric/.test(entry.code)), [], JSON.stringify(diagnostics));
  const texts = deck.slides.map((_, index) => slideText(parts, index));
  assert.ok(texts[0].includes('$4.4M') && texts[0].includes('+$0.2M'), `the computed value and change are drawn: ${texts[0]}`);
  assert.ok(texts[1].includes('4.4%') && texts[1].includes('+22%'), `a percent change: ${texts[1]}`);
  assert.ok(texts[2].includes('+$0.5M'), `against a baseline: ${texts[2]}`);
  assert.ok(texts[3].includes('+$0.2M'), `from a column: ${texts[3]}`);
  assert.ok(texts[4].includes('+$0.4M'), `against a fixed value: ${texts[4]}`);
  assert.ok(texts[5].includes('4.4%'), `a value only: ${texts[5]}`);
  assert.ok(texts[6].includes('72.4%') && texts[6].includes('+1.2%'), `an unlinked metric with a format: ${texts[6]}`);
  const tags = anchors(parts);
  assert.equal(tags.length, 7);
  // What a released 0.36.0 importer reads (git show v0.36.0:packages/pptx/src/metric-provenance.js): the manifest's named keys v, group, role,
  // part, line, value and parts, with `value` validated as a 0.36 metric (a closed object: an unknown key drops the whole metric). The 0.37
  // part is the one other top-level key, `link`, which that importer never reads. Run on the released 0.36.0 package by the supervisor's
  // pass (the file imported as a valid deck with the same numbers); this pins the shape that makes it so.
  const METRIC_KEYS_036 = ['value', 'label', 'description', 'unit', 'delta', 'trend', 'sentiment', 'icon'];
  for (const tag of tags) {
    assert.deepEqual(Object.keys(tag).filter(key => !['v', 'group', 'role', 'part', 'line', 'value', 'parts', 'sig', 'link'].includes(key)), [], 'no other top-level key');
    assert.ok(Object.keys(tag.value).every(key => METRIC_KEYS_036.includes(key)), `a 0.36 metric: ${Object.keys(tag.value)}`);
    assert.ok(['string', 'number'].includes(typeof tag.value.value));
  }
  const [previous, churn] = tags;
  assert.deepEqual(previous.value, {label: 'EMEA ARR', value: '$4.4M', delta: '+$0.2M', trend: 'up'}, 'the tag holds the 0.36 form of what is drawn: a plain metric');
  assert.equal(Object.hasOwn(previous.value, 'data'), false);
  assert.deepEqual(previous.link, {data: metrics.previous.data, derived: ['value', 'delta', 'trend'], numbers: {value: 4.4, delta: 0.2}});
  assert.deepEqual(churn.value, {label: 'Monthly churn', value: '4.4%', delta: '+22%', trend: 'up', sentiment: 'negative'});
  assert.deepEqual(churn.link.better, 'down');
  assert.deepEqual(churn.link.derived, ['value', 'delta', 'trend', 'sentiment']);
  assert.deepEqual(tags[6].link, {format: '0.0%', numbers: {value: 0.724, delta: 0.012}}, 'an unlinked metric with a format keeps only its format');

  // --- import restores the link, the literals as the last computed numbers, and derived keys left to derive -------
  const {deck: back, diagnostics: backDiagnostics} = await imported(bytes);
  assert.deepEqual(backDiagnostics.filter(entry => /metric/.test(entry.code)), [], JSON.stringify(backDiagnostics));
  const metricOf = index => back.slides[index].metric ?? back.slides[index].blocks?.[0]?.metric;
  assert.deepEqual(metricOf(0), metrics.previous, 'the previous-row metric comes back as written');
  assert.deepEqual(metricOf(1), {...metrics.churn, delta: 0.222222222222}, 'the percent metric comes back with the number behind its text, no typed trend or sentiment');
  for (const index of [2, 3, 4, 5]) assert.deepEqual(metricOf(index), Object.values(metrics)[index], `slide ${index}`);
  assert.deepEqual(metricOf(6), metrics.unlinked, 'a format-only metric comes back with its number value');
}

// --- a deck without data, better and format exports as before ------------------------------------------------------------------

{
  const plain = {name: 'Plain', language: 'en-US', slides: [{title: 'Metric', metric: {label: 'Users', value: 1234.5, delta: '+3%', trend: 'up'}}]};
  const {parts} = await exported(plain);
  const [tag] = anchors(parts);
  assert.equal(Object.hasOwn(tag, 'link'), false, 'no link key without a link, better or format');
  assert.deepEqual(tag.value, plain.slides[0].metric);
}

// --- provenance is not full: no link is written, and the export says so -----------------------------------------------------------

{
  const {parts, diagnostics} = await exported(deck, {provenance: 'references-only'});
  assert.ok(anchors(parts).every(tag => !Object.hasOwn(tag, 'link')));
  assert.ok(diagnostics.some(entry => entry.code === 'metric-link-omitted'), JSON.stringify(diagnostics));
  const {deck: back} = await imported((await exported(deck, {provenance: 'references-only'})).bytes);
  const first = back.slides[0].metric ?? back.slides[0].blocks?.[0]?.metric;
  assert.equal(first.data, undefined, 'the link is not restored');
  assert.equal(first.value, '$4.4M', 'the metric comes back as drawn');
}

// --- an edit in PowerPoint is the author's: the link is not restored, with a diagnostic ---------------------------------------------

{
  const {parts} = await exported(deck);
  const path = 'ppt/slides/slide1.xml';
  const xml = strFromU8(parts[path]);
  assert.ok(xml.includes('<a:t>$4.4M</a:t>'));
  const edited = {...parts, [path]: strToU8(xml.replace('<a:t>$4.4M</a:t>', '<a:t>$4.9M</a:t>'))};
  const {deck: back, diagnostics} = await imported(zipSync(edited));
  const metric = back.slides[0].metric ?? back.slides[0].blocks?.[0]?.metric;
  assert.equal(metric.data, undefined, 'the data link is not restored');
  assert.equal(metric.value, '$4.9M', 'the edit is the written value');
  assert.equal(metric.trend, 'up', 'the arrow that was drawn stays as written');
  assert.ok(diagnostics.some(entry => entry.code === 'metric-data-dropped' && /edited in PowerPoint/.test(entry.message)), JSON.stringify(diagnostics));
  // The change edited instead of the value.
  const changed = {...parts, [path]: strToU8(xml.replace('<a:t>+$0.2M</a:t>', '<a:t>+$0.9M</a:t>'))};
  const second = await imported(zipSync(changed));
  const secondMetric = second.deck.slides[0].metric ?? second.deck.slides[0].blocks?.[0]?.metric;
  assert.equal(secondMetric.data, undefined);
  assert.equal(secondMetric.delta, '+$0.9M');
  assert.equal(secondMetric.value, '$4.4M', 'the unedited value stays the text that was drawn: the column format that wrote it is not back');
  // A percent change edited on the metric with a direction that is good: better is kept and the red sentiment is derived again from it.
  const churnXml = strFromU8(parts['ppt/slides/slide2.xml']);
  assert.ok(churnXml.includes('<a:t>+22%</a:t>'));
  const churn = await imported(zipSync({...parts, 'ppt/slides/slide2.xml': strToU8(churnXml.replace('<a:t>+22%</a:t>', '<a:t>+25%</a:t>'))}));
  const churnMetric = churn.deck.slides[1].metric ?? churn.deck.slides[1].blocks?.[0]?.metric;
  assert.deepEqual(churnMetric, {label: 'Monthly churn', value: '4.4%', delta: '+25%', trend: 'up', better: 'down'});
  // The value of a metric with only a format, edited: the format stays, the edit is the text.
  const formatXml = strFromU8(parts['ppt/slides/slide7.xml']);
  assert.ok(formatXml.includes('<a:t>72.4%</a:t>'));
  const formatted = await imported(zipSync({...parts, 'ppt/slides/slide7.xml': strToU8(formatXml.replace('<a:t>72.4%</a:t>', '<a:t>73.0%</a:t>'))}));
  const formatMetric = formatted.deck.slides[6].metric ?? formatted.deck.slides[6].blocks?.[0]?.metric;
  assert.deepEqual(formatMetric, {label: 'Gross margin', value: '73.0%', delta: 0.012, trend: 'up', format: '0.0%'});
  assert.equal(formatted.diagnostics.some(entry => entry.code === 'metric-data-dropped'), false);
  assert.ok(second.diagnostics.some(entry => entry.code === 'metric-data-dropped'));
}

// --- a damaged link is ignored: the metric is imported as drawn -----------------------------------------------------------------------

{
  const {parts} = await exported(deck);
  const damaged = {};
  for (const [path, bytes] of Object.entries(parts)) {
    if (!/^ppt\/tags\/.*\.xml$/.test(path)) { damaged[path] = bytes; continue; }
    damaged[path] = strToU8(strFromU8(bytes).replace(/(<p:tag name="OPF_METRIC_V1" val=")([0-9A-F]+)(")/g, (match, open, hex, close) => {
      const tag = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
      if (tag.role !== 'anchor' || !tag.link) return match;
      tag.link = {...tag.link, nonsense: true};
      return `${open}${Buffer.from(JSON.stringify(tag), 'utf8').toString('hex').toUpperCase()}${close}`;
    }));
  }
  const {deck: back, diagnostics} = await imported(zipSync(damaged));
  const metric = back.slides[0].metric ?? back.slides[0].blocks?.[0]?.metric;
  assert.equal(metric.data, undefined);
  assert.equal(metric.value, '$4.4M');
  assert.ok(diagnostics.some(entry => entry.code === 'invalid-metric-provenance' && /link/.test(entry.message)), JSON.stringify(diagnostics));
}

console.log('fr-06-metric-data: ok');
