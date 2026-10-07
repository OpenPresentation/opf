#!/usr/bin/env node
// RR-51: the release train. It does what the supervisor did by hand for the 0.12.0 train (docs/release-process.md,
// "Release train"; ci-cd.md section 9): check the release-prep pull requests, open the next one once its upstream is on
// npm, tag the release commits in lockstep order, wait for each repository's own trusted-publishing workflow and
// verify every registry artefact and its provenance. It never publishes: each package is still published by its own
// repository's workflow through OIDC with --provenance. It creates only tags and pull requests, and never merges.
//
// Every command is a dry run unless --execute is given. Versions are named per package (any subset):
//   --core X.Y.Z  --render X.Y.Z  --pptx X.Y.Z  --editor X.Y.Z  --cli X.Y.Z
//
//   node scripts/release-train.mjs plan [versions] [--json]
//       read only: lockstep order, release-prep PR merged, version at main's head, required checks on the release
//       commit, upstream on npm, dependency floors and the lockstep floor rule (flagged, never decided)
//   node scripts/release-train.mjs prep <package> [versions] [--execute] [--item RR-nn] [--branch b] [--summary s]
//       the release-prep PR of one package once its upstream is on npm: version bump, `changelog-fragments.mjs
//       assemble`, dependency floors, lockfile refresh. Dry run: prepares a scratch clone and prints the diff.
//   node scripts/release-train.mjs tag <package>[@X.Y.Z] [versions] [--execute] [--wait-minutes 90] [--poll-seconds 120]
//                                   [--attest-wait-minutes 15] [--attest-poll-seconds 30]
//       creates refs/tags/<prefix>X.Y.Z on the release commit (re-verified), waits for the publish run, then verifies,
//       waiting up to --attest-wait-minutes for npm to serve the attestation bundle and the install (RR-51)
//   node scripts/release-train.mjs verify <npm name or package>@X.Y.Z [--json] [--wait <minutes>]
//       npm version, gitHead = tagged commit, SLSA provenance (bundle and `npm audit signatures`), GitHub release.
//       Fails fast by default; --wait retries only the two propagation-sensitive checks (404 bundle, notarget install)
//   node scripts/release-train.mjs run [versions] [--execute] [--item RR-nn]
//       the whole sequence in lockstep order; stops at the first step that is not done (a PR to merge, a red check,
//       a failed publish) with the command to resume. Idempotent: a step already done is detected and skipped, and a
//       version already on npm is only verified, never published again.
//
// GitHub access uses the caller's `gh` login (`gh auth token`) or GH_TOKEN / GITHUB_TOKEN. Tags pushed with a
// workflow's GITHUB_TOKEN start no workflow, so the publish workflows only run when a person's token or the GitHub
// App's token (opf#298) creates the tag; .github/workflows/release-train.yml is plan-only without the App.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ancestry, githubApi, OWNER } from "./ecosystem-lock.mjs";

/** The five packages in lockstep order. `upstream` are the packages whose versions this one's floors may name. */
export const PACKAGES = [
  { key: "core", name: "@openpresentation/opf", repo: "opf", manifest: "packages/javascript/package.json", tagPrefix: "opf-v", workflow: "npm-publish.yml", githubRelease: true, changelog: { file: "CHANGELOG.md", package: "opf" }, lockfile: "pnpm", stage: 0, upstream: [] },
  { key: "render", name: "@openpresentation/opf-render", repo: "opf-render", manifest: "package.json", tagPrefix: "opf-render-v", workflow: "npm-publish.yml", githubRelease: false, changelog: { file: "CHANGELOG.md" }, lockfile: "npm", stage: 1, upstream: ["core"] },
  { key: "pptx", name: "@openpresentation/opf-pptx", repo: "opf-pptx", manifest: "package.json", tagPrefix: "opf-pptx-v", workflow: "release.yml", githubRelease: false, changelog: { file: "CHANGELOG.md" }, lockfile: "npm", stage: 2, upstream: ["core", "render"] },
  { key: "editor", name: "@openpresentation/opf-editor", repo: "opf-editor", manifest: "package.json", tagPrefix: "opf-editor-v", workflow: "release.yml", githubRelease: false, changelog: { file: "CHANGELOG.md" }, lockfile: "npm", stage: 3, upstream: ["core", "render", "pptx"] },
  // The CLI bundles core from the workspace (`workspace:*`), so core is upstream for the order only; its floors name
  // the renderer and PPTX (devDependencies pinned exactly, optional peers as ranges, and PEER_RANGES in peers.ts).
  { key: "cli", name: "@openpresentation/cli", repo: "opf", manifest: "packages/cli/package.json", tagPrefix: "cli-v", workflow: "cli-publish.yml", githubRelease: false, changelog: { file: "packages/cli/CHANGELOG.md", package: "cli" }, lockfile: "pnpm", stage: 3, upstream: ["core", "render", "pptx"], peersFile: "packages/cli/src/peers.ts" },
];
export const PACKAGE_KEYS = PACKAGES.map((pkg) => pkg.key);
const SLSA = "https://slsa.dev/provenance/v1";
/** `npm install` output for a version that is in the packument but not yet installable (registry/CDN propagation lag). */
/** Default bound (minutes) on waiting for npm's attestation bundle and installability after a publish (RR-51). */
const ATTEST_WAIT_MINUTES = 15;
const NOT_YET_SERVED = /\bnotarget\b|No matching version found/i;
/** Check runs that are advisory and never gate a release (the merge watcher ignored the same one). */
const ADVISORY_CHECKS = new Set(["Cursor Bugbot"]);
const SCRIPT = "node scripts/release-train.mjs";

/** A package by key ("pptx"), repository ("opf-pptx"; "opf" is core) or npm name. */
export function packageOf(id) {
  const found = PACKAGES.find((pkg) => pkg.key === id || pkg.name === id || (pkg.repo === id && pkg.key !== "cli"));
  if (!found) throw new Error(`unknown package "${id}" (one of ${PACKAGE_KEYS.join(", ")}, a repository name or an npm name)`);
  return found;
}

/** "@openpresentation/opf-pptx@0.12.2" or "pptx@0.12.2" -> { pkg, version }. */
export function parseSpec(spec) {
  const at = spec.lastIndexOf("@");
  if (at <= 0) return { pkg: packageOf(spec), version: undefined };
  return { pkg: packageOf(spec.slice(0, at)), version: spec.slice(at + 1) };
}

export const tagOf = (pkg, version) => `${pkg.tagPrefix}${version}`;

// ---------------------------------------------------------------------------------------------------------------
// Versions and ranges (the forms the five manifests use: exact, ^, ~, >=; anything else is left alone)

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
export function isVersion(text) {
  return VERSION.test(text ?? "");
}

export function compareVersions(a, b) {
  const x = VERSION.exec(a);
  const y = VERSION.exec(b);
  if (!x || !y) throw new Error(`not a version: ${!x ? a : b}`);
  for (let i = 1; i <= 3; i += 1) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) < Number(y[i]) ? -1 : 1;
  if (x[4] === y[4]) return 0;
  if (!x[4]) return 1;
  if (!y[4]) return -1;
  return x[4] < y[4] ? -1 : 1;
}

const RANGE = /^(\^|~|>=|=)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
/** The lowest version a range accepts, or null for forms this tool does not touch (workspace:, *, ||, ...). */
export function floorOf(spec) {
  const match = RANGE.exec(String(spec ?? "").trim());
  return match ? { operator: match[1] ?? "", version: match[2] } : null;
}

/** The range with its floor raised to `version` (same operator), or null when the floor is already there. */
export function raiseRange(spec, version) {
  const floor = floorOf(spec);
  if (!floor || compareVersions(floor.version, version) >= 0) return null;
  return `${floor.operator}${version}`;
}

const DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"];

/** Every @openpresentation dependency of a manifest: [{ field, name, spec }]. */
export function ecosystemDependencies(manifest) {
  const out = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) if (PACKAGES.some((pkg) => pkg.name === name)) out.push({ field, name, spec });
  }
  return out;
}

