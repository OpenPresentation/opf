# Design Resolution

How an engine decides the effective design for any given slide. The schema spreads these rules across field descriptions; this page states them once, as an algorithm.

## Precedence

For every design field independently, the most specific source wins:

```
  wins   +--------------------------------------------------------+
    ^    | 1. slide design     slides[i].design.*                 |
    |    +--------------------------------------------------------+
    |    | 2. deck design      design.* on the presentation root  |
    |    +--------------------------------------------------------+
    |    | 3. resolved theme   colorScheme, fontScheme,            |
    |    |                     background, dimensions from the     |
    |    |                     theme record                        |
    |    +--------------------------------------------------------+
  loses  | 4. engine defaults  e.g. spec/reference/                |
    v    |                     engine-defaults.json                |
         +--------------------------------------------------------+
```

1. **Slide design** — `slides[].design.*`
2. **Deck design** — `design.*` on the presentation root
3. **Resolved theme** — defaults carried by the theme record (`colorScheme`, `fontScheme`, `background`, `dimensions`)
4. **Engine defaults** — engine configuration such as [`spec/reference/engine-defaults.json`](../spec/reference/engine-defaults.json)

Resolution is **per field**, not per object. A slide that sets only `design.contentAlignment` inherits everything else from the deck design; a deck that sets only `design.colorScheme` keeps the theme's font scheme and background.

Two field-level rules complete the picture:

- **Base-plus-overrides within one object.** Wherever a reference object carries an `id` (`Theme`, `ColorScheme`, `FontScheme`), the `id` resolves a catalog record as the base and sibling fields override the resolved record per key. The string shorthand (`"colorScheme": "cool-horizon"`) is equivalent to setting only `id`.

  ```
  "colorScheme": { "id": "cool-horizon", "accent1": "#0F4C81" }

     catalog record "cool-horizon"        sibling fields on the object
     accent1: "#2874A6"   <-- replaced -- accent1: "#0F4C81"
     accent2: "#1B4F72"   <-- kept
     light1:  "#FFFFFF"   <-- kept
                  |
                  v
     effective scheme: accent1 from the override, everything else
     from the record
  ```
- **Explicit suppression.** `watermark`, `header`, and `footer` accept `false` to switch off an inherited value — distinct from omitting the field, which inherits.

Catalog lookups inside this chain follow the standard resolution order (inline `catalogs.<kind>.records[]` → `catalogs.<kind>.source` → default catalog); see [`how-opf-works.md`](./how-opf-works.md).

## Worked example 1: color scheme through every level

```json
{
  "design": {
    "theme": "classic",
    "colorScheme": "forest-green"
  },
  "slides": [
    { "title": "Inherits the deck" },
    {
      "title": "Slide override",
      "design": {
        "colorScheme": { "id": "cool-horizon", "accent1": "#0F4C81" }
      }
    }
  ]
}
```

- Slide 1: the `classic` theme record supplies its own default color scheme, but the deck design sets `colorScheme` explicitly, so `forest-green` wins (level 2 beats level 3). Fonts, background, and dimensions still come from `classic`.
- Slide 2: slide design beats deck design (level 1 beats level 2). The `cool-horizon` record resolves as the base, then `accent1` is replaced by `#0F4C81`. All other `cool-horizon` slots survive.

There is no ambiguity between "override" and "reference": every scheme value *is* a reference, and any sibling fields on the same object are overrides applied after the reference resolves.

## Worked example 2: backgrounds and suppression

```json
{
  "design": {
    "theme": "dark",
    "background": "light1",
    "footer": {
      "left": { "text": "Acme Corp" },
      "right": { "slideNumber": true }
    }
  },
  "slides": [
    { "title": "Light slide in a dark theme" },
    {
      "title": "Section divider",
      "design": {
        "background": {
          "type": "gradient",
          "gradient": {
            "angle": 90,
            "stops": [
              { "color": "#0B1B2B", "position": 0 },
              { "color": "#123A5F", "position": 1 }
            ]
          }
        },
        "footer": false
      }
    }
  ]
}
```

- Slide 1: the deck-level `background: "light1"` overrides the `dark` theme's default background. `light1` is a theme slot — it resolves through the effective color scheme, which itself resolved through the chain above.
- Slide 2: the gradient replaces the deck background for this slide only, and `footer: false` suppresses the inherited footer rather than inheriting or replacing it.

## Worked example 3: font scheme models

```json
{
  "design": {
    "fontScheme": {
      "id": "aptos",
      "code": { "family": "JetBrains Mono" }
    }
  }
}
```

The `aptos` record supplies the OOXML pair (`major`/`minor`). The `code` role is an OPF-specific addition with no OOXML slot, so it layers on top without disturbing the pair. When serializing to PowerPoint, engines write `major`/`minor` to `majorFont`/`minorFont` and map abstract roles (`heading`, `body`) onto those slots; roles like `accent` and `code` are renderer concerns. The same slot-versus-role split applies to color schemes: OOXML slots (`accent1`–`accent6`, `dark1/2`, `light1/2`) round-trip directly, abstract roles (`primary`, `text`, `surface`, …) are mapped onto slots by the engine.

## What is *not* part of this chain

Content payloads carry no design controls in v1 — `position`, `fontSize`, per-payload colors and the like were deliberately kept out while the content model stabilizes (see [`content-item-design-overrides.md`](./content-item-design-overrides.md)). The design system above, plus layout hints (`titleAlignment`, `contentBox`, `chartPrimary`, …), is the entire styling surface of an OPF document.
