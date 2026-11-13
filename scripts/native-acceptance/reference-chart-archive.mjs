// Dedicated reference witnesses. Bounded ZIP/XML/workbook primitives copied from reviewed seven-chart-archive; no Office calls.
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

export function archiveDependencies() {
  const local = createRequire(import.meta.url),
    peer = createRequire(local.resolve("@openpresentation/opf-pptx/package.json"));
  return { ...peer("fflate"), ...peer("fast-xml-parser") };
}
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const tag = (node) => Object.keys(node).find((key) => key !== ":@" && key !== "#text");
const child = (nodes, name) => nodes?.find((node) => Object.hasOwn(node, name));
const attrs = (node) =>
  Object.fromEntries(
    Object.entries(node?.[":@"] ?? {}).map(([key, value]) => [key.slice(2), value]),
  );
const all = (nodes, name) => nodes?.filter((node) => Object.hasOwn(node, name)) ?? [];
const elements = (nodes) => nodes?.filter((node) => tag(node)) ?? [];
const text = (nodes) =>
  nodes
    .map((node) =>
      tag(node) === "a:t"
        ? node["a:t"].map((n) => String(n["#text"] ?? "")).join("")
        : tag(node) === "a:br"
          ? "\n"
          : tag(node) === "a:tab"
            ? "\t"
            : Array.isArray(node[tag(node)])
              ? text(node[tag(node)])
              : "",
    )
    .join("");
const string = (value) =>
  typeof value === "object" ? String(value?.["#text"] ?? "") : String(value ?? "");
const number = (value) => {
  assert.ok(
    typeof value === "string" && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value),
    "Invalid numeric chart cache",
  );
  const result = Number(value);
  assert.ok(Number.isFinite(result), "Nonfinite chart cache");
  return result;
};

