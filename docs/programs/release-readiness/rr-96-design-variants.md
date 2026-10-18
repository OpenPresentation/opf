# RR-96: color scheme variants and scheme-derived neutrals

Opened 2026-10-18 by the owner after the first-use color audit. Branches `codex/rr-96-<slug>`, PR titles `RR-96: `. Target: core, renderer, PPTX and editor 0.23.0, with a gallery release for theme variants.

## Goal

OPF handles light and dark slides the way PowerPoint does. A deck has one color scheme of 12 slots. A variant is a mapping over those same slots, never a second scheme: which slot is the background and which is the text, plus an optional accent order. Every color OPF draws comes from the scheme through that mapping, so text and lines stay readable in the preview and after someone changes the variant or background style in PowerPoint.

## How PowerPoint does it

- The theme holds one `clrScheme` of 12 slots: dk1, lt1, dk2, lt2, accent1 to accent6, hlink, folHlink.
- The slide master's `<p:clrMap>` maps the roles bg1, tx1, bg2, tx2 (and the accents) onto those slots. Content refers to roles (`schemeClr tx1`), not hex values.
- A dark variant or background style swaps the map (`bg1=dk1 tx1=lt1 bg2=dk2 tx2=lt2`). Everything that refers to a role flips with it.
- A layout or slide can override the map (`<p:clrMapOvr><a:overrideClrMapping/>`). The map can also re-point accents (`accent1="accent2"`), which is how a variant reorders accents inside one scheme.
- Lines are derived, not fixed: chart gridlines are `tx1` at about 15% (`lumMod 15000, lumOff 85000`), axis lines about 25%, axis labels about 65%. Table borders come from table styles that refer to scheme colors.
- Background styles (`<p:bgRef idx="1001-1003">`) index the theme's `bgFillStyleLst` with a scheme color.

## How OPF does it today (core 0.22.0)

- `colorScheme` has the 12 slots plus the roles primary, secondary, accent, background, surface, text and textSecondary.
- Light or dark is guessed per slide from the background's luminance (`isDarkColor` in `resolveColorRoles`, `color.ts`). Image and gradient backgrounds always count as light.
- The PPTX export writes the default master map and no overrides. Dark slides are built by inverting colors by hand.
- These colors are fixed literals rather than scheme-derived: `roles.border` (#CBD5E1 / #475569); the code panel, plain text, label, comment and some syntax hues; the metric neutral trend; table header text and the video play icon (#FFFFFF); the chart axis line, the pie and treemap outlines and the scatter gridline. The preview strokes the chart frame and the PPTX does not. The preview ignores `chart.colors`.
- The PPTX writes chart text, borders, table fills and code as `srgbClr`, so a variant or background-style change in PowerPoint only half works.
- Import reads `clrMap`, `clrMapOvr` and `bgRef`, but returns literal colors instead of slots.
- Variants do not exist. The gallery's "dark" theme is a separate theme.

Evidence: the color audit and background-variant investigation of 2026-10-18 (test decks under the coordinator's scratchpad, summarized in the PR that opens this item).

## Design

### Schema

```json
"design": { "variant": { "background": "light1", "accents": ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] } }
```

- `variant.background`: `light1 | light2 | dark1 | dark2`. It sets the map: `light1` is the default map; `dark1` maps bg1=dk1, tx1=lt1, bg2=dk2, tx2=lt2; `light2` and `dark2` map bg1 to that slot with the matching text slot.
- `variant.accents`: optional permutation of the six accent slots (the accent order of a variant).
- Allowed on `design` (deck) and `slides[n].design` (per slide). The existing `design.background` slot shorthand stays and implies `variant.background`.
- Image and gradient backgrounds take `tone: "dark" | "light"`, which picks the map. Without it, today's luminance rule stays as the fallback.
- Theme records gain `variants: [{ "id", "name", "variant" }]` (for example light, light-alt, dark, dark-alt). Color-scheme records keep one scheme.

### Roles

`resolveColorRoles(scheme, { variant })` maps through the variant instead of guessing:

| Role | From |
| --- | --- |
| background | bg1 |
| text | tx1 |
| textSecondary | tx2 |
| surface | bg2 |
| border, gridlines, chart axis | tx1 mixed into bg1 (about 15 to 25%) |
| chart text | tx1 mixed into bg1 (about 65%) |
| table header text | readable on the header fill (tx1 or bg1) |
| code panel and text | tx1 or tx2 panel with its readable text; comment from tx1 mixed; label from an accent |
| metric neutral trend | tx2 |
| video play icon, pie and treemap outlines | bg1 |
| primary, secondary, accent | accent1 to accent3 after `variant.accents` |

### Export and import

- PPTX writes the master `clrMap` from the deck variant and a per-slide `clrMapOvr` where a slide's variant differs, and writes `schemeClr` (with `lumMod`/`lumOff` or `alpha` for mixes) for every scheme-derived color, chart XML included.
- Import maps a PowerPoint map, override and `bgRef` back to `design.variant`, and a fill equal to a slot back to the slot.
- Writing real `.thmx` theme variants comes last: whether PowerPoint's Variants gallery offers custom variants from a plain `.pptx` is unverified.

## Plan

| Step | Repository | Content | Depends on |
| --- | --- | --- | --- |
| 1 | opf | Schema `variant`, `tone`; role mapping; scheme-derived neutrals; docs | — |
| 2 | opf-render | Roles from the variant; `chart.colors`; frame parity; image tone and overlay (with #256) | 1 |
| 3 | opf-pptx | `clrMap`/`clrMapOvr`; `schemeClr` everywhere; import back to variant and slots | 1 |
| 4 | gallery, pptx-gallery | Theme `variants`; fold the `dark` theme in; docs pages | 1 |
| 5 | opf-editor | Deck and slide variant pickers | 1, 2 |
| 6 | all | Coordinated 0.23.0 release; gallery release per its version rule; sites | 1 to 5 |

Pre-v1: breaking changes ship without migration tooling. Layout geometry does not change; preview and PPTX goldens change for color only.
