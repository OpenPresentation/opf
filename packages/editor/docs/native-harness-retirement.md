# Native playground helper: retired, then replaced (RR-87)

The first `test/native-playground.ps1` opened the fixed fixture path
`artifacts/browser-evidence/export.pptx`, mutated the returned presentation and
closed it, without establishing exclusive ownership or a bounded worker
(ENG-X03-002). It was retired before any effect, and its earlier reports remain
as historical evidence only.

## The bounded owned-copy workflow

`test/native-playground.ps1` is now a bounded owned-copy workflow
(`test/native-playground-lib.ps1` holds its functions):

- It never opens the fixture. It hashes the fixture, copies it to
  `owned-input.pptx` in a fresh attempt directory
  (`artifacts/browser-evidence/native-attempts/<time>-<id>`, refused when it
  exists, so earlier attempts are preserved) and checks the copy hash.
- It refuses when the exact fixture, copy or saved path is already open in a
  running PowerPoint (`Assert-OpfPathsNotOpen`), before any Open call.
- The Office work runs in an owned worker process with a deadline
  (`Invoke-OpfNativeWorker` of the PPTX package, at most 60 seconds). A timeout
  kills only that worker, never Office, and is reported.
- Every Office call is a stage behind a failure latch
  (`Invoke-OpfNativeStage`): after one failure no later Office call is made, and
  nothing is closed or retried in place.
- It closes only a presentation whose `FullName` is the exact path this attempt
  opened (`Close-OpfOwnedPresentation`). Other open presentations are untouched.
- It writes `native-saved.pptx`, `native-slide.png` and `native.json` (input,
  copy, saved and after-run fixture hashes, the stages, what was closed) into
  the attempt directory. `node test/native-playground-verify.mjs <attempt directory>`
  reads those and reimports the saved file.

Only the root session runs it, on the Windows host. Agents run the offline
controls only: `test/native-playground-controls.mjs` (part of `pnpm test`; on
Windows it runs `test/native-playground-check.ps1`, which drives the workflow
with fake Office objects: ownership, an already-open path, the failure latch,
closing only the owned presentation, fresh attempts and the worker timeout).
Those controls create no Office process and establish no native acceptance. The
workflow still needs supervisor native review before its first run on Office, and
browser or package verification is never read as native acceptance.
