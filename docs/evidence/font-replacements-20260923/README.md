# Font replacement measurements (FF-31, 2026-09-23)

This folder records how each proprietary family's preview replacement in `spec/reference/font-policy.json` was chosen and measured.

- Host: Windows 11 with Microsoft 365, including the Aptos, Aptos Display and Aptos Narrow cloud fonts, version 2.01;O365.
- Reference fonts were read in place from `C:\Windows\Fonts` and the Office cloud-font cache. They were never copied, embedded or committed. The reports keep only the version strings and SHA-256 digests.
- Replacement faces came from pinned `@expo-google-fonts` packages. Every package used is OFL-1.1, checked from its `LICENSE_FONT`.
- Shaping used fontkit 2.0.4 with default features (kerning and ligatures), which is how opf-render measures text.

## Files

- `corpus.json`: 300 Latin title and body strings sampled evenly from the 126 bundled example decks.
- `report.json`: the policy replacement for each family, measured per style. Styles are regular, bold, italic and bold italic, or the weight that the family name encodes. Each entry gives the mean |ratio − 1|, the signed mean and the maximum, plus the file digests.
- `bundled-candidates.json`: the same ranking restricted to the faces opf-render already ships (Roboto, Roboto Mono, Carlito, Caladea, Arimo, Tinos, Cousine, Gelasio). It chose each row's last, bundled alternate.
- `candidates.json`: every installed open package ranked against each measurable family, top 10 by mean |ratio − 1|. The ranking ignores category, so it can list a proprietary sans next to a serif. Choices also weighed style coverage, category, and whether the face already ships in a pack.

Reproduce the measurements with an opf-render checkout, or any `node_modules` that holds fontkit and the packs:

```sh
node scripts/measure-font-replacements.mjs --packages ../opf-render/node_modules            # writes report.json
node scripts/measure-font-replacements.mjs --packages ../opf-render/node_modules --check    # fails on drift from the policy
node scripts/measure-font-replacements.mjs --packages <lab>/node_modules --explore          # writes candidates.json
node scripts/measure-font-replacements.mjs --packages ../opf-render/node_modules --explore --only roboto,roboto-mono,carlito,caladea,arimo,tinos,cousine,gelasio --candidates-out bundled-candidates.json
```

Families whose real font is not on the host are skipped and recorded as `measured: null`. That covers Grandview, Seaford, Skeena, Tenorite, Aptos Mono, Aptos Serif and most optional-feature script fonts.

## Findings

- **Metric replacements.** Carlito for Calibri, Arimo for Arial, Tinos for Times New Roman and Cousine for Courier New are metric. The largest difference on any string, in any of the four styles, is 0.26% (Calibri/Carlito).
- **Georgia and Gelasio are visual.** Gelasio matches every basic-Latin advance of Georgia 5.59. opf-render shapes with default features, though, and runs where Gelasio applies optional ligatures differ by up to 1.02% in all four styles. That exceeds the 0.3% per-string limit for a metric claim.
- **Cambria and Caladea.** Caladea is *not* metric-compatible with Cambria 6.99 (Windows 11). Its advances differ by a mean of 2.7% and up to 6.5%, so the policy classes it as visual. Fontconfig still lists Caladea as a metric alias.
- **Aptos.** Microsoft 365 cloud font, proprietary, not redistributable.
  - Measured candidates (mean |Δ| / signed):
    - Hind 0.97% / +0.0% (2 styles, no italics)
    - Sarabun 1.13% / +0.6%
    - Red Hat Display 1.84% / +1.7%
    - Roboto 2.15% / +0.1%
    - Source Sans 3 4.18% / −4.2%
    - Open Sans 6.6% / +6.6%
    - Carlito 7.13% / −7.1%, the previous substitute
  - The policy picks Roboto. It has all four styles, the smallest signed bias (so line breaks agree on average), and it already ships in the base pack, so cloud rendering of the default `aptos` scheme needs no extra install.
  - Aptos Display previews with Carlito (1.84%). Aptos Narrow also uses Carlito (2.33%).
  - Akasia, the previously noted experimental clone, could not be pinned: its repository returned 404 and there is no package.
- **Segoe UI.** Microsoft's own OFL Selawik is the documented fallback, but it is not published as a pinned package. Red Hat Display is the closest measured shipped face: 1.72% regular, 1.01% at 600, 1.87% at 300.
- **Consolas.** No open monospace face is within 8%. Consolas advances are 0.55 em, while Cousine and Roboto Mono use 0.6 em and Inconsolata uses 0.5 em. Roboto Mono measures slightly closer (+7.95%) than Cousine (+9.15%). The policy nevertheless uses Cousine, because the bundled Roboto Mono has no italic faces. Roboto Mono is an alternate. DMCA Sans Serif claims Consolas metrics but has no package.
- **Latin text in non-Latin fonts.** The Latin glyphs of several script fonts differ greatly from Noto's; for example, Noto Sans Thai's Latin is 75% wider than Angsana New's. Measurements for script families describe Latin runs only.
