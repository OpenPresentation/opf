# Native diagram qualification coverage

The coordinator found that the maintained release corpus still named0.33 and omitted DOT/PlantUML despite their schema/runtime support on the034integration. The new schema-derived regression fails first for missingdot; adding the existing five-slide DOT and eight-slide PlantUML source decks closes the coverage gap. Existing Mermaid and every033witness remain intact.

Vetoable: retain the baseline witnesses and add whole default-native decks rather than cherry-picking easy slides. Allnative opening/shape/visual/no-overflow/no-shrink/saved-import checks stay mandatory. Custom arrow paths do not gain a false glued-connector claim. Run only the maintained safe owned-copy worker for Office; UI checks stay notrun. This PR adds no parser/layout/product-output change, raster hash, tolerance or live SmartArt domain. Actual native observations are still owed.

Build: `node scripts/native-acceptance/qualification/build.mjs --out C:/opf-work/qualification034-diagrams-01 --only dot-diagrams,plantuml-diagrams`. The final assembled source and independent frozen worker identities must be sealed separately; this source PR does not certify its own native result.

Independent review1184found a guard weakness: a syntax only on an unselected slide could count as qualified. The regression now visits exactly feature.slides when present, refuses out-of-range selection, and explicitly proves DOT/PlantUML outside the selected native slides cannot certify coverage. Whole-deck and missing-roundtrip controls stay distinct. No product/source input is changed.
