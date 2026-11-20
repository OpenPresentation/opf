#!/usr/bin/env node
// The LibreOffice qualification runner (docs/libreoffice.md). For every corpus case and font profile it exports the deck with
// today's engines (or takes a retained PPTX as it is), has the pinned LibreOffice convert it headless to PDF and back to PPTX, and
// measures the result: slide count, every source word on the rendered page and in LibreOffice's re-export, explicit breaks, text
// against its box and the slide edge, ink past the slide edge, the faces LibreOffice drew, and the difference from OPF's preview.
//
//   node scripts/libreoffice/run.mjs [--out artifacts/libreoffice] [--profiles opf,stock] [--case <id|group|prefix*>,...]
//                                    [--qualification <build dir>] [--soffice <path>] [--profiles none] [--no-control] [--fail-on-defect]
//
// --qualification adds the release qualification corpus built by scripts/native-acceptance/qualification/build.mjs (the same PPTX
// files the PowerPoint and Keynote streams open) and grades its manifest's features.
//
// It reports and exits 0 unless --fail-on-defect is given and a baseline case fails in the opf profile (the switch the owner turns
// on when the baseline is promoted). Needs the built packages (pnpm build), fontconfig and LibreOffice; in CI it runs in the pinned
// Playwright image after scripts/libreoffice/install.sh.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareOutputDirectory } from "./output.mjs";
import { containment, compareStructure, inkOutside, missingWords, slideStructure, sourceBleeds, verdict } from "./checks.mjs";
import { corpusCases, qualificationCases, qualificationManifest, selectCases } from "./corpus.mjs";
import { featuresMarkdown, gradeFeatures } from "./features.mjs";
import { fontInventory, PROFILES, prepareProfile, resolveRequested } from "./fonts.mjs";
import { openPdf, pageRuns, pageText, pdfFonts, rasterize, sharp } from "./pdf-model.mjs";
import { readPptx, slideWords, tokenize } from "./pptx-model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const environment = JSON.parse(readFileSync(path.join(here, "environment.json"), "utf8"));
const DATE = "2026-11-07";
const engines = {};
const MARGIN = 72;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function parseArgs(argv) {
  const options = { out: path.join(root, "artifacts/libreoffice"), profiles: [...PROFILES], cases: [], soffice: null, failOnDefect: false, control: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[++index];
    };
    if (arg === "--out") options.out = path.resolve(value());
    else if (arg === "--profiles") { const list = value(); options.profiles = list === "none" ? [] : list.split(",").filter(Boolean); }
    else if (arg === "--case") options.cases.push(...value().split(",").filter(Boolean));
    else if (arg === "--soffice") options.soffice = value();
    else if (arg === "--fail-on-defect") options.failOnDefect = true;
    else if (arg === "--no-control") options.control = false;
    else if (arg === "--qualification") options.qualification = path.resolve(value());
    else throw new Error(`unknown argument ${arg}`);
  }
  for (const profile of options.profiles) if (!PROFILES.includes(profile)) throw new Error(`unknown profile ${profile} (known: ${PROFILES.join(", ")})`);
  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message };
}

