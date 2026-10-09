// `opf convert` (RR-62), the thin command over `convert` of `@openpresentation/opf`, and the --out rule that `opf render` and
// `opf export` share with it. Deck-to-deck conversions and the errors need no optional peer and always run; the drawing checks
// run through the installed opf-render and opf-pptx and wait, like files.mjs, while those do not satisfy the CLI's peer ranges
// (scripts/unreleased-gate.mjs). A missing peer is simulated with a copy of the build and of core in a tree without peers.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { installIsolatedCore } from "../../../scripts/isolated-core.mjs";
import { STUB_LOG, installStubPeers, parseStubLog } from "../../../scripts/stub-peers.mjs";
import { cliPeerGate, report } from "../../../scripts/unreleased-gate.mjs";

const cliRoot = fileURLToPath(new URL("..", import.meta.url));
const executable = process.env.OPF_TEST_BIN ?? path.join(cliRoot, "dist", "index.js");
const peers = cliPeerGate({ cliRoot, executable, names: ["@openpresentation/opf-render", "@openpresentation/opf-pptx"] });
const skip = report(peers) ? false : "the optional peers are not on npm at the versions the CLI asks for";
// The commands report paths resolved against the working directory, which the OS gives as a real path (macOS /var is
// /private/var): the expected paths start from the real path of the temporary folder too, as files.mjs does.
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-convert-command-")));
after(() => rm(temp, { recursive: true, force: true }));

const deck = { name: "Convert deck", slides: [{ title: "One" }, { title: "Two", items: ["a", "b"] }, { title: "Three" }] };
const PNG = (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

function run(args, { status = 0, cwd = temp, bin = executable } = {}) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  const parse = (text) => {
    try {
      return JSON.parse(text);
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
  test("writes the form the output names and prints the report of opf export", async () => {
    const dir = await folder();
    const { report: out } = run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: dir });
    assert.equal(out.command, "convert");
    assert.equal(out.format, "markdown");
    assert.equal(out.ok, true);
    assert.equal(out.valid, true);
    assert.equal(out.written, true);
    assert.equal(out.input.file, path.join(dir, "deck.opf.json"));
    assert.match(out.input.sha256, /^[0-9a-f]{64}$/);
    assert.equal(out.outputs.length, 1);
    assert.equal(out.outputs[0].file, path.join(dir, "deck.opf.md"));
    assert.equal(out.outputs[0].mediaType, "text/markdown");
    assert.deepEqual(out.counts, { error: 0, warning: 0, info: 0 });
    assert.equal(out.checks.nativeExport, "not-checked");
    assert.match(await readFile(path.join(dir, "deck.opf.md"), "utf8"), /^---\nname: Convert deck\n---/);
    run(["convert", "deck.opf.md", "nested/deck.opf.yaml"], { cwd: dir });
    assert.match(await readFile(path.join(dir, "nested", "deck.opf.yaml"), "utf8"), /^name: Convert deck\n/);
  });

  test("an existing output exits 1 without --force and is replaced with it", async () => {
    const dir = await folder();
    await writeFile(path.join(dir, "deck.opf.yaml"), "keep");
    const refused = run(["convert", "deck.opf.json", "deck.opf.yaml"], { cwd: dir, status: 1 });
    assert.match(refused.error.error, /Output already exists: .*Use --force\./);
    assert.equal(await readFile(path.join(dir, "deck.opf.yaml"), "utf8"), "keep");
    run(["convert", "deck.opf.json", "deck.opf.yaml", "--force"], { cwd: dir });
    assert.match(await readFile(path.join(dir, "deck.opf.yaml"), "utf8"), /^name: Convert deck/);
  });

  test("an invalid deck and a finding at --fail-on exit 1 with the report and write nothing", async () => {
    const dir = await folder({ slides: 42 });
    const invalid = run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: dir, status: 1 });
    assert.equal(invalid.report.ok, false);
    assert.equal(invalid.report.written, false);
    assert.ok(invalid.report.findings.some((found) => found.severity === "error"));
    assert.equal(existsSync(path.join(dir, "deck.opf.md")), false);
    const warned = await folder({ slides: [{ title: "A", layout: "not-a-layout" }] });
    const gated = run(["convert", "deck.opf.json", "deck.opf.md", "--fail-on", "warning"], { cwd: warned, status: 1 });
    assert.equal(gated.report.ok, false);
    assert.equal(gated.report.written, false);
    assert.equal(gated.report.outputs[0].planned, true);
    assert.equal(existsSync(path.join(warned, "deck.opf.md")), false);
    run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: warned });
  });

  test("usage, names and files: exit 2", async () => {
    const dir = await folder();
    assert.match(run(["convert", "deck.opf.json", "deck.docx"], { cwd: dir, status: 2 }).error.error, /writes \.pdf, \.pptx, \.png, \.svg, \.zip, \.opf\.md, \.yaml, \.yml or \.json files/);
    assert.match(run(["convert", "notes.txt", "deck.pdf"], { cwd: dir, status: 2 }).error.error, /reads \.pptx, \.opf\.md, \.yaml, \.yml or \.json files/);
    const missing = run(["convert", "absent.opf.json", "deck.opf.md"], { cwd: dir, status: 2 });
    assert.equal(missing.error.code, "input-not-found");
    run(["convert", "-", "deck.opf.md"], { cwd: dir, status: 2 });
    run(["convert", "deck.opf.json"], { cwd: dir, status: 2 });
    assert.match(run(["convert", "deck.opf.json", "deck.opf.md", "--scale", "2"], { cwd: dir, status: 2 }).error.error, /--scale applies to export outputs/);
    run(["convert", "deck.opf.json", "deck.opf.md", "--fail-on", "never"], { cwd: dir, status: 2 });
    run(["convert", "deck.opf.json", "deck.opf.md", "--unknown"], { cwd: dir, status: 2 });
    assert.deepEqual((await readdir(dir)).sort(), ["deck.opf.json"]);
  });

  test("is listed in opf --help", () => {
    assert.match(run(["--help"]).stdout, /opf convert <input> <output>/);
  });
});

