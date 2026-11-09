# CE-20: editor startup face-selection work

This is an isolated continuation on `codex/ce-20-startup-performance` at `C:/opf-work/ce20-startup`. Fresh main954501658 was normally merged with integration6d5d61ed and frozen thumbnail sourcefc4f4380, yielding baseline `b3fea03d7abfee1217d586fa85d6061e0a659c4f`, tree `b10b65f386d070e76400e3c2e4cca02b4a88d3fb`. Runtime bytes match fc4f; their three-file difference is coordinator handoff prose.

## Confirmed regression and diagnosis

The coordinator reports CI42564468811/browser3job128987890142 atfc4f: large-deck rounds17020/17074/17036ms, median17036 above the unchanged16000ms CI limit. Sample rounds8002/7940/7967, median7967 below8000; work counts pass. This quoted CI observation is not a local raw-log claim.

The first local invocation stopped before navigation because the required Playwright Chromium headless-shell1248 was absent. That is a retained SETUP failure, not a timing result. The coordinator then installed the exact pinned dependency, without removing an existing browser. Ordinary workspace/editor and playground builds pass under pinned Node24.20.0/pnpm10.33.2. The ONE genuine unchanged local baseline fails on its sample:4779/4666/4648ms, median4666 above the original3200ms limit. Its first-preview counts are2decks/6slides/6designs/35strings; a one-slide edit adds exactly one slide/design/string. The maintained test stops at that sample assertion, so this run supplies no local300-slide benchmark timing. No rounds, limits, waits, throttle, quarantine, channel or executable settings changed.

Owned synthetic Chromium CPU diagnostics use the exact ordinary9817869-byte playground bundle, SHA-256 `d1ed169145c8b1f78b7ed65f8063b380d543b61f0c85b3572559bf570f5ae9e5`. An independently generated diagnostic source map maps byte-identical JS; no product or built file was rewritten for profiling. The browser and localhost server are newly owned and closed after each capture. No existing browser, Office or private data is accessed.

The first CPU capture included synchronous work after the first preview. Its later300managerSVGs must not be described as pre-preview work. A second bounded300-slide diagnostic records the DOM at the exact MutationObserver first-preview moment and aligns the V8 CPU profile to CDP NavigationStart. That proves:

| Observation before first preview | Diagnostic result |
| --- | --- |
| First-preview timestamp |11372ms; diagnostic only, not a benchmark round |
| Aligned pre-preview sampled interval |11362.469ms |
| Manager cards / manager SVGs |0 /0 |
| Filmstrip SVGs |1 |
| Canvas font gate → lazy face analysis |9344.232ms inclusive, about82% of the interval |
| lazy-fonts style settlement |5277.428ms exclusive, about46% |
| Core composition |2454.778ms exclusive |
| Font registry |1402.197ms exclusive |

The initial thumbnail hypothesis is therefore ruled out as the cause of this measured first-preview delay. Profiling implicates repeated face selection during actual layout fitting, including readableProse/composeVariant. Bidi direction before the existing shaping cache is a separate observed cost; it is outside this fix. Profiling overhead and JIT differences mean diagnostic times do not replace benchmark judgments.

## Vetoable CE20-STARTUP-FACE-SELECTION

The coordinator reviewed these findings before authorizing one narrow implementation. Memoize only successful face choices inside one `registryView` call, keyed by raw font family, raw `fontWeight ??400`, and boolean italic. The view owns its face pool/policy/aliases/fallback. Keep at most512choices, clear them at the bound, return a fresh `{...currentStyle, resolved family/weight/italic}` each time, and never cache errors. No global cache, whitespace trimming, full-style caching, deferred workload, geometry, font-registry, bidi, editor or benchmark change is included.

The real public `presentationFaces` regression uses valid rich runs and an instrumented ReadonlyMap alias lookup. Before the repair it performs1298lookups of the same requested family; the candidate performs3 for its regular/bold/italic choices and plans the same three faces. Other new controls cover changed faces/aliases/policy/fallback between analyses, raw-family whitespace, symbols/weights/italics, complete current styles/paths, returned-style mutation isolation, uncached unavailable choices and the per-view bound. Full-style inspection taps the existing renderer-to-analysis measurement handoff while preserving actual binding/drawing; no new production counter/export/test hook is added.

## Qualification and resume

Initial candidate build and the new controls pass. Required mapped checks, maintained font/lazy/script semantics, actual-output controls, a normal playground rebuild and ONE unchanged post-fix benchmark are next. If a strict limit still fails, retain it and continue diagnosis; do not declare the regression resolved or relax any assertion. Root owns final review, GitHub publication/CI and integration. No provider/API action, push, PR, CI dispatch, Office call, chart change, golden regeneration or release occurs here.

Raw setup/build/benchmark/profile logs and profiles are retained under the fresh `C:/opf-work/ce20-startup-diagnostic-01` output. A source-bound lossless packet and final qualification receipt will accompany the final handoff.

- 2026-11-09 UTC: Reproduced genuine strict local startup failure, retained the missing-browser setup refusal and driver import-owner setup diagnostic, ruled out pre-preview manager generation with exact-clock CPU evidence, and received coordinator approval for the single analysis-view cache.
- 2026-11-09 UTC: New public-work regression fails1298before and passes3after; all new semantic/freshness/error/bound controls pass. Qualification remains in progress.
