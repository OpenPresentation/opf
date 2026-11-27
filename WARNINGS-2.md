# Keynote 16.0 import warnings (Warnings panel, read by OCR while Keynote was the front app)

(WARNINGS-2: reruns of 2026-11-27 override the earlier captures of the same file.)

Source: warningsPanel entries in each run.json (OCR of the captured panel; picture import-warnings-<id>.png next to it). "panel" = a panel was captured for the file. "full?" = the panel picture shows the Replace Fonts button under the list (a hint the list was not cut at the bottom; the list scrolls inside the panel, so a longer list could still hide lines; not verified by scrolling).

## Distinct lines

| line | files | examples |
|---|---|---|
| To view warnings, click or open a presentation. | 208 | 0351/qualification/chart-type-sampler, 0351/qualification/columns, 0351/qualification/compliance-readiness-review, 0351/qualification/coverage-backgrounds |
| Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside | 174 | warnings-rerun/036/experiments-fonttest/B-typefaces-safe, warnings-rerun/036/experiments-fonttest/C-helvetica-neue, warnings-rerun/036/languages/lang-latin-3~default, warnings-rerun/036/languages/lang-latin-3~native |
| The font Aptos is missing. Your text might look different. | 133 | warnings-rerun/036/languages/lang-latin-3~default, warnings-rerun/036/languages/lang-latin-3~native, warnings-rerun/036/matrix/m-legacy-auto~default, warnings-rerun/036/matrix/m-links~default |
| The font Aptos Display is missing. Your text might look different. | 125 | warnings-rerun/036/languages/lang-latin-3~default, warnings-rerun/036/languages/lang-latin-3~native, warnings-rerun/036/matrix/m-legacy-auto~default, warnings-rerun/036/matrix/m-links~default |
| SVG images were converted to PNG. | 11 | 036/qualification/coverage-catalogs, 036/qualification/image-callouts, 0351/qualification/coverage-catalogs, 0351/qualification/image-callouts |
| The font Roboto is missing. Your text might look different. | 9 | 036/qualification/chart-point-overlays, 036/qualification/duration-timeline, 036/qualification/explicit-chart-reference-lines, 036/qualification/image-callouts |
| The font Roboto Mono is missing. Your text might look different. | 7 | 036/qualification/coverage-composition, 036/qualification/full-feature-tour, 036/examples/layout-sampler~default, 036/examples/table-and-code~default |
| The font Segoe Ul is missing. Your text might look different. | 4 | 036/examples/district-literacy-acceleration-plan~default, 036/examples/district-literacy-acceleration-plan~native, 036/examples/managed-detection-market-update~default, 036/examples/managed-detection-market-update~native |
| The font Grandview is missing. Your text might look different. | 4 | 036/examples/employee-town-hall-run-of-show~default, 036/examples/employee-town-hall-run-of-show~native, 036/examples/food-bank-distribution-capacity-plan~default, 036/examples/food-bank-distribution-capacity-plan~native |
| Unsupported media were removed. Slide Layout(s): Cover, Cover 2, Gallery, Hero, Image, Image beside | 3 | 036/qualification/coverage-furniture, 036/qualification/full-feature-tour, 0351/qualification/coverage-furniture |
| The font Roboto Medium is missing. Your text might look different. | 2 | 036/qualification/duration-timeline, 0351/qualification/duration-timeline |
| The font Open Sans is missing. Your text might look different. | 2 | 036/qualification/plantuml-diagrams, 0351/qualification/plantuml-diagrams |
| Stacked Line charts aren't supported and were converted to regular Line chart type. Slide(s) 3 | 2 | 036/examples/district-literacy-acceleration-plan~default, 036/examples/district-literacy-acceleration-plan~native |
| The font Grandview Display is missing. Your text might look different. | 2 | 036/examples/food-bank-distribution-capacity-plan~default, 036/examples/food-bank-distribution-capacity-plan~native |
| The font Montserrat is missing. Your text might look different. | 2 | 036/examples/grant-equity-review~default, 036/examples/grant-equity-review~native |
| The font Segoe Ul Semibold is missing. Your text might look different. | 2 | 036/examples/managed-detection-market-update~default, 036/examples/managed-detection-market-update~native |
| The font Lucida Sans is missing. Your text might look different. | 2 | 036/examples/partner-ecosystem-launch-kit~default, 036/examples/partner-ecosystem-launch-kit~native |
| The font Segoe Ul Light is missing. Your text might look different. | 2 | 036/examples/stem-lab-funding-proposal~default, 036/examples/stem-lab-funding-proposal~native |
| There aren't any warnings for this presentation. | 1 | warnings-rerun/036/experiments-fonttest/D-helvetica-neue-no-picture-placeholders |
| Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Cover 1, Gallery, Hero, Image, Image beside | 1 | 036/qualification/coverage-backgrounds |
| Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Gallery, Hero, Image, Image beside | 1 | 036/qualification/layout-harvest |
| The font Noto Naskh Arabic is missing. Your text might look different. | 1 | 036/qualification/smartart-arabic |
| The font Tenorite Display is missing. Your text might look different. | 1 | 036/examples/monthly-board-update~default |
| The font Tenorite is missing. Your text might look different. | 1 | 036/examples/monthly-board-update~default |
| The font Constantia is missing. Your text might look different. | 1 | 036/examples/rural-broadband-expansion-proposal~native |
| Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside, Image beside 2 | 1 | warnings-rerun2/036/matrix/sweep-growth~native |

