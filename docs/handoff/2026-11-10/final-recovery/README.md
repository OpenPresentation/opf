# Final handoff recovery — NEVER MERGE

This branch preserves seven reviewed local-only files, byte for byte. It is **unqualified evidence**, not a product change, native acceptance, glyph fix, release, or approval of any historical experiment. The branch starts from fresh origin/main `a52dc9441f7eec9dc6f72debb174339758e1761e`; existing source worktrees and their indices remain unchanged. Root owns review and publication.

[raw.json.gz](raw.json.gz) is built-in gzip of UTF-8 JSON containing exactly seven base64 records (483,041 decoded bytes). [manifest.json](manifest.json) records every original path, byte length, SHA-256 and publication-equivalence finding. No entire artifact directory, dependency, runtime package, credential or font binary was copied. The original files were hashed before and after packaging.

| Record | Bytes | SHA-256 |
| --- | ---: | --- |
| `inheritance/README.md` | 4759 | `5d3dd5c95b62c3c58afe6e2ab37facd82a5083901eac5e5f5b8a498c96684d8a` |
| `inheritance/review-packet.zip.gz` | 454934 | `7e869d480bc9460ae2c318d598c450c047b2403504e992150f8724a3b1728416` |
| `inheritance/review-packet-inventory.json` | 3086 | `ecc6c26c0d8c2759c6623cebffd1d2330e19cc7eaf45b02c9ccfa8dbb493af26` |
| `inheritance/verify-review.mjs` | 5026 | `e9c6e4ca946ca4dbdc57e36c6dd136df2e06842cb43ae039e7fb444cf0d19c54` |
| `sh21/artifacts-sh20-marker-gate.log` | 2358 | `c82b4c75ba8cf29671a23f02dabc086d109ee50273f4bed61c37fafc8b390327` |
| `sh21/artifacts-sh21-candidate-build.log` | 12016 | `548f98ac2aef6d37456b45efa28f85d5075f9d4a1b3a9430a11f4ae6da81263f` |
| `sh21/artifacts-sh21-product-pilot.log` | 862 | `42c67d2315fc48a85bb2a6768ecc40f1d8770fe51b207a75bab4bcc60c181e3e` |

The inheritance transport contains the historical synthetic original09 A/B/C offline diagnostic and its exact scripts/receipts. Its old verification report is historical only; no archived code is executed by this recovery. The preserved legacy verifier's absolute fflate dependency is retained honestly. The new verifier below needs no dependency and only decodes and hashes bytes. The three SH21 logs retain failures: marker gate 0 pass/3 fail, product pilot 0 pass/1 fail(layout), plus an ordinary build log. They establish no live SmartArt acceptance.

## Existing preservation

- B07 raw head `3c5c2f59cfc00a6995f814ff8e4ba2eaccc6a7d2` is covered by published `b35d10dfafa711ce4039eeb497052a4f4294ba6b`: raw records, observations, CSV and three native PNGs match exactly; the published gzip restores the 8,701,700-byte XML comparison exactly. This remains a historical bounds diagnostic.
- Run-direction `897005388dd4617965b6a0e4f719e1c4051f1b46` is already an ancestor of published evidence `c1b0fd6ee043d9e8400270cb05dd1040199b24c6`. It is not a proven fix.
- Nightly fixture `d53812829b53e3c9e65e92519b78f2c8a1f6bed0` has the exact same file blob as main/staging through #1079, `eace052ada422e43c28fb6515dda6471b514aa6f`.
- The six apparent modifications in language-native normalize to the published `e1f8a0921640f2b4100d6807fc3590dbe26abeed` blobs. Their original raw hashes and Git blob pins are retained in the manifest; no file was normalized or staged.
- All three archive-review scratch logs already match published `5e89a184ffc8a38539f5fb5e573f403066bcca17` ZIP members, including the initial syntax failure. Their exact mappings are in the manifest.

## Read-only integrity check

Run from repository root:

```sh
node docs/handoff/2026-11-10/final-recovery/verify.mjs
```

It uses only Node built-ins; it writes nothing, imports no product or archived code, starts no child process and makes no Office/network call. Passing means only that the seven preserved files and declared manifest match their pins. No tests, build, native run, archived script or historical verifier is run.

Final metadata append: own-repository complete open-PR inventory is in open-pr-inventory-final.json, captured 2026-11-10T17:49:53.5814741Z. The public canonical handoff is7618e916dacc166463cddf5f2ea029f523bbe51d. Existing recovery archive and manifest bytes are unchanged. final-handoff-receipts.json.gz preserves both closed5-pass handoff checks and the current known-red1267seven-job CI logs; verify-final-handoff.mjs performs builtin read-only integrity checks, never archived execution.
