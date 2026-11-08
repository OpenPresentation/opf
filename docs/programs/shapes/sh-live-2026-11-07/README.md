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

### SH-21 incremental Venn fit

Core `vennNodes(frame, count)` matches all circle and text rectangles of the 140 Basic Venn measurements with a maximum coordinate error of 0.000101 pt, well inside the unchanged 0.1 pt geometry gate. Counts one to four put text in their circles; five to seven use outside labels. The independent fixture retains all 140 original rectangles and the full corpus source hash. Tests also prove translation and explicit refusal of unsupported counts/invalid frames. This is a geometry helper only: schema/catalog/render/native tree wiring and final native editing qualification remain owed; no new arrangement is enabled by this commit.

### Preserved native attempts and current measurement limits

The coordinator's complete raw attempts are under [native/](native/), with [per-file SHA-256 and size manifest](native/manifest.json): baseline 01 (Open argument failure), baseline 02 (six safe controls, all seven source hashes unchanged) and tree witness 01 (E_FAIL at the first node text assignment). No Office process remained after each bounded worker. Inputs, snapshot scripts, worker records, logs and reports are retained without rewriting them.

Baseline 02 is a partial measurement: native controls report actual Source Sans 3, Meiryo East Asian and Noto Naskh Arabic complex-script faces and single paragraph spacing, but all three live records have zero GroupItems, so live text metrics were not captured. The known SH-19 probe first exports slides and opens visible/minimized presentation windows to materialize the live groups. This witness opened windowless and measured before rendering. A smaller read-only export/materialization control is needed before any shared baseline diagnosis or node-sync retry; the empty groups do not justify enabling or excluding a product domain.

The replacement baseline witness uses the proven read-only `Open(-1,0,-1)` visible/minimized window and exports each slide at its actual canvas size before reading GroupItems. A zero-item live group now fails the stage explicitly. `-BaselineOnly` performs no node synchronization or edits. PowerShell5 typed-Open and evidence-preservation controls still pass. Snapshot local-file SHA-256: `7fa12afb2f902a0eff39098793d0c2d5f19ca060a914b412062cc04b4b002d7e`. Native archive paths use `-text` attributes so Git retains their original byte hashes, including line endings.

### Materialized baseline 03 and spacing-only diagnostic pack

[Baseline 03 raw inputs, six PNGs, metrics and worker logs](native/sh20-baseline-03/) passed the safe lifecycle: six controls, seven unchanged source hashes, live GroupItems counts 8/4/4 and no remaining PowerPoint process. The append-only [new raw-file manifest](native/manifest-after-baseline03.json) covers all 59 retained files; the earlier manifest is unchanged.

The actual font slots match between each live/native pair: Source Sans 3; Aptos with Meiryo East Asian; Aptos with Noto Naskh Arabic complex-script. Live paragraphs use exact 43.92 pt pitch; native control line boxes use single spacing. Once the live group origin is added, first-line BoundTop agrees with the native control, while live versus native BoundHeight differs (Latin 45.815/43.2 pt, Japanese 50.55/43.2 pt, Arabic 42.67/43.2 pt). Those are raw line-box metrics, not proof of matching visible ink; the image gate still measures visible differences. Arabic also has a horizontal offset to diagnose.

[spacing-single/](spacing-single/) is a diagnostic pack, not an export or eligibility change. [spacing-variant.mjs](../../../../tools/shapes/sh-20/spacing-variant.mjs) refuses an existing output. It changes only `a:lnSpc` exact pitch to 100% single spacing in the active data and cached drawing XML of the three live controls; all other unzipped parts match. Its three native controls are byte-exact copies, and all source hashes remain unchanged. The coordinator can run the same `-BaselineOnly` guarded witness with Sweep set to `C:/opf-work/sh20-23-review/artifacts/spacing-single`, in a fresh attempt. This isolates paragraph behavior before choosing a source fix or requesting any domain change.

The full [acceptance task list](tasks.md) separates completed geometry/model/process controls from schema/render wiring, native editing, source PRs and final gates still owed.

Fresh SH-23 source/expected-table witnesses and the strict modified-state SaveCopyAs/reopen verifier are ready for coordinator review: [SH23-witness.md](SH23-witness.md).

### Single-spacing result: diagnostic rejected as a product change

