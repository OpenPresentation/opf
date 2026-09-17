# Shared header/footer PR consolidation — September 15, 2026

Historical review checkpoints: later instructions moved the four remaining
prototypes into archived roadmap work. See [the final handoff](../../handoff-2026-09-15.md)
for the completed PR disposition and current release boundary. Draft counts
and candidate test results below describe the preserved pre-deferral state.

The four furniture PRs were integrated with the current published package
branches rather than restoring their older release manifests or test setup.
The new release fixes, registry acceptance checks and reviewed furniture
baseline are retained together. `furniture-runtime-heads.json` identifies the
integration commits used by each PR's coordinated CI.

Local verification uses Node 24.21.0 and the pinned package managers. The
retained logs cover complete library typecheck/validation/test suites, the
805-slide raster regression, core tests/types, ecosystem/layout/pagination/
rich-text/font suites, fresh candidate tarballs and 81 CLI checks. These are
candidate packages; no new registry publication is claimed.

Fresh installed packages pass eight general browser suites, seven JSON editor
workflows and sixteen header/footer workflows covering source editing,
generated metadata, empty fields, undo/redo, export and controlled semantic
reimport. The actual consumer lock and browser input hashes are retained.
All forty field masks, the displaced-text negative control and four complete
views are byte-identical to the earlier reviewed acceptance. Wide and portrait
local views were inspected again; the portrait's large-floor organization
wrapping is retained, not hidden by shrinking its text.

The project owner requested a separate
[PowerPoint acceptance roadmap](../../plans/powerpoint-acceptance.md). Native
Office recovery, images, tabs, font identity, provenance save/reopen and
notes-master ordering are open compatibility work, not claims established by
these portable tests. Prepared shaping remains a separate stack with an
unresolved native-browser variable-font metric comparison.

The dependency review separately merged passing maintenance PRs after refreshing
their bases, retained Node 24, and fixed actual Zod migration and lockfile
conflicts. `dependency-merge-results.json` is an intermediate operation log;
subsequent PR state and deployment acceptance must be read from GitHub.

The final integrated CI found a harness boundary bug: the current furniture
provenance test was requested from the older immutable registry verification
ref, which predates that unpublished API. The harness now runs this test only
against candidate tarballs; all existing released-feature registry checks remain.
Both complete installed consumer modes pass locally after the correction, with
the original failure and corrected logs retained here. Publishing furniture must
add its released-version gate and pinned acceptance harness to the release plan.

## Final review outcome

The original twenty PRs now have fifteen merges, one closed Node 26 types
upgrade (Node 24 remains required), and four linked shaping drafts.
`consolidation-result.json` records the reviewed inventory and merged commits;
its draft head IDs are the pre-integration checkpoint. The advanced runtime
heads identify the subsequent source graph based on all four current mains.
`furniture-merge-results.json` retains passing checks for each exact reviewed
head and the resulting squash merge.

The corrected core furniture CI [35016746927](https://github.com/OpenPresentation/opf/actions/runs/35016746927)
passes every source, installed-candidate and published-registry stage. The
main branches contain this portable work; no new furniture package version
has been published. Site and gallery production deployments pass, followed by
26 and five live browser workflows. App PR37 fixes the Zod4 migration; PR35
retains Python3.12/Node24 and fixes the shared-document test readiness race.
Both merged, deployed and passed all ten canonical app browser workflows.

The requested variable-font fix was investigated separately. Rounding the
TrueType HVAR advance clears five Linux failures but produces five macOS
failures. [The rejected candidate](https://github.com/OpenPresentation/opf-render/tree/9764ad8f9a7fd497ca2fcea190669cf74d2e2503/docs/evidence/rejected-truetype-rounding-20260915)
retains the reproduction and source-hashed measurements. Runtime code and the
0.1px gate are unchanged. [Renderer issue24](https://github.com/OpenPresentation/opf-render/issues/24)
tracks the remaining supported-contract work; dependent core83/editor21/PPTX35
remain drafts together with renderer21.

## Current draft integration checks

All four drafts incorporate the newly merged mains. Local Node24 core tests
and types pass. The complete sequential package suite passes, including the
805-slide/126-deck raster corpus, rich-source/format/whitespace checks, package
types, fresh tarballs and 81 CLI commands. Installed browsers pass eight
general suites (276 assertions, eight trusted interactions), seven JSON editor
workflows, twenty prepared-caret workflows, thirteen rich workflows in each of
measured/painted/estimated modes, and eight measured/painted pixel-and-copy pairs.
The pinned published-registry consumer and its eight browser suites also pass;
new furniture/rich-source harnesses apply to candidates, not historical releases.

The initial local package run was invalidated by running a core build at the
same time: that build cleaned a distribution directory while a renderer test
loaded it. Its module-not-found log is retained. The complete sequential rerun
passes; no runtime workaround was introduced. Final draft CI is triggered by
the pushed integration heads and is separate from this local evidence. The
known native variable-font gate remains unresolved and is not claimed here.
