# FF-46 / RR-17 native compare (0.18)

Generated 2026-10-10T21:50:11.217Z by `compare.mjs` from the native read-outs of `native/attempt-1`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4. PowerPoint 16.0 build 20430, Microsoft Windows NT 10.0.26200.0, culture en-US.

## FF-46 / RR-17

Criterion: Names as FF-12; the script runs name the deck family; every exported line box reads one native line; no native-only overflow past the box (> 0.5 pt); native / preview ink on lines of at least 200 pt within 0.80 to 1.01. Image scores are reported, not gated.

Decks: **24 PASS, 25 FINDING, 1 FAIL, 0 not run** of 50. Families: 21 of 46 pass.

| Family | Outcome | Long-line ink (native / preview) | Reasons |
| --- | --- | ---: | --- |
| Angsana New | FINDING | 0.7112 | scripts-37-th-angsana-new: native ink 0.7112499999999999 of the preview: the preview is wider |
| Aparajita | PASS | 0.9366 | - |
| Arabic Typesetting | PASS | 0.9082 | - |
| Batang | FINDING | 1.0649 | scripts-13-ko-batang: 3 boxes overflow only natively (max 144.78 pt); scripts-13-ko-batang: native ink 1.0649 of the preview: the real font is wider |
| BatangChe | FINDING | 1.0605 | scripts-14-ko-batangche: 3 boxes overflow only natively (max 185.78 pt); scripts-14-ko-batangche: native ink 1.0605 of the preview: the real font is wider |
| Cambria Math | PASS | 0.9869 | - |
| DaunPenh | FINDING | 0.5579 | scripts-39-km-daunpenh: native ink 0.55795 of the preview: the preview is wider |
| David | PASS | 0.9103 | - |
| DilleniaUPC | FINDING | 0.6452 | scripts-38-th-dilleniaupc: native ink 0.6452 of the preview: the preview is wider |
| Ebrima | FAIL | 1.0704 | scripts-42-am-ebrima: Presentation.Fonts extras Nyala missing -; scripts-42-am-ebrima: 2 boxes overflow only natively (max 67.28 pt); scripts-42-am-ebrima: native ink 1.0704 of the preview: the real font is wider |
| FangSong | PASS | 1.0075 | - |
| Gautami | PASS | 0.9879 | - |
| Gisha | PASS | 0.966 | - |
| Gungsuh | FINDING | 1.0581 | scripts-15-ko-gungsuh: 3 boxes overflow only natively (max 143.53 pt); scripts-15-ko-gungsuh: native ink 1.0581 of the preview: the real font is wider |
| GungsuhChe | FINDING | 1.0663 | scripts-16-ko-gungsuhche: 3 boxes overflow only natively (max 185.78 pt); scripts-16-ko-gungsuhche: native ink 1.0663 of the preview: the real font is wider |
| Kalinga | PASS | 0.8916 | - |
| Kartika | FINDING | 1.1514 | scripts-36-ml-kartika: 4 boxes overflow only natively (max 199.41 pt); scripts-36-ml-kartika: native ink 1.15135 of the preview: the real font is wider |
| Khmer UI | FINDING | 1.1119 | scripts-40-km-khmer-ui: native ink 1.1119 of the preview: the real font is wider |
| Latha | FINDING | 1.0905 | scripts-33-ta-latha: 5 boxes overflow only natively (max 123.53 pt); scripts-33-ta-latha: native ink 1.0905 of the preview: the real font is wider |
| Malgun Gothic | FINDING | 1.0359 | scripts-12-ko-malgun-gothic: 3 boxes overflow only natively (max 136.03 pt); scripts-12-ko-malgun-gothic: native ink 1.03585 of the preview: the real font is wider |
| Mangal | FINDING | 1.158 | scripts-25-hi-mangal: 4 boxes overflow only natively (max 192.03 pt); scripts-25-hi-mangal: native ink 1.15795 of the preview: the real font is wider |
| Meiryo | FINDING | 1.0298 | scripts-01-ja-meiryo: 2 boxes overflow only natively (max 26.91 pt); scripts-01-ja-meiryo: native ink 1.0297999999999998 of the preview: the real font is wider |
| Microsoft JhengHei | PASS | 1.0099 | - |
| Microsoft YaHei | FINDING | 1.0118 | scripts-05-zh-hans-microsoft-yahei: native ink 1.0118 of the preview: the real font is wider |
| MingLiU | PASS | 0.9986 | - |
| Miriam | PASS | 0.9287 | - |
| MS Gothic | FINDING | 1.037 | scripts-03-ja-ms-gothic: 2 boxes overflow only natively (max 35.78 pt); scripts-03-ja-ms-gothic: native ink 1.037 of the preview: the real font is wider |
| MS Mincho | FINDING | 1.0361 | scripts-04-ja-ms-mincho: 2 boxes overflow only natively (max 35.78 pt); scripts-04-ja-ms-mincho: native ink 1.0361 of the preview: the real font is wider |
| Nirmala UI | FINDING | 1.0697 | scripts-27-hi-nirmala-ui: 4 boxes overflow only natively (max 47.66 pt); scripts-27-hi-nirmala-ui: native ink 1.0697 of the preview: the real font is wider |
| Nyala | PASS | 0.9507 | - |
| PMingLiU | PASS | 0.9988 | - |
| Raavi | FINDING | 1.0865 | scripts-30-pa-guru-raavi: native ink 1.08655 of the preview: the real font is wider |
| Sakkal Majalla | PASS | 0.8159 | - |
| Segoe UI Emoji | FINDING | 1 | emoji-math-01-segoe-ui-emoji: 1 boxes overflow only natively (max 75.78 pt) |
| Shonar Bangla | FINDING | 0.7371 | scripts-29-bn-shonar-bangla: native ink 0.7371000000000001 of the preview: the preview is wider |
| Shruti | FINDING | 1.084 | scripts-31-gu-shruti: 2 boxes overflow only natively (max 167.03 pt); scripts-31-gu-shruti: native ink 1.084 of the preview: the real font is wider |
| SimHei | PASS | 1.0085 | - |
| SimSun | PASS | 1.008 | - |
| Sylfaen | PASS | 0.8413 | - |
| Symbol | PASS | 1.0025 | - |
| Traditional Arabic | FINDING | 0.7964 | scripts-18-ar-traditional-arabic: native ink 0.79635 of the preview: the preview is wider |
| Tunga | PASS | 0.9501 | - |
| Vrinda | FINDING | 1.0776 | scripts-28-bn-vrinda: native ink 1.07755 of the preview: the real font is wider |
| Webdings | PASS | 1 | - |
| Wingdings | PASS | 1.0007 | - |
| Yu Gothic | FINDING | 1.0076 | scripts-02-ja-yu-gothic: 2 boxes overflow only natively (max 10.53 pt) |

