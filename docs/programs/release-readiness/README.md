# Program: release readiness (RR)

Status: **active** (opened 2026-10-01). Tracker: [burndown.md](burndown.md).
This is the single source of truth for the cross-repository program. Agents and
people resuming work start here, not from chat history or local scratch files.

## Goal

The owner's goal (2026-10-01), restated:

> Every OpenPresentation package, the CLI and the three sites are release-ready:
> shipped features complete and verified natively, known gaps closed or
> explicitly descoped with issues, CI green and cross-platform, and a
> release-readiness note for the owner.

Repositories in scope:

- core: [OpenPresentation/opf](https://github.com/OpenPresentation/opf) (spec,
  catalogs, `@openpresentation/opf`, the CLI, ecosystem CI, evidence)
- [opf-render](https://github.com/OpenPresentation/opf-render) (SVG/PDF preview)
- [opf-pptx](https://github.com/OpenPresentation/opf-pptx) (PPTX export and import)
- [opf-editor](https://github.com/OpenPresentation/opf-editor) (browser editor)
- the three sites: [pptx-gallery](https://github.com/Data-Advantage/pptx-gallery),
  [openpresentation-site](https://github.com/Data-Advantage/openpresentation-site)
  and [pptx-dev](https://github.com/Data-Advantage/pptx-dev)

The program follows the [font fidelity everywhere](../font-fidelity-everywhere/README.md)
program (FF), which is now in closure: its goal state (818 of 819 gallery configs
`works`, parity 739 perfect / 111 near / 0 mismatch of 850, measured on the
published core 0.11.4 train) stands, and its remaining open items are tracked
here as RR items so there is one list. FF items keep their IDs; RR items point
at them.

## Definition of done

The program is done when every burndown item is `done` or `descoped` with its
evidence or issue linked, and specifically:

1. **Shipped features are complete and verified natively.** Each feature an
   RR item names (SVG images, native header/footer, vector PDF, the editor
   switch operations, the preview polish items, the import details) works in the
   preview, the export and re-import, and a bounded native PowerPoint sample
   confirms the PowerPoint-facing ones. Native checks are run only by the
   supervisor (see Invariants).
2. **Known gaps are closed or descoped with issues.** Every gap is either fixed
   or recorded as `descoped` with a GitHub issue that states the current
   behaviour, what full support would need and where the evidence is (RR-18).
3. **CI is green and cross-platform.** Each repository's `main` is green on
   ubuntu and windows, and the core ecosystem matrix runs on ubuntu, windows
   and macos (RR-02, RR-04). No gate or tolerance is relaxed to get there,
   except the dated, owner-decided change recorded under Decisions (RR-15).
4. **Packages are published at the verified heads.** The final lockstep release
   train (core, then renderer and PPTX, then editor, plus the CLI) is published
   through the trusted-publishing workflows in
   [release-process.md](../../release-process.md), each registry artifact and
   its provenance verified, and the three sites adopt it (RR-01, RR-20).
5. **The owner has a release-readiness note** (FF-15, RR-20): what ships, what
   is descoped, what evidence backs each claim, and what a re-audit measured.

## Owner decisions of 2026-10-01

Recorded verbatim in intent; the owner can revise them. Each is binding for the
items that cite it.

- **Native PowerPoint header/footer is WANTED.** Slide-number, date and footer
  content export as native PowerPoint header/footer constructs (`p:hf`, the
  slide-number, date and footer placeholders, Insert > Header & Footer). This
  reverses the earlier deferral ("native `p:hf` stays deferred" in the font
  program and roadmap issue
  [opf#87](https://github.com/OpenPresentation/opf/issues/87), which asked for
  it as the required end state). Tracked as RR-11.
- **PowerPoint video is DESCOPED.** Native `p:video` export and preview
  playback are not part of this release. A future-work issue records it (RR-18).
- **Charts from external spreadsheets are DESCOPED.** `ChartDataSource`
  (`src`, `sheet`, `range`, `columns`) and a host `dataResolver` hook are not
  part of this release. A future-work issue records it (RR-18).
- **SVG images are IN SCOPE.** Native SVG pictures in the PPTX export (with a
  raster fallback) and import (RR-10).
- **AI reconstruction of third-party PPTX belongs in pptx.dev.** opf-pptx and
  the other libraries stay deterministic. `fromPptx` only exposes the raw
  layout and style signals of a third-party deck (RR-13); the "Understand this
  deck" reconstruction with review is a pptx.dev feature (RR-14).
- **opf-render#24 gate widened to 0.15 px.** The variable-font metric gate for
  browser-versus-Fontkit widths moves from 0.1 px to 0.15 px
  ([opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24),
  RR-15). This is the only gate or tolerance change in the program, it is an
  owner decision, and the native 0.02 pt geometry tolerance is unchanged.

## Invariants

- **No public support or progress status on any site.** No badges, legends,
  panels, API fields or `llms.txt` lines about measured, pending, parity or
  release-readiness status on pptx.gallery, openpresentation.org or pptx.dev
  (owner decision 2026-09-30). All tracking stays in this repository.
- **Fonts are bundled or self-hosted, with permissive licenses only** (OFL-1.1,
  Apache-2.0, MIT, UFL-1.0). Never hotlink a font CDN; licensed (proprietary)
  fonts are never bundled or embedded. See
  [Font files: bundling and licenses](../font-fidelity-everywhere/font-licensing.md#font-files-bundling-and-licenses).
  `pnpm check:font-hotlinks` enforces the hotlink half.
- **The libraries are deterministic.** No network or model calls in core,
  opf-render, opf-pptx, opf-editor or the CLI. AI-assisted reconstruction lives
  in pptx.dev.
- **Lockstep core floors when geometry moves.** A change to composition,
  geometry or the preview/export contract raises the minimum core version in
  the dependent packages in the same release train, so a package never runs on
  a core older than the geometry it expects.
- **Native PowerPoint checks run only by the supervisor.** Agents never open
  Office, never automate PowerPoint, never register fonts for it and never
  retry a native attempt in place. They prepare decks and a manifest and ask
  the supervisor, who records read-only evidence under `docs/evidence/`.
- **Never relax a gate or tolerance** to make an item pass (native 0.02 pt,
  renderer 0.1 reference px, except the dated RR-15 decision above, and the
  font allowlists). Preserve failures as evidence.
- **Publish only through the release process.** Releases are authorized by the
  owner (2026-09-29, see [AGENTS.md](../../../AGENTS.md)): only after the
  release gates pass, only from merged `main`, through the trusted-publishing
  workflows, with each registry artifact and provenance verified.
- Keep source, packed and registry claims separate, and schema support
  separate from renderer/editor/export fidelity.

## Naming

- Branches: `codex/rr-<nn>-<slug>` (for example `codex/rr-11-native-header-footer`).
- PR titles start with the item ID: `RR-<nn>: ...` (for example `RR-11: ...`).
- Items inherited from the font program keep their FF ID in the title when they
  close an FF item: `RR-03, FF-07: ...`.
- Statuses: `todo`, `in-progress`, `review` (PR open), `done` (merged and
  evidence linked), `descoped` (owner decision, issue linked).

## Progress reporting

`pnpm report:release` (or `node docs/programs/release-readiness/report.mjs`)
parses the burndown table and prints counts by status and the open items.
`--json` prints the same numbers as JSON; `--file <path>` reads another
burndown. `pnpm check:release-report` runs its unit tests and fails if the
burndown table cannot be parsed or uses an unknown status. This is internal;
it is never shown on a site.

## Resume protocol

Any session (supervisor or subagent) resuming this program:

1. Read this file and [burndown.md](burndown.md). The progress log at the end
   of the burndown is the latest state. Run `pnpm report:release`.
2. `git fetch` every repository in scope. Work only from fresh `origin/main`
   worktrees (never switch or clean the user's checkouts; never resume a
   squash-merged branch).
3. List open program PRs for each repository:
   `gh pr list -R <owner>/<repo> --state all --search "RR- in:title"`
   (also `FF- in:title` for items inherited from the font program). Reconcile
   any status drift into the burndown.
4. Pick the lowest-numbered `todo` item whose dependencies are `done`, or an
   item assigned to you. Branch as `codex/rr-<nn>-<slug>` and start the PR
   title with `RR-<nn>: `.
5. An item is `done` only when its criteria hold, its PR is merged after review
   under the merge policy in force, and the evidence is linked in its row.
   Native-facing criteria need supervisor-recorded native evidence.
6. When an item changes state, update its row and append one dated line to the
   progress log in the same PR, or in a small follow-up tracker PR.
7. Native PowerPoint items are supervisor-only on the Windows host. Inspect the
   host first and record preflight and postflight evidence.

Roles: the supervisor plans, reviews, merges reviewed CI-green PRs and owns
Office. Subagents implement items and open PRs; a separate reviewer reviews each
PR.

## Related

- [Font fidelity everywhere](../font-fidelity-everywhere/README.md) and its
  [burndown](../font-fidelity-everywhere/burndown.md), the predecessor program
- [Release process](../../release-process.md)
- [Compatibility matrix](../../compatibility-matrix.md)
- Roadmap issues: [opf#87](https://github.com/OpenPresentation/opf/issues/87)
  (PowerPoint acceptance and native header/footer),
  [opf#88](https://github.com/OpenPresentation/opf/issues/88) (site adoption)
