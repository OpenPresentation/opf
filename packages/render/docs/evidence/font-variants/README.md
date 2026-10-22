# Exact weight and physical face selection

This unpublished coordinated source increment follows the accepted font-preparation checkpoint. It resolves all nine base faces by their OpenType preferred family while preserving their legacy names for actual browser/native selection. The [original three weight and three native-flag gaps](../font-variants-before/README.md) remain intact. The [corrected probe](resolved-selection-report.json) records zero of those mismatches with the same existing font files.

The font provider adds optional `fontFace` metadata to resolved text styles: physical family plus boolean bold/italic style-link flags. Logical numeric weight remains available for layout and CSS. The coordinated PPTX source uses the physical flags rather than deriving bold from `weight >= 600`. Explicit caller family overrides remain authoritative; ambiguous preferred-family slots reject. Approximate unavailable weights remain visible in resolution records. No new font pack, embedding, source rewrite, system installation or publication is included.

[Node 20](font-variants-node20.json) and [Node 24](font-variants-node24.json) checks bind the nine resolutions to actual font bytes, advances, outlines and style-link metadata. They cover legacy names, custom overrides, user aliases, duplicate ambiguity, returned-metadata mutation and approximate unavailable weights. [Node 20 browser](font-variants-browser-node20.json) and [Node 24 browser](font-variants-browser-node24.json) checks load all nine exact faces offline and match shaped advances within 0.1 pixels, without page errors or remote requests.

The seven paired [slide comparisons](slide-comparisons) use the same [source](slide-source.opf.json) before and after the change. All seven were inspected: scalar headings/text, rich styles, a rich table, quote/footer, code, metrics and lists remain complete. Quote footer and metric weights now use their actual installed faces; source layout/whitespace and the existing palette remain otherwise scoped to these small fixtures. The full renderer suite and unchanged 805-slide estimated-layout baseline pass on Node 24. This is not a new visual-quality baseline or native pixel-equivalence claim.

The matching PPTX test exercises all nine actual family/style combinations across these seven payload slides, deterministic bytes, source preservation, heading/code reimport, legacy providers without metadata and invalid physical-selection diagnostics. Native PowerPoint paint with these exact new selections remains a separate Windows gate. Existing Arabic/bidi/coverage, Akasia/Aptos, font embedding, metric native tab/ink and chart gates remain open.

Reproduce after building and linking coordinated source packages:

```sh
npm run test:font-variants
npm run test:font-variants-browser
node scripts/probe-font-variants.mjs artifacts/font-variant-probe
```

Run the same named script in the PPTX repository for serialized native selections. Candidate package, CI/review and publication gates remain required before calling the increment released.