| Deck | Verdict | Names | Lines (single / boxes) | Native-only overflow | Ink median (long) | Images close / review / far |
| --- | --- | --- | --- | --- | --- | --- |
| scripts-01-ja-meiryo | FINDING | ok | 13 / 13 | 2 | 1.0351 (1.0298) | 0 / 2 / 0 |
| scripts-02-ja-yu-gothic | FINDING | ok | 13 / 13 | 2 | 1.0101 (1.0076) | 2 / 0 / 0 |
| scripts-03-ja-ms-gothic | FINDING | ok | 14 / 14 | 2 | 1.037 (1.037) | 1 / 1 / 0 |
| scripts-04-ja-ms-mincho | FINDING | ok | 13 / 13 | 2 | 1.0361 (1.0361) | 1 / 1 / 0 |
| scripts-05-zh-hans-microsoft-yahei | FINDING | ok | 12 / 12 | 0 | 1.0126 (1.0118) | 2 / 0 / 0 |
| scripts-06-zh-hans-simsun | PASS | ok | 12 / 12 | 0 | 1.008 (1.008) | 2 / 0 / 0 |
| scripts-07-zh-hans-simhei | PASS | ok | 12 / 12 | 0 | 1.0085 (1.0085) | 2 / 0 / 0 |
| scripts-08-zh-hans-fangsong | PASS | ok | 12 / 12 | 0 | 1.0075 (1.0075) | 2 / 0 / 0 |
| scripts-09-zh-hant-microsoft-jhenghei | PASS | ok | 12 / 12 | 0 | 1.0111 (1.0099) | 2 / 0 / 0 |
| scripts-10-zh-hant-mingliu | PASS | ok | 12 / 12 | 0 | 0.9986 (0.9986) | 2 / 0 / 0 |
| scripts-11-zh-hant-pmingliu | PASS | ok | 12 / 12 | 0 | 0.9976 (0.9988) | 2 / 0 / 0 |
| scripts-12-ko-malgun-gothic | FINDING | ok | 10 / 10 | 3 | 1.0379 (1.0359) | 2 / 0 / 0 |
| scripts-13-ko-batang | FINDING | ok | 11 / 11 | 3 | 1.0649 (1.0649) | 1 / 1 / 0 |
| scripts-14-ko-batangche | FINDING | ok | 11 / 11 | 3 | 1.0754 (1.0605) | 0 / 2 / 0 |
| scripts-15-ko-gungsuh | FINDING | ok | 11 / 11 | 3 | 1.0581 (1.0581) | 1 / 1 / 0 |
| scripts-16-ko-gungsuhche | FINDING | ok | 11 / 11 | 3 | 1.0783 (1.0663) | 0 / 2 / 0 |
| scripts-17-ar-arabic-typesetting | PASS | ok | 10 / 10 | 0 | 0.9512 (0.9082) | 2 / 0 / 0 |
| scripts-18-ar-traditional-arabic | FINDING | ok | 12 / 12 | 0 | 0.7964 (0.7964) | 1 / 1 / 0 |
| scripts-19-ar-sakkal-majalla | PASS | ok | 12 / 12 | 0 | 0.8217 (0.8105) | 1 / 1 / 0 |
| scripts-20-ur-sakkal-majalla | PASS | ok | 11 / 11 | 0 | 0.8167 (0.8167) | 1 / 1 / 0 |
| scripts-21-fa-sakkal-majalla | PASS | ok | 11 / 11 | 0 | 0.8235 (0.8159) | 1 / 1 / 0 |
| scripts-22-he-david | PASS | ok | 12 / 12 | 0 | 0.9103 (0.9103) | 2 / 0 / 0 |
| scripts-23-he-gisha | PASS | ok | 12 / 12 | 0 | 0.966 (0.966) | 2 / 0 / 0 |
| scripts-24-he-miriam | PASS | ok | 12 / 12 | 0 | 0.9287 (0.9287) | 2 / 0 / 0 |
| scripts-25-hi-mangal | FINDING | ok | 11 / 11 | 4 | 1.158 (1.158) | 0 / 2 / 0 |
| scripts-26-hi-aparajita | PASS | ok | 11 / 11 | 0 | 0.9366 (0.9366) | 1 / 1 / 0 |
| scripts-27-hi-nirmala-ui | FINDING | ok | 11 / 11 | 4 | 1.0734 (1.0697) | 0 / 2 / 0 |
| scripts-28-bn-vrinda | FINDING | ok | 11 / 11 | 0 | 1.0776 (1.0776) | 1 / 1 / 0 |
| scripts-29-bn-shonar-bangla | FINDING | ok | 11 / 11 | 0 | 0.7461 (0.7371) | 1 / 1 / 0 |
| scripts-30-pa-guru-raavi | FINDING | ok | 7 / 7 | 0 | 1.074 (1.0865) | 1 / 1 / 0 |
| scripts-31-gu-shruti | FINDING | ok | 8 / 8 | 2 | 1.084 (1.084) | 2 / 0 / 0 |
| scripts-32-or-kalinga | PASS | ok | 8 / 8 | 0 | 0.8934 (0.8916) | 2 / 0 / 0 |
| scripts-33-ta-latha | FINDING | ok | 13 / 13 | 5 | 1.0858 (1.0905) | 0 / 2 / 0 |
| scripts-34-te-gautami | PASS | ok | 9 / 9 | 0 | 0.9955 (0.9879) | 0 / 2 / 0 |
| scripts-35-kn-tunga | PASS | ok | 8 / 8 | 0 | 0.9501 (0.9501) | 1 / 1 / 0 |
| scripts-36-ml-kartika | FINDING | ok | 12 / 12 | 4 | 1.1261 (1.1514) | 0 / 2 / 0 |
| scripts-37-th-angsana-new | FINDING | ok | 13 / 13 | 0 | 0.716 (0.7112) | 1 / 1 / 0 |
| scripts-38-th-dilleniaupc | FINDING | ok | 13 / 13 | 0 | 0.6463 (0.6452) | 1 / 1 / 0 |
| scripts-39-km-daunpenh | FINDING | ok | 9 / 9 | 0 | 0.5916 (0.5579) | 1 / 1 / 0 |
| scripts-40-km-khmer-ui | FINDING | ok | 9 / 9 | 0 | 1.1119 (1.1119) | 2 / 0 / 0 |
| scripts-41-am-nyala | PASS | ok | 8 / 8 | 0 | 0.9576 (0.9507) | 2 / 0 / 0 |
| scripts-42-am-ebrima | FAIL | FAIL | 8 / 8 | 2 | 1.0711 (1.0704) | 2 / 0 / 0 |
| scripts-43-hy-sylfaen | PASS | ok | 8 / 8 | 0 | 0.9516 (0.9543) | 2 / 0 / 0 |
| scripts-44-ka-sylfaen | PASS | ok | 7 / 7 | 0 | 0.8413 (0.8413) | 2 / 0 / 0 |
| symbol-01-wingdings | PASS | ok | 27 / 27 | 0 | 1 (1.0007) | 5 / 0 / 0 |
| symbol-02-webdings | PASS | ok | 27 / 27 | 0 | 1 (1) | 5 / 0 / 0 |
| symbol-03-symbol | PASS | ok | 27 / 27 | 0 | 1.0025 (1.0025) | 5 / 0 / 0 |
| emoji-math-01-segoe-ui-emoji | FINDING | ok | 12 / 12 | 1 | 1 (1) | 3 / 0 / 0 |
| emoji-math-02-cambria-math | PASS | ok | 11 / 11 | 0 | 0.9869 (0.9869) | 2 / 0 / 0 |
| emoji-math-03-emoji-in-aptos-deck | FINDING | ok | 7 / 7 | 0 | 1.0168 (1.0768) | 2 / 0 / 0 |
