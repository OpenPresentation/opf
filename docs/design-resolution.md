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

The `aptos` record supplies the OOXML pair (`major`/`minor`). The `code` role is an OPF-specific addition with no OOXML slot, so it layers on top without disturbing the pair. When serializing to PowerPoint, engines write `major`/`minor` to `majorFont`/`minorFont` and map abstract roles (`heading`, `body`) onto those slots. `accent` has no slot; the `code` family is written directly on code runs. The same slot-versus-role split applies to color schemes: OOXML slots (`accent1`–`accent6`, `dark1/2`, `light1/2`) round-trip directly, abstract roles (`primary`, `text`, `surface`, …) are mapped onto slots by the engine.

### Code font

The `code` role resolves per key like every other override:

1. `code` on the effective `design.fontScheme` object;
2. `code` on the resolved font-scheme record (the `consolas` and `courier-new` records carry `{ "family": "Consolas" }` and `{ "family": "Courier New" }`);
3. otherwise **Roboto Mono**, the documented fallback that `@openpresentation/opf-render` bundles.

The heading and body families are never reused as the code fallback, so choosing `aptos` still gives Roboto Mono code unless the deck sets `code`. `resolveFontFamilies()` in `@openpresentation/opf` applies these rules for all engines.

### Engine default font scheme

The last-resort font scheme applies only when neither the slide, the deck nor the resolved theme names one. Every bundled theme names a font scheme (`minimal` uses `aptos`), and engines default the theme to `minimal`, so a document with no `design` gets `aptos` in every engine.

Every engine shares one last resort, `aptos`, so a custom theme without `fontScheme` is measured, paginated, previewed and exported in the same fonts. `@openpresentation/opf` exports it as `DEFAULT_FONT_SCHEME` (`resolveScriptFonts()` uses it too), and [`engine-defaults.json`](../spec/reference/engine-defaults.json) records it as `fontScheme.pptx.latin`:

| Engine | Last resort | Where |
| --- | --- | --- |
| Core pagination | `DEFAULT_FONT_SCHEME` (`aptos`) | `packages/javascript/src/pagination.ts` |
| opf-render preview | `aptos` (`engineDefaults.fontScheme.pptx.latin`) | `src/svg.js` |
| opf-editor composition and slide transfer | `aptos` | `src/font-defaults.js` |
| opf-pptx export | `aptos` (`DEFAULTS.fontScheme`) | `src/index.js` |


`fontScheme.google` (`roboto`, `noto-sans-sc`, `noto-sans`) is not read by any current engine. It is kept as the intended default for a future Google Slides exporter, whose output renders in Google-hosted fonts.

Aptos is not openly licensed, so no OPF package bundles it. Previews take the same path for the last resort as for any `aptos` deck:

