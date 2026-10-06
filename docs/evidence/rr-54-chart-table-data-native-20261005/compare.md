# RR-54 native comparison, attempt 20261006T022119Z

Expected values: `expected.json` (OPF documents + documented format semantics, `lib/excel-display.mjs`). Read-outs: `out/20261006T022119Z` then `out/20261006T022136Z` then `out/20261006T021315Z`.

Summary: 13 PASS, 3 FAIL, 0 NOT RUN.

| Deck | C1 display | C2 Edit Data | C3 open + tags | C4 save copy |
| --- | --- | --- | --- | --- |
| rr54-formats | PASS | PASS | PASS | FAIL |
| rr54-datasets | PASS | PASS | PASS | FAIL |
| rr54-tables | PASS | PASS | PASS | PASS |
| rr54-spellings (supplementary) | PASS | FAIL | PASS | PASS |

Runs: rr54-formats/read exit 0, rr54-datasets/read exit 0, rr54-tables/read exit 0, rr54-spellings/read exit 0, rr54-formats/editdata/slide1 exit 0, rr54-formats/editdata/slide2 exit 0, rr54-formats/editdata/slide3 exit 0, rr54-formats/editdata/slide4 exit 0, rr54-formats/editdata/slide5 exit 0, rr54-formats/editdata/slide6 exit 0, rr54-datasets/editdata/slide1 exit 0, rr54-datasets/editdata/slide2 exit 0, rr54-datasets/editdata/slide4 exit 0, rr54-datasets/editdata/slide5 exit 0, rr54-datasets/editdata/slide6 exit 0, rr54-tables/editdata/slide2 exit 0, rr54-spellings/editdata/slide1 exit 0, rr54-spellings/editdata/slide2 exit 0, rr54-spellings/editdata/slide3 exit 0, rr54-spellings/editdata/slide4 exit 0, rr54-formats/read exit 0, rr54-datasets/read exit 0, rr54-tables/read exit 0, rr54-spellings/read exit 0, rr54-formats/save exit 0, rr54-datasets/save exit 0, rr54-tables/save exit 0, rr54-spellings/save exit 0

## rr54-formats

PowerPoint 16.0 build 20430.

### C1 Formatted labels, value axes and table text display as documented: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 column chart type | XlChartType in [51] | 51 |  |
| PASS | slide 1 series 1 "Revenue" name | "Revenue" | "Revenue" |  |
| PASS | slide 1 series 1 "Revenue" DataLabels.ShowValue | true | true |  |
| PASS | slide 1 series 1 "Revenue" DataLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| PASS | slide 1 series 1 "Revenue" point 1 (Q1, 12.4) label | "$12.4" | "$12.4" |  |
| PASS | slide 1 series 1 "Revenue" point 2 (Q2, 18.1) label | "$18.1" | "$18.1" |  |
| PASS | slide 1 series 1 "Revenue" point 3 (Q3, null) label | no label (gap) | HasDataLabel true, Text "" |  |
| PASS | slide 1 series 1 "Revenue" point 4 (Q4, 24.6) label | "$24.6" | "$24.6" |  |
| PASS | slide 1 series 2 "Margin" name | "Margin" | "Margin" |  |
| PASS | slide 1 series 2 "Margin" DataLabels.ShowValue | true | true |  |
| PASS | slide 1 series 2 "Margin" DataLabels.NumberFormat | "0%" | "0%" | OPF format "0%" |
| PASS | slide 1 series 2 "Margin" point 1 (Q1, 0.31) label | "31%" | "31%" |  |
| PASS | slide 1 series 2 "Margin" point 2 (Q2, 0.34) label | "34%" | "34%" |  |
| PASS | slide 1 series 2 "Margin" point 3 (Q3, 0.29) label | "29%" | "29%" |  |
| PASS | slide 1 series 2 "Margin" point 4 (Q4, 0.4) label | "40%" | "40%" |  |
| PASS | slide 1 series 3 "Units" name | "Units" | "Units" |  |
| PASS | slide 1 series 3 "Units" DataLabels.ShowValue | true | true |  |
| PASS | slide 1 series 3 "Units" DataLabels.NumberFormat | "#,##0 \"units\"" | "#,##0 \"units\"" | OPF format "#,##0 units" |
| PASS | slide 1 series 3 "Units" point 1 (Q1, 1200) label | "1,200 units" | "1,200 units" |  |
| PASS | slide 1 series 3 "Units" point 2 (Q2, 1800) label | "1,800 units" | "1,800 units" |  |
| PASS | slide 1 series 3 "Units" point 3 (Q3, 2400) label | "2,400 units" | "2,400 units" |  |
| PASS | slide 1 series 3 "Units" point 4 (Q4, 3100) label | "3,100 units" | "3,100 units" |  |
| PASS | slide 1 Axes(2) value TickLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| INFO | slide 1 Axes(2) tick texts (derived from the native scale 0..3500 step 500; not read natively) | "$0.0" "$500.0" "$1,000.0" "$1,500.0" "$2,000.0" "$2,500.0" "$3,000.0" "$3,500.0" | compare with the slide PNG |  |
| PASS | slide 2 line chart type | XlChartType in [4, 65] | 4 |  |
| PASS | slide 2 series 1 "Rate" name | "Rate" | "Rate" |  |
| PASS | slide 2 series 1 "Rate" DataLabels.ShowValue | true | true |  |
| PASS | slide 2 series 1 "Rate" DataLabels.NumberFormat | "0.00%" | "0.00%" | OPF format "0.00%" |
| PASS | slide 2 series 1 "Rate" point 1 (Jan, 0.0125) label | "1.25%" | "1.25%" |  |
| PASS | slide 2 series 1 "Rate" point 2 (Feb, 0.0131) label | "1.31%" | "1.31%" |  |
| PASS | slide 2 series 1 "Rate" point 3 (Mar, 0.0142) label | "1.42%" | "1.42%" |  |
| PASS | slide 2 series 1 "Rate" point 4 (Apr, 0.0139) label | "1.39%" | "1.39%" |  |
| PASS | slide 2 Axes(2) value TickLabels.NumberFormat | "0.00%" | "0.00%" | OPF format "0.00%" |
| INFO | slide 2 Axes(2) tick texts (derived from the native scale 0.0115..0.0145 step 0.0005; not read natively) | "1.15%" "1.20%" "1.25%" "1.30%" "1.35%" "1.40%" "1.45%" | compare with the slide PNG |  |
| PASS | slide 3 scatter chart type | XlChartType in [-4169, 72, 73, 74, 75] | -4169 |  |
| PASS | slide 3 series 1 "Price" name | "Price" | "Price" |  |
| PASS | slide 3 series 1 "Price" DataLabels.ShowValue | true | true |  |
| PASS | slide 3 series 1 "Price" DataLabels.NumberFormat | "$#,##0" | "\\$#,##0" | OPF format "$#,##0" |
| PASS | slide 3 series 1 "Price" point 1 (a, 1200) label | "$1,200" | "$1,200" |  |
| PASS | slide 3 series 1 "Price" point 2 (b, 1850) label | "$1,850" | "$1,850" |  |
| PASS | slide 3 series 1 "Price" point 3 (c, 2400) label | "$2,400" | "$2,400" |  |
| PASS | slide 3 Axes(2) y-value TickLabels.NumberFormat | "$#,##0" | "\\$#,##0" | OPF format "$#,##0" |
| INFO | slide 3 Axes(2) tick texts (derived from the native scale 0..3000 step 500; not read natively) | "$0" "$500" "$1,000" "$1,500" "$2,000" "$2,500" "$3,000" | compare with the slide PNG |  |
| PASS | slide 3 Axes(1) x-value TickLabels.NumberFormat | "0.0 \"kg\"" | "0.0 \"kg\"" | OPF format "0.0 kg" |
| INFO | slide 3 Axes(1) tick texts (derived from the native scale 0..4 step 0.5; not read natively) | "0.0 kg" "0.5 kg" "1.0 kg" "1.5 kg" "2.0 kg" "2.5 kg" "3.0 kg" "3.5 kg" "4.0 kg" | compare with the slide PNG |  |
| PASS | slide 4 pie chart type | XlChartType in [5] | 5 |  |
| PASS | slide 4 series 1 "Sales" name | "Sales" | "Sales" |  |
| PASS | slide 4 series 1 "Sales" DataLabels.ShowValue | false | false |  |
| PASS | slide 4 series 1 "Sales" DataLabels.ShowPercentage | true | true |  |
| PASS | slide 4 series 1 "Sales" DataLabels.ShowCategoryName | true | true |  |
| INFO | slide 4 series 1 "Sales" DataLabels.NumberFormat | PowerPoint percent form (not asserted) | "General" |  |
| PASS | slide 4 series 1 "Sales" point 1 (EMEA, 4200) label | contains "EMEA" and "33%" | "EMEA, 33%" | package join "EMEA, 33%" (exact) |
| PASS | slide 4 series 1 "Sales" point 2 (APAC, 3100) label | contains "APAC" and "24%" | "APAC, 24%" | package join "APAC, 24%" (exact) |
| PASS | slide 4 series 1 "Sales" point 3 (AMER, 5600) label | contains "AMER" and "43%" | "AMER, 43%" | package join "AMER, 43%" (exact) |
| PASS | slide 5 treemap chart type | XlChartType in [117] | 117 |  |
| PASS | slide 5 series 1 "Size" name | "Size" | "Size" |  |
| PASS | slide 5 series 1 "Size" DataLabels.ShowValue | true | true |  |
| PASS | slide 5 series 1 "Size" DataLabels.ShowCategoryName | true | true |  |
| INFO | slide 5 series 1 "Size" DataLabels.NumberFormat | "#,##0.0" | "" | chartex: verify on the slide PNG rr54-formats-slide05.png. OPF format "#,##0.0" |
| INFO | slide 5 series 1 "Size" point 1 (North, 5.25) label | contains "North" and "5.3" | null | chartex: verify on the slide PNG rr54-formats-slide05.png. package join "North, 5.3" |
| INFO | slide 5 series 1 "Size" point 2 (South, 3.5) label | contains "South" and "3.5" | null | chartex: verify on the slide PNG rr54-formats-slide05.png. package join "South, 3.5" |
| INFO | slide 5 series 1 "Size" point 3 (East, 2.75) label | contains "East" and "2.8" | null | chartex: verify on the slide PNG rr54-formats-slide05.png. package join "East, 2.8" |
| PASS | slide 6 column chart type | XlChartType in [51] | 51 |  |
| PASS | slide 6 series 1 "Value" name | "Value" | "Value" |  |
| PASS | slide 6 series 1 "Value" no value labels | HasDataLabels false or ShowValue false | HasDataLabels false, ShowValue false |  |
| PASS | slide 6 Axes(2) value TickLabels.NumberFormat | "General" | "General" | no OPF format (General) |
| INFO | slide 6 Axes(2) tick texts (derived from the native scale 0..14 step 2; not read natively) | "0" "2" "4" "6" "8" "10" "12" "14" | compare with the slide PNG |  |

