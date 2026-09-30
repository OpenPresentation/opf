// Shared helpers for the pinned default-catalog snapshot in spec/catalogs/.
//
// pptx.gallery publishes the default OPF catalog; spec/catalogs/ is a pinned
// snapshot of it, and spec/catalogs/manifest.json records the gallery commit
// and a content hash per kind. See docs/default-catalog.md.
//
// Zero external dependencies so scripts/check-spec-integrity.mjs can use it.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const CATALOG_INDEX_SCHEMA_ID = "https://openpresentation.org/schema/opf-catalog-index/v1";
export const CATALOG_MANIFEST_SCHEMA_ID = "https://openpresentation.org/schema/opf-catalog-manifest/v1";
export const DEFAULT_CATALOG_PUBLISHER = "https://www.pptx.gallery";

// URL segment and spec/catalogs/<kind> directory -> OPF `catalogs.<key>`,
// companion schema file, and record $schema id. The URL segment is the one the
// OPF schema names as each kind's default source (https://www.pptx.gallery/<kind>).
export const SNAPSHOT_KINDS = [
  { kind: "audiences", catalogKey: "audiences", schemaFile: "audience.schema.json" },
  { kind: "chart-types", catalogKey: "chartTypes", schemaFile: "chart-type.schema.json" },
  { kind: "color-schemes", catalogKey: "colorSchemes", schemaFile: "color-scheme.schema.json" },
  { kind: "font-schemes", catalogKey: "fontSchemes", schemaFile: "font-scheme.schema.json" },
  { kind: "languages", catalogKey: "languages", schemaFile: "language.schema.json" },
  { kind: "layouts", catalogKey: "layouts", schemaFile: "layout.schema.json" },
  { kind: "narratives", catalogKey: "narratives", schemaFile: "narrative.schema.json" },
  { kind: "purposes", catalogKey: "purposes", schemaFile: "purpose.schema.json" },
  { kind: "social-platforms", catalogKey: "socialPlatforms", schemaFile: "social-platform.schema.json" },
  { kind: "themes", catalogKey: "themes", schemaFile: "theme.schema.json" },
  { kind: "tones", catalogKey: "tones", schemaFile: "tone.schema.json" },
].map((entry) => ({
  ...entry,
  recordSchemaId: `https://openpresentation.org/schema/opf-${entry.schemaFile.replace(/\.schema\.json$/, "")}/v1`,
}));

/**
 * JSON with object keys sorted (JavaScript default string order) and no
 * insignificant whitespace; the input to `contentSha256`.
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Drops top-level `x-*` extension members (publisher metadata such as `x-gallery`). */
export function stripExtensions(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith("x-")));
}

/** SHA-256 (hex) of the canonical JSON of the index-ordered records, `x-*` members removed. */
export function catalogContentSha256(records) {
  return createHash("sha256")
    .update(canonicalJson(records.map((record) => stripExtensions(record))), "utf8")
    .digest("hex");
}

export function sameJson(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

/** Reads spec/catalogs/<kind>/index.json and its records, in index order. */
export async function readSnapshotKind(catalogsRoot, kind) {
  const dir = path.join(catalogsRoot, kind);
  const index = await readJson(path.join(dir, "index.json"));
  const records = [];
  for (const entry of index.records) records.push(await readJson(path.join(dir, entry.file)));
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json") && name !== "index.json").sort();
  return { index, records, files };
}

/**
 * Offline integrity check: every kind's index and records match the manifest
 * hash and count, and nothing publisher-specific leaked into the snapshot.
 * Returns a list of problems (empty when consistent).
 */
export async function verifySnapshot(catalogsRoot) {
  const problems = [];
  let manifest;
  try {
    manifest = await readJson(path.join(catalogsRoot, "manifest.json"));
  } catch (error) {
    return [`spec/catalogs/manifest.json is missing or invalid: ${error.message}`];
  }
  if (manifest.$schema !== CATALOG_MANIFEST_SCHEMA_ID) {
    problems.push(`manifest.json: $schema is '${manifest.$schema}', expected '${CATALOG_MANIFEST_SCHEMA_ID}'`);
  }
  const manifestKinds = Object.keys(manifest.kinds ?? {}).sort();
  const expectedKinds = SNAPSHOT_KINDS.map(({ kind }) => kind).sort();
  if (manifestKinds.join() !== expectedKinds.join()) {
    problems.push(`manifest.json: kinds are [${manifestKinds}], expected [${expectedKinds}]`);
  }
  for (const { kind, recordSchemaId } of SNAPSHOT_KINDS) {
    const entry = manifest.kinds?.[kind];
    if (!entry) continue;
    const { index, records } = await readSnapshotKind(catalogsRoot, kind);
    const hash = catalogContentSha256(records);
    if (index.kind !== kind) problems.push(`${kind}/index.json: kind is '${index.kind}', expected '${kind}'`);
    if (index.contentSha256 !== hash) {
      problems.push(`${kind}/index.json: contentSha256 ${index.contentSha256} does not match the records (${hash}); re-run scripts/sync-gallery-catalog.mjs instead of editing the snapshot by hand`);
    }
    if (entry.contentSha256 !== hash) {
      problems.push(`manifest.json kinds.${kind}.contentSha256 ${entry.contentSha256} does not match the records (${hash})`);
    }
    if (entry.records !== records.length) {
      problems.push(`manifest.json kinds.${kind}.records is ${entry.records}, snapshot has ${records.length}`);
    }
    if (!["mirror", "subset"].includes(entry.mode)) {
      problems.push(`manifest.json kinds.${kind}.mode must be 'mirror' or 'subset'`);
    }
    if (entry.mode === "mirror" && entry.gallery && entry.gallery.contentSha256 !== hash) {
      problems.push(`manifest.json kinds.${kind}: a mirrored kind must match the gallery hash`);
    }
    for (const key of Object.keys(index).filter((name) => name.startsWith("x-"))) {
      problems.push(`${kind}/index.json: publisher extension '${key}' must not be snapshotted`);
    }
    for (const record of records) {
      if (Object.keys(record).some((key) => key.startsWith("x-"))) {
        problems.push(`${kind}/${record.id}.json: publisher extension members must not be snapshotted`);
      }
      if (record.$schema !== recordSchemaId) {
        problems.push(`${kind}/${record.id}.json: $schema is '${record.$schema}', expected '${recordSchemaId}'`);
      }
    }
  }
  return problems;
}
