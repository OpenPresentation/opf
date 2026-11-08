# Native wrapped title safety margin (RR-105 / #1127)

Branch `codex/rr-105-native-title-wrap` starts from fresh main and merges the approved v0.34 preparation `fed72f2fe6f40b22a8c9cc612e628a6a9ad2edc6`. It contains only the native title follow-up to #1114. Do not push this source branch after the coordinator folds it.

The plain-string wrapped title path now uses the approved native body wrap planner. Every measured line leaves 1% of the original title width free; the next word overruns by at least the same amount. Its horizontal box stays inside the heading area, or the automatic heading's horizontal content frame, and the slide. A heading wider than the body frame keeps its own authored box as the conservative boundary. Font size, line pitch and alignment anchor are preserved. No width that meets both tests means measured title lines plus `native-body-fallback` / `tight-wrap`.

Decision (vetoable): the heading area is a hard boundary. Preserve source words and measured breaks through a fallback rather than shrinking type or allowing a native box to intrude into another region. This affects only `bodyText: "native"`; preview geometry and default measured export remain unchanged. Goldens must not change.

`rr-105-native-title-wrap.mjs` composes the whole bundled example corpus with the Office visual font profile. It finds 50 eligible wrapped titles: 49 native, including 31 whose old exact-width box violated the margin, plus one necessary measured fallback (`layout-sampler` slide 1). Archive controls cover all three alignment anchors, exact native frame, unchanged font size, no autofit and current-content import. The previous native title/body regression also passes.

Native PowerPoint acceptance is owed. The coordinator owns COM, including actual line-text comparisons on the wrapped-title corpus and a before/after sheet. Do not use the qualification harness's forced 1280×720 aspect for decks with another canvas: preserve each input's dimensions.
