#!/usr/bin/env node
// MR-14: which packages a change affects, which tier each runs, and which jobs the `verify` check must run
// (docs/programs/monorepo/README.md, section 4, "verify contents", step 1: `scope`).
//
// Input: a base and a head (git), or a list of changed paths. Output: JSON, a text summary or GitHub step outputs.
//   node scripts/ci-scope.mjs --base HEAD^1 --head HEAD --event pull_request --labels full-ci
//   node scripts/ci-scope.mjs --files packages/render/src/charts.js spec/README.md --format text
//   node scripts/ci-scope.mjs --base origin/main --github-output --summary     # inside GitHub Actions
//
// How it decides (fails closed: a path or case it cannot classify runs everything):
//   1. Every changed path is classified (classifyPath): a package directory, a core input (spec/, examples/, skills/,
//      the docs core embeds), program or evidence documentation (no package), or tooling (scripts/, workflows, the
//      lockfile, root configuration: everything runs). Anything else is unclassified and runs everything.
//   2. The directly changed packages run the `full` tier. Their transitive dependents, through the workspace graph, run the
//      `contract` tier (RR-53). A forced run (tooling, an unclassified path, the label `full-ci`, any event other than a
//      pull request) runs every package at `full`.
//   3. Legs: the package jobs of ci.yml are matrices; LEG_PLAN says how many shards each package's tests get per tier and
//      which browser suites run (`full` only), and `legs` is the expanded matrix (`fromJSON(needs.scope.outputs.legs).render`).
//   4. Extra jobs: `goldens` when a golden input changed, `gallery-gates` (check:previews and check:stability, which run
//      in packages/integration) when gallery, core or render changed (the one edge the manifests cannot express: gallery
//      has no workspace dependency on an engine), `pack-shape` when any package changed, `lint` always.
//
// The graph is swappable (loadGraph): `manifests` reads the package manifests exactly as pnpm's filter graph does
// (dependencies, devDependencies and optionalDependencies that use workspace:, link: or file:; peers are not edges),
// `target` is the graph the plan fixes (TARGET_GRAPH), and `union` (the default) is both, so a package whose manifest is not
// wired yet (before MR-23) or not imported yet still has its dependents. A JSON file `{ "<id>": ["<dependency id>"] }`
// replaces the graph for experiments. scripts/ci-scope.test.mjs cross-checks the `manifests` graph against
// `pnpm --filter "...[<base>]"` on the six S5 scenarios.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The six published packages and the private integration package, in dependency order (also the output order). */
export const PACKAGES = [
  { id: "gallery", dir: "packages/gallery", name: "@openpresentation/gallery" },
  { id: "core", dir: "packages/javascript", name: "@openpresentation/opf" },
  { id: "render", dir: "packages/render", name: "@openpresentation/opf-render" },
  { id: "pptx", dir: "packages/pptx", name: "@openpresentation/opf-pptx" },
  { id: "editor", dir: "packages/editor", name: "@openpresentation/opf-editor" },
  { id: "cli", dir: "packages/cli", name: "@openpresentation/cli" },
  { id: "integration", dir: "packages/integration", name: "@openpresentation/integration" },
];
export const PACKAGE_IDS = PACKAGES.map((pkg) => pkg.id);

/**
 * MR-30: the legs of each package job per tier, [kind, count]. `tests` is the package's `test` script (full) or
 * `test:contract` (contract) split into `count` shards by scripts/ci-test-shards.mjs; `playground` and `browser` are the
 * quarantine runner's browser suites (scripts/quarantine.mjs run-suite <kind> --shard i/n), which only a changed package
 * (tier full) runs. core, cli, gallery and integration have one `tests` leg whatever the tier (they have no contract suite).
 * The counts are the starting point sized from the RR-57 weights (scripts/ci-test-weights.json, per shard in seconds with 100 s
 * of extra steps on shard 1: render full 4 x 250, contract 3 x 210; pptx full 4 x 262, contract 4 x 242 (its contract suite
 * leaves out only 80 of 948 s); editor 2 x 129) and the editor playground suite (839 s in 28 tests, 4 x 210 s); MR-32 tunes them.
 */
