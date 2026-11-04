# Dynamic composition

OPF keeps authoring intent in JSON. Use `blocks` when content can reflow; use promoted regions when relative placement is meaningful. `composition` on a slide overrides fields in the resolved layout's `composition`. Existing documents remain valid.

The published Node 24 set is the registry's `latest` of each package (`node scripts/registry-plan.mjs`); a layout is one list of regions (FA-33, Gallery 5). Use the exact pins it prints; the [compatibility matrix](compatibility-matrix.md) separates package support from native Office and font gates. Older version references below identify when individual contracts were introduced.

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

Two or three blocks (no group, no caption) at the root of the body form a split. Its fill is the share of the body its blocks draw: the ink of text, lists, quotes, metrics and code (each line's width by its height at its starting size, so rewrapping changes nothing), a table at most its natural width by the height of its rows at that width, a timeline its cell's width by the height it needs, a picture shown whole and a video their frames, and a chart the largest 4:3 box of its cell.

- **Row or column by fill (LH-71).** In `auto` mode with no `columns` or `weights`, a split tries one row and one column (stacked at the heights the blocks need) besides the grid the scores chose, and keeps the one that fills the most. A row that fills under 55% counts its code panels stretched, as it is drawn. A row must give every block at least 120 px of width, and a column must give every picture, chart and video at least 120 px of height. Neither may overflow more than the scored grid, nor set its blocks smaller (more font reduction) unless it removes an overflow. A fill within 2% of the body keeps the scored grid. Texts fill the same either way, so they stay in a row. A table that wraps in a row goes full width above its text. The explanation records such a container with `reason: "split-fill"`. An explicit `row`, `column` or `grid` is kept.
- **Panels stretch, text centers (LH-52).** A split that fills under 55% of the body no longer reads as a strip along the top. In a row (any mode), a code panel takes its whole cell with its code in the middle. Text, lists, quotes, metrics, tables and timelines sit at the height they need in the middle of their cells (a card still fills its cell). A picture shown whole or a video sits in the middle of its cell, and a chart's box is centered. In a column, every measured block keeps the height it needs (a table no longer takes the spare height that pushed its neighbor to the foot of the body), and the stack sits in the middle of the body. No block changes size, and the arrangement and widths are unchanged.

`gap` defaults to 1/30 and `padding` to 0.08, both fractions of the canvas's shorter edge. Large gaps are reduced when necessary to keep cells positive. `minFontSize` defaults to 16 reference pixels at a 720-pixel short edge. `maxFontSize` (LH-144, none by default) caps body text the same way from above: paragraphs, lists, quotes, metrics and timelines are never set larger, their growth included, and never under `minFontSize`; headings, tables, code and charts keep their sizes. `paginate` writes it on the pages after the first, so the pages of one slide share its sizes. The reference coordinate system uses 96 pixels per inch. Explicit inch dimensions override presets independently for each axis.

Composed font sizes lie on PowerPoint's 0.01 pt grid (RR-16). PowerPoint stores a run size (`sz`) in hundredths of a point and a point is 4/3 reference pixels, so every size a fit accepts is a whole multiple of 1/75 px (`FONT_SIZE_GRID_PER_PX`), and the preview draws exactly the size the export writes. Fitting evaluates each trial size on the grid before breaking lines and placing text: trial sizes stay anchored to the unsnapped request (no drift) and round down (`snapFontSizeDown`), so a size that fit before snapping still fits; a readability floor rounds up (`snapFontSizeUp`), so `minFontSize` is never undercut; and a result that reports no overflow was measured at the size it carries. The rule covers plain, rich, list (marker, description and picture-bullet side), table, quote, code, metric, timeline, furniture and heading text, including each rich run and script. `wrapText` measures at exactly the size it is given.

Headings reserve space according to their wrapped text. Title and subtitle share the padded width of the free area, and a missing tag or subtitle leaves no gap.

A content slide's title stays on one line when it can (LH-51). The title asks for 54 reference pixels and, before it wraps, steps down in three equal steps of a twelfth (49.5, 45, 40.5 px) to the largest step that sets it on one line, so a deck has at most four content title sizes. Only a title that needs a second line even at 40.5 px wraps, at 54 px and balanced, as before. A content slide is one with a body whose title sits in auto rows above it; covers, sections, the stacked records (`statement`, `quote`, `closing`) and a title beside the body in a sized row (`agenda-split`) keep 54 px. The step is chosen per slide: composition sees one slide, so one size for the whole deck would need each engine to resolve every slide's layout first.

A content title of the form "Topic: qualifier" (its first colon followed by a space) that still wraps at 40.5 px is split at the colon when the slide has no subtitle and the topic fits one line (LH-76). The topic is the title, on one line at its step; the qualifier is drawn below it as the subtitle at 28 px, its first letter as authored. A rich-text title and a layout with a separate subtitle area are not split. This is a composition-time presentation: the document keeps the whole title. Both items carry the title's path and `titleSplit` (`part`, and the drawn part's `start` and `end` in the authored title). The PPTX export puts the topic in the Title placeholder and the qualifier in a text box below it, and tags both as one title group, so import restores the whole title.