/** The floors `targets` ({ npm name: version }) raise in a manifest: [{ field, name, from, to }]. */
export function floorChanges(manifest, targets) {
  const changes = [];
  for (const dependency of ecosystemDependencies(manifest)) {
    if (!(dependency.name in targets)) continue;
    const to = raiseRange(dependency.spec, targets[dependency.name]);
    if (to) changes.push({ field: dependency.field, name: dependency.name, from: dependency.spec, to });
  }
  return changes;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Applies a version bump and floor changes to package.json text, editing only those strings so the file keeps its
 * formatting, then checks the result parses to exactly the intended manifest.
 */
export function editManifestText(text, { version, changes = [] }) {
  const before = JSON.parse(text);
  let out = text;
  if (version !== undefined && before.version !== version) {
    const pattern = new RegExp(`("version"\\s*:\\s*")${escapeRegExp(before.version)}(")`);
    if (!pattern.test(out)) throw new Error(`cannot find "version": "${before.version}"`);
    out = out.replace(pattern, `$1${version}$2`);
  }
  for (const change of changes) {
    const open = new RegExp(`"${change.field}"\\s*:\\s*\\{`).exec(out);
    if (!open) throw new Error(`no "${change.field}" block`);
    const start = open.index + open[0].length;
    const end = out.indexOf("}", start);
    const block = out.slice(start, end);
    const entry = new RegExp(`("${escapeRegExp(change.name)}"\\s*:\\s*")${escapeRegExp(change.from)}(")`);
    if (!entry.test(block)) throw new Error(`no "${change.name}": "${change.from}" in "${change.field}"`);
    out = out.slice(0, start) + block.replace(entry, `$1${change.to}$2`) + out.slice(end);
  }
  const expected = JSON.parse(text);
  if (version !== undefined) expected.version = version;
  for (const change of changes) expected[change.field][change.name] = change.to;
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(expected)) throw new Error("the manifest edit changed more than the version and the floors");
  return out;
}

/**
 * RR-55: a sibling whose CI needs a core that is not on npm yet declares `"opf": { "requiresUnreleasedCore": "X.Y.Z" }`
 * in package.json; its CI then skips only the packed install against published core while the installed published core
 * is lower. The field is a pull-request-time device and must never reach a release: `prep` deletes it and `plan`
 * flags a release commit that still carries it.
 */
export function unreleasedCoreOf(manifest) {
  const value = manifest?.opf?.requiresUnreleasedCore;
  return value === undefined ? null : value;
}

const FIELD = String.raw`"requiresUnreleasedCore"\s*:\s*"(?:[^"\\]|\\.)*"`;
const ONLY_FIELD = String.raw`"opf"\s*:\s*\{\s*${FIELD}\s*\}`;
const REMOVALS = [
  // the only key of "opf", which is not the first property: take the comma before it
  new RegExp(String.raw`,\s*${ONLY_FIELD}`),
  // the only key of "opf", which is the first property: take the comma after it
  new RegExp(String.raw`${ONLY_FIELD}\s*,\s*`),
  // "opf" holds other keys too: drop only this property
  new RegExp(String.raw`,\s*${FIELD}(?=\s*\})`),
  new RegExp(String.raw`${FIELD}\s*,\s*`),
  // "opf" is the only property of the manifest
  new RegExp(ONLY_FIELD),
];

/**
 * package.json text without `opf.requiresUnreleasedCore` (and without the `opf` object when that was its only key),
 * keeping the file's formatting. Returns { text, removed } where removed is the field's value, or null when the manifest
 * does not carry it (the text is then returned unchanged).
 */
export function removeUnreleasedCoreText(text) {
  const before = JSON.parse(text);
  const removed = unreleasedCoreOf(before);
  if (removed === null) return { text, removed: null };
  const expected = structuredClone(before);
  delete expected.opf.requiresUnreleasedCore;
  if (Object.keys(expected.opf).length === 0) delete expected.opf;
  for (const pattern of REMOVALS) {
    const out = text.replace(pattern, "");
    if (out === text) continue;
    try {
      if (JSON.stringify(JSON.parse(out)) === JSON.stringify(expected)) return { text: out, removed };
    } catch {
      // try the next form
    }
  }
  throw new Error('cannot remove "opf.requiresUnreleasedCore" from the manifest text without changing anything else');
}

/** The CLI's PEER_RANGES in peers.ts follow its peerDependencies: replaces `"<old>"` for the named constant entries. */
export function editPeersText(text, changes) {
  let out = text;
  const applied = [];
  for (const change of changes.filter((c) => c.field === "peerDependencies")) {
    const constant = change.name === "@openpresentation/opf-render" ? "RENDER_PACKAGE" : change.name === "@openpresentation/opf-pptx" ? "PPTX_PACKAGE" : null;
    if (!constant) continue;
    const pattern = new RegExp(`(\\[${constant}\\]\\s*:\\s*")${escapeRegExp(change.from)}(")`);
    if (pattern.test(out)) {
      out = out.replace(pattern, `$1${change.to}$2`);
      applied.push(change.name);
    }
  }
  return { text: out, applied };
}

/** Versions from argv: { core: "0.12.1", ... } (only the named ones). */
export function trainFromArgs(args) {
  const train = {};
  for (const key of PACKAGE_KEYS) {
    const value = option(args, `--${key}`);
    if (value === undefined) continue;
    if (!isVersion(value)) throw new Error(`--${key} ${value}: not a version`);
    train[key] = value;
  }
  return train;
}

/** The packages of a train in lockstep order. */
export function lockstepOrder(train) {
  return PACKAGES.filter((pkg) => pkg.key in train);
}

export function trainArgs(train) {
  return lockstepOrder(train).map((pkg) => `--${pkg.key} ${train[pkg.key]}`).join(" ");
}

// ---------------------------------------------------------------------------------------------------------------
// npm

