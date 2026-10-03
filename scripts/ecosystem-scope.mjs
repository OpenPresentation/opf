// RR-40: decide whether the coordinated ecosystem checks in .github/workflows/ecosystem-ci.yml must run.
//
// The answer is "skip" only for a pull request whose every changed path is program tracking or native
// evidence that no ecosystem check reads: docs/programs/** and docs/evidence/** (except evidence decks,
// *.opf.json, which the ecosystem geometry checks load). Everything else runs in full: every other path,
// every push to main, every manual run, and any case this script cannot classify. `Verify OPF packages`
// (opf-ci.yml) runs `pnpm test` on every change, including these paths, so the program report, font
// tracker and audit tests under docs/programs still gate.
//
// Usage (inside the opf checkout of a pull_request merge commit):
//   node scripts/ecosystem-scope.mjs            # prints the decision, writes run=true|false to $GITHUB_OUTPUT
//   node scripts/ecosystem-scope.mjs --files a b # classifies the given paths instead (local check)
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** True when no ecosystem check reads `file`, so a change to it cannot change their result. */
export function isEcosystemIndependent(file) {
  if (file.startsWith("docs/programs/")) return true;
  if (file.startsWith("docs/evidence/")) return !file.endsWith(".opf.json");
  return false;
}

/** The ecosystem checks run unless the change is non-empty and every path is independent of them. */
export function ecosystemScope(files) {
  if (files.length === 0) return { run: true, reason: "no changed paths could be listed" };
  const relevant = files.filter((file) => !isEcosystemIndependent(file));
  if (relevant.length > 0) return { run: true, reason: `${relevant.length} of ${files.length} changed paths can affect the ecosystem`, relevant };
  return { run: false, reason: `all ${files.length} changed paths are under docs/programs or docs/evidence (no evidence decks)` };
}

function changedFiles() {
  // A pull_request checkout is the merge commit of the head into the base: its first parent is the base.
  // --no-renames lists both sides of a rename, so moving a script into docs/evidence is not docs-only.
  const out = execFileSync("git", ["diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * The decision for one workflow event. Only a pull_request can skip: its checkout is a merge commit whose first parent
 * is the base, so the changed paths are known. Every other event runs in full, including `merge_group` (RR-48): a
 * merge queue run has no pull_request payload and is the last gate before main, so the queue always tests the whole
 * coordinated ecosystem (ci-cd.md, tier T2).
 */
export function scopeForEvent(event, listChangedFiles) {
  if (event !== "pull_request") return { run: true, reason: `${event} runs always run the ecosystem checks` };
  try {
    return ecosystemScope(listChangedFiles());
  } catch (error) {
    return { run: true, reason: `could not list the changed paths (${error.message.split("\n")[0]})` };
  }
}

function main(argv) {
  const event = process.env.GITHUB_EVENT_NAME ?? "local";
  const decision = argv[0] === "--files" ? ecosystemScope(argv.slice(1)) : scopeForEvent(event, changedFiles);
  const line = `Ecosystem checks: ${decision.run ? "run" : "skipped"} (${decision.reason}).`;
  console.log(line);
  if (decision.relevant) console.log(decision.relevant.slice(0, 20).join("\n"));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${decision.run}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && !decision.run) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${line} The job reports success without running them; \`Verify OPF packages\` still runs \`pnpm test\`, and the push to main after merge runs them in full.\n`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
