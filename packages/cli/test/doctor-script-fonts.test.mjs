// A deck in another script needs that script's Noto font packages. `opf doctor <deck>` runs the check `opf convert` runs and names the
// packages that are not installed (with their versions); a slide with its own Noto font scheme fails with an error that names the package.
// The tree is the real build of core and opf-render beside every font package the workspace has except the two Arabic ones.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const renderRoot = fileURLToPath(new URL("../../render/", import.meta.url));
const ABSENT = new Set(["noto-naskh-arabic", "noto-sans-arabic"]);
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-doctor-fonts-")));
after(() => rm(temp, { recursive: true, force: true }));

// The exact versions the renderer pins for its script packages.
const pins = JSON.parse(await readFile(path.join(renderRoot, "package.json"), "utf8")).peerDependencies;
const NASKH = "@expo-google-fonts/noto-naskh-arabic";
const SANS = "@expo-google-fonts/noto-sans-arabic";
const both = [`${NASKH}@${pins[NASKH]}`, `${SANS}@${pins[SANS]}`];

const run = (args, { status = 0 } = {}) => {
  const result = spawnSync(process.execPath, [path.join(temp, "dist", path.basename(executable)), ...args], { cwd: temp, encoding: "utf8", timeout: 120000, env: { ...process.env, npm_config_user_agent: "" } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 1500), stderr: result.stderr.slice(0, 1500) }));
  return result;
};
const write = (name, deck) => writeFile(path.join(temp, name), JSON.stringify(deck));
const arabic = { language: "ar", title: "مرحبا", text: "اختر خط الشريحة" };

describe("script fonts in doctor and convert", () => {
  before(async () => {
    const modules = path.join(temp, "node_modules");
    await cp(path.dirname(executable), path.join(temp, "dist"), { recursive: true });
    await installIsolatedCore(modules);
    // A copy of the built renderer: it resolves its font packages from its own location, so they are linked here, not from the workspace.
    const render = path.join(modules, "@openpresentation", "opf-render");
    await mkdir(render, { recursive: true });
    await cp(path.join(renderRoot, "dist"), path.join(render, "dist"), { recursive: true });
    await cp(path.join(renderRoot, "package.json"), path.join(render, "package.json"));
    await symlink(path.join(renderRoot, "fonts"), path.join(render, "fonts"), "junction");
    const link = async (scope, name) => {
      const target = path.join(modules, scope, name);
      await mkdir(path.dirname(target), { recursive: true });
      await symlink(await realpath(path.join(renderRoot, "node_modules", scope, name)), target, "junction");
    };
    for (const name of await readdir(path.join(renderRoot, "node_modules"))) {
      if (!name.startsWith("@")) await link("", name);
      else if (name !== "@openpresentation") {
        for (const inner of await readdir(path.join(renderRoot, "node_modules", name))) if (name !== "@expo-google-fonts" || !ABSENT.has(inner)) await link(name, inner);
      }
    }
    await write("english.opf.json", { slides: [{ title: "English" }] });
    await write("default.opf.json", { slides: [{ title: "English" }, arabic] });
    await write("scheme.opf.json", { slides: [{ title: "English" }, { ...arabic, design: { fontScheme: "noto-sans-arabic" } }] });
    await write("scheme-latin.opf.json", { slides: [{ title: "Arabic scheme", text: "Latin text only", design: { fontScheme: "noto-sans-arabic" } }] });
  });

  test("doctor with an Arabic deck names both packages and does not call the drawn formats ready", () => {
    const report = JSON.parse(run(["doctor", "default.opf.json"]).stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.scriptFonts, { checked: true, missing: both });
    assert.deepEqual(report.findings.map((finding) => [finding.ruleId, finding.package, finding.version]), [[ "fonts/script-font-not-installed", NASKH, pins[NASKH]], ["fonts/script-font-not-installed", SANS, pins[SANS]]]);
    for (const format of ["svg", "png", "pdf", "pdf-raster", "pptx"]) {
      assert.equal(report.formats[format].ready, false, format);
      for (const name of both) assert.ok(report.formats[format].missing.includes(name), `${format} misses ${name}`);
    }
    for (const format of ["json", "yaml", "md", "pptx-import"]) assert.ok(!report.formats[format].missing.some((name) => name.includes("noto")), format);
    for (const name of both) {
      assert.ok(report.install.includes(name), `the install command names ${name}`);
      assert.ok(report.missing.includes(name), `missing lists ${name}`);
    }
  });

  test("doctor's text output lists the packages and never says every format is ready for that deck", () => {
    const text = run(["doctor", "default.opf.json", "--format", "text"]).stdout;
    assert.match(text, /Script fonts this deck needs: @expo-google-fonts\/noto-naskh-arabic@\d+\.\d+\.\d+, @expo-google-fonts\/noto-sans-arabic@\d+\.\d+\.\d+ \(not installed\)/);
    assert.match(text, /svg\s+missing @expo-google-fonts\/noto-naskh-arabic@/);
    assert.doesNotMatch(text, /Every format is ready/);
  });

  test("a deck whose scheme alone selects the Arabic font is found by doctor, as by convert", () => {
    for (const file of ["scheme.opf.json", "scheme-latin.opf.json"]) {
      const report = JSON.parse(run(["doctor", file]).stdout);
      assert.equal(report.scriptFonts.checked, true, file);
      assert.ok(report.scriptFonts.missing.includes(both[0]), file);
      assert.equal(report.formats.svg.ready, false, file);
    }
  });

  test("a Latin deck has nothing missing, and without a deck nothing is said about scripts", () => {
    const english = JSON.parse(run(["doctor", "english.opf.json"]).stdout);
    assert.deepEqual(english.scriptFonts, { checked: true, missing: [] });
    assert.deepEqual(english.findings, []);
    const none = JSON.parse(run(["doctor"]).stdout);
    assert.equal(none.scriptFonts, undefined);
    assert.ok(!JSON.stringify(none.missing).includes("noto-naskh-arabic"));
  });

  test("convert of a slide with its own Noto scheme fails with an error that names the package and version", () => {
    for (const file of ["scheme.opf.json", "scheme-latin.opf.json"]) {
      const failed = run(["convert", file, path.join(temp, `${file}.svg`), "--force"], { status: 1 });
      const report = JSON.parse(failed.stdout || failed.stderr);
      assert.ok(report.error.includes(`install ${both[0]}`), `${file}: ${report.error}`);
      assert.ok(report.findings.some((finding) => finding.ruleId === "fonts/script-font-not-installed" && finding.package === NASKH && finding.version === pins[NASKH]), file);
      assert.ok(report.findings.some((finding) => finding.ruleId === "render/font-unavailable" && finding.message.includes(both[0])), file);
    }
  });

  test("validate names the package in the failed layout of that slide", () => {
    const report = JSON.parse(run(["validate", "scheme-latin.opf.json"]).stdout);
    const failed = report.findings.find((finding) => finding.ruleId === "opf/layout-failed");
    assert.ok(failed.message.includes(`install ${both[0]}`), failed.message);
  });
});