function identities(soffice) {
  const version = run(soffice, ["--version"]);
  const osRelease = existsSync("/etc/os-release") ? Object.fromEntries(readFileSync("/etc/os-release", "utf8").split("\n").filter((line) => line.includes("=")).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")]; })) : {};
  const fontconfig = run("fc-match", ["--version"]);
  const packages = Object.fromEntries(["javascript", "render", "pptx", "gallery"].map((dir) => {
    const manifest = JSON.parse(readFileSync(path.join(root, "packages", dir, "package.json"), "utf8"));
    return [manifest.name, manifest.version];
  }));
  const head = run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim() || null;
  const libreoffice = (version.stdout || version.stderr).trim() || version.error || "not found";
  return {
    libreoffice,
    libreofficePinned: environment.libreoffice.version,
    pinned: libreoffice.includes(environment.libreoffice.version),
    tarballSha256: environment.libreoffice.sha256,
    os: osRelease.PRETTY_NAME ?? process.platform,
    image: process.env.OPF_LIBREOFFICE_IMAGE ?? null,
    fontconfig: (fontconfig.stdout || fontconfig.stderr).trim() || null,
    node: process.version,
    commit: head,
    packages,
    date: DATE,
  };
}

/** Export one case: { pptx bytes, previews: [png bytes], findings }. */
async function exportCase(entry, core) {
  if (entry.pptx) {
    // A built PPTX (the release qualification corpus) whose source deck is known also gets OPF's own PDF, for the control.
    const pdf = entry.source ? (await core.convert(entry.source, { format: "pdf", date: DATE, ...(entry.assetDir ? { assetDir: entry.assetDir } : {}) })).files[0].bytes : null;
    return { pptx: new Uint8Array(readFileSync(entry.pptx)), previews: (entry.previews ?? []).map((file) => readFileSync(file)), pdf, findings: [] };
  }
  const input = entry.deck ?? entry.input;
  const common = { date: DATE, ...(entry.assetDir ? { assetDir: entry.assetDir } : {}) };
  const pptx = await core.convert(input, { format: "pptx", ...common, ...(entry.options ?? {}) });
  // The preview is drawn with the same options a reader of the deck would use; export-only options (typefaces, bodyText) do not
  // apply to it, so the preview of a `safe` export still shows the selected families.
  const png = await core.convert(input, { format: "png", ...common });
  const pdf = await core.convert(input, { format: "pdf", ...common });
  return { pptx: pptx.files[0].bytes, previews: png.files.map((file) => file.bytes), pdf: pdf.files[0].bytes, findings: [...pptx.findings, ...png.findings].map((finding) => ({ code: finding.code, severity: finding.severity, path: finding.path })) };
}

function convertAll(soffice, inputs, format, outDir, profile) {
  mkdirSync(outDir, { recursive: true });
  const userDir = path.join(profile.dir, "lo-user");
  const args = ["--headless", "--norestore", "--nologo", "--nodefault", "--nolockcheck", `-env:UserInstallation=${pathToFileURL(userDir).href}`, "--convert-to", format, "--outdir", outDir, ...inputs];
  const started = Date.now();
  const result = run(soffice, args, { env: { ...process.env, ...profile.env, SAL_USE_VCLPLUGIN: "svp" }, timeout: 30 * 60 * 1000 });
  return { ...result, seconds: Math.round((Date.now() - started) / 100) / 10 };
}

async function sideBySide(left, right, file) {
  const a = await sharp(left).metadata(), b = await sharp(right).metadata();
  const gap = 8;
  await sharp({ create: { width: a.width + b.width + gap, height: Math.max(a.height, b.height), channels: 3, background: "#888888" } })
    .composite([{ input: Buffer.from(left), left: 0, top: 0 }, { input: Buffer.from(right), left: a.width + gap, top: 0 }])
    .png().toFile(file);
}

async function compareImages(a, b) {
  const meta = await sharp(a).metadata();
  const width = Math.round(meta.width / 2), height = Math.round(meta.height / 2);
  const prepare = (image) => sharp(image).removeAlpha().resize(width, height, { kernel: "lanczos3", fit: "fill" }).raw().toBuffer();
  const [left, right] = await Promise.all([prepare(a), prepare(b)]);
  let sum = 0, large = 0;
  const pixels = left.length / 3;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    let largest = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = Math.abs(left[pixel * 3 + channel] - right[pixel * 3 + channel]);
      sum += difference;
      if (difference > largest) largest = difference;
    }
    if (largest > 48) large += 1;
  }
  return { mae: Math.round((sum / left.length) * 100) / 100, largePercent: Math.round((100 * large / pixels) * 100) / 100 };
}

