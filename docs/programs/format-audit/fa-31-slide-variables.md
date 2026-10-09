# FA-31: headers and footers use variables

Owner decision, 2026-10-09: headers, footers and body text insert generated
values with the one variable syntax OPF already has, `{{ }}`, instead of
per-field booleans and a second template syntax. Ships in the lockstep 0.17.0.
Branch `codex/fa-31-slide-variables` in every repository, PR titles `FA-31: `.

## Why

Today a header or footer zone has three ways to say "insert a value":

| Value | 0.16 header/footer | 0.16 variables |
| --- | --- | --- |
| Organization name | `"organization": true` | `{{organization.name}}` |
| Speaker | `"speaker": true` | `{{speaker.name}}, {{speaker.title}}` |
| Section | `"section": true` | none |
| Slide number | `"slideNumber": true`, `"slideNumberFormat": "{current}"` | none |
| Slide count | `{total}` inside `slideNumberFormat` | none |

The flags duplicate the built-in variables, fix the order of values in a
zone (one line each, in engine order), and `{current}`/`{total}` is a second,
unvalidated template language. [Templates and variables](../../templates-and-variables.md)
decision 15 kept per-slide values out of the built-ins because they need
composition-time resolution and native PPTX fields. That is an implementation
constraint, not a reason for a second syntax: the per-slide built-ins below
resolve at composition time and keep the native field.

## The format

```json
"design": {
  "header": {
    "left":  { "text": "{{organization.name}}" },
    "right": { "text": "{{slide.section}}" }
  },
  "footer": {
    "left":  { "text": "Confidential · {{customer}}" },
    "right": { "text": "{{slide.number}} / {{deck.slideCount}}" }
  }
}
```

New built-in variables, usable in **any** string of a slide (body text,
titles, notes, table cells) and in header and footer `text`:

| Built-in | Kind | Value |
| --- | --- | --- |
| `slide.number` | text | the displayed number of this slide in the rendered or exported deck (after pagination, so a slide split in two shows two numbers) |
| `slide.section` | text | this slide's `section`; a slide without one resolves to empty text with a `variable-builtin-missing` warning at that slide |
| `deck.slideCount` | text | the number of slides in the rendered or exported deck (after pagination) |

`slide.` becomes a reserved built-in prefix, like `deck.`, `speaker.` and
`organization.`. `{{slide.anything-else}}` is `variable-unknown-builtin`. The
three are *slide-scoped*: `var:slide.number` (whole-field) is not supported in
this release, because every field that would take it is a string and the token
covers it; `var:slide.*` and `var:deck.slideCount` are `variable-unknown-builtin`.

Removed from `HeaderFooterItem`, with no alias (FA invariant 1):
`organization`, `speaker`, `section`, `slideNumber`, `slideNumberFormat`.
The `{current}`/`{total}` syntax goes with them. `logo`, `image`, `text`,
`date`, `dateFormat` and `socials` stay. A zone with several values writes them
in one `text`, in the order the author wants; a line break is `\n`.

Migration of an existing zone, used by the core examples and the gallery
records (one script, kept outside the repositories, shared by both PRs):

| 0.16 | 0.17 `text` |
| --- | --- |
| `organization: true` | `{{organization.name}}` |
| `speaker: true` | `{{speaker.name}}, {{speaker.title}}` when the deck's first speaker has a title, else `{{speaker.name}}` |
| `section: true` | `{{slide.section}}` |
| `slideNumber: true` (+ `slideNumberFormat`) | the format with `{current}` → `{{slide.number}}`, `{total}` → `{{deck.slideCount}}`; default `{{slide.number}}` |
| several of the above plus `text` | joined with `\n` in the 0.16 stack order (text, organization, speaker, section, slide number) |

## Resolution

1. `resolveVariables` (the deck-wide pass) resolves user variables and the
   deck-wide built-ins and **leaves the three slide-scoped tokens as written**,
   including after a complete pass (they are not "unknown"). An escaped
   `\{{slide.number}}` still draws as the literal text `{{slide.number}}`: the
   deck-wide pass keeps the escape in front of a slide-scoped token, and the
   per-slide pass turns it into the literal token.
