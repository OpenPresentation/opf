// Verifies internal consistency of spec/** that no single schema validator can
// check on its own: catalog index <-> on-disk record parity, catalog record
// schema <-> embedded opf.schema.json $def parity, preview index <-> on-disk
// HTML parity, index-file $schema URIs, the Aspose.Slides chart-type
// reduction (one record per Aspose.Slides ChartType), the default-catalog
// snapshot's manifest hashes (spec/catalogs/manifest.json), layout-record design
// hints against the deck's Design, font-scheme languages against the engine's
// language vocabulary, and the finding schema (the report format every OPF tool shares).
//
// Zero external dependencies by design. Run via `pnpm check:spec` (root) or
// `node scripts/check-spec-integrity.mjs` directly. Exits non-zero with a
// listing of every problem found; exits zero with a short JSON summary.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifySnapshot } from "./catalog-snapshot.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogsRoot = path.join(repoRoot, "spec", "catalogs");
const schemasRoot = path.join(repoRoot, "spec", "schemas");
const previewsDir = path.join(repoRoot, "spec", "previews", "layouts");

const CATALOG_INDEX_SCHEMA_ID = "https://openpresentation.org/schema/opf-catalog-index/v1";
const LAYOUT_PREVIEW_INDEX_SCHEMA_ID = "https://openpresentation.org/schema/opf-layout-preview-index/v1";

// kind directory (spec/catalogs/<dir>) -> singular used for both the
// companion schema filename (spec/schemas/<singular>.schema.json) and the
// per-record $schema URI (https://openpresentation.org/schema/opf-<singular>/v1).
//
// defName maps to the matching inline $defs/<Name> entry embedded in
// spec/schemas/opf.schema.json, when one exists. The other kinds have no inline
// object mirror, so they have no matching root $def:
//   - narratives, layouts and themes: the root narrative, Slide.layout and
//     design.theme are reference strings; a record the document defines is a
//     catalogs.custom.<kind> entry.
//   - chartTypes, languages and socialPlatforms: catalog display metadata. Chart.type,
//     the language tag and the Socials keys are engine vocabularies, and the
//     in-document Language object (a bcp47 tag plus overrides) is not a record.
// Those are skipped by the companion-schema parity check (b) below.
const CATALOG_KINDS = [
  { dir: "audiences", singular: "audience", defName: "Audience" },
  { dir: "chart-types", singular: "chart-type", defName: null },
  { dir: "color-schemes", singular: "color-scheme", defName: "ColorScheme" },
  { dir: "font-schemes", singular: "font-scheme", defName: "FontScheme" },
  { dir: "languages", singular: "language", defName: null },
  { dir: "layouts", singular: "layout", defName: null },
  { dir: "narratives", singular: "narrative", defName: null },
  { dir: "purposes", singular: "purpose", defName: "Purpose" },
  { dir: "social-platforms", singular: "social-platform", defName: null },
  { dir: "themes", singular: "theme", defName: null },
  { dir: "tones", singular: "tone", defName: "Tone" },
];

// Documented, intentional shape differences between a catalog's companion
// schema (spec/schemas/<kind>.schema.json) and its embedded $def in
// spec/schemas/opf.schema.json. These come from the schemas' own field
// descriptions, not from guessing:
//   - `preview` (picker-UI preview images) is a catalog-record-only field;
//     inline OPF authoring never sets it, so it's intentionally absent from
//     every embedded $def.
//   - Companion schemas require `id`/`name` (and kind-specific identity
//     fields) unconditionally; embedded $defs instead use an `anyOf: [{required:
//     ["id"]}, {required:["name"]}]` pattern so inline objects can be
//     identified by either, so those fields are intentionally not in the
//     def's flat `required` array.
//   - ColorScheme/FontScheme $defs additionally expose "abstract role" fields
//     (primary/secondary/accent/background/surface/text/textSecondary/custom
//     for color; heading/body/accent for font) that the engine maps onto
//     OOXML slots — these are OPF-specific inline conveniences with no
//     counterpart in the catalog record schema (see each $def's own
//     description in opf.schema.json). The font `code` role is shared: catalog
//     records may carry it too (FF-17), so it is not listed here.
const KNOWN_DEF_DIFFERENCES = {
  Audience: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  Purpose: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  Tone: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  ColorScheme: {
    schemaOnlyProps: ["name", "summary", "description", "tags", "preview"],
    defOnlyProps: ["primary", "secondary", "accent", "background", "surface", "text", "textSecondary", "custom"],
    schemaOnlyRequired: ["id", "name"],
  },
  FontScheme: {
    schemaOnlyProps: ["name", "summary", "description", "tags", "preview", "languages", "textSample"],
    defOnlyProps: ["heading", "body", "accent"],
    schemaOnlyRequired: ["id", "name", "major", "minor"],
  },
};

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listJsonRecordFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json")
    .map((entry) => entry.name)
    .sort();
}

