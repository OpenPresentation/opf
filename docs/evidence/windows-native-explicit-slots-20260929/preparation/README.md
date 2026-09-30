# FF-05 E7 explicit Calibri theme slots: prepared offline (2026-09-29)

This is a prepared input for the proposed E7 control in the accepted [Aptos origin brief](../sources/opf/docs/programs/font-fidelity-everywhere/aptos-origin-brief.md). It contains **no native run or result**. Preparation started no Office, COM, subprocess or font API, registered no fonts, and changed no source repository. It does not identify Aptos's origin, prove physical font identity, pass a font allowlist or demonstrate embedding. FF-05 remains open.

The input is the exact accepted [E6 public fixture](../sources/opf/docs/evidence/windows-native-calibri-control-20260929/fixture/calibri-control.pptx), SHA-256 `776147ddfd2a35ceca4480b66d58c82c9255609b5abe245a2b3bb342651ebce5` (15,621 bytes). Its canonical ancestor has SHA-256 `f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb`. The E6 input remains unchanged.

The prepared control is [prepared-01/calibri-explicit-slots-control.pptx](prepared-01/calibri-explicit-slots-control.pptx), SHA-256 `4e2bab2a4f5a0f09350d2edc2463bcb29302fa7db34a8c621e39fcd5c9a16cd7` (15,616 bytes). Exactly four `typeface=""` values become `typeface="Calibri"` in `ppt/theme/theme1.xml`: major and minor `a:ea` and `a:cs`. That entry grows by 28 uncompressed bytes. The other 40 of 41 ZIP entry contents, every relationship and all authored text remain byte-identical. Supplemental `a:font` script mappings and theme Latin slots remain unchanged. The control contains no empty theme ea/cs slots, literal Carlito or Aptos, embedded font entries, font relationships or font content types. No font binaries were added or installed.

[prepared-01/manifest.json](prepared-01/manifest.json) records source, output, generator and dependency hashes; before/after hashes and byte lengths for every ZIP entry; exact XML attribute paths and before/after character and byte offsets; the four opening-tag changes; source provenance; and finite-control assertions. [prepared-01/xml-attribute-diff.txt](prepared-01/xml-attribute-diff.txt) lists the exact edits. ZIP container metadata is normalized like E6, using lexicographic entry order, compression level 9, local calendar timestamp `2000-01-01 00:00:00` and OS value 0. The package size change is not a claim that unchanged compressed entries or ZIP headers are identical.

The guarded [prepare-explicit-slots.mjs](prepare-explicit-slots.mjs) requires the exact E6 hash before decoding, the exact fflate 0.8.3 module hash `8d75534a30a0580608e1271c13d70943ed4cd3589fddff7b1197748036a5116e`, exactly four empty target attributes, one changed entry and 41 total entries. It checks every other entry's bytes, all relationships, absence of font parts/literals, and that the source remains unchanged. It refuses an existing output directory and exclusive-creates output files. Use Node 24.21.0 with the existing pinned local fflate installation; no network or dependency installation is needed.

```powershell
& '../../toolchain-node24/node.exe' ./prepare-explicit-slots.mjs `
  (Join-Path (Get-Location) 'fresh-offline-output')
```

Run this from the preparation directory and supply a new subdirectory. Two separate fresh generations, `prepared-01` and `prepared-repeat-01`, produced exactly equal PPTX bytes, attribute changes and entry hashes. [verification-receipt.json](verification-receipt.json) records this comparison and the existing-output rejection check. The repeated manifest differs only where it names its separate output location. Logs preserve each completed generation and the refused reuse attempt. These are offline derivation checks, not native evidence.

Source graph at preparation:

| Repository | Head |
| --- | --- |
| core | `0e81a407f57e5106ad607a9617c571d86b5428da` |
| opf-pptx | `7fca9a2eb5088ee2325fb686d1ff84332af2b8d9` |
| opf-render | `6c7d7818e40d0f9c519e4b34f7a24e9150c1787f` |
| opf-editor | `d0c95a16b50eccb3eee695ace44cc6c3a6754f2f` (dependency-only refresh; not used to derive this control) |

The program root must obtain independent input review before any separately authorized bounded native inventory. No native command is executed or native result inferred here. Any eventual result would apply to this joint four-slot change; it would not isolate one slot or establish the physical font used for glyphs.
