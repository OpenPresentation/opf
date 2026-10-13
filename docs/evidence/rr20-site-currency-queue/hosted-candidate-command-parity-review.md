# Frozen hosted candidate command parity — read-only

No job log retrieval, API query, test execution or source edit. Frozen source set: corea94/renderer2b4/PPTX0c714/editorb45/Gallery7cff. Hosted failure cause is unknown without its failed-step evidence.

## Proven setup facts

`packages` is the Coordinated public packages aggregate (`.github/workflows/ecosystem-ci.yml:65–81`); it depends on `candidate`. A failing `candidate/source` makes the aggregate red. These are not necessarily two independent failures. This reusable candidate/source is **mode=ecosystem** (`:719–727`). OPF CI invokes the same reusable workflow separately with mode=core; its aggregate is named Verify OPF packages.

Hosted source setup genuinely does frozen pnpm/npm installs, resolves exact peer PR refs, authorizes Gallery through the maintained composite, exports `CANDIDATE_GALLERY_REF` into subsequent steps and materializes ignored catalog inputs. It exports the selected golden into `OPF_GOLDEN_BASELINE`; renderer2b4 does so explicitly before checking out selected core. `candidate-gallery-build.mjs` requires exact7cff, qualifies Gallery, primes shared core/peers and stages authenticated six-package artifacts. Thus a direct local worktree invocation with unset CANDIDATE_GALLERY_REF is different setup, not evidence of the hosted cause. Historical c10 local attempt03 lacked generated language catalogs; attempt04 materialized them and passed. Hosted composite already includes that materialization, so do not automatically propose it as the hosted repair.

Renderer2b4 gates incompatible pre-link registry-packed testing when candidate Gallery is selected, retaining the mandatory separate published-control plus later candidate packed/browser checks. Its own package job still executes source audit/type/validate/font/full/code/browser suites and further installed workflow/guard suites. Actual selected dependency SHAs are resolver outputs; without the run selection receipt they cannot be inferred solely from intended trailers. No stale-selection failure is established here.

## Existing local proof and missing parity

`/private/tmp/rr20-final-runtime-replay/results/receipt.json` binds exact frozena94/2b4/0c/b45/7cff and passes build, pack, test:packed-ecosystem and test:packed-browser. It does not record all mode=ecosystem commands below. `/private/tmp/rr20-core-c10-final-qualification/results/attempt04/receipt.json` proves canonical pnpm test at laterc10 with the same peers/Gallery; that is not the full reusable ecosystem workflow. c10 differs froma94 in gate tooling/docs and maintained native archive fixture metadata, not core layout runtime. Separate earlier package receipts may qualify individual source suites; avoid rerunning those merely because the combined full-tier entrypoint lists them.

## Maintained reproduction commands (not executed in this review)

Use pinned Node24/npm11.16/pnpm10.33.2 and actual reviewed candidate Gallery7cff. Primary cwd is `/private/tmp/rr20-final-runtime-replay/opf`; golden is that checkout's `scripts/fixtures/opf-examples-png.rr20-array-areas.sha256.json`. First read authenticated candidateArtifacts/installed graph identity; do not relink to newer roots. These commands write artifacts/cache and some source build outputs: preserve current replay/native receipts, or use an owned physical snapshot with the same byte-bound source and installed graph before running. No fake GitHub event/ref or weakened guard is required for local diagnostic execution.

The canonical linked full-tier command is:

```
node scripts/test-package-ecosystem.mjs --tier full
```

It invokes each sibling typecheck/validate/full test (+ renderer/PPTX code/fonts), then core test:skills/ecosystem/pagination/layout/lists/rich-text/data/fonts/image-treatments/placeholder-groups, demo:editor, rich-table build, pack:ecosystem, packed-ecosystem and CLI-packed. `scripts/package-ecosystem-plan.mjs` is authoritative. For a bounded missing-check replay, map those individual maintained steps against existing exact-source receipts and run only the unproven ones; the exact frozen replay already proves pack/packed consumer/browser, so those need no automatic duplicate.

Then the workflow's additional local checks, in core cwd, with authenticated candidate context retained:

```
node scripts/test-packed-types-infrastructure.mjs artifacts/npm/consumer
node scripts/quarantine.mjs run-suite installed-browser
node --test scripts/metric-outline-ink.test.mjs
node scripts/test-metric-outline-browser.mjs artifacts/metric-outline-browser
node scripts/quarantine.mjs run-deferred
```

These use installed local candidates and bundled fonts/browser; no intended hosted API. Infrastructure/browser tests may install temporary test dependencies or create artifacts, so network-free success depends on actual cache completeness; preserve any cache/setup failure.

The separately scoped published-registry block **clears CANDIDATE_GALLERY_REF**, just as workflow step env does. Do not clear it globally or let that empty value leak back into candidate source checks. In core cwd:

```
pnpm test:registry-ecosystem
pnpm test:layout-contracts:registry
pnpm test:packed-browser registry
editor_gate="$(node scripts/registry-sibling-gate.mjs ../opf-editor artifacts/npm/registry-consumer)"
if [ "$editor_gate" = run ]; then
  node ../opf-editor/test/json-editor-browser.mjs artifacts/editor/json-editor-registry.json artifacts/npm/registry-consumer
fi
node scripts/test-packed-browser-guards.mjs
node scripts/test-installed-code-guards.mjs --registry
pnpm test:registry-fidelity
node packages/cli/test/packed.mjs --registry
node scripts/test-quote-layout-geometry.mjs artifacts/npm/registry-consumer artifacts/quote-layout-geometry.json
node scripts/test-code-layout-geometry.mjs artifacts/npm/registry-consumer artifacts/code-layout-geometry.json
node scripts/test-code-layout-browser.mjs artifacts/npm/registry-consumer artifacts/code-layout-geometry.json artifacts/code-layout-browser.json
node scripts/test-metric-registry-guards.mjs artifacts/npm/registry-consumer
node scripts/test-metric-layout-geometry.mjs artifacts/npm/registry-consumer artifacts/metric-layout-geometry.json
node scripts/test-metric-layout-browser.mjs artifacts/npm/registry-consumer artifacts/metric-layout-geometry.json artifacts/metric-layout-browser.json
```

Registry consumer is currently absent in the exact frozen replay. Initial registry-ecosystem preparation therefore needs genuine npm registry access and installs the real published release-plan graph. Remaining registry contracts use that installed graph, immutable verificationRefs and registryToolchain; they may populate/rebuild cached browser bundles. Do not substitute source arrays for old published fixtures, alias source packages, change the release plan, or manufacture an unreleased declaration. The editor harness's custom extra layout now uses array cells while its consumer import selects installed publishededitor/core/Gallery2; that is a concrete boundary to investigate with this existing command, not a demonstrated failure. Generic registry controls mostly load immutable release fixtures, whereas this one invocation uses the current source harness. Any incompatible contract must be reported before proposing a fix.

Finally cwd `/private/tmp/rr20-final-runtime-replay/opf-render`, restore authenticated candidate env after the registry block:

```
node test/plain-whitespace-browser.mjs artifacts/plain-whitespace-browser
npm run test:font-variants-browser
```

Renderer's own package workflow includes further installed whitespace/readability/timeline/furniture/editor/acceptance commands at `.github/workflows/ci.yml:214–228`. They are not all proven by the packed-browser summary. Compare exact receipts before scheduling those; no new broad pnpmtest is needed to expose their boundary.

All commands above are a diagnostic parity plan, not proof they passed. Hosted Linux container/browser/font differences and actual selected refs remain unobserved. No speculative production fix or gate waiver is justified from this audit alone.
