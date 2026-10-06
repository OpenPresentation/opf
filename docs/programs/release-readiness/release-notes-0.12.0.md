# Release-readiness note: the 0.12.0 release train

Status: **draft** of 2026-10-02 for the owner (FF-15, RR-20). Internal repository documentation: nothing here is
shown on pptx.gallery, openpresentation.org or pptx.dev, and it states no support or parity percentages (owner
decision 2026-09-30; see the [README](README.md) invariants). Tracker: [burndown.md](burndown.md).

It covers what the lockstep release train of 2026-10-02 shipped, the native PowerPoint evidence behind the
PowerPoint-facing claims, the gaps that are descoped or still open (with their issues) and the decisions taken on
the owner's behalf that the owner can veto. Two parts of RR-20 are not finished and are marked as such below: the
three sites adopt the release (another agent), and the native fidelity pass on the published set is still to run (the configuration audits and the parity run are done).

## What the owner needs to know

- Five packages are on npm with provenance: core 0.12.0, opf-render 0.12.0, opf-pptx 0.12.0, opf-editor 0.11.0 and
  the CLI 0.10.0 (bundles core 0.12.0). Everything the program added since the font-fidelity closure ships in this
  train: native header/footer and SVG pictures (first in opf-pptx 0.11.9), vector PDF, the right-to-left layout, the
  new spec fields (templates and variables, numbered lists, footnotes, citations and captions, chart options) and the
  editor, player and CLI scope of 2026-10-01.
- It is a **geometry-moving release**: composed font sizes snap to PowerPoint's 0.01 pt grid, a wrapped line's
  trailing space hangs, promoted regions compose in reading order and right-to-left decks compose mirrored.
  Preview and export only agree when both resolve the same core, so the renderer, PPTX and editor raise their core
  floor to `^0.12.0` together. Do not run core 0.12.0 beside an older renderer or exporter.
- The libraries stay deterministic and offline. Every PowerPoint-facing feature below was checked natively by the
  supervisor, except the two gaps named under "Not yet verified".
