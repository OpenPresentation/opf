# Results

The minimal diagnostic archive is prepared. It is not a glyph fix or native acceptance.

- Original05: 100,906 bytes, SHA256 `36eed20266a3bd72cb540dae927e90f4a633bd2725eafd568c6e7e34cc881197`.
- Variant05: 100,889 bytes, SHA256 `4bde59d9a5e6e08e365d0a92c111081efea6efb9dfc9e7807ad83f7262166bf7`.
- Both contain one slide, exactly two text shapes and 147 ZIP parts. Only `ppt/slides/slide1.xml` content differs. Every other part AND its complete local compressed ZIP record are byte-identical (146 records); only central-directory offsets necessarily move.
- The whole slide XML is reversible by replacing the exact target run's one `a:cs typeface="Aptos"` with `a:cs typeface="Arabic Typesetting"`. All other XML bytes, including paragraph direction, numbering, text, all frames, all point sizes and font properties remain unchanged.

The target is the original unsplit `Bonjour 1` rich run. Its Latin slot already names Aptos. Only its CS slot changes from Arabic Typesetting to Aptos. `lang="ar-SA"`, `altLang="en-US"`, `sz="2775"`, other rPr properties and the exact concatenated UTF16 are retained. No run or shape is split. The original Arabic prefix `البند: `, Arabic heading, all theme parts and list numbering remain untouched. The French11 negative control is retained unchanged: SHA256 `fcfdce33558fc8a2fd7351198d64c84020d496d960b7c1aa6bf7028d9ad62990` (source SHA256 `63b092c6c0274414db0252cab65d5751a8d80fae27d4f7ea4a99ed1399d50303`).

## Why this is a justified discriminator

The actual installed db640 renderer script planner, byte-identical to the frozen source after newline normalization, returns `[{text:'Bonjour 1',family:'Aptos',own:true}]` under the original ar-SA source and style. `createScriptFonts.plan` returns an ASCII-only run in the supplied Latin family before script itemization. The Arabic prefix takes the existing Noto Naskh Arabic preview replacement at sizeAdjust 0.64; its requested core CS slot remains Arabic Typesetting. The probe loads no font files and does not prove physical glyph selection.

In contrast, `packages/pptx/src/script-fonts.js` `runLanguageFonts` patches a marked explicit-language rPr using the language's resolved slots. Its callback receives that rPr and language, not the run's text. The original explicit-ar ASCII rich run therefore carries `latin=Aptos` and `cs=Arabic Typesetting`. `writeSafeTypefaces` deliberately preserves a selected script face rather than rewriting it as a Latin fallback. Existing mixed-script itemization tests also keep ASCII neutrals with Arabic in mixed strings: this diagnostic does not change that rule or claim the whole mixed paragraph must use one face.

Thus naming Aptos in both slots of this all-ASCII run agrees with the observed preview planner's face choice for that run. Whether Office chooses the CS slot for the digit, and whether this change improves its painted size or order, is still unknown. The current physical glyph face is unknown. This preparation is not permission to change exporter policy for all scripts/languages.

## Pure controls and provenance

The actual final pure launch returned status 0, signal null and no error. Four controls refuse a missing target CS, a non-ASCII changed target, a duplicate target rich run and an unrelated changed theme part. The source module, core composition entry, gallery entry, six policy source files and both original source/archive pairs were hashed before and after. The frozen db640 source HEAD is exact before and after; no working or Git source was changed in that producer. The direct module hashes are individual entry identities, not a claim of independently requalified whole-package/runtime closure.

Earlier pure failures are preserved: live-HEAD pin mismatch (before module work), import-only ESM entry resolved incorrectly through CommonJS, and a wrong Arabic requested-font versus preview-replacement oracle. The raw policy inspection demonstrates why the last oracle was wrong; its correction does not change product behavior. All outputs and logs are deterministic/pure evidence, not performance statistics.

No new renderer images, PowerPoint output, font installation, public import/reassembly proof or native observation exists for this variant. Original glyph05/06/09/10 acceptance remains open. The earlier segmented05 word-order-only improvement and small-digit failure remain separate immutable evidence.