Cover slides vertically center the combined tag/title/subtitle group in the free heading area. A cover is a slide with no body payload (no root content field, where a root `image` counts unless it carries its own `placement`, no `blocks` other than placed images, no promoted regions; empty payloads such as `blocks: []`, `text: ""`, empty lists and regions with nothing in them count as no body; whitespace-only text is still body) on a v2 template or with no layout record. Empty template regions collapse according to the record and its heading regions place the headings (a heading region's own `anchor` sets the group at the foot of its area, as the gallery `cover` and `section` do, LH-130). The rule reads the record, never its id. The free area is the slide minus the bands of placed images, header and footer furniture, and the usual padding; a picture background reserves nothing. A wrapped heading makes the group taller and the group recenters. A group that already fills the free area is not moved. Accepted line and outline origins move with the boxes. Explicit heading `alignment` positions ink inside the box and never changes the vertical position. A flowed image is body, so image slides keep the top-aligned content origin; a placed image is not. Content slides are not affected: headings stay at the top and the body follows them. This is a reference-engine default, not a schema field.

## Adaptive layout templates (OPF 0.19)

A layout record is one ordered list of regions, declared once in reading order, and describes the content each body region accepts. The 30 built-in layouts are named by intent, such as `cover`, `text`, `chart`, `list`, `metrics` and `image-beside`. `layout: "auto"` explicitly asks for automatic composition; omitting `layout` does the same. See [Layout templates](layout-templates.md) for the record shape, the built-ins, region binding and overflow rules.

```json
{
  "name": "Evidence beside the recommendation",
  "slides": [{
    "layout": "two-column",
    "title": "Approve the next phase",
    "blocks": [
      { "region": "first", "text": "The pilot met its acceptance criteria." },
      { "region": "second", "text": "Fund the next two sites." }
    ]
  }]
}
```

A block's `region` pin is resolved before the layout binds unpinned content by kind, role and reading order. A region's `flow` arranges several blocks; `max` limits how many it accepts, and `overflowRegion` receives content no region accepts. If there is no overflow region, unplaced content receives a row below the grid. An empty area collapses into a neighbouring area unless its record says `empty: "keep"`. The geometry exposes the result in `geometry.regions`, including each region's box, bound paths, overflow, collapse and bleed. Pagination repeats the selected layout and carries a region pin forward for a block moved to a continuation slide.

When a template sets a body role at the readability floor, `composeSlide` composes the same blocks as the automatic grid and keeps that result when its smallest body size is larger (or as large with less overflow) and it neither overflows nor splits words more (LH-83, `recomposed` on the composition): the headings then sit above the body as on an automatic slide and the result has no `regions`. `recompose: false` keeps the layout's result. See [Recomposition at the readability floor](layout-templates.md#recomposition-at-the-readability-floor-lh-83).

A body that fills under half of its height at its role sizes grows (LH-48): the only block of a slide steps up the type scale (each role up to its display size, `LONE_DISPLAY_SIZES`) to about 60% of the body and sits in its middle, and a body of several paragraphs and lists steps up together, at one size, and centers. `fill: false` keeps the role sizes. See [A body that fills too little](layout-templates.md#a-body-that-fills-too-little-lh-48). A slide with no body composes as a cover and grows its headings by steps of the type scale (LH-129), as a `cover` record does; a lone timeline tries two or three steps of the scale on its labels first.

The slide's own `composition.mode`, `columns` and `weights` arrange the first primary flowing region. `design.contentDirection` asks flowing regions to use a row or column; `design.mirror` reverses template tracks. Effective design keys resolve per key from slide, deck, theme, layout, then engine default. Promoted regions retain their 3×3 vocabulary and visual reading order. The layout template does not replace content groups inside a slide; groups still keep related blocks together.

## Shared headers and footers

Published core 0.11.0 exposes `layoutFurniture(slide, options)` and `geometry.furniture`, separate from body `items`. Composition identifies the available-space policy as `grid-score-v9`. Raw callers pass the presentation as `options.presentation`, resolved dimensions/fonts and the same measurement provider used by preview. `slideIndex` identifies source paths; optional `slideNumber` is the one-based displayed number.

The core resolver honors whole local header/footer overrides, including `false` and empty objects. Each zone retains its image and all configured text fields in source-aware parts. Literal text and dates preserve whitespace and empty strings. A zone logo reference (`var:organization.logo.icon`) to an organization without a logo, missing socials, or `date: true` without a host-supplied current date, produces `unresolved-content`; the implementation never consults a clock or invents source text.

Generated values are variables inside a zone's `text` (FA-31): `{{organization.name}}`, `{{speaker.name}}, {{speaker.title}}` and the other deck-wide built-ins resolve with `resolveVariables` before composition, and the slide-scoped `{{slide.number}}` (the displayed number), `{{slide.section}}` (the slide's `section`, empty when it has none) and `{{deck.slideCount}}` (the displayed slide count: `options.slideCount`, else `presentation.slides.length`; whole-deck pagination iterates to the final page count) resolve in `layoutFurniture` for the slide it lays out. One `text` holds several values in the author's order, with `\n` between lines (`"{{organization.name}}\n{{slide.section}}"`, `"Page {{slide.number}} of {{deck.slideCount}}"`). An escaped `\{{slide.number}}` draws as the literal token. Every zone `text` is one part with `field: 'text'` and `sourcePath` at the authored text. `dateFormat` is an LDML-style pattern (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `EEEE`, `EEE`, quoted literals) with fixed English month and weekday names. A string `date` with `dateFormat` must be an ISO `YYYY-MM-DD` date and renders as fixed, generated text tied to that source value; without `dateFormat` a date string stays literal and editable. `date: true` is the current date: hosts pass today's ISO date as `options.date` (composition, pagination, renderer and exporter), and the default pattern is `M/d/yyyy`. Text parts expose `fields`: one `{ type: 'slideNumber', start, end }` per substituted `{{slide.number}}` and one `{ type: 'date', start, end, format }` for a whole current date, as half-open UTF-16 ranges into the part's `text`, so exporters can write native live fields while `{{deck.slideCount}}`, `{{slide.section}}` and fixed dates stay fixed text. `formatFurnitureDate()` is exported for hosts. All configured fields in one zone sit side by side in one row, in the order image, text, socials, date (see the row geometry below). An organization logo is `image: "var:organization.logo.icon"` (or any shape and organization): `layoutFurniture` resolves it for the slide's background and the image part keeps the reference in `reference` (see [design resolution](design-resolution.md#brand-assets-and-layout-hints)). Hiding furniture on a title slide is the slide-level `design.header: false` / `design.footer: false` override.

The slide-scoped built-ins work in body text too. Engines compose and draw the slide `resolveSlideContext(deck, index, { slideNumber, slideCount })` returns as `context.slide` (`resolveSlideVariables(slide, { slideNumber, slideCount, presentation, darkBackground })` substitutes them in the slide's own strings and resolves its organization logo references for the background, leaving its own header and footer to `layoutFurniture`), with the same numbers in `context.options`, so body text is measured and drawn with the real value. `paginate` measures continuation pages with the substituted values but returns the slides with the tokens kept, never splitting a page inside a token, and runs its slide-count fixed point whenever `{{deck.slideCount}}` appears in the deck.

`socials: true` (core 0.11.1 and later) generates one `socials` part from the primary organization's `organization.socials`. The part has one source line per platform, in key order, and a parallel `links` array (`platform`, `text`, `href`, `resolved`, `sourcePath`). `resolveSocialProfile(platform, value, owner)` formats each value without network access, through the engine's social-platform vocabulary (`SOCIAL_PLATFORMS`, [`engine-vocabularies.json`](../spec/reference/engine-vocabularies.json)). A handle loses its `handlePrefix` and is substituted into `companyUrlPattern`, then `profileUrlPattern`, then `baseUrl/{handle}`; the result is shown as that URL without `https://`. A URL value passes through unchanged except that `https://` is dropped from the display. A key outside the vocabulary (the schema rejects one) is shown raw with no link, which is the Socials engine fallback. No catalog is involved: the Socials keys are an engine vocabulary. A missing organization, or one with no non-empty socials, produces `unresolved-content`. Speaker socials, platform icons, brand colors and slide-size presets are not rendered.

`furniture-flow-v2` lays the left, center and right zones on the content inset (`composition.padding`, the body's own left and right edge) as three columns with a 2% gutter, and an empty zone lends its column to its neighbours: a lone `left` footer spans the content width, a `left` and a `right` zone share the free centre, and a `center` zone stays centred. The validator warns (`opf/furniture-wraps`) when a zone's text wraps past two lines; move sources to a caption or the speaker notes. **Zones lay out in a row (RR-71, vetoable).** A zone's parts sit side by side in the order image, text, socials, date (in a right-to-left deck the row runs from the right, the image at the start edge), `FURNITURE_GAP` (12 reference pixels at a 720-pixel short edge) apart, the row flush with the zone's left edge, centered, or flush with its right edge, and each part vertically centered on the row's tallest part. `
` still breaks lines inside a text or socials part. With other parts, a text part's box is as wide as its longest line; a zone with a lone text part keeps the whole zone width (it wraps there, as before). When the row is wider than the zone, its text parts share what the images and gaps leave: a part narrower than an equal share keeps its width and the others wrap at the share; beside other parts an image is at most `FURNITURE_IMAGE_SHARE` (40%) of the zone's width, and a word that would break inside itself at the readability floor (letters or digits of a space-separated script on both sides of a soft break) is a `text-overflow` diagnostic at the part's text path, never a silent break. The tallest row sets the natural band height; rows start at the band's top edge. Text uses at least the selected readability floor, with complete accepted source lines and optional measured outline placement. Header and footer bands reserve room before heading and body allocation. Irreducible text, conflicting bands or a heading displaced beyond the remaining space produce diagnostics; strict composition rejects them. An image part (`type: 'image'`) alone in its zone aligns like the zone's text: its `box` is as wide as the image's own proportions make it at the band height (a 36 px band at 1280 px wide), at most the zone, flush with the zone's left edge in the left zone, centered in the center zone and flush with its right edge in the right zone, at the same vertical position as before; consumers fit the image inside `box`. Core reads the proportions without fetching, from an embedded PNG, JPEG, GIF, WebP or SVG data URI or an `asset:` reference to one, decoding only a bounded prefix of the payload (64 KiB, 1 MiB for a JPEG whose frame header sits behind large metadata) and memoizing per source, so a multi-megabyte logo costs nothing per slide; a JPEG whose header is past 1 MiB, an SVG whose root tag is past 64 KiB, a path or a URL is unreadable is placed in a square box (vetoable), so a wide image behind a path or URL is drawn small and flush to its zone edge until it is embedded. No-furniture body geometry remains unchanged.

Pagination repeats these fields without putting them among body slices. An optional `page.repeatedMappings` records repeated heading/furniture and metadata paths while the existing `page.mappings` retains its body-fragment contract. Whole-deck pagination evaluates final output numbers, including preceding continuation pages, and rejects unresolved repeated content atomically. Renderer and editor reuse the accepted parts; literal text/date fields, including empty values, support direct canvas editing and undo. Generated labels remain tied to metadata.

Published PPTX (0.9.1 and later) draws the accepted editable text boxes and fitted images and records furniture provenance in tagged slide shapes. Reimport uses current native text and images; damaged or ambiguous provenance retains visible content with diagnostics. The [fresh installed-package evidence](evidence/shipped-train-20260921/installed/acceptance-summary.json) includes deterministic export, current-content reimport controls and offline canvas editing/undo. Native PowerPoint acceptance, font compatibility and full visual review remain separate gates. Since PPTX 0.11.9 (RR-11), the first footer text, date and slide number that fit one accepted line become real PowerPoint `ftr`, `dt` and `sldNum` placeholders at exactly this geometry, with master/layout placeholders and `p:hf` flags (see [native header and footer](https://github.com/OpenPresentation/opf-pptx/blob/main/docs/native-header-footer.md)); header parts, organization, section, socials, images and multi-line text stay tagged shapes because PowerPoint has no object for them. No core geometry or schema changed. Bounds/readability checks do not certify whole-slide design quality: long labels can wrap heavily in portrait zones, and outline agreement does not establish native font identity.

## Footnote areas and caption bands

RR-34 (core after 0.11.4) adds two reserved regions that exist only for decks that use the fields. A slide whose runs carry `cite` or `footnote` markers gets `geometry.footnotes` (`footnote-area-v1`): a rule and the slide's notes in number order, directly above the footer band (or the bottom padding) with the content area's left edge and width, in the body family at the furniture size; the content area shrinks by exactly the area's height plus half the slide gap, and nothing above it moves. The area takes at most 35% of the span between the heading top and the footer band; a note that does not fit reports `text-overflow` at its source path (`references.N` or the run's path), which pagination treats like any other fit overflow. `slideCitations(slide, slideIndex, presentation)` is the numbering `composeSlide` uses; pass the same `presentation` and `slideIndex` to every consumer. An `image`, `chart`, `table` or `video` payload with a `caption` reserves a caption band inside its region (`item.caption`; `item.box` becomes the media box), below or above the media, at most 35% of the region; automatic grid selection scores the leaf on its media box. See [footnotes, citations and captions](footnotes-citations-captions.md).

## Backgrounds and placed images

Core 0.15 composes pictures in two ways (FA-22); [images](image-treatments.md) has the full vocabulary.

- A picture background (the slide's `design.background`, then the deck's, then the theme's, when it is `{ type: "image", ... }` or an image-source string) is `geometry.backgroundImage`: the whole canvas as its frame, `fit` (`cover`, `contain`, `stretch`, `tile`), `focus`, `opacity`, `recolor` and the overlay box (whole picture or an edge band). It never moves content. `resolveSlideContext` passes the theme's background as `ComposeSlideOptions.themeBackground`.
- Every image item carries `item.image`: the frame inside its region, `fit` (the block's own, else the effective `design.imageFit`, else `cover` in a layout and in an automatic picture track, and `contain` elsewhere on a slide composed with no layout), `focus`, the mask with its DrawingML preset and SVG outline, line, opacity, recolor and overlay. `fitImage(frame, fit, aspect, focus)` is the shared fit math (LH-84: with no authored `focus`, a portrait picture, taller than wide, cover-cropped into a wider frame defaults to focus y 0.3 so heads stay in frame, `defaultImageFocus`; any other crop is centered, an authored focus always wins, and `item.image.focus` is the focus drawn); core fills `item.image.picture` itself when it can read the picture's proportions (a data URI, or an `asset:` reference to one). A picture shown whole (`contain`) gets a frame of its own proportions at the region's anchor (top by default) when core can read them, so `item.image.box` is the picture and not the whole cell; a video's `item.box` is its 16:9 frame; in automatic composition a chart is at most 4:3 and a single row of a portrait picture beside other blocks, or of two prose blocks whose demand differs by 2.5 times, gets weighted widths.

A top-level image block with `placement: { edge, size, inset }` takes a band along that slide edge: `size` of the slide width (left, right) or height (top, bottom), default 0.5, edge to edge, or inside the slide padding with `inset`. Headings, footnotes and the body compose in the free area that remains, with the usual padding; header and footer bands keep their full-width placement. Bands are taken in block order and each spans the free area the earlier ones left; a second block on a used edge flows as content (the validator reports it). Placed items are listed after the headings and before the flowed body, and their placeholder slot is not reserved in the flow. A slide whose only body is placed images is composed like a cover. A right-to-left deck mirrors `left` and `right`.

## One size guard for the layout-harvest rules

Every rule of the third layout-harvest wave that rearranges or resizes blocks is held to one guard in `composeSlide`: no rule sets
a block's fitted body size below what the slide gets without the wave's rules (each text, list and table, and each main part of a
quote, code panel, metric or timeline), unless that leaves fewer findings (`text-overflow`, `small-cell`, `layout-unplaced`), and
then never below the readability floor. A rule never adds a finding, splits a word or sets a paragraph under the minimum measure.
The guarded rules are LH-89's nested gaps, LH-65's empty columns, LH-72's measure column, LH-78's quote lead size and card, LH-06's
automatic band or pill, LH-114's pull line, LH-121's timeline status words, LH-68's scorecard tiles, LH-86's long-text rows, LH-66's
minimum measure, LH-67's lead plus stack, LH-70's paragraph columns, LH-10's reading measure in a layout's regions, LH-64's one start for
a row of cards of mixed kinds, LH-47's stretched short last row, LH-120's 40% share of a bar chart in a row of three, LH-112's start
alignment and display size of a metric beside other blocks (with LH-15's band), LH-50's label drawn as the eyebrow of the text after it,
LH-08's ruled rows for a list of short labels with descriptions (see [Design resolution](design-resolution.md#liststyle-lh-08-vetoable)),
LH-133's questions as ruled rows (`pair-rows`, see [Questions and terms](#questions-and-terms-lh-133)), LH-07's step badges and flows
of a `sequence` region (see [Step sequences](layout-templates.md#step-sequences-lh-07)), LH-134's numerals (`numerals`, see
[Numerals, badges or rows](#numerals-badges-or-rows-lh-134)), LH-135's pricing tiers as one card each and LH-136's one-word pillar titles at display size over an accent rule (see [Layout templates](layout-templates.md)), LH-131's featured card
of a pair or a set (`featured-card`, see [Emphasis surface](#emphasis-surface-lh-06)), LH-137's delta pill (`delta-pill`) and LH-137's
check-mark tiles of a dark summary list (`check-tiles`). Those three only draw, so a slide that draws one of them is also composed under the guard without them and keeps the drawing only when no block reads smaller there, nothing more is found and a body role at the readability floor stays at it (the drawing never decides LH-83's recomposition); otherwise each is tried alone on top of the rules that slide kept. LH-39's figure on one line
(`metric-figure`) is tried last, on top of the rules the guard kept, and kept when the slide reads as well with a split figure allowed
the next smaller type-scale step (a slide that composes no metric is not composed again for it).
An eyebrow is set at its own role size (0.6 of its paragraph's, from 20 to 24 px), like the tag, and is not a body size the guard compares. A pull line sets its quote at the lead size on purpose,
so the guard holds that quote to the slide's smallest body size rather than to the larger size it had on a card (every other block still
keeps its own size); another arrangement of the slide (a track, LH-48's growth) that draws the quote on a card again is held to the
card's size. The display size is tried last, so it never displaces an arrangement that reads well without it, and a value at display
size is compared at its 76 px role size: what it has above that is headroom an arrangement may spend.

- The slide is composed once with every rule. When none changed anything (most slides), that is the result.
- When only rules that move blocks without changing the size any block asks for changed something (nested gaps, the measure, long-text
  rows, the measure column), and every block got the size it asked for with no finding, the result is kept as it is.
- Otherwise the slide is also composed without the rules. That composition seeds LH-68's tiles (each metric role starts at its stacked
  size) and LH-06's band or pill (its text starts at the size the block had), and the result with the rules is kept when it reads as
  well. When it does not, each rule that changed something is added on its own, smallest change first, and kept while the slide still
  reads as well.
- The slide then settles: a message set in the middle of the slide grows (LH-129), an under-filled body grows (LH-48), a layout may
  be recomposed as the automatic grid (LH-49, LH-83), and an automatic slide may give its picture or chart a track (LH-80, LH-49). Each
  of those arrangements is composed with the rules that read well in it and kept only when it reads as well as the guarded composition.
- A slide that draws step badges (LH-07) or numerals (LH-134) is settled once more without them and keeps them only when every block
  reads as well, since a badge band changes how much of the body is filled and so whether LH-48 or LH-129 grows it. The automatic scrim of a picture
  background (LH-02) is computed last, over the slide that is kept, and changes no box or size.

LH-52 and LH-71 only place blocks at the sizes they already have and are not guarded; LH-72's start alignment and sibling quotes of one
row sharing a size are always applied. The rules meet as follows:

- Paragraph columns (LH-70) and a lead plus stack (LH-67) keep their own cells; LH-52 centers only the scored grid or LH-71's row, and
  LH-48 does not grow them.
- A quote beside another block in a centered split (LH-52) takes its own card (LH-78), measured with the card's insets, in the middle of
  its cell. On the emphasis surface (LH-06) the surface is its card.
- Long texts that LH-86 moved into one region keep their rows; paragraph columns and a lead plus stack do not rearrange them. A short
  last text after them is LH-06's foot band, bound to no region.
- LH-06's band or pill keeps its own size; LH-48 grows the blocks above it. LH-114's pull line does the same.
- LH-48 grows LH-86's long-text rows and LH-52's splits of paragraphs like any body of paragraphs: its fill is the height the text covers,
  not the cards around it. A lead plus stack (LH-67) does not grow, so its lead stays larger; a body at the floor is left to LH-83.
- When LH-71 stacks a chart above a short takeaway and its plot becomes wider than 3:1, LH-49 gives the chart the filling track beside
  the text. A picture track (LH-80) keeps only the rules that read well beside it (a quote's lead size that would make it smaller is
  left out).
- Charts that LH-49 recomposes share their value axis and plot height (LH-33, LH-93) in the recomposed grid.
- A list in a `sequence` region keeps LH-07's badges and takes no automatic ruled rows (LH-08); its other lists, and a slide whose
  badges the guard refused, may still be ruled. An agenda whose entries all have descriptions draws LH-134's numbered rows instead of
  badges (see [Numerals, badges or rows](#numerals-badges-or-rows-lh-134)).
- LH-133's questions as ruled rows take the region's blocks out of its grid into one column; six or more short questions keep the grid
  and only gain their accent rules, which sit in the gaps and change no size.
- LH-129 grows a cover's or section's title and subtitle but not its tag: the tag is LH-32's eyebrow at its 22 px role size, which is
  also its display size.
- LH-50's eyebrows apply on slides without layout regions and LH-07's steps only in layout regions, so a step never carries an eyebrow.
  LH-152's root label before a list stays a block on a layout with a `sequence` region for the same reason.

## Questions and terms (LH-133)

A question with its answer and a term with its definition are read from the content, never from a slide or layout id: a question is
an entry (with a description, at the first level) whose text ends with a question mark of its script (`?`, the fullwidth `？`, the
Arabic `؟`, the reversed `⸮`, before any closing quote or bracket; `questionText`); a term is a short label (`isLabelText`) of at most
two words (`TERM_WORDS`; `pairEntry`). Claude Design sets an FAQ and a glossary as two-column ruled rows:

- **A list of questions.** A list of two or more first-level questions with answers is drawn as ruled rows (LH-08's rows, under the
  guarded rule `pair-rows`): each question bold in a column of `LIST_ROWS_LABEL_SHARE` (40%) of the list's width, wrapping in it, its
  answer beside it with their first baselines aligned. A question that needs more than `LIST_QUESTION_LINES` (3) lines in the column
  puts every answer under its question instead.
- **One block per question.** A region whose two or more blocks are each a one-entry list holding a question with its answer (the
  usual way an FAQ is written) draws them one under another across the region instead of in its grid, each block a ruled row: the
  questions share one column of 40% of the width and the answers start at one edge, the answer at the list size (as the heading list it
  would otherwise be), and a hairline in the middle of the gap between two blocks. The import keeps each block (the export names each
  list, so two stacked lists are never merged into one).
- **Six or more short questions** (`PAIR_GRID_MIN`; each question at most 48 and each answer at most 90 characters) keep the region's
  grid (3 × 2 for six), each cell under an accent rule: `LIST_ACCENT_RULE_WIDTH` (3 reference px) in the accent, the tag's color on its
  backdrop, half a gap over its text and never nearer the text above it than its own. Questions whose rows the guard refused keep the
  grid with the same rules.
- **A glossary.** The slide's lone list of two or more terms with definitions, most of them one word ("ARR", "Churn"; a list of
  features named in two words is not a glossary), draws its terms in the accent (`ListEntryLayout.accent`) in the column of the widest
  term, its definitions beside them as LH-08's rows.

- **Ruled rows fill the body** (LH-48 for rows). A lone list drawn as ruled rows (LH-08's rows, questions, a glossary, takeaways
  beside numerals, an agenda's numbered rows) first grows in type-scale steps as any lone list does (toward about 60% of the body, never
  smaller than before), then takes the whole body: the leftover height is shared evenly between its rows, each gap at most
  `LIST_ROWS_SPREAD` (3) em, the hairlines in the middle of the gaps and numerals with their rows, and what is still left sits above and
  below them (`ListFitOptions.spread`). One-question blocks stacked as rows spread over the body the same way, from a gap under the
  headings to the foot of the content box. Claude Design spreads an agenda's or a FAQ's rows down the slide like this.

Rules and accents are drawing: the preview draws them as SVG lines and text fills, the PPTX export as native lines (`OPF list rule
<path> N`) and run colors, and the import reads neither as content (a term's accent is the look the export records for its runs). In a
right-to-left deck the question or term column is at the right and the answers to its left.

## Numerals, badges or rows (LH-134)

A numbered list draws its numbers one way, decided by its region and its content, never by a slide id:

1. **A `steps` region** (a process): LH-07's badges, or a flow of chips.
2. **A `numbered` region** (an agenda): when every entry of every list of the region has a description, numbered ruled rows: each
   number a numeral at the list size, bold in the accent and in two digits under 10 ("01"), in a column at the row's start, the label
   bold and the description in a second column (Claude Design's agenda). Otherwise LH-07's badges, for every list of the agenda.
3. **Elsewhere**, a numbered list that is the slide's lone body block with 2 to `NUMERAL_TAKEAWAYS` (5) first-level entries is a few
   takeaways: display numerals beside ruled rows, the numeral `LIST_NUMERAL_SCALE` (2.5) times the list size when every takeaway has a
   supporting line (its digits from the takeaway's capitals to about its line's baseline) and `STEP_BADGE` (1.75) times when one has
   none, `LIST_NUMERAL_GAP` (1.5 em) before the text.
4. **Every other numbered list** keeps its native numbers, ruled when LH-08 rules it.

Numerals and badges are drawing, under LH-07's veto: an unnumbered agenda is numbered as drawing only and imports unnumbered, and an
authored `numbering` comes back from the tag of each numeral or badge (`ComposedStepBadge.list`). Both are guarded (`step-badges`,
`numerals`), and a slide keeps them only when every block reads as well as without them; a list beside numerals grows (LH-48) as the
plain list would, as long as it fits with them. A numeral is `ComposedStepBadge.numeral`, its line box: the preview draws its label
centered on its column in the tag's color, the PPTX export a text box at that box holding the numeral (no ellipse).

## Metrics beside other blocks

- **Display size (LH-112).** One or two metrics that share the body with one or two blocks of other kinds (a chart, table, paragraph,
  list, quote, picture or timeline) are drawn at display size: one metric's value starts at 120 reference pixels and grows in 4 px steps
  to 160 while its line height stays within 40% of the body's height and its one line within 90% of its cell's width; two start at 90
  and grow to 120 (`METRIC_DISPLAY_SIZES`, `METRIC_DISPLAY_HEIGHT`, `METRIC_DISPLAY_WIDTH`). A value that would wrap at its start keeps
  one line at the largest size down to its 76 px role size. Such a metric is start-aligned with its column (value, label, description,
  delta), unless the slide or the deck sets `contentAlignment`; a layout's or theme's centering is the default for short text, as LH-70
  reads it. A metric alone keeps its centered display (LH-101 below) and a grid of metrics alone, or a scorecard tile (LH-68), keeps its
  sizes.
- **Lone metric (LH-101).** A lone metric grows by the type scale's ratio, up to nine steps, while it fills at most 80% of its cell
  (`LONE_METRIC_TARGET`), its value up to 232 px (`LONE_DISPLAY_SIZES.value`), as Claude Design sets a lone figure at about 230 px.
- **Band (LH-15).** A metric at display size in a cell at least three times as wide as it is tall (as the cell gives it, or as the
  metric stacks when the cell takes its natural height, `METRIC_BAND_RATIO`) is a band (`arrangement: "band"`): the value at the start
  edge, at most 60% of the width, and the label, description and delta in a column beside it (at least 200 px wide), the two centered on
  the band's height. Right to left, the value is at the right.
- **KPI column beside a chart (LH-61).** A slide whose body is one or two metrics and one chart, and at most one table, with the metrics
  composed above the chart (a dashboard's KPI row over its charts) is composed again with the metrics (and the table) in a column of
  about a third of the width and the chart in a full-height track beside it (the chart track of LH-49, 67% then 60% of the content
  width; a layout slide is recomposed as the automatic grid, `recomposed.kpis`). It is kept when the plot is at least as tall and the
  slide reads as well; a table that would be smaller in the column keeps the layout's arrangement.
- **Value color on dark (LH-57).** On a dark slide or card, a value whose accent falls under 4.5:1 against the surface is drawn in the
  light text color (`metricValueColor(color, background, text)`) instead of a lightened accent, so the number stays the strongest
  element. A unit on its value's line takes the value's color.

## Media tracks and the reading measure

Automatic composition (no layout, no promoted regions, no `columns` or `weights` of the slide's own) gives a picture or a chart a track of its own and keeps paragraphs on a readable measure (layout harvest LH-80, LH-49, LH-66). The rules read block kinds, counts and measured sizes, never a slide id, and mirror in a right-to-left deck.

- **Picture track (LH-80).** A slide's one picture block among other blocks takes a full-height track at the slide edge, as an automatic `placement` (`item.image.placement.automatic`): cover-cropped with the LH-84 portrait focus and bled to the edges. It sits at the start side when it is the first block, else at the end side (the top or bottom of a portrait canvas). The headings and the other blocks compose beside it in the slide's own `mode`. The track is 50, 45, 40 or 35% of the slide; a track whose crop would keep less than half of the picture's width or height is not tried, so a panorama stays whole in the flow. A track is a frame the engine chooses for the picture and crops it by design, so a picture with `fit: "auto"` (LH-104) takes it as one with no fit does and is cover-cropped in it. Of the tracks that read as well as the slide without one (below), the one with the largest smallest body size is taken, then the one with the larger body sizes in all, then the one that crops least (a portrait picture takes a narrow track), then the widest. A block's own `fit: "contain"` or `"stretch"`, a `design.imageFit` of either, a frame shape or `aspectRatio`, an authored `placement`, a second picture or a video keep the composition as before: set `fit: "contain"` to show a screenshot or a diagram whole. The track spans the title band only when the title fits one line beside it (after LH-51's steps); otherwise the tag, title and subtitle take the full width and the track starts at the body top, still bled to its side and the foot (LH-116). A track that would wrap a table cell the slide sets on one line is not kept.
- **Short last row (LH-47).** The cells of the scored grid's short last row share the full width (two pictures and a paragraph draw a row of pictures over the paragraph, not a 2 x 2 grid with an empty cell); a grid of pictures and videos only keeps one cell width.
- **Chart track (LH-49).** A slide's one chart block among other blocks (no picture, no `design.chartPrimary`, which stays the author's) whose plot is too short takes the filling track: the root's first column when it is the first block, else the last, 60, 55 or 50% of the content width (the first that reads as well) against a column of the other blocks in the slide's own `mode`, as `chartPrimary` splits it. A plot is too short under the larger of 120 reference pixels and 22% of the body's height, or when it is more than three times as wide as tall. `chartPlotBox(item, scale)` is the plot as the engines lay it out: the chart box less the chart layer's header row, the padding, the label rows and the value axis labels.
- **Reads as well.** A track is kept only when the slide has no more overflow or small cells, no more words split, no more paragraphs under the minimum measure and none on a shorter measure than before, and no block's body size smaller: a new arrangement never costs the text its size. Only a slide that overflows without it may trade size, to leave fewer findings, and never below the readability floor. Otherwise the slide is composed as before (an authored `row` of four narrow blocks keeps its row). `geometry.track` (`kind`, physical `edge`, `size`, the block's `path`) says which track was taken.
- **Reading measure (LH-66).** A paragraph of four lines or more in a cell narrower than 28 average characters of its fitted size (`MIN_MEASURE_CHARS`) has too short a measure. The `auto` grid adds 20 to a candidate's score for each such paragraph (`narrowMeasure` in the explanation's penalties), and a `grid` with no `columns` of its own takes fewer columns until its paragraphs keep the measure. The grid chosen with the measure is kept only when it reads as well as the grid without it (no block smaller, as above). Labels of a line or two and lists keep their grid.
- **Bar chart share (LH-120).** In a row of three blocks, a horizontal bar chart (`bar`, `stacked-bar`, `100pct-stacked-bar`) takes 40% of the row and the other two 30% each, because its category labels sit beside its bars and take their width from it. It is a guarded rule (`bar-chart-share`): kept only when no block reads smaller. In the preview a category label wider than its gutter (30% of the chart, or up to 40% for its longest word) wraps onto two lines at a space, even where its row is shorter than two full lines (it reaches into the gap between bars), before it is ellipsized.

A layout that leaves a chart's plot shorter than its minimum (a wide chart region drawn on purpose keeps its proportions) is composed as the automatic grid when that draws the plot taller and reads as well; `recomposed.chart` holds the shortest plot of both, in reference pixels (see [Layout templates](layout-templates.md#recomposition-at-the-readability-floor-lh-83)).

## Rows shared across kinds (LH-115)

Two blocks that list the same keys in the same order share their rows (layout harvest LH-115, extending LH-18's shared row tracks across kinds). Each rule only moves marks within boxes composition already gave, or composes the slide once more under the size guard, so it never costs a block its size.

- **Bars on a table's rows.** A horizontal bar chart beside a table whose first-column keys are the chart's categories in the same order draws each bar beside its key: the plot spans the table's body rows (from the first row's top to the last row's bottom) and each category is centered on the middle of its key cell's text (`item.chart.layer.rows`, core `alignBarRows`). Only when those rows fit in the chart's box below its header row and above its value labels; otherwise the chart keeps its own plot. The PPTX export writes the plot area over the same rows (an inner manual layout); PowerPoint spaces categories evenly over it, so on rows of unequal height a bar sits off its key by at most half the difference.
- **A timeline under its column chart.** An automatic slide of a timeline and a column chart (no layout, no `mode`, `columns` or `weights` of the slide's own) whose events' `when` values are the chart's categories in the same order is composed again with the chart above and the timeline as one band under the plot: each event's marker and labels sit under its column, mirrored right to left with the columns. It is kept only when it reads as well as the slide without it; the timeline stays listed first when it was written first.
- A list with one entry per bar category is not merged into the bar labels: as sublabels at the chart text size its entries would be smaller than the list (32 px against 16 to 20 px on the mixed corpus's m28), which the size guard forbids.

## Grouping blocks before placing them

Composition groups a slide's blocks before it places any cell (layout harvest LH-58, LH-82, LH-73, LH-46, LH-47). The
rules read the blocks' kinds, counts and text lengths, never a layout or slide id, so they hold for any count, any content
kind and right-to-left decks; a slide that pins a block to a region, or sets its own `composition.mode`, `columns` or
`weights`, is composed as written. `repeatedPairs`, `majorityKind` and `groupBinding` (on `/composition`) expose them.

- **Repeated pairs.** A sequence that repeats one pair of kinds, a figure (metric, chart, table, picture, video or code)
  and a paragraph in either order, or a long and a short paragraph (one at least twice the other's length, the long one
  on the same side of every pair), two pairs or more, composes as one cell per pair. A pair is one row of its two blocks
  when each half of its cell is at least 0.8 of the cell's height wide (a metric beside its note), else one column (the
  figure above its text), half a gap apart. Metric, text, metric, text is two cells, not four.
- **Group by kind.** With no layout, interleaved blocks of two kinds with unequal counts (chart, text, chart, text,
  chart) are one column of a grid of the majority kind above a row of the others (up to three side by side), each at
  the height it needs. On a layout, a region's grid keeps the kinds it accepts and the other blocks join the region that
  accepts them, in one row under the grid that asks for at most 30% of the content box (see [Layout
  templates](layout-templates.md#grouping-before-placement-layout-harvest)).
- **Extra blocks in fixed regions** join the grid at the sibling size instead of a slim full-width strip below it:
  pictures as a row, then a lead picture beside a mosaic, cover-cropped; the columns of `comparison` as N columns;
  `statement` as a lead over a row of cards (see [Layout templates](layout-templates.md#grouping-before-placement-layout-harvest)).
- **Balanced grids.** A region's grid of 7 to 12 blocks has balanced rows (7 as 4 + 3, 9 as 3 x 3), and the cells of a
  short row stretch to the full width, except in a grid of pictures, whose cells keep one size and center.

Grouping changes the order of the composed items to the order of the cells (a pair's two blocks together; the majority
grid before the others), which is the reading order the preview, the PPTX export and accessibility use.

## Reading measure, alignment and leads

These rules (layout harvest LH-70, LH-72, LH-67, LH-78) read block kinds, counts and text lengths, never a layout or slide id,
and apply in automatic composition and in a layout's regions alike; a right-to-left deck mirrors them. A slide's own
`composition.mode`, `columns` or `weights`, and `design.contentDirection`, keep their arrangement.

**Readable size wins over the ideal measure.** These rules are held to the size guard above: a result with them is kept only when
no block's fitted body size is smaller, or when it reports fewer findings; otherwise each rule is tried on its own and the ones that
pass are kept. LH-72's start alignment and sibling quotes sharing one size are always applied.

- **Paragraph columns.** Three to six sibling paragraphs of similar length (100 to 240 characters each, the longest less
  than twice the shortest) are parallel items, so they are set as a grid of columns 45 to 65 average characters wide, when that
  is as large as their own arrangement. The shapes have 2 to 4 full columns (3 as 2 + 1 or a row; 4 as 2 x 2, 3 + 1 or a row;
  6 as 2 x 3 or 3 x 2); each takes the largest size of the type scale at which its narrowest column keeps 45 characters and its
  rows fit, and the largest wins. On a wide slide that is two columns at 21 or 24 px; three columns at a 45-character measure
  exist only at the floor, so three paragraphs usually keep their own arrangement. `explain` reports `paragraph-columns`.
- **Centered layouts center only short text.** When the content alignment is `center` and comes from the layout record or
  the theme, a paragraph or list over two lines or 120 characters is start-aligned in a column at most 65 characters wide,
  centered in its cell, and its siblings follow it. An alignment the slide or the deck sets is the author's and is kept.
- **Lead plus stack.** Of three to five sibling texts or quotes, a paragraph of at least 100 characters, at least 2.5 times
  the median length of the others and twice the next longest, leads: a cell 55% of the width at full height, a text starting
  at the lead size (32 px), beside a stack of the others at one size. A chart or picture with two compact siblings (metrics, or
  texts and quotes of at most 120 characters) leads at 58%. The lead sits at the start unless it is the last block. A
  `flow: grid` region keeps its grid. `explain` reports `lead-stack`.
- **Quotes beside other blocks.** A quote beside a block of another kind, or one of three or more quotes, starts at the
  lead size and steps down until it takes at most four lines (never below the 28 px body size), on a card that hugs it, when
  that makes no quote smaller; otherwise it keeps its size, on a card when the card costs no size. A card the slide does not
  otherwise draw is left out when it would make the quote overflow. A lone quote, and one or two quotes alone on a slide, keep
  the 40 px display size. Sibling quotes in one row share one body size; a row of wider cells keeps its own.
- **Quotes under data: the pull line (LH-114).** A quote of 140 characters or fewer that shares the slide's root `blocks` with
  a table, a list of three or more entries, or two or more other blocks is drawn across the body as its own row: an 80 x 6 px
  accent rule in the primary color at the start edge, the quote at the lead size (32 px, stepping down to 28 px to take at most two
  lines) in the regular weight, and one caption line "— Name, Role" (the source after an en dash) under it. It is the last row when
  the quote is the last block, and the first row under the headings when it is the first block of an automatic slide; the data takes
  the full width beside it, and in a layout the quote is bound to no region. The data and the pull line are one stack at the top of the
  body: the pull line sits one gap under the lowest content (a table's last row, a text's last line, a card's edge, a chart's box), or
  one gap above the highest, and the body is not centered (LH-52, LH-48), though LH-48 still grows the data. LH-06's band stays at the foot. A quote beside one compact block (a metric, a chart, a
  short text, a list of one or two entries) keeps its card, as does a quote in the middle, one of several quotes, a quote with a
  photo, a region pin, a caption or `emphasis: true`, a quote that needs more than two lines, and a slide with an arrangement of its
  own. The quote layout reports the rule as `quoteLayout.rule`; the preview draws it as a rectangle and the PPTX export as a tagged
  native rectangle (`OPF quote rule <group>`) that import consumes with the quote.

## Check-mark tiles (LH-137)

A slide set apart on a dark surface of its own (its `design` sets a variant or background, and the slide is dark; a deck that is dark throughout keeps its lists) whose whole body is one bulleted list of two to six entries of one level, with no descriptions and each 90 characters or fewer (`CHECK_TILE_MIN`, `CHECK_TILE_MAX`, `CHECK_TILE_MAX_CHARACTERS`; a summary of decisions or outcomes), draws each entry as a tile of a grid that fills the body, with a check mark badge at the entry's start (the right in a right-to-left deck) in place of its bullet, as Claude Design draws a closing list of decisions. The grid is one row for three or fewer, two columns for four, three for five or six; when an entry would take more than two lines there (`CHECK_TILE_MAX_LINES`), one column of wide tiles (three columns become two for five or six). The entries keep the list's size; when one does not fit its tile at it, the list stays as it was. A numbered list, a list with a caption, a card or an emphasis, a list of a `sequence` region and a deck with its own list marker (`design.listBullet`) keep their own drawing. Composition reports the tiles as a step sequence (`result.steps`, form `tiles`): `chips` (one per entry, its text the list column of the same index) and `badges` whose `check` is core `checkMarkPoints(cx, cy, diameter)`, a polygon both engines fill in the badge's numeral color (PPTX: an accent ellipse and a custom geometry, tagged as LH-07's badges are and consumed on import).

## Emphasis surface (LH-06)

A slide has at most one emphasis surface: a contrasting card or band that carries the slide's takeaway. `emphasis: true` on a block or a group (at any depth) puts it there; the first one in reading order takes the surface, any other is drawn without it and reported as the composition diagnostic `emphasis-ignored`. The surface is the block's or group's cell, drawn as a card; nothing on it takes a card of its own, and a group's children are arranged inside the card's inset.

Without an authored emphasis, two automatic rules read the slide's root `blocks` (with a layout or without):

- a **foot band**: a last block that is plain text of 60 characters or fewer, after blocks that are all longer (any other kind, or text over 60 characters), is drawn as a full-width band at the foot of the body. A takeaway of up to 120 characters is a foot band too when the blocks right before it are two or more charts or tables (LH-06, widened); a note between two charts reads as the first chart's note and keeps the 60-character rule;
- a **pill**: a last plain text of 30 characters or fewer after one long text (over 60 characters) is drawn as a pill one gap under that text's last line, hugging its one line at the start of the text's column (the right in a right-to-left deck); where that leaves no room it is drawn at the foot of the body.

The body above composes in what remains and the band or pill text is the last item. Neither costs a block its size: `composeSlide` also composes the slide without it, starts the band or pill text at least at the size the block fitted at there, and keeps the band or pill only when it leaves fewer findings (`text-overflow`, `small-cell`, `layout-unplaced`), or as many and no body block smaller (a text or list, any visible part of a quote, code panel, metric or timeline, a table's smallest cell). A band or pill taller than 30% of the body is not drawn. `emphasis: false` keeps a block out of both rules, and a slide with an arrangement of its own (a `composition` mode other than `auto`, `weights` or `columns`) takes neither; a block with a region pin, a caption or any payload besides `text` never takes them.

LH-131: without an authored emphasis or a band or pill, a **featured card** reads the slide's root blocks too (core `featuredCells`, from content only, never from an id). The cells are the root blocks that are groups (a group's label is its first block when that is a text, or its first metric's label) or metrics (their label), two to six of one kind:

- a **pair**: two cells whose labels (four words and 40 characters or fewer) name opposite sides, before and after or a problem (a challenge) and its solution, in English, German, French, Spanish, Portuguese, Italian, Dutch, Polish, Russian, Turkish, Arabic, Hebrew, Korean, Japanese or Chinese ("After", "Nachher", "Après", "بعد", "導入後"; "The solution", "Die Lösung", "الحل"). The cell naming the second side is featured, wherever it stands;
- a **set**: exactly one cell marks itself as the featured tier in its label, a short text or its metric's label or description (80 characters or fewer; a list's entries are not read): "recommended", "most popular", "best value" and their words in those languages ("empfohlen", "más popular", "おすすめ", "推荐", "الأكثر شيوعا").

The featured cell is drawn on the emphasis surface (`source: 'featured'`), and every other cell of the pair or set on one plain card (each block of a group shares its group's card), so the set reads as cards with one marked, as Claude Design draws a solution, an "after" or a pricing tier. In a design with cards, a cell's card is inset 12 px (`CELL_CARD_INSET`, the smallest inset of a block's own card) so no block has less room than its own card gave it; otherwise the card takes payloadBox's inset, and the cell asks for that room. A pair of before and after whose cells both hold a metric and stand side by side draws an arrow from the first card to the featured one, in the middle of the room between them (`emphasis.arrow` `{box, direction}`, `PAIR_ARROW_WIDTH` by `PAIR_ARROW_HEIGHT`, 40 by 28 px, at least `PAIR_ARROW_MARGIN` of a gap from each card), drawn as LH-07's flow arrows are (an accent `rightArrow` or `leftArrow`; a `leftArrow` in a right-to-left deck, where the "after" card stands left); when the cards stand closer, the slide is composed again with each card that much narrower on its inner side and kept only when no block reads smaller. An authored `emphasis: true` anywhere on the slide always wins, `emphasis: false` on the featured block keeps the slide plain, and the guard keeps the featured card only when no block reads smaller.

Composition reports the surface as `result.emphasis` `{ path, box, radius, shape: 'card' | 'band' | 'pill', source: 'authored' | 'foot-band' | 'pill' | 'featured', arrow? }` and marks every item on it `emphasis: true`. Its colors come from core `emphasisSurface(colorScheme, roles)`, which resolves a variant of the deck's own scheme through the layout-variant machinery (LH-01): on a light slide dark2, then dark1, then the accents; on a dark slide the accents in the slide's order, then light1; the first whose text reaches 4.5:1 on its fill and whose fill reaches 3:1 against the slide. Every text role on it under 4.5:1 takes the surface's text color. The preview and the PPTX export draw the surface under the first item on it and color those items with the surface's roles (PPTX: a tagged `OPF card <path>` frame with no line, recognized on import as decoration); `validate` measures their contrast against the surface.

## Nested groups

### Shared content cards

Shared content cards are published in core 0.10.0 and later, including the current core. For `design.contentBox: true`, each body leaf carries a `frameBox` at its outer allocation and a `box` padded inward by 12 reference pixels at a 720-pixel short edge, capped at one quarter of the frame's width or height. Scoring, accepted payload measurement, strict overflow and pagination all use that rounded interior. Headings remain unframed, nested groups keep their original padding, and explicit outer regions/track weights remain authoritative. Automatic candidates may change because their available content space changes.

Every composed item carries its resolved horizontal text `alignment` (`left`, `center` or `right`). The title, the tag (eyebrow) and a subtitle that sits in the title area (any slide whose layout has no `subtitle` region of its own) use `titleAlignment`; every other item, including a separate `subtitle` region, body text, lists, tables and metrics, uses `contentAlignment`. The value is the effective `design` key: the slide's design, then the deck's design (or the host's resolved deck option), then the theme's design, then the layout record's `design`. With no explicit alignment from those layers, metrics default to `center` and other items to `left` (LH-112: a metric beside one or two blocks of other kinds is start-aligned, unless the slide or deck sets `contentAlignment`); any resolved `contentAlignment` still overrides that fallback. A layout that sets `contentAlignment: center` therefore centers its content when no higher-priority layer sets the key. The title never inherits `contentAlignment`. On every slide, only a `contentAlignment` set on the slide's own design keeps the tag and the title-area subtitle apart (a deck or layout value does not), so a centered-content deck with left titles draws a left title, tag and subtitle over its centered content. Accepted outline placement and metric internals use the same value. The renderer and the PPTX exporter anchor preview and native text to `item.alignment`, so both engines place a layout's text the same way.

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

The parent allocates a box to each group, then the group arranges its children inside that box. Group padding defaults to zero; a group's own `padding` and `gap` use its shorter edge. A group without a `gap` of its own sets its blocks the slide's gap apart (0.25 in at 16:9, LH-89), reduced as any gap is when the group is too small for it; before, it was 1/30 of the group's own shorter edge, so the blocks of a short nested row nearly touched. The slide's gap is kept only when no block of the slide reads smaller than with the former gap (unless it removes overflow). Only `minFontSize`, `maxFontSize` and `overflow` inherit. A strict ancestor cannot be weakened by a child's `overflow: "warn"`. Font sizes remain relative to the canvas, not the group. Groups can nest up to 32 levels; cycles and deeper nesting fail with an explicit error.

Automatic grid scoring inspects descendant text using each descendant's explicit arrangement or geometric automatic seed. After selecting the parent's grid, it optimizes each child's automatic grid. This deterministic, bounded search avoids exponential combinations; it does not claim a globally optimal packing.

`result.items` contains every leaf with its full source path and effective composition. `result.groups` contains group paths, outer bounds, and content bounds. The editor's `setGroupComposition(path, value)` validates and records undo/redo just like slide composition edits.

## Inspecting and repairing layout

```js
import { composeSlide } from '@openpresentation/opf/composition';
const result = composeSlide(deck.slides[0], { width: 1280, height: 720, layout: resolvedLayout });
console.log(result.items);       // Source paths, content, geometry, and text estimates
console.log(result.diagnostics); // Path-specific text-overflow and small-cell messages
```

This pure function expects a validated slide. The caller resolves catalog records and passes the canvas size, `fontFamilies` and `textMeasurement`; `resolveSlideContext(deck, index, { fonts })` from the package root does the catalog resolution for one slide of a deck and returns those options, plus the slide to pass (`context.slide`, with the slide-scoped built-ins substituted). The rendering and export packages perform those steps at their boundaries. No network, DOM, system font, or AI dependency is required.

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

`resolvedOptions` supplies the same dimensions, layout, fonts and optional width provider as the preview. Core 0.8.0 identifies its explanation as `grid-score-v2`; core 0.9.0 advances to `grid-score-v3` to include complete code metadata/body measurements. Current core reports `grid-score-v9`. These versions record containers in parent-before-child order. `lowest-score` reports the candidates actually tried; `configured-mode` respects resolved row/column/grid intent and returns no invented candidates. `promoted-regions` leaves region placement fixed and has no selected column count. `table-width` (LH-44) says the grid of `selectedColumns` (the lowest score, or a `grid` composition's own count) gave a table a cell narrower than its words (`TableLayout.minimumWidth` at the starting size), so the container instead placed the table at its natural width (`naturalWidth`, at most 65% of the area) beside a column of the other blocks, or across the whole width between a row of the blocks before it and a row of the blocks after it, whichever scored lower; its `candidates` are the grid's. `split-fill` (LH-71) says two or three automatic blocks took one row or one column (`selectedColumns`) instead of the scored grid because it fills more of the body; its `candidates` are the scored ones. An explicit `columns` or `weights` is never replaced. In one row of automatic blocks a table asks for its natural width (at most 65% of the row) as long as its neighbors keep their fit, and in a `row` composition it takes at least the width its words need. Empty slides have no decisions. Automatic search tries one through `min(slotCount, columns ?? 6)` columns, in ascending order; ties retain the first candidate. Reserved placeholders count as slots. The schema caps an explicit candidate limit at twelve columns.

Each candidate has `columns`, `rows`, `score` and additive `penalties`:

| Penalty | Rule |
| --- | --- |
| `cellProportions` | Sum of `abs(log(cellAspect / 1.6))` for descendant leaves |
| `fontReduction` | Reduction from the role size (28 reference pixels for prose, 32 for lists, 25 for tables) for text-like leaves; current quote/code/metric/timeline layouts sum requested-minus-fitted sizes across their parts, divided by canvas scale |
| `textOverflow` | 1,000 per overflowing text-like leaf or complete quote/code/metric/timeline payload, regardless of the number of internal failure reasons |
| `tableOverflow` | 1,000 per table whose shared cell layout overflows: its rows do not fit at the floor (a row is never shorter than its text at the floor plus its insets; LH-44) or a word is wider than its column at the floor |
| `smallCells` | 100 per leaf narrower than 100 or shorter than 60 reference pixels |
| `emptySlots` | 2 per unused position in the candidate grid's final row |
| `narrowMeasure` | 20 per paragraph of four lines or more in a cell narrower than 28 average characters of its fitted size (LH-66) |

Scores are preference costs, not quality percentages or guarantees. Floating-point summation can make the component total differ slightly from `score`. Parent scoring uses descendant explicit arrangements or geometric automatic seeds; child automatic grids are optimized only after selecting the parent. Candidate scores therefore describe the bounded search, not a full assessment of the final optimized subtree. Heading fit remains in ordinary diagnostics, outside body-grid scoring. A strict-fit rejection exposes the explanation on `OPFCompositionError` when requested.

`textMeasurement` is `estimated` without a provider and `provided` with one. A provided width function does not establish font provenance, glyph coverage, shaping or native raster fidelity. Text, rich text, lists, quotes, table cells and code in core 0.9 participate in the fit model. Current core 0.11.0 also measures metric and timeline parts; its `unmeasuredPayloads` identifies images, video and charts whose complete internal layout is not assessed. Core 0.8 reports code as incomplete; core 0.9 measures its filename/language/body and insets. Media aspect ratios, chart labels and complete timeline visual density still require inspection. A zero score or empty diagnostics is not proof that those payloads fit.

Explanations expose the search for inspection and do not silently paginate or rewrite a document. Published editor 0.8.0 provides guarded track resizing, block moves, creation/removal and explicit pagination with preview/undo. A general automatic repair loop, automatic weight allocation, complete payload-internal measurement, CLI explanations and a canvas **Auto arrange** preview/undo operation remain open work; the **Arrange** controls below are explicit human adjustments.

With `overflow: "warn"` (default), the result retains all text and returns diagnostics. SVG emits all lines and marks overflowing groups with `data-opf-overflow="true"`; text may extend beyond its box or canvas. Consumers can collect diagnostics using `onDiagnostic`. No overflow is silent (LH-45): a quote, code, metric or timeline part that reaches past its cell (its card, when it has one) is a `text-overflow` diagnostic at the part's path, also when its own layout accepted it in a taller box (a metric laid out at its row's shared height). A quote, code or metric part that finds no usable space at all (its `invalid-part-box` diagnostic) is laid out at the readability floor in the room its cell leaves (`floorFallback`), so the preview and the PPTX export draw it, overflowing, instead of failing (LH-40). With `overflow: "error"`, the layout rejects content that does not fit. Shorten the affected content, give it more space, or explicitly split it into another slide. Use the explicit pagination transform below to produce additional editable slides.

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

**Continuation in the export (LH-90).** `continueOverfull(presentation, options)` is the one split the export makes without being asked. A slide whose body is two or more block units (`blockUnits(slide)`: every root block one payload, nothing else to move; a unit starts at each block of the first block's kind and takes the blocks after it, so eight timelines are eight units and a timeline keeps the note that follows it) and that the engines draw with `text-overflow` or `small-cell` at its own readability floor continues on further slides. It is `paginateSlide` with `wholeBlocks: true`: breaks fall only between units, never inside one; the pages are the fewest that fit, with the units spread evenly when every page still fits (eight timelines that fit five to a page are four and four); every page keeps the headings, layout and design (pagination's convention), the speaker notes stay on the first, ids take `--2` suffixes, and a page is bound by the layout as the first is (a moved block gets no region pin, so each page can recompose at the floor). The pages are composed at the slide's own floor and keep its `composition` as authored. A slide is kept as written when it fits, when a unit does not fit even alone, when its composition is strict (`overflow: "error"`, which the engines still refuse) or when `{{deck.slideCount}}` does not settle. The result lists every slide it changed (`continued`: source index, output indices, kind, block indices and units per page, page mappings). The Node export (`convert`, `opf convert`) runs it by default (`paginate: "blocks"`) before drawing, so the SVG, PNG, PDF and PPTX draw the same deck, and reports each slide as `render/slide-continued` or `pptx/slide-continued` and in the report field `continued` (one-based). `paginate: true` (`--paginate`) splits every overflowing slide instead; `paginate: false` (`--keep-slides`) draws every slide as written. `toSvg` and `toPptx` draw the deck they are given slide for slide; a host that wants the export's pages calls `continueOverfull` first.

**Continuation in hosts that draw slide by slide (LH-99).** `continuationPages(result, slideCount)` maps a `continueOverfull` result back to the source: `pages[i]` lists the output indices that draw source slide `i` (one for a slide kept as written). The player, `<opf-deck>` and its server markup (`toHtml`) show a continued slide's pages as steps after it, each the export's own page; the editor edits the slide as written and shows the split as a preview (a stacked thumbnail with its page count, a page indicator with a read-only preview of each page on the canvas, and the pages as steps in its presenter). No host shifts a source index: slide numbers, links, selection, `goto(n)` and the editor's slide paths address source slides, and the pages are sub-steps of their slide. Each host can turn it off (`continuation: false`, or `continuation="off"` on `<opf-deck>`). See the opf-render and opf-editor READMEs.

The editor's `editor.paginateSlide(index)` is one validated transaction with undo/redo. It returns `{change, pagination}`. Editor 0.5.0 commits a one-page readability-policy change too; repeating the operation after the policy is recorded returns `change: null`. The playground includes an overflowing draft and **Split overflow** action. The CLI writes a new file and refuses to overwrite an existing one:

```sh
opf paginate input.opf.json output.opf.json
```

## Right-to-left decks

When the presentation `language` is written right to left (Arabic, Hebrew, Syriac, Thaana and the other right-to-left scripts) or the host passes `direction: 'rtl'`, `composeSlide` mirrors the composition and reports each paragraph's direction; `SlideComposition.direction` is `'rtl'`. The first column and the `left` region are drawn at the right, banded slide images, cover logos and header/footer zones swap sides, lists put their markers at the right, tables run right to left, and `TextFit.directions` gives the direction of the paragraph each line belongs to. Alignment is logical: the authored `left` is the start edge, drawn at the right edge of a right-to-left paragraph (`physicalAlignment`). A left-to-right deck composes exactly as before. The rules and the PPTX mapping are in [Layout direction](programs/font-fidelity-everywhere/script-font-model.md#layout-direction-rr-05).

## Fidelity boundary

The shared engine provides identical body and heading geometry to SVG and editable PPTX export. Text measurements default to deterministic estimates. For actual font advances, pass the same `fonts` handle to every step (see [pass `fonts`, otherwise the estimate](font-fidelity.md#pass-fonts-otherwise-the-estimate)). Complex scripts, fallback fonts, PowerPoint text rendering, rich text, charts, tables, and images still need visual verification. Dynamic composition is not a guarantee of pixel-identical PowerPoint output. Line breaking never splits a number from its unit or `%` (`26 %`, `$4.8 M`, `12 km`, `3 x`, `5 pm`, and the digits of one figure) or a ratio at its slash (`4.6 / 5`, `3/4`, LH-150; a metric value written so is one figure, LH-39) and never starts a line with a closing mark (`. , ; : ! ? ) ]`, a closing quotation mark, their CJK and Arabic forms) or ends one with an opening mark (LH-11, `src/line-break.ts`); the rule reads characters, so it holds for right-to-left and CJK text, and a unit outside its lexicon is bound with a no-break space (U+00A0), which the breaker already keeps whole. Where PowerPoint wraps the text itself (native titles and bodies, table cells) the export writes U+00A0 at the same places (`bindNoBreak`) and import writes the spaces back (`unbindNoBreak`), so PowerPoint breaks where preview does. List density includes rich runs, descriptions and nesting via `fitList`, with the same hanging indents used in preview and export. Only text-like payloads currently receive content-density estimates; small-cell diagnostics also cover non-text content.

SVG embeds raster data URI images locally. Remote and file images require a host resolver that supplies a raster data URI; otherwise they appear as placeholders. `strictAssets` rejects unresolved images. The runtime never fetches them.

See [the complete example](../examples/technical/dynamic-composition.opf.json) and [local ecosystem verification](ecosystem-development.md).


## Preview polish shared by preview and export (RR-07)

Three accepted spec fields used to be drawn plain; core now owns the shared tables so the SVG preview and the PPTX export draw them identically. Consumers import them from `@openpresentation/opf`; none changes geometry, and an older core simply leaves the preview and the export plain, without a new diagnostic.

- **Code syntax colours.** `tokenizeCode(source, language)` returns sorted, non-overlapping token ranges (`keyword`, `string`, `number`, `comment`, `function`, `type`, `property`) over the exact `code.source`; `codeLineRuns(tokens, start, end, source?)` clips them to one accepted source line, so concatenating the runs returns the line unchanged (a tab is always its own plain run). The scanner is deterministic and dependency-free (no network, clock or locale). `code.language` resolves through aliases (`ts`, `tsx`, `py`, `sh`, `yml`, `c++`, `terraform`, and so on) to `javascript`, `typescript`, `python`, `rust`, `go`, `bash`, `json`, `yaml`, `toml`, `ini`, `html`/`xml`, `css`, `sql`, `java`, `csharp`, `kotlin`, `swift`, `ruby`, `php`, `c`/`cpp`, `hcl` and `dockerfile` (`resolveCodeLanguage`, `CODE_HIGHLIGHT_LANGUAGES`); any other language, a missing one, or source over 200,000 characters stays plain. `codeSyntaxPaletteForScheme(colorScheme)` gives one colour per kind from the deck theme (keyword = primary, string = accent, number = secondary; comment, function, type and property are fixed slate, blue, cyan and pink, rotated away from a theme colour they would collide with), each lightened until it is at least 4.5:1 on the #111827 code panel. The renderer nests coloured tspans inside each accepted segment tspan; PPTX writes the same colours as native runs in the same one-text-box-per-line shapes, so editing and import are unchanged. The language is not inferred from `code.filename`. `code.highlight` (1-based source lines and inclusive ranges) adds a band behind marked lines and dims the rest: `codeHighlightLines` resolves it against the source, `codeLineNumbers` numbers each displayed line (a wrapped line repeats its number), `codeHighlightBands` returns the runs of displayed lines to draw behind, and `codeHighlightColors(colorScheme)` gives the band and the marked/dimmed palettes, all at least 4.5:1 on what they sit on. The SVG band is one `rect` per run behind the line text; PPTX writes one native rectangle per run (`OPF code N highlight M`) after the panel and before the line text boxes, so the one-text-box-per-line shapes and the code provenance tags are unchanged.
- **Metric trend.** A `metric.trend` (`up`, `down`, `flat`) is drawn as one arrow; LH-53: the trend word is not drawn (it was an English word on every slide, a right-to-left one included) and stays the arrow's text alternative and the part's source. Core's metric layout places the arrow (`MetricLayout.trendBox`: square, 0.72 of its line's size, on the baseline, 0.3 of that size before the line) before the delta on one line ("↑ +7 pts"), or, with no delta, before the label, else the description, else on a line of its own; before means at the reading start, the right of a right-to-left metric. `metricTrendMark(layout, {background})` gives it its shape and color. The arrow is the DrawingML `upArrow`, `downArrow` or `rightArrow` preset at default adjustments (`metricTrendPoints` is the outline the preview draws), colored by the metric's `sentiment`: positive green, negative red, neutral a neutral color, kept at 4.5:1 or more against the slide background (`metricTrendColor`); the delta text takes the same color. `layoutMetric` passes `sentiment` through as `MetricLayout.sentiment` (omitted when the metric has none) and `metricTrendMark` reads it, so the arrow direction always follows `trend` and only the color follows `sentiment`. Absent, the sentiment is the conventional reading of the trend (up positive, down negative, flat neutral), which is the color drawn before `sentiment` existed. A `sentiment` without a `trend` draws no arrow and colors nothing. The arrow carries the alternative text "Trend: up" (`aria-label` in SVG, `descr` in PPTX); the arrow carries the direction, the color the verdict.
- **Pattern fills.** `PATTERN_PRESETS` lists the 54 ECMA-376 ST_PresetPatternVal names and `patternBitmap(preset)` / `patternRuns(preset)` give each as an 8 x 8 one-bit tile, one pixel per 1/96 inch, anchored at the slide's top-left, foreground where a bit is set (`diagStripe` still resolves to `wdUpDiag`). ECMA-376 names the presets but does not define their pixels: the tiles are measured from desktop PowerPoint (Office 365, Windows, 2026-10-01) by exporting each preset as a full-slide background to a 1280 x 720 PNG and voting every pixel into its (x mod 8, y mod 8) cell with opf-render `scripts/derive-pattern-bitmaps.mjs`. Every tile was uniform across all repeats (confidence 1.00) at one image pixel per pattern pixel, so a pattern pixel is one 1/96 inch unit, and the phase is the slide's top-left corner. The tool also reports any tile that later differs. PPTX already wrote every preset as native `a:pattFill`.

## Metric internals (published coordinated packages)

Published core 0.11.0 exports `layoutMetric(value, box, options)` from `@openpresentation/opf/composition` (the package root no longer exports engine names). It accepts a finite number, string, or `{value, unit?, label?, description?, delta?, trend?, sentiment?}`. Renderer 0.9.0, editor 0.8.0 and PPTX 0.9.1 consume its shared geometry for composition, atomic pagination, preview, editing and export. Core 0.9.0 predates this API. The [primitive checkpoint](plans/shared-metric-layout.md) and [source integration checkpoint](plans/shared-metric-integration.md) record its development; current pins and remaining native/font gates are in the [compatibility matrix](compatibility-matrix.md).

Pass the allocated reference-pixel `box`, resolved heading/body `fontFamilies`, `textMeasurement`, canvas `scale`, effective `minFontSize`, source `path` and optional `overflow: 'error'`. `metric-flow-v1` returns separate value/unit/label/description/delta/trend parts in that order. Numeric zero is visible; scalar values keep the scalar path. Every provided field retains its original string or number in `sources[].value`. Source ranges address `String(value)` using UTF-16 offsets; the original spelling of a numeric JSON token is not available. No locale formatting, trend icon, case conversion or separator is invented. Empty optional strings retain source mappings with `visible: false`; the required empty value keeps a targetable blank line.

The allocator tries an adjacent value/unit baseline when both fit one line and the unit uses at most 35% of the cell width; otherwise it stacks the fields. Metadata has an eight-reference-pixel gap, with twelve pixels after the primary row. Related fields stay together rather than being separated by a percentage of the cell height. The value starts at up to 76 reference pixels (28% of cell height); label/unit/delta start at 23, description at 20 and trend at 18 (the trend part is not drawn, LH-53; its arrow sits before its host line, which is measured that much narrower). LH-53: a unit beside its value is drawn at 60% of the value's size (`METRIC_UNIT_SHARE`) on its baseline when that still fits, so "18 %" reads as one figure. A candidate with more reduced metadata replaces an earlier one only when it scores a whole reference pixel better, so on a near tie the label keeps its size and the value gives way. `display` (LH-112) and `band` (LH-15) are the options composition passes a metric beside other blocks (above). Every requested size is raised to the chosen floor, scaled once. Natural metadata height gets space before reducing type. At most 48 arrangements are evaluated, each with at most 77 value-size trials; identical inputs and a deterministic measurement provider select the fitting candidate with least summed font reduction, preferring the first candidate on ties.

Each part exposes requested/resolved styles and the same source-preserving line/segment representation used by code (`CodeTextFit`), measured with proportional heading/body fonts. CR/LF/CRLF, tabs, whitespace and grapheme boundaries remain exact. Consumers must reuse accepted line and segment positions, font sizes and styles rather than independently re-fit or normalize text. This API reports `provided` measurement when a provider is passed, without claiming that its glyph coverage or shaping is complete. Unsupported glyphs propagate the provider's error with the field path.

LH-137: `deltaPill: true` (composition passes it under the guarded rule `delta-pill`) draws the delta and its trend arrow in a pill, as Claude Design draws a change: beside the value's line (after the value and an inline unit in reading order, its middle `METRIC_PILL_RISE`, 0.36, of the value's size above the value's baseline; the value and pill are one line placed by the alignment) when every field keeps the size it has without the pill, else above the value (its lead) when every field keeps it there, else in its place without a pill. A tile and a band keep their delta in place, and LH-83's automatic grid at the floor draws no pill (the room a pill frees there would decide between the layout and the grid). The pill is inset `METRIC_PILL_PAD_X` (0.55) and `METRIC_PILL_PAD_Y` (0.2) of the delta's size around its one line and arrow; `MetricLayout.deltaPill` `{box, radius, placement}` says where. Sibling metrics draw their pills one way: when one has its pill above, a sibling with its pill beside takes it above too where that keeps its sizes. Engines fill it with core `metricPillFill(backdrop, text)` (the backdrop moved toward the text color, as a table's banded row is, `surfaceAltColor`) under the delta and color the delta and arrow against that fill; the PPTX export writes a native rounded rectangle tagged into the metric's group (role `pill`), consumed on import with the trend arrow.

LH-68: `tile: true` lays the metric out as a tile of its whole box, as a layout region with `metrics: "tile"` asks: the label first as an eyebrow, the value under it starting at `METRIC_TILE_VALUE_SHARE` (a quarter) of the box's height, between its 76 px role size and twice it, a stacked unit under the value, and the description, delta and trend at the foot of the box. Pass the start alignment with it. `minimumSizes` (by role, canvas pixels) is where each role starts at least and stops fitting; composition passes a tile the sizes its metric fitted at as a stack, so a tile never shrinks a role, and a slide whose tiles would still cost a size or a finding keeps its stacks.

Pass `align: 'left' | 'center' | 'right'` (default left) to the primitive. Its returned `alignment` and per-part `linePositions` give an absolute x origin and baseline for each `fit.sourceLines` entry, including blank lines. An inline value/unit pair moves together, with the gap following the actual value advance. Composition accepts host-resolved `contentAlignment`; an explicit slide `design.contentAlignment` overrides it. Renderer/export/pagination pass the effective design into the same operation. Alignment does not trigger a second font fit.

Check `overflow` before consuming parts. Irreducible text, invalid available space, parts outside the cell and overlapping occupied line boxes return field-specific diagnostics; strict mode throws `OPFCompositionError`. Invalid available boxes retain their dimensions and have no fit, unless `floorFallback` asks for a fit at the readability floor (LH-40). These are advance-based line rectangles, not glyph outlines: the controlled browser evidence separately records small glyph overhangs. The API is a bounded internal allocator, not the complete layout-repair/Auto arrange operation or a native export fidelity guarantee.

Current `grid-score-v9` retains the metric scoring introduced by `grid-score-v4`: every metric part contributes font reduction, with one overflow penalty per failing metric leaf. `item.metricLayout` is measured against the rounded accepted cell; `item.text`/`item.textStyle` alias the value fit/style. Field diagnostics obey strict ancestor policies, while explicit modes/weights/regions remain authoritative. Metrics are excluded from the advance-model `unmeasuredPayloads` list. Explicit pagination retains metrics atomically with complete source types/metadata and rejects irreducible fields without returning partial output. The published train has [installed-package acceptance](evidence/shipped-train-20260921/installed/acceptance-summary.json), including metric provenance controls. That evidence does not establish native raster or font equivalence.

## Code internals (core 0.9.0 and coordinated packages)

Core 0.9.0 introduced `layoutCode(value, box, options)` for the schema's string shorthand or `{source, language?, filename?}` object. It returns measured filename/language/body parts with exact original text, requested/resolved styles, readability floors, available boxes and diagnostics. Its original integration targeted renderer/PPTX 0.7.0 and editor 0.6.0; the [release checkpoint](plans/shared-code-release.md) records that rollout. These contracts were included in the core 0.11.0, renderer 0.9.0, PPTX 0.9.1 and editor 0.8.0 train; current pins are what `node scripts/registry-plan.mjs` prints. Core 0.8.0 predates this API and retains the [recorded code-label, filename and whitespace defects](plans/layout-repair.md).

`grid-score-v3` charges code font reductions across all metadata/body parts and one overflow penalty per failing leaf. It preserves explicit modes, weights, regions and source order. Accepted `item.codeLayout` is fitted to the same rounded cell exposed as `item.box`; `item.text` and `item.textStyle` alias the body, not the first metadata part. Strict ancestor settings apply to internal `.source`, `.filename` and `.language` diagnostics. Code no longer appears in `explanation.unmeasuredPayloads`, which concerns the core advance-based model only. It does not mean browser/native fidelity is verified.

Pagination slices the code body at grapheme boundaries, repeats filename/language and returns contiguous UTF-16 body ranges while preserving all source bytes and the evaluated readability floor. Irreducible metadata rejects all output, including when the body is empty or earlier content could have fitted. Consumers must preview/export the returned document. The [integration checkpoint](plans/shared-code-integration.md) separates source, installed browser, Windows PowerPoint and remaining release gates.

Each fitted part retains every space and explicit CR/LF/CRLF break. `fit.lines` contains exact source slices, and `fit.sourceLines` records half-open UTF-16 `start`, `end` and `nextStart` offsets, the measured width and a `soft`, `hard` or `end` boundary. A hard break occupies `[end, nextStart)`; soft wrapping consumes no source character. Joining `part.text.slice(line.start, line.nextStart)` reconstructs the original part. Blank lines and a final empty line are retained, and long tokens split only at grapheme boundaries. Filename and language text are not case-converted. An absent/empty metadata pair creates a generated `code` label with no source range.

`code-flow-v1` returns `bounds`, the panel the code needs at the allocated width (the insets around the metadata and the source lines, at most the cell); a composed slide draws the code panel at `bounds`, top-anchored, when the code is shorter than its cell. It uses 18-reference-pixel outer insets, an eight-pixel gap between filename and language, and a twelve-pixel gap before the body. Nominal metadata/body sizes are 14/22 reference pixels (WI-4: the body was 18), raised when necessary to respect the selected minimum, then scaled once. At most four metadata nominal/floor combinations are tried; each body fit tries at most 19 sizes regardless of canvas scale. The fitting combination with least font reduction wins. Irreducible metadata/body failures retain all text and diagnostic paths; invalid available boxes have no fit (a fit at the readability floor with `floorFallback`, LH-40). `overflow: 'error'` rejects rather than returning partial output.

Tabs remain literal characters in part text and displayed-line slices. Measurement advances to the next multiple of four measured spaces from that line's origin; `fit.tabSize` and `fit.tabWidth` expose the rule. Each source line's `segments` contains exact text/tab source ranges plus measured `x`/`width` values relative to its origin. Consumers must reuse those positions: an Edge probe showed that SVG treats a tab as one space despite CSS `tab-size: 4`. The published SVG renderer uses positioned spans and geometric precision; native export uses accepted tab stops. Width measurements and source preservation alone do not establish glyph-outline containment, shaping/bidi support or native fidelity. [Installed workflow evidence](evidence/shared-code-installed/summary.json) records the separate actual browser and native checks with their exact font/runtime scope.

Published native export stores source boundaries in standard PowerPoint shape tags. Complete unique groups recover exact code/source metadata, with current native text taking precedence. Missing, damaged or ambiguous groups retain visible native shapes and report diagnostics. Reimport does not reconstruct native formatting, positioning, font theme or readability policy. Eight installed-export wide/portrait slides pass native edit/save/reopen and all 24 original/saved/edited imports on the recorded Windows PowerPoint build; this is not arbitrary PowerPoint round-trip or pixel equivalence. The editor preserves untouched CRLF/CR source around edits and keeps committed preview geometry separate from its active native textarea caret.

The JSON schema can accept strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets). Published SVG/PPTX code output rejects forbidden controls, unpaired UTF-16 surrogates, U+FFFE and U+FFFF with `invalid-code-text`, the source field path and UTF-16 offset in the message. The input stays unchanged; the caller can correct that character explicitly. Tabs, CR/LF/CRLF and valid supplementary characters remain accepted for serialization. Schema support, format representability and glyph coverage are separate properties.

The controlled SVG harness requests `text-rendering="geometricPrecision"` as well as explicit segment placement. Initial Linux Chromium CI rounded glyph advances under default hinting, unlike Windows Edge with the same font bytes. The [SVG specification](https://www.w3.org/TR/SVG/painting.html#TextRenderingProperty) defines geometric precision as a rendering hint, so consumers still need actual browser checks with their exact fonts and supported environments; the hint alone does not certify agreement. The harness retains a 0.1-reference-pixel tolerance and records observations before assertions.

## Quote internals (core 0.8.0 and coordinated packages)

Core 0.8.0 exports `layoutQuote(value, box, options)` from the `@openpresentation/opf/composition` entrypoint. Pass validated quote content (object or string shorthand), its allocated reference-pixel box, resolved `fontFamilies`, `textMeasurement`, `scale` (canvas short edge / 720), effective `minFontSize`, `overflow` policy and its source `path`.

The result contains `parts` for the body and any nonempty footer, exact display `text`, source mappings, requested and resolved text styles, and the available boxes/fits. Source ranges use half-open UTF-16 offsets in both the source field and display string; generated quotation marks and the footer separator have no source range. The original content is never modified. A supplied width provider is reported as `provided`; it does not certify shaping or font fidelity.

Check `overflow` and `diagnostics` before accepting the parts. Invalid available dimensions remain visible with `fit` absent (a fit at the readability floor with `floorFallback`, LH-40), and `overflow: 'error'` throws `OPFCompositionError`. Diagnostics distinguish invalid part space, parts outside their cell, text that exceeds its reserved space, and overlapping line rectangles. Those rectangles are conservative text-layout bounds, not measured glyph outlines. The readability floor is scaled once and can raise the nominal body (28) or footer (17) size; it is never silently capped below the selected floor.

`quote-flow-v1` asks for a 40-pixel body (it fits down through 28 pixels to the readability floor; LH-78: `bodySize` sets another start, and `bodyLines` steps the start down until the body takes at most that many lines, never below 28 pixels) wrapped in the quotation marks of the deck language (`options.language`, a BCP-47 tag: “…” for English, „…“ for German, «…» for French and Spanish, 「…」 for Japanese, ASCII only for a language the table `QUOTE_MARKS` does not list; every mark is one UTF-16 code unit, so the body's source range starts at offset 1). It keeps 18-reference-pixel outer insets and an 18-pixel body/footer gap while fonts scale with the canvas. A 40-pixel footer is a whitespace preference. The allocator expands it for long sources or compacts it for dense bodies, trying at most the nominal and minimum footer sizes and selecting the fitting pair with least total font reduction. If neither fits, it returns floor-size failure diagnostics. This is a bounded internal allocation step, not a complete layout-repair engine.

`composeSlide` scores both parts and accepts geometry against the final rounded item box. Each quote item carries `quoteLayout`; its compatibility `text` field is the same fit object as the quote body, including generated quotation marks. Consumers needing original offsets must use the explicit `sources` mappings. The coordinated renderer and PPTX consume these parts without another measurement/style-resolution pass. Missing geometry rejects rendering/export rather than omitting content; a part with no usable space reaches them laid out at the readability floor (LH-40), so they draw it, overflowing, beside its diagnostic. This requires core 0.8.0 with renderer/PPTX 0.6.0; older core 0.7.0/renderer 0.5.1/PPTX 0.5.2 lack these changes. The complete published set, immutable verification refs and fresh registry evidence are recorded in [the release plan](plans/shared-quote-release.md).

Browser glyph bounds can extend slightly beyond advance-based part boxes into the reserved inset. Current loaded-font tests record those overhangs, verify glyph containment inside the full quote cell and check body/footer separation. Native PowerPoint fixtures separately verify text, sizes, cell containment, save/reopen and reimport. Neither test establishes universal pixel equivalence. Original requested-font provenance through host substitutions and non-quote payload internals remain open requirements.

### Quote role and photo (FA-12)

`QuoteContent` also takes `role` and `photo`. The footer text is the attribution, then `role` after a line break, then `source` after an en dash (` – `); each field keeps its own source mapping (`<path>.role`). Without a `role` the footer text is unchanged. A `photo` (an `Asset` value) adds `QuoteLayout.photo`: `{path, value, box, shape}`, where `shape` is the circle mask of `imageShape('circle', box)` (DrawingML `ellipse` and the same outline as an SVG path). The diameter is three times the footer font size and the gap beside it three quarters of that size, so the allocator picks the footer size (nominal or the readability floor) with the photo in the footer height and the footer text in the remaining width. The photo sits at the start edge of the inset area: the left, or the right when `options.direction` is `rtl`, where the footer text is its mirror. The text block is centered on the photo. A photo whose height cannot fit at the floor adds the `photo-fit` diagnostic reason (and `overflow`); a photo with no footer text still draws. Without a photo `layoutQuote` returns exactly what it returned before, with no `photo` key. The renderer and the PPTX exporter draw `photo` from the result and do not recompute it.

## Timeline internals

`layoutTimeline(value, box, options)` (`timeline-flow-v1`) places an optional name and description, then the events as a marker on a connector with each event's `when`, `what` and `description` as separate text parts. It has three arrangements, tried from the role sizes down to the readability floor (at most 100 candidates in all), and keeps the first that fits or the one with the fewest diagnostics:

- `band` (LH-41): one horizontal connector, each event one spacing (`box.width / events`, less a gutter) wide, its `when` as an eyebrow above the marker and its `what` and description below. This is the horizontal arrangement whenever every `when` and `what` fits its spacing on one line.
- `alternating`: labels alternate above and below the connector, each up to two spacings wide, for a `when` or `what` wider than one spacing (or a band whose labels would break inside a word).
- `vertical`: a marker rail down the start edge with the labels beside it, tried first when an event's spacing is under 8 ems of the label size. Right-to-left decks put the rail on the right edge.

A horizontal timeline centers its whole block (name, description and labels) in the box. `TimelineLayout.bounds` is what the drawn timeline covers (parts, markers and rings), so its height is the height the timeline needs; composition measures a timeline with it, label bands included, and stacks it like text (`MEASURED_FIELDS`).

**Several timelines in one region (LH-41).** A template region whose blocks are all timelines draws them as a stack of bands, whatever its `flow` or the design's `contentDirection`: one column while the stack fits at the readability floor with every band at least 56 reference pixels tall, otherwise two columns (in reading order, each row as tall as its taller band, an odd last band spanning both) when that overflows less. The stack sits in the middle of the region (at the bottom in a region anchored there), the bands share the region as stacked text does (`shareHeights`) and every band is set at the size the most squeezed one fits at. A band of a stack never turns vertical (`horizontal`), sits at the top of its box and sets its name and description at its start edge. With four or more timelines the bands are compact (`compact`: name 20, `what` 18 and the rest 16 reference pixels; each `when` and `what` on one row below the marker when every pair fits; the description beside the name when every band's pair fits). A stack that does not fit at the floor reports `text-overflow` for the parts outside their band. A lone timeline in its region grows its type by up to 4 reference pixels when it still fits in the same arrangement (`sizeOffset`).

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
- **Progress and status words (LH-121).** `TimelineLayout.progress` is the part of the connector from the first event to the
  `current` one (to the last `done` one when none is current; absent when no event is done or current); both engines draw it in the
  primary color over the border-colored connector. With `statusWords` (composition sets it under the size guard, for an English deck)
  each event with a status gets a word under its label, `Done`, `Current` or `Planned` (`TIMELINE_STATUS_WORDS`) at 16 reference
  pixels, in `TimelineLayout.statusLabels`: generated text with no `sources`, never in `parts`. `timelineTextColor` sets the current
  event's word in the primary color and the others muted, at 4.5:1. A timeline that would set its labels smaller to make room keeps
  them and draws no words; a deck in another language keeps the status in its markers and progress.
- **PPTX.** The marker is a native `ellipse` (solid primary fill for `done`, `current` and no status; background fill plus a primary line for `planned`), the ring is a second native `ellipse` (background fill plus a primary line), the bold label is a bold run, and planned text takes the muted color. The exporter records each event's status in the marker's `OPF_TIMELINE_V1` tag and the ring in a tag of its own, and the importer restores `status` from them; a deck whose marker or ring was edited away imports as ordinary text without status, like the rest of the timeline provenance. The progress line is a second native `line` (`OPF timeline <group> progress`) and each status word a text shape tagged `status`; import consumes both and reads the status from the markers. Status is also written in Markdown as a task-list prefix on the event line: `[x]` done, `[>]` current, `[ ]` planned.

## Resizing in the preview

Choose **Arrange** in the editor to reveal track dividers. Drag a divider to redistribute the space between adjacent columns (row/grid) or rows (column), including nested groups. Arrow keys make small changes; Shift makes larger changes. Escape discards a pointer draft. One drag creates one undo step, and no content is removed. Strict overflow rejects a resize that violates its fit constraints.

Resizing an automatic layout makes its chosen columns explicit as `mode: grid` with `columns`. This prevents the number of columns from changing under the pointer. The adjacent share clamps to 5–95%, with positive schema-valid weights. Other track proportions and unrelated document fields remain intact. Promoted regions retain their positions; their nested groups can still be resized. A v2 template’s region grid is changed by editing the template’s `columns` and `rows`. Flows with more than twelve tracks need grouping before the current resize controls can express all weights.

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
