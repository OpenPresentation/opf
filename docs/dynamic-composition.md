# Dynamic composition

OPF keeps authoring intent in JSON. Use `blocks` when content can reflow; use promoted regions when relative placement is meaningful. `composition` on a slide overrides fields in the resolved layout's `composition`. Existing documents remain valid.

The current published Node 24 train is core 0.14.0, renderer 0.14.0, PPTX 0.14.0, editor 0.14.2 and CLI 0.11.0. Use the exact pins in [release-plan.json](../release-plan.json); the [compatibility matrix](compatibility-matrix.md) separates package support from native Office and font gates. Older version references below identify when individual contracts were introduced.

```json
{
  "name": "Decision brief",
  "slides": [{
    "title": "Make the main idea clear",
    "composition": { "mode": "row", "weights": [2, 1], "overflow": "error" },
    "blocks": [
      { "text": "The evidence and recommendation receive twice the width." },
      { "text": "The supporting detail receives the remaining width." }
    ]
  }]
}
```

`auto` evaluates candidate grids using text fit and cell proportions. `columns` limits its candidates. `grid` uses `columns` if given, otherwise a grid based on the canvas shape. `row` uses one row; `column` uses one column. Items retain source order. Weights size columns except in column mode, where they size rows. Missing weights are 1; unused weights have no effect. A partially filled final row retains its grid tracks.

`gap` defaults to 1/30 and `padding` to 0.08, both fractions of the canvas's shorter edge. Large gaps are reduced when necessary to keep cells positive. `minFontSize` defaults to 16 reference pixels at a 720-pixel short edge. The reference coordinate system uses 96 pixels per inch. Explicit inch dimensions override presets independently for each axis.

Composed font sizes lie on PowerPoint's 0.01 pt grid (RR-16). PowerPoint stores a run size (`sz`) in hundredths of a point and a point is 4/3 reference pixels, so every size a fit accepts is a whole multiple of 1/75 px (`FONT_SIZE_GRID_PER_PX`), and the preview draws exactly the size the export writes. Fitting evaluates each trial size on the grid before breaking lines and placing text: trial sizes stay anchored to the unsnapped request (no drift) and round down (`snapFontSizeDown`), so a size that fit before snapping still fits; a readability floor rounds up (`snapFontSizeUp`), so `minFontSize` is never undercut; and a result that reports no overflow was measured at the size it carries. The rule covers plain, rich, list (marker, description and picture-bullet side), table, quote, code, metric, timeline, furniture and heading text, including each rich run and script. `wrapText` measures at exactly the size it is given.

Headings reserve space according to their wrapped text. Title and subtitle share the padded width of the free area, and a missing tag or subtitle leaves no gap.

Cover slides vertically center the combined tag/title/subtitle group in the free heading area. A cover is a slide with no body payload (no root content field including `image`, no `blocks` other than placed images, no promoted regions; empty payloads such as `blocks: []`, `text: ""`, empty lists and regions with nothing in them count as no body; whitespace-only text is still body) on a heading-only layout: layout id `title` or `title-subtitle`, or a layout whose placeholders are all headings, or a slide with no layout at all. The free area is the slide minus the bands of placed images, header and footer furniture, and the usual padding; a picture background reserves nothing. A wrapped heading makes the group taller and the group recenters. A group that already fills the free area is not moved. Accepted line and outline origins move with the boxes. Explicit heading `alignment` positions ink inside the box and never changes the vertical position. A flowed image is body, so image slides keep the top-aligned content origin; a placed image is not. Content slides are not affected: headings stay at the top and the body follows them. This is a reference-engine default, not a schema field.

Content that exceeds the number of preset placeholders reflows together; it is not drawn over already-bound content. Promoted regions keep the 3×3 vocabulary, including standalone `top`, `middle`, and `bottom`. They ignore flow direction and track weights. They are composed in visual reading order (rows from top to bottom, then along the row; `visualReadingOrder`), not in key order, so the composed item order, the preview's draw order, the PPTX shape order and the reading order of assistive technology agree. The order is computed from the logical region cells, so a right-to-left deck reads the same logical order.