function portable(name) {
  assert.ok(
    name &&
      !name.startsWith("/") &&
      !/[\\:]/u.test(name) &&
      ![...name].some((c) => c.charCodeAt(0) < 32) &&
      !name.split("/").some((part) => !part || part === "." || part === ".."),
    "Unsafe ZIP part",
  );
  return name;
}
function boundedParts(input, deps) {
  assert.ok(
    input.length > 0 && input.length <= 16 * 1024 * 1024,
    "Reference input must be at most16MiB",
  );
  let count = 0,
    total = 0;
  const seen = new Set();
  const parts = deps.unzipSync(input, {
    filter(entry) {
      portable(entry.name.replace(/\/$/u, ""));
      assert.ok(!seen.has(entry.name.toLowerCase()), "Duplicate ZIP part");
      seen.add(entry.name.toLowerCase());
      assert.ok(++count <= 4096, "Reference ZIP exceeds4096 entries");
      assert.ok(entry.originalSize <= 8 * 1024 * 1024, "ZIP entry expansion bound");
      total += entry.originalSize;
      assert.ok(total <= 64 * 1024 * 1024, "ZIP aggregate expansion bound");
      return true;
    },
  });
  return { parts, count, total };
}
function xmlTools(parts, deps) {
  const objectParser = new deps.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
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
    assert.ok(parts[file], "Missing XML part " + file);
    const value = deps.strFromU8(parts[file]);
    assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(value), "XML declarations refused");
    assert.equal(deps.XMLValidator.validate(value), true, "Invalid XML part " + file);
    return value;
  }
  function relationships(file) {
    const relFile = path.posix.join(
      path.posix.dirname(file),
      "_rels",
      path.posix.basename(file) + ".rels",
    );
    const rels = list(objectParser.parse(xml(relFile)).Relationships.Relationship);
    assert.equal(new Set(rels.map((rel) => rel.Id)).size, rels.length, "Duplicate relationships");
    return (id) => {
      const found = rels.filter((rel) => rel.Id === id);
      assert.equal(found.length, 1, "Missing/duplicate relationship " + id);
      const rel = found[0];
      assert.equal(rel.TargetMode, undefined, "External relationship refused");
      assert.equal(typeof rel.Target, "string");
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), rel.Target));
      portable(target);
      assert.ok(parts[target], "Missing relationship target");
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
  const rel = tools.relationships(chartFile)(external["r:id"]);
  assert.ok(rel.Type.endsWith("/package"), "Expected internal workbook relationship");
  const nested = boundedParts(parts[rel.target], deps).parts,
    t = xmlTools(nested, deps),
    book = t.object("xl/workbook.xml").workbook;
  const sheets = list(book.sheets.sheet);
  assert.equal(sheets.length, 1, "Bounded chart workbook requires one worksheet");
  const sheet = sheets[0],
    target = t.relationships("xl/workbook.xml")(sheet["r:id"]);
  assert.ok(target.Type.endsWith("/worksheet"));
  const strings = nested["xl/sharedStrings.xml"]
    ? list(t.object("xl/sharedStrings.xml").sst.si).map((si) =>
        si.t !== undefined
          ? string(si.t)
          : list(si.r)
              .map((r) => string(r.t))
              .join(""),
      )
    : [];
  const cells = [],
    seen = new Set();
  for (const row of list(t.object(target.target).worksheet.sheetData.row))
    for (const cell of list(row.c)) {
      assert.match(cell.r, /^[A-Z]+[1-9][0-9]*$/u);
      assert.ok(!seen.has(cell.r), "Duplicate workbook cell");
      seen.add(cell.r);
      let value;
      if (cell.t === "s") {
        const index = Number(cell.v);
        assert.ok(Number.isSafeInteger(index) && index >= 0 && index < strings.length);
        value = strings[index];
      } else if (cell.t === "inlineStr")
        value =
          cell.is.t !== undefined
            ? string(cell.is.t)
            : list(cell.is.r)
                .map((r) => string(r.t))
                .join("");
      else if (cell.t === "str") value = string(cell.v);
      else {
        assert.ok(cell.t === undefined || cell.t === "n", "Unsupported workbook cell type");
        value = number(string(cell.v));
      }
      assert.equal(cell.f, undefined, "Chart workbook formula cells require separate review");
      cells.push({
        cell: cell.r,
        value,
        ...(cell.s === undefined ? {} : { style: String(cell.s) }),
      });
    }
  return {
    part: rel.target,
    sheet: sheet.name,
    cells,
    styles: nested["xl/styles.xml"] ? t.object("xl/styles.xml").styleSheet : null,
  };
}
function rangeValues(formula, book) {
  assert.ok(book, "Referenced chart data requires embedded workbook");
  const match =
    /^(?:'([^']+)'|([^'!]+))!\$([A-Z]+)\$([1-9][0-9]*)(?::\$([A-Z]+)\$([1-9][0-9]*))?$/u.exec(
      formula,
    );
  assert.ok(match, "Unsupported chart formula " + formula);
  assert.equal(match[1] ?? match[2], book.sheet, "Chart formula references wrong sheet");
  assert.ok(!match[5] || match[5] === match[3], "Only single-column chart ranges are supported");
  const first = Number(match[4]),
    last = Number(match[6] ?? match[4]);
  assert.ok(last >= first && last - first < 10000, "Bounded chart range");
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const found = book.cells.filter((cell) => cell.cell === match[3] + (first + i));
    assert.equal(found.length, 1, "Missing referenced workbook cell");
    return found[0].value;
  });
}
function points(cache, numeric, prefix) {
  assert.ok(cache, "Missing " + prefix + " cache");
  const pts = list(cache[prefix + ":pt"]),
    count = prefix === "c" ? cache["c:ptCount"]?.val : cache.ptCount;
  assert.equal(String(count), String(pts.length), "Declared chart cache count differs");
  return pts.map((point, index) => {
    assert.equal(String(point.idx), String(index), "Chart cache point order differs");
    const value = prefix === "c" ? string(point["c:v"]) : string(point);
    return numeric ? number(value) : value;
  });
}
function classicSeries(series, book) {
  const output = { index: series["c:idx"]?.val, order: series["c:order"]?.val };
  for (const field of ["c:tx", "c:cat", "c:val", "c:xVal", "c:yVal", "c:bubbleSize"])
    if (series[field]) {
      const item = series[field];
      let found = false;
      for (const [kind, numeric] of [
        ["c:strRef", false],
        ["c:numRef", true],
      ])
        if (item[kind]) {
          assert.equal(found, false, "Conflicting chart cache alternatives");
          found = true;
          const ref = item[kind],
            formula = ref["c:f"],
            values = points(ref[numeric ? "c:numCache" : "c:strCache"], numeric, "c");
          assert.equal(typeof formula, "string");
          assert.deepEqual(values, rangeValues(formula, book), "Chart cache/workbook mismatch");
          output[field] = { formula: formula.replace(/^'([^']+)'!/u, "$1!"), values };
        }
      if (!found) {
        assert.ok(item["c:v"] !== undefined, "Unsupported literal chart data");
        output[field] = { value: string(item["c:v"]) };
      }
    }
  assert.ok(
    output["c:tx"] && output["c:cat"] && output["c:val"],
    "Incomplete classic chart series",
  );
  return output;
}

