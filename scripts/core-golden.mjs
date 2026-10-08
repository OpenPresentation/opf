// FA-00b: helpers of .github/workflows/regenerate-core-golden.yml, the workflow that regenerates core's examples golden
// fixture (scripts/fixtures/opf-examples-png.*.sha256.json, the one ecosystem.lock.json `golden` selects) for a branch
// of this repository. The workflow renders; this script decides, so every rule is unit-tested
// (scripts/core-golden.test.mjs) instead of living in shell.
//
//   node scripts/core-golden.mjs check-branch --branch <name> --default-branch <name>
//   node scripts/core-golden.mjs resolve --lock <ecosystem.lock.json> [--github-output]
//   node scripts/core-golden.mjs behind --paths-file <file>
//   node scripts/core-golden.mjs compare --expected <fixture> --actual <candidate.json>
//   node scripts/core-golden.mjs report --base <main fixture> --candidate <candidate.json> --branch-fixture <file> --out-dir <dir> [--note k=v ...] [--github-output]
//   node scripts/core-golden.mjs verify --base <main fixture> --candidate <file>
//   node scripts/core-golden.mjs paths --root <checkout> --allow <fixture> [--allow ecosystem.lock.json --allow scripts/fixtures/README.md]
//   node scripts/core-golden.mjs plan --main-golden <path> --branch-golden <path> --main-renderer <sha> --branch-renderer <sha> [--renderer-ref <ref> --fixture-name <name>] [--github-output]
//   node scripts/core-golden.mjs set-lock-golden --lock <ecosystem.lock.json> --path <fixture> --main-golden <path> --note <text>
//   node scripts/core-golden.mjs review-record --readme <file> --fixture <path> --branch <name> --head <sha> --renderer <sha> --renderer-ref <ref> --base-sha <sha> --changed-slides <n> --changed-decks <n> [--run-url <url>]
//
// renderer-ref (FA wave C, for one coordinated change such as OPF 0.15): the branch is rendered with that opf-render
// branch or commit instead of the locked renderer, into a NEW fixture (scripts/fixtures/opf-examples-png.<name>.sha256.json)
// that the branch's ecosystem.lock.json `golden` then selects; main's fixture is never overwritten. The guard still renders
// main with the locked renderer.
//
// Every command exits 1 with a message on a violated rule. `--github-output` appends step outputs to $GITHUB_OUTPUT.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLock } from "./ecosystem-lock.mjs";

/** A core fixture the workflow may write: a manifest directly under scripts/fixtures. */
export const FIXTURE_PATH = /^scripts\/fixtures\/[A-Za-z0-9._-]+\.sha256\.json$/u;
/** Files the push job may change besides the fixture, and only for a renderer-ref run: the lock's golden and the review record. */
export const RENDERER_REF_FILES = ["ecosystem.lock.json", "scripts/fixtures/README.md"];
/** The name of a new fixture: scripts/fixtures/opf-examples-png.<name>.sha256.json. */
export const FIXTURE_NAME = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;

/** Paths whose change on main moves what a branch renders (or which fixture is selected). */
export const GOLDEN_INPUT_PREFIXES = ["examples/", "packages/", "spec/", "scripts/fixtures/", "ecosystem.lock.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"];

export function isFixturePath(value) {
  return typeof value === "string" && FIXTURE_PATH.test(value) && !value.includes("..");
}

/** Reasons `name` cannot be regenerated: only a plain branch name of this repository, never the default branch. */
export function branchErrors(name, defaultBranch = "main") {
  const errors = [];
  if (typeof name !== "string" || name === "") return ["branch is empty"];
  if (name.includes(":")) errors.push(`"${name}" looks like <owner>:<branch> (a fork); only a branch of this repository is accepted`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(name)) errors.push(`"${name}" is not a plain branch name (letters, digits, . _ / - only, not starting with - or /)`);
  if (name.includes("..") || name.includes("//") || name.endsWith("/") || name.endsWith(".lock") || name.endsWith(".")) errors.push(`"${name}" is not a valid branch name`);
  if (/^(refs\/|origin\/|pull\/)/u.test(name)) errors.push(`"${name}" is a ref, not a branch name`);
  if (/^[0-9a-f]{40}$/u.test(name)) errors.push(`"${name}" is a commit SHA; a branch name is required`);
  if (name === defaultBranch) errors.push(`"${name}" is the default branch; regenerate a pull request branch`);
  return errors;
}

