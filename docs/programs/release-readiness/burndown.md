# Release readiness: burndown

Goal, invariants, owner decisions and resume protocol: [README.md](README.md).
Predecessor: [font fidelity everywhere burndown](../font-fidelity-everywhere/burndown.md).
Counts and open items: `pnpm report:release`.

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged and
evidence linked), `descoped` (owner decision, issue linked). Dates are UTC. The
table is parsed by [report.mjs](report.mjs); keep one row per item, the six
columns below, and a status from the list.

## Items

| ID | Item | Repos | Depends | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| RR-01 | Release opf-pptx 0.11.8 (wrapped rich-text rejoin, [opf-pptx#126](https://github.com/OpenPresentation/opf-pptx/pull/126)) and CLI 0.9.2 on core 0.11.4; the Node 20 question ([pptx-dev#26](https://github.com/Data-Advantage/pptx-dev/issues/26), closed as superseded: Node 24 only) | opf-pptx, opf (CLI), pptx-dev | none | in-progress | opf-pptx 0.11.8 and CLI 0.9.2 published and verified; opf-pptx 0.11.9 (RR-13 signals) release and the site bumps pending |
| RR-02 | pptx.dev CI green and stable on ubuntu and windows | pptx-dev | none | in-progress | master green on core 0.11.4 train ([pptx-dev#64](https://github.com/Data-Advantage/pptx-dev/pull/64), run 36876765039); the two PR runs before it failed and are preserved; stability over repeated runs not yet shown; the open Windows readiness and source-preservation boxes of [opf#88](https://github.com/OpenPresentation/opf/issues/88) are the reference list |
| RR-03 | Close the font-fidelity items in review (FF-07, FF-08, FF-22b, FF-27, FF-29, FF-30, FF-31, FF-37, FF-39, FF-58) | opf | none | in-progress | verdicts in [the RR-03 PR](https://github.com/OpenPresentation/opf/pulls?q=RR-03+in%3Atitle) and the font burndown rows |
| RR-04 | Cross-platform: pairwise matrix (FF-09), matrix in CI on ubuntu/windows/macos (FF-10), export determinism independent of host (FF-11) | opf, opf-pptx | RR-03 | in-progress | FF-09 todo; FF-10 and FF-11 in-progress in the font burndown |
| RR-05 | Native PowerPoint sample including CJK and RTL (FF-12) | opf, opf-pptx | RR-04 | todo | supervisor-run; see FF-12 |
| RR-06 | Editor: switch every dimension with patch, undo and preview refresh (FF-16) and editable design-level options | opf-editor, opf | none | in-progress | FF-16 todo in the font burndown |
| RR-07 | Preview polish: code language highlighting, metric trend, all 54 background pattern presets (preview and export agree) | opf-render, opf-pptx | none | in-progress | |
| RR-08 | Import details: author arrays, run ColorRef (`var:`/scheme) colours, item descriptions, bullets form | opf-pptx | none | todo | |
| RR-09 | Rich text with hard line breaks round-trips as one authored payload | opf-pptx | RR-01 | todo | wrapped-text rejoin is [opf-pptx#126](https://github.com/OpenPresentation/opf-pptx/pull/126) (RR-01); hard breaks are the remaining case |
| RR-10 | SVG images: native SVG in PPTX export (with raster fallback) and import | opf-pptx, opf-render, opf | none | in-progress | owner decision 2026-10-01: in scope |
| RR-11 | Native PowerPoint header/footer (`p:hf`, slide-number/date/footer placeholders, Insert > Header & Footer) | opf-pptx, opf-render, opf | none | in-progress | owner decision 2026-10-01: wanted (reverses the earlier deferral); native confirmation is supervisor-run (RR-05); relevant to FF-27 and [opf#87](https://github.com/OpenPresentation/opf/issues/87) |
| RR-12 | Vector PDF with selectable text | opf-render | none | in-progress | |
| RR-13 | `fromPptx` exposes raw layout and style signals for third-party decks (deterministic) | opf-pptx | none | in-progress | owner decision 2026-10-01: libraries stay deterministic |
| RR-14 | pptx.dev "Understand this deck": AI reconstruction of third-party PPTX into structured OPF with review | pptx-dev | RR-13 | todo | owner decision 2026-10-01: AI reconstruction lives in pptx.dev, not in opf-pptx |
| RR-15 | [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24): widen the variable-font metric gate to 0.15 px | opf-render, opf | none | done | owner decision 2026-10-01; the only gate change in the program; [opf-render#87](https://github.com/OpenPresentation/opf-render/pull/87) `9e5d616` merged (variable-font gate 0.15 px as a blocking CI step; worst measured delta 0.1346 px on Linux and 0.0024 px on macOS over 356 retained rows); [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24) closed (2026-10-01) |
| RR-16 | [opf#213](https://github.com/OpenPresentation/opf/issues/213): preview font sizes snapped to PowerPoint's 0.01 pt resolution (decide and implement) | opf, opf-render, opf-pptx | none | in-progress | decided 2026-10-01 (vetoable): quantize in core, parity exact; [opf#247](https://github.com/OpenPresentation/opf/pull/247), [opf-render#91](https://github.com/OpenPresentation/opf-render/pull/91), [opf-pptx#135](https://github.com/OpenPresentation/opf-pptx/pull/135) open; [record](rr-16-font-size-grid.md) |
| RR-17 | Font long tail: FF-41, FF-42, FF-43, FF-44, FF-45, FF-46, FF-05, FF-13 | opf, opf-render, opf-pptx, opf-editor | RR-05 | in-progress | per-font status in the [font tracker](../font-fidelity-everywhere/font-tracker.md) part A (FF-41, FF-42, FF-43): in review ([opf#249](https://github.com/OpenPresentation/opf/pull/249), [opf-render#92](https://github.com/OpenPresentation/opf-render/pull/92), [opf-editor#61](https://github.com/OpenPresentation/opf-editor/pull/61), [pptx-gallery#80](https://github.com/Data-Advantage/pptx-gallery/pull/80)); FF-44 to FF-46, FF-05 and FF-13 are not in part A |
| RR-18 | Issues and roadmap hygiene: file descoped issues, refresh roadmap issues #87 and #88 | opf, opf-pptx | none | in-progress | descoped issues (video, ChartDataSource) and roadmap comments listed in the progress log |
| RR-19 | Housekeeping: stale worktrees, branches, scratch folders | all | none | in-progress | supervisor; never touches the user's checkouts |
| RR-20 | Release-readiness note (FF-15), final lockstep release train, re-audit | opf and all | RR-01 to RR-19 | todo | |

Descoped by owner decision 2026-10-01 (not RR items; each has a future-work
issue, filed under RR-18): native PowerPoint video (`p:video`) and preview
playback; chart data from external spreadsheets (`ChartDataSource`, a host
`dataResolver` hook).

## Acceptance criteria

**RR-01 Release.** opf-pptx 0.11.8 (carrying #126) and the CLI 0.9.2 are
published from merged `main` through the trusted-publishing workflows on core
0.11.4, with registry artifact and provenance verified. The CLI keeps
`engines.node` `24.x` (owner Node 24 decision; pptx-dev#26 is closed as
superseded by pptx-dev#32, and it concerned pptx-dev's own `@pptx/cli`). The
sites adopt the versions.

**RR-02 pptx.dev CI.** `master` is green on ubuntu and windows over repeated
runs, with no assertion relaxed and the original failures preserved. The open
checkboxes of opf#88 are each resolved or recorded as a separate issue.

**RR-03 FF review items.** Each of the ten items is `done` with dated evidence,
or stays `review` with exactly what is missing and the RR item that covers it.

**RR-04 Cross-platform.** The pairwise matrix (FF-09) runs in CI on ubuntu,
windows and macos through a packed TypeScript consumer (FF-10), including runs
with no system fonts, and export bytes do not depend on host fonts, OS, locale
or timezone (FF-11).

**RR-05 Native sample.** The FF-12 criteria hold: at most 12 decks opened
read-only, including CJK and RTL, `Presentation.Fonts` naming only the chosen
families. Supervisor-run; evidence merged under `docs/evidence/`.

**RR-06 Editor.** For each gallery dimension the editor switches the value,
applies it as a patch, undoes it exactly and refreshes the preview (FF-16), and
design-level options are editable.

**RR-07 Preview polish.** Code blocks highlight by language, the metric trend
renders, and all 54 background pattern presets draw in the preview and export
as the same native pattern fill (parity audit agrees).

**RR-08 Import details.** `fromPptx` restores author arrays, run `ColorRef`
colours (`var:` and scheme references), item descriptions and the bullets form,
or emits a specific diagnostic; export-then-import tests cover each.

**RR-09 Hard line breaks.** Rich text with hard line breaks (`a:br`) re-imports
as the one authored payload, not several paragraphs.

**RR-10 SVG images.** SVG pictures export as native PowerPoint SVG pictures
(`asvg:svgBlip`) with a raster fallback `a:blip`, import back to the SVG source,
and draw in the preview. A native open confirms the picture (supervisor).

**RR-11 Native header/footer.** Slide-number, date and footer content export as
native PowerPoint header/footer: slide master and layout placeholders of type
`sldNum`, `dt` and `ftr` on each slide, `p:hf` flags that match, so Insert >
Header & Footer owns them, and re-import keeps the OPF furniture. Preview,
export and re-import agree; native confirmation is supervisor-run.

**RR-12 Vector PDF.** The renderer writes a PDF whose text is vector and
selectable, using the bundled fonts, deterministically.

**RR-13 Raw signals.** `fromPptx` returns the layout and style signals of a
third-party deck (placeholder roles and geometry, theme and master styles,
shape order and kinds) as plain data with no network or model calls.

**RR-14 Understand this deck.** pptx.dev reconstructs a third-party PPTX into
structured OPF from the RR-13 signals with AI assistance and a review step the
user controls; nothing runs in the libraries.

**RR-15 Gate.** The browser-versus-Fontkit variable-font width gate is 0.15 px
(from 0.1 px) in opf-render, with the decision recorded in the test and the
docs; no other tolerance changes.

**RR-16 0.01 pt snap.** Either composed font sizes are quantized to 0.01 pt (rounding down) in
core with the golden hashes regenerated and the lockstep floor raised, or the
parity harness treats a difference below PowerPoint's own 0.01 pt resolution as
equal; the decision is recorded and the two `list-6x-heading-title-center`
layouts become `perfect`.

**RR-17 Font long tail.** FF-41 to FF-46, FF-05 and FF-13 are `done` or
explicitly descoped by the owner, per their font burndown criteria.

**RR-18 Hygiene.** One issue per descoped item (video, `ChartDataSource`) with
current behaviour, what full support needs and evidence; roadmap issues #87 and
#88 carry a current status comment; opf-render#24 and opf#213 point at their RR
items.

**RR-19 Housekeeping.** No stale worktrees, merged branches or scratch folders
remain from the program; user checkouts are never switched or cleaned by agents.

**RR-20 Readiness note.** A release-readiness note for the owner (FF-15) lists
what ships, what is descoped and the evidence; the final lockstep train is
published and verified; the audits are re-run on the published packages and the
re-audit result is linked.

## Progress log

Append-only. One dated line per state change.

- 2026-10-01: Program opened by the owner. Baseline: the font program's goal state stands (core 0.11.4 `e414bca`, opf-render 0.11.9 `2fbc0ab`, opf-pptx 0.11.7 `a9bcbd7`, opf-editor 0.10.6 `313774a`, pptx-gallery `d8f5ae6`: 818 of 819 gallery configs `works`, parity 739 / 111 / 0 of 850). Owner decisions recorded in the README: native header/footer wanted (RR-11); video and `ChartDataSource` descoped with issues; SVG images in scope (RR-10); AI reconstruction in pptx.dev, libraries deterministic (RR-13, RR-14); opf-render#24 gate widened to 0.15 px (RR-15). RR-00 (this tracker) is the PR that adds the program.
- 2026-10-01: RR-15 done. opf-render#87 (`9e5d616`) widened the variable-font native advance gate to 0.15 px as a blocking CI step; worst delta 0.1346 px on Linux and 0.0024 px on macOS over 356 retained rows; opf-render#24 closed.
- 2026-10-01: RR-01 progress: opf-pptx 0.11.8 and CLI 0.9.2 are merged and tagged ([opf-pptx#128](https://github.com/OpenPresentation/opf-pptx/pull/128) `875c944`, [opf#241](https://github.com/OpenPresentation/opf/pull/241) `73c7f15`) and publishing; the registry artifacts and provenance are not yet verified, so the item stays in-progress. [pptx-dev#26](https://github.com/Data-Advantage/pptx-dev/issues/26) is closed as superseded by pptx-dev#32 (the Node 24 decision is kept).
- 2026-10-01: RR-19 progress: 466 stale scratchpad worktrees removed across the seven repositories, 422 remote branches of merged or closed PRs deleted, and C:c removed. The item stays in-progress until the supervisor confirms no stale worktrees, branches or scratch folders remain.
- 2026-10-01: RR-03 in review ([opf#242](https://github.com/OpenPresentation/opf/pull/242)): FF-07, FF-22b, FF-29, FF-30, FF-31 and FF-39 are done; FF-08, FF-27, FF-37 and FF-58 stay in review. The two owner-facing questions are listed in the README under Open decisions.
- 2026-10-01: RR-01 progress: opf-pptx 0.11.8 (`875c944`) and CLI 0.9.2 (`73c7f15`) are published and verified (gitHead equals the tag commit, SLSA provenance names the release workflow and tag, `npm audit signatures` clean). Node 20 is not restored for the CLI: `engines.node` stays `24.x` (owner Node 24 decision; pptx-dev#26 closed as superseded by pptx-dev#32). The release plan, compatibility matrix and docs follow in [opf#245](https://github.com/OpenPresentation/opf/pull/245); the three sites adopt the release in [openpresentation-site#59](https://github.com/Data-Advantage/openpresentation-site/pull/59), [pptx-gallery#79](https://github.com/Data-Advantage/pptx-gallery/pull/79) and [pptx-dev#67](https://github.com/Data-Advantage/pptx-dev/pull/67). opf-pptx 0.11.9 (RR-13 import signals) follows.
- 2026-10-01: FF-58 closed by the owner decision that the `world` region map is parked for post-v1 ([opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)): works denominator 818. The open question is removed from the README; the `PPTX_GALLERY_READ_TOKEN` item (FF-37) stays open.
- 2026-10-01: RR-16 in review ([opf#247](https://github.com/OpenPresentation/opf/pull/247), [opf-render#91](https://github.com/OpenPresentation/opf-render/pull/91), [opf-pptx#135](https://github.com/OpenPresentation/opf-pptx/pull/135)). Decision (supervisor, vetoable): quantize composed font sizes to 0.01 pt (1/75 px) in core, trial sizes rounding down and floors up, and tighten the parity run-size tolerance from 0.005 pt to 0.001 pt. Parity on the 850 values: 741 perfect, 109 near, 0 mismatch (719 / 131 / 0 for the unsnapped core under the same exact tolerance; 22 values improve, the two `list-6x-heading-title-center` layouts among them, none regress). Example corpus: 318 of 805 slides change (303 by at most 0.018 px per size), 15 metric slides pick a neighbouring candidate (up to 2.2 px); renderer raster golden 316 of 805. Geometry change for the lockstep release; the item is done when the three PRs merge and the floors are raised with the release. Record: [rr-16-font-size-grid.md](rr-16-font-size-grid.md).
- 2026-10-01: RR-17 part A (Latin font long tail: FF-41, FF-42, FF-43) in review: [opf#249](https://github.com/OpenPresentation/opf/pull/249), [opf-render#92](https://github.com/OpenPresentation/opf-render/pull/92), [opf-editor#61](https://github.com/OpenPresentation/opf-editor/pull/61), [pptx-gallery#80](https://github.com/Data-Advantage/pptx-gallery/pull/80). Per-family fixtures in every host, the qualification report and the tracker-derived acceptance (41 qualified, 36 documented-visual); decisions for Aptos Narrow, Serif, Mono and Liberation are recorded as vetoable in the font burndown. FF-46 native checks of the Latin families are the supervisor's.