// `control`: the same measurements on OPF's own PDF of the deck; it shows the instrument, not LibreOffice, decides.
async function measure(entry, exported, model, profile, paths, { control = false } = {}) {
  const result = { id: entry.id, profile: profile.name, slides: model.slides.filter((slide) => !slide.hidden).length, converted: existsSync(paths.pdf) };
  if (!result.converted) {
    result.conversionError = paths.conversionLog;
    return { ...result, ...verdict(result) };
  }
  const pdfBytes = readFileSync(paths.pdf);
  result.pdfSha256 = sha256(pdfBytes);
  const doc = await openPdf(pdfBytes);
  result.pages = doc.numPages;
  const fonts = await pdfFonts(pdfBytes);
  result.fonts = { drawn: fonts, requested: control ? [] : resolveRequested(model.fonts, profile.env, profile.aliases, fonts.map((font) => font.name)) };
  const visible = model.slides.filter((slide) => !slide.hidden);
  result.perSlide = [];
  for (let index = 0; index < Math.min(doc.numPages, visible.length); index += 1) {
    const slide = visible[index];
    const page = await pageRuns(doc, index + 1, model.slideSize.width);
    const contained = containment(page, slide, model.slideSize);
    const raster = await rasterize(doc, index + 1, { scale: 1, margin: MARGIN });
    const entrySlide = {
      number: slide.number,
      missing: missingWords(slideWords(slide), pageText(page)),
      offSlide: contained.offSlide,
      outsideBox: contained.outsideBox,
      atEdge: contained.atEdge,
      unattributed: contained.unattributed.length,
      inkOutside: inkOutside(raster),
      bleeds: [...sourceBleeds(slide, model.slideSize)],
      kinds: shapeKinds(slide),
      unsupportedCharts: (pageText(page).match(/unsupported in this version of LibreOffice/gi) ?? []).length,
      shrink: slide.shapes.filter((shape) => shape.body?.autofit === "normal").length,
    };
    // SmartArt node text (LibreOffice draws the fallback drawing; the words must still be on the page).
    const smartArtStrings = slide.shapes.filter((shape) => shape.kind === "smartart").flatMap((shape) => shape.strings.flatMap((value) => tokenize(value)));
    if (smartArtStrings.length) {
      entrySlide.smartArtMissing = missingWords(smartArtStrings, pageText(page));
      entrySlide.smartArtAsGraphics = entrySlide.smartArtMissing.length === new Set(smartArtStrings.map((word) => word.toLowerCase())).size;
    }
    const preview = exported.previews[index];
    if (preview) {
      const { width } = await sharp(preview).metadata();
      const drawn = await rasterize(doc, index + 1, { scale: width / page.width });
      entrySlide.preview = await compareImages(preview, drawn.png);
      if (!control) await sideBySide(preview, drawn.png, path.join(paths.caseDir, `compare-${profile.name}-${String(slide.number).padStart(2, "0")}.png`));
    } else if (!control) {
      writeFileSync(path.join(paths.caseDir, `libreoffice-${profile.name}-${String(slide.number).padStart(2, "0")}.png`), raster.png);
    }
    result.perSlide.push(entrySlide);
  }
  if (control) return { ...result, ...verdict(result) };
  result.roundTrip = { converted: existsSync(paths.roundTrip) };
  if (result.roundTrip.converted) {
    const roundTripBytes = readFileSync(paths.roundTrip);
    const reread = readPptx(roundTripBytes);
    const rereadVisible = reread.slides.filter((slide) => !slide.hidden);
    result.roundTrip.findings = compareStructure(slideStructure({ slides: visible }), slideStructure({ slides: rereadVisible }));
    result.roundTrip.kinds = rereadVisible.map(shapeKinds);
    // LibreOffice's saved copy read back by OPF's own import (the manifest's `roundtrip` check).
    try {
      const imported = await engines.core.convert(new Uint8Array(roundTripBytes), { format: "json" });
      const deck = JSON.parse(new TextDecoder().decode(imported.files[0].bytes));
      result.roundTrip.import = { ok: true, slides: deck.slides?.length ?? 0 };
    } catch (error) {
      result.roundTrip.import = { ok: false, error: String(error?.message ?? error).slice(0, 300) };
    }
  }
  return { ...result, ...verdict(result) };
}

/** Shape counts of a slide by kind: {text, table, chart, smartart, picture, connector, other}. */
const shapeKinds = (slide) => {
  const counts = {};
  for (const shape of slide.shapes) counts[shape.kind] = (counts[shape.kind] ?? 0) + 1;
  return counts;
};

