# RR-85 metric centering

Core #683 changes only the omitted metric alignment fallback from left to center. Explicit alignment remains authoritative. The renderer runtime is unchanged.

The historical gallery alignment regression now compares explicit center with explicit left, and checks explicit left/center/right anchors for every visible metric part. The 57 allocation and non-text geometry checks remain intact.

The existing 495-slide template baseline stays byte-exact at `layout-templates-rr20-array-areas.json`. A distinct `layout-templates-rr85-metric-centering.json` is selected only when the shared `layoutMetric` API actually defaults to center; unknown defaults and a missing selected fixture fail. Candidate generation alone may compare against the old approved baseline. No version-only inference, tolerance, keyset, scale or count changes are used.

Local checks report 23 expected changed template slides: all 12 scorecard samples, 10 dashboard samples and the mirrored hero feature. Official generation and visual review are pending; no local hashes have been promoted. The maintained candidate workflow must reproduce unchanged main, bind exact core/renderer/catalog source commits, and write the new fixture through its artifact-only trusted tooling job. Use baseline name `rr85-metric-centering` and selection `templates`.

The fixture's catalog source is `146e477196405fe7d2283008f6fad34c12742599`. The supervisor verified its catalog tree equals the registry Gallery 3 release `940633a92c0c7d3339e59447d08ba6382ef12410`; catalog source identity remains separate from the published package identity. These regression checks do not establish native PowerPoint or Keynote acceptance.
