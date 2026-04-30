# Collapsing the OPF layout taxonomy

Plan for collapsing the 400 layout records in [`spec/layouts/`](../../spec/layouts/) to roughly 23 canonical layouts and removing the old master-derived records from the public catalog. Visual variations (`-left`, `-box`, `-slideimage`, `-vertical`, etc.) become design overrides rather than separate layout records.

This plan is the long-deferred follow-on to [`layout-placeholders.md`](layout-placeholders.md) (open question §4.4 / Phase 5 there). The placeholder plan should land first as scaffolding; this plan reuses its `placeholders` field and binding rules unchanged.

## Executive summary — key decisions

1. **Public layout vocabulary collapses from 400 → ~23.** Authors set `Slide.layout` to a canonical id like `title-subtitle`, `text-2x`, `chart-3x`, `image-bleed`, `blank`. The placeholder contract a layout exposes is owned entirely by these canonical records.

2. **The current 400 records are removed from the public catalog.** Existing OPF documents that reference old ids should migrate to canonical layout ids plus `Slide.designOverrides`. The catalog no longer carries deprecated aliases.

3. **Three structural axes survive in canonical layout names** — content kind, multiplicity, and title presence. Everything else is a design override.

4. **Eight new design properties** absorb the squashed axes: `titleAlignment`, `contentAlignment`, `contentBox`, `slideImage`, `contentDirection`, `chartPrimary`, `imageFill`, `listBullet`. They live on `Design` so they cascade through `Theme` → `Design` → `Slide.designOverrides`.

5. **Two layout categories** — content layouts (always have an optional `title` slot) and canvas layouts (`image-bleed`, `blank`) with minimal placeholders. Two cover layouts straddle the line as content layouts intentionally trimmed to title + subtitle.

6. **Backwards compatibility is not preserved in the layout catalog.** The schema is still draft, so we prefer a clean public vocabulary over carrying deprecated ids. If legacy documents exist, migrate them explicitly.

7. **OOXML rendering may still use the 400-layout source deck internally.** The public catalog does not expose those ids, but the renderer can still use the source `.pptx` as an implementation detail when it maps a canonical layout + overrides to a concrete PowerPoint template.

8. **Phased rollout is now direct.** Generate the canonical catalog, remove the old records, then migrate any example documents or tests that referenced the old ids.

---

## 1. The orthogonal axes baked into the current 400 names

Pulling the current names apart, every record encodes some combination of the following axes. Only the first three actually change the placeholder contract; the rest are visual style.

### 1.1 Structural axes (these affect `placeholders`)

- **Content kind** — `title`, `text`, `list`, `number`, `chart`, `image`, `image-only`. Determines what kinds of placeholders appear.
- **Multiplicity** — `1x` … `6x`. How many parallel content / chart / picture / list-item / number-block placeholders.
- **Title presence** — driven by `slide_title=true` on the extract row. Determines whether the layout exposes a `title` slot.

### 1.2 Design axes (these are visual style; live on `Design` going forward)

- **Title alignment** — `-left` / `-center` (and implicitly `-right` later).
- **Content alignment** — `-left` / `-center` on content blocks.
- **Content box** — `-box`. Whether content sits inside a visible card.
- **Slide image overlay** — `-slideimage` plus optional `-top` / `-bottom` / `-left` / `-right` (default = background full-bleed).
- **Layout direction** — `-vertical` (default = horizontal).
- **Chart-primary position** — `-left` / `-right` / `-top` / `-bottom` on chart layouts: where the dominant chart sits relative to supporting content.
- **Image fill** — `-crop` / `-fit` on image layouts.
- **List bullet style** — `-itemimage` (default = character bullets).

### 1.3 Per-element shape, not layout shape

- **List heading** — currently `content_type_list_heading: boolean` on layout records. Whether each list item carries a heading is really a per-element choice (does a `TextContent` item have a heading line or not). Drops out of the layout schema entirely; lives on `TextContent` instead.

---

## 2. Proposed canonical layout list

23 records. (Plus 3 forward-looking. Plus 1 truly empty.)

### 2.1 Cover layouts

Cover layouts are intentionally minimal — designed for opening slides and section dividers. They are special only in that they expose **fewer** content placeholders than the content layouts.

- **`title`** — `[title]`. Single heading.
- **`title-subtitle`** — `[title, subtitle]`. Cover with supporting copy. Drives the `meta.title` / `meta.subtitle` defaulting promise from [`presentation.schema.json:49,62`](../../spec/presentation.schema.json) directly.

(If `slide_tag=true` is set on a record, both cover layouts also expose a `tag` placeholder above the title — same gating pattern from the placeholder plan §1.7.)

### 2.2 Content layouts

Content layouts always carry an implicit `title` slot at index 0. The slot is left empty when no element binds and `meta.title` is unset, so a content slide can be title-less without needing a separate layout. Naming pattern: `<kind>-<count>x`.

