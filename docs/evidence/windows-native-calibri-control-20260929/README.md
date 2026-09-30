# FF-05 E6 Calibri control evidence (2026-09-29)

Replacing every explicit Carlito typeface in the canonical unedited fixture with Calibri did **not** remove the Aptos entry observed at open. This one bounded control completed read-only with no temporary font registration. `Presentation.Fonts`, sampled before content and theme reads, reported the same empty-name entry and `Aptos` as the [FF-04 fixture inventories](../windows-native-font-inventory-20260929/README.md). Explicit Carlito typeface references are therefore unnecessary for this recorded observation. The experiment does not locate the Aptos source in a style/part, prove physical font or per-glyph identity, pass a font allowlist, or demonstrate embedding. FF-05 remains open.

## Input derivation

Canonical source SHA-256: `f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb` (15,624 bytes). Control SHA-256: `776147ddfd2a35ceca4480b66d58c82c9255609b5abe245a2b3bb342651ebce5` (15,621 bytes).

The preparation changed exactly 17 XML `typeface="Carlito"` attributes to `typeface="Calibri"`: nine in the slide master, six in the slide, two theme Latin attributes. Three of 41 ZIP entry contents change; the other 38 remain byte-identical. Every relationship and authored text is unchanged. The four empty theme major/minor East Asian and complex-script slots remain empty. No non-attribute Carlito occurrence existed and none remains; neither package contains embedded fonts, and the control contains no literal Aptos. ZIP metadata is normalized by the deterministic repack, so the compressed package size changes despite identical lengths of the three XML parts.

The original preparation script, manifest (all part hashes and exact attribute paths/offsets), and human-readable diff are immutable byte copies under `preparation/`. The canonical source and its original OPF/generation/license metadata are copied from the accepted FF-04 public bundle under `fixture/canonical/`. Historical generation metadata names four Carlito font inputs; those font binaries are intentionally absent and are not needed to verify or derive this control. No proprietary font file is included.

## Native observation and boundaries

The completed run in `native-inventory-01/` used Windows PowerShell 5.1.26100.9444, Windows build 26200.9457, and PowerPoint 16.0. It recorded one owned read-only open and one owned close, 283 contiguous stages, zero temporary registrations, no semantic failures or exceeded bounds, confirmed cleanup, and unchanged original/snapshot input. The worker took 1,301 ms within its 45-second deadline. The immutable offline audit passed with zero failures.

Theme major/minor Latin names were Calibri; theme East Asian/complex-script names remained empty. All six observed slide whole-range/paragraph/run Font2 records name Calibri in `Name`, `NameAscii`, `NameFarEast` and `NameComplexScript`; `NameOther` is empty. This is a reported-name observation, not proof of the font file used to draw a glyph. `Presentation.Fonts` reported an empty name (embedded/embeddable `0/0`) and Aptos (`0/-1`). The inventory is observational; `passed: true` describes lifecycle/input/inventory validity, not a font allowlist result.

The root's preflight and postflight sidecars record PowerPoint Home with no open presentation or dialog. These are authored UI observations, not facts independently proved by the portable verifier. They retain raw timestamps/process metadata and no screenshots or private recent-file names. The session already had one prior inventory run; this control does not establish an identical fresh Office state across experiments. No owned presentation was edited, saved, exported or reopened, and Office was not quit or terminated.

Source graph at this checkpoint:

| Repository | Head |
| --- | --- |
| core | `061499d53aabefb266dd4f7f5c5bd85f6d24c425` |
| opf-pptx | `bf3f78f9c4d7e38363b4e5df425e49165591408f` |
| opf-render | `6c7d7818e40d0f9c519e4b34f7a24e9150c1787f` |
| opf-editor | `d0c95a16b50eccb3eee695ace44cc6c3a6754f2f` (dependency-only refresh; not part of this inventory) |

## Portable verification and reproduction

Use Node 24.21.0. `verify.mjs` uses only Node built-ins; it is read-only and needs no original absolute paths, installed packages, fonts, PowerPoint or network. It checks exact file membership, manifest and copy-provenance hashes, the canonical/control input hashes, all 41 uncompressed entry-content hashes and the exact derivation, absence of font programs, raw input/audit/companion bindings, lifecycle, all expected stages and bounded observations.

```sh
node verify.mjs
```

`preparation/derive.mjs` is a separately identified portable adapter of the preserved original preparation script. It changes dependency/input/output path handling only, reads the included canonical source, and refuses an existing output directory. Its bundled fflate 0.8.3 module is an unchanged MIT-licensed copy whose hash matches the original manifest. It writes a newly derived PPTX, manifest and diff to a fresh directory; the new manifest identifies the adapter and new paths, while the PPTX bytes must match the recorded control hash.

```sh
node preparation/derive.mjs /absolute/path/to/fresh-offline-output
```

`auditor/` includes the complete reviewed inventory PowerShell source, process/font helper companions, offline inventory auditor, its embed-audit helper and PowerShell scanner. The PowerShell companions equal the immutable `native-inventory-01/inputs/` snapshots. The offline auditor's module dependencies are fflate 0.8.3 and fast-xml-parser 5.8.0 (as in the recorded PPTX checkout). Its original CLI binds original machine paths and exclusive-creates `audit.json`; do not rerun it against this relocated immutable run. Use `verify.mjs` for the portable bundle. For a new authorized run, use the original PPTX checkout with those dependencies and the bundled sources as the review reference.

The following documents the recorded native command shape; it is **not** part of portable verification and is not authorization for another Office run. The program root owns any future native run and must use a fresh directory and its pre/postflight protocol.

```powershell
powershell.exe -NoProfile -NonInteractive -File auditor/native-font-inventory.ps1 `
  -InputPresentation (Resolve-Path fixture/calibri-control.pptx).Path `
  -ControlDeck -OutputDirectory 'C:\fresh-native-output' -TimeoutSeconds 45
# In the matching PPTX checkout, after that separately authorized run:
node test/native-font-inventory-audit.mjs 'C:\fresh-native-output'
```

`source-copy-ledger.json` records every copied artifact's relative origin, byte length and hashes. `manifest.json` defines and hashes every other file; `.gitattributes` disables byte conversion. The portable verifier reports recorded evidence only. A next experiment changing the four empty theme script slots remains a proposal; no such input or native run is included here.
