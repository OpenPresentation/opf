# Native resumption and current CI failures — November 9, 2026

This is a resumable evidence checkpoint for integration PR [#1225](https://github.com/OpenPresentation/opf/pull/1225), exact head 1ef0e17a58198defa34cd515ad7078d56a7d97d0. This evidence branch is **NEVER MERGE**. v0.33 is published; v0.34 is unpublished. The earlier CURRENT.md remains historical; this checkpoint supersedes its PowerPoint closure and CI-running observations.

## Completed native observation, with refusals retained

The owner said PowerPoint was closed. Global process inventory confirmed zero before any Office operation. Existing seven owned Roboto files/registry values matched the current sealed suite, but the fresh GDI availability check failed because Roboto was unavailable. No Office call followed that failure. Using the exact original reviewed helper, the coordinator cleaned only the old owned registration, created a fresh owned current-suite registration, and passed Setup and Check. All original states/logs are retained. No machine fonts or unrelated registrations changed.

The frozen producer remains clean at 2400d38bf549cdb661c31725776df25e497d364c; worker remains ce92ccc65d8cb40cc6532b2d9082e12202d6c283. Suite SHA256 remains fd13b7725ea3b76717ec6976c9e12a7f6df9db5135818120cc026fa54c9c5d65. No producer, worker, suite or runtime was edited.

One feature-metrics attempt ran with CaptureTextFonts and a 45-second limit. Worker completed successfully at 15:40:07 UTC: one slide, 15 shapes, zero authored actions, original/save/read-only-reopen observations, cleanupConfirmed true. This no-op case does not establish an edit.

The coordinator's immediate post-worker inventory still saw POWERPNT PID49464 at 15:40:08, so the outer shell command deliberately returned failure. That original exit receipt/error is preserved; it is not relabeled green. Subsequent read-only inventory at 15:40:37 and 15:40:51 found zero processes. Durable stages record successful presentation Close, zero-presentation check and Quit, followed by worker.complete success. No attach, kill, UI operation, retry or further Office call occurred in this packet.

The maintained Office-free text/geometry comparator passes all14 named text shapes in all3 phases at its unchanged0.02pt tolerance. All3 actual native PNGs are byte-identical, SHA256 b43827258933e4a7324b851bc3ea18063a490e89231ba2ace35338223391270a. Root viewed the actual native original and sealed OPF preview; no overall pixel-equivalence or physical glyph-file claim is made.

The separate font comparator fails before returning acceptance: native15 text-capable frames versus14 source text shapes. The extra exact source shape is decorative OPF card slides.0.blocks.3 with empty text and no-text font descriptor. compare-text already models this using source-bound emptyTextFrameNames; compare-text-fonts does not. A narrow separate tooling repair with negative controls is queued. Do not ignore all empty frames or change the frozen producer. This is a comparator finding, not an accepted native case.

The new owned font registration is ready at C:/Users/micha/AppData/Local/Microsoft/Windows/Fonts/opf-native-fd13b772-attempt01. Preserve the unchanged helper for eventual ownership-checked cleanup; no cleanup has occurred for that new registration.

## Current CI, collected with bounded calls

The maintained exact-head all-check gate9801 ended1. At the saved15:39 audit:

- Ordinary run42642820889 is terminal:32 job successes, editor browser1/3 failure, dependent verify failure.
- Full run42642923443 is incomplete. Known failures: Windows PPTX1/3 and Windows editor browser1/3 and2/3. Eighteen jobs were still running; do not infer their outcome.
- Slow run42642938002 is terminal. All3 published-matrix OS jobs fail, and cross-OS comparison fails because no completed digest outputs exist. Other selected jobs are retained in the saved full inventory.

Each of eight failing job logs was fetched once successfully and archived as the exact decoded UTF-8 string, retaining BOM and line endings. The three initial connector schema refusals used repository_full_name instead of required repo_full_name and returned no logs; they were corrected once. Separate normalized local inspection copies are not the archived raw bytes.

Confirmed diagnoses and assignments:

- B: Windows PPTX test expects unwrapped Central Directory text; PowerShell wrapped the same InvalidDataException. The malformed ZIP correctly refused before output/Office. New isolated test-only repair is being qualified; preserve typed error, nonzero exit and no-output assertions.
- C: Windows editor browser1/3 lacks the pinned WebKit executable although mobile-touch requires both Chromium and WebKit. Repair browser installation, preserving both engines.
- C: Ordinary YAML-paced worker budget50ms versus46ms and Windows studio drop p95460.3ms versus450ms remain genuine failed measurements under investigation. No budget or timeout was raised and no lucky rerun requested.
- A: Published consumer installation and type checks pass. The release-commit harness builds list-only diagram region fixtures with bullets, which binds as text. Exact failures are pairwise06/07 chevrons,20 vertical-flow,45 cycle, identical on3 OS. A current-driver/registry-consumer provenance policy is under review before any workflow change; registry latest0.33 is intentional, not version mixing. No fake0.34 pins, old-tag edits, diagnostic suppression or assertion relaxation.

## Decisions and next actions

Vetoable coordinator decisions: preserve the original failed attempts; use the reviewed ownership-checked font recovery; accept only the actual text/geometry comparison scope; repair explicit source-bound empty-frame handling; fix missing required browser installation; preserve all performance budgets and diagnose before changing code. Root owns Office and CI observers; agents must not operate Office or dispatch independent watchers.

Finish and independently review the three isolated CI repairs, the font comparator repair and remaining performance diagnosis. Batch approved repairs into integration normally, never push frozen folded leaves or force-push. Preserve managed golden3; these tooling-only repairs do not justify golden regeneration. Complete the remaining native cases, six explicit exclusions and physical RTL/proofing/SmartArt criteria; then the full final release gates.

Explicit chart reference-line representation approval is still pending. No referenceLines implementation or title-parser removal occurred. The owner's PowerPoint-closure gate is now satisfied as observed; check global zero before every new attempt. DEV secret provisioning, genuine E1 input, Claude connector/client-host save/local extension, D2, LibreOffice promotion and new login/DNS/account-plan/visibility remain separate. Existing authorization for deployments/native Previews persists.

Reproduce the archive seal with Node24: node verify.mjs. It checks all12 compressed archives, every raw byte/hash, all163 native packet members, actual lifecycle/geometry receipts, retained font-comparator failure and exact3PNG identity. It does not run Office, CI or an acceptance retry.


Metadata qualification: the first mapped attempt refused to purge a reused node_modules junction (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY), before build/tests. The first junction-target validation also refused before any mutation; its scalar Target handling was corrected. Only this task-owned junction was removed after verifying its target. Own pinned frozen OFFLINE install passed; the unchanged evidence source then passed5 mapped stages/typecheckSKIP31.3s. No CI override, shared integration dependency purge, parser/assertion change or original-green relabel occurred. metadata-validation.json.gz retains both raw attempts, install/hydration receipts and all completed selected logs. It was captured after qualification, not used as a pre-run input. node verify-validation.mjs checks this separate validation appendix as well as the original12 archives.
