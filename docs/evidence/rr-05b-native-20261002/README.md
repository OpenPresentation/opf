# RR-05b: right-to-left layout, follow-up native run (2026-10-02)

Supervisor-run native check (PowerPoint 365, Windows host) of the decks the RR-05 right-to-left layout fix produces
(opf#259 merged; opf-pptx#142 and opf-render#98 open when this was recorded). The first RR-05 native run of
2026-10-01 had found right-to-left decks unaligned and unmirrored and `v2.0` read `2.0v`; this run (`native-run3`)
passed: alignment, bullets, table rtl, chart mirroring and the `v2.0` bidi order. Decks, PNGs and the native
read-outs are not committed; the comparison output is.

- [compare.md](compare.md) and [compare.json](compare.json): output of `node compare.mjs --native native-run3 --deck
  lang-ar,lang-he,rtl-structures-ar,rtl-structures-he` (the comparison script of the scratch `rr-05b-native` set,
  re-run read-only on 2026-10-02 over the saved read-outs; the script never opens Office). Absolute paths in the
  output were replaced by relative descriptions.
- Result: 4 decks compared, 0 failing checks. Fonts, direction, charts, fields, notes, presentation fonts and theme
  slots pass on all four. Alignment (`algn`, 35, 33, 27 and 27 paragraphs) and bullets (the same counts) agree on
  every paragraph; geometry deltas are 0 pt; the table column order check (`a:tblPr rtl`, column 1 at the right)
  passes. Image scores are reported, not gated (1 close and 6 far on the `lang-*` decks, 1 close and 3 far on the
  `rtl-structures-*` decks).
- Supervisor finding: the `v2.0` bidi order passes (the Latin phrase reads left to right inside the Arabic text); this
  is a visual check and is not part of the comparison output.
- Not in this run: the FF-12 sample (CJK, `Presentation.Fonts` naming only the chosen families) and the `rtl-probes`
  and `lang-ar-typesetting` decks. RR-05 stays in review until the two engine PRs merge and FF-12 is recorded.

Burndown row: RR-05 ([burndown](../../programs/release-readiness/burndown.md)).