function summaryMarkdown(report) {
  const lines = [];
  const env = report.environment;
  lines.push("# LibreOffice qualification", "");
  lines.push(`- LibreOffice: ${env.libreoffice} (pinned ${env.libreofficePinned}${env.pinned ? "" : ", NOT the pinned version"})`);
  lines.push(`- OS: ${env.os}; image: ${env.image ?? "local"}; ${env.fontconfig ?? "fontconfig unknown"}; Node ${env.node}`);
  lines.push(`- Engines: ${Object.entries(env.packages).map(([name, version]) => `${name} ${version}`).join(", ")}; commit ${env.commit ?? "unknown"}`);
  for (const [name, profile] of Object.entries(report.profiles)) lines.push(`- Profile \`${name}\`: ${profile.inventory.count} font files (digest ${String(profile.inventory.digest).slice(0, 12)}), ${profile.copied} OPF fonts, ${profile.aliases} aliases`);
  lines.push("");
  const order = ["control", "opf", "stock"];
  const profiles = [...new Set(report.cases.flatMap((entry) => Object.keys(entry.profiles)))].sort((left, right) => order.indexOf(left) - order.indexOf(right));
  lines.push(`| Case | Scope | ${profiles.map((name) => `${name}`).join(" | ")} |`);
  lines.push(`| --- | --- | ${profiles.map(() => "---").join(" | ")} |`);
  for (const entry of report.cases) {
    const cells = profiles.map((name) => {
      const result = entry.profiles[name];
      if (!result) return "-";
      const checks = [...new Set(result.defects.map((defect) => defect.check))];
      return result.status === "pass" ? "pass" : `**fail** (${checks.join(", ")})`;
    });
    lines.push(`| ${entry.id} | ${entry.scope} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  for (const entry of report.cases) {
    for (const [name, result] of Object.entries(entry.profiles)) {
      if (!result.defects.length) continue;
      lines.push(`## ${entry.id} (${name})`, "");
      for (const defect of result.defects.slice(0, 12)) lines.push(`- ${defect.check}${defect.slide ? ` slide ${defect.slide}` : ""}: ${defect.detail}`);
      if (result.defects.length > 12) lines.push(`- ... ${result.defects.length - 12} more`);
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const soffice = options.soffice ?? (existsSync(environment.libreoffice.program) ? environment.libreoffice.program : "soffice");
  prepareOutputDirectory(options.out);
  const core = await import("@openpresentation/opf");
  engines.core = core;
  const cases = selectCases([...(await corpusCases()), ...(options.qualification ? qualificationCases(options.qualification) : [])], options.cases);
  const report = { schemaVersion: 1, environment: identities(soffice), profiles: {}, cases: [] };
  console.log(`libreoffice: ${report.environment.libreoffice}; ${cases.length} cases; profiles ${options.profiles.join(", ")}`);

  const inputs = path.join(options.out, "inputs");
  mkdirSync(inputs, { recursive: true });
  const prepared = [];
  for (const entry of cases) {
    const caseDir = path.join(options.out, "cases", entry.id);
    mkdirSync(caseDir, { recursive: true });
    try {
      const exported = await exportCase(entry, core);
      const file = path.join(inputs, `${entry.id}.pptx`);
      writeFileSync(file, exported.pptx);
      for (const [index, bytes] of exported.previews.entries()) writeFileSync(path.join(caseDir, `preview-${String(index + 1).padStart(2, "0")}.png`), bytes);
      prepared.push({ entry, exported, file, caseDir, model: readPptx(exported.pptx), sha256: sha256(exported.pptx) });
    } catch (error) {
      report.cases.push({ id: entry.id, group: entry.group, scope: entry.scope, exportError: error.message, profiles: {} });
      console.error(`${entry.id}: export failed: ${error.message}`);
    }
  }

  const full = new Map();
  const record = (item, name, result) => {
    if (name === "opf") full.set(item.entry.id, result);
    writeFileSync(path.join(item.caseDir, `result-${name}.json`), json(result));
    let row = report.cases.find((entry) => entry.id === item.entry.id);
    if (!row) {
      row = { id: item.entry.id, group: item.entry.group, scope: item.entry.scope, note: item.entry.note, pptxSha256: item.sha256, exportFindings: item.exported.findings.length, profiles: {} };
      report.cases.push(row);
    }
    row.profiles[name] = { status: result.status, defects: result.defects, differences: result.differences, ...(result.fonts?.requested?.length ? { fonts: result.fonts.requested } : {}) };
    console.log(`  ${result.status === "pass" ? "pass" : "FAIL"} ${item.entry.id}${result.defects.length ? `: ${[...new Set(result.defects.map((defect) => defect.check))].join(", ")}` : ""}`);
  };
  const failed = (item, name, error) => ({ id: item.entry.id, profile: name, status: "fail", defects: [{ check: "runner", detail: String(error?.stack ?? error).split("\n").slice(0, 3).join(" ") }], differences: [] });

  // The control: OPF's own PDF of each exported deck through the same measurements. It must pass; a control failure is a fault of
  // the instrument (or of OPF's own renderer), never of LibreOffice.
  if (options.control) {
    const dir = path.join(options.out, "control");
    mkdirSync(dir, { recursive: true });
    console.log("control: OPF's own PDF");
    for (const item of prepared.filter((entry) => entry.exported.pdf)) {
      const file = path.join(dir, `${item.entry.id}.pdf`);
      writeFileSync(file, item.exported.pdf);
      let result;
      try {
        result = await measure(item.entry, item.exported, item.model, { name: "control", env: {}, aliases: [] }, { pdf: file, caseDir: item.caseDir }, { control: true });
      } catch (error) {
        result = failed(item, "control", error);
      }
      record(item, "control", result);
    }
  }

  for (const name of options.profiles) {
    const dir = path.join(options.out, "profiles", name);
    mkdirSync(dir, { recursive: true });
    const profile = { ...(await prepareProfile(name, dir)), dir };
    const inventory = fontInventory(profile.env);
    report.profiles[name] = { inventory, copied: profile.copied, aliases: profile.aliases.length, missing: profile.missing ?? [] };
    writeFileSync(path.join(dir, "font-inventory.json"), json(inventory));
    const files = prepared.map((item) => item.file);
    const pdf = convertAll(soffice, files, "pdf", path.join(dir, "pdf"), profile);
    const roundTrip = convertAll(soffice, files, 'pptx:Impress MS PowerPoint 2007 XML', path.join(dir, "roundtrip"), profile);
    writeFileSync(path.join(dir, "soffice.log"), `pdf (${pdf.seconds} s, status ${pdf.status}):\n${pdf.stdout}\n${pdf.stderr}\n${pdf.error ?? ""}\nround trip (${roundTrip.seconds} s, status ${roundTrip.status}):\n${roundTrip.stdout}\n${roundTrip.stderr}\n${roundTrip.error ?? ""}\n`);
    console.log(`${name}: converted in ${pdf.seconds} s (pdf) and ${roundTrip.seconds} s (pptx)`);
    for (const item of prepared) {
      const paths = { pdf: path.join(dir, "pdf", `${item.entry.id}.pdf`), roundTrip: path.join(dir, "roundtrip", `${item.entry.id}.pptx`), caseDir: item.caseDir, conversionLog: `soffice status ${pdf.status}: ${(pdf.stderr || pdf.error || "").trim().slice(0, 400)}` };
      let result;
      try {
        result = await measure(item.entry, item.exported, item.model, profile, paths);
      } catch (error) {
        result = failed(item, name, error);
      }
      record(item, name, result);
    }
  }
  report.cases.sort((left, right) => cases.findIndex((entry) => entry.id === left.id) - cases.findIndex((entry) => entry.id === right.id));
  const baselineFailures = report.cases.filter((entry) => entry.scope === "baseline" && (entry.exportError || entry.profiles.opf?.status === "fail"));
  const judged = options.profiles.includes("opf");
  report.baseline = judged ? { profile: "opf", cases: report.cases.filter((entry) => entry.scope === "baseline").length, failing: baselineFailures.map((entry) => entry.id) } : null;
  const manifest = options.qualification ? qualificationManifest() : null;
  let features = "";
  if (manifest && full.size) {
    report.features = gradeFeatures(manifest, full, new Map(cases.map((entry) => [entry.id, entry.scope])));
    features = `## Release qualification features (opf profile)

${featuresMarkdown(report.features)}
`;
  }
  writeFileSync(path.join(options.out, "results.json"), json(report));
  writeFileSync(path.join(options.out, "summary.md"), summaryMarkdown(report) + features);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(report) + features, { flag: "a" });
  if (judged) console.log(`baseline (opf profile): ${report.baseline.cases - baselineFailures.length}/${report.baseline.cases} pass${baselineFailures.length ? `; failing: ${baselineFailures.map((entry) => entry.id).join(", ")}` : ""}`);
  const controlFailures = report.cases.filter((entry) => entry.profiles.control?.status === "fail").map((entry) => entry.id);
  if (controlFailures.length) console.log(`control failures (the instrument or OPF's own PDF, not LibreOffice): ${controlFailures.join(", ")}`);
  if (options.failOnDefect && judged && baselineFailures.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
}
