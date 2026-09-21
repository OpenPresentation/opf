# App47 canonical production acceptance — 21 September 2026

**23 passed, 1 failed, 0 skipped, 0 flaky, 0 retries. Canonical acceptance remains failed.** This is one unchanged 24-case execution against `https://www.pptx.dev`, from 15:52:41.713 to 15:54:06.878 UTC (85.156 seconds). No production retry, extra browser probe, test edit or timeout increase followed the failure.

The pre-run and post-run safe deployment receipts bind the canonical alias to READY `dpl_5zdunyqiun7MgJNRJZ33CMHTrmmN`, accepted commit `0f35352a1445f56ad4bb7c9f4c5609e01f2dd9ae`. Tested commit `a5201c88a219262b21a6c7fd4ef49a01a5bbe0a3` and accepted commit have identical tree `203bdab509d05911f04f234d996f9c91f2b5e4f2`. All 15 input hashes remained unchanged and the worktree remained clean after execution.

Runtime: Node 24.21.0, Playwright 1.63.0, macOS arm64; installed Chromium headless shell revision 1243, Google Chrome for Testing 153.0.8010.12. Browser binary SHA256 `a0bfe7b4da4787b66058477d696cd1d09065d25f06a548947722b9af77ee8282`. Actual executable and launch arguments are preserved in browser.log; no browser/channel substitution. One worker, existing 45-second per-test timeout, existing 5-second assertion timeout, retain-on-failure trace. Storage state unset.

Command: Node 24 invokes `node_modules/@playwright/test/cli.js test --reporter=list,json --retries=0 --output=/private/tmp/opf-completion-production-20260921/results`, with `OPF_APP_URL=https://www.pptx.dev`, JSON reporter destination set and diagnostic `DEBUG=pw:browser`. The exclusive run-once runner, arguments, source copies, source hashes and before/after deployment receipts are retained.

## Remaining failure

LF categorical choice test fails at `author-json-options.spec.ts:118`, through `openChoices:56`, waiting for `.suggest-widget.visible`. The Dark theme and AAA Document Layout choices had already passed exact source apply/undo/redo. The third trigger attempted to reopen choices over `document-layout` before choosing AAB Loaded Layout; that choice and its LF undo/redo were not reached.

The trace records Go to Line `:11:18`, successful visible cursor assertion, and Control+Space at 5928.861ms. Visibility assertion runs from 5933.224 to 10934.577ms and fails after 5000ms. Monaco has its `focused` class after Go to Line and during the Control+Space action snapshot; the input target is the native-edit-context textbox named Editor content. The trace does not separately record document.activeElement, keybinding delivery or provider invocation/cancellation. The final saved frame shows valid source, selected document-layout, cursor 11:18 and no popup.

All 115 recorded network requests ended by 4225.487ms, before this third trigger; no recorded request failure or HTTP status >=400. No pageerror event is recorded; the sole browser-console message is Clerk's development-key warning. These facts do not establish a network or focus cause. The failed test's final pageerror assertion was not reached. Transient clipboard expect.poll iterations are not additional terminal failures.

## Passing scope and limits

All five new completion preservation cases passed: LF/CRLF structural choices, escaped current-value omission with existing undo history, stale/invalid source and catalog refresh, and format/document cancellation. The CRLF categorical counterpart, warm-worker paste/explicit formatting, font-note helper, Inspector source/undo/export/recovery, Author existing export/reimport, offline worker, hostile-string, toolkit, YAML/Markdown and long-quote checks also passed in this run.

Earlier app45 14/18 and app46 11/19 canonical results remain failed historical evidence. This run does not prove their readiness failures causally fixed. Native PowerPoint/font compatibility, broader Author canvas/preview-copy/JSON-download byte preservation, repair and geometry gates remain separate and unresolved. Issue88 and the overall goal remain open.

## Saved visual review

Reviewed all 15 captured PNGs (13 unique images; two LF/CRLF pairs are byte-identical) plus the exact extracted LF failure frame. The choices, compact/escaped source states, wide/narrow Inspector edits, strict-overflow recovery, visible Aptos-to-Carlito note and Author preview/export state agree with assertions. No additional visible defect was found in these captured states. This is bounded screenshot review, not native PPTX rendering or golden comparison. See screenshot-review.json for exact image paths/hashes and limitations.

## Evidence

- `acceptance-summary.compact.json`: all 24 exact titles, outcomes and terminal error; embedded PPTX body replaced with byte count/hash.
- `review/lf-trace-facts.json` and `review/lf-network.json`: sanitized saved-trace facts, focus excerpts and network timing.
- `review/lf-final-popup-missing.jpeg`: exact extracted final frame; `screenshots/`: original unique captured PNGs.
- `deployment.json` and `deployment-post-run.json`: unchanged canonical source/deployment binding.
- `prepared.json`, `run-started.json`, `browser-runtime.json`, `browser.log`, `source/`, `run-once.mjs`: reproducibility and exact inputs. Lockfile stays in original source archive with its hash recorded in prepared.json.
- `original-artifact-manifest.json`: original artifacts' paths, bytes and hashes; raw trace/reporters are retained locally, excluded from this compact selection. Original failed trace is 9,347,175 bytes, SHA256 `c512467d3b71c98f19b86efb69b573eb7f478c4bf220130e4c00db5ccb85d135`.

Original full run remains at `/private/tmp/opf-completion-production-20260921`; selected durable evidence is its `durable/` directory. Raw trace/network response contents are not approved for publication. No raw trace, large response body or inline binary report attachment is included in the durable selection.
