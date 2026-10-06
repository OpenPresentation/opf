import assert from 'node:assert/strict';
import test from 'node:test';
import {unzipSync, zipSync, strToU8, strFromU8} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
const {toPptx, fromPptx} = await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');

// Edit native chart caches in an actual exported package. No source tags are
// available to hide an import defect, and no Office process is involved.
const original = unzipSync(await toPptx({slides: [{chart: {type: 'column', data: {
  columns: ['Category', 'First', 'Second'], rows: [['A', 2, 5], ['B', 3, 6], ['C', 4, 7]],
}}}]}, {provenance: false}));
const chartPart = Object.keys(original).find(path => /^ppt\/charts\/chart\d+\.xml$/.test(path));
assert.ok(chartPart);
const point = (index, value) => `<c:pt${index === undefined ? '' : ` idx="${index}"`}>${value === undefined ? '' : `<c:v>${value}</c:v>`}</c:pt>`;
const cache = (points, count = 3, kind = 'numRef') => {
  const body = `${count === undefined ? '' : `<c:ptCount val="${count}"/>`}${points.join('')}`;
  if (kind === 'multiLvlStrRef') return `<c:multiLvlStrRef><c:multiLvlStrCache>${count === undefined ? '' : `<c:ptCount val="${count}"/>`}<c:lvl>${points.join('')}</c:lvl></c:multiLvlStrCache></c:multiLvlStrRef>`;
  if (kind.endsWith('Lit')) return `<c:${kind}>${body}</c:${kind}>`;
  const nested = kind === 'numRef' ? 'numCache' : 'strCache';
  return `<c:${kind}><c:f>Sheet1!$A$2:$A$4</c:f><c:${nested}>${body}</c:${nested}></c:${kind}>`;
};
const categories = () => cache([point(0, 'A'), point(1, 'B'), point(2, 'C')], 3, 'strRef');
function fixture({element = 'barChart', labels = categories(), values = [cache([point(0, 2), point(1, 3), point(2, 4)]), cache([point(0, 5), point(1, 6), point(2, 7)])], names = ['First', 'Second'], rawName, extra = ''} = {}) {
  const series = values.map((value, index) => `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx>${rawName ?? cache([point(0, names[index])], 1, 'strRef')}</c:tx>${element === 'scatterChart' ? `<c:xVal>${labels}</c:xVal><c:yVal>${value}</c:yVal>` : `<c:cat>${labels}</c:cat><c:val>${value}</c:val>`}</c:ser>`).join('');
  const entries = {...original};
  const xml = strFromU8(entries[chartPart]).replace(/<c:barChart>[\s\S]*?<\/c:barChart>/, `<c:${element}>${element === 'barChart' ? '<c:barDir val="col"/>' : ''}${series}${extra}</c:${element}>`);
  entries[chartPart] = strToU8(xml);
  return zipSync(entries);
}
async function imported(options) {
  const bytes = fixture(options), before = bytes.slice();
  const document = await fromPptx(bytes);
  assert.deepEqual(bytes, before, 'fromPptx must not mutate the package');
  assert.equal(validatePresentation(document).valid, true, 'observed cache data must remain valid OPF');
  const slide = document.slides[0], chart = slide.chart ?? slide.blocks?.find(block => block.chart)?.chart;
  assert.ok(chart, 'native chart remains a chart');
  return chart;
}

