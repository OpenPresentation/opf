# Native font inventory (read-only)

`test/native-font-inventory.ps1` answers one question without editing anything: which font names does Microsoft PowerPoint report for an unedited presentation? It opens one owned snapshot read-only, reads `Presentation.Fonts` first, then the theme font slots and the Font2 slots of text ranges, closes that exact presentation and writes JSON. It never edits, saves, exports, reopens, embeds, calls `Application.Quit`, or terminates Office.

It is the E0 pre-edit baseline for the Aptos question in the [native font embed harness](./native-font-embed.md). The earlier Carlito-only embed attempt reported `Carlito` and an unexpected `Aptos` after its edits. If this inventory reports Aptos on the unedited fixture, the name comes from load-time resolution; if not, an edit introduced it. `-ControlDeck` supports the E6 control on any other deck.

## What is observed

In this order, on the owned read-only presentation:

1. `Presentation.Fonts`: `Name`, `Embedded` and `Embeddable` for every entry (at most 64). Nothing else is read first.
2. Theme font slots from the first slide master: `ThemeFontScheme.MajorFont` and `MinorFont`, `Item(1)` latin, `Item(2)` complex script and `Item(3)` East Asian `Name`.
3. For every shape on each slide (at most 2 slides and 10 shapes per slide): `Name`, `Type`, `HasTextFrame`. For a text frame: `TextFrame2.HasText`, the whole `TextRange2` text and its Font2 slots. When the frame has text, it also reads every paragraph (`Paragraphs(i, 1)`) and every run (`Runs(i, 1)`), each with text, start, length and Font2 slots.
4. The same shape observation for the first slide master's shapes.

Font2 slots are `Name`, `NameAscii`, `NameOther`, `NameFarEast`, `NameComplexScript`, plus `Size`, `Bold` and `Italic`. Bounds are 12 paragraphs and 24 runs per shape, and 24 paragraphs and 40 runs in total. Exceeding any bound fails the attempt after the owned close; the partial observation stays in `report.json`.

`report.fontLedger` summarizes where each name was reported: `presentationFontNames`, `slideTextSlotNames`, `masterTextSlotNames` and `themeFontNames`. For each of these it also lists names starting with `Aptos` (case-insensitive), sets `aptosReported`, and records whether `Presentation.Fonts` contains only permitted Carlito names. An Aptos entry is a finding, not a failure of this worker.

### Not observed

- Slide layouts, notes pages, the notes master, group members and table cells. Reading `NotesMaster` could create one in memory, so the worker does not touch it.
- `endParaRPr` has no COM object. For a text frame with no text, the whole-range Font2 read is the closest observation. A paragraph range covers its characters, not its end-of-paragraph properties.
- A reported name does not prove which physical font file drew a glyph, or why PowerPoint listed it. `Embeddable` says a font can be embedded, not that it is.

## Modes

| Mode | Input contract | Fonts registered |
| --- | --- | --- |
| default | `-FontFixtureDirectory` must be a canonical Carlito fixture (`generation.json`, four pinned Carlito faces, OFL license), and `-InputPresentation` must be its `source.pptx` with the recorded hash. This is the same contract as `native-font-embed.ps1`. | The four Carlito faces, registered for the session with flags `0` by the surviving parent (`native-text-fonts.ps1`) and removed afterward |
| `-WithoutTemporaryFonts` | Same fixture contract | None; `font-registration.json` must not exist |
| `-ControlDeck` | Any `.pptx`. It is hashed and snapshotted. `-FontFixtureDirectory` and `-WithoutTemporaryFonts` are rejected. | None |

Run the fixture both with and without temporary fonts to compare the two conditions.

## Lifecycle

The parent hash-checks the fixture, copies inputs into a fresh output directory (`inputs/`), and writes `request.json`. It runs one hidden worker process through `native-process.ps1` (45 seconds by default, 60 at most). On timeout it kills only that worker process, never Office. The worker refuses when the snapshot is already open in PowerPoint. It opens `Presentations.Open(snapshot, ReadOnly=-1, Untitled=0, WithWindow=0)` and requires `FullName` to equal the snapshot and `ReadOnly` to be `-1`. After the reads it confirms `FullName` again and calls `Close()` on that object only. It also checks that the snapshot hash is unchanged.

A presentation that is already open with a URL `FullName` (a cloud deck) is treated as not owned; the path comparison never throws on it.

Every COM access is a begin/success stage pair in `stages.jsonl`. A COM error records an `error` stage, latches all later Office calls and leaves cleanup unconfirmed. There is no retry and no close through a failed latch.

After any other failure while the owned presentation is open (for example a non-numeric COM value or a `FullName` mismatch), the worker makes one cleanup decision before its `worker.failure` stage:

- If no COM call has failed and `FullName` still normalizes to the owned snapshot, it closes that presentation once. It records `owned.presentation.error.fullName-before-close.get`, `owned.presentation.error.close` and `owned.presentation.error.cleanup`, and sets `cleanupConfirmed` to true.
- Otherwise it leaves the presentation open and records `cleanupConfirmed=false`.

