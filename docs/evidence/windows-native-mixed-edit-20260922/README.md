# Native mixed-size table edit/save/reopen: portable evidence

This bundle keeps two supervised PowerPoint edit/save/reopen attempts on the reviewed mixed-size table fixture: one slide, one 1x1 table, a 245-character cell with five authored runs, a literal tab, and no authored line break. The fixture is the source used in `../windows-native-mixed-table-20260921/`. Each attempt opens an owned snapshot, replaces the final run's text `exact` with `saved` (same length), and saves with `SaveAs(path, 24, 0)`, which leaves font embedding off. It then reopens the saved file read-only and records content, style, outer geometry and native line intervals for the original, edited and reopened phases. The offline `test/native-mixed-edit-audit.mjs` owns the gates, and its `audit.json` is kept for each attempt.

Attempt 01 is kept as a **failure**. Attempt 02 was run with the corrected harness in a fresh output directory. It is not an in-place retry, and it **passed** the unchanged audit.

| Bundle path | Raw workspace directory | Name in the opf-pptx harness doc | Harness |
| --- | --- | --- | --- |
| `attempt-01/native-mixed-edit-01/` | `native-mixed-edit-01` | `windows-native-mixed-edit-01` | opf-pptx `main` `86afe6c` |
| `attempt-02/native-mixed-edit-02/` | `native-mixed-edit-02` | none (later run) | opf-pptx PR #55 head `0f3a3da` |

PR #55 was reviewed and passed Linux and Windows CI; see the handoff for its merge receipt. The harness snapshots under each `inputs/` are byte-identical to the blobs at those commits after CRLF checkout.

## Attempt 01: lifecycle complete, audit failed

- **Lifecycle.** The worker exited `0` and did not time out: `01:21:33.02Z` to `01:21:38.13Z`, 5.1 s. It took 6.5 s from the host preflight record to the supervisor record. The supervisor recorded Office lifecycle, Office cleanup and font cleanup as complete. All four Carlito session registrations were added and removed. The PowerPoint process that the run created was left open and empty, with no dialog. `Quit` was not called and there was no retry (`host-postflight-01.json`).
- **Audit result.** `passed: false` with 1,498 failures in two categories:
  1. **1,496 stage failures.** Every record in `stages.jsonl` (sequences 1–1496, contiguous) has `"error": ""`, but the audit requires JSON `null`. Cause: the stage writer declared `[string] $ErrorMessage = $null`, and PowerShell converts `$null` to `''` for `[string]` parameters.
  2. **2 whole-cell italic failures (edited and reopened).** In those phases, whole-range `Font2.Italic` read `-2` (mixed). All five runs, all seven character probes, and the original phase read italic `0`. The saved slide XML has no `i="1"` anywhere. It does have explicit `b="0" i="0"` on the edited final run and on `endParaRPr`. The harness wrote those itself by reassigning `Font.Name/Size/Bold/Italic` after replacing the text, while the other runs inherit.
- **Context only, not acceptance.** The edited and reopened native line intervals were `[0,92) [92,194) [194,245)`, the same as the original phase. Outer shape geometry read 43.2 / 43.2 / 873.6 / 118.8 pt, within float precision (max deviation 2.4e-5 pt).
- **The fix** is [opf-pptx#55](https://github.com/OpenPresentation/opf-pptx/pull/55), head `0f3a3da`. The stage error parameter is untyped and serializes `null`, and the edit now replaces text only. No audit gate or tolerance changed.

## Attempt 02: passed

- **Harness and host.** PR #55 head `0f3a3da` (`host-preflight-02.json`). The preflight recorded the PowerPoint process left from attempt 01 as open, empty and with no dialog.
- **Lifecycle.** The worker exited `0` and did not time out: `02:01:57.76Z` to `02:02:02.12Z`, 4.4 s. It took 5.9 s from the host preflight record to the supervisor record. The supervisor recorded Office lifecycle, Office cleanup and font cleanup as complete. All four font registrations were added and removed.
- **Stages.** 1,486 records, contiguous, all with `"error": null`.
- **Audit.** `passed: true` with 0 failures. The `audit.json` SHA-256 is `23c19bbe1fa2133f453ecf1334103e3fbefe2a26dbd6b72f795f337fe54b6983`. All 25 `artifactHashes` entries bind to bundle bytes, except the four font programs, which bind to hashes recorded in `omissions.json`.
- **Style and geometry.** In the original, edited and reopened phases, the whole cell read Carlito / 18 / bold `-2` / italic `0`. All runs and probes read italic `0`. Native lines were `[0,92) [92,194) [194,245)` in every phase. Outer geometry was 43.2 / 43.2 / 873.6 / 118.8 pt, within float precision. The reopened phase is read-only (`-1`).
- **Files.** The saved and reopened PPTX SHA-256 are equal (`ca8a5e04…`). The source and snapshot are recorded as unchanged. The saved slide XML has no explicit `i` attribute. PowerPoint build `16.0.20326.20158`, Windows build `26200.9457`.
- **Root review.** `root-review-02.json` records the root visual review of `reopened.png`, bound by hash to the PNG and to `audit.json`.

## Limits

- **No preview/native parity.** The estimated preview line intervals `[0,78) [78,172) [172,245)` still differ from native. The audit records this as a limit, not a failure. The PNGs are not compared pixel-for-pixel.
- **No font embedding.** Embedding is not requested or tested.
- **No per-glyph font identity.** Native font properties do not identify which physical TTF drew each glyph.
- **No general mixed-table layout rule** is claimed.
- The native 0.02 pt gate is unchanged. The renderer's separate 0.1 reference-pixel browser gate is not exercised by this bundle and is also unchanged.
- **Observation, not gated.** In both attempts, PowerPoint saved the authored run `Second large phrase ` as two XML runs, `Second large ` and `phrase `, with identical visible properties. COM still reports five runs.

## Contents and verification

- `attempt-NN/native-mixed-edit-NN/` holds exact copies of each raw run directory: reports, request, stages, audit, PNGs, source and saved PPTX, harness snapshots, font license and generation record.
- `attempt-NN/` also holds the root-level sidecars for that attempt: parent and audit logs, host preflight and postflight records, and the root review.
- **Excluded:** font programs (`inputs/fonts/*.ttf`). Their names, sizes and SHA-256 are in `omissions.json`, and they match `inputs/generation.json` and `font-registration.json`.
- `source-copy-ledger.json` maps each bundle path to its source path relative to the workspace root `artifacts/windows-mixed-edit-20260922`, with SHA-256 and size.
- `artifact-manifest.json` hashes every other bundle file.

Run `node verify.mjs`. It uses Node's standard library only. It never starts Office, PowerShell, the harness, or font registration. It checks:

- manifest and ledger hashes, and that no font-program bytes are present (by extension, magic bytes and omitted hash, including inside the PPTX parts)
- that JSON/JSONL files parse, PNG signatures, and PPTX ZIP central directories with CRC-32 for each entry
- the recorded results above for each attempt

It exits nonzero on any mismatch.

The bundle is regenerated from the raw workspace by an external `build-bundle.mjs`. That script is not part of this bundle, and the verifier does not need it.
