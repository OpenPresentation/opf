# Example decks in Keynote 16.0 (OPF 0.36.0), part 1 of 3

Saved by the supervisor from the grader's hand-back (2026-11-27). 51 decks (advising-retention-review to executive-workshop-facilitation): 315 default slides, 40 native files, 1 static file (data-story-academy); 602 rows in `part-1.grades.json`. Every grid page read; full-size pictures read for the new findings only, the rest graded from the sheet. Native: 69 slides whose picture differs from default were looked at on montages; the rest are "as default". "Same" = no flagged problem and compare score under 0.03 (partly score-based: treat the same/small split as soft).

| Mode | same | small | wrong |
|---|---|---|---|
| default (3 hidden slides not graded) | 62 | 201 | 52 |
| native | 48 | 172 | 48 |
| static (16 slides) | 3 | 11 | 2 |

Static: slide numbers read "N / 16" like the preview; default shows "N" only.

## Recorded findings that recur

| Id | Slides | Decks |
|---|---|---|
| Font substituted | about 360 rows | almost all |
| QC-03 footer behind full-bleed picture | 8 | airline-disruption-recovery-review, athletics-budget-review, battery-line-supplier-readiness, boutique-hotel-revenue-recovery, compliance-readiness-review, data-storytelling-atlas, demand-generation-campaign-brief, engineering-capacity-planning (slide 8 each) |
| QC-04 slide number skips a hidden slide | 3 | airline-disruption-recovery-review 10, compliance-readiness-review 10, data-platform-migration-plan 10 |
| SW-01 header breaks mid-word | 3 | boutique-hotel-revenue-recovery, data-storytelling-atlas, demand-generation-campaign-brief (slide 6 each) |
| QC-10 legend order reversed | 5+ | radar: construction-safety-stand-down 3, boutique-hotel-revenue-recovery 7, data-storytelling-atlas 3; area: compliance-readiness-review 7, executive-workshop-facilitation 3 (also battery-line 3, digital-services 3) |
| QC-08 axis scale | about 6 | chart-type-sampler 1, 3; athletics-budget-review 7; broadband-public-hearing-deck 7; employee-town-hall-run-of-show 3; executive-workshop-facilitation 3 |
| QC-05 stacked-area labels dropped | 1 | court-backlog-reduction-plan 3 |
| MX-05 pie label separator | 1 | chart-highlight 3 |
| LY-02 per-line boxes collide | 2 | district-literacy-acceleration-plan 2, dynamic-composition 4 |
| Known rows | | radar filled (battery-line 3, digital-services 3); direct line labels dropped (7 slides); stacked line unstacked (district-literacy 3); per-point bar colors not drawn (chart-colors 3, data-story-academy 3, 4); chart title centered (about 11) |

Also: branch-modernization-investment-case 1: the second title line touches the subtitle (font substitution, wrong).

## New findings

- **EX1-02 (wrong): a two-series doughnut is drawn as one ring, and the deck does not import back.** alumni-giving-campaign 3, boutique-hotel-revenue-recovery 3, defect-escape-reduction-review 3, demand-generation-campaign-brief 7, drive-thru-throughput-playbook 3 (default and native). All 10 files fail the round trip and are the only failures among the 92 files. Read in `back.pptx` (defect-escape-reduction-review native): Keynote keeps both series but writes the second series' name cache as `ptCount 1` with `pt idx="1"`: `invalid-chart-cache` (RT-01 text, a new trigger). Sheet `EX1-02-doughnut-two-series-one-ring.jpg`.
- **EX1-01 (wrong or small): Keynote ignores the transparency of a slide background.** design-backgrounds 4 (picture at 20% in the preview, full strength in Keynote, score 0.88) and 5 (pattern hatched at full strength). Read in the file: `p:bg` blipFill with `alphaModFix 20000`; pattFill colors with `alpha 18000`. Picture backgrounds (mostly wrong): advising-retention-review 1-6, alumni-giving-campaign 1, 2, 4, 5, 6, arabic-digital-services-brief 1-6, consulting-margin-recovery-plan 1-6. Hatch backgrounds (small): broadband-public-hearing-deck 1-10, data-platform-migration-plan 1-10, drive-thru-throughput-playbook 1-6. Sheet `EX1-01-background-alpha-ignored.jpg`.
- **EX1-03 (wrong): picture bullets come out as a wide logo.** Deck sets `listBullet: image`; the file writes `buBlip` with a 320x96 PNG (read in broadband-public-hearing-deck slide 10). broadband-public-hearing-deck 10, construction-safety-stand-down 10, court-backlog-reduction-plan 6, curriculum-approval-brief 10, data-incident-postmortem 6, data-platform-migration-plan 10, developer-conference-talk 6, drive-thru-throughput-playbook 6, enterprise-account-expansion-plan 6. Sheet `EX1-03-picture-bullets-too-large.jpg`.
- **EX1-06 (wrong, native): bullets turn bold and run into the next column.** columns 2, native only; the runs carry no `b` attribute; Keynote draws bold, the preview regular (the layout's bold is inferred). Sheet `EX1-06-native-bullets-bold.jpg`.
- **EX1-05 (small): an area chart with `crossBetween between` is drawn edge to edge.** executive-workshop-facilitation 3, compliance-readiness-review 7. Sheet `EX1-05-area-chart-edge-to-edge.jpg`.
- **EX1-04 (small): step names are bold in the preview, regular in the file.** duration-timeline 1: "Discover" and "Launch" bold in the preview; the file has `b=1` only on "Build"; Keynote matches the file. Inferred: a semibold weight the file does not carry. Sheet `EX1-04-timeline-labels-bold.jpg`.
- **EX1-07 (small, native): lead-in words lose their accent color.** dynamic-composition 3 native: "First:", "Then:", "Finally:" are accent blue in the preview; the native file writes `tx1` on those runs (read); Keynote draws white. Sheet `EX1-07-native-leadin-color-lost.jpg`.

## Round trip

92 rows, slide counts match; only the 10 doughnut files fail.

## Not looked at

`objects.json`, the user-interface list; full-size pictures for every small slide; native slides under the pixel threshold; 0.35.1 and main.
