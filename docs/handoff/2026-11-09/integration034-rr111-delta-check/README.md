# RR111 integration delta: original aggregate retained RED

**Original run 22442 ended exit 1: 7/10 mapped steps passed in 193.7 seconds.** MCP and global types passed. Gallery-tracker and text checks stopped on missing exact sparse-checkout inputs; release-report failed because the coordinator's working burndown used the invalid RR111 status `implemented`. HEAD itself retained `review`. Original outcomes remain RED regardless of later targeted repairs or recoveries.

This is separate evidence-only `codex/evidence-integration034-rr111-delta-20261109`, at `C:/opf-work/i034-rr111-evidence`; NEVER MERGE it or amend the earlier five-source evidence branch. Vetoable decision **I034-RR111-DELTA-RETAIN-RED**: preserve the original delta, working-state mistake and missing-input failures unchanged, with recovery qualification recorded separately.

## Exact source and capture boundary

The run used source `5b9e4386c00319da1fa4370dcc0b3eb6e93c9578`, tree `04060222a7f1d892f7ac1bb368e1d8af020ee775`, after normally folding RR111 `1036e3e819257879d573772a9994c9142248ab07`. Its maintained delta base was `af541289f9fb5d3273a17caf7b9f66f029f9afc4`; the terminal runner reports 78 changed paths including working/untracked metadata. This is not a new full combined suite.

On explicit coordinator permission after terminal exit, original combined log/exit, all files in the step-log directory, current working diff/status, current and HEAD README/burndown, and assembly proofs were copied into fresh `C:/opf-work/i034-rr111-snapshot-20261109-01`. Copy completion was acknowledged before coordinator recovery could overwrite logs. Sealing reads only that owned snapshot and immutable Git objects.

The directory contained **44 logs: ten current selected delta logs and 34 unchanged leftovers from run 86997**. All were retained losslessly. `files.json` labels their roles separately; the ten current names come from the original delta table. Each leftover hash matches the previously sealed five-source manifest at evidence head `6eeb6bf6427164d766e950131a52174fe6a2eaf7`. Those older logs do not count as new passes, failures or reruns here.

## Actual selected delta outcomes

| Step | Retained result |
| --- | --- |
| Build | PASS, 12.9s |
| Biome | PASS, 0.1s; six files |
| Changelog check | PASS, 1.1s |
| Gallery tracker | FAIL, 0.9s; 9/18 test cases pass, nine fail on missing historical sparse inputs, including `rr-20-pareto-series-scope/limitations.json` and `rr-42-native-20261002/values.json`. The later tracker build/freshness phase was not reached. Freshness after hydration is NOT established. |
| Release report | FAIL, 0.8s; 6/8 pass, two reject working status `implemented` (allowed `todo`, `in-progress`, `review`, `done`, `descoped`). This is captured coordinator working metadata, not the committed RR111 adapter's status or a reason to relax the enum. |
| Skill commands | PASS, 20.7s |
| Stability | PASS, 63.8s |
| Text integrity | FAIL, 0.8s; 6/7 pass, one cannot read tracked `painting-Linux.json.gz`. The subsequent integrity scan was not reached. |
| Global types | PASS, 26.2s |
| MCP | PASS, 89.0s; 55 pass, 0 fail and one optional deployed-site-font SKIP. No actual Claude-host or deployed-font qualification follows from that skip. |

`original-table.txt` retains the exact CRLF table and terminal summary suffix; gzip transports preserve all original log bytes and inner diagnostics. No expected freshness failure is inferred beyond the actual missing-input failures. No raw failure, skip or unrun phase is replaced by a later outcome.

## HEAD versus working metadata and source proof

The captured working status has two modified files (handoff README and release-readiness burndown) and two untracked six-source assembly proof files. The raw `git diff --binary HEAD`, current bytes and Git-extracted HEAD bytes are all retained. HEAD's RR111 table row says `review`; the current row says invalid `implemented`. The offline verifier binds both full canonical hashes to the captured patch indexes and source Git objects. It does not apply the patch or repair the row.

The six-source assembly metadata is explicitly untracked coordinator metadata. The verifier independently replays six ancestor heads, exact union/ownership of 20 package/tool paths and 13 unchanged protected Git objects against `6d5d61edc5c78a5c92128dd517c7dd6257d52331`. RR111 owns only `packages/mcp/app/main.ts` and `packages/mcp/test/deck-app-browser.mjs` in that union. Chart/schema, PPTX source, startup budget and fixture/CI/lock protections remain exact. Prior five-source/four-source audits are retained as older-stage metadata, not substituted for the six-source proof.

The preceding full five-source run remains separately retained RED at evidence head `6eeb6bf6427164d766e950131a52174fe6a2eaf7`: core golden, render fixture and PPTX archive failures plus interrupted suites remain outstanding. This MCP delta cannot clear those failures or qualify their unrun tests.

## Separate metadata/input recovery stage

`recovery-01/` retains coordinator run 87653 separately, at the same source HEAD after correcting the working RR111 status to `review` and hydrating exact tracked inputs. The original delta and its invalid row remain untouched. Recovery also ended exit 1: six steps PASS, strict gallery-tracker FAIL, and types SKIPPED because no TypeScript changed; total 34.2s.

Release-report now passes all eight tests. Text passes seven tests and its 13,083-file integrity scan. Gallery-tracker passes 17/18 tests; its sole actual failure is strict freshness, with no missing-input error, warn override or tracker regeneration. This is the observed post-hydration result, not an expected failure substituted for measurement. No tracker-freshness acceptance or aggregate-green claim is made.

The recovery snapshot includes the exact 4,356-input / 113,711,152-byte hydration receipt, corrected working diff/status/row/README and all 44 directory logs. Seven logs belong to executed recovery steps; the types row is a genuine SKIP, and its retained old log is labeled as an inherited leftover, not a new typecheck pass. All 37 leftovers match the first delta's immutable captured hashes. The eight-row recovery table and original terminal exit remain separate from the ten-row original delta. No MCP source test or full combined suite was repeated by this metadata-only recovery.

## Offline verifier and remaining boundary

Run only the dependency-free offline verifier:

```sh
node docs/handoff/2026-11-09/integration034-rr111-delta-check/verify.mjs
```

It checks lossless transports, both exact exits/tables, selected-versus-leftover log identities, all three original failures and later strict freshness failure, original MCP/types evidence, both working-versus-HEAD metadata stages, exact hydration identities and six-ancestor/20-path/13-object source preservation. It invokes local Git with lazy fetching disabled; no tests, builds, hydration, fixture updates, browser, provider, GitHub API, CI, Office, push or release is performed.

No new `check:changed` was run by this agent for the evidence-only descendant because the coordinator prohibited builds/tests in this sealing task. Final documentation qualification remains separate and owed. The actual post-hydration tracker verdict is strict RED; subsequent qualification must preserve both prior aggregates. Native, cross-platform/slow, final CI/release and genuine 0.34 site gates remain separate; chart representation agreement is still pending.

- 2026-11-09 UTC: Copied terminal delta and unrepaired working metadata before recovery, distinguished all stale logs, retained original aggregate RED and prepared offline proof without modifying source, fixtures, statuses or inputs.
