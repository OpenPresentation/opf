// MR-35: the gallery's stability rule on the shared 0.x line (scripts/gallery-stability.mjs). The cases draw the published
// @openpresentation/gallery package (a root devDependency) against edited copies of itself, with the repository's opf-render, so
// no network is used: the registry calls are replaced and the CLI cases use `--baseline-dir`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as built from "@openpresentation/gallery";
import { DRAWING_KINDS, parseFragment } from "./changelog-fragments.mjs";
import { OTHER_KINDS, VISUAL_KINDS } from "./gallery-stability-fixtures.mjs";
import { compareReleases, declaredDrawing, formatResult, gateVersion, judge, loadEngines, main, minimumBump, resolveBaseline, satisfiesBump } from "./gallery-stability.mjs";

const SCRIPT = fileURLToPath(new URL("./gallery-stability.mjs", import.meta.url));
const scratch = mkdtempSync(path.join(tmpdir(), "opf-gallery-stability-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

let engines;
before(async () => {
  engines = await loadEngines();
});

const release = (version, edit = () => {}, catalogSchema = built.CATALOG_SCHEMA) => {
  const gallery = structuredClone(built.gallery);
  const catalogDisplay = structuredClone(built.catalogDisplay);
  edit(gallery, catalogDisplay);
  return { version, module: { gallery, catalogDisplay, CATALOG_SCHEMA: catalogSchema } };
};
const baseline = { version: "5.0.0", module: built };
const config = { default: "opf", targets: { opf: "CHANGELOG.md", gallery: "packages/gallery/CHANGELOG.md" }, codePaths: [] };
const fragment = (slug, front, body = "Changed records.") => parseFragment(`${slug}.md`, `---\ntype: changed\npackages: [gallery]\n${front}\n---\n${body}\n`, config);
const moveTwoColumn = (gallery) => {
  gallery.layouts["two-column"].regions[1].regions[0].size = 2;
};

test("the fixtures cover exactly the kinds a fragment may declare", () => {
  const compared = [...VISUAL_KINDS.map(({ kind }) => kind), ...OTHER_KINDS, ...Object.keys(built.catalogDisplay)];
  assert.deepEqual([...compared].sort(), [...DRAWING_KINDS].sort());
});

test("an unchanged candidate draws every existing record the same and needs only a patch", () => {
  const result = compareReleases(baseline, release("0.26.1"), engines);
  const verdict = judge(result, []);
  assert.equal(verdict.ok, true, formatResult(result, verdict, minimumBump({ stability: result })));
  assert.deepEqual(verdict.changes, []);
  assert.equal(result.schemaChanged, false);
  assert.equal(result.kinds.layouts.compared, Object.keys(built.gallery.layouts).length);
  assert.ok(result.renders > 200);
  assert.deepEqual(minimumBump({ fragments: [], stability: result }), { bump: "patch", reasons: [] });
});

test("an undeclared drawing change fails; declaring it passes and forces a minor train", () => {
  const result = compareReleases(baseline, release("0.26.1", moveTwoColumn), engines);
  assert.deepEqual(result.kinds.layouts.changed.map((change) => change.id), ["two-column"]);
  const undeclared = judge(result, []);
  assert.equal(undeclared.ok, false);
  assert.equal(undeclared.problems.length, 1);
  assert.match(undeclared.problems[0], /^layouts:two-column: slides? 1(, 2)? draws? differently \(\d+ pixels differ at 960 px wide\); declare it in a changes\/ fragment for the gallery \(drawing: \["layouts:two-column"\]\)/);
  // A fragment that declares another id does not help; one for a different package declares nothing.
  assert.equal(judge(result, [fragment("other", 'drawing: ["layouts:hero"]')]).ok, false);
  const declaredBy = fragment("mr-99-two-column", 'drawing: ["layouts:two-column"]');
  const declared = judge(result, [declaredBy]);
  assert.equal(declared.ok, true, declared.problems.join("\n"));
  assert.deepEqual(declared.stale, []);
  const bump = minimumBump({ fragments: [declaredBy], stability: result });
  assert.equal(bump.bump, "minor");
  assert.match(bump.reasons.join(), /declared drawing change: layouts:two-column/);
  assert.equal(minimumBump({ fragments: [declaredBy] }).bump, "minor", "the declaration alone is enough when the comparison did not run");
});

test("a changed region is caught on the filled slide and a collapse change on the empty one", () => {
  const region = (layout, name) => {
    const find = (list) => {
      for (const entry of list) {
        const found = entry.regions ? find(entry.regions) : entry.name === name ? entry : undefined;
        if (found) return found;
      }
    };
    return find(layout.regions);
  };
  const flow = compareReleases(baseline, release("0.26.1", (gallery) => { region(gallery.layouts.metrics, "metrics").flow = "column"; }), engines);
  assert.deepEqual(flow.kinds.layouts.changed.map((change) => [change.id, change.slides]), [["metrics", [1]]]);
  const keep = compareReleases(baseline, release("0.26.1", (gallery) => { region(gallery.layouts.metrics, "note").empty = "keep"; }), engines);
  assert.ok(keep.kinds.layouts.changed.some((change) => change.id === "metrics" && change.slides.includes(2)));
});

test("color and font scheme changes are caught, through the themes that use them too", () => {
  const color = compareReleases(baseline, release("0.26.1", (gallery) => { gallery.colorSchemes["cool-horizon"].accent1 = "#AA0000"; }), engines);
  const verdict = judge(color, []);
  assert.ok(verdict.undeclared.some((change) => change.key === "colorSchemes:cool-horizon"));
  assert.deepEqual(verdict.undeclared.map((change) => change.key).sort(), ["colorSchemes:cool-horizon", "themes:classic", "themes:minimal"], "the minimal and classic themes use cool-horizon, so they draw differently too and must be declared");
  const declare = fragment("mr-99-color", 'drawing: ["colorSchemes:cool-horizon", "themes:minimal", "themes:classic"]');
  assert.equal(judge(color, [declare]).ok, true);
  const font = compareReleases(baseline, release("0.26.1", (gallery) => { gallery.fontSchemes.aptos.major = "Georgia"; }), engines);
  assert.ok(font.kinds.fontSchemes.changed.some((change) => change.id === "aptos"), "a family change is a change even when the raster falls back to the same face");
  assert.equal(judge(font, []).ok, false);
});

test("a removed id fails until declared, and forces a minor train even when the stability run is all there is", () => {
  const result = compareReleases(baseline, release("0.26.1", (gallery) => { delete gallery.tones.formal; }), engines);
  const verdict = judge(result, []);
  assert.deepEqual(verdict.undeclared.map((change) => [change.key, change.removed]), [["tones:formal", true]]);
  assert.match(verdict.problems[0], /^tones:formal: removed; declare it/);
  assert.deepEqual(minimumBump({ fragments: [], stability: result }).reasons, ["removed record id: tones:formal"], "even an undeclared removal asks for a minor");
  const declared = [fragment("mr-99-tone", 'drawing: ["tones:formal"]')];
  assert.equal(judge(result, declared).ok, true);
  assert.equal(minimumBump({ fragments: declared, stability: result }).bump, "minor");
  // The display kinds count too.
  const chart = compareReleases(baseline, release("0.26.1", (_, display) => { delete display.chartTypes[Object.keys(display.chartTypes)[0]]; }), engines);
  assert.equal(judge(chart, []).ok, false);
});

test("new ids, display text and narrative content never fail and need no minor", () => {
  const result = compareReleases(baseline, release("0.26.1", (gallery) => {
    gallery.layouts["two-column-copy"] = structuredClone(gallery.layouts["two-column"]);
    gallery.layouts["two-column"].name = "Two columns side by side";
    gallery.tones.formal = { ...gallery.tones.formal, description: "Reworded." };
  }), engines);
  const verdict = judge(result, []);
  assert.equal(verdict.ok, true, formatResult(result, verdict, minimumBump({ stability: result })));
  assert.deepEqual(result.kinds.layouts.added, ["two-column-copy"]);
  assert.deepEqual(result.content.tones, ["formal"]);
  assert.equal(minimumBump({ stability: result }).bump, "patch");
});

test("a declared id that did not change warns and does not fail", () => {
  const result = compareReleases(baseline, release("0.26.1"), engines);
  const verdict = judge(result, [fragment("mr-99-nothing", 'drawing: ["layouts:hero", "tones:formal"]')]);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.stale, ["layouts:hero", "tones:formal"]);
  assert.equal(verdict.warnings.length, 2);
  assert.match(verdict.warnings[0], /^layouts:hero: declared in changes\/mr-99-nothing\.md but it did not change against 5\.0\.0$/);
  // The declaration still counts for the release type: a declared drawing change is a minor train.
  assert.equal(minimumBump({ fragments: [fragment("mr-99-nothing", 'drawing: ["layouts:hero"]')], stability: result }).bump, "minor");
  // A narrative whose content changed is touched, so declaring it is no stale entry.
  const reworded = compareReleases(baseline, release("0.26.1", (gallery) => { gallery.tones.formal = { ...gallery.tones.formal, description: "Reworded." }; }), engines);
  assert.deepEqual(judge(reworded, [fragment("mr-99-tone", 'drawing: ["tones:formal"]')]).stale, []);
});

test("a CATALOG_SCHEMA change is a new baseline: nothing fails, and the release is a minor one", () => {
  const result = compareReleases(baseline, release("0.26.1", (gallery) => { delete gallery.layouts.hero; moveTwoColumn(gallery); }, 5), engines);
  assert.deepEqual(result.schema, { previous: 4, candidate: 5 });
  assert.equal(result.schemaChanged, true);
  const verdict = judge(result, []);
  assert.equal(verdict.ok, true, verdict.problems.join("\n"));
  assert.equal(verdict.baseline, true);
  assert.ok(result.kinds.layouts.removed.includes("hero"), "the removals are still listed for the record");
  assert.match(formatResult(result, verdict, minimumBump({ stability: result })), /new baseline: CATALOG_SCHEMA 4 -> 5/);
  const bump = minimumBump({ stability: result });
  assert.equal(bump.bump, "minor");
  assert.match(bump.reasons.join(), /CATALOG_SCHEMA 4 -> 5/);
  assert.equal(minimumBump({ stability: compareReleases(baseline, release("0.26.1", () => {}, 3), engines) }).bump, "minor", "a lower schema is a change too");
});

test("gateVersion refuses a patch when the release needs a minor, and the first shared train is a minor over 0.25.0", () => {
  const declared = [fragment("mr-99-two-column", 'drawing: ["layouts:two-column"]')];
  const gate = (previousVersion, version, fragments = []) => gateVersion({ previousVersion, version, fragments });
  assert.equal(gate("0.26.0", "0.26.1").ok, true, "nothing declared: a patch is fine");
  assert.equal(gate("0.26.0", "0.26.1", declared).ok, false);
  assert.match(gate("0.26.0", "0.26.1", declared).problem, /0\.26\.1 after 0\.26\.0 is not a minor bump, but the gallery release needs one: declared drawing change: layouts:two-column/);
  assert.equal(gate("0.26.0", "0.27.0", declared).ok, true);
  assert.equal(gate("0.25.0", "0.26.0", declared).ok, true, "the previous version is the shared line's, not the gallery's 5.0.0 dist-tag");
  assert.equal(gate("0.26.0", "0.26.0").ok, false, "the version must rise");
  assert.equal(gate("0.26.1", "0.26.0").ok, false);
  assert.equal(satisfiesBump("0.26.1", "0.27.0", "minor"), true);
  assert.equal(satisfiesBump("0.26.1", "0.26.2", "minor"), false);
  assert.equal(satisfiesBump("0.25.0", "0.26.0-rc.0", "minor"), true, "a canary of the next minor");
  assert.throws(() => satisfiesBump("5.0.0", "0.26.0", "patch"), /0\.x rule/);
});

test("the removed-id and schema reasons need no fragment: the release type reads the comparison", () => {
  const removed = compareReleases(baseline, release("0.26.1", (gallery) => { delete gallery.themes.minimal; }), engines);
  assert.equal(gateVersion({ previousVersion: "0.26.0", version: "0.26.1", stability: removed }).ok, false);
  assert.equal(gateVersion({ previousVersion: "0.26.0", version: "0.27.0", stability: removed }).ok, true);
});

test("declaredDrawing counts only gallery fragments and names every declaring slug", () => {
  const declared = declaredDrawing([fragment("a", 'drawing: ["layouts:hero"]'), fragment("b", 'drawing: ["layouts:hero", "tones:formal"]'), { slug: "c", packages: ["opf"], drawing: ["themes:minimal"] }]);
  assert.deepEqual([...declared], [["layouts:hero", ["a", "b"]], ["tones:formal", ["b"]]]);
});

// ---------------------------------------------------------------------------------------------------------------------
// The baseline: the `latest` dist-tag, cached.

const writePackage = (dir, version, edit = () => {}, catalogSchema = built.CATALOG_SCHEMA) => {
  const subset = {
    source: built.gallery.source,
    layouts: { "two-column": built.gallery.layouts["two-column"], hero: built.gallery.layouts.hero },
    themes: { minimal: built.gallery.themes.minimal },
    colorSchemes: { "cool-horizon": built.gallery.colorSchemes["cool-horizon"] },
    fontSchemes: { aptos: built.gallery.fontSchemes.aptos },
    narratives: {},
    audiences: {},
    purposes: {},
    tones: { formal: built.gallery.tones.formal },
  };
  edit(subset);
  mkdirSync(path.join(dir, "dist"), { recursive: true });
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "@openpresentation/gallery", version, type: "module", exports: { ".": "./dist/index.js" } }));
  writeFileSync(path.join(dir, "dist", "index.js"), `export const gallery = ${JSON.stringify(subset)};\nexport const catalogDisplay = {};\nexport const CATALOG_SCHEMA = ${catalogSchema};\n`);
  return dir;
};

