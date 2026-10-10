#!/usr/bin/env node
// RR-78 pixel stability: a minor (or patch) release of @openpresentation/gallery never changes how an existing record
// draws, and never removes an id. Only a major release may.
//
//   node scripts/stability.mjs                          compare dist/ with the previous published release
//   node scripts/stability.mjs --previous 0.0.1         ... with that published version
//   node scripts/stability.mjs --previous-dir <dir>     ... with an unpacked package directory (tests, offline)
//   node scripts/stability.mjs --json <file>            also write the full result
//
// The previous release is the highest published version at or below the candidate's (package.json) version, so a pull
// request that changes records without a version bump is held to the published release it would replace. For every id
// of the layouts, themes, colour schemes and font schemes both releases have, the same core and the same renderer (this
// package's devDependencies) draw a fixture deck (scripts/fixtures.mjs) once with each release registered as the
// catalog: SVG bytes are hashed first, and only an SVG mismatch is rasterized (resvg, the renderer's bundled faces) to
// count the differing pixels. The drawing uses core's portable text measurement and no font files, so the SVG names
// each font scheme's families: a family change is a change even where the raster falls back to the same face.
//
// A difference in an existing record's drawing, or a removed id of any kind, fails unless the candidate's major version
// is above the previous one. New ids always pass. The narratives, audiences, purposes and tones draw nothing: their
// content changes are listed for the release notes, and their removals follow the same rule.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OTHER_KINDS, VISUAL_KINDS } from "./fixtures.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = "@openpresentation/gallery";
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(text) {
  const match = VERSION.exec(text ?? "");
  if (!match) throw new Error(`not a version: ${text}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? "" };
}

export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (const key of ["major", "minor", "patch"]) if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** The release a candidate is compared with: the highest published stable version at or below it. */
export function previousVersion(published, candidate) {
  const stable = published.filter((version) => VERSION.test(version) && !parseVersion(version).pre && compareVersions(version, candidate) <= 0);
  stable.sort(compareVersions);
  return stable.at(-1);
}

/** Whether the bump from `previous` to `candidate` may change existing records (a major release). */
export function allowsChanges(previous, candidate) {
  return parseVersion(candidate).major > parseVersion(previous).major;
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

/** Downloads `<PACKAGE>@<version>` and returns the unpacked package directory (`<tmp>/package`). */
export function fetchPublished(version, tmp) {
  parseVersion(version);
  const out = JSON.parse(run("npm", ["pack", `${PACKAGE}@${version}`, "--json", "--silent"], { cwd: tmp }));
  const filename = out[0]?.filename;
  if (!filename) throw new Error(`npm pack ${PACKAGE}@${version} returned no tarball`);
  // Bare names in the archive's directory: GNU tar under Git for Windows reads `C:\...` as a remote host.
  run("tar", ["-xzf", path.basename(filename)], { cwd: tmp });
  return path.join(tmp, "package");
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

/** Loads the renderer that draws both releases and a rasterizer for SVG mismatches. */
export async function loadEngines() {
  const require = createRequire(path.join(packageRoot, "package.json"));
  const { toSvg } = await import(pathToFileURL(require.resolve("@openpresentation/opf-render")).href);
  const renderPackage = path.dirname(require.resolve("@openpresentation/opf-render/package.json"));
  const fontDir = path.join(renderPackage, "fonts");
  const fontFiles = existsSync(fontDir) ? readdirSync(fontDir, { recursive: true }).map(String).filter((name) => /\.(ttf|otf)$/i.test(name)).map((name) => path.join(fontDir, name)) : [];
  const { Resvg } = require("@resvg/resvg-js");
  const raster = (svg) => {
    const image = new Resvg(svg, { fitTo: { mode: "width", value: 960 }, font: { loadSystemFonts: false, fontFiles } }).render();
    return { width: image.width, height: image.height, pixels: image.pixels };
  };
  const versions = {
    core: JSON.parse(readFileSync(require.resolve("@openpresentation/opf/package.json"), "utf8")).version,
    render: JSON.parse(readFileSync(path.join(renderPackage, "package.json"), "utf8")).version,
  };
  return { toSvg, raster, versions };
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

/**
 * Compares two releases. `previous` and `candidate` are `{ version, module }` (module: the package's exports).
 * Returns { previous, candidate, major, kinds: { <kind>: { compared, changed: [{ id, slides, pixels }], removed, added } },
 * content: { <kind>: [ids whose record changed] }, problems, ok, renders, ms }.
 */
export async function compareReleases(previous, candidate, engines) {
  const started = Date.now();
  const before = previous.module.gallery;
  const after = candidate.module.gallery;
  const major = allowsChanges(previous.version, candidate.version);
  const result = { previous: previous.version, candidate: candidate.version, major, engines: engines.versions, kinds: {}, content: {}, problems: [], renders: 0 };
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
  if (!major) {
    for (const [kind, entry] of Object.entries(result.kinds)) {
      for (const change of entry.changed) {
        const how = change.error ? `the renderer ${change.error.previous ? `rejected the previous release (${change.error.previous})` : "drew the previous release"} and ${change.error.candidate ? `rejects the candidate (${change.error.candidate})` : "draws the candidate"}` : `${change.slides.length > 1 ? "slides" : "slide"} ${change.slides.join(", ")} ${change.slides.length > 1 ? "draw" : "draws"} differently (${describePixels(change.pixels)})`;
        result.problems.push(`${kind}/${change.id}: ${how}`);
      }
      for (const id of entry.removed) result.problems.push(`${kind}/${id}: removed`);
    }
  }
  result.ok = result.problems.length === 0;
  result.ms = Date.now() - started;
  return result;
}

export function formatResult(result) {
  const lines = [`${PACKAGE} ${result.candidate} against ${result.previous} (${result.major ? "major: existing records may change" : "minor or patch: existing records must draw the same"}), core ${result.engines.core}, opf-render ${result.engines.render}`];
  for (const [kind, entry] of Object.entries(result.kinds)) {
    const parts = [];
    if (entry.compared) parts.push(`${entry.compared} drawn, ${entry.changed.length} changed`);
    if (entry.added.length) parts.push(`${entry.added.length} new`);
    if (entry.removed.length) parts.push(`${entry.removed.length} removed`);
    if (result.content[kind]?.length) parts.push(`${result.content[kind].length} with changed content (${result.content[kind].slice(0, 6).join(", ")}${result.content[kind].length > 6 ? ", ..." : ""})`);
    lines.push(`  ${kind}: ${parts.join(", ") || "unchanged"}`);
    if (result.major) for (const change of entry.changed.slice(0, 20)) lines.push(`    changed (allowed in a major release): ${change.id}`);
  }
  lines.push(`  ${result.renders} renders in ${(result.ms / 1000).toFixed(1)} s`);
  if (result.problems.length) {
    lines.push("", `FAIL: ${result.problems.length} existing record(s) changed or removed in a ${result.major ? "major" : "minor or patch"} release. Restore them, or release a new major version:`);
    lines.push(...result.problems.slice(0, 60).map((problem) => `  ${problem}`));
    if (result.problems.length > 60) lines.push(`  ... and ${result.problems.length - 60} more`);
  } else lines.push("OK: every existing record draws the same, or the release is major.");
  return lines.join("\n");
}

function option(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

export async function main(argv = process.argv.slice(2)) {
  const candidateDir = path.resolve(option(argv, "--candidate-dir") ?? packageRoot);
  if (!existsSync(path.join(candidateDir, "dist", "index.js")) && candidateDir === packageRoot) throw new Error("dist/ is missing: run `node scripts/build.mjs` first");
  const candidate = await loadPackage(candidateDir);
  let previousDir = option(argv, "--previous-dir");
  const tmp = previousDir ? undefined : mkdtempSync(path.join(os.tmpdir(), "opf-gallery-previous-"));
  try {
    if (!previousDir) {
      let version = option(argv, "--previous");
      if (!version) {
        const published = JSON.parse(run("npm", ["view", PACKAGE, "versions", "--json"]));
        version = previousVersion(Array.isArray(published) ? published : [published], candidate.version);
        if (!version) throw new Error(`no published ${PACKAGE} version at or below ${candidate.version}`);
      }
      previousDir = fetchPublished(version, tmp);
    }
    const previous = await loadPackage(path.resolve(previousDir));
    const result = await compareReleases(previous, candidate, await loadEngines());
    const json = option(argv, "--json");
    if (json) writeFileSync(json, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${formatResult(result)}\n`);
    return result.ok ? 0 : 1;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
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
