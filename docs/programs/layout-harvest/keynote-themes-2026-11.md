# Keynote 15.1.1 themes: what OPF can learn (November 2026)

A study of the theme bundles that ship with Keynote 15.1.1 ("Keynote Creator Studio") on this Mac, read from the files only, and compared with OPF's default catalog at commit `b5629b2ea` (the v0.34.0 candidate assembly; the catalog is the same on `main`). Everything below is my own reading and measurement. No Apple image, theme file or font is reproduced or attached; the proposals take ideas and proportions, never Apple's artwork, photos or exact designs.

## Summary

- **38 new themes.** The folders whose names end in `_PM` (40 to 71, then 74, 77, 84, 89, 98, 102) are new in this Keynote. The brief expected 37; there are 38 `_PM` folders. 15 were analyzed in full. The other 23 had a lighter pass covering names, layouts, fonts, colors and the main type sizes.
- **One shared system under 38 skins.** 36 of the 38 share one structure:
  - one layout set of about 20 masters;
  - a six-column grid with 3.5% side margins;
  - a two-item footer (presentation title and date) at 1.9% of the slide height;
  - about seven type sizes.
  The two exceptions (Dynamic Chill and Purple Tropics) use the older 17-master set of the earlier themes.
- **Big type, short lines, few sizes.** Median sizes as a share of the slide height:

  | Role | Median | Range |
  | --- | --- | --- |
  | Cover title | 11% | up to 39% |
  | Statement | 16% | |
  | Quote | 10% | 10 to 16% |
  | Big fact | 37% | 23 to 56% |
  | Content title | 6% | |
  | Body | 6% | |

  The body boxes hold about 38 characters per line (median).
- **Hierarchy without size.** Size does less of the work than usual:
  - In 22 of 32 themes the content title is no larger than the body.
  - In 19 of the 28 covers that have a subtitle, the subtitle is the same size as the title.
  - The difference comes from weight, color, italics and position.
  - In 12 themes the slide title is a small label in the first grid column, and the body is the large text.
- **Start-aligned, top-anchored, edge to edge.**
  - 96.5% of text placements are start-aligned. Nearly all centered text is in the two older-scheme themes.
  - Pictures are bled half-slide panels, full bleeds or insets on the grid. 61 picture frames have rounded or custom-shaped masks.
- **Color by layout.** A theme uses a median of 5 background colors, assigned per layout:
  - statement, quote and fact slides sit on a second or third ground;
  - text is almost always pure black or white, or one tinted ink.
- **Licensed fonts, not bundled.** Seven commercial families do most of the work: Graphik, Founders Grotesk, Druk, Domaine Display, Canela, Publico and Produkt. They download on demand and are not in the bundle. Keynote's own fallback table maps each one to a system face. Open substitutes are listed below.

**Top 5 proposals for OPF** (the ranked list is near the end):

1. **Grow one-message slides further.** Statement up to about 16% of the height, quote to 11%, a lone figure to 35%, all keyed to character count. This fits the direction: type grows and lines stay short.
2. **A six-column grid** shared by every template, and a **side-title family** of layouts (title in column 1, body in columns 2 to 6, at lead size). It fits with a guard: short titles only, so titles never wrap into a narrow stack.
3. **Equal-size heading pairs.** A theme option that sets the subtitle at the title's size and lets weight or color carry the hierarchy. It fits, because it only grows text.
4. **Picture-led records.** Quote beside a bled half picture, a statement over a picture, a lead-plus-mosaic gallery and an exact 1:1 hero split. They fit, because bodies fill the slide.
5. **Five new themes on open fonts.** Condensed display, editorial serif, monospace, two-color duotone and a "specimen" theme with rotating muted grounds. Each comes with a color scheme and a font scheme. Every face is under OFL-1.1 or Apache-2.0.

## Method and precision

