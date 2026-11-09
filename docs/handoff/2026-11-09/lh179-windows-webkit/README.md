# LH-179: provision the Windows mobile audit

Reviewed source producer:83ea32fb115f533d0fc105eac8e4764b3736dafd, tree2d52a073a8a70de390a5bffb4ccf7f71f8cd8f2c. This isolated leaf starts at fresh origin/main9545016583ccfa151077cda4d51043ac6505a140 and normally includes integration1ef0e17a58198defa34cd515ad7078d56a7d97d0. Worktree C:/opf-work/lh179-webkit; branch codex/lh-179-windows-webkit. No release or chart implementation.

## Confirmed fix and vetoable decision

Full CI run42642923443, job129248453244, refused mobile-touch-browser.mjs because pinned WebKit2370 Playwright.exe was absent. The Windows job installed only Chromium, while the maintained mobile audit defaults to Chromium and WebKit. Vetoable decision LH179-WEBKIT: install pinned WebKit only in the actual owning browser shard1/3; keep both default engines, all mobile scenarios, the complete matrix, existing pins, timeouts, assertions and performance budgets.

Shipping changes are only nightly.yml and the maintained workflow contract. The regression derives mobile ownership from the actual browser suite and reads its default engines, prohibits an engine override and checks provisioning in the owning shard. Genuine before RED: provision default mobile engine webkit. After:21/21 workflow tests PASS. No library, schema, lock, renderer, fixture or golden changes; packages[] fragment.

## Qualification and preserved failures

Required pnpm check:changed --base1ef0 finished exit1 in87.3s:10 steps PASS, one tracker step FAIL, types SKIP. The tracker test group was9/18 with missing historical sparse files, beginning with rr-20-pareto-series-scope/limitations.json; it did not reach a meaningful strict freshness verdict. Build, Biome, changes, CI scope/workflows, Playwright pins, release report, skill commands, stability and text checks passed. Original aggregate and all11 closed per-step logs are losslessly retained.

Automatic approval review rejected the broad hydration helper, then rejected a read-only-derived1843-file/45,340,055B exact tracker closure as outside this repair scope. Neither rejected restoration executed. The separately approved single16,102B painting-Linux.json.gz input was restored with exclusive write, exact tracked OID and unchanged index/status/HEAD proofs. No tracker regeneration, freshness override, parser change or indirect retry occurred. Root will run required checks later in its already hydrated integration checkout; actual Windows CI/mobile execution remains owed.

## Two timing diagnostics remain bounded

The ordinary Linux job checked GitHub synthetic merge d988e4d41b2355836c1fe02a8b3c39439a58f32e, merging1ef0 into954501; Windows Full CI checked actual1ef0. Preserve those producer identities separately.

Original Linux source-worker failure: YAML paced in-flight median50ms exceeds40% of115ms, while whole-edit median54ms passes85%. All12 checks were in the worker, with zero inline checks. Original Windows Studio failure: drop p95 of460.3ms exceeds450ms, while font work is1 slide/1 design/2 decks across30 commits. These are retained failures, not proven flakes.

Exactly one real local run of each unchanged benchmark was authorized. A first source-profile command failed before browser launch because Windows --import requires a file URL; the corrected URL was the first measured run. Own fresh standard Chromium156.0.8078.4, local pinned Node24.20.0 and CI=1 were used, preserving existing100ms/450ms controls. Passive CDP CPU/timeline collection and request/busy marks add overhead, so results are diagnostic only. All full patterns/formats and assertions remained unchanged.

Local source-worker run: PASS35.9s, YAML paced whole-edit median12ms/in-flight1ms,12 worker and0 inline checks. Local Studio run: PASS57.9s, selection p95 of19.3ms, drop p95 of228.8ms, same1/1/2 font work, filmstrip and memory checks PASS;51.0MiB after50 and200 edits. The original timing failures did not reproduce; no causal product fix, CI cure or general performance acceptance follows.

The local trace shows exact-source JSON scanner/clone work and a busy MutationObserver span that ends after synchronous response application. Its longest task in the first paced span is16.4ms, with15.8ms after the worker reply. This reveals a timing-boundary coupling to investigate, but does not establish misclassification of the original50ms CI heartbeat. No sampling, ratio, budget or runtime change is proposed from this observation alone.

## Lossless evidence and resume

raw-files.json seals53 original/derived files,80065016 raw bytes in6154166 compressed bytes. These include all three original CI logs, original local red/green/setup receipts, denied-restoration plan/reasons, source proof, both complete profile traces/CPU profiles and the exact diagnostic driver. The profiler captures are synthetic/local and public-safe.

Run the portable offline verifier from this leaf: pinned Node24 docs/handoff/2026-11-09/lh179-windows-webkit/verify.mjs. It checks every compressed/raw hash and12 protected Git objects, including entire packages/spec/pins and all timing/mobile test inputs, plus both shipping blobs. It is a leaf-scope assertion; companion integration changes require a separate exact ownership proof rather than weakening it.

Root owns source review, publication/normal folding and actual full-checkout/Windows CI qualification. Native execution, provider actions, release readiness and chart representation approval are not claimed.

Final metadata-only stage: producer da7a49a4bbfbd8ffad709978496c7b1c80d51a45, exit0/34.1s,5 selected steps PASS and types SKIP. Its7 raw logs/exit plus exact61-path qualified-input identity are sealed separately (8 files) and verified without overwriting the original source aggregate. Final evidence-only additions do not claim a new runtime qualification.
