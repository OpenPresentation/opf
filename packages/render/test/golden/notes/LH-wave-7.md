# LH wave 7: icons, statements, picture text placement, closing, portraits, grids, chart follow-ups

Wave 7 of the layout harvest merges eight reviewed branches into one, on main at v0.32.1: LH-156, LH-157, LH-38 and LH-74 (opf#1028), LH-153, LH-154 and LH-94 (opf#1031), LH-14 (opf#1035), LH-158 (opf#1030), LH-155 and LH-138's caption half (opf#1033), LH-09 and LH-69 in part (opf#1034), LH-75 in part and LH-05 (opf#1032) and LH-132 (opf#1036). Each branch's PR body explains its change; this note records the combined baseline and the rules the integration decided where two features meet.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, the three review sheets read, then `--promote`d.

- **49 of 468 slides moved**; no page is gone or new (468 slides).

| Feature | What moved |
| --- | --- |
| LH-09 (statements, opf#1034) | statement 1 to 6 short and long: start-aligned under the accent rule; `statement 1 short` draws its three-word block at display size under a running head (12) |
| LH-09 (short messages, opf#1034) | the lone three-word text of `text`, `two-column`, `three-column`, `pillars`, `comparison`, `image-beside` and `hero` 1 short, at display size (7) |
| LH-155 (closing, opf#1033) | closing 1 to 6 short and long: the stack at the foot, start-aligned, under the accent rule where it costs no body size (12) |
| LH-74 (a picture alone on a card, opf#1028) | gallery 2, 4 and 6 short and long, team 1 to 6 short and long: each picture fills its card, rounded at the card radius (18) |

- LH-14, LH-38, LH-05, LH-75, LH-94, LH-132, LH-153, LH-154, LH-156, LH-157 and LH-158 move no template slide: the fixture has no icon, furniture, compact grid of short texts, table beside a note, chart, person group or quote photo, flow citation, metric with a unit, or measured picture.

## Rules the integration decided

- **One guard.** Every wave 7 rule is a guarded rule of `guardedCompose` and `composeVariant` (`icons`, `icon-chips`, `title-rule`, `statement-message`, `display-message`, `table-note`, `compact-grid`, `portraits` in `GUARDED_RULES`; `icons` and `icon-chips` also in `DRAWING_RULES`; `compact-grid` and `title-rule` in `PLACEMENT_RULES`), and LH-149's half-step discount applies to every comparison they add.
- **One mechanism for text on a picture.** A closing's stack anchored low is placed by LH-158's picture-text scores, like a cover's heading group: composed at the foot, its text's ink scored there and at the middle and top of the content box, and composed again where it reads better; `textPlacement` picks its anchor; unmeasured it is centered. Wave 6's calm-band helper (and LH-155's split of it) is gone.
- **Statements and the closing.** A closing is never a statement message (its details region is supporting); LH-09's accent rule over a statement title stays under LH-155's guarded `title-rule`.
- **A team's pictures are portraits.** LH-74 never makes a person's picture fill its card, with the portraits rule or without it, so LH-132 compares its portraits with the avatar and an authored shape is kept. A person's group icon gives way to the portrait card and is reported `icon-dropped`; a team kept on avatars draws it.
- **Icons never cost text size.** Lists with icons in a compact grid, metric rows with units and icons (LH-157's one size), a lone metric statement with an icon (LH-09) and a lone label with an icon (LH-69) keep the sizes they have without icons; a lone label's short rule starts where its word starts, after the chip. Icons take the theme's primary, not a chart series color (LH-94).

## Example corpus

The `golden` workflow must regenerate `test/golden.mjs` and `test/golden-gate.mjs` (not run locally). The constituent PRs list their own moves: opf#1031 29 raster baselines in 20 example decks (thousands grouping and LH-94's series colors; `wave7/lh-153/golden-changed.txt`), opf#1028 every slide with a header or footer (LH-38) and example pictures alone on a card (LH-74), opf#1034 statement slides and lone short paragraphs, opf#1033 closing slides, opf#1032 `technical/dynamic-composition.opf.json#1` and `technical/layout-sampler.opf.json#39` and `#40`. opf#1035, opf#1030 and opf#1036 move none (no example has an icon, a measured picture, a person group or a wide quote photo). The combined set is expected to be their union.
