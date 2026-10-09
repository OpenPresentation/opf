# Native header and footer (RR-11)

OPF footers compile into PowerPoint's own Header & Footer objects: the footer text, the date and the slide number
are real `ftr`, `dt` and `sldNum` placeholders on the slide, with matching placeholders on the slide master and layout
and `p:hf` flags, so Insert > Header & Footer shows the right state and "Apply to All" works
([core issue 87](https://github.com/OpenPresentation/opf/issues/87)). Parts PowerPoint has no object for stay the
ordinary tagged shapes the exporter has always written (`OPF_FURNITURE_V1`, see the README furniture section).
The geometry is core's and does not move: preview, export and the parity harness agree.

## Mapping

OPF furniture has two bands (`design.header`, `design.footer`), three zones each (left, center, right) and parts
stacked in a zone: logo, image, text, socials, date. Generated values (slide number, slide count, section, organization name,
speaker) are `{{ }}` variables inside the zone's `text` (FA-31): there are no per-value flags. `{{slide.number}}`,
`{{slide.section}}` and `{{deck.slideCount}}` are filled in for each slide as it is laid out; core marks each substituted
`{{slide.number}}` as a slide-number field (`part.fields`), which is what this exporter writes as a native field.

| OPF part | PowerPoint object | Notes |
| --- | --- | --- |
| `footer.<zone>.text` without a `{{slide.number}}` (the first one, one accepted line) | **Footer placeholder** (`ftr`, layout idx 11) | The dialog's Footer text. |
| `footer.<zone>.date` (the first one, one line) | **Date placeholder** (`dt`, idx 10) | `date: true` with an en-US pattern is a live `datetime1`-`datetime7` field ("Update automatically"); a fixed or literal date, or a pattern with no field type, is fixed text ("Fixed"). |
| `footer.<zone>.text` with a `{{slide.number}}` (the first one, one line) | **Slide Number placeholder** (`sldNum`, idx 12) | Each substituted number is a live `slidenum` field; the words around it (`Page `, ` of 12`) and a `{{deck.slideCount}}` or `{{slide.section}}` value are fixed runs. |
| every header part (text, socials, date, image, logo) | ordinary tagged shapes | PowerPoint slides have no header placeholder (`hdr` exists on notes and handouts only). A header `{{slide.number}}` is still a live field inside its shape. |
| footer socials, image, `logo: true` | ordinary tagged shapes | No native object. |
| a second footer text, date or text with a slide number in another zone | ordinary tagged shapes | One placeholder per type per slide; the second keeps its live fields. |
| footer text, date or number text that breaks or wraps over several lines | ordinary tagged shapes (one per line) | A placeholder is one shape; core's accepted lines are never re-wrapped by PowerPoint. A `{{slide.number}}` that fits one of the lines is still a live field. |
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
  * `sldNum` needs a `slidenum` field and imports as the zone's `text`, with each native slide-number field as
    `{{slide.number}}` and the words around it kept (`Page {{slide.number}}`); a count or a section is never inferred
    from a digit or a name;
  * `dt` with a `datetime1`-`datetime7` field imports as `date: true` (+ `dateFormat` unless M/d/yyyy); fixed text, a time
    field and `datetimeFigureOut` keep their current words as a literal date string;
  * `ftr` imports its text (paragraphs joined by a newline; a native slide-number field in it is `{{slide.number}}`); an empty
    placeholder is ignored. A footer text and a slide number in the same zone are one `text`: the footer words, then the number's line.
  * The footer most slides share becomes `design.footer` (two or more slides, or a one-slide deck), a slide with no such
    placeholders becomes `design.footer: false` and a slide that differs keeps its own footer.
* **A tagged deck edited in PowerPoint.** An untagged placeholder on a tagged slide (Apply to All on a deck whose footer was
  hidden, or a removed placeholder added again) merges into that slide's footer by the same rules; a field it would
  duplicate stays ordinary text with `invalid-furniture-provenance`.

| In PowerPoint | Imports as |
| --- | --- |
| Slide number unchecked on slide 3 (Apply) | `slides[2].design.footer` without the slide-number text; the other slides keep `design.footer` |
| Slide number unchecked with Apply to All | `design.footer` loses the slide-number text (no per-slide copies) |
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
   `{{deck.slideCount}}` or `{{slide.section}}` from a digit or a name.
9. (FA-31) A footer `text` with a slide number is the whole `sldNum` placeholder, words included (`Page 3 of 12`): the dialog's
   Slide number checkbox then adds or removes the whole text, and the dialog never rewrites its words. A zone `text` with two
   numbers is still one `sldNum` placeholder with two fields.
10. (FA-31) Furniture provenance stores the authored `text` of a zone whose `{{ }}` tokens are all built-in variables
    (`deck.*`, `speaker.*`, `speakers`, `organization.*`, `slide.*`, `deck.slideCount`), taken from the document as given to
    `toPptx`, before the deck-wide pass resolves them (`templates` in the slide manifest, beside `formats`; older importers
    ignore the key). Import restores it only while that text, drawn for this slide, equals the words now on the slide: the
    deck-wide built-ins are resolved with core's `resolveVariables` from the stored organization and speakers and the observed
    name, description and author, then the slide's number, the deck's slide count and its section in PowerPoint's section list. If
    the words were edited, the metadata changed or the slide moved, the current words import with each native slide-number
    field as `{{slide.number}}` (typed words that spell a token are escaped), so a moved slide keeps a live number and an edit is
    never overwritten. Without the stored document record (`provenance: false`, another tool) there is no metadata to draw from,
    so a `{{organization.name}}` zone imports as its words.
11. (FA-31) Social profiles belong to the organization the manifest names by id, and no furniture text shows an organization's
    name any more, so only the stored document record can supply it; without the record the profile lines import as ordinary
    text with `invalid-furniture-provenance`.
12. (FA-31) The authoring flags (`organization`, `speaker`, `section`, `slideNumber`, `slideNumberFormat`) are gone with no alias:
    `{{organization.name}}`, `{{speaker.name}}` and `{{customer}}` resolve before export like any string. A text that also uses
    a user variable (`{{customer}}`) is not stored: the filled deck is what round-trips, so its words import (a slide-scoped token in
    it still returns as a token, from the filled text).

## Not covered

PowerPoint opening, editing and re-saving these files is a native check (`scratchpad/rr-11-native/manifest.json`), not
something the unit tests establish. Moving a layout placeholder in PowerPoint does not move slides that carry their own
`a:xfrm`. Handout master and `hdr` text on notes pages are not produced.

## Tests

`npm run test:furniture` includes `test/native-furniture.mjs`: every OOXML part (slide, layout, master, notes master,
presentation), geometry parity with core (measured and estimated fonts), the parts that stay shapes, the dialog edits above,
inherited placeholders written the way PowerPoint writes them, older tagged exports, and determinism. `test/slide-variables.mjs`
covers the `{{slide.number}}`, `{{deck.slideCount}}` and `{{slide.section}}` forms: native field plus fixed words, body tokens as
fixed text, consecutive numbers on a paginated deck, the tokens through a round trip and third-party footers.
