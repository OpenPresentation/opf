# RR-114 paired replay performance screening

NEVER MERGE this evidence branch. No formal measurement has run at this checkpoint. Both product runtimes are frozen in separate clean worktrees; this branch changes only the benchmark protocol and evidence.

The control is exact `276f339a68069dc11970d649092d6181c9feba38` in `C:/opf-work/replay-control` (runtime source `d2edd18ced67ea8370ae2d03f5f954d91ff9cb6e`). The candidate is exact `3360d18d0c0366b90ed0a746479097923b4acde3` in `C:/opf-work/font-replay` (runtime source `36c8eb798286fd8d30cc2a6cfe16e857d9338cde`). Both use presentation-aware Office/visual/scripts-auto loading and exactly the same three Intos faces. The original 131-face whole-pack result is historical context, not this trial's control.

The original integration checkout at 276 had stale/missing renderer dist modules, so its existing build was refused in a read-only setup audit. Root authorized the dedicated exact276 checkout; its locked offline pnpm10.33.2 install and normal Node24 core/gallery/renderer build terminated0 without source changes. The existing integration checkout was not rebuilt or changed by this lane.

## Fixed protocol

- Eight fresh Node24 children in this exact mirrored order:16 control,16 candidate,36 control,36 candidate,36 candidate,36 control,16 candidate,16 control. Two replicates per size/runtime;60s hard limit per child, no retries or adaptive changes. Stop and retain the first failure.
- Use the exact original16/extended36 accepted input bytes and manifest SHA. No fonts/measurement/product-function instrumentation. An import hook observes loaded file URLs only; hashes are read after all metrics. The shared core/gallery/spec, lock/workspace files, copied source/dist modules, built outputs and loaded dependencies are checked explicitly.
- After imports/input parsing, force GC once. Measure public `loadFonts` wall and process CPU, then render the first batch immediately without forced GC in between. Report preparation, first render, their component sum and continuous preparation-to-first completion. Before each of two warm renders, GC outside that render's interval.
- Capture current memory and true OS process maxRSS immediately after the first render and after both warm renders, before benchmark output hashing/JSON/storage. The common workload retains all three SVG batches until those observations; its final HWM is not single-render usage. Engine font/license integrity hashing remains part of the real preparation API.
- After render metrics are fixed, hash/validate all three batches. Null every SVG-array/string reference, force GC and record post-drop JS heap/current RSS. Fonts, deck, measurement caches and a small common hash vector remain. Only then read module/font/license/notice/available HarfBuzz binary identities or write JSON. No compression runs in measured children.
- Exact SVG hashes, face descriptors, font files/licenses/notices and shared dependency identities must match across both runtimes and every repeat. Whole tracked plus normal-untracked worktree cleanliness and exact heads/trees are checked before/after; ignored artifacts may be written.

This is a bounded local paired screening, not statistical confidence, physical-mobile qualification or an isolated font-allocation measurement. No cross-run absolute comparison with historical whole-pack time/RSS is valid: root found and stopped an unrelated Nov6 infinite Node normalizer before this new experiment, and the retained-output workload also differs. Its exact before/source/after records are preserved under `artifacts/root-background-normalizer-20261110/` and must be included in the final packet.

## Source validation and execution

`preflight.mjs` only hashes/checks source, builds and inputs; it never loads fonts or renders. `case.mjs` and `run.mjs` require explicit `--measure`. First run syntax checks, then a fresh source-only receipt:

```powershell
node docs/handoff/2026-11-09/rr114-replay-performance/preflight.mjs --out=artifacts/replay-preflight-01.json
```

After the coordinator reviews the frozen driver and explicitly authorizes the all-team quiet window, run once, substituting the actual frozen driver head:

```powershell
node docs/handoff/2026-11-09/rr114-replay-performance/run.mjs --measure --expect-driver-head=<full40> --preflight=artifacts/replay-preflight-01.json --out=artifacts/replay-paired-formal-01
```

Capture actual stdout/stderr/process exit. Do not run, retry, change a deadline or mutate either runtime before that authorization. Root owns interpretation, source integration and the coherent mapped/CI/native gates. No release or Office action belongs to this evidence branch.
