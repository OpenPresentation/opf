# WI-4: type roles, before and after

Sheets from the slide-design audit harness (`artifacts/slide-design/scripts/harness.mjs`, `office` font pack, 169 current-main jobs), before = `main` at `dbc01b02` (WI-1 and WI-5 merged), after = this branch. Each sheet has before on the left and after on the right.

| Sheet | Rule |
| --- | --- |
| `P15-cover`, `P15-gallery-cover`, `P15-auto19`, `P16-mixed-text-bullets-list` | balanced headings; the cover reads "A smaller pilot. / A clearer decision." |
| `P16-*`, `P01-text-default`, `P02-list-default` | prose at 28 px beside lists at 32 px |
| `P17-*` | quote at 40 px, typographic marks, en dash before the source |
| `P21-*` | code at 22 px, panel hugs its content, no wrapping that 18 px avoided |
| `P34-*` | sparse auto slides: reading measure and the 32 px lead size |
| `gallery-before-0N`, `gallery-after-0N` | the 28 gallery layouts |
| `worse-faq-and-dense-comparison` | the two audit decks whose size dropped by one pixel |

## Numbers (169 audit jobs, composed text sizes)

| Role | main | this branch | jobs |
| --- | --- | --- | --- |
| Prose (`text`) | 25 px | 28 px | 171 items |
| Subtitle | 25 px | 28 px | 101 items |
| Lone short prose in an auto region (lead size) | 25 px | 32 px | 7 items |
| Quote body | 28 px | 40 px (one at 36 px, fitted) | 13 |
| Code body | 18 px | 22 px (the narrow three-column code stays at 18 px: 22 px would wrap lines) | 7 |
| Lists, tables | 32 px, 25 px | unchanged | - |

- Composed text sizes that changed: 313; 305 went up, 8 went down.
- The 8 that went down are two audit decks that were already dense: `candidates/comparison/dense-options-before` (20 to 19 px, both options) and `candidates/faq/short-6-before` (24 to 23 px, six pairs). Both fit without diagnostics.
- Geometry diagnostics and text overflows: 0 added, 0 removed over the 169 jobs.
- Titles with a single-word last line: 6 before, 0 after. Seven wrapped headings changed their breaks at the same size and line count.
- Core's 0.19 template goldens (28 templates x 1 to 6 blocks x short and long): 182 of 336 cases changed; 393 composed sizes went up, 30 went down (all "long" stress samples: dense stacked lists and prose now share one size); text-overflow diagnostics 210 to 222 in three overfull samples (`comparison 6 long`, `timeline 4 long`, `timeline 5 long`).
- Layout-template goldens (SVG and PNG): 410 of 491 slides changed.
