# Metric outline placement candidate

Core product commit `476fdb2f5547e442d8a270047dfc8557f306bb49` extends bounded metric fitting to available vector outlines and explicit raster clearance. It uses the merged physical font selectors in renderer `44ff76fe19ae9de80d2aaa962aa7e43fabce02bc` and PPTX `cb297be6038b4ec6a84761693b6a7c9e4a4f518d`; editor remains `6e0b7d2f1b4369fc0a228391cf36e913e05188f8`. No package version, release plan or deployment changes.

Previously a width-fitting metric could accept tall/overhanging glyph ink outside its cell despite having an outline provider. The retained 38-case observational probe includes 36 actual open-font cases and two adversarial outline-provider controls. The two controls expose accepted out-of-cell ink before repair; the same observations contain no outliers afterward. They are vector measurements, not native paint.

The implementation measures each exact source segment around literal tabs, unions its line outlines, and uses the shared text placement primitive inside the existing bounded candidate search. Fitting includes occupied ink height and horizontal clearance. Inline value/unit fields keep a common accepted baseline; related stacked fields remain compact. Source, whitespace, scalar types, selected readability floors and empty-value editor targets remain intact. Width-only providers retain their prior geometry; zero raster padding is explicit. Malformed measurements or irreducible outlines reject.

All 489 core tests pass on Node 24. The 22 focused metric tests pass on Node 20. Existing renderer/PPTX metric suites verify 36 aligned source/geometry cases, strict rejection, XML guards and native provenance recovery. Typecheck and lint pass with existing warnings. The actual browser harness renders 96 wide/portrait, left/center/right cases using exact open Carlito/Roboto faces under each Node runtime. It verifies source, accepted segment origins/advances within 0.1 reference pixels, and every nonzero mask pixel center within the cell plus 0.1 pixel. All pass with zero page errors or external requests. Each mask, hash and report is retained.

The width-only browser control **also passes all 96 cases**. It does not reproduce the separate PowerPoint/Calibri portrait ink failure. The representative portrait renders were inspected: content remains intact, with the pre-existing sparse tall layout and low-contrast value color visible. This is no overall visual-quality certification. The eight native tab outliers remain unresolved. Fresh bounded Windows measurements on the exact candidate graph are requested through [PPTX #21](https://github.com/OpenPresentation/opf-pptx/pull/21).

`windows-chart-independent-review.json` concerns the separate historical chart evidence commit `a4e7e9b9b5810144b1f116d45a92bc71e1484c78`. The Mac independently executed 384 imports and 384 separate chart-cache parses, checked raw live/native series and saved raster changes, and reviewed the native-created pie control. Loaded pie category getters remain unavailable; exact live categories and persisted caches supply separate observations. This does not concern the new metric runtime.

Reproduce with locked dependencies and four coordinated named sibling checkouts:

```sh
pnpm build
node scripts/link-ecosystem.mjs --packages-only
pnpm --filter @openpresentation/opf test
node scripts/test-metric-outline-browser.mjs artifacts/metric-outline-browser
node scripts/test-metric-outline-browser.mjs artifacts/metric-outline-width-only --width-only
pnpm pack:ecosystem
pnpm test:packed-ecosystem
pnpm test:packed-browser
```

Browser reports bind the core source/runtime, verifier and font bytes. Native Office gates, full review/CI, coordinated new releases and public-site adoption remain required.
