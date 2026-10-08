import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SNAPSHOT_KINDS,
  canonicalJson,
  catalogContentSha256,
  readJson,
  verifySnapshot,
} from "./catalog-snapshot.mjs";
import { applySnapshot, diffSnapshot, loadValidators, main, parseIncludes, planSnapshot, readCurrentSnapshot, rehashSnapshot } from "./sync-gallery-catalog.mjs";

const catalogsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "spec", "catalogs");
const source = { repository: "https://github.com/Data-Advantage/pptx-gallery", commit: "0".repeat(40), path: "public" };

let snapshot;
let validators;

before(async () => {
  snapshot = await readCurrentSnapshot(catalogsRoot);
  validators = await loadValidators();
});

// A published gallery catalog equal to the current snapshot, with the
// publisher's `x-gallery` members added.
function publishedFromSnapshot() {
  const gallery = {};
  for (const { kind } of SNAPSHOT_KINDS) {
    const { index, records } = structuredClone(snapshot.current[kind]);
    const published = records.map((record) => ({ ...record, "x-gallery": { page: `https://www.pptx.gallery/${kind}/${record.id}` } }));
    gallery[kind] = { index: { ...index, "x-gallery": { status: "reconciled" } }, records: published };
  }
  return gallery;
}

function addRecord(gallery, kind, record, entry) {
  gallery[kind].records.push(record);
  gallery[kind].index.records.push(entry);
  gallery[kind].index.contentSha256 = catalogContentSha256(gallery[kind].records);
}

describe("canonical content hash", () => {
  test("sorts keys, drops whitespace, and ignores x-* members", () => {
    assert.equal(canonicalJson({ b: [2, { d: 1, c: 0 }], a: "x" }), '{"a":"x","b":[2,{"c":0,"d":1}]}');
    assert.equal(
      catalogContentSha256([{ id: "a", name: "A" }]),
      catalogContentSha256([{ name: "A", id: "a", "x-gallery": { page: "p" } }]),
    );
    assert.notEqual(catalogContentSha256([{ id: "a" }, { id: "b" }]), catalogContentSha256([{ id: "b" }, { id: "a" }]));
  });

  test("the bundled snapshot matches its manifest", async () => {
    assert.deepEqual(await verifySnapshot(catalogsRoot), []);
  });
});

