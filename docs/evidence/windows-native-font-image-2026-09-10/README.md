# Native output fonts, editor undo and blocked image tests

Both Node 20.20.2 and 24.20.0 passed the [native output-font harness](https://github.com/OpenPresentation/opf-pptx/pull/27) on PowerPoint 16.0.20326.20132 / Windows 26200.9445. Each observed all nine bundled legacy-family/style combinations across seven payload slides, seven identical original/reopened PNG pairs and 14 identical current-content slide imports. All nine parent-owned temporary registrations were removed after each run. The PDF rasters also match across runtimes; all seven pages were visually inspected.

Native character properties and fonts referenced by actual PDF glyphs agree with the pinned open-font family/bold/italic metadata. The initial reader compared PostScript names directly and failed because Windows PDF uses names such as `Roboto,Bold`; that raw result and exact earlier verifier remain. The corrected reader strictly parses that naming dialect without fallback aliases. These results identify output family/style names, not each glyph's physical font file, synthetic-effect absence or browser/native pixel equivalence. Private PDFs are excluded; only their hashes, extracted observations and rasters remain. Open-font files and license texts are retained.

Editor checks pass on both runtimes: an atomic guarded image-source/alt replacement produces one undo entry, undo restores the exact document and PPTX bytes, redo restores the edited bytes, the caller's source remains unchanged and a stale slide-ID guard rejects without mutation. These are OPF editor and export checks. **Native image fidelity remains blocked.**

Both nine-format image decks were refused immediately when opening: first raw-preserve, then the default compatible PNG conversion. Minimal one-PNG decks produced by OPF and directly by PptxGenJS were also refused. All archive XML, relationship targets and ZIP CRCs validate, as do the source PNG chunk CRCs. This does not identify an OPF, vendor or codec defect. The independently PowerPoint-created picture control then timed out after 45 seconds; only its helper PID 16992 was terminated. It wrote `empty-owned.pptx` but did not reach the next output. That scratch diagnostic did not persist individual stage changes, so its exact blocked call and owned-presentation cleanup remain unconfirmed.

No further Office COM calls were made after that timeout. Supported UI inspection still showed the three pre-existing chart windows and no visible pending dialog; process responsiveness does not establish readiness. The user was asked to save wanted presentations, close PowerPoint normally and reopen it before image work resumes. Do not kill Office, close unrelated documents, infer cleanup from the missing helper or automatically retry. The raw unmerged image verifier snapshots are retained for diagnosis; no native image, alt-edit or image round-trip pass is claimed.

The complete source pins and current harness commit are in `sources.json`; open-source runtime bytes are fingerprinted and retained. Original text/chart/table/code/metric and coordinated quote/tab evidence stay in their separate immutable bundles.

```powershell
node docs/evidence/windows-native-font-image-2026-09-10/verify-evidence.mjs HEAD
node docs/evidence/windows-native-font-image-2026-09-10/verify-font-image.mjs
```

The first command validates complete coverage, SHA-256 and runtime/fixture bindings against actual Git blobs. Use `index` before committing. The second checks native source, PDF-extraction, raster and registration bindings, undo exports, refused image attempts and the timed-out control. Reproduction commands for fonts are in PPTX #27. Image native execution must wait until Office readiness and cleanup have been reviewed; use fresh evidence directories and retain every attempt.