2. Core exports `resolveSlideVariables(slide, { slideNumber, slideCount })`. It
   returns a copy of the slide with the three tokens substituted in every string,
   with the same walk and exclusions as `resolveVariables` (code blocks follow
   the same rule as user tokens). `slide.section` reads the slide's own `section`.
   The slide's own `design.header` and `design.footer` are left to
   `layoutFurniture` (item 5), so a slide-local footer keeps its native field.
3. Engines (opf-render, opf-pptx, the editor preview) compose and draw the
   substituted slide of each output slide after pagination. Implementation
   decision (vetoable): `resolveSlideContext(deck, index, { slideNumber, slideCount })`
   returns it as `context.slide`, substituted for the same `slideNumber` and
   `slideCount` it puts in `context.options`, so an engine writes
   `composeSlide(context.slide, context.options)` and draws `context.slide`. An
   engine that builds its own options calls `resolveSlideVariables` per output
   slide with the numbers it gives `composeSlide`. Text is therefore measured
   with the real value.
4. `paginate` measures with substituted values but returns slides with the
   tokens kept, so `opf paginate` output stays a source document. Its slide-count
   fixed point (today triggered by `{total}`) runs when `{{deck.slideCount}}`
   appears anywhere in the deck.
5. `layoutFurniture` substitutes the three tokens in each zone's `text` for the
   slide it lays out. Every `{{slide.number}}` adds a `slideNumber` entry to
   `FurnitureTextPart.fields` (the offsets PPTX already uses for native fields).
   `FurniturePartBase.field` narrows to `text | image | logo | socials | date`.

## Engines

- **opf-render**: draws furniture from the narrowed parts; calls
  `resolveSlideVariables` per output slide.
- **opf-pptx export**: a `{{slide.number}}` in header or footer text is the
  native slide-number field (`a:fld type="slidenum"`) when its line fits, exactly
  as `slideNumber: true` is today; `{{deck.slideCount}}` is fixed text (PowerPoint
  has no slide-count field). In body text, every slide token is fixed text.
- **opf-pptx import**: a native slide-number field in a footer or header
  becomes `{{slide.number}}` in that zone's `text`. Furniture provenance stores
  the authored zone `text` with its tokens, so an OPF-written file re-imports to
  the exact tokens; restored keys follow the `OPF_DOCUMENT_V1.absent` defaults
  rule (opf-pptx#211).
- **opf-editor**: the header and footer controls become a text input per zone
  with an "Insert value" menu (Slide number, Slide count, Section, Organization,
  Speaker, Deck name) plus the existing logo, image, date and socials controls.
  The template panel lists the slide-scoped built-ins as "varies per slide".
- **pptx-gallery**: `data/headers-footers.json`, the OPF snippets, reference
  data and the playground move to the new form; core re-syncs from gallery main.
- **openpresentation-site**: playground and get-started snippets, after 0.17.0
  is published.

## Acceptance

- Schema: `HeaderFooterItem` has no `organization`, `speaker`, `section`,
  `slideNumber`, `slideNumberFormat`; a deck that uses one is invalid.
- `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` resolve in
  furniture and body text in the preview and the PPTX export with the same
  values, after pagination; a paginated slide shows consecutive numbers.
- PPTX: furniture `{{slide.number}}` is a native field (PowerPoint updates it
  when slides move); body tokens are fixed text; OPF → PPTX → OPF returns the
  same tokens; a third-party PPTX with a native slide-number footer imports as
  `{{slide.number}}`.
- Validation: unknown `slide.*` is an error; `slide.section` on a slide without
  a section warns at that slide; `variable-unfilled` and the deck-wide pass never
  report the slide-scoped tokens.
- Docs true: templates-and-variables (built-ins table, decision 15 replaced),
  dynamic-composition, schema descriptions, format card, skills, quickstart.
- Example decks and gallery records migrated; golden regenerated only where
  pixels move, with reviewed diffs.
- Native PowerPoint check (root, Windows): a migrated deck opens without repair,
  the footer slide number is a field and renumbers after a slide move.
