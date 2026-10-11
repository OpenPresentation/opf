# Final v2 visual review checkpoint

The supervisor accepts the intended 171 example migrations, including the corrected 20 vertical Evidence Packs, and the 26 gallery2 template image-fit changes in principle. This is a source and local visual review, not baseline promotion, native Office acceptance or a release approval.

The original main renderer with registry core0.18.3 reproduced all807 committed baseline entries. For the corrected candidate, the supervisor independently checked every actual PNG against its recorded SHA256, compared all807 entries to the corrected QA output (zero differences), and verified exactly20 changes from the frozen v2 candidate and171 changes from original main. The final20 were viewed on four contact sheets, with the original photo-essay PNG inspected separately. Charts, quotes and metrics remain legible and within their slides. Earlier independent reviews cover the remaining151 changed examples and all26 template pairs. The template changes are confined to65 image elements switching from cover to contain, with other SVG trees unchanged.

[Review manifest](review.json) records the exact source graph, candidate-file hashes and affected keys. [Core#596](https://github.com/OpenPresentation/opf/pull/596) carries the generator correction, preservation regression and durable before/after evidence. No authored content, order or design was removed. The 20 horizontal Evidence Packs remain unchanged.

Promotion must use the prescribed pinned-image workflow. Its output must reproduce the unchanged main control and account for every candidate difference. Gallery2 source setup requires the reviewed [core#597](https://github.com/OpenPresentation/opf/pull/597); supervisor independently passed all21 regression tests and verified all357 materialized catalog JSON files against the exact gallery candidate (28 layout records plus index, no stale v1 records). Renderer workflow support is being prepared separately. The separate font-subset fix must be replayed against the final corpus before this becomes a final integrated baseline.

This checkpoint does not prove published-package consumers, production sites or fresh Windows PowerPoint behavior. Those checklist gates remain open.

## Pinned workflow reproduction, 2026-10-11

Supervisor downloaded the artifacts from core run [38115772021](https://github.com/OpenPresentation/opf/actions/runs/38115772021) and renderer run [38116271551](https://github.com/OpenPresentation/opf-render/actions/runs/38116271551). Both core and renderer example candidate files are byte-identical to the reviewed 807-entry candidate; the renderer template file is byte-identical to the reviewed 498-entry candidate. Exact immutable graph, source digests and artifact hashes are in [pinned-workflow-comparison.json](pinned-workflow-comparison.json). The core report independently reproduces unchanged main with its locked renderer and reports 171 changed slides in 90 decks, zero added or removed.

This confirms reproduction of the previously reviewed visual changes. It does not promote a baseline, establish registry installation of gallery2, or replace native acceptance. The shared commit/PR gate subsequently exited0 after confirmation: core tooling/main21/21checks and renderer tooling7/7checks passed. Artifact verification and completed workflow gates are both recorded; baseline promotion remains separate.

Supervisor also checked every downloaded changed-slide PNG against the corresponding candidate entry:171 core examples,171 renderer examples and26 templates all match SHA256 and byte length. [Actual PNG verification](pinned-workflow-png-verification.json) binds the available images to the reproduced candidate records.
