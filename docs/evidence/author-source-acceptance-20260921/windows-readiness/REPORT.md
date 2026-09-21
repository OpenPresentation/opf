# App53 Windows shared-load readiness failure

**The exact saved run shows late Inspector/shared-document readiness; it does not show a lost import or a security failure. No concrete initialization/hash-import race was found in this bounded source review.** No browser was opened, test rerun, budget changed, product edited, or CI retried.

App53 head `8c0dae19b339ef3fe6a06c1d2df9f96b31d4f575`, tree `ea1554f81afc162506e57ec88fe03f3d61d8c100`, failed [Application compatibility 35627445953](https://github.com/Data-Advantage/pptx-dev/actions/runs/35627445953). Linux passed. Windows Edge/Playwright1.63.0 passed 26/27; all three new source cases, all three existing reimport cases and both LF/CRLF categorical cases passed. The only failed assertion was `svg-security.spec.ts:48`, five seconds for the exact shared-load toast. No later security preview/import assertion ran.

## Saved trace facts

- Navigation completed at trace 227575.894ms; expectation ran 227606.021–232619.845ms.
- The early reviewed frame shows **Loading Inspector**. The final saved frame at 232341.512ms still shows the starter document and Monaco Loading, shortly before the deadline.
- The post-failure DOM snapshot at 232691.252ms contains **Untrusted shared document**, **Loaded shared deck from URL.**, and **Loading slide fonts**. The error-context accessibility snapshot independently includes that same imported document and success toast. The imported URL hash is retained. Thus the import did occur by the post-failure snapshot, after the assertion stopped.
- 41 network entries are retained: 31 completed HTTP200, 10 have unfinished status/time−1 at capture stop, and no recorded HTTP4xx/5xx. Deferred JavaScript chunks and a worker/bootstrap request are among the unfinished entries. The trace does not measure JavaScript evaluation/CPU duration or prove which dependency caused the delay. No network-cause conclusion is drawn.
- The toast was present after failure; this evidence does not support an explanation that it disappeared too early. The test remains failed, and no timeout increase is proposed.

## Source review and bounds

`app/inspector/page.tsx:5–14` dynamically imports PlaygroundShell with SSR disabled and a Loading Inspector fallback. Consequently browser load completion does not mean the Inspector shell or URL hydration is complete. PlaygroundShell begins with STARTER_OPF (`:128`), and its URL load is a mount effect (`:236–264`).

The source/format wrappers (`:134–144`) are stable callbacks. The URL effect uses an active flag and monotonically increasing revision, sets `urlLoadingRef` synchronously, and applies results only through its current revision. `hydrateFromUrl:1758–1797` captures the URL, awaits the shared hash decoder, then checks current revision before setting JSON format, replacing source and showing the toast. The handoff decoder reads the hash into a local value before decompression; there is no network call in that decoder.

The hash-sync effect (`:296–319`) waits 500ms, then rejects writes if cancelled, URL loading is active, revision differs, or the source URL changed. The editor-session hook tags source synchronization and avoids invoking the source bridge for those events. No code path in these reviewed initialization effects was found to overwrite a successfully loaded shared deck with the starter in this trace. The final snapshot agrees: it has the shared deck.

`acquireBrowserFonts` starts alongside URL loading but does not gate hydration or its success toast; it imports the PPTX module before fetching fonts. The final font-loading status is a separate incomplete preview stage, not proof of the shared-load delay. Source inspection cannot distinguish CPU scheduling, chunk evaluation, stream decompression, or browser/runner contention here. An actual performance profile or bounded stage observation would be required before a justified performance correction. No further runtime probe was authorized or performed.

## Preservation

The original downloaded artifact is retained outside this compact folder at `../artifacts/`; its exact GitHub artifact receipt, failed-step log, source hashes, trace hash, request summary, error-context and two reviewed original JPEGs are included here. Original test/runtime budgets and failure results are unchanged. This report is diagnosis only, not acceptance or permission to merge.

Commands: `gh run view 35627445953 --log-failed`, `gh api repos/Data-Advantage/pptx-dev/actions/runs/35627445953/artifacts`, `gh run download 35627445953 --name browser-failures-windows-latest`, source `rg`/`sed`, and Python standard-library ZIP/JSON/hash extraction.
