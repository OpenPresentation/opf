# Report-only numeric precision correction

The original3b52source/66bba packet and its failing verifier are held, unchanged and nonaccepted. PS5 JSON serializes copied Single shape.left43.20000076293945 as43.2 while promoted Double bound/relative values retain precision. The original exact offline subtraction correctly refused3 versus3.0000007629394503. No tolerance is allowed. The initial shell then wrongly continued to commit/push despite that native exit; this is explicitly preserved, and every subsequent commit/push is guarded by LASTEXITCODE.

The corrected source checkpoint is `02b86f5c2ed94deac9be22444700eb392034f648`. Its only observer behavior change is report-only promotion of copied shape coordinates to Double before JSON, preserving the original numeric values. No native geometry/text/font/language/archive change occurs. A real PS5 serialization control genuinely fails on unchanged d460worker (managed02a), then passes on corrected528b18d4worker (managed03). The first managed02 fixture used an extra array wrapper and produced a setup invalidcast; both attempts and checker snapshots remain literal and are not conflated.

Managed03 passes23cases: the original21 plus valid negative absolute BoundLeft and the exact JSON roundtrip over120normal/descending/zero-width/negative-left observations. Width must remain finite/nonnegative; negative left coordinates remain valid offslide observations. All45base functions are hashed:44unchanged, only the existing Read-FurnitureState observation hooks differ from2b. Before/after checker/worker/SOURCE hashes are identical. Node4controls pass. Original09 remains101027bytes/SHA4b9d…/147orderedparts, three exact shapes/full UTF16; no controls or source/size/proofing/font/geometry edits.

The append is36lossless records/863326decoded bytes. The original32-record raw archive/receipt stay byte exact. Its old verifier's immutable Git bytes are bound separately from the unchanged working copy's final CRLF, with exact CRLF→LF text equivalence; no input/worker bytes receive normalization. An initial append storage guard refusal is retained. The current verifier replays both archives, explicitly verifies the old precision refusal, and checks the new exact reconstruction without executing archived code:

```sh
node docs/handoff/2026-11-10/b07-character-bounds-preparation/append01/verify.mjs
```

No actual preparation, ValidateOnly, Office/COM activation, native prototype, preview/export, app build, provider, CI observer or native acceptance occurred. Root approval remains withheld until corrected frozen worker/adapter/managed proof are reviewed and a fresh global zero check precedes any later root-owned native launch. D2 untouched. NEVER MERGE; glyphFix/currentRuntimeAcceptance/nativeAcceptance remain false.