describe("planSnapshot", () => {
  test("an unchanged gallery reproduces the current snapshot without publisher members", async () => {
    const plan = planSnapshot({ gallery: publishedFromSnapshot(), current: snapshot.current, manifest: snapshot.manifest, validators, source });
    assert.deepEqual(plan.problems, []);
    for (const { kind } of SNAPSHOT_KINDS) {
      assert.equal(plan.kinds[kind].records.length, snapshot.current[kind].records.length, kind);
      assert.ok(plan.kinds[kind].records.every((record) => !("x-gallery" in record)), kind);
      assert.ok(!("x-gallery" in plan.kinds[kind].index), kind);
    }
    const changes = (await diffSnapshot(catalogsRoot, plan)).filter((file) => file !== "manifest.json");
    assert.deepEqual(changes, []);
  });

  test("mirror kinds take new gallery records; subset kinds keep their ids", () => {
    const gallery = publishedFromSnapshot();
    const tone = { $schema: "https://openpresentation.org/schema/opf-tone/v1", id: "playful", name: "Playful", "x-gallery": {} };
    addRecord(gallery, "tones", tone, { id: "playful", name: "Playful", file: "playful.json" });
    const audience = { $schema: "https://openpresentation.org/schema/opf-audience/v1", id: "students", name: "Students" };
    addRecord(gallery, "audiences", audience, { id: "students", name: "Students", file: "students.json" });

    const manifest = structuredClone(snapshot.manifest);
    manifest.kinds.tones.mode = "mirror";
    manifest.kinds.audiences.mode = "subset";
    const plan = planSnapshot({ gallery, current: snapshot.current, manifest, validators, source });
    assert.deepEqual(plan.problems, []);
    assert.deepEqual(plan.kinds.tones.records.at(-1), { $schema: tone.$schema, id: "playful", name: "Playful" });
    assert.equal(plan.kinds.audiences.records.length, snapshot.current.audiences.records.length);
    assert.deepEqual(plan.kinds.audiences.galleryOnly, ["students"]);
    assert.equal(plan.manifest.kinds.audiences.gallery.records, snapshot.current.audiences.records.length + 1);
    assert.equal(plan.kinds.tones.index.contentSha256, catalogContentSha256(plan.kinds.tones.records));
  });

  test("--include adds published ids to a subset kind once, and only ids the gallery publishes", () => {
    const gallery = publishedFromSnapshot();
    const layout = { $schema: "https://openpresentation.org/schema/opf-layout/v1", id: "included-layout", name: "Included", placeholders: [{ type: "title" }], "x-gallery": {} };
    const other = { $schema: "https://openpresentation.org/schema/opf-layout/v1", id: "excluded-layout", name: "Excluded", placeholders: [{ type: "title" }] };
    addRecord(gallery, "layouts", layout, { id: "included-layout", name: "Included", file: "included-layout.json" });
    addRecord(gallery, "layouts", other, { id: "excluded-layout", name: "Excluded", file: "excluded-layout.json" });
    const manifest = structuredClone(snapshot.manifest);
    manifest.kinds.layouts.mode = "subset";

    const plan = planSnapshot({ gallery, current: snapshot.current, manifest, validators, source, include: { layouts: ["included-layout"] } });
    assert.deepEqual(plan.problems, []);
    assert.equal(plan.kinds.layouts.records.length, snapshot.current.layouts.records.length + 1);
    assert.ok(plan.kinds.layouts.records.some((record) => record.id === "included-layout" && !("x-gallery" in record)));
    assert.deepEqual(plan.kinds.layouts.galleryOnly, ["excluded-layout"]);

    // The included id is in the snapshot afterwards, so the next plan keeps it without the flag.
    const after = { ...snapshot.current, layouts: { index: plan.kinds.layouts.index, records: plan.kinds.layouts.records } };
    const again = planSnapshot({ gallery, current: after, manifest, validators, source });
    assert.equal(again.kinds.layouts.records.length, plan.kinds.layouts.records.length);

    const missing = planSnapshot({ gallery, current: snapshot.current, manifest, validators, source, include: { layouts: ["not-published"] } });
    assert.ok(missing.problems.some((problem) => /layouts: --include 'not-published' is not published/.test(problem)), missing.problems.join("\n"));
  });

  test("parseIncludes reads repeatable kind:ids pairs and rejects malformed ones", () => {
    assert.deepEqual(parseIncludes(["--gallery", "g", "--include", "layouts:a,b", "--include", "layouts:c", "--include", "tones:d"]), { layouts: ["a", "b", "c"], tones: ["d"] });
    assert.deepEqual(parseIncludes(["--gallery", "g"]), {});
    for (const bad of ["layouts", "layouts:", ":a", "unknown-kind:a"]) assert.throws(() => parseIncludes(["--include", bad]), /--include needs/, bad);
    assert.throws(() => parseIncludes(["--include"]), /--include needs/);
  });

  test("refuses a gallery that dropped a bundled id, forged a hash, or published an invalid record", () => {
    const gallery = publishedFromSnapshot();
    gallery.tones.records.shift();
    gallery.tones.index.records.shift();
    gallery.tones.index.contentSha256 = catalogContentSha256(gallery.tones.records);
    gallery.themes.index.contentSha256 = "0".repeat(64);
    gallery.purposes.records[0] = { ...gallery.purposes.records[0], name: 42 };
    gallery.purposes.index.contentSha256 = catalogContentSha256(gallery.purposes.records);

    const { problems } = planSnapshot({ gallery, current: snapshot.current, manifest: snapshot.manifest, validators, source });
    assert.ok(problems.some((problem) => /tones: the gallery no longer publishes/.test(problem)), problems.join("\n"));
    assert.ok(problems.some((problem) => /themes\/index\.json: published contentSha256/.test(problem)), problems.join("\n"));
    assert.ok(problems.some((problem) => /purposes\/.*\.json: \/name must be string/.test(problem)), problems.join("\n"));
  });

  test("refuses a gallery copy of a bundled subset record that differs in any field, name included (RR-58)", () => {
    const gallery = publishedFromSnapshot();
    const at = gallery.layouts.records.findIndex((record) => record.id === "chart-1x");
    gallery.layouts.records[at] = { ...gallery.layouts.records[at], name: "Chart_1x" };
    const focus = gallery.layouts.records.findIndex((record) => record.id === "image-focus");
    const { design, ...withoutDesign } = gallery.layouts.records[focus];
    assert.ok(design, "image-focus carries its own design");
    gallery.layouts.records[focus] = withoutDesign;
    gallery.layouts.index.contentSha256 = catalogContentSha256(gallery.layouts.records);
    const manifest = structuredClone(snapshot.manifest);
    manifest.kinds.layouts.mode = "subset";

    const { problems } = planSnapshot({ gallery, current: snapshot.current, manifest, validators, source });
    const owned = problems.filter((problem) => /core owns this bundled record/.test(problem));
    assert.equal(owned.length, 2, problems.join("\n"));
    assert.ok(owned.some((problem) => problem.startsWith("layouts/chart-1x.json:") && /\(name\)/.test(problem)), owned.join("\n"));
    assert.ok(owned.some((problem) => problem.startsWith("layouts/image-focus.json:") && /\(design\)/.test(problem)), owned.join("\n"));
  });
});

