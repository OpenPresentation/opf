# Historical T06/T09 evidence index

This portable index strengthens traceability only. It does not reopen accepted 40/40, rerun an old release, or create a new gate.

## T06 — renderer release prerequisites

At immutable renderer 0.18.1 publisher `d4259333a1105ce54d136ced0635f086d0f750ee`, `.github/workflows/ci.yml:63,229` contains exactly two `golden-override: ''` inputs. These are committed workflow inputs; a historical process-wide environment dump was not retained and is not reconstructed.

The runner default (`test/golden.mjs:14–16`) selects `opf-examples-png.cover-centering`, whose committed `_baseline.json` records 127 decks and source digest `20da988227cb90ad9a1f04185981f83d24c0afee7c9070d7b84e55fe7895e71b`. Pure offline canonical JSON hashing of the 127 example sources at genuine core 0.18.3 publisher `d52fa6ce499ad750bfc1b237dc4ae1abb0303d4c` independently reproduces that digest; the core rr-71 reviewed golden records the same source. No pixels were rendered.

The retained [exact release-commit gate](render-retry-release-commit-gate.log) confirms 6/6 before tagging. [Trusted publication](render-tag-execute.log) and [independent verification](render-independent-verify.log) bind publisher/tag/SLSA/signatures. These are retained execution outcomes, not a new environment observation. The similarly named renderer `opf-examples-png` baseline is an unrelated 126-deck/cbd0 corpus; do not confuse it with the actual default.

## T09 — actual Editor #154, then separate #157 repair

[Original gate](patch-prerequisites-final-gate.log) preserves the failed package retry, then lines18–19 prove 3/3 green, confirmation and actual merge `4c29be041bb3b4ea67b4b086e69c13395542377c` at 05:23:28. Immutable manifest/lock source proves all six changed test-font pins match renderer 0.18.1 peers and lock URL/SRI: JP/KR/SC/TC 0.4.4, color-emoji 0.4.7, emoji 0.4.8. Exact #154 packed source selects the genuine published renderer’s font peers and asserts its resolved identity; it does not silently follow unrelated development pins.

[Separate #157 gate](patch-prerequisites-next-gate.log) lines21/24 proves 4/4 confirmation and merge `b2c9bab8a58b17ec3aa10c6360c0870067943986` at 05:55:37. Its two paths add npm 11 CI setup plus fragment; it is distinct from #154 font/package/packed changes. [Earlier canceled #157 outcome](release-retry-batch-gate.log) remains preserved. [Supplementary packed log](editor157-merged154-packed.log) records 123 byte-matched files/23 models/offline browser and signature checks, but its filename/editor 0.18.0 version alone is not treated as a complete source-head binding.

`source-log-index.json` supplies immutable public source URLs, Git blob IDs, every source/log SHA-256, exact excerpts and six lock identities. Local provenance is portable through the relative log copies. No API, test, native run, release, source edit or canonical status change occurred.