### C2 Edit Data: workbook value cells carry the column formats: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 column Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 35 ms (ready true, workbook open false) |  |
| PASS | slide 1 column ChartData.Activate | activated, no error | activated |  |
| PASS | slide 1 column Workbook.Close(False) | closed | true |  |
| PASS | slide 1 column cell B2 ("Revenue" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell B2 ("Revenue" Q1) Value2 | 12.4 | 12.4 |  |
| PASS | slide 1 column cell B2 ("Revenue" Q1) Text | "$12.4" | "$12.4" |  |
| PASS | slide 1 column cell B3 ("Revenue" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell B3 ("Revenue" Q2) Value2 | 18.1 | 18.1 |  |
| PASS | slide 1 column cell B3 ("Revenue" Q2) Text | "$18.1" | "$18.1" |  |
| PASS | slide 1 column cell B4 ("Revenue" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" | gap cell keeps the column style |
| PASS | slide 1 column cell B4 ("Revenue" Q3) Value2 | empty (gap) | null |  |
| PASS | slide 1 column cell B4 ("Revenue" Q3) Text | "" | "" |  |
| PASS | slide 1 column cell B5 ("Revenue" Q4) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell B5 ("Revenue" Q4) Value2 | 24.6 | 24.6 |  |
| PASS | slide 1 column cell B5 ("Revenue" Q4) Text | "$24.6" | "$24.6" |  |
| PASS | slide 1 column cell C2 ("Margin" Q1) NumberFormat | "0%" | "0%" |  |
| PASS | slide 1 column cell C2 ("Margin" Q1) Value2 | 0.31 | 0.31 |  |
| PASS | slide 1 column cell C2 ("Margin" Q1) Text | "31%" | "31%" |  |
| PASS | slide 1 column cell C3 ("Margin" Q2) NumberFormat | "0%" | "0%" |  |
| PASS | slide 1 column cell C3 ("Margin" Q2) Value2 | 0.34 | 0.34 |  |
| PASS | slide 1 column cell C3 ("Margin" Q2) Text | "34%" | "34%" |  |
| PASS | slide 1 column cell C4 ("Margin" Q3) NumberFormat | "0%" | "0%" |  |
| PASS | slide 1 column cell C4 ("Margin" Q3) Value2 | 0.29 | 0.29 |  |
| PASS | slide 1 column cell C4 ("Margin" Q3) Text | "29%" | "29%" |  |
| PASS | slide 1 column cell C5 ("Margin" Q4) NumberFormat | "0%" | "0%" |  |
| PASS | slide 1 column cell C5 ("Margin" Q4) Value2 | 0.4 | 0.4 |  |
| PASS | slide 1 column cell C5 ("Margin" Q4) Text | "40%" | "40%" |  |
| PASS | slide 1 column cell D2 ("Units" Q1) NumberFormat | "#,##0 \"units\"" | "#,##0 \"units\"" |  |
| PASS | slide 1 column cell D2 ("Units" Q1) Value2 | 1200 | 1200 |  |
| PASS | slide 1 column cell D2 ("Units" Q1) Text | "1,200 units" | "1,200 units" |  |
| PASS | slide 1 column cell D3 ("Units" Q2) NumberFormat | "#,##0 \"units\"" | "#,##0 \"units\"" |  |
| PASS | slide 1 column cell D3 ("Units" Q2) Value2 | 1800 | 1800 |  |
| PASS | slide 1 column cell D3 ("Units" Q2) Text | "1,800 units" | "1,800 units" |  |
| PASS | slide 1 column cell D4 ("Units" Q3) NumberFormat | "#,##0 \"units\"" | "#,##0 \"units\"" |  |
| PASS | slide 1 column cell D4 ("Units" Q3) Value2 | 2400 | 2400 |  |
| PASS | slide 1 column cell D4 ("Units" Q3) Text | "2,400 units" | "2,400 units" |  |
| PASS | slide 1 column cell D5 ("Units" Q4) NumberFormat | "#,##0 \"units\"" | "#,##0 \"units\"" |  |
| PASS | slide 1 column cell D5 ("Units" Q4) Value2 | 3100 | 3100 |  |
| PASS | slide 1 column cell D5 ("Units" Q4) Text | "3,100 units" | "3,100 units" |  |
| PASS | slide 2 line Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 28 ms (ready true, workbook open false) |  |
| PASS | slide 2 line ChartData.Activate | activated, no error | activated |  |
| PASS | slide 2 line Workbook.Close(False) | closed | true |  |
| PASS | slide 2 line cell B2 ("Rate" Jan) NumberFormat | "0.00%" | "0.00%" |  |
| PASS | slide 2 line cell B2 ("Rate" Jan) Value2 | 0.0125 | 0.0125 |  |
| PASS | slide 2 line cell B2 ("Rate" Jan) Text | "1.25%" | "1.25%" |  |
| PASS | slide 2 line cell B3 ("Rate" Feb) NumberFormat | "0.00%" | "0.00%" |  |
| PASS | slide 2 line cell B3 ("Rate" Feb) Value2 | 0.0131 | 0.0131 |  |
| PASS | slide 2 line cell B3 ("Rate" Feb) Text | "1.31%" | "1.31%" |  |
| PASS | slide 2 line cell B4 ("Rate" Mar) NumberFormat | "0.00%" | "0.00%" |  |
| PASS | slide 2 line cell B4 ("Rate" Mar) Value2 | 0.0142 | 0.0142 |  |
| PASS | slide 2 line cell B4 ("Rate" Mar) Text | "1.42%" | "1.42%" |  |
| PASS | slide 2 line cell B5 ("Rate" Apr) NumberFormat | "0.00%" | "0.00%" |  |
| PASS | slide 2 line cell B5 ("Rate" Apr) Value2 | 0.0139 | 0.0139 |  |
| PASS | slide 2 line cell B5 ("Rate" Apr) Text | "1.39%" | "1.39%" |  |
| PASS | slide 3 scatter Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 10 ms (ready true, workbook open false) |  |
| PASS | slide 3 scatter ChartData.Activate | activated, no error | activated |  |
| PASS | slide 3 scatter Workbook.Close(False) | closed | true |  |
| PASS | slide 3 scatter cell A2 ("Weight" a) NumberFormat | "0.0 \"kg\"" | "0.0 \"kg\"" |  |
| PASS | slide 3 scatter cell A2 ("Weight" a) Value2 | 1.5 | 1.5 |  |
| PASS | slide 3 scatter cell A2 ("Weight" a) Text | "1.5 kg" | "1.5 kg" |  |
| PASS | slide 3 scatter cell A3 ("Weight" b) NumberFormat | "0.0 \"kg\"" | "0.0 \"kg\"" |  |
| PASS | slide 3 scatter cell A3 ("Weight" b) Value2 | 2.25 | 2.25 |  |
| PASS | slide 3 scatter cell A3 ("Weight" b) Text | "2.3 kg" | "2.3 kg" |  |
| PASS | slide 3 scatter cell A4 ("Weight" c) NumberFormat | "0.0 \"kg\"" | "0.0 \"kg\"" |  |
| PASS | slide 3 scatter cell A4 ("Weight" c) Value2 | 3.75 | 3.75 |  |
| PASS | slide 3 scatter cell A4 ("Weight" c) Text | "3.8 kg" | "3.8 kg" |  |
| PASS | slide 3 scatter cell B2 ("Price" a) NumberFormat | "$#,##0" | "\\$#,##0" |  |
| PASS | slide 3 scatter cell B2 ("Price" a) Value2 | 1200 | 1200 |  |
| PASS | slide 3 scatter cell B2 ("Price" a) Text | "$1,200" | "$1,200" |  |
| PASS | slide 3 scatter cell B3 ("Price" b) NumberFormat | "$#,##0" | "\\$#,##0" |  |
| PASS | slide 3 scatter cell B3 ("Price" b) Value2 | 1850 | 1850 |  |
| PASS | slide 3 scatter cell B3 ("Price" b) Text | "$1,850" | "$1,850" |  |
| PASS | slide 3 scatter cell B4 ("Price" c) NumberFormat | "$#,##0" | "\\$#,##0" |  |
| PASS | slide 3 scatter cell B4 ("Price" c) Value2 | 2400 | 2400 |  |
| PASS | slide 3 scatter cell B4 ("Price" c) Text | "$2,400" | "$2,400" |  |
| PASS | slide 4 pie Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 12 ms (ready true, workbook open false) |  |
| PASS | slide 4 pie ChartData.Activate | activated, no error | activated |  |
| PASS | slide 4 pie Workbook.Close(False) | closed | true |  |
| PASS | slide 4 pie cell B2 ("Sales" EMEA) NumberFormat | "$#,##0" | "\\$#,##0" |  |
| PASS | slide 4 pie cell B2 ("Sales" EMEA) Value2 | 4200 | 4200 |  |
| PASS | slide 4 pie cell B2 ("Sales" EMEA) Text | "$4,200" | "$4,200" |  |
| PASS | slide 4 pie cell B3 ("Sales" APAC) NumberFormat | "$#,##0" | "\\$#,##0" |  |
| PASS | slide 4 pie cell B3 ("Sales" APAC) Value2 | 3100 | 3100 |  |
| PASS | slide 4 pie cell B3 ("Sales" APAC) Text | "$3,100" | "$3,100" |  |
| PASS | slide 4 pie cell B4 ("Sales" AMER) NumberFormat | "$#,##0" | "\\$#,##0" |  |
| PASS | slide 4 pie cell B4 ("Sales" AMER) Value2 | 5600 | 5600 |  |
| PASS | slide 4 pie cell B4 ("Sales" AMER) Text | "$5,600" | "$5,600" |  |
| PASS | slide 5 treemap Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 14 ms (ready true, workbook open false) |  |
| PASS | slide 5 treemap ChartData.Activate | activated, no error | activated |  |
| PASS | slide 5 treemap Workbook.Close(False) | closed | true |  |
| PASS | slide 5 treemap cell B2 ("Size" North) NumberFormat | "#,##0.0" | "#,##0.0" |  |
| PASS | slide 5 treemap cell B2 ("Size" North) Value2 | 5.25 | 5.25 |  |
| PASS | slide 5 treemap cell B2 ("Size" North) Text | "5.3" | "5.3" |  |
| PASS | slide 5 treemap cell B3 ("Size" South) NumberFormat | "#,##0.0" | "#,##0.0" |  |
| PASS | slide 5 treemap cell B3 ("Size" South) Value2 | 3.5 | 3.5 |  |
| PASS | slide 5 treemap cell B3 ("Size" South) Text | "3.5" | "3.5" |  |
| PASS | slide 5 treemap cell B4 ("Size" East) NumberFormat | "#,##0.0" | "#,##0.0" |  |
| PASS | slide 5 treemap cell B4 ("Size" East) Value2 | 2.75 | 2.75 |  |
| PASS | slide 5 treemap cell B4 ("Size" East) Text | "2.8" | "2.8" |  |
| PASS | slide 6 column Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 30 ms (ready true, workbook open false) |  |
| PASS | slide 6 column ChartData.Activate | activated, no error | activated |  |
| PASS | slide 6 column Workbook.Close(False) | closed | true |  |
| PASS | slide 6 column cell B2 ("Value" plain) NumberFormat | "General" | "General" |  |
| PASS | slide 6 column cell B2 ("Value" plain) Value2 | 12 | 12 |  |
| PASS | slide 6 column cell B2 ("Value" plain) Text | "12" | "12" |  |
| PASS | slide 6 column cell B3 ("Value" decimal string) NumberFormat | "General" | "General" |  |
| PASS | slide 6 column cell B3 ("Value" decimal string) Value2 | 7.5 | 7.5 |  |
| PASS | slide 6 column cell B3 ("Value" decimal string) Text | "7.5" | "7.5" |  |
| PASS | slide 6 column cell B4 ("Value" percent string) NumberFormat | "General" | "General" | gap cell keeps the column style |
| PASS | slide 6 column cell B4 ("Value" percent string) Value2 | empty (gap) | null |  |
| PASS | slide 6 column cell B4 ("Value" percent string) Text | "" | "" |  |
| PASS | slide 6 column cell B5 ("Value" currency string) NumberFormat | "General" | "General" | gap cell keeps the column style |
| PASS | slide 6 column cell B5 ("Value" currency string) Value2 | empty (gap) | null |  |
| PASS | slide 6 column cell B5 ("Value" currency string) Text | "" | "" |  |

### C3 Read-only open with no repair prompt; frame custDataLst and presentation tags read back: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | open read-only reached stage read.done with no dialog | read.done/success | read.done/success |  |
| PASS | Presentation.ReadOnly | -1 | -1 |  |
| PASS | child exit | exit 0 | exit 0 |  |
| PASS | source deck unchanged | da5edac2eec4c0ca | da5edac2eec4c0ca -> da5edac2eec4c0ca |  |
| PASS | presentation tag OPF_DOCUMENT_V1 | length 1010, sha256 e4f240ae70e12408 | length 1010, sha256 e4f240ae70e12408 |  |
| INFO | slide 1 frame "OPF chart 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 1 frame "OPF chart 1" tag OPF_DATA_V1 | length 584, sha256 e7b9602e92bbe14d | length 584, sha256 e7b9602e92bbe14d |  |
| INFO | slide 2 frame "OPF chart 2" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 2 frame "OPF chart 2" tag OPF_DATA_V1 | length 370, sha256 45983df2692730bf | length 370, sha256 45983df2692730bf |  |
| INFO | slide 3 frame "OPF chart 3" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 3 frame "OPF chart 3" tag OPF_DATA_V1 | length 420, sha256 5d9961972b744995 | length 420, sha256 5d9961972b744995 |  |
| INFO | slide 4 frame "OPF chart 4" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 4 frame "OPF chart 4" tag OPF_DATA_V1 | length 340, sha256 a8bc741230a55cc6 | length 340, sha256 a8bc741230a55cc6 |  |
| INFO | slide 5 frame "OPF chart 5" (chartex choice) Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 5 frame "OPF chart 5" (chartex choice) tag OPF_DATA_V1 | length 376, sha256 0b9a39db7d97810c | length 376, sha256 0b9a39db7d97810c |  |
| INFO | slide 6 frame "OPF chart 6" Shape.Tags | 0 tag(s): none | Count 0: none |  |

### C4 Save a copy in PowerPoint, re-import offline: datasets, chart.data and chart.mapping restored: FAIL

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | control: fromPptx(source deck) equals decks/<deck>.reimported.opf.json | equal | equal |  |
| PASS | save child | done, exit 0 | "done/success", exit 0 |  |
| PASS | opened read-only | -1 | -1 |  |
| PASS | source deck unchanged | da5edac2eec4c0ca | da5edac2eec4c0ca -> da5edac2eec4c0ca |  |
| PASS | copy written by SaveCopyAs (format 24) | rr54-formats-saved.pptx | rr54-formats-saved.pptx, 99673 bytes, sha256 49f0d438d306e03d |  |
| INFO | copy differs from the source bytes (PowerPoint rewrote the package) | expected: differs | differs |  |
| INFO | re-import builds | opf-pptx f0ea480 on core 11317237 | core package 0.12.2, node v24.21.0 |  |
| PASS | re-imported file is the copy this attempt saved | 49f0d438d306e03d | 49f0d438d306e03d |  |
| PASS | saved copy imports | ok | ok |  |
| FAIL | no data-provenance diagnostic | none of chart-data-provenance-changed, table-data-provenance-changed, chart-dataset-unavailable, table-dataset-unavailable, invalid-data-provenance, data-provenance-omitted | chart-data-provenance-changed at slides.0.charts.0; chart-data-provenance-changed at slides.2.charts.0; chart-data-provenance-changed at slides.3.charts.0 |  |
| INFO | other import diagnostics | - | heading-import-reflow at slides.0; heading-import-reflow at slides.1; heading-import-reflow at slides.2; heading-import-reflow at slides.3; heading-import-reflow at slides.4; heading-import-reflow at slides.5 |  |
| PASS | no datasets (none in the source) | absent | "absent" |  |
| PASS | slide 1 column chart.data equals the source-side re-import | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Margin","format":"0%"},{"name":"Units","format":"#,##0 units"}],"rows":[["Q1",12.4,0.31,12 | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Margin","format":"0%"},{"name":"Units","format":"#,##0 units"}],"rows":[["Q1",12.4,0.31,12 |  |
| PASS | slide 1 column chart.data equals the source .opf.json | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Margin","format":"0%"},{"name":"Units","format":"#,##0 units"}],"rows":[["Q1",12.4,0.31,12 | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Margin","format":"0%"},{"name":"Units","format":"#,##0 units"}],"rows":[["Q1",12.4,0.31,12 |  |
| PASS | slide 1 column whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 2 line chart.data equals the source-side re-import | {"columns":["Month",{"name":"Rate","format":"0.00%"}],"rows":[["Jan",0.0125],["Feb",0.0131],["Mar",0.0142],["Apr",0.0139]]} | {"columns":["Month",{"name":"Rate","format":"0.00%"}],"rows":[["Jan",0.0125],["Feb",0.0131],["Mar",0.0142],["Apr",0.0139]]} |  |
| PASS | slide 2 line chart.data equals the source .opf.json | {"columns":["Month",{"name":"Rate","format":"0.00%"}],"rows":[["Jan",0.0125],["Feb",0.0131],["Mar",0.0142],["Apr",0.0139]]} | {"columns":["Month",{"name":"Rate","format":"0.00%"}],"rows":[["Jan",0.0125],["Feb",0.0131],["Mar",0.0142],["Apr",0.0139]]} |  |
| PASS | slide 2 line whole chart equals the source-side re-import | equal | equal |  |
| FAIL | slide 3 scatter chart.data equals the source-side re-import | {"columns":["Point",{"name":"Weight","format":"0.0 kg"},{"name":"Price","format":"$#,##0"}],"rows":[["a",1.5,1200],["b",2.25,1850],["c",3.75,2400]]} | {"columns":["Point",{"name":"Weight","format":"0.0 kg"},{"name":"Price","format":"$#,##0"}],"rows":[["1",1.5,1200],["2",2.25,1850],["3",3.75,2400]]} |  |
| FAIL | slide 3 scatter chart.data equals the source .opf.json | {"columns":["Point",{"name":"Weight","format":"0.0 kg"},{"name":"Price","format":"$#,##0"}],"rows":[["a",1.5,1200],["b",2.25,1850],["c",3.75,2400]]} | {"columns":["Point",{"name":"Weight","format":"0.0 kg"},{"name":"Price","format":"$#,##0"}],"rows":[["1",1.5,1200],["2",2.25,1850],["3",3.75,2400]]} |  |
| FAIL | slide 3 scatter whole chart equals the source-side re-import | equal | /slides/2/chart/data/rows/0/0: expected "a" actual "1"; /slides/2/chart/data/rows/1/0: expected "b" actual "2"; /slides/2/chart/data/rows/2/0: expected "c" actual "3" |  |
| PASS | slide 4 pie chart.data equals the source-side re-import | {"columns":["Region",{"name":"Sales","format":"$#,##0"}],"rows":[["EMEA",4200],["APAC",3100],["AMER",5600]]} | {"columns":["Region",{"name":"Sales","format":"$#,##0"}],"rows":[["EMEA",4200],["APAC",3100],["AMER",5600]]} |  |
| PASS | slide 4 pie chart.data equals the source .opf.json | {"columns":["Region",{"name":"Sales","format":"$#,##0"}],"rows":[["EMEA",4200],["APAC",3100],["AMER",5600]]} | {"columns":["Region",{"name":"Sales","format":"$#,##0"}],"rows":[["EMEA",4200],["APAC",3100],["AMER",5600]]} |  |
| PASS | slide 4 pie whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 5 treemap chart.data equals the source-side re-import | {"columns":["Area",{"name":"Size","format":"#,##0.0"}],"rows":[["North",5.25],["South",3.5],["East",2.75]]} | {"columns":["Area",{"name":"Size","format":"#,##0.0"}],"rows":[["North",5.25],["South",3.5],["East",2.75]]} |  |
| PASS | slide 5 treemap chart.data equals the source .opf.json | {"columns":["Area",{"name":"Size","format":"#,##0.0"}],"rows":[["North",5.25],["South",3.5],["East",2.75]]} | {"columns":["Area",{"name":"Size","format":"#,##0.0"}],"rows":[["North",5.25],["South",3.5],["East",2.75]]} |  |
| PASS | slide 5 treemap whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 6 column chart.data equals the source-side re-import | {"columns":["Row","Value"],"rows":[["plain",12],["decimal string",7.5],["percent string",null],["currency string",null]]} | {"columns":["Row","Value"],"rows":[["plain",12],["decimal string",7.5],["percent string",null],["currency string",null]]} |  |
| INFO | slide 6 column chart.data vs the source .opf.json | {"columns":["Row","Value"],"rows":[["plain",12],["decimal string","7.5"],["percent string","12%"],["currency string","$5 | {"columns":["Row","Value"],"rows":[["plain",12],["decimal string",7.5],["percent string",null],["currency string",null]] | the source-side re-import does not restore it either (no OPF_DATA_V1 record: no new field used) |
| PASS | slide 6 column whole chart equals the source-side re-import | equal | equal |  |
| INFO | whole document vs the source-side re-import | equal | /slides/2/chart/data/rows/0/0: expected "a" actual "1"; /slides/2/chart/data/rows/1/0: expected "b" actual "2"; /slides/2/chart/data/rows/2/0: expected "c" actual "3" |  |

## rr54-datasets

PowerPoint 16.0 build 20430.

### C1 Formatted labels, value axes and table text display as documented: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 column chart type | XlChartType in [51] | 51 |  |
| PASS | slide 1 series 1 "Revenue" name | "Revenue" | "Revenue" |  |
| PASS | slide 1 series 1 "Revenue" DataLabels.ShowValue | true | true |  |
| PASS | slide 1 series 1 "Revenue" DataLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| PASS | slide 1 series 1 "Revenue" point 1 (Q1, 12.4) label | "$12.4" | "$12.4" |  |
| PASS | slide 1 series 1 "Revenue" point 2 (Q2, 18.1) label | "$18.1" | "$18.1" |  |
| PASS | slide 1 series 1 "Revenue" point 3 (Q3, 24.6) label | "$24.6" | "$24.6" |  |
| PASS | slide 1 series 2 "Costs" name | "Costs" | "Costs" |  |
| PASS | slide 1 series 2 "Costs" DataLabels.ShowValue | true | true |  |
| PASS | slide 1 series 2 "Costs" DataLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| PASS | slide 1 series 2 "Costs" point 1 (Q1, 8.1) label | "$8.1" | "$8.1" |  |
| PASS | slide 1 series 2 "Costs" point 2 (Q2, 11) label | "$11.0" | "$11.0" |  |
| PASS | slide 1 series 2 "Costs" point 3 (Q3, 15.2) label | "$15.2" | "$15.2" |  |
| PASS | slide 1 Axes(2) value TickLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| INFO | slide 1 Axes(2) tick texts (derived from the native scale 0..30 step 5; not read natively) | "$0.0" "$5.0" "$10.0" "$15.0" "$20.0" "$25.0" "$30.0" | compare with the slide PNG |  |
| PASS | slide 2 line chart type | XlChartType in [4, 65] | 4 |  |
| PASS | slide 2 series 1 "Costs" name | "Costs" | "Costs" |  |
| PASS | slide 2 series 1 "Costs" no value labels | HasDataLabels false or ShowValue false | HasDataLabels false, ShowValue false |  |
| PASS | slide 2 series 2 "Revenue" name | "Revenue" | "Revenue" |  |
| PASS | slide 2 series 2 "Revenue" no value labels | HasDataLabels false or ShowValue false | HasDataLabels false, ShowValue false |  |
| PASS | slide 2 Axes(2) value TickLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| INFO | slide 2 Axes(2) tick texts (derived from the native scale 0..30 step 5; not read natively) | "$0.0" "$5.0" "$10.0" "$15.0" "$20.0" "$25.0" "$30.0" | compare with the slide PNG |  |
| PASS | slide 3 table size | 4 x 4 | 4 x 4 |  |
| PASS | slide 3 table cell (1,1) | "Quarter" | "Quarter" |  |
| PASS | slide 3 table cell (1,2) | "Revenue" | "Revenue" |  |
| PASS | slide 3 table cell (1,3) | "Costs" | "Costs" |  |
| PASS | slide 3 table cell (1,4) | "Growth" | "Growth" |  |
| PASS | slide 3 table cell (2,1) | "Q1" | "Q1" |  |
| PASS | slide 3 table cell (2,2) | "$12.4" | "$12.4" | format "$#,##0.0" |
| PASS | slide 3 table cell (2,3) | "$8.1" | "$8.1" | format "$#,##0.0" |
| PASS | slide 3 table cell (2,4) | "12%" | "12%" | format "0%" |
| PASS | slide 3 table cell (3,1) | "Q2" | "Q2" |  |
| PASS | slide 3 table cell (3,2) | "$18.1" | "$18.1" | format "$#,##0.0" |
| PASS | slide 3 table cell (3,3) | "$11.0" | "$11.0" | format "$#,##0.0" |
| PASS | slide 3 table cell (3,4) | "46%" | "46%" | format "0%" |
| PASS | slide 3 table cell (4,1) | "Q3" | "Q3" |  |
| PASS | slide 3 table cell (4,2) | "$24.6" | "$24.6" | format "$#,##0.0" |
| PASS | slide 3 table cell (4,3) | "$15.2" | "$15.2" | format "$#,##0.0" |
| PASS | slide 3 table cell (4,4) | "36%" | "36%" | format "0%" |
| PASS | slide 4 doughnut chart type | XlChartType in [-4120] | -4120 |  |
| PASS | slide 4 series 1 "Revenue" name | "Revenue" | "Revenue" |  |
| PASS | slide 4 series 1 "Revenue" no value labels | HasDataLabels false or ShowValue false | HasDataLabels true, ShowValue false |  |
| PASS | slide 5 radar chart type | XlChartType in [-4151, 81] | -4151 |  |
| PASS | slide 5 series 1 "Revenue" name | "Revenue" | "Revenue" |  |
| PASS | slide 5 series 1 "Revenue" DataLabels.ShowValue | true | true |  |
| PASS | slide 5 series 1 "Revenue" DataLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| PASS | slide 5 series 1 "Revenue" point 1 (Q1, 12.4) label | "$12.4" | "$12.4" |  |
| PASS | slide 5 series 1 "Revenue" point 2 (Q2, 18.1) label | "$18.1" | "$18.1" |  |
| PASS | slide 5 series 1 "Revenue" point 3 (Q3, 24.6) label | "$24.6" | "$24.6" |  |
| PASS | slide 5 series 2 "Growth" name | "Growth" | "Growth" |  |
| PASS | slide 5 series 2 "Growth" DataLabels.ShowValue | true | true |  |
| PASS | slide 5 series 2 "Growth" DataLabels.NumberFormat | "0%" | "0%" | OPF format "0%" |
| PASS | slide 5 series 2 "Growth" point 1 (Q1, 0.12) label | "12%" | "12%" |  |
| PASS | slide 5 series 2 "Growth" point 2 (Q2, 0.46) label | "46%" | "46%" |  |
| PASS | slide 5 series 2 "Growth" point 3 (Q3, 0.36) label | "36%" | "36%" |  |
| PASS | slide 5 Axes(2) value TickLabels.NumberFormat | "$#,##0.0" | "\\$#,##0.0" | OPF format "$#,##0.0" |
| INFO | slide 5 Axes(2) tick texts (derived from the native scale 0..25 step 5; not read natively) | "$0.0" "$5.0" "$10.0" "$15.0" "$20.0" "$25.0" | compare with the slide PNG |  |
| PASS | slide 6 box-and-whisker chart type | XlChartType in [121] | 121 |  |
| PASS | slide 6 series 1 "Revenue" name | "Revenue" | "Revenue" |  |
| PASS | slide 6 series 1 "Revenue" no value labels | HasDataLabels false or ShowValue false | HasDataLabels false, ShowValue "ERROR: Unable to get the Count property of the DataLabels class." |  |
| PASS | slide 6 series 2 "Costs" name | "Costs" | "Costs" |  |
| PASS | slide 6 series 2 "Costs" no value labels | HasDataLabels false or ShowValue false | HasDataLabels false, ShowValue "ERROR: Unable to get the Count property of the DataLabels class." |  |
| INFO | slide 6 Axes(2) value TickLabels.NumberFormat | "$#,##0.0" | "" | chartex: verify on the slide PNG rr54-datasets-slide06.png. OPF format "$#,##0.0" |

### C2 Edit Data: workbook value cells carry the column formats: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 column Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 29 ms (ready true, workbook open false) |  |
| PASS | slide 1 column ChartData.Activate | activated, no error | activated |  |
| PASS | slide 1 column Workbook.Close(False) | closed | true |  |
| PASS | slide 1 column cell B2 ("Revenue" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell B2 ("Revenue" Q1) Value2 | 12.4 | 12.4 |  |
| PASS | slide 1 column cell B2 ("Revenue" Q1) Text | "$12.4" | "$12.4" |  |
| PASS | slide 1 column cell B3 ("Revenue" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell B3 ("Revenue" Q2) Value2 | 18.1 | 18.1 |  |
| PASS | slide 1 column cell B3 ("Revenue" Q2) Text | "$18.1" | "$18.1" |  |
| PASS | slide 1 column cell B4 ("Revenue" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell B4 ("Revenue" Q3) Value2 | 24.6 | 24.6 |  |
| PASS | slide 1 column cell B4 ("Revenue" Q3) Text | "$24.6" | "$24.6" |  |
| PASS | slide 1 column cell C2 ("Costs" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell C2 ("Costs" Q1) Value2 | 8.1 | 8.1 |  |
| PASS | slide 1 column cell C2 ("Costs" Q1) Text | "$8.1" | "$8.1" |  |
| PASS | slide 1 column cell C3 ("Costs" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell C3 ("Costs" Q2) Value2 | 11 | 11 |  |
| PASS | slide 1 column cell C3 ("Costs" Q2) Text | "$11.0" | "$11.0" |  |
| PASS | slide 1 column cell C4 ("Costs" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 1 column cell C4 ("Costs" Q3) Value2 | 15.2 | 15.2 |  |
| PASS | slide 1 column cell C4 ("Costs" Q3) Text | "$15.2" | "$15.2" |  |
| PASS | slide 2 line Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 29 ms (ready true, workbook open false) |  |
| PASS | slide 2 line ChartData.Activate | activated, no error | activated |  |
| PASS | slide 2 line Workbook.Close(False) | closed | true |  |
| PASS | slide 2 line cell B2 ("Costs" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 2 line cell B2 ("Costs" Q1) Value2 | 8.1 | 8.1 |  |
| PASS | slide 2 line cell B2 ("Costs" Q1) Text | "$8.1" | "$8.1" |  |
| PASS | slide 2 line cell B3 ("Costs" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 2 line cell B3 ("Costs" Q2) Value2 | 11 | 11 |  |
| PASS | slide 2 line cell B3 ("Costs" Q2) Text | "$11.0" | "$11.0" |  |
| PASS | slide 2 line cell B4 ("Costs" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 2 line cell B4 ("Costs" Q3) Value2 | 15.2 | 15.2 |  |
| PASS | slide 2 line cell B4 ("Costs" Q3) Text | "$15.2" | "$15.2" |  |
| PASS | slide 2 line cell C2 ("Revenue" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 2 line cell C2 ("Revenue" Q1) Value2 | 12.4 | 12.4 |  |
| PASS | slide 2 line cell C2 ("Revenue" Q1) Text | "$12.4" | "$12.4" |  |
| PASS | slide 2 line cell C3 ("Revenue" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 2 line cell C3 ("Revenue" Q2) Value2 | 18.1 | 18.1 |  |
| PASS | slide 2 line cell C3 ("Revenue" Q2) Text | "$18.1" | "$18.1" |  |
| PASS | slide 2 line cell C4 ("Revenue" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 2 line cell C4 ("Revenue" Q3) Value2 | 24.6 | 24.6 |  |
| PASS | slide 2 line cell C4 ("Revenue" Q3) Text | "$24.6" | "$24.6" |  |
| PASS | slide 4 doughnut Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 12 ms (ready true, workbook open false) |  |
| PASS | slide 4 doughnut ChartData.Activate | activated, no error | activated |  |
| PASS | slide 4 doughnut Workbook.Close(False) | closed | true |  |
| PASS | slide 4 doughnut cell B2 ("Revenue" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 4 doughnut cell B2 ("Revenue" Q1) Value2 | 12.4 | 12.4 |  |
| PASS | slide 4 doughnut cell B2 ("Revenue" Q1) Text | "$12.4" | "$12.4" |  |
| PASS | slide 4 doughnut cell B3 ("Revenue" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 4 doughnut cell B3 ("Revenue" Q2) Value2 | 18.1 | 18.1 |  |
| PASS | slide 4 doughnut cell B3 ("Revenue" Q2) Text | "$18.1" | "$18.1" |  |
| PASS | slide 4 doughnut cell B4 ("Revenue" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 4 doughnut cell B4 ("Revenue" Q3) Value2 | 24.6 | 24.6 |  |
| PASS | slide 4 doughnut cell B4 ("Revenue" Q3) Text | "$24.6" | "$24.6" |  |
| PASS | slide 5 radar Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 30 ms (ready true, workbook open false) |  |
| PASS | slide 5 radar ChartData.Activate | activated, no error | activated |  |
| PASS | slide 5 radar Workbook.Close(False) | closed | true |  |
| PASS | slide 5 radar cell B2 ("Revenue" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 5 radar cell B2 ("Revenue" Q1) Value2 | 12.4 | 12.4 |  |
| PASS | slide 5 radar cell B2 ("Revenue" Q1) Text | "$12.4" | "$12.4" |  |
| PASS | slide 5 radar cell B3 ("Revenue" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 5 radar cell B3 ("Revenue" Q2) Value2 | 18.1 | 18.1 |  |
| PASS | slide 5 radar cell B3 ("Revenue" Q2) Text | "$18.1" | "$18.1" |  |
| PASS | slide 5 radar cell B4 ("Revenue" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 5 radar cell B4 ("Revenue" Q3) Value2 | 24.6 | 24.6 |  |
| PASS | slide 5 radar cell B4 ("Revenue" Q3) Text | "$24.6" | "$24.6" |  |
| PASS | slide 5 radar cell C2 ("Growth" Q1) NumberFormat | "0%" | "0%" |  |
| PASS | slide 5 radar cell C2 ("Growth" Q1) Value2 | 0.12 | 0.12 |  |
| PASS | slide 5 radar cell C2 ("Growth" Q1) Text | "12%" | "12%" |  |
| PASS | slide 5 radar cell C3 ("Growth" Q2) NumberFormat | "0%" | "0%" |  |
| PASS | slide 5 radar cell C3 ("Growth" Q2) Value2 | 0.46 | 0.46 |  |
| PASS | slide 5 radar cell C3 ("Growth" Q2) Text | "46%" | "46%" |  |
| PASS | slide 5 radar cell C4 ("Growth" Q3) NumberFormat | "0%" | "0%" |  |
| PASS | slide 5 radar cell C4 ("Growth" Q3) Value2 | 0.36 | 0.36 |  |
| PASS | slide 5 radar cell C4 ("Growth" Q3) Text | "36%" | "36%" |  |
| PASS | slide 6 box-and-whisker Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 29 ms (ready true, workbook open false) |  |
| PASS | slide 6 box-and-whisker ChartData.Activate | activated, no error | activated |  |
| PASS | slide 6 box-and-whisker Workbook.Close(False) | closed | true |  |
| PASS | slide 6 box-and-whisker cell B2 ("Revenue" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 6 box-and-whisker cell B2 ("Revenue" Q1) Value2 | 12.4 | 12.4 |  |
| PASS | slide 6 box-and-whisker cell B2 ("Revenue" Q1) Text | "$12.4" | "$12.4" |  |
| PASS | slide 6 box-and-whisker cell B3 ("Revenue" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 6 box-and-whisker cell B3 ("Revenue" Q2) Value2 | 18.1 | 18.1 |  |
| PASS | slide 6 box-and-whisker cell B3 ("Revenue" Q2) Text | "$18.1" | "$18.1" |  |
| PASS | slide 6 box-and-whisker cell B4 ("Revenue" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 6 box-and-whisker cell B4 ("Revenue" Q3) Value2 | 24.6 | 24.6 |  |
| PASS | slide 6 box-and-whisker cell B4 ("Revenue" Q3) Text | "$24.6" | "$24.6" |  |
| PASS | slide 6 box-and-whisker cell C2 ("Costs" Q1) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 6 box-and-whisker cell C2 ("Costs" Q1) Value2 | 8.1 | 8.1 |  |
| PASS | slide 6 box-and-whisker cell C2 ("Costs" Q1) Text | "$8.1" | "$8.1" |  |
| PASS | slide 6 box-and-whisker cell C3 ("Costs" Q2) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 6 box-and-whisker cell C3 ("Costs" Q2) Value2 | 11 | 11 |  |
| PASS | slide 6 box-and-whisker cell C3 ("Costs" Q2) Text | "$11.0" | "$11.0" |  |
| PASS | slide 6 box-and-whisker cell C4 ("Costs" Q3) NumberFormat | "$#,##0.0" | "\\$#,##0.0" |  |
| PASS | slide 6 box-and-whisker cell C4 ("Costs" Q3) Value2 | 15.2 | 15.2 |  |
| PASS | slide 6 box-and-whisker cell C4 ("Costs" Q3) Text | "$15.2" | "$15.2" |  |

### C3 Read-only open with no repair prompt; frame custDataLst and presentation tags read back: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | open read-only reached stage read.done with no dialog | read.done/success | read.done/success |  |
| PASS | Presentation.ReadOnly | -1 | -1 |  |
| PASS | child exit | exit 0 | exit 0 |  |
| PASS | source deck unchanged | 50ce4ae5edf2cb7d | 50ce4ae5edf2cb7d -> 50ce4ae5edf2cb7d |  |
| PASS | presentation tag OPF_DOCUMENT_V1 | length 1010, sha256 e4f240ae70e12408 | length 1010, sha256 e4f240ae70e12408 |  |
| PASS | presentation tag OPF_DATASETS_V1 | length 614, sha256 0f0b2d9c61e5d174 | length 614, sha256 0f0b2d9c61e5d174 |  |
| INFO | slide 1 frame "OPF chart 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 1 frame "OPF chart 1" tag OPF_DATA_V1 | length 302, sha256 1f44d85ba0fabc45 | length 302, sha256 1f44d85ba0fabc45 |  |
| INFO | slide 2 frame "OPF chart 2" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 2 frame "OPF chart 2" tag OPF_DATA_V1 | length 348, sha256 f342c2faa18e9415 | length 348, sha256 f342c2faa18e9415 |  |
| INFO | slide 3 frame "OPF table 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 3 frame "OPF table 1" tag OPF_DATA_V1 | length 104, sha256 1e3eb810f1f541fa | length 104, sha256 1e3eb810f1f541fa |  |
| INFO | slide 4 frame "OPF chart 3" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 4 frame "OPF chart 3" tag OPF_DATA_V1 | length 286, sha256 8625209abfffe1c5 | length 286, sha256 8625209abfffe1c5 |  |
| INFO | slide 5 frame "OPF chart 4" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 5 frame "OPF chart 4" tag OPF_DATA_V1 | length 304, sha256 626806461c55178c | length 304, sha256 626806461c55178c |  |
| INFO | slide 6 frame "OPF chart 5" (chartex choice) Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 6 frame "OPF chart 5" (chartex choice) tag OPF_DATA_V1 | length 340, sha256 c92e0fc8609bb1af | length 340, sha256 c92e0fc8609bb1af |  |

### C4 Save a copy in PowerPoint, re-import offline: datasets, chart.data and chart.mapping restored: FAIL

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | control: fromPptx(source deck) equals decks/<deck>.reimported.opf.json | equal | equal |  |
| PASS | save child | done, exit 0 | "done/success", exit 0 |  |
| PASS | opened read-only | -1 | -1 |  |
| PASS | source deck unchanged | 50ce4ae5edf2cb7d | 50ce4ae5edf2cb7d -> 50ce4ae5edf2cb7d |  |
| PASS | copy written by SaveCopyAs (format 24) | rr54-datasets-saved.pptx | rr54-datasets-saved.pptx, 93971 bytes, sha256 5d9349b2314f1c64 |  |
| INFO | copy differs from the source bytes (PowerPoint rewrote the package) | expected: differs | differs |  |
| INFO | re-import builds | opf-pptx f0ea480 on core 11317237 | core package 0.12.2, node v24.21.0 |  |
| PASS | re-imported file is the copy this attempt saved | 5d9349b2314f1c64 | 5d9349b2314f1c64 |  |
| PASS | saved copy imports | ok | ok |  |
| FAIL | no data-provenance diagnostic | none of chart-data-provenance-changed, table-data-provenance-changed, chart-dataset-unavailable, table-dataset-unavailable, invalid-data-provenance, data-provenance-omitted | chart-data-provenance-changed at slides.0.charts.0; chart-data-provenance-changed at slides.1.charts.0; chart-data-provenance-changed at slides.3.charts.0; chart-data-provenance-changed at slides.4.charts.0 |  |
| INFO | other import diagnostics | - | heading-import-reflow at slides.0; heading-import-reflow at slides.1; heading-import-reflow at slides.2; heading-import-reflow at slides.3; heading-import-reflow at slides.4; heading-import-reflow at slides.5 |  |
| PASS | datasets equal the source .opf.json | equal | equal |  |
| FAIL | slide 1 column chart.data equals the source-side re-import | {"dataset":"revenue","fields":["Quarter","Revenue","Costs"]} | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Costs","format":"$#,##0.0"}],"rows":[["Q1",12.4,8.1],["Q2",18.1,11],["Q3",24.6,15.2]]} |  |
| FAIL | slide 1 column chart.data equals the source .opf.json (dataset reference and fields) | {"dataset":"revenue","fields":["Quarter","Revenue","Costs"]} | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Costs","format":"$#,##0.0"}],"rows":[["Q1",12.4,8.1],["Q2",18.1,11],["Q3",24.6,15.2]]} |  |
| FAIL | slide 1 column whole chart equals the source-side re-import | equal | /slides/0/chart/data/dataset: expected "revenue" actual (missing); /slides/0/chart/data/fields: expected ["Quarter","Revenue","Costs"] actual (missing); /slides/0/chart/data/columns: expected (missing) actual ["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Costs","format":"$#,##0.0"}]; /slides/0/chart/data/rows: expected (missing) actual [["Q1",12.4,8.1],["Q2",18.1,11],["Q3",24.6,15.2]] |  |
| FAIL | slide 2 line chart.data equals the source-side re-import | {"dataset":"revenue"} | {"columns":["Quarter",{"name":"Costs","format":"$#,##0.0"},{"name":"Revenue","format":"$#,##0.0"}],"rows":[["Q1",8.1,12.4],["Q2",11,18.1],["Q3",15.2,24.6]]} |  |
| FAIL | slide 2 line chart.data equals the source .opf.json (dataset reference and fields) | {"dataset":"revenue"} | {"columns":["Quarter",{"name":"Costs","format":"$#,##0.0"},{"name":"Revenue","format":"$#,##0.0"}],"rows":[["Q1",8.1,12.4],["Q2",11,18.1],["Q3",15.2,24.6]]} |  |
| FAIL | slide 2 line chart.mapping equals the source | {"category":"Quarter","series":["Costs","Revenue"]} | (missing) |  |
| FAIL | slide 2 line whole chart equals the source-side re-import | equal | /slides/1/chart/data/dataset: expected "revenue" actual (missing); /slides/1/chart/data/columns: expected (missing) actual ["Quarter",{"name":"Costs","format":"$#,##0.0"},{"name":"Revenue","format":"$#,##0.0"}]; /slides/1/chart/data/rows: expected (missing) actual [["Q1",8.1,12.4],["Q2",11,18.1],["Q3",15.2,24.6]]; /slides/1/chart/mapping: expected {"category":"Quarter","series":["Costs","Revenue"]} actual (missing) |  |
| PASS | slide 3 table.dataset equals the source | "revenue" | "revenue" |  |
| PASS | slide 3 table equals the source-side re-import | equal | equal |  |
| FAIL | slide 4 doughnut (focus case) chart.data equals the source-side re-import | {"dataset":"revenue","fields":["Quarter","Revenue"]} | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"}],"rows":[["Q1",12.4],["Q2",18.1],["Q3",24.6]]} |  |
| FAIL | slide 4 doughnut (focus case) chart.data equals the source .opf.json (dataset reference and fields) | {"dataset":"revenue","fields":["Quarter","Revenue"]} | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"}],"rows":[["Q1",12.4],["Q2",18.1],["Q3",24.6]]} |  |
| FAIL | slide 4 doughnut (focus case) whole chart equals the source-side re-import | equal | /slides/3/chart/data/dataset: expected "revenue" actual (missing); /slides/3/chart/data/fields: expected ["Quarter","Revenue"] actual (missing); /slides/3/chart/data/columns: expected (missing) actual ["Quarter",{"name":"Revenue","format":"$#,##0.0"}]; /slides/3/chart/data/rows: expected (missing) actual [["Q1",12.4],["Q2",18.1],["Q3",24.6]] |  |
| FAIL | slide 5 radar chart.data equals the source-side re-import | {"dataset":"revenue","fields":["Quarter","Revenue","Growth"]} | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Growth","format":"0%"}],"rows":[["Q1",12.4,0.12],["Q2",18.1,0.46],["Q3",24.6,0.36]]} |  |
| FAIL | slide 5 radar chart.data equals the source .opf.json (dataset reference and fields) | {"dataset":"revenue","fields":["Quarter","Revenue","Growth"]} | {"columns":["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Growth","format":"0%"}],"rows":[["Q1",12.4,0.12],["Q2",18.1,0.46],["Q3",24.6,0.36]]} |  |
| FAIL | slide 5 radar whole chart equals the source-side re-import | equal | /slides/4/chart/data/dataset: expected "revenue" actual (missing); /slides/4/chart/data/fields: expected ["Quarter","Revenue","Growth"] actual (missing); /slides/4/chart/data/columns: expected (missing) actual ["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Growth","format":"0%"}]; /slides/4/chart/data/rows: expected (missing) actual [["Q1",12.4,0.12],["Q2",18.1,0.46],["Q3",24.6,0.36]] |  |
| PASS | slide 6 box-and-whisker chart.data equals the source-side re-import | {"dataset":"revenue","fields":["Quarter","Revenue","Costs"]} | {"dataset":"revenue","fields":["Quarter","Revenue","Costs"]} |  |
| PASS | slide 6 box-and-whisker chart.data equals the source .opf.json (dataset reference and fields) | {"dataset":"revenue","fields":["Quarter","Revenue","Costs"]} | {"dataset":"revenue","fields":["Quarter","Revenue","Costs"]} |  |
| PASS | slide 6 box-and-whisker whole chart equals the source-side re-import | equal | equal |  |
| INFO | whole document vs the source-side re-import | equal | /slides/0/chart/data/dataset: expected "revenue" actual (missing); /slides/0/chart/data/fields: expected ["Quarter","Revenue","Costs"] actual (missing); /slides/0/chart/data/columns: expected (missing) actual ["Quarter",{"name":"Revenue","format":"$#,##0.0"},{"name":"Costs","format":"$#,##0.0"}]; /slides/0/chart/data/rows: expected (missing) actual [["Q1",12.4,8.1],["Q2",18.1,11],["Q3",24.6,15.2]]; /slides/1/chart/data/dataset: expected "revenue" actual (missing); /slides/1/chart/data/columns: expected (missing) actual ["Quarter",{"name":"Costs","format":"$#,##0.0"},{"name":"Revenue","format":"$#,##0.0"}]; /slides/1/chart/data/rows: expected (missing) actual [["Q1",8.1,12.4],["Q2",11,18.1],["Q3",15.2,24.6]]; /slides/1/chart/mapping: expected {"category":"Quarter","series":["Costs","Revenue"]} actual (missing) |  |

## rr54-tables

PowerPoint 16.0 build 20430.

### C1 Formatted labels, value axes and table text display as documented: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 table size | 4 x 3 | 4 x 3 |  |
| PASS | slide 1 table cell (1,1) | "Region" | "Region" |  |
| PASS | slide 1 table cell (1,2) | "Revenue" | "Revenue" |  |
| PASS | slide 1 table cell (1,3) | "Growth" | "Growth" |  |
| PASS | slide 1 table cell (2,1) | "EMEA" | "EMEA" |  |
| PASS | slide 1 table cell (2,2) | "$8.2" | "$8.2" | format "$#,##0.0" |
| PASS | slide 1 table cell (2,3) | "40%" | "40%" | format "0%" |
| PASS | slide 1 table cell (3,1) | "APAC" | "APAC" |  |
| PASS | slide 1 table cell (3,2) | "$6.1" | "$6.1" | format "$#,##0.0" |
| PASS | slide 1 table cell (3,3) | "52.3%" | "52.3%" | format "0.0%" |
| PASS | slide 1 table cell (4,1) | "LATAM" | "LATAM" |  |
| PASS | slide 1 table cell (4,2) | "n/a" | "n/a" | format "$#,##0.0" |
| PASS | slide 1 table cell (4,3) | "" | "" | format "0%" |
| PASS | slide 2 bar chart type | XlChartType in [57] | 57 |  |
| PASS | slide 2 series 1 "Score" name | "Score" | "Score" |  |
| PASS | slide 2 series 1 "Score" no value labels | HasDataLabels false or ShowValue false | HasDataLabels false, ShowValue false |  |
| PASS | slide 2 Axes(2) value TickLabels.NumberFormat | "0.0" | "0.0" | OPF format "0.0" |
| INFO | slide 2 Axes(2) tick texts (derived from the native scale 6.6000000000000005..8.6 step 0.2; not read natively) | "6.6" "6.8" "7.0" "7.2" "7.4" "7.6" "7.8" "8.0" "8.2" "8.4" "8.6" | compare with the slide PNG |  |

### C2 Edit Data: workbook value cells carry the column formats: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 2 bar Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 27 ms (ready true, workbook open false) |  |
| PASS | slide 2 bar ChartData.Activate | activated, no error | activated |  |
| PASS | slide 2 bar Workbook.Close(False) | closed | true |  |
| PASS | slide 2 bar cell B2 ("Score" A) NumberFormat | "0.0" | "0.0" |  |
| PASS | slide 2 bar cell B2 ("Score" A) Value2 | 7.25 | 7.25 |  |
| PASS | slide 2 bar cell B2 ("Score" A) Text | "7.3" | "7.3" |  |
| PASS | slide 2 bar cell B3 ("Score" B) NumberFormat | "0.0" | "0.0" |  |
| PASS | slide 2 bar cell B3 ("Score" B) Value2 | 8.5 | 8.5 |  |
| PASS | slide 2 bar cell B3 ("Score" B) Text | "8.5" | "8.5" |  |

### C3 Read-only open with no repair prompt; frame custDataLst and presentation tags read back: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | open read-only reached stage read.done with no dialog | read.done/success | read.done/success |  |
| PASS | Presentation.ReadOnly | -1 | -1 |  |
| PASS | child exit | exit 0 | exit 0 |  |
| PASS | source deck unchanged | bf989f9141df9c3b | bf989f9141df9c3b -> bf989f9141df9c3b |  |
| PASS | presentation tag OPF_DOCUMENT_V1 | length 1010, sha256 b1fa30e848cc6cbb | length 1010, sha256 b1fa30e848cc6cbb |  |
| INFO | slide 1 frame "OPF table 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 1 frame "OPF table 1" tag OPF_DATA_V1 | length 522, sha256 cf658e547affff7f | length 522, sha256 cf658e547affff7f |  |
| INFO | slide 2 frame "OPF chart 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 2 frame "OPF chart 1" tag OPF_DATA_V1 | length 448, sha256 60d412a5e1502464 | length 448, sha256 60d412a5e1502464 |  |

### C4 Save a copy in PowerPoint, re-import offline: datasets, chart.data and chart.mapping restored: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | control: fromPptx(source deck) equals decks/<deck>.reimported.opf.json | equal | equal |  |
| PASS | save child | done, exit 0 | "done/success", exit 0 |  |
| PASS | opened read-only | -1 | -1 |  |
| PASS | source deck unchanged | bf989f9141df9c3b | bf989f9141df9c3b -> bf989f9141df9c3b |  |
| PASS | copy written by SaveCopyAs (format 24) | rr54-tables-saved.pptx | rr54-tables-saved.pptx, 32931 bytes, sha256 a6b9f2bbaa3dc41b |  |
| INFO | copy differs from the source bytes (PowerPoint rewrote the package) | expected: differs | differs |  |
| INFO | re-import builds | opf-pptx f0ea480 on core 11317237 | core package 0.12.2, node v24.21.0 |  |
| PASS | re-imported file is the copy this attempt saved | a6b9f2bbaa3dc41b | a6b9f2bbaa3dc41b |  |
| PASS | saved copy imports | ok | ok |  |
| PASS | no data-provenance diagnostic | none of chart-data-provenance-changed, table-data-provenance-changed, chart-dataset-unavailable, table-dataset-unavailable, invalid-data-provenance, data-provenance-omitted | none |  |
| INFO | other import diagnostics | - | heading-import-reflow at slides.0; heading-import-reflow at slides.1 |  |
| PASS | no datasets (none in the source) | absent | "absent" |  |
| PASS | slide 1 table equals the source-side re-import | equal | equal |  |
| PASS | slide 2 bar chart.data equals the source-side re-import | {"columns":["Team",{"name":"Score","format":"0.0"}],"rows":[["A",7.25],["B",8.5]],"source":{"src":"https://example.com/scores.csv","description":"Survey export" | {"columns":["Team",{"name":"Score","format":"0.0"}],"rows":[["A",7.25],["B",8.5]],"source":{"src":"https://example.com/scores.csv","description":"Survey export" |  |
| PASS | slide 2 bar chart.data equals the source .opf.json | {"columns":["Team",{"name":"Score","format":"0.0"}],"rows":[["A",7.25],["B",8.5]],"source":{"src":"https://example.com/scores.csv","description":"Survey export" | {"columns":["Team",{"name":"Score","format":"0.0"}],"rows":[["A",7.25],["B",8.5]],"source":{"src":"https://example.com/scores.csv","description":"Survey export" |  |
| PASS | slide 2 bar whole chart equals the source-side re-import | equal | equal |  |
| INFO | whole document vs the source-side re-import | equal | equal |  |

## rr54-spellings (supplementary deck)

PowerPoint 16.0 build 20430.

### C1 Formatted labels, value axes and table text display as documented: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 column chart type | XlChartType in [51] | 51 |  |
| PASS | slide 1 series 1 "Optional decimals" name | "Optional decimals" | "Optional decimals" |  |
| PASS | slide 1 series 1 "Optional decimals" DataLabels.ShowValue | true | true |  |
| PASS | slide 1 series 1 "Optional decimals" DataLabels.NumberFormat | "0.##" | "0.##" | OPF format "0.##" |
| PASS | slide 1 series 1 "Optional decimals" point 1 (whole 5, 5) label | "5." | "5." | documented Excel display; core/preview shows "5" |
| PASS | slide 1 series 1 "Optional decimals" point 2 (1.5, 1.5) label | "1.5" | "1.5" |  |
| PASS | slide 1 series 1 "Optional decimals" point 3 (2.345 rounds, 2.345) label | "2.35" | "2.35" |  |
| PASS | slide 1 series 1 "Optional decimals" point 4 (zero, 0) label | "0." | "0." | documented Excel display; core/preview shows "0" |
| PASS | slide 1 series 1 "Optional decimals" point 5 (-5, -5) label | "-5." | "-5." | documented Excel display; core/preview shows "-5" |
| PASS | slide 1 series 1 "Optional decimals" point 6 (-1.25, -1.25) label | "-1.25" | "-1.25" |  |
| PASS | slide 1 series 1 "Optional decimals" point 7 (0.004 rounds, 0.004) label | "0." | "0." | documented Excel display; core/preview shows "0" |
| PASS | slide 1 series 1 "Optional decimals" point 8 (12, 12) label | "12." | "12." | documented Excel display; core/preview shows "12" |
| PASS | slide 1 Axes(2) value TickLabels.NumberFormat | "0.##" | "0.##" | OPF format "0.##" |
| INFO | slide 1 Axes(2) tick texts (derived from the native scale -6..14 step 2; not read natively) | "-6." "-4." "-2." "0." "2." "4." "6." "8." "10." "12." "14." | compare with the slide PNG |  |
| PASS | slide 2 column chart type | XlChartType in [51] | 51 |  |
| PASS | slide 2 series 1 "Hash" name | "Hash" | "Hash" |  |
| PASS | slide 2 series 1 "Hash" DataLabels.ShowValue | true | true |  |
| PASS | slide 2 series 1 "Hash" DataLabels.NumberFormat | "#" | "#" | OPF format "#" |
| PASS | slide 2 series 1 "Hash" point 1 (5, 5) label | "5" | "5" |  |
| PASS | slide 2 series 1 "Hash" point 2 (zero, 0) label | "" | "" | documented Excel display; core/preview shows "0" |
| PASS | slide 2 series 1 "Hash" point 3 (0.4 rounds to 0, 0.4) label | "" | "" | documented Excel display; core/preview shows "0" |
| PASS | slide 2 series 1 "Hash" point 4 (0.6 rounds to 1, 0.6) label | "1" | "1" |  |
| PASS | slide 2 series 1 "Hash" point 5 (-3, -3) label | "-3" | "-3" |  |
| PASS | slide 2 series 1 "Hash" point 6 (1234, 1234) label | "1234" | "1234" |  |
| PASS | slide 2 series 1 "Hash" point 7 (2.5 rounds, 2.5) label | "3" | "3" |  |
| PASS | slide 2 Axes(2) value TickLabels.NumberFormat | "#" | "#" | OPF format "#" |
| INFO | slide 2 Axes(2) tick texts (derived from the native scale -200..1400 step 200; not read natively) | "-200" "" "200" "400" "600" "800" "1000" "1200" "1400" | compare with the slide PNG |  |
| PASS | slide 3 line chart type | XlChartType in [4, 65] | 4 |  |
| PASS | slide 3 series 1 "Grouped hash" name | "Grouped hash" | "Grouped hash" |  |
| PASS | slide 3 series 1 "Grouped hash" DataLabels.ShowValue | true | true |  |
| PASS | slide 3 series 1 "Grouped hash" DataLabels.NumberFormat | "#,###" | "#,###" | OPF format "#,###" |
| PASS | slide 3 series 1 "Grouped hash" point 1 (zero, 0) label | "" | "" | documented Excel display; core/preview shows "0" |
| PASS | slide 3 series 1 "Grouped hash" point 2 (1234, 1234) label | "1,234" | "1,234" |  |
| PASS | slide 3 series 1 "Grouped hash" point 3 (5678.5, 5678.5) label | "5,679" | "5,679" |  |
| PASS | slide 3 series 1 "Grouped hash" point 4 (-2000, -2000) label | "-2,000" | "-2,000" |  |
| PASS | slide 3 Axes(2) value TickLabels.NumberFormat | "#,###" | "#,###" | OPF format "#,###" |
| INFO | slide 3 Axes(2) tick texts (derived from the native scale -3000..7000 step 1000; not read natively) | "-3,000" "-2,000" "-1,000" "" "1,000" "2,000" "3,000" "4,000" "5,000" "6,000" "7,000" | compare with the slide PNG |  |
| PASS | slide 4 column chart type | XlChartType in [51] | 51 |  |
| PASS | slide 4 series 1 "Min one decimal" name | "Min one decimal" | "Min one decimal" |  |
| PASS | slide 4 series 1 "Min one decimal" DataLabels.ShowValue | true | true |  |
| PASS | slide 4 series 1 "Min one decimal" DataLabels.NumberFormat | "0.0#" | "0.0#" | OPF format "0.0#" |
| PASS | slide 4 series 1 "Min one decimal" point 1 (whole, 5) label | "5.0" | "5.0" |  |
| PASS | slide 4 series 1 "Min one decimal" point 2 (zero, 0) label | "0.0" | "0.0" |  |
| PASS | slide 4 series 1 "Min one decimal" point 3 (rounding, 2.345) label | "2.35" | "2.35" |  |
| PASS | slide 4 series 1 "Min one decimal" point 4 (negative, -1.25) label | "-1.25" | "-1.25" |  |
| PASS | slide 4 series 2 "Zero-ended integer" name | "Zero-ended integer" | "Zero-ended integer" |  |
| PASS | slide 4 series 2 "Zero-ended integer" DataLabels.ShowValue | true | true |  |
| PASS | slide 4 series 2 "Zero-ended integer" DataLabels.NumberFormat | "#,##0" | "#,##0" | OPF format "#,##0" |
| PASS | slide 4 series 2 "Zero-ended integer" point 1 (whole, 5) label | "5" | "5" |  |
| PASS | slide 4 series 2 "Zero-ended integer" point 2 (zero, 0) label | "0" | "0" |  |
| PASS | slide 4 series 2 "Zero-ended integer" point 3 (rounding, 1234.5) label | "1,235" | "1,235" |  |
| PASS | slide 4 series 2 "Zero-ended integer" point 4 (negative, -3) label | "-3" | "-3" |  |
| PASS | slide 4 Axes(2) value TickLabels.NumberFormat | "0.0#" | "0.0#" | OPF format "0.0#" |
| INFO | slide 4 Axes(2) tick texts (derived from the native scale -200..1400 step 200; not read natively) | "-200.0" "0.0" "200.0" "400.0" "600.0" "800.0" "1000.0" "1200.0" "1400.0" | compare with the slide PNG |  |
| PASS | slide 5 table size | 5 x 4 | 5 x 4 |  |
| PASS | slide 5 table cell (1,1) | "Case" | "Case" |  |
| PASS | slide 5 table cell (1,2) | "Optional decimals" | "Optional decimals" |  |
| PASS | slide 5 table cell (1,3) | "Hash" | "Hash" |  |
| PASS | slide 5 table cell (1,4) | "Grouped hash" | "Grouped hash" |  |
| PASS | slide 5 table cell (2,1) | "whole" | "whole" |  |
| PASS | slide 5 table cell (2,2) | "5" | "5" | tables carry core text; Excel would show "5." for this format |
| PASS | slide 5 table cell (2,3) | "5" | "5" | format "#" |
| PASS | slide 5 table cell (2,4) | "1,234" | "1,234" | format "#,###" |
| PASS | slide 5 table cell (3,1) | "zero" | "zero" |  |
| PASS | slide 5 table cell (3,2) | "0" | "0" | tables carry core text; Excel would show "0." for this format |
| PASS | slide 5 table cell (3,3) | "0" | "0" | tables carry core text; Excel would show "" for this format |
| PASS | slide 5 table cell (3,4) | "0" | "0" | tables carry core text; Excel would show "" for this format |
| PASS | slide 5 table cell (4,1) | "negative" | "negative" |  |
| PASS | slide 5 table cell (4,2) | "-5" | "-5" | tables carry core text; Excel would show "-5." for this format |
| PASS | slide 5 table cell (4,3) | "-3" | "-3" | format "#" |
| PASS | slide 5 table cell (4,4) | "-1,234" | "-1,234" | format "#,###" |
| PASS | slide 5 table cell (5,1) | "rounding" | "rounding" |  |
| PASS | slide 5 table cell (5,2) | "2.35" | "2.35" | format "0.##" |
| PASS | slide 5 table cell (5,3) | "3" | "3" | format "#" |
| PASS | slide 5 table cell (5,4) | "1,235" | "1,235" | format "#,###" |

### C2 Edit Data: workbook value cells carry the column formats: FAIL

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | slide 1 column Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 28 ms (ready true, workbook open false) |  |
| PASS | slide 1 column ChartData.Activate | activated, no error | activated |  |
| PASS | slide 1 column Workbook.Close(False) | closed | true |  |
| PASS | slide 1 column cell B2 ("Optional decimals" whole 5) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B2 ("Optional decimals" whole 5) Value2 | 5 | 5 |  |
| PASS | slide 1 column cell B2 ("Optional decimals" whole 5) Text | "5." | "5." |  |
| PASS | slide 1 column cell B3 ("Optional decimals" 1.5) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B3 ("Optional decimals" 1.5) Value2 | 1.5 | 1.5 |  |
| PASS | slide 1 column cell B3 ("Optional decimals" 1.5) Text | "1.5" | "1.5" |  |
| PASS | slide 1 column cell B4 ("Optional decimals" 2.345 rounds) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B4 ("Optional decimals" 2.345 rounds) Value2 | 2.345 | 2.345 |  |
| PASS | slide 1 column cell B4 ("Optional decimals" 2.345 rounds) Text | "2.35" | "2.35" |  |
| PASS | slide 1 column cell B5 ("Optional decimals" zero) NumberFormat | "0.##" | "0.##" |  |
| FAIL | slide 1 column cell B5 ("Optional decimals" zero) Value2 | 0 | null |  |
| FAIL | slide 1 column cell B5 ("Optional decimals" zero) Text | "0." | "" |  |
| PASS | slide 1 column cell B6 ("Optional decimals" -5) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B6 ("Optional decimals" -5) Value2 | -5 | -5 |  |
| PASS | slide 1 column cell B6 ("Optional decimals" -5) Text | "-5." | "-5." |  |
| PASS | slide 1 column cell B7 ("Optional decimals" -1.25) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B7 ("Optional decimals" -1.25) Value2 | -1.25 | -1.25 |  |
| PASS | slide 1 column cell B7 ("Optional decimals" -1.25) Text | "-1.25" | "-1.25" |  |
| PASS | slide 1 column cell B8 ("Optional decimals" 0.004 rounds) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B8 ("Optional decimals" 0.004 rounds) Value2 | 0.004 | 0.004 |  |
| PASS | slide 1 column cell B8 ("Optional decimals" 0.004 rounds) Text | "0." | "0." |  |
| PASS | slide 1 column cell B9 ("Optional decimals" 12) NumberFormat | "0.##" | "0.##" |  |
| PASS | slide 1 column cell B9 ("Optional decimals" 12) Value2 | 12 | 12 |  |
| PASS | slide 1 column cell B9 ("Optional decimals" 12) Text | "12." | "12." |  |
| PASS | slide 2 column Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 28 ms (ready true, workbook open false) |  |
| PASS | slide 2 column ChartData.Activate | activated, no error | activated |  |
| PASS | slide 2 column Workbook.Close(False) | closed | true |  |
| PASS | slide 2 column cell B2 ("Hash" 5) NumberFormat | "#" | "#" |  |
| PASS | slide 2 column cell B2 ("Hash" 5) Value2 | 5 | 5 |  |
| PASS | slide 2 column cell B2 ("Hash" 5) Text | "5" | "5" |  |
| PASS | slide 2 column cell B3 ("Hash" zero) NumberFormat | "#" | "#" |  |
| FAIL | slide 2 column cell B3 ("Hash" zero) Value2 | 0 | null |  |
| PASS | slide 2 column cell B3 ("Hash" zero) Text | "" | "" |  |
| PASS | slide 2 column cell B4 ("Hash" 0.4 rounds to 0) NumberFormat | "#" | "#" |  |
| PASS | slide 2 column cell B4 ("Hash" 0.4 rounds to 0) Value2 | 0.4 | 0.4 |  |
| PASS | slide 2 column cell B4 ("Hash" 0.4 rounds to 0) Text | "" | "" |  |
| PASS | slide 2 column cell B5 ("Hash" 0.6 rounds to 1) NumberFormat | "#" | "#" |  |
| PASS | slide 2 column cell B5 ("Hash" 0.6 rounds to 1) Value2 | 0.6 | 0.6 |  |
| PASS | slide 2 column cell B5 ("Hash" 0.6 rounds to 1) Text | "1" | "1" |  |
| PASS | slide 2 column cell B6 ("Hash" -3) NumberFormat | "#" | "#" |  |
| PASS | slide 2 column cell B6 ("Hash" -3) Value2 | -3 | -3 |  |
| PASS | slide 2 column cell B6 ("Hash" -3) Text | "-3" | "-3" |  |
| PASS | slide 2 column cell B7 ("Hash" 1234) NumberFormat | "#" | "#" |  |
| PASS | slide 2 column cell B7 ("Hash" 1234) Value2 | 1234 | 1234 |  |
| PASS | slide 2 column cell B7 ("Hash" 1234) Text | "1234" | "1234" |  |
| PASS | slide 2 column cell B8 ("Hash" 2.5 rounds) NumberFormat | "#" | "#" |  |
| PASS | slide 2 column cell B8 ("Hash" 2.5 rounds) Value2 | 2.5 | 2.5 |  |
| PASS | slide 2 column cell B8 ("Hash" 2.5 rounds) Text | "3" | "3" |  |
| PASS | slide 3 line Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 31 ms (ready true, workbook open false) |  |
| PASS | slide 3 line ChartData.Activate | activated, no error | activated |  |
| PASS | slide 3 line Workbook.Close(False) | closed | true |  |
| PASS | slide 3 line cell B2 ("Grouped hash" zero) NumberFormat | "#,###" | "#,###" |  |
| FAIL | slide 3 line cell B2 ("Grouped hash" zero) Value2 | 0 | null |  |
| PASS | slide 3 line cell B2 ("Grouped hash" zero) Text | "" | "" |  |
| PASS | slide 3 line cell B3 ("Grouped hash" 1234) NumberFormat | "#,###" | "#,###" |  |
| PASS | slide 3 line cell B3 ("Grouped hash" 1234) Value2 | 1234 | 1234 |  |
| PASS | slide 3 line cell B3 ("Grouped hash" 1234) Text | "1,234" | "1,234" |  |
| PASS | slide 3 line cell B4 ("Grouped hash" 5678.5) NumberFormat | "#,###" | "#,###" |  |
| PASS | slide 3 line cell B4 ("Grouped hash" 5678.5) Value2 | 5678.5 | 5678.5 |  |
| PASS | slide 3 line cell B4 ("Grouped hash" 5678.5) Text | "5,679" | "5,679" |  |
| PASS | slide 3 line cell B5 ("Grouped hash" -2000) NumberFormat | "#,###" | "#,###" |  |
| PASS | slide 3 line cell B5 ("Grouped hash" -2000) Value2 | -2000 | -2000 |  |
| PASS | slide 3 line cell B5 ("Grouped hash" -2000) Text | "-2,000" | "-2,000" |  |
| PASS | slide 4 column Excel released after Workbook.Close (Ready, workbook gone; polled up to 5 s) | released | released after 30 ms (ready true, workbook open false) |  |
| PASS | slide 4 column ChartData.Activate | activated, no error | activated |  |
| PASS | slide 4 column Workbook.Close(False) | closed | true |  |
| PASS | slide 4 column cell B2 ("Min one decimal" whole) NumberFormat | "0.0#" | "0.0#" |  |
| PASS | slide 4 column cell B2 ("Min one decimal" whole) Value2 | 5 | 5 |  |
| PASS | slide 4 column cell B2 ("Min one decimal" whole) Text | "5.0" | "5.0" |  |
| PASS | slide 4 column cell B3 ("Min one decimal" zero) NumberFormat | "0.0#" | "0.0#" |  |
| FAIL | slide 4 column cell B3 ("Min one decimal" zero) Value2 | 0 | null |  |
| FAIL | slide 4 column cell B3 ("Min one decimal" zero) Text | "0.0" | "" |  |
| PASS | slide 4 column cell B4 ("Min one decimal" rounding) NumberFormat | "0.0#" | "0.0#" |  |
| PASS | slide 4 column cell B4 ("Min one decimal" rounding) Value2 | 2.345 | 2.345 |  |
| PASS | slide 4 column cell B4 ("Min one decimal" rounding) Text | "2.35" | "2.35" |  |
| PASS | slide 4 column cell B5 ("Min one decimal" negative) NumberFormat | "0.0#" | "0.0#" |  |
| PASS | slide 4 column cell B5 ("Min one decimal" negative) Value2 | -1.25 | -1.25 |  |
| PASS | slide 4 column cell B5 ("Min one decimal" negative) Text | "-1.25" | "-1.25" |  |
| PASS | slide 4 column cell C2 ("Zero-ended integer" whole) NumberFormat | "#,##0" | "#,##0" |  |
| PASS | slide 4 column cell C2 ("Zero-ended integer" whole) Value2 | 5 | 5 |  |
| PASS | slide 4 column cell C2 ("Zero-ended integer" whole) Text | "5" | "5" |  |
| PASS | slide 4 column cell C3 ("Zero-ended integer" zero) NumberFormat | "#,##0" | "#,##0" |  |
| FAIL | slide 4 column cell C3 ("Zero-ended integer" zero) Value2 | 0 | null |  |
| FAIL | slide 4 column cell C3 ("Zero-ended integer" zero) Text | "0" | "" |  |
| PASS | slide 4 column cell C4 ("Zero-ended integer" rounding) NumberFormat | "#,##0" | "#,##0" |  |
| PASS | slide 4 column cell C4 ("Zero-ended integer" rounding) Value2 | 1234.5 | 1234.5 |  |
| PASS | slide 4 column cell C4 ("Zero-ended integer" rounding) Text | "1,235" | "1,235" |  |
| PASS | slide 4 column cell C5 ("Zero-ended integer" negative) NumberFormat | "#,##0" | "#,##0" |  |
| PASS | slide 4 column cell C5 ("Zero-ended integer" negative) Value2 | -3 | -3 |  |
| PASS | slide 4 column cell C5 ("Zero-ended integer" negative) Text | "-3" | "-3" |  |

### C3 Read-only open with no repair prompt; frame custDataLst and presentation tags read back: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | open read-only reached stage read.done with no dialog | read.done/success | read.done/success |  |
| PASS | Presentation.ReadOnly | -1 | -1 |  |
| PASS | child exit | exit 0 | exit 0 |  |
| PASS | source deck unchanged | 17efc8182ac76615 | 17efc8182ac76615 -> 17efc8182ac76615 |  |
| PASS | presentation tag OPF_DOCUMENT_V1 | length 1010, sha256 0f67cf5b601c57d5 | length 1010, sha256 0f67cf5b601c57d5 |  |
| INFO | slide 1 frame "OPF chart 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 1 frame "OPF chart 1" tag OPF_DATA_V1 | length 510, sha256 2ef3e7995a8a714f | length 510, sha256 2ef3e7995a8a714f |  |
| INFO | slide 2 frame "OPF chart 2" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 2 frame "OPF chart 2" tag OPF_DATA_V1 | length 460, sha256 7fcd9b6dc3d189f5 | length 460, sha256 7fcd9b6dc3d189f5 |  |
| INFO | slide 3 frame "OPF chart 3" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 3 frame "OPF chart 3" tag OPF_DATA_V1 | length 382, sha256 518d5cb985e1e5b8 | length 382, sha256 518d5cb985e1e5b8 |  |
| INFO | slide 4 frame "OPF chart 4" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 4 frame "OPF chart 4" tag OPF_DATA_V1 | length 512, sha256 524cee88c8922b54 | length 512, sha256 524cee88c8922b54 |  |
| INFO | slide 5 frame "OPF table 1" Shape.Tags | 1 tag(s): OPF_DATA_V1 | Count 1: OPF_DATA_V1 |  |
| PASS | slide 5 frame "OPF table 1" tag OPF_DATA_V1 | length 910, sha256 58e348b1cd4d2c3b | length 910, sha256 58e348b1cd4d2c3b |  |

### C4 Save a copy in PowerPoint, re-import offline: datasets, chart.data and chart.mapping restored: PASS

| Status | Item | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| PASS | control: fromPptx(source deck) equals decks/<deck>.reimported.opf.json | equal | equal |  |
| PASS | save child | done, exit 0 | "done/success", exit 0 |  |
| PASS | opened read-only | -1 | -1 |  |
| PASS | source deck unchanged | 17efc8182ac76615 | 17efc8182ac76615 -> 17efc8182ac76615 |  |
| PASS | copy written by SaveCopyAs (format 24) | rr54-spellings-saved.pptx | rr54-spellings-saved.pptx, 73446 bytes, sha256 0cf8d5c58ca805ea |  |
| INFO | copy differs from the source bytes (PowerPoint rewrote the package) | expected: differs | differs |  |
| INFO | re-import builds | opf-pptx f0ea480 on core 11317237 | core package 0.12.2, node v24.21.0 |  |
| PASS | re-imported file is the copy this attempt saved | 0cf8d5c58ca805ea | 0cf8d5c58ca805ea |  |
| PASS | saved copy imports | ok | ok |  |
| PASS | no data-provenance diagnostic | none of chart-data-provenance-changed, table-data-provenance-changed, chart-dataset-unavailable, table-dataset-unavailable, invalid-data-provenance, data-provenance-omitted | none |  |
| INFO | other import diagnostics | - | heading-import-reflow at slides.0; heading-import-reflow at slides.1; heading-import-reflow at slides.2; heading-import-reflow at slides.3; heading-import-reflow at slides.4 |  |
| PASS | no datasets (none in the source) | absent | "absent" |  |
| PASS | slide 1 column chart.data equals the source-side re-import | {"columns":["Case",{"name":"Optional decimals","format":"0.##"}],"rows":[["whole 5",5],["1.5",1.5],["2.345 rounds",2.345],["zero",0],["-5",-5],["-1.25",-1.25],[ | {"columns":["Case",{"name":"Optional decimals","format":"0.##"}],"rows":[["whole 5",5],["1.5",1.5],["2.345 rounds",2.345],["zero",0],["-5",-5],["-1.25",-1.25],[ |  |
| PASS | slide 1 column chart.data equals the source .opf.json | {"columns":["Case",{"name":"Optional decimals","format":"0.##"}],"rows":[["whole 5",5],["1.5",1.5],["2.345 rounds",2.345],["zero",0],["-5",-5],["-1.25",-1.25],[ | {"columns":["Case",{"name":"Optional decimals","format":"0.##"}],"rows":[["whole 5",5],["1.5",1.5],["2.345 rounds",2.345],["zero",0],["-5",-5],["-1.25",-1.25],[ |  |
| PASS | slide 1 column whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 2 column chart.data equals the source-side re-import | {"columns":["Case",{"name":"Hash","format":"#"}],"rows":[["5",5],["zero",0],["0.4 rounds to 0",0.4],["0.6 rounds to 1",0.6],["-3",-3],["1234",1234],["2.5 rounds | {"columns":["Case",{"name":"Hash","format":"#"}],"rows":[["5",5],["zero",0],["0.4 rounds to 0",0.4],["0.6 rounds to 1",0.6],["-3",-3],["1234",1234],["2.5 rounds |  |
| PASS | slide 2 column chart.data equals the source .opf.json | {"columns":["Case",{"name":"Hash","format":"#"}],"rows":[["5",5],["zero",0],["0.4 rounds to 0",0.4],["0.6 rounds to 1",0.6],["-3",-3],["1234",1234],["2.5 rounds | {"columns":["Case",{"name":"Hash","format":"#"}],"rows":[["5",5],["zero",0],["0.4 rounds to 0",0.4],["0.6 rounds to 1",0.6],["-3",-3],["1234",1234],["2.5 rounds |  |
| PASS | slide 2 column whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 3 line chart.data equals the source-side re-import | {"columns":["Case",{"name":"Grouped hash","format":"#,###"}],"rows":[["zero",0],["1234",1234],["5678.5",5678.5],["-2000",-2000]]} | {"columns":["Case",{"name":"Grouped hash","format":"#,###"}],"rows":[["zero",0],["1234",1234],["5678.5",5678.5],["-2000",-2000]]} |  |
| PASS | slide 3 line chart.data equals the source .opf.json | {"columns":["Case",{"name":"Grouped hash","format":"#,###"}],"rows":[["zero",0],["1234",1234],["5678.5",5678.5],["-2000",-2000]]} | {"columns":["Case",{"name":"Grouped hash","format":"#,###"}],"rows":[["zero",0],["1234",1234],["5678.5",5678.5],["-2000",-2000]]} |  |
| PASS | slide 3 line whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 4 column chart.data equals the source-side re-import | {"columns":["Case",{"name":"Min one decimal","format":"0.0#"},{"name":"Zero-ended integer","format":"#,##0"}],"rows":[["whole",5,5],["zero",0,0],["rounding",2.3 | {"columns":["Case",{"name":"Min one decimal","format":"0.0#"},{"name":"Zero-ended integer","format":"#,##0"}],"rows":[["whole",5,5],["zero",0,0],["rounding",2.3 |  |
| PASS | slide 4 column chart.data equals the source .opf.json | {"columns":["Case",{"name":"Min one decimal","format":"0.0#"},{"name":"Zero-ended integer","format":"#,##0"}],"rows":[["whole",5,5],["zero",0,0],["rounding",2.3 | {"columns":["Case",{"name":"Min one decimal","format":"0.0#"},{"name":"Zero-ended integer","format":"#,##0"}],"rows":[["whole",5,5],["zero",0,0],["rounding",2.3 |  |
| PASS | slide 4 column whole chart equals the source-side re-import | equal | equal |  |
| PASS | slide 5 table equals the source-side re-import | equal | equal |  |
| INFO | whole document vs the source-side re-import | equal | equal |  |
