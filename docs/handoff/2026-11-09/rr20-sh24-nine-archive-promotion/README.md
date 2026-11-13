# RR-20: nine-only SH-24 archive metadata promotion

This branch copies the maintained reviewed nine-deck candidate JSON byte for byte into `packages/pptx/test/fixtures/chartex-fallback-main.json`. It repairs the strict archive lock after SH-24 removed public live-qualification wording from the inverted-pyramid catalog description. The exporter already writes the corrected record hash; this branch changes no runtime behavior.

Fresh main was fetched through the maintained worktree helper, then normally fast-forwarded to exact reviewed candidate `5b9e4386c00319da1fa4370dcc0b3eb6e93c9578`. Before copying, the working tree was clean and all four core/Gallery/renderer/PPTX package objects matched that source. Exact copy/source proof records the objects, original73ce fixture and generated94cf proposal identities. The proposal retains its actual5b9 producer reference; no descendant is mislabeled as that producer.

## Review basis and scope

The [maintained procedure](../../../../packages/pptx/docs/archive-review.md) explicitly calls for a separate source change copying the generated proposal after part review. The coordinator independently replayed and published:

- [Actual nine-deck review594863](https://github.com/OpenPresentation/opf/tree/594863c06e7c442c6784226fe30d9357e290ac07/docs/handoff/2026-11-09/rr20-current-nine-archive-review): all nine baseline locks reproduced before candidate exports;18 actual PPTXs,1,407 package parts, only nine identical SH-24 metadata-tag changes. All15 embedded workbooks/180 nested parts remain byte-identical.
- [Pure causal proofaa9580](https://github.com/OpenPresentation/opf/tree/aa9580f6371da243540d031393c6a943e688ecbe/docs/handoff/2026-11-09/sh24-archive-metadata-proof): replacing only the inverted-pyramid record hash reproduces the exact failed treemap archive SHA `c844c8abe2f223546f9a735e27f16cb0e036dd7c519b01992e02df5c22639079`.
- [Separate actual21 review7c7e5](https://github.com/OpenPresentation/opf/tree/7c7e5df4c5f293ba326245b0e124dcf835f078be/docs/handoff/2026-11-09/rr54-current-archive-review): all21 bare-caller archives and three applicable native XML subdigests remain unchanged. Its tracked fixture SHA `d62b991a3772856d812296cf12582be2ede6850e39d644d3414ab39a89a06e27` stays exact. The21 review used its existing interleaved order, not the nine-family's all-baselines-first order.

Vetoable **RR20-NINE-SH24-PROMOTION** accepts ONLY the generated94cf nine-family proposal. It preserves all previous source/history/deck fields and appends the actual current previous-lock/review records. No hand-edited hashes, normalized XML, weakened checks, new producer ref,21-fixture update or generated raster golden is involved.

The one changed part in each archive is `ppt/tags/opfLayout18.xml`:519bytes before/after,21 differing hex bytes for record hash `4baa264255f9f66b` → `22f5fe00efa7a1f8`. Chart, slide, workbook, layout geometry and theme bytes remain unchanged.

## Qualification and resume

Qualified source is `d623be2d49da7b448f82c2e0395609487d89a4f5` / tree `28de71d5e34fbca804f508a2c0416a70593e6da8`. All four focused files pass: maintained nine-reviewer refusals/immutability, append-only RR54 history controls, strict ChartEx31 checks and unchanged chart/table-data42 checks.

The required mapped run executed once against5b9 and remains **RED** after1,480.9seconds:9 steps pass, strict gallery freshness alone fails17/18, and TypeScript is correctly skipped. The entire selected PPTX contract passes280/280 scripts plus its browser-bundle build in1,393.2seconds. Build, Biome, fragments, release report, font-hotlink policy, skills, stability and text checks pass. No tracker warning override or unrelated generated repair was used. The separate current-wave metadata leaf owns freshness recovery.

Qualification and the lossless check packet retain the actual outputs, sparse-input preparation and complete package log. The earlier combined86997 remains RED. These checks establish local source/serialization scope; cross-platform CI, browser execution and native application acceptance remain separate. This documentation descendant does not change the tested package payload.

No source/runtime/catalog/schema/chart/native change, Office operation, CI dispatch, push, golden regeneration or release occurs in this task. The maintainer-only `packages: []` fragment and RR-20 progress row describe the fixture repair. Root owns publication, integration, combined acceptance and the separately held chart/native/release work.

The lossless source check packet contains32 raw artifacts/1,012,591bytes. Verify its hashes, exact published proposal copy, unchanged21 fixture and tested package identity without exports:

~~~powershell
node docs/handoff/2026-11-09/rr20-sh24-nine-archive-promotion/verify.mjs C:/opf-work/integration-034/packages/pptx/package.json
~~~

The attempted manual Biome check of only new handoff files reported that all supplied paths are ignored by repository policy; it processed no files and is not counted as a pass. The maintained source mapped run already passed its applicable Biome step. Final documentation-only verification is measured from d623 and selects no package tests.

Final documentation-only mapped verification completed in39.8seconds with6 passed steps, strict gallery freshness17/18 alone failed, and TypeScript correctly skipped. No package test was selected or repeated. Its lossless raw logs, plan and ignored-path Biome attempt remain separately sealed in `final-docs-checks.json` / `final-docs-checks.zip`. The tested package payload is unchanged.
