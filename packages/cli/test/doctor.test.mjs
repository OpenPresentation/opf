// RR-75: opf doctor reports, per format, whether this install can write it and the one command that installs what is missing,
// for the package manager in use and the way the CLI is installed. Missing peers: a copy of the build and of core in a tree
// without them; present peers: the same tree with the stand-in opf-render and opf-pptx (scripts/stub-peers.mjs); a global
// install: the copy laid out as <prefix>/lib/node_modules/@openpresentation/cli.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { installStubPeers } from "../../../scripts/stub-peers.mjs";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-doctor-")));
after(() => rm(temp, { recursive: true, force: true }));

const run = (bin, args, { status = 0, cwd, env } = {}) => {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", timeout: 60000, env: { ...process.env, npm_config_user_agent: "", ...env } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 1500), stderr: result.stderr.slice(0, 1500) }));
  return result;
};
/** A copy of the CLI and core under `root`: `<root>/dist/index.js`, or with `global` the layout of a global npm install. */
async function install(name, { stubs = false, global = false } = {}) {
  const root = path.join(temp, name);
  const modules = global ? path.join(root, "lib", "node_modules") : path.join(root, "node_modules");
  const cli = global ? path.join(modules, "@openpresentation", "cli") : root;
  await mkdir(cli, { recursive: true });
  await cp(path.dirname(executable), path.join(cli, "dist"), { recursive: true });
  await installIsolatedCore(modules);
  if (stubs) await installStubPeers(modules);
  await writeFile(path.join(root, "deck.opf.json"), JSON.stringify({ slides: [{ title: "Plain" }] }));
  await writeFile(path.join(root, "picture.opf.json"), JSON.stringify({ slides: [{ title: "Picture", image: "photo.png" }] }));
  return { root, bin: path.join(cli, "dist", path.basename(executable)) };
}

describe("opf doctor", () => {
  let missing, present, global;
  before(async () => {
    missing = await install("missing");
    present = await install("present", { stubs: true });
    global = await install("global", { global: true });
  });

  test("with no peer: the deck forms are ready, every drawing format names what it misses, and one command installs it all", () => {
    const report = JSON.parse(run(missing.bin, ["doctor"], { cwd: missing.root }).stdout);
    assert.deepEqual(Object.keys(report).slice(0, 6), ["command", "ok", "input", "outputs", "findings", "counts"]);
    assert.equal(report.command, "doctor");
    assert.equal(report.ok, false);
    for (const format of ["json", "yaml", "md"]) assert.deepEqual(report.formats[format], { ready: true, missing: [] }, format);
    for (const format of ["svg", "png", "pdf", "pdf-raster", "pptx"]) {
      assert.equal(report.formats[format].ready, false, format);
      assert.ok(report.formats[format].missing.includes("@openpresentation/opf-render@^0.18.0"), format);
    }
    assert.ok(report.formats.png.missing.includes("@resvg/resvg-js@^2.6.2"));
    assert.ok(report.formats["pdf-raster"].missing.includes("pdf-lib@^1.17.1"));
    assert.deepEqual(report.formats["pptx-import"].missing, ["@openpresentation/opf-pptx@^0.18.0"]);
    assert.deepEqual(report.formats.pdf.forPictures, ["sharp@^0.35.5"], "without a deck, what pictures would add");
    assert.equal(report.installed, "project");
    assert.equal(report.packageManager, "npm");
    assert.match(report.install, /^npm install @openpresentation\/opf-render@\^0\.18\.0 /);
    for (const name of report.missing) assert.ok(report.install.includes(name), name);
    assert.equal(report.packages.find((item) => item.name === "@openpresentation/opf-render").installed, false);
  });

  test("with a deck: a PDF needs sharp only when the deck has pictures", () => {
    const plain = JSON.parse(run(missing.bin, ["doctor", "deck.opf.json"], { cwd: missing.root }).stdout);
    assert.equal(plain.pictures, false);
    assert.equal(plain.input.file, path.join(missing.root, "deck.opf.json"));
    assert.equal(plain.formats.pdf.missing.some((name) => name.startsWith("sharp@")), false);
    const pictures = JSON.parse(run(missing.bin, ["doctor", "picture.opf.json"], { cwd: missing.root }).stdout);
    assert.equal(pictures.pictures, true);
    assert.ok(pictures.formats.pdf.missing.includes("sharp@^0.35.5"));
  });

  test("with the peers present: opf-pptx makes pptx-import ready, and what opf-render still needs is listed", () => {
    const report = JSON.parse(run(present.bin, ["doctor"], { cwd: present.root }).stdout);
    assert.deepEqual(report.formats["pptx-import"], { ready: true, missing: [] });
    const render = report.packages.find((item) => item.name === "@openpresentation/opf-render");
    assert.deepEqual([render.installed, render.version, render.ok], [true, "0.18.0", true]);
    assert.equal(report.formats.svg.missing.some((name) => name.startsWith("@openpresentation/opf-render")), false);
    assert.ok(report.formats.svg.missing.every((name) => name.startsWith("@expo-google-fonts/")), JSON.stringify(report.formats.svg));
    assert.equal(report.install.includes("@openpresentation/opf-render"), false);
  });

  test("the command follows the package manager and the install: global, pnpm, yarn, bun", () => {
    const report = JSON.parse(run(global.bin, ["doctor"], { cwd: global.root }).stdout);
    assert.equal(report.installed, "global");
    assert.match(report.install, /^npm install -g @openpresentation\/opf-render@/);
    for (const [agent, pattern] of [["pnpm/10.0.0 npm/? node/v24.0.0", /^pnpm add -g /], ["yarn/1.22.0 npm/? node/v24.0.0", /^yarn global add /], ["bun/1.2.0", /^bun add -g /]]) {
      const result = JSON.parse(run(global.bin, ["doctor"], { cwd: global.root, env: { npm_config_user_agent: agent } }).stdout);
      assert.match(result.install, pattern, agent);
      assert.equal(result.packageManager, agent.split("/")[0]);
    }
    assert.match(JSON.parse(run(missing.bin, ["doctor"], { cwd: missing.root, env: { npm_config_user_agent: "pnpm/10.0.0" } }).stdout).install, /^pnpm add @openpresentation/);
  });

  test("--format text is for people; doctor exits 0 unless its arguments are wrong", () => {
    const text = run(missing.bin, ["doctor", "--format", "text"], { cwd: missing.root }).stdout;
    assert.match(text, /^opf \d+\.\d+\.\d+/);
    assert.match(text, /^ {2}json {9}ready$/m);
    assert.match(text, /^ {2}svg {10}missing @openpresentation\/opf-render/m);
    assert.match(text, /Install what is missing:\n {2}npm install /);
    run(missing.bin, ["doctor", "--format", "yaml"], { cwd: missing.root, status: 2 });
    run(missing.bin, ["doctor", "a.json", "b.json"], { cwd: missing.root, status: 2 });
    run(missing.bin, ["doctor", "missing.opf.json"], { cwd: missing.root, status: 2 });
  });
});
