// RR-75: `opf convert`, the one command for every change of format (it absorbed render, export, import, from-md, to-md, from-yaml
// and to-yaml). Deck-to-deck pairs and every usage error need no optional peer and always run; drawing runs against stand-in
// opf-render and opf-pptx packages that record what the engine asks of them (scripts/stub-peers.mjs), so it runs whatever renderer
// the workspace has; a missing peer is a copy of the build and of core in a tree without peers.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { STUB_LOG, installStubPeers, parseStubLog } from "../../../scripts/stub-peers.mjs";

const cliRoot = fileURLToPath(new URL("..", import.meta.url));
const executable = process.env.OPF_TEST_BIN ?? path.join(cliRoot, "dist", "index.js");
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-convert-command-")));
after(() => rm(temp, { recursive: true, force: true }));

const deck = { name: "Convert deck", slides: [{ title: "One" }, { title: "Two", items: ["a", "b"] }, { title: "Three" }] };

function run(args, { status = 0, cwd = temp, bin = executable, input, env } = {}) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, input, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, npm_config_user_agent: "", ...env } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  const parse = (text) => {
    try {
      return JSON.parse(text.slice(Math.max(0, text.indexOf("{"))));
    } catch {
      return undefined;
    }
  };
  return { report: parse(result.stdout), error: parse(result.stderr), stdout: result.stdout, stderr: result.stderr };
}
let counter = 0;
async function folder(presentation = deck) {
  const dir = path.join(temp, `case-${++counter}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "deck.opf.json"), `${JSON.stringify(presentation, null, 2)}\n`);
  return dir;
}

describe("opf convert, deck to deck", () => {
  test("every pair of forms, by the output's name, with the report envelope", async () => {
    const dir = await folder();
    const { report } = run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: dir });
    assert.deepEqual(Object.keys(report).slice(0, 6), ["command", "ok", "input", "outputs", "findings", "counts"]);
    assert.equal(report.command, "convert");
    assert.equal(report.format, "markdown");
    assert.equal(report.ok, true);
    assert.equal(report.input.file, path.join(dir, "deck.opf.json"));
    assert.match(report.input.sha256, /^[0-9a-f]{64}$/);
    assert.equal(report.outputs.length, 1);
    assert.deepEqual(Object.keys(report.outputs[0]), ["file", "sha256", "bytes", "mediaType"]);
    assert.equal(report.outputs[0].file, path.join(dir, "deck.opf.md"));
    assert.equal(report.outputs[0].mediaType, "text/markdown");
    assert.deepEqual(report.counts, { error: 0, warning: 0, info: 0 });
    assert.match(await readFile(path.join(dir, "deck.opf.md"), "utf8"), /^---\nname: Convert deck\n---/);
    run(["convert", "deck.opf.md", "nested/deck.opf.yaml"], { cwd: dir });
    assert.match(await readFile(path.join(dir, "nested", "deck.opf.yaml"), "utf8"), /^name: Convert deck\n/);
    run(["convert", "nested/deck.opf.yaml", "back.json"], { cwd: dir });
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, "back.json"), "utf8")), deck);
    run(["convert", "nested/deck.opf.yaml", "deck.yml"], { cwd: dir });
    // A plain .md input is OPF Markdown, an outline included.
    await writeFile(path.join(dir, "outline.md"), "# A\n- x\n# B\ntext\n");
    run(["convert", "outline.md", "outline.opf.yaml"], { cwd: dir });
    assert.equal(await readFile(path.join(dir, "outline.opf.yaml"), "utf8"), "slides:\n  - title: A\n    items:\n      - x\n  - title: B\n    text: text\n");
  });

  test("stdin and stdout: --from (or { and [ sniffed as JSON), --to for stdout, the report on stderr", async () => {
    const yaml = run(["convert", "-", "-", "--to", "yaml"], { input: JSON.stringify(deck) });
    assert.match(yaml.stdout, /^name: Convert deck\n/);
    assert.equal(yaml.error.outputs[0].file, "-");
    assert.equal(yaml.error.input.file, "-");
    const md = run(["convert", "-", "-", "--from", "yaml", "--to", "md"], { input: yaml.stdout });
    assert.match(md.stdout, /^---\nname: Convert deck\n---/);
    const unknown = run(["convert", "-", "-", "--to", "json"], { input: "name: x\n", status: 2 });
    assert.equal(unknown.error.code, "unknown-input-format");
    assert.match(unknown.error.error, /--from yaml\|md\|pptx/);
    const noTo = run(["convert", "deck.opf.json", "-"], { cwd: await folder(), status: 2 });
    assert.match(noTo.error.error, /stdout needs --to/);
  });

  test("--schema-comment and --to agree with the output's name or are refused", async () => {
    const dir = await folder();
    run(["convert", "deck.opf.json", "deck.opf.yaml", "--schema-comment"], { cwd: dir });
    assert.match(await readFile(path.join(dir, "deck.opf.yaml"), "utf8"), /^# yaml-language-server: \$schema=/);
    run(["convert", "deck.opf.json", "deck2.opf.yaml", "--to", "yaml"], { cwd: dir });
    assert.equal(run(["convert", "deck.opf.json", "deck3.opf.yaml", "--to", "json"], { cwd: dir, status: 2 }).error.code, "invalid-value");
    assert.equal(run(["convert", "deck.opf.json", "deck.pdf", "--to", "png"], { cwd: dir, status: 2 }).error.code, "invalid-value");
  });

  test("an existing output exits 1 without --force and is replaced with it", async () => {
    const dir = await folder();
    await writeFile(path.join(dir, "deck.opf.yaml"), "keep");
    const refused = run(["convert", "deck.opf.json", "deck.opf.yaml"], { cwd: dir, status: 1 });
    assert.equal(refused.error.code, "output-exists");
    assert.match(refused.error.error, /Output already exists: .*Use --force/);
    assert.equal(await readFile(path.join(dir, "deck.opf.yaml"), "utf8"), "keep");
    run(["convert", "deck.opf.json", "deck.opf.yaml", "--force"], { cwd: dir });
    assert.match(await readFile(path.join(dir, "deck.opf.yaml"), "utf8"), /^name: Convert deck/);
  });

  test("an invalid deck and a finding at --fail-on exit 1 with the findings and write nothing", async () => {
    const dir = await folder({ slides: 42 });
    const invalid = run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: dir, status: 1 });
    assert.equal(invalid.error.ok, false);
    assert.equal(invalid.error.code, "invalid-document");
    assert.ok(invalid.error.findings.some((found) => found.severity === "error" && found.location));
    assert.equal(existsSync(path.join(dir, "deck.opf.md")), false);
    const warned = await folder({ slides: [{ title: "A", layout: "not-a-layout" }] });
    const gated = run(["convert", "deck.opf.json", "deck.opf.md", "--fail-on", "warning"], { cwd: warned, status: 1 });
    assert.equal(gated.error.code, "findings-at-fail-on");
    assert.equal(gated.error.outputs[0].planned, true);
    assert.equal(existsSync(path.join(warned, "deck.opf.md")), false);
    run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: warned });
  });

  test("names and files: exit 2", async () => {
    const dir = await folder();
    assert.match(run(["convert", "deck.opf.json", "deck.docx"], { cwd: dir, status: 2 }).error.error, /writes \.json, \.opf\.yaml, \.yml, \.opf\.md, \.pdf, \.pptx, \.png, \.svg or \.zip files/);
    assert.equal(run(["convert", "notes.txt", "deck.opf.md"], { cwd: dir, status: 2 }).error.code, "input-not-found");
    assert.equal(run(["convert", "absent.opf.json", "deck.opf.md"], { cwd: dir, status: 2 }).error.code, "input-not-found");
    assert.equal(run(["convert", "deck.opf.json"], { cwd: dir, status: 2 }).error.code, "missing-argument");
    assert.equal(run(["convert", "deck.opf.json", "deck.opf.json"], { cwd: dir, status: 2 }).error.code, "usage");
    run(["convert", "deck.opf.json", "deck.opf.md", "--fail-on", "never"], { cwd: dir, status: 2 });
    assert.equal(run(["convert", "deck.opf.json", "deck.opf.md", "--unknown"], { cwd: dir, status: 2 }).error.code, "unknown-option");
    assert.deepEqual((await readdir(dir)).sort(), ["deck.opf.json"]);
  });
});

describe("opf convert, flags apply only where their format is involved", () => {
  test("each flag outside its format is a usage error (exit 2, option-not-applicable) and nothing is read or written", async () => {
    const dir = await folder();
    await writeFile(path.join(dir, "deck.opf.yaml"), "name: Y\nslides:\n  - title: A\n");
    const cases = [
      [["deck.opf.json", "x.opf.md", "--scale", "2"], /--scale applies to pdf, pptx, png and svg outputs/],
      [["deck.opf.json", "x.opf.yaml", "--slides", "1"], /--slides applies to pdf, pptx, png and svg outputs/],
      [["deck.opf.json", "x.opf.json", "--fonts", "fonts"], /--fonts applies to pdf, pptx, png and svg outputs/],
      [["deck.opf.json", "x.opf.json", "--split", "headings"], /--split applies to a Markdown input/],
      [["deck.opf.json", "x.opf.md", "--title", "T"], /--title applies to a Markdown input/],
      [["deck.opf.json", "x.opf.md", "--aliases"], /--aliases applies to a YAML input/],
      [["deck.opf.yaml", "x.opf.json", "--signals", "s.json"], /--signals applies to a \.pptx input/],
      [["deck.opf.json", "x.opf.json", "--schema-comment"], /--schema-comment applies to a YAML output/],
      [["deck.opf.json", "x.opf.yaml", "--drop-unsupported"], /--drop-unsupported applies to a Markdown/],
    ];
    for (const [args, pattern] of cases) {
      const failed = run(["convert", ...args], { cwd: dir, status: 2 });
      assert.equal(failed.error.code, "option-not-applicable", args.join(" "));
      assert.match(failed.error.error, pattern, args.join(" "));
    }
    assert.deepEqual((await readdir(dir)).sort(), ["deck.opf.json", "deck.opf.yaml"]);
  });
});

describe("a missing peer", () => {
  let isolated;
  before(async () => {
    isolated = await mkdtemp(path.join(temp, "isolated-"));
    await cp(path.dirname(executable), path.join(isolated, "dist"), { recursive: true });
    await installIsolatedCore(path.join(isolated, "node_modules"));
    await writeFile(path.join(isolated, "deck.opf.json"), JSON.stringify(deck));
    await writeFile(path.join(isolated, "picture.opf.json"), JSON.stringify({ slides: [{ title: "P", image: "photo.jpg" }] }));
  });
  const bin = () => path.join(isolated, "dist", path.basename(executable));

  test("exits 2 with peer-not-installed and one exact install command for the format", () => {
    const missing = run(["convert", "deck.opf.json", "deck.png"], { cwd: isolated, bin: bin(), status: 2 });
    assert.equal(missing.error.code, "peer-not-installed");
    assert.equal(missing.error.package, "@openpresentation/opf-render");
    // A copy outside node_modules is a project: npm install without -g, the renderer, its fonts, and the PNG converters.
    assert.match(missing.error.install, /^npm install @openpresentation\/opf-render@\^0\.18\.0 @expo-google-fonts\/roboto@0\.4\.3 .*@resvg\/resvg-js@\^2\.6\.2 sharp@\^0\.35\.5$/);
    assert.ok(missing.error.error.includes(missing.error.install));
    assert.ok(missing.error.missing.includes("@resvg/resvg-js@^2.6.2"));
    // A vector PDF needs sharp only when the deck has pictures; a raster PDF needs pdf-lib.
    assert.doesNotMatch(run(["convert", "deck.opf.json", "deck.pdf"], { cwd: isolated, bin: bin(), status: 2 }).error.install, /sharp|pdf-lib/);
    assert.match(run(["convert", "picture.opf.json", "deck.pdf"], { cwd: isolated, bin: bin(), status: 2 }).error.install, /sharp@/);
    assert.match(run(["convert", "deck.opf.json", "deck.pdf", "--raster"], { cwd: isolated, bin: bin(), status: 2 }).error.install, /pdf-lib@/);
    const importing = run(["convert", "deck.pptx", "deck.opf.json"], { cwd: isolated, bin: bin(), status: 2 });
    assert.equal(importing.error.code, "input-not-found", "the input is read first");
    run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: isolated, bin: bin() });
  });

  test("the install command matches the package manager in npm_config_user_agent", () => {
    for (const [agent, pattern] of [
      ["pnpm/10.0.0 npm/? node/v24.0.0 win32 x64", /^pnpm add @openpresentation\/opf-render@/],
      ["yarn/1.22.0 npm/? node/v24.0.0", /^yarn add @openpresentation\/opf-render@/],
      ["bun/1.2.0 npm/? node/v24.0.0", /^bun add @openpresentation\/opf-render@/],
      ["npm/11.0.0 node/v24.0.0", /^npm install @openpresentation\/opf-render@/],
    ]) {
      const result = run(["convert", "deck.opf.json", "deck.svg"], { cwd: isolated, bin: bin(), status: 2, env: { npm_config_user_agent: agent } });
      assert.match(result.error.install, pattern, agent);
    }
  });
});

describe("drawing, through stub peers", () => {
  let stubbed;
  const callsOf = async (call) => parseStubLog(await readFile(path.join(stubbed.dir, STUB_LOG), "utf8").catch(() => "")).filter((item) => item.call === call);
  before(async () => {
    const dir = await mkdtemp(path.join(temp, "stub-"));
    await cp(path.dirname(executable), path.join(dir, "dist"), { recursive: true });
    await installIsolatedCore(path.join(dir, "node_modules"));
    await installStubPeers(path.join(dir, "node_modules"));
    await mkdir(path.join(dir, "fonts"));
    await writeFile(path.join(dir, "fonts", "a.ttf"), "not a font; the stub never reads it");
    await writeFile(path.join(dir, "deck.opf.json"), JSON.stringify({ name: "Stub deck", slides: [{ title: "One" }, { title: "Two" }] }));
    await writeFile(path.join(dir, "one.opf.md"), "# Only slide\n");
    stubbed = { dir, bin: path.join(dir, "dist", path.basename(executable)) };
  });
  const stub = async (args, status = 0, input) => {
    await writeFile(path.join(stubbed.dir, STUB_LOG), "");
    return run(args, { cwd: stubbed.dir, bin: stubbed.bin, status, input });
  };

  test("the output's extension names the format, so deck.png is PNG and never SVG (the render --out bug)", async () => {
    const png = await stub(["convert", "deck.opf.json", "slides/deck.png", "--scale", "0.5", "--slides", "1-2"]);
    assert.equal(png.report.format, "png");
    assert.deepEqual(png.report.outputs.map((item) => [path.basename(item.file), item.mediaType]), [["deck-1.png", "image/png"], ["deck-2.png", "image/png"]]);
    assert.equal((await callsOf("toPng")).length, 2);
    assert.equal((await callsOf("toPng"))[0].args[0].scale, 0.5);
    const one = await stub(["convert", "one.opf.md", "one.png"]);
    assert.deepEqual(one.report.outputs.map((item) => [path.basename(item.file), item.mediaType]), [["one.png", "image/png"]]);
    const svg = await stub(["convert", "deck.opf.json", "svg/deck.svg", "--text", "paths"]);
    assert.deepEqual(svg.report.outputs.map((item) => item.mediaType), ["image/svg+xml", "image/svg+xml"]);
    for (const call of await callsOf("toSvg")) assert.equal(call.args[1].text, "paths");
    assert.equal((await callsOf("toPng")).length, 0, "an svg output draws no png");
  });

  test("pdf, pptx and zip outputs, and their flags reach the engines", async () => {
    await stub(["convert", "deck.opf.json", "raster.pdf", "--raster"]);
    assert.equal((await callsOf("toPdf"))[0].args[1].raster, true);
    const pptx = await stub(["convert", "deck.opf.json", "deck.pptx", "--charts", "picture", "--images", "preserve"]);
    assert.equal(pptx.report.outputs[0].mediaType, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    assert.equal((await callsOf("toPptx"))[0].args[0].chartex, "fallback");
    const zip = await stub(["convert", "deck.opf.json", "slides.zip", "--to", "svg"]);
    assert.deepEqual(zip.report.outputs[0].entries, ["slides-1.svg", "slides-2.svg"]);
    assert.equal(zip.report.outputs[0].mediaType, "application/zip");
    const fonts = await stub(["convert", "deck.opf.json", "fonts.svg", "--fonts", "fonts", "--slides", "1"]);
    assert.match((await callsOf("loadFonts"))[0].args[0].faces[0].path, /fonts[\\/]a\.ttf$/);
    assert.equal(fonts.report.fonts.userFonts.length, 1);
  });

  test("stdout carries one file: --to pdf, or one slide as png or svg", async () => {
    const pdf = await stub(["convert", "deck.opf.json", "-", "--to", "pdf"]);
    assert.equal(pdf.stdout, "%PDF-stub");
    const report = JSON.parse(pdf.stderr);
    assert.equal(report.outputs[0].file, "-");
    assert.equal(report.outputs[0].mediaType, "application/pdf");
    const md = await stub(["convert", "-", "-", "--from", "md", "--to", "svg"], 0, "# Piped\n");
    assert.match(md.stdout, /^<svg/);
    const many = await stub(["convert", "deck.opf.json", "-", "--to", "png"], 2);
    assert.match(many.error.error, /stdout takes one file, but 2 slides/);
    await stub(["convert", "deck.opf.json", "-", "--to", "png", "--slides", "2"]);
    assert.deepEqual((await callsOf("toSvg")).map((call) => call.args[0]), [2]);
  });

  test("format flags outside their format: --text, --raster, --charts, --images and --scale", async () => {
    const messages = [
      [["deck.opf.json", "x.pdf", "--text", "paths"], /--text applies to svg output/],
      [["deck.opf.json", "x.svg", "--raster"], /--raster applies to pdf output/],
      [["deck.opf.json", "x.svg", "--charts", "native"], /--charts, --provenance and --images apply to pptx output/],
      [["deck.opf.json", "x.pptx", "--images", "jpeg"], /--images must be one of: compatible, preserve/],
      [["deck.opf.json", "x.pptx", "--charts", "fallback"], /--charts must be one of: auto, native, picture/],
      [["deck.opf.json", "x.svg", "--text", "outline"], /text must be one of: fonts, system, paths/],
      [["deck.opf.json", "x.svg", "--scale", "2"], /--scale applies to png output/],
    ];
    for (const [args, pattern] of messages) assert.match((await stub(["convert", ...args], 2)).error.error, pattern, args.join(" "));
    assert.deepEqual(await callsOf("toSvg"), [], "nothing was drawn");
  });

  test("the 0.17 flags are usage errors that name their 0.18 replacement", async () => {
    for (const [flag, value, replacement] of [["--svg-fonts", "none", "--text"], ["--pdf-mode", "raster", "--raster"], ["--chartex", "native", "--charts"], ["--image-format", "preserve", "--images"], ["--font-dir", "fonts", "--fonts"], ["--out", "x.pdf", "last argument"], ["--json", undefined, "JSON already"]]) {
      const failed = await stub(["convert", "deck.opf.json", "x.svg", flag, ...(value === undefined ? [] : [value])], 2);
      assert.equal(failed.error.code, "removed-option", flag);
      assert.ok(failed.error.error.includes(replacement), `${flag}: ${failed.error.error}`);
    }
  });
});
