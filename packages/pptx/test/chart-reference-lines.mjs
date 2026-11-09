// LH-110: editable explicit references, current native edits, and lossless uncertainty boundaries.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide, resolveColorRef } from '@openpresentation/opf/composition';
import { toPptx, fromPptx } from '../dist/index.js';
import { encodeTextTag, decodeTextTag } from '../dist/code-provenance.js';
import { chartOrderProblems } from './helpers/chart-schema-order.mjs';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false }),
  arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const data = {
    columns: ['Quarter', 'Actual'],
    rows: [
      ['Q1', 10],
      ['Q2', 20],
      ['Q3', 30],
    ],
  },
  ref = { value: 25, label: 'Target', stroke: { color: '#BC1234', width: 2, dash: 'dash' } };
const doc = (type = 'line', refs = [ref], extra = {}) => ({
  design: { fontScheme: 'roboto' },
  slides: [{ title: 'Results', chart: { type, data: structuredClone(data), referenceLines: structuredClone(refs), ...extra } }],
});
const chartOf = (d) => d.slides[0].chart ?? d.slides[0].blocks?.find((b) => b.chart)?.chart;
async function exported(d, options = {}) {
  const diagnostics = [],
    bytes = await toPptx(d, { ...options, onDiagnostic: (d) => diagnostics.push(d) }),
    entries = unzipSync(bytes),
    xml = strFromU8(entries['ppt/charts/chart1.xml']);
  return { bytes, entries, xml, diagnostics };
}
async function imported(bytes) {
  const diagnostics = [],
    document = await fromPptx(bytes, { onDiagnostic: (d) => diagnostics.push(d) });
  return { document, chart: chartOf(document), diagnostics };
}
const rewrite = (e, path, fn) => {
  const copy = { ...e };
  copy[path] = strToU8(fn(strFromU8(copy[path])));
  return zipSync(copy);
};
const series = (xml) => [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map((m) => m[0]);
const helper = (s) => s.includes('opf:reference ');
const editHelpers = (xml, fn) => xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (s) => (helper(s) ? fn(s) : s));
const nref = (r) => ({
  value: r.value,
  axis: r.axis ?? 'value',
  ...(r.label ? { label: r.label, labelPosition: r.labelPosition ?? 'end' } : {}),
  stroke: {
    color: (r.stroke?.color ?? '#BC1234').toUpperCase(),
    width: r.stroke?.width ?? 4 / 3,
    dash: r.stroke?.dash ?? 'dash',
  },
});
for (const type of ['column', 'line', 'line-with-markers', 'area'])
  test(`${type}: native helpers, workbook, order, bounds and import`, async () => {
    const e = await exported(doc(type)),
      out = await imported(e.bytes),
      parts = series(e.xml),
      h = parts.find(helper);
    assert.equal(parts.length, 2);
    assert.ok(h);
    assert.match(h, /<c:symbol val="none"/);
    assert.match(h, /<a:ln w="19050"/);
    assert.match(h, /<a:prstDash val="dash"/);
    assert.match(h, /<a:srgbClr val="BC1234"/);
    assert.match(h, /<c:idx val="2"\/><c:tx>/);
    assert.match(h, /<a:t>Target<\/a:t>/);
    assert.deepEqual(chartOrderProblems(e.xml), []);
    assert.deepEqual(out.chart.data, data);
    assert.equal(out.chart.type, type);
    assert.deepEqual(out.chart.referenceLines, [nref(ref)]);
    assert.equal(out.document.slides[0].shapes?.length ?? 0, 0);
    const workbook = unzipSync(e.entries['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx']),
      sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']);
    assert.match(sheet, /r="C2"[^>]*>[\s\S]*?<v>25<\/v>/);
    assert.match(sheet, /r="C4"[^>]*>[\s\S]*?<v>25<\/v>/);
    assert.match(e.xml, /<c:min val="0"/);
    const nativeAxis = arr(parser.parse(e.xml)['c:chartSpace']['c:chart']['c:plotArea']['c:valAx'])[0],
      composed = composeSlide(doc(type).slides[0], { width: 1280, height: 720, presentation: doc(type) }).items.find(
        (i) => i.field === 'chart',
      ).chart.valueAxis;
    assert.equal(Number(nativeAxis['c:scaling']['c:max'].val), composed.max);
  });
