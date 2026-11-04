// LH-14: the icon sets. The records are what scripts/build-icon-sets.mjs writes from the pinned npm packages (never edited by hand),
// each carries its license and copyright (as THIRD-PARTY-NOTICES.md does), the catalog loads a set only when asked, and every icon's
// path data reads in core.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { iconPathCommands } from "@openpresentation/opf/composition";
import { buildIconSets } from "../scripts/build-icon-sets.mjs";
import { catalogIndexes, gallery } from "../dist/index.js";

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
  assert.equal(pkg.devDependencies["lucide-static"], "1.68.0");
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

test("the catalog carries no icon data: each set loads on demand, and every icon's path data reads", async () => {
  assert.deepEqual(Object.keys(gallery.iconSets), ["lucide", "tabler"]);
  assert.ok(Object.values(gallery.iconSets).every((loader) => typeof loader === "function"));
  assert.ok(read("dist/index.js").length < 400_000, "the catalog module stays small");
  assert.deepEqual(catalogIndexes.iconSets.records.map((entry) => entry.id), ["lucide", "tabler"]);
  for (const id of Object.keys(gallery.iconSets)) {
    const set = await gallery.iconSets[id]();
    assert.equal(set.$schema, undefined);
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
});
