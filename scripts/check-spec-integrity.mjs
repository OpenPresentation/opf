// Verifies internal consistency of spec/** that no single schema validator can
// check on its own: catalog index <-> on-disk record parity, catalog record
// schema <-> embedded opf.schema.json $def parity, preview index <-> on-disk
// HTML parity, and index-file $schema URIs.
//
// Zero external dependencies by design. Run via `pnpm check:spec` (root) or
// `node scripts/check-spec-integrity.mjs` directly. Exits non-zero with a
// listing of every problem found; exits zero with a short JSON summary.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
// spec/schemas/opf.schema.json, when one exists. Three kinds are referenced
// from OPF documents as bare strings with no inline object mirror, so they
// have no matching root $def:
//   - layouts: Slide.layout is a bare string catalog reference.
//   - chartTypes: Chart.type is a bare string catalog reference.
//   - socialPlatforms: Socials is a string-valued map keyed by platform id,
//     not an inline SocialPlatform object.
// Those three are skipped by the companion-schema parity check (b) below,
// per the task's own note to skip rather than fail when there's no def.
const CATALOG_KINDS = [
  { dir: "audiences", singular: "audience", defName: "Audience" },
  { dir: "chart-types", singular: "chart-type", defName: null },
  { dir: "color-schemes", singular: "color-scheme", defName: "ColorScheme" },
  { dir: "font-schemes", singular: "font-scheme", defName: "FontScheme" },
  { dir: "languages", singular: "language", defName: "Language" },
  { dir: "layouts", singular: "layout", defName: null },
  { dir: "narratives", singular: "narrative", defName: "Narrative" },
  { dir: "purposes", singular: "purpose", defName: "Purpose" },
  { dir: "social-platforms", singular: "social-platform", defName: null },
  { dir: "themes", singular: "theme", defName: "Theme" },
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
//     for color; heading/body/accent/code for font) that the engine maps onto
//     OOXML slots — these are OPF-specific inline conveniences with no
//     counterpart in the catalog record schema (see each $def's own
//     description in opf.schema.json).
//   - Narrative's companion schema requires `beats`; the embedded $def does
//     not, since an inline narrative may reference a catalog id and override
//     only some fields without repeating all beats.
const KNOWN_DEF_DIFFERENCES = {
  Audience: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  Purpose: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  Tone: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  Theme: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name"] },
  Narrative: { schemaOnlyProps: [], schemaOnlyRequired: ["id", "name", "beats"] },
  ColorScheme: {
    schemaOnlyProps: ["name", "summary", "description", "tags", "preview"],
    defOnlyProps: ["primary", "secondary", "accent", "background", "surface", "text", "textSecondary", "custom"],
    schemaOnlyRequired: ["id", "name"],
  },
  FontScheme: {
    schemaOnlyProps: ["name", "summary", "description", "tags", "preview", "languages", "textSample"],
    defOnlyProps: ["heading", "body", "accent", "code"],
    schemaOnlyRequired: ["id", "name", "major", "minor"],
  },
  Language: { schemaOnlyProps: ["preview"], schemaOnlyRequired: ["id", "name", "bcp47"] },
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
      notes.push(`[b] ${dir}: skipped (no matching root $def; ${singular} is referenced as a bare string, not an inline object)`);
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

async function main() {
  const opfSchema = await readJson(path.join(schemasRoot, "opf.schema.json"));

  await checkCatalogRecordParity();
  await checkCompanionSchemaParity(opfSchema);
  await checkPreviewIndex();
  await checkIndexSchemaUris();

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
