#!/usr/bin/env node
// Syncs spec/catalogs/ (the pinned default-catalog snapshot) from pptx.gallery,
// the canonical publisher of the default OPF catalog. See docs/default-catalog.md.
//
//   node scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery   write the snapshot from a gallery checkout
//   node scripts/sync-gallery-catalog.mjs --gallery <dir> --check     fail if the snapshot differs (CI)
//   node scripts/sync-gallery-catalog.mjs --url https://www.pptx.gallery --check
//                                                                       compare against the live site
//   node scripts/sync-gallery-catalog.mjs --verify                     offline: snapshot matches its manifest
//   node scripts/sync-gallery-catalog.mjs --gallery <dir> --report     per-kind divergence summary
//
// Every gallery record is validated against the companion schemas in
// spec/schemas/ before anything is written. Publisher `x-*` members are
// dropped. A mirrored kind takes every gallery record; a subset kind keeps the
// ids already in the snapshot (the gallery may publish more). The snapshot
// never loses an id: removing a record is a breaking change.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATALOG_INDEX_SCHEMA_ID,
  CATALOG_MANIFEST_SCHEMA_ID,
  DEFAULT_CATALOG_PUBLISHER,
  SNAPSHOT_KINDS,
  catalogContentSha256,
  readJson,
  readSnapshotKind,
  sameJson,
  serializeJson,
  stripExtensions,
  verifySnapshot,
} from "./catalog-snapshot.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalogsRoot = path.join(repoRoot, "spec", "catalogs");
const schemasRoot = path.join(repoRoot, "spec", "schemas");

export const GALLERY_REPOSITORY = "https://github.com/Data-Advantage/pptx-gallery";
export const GALLERY_PUBLISHED_PATH = "public";

// Initial modes, used only when the manifest does not exist yet. Afterwards the
// manifest's `mode` is authoritative: flip a kind to "mirror" once its gallery
// data is reconciled with the snapshot (docs/default-catalog.md).
export const INITIAL_MODES = {
  audiences: "subset",
  "chart-types": "subset",
  "color-schemes": "mirror",
  "font-schemes": "mirror",
  languages: "mirror",
  layouts: "subset",
  narratives: "subset",
  purposes: "mirror",
  "social-platforms": "mirror",
  themes: "mirror",
  tones: "mirror",
};

// ---------------------------------------------------------------------------
// Loading the published gallery catalog

/** Reads `<galleryDir>/public/<kind>/` as published by the gallery's build-opf-catalog script. */
export async function readGalleryCheckout(galleryDir) {
  const root = path.join(galleryDir, GALLERY_PUBLISHED_PATH);
  const kinds = {};
  for (const { kind } of SNAPSHOT_KINDS) {
    const dir = path.join(root, kind);
    const indexPath = path.join(dir, "index.json");
    if (!existsSync(indexPath)) throw new Error(`Gallery checkout has no ${GALLERY_PUBLISHED_PATH}/${kind}/index.json`);
    const index = await readJson(indexPath);
    const records = [];
    for (const entry of index.records ?? []) records.push(await readJson(path.join(dir, entry.file)));
    kinds[kind] = { index, records };
  }
  return kinds;
}