`report.failureCleanup` records the outcome: `closed-owned-after-failure`, `left-open-com-latched`, `left-open-not-closed: …` or `no-owned-presentation-open`. The file contains a single `Close()` call, so `Close()` runs at most once per attempt.

Successful stages serialize `error` as JSON `null`: `Write-InventoryStage` keeps the error parameter untyped because a `[string]` parameter turns `$null` into `''`. The parent decodes `font-registration.json` before wrapping it as an array. This avoids the Windows PowerShell 5.1 defect where the earlier inventory parent read four registration rows as one.

`-PureRegression` checks all of this offline. It parses the worker's own AST, and every invoked member must be on an allowlist. The PowerPoint calls are `Open`, `Close`, `Item`, `Paragraphs` and `Runs`; COM property reads are member expressions, not invocations. The rest are named .NET helpers such as `Contains`, `Substring`, `GetFullPath` and `Sort`. Everything else is rejected, including `Add`, `AddTextbox`, `ApplyTemplate`, `ApplyTheme`, `Fonts.Replace`, `SaveAs`, `Quit`, setters, static `File.Delete` and dynamic member names. It also rejects process-kill commands, and member assignments or increments on anything but local report dictionaries. It requires exactly one `Open` and one `Close` invocation.

It also runs negative controls for each rule, the stop latch and JSON-null stage errors. It checks URL, empty and relative path comparisons, and five close-on-failure decisions: owned, COM-latched, other path, URL `FullName` and no presentation. The remaining checks cover the canonical fixture contract, registration array decoding, the Aptos ledger and the parent decision.

## Native commands (root only)

Carlito-only fixture, with temporary Carlito registration:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-inventory.ps1 `
  -OutputDirectory artifacts/native-font-inventory-01 `
  -InputPresentation PATH_TO_FIXTURE/source.pptx `
  -FontFixtureDirectory PATH_TO_FIXTURE
```

Add `-WithoutTemporaryFonts` for the same fixture without registration, in a different fresh directory. For a control deck:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-inventory.ps1 `
  -ControlDeck -OutputDirectory artifacts/native-font-inventory-control-01 -InputPresentation PATH_TO_CONTROL.pptx
```

Each command prints one JSON summary line (`passed`, `aptosReported`, `presentationFontNames`). Preserve every attempt and use a fresh directory for any new one.

## Offline audit

```powershell
node test/native-font-inventory-audit.mjs artifacts/native-font-inventory-01
```

The audit writes `audit.json` with exclusive create and refuses to overwrite it. It starts no Office, COM or font API, and it checks:

- Every snapshot and original hash, and that the snapshots match the reviewed `native-font-inventory.ps1`, `native-process.ps1` and `native-text-fonts.ps1` beside the auditor.
- The verifier's read-only source policy: one `Open(…, (-1), 0, 0)`, one owned `Close()`, and only allowlisted invoked members, the same list as the worker's AST check. The controls assert that both lists match.
- The worker outcome and the supervisor and progress records.
- The registration ledger: four canonical additions and removals in the default mode, no registration file otherwise.
- No outputs besides the expected evidence files, so a saved `.pptx` fails the audit.
- The report: `ReadOnly = -1`, exactly one owned open and one owned close, and complete observations within bounds.

It rebuilds the exact stage sequence from the observations and requires the recorded stages to match it one for one, with no error and with the owned path set only between open and close. It recomputes the font ledger from the raw observations and compares it. A passing attempt must have `failureCleanup` null. `findings` in `audit.json` repeats the observations and the ledger, and `findings.failureCleanup` checks a failed attempt's cleanup:

- `Close()` ran at most once.
- An error close happened only without a COM failure, after an owned open and with no earlier close, directly before `worker.failure`, with cleanup confirmed.
- A presentation left open has `cleanupConfirmed=false`.

Treat findings as evidence only when `passed` is true; `findings.failureCleanup` is a diagnostic for failed attempts.

## Offline controls

```bash
npm run test:native-font-inventory-controls
```

The controls cover the static policy (including `Add`, `ApplyTemplate`, `ApplyTheme`, `Fonts.Replace`, static and dynamic invocations, and parity between the Node and PowerShell allowlists), the pure regression (Windows), the font ledger and close-on-failure consistency. They build synthetic evidence for all three modes and check that an Aptos observation passes the audit as a finding. Negative cases include a SaveAs stage, a second open or close, a non-read-only open, an empty-string stage error, a wrong owned path, a missing run stage, a forged ledger, exceeded bounds, a timeout, a saved output, a stray registration file and an unremoved font. The CLI must refuse to overwrite `audit.json`.

On Windows, the controls also run the real parent and worker end to end against `test/native-font-inventory-mock.ps1`, an offline stand-in for the PowerPoint object model, in the fixture, control-deck, Aptos and already-open-cloud-deck (URL `FullName`) variants. They also run three failure variants and check the cleanup outcome of each:

- A non-COM failure while the presentation is open gets exactly one error close.
- A COM failure while open leaves the presentation open.
- An opened object with a different `FullName` is left open.

They run a temporary copy whose single `ComObject` construction is replaced, and they check that the copy contains no COM construction before running it. The audit of successful mock evidence must fail only with `com-construction`, so mock evidence can never pass as native evidence. The controls never register fonts.
