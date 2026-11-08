# RR-20 centered track resize and authored-track consistency

Branch: codex/rr-20-centered-track-resize. Worktree: C:/opf-work/rr-track-resize. Fresh main 9545016583ccfa151077cda4d51043ac6505a140 normally merged integration 5049cb53768df5c420d6591ec3021461253df370 and frozen QA 1210/c9a6e479477c5a31e37d8b41ca67a95c3ad7e106. A later normal merge, 6f1762b484c2fa86e6f5381a02b7a151919738bb, aligns this lane with integration 67dd9ec10b7019cb95807f59c75186482c800f10. QA 1210 is folded and must never receive another push.

Tested production source: 37eb56ce26a873aed6b86255e4d042384099f8bf. Subsequent commits add only evidence and handoff metadata. The receipt and verifier bind committed source bytes, protected trees and every packet artifact.

## Confirmed resize bug and correction

The current three-row column has 130.98px leading space, 68.32px row heights, a 24px gap, body y147.48/h514.92 and 56px text. Old drawnTracks ignored offsets and allocated all slack to the last row: an at-rest request authored weights [2,2,9.669] and jumped the first divider from 0.482 to 0.300. The original failure and actual geometry are retained.

The private plan allocates leading/trailing space to the first/last rows and uses an affine pair-fraction transform. An exact no-motion implicit request leaves source, history and all displayed glyph/box geometry unchanged. Current content bounds conservatively strengthen implicit-conversion minima. Feasible directions use available outer space; infeasible moves clamp or explain their refusal. Existing authored weighted behavior is unchanged. The original first-divider +0.1 request remains a meaningful no-shrink refusal.

The canvas bridge uses the physical gap midpoint, removes the half-gap from the fraction origin and uses a signed logical length in RTL. A real browser witness on untouched frozen QA source fails the requested/actual pointer-delta check. The corrected LTR/RTL witnesses move the requested 24.96px within 0.08px, preserve source at rest, create one history step and undo exactly. An initial intercepted locator-click timeout is retained; the final maintained canvas-coordinate protocol uses no force. The full browser suite exposed a candidate two-track normalization error (17% jump), preserved and fixed with its own meaningful regression.

## Causally related core inconsistency

The authoritative mode schema says row/column uses one horizontal/vertical track. On integration 67, four short blocks explicitly configured as COLUMN instead rendered as a 2x2 decorative tile grid, with 69.32px boxes and 56px type; flow.rows still described four 34.16px rows. The editor cannot repair that contradiction by refusing a divider. A finite eight-mode probe and actual before renders preserve it.

Late textTiles did not check effective authored composition. One shared permitsTextTiles predicate now allows only unpinned AUTO: implicit/explicit auto mode, absent columns and no nonempty weights. The same predicate gates growBody's existing potential-card count exclusion. When those tiles cannot apply, the existing LH-102 further-growth path can run. No new growth algorithm or display cap is introduced.

A placement-only candidate honored direction but left 37px text. Its strict 56px failure and all five measured 37px panels remain explicitly rejected evidence. The final correction keeps ROW, COLUMN, GRID1, AUTO1 and weighted COLUMN at 56px without overflow, and reported flow frames contain actual displayed items. The editor's four-block regression now positively checks a real column, exact rest and feasible drags without smaller text. Four unpinned controls (implicit/explicit AUTO, English/Arabic) retain exact SVG strings and actual PNG bytes against the untouched baseline.

## Vetoable decisions and visual acceptance

1. At rest means exact no-op, with no history entry.
2. Implicit conversion preserves current type; retain infeasible requests as explicit clamp/refusal controls. Explicit weights keep their existing semantics.
3. Preserve divider coordinates using each physical pair and logical direction. Two-track whole-ratio snapping retains small integers after normalized bounds checks.
4. Deliberate authored weighted layout can reflow text: all four measured cases move first text up 130.98px while preserving 56px type and unrelated dividers. This is not a general glyph-position preservation claim.
5. Keep the current schema/auto-layout model. The accepted no-free-XY decision is cloud-editor/burndown.md line 45, distinct from the owner's still-open D2 diagrams decision. No broader ban is inferred.
6. Honor effective direction, column limits and weights over decorative tiles; use the same eligibility for growth exclusions. Preserve unpinned AUTO output exactly.

The [four-case resize sheet](centered-track-data/review-sheet.png) shows English first-up/last-down, Arabic first-up and Japanese last-down. The [five-case authored-mode sheet](centered-track-data/authored-mode-sheet.png) compares identical content/options before and after. Actual pinned Office visual replacement fonts and automatic per-document script preparation are used, with no system font discovery. The fixtures have no Claude panel or native-raster equivalence claim. ROW intentionally wraps each short sentence onto two lines within its four horizontal cells.

Both sheets were viewed at original detail by author and coordinator. Independent source/geometry and visual review accepts readable, non-overlapping results with the disclosed 130.98px conversion reflow. Two initial bare-core measurement harness attempts failed Arabic glyph selection; the corrected witness uses renderer-resolved geometry through the slide adapter's documented geometry option. These are retained harness failures, not product font fixes. Raw SVG font-license trailing whitespace is preserved deliberately; source-only whitespace checks pass.

## Actual qualification and inherited golden hold

Thirteen focused core/editor controls pass. The existing studio-tracks test passes, retaining its original infeasible request. The maintained Studio browser suite passes 16 checks, including real LTR/RTL mouse movement, keyboard first nudge, history, readonly and accessibility.

Frozen 37eb56ce2 ran Node v24.20.0/pnpm 10.33.2, pnpm check:changed --base 67dd9ec10b7019cb95807f59c75186482c800f10, for 394.1 seconds with no source edits: 14 of 15 stages pass, one fails, no skipped stages. Build, lint, all selected root checks and workspace typecheck pass. Editor completes all 146 contract files (202.4 seconds). Core reports 4,237 passing assertions and one failure (88.4 seconds): the structured template-golden fixture, first inverted-pyramid 1 long. Biome's inherited 1MiB limit skips the large composition.ts file with a warning; TypeScript/build/focused tests and independent source review still run.

The approved finite source-isolation comparison uses exact baseline 67 and candidate 37 composition blobs with identical 76 dependency inputs. All 480 maintained template summaries are identical between sources and match the actual frozen compiled candidate. Ten differ from the existing fixture: inverted-pyramid/org-chart/hierarchy counts 1/5/6 long, plus venn 1 long. Therefore this failure is inherited baseline drift. The structured fixture is owned by golden.yml alongside renderer goldens and remains unchanged; no local generation or promotion occurred. The comparison's first synthetic-stdin dependency-path ENOENT is retained before its corrected successful run.

All per-step logs, first failures, candidate failures, actual source/render outputs, isolated bundles and comparison receipts are retained losslessly in centered-track-data. The protected schema, examples, catalog, other packages, lockfile and golden trees stay unchanged. Final combined integration, pinned goldens, CI, native acceptance, release and sites remain coordinator-owned. No full candidate-green or published/deployed claim is made.
