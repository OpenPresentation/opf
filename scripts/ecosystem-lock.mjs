// RR-50: ecosystem.lock.json, the bot-owned record of the four OpenPresentation commits that passed the coordinated
// ecosystem checks together (docs/programs/release-readiness/ci-cd.md, section 3).
//
// The lock holds one full commit SHA per repository (opf, opf-render, opf-pptx, opf-editor) and the golden baseline
// the locked renderer renders the core examples against. Only the roller (scripts/ecosystem-roll.mjs) writes the
// SHAs; a pull request may change the `golden` selection, which is a reviewed golden decision like the
// OPF_GOLDEN_BASELINE edits it replaces. The schema is scripts/ecosystem-lock.schema.json; docs/ecosystem-development.md
// explains the model.
//
// Usage:
//   node scripts/ecosystem-lock.mjs validate [--lock ecosystem.lock.json]
//   node scripts/ecosystem-lock.mjs guard [--lock ecosystem.lock.json] [--base-lock <file>] [--head-ref <branch>] [--blocking]
//   node scripts/ecosystem-lock.mjs resolve --consumer <repository> [--lock <file>] [--golden-override <path>] [--github-output] [--github-env]
//
// `resolve` is what every repository's CI runs (through .github/actions/ecosystem-refs): it prints, and writes as step
// outputs, the commit to check out for each of the four repositories (opf, opf_render, opf_pptx, opf_editor) and the
// golden baseline as a path relative to the workspace that holds the four checkouts side by side (`golden`).
// `--github-env` also exports OPF_GOLDEN_BASELINE (absolute, under GITHUB_WORKSPACE) for the later steps of the job.
// `--golden-override` replaces the lock's golden with a workspace-relative path (a renderer pull request that moves
// pixels selects its own baseline this way).
//
// Depends-On (pull_request events only): a line `Depends-On: OpenPresentation/<repository>#<number>` in the pull
// request body (read through the REST API, so editing the body and re-running the job picks it up) makes `resolve`
// check out that pull request instead of the lock entry: its test merge commit while it is open and mergeable, its
// head otherwise, and its merge commit (on main) once merged. A closed, unmerged dependency fails the step.
// FA-19: when opf-render comes from a Depends-On pull request (and no --golden-override is given), resolve also adopts
// that pull request's own golden selection, the `golden-override` of its .github/workflows/ci.yml, with the roller's
// rule (adoptableGolden) and only when the baseline exists at the commit that is checked out; otherwise the lock's.
//   node scripts/ecosystem-lock.mjs depends-on [--body-file <file>]   # prints what a body declares (no network)
//
// `guard` checks, through the GitHub REST API (no clone), that every locked SHA is an ancestor of its repository's
// main (the REST equivalent of `git merge-base --is-ancestor <sha> main`), and warns when a pull request edits a
// locked SHA from a branch other than the roller's. It only warns unless `--blocking` is given or
// ECOSYSTEM_LOCK_GUARD=blocking is set (the migration in ci-cd.md adds it as a warning first).
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER = "OpenPresentation";
export const REPOSITORIES = ["opf", "opf-render", "opf-pptx", "opf-editor"];
export const LOCK_FILE = "ecosystem.lock.json";
/** Branches the roller pushes. A locked SHA changed on any other branch is a hand-edited pin. */
export const ROLLER_BRANCH_PREFIX = "ecosystem-roll/";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA = /^[0-9a-f]{40}$/;
const TOP_LEVEL = new Set(["$schema", "$comment", "version", "repositories", "golden", "provenance"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A repository-relative POSIX path that cannot leave the repository checkout. */
export function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 300) return false;
  if (value.startsWith("/") || value.includes("\\") || /^[A-Za-z]:/.test(value)) return false;
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

/** Every reason `lock` is not a valid ecosystem lock (an empty array when it is). Mirrors ecosystem-lock.schema.json. */
export function validateLock(lock) {
  const errors = [];
  if (!isPlainObject(lock)) return ["the lock must be a JSON object"];
  for (const key of Object.keys(lock)) if (!TOP_LEVEL.has(key)) errors.push(`unknown top-level field "${key}"`);
  if (lock.version !== 1) errors.push("version must be 1");
  if (!isPlainObject(lock.repositories)) {
    errors.push("repositories must be an object");
  } else {
    const names = Object.keys(lock.repositories);
    for (const name of names) if (!REPOSITORIES.includes(name)) errors.push(`repositories.${name}: not an OpenPresentation ecosystem repository`);
    for (const name of REPOSITORIES) {
      const entry = lock.repositories[name];
      if (!isPlainObject(entry)) {
        errors.push(`repositories.${name}: missing`);
        continue;
      }
      for (const key of Object.keys(entry)) if (key !== "sha") errors.push(`repositories.${name}: unknown field "${key}"`);
      if (!SHA.test(entry.sha ?? "")) errors.push(`repositories.${name}.sha must be a full 40-character lowercase commit SHA`);
    }
  }
  if (!isPlainObject(lock.golden)) {
    errors.push("golden must be an object");
  } else {
    for (const key of Object.keys(lock.golden)) if (!["repository", "path", "note"].includes(key)) errors.push(`golden: unknown field "${key}"`);
    if (!REPOSITORIES.includes(lock.golden.repository)) errors.push("golden.repository must be one of the four ecosystem repositories");
    if (!isSafeRelativePath(lock.golden.path)) errors.push("golden.path must be a relative POSIX path inside that repository");
    if (lock.golden.note !== undefined && typeof lock.golden.note !== "string") errors.push("golden.note must be a string");
  }
  if (!isPlainObject(lock.provenance)) {
    errors.push("provenance must be an object");
  } else {
    const { provenance } = lock;
    for (const key of Object.keys(provenance)) if (!["source", "at", "run", "note"].includes(key)) errors.push(`provenance: unknown field "${key}"`);
    if (!["migration", "roller"].includes(provenance.source)) errors.push('provenance.source must be "migration" or "roller"');
    if (typeof provenance.at !== "string" || Number.isNaN(Date.parse(provenance.at)) || !/^\d{4}-\d{2}-\d{2}T/.test(provenance.at)) {
      errors.push("provenance.at must be an ISO 8601 date-time");
    }
    if (provenance.run !== undefined && !/^https:\/\/github\.com\/OpenPresentation\/[\w.-]+\/actions\/runs\/\d+$/.test(provenance.run)) {
      errors.push("provenance.run must be a GitHub Actions run URL in OpenPresentation");
    }
    if (provenance.note !== undefined && typeof provenance.note !== "string") errors.push("provenance.note must be a string");
  }
  return errors;
}

export function parseLock(text, source = LOCK_FILE) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: not JSON (${error.message})`);
  }
  const errors = validateLock(lock);
  if (errors.length) throw new Error(`${source} is not a valid ecosystem lock:\n- ${errors.join("\n- ")}`);
  return lock;
}

export function readLock(file = path.join(root, LOCK_FILE)) {
  return parseLock(readFileSync(file, "utf8"), path.relative(process.cwd(), file) || file);
}

/** A minimal GitHub REST client on fetch (Node 18+). Public repositories need no token; one raises the rate limit. */
export function githubApi({ token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN, baseUrl = process.env.GITHUB_API_URL ?? "https://api.github.com", fetchImpl = globalThis.fetch } = {}) {
  return async function api(route, { method = "GET", body } = {}) {
    const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "opf-ecosystem-lock" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetchImpl(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(`${method} ${route}: HTTP ${response.status} ${data?.message ?? ""}`.trim());
      error.status = response.status;
      throw error;
    }
    return data;
  };
}

/**
 * Whether `sha` is an ancestor of (or equal to) `branch` in OpenPresentation/<repository>, through the compare API:
 * comparing base `sha` with head `branch` reports "ahead" or "identical" exactly when `git merge-base --is-ancestor
 * <sha> <branch>` succeeds, and "behind" or "diverged" when the commit has changes that are not on the branch.
 */
export async function ancestry(api, repository, sha, branch = "main") {
  try {
    const compare = await api(`/repos/${OWNER}/${repository}/compare/${sha}...${branch}`);
    const onBranch = compare.status === "ahead" || compare.status === "identical";
    return { repository, sha, onBranch, status: compare.status, behindBy: compare.ahead_by, notInBranch: compare.behind_by };
  } catch (error) {
    return { repository, sha, onBranch: false, status: error.status === 404 ? "unknown commit" : "error", error: error.message };
  }
}

/** The ancestry of every locked SHA, in REPOSITORIES order. */
export async function checkAncestry(lock, api) {
  return Promise.all(REPOSITORIES.map((name) => ancestry(api, name, lock.repositories[name].sha)));
}

/**
 * Locked SHAs that a pull request changed by hand. The roller's branches (ROLLER_BRANCH_PREFIX) are the only place a
 * SHA may change; a new lock (no base) has nothing to compare.
 */
export function handEditedPins(baseLock, lock, headRef) {
  if (!baseLock || !headRef || headRef.startsWith(ROLLER_BRANCH_PREFIX)) return [];
  return REPOSITORIES.filter((name) => baseLock.repositories?.[name]?.sha !== lock.repositories[name].sha).map((name) => ({
    repository: name,
    from: baseLock.repositories?.[name]?.sha,
    to: lock.repositories[name].sha,
  }));
}

function short(sha) {
  return sha ? sha.slice(0, 12) : "(none)";
}

/** Runs the guard and returns { problems, lines }: `problems` are what would fail a blocking run. */
export async function guard(lock, api, { baseLock, headRef } = {}) {
  const lines = [];
  const problems = [];
  for (const result of await checkAncestry(lock, api)) {
    if (result.onBranch) {
      lines.push(`${result.repository} ${short(result.sha)} is on main (${result.behindBy ?? 0} commits behind).`);
    } else if (result.status === "behind" || result.status === "diverged") {
      problems.push(`${result.repository} is locked to ${short(result.sha)}, which is not on ${OWNER}/${result.repository} main (${result.notInBranch} commits not in main). Only the roller writes the lock, from merged commits.`);
    } else {
      problems.push(`${result.repository} ${short(result.sha)} could not be checked against main (${result.status}${result.error ? `: ${result.error}` : ""}).`);
    }
  }
  for (const edit of handEditedPins(baseLock, lock, headRef)) {
    problems.push(`${edit.repository} changed from ${short(edit.from)} to ${short(edit.to)} on branch ${headRef}: locked SHAs are written by the roller (branches ${ROLLER_BRANCH_PREFIX}*), not by hand. Use a Depends-On: trailer for an unmerged dependency.`);
  }
  return { problems, lines };
}

const DEPENDS_ON_LINE = /^\s*Depends-On:\s*(.*)$/i;
const DEPENDENCY = [
  /^([\w.-]+)\/([\w.-]+)#(\d+)$/,
  /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)\/?$/,
];

/**
 * The `Depends-On:` trailers of a pull request body. A trailer is a line that starts with `Depends-On:` (any case),
 * outside fenced code blocks, naming one or more pull requests separated by commas or spaces, each as
 * `OpenPresentation/<repository>#<number>` or its https://github.com/... pull request URL. Only the four ecosystem
 * repositories count; anything else is reported as a warning and ignored. Two different pull requests of the same
 * repository are an error (CI can check out only one).
 */
export function parseDependsOn(body) {
  const dependencies = [];
  const warnings = [];
  let fence = null;
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const trailer = DEPENDS_ON_LINE.exec(line);
    if (!trailer) continue;
    const tokens = trailer[1].split(/[\s,]+/).filter(Boolean);
    if (!tokens.length) warnings.push(`"${line.trim()}" names no pull request`);
    for (const token of tokens) {
      const match = DEPENDENCY.map((pattern) => pattern.exec(token)).find(Boolean);
      if (!match) {
        warnings.push(`"${token}" is not OpenPresentation/<repository>#<number> or a pull request URL; ignored`);
        continue;
      }
      const [, owner, repository, number] = match;
      if (owner.toLowerCase() !== OWNER.toLowerCase() || !REPOSITORIES.includes(repository)) {
        warnings.push(`${owner}/${repository}#${number} is not one of the ecosystem repositories (${REPOSITORIES.map((name) => `${OWNER}/${name}`).join(", ")}); ignored`);
        continue;
      }
      const existing = dependencies.find((dependency) => dependency.repository === repository);
      if (existing && existing.number !== Number(number)) throw new Error(`Depends-On names two pull requests of ${OWNER}/${repository} (#${existing.number} and #${number}); CI can check out only one`);
      if (!existing) dependencies.push({ repository, number: Number(number) });
    }
  }
  return { dependencies, warnings };
}

