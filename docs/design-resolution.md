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
4. **Engine defaults** — [`spec/reference/engine-defaults.json`](../spec/reference/engine-defaults.json), compiled into core as `ENGINE_DEFAULT_THEME`, `ENGINE_DEFAULT_COLOR_SCHEME` and `ENGINE_DEFAULT_FONT_SCHEME`

Resolution is **per field**, not per object. A slide that sets only `design.contentAlignment` inherits everything else from the deck design; a deck that sets only `design.colorScheme` keeps the theme's font scheme and background.

Two field-level rules complete the picture:

- **Base-plus-overrides within one object.** Wherever a reference object carries an `id` (`ColorScheme`, `FontScheme`, and the inline `Audience`, `Purpose` and `Tone`), the `id` resolves a catalog record as the base and sibling fields override the resolved record per key. `design.theme` is a reference string only. The string shorthand (`"colorScheme": "cool-horizon"`) is equivalent to setting only `id`.

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

Every reference inside this chain resolves the one way every content reference does: `catalogs.custom`, then the records embedded under `catalogs.default`, then the catalog the host registered for its source (`name:id` in `catalogs.<name>`, then the host catalog for its source); see [`how-opf-works.md`](./how-opf-works.md) and [the catalogs page](default-catalog.md).

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
    "theme": "minimal",
    "background": "light1",
    "footer": {
      "left": { "text": "Acme Corp" },
      "right": { "text": "{{slide.number}}" }
    }
  },
  "slides": [
    { "title": "Light slide on a theme that defaults to dark" },
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

- Slide 1: the deck-level `background: "light1"` overrides the `minimal` theme's default background (`dark2`). `light1` is a theme slot — it resolves through the effective color scheme, which itself resolved through the chain above.
- Slide 2: the gradient replaces the deck background for this slide only, and `footer: false` suppresses the inherited footer rather than inheriting or replacing it.

## Worked example 3: font scheme models

```json
{
  "design": {
    "fontScheme": {
      "id": "aptos",
      "code": "JetBrains Mono"
    }
  }
}
```

The `aptos` record supplies the OOXML pair (`major`/`minor`). The `code` role is an OPF-specific addition with no OOXML slot, so it layers on top without disturbing the pair. When serializing to PowerPoint, engines write `major`/`minor` to `majorFont`/`minorFont` and map abstract roles (`heading`, `body`) onto those slots. `accent` has no slot; the `code` family is written directly on code runs. The same slot-versus-role split applies to color schemes: OOXML slots (`accent1`–`accent6`, `dark1/2`, `light1/2`) round-trip directly, abstract roles (`primary`, `text`, `surface`, …) are mapped onto slots by the engine.

### Code font

The `code` role resolves per key like every other override:

1. `code` on the effective `design.fontScheme` object;
2. `code` on the resolved font-scheme record (the `consolas` and `courier-new` records carry `"Consolas"` and `"Courier New"`);
3. otherwise **Roboto Mono**, the documented fallback that `@openpresentation/opf-render` bundles.

The heading and body families are never reused as the code fallback, so choosing `aptos` still gives Roboto Mono code unless the deck sets `code`. `resolveFontFamilies()` in `@openpresentation/opf/composition` applies these rules for all engines.

### Engine default font scheme

The last-resort font scheme applies only when neither the slide, the deck nor the resolved theme names one, or when the reference resolves nowhere. It is an engine default in code, not a catalog record: `ENGINE_DEFAULT_FONT_SCHEME` (`{ major: "Aptos Display", minor: "Aptos", languageFamily: "latin" }`, the drawing fields of the gallery's `aptos` scheme), recorded in [`engine-defaults.json`](../spec/reference/engine-defaults.json) and exported from the package root and `@openpresentation/opf/composition`. A document with no `design` uses the engine default theme (`ENGINE_DEFAULT_THEME`, which names no font scheme), so it gets Aptos in every engine without any catalog registered.

Every engine shares this one last resort, so a theme without `fontScheme` is measured, paginated, previewed and exported in the same fonts:

| Engine | Last resort | Where |
| --- | --- | --- |
| Core pagination and validate | `ENGINE_DEFAULT_FONT_SCHEME` | `packages/javascript/src/design-records.ts` |
| opf-render preview | core's `resolveSlideContext` | `src/svg.js` |
| opf-editor composition and slide transfer | core's `resolveSlideContext` | `src/font-defaults.js` |
| opf-pptx export | core's `resolveSlideContext` | `src/index.js` |

Aptos is not openly licensed, so no OPF package bundles it. Previews take the same path for the last resort as for any `aptos` deck:

- **Estimated layout** (no `fonts`): the SVG names `Aptos` and `Aptos Display`, and the default raster engine draws them with its bundled sans-serif fallback (Roboto).
- **Measured layout** with the opf-render office font pack (`loadFonts({pack: 'office'})`): `Aptos` and `Aptos Display` resolve to Intos and Intos Display, metric-compatible replacements from the OPF font policy (0.000% mean width difference against Aptos 2.01), and the substitution report lists both. With only the base pack and `substitutionPolicy: "visual"` they fall back to the visual alternates Roboto and Carlito. The PPTX always names Aptos. See [font-fidelity.md](font-fidelity.md#font-policy-ff-31).
- **Measured layout with only the base pack under the metric policy**: `font-unavailable` for Aptos, as for a document with no `design`. Supply licensed Aptos faces, allow visual substitution, or set a `fallbackFamily`.

`packages/javascript/test/font-scheme-defaults.test.mjs` checks the shared default in core pagination, and each sibling repository has a parity test.

### References that resolve nowhere

A layout, theme, colour scheme or font scheme reference that neither the document embeds nor a registered catalog defines falls back, and no engine throws for it (unless the host asks for a strict export, `strictReferences`, which throws `OPFUnresolvedReferenceError`):

- **Layout.** A slide with no `layout` is composed with **no layout record**, and that is not a finding: title, subtitle, tag and content are arranged automatically, a slide with no body payload is a cover (the title block vertically centred) and the design hints apply. A layout reference that resolves nowhere composes the same way. An engine never substitutes a different layout.
- **Theme.** A theme reference that resolves nowhere uses the engine default theme (`ENGINE_DEFAULT_THEME`: the background and dimensions of the gallery's `minimal`).
- **Colour scheme.** A colour-scheme reference that resolves nowhere uses `ENGINE_DEFAULT_COLOR_SCHEME` (the twelve slots of `cool-horizon`). The theme's own colour scheme counts as the reference when the deck and slide name none, and resolves in the theme's catalog group first. An object without an `id` is laid over the engine default, so a partial inline scheme keeps the slots it does not name.
- **Font scheme.** A font-scheme reference that resolves nowhere uses `ENGINE_DEFAULT_FONT_SCHEME`. Sibling fields on an object reference still override it per key, so `{ "id": "no-such-scheme", "major": "Inter", "minor": "Inter" }` uses Inter, and a `code` role still applies. An object without `id` is an inline scheme on the same base and reports nothing.

Each is one `unresolved-reference` diagnostic: `{ code, kind, reference, path, group, source?, fallback, message }`, with `path` where the reference is written (`slides.N.layout`, `slides.N.design.theme`, `design.colorScheme`, `design.fontScheme.id`, or `catalogs.<group>.themes.<id>.colorScheme` for a reference inside an embedded theme), `fallback` `automatic` for a layout and `engine-default` otherwise, and a message that names the reference and the catalog source it was looked for in. `validate` reports the same references as `opf/unresolved-reference` warnings.

`resolveSlideContext(presentation, index, { catalogs, fonts })` (package root) applies these rules with the slide, deck and theme precedence above. It returns the `ComposeSlideOptions` for one slide (canvas, layout, families as `fontFamilies`, measurement, `slideNumber`, `slideCount`), the slide to compose and draw (`slide`, with `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` substituted for those numbers), the diagnostics, and `darkBackground` (the preview's decision: the one colour the background names, resolved through the colour scheme and the deck's `variables` so `var:brand`, a scheme slot or `primary`/`secondary`/`accent` work, has a WCAG relative luminance below 0.179; a gradient counts as light, a picture reads `light1`, a pattern its `backgroundColor`; no opacity is applied), which `composeSlide` uses to pick logo variants. `resolveDesignRecords` and `resolveFontScheme` expose the same resolution for hosts that need only the records. Core pagination continues with the fallbacks and passes each diagnostic to `onDiagnostic`.

| Engine | Diagnostic channel | Reported |
| --- | --- | --- |
| Core pagination | `paginate(..., { onDiagnostic })` | once per path per call |
| opf-render preview | `toSvg` `onDiagnostic` | once per path per rendered slide |
| opf-editor | `session.composeSlide` / `paginateSlide` `onDiagnostic` option | once per call |
| opf-pptx export | `toPptx(..., { onDiagnostic })` | once per path per export |

Every engine passes the catalogs its host registered (the `catalogs` option) to core, so a record a host registers resolves the same in preview, editor and export.

## Color references in content

Content color fields (`TextRun.color`, styled table cell `style.fill` / `style.color`, table cell border `color`) accept references as well as literal hex, and those references resolve through the same chain above:

```
  "color": "accent2"          slot name  -> effective color scheme slot
  "color": "text"             role name  -> role-to-slot mapping, then the slot
  "color": "var:risk"         variable   -> top-level variables map
  "color": "#B42318"          literal    -> used as-is (frozen at authoring time)
```

- **Slot names** (`accent1`–`accent6`, `dark1`, `dark2`, `light1`, `light2`, `hyperlink`, `followedHyperlink`) read the named slot from the *effective* color scheme — the one produced by the slide → deck → theme → engine-default precedence at the top of this page. A slide-level `design.colorScheme` override therefore recolors that slide's named runs too.
- **Role names** (`primary`, `secondary`, `accent`, `background`, `surface`, `text`, `textSecondary`) resolve through one shared definition, `resolveColorRoles()`, which the opf-render preview, the PPTX export and `validate` all call, so the same deck draws the same colors in each. A role defined on the effective scheme wins; otherwise it defaults from a slot:

  | Role | Default (through the slide's variant; see [Color variants](#color-variants)) |
  | --- | --- |
  | `primary`, `secondary`, `accent` | the first three accents of the variant: `accent1`, `accent2`, `accent3` unless `variant.accents` reorders them |
  | `background` | the slide's own resolved background when it is one color (solid or pattern background color); else the variant's `bg1` (`light1` by default, the scheme's `background` role overriding it there). A gradient or picture background uses the variant, or its `tone`, or `light1`. |
  | `surface` | `bg2` of the variant: `light2` on a light slide, `dark2` on a dark one |
  | `text` | `tx1` of the variant: `dark1`, or `light1` on a dark slide. A `text` override applies on a light slide only, so a dark slide always keeps readable light text. |
  | `textSecondary` | `tx2` of the variant: `dark2`, or `light2` on a dark slide |

  A slide is dark when its background's WCAG relative luminance is under 0.179, the point where white and black text contrast equally.
- **Links.** A link run (`link`) with no `color` of its own is drawn underlined in the scheme's `hyperlink` slot (the OOXML `hlink` color; Office blue `#0563C1` when the scheme sets none), in the preview and in the PPTX export (`a:schemeClr hlink` where the deck theme holds that color). Where that color has under 4.5:1 contrast against the slide background (the default Office blue on a dark slide), the slide's `text` color is used instead, as the slide tag does for a low-contrast primary color. A link run with its own `color` keeps it, and a `hyperlink` ColorRef always names the slot. `followedHyperlink` is written to the PPTX theme; a static preview cannot know which links were visited, so it draws every link in `hyperlink`.
- **Variable references** (`var:<id>`) resolve against the document's top-level `variables` map, independent of the scheme. Variables are deck-scoped named colors — use them for values that have meaning (`var:risk`) or repeat across slides. An unknown id is a validation warning, never an error, and engines fall back to their default text color.

The styled table cell and border color fields enforce the reference forms at the schema level (a typo like `"acent2"` is a schema error there — neither hex, a known name, nor a `var:` reference). Run colors stay open strings so imported decks keep validating: an unrecognized run color is a validation warning, and renderers fall back to the theme text color — the same warn-don't-error posture unknown catalog ids get. Unknown `var:` ids are warnings everywhere.

### Color variants

A deck has one color scheme of twelve slots. A **variant** is a mapping over those same slots, as PowerPoint's `clrMap` is, never a second scheme: which slot is the background, and so which are the text and the alternate surface, plus an optional order for the accents. Everything OPF draws refers to the roles, so a slide that changes variant recolors text, lines, cards, chart furniture and code together.

`variant` is a string, the same way `colorScheme` is: the slot that is the background.

```json
{
  "design": { "variant": "dark1" },
  "slides": [{ "title": "Light one", "design": { "variant": "light1" } }]
}
```

`"dark1"` is `{ "background": "dark1" }`. The object form is only needed to reorder the accents: `{ "background": "light1", "accents": ["accent2", "accent1", "accent3", "accent4", "accent5", "accent6"] }`. Both forms are allowed on `design` and on `slides[n].design`, and what `resolveColorRoles` and `resolveSlideContext` return is always the normalized object (`normalizeColorVariant`).

| `variant` (or `variant.background`) | bg1 | tx1 | bg2 | tx2 |
| --- | --- | --- | --- | --- |
| `light1` (default) | `light1` | `dark1` | `light2` | `dark2` |
| `dark1` | `dark1` | `light1` | `dark2` | `light2` |
| `light2` | `light2` | `dark1` | `light2` | `dark2` |
| `dark2` | `dark2` | `light1` | `dark2` | `light2` |
| `accent1` to `accent6` (LH-01) | the accent | `light1` or `dark1` | the accent | `light2` or `dark2`, else tx1's slot |

(`light2` and `dark2` keep the background slot as the surface too, as a slide with that theme background has always been drawn, so the engine default theme, whose background is `dark2`, is unchanged.) An accent variant draws the slide on that accent with the scheme's light family (`light1`, `light2`) or dark family (`dark1`, `dark2`), whichever text slot has the higher contrast on the accent; where the family's tx2 is under 4.5:1 on it, tx2 maps to tx1's slot. No color is invented: the PowerPoint export writes it as a `clrMapOvr` with `bg1="accent1"`. `variant.accents` (object form) is a permutation of `accent1` to `accent6`; entry `i` is the slot drawn as accent `i + 1`, which reorders `primary`, `secondary`, `accent` and the chart series colors.

Which variant a slide has, from the most specific to the least (slide design, the slide's layout record's `design.variant` unless the deck or the theme draws a fixed background, deck design, then the theme record), at the first level that says anything:

1. a `variant`;
2. a theme-slot background (`"dark1"`, `{ "type": "theme", "slot": "dark1" }`), which is the variant of that slot, so `design.background` stays a shorthand;
3. a picture or gradient background with a `tone` (`"dark"` or `"light"`), which is the `dark1` or `light1` variant. Without a tone only a variant of a less specific level can apply; with none the slide counts as light, as before;
4. any other background (a solid or pattern color) decides by luminance (dark below 0.179), as before.

A layout record's `design.variant` (LH-01) is a default a gallery layout gives, and a background the author fixed beats it (LH-103; docs/programs/layout-harvest/README.md, Decisions). From the most specific:

1. The slide's own `variant` or `background` always wins.
2. If the background the deck or the theme draws is **fixed**, the layout's variant does not apply: the slide keeps that background, and its text follows that background's `tone` or luminance, exactly as on a slide whose layout names no variant. Fixed is a hex color (the `"#0B1020"` shorthand or a solid's `color`), a solid whose color is a `var:` reference (whatever the variable holds: the author named a color of the deck's own, not a place in the scheme), a gradient, a pattern or a picture.
3. If that background is **scheme-based** (none, so the theme's slot or the engine default applies; a theme slot, `"dark1"` or `{ "type": "theme" }`; a solid whose color is a scheme slot or role name, such as `accent2`, `primary` or `background`; or a deck `variant`), the layout's variant applies on top, ranking above the deck and the theme, unlike the layout's other design keys.
4. Otherwise the deck, then the theme, then the engine default, as above.

The background the deck or the theme draws is the deck's own `background`, else the theme's, unless a deck `variant` hides the theme's (the slide is then the variant's bg1, which is scheme-based). A deck that sets both a fixed background and a `variant` keeps the background on every slide, the layout's included; its variant only maps the text and the surfaces. A theme whose own background is fixed counts the same as a deck's (no default theme has one). `deckBackgroundIsFixed(deckDesign, themeBackground)` and `isFixedBackground(definition)` (`/composition`) are the rule.

Where it applies, besides a variant the layout takes a value relative to the deck's own variant (the one the deck and the theme give), so a layout keeps the deck's tone:

| Layout `design.variant` | Light deck (on `light1`) | Deck on `light2` | Dark deck (on `dark1`, an accent with light text, or a dark slot or role color) | Deck on `dark2` |
| --- | --- | --- | --- | --- |
| `surface`, the deck's secondary surface | `light2` | `light1` | `dark2` | `dark1` |
| `brand`, the scheme's brand dark, with light text | `dark2` | `dark2` | `dark2` | `dark1` |
| a variant (`accent1`, `dark1`, an object) | as written | as written | as written | as written |

The default `section` is `accent1`, `statement` and `quote` are `surface` and `closing` is `brand`, so a dark deck's statement stays dark and its closing still stands off the deck. In every default theme and color scheme, light or dark, their text and secondary text reach 4.5:1. Where it applies, the layout variant hides the deck's and the theme's scheme-based background (the slide is the variant's bg1); it never hides a fixed one, so a deck's brand photo or hard-coded color stays on its section, statement, quote and closing slides, and the PowerPoint export writes no `clrMapOvr` for them. Without an accent order of its own it keeps the deck's. `resolveSlideContext(...).resolved.layoutVariant` is the resolved variant when it decides the slide (undefined over a fixed background); `layoutColorVariant(layout, deck)` (`/composition`) resolves one record.

**A message-only slide (LH-164).** A slide whose whole body is one display message takes the accent surface (`accent1`, the variant the gallery's `section` names, in the deck's accent order), as Claude Design draws a statement or a one-sentence slide. The body is one message when it is LH-09's `statement-message` (a text in a statement record, under a sentence title or a short label) or `display-message` (a lone text of at most 25 words in any script, no citation or footnote, no subtitle, in a layout of one body region with no grid and no picture area), and composition really draws it at display size (a deck whose texts sit on cards keeps its body text); a metric, a quote and everything with a second block keep the plain surface. It takes the layout variant's place and its conditions: the slide's own `design` sets neither a variant nor a background, and the deck and the theme draw no fixed background or author-chosen scheme color; a layout that names a variant of its own (`section`, `closing`, an authored one) keeps it, and a layout that names only `surface` (`statement`, `quote`) gives way to the accent. **Dark decks keep their background**: a deck or a theme record that sets a dark background or variant is a deliberate design that already gives its messages their emphasis (the engine default theme is no choice of the deck's). **A loud accent stays plain**: the accent must carry the slide's text at 4.5:1, differ from the deck's own surface and be calm enough to fill a slide, CIELCh lightness L* at most 60 and chroma C* at most 80 (`lchOf`, `MESSAGE_SURFACE_MAX_LIGHTNESS`, `MESSAGE_SURFACE_MAX_CHROMA`; Claude Design's blue, L* 46.6 and C* 33.8, and the deep purple, L* 38.3 and C* 75.3, qualify; the `boost` red-orange, `corporate-blue` and `vibes` do not). The brand color is never recolored; the slide keeps its plain surface. A deck never shows two accent surfaces on consecutive slides: after a slide that actually took one (judged by its own resolution), or one drawn on an accent by its layout (`section`) or its own variant, the next message slide keeps the plain surface, so a run of message slides alternates. Text colors follow the surface like any variant; a color the author set on a run that does not read on it draws in the nearest one that does, and an image watermark draws in the slide's text color so a mark made for the plain surface still reads (a one-color duotone in the export). `resolveSlideContext(...).resolved.messageSurface` `{ kind: 'statement-message' | 'display-message', variant }` is the reason (`layoutVariant` and `roles` already follow it), and `composeSlide` echoes it as `SlideComposition.surface`. The PowerPoint export writes the slide's `clrMapOvr` as it does for a section, so the surface is the theme's accent; an editor can offer the plain surface by setting the slide's own `design.variant`.

A theme record can list the variants it offers (`variants`, from gallery 4): named values of `variant`, such as `light`, `light-alt`, `dark` and `dark-alt` on `minimal`, `classic` and `bold`. They are for pickers: choosing one writes its `variant` into `design.variant` (or a slide's), and the document keeps that value, not the entry id. The engines read only `design.variant`. There is no `dark` theme in the default catalog: a dark deck is a theme with a dark variant, for example `{ "theme": "classic", "variant": "dark1" }`.

A slide's variant replaces the deck's whole, accent order included. `resolveSlideContext(...).resolved.roles` is the resolved record, and `resolveColorRoles(scheme, { variant, tone, background })` is the function: besides the colors it returns `variant`, `map` (bg1, tx1, bg2, tx2 and the accents; `clrMapAttributes(map)` gives the PowerPoint `clrMap` attributes for the master and for a slide's `clrMapOvr`), `accents` (the six colors in order) and `neutrals`.

#### Scheme-derived neutrals

Lines and quiet colors are not fixed grey. `roles.neutrals` derives each from the map, as PowerPoint's chart styles do: the text color (tx1) at a share over the background (bg1), chosen as a DrawingML luminance transform of the slot so a PPTX can write `<a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr>` and the preview draws the same color. Each neutral is `{ slot, hex, lumMod?, lumOff?, alpha? }` (the transforms in thousandths of a percent; `hex` is the transform applied, `applyLuminance(slotHex, lumMod, lumOff)`).

| Neutral | Derivation |
| --- | --- |
| `border` (also `roles.border`) | tx1 at 20% over bg1: card, rule and table borders |
| `gridline` | tx1 at 15%: chart gridlines |
| `axisLine` | tx1 at 25%: chart axis lines |
| `chartText` | tx1 at 65%: chart axis labels and legend text |
| `outline` | bg1: pie and treemap outlines, the video play icon, anything drawn on a mark |
| `trendNeutral` | tx2: the neutral metric trend |
| `codePanel` | The code block is a dark card on either map (LH-79). Light: tx1, or tx2 when tx1 is near-black (relative luminance 0.01 or less) and bg1 keeps 7:1 on tx2, so a navy theme draws a navy panel. Dark: bg1 at 70% of its lightness (`lumMod` 70000), a step below the slide; a near-black slide takes bg2 when it stands off, else bg1 lifted 6% towards tx1. Over a literal background the bg1 shade is a literal color |
| `codeText` | bg1 or tx1, whichever reads better on the panel |
| `codeComment` | the code text at 65% over the panel (comments and line numbers) |
| `card` | The fill of a card (a composed item's `frameBox`, LH-54): the `surface` role, except on a dark slide where the surface does not stand off the background (under 1.1:1, as on the `dark2` variant, whose bg2 is the background) and no `surface` is authored. There the card is the background mixed towards tx1, from 7% until it reaches 1.25:1 (`#172C52` on the default `#011842`), a literal color |
| `cardBorder` | The card's 1 px stroke: `border`, or on a mixed dark card that card mixed 12% towards tx1 (a literal color) |

`codeSyntaxPaletteForRoles(roles)` builds the syntax palette from `codePanel`, `codeText`, `codeComment` and the variant's first three accents, and `codeHighlightColors(scheme, palette, codePanel.hex)` takes the panel the highlight band sits on. `readableSchemeColor(fill, roles)` returns bg1 or tx1 (as a scheme color), whichever reads on a fill the scheme does not name, for table header text and text on marks. The validator's contrast rules read the same roles, so a dark variant is checked against its own text and surface, and text in a card against `card`. The preview and the PPTX export draw a card with `card` and `cardBorder`, and color a metric in a card (its value and trend) against `card`.

### Background colors are ColorRefs

The colors of a solid background (`SolidBackground.color`), of each gradient stop and of a pattern (`foregroundColor`, `backgroundColor`) take the same forms as the content fields above: a literal hex, a slot or role name, or a `var:<id>` reference. The schema keeps these fields as plain strings, so a reference validates; engines resolve it through `resolveColorRef()` against the effective color scheme and the deck `variables`, and a reference that resolves to nothing is drawn as the engine default (white for a background), as for any other unresolvable color. The default text color of the slide follows the resolved background. A PPTX export writes `a:schemeClr` where the deck theme holds the named slot or role exactly, and the resolved literal otherwise (FF-24 conventions).

> **Decision, 2026-09-30 (agent decision, vetoable).** The spec coverage audit found that `SolidBackground.color` accepted `var:` and slot names (the field is a string) but both engines painted white, while [`content-item-design-overrides.md`](./content-item-design-overrides.md) already states that every color field must accept the ColorRef forms and never hex alone. Rather than tighten the schema (which would break documents that validate today), the engines resolve ColorRefs in backgrounds. The owner can veto this by restricting the three background color fields to `HexColor` in the schema and the engines to hex only.

`@openpresentation/opf/composition` exports `resolveColorRef()` with the shared slot, role, variable, and hex rules above so renderers and exporters do not drift. Pass the effective color scheme, optional resolved role colors, the deck `variables` map, and a theme-text `fallback` for unrecognized references.

## Script fonts and language

OOXML gives each theme font (major and minor) three script slots: `latin`, East Asian (`ea`) and complex script (`cs`). The presentation `language` and the effective font scheme resolve to all three:

```
  latin          design font scheme heading/body (the chain above)
  eastAsian      1. design.fontScheme.eastAsian      explicit slot
  complexScript  2. the scheme's own major/minor     when languageFamily is ea / cs (or eastAsian /
                                                     complexScript, the same values) and its
                                                     languages list (language ids) is empty or
                                                     names the language
                 3. the language's font scheme       when the language's script uses the slot
                 4. the latin family                 otherwise
```

- A language record's `script` (ISO 15924) picks its slot. East Asian scripts (`Jpan`, `Hans`, `Hant`, `Kore`, ...) use `eastAsian`. Complex scripts (`Arab`, `Hebr`, `Deva`, `Thai`, ...) use `complexScript`. Latin, Cyrillic, Greek and other scripts use `latin`. `direction` defaults from the script (Arabic and Hebrew are right-to-left).
- The language's `fontScheme` applies to PowerPoint output and `googleFontScheme` to Google Slides output. For Latin-script languages, the design font scheme always supplies the latin slot.
- A language sets `lang`, the text direction and the script slots, and never the Latin scheme: only `design.fontScheme` (slide, then deck, then theme, then the shared default `aptos`) sets the latin fonts, and a language record's `fontScheme` is a default for its own script slot, not a deck font. The PPTX theme's `a:ea` and `a:cs` are written only for a slot a script font is selected for (the scheme's explicit slot or the language's script font) and stay empty otherwise, as in Office's own themes. See [Language contract](./programs/font-fidelity-everywhere/script-font-model.md#language-contract-ff-50-model-c) and [Theme slots](./programs/font-fidelity-everywhere/script-font-model.md#theme-slots-ff-49).
- A Latin deck therefore repeats its heading/body family in `ea`/`cs`. A Japanese deck with `design.fontScheme: { "major": "Carlito", "minor": "Carlito" }` keeps the Latin family in `latin` and uses Meiryo (PowerPoint) or Noto Sans JP (Google Slides) in `ea`. `design.fontScheme.eastAsian` / `.complexScript` (`{ "major": ..., "minor": ... }`) name a script font explicitly, for example for CJK text inside a Latin deck.

`@openpresentation/opf/composition` exports `resolveScriptFonts(document, { app, slideIndex })` (`app` is `"powerpoint"`, the default, or `"google-slides"`), and the package root exports `normalizeLanguageFamily(value)` (which reads a font scheme's `languageFamily`, `eastAsian` as `ea` and `complexScript` as `cs`). `resolveScriptFonts` returns the heading and body slots, the OOXML `lang` (a curated `ooxmlLang` culture tag such as `ja-JP` or `ms-MY`, or an authored region tag), the canonical `bcp47` tag, `script`, `direction`/`rtl`, and the per-script supplemental theme font. Renderers and exporters should use it rather than re-deriving slots. The model, the OOXML mapping and the open questions are in [`programs/font-fidelity-everywhere/script-font-model.md`](./programs/font-fidelity-everywhere/script-font-model.md). opf-render and opf-pptx implement it (FF-07, FF-19, FF-49).

## Brand assets and layout hints

The 2026-09-30 spec coverage audit found that the deck logo, `organization.logo`, `speaker.photo`, `design.contentDirection`, `design.chartPrimary`, `design.listBullet` and `fontScheme.accent` validated, edited and round-tripped but changed nothing in any engine. This section states what they do now. Every rule below is implemented once, in `composeSlide()` and `resolveLogo()` of `@openpresentation/opf`, and consumed by the renderer and the exporter; the decisions marked **(vetoable)** are agent decisions the owner can overturn.

### Layout templates and design

An OPF layout record (`opf-layout/v2`) is one ordered list of `regions`, declared once, in reading order, with a `direction` (`row` or `column`) and splits for two dimensions. A region has a `name`, a relative `size` and rules: accepted content kinds, role, flow, capacity and optional bleed. `layoutContent(record)` and `layoutStructure(record)` summarize those regions for hosts; `composeSlide()` reports their binding and boxes in `geometry.regions`. A slide may use `layout: "auto"` to bypass a record explicitly. [Layout templates](layout-templates.md) documents the binding and flow rules.

The effective `design` value of each key comes from the slide, then the deck, then the resolved theme, then the layout record, then the engine default. This includes `titleAlignment`, `contentAlignment`, `contentBox`, `contentDirection`, `chartPrimary`, `imageFit`, `listBullet` and `mirror`. `resolveDesignHints()` reports the supplying level, and `SlideComposition.design` holds the merged result. A layout's regions determine placement; `design.mirror` reverses its tracks, while the slide's own `composition` arranges the first primary flowing region. A top-level image block may still carry its own `placement` band. A layout sits on any slide background; it does not opt into a picture.

The `tag` (eyebrow) follows `titleAlignment` on every slide, and is left-aligned when none resolves, like the title, so a layout that centres its content does not centre the tag over a left-aligned title. The `subtitle` joins them whenever it sits in the title area (a cover, or a layout with no `subtitle` region of its own), so the heading group shares one alignment axis; a layout with a separate `subtitle` region keeps it on `contentAlignment`. Only the slide's own `design.contentAlignment` keeps the tag and that subtitle on content alignment, preserving the 2026-10-06 authoring decision.

### Logos live on the organization (RR-71, OPF 0.18)

A logo belongs to an organization. `Organization.logo` is one path or Asset for every shape, or up to four shapes:

```json
"organization": {
  "id": "acme", "name": "Acme",
  "logo": {
    "full": { "onLight": "./assets/acme-logo.svg", "onDark": "./assets/acme-logo-white.svg" },
    "icon": "./assets/acme-mark.svg"
  }
}
```

`resolveLogo(presentation, slide, { shape, onDark, slideIndex, reference })` (`@openpresentation/opf/composition`) returns `{ source, path, shape, variant, reference, designPath? }` or `null`:

```
  organization  1. options.reference                  var:organization.beta.logo.icon
                2. slides[i].design.logo, then design.logo:
                   false draws no logo; a reference picks the organization
                   (and the shape, when it names one)
                3. the primary organization            role "primary", else the first
  shape         the reference's shape, else options.shape (default full)
                missing shape -> full -> first of wordmark, stacked, icon
  variant       onDark on a dark background, else onLight; a missing one uses
                the other; a plain asset is "default"
  path          organization.logo, organization.1.logo.icon,
                organization.logo.full.onDark, ...
```

An override that names an organization without a logo draws nothing: it never falls back to another organization. Hosts pass their own background luminance test as `composeSlide(..., { darkBackground })` (`resolveSlideContext` computes it); core never inspects colors.

The same logos are placed anywhere through slide-scoped built-in references (`var:organization.logo`, `var:organization.logo.icon`, `var:organization.beta.logo.wordmark`), which resolve for each slide's background: see [templates and variables](templates-and-variables.md#organization-logos).

### Where the logo is drawn (vetoable)

1. **Cover and section slides.** A slide with no body payload on a title-only template, after empty template regions collapse, or without a layout (the same rule that centers covers) draws the primary organization's `full` logo (or the `design.logo` override) at the top-left of the free area, inside the slide padding and below any header furniture. `composeSlide` returns it as `geometry.logo` (`{ box, shape, path, source, variant, reference, anchor: 'left' }`): `x = area.left + padding`, `y` at the image-safe heading top, `height = 56` reference pixels at a 720-pixel short edge, `width = min(4 * height, free width)`. Headings start one gap below the box and the cover-centering rule centers the tag/title/subtitle group in the remaining span; the logo itself does not move. Consumers fit the image inside the box preserving its aspect ratio, anchored left and vertically centered (SVG `preserveAspectRatio="xMinYMid meet"`; PPTX computes the fitted size from the raster dimensions and places it at `box.x`). Nothing is drawn when no logo resolves or `design.logo` is `false`. **Content slides never get an automatic logo** (vetoable: it would move every content area).
2. **Headers and footers.** A zone places a logo like any picture: `"image": "var:organization.logo.icon"`. `layoutFurniture` resolves the reference for the slide's background; the image part carries the asset in `image`, the organization path in `sourcePath` and the reference in `reference`. Without a logo the engine reports `unresolved-content` at `<zone>.image`. The zone's parts sit in one row (see [dynamic composition](dynamic-composition.md)).
3. **Picture bullets.** See `listBullet` below: the `icon` shape.

> **Decision, 2026-09-30 (agent decision, vetoable).** 84 of the 126 bundled example decks carry a logo, so 81 cover slides gain a logo and their heading group moves down. The placement (top-left, 56 px, full logo) and the content-slide exclusion are the reference-engine defaults; a layout-driven logo slot is a separate design.

### `speaker.photo` is a built-in image variable (vetoable)

No reference engine draws a speaker photo by itself: the schema has no speaker slot on any slide and no slide-to-speaker link, and a speaker block on covers would be a separate design. The author places it explicitly with the built-in image variable (`"image": "var:speaker.photo"`, see [templates and variables](templates-and-variables.md#built-in-variables)); the field also round-trips through PPTX provenance.

### `contentDirection`

The effective value follows the normal design precedence: slide, deck, theme, layout, engine default. On automatic slides `vertical` sets the root arrangement to `column` and `horizontal` to `row`, unless the slide explicitly sets `composition.mode`. Promoted regions keep their geometry and nested content groups keep their own composition.

On a v2 template, `contentDirection` changes every flowing region into a row or column without changing the template's regions. An atomic `flow: "none"` region remains atomic. Without the direction hint each region uses its declared flow. Layout records do not have `composition.mode`, `columns` or `weights`; their region list defines the grid.

### `titleAlignment` and `contentAlignment` in right-to-left decks

> **Decision, 2026-10-01 (RR-05, supervisor decision, vetoable).** Alignment is logical for right-to-left text. In a deck whose language is written right to left, `left` means the start edge and `right` the end edge of each paragraph: an Arabic or Hebrew paragraph with the default (or authored) `left` is drawn against the right edge, with its bullets, indents and table cells to match, while an English paragraph in the same deck keeps the left edge. `center` is unchanged and a left-to-right deck is unchanged. The effective value (slide design, then deck design, then `left`) is still what `item.alignment` reports; `placement.lines[i].alignment` and the exported `algn` carry the physical edge. A right-to-left deck that wants a paragraph at its end edge sets `right`. See [Layout direction](programs/font-fidelity-everywhere/script-font-model.md#layout-direction-rr-05).

**Numbers in right-to-left text (LH-118).** A number with a sign, a currency or a percent sign (`+16%`, `-2.5%`, `$42`; core `numberRanges`) reads left to right inside right-to-left text: "+16%" in an Arabic metric drew as "16%+". The preview wraps each such number in a left-to-right isolate (U+2066 ... U+2069, core `isolateNumbers`), in metric values, deltas and units, table cells, body text and chart text. PowerPoint draws the isolate characters as boxes, so the PPTX export writes each such number as its own `en-US` run (as RR-05 does for a Latin phrase), and writes a paragraph of only such a number left to right (`rtl="0"`) at the physical alignment it had, because PowerPoint still drew "16%+" for an `en-US` run in a right-to-left paragraph of no letters (checked with PowerPoint's own slide export). Import reads the split runs and the left-to-right number-only paragraph back as they were authored. Bare digits (`2026`, `1,200`, `10:30`) are unchanged: they read the same in either direction.

### `chartPrimary`

The resolved `design.chartPrimary` applies on automatic slides only. It changes the root arrangement when the slide has no promoted regions, no `composition.mode` of its own, and its root nodes contain at least one chart leaf and at least one node that is not a chart. The **first chart node is primary** and the other root nodes form one synthetic sub-grid:

- `left` / `right`: the root is a two-track row with weights `[3, 2]` (chart first for `left`, last for `right`); the rest arrange in `auto` mode inside their track.
- `top` / `bottom`: a two-track column with weights `[3, 2]` (chart first for `top`).
- `none`, or any other value: no change, the existing automatic grid with equal weight.

Automatic composition builds the primary chart track and a direct content group for the other root nodes, preserving the 3:2 chart weight and source content order. A v2 template remains authoritative and does not apply this automatic hint. OPF 0.19 removes the v1 record-construction helper `chartPrimaryLayout`; authors use `chart-beside` or a custom v2 template for an authored grid.

The synthetic container has no OPF path, so it records no `groups`, `flows` or explanation entry; the root decision has `reason: 'chart-primary'` and `selectedColumns` 2 (row) or 1 (column). Explicit root `columns` and `weights` are ignored while the automatic hint applies. A chart inside a nested group, a chart-only root, or a single root `chart` payload leaves the arrangement unchanged. A slide using a v2 template follows that template instead.

### `listBullet` (vetoable)

`character` (the default) draws the current glyph marker. `image` draws the organization's icon logo (`resolveLogo(..., { shape: 'icon', onDark })`: the primary organization's, or the organization and shape `design.logo` names) as a picture bullet: every `items`/`bullets` item in `composeSlide` and every `listEntries[]` entry of its fit carry `bulletImage: { source, path }`. Marker geometry is unchanged, and each entry carries `bulletBox`, where the image draws: a square of side `marker.fontSize * PICTURE_BULLET_SCALE` (0.65, exported) whose bottom sits on the marker baseline (`marker.y`) with its left edge at `marker.x`. The scale is what desktop PowerPoint draws for an `a:buBlip` at `a:buSzPct 100000` (what the exporter writes), measured as a square 10, 15, 16, 20 and 31 px wide at font sizes of 16, 24, 25, 32 and 48 px (0.625 to 0.646; the heights run a pixel more from anti-aliasing) with its bottom on the text baseline, in Arial, Aptos, Georgia and Courier New alike, so it does not depend on the typeface; the text start and hanging indent are identical in both. The exporter sets no size, because PowerPoint sizes the bullet itself; consumers that draw it themselves (the preview) use `bulletBox`. Vetoable: the constant is a measurement, not a rule of the format. When `image` is set and no logo resolves, the glyph stays and the slide reports one `unresolved-content` diagnostic at `slides.N.design.listBullet` or `design.listBullet`, only when the slide has a list. The renderer draws an `<image>` per marker; the exporter writes native picture bullets (`a:buBlip`).

`none` draws no marker and no hanging indent, for lists that are a label with its explanation (pillars, team members, questions with answers). Every entry's text and description start at the left edge of the list box, and each `listEntries[]` marker is `{ none: true, text: '', indent: 0 }` (its `x`, `y` and `style` still give the first baseline and font). A nested `level` still steps in by 1.1 em. A list that sets `numbering` keeps its numbers, as it does for `image`. The preview draws nothing for the marker, and the exporter writes `a:buNone` with no margin or indent; a re-import reads the list back through the line roles recorded in the slide's provenance (a PPTX without that record keeps one text shape per line).

### `listStyle` (LH-08, vetoable)

`stack` draws each entry's text with its description under it, the entries close together. `rows` draws ruled rows: a hairline
(`ListFit.rules`, `LIST_RULE_WIDTH` = 1 reference pixel in the scheme's `neutrals.border`) between two first-level entries, `LIST_ROWS_GAP`
(0.8 em) between rows, and no bullet; a numbered list keeps its numbers. When every entry has a description and sits at the first level,
the labels are bold and, when the widest fits `LIST_ROWS_LABEL_SHARE` (40%) of the list's width on one line, sit in a column beside
their descriptions with their first baselines aligned (the label column at the right in a right-to-left list); otherwise each
description sits under its label. The preview draws the hairlines as SVG lines and the PPTX export as native line shapes (`OPF list rule
<path> N`), at the same geometry. Text sizes keep their roles: the description is 0.82 of the list size, as in a stacked list.

Without a `listStyle` anywhere, a list of two or more first-level entries that each pair a short label (3 words or fewer and at most 32
characters, no full stop: `isLabelText`) with a description is drawn as rows, under the size guard (the guarded rule `list-rows`): a
slide keeps the rows only when no block reads smaller than it does with the list stacked. A list of questions with answers is ruled the
same way (`pair-rows`, LH-133), each question in a column of 40% of the width, and a glossary's terms draw in the accent; a few
numbered takeaways and an agenda with descriptions draw numerals beside their rows (LH-134). See
[Questions and terms](dynamic-composition.md#questions-and-terms-lh-133). Every other list is stacked. Effective value:
the slide's design, the deck's, the theme's, then the layout record's.

### Eyebrows (LH-32, LH-50)

The slide `tag` is an eyebrow: `EYEBROW_TAG_SIZE` (22 reference px, 0.4 of the title's role size; it was 16), bold, in the primary color (the text color
when the primary is under 4.5:1 on the backdrop), and, where its script has case (`eyebrowCaps`: every letter cased and capitals of the
same length), in capitals with `EYEBROW_TRACKING` (0.08 em) of letter spacing. The document keeps the text as written: core sets
`textStyle.caps` and `textStyle.tracking` and measures the capitals with the spacing (`textWidthMeasurer`, `measureTextOutline`); the
preview draws the capitals with `letter-spacing`, and the PPTX export writes the authored text with `cap="all"` and `spc`, so it stays
editable and imports as written. Arabic, Hebrew, CJK and other scripts without case keep their letters and spacing (tracking would break
the joining of a cursive script).

A short label next to a longer text is that text's eyebrow (LH-50): a root text block of one line, 2 to 32 characters, 3 words or fewer
and no full stop (`isLabelText`), right before a plain text block that is no label and at least twice as long (`eyebrowLabel`). The two
are one block of the body: the label is bound to no region and takes no cell; it is drawn as an eyebrow at `eyebrowSize` of the paragraph (`EYEBROW_SHARE`, 0.6 of its size, from `EYEBROW_MIN_SIZE` 20 to
`EYEBROW_MAX_SIZE` 24 reference px, and always under the paragraph's size: one step of the type scale under a paragraph of 20 px or less, never
under the floor), `EYEBROW_GAP` (half a gap) over
the paragraph, at the paragraph's x, width and alignment, and is listed before it (`ComposedItem.eyebrow`). On a card the eyebrow carries
its paragraph's `frameBox`, and engines draw that card once, under the eyebrow. Blocks with a caption, an `emphasis` of their own, or on
a slide that pins a block to a region, are composed as written; a labeled paragraph is never LH-06's band or pill. The rule is guarded
(`eyebrow`): the paragraphs keep at least the size they have with the label as a block of its own.

The same label heads a list or a group (LH-152), at the root or inside a group, instead of taking an equal-width cell beside it half a
slide away: a label right before a list (`items` or `bullets`) or a group is that list's or group's eyebrow, and a group's first child that
is a label, followed by two or more blocks none of which is a label, is the eyebrow of the whole group. A list's eyebrow is drawn as a
paragraph's is. A group's eyebrow takes a band at the top of the group, sized for the first paragraph or list the group holds, and is drawn
over the span its blocks finally cover (their cards included), at the content alignment, before them in reading order. Two groups with
eyebrows stay side by side or stacked as peers. An explicit arrangement (a `composition` mode, weights or columns of the slide or
of the group) keeps its blocks as authored, a group of labels alone heads nothing, a root label before a root list stays a block on a
layout with a `sequence` region (LH-07 draws step badges on its lists), and two labels in a row are no eyebrows.

### `fontScheme.accent`

`resolveFontFamilies()` returns `accent` only when the effective scheme defines an `accent` role (a family string or a `Font` object). The slide `tag` (eyebrow) and the quote body use `fonts.accent ?? <current family>` (body for the tag, heading for the quote body); nothing else changes. The renderer loads and embeds it, the exporter writes it on those runs (`a:latin`) while the theme fonts stay major/minor, and import keeps restoring `design.fontScheme` from provenance. None of the bundled examples sets an accent font.

## What is *not* part of this chain

Beyond the color references above, content payloads carry no design controls in v1 — `position`, `fontSize` overrides at payload level, and the like were deliberately kept out while the content model stabilizes (see [`content-item-design-overrides.md`](./content-item-design-overrides.md); styled table cells and rich-text runs carry the only per-content styling, and their color fields take the reference forms above). The design system, plus layout hints (`titleAlignment`, `contentBox`, `chartPrimary`, ...) and dynamic composition, is the styling surface of an OPF document.