## Per file

### rerun 0.36.0 warnings-rerun/036/experiments-fonttest

- B-typefaces-safe [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- C-helvetica-neue [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- D-helvetica-neue-no-picture-placeholders [OPENED] panel=yes full?=no: There aren't any warnings for this presentation.
### rerun 0.36.0 warnings-rerun/036/languages

- lang-latin-3~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- lang-latin-3~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### rerun 0.36.0 warnings-rerun/036/matrix

- m-legacy-auto~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-links~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-links~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-native-body~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-native-body~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-text-flush~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### rerun main warnings-rerun/main/main-features

- slide-links~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### B 0.36.0 qualification 036/qualification

- chart-point-overlays [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different.
- chart-type-sampler [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- columns [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-backgrounds [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Cover 1, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-catalogs-off [OPENED] panel=yes full?=yes: The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-catalogs [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG.
- coverage-composition [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- coverage-diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-furniture [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 2, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-images [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-lists [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-metadata [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-overlays [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-regions [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-shape-presets [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-shape-styles [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-16x10 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-16x9 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-1x1 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-4x3 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-4x5 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-9x16 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-a4 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-letter [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-standard [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-tables [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-template [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-variables [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-warnings [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagram-connectors [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagrams-markdown [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagrams~picture [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- dot-diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- duration-timeline [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto Medium is missing. Your text might look different. || The font Roboto is missing. Your text might look different.
- explicit-chart-reference-lines [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different.
- footers [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- footers~static [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- full-feature-tour [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 2, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- header-footer-logo-set [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- image-callouts [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different. || SVG images were converted to PNG.
- inverted-pyramids [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- layout-harvest [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- localized-chart-references [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- localized-timeline [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- plantuml-diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Open Sans is missing. Your text might look different.
- shape-effects [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- shape-overlays-rtl [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- shape-overlays [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- shapes [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- singleton-combo-reference-lines [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different.
- smartart-arabic [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Noto Naskh Arabic is missing. Your text might look different.
- smartart-japanese [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- smartart~shapes [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### B 0.35.1 qualification 0351/qualification

- chart-point-overlays [OPENED] panel=no full?=no: (no lines)
- chart-type-sampler [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- columns [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- compliance-readiness-review [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-backgrounds [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-catalogs-off [OPENED] panel=yes full?=yes: The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-catalogs [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG.
- coverage-charts [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-composition [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-design [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-diagrams [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-furniture [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 2, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-images [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-languages [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-lists [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-metadata [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-overlays [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-regions [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-shape-presets [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-shape-styles [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-size-16x10 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-16x9 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-1x1 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-4x3 [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-size-4x5 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-9x16 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-a4 [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-letter [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-size-standard [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-tables [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-template [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-text [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-variables [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-warnings [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- data-story-academy [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- diagram-connectors [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagrams-markdown [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- diagrams~picture [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- dot-diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- duration-timeline [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto Medium is missing. Your text might look different. || The font Roboto is missing. Your text might look different.
- explicit-chart-reference-lines [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different.
- footers [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- footers~static [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- full-feature-tour [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- header-footer-logo-set [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- image-callouts [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different. || SVG images were converted to PNG.
- inverted-pyramids [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- layout-harvest [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layout-harvest~native-body [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layout-sampler [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layout-sampler~native-body [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- localized-chart-references [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- localized-timeline [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- multilingual-slides [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- plantuml-diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Open Sans is missing. Your text might look different.
- shape-effects [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- shape-overlays-rtl [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- shape-overlays [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- shapes [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- singleton-combo-reference-lines [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different.
- smartart-arabic [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- smartart-japanese [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- smartart [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- smartart~shapes [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- table-and-code [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- trees-and-sets [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### B 0.36.0 examples 036/examples

- advising-retention-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- advising-retention-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- airline-disruption-recovery-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- airline-disruption-recovery-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- alumni-giving-campaign~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- alumni-giving-campaign~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- ambulatory-access-recovery-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- ambulatory-access-recovery-plan~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- apprenticeship-partnership-deck~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- apprenticeship-partnership-deck~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- arabic-digital-services-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- arabic-digital-services-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- asset-source-forms~default [OPENED] panel=no full?=no: (no lines)
- athletics-budget-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- athletics-budget-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- battery-line-supplier-readiness~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- battery-line-supplier-readiness~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- block-composition~default [OPENED] panel=no full?=no: (no lines)
- boutique-hotel-revenue-recovery~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- boutique-hotel-revenue-recovery~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- branch-modernization-investment-case~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- branch-modernization-investment-case~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- brazil-climate-adaptation-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- brazil-climate-adaptation-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- broadband-public-hearing-deck~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- broadband-public-hearing-deck~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- campus-energy-action-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- campus-energy-action-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- catalog-overrides~default [OPENED] panel=no full?=no: (no lines)
- catalog-overrides~native [OPENED] panel=no full?=no: (no lines)
- chart-colors~default [OPENED] panel=no full?=no: (no lines)
- chart-data-sources~default [OPENED] panel=no full?=no: (no lines)
- chart-highlight~default [OPENED] panel=no full?=no: (no lines)
- chart-point-overlays~default [OPENED] panel=no full?=no: (no lines)
- chart-type-sampler~default [OPENED] panel=no full?=no: (no lines)
- claims-triage-operating-model~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG.
- claims-triage-operating-model~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG.
- cold-chain-waste-reduction-review~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- cold-chain-waste-reduction-review~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- color-variants~default [OPENED] panel=no full?=no: (no lines)
- color-variants~native [OPENED] panel=no full?=no: (no lines)
- columns~default [OPENED] panel=no full?=no: (no lines)
- columns~native [OPENED] panel=no full?=no: (no lines)
- compliance-readiness-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- compliance-readiness-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- construction-safety-stand-down~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- construction-safety-stand-down~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- consulting-margin-recovery-plan~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- consulting-margin-recovery-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- content-payload-matrix~default [OPENED] panel=no full?=no: (no lines)
- content-payload-matrix~native [OPENED] panel=no full?=no: (no lines)
- contract-cycle-time-brief~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- contract-cycle-time-brief~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- court-backlog-reduction-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- curriculum-approval-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- curriculum-approval-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- customer-qbr-renewal-deck~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- customer-qbr-renewal-deck~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-incident-postmortem~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-incident-postmortem~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-platform-migration-plan~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-platform-migration-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-story-academy-corporate-programs~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-story-academy-corporate-programs~static [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-storytelling-atlas~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- data-storytelling-atlas~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- defect-escape-reduction-review~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- defect-escape-reduction-review~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- demand-generation-campaign-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- demand-generation-campaign-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- design-backgrounds~default [OPENED] panel=no full?=no: (no lines)
- design-backgrounds~native [OPENED] panel=no full?=no: (no lines)
- developer-conference-talk~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- developer-conference-talk~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- digital-services-modernization~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- digital-services-modernization~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- district-literacy-acceleration-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || Stacked Line charts aren't supported and were converted to regular Line chart type. Slide(s) 3 || The font Segoe Ul is missing. Your text might look different.
- district-literacy-acceleration-plan~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || Stacked Line charts aren't supported and were converted to regular Line chart type. Slide(s) 3 || The font Segoe Ul is missing. Your text might look different.
- dot-diagrams~default [OPENED] panel=no full?=no: (no lines)
- dot-diagrams~native [OPENED] panel=no full?=no: (no lines)
- drive-thru-throughput-playbook~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- drive-thru-throughput-playbook~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- duration-timeline~default [OPENED] panel=no full?=no: (no lines)
- dynamic-composition~default [OPENED] panel=no full?=no: (no lines)
- dynamic-composition~native [OPENED] panel=no full?=no: (no lines)
- employee-town-hall-run-of-show~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Grandview is missing. Your text might look different.
- employee-town-hall-run-of-show~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Grandview is missing. Your text might look different.
- engineering-capacity-planning~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- engineering-capacity-planning~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- enterprise-account-expansion-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- executive-workshop-facilitation~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- executive-workshop-facilitation~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- explicit-chart-reference-lines~default [OPENED] panel=no full?=no: (no lines)
- fan-experience-operations-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- field-enablement-certification~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- field-enablement-certification~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- food-bank-distribution-capacity-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Grandview Display is missing. Your text might look different. || The font Grandview is missing. Your text might look different.
- food-bank-distribution-capacity-plan~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Grandview Display is missing. Your text might look different. || The font Grandview is missing. Your text might look different.
- full-feature-tour~default [OPENED] panel=no full?=no: (no lines)
- full-feature-tour~native [OPENED] panel=no full?=no: (no lines)
- fy27-budget-tradeoff-deck~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- fy27-budget-tradeoff-deck~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- german-works-council-update~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- german-works-council-update~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- grant-equity-review~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Montserrat is missing. Your text might look different.
- grant-equity-review~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Montserrat is missing. Your text might look different.
- grid-resilience-capital-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- grid-resilience-capital-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- grid-spans~default [OPENED] panel=no full?=no: (no lines)
- grid-spans~native [OPENED] panel=no full?=no: (no lines)
- header-footer-logo-set~default [OPENED] panel=no full?=no: (no lines)
- header-footer-logo-set~native [OPENED] panel=no full?=no: (no lines)
- housing-zoning-council-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- housing-zoning-council-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- icons-and-arrangements~default [OPENED] panel=no full?=no: (no lines)
- identity-incident-executive-brief~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- identity-incident-executive-brief~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- image-callouts~default [OPENED] panel=no full?=no: (no lines)
- india-rural-payments-pilot~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- india-rural-payments-pilot~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- inverted-pyramids~default [OPENED] panel=no full?=no: (no lines)
- investor-relations-update~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- investor-relations-update~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- japan-market-entry-readout~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- japan-market-entry-readout~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- kiosk-orientation-deck~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- kiosk-orientation-deck~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- language-and-writing~default [OPENED] panel=no full?=no: (no lines)
- layout-sampler~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- layout-sampler~native [OPENED] panel=no full?=no: (no lines)
- library-modernization-roadmap~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- library-modernization-roadmap~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- localized-chart-references~default [OPENED] panel=no full?=no: (no lines)
- localized-timeline~default [OPENED] panel=no full?=no: (no lines)
- managed-detection-market-update~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Segoe Ul is missing. Your text might look different. || The font Segoe Ul Semibold is missing. Your text might look different.
- managed-detection-market-update~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Segoe Ul is missing. Your text might look different. || The font Segoe Ul Semibold is missing. Your text might look different.
- manager-training-deck~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- manager-training-deck~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- markdown-diagrams~default [OPENED] panel=no full?=no: (no lines)
- markdown-diagrams~native [OPENED] panel=no full?=no: (no lines)
- media-and-follow-up~default [OPENED] panel=no full?=no: (no lines)
- media-and-follow-up~native [OPENED] panel=no full?=no: (no lines)
- metadata-array-forms~default [OPENED] panel=no full?=no: (no lines)
- metadata-array-forms~native [OPENED] panel=no full?=no: (no lines)
- metrics-quotes-timeline~default [OPENED] panel=no full?=no: (no lines)
- minimal~default [OPENED] panel=no full?=no: (no lines)
- minimal~native [OPENED] panel=no full?=no: (no lines)
- mixed-use-leasing-pipeline-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- mixed-use-leasing-pipeline-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- model-governance-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- model-governance-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- monthly-board-update~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Tenorite Display is missing. Your text might look different. || The font Tenorite is missing. Your text might look different.
- monthly-board-update~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- multilingual-slides~default [OPENED] panel=no full?=no: (no lines)
- narrative-beats~default [OPENED] panel=no full?=no: (no lines)
- narrative-beats~native [OPENED] panel=no full?=no: (no lines)
- onboarding-experience-redesign~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- onboarding-experience-redesign~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- online-program-launch-plan~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- online-program-launch-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- outline~default [OPENED] panel=no full?=no: (no lines)
- parks-master-plan-workshop~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- parks-master-plan-workshop~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- partner-ecosystem-launch-kit~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG. || The font Lucida Sans is missing. Your text might look different.
- partner-ecosystem-launch-kit~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG. || The font Lucida Sans is missing. Your text might look different.
- photo-essay-portfolio~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- photo-essay-portfolio~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- plantuml-diagrams~default [OPENED] panel=no full?=no: (no lines)
- police-training-program-update~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- police-training-program-update~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- policy-briefing-for-advisors~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- policy-briefing-for-advisors~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- port-dwell-time-improvement-plan~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- port-dwell-time-improvement-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- pricing-and-packaging-decision~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- pricing-and-packaging-decision~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- product-launch-narrative~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- product-launch-narrative~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- product-roadmap-decision-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- product-roadmap-decision-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- promoted-region-grid~default [OPENED] panel=no full?=no: (no lines)
- promoted-region-grid~native [OPENED] panel=no full?=no: (no lines)
- quarterly-review~default [OPENED] panel=no full?=no: (no lines)
- quarterly-review~native [OPENED] panel=no full?=no: (no lines)
- recycling-participation-campaign~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- recycling-participation-campaign~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- regulatory-risk-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- renewal-save-plan~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- renewal-save-plan~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- research-findings-report~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- research-findings-report~native [OPENED] panel=no full?=no: (no lines)
- research-grant-pitch~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- research-grant-pitch~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- retail-launch-readiness-deck~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- retail-launch-readiness-deck~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- revenue-forecast-inspection~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- revenue-forecast-inspection~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- rich-text-runs~default [OPENED] panel=no full?=no: (no lines)
- rich-text-runs~native [OPENED] panel=no full?=no: (no lines)
- robotics-quality-escape-briefing~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- robotics-quality-escape-briefing~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- root-content~default [OPENED] panel=no full?=no: (no lines)
- root-content~native [OPENED] panel=no full?=no: (no lines)
- rows-chart~default [OPENED] panel=no full?=no: (no lines)
- rows-chart~native [OPENED] panel=no full?=no: (no lines)
- rural-broadband-expansion-proposal~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- rural-broadband-expansion-proposal~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Constantia is missing. Your text might look different. || SVG images were converted to PNG.
- s-and-op-exception-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- s-and-op-exception-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- satellite-maintenance-readiness-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- satellite-maintenance-readiness-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- school-safety-preparedness-brief~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- school-safety-preparedness-brief~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- scope-3-reporting-readiness~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- scope-3-reporting-readiness~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- seed-pitch-for-climate-risk-api~default [OPENED] panel=no full?=no: (no lines)
- seed-pitch-for-climate-risk-api~native [OPENED] panel=no full?=no: (no lines)
- shape-effects~default [OPENED] panel=no full?=no: (no lines)
- shape-overlays-rtl~default [OPENED] panel=no full?=no: (no lines)
- shape-overlays~default [OPENED] panel=no full?=no: (no lines)
- shape-overlays~native [OPENED] panel=no full?=no: (no lines)
- shapes~default [OPENED] panel=no full?=no: (no lines)
- singleton-combo-reference-lines~default [OPENED] panel=no full?=no: (no lines)
- slide-design-overrides~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- slide-design-overrides~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- slide-sections~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- slide-sections~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- special-education-services-plan~default [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- special-education-services-plan~native [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- stem-lab-funding-proposal~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Segoe Ul Light is missing. Your text might look different. || SVG images were converted to PNG.
- stem-lab-funding-proposal~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Segoe Ul Light is missing. Your text might look different. || SVG images were converted to PNG.
- strategy-offsite-pre-read~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- strategy-offsite-pre-read~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- streaming-churn-winback-strategy~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- streaming-churn-winback-strategy~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- student-mental-health-capacity-review~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- student-mental-health-capacity-review~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- supplier-risk-heatmap~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- supplier-risk-heatmap~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- support-deflection-program~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- support-deflection-program~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- table-and-code~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- table-and-code~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- table-cell-types~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- tailings-monitoring-investment-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- tailings-monitoring-investment-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- tax-portal-modernization~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- tax-portal-modernization~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- technical-diagrams~default [OPENED] panel=no full?=no: (no lines)
- technical-diagrams~native [OPENED] panel=no full?=no: (no lines)
- transit-corridor-alternatives~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- trees-and-sets~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- trial-enrollment-rescue-plan~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- trial-enrollment-rescue-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- vaccination-outreach-briefing~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- vaccination-outreach-briefing~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- veterinary-staffing-stabilization~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- veterinary-staffing-stabilization~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- video-demo-sales-narrative~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- video-demo-sales-narrative~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- visual-brand-system-sampler~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- visual-brand-system-sampler~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- water-stewardship-grower-brief~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- water-stewardship-grower-brief~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- water-utility-capital-plan~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- water-utility-capital-plan~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- wildfire-evacuation-preparedness~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- wildfire-evacuation-preparedness~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- workforce-pathway-partnership~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- workforce-pathway-partnership~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- workforce-reskilling-initiative~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- workforce-reskilling-initiative~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- workplace-occupancy-reset~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- workplace-occupancy-reset~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### B main qualification main/qualification

- variable-limits [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### rerun2 0.36.0 warnings-rerun2/036/experiments-fonttest

- A-default-aptos [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- E-aptos-no-picture-placeholders [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun2 0.36.0 warnings-rerun2/036/inventory

- probe-inventory~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- probe-inventory~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun2 0.36.0 warnings-rerun2/036/languages

- lang-cjk~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-cjk~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-cyrillic-greek~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-cyrillic-greek~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- lang-indic~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-indic~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-1~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-1~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-2~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-2~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- lang-other~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-other~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-rtl~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-southeast-asia~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-southeast-asia~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun2 0.36.0 warnings-rerun2/036/layouts

- layouts-little~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-little~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-lots~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-lots~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-ordinary~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-ordinary~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-ordinary~static [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun2 0.36.0 warnings-rerun2/036/matrix

- m-agenda~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-charts~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-gallery-anchors~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- m-legacy-auto~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-negative-bars~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-preset-preview~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-svg-hsl~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-text-flush-rtl~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-text-flush~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-agenda~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-arrangement~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-arrangement~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-auto~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-auto~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-diagrams~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-diagrams~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-growth~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-growth~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside, Image beside 2 || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-records~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-records~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-tables~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-tables~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun2 0.36.0 warnings-rerun2/036/qualification

- compliance-readiness-review [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-charts [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-design [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-languages [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-text [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- data-story-academy [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layout-harvest~native-body [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layout-sampler [OPENED] panel=no full?=no: (no lines)
- layout-sampler~native-body [OPENED] panel=no full?=no: (no lines)
- multilingual-slides [OPENED] panel=no full?=no: (no lines)
- smartart [OPENED] panel=no full?=no: (no lines)
- table-and-code [OPENED] panel=no full?=no: (no lines)
- trees-and-sets [OPENED] panel=no full?=no: (no lines)