/**
 * The commit to check out for one dependency, from GET /repos/OpenPresentation/<repository>/pulls/<number>:
 * merged: its merge commit (on main); open and mergeable: its test merge commit (refs/pull/<n>/merge, the change as
 * it would land); open otherwise: its head; closed without merging: an error.
 */
export async function resolveDependency(api, { repository, number }) {
  const pull = await api(`/repos/${OWNER}/${repository}/pulls/${number}`);
  const name = `${OWNER}/${repository}#${number}`;
  if (pull.merged_at || pull.merged) return { ref: pull.merge_commit_sha, source: `Depends-On ${name} (merged; its merge commit on main)`, state: "merged" };
  if (pull.state !== "open") throw new Error(`Depends-On ${name} is closed without merging; remove the trailer or point it at the replacement`);
  if (pull.mergeable === true && pull.merge_commit_sha) return { ref: pull.merge_commit_sha, source: `Depends-On ${name} (open; its test merge commit)`, state: "open" };
  return { ref: pull.head.sha, source: `Depends-On ${name} (open; its head, because GitHub reports mergeable=${pull.mergeable})`, state: "open" };
}

/** The pull request this run tests, from the event payload (pull_request events only). */
export function pullRequestOfEvent(env = process.env) {
  if (!["pull_request", "pull_request_target"].includes(env.GITHUB_EVENT_NAME) || !env.GITHUB_EVENT_PATH) return undefined;
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  if (!event.pull_request) return undefined;
  return { repository: env.GITHUB_REPOSITORY, number: event.pull_request.number, body: event.pull_request.body ?? "" };
}

