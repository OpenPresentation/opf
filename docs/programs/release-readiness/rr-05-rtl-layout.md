# RR-05: right-to-left layout

Follow-up of the RR-05 native sample (FF-12). The supervisor's native run of 2026-10-01 on the published packages (core 0.11.4,
opf-render 0.11.9, opf-pptx 0.11.8) found that Arabic and Hebrew decks did not look right in PowerPoint and that the preview
disagreed with the export. This note records what was found, the decisions taken (supervisor decisions, vetoable), what changed
in each repository, the corpus impact, and the follow-up native set.

Status: implemented on `codex/rr-05-rtl-layout` in opf, opf-render and opf-pptx (PRs linked from the burndown). Geometry change:
the lockstep core floor rises at the next release train, nothing is released here. The follow-up native run is supervisor-run.

## Native findings (lang-ar, lang-he, 2026-10-01)

1. The export wrote every right-to-left paragraph as `rtl="1"` with `algn="l"`. PowerPoint then drew the text block against the **left**
   edge with each bullet at the **right** end of its line (native `Alignment` 1, `TextDirection` 2). The preview drew a left-to-right
   list. Preview and export disagreed, and neither is what an Arabic author expects. The evidence also fixes two PowerPoint semantics:
   `algn` is physical (`l` is the left edge even in an `rtl="1"` paragraph), and `marL` / `indent` act on the **start** side (the text
   was not indented at the left, the bullet hung at the right of it).
2. `v2.0` inside an Arabic run read `2.0V`, and `PowerPoint 365` read `365PowerPoint`. The runs are single `a:r` elements, so this is not
   run splitting by the exporter: the whole run is tagged `lang="ar-SA"`, and PowerPoint puts the digits of a run in a right-to-left
   language into the complex-script item (the digits drew in the Arabic face, the letters in Aptos) and orders the two items right to left.
3. Direction was decided per exported line. A wrapped Arabic paragraph is exported one shape per line, and a Latin-only last line
   (`Japanese.`) got `rtl="0"`, so it sat at the left and ordered its punctuation as left to right.
4. Regions, table columns and list bullets kept the left-to-right arrangement in right-to-left decks.

## Decisions

1. **Alignment is logical for right-to-left text.** The authored or default `left` means *start*, `right` means *end*, `center` is
   unchanged. It is decided per paragraph: an English paragraph (code, a quote) in an Arabic deck keeps the left edge. `item.alignment`
   stays the logical authored value; the physical edge is `placement.lines[i].alignment` and the exported `algn`. A deck that wants a
   paragraph at its end edge sets `right`. (Consequence for authors who used `contentAlignment: "right"` to approximate right-to-left:
   it now means the end edge, so Arabic text goes left. The bundled gallery example `arabic-digital-services-brief` sets
   `contentAlignment: "right"` on English text and is the only example affected; see Corpus impact.)
2. **Deck direction is deck level, from the language's script** (`resolveScriptFonts().direction`; `resolveSlideDirection`), not first
   strong detection and not per slide. A left-to-right deck holding Arabic phrases is not mirrored; a right-to-left deck is mirrored even
   for a slide of English. Paragraph direction inside a right-to-left deck stays first strong (`paragraphDirection`), computed **once per
   paragraph**: every wrapped line shares it (`TextFit.directions`, `paragraphDirectionAt`).