function displayPath(absolute) {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

// (a) Catalog index <-> on-disk record parity, id-matches-filename, and
// per-record $schema URI.
async function checkCatalogRecordParity() {
  for (const { dir, singular } of CATALOG_KINDS) {
    const catalogDir = path.join(catalogsRoot, dir);
    const indexPath = path.join(catalogDir, "index.json");
    const index = await readJson(indexPath);

    const indexFiles = Array.isArray(index.records) ? index.records.map((record) => record.file).filter(Boolean) : [];
    const diskFiles = await listJsonRecordFiles(catalogDir);

    const indexSet = new Set(indexFiles);
    const diskSet = new Set(diskFiles);

    const missingOnDisk = indexFiles.filter((file) => !diskSet.has(file));
    const missingFromIndex = diskFiles.filter((file) => !indexSet.has(file));

    for (const file of missingOnDisk) {
      fail(`[a] ${dir}: index.json references '${file}' but no such file exists on disk`);
    }
    for (const file of missingFromIndex) {
      fail(`[a] ${dir}: '${file}' exists on disk but is not listed in index.json records`);
    }

    const expectedRecordSchema = `https://openpresentation.org/schema/opf-${singular}/v1`;
    for (const file of diskFiles) {
      const recordPath = path.join(catalogDir, file);
      const record = await readJson(recordPath);
      const stem = file.replace(/\.json$/, "");
      if (record.id !== stem) {
        fail(`[a] ${displayPath(recordPath)}: id '${record.id}' does not match filename stem '${stem}'`);
      }
      if (record.$schema !== expectedRecordSchema) {
        fail(
          `[a] ${displayPath(recordPath)}: $schema is '${record.$schema}', expected '${expectedRecordSchema}'`,
        );
      }
    }
  }
}

function propsAndRequired(schema) {
  const props = new Set(Object.keys(schema.properties ?? {}));
  props.delete("$schema");
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  required.delete("$schema");
  return { props, required };
}

function setDiff(a, b) {
  return [...a].filter((item) => !b.has(item)).sort();
}

function withoutIgnored(list, ignored) {
  const ignoredSet = new Set(ignored ?? []);
  return list.filter((item) => !ignoredSet.has(item));
}

// (b) Companion-schema parity between spec/schemas/<kind>.schema.json and the
// matching embedded $defs/<Name> in spec/schemas/opf.schema.json.
async function checkCompanionSchemaParity(opfSchema) {
  for (const { dir, singular, defName } of CATALOG_KINDS) {
    if (defName === null) {
      notes.push(`[b] ${dir}: skipped (no matching root $def: a reference string or engine vocabulary, not an inline ${singular} object)`);
      continue;
    }

    const companionSchema = await readJson(path.join(schemasRoot, `${singular}.schema.json`));
    const def = opfSchema.$defs?.[defName];
    if (!def) {
      fail(`[b] ${dir}: expected $defs/${defName} in opf.schema.json but it does not exist`);
      continue;
    }

    const known = KNOWN_DEF_DIFFERENCES[defName] ?? {};
    const schemaSide = propsAndRequired(companionSchema);
    const defSide = propsAndRequired(def);

    const propsOnlyInSchema = withoutIgnored(setDiff(schemaSide.props, defSide.props), known.schemaOnlyProps);
    const propsOnlyInDef = withoutIgnored(setDiff(defSide.props, schemaSide.props), known.defOnlyProps);
    const requiredOnlyInSchema = withoutIgnored(setDiff(schemaSide.required, defSide.required), known.schemaOnlyRequired);
    const requiredOnlyInDef = withoutIgnored(setDiff(defSide.required, schemaSide.required), known.defOnlyRequired);

    if (propsOnlyInSchema.length > 0) {
      fail(`[b] ${singular}.schema.json has properties not in $defs/${defName}: ${propsOnlyInSchema.join(", ")}`);
    }
    if (propsOnlyInDef.length > 0) {
      fail(`[b] $defs/${defName} has properties not in ${singular}.schema.json: ${propsOnlyInDef.join(", ")}`);
    }
    if (requiredOnlyInSchema.length > 0) {
      fail(`[b] ${singular}.schema.json requires fields not required in $defs/${defName}: ${requiredOnlyInSchema.join(", ")}`);
    }
    if (requiredOnlyInDef.length > 0) {
      fail(`[b] $defs/${defName} requires fields not required in ${singular}.schema.json: ${requiredOnlyInDef.join(", ")}`);
    }

    // Enum comparison: only meaningful when both sides declare a literal
    // `enum` on the same property. Properties expressed via $ref/oneOf on
    // either side (e.g. Theme.dimensions) are not directly comparable here
    // and are intentionally skipped rather than reported as drift.
    const commonProps = [...schemaSide.props].filter((prop) => defSide.props.has(prop));
    for (const prop of commonProps) {
      const schemaEnum = companionSchema.properties?.[prop]?.enum;
      const defEnum = def.properties?.[prop]?.enum;
      if (Array.isArray(schemaEnum) && Array.isArray(defEnum)) {
        const same = schemaEnum.length === defEnum.length && schemaEnum.every((value, i) => value === defEnum[i]);
        if (!same) {
          fail(
            `[b] ${singular}.schema.json vs $defs/${defName}: enum mismatch on '${prop}' (schema: ${JSON.stringify(schemaEnum)}, def: ${JSON.stringify(defEnum)})`,
          );
        }
      }
    }
  }
}

// (c) Preview index <-> on-disk HTML parity, exact byte-length check, no
// orphan HTML files.
// (e) Narrative beat layout values must resolve to a bundled layout id, and a
// record's duration range (and its index entry's) must not be inverted (FA-02).
async function checkNarrativeRecords() {
  const layoutDir = path.join(catalogsRoot, "layouts");
  const layoutFiles = await listJsonRecordFiles(layoutDir);
  const layoutIds = new Set(layoutFiles.map((file) => file.replace(/\.json$/, "")));

  const narrativeDir = path.join(catalogsRoot, "narratives");
  const narrativeFiles = await listJsonRecordFiles(narrativeDir);
  for (const file of narrativeFiles) {
    const recordPath = path.join(narrativeDir, file);
    const record = await readJson(recordPath);
    if (record.duration && record.duration.min > record.duration.max) {
      fail(`[e] ${displayPath(recordPath)} duration.min ${record.duration.min} is greater than duration.max ${record.duration.max}`);
    }
    if (!Array.isArray(record.beats)) continue;
    for (let index = 0; index < record.beats.length; index++) {
      const beat = record.beats[index];
      if (!beat || typeof beat.layout !== "string") continue;
      if (!layoutIds.has(beat.layout)) {
        fail(
          `[e] ${displayPath(recordPath)} beats[${index}].layout '${beat.layout}' is not a bundled layout id`,
        );
      }
    }
  }
  const index = await readJson(path.join(narrativeDir, "index.json"));
  for (const entry of index.records ?? []) {
    if (entry.duration && entry.duration.min > entry.duration.max) {
      fail(`[e] narratives/index.json entry '${entry.id}' duration.min ${entry.duration.min} is greater than duration.max ${entry.duration.max}`);
    }
  }
}

async function checkPreviewIndex() {
  const indexPath = path.join(previewsDir, "index.json");
  const index = await readJson(indexPath);

  const records = Array.isArray(index.records) ? index.records : [];
  const referencedFiles = new Set();

  for (const record of records) {
    referencedFiles.add(record.file);
    const filePath = path.join(previewsDir, record.file);
    let content;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      fail(`[c] previews/layouts: index.json references '${record.file}' (id '${record.id}') but the file does not exist`);
      continue;
    }
    const actualBytes = Buffer.byteLength(content, "utf8");
    if (actualBytes !== record.bytes) {
      fail(
        `[c] previews/layouts/${record.file}: index.json says bytes=${record.bytes}, actual UTF-8 length is ${actualBytes}`,
      );
    }
  }

  const entries = await readdir(previewsDir, { withFileTypes: true });
  const diskHtmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort();

  const orphans = diskHtmlFiles.filter((file) => !referencedFiles.has(file));
  for (const file of orphans) {
    fail(`[c] previews/layouts/${file}: exists on disk but is not referenced by any record in index.json`);
  }
}