describe("--allow-removed waiver", () => {
  const dropped = (gallery, kind, id) => {
    const at = gallery[kind].index.records.findIndex((entry) => entry.id === id);
    gallery[kind].records.splice(at, 1);
    gallery[kind].index.records.splice(at, 1);
    gallery[kind].index.contentSha256 = catalogContentSha256(gallery[kind].records);
  };

  test("lets exactly the listed ids disappear and still refuses any other lost id", () => {
    const gallery = publishedFromSnapshot();
    dropped(gallery, "chart-types", "pie");
    dropped(gallery, "chart-types", "funnel");
    const refused = planSnapshot({ gallery, current: snapshot.current, manifest: snapshot.manifest, validators, source, allowRemoved: { "chart-types": ["pie"] } });
    assert.equal(refused.problems.filter((problem) => /no longer publishes/.test(problem)).length, 1, refused.problems.join(String.fromCharCode(10)));
    assert.ok(refused.problems.some((problem) => /chart-types: the gallery no longer publishes 'funnel'/.test(problem)));

    const plan = planSnapshot({ gallery, current: snapshot.current, manifest: snapshot.manifest, validators, source, allowRemoved: { "chart-types": ["pie", "funnel"] } });
    assert.deepEqual(plan.problems, []);
    assert.deepEqual(plan.kinds["chart-types"].removed.sort(), ["funnel", "pie"]);
    assert.equal(plan.kinds["chart-types"].records.some((record) => record.id === "pie"), false);
    assert.equal(plan.kinds["chart-types"].manifestEntry.records, snapshot.current["chart-types"].records.length - 2);
  });

  test("drops an id the gallery still publishes and rejects an id the snapshot does not hold", () => {
    const gallery = publishedFromSnapshot();
    const plan = planSnapshot({ gallery, current: snapshot.current, manifest: snapshot.manifest, validators, source, allowRemoved: { "chart-types": ["pie", "no-such-id"] } });
    assert.ok(plan.problems.some((problem) => /--allow-removed 'no-such-id' is not in the snapshot/.test(problem)), plan.problems.join(String.fromCharCode(10)));
    assert.deepEqual(plan.kinds["chart-types"].removed, ["pie"]);
    assert.equal(plan.kinds["chart-types"].records.some((record) => record.id === "pie"), false);
  });

  test("parseIncludes reads the same shape for --allow-removed", () => {
    assert.deepEqual(parseIncludes(["--allow-removed", "chart-types:a,b", "--include", "layouts:c"], "--allow-removed"), { "chart-types": ["a", "b"] });
    assert.throws(() => parseIncludes(["--allow-removed", "chart-types"], "--allow-removed"), /--allow-removed needs/);
  });
});