test("the baseline is the latest dist-tag, never the highest semver, and is cached by version", () => {
  const cache = path.join(scratch, "cache-latest");
  const calls = [];
  const deps = {
    latestVersion: () => {
      calls.push("latest");
      return "0.26.0"; // the highest published version is 5.0.0; the dist-tag points below it
    },
    fetchPublished: (version, tmp) => {
      calls.push(`fetch ${version}`);
      return writePackage(path.join(tmp, "package"), version);
    },
  };
  const first = resolveBaseline({ cacheDir: cache, deps });
  assert.deepEqual([first.version, first.source], ["0.26.0", "registry"]);
  assert.deepEqual(calls, ["latest", "fetch 0.26.0"]);
  const second = resolveBaseline({ cacheDir: cache, deps });
  assert.deepEqual([second.version, second.source, second.dir], ["0.26.0", "cache", first.dir]);
  assert.deepEqual(calls, ["latest", "fetch 0.26.0", "latest"], "the second run asks for the dist-tag only");
  const offline = resolveBaseline({ cacheDir: cache, offline: true, deps: { latestVersion: () => assert.fail("offline must not ask the registry"), fetchPublished: () => assert.fail("offline must not download") } });
  assert.deepEqual([offline.version, offline.source], ["0.26.0", "cache"], "offline uses the version the last online run resolved");
});