for (const element of ['barChart', 'lineChart', 'areaChart', 'pieChart', 'doughnutChart', 'radarChart']) {
  test(`${element}: reordered sparse caches keep holes, zero and empty labels aligned`, async () => {
    const chart = await imported({element,
      labels: cache([point(2, ' C \tΩ '), point(0, '')], 4, 'strRef'),
      values: [cache([point(2, 4), point(0, 0)], 4), cache([point(1, 6)], 2)],
    });
    assert.deepEqual(chart.data.columns, ['Category', 'First', 'Second']);
    assert.deepEqual(chart.data.rows, [['', 0, null], [null, null, 6], [' C \tΩ ', 4, null], [null, null, null]]);
  });
}
// A native scatter chart has no category labels: c:xVal is its numeric X and imports as [Point, X, ...series] with numbered points.
test('scatterChart: reordered sparse xVal/yVal caches keep holes, zero and empty X values aligned', async () => {
  const chart = await imported({element: 'scatterChart',
    labels: cache([point(2, ' 30 '), point(0, '')], 4),
    values: [cache([point(2, 4), point(0, 0)], 4), cache([point(1, 6)], 2)],
  });
  assert.equal(chart.type, 'scatter');
  assert.deepEqual(chart.data.columns, ['Point', 'Category', 'First', 'Second'], 'the X heading is the workbook category heading');
  assert.deepEqual(chart.data.rows, [['1', null, 0, null], ['2', null, null, 6], ['3', 30, 4, null], ['4', null, null, null]], 'X and Y gaps stay null and a zero stays zero');
});
test('scatterChart: a chart without c:xVal is plotted against 1..n', async () => {
  const entries = unzipSync(fixture({element: 'scatterChart', values: [cache([point(0, 2), point(1, 3), point(2, 4)])]}));
  entries[chartPart] = strToU8(strFromU8(entries[chartPart]).replace(/<c:xVal>[\s\S]*?<\/c:xVal>/, ''));
  const document = await fromPptx(zipSync(entries));
  const chart = document.slides[0].chart ?? document.slides[0].blocks?.find(block => block.chart)?.chart;
  assert.deepEqual(chart.data.rows, [['1', 1, 2], ['2', 2, 3], ['3', 3, 4]]);
});
for (const kind of ['strRef', 'strLit', 'numRef', 'numLit', 'multiLvlStrRef']) {
  test(`${kind}: label indices retain explicit empty and absent values`, async () => {
    const chart = await imported({labels: cache([point(2, 'third'), point(0, '')], 3, kind)});
    assert.deepEqual(chart.data.rows.map(row => row[0]), ['', null, 'third']);
  });
}
test('empty series name is retained, missing series name still receives a fallback', async () => {
  assert.deepEqual((await imported({names: ['', 'Second']})).data.columns, ['Category', '', 'Second']);
  assert.deepEqual((await imported({rawName: '<c:strRef><c:strCache><c:ptCount val="1"/></c:strCache></c:strRef>'})).data.columns, ['Category', 'Series 1', 'Series 2']);
});
for (const kind of ['numRef', 'numLit']) {
  test(`${kind}: empty numeric values and omitted c:v are missing, not zero`, async () => {
    const chart = await imported({values: [cache([point(0, ''), point(1, undefined), point(2, '  ')], 3, kind)]});
    assert.deepEqual(chart.data.rows, [['A', null], ['B', null], ['C', null]]);
  });
}
test('absent ptCount infers extent from indices rather than point order', async () => {
  const withoutCount = cache([point(2, 9), point(0, 7)], 3).replace('<c:ptCount val="3"/>', '');
  assert.deepEqual((await imported({values: [withoutCount]})).data.rows, [['A', 7], ['B', null], ['C', 9]]);
});
test('unsigned integer lexical forms retain their numeric indices', async () => {
  const chart = await imported({values: [cache([point(' +02 ', 9), point('-0', 7)], '+3')]});
  assert.deepEqual(chart.data.rows, [['A', 7], ['B', null], ['C', 9]]);
});
test('empty caches with a declared extent retain all-missing rows', async () => {
  const chart = await imported({labels: cache([], 3, 'strRef'), values: [cache([], 3)]});
  assert.deepEqual(chart.data.rows, [[null, null], [null, null], [null, null]]);
});
test('category and numeric extents are aligned without manufacturing labels or zeros', async () => {
  const chart = await imported({labels: cache([point(0, 'A')], 1, 'strRef'), values: [cache([point(4, 8)], 5)]});
  assert.deepEqual(chart.data.rows, [['A', null], [null, null], [null, null], [null, null], [null, 8]]);
});

