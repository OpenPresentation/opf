# Linux preview readiness failure — run 35609087103

Commit `9ea7ece4e3ecc88e33157970f475d32423e9edf6`. Linux17/18 browser tests pass; Windows18/18 and its entire job pass. Run/job receipt is retained in `run-status.json`; full logs, failure trace, error snapshot, source diff, and structured diagnosis are retained beside this report.

## Cause

The anonymous Inspector workflow changes the five-slide starter document into the one-slide fixture. Source and gallery update before the renderer's deferred preview state/effect. At inspector.spec.ts:115, `.toBeVisible()` is applied to an unqualified renderer SVG locator while it still matches the five starter slides. Playwright's strict-single-element assertion fails in92.497ms, without waiting for its5000ms budget. The trace's81network entries have no failures or HTTP errors. This is a missing test readiness condition, unrelated to the preceding platform-role-only test change.

`components/playground/playground-shell.tsx` derives parsing from `useDeferredValue(opfText)` and separately publishes `previewState` from an effect. The test's gallery-title expectation therefore does not establish renderer readiness.

## Precise correction

Only `tests/e2e/inspector.spec.ts` changes. A shared single-slide preview helper waits for exactly one renderer SVG, then its exact authored title in `aria-label`. Existing visibility checks remain. Applied to the two anonymous-flow preview assertions and the long-quote single-slide boundary. No `.first()`, forced action, sleep, rerun, timeout increase, product change, or weakened source assertion.

This strengthens the previous check: it now proves the intended document is shown rather than any renderer SVG being visible. A stuck starter preview still fails, and an incorrect one-slide preview fails its title assertion.

## Focused acceptance

```sh
env -u OPF_BROWSER_STORAGE_STATE OPF_APP_URL=http://127.0.0.1:4325 '/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' node_modules/@playwright/test/cli.js test tests/e2e/inspector.spec.ts --grep 'published long quotes|anonymous JSON authoring' --output=/private/tmp/opf-issue88-preview-ready-results > /private/tmp/opf-issue88-preview-ready.log 2>&1
```

Node24, existing local production build:2/2pass3.6s. `tsc --noEmit` and `git diff --check` pass. Exact proposed patch is `preview-readiness.diff`. No commits/builds/deployments performed by this agent. Fresh full CI remains required on the final test commit before app merge and production acceptance.
