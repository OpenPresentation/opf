# RR-20 macOS fixture portability

Candidate from fresh `origin/main`, normally merged schema snapshot `db64ca9b8b2e4ddf1e7d7690df374106a6c577a3`. This lane changes repository tooling/tests only; native Office and release acceptance remain open.

## Reproduced baseline

- `node --test --test-name-pattern='bump publication: full-history' scripts/bump-sites.test.mjs`: one failure on the actual macOS Bash 3.2 shell, `depth[@]: unbound variable` in the exact workflow publication block. Shallow fixtures initialize `depth`, while the full-history path expands an empty array under `set -u`.
- E1 genuine-consumer/import-only focused baseline: two failures, raw `/var/folders/...` fixture roots versus `realpath` `/private/var/folders/...` installed entries. The unchanged tests pass 2/2 when a diagnostic child receives `TMPDIR=fs.realpathSync(os.tmpdir())`.
- Table path/pin/modeled-profile focused baseline: three corresponding alias failures. The seven-chart profile cannot load before this worktree has workspace dependencies; no test claim is made from that setup failure.
- Original coherent mapper logs remain `/tmp/opf-schema-mapper01-logs/pnpm_run_check_ci-workflows.log`, `pnpm_run_check_e1-current-after.log`, and `pnpm_run_check_native-acceptance.log`. The native aggregate also contains missing sparse archives, current schema/old chart archive differences and inherited furniture expectations; those are independent of this patch and stay open in coordinator/schema lanes.

## Change and proof boundaries

The real workflow now initializes the argument array with `fetch`, then adds `--unshallow` only for a shallow checkout. Every array expanded under nounset is nonempty. The existing publication fixtures still execute the extracted workflow block against actual local Git repositories, verify main/reviewed ancestry and reject conflicts, closed heads and concurrent non-fast-forward writers. An added precondition proves the full-history fixture is actually full history and every other publication fixture starts shallow.

E1, table, seven-chart and reference-envelope fixtures use canonical owned temporary roots. Runtime alias/reparse refusal, overlap guards, sealed file hashes and public import rules are unchanged. A portable real directory-alias control proves the E1 helper canonicalizes an aliased temporary parent, deletes only its owned inner fixture and leaves the parent alias and target intact. Existing table/seven explicit alias rejection tests remain active.

## Exact candidate checks

- Full `scripts/bump-sites.test.mjs`: **23/23 PASS**, actual Bash 3.2; both shallow and full-history fixture preconditions verified. Final run 6.76 seconds.
- Full `scripts/e1-current-after.test.mjs` plus `scripts/native-acceptance/table-profile.test.mjs`: **48/48 PASS**, default macOS alias-valued TMPDIR, 2.37 seconds. This includes the new real-alias parent control and existing sealed bytes/hash/overlap negatives.
- Maintained seven-chart controller paths plus actual reference-envelope create/verify/default-pure child: **2/2 PASS**, 3.10 seconds. These are pure fixture tests; no Office factory runs.
- Frozen, prefer-offline install: **PASS**, 3.7 seconds; no lockfile changes. Expected missing prebuild CLI-bin warnings retained.
- Changed JavaScript Biome check: **exit 0**, no errors, 33 informational style diagnostics and existing config-schema/CLI mismatch (`2.5.12` schema, pinned installed `2.6.4` CLI). No unsafe fixes applied.
- `git diff --check`: **PASS**.
- `check:changed --base db64ca9b8b2e4ddf1e7d7690df374106a6c577a3 --plan` recorded the required delta steps. Root explicitly deferred execution to the coherent union mapper; no independent long mapper was run. Typecheck is unselected for this tooling/test-only delta.

[Raw results](raw-results.json.gz) preserve original full mapper failures unchanged, exact diagnostic outputs, final candidate output, install/lint and the delta plan: 11 records, 98770 decompressed bytes; compressed SHA-256 `0797b5a592de0a7dc35ad064d5e390e35c011f6c59d805662a1f813a697a0c56`. The diagnostic extracted the unchanged E1 test source from `db64ca9b8b2e4ddf1e7d7690df374106a6c577a3` into a temporary sibling test, ran exactly two tests with default and canonical TMPDIR (2 failures versus 2 passes), then removed that exact owned source file.

Full combined mapper, required CI, OS matrix and native acceptance remain coordinator work; no aggregate pass is claimed here.