/** Reasons `ref` cannot name an OpenPresentation/opf-render branch or commit (a plain branch name or a 7-40 digit SHA). */
export function rendererRefErrors(ref) {
  if (typeof ref !== "string" || ref === "") return ["renderer-ref is empty"];
  if (/^[0-9a-f]{7,40}$/u.test(ref)) return [];
  const errors = [];
  if (ref.includes(":")) errors.push(`renderer-ref "${ref}" looks like <owner>:<branch>; only a branch or commit of OpenPresentation/opf-render is accepted`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(ref) || ref.includes("..") || ref.includes("//") || ref.endsWith("/") || ref.endsWith(".lock") || ref.endsWith(".")) errors.push(`renderer-ref "${ref}" is not a plain branch name or commit SHA`);
  if (/^(refs\/|origin\/|pull\/)/u.test(ref)) errors.push(`renderer-ref "${ref}" is a ref, not a branch name`);
  return errors;
}

/** The fixture a renderer-ref run writes. */
export function fixturePathFor(name) {
  if (typeof name !== "string" || !FIXTURE_NAME.test(name) || name.includes("..")) throw new Error(`fixture-name "${name}" must be lowercase letters, digits, . and - (it names scripts/fixtures/opf-examples-png.<name>.sha256.json)`);
  return `scripts/fixtures/opf-examples-png.${name}.sha256.json`;
}

/**
 * Which renderer renders the branch and which fixture it writes. Without a renderer-ref: the locked renderer, which the
 * branch must lock too, and the branch lock's own golden. With one: that renderer and a new fixture (never main's), and
 * the branch lock may lock another renderer (it is not the renderer that renders), so that check is relaxed.
 */
export function rendererPlan({ rendererRef = "", fixtureName = "", mainGolden, branchGolden, mainRenderer, branchRenderer }) {
  const errors = [], notes = [];
  if (!rendererRef) {
    if (fixtureName) errors.push("fixture-name is only for a renderer-ref run; without one the branch lock's golden is regenerated");
    if (mainRenderer !== branchRenderer) errors.push(`The branch locks opf-render ${branchRenderer}, main locks ${mainRenderer}. Rebase onto main (the lock is written by the roller) and dispatch again, or pass renderer-ref.`);
    return { override: false, fixturePath: branchGolden, errors, notes };
  }
  errors.push(...rendererRefErrors(rendererRef));
  let fixturePath = "";
  if (!fixtureName) errors.push("renderer-ref needs fixture-name: the run writes a new fixture, scripts/fixtures/opf-examples-png.<name>.sha256.json");
  else {
    try { fixturePath = fixturePathFor(fixtureName); } catch (error) { errors.push(error.message); }
    if (fixturePath && fixturePath === mainGolden) errors.push(`${fixturePath} is main's fixture, which main's lock still selects; choose another fixture-name`);
  }
  if (mainRenderer !== branchRenderer) notes.push(`renderer-ref ${rendererRef} renders the branch, so the branch lock's opf-render (${branchRenderer.slice(0, 12)}) need not equal main's (${mainRenderer.slice(0, 12)}): the "branch lock renderer must equal main's" check is relaxed for this run.`);
  else notes.push(`renderer-ref ${rendererRef} renders the branch instead of the locked renderer ${mainRenderer.slice(0, 12)}.`);
  return { override: true, fixturePath, errors, notes };
}

/** The lock text with `golden.path` (and `golden.note`) replaced, keeping the roller's formatting. */
export function lockWithGolden(lockText, fixturePath, note) {
  const lock = parseLock(lockText);
  if (!isFixturePath(fixturePath)) throw new Error(`${fixturePath} is not scripts/fixtures/<name>.sha256.json`);
  const golden = /("golden"\s*:\s*\{[^{}]*?"path"\s*:\s*)"[^"]*"/u;
  if (!golden.test(lockText)) throw new Error("ecosystem.lock.json has no golden.path to replace");
  let next = lockText.replace(golden, `$1${JSON.stringify(fixturePath)}`);
  if (note !== undefined) next = /("golden"\s*:\s*\{[^{}]*?"note"\s*:\s*)"(?:[^"\\]|\\.)*"/u.test(next) ? next.replace(/("golden"\s*:\s*\{[^{}]*?"note"\s*:\s*)"(?:[^"\\]|\\.)*"/u, `$1${JSON.stringify(note)}`) : next;
  const parsed = parseLock(next);
  if (parsed.golden.path !== fixturePath || parsed.golden.repository !== lock.golden.repository) throw new Error("rewriting golden.path changed something else");
  return next;
}