// (d) Every catalog index.json (and the preview index) declares the correct
// generic index $schema URI introduced alongside spec/schemas/catalog-index.schema.json
// and spec/schemas/layout-preview-index.schema.json.
async function checkIndexSchemaUris() {
  for (const { dir } of CATALOG_KINDS) {
    const indexPath = path.join(catalogsRoot, dir, "index.json");
    const index = await readJson(indexPath);
    if (index.$schema !== CATALOG_INDEX_SCHEMA_ID) {
      fail(`[d] ${displayPath(indexPath)}: $schema is '${index.$schema}', expected '${CATALOG_INDEX_SCHEMA_ID}'`);
    }
  }

  const previewIndexPath = path.join(previewsDir, "index.json");
  const previewIndex = await readJson(previewIndexPath);
  if (previewIndex.$schema !== LAYOUT_PREVIEW_INDEX_SCHEMA_ID) {
    fail(
      `[d] ${displayPath(previewIndexPath)}: $schema is '${previewIndex.$schema}', expected '${LAYOUT_PREVIEW_INDEX_SCHEMA_ID}'`,
    );
  }
}

// (f) Chart types are reduced to the chart types Aspose.Slides officially
// supports (FF-22). Every record names its Aspose.Slides ChartType under
// mappings.renderers["aspose-slides"].chartType, and the records hold exactly one
// record per ChartType. A combination
// record (mappings.openxml.composition "mixed", FA-15 combo) names the ChartType
// its chart starts from plus the series types it switches to (every
// "*SeriesType" key), all Aspose.Slides members; it owns no ChartType. Source:
// https://reference.aspose.com/slides/net/aspose.slides.charts/charttype/
// (see docs/programs/font-fidelity-everywhere/aspose-chart-types.md).
const ASPOSE_SLIDES_CHART_TYPES = new Set([
  "ClusteredColumn", "StackedColumn", "PercentsStackedColumn", "ClusteredColumn3D", "StackedColumn3D",
  "PercentsStackedColumn3D", "Column3D", "ClusteredCylinder", "StackedCylinder", "PercentsStackedCylinder",
  "Cylinder3D", "ClusteredCone", "StackedCone", "PercentsStackedCone", "Cone3D", "ClusteredPyramid",
  "StackedPyramid", "PercentsStackedPyramid", "Pyramid3D", "Line", "StackedLine", "PercentsStackedLine",
  "LineWithMarkers", "StackedLineWithMarkers", "PercentsStackedLineWithMarkers", "Line3D", "Pie", "Pie3D",
  "PieOfPie", "ExplodedPie", "ExplodedPie3D", "BarOfPie", "PercentsStackedBar", "ClusteredBar3D",
  "ClusteredBar", "StackedBar", "StackedBar3D", "PercentsStackedBar3D", "ClusteredHorizontalCylinder",
  "StackedHorizontalCylinder", "PercentsStackedHorizontalCylinder", "ClusteredHorizontalCone",
  "StackedHorizontalCone", "PercentsStackedHorizontalCone", "ClusteredHorizontalPyramid",
  "StackedHorizontalPyramid", "PercentsStackedHorizontalPyramid", "Area", "StackedArea", "PercentsStackedArea",
  "Area3D", "StackedArea3D", "PercentsStackedArea3D", "ScatterWithMarkers", "ScatterWithSmoothLinesAndMarkers",
  "ScatterWithSmoothLines", "ScatterWithStraightLinesAndMarkers", "ScatterWithStraightLines", "HighLowClose",
  "OpenHighLowClose", "VolumeHighLowClose", "VolumeOpenHighLowClose", "Surface3D", "WireframeSurface3D",
  "Contour", "WireframeContour", "Doughnut", "ExplodedDoughnut", "Bubble", "BubbleWith3D", "Radar",
  "RadarWithMarkers", "FilledRadar", "Treemap", "Sunburst", "Histogram", "ParetoLine", "BoxAndWhisker",
  "Waterfall", "Funnel", "Map",
]);

