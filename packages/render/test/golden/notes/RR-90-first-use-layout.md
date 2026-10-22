# RR-90 first-use layout (core opf#717)

Core opf#717 combines three layout changes that the first-use testers found: RR-93a (the tag follows `titleAlignment`; a rich cell in a numeric column keeps the column alignment; `TableCellStyle.bold`), RR-91 (header and footer zones sit on the content inset, three columns with a 2% gutter, an empty zone lends its width) and RR-90 (table cell text is the 25 px body size and the whole table shrinks together toward the floor). The renderer runtime is unchanged: it draws what core composes.

## What moved

- **Unit tests.** `item-alignment` and `design-preview` expect the tag at the title's anchor on a content slide (the subtitle keeps `contentAlignment`); `design-fields` expects the footer image at the content inset (57.6 px) and the header text ending at 1222.4 px; `chart-table-data` has the new digest of the traced `table-styled` SVG (`b0bbca64...`, was `d5d091b9...`), the only one of 31 that moved.
- **Template goldens.** 40 of 495 slides change, all in the table groups: `table 1-3 short`, `table 1 long`, `table-beside 1-6 short`, `table-beside 1-2 long` and 28 pages of the paginated tables. No other template changes. The new baseline `layout-templates-rr90-first-use-layout.json` is selected when the core table text size is above the pre-RR-90 16 px (`scripts/template-baseline.mjs`, `tableTextSize()`), whatever the metric default; the centered and legacy baselines stay byte-exact for the older cores. Candidate generation compares with the centered baseline.
- **Example goldens.** The ordinary corpus is compared with core's `golden` fixture (`ci.yml` `golden-override`), regenerated on core's branch with `regenerate-core-golden`. The renderer's own ordinary example baselines are not touched; after the roll, open the usual renderer baseline PR.

Local macOS checks reproduced the 455 unchanged template slides byte for byte, so the changed set is the table slides only. The candidate baseline is written by the `regenerate-candidate-goldens` workflow, not copied from a local run.
