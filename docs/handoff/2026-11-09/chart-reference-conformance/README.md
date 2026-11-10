# LH-110 reference overlay export conformance

Source 957f177427c5dda62574f4287cf3a1ff2cd2096e normally includes reviewed staging e7. Actual leaf CI42707671494 caught host locale collation in ownership and missing native text-box flags for overlay labels. This new leaf changes only the existing isTextBox option and code-unit ordering, plus regressions, fragment and progress. No schema, title inference, vendor, geometry or public API change.

Both corrected-selector regressions fail on unchanged production code; after the repair all43 reference controls pass. Existing native XML conformance passes148 example decks/965slides; existing Windows determinism passes45children/43cases/87guarded files. Import controls retain current values, styles and no duplicate shapes for horizontal and singleton charts. The initial chart0-vs-chart1 test-selector error is preserved separately; it is not a product regression. Biome ignores both existing source/test paths, checks0files and returns1; that receipt is preserved, not called a lint pass.

Commands ran on an e7-derived working tree against the final exact source/test bytes before source commit existed. Manifest protects those final Git blobs and all prior-to-fix/setup/after logs. Root observed actual native40486 and determinism15301 exit0. Replay: node docs/handoff/2026-11-09/chart-reference-conformance/verify.mjs.

Required full mapped/CI qualification remains in the single assembled wave. Native XML conformance is not an actual Office/edit/save/reopen or paint claim; original current native/golden/release gates remain open.