- What is not in 0.12.0 is listed with issues in [Known gaps and descoped items](#known-gaps-and-descoped-items).

## What shipped, per package

Registry state, verified 2026-10-02: each version is `latest` on npm, its `gitHead` equals the release commit, and
its SLSA provenance attestation names the release workflow and tag. Release PRs are the ones in the burndown log.

| Package | Version | `gitHead` | Release PR | Core floor |
| --- | --- | --- | --- | --- |
| `@openpresentation/opf` | 0.12.0 | `5e1dda7` | [opf#280](https://github.com/OpenPresentation/opf/pull/280) | - |
| `@openpresentation/opf-render` | 0.12.0 | `3b300a3` | [opf-render#110](https://github.com/OpenPresentation/opf-render/pull/110) | `^0.12.0` |
| `@openpresentation/opf-pptx` | 0.12.0 | `1f50912` | [opf-pptx#151](https://github.com/OpenPresentation/opf-pptx/pull/151) | `^0.12.0`; optional peer renderer `^0.12.0` |
| `@openpresentation/opf-editor` | 0.11.0 | `9c38a1e` | [opf-editor#77](https://github.com/OpenPresentation/opf-editor/pull/77) | `^0.12.0`; optional peer renderer `^0.12.0` |
| `@openpresentation/cli` | 0.10.0 | `21dcdc6` | [opf#281](https://github.com/OpenPresentation/opf/pull/281) | bundles core 0.12.0 |

Follow-up docs: [opf#282](https://github.com/OpenPresentation/opf/pull/282) (the renderer's vendored lazy-font
count, unchanged at 94), [opf#283](https://github.com/OpenPresentation/opf/pull/283) (release plan, compatibility
matrix, quickstart) and [opf#257](https://github.com/OpenPresentation/opf/pull/257) (vector PDF docs). The
[release plan](../../../release-plan.json) and the [compatibility matrix](../../compatibility-matrix.md) carry the
exact pins once #283 merges.

### Core, `@openpresentation/opf` 0.12.0

- Additive schema, no removal or rename (`check:breaking` clean against 0.11.4): templates and variables (RR-32),
  numbered lists (RR-33), references, citations, footnotes and captions (RR-34), chart options (RR-35) and the
  font-policy `sizeAdjust`, `lineAscent` and `lineAscentMixed` fields (RR-38).
- Geometry: the 0.01 pt font grid (RR-16, [record](rr-16-font-size-grid.md)), hanging wrap whitespace and exact fits
  (RR-17), promoted regions in visual reading order (RR-29) and mirrored right-to-left composition (RR-05,
  [design record](rr-05-rtl-layout.md)). A deck that uses none of the new fields and is left to right changes only
  where the first three moved geometry.
- New subpaths: `/convert` (RR-26), `/audit` (RR-29), `/markdown` (RR-30), `/patch`, `/diff` and `/format` (RR-31);
  shared tables for code syntax colours, the metric trend mark and the 54 preset patterns (RR-07); the palette
  adjustment for dark cards (RR-29).

### opf-render 0.12.0

- The preview draws everything above: mirrored right-to-left decks, numbered lists, citations, footnotes and
  captions, chart axis titles, legend and data labels, template variables, code language colours, trend arrows and
  the 54 patterns, Arabic Typesetting at PowerPoint's size, SVG images only where opf-pptx would export them, and the
  symbol, emoji and math font paths.
- Vector PDF with selectable text by default (`mode: "vector"`; `mode: "raster"` is the previous output) (RR-12,
  [evidence](https://github.com/OpenPresentation/opf-render/blob/main/docs/evidence/rr-12-vector-pdf.md)).
- Browser PNG and PDF output (`/export-browser`, RR-23), the slideshow player and the `<opf-deck>` element (RR-28)
  and the `opf-preview-fonts` bin.
- The variable-font metric gate is 0.15 px (RR-15, owner decision).

### opf-pptx 0.12.0

- Export and import of everything above as native constructs: right-to-left decks mirrored (`algn r`, `a:tblPr rtl`),
  numbered lists as `a:buAutoNum`, native footnote areas, citation markers and captions, chart axis titles, legend and
  data labels (classic and chartex), code colours and trend arrows, chart text on the 0.01 pt grid, distinct series
  colours on dark cards and one-colour single-series column and bar charts (RR-36).
- Native header/footer placeholders (`dt`, `ftr`, `sldNum`, master, layout and notes master, `p:hf`; RR-11) and
  native SVG pictures over a PNG fallback (RR-10) shipped in 0.11.9 and are refined here.
- `fromPptx` returns raw layout and style signals for third-party decks (`signals: true`, RR-13, since 0.11.9),
  reads native equations (FF-45) and restores more of the authored form (author arrays, run colour references, item
  descriptions, hard line breaks; RR-08 and RR-09).

### opf-editor 0.11.0

- Slide management (add, duplicate, delete, reorder, hide, sections, sorter, outline; RR-21), autosave and restore
  with an unsaved-changes warning (RR-22), PDF, PNG and SVG downloads (RR-23), a data grid with table and chart row
  and column operations (RR-24), deck-wide find and replace, image crop with a focal point and the phone and tablet
  layout (RR-25), content conversions on core's `/convert` (RR-26), the Review panel over the audit (RR-29), the fill
  UI for templates (RR-32), numbering, chart option and annotation controls (RR-33, RR-35, RR-34) and the single
  JSON Patch module (RR-31).
- Dimension switching with patch, undo and preview refresh, editable design-level options, image upload and every
  background and header/footer part (RR-06, FF-16).

### CLI 0.10.0

- New commands: `opf audit`, `opf from-md` and `opf to-md`, `opf diff`, `opf merge` and `opf format`, `opf fill`
  (template fill), `opf render`, `opf export pdf|png|svg|pptx` and `opf import deck.pptx`. `opf edit` and
  `import-data` run on core's shared patch module. `opf-render` and `opf-pptx` are optional peers loaded on first
  use. Node 24 only. See the [CLI reference](../../cli.md).

## Verified native PowerPoint evidence

Native checks are supervisor-run on the Windows host with desktop PowerPoint (read-only opens, `Slide.Export`,
`SaveAs` round trips; agents never open Office). Decks and PNGs that name proprietary fonts are not committed; the
reports and comparison outputs are.

| Evidence | Covers |
| --- | --- |
| [rr-33-35-native-20261001](../../evidence/rr-33-35-native-20261001/README.md) ([v2 run](../../evidence/rr-33-35-native-20261001/v2-run-20261001.md), [parity investigation](../../evidence/rr-33-35-native-20261001/parity-investigation.md)) | Numbered lists (RR-33), footnotes, citations and captions (RR-34), chart options (RR-35) and the single-series chart colour (RR-36). The v1 run found citation markers about 0.75 times smaller (F1) and chartex axis titles lost on save (F2); both were fixed and the v2 run (25 decks) passed |
| [rr-05b-native-20261002](../../evidence/rr-05b-native-20261002/README.md) | Right-to-left layout (RR-05): alignment, bullets, table `rtl`, chart mirroring and `v2.0` bidi order, 4 decks, 0 failing checks |
| [spec-gaps-native-20261001](../../evidence/spec-gaps-native-20261001/README.md) | Chart text at 12 pt (FF-62), slide sections and nested-group round trip, design fields (logos, accent font, picture bullets) |
| [windows-native-charts-20260930](../../evidence/windows-native-charts-20260930/README.md) | The native chartex chart types (FF-56) |

Recorded in the burndown rows without a committed evidence folder: the native checks of SVG pictures (RR-10) and of
native header/footer (RR-11, `p:hf`; relevant to [opf#87](https://github.com/OpenPresentation/opf/issues/87)), and
the PowerPoint measurements behind the 54 pattern tiles (RR-07, in the [core changelog](../../../CHANGELOG.md)) and
the Arabic Typesetting baseline probe (RR-38, [opf#279](https://github.com/OpenPresentation/opf/pull/279)). The
cross-platform evidence for the published set is not native PowerPoint but is linked for completeness:
[rr-04-cross-platform-20261001](../../evidence/rr-04-cross-platform-20261001/README.md) (measured on the 0.11.4
train; the Published packages matrix runs again on the 0.12.0 set in opf#283).

### Not yet verified natively

- The FF-12 sample (CJK, `Presentation.Fonts` naming only the chosen families), and with it FF-13 (font-embed
  attempt), FF-05 (Aptos root cause) and FF-46 (native font verification per family). RR-05 and RR-17 stay open on
  them.
- PowerPoint's own line breaks for CJK and Thai (RR-39, descoped below).

## Known gaps and descoped items

| Item | State | Issue |
| --- | --- | --- |
| Native PowerPoint video (`p:video`) and preview playback | Descoped by the owner 2026-10-01 | [opf-pptx#127](https://github.com/OpenPresentation/opf-pptx/issues/127) |
| Chart data from external spreadsheets (`ChartDataSource`, `dataResolver`) | Descoped by the owner 2026-10-01 | [opf#240](https://github.com/OpenPresentation/opf/issues/240) |
| Navigation and motion (transitions, builds, reveals, links between slides) | Deferred, out of v1 | [opf#250](https://github.com/OpenPresentation/opf/issues/250) |
| Rich speaker notes (plain-text notes stay) | Deferred, out of v1 | [opf#251](https://github.com/OpenPresentation/opf/issues/251) |
| `world` region map chart (stays a clustered column with a `chart-data-adapted` diagnostic) | Parked, post-v1 | [opf-pptx#133](https://github.com/OpenPresentation/opf-pptx/issues/133) |
| CJK and Thai line breaking in core (dictionary word breaking for Thai, Lao, Khmer, Myanmar; East Asian kinsoku) | Descoped from the first release 2026-10-02 (supervisor, vetoable) | [opf#278](https://github.com/OpenPresentation/opf/issues/278) |
| Arabic chart labels are not size-adjusted: the preview draws chart labels from the deck's body font without script planning, so they keep the unadjusted size and baseline (stated in [opf-render#109](https://github.com/OpenPresentation/opf-render/pull/109)); code and metric segments and tabbed lines take the size but not the baseline shift | Known gap, no issue filed yet | - |

Declined with no issue: a VS Code extension, and a language set per slide or per run. Also open and not
release-blocking: the owner's `PPTX_GALLERY_READ_TOKEN` for the catalog drift check (FF-37, README Open decisions),
the roadmap issues [opf#87](https://github.com/OpenPresentation/opf/issues/87) and
[opf#88](https://github.com/OpenPresentation/opf/issues/88) (status comments to refresh, RR-18), the stability of
pptx.dev CI over repeated runs (RR-02) and the 2026-10-01 caveat on the editor: radial gradients are not offered
because the OPF schema has none.

Each descoped issue states the current behaviour, what full support needs and where the evidence is.

## Decisions taken (vetoable)

Taken without waiting on the owner and recorded so they can be reversed. Items 1 to 6 are the ones of this train;
the owner's own decisions of 2026-10-01 are in the [README](README.md) and are not repeated here.

1. **Arabic Typesetting stays the default for Arabic, Persian and Urdu; the preview is fixed with `sizeAdjust`
   0.64 and `lineAscent`** (RR-38; [opf#275](https://github.com/OpenPresentation/opf/pull/275),
   [opf#279](https://github.com/OpenPresentation/opf/pull/279),
   [opf-render#109](https://github.com/OpenPresentation/opf-render/pull/109)). The replacement (Noto Naskh Arabic)
   draws 1.55 times too large, so the font policy carries a preview-only multiplier (0.64 balances measured advances,
   0.60 to 0.64, and ink, 0.71) and the native baseline offsets (0.70, and 0.78 with a Latin run). Arial and Times
   New Roman fit within 5 to 12 percent without a multiplier, but replacing the calligraphic default is a design
   choice left to the owner. Export is unchanged. To veto: change the `arabic` default and drop the multiplier.
2. **Single-series bar and column charts export in one colour** (RR-36;
   [opf-pptx#149](https://github.com/OpenPresentation/opf-pptx/pull/149), [opf#272](https://github.com/OpenPresentation/opf/pull/272)).
   PptxGenJS wrote a `c:dPt` per point, so PowerPoint drew four colours where the preview drew one. The chartex
   fallback byte fixture was regenerated for it (owner-approved 2026-10-01), and the parity harness now counts
   `c:dPt` fills. Multi-series, pie and line charts are byte-identical.
3. **Editor image crop is baked into a new asset** (RR-25;
   [opf-editor#74](https://github.com/OpenPresentation/opf-editor/pull/74)): OPF has no crop or focal-point field,
   so Apply writes the cropped pixels as a new asset in one undoable change and Restore original goes back. A schema
   field (and native `a:srcRect`) would replace it; that is a spec change for the owner to ask for.
4. **Windows Chromium whole-pixel ink tolerance** (RR-17; [opf#276](https://github.com/OpenPresentation/opf/pull/276)):
   Chromium on Windows reports `actualBoundingBox*` in whole pixels, so the timeline workflow's ink check saw the
   text origin and not the ink (0.117 px). When the probe reports integer metrics the check widens by 0.5 px; Linux
   and macOS keep the 0.05 px slack. No layout, test data or other assertion changed. This is a test tolerance on one
   platform, recorded as the only one in this train besides the owner's RR-15 decision.
5. **Ecosystem packages job timeout 25 to 40 minutes** ([opf#246](https://github.com/OpenPresentation/opf/pull/246)):
   the job takes 24 to 25 minutes on core main and was cancelled at the limit with every step passing.
6. **CJK and Thai line breaking descoped from the first release** (RR-39; [opf#278](https://github.com/OpenPresentation/opf/issues/278)).
   It moves geometry, so it needs a core release with raised floors, and PowerPoint's own breaks need a native
   probe. Until then core wraps at white space and, for a token wider than the line, at grapheme clusters.
7. **Composed font sizes quantize in core** (RR-16, [opf#247](https://github.com/OpenPresentation/opf/pull/247)): the
   alternative was to widen the parity tolerance, which would hide that the engines measure at different sizes.
   The run-size tolerance is tighter (0.001 pt, was 0.005 pt), not looser.

Earlier font-program decisions that this train inherits (Aptos Narrow, Serif, Mono and Liberation replacements, the
slide tag colour rule, quote provenance) stay in the [font burndown](../font-fidelity-everywhere/burndown.md).

## What is not finished (RR-20)

- **Site adoption** (another agent): pptx-dev master is on opf-pptx 0.11.9, core 0.11.4, renderer 0.11.9 and
  editor 0.10.6; pptx-gallery#83 (RR-22),
  pptx-dev#70 (RR-23) and
  openpresentation-site#61 (RR-28) are drafts.
  RR-14 (the pptx.dev "Understand this deck" feature) is merged behind default-off flags and also waits for the
  dependency bump, live model recordings and the owner's gateway, budget and zero-data-retention decisions.
- **Re-audit on the published set**: done 2026-10-02 for the configuration audits and the parity run on core 0.12.0,
  renderer 0.12.0, PPTX 0.12.2 and editor 0.11.1 (pptx-gallery `c349a61`): no value regressed against the 0.11.4 train
  or the RR-16 candidate run. Results (RR-20 row evidence):
  [audit A](../font-fidelity-everywhere/gallery-support/audit-a/SUMMARY.md),
  [audit B](../font-fidelity-everywhere/gallery-support/audit-b/results.json) with the
  [catalog-only values](../font-fidelity-everywhere/gallery-support/audit-b/results-2026-10-02-published-0.12-catalog-only.json),
  the [parity run](../font-fidelity-everywhere/gallery-support/parity/PARITY-2026-10-02-published-0.12.md) with its
  [catalog-only run](../font-fidelity-everywhere/gallery-support/parity/PARITY-2026-10-02-published-0.12-catalog-only.md),
  the measurement record in [gallery-support.md](../font-fidelity-everywhere/gallery-support.md), the RR-44 and slot-check
  classifier changes in the [harness README](../font-fidelity-everywhere/gallery-support/README.md#classifier-changes),
  and the regenerated [gallery tracker](gallery-tracker.md) and [font tracker](../font-fidelity-everywhere/font-tracker.md).
  The native fidelity pass on the published set is the owner's and not run yet. The RR-16 parity run on unpublished core
  main is in [rr-16-font-size-grid.md](rr-16-font-size-grid.md).
- **Open items that close RR-20** (burndown): RR-02, RR-03, RR-04, RR-05, RR-14, RR-17, RR-18, RR-19, RR-22, RR-23,
  RR-28; run `pnpm report:release` for the current count.

## 0.12.1 / 0.12.2 / 0.11.2 patch releases (addendum, 2026-10-03)

After the 0.12.0 train three patches were published and verified (npm `latest`, `gitHead` = release merge commit, SLSA
provenance, `npm audit signatures`):

- `@openpresentation/opf-pptx` **0.12.2** (2026-10-02, `e4569ac`, [opf-pptx#155](https://github.com/OpenPresentation/opf-pptx/pull/155)):
  writes the deck language's own Office script entry (Viet, Uigh) with the deck's font, so `Presentation.Fonts` lists no
  extra name (the last case of the FF-05 class; [opf-pptx#154](https://github.com/OpenPresentation/opf-pptx/pull/154),
  native re-run [rr-17-viet-supplement-native-20261002](../../evidence/rr-17-viet-supplement-native-20261002/README.md)).
- `@openpresentation/opf-editor` **0.11.2** (2026-10-03, `c7ac1d7`, opf-editor#85): the slide-size and purpose switches
  ([opf-editor#80](https://github.com/OpenPresentation/opf-editor/pull/80)).
- `@openpresentation/opf` **0.12.1** (2026-10-03, `1f698c4`, [opf#338](https://github.com/OpenPresentation/opf/pull/338)):
  the six plural audience ids (`executives`, `investors`, `customers`, `sales-team`, `marketing-team`, `regulators`) are
  deprecated with `replacedBy` ([opf#309](https://github.com/OpenPresentation/opf/pull/309)); additive catalog data, no
  geometry change (805 raster hashes unchanged), so `opf-render` stays at 0.12.0 and the packages keep `^0.12.0` floors. It
  is the first release run through `scripts/release-train.mjs` ([RR-51](burndown.md)).

The published set is core 0.12.1, opf-render 0.12.0, opf-pptx 0.12.2, opf-editor 0.11.2 and CLI 0.10.0. The numbers and
findings above are for the 0.12.0 set; the re-audit in [opf#314](https://github.com/OpenPresentation/opf/pull/314) used
core 0.12.0, which differs from 0.12.1 only in the audience catalog records.

## 0.12.3 patch release (addendum, 2026-10-05)

`@openpresentation/opf-pptx` **0.12.3** was published and verified on 2026-10-05 (npm `latest`, `gitHead` `1188964` = the
tag `opf-pptx-v0.12.3`, SLSA provenance, `npm audit signatures`), through `scripts/release-train.mjs`. The published set
is core 0.12.1, opf-render 0.12.0, opf-pptx 0.12.3, opf-editor 0.11.2 and CLI 0.10.0; core, renderer, editor and CLI are
unchanged and opf-pptx keeps the core floor `^0.12.0`.

- **What it fixes** ([opf-pptx#162](https://github.com/OpenPresentation/opf-pptx/issues/162),
  [opf-pptx#163](https://github.com/OpenPresentation/opf-pptx/pull/163)): the embedded workbook of a native chart had a
  table range (`ref`) with a stray apostrophe, and a bubble chart's range ended one row short of its data (its last row).
  Keynote dropped the native chart on import when the table range was invalid (it tolerates the short bubble range
  either way). The fix writes both ranges correctly. The native PowerPoint evidence above is unchanged and was not
  re-run for this patch. The apostrophe is in PptxGenJS itself; the same fix is submitted upstream as
  [gitbrent/PptxGenJS#1537](https://github.com/gitbrent/PptxGenJS/pull/1537).
- **How it was found**: the Keynote native check of the 20-deck import set ([opf#341](https://github.com/OpenPresentation/opf/pull/341),
  [evidence](../../evidence/mac-checks-20261002/keynote/README.md)). On opf-pptx 0.12.2 six decks failed, all by losing
  native category charts; the bisect pointed at the table range. The re-check of the fixed decks (built from the fix
  branch before the release) has PASS 0, WARN 20, FAIL 0. This is a Keynote check on a Mac, not a PowerPoint check.
- **Pptx-dev's own generator had the same bug.** Its `/api/v1/generate` and `/api/v1/author/export` output goes through
  PptxGenJS directly, not through opf-pptx, so 0.12.3 does not cover it. Fixed in
  [pptx-dev#93](https://github.com/Data-Advantage/pptx-dev/pull/93) (merged): Keynote kept 0 of 7 charts before and 7 of
  7 after.
- **Adoption**: [pptx-gallery#96](https://github.com/Data-Advantage/pptx-gallery/pull/96),
  [pptx-dev#92](https://github.com/Data-Advantage/pptx-dev/pull/92) and
  [openpresentation-site#76](https://github.com/Data-Advantage/openpresentation-site/pull/76) (release records), and the
  core release plan in [opf#346](https://github.com/OpenPresentation/opf/pull/346) (merged, `05ed089`).

### Pending: the `pptxgenjs-plus` migration (opf-pptx 0.13.0)

PptxGenJS is dormant, so opf-pptx moves to the maintained fork `pptxgenjs-plus` (MIT) as 0.13.0
([opf-pptx#165](https://github.com/OpenPresentation/opf-pptx/pull/165)). This is not released and the published set
above does not include it.

- Keynote native check of the 20 `m-*` decks on the new engine (pptxgenjs-plus 4.3.4, 2026-10-05): 20 WARN, 0 FAIL, every
  native chart kept; the warnings are the same classes as in the 0.12.3 re-check (font substitution and text metrics).
- Still open before release: the Windows PowerPoint a/b set ([opf#323](https://github.com/OpenPresentation/opf/issues/323),
  Windows host, deferred by the owner). 0.13.0 does not ship without it.
- Upstream: the bubble range fix is merged on the `next` branch of
  [lofcz/pptxgenjs-plus#15](https://github.com/lofcz/pptxgenjs-plus/pull/15) and is not yet in a release of the fork.
