# Font licensing and replacements (FF-31)

Generated from [`spec/reference/font-policy.json`](../../../spec/reference/font-policy.json); edit the JSON, not this table. Schema: [`font-policy.schema.json`](../../../spec/reference/font-policy.schema.json). Guide: [docs/font-fidelity.md](../../font-fidelity.md). Measurement method and raw data: [evidence](../../evidence/font-replacements-20260923/README.md). Rules for the font files themselves (bundle pinned files, never hotlink; verified permissive licenses): [Font files: bundling and licenses](#font-files-bundling-and-licenses).

**Policy (owner decisions, 2026-09-29):** the user's selected font is the source of truth. The replacement column is an open look-alike used for previews, SVG, the editor and thumbnails, because license-restricted (proprietary) fonts are never bundled or embedded. A metric-compatible replacement is the goal; a visual-only one is a documented fallback and a known layout-fidelity gap. PPTX export always writes the selected name, never the replacement. See [docs/font-fidelity.md](../../font-fidelity.md#font-policy-ff-31).

**Provisional owner decisions (owner may revise):** `aptos-preview` → Intos (metric; owner policy 2026-09-29, Roboto and Carlito remain alternates); `segoe-ui-preview` → Red Hat Display (visual); `cambria-tier` → Caladea (visual, metric-mode fallback). They live in one block, `provisionalDecisions`, at the top of the JSON. Rows marked † below follow a decision.

Availability: `windows` = Windows 10/11 default; `windows-optional` = a language Supplemental Fonts feature; `macos` = installed or downloadable on current macOS; `office` = Office desktop; `office-cloud` = Microsoft 365 cloud font.

Width delta = mean |replacement/real - 1| over 300 example-deck strings (signed mean in parentheses; maximum on any single string after the slash), fontkit shaping with default features, per style available on the measuring host. For non-Latin families the corpus is Latin text only. "n/m" = the real font was not on the measuring host. Aptos rows were measured against Aptos 2.01 (Aptos Serif from Microsoft's standalone Aptos Fonts download, the others from the Microsoft 365 cloud fonts). Metric rows need a mean below 0.1% and a maximum of at most 0.3% in all four styles. Alternates are tried in order when the replacement's font pack is not loaded and are always reported as visual; the last alternate is a face bundled with opf-render where one was chosen.

168 families: 71 open, 97 proprietary-standard, 0 proprietary-nonstandard.

| Family | License class | License | Availability | Preview replacement | Tier | Width delta | Alternates | OPF may embed |
|---|---|---|---|---|---|---|---|---|
| Angsana New | proprietary-standard | proprietary (Unity Progress/Monotype/Microsoft, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans Thai | visual | 74.8% (+74.8%) / 84.7% | — | never |
| Anton | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Aparajita | proprietary-standard | proprietary (Modular Infotech, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans Devanagari | visual | n/m | — | never |
| Aptos | proprietary-standard | proprietary (Microsoft) | office-cloud | Intos † | metric | 0.0% (+0.0%) / 0.0% | Roboto, Carlito | never |
| Aptos Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Intos Display | metric | 0.0% (+0.0%) / 0.0% | Carlito, Roboto | never |
| Aptos Mono | proprietary-standard | proprietary (Microsoft) | office-cloud | Cousine | visual | 0.0% (+0.0%) / 0.0% | Roboto Mono | never |
| Aptos Narrow | proprietary-standard | proprietary (Microsoft) | office-cloud | Intos Narrow | metric | 0.0% (+0.0%) / 0.0% | Carlito | never |
| Aptos Serif | proprietary-standard | proprietary (Microsoft) | office-cloud | Intos Serif | metric | 0.0% (+0.0%) / 0.0% | Tinos | never |
| Arabic Typesetting | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Naskh Arabic | visual | 66.3% (+66.3%) / 74.3% | — | never |
| Archivo Narrow | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Arial | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Arimo | metric | 0.0% (+0.0%) / 0.0% | Liberation Sans | never |
| Arial Black | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Montserrat 900 | visual | 0.8% (-0.3%) / 2.8% | Arimo | never |
| Arial Narrow | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | macos, office-cloud | Archivo Narrow | visual | 0.4% (+0.4%) / 4.3% | Carlito | never |
| Arimo | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Barlow | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Baskerville Old Face | proprietary-standard | proprietary (Stephenson Blake/URW/Microsoft) | office-cloud | Libre Caslon Text | visual | 19.2% (+19.2%) / 23.7% | Tinos | never |
| Batang | proprietary-standard | proprietary (HanYang I&C, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans KR | visual | n/m | — | never |
| BatangChe | proprietary-standard | proprietary (HanYang I&C, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans KR | visual | n/m | — | never |
| Bebas Neue | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Bitter | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Bodoni MT | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | Playfair Display | visual | 6.9% (+5.6%) / 19.9% | Caladea | never |
| Book Antiqua | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | PT Serif | visual | 2.4% (+1.9%) / 7.8% | Caladea | never |
| Bookman Old Style | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | Libre Caslon Text | visual | 4.1% (-3.8%) / 14.0% | Gelasio | never |
| Caladea | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Calibri | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Carlito | metric | 0.0% (+0.0%) / 0.3% | — | never |
| Calibri Light | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Carlito | visual | 1.4% (+1.4%) / 2.3% | — | never |
| Cambria | proprietary-standard | proprietary (Microsoft) | windows, office, office-cloud | Caladea † | visual | 2.7% (-2.7%) / 6.5% | — | never |
| Cambria Math | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | STIX Two Math | visual | n/m | Noto Sans Math, Caladea | never |
| Candara | proprietary-standard | proprietary (Microsoft) | windows, office, office-cloud | Source Sans 3 | visual | 1.9% (+0.6%) / 5.2% | Carlito | never |
| Carlito | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Century Gothic | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | Work Sans | visual | 2.5% (+1.9%) / 15.5% | Arimo | never |
| Century Schoolbook | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | Gelasio | visual | 2.7% (-1.8%) / 7.5% | — | never |
| Consolas | proprietary-standard | proprietary (Microsoft) | windows, office, office-cloud | Cousine | visual | 9.2% (+9.2%) / 9.2% | Roboto Mono | never |
| Constantia | proprietary-standard | proprietary (Microsoft) | windows, office, office-cloud | PT Serif | visual | 2.3% (+0.4%) / 5.8% | Caladea | never |
| Corbel | proprietary-standard | proprietary (Microsoft) | windows, office, office-cloud | Source Sans 3 | visual | 1.6% (+1.5%) / 5.2% | Carlito | never |
| Courier New | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Cousine | metric | 0.0% (+0.0%) / 0.0% | Liberation Mono | never |
| Cousine | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| DaunPenh | proprietary-standard | proprietary (OM Mony/Microsoft) | windows-optional, office-cloud | Noto Sans Khmer | visual | n/m | — | never |
| David | proprietary-standard | proprietary (Kivun Computers/Monotype, licensed to Microsoft) | windows-optional, office-cloud | Noto Serif Hebrew | visual | n/m | Noto Sans Hebrew | never |
| Didot | proprietary-standard | proprietary (bundled with macOS; vendor not stated on the Apple page) | macos | Playfair Display | visual | n/m | Tinos | never |
| DilleniaUPC | proprietary-standard | proprietary (Unity Progress/Monotype/Microsoft, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans Thai | visual | 70.8% (+70.8%) / 85.4% | — | never |
| EB Garamond | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Ebrima | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Sans | visual | 6.2% (+6.2%) / 9.3% | Arimo | never |
| FangSong | proprietary-standard | proprietary (Beijing ZhongYi Electronics, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans SC | visual | n/m | — | never |
| Figtree | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Franklin Gothic Book | proprietary-standard | proprietary (ITC design, licensed to Microsoft) | office-cloud | Barlow | visual | 1.8% (+1.2%) / 7.5% | Carlito | never |
| Franklin Gothic Medium | proprietary-standard | proprietary (ITC design, licensed to Microsoft) | windows, office-cloud | Barlow | visual | 1.4% (-0.4%) / 6.5% | Roboto | never |
| Garamond | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | EB Garamond | visual | 4.9% (+2.8%) / 18.8% | Tinos | never |
| Gautami | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Telugu | visual | n/m | — | never |
| Gelasio | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Georgia | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Gelasio | metric (liga, clig off) | 0.0% (+0.0%) / 0.0% | — | never |
| Gill Sans MT | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | Source Sans 3 | visual | 5.1% (+0.4%) / 14.6% | Carlito | never |
| Gisha | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Hebrew | visual | n/m | — | never |
| Grandview | proprietary-standard | proprietary (Microsoft) | office-cloud | Barlow | visual | n/m | Roboto | never |
| Grandview Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Barlow | visual | n/m | Roboto | never |
| Gungsuh | proprietary-standard | proprietary (HanYang I&C, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans KR | visual | n/m | — | never |
| GungsuhChe | proprietary-standard | proprietary (HanYang I&C, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans KR | visual | n/m | — | never |
| Impact | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Anton | visual | 1.9% (-1.9%) / 5.1% | Carlito | never |
| Intos | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Intos Display | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Intos Narrow | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Intos Serif | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Kalinga | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Oriya | visual | n/m | — | never |
| Kartika | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Malayalam | visual | n/m | — | never |
| Khmer UI | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Khmer | visual | n/m | — | never |
| Latha | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Tamil | visual | n/m | — | never |
| Liberation Mono | open | OFL-1.1 | — | Cousine | metric | 0.0% (+0.0%) / 0.0% | — | explicit embed path only |
| Liberation Sans | open | OFL-1.1 | — | Arimo | metric | 0.0% (+0.0%) / 0.0% | — | explicit embed path only |
| Liberation Serif | open | OFL-1.1 | — | Tinos | metric | 0.0% (+0.0%) / 0.0% | — | explicit embed path only |
| Libre Caslon Text | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Lora | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Lucida Console | proprietary-standard | proprietary (Bigelow & Holmes, licensed to Microsoft) | windows | Cousine | visual | 0.4% (-0.4%) / 0.4% | — | never |
| Lucida Sans | proprietary-standard | proprietary (Bigelow & Holmes, licensed to Microsoft) | office-cloud | Work Sans | visual | 1.2% (+0.5%) / 5.0% | Arimo | never |
| Lucida Sans Unicode | proprietary-standard | proprietary (Bigelow & Holmes, licensed to Microsoft) | windows, office-cloud | Work Sans | visual | 1.3% (+1.0%) / 5.0% | Arimo | never |
| Malgun Gothic | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Sans KR | visual | 1.8% (+1.7%) / 7.9% | — | never |
| Mangal | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Devanagari | visual | n/m | — | never |
| Meiryo | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans JP | visual | n/m | — | never |
| Merriweather Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Microsoft JhengHei | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Sans TC | visual | 1.4% (+0.4%) / 6.1% | — | never |
| Microsoft Sans Serif | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Arimo | visual | 0.2% (+0.0%) / 2.9% | — | never |
| Microsoft YaHei | proprietary-standard | proprietary (Microsoft; portions Beijing Founder) | windows, office-cloud | Noto Sans SC | visual | 3.1% (-3.1%) / 5.9% | — | never |
| MingLiU | proprietary-standard | proprietary (DynaComware, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans TC | visual | n/m | — | never |
| Miriam | proprietary-standard | proprietary (Kivun Computers/Monotype, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans Hebrew | visual | n/m | — | never |
| Montserrat | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| MS Gothic | proprietary-standard | proprietary (Ricoh/Ryobi Imagix, licensed to Microsoft) | windows, office-cloud | Noto Sans JP | visual | 4.9% (-3.6%) / 15.2% | — | never |
| MS Mincho | proprietary-standard | proprietary (Ricoh/Ryobi Imagix, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans JP | visual | n/m | — | never |
| Nirmala UI | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Sans Devanagari | visual | 6.4% (+6.4%) / 9.4% | — | never |
| Noto Color Emoji | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Emoji | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Naskh Arabic | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Nastaliq Urdu | open | OFL-1.1 | macos | itself | — | — | — | explicit embed path only |
| Noto Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Arabic | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Armenian | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Bengali | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Devanagari | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Ethiopic | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Georgian | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Gujarati | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Gurmukhi | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Hebrew | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans JP | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Kannada | open | OFL-1.1 | macos | itself | — | — | — | explicit embed path only |
| Noto Sans Khmer | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans KR | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Lao | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Malayalam | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Math | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Mongolian | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Myanmar | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Oriya | open | OFL-1.1 | macos | itself | — | — | — | explicit embed path only |
| Noto Sans SC | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Sinhala | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Syriac | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Tamil | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans TC | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Telugu | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Thaana | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Thai | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Serif Hebrew | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Serif Tibetan | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Nyala | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Ethiopic | visual | n/m | — | never |
| Open Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Palatino Linotype | proprietary-standard | proprietary (Linotype/Heidelberger, licensed to Microsoft) | windows, office-cloud | PT Serif | visual | 2.5% (+2.1%) / 9.1% | Caladea | never |
| Playfair Display | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| PMingLiU | proprietary-standard | proprietary (DynaComware, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans TC | visual | n/m | — | never |
| Poppins | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| PT Serif | open | OFL-1.1 | macos | itself | — | — | — | explicit embed path only |
| Raavi | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Gurmukhi | visual | n/m | — | never |
| Raleway | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Red Hat Display | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Red Hat Text | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Roboto | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Roboto Mono | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Rockwell | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | macos, office-cloud | Bitter | visual | 2.5% (-1.5%) / 8.5% | Gelasio | never |
| Sakkal Majalla | proprietary-standard | proprietary (Microsoft; portions Sakkal Design) | windows-optional, office-cloud | Noto Naskh Arabic | visual | 54.2% (+54.2%) / 61.4% | — | never |
| Seaford | proprietary-standard | proprietary (Microsoft) | office-cloud | Source Sans 3 | visual | n/m | Carlito | never |
| Seaford Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Source Sans 3 | visual | n/m | Carlito | never |
| Segoe UI | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Red Hat Display † | visual | 1.7% (-0.9%) / 7.1% | Open Sans, Arimo | never |
| Segoe UI Emoji | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Color Emoji | visual | n/m | Noto Emoji | never |
| Segoe UI Light | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Red Hat Display 300 † | visual | 1.9% (+1.8%) / 6.6% | Carlito | never |
| Segoe UI Semibold | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Red Hat Display 600 † | visual | 1.0% (-0.1%) / 6.5% | Roboto | never |
| Segoe UI Semilight | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Red Hat Display † | visual | 3.2% (+3.2%) / 9.0% | Roboto | never |
| Shonar Bangla | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Bengali | visual | n/m | — | never |
| Shruti | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Gujarati | visual | n/m | — | never |
| SimHei | proprietary-standard | proprietary (Beijing ZhongYi Electronics, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans SC | visual | n/m | — | never |
| SimSun | proprietary-standard | proprietary (ZhongYi Electronic, licensed to Microsoft) | windows, office-cloud | Noto Sans SC | visual | 4.9% (-3.6%) / 15.2% | — | never |
| Skeena | proprietary-standard | proprietary (Microsoft) | office-cloud | Open Sans | visual | n/m | Carlito | never |
| Skeena Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Open Sans | visual | n/m | Carlito | never |
| Source Sans 3 | open | OFL-1.1 | office-cloud | itself | — | — | — | explicit embed path only |
| Source Sans Pro | open | OFL-1.1 | office-cloud | Source Sans 3 | visual | 0.0% (-0.0%) / 0.4% | — | explicit embed path only |
| STIX Two Math | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Sylfaen | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Sans | visual | 11.0% (+11.0%) / 15.9% | Noto Sans Georgian, Noto Sans Armenian | never |
| Symbol | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | none: code table ([FF-45](special-families.md)) | — | — | Noto Sans, Noto Sans Math, Noto Sans Symbols 2, Noto Sans Symbols | never |
| Tahoma | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Red Hat Text | visual | 1.7% (-0.4%) / 6.3% | Open Sans, Arimo | never |
| Tenorite | proprietary-standard | proprietary (Microsoft) | office-cloud | Figtree | visual | 4.2% (+4.2%) / 8.4% | Roboto | never |
| Tenorite Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Figtree | visual | 14.8% (+14.8%) / 19.8% | Roboto | never |
| Times New Roman | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Tinos | metric | 0.0% (+0.0%) / 0.0% | Liberation Serif | never |
| Tinos | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Traditional Arabic | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows-optional, office-cloud | Noto Naskh Arabic | visual | 15.7% (+15.7%) / 24.1% | — | never |
| Trebuchet MS | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Figtree | visual | 1.5% (-0.7%) / 6.7% | Arimo | never |
| Tunga | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Kannada | visual | n/m | — | never |
| Verdana | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Montserrat | visual | 3.7% (-2.8%) / 9.2% | Arimo | never |
| Vrinda | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Bengali | visual | n/m | — | never |
| Webdings | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | none: code table ([FF-45](special-families.md)) | — | — | Noto Sans Symbols 2, Noto Sans Symbols, Noto Sans Math, Noto Sans | never |
| Wingdings | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | none: code table ([FF-45](special-families.md)) | — | — | Noto Sans Symbols 2, Noto Sans Symbols, Noto Sans Math, Noto Sans | never |
| Work Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Yu Gothic | proprietary-standard | proprietary (JIYUKOBO, licensed to Microsoft) | windows, office-cloud | Noto Sans JP | visual | 0.9% (+0.3%) / 5.3% | — | never |

## Font files: bundling and licenses

Owner decisions, 2026-09-29: bundle font files instead of hotlinking them, and check each family's license before bundling. This section is hand-written policy; the table above is the per-family record. It applies to every repository in the ecosystem: core, opf-render, opf-editor, opf-pptx, the pptx.gallery site and the OpenPresentation site.

### Rule 1: bundle, don't hotlink

Fonts, Google Fonts included, ship as pinned files. The pin is an exact npm version (`@fontsource/*`, `@expo-google-fonts/*`) or a vendored file whose sha256 is recorded. Nothing loads a font at runtime from fonts.googleapis.com, fonts.gstatic.com, use.typekit.net, fonts.bunny.net, cdnjs font CSS or any other font CDN. That covers `<link rel="stylesheet">`, `@import url(...)`, `preconnect` hints, remote `@font-face` sources and SVG previews that embed remote font URLs.

Why:

- **Privacy.** A page that pulls fonts from the Google Fonts CDN sends each visitor's IP address to Google. In 2022 the Munich Regional Court (LG München I) held that a GDPR violation.
- **Determinism and offline previews.** Output must not depend on the network, or on what a CDN serves today.
- **Reproducible audits.** Parity and fidelity audits can only be repeated when the exact font bytes are pinned.

Build-time download that ends as self-hosted files is not hotlinking, but it is not pinned either. `next/font/google` is the example: Next downloads whatever the font host serves during the build and serves it from the site's own origin, so the bytes can change between builds. Use `next/font/local` with vendored or package-pinned files instead, and keep the record (license, sha256) next to them. Either way, the build-output check below verifies that the built output makes no request to a font host.

### Rule 2: check each family's license

Every bundled font face records these fields:

| Field | Meaning |
| --- | --- |
| License | SPDX id |
| Reserved Font Name | Whether the copyright block declares one, and its name |
| Source URL | Where the file came from (npm page, upstream repository) |
| Package and version | `package@version`, pinned exactly |
| sha256 | Of each face file and of the license file |

Allowed for bundling: exactly `OFL-1.1`, `Apache-2.0`, `MIT` and `UFL-1.0` (Ubuntu Font Licence), and nothing else. Not allowed: GPL, LGPL and AGPL fonts, proprietary fonts, and public-domain fonts of unclear provenance.

Verify the license from the LICENSE or OFL file that ships with the font files. Do not assume it from the source site, the package's `license` field or a catalog entry. A wrapper package can carry a different license for its own code than for the fonts inside (the `@expo-google-fonts/*` packages are `MIT AND OFL-1.1`, and their `LICENSE_FONT` file is the font license).

**Reserved Font Names (owner decision, 2026-09-29).** OFL's Reserved Font Name restricts only a *modified* version, and only from using the reserved name in its name. A subset, instance, format conversion (including woff2) or edit is a modified version. So the rule is "modified and its name contains the Reserved Font Name", not "a Reserved Font Name is declared":

- A face whose family and file names do not contain the reserved name may be a subset, instance or conversion. Noto Sans JP, SC, TC and KR reserve `Source` (Adobe) but are named "Noto Sans ...", so subsets and static instances are fine.
- A face whose family or file name does contain it must be the unmodified file its copyright holder released: the TTF or variable file from the google/fonts repository at a pinned commit, or an upstream project release asset. This applies to Carlito (`Carlito`), Raleway (`Raleway`), Lora (`Lora`) and Playfair Display (`Playfair Display`). Serve the file byte for byte. Only the CSS may add `font-display`, `unicode-range` and weight ranges.
- Decide from the family's upstream `OFL.txt`, not only from the copy a package ships: a distributor's copy can omit the line (the `@fontsource` licenses for Carlito and Noto Sans CJK do). The notice parser fails closed: a notice that mentions a Reserved Font Name but yields no readable name is an error, not "none".
- The per-face proof is the pinned upstream URL and a sha256 equal to the served file's own hash. The license tests check "modified and name contains a reserved name". A family that fails stays on a reviewed "pending" list that may only shrink.

Reserved Font Names found (upstream `OFL.txt`, google/fonts commit 23e54b51ddff): Carlito `Carlito`; Noto Sans JP, SC, TC and KR `Source`; Raleway `Raleway`; Lora `Lora`; Playfair Display `Playfair Display`. STIX Two Math reserves `TM Math` (stipub/stixfonts `OFL.txt`, shipped unchanged in `@expo-google-fonts/stix-two-math` 0.4.0): neither its family name nor its file name (`STIXTwoMath_400Regular.ttf`) contains it, so the npm static is allowed under the name-contains rule (FF-45). Noto Color Emoji, Noto Emoji and Noto Sans Math declare none. In opf-render, the Carlito copy from `@expo-google-fonts` is a Google Fonts API subset (2532 glyphs against 2783 in the google/fonts file) named Carlito, so it must be replaced by the unmodified upstream TTFs. The four Noto Sans CJK packages (eight faces) are static instances named "Noto Sans ...", so they stay. In the gallery, Carlito, Raleway, Lora and Playfair Display were served as `@fontsource` woff2 subsets under their own names, so they must switch to the unmodified upstream files; the Noto Sans CJK families there may stay subsets.

### Enforcement

| Repository | Hotlink guard | License verification |
| --- | --- | --- |
| opf (core) | `pnpm check:font-hotlinks`, part of `pnpm test` | Font rows in `spec/reference/font-policy.json`; core bundles no font files |
| opf-render | `npm run check:font-hotlinks`, part of `npm test` | `test/font-licenses.mjs` (`npm run check:fonts`): manifest vs the license each installed package ships, allowlist, sha256 pins, and the RFN rule (`upstreamFile` per face, or an entry in `RFN_PENDING_UNMODIFIED_UPSTREAM`) |
| opf-editor | `npm run check:font-hotlinks`, part of `npm test`; `check:font-hotlinks:built` scans `dist` and the built playground | Uses the renderer's verified registry; ships no font files |
| pptx-gallery | `pnpm test` (`tests/font-hotlinks.test.ts`), plus a `postbuild` scan of `.next/static` and `.next/server` | Bundling: `data/preview-fonts.json` and `tests/preview-fonts.test.ts` (PR #53); RFN rule: `tests/font-rfn.test.ts` |
| openpresentation-site | `pnpm test`, plus a `postbuild` scan of `.next/static` and `.next/server` | Inter and Geist Mono are vendored pinned files in `app/fonts` loaded with `next/font/local` (not `next/font/google`); `data/bundled-fonts.json` and `scripts/verify-bundled-fonts.mjs` check license (OFL-1.1, no Reserved Font Name) and sha256 |

Each guard reads `git ls-files`, so untracked scratch files are ignored, and fails on any font CDN host (Google Fonts, Typekit, Bunny, Adobe, Fontshare, Font Awesome kits, the webfontloader script), font CSS or any font file on jsDelivr (`npm/` and `gh/`), unpkg or cdnjs, `@import` of remote font CSS, a remote font file in CSS `url(...)`, a `fetch()`, `import()`, XHR or `FontFace` load of a remote font file, and a `WebFont.load({ google | typekit })` configuration. Files that mention a host in prose are listed with a reason, by exact path, in `scripts/font-hotlink-allowlist.json`. An allowlist entry that no longer matches fails too, and build output is never allowlisted. New manifest entries must include the license fields; `node scripts/update-font-manifest.mjs` in opf-render fills them from the installed package.

## Replacement font acceptance rules

Owner policy, 2026-09-29: for a licensed font the user selects (for example Aptos), previews use an open replacement that looks similar and has the same size on screen (metric-compatible). The PPTX keeps the selected name, so PowerPoint shows the real font. Licensed fonts are never bundled or embedded. Root decisions on which replacements qualify:

1. **Metric matching to a proprietary font is acceptable when the outlines are original.** A font whose advance widths, kerning and vertical metrics were matched to a proprietary font is accepted, as Carlito is for Calibri and Liberation or Croscore fonts are for Arial, Times New Roman and Courier New. Metrics are functional layout data. A font whose outlines are copied from a proprietary font is never accepted. No proprietary font file is committed, and none of its tables is dumped into the repository; aggregate delta numbers are fine. `scripts/measure-font-candidates.mjs` counts identical outlines against the installed real font as part of every acceptance measurement.
2. **Bundling and licenses follow [Font files: bundling and licenses](#font-files-bundling-and-licenses) above:** only `OFL-1.1`, `Apache-2.0`, `MIT` and `UFL-1.0`, verified from the license file that ships with the files, with the SPDX id, Reserved Font Name, source URL, exact commit or version and sha256 recorded in the renderer's manifest, and no hotlinking. A font with a Reserved Font Name is bundled as the unmodified upstream files only.
3. **Young or single-maintainer projects are acceptable** when they are pinned by exact commit or version plus SHA-256 in the font manifest, and the previous replacement stays as a fallback or alternate.
4. **The replacement's family name must not be a trademark of the original.** "Intos" is fine; "Aptos Open" would not be.
5. **The metric bar is unchanged:** a mean below 0.1% and a maximum of at most 0.3% on any corpus string, in every style of all four (regular, bold, italic, bold italic). A family where only some styles qualify is not claimed metric. The candidate's vertical metrics (hhea ascent, descent and line gap, OS/2 typo and win values, x-height and cap-height) and painted glyph heights are compared as well, because the owner cares about on-screen size.
6. **A candidate that misses the bar is recorded, not switched to.** Its measurement is kept as visual or rejected, in the evidence folder and, for a rejected candidate, in `EXPERIMENTAL_FONT_CANDIDATES`.

### Decisions under these rules

| Candidate | For | Verdict | Basis |
|---|---|---|---|
| Intos, Intos Display, Intos Narrow, Intos Serif (commit `fef9315c14da9e4b23b4c3cac8e718998d4e4736`, OFL-1.1, no Reserved Font Name) | Aptos, Aptos Display, Aptos Narrow, Aptos Serif | **Accepted, metric** | 0.000% mean and 0.000% maximum in all four styles of each family against Aptos 2.01. hhea, OS/2 and x-height/cap-height values equal. No identical outline in the sans faces (0 of 975 shared glyphs); the serif shares eight plain rectangles such as the hyphen. Sans outlines derive from Inter and the serif from Gelasio, both OFL. Vendored in opf-render's office pack. |
| Intos Semibold and Semibold Italic (same pinned commit, OFL-1.1, no Reserved Font Name; Intos only), and any Intos Medium or ExtraBold | Aptos at 500, 600 and 800 | **Not vendored (FF-60, vetoable)** | Upstream has no Medium, ExtraBold or variable font, and its Semibold has no Display, Narrow or Serif counterpart. The PPTX writes bold for weights from 600, so PowerPoint draws Aptos Regular and Bold, which the preview already uses (500 to Regular, 600 and 800 to Bold); extra faces would diverge from the file, so the parity check counts those weights by the face the export selects instead (FF-60). Semibold is named "Intos Semibold" with subfamily Regular, so it would need a derived rename for resvg, and its metric match to Aptos SemiBold rests on upstream's own assertion (not re-measured here: Aptos SemiBold is not installed). See [gallery-support.md](gallery-support.md#aptos-at-weights-500-600-and-800-ff-60-2026-09-30). |
| Selawik 1.01 (OFL-1.1, Reserved Font Name "Selawik") | Segoe UI and its Light, Semilight, Semibold styles | **Rejected** | Regular 0.16% mean and 2.5% maximum; bold 0.20% and 2.1%; no italic faces, so the upright face is 2.65% off in italic; Semibold 1.75%; Light 0.31%. Advances of basic Latin are identical, the differences are missing kerning and only 349 code points. Lowercase is 4.8% shorter than Segoe UI and hhea ascent 8% smaller. Red Hat Display stays the visual replacement. |
| Red Hat Display and Red Hat Text statics from `@expo-google-fonts` 0.4.1 (OFL-1.1, no Reserved Font Name) | Segoe UI, Segoe UI Light, Semibold, Semilight and Tahoma | **Accepted as the visual replacement, replacing the RedHatFont repository statics (FF-43)** | The repository statics (commit `6bb1048a`) are unusable in resvg: the Regular, Light and SemiBold italics (and Red Hat Text Italic) do not set the OS/2 italic bit (only the Bold Italic files do), Red Hat Display SemiBold declares weight 707 and Bold 799 (Red Hat Text Bold declares 700), and the italics are named e.g. "Red Hat Display Italic" with subfamily Regular, so a 600 request paints as Bold and the regular and bold italics paint as one face (per-face pixel probe). Trade-off: the shipped Red Hat Display Bold (Google Fonts 700 instance) is about 2.5% narrower than the RedHatFont Bold, so the Segoe UI Bold preview moves from +0.6% to -1.8% mean width (mean absolute 0.95% to 1.86%; regular widths identical). Red Hat has no Reserved Font Name, so the correctly labelled Google Fonts instances may be vendored as npm-derived statics. Now 300, 400, 600 and 700 with italics (Display) and 400, 700 with italics (Text). Width measurements are unchanged. |
| Bitter (`@expo-google-fonts/bitter` 0.4.2, OFL-1.1, Reserved Font Name "Bitter Pro") | Rockwell | **Accepted as the visual replacement (FF-43)** | The OFL bars a MODIFIED font from carrying its Reserved Font Name in its family or file name. Upstream (solmatas/BitterPro, google/fonts `ofl/bitter`) publishes Bitter only as variable fonts, which resvg draws at one weight, so the instanced statics (family and files named "Bitter", no face carries "Bitter Pro") are vendored as npm-derived faces. opf-render's `test/font-licenses.mjs` implements this name-contains rule for instanced faces and still rejects an instanced face named Carlito, Raleway, Lora or Playfair Display. 400, 700 and italics; measured against Rockwell 1.65, mean 1.1% to 4.4%, max 8.5%, visual. |
| Cousine for Aptos Mono (already bundled; OFL-1.1 per the pinned @expo-google-fonts package), with Roboto Mono as the alternate | Aptos Mono | **Kept, visual (RR-17, vetoable)** | Measured against Aptos Mono 2.01 (Microsoft's standalone Aptos Fonts download, read in place and not redistributed): Aptos Mono is a 1229/2048 em cell, the Courier New cell, so Cousine matches all 300 strings in all four styles at 0.0000% and wraps identically in all 250 wrap cases. The tier stays visual under rule 5 because the vertical metrics differ (hhea ascent 0.833 em against 0.939, x-height 0.528 em against 0.476; capitals match, 0.659 against 0.657). Source Code Pro (x-height 0.486, cap 0.660) and Red Hat Mono (0.488, 0.700) are closer in glyph size but are 0.016% off the cell, would add four lazy faces each and, for Source Code Pro, a Reserved Font Name ("Source") to manage; not adopted. |
| Liberation Sans, Serif and Mono 2.1.5 (OFL-1.1, Reserved Font Name "Liberation", about 4.4 MB for twelve faces) | themselves, when a document names them | **Not bundled; aliased to Arimo, Tinos and Cousine, metric (RR-17, vetoable)** | Liberation 2 is built from the Croscore faces: 0.0000% mean and maximum in all four styles of each family against Arimo, Tinos and Cousine, hhea and glyph boxes equal (Liberation Serif and Mono share about 97% of their glyph outlines byte for byte with Tinos and Cousine; Sans differs in outline detail, not in boxes). A document that names a Liberation family previews with the Croscore twin, and the PPTX keeps the Liberation name. |
| Noto Color Emoji (`@expo-google-fonts/noto-color-emoji` 0.4.6, OFL-1.1, no Reserved Font Name; COLRv1 and OT-SVG colour glyphs, 25.1 MB) | Segoe UI Emoji | **Accepted as the visual replacement (FF-45)** | The only openly licensed colour emoji family with an npm pin (Twemoji and OpenMoji are CC-BY, not allowed). Every emoji sequence shapes to one glyph of 1.2451 em against 1.3730 em in Segoe UI Emoji 1.33 (-9.3%, read in place); no Latin glyphs, so a Segoe UI Emoji run's words and digits take a text face. Chromium and Firefox draw COLRv1, Safari the SVG table; resvg draws neither, so PNG and PDF draw Noto Emoji (monochrome, OFL-1.1, 0.4.7), the alternate. Optional peer pack (pseudo-script Zsye), loaded only for decks that draw emoji. |
| STIX Two Math (`@expo-google-fonts/stix-two-math` 0.4.0, OFL-1.1, Reserved Font Name "TM Math", not carried by the face) | Cambria Math | **Accepted as the visual replacement (FF-45)** | Serif math face with a MATH table and the math alphanumerics. Against Cambria Math 6.99 on a 31-string math corpus (fontkit, default features): mean 5.0%, max 18.2% (arrows), Latin text 0.9%; Noto Sans Math 8.3%; Caladea covers only the Latin half (71 of 144 corpus characters) and is 4.7% narrower on Latin, so STIX Two Math alone is the route and Caladea the last alternate for registries without the pack. One weight; no identical outline with Cambria Math (0 of 62 shared basic Latin glyphs). Optional peer pack (pseudo-script Zmth). |
| Akasia | Aptos | **Dropped** | The repository is no longer available. Intos replaces it. The earlier [assessment](../../evidence/akasia-assessment/README.md) remains as history. |

Measurements and the method are in [the evidence folder](../../evidence/font-replacements-20260923/README.md).
