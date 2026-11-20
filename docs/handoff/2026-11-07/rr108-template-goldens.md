# RR-108: pinned template golden generation

The new v0.34 layouts change both core composition keys and renderer template slides. The old golden workflow regenerated only example raster baselines, leaving the template fixtures outside the required pinned environment.

The read-only pinned Playwright job now invokes both maintained template generators, alongside example generation. Template candidates, diffs and sheets stay under the existing golden artifact root, so the patch download path is unchanged. The separate write job accepts only renderer golden paths and the exact core fixture packages/javascript/test/fixtures/template-goldens-0.19.json; dot path segments and every unrelated path are rejected. Branch code never receives the write token.

Vetoable decision: use one pinned regeneration batch and one bot commit for example and template baselines. The existing exact hashes and review requirements are unchanged. No local baseline was edited. Offline tests reproduce the missing workflow boundary before the correction and pass afterward, including actual git apply --numstat output for allowed core/render paths and rejected source/sibling/traversal paths. The final v0.34 integration must run this workflow and review every changed sheet before merge.

Independent review accepted the final workflow/test diff. All nine selected changed-scope steps pass in65.3s after exact sparse Git-blob hydration and correction of the new row's placement/status; the raw first failure and final receipt are preserved. The tracker uses its documented PR warning policy, without regenerating it. Only the five focused golden-workflow tests were additionally run; every actual render/promotion remains owed to the pinned integration workflow.