async function checkChartTypesAsposeSupported() {
  const dir = path.join(catalogsRoot, "chart-types");
  const index = await readJson(path.join(dir, "index.json"));
  const indexById = new Map((index.records ?? []).map((record) => [record.id, record]));
  const records = new Map();
  for (const file of await listJsonRecordFiles(dir)) {
    const record = await readJson(path.join(dir, file));
    records.set(record.id, record);
  }
  const owners = new Map();
  let combinations = 0;
  for (const [id, record] of records) {
    const where = `[f] chart-types/${id}.json`;
    const chartType = record.mappings?.renderers?.["aspose-slides"]?.chartType;
    if (chartType !== undefined && !ASPOSE_SLIDES_CHART_TYPES.has(chartType)) {
      fail(`${where}: '${chartType}' is not an Aspose.Slides ChartType member`);
    }
    const aspose = record.mappings?.renderers?.["aspose-slides"] ?? {};
    for (const [key, value] of Object.entries(aspose)) {
      if (/SeriesType$/.test(key) && !ASPOSE_SLIDES_CHART_TYPES.has(value)) fail(`${where}: ${key} '${value}' is not an Aspose.Slides ChartType member`);
    }
    if (chartType === "SeriesOfMixedTypes") {
      fail(`${where}: SeriesOfMixedTypes is read-only in Aspose.Slides and cannot back a chart type`);
    }
    if (!indexById.has(id)) fail(`${where}: not listed in index.json`);
    if (chartType === undefined) {
      fail(`${where}: every chart type must name an Aspose.Slides ChartType in mappings.renderers["aspose-slides"].chartType`);
      continue;
    }
    if (record.mappings?.openxml?.composition === "mixed") {
      if (!Object.keys(aspose).some((key) => /SeriesType$/.test(key))) fail(`${where}: a mixed composition names the series type it switches to (for example lineSeriesType)`);
      combinations += 1;
      continue;
    }
    if (owners.has(chartType)) {
      fail(`${where}: Aspose.Slides ChartType '${chartType}' is already covered by '${owners.get(chartType)}'; remove one of them`);
    }
    owners.set(chartType, id);
  }
  notes.push(`chart-types: ${owners.size} Aspose.Slides-supported chart types, ${combinations} combination${combinations === 1 ? '' : 's'}`);
}

