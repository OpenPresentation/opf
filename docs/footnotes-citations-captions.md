# Footnotes, citations and captions

Program item RR-34 (release readiness, scope 2). Three additive spec features, each end to end: core
(schema, validation, shared composition geometry), the SVG preview, native PPTX export and import,
and the editor. A deck without the new fields validates, composes, previews and exports exactly as before
(every bundled example slide composes to the same geometry; the renderer's raster baseline is unchanged).

## Schema

- `TextRun.cite`: a reference id, or an array of ids, from the top-level `references` list.
- `TextRun.footnote`: an inline note (string or `TextRun[]`) with no references entry.
- `references` (presentation root): `[{ id, text, url? }]`; `text` is a string or `TextRun[]`.
- `caption` on an `image`, `chart`, `table` or `video` payload (a block, a promoted region payload, or the
  slide root when it holds exactly one of those payloads): a string, `TextRun[]`, or
  `{ text, position?: "below" | "above", align?: "left" | "center" | "right" }` (defaults `below`, `left`).

```json
{
  "references": [
    { "id": "gartner-2026", "text": "Gartner, Market Guide for Presentation Tooling, 2026", "url": "https://www.gartner.com" }
  ],
  "slides": [
    {
      "title": "Adoption is accelerating",
      "blocks": [
        { "text": [{ "text": "Enterprise adoption doubled in 2025", "cite": "gartner-2026" }, { "text": " and keeps growing.", "footnote": "Internal forecast, not audited." }] },
        { "chart": { "type": "bar", "data": { "columns": ["Year", "Share"], "rows": [["2024", 12], ["2025", 24]] } }, "caption": { "text": "Figure 1. Adoption share by year", "align": "center" } }
      ]
    }
  ]
}
```

Validation (`validate`, category `format`, errors): `cite-unknown-reference` (an id missing from `references`, at
the `cite` field), `reference-id-duplicate`, `caption-unsupported-payload` (a caption on a text, list,
code, metric, quote or timeline payload, on a group, or on a slide root with several payloads) and
`cite-unsupported-location` (`cite`/`footnote` on a run in a table cell, a caption, a reference text or a
footnote text, where no engine draws a marker). Each is reported under its code as the rule id
(`opf/cite-unknown-reference`), and the `references` category adds the warning `opf/unused-reference` for a
reference no run cites. Markers are supported in the slide `tag`, `title` and `subtitle` when they are
`TextRun[]` (FA-10), and in `text`, `bullets`, list item (`text`, `description`) and `quote.text` runs; that is
the "unsupported location" boundary, chosen so the engines never silently drop a marker (vetoable).

## Numbering

`collectCitations(presentation)` numbers every marker per deck in reading order: slides in order, then
inside a slide the heading group first (`tag`, `title`, `subtitle`, the order the slide stacks them), then the
promoted regions (sorted keys), the blocks (recursively) and the root payload, then the runs. Headings read
before the body, so a marker on a headline claim takes the lowest numbers of its slide (FA-10, vetoable). The same reference id keeps its number wherever it is cited; every inline footnote takes a new
number. A run that cites several ids shows `1,2`. `slideCitations(slide, slideIndex, presentation)`
gives one slide's markers and notes with the deck numbering (the slide object may be a paginated page or
a copy); without a presentation the slide numbers from 1 and unresolved ids are listed by id with an
`unresolved-content` diagnostic. Hidden slides take part so numbers do not shift when a slide is shown.

## Geometry (core composition)

- **Markers.** `richTextLayouter` emits a fragment `{ kind: "marker", text: "1" }` directly after the
  last fragment of a run with a marker (`RichTextOptions.citationMarker(runPath)`; `composeSlide`
  supplies it from `slideCitations`). The marker has zero source length (`start === end ===
  run.text.length`) so run indexes and `data-opf-text-*` offsets never shift; it wraps with its word; its
  glyph size is `CITATION_MARKER_SCALE` (2/3) of the run's (the exporter writes the run's own size; PowerPoint draws 2/3 of it) and it is raised by `CITATION_MARKER_RAISE`
  (0.3) of the run's size, which is exactly DrawingML `baseline="30000"` through the exporter's existing
  `-baselineShift / nominalSize * 2000` formula (PowerPoint's own superscript button writes 30000). An
  existing `superscript: true` run keeps its larger raise (`baseline="50000"`).
- **Footnote area** (`layoutFootnotes`, `geometry.footnotes`, algorithm `footnote-area-v1`). A slide
  whose runs carry markers gets an area directly above the footer band (or the bottom padding), with the
  content area's left edge and width: a 1 px rule, half a line of space, then `<n> <text>` for each note
  the slide uses in number order (a rich reference text keeps its runs after the number). Text is the
  body family at the furniture size (`max(13 * scale, minFontSize)`), in the muted text colour. The
  content area shrinks by exactly the area's height plus half the slide gap; headings, cover centering and
  everything above are unchanged. The area takes at most `FOOTNOTE_MAX_RATIO` (35%) of the span between
  the heading top and the footer band; notes beyond that report `text-overflow` at their source path
  (`references.N` or the run's path) and pagination treats it like any other fit overflow (splitting
  content can move markers to other pages). Slides without markers have no area.
- **Caption band** (`layoutCaption`, `item.caption`). Inside the block's region (the card interior when
  content cards are on) a band of the caption's measured height is reserved below the media (or above
  it); the media keeps the rest less a gap of 0.4 of the caption size, and `item.box` is that media box.
  Caption text is the body family at `max(CAPTION_FONT_RATIO (0.6) * 25 * scale, minFontSize)`, muted,
  aligned per `align`. The band takes at most `CAPTION_MAX_RATIO` (35%) of the region; a caption that
  does not fit reports `text-overflow` at the caption path. Automatic grid selection scores the captioned
  leaf on its media box.
