# Keynote comparison

Source decks exported with @openpresentation/opf 0.12.0, @openpresentation/opf-pptx 0.12.2, @openpresentation/opf-render 0.12.0.

PASS 0, WARN 14, FAIL 6, MISSING 0

| Deck | Status | PDF pages | PPTX slides | PPTX charts | Findings (FAIL/WARN) |
|---|---|---|---|---|---|
| 01-latin-rich-text | WARN | 3 | 3 | 0 | 1 |
| 02-fonts-serif-mono-code | WARN | 3 | 3 | 0 | 2 |
| 03-cjk-japanese | WARN | 3 | 3 | 0 | 2 |
| 04-devanagari-hindi | WARN | 3 | 3 | 0 | 5 |
| 05-rtl-arabic | WARN | 3 | 3 | 0 | 5 |
| 06-rtl-hebrew | WARN | 3 | 3 | 0 | 5 |
| 07-bullets-numbered | WARN | 4 | 4 | 0 | 1 |
| 08-tables | WARN | 2 | 2 | 0 | 1 |
| 09-charts-core | FAIL | 8 | 8 | 1 | 9 |
| 10-charts-variants | FAIL | 6 | 6 | 0 | 8 |
| 11-charts-chartex | WARN | 6 | 6 | 0 | 2 |
| 12-svg-png-fallback | WARN | 2 | 2 | 0 | 2 |
| 13-header-footer-numbers | WARN | 3 | 3 | 0 | 1 |
| 14-speaker-notes | WARN | 3 | 3 | 0 | 2 |
| 15-backgrounds | WARN | 5 | 5 | 0 | 2 |
| 16-footnotes-captions | FAIL | 2 | 2 | 0 | 2 |
| 17-gallery-bold | FAIL | 4 | 4 | 0 | 2 |
| 18-gallery-classic | FAIL | 4 | 4 | 0 | 3 |
| 19-gallery-dark | WARN | 4 | 4 | 1 | 2 |
| 20-gallery-minimal-indic | FAIL | 4 | 4 | 0 | 3 |

## 01-latin-rich-text (WARN)

Latin text and rich runs

- INFO: PDF fonts (all) - AAAAAB+Georgia, AAAAAC+Georgia-Bold, AAAAAD+Georgia-Italic
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Georgia, Helvetica
- WARN: PPTX language tags lost - en-US

## 02-fonts-serif-mono-code (WARN)

Serif body, monospace code, quote and metric

