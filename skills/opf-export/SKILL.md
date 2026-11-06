---
name: opf-export
description: "Render OPF in a browser or export OPF to SVG, PNG, PDF, and PPTX; inspect PPTX imports. Use for font/asset fidelity, reproducible output, and distinguishing schema validity from visual/export parity."
license: MIT
---

# Preview and export OPF

Start with a validated OPF document and the output formats the user requested. Preserve OPF as the editable source. Read [rendering and conversion](references/rendering.md) for the concrete local APIs and environment boundaries.

## Know the PPTX limits before you promise "editable"

PPTX text is editable line by line, not paragraph by paragraph. `opf convert deck.opf.json deck.pptx` writes one text box for each wrapped line, so PowerPoint and Keynote break lines where the preview does. Typing in a box works, but added or longer text does not reflow into the next line: it runs past its box or overlaps the line below. A title that wraps is several line boxes, not the Title placeholder (a one-line title does bind to it). State this wherever you offer "editable PPTX". For heavy text changes, edit the OPF source and export again. An opt-in native body mode, with real paragraphs that reflow, is in progress; it is not in the published packages yet, so do not offer it or name an option for it. Fonts are named in the PPTX, not embedded: a viewer without a named font substitutes one, and the report says which fonts that can happen to (`pptx/typeface-not-office-safe`). `--typefaces safe` avoids it, and `--as images` writes pictures instead of text (see [Fonts and pictures in a PPTX](#fonts-and-pictures-in-a-pptx)).

<!-- glossary:start -->
**Words these skills use**

- **Furniture**: the parts that repeat on slides outside the content: header, footer, logo, slide number. You set them once on the deck or a layout, not in `blocks`.
- **Composition**: the automatic layout step that turns a slide's content into boxes with a position, size and font size. A `composition` key steers it.
- **Implicit blocks**: content fields written straight on the slide (`text`, `items`, `table`, ...) with no `blocks` list. Composition treats them as blocks, and editing can turn them into an explicit `blocks` list.
- **Promoted region**: content placed by a 3×3 grid key on the slide (`left`, `top:right`, `center+right`), used when relative position matters. It cannot be mixed with root content.
- **Catalog record**: one named, reusable design entry (a theme, layout, color scheme, font scheme, ...) from the `@openpresentation/gallery` package or a deck's `catalogs`. A deck refers to it by id.
- **Reflow**: text wrapping again when its box or size changes. OPF computes line breaks itself; PPTX export writes each wrapped line as its own text box, so text edited in PowerPoint or Keynote does not reflow.
- **Provenance**: tags that OPF writes into an exported PPTX to record where each shape came from, so a later import can map edits back to the OPF source.
<!-- glossary:end -->

## What every PPTX export guarantees

`test/native-conformance.mjs` in `@openpresentation/opf-pptx` checks these on every example deck, so you can rely on them without inspecting the XML:

- **Theme.** `ppt/theme/theme1.xml` names the deck's heading and body fonts (major and minor latin) and all twelve color slots. A color that comes from the scheme is `a:schemeClr`, so changing the theme in PowerPoint recolours the deck. Colors the author wrote as hex stay literal, and so do derived colors with no theme slot (syntax colors, emphasis, contrast and chrome mixes, gradients). That is about 16% of the color elements in the examples. A slide with its own color scheme is all literal.
- **Chart text.** Axes, data labels, legends and titles name the deck's own typeface, never PowerPoint's default Arial.
- **Accessibility.** Every text shape that is not a layout placeholder is a text box (`txBox="1"`), so screen readers announce text, not a graphic. Every shape has a descriptive name such as `OPF heading slides.0.title line 0` or `OPF card slides.2.chart`. A picture carries its OPF `alt` as its description; an image without `alt` gets none, so write `alt` for every meaningful image.
- **Insets.** Text boxes have explicit zero insets, because each box is already the composed text box. PowerPoint's default 0.1 in / 0.05 in padding never shifts text. Table cells have explicit margins.
- **Chart guards.** Stacked bars and columns never place data labels outside the end of a bar, which PowerPoint reports as a corrupt file. A combo with a secondary axis declares its own category and value axes.
- **Bullets.** List bullets and numbers are paragraph bullets (`a:buChar`, `a:buBlip`, `a:buAutoNum`), never a "•" typed into the text.

## Files: `convert`, from code or the shell

One call turns a file into another, the formats named by the file names. In a Node application or script use core's `@openpresentation/opf` (in a browser or worker the file functions reject with `node-only`); from a shell, `opf convert` runs the same code:

```js
import * as opf from '@openpresentation/opf';

await opf.convert('deck.opf.md', 'deck.pdf');
await opf.convert('deck.opf.md', 'slides/deck.png', { slides: '1-3', scale: 2 }); // slides/deck-1.png, -2, -3
await opf.convert('deck.pptx', 'deck.opf.yaml');      // import; the result's findings say what the import could not keep
const deck = await opf.open('deck.opf.md');            // the presentation (a .pptx path or bytes is imported)
await opf.save(deck, 'deck.opf.yaml');
const { files, findings } = await opf.convert(deck, { format: 'pptx' }); // bytes, nothing written
```

```sh
opf convert deck.opf.md deck.pdf
opf convert deck.pptx deck.opf.yaml
```

Inputs: `.pptx` (or its bytes), `.opf.md`, `.yaml`/`.yml`, `.json`, or a deck object. Outputs: `.pdf`, `.pptx`, `.png` and `.svg` (one file per slide beside the output: `slides/deck.png` gives `slides/deck-1.png`, `-2`, ..., zero-padded to the width of the largest slide number written, so `-01` from ten slides; one selected slide is written to the output itself; `{n}` in the output is the slide number, so `"slides/slide-{n}.png"` always numbers its files, even for one slide, and `--slides 2,5` gives `slide-2.png` and `slide-5.png`; any other `{key}`, or `{n}` in a `.pdf`, `.pptx`, `.zip` or deck-form output, is `invalid-option`), `.zip` (the slides, entries named like the plain files; `format: 'svg'` for SVG), and the deck forms. Options are the flags of `opf convert` in camel case: `slides`, `includeHidden`, `paginate` (`"blocks"`, the default: an overfull slide of sibling blocks of one kind is drawn as several slides, split between whole blocks, and reported as `slide-continued`; `true` splits every overflowing slide; `false` draws every slide as written), `scale`, `raster`, `text` (`fonts`, `system` or `paths`), `charts` (`auto`, `native` or `picture`), `diagrams` (`shapes`, the default, or `picture`), `provenance`, `images`, `bodyText` (`measured` or `native`), `slideNumbers` (`static` or `live`), `typefaces` (`selected` or `safe`), `as` (`native` or `images`), `date`, `catalogs`, `fonts` (a handle, or a folder or list of folders), `assetDir`, `signals`, `overwrite`, and for output without a path `zip` and `name`. It is deterministic: bundled open fonts (prepared once per process), no system fonts, no network, no clock (pass `date` for a date field); local images resolve next to the input file. Every file is produced before any is written, atomically; `convert` replaces an existing output (`overwrite: false` refuses), while the commands refuse one without `--force`. `@openpresentation/opf-render` and `@openpresentation/opf-pptx` are optional peers, installed as needed; a missing one throws `OPFExportError` or `OPFImportError` with `code` `peer-not-installed` and the install command (the command exits 2). Read `findings` (`import/`, `render/`, `pptx/`, `pdf/`, `fonts/` rules) as the evidence; an invalid deck throws `invalid-presentation` with located findings. Reference: [files in Node](references/rendering.md#files-in-node).

PPTX text editing is opt-in. By default every wrapped line is its own text box, which keeps the preview's line breaks but makes a text edit in PowerPoint or Keynote touch one line at a time. `opf convert deck.opf.json deck.pptx --body-text native` (`bodyText: 'native'` in code) writes whole paragraphs instead: a wrapped title is the Title placeholder, and a text, bullets or numbered-list region is one body that the application re-wraps. Content native mode cannot carry stays measured and is reported as a `native-body-fallback` finding, and native wrapping is not yet qualified in every application, so state the default's per-line behaviour next to any "editable PPTX" claim. `--slide-numbers` is `static` by default, which writes a footer like `{{slide.number}} / {{deck.slideCount}}` as fixed text because Keynote shows only the digit of a live number with words around it; `live` keeps the field. A bare `{{slide.number}}` stays live in both.

`opf convert` also reads stdin (`-`, with `--from` or JSON sniffed) and writes stdout (`-`, with `--to`); it prints the report `{ command, ok, input, outputs, findings, counts }`, and `--fail-on warning` fails on warnings. `opf render`, `opf export` and `opf import` were removed in CLI 0.18; `opf doctor` says which formats the install can write. Use the engine APIs below when you need your own fonts handle, a browser preview or an option `convert` does not expose.

## Establish the rendering inputs

Use matching versions of `@openpresentation/opf`, `opf-render`, and `opf-pptx` (the six packages are released together at one version). The repository's preview tarballs can contain APIs absent from published packages. Determine the actual installed exports before using them.

Resolve design, dimensions, catalog records, assets, and required font faces. Pass the catalogs the host registered (`{ catalogs }`) to every engine, or embed the records first (`embed`); nothing fetches a catalog, and a strict export fails on a reference that resolves nowhere. SVG accepts embedded raster data or an explicit host image resolver; PPTX has a separate resolver contract and may require different handling. Resolve only the resources needed for the user's task. Do not treat a resource URL as authorization to upload the deck elsewhere.

Pass the same text measurement provider to preview and PPTX export. Use identical pinned font files in the browser and measurement engine. Rendering a named family without loading its bytes can silently substitute fonts and change line breaks.

## Fonts and pictures in a PPTX

`typefaces: 'safe'` (`--typefaces safe`) writes each Latin text family as an Office-safe one and lays the text out with it. A family is Office-safe when it ships with every Windows and macOS machine and OPF measures it exactly through a metric-compatible open face. The font policy table gives Arial, Courier New, Georgia and Times New Roman. A metric twin keeps its widths (Arimo and Liberation Sans become Arial, Tinos Times New Roman, Cousine Courier New, Gelasio Georgia). Any other family follows its font scheme's type: sans-serif becomes Arial, serif Georgia, monospace Courier New. Every viewer then breaks lines where the file does, but the lines follow the safe family, not the preview. East Asian and complex-script fonts and symbol, emoji and math families keep their names. Each replacement is reported as `pptx/typeface-replaced`. Offer it when the file goes to people whose machines you do not know and exact line breaks matter more than the brand font.

`as: 'images'` (`--as images`) is a fidelity fallback: one full-bleed PNG per slide, drawn like the PNG preview (`scale` 2 by default), with the speaker notes, hidden slides, sections, and the slide's text as each picture's alternative text. It looks identical everywhere and needs no fonts, but it has no editable text and does not import back as the deck. Say so whenever you offer it.

## What the PPTX export approximates

Some OPF features have no exact PowerPoint form. The export draws the nearest native form and reports `pptx/export-lossy` (info) with a `feature`, once per place. Where both engines draw the same fallback, the finding comes from validation or from both engines instead, because the PPTX still matches the preview. Read the findings before you promise that the PPTX looks like the preview.

| OPF feature | In the PPTX | Finding |
| --- | --- | --- |
| Dotted table cell border (`dash: "dot"`) | PowerPoint's square dot, one line width on and one off; the preview leaves two widths between dots | `export-lossy`, `border-dot` |
| Dashed table cell border (`dash: "dash"`) | PowerPoint's dash, four widths on and three off, as the preview draws it | none (exact) |
| Shape block (`shape`, `path`) | A native shape: `a:prstGeom` with its adjust values (or `a:custGeom`), `a:ln`, `p:style` and its own text body, never autofit; PowerPoint wraps the text in the same rectangle | none |
| `rectangle` or `shape` gradient on a shape | PowerPoint's own gradient path; the preview draws the same contours (concentric rectangles, the outline scaled, or PowerPoint's circle for the presets it draws that way) | none |
| Sketched line (`stroke.sketch`) | PowerPoint's Sketched line with the sketched outline the preview draws stored in it, which PowerPoint draws as stored; PowerPoint before 2021 draws the plain line | none |
| Double border, shadow, shadow spread on a table cell | OPF has no key for them, so no deck carries one and neither engine draws one | none |
| SVG image with a duotone recolor or a non-rectangular shape, an SVG background with the tile fit, an SVG quote photo, an SVG picture bullet | Its PNG raster instead of a native SVG picture | `export-lossy`, `svg-rasterized` |
| Any other SVG image | A native SVG picture over a PNG fallback | none |
| `diagram` (Mermaid source) | By default (`diagrams: "shapes"`) a family in core `DIAGRAM_SHAPE_FAMILIES` (all 32 built-in families) is one group of native shapes, text and connectors built from the preview's own geometry (presets where the outline is one, freeforms otherwise, node labels as the node's text, straight edges without arrowheads glued to the nodes); an unchanged group imports as the diagram again, an edited one as its shapes; `diagrams: "picture"` (`--diagrams picture`) writes a native SVG picture over a PNG fallback instead, with `alt` (else a text derived from the diagram's labels) as its description, which also imports as the diagram | `diagram-shapes-unavailable` (info) for a diagram that stays a picture under the default: a family not compared yet, or a drawing with a clip path, filter, pattern, image or right-to-left text |
| `diagram` whose source cannot be parsed, or over 20,000 characters or 500 edges | A "Diagram unavailable" placeholder, as in the preview | a located finding (`The diagram cannot be drawn (line 2, column 9): ...`) |
| Animated WebP (default `images: compatible`) | A still PNG of the first frame; `--images preserve` keeps the WebP | `export-lossy`, `image-animation` |
| Still WebP | A PNG with the same pixels | none |
| Image that is not PNG, JPEG, GIF, WebP or SVG (BMP, TIFF, AVIF) | The unavailable-image placeholder, as in the preview | `unresolved-asset`, reason `unsupported-format` |
| Engine-defined pattern preset (`diagStripe`) | Its closest DrawingML preset (`wdUpDiag`) | `export-lossy`, `pattern-preset` |
| Unknown pattern preset | The pattern's background color only, as in the preview | `unsupported-pattern` (both engines) |
| Named CSS color (`"red"`) on a run | Not an OPF color: every engine draws the theme text color | `opf/run-color-unrecognized` (validation) |
| Chart color that cannot be resolved or has too little contrast | The adjusted color, in every engine | `opf/chart-colors-adjusted` (validation) |
| Chart option the chart type cannot show | The adapted chart, in every engine | `opf/chart-option-adapted` (validation) |
| Chartex chart type (treemap, waterfall, ...) PowerPoint has not confirmed | A clustered column chart (`--charts native` writes the chartex part) | `chart-data-adapted`, `chartex-fallback` |
| Content with no PowerPoint form | A plain-language placeholder frame | `content-placeholder` |
| `dateFormat` with no PowerPoint date field | Fixed text that PowerPoint does not update | `furniture-date-fixed` |
| Text in `--body-text native` that native mode cannot carry | Measured line boxes | `native-body-fallback` |
| A font a viewer may not have | The selected name; the viewer substitutes | `typeface-not-office-safe` in the `convert` report; `typefaces: 'safe'` replaces it (`typeface-replaced`) |

## Ship fonts as pinned, licensed files

Font bytes come from pinned packages or vendored files with a recorded hash, never from a font CDN at runtime. A stylesheet, import or preconnect hint that points at Google Fonts, Typekit, Bunny Fonts or a similar service hands every viewer's IP address to a third party (a German court treated that as a privacy violation in 2022), and it ties previews and audits to the network and to whatever the CDN serves that day. A build step that downloads a font once and then serves it from your own origin is fine; confirm the built output makes no font requests.

Before bundling a family, open the license file that ships with the font files and confirm it grants exactly one of OFL-1.1, Apache-2.0, MIT or UFL-1.0. Refuse GPL-family, proprietary and unclear-provenance fonts, and do not trust the source site's label. For each bundled face record the SPDX id, any Reserved Font Name, the source URL, the package and exact version, and the sha256. A Reserved Font Name only stops a modified version (subset, instance, converted copy) from using the reserved name in its name. If the family or file name you would serve contains the reserved name, ship only the copyright holder's own unmodified file and record the pinned upstream URL and matching hash; if it does not (a subset named differently from the reserved name), a modified copy is fine. Read the font's upstream license file, since a package can omit the line, and treat a notice you cannot parse as a failure rather than as no reserved name.

## Verify what the user will receive

Collect path-specific diagnostics, inspect rendered slides, and check requested exports. Use explicit pagination before preview/export when needed, and export those exact pages. Shared geometry does not guarantee identical pixels in browsers and PowerPoint.

Do not describe successful serialization as complete fidelity. Rich-text shaping, advanced chart variants, video playback, automatic branding placement, and external assets have known limitations in the current ecosystem. Native PPTX font names and line breaks do not mean font binaries are embedded. Describe substitutions or unsupported visuals that affect the requested deck.

Font policy (owner decisions, 2026-09-29; canonical text in `docs/font-fidelity.md` of the OPF repository): the user's selected font is the source of truth, and license-restricted (proprietary) fonts are never bundled or embedded. Previews, SVG and the editor draw an open look-alike that should look similar and be metric-compatible, so text takes the same size and wraps as in PowerPoint (Calibri as Carlito). Aptos, Aptos Display, Aptos Narrow and Aptos Serif preview as Intos (metric-compatible, in the opf-render office pack). Where no metric-compatible replacement exists yet, a visual-only look-alike is a documented fallback and a known layout-fidelity gap, not the end state. PPTX export always writes the selected name (for example `typeface="Aptos"`), never the preview replacement, so PowerPoint opens the file and shows the actual font; only an explicit `typefaces: 'safe'` writes another family, and then an Office-safe one, never the preview face. Only open fonts may be embedded, through the explicit embed path. Published opf-pptx 0.10.0 and later write the selected name; 0.9.1 and earlier wrote the substitute. Native viewers still require the named font to be available or apply their own substitution.

PPTX import is a conversion with limitations, not an assurance of lossless round-trip for arbitrary Office files. Validate and inspect the imported OPF and retain the original when making a derivative artifact.

Shapes import too (`docs/shapes.md`, "Importing shapes from PowerPoint"). A deck this export wrote returns its shape blocks, overlay shapes and connectors as authored (the native name says which; the slide's stored record returns ids, `at` anchors and named sites while the slide is unedited), except that a value the theme style gives (an explicit `fill: "accent1"` on the default style) comes back absent. A deck PowerPoint wrote has its free-positioned shapes that draw something imported as overlay shapes placed by fractions of the slide, its connectors as connectors bound by id (a free end is a line shape), and its groups flattened with their transforms; a filled shape across the whole slide is not imported (`import/shape-not-imported`), and a shape drawn behind a text box or picture imports with `layer: "back"` (`import/shape-covers-content` only for one between two pieces of content). 3-D, preset shadows, fill overlay, wrap, columns and autofit, alternative text titles, hover links, locks, black-and-white mode and custom data are dropped and reported as `import/shape-property-dropped` with the property named: read those findings, and say so when a PowerPoint deck's shapes are not all kept.

Prefer new output paths while developing a conversion; follow the user's explicit overwrite preferences. Creating a local export does not include publishing or sending it.
