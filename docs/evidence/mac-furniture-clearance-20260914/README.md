# Shared furniture clearance correction

The stronger SVG paint gate found two real Linux pixels outside the inherited
header field in PPTX run [34909245051](https://github.com/OpenPresentation/opf-pptx/actions/runs/34909245051).
Both pixels are x=89, y=64/65, coverage 7/255; the field starts at x=89.6. They are
retained in `linux-predecessor/`. Windows passes all forty paint fields on that
predecessor. Neither platform's result implies the other's paint result.

Core `8a322c13884f2f1634fd3a207d1e0a662e3ad460` introduces
`furniture-flow-v2`: default measured furniture clearance is two reference pixels
instead of one, scaled with the canvas. Explicit host padding, including zero,
remains authoritative. Body text retains its previous default. All consumers use
the same core placement; no renderer-only offset, font change, content edit, or
tolerance relaxation is involved. The policy is supported by the tested field
matrix, not a universal font/rasterizer guarantee.

Local Node 24.21.0 verification:

- Build and eight furniture composition tests pass, including explicit host
  padding, scaling, source ranges, readability, and pagination controls.
- Sixteen source and sixteen fresh-tarball installed offline browser workflows
  pass all forty measured SVG field masks per run. Nonzero pixel centers must
  remain inside the field plus the unchanged 0.05 reference-pixel allowance.
- The displaced-text negative control has 297 outside pixels and is correctly
  rejected by the same predicate. It modifies only an isolated probe, never
  the authored document or accepted runtime layout.
- The source and installed reports have identical geometry, paint hashes,
  semantic imports and PPTX bytes. All nine font hashes match; every one of the
  220 installed browser inputs resolves within the isolated consumer.
- Sixteen PPTX exports still match the same accepted text/image boxes, font
  sizes, source boundaries, and strict/disabled controls.

`views-before/` and `views-after/` contain the four wide/portrait,
inherited/local pairs. All eight original-size images were visually inspected.
The changes preserve source and separation. The narrow 32px organization label
wraps one character earlier, still in two lines; its existing heavy wrapping is
not general visual-quality approval. No corpus baseline has been changed.

`candidate-packages.json` binds the fresh local tarballs. Full reports and masks
are retained here; `SHA256SUMS.json` fingerprints the evidence files.

Final coordinated CI is accepted at the exact runtime heads:

| Repository/check | Commit | Run |
| --- | --- | --- |
| Core package | `8a322c13884f2f1634fd3a207d1e0a662e3ad460` | [34909903308](https://github.com/OpenPresentation/opf/actions/runs/34909903308) |
| Core Mac/Windows CLI | same core | [34909903317](https://github.com/OpenPresentation/opf/actions/runs/34909903317) |
| Core ecosystem | same core | [34909903293](https://github.com/OpenPresentation/opf/actions/runs/34909903293) |
| Renderer | `3d4fa8ce8172c2a6b38bf217d5f8d0ce5a1b62af` | [34909957694](https://github.com/OpenPresentation/opf-render/actions/runs/34909957694) |
| Editor | `40023fb3b65611ada05de8a9860bc41733a415a9` | [34909961922](https://github.com/OpenPresentation/opf-editor/actions/runs/34909961922) |
| PPTX Linux/Windows | `ee89b266527a954bb573aea00075db997c8a253a` | [34909952135](https://github.com/OpenPresentation/opf-pptx/actions/runs/34909952135) |

The full logs and run/job metadata are retained. Core passes 508 tests. Renderer
and core ecosystem both pass the unchanged 805-slide furniture corpus baseline.
Windows and Linux each complete sixteen installed furniture workflows and forty
actual field masks with zero outside pixels. Their displaced controls correctly
fail with 312 and 382 outside pixels respectively; Mac's control has 297. All
three platforms have identical accepted geometry, semantic imports and PPTX bytes
across the sixteen cases, with the same nine font hashes. Raster hashes may
differ across platforms, and Canvas observations remain in the reports.

Run `node docs/evidence/mac-furniture-clearance-20260914/verify.mjs` with Node 24
to recheck retained evidence hashes, report counts, masks, controls, CI source
heads, and cross-platform geometry/import/export equivalence. Reproduce fresh
browser results using the pinned coordinated branches, `pnpm pack:ecosystem`,
`pnpm test:packed-ecosystem`, and `node scripts/test-furniture-workflow.mjs
artifacts/furniture-workflow installed`.

Native Office recovery and separate font/tab/image/provenance acceptance remain
unresolved. These are browser and conversion checks, not Office COM tests. No new
registry package or public deployment is represented by this acceptance.