/**
 * The Depends-On overrides for `consumer`: parses the current body of the pull request under test (falling back to
 * the event payload) and resolves each dependency. A dependency on the consumer itself is ignored with a warning.
 */
export async function dependsOnOverrides(api, pullRequest, consumer) {
  if (!pullRequest) return { overrides: {}, warnings: [], dependencies: [] };
  const warnings = [];
  let body = pullRequest.body;
  try {
    body = (await api(`/repos/${pullRequest.repository}/pulls/${pullRequest.number}`)).body ?? "";
  } catch (error) {
    warnings.push(`could not read the current body of ${pullRequest.repository}#${pullRequest.number} (${error.message}); using the event payload`);
  }
  const parsed = parseDependsOn(body);
  warnings.push(...parsed.warnings);
  const overrides = {};
  const dependencies = [];
  for (const dependency of parsed.dependencies) {
    if (dependency.repository === consumer) {
      warnings.push(`Depends-On ${OWNER}/${dependency.repository}#${dependency.number} names this repository; CI already tests this pull request's own head, so it is ignored`);
      continue;
    }
    const resolved = await resolveDependency(api, dependency);
    overrides[dependency.repository] = resolved;
    dependencies.push({ ...dependency, ...resolved });
    if (resolved.state === "open") warnings.push(`${OWNER}/${dependency.repository}#${dependency.number} is still open: merge it before this pull request (this run tests against it, not the lock)`);
  }
  return { overrides, warnings, dependencies };
}