describe("applySnapshot", () => {
  let workdir;
  before(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), "opf-catalog-sync-"));
    await cp(catalogsRoot, workdir, { recursive: true });
  });
  after(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  test("writes only changed files and leaves a snapshot that verifies", async () => {
    const gallery = publishedFromSnapshot();
    addRecord(
      gallery,
      "tones",
      { $schema: "https://openpresentation.org/schema/opf-tone/v1", id: "playful", name: "Playful" },
      { id: "playful", name: "Playful", file: "playful.json" },
    );
    const current = await readCurrentSnapshot(workdir);
    const plan = planSnapshot({ gallery, current: current.current, manifest: current.manifest, validators, source });
    const changes = await applySnapshot(workdir, plan);
    assert.deepEqual(changes.sort(), ["manifest.json", "tones/index.json", "tones/playful.json"]);
    assert.deepEqual(await verifySnapshot(workdir), []);
    assert.equal((await readJson(path.join(workdir, "manifest.json"))).kinds.tones.records, current.current.tones.records.length + 1);
  });

  test("a hand edit is caught by the offline verification", async () => {
    const file = path.join(workdir, "tones", "formal.json");
    const record = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...record, summary: "Edited by hand." }));
    const problems = await verifySnapshot(workdir);
    assert.ok(problems.some((problem) => problem.startsWith("tones/index.json: contentSha256")), problems.join("\n"));
  });
});

describe("rehashSnapshot (core-first edits)", () => {
  let workdir;
  before(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), "opf-catalog-rehash-"));
    await cp(catalogsRoot, workdir, { recursive: true });
  });
  after(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  test("a core-first record edit is rehashed, leaving the gallery pin untouched", async () => {
    assert.deepEqual(await rehashSnapshot(workdir), []);
    const before = await readJson(path.join(workdir, "manifest.json"));
    const file = path.join(workdir, "audiences", "board.json");
    const record = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, `${JSON.stringify({ ...record, summary: "Edited in core first." }, null, 2)}\n`);
    assert.notDeepEqual(await verifySnapshot(workdir), []);
    assert.deepEqual((await rehashSnapshot(workdir)).sort(), ["audiences/index.json", "manifest.json (audiences)"]);
    assert.deepEqual(await verifySnapshot(workdir), []);
    const after = await readJson(path.join(workdir, "manifest.json"));
    assert.notEqual(after.kinds.audiences.contentSha256, before.kinds.audiences.contentSha256);
    assert.deepEqual(after.kinds.audiences.gallery, before.kinds.audiences.gallery);
    assert.deepEqual(after.source, before.source);
  });

  test("a mirrored kind still has to match the gallery hash", async () => {
    const file = path.join(workdir, "tones", "formal.json");
    const record = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, `${JSON.stringify({ ...record, summary: "Edited in core first." }, null, 2)}\n`);
    await rehashSnapshot(workdir);
    const problems = await verifySnapshot(workdir);
    assert.ok(problems.some((problem) => problem.includes("a mirrored kind must match the gallery hash")), problems.join("\n"));
  });
});

