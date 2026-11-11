// Office-free, relationship-bound inspection of the four whole seven-slide cases.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import {inspectCurrentSignedPareto} from './seven-signed-pareto.mjs';

export function archiveDependencies() {
  const local = createRequire(import.meta.url),
    peer = createRequire(local.resolve('@openpresentation/opf-pptx/package.json'));
  return { ...peer('fflate'), ...peer('fast-xml-parser') };
}
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const tag = (node) => Object.keys(node).find((key) => key !== ':@' && key !== '#text');
const child = (nodes, name) => nodes?.find((node) => Object.hasOwn(node, name));
const attrs = (node) =>
  Object.fromEntries(
    Object.entries(node?.[':@'] ?? {}).map(([key, value]) => [key.slice(2), value]),
  );
const all = (nodes, name) => nodes?.filter((node) => Object.hasOwn(node, name)) ?? [];
const elements = (nodes) => nodes?.filter((node) => tag(node)) ?? [];
// Requires names a prefix in the Choice element's namespace scope. Office may
// hoist its declaration to AlternateContent (or another ancestor) when saving.
const namespaceScope = (parent, node) => {
  const scope = new Map(parent);
  for (const [name, uri] of Object.entries(attrs(node)))
    if (name.startsWith('xmlns:')) scope.set(name.slice(6), uri);
  return scope;
};
const text = (nodes) =>
  nodes
    .map((node) =>
      tag(node) === 'a:t'
        ? node['a:t'].map((n) => String(n['#text'] ?? '')).join('')
        : tag(node) === 'a:br'
          ? '\n'
          : tag(node) === 'a:tab'
            ? '\t'
            : Array.isArray(node[tag(node)])
              ? text(node[tag(node)])
              : '',
    )
    .join('');
const string = (value) =>
  typeof value === 'object' ? String(value?.['#text'] ?? '') : String(value ?? '');
const number = (value) => {
  assert.ok(
    typeof value === 'string' && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value),
    'Invalid numeric chart cache',
  );
  const result = Number(value);
  assert.ok(Number.isFinite(result), 'Nonfinite chart cache');
  return result;
};

