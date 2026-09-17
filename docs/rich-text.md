# Rich text measurement and output

OPF text arrays preserve run formatting in the document. Text payloads now use a shared mixed-style layout for composition, SVG preview, and native PPTX export. Plain string text keeps its existing layout path.

The shared fit accounts for each run's font family, weight, italic style, and requested point size. Run point sizes are converted to pixels at 96 DPI; default text sizes and composition minimum sizes remain canvas-relative. Fitting can shrink the run sizes together, preserving their relative sizes. Superscripts and subscripts use smaller glyphs and explicit baseline offsets. Line height accounts for the largest ascent/descent. Long tokens wrap at grapheme boundaries; spaces and explicit empty lines are retained.

SVG displays bold, italic, underline, strikethrough, color, font family, size, superscript, subscript, and HTTP(S)/mailto hyperlinks. Other link schemes remain in the OPF source but are not emitted as active links. Use the same loaded font files and measurement provider for SVG and PPTX.

Native PPTX output preserves these run styles and shared wrapping. Each fitted line is an editable text box, which retains measured vertical placement but is not a single continuous PowerPoint paragraph. Arbitrary PPTX import is still not a lossless rich-text round trip. Visual equality across browser and PowerPoint is not established by XML formatting checks.

The canvas supports native SVG text selection with a formatting toolbar for bold, italic, underline, strikethrough, color, font family, point size, links, and scripts. Double-click a rich text block (or focus it and press Enter) to select its full contents. For a plain text payload, start an inline edit and choose **Format text**. **Selected text** and **Replace text** replace the selected range; **Edit runs** opens structured controls. Each action validates and creates one undo step. A continuous mixed-style typing caret and IME handling remain open work; selection and formatting currently use the rendered SVG itself. List entries and descriptions use the same formatting controls at their own source paths. Complex-script shaping, bidi layout, and font-feature parity remain additional work.

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

## Headless range editing

Any agent or application can use the same immutable helpers, without a browser or AI service:

```js
import {formatRichTextRange, replaceRichTextRange} from '@openpresentation/opf-editor/rich-text';
const path = 'slides.0.text';
const next = formatRichTextRange(editor.get(path), 0, 5, {bold: true});
editor.set(path, next, {rejectInvalid: true});
// Other helpers: replaceRichTextRange(value, start, end, replacement), richTextContent(value).
```

Offsets are UTF-16 offsets, matching DOM Selection. They must fall on whole grapheme boundaries; ranges that split surrogate pairs, combining sequences, or emoji sequences are rejected. Formatting preserves unselected text, run metadata, and links. A `null` style removes an override, while `false` explicitly disables a boolean style. Superscript and subscript are mutually exclusive when applying a new script style. Text replacement inherits the first selected run's style; insertion at a boundary inherits the preceding run. Pass the result through whole-document validation before saving. These APIs are included in coordinated local preview packages; check the installed package exports before assuming registry availability.

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
