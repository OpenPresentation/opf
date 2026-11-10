# RR-114 validation-only replay screening: formal03 complete

The five driver files are copied from the reviewed b6cd1205 formal02 driver. Only config.mjs candidate root/head/runtime changes: C:/opf-work/replay-fast at bcc7d76d7 (runtime23e579ac). Control remains exact276 at C:/opf-work/replay-control. The mirrored eight-child order,60s hard child cap/no retries, fixed16/36 inputs, three selected faces, first+two warm renders, CPU/wall/HWM/post-drop memory boundaries and exact SVG/font/file/license/module/WASM checks are unchanged. Candidate has already passed focused behavioral qualification and two source reviews; formal03 has now completed on that exact source.

The previous rr114-replay-performance folder, executed config, results and offline verifier are byte-for-byte preserved. Its formal01 setup failure and formal02 no-win result stay valid history. This is a new source checkpoint/preflight and fresh artifacts/replay-paired-formal-03 output lane, never a retry of an altered prior result. Root alone authorizes and launches a sole formal03 run in a quiet window. Do not fold any replay source or claim an improvement before reviewed measurement.

Source-only preflight: `node docs/handoff/2026-11-09/rr114-replay-validation-performance/preflight.mjs --out=artifacts/replay-validation-preflight-01.json`.

After explicit coordinator GO only, launch the frozen driver with `--measure --expect-driver-head=<full driver SHA> --preflight=artifacts/replay-validation-preflight-01.json --out=artifacts/replay-paired-formal-03`. Do not change source, deadlines, protocol or runtime worktrees midtrial. All results must be retained on this NEVER MERGE evidence branch.

## Completed formal03

Root session97110 actually exited0:8children/624exactSVGchecks. Continuous preparation→first median improves3.13%for36slides, while16 regresses0.95%; post-drop heap is effectively unchanged. No universal startup/RSS improvement is claimed. RESULTS.md and summary.json retain CPU/warm/memory caveats and raw vectors. The38-record lossless raw.json.gz packet preserves raw outputs/stdout/stderr/receipt, actual root log/exit, both source-only preflights and exact executed driver bytes. Run `node docs/handoff/2026-11-09/rr114-replay-validation-performance/verify.mjs` offline. Runtimebcc/23e remains frozen/unfolded until coordinator acceptance; no new experiment follows from this packet.

