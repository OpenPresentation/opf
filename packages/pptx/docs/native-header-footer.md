# Native header and footer (RR-11)

OPF footers compile into PowerPoint's own Header & Footer objects: the footer text, the date and the slide number
are real `ftr`, `dt` and `sldNum` placeholders on the slide, with matching placeholders on the slide master and layout
and `p:hf` flags, so Insert > Header & Footer shows the right state and "Apply to All" works
([core issue 87](https://github.com/OpenPresentation/opf/issues/87)). Parts PowerPoint has no object for are the
ordinary tagged shapes the exporter has always written (`OPF_FURNITURE_V1`, see the README furniture section); since
RR-72 one that is drawn the same on two or more slides is written once, on the slide master or a layout
([Master furniture](#master-furniture-rr-72)). The geometry is core's and does not move: preview, export and the parity
harness agree.

## Mapping

OPF furniture has two bands (`design.header`, `design.footer`), three zones each (left, center, right) and parts
laid out in one row in a zone (RR-71): image (a picture, or an organization logo reference such as `var:organization.logo.icon`), text, socials, date. Generated values (slide number, slide count, section, organization name,
speaker) are `{{ }}` variables inside the zone's `text` (FA-31): there are no per-value flags. `{{slide.number}}`,
`{{slide.section}}` and `{{deck.slideCount}}` are filled in for each slide as it is laid out; core marks each substituted
`{{slide.number}}` as a slide-number field (`part.fields`), which is what this exporter writes as a native field.

| OPF part | PowerPoint object | Notes |
| --- | --- | --- |
| `footer.<zone>.text` without a `{{slide.number}}` (the first one, one accepted line) | **Footer placeholder** (`ftr`, layout idx 11) | The dialog's Footer text. |
| `footer.<zone>.date` (the first one, one line) | **Date placeholder** (`dt`, idx 10) | `date: true` with an en-US pattern is a live `datetime1`-`datetime7` field ("Update automatically"); a fixed or literal date, or a pattern with no field type, is fixed text ("Fixed"). |
| `footer.<zone>.text` with a `{{slide.number}}` (the first one, one line) | **Slide Number placeholder** (`sldNum`, idx 12) | Each substituted number is a live `slidenum` field; the words around it (`Page `, ` of 12`) and a `{{deck.slideCount}}` or `{{slide.section}}` value are fixed runs. |
| every header part (text, socials, date, image) | ordinary tagged shapes, on the slide master or a layout when repeated (RR-72) | PowerPoint slides have no header placeholder (`hdr` exists on notes and handouts only). A header `{{slide.number}}` is still a live field inside its shape, which stays on each slide. |
| footer socials, image (a logo reference included) | ordinary tagged shapes, on the slide master or a layout when repeated (RR-72) | No native object. |
| a second footer text, date or text with a slide number in another zone | ordinary tagged shapes | One placeholder per type per slide; the second keeps its live fields. |
| footer text, date or number text that breaks or wraps over several lines | ordinary tagged shapes (one per line) | A placeholder is one shape; core's accepted lines are never re-wrapped by PowerPoint. A `{{slide.number}}` that fits one of the lines is still a live field. |
| empty footer text | ordinary tagged shape | |

Each native shape is the same shape the exporter wrote before (same name `OPF furniture N part K line 0`, same explicit
`a:xfrm`, runs, fields and `OPF_FURNITURE_V1` tag) plus `<p:ph type=".." sz=".." idx=".."/>` and `a:spLocks noGrp`.
The footer manifest marks such a part with `ph` (`dt`, `ftr` or `sldNum`). A slide whose `design.footer` is `false`
(or has no such part) has no placeholder of that type, which the dialog shows as unchecked.

## Row layout (RR-71)

Core lays the parts of a zone out side by side (image, text, socials, date), each at its natural width, aligned to the zone's edge and
vertically centered. A lone text part keeps the whole zone width, as before; a text part that shares its zone with a logo is only as
wide as its words. The exporter draws every part at `part.box` and the native placeholder keeps that box, so a `ftr` beside a logo is a
narrow placeholder at the right of the logo. The master and layout placeholders do not follow it: each spans the zone's band (the box
core gives a lone part in that zone, `left` `.07`, `center` `.37`, `right` `.67` of the width, `.26` wide), at the edge the part is aligned to,
so a footer added through the dialog fits any text. On import, a placeholder's zone is still the third its centre falls in, which is the
zone the row sits in. A row too wide for its zone is a `text-overflow` diagnostic from core.

## Master furniture (RR-72)

A furniture part with no placeholder (a zone image or logo, socials, header text, a footer text or date that is not the native
one, multi-line text) that is drawn the same on two or more slides is written once, on the slide master or a layout, instead of on
each slide (`src/master-furniture.js`). RR-11's `ftr`, `dt` and `sldNum` placeholders, the master and layout placeholders and `p:hf`
do not change.

* **The same.** The part's shapes have the same XML on those slides (text, runs and fields, box, style, picture crop, alt text),
  apart from the object id, the name and the tags, with each relationship compared by its target (the embedded picture bytes, the
  link URL). A logo reference that resolves to an `onLight` asset on light slides and an `onDark` one on dark slides is two values.
* **Where.** A part drawn the same on every slide that shows such furniture goes on the slide master. A part shared by two or more
  slides but not by all of them goes on a layout: each distinct set of such parts gets its own layout, a copy of the master's layout
  with RR-11's three placeholders and `p:hf`, named `OPF furniture 1`, `OPF furniture 2`, ..., so a logo with `onLight`/`onDark`
  variants has one layout per background tone and a section's header text one layout per section. A slide that does not show every
  part on the master (its footer hidden, `design.footer: false`) uses a layout with `showMasterSp="0"` (PowerPoint's Hide
  Background Graphics), carrying whatever shared parts it does show, or none (`OPF no furniture`). A slide that shows exactly the
  master's parts stays on the master's own layout. Lifted shapes are named `OPF furniture <kind> <zone> <field>[ line N]`.
* **What stays on the slide.** A part drawn on one slide only (nothing repeats; a one-slide deck keeps all its furniture on the slide),
  a part with a live field (a header `{{slide.number}}` or a current date outside the native placeholders: the cached value is the
  slide's own) and a part that slide content overlaps. PowerPoint draws master and layout shapes beneath every slide shape, while
  core composes furniture above content and opf-render paints it last, so where a picture (a placed image bleeding to the edge, an
  image overlay, a watermark) covers the part's box it stays on that slide, drawn above the content as in the preview, and that slide's
  layout hides the master's copy; `furniture-on-slide` names the part and the slides.
* **Per-script masters** (opf-pptx#168): each slide master is planned on its own, with its own slides.
* **Provenance.** A lifted shape keeps its `OPF_FURNITURE_V1` tag, with `slot` (`footer.left.image`) in place of the slide's `group`
  and `part`. Each slide manifest moves the part into `shared` (keyed by slot: its `parts` entry, `on: "master"` or `"layout"`, the
  definition's flag, and its stored `templates` text or `images` logo reference), and the remaining slide parts are renumbered.
  Importers before 0.18 read slide shapes only: they ignore `shared` and read the rest of each slide's furniture without a
  complaint (`test/provenance-interop.mjs` runs published 0.11.6), so they do not see a master or layout part.
* Measured over the 127 bundled core examples against the previous output: 81 decks move furniture off their slides (151 shapes
  onto slide masters, 83 onto 83 added layouts); every one of the 127 imports to the same document as before, and no diagnostic is
  added. No geometry changes.

## Master, layout, notes master, presentation

* **Slide master and layout.** Every deck, with or without a footer, gets on the master Date (idx 2), Footer (idx 3) and
  Slide Number (idx 4) placeholders and the layout the three layout placeholders (idx 10, 11, 12) the slides point at.
  They sit where the first slide's native part of that type sits (the whole zone band when that part shares its zone with a logo); a type no slide uses sits where core draws a default
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

`fromPptx` reads native placeholders back whether or not OPF tags are present. Furniture on the slide master or a layout (RR-72)
is read where the slide manifest says it is:

* A `shared` part is read from the slide's layout or master, matched by its slot tag, exactly as a slide shape: a logo picture that
  still embeds the bytes export drew returns as its `var:organization.logo.*` reference, on every slide that shows it; text returns
  with its stored template while the words still match the slide.
* PowerPoint edits: a part deleted on the master or layout is removed from every slide that showed it (intent, as when the dialog
  removes a placeholder: the slides agree, so the deck's design loses it); Hide Background Graphics on a slide, or the slide moved to a
  layout without the part, removes it from that slide (the slide becomes its own override); Change Picture on the master imports the
  new picture as an ordinary image. A damaged tag on a master or layout shape is `invalid-furniture-provenance`, and that part's
  current words (or picture) stay its value as literal text, since master shapes are never slide content.
* **Third-party masters.** Shapes on a slide master or layout without OPF provenance are template decoration and are not read, as
  before RR-72: a picture or text on a master PowerPoint or another tool wrote imports neither as slide content nor as header or
  footer furniture (only the `dt`, `ftr` and `sldNum` placeholders are read, below). A tag-stripped OPF export is such a file: its
  master and layout furniture is not read back. (Furniture tags are written whatever the `provenance` option, so `provenance: false`
  exports still read it.)

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

13. (RR-71) A footer text beside a logo is a narrow placeholder on the slide (core's box, so preview and export agree) but the master and
    layout placeholder spans the zone, so Reset or a newly added footer does not clip a longer text.
14. (RR-71) A logo reference in a zone `image` is written into the slide manifest (`images`) with the content key of the embedded bytes and
    returns as the reference only while the picture still embeds them and the stored organization has a logo for it. Replacing the
    picture in PowerPoint therefore imports the new picture, not the reference. (RR-72 writes a logo drawn on several slides once, on
    the master or a layout; its manifest entry moves into `shared` with the part.)
15. (RR-72) The master holds the parts that are the same on every slide that shows such furniture, layouts the sets shared by some.
    The alternative, the master holding the most common value with other slides on layouts that hide it, would put a tone's logo on the
    master and every other tone on a `showMasterSp="0"` layout that repeats the master's other parts; one rule per part is easier to
    edit in Slide Master view.
16. (RR-72) A part drawn on one slide only stays on that slide, a one-slide deck included: nothing repeats, a layout for one slide
    gains nothing, and the shape stays where a user editing that slide looks for it. The cost: a slide added in PowerPoint to a
    one-slide deck does not get the furniture.
17. (RR-72) Furniture under slide content stays on that slide (`furniture-on-slide`), so PowerPoint paints it above the content as
    the preview does. A shape whose box overlaps the part's box counts even where its ink does not: the check is on boxes, not ink.
18. (RR-72) A part with a live field stays on each slide: its cached value is the slide's, and whether PowerPoint evaluates a field in
    a master text box per slide is not part of the native evidence.
19. (RR-72) The manifest stores a lifted part under `shared` instead of marking it in `parts`, so the released importers, which
    validate `parts` and `definitions` strictly, keep reading the rest of the slide's furniture instead of rejecting the band.
20. (RR-72) Shapes on a third-party master or layout stay unread (a picture there is ignored, not imported as an image): they are
    template decoration, and reading them would put a corporate template's logo into every imported deck's design.
21. (RR-72) The row baseline is not changed. In RR-71's row zones each part is centred on the row's tallest part (the logo, 36 px at a
    720 px short edge), so row text sits about 6 px below single-part text in the same band. Putting row text on the single-part
    baseline leaves the logo 6 px above it: in the header the logo moves into the slide's top margin and `headerBottom` changes, in the
    footer the band's top (`footerTop`, the body's lower bound) moves up or the logo crosses into the body gap. Either moves more than the
    multi-part zones (the body of every slide with a logo row), so it is left to a core composition decision.

## Not covered

PowerPoint opening, editing and re-saving these files is a native check (`scratchpad/rr-11-native/manifest.json`, and for
RR-72 the decks the furniture session hands to the native pass), not something the unit tests establish. Moving a layout
placeholder in PowerPoint does not move slides that carry their own `a:xfrm`. Handout master and `hdr` text on notes pages are
not produced. A shape added to a master or layout in PowerPoint (no OPF tag) is not imported.

## Tests

`npm run test:furniture` includes `test/native-furniture.mjs`: every OOXML part (slide, layout, master, notes master,
presentation), geometry parity with core (measured and estimated fonts), the parts that stay shapes, the dialog edits above,
inherited placeholders written the way PowerPoint writes them, older tagged exports, and determinism. `test/slide-variables.mjs`
covers the `{{slide.number}}`, `{{deck.slideCount}}` and `{{slide.section}}` forms: native field plus fixed words, body tokens as
fixed text, consecutive numbers on a paginated deck, the tokens through a round trip and third-party footers.
`test/master-furniture.mjs` (RR-72) covers the master and layout parts: the logo once on the master and not on the slides, per-tone
layouts and a one-slide tone, hidden footers, a slide's own header, content over the logo, live fields, the round trip of
`var:organization.logo.icon` on every slide, master edits (delete, Change Picture, Hide Background Graphics, damaged tags), an
older importer's view without `shared`, third-party masters and per-script masters. `test/helpers/master-furniture.mjs` reads the
furniture a slide shows (its own, its layout's, its master's) for the other furniture tests.
