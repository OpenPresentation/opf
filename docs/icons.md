# Icons

An `icon` puts a small drawing on a chip beside a list entry, above a metric or at the top of a group, as Claude Design draws a feature
list or a "what we will cover" card (LH-14). Icons are decoration: they never cost text its size, and they are drawn only where the
author gave one. OPF never invents an icon.

```json
{
  "title": "What is new in the 5.0 release",
  "items": [
    { "text": "Offline mode", "description": "Keep working without a connection.", "icon": "lucide:wifi-off" },
    { "text": "Shared workspaces", "description": "One place for a team's files.", "icon": "lucide:users" }
  ]
}
```

## Where an icon goes

| Field | Drawn |
| --- | --- |
| `items[].icon` (a `ListItem` object) | On a chip in the marker column, in place of the bullet, centered on the entry's first line. Every entry of the list keeps the column, so the texts start at one edge. First-level entries of an unnumbered list only. A ruled list (`listStyle: "rows"`) sets the chips at the start of its labels. A short list that is the whole body draws as icon cards (below), numbered or not. |
| `metric.icon` | On a chip above the metric, at its alignment (centered, or at the start of a start-aligned metric). |
| `icon` on a group (a block with `blocks`) | On a chip at the top start edge of the group, above its heading (its eyebrow), inside a group drawn on a card. A person drawn as a portrait card (LH-132) draws no chip; the icon is reported `icon-dropped`. |

A list with icons is never drawn with step badges, numerals or check-mark tiles: its chips take the marker column those draw in.
`bullets` entries and nested entries take no icon.

### Icon cards (LH-165)

A slide whose whole body is one list of 2 to 8 first-level entries, each with an `icon` that resolves, a label of at most 48
characters and 7 words and at most a description of 160 characters, draws the list as a grid of equal cards that take the body's
height (or its layout region's), as Claude Design draws a set of features or an agenda:

- **Grid.** Two to four cards a row, every row full but the last, which is at most one card short and centered under the others
  (`cardGridColumns`: 4 cards as 2 x 2 or one row, 6 as 3 x 2 or 2 x 3, 8 as 4 x 2, 3 x 3 + 2 or 2 x 4). The cards keep the list's
  order, row by row from the start edge (the right in a right-to-left deck).
- **Card.** The theme's card surface and border (the card neutral, as LH-137's check-mark tiles), the chip at the top start, the label
  bold, the description under it at 0.82 of the label's size (as a ruled row's). The chip stands above the label, beside the label and
  its description, or beside the label with the description under both across the card, whichever lets the text be largest (then on
  the fewest lines). The chips on cards are solid in the primary with the glyph in the color that reads on it, on light and dark slides.
- **Numbers.** A numbered list, or an agenda's list (a `numbered` region such as `agenda-split`'s items), keeps its numbers as
  numerals in the accent at the top end of each card ("01", "02"); a numbered list's numerals carry the list number, so a PPTX import
  gives the list its `numbering` back.
- **Size.** The text starts at the size the list has and grows by steps of the type scale, up to LH-05's 56 px (one size on every
  card, the description always 0.82 of the label), while every card holds its text without a split word and either the tallest card's
  text takes at most 80% of its card or the text covers at most 60% of the body (LH-48's fill), so a row of cards fills its cards. A
  label never takes more lines than it has at the starting size, except that a label of three words or more may take two (a two-word
  label stays on one line). Icon cards never set text smaller: they are tried on top of the rules the guard kept and kept only when no
  block reads smaller than without them, and the settled slide without them (which LH-48 may grow) is compared too. When no grid holds
  the list at its size, it stays the list it was.
- **Across the body.** A layout's lone list with icons (an agenda's list in its half of an `agenda-split` slide) also tries its cards
  across the whole body under the heading, the slide composed as the automatic grid (LH-83's recomposition, `recomposed.cards`). That
  arrangement is kept when its text is at least as large as the layout's (with or without cards; LH-149's half steps count at the step
  under them), and the agenda keeps its numbers. Narrative n05 draws its four cards as a 2 x 2 grid under the title at the size the
  agenda had (37 px).

A set of 2 to 8 groups that is the whole body, each with an `icon` and one short label paragraph, optionally followed by one
description paragraph, draws the same cards; the label is bold in the card instead of the group's eyebrow, at the description's size.
A description that would wrap into a column under the minimum measure keeps the groups as they are.

Short paragraphs without icons draw as tiles (LH-162, see [Dynamic composition](dynamic-composition.md)).

## What an icon names

`icon` is one string, in one of three forms:

