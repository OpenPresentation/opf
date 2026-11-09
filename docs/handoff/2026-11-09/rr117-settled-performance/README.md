# RR-117 settled browser comparison — preparation only

Evidence-only branch `codex/evidence-rr117-settled-performance`: NEVER MERGE. Production source is the reviewed RR117 correction at bee8d855, runtime5f5a, with the original d764 cache implementation. No formal timing has run from this driver yet. The coordinator reviews the frozen driver and grants the quiet execution window; user P0 work takes priority.

The successful original root harness under `artifacts/review-trial` stays unchanged. Preserve its build/entry/smoke driver, compiled bundle/receipt, HTML and smoke-01 JSON/screenshots as functional evidence. Coordinator observed actual exec75986 terminal0 through write_stdin; there is no external stdout log for that run and none may be invented. It proves full workspace/cache activity and complete cold-oracle equality across11 operations, not a timing baseline.

## Fixed comparison

- One identical candidate bundle in every case; cold control invokes the public panel.invalidate before each edit, outside the primary interval. No compiled distribution or product function is patched.
- Fixed1440×900 desktop, device scale1. Four size/CPU cells:16/1 cold→cached;36/1 cached→cold;16/4 cached→cold;36/4 cold→cached. Each mode/cell gets a fresh browser process. No physical-mobile claim.
- Warm-up round then three primary rounds: local title at slide0, the actual document-level numeric dataset cell, global deck name. The36 input has two real consumers of that dataset. Title0 and global metadata conservatively invalidate subsequent/all composition; do not advertise them as cache-hit wins.
- Settling includes workspace.whenIdle, review.whenIdle (the unchanged300ms debounce plus complete core audit and list update), document.fonts.ready and two animation frames. Core timing, script/task CPU, actual SVG calls/selection counts, long tasks, DOM and post-GC V8 heap are recorded separately.
- Full report and actual emitted SVG bytes must equal the same-phase opposite mode, outside measured intervals. Every phase also compares its complete report to public cold validate. The exact16/36 input hashes, all bundle inputs, virtual forwarder source, served resource hashes and bundle identity are frozen/checked. No retries are discarded.
- Cache logical limits are checked every phase. Cold edits must enter validation with0 retained entries; cached edits must enter with retained composition. This does not imply every retained entry is a hit.

## Retention observation

Separate36-slide CPU1 cold/cached sessions, outside primary timings: warm resources once, dispose, collect a GC baseline; then20 last-slide title edits with GC/cache checks every5; then4 mount/destroy cycles per mode. Dispose clears captured panels/checkers/latest input and SVG instrumentation arrays before heap sampling. Cleared cache entries/bytes, no remaining workspace DOM and stable prepared face count are checked. Heap/DOM/listener observations are reported without an arbitrary pass threshold. This short soak is not leak qualification.

Setup/mount has a fixed90s deadline, phases30s and trace completion15s. Forwarder/observer/trace overhead is symmetric and disclosed; no unperturbed-production claim. Hashing, oracle work, controlled GC, screenshots and storage/compression remain outside primary intervals. Timeline traces are retained for formal cases; setup and warm-up remain distinct from primary edits.

`build.mjs --out=artifacts/review-paired-build-01` creates a fresh independent harness. `run.mjs --smoke --build=... --out=...` is functional only, with one edit round and a shortened3-edit/1-cycle retention check. It must not be summarized as a performance result. Formal `--measure` runs only in the coordinator-authorized quiet window after review. Fresh output directories are required. All completed source/results must be pushed and sealed on this evidence-only branch.
