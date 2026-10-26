#!/usr/bin/env node
// MR-35: the gallery's stability rule on the shared 0.x line (docs/programs/monorepo/README.md, "Gallery versioning and the
// stability rule", D16). It replaces OpenPresentation/gallery's scripts/stability.mjs, which allowed a drawing change only
// across a major version and so cannot work on a shared 0.x version (it would take 0.0.1 as the previous release and forbid
// every change). The purpose is kept: a change to how an existing record draws, or a removed id, is deliberate, visible and
// never hides in a patch release.
//
//   node scripts/gallery-stability.mjs                        check the tracked packages/gallery against the baseline
//   node scripts/gallery-stability.mjs --candidate-dir <dir>  ... a built gallery package directory (dist/index.js)
//   node scripts/gallery-stability.mjs --baseline-dir <dir>   ... against an unpacked package directory (tests, offline)
//   node scripts/gallery-stability.mjs --offline              never use the network: the cached baseline only
//   node scripts/gallery-stability.mjs --baseline-version V   the baseline is that published version (not the dist-tag)
//   node scripts/gallery-stability.mjs --cache-dir <dir>      the baseline cache (default: $OPF_GALLERY_BASELINE_CACHE, else a
//                                                             directory under the OS temp directory)
//   node scripts/gallery-stability.mjs --dir <root>           the repository whose changes/ fragments declare changes
//   node scripts/gallery-stability.mjs --json <file>          also write the full result
//
// The rule:
//   1. The baseline is the `latest` dist-tag of @openpresentation/gallery, never the highest semver (the gallery goes from
//      5.0.0 down to the shared 0.26.0 line, so the highest version is not the release the candidate replaces). The tarball is
//      cached by version, so a second run, and `--offline`, need no network.
//   2. For every layout, theme, color scheme and font scheme both releases have, the same renderer draws a fixture deck once
//      per release (scripts/gallery-stability-fixtures.mjs): SVG bytes are hashed first, and only a mismatch is rasterized to
//      count differing pixels. Layouts are drawn with an empty and a filled slide, so a collapse change shows. A font family
//      change is a change. The narratives, audiences, purposes and tones draw nothing: their content changes are listed.
//   3. Every id that draws differently or was removed (of any kind) must be declared in a changelog fragment for the gallery:
//      `changes/<slug>.md` with `packages: [gallery]` and `drawing: ["layouts:hero", "themes:minimal"]`. An UNDECLARED change
//      fails; a declared id that did not change warns. New ids always pass.
//   4. A declared drawing change, a removed id or a CATALOG_SCHEMA change makes the release a MINOR train at least, never a
//      patch (`minimumBump`, `gateVersion`: what scripts/release.mjs, MR-40, calls). A CATALOG_SCHEMA change is a new baseline
//      (as the old rule's major was): the records are compared for the record only, nothing is failed for it, and the minor
//      bump is what the release owes.
//
// Where it runs: from the repository root, with the engines (opf-render, and the resvg it bundles) resolved from the root's
// devDependencies, or today from packages/javascript's. With no tracked packages/gallery (the gallery is still published from
// its own repository) it checks nothing unless --candidate-dir names a built package, and exits 0.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tar } from "./archive-tar.mjs";
import { loadConfig, readFragments } from "./changelog-fragments.mjs";
import { OTHER_KINDS, VISUAL_KINDS } from "./gallery-stability-fixtures.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PACKAGE = "@openpresentation/gallery";
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(text) {
  const match = VERSION.exec(text ?? "");
  if (!match) throw new Error(`not a version: ${text}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? "" };
}

/** A release's record schema generation (its `CATALOG_SCHEMA` export; 1 for a release from before the export). */
export function catalogSchemaOf(module) {
  return Number.isInteger(module?.CATALOG_SCHEMA) ? module.CATALOG_SCHEMA : 1;
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

function run(command, args, options = {}) {
  // npm is npm.cmd on Windows, which only a shell starts; the arguments here are fixed words and a checked version.
  const shell = process.platform === "win32" && command === "npm";
  const settings = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options };
  const result = shell ? spawnSync([command, ...args].join(" "), { ...settings, shell: true }) : spawnSync(command, args, settings);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result.status}\n${result.stderr}`);
  return result.stdout;
}

