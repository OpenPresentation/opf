# Table colors and gallery contrast checkpoint

[summary.json](summary.json) binds 75 artifacts (about 4.1 MB) to the source branches recorded there. These are unpublished, linked-source checks. Clean candidate installations, coordinated CI/review, full visual acceptance and publication remain separate gates. The older metric/native evidence is preserved without relabeling it as a fresh run.

## Confirmed behavior

Core's inherited table text-color rule is shared by SVG and PPTX: preserve a sufficient inherited color, otherwise choose readable black or white against an opaque cell fill. Explicit cell and rich-run colors are retained, and translucent fills receive no guessed-backdrop contrast claim. [The API and policy](../../table-text-colors.md) describe the boundaries.

Node 20.20.2 and 24.20.0 pass all 469 core tests, preservation suites, workspace typechecks and example validation. Lint exits zero with existing nonfatal diagnostics. PPTX full commands and focused code/metric checks pass on both runtimes. Renderer full commands remain nonzero at the unpromoted corpus gate; the commands after that gate were run separately and pass. Logs and invocation records are included.

Real PowerPoint 16.0.20326.20132 on Windows 26200.9445 opens, saves and reopens six generated editable tables per runtime. Every source character and its RGB text color matches: **48 original/reopened cell observations and 624 character-color observations per runtime**. Functional runtime hashes and original PPTX bytes match across Node versions. Native PNG hashes match across both runtimes and save/reopen. The six `native-table-slide-*.png` files therefore represent all corresponding original/reopened images named in both native reports. [The editable fixture](table-colors.pptx), native saved files and [overview](native-table-sheet.png) are included. Cases 5 and 6 intentionally preserve unreadable translucent/explicit colors; they test override preservation, not accessibility.

## Gallery findings remain open

The generator and 96 existing decks have 725 narrowly scoped color revisions. The preservation verifier binds the previous corpus to GitHub core `7a625546a23ca8a0dbe5a0e87d5cc56daee224ac` and the current source to the built examples. It allows only enumerated palette slots, gradient stop colors and the original emphasized outcome's color. Content, metric values/units, metadata and geometry are unchanged. All **805 previous and 805 current PNGs** match their respective manifests. The current corpus digest is `a7c34efedca3f700b475d15e02f83b6adab667de4046f1d1ebdf538ec2517078`; **656 rasters differ**. This is integrity evidence, not visual acceptance. The prior renderer checkpoint is `647368a481d316c390671fe4d33803cd08b933a6`.

[Selected before/after pairs](gallery-selected-pairs.png) were inspected: the gradient example improves text/background separation; the dark chart still exposes an unreadable-label defect. The final sparse slide is an unchanged control. The complete 656-slide visual review has not happened and no golden baseline is promoted.

The conservative browser audit covers 100 gallery decks, 720 slides and 11,691 text runs. It retains **962 rectangle findings**: 610 watermark placeholders, 224 header-image placeholders, 80 background-image placeholders, 20 chart labels and 28 other content rectangles. Grouping does not exclude or dismiss any finding. The historical exploratory run recorded 1,454 findings; it lacks the newer full runtime fingerprint and is not clean-candidate proof. The audit measures declared text color against backgrounds under entire browser font rectangles. It can include spaces, border pixels and areas outside the glyphs. Available system fonts can affect boxes, and shared-opacity composition is approximate. It does not certify WCAG or exact per-glyph font resolution.

One finding is independently resolved by [actual browser screenshots and a glyph-mask check](metric-border-browser.json): the compliance example's metric-value rectangle touches a colored panel border, reporting 1.588:1. The border pixel contains no text ink. The 1,365 actual glyph pixels have a minimum ratio of 7.013:1 using the declared foreground and the background screenshot, above that case's 3:1 criterion. Anti-aliased foreground colors are not used in the ratio. This confirms only this counterexample; other findings remain open.

## Reproduce and continue

Use the GitHub source refs in `summary.json`, supported Node 20.20.2 or 24.20.0, npm 11.16.0 and pnpm 10.33.2. Prepare sibling checkouts and the documented source links in the integration plan. Run package commands listed in the `*-checks.json` records. `check-runner.mjs` preserves the exact command sequence from the parent-of-checkouts runner; it is an invocation record, not a self-contained installed tool.

From core:

```powershell
node scripts/audit-svg-contrast.mjs artifacts/gallery-contrast-current.json
node scripts/review-contrast-border.mjs
node scripts/review-gallery-contrast.mjs <previous-golden-directory> <current-golden-directory>
```

The first command currently exits 1 and keeps all findings. Generate each golden directory from its respective GitHub core/renderer checkpoint with the renderer's `node test/golden.mjs --update` and a distinct `OPF_GOLDEN_OUT`; `--update` only creates a candidate. Prior artifact directory names alone are insufficient: the verifier checks all PNG bytes and both source manifests.

From PPTX, separately in each supported Node environment:

```powershell
node test/native-table-colors.mjs generate artifacts/native-table-colors
powershell -NoProfile -File test/native-table-colors.ps1 -EvidenceDirectory artifacts/native-table-colors
node test/native-table-colors.mjs compare artifacts/native-table-colors
```

Only the generated decks are opened and closed. PowerPoint and unrelated user presentations remain untouched. Proprietary PowerPoint is an optional compatibility-test host, never a runtime dependency.

Next fix the confirmed dark-chart label/background mismatch, investigate unresolved placeholder behavior and other content findings, and review the changed corpus. The existing metric tab-position and portrait-label native raster counterexamples remain open and were not rerun for this color milestone. Complete coordinated source/clean-candidate CI and PR review before release preparation. Schema validity, serialized styles, actual browser glyph behavior, PNG regression stability and native export fidelity remain distinct results.