/** A renderer's own golden selection in its ci.yml (the `golden-override` input of the ecosystem-refs step), or "". */
export function goldenOverrideOf(ciYaml) {
  const match = /^\s*golden-override:\s*(?:'([^']*)'|"([^"]*)"|([^\s#'"]*))\s*(?:#.*)?$/m.exec(ciYaml ?? "");
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
}

/**
 * The golden a renderer's `golden-override` may hand to the lock (the roller) or to a Depends-On run (resolve): a
 * renderer baseline directory (`opf-render/test/golden/<name>`) or a reviewed core fixture
 * (`opf/scripts/fixtures/<name>.sha256.json`), which a coordinated release's renderer pull request selects while the
 * lock still records the previous renderer's output. Returns { repository, path, coreFixture }; throws otherwise.
 */
export function adoptableGolden(override, owner = "opf-render's") {
  const [repository, ...rest] = String(override).split("/");
  const goldenPath = rest.join("/");
  const renderBaseline = repository === "opf-render" && /^test\/golden\/[\w.-]+$/.test(goldenPath);
  const coreFixture = repository === "opf" && /^scripts\/fixtures\/[\w.-]+\.sha256\.json$/.test(goldenPath);
  if (!isSafeRelativePath(goldenPath) || (!renderBaseline && !coreFixture)) {
    throw new Error(`${owner} golden-override ${override} does not name an opf-render baseline (opf-render/test/golden/<name>) or a core scripts/fixtures/<name>.sha256.json fixture`);
  }
  return { repository, path: goldenPath, coreFixture };
}