function portable(name) {
  assert.ok(
    name &&
      !name.startsWith('/') &&
      !/[\\:]/u.test(name) &&
      ![...name].some((c) => c.charCodeAt(0) < 32) &&
      !name.split('/').some((part) => !part || part === '.' || part === '..'),
    'Unsafe ZIP part',
  );
  return name;
}
function boundedParts(input, deps) {
  assert.ok(
    input.length > 0 && input.length <= 16 * 1024 * 1024,
    'Seven input must be at most16MiB',
  );
  let count = 0,
    total = 0;
  const seen = new Set();
  const parts = deps.unzipSync(input, {
    filter(entry) {
      portable(entry.name.replace(/\/$/u, ''));
      assert.ok(!seen.has(entry.name.toLowerCase()), 'Duplicate ZIP part');
      seen.add(entry.name.toLowerCase());
      assert.ok(++count <= 4096, 'Seven ZIP exceeds4096 entries');
      assert.ok(entry.originalSize <= 8 * 1024 * 1024, 'ZIP entry expansion bound');
      total += entry.originalSize;
      assert.ok(total <= 64 * 1024 * 1024, 'ZIP aggregate expansion bound');
      return true;
    },
  });
  return { parts, count, total };
}
function xmlTools(parts, deps) {
  const objectParser = new deps.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  });
  const orderParser = new deps.XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  });
  function xml(file) {
    portable(file);
    assert.ok(parts[file], 'Missing XML part ' + file);
    const value = deps.strFromU8(parts[file]);
    assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(value), 'XML declarations refused');
    assert.equal(deps.XMLValidator.validate(value), true, 'Invalid XML part ' + file);
    return value;
  }
  function relationships(file) {
    const relFile = path.posix.join(
      path.posix.dirname(file),
      '_rels',
      path.posix.basename(file) + '.rels',
    );
    const rels = list(objectParser.parse(xml(relFile)).Relationships.Relationship);
    assert.equal(new Set(rels.map((rel) => rel.Id)).size, rels.length, 'Duplicate relationships');
    return (id) => {
      const found = rels.filter((rel) => rel.Id === id);
      assert.equal(found.length, 1, 'Missing/duplicate relationship ' + id);
      const rel = found[0];
      assert.equal(rel.TargetMode, undefined, 'External relationship refused');
      assert.equal(typeof rel.Target, 'string');
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), rel.Target));
      portable(target);
      assert.ok(parts[target], 'Missing relationship target');
      return { ...rel, target };
    };
  }
  return {
    xml,
    object: (file) => objectParser.parse(xml(file)),
    ordered: (file) => orderParser.parse(xml(file)),
    relationships,
  };
}
function workbook(parts, chartFile, _space, external, deps, tools) {
  if (!external) return null;
  const rel = tools.relationships(chartFile)(external['r:id']);
  assert.ok(rel.Type.endsWith('/package'), 'Expected internal workbook relationship');
  const nested = boundedParts(parts[rel.target], deps).parts,
    t = xmlTools(nested, deps),
    book = t.object('xl/workbook.xml').workbook;
  const sheets = list(book.sheets.sheet);
  assert.equal(sheets.length, 1, 'Bounded chart workbook requires one worksheet');
  const sheet = sheets[0],
    target = t.relationships('xl/workbook.xml')(sheet['r:id']);
  assert.ok(target.Type.endsWith('/worksheet'));
  const strings = nested['xl/sharedStrings.xml']
    ? list(t.object('xl/sharedStrings.xml').sst.si).map((si) =>
        si.t !== undefined
          ? string(si.t)
          : list(si.r)
              .map((r) => string(r.t))
              .join(''),
      )
    : [];
  const cells = [],
    seen = new Set();
  for (const row of list(t.object(target.target).worksheet.sheetData.row))
    for (const cell of list(row.c)) {
      assert.match(cell.r, /^[A-Z]+[1-9][0-9]*$/u);
      assert.ok(!seen.has(cell.r), 'Duplicate workbook cell');
      seen.add(cell.r);
      let value;
      if (cell.t === 's') {
        const index = Number(cell.v);
        assert.ok(Number.isSafeInteger(index) && index >= 0 && index < strings.length);
        value = strings[index];
      } else if (cell.t === 'inlineStr')
        value =
          cell.is.t !== undefined
            ? string(cell.is.t)
            : list(cell.is.r)
                .map((r) => string(r.t))
                .join('');
      else if (cell.t === 'str') value = string(cell.v);
      else {
        assert.ok(cell.t === undefined || cell.t === 'n', 'Unsupported workbook cell type');
        value = number(string(cell.v));
      }
      assert.equal(cell.f, undefined, 'Chart workbook formula cells require separate review');
      cells.push({ cell: cell.r, value });
    }
  return { part: rel.target, sheet: sheet.name, cells };
}
function rangeValues(formula, book) {
  assert.ok(book, 'Referenced chart data requires embedded workbook');
  const match =
    /^(?:'([^']+)'|([^'!]+))!\$([A-Z]+)\$([1-9][0-9]*)(?::\$([A-Z]+)\$([1-9][0-9]*))?$/u.exec(
      formula,
    );
  assert.ok(match, 'Unsupported chart formula ' + formula);
  assert.equal(match[1] ?? match[2], book.sheet, 'Chart formula references wrong sheet');
  assert.ok(!match[5] || match[5] === match[3], 'Only single-column chart ranges are supported');
  const first = Number(match[4]),
    last = Number(match[6] ?? match[4]);
  assert.ok(last >= first && last - first < 10000, 'Bounded chart range');
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const found = book.cells.filter((cell) => cell.cell === match[3] + (first + i));
    assert.equal(found.length, 1, 'Missing referenced workbook cell');
    return found[0].value;
  });
}
function points(cache, numeric, prefix) {
  assert.ok(cache, 'Missing ' + prefix + ' cache');
  const pts = list(cache[prefix + ':pt']),
    count = prefix === 'c' ? cache['c:ptCount']?.val : cache.ptCount;
  assert.equal(String(count), String(pts.length), 'Declared chart cache count differs');
  return pts.map((point, index) => {
    assert.equal(String(point.idx), String(index), 'Chart cache point order differs');
    const value = prefix === 'c' ? string(point['c:v']) : string(point);
    return numeric ? number(value) : value;
  });
}
function classicSeries(series, book) {
  const output = { index: series['c:idx']?.val, order: series['c:order']?.val };
  for (const field of ['c:tx', 'c:cat', 'c:val', 'c:xVal', 'c:yVal', 'c:bubbleSize'])
    if (series[field]) {
      const item = series[field];
      let found = false;
      for (const [kind, numeric] of [
        ['c:strRef', false],
        ['c:numRef', true],
      ])
        if (item[kind]) {
          assert.equal(found, false, 'Conflicting chart cache alternatives');
          found = true;
          const ref = item[kind],
            formula = ref['c:f'],
            values = points(ref[numeric ? 'c:numCache' : 'c:strCache'], numeric, 'c');
          assert.equal(typeof formula, 'string');
          assert.deepEqual(values, rangeValues(formula, book), 'Chart cache/workbook mismatch');
          output[field] = { formula: formula.replace(/^'([^']+)'!/u, '$1!'), values };
        }
      if (!found) {
        assert.ok(item['c:v'] !== undefined, 'Unsupported literal chart data');
        output[field] = { value: string(item['c:v']) };
      }
    }
  assert.ok(
    output['c:tx'] && output['c:cat'] && output['c:val'],
    'Incomplete classic chart series',
  );
  return output;
}
function inspectChart(parts, file, uri, deps, tools, archiveContext, slideIndex) {
  const parsed = tools.object(file);
  if (uri === 'http://schemas.openxmlformats.org/drawingml/2006/chart') {
    const space = parsed['c:chartSpace'];
    assert.ok(space, 'Expected classic chart');
    const book = workbook(parts, file, space, space['c:externalData'], deps, tools),
      plot = space['c:chart']['c:plotArea'];
    const constructs = Object.keys(plot).filter((key) => key.endsWith('Chart'));
    if(archiveContext&&(constructs.length!==1||slideIndex===3))return inspectCurrentSignedPareto({parts,file,plot,book,deps,readSeries:classicSeries,context:archiveContext,slideIndex});
    assert.equal(constructs.length, 1, 'Mixed classic chart requires separate review');
    const construct = constructs[0],
      series = list(plot[construct]['c:ser']);
    assert.ok(series.length > 0 && series.length <= 20, 'Bounded nonempty series');
    return {
      family: 'classic',
      construct,
      series: series.map((s) => classicSeries(s, book)),
      workbook: book,
    };
  }
  assert.equal(
    uri,
    'http://schemas.microsoft.com/office/drawing/2014/chartex',
    'Unsupported graphicData URI',
  );
  const space = parsed['cx:chartSpace'];
  assert.ok(space, 'Expected native chartEx');
  const chartData = space['cx:chartData'],
    book = workbook(parts, file, space, chartData['cx:externalData'], deps, tools);
  const caches = list(chartData['cx:data']).map((data) => {
    const dimensions = [];
    for (const [field, numeric] of [
      ['cx:strDim', false],
      ['cx:numDim', true],
    ])
      for (const dim of list(data[field])) {
        const levels = list(dim['cx:lvl']);
        assert.equal(levels.length, 1, 'Native cache levels require separate review');
        const values = points(levels[0], numeric, 'cx');
        assert.equal(typeof dim['cx:f'], 'string');
        assert.deepEqual(values, rangeValues(dim['cx:f'], book), 'Native cache/workbook mismatch');
        dimensions.push({
          kind: field,
          type: dim.type,
          formula: dim['cx:f'].replace(/^'([^']+)'!/u, '$1!'),
          values,
        });
      }
    assert.ok(dimensions.length > 0, 'Native dimensions missing');
    return { id: String(data.id), dimensions };
  });
  assert.equal(
    new Set(caches.map((c) => c.id)).size,
    caches.length,
    'Duplicate native data identities',
  );
  const series = list(space['cx:chart']['cx:plotArea']['cx:plotAreaRegion']['cx:series']).map(
    (series, index) => {
      if (series['cx:dataId'] === undefined) {
        assert.equal(series.layoutId, 'paretoLine', 'Native data association missing');
        assert.equal(series['cx:tx'], undefined, 'Derived Pareto line must not carry another name');
        assert.match(series.ownerIdx, /^[0-9]+$/u);
        assert.ok(Number(series.ownerIdx) < index, 'Derived series owner must precede it');
        return { layoutId: series.layoutId, ownerIndex: Number(series.ownerIdx), derived: true };
      }
      const dataId = String(series['cx:dataId']?.val);
      assert.equal(
        caches.filter((c) => c.id === dataId).length,
        1,
        'Native series cache association missing',
      );
      const tx = series['cx:tx']?.['cx:txData'];
      assert.ok(tx && typeof tx['cx:f'] === 'string', 'Native series name formula missing');
      const values = rangeValues(tx['cx:f'], book);
      assert.deepEqual(values, [string(tx['cx:v'])], 'Native series name/workbook mismatch');
      return {
        layoutId: series.layoutId,
        dataId,
        name: values[0],
        nameFormula: tx['cx:f'].replace(/^'([^']+)'!/u, '$1!'),
      };
    },
  );
  assert.ok(series.length > 0 && series.length <= 20);
  return { family: 'chartEx', series, caches, workbook: book };
}