describe("rehashSnapshot --match-gallery", () => {
  test("sets the gallery block of a mirrored kind to the rehashed records", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "opf-catalog-match-"));
    try {
      await cp(catalogsRoot, dir, { recursive: true });
      const file = path.join(dir, "tones", "formal.json");
      const record = JSON.parse(await readFile(file, "utf8"));
      await writeFile(file, `${JSON.stringify({ ...record, summary: "Edited in core first." }, null, 2)}
`);
      const changed = await rehashSnapshot(dir, { matchGallery: true });
      assert.deepEqual(changed.sort(), ["manifest.json (tones)", "tones/index.json"]);
      assert.deepEqual(await verifySnapshot(dir), []);
      const manifest = await readJson(path.join(dir, "manifest.json"));
      assert.equal(manifest.kinds.tones.gallery.contentSha256, manifest.kinds.tones.contentSha256);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("snapshot source provenance", () => {
  let workdir;
  let galleryDir;
  let target;
  let commit;
  const git = (...args) => execFileSync("git", ["-C", galleryDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  before(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), "opf-catalog-provenance-"));
    galleryDir = path.join(workdir, "gallery");
    target = path.join(workdir, "snapshot");
    await cp(catalogsRoot, path.join(galleryDir, "public"), { recursive: true });
    await cp(catalogsRoot, target, { recursive: true });
    git("init");
    git("add", "public");
    git("-c", "user.name=Catalog test", "-c", "user.email=catalog@example.invalid", "commit", "-m", "Catalog fixture");
    commit = git("rev-parse", "HEAD");
  });
  after(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  test("a clean checkout writes a snapshot pinned to its actual commit", async () => {
    await main(["--gallery", galleryDir, "--catalogs", target]);
    assert.equal((await readJson(path.join(target, "manifest.json"))).source.commit, commit);
    assert.deepEqual(await verifySnapshot(target), []);
  });

  test("dirty catalog bytes cannot be written under a clean commit, even with --allow-dirty", async () => {
    const formal = path.join(galleryDir, "public", "tones", "formal.json");
    await writeFile(formal, serializeForTest({ ...(await readJson(formal)), name: "Uncommitted name" }));
    const indexPath = path.join(galleryDir, "public", "tones", "index.json");
    const index = await readJson(indexPath);
    index.contentSha256 = catalogContentSha256(await Promise.all(index.records.map((entry) => readJson(path.join(galleryDir, "public", "tones", entry.file)))));
    await writeFile(indexPath, serializeForTest(index));

    const before = await readCurrentSnapshot(target);
    await assert.rejects(main(["--gallery", galleryDir, "--catalogs", target]), /uncommitted catalog changes/);
    await assert.rejects(main(["--gallery", galleryDir, "--catalogs", target, "--allow-dirty"]), /--allow-dirty requires --check or --report/);
    assert.deepEqual(await readCurrentSnapshot(target), before);
    // The changed input remains inspectable without giving it false provenance.
    await main(["--gallery", galleryDir, "--catalogs", target, "--allow-dirty", "--report"]);
    await assert.rejects(main(["--gallery", galleryDir, "--catalogs", target, "--check"]), /does not match the gallery catalog/);
    assert.deepEqual(await readCurrentSnapshot(target), before);
  });

  test("a live response can be compared but cannot reuse an unrelated source pin for a write", async () => {
    const before = await readCurrentSnapshot(target);
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = async (url) => {
      requests += 1;
      return { ok: true, json: () => readJson(path.join(galleryDir, "public", new URL(url).pathname)) };
    };
    try {
      await assert.rejects(main(["--url", "https://catalog.example.invalid", "--catalogs", target]), /live response cannot prove a source commit/);
      assert.equal(requests, 0, "reject unsafe writes before any remote reads");
      await main(["--url", "https://catalog.example.invalid", "--catalogs", target, "--report"]);
      assert.ok(requests > 0);
      await assert.rejects(main(["--url", "https://catalog.example.invalid", "--catalogs", target, "--check"]), /does not match the gallery catalog/);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(await readCurrentSnapshot(target), before);
  });
});

function serializeForTest(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
