# FF-46 / RR-17 documented-visual: native comparison

Packages: @openpresentation/opf 0.12.1, @openpresentation/opf-render 0.12.0, @openpresentation/opf-pptx 0.12.3, fontkit 2.0.4, @resvg/resvg-js 2.6.2. PowerPoint 16.0 build 20430. Pixel size 1280 x 720.

PowerPoint does not re-wrap these decks: opf-pptx writes each laid-out line as its own single-line text box (`wrap="none"`, zero insets). "Line breaks" therefore means where each native line ends relative to its box (`TextRange.Lines` bounds), plus the PNG comparison.

## Decks

| Deck | Read | Fonts | Theme | Pres.Fonts | Slide family | Lines 1/box | Overflow (boxes, max pt) | Images close/review/far |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scripts-01-japanese` | yes | pass | pass | pass | pass | 35/35 | 0, 0 | 0/0/9 |
| `scripts-02-chinese-simplified` | yes | pass | pass | pass | pass | 35/35 | 0, 0 | 5/4/0 |
| `scripts-03-chinese-traditional` | yes | pass | pass | pass | pass | 28/28 | 0, 0 | 0/4/3 |
| `scripts-04-korean` | yes | pass | pass | pass | pass | 24/24 | 3, 20.16 | 0/0/6 |
| `scripts-05-arabic` | yes | pass | pass | pass | pass | 24/24 | 0, 0 | 0/0/6 |
| `scripts-06-urdu` | yes | pass | pass | pass | pass | 3/3 | 0, 0 | 0/0/1 |
| `scripts-07-persian` | yes | pass | pass | pass | pass | 3/3 | 0, 0 | 0/0/1 |
| `scripts-08-hebrew` | yes | pass | pass | pass | pass | 24/24 | 0, 0 | 0/0/6 |
| `scripts-09-hindi` | yes | pass | pass | pass | pass | 21/21 | 9, 274.53 | 0/0/6 |
| `scripts-10-bengali` | yes | pass | pass | pass | pass | 12/12 | 4, 227.66 | 0/0/4 |
| `scripts-11-punjabi` | yes | pass | pass | pass | pass | 6/6 | 1, 208.03 | 0/0/2 |
| `scripts-12-gujarati` | yes | pass | pass | pass | pass | 6/6 | 2, 227.53 | 0/0/2 |
| `scripts-13-odia` | yes | pass | pass | pass | pass | 6/6 | 1, 60.03 | 0/0/2 |
| `scripts-14-tamil` | yes | pass | pass | pass | pass | 6/6 | 3, 923.66 | 0/0/2 |
| `scripts-15-telugu` | yes | pass | pass | pass | pass | 7/7 | 2, 133.28 | 0/0/2 |
| `scripts-16-kannada` | yes | pass | pass | pass | pass | 6/6 | 2, 90.16 | 0/0/2 |
| `scripts-17-malayalam` | yes | pass | pass | pass | pass | 7/7 | 3, 1106.53 | 0/0/2 |
| `scripts-18-thai` | yes | pass | pass | pass | pass | 16/16 | 0, 0 | 0/0/4 |
| `scripts-19-khmer` | yes | pass | pass | pass | pass | 14/14 | 0, 0 | 0/0/4 |
| `scripts-20-amharic` | yes | pass | pass | pass | pass | 16/16 | 5, 177.53 | 0/0/4 |
| `scripts-21-armenian` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-22-georgian` | yes | pass | pass | pass | pass | 6/6 | 1, 97.66 | 0/0/2 |
| `symbol-01-wingdings` | yes | pass | pass | pass | pass | 12/12 | 0, 0 | 0/0/6 |
| `symbol-02-webdings` | yes | pass | pass | pass | pass | 4/4 | 0, 0 | 0/0/2 |
| `symbol-03-symbol` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/4 |
| `emoji-math-01-segoe-ui-emoji` | yes | pass | pass | pass | pass | 22/22 | 0, 0 | 0/0/11 |
| `emoji-math-02-cambria-math` | yes | pass | pass | pass | pass | 26/26 | 0, 0 | 0/0/13 |
| `emoji-math-03-emoji-in-aptos-deck` | yes | pass | pass | pass | pass | 5/5 | 0, 0 | 0/0/2 |

## Families