/** The paragraph a renderer-ref run appends to scripts/fixtures/README.md (the fixture review record). */
export function reviewRecord({ fixture, branch, head, renderer, rendererRef, baseSha, changedSlides, changedDecks, runUrl = "" }) {
  return `\n\`${path.basename(fixture)}\` was written by the \`regenerate-core-golden\` workflow${runUrl ? ` ([run](${runUrl}))` : ""} for \`${branch}\` @ \`${head.slice(0, 12)}\` with opf-render \`${renderer}\` (renderer-ref \`${rendererRef}\`, not the locked renderer), scale 0.25, systemFonts false. The same run first reproduced main @ \`${baseSha.slice(0, 12)}\`'s committed fixture with the locked renderer byte for byte. Against main's fixture, ${changedSlides} slides change in ${changedDecks} decks. The branch's ecosystem.lock.json \`golden\` selects this file; main's fixture is unchanged.\n`;
}

/** The lock's core golden: the repository must be opf and the file a core fixture. Also returns the locked renderer commit. */
export function resolveLock(lockText) {
  const lock = parseLock(lockText);
  if (lock.golden.repository !== "opf") throw new Error(`ecosystem.lock.json selects a golden in ${lock.golden.repository} (${lock.golden.path}); this workflow regenerates only core's scripts/fixtures`);
  if (!isFixturePath(lock.golden.path)) throw new Error(`golden.path ${lock.golden.path} is not scripts/fixtures/<name>.sha256.json`);
  return { goldenPath: lock.golden.path, rendererSha: lock.repositories["opf-render"].sha };
}

/** Changed paths of main since the branch forked (one per line) that change what the branch renders. */
export function goldenInputs(paths) {
  return paths.filter((file) => GOLDEN_INPUT_PREFIXES.some((prefix) => (prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix)));
}

export function splitKey(key) {
  const at = key.lastIndexOf("#");
  return { deck: key.slice(0, at), index: Number(key.slice(at + 1)) };
}
const compareKeys = (a, b) => {
  const left = splitKey(a), right = splitKey(b);
  return left.deck < right.deck ? -1 : left.deck > right.deck ? 1 : left.index - right.index;
};

/** Every top-level field except `entries`, one level of objects flattened (source.sha256, source.decks, ...). */
function flatten(manifest) {
  const flat = {};
  for (const [field, value] of Object.entries(manifest)) {
    if (field === "entries") continue;
    if (value && typeof value === "object") for (const [inner, innerValue] of Object.entries(value)) flat[`${field}.${inner}`] = JSON.stringify(innerValue);
    else flat[field] = JSON.stringify(value);
  }
  return flat;
}
const show = (value) => (value === undefined ? "(absent)" : value.replace(/"([0-9a-f]{64})"/u, (_, hash) => hash.slice(0, 12)));

/** Slide-level difference of two manifests, plus every changed top-level field (the corpus digest, scale, ...). */
export function diffManifests(base, candidate) {
  const changed = [], added = [], removed = [];
  for (const key of Object.keys(candidate.entries).sort(compareKeys)) {
    const next = candidate.entries[key], previous = base.entries[key];
    if (!previous) added.push({ key, ...splitKey(key), new: next.sha256 });
    else if (previous.sha256 !== next.sha256 || previous.bytes !== next.bytes) changed.push({ key, ...splitKey(key), old: previous.sha256, new: next.sha256 });
  }
  for (const key of Object.keys(base.entries).sort(compareKeys)) if (!candidate.entries[key]) removed.push({ key, ...splitKey(key), old: base.entries[key].sha256 });
  const meta = [], before = flatten(base), after = flatten(candidate);
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[field] !== after[field]) meta.push({ field, old: show(before[field]), new: show(after[field]) });
  }
  return { meta, changed, added, removed, total: Object.keys(candidate.entries).length };
}

