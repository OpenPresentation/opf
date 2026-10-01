# Native header and footer (RR-11)

OPF footers compile into PowerPoint's own Header & Footer objects: the footer text, the date and the slide number
are real `ftr`, `dt` and `sldNum` placeholders on the slide, with matching placeholders on the slide master and layout
and `p:hf` flags, so Insert > Header & Footer shows the right state and "Apply to All" works
([core issue 87](https://github.com/OpenPresentation/opf/issues/87)). Parts PowerPoint has no object for stay the
ordinary tagged shapes the exporter has always written (`OPF_FURNITURE_V1`, see the README furniture section).
The geometry is core's and does not move: preview, export and the parity harness agree.

## Mapping

OPF furniture has two bands (`design.header`, `design.footer`), three zones each (left, center, right) and parts
stacked in a zone: logo, image, text, organization, socials, section, slide number, date.

| OPF part | PowerPoint object | Notes |
| --- | --- | --- |
| `footer.<zone>.text` (the first one, one accepted line) | **Footer placeholder** (`ftr`, layout idx 11) | The dialog's Footer text. |
| `footer.<zone>.date` (the first one, one line) | **Date placeholder** (`dt`, idx 10) | `date: true` with an en-US pattern is a live `datetime1`-`datetime7` field ("Update automatically"); a fixed or literal date, or a pattern with no field type, is fixed text ("Fixed"). |
| `footer.<zone>.slideNumber` (the first one, one line) | **Slide Number placeholder** (`sldNum`, idx 12) | The number is a live `slidenum` field; `slideNumberFormat` text and `{total}` are fixed runs around it. |
| every header part (text, organization, section, slide number, date, socials, image, logo) | ordinary tagged shapes | PowerPoint slides have no header placeholder (`hdr` exists on notes and handouts only). |
| footer organization, section, socials, image, `logo: true` | ordinary tagged shapes | No native object. |
| a second footer text, date or slide number in another zone | ordinary tagged shapes | One placeholder per type per slide; the second keeps its live fields. |
| footer text, date or slide number that breaks or wraps over several lines | ordinary tagged shapes (one per line) | A placeholder is one shape; core's accepted lines are never re-wrapped by PowerPoint. |
| empty footer text | ordinary tagged shape | |

Each native shape is the same shape the exporter wrote before (same name `OPF furniture N part K line 0`, same explicit
`a:xfrm`, runs, fields and `OPF_FURNITURE_V1` tag) plus `<p:ph type=".." sz=".." idx=".."/>` and `a:spLocks noGrp`.
The footer manifest marks such a part with `ph` (`dt`, `ftr` or `sldNum`). A slide whose `design.footer` is `false`
(or has no such part) has no placeholder of that type, which the dialog shows as unchecked.

## Master, layout, notes master, presentation

* **Slide master and layout.** Every deck, with or without a footer, gets on the master Date (idx 2), Footer (idx 3) and
  Slide Number (idx 4) placeholders and the layout the three layout placeholders (idx 10, 11, 12) the slides point at.
  They sit where the first slide's native part of that type sits; a type no slide uses sits where core draws a default
  footer (date left, text center, number right, composed through `composeSlide`). Their text style (size, theme colour,
  font) is the first furniture run's, so a footer added through the dialog looks like the exported ones.
* **`p:hf`.** Master and layout: `hdr="0"` (slides have no header placeholder) and `sldNum`, `ftr`, `dt` are `1` when at
  least one slide carries that placeholder, else `0`.
* **Notes master.** OPF has no notes header or footer, so nothing is mapped. PowerPoint's own notes placeholders stay and
  `<p:hf hdr="0" ftr="0" dt="0"/>` records that the notes pages carry a page number only, as the generated notes slides do
  (Insert > Header & Footer > Notes and Handouts shows Page number only).
* **Presentation.** There is no deck-wide header/footer setting in `presentation.xml` other than
  `showSpecialPlsOnTitleSld` ("Don't show on title slide"). It only affects layouts typed as title layouts and the exporter
  writes one untyped layout, so it is not written. Hiding a footer on a cover stays the slide-level `design.footer: false`.
* A deck without a native footer part still gets the placeholders, at core's default footer band, with `p:hf sldNum="0" hdr="0"
  ftr="0" dt="0"`: Insert > Header & Footer works on it, Apply to All creates the placeholders on every slide at the
  master positions, and the import reads them back as the deck's footer. Its text style is the first header furniture run's,
  or the master's own text style when the deck has no furniture at all (a footer added there is not muted). The placeholders
  carry the deck's language (`lang`) like every other part.
* Measured over the 126 bundled examples against the previous output: 43 decks gain the three parts' placeholders (only
  `slideMaster1.xml`, `slideLayout1.xml` and `notesMaster1.xml` change, +3,043 bytes uncompressed per deck across the three), 58 decks with a footer
  change only the `lang` attributes of the master and layout placeholders, 25 are byte-identical; no slide, tag, chart, theme
  or relationship part changes.

## Import

`fromPptx` reads native placeholders back whether or not OPF tags are present.

* **With provenance** the tagged placeholder is read like the tagged shape it replaces, so the footer returns exactly
  (zones, formats, scope). The manifest's `ph` marks a part PowerPoint can remove: when the dialog deletes it, the part is
  dropped from that slide's footer instead of invalidating the footer; the slide becomes its own override while other slides
  that agree still form the deck's footer. Older importers (0.11.6 and earlier) ignore `ph` and read the same tagged shapes
  (`test/provenance-interop.mjs` runs published 0.11.6 against an export).
* **Without provenance** (a PowerPoint deck, a tag-stripped export, a footer added through the dialog) every `dt`,
  `ftr` or `sldNum` placeholder with content is footer furniture and never slide content:
  * the zone is the horizontal third of the placeholder's centre, resolved through the slide, its layout (same idx) and
    the master when the slide gives no `a:xfrm`; no geometry means date left, footer center, number right;
  * `sldNum` needs a `slidenum` field and imports as `slideNumber: true`, with the words around the field as
    `slideNumberFormat` (`Page {current}`); `{total}` is never inferred from a digit;
  * `dt` with a `datetime1`-`datetime7` field imports as `date: true` (+ `dateFormat` unless M/d/yyyy); fixed text, a time
    field and `datetimeFigureOut` keep their current words as a literal date string;
  * `ftr` imports its text (paragraphs joined by a newline); an empty placeholder is ignored.
  * The footer most slides share becomes `design.footer` (two or more slides, or a one-slide deck), a slide with no such
    placeholders becomes `design.footer: false` and a slide that differs keeps its own footer.
* **A tagged deck edited in PowerPoint.** An untagged placeholder on a tagged slide (Apply to All on a deck whose footer was
  hidden, or a removed placeholder added again) merges into that slide's footer by the same rules; a field it would
  duplicate stays ordinary text with `invalid-furniture-provenance`.

| In PowerPoint | Imports as |
| --- | --- |
| Slide number unchecked on slide 3 (Apply) | `slides[2].design.footer` without `slideNumber`; the other slides keep `design.footer` |
| Slide number unchecked with Apply to All | `design.footer` loses `slideNumber` (no per-slide copies) |
| Everything unchecked on slide 3 | `slides[2].design.footer: false` |
| Footer text retyped, Apply to All | `design.footer.<zone>.text` is the new text |
| Date changed to "Fixed" and typed | `date` is that text (literal) |
| Date format changed in the dropdown | `dateFormat` is that pattern while it is a `datetime1`-`datetime7` type |
| Slide moved | nothing: the fields renumber in PowerPoint |
| Footer added to a deck that had none | `design.footer` at the placeholder's zone |

## Decisions (vetoable)

1. Only footer parts map natively; the header stays shapes (PowerPoint has no slide header object).
2. The first eligible part of each type wins, and a native part is one accepted line. A multi-line or wrapped footer text
   stays one tagged shape per line rather than a multi-paragraph placeholder PowerPoint could re-wrap.
3. Every slide placeholder keeps core's explicit `a:xfrm` (no inheritance from the layout) so geometry cannot drift from
   the preview. The cost: PowerPoint's "Reset" on a slide moves the footer to the layout position.
4. Shape names stay `OPF furniture N part K line 0` (harnesses and tags key on them) instead of PowerPoint's
   "Footer Placeholder 3".
5. Master and layout placeholders exist in every deck (flags off when unused), so Insert > Header & Footer works on a deck with
   no footer. This was first limited to decks that use one to keep other exports byte-identical; the byte-identity controls
   were then updated deliberately (see the measurement above).
6. `p:hf` flags mean "some slide uses it", not "every slide": a deck whose cover hides the footer still has the footer on
   for new slides.
7. The notes master gets flags only; `showSpecialPlsOnTitleSld` is not written (one untyped layout).
8. Import maps a `datetime` field with no OPF pattern to literal text rather than a wrong `dateFormat`, and never infers
   `{total}`.

## Not covered

PowerPoint opening, editing and re-saving these files is a native check (`scratchpad/rr-11-native/manifest.json`), not
something the unit tests establish. Moving a layout placeholder in PowerPoint does not move slides that carry their own
`a:xfrm`. Handout master and `hdr` text on notes pages are not produced.

## Tests

`npm run test:furniture` includes `test/native-furniture.mjs`: every OOXML part (slide, layout, master, notes master,
presentation), geometry parity with core (measured and estimated fonts), the parts that stay shapes, the dialog edits above,
inherited placeholders written the way PowerPoint writes them, older tagged exports, and determinism.
