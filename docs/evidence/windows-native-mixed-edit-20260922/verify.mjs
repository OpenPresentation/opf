#!/usr/bin/env node
// Portable verifier for the native mixed-size table edit/save/reopen evidence.
// Node standard library only. Never starts Office, PowerShell, the native
// harness, or font registration. Exits nonzero on any integrity failure and
// prints a JSON summary.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const bundle = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
const fail = (msg) => failures.push(msg);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rel = (p) => path.join(bundle, ...p.split("/"));
const read = (p) => fs.readFileSync(rel(p));
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const text = (p) => stripBom(read(p).toString("utf8"));
const json = (p) => JSON.parse(text(p));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const FONT_EXT = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2", ".fntdata", ".eot"]);
const FONT_MAGIC = new Set(["00010000", "4f54544f", "74727565", "774f4646", "774f4632", "74746366"]);
const isFontMagic = (b) => b.length >= 4 && FONT_MAGIC.has(b.subarray(0, 4).toString("hex"));

// Recorded results. These bind the raw outcomes; they are not new gates.
const EXPECTED = {
  "attempt-01": {
    harnessCommit: "86afe6c51f8238c3db0450c90443e91378531dc8",
    auditPassed: false,
    stageRecords: 1496,
    stageError: "",
    failureCounts: { stages: 1496, style: 2 },
    styleMessages: [
      "edited whole-cell font evidence differs from the reviewed mixed-style range",
      "reopened whole-cell font evidence differs from the reviewed mixed-style range",
    ],
    wholeItalic: { original: 0, edited: -2, reopened: -2 },
  },
  "attempt-02": {
    harnessCommit: "0f3a3da6402261610b49774cff5da37716575ece",
    auditPassed: true,
    auditSha256: "23c19bbe1fa2133f453ecf1334103e3fbefe2a26dbd6b72f795f337fe54b6983",
    stageRecords: 1486,
    stageError: null,
    failureCounts: {},
    wholeItalic: { original: 0, edited: 0, reopened: 0 },
  },
};
const NATIVE_LINES = [
  [0, 92],
  [92, 194],
  [194, 245],
];
const PREVIEW_LINES = [
  [0, 78],
  [78, 172],
  [172, 245],
];

