# OPF audit: design and accessibility checks

`opf audit` and `@openpresentation/opf/audit` check an OPF presentation for the problems a schema cannot see: text that is hard to read, text that does not fit, pictures without alt text, content that is read out of order, fonts outside the deck's scheme, vague links, placeholder text and more. It complements `opf lint`, which covers syntax, schema, catalog, asset and host-contract rules; audit starts where lint ends and only runs on a document that already passes the schema.

Audit is read-only, local and deterministic. It fetches nothing (no images, fonts or catalogs), consults no clock and calls no model. The same document and options give byte-identical findings.

```sh
node packages/cli/dist/index.js audit deck.opf.json
node packages/cli/dist/index.js audit deck.opf.json --json
node packages/cli/dist/index.js audit deck.opf.json --rule text-contrast --rule missing-alt-text
node packages/cli/dist/index.js audit deck.opf.json --ignore chart-text-alternative --fail-on warning
node packages/cli/dist/index.js audit --list-rules
node packages/cli/dist/index.js audit --explain reading-order
```

```js
import { auditPresentation, auditSource, auditRules } from '@openpresentation/opf/audit';

const report = auditPresentation(document, { rules: { 'chart-text-alternative': 'off' } });
const sourceReport = auditSource(fileText); // findings also carry source ranges
```

## Report

The report has lint's shape. Every finding in `report.diagnostics` has a stable `ruleId` (`audit/text-contrast`), a `severity` (`error`, `warning` or `info`), a JSON Pointer `path`, a `message`, a `help` sentence and a `definition` link to the rule's section below. `auditSource` (and the CLI) add `location` (original-source UTF-16 offset and length, one-based line and column); a finding about a missing field is located at the object that lacks it. Beyond lint's fields a finding may carry:

| Field | Meaning |
| --- | --- |
| `category` | `accessibility`, `design` or `content` |
| `slide`, `slideId` | Zero-based slide index and the slide's id, when the finding belongs to a slide |
| `measured` | The numbers behind the finding: ratios, sizes, counts, pixels per inch |
| `fixes` | Suggested repairs (see below) |

`report.valid` is true when there is no `error` finding, `report.documentValid` is false when the document failed schema validation (its schema errors come back as `audit/invalid-document` findings and no rule runs), `report.counts` totals the severities, `report.rulesRun` lists the rules that ran, and `report.checks` states what was not measured: text widths are core's estimate unless the host passes `textMeasurement` (`estimated` or `provided`), background picture pixels are never read, image resolution reads only embedded `data:` images, and native PowerPoint rendering is not checked.

### Quick fixes

A fix is a suggestion that core never applies. A host such as the editor's Review panel shows it and applies it through its own undoable edit path.

- `kind: "patch"` carries JSON Patch operations (`add`, `replace`, `remove` with JSON Pointer paths). `safe: true` means the change cannot alter what the content says: for example switching a failing text colour to the colour the theme chose for that background.
- `kind: "focus"` names the field the author must fill in (`focus.path`, `focus.field`: `alt`, `title`, `text`, `link`, `language`, `fontSize`).
- `safe: false` patches change meaning or appearance and need a deliberate click, for example marking a picture decorative with an empty `alt`.

## Configuration

```js
auditPresentation(document, {
  rules: { 'text-contrast': 'error', 'slide-word-count': 'off' }, // severity per rule, or "off"
  ignore: ['font-family-count'],                                  // rules not to run
  only: ['text-contrast', 'missing-alt-text'],                    // run just these
  ignorePaths: [{ rule: 'text-contrast', path: '/slides/3' }],   // an accepted exception, by JSON Pointer prefix
  thresholds: { contrastNormal: 7, maxWordsPerSlide: 80 },
  textMeasurement,                                                // the host's measured fonts (or a function of the slide index)
  chartPalette: ['#0072B2', '#E69F00'],                           // the engine's chart colours
});
```

Rules are named by full id (`audit/text-contrast`) or bare name. An unknown rule, threshold or option throws a `TypeError` instead of being ignored, so a typo cannot silently disable a check. The default thresholds are exported as `DEFAULT_AUDIT_THRESHOLDS`; they are listed under each rule below.

