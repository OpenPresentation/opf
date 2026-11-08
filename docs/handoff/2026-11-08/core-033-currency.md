# Core v0.33 currency and artifact refresh

Source preflight: actual main afac3f7fc07539667fe9298f8efc08c967aacb0d, 2026-11-08. This branch is separate from all v0.34 preparation. [Exact counts and tool/input hashes](core-033-currency/source-preflight.json).

## Scope and publication boundary

Existing main already pins 0.33.0 in README, quickstart, compatibility matrix and agent-skills, and records 36 layouts. This patch corrects the remaining current facts: 137 JSON examples (101 gallery, 36 technical), two Markdown decks outside the generated catalog, the optional seventh MCP package in the package table, and the distinction between the six-package consumer plan and all seven release packages. The quickstart's Mermaid exclusion describes its test coverage, not missing Mermaid export. Historical version contracts remain unchanged. No DOT/PlantUML, new layout records, new live domains, LibreOffice promotion or video playback claim is added.

Vetoable decisions: keep the explicit 0.33.0 installation pins for reproducibility; correct the remaining count and capability wording rather than repeat an already-completed version bump. Prepare this as a draft while publication is pending. Do not merge or label any output as genuine 0.33 until the coordinator supplies the trusted release/registry/provenance receipts and the consumer check below passes. Source counts are not registry evidence. The local manifests still say 0.32.1 until the Release workflow stamps them; this branch does not change them.

## Post-publication F3 / A1-A2 checklist

- Coordinator: complete the Release workflow dry run and real release; verify tag/release identity and all seven registry/provenance receipts. No local publish, tag, deploy or login is authorized here.
- Core docs owner: run node scripts/registry-plan.mjs once and retain its JSON. It queries the current latest of six packages, excluding MCP; assert that the returned versions and gitHeads match the accepted 0.33 release. Do not override a tag or substitute local packages. MCP's seventh-package receipt comes from trusted publication verification.
- Core docs owner: run node scripts/test-developer-quickstart.mjs once from the normal built checkout and retain the complete log. It makes a fresh registry-only consumer, rejects file/workspace links and tests validation, fonts, composition, pagination, edit/undo and SVG/PNG/PDF/PPTX. It does not qualify actual Office or the MCP viewer. Hold if registry latest is not the genuine intended set.
- Compare installed @openpresentation/opf/examples length and installed gallery layouts length with this source receipt (137 and 36); retain the package-lock integrity/resolved URLs. Keep the quickstart fixture outside the catalog and do not count the two Markdown files as JSON records.
- Then merge the narrow core docs PR through the coordinator's batched gate. The sites agent owns all three sites' package bumps, mirrored docs, generated images, editor/MCP bundles, localhost builds and PR previews. Site main merges, deploys, DNS and logins remain owner-only. Do not run site generators from this branch.
- Repeat these pins/count checks after the real 0.34 release (F3), with the final accepted source rather than this 0.33 checkout. New three-layout semantics and the final 40-layout sampler remain the existing F1 lane.

## E1: first comparison refresh, genuine 0.33

The original [inventory](../2026-11-07/sites-docs-inventory.md) is the authority. Preserve the 2026-11-01 before panels and original Claude panels. Write every new after panel, sheet and manifest to a fresh versioned directory, recording release commit, registry integrity, source input hash, fonts, canvas, scale, complete slide IDs and tool hashes. Never overwrite earlier evidence or raster goldens. The coordinator reviews all changed panels against larger type/no shrinking/about 70 characters per line.

Maintained core commands (run only after the accepted release is built):

~~~sh
node scripts/render-layout-sampler.mjs C:/opf-work/review-033/after 0.5
node scripts/layout-sampler-sheet.mjs C:/opf-work/review-033/after C:/opf-work/review-033/layout-sampler.png 4
~~~

The renderer reads examples/technical/layout-sampler.opf.json, drops its embedded catalogs intentionally and uses this checkout's Gallery. Actual 0.33 sampler: 49 slides, all 36 named layouts plus 13 dynamic slides. Both commands import checkout packages; running them from a different cwd does not switch their module resolution. These commands alone prove source-checkout output, not published-package identity, and use their default font route rather than an Office font handle.

For a genuinely registry-resolved reproduction, prepare a fresh short-path consumer after publication: install the exact accepted six-package set and its optional converter/base-font peers from the quickstart; retain package-lock and registry receipts. Copy the two unchanged maintained scripts into that consumer's scripts/ and copy the accepted sampler into examples/technical/. Their root calculation and imports then resolve the consumer's files/packages. Run the same commands there with a fresh output root; verify script/input SHA256 values against this source receipt before execution. Do not claim this packet until it has actually run, passed and been reviewed. If the first attempt exposes a tool/runtime limitation, preserve it and fix the maintained lane explicitly.

