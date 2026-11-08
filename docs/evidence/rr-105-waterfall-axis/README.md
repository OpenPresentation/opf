# RR-105 waterfall axis proof

The hidden native waterfall axis now carries the shared running-total min/max/majorUnit. [Qualification preview, slide 19](layout-harvest-19.png) is unchanged. [Native input manifest](native-input.json) binds the fresh qualification PPTX and preview hashes to the changed source files; the coordinator owns PowerPoint recheck.

All 130 SVG pages in the seven affected decks, with portable and measured office fonts, are byte-identical before/after. [Hashes](../../handoff/2026-11-07/rr-105-waterfall-preview-hashes.json) and [capture script](preview-proof.mjs) retain the proof. Run the script from repository root with an output JSON path, first on d26031b98ff9316d479f8db7a383511371cab4a6, then on this fix.

An additional [54-case category reserve comparison](category-reserve-proof.json) against the preparation renderer covers short, two-line and unbroken labels; 3/5/10 categories; narrow/full charts; and default/data-label-off/titled value axes. No SVG changed. No golden or archive hash was edited or regenerated.