const short = (hash) => hash.slice(0, 12);
function groupByDeck(rows) {
  const decks = new Map();
  for (const row of rows) decks.set(row.deck, [...(decks.get(row.deck) ?? []), row]);
  return decks;
}
export const slideCount = (diff) => diff.changed.length + diff.added.length + diff.removed.length;
export const deckCount = (diff) => new Set([...diff.changed, ...diff.added, ...diff.removed].map((row) => row.deck)).size;

/** Lines of `deck#index old -> new` for every changed, added and removed slide. */
export function slideLines(diff) {
  return [
    ...diff.changed.map((row) => `${row.key} ${short(row.old)} -> ${short(row.new)}`),
    ...diff.added.map((row) => `${row.key} (new) -> ${short(row.new)}`),
    ...diff.removed.map((row) => `${row.key} ${short(row.old)} -> (removed)`),
  ];
}

export function commitMessage(diff, { baseLabel = "main", runUrl = "", renderer = "", image = "", rendererRef = "" } = {}) {
  const meta = diff.meta.map((row) => `${row.field}: ${row.old} -> ${row.new}`);
  return [
    `Regenerate examples golden: ${slideCount(diff)} slides in ${deckCount(diff)} decks`,
    "",
    `Rendered by the regenerate-core-golden workflow${runUrl ? ` (${runUrl})` : ""}${renderer ? ` with opf-render ${renderer} (${rendererRef ? `renderer-ref ${rendererRef}, not the locked renderer` : "ecosystem.lock.json"})` : ""}, scale 0.25, systemFonts false${image ? `, in ${image}` : ""}. The same environment first reproduced ${baseLabel}'s committed fixture byte for byte. Compared with that fixture:`,
    ...(meta.length ? ["", ...meta] : []),
    "",
    ...(slideCount(diff) ? slideLines(diff).map((line) => `- ${line}`) : ["- no slide hash changes"]),
    "",
  ].join("\n");
}

/** Markdown for the job summary: a per-deck list the author pastes into the PR body (reason for each change), then every hash. */
export function summaryMarkdown(diff, { branch = "", head = "", base = "", goldenPath = "", renderer = "", rendererRef = "", notes = [] } = {}) {
  const lines = [`### Regenerated core golden: ${branch} @ ${head.slice(0, 12)}`, ""];
  lines.push(`- Fixture \`${goldenPath}\`, compared with main @ ${base.slice(0, 12)}; renderer opf-render @ ${renderer.slice(0, 12)} (${rendererRef ? `renderer-ref ${rendererRef}` : "ecosystem.lock.json"}).`);
  for (const note of notes) lines.push(`- ${note}`);
  for (const row of diff.meta) lines.push(`- \`${row.field}\`: ${row.old} -> ${row.new}`);
  lines.push(`- **${slideCount(diff)} slides changed in ${deckCount(diff)} decks** (${diff.changed.length} changed, ${diff.added.length} added, ${diff.removed.length} removed) of ${diff.total} slides.`, "");
  if (!slideCount(diff)) return `${lines.join("\n")}\nNo slide differs from main's fixture.\n`;
  lines.push("Paste into the pull request body and add the reason for each change:", "");
  const all = [...diff.changed.map((row) => ({ ...row, kind: "changed" })), ...diff.added.map((row) => ({ ...row, kind: "added" })), ...diff.removed.map((row) => ({ ...row, kind: "removed" }))];
  for (const [deck, rows] of groupByDeck(all.sort((a, b) => compareKeys(a.key, b.key)))) {
    const slides = rows.map((row) => `#${row.index}${row.kind === "changed" ? "" : ` (${row.kind})`}`).join(", ");
    lines.push(`- \`${deck}\`: ${slides} (${rows.length}). Reason: <why these slides change>`);
  }
  lines.push("", "<details><summary>Every changed hash (old -> new, 12 characters)</summary>", "", "| slide | old | new |", "|---|---|---|");
  for (const row of all) lines.push(`| \`${row.key}\` | ${row.old ? short(row.old) : "(new)"} | ${row.new ? short(row.new) : "(removed)"} |`);
  lines.push("", "</details>", "");
  return lines.join("\n");
}

