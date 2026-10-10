// Detects BREAKING changes in spec/** relative to the most recent `opf-v*`
// git tag, and fails the build unless the pending version bump in
// packages/javascript/package.json acknowledges them.
//
// "Breaking" is scoped narrowly to five kinds of removal — additions are
// never breaking:
//   1. a catalog record file (packages/gallery/catalog/<kind>/<id>.json; before RR-78
//      spec/catalogs/<kind>/<id>.json) that existed at the tag no longer exists under
//      packages/gallery/catalog (a removed record id).
//   2. a schema file (spec/schemas/*.schema.json) that existed at the tag no
//      longer exists.
//   3. a top-level `properties` or `$defs` entry removed from a schema file
//      that existed at the tag (nested removals below the top level are out
//      of scope for this check).
//   4. an enum that existed at the tag lost one or more of its values,
//      compared at the same JSON path in the same schema file. An enum that
//      only gained values, or whose sibling node still exists but with the
//      `enum` keyword removed while other schema keywords are also present,
//      is treated the same way: the loss of the constraint's old values is
//      what's breaking.
//   5. a package export (an `exports` subpath of packages/javascript/package.json,
//      such as `./node`) that existed at the tag no longer exists (RR-70). Its
//      import specifier stops resolving for every caller.
//
// A removal is acknowledged by the version bump (below). A removed package
// export can also be acknowledged before the release-prep bump by a pending
// changelog fragment (changes/*.md, `type: changed`, naming the opf package or
// no package) that names the removed specifier, such as
// `@openpresentation/opf/node`: the breaking minor's release note. The
// release-prep pull request bumps the version, which acknowledges it again,
// and assembles the fragment into the changelog.
//
// The working tree (not HEAD) is compared against the tag, so uncommitted
// changes are covered too. Zero external dependencies by design; uses `git`
// via child_process for reading historical state.
//
// Run via `pnpm check:breaking` (root) or `node scripts/check-breaking-changes.mjs`.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(repoRoot, "spec");
// RR-78: the records moved from spec/catalogs to the gallery package; a tag before the move has them at the old path.
const catalogsRoot = path.join(repoRoot, "packages", "gallery", "catalog");
const formerCatalogsRoot = path.join(specRoot, "catalogs");
const schemasRoot = path.join(specRoot, "schemas");
const javascriptPackageJsonPath = path.join(repoRoot, "packages", "javascript", "package.json");
const changesRoot = path.join(repoRoot, "changes");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function displayPath(absolute) {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

const catalogsSubpath = displayPath(catalogsRoot);
const formerCatalogsSubpath = displayPath(formerCatalogsRoot);
const schemasSubpath = displayPath(schemasRoot);

function latestOpfTag() {
  // A publishing tag points at HEAD and must not become its own baseline.
  const currentTags = new Set(git(["tag", "--points-at", "HEAD"]).split("\n"));
  const output = git(["tag", "-l", "opf-v*", "--merged", "HEAD", "--sort=-v:refname"]);
  const [first] = output.split("\n").map((line) => line.trim()).filter((tag) => tag && !currentTags.has(tag));
  return first ?? null;
}

function tagVersion(tag) {
  const match = /^opf-v(.+)$/.exec(tag);
  return match ? match[1] : null;
}

function parseVersion(version) {
  const [major, minor, patch] = version.split(".").map((part) => Number.parseInt(part, 10));
  return {
    major: Number.isNaN(major) ? 0 : major,
    minor: Number.isNaN(minor) ? 0 : minor,
    patch: Number.isNaN(patch) ? 0 : patch,
  };
}

// For 0.x lines, any minor or major bump acknowledges breaking changes; a
// patch bump does not. For 1.x+ lines, only a major bump acknowledges them.
function versionAcknowledgesBreaking(oldVersion, newVersion) {
  const oldV = parseVersion(oldVersion);
  const newV = parseVersion(newVersion);
  if (oldV.major === 0) {
    if (newV.major > oldV.major) return true;
    if (newV.major === oldV.major && newV.minor > oldV.minor) return true;
    return false;
  }
  return newV.major > oldV.major;
}

function listFilesAtTag(tag, subpath) {
  const output = git(["ls-tree", "-r", "--name-only", tag, "--", subpath]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function readJsonAtTag(tag, relPath) {
  const content = git(["show", `${tag}:${relPath}`]);
  return JSON.parse(content);
}

async function readJsonFromWorkingTree(absolutePath) {
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

// Recursively visits every schema node, calling `visit(pathSegments, node)`
// for each object encountered. Skips descending into `examples` arrays since
// they hold arbitrary example data, not schema structure.
function walkSchema(node, pathSegments, visit) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      walkSchema(item, [...pathSegments, String(index)], visit);
    });
    return;
  }
  if (node && typeof node === "object") {
    visit(pathSegments, node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "examples") continue;
      walkSchema(value, [...pathSegments, key], visit);
    }
  }
}

