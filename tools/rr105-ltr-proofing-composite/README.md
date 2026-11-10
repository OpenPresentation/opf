# B07: LtrRun followed by authored Arabic proofing — source-only diagnostic

NEVER MERGE. This tool is a new diagnostic hypothesis, not a product patch or a native/glyph acceptance claim. Default invocation prints a source plan only. No suite preparation, ValidateOnly, PowerPoint/COM, export, render, font registration or native execution has occurred or is authorized by this source checkpoint.

The exact original09 is retained: 101027 bytes, 147 ZIP parts, SHA256 `4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2`, historically exported by `473d3fff623bda3f191ae2669824f1b02a5d90f8`. Its source, original archive and CLI preview are historical reference bytes. They are not newly generated or current-runtime output. The prior zero-action character worker `496cac197b1c57c03b4529065f91bb205dc0bf2f` and the one-call oracle `d7ba4e11cc1a7369e63c20924593e5dbefba5357` are byte-bound derivation references, not merged branches.

The one-call oracle failed when primary LanguageID changed from 1025 to 1033. Its failure before edited capture/SaveCopy remains a failure. That attempt did not perform a language restoration. The separate character observation found the failing paragraph already LTR, source/saved whole-body XML unchanged, and the actual first-line Latin ordering still bad. Another paragraph-direction setting, a:rtl=0, numeric partition, complex-script font contrast or proofing-inheritance trial would repeat rejected routes.

This new closed composite tests whether two independent documented APIs can jointly persist the desired state. Microsoft documents [LtrRun](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.ltrrun) as setting range LTR direction, and [LanguageID](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.languageid) as the read/write proofing language. It does not promise the operations commute. Assigning 1025 may reproduce the bad ordering. That would reject this hypothesis, not justify English proofing or a weaker acceptance criterion.

## Closed sequence

1. Admit only the exact original archive, one slide, three exact shapes, CaptureTextFonts, the unchanged 45-second bound and one exact action: `ltr-run-restore-ar-sa`, slide1, `OPF list slides.0.items line 0`, native ID3. The other two shapes remain controls. Survey mode, any other input/operation/property/target, empty/multiple actions and alternate caps are refused.
2. Observe the original phase first. Exact ordinal UTF16, primary1025, uniform name/size/bold/italic and geometry/identity of all three shapes are required. Existing paragraph observations and ten fixed character samples remain.
3. Read and persist a typed primitive before snapshot, then perform exactly one `TextFrame.TextRange.LtrRun()`. Persist successful completion before continuing. Read and persist the complete intermediate snapshot before classification. Only intermediate primary1025 or1033 is declared; mixed, missing, strings or other IDs refuse. Exact original text, font descriptors, geometry and identity must still hold.
4. Only after successful call, getters, primitive receipt writes and intermediate invariants, make exactly one literal `range.LanguageID=1025` assignment. This is the second declared operation, never failure recovery. Read and persist final actuals; final1025 and all original invariants are strict. Recheck all three shapes before SaveCopy.
5. Keep inherited SaveCopy, edited capture, Close, read-only reopen, reopened capture, Close and verified-empty owned Quit. All three phases retain exact primary1025/text/font/geometry/identity, nine named primary-language observations and thirty fixed character samples. No hidden Unicode, font mutation, English fallback, UI, alternate API, retry or cleanup after failure is added.

Every new COM/getter/setter or receipt I/O failure latches `officeOperationsStopped=true`, `cleanupConfirmed=false`; no later Office call, restoration or cleanup follows. Primitive journals store bounded strings, finite numbers, integer types or explicit unavailable/type classifications, never live COM proxies. A final wrong state is retained before refusal. `completed` is false after any composite failure.

In-memory-only visual improvement is not a fix. A later explicitly authorized native diagnostic must inspect all original/edited/reopened PNGs and saved OOXML, with exact authored proofing/Unicode/editability, source/font/geometry guards intact. Physical glyph/font-file, current-runtime and release acceptance remain false.

## Source controls and future admission

`managed-check.ps1` extracts only named functions from the actual worker AST and runs managed fakes. It never executes the worker entrypoint. It faults every new explicit getter/call/setter stage, every action report-write ordinal and every stage-journal position; wrong intermediate/final text, font, geometry, IDs, proofing, order and repeated calls refuse. `character-check.ps1` separately retains the 23 prior fixed-character controls and function-hash comparisons against the exact496 worker. The full lifecycle entrypoint, parameter block, process helpers and legacy ownership/latch functions remain byte exact.

```powershell
# PURE controls only, with installed Windows PowerShell5 stock modules resolved.
node --test tools/rr105-ltr-proofing-composite/prepare-suite.test.mjs
powershell.exe -NoProfile -NonInteractive -File tools/rr105-ltr-proofing-composite/managed-check.ps1 -ReportDirectory C:/opf-work/<fresh-pure-output>
powershell.exe -NoProfile -NonInteractive -File tools/rr105-ltr-proofing-composite/character-check.ps1 -ReportDirectory C:/opf-work/<different-fresh-pure-output>
```

A future reviewed preparation requires literal `inspect`/`prepare`, full40-character reviewed SHA, distinct clean same-head driver and worker checkouts, separately pinned unchanged ce92 controller and a fresh absolute disjoint output. It binds historic generation, new driver, new worker and unchanged controller independently. All reference/code hashes are checked before and after copying. It copies the original bytes and exact one-action plan; it does not export or authorize execution. No preparation or controller command has been run here. Root plus peer source review is required before any source push; actual suite/ValidateOnly/Office require separate root authorization.

Final pure source controls: Node6/6, managed481/481 (112 new COM stages,186 action-report writes,147 stage-journal positions), inherited character23/23 with49 protected-function checks and147 original ZIP parts. All native/current-runtime/physical-glyph acceptance remains false. Initial harness-only stage-selection/parser and inherited PSModulePath failures are retained in the handoff; they are not relabeled as passing runs. Attempts and successfully returned calls are separate report fields. No operation is inferred successful after a receipt failure.
