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
| done | 18 |
| review / in-progress | 16 |
| todo | 10 |

**Headline progress: 4 of 900 gallery values perfect by parity** (FF-38 on
current mains, 2026-09-23: opf `a74f3f6`, opf-render `bc436f3`, opf-pptx
`9092954`, pptx-gallery `f17e9ae`; the previous run at opf `c278532` /
opf-pptx `5b657c9` and the first baseline at `53be042` / `cf0bc0c` were
0 of 900). The 900 values are the 793 presence items plus 76 charts and 31
`withAssets` variants. The FF-23 presence audits (re-run at opf `33d636d`
with the FF-36 audit probes) find 352 of 793 `works` (baseline 7); read the
[measurement notes](gallery-support.md#measurement-notes-2026-09-23-re-run)
first. See the
[scoreboard](gallery-support.md#parity-scoreboard) and its
[universal blockers](gallery-support.md#universal-blockers).

## Items

| ID | Item | Repo | Depends on | Status | Evidence / PR |
| --- | --- | --- | --- | --- | --- |
| FF-00 | Program tracker and agent entrypoints | all | none | done | [opf#116](https://github.com/OpenPresentation/opf/pull/116) `642f37af`; [opf-pptx#60](https://github.com/OpenPresentation/opf-pptx/pull/60), [opf-render#31](https://github.com/OpenPresentation/opf-render/pull/31), [opf-editor#29](https://github.com/OpenPresentation/opf-editor/pull/29) |
| FF-01 | Exporter master bullets follow the theme body font | opf-pptx | none | done | [opf-pptx#57](https://github.com/OpenPresentation/opf-pptx/pull/57), `7b34f557` |
| FF-02 | Embed harness records pre-edit, post-text and post-edit font observations | opf-pptx | none | done | [opf-pptx#58](https://github.com/OpenPresentation/opf-pptx/pull/58) `b6eb3bfd`; hardening [opf-pptx#62](https://github.com/OpenPresentation/opf-pptx/pull/62) `83a41b9a` |
| FF-03 | Read-only native font inventory worker | opf-pptx | none | done | [opf-pptx#59](https://github.com/OpenPresentation/opf-pptx/pull/59) `ef8a1583` |
| FF-04 | Native inventory of the unedited fixture, with and without temporary fonts | opf-pptx / opf | FF-03 | todo |  |
| FF-05 | Aptos root cause determined | opf | FF-02, FF-04 | todo | [brief](aptos-origin-brief.md) |
| FF-06 | Font-flow map across all 14 dimensions and environments | opf | none | done | [font-flow-map.md](font-flow-map.md), [opf#116](https://github.com/OpenPresentation/opf/pull/116) |
| FF-07 | Exporter writes chosen fonts into theme and run East Asian/complex-script slots, with `lang`/RTL | opf-pptx | FF-05, FF-06, FF-18 | review | merged: [opf-pptx#70](https://github.com/OpenPresentation/opf-pptx/pull/70) `0e886f30`, [opf#134](https://github.com/OpenPresentation/opf/pull/134) `9695bf37`, [opf#135](https://github.com/OpenPresentation/opf/pull/135) `3512af0b`; pending FF-05 native root-cause evidence (criteria are subject to FF-05) |
| FF-08 | Exporter leaks no hard-coded or default font in any part | opf-pptx | FF-05, FF-06, FF-17 | review | merged: [opf-pptx#69](https://github.com/OpenPresentation/opf-pptx/pull/69) `405963ce`; pending FF-05 native root-cause evidence (empty values must be allowed by FF-05) |
| FF-09 | Offline pairwise matrix across the 14 gallery dimensions | opf (ecosystem) | FF-07, FF-08, FF-19, FF-20 | todo |  |
| FF-10 | Matrix in CI on ubuntu, windows, macos via a packed TypeScript consumer | opf | FF-09 | todo |  |
| FF-11 | Export determinism independent of host fonts, OS, locale and timezone | opf-pptx / opf | FF-06 | todo |  |
| FF-12 | Native PowerPoint sample of the matrix, including CJK and RTL | opf-pptx / opf | FF-03, FF-07, FF-09, FF-18 | todo |  |
| FF-13 | Font-embed attempt from merged main, audited | opf-pptx / opf | FF-02, FF-07, FF-08 | todo |  |
| FF-14 | Evidence bundles, compatibility matrix and handoff merged | opf | FF-10, FF-11, FF-12, FF-13, FF-16, FF-19 | todo |  |
| FF-15 | Release-readiness note for the release owner (no publishing) | opf | FF-14 | todo |  |
| FF-16 | Editor switch operations for every dimension patch, undo and refresh the preview | opf-editor | FF-06, FF-17 | todo |  |
| FF-17 | Code-font default follows the scheme; gallery apply keeps roles (shared default delivered by FF-35) | opf, opf-editor, opf-pptx | FF-06 | done | [opf#120](https://github.com/OpenPresentation/opf/pull/120) `53be0427`, [opf-pptx#61](https://github.com/OpenPresentation/opf-pptx/pull/61) `cf0bc0cc`, [opf-editor#30](https://github.com/OpenPresentation/opf-editor/pull/30) `f75372f2` |
| FF-18 | Language/script model: per-script fonts resolvable from language and font scheme | opf | FF-06 | done | [opf#118](https://github.com/OpenPresentation/opf/pull/118) `d03a583c` |
| FF-19 | Renderer script fonts (CJK, Arabic, Indic), `lang` and RTL in previews | opf-render | FF-18 | done | [opf-render#41](https://github.com/OpenPresentation/opf-render/pull/41) `f0cf1a81` |
| FF-20 | Bump ecosystem-ci sibling pins after each opf-pptx font fix | opf | FF-07, FF-08 | done | first bump [opf#117](https://github.com/OpenPresentation/opf/pull/117) `7b4589b6`; pins past FF-07/FF-08/FF-31 [opf#136](https://github.com/OpenPresentation/opf/pull/136) `17da7ac3` |
| FF-21 | Non-blocking macOS browser job tracking opf-render#24 | opf-render | none | done | [opf-render#32](https://github.com/OpenPresentation/opf-render/pull/32) `df27685c` |
| FF-22 | Charts reduced to Aspose.Slides-supported chart types (core catalog and pptx.gallery; deprecate if breaking) | opf, pptx-gallery | none | review | core merged: [opf#121](https://github.com/OpenPresentation/opf/pull/121) `13ab00bb`, [aspose-chart-types.md](aspose-chart-types.md); gallery half [pptx-gallery#40](https://github.com/Data-Advantage/pptx-gallery/pull/40) open |
| FF-22b | Native `chartex` export and full renderer coverage for the kept chart types | opf-pptx, opf-render | FF-22 | review | [opf-pptx#76](https://github.com/OpenPresentation/opf-pptx/pull/76), [opf-render#42](https://github.com/OpenPresentation/opf-render/pull/42) open |
| FF-23 | Measured pptx.gallery support table by dimension and reproducible audit | opf | none | done | [opf#122](https://github.com/OpenPresentation/opf/pull/122) `e18df26b`, [gallery-support.md](gallery-support.md) |
| FF-24 | Color schemes export as theme colors and re-import | opf-pptx | none | done | [opf-pptx#67](https://github.com/OpenPresentation/opf-pptx/pull/67) `5b657c9b` |
| FF-24b | Follow-up to FF-24 (remaining theme-colour items from the opf-pptx#67 review) | opf-pptx | FF-24 | review | [opf-pptx#77](https://github.com/OpenPresentation/opf-pptx/pull/77) open |
| FF-25 | Pattern and photo backgrounds export natively and stay distinct | opf, opf-pptx, opf-render, pptx-gallery | none | review | engine halves merged: [opf-pptx#66](https://github.com/OpenPresentation/opf-pptx/pull/66) `2d206b3a`, [opf-render#35](https://github.com/OpenPresentation/opf-render/pull/35) `527f46d1`, [opf#127](https://github.com/OpenPresentation/opf/pull/127) `1e4cc880`, [opf-render#45](https://github.com/OpenPresentation/opf-render/pull/45) `d7d0b686`; gallery half [pptx-gallery#43](https://github.com/Data-Advantage/pptx-gallery/pull/43) open (blocked on release) |
| FF-26 | Image treatments export as native pictures with distinct values | opf, opf-render, opf-pptx, pptx-gallery | none | review | engine PRs merged: [opf#126](https://github.com/OpenPresentation/opf/pull/126) `57679388`, [opf#129](https://github.com/OpenPresentation/opf/pull/129) `bb72349f`, [opf-render#36](https://github.com/OpenPresentation/opf-render/pull/36) `37572f50`, [opf-render#38](https://github.com/OpenPresentation/opf-render/pull/38) `410e5145`, [opf-pptx#68](https://github.com/OpenPresentation/opf-pptx/pull/68) `8e315610`, [opf-pptx#73](https://github.com/OpenPresentation/opf-pptx/pull/73) `29e35ac5`; gallery snippets (asset, distinct treatments) in [pptx-gallery#44](https://github.com/Data-Advantage/pptx-gallery/pull/44) and [pptx-gallery#45](https://github.com/Data-Advantage/pptx-gallery/pull/45) open; audit A still 15/15 `partial` |
| FF-27 | Headers/footers as OPF furniture with PowerPoint slide-number and date fields | opf-pptx, pptx-gallery | none | review | engine PRs merged: [opf#130](https://github.com/OpenPresentation/opf/pull/130) `f2dcdbd4`, [opf-render#39](https://github.com/OpenPresentation/opf-render/pull/39) `5f6bc7e8`, [opf-pptx#74](https://github.com/OpenPresentation/opf-pptx/pull/74) `23e2dfc2`; gallery snippet options in [pptx-gallery#45](https://github.com/Data-Advantage/pptx-gallery/pull/45) open; audit A headers-footers 1/10 `works` |
| FF-28 | Narrative and audience catalog parity | opf, pptx-gallery | none | done | [opf#123](https://github.com/OpenPresentation/opf/pull/123) `c2785324` (content blocks 5 to 29 `works` by audit A) |
| FF-29 | Layout catalog parity and export fidelity | opf, opf-pptx, pptx-gallery | none | review | [opf#132](https://github.com/OpenPresentation/opf/pull/132), [opf-render#43](https://github.com/OpenPresentation/opf-render/pull/43), [opf-pptx#78](https://github.com/OpenPresentation/opf-pptx/pull/78), [opf-pptx#79](https://github.com/OpenPresentation/opf-pptx/pull/79) open |
| FF-30 | Content blocks keep metric text in preview and export | opf, opf-render, opf-pptx, pptx-gallery | none | review | [pptx-gallery#44](https://github.com/Data-Advantage/pptx-gallery/pull/44) (with #45 and a modified harness: blocks 31/32, image treatments 6/15; gallery CI blocked by Actions billing) |
| FF-31 | Font provisioning per the owner font policy: licensed fonts never bundled or embedded (shipped open replacements render, PPTX keeps the real name); open fonts bundled, embeddable only via FF-13; policy table in core | opf, opf-render, opf-pptx | FF-35 | review | [opf-pptx#63](https://github.com/OpenPresentation/opf-pptx/pull/63) `f2a7e14e` merged; [opf#133](https://github.com/OpenPresentation/opf/pull/133), [opf-render#44](https://github.com/OpenPresentation/opf-render/pull/44) open |
| FF-32 | Re-import retains design or emits specific diagnostics | opf-pptx | FF-07, FF-24 | done | [opf-pptx#71](https://github.com/OpenPresentation/opf-pptx/pull/71) `810ee419` |
| FF-33 | Gallery snippet and "open in editor" emit every dimension's selected value | pptx-gallery | FF-26, FF-27 | review | [pptx-gallery#45](https://github.com/Data-Advantage/pptx-gallery/pull/45) (gallery CI blocked by Actions billing) |
| FF-34 | Socials produce the platform size/aspect ratio or are documented as authoring-only | opf, opf-pptx, opf-render, pptx-gallery | none | review | engine PRs merged: [opf#125](https://github.com/OpenPresentation/opf/pull/125) `a74f3f62`, [opf-render#34](https://github.com/OpenPresentation/opf-render/pull/34) `bc436f3b`, [opf-pptx#65](https://github.com/OpenPresentation/opf-pptx/pull/65) `90929546`; gallery half [pptx-gallery#42](https://github.com/Data-Advantage/pptx-gallery/pull/42) open; audit B socials 10/10 `works` (re-import keeps socials; no handle rendered by the pre-program snippet) |
| FF-35 | Shared default font scheme `aptos` across every engine | opf, opf-render, opf-editor, opf-pptx | FF-17 | done | [opf#124](https://github.com/OpenPresentation/opf/pull/124) `3ba21ff4`, [opf-render#33](https://github.com/OpenPresentation/opf-render/pull/33) `47d19b25`, [opf-editor#31](https://github.com/OpenPresentation/opf-editor/pull/31) `4e47bf95`, [opf-pptx#64](https://github.com/OpenPresentation/opf-pptx/pull/64) `e1627898` |
| FF-35b | Follow-up: unknown font-scheme ids fall back to `aptos`, not a Roboto literal | engines with the literal | FF-35 | done | [opf#131](https://github.com/OpenPresentation/opf/pull/131) `27d0ac14`, [opf-render#40](https://github.com/OpenPresentation/opf-render/pull/40) `0fa35b63`, [opf-pptx#75](https://github.com/OpenPresentation/opf-pptx/pull/75) `c606780f`, [opf-editor#32](https://github.com/OpenPresentation/opf-editor/pull/32) `214ae695` |
| FF-36 | pptx.gallery items show their measured support status | pptx-gallery, opf | FF-23 | review | [pptx-gallery#41](https://github.com/Data-Advantage/pptx-gallery/pull/41) |
| FF-37 | pptx.gallery as a first-class OPF catalog: spec URLs serve schema-valid records; core bundles a pinned, drift-checked snapshot | opf, pptx-gallery | none | review | [opf#128](https://github.com/OpenPresentation/opf/pull/128), [pptx-gallery#46](https://github.com/Data-Advantage/pptx-gallery/pull/46) |
| FF-38 | Parity audit harness and progress scoreboard (defines "perfect") | opf | FF-23 | done | [opf#122](https://github.com/OpenPresentation/opf/pull/122) `e18df26b`, [PARITY.md](gallery-support/parity/PARITY.md) |
| FF-39 | Alignment parity: preview and PPTX text alignment and anchors agree | opf-pptx, opf-render | FF-38 | review | merged: [opf-render#37](https://github.com/OpenPresentation/opf-render/pull/37) `3f34448e`, [opf-pptx#72](https://github.com/OpenPresentation/opf-pptx/pull/72) `0330e6d0`; 39 values still report "alignment l (preview) vs ctr (pptx)" (reverse mismatches; see FF-29, [opf#132](https://github.com/OpenPresentation/opf/pull/132)) |
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

**FF-15 Release-readiness notes.** At each checkpoint, a merged note lists:
- which merged changes a release would ship;
- which consumer repos must follow;
- the parity-audit perfect count on the merged heads;
- what a live pptx.gallery would show once packages are published.

It is handed to the release owner, with nothing published. A perfect,
badge-accurate live pptx.gallery depends on that release. Inside this program,
the proof is the FF-38 parity audit on merged heads.

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
- The shared default scheme moved to FF-35, which is done: every engine
  falls back to `aptos`.

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

Fix items do not block on FF-23: the audits are their evidence tool, not a
prerequisite. Every fix item (FF-24 to FF-37, FF-39) proves its result on the
fix heads, or
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
- The PPTX always references the real font name, never the replacement.
  Licensed (proprietary) fonts are never bundled or embedded. Open fonts are
  bundled, and they may be embedded only through the explicit FF-13 embed
  path. With any registry and substitution policy,
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
same exported default font scheme (`DEFAULT_FONT_SCHEME`) when a document and
its theme have none.
`spec/reference/engine-defaults.json` is reconciled: the Latin default is
`aptos` for PPTX, and the `google` target keeps `roboto` only for a future
Google exporter. `docs/design-resolution.md` is updated. Tests pin
preview/export parity for a custom theme without a font scheme. Font
availability and licensing for Aptos are handled by FF-31.

**FF-22b Chart follow-up.** The kept Aspose.Slides chart types export
natively, including `chartex` types such as treemap, sunburst, histogram,
box-and-whisker, funnel and waterfall, and the renderer covers every kept type.
Parity rows for charts pass their text and typeface checks.

**FF-24b Theme-colour follow-up.** The items the opf-pptx#67 review deferred
are fixed, and the audit color-scheme and theme rows show no remaining
theme-colour reason.

**FF-35b Unknown-scheme fallback.** A font scheme id that no catalog resolves
falls back to the shared default `aptos` (or emits a diagnostic) in every
engine; no Roboto literal remains. Tests pin it per engine.

**FF-36 Gallery support badges.** Owner decision (2026-09-23). Each
pptx.gallery item shows its measured support status (works, partial,
preview-only, schema-only, authoring-only or gallery-only), read from a
versioned machine-readable file derived from
`gallery-support/support-status.json`. The mapping from audit statuses is
documented (`authoring-metadata` shows as authoring-only; `previewOnly` shows
as preview-only; `broken`, if ever measured, has a badge too). Badge text and
definitions link to [gallery-support.md](gallery-support.md). The file is
regenerated by re-running the FF-23 audit. Nothing is deployed in this
program. The badges shown on the live site become accurate only after a
release owner publishes the packages they describe (FF-15). Until then, the
in-program proof is the badge data together with the FF-38 parity audit on
merged heads.

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
- 2026-09-23: FF-38 in review with opf#122: the parity harness and baseline are
  committed under `gallery-support/parity/`. 0 of 900 values are perfect.
  Checks passed: slideSize 900, mapping 890, zOrder 880, fills 842, geometry
  378, text 273, fontResolution 5, typefaces 0, theme 0, re-import 0. Five
  universal blockers are mapped to FF-32, FF-08, FF-24, FF-31 and FF-39.
  FF-39 (alignment parity) is in progress. `support-status.json` gains a
  per-item `parity` field and section anchors.
- 2026-09-23: FF-18 done (opf#118). FF-35 done (opf#124, opf-render#33,
  opf-editor#31, opf-pptx#64): every engine falls back to `aptos`; the
  font-flow map G10 is resolved, and FF-35b tracks the remaining Roboto literal
  for unknown schemes. FF-28 in review (opf#123; audit A content blocks 5 to 29
  `works`). FF-30 and FF-33 in review (pptx-gallery#44 and #45; combined with
  a modified harness, content blocks 31/32 and image treatments 6/15); gallery
  CI is blocked by Actions billing.
- 2026-09-23: Tracker reconciled with open and merged PRs.
  - Done: FF-03 (opf-pptx#59), FF-17 (opf#120, opf-pptx#61, opf-editor#30),
    FF-24 (opf-pptx#67) and FF-28 (opf#123).
  - FF-22: core half merged (opf#121); gallery half open (pptx-gallery#40).
  - In review with linked PRs: FF-07, FF-08, FF-25, FF-26, FF-31, FF-32,
    FF-34, FF-36, FF-37, FF-38 and FF-39. FF-02 hardening is in opf-pptx#62.
  - FF-22b and FF-24b added as follow-ups.
  - Font-policy wording corrected: licensed fonts are never bundled or
    embedded, and open fonts may be embedded only through FF-13.
  - Release dependency recorded: a live, badge-accurate gallery needs a
    release. In-program proof is the parity audit on merged heads.
  - Counts: done 11, review 16, in progress
    5, todo 12 (44 rows).
- 2026-09-23: FF-38 harness fixes, recorded in opf#122:
  - Relationship targets resolve per OPC rules, so chart parts are found.
  - Single text lines are compared by rendered extent, so metric lines no
    longer fail geometry.
  - Re-run on current mains (opf `c278532`, opf-render `47d19b2`, opf-pptx
    `5b657c9`, pptx-gallery `f17e9ae`): still 0 of 900 perfect.
  - Checks passed: geometry 390, text 326, fills 734 (chart colours are now
    compared), theme 900 (FF-24), typefaces 0, re-import 0, font resolution 5.
  - The baseline report is kept under `gallery-support/parity/history/`.
- 2026-09-23: FF-39 renderer half merged (opf-render#37); the exporter half
  (opf-pptx#72) is still in review.
- 2026-09-23: Tracker reconciled after the FF-20, FF-25, FF-26, FF-27 and FF-34
  merges, with the parity and presence audits re-run on current mains (opf
  `a74f3f6`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`).
  - Done: FF-02, FF-19, FF-20, FF-23, FF-32, FF-35b and FF-38.
  - All PRs merged but kept in review: FF-07 and FF-08 (pending FF-05 native
    root-cause evidence) and FF-39 (39 values still report "alignment l
    (preview) vs ctr (pptx)").
  - Engine PRs merged, gallery half open: FF-25, FF-26, FF-27 and FF-34. FF-22b,
    FF-24b, FF-29 and FF-31 are in review.
  - Parity: 4 of 900 perfect (`calibri`, `courier-new`,
    `times-new-roman`, `roboto`). Checks passed: geometry 774 (was 390),
    text 759 (326), fills 674 (734), zOrder 784 (880), slideSize 900,
    typefaces 900 (0), re-import 899 (0), font resolution 5, theme 900,
    mapping 672 (890). Alignment is reduced but not cleared: 39 values
    still report "alignment l (preview) vs ctr (pptx)".
  - Fills 842 to 734 at opf#122 was the chart-colour comparison starting to
    run (108 values fail only on it), not a regression. The new mapping,
    z-order and fills failures follow the FF-26 slide image; the harness does
    not map `OPF slide image` names. See the
    [measurement notes](gallery-support.md#measurement-notes-2026-09-23-re-run).
  - Presence: 362 of 793 `works`. Socials 10/10 `works`, image treatments
    15/15 `partial`, headers/footers 1/10 `works`, backgrounds 2/6
    (`photography` with its asset `works`). Audit B marks all colour schemes
    and themes `broken` because its probes predate FF-24.
  - Counts: done 18, review 16, todo 10 (44 rows).
- 2026-09-23: Parity harness maps the FF-26 slide-image picture
  (`OPF slide image slides.N`) to the preview slide-image group and compares
  its visible image rect; no tolerance changed. Re-run at opf `7f88749`,
  opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery `f17e9ae`: still 4
  of 900 perfect; mapping 890 (was 672), geometry 880 (774), fills 766 (674),
  zOrder 880 (784), no value regressed. The 225 affected values matched the
  preview exactly (0 pt, identical bytes); the drop at opf#137 was a harness
  gap, not an export difference.
- 2026-09-23: Parity harness review follow-up. Geometry now fails any
  non-finite delta or box (for example a crop with `l+r` of 100000 or more),
  and every picture gets a crop-position check against the preview's
  `preserveAspectRatio` placement at the same 0.02 pt. Re-run at opf
  `b1753ef`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`: no check or class changed (4 of 900 perfect, geometry 880);
  19 cropped-image values now record a maximum delta of 0.001 to 0.004 pt
  (srcRect quantization).
- 2026-09-23: Parity harness never skips the crop-position check silently.
  Preview image sizes are read for PNG, GIF, JPEG (with EXIF orientation),
  WebP and SVG; a picture whose size is still unknown gets a near
  `picture crop unmeasured`, counted in `meta.cropCheck` (408 of 408 measured
  at opf `6263985`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`). The frame check honours `meet` alignment. No check, class or
  reported difference changed.
- 2026-09-23: FF-36 audit probes. Audit B resolves `a:schemeClr` through the
  exported theme and compares colours with the preview slide by slide; languages and every
  other audit B reason are derived from measured fields; audit A finds the
  `OPF slide image slides.N` picture and checks its frame and crop against
  the preview. Re-run at opf `33d636d`, opf-render `bc436f3`, opf-pptx
  `9092954`, pptx-gallery `f17e9ae`: colour schemes 14 and themes 4 move
  from `broken` to `partial`, languages 93 from `schema-only` to `partial`,
  socials 10 from `works` to `partial` (no handle rendered), image
  treatments with assets 2 `works` (was 0). Presence 352 of 793 `works`.