/** Fetches `<baseUrl>/<kind>/index.json` and every record it lists. */
export async function fetchGalleryCatalog(baseUrl, fetchImpl = fetch) {
  const base = baseUrl.replace(/\/+$/, "");
  const get = async (url) => {
    const response = await fetchImpl(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
    return response.json();
  };
  const kinds = {};
  for (const { kind } of SNAPSHOT_KINDS) {
    const index = await get(`${base}/${kind}/index.json`);
    const records = [];
    for (const entry of index.records ?? []) records.push(await get(`${base}/${kind}/${entry.file}`));
    kinds[kind] = { index, records };
  }
  return kinds;
}

// ---------------------------------------------------------------------------
// Validation

let validatorCache;
export async function loadValidators() {
  if (validatorCache) return validatorCache;
  const require = createRequire(path.join(repoRoot, "packages", "javascript", "package.json"));
  const Ajv2020 = require("ajv/dist/2020.js").default;
  const addFormats = require("ajv-formats").default;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const record = {};
  for (const { kind, schemaFile } of SNAPSHOT_KINDS) {
    record[kind] = ajv.compile(JSON.parse(await readFile(path.join(schemasRoot, schemaFile), "utf8")));
  }
  const index = ajv.compile(JSON.parse(await readFile(path.join(schemasRoot, "catalog-index.schema.json"), "utf8")));
  const manifest = ajv.compile(JSON.parse(await readFile(path.join(schemasRoot, "catalog-manifest.schema.json"), "utf8")));
  validatorCache = { record, index, manifest };
  return validatorCache;
}

function formatErrors(validate) {
  return (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
}

/** Checks one published gallery kind for integrity and schema validity. */
export function checkGalleryKind(kind, galleryKind, validators) {
  const problems = [];
  const config = SNAPSHOT_KINDS.find((entry) => entry.kind === kind);
  const { index, records } = galleryKind;
  if (index.$schema !== CATALOG_INDEX_SCHEMA_ID) problems.push(`${kind}/index.json: unexpected $schema '${index.$schema}'`);
  if (index.kind !== kind) problems.push(`${kind}/index.json: kind is '${index.kind}'`);
  if (!validators.index(stripExtensions(index))) problems.push(`${kind}/index.json: ${formatErrors(validators.index)}`);
  const hash = catalogContentSha256(records);
  if (index.contentSha256 !== hash) {
    problems.push(`${kind}/index.json: published contentSha256 ${index.contentSha256} does not match its records (${hash})`);
  }
  const seen = new Set();
  (index.records ?? []).forEach((entry, position) => {
    const record = records[position];
    if (!record) return;
    if (seen.has(entry.id)) problems.push(`${kind}: duplicate id '${entry.id}'`);
    seen.add(entry.id);
    if (record.id !== entry.id || entry.file !== `${entry.id}.json`) {
      problems.push(`${kind}/${entry.file}: record id '${record.id}' does not match index entry '${entry.id}'`);
    }
    if (record.$schema !== config.recordSchemaId) problems.push(`${kind}/${entry.file}: $schema is '${record.$schema}'`);
    const validate = validators.record[kind];
    if (!validate(stripExtensions(record))) problems.push(`${kind}/${entry.file}: ${formatErrors(validate)}`);
  });
  return problems;
}

// ---------------------------------------------------------------------------
// Planning

/**
 * Computes the snapshot a gallery catalog implies.
 * @param {object} input
 * @param {Record<string, {index: object, records: object[]}>} input.gallery Published gallery catalog per kind.
 * @param {Record<string, {index: object, records: object[]}>} input.current Current snapshot per kind.
 * @param {object | undefined} input.manifest Current manifest, if any.
 * @param {object} input.validators Compiled validators.
 * @param {object} input.source Manifest `source` block.
 */
export function planSnapshot({ gallery, current, manifest, validators, source }) {
  const problems = [];
  const kinds = {};
  for (const { kind } of SNAPSHOT_KINDS) {
    const published = gallery[kind];
    problems.push(...checkGalleryKind(kind, published, validators));
    const mode = manifest?.kinds?.[kind]?.mode ?? INITIAL_MODES[kind];
    const currentIds = new Set((current[kind]?.index.records ?? []).map((entry) => entry.id));
    const galleryIds = published.index.records.map((entry) => entry.id);
    const galleryIdSet = new Set(galleryIds);

    for (const id of currentIds) {
      if (!galleryIdSet.has(id)) {
        problems.push(`${kind}: the gallery no longer publishes '${id}', which the snapshot must keep (removing a catalog id is breaking); restore it in the gallery`);
      }
    }

    const keep = mode === "mirror" ? galleryIdSet : currentIds;
    const selected = [];
    published.index.records.forEach((entry, position) => {
      if (keep.has(entry.id)) selected.push({ entry, record: stripExtensions(published.records[position]) });
    });

    const records = selected.map(({ record }) => record);
    const contentSha256 = catalogContentSha256(records);
    const index = {
      $schema: CATALOG_INDEX_SCHEMA_ID,
      kind,
      version: published.index.version,
      description: published.index.description,
      contentSha256,
      records: selected.map(({ entry }) => entry),
    };
    const galleryOnly = galleryIds.filter((id) => !keep.has(id));
    kinds[kind] = {
      mode,
      index,
      records,
      galleryOnly,
      manifestEntry: {
        mode,
        records: records.length,
        contentSha256,
        gallery: { records: published.records.length, contentSha256: published.index.contentSha256 },
      },
    };
  }

  const nextManifest = {
    $schema: CATALOG_MANIFEST_SCHEMA_ID,
    description:
      "Pinned snapshot of the default OPF catalog published by pptx.gallery. Written by scripts/sync-gallery-catalog.mjs; change a kind's `mode` by hand, everything else by re-running the sync.",
    publisher: DEFAULT_CATALOG_PUBLISHER,
    source,
    kinds: Object.fromEntries(SNAPSHOT_KINDS.map(({ kind }) => [kind, kinds[kind].manifestEntry])),
  };
  if (!validators.manifest(nextManifest)) problems.push(`manifest.json: ${formatErrors(validators.manifest)}`);
  return { kinds, manifest: nextManifest, problems };
}

// ---------------------------------------------------------------------------
// Applying / diffing

async function currentFileMatches(file, value) {
  if (!existsSync(file)) return false;
  return sameJson(JSON.parse(await readFile(file, "utf8")), value);
}

/** Lists the files the plan would change (relative to spec/catalogs). */
export async function diffSnapshot(catalogsRoot, plan) {
  const changes = [];
  for (const [kind, planned] of Object.entries(plan.kinds)) {
    for (const record of planned.records) {
      if (!(await currentFileMatches(path.join(catalogsRoot, kind, `${record.id}.json`), record))) {
        changes.push(`${kind}/${record.id}.json`);
      }
    }
    if (!(await currentFileMatches(path.join(catalogsRoot, kind, "index.json"), planned.index))) {
      changes.push(`${kind}/index.json`);
    }
  }
  if (!(await currentFileMatches(path.join(catalogsRoot, "manifest.json"), plan.manifest))) changes.push("manifest.json");
  return changes;
}

// Keeps an existing record's key order for the keys it still has and appends
// new keys in the publisher's order, so a sync diff shows content, not churn.
function inExistingKeyOrder(existing, next) {
  const ordered = {};
  for (const key of Object.keys(existing)) if (key in next) ordered[key] = next[key];
  for (const key of Object.keys(next)) if (!(key in ordered)) ordered[key] = next[key];
  return ordered;
}

/** Writes the files that differ; content-identical files keep their bytes. */
export async function applySnapshot(catalogsRoot, plan) {
  const changes = await diffSnapshot(catalogsRoot, plan);
  const pending = new Set(changes);
  for (const [kind, planned] of Object.entries(plan.kinds)) {
    await mkdir(path.join(catalogsRoot, kind), { recursive: true });
    for (const record of planned.records) {
      const relative = `${kind}/${record.id}.json`;
      if (!pending.has(relative)) continue;
      const target = path.join(catalogsRoot, relative);
      const next = existsSync(target) ? inExistingKeyOrder(JSON.parse(await readFile(target, "utf8")), record) : record;
      await writeFile(target, serializeJson(next), "utf8");
    }
    if (pending.has(`${kind}/index.json`)) {
      await writeFile(path.join(catalogsRoot, kind, "index.json"), serializeJson(planned.index), "utf8");
    }
  }
  if (pending.has("manifest.json")) {
    await writeFile(path.join(catalogsRoot, "manifest.json"), serializeJson(plan.manifest), "utf8");
  }
  return changes;
}

export async function readCurrentSnapshot(catalogsRoot) {
  const current = {};
  for (const { kind } of SNAPSHOT_KINDS) {
    if (existsSync(path.join(catalogsRoot, kind, "index.json"))) current[kind] = await readSnapshotKind(catalogsRoot, kind);
  }
  const manifestPath = path.join(catalogsRoot, "manifest.json");
  const manifest = existsSync(manifestPath) ? await readJson(manifestPath) : undefined;
  return { current, manifest };
}

function gallerySource(galleryDir, allowDirty) {
  const git = (args) => execFileSync("git", ["-C", galleryDir, ...args], { encoding: "utf8" }).trim();
  const commit = git(["rev-parse", "HEAD"]);
  const dirty = git(["status", "--porcelain", "--", GALLERY_PUBLISHED_PATH, "data"]);
  if (dirty && !allowDirty) {
    throw new Error(`The gallery checkout has uncommitted catalog changes, so its commit would not pin them:\n${dirty}\nCommit them first (or pass --allow-dirty for a dry run).`);
  }
  return { repository: GALLERY_REPOSITORY, commit, path: GALLERY_PUBLISHED_PATH };
}

function printReport(plan) {
  for (const { kind } of SNAPSHOT_KINDS) {
    const planned = plan.kinds[kind];
    const entry = planned.manifestEntry;
    const extra = planned.galleryOnly.length
      ? `; gallery-only ${planned.galleryOnly.length}: ${planned.galleryOnly.slice(0, 8).join(", ")}${planned.galleryOnly.length > 8 ? ", ..." : ""}`
      : "";
    process.stdout.write(`${kind}: ${entry.mode} ${entry.records}/${entry.gallery.records}${extra}\n`);
  }
}

function option(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

export async function main(argv = process.argv.slice(2)) {
  const catalogsRoot = path.resolve(option(argv, "--catalogs") ?? defaultCatalogsRoot);

  if (argv.includes("--verify")) {
    const problems = await verifySnapshot(catalogsRoot);
    if (problems.length > 0) throw new Error(`Default-catalog snapshot is inconsistent:\n${problems.join("\n")}`);
    process.stdout.write("Default-catalog snapshot matches its manifest.\n");
    return;
  }

  const galleryDir = option(argv, "--gallery");
  const url = option(argv, "--url");
  if (!galleryDir && !url) throw new Error("Pass --gallery <pptx-gallery checkout> or --url <base URL> (or --verify).");

  const { current, manifest } = await readCurrentSnapshot(catalogsRoot);
  let gallery;
  let source;
  if (galleryDir) {
    const dir = path.resolve(galleryDir);
    gallery = await readGalleryCheckout(dir);
    source = gallerySource(dir, argv.includes("--allow-dirty") || argv.includes("--check") || argv.includes("--report"));
  } else {
    gallery = await fetchGalleryCatalog(url);
    // A live fetch cannot name a commit; keep the pinned source so --check
    // compares content only.
    source = manifest?.source ?? { repository: GALLERY_REPOSITORY, commit: "unpinned", path: GALLERY_PUBLISHED_PATH };
  }

  const plan = planSnapshot({ gallery, current, manifest, validators: await loadValidators(), source });
  if (plan.problems.length > 0) throw new Error(`Gallery catalog cannot be snapshotted:\n${plan.problems.join("\n")}`);

  if (argv.includes("--report")) {
    printReport(plan);
    return;
  }

  if (argv.includes("--check")) {
    const changes = await diffSnapshot(catalogsRoot, plan);
    if (changes.length > 0) {
      throw new Error(`spec/catalogs does not match the gallery catalog (${changes.length} file(s)); run scripts/sync-gallery-catalog.mjs --gallery <checkout>:\n${changes.slice(0, 40).join("\n")}`);
    }
    process.stdout.write(`spec/catalogs matches the gallery catalog at ${source.commit}.\n`);
    return;
  }

  const changes = await applySnapshot(catalogsRoot, plan);
  printReport(plan);
  process.stdout.write(`${changes.length} file(s) updated.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message ?? error}\n`);
    process.exit(1);
  });
}
