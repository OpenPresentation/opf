import assert from "node:assert/strict";
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
import { applySnapshot, diffSnapshot, loadValidators, planSnapshot, readCurrentSnapshot } from "./sync-gallery-catalog.mjs";

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
