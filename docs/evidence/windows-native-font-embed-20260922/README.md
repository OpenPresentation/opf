# Native font-embed attempt 01: portable evidence (failed closed)

This bundle keeps the first supervised PowerPoint font-embed attempt, run on September 22, 2026, and the Carlito-only fixture it used.

- **Harness.** opf-pptx `main` `310f873` (PR #56 merged). Its tree is identical to the reviewed head `6e67741`. The harness snapshots under `inputs/` are byte-identical to the blobs at `310f873` after CRLF checkout.
- **Fixture.** `fixture-carlito-02`. Its `source.pptx` SHA-256 is `f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb`.

The attempt is kept as a failure. It was not retried.

## What ran and what happened

The worker opened an owned snapshot of the fixture and applied the Gate E edits:

- **Title:** `.Text` set, then `Font2.Name`, `Size`, `Bold` and `Italic`.
- **Body:** `.Text` set, then the same four font properties.
- **Body spans:** the same four font properties on each of four spans.

That is 26 property sets in total. The worker then enumerated `Presentation.Fonts` and applied the fail-closed allowlist/embeddability gate. SaveAs with `EmbedFonts = -1` (`msoTrue`) was to follow only if the gate passed.

**The gate failed closed before SaveAs.** `Presentation.Fonts` reported two entries:

| Name | Embedded | Embeddable |
| --- | --- | --- |
| Carlito | 0 | -1 |
| Aptos | 0 | -1 |

- **Gate result.** The allowlist accepts the Carlito family names only, so `Aptos` was the one unexpected name (`unexpectedNames: ["Aptos"]`).
- **Close without saving.** The worker marked the owned presentation saved and closed it once (`ownedCloseCount: 1`), without saving.
- **No saved copy.** No save was attempted (`embedFonts.attempted: false`, `blockedByNativeFontsGate: true`), and no saved package exists.
- **No retry** was started.

The records agree with each other:

- **Supervisor.** `nativeFontsGatePassed: false`, `embedSaveRecorded: false`, `fontCleanupConfirmed: true`, `inputsUnchanged: true` (20 input hash checks matched), `exitCode: 1` and `officeLifecycleComplete: false`.
- **Worker.** Exited `1` after 1.5 s and did not time out.
- **Fonts.** All four Carlito session registrations were added and removed.
- **Stages.** 132 records, contiguous. `error` is `null` on every record except two:
  - 124 `edited.presentation.native-fonts-gate`, status `blocked`, error `Aptos|`.
  - 132 `worker.failure`, the terminal record.
- **SaveAs.** No SaveAs stage exists.
- **Offline OPC audit** (`embed-opc-audit.json`). `passed: false`, with exactly one failure: `missing-evidence: native-font-embed.pptx is required`. That is the expected result when the gate blocks the save.
- **PowerPoint left running.** The host's PowerPoint process was left open, empty and with no dialog. `Quit` was not called (`host-postflight-embed-01.json`).

## Where Aptos came from is undetermined

The fixture package contains no `Aptos` anywhere. The verifier checks every part of `source.pptx`, the run snapshot, and `exporter-output.pptx` for the name, case-insensitively. The fixture's recorded typeface summary (`generation.json` → `carlitoOnly`) is:

- **Theme font slots.** major and minor `latin` are `Carlito`. The `ea` and `cs` slots are empty (`""`).
- **Residual non-Carlito typefaces.** Only 54 theme per-script supplements (`a:font script=…`) in `ppt/theme/theme1.xml`, such as Arial, Times New Roman and Mangal. There is no Aptos among them.
- **docProps "Fonts Used".** `Arial` and `Calibri`. This is static exporter metadata, not a text or theme slot.

`Presentation.Fonts` was enumerated only after all the edits (stage 104 onward; the last edit was stage 103). The harness records no enumeration before the edits. So this attempt cannot show whether Aptos was already reported for the unedited file or appeared because of the edits. Possible explanations, **none of which is established**:

1. The text inserted by `.Text` took Office's default font for the `ea`/`cs` script slots, because the theme leaves those slots empty.
2. `Presentation.Fonts` includes a PowerPoint application or default font that is not in the package.
3. Something else in PowerPoint's native font resolution.

## Not claimed

- Embedding success, or any embedded font part.
- Physical per-glyph font identity. `Presentation.Fonts` names and `Embeddable` flags are semantic gate inputs only.
- Any geometry, preview or pixel result. No gate or tolerance was changed.

## Next diagnostic (proposal only)

1. A read-only `Presentation.Fonts` inventory of the unedited `fixture-carlito-02/source.pptx`.
2. A pre-edit baseline `Presentation.Fonts` enumeration in the harness, recorded before any `.Text` or `Font2` set, so that pre-edit and post-edit names can be compared.

Only after that should anyone decide on a second embed attempt, and it must use a fresh output directory.

## Contents and verification

- `attempt-01/native-font-embed-01/` holds exact copies of the raw run directory: request, report, supervisor, worker, progress, stages, font registration, OPC audit, worker logs, and input snapshots including the harness scripts, `generation.json`, `LICENSE_FONT` and `source.pptx`.
- `attempt-01/` also holds the parent and audit logs and the host preflight and postflight records.
- `fixture/fixture-carlito-02/` holds `source.pptx`, `exporter-output.pptx`, `generation.json`, `source.opf.json` and `LICENSE_FONT`.
- **Excluded:** all eight font programs (four in the run, four in the fixture). Their names, sizes and SHA-256 are in `omissions.json`, and they match `generation.json` and `font-registration.json`.
- `source-copy-ledger.json` maps each bundle path to its source path relative to the workspace root `artifacts/windows-mixed-edit-20260922`, with SHA-256 and size.
- `artifact-manifest.json` hashes every other bundle file.

Run `node verify.mjs`. It uses Node's standard library only. It never starts Office, PowerShell, the harness, or font registration. It checks:

- manifest and ledger hashes, and that no font-program bytes are present (by extension, magic bytes and omitted hash, including inside the PPTX parts)
- that JSON/JSONL files parse, and PPTX ZIP central directories with CRC-32 for each entry
- the recorded result above, including the absence of Aptos from the fixture

It exits nonzero on any mismatch.