The coordinator's [spacing attempt](native/sh20-spacing-01/) safely passed its six-control lifecycle and preserved input hashes. [Raw hashes](native/manifest-after-spacing01.json) append to the archive. [witness-gate.mjs](../../../../tools/shapes/sh-20/witness-gate.mjs) bridges sealed input copies and the actual exported PNGs to the original SH-19 gate; no metric or threshold is changed. [Original baseline scores](spacing-comparison/baseline03-gate.json) and [single-spacing scores](spacing-comparison/single-gate.json) retain every check.

| Native control comparison | Original exact pitch MAD / median text offset | Single pitch MAD / median text offset |
| --- | --- | --- |
| Latin cycle | 1.37 / 1 px | 3.89 / 8 px |
| Japanese matrix | 4.48 / 5.92 px | 5.82 / 20 px |
| Arabic matrix | 1.90 / 4.78 px | 1.90 / 4.78 px |

All three continue to pass shape rectangle, rotation, size and preview-geometry checks and fail the unchanged native pixel/text check. Single spacing moves Latin toward the preview but away from the accepted native control, and worsens Japanese strongly; Arabic's horizontal mismatch persists. Therefore no production change or domain adjustment follows from this experiment. Keep exact pitch and derive the shared first-line placement/font geometry before another targeted diagnostic. Per-locale magic offsets and lower thresholds are not accepted.

### Read-only SH-21 seed diagnostic

[seed-readonly.ps1](../../../../tools/shapes/sh-21/seed-readonly.ps1) reads the existing org-chart, hierarchy and Venn seeds after Export materialization, without creating a presentation, adding/synchronizing/editing nodes, changing layout, or saving. It records node parent/level/type/child counts and every materialized native shape, including unnamed Venn outlines. All COM collections are indexed; source and owned copy hashes are retained, the output must be fresh, and the existing failure latch prevents later Office calls after a failure. The coordinator must review and run it in the bounded owned worker. [Plan](sh21-seed-readonly-plan.json) and Windows PowerShell 5 offline evidence-preservation controls pass; no new native result is claimed.

[marker-variant.mjs](../../../../tools/shapes/sh-20/marker-variant.mjs) is a separate unrun diagnostic: ordinary native text controls write an explicit end-paragraph size/language while live SmartArt lacks that marker. It adds only that style to active data/cached drawing, retaining exact line pitch. No source default or eligibility is changed. This hypothesis needs a coordinator-owned native run before any conclusion.

### Dense wrapping explains the three geometry-hot failures

All three were visually inspected against both preview and native-text controls. [Raw PNGs, SHA-256 and exact gate/candidate records](dense-wrap-review/review.json) preserve them. The live Chevron Rows roadmap/feedback entries split their last word onto an extra line; the three-box vertical flow wraps its middle entry to three lines; the eight-box flow wraps its last entry to three lines. Each extra line extends outside its node into the arrow/gap, while preview and native text use two lines. The shape rectangles still match exactly. The unchanged geometry mask then counts the escaped text as visible difference outside its expected two-line rectangle; this is a real wrapping defect, not a reason to alter the mask or thresholds.

The existing eligibility predicates already refuse all three: unstable line breaks, unsupported count, and/or excessive text density. [All Latin OPF-definition candidates and per-design summary](dense-wrap-review/latin-candidates.json) show 30 currently eligible measured candidates and zero failures. No existing domain needs narrowing. This does not qualify broader designs or scripts; their shared baseline and wrapping work remains open.

### Organization Chart binary-fit model

The [bounded experimental model](../../../../tools/shapes/sh-21/org-fit-spike.mjs) reproduces all200 non-assistant Organization Chart node-rectangle measurements: five star counts and the2x2,3x1,uneven,depth3 and observed roots2 native topology, each in20 frames. Maximum point error is0.0000992pt; [every frame report](org-fit-spike.json) retains the exact residual. The shared geometry uses2:1 node rectangles,0.42h sibling gaps,1.42h row stride, contour packing and a0.5h hanging offset for the last non-root level. A bounded bisection returns the lower fit when its interval is at most0.002 times its midpoint. This reproduces the native binary quantization that ideal ratios miss. This is a model result, not live eligibility: connectors/paint, full Hierarchy geometry, parent data and native edits are still owed. The observed roots2 measurement is classified as the already reparented native tree, never permission to silently reparent an authored forest; the strict semantic helper still refuses forests. Assistants are not included in this result or native domain.

The read-only seed probe also records every indexed ShapeNode vertex/control point for freeform GroupItems. Hierarchy uses paired freeform foreground/background shapes, so rectangles alone are insufficient to reproduce its paint. This remains a read-only diagnostic; the coordinator must use the new exact script snapshot.
