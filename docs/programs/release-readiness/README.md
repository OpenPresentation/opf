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

## Owner decisions of 2026-10-01, scope 2

Later the same day the owner approved a wider scope. Binding for the items that
cite it; the owner can revise it.

- **In scope (RR-21 to RR-35).** Editor slide management, autosave and restore,
  vector PDF, PNG and SVG downloads, a data grid, deck-wide find and replace,
  image crop and focal point, a mobile layout, the core conversions module, CLI
  render/export/import, a player and `<opf-deck>` web component, `opf audit`,
  Markdown and outline conversion, diff/merge/format and one JSON-patch module,
  templates and variables (beyond colours: text, number, date, image or asset),
  numbered lists, footnotes, citations and captions, and chart options. The
  libraries stay deterministic: templates fill from data the caller supplies,
  with no network or model calls.
- **Declined (no issue).** A VS Code extension, and a language set per slide or
  per run.
- **Deferred with issues, out of v1.** Navigation and motion (transitions,
  builds and reveals, links between slides,
  [opf#250](https://github.com/OpenPresentation/opf/issues/250)) and rich
  speaker notes ([opf#251](https://github.com/OpenPresentation/opf/issues/251);
  plain-text notes stay).
- **The `world` region map chart is parked** (out of v1, handled later;
  [opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133)). It
  stays on the clustered column fallback with a `chart-data-adapted`
  diagnostic, and the in-scope gallery denominator for the `works` goal is 818.
  This settles open decision 1 below.

## Open decisions

Questions only the owner can settle. Each is also recorded in the font burndown row it blocks (RR-03).

Settled 2026-10-01 (owner): the `world` region map (FF-58) is parked for post-v1, tracked as [opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133) (label `parked`). The works denominator is 818 and FF-58 is done. RR-20 does not ask the question again.

1. **FF-37, the catalog drift check in CI.** Settled 2026-10-02 (owner): no token. The direction is inverted: core is the source of truth and `@openpresentation/opf` ships `spec/catalogs`, so pptx-gallery's CI verifies its published `public/<kind>/` files against the catalogs of the core version in its lockfile ([pptx-gallery#84](https://github.com/Data-Advantage/pptx-gallery/pull/84), `pnpm check:core-catalog`). The token-gated `catalog-snapshot` job is removed from opf-ci.yml; the offline manifest hash check stays in `pnpm test`. No secret is needed and nothing is left for the owner.

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
parses the burndown and prints counts by status, the open items and the work
queue: the burndown's **Now** table, one row per open item with its owner (supervisor, a named agent or the owner),
what is being worked on, what blocks it and the next action. `-- --now` prints only the queue; `-- --live` adds the
live state of every pull request a Now row links (merged, or open with its mergeable state and check counts, through
the `gh` CLI; the only mode that uses the network). `--json` prints the same data as JSON; `--file <path>` reads
another burndown. `pnpm check:release-report` runs its unit tests and fails if a table cannot be parsed, uses an
unknown status, names an unknown item, or leaves a closed item in the work queue. Keep the Now table current: update
the row when an item changes hands or state, and delete it when the item closes. This is internal; it is never shown
on a site.

The [gallery tracker](gallery-tracker.md) (RR-41) is the per-item view: one record per item pptx.gallery shows or the
catalogs define (layouts, colour and font schemes, languages, themes, narratives, charts, audiences, tones, socials,
headers and footers, content blocks, image treatments, backgrounds, purposes, fonts, slide sizes and the gallery's
coming teasers), with the columns spec, compose, preview, export, round trip, parity, editor, gallery, native and
fonts taken from the committed audits, parity run, font tracker, native evidence and two pinned snapshots (pptx.gallery
and opf-editor). Each record has a status (`done` to `broken`, with severities) and, per gap, a next action and a link:
an open RR item, a pull request, or an issue for a descoped gap. A record is addressed when every gap has one.
`pnpm build:gallery-tracker` regenerates `gallery-tracker.json` and `.md` (rules in `gallery-tracker.overrides.json`;
refresh the snapshots with `--snapshot-gallery <pptx-gallery> --commit <sha>` and `--snapshot-editor <opf-editor>
--commit <sha>`), and `pnpm check:gallery-tracker`, part of `pnpm test` and so of CI, fails when it is stale, including
after a burndown status change that a gap links to. `pnpm report:release` prints its one-line summary under the
headline.

## Resume protocol

Any session (supervisor or subagent) resuming this program:

1. Read this file, [HANDOFF.md](HANDOFF.md) (the latest supervisor handoff: work in flight, draft PRs with Resume sections, owner actions) and [burndown.md](burndown.md). The progress log at the end
   of the burndown is the latest state, and its Now table says who works on what. Run
   `pnpm report:release -- --live`.
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
- [Release-readiness note for the 0.12.0 release train](release-notes-0.12.0.md) (FF-15, draft)
- [Compatibility matrix](../../compatibility-matrix.md)
- Roadmap issues: [opf#87](https://github.com/OpenPresentation/opf/issues/87)
  (PowerPoint acceptance and native header/footer),
  [opf#88](https://github.com/OpenPresentation/opf/issues/88) (site adoption)
