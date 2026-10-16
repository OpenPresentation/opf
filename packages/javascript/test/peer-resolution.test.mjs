// Doctor must inspect the optional packages that the selected renderer will actually resolve.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";

const font = "@expo-google-fonts/arimo";
const render = "@openpresentation/opf-render";
async function fixturePackage(modules, name, version) {
  const root = path.join(modules, name);
  await mkdir(root, { recursive: true });
  const manifest = path.join(root, "package.json");
  await writeFile(manifest, JSON.stringify({ name, version, type: "module", exports: { ".": "./index.js", "./package.json": "./package.json" } }));
  await writeFile(path.join(root, "index.js"), "// Resolution-only fixture; no renderer or font code executes.\n");
  return manifest;
}

test("explicit renderer bases use only the renderer's actual resolution chain", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "opf-peer-resolution-")));
  try {
    const globalModules = path.join(root, "global", "node_modules");
    const project = path.join(root, "project");
    const projectModules = path.join(project, "node_modules");
    const core = await installIsolatedCore(globalModules);
    const globalFont = await fixturePackage(globalModules, font, "0.4.3");
    const renderer = await fixturePackage(projectModules, render, "0.20.0");
    const engine = pathToFileURL(path.join(core, "dist", "node-engine.js")).href;
    const locate = (name, from) => {
      const code = `const {locatePackage}=await import(${JSON.stringify(engine)}); console.log(JSON.stringify(locatePackage(${JSON.stringify(name)},${JSON.stringify(from)}) ?? null));`;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: project, encoding: "utf8", timeout: 30000 });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };
    // Root engine discovery is unchanged: core has no renderer, but the caller's project does.
    assert.equal(locate(render).manifest, renderer);
    assert.equal(locate(font).manifest, globalFont);
    // A global copy does not make the project's renderer ready when that renderer cannot resolve the peer.
    assert.throws(() => createRequire(renderer).resolve(`${font}/package.json`), { code: "MODULE_NOT_FOUND" });
    assert.equal(locate(font, renderer), null);
    // Conflicting installed versions must report the copy selected by normal renderer resolution.
    const projectFont = await fixturePackage(projectModules, font, "0.3.0");
    assert.equal(createRequire(renderer).resolve(`${font}/package.json`), projectFont);
    assert.deepEqual(locate(font, renderer), { manifest: projectFont, version: "0.3.0" });
    // A renderer next to core can resolve the shared peer normally, without a fallback to another tree.
    const globalRenderer = await fixturePackage(globalModules, render, "0.20.0");
    assert.equal(createRequire(globalRenderer).resolve(`${font}/package.json`), globalFont);
    assert.deepEqual(locate(font, globalRenderer), { manifest: globalFont, version: "0.4.3" });
    assert.equal(locate(render).manifest, globalRenderer);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
