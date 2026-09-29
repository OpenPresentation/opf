# Font replacement measurements (FF-31, 2026-09-23)

This folder records how each proprietary family's preview replacement in `spec/reference/font-policy.json` was chosen and measured.

- Host: Windows 11 with Microsoft 365, including the Aptos, Aptos Display and Aptos Narrow cloud fonts, version 2.01;O365.
- Reference fonts were read in place from `C:\Windows\Fonts` and the Office cloud-font cache. They were never copied, embedded or committed. The reports keep only the version strings and SHA-256 digests.
- Replacement faces came from pinned `@expo-google-fonts` packages. Every package used is OFL-1.1, checked from its `LICENSE_FONT`.
- Shaping used fontkit 2.0.4 with default features (kerning and ligatures), which is how opf-render measures text. The one exception is a replacement that lists `disabledFeatures` (Gelasio for Georgia: `liga`, `clig`), which is shaped with those features off, as opf-render shapes it.

## Files

- `corpus.json`: 300 Latin title and body strings sampled evenly from the 126 bundled example decks.
- `report.json`: the policy replacement for each family, measured per style. Styles are regular, bold, italic and bold italic, or the weight that the family name encodes. Each entry gives the mean |ratio − 1|, the signed mean and the maximum, plus the file digests.
- `bundled-candidates.json`: the same ranking restricted to the faces opf-render already ships (Roboto, Roboto Mono, Carlito, Caladea, Arimo, Tinos, Cousine, Gelasio). It chose each row's last, bundled alternate.
- `metric-candidates-20260929.json`: the 2026-09-29 acceptance measurement for Intos (Aptos, Aptos Display, Aptos Narrow, Aptos Serif; Aptos SemiBold for reference) and Selawik (Segoe UI and its Light, Semilight and Semibold styles). Per style it records the width deltas, hhea/typo/win/x-height/cap-height values of both faces, and, for the regular face, aggregate outline-identity counts, glyph-box deviations and code point coverage. It holds no font tables or outlines.
- `candidates.json`: every installed open package ranked against each measurable family, top 10 by mean |ratio − 1|. The ranking ignores category, so it can list a proprietary sans next to a serif. Choices also weighed style coverage, category, and whether the face already ships in a pack.

Reproduce the measurements with an opf-render checkout, or any `node_modules` that holds fontkit and the packs:

```sh
node scripts/measure-font-replacements.mjs --packages ../opf-render/node_modules            # writes report.json
node scripts/measure-font-replacements.mjs --packages ../opf-render/node_modules --check    # fails on drift from the policy
node scripts/measure-font-replacements.mjs --packages <lab>/node_modules --explore          # writes candidates.json
node scripts/measure-font-replacements.mjs --packages ../opf-render/node_modules --explore --only roboto,roboto-mono,carlito,caladea,arimo,tinos,cousine,gelasio --candidates-out bundled-candidates.json
```

Two later additions. Vendored replacement families (Intos) are read from the opf-render checkout's pinned font manifest (`--render <dir>`, default the parent of `--packages`). A reference font that is not installed can be measured from a directory of files with `--reference-dir <dir>`; Aptos Serif was measured that way from Microsoft's standalone Aptos Fonts download (Download Center id 106087, zip SHA-256 `6528fd120e719a9f985e94214eca6887d1653b88456916a792a630b02e95b025`, files version 2.01;240513210638;O365), extracting only the four Aptos-Serif files into an untracked folder. The candidate acceptance measurement is `node scripts/measure-font-candidates.mjs --intos <dir> --selawik <dir> --reference-dir <dir>`.

Families whose real font is not on the host are skipped and recorded as `measured: null`. That covers Grandview, Seaford, Skeena, Tenorite, Aptos Mono and most optional-feature script fonts.

## Findings

