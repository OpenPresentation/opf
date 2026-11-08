# Decisions made for the owner on 2026-11-07 (all vetoable)

The owner was away and asked the supervisor to decide and keep going. Each line can be reversed. Most also appear in the relevant burndown progress log and PR body.

## Release and process
- Everything goes into v0.33.0 that is reviewed by the integration cut (the owner's words: "put it all in v.33"). The rest goes into v0.34.0.
- Batching: reviewed PRs are folded into wave integration PRs to save CI (the owner asked: "can't you batch changes more effectively").
- Release blockers: PowerPoint defects on Windows or Mac in supported features. LibreOffice results do not block.
- `.mcpb` attached to the GitHub release (sites inventory, A7): moved to 0.34.0, so the 0.33.0 release pipeline isn't touched right before it runs.

## Qualification (RR-105, RR-106)
- RR-105 Windows findings:
  - Finding 6 (flipped shape text) and finding 3 (academy example): fixed for 0.33.
  - Finding 5 (histogram rounding, Pareto axis): fixed by the charts work.
  - Finding 2 (native-body card overflow) and finding 4 (small-run title offset): fixed in #1114 for 0.34.
- Academy example (#1095): the chart-pointing ring and arrow are removed, and the highlighted bar carries the emphasis. Overlays can't anchor to a data point; that's #1113.
- LibreOffice is "experimental" in all public wording; promotion is the owner's call. The nightly LibreOffice leg is non-blocking and lives in `nightly.yml`.
- The default export does NOT switch to `charts: "picture"` for LibreOffice; the docs tell LibreOffice users about that option instead.
- `opf-preview-fonts` ships the fontconfig aliases (#1132).
- Approved public LibreOffice wording (plain text, no badge): "Opening OPF's PPTX in LibreOffice Impress is experimental; OPF checks it nightly in LibreOffice 26.8 on Linux. With OPF's open fonts, or a `typefaces: "safe"` export, text, lists, images, tables and common charts open complete and inside their boxes. Treemap, waterfall, funnel and box-and-whisker charts need `charts: "picture"`."

## Layout harvest
- LH-184:
  - Two columns at the same size beat three narrow ones.
  - One column wins only within the 70-character measure, or when it's at least 10% larger.
  - A 14-item long list becomes 2 columns at 23 px rather than 1 column past the measure at 24 px.
- LH-186: a long agenda on `agenda-split` moves to the automatic grid at the larger size, and its step badges and side title give way. Condition (met in #1133): the paginated FAQ pages keep columns.
- LH-75:
  - A table beside its note may wrap a cell onto two whole-word lines instead of stepping down.
  - The table and note then grow together.
  - b15 s23 and s41 stay open.
- LH-138: the closing's contacts stay a stacked list at 37 px, not a 19 px row.
- LH-149: dense comparison options stay at 18 px.
- LH-171: a list whose labels are short phrases (6 words or fewer) is ruled when a sibling list is.
- LH-173: a step label steps down by the least amount that keeps its word whole.
- LH-174: an entry without an icon keeps a bullet, centered in the chip column.
- LH-46 ships in a modest form: a lead over a balanced grid, at the same size. Cards would cost a half step on cardless decks, and growth doesn't fire at 66% fill.
- LH-102: grow first (automatic bodies up to 56 px), then center. Where LH-48's 60% target blocks growth, it only centers.
- LH-69:
  - No placeholder icon on tiles.
  - A short sentence keeps its bold heading.
  - Decks with cards keep their cards.
- LH-73: the caption form is not built, because Claude Design's caption sets the text at about half the size.
- LH-61: closed; nothing is left.
- LH-30: color variables and built-ins don't count toward "all unfilled".
- LH-187: side-portrait team cards take their whole cell, with the portrait up to 0.6 tall for its width.

## Charts
- LH-175: keep every series as clustered columns, rather than drawing a Pareto chart of the first series only.
- LH-176: the preview follows PowerPoint's 150% gap rule.
- RR-105 finding 5: the preview follows PowerPoint's rounding.
- LH-182: fill the hole rather than move the motif.
- LH-93: the set takes its narrowest plot width.
- LH-110: number words are labeled in digits.

## Shapes and diagrams
- SH-10:
  - Text only grows (up to 43 px, filling at most 60% of the text box).
  - Siblings take the smallest size any of them reached.
- SH-12 (DOT):
  - DOT's default ellipse draws as a stadium shape.
  - DOT colors, fonts and sizes are ignored; the deck decides.
  - `dir=back` reverses the edge.
  - Arrow types map to arrowhead, circle, cross or none.
  - Layout engines other than dot are refused.
- SH-13 (PlantUML):
  - `group` becomes a box with a note.
  - `==` dividers become notes over every participant.
  - Use-case boundaries are one level deep.
  - Gantt days are numbered from 1 without `Project starts`.
  - Styling is ignored.
- SH-08:
  - Nested entries keep their level.
  - The inverted pyramid imports as an ordered list (#1128 tracks a direction option).
  - Large front overlays count as the slide's body, so the title sits on top (`OVERLAY_BODY_SHARE = 0.2`).
  - Overlay text keeps OPF's sizes.

## Sites
- Reword the banned vendor name in openpresentation.org's frozen schema copies (0.28.0 to 0.32.1), and remove it from the opf-v0.11.1 release notes. The owner's "appears nowhere" rule wins over the site's freeze rule.
- Remove every support, gap and "in progress" status statement on pptx.gallery (the owner's no-badge rule).
- Add a pptx.gallery shapes browser (#171) for 0.34.
- The pptx.gallery deployed-asset check retries a bounded number of times and never follows a redirect (#170, merged).
