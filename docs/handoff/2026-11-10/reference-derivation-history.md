# RR-105 historical reference derivation — source-only repair

Status: **LOCAL UNQUALIFIED; imports, functional tests, builds, PowerShell and Office UNRUN**. Base: normally folded root `1c80183a2288a04f5506a23bb88ece278cde277d`, from pinned `origin/main` `7fb6140804f969550e3a9c9d52916b7610844917`; no ref refresh or dependency installation.

The root native-acceptance aggregate first retained seven mechanical-source failures in `artifacts/check-changed/pnpm_run_check_native-acceptance.log`: six derivation tests and the reference worker source test. Every failure stopped at the old helper's first live-file SHA assertion. Expected historical worker `7735dcd6…` differs from current worker `d8901f1d…`. This is the original RED, not a repaired test result.

Its complete first log is retained externally at `/tmp/opf-reference-history-first-native01.log`, 46,859 bytes, SHA256 `cc683310f4f14a2a66287378251f14731c45a381690fed5cdb1762c1e0235a4d`. It also retains the separately assigned new tooling failures; this repair does not address or reclassify those.

The causal change was `73c35668e4ad4b8d8c86e88c99919d2a4d04860c`: mandatory externally pinned request SHA, immutable request validation and report schema2/request identity. The later primitive checks in `3737c656…` did not change that worker. The live Seven wrapper also differs from its old `060cafa0…` base after v2/postflight/context changes. Updating the first expected hash would merely reach the next source refusal and would change what the historical proof means.

The repair retains [three exact source blobs and their closed authority](../../../scripts/native-acceptance/test-fixtures/reference-controller-base-e5741c2d/README.md) from `e5741c2dae7e1b341ca0cf6b22cbc9c2f03f6d85`. The helper hashes these before use; all old SHA pins, unique substitutions, postflight plan and complete target-byte comparisons remain. New prepared controls reject same-length byte edits, appended bytes, revision/OID/hash/file-order changes and attempted use of the live v2 shells as historical bases.

The three reference targets remain byte-identical to reviewed `f3f04183c2d38ffe3e5755a23b571b6b9ce8155e`:

| Target | SHA256 |
| --- | --- |
| `reference-chart-worker.ps1` | `642cbe4b9d9a770a30a61bce804b68f87b5f083fca16e4feff2d9246972e2cda` |
| `run-reference-chart-profile.ps1` | `8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3` |
| `reference-chart-worker-self-test.ps1` | `93df6be95310271ca1b9dfde824309f259b6f908db147c67e81d6170dbba6038` |

Source search finds the derivation helper imported only by its two source-test files. Neither is in an actual controller dependency closure. The new plaintext authority/bases are therefore source-proof fixtures, not new runtime/controller authorization resources. No worker, request, eligibility, observer, postflight plan or historical native witness changes.

Pinned Node24.21.0 `--check` passed for the three changed `.mjs` sources; `git diff --check` passed. These checks neither import the helper nor execute its derivation/tests. The coordinator must review/normal-fold this checkpoint and replay the maintained native-acceptance source tests under its next execution lease. There is no new native or release acceptance.
