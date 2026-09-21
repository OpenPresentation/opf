# Native font edit control

This bounded Windows control verifies one actual PowerPoint text edit with the four pinned Carlito faces. It uses a separately generated immutable fixture directory containing `source.pptx`, `generation.json`, `LICENSE_FONT`, and exactly these four files:

- `fonts/Carlito-400-normal.ttf`
- `fonts/Carlito-400-italic.ttf`
- `fonts/Carlito-700-normal.ttf`
- `fonts/Carlito-700-italic.ttf`

`generation.json` must contain `source: {file: "source.pptx", sha256}`, `license: {file: "LICENSE_FONT", sha256}`, and four unique `fonts: [{file, sha256}]` entries using those literal paths. It must also bind `registration.flags: 0` and the exact title, body, and four span tuples below under `edit`. All hashes are lowercase SHA-256 values. The supplied `-InputPresentation` must resolve to that fixture's `source.pptx`.

## Parent-owned font lifecycle

The parent validates every external hash before creating a fresh output directory. It copies the source, generation record, license, four font files, verifier, `native-process.ps1`, and `native-text-fonts.ps1` into `inputs/`. It then dot-sources the two helper snapshots and calls `Invoke-OpfWithTemporaryFonts` around the 45-second worker.

The existing font helper calls `AddFontResourceExW` with flags `0`, broadcasts the font-table change, and removes exactly its own successful additions with matching flags in `finally`. Session registration is required because `FR_PRIVATE` would expose a font only to the calling parent process, not the separate PowerPoint process. The worker never registers or removes a font. `font-registration.json` and `supervisor.json` retain add/remove results independently of the Office worker outcome.

The parent reads the four-entry registration JSON by first assigning `ConvertFrom-Json` and then normalizing with `@($parsed)`. This avoids Windows PowerShell 5.1's inline pipeline-array nesting behavior. Each post-run input hash is caught and recorded independently so a missing or unreadable input cannot prevent `supervisor.json` from being written.

Use a maximum worker deadline of 60 seconds. There is no automatic retry. A timeout terminates only the worker process; the surviving parent still executes owned font removal. The supervisor always records Office cleanup as unconfirmed on timeout, regardless of the last durable stage. If a worker report exists, the parent copies its unchanged bytes to `report.worker.json` and does not rewrite either copy.

## Exact edit

The fixture is one 960×540 slide with exactly two named native text shapes: `OPF heading slides.0.title line 0` containing `Plain control`, and `OPF text slides.0.text line 0` containing `Current content`.

The worker changes the title to `Gate E - Carlito` in Carlito 30 point bold. It changes the body to this exact single paragraph:

```text
Regular 18 | Bold 20 | Italic 22 | BoldItalic 24
```

The whole body first receives Carlito regular at 18 points. Four exact `TextRange2.Characters(start, length)` spans then receive the requested style tuples: `(1,10)` regular 18, `(14,7)` bold 20, `(24,9)` italic 22, and `(36,13)` bold italic 24. Separators retain the whole-range default.

Each phase records only the bounded ranges needed for the control: two whole-shape ranges in original, edited, and reopened observations, plus four mixed body spans in edited and reopened observations. Every observation includes exact text, length, font name, size, bold/italic state, all four `TextRange2` bounds, shape type, name, and geometry. Native font sizes, range bounds, and shape geometry are explicitly converted to `double` when captured so Windows PowerShell 5.1 JSON retains the exact numeric value returned through the COM `Single`. The worker exports full-slide `original.png`, `edited.png`, and `reopened.png` images at 1280×720.

## Run and non-Office regression

Generate a fresh fixture with Node 24 and a separate registry consumer containing
core 0.11.0, renderer 0.9.0 and PPTX 0.9.1:

```powershell
node test/native-font-edit-fixture.mjs artifacts/font-edit-fixture-new PATH_TO_REGISTRY_CONSUMER
```

The generator refuses an existing output directory, resolves public ESM entries
inside that consumer, validates the OPF source, and binds its lock, package
manifests and resolved entry hashes. It checks the exact four Carlito 0.4.1 font
hashes and OFL license before copying them locally. It makes no Office or font
registration call. Keep these font programs local; portable evidence needs their
hashes and license, not copied TTF files. The binding does not cover every
transitive installed byte.

First exercise the actual wrapper, edit helper, post-close metric function, and parent terminal decision against fake ranges and native-style `OrderedDictionary` observations. The regression requires a positive result, rejects separate content, style, and greater-than-0.02-point persistence mutations, rejects a false metrics gate after a completed lifecycle, and treats timeout cleanup as unconfirmed. This command makes no Office, COM, or font-registration call and writes no evidence file:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-edit.ps1 -PureRegression
```

Then run one fresh supervised attempt:

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-edit.ps1 `
  -OutputDirectory artifacts/windows-resume-20260921/native-font-edit-01 `
  -InputPresentation artifacts/windows-resume-20260921/font-edit-fixture-01/source.pptx `
  -FontFixtureDirectory artifacts/windows-resume-20260921/font-edit-fixture-01
```

## Evidence and safety

The worker opens only the owned source snapshot after checking that neither the snapshot nor the future output is already open. It records the original state and PNG, applies the edit, records the edited state and PNG, then calls PowerPoint [`Presentation.SaveAs`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.saveas) with file format `24` and the explicit third `EmbedFonts` argument `0` (`msoFalse`). It closes only that exact saved path, reopens it read-only, records the reopened state and PNG, and closes it. Every COM read and write has a durable begin/success/error stage. COM failure latches Office operations off; the catch path writes filesystem evidence and performs no COM cleanup. The worker never calls `Application.Quit`, kills Office, retries, changes Office security, closes unrelated work, embeds a font, or exports PDF.

Content/style, edited-versus-reopened 0.02-point persistence, exact PNG equality, saved-byte stability, and all source/snapshot hashes are evaluated only after both owned native closes. The metric code accumulates maxima directly and does not project `OrderedDictionary` keys through `Measure-Object -Property` under Windows PowerShell 5.1. The parent reads the persisted report, records separate `officeLifecycleComplete` and `metricsGatePassed` values in `supervisor.json`, and exits nonzero with a specific post-close error if this expected-positive edit control fails. The actual cleanup record remains true when both closes succeeded; the parent makes no later Office call and does not retry.

This control establishes reported native family/style properties, exact text edit persistence, bounds, and full-slide raster stability on one host. It does not prove which physical TTF supplied every glyph, rule out fallback or synthetic styling, establish browser/native pixel equality, certify Carlito as an Aptos substitute, or test font embedding. The OFL license and OpenType embedding flags are provenance inputs; no font program or PDF belongs in portable evidence.

On September 21, 2026, PowerPoint 16.0.20326.20158 completed `native-font-edit-01`
in approximately four seconds. All four requested style spans and exact current
text passed; edited/reopened bounds had zero drift and PNG/saved-file hashes
matched. Both owned presentations closed, all four owned registrations were
removed, and all 20 external/snapshot input checks matched. Full original,
edited and reopened slides were reviewed without clipping. Separate real
dummy-worker failure and timeout controls also removed all eight owned font
additions. These results establish the bounded editability control only; actual
embedding and physical per-glyph identity remain unaccepted.
