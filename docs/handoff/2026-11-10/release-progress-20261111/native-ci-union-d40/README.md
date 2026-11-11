# Native/document union gate and separate network replay

The selected obligations passed across the original maintained gate and one separate unchanged network replay. **The original aggregate remains RED: 9 PASS / 1 DNS RED / 1 unselected.** Its failure, raw log and receipt are preserved; the replay does not relabel it.

Both executions bind clean source `d40a0d6702d38a0a5f8d37269caa0666e3e6ae4b`, tree `e8ec0a4d1e9fc23eda3759a5a14c7c6fefb9abe4`. All 609 compiled package files were byte-identical before and after the original gate. The replay receipt independently records unchanged source and runtime. Node was pinned to 24.21.0; the retained original driver uses pinned pnpm 10.33.2, strict `OPF_TRACKER_STALE=fail` and the exact Node PATH.

| Actual execution | Result |
| --- | --- |
| `check:changed --base f73d20d5bc9570d3bd74cec61f79ce85b6013749` | Exit 1, 124.572s; 9 selected steps PASS, stability DNS RED, typecheck unselected |
| Native acceptance leg | 346 tests: 331 PASS / 0 RED / 15 Windows PowerShell skips; 13.1s mapper interval (12,935.044ms test interval) |
| Strict gallery tracker | 18/18 controls PASS; tracker current at 863 records, 313 unaddressed |
| Text integrity | 7/7 controls PASS; 18,262 files valid |
| Original stability leg | 19/19 local controls PASS, then public npm registry lookup failed with `ENOTFOUND` |
| One separate `check:stability` network replay | Exit 0, 36.793s; 19/19 controls PASS and published baseline comparison PASS |

The replay compared gallery 0.33.0 against latest gallery 0.33.0 with renderer 0.33.0: 284 renders; every existing record drew the same. It reported 36 existing layouts drawn, four new layouts, three themes, 14 color schemes and 89 font schemes, with zero existing drawing changes. Nine unchanged historical declaration warnings and the resulting minimum minor bump remain literal in its log. There was no registry-baseline substitution or warning suppression.

`original-gate-receipt.json`, `network-replay-receipt.json`, and the source records are copied unchanged. The two runtime manifests are losslessly gzip-compressed. `logs.zip` retains all ten frozen selected logs, original aggregate log, original stability failure and separate network replay; `frozen-selected-log-identities.json` is the original ten-file identity list, and `log-identities.json` binds every archive member. `run-driver.mjs.txt` preserves the original driver as documentation; this packet does not execute it. `manifest.json` binds all packet files other than itself.

The full 317 PPTX contracts, both full-only boundaries and both actual browser checks remain separately qualified at [f73](../ci-fixture-wave-checks/README.md). This native/doc delta did not repeat or rebind them. The earlier sparse tracker limitation is preserved in that packet; this later strict tracker PASS is bound to the d40 execution and its available input closure.

The 15 Mac skips do not qualify actual Windows PS5 execution. No new Office execution, process query, B07 image or private/raw Windows evidence is included. This is public metadata only; workstreams and burndown are unchanged. The metadata checkpoint itself awaits the coordinator's next maintained native/doc delta after integration of the independent stage-index source change. No install, build, test, check, CI or native command was run to prepare this packet.