test("offline without a cached baseline fails with the way out; an explicit directory or version needs no registry", () => {
  const cache = path.join(scratch, "cache-empty");
  assert.throws(() => resolveBaseline({ cacheDir: cache, offline: true }), /--offline needs a cached baseline.*--baseline-dir/);
  assert.throws(() => resolveBaseline({ cacheDir: cache, offline: true, baselineVersion: "0.26.0" }), /not in the baseline cache/);
  const dir = writePackage(path.join(scratch, "explicit"), "0.25.9");
  assert.deepEqual(resolveBaseline({ baselineDir: dir, cacheDir: cache }), { version: "0.25.9", dir, source: "dir" });
  const fetched = [];
  const pinned = resolveBaseline({ cacheDir: cache, baselineVersion: "5.0.0", deps: { latestVersion: () => assert.fail("a pinned version skips the dist-tag"), fetchPublished: (version, tmp) => { fetched.push(version); return writePackage(path.join(tmp, "package"), version); } } });
  assert.deepEqual([pinned.version, pinned.source, fetched], ["5.0.0", "registry", ["5.0.0"]]);
  assert.throws(() => resolveBaseline({ cacheDir: cache, baselineVersion: "latest" }), /not a version/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The command: candidate directory, baseline directory, fragments.

function repo(name, fragments = {}) {
  const root = path.join(scratch, name);
  mkdirSync(path.join(root, "changes"), { recursive: true });
  writeFileSync(path.join(root, "changes", "config.json"), JSON.stringify(config));
  for (const [file, text] of Object.entries(fragments)) writeFileSync(path.join(root, "changes", file), text);
  return root;
}
const gal = (front) => `---\ntype: changed\npackages: [gallery]\n${front}\n---\nMoved the layout.\n`;

async function runMain(name, { fragments, edit, schema, version = "0.26.1" }) {
  const dir = path.join(scratch, name);
  const previous = writePackage(path.join(dir, "previous"), "0.26.0");
  const candidate = writePackage(path.join(dir, "candidate"), version, edit, schema);
  const root = repo(`${name}-root`, fragments);
  const json = path.join(dir, "result.json");
  const out = [];
  const write = process.stdout.write;
  process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
  let code;
  try {
    code = await main(["--candidate-dir", candidate, "--baseline-dir", previous, "--dir", root, "--json", json], { engines });
  } finally {
    process.stdout.write = write;
  }
  return { code, output: out.join(""), json: JSON.parse(readFileSync(json, "utf8")) };
}
const move = (subset) => {
  subset.layouts["two-column"] = structuredClone(subset.layouts["two-column"]);
  moveTwoColumn(subset);
};

test("the command: an undeclared change exits 1, a declared one 0, with the minimum bump in the JSON", async () => {
  const same = await runMain("cmd-same", {});
  assert.equal(same.code, 0, same.output);
  assert.match(same.output, /minimum bump: patch\nOK: every existing record draws the same\./);

  const undeclared = await runMain("cmd-undeclared", { edit: move });
  assert.equal(undeclared.code, 1, undeclared.output);
  assert.match(undeclared.output, /FAIL: 1 existing record\(s\) draw differently or were removed without a declaration:\n {2}layouts:two-column: /);
  assert.equal(undeclared.json.verdict.ok, false);

  const declared = await runMain("cmd-declared", { edit: move, fragments: { "mr-99-two-column.md": gal('drawing: ["layouts:two-column"]') } });
  assert.equal(declared.code, 0, declared.output);
  assert.equal(declared.json.bump.bump, "minor");
  assert.match(declared.output, /minimum bump: minor \(declared drawing change: layouts:two-column\)\nOK: 1 change\(s\), all declared or a new baseline\./);

  const removed = await runMain("cmd-removed", { edit: (subset) => { delete subset.layouts.hero; } });
  assert.equal(removed.code, 1);
  assert.match(removed.output, /layouts:hero: removed; declare it/);

  const stale = await runMain("cmd-stale", { fragments: { "mr-99-stale.md": gal('drawing: ["themes:minimal"]') } });
  assert.equal(stale.code, 0);
  assert.match(stale.output, /warning: themes:minimal: declared in changes\/mr-99-stale\.md but it did not change against 0\.26\.0/);
});

test("the command: a schema change passes as a new baseline and asks for a minor", async () => {
  const run = await runMain("cmd-schema", { edit: move, schema: 5 });
  assert.equal(run.code, 0, run.output);
  assert.equal(run.json.result.schemaChanged, true);
  assert.equal(run.json.bump.bump, "minor");
});

test("the command: an invalid fragment fails the run instead of being ignored", async () => {
  await assert.rejects(runMain("cmd-invalid", { fragments: { "mr-99-bad.md": gal('drawing: ["layouts"]') } }), /not <kind>:<id>/);
});

test("without a tracked packages/gallery the command checks nothing and exits 0", () => {
  const root = repo("cmd-untracked");
  const result = spawnSync(process.execPath, [SCRIPT, "--dir", root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /packages\/gallery is not a tracked package here/);
});
