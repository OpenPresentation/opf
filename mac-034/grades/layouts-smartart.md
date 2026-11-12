# Keynote grades: layouts and SmartArt

| file | slide | what differs | size |
| --- | --- | --- | --- |
| layout-harvest | 17 | Histogram: Keynote draws 24 raw single-value bars with category labels 1-24 and an auto axis (0-9); the preview shows 4 bins ([1.2, 3.1] ... [6.8, 8.6]) with counts 10/8/4/2 and bin labels. Bins and labels lost, data shown is different. | major |
| layout-harvest | 18 | Pareto: cumulative-percent line and the secondary 0-100% axis are missing; only the bars remain (values correct, axis 0-5000 with different ticks). | major |
| layout-harvest | 19 | Waterfall: bars all start at zero (no floating deltas, axis -2250000..9000000), data labels (8,400,000, -1,250,000 ...) and dashed connectors are missing, total bars lose their white emphasis color, axis unformatted (no thousands grouping), "Cost" axis title missing. Reads as a plain column chart. | major |
| layout-harvest | 15 | Table + note: header row wraps ("On / time", "Damag / e" breaks mid-word) and is taller; header fill is a duller blue; table runs a little taller. Content intact. | moderate |
| layout-harvest | 13 | "62 minutes a day" runs to the edge of its column and touches "1 in 6 reports" (font width). | minor |
| layout-harvest | 2,4,11,13,14,15 | Accent blue (surfaces, bands, panels) renders duller and slightly grayer (about #3E72A3 vs #2977A8). Same in smartart shapes. | minor |
| layout-harvest | 1,3,5-10,12,14,16,20 | OK apart from font substitution (Aptos to a Helvetica-like face), text 2-4 px higher. Icons, portraits, picture bands, stepper line, message and closing slides all present and aligned. | OK |
| layout-harvest~native-body | 1-20 | Same as default variant; no difference that matters (scores within 0.2% on every slide). | OK |
| smartart (fallback, slides 1,3,5,7,9,11) | all | Picture fallback shown on every one; all nodes and text present, shapes match preview (pyramid 3, matrix 4, cycle 5 with arrows, chevron 4, process 4 with arrows, vertical process 3). Only the duller blue. | pass |
| smartart | 13-17 | Native/OPF-layout SmartArt slides (7, 3, 8, 8, 6 nodes): all nodes, labels, arrows and order match; wrapped chevrons, snake flow, card grid and stepped pyramid correct. Only color shift. | OK |
| smartart | 2,6,12 (viewed); 4,8,10 not opened, scores 3-6.5% are the same text-only pattern | Native shapes match preview; text slightly larger/wider in Keynote but fits boxes (slide 12 "Shared goals" nearly fills its box). | minor |
| smartart~shapes | 1-17 | Not individually opened; scores equal the default deck's (1-3% on diagram slides, same on native slides), so same result. | OK (by score) |
| smartart-arabic | 1,3 (2 not opened, 1.6%) | Right-to-left order preserved, all text shaped correctly (Noto Naskh), shapes match. | OK |
| smartart-japanese | 1,2 (3 not opened, 2.0%) | All text present; same breaks as preview ("ビジョ/ン", "チームと基/盤"), fits. | OK |
| trees-and-sets | 1,2,3 | Org chart, hierarchy (with tabbed-card nodes) and Venn match node for node; Venn overlaps and transparency present; "Illustrative example" footer present. | OK |
| inverted-pyramids | 1,2,3 | Widest tier on top, entry order kept, text fits (slide 3 bullets all present). | OK |

## Feature lines
- LH-158 (1, 11): pass
- LH-09 (2): pass
- LH-164 (2, 4): pass (accent slightly duller)
- LH-14 (3, 6, 7): pass
- LH-165 (5, 8): pass
- LH-132 (9, 10): pass
- LH-168 (12): pass
- LH-169 (13): pass (heading touches neighbor at 62 minutes a day)
- LH-63 (14): pass
- LH-75 (15): differs (header row wraps, "Damag/e"); table is native (not probed here)
- LH-18 (16): pass
- LH-160 (17, 18): differs (histogram shows 24 raw bars not 4 bins; Pareto loses cumulative line and right axis)
- LH-153 (19): differs (waterfall not floating, no labels or connectors, no thousands grouping)
- LH-155 (20): pass
- LH-native-body: pass
- SH-09, SH-17, SH-18, SH-19 visual: pass; smartArt node edits not graded here
- SH-16 fallback (smartart 1,3,5,7,9,11): pass
- SH-19-native (2,4,6,8,10,12): pass (4, 8, 10 by score only)
- SH-smartart-shapes: pass (by score)
- SH-smartart-rtl: pass
- SH-smartart-cjk: pass
- SH-24: pass; noShrink/roundtrip not graded here
- SH-21: pass; roundtrip not graded here
- noOverflow: no clipping or overflow seen on any slide