// ---------------------------------------------------------------------------------------------------------------------
// The baseline: the `latest` dist-tag release, cached by version.

/** The version the `latest` dist-tag of the gallery points at. The highest semver is the wrong answer (5.0.0 stays published). */
export function latestVersion() {
  const tags = JSON.parse(run("npm", ["view", PACKAGE, "dist-tags", "--json"]));
  const latest = tags?.latest;
  if (typeof latest !== "string") throw new Error(`${PACKAGE} has no "latest" dist-tag`);
  parseVersion(latest);
  return latest;
}

/** Downloads `<PACKAGE>@<version>` and returns the unpacked package directory (`<tmp>/package`). */
export function fetchPublished(version, tmp) {
  parseVersion(version);
  const out = JSON.parse(run("npm", ["pack", `${PACKAGE}@${version}`, "--json", "--silent"], { cwd: tmp }));
  const filename = out[0]?.filename;
  if (!filename) throw new Error(`npm pack ${PACKAGE}@${version} returned no tarball`);
  tar(path.join(tmp, path.basename(filename)), "-xzf", ["-C", tmp]);
  return path.join(tmp, "package");
}

export const defaultCacheDir = () => process.env.OPF_GALLERY_BASELINE_CACHE || path.join(os.tmpdir(), "opf-gallery-baseline");

/**
 * Finds the baseline package directory: `{ version, dir, source }` where source is "dir" (an explicit directory), "cache" or
 * "registry". The version is `--baseline-version`, else the `latest` dist-tag (offline: the one the last online run cached).
 * `deps` replaces the registry calls in tests: `{ latestVersion(), fetchPublished(version, tmp) }`.
 */
