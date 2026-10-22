# Preserve body roles beside known headings

The stronger native quote check in [PPTX #22](https://github.com/OpenPresentation/opf-pptx/pull/22) exposed a portrait importer error: the first body line became a subtitle despite the slide's complete OPF title tags. All words remained, but their roles changed. The prior footer-only gate could not detect it.

The importer now uses native placeholders and complete OPF heading roles before geometry inference. If any complete OPF heading role is present, it leaves other untagged text in the body. Ordinary slides without recovered roles keep their existing title/subtitle heuristics. Current text still wins; the change does not restore old source, geometry or semantic quote payloads.

The new browser test also exposed that the estimated-font export path omitted heading tags entirely. It now tags each existing heading box without changing its text or geometry. `browser-initial-failure.log` retains that counterexample. Both outline-measured and default estimated-font exports now retain their heading roles.

The immutable [core #67 evidence](https://github.com/OpenPresentation/opf/tree/2024141c116e81608d3c6632b02c7bcbcd2a2bcc/docs/evidence/windows-native-2026-09-10) contains real PowerPoint original/saved/edited fixtures from both Windows Node runtimes. All 2,646 manifest-covered files and their runtime/verifier bindings were verified against that Git commit. `review-native-content.mjs` independently reimports 108 retained table slides (including two further export/import cycles), 48 code slides and 72 quote slides. It checks exact current text, actual edits, source character-color observations, PNG hashes and the native harness's reported bound/tab observations.

`before.json` reproduces all 36 portrait quote-role failures. `after-node20.json` and `after-node24.json` have zero role failures; all table/code checks remain passing. These are new importer executions over retained native fixtures, not new Office runs. Quotes still import as generic text lines, and no font-file identity, ink containment or browser/native equivalence is claimed.

Run after checking out the exact core evidence commit and verifying its manifest:

```sh
node docs/evidence/windows-native-2026-09-10/verify-evidence.mjs 2024141c116e81608d3c6632b02c7bcbcd2a2bcc
```

Then, from this converter checkout after building:

```sh
node docs/evidence/heading-role-recovery/review-native-content.mjs /path/to/core/docs/evidence/windows-native-2026-09-10 /tmp/heading-role-review.json
```

The ordinary package test includes sixteen wide/portrait quote cases with loaded open fonts and default estimated measurement, exact body-line order and multiplicity, current explicit native subtitle placeholders, ordinary untagged title/subtitle inference, and the existing edited/cleared/reordered/renamed/damaged heading controls. Source objects and input PPTX bytes are unchanged by those tests. The browser suite checks six additional wide/portrait imports with one explicit heading role each.
