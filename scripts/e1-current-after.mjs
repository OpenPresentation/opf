// RR-20/E1: immutable historical controls + current published CLI drawings. Never edits a public artifact.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { embeddedCopy } from "../packages/gallery/scripts/build.mjs";

export const RECOVERY = {
  commit: "442ad549d53131cfb32b5c65d974777f33f68a67",
  path: "docs/evidence/rr20-e1-recovery/payload",
  sha256: "901296967ae1cad3c709cbb65f58f4277261133ec00a704c385a40b6ad458816",
};
export const PILOT_COMMIT = "c3e7196aca3c3f18242b405ff870b8bace768fd8";
export const PACKAGES = [
  "@openpresentation/opf",
  "@openpresentation/gallery",
  "@openpresentation/opf-render",
  "@openpresentation/opf-pptx",
  "@openpresentation/opf-editor",
  "@openpresentation/cli",
];
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const encode = (value) => JSON.stringify(value, null, 2) + "\n";
const fact = (file) => {
  const b = fs.readFileSync(file);
  return { bytes: b.length, sha256: sha(b) };
};
const git = (repo, args) => execFileSync("git", ["-C", repo, ...args], { maxBuffer: 64 * 1024 * 1024 });
const blob = (repo, commit, file) => git(repo, ["show", `${commit}:${file}`]);
const plain = (value) => value && typeof value === "object" && !Array.isArray(value);
export function child(root, relative) {
  assert.equal(typeof relative, "string");
  assert.ok(
    relative &&
      !relative.includes("\\") &&
      !relative.split("/").some((p) => !p || p === "." || p === "..") &&
      !path.isAbsolute(relative) &&
      !relative.includes(":"),
    "Unsafe relative path",
  );
  const result = path.resolve(root, relative),
    delta = path.relative(root, result);
  assert.ok(delta && !delta.startsWith("..") && !path.isAbsolute(delta), "Path escapes root");
  return result;
}
const save = (root, relative, bytes) => {
  const file = child(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { flag: "wx" });
  return file;
};
const parse = (bytes) => JSON.parse(Buffer.from(bytes).toString("utf8"));
const pngSize = (bytes) => {
  const b = Buffer.from(bytes);
  assert.ok(b.length > 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Expected PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

export function validateAuthority(authority) {
  assert.match(authority.release, /^\d+\.\d+\.\d+$/);
  assert.match(authority.commit, /^[a-f0-9]{40}$/);
  assert.ok(Number.isFinite(Date.parse(authority.verifiedAt)), "Publication verification required");
  assert.equal(authority.packages.length, 7);
  assert.equal(new Set(authority.packages.map((p) => p.name)).size, 7);
  for (const p of authority.packages) {
    assert.equal(p.version, authority.release);
    assert.equal(p.gitHead, authority.commit);
    assert.match(p.integrity, /^sha512-/);
    assert.ok(p.tarball?.startsWith("https://registry.npmjs.org/"));
    assert.equal(p.attestations?.provenance?.predicateType, "https://slsa.dev/provenance/v1");
  }
  assert.deepEqual(new Set(authority.packages.map((p) => p.name)), new Set([...PACKAGES, "@openpresentation/mcp"]));
}
// Resolve only these packages' explicitly declared public Node/import exports. CJS require.resolve
// cannot discover import-only entries (including opf/examples). No wildcard/private-file fallback.
export function resolveInstalledImport(modules, specifier) {
  const match = /^(@openpresentation\/[^/]+)(\/.*)?$/.exec(specifier);
  assert.ok(match, "Expected declared OPF public entry");
  const directory = path.join(modules, match[1]),
    manifest = json(path.join(directory, "package.json"));
  const key = match[2] ? "." + match[2] : ".";
  const exports = manifest.exports;
  const value = typeof exports === "string" ? (key === "." ? exports : undefined) : exports?.[key];
  function target(value) {
    if (typeof value === "string") return value;
    assert.ok(plain(value), "Missing/unsupported public import export");
    for (const [condition, entry] of Object.entries(value)) {
      if (["node", "import", "default"].includes(condition)) return target(entry);
    }
    throw new Error("No Node/import export");
  }
  const selected = target(value);
  assert.ok(selected.startsWith("./"), "Export target must stay inside package");
  const file = child(directory, selected.slice(2)),
    real = fs.realpathSync(file),
    relative = path.relative(directory, real);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "Public entry escapes its installed package",
  );
  return real;
}
export function verifyConsumer(consumer, authority) {
  validateAuthority(authority);
  assert.ok(
    !process.env.NODE_OPTIONS &&
      !process.env.NODE_PATH &&
      !process.execArgv.some((a) => /^--(?:import|loader|require)/.test(a)),
    "No loaders or ancestor aliases",
  );
  consumer = fs.realpathSync(consumer);
  const modules = fs.realpathSync(path.join(consumer, "node_modules"));
  assert.equal(modules, path.join(consumer, "node_modules"), "Consumer node_modules must not be linked");
  const lock = json(path.join(consumer, "package-lock.json")),
    manifest = json(path.join(consumer, "package.json")),
    packages = [];
  for (const [name, entry] of Object.entries(lock.packages ?? {})) {
    assert.ok(!entry.link, "No workspace/file links");
    if (name && entry.resolved)
      assert.ok(entry.resolved.startsWith("https://registry.npmjs.org/"), "Registry-only dependencies");
  }
  assert.equal(
    Object.keys(lock.packages).filter(
      (p) => p === "node_modules/@openpresentation/opf" || p.endsWith("/node_modules/@openpresentation/opf"),
    ).length,
    1,
    "Exactly one core",
  );
  for (const name of PACKAGES) {
    assert.equal(manifest.dependencies?.[name], authority.release, "Exact direct package pin");
    const entry = lock.packages["node_modules/" + name],
      proof = authority.packages.find((p) => p.name === name);
    assert.equal(entry?.version, authority.release);
    assert.equal(entry.integrity, proof.integrity, "Registry SRI");
    assert.equal(entry.resolved, proof.tarball, "Registry tarball");
    const dir = path.join(modules, name);
    assert.equal(fs.realpathSync(dir), dir, "No package symlink");
    const pkg = json(path.join(dir, "package.json"));
    assert.equal(pkg.name, name);
    assert.equal(pkg.version, authority.release);
    packages.push({
      name,
      version: pkg.version,
      integrity: entry.integrity,
      tarball: entry.resolved,
      gitHead: proof.gitHead,
    });
  }
  const resolve = (specifier) => resolveInstalledImport(modules, specifier);
  const cliPackage = json(path.join(modules, "@openpresentation/cli/package.json"));
  const entry = typeof cliPackage.bin === "string" ? cliPackage.bin : cliPackage.bin?.opf;
  const cli = child(path.join(modules, "@openpresentation/cli"), entry?.replace(/^\.\//, ""));
  assert.equal(fs.realpathSync(cli), cli, "CLI entry must remain in the consumer");
  return {
    consumer,
    modules,
    packages,
    cli,
    resolve,
    lock: fact(path.join(consumer, "package-lock.json")),
  };
}

// All installed runtime bytes, including bundled/font-peer faces, are sealed before and after execution.
export function installedInventory(modules) {
  const rows = [];
  function walk(dir, relative) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".bin") continue;
      const file = path.join(dir, entry.name),
        id = relative + "/" + entry.name;
      assert.ok(!entry.isSymbolicLink(), "No linked runtime files");
      if (entry.isDirectory()) walk(file, id);
      else if (entry.isFile()) rows.push({ path: id.slice(1), ...fact(file) });
    }
  }
  walk(modules, "");
  return rows;
}
export function sourceLayoutRecords(index, read) {
  assert.equal(index.kind, "layouts");
  assert.ok(Array.isArray(index.records));
  const records = {};
  for (const entry of index.records) {
    assert.match(entry.file, /^[a-z0-9-]+\.json$/);
    const record = read(entry.file);
    assert.equal(record.id, entry.id);
    assert.ok(!Object.hasOwn(records, entry.id));
    records[entry.id] = embeddedCopy(record);
  }
  return records;
}
export function verifySource(repo, authority, examples, gallery) {
  const files = git(repo, [
    "ls-tree",
    "-r",
    "--name-only",
    authority.commit,
    "--",
    "examples/gallery",
    "examples/technical",
  ])
    .toString("utf8")
    .trim()
    .split("\n")
    .filter((p) => p.endsWith(".opf.json"))
    .sort();
  const expected = files.map((file) => ({
    file,
    category: file.split("/")[1],
    sha256: sha(JSON.stringify(parse(blob(repo, authority.commit, file)))),
  }));
  const actual = examples
    .map((e) => ({
      file: e.file,
      category: e.category,
      sha256: sha(JSON.stringify(e.deck)),
    }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  assert.deepEqual(actual, expected, "Installed examples must equal exact release source");
  const buildFile = "packages/gallery/scripts/build.mjs",
    builder = blob(repo, authority.commit, buildFile);
  assert.ok(
    builder.equals(fs.readFileSync(fileURLToPath(new URL("../" + buildFile, import.meta.url)))),
    "Use the exact maintained release embeddedCopy helper",
  );
  const index = parse(blob(repo, authority.commit, "packages/gallery/catalog/layouts/index.json"));
  const layouts = sourceLayoutRecords(index, (file) =>
    parse(blob(repo, authority.commit, "packages/gallery/catalog/layouts/" + file)),
  );
  const expectedLayouts = Object.fromEntries(
    Object.entries(layouts).map(([id, record]) => [id, sha(JSON.stringify(record))]),
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(gallery.layouts).map(([id, r]) => [id, sha(JSON.stringify(r))])),
    expectedLayouts,
    "Installed gallery must equal release source",
  );
  if (authority.release === "0.33.0") {
    assert.equal(expected.length, 137);
    assert.equal(Object.keys(layouts).length, 36);
  }
  const source = blob(repo, authority.commit, "examples/technical/layout-sampler.opf.json"),
    sampler = parse(source);
  assert.deepEqual(sampler, examples.find((e) => e.file === "examples/technical/layout-sampler.opf.json")?.deck);
  if (authority.release === "0.33.0") assert.equal(sampler.slides.length, 49);
  return {
    source,
    sampler,
    examples: expected,
    layouts: expectedLayouts,
    galleryBuilder: { file: buildFile, sha256: sha(builder) },
    ...(/^0\.34\.\d+$/.test(authority.release) ? {
      comparisonSchema: {
        file: "spec/schemas/opf.schema.json",
        sha256: sha(blob(repo, authority.commit, "spec/schemas/opf.schema.json")),
        schema: parse(blob(repo, authority.commit, "spec/schemas/opf.schema.json")),
      },
    } : {}),
  };
}

export function loadRecovery(root, repo, unzip) {
  const raw = fs.readFileSync(path.join(root, "recovery.json"));
  assert.equal(sha(raw), RECOVERY.sha256, "Pinned recovery442ad");
  const sealBytes = fs.readFileSync(path.join(root, "seal.json"));
  assert.ok(sealBytes.equals(blob(repo, RECOVERY.commit, RECOVERY.path + "/seal.json")), "Pinned packet seal");
  const record = parse(raw),
    seal = parse(sealBytes);
  assert.equal(seal.recoverySha256, sha(raw));
  assert.deepEqual(seal.packets, record.packets);
  const packets = new Map(),
    assets = new Map();
  for (const p of seal.packets) {
    const b = fs.readFileSync(child(root, p.file));
    assert.equal(sha(b), p.sha256, p.file);
    assert.equal(b.length, p.bytes);
    const parts = unzip(b);
    assert.equal(Object.keys(parts).length, p.entries);
    packets.set(p.file, parts);
  }
  for (const a of record.assets) {
    const b = Buffer.from(
      a.storage.kind === "git"
        ? blob(repo, a.storage.commit, a.storage.path)
        : (packets.get(a.storage.file)?.[a.storage.entry] ?? []),
    );
    assert.equal(b.length, a.bytes, a.id);
    assert.equal(sha(b), a.sha256, a.id);
    assert.equal(
      createHash("sha1")
        .update(Buffer.from("blob " + b.length + "\0"))
        .update(b)
        .digest("hex"),
      a.gitObject,
    );
    if (a.id.endsWith(".png")) assert.deepEqual(pngSize(b), { width: a.width, height: a.height });
    assert.ok(!assets.has(a.id), "Duplicate asset");
    assets.set(a.id, b);
  }
  assert.equal(assets.size, 2901);
  assert.equal(record.corpus.slideCount, 844);
  assert.equal(record.corpus.publishedSubsetSlides, 550);
  assert.deepEqual(
    record.corpus.missing.map((r) => r.batch + "/" + r.id),
    ["batch-11/s27", "batch-13/s29", "batch-17/s04"],
  );
  let slides = 0,
    published = 0,
    before = 0,
    claude = 0;
  for (const batch of record.corpus.batches) {
    const deck = parse(assets.get(batch.source));
    assert.deepEqual(
      deck.slides.map((s) => s.id),
      batch.slides.map((s) => s.id),
    );
    for (const [i, s] of batch.slides.entries()) {
      assert.equal(s.ordinal, i + 1);
      assert.equal(sha(JSON.stringify(deck.slides[i])), s.sourceSlideSha256);
      if (s.before) {
        assert.ok(assets.has(s.before));
        before++;
      }
      assert.ok(assets.has(s.claude));
      claude++;
      if (batch.publishedBatch) {
        assert.ok(s.before);
        published++;
      }
      slides++;
    }
  }
  assert.deepEqual([slides, published, before, claude], [844, 550, 841, 844]);
  const candidates = record.pilot.sourceCandidates.map((r) => parse(assets.get(r.source)));
  assert.deepEqual(candidates[0].slides, candidates[1].slides);
  assert.equal(record.pilot.slides.length, 43);
  assert.equal(record.pilot.exactBeforeProducer, null);
  for (const [i, s] of record.pilot.slides.entries()) {
    assert.equal(candidates[0].slides[i].id, s.id);
    assert.ok(assets.has(s.before) && assets.has(s.claude));
  }
  return { record, assets, sealSha256: sha(sealBytes) };
}

export function currentGallerySource(raw, gallery) {
  const original = parse(raw),
    derived = structuredClone(original),
    removed = [];
  assert.ok(Array.isArray(original.slides) && original.slides.length > 0);
  const ids = new Set();
  for (const s of original.slides) {
    assert.match(s.id, /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Safe explicit unique slide id");
    assert.ok(!ids.has(s.id), "Duplicate slide id");
    ids.add(s.id);
  }
  if (original.catalogs !== undefined) {
    assert.ok(plain(original.catalogs));
    assert.deepEqual(
      Object.keys(original.catalogs),
      ["default"],
      "Only historical default layout snapshots may be removed",
    );
    const catalog = original.catalogs.default;
    assert.ok(plain(catalog));
    assert.deepEqual(new Set(Object.keys(catalog)), new Set(["source", "layouts"]));
    assert.equal(catalog.source, gallery.source);
    assert.ok(plain(catalog.layouts));
    for (const [id, record] of Object.entries(catalog.layouts)) {
      assert.ok(Object.hasOwn(gallery.layouts, id), "Cannot discard a custom layout");
      removed.push({
        id,
        sha256: sha(JSON.stringify(record)),
        currentSha256: sha(JSON.stringify(gallery.layouts[id])),
      });
    }
    delete derived.catalogs;
  }
  const without = { ...original };
  delete without.catalogs;
  assert.deepEqual(derived, without, "No authored content/metadata mutation");
  return {
    deck: derived,
    bytes: Buffer.from(encode(derived)),
    removed,
    authoredSlidesSha256: sha(JSON.stringify(original.slides)),
  };
}
// A comparison-input projection for the published 0.34 vocabulary, never a runtime legacy upgrader.
// Only these typed owners are visited. Strings and nested payload/data/extension trees are opaque.
export function comparisonInputSource(raw, gallery, release, schema) {
  assert.match(release, /^0\.(33|34)\.\d+$/, "Comparison projection supports published 0.33/0.34 only");
  const current = currentGallerySource(raw, gallery);
  if (release.startsWith("0.33.")) return current;
  const columns = ["start", "center", "end", "start+center", "center+end", "start+center+end"],
    rows = ["top", "middle", "bottom", "top+middle", "middle+bottom", "top+middle+bottom"],
    regions = [...columns, ...rows, ...rows.flatMap(row => columns.map(column => row + ":" + column))],
    slideSchema = schema?.$defs?.Slide,
    furnitureSchema = schema?.$defs?.HeaderFooter;
  assert.equal(schema?.properties?.design?.$ref, "#/$defs/Design");
  assert.equal(slideSchema?.properties?.design?.$ref, "#/$defs/SlideDesign");
  assert.ok(schema.$defs.SlideDesign?.allOf?.some(value => value.$ref === "#/$defs/Design"));
  for (const name of ["header", "footer"]) {
    assert.ok(schema.$defs.Design?.properties?.[name]?.oneOf?.some(value => value.$ref === "#/$defs/HeaderFooter"));
    assert.ok(!Object.hasOwn(slideSchema.properties, name), "Unexpected direct Slide furniture schema");
  }
  assert.equal(slideSchema?.additionalProperties, false, "Closed release Slide schema required");
  assert.deepEqual(new Set(Object.entries(slideSchema.properties).filter(([, value]) =>
    value.$ref === "#/$defs/ContentPayload").map(([key]) => key)), new Set(regions),
    "Exact 48 release ContentPayload region names required");
  assert.equal(furnitureSchema?.additionalProperties, false, "Closed release HeaderFooter required");
  assert.deepEqual(Object.keys(furnitureSchema.properties), ["start", "center", "end"]);
  const regionNames = new Map(regions.map(key => [key.replaceAll("start", "left").replaceAll("end", "right"), key])),
    deck = structuredClone(current.deck), changes = [];
  const pointer = (base, key) => base + "/" + key.replaceAll("~", "~0").replaceAll("/", "~1");
  function rename(owner, base, names, allowed) {
    assert.ok(plain(owner), "Typed comparison owner must be an object: " + base);
    const entries = Object.entries(owner), targets = new Set();
    for (const [key] of entries) {
      const target = names.get(key) ?? key;
      assert.ok(Object.hasOwn(allowed, target), "Unknown comparison key: " + pointer(base, key));
      assert.ok(!targets.has(target), "Colliding comparison key: " + pointer(base, key));
      targets.add(target);
    }
    for (const [key] of entries) delete owner[key];
    for (const [key, value] of entries) {
      const target = names.get(key) ?? key;
      Object.defineProperty(owner, target, { value, enumerable: true, writable: true, configurable: true });
      if (target !== key) changes.push({ from: pointer(base, key), to: pointer(base, target) });
    }
  }
  function furniture(design, base) {
    if (design === undefined) return;
    assert.ok(plain(design), "Typed comparison design must be an object: " + base);
    for (const name of ["header", "footer"]) {
      if (!Object.hasOwn(design, name) || design[name] === false) continue;
      rename(design[name], pointer(base, name), new Map([["left", "start"], ["right", "end"]]), furnitureSchema.properties);
    }
  }
  furniture(deck.design, "/design");
  for (const [index, slide] of deck.slides.entries()) {
    rename(slide, "/slides/" + index, regionNames, slideSchema.properties);
    furniture(slide.design, "/slides/" + index + "/design");
  }
  // Inverting only the recorded property-name changes must recover every original value and boundary.
  const inverse = structuredClone(deck);
  for (const change of changes.toReversed()) {
    const from = change.from.split("/").slice(1), to = change.to.split("/").slice(1),
      owner = to.slice(0, -1).reduce((value, key) => value[key], inverse), value = owner[to.at(-1)];
    delete owner[to.at(-1)];
    Object.defineProperty(owner, from.at(-1), { value, enumerable: true, writable: true, configurable: true });
  }
  assert.deepEqual(inverse, current.deck, "Only recorded typed property names may change");
  const bytes = Buffer.from(encode(deck));
  return { ...current, deck, bytes, projection: {
    policy: "opf-e3-comparison-input-034/v1", release,
    originalSha256: sha(raw), currentGallerySha256: sha(current.bytes), projectedSha256: sha(bytes), changes,
  } };
}
export function makePlan(recovery, currentSource, only) {
  const { record, assets } = recovery,
    pilot = record.pilot.sourceCandidates.find((c) => c.commit === PILOT_COMMIT);
  assert.ok(pilot);
  const fixedById = new Map(record.pilot.slides.map((s) => [s.id, s]));
  const rows = [
    {
      id: "overview",
      raw: currentSource.source,
      sourceCommit: currentSource.commit,
      slides: currentSource.sampler.slides.map((s, i) => ({
        ...fixedById.get(s.id),
        id: s.id,
        ordinal: i + 1,
        neutral: fixedById.get(s.id)?.neutral ?? null,
      })),
      publishedBatch: false,
      currentOnly: true,
    },
    {
      id: "pilot",
      raw: assets.get(pilot.source),
      sourceCommit: pilot.commit,
      slides: record.pilot.slides,
      publishedBatch: false,
      pilotProducerStatus: "Latest known authored43 candidate; NOT a proven old panel producer",
    },
    ...record.corpus.batches.map((b) => ({
      ...b,
      id: b.batch,
      raw: assets.get(b.source),
    })),
  ];
  if (only) {
    const ids = only.split(",");
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length && ids.every((id) => rows.some((r) => r.id === id)), "Unknown or duplicate selected deck");
    return rows.filter((r) => ids.includes(r.id));
  }
  return rows;
}
export function cliInvocation(cli, input, out, { scale, date }) {
  assert.ok(Number.isFinite(scale) && scale >= 0.1 && scale <= 8, "Scale0.1–8");
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(date + "T00:00:00Z").toISOString().slice(0, 10), date, "Calendar date");
  return {
    command: process.execPath,
    args: [
      cli,
      "convert",
      input,
      path.join(out, "slide-{n}.png"),
      "--scale",
      String(scale),
      "--date",
      date,
      "--keep-slides",
      "--include-hidden",
    ],
  };
}
export function validateCliOutput(result, report, directory, count) {
  assert.equal(result.status, 0, "CLI failure remains a failure");
  assert.equal(report.ok, true);
  assert.equal(report.command, "convert");
  assert.equal(report.outputs.length, count, "No slide continuation, hiding or loss");
  assert.equal(report.fonts?.pack, "office");
  assert.equal(report.fonts.substitutionPolicy, "visual");
  assert.deepEqual(report.fonts.userFonts, [], "No handpicked font replacement");
  assert.ok(!report.pagination && !report.continued?.length, "No automatic content rewrite");
  return report.outputs.map((item, i) => {
    const file = path.resolve(item.file),
      relative = path.relative(directory, file);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "CLI output escaped fresh deck");
    assert.equal(item.mediaType, "image/png");
    assert.equal(
      path.basename(file),
      `slide-${String(i + 1).padStart(String(count).length, "0")}.png`,
      "Exact ordinal output binding",
    );
    const b = fs.readFileSync(file);
    assert.equal(b.length, item.bytes);
    assert.equal(sha(b), item.sha256);
    return {
      ordinal: i + 1,
      file: relative.replaceAll("\\", "/"),
      ...fact(file),
      ...pngSize(b),
    };
  });
}
// Retain the first literal CLI failure before parsing or validating it; never retry or patch its deck.
export function captureCliAttempt(directory, invocation, consumer, execute = spawnSync) {
  const result = execute(invocation.command, invocation.args, {
    cwd: consumer,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300000,
    windowsHide: true,
  });
  save(directory, "cli.stdout.json", result.stdout ?? "");
  save(directory, "cli.stderr.txt", result.stderr ?? "");
  save(
    directory,
    "cli.exit.json",
    encode({
      status: result.status,
      signal: result.signal ?? null,
      error: result.error ? String(result.error) : null,
    }),
  );
  assert.ok(!result.error, String(result.error));
  assert.equal(result.status, 0, "CLI failure remains a failure; see preserved stdout/stderr");
  return { result, report: JSON.parse(result.stdout) };
}
const xml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function sheetSvg(rows, { width = 480 } = {}) {
  const header = 34,
    rowHeight = (width * 9) / 16 + 26,
    gap = 8;
  let body = '<rect width="100%" height="100%" fill="#eef1f5"/>';
  const labels = ["Before (fixed)", "After (current release)", "Claude (fixed)"];
  labels.forEach((l, i) => {
    body += `<text x="${i * (width + gap) + 12}" y="23" font-family="Roboto" font-size="16">${l}</text>`;
  });
  rows.forEach((row, i) => {
    const y = header + i * rowHeight;
    body += `<text x="12" y="${y + 18}" font-family="Roboto" font-size="14">${xml(row.label)}</text>`;
    [row.before, row.after, row.claude].forEach((bytes, col) => {
      if (bytes)
        body += `<image x="${col * (width + gap)}" y="${y + 24}" width="${width}" height="${(width * 9) / 16}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${bytes.toString("base64")}"/>`;
      else
        body += `<text x="${col * (width + gap) + 12}" y="${y + 80}" font-family="Roboto" font-size="14">No historical panel</text>`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${3 * width + 2 * gap}" height="${header + rows.length * rowHeight}" viewBox="0 0 ${3 * width + 2 * gap} ${header + rows.length * rowHeight}">${body}</svg>`;
}

export async function run(options, { execute = spawnSync } = {}) {
  const { out, repo, recovery: recoveryRoot, consumer, authority: authorityPath, only, mode } = options;
  assert.ok(["plan", "render"].includes(mode), "Mode plan or render");
  assert.ok(
    out && repo && recoveryRoot && consumer && authorityPath,
    "Required --out --repo --recovery --consumer --authority",
  );
  assert.ok(!fs.existsSync(out), "Fresh output root required");
  const authority = json(authorityPath),
    installed = verifyConsumer(consumer, authority),
    runtime = installedInventory(installed.modules);
  const galleryModule = await import(pathToFileURL(installed.resolve("@openpresentation/gallery")).href),
    examplesModule = await import(pathToFileURL(installed.resolve("@openpresentation/opf/examples")).href);
  const source = verifySource(repo, authority, examplesModule.examples, galleryModule.gallery);
  source.commit = authority.commit;
  const req = createRequire(path.join(installed.modules, "@openpresentation/opf-pptx/package.json"));
  const recovered = loadRecovery(recoveryRoot, repo, req("fflate").unzipSync),
    plan = makePlan(recovered, source, only);
  const prepared = plan.map((row) => ({
    ...row,
    current: comparisonInputSource(row.raw, galleryModule.gallery, authority.release, source.comparisonSchema?.schema),
  }));
  // Validate flags before creating any output, or executing any renderer.
  cliInvocation(installed.cli, "input", "out", options);
  fs.mkdirSync(out, { recursive: false });
  const receipt = {
    schema: "opf-e1-current-after/v1",
    mode,
    renderedSlides: 0,
    complete: false,
    node: process.version,
    release: authority.release,
    releaseCommit: authority.commit,
    registryVerifiedAt: authority.verifiedAt,
    recovery: { ...RECOVERY, sealSha256: recovered.sealSha256 },
    tool: {
      file: path.basename(fileURLToPath(import.meta.url)),
      ...fact(fileURLToPath(import.meta.url)),
      galleryBuilder: source.galleryBuilder,
      ...(source.comparisonSchema ? { comparisonSchema: {
        file: source.comparisonSchema.file, sha256: source.comparisonSchema.sha256,
      } } : {}),
    },
    consumer: {
      packages: installed.packages,
      lock: installed.lock,
      runtimeInventorySha256: sha(JSON.stringify(runtime)),
    },
    options: {
      scale: options.scale,
      date: options.date,
      only: only ?? null,
      fontRoute: {
        pack: "office",
        substitutionPolicy: "visual",
        scripts: "auto",
        source: "Unmodified shipping CLI/engine default; no --fonts, loader, custom pack or fallback stub",
      },
    },
    scope: {
      availableCorpus: 844,
      publishedSubset: 550,
      missingBefore: recovered.record.corpus.missing,
      pilotCandidates: recovered.record.pilot.sourceCandidates,
      oldProducer: null,
      publishedBatchRoster: null,
      renderedDecks: prepared.length,
    },
    decks: [],
  };
  save(out, "authority.json", encode(authority));
  save(out, "installed-runtime.json", encode(runtime));
  const route = blob(repo, authority.commit, "packages/javascript/src/node/fonts.ts");
  assert.match(route.toString(), /pack: "office"/);
  assert.match(route.toString(), /substitutionPolicy: "visual"/);
  assert.match(route.toString(), /scripts: "auto"/);
  save(out, "shipping-font-route.ts", route);
  receipt.options.fontRoute.sourceSha256 = sha(route);
  fs.writeFileSync(path.join(out, "receipt.json"), encode(receipt));
  let sheetFonts, render, fontsModule;
  try {
    if (mode === "render") {
      render = await import(pathToFileURL(installed.resolve("@openpresentation/opf-render")).href);
      fontsModule = await import(pathToFileURL(installed.resolve("@openpresentation/opf-render/fonts-node")).href);
    }
    for (const row of prepared) {
      const dir = path.join(out, "decks", row.id);
      fs.mkdirSync(path.join(dir, "after"), { recursive: true });
      const rawFile = save(dir, "original.opf.json", row.raw),
        input = save(dir, "current-gallery.opf.json", row.current.bytes);
      const entry = {
        id: row.id,
        sourceCommit: row.sourceCommit ?? null,
        oldProducer: row.pilotProducerStatus ?? null,
        publishedBatch: row.publishedBatch,
        original: fact(rawFile),
        current: fact(input),
        authoredSlidesSha256: row.current.authoredSlidesSha256,
        removedHistoricalSnapshots: row.current.removed,
        ...(row.current.projection ? { comparisonInputProjection: row.current.projection } : {}),
        slides: row.slides.map((s) => ({
          ordinal: s.ordinal,
          id: s.id,
          neutral: s.neutral ?? s.id,
          before: s.before ? { asset: s.before, sha256: sha(recovered.assets.get(s.before)) } : null,
          claude: s.claude ? { asset: s.claude, sha256: sha(recovered.assets.get(s.claude)) } : null,
        })),
        complete: false,
      };
      receipt.decks.push(entry);
      const invocation = cliInvocation(installed.cli, input, path.join(dir, "after"), options);
      entry.invocation = invocation;
      if (mode === "plan") {
        entry.planValidated = true;
        continue;
      }
      const { result, report } = captureCliAttempt(dir, invocation, installed.consumer, execute);
      entry.outputs = validateCliOutput(result, report, path.join(dir, "after"), row.slides.length);
      entry.fonts = report.fonts;
      entry.findings = report.findings;
      const reviewRows = [];
      for (const [i, s] of row.slides.entries()) {
        const fixed = {};
        for (const role of ["before", "claude"])
          if (s[role]) {
            const b = recovered.assets.get(s[role]);
            save(dir, `fixed/${role}-${s.id}.png`, b);
            fixed[role] = b;
          }
        reviewRows.push({
          ...fixed,
          after: fs.readFileSync(path.join(dir, "after", entry.outputs[i].file)),
          label: `${s.ordinal}. ${s.id}`,
        });
      }
      sheetFonts ??= await fontsModule.loadFonts({
        pack: "office",
        substitutionPolicy: "visual",
        scripts: "auto",
        presentation: { slides: [{ title: "Before After Claude" }] },
      });
      entry.sheets = [];
      for (let i = 0; i < reviewRows.length; i += 4) {
        const svg = sheetSvg(reviewRows.slice(i, i + 4));
        const name = `sheets/review-${String(i / 4 + 1).padStart(2, "0")}`;
        save(dir, name + ".svg", svg);
        const png = await render.toPng(svg, { fonts: sheetFonts, scale: 1 });
        const file = save(dir, name + ".png", png);
        entry.sheets.push({ file: name + ".png", ...fact(file) });
      }
      entry.complete = true;
      receipt.renderedSlides += row.slides.length;
      fs.writeFileSync(path.join(out, "receipt.json"), encode(receipt));
    }
    assert.deepEqual(installedInventory(installed.modules), runtime, "Consumer runtime mutated during refresh");
    receipt.complete = true;
  } catch (error) {
    receipt.failure = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, "receipt.json"), encode(receipt));
  }
  return receipt;
}
export function parseOptions(args) {
  const options = { scale: 0.5, mode: "plan" },
    seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    assert.ok(
      ["out", "repo", "recovery", "consumer", "authority", "scale", "date", "only", "mode"].includes(key) &&
        args[i].startsWith("--") &&
        args[i + 1],
      "Unknown/missing option",
    );
    assert.ok(!seen.has(key), "Duplicate option");
    seen.add(key);
    options[key] = key === "scale" ? Number(args[i + 1]) : args[i + 1];
  }
  for (const key of ["out", "repo", "recovery", "consumer", "authority"])
    if (options[key]) options[key] = path.resolve(options[key]);
  return options;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run(parseOptions(process.argv.slice(2)))
    .then((r) =>
      console.log(
        JSON.stringify({
          mode: r.mode,
          complete: r.complete,
          renderedSlides: r.renderedSlides,
          decks: r.decks.length,
          release: r.release,
        }),
      ),
    )
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
