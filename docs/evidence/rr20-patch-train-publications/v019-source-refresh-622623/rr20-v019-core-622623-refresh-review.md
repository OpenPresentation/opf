# Local v0.19 core refresh: #622/#623

Final reviewed local head `b597dbe099166d62067ea1cc67696c45cc268177`, clean. Pure merge checkpoint `c6b81092862b1f414acec9b38bfb00ff78739f61` remains identifiable in `/private/tmp/opf-v019-core-current-integration`. Parents are accepted candidate `5adf19a2483ad6ced7b8f118b5eba3c0d488a1f7` and actual main `f2394d73ece195933c34a3dfffdcba8e14aefed5`; both exact ancestors verified. Initial expected head/status/main matched; merge completed without conflicts. No push, API, watcher, release/version preparation or publication.

Read AGENTS and release-readiness README/resume protocol, HANDOFF and burndown. This narrowly assigned local task follows supervisor's current identity/inventory; it does not perform the protocol's normal live network inventory under the explicit API-zero constraint.

## Exact changes and preservation

Relative to 5adf19a2, 192 documentation/evidence paths imported from actual main (durable#621 offline packet and #620 staged evidence plus dated burndown), and four non-documentation paths:

- package.json adds auto-discovered check:lazy-font-counts;
- scripts/lazy-font-counts.mjs admits only reviewed renderer 0.18.2 → 94;
- scripts/lazy-font-counts.test.mjs preserves wrong-count/unknown-version/immutability refusal;
- ecosystem.lock.json adopts generated main core 382ae010/editor 39e62a61 source pins and roller provenance. Renderer remains dd6b520/PPTX 95a2f22. The candidate's already-reviewed rr83-v2-reviewed golden path remains intentionally retained rather than replaced by main's historical rr-71 path.

No delta in packages/javascript, packages/cli, spec/schemas, examples, .github or pnpm-lock.yaml. All runtime/dist/adaptive layout/filename #550/schema 2/catalog and accepted budget/golden behavior remains unchanged. Genuine core version 0.18.4 preserved; no invented 0.19 metadata or new authorization fields. Existing candidate fields preserved; root package's opf field remains absent before/after. No original packet06 or refreshed-stage tree was touched: imported evidence is committed main's copy, not alteration of frozen working artifacts. Preservation receipt `/private/tmp/rr20-v019-core-622623-preservation.json`.

## Required mapped checks

Node 24.21.0/npm 11.16/pnpm 10.33.2, TMPDIR=/private/tmp. `pnpm check:changed`, session 1788 terminal exit 1, 136.3 seconds: 23/25 steps pass, including Biome 280 files, typecheck, complete core and CLI tests, schemas/examples/catalog/v2/agent tools, candidate graph, core/registry golden guard, text, fonts and runner checks. Exact log `/private/tmp/rr20-v019-core-622623-check.log`.

Two retained blockers:

1. check:breaking correctly refuses intentional v1 API/schema removals while package version remains 0.18.4. Genuine next minor preparation is still required; no guard bypass/version change attempted.
2. check:gallery-tracker stale: committed tracker JSON differs only in five added nativeEvidence paths pointing at `docs/evidence/rr20-native-packet06-offline`. Read-only in-memory generator comparison `/private/tmp/rr20-v019-core-622623-tracker-diff.json`; diagnostic `/private/tmp/rr20-v019-core-622623-tracker-diagnosis.log`. All other fields/columns/verdicts unchanged. `scripts/build-gallery-tracker.mjs:150-185` indexes evidence JSON/Markdown by native/powerpoint path names, so the newly imported offline packet is discovered despite explicit no-native-execution boundary. Its interpretation needs review before any related tracker regeneration; no tracker, exclusion, freshness policy or native claim was changed in this integration.

The merged count entry covers renderer 0.18.2 only. Any final 0.19 renderer version/prerelease must separately prove exact face bytes/count and add its reviewed explicit record. This refresh does not replace new complete-graph/registry/native qualification, genuine metadata preparation or release gates. No final acceptance or milestone closure is claimed.

## Permitted related tracker refresh and final outcome

Actual complete-candidate diff against main f239 includes scripts/build-font-tracker.mjs, its tests, scripts/build-gallery-tracker.mjs and both tracker override files. CONTRIBUTING.md:72 therefore permits regeneration in this related integration (when a PR changes generator/overrides/tests), prescribed font first then gallery. Both commands succeeded; font tracker and gallery Markdown remain unchanged. Exactly five gallery JSON records (chart/chart-beside/image-beside/table/text) gain only the offline packet06 evidence path. Across all 863 records every other field, measurement, lifecycle column, status and verdict is unchanged. In-memory receipt `/private/tmp/rr20-v019-core-622623-tracker-preservation.json`; supervisor independently parsed and confirmed the same scope. The existing nativeEvidence field name/path heuristic is retained; these offline references confer no new native execution or acceptance.

Final mapped run 74093 terminal exit 1, 134.4 seconds: 24/25 steps PASS, including strict tracker freshness, complete core/CLI tests, typecheck and all other mapped gates. Only genuine minor-version check:breaking remains unmet. No warning environment or gate weakening. Log `/private/tmp/rr20-v019-core-622623-final-check.log`. Local commit b597dbe0 changes only generated gallery-tracker.json 5 insertions/5 deletions atop pure merge c6b. Final clean head contains both intended parents; runtime, genuine 0.18.4 metadata and original packet/stage trees remain unchanged. No full registry/staged graph/native requalification or milestone closure is asserted.
