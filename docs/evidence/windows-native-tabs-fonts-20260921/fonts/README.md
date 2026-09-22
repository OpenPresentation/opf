# Windows native font-edit evidence — 2026-09-21

This byte-preserving E bundle records the first bounded native font-edit control and its offline reviews. The native worker passed for four explicitly styled body spans, with exact text/style persistence, zero recorded edited-to-reopened geometry drift, two exact owned presentation closes, four successful session-font removals, and all 20 supervisor input-hash checks passing.

The run used PowerPoint `16.0.20326.20158` on Windows build `26200.9457`. [OpenPresentation/opf-pptx PR 49](https://github.com/OpenPresentation/opf-pptx/pull/49), open at head `7538e4b`, contains the bounded worker and reviewed generator hardening. Its `test/native-font-edit.ps1` bytes have SHA-256 `b18f9e2ab822a42b9204a15314ed5ef6e74b1d933ba3e5e7e4efc3a542368960`, exactly matching the retained native-run verifier snapshot.

## Native result

The owned copy changed the title to `Gate E - Carlito` and the body to `Regular 18 | Bold 20 | Italic 22 | BoldItalic 24`. The four explicitly queried body spans reopened as Carlito regular 18, bold 20, italic 22, and bold italic 24. The worker saved with font embedding disabled, closed the exact owned deck, reopened it read-only, observed it again, and closed the exact owned deck a second time. It exited 0 with PowerPoint cleanup, font cleanup, stable input hashes, and the 0.02-point persistence gate confirmed.

The edited and reopened slide rasters are byte-identical. The root supervising agent reviewed the original, edited, and reopened full-slide images on 2026-09-21 and observed no text-fit clipping in this finite control. These facts do not establish browser/native pixel equivalence, cross-version layout equivalence, or general text fit.

The independent standard-library audit passes 16/16 checks. Its first report is retained: it failed one checker-only assertion because `audit.py` expected a `$succeeded` marker that the actual helper does not use. `audit-v2.py` checks the helper's real owned-addition removal loop and passes. The separate saved-PPTX XML review passes 6/6 archive-declaration checks for the three separator segments.

## Registration ownership and font-program omission

The four Carlito faces are licensed under the included SIL Open Font License 1.1 text. The font programs themselves are intentionally absent from this portable evidence bundle. `omitted-font-programs.json` records every omitted source path, byte length, SHA-256, and reason. There are sixteen omission records: the same four pinned identities at the native input snapshot, original fixture, generator-02 payload, and generator-03 payload. SVG is also excluded so the portable bundle cannot carry font bytes embedded in that container.

The native parent recorded four owned additions and four successful removals. `font-owner-controls-01` separately exercised failed and timed-out dummy workers, recording eight more owned additions and removals without Office calls. Combining those finite records yields twelve additions and twelve removals. The raw PowerShell aggregate report intentionally retains its serialization quirk: each case's `fonts` collection appears as an object with `value` and `Count`, rather than a direct array. The independent cleanup audit reads the two raw registration arrays and verifies four records per case without rewriting the original report.

Temporary family-name registration plus PowerPoint's reported `TextRange2` family/style values does not prove which physical font supplied each glyph, exclude fallback or synthetic styling, or establish actual font embedding. The saved PPTX contains no embedded font program, and this control makes no embedding-acceptance or per-glyph-file-identity claim.

## Fixture and semantic evidence

The first fixture metadata, OFL license, and source PPTX are retained without font programs. Generator 02 retains its package bindings, metadata, source OPF/PPTX, license, and comparison; exact executed generator bytes were not retained there, so the metadata is not a claim that reconstructed Git line endings equal executed bytes. Generator 03 supersedes it as the reusable control: it enforces package-root containment for resolved public ESM entries and pins the Carlito package identity through the registry lock. Its exact post-run, pre-Git-normalization generator snapshot has SHA-256 `a1e07d194f321418946322df2dde219a6fd2c6d75f0b647ecc27bd49c00d2f50`, matching the generation record. Its comparison shows all six payload inputs—source, license, and four omitted font identities—are byte-identical to the completed native run's inputs. Its initial `spawnSync` attempt failed with sandbox `EPERM` before output; the same reviewed generator then succeeded under approved escalation without an Office or font call. The generator-03 metadata was not the metadata used by the native run, and neither packaging this evidence nor reviewing the generator reran the native Office control.

The failed generator attempt remains preserved. The first semantic reimport checker failure and its outputs are also retained; the corrected current-registry check passes exact current title and body text. The import diagnostics explicitly do not reconstruct rich formatting or geometry, so semantic text recovery is separate from the native style observations.

The native worker directly queried the whole body and four styled spans, but did not individually query the three separator segments. Whole-body bold and italic are mixed-value sentinels (`-2`). The offline XML review shows that the saved archive declares the separators with the regular-run signature and Carlito Latin typeface, with no local size/bold/italic overrides. This archive declaration is not an individual native `TextRange2` observation and does not identify the physical glyph font.

## Reading the bundle

`artifact-manifest.json` inventories every payload file except itself. `.gitattributes` contains `** -text`. `portable-verify.py` validates the full inventory, hashes, JSON/JSONL, PPTX CRC/XML and absence of embedded font programs, native lifecycle/style result, ownership totals, omission identities, audits, semantic correction, PR binding, and visual-review hashes using only the Python standard library.

Raw reports retain historical absolute host paths; use bundle-relative paths and hashes. The builder copies only its explicit whitelist, excludes Python caches, and rejects font programs, PDFs, screenshots, recents data, and symlinks. It neither invokes Office nor registers, installs, copies, or embeds any font program.