test('solid main line, independent dot/solid/dash refs; optional labels, duplicate values and legend exclusions', async () => {
  const refs = [
      ref,
      { value: 15, stroke: { color: '#012345', width: 3, dash: 'dot' } },
      { value: 25, label: 'Other', labelPosition: 'start', stroke: { color: '#654321', width: 1, dash: 'solid' } },
    ],
    e = await exported(doc('line', refs, { legend: 'bottom' })),
    out = await imported(e.bytes),
    [main, ...hs] = series(e.xml);
  assert.doesNotMatch(main, /<a:prstDash val="(?:dash|dot)"/);
  assert.equal(hs.length, 3);
  assert.match(hs[1], /prstDash val="dot"/);
  assert.doesNotMatch(hs[1], /<c:dLbl>/);
  assert.match(hs[2], /<c:idx val="0"\/><c:tx>/);
  for (const h of hs)
    assert.match(e.xml, new RegExp('<c:legendEntry><c:idx val="' + /<c:idx val="(\d+)"/.exec(h)[1] + '"/><c:delete val="1"/>'));
  assert.deepEqual(out.chart.referenceLines, refs.map(nref));
  assert.deepEqual(out.chart.data, data);
});
test('references beyond data extend the pinned native axis, including all-null data', async () => {
  for (const rows of [
    data.rows,
    [
      ['Q1', null],
      ['Q2', null],
      ['Q3', null],
    ],
  ]) {
    const e = await exported(doc('line', [{ ...ref, value: 100 }], { data: { columns: data.columns, rows } }));
    const axis = arr(parser.parse(e.xml)['c:chartSpace']['c:chart']['c:plotArea']['c:valAx'])[0];
    assert.ok(Number(axis['c:scaling']['c:max'].val) >= 100);
    assert.equal((await imported(e.bytes)).chart.referenceLines[0].value, 100);
  }
});
test('percent secondary combo uses the SAME composed native axes and retains association', async () => {
  const d = doc(
    'combo',
    [
      { value: 0.9, axis: 'secondary', label: '90%', stroke: ref.stroke },
      { value: 50, label: 'Capacity', stroke: ref.stroke },
    ],
    {
      data: {
        columns: ['Q', 'Sales', { name: 'Margin', format: '0%' }],
        rows: [
          ['A', 10, 0.2],
          ['B', 20, 0.3],
        ],
      },
      line: ['Margin'],
      secondaryAxis: ['Margin'],
    },
  );
  const e = await exported(d),
    out = await imported(e.bytes),
    plot = parser.parse(e.xml)['c:chartSpace']['c:chart']['c:plotArea'],
    axes = arr(plot['c:valAx']);
  assert.equal(axes.length, 2);
  assert.ok(axes.some((a) => Number(a['c:scaling']['c:max'].val) >= 0.9 && Number(a['c:scaling']['c:max'].val) < 2));
  assert.ok(axes.some((a) => Number(a['c:scaling']['c:max'].val) >= 50));
  assert.deepEqual(out.chart.referenceLines, d.slides[0].chart.referenceLines.map(nref));
  assert.equal(out.chart.data.columns.length, 3);
  assert.deepEqual(out.chart.data.rows, d.slides[0].chart.data.rows);
  const helpers = series(e.xml).filter(helper);
  assert.match(helpers[1], /<c:formatCode>0%<\/c:formatCode>/, 'secondary helper cache uses associated percentage format');
  const book = unzipSync(e.entries['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx']),
    sheet = strFromU8(book['xl/worksheets/sheet1.xml']),
    styles = parser.parse(strFromU8(book['xl/styles.xml'])).styleSheet,
    cell = /<c r="E2"[^>]*\bs="(\d+)"/.exec(sheet);
  assert.ok(cell, 'secondary helper workbook cell has a format style');
  const xf = arr(styles.cellXfs.xf)[Number(cell[1])],
    fmt = arr(styles.numFmts.numFmt).find((f) => String(f.numFmtId) === String(xf.numFmtId));
  assert.equal(fmt.formatCode, '0%');
});
test('native constant edits restore CURRENT value/label/style/endpoint; primary dataset provenance remains usable', async () => {
  const d = doc();
  d.datasets = { metrics: data };
  d.slides[0].chart.data = { dataset: 'metrics' };
  const e = await exported(d),
    bytes = rewrite(e.entries, 'ppt/charts/chart1.xml', (x) =>
      editHelpers(x, (s) =>
        s
          .replace(/<c:v>25<\/c:v>/g, '<c:v>22</c:v>')
          .replace('Target', 'Revised')
          .replace('w="19050"', 'w="28575"')
          .replace('val="BC1234"', 'val="123456"')
          .replace('val="dash"', 'val="dot"')
          .replace('<c:idx val="2"/><c:tx>', '<c:idx val="0"/><c:tx>'),
      ),
    ),
    out = await imported(bytes);
  assert.deepEqual(out.chart.data, { dataset: 'metrics' });
  assert.deepEqual(out.chart.referenceLines, [
    { value: 22, axis: 'value', label: 'Revised', labelPosition: 'start', stroke: { color: '#123456', width: 3, dash: 'dot' } },
  ]);
  assert.ok(!out.diagnostics.some((d) => d.code === 'chart-data-provenance-changed'));
});
for (const type of ['area', 'line', 'column'])
  test(`${type}: nonconstant helpers become ALL ordinary data with no stale refs/duplicate shapes`, async () => {
    const e = await exported(doc(type)),
      out = await imported(
        rewrite(e.entries, 'ppt/charts/chart1.xml', (x) => editHelpers(x, (s) => s.replace('<c:v>25</c:v>', '<c:v>26</c:v>'))),
      );
    assert.equal(out.chart.referenceLines, undefined);
    assert.equal(out.chart.data.columns.length, 3);
    assert.deepEqual(
      out.chart.data.rows.map((r) => r[1]),
      [10, 20, 30],
    );
    assert.deepEqual(
      out.chart.data.rows.map((r) => r[2]),
      [26, 25, 25],
    );
    assert.equal(out.document.slides[0].shapes?.length ?? 0, 0);
    assert.ok(out.diagnostics.some((d) => d.code === 'chart-reference-ownership-uncertain'));
    if (type === 'area') assert.ok(out.diagnostics.some((d) => /area.*columns/.test(d.message)));
  });
