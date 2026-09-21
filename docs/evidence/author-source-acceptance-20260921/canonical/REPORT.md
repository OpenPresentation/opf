# App53 canonical production acceptance — 21 September 2026

**29/29 passed, one attempt each, zero retries, skipped, unexpected or flaky cases**, against `https://www.pptx.dev`. The run started at `2026-09-21T17:41:48.697Z` and completed in 113.497555 seconds. [Original browser log](browser.log), [all checked outcomes](outcomes.json), and [curated complete result report](results.json) retain the result. No further browser execution occurred during curation.

[Before](production-before.json) and [after](production-after.json) deployment receipts bind the same canonical alias to READY production deployment `dpl_hAEEDrxu746MBtDCHUh7z4bYaaLk`, accepted App53 commit `e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`. Its tree `64a0dbd702f43c87206c8a9fe16d06fe3ac68800` equals the reviewed `b33dc18e8c35803386feb80e7822f240a9671243` tree. This is canonical browser acceptance for the bounded source/keyboard correction, not merely a deployment READY status.

## Source and runtime

The [source record](source-before.json) was captured at `17:41:48.469895Z`, before the run. [After-run receipt](source-after.json) records a clean worktree with all 18 captured test/configuration/lock files unchanged. An independent [comparison](source-comparison.json) verifies every captured hash against current files and the accepted commit's Git blobs. The harness ran from the reviewed b33 head; accepted e40 has the identical tree.

The result records Node `v24.21.0` in its executed argv, Playwright `1.63.0`, one worker and Chromium configured by the captured Playwright config. The host was macOS arm64. [Post-run runtime inspection](runtime-after-run.json) retains the installed Chromium executable path/hash; it is not an actual browser-version observation. No new `browser.version()` measurement was made for this run. Windows CI and native Office/font evidence remain distinct.

The 29 cases include the original LF/CRLF categorical completion flow, five structural/stale completion cases, two keyboard controls, three raw-source/download cases, prior PPTX import/undo cases, Inspector lifecycle, overflow, font-note accessibility, security, offline worker/paste-formatting and YAML/Markdown controls. Every case has exactly one passed result, retry zero, and no recorded runner/test errors. Historical failures remain valid earlier evidence; this single passing run does not imply universal timing reliability.

## Exact saved downloads

All **31 saved actual download files** are retained unchanged: 30 OPF JSON files in cases 24–26 and one [Author PPTX](downloads/05/author-export.pptx). [Download checks](download-checks.json) independently validate the saved JSON bytes against the test's explicit oracles:

- 28 checks use the literal authored fixture, with only the selected title or duplicate-key transformation. They cover Author LF/CRLF and Inspector LF, unchanged preview reads, edits, exact undo/redo, canceled/no-op edits, pending-draft export and duplicate-key rejection/recovery. The LF flow additionally invokes the actual export handler without blur to isolate its synchronous draft-commit guard.
- The first reordered root import is checked semantically against its explicit input. Its accepted output bytes are captured for one exact redo check. Exact undo restores the preceding authored source. These two checks do not promise preservation of the incoming imported file's formatting.

The LF original is 325 bytes (SHA-256 `2e99a948a29cfb1d643f68d46e6afd913ec2f953d4d329e0faee8a7e3ca4a5ec`); CRLF is 332 bytes (`c40c5080ca23fb28e12398e7a35d3dac7859e7cc659b32a24133559119722608`). Source bytes retain whitespace, escapes, key order, number spelling, notes, metadata and rich runs outside the intended edit. Inspector CRLF is not covered by these three flows.

Other suite exports whose tests did not save files cannot be reconstructed; this set does not claim to retain every transport file generated during the run. The PPTX equals the reporter's decoded inline attachment and passes ZIP CRC, which is not a native PowerPoint compatibility check. Fifteen additional source/clipboard/worker observations are retained separately under `observations/`.

## Reviewed visuals and remaining limits

Five original PNGs from this exact run were visually reviewed:

- [Author LF rejection/recovery](screenshots/author-lf-rejection-source.png): duplicate-key source and the accepted pending title remain visible; the source-kept error is readable.
- [Author CRLF preview](screenshots/author-crlf-preview.png): latest pending title, the two-slide list and rich text appear in the recovered canvas. Byte checks, not the screenshot, establish CRLF preservation.
- [Inspector LF source](screenshots/inspector-lf-source.png): escapes and number spelling remain visible alongside the edited title, valid status and first-slide preview.
- [Completed LF categorical flow](screenshots/author-lf-categorical-complete.png): the final loaded layout appears in source and the inspector following the formerly failing third popup and exact undo/redo sequence.
- [Native suggestion details](screenshots/suggestion-details-clipped.png): Dark is selected and the native details panel opens, but most details are clipped at the editor's right edge. The keyboard guard does not change CSS; visibility does not establish legibility. This visual limitation remains open.

The passive readiness diagnostic is Windows-only and inactive in this macOS run. Separate successful premerge Windows CI retained an Author timing snapshot but **missed the Inspector/pagehide snapshot**; prior Windows readiness causation remains unresolved. Do not infer complete timing capture from this production result. The separately confirmed preset full-snapshot undo risk and other Author source writers are outside this change. Native/font compatibility, geometry drafts, optional worker preparation and the larger release goal are not completed by this acceptance.

## Evidence integrity and reproduction

[Inventory](artifact-inventory.json) records all 100 original result artifacts and their hashes. [Trace retention](trace-retention.json) identifies all 29 raw traces, which remain private; none are copied into this durable selection. [Archive checks](archive-checks.json) verify their CRCs and the retained PPTX. Five PNGs and the actual saved downloads are copied byte for byte; no raw JPEG is included.

The original reporter JSON remains private and its hash is recorded in `results.json.curation`. The curated result changes only the duplicate inline PPTX attachment body to the matching retained file path; all outcomes and configuration remain intact. [Copy provenance](copy-provenance.json) lists 56 exact original copies. `SHA256SUMS.json` covers all other durable files. Scoped `.gitattributes` preserves CRLF and other literal bytes.

The coordinating task supplied this exact executed command, from `/private/tmp/opf-author-source-fix-20260921/pptx-dev`:

```sh
OPF_APP_URL=https://www.pptx.dev PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/opf-author-source-canonical-20260921/results.json fnm exec --using=24 node node_modules/@playwright/test/cli.js test --retries=0 --trace=on --reporter=list,json --output=/private/tmp/opf-author-source-canonical-20260921/results > /private/tmp/opf-author-source-canonical-20260921/browser.log 2>&1
```

The original results directory and local curation script remain under `/private/tmp/opf-author-source-canonical-20260921`. This report does not replace the separate pre/postmerge CI receipts or claim overall-goal completion.