- WARN: PDF fonts: named in the deck but not embedded - Roboto Mono (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+TimesNewRomanPS-BoldMT, AAAAAC+Helvetica-Bold, AAAAAD+Helvetica, AAAAAE+TimesNewRomanPSMT
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Helvetica, Roboto Mono, Times New Roman
- WARN: PPTX language tags lost - en-US

## 03-cjk-japanese (WARN)

Japanese (East Asian script)

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display, Meiryo (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - PingFangSC, HiraginoSans-W6, HiraginoSans-W3, Helvetica
- INFO: PDF fonts (all) - AAAAAC+PingFangSC-Semibold, AAAAAD+HiraginoSans-W6, AAAAAF+PingFangSC-Regular, AAAAAG+HiraginoSans-W3, AAAAAH+Helvetica
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica, Meiryo
- WARN: PPTX language tags lost - ja-JP

## 04-devanagari-hindi (WARN)

Hindi (Devanagari, complex script)

- WARN: PDF slide 1: text found but not contiguous - ग्रामीण भुगतान परियोजना  (reordered)
- WARN: PDF slide 2: text found but not contiguous - मुख्य बिंदु  (reordered) | किसानों के लिए सरल भुगतान  (reordered) | हर महीने प्रगति की समीक्षा  (reordered)
- WARN: PDF slide 3: text found but not contiguous - यह स्लाइड संयुक्ताक्षर और मात्राओं की जाँच करती है: क्षत्रिय, ज्ञान, श्री, द्वारा।  (reordered)
- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display, Mangal (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - KohinoorDevanagari, Helvetica
- INFO: PDF fonts (all) - AAAAAC+KohinoorDevanagari-Bold, AAAAAD+Helvetica-Bold, AAAAAF+KohinoorDevanagari-Regular, AAAAAG+Helvetica
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica, Mangal
- WARN: PPTX language tags lost - hi-IN

## 05-rtl-arabic (WARN)

Arabic (right-to-left)

- WARN: PDF slide 1: text found but not contiguous - الخدمات الرقمية  (words) | ملخص تنفيذي  (words)
- WARN: PDF slide 2: text found but not contiguous - النقاط الرئيسية  (words) | تبسيط الخدمات للمواطنين  (reordered) | تقليل وقت المعالجة إلى 5 أيام  (reordered) | قياس الرضا كل ربع سنة  (words)
- WARN: PDF slide 3: text found but not contiguous - المؤشرات  (reordered)
- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display, Arabic Typesetting (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - GeezaPro, Helvetica
- INFO: PDF fonts (all) - AAAAAC+GeezaPro, AAAAAD+Helvetica
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Arabic Typesetting, Helvetica
- WARN: PPTX language tags lost - ar-SA

## 06-rtl-hebrew (WARN)

Hebrew (right-to-left)

- WARN: PDF slide 1: text found but not contiguous - סקירת רבעון  (words) | תוצאות ותוכניות  (words)
- WARN: PDF slide 2: text found but not contiguous - נקודות עיקריות  (words) | ההכנסות עלו ב-18%  (reordered) | השקנו את OPF בשלושה שווקים  (words) | היעד הבא: 2027  (reordered)
- WARN: PDF slide 3: text found but not contiguous - "התכנון הטוב ביותר הוא זה שנראה לעין."  (reordered) | דנה לוי  (words)
- WARN: PDF fonts: named in the deck but not embedded - David, Tenorite, Tenorite Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - LucidaGrande, Helvetica
- INFO: PDF fonts (all) - AAAAAC+LucidaGrande-Bold, AAAAAD+Helvetica-Bold, AAAAAF+LucidaGrande, AAAAAG+Helvetica
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - David, Helvetica, Tenorite, Tenorite Display
- WARN: PPTX language tags lost - en-US, he-IL

## 07-bullets-numbered (WARN)

Bullets, nesting and numbered lists

- INFO: PDF fonts (all) - AAAAAB+Arial-Black, AAAAAC+ArialMT, AAAAAD+ArialMT
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX slide 4: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Arial, Arial Black, Helvetica
- WARN: PPTX language tags lost - en-US

## 08-tables (WARN)

Tables

- INFO: PDF fonts (all) - AAAAAC+Calibri-Bold, AAAAAE+Calibri
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Calibri, Helvetica
- WARN: PPTX language tags lost - en-US

## 09-charts-core (FAIL)

Native chart families (core)

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica-Bold, AAAAAC+Helvetica
- FAIL: PPTX slide 1: chart lost - expected bar:col:clustered; pictures on the slide: 0
- INFO: PPTX slide 1: background - expected solid, got inherit
- FAIL: PPTX slide 2: chart lost - expected bar:bar:clustered; pictures on the slide: 0
- INFO: PPTX slide 2: background - expected solid, got inherit
- FAIL: PPTX slide 3: chart lost - expected line:standard; pictures on the slide: 0
- INFO: PPTX slide 3: background - expected solid, got inherit
- FAIL: PPTX slide 4: chart lost - expected pie; pictures on the slide: 0
- INFO: PPTX slide 4: background - expected solid, got inherit
- FAIL: PPTX slide 5: chart lost - expected doughnut; pictures on the slide: 0
- INFO: PPTX slide 5: background - expected solid, got inherit
- FAIL: PPTX slide 6: chart lost - expected area:standard; pictures on the slide: 0
- INFO: PPTX slide 6: background - expected solid, got inherit
- INFO: PPTX slide 7: background - expected solid, got inherit
- FAIL: PPTX slide 8: chart lost - expected radar:standard; pictures on the slide: 0
- INFO: PPTX slide 8: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-US

## 10-charts-variants (FAIL)

Native chart variants (stacked, percent, markers, filled)

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica-Bold
- FAIL: PPTX slide 1: chart lost - expected bar:col:stacked; pictures on the slide: 0
- INFO: PPTX slide 1: background - expected solid, got inherit
- FAIL: PPTX slide 2: chart lost - expected bar:col:percentStacked; pictures on the slide: 0
- INFO: PPTX slide 2: background - expected solid, got inherit
- FAIL: PPTX slide 3: chart lost - expected line:standard; pictures on the slide: 0
- INFO: PPTX slide 3: background - expected solid, got inherit
- FAIL: PPTX slide 4: chart lost - expected area:stacked; pictures on the slide: 0
- INFO: PPTX slide 4: background - expected solid, got inherit
- FAIL: PPTX slide 5: chart lost - expected radar:filled; pictures on the slide: 0
- INFO: PPTX slide 5: background - expected solid, got inherit
- FAIL: PPTX slide 6: chart lost - expected bar:bar:clustered; pictures on the slide: 0
- INFO: PPTX slide 6: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-US

## 11-charts-chartex (WARN)

Office 2016 chartex families

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica-Bold
- INFO: PPTX slide 1: chartex waterfall - no chart part; pictures on the slide: 0
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: chartex funnel - no chart part; pictures on the slide: 0
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: chartex treemap - no chart part; pictures on the slide: 0
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX slide 4: chartex clusteredColumn - no chart part; pictures on the slide: 0
- INFO: PPTX slide 4: background - expected solid, got inherit
- INFO: PPTX slide 5: chartex clusteredColumn,paretoLine - no chart part; pictures on the slide: 0
- INFO: PPTX slide 5: background - expected solid, got inherit
- INFO: PPTX slide 6: chartex boxWhisker - no chart part; pictures on the slide: 0
- INFO: PPTX slide 6: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-US

## 12-svg-png-fallback (WARN)

SVG picture with PNG fallback

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica-Bold, AAAAAC+Helvetica
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-US

## 13-header-footer-numbers (WARN)

Native header, footer and slide numbers

- INFO: PDF fonts (all) - AAAAAC+Calibri, AAAAAE+Calibri-Bold
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Calibri, Helvetica
- WARN: PPTX language tags lost - en-US

## 14-speaker-notes (WARN)

Speaker notes

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica-Bold, AAAAAC+Helvetica
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-US

## 15-backgrounds (WARN)

Slide backgrounds: solid, gradient, pattern, image

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica-Bold, AAAAAC+Helvetica
- INFO: PPTX slide 3: background - expected pattern:wdUpDiag, got image
- INFO: PPTX slide 4: background - expected pattern:smGrid, got image
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-US

## 16-footnotes-captions (FAIL)

Footnotes, citations and captions

- INFO: PDF fonts (all) - AAAAAB+Georgia-Bold, AAAAAC+Georgia
- INFO: PPTX slide 1: background - expected solid, got inherit
- FAIL: PPTX slide 2: chart lost - expected bar:col:clustered; pictures on the slide: 0
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Georgia, Helvetica
- WARN: PPTX language tags lost - en-US

## 17-gallery-bold (FAIL)

Gallery theme: bold

- INFO: PDF fonts (all) - AAAAAB+Tahoma, AAAAAC+Tahoma-Bold
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- FAIL: PPTX slide 3: chart lost - expected bar:col:percentStacked; pictures on the slide: 0
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX slide 4: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Helvetica, Tahoma
- WARN: PPTX language tags lost - en-US

## 18-gallery-classic (FAIL)

Gallery theme: classic

- WARN: PDF fonts: named in the deck but not embedded - Tenorite, Tenorite Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica, AAAAAC+Helvetica-Bold
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- FAIL: PPTX slide 3: chart lost - expected bar:col:percentStacked; pictures on the slide: 0
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX slide 4: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Helvetica, Tenorite, Tenorite Display
- WARN: PPTX language tags lost - en-GB

## 19-gallery-dark (WARN)

Gallery theme: dark

- WARN: PDF fonts: named in the deck but not embedded - Meiryo (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica, AAAAAC+Helvetica-Bold
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX slide 4: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Helvetica, Meiryo
- WARN: PPTX language tags lost - en-CA

## 20-gallery-minimal-indic (FAIL)

Gallery theme: minimal (international example)

- WARN: PDF fonts: named in the deck but not embedded - Aptos, Aptos Display (substituted or not used by the text on these pages)
- INFO: PDF fonts: embedded but not named in the deck - Helvetica
- INFO: PDF fonts (all) - AAAAAB+Helvetica, AAAAAC+Helvetica-Bold
- INFO: PPTX slide 1: background - expected solid, got inherit
- INFO: PPTX slide 2: background - expected solid, got inherit
- FAIL: PPTX slide 3: chart lost - expected bar:bar:clustered; pictures on the slide: 0
- INFO: PPTX slide 3: background - expected solid, got inherit
- INFO: PPTX slide 4: background - expected solid, got inherit
- INFO: PPTX fonts (Keynote export) - Aptos, Aptos Display, Helvetica
- WARN: PPTX language tags lost - en-IN
