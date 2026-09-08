import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import { presentation, specFileEntries, specFilePaths } from "../dist/index.js";
import { specFileEntries as focusedSpecFileEntries } from "../dist/spec-files.js";

describe("spec file manifest", () => {
  test("spec-files subpath export matches the main index's specFileEntries", () => {
    assert.equal(focusedSpecFileEntries.length, specFileEntries.length);
  });

  test("specFilePaths includes the expected canonical paths", () => {
    assert.ok(specFilePaths.includes("openapi.yaml"));
    assert.ok(specFilePaths.includes("schemas/opf.schema.json"));
    assert.ok(specFilePaths.includes("catalogs/layouts/index.json"));
  });

  test("openapi.yaml manifest entry has the expected kind, mediaType, and packagePath", () => {
    assert.equal(specFileEntries.find((entry) => entry.path === "openapi.yaml")?.kind, "openapi");
    assert.equal(specFileEntries.find((entry) => entry.path === "openapi.yaml")?.mediaType, "application/yaml");
    assert.equal(
      specFileEntries.find((entry) => entry.path === "openapi.yaml")?.packagePath,
      "@openpresentation/opf/spec/openapi.yaml",
    );
  });
});

describe("dist/spec assets", () => {
  test("dist/spec ships openapi.yaml, the presentation schema, and the layouts catalog index", () => {
    assert.ok(existsSync(new URL("../dist/spec/openapi.yaml", import.meta.url)));
    assert.ok(existsSync(new URL("../dist/spec/schemas/opf.schema.json", import.meta.url)));
    assert.ok(existsSync(new URL("../dist/spec/catalogs/layouts/index.json", import.meta.url)));
  });

  test("dist/spec/openapi.yaml starts with an 'openapi:' declaration", () => {
    assert.match(readFileSync(new URL("../dist/spec/openapi.yaml", import.meta.url), "utf8"), /^openapi:/m);
  });

  test("dist/spec/schemas/opf.schema.json $id matches the exported presentation schema's $id", () => {
    const require = createRequire(import.meta.url);
    const rawPresentation = require("../dist/spec/schemas/opf.schema.json");
    assert.equal(rawPresentation.$id, presentation.$id);
  });
});