// ---------- helpers ----------
function walk(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r));
    else out.push(r);
  }
  return out.sort();
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readZip(p) {
  const b = read(p);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("no end-of-central-directory record");
  const count = b.readUInt16LE(eocd + 10);
  const cdSize = b.readUInt32LE(eocd + 12);
  const cdOff = b.readUInt32LE(eocd + 16);
  if (cdOff + cdSize !== eocd) throw new Error("central directory bounds do not meet EOCD");
  const entries = new Map();
  let o = cdOff;
  for (let i = 0; i < count; i++) {
    if (b.readUInt32LE(o) !== 0x02014b50) throw new Error(`bad central header ${i}`);
    const method = b.readUInt16LE(o + 10);
    const crc = b.readUInt32LE(o + 16);
    const csize = b.readUInt32LE(o + 20);
    const usize = b.readUInt32LE(o + 24);
    const nlen = b.readUInt16LE(o + 28);
    const xlen = b.readUInt16LE(o + 30);
    const clen = b.readUInt16LE(o + 32);
    const lho = b.readUInt32LE(o + 42);
    const name = b.subarray(o + 46, o + 46 + nlen).toString("utf8");
    o += 46 + nlen + xlen + clen;
    if (b.readUInt32LE(lho) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const lname = b.subarray(lho + 30, lho + 30 + b.readUInt16LE(lho + 26)).toString("utf8");
    if (lname !== name) throw new Error(`local/central name mismatch for ${name}`);
    const start = lho + 30 + b.readUInt16LE(lho + 26) + b.readUInt16LE(lho + 28);
    const raw = b.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error(`unsupported method ${method} for ${name}`);
    if (data.length !== usize) throw new Error(`size mismatch for ${name}`);
    if (crc32(data) !== crc) throw new Error(`CRC mismatch for ${name}`);
    if (entries.has(name)) throw new Error(`duplicate entry ${name}`);
    entries.set(name, data);
  }
  if (o !== eocd) throw new Error("central directory length mismatch");
  return entries;
}

// ---------- manifest ----------
const manifest = json("artifact-manifest.json");
const manifestSha256 = sha(read("artifact-manifest.json"));
const onDisk = walk(bundle).filter((p) => p !== "artifact-manifest.json");
const listed = new Map(manifest.artifacts.map((a) => [a.path, a]));
if (manifest.files !== manifest.artifacts.length) fail("manifest file count mismatch");
if (manifest.bytes !== manifest.artifacts.reduce((n, a) => n + a.bytes, 0)) fail("manifest byte total mismatch");
for (const p of onDisk) if (!listed.has(p)) fail(`unlisted bundle file: ${p}`);
for (const a of manifest.artifacts) {
  if (!fs.existsSync(rel(a.path))) {
    fail(`missing manifest file: ${a.path}`);
    continue;
  }
  const b = read(a.path);
  if (b.length !== a.bytes || sha(b) !== a.sha256) fail(`manifest hash/size mismatch: ${a.path}`);
}

// ---------- ledger ----------
const ledger = json("source-copy-ledger.json");
const ledgerPaths = new Set();
if (typeof ledger.root !== "string" || !/^artifacts\/[^/\\]+$/.test(ledger.root)) fail("ledger root is not a workspace-relative artifacts path");
for (const e of ledger.entries) {
  if (ledgerPaths.has(e.bundlePath)) fail(`duplicate ledger entry: ${e.bundlePath}`);
  ledgerPaths.add(e.bundlePath);
  const m = listed.get(e.bundlePath);
  if (!m) fail(`ledger entry not in manifest: ${e.bundlePath}`);
  else if (m.sha256 !== e.sha256 || m.bytes !== e.bytes) fail(`ledger/manifest mismatch: ${e.bundlePath}`);
  if (typeof e.sourcePath !== "string" || !e.sourcePath) fail(`ledger entry lacks source path: ${e.bundlePath}`);
  else if (/^[A-Za-z]:|^[\\/]|\\|(^|\/)\.\.(\/|$)/.test(e.sourcePath)) fail(`ledger source path is not workspace-relative: ${e.bundlePath}`);
}
for (const p of onDisk) if (/^attempt-\d\d\//.test(p) && !ledgerPaths.has(p)) fail(`copied file missing from ledger: ${p}`);

// ---------- omissions and font programs ----------
const omissions = json("omissions.json");
const omittedHashes = new Set(omissions.fontPrograms.map((f) => f.sha256));
const allHashes = new Set(manifest.artifacts.map((a) => a.sha256));
for (const f of omissions.fontPrograms) {
  if (!/^[0-9a-f]{64}$/.test(f.sha256) || !(f.bytes > 0)) fail(`malformed omission: ${f.bundlePath}`);
  if (fs.existsSync(rel(f.bundlePath))) fail(`omitted font program present: ${f.bundlePath}`);
  if (allHashes.has(f.sha256)) fail(`omitted font program bytes present: ${f.bundlePath}`);
}
let pptxEntriesChecked = 0;
for (const p of [...onDisk, "artifact-manifest.json"]) {
  const b = read(p);
  if (FONT_EXT.has(path.extname(p).toLowerCase())) fail(`font-program extension present: ${p}`);
  if (isFontMagic(b)) fail(`font-program magic bytes present: ${p}`);
  if (omittedHashes.has(sha(b))) fail(`omitted font hash present: ${p}`);
}

// ---------- parse checks ----------
const pptx = {};
for (const p of onDisk) {
  const ext = path.extname(p).toLowerCase();
  try {
    if (ext === ".json" || p.endsWith(".audit.log")) json(p);
    else if (ext === ".jsonl") {
      for (const line of text(p).split(/\r?\n/)) if (line.trim()) JSON.parse(stripBom(line));
    } else if (ext === ".png") {
      const b = read(p);
      if (b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || b.subarray(12, 16).toString() !== "IHDR")
        throw new Error("bad PNG signature");
    } else if (ext === ".pptx") {
      const entries = readZip(p);
      for (const req of ["[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide1.xml"])
        if (!entries.has(req)) throw new Error(`missing ${req}`);
      for (const [name, data] of entries) {
        pptxEntriesChecked++;
        if (FONT_EXT.has(path.extname(name).toLowerCase()) || name.startsWith("ppt/fonts/") || isFontMagic(data))
          throw new Error(`embedded font program entry ${name}`);
      }
      pptx[p] = entries;
    }
  } catch (err) {
    fail(`${p}: ${err.message}`);
  }
}

// ---------- recorded results ----------
const attemptIds = manifest.attempts.map((a) => a.id);
if (!attemptIds.includes("attempt-01")) fail("attempt-01 missing");
const results = {};
const ALIASES = { "generation.json": "inputs/generation.json", "registrations.json": "font-registration.json", "external-source.pptx": "inputs/source.pptx" };

for (const att of manifest.attempts) {
  const id = att.id;
  const nn = id.slice(-2);
  const run = att.runDirectory;
  const exp = EXPECTED[id];
  const r = { runDirectory: run };
  results[id] = r;
  const check = (cond, msg) => {
    if (!cond) fail(`${id}: ${msg}`);
  };
  try {
    const audit = json(`${run}/audit.json`);
    const auditLog = json(`${id}/native-mixed-edit-${nn}.audit.log`);
    const supervisor = json(`${run}/supervisor.json`);
    const worker = json(`${run}/worker.json`);
    const progress = json(`${run}/progress.json`);
    const report = json(`${run}/report.json`);
    const generation = json(`${run}/inputs/generation.json`);
    const registrations = json(`${run}/font-registration.json`);
    const stages = text(`${run}/stages.jsonl`)
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(stripBom(l)));

    const counts = {};
    for (const f of audit.failures) counts[f.code] = (counts[f.code] ?? 0) + 1;
    r.audit = { sha256: sha(read(`${run}/audit.json`)), passed: audit.passed, failures: audit.failures.length, failureCodes: sortKeys(counts) };
    check(auditLog.passed === audit.passed && auditLog.failures === audit.failures.length, "audit.log disagrees with audit.json");
    check(audit.reportSha256 === sha(read(`${run}/report.json`)), "audit reportSha256 does not bind report.json");

    // Bind every audit artifact hash to a bundle file or a recorded font omission.
    const unbound = [];
    for (const [k, v] of Object.entries(audit.artifactHashes)) {
      const target = `${run}/${ALIASES[k] ?? k.replace(/^reviewed\//, "inputs/")}`;
      const om = omissions.fontPrograms.find((f) => f.bundlePath === target);
      if (om) check(om.sha256 === v, `audit hash for ${k} differs from omission`);
      else if (fs.existsSync(rel(target))) check(sha(read(target)) === v, `audit hash for ${k} differs from bundle bytes`);
      else unbound.push(k);
    }
    check(unbound.length === 0, `audit artifact hashes not bound: ${unbound.join(", ")}`);
    r.auditArtifactHashesBound = Object.keys(audit.artifactHashes).length - unbound.length;

    // Lifecycle.
    const lifecycle =
      supervisor.timedOut === false &&
      supervisor.exitCode === 0 &&
      supervisor.officeLifecycleComplete === true &&
      supervisor.officeCleanupConfirmed === true &&
      supervisor.fontCleanupConfirmed === true &&
      supervisor.lastDurableStage === "worker.complete" &&
      worker.exitCode === 0 &&
      worker.timedOut === false;
    check(lifecycle, "supervisor/worker lifecycle not complete");
    r.lifecycle = {
      complete: lifecycle,
      workerStartedAt: worker.startedAt,
      workerFinishedAt: worker.finishedAt,
      workerSeconds: (Date.parse(worker.finishedAt) - Date.parse(worker.startedAt)) / 1000,
      supervisorTimestamp: supervisor.timestamp,
    };

    // Font registrations and omissions agree with the frozen generation record.
    const genHashes = generation.fonts.map((f) => f.sha256).sort();
    const regOk = registrations.length === 4 && registrations.every((x) => x.added === 1 && x.removed === true);
    check(regOk, "font registrations not 4 added / 4 removed");
    check(eq(registrations.map((x) => x.sha256).sort(), genHashes), "registration hashes differ from generation.json");
    const attemptOmissions = omissions.fontPrograms.filter((f) => f.bundlePath.startsWith(`${run}/`)).map((f) => f.sha256).sort();
    check(eq(attemptOmissions, genHashes), "omitted font hashes differ from generation.json");

    // Stages.
    const contiguous = stages.every((s, i) => s.sequence === i + 1 && !Number.isNaN(Date.parse(s.timestamp)));
    check(contiguous, "stage sequence not contiguous or timestamp invalid");
    const errorValues = {};
    for (const s of stages) errorValues[JSON.stringify(s.error)] = (errorValues[JSON.stringify(s.error)] ?? 0) + 1;
    check(progress.sequence === stages.length && progress.stage === "worker.complete", "progress.json does not match final stage");
    r.stages = { records: stages.length, contiguous, errorValues };

    // Report bindings.
    const savedSha = sha(read(`${run}/native-mixed-edit.pptx`));
    check(report.saved.sha256 === savedSha && report.reopened.sha256 === savedSha, "saved/reopened sha does not match saved PPTX");
    check(report.source.snapshotSha256 === sha(read(`${run}/inputs/source.pptx`)), "source snapshot hash mismatch");
    check(report.source.unchanged === true && report.source.snapshotUnchanged === true, "source not recorded unchanged");
    for (const ph of ["original", "edited", "reopened"])
      check(report[ph].raster.sha256 === sha(read(`${run}/${ph}.png`)), `${ph}.png hash mismatch`);

    const req = report.requested.outerGeometryPt;
    const phases = {};
    for (const ph of ["original", "edited", "reopened"]) {
      const o = report[ph].observation;
      const g = o.shape.geometry;
      const maxDev = Math.max(
        Math.abs(g.left - req.left),
        Math.abs(g.top - req.top),
        Math.abs(g.width - req.width),
        Math.abs(g.height - req.height),
      );
      phases[ph] = {
        readOnly: o.readOnly,
        whole: o.cell.whole.font,
        runItalic: o.cell.runs.map((x) => x.font.italic),
        probeItalic: o.cell.characters.map((x) => x.font.italic),
        lines: o.cell.lines.records.map((x) => [x.start - 1, x.start - 1 + x.length]),
        outerGeometryMaxDeviationPt: maxDev,
      };
    }
    r.phases = Object.fromEntries(
      Object.entries(phases).map(([k, p]) => [
        k,
        {
          readOnly: p.readOnly,
          whole: `${p.whole.name}/${p.whole.size}/bold ${p.whole.bold}/italic ${p.whole.italic}`,
          runItalic: p.runItalic.join(","),
          probeItalic: p.probeItalic.join(","),
          lines: p.lines.map(([a, b]) => `[${a},${b})`).join(""),
          outerGeometryMaxDeviationPt: p.outerGeometryMaxDeviationPt,
        },
      ]),
    );
    r.environment = { powerPointBuild: report.environment.powerPointBuild, windowsBuild: report.environment.windowsBuild };

    const slide = pptx[`${run}/native-mixed-edit.pptx`]?.get("ppt/slides/slide1.xml")?.toString("utf8") ?? "";
    r.savedSlideXml = {
      runs: (slide.match(/<a:r>/g) ?? []).length,
      explicitItalicFalse: (slide.match(/<a:(?:rPr|endParaRPr)\b[^>]*\bi="0"/g) ?? []).length,
      explicitItalicTrue: (slide.match(/<a:(?:rPr|endParaRPr)\b[^>]*\bi="1"/g) ?? []).length,
    };

    r.previewLineBreakLimit = {
      observedMatchesPreviewEstimate: audit.previewLineBreakLimit?.observedMatchesPreviewEstimate,
      estimatedPreviewIntervals: audit.previewLineBreakLimit?.estimatedPreviewIntervals,
    };
    const previewEstimate = r.previewLineBreakLimit.estimatedPreviewIntervals;
    r.previewLineBreakLimit.estimatedPreviewIntervals = previewEstimate?.map(([a, b]) => `[${a},${b})`).join("");

    if (exp) {
      check(audit.passed === exp.auditPassed, `audit passed=${audit.passed}, expected ${exp.auditPassed}`);
      if (exp.auditSha256) check(r.audit.sha256 === exp.auditSha256, "audit.json sha256 differs from recorded value");
      check(eq(sortKeys(counts), sortKeys(exp.failureCounts)), `failure categories ${JSON.stringify(counts)}`);
      if (exp.styleMessages)
        check(eq(audit.failures.filter((f) => f.code === "style").map((f) => f.message), exp.styleMessages), "style failure messages differ");
      if (exp.failureCounts.stages) {
        const seqs = audit.failures.filter((f) => f.code === "stages").map((f) => Number(/stage record (\d+) /.exec(f.message)?.[1]));
        check(eq(seqs, stages.map((s) => s.sequence)), "stage failures do not cover each stage record exactly once");
      }
      check(stages.length === exp.stageRecords, `stage records ${stages.length}`);
      check(eq(Object.keys(errorValues), [JSON.stringify(exp.stageError)]), `stage error values ${JSON.stringify(errorValues)}`);
      for (const ph of ["original", "edited", "reopened"]) {
        const p = phases[ph];
        check(p.whole.name === "Carlito" && p.whole.size === 18 && p.whole.bold === -2, `${ph} whole-cell name/size/bold`);
        check(p.whole.italic === exp.wholeItalic[ph], `${ph} whole-cell italic ${p.whole.italic}`);
        check(p.runItalic.length === 5 && p.runItalic.every((v) => v === 0), `${ph} run italic`);
        check(p.probeItalic.length === 7 && p.probeItalic.every((v) => v === 0), `${ph} probe italic`);
        check(eq(p.lines, NATIVE_LINES), `${ph} native line intervals`);
        check(p.outerGeometryMaxDeviationPt <= 0.02, `${ph} outer geometry deviation`);
      }
      check(phases.reopened.readOnly === -1, "reopened phase not read-only");
      check(r.savedSlideXml.explicitItalicTrue === 0, "saved slide XML contains an italic run");
      check(eq(previewEstimate, PREVIEW_LINES), "preview estimate intervals differ");
      check(r.previewLineBreakLimit.observedMatchesPreviewEstimate === false, "preview/native parity unexpectedly claimed");
      if (id === "attempt-01") check(r.savedSlideXml.explicitItalicFalse > 0, "harness-written explicit i=\"0\" not found");

      const pre = json(`${id}/host-preflight-${nn}.json`);
      const head = pre.pptxMain ?? pre.harnessHead;
      check(head === exp.harnessCommit, `harness commit ${head}`);
      r.harnessCommit = head;
    } else {
      r.note = "No recorded expectation; values bound and reported only.";
    }

    const reviewPath = `${id}/root-review-${nn}.json`;
    if (fs.existsSync(rel(reviewPath))) {
      const rv = json(reviewPath);
      check(rv.audit?.sha256 === r.audit.sha256 && rv.audit?.passed === audit.passed, "root review does not bind audit.json");
      check(rv.reviewedPng?.sha256 === sha(read(`${run}/${rv.reviewedPng.file}`)), "root review PNG hash mismatch");
      r.rootReview = { bound: true, reviewedPng: rv.reviewedPng.file, notClaimed: rv.notClaimed };
    }
  } catch (err) {
    fail(`${id}: ${err.message}`);
  }
}

const summary = {
  ok: failures.length === 0,
  bundle: path.basename(bundle),
  manifestSha256,
  files: manifest.files,
  bytes: manifest.bytes,
  ledgerEntries: ledger.entries.length,
  fontProgramsOmitted: omissions.fontPrograms.length,
  pptxEntriesChecked,
  attempts: results,
  failures,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
