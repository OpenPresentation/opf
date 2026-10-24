import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkSchemaStrict } from "./check-schema-strict.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

async function mutate(action) {
  const dir = await mkdtemp(path.join(tmpdir(), "opf-schema-strict-"));
  try {
    await cp(path.join(root, "spec/schemas"), dir, { recursive: true });
    const file = path.join(dir, "opf.schema.json");
    const schema = JSON.parse(await readFile(file, "utf8"));
    action(schema);
    await writeFile(file, JSON.stringify(schema));
    return await checkSchemaStrict({ schemaRoot: dir });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("every published schema compiles under strict Ajv with no addKeyword", async () => {
  const result = await checkSchemaStrict();
  assert.deepEqual(result.failures, []);
  assert.ok(result.schemas >= 15);
});

test("an annotation keyword in a published schema is rejected", async () => {
  const result = await mutate((schema) => {
    schema.$defs.Slide.properties.layout["x-opf-catalog"] = "layouts";
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((failure) => failure.includes("unknown keyword") && failure.includes("x-opf-catalog")), result.failures.join("\n"));
});
