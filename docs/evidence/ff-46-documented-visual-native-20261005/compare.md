# FF-46 / RR-17 documented-visual: native comparison

Packages: @openpresentation/opf 0.12.1, @openpresentation/opf-render 0.12.0, @openpresentation/opf-pptx 0.12.3, fontkit 2.0.4, @resvg/resvg-js 2.6.2. PowerPoint 16.0 build 20430. Pixel size 1280 x 720.

PowerPoint does not re-wrap these decks: opf-pptx writes each laid-out line as its own single-line text box (`wrap="none"`, zero insets). "Line breaks" therefore means where each native line ends relative to its box (`TextRange.Lines` bounds), plus the PNG comparison.

## Decks

| Deck | Read | Fonts | Theme | Pres.Fonts | Slide family | Lines 1/box | Overflow (boxes, max pt) | Images close/review/far |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scripts-01-japanese-meiryo` | yes | pass | pass | pass | pass | 11/11 | 1, 13.28 | 0/0/3 |
| `scripts-02-japanese-yu-gothic` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-03-japanese-ms-gothic` | yes | pass | pass | pass | pass | 8/8 | 1, 35.78 | 0/1/1 |
| `scripts-04-japanese-ms-mincho` | yes | pass | pass | pass | pass | 8/8 | 1, 35.78 | 0/0/2 |
| `scripts-05-chinese-simplified-microsoft-yahei` | yes | pass | pass | pass | pass | 11/11 | 0, 0 | 2/1/0 |
| `scripts-06-chinese-simplified-simsun` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/1/1 |
| `scripts-07-chinese-simplified-simhei` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/2/0 |
| `scripts-08-chinese-simplified-fangsong` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-09-chinese-traditional-microsoft-jhenghei` | yes | pass | pass | pass | pass | 12/12 | 0, 0 | 0/2/1 |
| `scripts-10-chinese-traditional-mingliu` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/1/1 |
| `scripts-11-chinese-traditional-pmingliu` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/1/1 |
| `scripts-12-korean-malgun-gothic` | yes | pass | pass | pass | pass | 8/8 | 2, 130.78 | 0/0/2 |
| `scripts-13-korean-batang` | yes | pass | pass | pass | pass | 8/8 | 2, 139.53 | 0/0/2 |
| `scripts-14-korean-gungsuh` | yes | pass | pass | pass | pass | 8/8 | 2, 141.78 | 0/0/2 |
| `scripts-15-arabic-arabic-typesetting` | yes | pass | pass | pass | pass | 6/6 | 0, 0 | 0/0/2 |
| `scripts-16-arabic-traditional-arabic` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-17-arabic-sakkal-majalla` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-18-urdu-sakkal-majalla` | yes | pass | pass | pass | pass | 3/3 | 0, 0 | 0/0/1 |
| `scripts-19-persian-sakkal-majalla` | yes | pass | pass | pass | pass | 3/3 | 0, 0 | 0/0/1 |
| `scripts-20-hebrew-david` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-21-hebrew-gisha` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/1/1 |
| `scripts-22-hebrew-miriam` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-23-hindi-mangal` | yes | pass | pass | pass | pass | 8/8 | 3, 180.41 | 0/0/2 |
| `scripts-24-hindi-aparajita` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-25-hindi-nirmala-ui` | yes | pass | pass | pass | pass | 8/8 | 2, 55.28 | 0/0/2 |
| `scripts-26-bengali-vrinda` | yes | pass | pass | pass | pass | 7/7 | 2, 64.66 | 0/0/2 |
| `scripts-27-bengali-shonar-bangla` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-28-punjabi-raavi` | yes | pass | pass | pass | pass | 6/6 | 1, 72.78 | 0/0/2 |
| `scripts-29-gujarati-shruti` | yes | pass | pass | pass | pass | 7/7 | 2, 167.03 | 0/0/2 |
| `scripts-30-odia-kalinga` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-31-tamil-latha` | yes | pass | pass | pass | pass | 9/9 | 3, 89.16 | 0/0/2 |
| `scripts-32-telugu-gautami` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-33-kannada-tunga` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-34-malayalam-kartika` | yes | pass | pass | pass | pass | 10/10 | 4, 199.41 | 0/0/2 |
| `scripts-35-thai-angsana-new` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-36-thai-dilleniaupc` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-37-khmer-daunpenh` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-38-khmer-khmer-ui` | yes | pass | pass | pass | pass | 7/7 | 0, 0 | 0/0/2 |
| `scripts-39-amharic-nyala` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-40-amharic-ebrima` | yes | pass | pass | FAIL | pass | 8/8 | 3, 152.91 | 0/0/2 |
| `scripts-41-armenian-sylfaen` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/2 |
| `scripts-42-georgian-sylfaen` | yes | pass | pass | pass | pass | 6/6 | 1, 3.41 | 0/0/2 |
| `symbol-01-wingdings` | yes | pass | pass | pass | pass | 12/12 | 0, 0 | 0/0/6 |
| `symbol-02-webdings` | yes | pass | pass | pass | pass | 4/4 | 0, 0 | 0/0/2 |
| `symbol-03-symbol` | yes | pass | pass | pass | pass | 8/8 | 0, 0 | 0/0/4 |
| `emoji-math-01-segoe-ui-emoji` | yes | pass | pass | pass | pass | 22/22 | 0, 0 | 0/0/11 |
| `emoji-math-02-cambria-math` | yes | pass | pass | pass | pass | 26/26 | 0, 0 | 0/1/12 |
| `emoji-math-03-emoji-in-aptos-deck` | yes | pass | pass | pass | pass | 5/5 | 0, 0 | 0/0/2 |