- **`text-1x`, `text-2x`, `text-3x`** — `[title, content × N]`. Free-form prose blocks.
- **`list-1x` … `list-6x`** — `[title, content × N]`. Bulleted/numbered lists. Whether items have headings is a per-element content choice.
- **`number-1x` … `number-6x`** — `[title, content × N]`. Stat / KPI blocks.
- **`chart-1x`, `chart-2x`, `chart-3x`** — `[title, chart × N, content × N]`. Each chart pairs with a `content` slot for caption / value annotation.
- **`image-1x`, `image-2x`, `image-3x`** — `[title, picture × N, content × N]`. Each picture pairs with a `content` slot for caption.
- **`table-1x`** *(forward-looking)* — `[title, table, content]`.
- **`code-1x`** *(forward-looking)* — `[title, code, content]`.
- **`media-1x`** *(forward-looking)* — `[title, media, content]`.

### 2.3 Canvas layouts

Authors place most elements manually via `Element.position` / `Element.size`. Chrome suppression is a renderer/design convention for these canonical ids, not a field on the layout record.

- **`image-bleed`** — `[picture]`. One full-canvas image, plus author-positioned overlays.
- **`blank`** — `[]`. No placeholders at all.

### 2.4 Placeholder-list summary

Every canonical layout fits one of three patterns:

| Pattern | Layouts | Placeholders |
| --- | --- | --- |
| Cover | `title`, `title-subtitle` | `[title]`, `[title, subtitle]` |
| Content (kind = `K`, count = `N`) | `text-Nx`, `list-Nx`, `number-Nx`, `chart-Nx`, `image-Nx`, `table-1x`, `code-1x`, `media-1x` | `[title, ...K-typed × N, ...content × M]` where M depends on kind |
| Canvas | `image-bleed`, `blank` | `[picture]`, `[]` |

---

## 3. Design properties that absorb the squashed axes

Add eight properties to `Design` (and by inheritance to `Theme` and `Slide.designOverrides`). All optional; engine and theme provide sensible defaults.

| Property | Type | Default | Replaces | Notes |
| --- | --- | --- | --- | --- |
| `titleAlignment` | `"left"` \| `"center"` \| `"right"` | engine | `-left` / `-center` (title) | Horizontal alignment of the title placeholder. |
| `contentAlignment` | `"left"` \| `"center"` \| `"right"` | engine | `-left` / `-center` (content) | Horizontal alignment of content placeholders. |
| `contentBox` | `boolean` | `false` | `-box` | Render content inside a visible card / surface. |
| `slideImage` | `AssetSource` \| `{ src, position }` | none | `-slideimage[-...]` | Full-bleed or positioned slide-level image overlay. `position` ∈ `"background"` (default) / `"top"` / `"bottom"` / `"left"` / `"right"`. |
| `contentDirection` | `"horizontal"` \| `"vertical"` | `"horizontal"` | `-vertical` | Axis along which parallel content blocks are arranged. |
| `chartPrimary` | `"none"` \| `"top"` \| `"bottom"` \| `"left"` \| `"right"` | `"none"` | chart `-left` / `-right` / `-top` / `-bottom` | Position of the primary chart on chart layouts; `"none"` = equal weight. |
| `imageFill` | `"crop"` \| `"fit"` | `"crop"` | image `-crop` / `-fit` | How `picture` placeholders fill their box. Already analogous to `Element.fit` on image elements. |
| `listBullet` | `"character"` \| `"image"` | `"character"` | `-itemimage` | Bullet rendering style on `list-Nx` layouts. |

These compose through the existing cascade ([`presentation.schema.json:1188-1191`](../../spec/presentation.schema.json) — `Slide.designOverrides` is already a `Design` object).

---

## 4. Migration stance — remove old ids

The 400 old master-derived records are removed from [`spec/layouts/`](../../spec/layouts/). The public catalog only exposes canonical ids. This deliberately breaks references to old ids such as `title-left-slideimage` because the schema/catalog is still draft and the cleaner vocabulary is more valuable than preserving early generated records.

Migration rule for old documents:

```text
old Slide.layout              -> new Slide.layout + Slide.designOverrides
title-left                    -> title + { titleAlignment: "left" }
title-left-slideimage         -> title-subtitle + { titleAlignment: "left", slideImage: { position: "background" } }
chart-3x-bottom-vertical-...  -> chart-3x + { chartPrimary: "bottom", contentDirection: "vertical", ... }
image-only-3x-crop            -> image-bleed + { imageFill: "crop" }
```

The renderer may still consult the 400-layout source `.pptx` internally when it needs a concrete master template, but that mapping is not part of the OPF catalog contract.

---

## 5. Three concrete before-and-afters

Same intended slide expressed with the old id vs the canonical layout + overrides that replaces it.

```jsonc
// Old layout id                                    // New canonical layout + overrides
{ "layout": "title-left" }                          { "layout": "title",
                                                      "designOverrides": { "titleAlignment": "left" } }

{ "layout": "title-left-slideimage" }               { "layout": "title-subtitle",
                                                      "designOverrides": {
                                                        "titleAlignment": "left",
                                                        "slideImage": { "src": "asset:cover-bg",
                                                                        "position": "background" } } }

{ "layout":                                         { "layout": "chart-3x",
  "chart-3x-bottom-vertical-title-left-slideimage"}   "designOverrides": {
                                                        "titleAlignment": "left",
                                                        "chartPrimary": "bottom",
                                                        "contentDirection": "vertical",
                                                        "slideImage": { "src": "...",
                                                                        "position": "background" } } }
```

