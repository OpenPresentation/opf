// RR-50: ecosystem.lock.json, the record of the four OpenPresentation commits that passed the coordinated ecosystem checks
// together (docs/programs/release-readiness/ci-cd.md, section 3).
//
// MR-34: this file is the FROZEN SHIM of the monorepo program (docs/programs/monorepo/README.md, section 2). The roller that wrote
// the lock, the guard and core's own use of the lock are deleted; what stays is what the archived repositories' CI still calls
// through `OpenPresentation/opf/.github/actions/ecosystem-refs@main` until MR-60 deletes the action, this script, the lock and its
// schema together. Nothing in this repository reads it any more, and nothing writes the lock.
//
// Usage:
//   node scripts/ecosystem-lock.mjs validate [--lock ecosystem.lock.json]
//   node scripts/ecosystem-lock.mjs resolve --consumer <repository> [--lock <file>] [--github-output]
//   node scripts/ecosystem-lock.mjs depends-on [--body-file <file>]   # prints what a body declares (no network)
//
// `resolve` is what the archived repositories' CI runs (through .github/actions/ecosystem-refs): it prints, and writes as step
// outputs, the commit to check out for each of the four repositories (opf, opf_render, opf_pptx, opf_editor).
//
// Depends-On (pull_request and merge_group events): a line `Depends-On: OpenPresentation/<repository>#<number>` in the pull
// request body (read through the REST API, so editing the body and re-running the job picks it up) makes `resolve`
// check out that pull request instead of the lock entry: its test merge commit while it is open and mergeable, its
// head otherwise, and its merge commit (on main) once merged. A closed, unmerged dependency fails the step.
// In the merge queue the pull request is the one named by the queue branch (`gh-readonly-queue/<base>/pr-<n>-<sha>`).
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER = "OpenPresentation";
export const REPOSITORIES = ["opf", "opf-render", "opf-pptx", "opf-editor"];
export const LOCK_FILE = "ecosystem.lock.json";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA = /^[0-9a-f]{40}$/;
const TOP_LEVEL = new Set(["$schema", "$comment", "version", "repositories", "provenance"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function short(sha) {
  return sha ? sha.slice(0, 12) : "(none)";
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

/** The queue branch of a merge_group run, `[refs/heads/]gh-readonly-queue/<base>/pr-<number>-<40-hex sha>`. */
const MERGE_QUEUE_REF = /^(?:refs\/heads\/)?gh-readonly-queue\/.+\/pr-(\d+)-[0-9a-f]{40}$/;

/**
 * The pull request this run tests: a pull_request event's own, or a merge_group event's head pull request (parsed from
 * `merge_group.head_ref`; its body is read through the REST API by dependsOnOverrides). Other events have none.
 */
export function pullRequestOfEvent(env = process.env) {
  if (env.GITHUB_EVENT_NAME === "merge_group" && env.GITHUB_EVENT_PATH) {
    const match = MERGE_QUEUE_REF.exec(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).merge_group?.head_ref ?? "");
    return match ? { repository: env.GITHUB_REPOSITORY, number: Number(match[1]), body: "" } : undefined;
  }
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

/**
 * The commit each checkout uses: the locked SHA for every repository. The consumer's own entry is reported too (its
 * CI checks out its own head, not the lock).
 */
export function resolveRefs(lock, { consumer, overrides = {} } = {}) {
  if (consumer !== undefined && !REPOSITORIES.includes(consumer)) throw new Error(`--consumer must be one of ${REPOSITORIES.join(", ")}`);
  const refs = {};
  for (const name of REPOSITORIES) {
    if (overrides[name] && name !== consumer) refs[name] = { ref: overrides[name].ref, source: overrides[name].source };
    else refs[name] = { ref: lock.repositories[name].sha, source: name === consumer ? "own head (lock entry shown)" : "lock" };
  }
  return { consumer, refs };
}

/** Step outputs: repository names with underscores (`opf_render`), as GitHub expressions use them. */
export function outputLines(resolved, lockFile) {
  const lines = REPOSITORIES.map((name) => `${name.replace(/-/g, "_")}=${resolved.refs[name].ref}`);
  lines.push(`lock_file=${lockFile}`);
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
    console.log(`${path.relative(process.cwd(), lockFile) || lockFile} is valid: ${REPOSITORIES.map((name) => `${name} ${short(lock.repositories[name].sha)}`).join(", ")}.`);
    return 0;
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
    const { overrides, warnings } = await dependsOnOverrides(api, pullRequestOfEvent(), consumer);
    for (const warning of warnings) annotate("warning", "Depends-On", warning);
    const resolved = resolveRefs(lock, { consumer, overrides });
    for (const name of REPOSITORIES) console.log(`${name.padEnd(10)} ${resolved.refs[name].ref} (${resolved.refs[name].source})`);
    if (args.includes("--github-output")) {
      if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is not set");
      appendFileSync(process.env.GITHUB_OUTPUT, `${outputLines(resolved, lockFile).join("\n")}\n`);
    }
    return 0;
  }
  console.error("Usage: node scripts/ecosystem-lock.mjs validate|resolve|depends-on (see the header of this file)");
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
