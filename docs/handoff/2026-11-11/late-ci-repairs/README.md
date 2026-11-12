# Late CI repairs — focused results

The final maintained e210 snapshot retained two late failures beyond the earlier collected set: Windows PPTX3/3 still observed the long seed path while the fixture expected RUNNER~1; Node26.13 render2 overflowed inside the production whole-font-URL regexp. Both original job logs and the final snapshot are bound in the [manifest](manifest.json). No old failure is relabeled.

## Font data URL validator

Reviewed leaf0d6f0b90822191bc810b74fdacf39e719a2ab874 normally folds in the coherent root. The new validator keeps the bounded MIME-prefix regexp and scans the unbounded ASCII payload without recursion, backtracking, suffix copies or a new size cap. Existing URI language, coercion, error behavior, family/weight checks, cache invalidation and embedding permissions remain. The finite224-case audit agrees with the old regexp; the new public regression uses the actual7641925-character complete Noto Sans JP URL.

An isolated official Node26.13.0 installation reproduces the original failure on the retained old compiled renderer in4.801s. This is explicitly a before-control: current source was not yet built, and all609 old compiled identities were verified. After one coherent seven-package build in5.509s, all four maintained files pass on both Node26.13.0 and24.21.0: embedded-font-data-url, the original script-fonts-auto-robust case, svg-fstype and svg-font-embedding. That is8/8 actual runs with preserved full logs. No runtime version or font bytes were substituted to make the test pass.

The rebuilt MCP resource also passes all3 real stdio/frame tests. Its escaped production message is10478921bytes against the unchanged10485760-byte limit, leaving6839bytes. Limits and metadata shape are unchanged.

## Windows fixture

Reviewed leaf591a0ae7324c76d28414c297a96f9400a5eb142b normally folds. Only the two owned-fixture realpath calls use the native OS binding; lexical/canonical seed strings and BigInt device/file identity must agree. All production path/hash/Open/no-Office guards and the complete existing assertion tail remain exact. Actual Windows alias-path qualification remains required. A Mac skip or natural long-TEMP run is not claimed as that coverage.

## Interrupted earlier gate

The earlier464e coherent run was deliberately stopped after13 completed steps passed, including all193 renderer scripts and the728-slide template lock (519.2s). Its PPTX suite was partial and editor suite had not run. It is **INTERRUPTED, NOT PASS**. Exact owned Node/shell process-group verification, SIGTERM record, preserved selected-step identities and post-stop clean source/all609 unchanged compiled files are retained. No Office or user process was targeted. The stop batches the two new reviewed repairs before repeating complete suites once on the final candidate; it is not a gate waiver.

The current combined source still needs its maintained mapped gate, exact-head full CI/actual Windows alias result, fresh W06 graph/smoke/normal qualification and remaining explicitly prepared native cases. Canonical1225 remains a held draft; no main merge, release or genuine034 delivery occurred here.
