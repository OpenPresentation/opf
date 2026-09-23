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
- **Measured layout** with the opf-render office font pack and `substitutionPolicy: "visual"`: `Aptos` and `Aptos Display` resolve to the visual substitute Carlito, and the substitution report lists both. This is an approximation, not a metric match. No metric Aptos substitute is bundled; the Akasia candidate is experimental and not selected automatically.
- **Measured layout under the default metric policy**, or with only the base pack: `font-unavailable` for Aptos, as for a document with no `design`. Supply licensed Aptos faces, allow visual substitution, or set a `fallbackFamily`.

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
- A Latin deck therefore repeats its heading/body family in `ea`/`cs`. A Japanese deck with `design.fontScheme: { "major": "Carlito", "minor": "Carlito" }` keeps the Latin family in `latin` and uses Meiryo (PowerPoint) or Noto Sans JP (Google Slides) in `ea`. `design.fontScheme.eastAsian` / `.complexScript` (`{ "major": ..., "minor": ... }`) name a script font explicitly, for example for CJK text inside a Latin deck.

`@openpresentation/opf` exports `resolveScriptFonts(document, { app, slideIndex })`, which returns the heading and body slots, the OOXML `lang` (a curated `ooxmlLang` culture tag such as `ja-JP` or `ms-MY`, or an authored region tag), the canonical `bcp47` tag, `script`, `direction`/`rtl`, and the per-script supplemental theme font. Renderers and exporters should use it rather than re-deriving slots. The model, the OOXML mapping and the open questions are in [`programs/font-fidelity-everywhere/script-font-model.md`](./programs/font-fidelity-everywhere/script-font-model.md). The renderer and exporter adopt it in separate changes, so their output is unchanged by this model alone.

## What is *not* part of this chain

Beyond the color references above, content payloads carry no design controls in v1 — `position`, `fontSize` overrides at payload level, and the like were deliberately kept out while the content model stabilizes (see [`content-item-design-overrides.md`](./content-item-design-overrides.md); styled table cells and rich-text runs carry the only per-content styling, and their color fields take the reference forms above). The design system, plus layout hints (`titleAlignment`, `contentBox`, `chartPrimary`, ...) and dynamic composition, is the styling surface of an OPF document.
