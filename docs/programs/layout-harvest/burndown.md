# Layout harvest: burndown and improvement catalog

Goal and boundary: [README.md](README.md). Status values: `todo`, `in-progress`, `done`, `descoped`. Whoever changes an item's state edits its row and appends a log line in the same pull request.

Sources:

- **CD**: the slide-by-slide comparison with Claude Design.
- **SG**: the design guidance of Claude's Slides type.
- **PX**: Claude's pptx skill.

## Built

| ID | Improvement | Source | Package | Evidence |
| --- | --- | --- | --- | --- |
| LH-21 | Layout sampler: one slide per default layout and 13 dynamic compositions; scripts render it and tile contact sheets | CD | examples, scripts | [opf#942](https://github.com/OpenPresentation/opf/pull/942) |
| LH-22 | Full-height cards: a card fills its cell and the region's anchor places the content inside it. Filled cards start half a gap down and share one height and top edge. Pillars, team, two-column and three-column set text at the card's foot; scorecard sets its measures in the middle | CD, SG | core, gallery | opf#942; `layout-harvest.test.mjs` |
| LH-23 | Hero: a text column (title, lead, supporting points) beside a full-height picture bled to three edges | CD | gallery | opf#942 |
| LH-24 | Card inset scales with the card: a sixteenth of the shorter side, from 12 to 24 px, so cards are roomy and KPI tiles keep their room | SG | core | opf#942; `card-inset.test.mjs` |
| LH-25 | Without loaded fonts, monospace text is measured at 0.6 em, so code wraps inside its panel instead of running past it | CD | core | opf#942; `monospace-measure.test.mjs` |
| LH-26 | Layout previews and the sampler carry a subtitle only where slides usually have one, and state their fictional data in a footer | CD | gallery | opf#942 |

## Catalog

| ID | Item | Source | Package | Acceptance | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| LH-01 | Layout background variants: section on accent, statement and quote on light2, closing dark | CD, SG | layout schema, core, render, pptx | A layout's `design.variant` resolves per the README decision; the sampler's section, statement, quote and closing draw on their variant in SVG and PPTX | P1 | todo |
| LH-02 | Automatic scrim under text on a picture background | SG | core, render, pptx | A cover over a photo passes 4.5:1 on the worst-case grey ramp with no author overlay; `opf/text-on-image` notes the scrim | P1 | todo |
| LH-03 | Small single-series charts: direct value labels, no value axis or gridlines, no grey plot panel | CD, SG | core chart options, render, pptx | Charts of 8 or fewer points in one series draw labels in both engines; PPTX import does not write the default back | P1 | todo |
| LH-04 | Top-anchored cards hug their content, then comparison draws on cards without dense options falling under 20 px | CD | core, gallery | `auto-track-capacity.test.mjs` still passes with comparison on cards | P1 | todo |
| LH-05 | Compact grids: short text cells hug instead of spreading over the body | CD | core | A 3 × 2 grid of one-line texts keeps its rows one gap apart | P2 | todo |
| LH-06 | Emphasis surface: one block or group on a dark or accent card or band | CD | schema, core, render, pptx | `emphasis: true` draws a contrasting surface in both engines, with text colours that pass contrast | P2 | todo |
| LH-07 | Numbered step badges and a connector for process and agenda | CD | core, render, pptx | Process draws numbered circles joined by a line; PPTX writes shapes, not a picture | P2 | todo |
| LH-08 | Ruled rows: label and description side by side, and list entries as ruled rows | CD | design key, core, engines | A `listStyle: rows` (or equivalent) design key draws hairlines between entries in both engines | P2 | todo |
| LH-09 | Statement message at display size, lead paragraph in text, decorative quote mark | CD | core, render | The sampler's statement, text and quote match the review page's targets | P2 | todo |
| LH-10 | Prose measure cap of 55 to 65 characters, with overflow into columns | SG | core | No body paragraph in the sampler runs past 75 characters a line | P2 | todo |
| LH-11 | No line break between a number and its unit or % | PX, SG | core | "26 %" and "$4.8 M" style pairs never split across lines | P2 | todo |
| LH-12 | PPTX audit: theme slots and scheme colours, chart text in theme fonts, `txBox` and shape names, zero insets where aligned, stacked `outEnd` guard, secondary-axis combos | PX | pptx | A conformance test over the exported XML of every example deck | P1 | todo |
| LH-13 | Skill updates: outline titles first, a content-to-structure table, vertical budget, placeholders for missing facts, notes as a script | SG, PX | skills | `opf-author` and `opf-layout` teach each rule with an OPF example | P2 | todo |
| LH-14 | Optional named icons on items, metrics and group headings | SG, CD | schema, render, pptx, assets | About 30 bundled icons drawn on a chip in both engines | P3 | todo |
| LH-15 | Horizontal metric for wide, short tiles; hairline rule style for metrics | CD | core, render | A 2 × 2 metric grid draws number left, label right | P3 | todo |
| LH-16 | Duration-proportional timeline for ranged events | CD | core, render, pptx | "Weeks 2–5" spans four times "Week 1" | P3 | todo |
| LH-17 | Deck type scale: fits step down a 4 to 5 size scale | SG | theme, core | Fitted sizes in a deck come from the scale or the floor | P3 | todo |
| LH-18 | Matrix alignment: sibling groups share row tracks | SG | core | Pillars of unequal heading lengths keep descriptions on one line | P3 | todo |
| LH-19 | Info findings: text shrunk far below its role size, four or more identical layouts in a row, straight quotes, centred body text | SG, PX | validator | Each rule has a fixture and a `describeFinding` entry | P3 | todo |
| LH-20 | Pictures-only PPTX export for fidelity | SG | cli, pptx | `opf convert --as images` writes one picture per slide with notes and alt text | P3 | todo |
| LH-27 | Compare about 1000 varied slides with Claude Design and catalog what generalizes | CD | tooling | Every batch reviewed; ideas added here | P1 | in-progress |
| LH-28 | Safe-fonts PPTX export mode | PX | pptx, cli | `fonts: "safe"` maps each family to Office's metric-safe set | P3 | todo |
| LH-29 | Lossy export findings for borders, shadows, SVG and images | SG | pptx | One `opf/export-lossy` family documented in `opf-export` | P3 | todo |
| LH-30 | An optional template group whose variables are all unfilled collapses whole | PX | core | Picture and card go with the text; a validator note says so | P3 | todo |
| LH-31 | Gap and margin audit over composed boxes | PX | core, validator | Info finding for gaps under 0.3 in or margins under 0.5 in | P3 | todo |
| LH-32 | Tag as an eyebrow: caps, tracking, accent colour; descriptions in the secondary tone | SG, CD | core, render, pptx | Sampler tags and item descriptions follow the rule in both engines | P2 | todo |
| LH-33 | Sibling charts of one unit share axis maximum and plot height | SG | core, render, pptx | The dashboard's two charts of one unit use one scale | P3 | todo |
| LH-34 | Image callouts: labels as real text over a picture | SG | schema, core, engines | `image.callouts` draw as text boxes in both engines | P3 | todo |
| LH-35 | Colour never alone: sentiment and trend carry a sign and text; series colours differ in lightness | SG | render, pptx, validator | `opf/chart-color-only` checks lightness; trend draws a glyph | P3 | todo |
| LH-36 | Gallery palette discipline check | SG, PX | gallery tooling | A `check:` script on colour schemes (dark, light, 1 to 2 accents, lightness spread) | P3 | todo |
| LH-37 | Gallery review checklist against slide-design clichés (title underline bars, side stripes, default gradients) | SG, PX | gallery docs | Checklist in `docs/default-catalog.md`; records reviewed | P3 | todo |
| LH-38 | Header and footer sit about half a content margin from the slide edge | SG | core | Furniture rows read as chrome in the sampler | P3 | todo |
| LH-39 | Metric proportions: value about 4× its label, line-height 1, never wraps | SG | core | A wide value such as "$1.24M" stays on one line in a narrow tile | P3 | todo |
| LH-40 | Dense code, quote and metric blocks degrade with a finding instead of failing the export | CD (LH-27 corpus) | render, pptx | The code layout with five blocks of the corpus (batch-13 s29, batch-17 s04) renders and exports in non-strict mode with `opf/layout-overflow`; strict mode still fails | P1 | todo |

## Progress log

- 2026-11-02: program opened from the layout sampler comparison (opf#942, LH-21 to LH-26 built); catalog seeded from the Claude Design comparison, the Slides type guidance and the pptx skill. LH-27 started.
- 2026-11-02: LH-27 corpus generated (844 slides, 18 batches; scripts/layout-harvest-corpus.mjs). Our side renders 841; the code layout at five blocks fails the export on main too (LH-40); a scorecard of nine long measures regressed with cards and was fixed in opf#942 (a block with no room inside its card inset takes the whole card).