| Artifact | Core input / publication action | Owner and current state |
| --- | --- | --- |
| OPF Layout Harvest, KMaetkTJ9D9HUcen1SZ1iu | Accepted sampler and fixed before/Claude panels; replace only after panels with verified 0.33 outputs | Core prepares immutable packet; coordinator reviews; existing authenticated artifact editor publishes. Not refreshed in this preflight. |
| Layout-harvest batch-01..08 and 14..16 (11 published artifacts; example X9283LmzzkyqTU91ELn82M) | Original batch/deck/slide mapping plus unchanged Claude panels; refresh every published batch, and explicitly reconcile inventory's broader batch-01..16 wording | Core must recover exact generator and full artifact-ID mapping before execution; coordinator owns review. No blanket completion claim. |
| Pilot story: content-only design study, VKdZMT6xh8wyyhN95SWJTY | Same pilot input and preserved Claude comparison; retain the dated historical artifact and add current release identity to refreshed output | Core packet, coordinator review, authenticated editor publication. Still owed. |

The cited scripts/layout-harvest-corpus.mjs is absent on actual main, absent on origin/handoff/review-sheets-2026-11-07, and has no matching entry in locally available all-ref history. Do not invent its CLI or regenerate the corpus from guesses. Existing C:/opf-work/harvest/corpus/manifest.json and corpus-v2/manifest.json are hashed in the receipt; preserve them while locating their exact OPF source decks and mapping. Existing external build-sampler.mjs writes the repository's sampler and contains the stale 30-layout description; do not execute it over the reviewed 49-slide sampler. Existing render-claude-slides.mjs approximates an older Slides runtime, names a historical checkout for Playwright and loads face URLs. It is neither a pinned current generator nor permission to replace the fixed Claude panels. Recover/archive the exact maintained production path in a separate reviewed tooling item if needed. Never merge the evidence-only branch.

## E2: planning artifacts

| Artifact | Concrete update after publication | Boundary |
| --- | --- | --- |
| OPF Developer Walkthrough, 6izfkFsZ4hXgVtQarQT6w3 | Read the actual existing page, then update the current entrypoint/version or append a dated superseded notice linking current quickstart, compatibility matrix and node/CLI guides | Core prepares prose after observing original body; retain historical facts; no deletion. No maintained generator is present. |
| OPF layouts without built-in records, 3Va6gKnmcSbsdmCMMVRXBo | Read actual page, preserve its original design study, then link dynamic-composition, current catalog rules and the accepted release sampler | Same; no implicit native/whole-catalog qualification. |
| OPF Layouts tracker, S5qA5Fk1X9HMyCjG32jeqg; Diagrams in OPF tracker, VeMs9vDVk6kSN9QFKubQU5 | Reconcile 0.33 facts/links once published; preserve pending 0.34 work and source/native distinctions | Coordinator's program/status authority; no support badges copied to sites. |
| OPF MCP App, 8MFGJNmzZp3NqxDbtPh5Kb | Reconcile hosted viewer only after the real 0.33 site preview/owner merge | Sites agent prepares site facts; coordinator reviews. No claim of a downloadable release .mcpb before the actual asset exists. |
| Six UI Screens and Design System artifacts listed in the original inventory | Refresh after the actual site changes, preserving each site's real generated asset/version identity | Sites agent owns these; core supplies verified doc/count facts only. |

No tool in this preflight edited claude.ai artifacts. If their existing authenticated editor is inaccessible and a login is required, prepare the concrete artifact/prose packet first and ask the owner for that owner-only login. Do not treat local Markdown or PNG preparation as a published artifact update.

## E3: second comparison refresh, genuine 0.34

Repeat the entire E1 artifact roster after the genuine 0.34 registry set is verified, against final accepted input/source/font identities and the final F1 sampler. Keep the fixed before/Claude panels; create another fresh after/output tree. Include every accepted diagram/layout/chart/text output change, all published batches and the pilot study. Repeat E2 current links/version claims and all three site generated-asset/preview checks with the sites owner. Preserve explicit LibreOffice experimental status, link/placeholder-only video limits, measured live SmartArt eligibility and separately owed native/edit acceptance. A source integration, a local preview and an actual published artifact are three different receipts.

## Verification

[Mapped docs-check receipt and lossless logs](core-033-currency/checks/receipt.json): one required run (85.4 seconds) passes build, Biome, fragment checks, strict gallery freshness, release-report, skill commands and normal stability. The only initial failure is the literal sparse-checkout ENOENT for painting-Linux.json.gz; its accepted-source blob and SHA256 are retained, and restoring it makes the affected check:text pass (6 tests, 8,524 files). No assertion, tracker or tolerance changes. Typecheck/package suites are unselected because no TS/package source changed. Registry, installed quickstart, E1/E2/E3 renders and artifact edits are held until publication; none is claimed by this branch.
