# RR-05 / FF-12: CJK, Thai and Hindi native run (2026-10-02)

Supervisor-run native check (PowerPoint 365, Windows host) of the nine `rr-05b-native` decks that carry East Asian,
Thai and Devanagari font slots (`native-run4-cjk`). It is the CJK half of the FF-12 sample; the Arabic and Hebrew half
is [rr-05b-native-20261002](../rr-05b-native-20261002/README.md). Decks, PNGs and the raw native read-outs are not
committed; the comparison output is. Internal evidence only; nothing here is shown on pptx.gallery.

- [compare.md](compare.md) and [compare.json](compare.json): output of `node compare.mjs --native native-run4-cjk`
  (the comparison script of the scratch `rr-05b-native` set, run read-only over the saved read-outs; it never opens
  Office). Absolute paths in the output were replaced by relative descriptions.
- Decks (9): `lang-ja`, `lang-ja-meiryo`, `lang-zh-hans`, `lang-zh-hant`, `lang-ko`, `lang-th`, `lang-hi`,
  `size-4x3-japanese`, `scripts-inside-latin`.
- Result: all nine opened and read. Per-run fonts (`fonts`), theme slots (`themeSlots`), direction, alignment, bullets,
  charts, fields and notes pass on all nine decks (0 shapes missing). `presentationFonts` passes on eight; it fails on
  `lang-ja-meiryo` only, because PowerPoint adds an `Aptos` entry to `Presentation.Fonts` of a deck whose runs and theme
  name only Meiryo (the FF-05 behaviour; the deck's own fonts and theme slots pass). Image scores are reported, not
  gated.
- Families the decks name, read back natively (theme slots, with every run's latin, East Asian and complex-script name
  matching the exported file): Aptos and Aptos Display (every deck), Meiryo (`lang-ja`, `lang-ja-meiryo`,
  `size-4x3-japanese`), Microsoft YaHei (`lang-zh-hans`), Microsoft JhengHei (`lang-zh-hant`), Malgun Gothic
  (`lang-ko`), Angsana New (`lang-th`) and Mangal (`lang-hi`).

What this does and does not show: PowerPoint read the selected family names back from the saved runs and theme, so the
export keeps the chosen names and PowerPoint resolves them. It is not an acceptance of the preview face's look or
metrics against the real font.

Burndown rows: RR-05 ([burndown](../../programs/release-readiness/burndown.md)), FF-12 and FF-46 ([font burndown](../../programs/font-fidelity-everywhere/burndown.md)); per-family use in the [font tracker](../../programs/font-fidelity-everywhere/font-tracker.md).
