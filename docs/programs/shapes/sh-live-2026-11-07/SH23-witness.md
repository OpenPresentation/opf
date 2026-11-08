# SH-23 fresh production witnesses

Five PPTX files start inside the current production live domain (pyramid8, matrix3, flow7, chevrons7, vertical-flow5). The coordinator's verifier prepares the owned in-memory input to eight nodes, edits its first label, adds the ninth, verifies all data/text/shape counts, fixed sizes and the interpreted ninth-table geometry, **SaveCopyAs the edited nine-node state**, closes only its owned input, reopens that saved derivative and verifies the same nine texts/geometry. It never reopens the original as a substitute for checking the edit.

Source and PPTX hashes plus independently interpreted eighth/ninth geometry are in [manifest.json](manifest.json). Two fresh generator runs reproduce all five PPTX files byte-exactly. [build-witness.mjs](../../../../tools/shapes/sh-23/build-witness.mjs) refuses an existing output. Files under this directory are fresh qualification inputs, not a native pass.

Parent-run verifier: [verify-ninth.ps1](../../../../tools/shapes/sh-23/verify-ninth.ps1). Use existing `Invoke-OpfNativeWorker`, a fresh output attempt and a60-second deadline. `-Only pyramid` selects one case for a small first run; use each of the five values for serialized workers or run the whole batch if bounded. `-PlanOnly` creates no directory/process/COM object. Opens are typed string paths, read-only, with a minimized visible window; materialization is explicit Export-before-probe. Every COM collection uses Count/Item. A failed stage latches off all later Office/cleanup calls. Sources and owned input copies are both hashed after the run. The saved derivative is separate and hashed in its successful row.

Example arguments for the reviewed worker envelope:

```powershell
@('-Manifest','C:/opf-work/sh20-23-review/artifacts/sh23-fresh-02/manifest.json',
  '-Out','C:/opf-work/sh23-worker-01/result',
  '-NativeHelpersPath','C:/opf-work/release-033-final/packages/editor/test/native-playground-lib.ps1',
  '-Only','pyramid')
```

Do not run while any PowerPoint process exists. The coordinator reviews the exact script hash before invoking the bounded worker. No native run is claimed at this checkpoint.

## First native result and shared alignment correction

[Raw pyramid01](native/sh23-pyramid-01/) is a structural pass and visual fail: its ninth node and edit survive SaveCopyAs/reopen, with maximum point error0.0000875pt and unchanged sources/owned inputs, but the added label centered while the existing labels start at the label track. It is not an accepted SH23 result. [Raw hashes](native/manifest-after-sh23pyramid01.json) retain the complete attempt.

Cause: source nodes had explicit data paragraphs with `algn="l"`; new nodes had none, and the layout's text algorithm omitted paragraph defaults. Microsoft documents the default as center and prescribes [parTxLTRAlign=l / parTxRTLAlign=r](https://learn.microsoft.com/ja-jp/archive/msdn-magazine/2007/february/create-custom-smartart-graphics-for-use-in-the-2007-office-system) for start-aligned custom SmartArt text. Shared LayoutStyle now carries alignment and every tx algorithm writes those native defaults (or ctr for centered designs), through all12 tables and the fallback. No post-edit script formats the new node.

Source regressions fail before the correction and pass afterward; eight focused core tests plus the existing five-design PPTX table test pass. The verifier now rejects a paragraph alignment mismatch and records/checks first-line positions from the interpreted text rectangles, with the existing SH07 1.5px text bound. The [fresh03 packet](sh23-fresh-03/) includes those expected text positions and new layout identity digests. It supersedes fresh02 only as the next qualification input; old evidence remains immutable. Coordinator review/native run remains owed.