| Family | Status | Installed (native host) | Names | Overflow (boxes, max pt) | Ink native/preview (median, range) | Width (replacement / original - 1) | Proposal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Angsana New | script-gap | yes | 1/1 | 0, 0 | 0.7003 (0.632 to 0.7094) | 400 Thai +42.4%; 700 Thai +49.5% | hold: preview much wider than the real font: native / preview ink width median 0.7003 on 6 line(s) with no preview size adjustment; replacement width 400 Thai +42%, 700 Thai +50% with no preview size adjustment |
| Aparajita | script-gap | no | 1/1 | 3, 274.53 | 1.1481 (0.8 to 1.2547) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Arabic Typesetting | script-gap | yes | 1/1 | 0, 0 | 0.9741 (0.6203 to 1.0031) | 400 Arab +56.0% | documented-visual candidate |
| Batang | script-gap | no | 1/1 | 1, 18.41 | 1.1019 (1.0442 to 1.2177) | - | hold: native overflow where the preview fits: 1 line box(es), max 18.41 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| BatangChe | script-gap | no | 1/1 | 1, 18.41 | 1.1019 (1.0442 to 1.2177) | - | hold: native overflow where the preview fits: 1 line box(es), max 18.41 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Cambria Math | visual-gap | yes | 1/1 | 0, 0 | 0.9384 (0.8117 to 1.1399) | - | documented-visual candidate |
| DaunPenh | script-gap | no | 1/1 | 0, 0 | 0.5714 (0.1293 to 0.6524) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| David | script-gap | no | 1/1 | 0, 0 | 0.9114 (0.8599 to 0.9906) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| DilleniaUPC | script-gap | yes | 1/1 | 0, 0 | 0.6975 (0.6493 to 0.7062) | 400 Thai +55.5%; 700 Thai +59.9% | hold: preview much wider than the real font: native / preview ink width median 0.6975 on 7 line(s) with no preview size adjustment; replacement width 400 Thai +55%, 700 Thai +60% with no preview size adjustment |
| Ebrima | script-gap | yes | 1/1 | 3, 177.53 | 1.0745 (1.0348 to 1.132) | 400 Ethi -7.1%; 700 Ethi -8.9% | hold: real font wider than the replacement: native / preview ink width median 1.074 on 3 line(s) of at least 200 pt (a full composed line overflows by about 7%) |
| FangSong | script-gap | no | 1/1 | 0, 0 | 1.004 (0.9896 to 1.0638) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Gautami | script-gap | no | 1/1 | 2, 133.28 | 0.9943 (0.5059 to 1.0625) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Gisha | script-gap | no | 1/1 | 0, 0 | 0.8784 (0.8483 to 1.0421) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Gungsuh | script-gap | no | 1/1 | 1, 20.16 | 1.0909 (1.0473 to 1.2166) | - | hold: native overflow where the preview fits: 1 line box(es), max 20.16 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| GungsuhChe | script-gap | no | 1/1 | 1, 20.16 | 1.0909 (1.0473 to 1.2166) | - | hold: native overflow where the preview fits: 1 line box(es), max 20.16 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Kalinga | script-gap | no | 1/1 | 1, 60.03 | 0.892 (0.8231 to 1.0977) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Kartika | script-gap | no | 1/1 | 3, 1106.53 | 1.1997 (1.0582 to 1.23) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Khmer UI | script-gap | no | 1/1 | 0, 0 | 0.5579 (0.1293 to 1.0428) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Latha | script-gap | no | 1/1 | 3, 923.66 | 1.0986 (1.0024 to 1.187) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Malgun Gothic | script-gap | yes | 1/1 | 1, 15.16 | 1.0875 (1.0345 to 2.1146) | 400 Kore -6.6%; 700 Kore -6.4% | hold: native overflow where the preview fits: 1 line box(es), max 15.16 pt past the box; real font wider than the replacement: native / preview ink width median 1.0744 on 7 line(s) of at least 200 pt (a full composed line overflows by about 7%) |
| Mangal | script-gap | no | 1/1 | 3, 274.53 | 1.1637 (1.102 to 1.2547) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Meiryo | script-gap | no | 1/1 | 0, 0 | 1.0211 (1.0011 to 1.179) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Microsoft JhengHei | script-gap | yes | 1/1 | 0, 0 | 1.0132 (0.9718 to 1.1192) | 400 Hant -3.3%; 700 Hant -2.8% | documented-visual candidate |
| Microsoft YaHei | script-gap | yes | 1/1 | 0, 0 | 0.9991 (0.9984 to 1.1088) | 400 Hans -1.3%; 700 Hans -1.1% | documented-visual candidate |
| MingLiU | script-gap | no | 1/1 | 0, 0 | 1.0213 (0.9941 to 1.1393) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Miriam | script-gap | no | 1/1 | 0, 0 | 0.8732 (0.8494 to 0.885) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| MS Gothic | script-gap | yes | 1/1 | 0, 0 | 1.0392 (0.9965 to 1.1072) | 400 Jpan -5.0% | hold: real font wider than the replacement: native / preview ink width median 1.0371 on 7 line(s) of at least 200 pt (a full composed line overflows by about 4%) |
| MS Mincho | script-gap | no | 1/1 | 0, 0 | 1.0402 (0.9965 to 1.1072) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Nirmala UI | script-gap | yes | 1/1 | 3, 274.53 | 1.114 (1.0495 to 1.1718) | 400 Deva -6.2%; 400 Beng -7.2%; 400 Gujr -11.1%; 400 Knda -14.0%; 400 Mlym -9.5%; 400 Orya +3.5%; 400 Taml -2.7%; 400 Telu -12.9%; 400 Sinh +5.7%; 700 Deva -6.3%; 700 Beng -13.8%; 700 Gujr -10.0%; 700 Knda -14.7%; 700 Mlym -9.3%; 700 Orya +2.4%; 700 Taml +2.1%; 700 Telu -12.5%; 700 Sinh -2.9% | hold: real font wider than the replacement: native / preview ink width median 1.0758 on 2 line(s) of at least 200 pt (a full composed line overflows by about 8%) |
| Nyala | script-gap | no | 1/1 | 2, 37.78 | 0.9556 (0.8146 to 0.9711) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| PMingLiU | script-gap | no | 1/1 | 0, 0 | 0.9945 (0.8935 to 1.0719) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Raavi | script-gap | no | 1/1 | 1, 208.03 | 1.0601 (0.9669 to 1.0892) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Sakkal Majalla | script-gap | yes | 3/3 | 0, 0 | 0.6286 (0.4897 to 0.736) | 400 Arab +24.6%; 700 Arab +25.9% | hold: preview much wider than the real font: native / preview ink width median 0.5955 on 11 line(s) with no preview size adjustment |
| Segoe UI Emoji | visual-gap | yes | 1/1 | 0, 0 | 0.9475 (0.4327 to 1.2381) | - | documented-visual candidate |
| Shonar Bangla | script-gap | no | 1/1 | 2, 227.66 | 1.0504 (0.8016 to 1.1097) | - | hold: native overflow where the preview fits: 1 line box(es), max 3.66 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Shruti | script-gap | no | 1/1 | 2, 227.53 | 1.1249 (0.984 to 1.1992) | - | hold: native overflow where the preview fits: 1 line box(es), max 112.03 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| SimHei | script-gap | no | 1/1 | 0, 0 | 1.004 (0.9881 to 1.0964) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| SimSun | script-gap | yes | 1/1 | 0, 0 | 1.004 (0.9881 to 1.0668) | 400 Hans -1.1% | documented-visual candidate |
| Sylfaen | script-gap | yes | 2/2 | 1, 97.66 | 0.9446 (0.7222 to 0.9659) | 400 Armn +6.1%; 400 Geor +13.4% | documented-visual candidate |
| Symbol | code-table | yes | 1/1 | 0, 0 | 0.8999 (0.8868 to 1.2647) | - | documented-visual candidate |
| Traditional Arabic | script-gap | yes | 1/1 | 0, 0 | 0.5982 (0.4897 to 1) | 400 Arab +27.7%; 700 Arab +26.0% | hold: preview much wider than the real font: native / preview ink width median 0.5912 on 7 line(s) with no preview size adjustment |
| Tunga | script-gap | no | 1/1 | 2, 90.16 | 0.9154 (0.8491 to 0.9906) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Vrinda | script-gap | no | 1/1 | 2, 227.66 | 1.0874 (0.9622 to 1.1275) | - | hold: native overflow where the preview fits: 1 line box(es), max 3.66 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Webdings | code-table | yes | 1/1 | 0, 0 | 0.907 (0.641 to 0.9576) | - | documented-visual candidate |
| Wingdings | code-table | yes | 1/1 | 0, 0 | 0.9198 (0.883 to 1.617) | - | documented-visual candidate |
| Yu Gothic | script-gap | yes | 1/1 | 0, 0 | 1.0123 (1.0027 to 1.087) | 400 Jpan -1.4%; 700 Jpan -1.2% | documented-visual candidate |