- **Sources.** I read:
  - `Wide.kth` (and one `Standard.kth`) from `/Applications/Keynote Creator Studio.app/Contents/SharedSupport/Templates/<folder>/`;
  - `Contents/Resources/TemplatesInfo.plist` (the theme chooser's categories);
  - `TemplatesMetadata.plist` (fonts per theme);
  - `en.lproj/TemplatesInfo.strings` (display names and accessibility descriptions);
  - `FallbackFonts.plist` (Keynote's substitution table).

  Copies, extractions, contact sheets and scripts stay in `/Users/michael/opf-work/keynote-themes-local/` and are not part of this analysis. The Keynote app was never opened or scripted.
- **Decoding.** I wrote a Snappy block decoder and a schema-less protobuf walker, then identified the fields by their values. The working readings:
  - the slide archive's name (field 10) and its drawables in z-order (fields 42 and 7);
  - title and body placeholders (fields 5 and 6), with the placeholder kind in field 2;
  - geometry (position and size floats);
  - image masks (the visible crop);
  - paragraph-style inheritance (parent at 1.3);
  - character properties: bold 1, italic 2, size 3, PostScript name 5, color 7, capitalization 13, tracking 27;
  - paragraph properties: alignment 1, line spacing 13, space before 21;
  - shape-text properties: likely autoshrink 1, vertical anchor 2, insets 6;
  - fills and strokes (a stroke pattern of type 2 means no stroke);
  - the theme's master order and the slide-node thumbnail id.
- **Precision.**
  - Geometry, sizes, fonts, colors and alignment come straight from the files. They are exact to the stored floats, and I give them to 3 decimals as fractions of the 1920 × 1080 canvas.
  - Type sizes are points on that canvas: 1 pt = 1 px, so a percentage of the height is pt / 10.8.
  - Keynote's line spacing is "relative": a multiple of the face's own line height, which is about 1.2 em for these faces. So 0.9 relative is about 1.05 to 1.1 em.
  - The 356 × 200 thumbnails (`mt-*.jpg`) were viewed locally, only to describe each composition in words.
  - Two readings are inferred and not confirmed by a schema: the autoshrink flag, and the 0.5 em character width used to estimate characters per line.
- **The 4:3 bundle scales with the height.** `Standard.kth` of Business Modern is 1024 × 768:
  - type is set at 0.70 of the Wide size (60 pt becomes 42 pt), so it keeps its share of the height;
  - the side margin grows from 0.035 to 0.05 of the width, which is the same 6.2 to 6.7% of the short edge.

## Which themes are new, and how I know

1. **The chooser has them and the scripting list does not.** The AppleScript theme list of this Keynote has 53 names. The bundle has 98 template folders:
   - 38 `_PM` folders;
   - 60 others. Removing the right-to-left duplicates (6 `_RTL`) and `25_BoldColor_ISO` leaves exactly 53.

   So the scripting list covers only the earlier set, while `TemplatesInfo.plist` places all 38 `_PM` themes in the chooser's categories (Business, Education, Creative, Personal, Minimal, Bold, Editorial, Dynamic).
2. **A new naming and layout scheme.** 36 of the 38 use a master vocabulary that the earlier numbered themes (20 to 39) do not: "Title & Text", "Title, Text & Multi-Image", "Contents", "Fact", "Live Video", "Statement & Image". The earlier set says "Title & Bullets", "Big Fact" and "Photo - 3 Up". Dynamic Chill and Purple Tropics, the two lowest numbers (40 and 41), still use the earlier vocabulary and read as the bridge between the sets.
3. **Build stamps do not separate them.** Every bundle carries the same build date (2026-08-06) and build branch, so the date proves nothing either way.

| # | Display name (folder) | Chooser categories |
| --- | --- | --- |
| 40 | Dynamic Chill | Dynamic |
| 41 | Purple Tropics | Bold |
| 42 | Community Colorful | Creative, Bold |
| 43 | Volunteer Colorful | Education, Personal |
| 44 | Note-Taking Colorful | Education, Personal |
| 45 | Scientific Muted | Education, Creative, Bold |
| 46 | Business Modern | Business |
| 47 | Wellness Bold | Creative, Personal |
| 48 | Luxury Elegant | Business |
| 49 | University Classic | Education |
| 50 | Cyber Stark | Creative |
| 51 | Branding Modern | Business |
| 52 | Gradient Colorful | Business, Bold |
| 53 | Educator Playful | Education |
| 54 | Standard Minimalist | Personal, Minimal |
| 55 | Travel Colorful | Creative, Personal |
| 56 | Scrapbook Dark | Creative, Personal |
| 57 | Meadow Pastel | Creative |
| 58 | Startup Simple | Business, Creative |
| 59 | Photography Bold | Creative |
| 60 | Academic Modern | Education, Editorial |
| 61 | Family Colorful | Personal |
| 62 | Factory | Business |
| 63 | Journalism Simple | Creative, Editorial |
| 64 | Painting Simple | Creative, Personal |
| 65 | Sales Bold | Business |
| 66 | Recreation Colorful | Creative, Personal |
| 67 | School Simple | Education |
| 68 | Fitness Dark | Business, Personal, Minimal, Bold |
| 69 | Event Elegant (folder `69_Wedding_Elegant_PM`) | Personal |
| 70 | Editorial Colorful | Creative, Editorial |
| 71 | Culinary Plain | Business, Creative, Minimal |
| 74 | Note-Taking Refined | Education |
| 77 | Wellness Pastel | Business, Creative, Personal |
| 84 | Standard Bold | Education, Creative, Minimal |
| 89 | Photography Colorful | Creative, Personal |
| 98 | Fitness Bold | Business, Personal, Bold |
| 102 | Hustle | Business, Creative, Bold |

**Fully analyzed (15):**

- Purple Tropics (bold, older scheme)
- Community Colorful (colorful)
- Scientific Muted (academic, muted)
- Business Modern (business)
- Luxury Elegant (elegant)
- Cyber Stark (cyber, dark)
- Educator Playful (playful)
- Standard Minimalist (minimalist)
- Meadow Pastel (pastel)
- Photography Bold (photography)
- Academic Modern (academic, dark grounds)
- Fitness Dark (dark)
- Editorial Colorful (editorial)
- Fitness Bold (bold)
- Hustle (bold, duotone)

Their measurement tables are in Appendix A, and the lighter pass for all 38 is in Appendix B.

## The shared system

### Canvas, margins and grid

The canvas is 1920 × 1080 (Wide), and every number below is a fraction of it.

**Margins:**

- **Side margins.** In the 36 new-scheme themes, text and inset pictures start at x = 0.035 (67 px, which is 6.2% of the height) and end at x = 0.963 to 0.965.
  - Luxury Elegant and Journalism Simple start their titles at 0.055 to 0.058, inside a hairline or rule.
  - Dynamic Chill and Purple Tropics use 0.049.
  - The left-edge histogram across all masters peaks at 0.03 to 0.04: 1581 of the elements wider and taller than 20 px.
- **Top margin.** Titles start at y = 0.04 to 0.06. The median is about 0.047, which is 51 px, slightly less than the side margin.
- **Footer band.** "Presentation Title" and "Date" text boxes sit at y = 0.904 to 0.914, at 1.9% of the height and bottom-anchored, so their baseline is near y = 0.94.
  - Content stops at about y = 0.86 to 0.90.
  - 36 of 38 themes have this footer.
  - The footer's two items sit in grid columns 1 and 2 (x = 0.035 and 0.193).

**Six-column grid:**

- 6 columns of 0.146 with 0.012 gutters, a pitch of 0.158 (303 px).
- The column lines fall at 0.035, 0.193, 0.351, 0.509, 0.667 and 0.825.
- The histogram's next peaks match them: 0.19 (388 elements), 0.35 (159), 0.50 (155), 0.66 (146).

**Inner grid:** when column 1 is a sidebar, the remaining five columns (0.193 to 0.963) split into three equal cells of 0.248 with 0.013 gutters (x = 0.193, 0.454, 0.715). This is how the 3-up picture rows and the 3 × 2 heading grids are placed.

**The half split:** pictures beside text are exactly half the slide wide (0.495 to 0.505), full height, and bled to three edges.

**4:3:** the same grid with a 0.05 margin, so the margin is constant as a share of the short edge.

### The layout set

The median is 20 masters per theme (range 17 to 27). Names normalized; in brackets, the number of the 38 themes that carry each.

| Master | Themes | What it is for | Typical composition (new scheme) |
| --- | --- | --- | --- |
| Title | 38 | Cover | Title (and subtitle) top-left at 9 to 14% of the height; author and date in the footer row. A bottom-anchored variant appears in 4 themes |
| Title & Image | 27 | Cover with picture | Title in the start half, picture bled over the end half; or a full-bleed picture with the title over it |
| Contents | 36 | Table of contents | Three columns on the grid: a "Contents" label (columns 1 to 2), section titles (columns 3 to 5) and end-aligned page numbers ("00") in column 6, all at one display size (about 7% of the height) |
| Agenda | 19 | Agenda | Title, then topics at 5 to 9% of the height |
| Section | 36 | Section divider | Title at about 11% of the height, top-left, often on a second ground or with a half picture |
| Title & Bullets / Title & Text | 36 / 34 | Prose or list | Either a full-width title over a body, or the **side-title** form: the title in column 1, the body in columns 2 to 5 (width 0.61 to 0.75) |
| Title & Text Alt | 24 | Six short items | A 3 × 2 grid of heading (small, accent or bold) plus short body, on the three inner cells |
| Title, Text & Image | 26 | Text beside picture | Title and body in the start half, picture bled over the end half. Some add 3 or 4 numbered items |
| Title, Text & Multi-Image | 22 | Captioned pictures | 2 or 3 pictures in a row on the inner cells, each with a heading or caption under it |
| Text & Image, Text & Multi-Image | 21, 18 | Message beside picture(s) | Body at lead size beside a half picture or an asymmetric pair |
| Statement | 29 | One sentence | Display text at about 16% of the height, top-left; sometimes an attribution or "fact information" line at the foot |
| Statement & Image | 8 | Statement plus picture | Statement over the top half and a picture in the bottom half, or a statement over a full-bleed picture |
| Quote, Quote & Image | 38, 20 | Quotation | Quote at 10 to 16% of the height with a hanging opening mark; attribution small, often caps with tracking. With a picture: quote in one half, picture bled in the other |
| Fact | 36 | One figure | The figure at about 37% of the height, start-aligned at the top, and a small label at the foot or beside it |
| Image, Image - 2 Up, Multi-Image | 34, 11, 10 | Pictures | A full bleed; a staggered pair; a lead picture with 2 to 4 smaller ones |
| Title & Multi-Image | 5 | Picture series | 3 tall pictures, or a staircase of ascending sizes |
| Live Video, Title, Text & Live Video | 35, 18 | Live camera feed | A placeholder for the presenter's camera, full slide or one half |
| Blank | 38 | | |

### Type scale

The scale is sparse. The usual point sizes at 1080 px are 20, 30 or 35, 60, 75, 120, 175 and 400: steps of about 1.5× to 2.3×, with nothing between.

**Sizes by role** (percent of the slide height; OPF reference pixels at a 720 px short edge in brackets):

| Role | Median | Middle half (p25 to p75) | Extremes | Weight habits |
| --- | --- | --- | --- | --- |
| Footer, caption, attribution | 1.9 (14 px) | 1.9 to 2.8 | 1.5 to 3.6 | Regular; attributions often caps +0.10 tracking |
| Small heading, label | 2.0 to 3.3 (14 to 24 px) | | | Bold or semibold, or accent color |
| Small body (cells, captions) | 2.8 to 3.2 (20 to 23 px) | | | Regular |
| Content body (the message) | 5.6 (40 px) | 4.3 to 5.9 | 1.9 to 6.9 | Regular or light |
| Content title | 5.9 (42 px) | 4.6 to 6.9 | 1.9 to 11.8 | Semibold or medium, or the display face |
| Cover title | 11.1 (80 px) | 9.3 to 12.0 | 5.6 to 38.9 | Display face; semibold to heavy |
| Section title | 10.6 (76 px) | 9.3 to 11.1 | 4.6 to 27.8 | As the cover |
| Quote | 10.4 (75 px) | 8.4 to 16.2 | 5.6 to 37 | Display face, often regular or light |
| Statement | 16.2 (117 px) | 10.2 to 18.5 | 5.6 to 27.8 | Display face; condensed faces go largest |
| Fact (figure) | 37.0 (266 px) | 37.0 to 38.9 | 23.1 to 55.6 | Display face; light in serif themes, bold in grotesques |

**Spacing:**

- **Line spacing (relative).** Display text uses 0.8 to 0.9, and Hustle uses 0.6 for condensed capitals. Body text uses 1.0 to 1.1. In em that is about 0.95 to 1.1 for display and 1.2 to 1.3 for body.
- **Tracking:**
  - −0.01 to −0.03 on display sizes;
  - +0.02 on small bold labels;
  - +0.10 to +0.12 on all-caps labels and attributions.
- **Paragraph spacing.** Body lists use a space before of about 0.5 to 1 line (30 to 45 pt on 46 to 60 pt text).

**Line length.** Estimated from the box width and a 0.5 em average character:

- body placeholders hold a median of 38 characters per line (p25 28, p75 46, max 117);
- statement boxes about 18;
- quote boxes about 20.

Keynote never asks for a long measure at these sizes.

### Alignment habits

- Of 1727 text placements in titles, bodies, statements, quotes and figures:
  - 1667 are start-aligned (left, or "natural");
  - 37 are end-aligned: page numbers in Contents, a few attributions, and Hustle's right-set display lines;
  - 23 are centered, nearly all in Dynamic Chill and Purple Tropics.
- Vertical anchoring:
  - titles are top-anchored;
  - covers are top-anchored in 31 themes, bottom-anchored in 4 (Volunteer Colorful, Scientific Muted, Academic Modern, Factory) and middle-anchored in 3 (Gradient Colorful, Fitness Dark, Fitness Bold);
  - labels under pictures and attributions are bottom-anchored so their last line sits on a grid line.
- One-message slides (statement, quote, fact) are start-aligned and top-anchored, with the label or attribution pinned to the foot. The slide is not centered. Its type is simply very large.

### Hierarchy without size

- **Equal-size cover pairs.** 19 of 28 covers with a subtitle set the subtitle at the title's size. Contrast comes from one of:
  - weight: semibold over regular (Standard Minimalist, Meadow Pastel, Startup Simple);
  - italic: demibold over italic (Photography Bold, Event Elegant);
  - color (Branding Modern, Educator Playful).
- **Title no larger than the body.** This holds on content slides in 22 of 32 themes:
  - Usually the two are equal: Luxury Elegant 5.6 and 5.6, Educator Playful 5.1 and 5.1, Community Colorful 6.9 and 6.9.
  - In the side-title themes the body is larger: Startup Simple, Photography Bold, Event Elegant and Culinary Plain set the title at 1.9% and the body at 5.6% of the height.
- **Side titles.** 12 themes place the content title in column 1, from x = 0.035, about 0.13 to 0.15 wide, and start the body at x = 0.19 to 0.27 with a width of 0.61 to 0.75. The 12 are Note-Taking Colorful, Luxury Elegant, Standard Minimalist, Meadow Pastel, Startup Simple, Photography Bold, Journalism Simple, Painting Simple, Event Elegant, Culinary Plain, Wellness Pastel and Standard Bold. The slide then reads like a magazine page: a running head at the start, the text in a wide column.

### Color use

- **Grounds.**
  - A theme uses a median of 5 background colors (range 1 to 9), assigned per master.
  - Content slides share a light ground; statement, quote and fact slides take a deeper or warmer one; sections take the darkest.
  - Across all masters, 22% sit on dark grounds.
  - Muted families (Scientific Muted, Editorial Colorful, Travel Colorful) rotate 5 to 9 grounds across masters.
- **Text color.** A median of 2 colors per theme, usually black and white or one tinted ink with white:
  - brown #8C4414 on cream (Luxury Elegant);
  - violet #361159 (Wellness Pastel);
  - navy #262138 (Factory);
  - parchment #DCD8BD on dark grounds (Academic Modern).
- **Accent.** One accent usually marks small things: headings in Business Modern's blue, Cyber Stark's neon heading per layout, and the ruled lines. Large areas of color are grounds or color blocks, not text.
- **Contrast.** Body text is high contrast (median 13 to 21:1). The lowest pairs (5 to 8:1) are black on mid-tone grounds such as #929CBA or #C7A252.
- **Palette.** The theme's picker palette has 24 swatches: 6 hues × 4 tints, plus grays. The masters use only 2 to 6 of them.

### Picture treatments

Of 552 picture placeholders, 395 are insets on the grid, 115 bleed to one to three edges and 42 are full-bleed.

- **Half bleed.** The workhorse beside text: exactly half the slide wide, full height.
- **Matted full image.** Standard Minimalist and Standard Bold inset the "full" picture by 0.014 of the width and 0.023 of the height, with rounded corners.
- **Rounded corners.** The radius is 15 px (0.8% of the width, 1.4% of the height) in Standard Minimalist and Standard Bold, and 30 px (2.8% of the height) in Hustle. One radius serves every picture of the theme.
- **Shaped masks.** 61 frames. Community Colorful uses notched rectangles (an L-shaped bite out of one corner) that interlock with color blocks; Hustle uses a large cut-out shape.
- **Mosaics.** A lead picture about half the slide, with 2 to 4 smaller ones on the grid. Staggered pairs (two equal pictures offset vertically by about 0.25 of the height). A staircase of 3 or 4 pictures growing from small to tall (Photography Bold).
- **Frames and chips.**
  - thin rules around specimen pictures (Scientific Muted);
  - a double-rule frame (Academic Modern);
  - pale gray caption chips (30% opacity, rounded) pinned to the top edge of a picture (Standard Minimalist).
- **Gutters.** 0.012 to 0.013 of the width between pictures in a row: tight, as in print.

### Placeholder behavior

- Title and body placeholders carry what reads as an "autoshrink" flag. Decorative text shapes do not.
- Keynote's answer to overflow is to shrink the text. OPF's direction rejects that, and this is the one structural habit OPF should not copy.

### Fonts

No theme bundle contains a font file. `TemplatesMetadata.plist` lists each theme's fonts, and `FallbackFonts.plist` gives Keynote's own replacement when a face is missing.

| Face (as used) | Status | Keynote's fallback | Themes |
| --- | --- | --- | --- |
| Graphik (Light to Bold) | Licensed commercial face, downloaded on demand; not installed on this Mac | Avenir Next | 14 themes: 40, 41, 44, 47, 51, 52, 55, 57, 58, 61, 68, 74, 77, 98 |
| Founders Grotesk, Text, Condensed | Same | Helvetica Neue; Avenir Next Condensed for Condensed | 46, 49, 53, 54, 60, 66, 84, 102; Condensed in 64, 68, 98 |
| Druk, Druk Wide | Same | Avenir Next Condensed; Avenir Next for Wide | 45, 66, 102 (Wide in 102 only) |
| Domaine Display | Same | Hoefler Text | 40, 41, 49, 60 |
| Canela, Canela Text | Same | Georgia | 48, 70 |
| Publico Headline, Publico Text | Same | Charter | 43, 56, 63, 67, 69 |
| Produkt | Same | Rockwell | 42, 44, 45 |
| Avenir Next | Apple system font (installed) | — | 59, 65, 89 |
| Charter | macOS supplemental font (installed) | — | 45 |
| Courier New | macOS supplemental font (installed) | — | 50, 52, 55, 57, 62, 63, 64, 71 |
| Helvetica, Helvetica Neue | Apple system fonts | — | All, for hidden default styles only |

No new theme uses SF Pro or New York. The substitutes table in the proposals still covers them, since OPF users will ask for them.

## The families

Each family below has its layout set, grid, type scale, alignment, color and picture treatment. Exact boxes are in Appendix A.

### Bold display: Purple Tropics, Fitness Bold, Hustle, Recreation Colorful, Scientific Muted

These themes use a condensed or high-contrast display face at very large sizes over a quiet grotesque or serif body.

**Purple Tropics** (older 17-master scheme, shared with Dynamic Chill):

- **Layouts.** Title, Title & Photo (Alt), Title & Bullets, Bullets, Title, Bullets & Photo, Title, Bullets & Live Video (Small/Large), Section, Title Only, Agenda, Statement, Big Fact, Quote, Photo - 3 Up, Photo, Blank.
- **Grid and margins.** Margins 0.049, title at y = 0.069, body box from y = 0.31 to 0.91.
- **Type.** Title 8.1% (Domaine Display Bold, line spacing 0.9); subtitle 4.2% (Graphik Medium); body 4.3% (Graphik Regular, tracking −0.04, 45 pt space before); statement 10.2% centered; big fact 23.1% centered; quote 8.4%.
- **Color.** Two violet grounds (#2F0A87 and #5E18A4), white text.
- **Pictures.** The cover title sits on a translucent white panel (0.92 × 0.31 of the slide) over the lower third. This is the only family with centered statements, facts and section titles.

**Fitness Bold:**

- **Grid and type.**
  - Titles are Founders Grotesk Condensed Semibold at 15% (cover) and 9.3% (content), with line spacing 0.8 and tracking −0.01 to −0.02.
  - The content title and the subtitle are both 9.3%, and the subtitle is indented by one grid column (x = 0.191). This gives a stepped two-line headline.
  - Body is Graphik Regular at 3.1%: a 3:1 ratio between headline and body.
- **Distinctive layouts.**
  - Contents is a diagonal staircase of five "0N | Section" lines at 9.3%, each indented 0.066 further, with page numbers on a parallel diagonal.
  - Title & Bullets draws 9 px black rules between three numbered rows: number 8% condensed, text 3.1%.
  - Fact puts the figure (37%) on a green tile beside a navy ground.
- **Color.** Yellow, green, orange and navy grounds, with black on light and white on navy.
- **Pictures.** Half bleeds, a 3-up mosaic of pictures and color tiles in a 3 × 3 checkerboard, full bleeds.

**Hustle** (27 masters, the largest set):

- **Color.** Two colors only: forest green (#2B390B) and pale sky (#CDEEFD), each the ground for the other as text.
- **Type.**
  - All display text is ultra-condensed italic capitals (Druk): cover 38.9%, section 20.4 to 28.2%, statement 23.1%, quote 22.2%, fact 40.7%. Line spacing is 0.6.
  - The cover title is end-aligned and deliberately breaks inside a word and runs off the slide.
  - Body is Founders Grotesk at 3.9%, and captions are an extended face (Druk Wide) at 3.0% in caps.
- **Pictures.** Rounded rectangles of radius 30 px on a tight grid (gutters 0.012), and a full-slide shaped mask that leaves a cut-out text pocket ("List", "Statement & Image").
- **Distinctive layouts.**
  - Title 2 (title and subtitle both 11.1%, heavy italic over medium);
  - Fact Alt (four figure tiles of two sizes);
  - Quote with a separate 37% quotation mark.

**Recreation Colorful:** the same condensed approach with primary-color grounds. Cover 18.5%, fact 55.6% (the largest figure in the set), statement 25.9%, body 3.9%.

**Scientific Muted:**

- **Type.** The display face (Druk Bold) is anchored to the foot of the slide: the cover title (27.8%) sits bottom-anchored in a box from y = 0.39 to 0.99; the statement (27.8%) and quote (18.5%) are bottom-anchored the same way. Body is Charter at 2.8%; fact 55.6%.
- **Lines.** A hairline rule runs across under the top margin. Specimen pictures sit in thin outlined boxes.
- **Color.** Grounds rotate through five muted colors (mustard, slate blue, sage, mauve, gray-green), with black text.

### Elegant serif: Luxury Elegant, Event Elegant, University Classic, Academic Modern

These themes use one serif, or a serif display face over a grotesque, with tinted ink and warm grounds.

**Luxury Elegant:**

- **Type.**
  - One face (Canela Regular) at three sizes only: 11.1% (cover and section), 5.6% (content title and body alike) and 1.9% (captions, caps +0.10).
  - Line spacing is 0.8 everywhere. Quote 16.2%, fact 37%.
  - Titles use title case. Quotes are top-left with the attribution in the opposite corner.
- **Grid.**
  - The content title sits in column 1: x = 0.058, 0.126 wide, the full height.
  - The body starts at 0.193 and is 0.748 wide.
  - A vertical hairline (2 px) runs near x = 0.036, from y = 0.07 to 0.93, on every master.
- **Color.** Ink #8C4414 or #834821 on cream #FFF6E0; statement, quote and fact on peach #FFBE92; cover and section on brown, white text.
- **Pictures.** Half bleeds; 2-up and 3-up rows on the inner cells with 1.9% captions.

**Event Elegant:**

- **Type.** Publico Text and Headline, roman over italic for the cover pair, both 11.1%.
- **Color.** A single tan ground (#F2EDE1) for all 20 masters.
- **Grid.** Side titles at 1.9%, body 5.6%.

**University Classic and Academic Modern:**

- **Type.**
  - A display serif (Domaine Display Regular) for titles: cover 13.7% (University) and 16.7% (Academic), content 5.6 to 11.8%.
  - Body in Founders Grotesk at 5.3 to 5.6%, regular or bold.
  - Fact 46.3%.
- **Color.** Academic Modern inverts the usual: parchment text (#DCD8BD) on navy, brown, maroon and olive grounds, and navy text on parchment.
- **Pictures.**
  - Academic Modern frames pictures with a double rule in the ground's color.
  - University Classic uses marbled-paper textures as pictures.

### Minimalist grid: Standard Minimalist, Standard Bold, Business Modern, Startup Simple, Culinary Plain

These are white or cream grounds, one grotesque or one monospace, and side titles. The grid does all the work.

**Standard Minimalist:**

- **Type.**
  - Cover title and subtitle are both 10.0%: Founders Grotesk Semibold over Regular, tracking −0.01.
  - Content title 5.6% semibold in column 1 (0.141 wide). Body 5.6% regular from x = 0.19 (0.617 wide), with a 30 pt space before each paragraph.
  - Quote 16.2% from x = 0.001: the opening mark hangs into the margin.
  - Fact 37%, start-aligned, its box starting above the slide (y = −0.056) so the figure's cap height sits on the top margin.
- **Pictures and cells.**
  - Pictures have 15 px rounded corners. The "full" picture is matted at 0.014 / 0.023.
  - Captions are 22 pt bold on pale gray chips at 30% opacity.
  - Numbered cells (number 5.6%, text 1.9%) sit on pale gray rounded tiles in a row of three.

**Standard Bold** is the same system in white on black.

**Business Modern:**

- **Type.**
  - The content title is a 1.9% label in accent blue (#007FFF) in column 1, above a 1.9% note in title case.
  - The body (Founders Grotesk Light) is 3.2 to 5.6%, in columns 2 to 5.
  - Title & Text Alt numbers six columns with 13.9% blue numerals and vertical hairlines.
  - Cover title 11.2% Medium over an 11.1% Light subtitle, white over a full-bleed picture.
  - Statement and quote are light weight on brown grounds; fact 38.9% light.
- **Pictures.** Image - 2 Up staggers two equal pictures (one up, one down). Multi-Image is a lead picture with two smaller ones.

**Startup Simple and Culinary Plain:**

- **Type.** The side title is only 1.9% and the body 5.6%. Culinary Plain sets everything in Courier New.
- **Pictures.** Culinary Plain has 39 inset picture placeholders, the most picture-heavy theme.

### Playful: Educator Playful, School Simple, Note-Taking Colorful, Family Colorful

**Educator Playful:**

- **Type.**
  - White ground, Founders Grotesk Semibold.
  - The cover title is 6.9% in blue (#1E38C0) over a 6.9% black subtitle.
  - Content title and body are both 5.1%. Statement 20.7%; fact 50.9% in green.
- **Decoration.**
  - Hand-drawn marker strokes, arrows and loops in six colors, as filled custom shapes.
  - They are placed in the empty quarter of the slide, never under text: a stroke under the cover title, a swirl around the Section corner.
- **Pictures.** Half bleeds and 3 × 2 picture grids.

**School Simple** uses Publico with flat object illustrations.

**Note-Taking Colorful:**

- A single face (Graphik Regular) at 1.9, 2.8, 5.5 and 11.1%.
- A tall orange sidebar block in column 1 holds the title.
- Pale blue panels hold 3 × 2 grids.

**Family Colorful** uses Graphik Regular only, with flat illustration.

### Dark: Fitness Dark, Cyber Stark, Standard Bold, Factory

**Fitness Dark:**

- **Color.** Muted dark grounds (slate #212B33, olive #5E5534, green-gray #4A5C55) and white text only. Contrast is 7 to 7.4:1, deliberately softer than pure black.
- **Type.**
  - Titles in Founders Grotesk Condensed Semibold: cover 14.8%, middle-anchored; content 11.6%.
  - Body in Graphik Regular at 3.0%.
  - Statement 25.9% over a full-bleed picture; fact 37%.
- **Pictures.** Half bleeds and an asymmetric 2-up.

**Cyber Stark:**

- **Type.**
  - Black ground. Everything is in Courier New Regular: title and subtitle 4.6 to 5.6%, body 2.8 to 4.6%, statement 11.6%, fact 27.8%.
  - Each layout gives its display text one neon accent: magenta statement, yellow quote, cyan quote with picture, orange list markers, green headings.
- **Pictures.** Abstract colored renders as half bleeds; the Section master flips to white.

**Factory** is the same monospace approach in navy and pale mint.

### Pastel: Meadow Pastel, Wellness Pastel, Travel Colorful

**Meadow Pastel:**

- **Grounds and type.**
  - Cream (#FBF7EF), sand, pale blue and pale green grounds, with a faint dot grid.
  - Graphik Semibold display (cover 10.1% title and subtitle) with Courier New labels.
  - Side titles at 3.3%; body 5.6% with line spacing 1.1 to 1.4.
  - Fact 37%.
- **Pictures.**
  - Paintings as pictures.
  - Image - 2 Up staggers two pictures diagonally on a pale blue ground.
  - Title & Multi-Image runs three tall pictures across columns 2 to 6.

**Wellness Pastel:**

- **Type.** White ground with deep violet text (#361159), and "natural" alignment throughout.
- **Grounds.** Pastel gradient covers (pink to lilac).

**Travel Colorful:** Graphik Light display with Courier New subtitles, thin crosshair rules, and warm muted grounds rotating per master.

### Colorful: Community Colorful, Branding Modern, Gradient Colorful, Sales Bold, Wellness Bold

**Community Colorful:**

- **Type.** White ground; one slab face (Produkt) at 6.9% for title, subtitle and body alike, with weight contrast (Medium over Light).
- **Color blocks.**
  - Saturated blocks (yellow, sky, pink, green, orange, lilac) hold the cover title, the section, the statement and the fact.
  - Pictures and blocks interlock through notched corners: one frame's missing corner is filled by the next block.
- **Grid.** Inset, with a 0.017 to 0.037 margin.

**Branding Modern:**

- **Type.** Graphik Medium title and Regular subtitle at the same size, with color contrast (maroon or green over black).
- **Motifs.** Large petal motifs as vector shapes bled off the edges of section, statement and quote slides. The Image masters are repeating pattern tiles.

**Gradient Colorful:**

- **Grounds.** Concentric-ring and banded gradients in one hue family per master.
- **Type.** Graphik Bold; fact 46.3%; Courier New captions.

**Sales Bold:**

- **Grounds and type.** Light gray ground with large saturated starburst shapes. Avenir Next Medium over Regular; cover 13.9%.
- **Accent.** The statement is set in the accent color, centered.

**Wellness Bold:** saturated and gradient grounds, Graphik Regular only, statement 18.5%.

### Photography: Photography Bold, Photography Colorful, Scrapbook Dark, Painting Simple

**Photography Bold:**

- **Type.**
  - White ground. Avenir Next Demi Bold for titles and body, and Avenir Next Italic for subtitles and captions.
  - Cover title and subtitle are both 10.1%.
  - Side titles at 1.9%; body 5.6%.
- **Pictures.**
  - The cover is a single saturated ground with a staircase of four black-and-white pictures growing from 0.13 to 0.34 of the width.
  - Title & Multi-Image repeats the staircase on yellow and pink grounds.
  - A 5 × 2 grid of small pictures carries two-line captions (name bold, detail italic).
  - 28 inset pictures in all.

**Photography Colorful** alternates white and black masters.

**Scrapbook Dark:** 16 inset pictures of mixed sizes on earthy dark grounds, as a collage.

**Painting Simple:** Founders Grotesk Condensed and Courier New, with watercolor pictures.

### Editorial: Editorial Colorful, Journalism Simple

**Editorial Colorful:**

- **Type.**
  - One light serif (Canela Regular) for everything: cover 10.4%, content title 8.3%, body 6.5 and 3.0%, statement 18.5%, quote 11.1%, fact 37%.
  - Line spacing 0.8 to 0.9. Title case.
- **Grounds.** Rotating muted pastels: periwinkle #7CAACB, sage, mustard #ECCB6C, coral #E68B7A, sand. A charcoal Contents.
- **Pictures.** Halftone-printed pictures, inset and overlapping on the grid.

**Journalism Simple:**

- **Type.** Newspaper serif (Publico) with typewriter labels (Courier New).
- **Lines.** Vertical column rules.
- **Grounds.** Red cover; side titles.

## What OPF's default catalog lacks

OPF today (commit `b5629b2ea`):

- 40 layouts;
- 3 themes (Bold on Impact, Classic on Tenorite, Minimal on Aptos);
- 14 color schemes;
- 89 font schemes, mostly families that ship with PowerPoint or the operating system, plus a few open ones;
- 22 bundled open families in `packages/render/fonts`.

The layout-harvest program (`docs/programs/layout-harvest/`) already covers much of the growth and placement behavior. The table marks what is new.

| Keynote pattern | OPF today | Gap | Already planned? |
| --- | --- | --- | --- |
| Statement at 16% of the height (median; up to 28%) | `LONE_DISPLAY_SIZES.text` 43 px (6.0%); the statement title can grow to 75 px (10.4%) | Statement display size is about 60% of Keynote's | Partly: LH-09, LH-48, LH-129 grow type, but cap at these sizes |
| Quote at 10 to 16% | `LONE_DISPLAY_SIZES.quote` 56 px (7.8%) | Smaller by a step | Partly (LH-78) |
| Fact (lone figure) at 37% | `METRIC_DISPLAY_SIZES.one` 120 to 160 px (16.7 to 22%); lone value cap 232 px (32%) | Close only for a lone value; the metrics layout centers it | Partly (LH-101, LH-112) |
| Cover title at 11% (and 15 to 39% in bold themes) | Heading display 75 px (10.4%) | Matches the median; no theme reaches the bold range | LH-129, LH-130 |
| Side title in column 1 | No record; cycle, matrix and vertical-flow put the title beside a diagram, not prose | New layout family | No |
| Subtitle at the title's size, contrast by weight or color | Subtitle display 37 px, half the title | New theme option | No |
| Six-column grid shared by all masters | Regions sized by ratios per record; padding 0.08 of the short edge | No shared column system; margins are roomier than Keynote's 0.062 | No (LH-31 audits gaps, LH-38 places furniture) |
| Contents with end-aligned page numbers | `agenda`, `agenda-split` (numbered sequence) | No end-aligned number column; no "contents" record | LH-134 (agenda as numbered ruled rows) |
| Quote beside a bled half picture; statement over a picture | `quote` (no media region); `hero` (lead plus media, 3:2) | No quote-with-picture record; no 1:1 split | LH-80 (35 to 50% picture track), LH-158 (text on picture placement) |
| Mosaics: lead picture plus 2 to 4; staggered pair; staircase | `gallery` (uniform grid) | No asymmetric gallery records | LH-46, LH-47 (extra blocks join as lead plus mosaic) |
| One picture corner radius per theme; matted full picture | Per-image `adjust` on a `roundRect` frame | No theme-level picture style | No |
| Grounds per layout, rotating muted grounds | LH-01 layout variants (section on accent, statement and quote on light2); themes have light, dark and alt variants | No rotation across content slides | No (LH-103 is about fixed deck backgrounds) |
| Display leading 0.95 to 1.1 em, tracking −1 to −3%; caps labels +10% | Line height about 1.22 em for most text; eyebrow +0.08 em | No role-based display leading or negative tracking | LH-32 (eyebrow only) |
| Condensed display, serif display, monospace-only, duotone themes | 3 themes; font schemes are mostly one family for both slots | Few theme personalities | No |
| Footer: title and date in grid columns 1 and 2 | Header and footer furniture (LH-38) | None of substance; OPF's 16 px floor (2.2%) is above Keynote's 1.9% footers, which is right | Done |
| Autoshrink placeholders | Never shrink; change the arrangement first (LH-186) | Keynote's habit is the one OPF rejects | n/a |

## Proposals for OPF, ranked

Ranking is by how much each raises the average default slide, then by cost. Each proposal is marked "fits OPF's direction" or not, measured against the binding direction:

- bodies fill the slide;
- type grows and is centered;
- text is never shrunk when another arrangement works;
- lines stay within about 70 characters.

### 1. Display sizes keyed to message length (fits)

**The rule.** Let a lone message on a one-message slide (statement, quote, lone metric) grow beyond today's caps, as far as its character count allows. Sizes are given as a share of the short edge (reference px at 720 in brackets):

| Message | Up to 30 characters | 31 to 60 | 61 to 120 | Over 120 |
| --- | --- | --- | --- | --- |
| Statement | 16% (115 px) | 11% (80 px) | 7.5% (54 px) | Today's rules |
| Quote (body) | 12% (86 px) | 10% (72 px) | 7.8% (56 px) | Today's rules |

A lone metric value of 6 characters or fewer grows to 35% (252 px). Its label stays at 2.5 to 3% of the height and is pinned to the foot of the region or set beside it.

**Why it fits.** Type only grows. At these sizes a statement box of 0.8 of the width holds 18 to 25 characters per line, far inside 70. Keynote's own statement and quote boxes hold 18 to 20.

**The placement.** Keep OPF's middle anchor and centered group: OPF centers where Keynote sets top-left. Offer Keynote's top-start placement only as the layout's `anchor: "top"` with `contentAlignment: "start"`.

**Code.** Extend `LONE_DISPLAY_SIZES` and `METRIC_DISPLAY_SIZES` with a length-keyed ceiling. Builds on LH-48, LH-101, LH-112 and LH-129.

### 2. A six-column grid for templates (fits)

**The grid.** Give template composition a shared column grid:

- 6 columns across the content box;
- gutter about two thirds of the composition gap (Keynote's gutter is 2.1% of the height, and OPF's gap 3.3%);
- side margin 0.062 of the short edge (Keynote's), against today's 0.08 padding;
- top margin 0.05.

**Region sizes.** A region's `size` may then be a span of columns. This is the schema change: today `size` is a weight. Records then share alignment lines:

- the title and body of a side-title slide;
- a 3-up picture row;
- footer items, which sit on the column lines.

**Why it fits.** Narrower margins give bodies about 5% more width and height to fill. Shared lines are the "small set of repeatable alignment lines" of `docs/slide-design-principles.md`.

**Guard.** Keep the 0.08 padding for dense content when the 0.062 margin would put text under the floor.

### 3. Side-title layouts (fits with a guard)

New records `text-side-title`, `list-side-title` and `image-side-title`:

```json
{ "id": "text-side-title", "name": "Side title", "direction": "row",
  "design": { "titleAlignment": "start", "contentAlignment": "start" },
  "regions": [
    { "name": "title", "size": 1, "anchor": "top" },
    { "name": "body", "size": 5, "accepts": ["text", "list", "quote", "group"], "role": "primary", "flow": "auto", "anchor": "top" }
  ] }
```

- **The body.** It starts one column in, takes lead size, and grows toward LH-48's fill target, so the text is the large element.
- **The title.** It sits at title role size or one step under, never below the floor.

**Guard.** Use the record only when the title fits its column in 3 lines or fewer, with no word broken:

- at a 1-of-6 column that is about 12 to 16 characters per line at title size, so titles up to about 40 characters;
- otherwise the title takes the full width above, as in `text`.

**Why the guard.** LH-51 wants one-line titles. A side title is a running head, not a headline, so the rule is relaxed only where the column holds it cleanly.

**Not adopted.** Keynote's 1.9% side titles: they are under OPF's 16 px floor.

### 4. Equal-size heading pairs (fits)

**The option.** A theme or deck design key, for example `design.headingPair: "weight" | "color" | "italic" | "scale"`:

- `"scale"` (the default) is today's behavior: the subtitle is about half the title.
- The others set the subtitle at the title's size, regular against semibold, in the secondary text color, or italic.
- The same applies to a content slide's subtitle.

**Why it fits.** It removes a size step instead of adding one, the subtitle grows, and LH-130's display growth applies to the pair.

**Font schemes.** They gain an optional `minorWeight`, or a pairing note, so the weight contrast survives in PowerPoint, which needs a real Semibold face (all suggested families have one).

### 5. Picture-led records (fits)

| Record | Regions (OPF vocabulary) | Notes |
| --- | --- | --- |
| `quote-beside` | row: `quote` (size 1, accepts quote, role primary, anchor bottom); `media` (size 1, accepts image/video, role media, bleed) | Exactly half and half. The quote grows per proposal 1 inside its half |
| `statement-picture` | column: `title` (rule false); `message` (size auto, accepts text/quote, role primary); slide background picture | Uses LH-02's scrim and LH-158's calm-area placement; the statement grows as in proposal 1 |
| `mosaic` | row: `lead` (size 3, media, bleed); split column (size 3): `pictures` (flow grid, max 4, media) | Lead picture half the slide, full height; 2 to 4 smaller ones on the column grid with gutters of about two thirds of a gap |
| `hero` with `design.split: "half"` | As `hero`, sizes 1:1 | LH-66's minimum measure (text at least 40% of the width) holds at 50% |
| `gallery` option `arrangement: "staggered"` | 2 pictures, offset by a quarter of the body height | Decorative. Use only for exactly 2 pictures of the same aspect |

The staggered and staircase picture arrangements are **partly** in the direction: they fill less of the body than a grid. Offer them as options, not defaults.

### 6. Five new themes on open fonts (fits)

Each theme pairs one display face with one text face and sets a color scheme, picture corner radius and display leading. Every face is OFL-1.1 or Apache-2.0. Check each face's license file and record `PROVENANCE.json` before bundling, per OPF's font rule.

| Theme (proposed) | Display / text | Display sizes | Grounds and ink | Picture style |
| --- | --- | --- | --- | --- |
| **Athletic** (condensed display) | Anton or Bebas Neue (bundled, OFL) with Hanken Grotesk (OFL) or Figtree (bundled) | Cover 15%, statement 22%, figure 40%; leading 0.9 em, tracking −1% | Four saturated grounds (one dark), black or white ink | Bled halves, square corners |
| **Editorial** (serif display) | Playfair Display (bundled) or Fraunces (OFL) with Source Serif 4 (OFL) | One serif at three sizes (11%, 5.6%, 2.2%), leading 1.0 em | Cream ground, one tinted ink (warm brown or ink blue), statements on a second ground | Half bleeds, inset rows with captions |
| **Mono** (monospace) | IBM Plex Mono or Space Mono (OFL), one face only | Statement 12%, figure 28% (monospace widths cap the size) | Near-black ground, white ink, one accent per layout | Abstract or colored pictures, bled |
| **Duotone** (two chromatic colors) | Oswald or League Gothic (OFL) with Schibsted Grotesk (OFL) | Cover 25%, leading 0.85 em, caps | Two colors only, each the other's ink. Not Apple's pairing; for example ink navy #14213D with pale apricot #FBE3C8, or plum #3B1E3F with pale sage #DDEBD9 | Rounded corners at 2.5% of the short edge |
| **Specimen** (muted rotation) | League Gothic (OFL) with Charis SIL (OFL) | Bottom-anchored cover title 25%; hairline under the top margin | 5 muted grounds rotating (proposal 9), black ink at 7:1 or better | Thin outlined boxes around inset pictures |

**Open substitutes for the faces Keynote uses, and for Apple's system faces:**

| Keynote face | Character | Open substitute (license) | Bundled in OPF already? |
| --- | --- | --- | --- |
| SF Pro | Neutral grotesque, many weights | Inter (OFL) | No |
| New York | Text serif with optical sizes | Source Serif 4 (OFL), Newsreader (OFL) | No |
| Avenir, Avenir Next | Geometric-humanist sans | Nunito Sans (OFL), Figtree (OFL) | Figtree |
| Futura-like geometric | Geometric sans | Jost (OFL), League Spartan (OFL) | No |
| Helvetica Neue | Neo-grotesque | Inter (OFL), Arimo (Apache-2.0, metrics only) | No |
| Graphik | Plain grotesque | Hanken Grotesk (OFL), Figtree (OFL), Inter (OFL) | Figtree |
| Founders Grotesk | Grotesque with old-style flavor | Schibsted Grotesk (OFL), Archivo (OFL) | No |
| Founders Grotesk Condensed | Condensed grotesque | Archivo Narrow (OFL), Barlow Condensed (OFL) | Archivo Narrow; Barlow (regular width) |
| Druk | Ultra-condensed heavy display | Anton (OFL), Bebas Neue (OFL), League Gothic (OFL), Oswald (OFL) | Anton, Bebas Neue |
| Druk Wide | Extended display | Archivo at its widest width (OFL), Unbounded (OFL) | No |
| Domaine Display | High-contrast serif display | Playfair Display (OFL), DM Serif Display (OFL), Fraunces (OFL) | Playfair Display |
| Canela, Canela Text | Light contemporary serif | Fraunces in light weights (OFL), Cormorant (OFL); Newsreader for text | No |
| Publico Headline, Publico Text | News serif | Source Serif 4 (OFL), Newsreader (OFL), Lora (OFL) | Lora, PT Serif |
| Produkt | Slab serif | Zilla Slab (OFL), Roboto Slab (Apache-2.0), Bitter (OFL) | Bitter |
| Charter | Transitional text serif | Charis SIL (OFL), derived from Charter | No |
| Courier New | Typewriter monospace | Courier Prime (OFL), IBM Plex Mono (OFL), Space Mono (OFL) | No |

### 7. Role-based display leading and tracking (fits)

- **Leading.** Text set at 2× the body role size or more uses 1.0 em leading, and 0.9 em for condensed caps, instead of about 1.22 em.
- **Tracking.** Display text uses −1% to −2% tracking. All-caps labels and attributions use +8 to +10%, which extends LH-32's eyebrow tracking to attribution and caption roles.
- **Why it fits.** Nothing shrinks; tighter display leading lets a two-line statement grow a further step within the same box.
- **PPTX.** Write exact line pitch (as LH-98 does for bodies) and `spc` for tracking, so PowerPoint matches.

### 8. A `contents` record with end-aligned numbers (fits)

```json
{ "id": "contents", "direction": "row", "design": { "listStyle": "rows", "contentAlignment": "start" },
  "regions": [
    { "name": "title", "size": 2, "anchor": "top" },
    { "name": "entries", "size": 4, "accepts": ["list"], "role": "primary", "flow": "none", "sequence": "numbered" }
  ] }
```

- Each entry is a ruled row: the entry text at the start, and the section number or page at the end, end-aligned, in the same face and size.
- The size grows toward the fill target up to about 7% of the height (Keynote's Contents size).
- **Why it fits.** Extends LH-134 with the end column. Rows stay whole, never split across columns.

### 9. Ground rotation for content slides (fits partly)

- **The variant.** A theme variant `"rotate"` (or `design.variant: { "rotate": ["light2", "accent2-tint", ...] }`) walks content slides through 3 to 5 grounds in deck order.
- **Constraints.**
  - Each ground must keep the theme's ink at 4.5:1 or better.
  - LH-01's layout variants (section, statement, quote) still win.
- **Why only partly.** It does not affect bodies or type, so it is neutral to the direction. It helps the muted and editorial personalities, but it weakens slide-to-slide consistency in business decks. Make it a theme choice, never a default.

### 10. Theme-level picture style (fits)

Add `design.pictureCorner` (a share of the short edge: 0, 1.4% or 2.8%) and `design.pictureMatte` (an inset for a lone full picture: 0 or about 2.3% of the short edge). They apply to every picture block of the deck, written in PPTX as a `roundRect` preset with its `adj`. This replaces per-image `adjust` for the common case.

### 11. Fact layout start-aligned (fits partly)

- **The pattern.** Keynote sets the figure top-left at 37% with its label at the foot.
- **OPF.** The `metrics` layout centers. For a lone figure, `contentAlignment: "start"` with the label as a foot line reads as Keynote's Fact.
- **Why only partly.** OPF's direction prefers centered type. Offer it as a `fact` record that themes may choose (Specimen, Editorial), and keep `metrics` centered.

### Not recommended (does not fit OPF's direction)

- **Autoshrink placeholders.** Keynote shrinks overflowing text. OPF changes the arrangement first (LH-186).
- **Hairline side titles at 1.9% of the height** (14 px at 720). This is below OPF's 16 px floor. Use proposal 3's title size instead.
- **Display lines broken inside a word or run off the slide** (Hustle's cover). OPF never breaks a word (LH-173) and never draws outside the slide.
- **Monospace body copy at small sizes** (Cyber Stark's 2.8% bodies). Fine as a theme personality, but OPF's measure rule then limits how much fits. Keep it to display and label roles in the Mono theme.
- **Hand-drawn strokes, petal and starburst motifs.** These are theme artwork. OPF's checklist (LH-37) rejects decoration that carries no meaning. If OPF ever adds motifs, they must be its own, sit only in empty areas, and never be required by a layout.
- **Centered statements and facts of the older scheme** (Purple Tropics). This is not a new idea, and OPF already centers.

## Appendix A: measurements of the 15 fully analyzed themes

How to read the tables:

- Boxes are x, y, width, height as fractions of 1920 × 1080; a negative y means the box starts above the slide.
- Sizes are percentages of the slide height.
- Type gives the family, weight (300 light, 400 regular, 500 medium, 600 semibold, 700 bold, 800 heavy; "i" for italic), caps and tracking where set, and the text color.
- Align is horizontal / vertical anchor.
- Footers ("Presentation Title", "Date") are omitted: they are 1.9% text at y = 0.904 to 0.914 in every theme that has them.
- A "×N" counts repeated equal boxes.
- "Color block", "rounded block" and "drawn shape" are decorative filled shapes, with their fill.

### Purple Tropics (41)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #2F0A87 | color block #FFFFFF | 0.039, 0.612, 0.922, 0.305 |  |  |  |  |
|  |  | Presentation Title | 0.057, 0.748, 0.885, 0.139 | DomaineDisplay 700 #000000 | 8.9 | center/top | 1.0 |
|  |  | Presentation Subtitle | 0.057, 0.643, 0.885, 0.079 | Graphik 400 caps tr+0.12 #000000 | 3.7 | center/bottom | 1.0 |
| Section | #5E18A4 | Section Title | 0.049, 0.331, 0.901, 0.240 | DomaineDisplay 700 #FFFFFF | 10.2 | center/bottom | 1.0 |
| Title & Bullets | #2F0A87 | Slide Subtitle | 0.049, 0.178, 0.901, 0.069 | Graphik 500 tr-0.02 #FFFFFF | 4.2 | start/top | 1.0 |
|  |  | Slide Title | 0.049, 0.069, 0.901, 0.116 | DomaineDisplay 700 #FFFFFF | 8.1 | start/top | 0.9 |
|  |  | Slide bullet text | 0.049, 0.310, 0.901, 0.602 | Graphik 400 tr-0.04 #FFFFFF | 4.3 | start/top | 0.9 |
| Statement | #5E18A4 | Statement | 0.049, 0.359, 0.901, 0.282 | DomaineDisplay 700 #FFFFFF | 10.2 | center/middle | 1.0 |
| Quote | #5E18A4 | color block #91DDF2 | 0.049, 0.088, 0.901, 0.824 |  |  |  |  |
|  |  | – Attribution | 0.298, 0.771, 0.404, 0.067 | DomaineDisplay 500 #FFFFFF | 4.5 | start/top | 0.9 |
|  |  | “Notable Quote” | 0.270, 0.312, 0.460, 0.330 | DomaineDisplay 700 #FFFFFF | 8.4 | start/middle | 0.9 |
| Big Fact | #5E18A4 | Fact information | 0.049, 0.573, 0.901, 0.088 | Graphik 500 tr-0.02 #FFFFFF | 5.2 | center/top | 1.0 |
|  |  | 100% | 0.049, 0.069, 0.901, 0.537 | DomaineDisplay 700 tr-0.03 #FFFFFF | 23.1 | center/bottom | 0.8 |
| Agenda | #5E18A4 | Agenda Subtitle | 0.049, 0.178, 0.901, 0.069 | Graphik 500 tr-0.02 #FFFFFF | 4.2 | start/top | 1.0 |
|  |  | Agenda Topics | 0.049, 0.310, 0.901, 0.602 | Graphik 400 tr-0.04 #FFFFFF | 5.4 | start/top | 0.9 |
|  |  | Agenda Title | 0.049, 0.069, 0.901, 0.116 | DomaineDisplay 700 #FFFFFF | 8.1 | start/top | 0.9 |

### Community Colorful (42)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #FFFFFF | color block #FFCA1D | 0.037, 0.066, 0.925, 0.868 |  |  |  |  |
|  |  | Presentation Title | 0.060, 0.112, 0.881, 0.098 | Produkt 500 tr-0.01 #000000 | 6.9 | start/top | 1.0 |
|  |  | Presentation Subtitle | 0.059, 0.200, 0.881, 0.098 | Produkt 300 #000000 | 5.0 | start/top | 1.0 |
| Title & Image | #FFFFFF | color block #0DAFFF | 0.037, 0.066, 0.458, 0.868 |  |  |  |  |
|  |  | Presentation Title | 0.060, 0.112, 0.413, 0.098 | Produkt 500 tr-0.01 #000000 | 6.9 | start/top | 1.0 |
|  |  | Presentation Subtitle | 0.059, 0.200, 0.413, 0.098 | Produkt 300 #000000 | 5.0 | start/top | 1.0 |
|  |  | picture | 0.505, 0.066, 0.458, 0.868 |  |  |  |  |
| Section | #FFFFFF | drawn shape #FF75CF | 0.038, 0.066, 0.924, 0.869 |  |  |  |  |
|  |  | color block #FFCA1D | 0.039, 0.582, 0.457, 0.353 |  |  |  |  |
|  |  | Section Title | 0.060, 0.112, 0.871, 0.098 | Produkt 500 tr-0.01 #000000 | 6.9 | start/top | 1.0 |
| Title & Text | #FFFFFF | Slide Subtitle | 0.035, 0.127, 0.929, 0.098 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |
|  |  | Body text | 0.035, 0.345, 0.929, 0.465 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.052, 0.929, 0.098 | Produkt 500 #000000 | 6.9 | start/top | 1.0 |
| Title & Bullets | #FFFFFF | Slide Subtitle | 0.035, 0.127, 0.929, 0.098 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.052, 0.929, 0.098 | Produkt 500 #000000 | 6.9 | start/top | 1.0 |
|  |  | Slide bullet text | 0.035, 0.270, 0.929, 0.557 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |
| Title, Text & Image | #FFFFFF | picture (shaped) | 0.272, 0.066, 0.691, 0.867 |  |  |  |  |
|  |  | Slide Subtitle | 0.035, 0.127, 0.439, 0.098 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |
|  |  | Body text | 0.035, 0.352, 0.439, 0.242 | Produkt 300 #000000 | 3.3 | start/top | 1.1 |
|  |  | Slide Title | 0.035, 0.052, 0.439, 0.098 | Produkt 500 #000000 | 6.9 | start/top | 1.0 |
| Quote | #FFFFFF | drawn shape #A681FF | 0.037, 0.435, 0.925, 0.500 |  |  |  |  |
|  |  | color block #0DAFFF | 0.660, 0.068, 0.302, 0.350 |  |  |  |  |
|  |  | “Quote” | 0.019, 0.053, 0.609, 0.493 | Produkt 500 tr-0.01 #000000 | 7.4 | start/top | 1.0 |
|  |  | Attribution | 0.035, 0.535, 0.593, 0.043 | Produkt 500 #000000 | 2.8 | start/top | 1.0 |
| Fact | #FFFFFF | color block #0DAFFF | 0.037, 0.067, 0.536, 0.470 |  |  |  |  |
|  |  | 100% | 0.037, 0.067, 0.536, 0.470 | Produkt 500 #000000 | 27.8 | center/top | 1.0 |
|  |  | Fact information | 0.659, 0.057, 0.280, 0.278 | Produkt 300 #000000 | 3.3 | start/top | 1.1 |
| Image | #FFFFFF | picture | 0.038, 0.067, 0.925, 0.866 |  |  |  |  |
| Multi-Image | #FFFFFF | picture (shaped) | 0.582, 0.067, 0.380, 0.866 |  |  |  |  |
|  |  | picture (shaped) | 0.038, 0.068, 0.535, 0.867 |  |  |  |  |
|  |  | Text | 0.271, 0.508, 0.458, 0.426 | Produkt 500 #000000 | 3.0 | center/middle | 1.0 |
| Contents | #FFFFFF | 00 | 0.894, 0.052, 0.072, 0.378 | Produkt 500 #000000 | 5.6 | end/top | 1.0 |
|  |  | Contents | 0.035, 0.052, 0.382, 0.080 | Produkt 500 #000000 | 5.6 | start/top | 1.0 |
|  |  | Section Title | 0.502, 0.052, 0.382, 0.373 | Produkt 500 #000000 | 5.6 | start/top | 1.0 |
| Agenda | #FFFFFF | Agenda Title | 0.035, 0.052, 0.929, 0.098 | Produkt 500 #000000 | 6.9 | start/top | 1.0 |
|  |  | Agenda Subtitle | 0.035, 0.127, 0.929, 0.098 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |
|  |  | Agenda Topics | 0.035, 0.345, 0.929, 0.465 | Produkt 300 #000000 | 6.9 | start/top | 1.0 |

### Scientific Muted (45)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #C7A252 | Author and Date | 0.260, 0.067, 0.227, 0.041 | Charter 400 #000000 | 2.8 | start/bottom | 1.0 |
|  |  | Presentation Title | 0.032, 0.394, 0.935, 0.591 | Druk 700 #000000 | 27.8 | start/bottom | 0.9 |
|  |  | Presentation Subtitle | 0.034, 0.067, 0.226, 0.041 | Charter 400 #000000 | 2.8 | start/bottom | 1.0 |
| Section | #B6CC9F | Section Title | 0.032, 0.394, 0.936, 0.591 | Druk 700 #000000 | 27.8 | start/bottom | 0.9 |
| Title & Text | #C7A252 | Body text | 0.035, 0.389, 0.304, 0.207 | Charter 400 #000000 | 2.8 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.071, 0.927, 0.193 | Druk 700 #000000 | 18.5 | start/top | 0.9 |
|  |  | Slide Subtitle | 0.035, 0.351, 0.304, 0.041 | Charter 400 #000000 | 2.8 | start/middle | 1.0 |
| Title & Bullets | #929CBA | Slide Title | 0.035, 0.071, 0.927, 0.193 | Druk 700 #000000 | 18.5 | start/top | 0.9 |
|  |  | Slide bullet text | 0.035, 0.349, 0.464, 0.302 | Charter 400 #000000 | 4.6 | start/top | 1.0 |
| Title, Text & Image | #929CBA | Slide Title | 0.035, 0.071, 0.432, 0.193 | Druk 700 #000000 | 18.5 | start/top | 0.9 |
|  |  | Body text | 0.035, 0.389, 0.305, 0.207 | Charter 400 #000000 | 2.8 | start/top | 1.0 |
|  |  | picture | 0.505, -0.000, 0.495, 1.000 |  |  |  |  |
|  |  | Slide Subtitle | 0.035, 0.351, 0.305, 0.041 | Charter 400 #000000 | 2.8 | start/bottom | 1.0 |
| Statement | #BC8896 | Statement | 0.032, 0.394, 0.936, 0.591 | Druk 700 #000000 | 27.8 | start/bottom | 0.9 |
| Quote | #DEDED2 | Attribution | 0.035, 0.069, 0.432, 0.041 | Charter 400 #000000 | 2.8 | start/top | 1.0 |
|  |  | “Quote” | 0.009, 0.171, 0.879, 0.804 | Druk 700 #000000 | 18.5 | start/bottom | 0.9 |
| Fact | #C7A252 | 100% | 0.034, 0.047, 0.610, 0.563 | Druk 700 #000000 | 55.6 | start/bottom | 0.9 |
|  |  | Fact information | 0.660, 0.072, 0.257, 0.179 | Charter 400 #000000 | 2.8 | start/top | 1.0 |
| Image | #929CBA | picture | 0.000, -0.000, 1.000, 1.000 |  |  |  |  |
| Contents | #DEDED2 | 00 | 0.894, 0.062, 0.072, 0.268 | Charter 400 #000000 | 4.6 | end/top | 0.9 |
|  |  | Section Title | 0.502, 0.062, 0.382, 0.268 | Charter 400 #000000 | 4.6 | start/top | 0.9 |
|  |  | Contents | 0.035, 0.062, 0.382, 0.268 | Charter 400 #000000 | 4.6 | start/top | 0.9 |
| Agenda | #B6CC9F | Agenda Topics | 0.035, 0.419, 0.538, 0.340 | Charter 400 #000000 | 4.6 | start/top | 0.9 |
|  |  | Agenda Subtitle | 0.035, 0.255, 0.538, 0.093 | Charter 400 #000000 | 4.6 | start/top | 1.0 |
|  |  | Agenda Title | 0.035, 0.071, 0.927, 0.194 | Druk 700 #000000 | 18.5 | start/top | 0.9 |

### Business Modern (46)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #007FFF | Section Title | 0.033, 0.030, 0.923, 0.138 | FoundersGrotesk 500 tr-0.01 #FFFFFF | 11.2 | start/top | 0.9 |
| Title & Image | #FFF6E0 | picture | -0.000, -0.002, 1.000, 1.003 |  |  |  |  |
|  |  | Presentation Title | 0.033, 0.029, 0.851, 0.144 | FoundersGrotesk 500 tr-0.01 #FFFFFF | 11.2 | start/top | 0.9 |
|  |  | Presentation Subtitle | 0.032, 0.153, 0.598, 0.175 | FoundersGrotesk 300 tr-0.01 #FFFFFF | 11.1 | start/top | 0.9 |
| Title & Text | #FFF6E0 | Slide Title | 0.035, 0.061, 0.131, 0.029 | FoundersGrotesk 500 #007FFF | 1.9 | start/top | 0.8 |
|  |  | Body Text | 0.035, 0.103, 0.131, 0.799 | FoundersGrotesk 400 #000000 | 1.9 | start/top | 1.0 |
|  |  | Body Text | 0.193, 0.053, 0.614, 0.810 | FoundersGrotesk 300 #000000 | 3.2 | start/top | 0.9 |
| Title & Bullets | #FFF6E0 | Body Text | 0.035, 0.103, 0.131, 0.749 | FoundersGrotesk 400 #000000 | 1.9 | start/top | 1.0 |
|  |  | Body Text | 0.193, 0.053, 0.614, 0.810 | FoundersGrotesk 300 #000000 | 5.6 | start/top | 0.9 |
|  |  | Slide Title | 0.035, 0.061, 0.131, 0.029 | FoundersGrotesk 500 #007FFF | 1.9 | start/top | 0.8 |
| Text & Image | #FFF6E0 | picture | 0.505, 0.068, 0.458, 0.792 |  |  |  |  |
|  |  | Body Text | 0.037, 0.053, 0.380, 0.808 | FoundersGrotesk 300 #000000 | 5.6 | start/top | 0.9 |
| Statement | #9C612A | Attribution | 0.037, 0.805, 0.224, 0.056 | FoundersGrotesk 500 #FFF6E0 | 3.2 | start/bottom | 0.8 |
|  |  | “Statement” | 0.028, 0.050, 0.614, 0.735 | FoundersGrotesk 300 #FFF6E0 | 5.6 | start/top | 0.9 |
| Quote | #9C612A | Attribution | 0.037, 0.805, 0.224, 0.056 | FoundersGrotesk 500 #FFF6E0 | 3.2 | start/bottom | 0.8 |
|  |  | “Quote” | 0.011, 0.014, 0.744, 0.810 | FoundersGrotesk 300 #FFF6E0 | 16.2 | start/top | 0.9 |
| Fact | #946435 | Fact Information | 0.037, 0.805, 0.224, 0.056 | FoundersGrotesk 500 #FFF6E0 | 3.2 | start/bottom | 0.8 |
|  |  | 100% | 0.035, 0.000, 0.928, 0.544 | FoundersGrotesk 300 #FFF6E0 | 38.9 | start/top | 0.9 |
| Image | #FFFFFF | picture | 0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Multi-Image | #FFF6E0 | picture | 0.415, 0.065, 0.546, 0.648 |  |  |  |  |
|  |  | picture | 0.763, 0.511, 0.199, 0.348 |  |  |  |  |
|  |  | picture | 0.036, 0.420, 0.430, 0.441 |  |  |  |  |
| Contents | #FFF6E0 | Section Title | 0.036, 0.041, 0.304, 0.476 | FoundersGrotesk 500 #007FFF | 6.9 | start/top | 0.9 |
|  |  | Contents | 0.351, 0.041, 0.527, 0.476 | FoundersGrotesk 300 #000000 | 6.9 | start/top | 0.9 |
|  |  | 00 | 0.876, 0.042, 0.090, 0.476 | FoundersGrotesk 300 #000000 | 6.9 | end/top | 0.9 |

### Luxury Elegant (48)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #8C4414 | Presentation Title | 0.055, 0.014, 0.918, 0.470 | Canela 400 tr-0.01 #FFFFFF | 11.1 | start/top | 0.8 |
| Title & Image | #8C4414 | picture | 0.504, 0.000, 0.496, 1.000 |  |  |  |  |
|  |  | Presentation Title | 0.055, 0.014, 0.362, 0.443 | Canela 400 tr-0.01 #FFFFFF | 11.1 | start/top | 0.8 |
| Section | #4C220A | Section Title | 0.055, 0.014, 0.912, 0.308 | Canela 400 tr-0.01 #FFFFFF | 11.1 | start/top | 0.8 |
| Title & Text | #FFF6E0 | Slide Title | 0.058, 0.039, 0.126, 0.810 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
|  |  | Body text | 0.193, 0.043, 0.748, 0.810 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
| Title & Bullets | #FFF6E0 | Slide Title | 0.058, 0.039, 0.126, 0.810 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
|  |  | Body text | 0.193, 0.043, 0.748, 0.810 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
| Text & Image | #FFF6E0 | picture | 0.505, -0.001, 0.496, 1.002 |  |  |  |  |
|  |  | Body text | 0.061, 0.043, 0.419, 0.808 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
| Title, Text & Image | #FFF6E0 | picture | -0.000, -0.001, 0.496, 1.002 |  |  |  |  |
|  |  | 1 | 0.814, 0.039, 0.125, 0.091 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
|  |  | Slide Title | 0.555, 0.039, 0.126, 0.810 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
|  |  | Body text ×4 | 0.814, 0.128, 0.146, 0.146 | Canela 400 #834821 | 1.9 | start/top | 0.9 |
|  |  | 2 | 0.814, 0.265, 0.125, 0.091 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
|  |  | 3 | 0.814, 0.491, 0.125, 0.091 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
|  |  | 4 | 0.814, 0.717, 0.125, 0.091 | Canela 400 #8C4414 | 5.6 | start/top | 0.8 |
| Statement | #FFBE92 | Statement | 0.048, 0.044, 0.614, 0.730 | Canela 400 #000000 | 5.6 | start/top | 0.8 |
|  |  | Attribution | 0.058, 0.822, 0.125, 0.035 | CanelaText 400 caps tr+0.10 #000000 | 1.9 | start/bottom | 0.8 |
| Quote | #FFBE92 | “Quote” | 0.062, -0.000, 0.661, 0.810 | Canela 400 #000000 | 16.2 | start/top | 0.8 |
|  |  | Attribution | 0.739, 0.068, 0.224, 0.056 | CanelaText 400 caps tr+0.10 #000000 | 1.9 | start/top | 0.8 |
| Fact | #FFBE92 | 100% | 0.059, -0.002, 0.882, 0.810 | Canela 400 #000000 | 37.0 | start/top | 0.8 |
|  |  | Fact Information | 0.058, 0.805, 0.224, 0.056 | CanelaText 400 caps tr+0.10 #000000 | 1.9 | start/bottom | 0.8 |
| Image | #FFF6E0 | picture | -0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Contents | #FFF6E0 | 00 | 0.867, 0.033, 0.098, 0.451 | Canela 400 #8C4414 | 6.9 | end/top | 0.8 |
|  |  | Section Title | 0.351, 0.033, 0.507, 0.451 | Canela 400 #8C4414 | 6.9 | start/top | 0.8 |
|  |  | Contents | 0.059, 0.033, 0.282, 0.451 | Canela 400 #8C4414 | 6.9 | start/top | 0.8 |

### Cyber Stark (50)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #000000 | picture | 0.350, -0.000, 0.650, 1.000 |  |  |  |  |
|  |  | Presentation Title | 0.035, 0.053, 0.279, 0.148 | Courier New 400 tr+0.01 #FFFFFF | 5.6 | start/top | 0.9 |
|  |  | Presentation Subtitle | 0.035, 0.193, 0.279, 0.147 | Courier New 400 tr+0.01 #FFFFFF | 5.6 | start/top | 0.9 |
| Section | #FFFFFF | picture | 0.350, -0.000, 0.650, 1.000 |  |  |  |  |
|  |  | Section Title | 0.034, 0.054, 0.281, 0.231 | Courier New 400 #000000 | 4.6 | start/top | 1.0 |
| Title & Text | #000000 | Slide Subtitle | 0.034, 0.110, 0.928, 0.064 | Courier New 400 #FFFFFF | 4.6 | start/middle | 1.0 |
|  |  | Slide Title | 0.035, 0.054, 0.928, 0.058 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.0 |
|  |  | Body Text | 0.034, 0.346, 0.928, 0.556 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.1 |
| Title & Bullets | #000000 | Slide Subtitle | 0.034, 0.110, 0.928, 0.064 | Courier New 400 #FFFFFF | 4.6 | start/middle | 1.0 |
|  |  | Slide Title | 0.035, 0.054, 0.928, 0.058 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.0 |
|  |  | List item | 0.034, 0.346, 0.928, 0.556 | Courier New 400 #FF7800 | 4.6 | start/top | 1.1 |
| Title, Text & Image | #000000 | Slide Subtitle | 0.034, 0.110, 0.436, 0.064 | Courier New 400 #FFFFFF | 4.6 | start/middle | 1.0 |
|  |  | picture | 0.505, -0.000, 0.495, 1.000 |  |  |  |  |
|  |  | Slide Title | 0.035, 0.054, 0.436, 0.058 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.0 |
|  |  | Body Text | 0.034, 0.352, 0.436, 0.463 | Courier New 400 #FFFFFF | 2.8 | start/top | 1.1 |
| Quote | #000000 | Attribution | 0.036, 0.705, 0.719, 0.093 | Courier New 400 #FFFFFF | 2.8 | start/bottom | 1.0 |
|  |  | “Notable Quote” | 0.009, 0.047, 0.773, 0.591 | Courier New 400 #E7E317 | 7.4 | start/top | 0.9 |
| Fact | #000000 | 100% | 0.025, 0.005, 0.482, 0.486 | Courier New 400 #FFFFFF | 27.8 | start/top | 1.0 |
|  |  | Body Text | 0.658, 0.058, 0.304, 0.381 | Courier New 400 #FFFFFF | 2.8 | start/top | 1.1 |
| Image | #000000 | picture | 0.000, -0.000, 1.000, 1.000 |  |  |  |  |
| Multi-Image | #000000 | picture | 0.000, -0.000, 0.495, 1.000 |  |  |  |  |
|  |  | picture | 0.583, 0.361, 0.380, 0.500 |  |  |  |  |
| Contents | #000000 | 00 | 0.894, 0.053, 0.072, 0.370 | Courier New 400 #FFFFFF | 4.6 | end/top | 1.0 |
|  |  | Contents | 0.034, 0.053, 0.391, 0.370 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.0 |
|  |  | Section Title | 0.502, 0.053, 0.391, 0.370 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.0 |
| Agenda | #000000 | Agenda Subtitle | 0.034, 0.110, 0.928, 0.064 | Courier New 400 #FFFFFF | 4.6 | start/middle | 1.0 |
|  |  | Agenda Title | 0.035, 0.054, 0.928, 0.058 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.0 |
|  |  | Agenda Topics | 0.034, 0.346, 0.928, 0.556 | Courier New 400 #FFFFFF | 4.6 | start/top | 1.1 |

### Educator Playful (53)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #FFFFFF | Presentation Title | 0.035, 0.043, 0.929, 0.173 | FoundersGrotesk 600 #1E38C0 | 6.9 | start/top | 0.9 |
|  |  | Presentation Subtitle | 0.035, 0.208, 0.929, 0.173 | FoundersGrotesk 600 #000000 | 6.9 | start/top | 0.9 |
|  |  | drawn shape #1E38C0 | 0.036, 0.387, 0.202, 0.065 |  |  |  |  |
| Title & Image | #FFFFFF | Presentation Title | 0.035, 0.043, 0.429, 0.173 | FoundersGrotesk 600 #1E38C0 | 6.9 | start/top | 0.9 |
|  |  | picture | 0.500, -0.000, 0.500, 1.000 |  |  |  |  |
|  |  | Presentation Subtitle | 0.035, 0.208, 0.429, 0.173 | FoundersGrotesk 600 #000000 | 6.9 | start/top | 0.9 |
|  |  | drawn shape #1E38C0 | 0.036, 0.387, 0.202, 0.065 |  |  |  |  |
| Section | #FFFFFF | drawn shape #00882A | 0.000, 0.000, 0.339, 0.538 |  |  |  |  |
|  |  | Section Title | 0.035, 0.042, 0.615, 0.090 | FoundersGrotesk 600 tr-0.01 #000000 | 6.9 | start/top | 1.0 |
| Title & Text | #FFFFFF | Slide Subtitle | 0.035, 0.108, 0.929, 0.068 | FoundersGrotesk 400 #000000 | 5.1 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.047, 0.929, 0.068 | FoundersGrotesk 600 #000000 | 5.1 | start/top | 1.0 |
|  |  | Body text | 0.035, 0.341, 0.472, 0.518 | FoundersGrotesk 400 #000000 | 5.1 | start/top | 1.0 |
| Title & Bullets | #FFFFFF | Slide Subtitle | 0.035, 0.108, 0.929, 0.068 | FoundersGrotesk 400 #000000 | 5.1 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.047, 0.929, 0.068 | FoundersGrotesk 600 #000000 | 5.1 | start/top | 1.0 |
|  |  | Body text | 0.035, 0.341, 0.472, 0.517 | FoundersGrotesk 400 #000000 | 5.1 | start/top | 1.0 |
| Title, Text & Image | #FFFFFF | Slide Subtitle | 0.035, 0.108, 0.420, 0.068 | FoundersGrotesk 400 #000000 | 5.1 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.047, 0.420, 0.068 | FoundersGrotesk 600 #000000 | 5.1 | start/top | 1.0 |
|  |  | Body text | 0.035, 0.347, 0.304, 0.508 | FoundersGroteskText 400 #000000 | 2.8 | start/top | 1.0 |
|  |  | picture | 0.506, -0.000, 0.495, 1.000 |  |  |  |  |
| Statement | #FFFFFF | Statement | 0.030, 0.069, 0.933, 0.830 | FoundersGrotesk 600 tr-0.02 #000000 | 20.7 | start/top | 0.8 |
|  |  | drawn shape #00882A | 0.683, 0.412, 0.107, 0.341 |  |  |  |  |
|  |  | drawn shape #E21D24 | 0.706, 0.549, 0.111, 0.213 |  |  |  |  |
| Quote | #FFFFFF | “Quote” | 0.006, 0.031, 0.772, 0.824 | FoundersGrotesk 600 tr-0.01 #000000 | 10.0 | start/top | 0.9 |
|  |  | drawn shape #7628FF | 0.178, 0.609, 0.185, 0.072 |  |  |  |  |
|  |  | Attribution | 0.814, 0.054, 0.146, 0.166 | FoundersGroteskText 700 #000000 | 2.8 | start/top | 1.0 |
| Fact | #FFFFFF | Fact | 0.029, 0.121, 0.592, 0.741 | FoundersGrotesk 700 tr-0.02 #3B8638 | 50.9 | start/top | 1.0 |
|  |  | drawn shape #6F461E | 0.067, 0.671, 0.389, 0.091 |  |  |  |  |
|  |  | drawn shape #1E38C0 | 0.092, 0.026, 0.129, 0.253 |  |  |  |  |
|  |  | Fact Information | 0.657, 0.278, 0.308, 0.584 | FoundersGroteskText 400 #000000 | 2.8 | start/top | 1.0 |
| Image | #FFFFFF | picture | 0.000, -0.000, 1.000, 1.000 |  |  |  |  |
|  |  | drawn shape #00882A | -0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Multi-Image | #FFFFFF | picture | 0.000, -0.000, 0.500, 1.000 |  |  |  |  |
|  |  | picture | 0.583, 0.068, 0.379, 0.424 |  |  |  |  |
|  |  | drawn shape #7628FF | 0.860, 0.530, 0.038, 0.181 |  |  |  |  |
|  |  | drawn shape #7628FF | 0.729, 0.526, 0.121, 0.259 |  |  |  |  |
|  |  | drawn shape #7628FF | 0.572, 0.555, 0.212, 0.096 |  |  |  |  |
| Contents | #FFFFFF | 00 | 0.894, 0.048, 0.072, 0.811 | FoundersGrotesk 600 #000000 | 5.1 | end/top | 1.0 |
|  |  | drawn shape #F13D8F | 0.051, 0.134, 0.129, 0.096 |  |  |  |  |
|  |  | Contents | 0.035, 0.048, 0.382, 0.068 | FoundersGrotesk 600 #000000 | 5.1 | start/top | 1.0 |
|  |  | Section Title | 0.581, 0.048, 0.303, 0.811 | FoundersGrotesk 600 #000000 | 5.1 | start/top | 1.0 |

### Standard Minimalist (54)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #FFFFFF | Presentation Title | 0.033, 0.031, 0.929, 0.141 | FoundersGrotesk 600 tr-0.01 #1C1C1C | 10.0 | start/top | 0.9 |
|  |  | Presentation Subtitle | 0.033, 0.139, 0.930, 0.297 | FoundersGrotesk 400 tr-0.01 #1C1C1C | 10.0 | start/top | 1.0 |
| Title & Image | #FFFFFF | picture (rounded) | 0.014, 0.023, 0.972, 0.955 |  |  |  |  |
|  |  | Presentation Title | 0.033, 0.031, 0.929, 0.141 | FoundersGrotesk 600 tr-0.01 #FFFFFF | 10.0 | start/top | 0.9 |
|  |  | Presentation Subtitle | 0.033, 0.139, 0.930, 0.296 | FoundersGrotesk 400 tr-0.01 #FFFFFF | 10.0 | start/top | 1.0 |
| Section | #FFFFFF | Section Title | 0.033, 0.031, 0.929, 0.141 | FoundersGrotesk 600 tr-0.01 #1C1C1C | 10.0 | start/top | 0.9 |
|  |  | Section Subtitle | 0.033, 0.139, 0.930, 0.252 | FoundersGrotesk 400 tr-0.01 #1C1C1C | 10.0 | start/top | 1.0 |
| Title & Text | #FFFFFF | Slide Title | 0.035, 0.045, 0.141, 0.362 | FoundersGrotesk 600 #1C1C1C | 5.6 | start/top | 0.9 |
|  |  | Body text | 0.190, 0.043, 0.617, 0.810 | FoundersGroteskText 400 #1C1C1C | 5.6 | start/top | 1.0 |
| Title & Bullets | #FFFFFF | Slide bullet text | 0.190, 0.043, 0.617, 0.810 | FoundersGroteskText 400 #1C1C1C | 5.6 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.045, 0.141, 0.362 | FoundersGrotesk 600 #1C1C1C | 5.6 | start/top | 0.9 |
| Text & Image | #FFFFFF | picture (rounded) | 0.504, 0.068, 0.459, 0.792 |  |  |  |  |
|  |  | Body text | 0.034, 0.043, 0.382, 0.759 | FoundersGroteskText 400 #1C1C1C | 5.6 | start/top | 1.0 |
| Title, Text & Image | #FFFFFF | picture (rounded) | 0.505, 0.068, 0.458, 0.792 |  |  |  |  |
|  |  | rounded block #C1C1C1@0.30 ×3 | 0.037, 0.581, 0.146, 0.279 |  |  |  |  |
|  |  | Body text ×3 | 0.204, 0.673, 0.125, 0.171 | FoundersGroteskText 400 #1C1C1C | 1.9 | start/top | 1.0 |
|  |  | 2 | 0.204, 0.601, 0.125, 0.078 | FoundersGrotesk 400 #212121 | 5.6 | start/top | 0.7 |
|  |  | 1 | 0.048, 0.601, 0.125, 0.078 | FoundersGrotesk 400 #212121 | 5.6 | start/top | 0.7 |
|  |  | 3 | 0.360, 0.601, 0.125, 0.078 | FoundersGrotesk 400 #212121 | 5.6 | start/top | 0.7 |
|  |  | Slide Title | 0.035, 0.045, 0.304, 0.213 | FoundersGrotesk 600 #1C1C1C | 5.6 | start/top | 0.9 |
| Quote | #FFFFFF | “Quote” | 0.001, 0.010, 0.651, 0.810 | FoundersGrotesk 400 #1C1C1C | 16.2 | start/top | 0.8 |
|  |  | Attribution | 0.737, 0.056, 0.225, 0.153 | FoundersGroteskText 400 #1C1C1C | 2.6 | start/top | 1.0 |
| Fact | #FFFFFF | Fact Information | 0.035, 0.788, 0.599, 0.081 | FoundersGroteskText 400 #1C1C1C | 2.6 | start/bottom | 1.0 |
|  |  | 100% | 0.034, -0.056, 0.695, 0.481 | FoundersGrotesk 400 #1C1C1C | 37.0 | start/middle | 0.8 |
| Image | #FFFFFF | Date | 0.193, 0.912, 0.146, 0.030 | FoundersGroteskText 400 #1C1C1C | 1.9 | start/bottom | 1.0 |
|  |  | Presentation Title | 0.037, 0.912, 0.146, 0.030 | FoundersGroteskText 400 #1C1C1C | 1.9 | start/bottom | 1.0 |
|  |  | picture (rounded) | 0.014, 0.023, 0.974, 0.955 |  |  |  |  |
|  |  | rounded block #CFCDCC | 0.024, 0.042, 0.951, 0.043 |  |  |  |  |
|  |  | Caption | 0.029, 0.042, 0.942, 0.042 | FoundersGroteskText 700 tr+0.02 #212121 | 2.0 | start/middle | 0.9 |
| Multi-Image | #FFFFFF | Date | 0.193, 0.912, 0.146, 0.030 | FoundersGroteskText 400 #1C1C1C | 1.9 | start/bottom | 1.0 |
|  |  | Presentation Title | 0.037, 0.912, 0.146, 0.030 | FoundersGroteskText 400 #1C1C1C | 1.9 | start/bottom | 1.0 |
|  |  | picture (rounded) | 0.014, 0.023, 0.635, 0.955 |  |  |  |  |
|  |  | picture (rounded) | 0.663, 0.023, 0.324, 0.465 |  |  |  |  |
|  |  | rounded block #CFCDCC | 0.024, 0.042, 0.614, 0.043 |  |  |  |  |
|  |  | Caption | 0.029, 0.042, 0.605, 0.042 | FoundersGroteskText 700 tr+0.02 #212121 | 2.0 | start/middle | 0.9 |
|  |  | rounded block #CFCDCC ×2 | 0.673, 0.042, 0.303, 0.043 |  |  |  |  |
|  |  | Caption ×2 | 0.678, 0.042, 0.294, 0.042 | FoundersGroteskText 700 tr+0.02 #212121 | 2.0 | start/middle | 0.9 |
| Contents | #FFFFFF | 00 | 0.890, 0.042, 0.076, 0.490 | FoundersGrotesk 400 #1C1C1C | 6.9 | end/top | 0.9 |
|  |  | Section Title | 0.035, 0.042, 0.382, 0.490 | FoundersGrotesk 600 #1C1C1C | 6.9 | start/top | 0.9 |
|  |  | Section Subtitle | 0.422, 0.042, 0.459, 0.490 | FoundersGrotesk 400 #1C1C1C | 6.9 | start/top | 0.9 |

### Meadow Pastel (57)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #DBECB0 | picture | 0.021, 0.036, 0.958, 0.928 |  |  |  |  |
|  |  | color block #DBECB0 | 0.038, 0.066, 0.865, 0.323 |  |  |  |  |
|  |  | picture | 0.537, 0.419, 0.403, 0.472 |  |  |  |  |
|  |  | color block #DBECB0 | 0.047, 0.758, 0.126, 0.154 |  |  |  |  |
|  |  | Presentation Subtitle | 0.055, 0.217, 0.869, 0.161 | Graphik 400 tr-0.01 #000000 | 10.1 | start/top | 0.9 |
|  |  | Presentation Title | 0.055, 0.073, 0.869, 0.161 | Graphik 600 tr-0.01 #000000 | 10.1 | start/top | 0.9 |
| Section | #E5DFD0 | picture | 0.021, 0.036, 0.958, 0.928 |  |  |  |  |
|  |  | color block #E5DFD0 | 0.043, 0.080, 0.870, 0.334 |  |  |  |  |
|  |  | Section Subtitle | 0.053, 0.217, 0.870, 0.161 | Graphik 400 tr-0.01 #000000 | 10.1 | start/top | 0.9 |
|  |  | Section Title | 0.053, 0.073, 0.870, 0.161 | Graphik 600 tr-0.01 #000000 | 10.1 | start/top | 0.9 |
| Title & Text | #FBF7EF | Body text | 0.035, 0.122, 0.131, 0.750 | Courier New 400 #000000 | 2.0 | start/top | 1.1 |
|  |  | Body text | 0.191, 0.053, 0.614, 0.819 | Graphik 600 #000000 | 5.6 | start/top | 1.4 |
|  |  | Slide Title | 0.035, 0.061, 0.131, 0.052 | Graphik 600 #000000 | 3.3 | start/top | 0.8 |
| Title & Bullets | #FBF7EF | Body text | 0.035, 0.122, 0.131, 0.750 | Courier New 400 #000000 | 2.0 | start/top | 1.1 |
|  |  | Slide bullet text | 0.191, 0.053, 0.692, 0.819 | Graphik 600 #000000 | 5.6 | start/top | 1.4 |
|  |  | Slide Title | 0.035, 0.061, 0.131, 0.052 | Graphik 600 #000000 | 3.3 | start/top | 0.8 |
| Text & Image | #FBF7EF | picture | 0.505, 0.066, 0.458, 0.789 |  |  |  |  |
|  |  | Body text | 0.035, 0.054, 0.380, 0.808 | Graphik 600 #000000 | 5.6 | start/top | 1.4 |
| Statement | #E5DFD0 | Fact Information | 0.035, 0.746, 0.693, 0.102 | Graphik 600 #000000 | 3.3 | start/bottom | 0.8 |
|  |  | Statement | 0.031, 0.016, 0.693, 0.718 | Graphik 600 #000000 | 14.5 | start/top | 0.9 |
| Quote | #E5DFD0 | Attribution | 0.035, 0.746, 0.613, 0.103 | Graphik 600 #000000 | 3.3 | start/bottom | 0.8 |
|  |  | “Quote” | 0.020, 0.052, 0.629, 0.683 | Graphik 600 #000000 | 5.6 | start/top | 1.4 |
| Fact | #E5DFD0 | Fact Information | 0.035, 0.746, 0.684, 0.103 | Graphik 600 #000000 | 3.3 | start/bottom | 0.8 |
|  |  | 100% | 0.030, -0.070, 0.690, 0.748 | Graphik 600 #000000 | 37.0 | start/top | 1.0 |
| Image | #FFFFFF | picture | 0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Contents | #FBF7EF | 00 | 0.875, 0.051, 0.090, 0.437 | Graphik 400 #000000 | 6.9 | end/top | 0.9 |
|  |  | Section Title | 0.036, 0.051, 0.344, 0.437 | Graphik 600 #000000 | 6.9 | start/top | 0.9 |
|  |  | Section Subtitle | 0.392, 0.051, 0.471, 0.437 | Graphik 400 #000000 | 6.9 | start/top | 0.9 |

### Photography Bold (59)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #03B307 | picture | 0.629, 0.268, 0.335, 0.593 |  |  |  |  |
|  |  | picture | 0.172, 0.514, 0.196, 0.348 |  |  |  |  |
|  |  | picture | 0.367, 0.396, 0.261, 0.465 |  |  |  |  |
|  |  | picture | 0.037, 0.623, 0.134, 0.239 |  |  |  |  |
|  |  | Presentation Title | 0.033, 0.037, 0.930, 0.135 | AvenirNext 600 tr-0.01 #000000 | 10.1 | start/top | 1.0 |
|  |  | Presentation Subtitle | 0.031, 0.158, 0.583, 0.145 | AvenirNext 400i tr-0.01 #000000 | 10.1 | start/top | 1.0 |
| Section | #FFFFFF | Section Title | 0.033, 0.037, 0.934, 0.145 | AvenirNext 600 tr-0.01 #000000 | 10.1 | start/top | 1.0 |
|  |  | Section Subtitle | 0.032, 0.153, 0.936, 0.145 | AvenirNext 400i tr-0.01 #000000 | 10.1 | start/top | 1.0 |
| Title & Text | #FFFFFF | Body Text | 0.035, 0.110, 0.131, 0.763 | AvenirNext 600 #000000 | 1.9 | start/top | 1.1 |
|  |  | Slide Title | 0.035, 0.061, 0.131, 0.032 | AvenirNext 600 #000000 | 1.9 | start/top | 1.0 |
|  |  | Body Text | 0.189, 0.049, 0.614, 0.810 | AvenirNext 600 #000000 | 5.6 | start/top | 0.9 |
| Title & Bullets | #FFFFFF | Body Text | 0.035, 0.110, 0.131, 0.763 | AvenirNext 600 #000000 | 3.1 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.061, 0.131, 0.032 | AvenirNext 600 #000000 | 1.9 | start/top | 1.0 |
|  |  | Body Text | 0.191, 0.050, 0.692, 0.810 | AvenirNext 600 #000000 | 5.6 | start/top | 0.9 |
| Text & Image | #FFFFFF | picture | 0.505, 0.069, 0.458, 0.792 |  |  |  |  |
|  |  | Body Text | 0.036, 0.050, 0.380, 0.808 | AvenirNext 600 #000000 | 5.6 | start/top | 0.9 |
| Statement | #9F8DF8 | Statement | 0.028, 0.023, 0.782, 0.767 | AvenirNext 600 #000000 | 16.2 | start/top | 0.8 |
|  |  | Attribution | 0.035, 0.771, 0.458, 0.100 | AvenirNext 600 #000000 | 2.6 | start/bottom | 1.0 |
| Quote | #A4D2F8 | “Quote” | 0.018, 0.050, 0.614, 0.733 | AvenirNext 600 #000000 | 5.6 | start/top | 0.9 |
|  |  | Attribution | 0.035, 0.771, 0.458, 0.100 | AvenirNext 600 #000000 | 2.6 | start/bottom | 1.0 |
| Fact | #50B034 | Fact Information | 0.035, 0.771, 0.458, 0.100 | AvenirNext 600 #000000 | 2.6 | start/bottom | 1.0 |
|  |  | 100% | 0.021, 0.030, 0.945, 0.737 | AvenirNext 600 #000000 | 37.0 | start/top | 1.0 |
| Image | #FFFFFF | picture | 0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Contents | #FFFFFF | 00 | 0.831, 0.048, 0.135, 0.786 | AvenirNext 400i #000000 | 6.9 | end/top | 1.0 |
|  |  | Section Title | 0.034, 0.048, 0.301, 0.786 | AvenirNext 600 tr-0.01 #000000 | 6.9 | start/top | 1.0 |
|  |  | Contents | 0.345, 0.048, 0.499, 0.786 | AvenirNext 400i #000000 | 6.9 | start/top | 1.0 |

### Academic Modern (60)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #0F2335 | color block #DCD8BD | 0.967, -0.000, 0.015, 1.000 |  |  |  |  |
|  |  | Presentation Title | 0.034, 0.022, 0.901, 0.222 | DomaineDisplay 400 tr-0.01 #DCD8BD | 16.7 | start/bottom | 0.8 |
| Title & Text | #DCD8BD | Body text | 0.038, 0.287, 0.457, 0.573 | FoundersGrotesk 400 #0F2335 | 5.6 | start/top | 0.9 |
|  |  | Slide Title | 0.037, 0.062, 0.924, 0.073 | DomaineDisplay 400 #0F2335 | 5.6 | start/top | 1.1 |
| Title & Bullets | #710A00 | Body text | 0.037, 0.286, 0.455, 0.577 | FoundersGrotesk 400 #DCD8BD | 5.6 | start/top | 0.9 |
|  |  | Slide Title | 0.037, 0.062, 0.924, 0.073 | DomaineDisplay 400 #DCD8BD | 5.6 | start/top | 1.1 |
| Title, Text & Image | #DCD8BD | picture | 0.505, 0.000, 0.496, 0.999 |  |  |  |  |
|  |  | Body text | 0.038, 0.287, 0.457, 0.573 | FoundersGrotesk 400 #0F2335 | 5.6 | start/top | 0.9 |
|  |  | Slide Title | 0.037, 0.062, 0.457, 0.073 | DomaineDisplay 400 #0F2335 | 5.6 | start/top | 1.1 |
| Statement | #0F2335 | Statement | 0.033, 0.025, 0.696, 0.834 | DomaineDisplay 400 #DCD8BD | 11.6 | start/top | 0.9 |
| Quote | #0F2335 | “Quote” | 0.034, 0.011, 0.627, 0.721 | DomaineDisplay 400 #DCD8BD | 16.2 | start/top | 0.8 |
|  |  | Attribution | 0.037, 0.813, 0.224, 0.056 | FoundersGrotesk 400 #DCD8BD | 2.8 | start/bottom | 1.0 |
| Fact | #CC8B00 | rule #132234 | -0.021, -0.048, 0.974, 0.896 |  |  |  |  |
|  |  | rule #132234 | -0.008, -0.027, 0.942, 0.840 |  |  |  |  |
|  |  | 100% | 0.026, 0.012, 0.770, 0.602 | DomaineDisplay 400 #0F2335 | 46.3 | start/top | 1.1 |
|  |  | Fact Information | 0.037, 0.666, 0.299, 0.056 | FoundersGrotesk 400 #142333 | 2.8 | start/bottom | 1.0 |
| Image | #FFFFFF | picture | 0.000, 0.000, 1.000, 1.000 |  |  |  |  |
|  |  | rule #DCD8BD | 0.039, 0.066, 0.927, 0.868 |  |  |  |  |
|  |  | rule #DCD8BD | 0.059, 0.100, 0.887, 0.800 |  |  |  |  |
| Contents | #402D00 | 00 | 0.816, 0.061, 0.150, 0.432 | DomaineDisplay 400 #DCD8BD | 5.6 | end/top | 1.1 |
|  |  | Contents | 0.037, 0.061, 0.383, 0.080 | DomaineDisplay 400 #DCD8BD | 5.6 | start/top | 1.1 |
|  |  | Section Title | 0.502, 0.061, 0.314, 0.432 | DomaineDisplay 400 #DCD8BD | 5.6 | start/top | 1.1 |

### Fitness Dark (68)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #212B33 | Presentation Title | 0.032, 0.293, 0.936, 0.383 | FoundersGroteskCond 600 #FFFFFF | 14.8 | start/middle | 0.8 |
| Title & Image | #32433F | picture | 0.500, -0.000, 0.500, 1.000 |  |  |  |  |
|  |  | Presentation Title | 0.032, 0.293, 0.433, 0.383 | FoundersGroteskCond 600 #FFFFFF | 14.8 | start/middle | 0.8 |
| Section | #5E5534 | picture | 0.427, 0.000, 0.573, 1.000 |  |  |  |  |
|  |  | Section Title | 0.035, 0.363, 0.359, 0.257 | FoundersGroteskCond 600 tr-0.01 #FFFFFF | 13.0 | start/middle | 1.0 |
| Title & Text | #4A5C55 | Heading Title ×6 | 0.036, 0.274, 0.227, 0.052 | Graphik 700 #FFFFFF | 3.0 | start/top | 1.0 |
|  |  | Body text ×6 | 0.346, 0.326, 0.227, 0.200 | Graphik 400 #FFFFFF | 3.0 | start/top | 1.0 |
|  |  | Slide Title | 0.036, 0.019, 0.926, 0.155 | FoundersGroteskCond 600 #FFFFFF | 11.6 | start/top | 0.9 |
| Title & Bullets | #5E5534 | Slide bullet text | 0.035, 0.342, 0.926, 0.518 | Graphik 400 #FFFFFF | 5.6 | start/top | 1.0 |
|  |  | Slide Title | 0.036, 0.019, 0.926, 0.155 | FoundersGroteskCond 600 #FFFFFF | 11.6 | start/top | 0.9 |
| Text & Image | #5E5534 | picture | 0.000, -0.000, 0.573, 1.000 |  |  |  |  |
|  |  | Body text | 0.656, 0.045, 0.306, 0.816 | Graphik 400 #FFFFFF | 5.6 | start/top | 1.0 |
| Title, Text & Image | #4A5C55 | picture | 0.427, -0.000, 0.573, 1.000 |  |  |  |  |
|  |  | Heading Title | 0.035, 0.348, 0.356, 0.052 | Graphik 700 #FFFFFF | 3.0 | start/top | 1.0 |
|  |  | Slide Title | 0.036, 0.018, 0.355, 0.179 | FoundersGroteskCond 600 #FFFFFF | 11.6 | start/top | 0.9 |
|  |  | Body text | 0.035, 0.400, 0.356, 0.279 | Graphik 400 #FFFFFF | 3.0 | start/top | 1.0 |
| Statement | #4A5C55 | picture | 0.000, -0.000, 1.000, 1.000 |  |  |  |  |
|  |  | Statement | 0.033, -0.038, 0.933, 0.897 | FoundersGroteskCond 600 #FFFFFF | 25.9 | start/top | 0.8 |
| Quote | #212B33 | Attribution | 0.814, 0.054, 0.148, 0.143 | Graphik 400 #FFFFFF | 2.8 | start/top | 1.0 |
|  |  | “Quote” | 0.006, 0.013, 0.723, 0.846 | FoundersGroteskCond 600 #FFFFFF | 13.0 | start/top | 0.9 |
| Fact | #5E5534 | Fact Information | 0.580, 0.347, 0.382, 0.217 | Graphik 400 #FFFFFF | 3.0 | start/top | 1.0 |
|  |  | 100% | 0.034, 0.214, 0.464, 0.498 | FoundersGroteskCond 600 #FFFFFF | 37.0 | start/top | 1.0 |
| Image | #4A5C55 | picture | 0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Contents | #212B33 | 00 | 0.839, 0.019, 0.127, 0.767 | FoundersGroteskCond 600 #FFFFFF | 11.6 | end/top | 0.9 |
|  |  | Section Title | 0.036, 0.019, 0.615, 0.767 | FoundersGroteskCond 600 #FFFFFF | 11.6 | start/top | 0.9 |
| Agenda | #4A5C55 | Agenda | 0.036, 0.019, 0.926, 0.169 | FoundersGroteskCond 600 #FFFFFF | 11.6 | start/top | 0.9 |
|  |  | Agenda Topics | 0.034, 0.266, 0.517, 0.599 | Graphik 400 #FFFFFF | 5.6 | start/top | 1.0 |

### Editorial Colorful (70)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #7CAACB | Presentation Title | 0.033, 0.014, 0.435, 0.733 | Canela 400 #000000 | 10.4 | start/top | 0.9 |
| Title & Image | #98C37A | picture | 0.505, 0.068, 0.458, 0.865 |  |  |  |  |
|  |  | Presentation Title | 0.033, 0.014, 0.435, 0.733 | Canela 400 #000000 | 10.4 | start/top | 0.9 |
| Section | #ECCB6C | picture | 0.505, 0.069, 0.458, 0.865 |  |  |  |  |
|  |  | Section Title | 0.035, 0.014, 0.435, 0.620 | Canela 400 #000000 | 11.1 | start/top | 0.7 |
| Title & Text | #ECCB6C | Slide Title | 0.035, 0.038, 0.929, 0.265 | Canela 400 #000000 | 8.3 | start/top | 0.9 |
|  |  | Body Text | 0.035, 0.332, 0.929, 0.463 | Canela 400 #000000 | 6.5 | start/top | 0.9 |
| Title & Bullets | #E68B7A | Slide Title | 0.035, 0.038, 0.929, 0.265 | Canela 400 #000000 | 8.3 | start/top | 0.9 |
|  |  | Slide Bullet Text | 0.035, 0.332, 0.929, 0.543 | Canela 400 #000000 | 6.5 | start/top | 0.9 |
| Title, Text & Image | #E68B7A | picture | 0.428, 0.069, 0.535, 0.865 |  |  |  |  |
|  |  | Slide Subtitle | 0.035, 0.333, 0.357, 0.052 | Canela 400 #000000 | 3.0 | start/top | 1.0 |
|  |  | Slide Title | 0.035, 0.038, 0.357, 0.232 | Canela 400 #000000 | 8.3 | start/top | 0.9 |
|  |  | Body Text | 0.035, 0.394, 0.357, 0.482 | Canela 400 #000000 | 3.0 | start/top | 1.0 |
| Quote | #DAD1C0 | Quote Attribution | 0.814, 0.055, 0.146, 0.356 | Canela 400 #000000 | 2.8 | start/top | 1.0 |
|  |  | “Notable Quote” | 0.009, 0.019, 0.732, 0.778 | Canela 400 #000000 | 11.1 | start/top | 0.9 |
| Fact | #ECCB6C | Body Text | 0.700, 0.346, 0.243, 0.525 | Canela 400 #000000 | 3.0 | start/top | 1.0 |
|  |  | 100% | 0.033, 0.126, 0.634, 0.563 | Canela 400 #000000 | 37.0 | start/top | 0.9 |
| Image | #929CBA | picture | 0.000, -0.000, 1.000, 1.000 |  |  |  |  |
| Contents | #2C2D27 | 00 | 0.894, 0.038, 0.072, 0.522 | Canela 400 #FFFFFF | 7.4 | end/top | 0.9 |
|  |  | Contents | 0.036, 0.038, 0.297, 0.522 | Canela 400 #FFFFFF | 7.4 | start/top | 0.9 |
|  |  | Section Title | 0.348, 0.038, 0.530, 0.522 | Canela 400 #FFFFFF | 7.4 | start/top | 0.9 |

### Fitness Bold (98)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #F1CF00 | Presentation Subtitle | 0.033, 0.211, 0.932, 0.194 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | Presentation Title | 0.032, 0.040, 0.933, 0.201 | FoundersGroteskCond 600 tr-0.02 #000000 | 15.0 | start/middle | 0.8 |
| Title & Image | #212B33 | picture | -0.000, -0.000, 1.001, 1.001 |  |  |  |  |
|  |  | Presentation Subtitle | 0.033, 0.211, 0.932, 0.194 | FoundersGroteskCond 600 tr-0.01 #FFFFFF | 9.3 | start/top | 0.8 |
|  |  | Presentation Title | 0.032, 0.040, 0.933, 0.201 | FoundersGroteskCond 600 tr-0.02 #FFFFFF | 15.0 | start/middle | 0.8 |
| Section | #212B33 | picture | 0.349, -0.000, 0.651, 0.786 |  |  |  |  |
|  |  | 01 / Section | 0.034, 0.028, 0.281, 0.213 | FoundersGroteskCond 600 tr-0.01 #FFFFFF | 9.3 | start/top | 0.8 |
|  |  | Body text | 0.347, 0.824, 0.461, 0.117 | Graphik 400 #FFFFFF | 2.7 | start/bottom | 1.0 |
| Title & Text | #F1CF00 | Slide Subtitle | 0.191, 0.137, 0.775, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | Slide Title | 0.034, 0.028, 0.931, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | Body text | 0.192, 0.309, 0.461, 0.550 | Graphik 400 #000000 | 3.1 | start/top | 1.0 |
| Title & Bullets | #F1CF00 | Body text ×3 | 0.595, 0.539, 0.371, 0.130 | Graphik 400 #000000 | 3.1 | start/top | 1.0 |
|  |  | Slide Subtitle | 0.191, 0.137, 0.775, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 01 | 0.502, 0.343, 0.069, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 8.0 | start/top | 0.8 |
|  |  | Slide Title | 0.034, 0.028, 0.931, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 02 | 0.502, 0.519, 0.069, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 8.0 | start/top | 0.8 |
|  |  | 03 | 0.502, 0.694, 0.069, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 8.0 | start/top | 0.8 |
| Statement | #212B33 | Attribution | 0.035, 0.053, 0.227, 0.456 | Graphik 400 #FFFFFF | 3.1 | start/top | 1.0 |
|  |  | Statement | 0.343, 0.000, 0.623, 0.803 | FoundersGroteskCond 600 #FFFFFF | 16.5 | start/top | 0.8 |
| Quote | #F49754 | Attribution | 0.581, 0.669, 0.385, 0.191 | Graphik 400 #000000 | 3.6 | start/top | 1.0 |
|  |  | “Quote” | 0.013, 0.022, 0.951, 0.559 | FoundersGroteskCond 600 #000000 | 10.7 | start/top | 0.9 |
| Fact | #212B33 | color block #7EE171 | 0.427, 0.197, 0.573, 0.531 |  |  |  |  |
|  |  | Fact Information | 0.425, 0.054, 0.541, 0.111 | Graphik 400 #FFFFFF | 3.1 | start/top | 1.0 |
|  |  | Slide Title | 0.034, 0.028, 0.353, 0.135 | FoundersGroteskCond 600 tr-0.01 #FFFFFF | 9.3 | start/top | 0.8 |
|  |  | 100% | 0.448, 0.192, 0.517, 0.500 | FoundersGroteskCond 700 tr-0.01 #000000 | 37.0 | start/top | 0.8 |
| Image | #212B33 | picture | -0.000, -0.000, 1.001, 1.001 |  |  |  |  |
| Contents | #7EE171 | 02 / Section | 0.101, 0.191, 0.453, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 03 / Section | 0.167, 0.354, 0.453, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 04 / Section | 0.233, 0.517, 0.453, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 05 / Section | 0.299, 0.680, 0.453, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 01 / Section | 0.034, 0.028, 0.453, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |
|  |  | 00 ×5 | 0.503, 0.028, 0.145, 0.135 | FoundersGroteskCond 600 tr-0.01 #000000 | 9.3 | start/top | 0.8 |

### Hustle (102)

| Layout | Background | Element | Box x, y, w, h | Type | Size (%H) | Align / anchor | Line spacing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | #2B390B | Presentation Title | 0.031, 0.026, 0.969, 0.708 | Druk 800i caps #CDEEFD | 38.9 | end/top | 0.6 |
| Title & Image | #2B390B | picture (rounded) | 0.030, 0.056, 0.453, 0.889 |  |  |  |  |
|  |  | Presentation Subtitle | 0.512, 0.397, 0.457, 0.411 | Druk 700i caps #CDEEFD | 20.4 | start/top | 0.6 |
|  |  | Presentation Title | 0.512, 0.029, 0.457, 0.383 | Druk 700i caps #CDEEFD | 20.4 | start/bottom | 0.6 |
| Section | #2B390B | picture (rounded) | 0.032, 0.056, 0.937, 0.667 |  |  |  |  |
|  |  | Section Title | 0.030, 0.775, 0.940, 0.213 | Druk 700i caps #CDEEFD | 20.4 | end/top | 0.6 |
| Title & Bullets | #CDEEFD | Slide Subtitle | 0.031, 0.152, 0.701, 0.119 | Druk 500 caps #2B380B | 11.1 | start/top | 0.6 |
|  |  | Slide bullet text | 0.031, 0.306, 0.701, 0.616 | FoundersGrotesk 400 #2B380B | 3.9 | start/top | 1.0 |
|  |  | Slide Title | 0.032, 0.039, 0.699, 0.135 | Druk 800i caps #2B380B | 11.1 | start/bottom | 0.6 |
| Text & Image | #CDEEFD | picture (rounded) | 0.032, 0.056, 0.937, 0.667 |  |  |  |  |
|  |  | Body text | 0.030, 0.760, 0.940, 0.194 | FoundersGrotesk 400 #2B380B | 3.9 | start/top | 1.0 |
| Title, Text & Image | #CDEEFD | Slide Title | 0.636, 0.039, 0.333, 0.135 | Druk 800i caps #2B380B | 11.1 | start/bottom | 0.6 |
|  |  | picture (rounded) | 0.031, 0.056, 0.573, 0.889 |  |  |  |  |
|  |  | Body text | 0.635, 0.306, 0.333, 0.616 | FoundersGrotesk 400 #2B380B | 3.9 | start/top | 1.0 |
|  |  | Slide Subtitle | 0.635, 0.152, 0.333, 0.119 | Druk 500 caps #2B380B | 11.1 | start/top | 0.6 |
| Statement | #CDEEFD | Statement | 0.000, 0.004, 1.000, 1.019 | Druk 800i caps #2B380B | 23.1 | end/middle | 0.6 |
| Quote | #CDEEFD | “ | 0.049, 0.101, 0.089, 0.378 | Druk 800i caps #2B380B | 37.0 | start/middle | 0.6 |
|  |  | drawn shape #2B380B | 0.031, 0.056, 0.938, 0.889 |  |  |  |  |
|  |  | Quote | 0.188, 0.112, 0.750, 0.776 | Druk 700i caps #CDEEFD | 22.2 | end/middle | 0.6 |
|  |  | Attribution | 0.062, 0.695, 0.224, 0.153 | DrukWide 500 caps #CDEEFD | 3.0 | start/bottom | 0.6 |
| Fact | #CDEEFD | drawn shape #2B380B | 0.031, 0.056, 0.938, 0.889 |  |  |  |  |
|  |  | 100% | 0.031, 0.116, 0.485, 0.805 | Druk 800i #CDEEFD | 40.7 | center/middle | 0.6 |
|  |  | Fact information | 0.547, 0.288, 0.422, 0.438 | Druk 500 caps #2B380B | 11.1 | start/middle | 0.6 |
| Image | #CDEEFD | picture | 0.000, 0.000, 1.000, 1.000 |  |  |  |  |
| Multi-Image | #CDEEFD | picture (rounded) | 0.744, 0.056, 0.225, 0.431 |  |  |  |  |
|  |  | picture (rounded) | 0.515, 0.515, 0.454, 0.430 |  |  |  |  |
|  |  | picture (rounded) | 0.031, 0.056, 0.225, 0.889 |  |  |  |  |
| Contents | #2B390B | Section Title | 0.198, 0.056, 0.528, 0.889 | Druk 800i caps #CDEEFD | 8.9 | start/middle | 0.8 |
|  |  | 00 | 0.741, 0.056, 0.059, 0.889 | Druk 500 #CDEEFD | 8.9 | end/middle | 0.8 |
| Agenda | #2B390B | Agenda | 0.198, 0.186, 0.603, 0.119 | Druk 500 caps #CDEEFD | 11.1 | start/bottom | 0.6 |
|  |  | Agenda Topics | 0.198, 0.322, 0.600, 0.620 | Druk 800i caps #CDEEFD | 8.9 | end/top | 0.8 |

## Appendix B: all 38 new themes (lighter pass)

Sizes are percentages of the slide height. "Content" is the Title & Text master (or Title & Bullets): title / body. A dash means the master or role is absent. Grounds lists the distinct background colors across the theme's masters (count, then the first four).

| # | Name | Masters | Faces (theme metadata, excluding Helvetica defaults) | Grounds | Cover title | Content title / body | Statement / quote / fact | Signature |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | Dynamic Chill | 17 | Domaine Display, Graphik | 2: animated #FFFFFF | 8.9 | 8.1 / 4.3 | 10.2 / 8.4 / 23.1 | Animated soft-gradient grounds (Dynamic category); dark violet serif display; older 17-master set; translucent panel behind the cover title |
| 41 | Purple Tropics | 17 | Domaine Display, Graphik | 4: #2F0A87 #5E18A4 #FFFFFF #2F0B87 | 8.9 | 8.1 / 4.3 | 10.2 / 8.4 / 23.1 | Two violet grounds; high-contrast serif display over grotesque; older 17-master set with centered statement, fact and section |
| 42 | Community Colorful | 21 | Produkt | 1: #FFFFFF | 6.9 | 6.9 / 6.9 | – / 7.4 / 27.8 | White ground with saturated color blocks; pictures and blocks interlock through notched corners; one slab face at one size (6.9%) for title, subtitle and body |
| 43 | Volunteer Colorful | 19 | Publico Headline, Publico Text | 7: #FFFFFF #AAD6FB #F7C4FF #A692FF … | 9.3 | – / – | 18.5 / 10.2 / 37.0 | Pastel grounds; serif headline; pictures bleed off edges (Apple describes jagged-edged picture frames); cover anchored low |
| 44 | Note-Taking Colorful | 20 | Graphik, Produkt | 1: #FFFFFF | 11.1 | 2.8 / 3.2 | 5.6 / 16.2 / 37.0 | White ground; one grotesque in one weight; a tall orange sidebar block holds titles; pale blue panels with 3 × 2 heading grids |
| 45 | Scientific Muted | 20 | Charter, Druk, Produkt | 7: #C7A252 #929CBA #DEDED2 #A395A2 … | 27.8 | – / 2.8 | 27.8 / 18.5 / 55.6 | Five muted grounds rotating per master; ultra-condensed headline anchored to the foot; hairline under the top margin; outlined specimen picture boxes |
| 46 | Business Modern | 18 | Founders Grotesk | 5: #FFF6E0 #9C612A #007FFF #946435 … | 11.2 | – / 1.9 | 5.6 / 16.2 / 38.9 | Cream ground; side title as a 1.9% accent label; light-weight body; six numbered columns with hairlines; staggered picture pair |
| 47 | Wellness Bold | 20 | Graphik | 6: #FFFFFF #FF9684 #8FABC0 #FFBC33 … | 9.3 | 6.5 / 6.5 | 18.5 / 10.2 / 32.4 | Saturated and gradient grounds (purple to pink); one grotesque, regular only; statement 18.5% |
| 48 | Luxury Elegant | 20 | Canela, Canela Text | 4: #FFF6E0 #FFBE92 #8C4414 #4C220A | 11.1 | 5.6 / 5.6 | 5.6 / 16.2 / 37.0 | Cream, peach and brown grounds; one light serif at three sizes; brown ink; vertical hairline; half-bleed pictures |
| 49 | University Classic | 19 | Domaine Display, Founders Grotesk, Founders Grotesk Text | 5: #DCD8BD #592200 #FFFFFF #323100 … | 13.7 | 11.8 / 5.3 | – / 11.8 / 46.3 | Parchment, brown and navy; display serif titles at 12 to 14% over bold grotesque body; marbled-paper pictures |
| 50 | Cyber Stark | 19 | Courier New | 2: #000000 #FFFFFF | 5.6 | 4.6 / 4.6 | – / 7.4 / 27.8 | Black ground; monospace only at small sizes; one neon accent per layout; half-bleed abstract renders |
| 51 | Branding Modern | 20 | Graphik | 8: #F6F6F6 #007540 #871200 #FFFFFF … | 9.9 | 6.9 / 5.6 | 16.2 / 10.2 / 27.8 | Off-white and saturated maroon, green and blue fields; large petal motif bled off edges; title and subtitle equal size, color contrast |
| 52 | Gradient Colorful | 19 | Courier New, Graphik | 9: #FFFFFF #5AB4FA #B97AFA #95E200 … | 9.3 | 6.5 / 6.5 | 18.5 / 10.2 / 46.3 | Concentric-ring and banded gradient grounds; bold grotesque; figure at 46% |
| 53 | Educator Playful | 19 | Founders Grotesk, Founders Grotesk Text | 1: #FFFFFF | 6.9 | 5.1 / 5.1 | 20.7 / 10.0 / 50.9 | White ground; hand-drawn marker strokes and arrows in six colors; title and body equal (5.1%); figure 51% |
| 54 | Standard Minimalist | 20 | Founders Grotesk, Founders Grotesk Text | 1: #FFFFFF | 10.0 | 5.6 / 5.6 | – / 16.2 / 37.0 | White; cover title and subtitle both 10%, weight contrast; side titles; rounded pictures (radius 0.8% of width) matted 1.4%; gray caption chips |
| 55 | Travel Colorful | 20 | Courier New, Graphik | 7: #FDDB7A #FA7B74 #F4E5D0 #C1859E … | 13.9 | 8.3 / 2.6 | 17.2 / 9.3 / 37.0 | Warm muted grounds rotating; light grotesque titles with monospace subtitles; thin crosshair rules |
| 56 | Scrapbook Dark | 20 | Publico Headline, Publico Text | 7: #E0D7CE #BA8800 #1B293C #32233F … | 7.4 | 6.9 / 6.9 | 18.5 / 12.0 / 37.8 | Earthy dark grounds; serif headline; collage of 16 inset pictures of mixed sizes |
| 57 | Meadow Pastel | 19 | Courier New, Graphik | 5: #FBF7EF #E5DFD0 #FFFFFF #B9D7E4 … | 10.1 | 3.3 / 5.6 | 14.5 / 5.6 / 37.0 | Cream and pastel grounds with a faint dot grid; side titles; monospace labels; staggered picture pairs |
| 58 | Startup Simple | 18 | Graphik | 7: #F7F0E5 #B7F500 #F6F0E6 #C0C0C0 … | 11.1 | 1.9 / 5.6 | 5.6 / 16.2 / 37.0 | Cream, lime and gray grounds; side title at 1.9% with body at 5.6%; outline illustrations |
| 59 | Photography Bold | 19 | Avenir Next | 7: #FFFFFF #03B307 #9F8DF8 #A4D2F8 … | 10.1 | 1.9 / 5.6 | 16.2 / 5.6 / 37.0 | White plus one saturated ground per special master; staircase of ascending pictures; demibold over italic pairing |
| 60 | Academic Modern | 18 | Domaine Display, Founders Grotesk | 7: #DCD8BD #0F2335 #FFFFFF #402D00 … | 16.7 | 5.6 / 5.6 | 11.6 / 16.2 / 46.3 | Navy, brown, maroon and olive grounds with parchment ink; display serif cover at 16.7%; double-rule picture frames |
| 61 | Family Colorful | 20 | Graphik | 9: #FFFFFF #012F54 #F7B22D #F0EAD8 … | 9.3 | 6.5 / – | – / 9.6 / 37.0 | Soft colorful grounds; one grotesque, regular only; flat illustration |
| 62 | Factory | 20 | Courier New | 3: #DCE9DA #262138 #FFFFFF | 5.6 | 5.6 / 5.6 | 16.2 / 5.6 / 37.0 | Dark navy and pale mint; monospace only; industrial photography; cover anchored low |
| 63 | Journalism Simple | 20 | Courier New, Publico Headline, Publico Text | 4: #FFFFFF #FFE8C2 #D82B2B #F2DBDB | 11.1 | 3.2 / 5.6 | 5.6 / 16.2 / 37.0 | White, red and cream; news serif with typewriter labels; column rules; side titles |
| 64 | Painting Simple | 21 | Courier New, Founders Grotesk Cond | 3: #FBF7EF #97CDEB #333333 | 12.0 | 5.9 / 5.9 | 5.9 / 16.2 / 37.0 | Cream, sky and charcoal; condensed grotesque with monospace; watercolor pictures; side titles |
| 65 | Sales Bold | 20 | Avenir Next | 7: #F6F6F6 #F6F5F4 #FFFFFF #00C900 … | 13.9 | 6.9 / 6.9 | 15.6 / 10.6 / 37.0 | Light gray ground with saturated starburst shapes; humanist-geometric sans; centered accent statement |
| 66 | Recreation Colorful | 20 | Druk, Founders Grotesk Text | 7: #FBEE0E #24B24C #005AA4 #FF712E … | 18.5 | 11.6 / 3.9 | – / 16.6 / 55.6 | Primary-color grounds; ultra-condensed display (cover 18.5%, figure 55.6%); flat sports illustration |
| 67 | School Simple | 18 | Publico Headline, Publico Text | 5: #FFFFFF #F2F2F2 #FFB400 #DF6BFF … | 9.3 | 6.5 / 6.5 | – / 9.3 / 23.1 | White, gray and yellow; serif headline; flat object illustration |
| 68 | Fitness Dark | 19 | Founders Grotesk Cond, Graphik | 5: #4A5C55 #5E5534 #212B33 #32433F … | 14.8 | 11.6 / 3.0 | 25.9 / 13.0 / 37.0 | Muted dark olive and slate grounds, white ink at 7:1; condensed titles at 11.6 to 14.8%; half-bleed photography |
| 69 | Event Elegant | 20 | Publico Headline, Publico Text | 1: #F2EDE1 | 11.1 | 1.9 / 5.6 | 5.6 / 16.2 / 37.0 | One tan ground for every master; serif roman over italic cover pair; side titles |
| 70 | Editorial Colorful | 20 | Canela, Canela Text | 9: #ECCB6C #E68B7A #7CAACB #DAD1C0 … | 10.4 | 8.3 / 6.5 | – / 11.1 / 37.0 | Rotating muted pastel grounds; one light serif for every role; halftone pictures overlapping on the grid |
| 71 | Culinary Plain | 20 | Courier New | 1: #FFFFFF | 11.1 | 1.9 / 5.6 | – / 16.2 / 37.0 | White; monospace for every role; side title at 1.9%; the most picture placeholders (39) |
| 74 | Note-Taking Refined | 19 | Graphik | 1: #FFFFFF | 11.1 | 2.8 / 5.6 | 16.2 / 5.6 / 37.0 | White with colored header bars (mustard, red, purple); chart and table masters |
| 77 | Wellness Pastel | 19 | Graphik | 3: #FFFFFF #FFDD97 #D4DDE5 | 9.7 | 4.9 / 3.9 | 11.9 / 7.1 / 41.7 | White plus pastel gradient covers; deep violet ink throughout |
| 84 | Standard Bold | 20 | Founders Grotesk, Founders Grotesk Text | 2: #000000 #FFFFFF | 11.1 | 5.6 / 6.9 | 16.2 / 5.6 / 37.0 | Black version of Standard Minimalist: rounded pictures, side titles, numbered tiles |
| 89 | Photography Colorful | 20 | Avenir Next | 2: #FFFFFF #000000 | 11.1 | – / 5.6 | 16.2 / 5.6 / 43.1 | Alternating white and black masters; humanist-geometric sans with bold italic; many inset pictures |
| 98 | Fitness Bold | 19 | Founders Grotesk Cond, Graphik | 7: #212B33 #F1CF00 #7EE171 #40360F … | 15.0 | – / 3.1 | 16.5 / 10.7 / 37.0 | Yellow, green, orange and navy; condensed semibold display (15%) with stepped title and subtitle; 9 px rules; color tiles |
| 102 | Hustle | 27 | Druk, Druk Wide, Founders Grotesk | 2: #CDEEFD #2B390B | 38.9 | 11.1 / 3.9 | 23.1 / 37.0 / 40.7 | Two colors only (forest and sky); ultra-condensed italic caps at 11 to 41% with 0.6 leading; rounded pictures; 27 masters |

## Appendix C: reproducing the measurements

The decoder and scripts live only in `/Users/michael/opf-work/keynote-themes-local/tools/` (not for commit):

- `iwa.py` reads the Snappy chunk framing and walks the protobuf without a schema;
- `extract.py` resolves masters, placeholders, style inheritance, masks and fills into JSON;
- `stats.py`, `cross.py` and `frag.py` produce the numbers above.

Re-running them on another Keynote version gives a like-for-like comparison. Field readings that are inferred rather than confirmed:

- the autoshrink flag (shape-text property 1);
- the tracking unit (character property 27, read as a fraction of the em);
- the 0.5 em average character width behind the characters-per-line estimates.