The CLI takes the same settings as flags, or from an explicit local JSON file (`--config audit.json`) that holds `{rules, ignore, only, ignorePaths, thresholds, chartPalette}`; flags override the file. As with lint, document `extensions` can never install audit policy.

```sh
opf audit deck.opf.json --severity text-contrast=error --threshold maxWordsPerSlide=80
```

### Exit codes and output

| | |
| --- | --- |
| 0 | No finding at or above `--fail-on` (default `error`; `never` always passes) |
| 1 | At least one finding at or above `--fail-on`, including a document that fails validation |
| 2 | Usage, configuration or I/O error |

Without `--json` the CLI prints one line per finding (`file:line:column  severity  rule  message`), the JSON Pointer path, a hint and any fix, and a summary. With `--json` it prints the report plus the source's SHA-256 and the bundled core version, like `opf lint`.

## How contrast is computed

Audit reasons about the colours the preview draws, because a check against a different colour than the one on screen is worse than none.

1. **Background.** Design resolves per field: slide design, deck design, theme, engine default. The background is a theme slot or colour (`solid`), the card surface for content on a `contentBox` card, a table cell's fill, a gradient or a pattern. Solid, gradient-stop and pattern colours are read as literal hex colours, as the preview reads them (anything else falls back as it does there). Translucent backgrounds are composited over white.
2. **Text colour.** Titles, body, lists and tags use the scheme's `dark1`, or `light1` when the background is dark (luminance below 0.179). Furniture and quote attributions use the muted colour, metric values the primary colour, and explicit run and table colours the author's `ColorRef` resolved the same way the renderer resolves it. As the preview does, a gradient background has no single colour and counts as light, so a dark gradient behind default text is reported.
3. **Gradients.** The gradient is sampled on a 5 by 5 grid over the area the text covers (the lines' measured ink, aligned as the text is), using the preview's gradient geometry, and the worst colour decides. A pattern contributes both of its colours.
4. **Pictures.** Pixels are never read. A background picture is bounded by a grey ramp from black to white, composited through the picture opacity and any full-frame `design.slideImage.overlay`. Text passes only if every step passes; otherwise `audit/text-on-image` says the result cannot be guaranteed. An overlay limited to an edge band is not counted.
5. **Ratio and size.** The WCAG 2.x relative-luminance contrast ratio is compared with 4.5:1, or 3:1 for large text: at least 18 pt, or 14 pt and bold. Sizes are the fitted sizes, expressed at the 13.33 by 7.5 in reference slide (96 px per inch). The default body size, 18.75 pt, is large text under WCAG, so default body text passes at 3:1; set `contrastLarge` to 4.5 for a stricter policy.

Approximations: anti-aliasing, text shadows, font weight and the exact glyph coverage are not modelled; chart and code text are not checked (charts pick label colours against their surface; code uses its own panel colours). See each rule below for what it cannot see.

## Layout rules use composition

Overflow, small cells, minimum type size, reading order, title position and image resolution use `composeSlide` at the deck's slide size with the resolved font scheme, the same composition the preview and the PPTX export consume. Without a host `textMeasurement` the text widths are core's portable estimate and can differ from the real fonts by a few percent; hosts that load fonts (the editor, the renderer) pass their measurement for font-exact results. A composition with `overflow: "error"` fails at composition time; audit still computes the geometry, relaxes the setting, and reports the overflow as an `error`, which is the severity the author asked for.

Promoted region keys (`left`, `center`, `right`, `top:left` and the rest) are composed in visual reading order (rows from top to bottom, then along the row), whatever order the keys are written in. The PPTX export writes shapes in that order, which is the reading order of assistive technology; `audit/reading-order` checks that the composed order still matches the geometry (the same `visualReadingOrder` that composes the regions). Authoring with `blocks` (an ordered list) keeps the reading order equal to the visual order. Before RR-29 the regions were composed in alphabetical key order, so `center` came before `left` and 55 of the bundled example slides tripped the rule.

## Templates and variables

`audit/unfilled-variable` looks for template scaffolding without importing the template module: `{{id}}` tokens (the RR-32 template syntax), `var:` colour references with no declaration, and declared content variables that have no value. Fill a template (`opf fill`, `resolveVariables`) before auditing it; a template reports its own tokens.

## Rules

The reference below is generated from the rule registry (`auditRules`); `pnpm check:audit-docs` fails when it drifts.

<!-- audit-rules:start (generated by scripts/build-audit-docs.mjs; do not edit by hand) -->

| Rule | Severity | Category | What it reports |
| --- | --- | --- | --- |
| [`audit/text-contrast`](#audittext-contrast) | warning | Accessibility | Text colour has too little contrast against the background it sits on. |
| [`audit/text-on-image`](#audittext-on-image) | info | Accessibility | Text sits on a background picture whose pixels cannot be measured. |
| [`audit/missing-alt-text`](#auditmissing-alt-text) | warning | Accessibility | A picture has no alt text and is not marked decorative. |
| [`audit/poor-alt-text`](#auditpoor-alt-text) | info | Accessibility | Alt text is a file name, a URL, a generic word or very long. |
| [`audit/missing-slide-title`](#auditmissing-slide-title) | warning | Accessibility | A slide has no title. |
| [`audit/duplicate-slide-title`](#auditduplicate-slide-title) | info | Accessibility | Two slides have the same title. |
| [`audit/reading-order`](#auditreading-order) | warning | Accessibility | The order content is read differs from the order it appears on the slide. |
| [`audit/link-text`](#auditlink-text) | warning | Accessibility | Link text does not say where the link goes. |
| [`audit/chart-color-only`](#auditchart-color-only) | info | Accessibility | Chart series may be indistinguishable without colour vision. |
| [`audit/chart-text-alternative`](#auditchart-text-alternative) | info | Accessibility | A chart has no text alternative, or is marked decorative. |
| [`audit/missing-language`](#auditmissing-language) | info | Accessibility | The presentation does not declare its language. |
| [`audit/text-overflow`](#audittext-overflow) | warning | Design | Text or a table does not fit its space at the smallest allowed size. |
| [`audit/small-cell`](#auditsmall-cell) | info | Design | A content cell is too small for comfortable reading. |
| [`audit/unresolved-content`](#auditunresolved-content) | warning | Design | Content cannot be drawn as authored. |
| [`audit/layout-failed`](#auditlayout-failed) | warning | Design | The slide layout could not be computed. |
| [`audit/min-font-size`](#auditmin-font-size) | warning | Design | Text is drawn smaller than the readable minimum. |
| [`audit/font-outside-scheme`](#auditfont-outside-scheme) | warning | Design | Text uses a font family that is not in the deck's font scheme. |
| [`audit/font-family-count`](#auditfont-family-count) | info | Design | The deck uses more font families than the recommended maximum. |
| [`audit/title-position`](#audittitle-position) | info | Design | Titles of slides with the same layout sit in different places. |
| [`audit/slide-word-count`](#auditslide-word-count) | info | Design | A slide holds a lot of text. |
| [`audit/image-resolution`](#auditimage-resolution) | warning | Design | An image has too few pixels for the size it is shown at. |
| [`audit/placeholder-text`](#auditplaceholder-text) | warning | Content | Placeholder text was left in the deck. |
| [`audit/empty-text`](#auditempty-text) | info | Content | A text field is present but empty. |
| [`audit/empty-slide`](#auditempty-slide) | warning | Content | A slide has no content at all. |
| [`audit/unfilled-variable`](#auditunfilled-variable) | warning | Content | A template variable was never filled in. |

## Accessibility rules

### `audit/text-contrast`

Default severity: **warning**. Text colour has too little contrast against the background it sits on.

**Why.** Low-contrast text is hard or impossible to read for people with low vision, colour-vision differences, glare on a projector or a poor display. WCAG sets 4.5:1 for normal text and 3:1 for large text.

**Standard.** WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA

**Thresholds.** `contrastNormal` (default 4.5), `contrastLarge` (default 3)

**Approximations.** Computed on sRGB colours with the WCAG relative-luminance formula, against the background the preview draws: a solid or theme colour, the card surface, a table cell fill, every colour a gradient takes under the text box (sampled on a 5x5 grid, angle respected), or both colours of a pattern. Anti-aliasing, text shadows and font weight are not modelled. Text colour is the preview's (the scheme's dark1 or light1 chosen from the background luminance, where a gradient background counts as light), so a default can fail on a dark gradient.

### `audit/text-on-image`

Default severity: **info**. Text sits on a background picture whose pixels cannot be measured.

**Why.** Contrast over a photograph depends on the photograph. Without a full-frame overlay that guarantees readability for every possible image, the result cannot be certified from the document.

**Standard.** WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA

**Thresholds.** `contrastNormal` (default 4.5), `contrastLarge` (default 3)

**Approximations.** Core never reads picture pixels. The picture is bounded by a grey ramp from black to white, composited through the image opacity and a full-frame design.slideImage.overlay; the text passes only when every step of that ramp passes. An edge-banded overlay is not counted.

### `audit/missing-alt-text`

Default severity: **warning**. A picture has no alt text and is not marked decorative.

**Why.** People using a screen reader get nothing for a picture without alternative text. A picture that is purely decorative should say so with an empty alt (alt: ""), which is an explicit, reviewed choice instead of an omission.

**Standard.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** Checks the alt field of images, video, the slide image, logos (design.logo and each LogoSet variant, organization.logo), header/footer images and speaker photos, following asset: references to the assets registry. Whether the text describes the picture well is not judged here (see audit/poor-alt-text). Charts carry `chart.alt` and are checked by audit/chart-text-alternative. Background images and watermarks are decorative by definition and are not checked.

### `audit/poor-alt-text`

Default severity: **info**. Alt text is a file name, a URL, a generic word or very long.

**Why.** Alt text such as "image", "IMG_2041.png" or a 400-character paragraph does not do the job of describing a picture: it is read out and adds noise without information.

**Standard.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** Pattern checks only: file extensions and camera-style names, a bare generic word, a URL, a leading "image of", and more than 250 characters. Chart alt text (chart.alt) is checked too: a bare chart word, a URL, a leading "chart of" or more than 250 characters. It cannot tell whether a plausible sentence is accurate.

### `audit/missing-slide-title`

Default severity: **warning**. A slide has no title.

**Why.** Slide titles are how people using a screen reader, an outline view or keyboard navigation find and tell slides apart; PowerPoint's own accessibility checker reports a missing title too.

**Standard.** WCAG 2.2 SC 2.4.2 Page Titled and SC 2.4.6 Headings and Labels, level AA (PowerPoint: "Missing slide title")

**Approximations.** Only the slide-level title field counts. Text that merely looks like a heading inside a block does not.

### `audit/duplicate-slide-title`

Default severity: **info**. Two slides have the same title.

**Why.** Identical titles make slides indistinguishable in an outline or a screen reader's slide list.

**Approximations.** Titles are compared case-insensitively with whitespace collapsed. Slides that continue one another are not exempt; give a continuation a distinct title such as "(continued)".

### `audit/reading-order`

Default severity: **warning**. The order content is read differs from the order it appears on the slide.

**Why.** Screen readers, keyboard focus and PowerPoint's selection pane follow the composed order. When it differs from the visual order (top to bottom, then start to end of the reading direction), the slide is read out of sequence.

**Standard.** WCAG 2.2 SC 1.3.2 Meaningful Sequence, level A (PowerPoint: "Check reading order")

**Approximations.** Compares the composed content order with a visual order recomputed from the composed boxes: items whose vertical centres fall in the same row are ordered along the reading direction (a right-to-left deck is checked by rows only), rows from top to bottom. Headings are expected first. Free-form overlap is not analysed.

### `audit/link-text`

Default severity: **warning**. Link text does not say where the link goes.

**Why.** People who scan links out of context (a screen reader's links list, a link tab order) hear only the text. "click here", "read more" or a long raw URL tells them nothing about the destination.

**Standard.** WCAG 2.2 SC 2.4.4 Link Purpose (In Context), level A; PowerPoint: "Hyperlink text is not meaningful"

**Approximations.** Matches a short list of generic phrases in English (after lower-casing and removing punctuation), blank link text, and raw URLs longer than 40 characters. Adjacent runs sharing one link are read as one link.

### `audit/chart-color-only`

Default severity: **info**. Chart series may be indistinguishable without colour vision.

**Why.** OPF charts have no data labels or patterns, so series are told apart by colour alone (and legend order). Colours that look alike to someone with colour-vision deficiency, or when printed in greyscale, make series impossible to tell apart.

**Standard.** WCAG 2.2 SC 1.4.1 Use of Color, level A

**Thresholds.** `minSeriesColorDifference` (default 10)

**Approximations.** Uses the engine's series palette (AuditOptions.chartPalette; default the opf-render/opf-pptx palette, adjusted for the card surface like the preview does) in series order: series i takes colour i, pie/doughnut/treemap/funnel slices take colours per category. Pairs are compared by CIE76 distance after simulating protanopia, deuteranopia, tritanopia (Machado 2009, severity 1) and greyscale. Single-series charts and chart types without a series legend are skipped.

### `audit/chart-text-alternative`

Default severity: **info**. A chart has no text alternative, or is marked decorative.

**Why.** A chart conveys a message; people who cannot see it need the message and ideally the numbers in text. The chart's alt field is that text alternative (the preview exposes it as the chart's accessible name and the PowerPoint export writes it as the frame's alternative text); a sentence or table beside the chart also serves. An empty alt marks a chart decorative, which is reported as info so the choice is reviewed: a chart rarely carries no message.

**Standard.** WCAG 2.2 SC 1.1.1 Non-text Content, level A

**Approximations.** A chart passes when chart.alt has text. Without alt, it passes when the slide has any other text, list, table, quote or metric content besides title and tag, or a subtitle. It does not judge whether alt or that text states the chart's point (see audit/poor-alt-text for generic alt text). alt: "" is reported as a decorative chart, whatever else is on the slide.

### `audit/missing-language`

Default severity: **info**. The presentation does not declare its language.

**Why.** Screen readers and text-to-speech choose pronunciation and hyphenation from the declared language; spell checkers and translation tools use it too.

**Standard.** WCAG 2.2 SC 3.1.1 Language of Page, level A

**Approximations.** Only the presentation-level `language` is checked, not the language of individual runs (OPF has no per-run language).


## Design rules

### `audit/text-overflow`

Default severity: **warning**. Text or a table does not fit its space at the smallest allowed size.

**Why.** Core composition shrinks text to the readable minimum and then reports what still does not fit. Overflowing text is clipped or runs over other content in the preview and in PowerPoint.

**Approximations.** Uses composeSlide at the deck's slide size with the fonts of the resolved font scheme. Without a host-supplied text measurement (AuditOptions.textMeasurement) widths are core's portable estimate, which can differ from the real font by a few percent; pass the renderer's measurement for font-exact results. Content in a composition that sets overflow: "error" is reported as an error, as the author asked.

### `audit/small-cell`

Default severity: **info**. A content cell is too small for comfortable reading.

**Why.** Cells narrower than about 100 px or shorter than 60 px (at 720 px slide height) leave no room for readable content.

**Approximations.** The composeSlide threshold, in reference pixels scaled to the slide size.

### `audit/unresolved-content`

Default severity: **warning**. Content cannot be drawn as authored.

**Why.** composeSlide reports content it cannot place or an effect it does not support (for example a picture bullet without a logo, a date field without a date, or an unsupported image treatment). The preview and the export fall back.

### `audit/layout-failed`

Default severity: **warning**. The slide layout could not be computed.

**Why.** Composition threw for a slide that passed schema validation, so geometry-based rules (contrast, overflow, reading order, resolution) were skipped for it.

### `audit/min-font-size`

Default severity: **warning**. Text is drawn smaller than the readable minimum.

**Why.** Small type is unreadable from the back of a room and on a phone. The engine's own default floor is 12 pt (16 px); anything much below that was lowered on purpose or by a composition that could not fit the text.

**Standard.** Common presentation guidance (12 pt minimum for body text; 18 pt or more is easier to read from a distance).

**Thresholds.** `minFontSizePt` (default 11)

**Approximations.** Sizes are those composeSlide fitted, expressed on the 13.33 x 7.5 in reference slide (96 px per inch, so 1 px is 0.75 pt; a smaller canvas scales type down with it) and explicit run fontSize values in points. Per payload, the smallest part (a metric label or a quote attribution) is reported. Table cell text (default 11.25 pt), code and header/footer furniture are not checked.

### `audit/font-outside-scheme`

Default severity: **warning**. Text uses a font family that is not in the deck's font scheme.

**Why.** The font scheme is the deck's font choice. A run that names another family will not follow a font-scheme change, may be missing on the viewer's machine, and breaks the deck's typographic consistency.

**Approximations.** Compares the run's fontFamily (case-insensitively) with the heading, body, code and accent families of the slide's resolved font scheme and the scheme's major/minor fonts. Families that the host substitutes are still different names here.

### `audit/font-family-count`

Default severity: **info**. The deck uses more font families than the recommended maximum.

**Why.** More than two or three families (heading, body, plus code where used) makes a deck look unplanned and increases the font bytes a viewer needs.

**Thresholds.** `maxFontFamilies` (default 3)

**Approximations.** Counts the distinct heading and body families of every slide's resolved scheme, the code family on slides with code, the accent family on slides with a tag, and every run fontFamily.

### `audit/title-position`

Default severity: **info**. Titles of slides with the same layout sit in different places.

**Why.** A title that jumps between slides of one layout looks like a mistake when the deck is clicked through. Slides of one layout should hold their titles still.

**Thresholds.** `titlePositionTolerance` (default 0.01)

**Approximations.** Compares the composed title box origin of slides that share a layout id, a header presence and a slide-image position; covers (no body content) are skipped because their heading group is centred on purpose. The reference is the most common position, ties going to the earliest slide.

### `audit/slide-word-count`

Default severity: **info**. A slide holds a lot of text.

**Why.** Slides that carry a page of prose are read instead of presented, and are hard to scan on a screen reader or a phone. Split them or move detail to notes.

**Thresholds.** `maxWordsPerSlide` (default 120)

**Approximations.** Counts word-like segments (Unicode word boundaries, so Chinese and Japanese count by word) in the title, subtitle, tag, text, lists, tables, quotes, metrics and timelines. Code and speaker notes are excluded.

### `audit/image-resolution`

Default severity: **warning**. An image has too few pixels for the size it is shown at.

**Why.** An image stretched beyond its pixel size looks blurry or blocky on a projector or a high-density screen.

**Thresholds.** `minImagePpi` (default 96)

**Approximations.** Only embedded data: images (and asset: references to them) have readable pixel sizes; URLs and files are never fetched, so they are not checked. The displayed size is the composed box (cropped images are measured as the cover scale, fitted ones as the contain scale). Effective ppi is the image pixels per inch of the 96 px/inch reference slide. SVG is vector and exempt.


## Content rules

### `audit/placeholder-text`

Default severity: **warning**. Placeholder text was left in the deck.

**Why.** "Lorem ipsum", "Click to add title", "TBD" and bracketed prompts are scaffolding. Shipping them reads as unfinished work.

**Approximations.** Case-insensitive patterns for lorem ipsum, template prompts ("Click to add...", "Your title here", "[Insert ...]", a bare "Title" or "Text"), and the markers TBD, TBC, TODO, FIXME and XXX in capitals. A deliberate use of the words is flagged too; disable the rule for that slide with ignorePaths.

### `audit/empty-text`

Default severity: **info**. A text field is present but empty.

**Why.** An empty title, text block or list item draws nothing, and leaves a hole in the outline and for assistive technology.

### `audit/empty-slide`

Default severity: **warning**. A slide has no content at all.

**Why.** A slide with no title, no content and no picture is almost always an accident of editing. (A deliberately blank slide can use the blank layout.)

### `audit/unfilled-variable`

Default severity: **warning**. A template variable was never filled in.

**Why.** `{{name}}` tokens, `var:` colour references to undeclared variables and declared variables without a value are template scaffolding. In a finished deck they show up literally, or fall back to a default colour.

**Approximations.** Feature-detected from the document alone: `{{id}}` / `{{id|format}}` tokens (the RR-32 template syntax; `\{{` escapes) in any string outside `variables`, `extensions` and `catalogs`; `var:<id>` references with no declaration in `variables`; and declared non-colour variables with no value that are not `required: false`. A template (`template: true`) reports its tokens as findings too: ignore the rule for a template on purpose, or fill it first. Core's `resolveVariables` (RR-32) is the authority once it is released; this check needs no import of it.

<!-- audit-rules:end -->

## What audit does not check

- Native PowerPoint rendering, font availability on a viewer's machine, or export fidelity. A clean audit is not visual or native acceptance.
- Remote images, fonts and links: nothing is fetched, so URLs cannot be resolution-checked and link targets are not tested.
- The meaning of alt text, titles and link text beyond the patterns listed per rule.
- Per-run language, reading order inside a text block, table header associations (OPF tables mark header rows with `columns`), and animations (deferred in the format).