/** A candidate must be the same kind of manifest as the base: version, format, scale and font policy cannot move here. */
export function manifestErrors(candidate, base) {
  const errors = [];
  if (!candidate || typeof candidate !== "object" || typeof candidate.entries !== "object" || candidate.entries === null) return ["the candidate is not a golden manifest"];
  for (const field of ["version", "format", "scale", "systemFonts"]) if (candidate[field] !== base[field]) errors.push(`${field} is ${JSON.stringify(candidate[field])}, the base fixture has ${JSON.stringify(base[field])}`);
  if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(Object.keys(base).sort())) errors.push("the candidate has other top-level fields than the base fixture");
  if (!/^[0-9a-f]{64}$/u.test(candidate.source?.sha256 ?? "")) errors.push("source.sha256 is not a sha256");
  const keys = Object.keys(candidate.entries);
  if (keys.length === 0) errors.push("the candidate has no entries");
  for (const key of keys) {
    const entry = candidate.entries[key];
    if (!/^[A-Za-z0-9._/-]+\.opf\.json#\d+$/u.test(key)) errors.push(`bad entry key ${key}`);
    else if (!/^[0-9a-f]{64}$/u.test(entry?.sha256 ?? "") || !Number.isInteger(entry?.bytes) || entry.bytes <= 0) errors.push(`bad entry ${key}`);
    if (errors.length > 10) break;
  }
  if (candidate.source?.decks !== new Set(keys.map((key) => splitKey(key).deck)).size) errors.push("source.decks does not match the entries");
  return errors;
}

/** What `git status` reports under `root`, as repo-relative paths (untracked files individually). */
export function changedPaths(root) {
  const result = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git status failed in ${root}: ${result.stderr}`);
  return result.stdout.split("\0").filter(Boolean).map((record) => record.slice(3));
}
export function pathErrors(changed, allowed) {
  const [fixture, ...also] = Array.isArray(allowed) ? allowed : [allowed];
  const errors = [];
  if (!isFixturePath(fixture)) errors.push(`${fixture} is not a core fixture (scripts/fixtures/<name>.sha256.json)`);
  for (const extra of also) if (!RENDERER_REF_FILES.includes(extra)) errors.push(`${extra} may not change (only ${RENDERER_REF_FILES.join(" and ")} besides the fixture)`);
  const permitted = new Set([fixture, ...also]);
  for (const file of changed) if (!permitted.has(file)) errors.push(`unexpected change outside the fixture: ${file}`);
  return errors;
}

function parseArguments(argv) {
  const options = { notes: [], allow: [] };
  const flags = new Set(["github-output"]);
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument ${argument}`);
    const name = argument.slice(2);
    if (flags.has(name)) { options[name] = true; continue; }
    const value = argv[++index];
    if (value === undefined) throw new Error(`--${name} needs a value`);
    if (name === "note") options.notes.push(value);
    else if (name === "allow") options.allow.push(value);
    else options[name] = value;
  }
  return options;
}
function output(options, values) {
  for (const [name, value] of Object.entries(values)) console.log(`${name}=${value}`);
  if (options["github-output"] && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([name, value]) => `${name}=${value}\n`).join(""));
}
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
function fail(message) { console.error(`::error title=regenerate-core-golden::${message}`); process.exit(1); }

