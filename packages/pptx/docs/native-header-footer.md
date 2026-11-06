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
| `footer.<zone>.date` (the first one, one line) | **Date placeholder** (`dt`, idx 10) | `date: true` is a live `datetime1`-`datetime7` field ("Update automatically") when a field of the deck's language, else of English (United States), shows its `dateFormat` ([Dates and languages](#dates-and-languages-rr-102)); a fixed or literal date, or a pattern no field shows, is fixed text ("Fixed"). |
| `footer.<zone>.text` with `{{slide.number}}` (the first one, one line) | **Slide Number placeholder** (`sldNum`, idx 12) | The substituted number is a live `slidenum` field, and words around it (`Page `, ` of 12`) are fixed runs beside it (the default since RR-102). With `slideNumberFields: 'static'` a number with words around it is an ordinary tagged shape with the number as fixed text ([Slide number with words around it](#slide-number-with-words-around-it-rr-91-rr-102)). |
| every header part (text, socials, date, image) | ordinary tagged shapes, on the slide master or a layout when repeated (RR-72) | PowerPoint slides have no header placeholder (`hdr` exists on notes and handouts only). A header `{{slide.number}}` is still a live field inside its shape, which stays on each slide. |
| footer socials, image (a logo reference included) | ordinary tagged shapes, on the slide master or a layout when repeated (RR-72) | No native object. |
| a second footer text, date or text with a slide number in another zone | ordinary tagged shapes | One placeholder per type per slide; the second keeps its live fields. |
| footer text, date or number text that breaks or wraps over several lines | ordinary tagged shapes (one per line) | A placeholder is one shape; core's accepted lines are never re-wrapped by PowerPoint. A `{{slide.number}}` that fits one of the lines is still a live field. |
| empty footer text | ordinary tagged shape | |

Each native shape is the same shape the exporter wrote before (same name `OPF furniture N part K line 0`, same explicit
`a:xfrm`, runs, fields and `OPF_FURNITURE_V1` tag) plus `<p:ph type=".." sz=".." idx=".."/>` and `a:spLocks noGrp`.
The footer manifest marks such a part with `ph` (`dt`, `ftr` or `sldNum`). A slide whose `design.footer` is `false`
(or has no such part) has no placeholder of that type, which the dialog shows as unchecked.

## Slide number with words around it (RR-91, RR-102)

A footer or header text with words around `{{slide.number}}` (`{{slide.number}} / {{deck.slideCount}}`, `Page {{slide.number}}`)
exports its number as a **live slide-number field** by default (`slideNumberFields: 'live'`, since RR-102): the field with the
words as fixed runs, in the Slide Number placeholder for the first footer one, so Insert > Header & Footer shows Slide number
checked and PowerPoint renumbers the slides when they move, as in a deck built in PowerPoint. A header number keeps its field
inside its ordinary shape. `{{deck.slideCount}}` is fixed text in every mode, because PowerPoint has no slide-count field: after
slides are added or deleted in PowerPoint "of 12" is stale until the deck is exported again. No finding reports it (decision 23).

**Keynote targets:** `toPptx(deck, {slideNumberFields: 'static'})` (`opf convert --slide-numbers static`) writes the number as fixed
text: one run in an ordinary tagged shape (`2 / 6`), no field and no Slide Number placeholder (`p:hf sldNum="0"` unless another part
is a bare number). That is correct in PowerPoint and Keynote at export time; RR-91 made it the default from 0.22.0 until RR-102.

**Why static exists.** Keynote (Keynote Creator Studio 15.1.1, checked 2026-10-17) has no inline slide-number field: it replaces the whole
paragraph that holds a `slidenum` field with the number, in the Slide Number placeholder and in an ordinary text box alike, so a
live `{{slide.number}} / 6` showed only `2`. A literal run before the field (`Page `) or after it is dropped the same way; text in a
separate paragraph or shape is kept. Moving the part from the placeholder to a plain text box therefore does not help. The total
is fixed in every mode (PowerPoint has no slide-count field), so `N / total` could never be fully live anyway.

**Live number in both apps:** use a bare `{{slide.number}}` (the text is only the number). It keeps its live `slidenum` field in
the Slide Number placeholder, which both apps show and update.

The cost of `static`: a fixed number does not follow slides reordered, added or deleted in PowerPoint, and the dialog shows Slide
number unchecked; re-export from OPF to refresh it. The cost of the default: Keynote shows only the digit. The authored `{{slide.number}} / {{deck.slideCount}}` returns on import either way (the furniture manifest stores
the template; a fixed-number export and a live one re-import to the same text).

## Dates and languages (RR-102)

A current date (`date: true`) is a PowerPoint date field, which Insert > Header & Footer shows as Date and time, Update
automatically, with the field type as the selected format and the field's `lang` as the Language. PowerPoint draws a type
differently in each language (`datetime1` is `11/6/2026` in English (United States), `06/11/2026` in English (United Kingdom),
`06.11.2026` in German), while OPF draws `dateFormat` with English month and weekday names whatever the deck's language. So the
exporter writes the field whose display is OPF's:

1. a field of the deck's language that shows the pattern, with the deck's `lang` (the dialog shows the deck's language);
2. else an English (United States) field that shows it, with `lang="en-US" altLang="en-US"` on that run (the dialog shows English
   (United States), the language of the words OPF draws; the altLang keeps the deck-language pass from rewriting it);
3. else fixed text with `furniture-date-fixed` ("Fixed" in the dialog).

The lists below were read from PowerPoint 16.0.20527 for Windows through COM on 2026-11-06 (a Friday), one text box per field type
and language. `datetime8`-`datetime13` hold a time, which no OPF pattern expresses. Only patterns OPF can draw are listed: a
language whose month names are not English keeps its numeric patterns.

| Language | `datetime1`-`datetime7` that OPF can draw |
| --- | --- |
| en-US | `M/d/yyyy`, `EEEE, MMMM d, yyyy`, `d MMMM yyyy`, `MMMM d, yyyy`, `d-MMM-yy`, `MMMM yy`, `MMM-yy` |
| en-GB | `dd/MM/yyyy`, `EEEE, dd MMMM yyyy`, `d MMMM, yyyy`, `dd MMMM yyyy`, `d-MMM-yy`, `MMMM yy`, `MMM-yy` |
| en-AU | `d/MM/yyyy`, `EEEE, d MMMM yyyy`, `d MMMM, yyyy`, `d MMMM yyyy`, `d-MMM-yy`, `MMMM yy`, `MMM-yy` |
| en-NZ | `d/MM/yyyy`, `EEEE, d MMMM yyyy`, `d MMMM yyyy` (3 and 4), `d-MMM-yy`, `MMMM yy`, `MMM-yy` |
| en-CA | `yyyy-MM-dd`, `EEEE, MMMM d, yyyy`, `d MMMM yyyy`, `MMMM d, yyyy`, `yy-MMM-d`, `MMMM yy`, `MMM-yy` |
| en-IN | `dd-MM-yyyy`, `EEEE, dd MMMM yyyy`, `d MMMM yyyy`, `dd MMMM yyyy`, `d-MMM-yy`, `MMMM yy`, `MMM-yy` |
| de-DE | 1 `dd.MM.yyyy`, 3 `dd/MM/yy`, 5 `yy-MM-dd` |
| fr-FR, es-ES, pt-BR, pt-PT | 1 `dd/MM/yyyy`, 3 `dd.MM.yy` |
| it-IT | 1 `dd/MM/yyyy` |
| nl-NL | 1 `d-M-yyyy`, 3 `d/M/yy` |
| ja-JP | 4 `yyyy年M月d日` |
| zh-CN | 2 `yyyy年M月d日`, 6 `yyyy年M月` |
| ko-KR | 4 `yyyy년 M월 d일`, 6 `yyyy년 M월` |
| ar-SA, he-IL, hi-IN | none: their fields default to the Hijri, Hebrew and Saka calendars (the dialog's Calendar type) |

A day shown as `6` or `06` and the year's width are observed; a month was `11`, so its width is read as the day's (the language's
Windows short and long date patterns agree). OPF's default `M/d/yyyy` is therefore an English (United States) field in every deck
whose language has no such field, en-GB included. Import reads a field's type in its run's `lang` (en-US when absent): a
`datetime1` field in a German deck returns as `dateFormat: 'dd.MM.yyyy'`, and a field in a language without a list, or a time, keeps
its current words as a literal date.

A **fixed date** is "Fixed" with its words, as OPF draws them: a string with `dateFormat` (an ISO date) is formatted, a string without
one is kept literally, an ISO string included (`2026-11-05`), because that is what the preview draws (core's rule: without
`dateFormat` a date string is "literal, editable source text"); formatting it only in PowerPoint would make preview and export
disagree. Add `dateFormat` to have it formatted in both.

## Literal footer text as a shape

`toPptx(deck, {footerText: 'shape'})` keeps the existing measured, editable literal footer text shape and omits only its
slide-local `ftr` placeholder binding. The default, `footerText: 'native'`, retains the normal output exactly. Invalid
values fail with `invalid-footer-text-option` at `options.footerText`.

Only the first eligible one-line literal footer text on each slide changes. Its current words, formatting, geometry,
paint order, `a:spLocks`, name and furniture/document provenance stay unchanged. It remains on that slide even when
repeated. Native slide-number and date bindings and live fields, all master/layout placeholders and `p:hf` flags remain
unchanged. A second literal part, multi-line or linked text, header text, and other furniture keep their normal export.
The existing manifest `ph` metadata remains; that metadata alone does not prove a current native binding exists.

The literal shape no longer belongs to PowerPoint's native Footer dialog. Preserved master/layout footer controls may
still create another native footer. This option does not change import classification when another application strips
OPF tags, nor does it establish general PowerPoint/Keynote font or layout parity.

The bounded Keynote 15.1.1 control used a synthetic sixteen-slide Arial deck whose two inputs differed only by removing
the sixteen slide-local literal `ftr` tokens. On its K08 picture slide, the supervisor observed the default footer occluded
by the picture, while the shape variant's literal footer remained visible over it; both retained the live number 8.
These observations persisted through saved Keynote and exported PPTX reopens. The actual default export moved the footer
first in object order; the shape export preserved the source order on K08 and the simpler K02 paragraph slide. This is
evidence for that fixture, not universal native acceptance. Both exports still import literal footers as content after
Keynote strips the furniture tags, and both lose generated notes-page number fields. Speaker-note words are a separate
required check.

`test/footer-text-shape.mjs` checks the public option, unchanged defaults, all three provenance modes, the exact
token-only uncompressed-part difference, preserved links/fields and current literal edits/deletions. ZIP compression
bytes can differ when a token is omitted; the package-part comparison does not normalize or tolerate other changes.

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
  Slide Number (idx 4) placeholders and the layout the three layout placeholders (idx 10, 11, 12) the slides point at. A slide
  placeholder Insert > Header & Footer adds has no `a:xfrm` and inherits the master's box, so (RR-102) each master placeholder sits
  where OPF draws that part if the author adds it to the deck's footer (the deck's `design.footer`, else the first slide's own),
  composed by core with the first slide's options:
  * a type the deck's footer has is composed where it is (a footer text beside a logo spans its zone, RR-71);
  * a missing type is added to the first empty zone in PowerPoint's order for it (date: left, center, right; footer text: center,
    left, right; number: right, center, left); when every zone holds a part, a date joins the row of the first zone that takes it
    clear of the words the slides draw, after what is there (`compliance-readiness-review`: after the organization name, not on
    it), as wide as its words with `wrap="none"`; where no row has the room (a 4:3 deck's narrow zones, where core would wrap the
    name to fit the date) it follows the start zone's words by one row gap, clear of the center text; a footer text or number goes
    to the first zone without a text;
  * all three share one baseline: the deck's own date, footer text or number, in that order (the box the slide shape of that part
    has, core's placed line), so items turned on together line up, and a date added beside the footer text lines up with it.
  Their text style (size, theme colour, font) is the first furniture run's, so a footer added through the dialog looks like the
  exported ones. When core cannot compose the footer the placeholders fall back to the first slide's native boxes, then core's
  default footer band.
* **Master and layout date field.** A deck whose footer has a current date gives the master and layout Date its field (type,
  pattern, language), so a date turned on in the dialog is OPF's date; a deck without one keeps PowerPoint's own
  `datetimeFigureOut` (the dialog then offers its default list), which keeps every deck without a date byte-identical.
* **`p:hf`.** Master and layout: `hdr="0"` (slides have no header placeholder) and `sldNum`, `ftr`, `dt` are `1` when at
  least one slide carries that placeholder, else `0`.
* **Notes and Handouts (RR-102).** OPF has no notes header or footer of its own, so the notes pages show what the deck shows: the
  page number (PowerPoint's default, on every generated notes page), the footer text and the date the slides show as
  placeholders (the first slide's of each; a live date as the same field, a fixed one as its words) when they show them, on the notes master's Footer and Date placeholders and as
  Footer (idx 12) and Date (idx 11) placeholders on every notes page; never a header. `p:hf` on the notes master says which
  (`hdr="0"`, `ftr` and `dt` `1` when the deck footer has them). Import reads only the notes body, so these never become speaker
  notes. The handout master is not written: PowerPoint makes one when Handout Master view is opened.
* **Presentation and "Don't show on title slide".** OPF has no option that hides furniture on covers or title slides: a cover
  shows the deck's footer unless the slide says `design.footer: false`. So `showSpecialPlsOnTitleSld` is not written: its default
  shows the placeholders on title layouts (the `cover` template's layout is typed `title`, RR-81), and the dialog's "Don't show
  on title slide" is unchecked (RR-102 COM read: `SlideMaster.HeadersFooters.DisplayOnTitleSlide` is true on every deck).
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
| Date turned on with Apply to All, every zone already holding a part (RR-102) | `design.footer.<zone>.date: true` in the zone of the master date (beside the footer text) |
| Footer or number turned on on a slide whose footer OPF hid | that slide's own `design.footer` with just those parts |
| Apply to All changes a deck footer that some slides had changed (RR-102) | the footer most slides now share (two or more) is `design.footer`; the other slides keep their own |

`test/header-footer-dialog.mjs` reads five decks saved by PowerPoint after these edits (per-slide and Apply to All, full
provenance, `provenance: false` and stripped tags, a date format), `test/fixtures/header-footer-dialog/README.md`.

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
7. `showSpecialPlsOnTitleSld` is not written: OPF never hides furniture on title slides by itself, so "Don't show on title slide"
   stays unchecked (RR-102). The notes pages follow decision 26.
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

22. (RR-102) `slideNumberFields: 'live'` is the default: a number with words around it is the Slide Number placeholder with a live
    field, as PowerPoint builds it, so the dialog shows the truth and PowerPoint renumbers; `'static'` stays for Keynote targets
    (RR-91's reason). The owner may veto this and restore `'static'`.
23. (RR-102) `{{deck.slideCount}}` is fixed text with no finding: at export it is right, a finding on every `N / total` deck would
    be noise, and the README, the schema and this page say that PowerPoint has no slide-count field.
24. (RR-102) A date field shows what OPF draws: the deck's language when it has a field for the pattern, else English (United States),
    else fixed text. The alternative, the deck's language for every field, would make PowerPoint draw another date format than the
    preview (an en-GB deck's `M/d/yyyy` as `06/11/2026`).
25. (RR-102) An ISO date string without `dateFormat` stays literal ("Fixed" with `2026-11-05`), as the preview draws it.
26. (RR-102) Notes pages carry the page number and the deck footer's text and date; the header stays off and no handout master is
    written. A slide whose footer is hidden still has them on its notes page (the dialog's notes settings are deck-wide).
27. (RR-102) The master placeholders share one baseline, the deck's own date, footer text or number first. In a logo row (RR-72
    decision 21) the number OPF draws alone sits higher than the text beside the logo; the master follows the text, so a date added
    beside it lines up, and a footer and number turned on together on a slide without the logo line up with each other.

## Not covered

PowerPoint opening, editing and re-saving these files is a native check (`scratchpad/rr-11-native/manifest.json`, and for
RR-72 the decks the furniture session hands to the native pass), not something the unit tests establish. RR-102 read the dialog's
state through COM (`HeadersFooters` per slide, the master and the notes master) and changed it through the same object model; the
dialog window itself (its Language and Calendar type dropdowns, Apply versus Apply to All, the preview pane) is a check in
PowerPoint's UI. Moving a layout
placeholder in PowerPoint does not move slides that carry their own `a:xfrm`. Handout master and `hdr` text on notes pages are
not produced. A shape added to a master or layout in PowerPoint (no OPF tag) is not imported.

## Tests

`npm run test:furniture` includes `test/native-furniture.mjs`: every OOXML part (slide, layout, master, notes master,
presentation), geometry parity with core (measured and estimated fonts), the parts that stay shapes, the dialog edits above,
inherited placeholders written the way PowerPoint writes them, older tagged exports, and determinism. `test/slide-variables.mjs`
covers the `{{slide.number}}`, `{{deck.slideCount}}` and `{{slide.section}}` forms: native field plus fixed words, body tokens as
fixed text, consecutive numbers on a paginated deck, the tokens through a round trip and third-party footers.
`test/header-footer-placeholders.mjs` (RR-102) checks the master placeholders against core's composition of a date added to a full
footer and to a logo row, the shared baseline and the deck's date field; `test/header-footer-dialog.mjs` imports PowerPoint-saved
dialog edits. `test/master-furniture.mjs` (RR-72) covers the master and layout parts: the logo once on the master and not on the slides, per-tone
layouts and a one-slide tone, hidden footers, a slide's own header, content over the logo, live fields, the round trip of
`var:organization.logo.icon` on every slide, master edits (delete, Change Picture, Hide Background Graphics, damaged tags), an
older importer's view without `shared`, third-party masters and per-script masters. `test/helpers/master-furniture.mjs` reads the
furniture a slide shows (its own, its layout's, its master's) for the other furniture tests.
