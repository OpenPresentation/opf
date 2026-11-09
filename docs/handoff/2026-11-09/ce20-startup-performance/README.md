# CE-20: bounded face-selection cache for editor startup

Local startup and focused font qualification pass. The required source mapped run retains an unchanged Venn template key-list failure; its earlier sparse text-fixture setup failure has a passing recovery. Combined CI and the template-golden gate remain coordinator-owned. No release or overall integration acceptance is claimed.

## Source and scope

- Worktree: `C:/opf-work/ce20-startup`; branch: `codex/ce-20-startup-performance`.
- Fresh main `954501658` was normally merged with integration `6d5d61ed` and frozen thumbnail source `fc4f4380`, yielding baseline `b3fea03d7abfee1217d586fa85d6061e0a659c4f`, tree `b10b65f386d070e76400e3c2e4cca02b4a88d3fb`. Its runtime matches fc4f; the three-file difference is coordinator handoff prose.
- Qualified source: `9133596d3b0063b32d7b57ad39c545287cd269ee`, tree `0fe653e0e80a0ad806f143897ef12a7235306187`. Subsequent changes are evidence/handoff and the CE progress update only.
- The only runtime change is `registryView` in `packages/render/src/lazy-fonts.js`. The public-work regression, render changelog fragment and program/handoff records complete the five-path source change.
- Source proof binds the unchanged schema, core, PPTX, editor, font registry, benchmark/fixture, golden and CI objects. All text outside `registryView` is exact. No generated public asset, pin, lockfile, chart or geometry changes.

## Confirmed failure and causal diagnosis

The coordinator reported CI run `42564468811`, browser3 job `128987890142` at fc4f: large rounds 17020/17074/17036 ms, median 17036 above the unchanged 16000 ms CI limit. Sample median 7967 was below 8000; work counts passed. This is a labelled coordinator observation, not a locally downloaded CI log.

The first local invocation stopped before navigation because pinned Chromium headless-shell 1248 was absent. Its SETUP failure is retained. The coordinator installed that exact test dependency without removing an existing browser. Normal workspace/editor and playground builds use Node 24.20.0 / pnpm 10.33.2 and pass.

The ONE genuine unchanged local baseline fails on its sample: 4779/4666/4648 ms, median 4666 above the original 3200 ms limit. First-preview counts are 2 decks / 6 slides / 6 designs / 35 strings; an edit adds one slide/design/string. The maintained assertion stops before measuring the large deck. No limits, rounds, waits, throttle, quarantine, channel or executable settings changed.

Owned synthetic Chromium CPU captures map the ordinary 9817869-byte baseline bundle, SHA-256 `d1ed169145c8b1f78b7ed65f8063b380d543b61f0c85b3572559bf570f5ae9e5`. The diagnostic source map produces byte-identical JS without rewriting the built runtime. The first capture included synchronous work after the preview, so its later 300 manager SVGs cannot establish pre-preview cost. A further bounded capture aligns the raw V8 profile to CDP NavigationStart and records DOM state inside the first-preview MutationObserver:

| Exact first-preview observation | Diagnostic result |
| --- | --- |
| Preview time / aligned sampled interval | 11372 / 11362.469 ms; diagnostic only |
| Manager cards / manager SVGs | 0 / 0 |
| Filmstrip SVGs | 1 |
| Canvas font gate → lazy face analysis | 9344.232 ms inclusive, about 82% |
| `lazy-fonts` style settlement | 5277.428 ms exclusive, about 46% |
| Core composition / font registry | 2454.778 / 1402.197 ms exclusive |

This rules out pre-preview manager generation as the cause of the measured delay. Repeated face selection during real fitting is the dominant cost. Bidi direction before the existing shaping cache was observed separately and is unchanged. Profile overhead/JIT differences do not replace benchmark judgments.

## Vetoable CE20-STARTUP-FACE-SELECTION