test('stripped area ownership preserves BOTH groups and every row, never infers from constant values or names', async () => {
  const e = await exported(doc('area')),
    out = await imported(
      rewrite(e.entries, 'ppt/charts/chart1.xml', (x) =>
        x.replace(/<c:ext uri="urn:openpresentation:chart-references:v1">[\s\S]*?<\/c:ext>/g, ''),
      ),
    );
  assert.equal(out.chart.referenceLines, undefined);
  assert.equal(out.chart.type, 'combo');
  assert.equal(out.chart.data.columns.length, 3);
  assert.deepEqual(
    out.chart.data.rows.map((r) => r.slice(1)),
    [
      [10, 25],
      [20, 25],
      [30, 25],
    ],
  );
  assert.ok(out.diagnostics.some((d) => /area.*columns/.test(d.message)));
});
test('duplicate helper identity is refused rather than consuming either copy', async () => {
  const e = await exported(doc('area')),
    out = await imported(
      rewrite(e.entries, 'ppt/charts/chart1.xml', (x) =>
        x.replace(/(<c:ser>[\s\S]*?<\/c:ser>)/g, (s) => (helper(s) ? s + s : s)),
      ),
    );
  assert.equal(out.chart.referenceLines, undefined);
  assert.equal(out.chart.data.columns.length, 4);
  assert.deepEqual(out.chart.data.rows[0].slice(1), [10, 25, 25]);
});
for (const type of ['bar', 'column'])
  test(`${type === 'column' ? 'singleton' : 'horizontal'}: exact unchanged overlay recovery + current-edit refusal`, async () => {
    const d = doc(type, [{ ...ref, value: 17.123456789 }]);
    if (type === 'column') d.slides[0].chart.data.rows = [['Only', 20]];
    const e = await exported(d),
      out = await imported(e.bytes);
    assert.equal(series(e.xml).length, 1);
    assert.deepEqual(out.chart.referenceLines, [nref({ ...ref, value: 17.123456789 })]);
    assert.equal(out.document.slides[0].shapes?.length ?? 0, 0);
    for (const mode of ['lineGeometry', 'lineStyle', 'labelText', 'plot', 'axis', 'receipt']) {
      const edit = (xml) =>
        mode === 'plot'
          ? xml.replace(/(<c:plotArea>[\s\S]*?<c:x val=")[^"]+/, (_m, a) => a + '0.1')
          : mode === 'axis'
            ? xml.replace(/(<c:max val=")[^"]+/, (_m, a) => a + '100')
            : xml.replace(/<c:ext uri="urn:openpresentation:chart-references:v1">[\s\S]*?<\/c:ext>/g, '');
      let bytes;
      if (['plot', 'axis', 'receipt'].includes(mode)) bytes = rewrite(e.entries, 'ppt/charts/chart1.xml', edit);
      else
        bytes = rewrite(e.entries, 'ppt/slides/slide1.xml', (x) =>
          x.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (s) =>
            mode === 'labelText' && s.includes(':0 label')
              ? s.replace('Target', 'Changed')
              : s.includes(':0 line')
                ? mode === 'lineGeometry'
                  ? s.replace(/(<a:off x=")(\d+)/, (_m, a, v) => a + (Number(v) + 9525))
                  : mode === 'lineStyle'
                    ? s.replace('val="BC1234"', 'val="123456"')
                    : s
                : s,
          ),
        );
      const changed = await imported(bytes);
      assert.equal(changed.chart.referenceLines, undefined, mode);
      assert.ok((changed.document.slides[0].shapes?.length ?? 0) >= 2, 'uncertain line and label stay visible ' + mode);
      assert.deepEqual(changed.chart.data, d.slides[0].chart.data);
    }
  });
test('structural identification is retained with provenance false/references', async () => {
  for (const provenance of [false, 'references-only'])
    for (const type of ['line', 'bar']) {
      const e = await exported(doc(type), { provenance }),
        out = await imported(e.bytes);
      assert.deepEqual(out.chart.data, data);
      assert.deepEqual(out.chart.referenceLines, [nref(ref)]);
      assert.equal(out.document.slides[0].shapes?.length ?? 0, 0);
    }
});
test('legacy V1 references, labels and bands remain ordinary VISIBLE shapes', async () => {
  const e = await exported(doc('bar')),
    copy = { ...e.entries };
  for (const [p, b] of Object.entries(copy))
    if (/^ppt\/tags\/opfReference\d+\.xml$/.test(p))
      copy[p] = strToU8(
        strFromU8(b).replace(/name="OPF_CHART_REFERENCE_V1" val="([^"]+)"/g, (_m, h) => {
          const r = decodeTextTag(h);
          return `name="OPF_CHART_MARK_V1" val="${encodeTextTag({ v: 1, chart: r.key, role: r.role === 'line' ? 'reference' : 'reference-label' })}"`;
        }),
      );
  copy['ppt/charts/chart1.xml'] = strToU8(
    e.xml.replace(/<c:ext uri="urn:openpresentation:chart-references:v1">[\s\S]*?<\/c:ext>/g, ''),
  );
  const out = await imported(zipSync(copy));
  assert.equal(out.chart.referenceLines, undefined);
  assert.equal(out.document.slides[0].shapes.length, 2);
  assert.ok(out.diagnostics.some((d) => d.code === 'legacy-chart-reference-overlay'));
});
test('title/subtitle cannot add, remove, move or restyle explicit references', async () => {
  const a = doc();
  a.slides[0].subtitle = 'Neutral subtitle';
  const b = structuredClone(a);
  b.slides[0].title = 'Actual target 900';
  b.slides[0].subtitle = 'Benchmark is 5';
  const x = await exported(a),
    y = await exported(b);
  assert.equal(x.xml, y.xml);
  const c = doc('line', []);
  c.slides[0].title = 'Target threshold 25';
  assert.equal(series((await exported(c)).xml).length, 1);
  assert.equal((await imported((await exported(c)).bytes)).chart.referenceLines, undefined);
});
test('representative authored example exports every chart without helper data/duplicate shapes', async () => {
  const d = JSON.parse(
      readFileSync(new URL('../../../examples/technical/explicit-chart-reference-lines.opf.json', import.meta.url)),
    ),
    e = await exported(d),
    out = await fromPptx(e.bytes);
  assert.equal(out.slides.length, d.slides.length);
  for (let i = 0; i < d.slides.length; i++) {
    assert.equal(chartOf({ slides: [out.slides[i]] }).referenceLines.length, d.slides[i].chart.referenceLines.length);
    assert.equal(out.slides[i].shapes?.length ?? 0, 0);
  }
  assert.ok(createHash('sha256').update(e.bytes).digest('hex'));
});