const REFERENCE_URI = "urn:openpresentation:chart-references:v1";
function ownership(node, name) {
  const found = list(node?.["c:extLst"]?.["c:ext"]).filter(
    (e) => e.uri === REFERENCE_URI && e["opf:" + name],
  );
  if (!found.length) return null;
  assert.equal(found.length, 1, "Ambiguous reference ownership");
  const hex = found[0]["opf:" + name].data;
  assert.ok(
    typeof hex === "string" && hex.length <= 4 * 1024 * 1024 && /^(?:[0-9A-Fa-f]{2})+$/u.test(hex),
    "Invalid reference identity encoding",
  );
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(hex, "hex")),
  );
  assert.equal(value.v, 1, "Unsupported reference identity version");
  return value;
}
function inspectChart(parts, file, uri, deps, tools) {
  assert.equal(
    uri,
    "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "Reference witnesses require standard editable charts, never ChartEx/alternate content",
  );
  const space = tools.object(file)["c:chartSpace"];
  assert.ok(space, "Expected classic chart");
  const book = workbook(parts, file, space, space["c:externalData"], deps, tools),
    plot = space["c:chart"]?.["c:plotArea"];
  assert.ok(plot, "Missing chart plot");
  const constructs = Object.keys(plot).filter((k) => k.endsWith("Chart"));
  assert.ok(constructs.length >= 1 && constructs.length <= 3, "Bounded reference chart groups");
  const groups = constructs.flatMap((construct) =>
    list(plot[construct]).map((node) => {
      assert.ok(
        ["c:barChart", "c:lineChart", "c:areaChart"].includes(construct),
        "Unsupported reference chart group",
      );
      const series = list(node["c:ser"]);
      assert.ok(series.length >= 1 && series.length <= 6, "Bounded reference series");
      return {
        construct,
        grouping: node["c:grouping"]?.val ?? null,
        direction: node["c:barDir"]?.val ?? null,
        axes: list(node["c:axId"]).map((a) => String(a.val)),
        series: series.map((ser) => ({
          ...classicSeries(ser, book),
          owner: ownership(ser, "reference"),
          paint: ser["c:spPr"] ?? null,
          marker: ser["c:marker"] ?? null,
          labels: ser["c:dLbls"] ?? null,
        })),
      };
    }),
  );
  const owner = ownership(space, "references"),
    helpers = groups.flatMap((g) => g.series).filter((s) => s.owner);
  if (owner) {
    assert.equal(typeof owner.key, "string");
    assert.ok(Array.isArray(owner.helpers) && Array.isArray(owner.overlays));
    assert.ok(
      owner.helpers.length + owner.overlays.length <= 2,
      "Witness has at most two explicit references",
    );
    const ids = [...owner.helpers, ...owner.overlays].map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, "Duplicate reference ownership");
    assert.deepEqual(
      helpers.map((h) => h.owner.id).sort(),
      owner.helpers.map((h) => h.id).sort(),
      "Helper ownership differs from chart record",
    );
    for (const h of helpers) {
      const values = h["c:val"].values;
      assert.ok(
        values.length && values.every((v) => v === values[0]),
        "Reference helper is not constant",
      );
      assert.equal(
        h.marker?.["c:symbol"]?.val,
        "none",
        "Reference helper must have no data markers",
      );
      assert.ok(
        ["solid", "dash", "dot"].includes(h.paint?.["a:ln"]?.["a:prstDash"]?.val),
        "Explicit helper stroke missing",
      );
    }
  } else assert.equal(helpers.length, 0, "Unbound helper identity");
  const axes = ["c:catAx", "c:valAx"].flatMap((kind) =>
    list(plot[kind]).map((a) => ({
      kind,
      id: String(a["c:axId"]?.val),
      cross: String(a["c:crossAx"]?.val),
      scaling: a["c:scaling"] ?? null,
      format: a["c:numFmt"] ?? null,
      major: a["c:majorUnit"] ?? null,
      // Placement is part of reference geometry even when the outer chart frame is unchanged.
      placement: Object.fromEntries(["c:axPos", "c:crosses", "c:crossesAt", "c:crossBetween", "c:tickLblPos", "c:lblAlgn", "c:lblOffset", "c:tickLblSkip", "c:tickMarkSkip", "c:noMultiLvlLbl", "c:delete", "c:title", "c:txPr"].map(name => [name, a[name] ?? null])),
    })),
  );
  assert.equal(new Set(axes.map((a) => a.id)).size, axes.length, "Duplicate chart axes");
  for (const group of groups)
    for (const id of group.axes)
      assert.ok(
        axes.some((a) => a.id === id),
        "Unbound group axis",
      );
  for (const a of axes)
    for (const field of ["c:min", "c:max"])
      if (a.scaling?.[field]) number(String(a.scaling[field].val));
  return { family: "classic", layout: plot["c:layout"] ?? null, groups, axes, ownership: owner, workbook: book };
}
function inspectReferenceWhole(input, expectedSlides, deps) {
  const { parts, count, total } = boundedParts(input, deps),
    tools = xmlTools(parts, deps),
    presentation = tools.object("ppt/presentation.xml")["p:presentation"];
  const ids = list(presentation["p:sldIdLst"]?.["p:sldId"]);
  assert.equal(ids.length, expectedSlides, "Exactly the closed whole witness slide count required");
  const relationship = tools.relationships("ppt/presentation.xml");
  const files = ids.map((id) => {
    const rel = relationship(id["r:id"]);
    assert.ok(rel.Type.endsWith("/slide"));
    return rel.target;
  });
  assert.equal(new Set(files).size, expectedSlides, "Duplicate slide relationships");
  assert.deepEqual(
    Object.keys(parts)
      .filter((n) => /^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(n))
      .sort(),
    [...files].sort(),
    "Unreferenced/missing slides refused",
  );
  let rawShapes = 0;
  const slides = files.map((file, index) => {
    const root = child(tools.ordered(file), "p:sld"),
      common = child(root?.["p:sld"], "p:cSld"),
      tree = child(common?.["p:cSld"], "p:spTree")?.["p:spTree"];
    assert.ok(tree, "Missing source shape tree");
    const rels = tools.relationships(file),
      shapes = [];
    for (const node of elements(tree)) {
      const kind = tag(node);
      if (["p:nvGrpSpPr", "p:grpSpPr"].includes(kind)) continue;
      assert.ok(
        ["p:sp", "p:graphicFrame"].includes(kind),
        "No groups, pictures, alternate branches or other drawables in reference witnesses",
      );
      const nodes = node[kind],
        nv = nodes.find((n) => /^p:nv.+Pr$/u.test(tag(n) ?? "")),
        named = child(nv?.[tag(nv)], "p:cNvPr"),
        identity = attrs(named);
      assert.match(identity.id, /^[1-9][0-9]*$/u);
      assert.ok(typeof identity.name === "string" && identity.name.length);
      const transform =
        child(nodes, "p:xfrm") ?? child(child(nodes, "p:spPr")?.["p:spPr"], "a:xfrm");
      assert.ok(transform, "Missing drawable geometry");
      const transformNodes = transform[tag(transform)],
        off = attrs(child(transformNodes, "a:off")),
        ext = attrs(child(transformNodes, "a:ext"));
      const geometry = {
        left: Number(off.x) / 12700,
        top: Number(off.y) / 12700,
        width: Number(ext.cx) / 12700,
        height: Number(ext.cy) / 12700,
        rotation: Number(attrs(transform).rot ?? 0) / 60000,
      };
      assert.ok(Object.values(geometry).every(Number.isFinite), "Invalid source geometry");
      const record = { id: Number(identity.id), name: identity.name, branch: "direct", geometry };
      if (kind === "p:graphicFrame") {
        const graphic = child(nodes, "a:graphic"),
          data = child(graphic?.["a:graphic"], "a:graphicData"),
          content = elements(data?.["a:graphicData"]);
        assert.equal(content.length, 1, "Exactly one chart relationship");
        const rel = rels(attrs(content[0])["r:id"]);
        assert.ok(rel.Type.endsWith("/chart"));
        record.kind = "chart";
        record.uri = attrs(data).uri;
        record.chartPart = rel.target;
        record.chart = inspectChart(parts, rel.target, record.uri, deps, tools);
      } else {
        const body = child(nodes, "p:txBody"),
          paragraphs = all(body?.["p:txBody"], "a:p");
        record.kind = body ? "text" : "line";
        record.text = body ? paragraphs.map((p) => text(p["a:p"])).join("\n") : null;
        record.paint = child(nodes, "p:spPr") ?? null;
      }
      shapes.push(record);
    }
    assert.ok(
      shapes.length >= 1 && shapes.length <= 3,
      "Reference raw shape cap is three, never widened",
    );
    assert.equal(
      new Set(shapes.map((s) => s.id)).size,
      shapes.length,
      "Duplicate source nonvisual IDs",
    );
    assert.equal(
      shapes.filter((s) => s.kind === "chart").length,
      1,
      "One complete logical chart per slide",
    );
    rawShapes += shapes.length;
    return { index: index + 1, part: file, shapes, logicalShapes: shapes.length };
  });
  assert.ok(rawShapes <= expectedSlides * 3, "Reference total raw shape cap");
  const size = presentation["p:sldSz"];
  assert.ok(size && Number.isFinite(Number(size.cx)) && Number.isFinite(Number(size.cy)));
  return {
    slideCount: expectedSlides,
    canvas: { cx: Number(size.cx), cy: Number(size.cy) },
    rawShapes,
    logicalShapes: rawShapes,
    zipEntries: count,
    expandedBytes: total,
    slides,
  };
}
// The one-slide entry is PURE title-invariance inspection only; the physical profile always calls the fixed three-slide entry.
export const inspectReferenceArchive = (input, deps = archiveDependencies()) =>
  inspectReferenceWhole(input, 3, deps);
