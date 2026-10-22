// The offline checks of scripts/sync-gallery-catalog.mjs: --verify (the records match their hashes) and --rehash. MR-23 removed the 1.x
// sync from a pptx.gallery checkout with its tests (plan section 2, "Gallery bootstrap").
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalJson, catalogContentSha256, readJson, verifySnapshot } from "../scripts/catalog-snapshot.mjs";
import { rehashSnapshot } from "../scripts/sync-gallery-catalog.mjs";

const catalogsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "catalog");

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

describe("hand edits", () => {
  let workdir;
  before(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), "opf-catalog-hand-"));
    await cp(catalogsRoot, workdir, { recursive: true });
  });
  after(async () => {
    await rm(workdir, { recursive: true, force: true });
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

  test("a record edit is rehashed, leaving the gallery pin untouched (and failing verify until the gallery publishes it)", async () => {
    assert.deepEqual(await rehashSnapshot(workdir), []);
    const before = await readJson(path.join(workdir, "manifest.json"));
    const file = path.join(workdir, "audiences", "board.json");
    const record = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, `${JSON.stringify({ ...record, summary: "Edited in core first." }, null, 2)}\n`);
    assert.notDeepEqual(await verifySnapshot(workdir), []);
    assert.deepEqual((await rehashSnapshot(workdir)).sort(), ["audiences/index.json", "manifest.json (audiences)"]);
    // Every kind mirrors the gallery, so the edit stays inconsistent with the pin until --match-gallery (or a sync).
    assert.deepEqual(await verifySnapshot(workdir), ["manifest.json kinds.audiences: a mirrored kind must match the gallery hash"]);
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