- **`<set>:<name>`**, an icon of a set: `lucide:truck`, `tabler:rocket`. The gallery (`@openpresentation/gallery`) bundles
  [Lucide](https://lucide.dev) (ISC, `lucide-static` 1.68.0, about 2,000 icons, the default set) and
  [Tabler outline](https://tabler.io/icons) (MIT, `@tabler/icons` 3.50.0, about 5,200 icons). The MCP's `search_icons` tool
  finds names by keyword; never guess one.
- **a bare name**, an icon of the deck's own `icons` map: an author's or an LLM's SVG, written once and named anywhere in the deck.
- **an SVG source**: `asset:<id>`, `./icon.svg`, an HTTPS URL or a `data:image/svg+xml` URI, as pictures accept. A file is read by
  the host (the CLI and the Node file API read it from the asset directory); nothing is fetched by core.

```json
{
  "icons": {
    "brand-mark": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\"><path d=\"M24 6 40 15v18L24 42 8 33V15z\"/><path d=\"M16 24l6 6 11-12\"/></svg>",
    "partner": "asset:partner-badge"
  },
  "slides": [{ "title": "Our commitments", "items": [{ "text": "Certified partners", "icon": "brand-mark" }] }]
}
```

## SVG intake

An icon's SVG is read, never run. A script, an event handler, `foreignObject`, a raster image, or an `href`, `url()` or `@import`
that is not a fragment makes it `opf/icon-invalid`, as does text that is not well-formed XML, has a DOCTYPE or has no size. Then:

- **One paint** (one color, or `currentColor`, at full opacity) in shapes core can read (`path`, `circle`, `ellipse`, `rect`,
  `line`, `polyline`, `polygon`, in groups with transforms): a **monochrome glyph**. Its shapes become path commands in a 0 0 24 24
  viewBox (its own viewBox is scaled to fit, centered) and are drawn in the accent: recolorable, and native in PowerPoint.
- **Anything else** (several colors, gradients, text, opacity): a **picture** with its own colors, drawn without a chip in the chip's
  square.

## Colors

The chip is a light tint of the primary (its luminance times 20% plus 80%, PowerPoint's "Lighter 80%") with the glyph in the primary;
on a dark slide or the emphasis surface the inverse, a primary chip with the glyph in the scheme color that reads best on it. A glyph
under 3:1 against its chip takes the text color. Core computes the colors (`iconColors`); both engines draw core's.

## Size and the size guard

A chip is a line of its text high (`ICON_CHIP_COMPACT`, 1.22 em) or, where the slide has room, 1.75 em (`ICON_CHIP`, a step badge's
size); the glyph is 55% of the chip. Both are guarded rules of composition (`icons`, `icon-chips`) and drawing rules: a slide keeps
the full chips, else the compact ones, only when every block reads as large as it does without them. When neither fits, the slide is
drawn without its icons and each one gets `opf/icon-dropped`; the text is always drawn. An icon on something icons do not mark (a
nested or numbered entry) gets the same finding.

## Engines

- **Preview** (opf-render): the chip a circle, the glyph SVG paths (filled, or stroked with round caps and joins at the set's width
  scaled to the chip), a picture an `<image>`.
- **PowerPoint** (opf-pptx): the chip an ellipse and each glyph part a native custom geometry (`a:custGeom`, editable points), filled
  or stroked with the theme's accent (`a:schemeClr val="accent1"`, with the chip's `lumMod`/`lumOff`), so a theme change recolors
  them. A picture is an SVG picture with its PNG fallback. Every shape carries an `OPF_ICON_V1` tag; import consumes the tagged shapes
  and gives each `icon` back to its entry, metric or group. The deck's `icons` map travels in the document provenance.

## Loading

Core is catalog-free. A host registers icon sets with its catalogs, as a catalog's `iconSets` (each set its record, or a function that
loads it). The gallery's sets are an entry of their own, so a host that does not register them (a Worker bundled into one file, say)
carries none of their data, and `gallery` itself names none:

```js
import { gallery } from "@openpresentation/gallery";
import { galleryIconSets } from "@openpresentation/gallery/icon-sets";
const catalogs = [gallery, galleryIconSets];
await ensureIcons(deck, { catalogs });
```

`galleryIconSets.iconSets` holds one loader per set, and each set is a module of its own (`@openpresentation/gallery/icon-sets/<id>`),
so a deck that draws no icon loads none. Before synchronous code reads a deck, a host awaits `ensureIcons(deck, { catalogs })`:
opf-pptx's `toPptx` and the renderer's browser fonts handle (`ensure`) do with the catalogs they are given; core's Node defaults, the
CLI and the MCP register `galleryIconSets` and load the sets a deck names before they check or draw it. A Node script that calls `toSvg`
directly calls `ensureIcons` first. `validate` alone checks only the set ids and the sets the document embeds until the sets are loaded.

`embedIcons(deck, { catalogs })` copies the set icons a deck uses (only those, with the set's license and copyright) into
`catalogs.default.iconSets`, so the deck draws them with no registered catalog. An icon set is a catalog kind
(`spec/schemas/icon-set.schema.json`); the gallery's records are generated from the pinned npm packages by
`packages/gallery/scripts/build-icon-sets.mjs`, and their licenses are in the package's `THIRD-PARTY-NOTICES.md`.

## Findings

| Rule | When |
| --- | --- |
| `opf/icon-unknown` | The set or the name is not found; the finding suggests the nearest names. |
| `opf/icon-invalid` | The SVG cannot be an icon (see SVG intake). |
| `opf/icon-dropped` | The icon is not drawn: no room without setting text smaller, or nothing it can mark. |
