// Detects BREAKING changes in spec/** relative to the most recent `opf-v*`
// git tag, and fails the build unless the pending version bump in
// packages/javascript/package.json acknowledges them.
//
// "Breaking" is scoped narrowly to four kinds of removal — additions are
// never breaking:
//   1. a catalog record file (spec/catalogs/<kind>/<id>.json) that existed at
//      the tag no longer exists (a removed record id).
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
//
// The working tree (not HEAD) is compared against the tag, so uncommitted
// changes are covered too. Zero external dependencies by design; uses `git`
// via child_process for reading historical state.
//
// Run via `pnpm check:breaking` (root) or `node scripts/check-breaking-changes.mjs`.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(repoRoot, "spec");
const catalogsRoot = path.join(specRoot, "catalogs");
const schemasRoot = path.join(specRoot, "schemas");
const javascriptPackageJsonPath = path.join(repoRoot, "packages", "javascript", "package.json");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function displayPath(absolute) {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

const catalogsSubpath = displayPath(catalogsRoot);
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

function flagBreaking(message) {
  breaking.push(message);
}

async function checkRemovedCatalogRecords(tag) {
  const oldCatalogFiles = listFilesAtTag(tag, catalogsSubpath).filter(
    (relPath) => relPath.endsWith(".json") && !relPath.endsWith("/index.json"),
  );

  for (const relPath of oldCatalogFiles) {
    const absolutePath = path.join(repoRoot, relPath);
    if (!existsSync(absolutePath)) {
      const parts = relPath.split("/");
      const kind = parts[parts.length - 2];
      const id = parts[parts.length - 1].replace(/\.json$/, "");
      flagBreaking(`[record removed] ${kind}/${id} (${relPath} existed at ${tag}, no longer exists)`);
    }
  }
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

  if (breaking.length === 0) {
    process.stdout.write(`${JSON.stringify({ valid: true, tag, breakingChanges: 0 }, null, 2)}\n`);
    return;
  }

  const oldVersion = tagVersion(tag);
  const currentPackageJson = await readJsonFromWorkingTree(javascriptPackageJsonPath);
  const currentVersion = currentPackageJson.version;
  const acknowledged = oldVersion ? versionAcknowledgesBreaking(oldVersion, currentVersion) : false;

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
      `Required: bump the version (for a 0.x line, any minor or major bump; for 1.x+, a major bump) to acknowledge these breaking changes, or revert them.\n`,
  );
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
