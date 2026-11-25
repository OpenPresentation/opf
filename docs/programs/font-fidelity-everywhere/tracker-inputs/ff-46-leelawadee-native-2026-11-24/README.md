# FF-46 native run: Leelawadee UI (opf#1399, 2026-11-24)

The deck has two slides, Thai (`th-TH`) and Khmer (`km-KH`). Both use the default fonts. It was exported by the assembled 0.36.0 branch (`codex/036-fixes` at `97aac6defd5c499bf85c38586b67ff3a5e93e8e6`). The exported theme names Leelawadee UI in its major and minor complex-script slots, and Aptos Display and Aptos for latin.

**The run.**
- **Archive:** sha256 `0f2e79b773a5c2ffef541e99977a9deb6559393ced44d46a7990fdf71929f09b`.
- **Worker:** the repository's read-only worker, `packages/pptx/test/native-font-inventory.ps1 -ControlDeck`, on PowerPoint 16.0, Windows, as one process. It opened one copy read-only, read `Presentation.Fonts`, the theme font slots and the text fonts of both slides, and closed it. Nothing was saved.
- **Audit:** `packages/pptx/test/native-font-inventory-audit.mjs` passed.
- **Conversion:** the report was converted into this `compare.json`, the FF-46 deck record that `scripts/build-font-tracker.mjs` reads. `Presentation.Fonts` must list the families the slides' runs name (Aptos and Aptos Display) and nothing outside the theme's names.

**Read back.**
- Theme major and minor `complexScript`: Leelawadee UI.
- Theme latin: Aptos Display and Aptos.
- Font2 `NameComplexScript`: Leelawadee UI on every text shape and run of both slides. The `fonts` check is 6 of 6.
- `Presentation.Fonts`: Aptos Display and Aptos only.

**The verdict: pass.** Leelawadee UI is in `expected` and, as read back, in `missingFromNative`. The evidence that the font is used is the theme's two complex-script slots and `NameComplexScript` on all six text shapes.

The first conversion required this theme-slot font in `Presentation.Fonts`, which the committed runs never did. PowerPoint does not list a theme-slot script font there, and those runs record such a font in `expected` and `missingFromNative` with the check passing:
- `rr-05-cjk-native-20261002`: lang-hi, lang-th, lang-ko, lang-ja, lang-zh-hans, lang-zh-hant and size-4x3-japanese;
- `rr-05b-native-20261002`: lang-ar, rtl-structures-ar, lang-he and rtl-structures-he;
- `ff-46-native-0.12-20261002`: scripts-27-latin-deck-slots.

Only the rule changed. The read-back itself was not changed.

**Pictures.** PowerPoint breaks each line of both slides at the same word as OPF's preview.
