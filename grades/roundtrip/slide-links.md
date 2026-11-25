# Slide links (`slide:<id>`, main 04f265afc) through Keynote 16.0: what back.pptx holds

Answer for the release supervisor. Deck: `$W/build/main/main-features/slide-links/default.pptx` (expectations in
`EXPECT.md` beside it), opened in Keynote 16.0 in pass A, exported by Keynote as PowerPoint:
`$W/keynote/main/main-features/slide-links~default/back.pptx`. Read with `scripts/rt_links.py` (every `a:hlinkClick`
in every slide, including table cells; output `links.json`). Everything here is SAW in those two files and
`probe.json`; whether Keynote **follows** a jump when clicked is not visible in a file and is listed in
`$W/grades/ui-checks.md`.

**Short answer: all 8 slide jumps and the 1 web link of the deck survive into back.pptx in PowerPoint's own form:
`<a:hlinkClick r:id=… action="ppaction://hlinksldjump"/>` with an internal relationship of type `slide` to the same
target slide (`slideN.xml`), on the same object (text run, shape, table cell). None was dropped, none became a web link,
none points to another slide. The jump to the hidden slide 4 is kept, and slide 4 is still hidden (`show="0"`;
Keynote `skipped` = true).** OPF 0.36.0's import of back.pptx (`back.opf.json`) succeeded.

| Slide | Where | Object (`p:cNvPr@name`, kept by Keynote) | Text | Original | back.pptx |
|---|---|---|---|---|---|
| 1 | text run | `OPF text slides.0.blocks.0.text line 0` | Pricing | jump -> slide 2 | `hlinksldjump`, rel `slide` -> `slide2.xml` |
| 1 | text run | same box | Roadmap | jump -> slide 3 | `hlinksldjump` -> `slide3.xml` |
| 1 | text run | same box | Appendix (hidden slide) | jump -> slide 4 (hidden) | `hlinksldjump` -> `slide4.xml` (still hidden) |
| 1 | text run | same box | acme.com | web link https://acme.com | external relationship https://acme.com, `action=""` |
| 1 | shape (`p:cNvPr/a:hlinkClick`) | `OPF shape slides.0.blocks.1.shape` | Shape: go to Roadmap | jump -> slide 3 | on the shape, `hlinksldjump` -> `slide3.xml` |
| 2 | table cell r3 c1, run | `OPF table 1` | Table cell: back to the agenda | jump -> slide 1 | in the cell's run, `hlinksldjump` -> `slide1.xml` |
| 2 | table cell without a link | `OPF table 1` | No link | none | none (no link added) |
| 3 | text run, line 1 of 2 | `OPF text slides.2.text line 0` | Text run: back | jump -> slide 1 | `hlinksldjump` -> `slide1.xml` |
| 3 | text run, line 2 of 2 | `OPF text slides.2.text line 1` | to the agenda | jump -> slide 1 | `hlinksldjump` -> `slide1.xml` |
| 4 (hidden) | shape | `OPF shape slides.3.blocks.0.shape` | Shape: back to the agenda | jump -> slide 1 | on the shape, `hlinksldjump` -> `slide1.xml` |

Details seen in back.pptx:

- The run links cover only their words: the " | " separators are their own runs with `u="none"` and no link (slide 1).
- Keynote writes its full attribute set on every link: `invalidUrl="" tgtFrame="" tooltip="" history="1"
  highlightClick="0" endSnd="0"`; the web link carries `action=""` (empty) with an external relationship.
- On slide 3, line 2, Keynote also writes a `hlinkClick` (same jump) into the paragraph's `a:pPr/a:defRPr`, the default
  run properties of that line (the only link "added"; it repeats the run's own link; **inferred** harmless).
- Look of linked text: OPF wrote the links in the text color with an underline (`u="sng"`, `a:solidFill schemeClr tx1`,
  and the `ahyp:hlinkClr val="tx"` extension). Keynote writes the linked runs in blue `0000EE` with a blue underline
  (`a:uFill`), on text, in the table cell and on the web link: the known row "Keynote ignores the hyperlink color
  extension" (`$W/src-036/skills/opf-export/SKILL.md`, Keynote 15.1.1 differences), still there in 16.0.
- Other links in pass A (0.36.0 files): every web link on text (6 default, 4 native, 1 static) and on shapes (46
  default, 6 native: social footers and video frames) came back as the same external link on the same object.
  0.35.1 and 0.36.0 behave the same.

What is not known from the files (user interface; listed in `ui-checks.md` under "roundtrip (RT)"):
- whether Keynote shows each object's link as **Link to: Slide N** (Format > Link / the link editor) with the right
  number, and whether a click in Play jumps there (Play needs the owner's OK);
- whether the jump to the hidden slide 4 is followed in Play (Keynote normally skips hidden slides in sequence but a
  link to one can still show it: not observed).
