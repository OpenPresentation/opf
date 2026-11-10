# Source-only Windows text-probe successor

The relay normal-merged canonical `7618e916dacc166463cddf5f2ea029f523bbe51d` with fresh main `7fb6140804f969550e3a9c9d52916b7610844917`. Worker delta base: `1a283121c8d6f4885fde306dc96e5a3ec2e15b7d`. Historical workers, manifests, inputs and B07 failures are unchanged. The forthcoming coherent producer must generate its own sealed suite.

## Contract

`Open-OwnedFurniture` always uses `Open(path,-1,0,0)`: exact owned path, read-only, titled and windowless. Existing immediate global PowerPoint-zero preflight, once-only owned worker, 45-second default/60-second maximum, SaveCopyAs/read-only reopen and conservative failure latch remain.

Existing `-CaptureTextFonts` fields are unchanged. Add runner `-CaptureTextProbes` only when the selected suite case declares `textProbePlan` as one sealed suite file. It requires `-CaptureTextFonts` and zero actions, refuses older workers, validates before output, snapshots/rechecks the plan and forwards worker `-TextProbePlan`.

Plan version 1 requires `schemaVersion`, exact input `archiveSha256` and `targets`. A target has `slideIndex`, `shapeId`, `shapeName`, literal full `text` and `ranges`. A range has `start1Based`, `length`, literal `text` and source `style` (`name`, finite positive `sizePoints`, `bold`/`italic` as -1/0). Unknown keys, foreign archives, duplicate targets, overlapping ranges, out-of-range indices and surrogate splits refuse before Office. Limits: 64 KiB plan, three targets, eight ranges, 32 total sampled UTF16 units, 4,096 source units per target.

Original/edited/reopened primary and TextRange2 full/range text must match exact UTF16. Selection drift stops the lifecycle. Whole and selected primary ranges report LanguageID, Font Name/NameAscii/NameOther/NameFarEast/NameComplexScript and size/bold/italic. Selected TextRange2 ranges report BoundLeft/Top/Width/Height in points. Missing/mixed fields remain explicit; source-style mismatch is an observation, separate from stale selection. Nonfinite native size/bounds refuse. Getter exceptions retain the original error and stop further COM operations or cleanup. Source/snapshot/action/probe hashes recheck before launch and across SaveCopy/reopen.

No mutation, proofing/direction setter, Unicode control or automatic retry is added. Fixed authored ranges do not establish native run boundaries, physical font files, correct glyph order, ink, clipping or visual fidelity.

## Object-model references

Documented getters: [Open](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentations.open), [TextRange.Characters](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.characters), [TextRange2.Characters](https://learn.microsoft.com/en-us/office/vba/api/office.textrange2.characters), [BoundLeft](https://learn.microsoft.com/en-us/office/vba/api/office.textrange2.boundleft), [LanguageID](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.languageid), [NameAscii](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.font.nameascii), [NameComplexScript](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.font.namecomplexscript).

## Validation and hold

Focused controls AST-extract actual helper definitions into plain managed mocks without evaluating the worker entrypoint or creating a COM class. They cover plan/refusal bounds, exact UTF16, mixed/missing descriptors, native style mismatch, finite bounds, getter-failure latch, source/snapshot mutation and sealed runner selection. Existing lifecycle mocks assert all four Open arguments. Existing runner preflight controls remain separate.

Exact local command logs, including the original generated-edit parser failure and its correction, are retained in the relay review receipt. No Office launch, COM attachment, UI, native cleanup, current producer export, goldens, remote CI observer, release or native visual acceptance occurred. Coordinator plus independent reviewer inspection and a later explicit one-case assignment precede native execution.

Initial validation: pinned Node 24.20.0 / pnpm 10.33.2; focused 45 pure/managed probe controls, existing lifecycle mocks and two runner preflight tests passed. Initial mapped run completed RED in 725.0 seconds: three sparse-input root-check failures plus an existing source-policy assertion that required the former visible Open. Its expected string now requires windowless Open and separately rejects the old form; the corrected managed control passes. All original logs and the 149 unrun package dispositions remain retained. Five exact missing tracked blobs (269,977 bytes) were restored without changing their Git identities. Complete package suffix/root-check replay is reported separately as composed coverage, never as a green original aggregate or final v0.34 acceptance.