/**
 * FA-19: the golden of a Depends-On opf-render pull request. Reads its ci.yml at the commit that is checked out and
 * adopts its `golden-override` (adoptableGolden) when the baseline exists there: a renderer baseline at that commit, a
 * core fixture at the opf commit of this run (this checkout, `root`, when core is the consumer). Returns undefined
 * when opf-render is not a Depends-On or its ci.yml selects nothing.
 */
export async function dependsOnGolden(api, { dependencies = [], refs, consumer, root: localRoot = root, exists = existsSync } = {}) {
  const render = dependencies.find((dependency) => dependency.repository === "opf-render");
  if (!render || consumer === "opf-render") return undefined;
  const name = `${OWNER}/opf-render#${render.number}`;
  const ci = await api(`/repos/${OWNER}/opf-render/contents/.github/workflows/ci.yml?ref=${encodeURIComponent(render.ref)}`);
  const override = goldenOverrideOf(Buffer.from(ci.content ?? "", ci.encoding === "base64" ? "base64" : "utf8").toString("utf8"));
  if (!override) return undefined;
  const golden = adoptableGolden(override, `Depends-On ${name}'s`);
  const ref = golden.repository === "opf-render" ? render.ref : refs.opf.ref;
  if (golden.repository === consumer) {
    if (!exists(path.join(localRoot, golden.path))) throw new Error(`Depends-On ${name} selects the golden ${override}, which does not exist in this checkout`);
  } else {
    try {
      await api(`/repos/${OWNER}/${golden.repository}/contents/${golden.path}?ref=${encodeURIComponent(ref)}`);
    } catch (error) {
      throw new Error(`Depends-On ${name} selects the golden ${override}, which does not exist at ${golden.repository} ${short(ref)} (${error.message})`);
    }
  }
  return { repository: golden.repository, path: golden.path, source: `adopted from Depends-On ${name} (golden-override in its ci.yml)` };
}

/**
 * The workspace-relative golden selection: an explicit override such as `opf-render/test/golden/x`, else a golden
 * adopted from a Depends-On renderer (dependsOnGolden), else the lock's.
 */
export function goldenSelection(lock, override, adopted) {
  if (override) {
    const [repository, ...rest] = override.split("/");
    if (!REPOSITORIES.includes(repository) || !isSafeRelativePath(rest.join("/"))) {
      throw new Error(`golden override ${JSON.stringify(override)} must be <repository>/<path> inside one of ${REPOSITORIES.join(", ")}`);
    }
    return { repository, path: rest.join("/"), source: "override" };
  }
  if (adopted) return adopted;
  return { repository: lock.golden.repository, path: lock.golden.path, source: "lock" };
}

/**
 * The commit each checkout uses: the locked SHA for every repository. The consumer's own entry is reported too (its
 * CI checks out its own head, not the lock). The golden is relative to the workspace (`<repository>/<path>`).
 */
export function resolveRefs(lock, { consumer, goldenOverride, overrides = {}, adoptedGolden } = {}) {
  if (consumer !== undefined && !REPOSITORIES.includes(consumer)) throw new Error(`--consumer must be one of ${REPOSITORIES.join(", ")}`);
  const refs = {};
  for (const name of REPOSITORIES) {
    if (overrides[name] && name !== consumer) refs[name] = { ref: overrides[name].ref, source: overrides[name].source };
    else refs[name] = { ref: lock.repositories[name].sha, source: name === consumer ? "own head (lock entry shown)" : "lock" };
  }
  const golden = goldenSelection(lock, goldenOverride, adoptedGolden);
  return { consumer, refs, golden: { ...golden, workspacePath: `${golden.repository}/${golden.path}` } };
}

