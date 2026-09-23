# Why does Presentation.Fonts report "Aptos"? Research brief (2026-09-22)

Scope: read-only research. No Office or COM was started. **F** = sourced or locally observed fact. **I** = inference or hypothesis.

## Local facts (fixture-carlito-02, from opf origin/main)
- F1. In `source.pptx`, both slide runs carry explicit `<a:latin/ea/cs typeface="Carlito">`. The two `endParaRPr` carry no typeface. The master, notes master and `defaultTextStyle` use `+mn-lt/+mn-ea/+mn-cs` (and `+mj-*`). The theme's major and minor `ea` and `cs` are `""`. The notes master shares `theme1.xml`. There is no handout master. `lang="en-US"` is used everywhere.
- F2. The edits set `TextRange2.Text` to ASCII strings with no paragraph breaks. Only `Font2.Name/Size/Bold/Italic` are set afterwards. `NameFarEast` and `NameComplexScript` are never set (opf-pptx `test/native-font-embed.ps1`, `Set-FontEmbedRange`).
- F3. Office's installed font schemes use `<a:ea typeface=""/><a:cs typeface=""/>` in all 25 files under `C:\Program Files\Microsoft Office\root\Document Themes 16\Theme Fonts`, including "Office 2013 - 2022". The vendored PptxGenJS theme does the same. **An empty ea/cs slot is PowerPoint's own convention, not an anomaly.** No Aptos scheme file ships on disk (it is built in). There is no user `blank.potx` in `%APPDATA%\Microsoft\Templates`. Aptos, Aptos Display and Aptos Narrow exist only in `FontCache\4\CloudFonts`.

## (1) Presentation.Fonts semantics
- F. The docs say the collection represents "all fonts used in the specified presentation". They do not say which slots or parts are included. `Embedded` means the font is embedded, and `Embeddable` means it *can* be embedded [L1-L4].
- F. Bullet fonts count as "used" and Replace Fonts does not change them [Q2]. East Asian fonts that come only from the theme did not appear in the used-font list in one report, but fonts assigned directly to runs did [Q1].
- I. So the collection reflects resolved per-run and per-style font references, not theme XML text. For Aptos, `Embeddable=-1` is consistent with Office resolving it to the cached cloud font [S3].

## (2) Font2.Name vs the per-script names
- F. `Font2` exposes separate `NameAscii` (Latin 0-127), `NameOther` (>127), `NameFarEast` and `NameComplexScript` [L5-L9]. The docs do not say which of these slots `Name` writes.
- F. From the PowerPoint UI, the font drop-down writes the same typeface to `<a:latin>` and `<a:cs>` and leaves `<a:ea>` unchanged [P1].
- I. If `Font2.Name` behaves like the UI, `ea` stays whatever it was after `.Text`. If `.Text` rebuilt the run from `endParaRPr`/list-style properties rather than the old run, `ea` becomes `+mn-ea`, which resolves to `""`. **Not verified.**

## (3) Defaults
- F. Since 2023 Aptos is the default font across Office. The previous theme is now "Office Theme 2013-2022" [S1, N1]. Cloud fonts download on demand [S3].
- F. ECMA-376 `ea` means "an East Asian font be used for a specific run". MS-OI29500 says Office uses the typeface "when available" and substitutes otherwise [E1, M1]. **No source states what PowerPoint does with an empty theme `ea`/`cs` or an unresolved `+mn-ea`.**
- F (secondary source). Theme `ea`/`cs` slots stay "inactive until text is formatted as a relevant language" [B2].
- I. For an empty slot, PowerPoint plausibly falls back to its built-in default theme's minor font, which is Aptos in current builds. This is H1 below.

## (4) Empty vs explicit ea/cs
- F. Empty slots are acceptable "if you have a predictable user base" [B1], and PowerPoint's own schemes write them empty (F3). Microsoft Q&A advice fills `<a:ea>` when East Asian text matters [Q1].
- I. Nothing says an explicit value is required. Filling the slots is a diagnostic lever, not a correctness fix.

## Hypotheses
- **H1.** Text created by `.Text` inherits the theme ea/cs (`""`). PowerPoint resolves that to its default font (Aptos) and lists it.
- **H2.** Fonts are listed at load time, before any edit, from an empty slot in `endParaRPr`, the master or notes styles, or a synthesized handout master or default.
- **H3.** Something tied to Carlito or font registration, or something else in native resolution.