- **Estimated layout** (no `textMeasurement`): the SVG names `Aptos` and `Aptos Display`, and the default raster engine draws them with its bundled sans-serif fallback (Roboto).
- **Measured layout** with the opf-render office font pack (the default for `prepareNodeFonts({pack: 'office'})`): `Aptos` and `Aptos Display` resolve to Intos and Intos Display, metric-compatible replacements from the OPF font policy (0.000% mean width difference against Aptos 2.01), and the substitution report lists both. With only the base pack and `substitutionPolicy: "visual"` they fall back to the visual alternates Roboto and Carlito. The PPTX always names Aptos. See [font-fidelity.md](font-fidelity.md#font-policy-ff-31).
- **Measured layout with only the base pack under the metric policy**: `font-unavailable` for Aptos, as for a document with no `design`. Supply licensed Aptos faces, allow visual substitution, or set a `fallbackFamily`.

Until FF-35 (font-fidelity-everywhere), core pagination, opf-render and opf-editor fell back to `roboto` while opf-pptx used `aptos`, so such a deck was measured in Roboto but exported with Aptos. None of the 126 bundled examples reaches the last resort: all 805 renderer golden rasters and all 126 exported PPTX files are byte-identical before and after the change. `packages/javascript/test/font-scheme-defaults.test.mjs` checks the shared default in core pagination, and each sibling repository has a parity test.

### Unknown font scheme

A font-scheme id that matches no inline or bundled record (`"fontScheme": "no-such-scheme"`, `{ "id": "no-such-scheme", ... }`, or a theme record that names one) is handled the same way in every engine. The document still validates, because an id may name a record from a catalog the engine has not loaded:

1. The `DEFAULT_FONT_SCHEME` record (`aptos`) is the base. Sibling fields on an object reference still override it per key, so `{ "id": "no-such-scheme", "major": "Inter", "minor": "Inter" }` uses Inter, and a `code` role still applies.
2. The engine reports one `unresolved-font-scheme` diagnostic: `{ code, path, id, fallback: "aptos", message }`. `path` is where the id is written: `slides.N.design.fontScheme`, `design.fontScheme`, or the `slides.N.design.theme` / `design.theme` reference whose record names it.
3. An object without `id` is an inline scheme on the same base and reports nothing.

`resolveFontSchemeReference(reference, lookup, path)` in `@openpresentation/opf` implements this rule. `resolveFontFamilies()` also falls back to the default scheme's families (Aptos Display, Aptos) when a scheme names no heading or body family, instead of Roboto. Authoring-time `lintPresentation()` already warns about the unknown id (`opf/catalog-reference`).

| Engine | Diagnostic channel | Reported |
| --- | --- | --- |
| Core pagination | `paginatePresentation(..., { onDiagnostic })` | once per path per call |
| opf-render preview | `renderSvg` / `renderSvgDeck` `onDiagnostic` | once per path per rendered slide |
| opf-editor | `session.composeSlide` / `paginateSlide` `onDiagnostic` option | once per call |
| opf-pptx export | `toPptx(..., { onDiagnostic })` | once per path per export |

Before FF-35b, core pagination and opf-editor measured such decks in Roboto and opf-render threw `catalog-resolution-failed`. opf-pptx already exported Aptos, but reported nothing. None of the 126 bundled examples names an unknown font scheme. The 805 example SVGs, the 805 golden rasters and the 126 exported PPTX files are byte-identical before and after the change.

### Sibling agreement checks

opf-render, opf-editor and opf-pptx run the same unknown-scheme cases as core (`test/default-font-scheme.mjs`). Each package keeps a local copy of the default, and in opf-editor of the resolver. Their checks against core's `DEFAULT_FONT_SCHEME`, `resolveFontSchemeReference` and `paginatePresentation` run only when the installed core exports them. Those checks are skipped today: the siblings install the published `@openpresentation/opf` 0.11.0, which predates FF-35. They activate in either of two ways:

- **Sibling CI:** after a core release that includes FF-35 and FF-35b is published, and each sibling's `@openpresentation/opf` dependency and lockfile move to it. After that release, the local copies can import core directly.
- **Core ecosystem CI** (`.github/workflows/ecosystem-ci.yml`), which links this checkout's core into pinned sibling commits and runs their `npm test`: after those pins move to sibling commits that contain the FF-35 and FF-35b tests (the program's sibling pin bump).

Until then, the equality with core is established by running the sibling tests against a locally linked core.

## Color references in content

Content color fields (`TextRun.color`, styled table cell `style.fill` / `style.color`, table cell border `color`) accept references as well as literal hex, and those references resolve through the same chain above:

```
  "color": "accent2"          slot name  -> effective color scheme slot
  "color": "text"             role name  -> role-to-slot mapping, then the slot
  "color": "var:risk"         variable   -> top-level variables map
  "color": "#B42318"          literal    -> used as-is (frozen at authoring time)
```

- **Slot names** (`accent1`–`accent6`, `dark1`, `dark2`, `light1`, `light2`, `hyperlink`, `followedHyperlink`) read the named slot from the *effective* color scheme — the one produced by the slide → deck → theme → engine-default precedence at the top of this page. A slide-level `design.colorScheme` override therefore recolors that slide's named runs too.
- **Role names** (`primary`, `secondary`, `accent`, `background`, `surface`, `text`, `textSecondary`) resolve through the same role handling engines already apply to color schemes: a role defined on the effective scheme is used directly; otherwise the engine maps the role onto a slot exactly as it does when serializing schemes.
- **Variable references** (`var:<id>`) resolve against the document's top-level `variables` map, independent of the scheme. Variables are deck-scoped named colors — use them for values that have meaning (`var:risk`) or repeat across slides. An unknown id is a validation warning, never an error, and engines fall back to their default text color.

The styled table cell and border color fields enforce the reference forms at the schema level (a typo like `"acent2"` is a schema error there — neither hex, a known name, nor a `var:` reference). Run colors stay open strings so imported decks keep validating: an unrecognized run color is a validation warning, and renderers fall back to the theme text color — the same warn-don't-error posture unknown catalog ids get. Unknown `var:` ids are warnings everywhere.

