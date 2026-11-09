# Browser SVG baseline — 16 and 36 slides

Evidence only; NEVER MERGE. No product optimization, release, deployment, native acceptance or real mobile-device qualification.

The once-only formal matrix exited 0 in owned session 38536: six cases, six warm rounds and eighteen measured rounds, 264 UI operations, and no retry or operation failure. The 24 chart-definition rows are metadata. The lossless archive retains all six traces, twelve screenshots, measured JSON, exact served assets, source/module receipts and earlier setup failures. The first smoke failed before editor mount because the driver assumed inline chart data; the corrected functional smoke passed. Both are excluded from statistics.

Runtime: `58e0d7939fc318119f5f81a8ba1455bbfab7f1cd`. Input checkpoint: `6b522ccf547f60dafd3621910e7c032de7764e64`. All 572 bundled input hashes remained exact. Original and extended inputs retain their approved hashes and sizes (48,696 and 98,976 bytes); the first sixteen slide objects are unchanged. Attached document content was treated as data.

Each median below uses three repeated samples after separately recorded cold/warm setup. Values are seconds.

| Case | Mount | Sorter | Local title | Shared chart edit | Metadata |
| --- | --- | --- | --- | --- | --- |
| Desktop, 16 | 0.959 | 1.608 | 0.114 | 0.356 | 0.357 |
| Desktop, 36 | 2.267 | 3.225 | 0.172 | 0.706 | 0.691 |
| Desktop CPU 4×, 16 | 4.613 | 7.835 | 0.417 | 5.492 | 5.438 |
| Desktop CPU 4×, 36 | 11.199 | 15.636 | 0.693 | 10.794 | 10.832 |
| 390px CPU 4×, 16 | 4.567 | 7.754 | 0.422 | 1.812 | 5.320 |
| 390px CPU 4×, 36 | 11.090 | 15.475 | 0.715 | 3.157 | 3.221 |

The real full editor includes source editing, review and slide chrome. Cold desktop 36-slide mount was 3.067s; its CPU 4× counterpart was 22.596s. The sorter generates every thumbnail: 103,867/226,680 shared-font SVG bytes for 16/36 slides. All 624 per-slide sorter comparisons match accepted server `batch-system` SVG bytes and SHA exactly across every case and round. This does not compare standalone font-embedded SVG.

The maintained browser loader starts with Roboto 400 and lazily loads Intos Regular, Bold and Display Bold. It does not eagerly load Node's office pack. All 60 requests were owned localhost GETs, without cookies, authorization, external requests or page errors. The exact served open font files and OFL licenses are retained; no system/private fonts were accessed.

A local title edit requests two SVG outputs (canvas and thumbnail), not all slides. Chart editing changes `datasets.video-playback.rows.0.1` from 33 to 34, shared by one chart in 16 slides and two in 36. The append operation replaces the exact 16-slide input with the exact 36-slide input; median desktop time is 0.705s, or 11.016s at CPU 4×. Adding slides legitimately updates `deck.slideCount` footers.

At desktop 36 slides, sorter renderer time is 1.621s of the 3.225s interval, while layout is 6ms. Shared-chart renderer time is 86ms of 706ms. At CPU 4×, sorter renderer time is 7.869s of 15.636s, and shared-chart renderer time is 379ms of 10.794s. The exact trace locates a 7.478s review-panel refresh timer during the latter edit, including full validation and list rebuilding. This is a profiling target, not a demonstrated optimization.

Readiness uses `editor.whenIdle()`, `document.fonts.ready`, a timer turn and two animation frames. `whenIdle()` covers the editor redraw, not the independent 300ms review debounce. Faster phases can finish before review; slower phases can include it. Deferred work may occur between phases or in a later interval. The table therefore describes observed redraw-ready intervals, not guaranteed settled-review latency. Repeated identical edits may also hit the existing continuation cache; first-edit calls remain separately recorded.

Instrumentation and scope limits:

- Forwarding wrappers, observers and trace collection add overhead. SVG hashing and controlled GC occur after each measured interval. CDP `DevToolsCommandDuration` includes invoked product work; it is not pure tooling overhead.
- `firstSvgMs` records SVG DOM insertion, not physical paint. Complete trace events can nest; event totals across names are not exclusive CPU.
- Heap values are post-GC browser JS heap, excluding browser/GPU RSS. Normal desktop 36-slide post-metadata medians are 35.2MiB, 6,463 DOM nodes and 3,641 SVG descendants. Some mobile proxy samples retain more transient objects; three rounds do not establish a leak or a cache bound.
- The 390×844 viewport and CPU 4× are desktop Edge proxies at DPR 1, without mobile/touch emulation. No real iPhone, GPU or network claim.
- Original content warnings remain: the 36-slide input reports 46 missing-icon warnings and two notes. Authored footer placeholders are visible. Image review confirms the editor, sorter and data edit; this is not complete slide-content acceptance.
- Server checkpoints are separate whole-process measurements: root reports 131 default office faces, setup RSS 187.7MiB versus overall 436.8MiB. The entire peak must not be attributed to font loading alone.

Vetoable decision: retain this baseline and profile review/validation plus repeated text/font work before choosing a product optimization. No validation or cache rule was bypassed.

Replay offline:

```sh
node docs/handoff/2026-11-09/svg-browser-performance/verify.mjs
```

The archive preserves the original setup failure and exact source identities. The maintained metadata-check outcome is recorded separately; no new browser run is required to replay this packet.
