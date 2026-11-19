// The files the bundled examples reference (./assets/logo.svg) are published under dist/example-files/, so `opf create --example`
// can copy them next to a new deck.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { localAssetSources } from "../dist/index.js";
import { examples } from "../dist/examples.js";

const root = fileURLToPath(new URL("../dist/example-files/", import.meta.url));
const sourceRoot = fileURLToPath(new URL("../../../examples/", import.meta.url));

test("every local image an example names, that exists in examples/, is published with the package", () => {
  let checked = 0;
  for (const example of examples) {
    const folder = path.posix.dirname(example.file.replace(/^examples\//, ""));
    for (const source of localAssetSources(example.deck)) {
      if (!source.startsWith("./") || !existsSync(path.join(sourceRoot, folder, source))) continue;
      assert.ok(existsSync(path.join(root, folder, source)), `${example.slug}: ${source} is not in dist/example-files/${folder}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 13, `expected the technical examples' assets, checked ${checked}`);
});
