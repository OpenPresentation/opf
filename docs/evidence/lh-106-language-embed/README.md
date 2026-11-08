# Selected language font embedding

The [proof](svg-proof.json) compares every slide of multilingual-slides and localized-timeline with the gallery registered against maintained embed() output using an explicitly empty registered catalog list. All five SVGs are exact. Deck- and slide-language font/Google-scheme controls are in the focused core/render tests.

[Catalog-backed Arabic](catalog-backed.png), [old standalone missing-record control](old-standalone-control.png), [fixed standalone Arabic](fixed-standalone.png). The old control reconstructs the former embed walker’s exact omission by removing only the slide-selected font record; it is not a historical PPTX/source-version export. Core intended size stays 54px; actual serialized title size changes 54→34.5→54px across these panels. The fixed image is byte-identical to the catalog-backed image and has no new clipping. The body also regains its authored selected script font and intended scale.

Decision (vetoable): embed the selected record instead of accepting fallback font/scale. Generated evidence comes from [source](generate.mjs). No goldens, native Office execution or proprietary font bytes are included.