export const LEG_PLAN = Object.freeze({
  // `lint` always runs. Normally: `static` is Biome, typecheck, the examples and the breaking-change gate; `checks` is the root
  // check:* suite (scripts/run-checks.mjs --shard i/n), 73 checks, about 60 s on a laptop with four at a time. For a docs-only
  // change (class `docs`, nothing forced) the one `docs` leg runs the checks mapped to the changed paths (scripts/check-changed.mjs:
  // Biome, check:text and the rest of scripts/checks.json "changed" rules); a push to main runs the full lint.
  lint: { full: [["static", 1], ["checks", 2]], docs: [["docs", 1]] },
  gallery: { full: [["tests", 1]], contract: [["tests", 1]] },
  core: { full: [["tests", 1]], contract: [["tests", 1]] },
  cli: { full: [["tests", 1]], contract: [["tests", 1]] },
  integration: { full: [["tests", 1]], contract: [["tests", 1]] },
  render: { full: [["tests", 4], ["browser", 1]], contract: [["tests", 3]] },
  pptx: { full: [["tests", 4], ["browser", 1]], contract: [["tests", 4]] },
  editor: { full: [["tests", 2], ["playground", 4], ["browser", 1]], contract: [["tests", 2]] },
});

/** The matrix entries of one package at one tier: [{ package, tier, kind, index, count, name }]; [] for a skipped package. */
export function legsFor(id, tier) {
  if (tier === "skip") return [];
  return LEG_PLAN[id][tier].flatMap(([kind, count]) =>
    Array.from({ length: count }, (_, position) => ({ package: id, tier, kind, index: position + 1, count, name: count > 1 ? `${kind} ${position + 1}/${count}` : kind })),
  );
}

/**
 * The graph pnpm will see once MR-23 has wired the workspace (plan, section 1): dependencies, devDependencies and
 * optionalDependencies between workspace packages; peers are not edges. Gallery has no workspace edge to an engine, core's
 * optional peers on render and pptx are not edges, and `integration` depends on what it imports (core, render, pptx and the
 * gallery; not the editor or the CLI, so a change there does not select it; its manifest says the same). `check:workspace-graph` (MR-10)
 * enforces this shape on the manifests.
 */
export const TARGET_GRAPH = Object.freeze({
  gallery: [],
  core: ["gallery"],
  render: ["core", "gallery"],
  pptx: ["core", "gallery", "render"],
  editor: ["core", "gallery", "render", "pptx"],
  cli: ["core", "gallery", "render", "pptx"],
  integration: ["gallery", "core", "render", "pptx"],
});

/** An edge pnpm links inside the workspace (with link-workspace-packages=false only these specifiers). */
const isWorkspaceSpec = (spec) => typeof spec === "string" && /^(workspace:|link:|file:)/.test(spec);

/**
 * Read the package manifests under `root` into `{ graph, present, names }`. `graph` maps a package id to the ids it depends
 * on, with exactly the edges pnpm's filter graph sees; a package whose manifest does not exist is absent from `present` and
 * has no edges.
 */
export function readManifestGraph(root, packages = PACKAGES) {
  const manifests = new Map();
  for (const pkg of packages) {
    const file = path.join(root, pkg.dir, "package.json");
    if (!existsSync(file)) continue;
    manifests.set(pkg.id, JSON.parse(readFileSync(file, "utf8")));
  }
  const names = new Map(packages.map((pkg) => [pkg.name, pkg.id]));
  for (const [id, manifest] of manifests) if (manifest.name) names.set(manifest.name, id);
  const graph = Object.fromEntries(packages.map((pkg) => [pkg.id, []]));
  for (const [id, manifest] of manifests) {
    const edges = new Set();
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const [dependency, spec] of Object.entries(manifest[field] ?? {})) {
        if (names.has(dependency) && isWorkspaceSpec(spec) && names.get(dependency) !== id) edges.add(names.get(dependency));
      }
    }
    graph[id] = [...edges];
  }
  return { graph, present: [...manifests.keys()], names };
}

function unionGraph(...graphs) {
  const merged = {};
  for (const id of PACKAGE_IDS) merged[id] = [...new Set(graphs.flatMap((graph) => graph[id] ?? []))];
  return merged;
}

/** `source`: "manifests", "target", "union" (default), or the path of a JSON file `{ id: [dependency ids] }`. */
export function loadGraph(root, source = "union") {
  if (source === "target") return { graph: { ...TARGET_GRAPH }, source, present: PACKAGE_IDS.slice() };
  if (source === "manifests") return { ...readManifestGraph(root), source };
  if (source === "union") {
    const manifests = readManifestGraph(root);
    return { graph: unionGraph(manifests.graph, TARGET_GRAPH), source, present: manifests.present };
  }
  const custom = JSON.parse(readFileSync(path.resolve(root, source), "utf8"));
  return { graph: unionGraph({}, custom), source: `file:${source}`, present: PACKAGE_IDS.slice() };
}