/** Step outputs: repository names with underscores (`opf_render`), as GitHub expressions and ecosystem-pins.mjs use them. */
export function outputLines(resolved, lockFile) {
  const lines = REPOSITORIES.map((name) => `${name.replace(/-/g, "_")}=${resolved.refs[name].ref}`);
  lines.push(`golden=${resolved.golden.workspacePath}`, `golden_source=${resolved.golden.source}`, `lock_file=${lockFile}`);
  return lines;
}

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function annotate(level, title, message) {
  // GitHub workflow commands; plain text elsewhere.
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=${title}::${message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")}`);
  else console.log(`${level}: ${title}: ${message}`);
}

async function main(argv) {
  const [command, ...args] = argv;
  const lockFile = path.resolve(option(args, "--lock") ?? path.join(root, LOCK_FILE));
  if (command === "validate") {
    const lock = readLock(lockFile);
    console.log(`${path.relative(process.cwd(), lockFile) || lockFile} is valid: ${REPOSITORIES.map((name) => `${name} ${short(lock.repositories[name].sha)}`).join(", ")}; golden ${lock.golden.repository}:${lock.golden.path}.`);
    return 0;
  }
  if (command === "guard") {
    const lock = readLock(lockFile);
    const baseLockFile = option(args, "--base-lock");
    let baseLock;
    if (baseLockFile) {
      try {
        baseLock = parseLock(readFileSync(baseLockFile, "utf8"), baseLockFile);
      } catch (error) {
        console.log(`No comparable base lock (${error.message.split("\n")[0]}); the hand-edit check is skipped.`);
      }
    }
    const headRef = option(args, "--head-ref") ?? process.env.GITHUB_HEAD_REF;
    const blocking = args.includes("--blocking") || process.env.ECOSYSTEM_LOCK_GUARD === "blocking";
    const { problems, lines } = await guard(lock, githubApi(), { baseLock, headRef });
    for (const line of lines) console.log(line);
    for (const problem of problems) annotate(blocking ? "error" : "warning", "Ecosystem lock guard", problem);
    if (process.env.GITHUB_STEP_SUMMARY && problems.length) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Ecosystem lock guard (${blocking ? "blocking" : "warning only"})\n\n${problems.map((p) => `- ${p}`).join("\n")}\n`);
    }
    if (!problems.length) console.log("Every locked SHA is on its repository's main.");
    return problems.length && blocking ? 1 : 0;
  }
  if (command === "depends-on") {
    const bodyFile = option(args, "--body-file");
    const parsed = parseDependsOn(bodyFile ? readFileSync(bodyFile, "utf8") : readFileSync(0, "utf8"));
    console.log(JSON.stringify(parsed, null, 2));
    return 0;
  }
  if (command === "resolve") {
    const lock = readLock(lockFile);
    const consumer = option(args, "--consumer");
    const api = githubApi();
    const { overrides, warnings, dependencies } = await dependsOnOverrides(api, pullRequestOfEvent(), consumer);
    for (const warning of warnings) annotate("warning", "Depends-On", warning);
    const goldenOverride = option(args, "--golden-override") || undefined;
    const { refs } = resolveRefs(lock, { consumer, overrides });
    const adoptedGolden = goldenOverride ? undefined : await dependsOnGolden(api, { dependencies, refs, consumer });
    if (adoptedGolden) annotate("notice", "Depends-On golden", `golden ${adoptedGolden.repository}/${adoptedGolden.path} ${adoptedGolden.source}, instead of the lock's ${lock.golden.repository}/${lock.golden.path}`);
    const resolved = resolveRefs(lock, { consumer, goldenOverride, overrides, adoptedGolden });
    for (const name of REPOSITORIES) console.log(`${name.padEnd(10)} ${resolved.refs[name].ref} (${resolved.refs[name].source})`);
    console.log(`golden     ${resolved.golden.workspacePath} (${resolved.golden.source})`);
    if (args.includes("--github-output")) {
      if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is not set");
      appendFileSync(process.env.GITHUB_OUTPUT, `${outputLines(resolved, lockFile).join("\n")}\n`);
    }
    if (args.includes("--github-env")) {
      if (!process.env.GITHUB_ENV || !process.env.GITHUB_WORKSPACE) throw new Error("GITHUB_ENV or GITHUB_WORKSPACE is not set");
      appendFileSync(process.env.GITHUB_ENV, `OPF_GOLDEN_BASELINE=${path.join(process.env.GITHUB_WORKSPACE, ...resolved.golden.workspacePath.split("/"))}\n`);
    }
    return 0;
  }
  console.error("Usage: node scripts/ecosystem-lock.mjs validate|guard|resolve|depends-on (see the header of this file)");
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
