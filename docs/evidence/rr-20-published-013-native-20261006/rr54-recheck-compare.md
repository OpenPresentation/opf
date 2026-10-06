# RR-54 re-check: format re-spelling (opf-pptx#171) and workbook zeros (opf-pptx#172)

Builds: published npm @openpresentation/opf-pptx 0.13.1 (core 0.13.0).

Summary: 13 PASS, 0 FAIL, 0 BASELINE, 0 NOT RUN.

| File | Check | Status | Detail |
| --- | --- | --- | --- |
| c4-formats-after.pptx | C3 open | PASS | stage done; 6 slides; source sha256 unchanged. A repair prompt is a FAIL: record it by hand. |
| c4-formats-after.pptx | C4 save copy | PASS | payloads equal true, datasets equal true; data diagnostics: none; scatter names a, b, c; re-spelled codes: ppt/charts/chart1.xml: \$#,##0.0 ; ppt/charts/chart1.xml:  ; ppt/charts/chart1.xml: #,##0\ &quot;units&quot; ; ppt/charts/chart1.xml: #,##0\  ; ppt/charts/chart2.xml:  ; ppt/charts/chart3.xml: \$#,##0 ; ppt/charts/chart3.xml: 0.0\  ; ppt/charts/chart3.xml:  ; ppt/charts/chart3.xml: 0.0\ &quot;kg&quot; ; ppt/charts/chart4.xml: \$#,##0 ; ppt/charts/chart4.xml:  ; ppt/charts/chart6.xml:  ; ppt/charts/chart6.xml: 0.0\ &quot;m/s&quot; ; ppt/charts/chart6.xml: 0.0\  ; ppt/charts/chart6.xml: \+0.0\ &quot;pts&quot; ; ppt/charts/chart6.xml: \+0.0\  |
| c4-datasets-after.pptx | C3 open | PASS | stage done; 6 slides; source sha256 unchanged. A repair prompt is a FAIL: record it by hand. |
| c4-datasets-after.pptx | C4 save copy | PASS | payloads equal true, datasets equal true; data diagnostics: none; scatter names -; re-spelled codes: ppt/charts/chart1.xml: \$#,##0 ; ppt/charts/chart1.xml:  ; ppt/charts/chart2.xml: #,##0\  ; ppt/charts/chart2.xml:  ; ppt/charts/chart2.xml: \$#,##0 ; ppt/charts/chart2.xml: #,##0\ &quot;units&quot; ; ppt/charts/chart3.xml: #,##0\  ; ppt/charts/chart3.xml:  ; ppt/charts/chart4.xml:  |
| c2-zeros-after.pptx | C3 open | PASS | stage done; 8 slides; source sha256 unchanged. A repair prompt is a FAIL: record it by hand. |
| c2-zeros-after.pptx | C2 Edit Data slide 1 | PASS | every value cell matches the chart cache (zeros B3, B4, C3, C4, C7; used range A1:C7) |
| c2-zeros-after.pptx | C2 Edit Data slide 2 | PASS | every value cell matches the chart cache (zeros B3, B4, C3, C4, C7; used range A1:C7) |
| c2-zeros-after.pptx | C2 Edit Data slide 3 | PASS | every value cell matches the chart cache (zeros B3, B4, C3, C4, C7; used range A1:C7) |
| c2-zeros-after.pptx | C2 Edit Data slide 4 | PASS | every value cell matches the chart cache (zeros B3, B4, C3, C4, C7; used range A1:C7) |
| c2-zeros-after.pptx | C2 Edit Data slide 5 | PASS | every value cell matches the chart cache (zeros B3, B4, C3, C4, C7; used range A1:C7) |
| c2-zeros-after.pptx | C2 Edit Data slide 6 | PASS | every value cell matches the chart cache (zeros B3; used range A1:B4) |
| c2-zeros-after.pptx | C2 Edit Data slide 7 | PASS | every value cell matches the chart cache (zeros B3; used range A1:B4) |
| c2-zeros-after.pptx | C2 Edit Data slide 8 (scatter) | PASS | every value cell matches the chart cache (zeros A3, B3, B5, B6; used range A1:B6) |