## Families

| Family | Status | Installed (native host) | Names | Overflow (boxes, max pt) | Ink native/preview (median, range) | Width (replacement / original - 1) | Proposal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Angsana New | script-gap | yes | 1/1 | 0, 0 | 0.6971 (0.5692 to 0.7094) | 400 Thai +42.4%; 700 Thai +49.5% | hold: preview much wider than the real font: native / preview ink width median 0.6971 on 6 line(s) with no preview size adjustment; replacement width 400 Thai +42%, 700 Thai +50% with no preview size adjustment |
| Aparajita | script-gap | no | 1/1 | 0, 0 | 0.9227 (0.7145 to 0.9472) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Arabic Typesetting | script-gap | yes | 1/1 | 0, 0 | 0.9306 (0.5509 to 1.0369) | 400 Arab +56.0% | documented-visual candidate |
| Batang | script-gap | no | 1/1 | 2, 139.53 | 1.0675 (0.9862 to 1.1146) | - | hold: native overflow where the preview fits: 2 line box(es), max 139.53 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| BatangChe | script-gap | no | 1/1 | 2, 139.53 | 1.0675 (0.9862 to 1.1146) | - | hold: native overflow where the preview fits: 2 line box(es), max 139.53 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Cambria Math | visual-gap | yes | 1/1 | 0, 0 | 0.9688 (0.8117 to 1.1073) | - | documented-visual candidate |
| DaunPenh | script-gap | no | 1/1 | 0, 0 | 0.5673 (0.5158 to 0.5889) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| David | script-gap | no | 1/1 | 0, 0 | 0.9025 (0.8522 to 0.9282) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| DilleniaUPC | script-gap | yes | 1/1 | 0, 0 | 0.6392 (0.589 to 0.6698) | 400 Thai +55.5%; 700 Thai +59.9% | hold: preview much wider than the real font: native / preview ink width median 0.6392 on 7 line(s) with no preview size adjustment; replacement width 400 Thai +55%, 700 Thai +60% with no preview size adjustment |
| Ebrima | script-gap | yes | 0/1 | 3, 152.91 | 1.0745 (1.0348 to 1.0863) | 400 Ethi -7.1%; 700 Ethi -8.9% | hold: name read-back failed (scripts-40-amharic-ebrima); real font wider than the replacement: native / preview ink width median 1.074 on 3 line(s) of at least 200 pt (a full composed line overflows by about 7%) |
| FangSong | script-gap | no | 1/1 | 0, 0 | 0.9981 (0.9827 to 1.0323) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Gautami | script-gap | no | 1/1 | 0, 0 | 0.9973 (0.8579 to 1.0543) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Gisha | script-gap | no | 1/1 | 0, 0 | 0.9636 (0.9489 to 1.0061) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Gungsuh | script-gap | no | 1/1 | 2, 141.78 | 1.0606 (0.948 to 1.1123) | - | hold: native overflow where the preview fits: 2 line box(es), max 141.78 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| GungsuhChe | script-gap | no | 1/1 | 2, 141.78 | 1.0606 (0.948 to 1.1123) | - | hold: native overflow where the preview fits: 2 line box(es), max 141.78 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Kalinga | script-gap | no | 1/1 | 0, 0 | 0.8911 (0.8231 to 0.9885) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Kartika | script-gap | no | 1/1 | 4, 199.41 | 1.0943 (0.937 to 1.2336) | - | hold: native overflow where the preview fits: 4 line box(es), max 199.41 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Khmer UI | script-gap | no | 1/1 | 0, 0 | 1.1166 (0.9355 to 1.1681) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Latha | script-gap | no | 1/1 | 3, 89.16 | 1.081 (0.8968 to 1.187) | - | hold: native overflow where the preview fits: 3 line box(es), max 89.16 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Malgun Gothic | script-gap | yes | 1/1 | 2, 130.78 | 1.0547 (0.9787 to 2.0928) | 400 Kore -6.6%; 700 Kore -6.4% | hold: native overflow where the preview fits: 2 line box(es), max 130.78 pt past the box; real font wider than the replacement: native / preview ink width median 1.0494 on 4 line(s) of at least 200 pt (a full composed line overflows by about 5%) |
| Mangal | script-gap | no | 1/1 | 3, 180.41 | 1.151 (1 to 1.2547) | - | hold: native overflow where the preview fits: 3 line box(es), max 180.41 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Meiryo | script-gap | no | 1/1 | 1, 13.28 | 1.0236 (1.0011 to 1.087) | - | hold: native overflow where the preview fits: 1 line box(es), max 13.28 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Microsoft JhengHei | script-gap | yes | 1/1 | 0, 0 | 0.9978 (0.9718 to 1.1192) | 400 Hant -3.3%; 700 Hant -2.8% | documented-visual candidate |
| Microsoft YaHei | script-gap | yes | 1/1 | 0, 0 | 0.9991 (0.9984 to 1.0524) | 400 Hans -1.3%; 700 Hans -1.1% | documented-visual candidate |
| MingLiU | script-gap | no | 1/1 | 0, 0 | 1.0033 (0.9948 to 1.1416) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Miriam | script-gap | no | 1/1 | 0, 0 | 0.8986 (0.8016 to 0.9411) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| MS Gothic | script-gap | yes | 1/1 | 1, 35.78 | 1.0265 (0.9912 to 1.1028) | 400 Jpan -5.0% | hold: native overflow where the preview fits: 1 line box(es), max 35.78 pt past the box; real font wider than the replacement: native / preview ink width median 1.0241 on 7 line(s) of at least 200 pt (a full composed line overflows by about 2%) |
| MS Mincho | script-gap | no | 1/1 | 1, 35.78 | 1.0051 (0.942 to 1.1028) | - | hold: native overflow where the preview fits: 1 line box(es), max 35.78 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Nirmala UI | script-gap | yes | 1/1 | 2, 55.28 | 1.0266 (0.9316 to 1.0763) | 400 Deva -6.2%; 400 Beng -7.2%; 400 Gujr -11.1%; 400 Knda -14.0%; 400 Mlym -9.5%; 400 Orya +3.5%; 400 Taml -2.7%; 400 Telu -12.9%; 400 Sinh +5.7%; 700 Deva -6.3%; 700 Beng -13.8%; 700 Gujr -10.0%; 700 Knda -14.7%; 700 Mlym -9.3%; 700 Orya +2.4%; 700 Taml +2.1%; 700 Telu -12.5%; 700 Sinh -2.9% | hold: native overflow where the preview fits: 2 line box(es), max 55.28 pt past the box; real font wider than the replacement: native / preview ink width median 1.0266 on 5 line(s) of at least 200 pt (a full composed line overflows by about 3%) |
| Nyala | script-gap | no | 1/1 | 0, 0 | 0.9581 (0.7259 to 0.9711) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| PMingLiU | script-gap | no | 1/1 | 0, 0 | 0.9956 (0.8275 to 1.0742) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Raavi | script-gap | no | 1/1 | 1, 72.78 | 1.0615 (0.8702 to 1.0909) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Sakkal Majalla | script-gap | yes | 3/3 | 0, 0 | 0.8051 (0.6493 to 0.9075) | 400 Arab +24.6%; 700 Arab +25.9% | hold: replacement width 400 Arab +25%, 700 Arab +26% with no preview size adjustment |
| Segoe UI Emoji | visual-gap | yes | 1/1 | 0, 0 | 0.9475 (0.4327 to 1.2381) | - | documented-visual candidate |
| Shonar Bangla | script-gap | no | 1/1 | 0, 0 | 0.7217 (0.7066 to 0.7984) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Shruti | script-gap | no | 1/1 | 2, 167.03 | 1.0594 (0.8333 to 1.1941) | - | hold: native overflow where the preview fits: 2 line box(es), max 167.03 pt past the box; not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| SimHei | script-gap | no | 1/1 | 0, 0 | 1.0048 (0.9896 to 1.0323) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| SimSun | script-gap | yes | 1/1 | 0, 0 | 1.0008 (0.9808 to 1.0363) | 400 Hans -1.1% | documented-visual candidate |
| Sylfaen | script-gap | yes | 2/2 | 1, 3.41 | 0.9402 (0.7222 to 0.9659) | 400 Armn +6.1%; 400 Geor +13.4% | documented-visual candidate |
| Symbol | code-table | yes | 1/1 | 0, 0 | 0.901 (0.8868 to 1.2647) | - | documented-visual candidate |
| Traditional Arabic | script-gap | yes | 1/1 | 0, 0 | 0.842 (0.7419 to 0.8969) | 400 Arab +27.7%; 700 Arab +26.0% | hold: replacement width 400 Arab +28%, 700 Arab +26% with no preview size adjustment |
| Tunga | script-gap | no | 1/1 | 0, 0 | 0.9731 (0.8086 to 0.9906) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Vrinda | script-gap | no | 1/1 | 2, 64.66 | 1.0744 (0.8608 to 1.1275) | - | hold: not installed on the native host: PowerPoint drew a substitute, so the real face was not compared |
| Webdings | code-table | yes | 1/1 | 0, 0 | 0.9085 (0.641 to 0.9576) | - | documented-visual candidate |
| Wingdings | code-table | yes | 1/1 | 0, 0 | 0.9209 (0.883 to 1.617) | - | documented-visual candidate |
| Yu Gothic | script-gap | yes | 1/1 | 0, 0 | 1.0075 (0.9855 to 1.0343) | 400 Jpan -1.4%; 700 Jpan -1.2% | documented-visual candidate |
