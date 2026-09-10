# Physical font style selection

This unpublished source increment consumes the coordinated core/renderer physical face metadata in native text options. A numeric weight such as 600/800 does not imply that the named legacy family should also receive `b="1"`: Roboto SemiBold and ExtraBold identify their native-family style as regular.

The fixture covers seven payload slides and all nine base font files across headings, scalar/rich text, a rich table, quote/footer, code, metrics and lists. Expected native family/style combinations are read independently from the actual font files' OpenType metadata. Source preservation, deterministic output, heading/code reimport, providers without physical metadata and malformed metadata are also checked. Both Node runtimes pass the focused fixture. Full Node 24 converter tests pass after replacing the old numeric-weight assumptions in quote/content assertions with physical face selection; the same source/geometry/no-refit gates remain enforced.

The matching renderer preserves [before/after findings](https://github.com/OpenPresentation/opf-render/tree/379b1402b4d06de79b98a35360f3ef5692d3659b/docs/evidence/font-variants). All seven rendered slide pairs were visually inspected. This evidence covers serialized native selectors and actual browser font loading, not new PowerPoint paint, font embedding or per-glyph native file identification. Historical Windows text passes, metric failures and chart observations remain scoped to their original source/runtime hashes.

Reproduce after linking the coordinated source packages with core's `scripts/link-ecosystem.mjs --packages-only`:

```sh
npm run test:font-variants
npm test
```

The focused test writes its source fixture, PPTX and JSON observations together under `artifacts/`. Fresh candidate installation, independent review, CI and native follow-up remain required before release.
