# Source wrap-up and two-machine continuation — September 10, 2026

The user requested that existing integration work be committed, synchronized and merged, then continued by a Mac project owner and a separate Windows native-PowerPoint testing owner. This is a source milestone. The broader [accepted objective](plans/ecosystem-objective-2026-09-09.md), publication, public adoption and unresolved native/quality gates remain open.

## Portable checkpoint

Fetch GitHub `main` in each repository. These PRs identify the complete integration and its merge commits; verify their state from GitHub before resuming. The branch is `codex/shared-metric-integration-20260910`. Do not reconstruct work from an old computer's paths.

| Repository | Wrap-up PR | Reviewed source checkpoint before final handoff documentation |
| --- | --- | --- |
| OpenPresentation/opf | [#61](https://github.com/OpenPresentation/opf/pull/61) | `1cc9be9788e7ae0e940af94feb028347e27433b0` |
| OpenPresentation/opf-render | [#12](https://github.com/OpenPresentation/opf-render/pull/12) | `4b9706367039c13399d0a8b33c9e2bd305904c4b` |
| OpenPresentation/opf-pptx | [#16](https://github.com/OpenPresentation/opf-pptx/pull/16) | `df43cfcf58cf9bcee6435620e36d9e9bfd5a253c` |
| OpenPresentation/opf-editor | [#11](https://github.com/OpenPresentation/opf-editor/pull/11) | `26a04baed9ca1715c5ad50e2f3239d6cba67786e` |

Use named sibling checkouts `opf`, `opf-render`, `opf-pptx`, `opf-editor` for coordinated scripts. The three public application repositories remain `Data-Advantage/openpresentation-site`, `Data-Advantage/pptx-gallery` and `Data-Advantage/pptx-dev`. Their prior published-set adoption is recorded in the full [historical handoff](handoff-2026-09-08.md). Audit current remote state before further changes.

## Source and release boundaries

The actual published set remains core **0.9.0**, CLI **0.7.0**, renderer **0.7.0**, PPTX **0.7.0**, editor **0.6.0**. Do not republish those or any earlier versions. No package version, npm dist-tag or public deployment changes in this wrap-up. `release-plan.json` retains those exact versions and their historical immutable verification refs. The newly integrated APIs require coordinated sources or candidate tarballs; old registry dependencies alone do not provide them.

CI now checks the current downstream PR against immutable coordinated source refs and installs all four candidate tarballs into a clean consumer. The existing per-package registry-predecessor `test:packed` scripts remain release gates after their predecessors are published. Core's coordinator retains separate exact-registry installation, installed-browser, CLI and fidelity tests using the published plan/historical harnesses. A source baseline is scoped only to the source step. Candidate versions such as `0.4.0-preview.11` are temporary staging labels, never releases.

The [shared-text corpus review](evidence/shared-text-regression-review.md) accepts an 805-slide regression checkpoint after review of all 17 overview sheets and prior milestone detail reviews. Linux renderer CI agrees with the Windows Node 20/24 manifest. This is not a polished-gallery or native-fidelity approval: estimated rich spacing, missing external data/media, dense content and excessive whitespace remain quality work. Historical failures and the old published shared-code baseline are preserved.

## Wrap-up corrections and checks

The original CI failures were test/integration issues, not spending-limit failures: downstream jobs installed older core APIs; three cross-package assertions still assumed one native shape per text item; the text-corruption checker interpreted binary PPTX/font evidence as UTF-8. The corrected assertions check accepted line anchors, top/height, exact editable words and no-refit behavior. Binary evidence is skipped only for recognized extension/signature pairs; text/JSON/SVG/log checks remain active.

PPTX review corrected clearing a complete tagged heading: it retains its empty role instead of importing an unknown-shape description or promoting body text. All three roles have regression coverage. Scalar placement is explicitly restricted to scalar text/headings, retaining specialized list export. The generated tracked PPTX bundle is synchronized with these changes. Both review findings were resolved.

The complete local Windows Node 24 coordinated command passes, followed by seven installed-package browser suites: 230 assertions and eight trusted interaction scenarios. Clean candidate checks verify archive/lock integrity, runtime bytes, declarations, export/reimport and actual installed code/editor browser modules. Renderer/editor CI passes Node 20/24; PPTX covers Linux/Windows × Node 20/24. The final PR checks are authoritative for the latest commit. [Wrap-up evidence](evidence/wrap-up/summary.json) preserves local logs/reports and their checksums. A Windows CLI file-symlink rejection test is explicitly skipped for missing privileges and is covered by Unix CI; no privilege was silently assumed.

## Native PowerPoint remains separate

Do not start another unattended Office retry merely because package CI passes. The [native resume record](evidence/native-resume/README.md) includes the user's Excel-dialog warning and partial success: eight charts opened/saved/reopened, 16 original/saved data imports agree and eight native PNG pairs are identical. The first workbook edit returned; the second `ChartData.Activate()` hung. No edited-deck gate completed. Only owned helper processes were stopped; Office/user documents were not closed and generated-file cleanup completion is unknown.

The chart harness permits one explicit `-EditSlide` per bounded worker, records progress and does not automatically retry. Dummy-worker controls and temporary registration/removal of all four exact Carlito faces pass. Native text generation passes 24 cases / 144 editable lines per supported Node runtime with identical bytes/geometry; full Office execution remains pending. Fresh metric fixture generation is not native execution. Earlier eight tab deltas above 0.02 pt (maximum about 0.067383 pt) and portrait/right ink at x=497 beyond edge 496.8 remain counterexamples. Keep existing tolerances and raw failures.

## Ownership and continuation

- **Mac owner:** use [this copy/paste prompt](continuation/mac-project.md). Own font/layout product work, bounded repair/Auto arrange, independent review, new dependency-ordered releases, exact registry E2E and all three public applications. Continue the full goal, including selectable/vector PDF and the full Mermaid/general SVG roadmap after font reliability gates are accepted. Those backends are plans, not new implementations in this milestone.
- **Windows owner:** use [this copy/paste prompt](continuation/windows-powerpoint.md). Own Office readiness, bounded native harnesses, native font/render/edit/save/reopen/reimport evidence and narrow reproducible defect PRs. Preserve user Office work. Coordinate product changes with the Mac owner; avoid competing release/deployment changes.

The six-skill installer (`npx @openpresentation/cli@latest skills install`), previous website changelog/public-set adoption and older PR triage are already implemented; inspect current state rather than recreating them. Keep security alerts visible, test new dependency upgrades and retain weekly grouping/reduced redundant notifications. The full ecosystem goal is not complete when these source PRs merge.