/** `ids` plus everything that depends on one of them, directly or through other packages (what `...[base]` selects). */
export function withDependents(graph, ids) {
  const selected = new Set(ids);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [id, dependencies] of Object.entries(graph)) {
      if (!selected.has(id) && dependencies.some((dependency) => selected.has(dependency))) {
        selected.add(id);
        grew = true;
      }
    }
  }
  return PACKAGE_IDS.filter((id) => selected.has(id));
}

/** A dependency cycle in `graph`, as ["a", "b", "a"], or null. */
export function findCycle(graph) {
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...trail.slice(trail.indexOf(id)), id];
    state.set(id, 1);
    for (const dependency of graph[id] ?? []) {
      const cycle = visit(dependency, [...trail, id]);
      if (cycle) return cycle;
    }
    state.set(id, 2);
    return null;
  };
  for (const id of Object.keys(graph)) {
    const cycle = visit(id, []);
    if (cycle) return cycle;
  }
  return null;
}

// --- Path map ---------------------------------------------------------------------------------------------------------

const TOOLING_PREFIXES = ["scripts/", ".github/", "test/"];
const TOOLING_FILES = new Set([
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package.json",
  "biome.json",
  ".nvmrc",
  ".gitattributes",
  ".npmrc",
  ".gitignore",
]);
// Documentation, records and tracking that no package or script reads at run time. `lint` (the root check:* suite) still
// runs for them, and it is what gates them.
const DOCS_FILES = new Set(["AGENTS.md", "CONTRIBUTING.md", "PRODUCT.md", "SECURITY.md", "CODE_OF_CONDUCT.md", "LICENSE", "CHANGELOG.md", "llms.txt", ".mailmap", ".git-blame-ignore-revs"]);
const DOCS_PREFIXES = ["changes/", "legacy/", ".claude/", "docs/programs/"];
// Core inputs: its build embeds spec/, examples/, the top-level docs/*.md and the root README.md, the skills ship with it,
// docs/fixtures/ holds decks the packages' tests load, and docs/quickstart/ and docs/first-deck/ are the decks and commands
// that the quickstart tests and check:first-deck run. Every other deck (*.opf.json) under docs/ is an input too.
const CORE_PREFIXES = ["spec/", "examples/", "skills/", "docs/fixtures/", "docs/quickstart/", "docs/first-deck/"];
const CORE_FILES = new Set(["README.md"]);

const isEvidence = (rel) => rel.startsWith("docs/evidence/") && !rel.endsWith(".opf.json");

/**
 * Classify one changed path (repository-relative, forward slashes).
 *   { kind: "package", package: id }   a package directory, or a core input (package: "core")
 *   { kind: "docs" }                   no package is affected; `lint` gates it
 *   { kind: "all", reason }            everything runs at `full` (tooling, workflows, root configuration, anything unknown)
 */
