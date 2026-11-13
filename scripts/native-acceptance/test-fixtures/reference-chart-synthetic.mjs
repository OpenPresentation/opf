// Deliberately synthetic XML/packages for pure controller tests; never renderer or Office evidence.
import assert from "node:assert/strict";
import { archiveDependencies } from "../reference-chart-archive.mjs";
import { REFERENCE_CASES } from "../reference-chart-profile.mjs";
import { readReferenceSources } from "../reference-chart-fixtures.mjs";
import { digest } from "../identity.mjs";
const deps = archiveDependencies(),
  sources = readReferenceSources();
const esc = (v) =>
  String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const own = (value) => Buffer.from(JSON.stringify(value)).toString("hex").toUpperCase();
const refURI = "urn:openpresentation:chart-references:v1",
  uri = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const ext = (name, value) =>
  `<c:extLst><c:ext uri="${refURI}"><opf:${name} data="${own(value)}"/></c:ext></c:extLst>`;
const range = (col, n, start = 2) =>
  `Sheet1!$${col}$${start}${n === 1 ? "" : `:$${col}$${start + n - 1}`}`;
const cache = (values, numeric) =>
  `<c:${numeric ? "numCache" : "strCache"}><c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("")}</c:${numeric ? "numCache" : "strCache"}>`;