export function resolveBaseline({ baselineDir, baselineVersion, offline = false, cacheDir = defaultCacheDir(), deps = {} } = {}) {
  const readVersion = (dir) => JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version;
  if (baselineDir) return { version: readVersion(path.resolve(baselineDir)), dir: path.resolve(baselineDir), source: "dir" };
  const pointer = path.join(cacheDir, "latest.json");
  let version = baselineVersion;
  if (!version) {
    if (offline) {
      if (!existsSync(pointer)) throw new Error(`--offline needs a cached baseline: run once with the network, or pass --baseline-dir or --baseline-version (cache ${cacheDir})`);
      version = JSON.parse(readFileSync(pointer, "utf8")).version;
    } else {
      version = (deps.latestVersion ?? latestVersion)();
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(pointer, `${JSON.stringify({ package: PACKAGE, distTag: "latest", version })}\n`);
    }
  }
  parseVersion(version);
  const cached = path.join(cacheDir, version);
  if (existsSync(path.join(cached, "package.json"))) return { version, dir: cached, source: "cache" };
  if (offline) throw new Error(`--offline: ${PACKAGE}@${version} is not in the baseline cache ${cacheDir}`);
  mkdirSync(cacheDir, { recursive: true });
  const tmp = mkdtempSync(path.join(cacheDir, `.fetch-${version}-`));
  try {
    const unpacked = (deps.fetchPublished ?? fetchPublished)(version, tmp);
    rmSync(cached, { recursive: true, force: true });
    renameSync(unpacked, cached);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { version, dir: cached, source: "registry" };
}

/** Imports a package directory's main entry and returns its exports. */
export async function loadPackage(dir) {
  const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const root = manifest.exports?.["."];
  const entry = (typeof root === "string" ? root : (root?.default ?? root?.import)) ?? manifest.main ?? "index.js";
  const module = await import(pathToFileURL(path.join(dir, entry)).href);
  if (!module.gallery || typeof module.gallery.source !== "string") throw new Error(`${dir} exports no gallery catalog`);
  return { version: manifest.version, module };
}

// ---------------------------------------------------------------------------------------------------------------------
// The engines: one renderer draws both releases.

/**
 * Loads the renderer that draws both releases and a rasterizer for SVG mismatches. The renderer resolves from the repository
 * root's devDependencies once the workspace has the engines there (MR-10 onward), today from packages/javascript's.
 */
export async function loadEngines(root = repoRoot) {
  const contexts = ["package.json", "packages/javascript/package.json", "packages/render/package.json"].map((file) => path.join(root, file)).filter((file) => existsSync(file));
  for (const context of contexts) {
    let require;
    try {
      require = createRequire(context);
      require.resolve("@openpresentation/opf-render/package.json");
    } catch {
      continue;
    }
    const { toSvg } = await import(pathToFileURL(require.resolve("@openpresentation/opf-render")).href);
    const renderPackage = path.dirname(require.resolve("@openpresentation/opf-render/package.json"));
    const fontDir = path.join(renderPackage, "fonts");
    const fontFiles = existsSync(fontDir) ? readdirSync(fontDir, { recursive: true }).map(String).filter((name) => /\.(ttf|otf)$/i.test(name)).map((name) => path.join(fontDir, name)) : [];
    const { Resvg } = createRequire(path.join(renderPackage, "package.json"))("@resvg/resvg-js");
    const raster = (svg) => {
      const image = new Resvg(svg, { fitTo: { mode: "width", value: 960 }, font: { loadSystemFonts: false, fontFiles } }).render();
      return { width: image.width, height: image.height, pixels: image.pixels };
    };
    return { toSvg, raster, versions: { render: JSON.parse(readFileSync(path.join(renderPackage, "package.json"), "utf8")).version } };
  }
  throw new Error("@openpresentation/opf-render does not resolve from the repository root or packages/javascript: run `pnpm install`");
}

/** Draws a deck to one SVG string per slide, or `{ error }` when the renderer rejects it. */
function draw(toSvg, deck, catalog) {
  try {
    return { svgs: toSvg(deck, { catalogs: [catalog] }) };
  } catch (error) {
    return { error: `${error.code ?? error.name}: ${error.message}` };
  }
}

function differingPixels(raster, a, b) {
  const x = raster(a);
  const y = raster(b);
  if (x.width !== y.width || x.height !== y.height) return x.width * x.height;
  let count = 0;
  for (let at = 0; at < x.pixels.length; at += 4) {
    if (x.pixels[at] !== y.pixels[at] || x.pixels[at + 1] !== y.pixels[at + 1] || x.pixels[at + 2] !== y.pixels[at + 2] || x.pixels[at + 3] !== y.pixels[at + 3]) count += 1;
  }
  return count;
}

function describePixels(pixels) {
  if (Number.isNaN(pixels)) return "a different slide count";
  if (pixels === 0) return "the SVG differs but its raster with the renderer's bundled faces does not: a font family or another change a fallback face hides";
  return `${pixels} pixels differ at 960 px wide`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The comparison and the verdict.

/**
 * Compares two releases. `previous` and `candidate` are `{ version, module }` (module: the package's exports).
 * Returns { previous, candidate, schema, schemaChanged, engines, kinds: { <kind>: { compared, changed: [{ id, slides, pixels }],
 * removed, added } }, content: { <kind>: [ids whose record changed] }, renders, ms }. It judges nothing: `judge` does.
 */
export function compareReleases(previous, candidate, engines) {
  const started = Date.now();
  const before = previous.module.gallery;
  const after = candidate.module.gallery;
  const schema = { previous: catalogSchemaOf(previous.module), candidate: catalogSchemaOf(candidate.module) };
  const result = { previous: previous.version, candidate: candidate.version, schema, schemaChanged: schema.previous !== schema.candidate, engines: engines.versions, kinds: {}, content: {}, renders: 0 };
  for (const { kind, deck } of VISUAL_KINDS) {
    const old = before[kind] ?? {};
    const next = after[kind] ?? {};
    const entry = { compared: 0, changed: [], removed: Object.keys(old).filter((id) => !(id in next)), added: Object.keys(next).filter((id) => !(id in old)) };
    for (const id of Object.keys(old)) {
      if (!(id in next)) continue;
      entry.compared += 1;
      const fixture = deck(id, old[id]);
      const a = draw(engines.toSvg, fixture, before);
      const b = draw(engines.toSvg, fixture, after);
      result.renders += 2;
      if (a.error || b.error) {
        if (a.error !== b.error) entry.changed.push({ id, slides: [], pixels: null, error: { previous: a.error ?? null, candidate: b.error ?? null } });
        continue;
      }
      const slides = [];
      let pixels = 0;
      const count = Math.max(a.svgs.length, b.svgs.length);
      for (let slide = 0; slide < count; slide += 1) {
        const x = a.svgs[slide];
        const y = b.svgs[slide];
        if (x !== undefined && y !== undefined && sha256(x) === sha256(y)) continue;
        slides.push(slide + 1);
        pixels += x === undefined || y === undefined ? Number.NaN : differingPixels(engines.raster, x, y);
      }
      if (slides.length) entry.changed.push({ id, slides, pixels });
    }
    result.kinds[kind] = entry;
  }
  for (const kind of OTHER_KINDS) {
    const old = before[kind] ?? {};
    const next = after[kind] ?? {};
    result.kinds[kind] = { compared: 0, changed: [], removed: Object.keys(old).filter((id) => !(id in next)), added: Object.keys(next).filter((id) => !(id in old)) };
    result.content[kind] = Object.keys(old).filter((id) => id in next && canonical(old[id]) !== canonical(next[id]));
  }
  for (const [kind, display] of Object.entries(candidate.module.catalogDisplay ?? {})) {
    const old = previous.module.catalogDisplay?.[kind];
    if (!old) continue;
    result.kinds[kind] = { compared: 0, changed: [], removed: Object.keys(old).filter((id) => !(id in display)), added: Object.keys(display).filter((id) => !(id in old)) };
  }
  result.ms = Date.now() - started;
  return result;
}

/** The `<kind>:<id>` entries the gallery fragments declare (`drawing`), each with the sources that declare it. */
export function declaredDrawing(fragments) {
  const declared = new Map();
  for (const fragment of fragments) {
    if (!fragment.packages?.includes("gallery")) continue;
    const source = fragment.source ?? `changes/${fragment.slug}.md`;
    for (const entry of fragment.drawing ?? []) declared.set(entry, [...(declared.get(entry) ?? []), source]);
  }
  return declared;
}

// A release folds its fragments into the changelogs and deletes them (`release.mjs prepare`), so the release commit would show
// every declared drawing change as undeclared. Prepare therefore records the gallery's declarations for the version it sets here,
// and the comparison of that release tree against the previous release counts them like fragments: it still draws and compares
// every record, and an id the release did not declare still fails.
export const RELEASE_DRAWING_FILE = "packages/gallery/release-drawing.json";

/** The record prepare writes: `{ version, drawing }`, the sorted `<kind>:<id>` entries the release's gallery fragments declared. */
export function releaseDrawingRecord(version, fragments) {
  return { version, drawing: [...declaredDrawing(fragments).keys()].sort() };
}

/** The release's declarations as a fragment, when the record names `version` (the candidate's); otherwise none. */
export function releaseDeclarations(root, version) {
  const file = path.join(root, RELEASE_DRAWING_FILE);
  if (!existsSync(file)) return [];
  const record = JSON.parse(readFileSync(file, "utf8"));
  if (record.version !== version || !Array.isArray(record.drawing)) return [];
  return [{ slug: `release-${version}`, source: `${RELEASE_DRAWING_FILE} (${version})`, packages: ["gallery"], drawing: record.drawing }];
}

/** What `result` says changed and must be declared: `[{ key, removed, how }]`, one per id that draws differently or is gone. */
export function changesOf(result) {
  const out = [];
  for (const [kind, entry] of Object.entries(result.kinds)) {
    for (const change of entry.changed) {
      const how = change.error
        ? `the renderer ${change.error.previous ? `rejected the previous release (${change.error.previous})` : "drew the previous release"} and ${change.error.candidate ? `rejects the candidate (${change.error.candidate})` : "draws the candidate"}`
        : `${change.slides.length > 1 ? "slides" : "slide"} ${change.slides.join(", ")} ${change.slides.length > 1 ? "draw" : "draws"} differently (${describePixels(change.pixels)})`;
      out.push({ key: `${kind}:${change.id}`, removed: false, how });
    }
    for (const id of entry.removed) out.push({ key: `${kind}:${id}`, removed: true, how: "removed" });
  }
  return out;
}

/**
 * The verdict: every changed or removed id must be declared. `fragments` are the parsed changes/ fragments (any package; only
 * the gallery's `drawing` counts). A CATALOG_SCHEMA change is a new baseline: nothing is failed for it (the records are
 * compared for the record only), and `minimumBump` still makes the release a minor one.
 * Returns { ok, problems, warnings, changes, undeclared, stale, declared, baseline }.
 */
export function judge(result, fragments = []) {
  const declared = declaredDrawing(fragments);
  const changes = changesOf(result);
  const baseline = result.schemaChanged;
  const undeclared = baseline ? [] : changes.filter((change) => !declared.has(change.key));
  const touched = new Set([...changes.map((change) => change.key), ...Object.entries(result.content).flatMap(([kind, ids]) => ids.map((id) => `${kind}:${id}`))]);
  const stale = baseline ? [] : [...declared.keys()].filter((key) => !touched.has(key));
  const problems = undeclared.map((change) => `${change.key}: ${change.how}; declare it in a changes/ fragment for the gallery (drawing: ["${change.key}"]) or restore it`);
  const warnings = stale.map((key) => `${key}: declared in ${declared.get(key).join(", ")} but it did not change against ${result.previous}`);
  return { ok: problems.length === 0, problems, warnings, changes, undeclared, stale, declared: [...declared.keys()], baseline };
}

/**
 * The minimum bump of a release that ships these changes: "minor" when a gallery fragment declares a drawing change, an id was
 * removed or CATALOG_SCHEMA changed, else "patch" (new ids and unchanged drawings are allowed in any train). `fragments` are the
 * fragments being assembled; `stability` is the result of `compareReleases` (omit it when the comparison did not run: only the
 * declarations count then, and a removed id must be declared anyway). Returns { bump, reasons }.
 */
export function minimumBump({ fragments = [], stability } = {}) {
  const reasons = [];
  const declared = [...declaredDrawing(fragments).keys()];
  if (declared.length) reasons.push(`declared drawing change: ${declared.join(", ")}`);
  const removed = stability ? changesOf(stability).filter((change) => change.removed).map((change) => change.key) : [];
  const unseen = removed.filter((key) => !declared.includes(key));
  if (unseen.length) reasons.push(`removed record id: ${unseen.join(", ")}`);
  if (stability?.schemaChanged) reasons.push(`CATALOG_SCHEMA ${stability.schema.previous} -> ${stability.schema.candidate}`);
  const undeclared = stability ? changesOf(stability).filter((change) => !change.removed && !declared.includes(change.key)).map((change) => change.key) : [];
  if (undeclared.length && !stability.schemaChanged) reasons.push(`undeclared drawing change (check:stability fails it): ${undeclared.join(", ")}`);
  return { bump: reasons.length ? "minor" : "patch", reasons };
}

/**
 * Whether `next` raises `previous` by at least `bump`, on the 0.x line the rule is written for (D14: a breaking change is a
 * minor bump, everything else a patch). `previous` is the previous TRAIN's version on the shared line (what the other five
 * packages' `latest` carry), not the gallery's own dist-tag: the first shared train goes from 0.25.0 to 0.26.0 while the gallery's
 * `latest` is 5.0.0. Throws for a 1.x+ line, where the rule has to be decided again.
 */
export function satisfiesBump(previous, next, bump) {
  const a = parseVersion(previous);
  const b = parseVersion(next);
  if (a.major > 0 || b.major > 0) throw new Error(`the gallery stability rule is the 0.x rule (${previous} -> ${next}): decide the 1.x rule before leaving 0.x`);
  const raised = b.minor > a.minor || (b.minor === a.minor && b.patch > a.patch);
  return raised && (bump === "patch" || b.minor > a.minor);
}

/**
 * The release gate scripts/release.mjs (`prepare` and the `gate`) calls: `{ previousVersion, version, fragments, stability }` ->
 * `{ ok, bump, reasons, problem }`. A patch (0.26.0 -> 0.26.1) is refused when the release needs a minor.
 */
export function gateVersion({ previousVersion, version, fragments = [], stability }) {
  const { bump, reasons } = minimumBump({ fragments, stability });
  const ok = satisfiesBump(previousVersion, version, bump);
  return { ok, bump, reasons, problem: ok ? null : `${version} after ${previousVersion} is not a ${bump} bump, but the gallery release needs one: ${reasons.join("; ") || "version must increase"}` };
}

export function formatResult(result, verdict, bump) {
  const lines = [`${PACKAGE} ${result.candidate} against the latest release ${result.previous}, opf-render ${result.engines.render}`];
  if (result.schemaChanged) lines.push(`  new baseline: CATALOG_SCHEMA ${result.schema.previous} -> ${result.schema.candidate}; ${result.previous} is compared for the record only`);
  for (const [kind, entry] of Object.entries(result.kinds)) {
    const parts = [];
    if (entry.compared) parts.push(`${entry.compared} drawn, ${entry.changed.length} changed`);
    if (entry.added.length) parts.push(`${entry.added.length} new`);
    if (entry.removed.length) parts.push(`${entry.removed.length} removed`);
    if (result.content[kind]?.length) parts.push(`${result.content[kind].length} with changed content (${result.content[kind].slice(0, 6).join(", ")}${result.content[kind].length > 6 ? ", ..." : ""})`);
    lines.push(`  ${kind}: ${parts.join(", ") || "unchanged"}`);
  }
  lines.push(`  ${result.renders} renders in ${(result.ms / 1000).toFixed(1)} s`);
  for (const warning of verdict.warnings) lines.push(`  warning: ${warning}`);
  lines.push(`  minimum bump: ${bump.bump}${bump.reasons.length ? ` (${bump.reasons.join("; ")})` : ""}`);
  if (verdict.problems.length) {
    lines.push("", `FAIL: ${verdict.problems.length} existing record(s) draw differently or were removed without a declaration:`);
    lines.push(...verdict.problems.slice(0, 60).map((problem) => `  ${problem}`));
    if (verdict.problems.length > 60) lines.push(`  ... and ${verdict.problems.length - 60} more`);
  } else lines.push(`OK: ${verdict.changes.length ? `${verdict.changes.length} change(s), all declared or a new baseline` : "every existing record draws the same"}.`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------

function option(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

/** The tracked gallery package directory (packages/gallery, once imported), or undefined while the gallery is its own repository. */
export function trackedGalleryDir(root = repoRoot) {
  const dir = path.join(root, "packages", "gallery");
  return existsSync(path.join(dir, "package.json")) ? dir : undefined;
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const root = path.resolve(option(argv, "--dir") ?? repoRoot);
  let candidateDir = option(argv, "--candidate-dir");
  if (candidateDir) candidateDir = path.resolve(candidateDir);
  else {
    candidateDir = trackedGalleryDir(root);
    if (!candidateDir) {
      process.stdout.write(`packages/gallery is not a tracked package here (the gallery is still released from OpenPresentation/gallery); nothing to check. Pass --candidate-dir <built package> to check one.\n`);
      return 0;
    }
    if (!existsSync(path.join(candidateDir, "dist", "index.js"))) run(process.execPath, ["scripts/build.mjs"], { cwd: candidateDir });
  }
  const candidate = await loadPackage(candidateDir);
  const baseline = resolveBaseline({ baselineDir: option(argv, "--baseline-dir"), baselineVersion: option(argv, "--baseline-version"), offline: argv.includes("--offline"), cacheDir: option(argv, "--cache-dir"), deps: deps.registry });
  const previous = await loadPackage(baseline.dir);
  const config = loadConfig(root);
  const fragments = config.targets?.gallery === undefined ? [] : [...readFragments(root, config), ...releaseDeclarations(root, candidate.version)];
  const result = compareReleases(previous, candidate, deps.engines ?? (await loadEngines(repoRoot)));
  const verdict = judge(result, fragments);
  const bump = minimumBump({ fragments, stability: result });
  const json = option(argv, "--json");
  if (json) writeFileSync(json, `${JSON.stringify({ baseline: { version: baseline.version, source: baseline.source }, result, verdict, bump }, null, 2)}\n`);
  process.stdout.write(`${formatResult(result, verdict, bump)}\n`);
  return verdict.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error.message ?? error}\n`);
      process.exitCode = 1;
    },
  );
}
