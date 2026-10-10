# RR-72: PowerPoint master furniture

PowerPoint part of design §3 of `0.18-consistent-api.md`, after RR-71 ([rr-71-logos.md](rr-71-logos.md)). The implementation is in
opf-pptx (`src/master-furniture.js`, documented in its `docs/native-header-footer.md`, "Master furniture"). Core is unchanged:
no schema, composition or golden change. Every decision below is an agent decision, vetoable; each says what changing it would cost.

## The rule

A header or footer part with no PowerPoint placeholder (a zone image or organization logo, socials, header text, a footer text or
date that is not RR-11's native `ftr` or `dt`, multi-line text) that is drawn the same on two or more slides is written once:

- on the slide master, when every slide that shows such furniture draws it;
- else on a layout shared by the slides that do: one layout per distinct set of shared parts, a copy of the master's layout with
  RR-11's three placeholders and `p:hf`, named `OPF furniture N`;
- a slide that does not show every master part (a hidden footer, `design.footer: false`) uses a layout with `showMasterSp="0"`
  (PowerPoint's Hide Background Graphics), carrying the shared parts it does show, or none (`OPF no furniture`).

"The same" is the same shape XML (text, runs, box, style, crop, alt text) with relationships compared by target (picture bytes,
link URL). A logo reference that resolves to `onLight` on light slides and `onDark` on dark slides is two values, so a light/dark
deck gets one layout per tone and the master draws no logo. RR-11's `ftr`, `dt` and `sldNum` placeholders, the master and layout
placeholders and `p:hf` do not move, so Insert > Header & Footer works as before.

## Decisions

1. **Master or layout.** The master holds the parts that are the same on every slide showing such furniture; layouts hold the sets
   shared by some. The alternative (the most common value on the master, other slides on `showMasterSp="0"` layouts) would put one
   tone's logo on the master and repeat the master's other parts on every other layout.
2. **Parts on one slide stay there**, a one-slide deck included: nothing repeats, and a layout for one slide gains nothing. Cost: a
   slide added in PowerPoint to a one-slide deck does not get the furniture.
3. **Paint order.** PowerPoint draws master and layout shapes beneath slide shapes; core composes furniture above content and
   opf-render paints it last. A part whose box slide content overlaps (a placed image bleeding to the edge, an overlay, a watermark)
   stays on that slide, above the content, and the slide's layout hides the master's copy (`furniture-on-slide` diagnostic).
4. **Live fields stay on each slide** (a header `{{slide.number}}`, a current date outside the native placeholders): the cached value
   is the slide's own, and field evaluation in a master text box is not part of the native evidence.
5. **Provenance.** A lifted shape keeps `OPF_FURNITURE_V1` with `slot` (`footer.left.image`) in place of the slide part. Each slide
   manifest moves the part (topology entry, the definition's flag, its stored text template or logo reference) into `shared`, with
   `on: "master" | "layout"`. Importers before 0.18 validate `parts` and `definitions` strictly and ignore unknown keys, so they read
   the rest of the furniture without a complaint (published 0.11.6 in `test/provenance-interop.mjs`); they do not see master parts.
6. **Import.** `fromPptx` reads a shared part from the slide's layout or master: an unchanged logo returns as its
   `var:organization.logo.*` reference on every slide that shows it. A part deleted on the master is removed from every slide (intent,
   like the dialog removing a placeholder); Hide Background Graphics or another layout removes it from one slide; Change Picture
   imports an ordinary image; a damaged master tag is `invalid-furniture-provenance` with the current words kept.
7. **Third-party masters stay unread.** A picture or text on a master or layout without OPF provenance is template decoration: it is
   ignored (not imported as an image or as furniture), as before RR-72. Reading it would put a corporate template's logo into every
   imported deck's design.
8. **The row baseline is not changed** (RR-71 decision 10 left it to RR-72). Row parts are centred on the row's tallest part (the logo,
   36 px at a 720 px short edge), so row text sits about 6 px below single-part text in the same band. Putting row text on the
   single-part baseline leaves the logo 6 px above it: in the header the logo moves into the top margin and `headerBottom` changes; in
   the footer `footerTop` (the body's lower bound) moves up or the logo crosses into the body gap. That moves more than the multi-part
   zones (the body of every slide with a logo row, in `technical/header-footer-logo-set` among the examples), so it is left as is; a
   later core composition change can take it with a golden regeneration. No pixels move in RR-72.

## Measured

Over the 127 core examples against the previous opf-pptx: 81 decks move furniture off their slides (151 shapes onto slide masters,
83 onto 83 added layouts), every deck imports to the same document as before, and no diagnostic is added. Geometry is unchanged.

## Acceptance still open

The native Windows PowerPoint pass (the logo on the master, per-tone layouts, Hide Background Graphics on a hidden-footer slide,
Insert > Header & Footer on a deck with master furniture, a re-import of a PowerPoint save) is the root session's.
