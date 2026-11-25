# Keynote 16.0 scripting dictionary: what it exposes, what it does not, and how it behaves

Source: `keynote.sdef` (Keynote 16.0, build 7052.0.68, `/Applications/Keynote Creator Studio.app/Contents/Resources/Keynote.sdef`
with its CocoaStandard `xi:include` expanded). "Tried" = run against Keynote 16.0 on this Mac on 2026-11-25 by the tools in this
folder; everything else is read from the dictionary only.

## Exposed and used by the tools

| Object | Properties / commands | Tried |
|---|---|---|
| application | `version` ("16.0"), `open`, `close … saving no`, `export` | yes |
| document | `id`, `name`, `width`, `height`, `slide numbers showing` (rw), `document theme` (name), `auto play`, `auto loop`, `auto restart`, `maximum idle duration`, `password protected`, `current slide` (rw), `selection` (rw), `slide layouts`, `file` | yes; `file` is `missing value` for an imported .pptx, so a document cannot be tied to its .pptx path (kn-run keeps a ledger of the ids it opened) |
| slide | `slide number`, `skipped`, `base layout` (name), `title showing`, `body showing`, `default title item`, `default body item`, `presenter notes`, `transition properties` (effect, duration, delay, automatic) | yes, all in one event per document (`properties of every slide`, `name of base layout of every slide`, `properties of default title item of every slide`) |
| iWork item | `position`, `width`, `height`, `locked`, `parent` | yes |
| shape / text item | `object text`, `background fill type` (only the kind: no fill / color fill / …), `rotation`, `opacity`, `reflection showing`, `reflection value` | yes |
| rich text (paragraph, word, character) | `font` (PostScript name), `size`, `color` (16-bit RGB) — nothing else | yes, per paragraph and per word |
| image | `description` (rw), `file name`, `file`, `rotation`, `opacity`, reflection | yes; reading `file` throws -10000 (see below) |
| line | `start point`, `end point`, `rotation`, reflection | yes |
| group | iWork container (nested items), geometry, `rotation` | yes |
| table | `name`, `row count`, `column count`, `header row count`, `header column count`, `footer row count` (all settable), `cell range`, `selection range`; commands `merge`, `unmerge`, `clear`, `sort` | yes (row count set: rows are added at the end) |
| cell / range / row / column | `value` (rw), `formatted value`, `formula`, `format`, `alignment`, `vertical alignment`, `text color`, `background color`, `font name`, `font size`, `text wrap`, `name`; row `height`, column `width` | yes, bulk per table (`value of every cell of t` = one event) |
| chart | nothing beyond iWork item geometry; `add chart` (new chart from data) exists | yes: `properties of chart` = position, size, locked, parent only |
| movie / audio clip | file name, volume, repetition | not in the test decks |
| export | `slide images` (PNG/JPEG/TIFF; options `image format`, `skipped slides`, `all stages`, `compression factor`), `Microsoft PowerPoint`, `PDF`, `HTML`, `QuickTime movie`, … ; no size or resolution option | PNG and PowerPoint tried |

## Not exposed (needs the UI, the round trip, or cannot be read)

- **Chart data and chart type**: no properties, no data element, no edit. The Chart inspector shows the chart type (e.g. "2D Donut")
  and options in the background (selection set through `selection`); Edit Chart Data needs the menu or a canvas double-click, both
  refused in background mode (UI-RECIPES.md).
- **Paragraph alignment, spacing, bullets and numbering, text direction, bold/italic flags, letter spacing, links**: not in the
  rich-text class. Alignment and "Bullets & Lists" can be read in the Text inspector in the background; links, and the round trip
  (`back.pptx` + `pptx_inspect.py --diff`) shows what Keynote writes for each of them.
- **Item names, preset shape type, z-order, placeholder types, footers and slide-number fields**: not exposed (z-order = element
  order). Table names are the exception.
- **Merged cells**: `merge`/`unmerge` exist, the merge state cannot be read.
- **Import warnings and missing fonts**: nothing in the dictionary. See README "Import warnings".
- **Shape fill colors, line color/width/dash, shadow**: only `background fill type`.

## Behavior found while building the tools (tried)

1. `properties of every iWork item of slide` returns every item's record in one event; it **fails with -10000 if any item is an
   image**, because reading an image's `file` throws -10000 ("AppleEvent handler failed"). Per-item `properties` fails for that image
   too. kn.applescript falls back: bulk → per item → each property of the class on its own (`readMode` bulk/item/single in probe.json).
2. **`every shape` and `every text item` misreport the title placeholder** (`count of shapes` = 0 on a slide whose title record says
   `class: shape`; `class of every text item` lists 5 items including shapes). Address items as `iWork item i` only.
3. `properties of every slide` takes one event; `properties of default body item` on a slide whose body is off returns position
   {0,0} and size 0x0 (not an error).
4. **Image description**: Keynote 16.0 builds an imported picture's description from the picture's `p:cNvPr` **`title` and `name`**
   ("Harbor\n\nOPF image 1"), **not from `descr`** ("Harbor at dusk with cranes and containers"). With no `title` it is just the name
   ("OPF image 2"). Seen in `description of image` and in the Image inspector's Description box (coverage-images slide 1).
5. Coercing an enumeration to text must happen inside a `tell application id "com.apple.Keynote"` block, else you get raw codes.
6. Exported slide pictures are 960x540 for a 13.33x7.5 in deck (1 px per point) with a Display P3 ICC profile and an alpha channel;
   files are named `<folder>.NNN.png` and numbered among the exported slides only.
7. `slide layouts` of an imported deck lists every master's layouts (243 names for 41 layouts on one deck): names repeat.
8. Latency: Keynote answered most events in 0.1-0.3 s, but in one stretch every event took 3-30 s (seen right after a killed
   probe left events queued; it recovered on its own within minutes). kn-run gives each action its own timeout.
9. `selection` (document, rw) works in the background: `set selection to {chart 1 of slide 6}` selects the object in the window and
   the Format inspector shows its properties; `set current slide` moves the window to the slide. This is what makes background
   computer-use reading possible.
10. Moving a shape with `set position` moves the lines attached to it (their `start point`/`end point` change), which tells a
    connection line from a free line without the UI (`kn-edit --op move`).

## New compared with the properties the 0.34/0.35.1 tools used

The earlier probes (`prior/mac-034/tools/kn-probe2.applescript`) read `name of base layout`, `title showing`, `object text`, `font`
and `size` of text items and paragraphs, `count of slides` and cells' fonts, one Apple event per value. New here: bulk
`properties of every …`, `document`'s `selection` (rw) and `current slide` for UI work, image `description`, line points, table
header/footer counts and per-cell format/alignment/colors, transitions, presenter notes, slide numbers showing, `skipped`. Hidden
items in the 16.0 dictionary (deprecated): `playing`, `slide switcher visible`, `frozen`, `start slideshow`, `show next`, …
Nothing that the earlier tools used is gone.

Keynote's scripting dictionary is not copied here: read it from the application (`Contents/Resources/Keynote.sdef`).