### Background colors are ColorRefs

The colors of a solid background (`SolidBackground.color`), of each gradient stop and of a pattern (`foregroundColor`, `backgroundColor`) take the same forms as the content fields above: a literal hex, a slot or role name, or a `var:<id>` reference. The schema keeps these fields as plain strings, so a reference validates; engines resolve it through `resolveColorRef()` against the effective color scheme and the deck `variables`, and a reference that resolves to nothing is drawn as the engine default (white for a background), as for any other unresolvable color. The default text color of the slide follows the resolved background. A PPTX export writes `a:schemeClr` where the deck theme holds the named slot or role exactly, and the resolved literal otherwise (FF-24 conventions).

> **Decision, 2026-09-30 (agent decision, vetoable).** The spec coverage audit found that `SolidBackground.color` accepted `var:` and slot names (the field is a string) but both engines painted white, while [`content-item-design-overrides.md`](./content-item-design-overrides.md) already states that every color field must accept the ColorRef forms and never hex alone. Rather than tighten the schema (which would break documents that validate today), the engines resolve ColorRefs in backgrounds. The owner can veto this by restricting the three background color fields to `HexColor` in the schema and the engines to hex only.

`@openpresentation/opf` exports `resolveColorRef()` with the shared slot, role, variable, and hex rules above so renderers and exporters do not drift. Pass the effective color scheme, optional resolved role colors, the deck `variables` map, and a theme-text `fallback` for unrecognized references.

## Script fonts and language

OOXML gives each theme font (major and minor) three script slots: `latin`, East Asian (`ea`) and complex script (`cs`). The presentation `language` and the effective font scheme resolve to all three:

```
  latin          design font scheme heading/body (the chain above)
  eastAsian      1. design.fontScheme.eastAsian      explicit slot
  complexScript  2. the scheme's own major/minor     when languageFamily is ea / cs and its
                                                     languages list is empty or names the language
                 3. the language's font scheme       when the language's script uses the slot
                 4. the latin family                 otherwise
```

- A language record's `script` (ISO 15924) picks its slot. East Asian scripts (`Jpan`, `Hans`, `Hant`, `Kore`, ...) use `eastAsian`. Complex scripts (`Arab`, `Hebr`, `Deva`, `Thai`, ...) use `complexScript`. Latin, Cyrillic, Greek and other scripts use `latin`. `direction` defaults from the script (Arabic and Hebrew are right-to-left).
- The language's `fontScheme` applies to PowerPoint output and `googleFontScheme` to Google Slides output. For Latin-script languages, the design font scheme always supplies the latin slot.
- A language sets `lang`, the text direction and the script slots, and never the Latin scheme: only `design.fontScheme` (slide, then deck, then theme, then the shared default `aptos`) sets the latin fonts, and a language record's `fontScheme` is a default for its own script slot, not a deck font. The PPTX theme's `a:ea` and `a:cs` are written only for a slot a script font is selected for (the scheme's explicit slot or the language's script font) and stay empty otherwise, as in Office's own themes. See [Language contract](./programs/font-fidelity-everywhere/script-font-model.md#language-contract-ff-50-model-c) and [Theme slots](./programs/font-fidelity-everywhere/script-font-model.md#theme-slots-ff-49).
- A Latin deck therefore repeats its heading/body family in `ea`/`cs`. A Japanese deck with `design.fontScheme: { "major": "Carlito", "minor": "Carlito" }` keeps the Latin family in `latin` and uses Meiryo (PowerPoint) or Noto Sans JP (Google Slides) in `ea`. `design.fontScheme.eastAsian` / `.complexScript` (`{ "major": ..., "minor": ... }`) name a script font explicitly, for example for CJK text inside a Latin deck.

`@openpresentation/opf` exports `resolveScriptFonts(document, { app, slideIndex })`, which returns the heading and body slots, the OOXML `lang` (a curated `ooxmlLang` culture tag such as `ja-JP` or `ms-MY`, or an authored region tag), the canonical `bcp47` tag, `script`, `direction`/`rtl`, and the per-script supplemental theme font. Renderers and exporters should use it rather than re-deriving slots. The model, the OOXML mapping and the open questions are in [`programs/font-fidelity-everywhere/script-font-model.md`](./programs/font-fidelity-everywhere/script-font-model.md). opf-render and opf-pptx implement it (FF-07, FF-19, FF-49).

## Brand assets and layout hints

