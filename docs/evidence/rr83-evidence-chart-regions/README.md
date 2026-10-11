# RR-83: readable generated Evidence Pack charts

This is a fixture migration correction, not a renderer geometry change or golden promotion. The frozen candidate mapped every generated chart + quote + metric Evidence Pack to dashboard. When the authored deck design requests vertical content, dashboard's charts grid stacked the chart and quote into two shallow strips. The pie case was 844×89.95 pixels; chart-beside makes its primary chart 486.4×399.833 pixels beside an intact quote and metric.

The generator now chooses dashboard for horizontal decks and chart-beside for vertical decks. Exactly 20 of 100 generated decks change; the 20 horizontal Evidence Packs remain dashboard. Other generated files remain identical. Each changed deck alters only the Evidence Pack layout reference and the corresponding embedded dashboard/chart-beside catalog record. All authored slide content, order, deck design, non-layout catalog records and other slides are identical. `comparison.json` lists every affected key and canonical document/image hashes.

The before/after PNG and traced SVG pairs here use the same renderer, core, gallery, sample and scale0.5; only the layout reference changes. They cover filled radar, pie and radar. They are render evidence, not native Office or cross-platform font proof. Root independently reviewed all ten old text-3x cases; conversion review independently checked all ten old list-4x cases, including readable chart, intact quote/metric, exact deck equality outside the layout reference and no overflow. The preserved inputs are recorded in comparison.json. The final generated documents additionally embed the chart-beside record.

Reproduce with final gallery2 locally registered:

```sh
node scripts/generate-example-suite.mjs --check
node --test packages/javascript/test/generated-evidence-layouts.test.mjs
pnpm check:changed --base 53925383
pnpm test
```

The package regression exercises every generated Evidence Pack: exact chart/quote/metric authored order, actual region binding, chart height at least half the slide and width/height below2 for vertical cases, quote beside chart, metric after quote, and in-bounds boxes. It retains the horizontal choice. No migration shims or historical IDs are used.

Local acceptance uses gallery2 e0a7eee and the final renderer/PPTX candidate graph explicitly; registry dependency/lock reconciliation remains the release owner's gate. Initial locked installation selected gallery1, causing schema-mismatch checks; explicit local gallery2 links resolved that environmental mismatch. No lock or dependency metadata was fabricated.

All strict example/template golden assertions and committed baselines remain unchanged. The separate combined renderer qualification found171 migrated example deltas and26 gallery2 imageFit deltas; these require owner review with the corrected20 examples before any promotion. This correction does not assert native Windows, solve the separately investigated macOS subset pixel gate, or authorize a release.

Validation on the integration candidate: required changed checks pass; the full core package has2,296 passed/one existing skip plus six standalone scripts, and the CLI has169 tests,95 command checks and18 file-case checks. After replacing stale ignored gallery support files with the exact gallery2 candidate, catalog19/19+manifest, spec integrity and schema/example checks pass. The full root command still reports two owner-managed gates: strict generated gallery tracker freshness and the unpromoted registry golden corpus digest. They are retained, not suppressed. The clean PR stacks only this correction on594 (53925383), excluding the held585 font-policy delta; the comparison inputs separately identify the policy integration used for visual qualification.