- `referencesSlide(presentation, { title? })` returns an ordinary slide (`{ title, items }`) listing the
  cited references in marker order as `n. text` (with a linked url run when there is one); the deck that
  cites nothing gets a title-only slide. It is plain content: editable, exportable, no new schema.

## Preview (opf-render)

Draws what core returns: marker fragments as superscript `<text>`/`<tspan>` elements with
`data-opf-segment="marker"` and no `data-opf-text-start/end` (so the editor never treats them as source
text), the footnote area (rule in the border colour, entries in the muted text colour, `data-opf-footnote`
trace attributes) after the content and before the furniture, and caption bands in the muted colour with
the caption path as `data-opf-path`.

## PPTX (opf-pptx)

- Markers export through the existing rich-run path as native superscript runs (`baseline="30000"`), so a
  marker is ordinary editable text in PowerPoint.
- The footnote area is a thin line shape and one text box per listed line, named `OPF footnotes <slide>
  rule` / `OPF footnotes <slide> entry <k> line <n>` and tagged `OPF_FOOTNOTES_V1` (number, kind,
  reference id, line boundaries), at core's geometry above the footer placeholders.
- A caption is one text box per fitted line, named `OPF caption <path> line <n>`, tagged `OPF_CAPTION_V1`
  (payload path, the media shape's name, position, alignment, line boundaries), at core's band.
- Provenance: `references` is stored in the document record as a top-level key (like `author`: importers up to
  0.11.9 drop a tag with an unknown `supplement` field but ignore an unknown top-level key) and read back into
  `metadata.references`. Import re-attaches captions from their tags to the media
  shape they name, rebuilds the references list and each run's `cite`/`footnote` from the footnote tags and
  the superscript marker runs (the marker runs are removed from the imported text; an edited note keeps its
  new text), and restores uncited references from the document record. Without tags nothing is guessed: a
  text box under a picture stays a text block and a superscript number stays a superscript run.

## Editor (opf-editor)

`@openpresentation/opf-editor/annotations`: `readCaption` / `setCaption` on image, chart, table and video
blocks, `listReferences` / `addReference` / `updateReference` / `removeReference`, `citeRun` / `unciteRun`
and `setFootnote` on a run path, and `listCitations` (the deck numbering). Every write is one validated,
undoable session edit.

## Decisions and deviations from the brief

Recorded as vetoable decisions; the brief is `rr-33-35/DECISIONS.md` (RR-34 section).

- Marker size and raise (measured). A marker is exported as a superscript run at the marked run's own size with
  `baseline="30000"`, as a user ticking Superscript would. PowerPoint draws such a run at 2/3 of its size and raises
  it by 0.30 of the nominal size; core composes exactly that (glyph `fontSize` = 2/3 of `nominalSize`, snapped to
  the 0.01 pt grid; `baselineShift` = 0.30 of `nominalSize`). Measured in PowerPoint 365 on Windows, 2026-10-01,
  with `probe-superscript.pptx` (Roboto and Aptos, 10 to 44 pt): digit ink height of the superscript run against a
  plain run of the same size 0.655 to 0.69 (mean 0.667), independent of face and size; raise 0.30 of the nominal size
  at every size. The first version wrote `sz` = 0.7 of the run on top of that and PowerPoint reduced it again
  (about 0.47 of the run), which the first native check caught. An authored `superscript: true` run is unchanged.
- Supported locations. Markers are drawn in `text`, `bullets` and list item runs. Table cells, captions,
  reference and footnote texts reject `cite`/`footnote` with `cite-unsupported-location` instead of
  accepting a marker that no engine would draw.
- Footnote text size equals the furniture size (the readable floor on a 16:9 deck), not a size below it:
  core never draws text under `minFontSize`.
- Unused references are a warning only (`opf/unused-reference`, category `references`), never an error.
- Round trip. The run-level association comes back from the marker numbers and the tagged footnote lines
  (one number, one note), not from a stored per-run record: it is exact for every authored form, and an
  edited or deleted marker in PowerPoint changes the document the way the user edited it.
- Pagination validates a page together with the deck's `references` (a page that cites would otherwise be
  invalid on its own).