export function inspectSevenArchive(input, deps = archiveDependencies(), archiveContext) {
  const { parts, count, total } = boundedParts(input, deps),
    tools = xmlTools(parts, deps),
    presentation = tools.object('ppt/presentation.xml')['p:presentation'];
  const ids = list(presentation['p:sldIdLst']?.['p:sldId']);
  assert.equal(ids.length, 7, 'Exactly seven whole slides required');
  const relationship = tools.relationships('ppt/presentation.xml');
  const slideFiles = ids.map((id) => {
    const rel = relationship(id['r:id']);
    assert.ok(rel.Type.endsWith('/slide'));
    return rel.target;
  });
  assert.equal(new Set(slideFiles).size, 7, 'Duplicate slide relationships');
  const physical = Object.keys(parts).filter((name) =>
    /^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(name),
  );
  assert.deepEqual(
    [...physical].sort(),
    [...slideFiles].sort(),
    'Hidden/unreferenced or missing slide part',
  );
  let rawShapes = 0;
  const slides = slideFiles.map((file, index) => {
    const slide = child(tools.ordered(file), 'p:sld'),
      common = child(slide?.['p:sld'], 'p:cSld'),
      shapeTree = child(common?.['p:cSld'], 'p:spTree'),
      tree = shapeTree?.['p:spTree'],
      treeScope = [slide, common, shapeTree].reduce(namespaceScope, new Map());
    assert.ok(tree, 'Missing source shape tree');
    const rels = tools.relationships(file),
      shapes = [];
    let alternateCount = 0;
    function shape(node, branch) {
      const kind = tag(node);
      assert.ok(['p:sp', 'p:graphicFrame'].includes(kind), 'Unsupported seven drawable');
      const children = node[kind],
        nv = children.find((n) => /^p:nv.+Pr$/u.test(tag(n) ?? '')),
        named = child(nv?.[tag(nv)], 'p:cNvPr'),
        identity = attrs(named);
      assert.match(identity.id, /^[1-9][0-9]*$/u);
      assert.equal(typeof identity.name, 'string');
      assert.ok(identity.name.length);
      const transform =
        child(children, 'p:xfrm') ?? child(child(children, 'p:spPr')?.['p:spPr'], 'a:xfrm');
      assert.ok(transform, 'Missing drawable geometry');
      const x = transform[tag(transform)],
        off = attrs(child(x, 'a:off')),
        ext = attrs(child(x, 'a:ext'));
      const geometry = {
        left: Number(off.x) / 12700,
        top: Number(off.y) / 12700,
        width: Number(ext.cx) / 12700,
        height: Number(ext.cy) / 12700,
        rotation: Number(attrs(transform).rot ?? 0) / 60000,
      };
      assert.ok(Object.values(geometry).every(Number.isFinite), 'Invalid source geometry');
      const record = { id: Number(identity.id), name: identity.name, branch, geometry };
      if (kind === 'p:sp') {
        assert.equal(branch, 'direct', 'Title cannot be alternate content');
        const paragraphs = all(child(children, 'p:txBody')?.['p:txBody'], 'a:p');
        record.kind = 'title';
        record.text = paragraphs.map((p) => text(p['a:p'])).join('\n');
      } else {
        const graphic = child(children, 'a:graphic'),
          data = child(graphic?.['a:graphic'], 'a:graphicData'),
          uri = attrs(data).uri,
          content = elements(data?.['a:graphicData']);
        assert.equal(content?.length, 1, 'Exactly one chart relationship per frame');
        const chart = content[0],
          rid = attrs(chart)['r:id'],
          rel = rels(rid);
        assert.ok(
          uri.endsWith('/chartex') ? rel.Type.endsWith('/chartEx') : rel.Type.endsWith('/chart'),
          'Chart relationship type mismatch',
        );
        record.kind = 'chart';
        record.uri = uri;
        record.chartPart = rel.target;
        record.chart = inspectChart(parts, rel.target, uri, deps, tools, archiveContext,index+1);
      }
      shapes.push(record);
    }
    for (const node of elements(tree)) {
      const kind = tag(node);
      if (['p:nvGrpSpPr', 'p:grpSpPr'].includes(kind)) continue;
      if (kind === 'mc:AlternateContent') {
        assert.equal(++alternateCount, 1, 'One chart alternate group per slide');
        const content = elements(node[kind]),
          choice = child(content, 'mc:Choice'),
          fallback = child(content, 'mc:Fallback');
        assert.equal(content.length, 2, 'Unexpected AlternateContent branches');
        const feature = attrs(choice).Requires;
        assert.ok(['cx1', 'cx2'].includes(feature), 'Unsupported AlternateContent feature');
        assert.equal(
          namespaceScope(namespaceScope(treeScope, node), choice).get(feature),
          feature === 'cx1'
            ? 'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex'
            : 'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex',
        );
        assert.equal(elements(choice['mc:Choice']).length, 1);
        assert.equal(elements(fallback?.['mc:Fallback']).length, 1);
        shape(elements(choice['mc:Choice'])[0], 'choice');
        shape(elements(fallback['mc:Fallback'])[0], 'fallback');
      } else shape(node, 'direct');
    }
    assert.ok(shapes.length >= 2 && shapes.length <= 3, 'Seven per-slide raw cap');
    assert.equal(
      new Set(shapes.map((s) => s.id)).size,
      shapes.length,
      'Duplicate source nonvisual IDs',
    );
    const titles = shapes.filter((s) => s.kind === 'title'),
      charts = shapes.filter((s) => s.kind === 'chart');
    assert.equal(titles.length, 1, 'One title required');
    assert.equal(charts.length, alternateCount ? 2 : 1, 'One logical chart required');
    assert.equal(new Set(charts.map((c) => c.name)).size, 1, 'Alternate chart identities differ');
    assert.notEqual(titles[0].name, charts[0].name);
    rawShapes += shapes.length;
    return { index: index + 1, part: file, shapes, logicalShapes: 2 };
  });
  assert.ok(rawShapes <= 20, 'Seven total raw cap');
  return {
    slideCount: 7,
    rawShapes,
    logicalShapes: 14,
    zipEntries: count,
    expandedBytes: total,
    slides,
  };
}

