# Editor browser logical enum currency

Source-only successor of frozen `dba1fb4470aff1aaa1cd3d33202a86bee7c48652`. CI run `42931970125`, editor playground shard 3/4, stopped at `design-gaps-browser.mjs:319/322`: the Zone control resolved, but `selectOption('left')` found no matching option and timed out after the existing 30000ms. The original log remains `/tmp/opf-dba1-ci-editor3.log`.

The current UI builds Zone options from `HEADER_FOOTER_ZONES = ['start', 'center', 'end']` and derives their summary labels with `titleCase`. The two maintained browser fixtures now select these exact logical values, retain the selected zone in `zoneNow`, and expect `Start: empty`. A bounded neighboring review also found stale typed title-alignment, chart-position and image-placement selectors; their selected and expected document values now use `end`, `start` and `end`, respectively.

Only these typed fixture values and the corresponding Zone summary label changed. Physical coordinates, layout assertions, RTL semantics, negative controls, caret/undo/scope checks, preview checks and timeouts remain intact. The stable `left-right` layout ID remains unchanged. No product, generated tracker, preview, golden, baseline or tolerance changed; no package-code changelog fragment is needed.

**UNEXECUTED:** no install, build, syntax/test command or browser run occurred in this source-only worktree. The coordinator will normally fold this checkpoint and run both maintained browser files after the active formal performance window. This source correction does not claim the CI shard or either browser suite passed.
