# Current six-slide table qualification plan

**Evidence only; NEVER MERGE. Office-free profile preparation and Windows PowerShell ValidateOnly both passed. No Office, import/export or physical qualification was invoked by this agent. Native acceptance remains open.** This checkpoint separates the authentic failed f989/profile02 witness from the already corrected current 069 corpus. It does not certify PowerPoint colors from XML alone.

## Findings

The intact public synthetic source has six slides, one 2x2 editable table per slide, 24 cells and 36 runs. Current suite SHA-256 is `34139d3a8c84b4d975333691b6a2a3801f5d3da402dfe701062b6677de393d29`. Its 39,289-byte input SHA-256 is `485236f38e925ac3435582799edbf968d6ea8a2a2148a88f6e23194a9cfcb6fb`, exactly the same archive as the failed historical attempt. The authored source digest is also unchanged: `ff2214eda3cb406ffe0ea1ad5bfe004819e294b34135f3c91b982fb1871adc7c`.

Offline inspection resolves all 36 run fills through the archive's own theme and master clrMap and matches every current expected run. The only differences in historical/current `generation.expected` are the two inherited header runs on slide 4 (`Header`, `Inherited`), from `#FFFFFF` to `#000000`. The actual archive uses `tx1 -> dk1 -> 000000`. Both explicit red runs, body colors, alpha cases and explicit overrides remain unchanged.

The maintained RR-96 table-header rule chooses the higher contrast scheme role, so black wins on `#767676`. This is not the separate preferred-white threshold helper used for some body text. Current source already contains the expectation repair and refuses historical preferred-white metadata; no palette, exporter, threshold or tolerance change is proposed here.