for (const [name, value] of [
  ['duplicate index', cache([point(1, 2), point(1, 3)])],
  ['missing index', cache([point(undefined, 2)])],
  ['negative index', cache([point(-1, 2)])],
  ['fractional index', cache([point('1.5', 2)])],
  ['exponent index', cache([point('1e1', 2)])],
  ['nonnumeric index', cache([point('no', 2)])],
  ['huge index', cache([point('4294967295', 2)], undefined).replace('<c:ptCount val="3"/>', '')],
  ['index outside declared extent', cache([point(3, 2)], 3)],
  ['negative count', cache([], -1)],
  ['fractional count', cache([], '1.5')],
  ['huge count', cache([], '4294967295')],
  ['duplicate count', cache([point(0, 2)]).replace('<c:ptCount val="3"/>', '<c:ptCount val="3"/><c:ptCount val="3"/>')],
]) {
  test(`malformed ${name} rejects with chart part and cache location`, async () => {
    await assert.rejects(fromPptx(fixture({values: [value]})), error => {
      assert.equal(error.code, 'invalid-chart-cache');
      assert.ok(error.path.startsWith(`${chartPart}#`), error.path);
      assert.match(error.message, /chart cache/i);
      assert.match(error.path, /c:ser\[0\].*c:val/);
      return true;
    });
  });
}
test('malformed category and name caches are checked too', async () => {
  const invalid = cache([point(0, 'A'), point(0, 'B')], 2, 'strRef');
  for (const options of [{labels: invalid}, {rawName: invalid}]) {
    await assert.rejects(fromPptx(fixture(options)), error => error.code === 'invalid-chart-cache' && error.path.startsWith(`${chartPart}#`));
  }
});
test('unchanged dense caches still import ordinary chart values', async () => {
  assert.deepEqual((await imported()).data, {columns: ['Category', 'First', 'Second'], rows: [['A', 2, 5], ['B', 3, 6], ['C', 4, 7]]});
});
test('multiple cache sources and multiple point values are rejected', async () => {
  for (const value of [
    cache([point(0, 2)]) + cache([point(0, 2)], 3, 'numLit'),
    cache([point(0, 2)]).replace('<c:v>2</c:v>', '<c:v>2</c:v><c:v>3</c:v>'),
    cache([point(0, 2)]).replace('<c:ptCount val="3"/>', '<c:ptCount/>'),
  ]) await assert.rejects(fromPptx(fixture({values: [value]})), error => error.code === 'invalid-chart-cache');
});
test('hierarchical categories are refused instead of becoming extra data rows', async () => {
  const labels = cache([point(0, 'A')], 3, 'multiLvlStrRef').replace('</c:multiLvlStrCache>', '<c:lvl><c:pt idx="0"><c:v>Group</c:v></c:pt></c:lvl></c:multiLvlStrCache>');
  await assert.rejects(fromPptx(fixture({labels})), error => error.code === 'unsupported-chart-cache' && /single category level/.test(error.message));
});
test('largest supported sparse extent is retained without index truncation', async () => {
  const chart = await imported({labels: cache([], 0, 'strRef'), values: [cache([point(99_999, 8)], 100_000)]});
  assert.equal(chart.data.rows.length, 100_000);
  assert.deepEqual(chart.data.rows[0], [null, null]);
  assert.deepEqual(chart.data.rows.at(-1), [null, 8]);
});
test('combined cache and output-table budgets reject before oversized allocations', async () => {
  for (const values of [
    new Array(11).fill(cache([], 100_000)),
    [cache([], 100_000), ...new Array(9).fill(cache([], 1))],
  ]) await assert.rejects(fromPptx(fixture({values})), error => error.code === 'invalid-chart-cache' && /1,000,000-cell/.test(error.message));
});

for (const container of ['c:numRef', 'c:strRef', 'c:multiLvlStrRef', 'c:val', 'c:yVal', 'c:cat', 'c:tx']) {
  test(`duplicate ${container} containers reject instead of importing missing data`, async () => {
    const options = container === 'c:multiLvlStrRef'
      ? {labels: cache([point(0, 'A')], 3, 'multiLvlStrRef')}
      : container === 'c:yVal' ? {element: 'scatterChart'} : {};
    const entries = unzipSync(fixture(options));
    const pattern = new RegExp(`<${container}>[\\s\\S]*?</${container}>`);
    const xml = strFromU8(entries[chartPart]);
    assert.ok(pattern.test(xml), 'fixture contains the intended native container');
    entries[chartPart] = strToU8(xml.replace(pattern, match => match + match));
    await assert.rejects(fromPptx(zipSync(entries)), error =>
      error.code === 'invalid-chart-cache'
      && error.path.startsWith(`${chartPart}#`)
      && /single element/.test(error.message));
  });
}

test('ordinary numeric export/import/re-export retains scientific-notation cells', async () => {
  const input = {slides: [{chart: {type: 'column', data: {
    columns: ['Category', 'Native values'],
    rows: [['1e3', 1e21], ['1e-7', 1e-7], ['ordinary', 12.5], ['zero', 0]],
  }}}]};
  const before = structuredClone(input);
  const bytes = await toPptx(input, {provenance: false});
  assert.deepEqual(input, before, 'export must not change authored numeric input');
  assert.deepEqual(await toPptx(input, {provenance: false}), bytes, 'repeat exports are deterministic');
  const entries = unzipSync(bytes);
  const xml = strFromU8(entries[Object.keys(entries).find(path => /^ppt\/charts\/chart\d+\.xml$/.test(path))]);
  assert.match(xml, /<c:v>1e\+21<\/c:v>/, 'baseline exporter actually uses exponent notation');
  assert.match(xml, /<c:v>1e-7<\/c:v>/);
  const originalBytes = bytes.slice();
  const restored = await fromPptx(bytes);
  assert.deepEqual(bytes, originalBytes, 'import must not change the package');
  assert.equal(validatePresentation(restored).valid, true);
  const chart = restored.slides[0].chart ?? restored.slides[0].blocks?.find(block => block.chart)?.chart;
  assert.deepEqual(chart.data, input.slides[0].chart.data);
  const restoredBefore = structuredClone(restored);
  const again = await fromPptx(await toPptx(restored, {provenance: false}));
  assert.deepEqual(restored, restoredBefore, 're-export must not change imported values');
  const againChart = again.slides[0].chart ?? again.slides[0].blocks?.find(block => block.chart)?.chart;
  assert.deepEqual(againChart.data, chart.data);
});

