# Font fidelity everywhere: burndown

Goal and resume protocol: [README.md](README.md). Research:
[font-flow map (FF-06)](font-flow-map.md), [Aptos origin brief](aptos-origin-brief.md).
Measured per-dimension status: [gallery support table (FF-23)](gallery-support.md).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged after
independent review and green CI, evidence linked), `blocked` (reason in notes).
Every item's criteria must all hold before it is `done`. Dates are UTC.

## Summary

| Status | Count |
| --- | --- |
| done | 6 |
| review / in-progress | 14 |
| todo | 21 |

**Headline progress: 0 of 900 gallery values perfect by parity** (FF-38
baseline, 2026-09-23; opf `53be042`, opf-render `e500ed9`, opf-pptx
`cf0bc0c`, pptx-gallery `f17e9ae`). The 900 values are the 793 presence items
plus 76 charts and 31 `withAssets` variants. The FF-23 presence audit
baseline is 7 of 793 `works`. See the
[scoreboard](gallery-support.md#parity-scoreboard) and its
[universal blockers](gallery-support.md#universal-blockers).

## Items

| ID | Item | Repo | Depends on | Status | Evidence / PR |
| --- | --- | --- | --- | --- | --- |
| FF-00 | Program tracker and agent entrypoints | all | none | done | [opf#116](https://github.com/OpenPresentation/opf/pull/116) `642f37af`; [opf-pptx#60](https://github.com/OpenPresentation/opf-pptx/pull/60), [opf-render#31](https://github.com/OpenPresentation/opf-render/pull/31), [opf-editor#29](https://github.com/OpenPresentation/opf-editor/pull/29) |
| FF-01 | Exporter master bullets follow the theme body font | opf-pptx | none | done | [opf-pptx#57](https://github.com/OpenPresentation/opf-pptx/pull/57), `7b34f557` |
| FF-02 | Embed harness records pre-edit, post-text and post-edit font observations | opf-pptx | none | review | [opf-pptx#58](https://github.com/OpenPresentation/opf-pptx/pull/58) |
| FF-03 | Read-only native font inventory worker | opf-pptx | none | review | [opf-pptx#59](https://github.com/OpenPresentation/opf-pptx/pull/59) |
| FF-04 | Native inventory of the unedited fixture, with and without temporary fonts | opf-pptx / opf | FF-03 | todo |  |
| FF-05 | Aptos root cause determined | opf | FF-02, FF-04 | todo | [brief](aptos-origin-brief.md) |
| FF-06 | Font-flow map across all 14 dimensions and environments | opf | none | done | [font-flow-map.md](font-flow-map.md), [opf#116](https://github.com/OpenPresentation/opf/pull/116) |
| FF-07 | Exporter writes chosen fonts into theme and run East Asian/complex-script slots, with `lang`/RTL | opf-pptx | FF-05, FF-06, FF-18 | todo |  |
| FF-08 | Exporter leaks no hard-coded or default font in any part | opf-pptx | FF-05, FF-06, FF-17 | todo |  |
| FF-09 | Offline pairwise matrix across the 14 gallery dimensions | opf (ecosystem) | FF-07, FF-08, FF-19, FF-20 | todo |  |
| FF-10 | Matrix in CI on ubuntu, windows, macos via a packed TypeScript consumer | opf | FF-09 | todo |  |
| FF-11 | Export determinism independent of host fonts, OS, locale and timezone | opf-pptx / opf | FF-06 | todo |  |
| FF-12 | Native PowerPoint sample of the matrix, including CJK and RTL | opf-pptx / opf | FF-03, FF-07, FF-09, FF-18 | todo |  |
| FF-13 | Font-embed attempt from merged main, audited | opf-pptx / opf | FF-02, FF-07, FF-08 | todo |  |
| FF-14 | Evidence bundles, compatibility matrix and handoff merged | opf | FF-10, FF-11, FF-12, FF-13, FF-16, FF-19 | todo |  |
| FF-15 | Release-readiness note for the release owner (no publishing) | opf | FF-14 | todo |  |
| FF-16 | Editor switch operations for every dimension patch, undo and refresh the preview | opf-editor | FF-06, FF-17 | todo |  |
| FF-17 | Code-font default follows the scheme; gallery apply keeps roles; one shared default scheme | opf, opf-editor, opf-pptx | FF-06 | in-progress | branch `codex/ff-17-*` |
| FF-18 | Language/script model: per-script fonts resolvable from language and font scheme | opf | FF-06 | review | [opf#118](https://github.com/OpenPresentation/opf/pull/118) |
| FF-19 | Renderer script fonts (CJK, Arabic, Indic), `lang` and RTL in previews | opf-render | FF-18 | todo |  |
| FF-20 | Bump ecosystem-ci sibling pins after each opf-pptx font fix | opf | FF-07, FF-08 | in-progress | first bump [opf#117](https://github.com/OpenPresentation/opf/pull/117) `7b4589b6`; sibling CI pins pending |
| FF-21 | Non-blocking macOS browser job tracking opf-render#24 | opf-render | none | done | [opf-render#32](https://github.com/OpenPresentation/opf-render/pull/32) `df27685c` |
| FF-22 | Charts reduced to Aspose.Slides-supported chart types (core catalog and pptx.gallery; deprecate if breaking) | opf, pptx-gallery | none | in-progress | branch `codex/ff-22-*` |
| FF-23 | Measured pptx.gallery support table by dimension and reproducible audit | opf | none | review | [opf#122](https://github.com/OpenPresentation/opf/pull/122), [gallery-support.md](gallery-support.md) |
| FF-24 | Color schemes export as theme colors and re-import | opf-pptx | FF-23 | todo |  |
| FF-25 | Pattern and photo backgrounds export natively and stay distinct | opf, opf-pptx, pptx-gallery | FF-23 | todo |  |
| FF-26 | Image treatments export as native pictures with distinct values | opf, opf-render, opf-pptx, pptx-gallery | FF-23 | in-progress | engine side in progress |
| FF-27 | Headers/footers as OPF furniture with PowerPoint slide-number and date fields | opf-pptx, pptx-gallery | FF-23 | todo |  |
| FF-28 | Narrative and audience catalog parity | opf, pptx-gallery | FF-23 | todo |  |
| FF-29 | Layout catalog parity and export fidelity | opf, opf-pptx, pptx-gallery | FF-23 | in-progress |  |
| FF-30 | Content blocks keep metric text in preview and export | opf, opf-render, opf-pptx | FF-23 | todo |  |
| FF-31 | Font provisioning per the owner font policy: licensed fonts render with shipped open replacements, PPTX keeps the real name and never embeds; open fonts bundled; policy table in core | opf, opf-render, opf-pptx | FF-23, FF-35 | in-progress |  |
| FF-32 | Re-import retains design or emits specific diagnostics | opf-pptx | FF-07, FF-24 | todo |  |
| FF-33 | Gallery snippet and "open in editor" emit every dimension's selected value | pptx-gallery | FF-26, FF-27 | todo |  |
| FF-34 | Socials produce the platform size/aspect ratio or are documented as authoring-only | opf, pptx-gallery | FF-23 | todo |  |
| FF-35 | Shared default font scheme `aptos` across every engine | opf, opf-render, opf-editor, opf-pptx | FF-17 | in-progress |  |
| FF-36 | pptx.gallery items show their measured support status | pptx-gallery, opf | FF-23 | in-progress |  |
| FF-37 | pptx.gallery as a first-class OPF catalog: spec URLs serve schema-valid records; core bundles a pinned, drift-checked snapshot | opf, pptx-gallery | FF-23 | in-progress |  |
| FF-38 | Parity audit harness and progress scoreboard (defines "perfect") | opf | FF-23 | done | [opf#122](https://github.com/OpenPresentation/opf/pull/122), [PARITY.md](gallery-support/parity/PARITY.md) (0/900 baseline) |
| FF-39 | Alignment parity: preview and PPTX text alignment and anchors agree | opf-pptx, opf-render | FF-38 | in-progress |  |
| FF-R0 | Prior: mixed-size table edit/save/reopen and first embed attempt | opf, opf-pptx | none | done | [opf#114](https://github.com/OpenPresentation/opf/pull/114), [opf#115](https://github.com/OpenPresentation/opf/pull/115) |

## Acceptance criteria

**FF-00 Program tracker.** This README and burndown are merged in core. Core
`AGENTS.md` links them under "Active programs". opf-pptx, opf-render and
opf-editor each have an `AGENTS.md` pointing here, with accurate toolchain
commands. The resume protocol works from a fresh clone. Merging the core PR
alone does not close FF-00; the three sibling `AGENTS.md` PRs must merge too.

**FF-01 Master bullet font.** The slide master `bodyStyle` bullets use
`+mn-lt`. Only those nine elements change across the example corpus, import
round-trips are unchanged, and CI is green. Done for the exporter. Native
confirmation of PowerPoint's `Presentation.Fonts` for fixed output is a
separate criterion of FF-12.

**FF-02 Embed harness observations.** `native-font-embed.ps1` records
`Presentation.Fonts` after open, after the text sets and after the font
property sets, plus per-range `Font2` `Name`, `NameAscii`, `NameOther`,
`NameFarEast` and `NameComplexScript` before and after the edits. All are
staged begin/success pairs recorded as observations. The post-edit gate,
allowlist and single `SaveAs($savedPath,24,-1)` are unchanged. Offline controls
and PS 5.1 `-PureRegression` pass on Linux and Windows CI. Independent review
passes.

**FF-03 Inventory worker.** `native-font-inventory.ps1` opens one PPTX
read-only, with no `SaveAs` and exactly one owned close, and records
`Presentation.Fonts` plus per-run font slots for every text range, within
bounds. It supports `-WithoutTemporaryFonts` and control decks. An offline
exclusive-create audit binds hashes, lifecycle, stage pairing and `error:null`.
Controls, pure regression and CI wiring are included. Independent review
passes.

**FF-04 Native inventory.** Root runs FF-03 once per condition, in fresh
directories, on the unedited Carlito fixture with and without temporary fonts,
and on one control deck. Audits pass and the evidence bundle is merged. The
result states whether `Aptos` appears before any edit.

**FF-05 Root cause.** A merged note names the Aptos source, backed by FF-02 and
FF-04 evidence that discriminates the hypotheses: edit-inherited empty theme
`ea`/`cs` (the vendored theme hard-codes `typeface=""` for major/minor
`ea`/`cs`), listed at open, or font-registration specific. If evidence is
inconclusive, the note lists the next discriminating experiment, and the item
stays open.

**FF-06 Font-flow map.** A merged doc maps, for each of the 14 dimensions and
for code, chart, table and notes text, where fonts are chosen, defaulted or
hard-coded, and how each reaches the preview and each PPTX part. It records CI
environment coverage per repo and proposes the pairwise sample.

**FF-07 Script-slot fonts.** For at least one language of every script class
named in FF-06 (at minimum Latin, Cyrillic, Greek, CJK, Arabic/Hebrew RTL,
Indic and Thai), the exporter writes the resolved font into theme major/minor
`ea`/`cs`, instead of the vendored empty values, and into run `ea`/`cs`. For a
Latin deck that is the chosen heading/body family, subject to FF-05. It emits
run `lang`/`altLang` from `language.bcp47` instead of a fixed `en-US`, and
`rtl` for right-to-left languages, so no empty slot is left for PowerPoint to
fill. Offline tests assert the slot inventory per script class. There are no
regressions in the example corpus beyond documented, intended part changes.

**FF-08 No leaked defaults.** A reusable typeface inventory check lives in
opf-pptx and covers every XML part, including nested parts. Over every
example-corpus deck it finds only chosen fonts, `+mj-*`/`+mn-*` references
that resolve to chosen fonts, empty values explicitly allowed by FF-05, and
documented per-script theme supplements. It explicitly covers:

- the theme per-script font list;
- both hard-coded Arial chart data-label sites;
- chart axis and legend `ea`/`cs`;
- the embedded chart workbook's styles and theme (Arial/Calibri today);
- `docProps/app.xml` "Fonts Used", regenerated from the actual font list;
- `pitchFamily`, which must mark monospace fonts correctly.

FF-09 then applies the check to every matrix deck.

**FF-09 Offline matrix.** `scripts/test-font-switch-ecosystem.mjs` in core
(run by `test:fonts`) covers every value class of all 14 dimensions with a
pairwise covering array of roughly 50 to 60 decks. It also has fixed
must-have cases:

- every content type with a proportional and a monospace scheme;
- a per-slide font override;
- CJK text inside a Latin deck.

Each deck is switched A to B and back to A. For each state it exports, applies
the FF-08 check and asserts exported typefaces equal the chosen fonts,
validates the package, and asserts the preview re-rendered with the new fonts.
Content-type changes are block replacements, because no conversion API exists.
The font registry is pinned with substitution off, or every substitution
(for example Calibri to Carlito) is recorded and asserted. The matrix is
deterministic and CI runtime is bounded.

**FF-10 Cross-OS CI.** FF-09 runs on ubuntu, windows and macos, extending the
existing `cli-windows.yml` OS matrix and `check-packed-types.mjs`. It uses a
packed install consumed from a TypeScript project with a pinned TypeScript
version, running `tsc --noEmit` against the published types. Non-Linux jobs
run outside the ecosystem-ci container. On each OS it includes a
headless-browser preview re-render and a run with no system fonts available.
On macOS the required check asserts font families and that re-rendering
happened, not pixel parity; pixel residuals stay in the non-blocking FF-21 job.
It is required on core PRs that touch the matrix or sibling pins. The same
jobs run the FF-38 parity audit and report the perfect count.

**FF-11 Determinism.** Exporting the same deck under different `TZ`, `LANG`
and locale settings, and with no system fonts available, produces
byte-identical PPTX within each OS and across all three OSes. The known
variances must each be pinned, or documented and excluded with justification:
WebP conversion (Node versus browser), font-registry substitution, runtime ICU
version (`Intl.Segmenter`), and `docProps` timestamps.

**FF-12 Native sample.** Root opens a bounded sample of at most 12 decks
read-only with FF-03. It includes at least:

- Carlito with code, chart, table and notes;
- the default scheme;
- a Japanese deck (for example Meiryo);
- an Arabic RTL deck;
- a monospace scheme;
- a per-slide override;
- CJK inside a Latin deck.

Each deck's `Presentation.Fonts` names only its chosen font families, with
theme references resolving to them; any other name fails. This includes native
confirmation for FF-01 output. Evidence is merged.

**FF-13 Embed attempt.** One supervised attempt from merged main, in a fresh
directory, is audited pass or fail. If it passes, the OPC audit shows exactly
the chosen fonts embedded.

**FF-14 Published.** Evidence bundles pass their verifiers. The compatibility
matrix and handoff state exactly what is and is not guaranteed.

**FF-15 Release note.** A merged note lists which merged changes a release
would ship and which consumer repos must follow. It is handed to the release
owner, with nothing published.

**FF-16 Editor switches.** In opf-editor, switching each of the 14 dimensions
produces the expected document patch with working undo/redo, and the preview
refreshes to the new fonts and content. Tests cover every dimension, and
exports after a switch pass the FF-08 check. The decision on content-type
conversion is recorded: either in scope with an API, or explicitly block
replacement only.

**FF-17 Code and default fonts.**
- The `code` role resolves from the chosen font scheme when the scheme
  defines it; otherwise a documented monospace fallback applies. Today core
  falls back to Roboto Mono for every scheme, including the Consolas and
  Courier New schemes.
- Editor gallery apply keeps every font-scheme role, not just major/minor.
- Core, renderer, editor and exporter share one default scheme (the exporter
  uses `aptos` today, the others `roboto`), or the difference is documented
  and tested.

**FF-18 Language/script model.** Core can resolve, for any catalog language,
the font for each script role (Latin, East Asian, complex script), from the
language record plus the chosen font scheme. This works either through
per-script scheme slots or through resolution of `language.fontScheme`. The
schema, catalogs, docs and tests cover every script class in FF-07. It is
backward compatible with existing documents.

**FF-19 Renderer script fonts.** Previews of CJK, Arabic/Hebrew and Indic
decks render with the resolved script fonts, either bundled or supplied by the
caller as documented, honoring `lang` and RTL without `missing-glyph` failures.
It is covered by renderer tests. The 0.1 px gate is unchanged.

**FF-20 Ecosystem pins.** After each merged opf-pptx font fix, core
ecosystem-ci sibling pins advance to that merge and CI passes. The first bump
covers FF-01 (`7b34f557`); the pin was `fcc006a`. The item is `done` once the
pins include the FF-07 and FF-08 merges with CI green; intermediate bumps are
progress-log entries.

**FF-21 macOS render job.** A non-blocking macOS browser job in opf-render
reports the Linux-versus-macOS preview residual, tracking opf-render#24,
without changing the 0.1 px gate.

**FF-22 Charts.** Core `spec/catalogs/chart-types` (and `spec/charts`) and
pptx-gallery `data/charts.json` (76 objects today) are reduced to the chart
types the Aspose.Slides `ChartType` documentation lists as supported, cited by
URL and access date. Every removed or renamed type is listed with its
replacement. `pnpm check:breaking` passes; a breaking removal is deprecated
(kept, marked deprecated, validator/lint warning) rather than deleted. The
Charts section of [gallery-support.md](gallery-support.md) is then replaced by
measured per-type rows.

**FF-23 Support table.** [gallery-support.md](gallery-support.md) covers all
14 dimensions with measured heads, the status legend taken from the audit
classifiers, a summary table and one section per dimension with the burndown
IDs that fix each gap. Both audits' scripts and `results.json` are committed
under `gallery-support/` with local paths scrubbed and no PPTX outputs or
logs. `support-status.json` has one record per measured value (793) and is
regenerated by `build-support-status.mjs`. The README re-run commands work from
a fresh workspace. Text and spec integrity checks pass.

Every fix item (FF-24 to FF-37, FF-39) proves its result on the fix heads, or
the merged heads, in the same or a follow-up PR. It re-runs the FF-23 presence
audits, reports the FF-38 parity before/after table, and updates
`gallery-support/support-status.json` and the affected rows of
[gallery-support.md](gallery-support.md).

**FF-24 Theme colors.** For each of the 14 color schemes and 4 themes, the
exported theme `clrScheme` equals the chosen scheme in all 12 slots (`dk1`,
`lt1`, `dk2`, `lt2`, `accent1` to `accent6`, `hlink`, `folHlink`), using a
documented mapping from OPF scheme roles. Fills, lines and text that resolve
from a scheme role are written as `a:schemeClr` for that slot, not
`a:srgbClr`; explicit literal colours stay literal. Preview and export still
agree slot for slot. Re-import maps the theme `clrScheme` back to the scheme:
the catalog id when it matches a record, otherwise inline colours. Audit
evidence: color-scheme and theme rows match 12/12 slots, with no "literal RGB"
reason and no re-import loss.

**FF-25 Backgrounds.** `geometric-pattern`, `abstract-shapes` and
`minimal-texture` map to three distinct OPF background values (a backward
compatible schema addition if needed). Pattern backgrounds export natively as
`a:pattFill` in `p:bg`, or, where no preset can represent the pattern, as a
documented image fill. Photo backgrounds export as `a:blipFill` in `p:bg` with
the image part. The gallery `photography` snippet includes an `assets` entry
for its image. Re-import returns the background type (pattern or image). Audit
evidence: backgrounds 6/6 `works`, 0 preview/export disagreements.

**FF-26 Image treatments.** `design.slideImage` exports as a native picture
(`p:pic`, or `a:blipFill` for the background position) with its image part.
The 15 gallery treatments map to distinct OPF values wherever OPF can express
them: position, fit or crop, crop rectangle, and shape masks such as ellipse
and rounded rectangle. Treatments OPF cannot express (for example duotone,
blur, device frame, cutout) are explicitly labeled unsupported on the gallery
item and in the support table instead of collapsing silently. Gallery snippets
include their image asset. Re-import keeps the image, and its crop or mask
where represented, or emits a specific diagnostic. Audit evidence: no
image-treatment row is `schema-only` or has "export adds no native picture";
every unsupported effect carries its label.

**FF-27 Headers and footers.** Slide number and date furniture export as
PowerPoint fields (`a:fld type="slidenum"`, and `type="datetime*"` matching the
chosen date format) inside OPF furniture shapes, not `p:hf`, so they renumber
and update in PowerPoint (confirmed in the FF-12 native sample). The three
slot collisions (`dated-footer`, `client-delivery-footer`,
`version-control-footer`) place date and slide number in separate slots. The
gallery snippet emits `hideOnTitleSlide` (slide-level furniture off),
slide-number formats, date formats and the legal line. Re-import keeps the
furniture without `invalid-furniture-provenance`. Audit evidence:
headers-footers 10/10 `works`, and `slide-number-only` and
`slide-number-progress` emit different OPF.

**FF-28 Narrative and audience parity.** Every gallery narrative and audience
id exists in the core catalogs, or the gallery is reduced to core ids with the
mapping recorded (for example `executive` to `executives`). The validator and
lint warn on an unknown audience id, as they already do for narratives.
Content blocks then resolve their narrative references. Audit evidence: 0
`gallery-only` narratives and audiences, and no content-block row with
`unresolved references: narrative:*`.

**FF-29 Layout parity and export fidelity.** The core catalog contains every
gallery canonical layout id (415 today, 30 in core), or the gallery is reduced
to core ids; the 70 legacy slugs are mapped to canonical ids or retired. The
110 layouts that change the preview also drive PPTX shape placement.
Re-import retains the layout id, or emits a specific diagnostic naming the
layout it could not recover; it never drops it silently (81 today). Audit
evidence: 0 `gallery-only` layouts, 0 preview/export disagreements, and no
"re-import drops layout id" reason without a layout-specific diagnostic.

**FF-30 Content-block text.** `market-opportunity` and `financial-snapshot`
show every metric string of their gallery content (1 and 4 strings are missing
today, for example "Revenue +22%") in the preview and as native text in the
export, without `text-overflow`. `quote-slide` keeps its `quote` payload kind
on re-import or emits a specific diagnostic. Audit evidence: no content-block
row reports missing expected strings or lost payload kinds.

**FF-31 Font provisioning (owner font policy).**
- A policy table in core lists every font family used by a catalog font
  scheme, theme or language. For each it records the license class and one of
  two routes:
  - *open*: the family is bundled by opf-render (package, version, hash,
    license notice);
  - *licensed*: the shipped open replacement used for rendering (for example
    Aptos or Calibri to Carlito), with its metric or visual compatibility tier.
- The table is machine-checked against the catalogs, so a new scheme font
  without a route fails CI.
- The preview renders every scheme with its bundled family or its shipped
  replacement, with no host fonts. Strict mode throws only for a family
  outside the table. Today 92 of 93 font schemes throw under the strict pack.
  Script coverage is shared with FF-19.
- The PPTX always references the real font name, never the replacement, and
  never embeds font programs. With any registry and substitution policy,
  `toPptx` writes the chosen families and only reports substitutions. Tests
  cover the 7 schemes that substitute today (`aptos`, `calibri`, `consolas`,
  `courier-new`, `georgia`, `tahoma`, `times-new-roman`) and the `minimal`
  theme.
- The default `aptos` scheme (FF-35) follows the same policy. The docs state
  that Aptos and Aptos Display are not openly licensed, which replacement
  renders them, and that the PPTX keeps the name `Aptos`.
- [Font fidelity](../../font-fidelity.md) documents the policy, strict-mode
  behaviour, and cloud/serverless guidance for export, preview and raster
  output with no system fonts.
- Audit evidence: "export w/ office registry" equals the chosen family for all
  93 font schemes. No font scheme is host-only. Open families no longer fail
  the registry probe.

**FF-32 Re-import.** `fromPptx` of an exporter-written deck recovers the color
scheme, font scheme, theme and language (from the theme `clrScheme` and
`fontScheme`, run `lang`, or an exporter-written custom property), or emits one
specific diagnostic per dropped field that names it. Authoring metadata the
exporter does not carry (narrative, tone, audience, organization, speaker)
produces a specific diagnostic instead of disappearing silently. Audit
evidence: audit B re-import rows list the retained keys or named diagnostics,
and no "dropped silently" reason remains.

**FF-33 Gallery snippet and editor parity.** For every dimension, the gallery
"OPF Config" snippet and `/editor?config=<dimension>:<slug>` emit the selected
value. Two slugs never produce the same document unless the support table
labels them equivalent. Today the editor path uses the generic builder for
headers/footers, image treatments and content blocks, and the snippets drop
header/footer options. A gallery test compares snippet and editor output per
slug. Audit evidence: no "identical OPF" or slug-agnostic editor reasons
remain.

**FF-34 Socials.** Either (a) socials render: handles format to the platform
URL and icon in preview and export, as the social-platform schema describes,
and any platform size or aspect ratio the gallery offers produces that slide
size; or (b) the docs and the social-platform schema description state that
socials are authoring-only, and the gallery labels them so. The decision is
recorded. Audit evidence: socials rows match the chosen option.

**FF-35 Shared default font scheme.** Owner decision (2026-09-23, option A):
one shared default, `aptos`, so preview equals export. Core pagination,
opf-render, opf-editor, opf-pptx and the FF-18 script-font resolver use the
same exported default font scheme when a document and its theme have none.
`spec/reference/engine-defaults.json` is reconciled: the Latin default is
`aptos` for PPTX, and the `google` target keeps `roboto` only for a future
Google exporter. `docs/design-resolution.md` is updated. Tests pin
preview/export parity for a custom theme without a font scheme. Font
availability and licensing for Aptos are handled by FF-31.

**FF-36 Gallery support badges.** Owner decision (2026-09-23). Each
pptx.gallery item shows its measured support status (works, partial,
preview-only, schema-only, authoring-only or gallery-only), read from a
versioned machine-readable file derived from
`gallery-support/support-status.json`. The mapping from audit statuses is
documented (`authoring-metadata` shows as authoring-only; `previewOnly` shows
as preview-only; `broken`, if ever measured, has a badge too). Badge text and
definitions link to [gallery-support.md](gallery-support.md). The file is
regenerated by re-running the FF-23 audit. Nothing is deployed in this
program.

**FF-37 First-class catalog.** pptx.gallery is an OPF catalog like the core
ones:
- Every catalog spec URL that documents resolve against (for example
  `https://www.pptx.gallery/tones`, and the per-kind sources named in the
  schemas) serves records that validate against the matching core schema.
- Core bundles a pinned snapshot of those records, recording the source commit
  and a hash. A drift check fails CI when the live or pinned gallery data and
  the core snapshot disagree, except for changes that are explicitly
  acknowledged.
- Gallery-only ids are either added to core or retired, with the mapping
  recorded (this overlaps FF-28 and FF-29).
- Nothing is deployed in this program. The URL checks run against a local
  build or a recorded fixture.

**FF-38 Parity audit and scoreboard.**
- A harness under `gallery-support/parity/` builds each gallery value's OPF
  Config document, charts included. It compares the traced preview with the
  exported PPTX element by element and classifies each value as `perfect`,
  `near` or `mismatch`.
- It uses ten checks: geometry within 0.02 pt (0.5 pt near), text and runs
  including script-slot fonts, fills and images, z-order, slide size, package
  typefaces, re-import, font resolution, theme, and shape mapping. They are
  defined in [gallery-support.md](gallery-support.md#parity-scoreboard).
- Scripts, run and build commands, `parity-results.json` and `PARITY.md` are
  committed with local paths scrubbed.
- `support-status.json` carries a per-item `parity` field (`status`,
  `failedChecks`, `nearChecks`, `topReasons`), with `parityOnly` for charts.
- The headline metric (perfect / total) is recorded in this tracker. The
  baseline is 0 of 900.
- `run.ps1 -Baseline` produces a before/after table for fix PRs.
- Running it in CI across operating systems belongs to FF-10.

**FF-39 Alignment parity.** Preview and PPTX agree on paragraph alignment and
text-line anchors for every gallery value:
- no "alignment ctr (preview) vs l (pptx)" (504 values at baseline) and no
  reverse mismatches (36 layouts);
- no text-line anchor-x delta beyond the 0.02 pt geometry tolerance;
- table frames equal the composed box.

The fix is in the layer that diverges (exporter paragraph alignment or the
preview anchor), without relaxing a tolerance. Audit evidence: the FF-38
before/after table shows no alignment or anchor-x reasons, and the geometry
and text pass counts rise accordingly.

## Progress log

Append one dated line per state change. Newest last.

- 2026-09-22: FF-R0 done. Mixed-size edit/save/reopen passed (opf#114). First
  Carlito-only embed attempt failed closed on `Aptos` (opf#115).
- 2026-09-23: Program opened. FF-01 merged (opf-pptx#57). FF-02, FF-03 and
  FF-06 started by parallel agents. FF-00 in review. FF-16 added after the
  tracker review; FF-08/FF-09 cycle removed.
- 2026-09-23: FF-17, FF-18, FF-20 and FF-21 started by parallel agents.
- 2026-09-23: FF-06 brief and Aptos research brief committed. FF-17 to FF-21
  added and FF-07 to FF-12 criteria sharpened from the FF-06 findings.
- 2026-09-23: FF-00 done (core tracker plus sibling AGENTS.md merged). FF-06 done
  with the tracker. FF-21 done (macOS job confirms opf-render#24: Linux misses
  0.1 px on 5 of 5 rows, macOS on 0 of 5). FF-20 first bump merged; the sibling
  repos' own CI pins still lag. FF-02, FF-03 and FF-18 in review.
- 2026-09-23: FF-23 in review: measured pptx.gallery support by dimension
  ([gallery-support.md](gallery-support.md)); 793 values across 13 dimensions,
  7 `works`. FF-22 (charts reduced to Aspose.Slides types) in progress. FF-24
  to FF-34 added for the measured gaps. Owner decisions: one shared default
  font scheme `aptos` (FF-35, in progress) and measured support badges on
  pptx.gallery (FF-36, in progress). FF-04 partial native result: at open,
  `Presentation.Fonts` lists a nameless font and `Aptos`, and filling theme
  `ea`/`cs` did not change it; FF-04 stays open until the second condition and
  the evidence bundle land.
- 2026-09-23: Owner set the program goal to perfect support for every
  pptx.gallery configuration; the README goal and definition of done are
  replaced. FF-37 (first-class catalog) and FF-38 (parity audit and
  scoreboard) added, both in progress. FF-26 (engine side), FF-29 and FF-31
  (owner font policy) are in progress. Headline metric: parity-passing items
  over all items; presence baseline 7/793, parity baseline to be set by FF-38.
- 2026-09-23: FF-38 done with opf#122: the parity harness and baseline are
  committed under `gallery-support/parity/`. 0 of 900 values are perfect.
  Checks passed: slideSize 900, mapping 890, zOrder 880, fills 842, geometry
  378, text 273, fontResolution 5, typefaces 0, theme 0, re-import 0. Five
  universal blockers are mapped to FF-32, FF-08, FF-24, FF-31 and FF-39.
  FF-39 (alignment parity) is in progress. `support-status.json` gains a
  per-item `parity` field and section anchors.
