# Test quarantine and flake measurement (RR-47)

A flaky browser test costs a push and a full ecosystem run each time it fails (12 to 25 minutes). This directory holds the
rule that keeps such a test visible without letting it block unrelated work, and the measurement that finds them.

## The rule

- **A quarantine entry is a gate change.** A pull request that adds or renews an entry in `test/quarantine.json` needs the
  release-readiness supervisor's approval, written in the pull request, before it merges. Agents and contributors never
  quarantine a test on their own authority. The first answer to a flake is to fix the wait or the race at its root, never
  to loosen an assertion or add a blanket retry.
- **Every entry has** `id` (a test id from `test/browser-suites.json`), `issue` (a link to the tracking issue),
  `owner`, `reason` (one sentence), `added` and `expires` (`YYYY-MM-DD`). `expires` is at most 14 days after `added`.
  A renewal sets a new `added` and `expires` and needs the same approval, so an entry cannot quietly become permanent.
- **A quarantined test still runs.** `node scripts/quarantine.mjs run-suite <suite> --dir packages/render` (the root script, from the repository root) defers it to a separate, non-blocking
  step (`run-deferred`, `continue-on-error`) that reports its result in the job summary and as an annotation. The blocking
  step passes without it.
- **An expired entry fails CI.** `node scripts/quarantine.mjs check --dir packages/render` (the root `check:quarantine`, a CI step) fails when an entry is malformed, names an
  unknown test, or has passed its `expires` date. An expired entry is also no longer honoured: its test is a gate again.
- The list starts empty. Removing an entry (the fix landed) needs no approval.

## Files

| File | Purpose |
|---|---|
| `test/quarantine.json` | The list. `{ "schema": 1, "entries": [] }` when nothing is quarantined. |
| `test/browser-suites.json` | The browser suites: setup commands and tests with stable ids (a suite with `continueOnFailure` runs every test and fails at the end). CI runs them through `quarantine.mjs run-suite`; the measurement runs the same list. |
| `scripts/quarantine.mjs` (repository root) | `check`, `run-suite <suite>`, `run-deferred`, each with `--dir packages/render`. Plain Node, no dependencies. |
| `scripts/flake-repeat.mjs` (repository root) | The measurement (`--dir packages/render`). Runs each suite N times and writes a pass rate per test. |
| `scripts/quarantine.test.mjs` (repository root) | Unit tests of the rule and both scripts (`node --test`). |
| the root nightly workflow | The scheduled repeat (MR-3x folds `flake-repeat.yml` into it). |

An entry looks like this (an example, not a real entry):

```json
{
  "id": "browser:lazy-fonts-browser",
  "issue": "https://github.com/OpenPresentation/opf-render/issues/0000",
  "owner": "@github-handle",
  "reason": "The first assertion races the font load on the Linux runner.",
  "added": "2026-10-03",
  "expires": "2026-10-17"
}
```

## Measurement

The root nightly workflow (MR-3x) runs the measurement nightly and on demand (`workflow_dispatch`, input `repeat`). It checks out `main`,
builds what CI builds, and runs every suite in `test/browser-suites.json` five times (suites `browser`, `browser-fonts` and `rich`: the browser steps of the CI package job except the variable-font gate, whose tolerance is not quarantinable). The job summary lists the pass rate
and median duration per test, with the tail of each failure, and `flake-repeat.json` is uploaded as an artifact (30 days).
A test that failed at least once raises a `Flaky test` annotation. The measurement never gates: it exits 0 unless a suite
cannot be set up.

To run it locally, from the repository root: `node scripts/flake-repeat.mjs --dir packages/render --suite <name> --repeat 5`.
