# B07 stage error representation — source checkpoint

The coordinator reports that current case05/native03 completed 942 continuous
stages, worker/supervisor exit0, the owned closes and the empty application's
Quit. The one immediate global postflight then found POWERPNT PID35556 and
correctly failed the attempt. No owned Office process identity was recorded;
PID35556 remains unclassified. This work did not access, copy or amend that
Windows output, query processes, wait, clean up, or run Office. Those facts are
coordinator-reported, not a newly executed native acceptance receipt.

The unchanged real worker declares
`Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null)`.
Windows PowerShell's typed string parameter emits an omitted/null error as an
empty JSON string. The prior B07 reader required JSON null. The new builtin-only
reader accepts **only** `null` or exact `""`, requires each status to be exactly
`begin` or `success`, and preserves the existing continuous sequence, exact
false fault latch, bounded count and final `worker.complete/success` checks.
It adds no adjacent-pair or nesting assumption. Whitespace, real errors,
booleans, numbers, objects, arrays and missing errors remain refused.

The observer still hashes the original stage bytes before reading them. The
parser returns original JSON records without mutation; no error value is
normalized and no raw file is rewritten. Runner/global-zero admission, report
error null, controller identity, worker/supervisor bytes, limits and lifecycle
are unchanged. This reader correction cannot admit the failed native03 runner.

Prepared controls in `scripts/native-acceptance/b07-stages.test.mjs` cover null,
empty and mixed error representations, nested begin/success records, unchanged
raw bytes, malformed errors/statuses, fault flags, sequence gaps and missing
completion. A Windows-only Office-free control AST-imports **only** the actual
unchanged stage writer, invokes its omitted/null/empty parameter forms, returns
the actual serialized raw bytes and a genuine failure record, and pins the
worker source hash. The ordinary worker entrypoint and process/COM definitions
are never evaluated by that control.

**Original Mac validation:** builtin reader controls2PASS/1Windows-onlySKIP. Fresh pinned frozen
install/build and Biome passed. The first reader-only mapper remained exit1
with3 declared sparse-input failures. After individual current-HEAD Git
mode/blob/bytes/SHA256 restoration of1860 known inputs, only those failed
checks were replayed: gallery18/18+strict863fresh, native171PASS/0FAIL/11SKIP,
text7/7+11850validfiles. The composite is all7selectedchecksPASS; no full
`pnpm test`, actual PowerShell5 serialization or Office ran.

Actual receipts bind the four reader files, five unchanged
worker/supervisor/reference files and unchanged product trees. The original
mapper failure, failed-only replay logs and exact hydration receipt are retained
losslessly in `raw-results.json.gz`. Added receipt/docs metadata checks remain
pending for the coordinator's combined delta after the shared slot was released.
The future bounded-postflight design is a separate [proposal](lifecycle-proposal.md);
its implementation is absent from this reader checkpoint.

**Subsequent Windows source-only check:** the authorized relay executed exactly
`node --test scripts/native-acceptance/b07-stages.test.mjs` once on fresh clean
head `562a04c83f0407a2c395f6a55172b1d8120bd881`, tree
`5d489e23731f919ef81553375b154d3d2586fa2b`, using its pinned Node24.20.0.
Actual result: exit0,3PASS/0FAIL/0SKIP,0.531seconds. The real Windows PowerShell5
writer control executed and confirmed all7successful synthetic error values are
exact empty strings, while the nonempty synthetic failure remains rejected.
The unchanged84426byte worker hash was verified before and after invocation:
`d6b9232eb7f25ff3402ea4629345681396085b5a6c309a694099f33371910c02`.
Source head/tree and clean status were unchanged. No install/build, worker main,
COM/process helper, process inventory, Office or raw-case05 transfer occurred.

The relay retains the exact source-only receipt at
`C:/opf-work/relay-b07-stage-wire01-run01/test-receipt.json`:2368bytes,
SHA256 `c885d5e104af28150e64dd35a7a91e0704a2122fff3edab8e2dbea475dd93370`.
Stdout439bytes SHA256 `c551cfe6539633d95f5ab67d4d6300bc77f73a1f49761f676d9692ac24503698`;
stderr is empty. This paragraph records the relay's actual result; it does not
claim that its raw receipt was transferred or that native03 is accepted.
