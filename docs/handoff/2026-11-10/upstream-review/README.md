# RR-117 upstream review dependencies

This successor starts at frozen root `c6d52fbe9f674663bf4194959298cbfbce69aa64`. Its only product change is `packages/javascript/src/validation-cache.ts`. It preserves exact own raw/inlined slide data, all global metadata, ordered IDs/count, options, existing strict plain-data guards and cache budgets. Only the cumulative prior-slide fingerprint becomes narrower.

The actual dependency audit follows `buildSlides` → `resolveSlideContext` → composition. Later geometry reads prior slides through ordered citation/footnote numbering and recursive message-surface alternation. The shared `walkCitationRuns` supplies exact marker paths/IDs/rich notes. Prior design/layout are retained whole for explicit accent selection. Section remains conservative; the current resolver reads its own string and does not infer a section from prior titles. Layout/theme/font/catalog inheritance comes from exact own/global records, not prior headings.

Every body that passes the actual shared `lonePayload(...).field === 'text'` necessary predicate retains its **whole raw slide**. No layout-ID, word-length or measured-size prediction is duplicated. Declared variables, template/explicit-values modes, unknown non-font callables and classifier failures retain the old whole-prefix policy. Dataset hydration changes only chart/table data, not the root body-kind predicate; own inlined data stays exact. Authored links accept URL schemes only and do not derive labels from another slide's title. All global IDs remain exact anyway.

Measurement-provider inputs remain the documented slide index, text/size/style and own/global script profile. Providers retain their existing deterministic-until-`clear()` contract. No callback receiving a prior slide or deck is newly excluded. Unknown non-font callable dependencies conservatively retain the raw prefix. Full validation findings remain fresh; this cache only returns finished composition geometry.

## Focused qualification

Pinned Node `24.21.0`, pnpm `10.33.2`, frozen lock and shared `/tmp/.pnpm-store`; own worktree `/tmp/opf-upstream-review`.

| Command scope | Result |
| --- | --- |
| Frozen install | PASS, 2.1 s; expected unbuilt workspace-bin warnings |
| One gallery/core dependency build (`--filter @openpresentation/opf... run build`) | PASS |
| New actual-source upstream controls | **15/15 PASS**, 1.265 s |
| Nine existing cache/layout/variable neighbor files, serial | **85/85 PASS**, 31.004 s |

The new helper observes actual cache-compute and public `composeSlide` calls at three exact guarded source sites. Every audit compares the **complete report and every final public composition** against a separately executed cold validation. A plain cover-title edit computes/composes only its owner (`[1,0,0]`); two shared-data consumers compute `[0,1,0,1]`. Real later English/Arabic display messages retain correct measured growth, alternating surfaces and background changes after prior layout/design accents, candidate/long/short/title edits. Citation paths/order/footnotes, variables, fonts, catalogs, mutable inputs, IDs/order/count, opaque/budget refusal and reentrancy are covered.

Existing neighbors: `incremental-validation`, `diff-cache-lifetime`, `half-step-review-cache`, `lh-149-sizing-fixes`, `readability-floor`, `floor-recompose`, `builtin-variables`, `variables`, `slide-variables`. Raw selected outcomes are retained alongside this note. There were no failed test attempts or retries. Biome and whitespace checks passed; Biome reports its existing configuration-schema/CLI version information. Final lint cleanup removed an erased TypeScript assertion and an unused test parameter; root's combined build/gate remains required.

These are functional and work-count results, **not measured latency or speedup**. No formal performance window was rerun, no golden/budget/deadline changed, and no leak/mobile/native/registry acceptance is claimed. Global-name invalidation is unchanged. The frozen `89a9` formal producer and root `c6d` build were untouched. Root owns the subsequent normal integration and one coherent required delta gate.