/** A minimal npm registry client on fetch. `manifest` returns null for a version the registry does not have. */
export function npmRegistry({ registry = "https://registry.npmjs.org", fetchImpl = globalThis.fetch, exec = run } = {}) {
  const encode = (name) => name.replace("/", "%2f");
  async function get(url) {
    const response = await fetchImpl(url, { headers: { accept: "application/json", "cache-control": "no-cache" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
    return response.json();
  }
  return {
    manifest: (name, version) => get(`${registry}/${encode(name)}/${version}`),
    distTags: async (name) => (await get(`${registry}/-/package/${encode(name)}/dist-tags`)) ?? {},
    attestations: (url) => get(url),
    /** `npm audit signatures` on a scratch project that installs exactly name@version. */
    auditSignatures(name, version, { scratch } = {}) {
      const dir = mkdtempSync(path.join(scratch ?? os.tmpdir(), "release-train-audit-"));
      writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name: "release-train-audit", private: true, dependencies: { [name]: version } }, null, 2)}\n`);
      const install = exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--omit=peer", "--registry", registry], { cwd: dir });
      if (install.status !== 0) {
        const output = `${install.stderr}\n${install.stdout}`;
        // notarget / "No matching version": the packument names a version the registry's install path cannot serve yet.
        return { ok: false, dir, pending: NOT_YET_SERVED.test(output), error: `npm install failed: ${(install.stderr || install.stdout).trim().split("\n").slice(-3).join(" ")}` };
      }
      const audit = exec("npm", ["audit", "signatures", "--json", "--include-attestations", "--registry", registry], { cwd: dir });
      let report;
      try {
        report = JSON.parse(audit.stdout);
      } catch {
        return { ok: false, dir, error: `npm audit signatures printed no JSON (exit ${audit.status}): ${(audit.stderr || audit.stdout).trim().slice(0, 300)}` };
      }
      return { ok: audit.status === 0, dir, report };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// GitHub reads

function decode(content) {
  return Buffer.from(content.content, content.encoding === "base64" ? "base64" : "utf8").toString("utf8");
}

async function fileAt(deps, repo, file, ref) {
  try {
    return decode(await deps.api(`/repos/${OWNER}/${repo}/contents/${file}?ref=${encodeURIComponent(ref)}`));
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function manifestAt(deps, pkg, ref) {
  const text = await fileAt(deps, pkg.repo, pkg.manifest, ref);
  if (text === null) throw new Error(`${pkg.repo}:${pkg.manifest} does not exist at ${ref}`);
  return JSON.parse(text);
}

export async function mainSha(deps, repo) {
  return (await deps.api(`/repos/${OWNER}/${repo}/git/ref/heads/main`)).object.sha;
}

/** The commit a tag names (lightweight or annotated), or null. */
export async function tagCommit(deps, repo, tag) {
  let ref;
  try {
    ref = await deps.api(`/repos/${OWNER}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  if (Array.isArray(ref)) return null; // a prefix match, not this tag
  if (ref.object.type === "tag") return (await deps.api(`/repos/${OWNER}/${repo}/git/tags/${ref.object.sha}`)).object.sha;
  return ref.object.sha;
}

/**
 * The release commit: the oldest commit of the run of manifest commits on `head` that carry `version`, i.e. the commit
 * that set it (the merge commit of the release-prep pull request), with that pull request.
 */
export async function releaseCommit(deps, pkg, version, head) {
  const commits = await deps.api(`/repos/${OWNER}/${pkg.repo}/commits?sha=${head}&path=${encodeURIComponent(pkg.manifest)}&per_page=20`);
  let found = null;
  for (const commit of commits) {
    if ((await manifestAt(deps, pkg, commit.sha)).version !== version) break;
    found = commit.sha;
  }
  if (!found) return null;
  const pulls = await deps.api(`/repos/${OWNER}/${pkg.repo}/commits/${found}/pulls`);
  const pull = pulls.find((p) => p.merged_at && p.base?.ref === "main") ?? null;
  return { sha: found, pull: pull && { number: pull.number, url: pull.html_url, title: pull.title } };
}

/** Names a release-prep PR title uses for each package ("RR-20: release core 0.12.0", "RR-17: release opf-pptx 0.12.2"). */
const TITLE_NAMES = {
  core: ["core", "opf", "@openpresentation/opf"],
  render: ["opf-render", "render", "renderer", "@openpresentation/opf-render"],
  pptx: ["opf-pptx", "pptx", "@openpresentation/opf-pptx"],
  editor: ["opf-editor", "editor", "@openpresentation/opf-editor"],
  cli: ["cli", "@openpresentation/cli"],
};

/** Whether a PR title announces the release of pkg@version: "release <name> <version>" with nothing in between. */
export function isPrepTitle(pkg, version, title) {
  const names = TITLE_NAMES[pkg.key].map(escapeRegExp).join("|");
  return new RegExp(`\\brelease\\s+(?:${names})\\s+v?${escapeRegExp(version)}(?![\\w.-])`, "i").test(title);
}

/** The open release-prep pull request of pkg@version (by its branch or its title), or null. */
export async function openPrepPull(deps, pkg, version) {
  const pulls = await deps.api(`/repos/${OWNER}/${pkg.repo}/pulls?state=open&base=main&per_page=100`);
  const branch = defaultBranch(pkg, version);
  const pull = pulls.find((p) => p.head?.ref === branch) ?? pulls.find((p) => isPrepTitle(pkg, version, p.title));
  return pull ? { number: pull.number, url: pull.html_url, title: pull.title, branch: pull.head.ref, sha: pull.head.sha } : null;
}

/** Required status checks of main (rulesets), or [] when the repository has none. */
async function requiredChecks(deps, repo) {
  try {
    const rules = await deps.api(`/repos/${OWNER}/${repo}/rules/branches/main`);
    return [...new Set(rules.filter((rule) => rule.type === "required_status_checks").flatMap((rule) => rule.parameters.required_status_checks.map((check) => check.context)))];
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
}

/**
 * The checks on a commit: the latest run per check name plus commit statuses. With required checks (a ruleset), each
 * must have passed; without, every reported check must have passed and there must be at least one.
 * Returns { state: "green" | "pending" | "red", required, failing, pending, missing }.
 */
export async function commitChecks(deps, repo, sha) {
  const required = await requiredChecks(deps, repo);
  const runs = (await deps.api(`/repos/${OWNER}/${repo}/commits/${sha}/check-runs?per_page=100`)).check_runs ?? [];
  const latest = new Map();
  for (const run of runs) {
    if (ADVISORY_CHECKS.has(run.name)) continue;
    const seen = latest.get(run.name);
    if (!seen || (run.started_at ?? "") > (seen.started_at ?? "")) latest.set(run.name, run);
  }
  const results = new Map([...latest].map(([name, run]) => [name, run.status !== "completed" ? "pending" : ["success", "skipped", "neutral"].includes(run.conclusion) ? "success" : "failure"]));
  const statuses = (await deps.api(`/repos/${OWNER}/${repo}/commits/${sha}/status`)).statuses ?? [];
  for (const status of statuses) if (!results.has(status.context)) results.set(status.context, status.state === "success" ? "success" : status.state === "pending" ? "pending" : "failure");
  const names = required.length ? required : [...results.keys()];
  const failing = names.filter((name) => results.get(name) === "failure");
  const pending = names.filter((name) => results.get(name) === "pending");
  const missing = required.filter((name) => !results.has(name));
  const advisoryFailing = required.length ? [...results].filter(([name, result]) => !required.includes(name) && result === "failure").map(([name]) => name) : [];
  let state = "green";
  if (failing.length) state = "red";
  else if (pending.length || missing.length || !names.length) state = "pending";
  return { state, required, failing, pending, missing, advisoryFailing, total: results.size };
}

function checksLine(checks) {
  if (checks.state === "green") return `green (${checks.required.length ? `${checks.required.length} required checks` : `${checks.total} checks, no ruleset`})`;
  const parts = [];
  if (checks.failing.length) parts.push(`failing: ${checks.failing.join(", ")}`);
  if (checks.pending.length) parts.push(`running: ${checks.pending.join(", ")}`);
  if (checks.missing.length) parts.push(`not reported: ${checks.missing.join(", ")}`);
  if (!parts.length) parts.push("no checks reported");
  return `${checks.state} (${parts.join("; ")})`;
}

// ---------------------------------------------------------------------------------------------------------------
// Lockstep floors

const GEOMETRY_HINT = /geometr|composition|compos(?:e|ed|es)\b|output-changing|layout|cover centering|font size/i;

/** Core's release notes (the assembled section, or the pending fragments while core is not merged) that hint at geometry. */
async function coreGeometryHints(deps, version, ref, merged) {
  if (merged) {
    const changelog = (await fileAt(deps, "opf", "CHANGELOG.md", ref)) ?? "";
    const section = new RegExp(`^## ${escapeRegExp(version)}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(changelog)?.[1] ?? "";
    return section.split("\n").filter((line) => /^- /.test(line) && GEOMETRY_HINT.test(line)).map((line) => `CHANGELOG ${version}: ${line.slice(2, 140)}`);
  }
  let listing;
  try {
    listing = await deps.api(`/repos/${OWNER}/opf/contents/changes?ref=${ref}`);
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
  const hints = [];
  for (const entry of listing.filter((item) => item.type === "file" && item.name.endsWith(".md") && item.name !== "README.md")) {
    const text = (await fileAt(deps, "opf", `changes/${entry.name}`, ref)) ?? "";
    const packages = /^packages:\s*\[(.*)\]\s*$/m.exec(text)?.[1] ?? "";
    if (packages.trim() && !packages.split(",").map((p) => p.trim()).includes("opf")) continue;
    if (GEOMETRY_HINT.test(text)) hints.push(`changes/${entry.name}`);
  }
  return hints;
}

/**
 * The lockstep rule (docs/release-process.md, "Geometry-moving core releases"): when core moves geometry, the renderer,
 * PPTX and the editor must raise their core floor to it in the same train. The tool cannot know whether a core release
 * moves geometry, so it flags every sibling whose core floor stays below the new core and leaves the decision to the
 * release owner. `floors` is { key: { spec, planned } } for render, pptx and editor.
 */
export function lockstepFlags(train, floors, hints = []) {
  if (!train.core) return [];
  const flags = [];
  for (const key of ["render", "pptx", "editor"]) {
    const floor = floors[key];
    if (!floor) continue;
    const planned = floorOf(floor.planned ?? floor.spec);
    if (planned && compareVersions(planned.version, train.core) >= 0) continue;
    const pkg = packageOf(key);
    const where = key in train ? `stays ${floor.planned ?? floor.spec} in its release ${train[key]}` : `is ${floor.spec} and ${pkg.repo} is not in the train`;
    flags.push(
      `${pkg.repo}: its core floor ${where}. If core ${train.core} moves geometry, the lockstep rule requires ${pkg.repo} (and the other siblings) to raise it to ^${train.core} in this train.${hints.length ? ` Hints in core's notes: ${hints.join("; ")}.` : ""}`,
    );
  }
  return flags;
}

// ---------------------------------------------------------------------------------------------------------------
// plan

/** The state of one package of the train (read only). */
export async function packageState(deps, pkg, version, train) {
  const tag = tagOf(pkg, version);
  const state = { key: pkg.key, name: pkg.name, repo: pkg.repo, version, tag, problems: [], notes: [] };
  state.published = Boolean(await deps.npm.manifest(pkg.name, version));
  state.tagCommit = await tagCommit(deps, pkg.repo, tag);
  state.head = await mainSha(deps, pkg.repo);
  const headManifest = await manifestAt(deps, pkg, state.head);
  state.headVersion = headManifest.version;
  state.manifest = headManifest;
  if (state.published) {
    state.step = "published";
    if (!state.tagCommit) state.problems.push(`${pkg.name}@${version} is on npm but the tag ${tag} does not exist`);
    return state;
  }
  const order = compareVersions(state.headVersion, version);
  if (order > 0) {
    state.step = "superseded";
    state.problems.push(`main already carries ${pkg.name} ${state.headVersion}, newer than ${version}`);
    return state;
  }
  if (order < 0) {
    state.merged = false;
    state.pull = await openPrepPull(deps, pkg, version);
    state.step = state.pull ? "prep-open" : "prep-needed";
    const targets = upstreamTargets(pkg, train);
    state.floorChanges = floorChanges(headManifest, targets);
    const pending = unreleasedCoreOf(headManifest);
    if (pending !== null) {
      const tooHigh = train.core && isVersion(pending) && compareVersions(pending, train.core) > 0;
      state.notes.push(`main's ${pkg.manifest} declares opf.requiresUnreleasedCore ${pending}; the release-prep PR deletes it${tooHigh ? `, but core ${train.core} of this train is below it, so \`prep\` stops` : ""}`);
    }
    if (state.pull) state.notes.push(`release-prep PR open: ${state.pull.url} (merge it once its CI is green)`);
    else state.notes.push(`no release-prep PR: main carries ${state.headVersion}; \`prep ${pkg.key}\` opens it${state.floorChanges.length ? ` and raises ${state.floorChanges.map((c) => `${c.name} ${c.from} -> ${c.to}`).join(", ")}` : ""}`);
    return state;
  }
  state.merged = true;
  const release = await releaseCommit(deps, pkg, version, state.head);
  state.release = release;
  if (!release) {
    state.problems.push(`cannot find the commit that set ${version} in ${pkg.manifest}`);
    state.step = "blocked";
    return state;
  }
  if (!release.pull) state.notes.push(`the release commit ${release.sha.slice(0, 12)} has no merged pull request (pushed directly?)`);
  if (state.head !== release.sha) state.notes.push(`main moved on after the release commit (${release.sha.slice(0, 12)} -> ${state.head.slice(0, 12)}); the tag goes on the release commit`);
  if (state.tagCommit && state.tagCommit !== release.sha) state.problems.push(`the tag ${tag} exists on ${state.tagCommit.slice(0, 12)}, not on the release commit ${release.sha.slice(0, 12)}`);
  state.checks = await commitChecks(deps, pkg.repo, release.sha);
  if (state.checks.state === "red") state.problems.push(`checks on the release commit ${release.sha.slice(0, 12)}: ${checksLine(state.checks)}`);
  else if (state.checks.state === "pending") state.notes.push(`checks on the release commit ${release.sha.slice(0, 12)}: ${checksLine(state.checks)}`);
  if (state.checks.advisoryFailing.length) state.notes.push(`non-required checks failing on the release commit: ${state.checks.advisoryFailing.join(", ")}`);
  const releaseManifest = release.sha === state.head ? headManifest : await manifestAt(deps, pkg, release.sha);
  state.manifest = releaseManifest;
  const stillDeclared = unreleasedCoreOf(releaseManifest);
  if (stillDeclared !== null) state.problems.push(`the release commit keeps opf.requiresUnreleasedCore ${stillDeclared} in ${pkg.manifest}; the field is for pull requests and must be deleted before a release (\`prep\` removes it)`);
  const lagging = floorChanges(releaseManifest, upstreamTargets(pkg, train));
  for (const change of lagging) state.problems.push(`the release commit keeps ${change.field} ${change.name} ${change.from}, below the train's ${change.to.replace(/^[^\d]*/, "")}`);
  state.step = state.tagCommit ? "tagged" : "ready-to-tag";
  return state;
}

/** { npm name: version } for the upstream packages of `pkg` that the train releases. */
export function upstreamTargets(pkg, train) {
  return Object.fromEntries(pkg.upstream.filter((key) => key in train).map((key) => [packageOf(key).name, train[key]]));
}

/** Upstream packages of `pkg` in the train that are not on npm yet. */
async function missingUpstream(deps, pkg, train) {
  const missing = [];
  for (const key of pkg.upstream.filter((k) => k in train)) {
    const up = packageOf(key);
    if (!(await deps.npm.manifest(up.name, train[key]))) missing.push(`${up.name}@${train[key]}`);
  }
  return missing;
}

/** Every floor in a manifest that names a version npm does not have (it would publish an uninstallable package). */
async function unpublishedFloors(deps, manifest) {
  const out = [];
  for (const dependency of ecosystemDependencies(manifest)) {
    if (dependency.field === "devDependencies") continue;
    const floor = floorOf(dependency.spec);
    if (floor && !(await deps.npm.manifest(dependency.name, floor.version))) out.push(`${dependency.field} ${dependency.name} ${dependency.spec}`);
  }
  return out;
}

export async function plan(deps, train) {
  const order = lockstepOrder(train);
  if (!order.length) throw new Error(`name at least one version (${PACKAGE_KEYS.map((key) => `--${key} X.Y.Z`).join(" ")})`);
  const states = [];
  for (const pkg of order) {
    const state = await packageState(deps, pkg, train[pkg.key], train);
    if (state.step !== "published") {
      const missing = await missingUpstream(deps, pkg, train);
      if (missing.length) {
        state.waitsFor = missing;
        state.notes.push(`waits for ${missing.join(", ")} on npm`);
      }
      if (state.merged) {
        const unpublished = await unpublishedFloors(deps, state.manifest);
        const own = unpublished.filter((line) => !missing.some((m) => line.includes(m.slice(0, m.lastIndexOf("@")))));
        for (const line of own) state.problems.push(`${line} names a version npm does not have`);
      }
    }
    states.push(state);
  }
  // Lockstep floors of the siblings (whether or not they are in the train).
  const floors = {};
  for (const key of ["render", "pptx", "editor"]) {
    const pkg = packageOf(key);
    const state = states.find((s) => s.key === key);
    const manifest = state?.manifest ?? (await manifestAt(deps, pkg, await mainSha(deps, pkg.repo)));
    const spec = manifest.dependencies?.["@openpresentation/opf"];
    if (!spec) continue;
    const planned = state && state.merged === false ? (raiseRange(spec, train.core ?? "0.0.0") ?? spec) : spec;
    floors[key] = { spec, planned };
  }
  let hints = [];
  if (train.core) {
    const core = states.find((s) => s.key === "core");
    hints = await coreGeometryHints(deps, train.core, core.release?.sha ?? core.head, Boolean(core.merged || core.step === "published"));
  }
  const flags = lockstepFlags(train, floors, hints);
  return { train, order: order.map((pkg) => pkg.key), states, flags, ready: states.every((s) => !s.problems.length) };
}

export function formatPlan(result) {
  const lines = [`Release train (lockstep order): ${result.order.map((key) => `${packageOf(key).name}@${result.train[key]}`).join(" -> ")}`, ""];
  const label = {
    published: "on npm (verify only)",
    tagged: "tagged, not on npm yet (publish run pending or failed)",
    "ready-to-tag": "merged; ready to tag",
    "prep-open": "release-prep PR open, not merged",
    "prep-needed": "release-prep PR missing",
    superseded: "superseded",
    blocked: "blocked",
  };
  for (const state of result.states) {
    lines.push(`${state.name}@${state.version} [${state.repo}, tag ${state.tag}]: ${label[state.step] ?? state.step}`);
    lines.push(`  main ${state.head.slice(0, 12)} carries ${state.headVersion}${state.release ? `; release commit ${state.release.sha.slice(0, 12)}${state.release.pull ? ` (#${state.release.pull.number})` : ""}` : ""}${state.tagCommit ? `; tag on ${state.tagCommit.slice(0, 12)}` : ""}`);
    if (state.checks) lines.push(`  checks: ${checksLine(state.checks)}`);
    for (const problem of state.problems) lines.push(`  MISSING: ${problem}`);
    for (const note of state.notes) lines.push(`  note: ${note}`);
  }
  if (result.flags.length) {
    lines.push("", "Lockstep floors (flagged for the release owner, not decided by the tool):");
    for (const flag of result.flags) lines.push(`  FLAG: ${flag}`);
  }
  const next = nextStep(result);
  lines.push("", next ? `Next: ${next}` : "Nothing left: every package is on npm. Run `verify` for each, then the follow-up docs PR (release-plan.json, compatibility matrix, quickstart).");
  return lines.join("\n");
}

/** The next action of a planned train, as text, or null when every package is on npm. */
export function nextStep(result) {
  const args = trainArgs(result.train);
  for (const state of result.states) {
    if (state.problems.length) return `fix ${state.name}@${state.version}: ${state.problems[0]}`;
    if (state.step === "published") continue;
    if (state.waitsFor?.length) return `${state.name}@${state.version} waits for ${state.waitsFor.join(", ")} on npm (release the upstream first)`;
    if (state.step === "prep-needed") return `${SCRIPT} prep ${state.key} ${args} --execute`;
    if (state.step === "prep-open") return `get ${state.pull.url} green and merge it, then ${SCRIPT} run ${args} --execute`;
    if (state.step === "ready-to-tag" || state.step === "tagged") {
      if (state.checks?.state !== "green") return `wait for the checks on ${state.repo}@${state.release.sha.slice(0, 12)} (${checksLine(state.checks)})`;
      return `${SCRIPT} tag ${state.key} ${args} --execute`;
    }
    return `resolve ${state.name}@${state.version} (${state.step})`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// verify

/**
 * Retries `probe` while it reports { pending: true } (npm has not propagated what the packument already names), every
 * `pollSeconds` for at most `waitMinutes`. Anything else, including a present-but-wrong result, returns at once.
 * With waitMinutes 0 it probes once. A result still pending at the deadline comes back with `timedOut: true`.
 */
async function settle(deps, what, probe, { waitMinutes = 0, pollSeconds = 30 } = {}) {
  const deadline = deps.now() + waitMinutes * 60_000;
  for (;;) {
    const result = await probe();
    if (!result.pending) return result;
    if (deps.now() >= deadline) return { ...result, timedOut: waitMinutes > 0 };
    deps.log(`waiting for npm to propagate ${what} (${result.detail})...`);
    await deps.sleep(pollSeconds * 1000);
  }
}

const pendingNote = (result, waitMinutes) => (result.timedOut ? ` (still not propagated after ${waitMinutes} min)` : "");

/**
 * Checks one published package. Returns { ok, checks: [{ name, ok, detail }] }.
 * The attestation bundle and the scratch install behind `npm audit signatures` lag the packument by minutes on a fresh
 * publish (HTTP 404 / notarget). With `waitMinutes` > 0 only those two are retried while they report "not yet there";
 * a bundle that is there but wrong, or an invalid signature, fails at once. Standalone verify defaults to no wait.
 */
export async function verify(deps, pkg, version, { auditSignatures = true, waitMinutes = 0, pollSeconds = 30 } = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const patience = { waitMinutes, pollSeconds };
  const tag = tagOf(pkg, version);
  const manifest = await deps.npm.manifest(pkg.name, version);
  if (!manifest) {
    add("npm version", false, `${pkg.name}@${version} is not on the registry`);
    return { ok: false, checks };
  }
  add("npm version", manifest.version === version, `${pkg.name}@${manifest.version}, integrity ${manifest.dist?.integrity ?? "none"}`);
  const commit = await tagCommit(deps, pkg.repo, tag);
  add("tag", Boolean(commit), commit ? `${OWNER}/${pkg.repo} ${tag} -> ${commit}` : `${OWNER}/${pkg.repo} has no tag ${tag}`);
  add("gitHead", Boolean(commit) && manifest.gitHead === commit, `gitHead ${manifest.gitHead ?? "missing"}${commit ? ` ${manifest.gitHead === commit ? "=" : "!="} tag commit ${commit}` : ""}`);
  if (commit) {
    const onMain = await ancestry(deps.api, pkg.repo, commit);
    add("tag on main", onMain.onBranch, `${commit.slice(0, 12)} is ${onMain.onBranch ? "" : "not "}on ${pkg.repo} main (${onMain.status})`);
    const tagged = await manifestAt(deps, pkg, commit);
    add("version at tag", tagged.version === version, `${pkg.manifest} at ${commit.slice(0, 12)} carries ${tagged.version}`);
  }
  const attestations = manifest.dist?.attestations;
  add("dist.attestations", attestations?.provenance?.predicateType === SLSA, attestations ? `${attestations.provenance?.predicateType ?? "no provenance predicate"} (${attestations.url})` : "the registry lists no attestations");
  if (attestations?.url) {
    // A 404 (null) is the registry not serving the bundle yet; a bundle that arrives is judged at once.
    const fetched = await settle(
      deps,
      `the attestation bundle of ${pkg.name}@${version}`,
      async () => {
        const bundle = await deps.npm.attestations(attestations.url);
        return bundle ? { bundle } : { pending: true, detail: `HTTP 404 from ${attestations.url}` };
      },
      patience,
    );
    const slsa = (fetched.bundle?.attestations ?? []).find((entry) => entry.predicateType === SLSA);
    if (fetched.pending) add("SLSA provenance", false, `the attestation bundle is not served yet (HTTP 404)${pendingNote(fetched, waitMinutes)}`);
    else if (!slsa) add("SLSA provenance", false, "no SLSA provenance in the attestation bundle");
    else {
      const statement = JSON.parse(Buffer.from(slsa.bundle.dsseEnvelope.payload, "base64").toString("utf8"));
      const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow ?? {};
      const source = statement.predicate?.buildDefinition?.resolvedDependencies?.[0]?.digest?.gitCommit;
      const integrity = manifest.dist?.integrity?.startsWith("sha512-") ? Buffer.from(manifest.dist.integrity.slice(7), "base64").toString("hex") : null;
      const subject = statement.subject?.[0]?.digest?.sha512;
      const expected = { repository: `https://github.com/${OWNER}/${pkg.repo}`, path: `.github/workflows/${pkg.workflow}`, ref: `refs/tags/${tag}` };
      const problems = [];
      if (workflow.repository !== expected.repository) problems.push(`repository ${workflow.repository}`);
      if (workflow.path !== expected.path) problems.push(`workflow ${workflow.path}`);
      if (workflow.ref !== expected.ref) problems.push(`ref ${workflow.ref}`);
      if (!commit || source !== commit) problems.push(`source commit ${source}`);
      if (!integrity || subject !== integrity) problems.push("subject digest differs from dist.integrity");
      const run = statement.predicate?.runDetails?.metadata?.invocationId;
      add("SLSA provenance", problems.length === 0, problems.length ? `does not match: ${problems.join(", ")}` : `built by ${expected.path} on ${expected.ref} from ${source.slice(0, 12)}${run ? ` (${run})` : ""}`);
    }
  }
  if (auditSignatures) {
    // notarget / "No matching version" on the scratch install is propagation lag; any other failure is final.
    const audit = await settle(
      deps,
      `${pkg.name}@${version} for \`npm audit signatures\``,
      async () => {
        const result = deps.npm.auditSignatures(pkg.name, version, { scratch: deps.scratch });
        return result.pending ? { ...result, detail: result.error } : result;
      },
      patience,
    );
    if (!audit.report) add("npm audit signatures", false, `${audit.error}${pendingNote(audit, waitMinutes)}`);
    else {
      const own = (audit.report.verified ?? []).find((entry) => entry.name === pkg.name && entry.version === version);
      const invalid = audit.report.invalid ?? [];
      const missing = audit.report.missing ?? [];
      const ok = audit.ok && invalid.length === 0 && missing.length === 0 && Boolean(own?.attestations);
      add("npm audit signatures", ok, `${(audit.report.verified ?? []).length} verified, ${invalid.length} invalid, ${missing.length} missing; ${pkg.name}@${version} ${own?.attestations ? "has a verified attestation" : "has no verified attestation"}`);
    }
  }
  if (pkg.githubRelease) {
    let release = null;
    try {
      release = await deps.api(`/repos/${OWNER}/${pkg.repo}/releases/tags/${encodeURIComponent(tag)}`);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    add("GitHub release", Boolean(release) && !release.draft, release ? `${release.html_url}${release.draft ? " (draft)" : ""}` : `no release for ${tag} (create it from the CHANGELOG section, docs/release-process.md)`);
  } else {
    add("GitHub release", true, `not created by ${pkg.repo}'s ${pkg.workflow} (none expected)`);
  }
  const tags = await deps.npm.distTags(pkg.name);
  checks.push({ name: "dist-tag", ok: true, info: true, detail: tags.latest === version ? "latest" : `latest is ${tags.latest} (${version} is not latest)` });
  return { ok: checks.every((check) => check.ok), checks };
}

export function formatVerify(pkg, version, result) {
  return [`${pkg.name}@${version}: ${result.ok ? "verified" : "NOT verified"}`, ...result.checks.map((check) => `  ${check.info ? "info" : check.ok ? "ok  " : "FAIL"} ${check.name}: ${check.detail}`)].join("\n");
}

// ---------------------------------------------------------------------------------------------------------------
// tag

async function pollUntil(deps, what, probe, { waitMinutes, pollSeconds }) {
  const deadline = deps.now() + waitMinutes * 60_000;
  for (;;) {
    const result = await probe();
    if (result.done) return result;
    if (deps.now() >= deadline) throw new TrainStop(`timed out after ${waitMinutes} min waiting for ${what}${result.detail ? ` (${result.detail})` : ""}`);
    deps.log(`waiting for ${what}${result.detail ? ` (${result.detail})` : ""}...`);
    await deps.sleep(pollSeconds * 1000);
  }
}

export class TrainStop extends Error {}

/** The publish workflow run for a tag, or null. */
async function publishRun(deps, pkg, tag, sha) {
  const list = await deps.api(`/repos/${OWNER}/${pkg.repo}/actions/workflows/${pkg.workflow}/runs?event=push&branch=${encodeURIComponent(tag)}&per_page=10`);
  return (list.workflow_runs ?? []).find((run) => run.head_branch === tag && run.head_sha === sha) ?? null;
}

/**
 * Tags the release commit of pkg@version, waits for its publish run and the registry, then verifies. Re-verifies
 * everything first; skips what is done. Returns { status, ... }; throws TrainStop when it cannot go on.
 */
export async function tagRelease(deps, pkg, version, train, { execute = false, waitMinutes = 90, pollSeconds = 120, npmPollSeconds = 30, attestWaitMinutes = ATTEST_WAIT_MINUTES, attestPollSeconds = 30 } = {}) {
  const tag = tagOf(pkg, version);
  const state = await packageState(deps, pkg, version, { ...train, [pkg.key]: version });
  if (state.step === "published") {
    deps.log(`${pkg.name}@${version} is already on npm: nothing to tag or publish.`);
    return { status: "published", state };
  }
  if (state.problems.length) throw new TrainStop(`${pkg.name}@${version}: ${state.problems.join("; ")}`);
  if (state.merged !== true) throw new TrainStop(`${pkg.name}@${version}: the release-prep PR is not merged (${state.notes.join("; ")})`);
  const missing = await missingUpstream(deps, pkg, train);
  if (missing.length) throw new TrainStop(`${pkg.name}@${version} waits for ${missing.join(", ")} on npm; tag the upstream first`);
  const unpublished = await unpublishedFloors(deps, state.manifest);
  if (unpublished.length) throw new TrainStop(`${pkg.name}@${version}: ${unpublished.join(", ")} names a version npm does not have`);
  const sha = state.release.sha;
  // Re-verify at the commit itself, right before tagging: the version, and that the commit is on main.
  const atCommit = await manifestAt(deps, pkg, sha);
  if (atCommit.version !== version) throw new TrainStop(`${pkg.manifest} at ${sha.slice(0, 12)} carries ${atCommit.version}, not ${version}`);
  const onMain = await ancestry(deps.api, pkg.repo, sha);
  if (!onMain.onBranch) throw new TrainStop(`${sha.slice(0, 12)} is not on ${pkg.repo} main (${onMain.status})`);
  if (state.checks.state !== "green") throw new TrainStop(`checks on ${pkg.repo}@${sha.slice(0, 12)} are ${checksLine(state.checks)}; tag once they are green`);
  if (!state.tagCommit) {
    if (!execute) {
      deps.log(`dry run: would create refs/tags/${tag} on ${OWNER}/${pkg.repo}@${sha} (${pkg.manifest} carries ${version}; checks ${checksLine(state.checks)}), then wait for ${pkg.workflow}. Pass --execute.`);
      return { status: "dry-run", sha, tag };
    }
    await deps.api(`/repos/${OWNER}/${pkg.repo}/git/refs`, { method: "POST", body: { ref: `refs/tags/${tag}`, sha } });
    deps.log(`created ${tag} on ${OWNER}/${pkg.repo}@${sha.slice(0, 12)}`);
  } else {
    deps.log(`${tag} already exists on the release commit ${sha.slice(0, 12)}; waiting for its publish run.`);
    if (!execute) return { status: "dry-run", sha, tag, tagged: true };
  }
  const run = await pollUntil(
    deps,
    `${pkg.repo} ${pkg.workflow} on ${tag}`,
    async () => {
      const found = await publishRun(deps, pkg, tag, sha);
      if (!found) return { done: false, detail: "not started" };
      return found.status === "completed" ? { done: true, run: found } : { done: false, detail: `${found.status}, ${found.html_url}` };
    },
    { waitMinutes, pollSeconds },
  );
  if (run.run.conclusion !== "success") {
    if (await deps.npm.manifest(pkg.name, version)) deps.log(`the publish run ended ${run.run.conclusion} after npm accepted ${version} (${run.run.html_url}); verifying.`);
    else
      throw new TrainStop(
        `the publish run for ${tag} ended ${run.run.conclusion}: ${run.run.html_url}. Do not move or re-push the tag. A transient failure: \`gh run rerun ${run.run.id} --failed -R ${OWNER}/${pkg.repo}\`, then resume. A real failure: fix it on main and release a new version.`,
      );
  }
  await pollUntil(deps, `${pkg.name}@${version} on the registry`, async () => ({ done: Boolean(await deps.npm.manifest(pkg.name, version)) }), { waitMinutes: 30, pollSeconds: npmPollSeconds });
  // The version is visible, but its attestation bundle and installability can lag by minutes: wait for those only.
  const verified = await verify(deps, pkg, version, { waitMinutes: attestWaitMinutes, pollSeconds: attestPollSeconds });
  deps.log(formatVerify(pkg, version, verified));
  if (!verified.ok) throw new TrainStop(`${pkg.name}@${version} is on npm but did not verify (see above)`);
  return { status: "released", sha, tag, run: run.run.html_url, verified };
}

// ---------------------------------------------------------------------------------------------------------------
// prep

export function defaultBranch(pkg, version) {
  return `codex/release-${pkg.key}-${version.replaceAll(".", "-")}`;
}

/** Files a release-prep PR may change (docs/release-process.md: versions, changelog, ranges, lockfile). */
export function allowedPrepFile(pkg, file) {
  if (file === pkg.manifest || file === pkg.changelog.file || /^changes\/[^/]+\.md$/.test(file)) return true;
  if (file === (pkg.lockfile === "pnpm" ? "pnpm-lock.yaml" : "package-lock.json")) return true;
  return Boolean(pkg.peersFile && file === pkg.peersFile);
}

/** Lines of the package's README that name the previous version: a person decides whether they need an edit. */
function proseMentions(dir, pkg, previous) {
  const readme = path.join(dir, path.dirname(pkg.manifest), "README.md");
  if (!existsSync(readme)) return [];
  const pattern = new RegExp(`\\b${escapeRegExp(previous)}\\b`);
  return readFileSync(readme, "utf8")
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((entry) => pattern.test(entry.text))
    .map((entry) => `${path.relative(dir, readme)}:${entry.line}`);
}

/** Fragments left in changes/ that still name this package (the assembler should have taken them all). */
function leftoverFragments(dir, pkg) {
  const changes = path.join(dir, "changes");
  if (!existsSync(changes)) return [];
  const config = existsSync(path.join(changes, "config.json")) ? JSON.parse(readFileSync(path.join(changes, "config.json"), "utf8")) : { default: "" };
  const target = pkg.changelog.package ?? "";
  return readdirSync(changes)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .filter((name) => {
      const packages = /^packages:\s*\[(.*)\]\s*$/m.exec(readFileSync(path.join(changes, name), "utf8"))?.[1];
      const list = (packages ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      return list.includes(target) || (list.length === 0 && (config.default ?? "") === target);
    });
}

function must(result, what) {
  if (result.status !== 0) throw new Error(`${what} failed (exit ${result.status}): ${(result.stderr || result.stdout || "").trim().split("\n").slice(-5).join("\n")}`);
  return result.stdout ?? "";
}

export function prepBody({ pkg, version, previous, item, changes, fragments, prose, summary, train, removedField = null }) {
  const floors = changes.length ? changes.map((c) => `| \`${c.field}\` | \`${c.name}\` | \`${c.from}\` | \`${c.to}\` |`).join("\n") : "";
  return `${item ? `${item}: ` : ""}release-prep PR for ${pkg.name} ${version} (from ${previous}), opened by \`scripts/release-train.mjs prep\` (RR-51).

- \`${pkg.manifest}\`: version ${previous} -> ${version}.
- \`${pkg.changelog.file}\`: \`node scripts/changelog-fragments.mjs assemble --version ${version}${pkg.changelog.package ? ` --package ${pkg.changelog.package}` : ""}\` moved ${fragments} fragment(s) into the release section.${summary ? ` Summary: ${summary}` : ""}
- Lockfile refreshed with \`${pkg.lockfile === "pnpm" ? "pnpm install --lockfile-only" : "npm install --package-lock-only"}\` against the registry.${removedField ? `
- \`${pkg.manifest}\`: \`opf.requiresUnreleasedCore\` (${removedField}) deleted; it gated CI's packed install on a core that was not yet published, and must not reach a release.` : ""}
${changes.length ? `
Dependency floors raised to the train's versions (each already on npm):

| field | package | from | to |
|---|---|---|---|
${floors}
` : "\nNo dependency floor changes.\n"}${pkg.peersFile && changes.some((c) => c.field === "peerDependencies") ? `\n\`${pkg.peersFile}\` PEER_RANGES follow the peer ranges.\n` : ""}
${prose.length ? `Prose that names ${previous} (review by hand; the tool does not rewrite it): ${prose.map((p) => `\`${p}\``).join(", ")}.\n` : ""}
Train: \`${trainArgs(train)}\`. Merge only after CI is green; the train then tags the merge commit:
\`node scripts/release-train.mjs tag ${pkg.key} ${trainArgs(train)} --execute\` (or \`run ... --execute\`).

## Resume

- Done: the release-prep commit on this branch.
- Left: CI green, review, merge (by a person), then the tag step above. If CI needs a fixture change caused by the new
  dependency versions (for example the CLI's render hashes), add it to this PR.
- Re-running \`prep\` finds this PR and changes nothing.`;
}

export async function prep(deps, pkg, train, { execute = false, item, branch, summary, date, cloneDir } = {}) {
  const version = train[pkg.key];
  if (!version) throw new Error(`name the version of ${pkg.key} (--${pkg.key} X.Y.Z)`);
  const head = await mainSha(deps, pkg.repo);
  const manifest = await manifestAt(deps, pkg, head);
  const order = compareVersions(manifest.version, version);
  if (order === 0) {
    deps.log(`${pkg.repo} main already carries ${pkg.name} ${version}: the release-prep PR is merged.`);
    return { status: "merged" };
  }
  if (order > 0) throw new TrainStop(`${pkg.repo} main already carries ${manifest.version}, newer than ${version}`);
  const open = await openPrepPull(deps, pkg, version);
  if (open) {
    deps.log(`release-prep PR already open: ${open.url}`);
    return { status: "open", pull: open };
  }
  const missing = await missingUpstream(deps, pkg, train);
  if (missing.length) throw new TrainStop(`${pkg.name}@${version} waits for ${missing.join(", ")} on npm; prep it after the upstream is published`);
  const branchName = branch ?? defaultBranch(pkg, version);
  const changes = floorChanges(manifest, upstreamTargets(pkg, train));
  const dir = cloneDir ?? mkdtempSync(path.join(deps.scratch ?? os.tmpdir(), `release-train-${pkg.key}-`));
  const git = (args, what = `git ${args[0]}`) => must(deps.exec("git", args, { cwd: dir, env: deps.env }), what);
  must(deps.exec("git", ["clone", "--depth", "1", "--branch", "main", deps.cloneUrl(pkg.repo), dir], { env: deps.env }), "git clone");
  const remoteBranch = git(["ls-remote", "--heads", "origin", branchName]).trim();
  if (remoteBranch) throw new TrainStop(`the branch ${branchName} already exists on ${OWNER}/${pkg.repo} with no open pull request; open one from it, delete it, or pass --branch`);
  git(["checkout", "-b", branchName]);
  const manifestFile = path.join(dir, pkg.manifest);
  const cloned = readFileSync(manifestFile, "utf8");
  if (JSON.parse(cloned).version !== manifest.version) throw new Error(`the clone of ${pkg.repo} is not at main ${head.slice(0, 12)}`);
  const declared = unreleasedCoreOf(JSON.parse(cloned));
  if (declared !== null && (!isVersion(declared) || (train.core && compareVersions(declared, train.core) > 0))) {
    throw new TrainStop(`${pkg.manifest} declares opf.requiresUnreleasedCore ${declared}, ${isVersion(declared) ? `above core ${train.core} of this train` : "which is not a version"}: ${pkg.name}@${version} would not install against published core. Release the core it needs first (--core), or fix the field`);
  }
  const edited = removeUnreleasedCoreText(editManifestText(cloned, { version, changes }));
  const removedField = edited.removed;
  writeFileSync(manifestFile, edited.text);
  if (pkg.peersFile && existsSync(path.join(dir, pkg.peersFile))) {
    const peers = editPeersText(readFileSync(path.join(dir, pkg.peersFile), "utf8"), changes);
    if (peers.applied.length) writeFileSync(path.join(dir, pkg.peersFile), peers.text);
  }
  const today = date ?? new Date(deps.now()).toISOString().slice(0, 10);
  const assembleArgs = ["scripts/changelog-fragments.mjs", "assemble", "--version", version, "--date", today];
  if (pkg.changelog.package) assembleArgs.push("--package", pkg.changelog.package);
  if (summary) assembleArgs.push("--summary", summary);
  const assembled = must(deps.exec("node", assembleArgs, { cwd: dir, env: deps.env }), "changelog-fragments assemble");
  const fragments = Number(/(\d+) fragment/.exec(assembled)?.[1] ?? 0);
  const left = leftoverFragments(dir, pkg);
  if (left.length) throw new Error(`fragments for ${pkg.changelog.package ?? pkg.repo} are left after assemble: ${left.join(", ")}`);
  if (pkg.lockfile === "pnpm") must(deps.exec("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], { cwd: dir, env: deps.env }), "pnpm install --lockfile-only");
  else must(deps.exec("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: dir, env: deps.env }), "npm install --package-lock-only");
  const changed = git(["status", "--porcelain"]).split("\n").filter(Boolean).map((line) => line.slice(3).trim());
  const stray = changed.filter((file) => !allowedPrepFile(pkg, file));
  if (stray.length) throw new Error(`a release-prep PR changes only versions, the changelog, ranges and the lockfile; this one also changed: ${stray.join(", ")} (clone left at ${dir})`);
  const prose = proseMentions(dir, pkg, manifest.version);
  const title = `${item ? `${item}: ` : ""}release ${pkg.key === "core" ? "core" : pkg.key === "cli" ? "CLI" : pkg.repo} ${version}`;
  const body = prepBody({ pkg, version, previous: manifest.version, item, changes, fragments, prose, summary, train, removedField });
  const stat = git(["diff", "--stat", "HEAD"]);
  if (!execute) {
    deps.log(`dry run: ${title}\nbranch ${branchName} in ${dir} (not committed, not pushed)\n${stat}\n${body}\n\nPass --execute to commit, push and open the PR.`);
    return { status: "dry-run", dir, title, body, changed, changes, removedField };
  }
  git(["add", "-A"]);
  git(["commit", "-m", `${title}\n\n${pkg.manifest} ${manifest.version} -> ${version}; changelog fragments assembled; ${removedField ? `opf.requiresUnreleasedCore ${removedField} removed; ` : ""}${changes.length ? `floors: ${changes.map((c) => `${c.name} ${c.to}`).join(", ")}; ` : ""}lockfile refreshed.`]);
  git(["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", "push", "origin", `HEAD:refs/heads/${branchName}`], "git push");
  const pull = await deps.api(`/repos/${OWNER}/${pkg.repo}/pulls`, { method: "POST", body: { title, head: branchName, base: "main", body } });
  deps.log(`opened ${pull.html_url} (${title}); it merges after CI is green and a person merges it.`);
  return { status: "opened", pull: { number: pull.number, url: pull.html_url }, dir, changes, removedField };
}

// ---------------------------------------------------------------------------------------------------------------
// run

/** The whole train. Stops (TrainStop) at the first step that needs a person or failed; returns when all is verified. */
export async function runTrain(deps, train, { execute = false, item, waitMinutes, pollSeconds, summary, attestWaitMinutes, attestPollSeconds } = {}) {
  const args = trainArgs(train);
  const resume = `${SCRIPT} run ${args} --execute${item ? ` --item ${item}` : ""}`;
  const done = [];
  for (const pkg of lockstepOrder(train)) {
    const version = train[pkg.key];
    const state = await packageState(deps, pkg, version, train);
    if (state.step === "published") {
      const verified = await verify(deps, pkg, version, { waitMinutes: attestWaitMinutes ?? ATTEST_WAIT_MINUTES, pollSeconds: attestPollSeconds ?? 30 });
      deps.log(formatVerify(pkg, version, verified));
      if (!verified.ok) throw new TrainStop(`${pkg.name}@${version} is on npm but did not verify; fix what failed (never re-publish), then: ${resume}`);
      done.push(`${pkg.name}@${version}`);
      continue;
    }
    if (state.problems.length) throw new TrainStop(`${pkg.name}@${version}: ${state.problems.join("; ")}. Then: ${resume}`);
    if (state.merged === false) {
      if (state.pull) throw new TrainStop(`${pkg.name}@${version}: the release-prep PR ${state.pull.url} is open. Get its CI green and merge it, then: ${resume}`);
      const result = await prep(deps, pkg, train, { execute, item, summary });
      if (!execute) {
        deps.log(`dry run stops here: ${pkg.name}@${version} needs its release-prep PR merged before the later packages.`);
        return { status: "dry-run", done, next: `${SCRIPT} prep ${pkg.key} ${args} --execute` };
      }
      throw new TrainStop(`${pkg.name}@${version}: opened the release-prep PR ${result.pull?.url}. Get its CI green and merge it, then: ${resume}`);
    }
    if (state.checks.state === "pending" && execute) {
      await pollUntil(
        deps,
        `the checks on ${pkg.repo}@${state.release.sha.slice(0, 12)}`,
        async () => {
          const checks = await commitChecks(deps, pkg.repo, state.release.sha);
          return { done: checks.state !== "pending", detail: checksLine(checks) };
        },
        { waitMinutes: waitMinutes ?? 90, pollSeconds: pollSeconds ?? 120 },
      );
    }
    const result = await tagRelease(deps, pkg, version, train, { execute, waitMinutes, pollSeconds, attestWaitMinutes, attestPollSeconds });
    if (!execute) {
      deps.log(`dry run stops here: ${pkg.name}@${version} must be on npm before the later packages.`);
      return { status: "dry-run", done, next: `${SCRIPT} tag ${pkg.key} ${args} --execute` };
    }
    done.push(`${pkg.name}@${version}`);
    if (result.status !== "released" && result.status !== "published") throw new TrainStop(`${pkg.name}@${version}: ${result.status}. Then: ${resume}`);
  }
  deps.log(`The train is on npm and verified: ${done.join(", ")}. Next by hand: the follow-up docs PR (release-plan.json, compatibility matrix, quickstart) and the gallery consumer bumps.`);
  return { status: "done", done };
}

// ---------------------------------------------------------------------------------------------------------------
// CLI

function run(command, args, { cwd, env } = {}) {
  const result = spawnSync(command, args, { cwd, env: env ?? process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" });
  if (result.error) return { status: 127, stdout: "", stderr: result.error.message };
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

/** GH_TOKEN, GITHUB_TOKEN or the caller's `gh` login. */
function callerToken() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const result = run("gh", ["auth", "token"]);
  if (result.status !== 0) throw new Error("no GitHub token: run `gh auth login` or set GH_TOKEN");
  return result.stdout.trim();
}

export function defaultDeps(overrides = {}) {
  const exec = overrides.exec ?? run;
  return {
    api: overrides.api ?? githubApi({ token: callerToken() }),
    npm: overrides.npm ?? npmRegistry({ exec }),
    exec,
    env: process.env,
    cloneUrl: (repo) => `https://github.com/${OWNER}/${repo}.git`,
    scratch: process.env.RELEASE_TRAIN_SCRATCH,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    log: console.log,
    ...overrides,
  };
}

const USAGE = `Usage: node scripts/release-train.mjs <command> [--core X.Y.Z] [--render X.Y.Z] [--pptx X.Y.Z] [--editor X.Y.Z] [--cli X.Y.Z]
  plan [--json]                         read-only state of the train and what is missing
  prep <package> [--execute] [--item RR-nn] [--branch b] [--summary s] [--date YYYY-MM-DD]
  tag <package>[@X.Y.Z] [--execute] [--wait-minutes 90] [--poll-seconds 120] [--attest-wait-minutes 15] [--attest-poll-seconds 30]
  verify <package>@X.Y.Z [--json] [--wait <minutes>] [--attest-poll-seconds 30]   e.g. @openpresentation/opf-pptx@0.12.2
  run [--execute] [--item RR-nn]        the whole train in lockstep order (same wait options as tag)
Packages: ${PACKAGE_KEYS.join(", ")} (or the repository or npm name). Without --execute nothing is written.`;

export async function main(argv, deps = defaultDeps()) {
  const [command, ...args] = argv;
  const execute = args.includes("--execute");
  const json = args.includes("--json");
  const train = trainFromArgs(args);
  const attestPollSeconds = Number(option(args, "--attest-poll-seconds") ?? 30);
  const waits = {
    waitMinutes: Number(option(args, "--wait-minutes") ?? 90),
    pollSeconds: Number(option(args, "--poll-seconds") ?? 120),
    attestWaitMinutes: Number(option(args, "--attest-wait-minutes") ?? ATTEST_WAIT_MINUTES),
    attestPollSeconds,
  };
  for (const [name, value] of Object.entries(waits)) if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  try {
    if (command === "plan") {
      const result = await plan(deps, train);
      deps.log(json ? JSON.stringify(result, (key, value) => (key === "manifest" ? undefined : value), 2) : formatPlan(result));
      return result.ready && !nextStep(result) ? 0 : 1;
    }
    if (command === "verify") {
      if (!args[0] || args[0].startsWith("--")) throw new Error("verify needs <package>@X.Y.Z");
      const { pkg, version } = parseSpec(args[0]);
      if (!version) throw new Error("verify needs <package>@X.Y.Z");
      const wait = Number(option(args, "--wait") ?? 0);
      if (!Number.isFinite(wait) || wait < 0) throw new Error("--wait must be a non-negative number of minutes");
      const result = await verify(deps, pkg, version, { waitMinutes: wait, pollSeconds: attestPollSeconds });
      deps.log(json ? JSON.stringify(result, null, 2) : formatVerify(pkg, version, result));
      return result.ok ? 0 : 1;
    }
    if (command === "tag") {
      if (!args[0] || args[0].startsWith("--")) throw new Error("tag needs <package>");
      const { pkg, version: given } = parseSpec(args[0]);
      const version = given ?? train[pkg.key];
      if (!version) throw new Error(`name the version (tag ${pkg.key}@X.Y.Z or --${pkg.key} X.Y.Z)`);
      if (given && train[pkg.key] && train[pkg.key] !== given) throw new Error(`${args[0]} and --${pkg.key} ${train[pkg.key]} disagree`);
      const result = await tagRelease(deps, pkg, version, { ...train, [pkg.key]: version }, { execute, ...waits });
      return result.status === "dry-run" || result.status === "released" || result.status === "published" ? 0 : 1;
    }
    if (command === "prep") {
      if (!args[0] || args[0].startsWith("--")) throw new Error("prep needs <package>");
      const { pkg, version: given } = parseSpec(args[0]);
      const full = given ? { ...train, [pkg.key]: given } : train;
      await prep(deps, pkg, full, { execute, item: option(args, "--item"), branch: option(args, "--branch"), summary: option(args, "--summary"), date: option(args, "--date") });
      return 0;
    }
    if (command === "run") {
      if (!lockstepOrder(train).length) throw new Error("name at least one version");
      const result = await runTrain(deps, train, { execute, item: option(args, "--item"), summary: option(args, "--summary"), ...waits });
      return result.status === "done" || result.status === "dry-run" ? 0 : 1;
    }
  } catch (error) {
    if (error instanceof TrainStop) {
      deps.log(`STOP: ${error.message}`);
      return 1;
    }
    throw error;
  }
  deps.log(USAGE);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
