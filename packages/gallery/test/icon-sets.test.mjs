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
import { GALLERY_ICON_SETS, galleryIconSets } from "../dist/icon-sets.js";

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
  for (const file of ["icon-sets.js", "icon-set-ids.js", "icon-files.js", "icon-files-node.js"]) assert.ok(read(`dist/${file}`).length < 6_000, `dist/${file} holds no icon data`);
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
    const set = await sets.iconSets[id]({ icons: Object.keys(record.icons) });
    assert.deepEqual(set.icons, record.icons, `${id}: one file per icon gives back every icon`);
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