describe("a missing peer", () => {
  test("opf convert to an export format exits 2 with peer-not-installed and the install command", async () => {
    const isolated = await mkdtemp(path.join(temp, "isolated-"));
    await cp(path.dirname(executable), path.join(isolated, "dist"), { recursive: true });
    await installIsolatedCore(path.join(isolated, "node_modules"));
    await writeFile(path.join(isolated, "deck.opf.json"), JSON.stringify(deck));
    const bin = path.join(isolated, "dist", path.basename(executable));
    const missing = run(["convert", "deck.opf.json", "deck.pdf"], { cwd: isolated, bin, status: 2 });
    assert.equal(missing.error.code, "peer-not-installed");
    assert.equal(missing.error.package, "@openpresentation/opf-render");
    assert.match(missing.error.error, /npm install -g @openpresentation\/opf-render@/);
    const importing = run(["convert", "deck.pptx", "deck.opf.json", "--force"], { cwd: isolated, bin, status: 2 });
    assert.equal(importing.error.code, "peer-not-installed");
    assert.equal(importing.error.package, "@openpresentation/opf-pptx");
    run(["convert", "deck.opf.json", "deck.opf.md"], { cwd: isolated, bin });
  });
});

// RR-74 (core part): the flags of 0.18 reach the engine, and the 0.17 flags are gone. A copy of the CLI and of core in a tree with
// stand-in opf-render and opf-pptx packages records what the engine asks of the renderer (scripts/stub-peers.mjs), so this runs
// whatever renderer is installed in the workspace.
describe("the 0.18 flags, through stub peers", () => {
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
    stubbed = { dir, bin: path.join(dir, "dist", path.basename(executable)) };
  });
  const stub = async (args, status = 0) => {
    await writeFile(path.join(stubbed.dir, STUB_LOG), "");
    return run(args, { cwd: stubbed.dir, bin: stubbed.bin, status });
  };

  test("--text paths reaches the renderer's toSvg, with the whole fonts handle; --text system embeds no face", async () => {
    for (const args of [
      ["render", "deck.opf.json", "--format", "svg", "--text", "paths", "--out", "paths", "--force"],
      ["export", "deck.opf.json", "--format", "svg", "--text", "paths", "--out", "export-paths", "--force"],
      ["convert", "deck.opf.json", "convert-paths.svg", "--text", "paths", "--slides", "1", "--force"],
    ]) {
      const out = await stub(args);
      assert.equal(out.report.ok, true, args.join(" "));
      const svgs = await callsOf("toSvg");
      assert.ok(svgs.length >= 1, args.join(" "));
      for (const call of svgs) {
        assert.equal(call.args[1].text, "paths", `${args[0]}: text paths reaches toSvg`);
        assert.equal(call.args[1].fonts.stub, true, "the renderer draws outlines from the fonts handle");
      }
      assert.equal((await callsOf("loadFonts"))[0].args[0].embedScriptFonts, false);
    }
    const slides = await callsOf("toSvg");
    assert.deepEqual(slides.map((call) => call.args[0]), [1], "convert --slides 1 draws slide 1, counted from 1");

    const system = await stub(["render", "deck.opf.json", "--text", "system", "--out", "system", "--force"]);
    assert.equal(system.report.ok, true);
    for (const call of await callsOf("toSvg")) {
      assert.equal(call.args[1].text, "system");
      assert.deepEqual(call.args[1].fonts.embeddedFonts, []);
    }
    await stub(["render", "deck.opf.json", "--out", "default", "--force"]);
    for (const call of await callsOf("toSvg")) {
      assert.equal(call.args[1].text, undefined, "the default is the renderer's: the faces the slide uses");
      assert.deepEqual(call.args[1].fonts.embeddedFonts.map((face) => face.embed), ["used"]);
    }
  });

  test("--raster, --charts, --images and --fonts reach the engines", async () => {
    await stub(["export", "deck.opf.json", "--format", "pdf", "--raster", "--out", "raster.pdf", "--force"]);
    assert.equal((await callsOf("toPdf"))[0].args[1].raster, true);
    await stub(["convert", "deck.opf.json", "plain.pdf", "--force"]);
    assert.equal("raster" in (await callsOf("toPdf"))[0].args[1], false);
    await stub(["export", "deck.opf.json", "--format", "pptx", "--charts", "picture", "--images", "preserve", "--out", "charts.pptx", "--force"]);
    const pptx = (await callsOf("toPptx"))[0].args[0];
    assert.equal(pptx.chartex, "fallback", "opf-pptx still names it chartex, and its picture choice fallback");
    assert.equal(pptx.imageFormat, "preserve");
    const fonts = await stub(["render", "deck.opf.json", "--fonts", "fonts", "--out", "fonts-out", "--force"]);
    assert.match((await callsOf("loadFonts"))[0].args[0].faces[0].path, /fonts[\\/]a\.ttf$/);
    assert.equal(fonts.report.fonts.userFonts.length, 1);
  });

  test("the 0.17 flags are usage errors (exit 2): --svg-fonts, --pdf-mode, --chartex, --image-format and --font-dir", async () => {
    for (const args of [
      ["render", "deck.opf.json", "--svg-fonts", "none"],
      ["export", "deck.opf.json", "--format", "svg", "--svg-fonts", "used"],
      ["convert", "deck.opf.json", "x.svg", "--svg-fonts", "none"],
      ["export", "deck.opf.json", "--format", "pdf", "--pdf-mode", "raster"],
      ["convert", "deck.opf.json", "x.pdf", "--pdf-mode", "raster"],
      ["export", "deck.opf.json", "--format", "pptx", "--chartex", "native"],
      ["convert", "deck.opf.json", "x.pptx", "--chartex", "native"],
      ["export", "deck.opf.json", "--format", "pptx", "--image-format", "preserve"],
      ["convert", "deck.opf.json", "x.pptx", "--image-format", "preserve"],
      ["render", "deck.opf.json", "--font-dir", "fonts"],
      ["convert", "deck.opf.json", "x.svg", "--font-dir", "fonts"],
    ]) {
      const failed = await stub(args, 2);
      assert.match(failed.error.error, new RegExp(`Unknown or duplicate option: ${args.find((arg) => /^--(svg-fonts|pdf-mode|chartex|image-format|font-dir)$/.test(arg))}`), args.join(" "));
      assert.deepEqual(await callsOf("toSvg"), [], "nothing was drawn");
    }
  });

  test("--text, --raster, --charts and --images name the format they apply to; --text takes fonts, system or paths", async () => {
    const messages = [
      [["render", "deck.opf.json", "--format", "png", "--text", "paths"], /--text applies to --format svg/],
      [["export", "deck.opf.json", "--format", "pdf", "--text", "paths"], /--text applies to --format svg/],
      [["convert", "deck.opf.json", "x.pdf", "--text", "paths"], /--text applies to svg output/],
      [["export", "deck.opf.json", "--format", "svg", "--raster"], /--raster applies to --format pdf/],
      [["export", "deck.opf.json", "--format", "svg", "--charts", "native"], /--charts, --provenance and --images apply to --format pptx/],
      [["export", "deck.opf.json", "--format", "pptx", "--images", "jpeg"], /--images must be one of: compatible, preserve/],
      [["export", "deck.opf.json", "--format", "pptx", "--charts", "fallback"], /--charts must be one of: auto, native, picture/],
      [["render", "deck.opf.json", "--text", "outline"], /--text must be one of: fonts, system, paths/],
      [["convert", "deck.opf.json", "x.svg", "--text", "outline"], /text must be one of: fonts, system, paths/],
    ];
    for (const [args, pattern] of messages) assert.match((await stub(args, 2)).error.error, pattern, args.join(" "));
  });
});

