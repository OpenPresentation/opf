# Handoff of 2026-11-12: v0.34.0 acceptance and release

This is the current entry point. It supersedes the status in the [2026-11-08](../2026-11-08/README.md) and
[2026-11-07](../2026-11-07/README.md) handoffs; their [working rules](../2026-11-07/working-rules.md) and owner rules still bind.
A new supervisor took over on 2026-11-12 from the agent that worked after 2026-11-08. That agent's own takeover notes are on the
branch `codex/handoff-034-20261112` (never merged); this file states what was verified and decided since.

## State verified on 2026-11-12

| Area | State |
| --- | --- |
| v0.33.0 | Published on 2026-11-08: all seven packages on npm at `latest` with provenance, `gitHead` equal to tag `v0.33.0` (`26fd4de9`), GitHub release present |
| pptx.gallery, openpresentation.org | On 0.33.0 (`main` pins 0.33.0; the hosted `/mcp` endpoint and viewer are on openpresentation.org `main`) |
| pptx.dev | Still on 0.32.1 at takeover. The old adoption pull requests (#200, #208, #209, #211) bury the change under evidence files and workflow rewrites; a clean adoption pull request replaces them (see Sites) |
| v0.34 source | `codex/integration-034` (pull request #1225) plus the four test-only commits of `codex/rr-034-next-source-20261112` (`6cb8f52`), then the review fixes listed below |

## What v0.34.0 contains

Wave 2 layouts (LH-46, LH-69, LH-102, LH-30, LH-80, LH-75, LH-73, LH-10, LH-41, LH-101), duration timelines (LH-16), image
callouts (LH-34), a slide-level language with its complex-script font (LH-106, LH-178), light named fonts (LH-177), localized
timeline status words (LH-121), explicit chart reference lines (LH-110), Graphviz DOT and PlantUML (SH-12, SH-13), SmartArt
import (SH-08), added SmartArt entries (SH-23), inverted pyramids (SH-24, issue #1128), overlays anchored to a chart data point
(SH-25, issue #1113), readable diagram fallbacks (SH-26), org chart, hierarchy and Venn layouts (SH-21, as OPF layouts with
editable shapes in PPTX), native wrapped titles and body wrap margins (issues #1127, #1089, #1091), the format-audit schema
renames (FA-34 to FA-38), LibreOffice qualification tooling (RR-106, still experimental), the editor browser suites on Windows
(LH-179), the MCP bundle attached to releases (RR-107) and dependency updates.

Updating a deck from 0.33: see the migration page added with the schema review fixes (run `lang` becomes `language`; physical
`left`/`right` become `start`/`end` where the schema changed; anchored overlay pixel sizes move to `widthPx`/`heightPx`; closed
objects reject unknown keys; a gradient background needs `stops`; reference lines are authored as `chart.referenceLines`).

## Acceptance done on 2026-11-12

1. **Code review.** Six independent reviews of the whole diff from `main`: schema and validation; layout and chart geometry; the
   DOT and PlantUML readers; the PPTX exporter and importer; renderer, editor, MCP, CLI and gallery; workflows, scripts and the
   release path. Every confirmed finding was fixed on a review-fix branch and folded in (see the pull request body for the list).
2. **Before/after sheets.** Every slide whose golden hash moved from `main` was rendered in both versions and judged against the
   owner's direction (bodies fill the slide, type grows and is centered, never shrink text, lines within about 70 characters):
   23 example slides in 10 decks, 24 template slides, 46 new example slides and 104 new template slides.
3. **PowerPoint (COM) pass.** The RR-105 qualification corpus, extended with the ten new v0.34 example decks (32 decks, 37 files,
   67 features), was exported, opened in PowerPoint 16.0.20527 on Windows, probed, round-tripped and compared slide by slide with
   OPF's preview.
4. **Goldens.** Regenerated only by `golden.yml` on the branch; every moved hash was reviewed against the sheets.

Results and the remaining gaps are in the pull request body and in the RR-105 progress log.

## Decisions made for the owner on 2026-11-12 (all vetoable)

- **Evidence stays in the tree for this release.** The integration carries about 316 MB of qualification evidence under `docs/`
  (archives, logs, images). `main` already holds about 387 MB of the same kind, a few tests read files from it, and removing it
  safely is its own job. A follow-up moves handoff evidence under the sparse-excluded `docs/evidence` or off the tree.
- **Org charts, hierarchies and Venn diagrams ship as OPF layouts that export as editable native shapes.** Live SmartArt for them
  stays off (core's domain has no entry for them, so the exporter falls back with the reason). The live-SmartArt witness run the
  previous agent prepared is not needed for 0.34 and is deferred with SH-21's live domain.
- **One PowerPoint pass with the maintained RR-105 runner replaces the previous agent's separate native campaigns.** It covers
  every new feature example and the 0.33 baseline in one run.
- **Continuation pages may grow.** A continuation page never draws text smaller than the page before it, but it is not capped at
  the first page's size: its body grows to fill the slide as an unpaginated slide's does, within the reading measure. v0.34
  development had capped it, which drew paginated matrix, cycle and flow lists at 24 px where v0.33.0 drew 30.67 px.
- **The layout sampler shows the catalog's current layouts.** Its embedded layout records were a stale copy in v0.33.0 (centered
  cover, section, statement and closing); the refreshed copy draws them start-aligned under the accent rule, as the gallery
  records and pptx.gallery already did in v0.33.0. No engine change is involved.
- **Short mixed code grows even when a statement wraps onto more lines** (layout sampler slide 48), and **a grown table header may
  wrap** (slide 46): accepted as larger type that fills the slide; both are worth the owner's eye.
- **Repeated spaces in a title:** see the RR-105 progress log for the contract (balancing never moves a word because of an
  authored run of spaces).
- **Renaming a presentation** uses the full toolbar row with Save and Cancel; leaving the field no longer saves.

## Known gaps carried into 0.34.0 (not regressions)

- PowerPoint draws text 2 to 6 px higher than the preview, growing with the font size (84 pt titles: 4 to 5 px). It is smaller
  than in the accepted 0.33.0 pass; an exact first-baseline model is future work.
- PowerPoint lays out a chart's inner plot area itself: gridlines and axis titles can sit 5 to 15 px from the preview's.
- `shapes` slide 6: the probe reports the stacked "OPF" label past its frame; the same false positive was accepted for 0.33.0.
- UI-only checks (Accessibility Checker, Edit Data, adjust handles) are not run: UI control is not allowed.
- Yu Gothic draws lighter in PowerPoint than the preview's stand-in (LH-183): recorded in the font tracker.

## Owner-only steps

- Merge the site pull requests (each merge deploys its site).
- In Claude: Settings, Connectors, Add custom connector, `https://www.openpresentation.org/mcp`; then uninstall the local OPF
  `.mcpb` extension.
- Decide whether to promote LibreOffice from "experimental" and whether to take up D2 (recommended against).
- Any deploy, DNS change or login.

## How to resume

Read `AGENTS.md`, this file and the [working rules](../2026-11-07/working-rules.md). The release runbook is
[docs/release-process.md](../../release-process.md). Watch and merge only with `node scripts/pr-gate.mjs`. PowerPoint COM: one
driver at a time, check that no `POWERPNT.EXE` is running first, never kill Office.
