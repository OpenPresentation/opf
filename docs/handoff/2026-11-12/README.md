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
| pptx.dev | `master` pinned 0.32.1 at takeover and production served an older build (the 0.32.0 diagram change): see Sites |
| v0.34 source | `codex/integration-034` (pull request #1225): the previous agent's assembly (`6cb8f52`) plus the review fixes and the additions listed below |

## What v0.34.0 contains

From the previous assembly: wave 2 layouts (LH-46, LH-69, LH-102, LH-30, LH-80, LH-75, LH-73, LH-10, LH-41, LH-101), duration
timelines (LH-16), image callouts (LH-34), a slide-level language with its complex-script font (LH-106, LH-178), light named fonts
(LH-177), localized timeline status words (LH-121), explicit chart reference lines (LH-110), Graphviz DOT and PlantUML (SH-12,
SH-13), SmartArt import (SH-08), added SmartArt entries (SH-23), inverted pyramids (SH-24, issue #1128), overlays anchored to a
chart data point (SH-25, issue #1113), readable diagram fallbacks (SH-26), org chart, hierarchy and Venn layouts (SH-21, as OPF
layouts with editable shapes in PPTX), native wrapped titles and body wrap margins (issues #1127, #1089, #1091), the format-audit
schema renames (FA-34 to FA-38), LibreOffice qualification tooling (RR-106, still experimental), the editor browser suites on
Windows (LH-179), the MCP bundle attached to releases (RR-107) and dependency updates.

Added on 2026-11-12 at the owner's direction:

- **MCP Apps in the viewer (RR-111).** The viewer registers `read_deck`, `select_slide` and `edit_deck`; the server tool that opens
  it for editing is `open_editor`; a session is derived from the deck's name.
- **A smaller viewer.** The precompiled validators and the unused locales were cut; the viewer resource has about 1 MB of headroom
  under the 10 MiB JSON-RPC frame, asserted by a test ([mcp-viewer-size.md](../../programs/release-readiness/mcp-viewer-size.md)).
- **Icon sets as files (RR-63).** `@openpresentation/gallery` ships each icon as its own file plus one whole-set file per set;
  `galleryIconSets(load?)` reads only the icons a deck uses, `fetchIcons(base)` reads them over HTTP, and a failed load never
  blocks drawing. No bundle carries a whole icon library unless the host asks for it. See `docs/icons.md`, "Loading".
- **Numbers in the language's own digits (LH-106).** One table generated from CLDR 48 replaces render-time `Intl`; a `-u-nu-`
  language tag overrides the digits. See `docs/design-resolution.md`.
- **The agreed schema-review items** (from the branch `claude/elegant-bell-2g5ks5`): `opf/chart-reference-unsupported-type`,
  `opf/shape-off-slide`, overlay sizes capped at 8, emphasis kept with reference lines, `ColorScheme.name`.
- **Evidence out of the tree (RR-20).** See the decision below.

Added on 2026-11-12 and 2026-11-13 after the coverage decks, the Mac review and the owner's audit of PowerPoint's ribbon:

- **Format-coverage decks.** Thirty decks in the qualification corpus use every key, enum value and alternative of the schema and
  every default layout (`pnpm check:format-coverage`). Opening them in PowerPoint and Keynote found the defects fixed in the
  `rr-105-*` change fragments (watermark tags, area chart gaps, radar fill, team avatars, picture tone, overlays on contained
  pictures, link underlines at a line end, words split in shapes, and others).
- **Keynote fixes from the Mac review.** Line and area charts with reference lines open in Keynote; percent labels keep their
  sign; a reference line's helper series is named after its label; an extended chart falls back to a picture of OPF's preview.
- **Larger display text (LH-188, LH-189; the owner asked for it in 0.34).** A one-message slide grows its statement, quote or
  figure up to ceilings keyed to its length (a figure up to 252 px); display text in Latin, Greek or Cyrillic takes -1.5% tracking
  and a two-line display text a 1.0 em pitch. 128 slides of the corpus move; no text is smaller.
- **The ribbon-audit patch checklist (issue #1290, items 1 to 5).** Chart workbooks name the deck's author; the notes page is the
  standard portrait page; File > Info shows tags, language and the organization; charts, tables, logos and quote photos get a
  generated description; Home > Layout lists user-facing layout names. Item 6 (Selection Pane names) stays open: the names are
  read by the sealed native-acceptance helpers and by 37 source modules.
- **Every slide title is the Title placeholder (issue #1291).** All 1,287 titles of the corpus. See the decisions below.
- **Theme font references (issue #1293).** Runs, tables and SmartArt text reference the theme's heading and body fonts, so
  Design > Variants > Fonts restyles a deck; charts keep font names.

Updating a deck or a host from 0.33: [docs/migrations/0.34.md](../../migrations/0.34.md).

## Acceptance done on 2026-11-12

1. **Code review.** Six independent reviews of the whole diff from `main` (schema and validation; layout and chart geometry; the
   DOT and PlantUML readers; the PPTX exporter and importer; renderer, editor, MCP, CLI and gallery; workflows, scripts and the
   release path), then an independent review of each addition above. Every confirmed finding was fixed on a branch and folded in.
2. **Before/after sheets.** Every slide whose golden hash moved from `main` was rendered in both versions and judged against the
   owner's direction (bodies fill the slide, type grows and is centered, never shrink text, lines within about 70 characters).
3. **PowerPoint (COM) pass.** The RR-105 qualification corpus, extended with the ten new v0.34 example decks (32 decks, 37 files,
   67 features), exported, opened in PowerPoint 16.0.20527 on Windows, probed, round-tripped and compared slide by slide with
   OPF's preview; then targeted runs for live SmartArt (SH-21) and for digits.
4. **Goldens.** Regenerated only by `golden.yml` on the branch; every moved hash was reviewed.

5. **Keynote and PowerPoint for Mac.** The Mac session ("OPF v0.34.0 Mac review") opened the corpus on the Mac mini; its four
   fixes are folded in (issues #1278, #1298, #1299, #1314 hold what remains).
6. **PowerPoint runs for each 2026-11-13 addition.** Each patch-checklist item, the title placeholders (four probe decks of line
   placement in up to 40 faces, then 12 decks with 161 slides), the theme font references (160 of 161 slides identical, then the
   theme fonts switched through the object model) and the display-growth slides were opened and measured in PowerPoint before
   they were merged. The measurements are in the RR-105 progress log (`docs/programs/release-readiness/burndown.md`).

Results and the remaining gaps are in the pull request body and in the RR-105 progress log.

## Decisions made for the owner on 2026-11-12 (all vetoable)

- **Evidence leaves the source tree.** The owner asked for it. All qualification evidence (about 310 MB the release had added and
  about 427 MB already on `main`) is removed; the 30 small files that tests and trackers read moved to named fixtures and tracker
  inputs. `pnpm check:evidence-size` refuses a pull request that adds evidence under `docs/`. Nothing was rewritten in history and
  no branch was deleted: old evidence is readable with `git show <sha>:<path>` (see [docs/handoff/README.md](../README.md)). New
  evidence goes to pull-request attachments or workflow artifacts, or as a fallback to an evidence-only branch.
- **Org charts, hierarchies and Venn diagrams ship as OPF layouts that export as editable native shapes.** Live SmartArt for them
  was measured on 2026-11-12 (66 files): as opened it matches OPF exactly (geometry within 0.001 pt, same text sizes and line
  breaks) for Latin text with one line per entry, 2 to 8 entries (Venn 1 to 3 sets). Editing is the problem: a longer retyped label
  wraps inside words and overflows its box, and an added node gets PowerPoint's own text size beside OPF-sized siblings. The owner
  has the results and decides the strategy; until then live SmartArt stays off for these three.
- **Checking and PPTX export stay in the viewer.** Moving checks to the server saves 0 bytes (the editor validates every edit
  itself) and the findings differ on 16 of 157 decks; server export is slower, not byte-identical on 4 of 149 examples, and does
  not fit the hosted Worker. Numbers are in the RR-111 progress log.
- **One PowerPoint pass with the maintained RR-105 runner replaces the previous agent's separate native campaigns.** One of those
  campaigns (the reference series-name edit) was measured on the export before the data-label XML fix; the measured archive is kept
  as a fixture and the route still admits only it.
- **Continuation pages may grow.** A continuation page never draws text smaller than the page before it, but it is not capped at
  the first page's size: its body grows to fill the slide as an unpaginated slide's does, within the reading measure.
- **The layout sampler shows the catalog's current layouts.** Its embedded layout records were a stale copy in v0.33.0.
- **Short mixed code grows even when a statement wraps onto more lines** (layout sampler slide 48), and **a grown table header may
  wrap** (slide 46): accepted as larger type that fills the slide; both are worth the owner's eye.
- **Repeated spaces in a title:** balancing never moves a word because of an authored run of spaces (RR-105 progress log).
- **Renaming a presentation** uses the full toolbar row with Save and Cancel; leaving the field no longer saves.
- **A dimmed chart line keeps 3:1 contrast** even when every point carries its value; filled marks keep the lighter treatment.
- **Digits:** see the LH-106 progress log for the rules (which numbers follow the language, which stay Latin because PowerPoint
  draws them, and the separators used with Arabic-Indic digits).

Decisions of 2026-11-13 (all vetoable):

- **No title moves from where 0.33.0 put it.** A plain one-line title is written exactly as in 0.33.0. PowerPoint lifts a
  title's first line by 1 to 4 px for any line spacing other than exactly 100%, and the face of the end-of-paragraph mark moves it
  by up to 3 px, so wrapped titles are written as one paragraph per line at 100% with space before, and titles that 0.33.0 wrote
  as text boxes end each paragraph in the body face. One baseline model for all titles is issue #1317.
- **PowerPoint wraps a title itself only where that was measured.** Left-to-right Latin, Greek and Cyrillic titles in the faces
  measured in their own font; every other title keeps the preview's lines as fixed paragraphs in the one placeholder.
- **Two-line display titles keep LH-189's tight pitch** through a later paragraph under 100% with a measured correction per face.
  Bookman Old Style draws line 2 1.25 px high; the other five measured faces are within 0.75 px.
- **Document properties.** Company is the deck's primary organization or is omitted (never the author or "OPF");
  `dc:language` is written but not read back; generated descriptions are plain English and are not imported as authored `alt`.
- **Layout names** are "Blank", "Title Only", "Title and Text" and the layout record's own name, numbered for variants; the
  identity is in the layout's OPF tag.
- **A theme font change made in PowerPoint imports as `design.fontScheme`** (the catalog id is kept when the fonts match).
- **Display text tracks only where the deck's own faces draw it:** not in scripts without case, not with a run in a face of its
  own (symbol fonts, inline code, a named family). A two-character last line never stands alone (`stubLine`); balancing display
  text in scripts without word spaces is issue #1315.
- **Identity pins under `scripts/native-acceptance` moved with the export** where the consumed content is provably unchanged,
  each with a dated comment and the previous value. Pins that encode a PowerPoint observation were not touched.
- **The reference series-name measurement is to be taken again (owner's choice, 2026-11-13).** The sealed archive was taken on an
  older export; three `reference-name-snapshot` tests compare it with the current export and fail until a new archive is sealed
  on the final export. The sealed worker `packages/pptx/test/native-furniture-control.ps1` admits only the old input by hash
  and looks for the old helper names; changing it needs the owner's word, asked on 2026-11-13. The tool and the runbook for the
  new measurement are on the local branch `claude/rr-034-remeasure`.

## Known gaps carried into 0.34.0 (not regressions)

- PowerPoint draws Aptos text about 0.06 em higher than the preview at every size: 2 to 6 px on body text and titles, 12 to 15 px
  on a figure at the 252 px ceiling of LH-188 (issue #1309 has the measurements). The preview draws a substitute for Aptos; an
  exact first-baseline model is future work.
- A period before a closing quotation mark is kerned in the preview and not in PowerPoint (16 px at 54 px).
- PowerPoint lays out a chart's inner plot area itself: gridlines and axis titles can sit 5 to 15 px from the preview's.
- Aptos Display draws in a substitute face in PowerPoint at very large sizes (174 pt; fine at 120 pt and below).
- Roboto SemiBold is not among Office's cloud fonts: timeline labels draw regular in PowerPoint.
- `shapes` slide 6: the probe reports the stacked "OPF" label past its frame; the same false positive was accepted for 0.33.0.
- UI-only checks (Accessibility Checker, Edit Data, adjust handles, the Numeral option) are not run: UI control is not allowed.
- Yu Gothic draws lighter in PowerPoint than the preview's stand-in (LH-183): recorded in the font tracker.

## Deferred, each with its reason

| Item | Where | Reason |
| --- | --- | --- |
| YAML and Markdown sources keep their formatting on outside edits | issue #1274 | A source-preserving writer is its own design; YAML first, in 0.35 |
| Reference lines on stacked charts | issue #1276 | Needs a decision on which total a line refers to |
| Fill vocabulary (O2 of the schema review) | issue #1275 | Not to be built without the owner |
| D2 as a diagram language | issue #1273 | Owner decision; recommended against |
| Promoting LibreOffice from "experimental" | issue #1272 | Owner decision after 0.34 |
| Loading viewer parts on demand, or compressing the viewer | RR-111 log | Needs a test in a real Claude host first |
| What Keynote cannot draw, and an opt-in Keynote route | issues #1278, #1298, #1299, #1314 | Found by the Mac review ([mac-review-brief.md](mac-review-brief.md)); four fixes are in 0.34.0 |
| Native body text by default | issue #1292 | Two to four weeks of work; starts after 0.34.0 |
| Selection Pane names, a real slide master, embedded fonts, chart labels as native labels | issues #1290 (item 6), #1294, #1295, #1296 | The rest of the ribbon audit |
| Layout, chart, icon, digit and import follow-ups | issues #1279 to #1289 and #1300 to #1317 | Everything found during the assembly and not built |

## Owner-only steps

- In Claude: Settings, Connectors, Add custom connector, `https://www.openpresentation.org/mcp`; then uninstall the local OPF
  `.mcpb` extension; then run the MCP Apps checklist in the RR-111 log in a real Claude host.
- Decide the SmartArt strategy (issue #1310), LibreOffice promotion (#1272), D2 (#1273), an authored background on message
  slides (#1300) and the opt-in Keynote route (#1298).
- Answer whether the sealed native-acceptance worker may be changed for the reference-name measurement (see the decisions).
- Any DNS change or login. (On 2026-11-12 the owner allowed the supervising session to merge and deploy the sites when the
  change is verified; that permission was for that session.)
- Decide whether to delete the evidence-only branches and the previous agent's folders under `C:\opf-work`.

## Sites

See the release pull request and the three site repositories for the 0.34 pull requests. pptx.dev needed three fixes before any
adoption could deploy: its signed-in tests waited for Clerk on a page that no longer loads it (pptx-dev#214), a revoked API key
still authenticated (pptx-dev#215), and its size check still enforced a compressed limit Cloudflare removed (in pptx-dev#212).

## How to resume

Read `AGENTS.md`, this file and the [working rules](../2026-11-07/working-rules.md). The release runbook is
[docs/release-process.md](../../release-process.md). Watch and merge only with `node scripts/pr-gate.mjs`. PowerPoint COM: one
driver at a time, check that no `POWERPNT.EXE` is running first, never kill Office.