function syntheticCase(source) {
  const entries = {},
    put = (p, s) => (entries[p] = deps.strToU8(s)),
    relationship = (id, target, type) =>
      `<Relationship Id="${id}" Target="${target}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}"/>`;
  const rels = (items) => `<Relationships>${items.join("")}</Relationships>`;
  put(
    "ppt/presentation.xml",
    `<p:presentation><p:sldIdLst>${source.document.slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="r${i + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
  );
  put(
    "ppt/_rels/presentation.xml.rels",
    rels(
      source.document.slides.map((_, i) =>
        relationship(`r${i + 1}`, `slides/slide${i + 1}.xml`, "slide"),
      ),
    ),
  );
  source.document.slides.forEach((slide, index) => {
    const num = index + 1,
      chart = slide.chart,
      columns = chart.data.columns.map((c) => (typeof c === "string" ? c : c.name)),
      rows = chart.data.rows,
      refs = chart.referenceLines ?? [],
      native = chart.type !== "bar" && rows.length >= 2,
      key = `synthetic-${index}`,
      helpers = [],
      overlays = [];
    const data = columns
      .slice(1)
      .map((name, j) => ({
        name,
        values: rows.map((r) => r[j + 1]),
        column: String.fromCharCode(66 + j),
        helper: null,
        axis: chart.secondaryAxis?.includes(name) ? "secondary" : "value",
        kind:
          chart.type === "combo"
            ? chart.line?.includes(name)
              ? "line"
              : "bar"
            : chart.type.startsWith("line")
              ? "line"
              : chart.type === "area"
                ? "area"
                : "bar",
      }));
    refs.forEach((ref, i) => {
      const id = key + ":" + i;
      if (native) {
        helpers.push({ id, index: i });
        data.push({
          name: "Synthetic helper " + i,
          values: rows.map(() => ref.value),
          column: String.fromCharCode(66 + data.length),
          helper: { v: 1, id },
          ref,
          axis: ref.axis ?? "value",
          kind: "line",
        });
      } else
        overlays.push({
          id,
          index: i,
          value: ref.value,
          axis: ref.axis ?? "value",
          labelPosition: ref.labelPosition ?? "end",
          ...(chart.type === "combo" ? {axisIds: ref.axis === "secondary" ? {category:30,value:40} : {category:10,value:20}} : {}),
          binding: "synthetic-not-a-production-hash",
        });
    });
    const cells = [];
    for (let i = 0; i < rows.length + 1; i++) {
      const row = [];
      for (let j = 0; j < data.length + 1; j++) {
        const value =
            j === 0
              ? i === 0
                ? columns[0]
                : rows[i - 1][0]
              : i === 0
                ? data[j - 1].name
                : data[j - 1].values[i - 1],
          cell = String.fromCharCode(65 + j) + (i + 1);
        row.push(
          typeof value === "number"
            ? `<c r="${cell}"><v>${value}</v></c>`
            : `<c r="${cell}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`,
        );
      }
      cells.push(`<row r="${i + 1}">${row.join("")}</row>`);
    }
    const book = {
      "xl/workbook.xml": deps.strToU8(
        '<workbook><sheets><sheet name="Sheet1" r:id="r1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": deps.strToU8(
        rels([relationship("r1", "worksheets/sheet1.xml", "worksheet")]),
      ),
      "xl/worksheets/sheet1.xml": deps.strToU8(
        `<worksheet><sheetData>${cells.join("")}</sheetData></worksheet>`,
      ),
    };
    entries[`ppt/embeddings/book${num}.xlsx`] = deps.zipSync(book);
    put(
      `ppt/charts/_rels/chart${num}.xml.rels`,
      rels([relationship("workbook", `../embeddings/book${num}.xlsx`, "package")]),
    );
    const groups = [];
    for (const kind of ["bar", "area", "line"])
      for (const axis of ["value", "secondary"]) {
        const matching = data.filter((d) => d.kind === kind && d.axis === axis);
        if (!matching.length) continue;
        const ids = axis === "secondary" ? ["30", "40"] : ["10", "20"];
        const series = matching
          .map((d) => {
            const at = data.indexOf(d),
              ref = d.ref,
              paint = ref
                ? `<c:spPr><a:ln w="${Math.round((ref.stroke?.width ?? 4 / 3) * 9525)}"><a:solidFill><a:srgbClr val="${String(
                    ref.stroke?.color ?? "#123456",
                  )
                    .slice(1)
                    .toUpperCase()}"/></a:solidFill><a:prstDash val="${ref.stroke?.dash ?? "dash"}"/></a:ln></c:spPr>`
                : '<c:spPr><a:ln><a:prstDash val="solid"/></a:ln></c:spPr>';
            const label =
              ref?.label === undefined
                ? ""
                : `<c:dLbl><c:idx val="${ref.labelPosition === "start" ? 0 : rows.length - 1}"/><c:tx><c:rich><a:p><a:r><a:t>${esc(ref.label)}</a:t></a:r></a:p></c:rich></c:tx></c:dLbl>`;
            return `<c:ser><c:idx val="${at}"/><c:order val="${at}"/><c:tx><c:strRef><c:f>${range(d.column, 1, 1)}</c:f>${cache([d.name], false)}</c:strRef></c:tx>${paint}<c:marker><c:symbol val="none"/></c:marker><c:dLbls>${label}</c:dLbls><c:cat><c:strRef><c:f>${range("A", rows.length)}</c:f>${cache(
              rows.map((r) => String(r[0])),
              false,
            )}</c:strRef></c:cat><c:val><c:numRef><c:f>${range(d.column, rows.length)}</c:f>${cache(d.values, true)}</c:numRef></c:val>${d.helper ? ext("reference", d.helper) : ""}</c:ser>`;
          })
          .join("");
        groups.push(
          `<c:${kind}Chart><c:grouping val="standard"/>${kind === "bar" ? `<c:barDir val="${chart.type === "bar" ? "bar" : "col"}"/>` : ""}${series}${ids.map((id) => `<c:axId val="${id}"/>`).join("")}</c:${kind}Chart>`,
        );
      }
    const axes = ["10", "20", ...(chart.type === "combo" ? ["30", "40"] : [])]
      .map(
        (id, i) =>
          `<c:${i % 2 ? "valAx" : "catAx"}><c:axId val="${id}"/><c:crossAx val="${i % 2 ? Number(id) - 10 : Number(id) + 10}"/><c:scaling><c:min val="-100"/><c:max val="1000"/></c:scaling></c:${i % 2 ? "valAx" : "catAx"}>`,
      )
      .join("");
    put(
      `ppt/charts/chart${num}.xml`,
      `<c:chartSpace><c:chart><c:plotArea>${groups.join("")}${axes}</c:plotArea></c:chart><c:externalData r:id="workbook"/>${refs.length ? ext("references", { v: 1, key, helpers, overlays }) : ""}</c:chartSpace>`,
    );
    const shape = (id, name, content, tx = true) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="95250"/></a:xfrm><a:ln><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:ln></p:spPr>${tx ? `<p:txBody><a:p><a:r><a:t>${esc(content)}</a:t></a:r></a:p></p:txBody>` : ""}</p:sp>`;
    let id = 2;
    const shapes = [
      `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="1" name="Synthetic chart"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></p:xfrm><a:graphic><a:graphicData uri="${uri}"><c:chart r:id="chart"/></a:graphicData></a:graphic></p:graphicFrame>`,
    ];
    for (const value of [slide.title, slide.subtitle].filter((v) => v !== undefined))
      shapes.push(shape(id++, "Synthetic text " + id, value));
    for (const o of overlays) {
      shapes.push(shape(id++, o.id + " line", null, false));
      const ref = refs[o.index];
      if (ref.label !== undefined) shapes.push(shape(id++, o.id + " label", ref.label));
    }
    put(
      `ppt/slides/slide${num}.xml`,
      `<p:sld><p:cSld><p:spTree>${shapes.join("")}</p:spTree></p:cSld></p:sld>`,
    );
    put(
      `ppt/slides/_rels/slide${num}.xml.rels`,
      rels([relationship("chart", `../charts/chart${num}.xml`, "chart")]),
    );
  });
  return Buffer.from(deps.zipSync(entries));
}

const rewrite = (bytes, file, change) => {
  const parts = deps.unzipSync(bytes),
    before = deps.strFromU8(parts[file]),
    after = change(before);
  assert.notEqual(before, after, "Mutation must alter actual XML");
  parts[file] = deps.strToU8(after);
  return Buffer.from(deps.zipSync(parts));
};
const phaseFor = (archive) => ({
  slideCount: 3,
  rasters: [{}, {}, {}],
  slides: archive.slides.map((s, i) => ({
    index: i + 1,
    slideId: 256 + i,
    name: "Synthetic " + i,
    shapeCount: s.shapes.length,
    shapes: s.shapes.map((x, j) => ({
      index: j + 1,
      id: x.id,
      name: x.name,
      type: x.kind === "chart" ? 3 : 17,
      ...x.geometry,
      hasTextFrame: x.kind === "text" ? -1 : 0,
      text: x.kind === "text" ? x.text : null,
      alternativeText: "",
    })),
  })),
});
function suite(bytes) {
  return {
    schemaVersion: 1,
    fullSuite: false,
    scope: { profile: "reference-chart-original-readonly-v1", fullSuite: false },
    nativeAcceptance: false,
    provenance: { nativeAcceptance: false, registryAcceptance: false },
    cases: REFERENCE_CASES.map((id) => ({
      id,
      slideCount: 3,
      worker: "furniture",
      automaticControlEligible: false,
      archiveSha256: digest(bytes),
    })),
  };
}

export { syntheticCase, phaseFor, rewrite, suite, deps, sources };
