# App #46 canonical production acceptance — executed, 11/19 passed

Parent supplied accepted merge c558dcc3a2e362bc238eb433a2db97fa682dfcc8 and deployment.json READY binding. The single run completed11/19; see REPORT.md. No reruns.

Prepared from clean worktree `/private/tmp/opf-issue88-explicit-formatting-20260921/pptx-dev`, commit `59e888580c38ca5cfbf5105b2ec09c2bfc956ca1`, tree `21a27c9fa459f04db24dc2759acc1bb6d9ed93b8`. `acceptance-list.txt` confirms 19 tests in 10 files. `test-input-hashes.json` pins source and tests, including the shared editor option, the restored long-quote readiness allowance and the new warm-worker paste/explicit-format regression. `runtime-prepared.json` records Node24, Playwright1.63 and the installed default headless Chromium descriptor/binary hash; this is a static inventory, not a browser execution claim.

Executed once, with no retries or source/test changes:

```sh
# Working directory: /private/tmp/opf-issue88-explicit-formatting-20260921/pptx-dev
env -u OPF_BROWSER_STORAGE_STATE \
  OPF_APP_URL=https://www.pptx.dev \
  PLAYWRIGHT_JSON_OUTPUT_FILE=/private/tmp/opf-issue88-app46-production-20260921/results.json \
  '/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' \
  node_modules/@playwright/test/cli.js test --reporter=list,json \
  --output=/private/tmp/opf-issue88-app46-production-20260921/results \
  > /private/tmp/opf-issue88-app46-production-20260921/browser.log 2>&1
```

All contexts are isolated and anonymous; the existing suite uses browser-local workspaces, local source import/download, and ordinary UI actions. No account/backend writes are requested. The production URL disables local server startup. Preserve every failure's trace and context, all generated source/worker/export artifacts, screenshots, structured runner result and exit code. Review relevant wide/narrow source editing, Author choices, render recovery and font diagnostic screenshots, and the warm-worker authored/copied source equality plus absence of implicit format requests. Record only pageerror/offline-write conclusions that passed tests actually assert.

The earlier canonical app45 run remains 14/18; see `prior-failure-evidence.json` for exact paths and hashes. Its unresolved CRLF third-popup failure remains reliability history even if app46's run passes. A separate prior instrumented CRLF pass did not establish root cause. Native PowerPoint/font compatibility remains a separate gate; this browser run cannot close it or the overall goal.

After the run, write `REPORT.md`, `acceptance-summary.json` and a complete `SHA256SUMS`, with deployment source binding and visual review findings. Do not replace this history with a retried green run.
