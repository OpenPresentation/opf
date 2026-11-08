# RR-105 waterfall axis proof

The hidden native waterfall axis now carries the shared running-total min/max/majorUnit. [Qualification preview, slide 19](layout-harvest-19.png) is unchanged. [Native input manifest](native-input.json) binds the fresh qualification PPTX and preview hashes to the changed source files; the coordinator completed the PowerPoint numeric-axis recheck.

All 130 SVG pages in the seven affected decks, with portable and measured office fonts, are byte-identical before/after. [Hashes](../../handoff/2026-11-07/rr-105-waterfall-preview-hashes.json) and [capture script](preview-proof.mjs) retain the proof. Run the script from repository root with an output JSON path, first on d26031b98ff9316d479f8db7a383511371cab4a6, then on this fix.

An additional [54-case category reserve comparison](category-reserve-proof.json) against the preparation renderer covers short, two-line and unbroken labels; 3/5/10 categories; narrow/full charts; and default/data-label-off/titled value axes. No SVG changed. No golden or archive hash was edited or regenerated.

Native PowerPoint opens all 20 qualification slides cleanly. [Read-only before/after metrics](native-metrics.json) confirm min 0 in both and maximum 9,000,000 before → 10,000,000 after, with unchanged chart frame `[43.2, 110.61, 873.6, 386.19]` pt. XML explicitly carries majorUnit 2,000,000; COM returns null for that property on this ChartEx build. [Native slide 19](native-slide-19.png) confirms the corrected scale.

The inner plot still uses Office's automatic margins: its inferred height is about 437 px against the preview's 395 px. The native ChartEx PlotArea/ChartTitle API returns zero dimensions and 1.4 pt placeholder origins, so it cannot qualify exact inner bounds. One native non-overlay Cost title is emitted, with no duplicate caption. The preview separately reserves a caption band and label headroom. No guessed frame inset is applied, and no exact native inner-plot parity is claimed; this is the existing ChartEx automatic-plot limitation already recorded by LH-110. The coordinator accepted the supported numeric-axis fix.
