# Keynote grades: charts and examples set (OPF v0.34.0 RC)

Slide counts match the preview for every deck (full-feature-tour 10/10, compliance-readiness-review 9/9). Keynote exported only visible slides and the preview omits the hidden one too, so there is no offset. The footer number differs: preview shows 11 / 10 (counts the hidden slide), Keynote 10 / 9 (renumbers).

## Major / moderate differences
| file | slide | what differs | size |
|---|---|---|---|
| chart-type-sampler | 2 | Waterfall drawn as plain column chart: 100, 24, -8, 116 as separate bars from zero (no floating deltas, no connectors, no +24/-8 labels, no "Value" title). Funnel (120/72/31) drawn as vertical columns, no data labels. Treemap (Product/Sales/Support) drawn as columns on a 0-50 axis; areas, nesting and tile colors lost. | major |
| chart-type-sampler | 1 | Box plot drawn as three columns (heights 5, 8, 12, each labeled "Team"): box, median line, mean marker, whiskers lost. Histogram (0-5/6-10/11-15 = 8/12/4) and scatter (two points) OK. | major |
| data-story-academy | 3 | Highlighted US bar lost its accent (orange in preview, gray in Keynote); ring overlay still on bar end, crosses "$109.4" label as in preview. | moderate |
| data-story-academy | 4 | Highlighted "Are confident" 21% column lost its orange accent (gray). Data, labels OK. | moderate |
| full-feature-tour | 3 | Chart axis labels (Apr..Sep) sit at the footer line and "May" collides with centered footer text "Performance". Data and labels OK. | moderate |
| full-feature-tour | 4 | Category labels (Americas/EMEA/APAC) sit on the footer line; "EMEA" overlaps footer text "Performance". Data, legend, colors OK. | moderate |
| footers | 1, 2, 4 | Footer slide-number text format lost: "Page 1 of 4", "Page 2 of 4", "4 / 4" become bare "1", "2", "4" (live field kept, format text dropped). Slide 3 correctly hides footer. | moderate |
| compliance-readiness-review | 7 | Area chart: legend order reversed (Baseline, Current vs Current, Baseline), plot fills the full card so "35" label sits outside the left edge and Q labels touch the card bottom; quote text on right touches/slightly passes the card edge (font width). Data shapes OK. | moderate |

## Minor
| file | slide | what differs | size |
|---|---|---|---|
| chart-type-sampler | 3 | Combo OK (columns + margin line, legend, both axes). Axis ranges differ: $0-28 / 0-37% vs $0-30 / 0-40%; chart title centered not left. | minor |
| chart-point-overlays | 1-3 | All three rings in place: bar end of United States (over "109.4" label as in preview), scatter point (5, 8), pie slice outer arc (lower left of South slice). Japan label 15.16 shows as 15.2. | minor |
| singleton-combo-reference-lines | 1 | Both reference lines (dotted "Revenue 180", dashed "Margin 25%") and labels drawn; bar, point, both axes OK. Secondary axis shows 0% not 0% to 30% differences only in gridlines. | minor |
| duration-timeline | 1 | OK. Done/Current/Planned markers, line fill, labels all present; Discover/Launch not bold, Build bold (as preview). Text lines a few px higher. | minor |
| image-callouts | 1 | Three callouts and ring/arch pointer present; picture colors visibly muted (red/green/yellow washed out). | minor |
| localized-timeline | 1 | OK (French accents intact). | OK |
| multilingual-slides | 1-4 | OK. Arabic RTL right-aligned with bullets on right; Japanese quote brackets and wrap match; French "150 000" with space kept. | OK |
| footers~static | 1-4 | OK: static "Page 1 of 4", "4 / 4" text kept. Background blue lighter/desaturated in Keynote (all footers slides). | minor |
| header-footer-logo-set | 1, 2 | OK: header, date, footer logo, org name, center text, number and watermark present; slide 2 suppresses furniture correctly. Background desaturated. | minor |
| table-and-code | 1 | OK. Table values and header intact. | OK |
| table-and-code | 2 | Code block shown in proportional font (no Roboto Mono); syntax colors kept; fits. | minor |
| columns | 1, 2 | OK. Same wraps. | OK |
| full-feature-tour | 1, 5-10 | OK. Slide 2: "linked" run is dull green-gray (hyperlink color) on blue, lower contrast than preview white underline. Slide 7 code in proportional font. Slide 9 picture OK. Slide 10 watermark kept. | minor |
| data-story-academy | 1, 16 | "Book a call" ring starts at the "a" (text wider), slightly off; accent orange darker overall. | minor |
| data-story-academy | 2, 5-15 | OK. Slide numbers "n / 16" become "n" (footers) except slides 1 and 16 where static "01 / 16" kept; orange/yellow cards a bit darker; connectors, icons, flourish curves present. | minor |
| compliance-readiness-review | 1-6, 8, 9 | OK. Slide 3 stacked columns data and legend OK; slide 4/6 tables OK; slide 8 image OK. | OK |

## Manifest features
- chart-type-sampler (visual/nativeChart): differs (slide 1 box plot, slide 2 waterfall/funnel/treemap rendered as columns; histogram, scatter, combo pass)
- chart-point-overlays: pass (rings on bar end, scatter point, pie arc)
- singleton-combo-reference-lines: pass (both lines and labels)
- duration-timeline: pass
- image-callouts: pass (callouts and pointer present; image colors muted)
- localized-timeline: pass
- multilingual-slides: pass
- footers: differs (page-number format text lost on 1, 2, 4); live renumbering not graded here
- footers~static: pass
- header-footer-logo-set: pass
- table-and-code: pass (code font fallback)
- columns: pass
- full-feature-tour: pass with notes (chart/footer collisions on 3, 4)
- data-story-academy: differs (per-point accent colors lost on 3, 4)
- compliance-readiness-review: pass with notes (area chart slide 7)
- noShrink, smartArt edits, connectors glue, roundtrip, probe-based nativeChart/nativeTable: not graded here (no _probe.txt present for these decks)
