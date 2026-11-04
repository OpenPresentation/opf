# LH wave 6: display titles, featured cards, pricing, FAQ rows, chart grouping, sizing fixes

Wave 6 of the layout harvest merges nine reviewed branches into one, on main after wave 5 (opf#1010): LH-139, LH-140 and LH-146 (opf#1011), LH-145 (opf#1015), LH-141, LH-142 and LH-143 (opf#1012), LH-144, LH-149, LH-150 and LH-151 (opf#1016), LH-130 and LH-148 (opf#1013), LH-135 and LH-136 (opf#1014), LH-131 and LH-137 (opf#1018), LH-133 and LH-134 (opf#1017) and LH-152 (opf#1020). Each branch's PR body explains its change; this note records the combined baseline and the rules the integration decided where two features meet.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, the three review sheets read, then `--promote`d.

- **51 of 468 slides moved**; no page is gone or new (468 slides).
- Attribution, checked by running `--update` on each constituent branch that moves a template slide and comparing the candidate SVG and PNG hashes: every moved slide is identical to the one branch that moves it.

| Feature | What moved |
| --- | --- |
| LH-130 (display titles, opf#1013) | cover 1 to 6 short and long, section 1 to 6 short and long, feature cover carded and mirrored (26) |
| LH-149 (half steps, opf#1016) | agenda-split 3 long, text 4 long, list 3 long, pillars 5 long, comparison 4 long, timeline 4 long, metrics 5 long, image-beside 4 long, chart 4 and 5 long, chart-beside 4 long, table 4 and 5 long, table-beside 4 and 5 long, code 4 and 5 long, hero 6 long (18) |
| LH-144 (page caps, opf#1016) | `paginated agenda 5 long page 3`, `agenda-split 5 long page 4`, `list 5 long page 3`, `process 6 long page 5`, `timeline 6 long` pages 2 and 3, `table 6 long page 5` (7) |

- LH-131, LH-133 to LH-137, LH-141 to LH-143 and LH-152 move no template slide: the fixture has no pricing tier, one-word pillar, featured pair or set, delta, dark summary list, question, glossary, lone numbered list of five or fewer, described agenda, stacked bar chart, four-digit number or label before a group.

## Rules the integration decided

- **One guard.** Every wave 6 rule is a guarded rule of `guardedCompose` and `composeVariant` (`half-steps` first; `featured-card`, `pair-rows`, `numerals`, `delta-pill`, `check-tiles`, `tier-cards`, `pillar-words` in the list), and LH-149's half-step discount (`trackQuality`) applies to every comparison of arrangements the other branches added: LH-131's and LH-137's drawing check, LH-134's numerals in LH-07's whole-slide check, LH-135's tier cards against two cards.
- **The featured tier is a tier card on the surface.** A pricing tier marked "most popular" (LH-131) draws the emphasis surface over the same card box as the other tiers (LH-135): one top edge, one height, one inset (narrative n20).
- **A label-headed group is no tier.** A group headed by a short label (LH-152's group eyebrow) is not drawn as a tier card, whose card has no band for that eyebrow.
- **A group eyebrow on a cell card sits inside the card.** LH-152's eyebrow of a group that LH-131 draws on one card (a featured set's cell or the surface) goes inside that card, over its blocks.
- **Accent rules.** LH-136's rule over a display word keeps its own thickness; LH-133's rule over a question cell is `LIST_ACCENT_RULE_WIDTH` thick; both in the tag's color on their backdrop.
- **Numerals.** LH-146's en-US run for a Latin numeral in a right-to-left deck also covers LH-134's numerals beside ruled rows.
- **Grouped deltas.** A numeric metric delta groups its thousands by the deck language, as LH-141 groups the value beside it.

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs` (both fail locally, as expected). The constituent PRs list their own moves: opf#1012 four LH-142 stacked bar slides (`gallery/business-functions/model-governance-review#6`, `pricing-and-packaging-decision#2`, `gallery/government/police-training-program-update#2`, `gallery/industries/food-bank-distribution-capacity-plan#2`), opf#1016 three example slides (grid-spans 2, product-roadmap-decision-review 6, airline-disruption-recovery-review 6), opf#1018 every metric with a delta (its pill) and dark one-list slides with a variant (tiles), opf#1013 the covers and sections of the examples. The combined set is expected to be their union.
