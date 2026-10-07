# Rich text measurement and output

OPF text arrays preserve run formatting in the document. Text payloads now use a shared mixed-style layout for composition, SVG preview, and native PPTX export. Plain string text keeps its existing layout path.

The shared fit accounts for each run's font family, weight, italic style, and requested point size. Run point sizes are converted to pixels at 96 DPI; default text sizes and composition minimum sizes remain canvas-relative. Fitting can shrink the run sizes together, preserving their relative sizes. Superscripts and subscripts use smaller glyphs and explicit baseline offsets. Line height accounts for the largest ascent/descent. Long tokens wrap at grapheme boundaries; spaces and explicit empty lines are retained.

SVG displays bold, italic, underline, strikethrough, color, font family, size, superscript, subscript, and HTTP(S)/mailto hyperlinks. Other link schemes remain in the OPF source but are not emitted as active links. Use the same loaded font files and measurement provider for SVG and PPTX.

Native PPTX output preserves these run styles and shared wrapping. Each fitted line is an editable text box, which retains measured vertical placement but is not a single continuous PowerPoint paragraph. Arbitrary PPTX import is still not a lossless rich-text round trip. Visual equality across browser and PowerPoint is not established by XML formatting checks.

The canvas supports native SVG text selection with a formatting toolbar for bold, italic, underline, strikethrough, color, font family, point size, links, and scripts. Double-click a rich text block (or focus it and press Enter) to select its full contents. For a plain text payload, start an inline edit and choose **Format text**. **Selected text** and **Replace text** replace the selected range; **Edit runs** opens structured controls. Each action validates and creates one undo step. A continuous mixed-style typing caret and IME handling remain open work; selection and formatting currently use the rendered SVG itself. List entries and descriptions use the same formatting controls at their own source paths. Complex-script shaping, bidi layout, and font-feature parity remain additional work.

## Inline code and run language

A run with `code: true` is an inline code span. It is set in the design's code font (the font scheme's `code` family, else Roboto Mono) unless the run names its own `fontFamily`. Only the font changes: a PPTX run cannot carry a background, so neither engine draws one. Composition measures the run in the code font (`RichTextOptions.codeFontFamily`, `TableLayoutOptions.codeFontFamily`; `composeSlide` passes `fonts.code`). Markdown backticks read and write code runs (see [Markdown](markdown.md)).

