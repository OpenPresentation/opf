// LH-14: the icon sets. The records are what scripts/build-icon-sets.mjs writes from the pinned npm packages (never edited by hand),
// each carries its license and copyright (as THIRD-PARTY-NOTICES.md does), the catalog reads an icon only when asked, and every icon's
// path data reads in core.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { iconPathCommands } from "@openpresentation/opf/composition";
import { buildIconSets } from "../scripts/build-icon-sets.mjs";
import { catalogIndexes, gallery } from "../dist/index.js";
import { GALLERY_ICON_SETS, WHOLE_SET_BATCH, galleryIconSets } from "../dist/icon-sets.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("the icon-set records are what the pinned packages give", async () => {
  const files = await buildIconSets();
  for (const [name, text] of Object.entries(files)) {
    const file = name === "THIRD-PARTY-NOTICES.md" ? name : `catalog/icon-sets/${name}`;
    const strip = (value) => (name === "index.json" ? value.replace(/"contentSha256": "[0-9a-f]{64}"/, "") : value);
    assert.equal(strip(read(file)), strip(text), `${file} is stale: run node scripts/build-icon-sets.mjs and npm run rehash`);
  }
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.devDependencies["lucide-static"], "1.70.0");
  assert.equal(pkg.devDependencies["@tabler/icons"], "3.50.0");
  assert.ok(pkg.files.includes("THIRD-PARTY-NOTICES.md"));
});

test("each set records its license and copyright, and the notices carry the full license texts", () => {
  const notices = read("THIRD-PARTY-NOTICES.md");
  for (const [id, license] of [["lucide", "ISC"], ["tabler", "MIT"]]) {
    const record = JSON.parse(read(`catalog/icon-sets/${id}.json`));
    assert.equal(record.license, license);
    assert.match(record.copyright, /^Copyright \(c\)/);
    assert.ok(record.licenseText.includes(license === "ISC" ? "ISC License" : "MIT License"));
    assert.ok(notices.includes(record.licenseText), `${id}: license text in the notices`);
    assert.deepEqual(record.viewBox, [0, 0, 24, 24]);
    assert.ok(Object.keys(record.icons).length > (id === "lucide" ? 1900 : 5000));
  }
});

test("the catalog carries no icon data: the icon sets are an entry of their own, code only, over static files, and every icon's path data reads", async () => {
  assert.equal(gallery.iconSets, undefined, "the catalog names no icon set: a host that does not register galleryIconSets carries none");
  assert.ok(!read("dist/index.js").includes("import("), "the catalog module imports nothing");
  assert.ok(read("dist/index.js").length < 400_000, "the catalog module stays small");
  // RR-63: the icon-set entry is code only; the data is dist/icons/, one file per icon, read through load.
  // (12 KB: the loader with its whole-set fallback and fetchIcons; one icon set is 0.3 to 0.8 MB of path data.)
  for (const file of ["icon-sets.js", "icon-set-ids.js", "icon-files.js", "icon-files-node.js"]) assert.ok(read(`dist/${file}`).length < 12_000, `dist/${file} holds no icon data`);
  const sets = galleryIconSets();
  assert.equal(sets.source, gallery.source);
  assert.deepEqual(Object.keys(sets.iconSets), ["lucide", "tabler"]);
  assert.deepEqual(GALLERY_ICON_SETS, ["lucide", "tabler"]);
  assert.ok(Object.values(sets.iconSets).every((loader) => typeof loader === "function"));
  assert.deepEqual(catalogIndexes.iconSets.records.map((entry) => entry.id), ["lucide", "tabler"]);
  for (const id of Object.keys(sets.iconSets)) {
    const record = JSON.parse(read(`catalog/icon-sets/${id}.json`));
    const index = JSON.parse(read(`dist/icons/${id}.json`));
    // The index is the record without its icons and keywords, with every name; the license travels with it.
    const { $schema: _schema, id: _id, icons: _icons, tags: _tags, ...meta } = record;
    assert.deepEqual(index, { ...meta, names: Object.keys(record.icons) });
    assert.deepEqual(JSON.parse(read(`dist/icons/${id}.tags.json`)), record.tags);
    // The whole set is the index with every icon (no keywords).
    assert.deepEqual(JSON.parse(read(`dist/icons/${id}.icons.json`)), { ...meta, names: Object.keys(record.icons), icons: record.icons });
    // Batches small enough to read one file per icon, so every per-icon file is read and checked.
    const names = Object.keys(record.icons), icons = {};
    for (let at = 0; at < names.length; at += WHOLE_SET_BATCH) Object.assign(icons, (await sets.iconSets[id]({ icons: names.slice(at, at + WHOLE_SET_BATCH) })).icons);
    const set = { icons };
    assert.deepEqual(set.icons, record.icons, `${id}: one file per icon gives back every icon`);
    assert.deepEqual((await galleryIconSets().iconSets[id]({ icons: names })).icons, record.icons, `${id}: a batch of every icon reads the whole set`);
    let parts = 0;
    for (const [name, icon] of Object.entries(set.icons)) {
      for (const d of typeof icon === "string" ? [icon] : Object.values(icon)) {
        const commands = iconPathCommands(d);
        assert.ok(commands.length > 1 && commands[0][0] === "M", `${id}:${name}`);
        parts++;
      }
    }
    assert.ok(parts >= Object.keys(set.icons).length);
  }
  assert.throws(() => galleryIconSets("nope"), TypeError);
});

test("RR-63: one unreadable icon file costs that icon only, with its reason; the whole set stands in for a missing one", async () => {
  const files = (skip) => async (file) => {
    if (skip(file)) throw new Error(`${file} answered 404.`);
    return JSON.parse(read(`dist/icons/${file}`));
  };
  // The per-icon file of rocket and the whole set are missing: truck loads, rocket says why.
  const partial = await galleryIconSets(files((file) => file === "tabler/rocket.json" || file === "tabler.icons.json")).iconSets.tabler({ icons: ["rocket", "truck"] });
  assert.deepEqual(Object.keys(partial.icons), ["truck"]);
  assert.deepEqual(partial.errors, { rocket: "tabler/rocket.json answered 404. (and tabler.icons.json answered 404.)" });
  // Only the per-icon file is missing: the whole set gives it.
  const fallback = await galleryIconSets(files((file) => file === "tabler/rocket.json")).iconSets.tabler({ icons: ["rocket", "truck"] });
  assert.deepEqual(Object.keys(fallback.icons).sort(), ["rocket", "truck"]);
  assert.equal(fallback.errors, undefined);
});

test("RR-63: an icon name that cannot be a file on every OS fails the build", async () => {
  const { iconSetFiles } = await import("../scripts/build.mjs");
  const record = { name: "x", license: "MIT", copyright: "c", viewBox: [0, 0, 24, 24], style: "stroke" };
  assert.ok(iconSetFiles("lucide", { ...record, icons: { truck: "M0 0L1 1" } })["lucide/truck.json"]);
  for (const name of ["con", "nul", "com1", "LPT9", "a.b", "Truck"]) assert.throws(() => iconSetFiles("lucide", { ...record, icons: { [name]: "M0 0L1 1" } }), /cannot be a file name on every OS/, name);
});
