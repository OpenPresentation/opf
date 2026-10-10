// Every record of catalog/ is valid against the companion schema of the PUBLISHED @openpresentation/opf this repository pins
// (devDependencies), every index against the catalog index schema, and every kind hashes to its index and the manifest. No
// workspace build of core is involved.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateCatalogRecord } from "@openpresentation/opf";
import { SNAPSHOT_KINDS, readSnapshotKind, stripExtensions, verifySnapshot } from "../scripts/catalog-snapshot.mjs";
import { licenseProblems } from "../scripts/check-license.mjs";
import { loadValidators } from "../scripts/sync-gallery-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogRoot = path.join(root, "catalog");

test("every record is valid against the published core's companion schema", async () => {
  let count = 0;
  for (const { kind, catalogKey, recordSchemaId } of SNAPSHOT_KINDS) {
    const { records } = await readSnapshotKind(catalogRoot, kind);
    for (const record of records) {
      assert.equal(record.$schema, recordSchemaId, `${kind}/${record.id}.json $schema`);
      const result = validateCatalogRecord(catalogKey, record);
      assert.equal(result.valid, true, `${kind}/${record.id}.json: ${JSON.stringify(result.findings ?? result.errors ?? result)}`);
      count += 1;
    }
  }
  assert.ok(count > 500, `${count} records`);
});

test("every index is valid against the catalog index schema, and the manifest against its schema", async () => {
  const validators = await loadValidators();
  for (const { kind } of SNAPSHOT_KINDS) {
    const { index } = await readSnapshotKind(catalogRoot, kind);
    assert.equal(validators.index(stripExtensions(index)), true, `${kind}/index.json: ${JSON.stringify(validators.index.errors)}`);
  }
  const manifest = JSON.parse(readFileSync(path.join(catalogRoot, "manifest.json"), "utf8"));
  assert.equal(validators.manifest(manifest), true, `manifest.json: ${JSON.stringify(validators.manifest.errors)}`);
});

test("every kind hashes to the value its index and the manifest record", async () => {
  assert.deepEqual(await verifySnapshot(catalogRoot), []);
});

test("the repository and the package are MIT", () => {
  const license = readFileSync(path.join(root, "LICENSE"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(licenseProblems(license, manifest), []);
  assert.deepEqual(licenseProblems("Apache License\n", { license: "Apache-2.0", files: ["dist"] }).length, 6);
});