// Native scatter charts read c:xVal as X and c:yVal as the value role: [Point, X, Y].
const shape = (element, rows) => element === 'scatterChart' ? rows.map(([label, ...rest], index) => [String(index + 1), label === '1e3' ? 1000 : null, ...rest]) : rows;
for (const element of ['barChart', 'scatterChart']) {
  for (const kind of ['numRef', 'numLit']) {
    const role = element === 'scatterChart' ? 'yVal' : 'val';
    test(`${role}/${kind}: complete exponents preserve finite values, zeros and sparse labels`, async () => {
      const pairs = [
        ['1e3', 1000], ['1e-3', 0.001], ['-2.5E+2', -250], ['+4E-2', 0.04],
        [' 6.02e23 ', 6.02e23], ['.5E+1', 5], ['2.e2', 200], ['001.20e+002', 120],
        ['5e-324', Number.MIN_VALUE], ['1.7976931348623157e308', Number.MAX_VALUE],
        ['0e99999', 0], ['-0.000E-99999', -0], ['+.0e+99999', 0], ['-0', -0],
      ];
      const count = pairs.length + 3;
      const chart = await imported({element,
        labels: cache([point(2, ''), point(0, '1e3')], count, 'strRef'),
        names: [' 1E+3 '],
        values: [cache([
          ...pairs.map(([token], index) => point(index, token)).reverse(),
          point(pairs.length, ''), point(pairs.length + 1, undefined),
        ], count, kind)],
      });
      assert.deepEqual(chart.data.columns.slice(-1), [' 1E+3 ']);
      assert.deepEqual(chart.data.rows, shape(element, [
        ...pairs.map(([, value], index) => [index === 0 ? '1e3' : index === 2 ? '' : null, value]),
        [null, null], [null, null], [null, null],
      ]));
    });
    test(`${role}/${kind}: exponent overflow and nonzero underflow refuse the exact logical point`, async () => {
      for (const [token, reason] of [
        ['1e309', 'overflows'], ['-1E9999', 'overflows'],
        ['1e-324', 'underflows to zero'], ['-2E-9999', 'underflows to zero'],
      ]) {
        const bytes = fixture({element, values: [cache([point(0, 4)]), cache([point(2, token), point(0, 2)], 3, kind)]});
        const before = bytes.slice();
        await assert.rejects(fromPptx(bytes), error => {
          assert.equal(error.code, 'unsupported-chart-cache');
          const nested = kind === 'numRef' ? 'c:numRef/c:numCache' : 'c:numLit';
          assert.equal(error.path, `${chartPart}#c:ser[1]/c:${role}/${nested}/c:pt[@idx="2"]/c:v`);
          assert.ok(error.message.includes(reason), error.message);
          assert.match(error.message, /use a representable value before importing/);
          return true;
        });
        assert.deepEqual(bytes, before, 'failed import must not alter the package');
      }
    });
    // RR-54: core's strict chart number rule replaces the legacy character stripping ('1e2tail' was 12, '$2.50' 2.5 and
    // 'text' 0): a value that is not a number is a gap, never a guessed value. XML decimal forms ('+5', '007', '.5') stay numbers.
    test(`${role}/${kind}: malformed exponents and non-numeric text are gaps under the strict chart number rule`, async () => {
      const pairs = [['1e', null], ['1e+', null], ['1e2tail', null], ['1.2.3e4', null],
        ['1,200', null], ['$2.50', null], ['text', null], ['Infinity', null], ['NaN', null], ['  ', null],
        ['+5', 5], ['007', 7], ['.5', 0.5], ['-.25', -0.25], ['5.', 5], [' 12 ', 12]];
      const chart = await imported({element, labels: cache([], pairs.length, 'strRef'),
        values: [cache(pairs.map(([token], index) => point(index, token)), pairs.length, kind)],
      });
      assert.deepEqual(chart.data.rows, shape(element, pairs.map(([, value]) => [null, value])));
    });
  }
}