The 2026-09-30 spec coverage audit found that `design.logo`, `organization.logo`, `speaker.photo`, `design.contentDirection`, `design.chartPrimary`, `design.listBullet` and `fontScheme.accent` validated, edited and round-tripped but changed nothing in any engine. This section states what they do now. Every rule below is implemented once, in `composeSlide()` and `resolveLogo()` of `@openpresentation/opf`, and consumed by the renderer and the exporter; the decisions marked **(vetoable)** are agent decisions the owner can overturn.

### Logo source and variant selection

`resolveLogo(presentation, slide, { slot, onDark, slideIndex })` returns `{ source, path, variant, slot }` or `null`:

```
  source        1. slides[i].design.logo
                2. design.logo
                3. the primary organization's logo   role "primary", else the first
                                                    organization; object or array
  variant       a string or Asset object is the "default" variant
                a LogoSet picks by slot and tone (below)
  path          design.logo, design.logo.light, organization.2.logo,
                slides.3.design.logo.icon, ...
```

Absence inherits (there is no `false` for logos); a level that yields no usable asset falls through to the next. A LogoSet is searched in this order, same-tone variants first, neutral ones next, the opposite tone last:

| Slot | On a dark background (`onDark: true`) | On a light background |
| --- | --- | --- |
| `lockup` | light, default, stackedLight, stacked, wordmarkLight, wordmark, iconLight, icon, then dark, stackedDark, wordmarkDark, iconDark | dark, default, stackedDark, stacked, wordmarkDark, wordmark, iconDark, icon, then light, stackedLight, wordmarkLight, iconLight |
| `icon` | iconLight, icon, then the dark lockup chain | iconDark, icon, then the light lockup chain |
| `stacked` | stackedLight, stacked, then the dark lockup chain | stackedDark, stacked, then the light lockup chain |

Hosts pass their own background luminance test as `composeSlide(..., { darkBackground })`; core never inspects colors.

### Where the logo is drawn (vetoable)

1. **Cover and section slides.** A slide with no body payload on a heading-only layout (`title`, `title-subtitle`, `section-divider`, any layout whose placeholders are all headings, or no layout: the same rule that centers covers) draws the `lockup` logo at the top-left of the free area, inside the slide padding and below any header furniture. `composeSlide` returns it as `geometry.logo` (`{ box, slot: 'lockup', path, source, variant, anchor: 'left' }`): `x = area.left + padding`, `y` at the image-safe heading top, `height = 56` reference pixels at a 720-pixel short edge, `width = min(4 * height, free width)`. Headings start one gap below the box and the cover-centering rule centers the tag/title/subtitle group in the remaining span; the logo itself does not move. Consumers fit the image inside the box preserving its aspect ratio, anchored left and vertically centered (SVG `preserveAspectRatio="xMinYMid meet"`; PPTX computes the fitted size from the raster dimensions and places it at `box.x`). Nothing is drawn when no logo resolves. **Content slides never get an automatic logo** (vetoable: it would move every content area).
2. **Headers and footers.** `HeaderFooterItem.logo: true` generates an image furniture part with `field: 'logo'`, `generated: true`, `image: resolved.source`, `path: <zone>.logo` and `sourcePath: resolved.path`, from the `icon` slot, in the same box as a zone `image`. Fields in a zone stack in the order logo, image, text, organization, socials, section, slide number, date. Without a logo the engine reports `unresolved-content` at `<zone>.logo` ("Generated logo needs design.logo or a primary organization logo.").
3. **Picture bullets.** See `listBullet` below.
4. `organization.logo` is therefore drawn wherever the deck logo is: it is the fallback source, never a separate placement.

> **Decision, 2026-09-30 (agent decision, vetoable).** 84 of the 126 bundled example decks carry a `design.logo` or an `organization.logo`, so 81 cover slides gain a logo and their heading group moves down. The placement (top-left, 56 px, lockup) and the content-slide exclusion are the reference-engine defaults; a layout-driven logo slot is a separate design.

### `speaker.photo` is authoring metadata (vetoable)

No reference engine draws a speaker photo: the schema has no speaker slot on any slide and no slide-to-speaker link, and a speaker block on covers would be a separate design. The field stays authoring metadata for hosts and layouts, and it round-trips through PPTX provenance.

### `contentDirection`

The effective value is `slides[i].design.contentDirection`, then `design.contentDirection`. It sets the root arrangement mode: `vertical` is `column`, `horizontal` is `row`. Precedence for the root mode:

