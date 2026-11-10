// Closed diagnostic admission. No Office, rendering, export, registry or consumer preparation in this module.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { unzip, parseXml } from "./data-tools.mjs";
export const PROFILE = "b07-independent-segments-readonly-v1";
export const CATALOG = [
  [
    "rtl-contrast-05-mixed-explicit-arabic",
    "7c4b61ae2421b1611c9ff4c2b0db6b871e2f5896d502f38a42ca796b44824a70",
    4,
    101006,
  ],
  [
    "rtl-contrast-06-whole-explicit-arabic",
    "742538697bcb0b962cf80f330136a5f5e9b2640a8107e5ff1b6d0c56d84c73ad",
    4,
    101005,
  ],
  [
    "rtl-contrast-09-long-explicit-arabic",
    "540b63316b78162f4aa051b43e4e4af04719be1773ec5ad3123bca5df1f8920c",
    5,
    101121,
  ],
  [
    "rtl-contrast-10-non-ascii-digits",
    "56d6442f0fe7441304a6f551062ee058cce884d33f7f8822d1a62b5d4f7144bb",
    20,
    102841,
  ],
  [
    "rtl-contrast-11-long-explicit-french",
    "fcfdce33558fc8a2fd7351198d64c84020d496d960b7c1aa6bf7028d9ad62990",
    3,
    101016,
  ],
];
export const CODE = [
  "profile.mjs",
  "data-tools.mjs",
  "segment-worker.ps1",
  "run-segment-observer.ps1",
  "native-process.ps1",
  "SOURCE.json",
];
export const folder = path.dirname(fileURLToPath(import.meta.url));
export const repository = path.resolve(folder, "../..");
export const digest = (b) => createHash("sha256").update(b).digest("hex");
export const fact = (file) => {
  const b = fs.readFileSync(file);
  return { bytes: b.length, sha256: digest(b) };
};
export function plain(file, { exists = true } = {}) {
  assert.equal(typeof file, "string");
  assert.ok(
    path.isAbsolute(file) &&
      !/^[/\\]{2}/u.test(file) &&
      !/[\x00-\x1f]/u.test(file),
    "Absolute local path required",
  );
  const full = path.resolve(file);
  let cursor = full;
  for (;;) {
    try {
      const s = fs.lstatSync(cursor);
      assert.ok(!s.isSymbolicLink(), "Aliased path refused");
      if (cursor === full && exists) assert.ok(s.isFile() || s.isDirectory());
    } catch (e) {
      if (e.code !== "ENOENT" || (exists && cursor === full)) throw e;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return full;
}
const inside = (a, b) =>
  a === b || a.toLowerCase().startsWith(b.toLowerCase() + path.sep);
export function asset(root, relative) {
  assert.equal(typeof relative, "string");
  assert.ok(
    relative &&
      !path.isAbsolute(relative) &&
      !/[\\<>:"|?*\x00-\x1f]/u.test(relative),
  );
  for (const p of relative.split("/"))
    assert.ok(p && ![".", ".."].includes(p) && !/[. ]$/u.test(p));
  const full = plain(path.resolve(root, relative));
  assert.ok(inside(full, path.resolve(root)) && full !== path.resolve(root));
  assert.ok(fs.lstatSync(full).isFile());
  return full;
}
const local = (n) => n.name?.slice(n.name.indexOf("}") + 1),
  find = (n, name) => [
    ...(local(n) === name ? [n] : []),
    ...(n.children ?? []).filter((x) => x.name).flatMap((x) => find(x, name)),
  ],
  attrs = (n) =>
    n
      ? Object.fromEntries(
          Object.entries(n.attributes).map(([k, v]) => [
            k.replace("{}", ""),
            v,
          ]),
        )
      : {},
  text = (n) => (n.children ?? []).map((c) => c.text ?? "").join("");
export function inspect(bytes, expected) {
  assert.ok(Buffer.isBuffer(bytes));
  assert.ok(bytes.length <= 16777216);
  assert.equal(bytes.length, expected.archiveBytes);
  assert.equal(
    digest(bytes),
    expected.archiveSha256,
    "Exact immutable diagnostic archive required before ZIP parsing",
  );
  const zip = unzip(bytes);
  assert.ok(zip.size <= 4096);
  assert.deepEqual(
    [...zip.keys()].filter((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p)),
    ["ppt/slides/slide1.xml"],
  );
  const xml = Buffer.from(zip.get("ppt/slides/slide1.xml")).toString("utf8");
  const tree = parseXml(xml);
  const kinds = ["sp", "grpSp", "graphicFrame", "cxnSp", "pic"];
  assert.equal(
    kinds.reduce((n, k) => n + find(tree, k).length, 0),
    expected.shapeCount,
  );
  assert.ok(expected.shapeCount <= 30);
  const shapes = find(tree, "sp").map((s, index) => {
    const nv = attrs(find(s, "cNvPr")[0]),
      nativeFrame = {
        ...attrs(find(s, "off")[0]),
        ...attrs(find(s, "ext")[0]),
      },
      runs = find(s, "r").map((r) => ({
        text: find(r, "t").map(text).join(""),
        properties: find(r, "rPr")[0],
      }));
    return {
      index: index + 1,
      id: Number(nv.id),
      name: nv.name,
      text: runs.map((r) => r.text).join(""),
      frameEmu: nativeFrame,
      framePoints: Object.fromEntries(
        Object.entries(nativeFrame).map(([k, v]) => [
          { x: "left", y: "top", cx: "width", cy: "height" }[k],
          Math.fround(Number(v) / 12700),
        ]),
      ),
      languages: [...new Set(runs.map((r) => attrs(r.properties).lang))],
      sizes: [
        ...new Set(runs.map((r) => Number(attrs(r.properties).sz) / 100)),
      ],
      runPropertiesSha256: digest(
        Buffer.from(JSON.stringify(runs.map((r) => r.properties))),
      ),
    };
  });
  assert.equal(shapes.length, expected.shapeCount);
  assert.equal(new Set(shapes.map((s) => s.name)).size, shapes.length);
  assert.equal(new Set(shapes.map((s) => s.id)).size, shapes.length);
  return { parts: zip.size, shapes };
}
export function validateSource(root = folder) {
  const source = JSON.parse(
    fs.readFileSync(asset(root, "SOURCE.json"), "utf8"),
  );
  assert.equal(source.profile, PROFILE);
  assert.equal(
    source.artifactEvidenceHead,
    "07406627197535f77fb98fed27e601fb1a71832a",
  );
  assert.equal(
    source.artifactEvidenceTree,
    "b8090b31536bfeefd93c69f794b821934fe25c74",
  );
  assert.equal(
    source.originalExporterHead,
    "473d3fff623bda3f191ae2669824f1b02a5d90f8",
  );
  assert.equal(source.nativeAuthorized, false);
  assert.equal(source.nativeAcceptance, false);
  assert.equal(source.registryAcceptance, false);
  assert.equal(source.publicImportAcceptance, false);
  assert.deepEqual(
    source.cases.map((c) => [
      c.id,
      c.archiveSha256,
      c.shapeCount,
      c.archiveBytes,
    ]),
    CATALOG,
  );
  assert.deepEqual(source.limits, {
    cases: 5,
    slides: 1,
    maxShapesPerSlide: 30,
    exactShapeCounts: [4, 4, 5, 20, 3],
    actions: 0,
    maxArchiveBytes: 16777216,
    maxZipEntries: 4096,
    timeoutSeconds: 45,
    supervisorHardMaximum: 60,
    phases: ["original", "saved-reopened"],
  });
  assert.equal(
    new Set(source.files.map((f) => f.path)).size,
    source.files.length,
  );
  for (const f of source.files)
    assert.deepEqual(fact(asset(root, f.path)), {
      bytes: f.bytes,
      sha256: f.sha256,
    });
  for (const c of source.cases) {
    assert.equal(c.automaticControlEligible, false);
    assert.deepEqual(c.actions, []);
    assert.equal(c.slideCount, 1);
    const observed = inspect(fs.readFileSync(asset(root, c.input)), c),
      expected = JSON.parse(
        fs.readFileSync(asset(root, c.expectation), "utf8"),
      );
    assert.equal(
      expected.sourceSha256,
      digest(fs.readFileSync(asset(root, c.source))),
    );
    assert.equal(
      expected.originalArchiveSha256,
      digest(fs.readFileSync(asset(root, c.original))),
    );
    assert.equal(expected.variantSha256, c.archiveSha256);
    assert.equal(expected.shapeCount, c.shapeCount);
    assert.equal(expected.slideCount, 1);
    assert.equal(expected.nativeAcceptance, false);
    for (const [i, s] of observed.shapes.entries()) {
      const e = expected.shapes[i];
      for (const k of [
        "index",
        "id",
        "name",
        "text",
        "frameEmu",
        "framePoints",
        "runPropertiesSha256",
      ])
        assert.deepEqual(s[k], e[k]);
      assert.deepEqual(s.languages, [e.language]);
      assert.deepEqual(s.sizes, [e.fontSize]);
      assert.equal(
        e.languageId,
        e.language === "ar-SA" ? 1025 : e.language === "fr-FR" ? 1036 : NaN,
      );
      assert.ok(s.text.length <= 65535 && s.name.length <= 255);
    }
    c.expectationValue = expected;
  }
  const process = source.files.find((f) => f.path === "native-process.ps1");
  assert.deepEqual(
    { bytes: process.bytes, sha256: process.sha256 },
    {
      bytes: 2341,
      sha256:
        "b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c",
    },
  );
  return source;
}
function git(...a) {
  return execFileSync("git", ["--no-optional-locks", "-C", repository, ...a], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}
export function codeIdentity(expectedHead) {
  assert.match(expectedHead, /^[a-f0-9]{40}$/u);
  assert.equal(git("rev-parse", "HEAD"), expectedHead);
  assert.equal(
    git("status", "--porcelain", "--untracked-files=normal"),
    "",
    "Clean reviewed controller required",
  );
  return {
    directory: repository,
    revision: expectedHead,
    dirty: false,
    files: CODE.map((p) => ({
      path: "tools/rr105-native-segment-observer/" + p,
      ...fact(asset(folder, p)),
    })),
  };
}
export function create({
  expectedHead,
  caseId,
  output,
  officeAuthorized = false,
}) {
  assert.match(process.version, /^v24\./u);
  assert.equal(typeof officeAuthorized, "boolean");
  const source = validateSource(),
    selected = source.cases.find((c) => c.id === caseId);
  assert.ok(selected, "Select one of exactly five whole cases");
  const controller = codeIdentity(expectedHead),
    target = plain(output, { exists: false });
  assert.ok(!fs.existsSync(target), "Fresh admission output required");
  assert.ok(!inside(target, repository) && !inside(repository, target));
  assert.ok(fs.statSync(plain(path.dirname(target))).isDirectory());
  const envelope = {
    schemaVersion: 1,
    profile: PROFILE,
    case: caseId,
    officeAuthorized,
    nativeAcceptance: false,
    registryAcceptance: false,
    publicImportAcceptance: false,
    timeoutSeconds: 45,
    actions: [],
    limits: source.limits,
    generation: {
      artifactEvidenceHead: source.artifactEvidenceHead,
      diagnosticConstructorHead: source.diagnosticConstructorHead,
      originalExporterHead: source.originalExporterHead,
      sourceFile: fact(asset(folder, "SOURCE.json")),
      installedConsumerClaim: false,
    },
    controllerRepository: controller,
    node: {
      path: process.execPath,
      version: process.version,
      identity: fact(process.execPath),
    },
    selected: {
      id: selected.id,
      input: selected.input,
      source: selected.source,
      original: selected.original,
      expectation: selected.expectation,
      archiveSha256: selected.archiveSha256,
      archiveBytes: selected.archiveBytes,
      shapeCount: selected.shapeCount,
      slideCount: 1,
      automaticControlEligible: false,
    },
  };
  fs.mkdirSync(target);
  const bytes = Buffer.from(JSON.stringify(envelope, null, 2) + "\n"),
    file = path.join(target, "execution-envelope.json");
  fs.writeFileSync(file, bytes, { flag: "wx" });
  return {
    envelope: file,
    expectedEnvelopeSha256: digest(bytes),
    case: caseId,
    nativeRun: false,
    officeAuthorized,
  };
}
export function verify(
  envelopeFile,
  expectedDigest,
  { requireOffice = false } = {},
) {
  const full = plain(envelopeFile),
    bytes = fs.readFileSync(full);
  assert.ok(bytes.length <= 4194304);
  assert.match(expectedDigest, /^[a-f0-9]{64}$/u);
  assert.equal(digest(bytes), expectedDigest);
  const e = JSON.parse(bytes);
  assert.equal(e.schemaVersion, 1);
  assert.equal(e.profile, PROFILE);
  assert.equal(e.nativeAcceptance, false);
  assert.equal(e.registryAcceptance, false);
  assert.equal(e.publicImportAcceptance, false);
  assert.equal(typeof e.officeAuthorized, "boolean");
  if (requireOffice)
    assert.equal(
      e.officeAuthorized,
      true,
      "Explicit separately reviewed root authorization required",
    );
  assert.equal(e.timeoutSeconds, 45);
  assert.deepEqual(e.actions, []);
  assert.equal(e.node.path, process.execPath);
  assert.equal(e.node.version, process.version);
  assert.deepEqual(e.node.identity, fact(process.execPath));
  assert.deepEqual(
    codeIdentity(e.controllerRepository.revision),
    e.controllerRepository,
  );
  const s = validateSource();
  assert.deepEqual(e.limits, s.limits);
  assert.deepEqual(e.generation.sourceFile, fact(asset(folder, "SOURCE.json")));
  assert.deepEqual(e.generation, {
    artifactEvidenceHead: s.artifactEvidenceHead,
    diagnosticConstructorHead: s.diagnosticConstructorHead,
    originalExporterHead: s.originalExporterHead,
    sourceFile: fact(asset(folder, "SOURCE.json")),
    installedConsumerClaim: false,
  });
  const c = s.cases.find((c) => c.id === e.case);
  assert.ok(c);
  for (const k of [
    "id",
    "input",
    "source",
    "original",
    "expectation",
    "archiveSha256",
    "archiveBytes",
    "shapeCount",
    "slideCount",
    "automaticControlEligible",
  ])
    assert.deepEqual(e.selected[k], c[k]);
  return {
    envelope: e,
    inputPath: asset(folder, c.input),
    expectation: c.expectationValue,
    supervisorPath: asset(folder, "native-process.ps1"),
    workerPath: asset(folder, "segment-worker.ps1"),
    officeAuthorized: e.officeAuthorized,
    nativeAcceptance: false,
  };
}
export function verifyExecution(
  envelopeFile,
  expectedDigest,
  output,
  { requireOffice = false } = {},
) {
  const binding = verify(envelopeFile, expectedDigest, { requireOffice }),
    root = plain(output);
  assert.equal(
    path.resolve(envelopeFile),
    path.join(root, "execution-envelope.json"),
  );
  assert.ok(!inside(root, repository) && !inside(repository, root));
  const input = asset(root, "inputs/case.pptx"),
    worker = asset(root, "inputs/segment-worker.ps1");
  assert.deepEqual(fact(input), {
    bytes: binding.envelope.selected.archiveBytes,
    sha256: binding.envelope.selected.archiveSha256,
  });
  assert.deepEqual(fact(worker), fact(binding.workerPath));
  assert.deepEqual(
    fact(asset(root, "inputs/native-process.ps1")),
    fact(binding.supervisorPath),
  );
  return { ...binding, inputPath: input };
}
function args(values) {
  const out = {};
  for (let i = 0; i < values.length; i += 2) {
    assert.ok(values[i]?.startsWith("--") && values[i + 1] !== undefined);
    assert.ok(!Object.hasOwn(out, values[i].slice(2)));
    out[values[i].slice(2)] = values[i + 1];
  }
  return out;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, ...rest] = process.argv.slice(2),
      a = args(rest);
    let result;
    if (command === "plan") {
      assert.deepEqual(Object.keys(a), []);
      const s = validateSource();
      result = {
        profile: PROFILE,
        cases: s.cases.map((c) => ({
          id: c.id,
          shapes: c.shapeCount,
          archiveSha256: c.archiveSha256,
        })),
        nativeAuthorized: false,
        nativeRun: false,
      };
    } else if (command === "create") {
      assert.ok(
        Object.keys(a).every((k) =>
          ["expected-revision", "case", "output", "office-authorized"].includes(
            k,
          ),
        ),
      );
      assert.ok(
        a["office-authorized"] === undefined ||
          ["true", "false"].includes(a["office-authorized"]),
      );
      result = create({
        expectedHead: a["expected-revision"],
        caseId: a.case,
        output: a.output,
        officeAuthorized: a["office-authorized"] === "true",
      });
    } else if (command === "verify" || command === "verify-execution") {
      assert.ok(
        Object.keys(a).every((k) =>
          [
            "envelope",
            "expected-envelope-sha256",
            "output",
            "require-office",
          ].includes(k),
        ),
      );
      assert.ok(
        a["require-office"] === undefined ||
          ["true", "false"].includes(a["require-office"]),
      );
      const options = { requireOffice: a["require-office"] === "true" };
      result =
        command === "verify"
          ? verify(a.envelope, a["expected-envelope-sha256"], options)
          : verifyExecution(
              a.envelope,
              a["expected-envelope-sha256"],
              a.output,
              options,
            );
    } else
      throw Error("Default-deny: select plan/create/verify/verify-execution");
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error(e.stack);
    process.exitCode = 1;
  }
}
