// CR 7: core never makes a document id, so `opf create` does (every new deck is a new deck), and `opf fill` gives each filled deck its own.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, "../dist/index.js");
const run = (args) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8" });
const temp = await mkdtemp(path.join(tmpdir(), "opf-id-"));
after(() => rm(temp, { recursive: true, force: true }));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

describe("opf create mints the document id", () => {
  test("a starter deck gets a UUID, a different one each time, in every form", async () => {
    const one = path.join(temp, "one.opf.json"), two = path.join(temp, "two.opf.json");
    assert.equal(run(["create", one]).status, 0);
    assert.equal(run(["create", two]).status, 0);
    const [a, b] = [await readJson(one), await readJson(two)];
    assert.match(a.id, UUID_PATTERN);
    assert.match(b.id, UUID_PATTERN);
    assert.notEqual(a.id, b.id);
    assert.deepEqual(Object.keys(a).slice(0, 2), ["$schema", "id"], "the id follows $schema");
    const md = run(["create", "-", "--to", "md"]).stdout;
    assert.match(md, /^---\n(?:.*\n)*?id: [0-9a-f-]{36}\n/);
    assert.match(run(["create", "-", "--to", "yaml"]).stdout, /^id: [0-9a-f-]{36}$/m);
  });

  test("a bundled example copied by --example is a new deck: its own id, never the example's", async () => {
    const { examples, getExample } = await import("@openpresentation/opf/examples");
    for (const slug of examples.slice(0, 3).map((item) => item.slug)) {
      const file = path.join(temp, `${slug}.opf.json`);
      assert.equal(run(["create", file, "--example", slug]).status, 0, slug);
      const made = await readJson(file);
      assert.match(made.id, UUID_PATTERN, slug);
      assert.notEqual(made.id, getExample(slug).deck.id);
    }
  });
});

describe("opf fill gives each filled deck its own id", () => {
  const template = (extra) => JSON.stringify({ $schema: "https://openpresentation.org/schema/opf/v1", ...extra, name: "Review for {{client}}", variables: { client: { type: "text", example: "Acme" } }, slides: [{ id: "cover", title: "{{client}}" }] });

  test("a template with an id: every deck is a new deck with a new id, the template's is gone", async () => {
    const source = path.join(temp, "template.opf.json"), data = path.join(temp, "clients.csv");
    await writeFile(source, template({ id: "template-id" }));
    await writeFile(data, "client\nNorthwind\nContoso\n");
    assert.equal(run(["fill", source, data, path.join(temp, "deck-{n}.opf.json")]).status, 0);
    const [a, b] = [await readJson(path.join(temp, "deck-1.opf.json")), await readJson(path.join(temp, "deck-2.opf.json"))];
    assert.match(a.id, UUID_PATTERN);
    assert.match(b.id, UUID_PATTERN);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.id, "template-id");
    assert.equal(a.name, "Review for Northwind");
    const combined = path.join(temp, "combined.opf.json");
    assert.equal(run(["fill", source, data, combined, "--combine"]).status, 0);
    assert.match((await readJson(combined)).id, UUID_PATTERN);
  });

  test("a template without an id gives decks without one", async () => {
    const source = path.join(temp, "plain.opf.json"), out = path.join(temp, "plain-out.opf.json");
    await writeFile(source, template({}));
    const data = path.join(temp, "one-client.json");
    await writeFile(data, JSON.stringify({ client: "Northwind" }));
    assert.equal(run(["fill", source, data, out]).status, 0);
    assert.equal(Object.hasOwn(await readJson(out), "id"), false);
  });
});