## (5) Experiments (each needs an owned copy, a fresh output directory, `WithWindow=msoFalse`, and a Fonts snapshot that records name, Embedded and Embeddable)
1. **E0: pre-edit baseline.** Open the unedited source, enumerate Fonts, close without saving. Aptos present means H2 or H3; absent means an edit introduced it.
2. **E1: stepwise snapshots.** Snapshot after title `.Text`, after title `Font2.Name`, after Size/Bold/Italic, and after the body edits. The first snapshot that shows Aptos names the operation.
3. **E2: slot readback.** Before and after each edit, read `Font2.Name`, `NameAscii`, `NameOther`, `NameFarEast` and `NameComplexScript` for the title, the body and each span. These are only property gets. A read of `NameFarEast` or `NameComplexScript` returning `""`, `+mn-ea` or `Aptos` after `.Text` supports H1.
4. **E3: no-.Text control.** Apply only the Font2 sets, so the original explicit-Carlito runs survive. No Aptos here means `.Text` is implicated.
5. **E4: explicit-slot control (harness, COM).** After `.Text`, also set `NameFarEast` and `NameComplexScript` to "Carlito". Aptos disappearing supports H1.
6. **E5: theme-slot fixture variant.** Byte-patch `theme1.xml` so the major and minor `<a:ea>`/`<a:cs>` are `typeface="Carlito"` (4 attributes), and optionally add explicit latin/ea/cs to both `endParaRPr`. Run E0 and E1 on it. If Aptos is gone both before and after the edits, H1 holds via the theme path.
7. **E6: Calibri control.** Use the same fixture with Calibri as the latin font and empty ea/cs. If Aptos still appears, the effect is default-slot behaviour and not Carlito-specific, which rules out H3.
8. (Optional, needs separate approval.) SaveCopyAs the edited copy without embedding into a fresh directory, then diff the `rPr` offline to see where Aptos, `+mn-ea` or empty slots were written.

## Proposed fixture change if H1 holds, and OPF expressibility
- **Theme ea/cs = Carlito.** This is **not OPF-expressible**. `design.fontScheme` has only `major`/`minor` (latin) values. `languageFamily` exists in the schema but opf-pptx never reads it (grep of origin/main). The theme comes from the vendored PptxGenJS template. The change would be a declared harness transform, like the existing `master-bullet-font-carlito`.
- **Explicit ea/cs on runs.** This is already emitted for OPF runs: PptxGenJS `fontFace` writes latin, ea and cs. It is lost if `.Text` rebuilds the runs. `endParaRPr` typefaces are not OPF-expressible.
- **Harness-side alternative.** Set `NameFarEast` and `NameComplexScript` explicitly in `Set-FontEmbedRange`. This changes the harness, not the fixture.

## Sources
- [L1] https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.fonts
- [L2] https://learn.microsoft.com/en-us/office/vba/api/powerpoint.fonts
- [L3] https://learn.microsoft.com/en-us/office/vba/api/powerpoint.font.embeddable
- [L4] https://learn.microsoft.com/en-us/office/vba/api/powerpoint.font.embedded
- [L5] https://learn.microsoft.com/en-us/office/vba/api/office.font2.name
- [L6] https://learn.microsoft.com/en-us/office/vba/api/office.font2.nameascii
- [L7] https://learn.microsoft.com/en-us/office/vba/api/office.font2.nameother
- [L8] https://learn.microsoft.com/en-us/office/vba/api/office.font2.namefareast
- [L9] https://learn.microsoft.com/en-us/office/vba/api/office.font2.namecomplexscript
- [P1] https://python-pptx.readthedocs.io/en/latest/dev/analysis/txt-font-typeface.html
- [S1] https://support.microsoft.com/en-us/office/new-office-theme-e7bbfe02-d1fb-4c4d-b3b7-6a47f0cefd3f
- [S3] https://support.microsoft.com/en-us/office/cloud-fonts-in-office-f7b009fe-037f-45ed-a556-b5fe6ede6adb
- [N1] https://www.cnn.com/2024/02/22/us/microsoft-default-font-aptos-calibri-cec
- [E1] https://c-rex.net/samples/ooxml/e1/Part4/OOXML_P4_DOCX_ea_topic_ID0EPM1KB.html
- [M1] https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/e6784cb7-1547-4ee5-addc-730cac8b4d00
- [B1] https://www.brandwares.com/bestpractices/2015/10/xml-hacking-font-themes/
- [B2] https://www.brandwares.com/bestpractices/2017/02/xml-hacking-font-themes-complete/
- [Q1] https://learn.microsoft.com/en-us/answers/questions/5037321/problem-for-the-list-of-used-fonts
- [Q2] https://learn.microsoft.com/en-us/answers/questions/5324921/replaced-fonts-but-they-are-still-shown-as-used-wh