export const inspectReferenceTitlePair = (input, deps = archiveDependencies()) =>
  inspectReferenceWhole(input, 1, deps);

// Explicit-current evidence only. The legacy archive model above is unchanged.
// These four witnesses use literal opaque paints or this one minimal/light1 neutral.
export function inspectCurrentReferenceStrokes(input, source, deps = archiveDependencies()) {
  const archive = inspectReferenceArchive(input, deps), { parts } = boundedParts(input, deps),
    tools = xmlTools(parts, deps), styles = new Set(), evidence = [],
    sha = bytes => createHash('sha256').update(bytes).digest('hex'),
    relationshipType = kind => 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + kind;
  assert.equal(source.slides.length, 3);
  const rels = file => {
    const name = path.posix.join(path.posix.dirname(file), '_rels', path.posix.basename(file) + '.rels');
    const rows = parts[name] ? list(tools.object(name).Relationships.Relationship) : [];
    assert.ok(!rows.some(row => row.Type === relationshipType('themeOverride')), 'Current paint refuses theme overrides');
    return rows;
  };
  const related = (file, kind) => {
    const matches = rels(file).filter(row => row.Type === relationshipType(kind));
    assert.equal(matches.length, 1, 'One actual current paint ' + kind + ' relationship required');
    return tools.relationships(file)(matches[0].Id).target;
  };
  const neutralContext = slide => {
    const layout = related(slide, 'slideLayout'), master = related(layout, 'slideMaster'), theme = related(master, 'theme');
    for (const file of [slide,layout]) assert.ok(!rels(file).some(row => row.Type === relationshipType('theme')), 'Current neutral refuses a direct slide/layout theme');
    assert.deepEqual(tools.object(slide)['p:sld']['p:clrMapOvr'], {'a:masterClrMapping': ''}, 'Current slide must inherit the master color map');
    assert.deepEqual(tools.object(layout)['p:sldLayout']['p:clrMapOvr'], {'a:masterClrMapping': ''}, 'Current layout must inherit the master color map');
    assert.deepEqual(tools.object(master)['p:sldMaster']['p:clrMap'], {bg1:'lt1',tx1:'dk1',bg2:'lt2',tx2:'dk2',accent1:'accent1',accent2:'accent2',accent3:'accent3',accent4:'accent4',accent5:'accent5',accent6:'accent6',hlink:'hlink',folHlink:'folHlink'}, 'Current neutral requires the exact actual master mapping');
    assert.deepEqual(tools.object(theme)['a:theme']['a:themeElements']['a:clrScheme']['a:dk1'], {'a:srgbClr': {val:'000000'}}, 'Current neutral requires actual theme dk1 black');
    rels(theme);
    return [slide,layout,master,theme].map(file => ({path:file,bytes:parts[file].length,sha256:sha(parts[file])}));
  };
  archive.slides.forEach((slide, index) => {
    const chart = slide.shapes.find(shape => shape.kind === 'chart'), refs = source.slides[index].chart.referenceLines ?? [];
    assert.ok(!rels(chart.chartPart).some(row => row.Type === relationshipType('theme')), 'Current helper refuses a direct chart theme');
    assert.equal(tools.object(chart.chartPart)['c:chartSpace']['c:clrMapOvr'], undefined, 'Current helper refuses a chart color-map override');
    for (const owned of chart.chart.ownership?.helpers ?? []) {
      assert.ok(Number.isSafeInteger(owned.index) && owned.index >= 0 && owned.index < refs.length, 'Current helper index must name an authored reference');
      const ref = refs[owned.index], present = Object.hasOwn(ref, 'stroke'), key = (index + 1) + '|' + owned.index;
      assert.equal(styles.has(key), false, 'Duplicate current reference index');
      // RR-105 (2026-11-12): a labeled reference also records where its label was placed (the point index) and the end the author chose,
      // so the import returns the authored labelPosition after the export moved a label off a mark.
      const labeled = ref.label !== undefined;
      assert.deepEqual(Object.keys(owned).sort(), ['id','index','written',...(present ? ['stroke'] : []),...(labeled ? ['labelAt','labelPosition'] : [])].sort(), 'Exact current authored Line record required');
      if (labeled) {
        assert.ok(Number.isSafeInteger(owned.labelAt) && owned.labelAt >= 0, 'Current label point must be a point index');
        assert.ok(['start','end'].includes(owned.labelPosition), 'Current label end must be start or end');
        if (ref.labelPosition !== undefined) assert.equal(owned.labelPosition, ref.labelPosition, 'Current metadata must contain the authored label end');
      }
      assert.equal(owned.id, chart.chart.ownership.key + ':' + owned.index);
      assert.equal(Object.hasOwn(owned, 'stroke'), present, 'Authored stroke absence is significant');
      assert.deepEqual(owned.stroke, ref.stroke, 'Current metadata must contain this exact authored Line');
      const helpers = chart.chart.groups.flatMap(group => group.series).filter(series => series.owner?.id === owned.id);
      assert.equal(helpers.length, 1, 'One exact current helper owner required');
      assert.deepEqual(helpers[0].owner, {v:1,id:owned.id});
      assert.deepEqual(Object.keys(helpers[0].paint ?? {}), ['a:ln'], 'Current helper refuses additional paint');
      const line = helpers[0].paint['a:ln'];
      assert.deepEqual(Object.keys(line).sort(), ['a:prstDash','a:solidFill','cap','w'].sort());
      assert.equal(line.cap, 'flat');
      assert.deepEqual(Object.keys(line['a:prstDash']), ['val']);
      const fill = line['a:solidFill'];
      let color, context;
      if (Object.hasOwn(fill, 'a:srgbClr')) {
        assert.deepEqual(Object.keys(fill), ['a:srgbClr']);
        assert.deepEqual(Object.keys(fill['a:srgbClr']), ['val']);
        assert.match(fill['a:srgbClr'].val, /^[0-9A-Fa-f]{6}$/u);
        color = fill['a:srgbClr'].val.toUpperCase();
      } else {
        assert.deepEqual(Object.keys(fill), ['a:schemeClr']);
        const scheme = fill['a:schemeClr'];
        assert.deepEqual(Object.keys(scheme).filter(key => key.startsWith('a:')), ['a:lumMod','a:lumOff'], 'Current neutral transform order is fixed');
        assert.deepEqual(scheme, {'a:lumMod':{val:'65000'},'a:lumOff':{val:'35000'},val:'tx1'}, 'Only the observed neutral transform is admitted');
        context = neutralContext(slide.part);
        // Black remains black under lumMod; lumOff .35 yields round(255*.35)=89.
        color = '595959';
      }
      const authoredColor = ref.stroke?.color;
      if (authoredColor === undefined) context ??= neutralContext(slide.part);
      else assert.match(authoredColor, /^#[0-9A-Fa-f]{6}$/u, 'Closed witnesses use literal opaque colors');
      const expectedColor = authoredColor === undefined ? '595959' : authoredColor.slice(1).toUpperCase(),
        scale = Math.min(archive.canvas.cx, archive.canvas.cy) / 6858000,
        expectedWidth = Math.round(((ref.stroke?.width ?? 4 / 3) * scale) * 9525),
        expectedDash = ref.stroke?.dash ?? 'dash', written = `${Number(line.w)}|${color}|255|${line['a:prstDash'].val}`;
      assert.equal(color, expectedColor, 'Current paint color differs from the closed source');
      assert.equal(Number(line.w), expectedWidth, 'Current paint width differs from the authored source');
      assert.equal(line['a:prstDash'].val, expectedDash);
      assert.equal(owned.written, written, 'Current native paint must exactly match its authored-Line written binding');
      styles.add(key);evidence.push({slide:index+1,reference:owned.index,id:owned.id,written,strokePresent:present,...(present?{stroke:structuredClone(ref.stroke)}:{}),...(context?{neutralContext:context}:{})});
    }
  });
  return {archive,styles,evidence,archiveSha256:sha(input)};
}
export function bindReferenceWitnessPhase(archive, phase) {
  assert.equal(phase.slideCount, 3);
  assert.equal(phase.slides.length, 3);
  assert.equal(phase.rasters.length, 3);
  let total = 0;
  const bindings = archive.slides.map((source, index) => {
    const slide = phase.slides[index];
    assert.equal(slide.index, index + 1);
    assert.equal(
      slide.shapeCount,
      source.shapes.length,
      "Native shape count must exactly match complete source",
    );
    assert.equal(slide.shapes.length, source.shapes.length);
    total += slide.shapes.length;
    const used = new Set();
    const shapes = slide.shapes.map((actual, position) => {
      assert.equal(actual.index, position + 1);
      const matches = source.shapes.filter(
        (expected) => expected.id === actual.id && expected.name === actual.name,
      );
      assert.equal(matches.length, 1, "Native shape ID/name binding is missing or ambiguous");
      const expected = matches[0];
      assert.ok(!used.has(expected.id), "Duplicate native source ID");
      used.add(expected.id);
      for (const field of ["id", "type", "left", "top", "width", "height", "rotation"])
        assert.ok(
          typeof actual[field] === "number" && Number.isFinite(actual[field]),
          "Invalid native primitive " + field,
        );
      assert.ok([-1, 0].includes(actual.hasTextFrame));
      assert.ok(actual.text === null || typeof actual.text === "string");
      assert.equal(typeof actual.alternativeText, "string");
      if (expected.kind === "text")
        assert.equal(
          (actual.text ?? "").replace(/\r\n?|\v/gu, "\n").replace(/\n$/u, ""),
          expected.text,
          "Native text words differ",
        );
      return {
        ...expected,
        type: actual.type,
        sourceGeometry: expected.geometry,
        geometry: {
          left: actual.left,
          top: actual.top,
          width: actual.width,
          height: actual.height,
          rotation: actual.rotation,
        },
      };
    });
    assert.equal(used.size, source.shapes.length);
    return { index: index + 1, slideId: slide.slideId, name: slide.name, shapes };
  });
  assert.ok(total <= 9);
  return bindings;
}
