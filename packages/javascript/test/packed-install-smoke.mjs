import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "opf-packed-smoke-"));
const packDir = path.join(tmpRoot, "pack");
const projectDir = path.join(tmpRoot, "project");

async function run(command, args, options = {}) {
  try {
    return await execFile(command, args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    error.message = `${error.message}${stdout}${stderr}`;
    throw error;
  }
}

function assertTarIncludes(files, entry) {
  assert.ok(files.includes(entry), `packed tarball should include ${entry}`);
}

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );

  const packResult = await run("npm", ["pack", packageRoot, "--pack-destination", packDir]);
  const tgzName = packResult.stdout.trim().split(/\r?\n/).at(-1);
  assert.ok(tgzName?.endsWith(".tgz"), `npm pack did not return a tarball name: ${packResult.stdout}`);

  const tgzPath = path.join(packDir, tgzName);
  const tarResult = await run("tar", ["-tzf", tgzPath]);
  const files = tarResult.stdout.trim().split(/\r?\n/).filter(Boolean).sort();

  for (const entry of [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/dist/index.js",
    "package/dist/schemas.js",
    "package/dist/catalogs.js",
    "package/dist/validator.js",
    "package/dist/types.js",
    "package/dist/spec/schemas/opf.schema.json",
    "package/dist/spec/catalogs/audiences/board.json",
  ]) {
    assertTarIncludes(files, entry);
  }

  assert.equal(files.includes("package/dist/spec/openapi.yaml"), false, "OpenAPI service contract should not ship in the npm package");
  assert.equal(files.some((file) => file.endsWith(".map")), false, "npm package should not ship source maps");

  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tgzPath], { cwd: projectDir });
  await writeFile(
    path.join(projectDir, "smoke.mjs"),
    `import assert from "node:assert/strict";
import {
  catalogs,
  presentation,
  validate,
  validatePresentation,
} from "@openpresentation/opf";
import { presentation as focusedPresentation } from "@openpresentation/opf/schemas";
import { tones } from "@openpresentation/opf/catalogs";
import { assertValid, validate as focusedValidate } from "@openpresentation/opf/validator";
import * as typesRuntime from "@openpresentation/opf/types";
import rawPresentation from "@openpresentation/opf/spec/schemas/opf.schema.json" with { type: "json" };
import rawBoardAudience from "@openpresentation/opf/spec/catalogs/audiences/board.json" with { type: "json" };

assert.equal(presentation.$id, "https://openpresentation.org/schema/opf/v1");
assert.equal(focusedPresentation.$id, presentation.$id);
assert.equal(rawPresentation.$id, presentation.$id);
assert.equal(rawBoardAudience.id, "board");
assert.ok(catalogs.audiences.some((audience) => audience.id === "executives"));
assert.ok(tones.length > 0);
assert.deepEqual(Object.keys(typesRuntime), []);

const validDeck = {
  name: "Packed Package Smoke",
  audience: ["executives"],
  slides: [{ title: "Smoke Test", items: ["Root import", "Focused import", "Raw JSON import"] }],
};

assert.equal(validatePresentation(validDeck).valid, true);
assert.equal(validate(validDeck, "presentation").valid, true);
assert.equal(focusedValidate(validDeck, "presentation").valid, true);
assert.doesNotThrow(() => assertValid(validDeck));

const invalidDeck = {
  name: "Invalid Packed Package Smoke",
  slides: [{ type: "placeholder" }],
};
const invalidResult = validatePresentation(invalidDeck);
assert.equal(invalidResult.valid, false, "invalid deck should fail validation");
assert.ok(invalidResult.errors.length > 0, "invalid deck should return validation errors");
`,
  );
  await run(process.execPath, ["smoke.mjs"], { cwd: projectDir });

  const { size } = await stat(tgzPath);
  process.stdout.write(`Packed install smoke passed for ${tgzName} (${size} bytes).\n`);
  process.stdout.write(`Packed tarball entries checked: ${files.length}.\n`);
} finally {
  if (process.env.OPF_KEEP_PACKED_SMOKE_TMP) {
    process.stdout.write(`Preserved packed smoke temp directory: ${tmpRoot}\n`);
  } else {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}