export function classifyPath(file) {
  const rel = file.replace(/^\.\//, "");
  for (const pkg of PACKAGES) {
    if (!rel.startsWith(`${pkg.dir}/`)) continue;
    // Native-evidence logs and documents under a package are not read by its tests (decks, *.opf.json, are).
    if (isEvidence(rel.slice(pkg.dir.length + 1))) return { kind: "docs" };
    return { kind: "package", package: pkg.id };
  }
  if (rel.startsWith("packages/")) return { kind: "all", reason: `unknown package directory ${rel.split("/").slice(0, 2).join("/")}` };
  if (rel.startsWith("docs/evidence/")) return isEvidence(rel) ? { kind: "docs" } : { kind: "package", package: "core" };
  if (rel.startsWith(".github/workflows/")) return { kind: "all", reason: "workflow" };
  if (TOOLING_FILES.has(rel) || TOOLING_PREFIXES.some((prefix) => rel.startsWith(prefix))) return { kind: "all", reason: "tooling" };
  if (CORE_FILES.has(rel) || CORE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return { kind: "package", package: "core" };
  // The core build embeds docs/*.md (top level only); other documentation is not read by a package.
  if (/^docs\/[^/]+\.md$/.test(rel) || (rel.startsWith("docs/") && rel.endsWith(".opf.json") && !rel.startsWith("docs/programs/"))) return { kind: "package", package: "core" };
  if (rel.startsWith("docs/") || DOCS_FILES.has(rel) || DOCS_PREFIXES.some((prefix) => rel.startsWith(prefix))) return { kind: "docs" };
  return { kind: "all", reason: "unclassified" };
}

/** Inputs of the golden corpus (plan, section 4): the renderer, examples, core's geometry sources, gallery. Superset on purpose. */
export const GOLDEN_INPUT_PREFIXES = [
  "packages/render/src/",
  "packages/render/fonts/",
  "packages/render/test/golden/",
  "packages/javascript/src/",
  "packages/gallery/",
  "spec/reference/",
  "examples/",
];
/** The lockfile or any package manifest: what `pnpm audit` reads. */
export const isDependencyFile = (file) => file === "pnpm-lock.yaml" || file === "package.json" || /^packages\/[^/]+\/package\.json$/.test(file);
export const isGoldenInput = (file) => GOLDEN_INPUT_PREFIXES.some((prefix) => file.startsWith(prefix));

// --- The decision -----------------------------------------------------------------------------------------------------

/** Overall change class, the rows of the plan's target table (section 4). */
const classOf = ({ forced, changed }) => {
  if (forced) return "all";
  if (changed.includes("core") || changed.includes("gallery")) return "core";
  if (changed.includes("render") || changed.includes("pptx")) return "engine";
  if (changed.length > 0) return "leaf";
  return "docs";
};

/**
 * The decision for one change.
 * @param {{ files: string[], graph: Record<string, string[]>, event?: string, labels?: string[] }} input
 */
export function scope({ files, graph, event = "pull_request", labels = [] }) {
  const reasons = [];
  const changed = new Set();
  const unclassified = [];
  const classes = { package: {}, docs: 0, all: [] };
  let forced = false;
  if (event !== "pull_request") {
    forced = true;
    reasons.push(`${event} runs always run everything`);
  }
  if (labels.includes("full-ci")) {
    forced = true;
    reasons.push("the pull request carries the label full-ci");
  }
  if (files.length === 0) {
    forced = true;
    reasons.push("no changed paths could be listed");
  }
  for (const file of files) {
    const result = classifyPath(file);
    if (result.kind === "package") {
      changed.add(result.package);
      classes.package[result.package] = (classes.package[result.package] ?? 0) + 1;
    } else if (result.kind === "docs") classes.docs += 1;
    else {
      classes.all.push(file);
      forced = true;
      if (result.reason === "unclassified" || result.reason.startsWith("unknown package")) unclassified.push(file);
    }
  }
  if (classes.all.length > 0) reasons.push(`${classes.all.length} changed path${classes.all.length === 1 ? "" : "s"} run everything (${[...new Set(classes.all.map((file) => classifyPath(file).reason))].join(", ")}): ${classes.all.slice(0, 3).join(", ")}${classes.all.length > 3 ? ", ..." : ""}`);

  const changedIds = PACKAGE_IDS.filter((id) => changed.has(id));
  const affected = forced ? PACKAGE_IDS.slice() : withDependents(graph, changedIds);
  const tiers = Object.fromEntries(PACKAGE_IDS.map((id) => [id, forced || changed.has(id) ? "full" : affected.includes(id) ? "contract" : "skip"]));
  if (!forced && changedIds.length === 0) reasons.push(`all ${files.length} changed paths are documentation or records that no package reads`);

  const goldens = forced || files.some(isGoldenInput);
  const galleryGates = forced || ["gallery", "core", "render"].some((id) => changed.has(id));
  const packShape = forced || changedIds.length > 0;
  // `audit` (pnpm audit): when the lockfile or a package manifest changed; a new advisory must not fail an unrelated change, so
  // being forced by an event or a tooling path does not select it (the nightly audits every night).
  const audit = files.some(isDependencyFile);
  const slow = labels.includes("full-ci");
  const jobs = {
    lint: "full",
    ...tiers,
    audit: audit ? "full" : "skip",
    goldens: goldens ? "full" : "skip",
    "gallery-gates": galleryGates ? "full" : "skip",
    "pack-shape": packShape ? "full" : "skip",
  };
  return {
    event,
    files: files.length,
    forced,
    tier: classOf({ forced, changed: changedIds }),
    changed: changedIds,
    affected,
    packages: tiers,
    jobs,
    required: Object.entries(jobs).filter(([, tier]) => tier !== "skip").map(([name]) => name),
    skipped: Object.entries(jobs).filter(([, tier]) => tier === "skip").map(([name]) => name),
    matrix: PACKAGE_IDS.filter((id) => tiers[id] !== "skip").map((id) => ({ package: id, tier: tiers[id] })),
    legs: Object.fromEntries(["lint", ...PACKAGE_IDS].map((id) => [id, legsFor(id, id === "lint" ? (!forced && changedIds.length === 0 ? "docs" : "full") : tiers[id])])),
    slow,
    unclassified,
    reasons,
  };
}

// --- Git and CLI ------------------------------------------------------------------------------------------------------

/** Paths changed between the merge base of `base` and `head` and `head`, both sides of a rename listed. */
export function changedFiles(base, head = "HEAD", cwd = process.cwd()) {
  const out = execFileSync("git", ["diff", "-z", "--name-only", "--no-renames", `${base}...${head}`], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return out.split("\0").filter(Boolean);
}

export function renderText(decision) {
  const lines = [];
  lines.push(`ci-scope: ${decision.files} changed path${decision.files === 1 ? "" : "s"}, class ${decision.tier}${decision.forced ? " (forced: everything runs at full)" : ""}`);
  for (const reason of decision.reasons) lines.push(`  - ${reason}`);
  lines.push(`changed:  ${decision.changed.join(", ") || "(no package)"}`);
  lines.push(`affected: ${decision.affected.join(", ") || "(no package)"}`);
  lines.push(`jobs:     ${Object.entries(decision.jobs).map(([name, tier]) => `${name}=${tier}`).join(" ")}`);
  if (decision.slow) lines.push("slow:     the slow set runs (label full-ci)");
  return lines.join("\n");
}

export function renderMarkdown(decision) {
  const rows = Object.entries(decision.jobs).map(([name, tier]) => `| ${name} | ${tier} |`);
  return [
    "### ci-scope (shadow)",
    "",
    `Class **${decision.tier}**${decision.forced ? " (forced: everything runs at full)" : ""}; ${decision.files} changed path${decision.files === 1 ? "" : "s"}.`,
    ...decision.reasons.map((reason) => `- ${reason}`),
    "",
    `Changed packages: ${decision.changed.map((id) => `\`${id}\``).join(", ") || "none"}. Affected: ${decision.affected.map((id) => `\`${id}\``).join(", ") || "none"}.`,
    "",
    "| Job | Tier |",
    "| --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { format: "json", labels: [], files: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === "--base") options.base = value();
    else if (arg === "--head") options.head = value();
    else if (arg === "--event") options.event = value();
    else if (arg === "--labels") options.labels = value().split(",").map((label) => label.trim()).filter(Boolean);
    else if (arg === "--graph") options.graph = value();
    else if (arg === "--format") options.format = value();
    else if (arg === "--github-output") options.githubOutput = true;
    else if (arg === "--summary") options.summary = true;
    else if (arg === "--files") {
      options.files = [];
      while (index + 1 < argv.length && !argv[index + 1].startsWith("--")) options.files.push(argv[++index]);
    } else throw new Error(`unknown argument ${arg}`);
  }
  if (!["json", "text", "markdown"].includes(options.format)) throw new Error(`--format must be json, text or markdown, not ${options.format}`);
  return options;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function run(argv, env = process.env, cwd = process.cwd()) {
  const options = parseArgs(argv);
  const event = options.event || env.GITHUB_EVENT_NAME || "pull_request";
  let files = options.files;
  let listError = null;
  if (!files) {
    try {
      files = changedFiles(options.base ?? "origin/main", options.head ?? "HEAD", cwd);
    } catch (error) {
      // Fail closed: an unreadable diff runs everything.
      files = [];
      listError = error.message.split("\n")[0];
    }
  }
  const { graph, source } = loadGraph(repoRoot, options.graph ?? "union");
  const decision = scope({ files, graph, event, labels: options.labels });
  if (listError) decision.reasons.unshift(`could not list the changed paths (${listError})`);
  decision.graph = source;
  const text = options.format === "text" ? renderText(decision) : options.format === "markdown" ? renderMarkdown(decision) : JSON.stringify(decision, null, 2);
  if (options.githubOutput && env.GITHUB_OUTPUT) {
    appendFileSync(
      env.GITHUB_OUTPUT,
      [`tier=${decision.tier}`, `forced=${decision.forced}`, `slow=${decision.slow}`, `changed=${JSON.stringify(decision.changed)}`, `affected=${JSON.stringify(decision.affected)}`, `jobs=${JSON.stringify(decision.jobs)}`, `matrix=${JSON.stringify(decision.matrix)}`, `legs=${JSON.stringify(decision.legs)}`, `required=${JSON.stringify(decision.required)}`, ""].join("\n"),
    );
  }
  if (options.summary && env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${renderMarkdown(decision)}\n`);
  return { decision, text };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(run(process.argv.slice(2)).text);
  } catch (error) {
    console.error(`ci-scope: ${error.message}`);
    process.exit(2);
  }
}