describe("drawing through the peers", { skip }, () => {
  test("opf convert writes one PNG per slide beside the output, a PDF, a PPTX and a zip", async () => {
    const dir = await folder();
    const png = run(["convert", "deck.opf.json", "slides/deck.png", "--scale", "0.5"], { cwd: dir }).report;
    assert.equal(png.format, "png");
    assert.deepEqual(
      png.outputs.map((item) => path.basename(item.file)),
      ["deck-001.png", "deck-002.png", "deck-003.png"],
    );
    assert.deepEqual([png.outputs[0].width, png.outputs[0].height], [640, 360]);
    assert.equal(png.checks.layout, "measured");
    assert.ok(PNG(await readFile(path.join(dir, "slides", "deck-002.png"))));
    const pdf = run(["convert", "deck.opf.json", "deck.pdf"], { cwd: dir }).report;
    assert.equal(pdf.pdf.mode, "vector");
    assert.equal(pdf.outputs[0].pages, 3);
    const pptx = run(["convert", "deck.opf.json", "deck.pptx"], { cwd: dir }).report;
    assert.equal(pptx.checks.nativeExport, "checked");
    assert.equal(pptx.renderer.package, "@openpresentation/opf-render");
    const back = run(["convert", "deck.pptx", "back.opf.yaml"], { cwd: dir }).report;
    assert.equal(back.pptx.package, "@openpresentation/opf-pptx");
    const zip = run(["convert", "deck.opf.json", "slides.zip", "--format", "svg"], { cwd: dir }).report;
    assert.deepEqual(zip.outputs[0].entries, ["slides-001.svg", "slides-002.svg", "slides-003.svg"]);
    assert.match(run(["convert", "deck.opf.json", "deck.svg", "--raster"], { cwd: dir, status: 2 }).error.error, /--raster applies to pdf output/);
  });

  test("opf render and opf export take the format from --out: --out deck.png writes a PNG file, not a folder", async () => {
    const dir = await folder({ name: "Single", slides: [{ title: "Only slide" }] });
    const rendered = run(["render", "deck.opf.json", "--out", "deck.png"], { cwd: dir }).report;
    assert.equal(rendered.format, "png");
    assert.ok((await stat(path.join(dir, "deck.png"))).isFile(), "deck.png is a file");
    assert.ok(PNG(await readFile(path.join(dir, "deck.png"))));
    const exported = run(["export", "deck.opf.json", "--out", "exported.svg"], { cwd: dir }).report;
    assert.equal(exported.format, "svg");
    assert.ok((await stat(path.join(dir, "exported.svg"))).isFile());
    // An --out with an extension the command does not write is a usage error; nothing is created.
    for (const args of [["render", "deck.opf.json", "--out", "deck.txt"], ["render", "deck.opf.json", "--out", "deck.pdf"], ["export", "deck.opf.json", "--format", "png", "--out", "deck.jpg"], ["render", "deck.opf.json", "--format", "png", "--out", "deck.svg"]]) {
      run(args, { cwd: dir, status: 2 });
    }
    assert.deepEqual((await readdir(dir)).sort(), ["deck.opf.json", "deck.png", "exported.svg"]);
  });
});
