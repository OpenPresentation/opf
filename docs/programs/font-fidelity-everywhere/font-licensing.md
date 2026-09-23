# Font licensing and replacements (FF-31)

Generated from [`spec/reference/font-policy.json`](../../../spec/reference/font-policy.json); edit the JSON, not this table. Schema: [`font-policy.schema.json`](../../../spec/reference/font-policy.schema.json). Guide: [docs/font-fidelity.md](../../font-fidelity.md). Measurement method and raw data: [evidence](../../evidence/font-replacements-20260923/README.md).

**Provisional owner decisions (owner may revise):** `aptos-preview` → Roboto (visual); `segoe-ui-preview` → Red Hat Display (visual); `cambria-tier` → Caladea (visual, metric-mode fallback). They live in one block, `provisionalDecisions`, at the top of the JSON. Rows marked † below follow a decision.

Availability: `windows` = Windows 10/11 default; `windows-optional` = a language Supplemental Fonts feature; `macos` = installed or downloadable on current macOS; `office` = Office desktop; `office-cloud` = Microsoft 365 cloud font.

Width delta = mean |replacement/real - 1| over 300 example-deck strings (signed mean in parentheses; maximum on any single string after the slash), fontkit shaping with default features, per style available on the measuring host. For non-Latin families the corpus is Latin text only. "n/m" = the real font was not on the measuring host. Metric rows need a mean below 0.1% and a maximum of at most 0.3% in all four styles. Alternates are tried in order when the replacement's font pack is not loaded and are always reported as visual; the last alternate is a face bundled with opf-render where one was chosen.

153 families: 56 open, 97 proprietary-standard, 0 proprietary-nonstandard.

| Family | License class | License | Availability | Preview replacement | Tier | Width delta | Alternates | OPF may embed |
|---|---|---|---|---|---|---|---|---|
| Angsana New | proprietary-standard | proprietary (Unity Progress/Monotype/Microsoft, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans Thai | visual | 74.8% (+74.8%) / 84.7% | — | never |
| Anton | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Aparajita | proprietary-standard | proprietary (Modular Infotech, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans Devanagari | visual | n/m | — | never |
| Aptos | proprietary-standard | proprietary (Microsoft) | office-cloud | Roboto † | visual | 2.1% (+0.1%) / 7.4% | Carlito | never |
| Aptos Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Carlito | visual | 1.8% (-0.6%) / 6.9% | Roboto | never |
| Aptos Mono | proprietary-standard | proprietary (Microsoft) | office-cloud | Cousine | visual | n/m | Roboto Mono | never |
| Aptos Narrow | proprietary-standard | proprietary (Microsoft) | office-cloud | Carlito | visual | 2.3% (+2.2%) / 7.9% | — | never |
| Aptos Serif | proprietary-standard | proprietary (Microsoft) | office-cloud | Tinos | visual | n/m | — | never |
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
| Cambria Math | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | none | — | — | — | never |
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
| Georgia | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Gelasio | visual | 0.0% (-0.0%) / 1.0% | — | never |
| Gill Sans MT | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | office-cloud | Source Sans 3 | visual | 5.1% (+0.4%) / 14.6% | Carlito | never |
| Gisha | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Hebrew | visual | n/m | — | never |
| Grandview | proprietary-standard | proprietary (Microsoft) | office-cloud | Barlow | visual | n/m | Roboto | never |
| Grandview Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Barlow | visual | n/m | Roboto | never |
| Gungsuh | proprietary-standard | proprietary (HanYang I&C, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans KR | visual | n/m | — | never |
| GungsuhChe | proprietary-standard | proprietary (HanYang I&C, licensed to Microsoft) | windows-optional, office-cloud | Noto Sans KR | visual | n/m | — | never |
| Impact | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Anton | visual | 1.9% (-1.9%) / 5.1% | Carlito | never |
| Kalinga | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Oriya | visual | n/m | — | never |
| Kartika | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Malayalam | visual | n/m | — | never |
| Khmer UI | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Khmer | visual | n/m | — | never |
| Latha | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Tamil | visual | n/m | — | never |
| Liberation Mono | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Liberation Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Liberation Serif | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
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
| Noto Naskh Arabic | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Nastaliq Urdu | open | OFL-1.1 | macos | itself | — | — | — | explicit embed path only |
| Noto Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
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
| Noto Sans Malayalam | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Mongolian | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Oriya | open | OFL-1.1 | macos | itself | — | — | — | explicit embed path only |
| Noto Sans SC | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Tamil | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans TC | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Telugu | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Sans Thai | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Noto Serif Hebrew | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
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
| Segoe UI Emoji | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | none | — | — | — | never |
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
| Source Sans Pro | open | OFL-1.1 | office-cloud | Source Sans 3 | visual | n/m | — | explicit embed path only |
| Sylfaen | proprietary-standard | proprietary (Microsoft) | windows, office-cloud | Noto Sans | visual | 11.0% (+11.0%) / 15.9% | Noto Sans Georgian, Noto Sans Armenian | never |
| Symbol | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | none | — | — | — | never |
| Tahoma | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Red Hat Text | visual | 1.7% (-0.4%) / 6.3% | Open Sans, Arimo | never |
| Tenorite | proprietary-standard | proprietary (Microsoft) | office-cloud | Figtree | visual | n/m | Roboto | never |
| Tenorite Display | proprietary-standard | proprietary (Microsoft) | office-cloud | Figtree | visual | n/m | Roboto | never |
| Times New Roman | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows, macos, office-cloud | Tinos | metric | 0.0% (+0.0%) / 0.0% | Liberation Serif | never |
| Tinos | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Traditional Arabic | proprietary-standard | proprietary (Monotype, licensed to Microsoft) | windows-optional, office-cloud | Noto Naskh Arabic | visual | 15.7% (+15.7%) / 24.1% | — | never |
| Trebuchet MS | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Figtree | visual | 1.5% (-0.7%) / 6.7% | Arimo | never |
| Tunga | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Kannada | visual | n/m | — | never |
| Verdana | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | Montserrat | visual | 3.7% (-2.8%) / 9.2% | Arimo | never |
| Vrinda | proprietary-standard | proprietary (Microsoft) | windows-optional, office-cloud | Noto Sans Bengali | visual | n/m | — | never |
| Webdings | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | none | — | — | — | never |
| Wingdings | proprietary-standard | proprietary (Microsoft) | windows, macos, office-cloud | none | — | — | — | never |
| Work Sans | open | OFL-1.1 | — | itself | — | — | — | explicit embed path only |
| Yu Gothic | proprietary-standard | proprietary (JIYUKOBO, licensed to Microsoft) | windows, office-cloud | Noto Sans JP | visual | 0.9% (+0.3%) / 5.3% | — | never |