Historical failure remains `Native table character color differs` at original slide 4 / cell 1.1 / character 1. Its actual COM RGB was not persisted and remains **UNKNOWN**. The worker reported `cleanupConfirmed:false` and `officeOperationsStopped:true`; no save/edit/reopen followed. A later global-zero inventory is not owned Quit/cleanup success. The immutable full cause witness is commit [057f1506](https://github.com/OpenPresentation/opf/tree/057f15064379777a13da1baff85ac307f0f86203/docs/handoff/2026-11-09/rr105-table-color-diagnosis). This plan retains the exact old failure, envelope and generation bytes for comparison without modifying them.

## Execution identity and commands

Use the clean frozen producer/controller/worker checkout `C:/opf-work/n034-current` at **`0699820e2f562d94c48b8c44a2d9b72387c0cecb`**, its genuine packed consumer `C:/opf-work/n034-current/artifacts/npm/consumer`, and existing suite `C:/opf-work/n034-current-suite01`. Both generation and execution identities are recorded separately, even when they have the same current Git revision. Do not advance or dirty that checkout for evidence documents.

All eight actual working-byte hashes and Git blob identities, Node 24.20.0 executable hash, suite/input hashes and the uncreated output path are in [source-identities.json](raw/plan/source-identities.json). In particular:

| Component | SHA-256 |
| --- | --- |
| Profile contract | `356a2d004eaf9d21a47135f911eb446b488cb5575d156759f827c8274867913c` |
| Supervisor | `fba11c28992f4ddf51c1b5f60106d49071806ac15d0fb17f13432457e505ac34` |
| Table-v2 worker | `89b66bfe6bdac36b93872ee05e2e888b19ae7ff3184c75cebc72227ad032a7cd` |
| Node executable | `5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5` |

The complete copyable PowerShell argv is in [proposed-commands.ps1.txt](raw/plan/proposed-commands.ps1.txt). These are proposed commands, not execution receipts. The new path `C:/opf-work/n034-current-table-profile01` was absent at inspection. The maintained prepare command copies and seals the **existing** table source and suite; no fresh deck generation or 59-case preparation is needed:

```powershell
$node = 'C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin/node.exe'
$preparedRaw = & $node 'C:/opf-work/n034-current/scripts/native-acceptance/table-profile.mjs' prepare --suite 'C:/opf-work/n034-current-suite01' --producer 'C:/opf-work/n034-current' --legacy-worker 'C:/opf-work/n034-current/packages/pptx' --consumer 'C:/opf-work/n034-current/artifacts/npm/consumer' --output 'C:/opf-work/n034-current-table-profile01'
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed; preserve output, no retry' }
$prepared = $preparedRaw | ConvertFrom-Json
if ($prepared.controllerRevision -cne '0699820e2f562d94c48b8c44a2d9b72387c0cecb') { throw 'Controller differs' }
$envelope = $prepared.envelope
$envelopeSha256 = $prepared.sha256
```

Capture the actual returned JSON and independently verify the envelope's actual SHA-256; no hash exists before preparation. The Office-free validator then uses exactly:

```powershell
& 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe' -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'C:/opf-work/n034-current/scripts/native-acceptance/run-table-profile.ps1' -Envelope $envelope -EnvelopeSha256 $envelopeSha256 -NodeExecutable $node -TimeoutSeconds 60 -ValidateOnly
```

Only after coordinator review, a fresh global PowerPoint process count of zero and separate explicit physical authorization, the coordinator can use the same supervisor argv with **`-RunOffice` instead of `-ValidateOnly`**. No helper/UI/kill/retry or alternative Office route is authorized by this document. If the worker fails, times out or cannot confirm cleanup, stop; retain every primitive probe and terminal receipt and make no later COM call, including cleanup.

Only after actual success and confirmed owned cleanup, the Office-free comparator is:

```powershell
& $node 'C:/opf-work/n034-current/scripts/native-acceptance/compare-table-profile.mjs' --envelope $envelope --sha256 $envelopeSha256
```

This comparator performs the required nine imports and six reexports and writes exclusive new comparison outputs. Do not substitute the retired `run-table-windows.ps1` / `native-table-colors.ps1` routes or the generic three-slide runner.

## Acceptance that must remain intact

- All **six original slides**, six tables and 24 cells; no splitting or projected substitutes.
- Original open/read/capture; SaveCopyAs, close and read-only reopen; real `Native ` prefix edits to cell (2,1) on **all six** slides; edited SaveCopyAs, close and read-only reopen/read/capture; verified-empty owned Quit.
- **72 cell observations**, every character and run color; **18 PNGs** with each original/reopened pair byte-identical. The six-cell edit is real editable text, not synthesized report data.
- Three archives imported, then two additional export/import cycles for **each** archive: **nine imports**, six reexports, all six slides and every expected cell string retained. Reexport geometry/raster parity is not claimed.
- One supervisor/worker, maximum **60 seconds**, exact bound paths/hashes, 16 MiB/archive and 4096-entry guards, clean generation/execution identities, stale/foreign presentation refusal, and the failure latch with **no subsequent COM after failure**. Existing generic limits are unchanged.
- Current worker persists phase/slide/cell/character, expected color, already-read primitive RGB/type/hex before validation, with no extra COM getter. Probe-write failure also latches. Any fresh discrepancy remains a failure with actual evidence, never a reason to weaken the assertion.

Vetoable decision **B26-TABLE069-EXISTING-CORPUS**: reuse the already sealed genuine current table archive and generate only a fresh execution envelope with current identities. Preserve the historical failed output and its unknown native RGB rather than rewriting it or treating XML as native success.

## Source and existing controls

All source citations refer to the immutable 069 checkout, and exact copies are retained under `raw/source` / `raw/controls`.

- `scripts/native-acceptance/table-colors.mjs:14-18`: six maintained expectation cases, including black at both gray boundaries.
- `packages/javascript/src/color.ts:695-698` and `packages/pptx/src/index.js:4030`: `readableSchemeColor` maximum-contrast header selection.
- `packages/pptx/test/styled-table.mjs:13-18`: boundary/alpha/explicit-override expectations.
- `packages/pptx/test/native-table-color-contract.mjs`: actual exporter XML contract, all 24 cells / 36 runs; this existing product test was **not rerun** in the read-only planning lane.
- `scripts/native-acceptance/table-profile.test.mjs:224`: historical preferred-white metadata refusal. Existing lifecycle/path/hash/identity and managed COM-fake tests remain in source; none were rerun here.
- `packages/pptx/test/native-table-colors-v2.ps1:118-151`: durable primitive RGB probe before strict validation.
- `scripts/native-acceptance/table-profile.mjs:104-133`: clean controller, case-aware path separation, exclusive prepare, exact six snapshots and distinct generation/execution identities.
- `scripts/native-acceptance/run-table-profile.ps1:35-46`: bootstrap and pure validation before any Office branch; `-ValidateOnly` returns without invoking Office.
- `scripts/native-acceptance/compare-table-colors.mjs:22-60`: all character colors, real edits, nine imports and original/reopened raster identity.

## Evidence verification and limitations

Run pinned Node on `verify.mjs`. It uses Node builtins only, verifies all 62 copied raw records (including the original 25 plan/source records totaling 1,876,777 bytes, actual preparation/envelope records and required check/recovery logs), exact source/old/current input identities and the two expectation differences, decodes the existing ZIP without normalization, and matches every actual run through its own theme/clrMap. The verifier performs no OPF import/export, native invocation, preparation or build. The first verifier-only attempt had a Unicode-regex syntax error; its original script is retained in `setup01/verify.mjs.txt`, and the correction removed only the invalid `\>` escape. That setup failure is separate from the authentic old native failure.

Actual required repository check outcomes are retained below. This is a preparation plan and source/data diagnosis, not a native PASS, physical glyph certificate, release approval or B26 closure. Root retains sole Office/CI coordination.
## Authorized Office-free preparation result

After coordinator review of the original plan, the one maintained prepare invocation exited 0, followed by one Windows PowerShell 5 ValidateOnly invocation (90-second outer bound, timeout60) exiting 0 at 2026-11-10T07:10:32.515Z. Its exact driver, raw stdout/stderr/exit receipts, preflight/postflight, six snapshots, environment helper and external envelope are retained. No RunOffice flag or COM call was made.

Actual profile: C:/opf-work/n034-current-table-profile01/table-profile.json, SHA-256 **55f8f5b71c7449eaf04d3c83f0c3e07b615ca4a8eb95c2570cb352b8644aa751**. Its source suite34139, clean controller069, actual input485236, six bound snapshots and all limits match. Windows PowerShell child-environment helper SHA-256 is **80ff3cb3936d2b928745152fc8c602e7014c85ed85a1b8c0d5057fecf13a93b6**; it removes only the child's inherited PSModulePath and leaves the parent untouched. The frozen producer remained clean at069 after validation.

The coordinator received this exact envelope/hash for separate root-only physical authorization. No physical result is present or implied in this checkpoint. Proposed commands above remain the reviewed route; actual already-run preparation/ValidateOnly argv is independently retained under raw/preparation.

## Required repository checks

Pinned offline install passed in the separate evidence checkout. Normal unmodified check:changed --base069 at evidence source69c66894 performed its own stock package build, which passed; Biome, changes and skill-commands also passed. Types were skipped because there were no TypeScript changes. The original aggregate is **RED** solely because check:text reached6/7 then could not open the sparse-omitted tracked fixture docs/evidence/rich-input-and-platform-ci-20260915/painting-Linux.json.gz. All original logs remain intact. This was not a table/schema/runtime failure.

Only that exact16,102-byte HEAD blob2bb264bd47d1382c5cf50c9b7c4f75e2750be7f6 was restored with exclusive write, within-workspace/OID/SHA checks and unchanged Git index. Its actual SHA is0b7ef1b73bbd4f31c5ac67716bea08f22a64df066f4ad343765c0d3d74511e56. Only the failed check:text command was rerun: **7/7 PASS**, full text scan9331files valid. No build/package/full-suite repetition occurred, and no frozen producer/consumer was built or changed. Raw check drivers, install/output/error/exit records, all original per-step logs and the exact hydration receipt are retained. The first aggregate is never relabeled green.

This receipt-only append does not change shipping source or the qualified table envelope. All packages/spec/scripts/skills/examples remain exact069; evidence publication is NEVERMERGE.
