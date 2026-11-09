# CE-20 unused thumbnail cache regression — 2026-11-08

Worktree: C:/opf-work/ce20-cache. Branch: codex/ce-20-unused-thumbnail-cache. Base: fresh origin/main 9545016583ccfa151077cda4d51043ac6505a140. The four relevant workspace/cache/strip/browser-fixture source files are byte-identical to the coordinator's integration assembly before this change.

## Confirmed defect

A slots host with a canvas but no slide-manager or sorter allocates the workspace thumbnail cache because it needs slide parts. Every non-Studio refresh eagerly prepares that cache, even though no mounted part consumes it. The actual thumbnail strip has a separate lazy cache. A dimension edit invalidates inherited metadata and needlessly renders every slide into the unused cache.

The real-renderer before control fails on a 20-slide canvas-only host: selections are 1, 1, then the unused array 1 through 20. This is measured work, not an inferred elapsed-time cause. The prior hosted Org qualification trace has no CPU profile; this fix does not claim to explain all hosted latency or qualify that deployment.

## Vetoable decision CE20-CACHE-CONSUMER

Keep cache construction and public APIs unchanged. Eager preparation is needed only when the slide manager exists or an existing sorter is active and about to render. Leave the Studio path, actual thumbnail strip and its lazy cache, fonts, source readiness, history and site package pins unchanged. The cache's existing html method prepares current metadata when a later real consumer first requests a thumbnail.

Only packages/editor/src/workspace.js changes runtime behavior. The browser regression forwards every renderer call to the actual SVG renderer through the existing test bundle alias mechanism; it records selections and checks current canvas, strip and manager aspect ratios. It is called by the existing workspace-browser runner, without changing package manifests or CI test lists.

## Qualification and retained results

- Pinned Node 24.20.0 / pnpm 10.33.2 offline frozen install and baseline package build pass. Initial missing prebuild binary warnings are retained.
- Actual unchanged-main before control fails at the unused full-deck batch assertion.
- Two initial forward-fixture attempts are retained: the test tried to mutate getDocument's immutable snapshot, so its intended metadata edit did not occur. The fixture now clones that documented snapshot before editing; product code, assertions and timeouts were not changed to fix those setup failures.
- Forward real-renderer control passes 12 phases: canvas-only before/after metadata change; Org-like slots before/after same-title 4:3 and portrait edits; actual manager before/after metadata change; default layout before sorter, active sorter, edit while sorter hidden, and sorter reopened.
- Org-like strip draws 9 of 20 slides and default strip 4 of 20 in the local harness. Metadata edits request only the current canvas and visible strip. Actual manager and active/later sorter still request all 20 and show their current dimensions.
- Current exact source/verdict agreement is checked after same-title source edits. Existing source-readiness behavior is preserved.
- Local harness screenshots were inspected for Org portrait and reopened portrait sorter. These are source/render witnesses, not hosted-site fit or native PowerPoint qualification.

Remaining local checks and their exact source identity will be recorded in the sealed packet. The coordinator owns independent review, publication, PR creation and wave integration. No provider/API/CI/push/Office/release action is delegated here.

## Resume

Do not treat local work-count evidence as a published 0.34 package or a repaired 0.33 hosted preview. Complete required mapped checks and scoped existing browser/cache controls, seal raw successes and failures, and report the final commit/tree to the coordinator. Never edit frozen site/runtime branches, chart files, generated fixtures or goldens.