```
  1. the slide's own composition.mode            explicit
  2. design.contentDirection                     slide design, then deck design
  3. the layout record's composition.mode        the layout's geometry default
  4. the layout record's slideLayoutDirection    existing hint
  5. auto
```

Promoted regions (`left`, `top:left`, ...) keep their explicit geometry: `contentDirection` does not reinterpret them. Nested groups keep their own `composition`. The decision record keeps `reason: 'configured-mode'`. Reserved placeholder slots still count when only the hint sets the mode, as they do for `slideLayoutDirection`.

> **Decision, 2026-09-30 (agent decision, vetoable).** The design hint ranks above the layout record's `composition.mode` (step 2 before step 3), the way a deck's `titleAlignment` or `contentBox` wins over a layout record's `slideTitleAlignment` or `contentBox`, and because pptx.gallery derives `design.contentDirection` from the layout's `slideLayoutDirection`: the deck value is the author's override of that direction. The cost is that a grid layout flattens under a deck-wide direction: a multi-block slide on a `grid` layout becomes one row under `horizontal` or one column under `vertical`. No bundled example has that shape: the 125 example slides that change (66 under `horizontal`, 59 under `vertical`) all carry a single root payload on a two-column grid layout, and that payload now fills the content area instead of half of it. The alternative is to rank the layout record's `composition.mode` as explicit (step 3 before step 2); it would leave those 125 slides unchanged, but `chartPrimary` would then never apply to the bundled chart layouts, which all carry a `composition.mode`.

### `chartPrimary`

The effective value is `slides[i].design.chartPrimary`, then `design.chartPrimary`, then the layout record's `contentTypeChartPrimary` (`Top`, `Bottom`, `Left`, `Right` lower-cased; `None` is `none`). It applies to the root arrangement only when the slide has no promoted regions, no `composition.mode` of its own, and its root nodes contain at least one chart leaf and at least one node that is not a chart. The **first chart node is primary** and the other root nodes form one synthetic sub-grid:

- `left` / `right`: the root is a two-track row with weights `[3, 2]` (chart first for `left`, last for `right`); the rest arrange in `auto` mode inside their track.
- `top` / `bottom`: a two-track column with weights `[3, 2]` (chart first for `top`).
- `none`, or any other value: no change, the existing automatic grid with equal weight.

The synthetic container has no OPF path, so it records no `groups`, `flows` or explanation entry; the root decision has `reason: 'chart-primary'` and `selectedColumns` 2 (row) or 1 (column). Explicit root `columns` and `weights`, from the slide or the layout record, are ignored while it applies, and reserved placeholder slots are not applied. A chart inside a nested group, a chart-only root, or a single root `chart` payload leaves the arrangement unchanged.

### `listBullet` (vetoable)

`character` (the default) draws the current glyph marker. `image` draws the deck's icon logo (`resolveLogo(..., { slot: 'icon', onDark })`) as a picture bullet: every `items`/`bullets` item in `composeSlide` and every `listEntries[]` entry of its fit carry `bulletImage: { source, path }`. Marker geometry is unchanged: the image is a square of side `marker.fontSize` whose bottom sits on the marker baseline (`marker.y`) with its left edge at `marker.x`. When `image` is set and no logo resolves, the glyph stays and the slide reports one `unresolved-content` diagnostic at `slides.N.design.listBullet` or `design.listBullet`, only when the slide has a list. The renderer draws an `<image>` per marker; the exporter writes native picture bullets (`a:buBlip`).

### `fontScheme.accent`

`resolveFontFamilies()` returns `accent` only when the effective scheme defines an `accent` role (a family string or a `Font` object). The slide `tag` (eyebrow) and the quote body use `fonts.accent ?? <current family>` (body for the tag, heading for the quote body); nothing else changes. The renderer loads and embeds it, the exporter writes it on those runs (`a:latin`) while the theme fonts stay major/minor, and import keeps restoring `design.fontScheme` from provenance. None of the bundled examples sets an accent font.

## What is *not* part of this chain

Beyond the color references above, content payloads carry no design controls in v1 — `position`, `fontSize` overrides at payload level, and the like were deliberately kept out while the content model stabilizes (see [`content-item-design-overrides.md`](./content-item-design-overrides.md); styled table cells and rich-text runs carry the only per-content styling, and their color fields take the reference forms above). The design system, plus layout hints (`titleAlignment`, `contentBox`, `chartPrimary`, ...) and dynamic composition, is the styling surface of an OPF document.