function getAtPath(root, pathSegments) {
  let node = root;
  for (const segment of pathSegments) {
    if (node === undefined || node === null || typeof node !== "object") return undefined;
    node = node[segment];
  }
  return node;
}

function topLevelKeys(schema, key) {
  const value = schema?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

const breaking = [];
const notes = [];
// Removed package exports: { specifier, message }. Acknowledged by the version bump or a changelog fragment (kind 5).
const removedExports = [];

function flagBreaking(message) {
  breaking.push(message);
}

async function checkRemovedCatalogRecords(tag) {
  const oldCatalogFiles = [...listFilesAtTag(tag, formerCatalogsSubpath), ...listFilesAtTag(tag, catalogsSubpath)].filter(
    (relPath) => relPath.endsWith(".json") && !relPath.endsWith("/index.json") && !relPath.endsWith("/manifest.json"),
  );

  for (const relPath of oldCatalogFiles) {
    const parts = relPath.split("/");
    const kind = parts[parts.length - 2];
    const id = parts[parts.length - 1].replace(/\.json$/, "");
    // The same file below the catalog root, wherever the tag had that root.
    const inCatalog = relPath.startsWith(`${formerCatalogsSubpath}/`) ? relPath.slice(formerCatalogsSubpath.length + 1) : relPath.slice(catalogsSubpath.length + 1);
    if (!existsSync(path.join(catalogsRoot, ...inCatalog.split("/")))) {
      flagBreaking(`[record removed] ${kind}/${id} (${relPath} existed at ${tag}, no longer exists under ${catalogsSubpath})`);
    }
  }
}

// Kind 5 (RR-70): an `exports` subpath of the core package that existed at the tag and is gone.
async function checkPackageExports(tag) {
  const relPath = displayPath(javascriptPackageJsonPath);
  let oldManifest;
  try {
    oldManifest = await readJsonAtTag(tag, relPath);
  } catch {
    return;
  }
  const current = await readJsonFromWorkingTree(javascriptPackageJsonPath);
  const keys = (manifest) => (manifest?.exports && typeof manifest.exports === "object" && !Array.isArray(manifest.exports) ? Object.keys(manifest.exports) : []);
  const now = new Set(keys(current));
  for (const subpath of keys(oldManifest)) {
    if (now.has(subpath)) continue;
    const specifier = subpath === "." ? oldManifest.name : `${oldManifest.name}${subpath.slice(1)}`;
    removedExports.push({ specifier, message: `[export removed] ${specifier} (the ${JSON.stringify(subpath)} export of ${relPath} existed at ${tag}, no longer exists)` });
  }
}

// The pending changelog fragments (changes/*.md) of type `changed` for the opf package (or no package): their text.
function acknowledgingFragments(root = changesRoot) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .map((name) => ({ name, text: readFileSync(path.join(root, name), "utf8") }))
    .filter(({ text }) => {
      const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
      const packages = /^packages:\s*\[(.*)\]\s*$/m.exec(front)?.[1];
      return /^type:\s*changed\s*$/m.test(front) && (packages === undefined || packages.trim() === "" || packages.split(",").map((item) => item.trim()).includes("opf"));
    });
}

// A fragment acknowledges a removed specifier when it names it exactly (not as the prefix of a longer specifier).
function fragmentNames(text, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`${escaped}(?![\\w/-])`).test(text);
}

async function checkSchemas(tag) {
  const oldSchemaFiles = listFilesAtTag(tag, schemasSubpath).filter((relPath) => relPath.endsWith(".schema.json"));

  for (const relPath of oldSchemaFiles) {
    const absolutePath = path.join(repoRoot, relPath);
    if (!existsSync(absolutePath)) {
      flagBreaking(`[schema removed] ${relPath} existed at ${tag}, no longer exists`);
      continue;
    }

    const oldSchema = await readJsonAtTag(tag, relPath);
    const newSchema = await readJsonFromWorkingTree(absolutePath);

    // (3) Top-level `properties` / `$defs` entry removed.
    for (const key of ["properties", "$defs"]) {
      const oldKeys = topLevelKeys(oldSchema, key);
      const newKeys = new Set(topLevelKeys(newSchema, key));
      for (const removed of oldKeys) {
        if (!newKeys.has(removed)) {
          flagBreaking(`[${key} removed] ${relPath}: top-level '${key}.${removed}' existed at ${tag}, no longer exists`);
        }
      }
    }

    // (4) Enum narrowed or dropped at the same JSON path.
    const oldEnumNodes = [];
    walkSchema(oldSchema, [], (pathSegments, node) => {
      if (Array.isArray(node.enum)) {
        oldEnumNodes.push({ pathSegments, enumValues: node.enum });
      }
    });

    for (const { pathSegments, enumValues } of oldEnumNodes) {
      const newNode = getAtPath(newSchema, pathSegments);
      if (newNode === undefined || newNode === null || typeof newNode !== "object") {
        // The enclosing node itself is gone. That's only in scope here when
        // it corresponds to a nested (non-top-level) removal we wouldn't
        // otherwise catch above; skip it — out of scope per the narrow
        // top-level-only property/$defs removal rule.
        continue;
      }
      const jsonPath = pathSegments.length > 0 ? pathSegments.join(".") : "(root)";
      const newEnumValues = Array.isArray(newNode.enum) ? newNode.enum : null;
      if (newEnumValues === null) {
        if (enumValues.length > 0) {
          flagBreaking(
            `[enum lost] ${relPath} at '${jsonPath}': enum constraint removed (was: ${JSON.stringify(enumValues)})`,
          );
        }
        continue;
      }
      const missing = enumValues.filter((value) => !newEnumValues.includes(value));
      if (missing.length > 0) {
        flagBreaking(
          `[enum lost] ${relPath} at '${jsonPath}': lost value(s) ${JSON.stringify(missing)} (was: ${JSON.stringify(enumValues)}, now: ${JSON.stringify(newEnumValues)})`,
        );
      }
    }
  }
}