A run with `lang` (a BCP-47 tag such as `fr-FR` or `ja-JP`) overrides the deck language for that run. It reaches the layout as `style.lang` on the run's fragments, the preview writes it as the `lang` of the run's text, and PPTX export writes `a:rPr/@lang` (with the run's own East Asian and complex-script theme fonts for that language). PPTX import reads `lang` back only when it differs from the deck language. Without `lang` a run follows the deck language.

```js
import {fitRichText} from '@openpresentation/opf/composition';
const fit = fitRichText(
  ['A ', {text:'larger word', fontSize:28, bold:true}],
  {x:0,y:0,width:400,height:200},
  25, 16,
  {style:{fontFamily:'Roboto',fontWeight:400},textMeasurement},
);
// textMeasurement is the host's loaded-font measurement provider.
// richLines contains positioned fragments, resolved styles, and baselines.
```

Verification: `node packages/javascript/test/rich-text.mjs`, composition/pagination regressions, and `pnpm test:rich-text`. The latter produces SVG, OPF, and PPTX specimens under `artifacts/rich-text/`. The SVG specimen has been visually inspected in the browser; PPTX verification currently inspects native run XML, not a PowerPoint raster comparison.

## Rich headings and quotes

`title`, `subtitle`, `tag` and `quote.text` accept a string or `TextRun[]` (FA-10), with the same `TextRun` definition as body text, including `color` (a hex value, scheme slot or role, or `var:<id>`), links, `superscript`/`subscript`, `cite` and `footnote`. A string keeps exactly the layout it always had.

- **Composition.** A `TextRun[]` heading fits through the same rich-text layouter as body text (`composeSlide` reports a `RichTextFit` with `richLines` on the item), with the heading's own size, shrink floor and box rules. The heading font weight (700 for the title) is the default for every run, so `bold: false` on a run is the way to lighten a word. `layoutQuote` accepts a `TextRun[]` quote text and fits the body the same way: the quotation marks join the first and last run (so run indexes and marker paths never shift) and the part reports `runs` and a `RichTextFit`; the footer (attribution and source) stays a plain string.
- **Citations.** A marked heading run draws its marker after the run, and its note joins the slide's footnote area. Numbering follows reading order, with the heading group first: `tag`, `title`, `subtitle`, then regions, blocks and the root payload (see [footnotes-citations-captions.md](footnotes-citations-captions.md)).
- **Variables.** A whole-field `var:<id>` whose text variable holds `TextRun[]` keeps the runs in a heading; `{{id}}` inside a run's text resolves as in body text.
- **Markdown.** `# Title`, `## Subtitle` and the quote text keep [inline formatting](markdown.md#inline-text) both ways.
- **Audit.** Contrast is checked for each run color; a title of runs counts as a title (`missing-slide-title`, `duplicate-slide-title` compare plain text); link text in a heading is checked like body link text.
- **Pagination.** A long rich quote splits by text offset like body text, each piece keeping its run formatting; the heading group repeats on every page.

```json
{ "title": ["Revenue grew ", { "text": "28%", "color": "accent1", "cite": "annual-report" }], "quote": { "text": ["Cut review time by ", { "text": "40%", "bold": true }, " in a quarter"], "attribution": "VP Operations" } }
```

## Headless range editing

Any agent or application can use the same immutable helpers, without a browser or AI service:

```js
import {formatRichTextRange, replaceRichTextRange} from '@openpresentation/opf-editor/rich-text';
const path = 'slides.0.text';
const next = formatRichTextRange(editor.get(path), 0, 5, {bold: true});
editor.set(path, next, {rejectInvalid: true});
// Other helpers: replaceRichTextRange(value, start, end, replacement), richTextContent(value).
```

Offsets are UTF-16 offsets, matching DOM Selection. They must fall on whole grapheme boundaries; ranges that split surrogate pairs, combining sequences, or emoji sequences are rejected. Formatting preserves unselected text, run metadata, and links. A `null` style removes an override, while `false` explicitly disables a boolean style. Superscript and subscript are mutually exclusive when applying a new script style. Text replacement inherits the first selected run's style; insertion at a boundary inherits the preceding run. Pass the result through whole-document validation before saving.

These helpers are published through `@openpresentation/opf-editor/rich-text` in editor 0.8.0. Use the current editor 0.12.1 with core 0.13.0, renderer 0.13.1 and PPTX 0.13.2 on Node 24. The [compatibility matrix](compatibility-matrix.md) separates shipped APIs from remaining canvas, font and native Office gates; package availability does not establish arbitrary PPTX round-trip or pixel parity.

Browser verification: `pnpm demo:editor`, then open `/rich-text-tests.html` on the demo server. The harness covers forward/reverse cross-run selection, shared-renderer source offsets, selection restoration after reflow, styles, links, replacement, undo, stale selection invalidation, plain-text entry, structured controls, and disposal.

## Lists and descriptions

`items` and `bullets` use the shared `fitList` API, including payloads explicitly marked `type: "text"` with a `bullets` field. Entries accept strings, run arrays, or objects with `text` and `level`; `items` objects also accept `description`. Rich text is measured without flattening styles. Descriptions default to 82% of the body size. Explicit run point sizes stay absolute until fitting shrinks the whole list uniformly.

```js
import {fitList} from '@openpresentation/opf/composition';
const fit = fitList([
  {text: ['A ', {text: 'recommendation', bold: true}],
   description: [{text: 'Supporting evidence', italic: true}], level: 1},
], {x: 0, y: 0, width: 500, height: 300}, 25, 16,
{style: {fontFamily: 'Roboto', fontWeight: 400, path: 'slides.0.items'}, textMeasurement});
// listEntries contains text/description boxes, rich lines, markers and source paths.
```

Each nesting level adds an indent of 1.1 times the fitted body font size. Wrapped lines and descriptions align with the entry text, while character markers cycle through three shapes. Levels are not silently capped at three; excessive indentation reports overflow. Composition scoring and pagination use the measured list height, splitting only between complete entries and preserving descriptions, levels and runs.

The canvas edits strings inline and rich arrays through selection and formatting. List containers still expose structural properties for adding, removing and reordering entries. Native PPTX uses one editable box per fitted line, with a native bullet only on the first body line. Bullet font, size and color are explicit. PowerPoint paragraph levels stop at eight; deeper OPF levels retain their measured visual offset. Reimport uses heuristics for adjacent bullet boxes and is not a lossless reconstruction of descriptions or rich list structure.

Image bullets and continuous rich typing remain outstanding. Native PowerPoint raster comparison is still needed before claiming pixel parity. Verification: `pnpm test:lists` writes OPF/SVG/PPTX specimens to `artifacts/lists/` and checks native paragraph validity, bullet properties, text and indent coordinates. `/list-tests.html` and its packed-package equivalent cover 19 canvas editing/undo checks.

## Citations and footnotes

A run that cites a source or carries an inline note gets a superscript marker directly after it (core 0.11.5 and later; RR-34): `{"text": "doubled", "cite": "gartner-2026"}` cites an entry of the deck's top-level `references` list (`{id, text, url?}`), `cite: ["a", "b"]` shows `1,2`, and `{"text": "grew", "footnote": "Unaudited."}` lists an inline note. Markers are numbered per deck in reading order of first use; the same reference id keeps its number, every footnote takes a new one. The slide then carries a footnote area above its footer band listing `<n> <text>` for the notes it uses, and the content area shrinks by that height. Markers are supported in `text`, `bullets` and list item runs (`cite-unsupported-location` elsewhere); an unknown id is `cite-unknown-reference`, an uncited reference the lint warning `opf/unused-reference`.

In the shared layout a marker is a fragment `{kind: "marker"}` after the run's last fragment with zero source length, 0.7 of the run's size and a raise of 0.3 of its own size, so run indexes, `data-opf-text-*` offsets and wrapping stay those of the authored runs and the exporter writes a native superscript run (`baseline="30000"`). `referencesSlide(presentation, {title})` builds an ordinary list slide of the cited references. Details and the engine mapping: [footnotes, citations and captions](footnotes-citations-captions.md).
