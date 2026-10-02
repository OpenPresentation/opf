# RR-17: the Viet supplement fix, native re-run (2026-10-02)

This re-runs the one value that failed the [RR-42 native run](../rr-42-native-20261002/README.md): `languages/vietnamese-quoc-ngu`.

- **The RR-42 finding:** `Presentation.Fonts` listed Arial. The exported theme kept Office's `<a:font script="Viet" typeface="Times New Roman"/>` (major) and `typeface="Arial"` (minor), which PowerPoint applies to `vi-VN` runs.
- **The fix:** [opf-pptx#154](https://github.com/OpenPresentation/opf-pptx/pull/154), merged 2026-10-02 as `b990d5d` (branch `codex/rr-17-viet-supplement`; the decks were built at `7f51edc`). The deck language's own script entry now names the deck's font:
  - `Viet` takes the theme latin family;
  - `Uigh` takes the complex-script family when the deck selects one, else the latin family.

The supervisor ran this natively on the Windows host, in PowerPoint 16.0 build 20430, read-only through COM, with the RR-42 helpers (the fixed reader). An agent built the decks and ran the comparison. Neither step opened Office. The decks and raw read-outs are not committed. Internal evidence only.

## Decks

Both decks were built exactly like the RR-42 `languages` set:

- the gallery's own snippet, at pptx-gallery `34e6656`;
- the published opf 0.12.0 and opf-render 0.12.0;
- the export from the #154 branch at `7f51edc`. Re-exporting both decks at the branch's later head `29ac0a7` gives byte-identical files (same sha256), so the result holds for that head. The later commit only changes how the `Uigh` entry sits beside core's `Arab` supplement.

| Deck | Theme `Viet` entries (major / minor) | `Presentation.Fonts` (native) | Result |
| --- | --- | --- | --- |
| `viet-fix-02-vietnamese-quoc-ngu` (the fix) | Aptos Display / Aptos (was Times New Roman / Arial) | Aptos Display, Aptos | pass (RR-42: Arial listed as well) |
| `viet-fix-01-english-us` (the Latin control) | Times New Roman / Arial (vendored, unchanged) | Aptos Display, Aptos | pass |

Both decks pass every gated check: opened and complete, fonts, theme font slots, the 12 theme colour slots, `Presentation.Fonts`, shape count, geometry, background, fields, charts, notes and OPF tags.

## Files

- [values.json](values.json): the per-value verdicts. The [gallery tracker](../../programs/release-readiness/gallery-tracker.md) reads this file after the RR-42 one (`nativeRuns`), so this run supersedes the RR-42 verdict for these two values.
- [compare.md](compare.md) and [compare.json](compare.json): the comparison output.
- [decks.json](decks.json): the two decks, with sha256.

Burndown: RR-17 (FF-05 class) and RR-42 in the [release-readiness burndown](../../programs/release-readiness/burndown.md).