// (g) spec/catalogs is a pinned snapshot of the default catalog published by
// pptx.gallery: each kind's records must still hash to the value recorded in
// its index and in spec/catalogs/manifest.json. A mismatch means the snapshot
// was edited by hand instead of through scripts/sync-gallery-catalog.mjs.
async function checkSnapshotManifest() {
  for (const problem of await verifySnapshot(catalogsRoot)) {
    fail(`[g] ${problem}`);
  }
}

// (h) OPF 0.15 has no deprecated records or aliases: no record carries `deprecation` and no index entry carries
// `deprecated` or `replacedBy`.
async function checkNoDeprecation() {
  for (const { dir } of CATALOG_KINDS) {
    const catalogDir = path.join(catalogsRoot, dir);
    const index = await readJson(path.join(catalogDir, "index.json"));
    for (const entry of index.records ?? []) if ("deprecated" in entry || "replacedBy" in entry) fail(`[h] ${dir}/index.json: entry '${entry.id}' is marked deprecated`);
    for (const file of await listJsonRecordFiles(catalogDir)) {
      const record = await readJson(path.join(catalogDir, file));
      if ("deprecation" in record) fail(`[h] ${dir}/${file}: records carry no deprecation`);
    }
  }
}

// (i) Layout records share the deck's design vocabulary (FA-01). layout.schema.json's DesignHints repeats the
// keys of opf.schema.json's Design that a layout can carry, and a cross-file $ref cannot express that subset,
// so this rule keeps the two copies from drifting: every DesignHints key must exist in Design with the same
// type and enum values. Bundled layout records must
// carry only fields the layout schema defines, so a removed field (contentType, slideTitle, ...) cannot come back.
async function checkLayoutDesignHints(opfSchema) {
  const layoutSchema = await readJson(path.join(schemasRoot, "layout.schema.json"));
  const hints = layoutSchema.$defs?.DesignHints?.properties;
  const design = opfSchema.$defs?.Design?.properties;
  if (!hints || !design) {
    fail("[i] layout.schema.json $defs/DesignHints or opf.schema.json $defs/Design is missing");
    return;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [key, hint] of Object.entries(hints)) {
    const counterpart = design[key];
    if (!counterpart) {
      fail(`[i] layout.schema.json DesignHints.${key} has no counterpart in opf.schema.json Design`);
      continue;
    }
    if (hint.type !== counterpart.type || !same(hint.enum, counterpart.enum)) {
      fail(`[i] DesignHints.${key} type/values differ from Design.${key}`);
    }
  }
  const layoutDir = path.join(catalogsRoot, "layouts");
  const known = new Set(Object.keys(layoutSchema.properties));
  for (const file of await listJsonRecordFiles(layoutDir)) {
    const record = await readJson(path.join(layoutDir, file));
    for (const key of Object.keys(record)) {
      if (!known.has(key) && !key.startsWith("x-")) fail(`[i] layouts/${file}: '${key}' is not a layout schema field`);
    }
  }
}

