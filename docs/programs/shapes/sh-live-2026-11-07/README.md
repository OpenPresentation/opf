# SH-20 to SH-23 evidence continuation

Fresh source base: `d19c4bb6172b703d132ebba3fd006e4ec5cdf845`. SH-23 source reviewed and merged from `aee3d430f3dd4b0509e0b3851d8b1078f12d2b1f`; its interpreter/native-part acceptance test passes. Ninth-node edit/reopen qualification remains the coordinator's work.

The SH-19 gate was copied from evidence-only commit `b560fa82011b149609587cf5cbab3eb14e338d08`, `tools/shapes/sh-19/tools/gate.mjs` and `layout-xml.mjs`. Only the local build path and output location changed. Every rectangle, rotation, size, image and text threshold is unchanged. The gate reads the measured sweep and writes into a fresh directory; neither evidence branch was merged.

Measured inputs (SHA-256):

| Input | SHA-256 |
| --- | --- |
| sweep/ppt/probe.json | `a82b2b62589dfd205e46597243c139085e75af42542bd13a022de126e162b409` |
| sweep/ppt-shapes/probe.json | `827f52283d3beed76c832a9a8dfd8586a97cdd48a18f86d8bb0ebd2323aa1660` |
| sweep/meta.json | `f18280087d6f066ae11675fa414a5868561c393a99cfd9c1d9f00a114dcec9f0` |
| trees/trees.json | `3075099d4e7916a335c25c43016ac3569605538a1d6a054b0943ac3115e9693c` |

## Unchanged gate result

[gate.json](gate.json) and [gate.md](gate.md): 516 instances, 465 live, 201 passing and 264 failing the full gate. **All 465 live instances pass the node rectangle/rotation and font size tests.** Every failure includes the native pixel/text check; three also fail the paint/geometry check. No eligibility changed from these aggregate counts.

| Script | Live | Pass |
| --- | --- | --- |
| Latin | 399 | 193 |
| Hebrew | 15 | 4 |
| Arabic | 15 | 4 |
| Japanese | 18 | 0 |
| Chinese | 18 | 0 |

Reconstructing candidate facts with the published source's measured office fonts confirms every Latin instance **inside the existing SH-19 domain** passes. The newly excluded designs mostly have denser text or unstable wrapping. Candidate-specific domains require all measured instances in the selected domain to pass; existing thresholds will not be relaxed.

Representative shared causes to investigate: many short-label failures have a consistent live-versus-native vertical text delta of about one pixel with matching rectangles and sizes. The Japanese matrix witness has live text above the native control, and native text above the preview; glyph forms and node placement agree. The live paragraph uses exact pitch while the native control uses single spacing. The guarded witness below captures actual resolved font slots and paragraph metrics before any baseline correction is chosen.

## Tree measurement scope and vetoable format direction

[tree-corpus-scope.json](tree-corpus-scope.json) records all 580 measurements by layout and requested tree. Some requested structures were changed by PowerPoint: Hierarchy k1 has three nodes for two labels, depth3 has five nodes for four labels, the requested two-root forest is reparented, and Hierarchy refuses assistants. These are not proof of a valid forest/assistant fit. A second witness records actual parent/level/type facts, including empty default nodes.

Coordinator accepted these as vetoable design choices: region arrangements `org-chart`, `hierarchy`, `venn`; existing list-entry `level` represents a single-root tree's parent depth; Venn entries are flat. Malformed depth jumps and unsupported forests must be refused or retained by a reported fallback, never reparented or dropped. Assistants stay outside native eligibility until measured. OPF-owned explicit layout definitions must preserve parent/level semantics and qualify supported native edits; fixed rectangles alone do not prove an editable tree.

## Guarded witness for the coordinator

Source: [com-witness.ps1](../../../../tools/shapes/sh-20/com-witness.ps1). The script opens only copied inputs in a new attempt directory, hashes sources before/after, refuses an existing output or a running PowerPoint, uses the existing failure latch, closes only exact owned filenames, and quits only an empty owned application. After an Office failure no cleanup Office call is made. Parent must review and run through `Invoke-OpfNativeWorker` with a deadline; this worker never kills Office.

`-BaselineOnly` reads six copied control decks (live/native pairs of Latin cycle, Japanese matrix, Arabic matrix), recording each line's text bounds, Latin/East Asian/complex-script font slots, size, margins and paragraph spacing. Without that switch it first measures ten tree/Venn witnesses, including AllNodes parents, levels, node types, child counts, and freeform outline/control points, and saves editable derivative evidence.

Example envelope, run by the coordinator only (select fresh paths):

```powershell
. C:/opf-work/release-033-final/packages/pptx/test/native-process.ps1
New-Item -ItemType Directory C:/opf-work/sh20-worker-01 | Out-Null
Invoke-OpfNativeWorker `
  -ScriptPath C:/opf-work/sh20-23-review/tools/shapes/sh-20/com-witness.ps1 `
  -WorkerArguments @('-Seeds','C:/opf-work/_supervisor/com-jobs/sh-08/smartart-seeds.pptx',
    '-Sweep','C:/opf-work/_supervisor/com-jobs/sh-live-extras/sweep',
    '-Out','C:/opf-work/sh20-worker-01/attempt',
    '-NativeHelpersPath','C:/opf-work/release-033-final/packages/editor/test/native-playground-lib.ps1',
    '-BaselineOnly') `
  -OutputDirectory C:/opf-work/sh20-worker-01 -TimeoutSeconds 60
```

PowerShell parse check and [offline controls](../../../../packages/pptx/test/sh20-witness-offline.mjs) pass: plan reads all seven input hashes, creates no attempt/COM object, never crosses the fake Office boundary, preserves an existing output and refuses missing inputs. [Plan of actual inputs](witness-plan.json); no native run is claimed by this test.

API references consulted: Microsoft's [SmartArtNode members](https://learn.microsoft.com/en-us/office/vba/api/overview/library-reference/smartartnode-members-office) defines ParentNode/Level/Type, and [ShapeNode.Points](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.shapenode.points) defines freeform points. These are read-only facts, not imported executable instructions.

Baseline attempt 01 (coordinator, `C:/opf-work/release-033-artifacts/sh20-baseline-01`) failed at its first Open before reading slide content, with all seven input hashes unchanged. Cause: a control-loop variable used PowerShell's automatic `$input` name, so the stage scriptblock passed its pipeline enumerator instead of the copied filename. The variable is now `$witnessInput` everywhere, and the one Open boundary explicitly accepts/casts a string. The offline test executes the actual helper inside a pipeline under Windows PowerShell 5, with a fake Open method proving exactly one `System.String` path equal to the intended input and the exact read-only/untitled/window flags. The failed attempt is preserved; it establishes no product result. Replacement witness local-file SHA-256: `1ec91cdc79d975e46142fda5f0fbda90ec9e19da4cbafc9f915b81c197a1d86f`.
