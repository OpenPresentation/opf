# v0.33 MCP size audit and guard refresh

This is the minimal correction for the two size-only failures of [integration PR #1133](https://github.com/OpenPresentation/opf/pull/1133), reproduced from `d26031b98ff9316d479f8db7a383511371cab4a6` and finally checked with the normally merged waterfall fix at `a4322cdd9686c2ef34732088c48d72366d379190` (CI job 128627210746). All protocol/behavior checks in that Linux job passed. No public documentation or feature is removed.

## Diagnosis

The exact Linux values reproduce locally: the lean Worker is **8,110,959 UTF-8 bytes**, and its 42 selected public documentation pages total **1,231,117 bytes**. The old ceilings were 8,100,000 and 1,225,000. They were dated diagnostic budgets, last refreshed for SH-19 / SH-18 and with room reserved for SH-17.

Against the unchanged main core graph at `d19c4bb6172b703d132ebba3fd006e4ec5cdf845`, the lean Worker grows 31,771 bytes. Of that, 31,384 bytes are in the shared core engine chunk containing composition and related rules. The main comparison uses the frozen built RR-107 checkout at `cabd3c8a03d02255329edd2352eb1e39df7fb40c`: its core/render/PPTX/gallery and MCP server source are identical to main; its separate release tooling does not enter the lean graph.

The module audit finds **no** generated docs, generated examples, MCP default data/skills, or viewer HTML in the lean entry. The full entry detects all four origins as positive controls and is 22,157,108 bytes larger. The existing requirement to remove at least 7 MB remains unchanged. Core schemas, preset geometry, diagram checking, default catalog/search and composition are expected runtime inputs, not documentation retention.

Compared with the documentation budget's `e3ff9dc71c` checkpoint (1,197,594 bytes), the 33,523-byte public-page increase is accounted for: SmartArt +22,940; chart-options +3,014; dynamic-composition +2,191; layout-templates +1,734; shapes +1,585; diagrams +701; agent-skills +353; validate +300; chart-table-data +257; image-treatments +207; icons +120; examples +88; catalog-schema-reference +37; quickstart -4. The allowlist remains exactly 42 pages, with no maintainer page added.

## Stronger guards and vetoable maintenance decision

Keep all existing slug, skill, no-maintainer and data-removal checks. Also require every served page to equal its actual source file (normalized LF); detect forbidden module origins from retained esbuild inputs using original source banners/maps, with positive full-entry controls; and add independent production minified and gzip ceilings.

| Guard | Measured final | Ceiling | Headroom |
| --- | ---: | ---: | ---: |
| Lean, unminified UTF-8 | 8,116,787 | 8,150,000 | 33,213 (0.41%) |
| Lean, minified UTF-8 | 5,300,992 | 5,350,000 | 49,008 (0.92%) |
| Lean, gzip level 9 | 1,199,308 | 1,210,000 | 10,692 (0.89%) |
| Selected public Markdown | 1,231,624 | 1,240,000 | 8,376 (0.68%) |

The combined waterfall fix adds 5,828 raw / 2,641 minified / 935 gzip bytes and 480 public-doc bytes; all source-exclusion controls still pass. The additional 27-byte MCP doc correction updates stale payload estimates in docs/mcp.md: the current default entry includes the viewer and data (about 25.7 MB minified / 9.1 MB gzip), the lean entry is about 5.3 MB / 1.2 MB, and the viewer is about 8.5 MB / 2.3 MB. These are observed project payloads, not hosting quotas; the project guards stay far below the hosting limit documented in the Cloudflare program.

The raw ceiling increases are an explicit **vetoable budget refresh for measured approved features**, accompanied by stricter content and production controls. They are not a tolerance change to visual goldens or a relaxation of behavior checks. No dependencies, runtime implementation, source selection or public slugs changed.

## Validation and integration

The exact combined candidate built under Node 24.20.0 and pnpm 10.33.2. The standalone neutral Worker audit/budget test and the exact public-doc/skill-source test pass. Their separation lets size/content checks run without starting workerd; the existing runtime tests are preserved. This host's unchanged workerd executable independently fails `spawn UNKNOWN`, so the already-green d260 Linux protocol suite is not redundantly rerun here. Final Linux integration CI remains required.

[Machine-readable measurements](../../evidence/mcp-size-budget-033/measurements.json) record the before/current values, per-page deltas, retained inputs and explicit ceilings. Run `node --test --test-name-pattern "lean Worker preserves data exclusions" packages/mcp/test/mcp-workerd.test.mjs` and `node --test --test-name-pattern "every listed doc page" packages/mcp/test/mcp.test.mjs`. Root mapped checks passed in 61.5 seconds with `OPF_TRACKER_STALE=warn pnpm check:changed --base a4322cdd9686c2ef34732088c48d72366d379190 --files docs/mcp.md changes/rr-105-mcp-size-audit.md docs/handoff/2026-11-07/mcp-size-budget-033.md docs/programs/release-readiness/burndown.md docs/evidence/mcp-size-budget-033/measurements.json`; this is not claimed as a full Windows MCP protocol pass.

Fold the minimal PR into the v0.33 integration, then freeze this branch. Do not push to a folded branch. The coordinator's existing batched pr-gate process owns the final CI watch.