// (j) A font scheme's `languages` entries are BCP-47 tags (OPF 0.15), and each must be a tag of the engine's language
// vocabulary (spec/reference/engine-vocabularies.json), so the list names languages engines know.
async function checkFontSchemeLanguages() {
  const vocabulary = await readJson(path.join(repoRoot, "spec", "reference", "engine-vocabularies.json"));
  const languageIds = new Set(vocabulary.languages.map((entry) => entry.tag));
  const dir = path.join(catalogsRoot, "font-schemes");
  for (const file of await listJsonRecordFiles(dir)) {
    const record = await readJson(path.join(dir, file));
    for (const entry of record.languages ?? []) {
      if (!languageIds.has(entry)) fail(`[j] font-schemes/${file}: languages entry '${entry}' is not a tag of the language vocabulary`);
    }
  }
}

// (k) The finding schema (spec/schemas/finding.schema.json, the report format every OPF tool shares) is published and
// typed (RR-55): its id, the definitions the generated types and validate's findings rely on, the closed severity enum,
// the six core categories, the required fields of a finding, and every local $ref resolving to a definition.
const FINDING_SCHEMA_ID = "https://openpresentation.org/schema/opf-finding/v1";
async function checkFindingSchema() {
  const where = "[k] schemas/finding.schema.json";
  const schema = await readJson(path.join(schemasRoot, "finding.schema.json"));
  if (schema.$id !== FINDING_SCHEMA_ID) fail(`${where}: $id is '${schema.$id}', expected '${FINDING_SCHEMA_ID}'`);
  const defs = schema.$defs ?? {};
  for (const name of ["Finding", "FindingFix", "FindingLocation", "FindingSeverity", "FindingCategory", "JsonPatchOperation", "ValidationIssue"]) {
    if (!defs[name]) fail(`${where}: missing $defs/${name}`);
  }
  const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((value, index) => value === b[index]);
  if (!sameList(defs.FindingSeverity?.enum, ["error", "warning", "info"])) fail(`${where}: FindingSeverity must be exactly error, warning, info`);
  const categories = defs.FindingCategory?.anyOf?.[0]?.enum;
  if (!sameList(categories, ["format", "references", "policy", "accessibility", "layout", "content"])) fail(`${where}: FindingCategory must list the six core categories first`);
  for (const field of ["ruleId", "severity", "category", "path", "message"]) {
    if (!defs.Finding?.required?.includes(field)) fail(`${where}: Finding must require '${field}'`);
  }
  if (!sameList(schema.required, ["valid", "findings", "counts"])) fail(`${where}: the report must require valid, findings and counts`);
  const walk = (node, trail) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => {
        walk(entry, `${trail}/${index}`);
      });
      return;
    }
    if (!node || typeof node !== "object") return;
    if (typeof node.$ref === "string") {
      const match = /^#\/\$defs\/(.+)$/.exec(node.$ref);
      if (!match || !defs[match[1]]) fail(`${where}: ${trail}: $ref '${node.$ref}' does not resolve to a $defs entry`);
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${trail}/${key}`);
  };
  walk(schema, "");
}

async function main() {
  const opfSchema = await readJson(path.join(schemasRoot, "opf.schema.json"));

  await checkCatalogRecordParity();
  await checkCompanionSchemaParity(opfSchema);
  await checkNarrativeRecords();
  await checkPreviewIndex();
  await checkIndexSchemaUris();
  await checkChartTypesAsposeSupported();
  await checkSnapshotManifest();
  await checkNoDeprecation();
  await checkLayoutDesignHints(opfSchema);
  await checkFontSchemeLanguages();
  await checkFindingSchema();

  if (failures.length > 0) {
    process.stderr.write(`spec integrity check failed: ${failures.length} problem(s) found\n\n`);
    for (const failure of failures) {
      process.stderr.write(`${failure}\n`);
    }
    process.exit(1);
  }

  for (const note of notes) {
    process.stdout.write(`${note}\n`);
  }
  process.stdout.write(`${JSON.stringify({ valid: true, catalogKinds: CATALOG_KINDS.length }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
