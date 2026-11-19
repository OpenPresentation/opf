// The install the quickstart documents has only the Roboto font packages. On it, a deck whose design names Consolas (drawn with Cousine)
// is a fonts/font-package-not-installed finding in opf validate, not an internal error; opf doctor answers for the deck it is given
// (only the packages that deck's faces need, the others apart) and agrees with opf convert; and a face drawn with another face is one
// fonts/font-substituted info finding per family. The tree is the real build of core and opf-render with every font package the
// workspace has except the office-compatible ones the quickstart does not install.
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
const quickstartDeck = fileURLToPath(new URL("../../../docs/quickstart/developer-quickstart.opf.json", import.meta.url));
// The quickstart installs roboto and roboto-mono; these are the office-compatible packages it leaves out.
const ABSENT = new Set(["caladea", "arimo", "tinos", "cousine", "gelasio", "noto-sans"]);
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-font-packages-")));
after(() => rm(temp, { recursive: true, force: true }));

const pins = JSON.parse(await readFile(path.join(renderRoot, "package.json"), "utf8")).peerDependencies;
const COUSINE = "@expo-google-fonts/cousine";
const cousine = `${COUSINE}@${pins[COUSINE]}`;

const run = (args, { status = 0 } = {}) => {
  const result = spawnSync(process.execPath, [path.join(temp, "dist", path.basename(executable)), ...args], { cwd: temp, encoding: "utf8", timeout: 120000, env: { ...process.env, npm_config_user_agent: "" } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  return result;
};
const write = (name, deck) => writeFile(path.join(temp, name), JSON.stringify(deck));

describe("font packages on the quickstart's install", () => {
  before(async () => {
    const modules = path.join(temp, "node_modules");
    await cp(path.dirname(executable), path.join(temp, "dist"), { recursive: true });
    await installIsolatedCore(modules);
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
    await write("mono.opf.json", { language: "en", design: { fontScheme: { heading: "Consolas", body: "Consolas" } }, slides: [{ title: "Mono", text: "Body text" }, { title: "Again", text: "More text" }] });
    await write("aptos.opf.json", { language: "en", slides: [{ title: "One", text: "Body" }, { title: "Two", text: "Body" }, { title: "Three", text: "Body" }] });
    await cp(quickstartDeck, path.join(temp, "quickstart.opf.json"));
  });

  test("validate: a missing font package is a warning finding naming the face and the install line, and layout is estimated", () => {
    const report = JSON.parse(run(["validate", "mono.opf.json"]).stdout);
    assert.equal(report.ok, true);
    const found = report.findings.filter((finding) => finding.ruleId === "fonts/font-package-not-installed");
    assert.equal(found.length, 1, JSON.stringify(report.findings));
    const [finding] = found;
    assert.equal(finding.severity, "warning");
    assert.deepEqual(finding.packages, [cousine]);
    assert.deepEqual(finding.faces, ["Cousine"]);
    assert.equal(finding.install, `npm install ${cousine}`);
    assert.ok(finding.message.includes(`Install it: npm install ${cousine}`), finding.message);
    assert.equal(report.checks.layout, "estimated");
    assert.match(report.hint, /Layout was estimated: @expo-google-fonts\/cousine is not installed/);
    // The CLI's exit-code contract for a warning: 1 only under --fail-on warning; --ignore drops it.
    run(["validate", "mono.opf.json", "--fail-on", "warning"], { status: 1 });
    const ignored = JSON.parse(run(["validate", "mono.opf.json", "--ignore", "fonts/font-package-not-installed"]).stdout);
    assert.equal(ignored.findings.some((item) => item.ruleId === "fonts/font-package-not-installed"), false);
    const text = run(["validate", "mono.opf.json", "--format", "text"]).stdout;
    assert.match(text, /warning fonts\/font-package-not-installed {2}@expo-google-fonts\/cousine, which draws the Cousine font this deck uses, is not installed/);
  });

  test("doctor with that deck names only the package its faces need; the others are listed apart", () => {
    const report = JSON.parse(run(["doctor", "mono.opf.json"]).stdout);
    assert.deepEqual(report.deckFonts, { checked: true, uses: [], missing: [cousine], faces: ["Cousine"] });
    assert.deepEqual(report.findings.map((finding) => finding.ruleId), ["fonts/font-package-not-installed"]);
    for (const format of ["svg", "png", "pdf", "pdf-raster"]) assert.deepEqual(report.formats[format].missing, [cousine], format);
    assert.equal(report.install, `npm install ${[...report.missing].join(" ")}`);
    assert.ok(report.missing.includes(cousine));
    assert.equal(report.missing.some((name) => /caladea|arimo|tinos|gelasio|noto-sans@/.test(name)), false, JSON.stringify(report.missing));
    assert.equal(report.fontPackages.unusedByDeck, false);
    assert.ok(report.fontPackages.others.some((fact) => fact.name === "@expo-google-fonts/caladea" && !fact.installed));
  });

  test("doctor and convert agree on the quickstart deck: it can be drawn, and the unused office faces are apart", () => {
    const report = JSON.parse(run(["doctor", "quickstart.opf.json"]).stdout);
    for (const format of ["svg", "png", "pdf"]) assert.deepEqual(report.formats[format], { ready: true, missing: [] }, format);
    assert.ok(report.deckFonts.uses.includes("@expo-google-fonts/roboto"), JSON.stringify(report.deckFonts));
    assert.equal(report.fontPackages.unusedByDeck, true);
    const others = report.fontPackages.others.map((fact) => fact.name);
    for (const name of ABSENT) assert.ok(others.includes(`@expo-google-fonts/${name}`), name);
    assert.equal(others.includes("@expo-google-fonts/roboto"), false);
    const text = run(["doctor", "quickstart.opf.json", "--format", "text"]).stdout;
    assert.match(text, /^ {2}svg {10}ready$/m);
    assert.match(text, /Font packages this deck does not use/);
    run(["convert", "quickstart.opf.json", "quickstart.svg", "--force"]);
    // Without a deck, the font packages do not decide readiness either.
    const plain = JSON.parse(run(["doctor"]).stdout);
    assert.deepEqual(plain.formats.svg, { ready: true, missing: [] });
  });

  test("convert: a face drawn with another face is one info finding per family, not per slide", () => {
    const report = JSON.parse(run(["convert", "aptos.opf.json", "aptos.svg", "--force"]).stdout);
    const substituted = report.findings.filter((finding) => finding.ruleId === "fonts/font-substituted");
    assert.deepEqual(substituted.map((finding) => [finding.severity, finding.requested, finding.resolved]).sort((a, b) => (a[1] < b[1] ? -1 : 1)), [["info", "Aptos", ["Intos"]], ["info", "Aptos Display", ["Intos Display"]]]);
    assert.match(substituted[0].message, /a metric-compatible substitute.*proprietary font that OPF does not bundle/);
    assert.equal(report.fonts.substitutions.length, 2);
  });

  test("convert of the Consolas deck stops with the renderer's sentence naming the package and its face", () => {
    const result = run(["convert", "mono.opf.json", "mono.svg", "--force"], { status: 2 });
    const report = JSON.parse(result.stderr || result.stdout);
    assert.equal(report.code, "font-resource-unavailable");
    assert.match(report.error, /^This presentation needs a font package that is not installed \(an optional peer dependency of @openpresentation\/opf-render\): @expo-google-fonts\/cousine \(Cousine\)\./);
  });
});