The third example is the kind of unwieldy long-name layout the new model erases.

---

## 6. Migration script (canonical-only regeneration)

Sits next to the placeholder plan's `scripts/regenerate-layouts.mjs` (or extends it). Specification only — implementation in Phase 2.

### 6.1 Inputs / outputs

- **Inputs:**
  - `spec/layouts/extract/canonical.json` — declares the canonical layouts and their placeholder lists. Hand-curated and small.
- **Outputs:**
  - Canonical files in `spec/layouts/<canonical-id>.json`.
  - `spec/layouts/index.json` regenerated.
  - No deprecated aliases.

### 6.2 Algorithm (pseudocode)

```text
load canonical[] from extract/canonical.json
load layouts[]  from extract/layout.json

# 1. Emit canonical records.
for each C in canonical:
  write spec/layouts/<C.id>.json with:
    { $schema, id, name, placeholders }
```

### 6.3 What needs human review

- `extract/canonical.json` is the only hand-curated input — write it once, review carefully.
- Any document migration from old ids to canonical ids happens outside the catalog regeneration script.

---

## 7. Risks / open questions

1. **Master-deck rendering doesn't have to collapse immediately.** The 400 master templates in the underlying `.pptx` file still represent 400 distinct visual realizations. The engine can resolve a `(canonical, overrides)` tuple to one of those templates internally, or it can compose the visual at runtime. This plan only collapses the *public author-facing vocabulary*. If the underlying `.pptx` ever gets rebuilt with a smaller master deck (say 23), this plan still holds — the engine just has fewer templates to choose from.

2. **Tuple → master mapping isn't bijective.** Some `(canonical, overrides)` tuples may not correspond to any of the 400 master templates (e.g. `text-2x` with `chartPrimary: "left"` makes no sense). The engine's resolver needs a fallback: if no master fits, render best-effort with the closest match and log a warning. Defining this fallback is out of scope here; it's a renderer concern.

3. **Canonical records are intentionally sparse.** They don't carry every old extract-derived attribute (`contentType`, `contentMultiple`, etc.). The schema keeps those fields optional while the catalog moves to semantic records.

4. **`Theme` vs `Slide.designOverrides` defaults for the new properties.** The existing themes (`minimal`, `classic`, `dark`, `bold` in `spec/themes/`) don't declare any of the eight new properties. They'll default to engine defaults until themes opt into them. That's fine — themes can pick up the properties in a follow-on pass.

5. **Picker UX gets simpler.** Pickers should show only canonical layouts. Style variations become controls backed by `Slide.designOverrides`, not separate layout cards.

6. **Naming bikeshed.** `text-2x` vs `text-2-column` vs `two-text` — pick a convention. Recommendation: stick with the existing `<kind>-<count>x` since it matches the old extract data and reads cleanly. `image-bleed` and `blank` are special-case names that don't fit the multiplicity pattern; that's fine.

7. **`tag` placeholder on cover layouts.** Decision: include `tag` only when `slide_tag=true` (gated, like `subtitle`). Today no records have `slide_tag` set, so canonical `title` and `title-subtitle` start without tag slots and grow them when data lands.

8. **Where does `meta.subtitle` defaulting happen?** Same as the placeholder plan §2.6: engine fills any unbound `subtitle` placeholder from `meta.subtitle`. Under the canonical model, that means `title-subtitle` slides default both lines from `meta` when authors don't override.

---

## 8. Phased rollout

The rollout is direct because the layout catalog is still draft.

### Phase 0 — Land the placeholder plan first

[`layout-placeholders.md`](layout-placeholders.md) is the prerequisite. The canonical layouts in this plan reuse its `placeholders` field and binding rules verbatim. Don't start this plan until that one has shipped.

### Phase 1 — Add canonical layouts

- Hand-curate `spec/layouts/extract/canonical.json` with the 23 records from §2.
- Add the eight new design properties from §3 to [`spec/presentation.schema.json`](../../spec/presentation.schema.json) `Design` `$def`. All optional; no existing document breaks.
- Generate the canonical `spec/layouts/<id>.json` files and remove the 400 old records.
- Engine: implement resolution of canonical layouts.
- TS-type regen via `node packages/javascript/scripts/generate.mjs`.

### Phase 2 — Update authoring and examples

- AI-authoring tooling switches to canonical ids only.
- Any examples or tests that referenced old ids are rewritten to canonical ids plus `Slide.designOverrides`.
- Picker UX exposes canonical layouts and style controls, not legacy variants.

### Phase 3 — Theme integration (optional, follow-on)

- Update existing themes (`minimal`, `classic`, `dark`, `bold`) to declare sensible defaults for the eight new design properties.
- Engine layers theme defaults under deck-level `Design` under `Slide.designOverrides`.

### Phase 4 — Document migration helper (optional)

If old OPF documents exist, provide a tool that rewrites `Slide.layout` references from old ids to canonical ids + overrides.
