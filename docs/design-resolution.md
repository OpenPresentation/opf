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
    "theme": "dark",
    "background": "light1",
    "footer": {
      "left": { "text": "Acme Corp" },
      "right": { "text": "{{slide.number}}" }
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
| opf-render preview | `renderSvg` / `renderSlideSvg` `onDiagnostic` | once per path per rendered slide |
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

  | Role | Default |
  | --- | --- |
  | `primary`, `secondary`, `accent` | `accent1`, `accent2`, `accent3` |
  | `background` | the slide's own resolved background when it is one color (solid, theme slot or pattern background color); else the scheme's `background` role, else `light1`. A gradient or picture background uses the scheme default. |
  | `surface` | `light2`, or `dark2` on a dark slide |
  | `text` | `dark1`, or `light1` on a dark slide. A `text` override applies on a light slide only, so a dark slide always keeps readable light text. |
  | `textSecondary` | `dark2`, or `light2` on a dark slide |

  A slide is dark when its background's WCAG relative luminance is under 0.179, the point where white and black text contrast equally.
- **Links.** A link run (`link`) with no `color` of its own is drawn underlined in the scheme's `hyperlink` slot (the OOXML `hlink` color; Office blue `#0563C1` when the scheme sets none), in the preview and in the PPTX export (`a:schemeClr hlink` where the deck theme holds that color). Where that color has under 4.5:1 contrast against the slide background (the default Office blue on a dark slide), the slide's `text` color is used instead, as the slide tag does for a low-contrast primary color. A link run with its own `color` keeps it, and a `hyperlink` ColorRef always names the slot. `followedHyperlink` is written to the PPTX theme; a static preview cannot know which links were visited, so it draws every link in `hyperlink`.
- **Variable references** (`var:<id>`) resolve against the document's top-level `variables` map, independent of the scheme. Variables are deck-scoped named colors — use them for values that have meaning (`var:risk`) or repeat across slides. An unknown id is a validation warning, never an error, and engines fall back to their default text color.

The styled table cell and border color fields enforce the reference forms at the schema level (a typo like `"acent2"` is a schema error there — neither hex, a known name, nor a `var:` reference). Run colors stay open strings so imported decks keep validating: an unrecognized run color is a validation warning, and renderers fall back to the theme text color — the same warn-don't-error posture unknown catalog ids get. Unknown `var:` ids are warnings everywhere.

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

### Layout records: `placeholders` and `design`

A layout record (`opf-layout/v1`) holds what it contains in `placeholders` and how it is meant to look in `design`. The content kinds are one vocabulary: `title`, `subtitle`, `tag`, `text`, `list`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote` and `timeline`.

- `layoutContent(record)` (exported from `@openpresentation/opf`) derives `{ kind, count, heading: { title, subtitle, tag } }` from the placeholders, counting the leaf regions of placeholder groups (FA-26; `layoutLeaves(record)` lists them in reading order). `kind` is the most frequent body placeholder kind (a tie goes to the first in placeholder order), or `title` when there is none; `count` is the number of body placeholders. Nothing derived is stored on the record.
- `design` uses the keys and lowercase values of the deck's and a slide's `design`: `titleAlignment`, `contentAlignment`, `contentBox`, `contentDirection`, `chartPrimary`, `imageFit` and `listBullet`. An absent key means the layout has no opinion. `pnpm check:spec` verifies that the layout schema's `DesignHints` and `Design` agree.
- **One merge, per key, the slide winning:** the slide's `design`, then the deck's `design`, then the slide's layout record `design`, then the engine default. This holds for `titleAlignment`, `contentAlignment`, `contentBox`, `contentDirection`, `chartPrimary`, `imageFit` and `listBullet`, so a slide overrides exactly what its layout sets, by the same name, and a layout value nobody overrides is honored without copying it anywhere. `resolveDesignHints({ slide, layout, presentation, slideIndex })` (exported from `@openpresentation/opf/composition`) is the one place that computes it; it also reports which level supplied each key. `composeSlide()` returns the result as `SlideComposition.design`, and the renderer, the PPTX exporter, pagination and `validate` take `titleAlignment`, `contentAlignment`, `contentBox` and `listBullet` from there instead of re-deriving them; every image item carries its resolved fit (the block's own, else the effective `imageFit`, else `cover`) in `item.image.fit`. A value the schema does not allow for its key is skipped, so the next level answers.
- The layout's `composition.mode` still ranks above the design hint: `contentDirection` acts below it (see the decision below), and a layout's own `composition` columns and weights are overridden only by an effective `chartPrimary`.
- A layout's `image` placeholder may carry `placement` (FA-22): the slide's n-th top-level image bleeds to that edge unless its block sets its own placement. A layout does not opt into a picture: any layout sits on any background ([images](image-treatments.md)).
- Hosts no longer need to copy a layout's `design` into the deck or a slide. The pptx.gallery example builder and the editor's layout apply still do, which is harmless: a copied value is a deck or slide value and ranks above the record.
- **Decision, 2026-10-06 (agent decision, vetoable).** On a cover, `tag` and `subtitle` follow `titleAlignment` unless the slide's own `design.contentAlignment` is set; a deck or layout `contentAlignment` does not split the heading group, exactly as a deck value did before.

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

1. **Cover and section slides.** A slide with no body payload on a heading-only layout (`title`, `title-subtitle`, `section-divider`, any layout whose placeholders are all headings or placed images, or no layout: the same rule that centers covers) draws the primary organization's `full` logo (or the `design.logo` override) at the top-left of the free area, inside the slide padding and below any header furniture. `composeSlide` returns it as `geometry.logo` (`{ box, shape, path, source, variant, reference, anchor: 'left' }`): `x = area.left + padding`, `y` at the image-safe heading top, `height = 56` reference pixels at a 720-pixel short edge, `width = min(4 * height, free width)`. Headings start one gap below the box and the cover-centering rule centers the tag/title/subtitle group in the remaining span; the logo itself does not move. Consumers fit the image inside the box preserving its aspect ratio, anchored left and vertically centered (SVG `preserveAspectRatio="xMinYMid meet"`; PPTX computes the fitted size from the raster dimensions and places it at `box.x`). Nothing is drawn when no logo resolves or `design.logo` is `false`. **Content slides never get an automatic logo** (vetoable: it would move every content area).
2. **Headers and footers.** A zone places a logo like any picture: `"image": "var:organization.logo.icon"`. `layoutFurniture` resolves the reference for the slide's background; the image part carries the asset in `image`, the organization path in `sourcePath` and the reference in `reference`. Without a logo the engine reports `unresolved-content` at `<zone>.image`. The zone's parts sit in one row (see [dynamic composition](dynamic-composition.md)).
3. **Picture bullets.** See `listBullet` below: the `icon` shape.

> **Decision, 2026-09-30 (agent decision, vetoable).** 84 of the 126 bundled example decks carry a logo, so 81 cover slides gain a logo and their heading group moves down. The placement (top-left, 56 px, full logo) and the content-slide exclusion are the reference-engine defaults; a layout-driven logo slot is a separate design.

### `speaker.photo` is a built-in image variable (vetoable)

No reference engine draws a speaker photo by itself: the schema has no speaker slot on any slide and no slide-to-speaker link, and a speaker block on covers would be a separate design. The author places it explicitly with the built-in image variable (`"image": "var:speaker.photo"`, see [templates and variables](templates-and-variables.md#built-in-variables)); the field also round-trips through PPTX provenance.

### `contentDirection`

The effective value is `slides[i].design.contentDirection`, then `design.contentDirection`. It sets the root arrangement mode: `vertical` is `column`, `horizontal` is `row`. Precedence for the root mode:

```
  1. composition.mode                            explicit: the slide's own, else the
                                                 layout record's geometry contract
  2. design.contentDirection                     slide design, then deck design
  3. the layout record's design.contentDirection the layout's own direction
  4. auto
```

Promoted regions (`left`, `top:left`, ...) keep their explicit geometry: `contentDirection` does not reinterpret them. Nested groups keep their own `composition`. The decision record keeps `reason: 'configured-mode'`. Reserved placeholder slots still count when only the hint sets the mode, as they do for the layout record's `design.contentDirection`.

> **Decision, 2026-09-30 (agent decision, vetoable).** A layout record's `composition.mode` ranks above the design hint. pptx.gallery copies a layout record's `design.contentDirection` into the design of its examples, so a hint that overrode the layout's `composition.mode` would flatten the layout's own grid by construction: `chart-2x` (`design.contentDirection: horizontal`, `mode: grid, columns: 2`) would compose its four blocks as one row under the `horizontal` it derives for itself, and the renderer's gallery-layout fixtures (57 layouts whose preview must differ from the default only in alignment) fail. The hint therefore ranks with the layout record's `design.contentDirection`, above it, and acts where no composition contract exists: slides without a layout and the bundled layouts without `composition.mode` (62 of 100). Under this rule no bundled example slide changes geometry for `contentDirection` (101 decks set it; all of their blocks slides use layouts that carry a mode). The alternative, ranking the hint above the layout mode, would change 125 single-payload example slides and break the gallery's own layouts.

### `titleAlignment` and `contentAlignment` in right-to-left decks

> **Decision, 2026-10-01 (RR-05, supervisor decision, vetoable).** Alignment is logical for right-to-left text. In a deck whose language is written right to left, `left` means the start edge and `right` the end edge of each paragraph: an Arabic or Hebrew paragraph with the default (or authored) `left` is drawn against the right edge, with its bullets, indents and table cells to match, while an English paragraph in the same deck keeps the left edge. `center` is unchanged and a left-to-right deck is unchanged. The effective value (slide design, then deck design, then `left`) is still what `item.alignment` reports; `placement.lines[i].alignment` and the exported `algn` carry the physical edge. A right-to-left deck that wants a paragraph at its end edge sets `right`. See [Layout direction](programs/font-fidelity-everywhere/script-font-model.md#layout-direction-rr-05).

### `chartPrimary`

The effective value is `slides[i].design.chartPrimary`, then `design.chartPrimary`, then the layout record's `design.chartPrimary`. It applies to the root arrangement only when the slide has no promoted regions, no `composition.mode` of its own, and its root nodes contain at least one chart leaf and at least one node that is not a chart. The **first chart node is primary** and the other root nodes form one synthetic sub-grid:

- `left` / `right`: the root is a two-track row with weights `[3, 2]` (chart first for `left`, last for `right`); the rest arrange in `auto` mode inside their track.
- `top` / `bottom`: a two-track column with weights `[3, 2]` (chart first for `top`).
- `none`, or any other value: no change, the existing automatic grid with equal weight.

It is sugar for a placeholder group (FA-26): `chartPrimaryLayout(side, kinds)` (exported from `@openpresentation/opf/composition`) returns the layout record it stands for, a root row (`left`, `right`) or column (`top`, `bottom`) weighted 3:2 toward the chart that holds the chart region and one automatic group of the other root content, and composition fills exactly that record, except that the first chart fills the chart region wherever it sits in the slide. A record can state the same structure explicitly with a `PlaceholderGroup`; the gallery's `chart-3x-*` primary layouts do since FA-26 and no longer set `design.chartPrimary`. While it applies it also replaces the slide's layout record's own placeholder groups.

The synthetic container has no OPF path, so it records no `groups`, `flows` or explanation entry; the root decision has `reason: 'chart-primary'` and `selectedColumns` 2 (row) or 1 (column). Explicit root `columns` and `weights`, from the slide or the layout record, are ignored while it applies, and reserved placeholder slots are not applied. A chart inside a nested group, a chart-only root, or a single root `chart` payload leaves the arrangement unchanged.

> **Decision, 2026-09-30 (agent decision, vetoable).** Unlike `contentDirection`, `chartPrimary` overrides the layout record's `composition.mode`, `columns` and `weights` (only the slide's own `composition.mode` blocks it). It is an author opt-in: no bundled layout record sets `design.chartPrimary`, so nothing derives it, while every bundled chart layout that mixes a chart with text carries a `composition.mode` (`chart-2x` grid, `data-visualization` row `[2, 1]`, ...). Ranking the layout mode above the hint would make the field inert on every bundled chart layout. 40 example slides (10 per side) change under this rule.

### `listBullet` (vetoable)

`character` (the default) draws the current glyph marker. `image` draws the organization's icon logo (`resolveLogo(..., { shape: 'icon', onDark })`: the primary organization's, or the organization and shape `design.logo` names) as a picture bullet: every `items`/`bullets` item in `composeSlide` and every `listEntries[]` entry of its fit carry `bulletImage: { source, path }`. Marker geometry is unchanged, and each entry carries `bulletBox`, where the image draws: a square of side `marker.fontSize * PICTURE_BULLET_SCALE` (0.65, exported) whose bottom sits on the marker baseline (`marker.y`) with its left edge at `marker.x`. The scale is what desktop PowerPoint draws for an `a:buBlip` at `a:buSzPct 100000` (what the exporter writes), measured as a square 10, 15, 16, 20 and 31 px wide at font sizes of 16, 24, 25, 32 and 48 px (0.625 to 0.646; the heights run a pixel more from anti-aliasing) with its bottom on the text baseline, in Arial, Aptos, Georgia and Courier New alike, so it does not depend on the typeface; the text start and hanging indent are identical in both. The exporter sets no size, because PowerPoint sizes the bullet itself; consumers that draw it themselves (the preview) use `bulletBox`. Vetoable: the constant is a measurement, not a rule of the format. When `image` is set and no logo resolves, the glyph stays and the slide reports one `unresolved-content` diagnostic at `slides.N.design.listBullet` or `design.listBullet`, only when the slide has a list. The renderer draws an `<image>` per marker; the exporter writes native picture bullets (`a:buBlip`).

### `fontScheme.accent`

`resolveFontFamilies()` returns `accent` only when the effective scheme defines an `accent` role (a family string or a `Font` object). The slide `tag` (eyebrow) and the quote body use `fonts.accent ?? <current family>` (body for the tag, heading for the quote body); nothing else changes. The renderer loads and embeds it, the exporter writes it on those runs (`a:latin`) while the theme fonts stay major/minor, and import keeps restoring `design.fontScheme` from provenance. None of the bundled examples sets an accent font.

## What is *not* part of this chain

Beyond the color references above, content payloads carry no design controls in v1 — `position`, `fontSize` overrides at payload level, and the like were deliberately kept out while the content model stabilizes (see [`content-item-design-overrides.md`](./content-item-design-overrides.md); styled table cells and rich-text runs carry the only per-content styling, and their color fields take the reference forms above). The design system, plus layout hints (`titleAlignment`, `contentBox`, `chartPrimary`, ...) and dynamic composition, is the styling surface of an OPF document.
