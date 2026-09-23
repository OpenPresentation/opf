#!/usr/bin/env node
// Portable verifier for the first supervised native font-embed attempt.
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
const check = (cond, msg) => {
  if (!cond) fail(msg);
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rel = (p) => path.join(bundle, ...p.split("/"));
const read = (p) => fs.readFileSync(rel(p));
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const text = (p) => stripBom(read(p).toString("utf8"));
const json = (p) => JSON.parse(text(p));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const FONT_EXT = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2", ".fntdata", ".eot"]);
const FONT_MAGIC = new Set(["00010000", "4f54544f", "74727565", "774f4646", "774f4632", "74746366"]);
const isFontMagic = (b) => b.length >= 4 && FONT_MAGIC.has(b.subarray(0, 4).toString("hex"));

// Recorded results. These bind the raw outcome; they are not new gates.
const RUN = "attempt-01/native-font-embed-01";
const SIDE = "attempt-01";
const FIX = "fixture/fixture-carlito-02";
const HARNESS = "310f873726da976841f61d53c9da04f731007062";
const FIXTURE_SOURCE_SHA = "f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb";
const GATE_ERROR = "Native Presentation.Fonts allowlist/embeddability gate failed before SaveAs; the owned presentation was closed without saving and no retry was started.";

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
    const lnlen = b.readUInt16LE(lho + 26);
    if (b.subarray(lho + 30, lho + 30 + lnlen).toString("utf8") !== name) throw new Error(`local/central name mismatch for ${name}`);
    const start = lho + 30 + lnlen + b.readUInt16LE(lho + 28);
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
check(manifest.files === manifest.artifacts.length, "manifest file count mismatch");
check(manifest.bytes === manifest.artifacts.reduce((n, a) => n + a.bytes, 0), "manifest byte total mismatch");
for (const p of onDisk) check(listed.has(p), `unlisted bundle file: ${p}`);
for (const a of manifest.artifacts) {
  if (!fs.existsSync(rel(a.path))) {
    fail(`missing manifest file: ${a.path}`);
    continue;
  }
  const b = read(a.path);
  check(b.length === a.bytes && sha(b) === a.sha256, `manifest hash/size mismatch: ${a.path}`);
}

// ---------- ledger ----------
const ledger = json("source-copy-ledger.json");
check(typeof ledger.root === "string" && /^artifacts\/[^/\\]+$/.test(ledger.root), "ledger root is not a workspace-relative artifacts path");
const ledgerPaths = new Set();
for (const e of ledger.entries) {
  check(!ledgerPaths.has(e.bundlePath), `duplicate ledger entry: ${e.bundlePath}`);
  ledgerPaths.add(e.bundlePath);
  const m = listed.get(e.bundlePath);
  if (!m) fail(`ledger entry not in manifest: ${e.bundlePath}`);
  else check(m.sha256 === e.sha256 && m.bytes === e.bytes, `ledger/manifest mismatch: ${e.bundlePath}`);
  check(
    typeof e.sourcePath === "string" && e.sourcePath && !/^[A-Za-z]:|^[\\/]|\\|(^|\/)\.\.(\/|$)/.test(e.sourcePath),
    `ledger source path is not workspace-relative: ${e.bundlePath}`,
  );
}
for (const p of onDisk) if (/^(attempt-\d\d|fixture)\//.test(p)) check(ledgerPaths.has(p), `copied file missing from ledger: ${p}`);

// ---------- omissions and font programs ----------
const omissions = json("omissions.json");
const omittedHashes = new Set(omissions.fontPrograms.map((f) => f.sha256));
const bundleHashes = new Set(manifest.artifacts.map((a) => a.sha256));
for (const f of omissions.fontPrograms) {
  check(/^[0-9a-f]{64}$/.test(f.sha256) && f.bytes > 0, `malformed omission: ${f.bundlePath}`);
  check(!fs.existsSync(rel(f.bundlePath)), `omitted font program present: ${f.bundlePath}`);
  check(!bundleHashes.has(f.sha256), `omitted font program bytes present: ${f.bundlePath}`);
}
for (const p of [...onDisk, "artifact-manifest.json"]) {
  const b = read(p);
  check(!FONT_EXT.has(path.extname(p).toLowerCase()), `font-program extension present: ${p}`);
  check(!isFontMagic(b), `font-program magic bytes present: ${p}`);
  check(!omittedHashes.has(sha(b)), `omitted font hash present: ${p}`);
}

// ---------- parse checks ----------
const pptx = {};
let pptxEntriesChecked = 0;
for (const p of onDisk) {
  const ext = path.extname(p).toLowerCase();
  try {
    if (ext === ".json" || p.endsWith(".audit.log")) json(p);
    else if (ext === ".jsonl") {
      for (const line of text(p).split(/\r?\n/)) if (line.trim()) JSON.parse(stripBom(line));
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

// ---------- recorded result ----------
const result = {};
try {
  const supervisor = json(`${RUN}/supervisor.json`);
  const worker = json(`${RUN}/worker.json`);
  const progress = json(`${RUN}/progress.json`);
  const report = json(`${RUN}/report.json`);
  const registrations = json(`${RUN}/font-registration.json`);
  const opc = json(`${RUN}/embed-opc-audit.json`);
  const auditLog = json(`${SIDE}/native-font-embed-01.audit.log`);
  const pre = json(`${SIDE}/host-preflight-embed-01.json`);
  const post = json(`${SIDE}/host-postflight-embed-01.json`);
  const generation = json(`${FIX}/generation.json`);
  const stages = text(`${RUN}/stages.jsonl`)
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(stripBom(l)));

  // Supervisor and worker.
  check(supervisor.nativeFontsGatePassed === false, "supervisor.nativeFontsGatePassed is not false");
  check(supervisor.embedSaveRecorded === false, "supervisor.embedSaveRecorded is not false");
  check(supervisor.fontCleanupConfirmed === true, "supervisor.fontCleanupConfirmed is not true");
  check(supervisor.inputsUnchanged === true, "supervisor.inputsUnchanged is not true");
  check(supervisor.ownedCloseCount === 1, "supervisor.ownedCloseCount is not 1");
  check(supervisor.timedOut === false && supervisor.lastDurableStage === "worker.failure", "supervisor terminal state");
  check(supervisor.inputChecks.length > 0 && supervisor.inputChecks.every((c) => c.matched === true && c.expected === c.actual), "supervisor input checks not all matched");
  const knownHashes = new Set([...bundleHashes, ...omittedHashes]);
  const unboundInputs = supervisor.inputChecks.filter((c) => !knownHashes.has(c.expected)).map((c) => `${c.role}/${c.copy}`);
  check(unboundInputs.length === 0, `supervisor input hashes not bound to bundle or omission bytes: ${unboundInputs.join(", ")}`);
  check(worker.exitCode === 1 && worker.timedOut === false, "worker exit state");
  result.supervisor = {
    exitCode: supervisor.exitCode,
    officeLifecycleComplete: supervisor.officeLifecycleComplete,
    nativeFontsGatePassed: supervisor.nativeFontsGatePassed,
    embedSaveRecorded: supervisor.embedSaveRecorded,
    fontCleanupConfirmed: supervisor.fontCleanupConfirmed,
    inputsUnchanged: supervisor.inputsUnchanged,
    ownedCloseCount: supervisor.ownedCloseCount,
    inputChecks: supervisor.inputChecks.length,
    workerSeconds: (Date.parse(worker.finishedAt) - Date.parse(worker.startedAt)) / 1000,
  };

  // Native Fonts gate and embed state.
  const gate = report.nativeFontsGate;
  check(gate.passed === false, "nativeFontsGate.passed is not false");
  check(eq(gate.unexpectedNames, ["Aptos"]), `unexpectedNames ${JSON.stringify(gate.unexpectedNames)}`);
  check(eq(gate.unembeddableNames, []), "unembeddableNames not empty");
  check(eq(gate.entries.map((e) => e.name), ["Carlito", "Aptos"]), "gate entries are not Carlito, Aptos");
  check(gate.entries.every((e) => e.embeddable === -1 && e.embedded === 0), "gate entries not embeddable -1 / embedded 0");
  check(report.embedFonts.attempted === false && report.embedFonts.completed === false, "embed save recorded as attempted/completed");
  check(report.embedFonts.blockedByNativeFontsGate === true, "embed not blocked by native Fonts gate");
  check(report.embedFonts.saveArgument === -1 && report.embedFonts.saveFormat === 24, "requested embed save arguments");
  check(report.saved.sha256 === null, "a saved package hash is recorded");
  check(report.ownedCloseCount === 1, "report.ownedCloseCount is not 1");
  check(!onDisk.some((p) => p.endsWith("native-font-embed.pptx")), "a saved embed package is present");
  result.nativeFontsGate = {
    passed: gate.passed,
    entries: gate.entries.map((e) => `${e.name} (embedded ${e.embedded}, embeddable ${e.embeddable})`),
    unexpectedNames: gate.unexpectedNames,
  };
  result.embedFonts = { attempted: report.embedFonts.attempted, blockedByNativeFontsGate: report.embedFonts.blockedByNativeFontsGate };

  // Stages: contiguous; error null except the gate record and the terminal failure.
  const contiguous = stages.every((s, i) => s.sequence === i + 1 && !Number.isNaN(Date.parse(s.timestamp)));
  check(contiguous, "stage sequence not contiguous or timestamp invalid");
  const nonNull = stages.filter((s) => s.error !== null).map((s) => ({ sequence: s.sequence, stage: s.stage, status: s.status, error: s.error }));
  const last = stages[stages.length - 1];
  check(
    nonNull.length === 2 &&
      nonNull[0].stage === "edited.presentation.native-fonts-gate" &&
      nonNull[0].status === "blocked" &&
      nonNull[0].error === "Aptos|" &&
      nonNull[1].sequence === last.sequence &&
      last.stage === "worker.failure" &&
      last.status === "error" &&
      last.error === GATE_ERROR,
    `unexpected non-null stage errors ${JSON.stringify(nonNull)}`,
  );
  check(progress.sequence === last.sequence && progress.stage === "worker.failure", "progress.json does not match final stage");
  const lastEdit = Math.max(...stages.filter((s) => s.stage.startsWith("edit.")).map((s) => s.sequence));
  const fontsStages = stages.filter((s) => /presentation\.fonts/.test(s.stage)).map((s) => s.sequence);
  check(fontsStages.length > 0 && Math.min(...fontsStages) > lastEdit, "Presentation.Fonts enumerated before the edits finished");
  check(!stages.some((s) => /saveas/i.test(s.stage)), "a SaveAs stage is recorded");
  const editSets = stages.filter((s) => s.stage.startsWith("edit.") && s.stage.endsWith(".set") && s.status === "success").map((s) => s.stage);
  result.stages = {
    records: stages.length,
    contiguous,
    nonNullErrors: nonNull.map((s) => `${s.sequence} ${s.stage} ${s.status}`),
    editSetCalls: editSets.length,
    lastEditSequence: lastEdit,
    firstPresentationFontsSequence: Math.min(...fontsStages),
    preEditFontsBaseline: fontsStages.some((q) => q < lastEdit),
    saveAsStages: 0,
  };

  // Font registrations and omissions.
  const genHashes = generation.fonts.map((f) => f.sha256).sort();
  check(registrations.length === 4 && registrations.every((r) => r.added === 1 && r.removed === true), "font registrations not 4 added / 4 removed");
  check(eq(registrations.map((r) => r.sha256).sort(), genHashes), "registration hashes differ from generation.json");
  for (const dir of [RUN, FIX]) {
    const om = omissions.fontPrograms.filter((f) => f.bundlePath.startsWith(`${dir}/`)).map((f) => f.sha256).sort();
    check(eq(om, genHashes), `omitted font hashes under ${dir} differ from generation.json`);
  }

  // Offline OPC audit.
  check(opc.passed === false, "embed-opc-audit passed is not false");
  check(eq(opc.failures, [{ code: "missing-evidence", message: "native-font-embed.pptx is required" }]), `embed-opc-audit failures ${JSON.stringify(opc.failures)}`);
  check(auditLog.passed === false && auditLog.failures === 1, "audit.log disagrees with embed-opc-audit.json");
  const unboundRaw = [];
  for (const [k, v] of Object.entries(opc.rawHashes)) {
    const direct = `${RUN}/${k}`;
    const om = omissions.fontPrograms.find((f) => f.bundlePath === direct);
    if (om) check(om.sha256 === v, `rawHashes ${k} differs from omission`);
    else if (fs.existsSync(rel(direct))) check(sha(read(direct)) === v, `rawHashes ${k} differs from bundle bytes`);
    else if (!knownHashes.has(v)) unboundRaw.push(k);
  }
  check(unboundRaw.length === 0, `embed-opc-audit rawHashes not bound: ${unboundRaw.join(", ")}`);
  result.embedOpcAudit = { passed: opc.passed, failures: opc.failures.map((f) => `${f.code}: ${f.message}`), rawHashesBound: Object.keys(opc.rawHashes).length };

  // Fixture: exact source, no Aptos anywhere, typeface summary.
  const srcSha = sha(read(`${FIX}/source.pptx`));
  check(srcSha === FIXTURE_SOURCE_SHA, "fixture source.pptx sha256 differs");
  check(sha(read(`${RUN}/inputs/source.pptx`)) === srcSha, "run snapshot differs from fixture source.pptx");
  check(report.source.sha256 === srcSha && report.source.snapshotSha256 === srcSha, "report source hashes differ");
  check(eq(read(`${RUN}/inputs/generation.json`), read(`${FIX}/generation.json`)), "run generation.json differs from fixture");
  const aptosParts = {};
  for (const p of [`${FIX}/source.pptx`, `${FIX}/exporter-output.pptx`, `${RUN}/inputs/source.pptx`]) {
    const hits = [...(pptx[p] ?? new Map())].filter(([, d]) => /aptos/i.test(d.toString("latin1"))).map(([n]) => n);
    aptosParts[p] = hits;
    check(pptx[p] && hits.length === 0, `Aptos found in ${p}: ${hits.join(", ")}`);
  }
  const co = generation.carlitoOnly;
  check(co.exporterOutput.sha256 === sha(read(`${FIX}/exporter-output.pptx`)), "exporter-output.pptx hash differs from generation.json");
  check(co.harnessTransforms.every((t) => t.outputSha256 === srcSha), "harness transform output hash differs from source.pptx");
  const slots = co.themeFontSlots;
  check(
    slots.majorFont.latin === "Carlito" && slots.minorFont.latin === "Carlito" && [slots.majorFont.ea, slots.majorFont.cs, slots.minorFont.ea, slots.minorFont.cs].every((v) => v === ""),
    "theme font slots are not Carlito latin with empty ea/cs",
  );
  check(co.residualNonCarlito.every((r) => r.code === "theme-script-supplement" && eq(r.parts, ["ppt/theme/theme1.xml"])), "residual non-Carlito typefaces are not theme script supplements only");
  check(eq(co.docPropsFontsUsed.values, ["Arial", "Calibri"]), "docProps Fonts Used differ");
  result.fixture = {
    sourceSha256: srcSha,
    aptosPartsFound: Object.values(aptosParts).reduce((n, h) => n + h.length, 0),
    themeFontSlots: `major/minor latin Carlito, ea "", cs ""`,
    residualNonCarlito: `${co.residualNonCarlito.length} theme per-script supplements (ppt/theme/theme1.xml)`,
    docPropsFontsUsed: co.docPropsFontsUsed.values,
  };

  // Host records.
  check(typeof pre.harness === "string" && pre.harness.includes(HARNESS), "preflight harness commit");
  check(pre.fixtureSourceSha256 === srcSha, "preflight fixture source hash");
  check(post.saveAsAttempted === false && post.retry === false && post.officeQuitCalled === false, "postflight save/retry/quit record");
  check(post.fixtureXmlContainsAptos === false, "postflight fixture Aptos record");
  result.host = { harness: pre.harness, saveAsAttempted: post.saveAsAttempted, retry: post.retry };
} catch (err) {
  fail(`recorded result: ${err.message}`);
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
  result,
  failures,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
