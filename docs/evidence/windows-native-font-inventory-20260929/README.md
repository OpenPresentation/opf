# FF-04 native font inventory evidence (2026-09-29)

This bundle records the third condition needed for FF-04: an unedited canonical Carlito fixture opened read-only in PowerPoint without registering temporary fonts. At the initial `Presentation.Fonts` observation, PowerPoint reported an empty-name entry and `Aptos`. The observed theme Latin slots name Carlito; East Asian and complex-script slots are empty. The inventory does not locate Aptos in a specific part/style or establish which physical font drew any glyph.

The September 29 no-temp run used source SHA-256 `f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb`. It recorded zero temporary registrations, one owned read-only open and one owned close, no semantic failures, confirmed cleanup, and unchanged source. The audit passed with zero failures. Its worker sampled `Presentation.Fonts` before reading presentation content. The sanitized UI postflight records Home with no open presentation or dialog after that run.

Two September 23 controls use the same input conditions at different times/sessions: an unedited fixture with four temporary Carlito faces (`flags=0`), and an exporter-output control without temporary fonts. Both original audits are preserved and failed only because audit v1 rejected the empty-name font entry. Their v2 offline re-audits pass while retaining the original raw observations. All three reports list the same two font entries. These separate sessions do not establish identical Office state across dates.

No font registration means no temporary fonts were installed for the September 29 condition; it does not prove system-wide absence of fonts. The embedded-font checks found no font parts in the included PPTX files. The four Carlito TTFs are intentionally omitted; their SHA-256 and sizes are recorded in `omissions.json` so verification does not need the font binaries. Screenshots, recent-file names, Office lock files, and unrelated Office state are excluded. The sanitized host pre/postflight sidecars omit process identifiers and process start times; the immutable worker receipts retain their run metadata.

The first setup control failed because the Node-inherited PowerShell process lacked `Get-FileHash`; its failure is preserved. A process-local Windows PowerShell 5.1 rerun passed all 16 controls. No global module path or security settings changed.

This evidence supports the inventory portion of FF-04 only. It does not establish Aptos root cause, per-glyph/physical font identity, or embedding behavior; FF-05 and FF-13 remain open. It is not a mixed-edit/save/reopen proof, which is recorded separately in the program evidence.

## Contents and verification

`attempts/` holds the two unedited-fixture runs; `controls/` holds the exporter-output control; `fixture/` holds the source and exporter-output PPTX plus generation metadata; `environment/` holds setup controls and sanitized host observations. `source-copy-ledger.json` identifies provenance and byte hashes without requiring the original machine paths. `manifest.json` hashes every other bundle file and defines the exact file set. `.gitattributes` disables text conversion within this evidence bundle so committed bytes remain stable.

Run `node verify.mjs` from this directory. The verifier uses only Node.js built-ins and validates hashes, exact membership, run lifecycle/assertions, audit history, and absence of embedded font programs.