test('ColorRef alpha, transform, theme/variable resolution and zero-width are retained by native and overlay paint', async () => {
  for (const type of ['line', 'bar'])
    for (const color of ['#12345680', { color: '#204060', lighten: 0.2 }, 'accent1', 'var:reference']) {
      const d = doc(type, [{ value: 20, label: 'Color', stroke: { color, width: 0, dash: 'dot' } }]);
      d.variables = { reference: { type: 'color', value: '#45678980' } };
      const e = await exported(d),
        out = await imported(e.bytes);
      assert.ok(out.chart.referenceLines, JSON.stringify({ type, color, diagnostics: out.diagnostics }));
      const paint = out.chart.referenceLines[0].stroke;
      assert.equal(paint.width, 0);
      assert.equal(paint.dash, 'dot');
      if (color === '#12345680') assert.equal(paint.color, '#12345680');
      if (typeof color === 'object') assert.equal(paint.color, resolveColorRef(color, {}).toUpperCase());
      if (color === 'var:reference') assert.equal(paint.color, resolveColorRef(color, { variables: d.variables }).toUpperCase());
      if (color === 'accent1') assert.match(paint.color, /^#[0-9A-F]{6}$/);
    }
});
test('RTL start/end native endpoints and singleton overlay labels follow logical category order', async () => {
  for (const type of ['line', 'column', 'bar']) {
    const d = doc(type, [
      { ...ref, labelPosition: 'start' },
      { ...ref, value: 15, labelPosition: 'end' },
    ]);
    d.language = 'ar';
    if (type === 'column') d.slides[0].chart.data.rows = [['Only', 20]];
    const e = await exported(d),
      out = await imported(e.bytes);
    assert.deepEqual(
      out.chart.referenceLines.map((r) => r.labelPosition),
      ['start', 'end'],
    );
    assert.deepEqual(
      out.chart.referenceLines.map((r) => r.value),
      [25, 15],
    );
    if (type === 'line')
      assert.deepEqual(
        series(e.xml)
          .filter(helper)
          .map((h) => Number(/<c:dLbl><c:idx val="(\d+)"/.exec(h)[1])),
        [0, 2],
      );
  }
});
test('unknown marker, unsupported dash and invalid helper point counts are retained as ordinary data or refused by maintained cache guards', async () => {
  const e = await exported(doc('area'));
  for (const fn of [
    (s) => s.replace('symbol val="none"', 'symbol val="circle"'),
    (s) => s.replace('prstDash val="dash"', 'prstDash val="sysDash"'),
    (s) => s.replace(/(<c:val>[\s\S]*?<c:ptCount val=")3"/, '$1' + '100001"'),
  ]) {
    let out;
    try {
      out = await imported(rewrite(e.entries, 'ppt/charts/chart1.xml', (x) => editHelpers(x, fn)));
    } catch (error) {
      assert.equal(error.code, 'invalid-chart-cache');
      continue;
    }
    assert.equal(out.chart.referenceLines, undefined);
    assert.equal(out.chart.data.columns.length, 3);
    assert.deepEqual(
      out.chart.data.rows.map((r) => r[1]),
      [10, 20, 30],
    );
  }
});

test('native label deletion/clearing never resurrects stale authored text', async () => {
  const e = await exported(doc());
  for (const fn of [
    (s) => s.replace('<c:delete val="0"/>', '<c:delete val="1"/>'),
    (s) => s.replace('<a:t>Target</a:t>', '<a:t> </a:t>'),
  ]) {
    const out = await imported(rewrite(e.entries, 'ppt/charts/chart1.xml', (x) => editHelpers(x, fn)));
    assert.equal(out.chart.referenceLines.length, 1);
    assert.equal(out.chart.referenceLines[0].label, undefined);
    assert.equal(out.chart.referenceLines[0].value, 25);
  }
});
test('ordinary data edits cannot be overwritten by a primary dataset receipt while native references remain explicit', async () => {
  const d = doc();
  d.datasets = { metrics: data };
  d.slides[0].chart.data = { dataset: 'metrics' };
  const e = await exported(d),
    out = await imported(
      rewrite(e.entries, 'ppt/charts/chart1.xml', (xml) =>
        xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (s) => (helper(s) ? s : s.replace('<c:v>10</c:v>', '<c:v>11</c:v>'))),
      ),
    );
  assert.equal(out.chart.data.rows[0][1], 11);
  assert.equal(out.chart.referenceLines[0].value, 25);
  assert.ok(out.diagnostics.some((d) => d.code === 'chart-data-provenance-changed'));
});
test('fully stripped overlays stay visible ordinary drawings, never synthetic reference data', async () => {
  const e = await exported(doc('bar')),
    copy = { ...e.entries };
  copy['ppt/charts/chart1.xml'] = strToU8(
    e.xml.replace(/<c:ext uri="urn:openpresentation:chart-references:v1">[\s\S]*?<\/c:ext>/g, ''),
  );
  copy['ppt/slides/slide1.xml'] = strToU8(
    strFromU8(copy['ppt/slides/slide1.xml']).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''),
  );
  const out = await imported(zipSync(copy));
  assert.equal(out.chart.referenceLines, undefined);
  assert.equal(out.document.slides[0].shapes.length, 2);
  assert.deepEqual(out.chart.data, data);
});