// Native shape IDs identify one source branch; a shared chart name alone never does.
export function bindSevenPhase(archive, phase) {
  assert.equal(phase.slideCount, 7);
  assert.equal(phase.slides.length, 7);
  assert.equal(phase.rasters.length, 7);
  let total = 0;
  const bindings = archive.slides.map((source, index) => {
    const slide = phase.slides[index];
    assert.equal(slide.index, index + 1);
    assert.equal(slide.shapeCount, 2, 'Exactly one title and one chart must be exposed');
    assert.equal(slide.shapes.length, 2);
    total += slide.shapes.length;
    const used = new Set();
    const shapes = slide.shapes.map((actual, position) => {
      assert.equal(actual.index, position + 1);
      const matches = source.shapes.filter(
        (expected) => expected.id === actual.id && expected.name === actual.name,
      );
      assert.equal(matches.length, 1, 'Unresolved native shape ID/name branch');
      const expected = matches[0];
      assert.ok(!used.has(expected.kind), 'Duplicate native logical shape');
      used.add(expected.kind);
      for (const field of ['id', 'type', 'left', 'top', 'width', 'height', 'rotation'])
        assert.ok(
          typeof actual[field] === 'number' && Number.isFinite(actual[field]),
          'Invalid native descriptor ' + field,
        );
      assert.ok([-1, 0].includes(actual.hasTextFrame));
      assert.ok(actual.text === null || typeof actual.text === 'string');
      if (expected.kind === 'title')
        assert.equal(
          (actual.text ?? '').replace(/\r\n?|\v/gu, '\n').replace(/\n$/u, ''),
          expected.text,
          'Native title words differ',
        );
      assert.equal(typeof actual.alternativeText, 'string');
      return {
        kind: expected.kind,
        id: actual.id,
        name: actual.name,
        branch: expected.branch,
        type: actual.type,
        geometry: {
          left: actual.left,
          top: actual.top,
          width: actual.width,
          height: actual.height,
          rotation: actual.rotation,
        },
        sourceGeometry: expected.geometry,
        ...(expected.kind === 'chart'
          ? { uri: expected.uri, chart: expected.chart, chartPart: expected.chartPart }
          : { text: expected.text }),
      };
    });
    assert.equal(used.size, 2);
    return { index: index + 1, slideId: slide.slideId, name: slide.name, shapes };
  });
  assert.ok(total <= 20);
  return bindings;
}