async function main() {
  const tag = latestOpfTag();

  if (!tag) {
    notes.push("No opf-v* tags found; nothing to compare against. Passing.");
    process.stdout.write(`${notes.join("\n")}\n`);
    process.stdout.write(`${JSON.stringify({ valid: true, tag: null }, null, 2)}\n`);
    return;
  }

  await checkRemovedCatalogRecords(tag);
  await checkSchemas(tag);
  await checkPackageExports(tag);

  if (breaking.length === 0 && removedExports.length === 0) {
    process.stdout.write(`${JSON.stringify({ valid: true, tag, breakingChanges: 0 }, null, 2)}\n`);
    return;
  }

  const oldVersion = tagVersion(tag);
  const currentPackageJson = await readJsonFromWorkingTree(javascriptPackageJsonPath);
  const currentVersion = currentPackageJson.version;
  const versionAcknowledged = oldVersion ? versionAcknowledgesBreaking(oldVersion, currentVersion) : false;
  // Kind 5: before the bump, a pending `changed` fragment that names the removed specifier acknowledges it.
  const fragments = acknowledgingFragments();
  const fragmentAcknowledged = [];
  for (const removal of removedExports) {
    const by = fragments.find((fragment) => fragmentNames(fragment.text, removal.specifier));
    if (by && !versionAcknowledged) fragmentAcknowledged.push(`${removal.specifier} (changes/${by.name})`);
    else breaking.push(removal.message);
  }
  if (breaking.length === 0) {
    process.stderr.write(`breaking-change check found ${removedExports.length} removed package export(s) since ${tag}, each named by a pending changelog fragment:\n\n${fragmentAcknowledged.map((item) => `  - [export removed] ${item}\n`).join("")}\n`);
    process.stdout.write(`The release that ships them must be a breaking release: for a 0.x line, a minor or major bump of packages/javascript/package.json (now ${currentVersion}, ${oldVersion} at ${tag}). Passing.\n`);
    process.stdout.write(`${JSON.stringify({ valid: true, tag, breakingChanges: removedExports.length, acknowledgedBy: "changelog-fragment", removedExports: removedExports.map((item) => item.specifier), oldVersion, currentVersion }, null, 2)}\n`);
    return;
  }
  if (fragmentAcknowledged.length) notes.push(`Named by a pending changelog fragment: ${fragmentAcknowledged.join(", ")}.`);
  const acknowledged = versionAcknowledged;

  process.stderr.write(`breaking-change check found ${breaking.length} breaking change(s) since ${tag}:\n\n`);
  for (const item of breaking) {
    process.stderr.write(`  - ${item}\n`);
  }
  process.stderr.write("\n");

  if (acknowledged) {
    process.stdout.write(
      `Breaking changes found, but packages/javascript/package.json version was bumped from ${oldVersion} to ${currentVersion}, which acknowledges them. Passing.\n`,
    );
    process.stdout.write(`${JSON.stringify({ valid: true, tag, breakingChanges: breaking.length, oldVersion, currentVersion }, null, 2)}\n`);
    return;
  }

  process.stderr.write(
    `packages/javascript/package.json is still at ${currentVersion} (compared against ${oldVersion} at ${tag}).\n` +
      `Required: bump the version (for a 0.x line, any minor or major bump; for 1.x+, a major bump) to acknowledge these breaking changes, or revert them.\n` +
      (removedExports.length ? `A removed package export can instead be named, as its import specifier, by a pending changes/*.md fragment of type changed.\n` : ""),
  );
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
