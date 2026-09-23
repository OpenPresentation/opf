# Font fidelity everywhere: burndown

Goal and resume protocol: [README.md](README.md). Research:
[font-flow map (FF-06)](font-flow-map.md), [Aptos origin brief](aptos-origin-brief.md).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged after
independent review and green CI, evidence linked), `blocked` (reason in notes).
Every item's criteria must all hold before it is `done`. Dates are UTC.

## Summary

| Status | Count |
| --- | --- |
| done | 5 |
| review / in-progress | 5 |
| todo | 13 |

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
It is required on core PRs that touch the matrix or sibling pins.

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