Every shared `design` key resolves with one merge, per key: the slide's `design`, then the deck's `design`, then the slide's layout record `design`, then the engine default (`resolveDesignHints`; the result is `SlideComposition.design`). Two design hints shape the root arrangement. `design.contentDirection` (slide design, deck design, then the layout record's own) sets the root mode, `vertical` as `column` and `horizontal` as `row`, when neither the slide nor its layout record sets a `composition.mode`; it ranks with the layout record's `design.contentDirection`, above automatic selection, regions and nested groups are untouched, and the decision keeps `reason: 'configured-mode'`. `design.chartPrimary` (slide, deck, then the layout record's `design.chartPrimary`) applies when the slide sets no `composition.mode` of its own and the root nodes mix at least one chart with other content: the first chart becomes a primary track and the other nodes form one synthetic sub-grid arranged in `auto` mode, a two-track row for `left`/`right` or column for `top`/`bottom`, weighted 3:2 in favor of the chart, with explicit root `columns`/`weights` ignored; the synthetic container has no path and records no group, flow or decision, and the root decision reports `reason: 'chart-primary'`. On cover slides `geometry.logo` places the deck logo above the centered heading group. [Design resolution](design-resolution.md#brand-assets-and-layout-hints) states the precedence, the logo variant selection, picture bullets and the accent font, with the vetoable decisions.

## Shared headers and footers

Published core 0.11.0 exposes `layoutFurniture(slide, options)` and `geometry.furniture`, separate from body `items`. Composition identifies the available-space policy as `grid-score-v9`. Raw callers pass the presentation as `options.presentation`, resolved dimensions/fonts and the same measurement provider used by preview. `slideIndex` identifies source paths; optional `slideNumber` is the one-based displayed number.

The core resolver honors whole local header/footer overrides, including `false` and empty objects. Each zone retains its image and all configured text fields in source-aware parts. Literal text and dates preserve whitespace and empty strings. Organization and section values point to their metadata source; page numbers use the actual output sequence. A missing organization/section, or `date: true` without a host-supplied current date, produces `unresolved-content`; the implementation never consults a clock or invents source text.

Slide numbers and dates carry formats. `slideNumberFormat` is a template such as `"A-{current}"` or `"{current} / {total}"`: `{current}` is the displayed number and `{total}` is the displayed slide count (`options.slideCount`, else `presentation.slides.length`; whole-deck pagination iterates to the final page count). `dateFormat` is an LDML-style pattern (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `EEEE`, `EEE`, quoted literals) with fixed English month and weekday names. A string `date` with `dateFormat` must be an ISO `YYYY-MM-DD` date and renders as fixed, generated text tied to that source value; without `dateFormat` a date string stays literal and editable. `date: true` is the current date: hosts pass today's ISO date as `options.date` (composition, pagination, renderer and exporter), and the default pattern is `M/d/yyyy`. Text parts expose `fields` (half-open UTF-16 ranges of each `{current}` number and of a whole current date), so exporters can write native live fields while `{total}` and fixed dates stay fixed text. `formatFurnitureDate()` and `formatSlideNumber()` are exported for hosts. All configured fields in one zone stack, in the order logo, image, text, organization, socials, section, slide number, date (`logo: true` is the deck's icon logo as a generated image part; see [design resolution](design-resolution.md#brand-assets-and-layout-hints)); put a date and a slide number in different zones to keep one line each. Hiding furniture on a title slide is the slide-level `design.header: false` / `design.footer: false` override.

`speaker: true` generates one `speaker` part from the first speaker: `"Ada Lovelace, CTO"`, or the name alone when there is no title. Its `sourcePath` is `speaker.name` (a single speaker) or `speaker.0.name`. A deck with no named speaker produces `unresolved-content`. In a zone it stacks after `organization` and before `socials`: logo, image, text, organization, speaker, socials, section, slide number, date. PPTX export writes it as static text and import restores the flag from furniture provenance.

`socials: true` (core 0.11.1 and later) generates one `socials` part from the primary organization's `organization.socials`. The part has one source line per platform, in key order, and a parallel `links` array (`platform`, `text`, `href`, `resolved`, `sourcePath`). `resolveSocialProfile(platform, value, records, owner)` formats each value without network access. A handle loses its `handlePrefix` and is substituted into `companyUrlPattern`, then `profileUrlPattern`, then `baseUrl/{handle}`; the result is shown as that URL without `https://`. A URL value passes through unchanged except that `https://` is dropped from the display. With no matching record, the value is shown raw with no link, which is the Socials engine fallback. Records come from inline `catalogs.socialPlatforms.records` first and then from host-supplied `options.socialPlatforms`. Composition never loads the bundled catalog itself; `resolveSlideContext` (which `paginate`, opf-render and opf-pptx use) passes it. A missing organization, or one with no non-empty socials, produces `unresolved-content`. Speaker socials, platform icons, brand colors and slide-size presets are not rendered.

`furniture-flow-v2` gives each left/center/right zone 26% of the canvas width. Parts stack within a zone; the tallest zone sets the natural band height. Text uses at least the selected readability floor, with complete accepted source lines and optional measured outline placement. Header and footer bands reserve room before heading and body allocation. Irreducible text, conflicting bands or a heading displaced beyond the remaining space produce diagnostics; strict composition rejects them. An image or `logo: true` part (`type: 'image'`) aligns like the zone's text: its `box` is as wide as the image's own proportions make it at the band height (a 36 px band at 1280 px wide), at most the zone, flush with the zone's left edge in the left zone, centered in the center zone and flush with its right edge in the right zone, at the same vertical position as before; consumers fit the image inside `box`. Core reads the proportions without fetching, from an embedded PNG, JPEG, GIF, WebP or SVG data URI or an `asset:` reference to one, decoding only a bounded prefix of the payload (64 KiB, 1 MiB for a JPEG whose frame header sits behind large metadata) and memoizing per source, so a multi-megabyte logo costs nothing per slide; a JPEG whose header is past 1 MiB, an SVG whose root tag is past 64 KiB, a path or a URL is unreadable is placed in a square box (vetoable), so a wide image behind a path or URL is drawn small and flush to its zone edge until it is embedded. No-furniture body geometry remains unchanged.

Pagination repeats these fields without putting them among body slices. An optional `page.repeatedMappings` records repeated heading/furniture and metadata paths while the existing `page.mappings` retains its body-fragment contract. Whole-deck pagination evaluates final output numbers, including preceding continuation pages, and rejects unresolved repeated content atomically. Renderer and editor reuse the accepted parts; literal text/date fields, including empty values, support direct canvas editing and undo. Generated labels remain tied to metadata.

Published PPTX (0.9.1 and later, current 0.13.2) draws the accepted editable text boxes and fitted images and records furniture provenance in tagged slide shapes. Reimport uses current native text and images; damaged or ambiguous provenance retains visible content with diagnostics. The [fresh installed-package evidence](evidence/shipped-train-20260921/installed/acceptance-summary.json) includes deterministic export, current-content reimport controls and offline canvas editing/undo. Native PowerPoint acceptance, font compatibility and full visual review remain separate gates; the published PPTX (through 0.11.7) is not native `p:hf` Header/Footer support. On [opf-pptx main](https://github.com/OpenPresentation/opf-pptx) (RR-11, unreleased) the first footer text, date and slide number that fit one accepted line become real PowerPoint `ftr`, `dt` and `sldNum` placeholders at exactly this geometry, with master/layout placeholders and `p:hf` flags (see [native header and footer](https://github.com/OpenPresentation/opf-pptx/blob/main/docs/native-header-footer.md)); header parts, organization, section, socials, images and multi-line text stay tagged shapes because PowerPoint has no object for them. No core geometry or schema changed. Bounds/readability checks do not certify whole-slide design quality: long labels can wrap heavily in portrait zones, and outline agreement does not establish native font identity.

## Footnote areas and caption bands

RR-34 (core after 0.11.4) adds two reserved regions that exist only for decks that use the fields. A slide whose runs carry `cite` or `footnote` markers gets `geometry.footnotes` (`footnote-area-v1`): a rule and the slide's notes in number order, directly above the footer band (or the bottom padding) with the content area's left edge and width, in the body family at the furniture size; the content area shrinks by exactly the area's height plus half the slide gap, and nothing above it moves. The area takes at most 35% of the span between the heading top and the footer band; a note that does not fit reports `text-overflow` at its source path (`references.N` or the run's path), which pagination treats like any other fit overflow. `slideCitations(slide, slideIndex, presentation)` is the numbering `composeSlide` uses; pass the same `presentation` and `slideIndex` to every consumer. An `image`, `chart`, `table` or `video` payload with a `caption` reserves a caption band inside its region (`item.caption`; `item.box` becomes the media box), below or above the media, at most 35% of the region; automatic grid selection scores the leaf on its media box. See [footnotes, citations and captions](footnotes-citations-captions.md).

## Backgrounds and placed images

Core 0.15 composes pictures in two ways (FA-22); [images](image-treatments.md) has the full vocabulary.

- A picture background (the slide's `design.background`, then the deck's, then the theme's, when it is `{ type: "image", ... }` or an image-source string) is `geometry.backgroundImage`: the whole canvas as its frame, `fit` (`cover`, `contain`, `stretch`, `tile`), `focus`, `opacity`, `recolor` and the overlay box (whole picture or an edge band). It never moves content. `resolveSlideContext` passes the theme's background as `ComposeSlideOptions.themeBackground`.
- Every image item carries `item.image`: the frame inside its region, `fit` (the block's own, else the effective `design.imageFit`, else `cover`), `focus`, the mask with its DrawingML preset and SVG outline, line, opacity, recolor and overlay. `fitImage(frame, fit, aspect, focus)` is the shared fit math; core fills `item.image.picture` itself when it can read the picture's proportions (a data URI, or an `asset:` reference to one).

A top-level image block with `placement: { edge, size, inset }`, or the slide's n-th top-level image when the layout's n-th image placeholder carries a placement, takes a band along that slide edge: `size` of the slide width (left, right) or height (top, bottom), default 0.5, edge to edge, or inside the slide padding with `inset`. Headings, footnotes and the body compose in the free area that remains, with the usual padding; header and footer bands keep their full-width placement. Bands are taken in block order and each spans the free area the earlier ones left; a second block on a used edge flows as content (the validator reports it). Placed items are listed after the headings and before the flowed body, and their placeholder slot is not reserved in the flow. A slide whose only body is placed images is composed like a cover. A right-to-left deck mirrors `left` and `right`.
## Nested groups

### Shared content cards

Shared content cards are published in core 0.10.0 and later, including current core 0.14.0. For `design.contentBox: true`, each body leaf carries a `frameBox` at its outer allocation and a `box` padded inward by 12 reference pixels at a 720-pixel short edge, capped at one quarter of the frame's width or height. Scoring, accepted payload measurement, strict overflow and pagination all use that rounded interior. Headings remain unframed, nested groups keep their original padding, and explicit outer regions/track weights remain authoritative. Automatic candidates may change because their available content space changes.

Every composed item carries its resolved horizontal text `alignment` (`left`, `center` or `right`). The title uses `titleAlignment`; every other item, including subtitle, tag, body text, lists, tables and metrics, uses `contentAlignment`. The value is the effective `design` key: the slide's design, then the deck's design (or the host option), then the layout record's `design`, then `left`, so a layout that sets `contentAlignment: center` centers its content with no deck or slide value. The title never inherits `contentAlignment`. A cover (a slide with no body payload on a heading-only layout) has no content region, so its tag and subtitle join the title's alignment: they follow `titleAlignment`, and only a `contentAlignment` set on the slide's own design keeps them apart (a deck or layout value does not). Accepted outline placement and metric internals use the same value. The renderer and the PPTX exporter anchor preview and native text to `item.alignment`, so both engines place a layout's text the same way.

Raw composition callers pass their resolved deck flag as `composeSlide(slide, {contentBox: effectiveDesign.contentBox, ...options})`; a slide's explicit `design.contentBox: false` overrides it. Coordinated renderer, editor and whole-presentation pagination resolve this option for their callers. Consumers draw at `frameBox` and use the accepted `box` and payload internals without another inset. Core 0.9.0 predates this behavior. Content cards do not make the incomplete chart/timeline density models complete or certify native raster fidelity.

A block or promoted region can contain its own `blocks` and `composition`. The optional discriminator is `"type": "group"`. A group has at least one child and cannot mix children with leaf fields such as `text` or `image`.

```json
{
  "composition": { "mode": "row", "weights": [2, 1] },
  "blocks": [
    {
      "composition": { "mode": "column", "padding": 0.02 },
      "blocks": [{ "text": "Recommendation" }, { "text": "Supporting evidence" }]
    },
    { "text": "Context" }
  ]
}
```

The parent allocates a box to each group, then the group arranges its children inside that box. Group padding defaults to zero; padding and gap use the group's shorter edge. Only `minFontSize` and `overflow` inherit. A strict ancestor cannot be weakened by a child's `overflow: "warn"`. Font sizes remain relative to the canvas, not the group. Groups can nest up to 32 levels; cycles and deeper nesting fail with an explicit error.

Automatic grid scoring inspects descendant text using each descendant's explicit arrangement or geometric automatic seed. After selecting the parent's grid, it optimizes each child's automatic grid. This deterministic, bounded search avoids exponential combinations; it does not claim a globally optimal packing.

`result.items` contains every leaf with its full source path and effective composition. `result.groups` contains group paths, outer bounds, and content bounds. The editor's `setGroupComposition(path, value)` validates and records undo/redo just like slide composition edits.

## Inspecting and repairing layout

```js
import { composeSlide } from '@openpresentation/opf/composition';
const result = composeSlide(deck.slides[0], { width: 1280, height: 720, layout: resolvedLayout });
console.log(result.items);       // Source paths, content, geometry, and text estimates
console.log(result.diagnostics); // Path-specific text-overflow and small-cell messages
```

This pure function expects a validated slide. The caller resolves catalog records and passes the canvas size, `fontFamilies` and `textMeasurement`; `resolveSlideContext(deck, index, { fonts })` from the package root does the catalog resolution for one slide of a deck and returns those options. The rendering and export packages perform those steps at their boundaries. No network, DOM, system font, or AI dependency is required.

### Explain automatic selection (core 0.8.0 and later)

Pass `explain: true` to return `result.explanation`. This opt-in API requires core 0.8.0; it is absent from core 0.7.0. Enabling explanations adds no measurement calls and does not change geometry, source content, reading order, weights or selected arrangements within the same engine version.

```js
const result = composeSlide(slide, {...resolvedOptions, explain: true});
for (const decision of result.explanation.decisions) {
  console.log(decision.path, decision.reason, decision.selectedColumns);
  console.table(decision.candidates);
}
console.log(result.explanation.textMeasurement);
console.log(result.explanation.unmeasuredPayloads);
```

`resolvedOptions` supplies the same dimensions, layout, fonts and optional width provider as the preview. Core 0.8.0 identifies its explanation as `grid-score-v2`; core 0.9.0 advances to `grid-score-v3` to include complete code metadata/body measurements. Current core 0.14.0 reports `grid-score-v9`. These versions record containers in parent-before-child order. `lowest-score` reports the candidates actually tried; `configured-mode` respects resolved row/column/grid intent and returns no invented candidates. `promoted-regions` leaves region placement fixed and has no selected column count. Empty slides have no decisions. Automatic search tries one through `min(slotCount, columns ?? 6)` columns, in ascending order; ties retain the first candidate. Reserved placeholders count as slots. The schema caps an explicit candidate limit at twelve columns.

Each candidate has `columns`, `rows`, `score` and additive `penalties`:

| Penalty | Rule |
| --- | --- |
| `cellProportions` | Sum of `abs(log(cellAspect / 1.6))` for descendant leaves |
| `fontReduction` | Reduction from 25 reference pixels for text-like leaves; current quote/code/metric/timeline layouts sum requested-minus-fitted sizes across their parts, divided by canvas scale |
| `textOverflow` | 1,000 per overflowing text-like leaf or complete quote/code/metric/timeline payload, regardless of the number of internal failure reasons |
| `tableOverflow` | 1,000 per table whose shared cell layout overflows |
| `smallCells` | 100 per leaf narrower than 100 or shorter than 60 reference pixels |
| `emptySlots` | 2 per unused position in the candidate grid's final row |

Scores are preference costs, not quality percentages or guarantees. Floating-point summation can make the component total differ slightly from `score`. Parent scoring uses descendant explicit arrangements or geometric automatic seeds; child automatic grids are optimized only after selecting the parent. Candidate scores therefore describe the bounded search, not a full assessment of the final optimized subtree. Heading fit remains in ordinary diagnostics, outside body-grid scoring. A strict-fit rejection exposes the explanation on `OPFCompositionError` when requested.

`textMeasurement` is `estimated` without a provider and `provided` with one. A provided width function does not establish font provenance, glyph coverage, shaping or native raster fidelity. Text, rich text, lists, quotes, table cells and code in core 0.9 participate in the fit model. Current core 0.11.0 also measures metric and timeline parts; its `unmeasuredPayloads` identifies images, video and charts whose complete internal layout is not assessed. Core 0.8 reports code as incomplete; core 0.9 measures its filename/language/body and insets. Media aspect ratios, chart labels and complete timeline visual density still require inspection. A zero score or empty diagnostics is not proof that those payloads fit.

Explanations expose the search for inspection and do not silently paginate or rewrite a document. Published editor 0.8.0 provides guarded track resizing, block moves, creation/removal and explicit pagination with preview/undo. A general automatic repair loop, automatic weight allocation, complete payload-internal measurement, CLI explanations and a canvas **Auto arrange** preview/undo operation remain open work; the **Arrange** controls below are explicit human adjustments.

With `overflow: "warn"` (default), the result retains all text and returns diagnostics. SVG emits all lines and marks overflowing groups with `data-opf-overflow="true"`; text may extend beyond its box or canvas. Consumers can collect diagnostics using `onDiagnostic`. With `overflow: "error"`, the layout rejects content that does not fit. Shorten the affected content, give it more space, or explicitly split it into another slide. Use the explicit pagination transform below to produce additional editable slides.

The editor exposes `editor.composeSlide(index)` and `editor.setComposition(index, value)`. The latter validates the change, records JSON Patch history, and supports undo/redo.

## Pagination

```js
import { paginateSlide, paginate } from '@openpresentation/opf/pagination';
const { presentation, pages } = paginate(deck);
// Review, save, render, or export `presentation`; pages maps output fragments to source paths.
const single = paginateSlide(deck.slides[0], { width: 1280, height: 720, minFontSize: 24 });
```

Pagination is an authoring operation. It produces ordinary OPF slides; previews and PPTX export consume those exact pages. It preserves the input, body order, nested groups, promoted regions, rich-text formatting, and source text characters. Plain text and rich runs split at grapheme boundaries, preferring sentence/paragraph breaks and then word breaks. Lists split between items, tables between rows with column labels repeated, and code splits without rewriting its source. Indivisible payloads remain intact. Existing track weights continue to apply to positions on each resulting page.

The default readability target is 24 reference pixels. Core 0.8.0 returns slides that persist that floor in `composition.minFontSize`, including an already-fitting one-page result; existing higher minima and strict overflow policies remain intact. Quotes can raise their nominal body/footer sizes to the floor. Current core 0.11.0 enforces the selected floor in shared plain/rich/list/table fitting, including painted rich fragments, while retaining authored style metadata. Unsupported fits report overflow rather than silently capping output below the floor. The [readability-floor checkpoint](plans/readability-floor.md) records the earlier candidate and its bounded-search tradeoffs. Pagination relies on the shared engine's estimates; it is not a guarantee that every host font renders identically. Headings repeat unchanged, speaker notes remain on the first page, and continuation IDs avoid existing deck IDs. `pages[].mappings` records full source/output paths and half-open text or item ranges. Text offsets use UTF-16, so source strings can be reconstructed exactly. Quote bodies split at grapheme boundaries and repeat complete attribution/source fields on each page. An irreducible footer rejects the whole operation, including a quote with an empty body after earlier content.

If a heading, individual list item, table row, or other atomic payload cannot fit on an otherwise empty page, `OPFPaginationError` returns actionable diagnostics. There is no partial output. `maxSlides` defaults to 100, and a layout-evaluation limit bounds work on pathological input. Specialized chart and timeline internals still require visual inspection; their complete density models remain outstanding.

The editor's `editor.paginateSlide(index)` is one validated transaction with undo/redo. It returns `{change, pagination}`. Editor 0.5.0 commits a one-page readability-policy change too; repeating the operation after the policy is recorded returns `change: null`. The playground includes an overflowing draft and **Split overflow** action. The CLI writes a new file and refuses to overwrite an existing one:

```sh
opf paginate input.opf.json output.opf.json
```

## Right-to-left decks

When the presentation `language` is written right to left (Arabic, Hebrew, Syriac, Thaana and the other right-to-left scripts) or the host passes `direction: 'rtl'`, `composeSlide` mirrors the composition and reports each paragraph's direction; `SlideComposition.direction` is `'rtl'`. The first column and the `left` region are drawn at the right, banded slide images, cover logos and header/footer zones swap sides, lists put their markers at the right, tables run right to left, and `TextFit.directions` gives the direction of the paragraph each line belongs to. Alignment is logical: the authored `left` is the start edge, drawn at the right edge of a right-to-left paragraph (`physicalAlignment`). A left-to-right deck composes exactly as before. The rules and the PPTX mapping are in [Layout direction](programs/font-fidelity-everywhere/script-font-model.md#layout-direction-rr-05).

## Fidelity boundary

The shared engine provides identical body and heading geometry to SVG and editable PPTX export. Text measurements default to deterministic estimates. For actual font advances, use the shared provider described in [measured fonts](font-fidelity.md). Complex scripts, fallback fonts, PowerPoint text rendering, rich text, charts, tables, and images still need visual verification. Dynamic composition is not a guarantee of pixel-identical PowerPoint output. List density includes rich runs, descriptions and nesting via `fitList`, with the same hanging indents used in preview and export. Only text-like payloads currently receive content-density estimates; small-cell diagnostics also cover non-text content.

SVG embeds raster data URI images locally. Remote and file images require a host resolver that supplies a raster data URI; otherwise they appear as placeholders. `strictAssets` rejects unresolved images. The runtime never fetches them.

See [the complete example](../examples/technical/dynamic-composition.opf.json) and [local ecosystem verification](ecosystem-development.md).


## Preview polish shared by preview and export (RR-07)

Three accepted spec fields used to be drawn plain; core now owns the shared tables so the SVG preview and the PPTX export draw them identically. Consumers import them from `@openpresentation/opf`; none changes geometry, and an older core simply leaves the preview and the export plain, without a new diagnostic.

- **Code syntax colours.** `tokenizeCode(source, language)` returns sorted, non-overlapping token ranges (`keyword`, `string`, `number`, `comment`, `function`, `type`, `property`) over the exact `code.source`; `codeLineRuns(tokens, start, end, source?)` clips them to one accepted source line, so concatenating the runs returns the line unchanged (a tab is always its own plain run). The scanner is deterministic and dependency-free (no network, clock or locale). `code.language` resolves through aliases (`ts`, `tsx`, `py`, `sh`, `yml`, `c++`, `terraform`, and so on) to `javascript`, `typescript`, `python`, `rust`, `go`, `bash`, `json`, `yaml`, `toml`, `ini`, `html`/`xml`, `css`, `sql`, `java`, `csharp`, `kotlin`, `swift`, `ruby`, `php`, `c`/`cpp`, `hcl` and `dockerfile` (`resolveCodeLanguage`, `CODE_HIGHLIGHT_LANGUAGES`); any other language, a missing one, or source over 200,000 characters stays plain. `codeSyntaxPaletteForScheme(colorScheme)` gives one colour per kind from the deck theme (keyword = primary, string = accent, number = secondary; comment, function, type and property are fixed slate, blue, cyan and pink, rotated away from a theme colour they would collide with), each lightened until it is at least 4.5:1 on the #111827 code panel. The renderer nests coloured tspans inside each accepted segment tspan; PPTX writes the same colours as native runs in the same one-text-box-per-line shapes, so editing and import are unchanged. The language is not inferred from `code.filename`. `code.highlight` (1-based source lines and inclusive ranges) adds a band behind marked lines and dims the rest: `codeHighlightLines` resolves it against the source, `codeLineNumbers` numbers each displayed line (a wrapped line repeats its number), `codeHighlightBands` returns the runs of displayed lines to draw behind, and `codeHighlightColors(colorScheme)` gives the band and the marked/dimmed palettes, all at least 4.5:1 on what they sit on. The SVG band is one `rect` per run behind the line text; PPTX writes one native rectangle per run (`OPF code N highlight M`) after the panel and before the line text boxes, so the one-text-box-per-line shapes and the code provenance tags are unchanged.
- **Metric trend.** A `metric.trend` (`up`, `down`, `flat`) keeps its word as the visible, editable text and gains one arrow: `metricTrendMark(layout, {background})` derives the arrow from the accepted trend line (square, 0.72 of the font size, on the baseline, 0.3 of the font size from the word; after the word for left alignment, before it for centre and right, and omitted if it would leave the field). The arrow is the DrawingML `upArrow`, `downArrow` or `rightArrow` preset at default adjustments (`metricTrendPoints` is the outline the preview draws), coloured by the metric's `sentiment`: positive green, negative red, neutral a neutral colour, kept at 4.5:1 or more against the slide background (`metricTrendColor`); the delta and trend text take the same colour. `layoutMetric` passes `sentiment` through as `MetricLayout.sentiment` (omitted when the metric has none) and `metricTrendMark` reads it, so the arrow direction always follows `trend` and only the colour follows `sentiment`. Absent, the sentiment is the conventional reading of the trend (up positive, down negative, flat neutral), which is the colour drawn before `sentiment` existed. A `sentiment` without a `trend` draws no arrow and colours nothing. The arrow carries the alternative text "Trend: up" (`aria-label` in SVG, `descr` in PPTX); the word and the arrow carry the direction, the colour the verdict.
- **Pattern fills.** `PATTERN_PRESETS` lists the 54 ECMA-376 ST_PresetPatternVal names and `patternBitmap(preset)` / `patternRuns(preset)` give each as an 8 x 8 one-bit tile, one pixel per 1/96 inch, anchored at the slide's top-left, foreground where a bit is set (`diagStripe` still resolves to `wdUpDiag`). ECMA-376 names the presets but does not define their pixels: the tiles are measured from desktop PowerPoint (Office 365, Windows, 2026-10-01) by exporting each preset as a full-slide background to a 1280 x 720 PNG and voting every pixel into its (x mod 8, y mod 8) cell with opf-render `scripts/derive-pattern-bitmaps.mjs`. Every tile was uniform across all repeats (confidence 1.00) at one image pixel per pattern pixel, so a pattern pixel is one 1/96 inch unit, and the phase is the slide's top-left corner. The tool also reports any tile that later differs. PPTX already wrote every preset as native `a:pattFill`.

## Metric internals (published coordinated packages)

Published core 0.11.0 exports `layoutMetric(value, box, options)` from `@openpresentation/opf/composition` (the package root no longer exports engine names). It accepts a finite number, string, or `{value, unit?, label?, description?, delta?, trend?, sentiment?}`. Renderer 0.9.0, editor 0.8.0 and PPTX 0.9.1 consume its shared geometry for composition, atomic pagination, preview, editing and export. Core 0.9.0 predates this API. The [primitive checkpoint](plans/shared-metric-layout.md) and [source integration checkpoint](plans/shared-metric-integration.md) record its development; current pins and remaining native/font gates are in the [compatibility matrix](compatibility-matrix.md).

Pass the allocated reference-pixel `box`, resolved heading/body `fontFamilies`, `textMeasurement`, canvas `scale`, effective `minFontSize`, source `path` and optional `overflow: 'error'`. `metric-flow-v1` returns separate value/unit/label/description/delta/trend parts in that order. Numeric zero is visible; scalar values keep the scalar path. Every provided field retains its original string or number in `sources[].value`. Source ranges address `String(value)` using UTF-16 offsets; the original spelling of a numeric JSON token is not available. No locale formatting, trend icon, case conversion or separator is invented. Empty optional strings retain source mappings with `visible: false`; the required empty value keeps a targetable blank line.

The allocator tries an adjacent value/unit baseline when both fit one line and the unit uses at most 35% of the cell width; otherwise it stacks the fields. Metadata has an eight-reference-pixel gap, with twelve pixels after the primary row. Related fields stay together rather than being separated by a percentage of the cell height. The value starts at up to 76 reference pixels (28% of cell height); label/unit/delta start at 23, description at 20 and trend at 18. Every requested size is raised to the chosen floor, scaled once. Natural metadata height gets space before reducing type. At most 48 arrangements are evaluated, each with at most 77 value-size trials; identical inputs and a deterministic measurement provider select the fitting candidate with least summed font reduction, preferring the first candidate on ties.

Each part exposes requested/resolved styles and the same source-preserving line/segment representation used by code (`CodeTextFit`), measured with proportional heading/body fonts. CR/LF/CRLF, tabs, whitespace and grapheme boundaries remain exact. Consumers must reuse accepted line and segment positions, font sizes and styles rather than independently re-fit or normalize text. This API reports `provided` measurement when a provider is passed, without claiming that its glyph coverage or shaping is complete. Unsupported glyphs propagate the provider's error with the field path.

Pass `align: 'left' | 'center' | 'right'` (default left) to the primitive. Its returned `alignment` and per-part `linePositions` give an absolute x origin and baseline for each `fit.sourceLines` entry, including blank lines. An inline value/unit pair moves together, with the gap following the actual value advance. Composition accepts host-resolved `contentAlignment`; an explicit slide `design.contentAlignment` overrides it. Renderer/export/pagination pass the effective design into the same operation. Alignment does not trigger a second font fit.

Check `overflow` before consuming parts. Irreducible text, invalid available space, parts outside the cell and overlapping occupied line boxes return field-specific diagnostics; strict mode throws `OPFCompositionError`. Invalid available boxes retain their dimensions and have no fit. These are advance-based line rectangles, not glyph outlines: the controlled browser evidence separately records small glyph overhangs. The API is a bounded internal allocator, not the complete layout-repair/Auto arrange operation or a native export fidelity guarantee.

Current `grid-score-v9` retains the metric scoring introduced by `grid-score-v4`: every metric part contributes font reduction, with one overflow penalty per failing metric leaf. `item.metricLayout` is measured against the rounded accepted cell; `item.text`/`item.textStyle` alias the value fit/style. Field diagnostics obey strict ancestor policies, while explicit modes/weights/regions remain authoritative. Metrics are excluded from the advance-model `unmeasuredPayloads` list. Explicit pagination retains metrics atomically with complete source types/metadata and rejects irreducible fields without returning partial output. The published train has [installed-package acceptance](evidence/shipped-train-20260921/installed/acceptance-summary.json), including metric provenance controls. That evidence does not establish native raster or font equivalence.

## Code internals (core 0.9.0 and coordinated packages)

Core 0.9.0 introduced `layoutCode(value, box, options)` for the schema's string shorthand or `{source, language?, filename?}` object. It returns measured filename/language/body parts with exact original text, requested/resolved styles, readability floors, available boxes and diagnostics. Its original integration targeted renderer/PPTX 0.7.0 and editor 0.6.0; the [release checkpoint](plans/shared-code-release.md) records that rollout. These contracts are published in the current core 0.11.0, renderer 0.9.0, PPTX 0.9.1 and editor 0.8.0 train. Core 0.8.0 predates this API and retains the [recorded code-label, filename and whitespace defects](plans/layout-repair.md).

`grid-score-v3` charges code font reductions across all metadata/body parts and one overflow penalty per failing leaf. It preserves explicit modes, weights, regions and source order. Accepted `item.codeLayout` is fitted to the same rounded cell exposed as `item.box`; `item.text` and `item.textStyle` alias the body, not the first metadata part. Strict ancestor settings apply to internal `.source`, `.filename` and `.language` diagnostics. Code no longer appears in `explanation.unmeasuredPayloads`, which concerns the core advance-based model only. It does not mean browser/native fidelity is verified.

Pagination slices the code body at grapheme boundaries, repeats filename/language and returns contiguous UTF-16 body ranges while preserving all source bytes and the evaluated readability floor. Irreducible metadata rejects all output, including when the body is empty or earlier content could have fitted. Consumers must preview/export the returned document. The [integration checkpoint](plans/shared-code-integration.md) separates source, installed browser, Windows PowerPoint and remaining release gates.

Each fitted part retains every space and explicit CR/LF/CRLF break. `fit.lines` contains exact source slices, and `fit.sourceLines` records half-open UTF-16 `start`, `end` and `nextStart` offsets, the measured width and a `soft`, `hard` or `end` boundary. A hard break occupies `[end, nextStart)`; soft wrapping consumes no source character. Joining `part.text.slice(line.start, line.nextStart)` reconstructs the original part. Blank lines and a final empty line are retained, and long tokens split only at grapheme boundaries. Filename and language text are not case-converted. An absent/empty metadata pair creates a generated `code` label with no source range.

`code-flow-v1` uses 18-reference-pixel outer insets, an eight-pixel gap between filename and language, and a twelve-pixel gap before the body. Nominal metadata/body sizes are 14/18 reference pixels, raised when necessary to respect the selected minimum, then scaled once. At most four metadata nominal/floor combinations are tried; each body fit tries at most 19 sizes regardless of canvas scale. The fitting combination with least font reduction wins. Irreducible metadata/body failures retain all text and diagnostic paths; invalid available boxes have no fit. `overflow: 'error'` rejects rather than returning partial output.

Tabs remain literal characters in part text and displayed-line slices. Measurement advances to the next multiple of four measured spaces from that line's origin; `fit.tabSize` and `fit.tabWidth` expose the rule. Each source line's `segments` contains exact text/tab source ranges plus measured `x`/`width` values relative to its origin. Consumers must reuse those positions: an Edge probe showed that SVG treats a tab as one space despite CSS `tab-size: 4`. The published SVG renderer uses positioned spans and geometric precision; native export uses accepted tab stops. Width measurements and source preservation alone do not establish glyph-outline containment, shaping/bidi support or native fidelity. [Installed workflow evidence](evidence/shared-code-installed/summary.json) records the separate actual browser and native checks with their exact font/runtime scope.

Published native export stores source boundaries in standard PowerPoint shape tags. Complete unique groups recover exact code/source metadata, with current native text taking precedence. Missing, damaged or ambiguous groups retain visible native shapes and report diagnostics. Reimport does not reconstruct native formatting, positioning, font theme or readability policy. Eight installed-export wide/portrait slides pass native edit/save/reopen and all 24 original/saved/edited imports on the recorded Windows PowerPoint build; this is not arbitrary PowerPoint round-trip or pixel equivalence. The editor preserves untouched CRLF/CR source around edits and keeps committed preview geometry separate from its active native textarea caret.

The JSON schema can accept strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets). Published SVG/PPTX code output rejects forbidden controls, unpaired UTF-16 surrogates, U+FFFE and U+FFFF with `invalid-code-text`, the source field path and UTF-16 offset in the message. The input stays unchanged; the caller can correct that character explicitly. Tabs, CR/LF/CRLF and valid supplementary characters remain accepted for serialization. Schema support, format representability and glyph coverage are separate properties.

The controlled SVG harness requests `text-rendering="geometricPrecision"` as well as explicit segment placement. Initial Linux Chromium CI rounded glyph advances under default hinting, unlike Windows Edge with the same font bytes. The [SVG specification](https://www.w3.org/TR/SVG/painting.html#TextRenderingProperty) defines geometric precision as a rendering hint, so consumers still need actual browser checks with their exact fonts and supported environments; the hint alone does not certify agreement. The harness retains a 0.1-reference-pixel tolerance and records observations before assertions.

## Quote internals (core 0.8.0 and coordinated packages)

Core 0.8.0 exports `layoutQuote(value, box, options)` from the `@openpresentation/opf/composition` entrypoint. Pass validated quote content (object or string shorthand), its allocated reference-pixel box, resolved `fontFamilies`, `textMeasurement`, `scale` (canvas short edge / 720), effective `minFontSize`, `overflow` policy and its source `path`.

The result contains `parts` for the body and any nonempty footer, exact display `text`, source mappings, requested and resolved text styles, and the available boxes/fits. Source ranges use half-open UTF-16 offsets in both the source field and display string; generated quotation marks and the footer separator have no source range. The original content is never modified. A supplied width provider is reported as `provided`; it does not certify shaping or font fidelity.

Check `overflow` and `diagnostics` before accepting the parts. Invalid available dimensions remain visible with `fit` absent, and `overflow: 'error'` throws `OPFCompositionError`. Diagnostics distinguish invalid part space, parts outside their cell, text that exceeds its reserved space, and overlapping line rectangles. Those rectangles are conservative text-layout bounds, not measured glyph outlines. The readability floor is scaled once and can raise the nominal body (28) or footer (17) size; it is never silently capped below the selected floor.

`quote-flow-v1` keeps 18-reference-pixel outer insets and an 18-pixel body/footer gap while fonts scale with the canvas. A 40-pixel footer is a whitespace preference. The allocator expands it for long sources or compacts it for dense bodies, trying at most the nominal and minimum footer sizes and selecting the fitting pair with least total font reduction. If neither fits, it returns floor-size failure diagnostics. This is a bounded internal allocation step, not a complete layout-repair engine.

`composeSlide` scores both parts and accepts geometry against the final rounded item box. Each quote item carries `quoteLayout`; its compatibility `text` field is the same fit object as the quote body, including generated quotation marks. Consumers needing original offsets must use the explicit `sources` mappings. The coordinated renderer and PPTX consume these parts without another measurement/style-resolution pass. Missing geometry or invalid part boxes reject rendering/export rather than omitting content. This requires core 0.8.0 with renderer/PPTX 0.6.0; older core 0.7.0/renderer 0.5.1/PPTX 0.5.2 lack these changes. The complete published set, immutable verification refs and fresh registry evidence are recorded in `release-plan.json` and [the release plan](plans/shared-quote-release.md).

Browser glyph bounds can extend slightly beyond advance-based part boxes into the reserved inset. Current loaded-font tests record those overhangs, verify glyph containment inside the full quote cell and check body/footer separation. Native PowerPoint fixtures separately verify text, sizes, cell containment, save/reopen and reimport. Neither test establishes universal pixel equivalence. Original requested-font provenance through host substitutions and non-quote payload internals remain open requirements.

### Quote role and photo (FA-12)

`QuoteContent` also takes `role` and `photo`. The footer text is the attribution, then `role` after a line break, then `source` after ` - `; each field keeps its own source mapping (`<path>.role`). Without a `role` the footer text is unchanged. A `photo` (an `Asset` value) adds `QuoteLayout.photo`: `{path, value, box, shape}`, where `shape` is the circle mask of `imageShape('circle', box)` (DrawingML `ellipse` and the same outline as an SVG path). The diameter is three times the footer font size and the gap beside it three quarters of that size, so the allocator picks the footer size (nominal or the readability floor) with the photo in the footer height and the footer text in the remaining width. The photo sits at the start edge of the inset area: the left, or the right when `options.direction` is `rtl`, where the footer text is its mirror. The text block is centered on the photo. A photo whose height cannot fit at the floor adds the `photo-fit` diagnostic reason (and `overflow`); a photo with no footer text still draws. Without a photo `layoutQuote` returns exactly what it returned before, with no `photo` key. The renderer and the PPTX exporter draw `photo` from the result and do not recompute it.

## Timeline internals

`layoutTimeline(value, box, options)` (`timeline-flow-v1`) places an optional name and description, then the events as a marker on a connector with each event's `when`, `what` and `description` as separate text parts. It tries an alternating arrangement (labels above and below a horizontal connector) and a vertical one (a marker rail down the start edge, labels beside it), at most 50 candidates in all, and keeps the first that fits or the one with the fewest diagnostics. Right-to-left decks put the vertical rail on the right edge.

### Event status (FA-11)

`TimelineEvent.status` is `done`, `current` or `planned`. It is a progress state that the engines draw from the deck's own colors without judging it; schedule health (at risk, blocked) is deliberately not a status. Layout copies the status to `TimelineLayout.markers[i].status` and to each of that event's text parts (`TimelineTextPart.status`), and `timelineMarkerShapes(marker, colors)` and `timelineTextColor(part, colors)` turn it into the shapes and text color that both engines draw:

| Status | Marker | Text |
| --- | --- | --- |
| absent | A filled circle in the primary color. | Normal text color. |
| `done` | The same filled circle, so it looks like an event without a status. | Normal text color. |
| `current` ("we are here") | The filled circle inside a ring: a circle 1.6 times the marker's radius with a primary-color outline over the slide background. | The label (`what`) is bold, in the normal text color. |
| `planned` | A hollow-looking circle of the marker's radius: a primary-color outline filled with the slide background. | All of the event's text is the muted secondary text color. |

- **Geometry.** A marker's `radius` is the radius of its ellipse, for every status. A `current` marker also has `ring.radius`, exactly 1.6 times `radius`, and a `current` or `planned` marker has the `strokeWidth` of its outline (2 reference pixels at 720, at most half the radius). The drawn and exported ellipses have exactly these radii, so every ellipse of a deck has the same size for the same radius (a done, planned and unset marker are the same size); an outline is centered on its ellipse's edge and reaches half a stroke beyond it, and the cell check and the vertical rail count that half stroke. A ring that leaves the cell is reported as a `event-space` diagnostic like any marker. In the vertical arrangement a deck with a `current` event moves the rail and the text out by the ring's extra width so the text keeps its usual distance from the marker. Events without a status produce exactly the geometry and no extra keys they did before.
- **Hollow means background-filled.** The outline of a hollow marker and the ring are drawn over the slide background color (in the SVG as the fill, in PPTX as a solid fill of the same color) so the connector does not cross them.
- **Colors.** `timelineTextColor` returns `mutedText` for a planned event, lightened or darkened until it reaches 4.5:1 against the slide background (`TIMELINE_TEXT_MIN_CONTRAST`), and the normal text color otherwise. Outlines and rings are kept at 3:1 (`TIMELINE_OUTLINE_MIN_CONTRAST`); the filled marker keeps the primary color exactly.
- **Bold label.** The weight is part of the layout, not a drawing detail: the `what` part of a `current` event is requested at weight 700, so line breaks and heights were measured bold.
- **PPTX.** The marker is a native `ellipse` (solid primary fill for `done`, `current` and no status; background fill plus a primary line for `planned`), the ring is a second native `ellipse` (background fill plus a primary line), the bold label is a bold run, and planned text takes the muted color. The exporter records each event's status in the marker's `OPF_TIMELINE_V1` tag and the ring in a tag of its own, and the importer restores `status` from them; a deck whose marker or ring was edited away imports as ordinary text without status, like the rest of the timeline provenance. Status is also written in Markdown as a task-list prefix on the event line: `[x]` done, `[>]` current, `[ ]` planned.

## Resizing in the preview

Choose **Arrange** in the editor to reveal track dividers. Drag a divider to redistribute the space between adjacent columns (row/grid) or rows (column), including nested groups. Arrow keys make small changes; Shift makes larger changes. Escape discards a pointer draft. One drag creates one undo step, and no content is removed. Strict overflow rejects a resize that violates its fit constraints.

Resizing an automatic layout makes its chosen columns explicit as `mode: grid` with `columns`. This prevents the number of columns from changing under the pointer. The adjacent share clamps to 5–95%, with positive schema-valid weights. Other track proportions and unrelated document fields remain intact. Promoted regions retain their positions; their nested groups can still be resized. Layouts with reserved placeholder slots need an explicit arrangement first. Flows with more than twelve tracks need grouping before the current resize controls can express all weights.

`createCanvasEditor(container, {layoutEditing: true, ...options})` enables dividers initially. `canvas.setLayoutEditing(boolean)` toggles them, and `canvas.commit()` / `canvas.cancel()` also handle an active resize. `onDraft` receives the proposed document; the session stays unchanged until commit. Changes to the resized container cancel a stale draft; unrelated updates are retained.

The shared engine exposes `geometry.flows`: each flow has its container path, content box, resolved column/row tracks (offset and size), clamped gap, effective composition, item count, and reserved slot count. This is renderer geometry, not new OPF document fields.

Agents can prepare the same guarded change without a DOM:

```js
import {prepareTrackResize} from '@openpresentation/opf-editor/layout';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
const geometry = resolvePresentation(editor.presentation, { fonts }).slides[0].geometry;
const flow = geometry.flows.find(flow => flow.path === 'slides.0');
const prepared = prepareTrackResize(editor.presentation, flow, 0, 0.65);
// Boundary 0: give the first track 65% of the adjacent pair's combined space.
// Preview prepared.presentation with the same renderer and fonts handle before applying.
editor.applyPatch(prepared.patches, {rejectInvalid: true});
```

The patch contains a `test` guard for the container before changing its composition. Failed tests do not mutate the document or its history. A test-only patch is read-only. Rendering is preflighted by the canvas; headless callers should likewise render a candidate to enforce font and overflow constraints.

Verification: editor layout model tests, `/layout-tests.html` browser keyboard checks and trusted-pointer specimens, and `pnpm test:layout` for measured SVG/native PPTX coordinate parity. Shape-coordinate checks do not establish PowerPoint raster pixel parity.


## Reordering and moving blocks

In **Arrange**, drag a numbered block handle to reorder siblings. The insertion marker shows the destination; the shared renderer reflows the slide after drop. Arrow keys on a handle move the whole block earlier or later. Click a handle for **Earlier**, **Later**, or an explicit destination and insertion position. The destination menu supports existing groups and block-based slides, including moving a child out of a group or moving a whole group to another slide. `canvas.openBlockMenu(path)` opens the same controls programmatically.

A move preserves the entire block and its nested content, formatting, data, and references. Parent composition weights describe positions, so they stay in place. Moving to another container can change the block's inherited design and readability constraints; the canvas renders the candidate before committing it. Strict overflow or an unavailable required font rejects the move. A move cannot leave an empty block container or put a group inside its own descendants. Move the group or add another block first when the source has only one child.

```js
import {prepareBlockMove, listBlockContainers} from '@openpresentation/opf-editor/layout';
const containers = listBlockContainers(editor.presentation);
const prepared = prepareBlockMove(editor.presentation,
  '/slides/0/blocks/0', '/slides/0/blocks/1', 1);
// Insert the first block before child 1 of the second block's group.
// Destination indexes refer to the document before removal.
// prepared.path reports the moved block's address after any index shifts.
editor.applyPatch(prepared.patches, {rejectInvalid: true});
```

`prepareBlockMove` returns `{presentation, patches, path, changed}`. It validates the complete result and emits guarded remove/add patches, so the editor or CLI can apply it atomically. No-op moves return `changed: false` and no patches. `listBlockContainers(presentation, {slideIndex})` optionally limits discovery to a single slide and excludes arbitrary extension data. Headless callers should render the candidate with their intended font provider before applying. The browser and installed-package block harnesses exercise nested moves, undo, stale menus, keyboard access, strict-fit rejection, and native drag reordering.

Creation and deletion use the same layout engine: insertions can normalize implicit payloads into explicit blocks; deletions prune empty groups while retaining the slide. Existing track weights stay positional. See the [editor creation guide](live-editor.md#create-duplicate-and-delete-content) for the guarded APIs and canvas controls.
