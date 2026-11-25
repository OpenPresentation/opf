# Round trip and "what each object became": pass A (Keynote 16.0, OPF 0.36.0)

Saved by the supervisor from the grader's hand-back (the grader could not write report files itself). Scope: 86 opened files (60 from 0.36.0 and main, 26 from 0.35.1); every number from a script over all of them (`scripts/`). The five fonttest files are one deck five times. SAW = read in the named file; inferred = the grader's reading. Importer code cited is tag v0.36.0. No minimal deck has been opened in Keynote yet. Companion files here: `import-failures.md`, `slide-links.md`, `objects.md`, `files.md`, and the `.json` data.

## 1. Object kinds (0.36.0 + main): native / changed / picture / dropped

From probe.json (matches back.pptx's top-level elements one to one) and back.pptx. Keynote keeps every OPF shape name.

| Kind | default (37 files) | native (22 files) | static (1 file) |
|---|---|---|---|
| slide title | 453/7/0/0 (centered title → plain title) | 300/7/0/0 | 36/2/0/0 |
| body text | 1229/0/0/0 | 531/0/0/0 | 41/0/0/0 |
| other text | 413/80/0/0 (text in an ellipse or rounded rectangle became a group of the shape plus a text box) | 336/20/0/0 | 58/8/0/0 |
| list items | 1168/0/0/0 | 691/0/0/0 | 105/0/0/0 |
| table | 38/0/0/0 | 26/0/0/0 | 2/0/0/0 |
| chart (native) | 70/2/0/0 (stacked line → line) | 36/0/0/0 | 4/0/0/0 |
| chart (extended) | none in pass A | none | none |
| shape | 325/6/0/0 (rare presets became groups of freeform parts) | 256/2/0/0 | 61/0/0/0 |
| line/connector | 95/0/0/1 (a zero-length line) | 80/0/0/1 | 25/0/0/0 |
| group | OPF writes none (Keynote creates 116) | | |
| diagram | 1/0/8/0 (SmartArt became a picture; OPF's own diagram stays a group) | 1/0/8/0 | 0/0/2/0 |
| picture | 97/117/0/0 (letterbox → frame sized to the image x55; rounded-rectangle or ellipse mask → custom outline x57) | 57/2/0/0 | 13/0/0/0 |
| link on text | 6/0/0/0 | 4/0/0/0 | 1/0/0/0 |
| link on a shape | 46/0/0/0 | 6/0/0/0 | 0 |
| link to a slide | 7/0/0/0, plus 1 in a table cell | 0 | 0 |
| presenter notes | 359/0/0/0 | 303/0/0/0 | 38/0/0/0 |
| footer / slide number / date | 6/41/0/0 | 6/41/0/0 | 38/0/0/0 |
| hidden slide | 1/0/0/0 | | |
| transition/timing | none (OPF has no transitions) | | |

The 41 changed slide numbers stay a live field, but inside an ordinary text item, not Keynote's Slide Number setting. Keynote drops 113 empty blank-line text boxes; nothing visible is lost.

## 2. Title and body placeholders

- Title: on all 784 slides (and all 243 of 0.35.1) the title is the layout's title item, title showing on, with text.
- Body: default and static: no slide shows a body (OPF writes body text as text boxes). Native: 152 of 303 slides have the layout's body item: exactly the 152 where OPF wrote a body placeholder.
- Ghosts: none (no empty placeholder showing).
- Layout names: OPF's name on 732 of 784 slides; the other 52 get "<name> 0" ("Title Only 0", "Quote 0", "Section 0", "Statement 0", "Closing 0"): per-slide copies of the layout, cause not found (LY-06).

## 3. Text

- Default: 3356 Keynote text items on 443 slides against 3453 OPF paragraphs and roughly 1935 source paragraphs (about 1.7 items per source paragraph). Native: 1891 against about 1519. Static: 288 against 184.
- Fonts Keynote reports: Aptos → Helvetica (4022 paragraphs); Aptos Display → Helvetica-Bold (1001); Aptos bold → Helvetica-Bold (517); Roboto Mono → Helvetica (99). Language decks: Aptos → ArialMT (45), Verdana (18), YuGo-Medium (12). back.pptx still names Aptos / Aptos Display; for Indic, Thai and Arabic text it names the theme's per-script font (Nirmala UI 146, Leelawadee UI 32, Arial 45, Segoe UI 18).
- Sizes: whole-point sizes kept (3478 paragraphs); 2434 fractional sizes reported 0.1 to 0.9 pt smaller.
- Bullets and numbering: all real list styles in both files (`buChar` • and –; `buAutoNum` arabicPeriod, romanLcParenR, alphaLcPeriod, `startAt` kept on default mode's per-line boxes); no typed bullet characters; Keynote moves bullets into the shape's list style or the master's body style.
- Alignment: 0 changes in about 5800 paragraphs. rtl: 61 paragraphs keep `rtl="1"`, 9 lose it (RT-07).

## 4. Pictures

- Description rule (301 pictures): Keynote's image Description is the shape's `name` ("OPF image 1", 221 pictures); with a `title` it is title + "\n\n" + name (60). `descr`, where OPF writes its alt text, is never used: 0 of 251.
- Written back: name and descr both become title+name ("HarborOPF image 1"), title dropped. OPF's import reads that as the alt. Chart and table frames lose `descr` entirely (112 charts, 66 tables).
- To make the alt arrive: put it in `name`, with no `title`. PowerPoint cost (from its documented behavior, not tested): alt is read from `descr`, `title` is the older Alt Text Title; with the alt in `name` and `descr` kept PowerPoint stays correct, but the Selection Pane shows the sentence as the object's name, and OPF's name-based image identity (`/^OPF image \d+$/` in `image-provenance.js`) breaks.
- Cheap importer fix: treat a `descr` equal to the name, title+name or the media file name as "no alt".
- Crops survive within 1/100000. Letterbox crops (negative `srcRect`) become a frame sized to the image (in a group with a rectangle when outlined). Rounded-rectangle and ellipse masks become `custGeom`.

## 5. Links (`slide-links.md`)

- slide-links deck (main): all 8 slide jumps and the web link survive in back.pptx as `hlinkClick action="ppaction://hlinksldjump"` with an internal `slide` relationship to the same target: text runs, the shape, the table cell, the two-line link on slide 3, and the jump to hidden slide 4 (stays hidden). None dropped, none became a web link.
- Every other web link on text and on shapes came back as the same external link on the same object. Keynote recolors linked runs blue (0000EE): the known hyperlink-color difference.
- Not shown by files: whether Keynote shows "Link to: Slide N" and follows the jump when clicked (`grades/ui-checks.md`).

## 6. Notes, hidden slides, slide size, transitions

All kept in all 86 files: 13.333 x 7.5 in; notes verbatim on all 700 slides that have them; the hidden slide; no transitions (back.pptx adds an empty `<p:transition spd="med" advClick="1"/>` on every slide).

## 7. Tables and charts in back.pptx

- Tables (66): all still tables, same rows, columns, cell text; header-row flag kept; no merged cells in pass A; fills move into a Keynote table style; numbers are text cells (format "automatic"); right alignment not written back (RT-08).
- Charts (112 frames): still charts with series names, categories and values. Changes: stacked line → line (m-charts 4, 2 charts); category name in data labels dropped (m-charts 5); per-point fills (`c:dPt`) dropped on 31 series; hidden value axes stay hidden but as "no labels" (83); major unit rewritten (61 charts: 10 → 10.5, 0.2 → 0.84); number format General → "0" or "0.##", no value rounded; lang-rtl 1-2: category axis direction reset and categories and values both reversed (data intact).

## 8. The three import failures (`import-failures.md`)

- **m-charts~default (RT-01):** 0.36.0's highlight export writes a second series with a sparse cache (ptCount 4, points at idx 1 and 3). Keynote keeps the values but writes ptCount 2, so idx 3 is out of range. Keynote writes an inconsistent cache; OPF's importer rejects the whole 16-slide deck (`cachedValues`, `packages/pptx/src/index.js` ~2318, `index >= count`; same rule `chartex.js` ~556). Proved locally: patching the counts makes the file import.
- **layouts-lots~default / ~native (RT-02):** Keynote turns category labels containing ": " into a two-level cache (`c:multiLvlStrRef`) with duplicate indices; its own embedded worksheet has the single labels. Importer check `cachedValues`, `levels.length > 1` (~2305); the whole 38-slide deck fails. Proved locally: rebuilding labels from Keynote's worksheet makes both import. That ": " is the trigger is inferred (experiment LY-05).
- A user loses the entire deck, not the chart. The importer should repair the cache or degrade that one chart.

## 9. What comes back (deck source against OPF's import of back.pptx)

Control: OPF's import of the original export, without Keynote, recovers everything block for block.

| Source kind | default | native | static |
|---|---|---|---|
| text | 319 same | 266 same, 10 as list, 1 gone | 24 same |
| list | 136 same, 119 plain text, 8 picture | 108 same, 57 plain text, 8 picture, 10 gone | 6 same, 22 plain text |
| image | 189 same | 34 same | 13 same |
| chart | 48 same type and data; category header lost on all 48; alt lost 23/23 | 33 same; alt lost 15/15 | 4 same |
| table | 31 same shape; cell text differs in 4 (right alignment → start) | 23 same; 4 differ | 2 same |
| metric / quote / code / timeline / video / diagram | all plain text (30/7/7/4/11/1) | same | same |
| titles | 382 same, 7 cut at OPF's second title box | 261 same, 4 cut | 38 same |
| notes | all same | all same | all same |
| links | 11 → 18 (one per line) | 3 → 6 | 1 → 1 |

Cause, proved: stripping OPF's tags from the original (`scripts/strip_tags.py`) reproduces exactly the import after Keynote.

## Findings

- **RT-01 (wrong)** A deck with a highlighted chart cannot be imported back after Keynote. 036 `m-charts~default` slides 1-3; 0.35.1 imported fine (one dense series). Keynote writes an inconsistent cache; OPF's importer is too strict; OPF 0.36.0's export is the trigger. Fix: importer extent = max(ptCount, max idx + 1, size of `c:f`) with an info finding; or a one-series highlight with `c:dPt`. Min `min/RT-01.opf.json`.
- **RT-02 (wrong)** Categories containing ": " make Keynote write a hierarchical cache; the whole deck fails to import. Fix: read the embedded worksheet, else join the levels, else degrade that chart. Min `min/RT-02.opf.json`.
- **RT-03 (wrong, accessibility)** Alt text never reaches Keynote, and the round trip replaces it with "OPF image N" (251 pictures with alt; `importPicture` ~1619 accepts the stand-in; "HarborOPF image 1" also breaks image identity). File valid, Keynote reads it differently. Min `min/RT-03.opf.json`.
- **RT-04 (wrong, round trip)** Keynote drops OPF's tags (134 `ppt/tags` parts → 0; every `p:custDataLst` dropped; names kept), so the import recovers no OPF structure: titles cut, metrics/quotes/code/timelines/video/diagrams and many lists as plain text, chart category header and alt lost. In Keynote itself, two-box titles show only their first part in the title placeholder. The loss is OPF's (no fallback to the "OPF …" shape names Keynote keeps). Min `min/RT-04.opf.json`.
- **RT-05 (small)** Text in a non-rectangular shape becomes a group of the shape and a text box (116 objects: 98 badges, 8 diagram nodes, 2 vertical-text boxes, 8 rare presets). No change recommended.
- **RT-06 (small)** Titles shrink (382 of 784 written back smaller; m-agenda 2: 30.37 → nominal 30 → written 26.7) and fractional sizes are truncated. Shrink-to-fit and whole-point storage inferred; UI check. `--typefaces safe` helps.
- **RT-07 (small)** `rtl` lost on 9 right-to-left paragraphs that start with Latin text or digits (see MX-06).
- **RT-08 (small)** Table right alignment not written back (probe shows "right", back.pptx no `algn`, import "start"); numbers are text cells. Keynote's export.
- **RT-09 (small)** Chart axis details rewritten; no values lost.

## Improvements

| What OPF could do | Cost for PowerPoint | Existing flag |
|---|---|---|
| Importer: never fail a whole deck for one chart cache; repair from `c:f` or the embedded worksheet, or degrade that chart with a warning (RT-01, RT-02) | none (import only) | none |
| Importer: treat a picture `descr` equal to the name, title+name or the media file name as no alt (RT-03) | none | none |
| Importer: rebuild OPF blocks from the "OPF …" shape names when the tags are gone (RT-04) | none | none |
| Export: highlight as one series with `c:dPt` instead of a sparse second series (RT-01, MX-03) | the legend shape M13 wanted changes | none |
| Export: put the alt where Keynote reads it (`name`), only after experiment RT-03 | Selection Pane names become sentences; OPF's name-based image identity has to move | none |
| Office-safe typefaces so Keynote does not shrink titles (RT-06) | a different typeface | `--typefaces safe` |

## Not run

Nothing in Keynote (minimal decks RT-01 to RT-09 validated, in `grades/reopen-list.txt`). UI checks appended to `grades/ui-checks.md`: "Link to: Slide N" and click-follow, the image Description inspector, chart and table descriptions, title font size and Shrink Text to Fit, table data format and alignment, paragraph direction, badge groups. main's importer not compared. No sheets.
