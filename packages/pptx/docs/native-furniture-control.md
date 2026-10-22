# Native furniture control

This bounded Windows control opens one explicitly supplied PPTX with one to three slides and at most thirty shapes per slide. It records original native state, saves an owned copy, applies zero to twenty prevalidated actions, records and saves the edited state, closes the exact owned presentation, reopens that exact path read-only, records the reopened state, and closes it. Each phase exports every slide to PNG.

The control is generic. Run each fixture and action plan separately so a failure cannot trigger an automatic retry or a second fixture.

## Action plan

The optional action plan is a JSON list. Unknown operations, properties, non-string payloads, non-integer indexes, indexes outside 1–3, and lists longer than twenty are rejected before Office starts.

```json
[
  {"op":"set-text","slideIndex":1,"shapeName":"OPF furniture 0 part 0 line 0","text":""},
  {"op":"set-alt","slideIndex":2,"shapeName":"OPF image 1","alt":"Edited alt"},
  {"op":"move-slide","slideIndex":3,"toIndex":1}
]
```

This short example applies directly to `baseline-inherited-local.pptx`. The other supported operations are `delete-shape`, `duplicate-shape`, `set-tag`, and `delete-tag`; select their exact existing preconditions in a separate plan. `set-text` accepts an empty string. `set-alt` writes `Shape.AlternativeText`. `duplicate-shape` requires a new name that does not already exist; PowerPoint's [`Shape.Duplicate`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.shape.duplicate) returns a `ShapeRange`, so the worker requires a one-item range and selects `Item(1)` before naming the copy. Shape and slide tags use the PowerPoint [`Tags`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tags) collection and its [`Add`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tags.add) and [`Delete`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tags.delete) methods. `move-slide` uses [`Slide.MoveTo`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.slide.moveto); later actions address the resulting current slide indexes.

Every shape action resolves exactly one current shape by case-sensitive name immediately before the action. Tag deletion requires one existing case-insensitive tag name. The thirty-shape limit applies independently to each slide, and a duplicate cannot raise its slide above that limit.

## Run one lifecycle

Use Windows PowerShell 5.1 and a new output path:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-furniture-control.ps1 `
  -OutputDirectory artifacts/furniture-native-inherited-01 `
  -InputPresentation ../../furniture-registry-03/decks/baseline-inherited-local.pptx
```

Add `-ActionPlan path/to/one-plan.json` for an edited lifecycle. Omitting it runs the same save, close, and read-only reopen cycle with no actions.

The parent starts one hidden owned worker through `test/native-process.ps1`. Its deadline defaults to 45 seconds and cannot exceed 60. The owned presentation is visible for supervised review.

Before any Office run, exercise the parser, action-plan validator, collection handling, and failure latch with the standalone non-Office checker:

```powershell
New-Item -ItemType Directory artifacts/furniture-harness-check-01
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-furniture-harness-check.ps1 `
  -ReportPath artifacts/furniture-harness-check-01/report.json
```

## Evidence and limits

`report.json` contains exact source, saved, reopened, verifier, process-helper, and action-plan paths and hashes; Windows and PowerPoint versions; action completion records; and original, edited, and reopened observations. Each shape observation records its identity, name, type, geometry, `HasTextFrame`, current `TextFrame.TextRange.Text` when available, alternative text, and every native tag name/value. Each slide records its identity, name, tags, shapes, and raster path/hash.

`inputs/` preserves the exact verifier, process helper, input presentation, and plan bytes. `stages.jsonl` appends a small `begin`, `success`, or `error` record around every COM call and important property access; `progress.json` holds the latest small durable stage. The full `report.json` is written at lifecycle checkpoints and on failure, avoiding repeated serialization of the growing observations around every COM call. `worker.json` records the exact helper process. `supervisor.json` records its terminal result. On timeout, the parent preserves the latest raw worker checkpoint as `report.worker.json`, combines it with the exact last durable stage, marks cleanup unconfirmed, and does not retry.

After any COM failure the worker performs no further Office operation. It never calls `Application.Quit`, kills PowerPoint or Excel, changes Office security, installs fonts, exports PDF, edits `p:hf`, discards user work, or closes an unrelated presentation. A timeout can leave the visible owned file open; inspect PowerPoint before another native run.

These observations establish only the selected finite native lifecycle and actions. They do not characterize arbitrary PowerPoint edits, general OOXML fidelity, native formatting reconstruction, or pixel equivalence. Controlled XML fixtures remain generation variants until a separately supervised native lifecycle acts on them.
