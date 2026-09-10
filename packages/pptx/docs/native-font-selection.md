# Native output-font selection

The seven-slide physical-font fixture covers headings/scalar text, rich runs, tables, quotes, code, metrics and lists. All nine bundled legacy-family/style combinations are selected by native PowerPoint character properties and by fonts actually referenced by non-whitespace glyphs in a native PDF export. Node 20.20.2 and 24.20.0 each passed seven identical save/reopen PNG pairs, 14 identical original/saved current-content slide imports and removal of all nine owned temporary font registrations on Windows PowerPoint 16.0.20326.20132.

This establishes the native output family/style names. It does not prove physical font-file identity for every glyph, absence of synthetic glyph effects, edited-text reflow or browser/native pixel equality. The PDF's Windows names, such as `Roboto,Bold`, differ from source PostScript names such as `Roboto-Bold`; the reader strictly parses the optional comma Bold/Italic suffix and compares exact family/style tuples. It does not apply fallback-family aliases. The first PostScript-name-equality failure remains in the raw evidence.

From a coordinated sibling checkout, with desktop PowerPoint ready and the pinned open-font packages installed:

```powershell
node test/native-font-selection.mjs generate artifacts/font-native-01
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -File test/native-font-selection.ps1 -EvidenceDirectory artifacts/font-native-01
python test/native-font-pdf.py artifacts/font-native-01
node test/native-font-selection.mjs compare artifacts/font-native-01
```

Repeat with a fresh directory for each supported Node runtime. The Python reader requires `pdfplumber` and `pypdf`. Inspect all seven PDF raster pages. The private PDF may embed font subsets and must be excluded from portable evidence; retain its hash, extracted font names, raster images and exact verifiers instead, then remove the owned temporary PDF after inspection. Pinned open-source font bytes and their license texts are retained with the fixture.

The helper has a 45-second default and 60-second maximum, creates a hidden worker and closes only fixtures whose ownership is established. The surviving parent owns the nine temporary registrations and removes them in `finally`, including if its worker fails or times out. Existing fonts are never uninstalled or overwritten. The four-face Carlito fixture and its failure/timeout controls are unchanged. Preserve failed attempts, inspect Office and never automatically retry a blocked call. A terminated helper does not establish Office cleanup.

`generation.json` fingerprints the actual core, renderer, PPTX, vendor, lockfile and verifier bytes. The comparison checks those bindings, native source/output hashes, all nine native styles, exact save/reopen raster hashes, current-content imports and parent cleanup records. `pdf-fonts.json` records reader versions and the private PDF's hash. No proprietary Office font programs, glyph outlines or executables are redistributed.
