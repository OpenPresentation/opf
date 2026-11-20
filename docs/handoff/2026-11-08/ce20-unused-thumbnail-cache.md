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

Qualified runtime/test source is 49da7ea85e6bf70bcba62ee8c3a43ef7aa6646a8, tree a5ed5be5076bf71154a34600b75f92b4506fd756. At that exact source, workspace-browser (including the final 12-phase regression), embed-host-browser, thumbnail-strip-actions-browser and the normal 15-case Studio browser controls pass. No full performance benchmark was run.

Required mapped checks ran on that source. Build, Biome, changelog, font-hotlinks, skills, stability and text pass; types are correctly unselected. The editor contract runner stops at its unchanged codemirror-guard.mjs, whose directory symlink fails with Windows EPERM after 18 passing scripts. A bounded continuation uses the maintained selectTests/nodeArgs exports and executes all 125 not-reached scripts, without exclusions or changes: 124 pass; the unchanged native-playground-controls.mjs fails because its explicit Windows PowerShell child cannot find Get-FileHash. This control uses fake Office objects only; no actual Office automation occurred. Total selected scripts: 144 exercised, 142 pass, two environment failures. Aggregate mapped status remains RED, not green. Root requires real CI for a complete passing package result; no test/global-setting/privilege workaround or retry of those controls is included.

The sealed packet preserves 42 lossless transports, all initial failures, the detailed contract log, all remaining outcomes, real renderer selections and local screenshots. Its verifier binds four actual runtime/test inputs, seven source-commit files and 14 unchanged protected files, including both failing controls. Run node docs/handoff/2026-11-08/ce20-unused-thumbnail-cache/verify.mjs from the checkout. Pre-freeze focused observations are labeled separately; the exact-source workspace browser reruns the final regression.

Independent review identified a pre-existing sorter portrait crop, assigned by the coordinator to a separate branch. These screenshots are metadata/current-render-content witnesses, not proof of painted portrait fit. This cache branch contains no crop fix and makes no such qualification claim.

The coordinator owns independent review, publication, PR creation and wave integration. No provider/API/CI/push/Office/release action occurred here.

## Resume

Do not treat local work-count evidence as a published 0.34 package or a repaired 0.33 hosted preview. Root must obtain the required passing CI result, independently review the packet and normally fold the approved item into the 0.34 integration. The separate portrait crop and hosted qualification remain open. Never edit frozen site/runtime branches, chart files, generated fixtures or goldens.

Evidence-only 44-file mapped checks pass in29.4seconds after the frozen-source results. This checks the documentation/packet changes only; the original package mapped gate remains RED. The packet additionally preserves that raw result and the bounded continuation driver.
