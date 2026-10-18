# First deck: from `deck.opf.json` to PowerPoint or Keynote

A six-slide deck you can run in ten minutes. It uses the content kinds most decks need: bullets, a metric, a chart, a styled table and a local image. The company, numbers and picture are made up. The picture (`assets/roastery.svg`) was drawn for this example and is MIT-licensed like the rest of the repository.

| Slide | Shows |
| --- | --- |
| 1 | Cover: `tag`, `title`, `subtitle` |
| 2 | `bullets` |
| 3 | A `metric` beside bullets, in a two-column row of `blocks` |
| 4 | A column `chart` with one highlighted bar and a number format |
| 5 | A styled table: bold header runs, a `padding` object, right-aligned number columns and one colored run |
| 6 | A local `image` beside bullets |

The deck also sets a footer with a slide number (`{{slide.number}} / {{deck.slideCount}}`). The theme and font scheme records are embedded in the file (`opf embed`), so it renders with no catalog installed.

## 1. Install

You need Node 22 or later (Node 24 is recommended).

```sh
npm install -g @openpresentation/cli
opf --version
```

PNG and PPTX output need extra packages. Ask the CLI which ones, and run the one install line it prints:

```sh
opf doctor deck.opf.json --format text
```

When every format shows `ready`, you are set. Get this folder from the repository (`docs/first-deck/`: `deck.opf.json` and `assets/roastery.svg`), and run the next commands inside it. The image path in the deck is relative (`assets/roastery.svg`), so keep the two together.

## 2. Validate

```sh
opf validate deck.opf.json --format text
```

Expected: `0 findings (0 errors, 0 warnings, 0 info)`. Validation checks the file and the layout estimate. It does not draw the slides, so look at the PNGs next.

## 3. Draw PNGs

```sh
opf convert deck.opf.json slides/deck.png
```

This writes `slides/deck-1.png` to `slides/deck-6.png`, one per slide. Open them and read every slide. This is OPF's own preview, not PowerPoint's.

## 4. Export PPTX

```sh
opf convert deck.opf.json deck.pptx
```

Add `--fail-on warning` to either `convert` command to make a warning stop the build.

## 5. Open it in PowerPoint or Keynote

- **PowerPoint:** double-click `deck.pptx`, or File > Open.
- **Keynote:** drag `deck.pptx` onto the Keynote icon, or File > Open. Keynote converts the file into its own format on open.

Compare each slide with its PNG. Line breaks should match. If the app asks about missing fonts, see "Fonts" below.

## 6. Change something and run it again

Edit `deck.opf.json` (change a bullet, a chart value, a title), then repeat steps 2 to 4. OPF stays the source of truth; the PPTX is an output. To patch from a script instead of an editor, see `opf edit --help`.

## Known limits

- **Text editing in PowerPoint and Keynote does not reflow.** The export writes one text box for each wrapped line, so the app breaks lines where the preview did. Typing inside a box works. Adding or lengthening text does not push words into the next line: it runs past the box or overlaps the line below. In this deck, slide 3's second bullet is two boxes. A title that wraps is several line boxes, not the Title placeholder (all six titles here fit on one line, so they are real titles). For bigger text changes, edit `deck.opf.json` and export again. From opf-pptx and CLI 0.22.0 an opt-in mode writes real paragraphs: `opf convert deck.opf.json deck.pptx --body-text native` (see [when to choose it](../cli.md#pptx-text-rr-88-rr-91)).
- **Fonts are named, not embedded.** The deck uses Roboto. The PPTX records the name `Roboto` and no font file. On a computer without Roboto, PowerPoint or Keynote substitutes another font and lines can break differently. Install Roboto (an open font) on the computer that opens the file, or pick a font that computer already has. The PNGs always use OPF's bundled copy.
- **Footers.** A footer zone (left, center, right) sits on the content inset, and a zone beside empty zones takes their width, so a lone `left` footer spans the content width. A footer that would wrap onto more than two lines gets the `opf/furniture-wraps` warning: keep footers to a few words, and put a per-slide source in a `caption` on the chart, table or image it describes, or in the slide notes. A footer such as `{{slide.number}} / {{deck.slideCount}}` is exported as fixed text from opf-pptx and CLI 0.22.0 (Keynote shows only the digit of a live number with words around it), so in PowerPoint its number does not follow slides you reorder there.
- **Text size.** Table cells draw at the body size (about 19 pt) and shrink together to fit, and chart text is 15 pt, so no per-cell `fontSize` is needed. A run's own `fontSize` still wins when you want one cell larger or smaller. See the table section of the [content guide](../../skills/opf-author/references/content.md).
- **The picture is an SVG.** PPTX export includes it with a PNG fallback for apps that cannot draw SVG.
- **Not checked here:** the PPTX was converted and inspected with the workspace CLI. Open it in the app you use before you send it.
