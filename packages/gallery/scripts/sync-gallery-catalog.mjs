#!/usr/bin/env node
// Checks and rehashes catalog/ (the records of @openpresentation/gallery). MR-23: the records are authored by pull requests in
// this package (docs/default-catalog.md); the 1.x sync from a pptx.gallery checkout (`--gallery`, `--url`, `--check`, `--report`,
// `--allow-removed`) is gone with its tests.
//
//   node scripts/sync-gallery-catalog.mjs --verify                     offline: the records match their index and manifest hashes
//   node scripts/sync-gallery-catalog.mjs --rehash                     after an edit of the records: rewrite the index and manifest
//                                                                       hashes and counts
//   node scripts/sync-gallery-catalog.mjs --rehash --match-gallery     the same, and set every kind's gallery block to the new hash
//   node scripts/sync-gallery-catalog.mjs --catalogs <dir>             operate on another catalog directory (tests)
//
// `loadValidators` compiles the record, index and manifest schemas of the repository's spec/schemas (test/records.test.mjs).

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SNAPSHOT_KINDS,
  catalogContentSha256,
  readJson,
  readSnapshotKind,
  serializeJson,
  verifySnapshot,
} from "./catalog-snapshot.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalogsRoot = path.join(repoRoot, "catalog");
// The record schemas are the repository's spec/schemas (core's source of truth; no build needed). ajv comes from core, which the
// repository root links as a devDependency; the gallery package itself has no workspace dependency.
const coreRequire = createRequire(createRequire(path.join(repoRoot, "package.json")).resolve("@openpresentation/opf/package.json"));
const schemasRoot = path.resolve(repoRoot, "..", "..", "spec", "schemas");

// ---------------------------------------------------------------------------
// Validation

let validatorCache;
export async function loadValidators() {
  if (validatorCache) return validatorCache;
  const require = coreRequire;
  const Ajv2020 = require("ajv/dist/2020.js").default;
  const addFormats = require("ajv-formats").default;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  // Record schemas ($ref into the format schema, e.g. a theme's ColorVariant) resolve against it.
  ajv.addSchema(JSON.parse(await readFile(path.join(schemasRoot, "opf.schema.json"), "utf8")));
  const record = {};
  for (const { kind, schemaFile } of SNAPSHOT_KINDS) {
    record[kind] = ajv.compile(JSON.parse(await readFile(path.join(schemasRoot, schemaFile), "utf8")));
  }
  const index = ajv.compile(JSON.parse(await readFile(path.join(schemasRoot, "catalog-index.schema.json"), "utf8")));
  const manifest = ajv.compile(JSON.parse(await readFile(path.join(schemasRoot, "catalog-manifest.schema.json"), "utf8")));
  validatorCache = { record, index, manifest };
  return validatorCache;
}

function option(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

/**
 * Rewrites the index `contentSha256` and the manifest `records` and `contentSha256` of every kind from the
 * records on disk, for a core-first catalog edit (core is the source of truth since the FF-37 decision, so
 * a record can change here before the gallery publishes it). The manifest `source` and each `gallery` block
 * keep describing the pinned gallery commit, so they are never touched. Returns the files it changed.
 *
 * With `matchGallery`, each kind's `gallery` block is set to the new records too. Use it only when the gallery
 * change that publishes the same records is in review (FA-16): every kind must match the gallery hash, and the pin
 * then names the commit before that change.
 */
export async function rehashSnapshot(catalogsRoot, { matchGallery = false } = {}) {
  const manifestFile = path.join(catalogsRoot, "manifest.json");
  const manifest = await readJson(manifestFile);
  const changed = [];
  for (const { kind } of SNAPSHOT_KINDS) {
    const entry = manifest.kinds?.[kind];
    if (!entry) continue;
    const { index, records } = await readSnapshotKind(catalogsRoot, kind);
    const contentSha256 = catalogContentSha256(records);
    if (index.contentSha256 !== contentSha256) {
      await writeFile(path.join(catalogsRoot, kind, "index.json"), serializeJson({ ...index, contentSha256 }), "utf8");
      changed.push(`${kind}/index.json`);
    }
    if (entry.contentSha256 !== contentSha256 || entry.records !== records.length) {
      entry.contentSha256 = contentSha256;
      entry.records = records.length;
      changed.push(`manifest.json (${kind})`);
    }
    if (matchGallery && (entry.gallery?.contentSha256 !== contentSha256 || entry.gallery?.records !== records.length)) {
      entry.gallery = { records: records.length, contentSha256 };
      if (!changed.includes(`manifest.json (${kind})`)) changed.push(`manifest.json (${kind})`);
    }
  }
  if (changed.some((name) => name.startsWith("manifest.json"))) await writeFile(manifestFile, serializeJson(manifest), "utf8");
  return changed;
}

export async function main(argv = process.argv.slice(2)) {
  const catalogsRoot = path.resolve(option(argv, "--catalogs") ?? defaultCatalogsRoot);

  if (argv.includes("--verify")) {
    const problems = await verifySnapshot(catalogsRoot);
    if (problems.length > 0) throw new Error(`The gallery catalog is inconsistent (scripts/sync-gallery-catalog.mjs --rehash rewrites the hashes):\n${problems.join("\n")}`);
    process.stdout.write("The gallery catalog matches its manifest.\n");
    return;
  }

  if (argv.includes("--rehash")) {
    const changed = await rehashSnapshot(catalogsRoot, { matchGallery: argv.includes("--match-gallery") });
    const problems = await verifySnapshot(catalogsRoot);
    if (problems.length > 0) throw new Error(`The gallery catalog is still inconsistent after rehashing:\n${problems.join("\n")}`);
    process.stdout.write(changed.length > 0 ? `Rehashed:\n${changed.join("\n")}\n` : "Hashes already match the records.\n");
    return;
  }

  throw new Error("Pass --verify or --rehash [--match-gallery].");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message ?? error}\n`);
    process.exit(1);
  });
}