The coordinator reviewed the diagnosis before authorizing this one optimization. Cache only successful face choices inside each analysis `registryView`, keyed by raw family, raw `fontWeight ?? 400` and boolean italic. The view owns its face pool/policy/aliases/fallback. Clear at 512 choices, return a fresh complete current style with only resolved family/weight/italic overwritten, and leave errors uncached. There is no global cache, family trimming, full-style cache, deferred workload, font-registry/bidi change or geometry change.

The valid public `presentationFaces` fixture performs **1298 → 3** observed alias lookups while planning the same regular/bold/italic faces. Other controls cover new faces/aliases/policy/fallback between calls, raw-family whitespace, symbols, weights and italics, full styles/current paths, returned-style mutation isolation, uncached failures and the bound. Style inspection taps the existing renderer-to-analysis measurement handoff while retaining real binding/drawing; no new production counter/export/test hook is added.

## Qualification

| Check | Actual result |
| --- | --- |
| New public-work regression | Genuine baseline red; candidate green |
| Normal candidate playground build | Pass |
| ONE unchanged post-fix sample benchmark | 1570/1580/1563 ms; median **1570 < 3200** |
| Same run, 300-slide benchmark | 4244/5463/4311 ms; median **4311 < 6400** |
| First preview / one-slide edit work | 300/300/35 → 301/301/36; both sample/large assertions pass |
| Actual output before/candidate | Six manager SVGs plus four canvas SVGs and four PNGs exact |
| Required source mapped run | Seven steps pass, expected TS skip; sparse fixture and Venn key-list failures retained |
| Mapped render prefix | 69 scripts pass, including historical all-example analysis, real font/browser/embedding/raster controls; key-list assertion stops at script 70, leaving 107 unrun |
| Remaining focused controls | `lazy-fonts`, `lazy-faces`, `script-fonts`, `script-fonts-auto`, `script-fonts-auto-robust` pass |
| Actual lazy-face coverage | 147 decks, 1020 faces compared, 769 planned files |
| Maintained text recovery | Pass after restoring one exact tracked 16102-byte fixture |

The full unchanged benchmark ends with `Editor startup budget holds.` and exit 0; there is no extra post-fix timing attempt or CPU rerun. Actual output comparisons use newly owned contexts and the real preserved baseline/candidate bundles. Representative canvas captures were opened and inspected; all four canvas PNG pairs are byte-identical. All owned browsers and servers close.

The protected golden failure expects Venn 5 long pages 5–7 while current fixture pagination has four pages. Its fixture/core/baseline objects are unchanged; no golden or assertion was regenerated or relaxed. Original mapped logs are retained separately before any later check can reuse its output directory. The missing text fixture and diagnostic driver import-owner refusal are preserved as setup diagnostics, not product bug proof.

## Evidence and resume

`files.json` binds 100 original artifacts to 90 unique lossless transports (34377327 raw bytes, 9122619 stored bytes). It includes raw CPU profiles/maps, both actual runtime bundles, builds, all genuine failures, the successful benchmark, original mapped step logs, focused recovery and actual output pairs. `receipt.json` names source/remaining gates. Run:

```sh
node docs/handoff/2026-11-09/ce20-startup-performance/verify.mjs
```

The verifier checks transport/source hashes, protected trees, precise CPU cutoff, real public-work red/green, strict benchmark settings/results, output bytes, recovery and evidence-only descendant scope. The original baseline profiles remain bound to b3fea; the successful candidate checks remain bound to 9133596.

Root owns independent review, pushing/publication, actual combined CI and maintained template-golden qualification. No provider/API action, login, push, PR, CI dispatch, Office call, chart change, golden regeneration or release occurred here.

- 2026-11-09 UTC: Reproduced the strict local failure; retained both setup diagnostics; profiled the exact runtime and ruled out the initial thumbnail hypothesis before changing code.
- 2026-11-09 UTC: Coordinator approved the bounded per-view cache. The public work regression fails at 1298 before and passes at 3 after; complete style/freshness/error/bound controls pass.
- 2026-11-09 UTC: Normal build, strict startup benchmark, exact actual outputs, historical font controls and focused lazy/script/text recovery pass. The protected Venn snapshot lock and combined CI remain explicit obligations.
