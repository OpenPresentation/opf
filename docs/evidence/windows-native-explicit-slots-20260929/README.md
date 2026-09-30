# FF-05 E7 explicit theme-slot control evidence (2026-09-29)

Filling the four empty theme major/minor East Asian and complex-script slots with Calibri did **not** remove the Aptos entry observed at open in this control. One bounded read-only inventory without temporary font registration completed at 09:38 UTC. `Presentation.Fonts`, read before content and theme queries, again reported an empty-name entry and Aptos. Empty theme ea/cs values are therefore unnecessary for this recorded observation. This does not locate Aptos's origin, prove physical font or per-glyph identity, pass a font allowlist or demonstrate embedding. **FF-05 remains open.**

## Exact derivation and preparation history

The included [E6 parent fixture](fixture/parent/source.pptx) is the exact accepted [E6 Calibri control](../windows-native-calibri-control-20260929/README.md), SHA-256 `776147ddfd2a35ceca4480b66d58c82c9255609b5abe245a2b3bb342651ebce5` (15,621 bytes). The E6 bundle preserves its canonical ancestry; this bundle does not duplicate the Carlito ancestor metadata or fonts.

The [E7 input](fixture/calibri-explicit-slots-control.pptx) has SHA-256 `4e2bab2a4f5a0f09350d2edc2463bcb29302fa7db34a8c621e39fcd5c9a16cd7` (15,616 bytes). Exactly four XML attributes in `ppt/theme/theme1.xml` change from `typeface=""` to `typeface="Calibri"`: `a:ea` and `a:cs` beneath each major/minor font definition. That entry grows by 28 uncompressed bytes. The other 40 of 41 ZIP entry contents, every relationship and all authored text remain byte-identical. Theme Latin and supplemental script mappings remain unchanged. Neither input contains font programs or literal Carlito/Aptos in ZIP entry contents; no empty theme ea/cs slots remain in E7.

`preparation/` preserves byte copies of the reviewed original generator, both fresh-generation manifests/diffs, repeat output, logs, comparison receipt and original preparation README. Their statements that no native run/result exists describe **preparation time**, before the later attempt recorded in this bundle. They are retained unchanged. The first manifest binds source/output/generator/dependency hashes, all 41 entry hashes, exact attribute paths and before/after byte/character offsets. Both fresh generations produced equal PPTX bytes, changes and entry hashes; the generator refused an existing output directory. The deterministic ZIP policy matches E6: lexicographic entry order, compression level 9, local calendar timestamp `2000-01-01 00:00:00`, OS value 0. Repacking normalizes container metadata; unchanged entry contents are the comparison boundary.

## Recorded native observation

`native-inventory-01/` preserves the single actual attempt and its immutable offline audit. It recorded one owned read-only open and one owned close, unchanged original/snapshot input, confirmed cleanup, zero temporary registrations, no semantic failures or exceeded bounds, and 283 contiguous expected stages. The worker completed in 1,227 ms within its 45-second deadline; the observational audit passed with zero failures. No owned presentation was edited, saved, exported or reopened, and Office was not quit or terminated.

All six reported theme slots—major/minor Latin, East Asian and complex script—were Calibri. All six inspected slide range/paragraph/run Font2 records reported Calibri for `Name`, `NameAscii`, `NameFarEast` and `NameComplexScript`; `NameOther` was empty. `Presentation.Fonts` contained an empty name (`Embedded=0`, `Embeddable=0`) and Aptos (`Embedded=0`, `Embeddable=-1`). These are reported-name observations. Passing inventory/audit status validates lifecycle, input and inventory consistency, not an allowlist or the physical font file drawing a glyph.

The raw host sidecars record PowerPoint Home without an open deck or dialog before and after the run, and measured application file/product version `16.0.20430.20092`. The COM application version reported `16.0`; the sidecar's more precise version is separate host evidence. UI state is an authored observation, not independently proved by the portable verifier. No screenshot or private recent-file name is included. The process already had two prior inventory runs; E6 and E7 ran sequentially in that same process, so this comparison does not control every cache, native-state or host variable.

Source graph at preparation and this checkpoint:

| Repository | Head |
| --- | --- |
| core | `0e81a407f57e5106ad607a9617c571d86b5428da` |
| opf-pptx | `7fca9a2eb5088ee2325fb686d1ff84332af2b8d9` |
| opf-render | `6c7d7818e40d0f9c519e4b34f7a24e9150c1787f` |
| opf-editor | `d0c95a16b50eccb3eee695ace44cc6c3a6754f2f` (dependency-only refresh; not used for this inventory) |

## Portable verification and reproduction

Use Node 24.21.0. The read-only `verify.mjs` uses only Node built-ins; it needs no original absolute paths, installed dependencies, fonts, Office or network. It verifies exact bundle membership and byte-copy provenance; pinned E6/E7 input hashes; all 41 uncompressed entry-content hashes and exactly four attribute changes; relationships and absence of font programs; preparation/repeat bindings; raw request/audit/companion hashes; exact reviewed bounds; independently recomputed full name ledgers including empty-name findings; and the full expected stage sequence, lifecycle and reported names.

```sh
node verify.mjs
```

`preparation/derive.mjs` is a separately labelled portable adapter of the preserved original generator. It changes only dependency/input/output location handling, reads the included E6 parent and bundled pinned fflate 0.8.3 module, and requires an exclusive fresh output directory. Its regenerated manifest names the adapter/new paths; the regenerated PPTX must match the recorded E7 hash. The unchanged MIT-licensed fflate source, package metadata and license are included. No dependency installation or network is needed.

```sh
node preparation/derive.mjs /absolute/path/to/fresh-offline-output
```

`auditor/` contains the complete reviewed inventory PowerShell source, process/font companions, original offline inventory auditor, embed-audit helper and PowerShell scanner. The PowerShell companions match the immutable attempt's input snapshots. The original offline auditor uses fflate 0.8.3 and fast-xml-parser 5.8.0; its CLI binds original machine paths and exclusive-creates `audit.json`. Do not rerun it against the relocated immutable attempt; use the portable verifier. A separately authorized fresh native run would use the existing PPTX checkout and its dependencies, with these bundled sources as the review reference.

This records the native command shape, not an instruction or authorization to run Office again:

```powershell
powershell.exe -NoProfile -NonInteractive -File auditor/native-font-inventory.ps1 `
  -InputPresentation (Resolve-Path fixture/calibri-explicit-slots-control.pptx).Path `
  -ControlDeck -OutputDirectory 'C:\fresh-native-output' -TimeoutSeconds 45
# In the matching PPTX checkout after that separately authorized run:
node test/native-font-inventory-audit.mjs 'C:\fresh-native-output'
```

`source-copy-ledger.json` lists every copied artifact's relative origin, byte length and hashes. `manifest.json` hashes every other file, and `.gitattributes` disables byte conversion. No proprietary fonts, screenshots or private recent-file names are included.

The next proposal is a separately reviewed second `Presentation.Fonts` read after the existing content queries. No such harness change or run is included here. The four-slot control leaves root cause, physical font identity, allowlist and embedding acceptance unresolved.
