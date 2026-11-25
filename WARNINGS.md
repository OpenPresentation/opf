# Keynote 16.0 import warnings (Warnings panel, read by OCR while Keynote was the front app)

Fonttest result (pass A files, rerun without probe): D (helvetica-neue-no-picture-placeholders) panel reads "There aren't any warnings for this presentation." (SAW, warnings-rerun/036/experiments-fonttest/D-*/import-warnings-*.png); B and C, which have picture placeholders, still list "Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside". A and E: the panel was captured before the document loaded ("To view warnings, click or open a presentation."), so not yet known; retry with probe pending.


Source: warningsPanel entries in each run.json (OCR of the captured panel; picture import-warnings-<id>.png next to it). "panel" = a panel was captured for the file. "full?" = the panel picture shows the Replace Fonts button under the list (a hint the list was not cut at the bottom; the list scrolls inside the panel, so a longer list could still hide lines; not verified by scrolling).

## Distinct lines

| line | files | examples |
|---|---|---|
| To view warnings, click or open a presentation. | 61 | warnings-rerun/036/experiments-fonttest/A-default-aptos, warnings-rerun/036/experiments-fonttest/E-aptos-no-picture-placeholders, warnings-rerun/036/inventory/probe-inventory~default, warnings-rerun/036/inventory/probe-inventory~native |
| Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside | 60 | warnings-rerun/036/experiments-fonttest/B-typefaces-safe, warnings-rerun/036/experiments-fonttest/C-helvetica-neue, warnings-rerun/036/languages/lang-latin-3~default, warnings-rerun/036/languages/lang-latin-3~native |
| The font Aptos is missing. Your text might look different. | 55 | warnings-rerun/036/languages/lang-latin-3~default, warnings-rerun/036/languages/lang-latin-3~native, warnings-rerun/036/matrix/m-legacy-auto~default, warnings-rerun/036/matrix/m-links~default |
| The font Aptos Display is missing. Your text might look different. | 52 | warnings-rerun/036/languages/lang-latin-3~default, warnings-rerun/036/languages/lang-latin-3~native, warnings-rerun/036/matrix/m-legacy-auto~default, warnings-rerun/036/matrix/m-links~default |
| The font Roboto is missing. Your text might look different. | 5 | 036/qualification/chart-point-overlays, 036/qualification/duration-timeline, 036/qualification/explicit-chart-reference-lines, 036/qualification/image-callouts |
| SVG images were converted to PNG. | 2 | 036/qualification/coverage-catalogs, 036/qualification/image-callouts |
| The font Roboto Mono is missing. Your text might look different. | 2 | 036/qualification/coverage-composition, 036/qualification/full-feature-tour |
| Unsupported media were removed. Slide Layout(s): Cover, Cover 2, Gallery, Hero, Image, Image beside | 2 | 036/qualification/coverage-furniture, 036/qualification/full-feature-tour |
| There aren't any warnings for this presentation. | 1 | warnings-rerun/036/experiments-fonttest/D-helvetica-neue-no-picture-placeholders |
| Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Cover 1, Gallery, Hero, Image, Image beside | 1 | 036/qualification/coverage-backgrounds |
| The font Roboto Medium is missing. Your text might look different. | 1 | 036/qualification/duration-timeline |
| Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Gallery, Hero, Image, Image beside | 1 | 036/qualification/layout-harvest |
| The font Open Sans is missing. Your text might look different. | 1 | 036/qualification/plantuml-diagrams |
| The font Noto Naskh Arabic is missing. Your text might look different. | 1 | 036/qualification/smartart-arabic |

## Per file

### rerun 0.36.0 warnings-rerun/036/experiments-fonttest

- A-default-aptos [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- B-typefaces-safe [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- C-helvetica-neue [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside
- D-helvetica-neue-no-picture-placeholders [OPENED] panel=yes full?=no: There aren't any warnings for this presentation.
- E-aptos-no-picture-placeholders [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun 0.36.0 warnings-rerun/036/inventory

- probe-inventory~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- probe-inventory~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun 0.36.0 warnings-rerun/036/languages

- lang-cjk~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-cjk~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-cyrillic-greek~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-cyrillic-greek~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-indic~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-indic~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-1~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-1~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-2~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-2~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-latin-3~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- lang-latin-3~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- lang-other~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-other~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-rtl~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-southeast-asia~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- lang-southeast-asia~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun 0.36.0 warnings-rerun/036/layouts

- layouts-little~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-little~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-lots~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-lots~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-ordinary~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-ordinary~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- layouts-ordinary~static [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun 0.36.0 warnings-rerun/036/matrix

- m-agenda~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-charts~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-gallery-anchors~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-legacy-auto~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-legacy-auto~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-links~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-links~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-native-body~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-native-body~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- m-negative-bars~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-preset-preview~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-svg-hsl~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-text-flush-rtl~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-text-flush~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- m-text-flush~native [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- sweep-agenda~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-arrangement~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-arrangement~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-auto~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-auto~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-diagrams~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-diagrams~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-growth~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-growth~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-records~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-records~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-tables~default [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- sweep-tables~native [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### rerun main warnings-rerun/main/main-features

- slide-links~default [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
### B 0.36.0 qualification 036/qualification

- chart-point-overlays [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Roboto is missing. Your text might look different.
- chart-type-sampler [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- columns [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- compliance-readiness-review [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-backgrounds [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 0, Cover 1, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-catalogs-off [OPENED] panel=yes full?=yes: The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-catalogs [OPENED] panel=yes full?=no: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || SVG images were converted to PNG.
- coverage-charts [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-composition [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Roboto Mono is missing. Your text might look different.
- coverage-design [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-diagrams [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-furniture [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Cover 2, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-images [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-languages [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
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
- coverage-text [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- coverage-variables [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- coverage-warnings [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- data-story-academy [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
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
- smartart-arabic [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos is missing. Your text might look different. || The font Noto Naskh Arabic is missing. Your text might look different.
- smartart-japanese [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- smartart [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- smartart~shapes [OPENED] panel=yes full?=yes: Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside || The font Aptos Display is missing. Your text might look different. || The font Aptos is missing. Your text might look different.
- table-and-code [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
- trees-and-sets [OPENED] panel=yes full?=no: To view warnings, click or open a presentation.
### B 0.35.1 qualification 0351/qualification

- chart-point-overlays [OPENED] panel=no full?=no: (no lines)