function main(argv) {
  const [command] = argv;
  const options = parseArguments(argv);
  if (command === "check-branch") {
    const errors = branchErrors(options.branch, options["default-branch"] ?? "main");
    if (errors.length) fail(errors.join("; "));
    console.log(`branch ${options.branch} accepted`);
  } else if (command === "resolve") {
    let resolved;
    try { resolved = resolveLock(readFileSync(options.lock, "utf8")); } catch (error) { fail(error.message); }
    output(options, { "golden-path": resolved.goldenPath, "renderer-sha": resolved.rendererSha });
  } else if (command === "behind") {
    const inputs = goldenInputs(readFileSync(options["paths-file"], "utf8").split("\n").map((line) => line.trim()).filter(Boolean));
    if (inputs.length) fail(`main changed ${inputs.length} golden input(s) since this branch forked (${inputs.slice(0, 5).join(", ")}${inputs.length > 5 ? ", ..." : ""}). Rebase the branch onto main, then dispatch again.`);
    console.log("main has no golden-affecting change that the branch lacks");
  } else if (command === "compare") {
    const expected = readFileSync(options.expected), actual = readFileSync(options.actual);
    if (expected.equals(actual)) { console.log(`reproduced ${options.expected} byte for byte`); return; }
    const diff = diffManifests(JSON.parse(expected.toString("utf8")), JSON.parse(actual.toString("utf8")));
    console.error(`The rendered fixture differs from the committed one: ${slideCount(diff)} slides (${deckCount(diff)} decks), ${diff.meta.length} top-level fields.`);
    for (const row of diff.meta) console.error(`  ${row.field}: ${row.old} -> ${row.new}`);
    for (const line of slideLines(diff).slice(0, 40)) console.error(`  ${line}`);
    fail("the environment does not reproduce main's committed fixture, so nothing is pushed (renderer, Node, image or fonts differ from the ones that wrote it, or main's fixture is stale)");
  } else if (command === "verify") {
    const errors = manifestErrors(readJson(options.candidate), readJson(options.base));
    if (errors.length) fail(errors.join("; "));
    console.log("candidate is a golden manifest of the same kind as the base");
  } else if (command === "report") {
    const base = readJson(options.base), candidateText = readFileSync(options.candidate), candidate = JSON.parse(candidateText.toString("utf8"));
    const errors = manifestErrors(candidate, base);
    if (errors.length) fail(errors.join("; "));
    const diff = diffManifests(base, candidate);
    const fixture = options["branch-fixture"] && options["branch-fixture"] !== "none" ? (() => { try { return readFileSync(options["branch-fixture"]); } catch { return undefined; } })() : undefined;
    const context = { branch: options.branch, head: options.head ?? "", base: options["base-sha"] ?? "", goldenPath: options["golden-path"] ?? "", renderer: options.renderer ?? "", rendererRef: options["renderer-ref"] ?? "", notes: options.notes };
    mkdirSync(options["out-dir"], { recursive: true });
    writeFileSync(path.join(options["out-dir"], "changes.json"), `${JSON.stringify(diff, null, 2)}\n`);
    writeFileSync(path.join(options["out-dir"], "summary.md"), summaryMarkdown(diff, context));
    writeFileSync(path.join(options["out-dir"], "commit-message.txt"), commitMessage(diff, { baseLabel: `main ${context.base.slice(0, 12)}`, runUrl: options["run-url"] ?? "", renderer: context.rendererRef ? context.renderer : context.renderer.slice(0, 12), image: options.image ?? "", rendererRef: context.rendererRef }));
    output(options, { "changed-slides": slideCount(diff), "changed-decks": deckCount(diff), "push-needed": !fixture || !fixture.equals(candidateText) });
  } else if (command === "paths") {
    const errors = pathErrors(changedPaths(options.root), options.allow);
    if (errors.length) fail(errors.join("; "));
    console.log(`only ${options.allow.join(", ")} changed`);
  } else if (command === "plan") {
    const plan = rendererPlan({ rendererRef: options["renderer-ref"] ?? "", fixtureName: options["fixture-name"] ?? "", mainGolden: options["main-golden"], branchGolden: options["branch-golden"], mainRenderer: options["main-renderer"], branchRenderer: options["branch-renderer"] });
    for (const note of plan.notes) console.log(`::notice title=regenerate-core-golden::${note}`);
    if (plan.errors.length) fail(plan.errors.join("; "));
    output(options, { override: plan.override, "fixture-path": plan.fixturePath });
  } else if (command === "set-lock-golden") {
    if (options.path === options["main-golden"]) fail(`${options.path} is main's fixture; a renderer-ref run writes a new one`);
    writeFileSync(options.lock, lockWithGolden(readFileSync(options.lock, "utf8"), options.path, options.note));
    console.log(`${options.lock} golden.path = ${options.path}`);
  } else if (command === "review-record") {
    if (rendererRefErrors(options["renderer-ref"]).length) fail(rendererRefErrors(options["renderer-ref"]).join("; "));
    appendFileSync(options.readme, reviewRecord({ fixture: options.fixture, branch: options.branch, head: options.head, renderer: options.renderer, rendererRef: options["renderer-ref"], baseSha: options["base-sha"], changedSlides: options["changed-slides"], changedDecks: options["changed-decks"], runUrl: options["run-url"] ?? "" }));
    console.log(`appended the review record to ${options.readme}`);
  } else {
    fail(`unknown command ${command ?? "(none)"}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { fail(error.message); }
}
