# LH wave 5: scrim, step badges, rows and eyebrows, template fill, metrics, chart marks, continuation, editor, PowerPoint layouts

Wave 5 of the layout harvest merges nine reviewed branches into one, on main after wave 4 (opf#1000): LH-96 (opf#1001), LH-97, LH-123 and LH-126 (opf#1002), LH-127, LH-39 and LH-128 (opf#1003), LH-99 (opf#1004), LH-08, LH-32 and LH-50 (opf#1005), LH-125 and LH-107 (opf#1006), LH-07 (opf#1007), LH-02 (opf#1008) and LH-129 (opf#1009). Each branch's PR body explains its change; this note records the combined baseline and the rules the integration decided where two features meet.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, the three review sheets read, then `--promote`d.

- **57 of 468 slides moved**; no page is gone or new (468 slides).
- Attribution, checked by running `--update` on each constituent branch and comparing the candidate SVG hashes:

| Feature | What moved |
| --- | --- |
| LH-129 (template fill, opf#1009) | cover 1 to 6 short, statement 1 to 6 short and 1 long, closing 1 to 6 short and 1 long, quote 1 to 6 short, process 1 short and 1 long, timeline 1 to 3 short and 1 long, feature cover carded and mirrored, `paginated process 6 long page 5` (35, each identical to opf#1009 alone) |
| LH-07 (step badges, opf#1007) | agenda 1 to 6 short and 3 to 6 long, agenda-split 1 short and 1, 4, 5, 6 long, `paginated agenda-split 5 long page 4` (16, each identical to opf#1007 alone) |
| LH-128 (pagination at sentence ends, opf#1003) | `paginated timeline 4 long` and `6 long` pages 1 and 2, `paginated table 6 long` pages 4 and 5 (pages 2 and the table pages identical to opf#1003 alone) |

- Two slides differ from every branch alone: `paginated timeline 4 long page 1` and `paginated timeline 6 long page 1`. LH-128 leaves a lone timeline on page 1, and LH-129's lone-timeline growth then sets its labels two type-scale steps larger. It fits with no finding; page 2 of the same samples keeps its size because a larger step would wrap a label. The sizes of one paginated slide's pages are not shared yet (LH-144).
- LH-02, LH-08, LH-125 and LH-127's unit gap move no template slide (none has a picture background, a tag, a short label before a paragraph, a stacked bar chart or an inline unit in the fixture).

## Rules the integration decided

- **One guard.** `metric-figure` (LH-39) is tried on top of the rules the guard kept; `eyebrow` (LH-50), `list-rows` (LH-08) and `step-badges` (LH-07) are in the one list of guarded rules, after LH-112's display size. A slide that composes no metric is not composed again for the figure rule (output unchanged; the corpus composes in 1.13 times main's time instead of 1.33).
- **Badges win over automatic rows.** A list in a `sequence` region keeps LH-07's badges; `fitList` draws rows instead of badges, so such a list is not given LH-08's automatic rows. b10 s32 (an agenda whose lists both features claim) draws as opf#1007 draws it.
- **The tag keeps 22 px.** LH-129 capped a grown tag at 21 px over its 16 px role; LH-32 sets the tag at 22 px, which is now also its display size, so a cover or section grows its title and subtitle and keeps the tag. b02 s22 and the narrative n06 to n08 draw tag 22, title 75 and subtitle 37 px.
- **Whole-slide badge check after the fill.** LH-07's second settle without badges includes LH-129's and LH-48's growth, so the comparison is between the two fully settled slides; the automatic scrim (LH-02) is computed over the slide that is kept.

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs` (both fail locally, as expected). The constituent PRs list their own moves: opf#1003 the 36 inline-unit slides, opf#1005 the slides with a tag, a label before a longer text or a described list of short labels, opf#1006 21 chart slides, opf#1007 the sampler's `layout-process`, opf#1008 the six "Field Context" picture slides and `technical/color-variants` #6, opf#1009 the covers and timelines of the gallery examples. The combined set is their union plus the slides where a tag and LH-129's growth meet (every cover and section with a tag).
