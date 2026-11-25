# Grading brief (every grader reads this after BRIEF.md)

You grade what Keynote 16.0 made of OPF's exported `.pptx` files. You do not touch Keynote, you do not call GitHub,
you change nothing under `build/`, `keynote/` (read-only inputs) or in any checkout. You write under
`$W/grades/<your-family>/` and labeled sheets under `$W/evidence/sheets/`.

## Inputs (per opened file `<name>` = `<deck>~<mode>`, mode = default | native | static)

- OPF's preview: `$W/build/<ver>/<family>/<deck>/preview/slide-N.png` (1280x720; hidden slides are left out and the
  rest renumbered; `build.json` says which are hidden).
- The exported file: `$W/build/<ver>/<family>/<deck>/<mode>.pptx` (a missing `native.pptx`/`static.pptx` means its
  slide XML equals default's: see `build.json`).
- Keynote's output: `$W/keynote/<ver>/<family>/<name>/`: `slides/slide-NN.png` (960x540, Display P3 + alpha),
  `probe.json` (Keynote's object model per slide), `scores.json` (compare score and difference boxes per slide; it
  only ranks), `back.pptx` (Keynote's own PowerPoint export of the opened deck), `roundtrip-diff.json`,
  `back.opf.json` (OPF's import of back.pptx, if it imported), `import-notes.txt`, `run.json`.
- Grid sheets for looking: `$W/keynote/<ver>/<family>/_sheets/*.jpg` (preview beside Keynote, 12 slides a page).
- Tools: `$W/tools/README.md`. `python3 $W/tools/sheet.py` builds labeled finding sheets; `python3
  $W/tools/pptx_inspect.py <file>` reads a `.pptx` (also `--diff a b`); `python3 $W/tools/compare.py`.
- Versions: `036` = the version under test; `0351` = published 0.35.1 (the "before"); `main` = 04f265afc. For the
  changelog decks, every 0.36.0 `.pptx` part was found identical on main (`$W/keynote/main/matrix/SAME-AS-036.md`),
  so "main: unchanged" holds for them without a Keynote run. For other families, say "main: not run" unless you
  compared the `.pptx` parts yourself (`pptx_inspect.py --diff` or unzip + cmp of slide/chart/layout XML against
  `$W/build/main/...`): identical parts mean identical in Keynote.

## How to look

Read the grid sheet pages with the Read tool (every page of every file you are responsible for; a slide that belongs
to a changelog row is looked at however low it scores). For anything that is not clearly "same", Read the two
full-size pictures (convert Keynote's PNG first if colors matter: its raw pixels are Display P3; `sheet.py` and
`compare.py` already convert). Do not report a color difference without the conversion. Do not grade from scores.

## What to write

1. `$W/grades/<family>/grades.json`: one object per slide of each opened file: `{"ver","deck","mode","slide",
   "layout_or_row","grade":"same|small|wrong","what":"<one line; empty for same>","finding":"<id or empty>",
   "known":"<row of the Known list it matches, or empty>"}`. Grade against OPF's 0.36.0 preview of the same slide.
   A difference that is one of the already known Keynote differences (the table "Keynote 15.1.1 differences" in
   `$W/src-036/skills/opf-export/SKILL.md`, and `$W/issues/1416.md`, `1418.md`, `1298.md`) is graded on its looks
   like any other and marked in `known`; it is not a new finding. Fonts: this Mac has no Aptos, so Keynote draws
   Helvetica; a slide whose only difference is the face and slightly different widths is "small" with
   `known: "font substituted"`. A font substitution that causes a clip, overlap or lost line is "wrong".
2. `$W/grades/<family>/objects.json`: counts of what each object kind became, from `probe.json` against the
   exported file (`pptx_inspect.py`) and the deck source: kinds = slide title, body text, other text, list
   (bullets/numbers), table, chart (native), chart (extended), shape, line/connector, group, diagram, picture,
   link, presenter notes, footer/slide number; outcomes = native, editable but changed (say how), picture,
   dropped. Per export mode. With one line per kind on what a Keynote user can and cannot edit. Things the probe
   cannot tell (the scripting dictionary has no chart data, no links, no text alignment, no bullets) are read from
   `back.pptx` instead (what Keynote wrote back shows what it understood) and marked "from back.pptx"; what neither
   shows is "not run: needs the user interface" with the exact thing to check, appended to
   `$W/grades/ui-checks.md` (deck, mode, slide, object, what to read in which inspector).
3. `$W/grades/<family>/findings.md`: one section per finding (not per slide), most serious first, id
   `<PREFIX>-NN` (your prefix is in your task). Each: title; grade; where seen (ver, deck, mode, slides);
   **the smallest OPF that shows it** (cut the deck down to one slide and the fewest keys, validate it with
   `$W/bin/opf-036 validate`, keep it under ~40 lines, save it as `$W/grades/<family>/min/<id>.opf.json`; you cannot
   open it in Keynote yourself, so say "minimal deck not yet opened in Keynote" and add it to
   `$W/grades/reopen-list.txt` as a line `<path-to-min-deck>\t<id>`: the supervisor has it built and opened);
   what OPF's preview draws; what Keynote draws; what PowerPoint draws if the repository's notes say (cite the
   file); what 0.35.1 did in Keynote (seen in `$W/keynote/0351/...` or "no 0.35.1 run"); main; the cause if you
   found it (the part and element of the `.pptx`, and the place in `$W/src-036/packages/pptx`), marked **inferred**
   unless proved; whose it is: "OPF's file is wrong" or "the file is valid and Keynote reads it differently"; and
   a proposed experiment (an XML edit that would prove the cause or fix it), which goes to
   `$W/grades/experiments.md` as `<id>: <file> <slide>: <edit>` for the experiments agent.
   Also a section **Improvements**: what OPF could write differently so more arrives native or closer, each with
   what it would cost PowerPoint (say "unknown" if you cannot tell) and whether an existing export flag already
   does it (`--body-text native`, `--typefaces safe`, `--slide-numbers static`, `--charts picture`,
   `--smart-art shapes`, `--diagrams picture`).
   And a section **Known, confirmed in passing**: each known difference you met, one line: still shows / no longer
   shows (that is a finding), with deck and slide.
4. One labeled sheet per finding and per improvement: `$W/evidence/sheets/<id>-<slug>.jpg` built with
   `sheet.py`: panels labeled inside the image with program (OPF preview / Keynote 16.0), OPF version, export
   mode, and a caption saying what to look at, with a red frame on the spot; for changelog rows a three-panel
   before/after: Keynote with 0.35.1, Keynote with 0.36.0, OPF's 0.36.0 preview. Read your sheet once to check the
   frame is on the spot. Keep each under ~600 KB.
5. `$W/grades/<family>/SUMMARY.md`: counts same/small/wrong per deck and mode; every wrong slide with its sheet;
   for changelog families the result per matrix row (passed / finding id / not run + why); what you did not look
   at.

Say for every statement whether you saw it or infer it. American English; Keynote's, PowerPoint's and DrawingML's
own names; no other vendor's slide library named. Final message to the supervisor: the counts, the findings as one
line each with id and whose it is, the improvements, what was not run, and the paths.
