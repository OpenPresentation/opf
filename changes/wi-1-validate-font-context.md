---
type: fixed
packages: [opf, render, cli]
---
WI-1 (P24): `validate` and `paginate` compose with the role families the renderer draws (new `resolveDrawnFontFamilies`, which `toSvg` now uses too), so a weight the open replacement lacks draws its nearest weight, recorded as a visual substitution, instead of failing the slide. With `loadFonts({ pack: 'office' })` every metric, quote and timeline slide of the default Aptos scheme reported `opf/layout-failed` and skipped its geometry checks (54 of the 291 slide-design audit renders) while `toSvg` drew it; a family no font resolves still fails. `opf validate` now measures with the fonts `opf convert` draws with when `@openpresentation/opf-render` is installed (`checks.layout: "measured"`), as `opf paginate` does; without it the report says the layout was estimated and how to install the renderer.