- **Metric replacements.** Carlito for Calibri, Arimo for Arial, Tinos for Times New Roman and Cousine for Courier New are metric. The largest difference on any string, in any of the four styles, is 0.26% (Calibri/Carlito).
- **Georgia and Gelasio are metric with ligatures off.** Gelasio matches every basic-Latin advance of Georgia 5.59. With default features, though, Gelasio applies `liga` ligatures (fi, fl, ffi, ffl) that Georgia does not, and 33 of the 300 corpus strings differ by up to 1.02% in all four styles: mean 0.02%, maximum 0.82% regular, 1.02% bold, 0.97% italic and 0.87% bold italic. That exceeds the 0.3% per-string limit. Shaping Gelasio with `liga` and `clig` off (the row records them as `disabledFeatures`, and opf-render applies them to measurement and SVG) leaves every string identical to Georgia in regular, bold and italic, and at most 0.0029% off in bold italic ("Major milestones for Kiteframe."). Georgia has no `liga` or `clig` feature, and turning kerning off changes no width in either font, so only the ligatures differ. The metric tier holds only with those features off.
- **Cambria and Caladea.** Caladea is *not* metric-compatible with Cambria 6.99 (Windows 11). Its advances differ by a mean of 2.7% and up to 6.5%, so the policy classes it as visual. Fontconfig still lists Caladea as a metric alias.
- **Aptos.** Microsoft 365 cloud font, proprietary, not redistributable. Superseded on 2026-09-29: the policy previews the Aptos family with Intos (OFL-1.1, commit `fef9315c14da9e4b23b4c3cac8e718998d4e4736`), which is metric.
  - Intos, Intos Display, Intos Narrow and Intos Serif match Aptos 2.01 to 0.000% mean and 0.000% maximum on all 300 strings in all four styles. hhea, OS/2 typo and win values, x-height and cap-height fields are equal, and painted x-height and cap-height boxes agree (x-height glyph 0.000 to 0.476 em in both).
  - Outlines are not Aptos's: no shared nonempty glyph of the sans regular faces has an identical outline (0 of 975), and Intos Serif shares only eight plain rectangles (hyphen, dashes, minus, macron, box line) with Aptos Serif. The median glyph-box deviation is 1.0% to 1.2% of an em for the sans faces and 1.7% for the serif.
  - The upstream README says the sans families derive from Inter and the serif from Gelasio, with Aptos's advances, kerning and vertical metrics. Its build scripts read local Aptos files to place some marks. That is measurement, not outline copying.
  - Intos Semibold is also within the bar against Aptos SemiBold (0.0015% mean, 0.13% maximum) but is not bundled: OPF maps Aptos at 400 and 700.
  - The earlier ranking of visual candidates is kept in `candidates.json`: Hind 0.97%, Sarabun 1.13%, Red Hat Display 1.84%, Roboto 2.15%, Source Sans 3 4.18%, Carlito 7.13%. Roboto and Carlito are now alternates.
  - Akasia, the previously noted experimental clone, is dropped: its repository is gone.
- **Segoe UI.** Microsoft's own OFL Selawik 1.01 (release Selawik_Release.zip, SHA-256 `3f62c51e05e3b5a1e6241cf92a371f0be2ea1183aa87b30718bbd40832a8d423`, commit `89362e84731d1f5777fa078fd4d5ebbd339e4378`) was measured on 2026-09-29 and rejected as a metric replacement. Basic-Latin advances equal Segoe UI's, but the font has no kerning and no italic faces, and 349 code points. Regular: 0.16% mean, 2.51% maximum; bold 0.20% and 2.10%; italic (upright stand-in) 2.65% and 5.16%; bold italic 1.09% and 4.38%; Light 0.31% and 4.38%; Semilight 0.34% and 2.76%; Semibold 1.75% and 4.41%. Lowercase glyphs are 4.8% shorter than Segoe UI's and its hhea ascent is 8% smaller. Red Hat Display remains the closest measured shipped face with all four styles: 1.72% regular, 1.01% at 600, 1.87% at 300.
- **Consolas.** No open monospace face is within 8%. Consolas advances are 0.55 em, while Cousine and Roboto Mono use 0.6 em and Inconsolata uses 0.5 em. Roboto Mono measures slightly closer (+7.95%) than Cousine (+9.15%). The policy nevertheless uses Cousine, because the bundled Roboto Mono has no italic faces. Roboto Mono is an alternate. DMCA Sans Serif claims Consolas metrics but has no package.
- **Latin text in non-Latin fonts.** The Latin glyphs of several script fonts differ greatly from Noto's; for example, Noto Sans Thai's Latin is 75% wider than Angsana New's. Measurements for script families describe Latin runs only.