3. **The composition mirrors in a right-to-left deck.** Rationale: an Arabic or Hebrew author reads a slide from the right. PowerPoint's
   own UI does not mirror slides when a paragraph is set right to left (the paragraph flips its start edge and bullet side only; the
   structural switches are `a:tblPr rtl` for tables and a chart's reversed category axis), so OPF applies the rule to the whole
   composition from the language, once, in core, and both engines read the same geometry:
   - grid columns, the `left`/`center`/`right` region names, banded slide images, the cover logo and header/footer zones swap sides inside
     their container (weights and sizes unchanged; nested groups mirror inside their parent; zones keep their authored `zone` name);
   - list markers sit at the right (`marker.anchor: "end"`), the text column to their left, nested levels step in from the right;
   - tables lay columns out from the right and write `a:tblPr rtl="1"` with the columns in logical order (so re-import keeps the order);
   - timelines run right to left; metrics align by their own text direction;
   - column, line and area charts reverse their category axis (`c:catAx` orientation `maxMin`, which also puts the value axis at the
     right in PowerPoint and in the preview). Horizontal bar charts keep their vertical category axis, chartex charts are unchanged.
4. **PPTX mapping.** `rtl="1" algn="r" marL=m indent=-m` hangs the bullet at the right (marL is the start margin); every line of a wrapped
   paragraph carries the paragraph's `rtl` and `algn`; master, layout and notes-master default levels are `rtl="1" algn="r"`; notes
   paragraphs start at the right.
5. **Bidi runs.** Each Latin phrase (a Latin letter through the last Latin letter or digit, joined by spaces and word punctuation) of an
   `rtl="1"` paragraph is its own `<a:r lang="en-US">`; digits that touch Arabic words stay in the Arabic run. Import ignores the en-US
   phrase runs for `mixed-run-languages` and for the script-font notice, and treats `tblPr rtl` of a right-to-left deck as that deck's
   direction. This is the one decision that rests on an inference from the native evidence (the digits drew in the complex-script
   face): the probe deck confirms it or names the variant that reads correctly.

## What changed

| Repo | Change |
| --- | --- |
| opf (core) | `direction.ts` (`physicalAlignment`, `paragraphDirectionAt`); `composeSlide` direction (option or from the language), mirrored arrangement, slide image / logo / furniture zones; `TextFit.directions`, `ListEntryLayout.direction`, `TableCellLayout.direction`, `SlideComposition.direction`, `marker.anchor`; `placeTextLines(..., directions)`, `fitText(..., direction)` and `direction` options on rich text, list, table, quote, metric and timeline. 22 tests (`packages/javascript/test/rtl-layout.test.mjs`). |
| opf-render | per-line alignment and direction from core, list marker side, right-anchored cover logo, mirrored column/line/area charts, `layoutTable` direction. `test/rtl-layout.mjs`; raster golden moves for 6 slides. |
| opf-pptx | `algn`/`rtl` per line (PptxGenJS `rtlMode` on the first run), hanging bullets at the right, `tblPr rtl`, `catAxisOrientation maxMin`, en-US phrase runs, master/layout/notes defaults, logo anchor, import of logical table alignment and no language/direction noise on re-import. `test/rtl-layout.mjs`; `test/script-fonts.mjs` states logical alignment. |
| opf-editor | none (the editor composes through core and renders through opf-render; its suite passes unchanged). |

## Corpus impact

- Left-to-right output is **unchanged**: of the 44 decks of the native sample, 39 are byte-identical in PPTX and preview PNG to the same
  build of main without these branches (`deck-diff.json` of the follow-up set); the five right-to-left decks (`lang-ar`, `lang-he`,
  `lang-ar-typesetting`, `rtl-structures-ar`, `rtl-structures-he`) change.
- Core example corpus (126 examples, 805 slides): 2 examples have a right-to-left language (`arabic-digital-services-brief`, 6 slides, and
  `language-and-writing`, 1 slide). The opf-render raster golden changes for exactly the 6 slides of the first one (the second is
  pixel-identical: English text in one full-width box, so its left-to-right paragraphs stay at the left). That example is English text under `language: arabic` with `contentAlignment: right`, so
  its slides now mirror (header zones, cover logo, table columns, timeline) and its English paragraphs stay right-aligned as authored.
- pptx.gallery values (parity audit, `languages` dimension, 93 values, 5 right-to-left: arabic, hebrew, pashto, persian, urdu): 66 perfect /
  27 near / 0 mismatch before and after, geometry 93 of 93 within 0.02 pt on both, so the mirrored geometry agrees between preview and
  export. All other dimensions are left-to-right and untouched (the 44-deck byte identity above covers the sampled ones).

## Not mirrored (recorded, not hidden)

Horizontal bar charts and chartex charts keep their axes; code blocks stay left to right; a picture is symmetric inside its box;
slide-number and date `p:ph` placeholders follow the furniture zones that core already mirrors; right-to-left text inside a left-to-right
deck is not mirrored (deck-level rule).

## Native follow-up (supervisor-run)

The set is `rr-05b-native` (README there): the five right-to-left decks plus `rtl-probes.pptx` with four slides of hand-written
variants (bidi runs, bullet side and indent semantics, trailing space, table direction), and `compare.mjs` with one added reported
check (`tableOrderReported`). The evidence is merged under `docs/evidence/` by the supervisor; open questions the probes answer: whether
`en-US` phrase runs are enough (else which variant), whether `marL` is the start margin (`marR` variant), whether a trailing space moves a
right-aligned line, and whether `a:tblPr rtl="1"` puts column 1 at the right.
