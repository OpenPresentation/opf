# Keynote 15.1.1 digit grading (OPF v0.34.0 RC digits decks)

Key: P = preview, K = Keynote.

## ar-SA (P: Arabic-Indic; list/footer Latin)
| Element | Keynote draws | vs preview |
|---|---|---|
| Metric 999 | Arabic-Indic ٩٩٩ | match |
| Chart data labels | Latin 120 450 1,250 3,400 | DIFFER (P Arabic-Indic ١٢٠ ... ١,٢٥٠, ٬/٫ style comma) |
| Value axis | Latin 0..4,000 (axis on left, LTR) | DIFFER (P Arabic-Indic, axis on right) |
| Pie percent | Latin 50% 30% 20% | DIFFER (P ٥٠% etc.) |
| Table | BROKEN: only first column visible, squeezed to ~70px at right edge, clipped header "البنـ", cells أ / ب; amount and ratio columns missing | DIFFER (P full 3-col table, Arabic-Indic, 98,765 etc.) |
| List markers | Latin 1.-4. (right side) | match |
| Footer number | Latin, centered | number only |
| Footer count | MISSING (" / 5" not drawn, only "1") | DIFFER (P "5 / 1") |

## ar-SA-u-nu-latn (P: all Latin)
| Element | Keynote | vs P |
|---|---|---|
| Metric | Latin 999 | match |
| Data labels | Latin | match |
| Value axis | Latin 0..4,000 (left side) | match digits; axis side differs |
| Pie | 50 30 20 with NO % sign (format code is General) | DIFFER (P 50% 30% 20%) |
| Table | same collapse as ar-SA (one narrow column "البنـ", أ, ب; Latin numbers not shown) | DIFFER |
| List | Latin | match |
| Footer num / count | Latin number only; count missing | DIFFER |

## fa-IR (P: Persian ۰-۹, ٬ ٫, ٪)
| Element | Keynote | vs P |
|---|---|---|
| Metric | Persian ۹۹۹ | match |
| Data labels | Latin 120 450 1,250 3,400 | DIFFER |
| Value axis | Latin 0..4,000, left | DIFFER |
| Pie | Latin 50% 30% 20% (Latin %, not ٪) | DIFFER |
| Table | same collapse: one narrow column "مورد", الف, ب only | DIFFER |
| List | Latin | match |
| Footer num / count | Latin number only; count missing | DIFFER |

## hi-IN-u-nu-deva (P: Devanagari, lakh grouping)
| Element | Keynote | vs P |
|---|---|---|
| Metric | Devanagari ९९९ | match |
| Data labels | Latin 120 450 1,250 3,400 | DIFFER |
| Value axis | Latin 0..4,000 | DIFFER |
| Pie | Latin 50% 30% 20% | DIFFER |
| Table | Devanagari १,२३४.५० २,५००.७५ ९८,७६५ १२,३४,५६७ (lakh grouping kept; text is literal) | match (header fill slightly lighter) |
| List | Latin | match |
| Footer num / count | Latin number only; " / 5" missing | DIFFER |

## bn-BD (P: Bengali, lakh grouping)
| Element | Keynote | vs P |
|---|---|---|
| Metric | Bengali ৯৯৯ | match |
| Data labels | Latin | DIFFER |
| Value axis | Latin 0..4,000 | DIFFER |
| Pie | Latin 50% 30% 20% | DIFFER |
| Table | Bengali ১,২৩৪.৫০ ২,৫০০.৭৫ ৯৮,৭৬৫ ১২,৩৪,৫৬৭ | match |
| List | Latin | match |
| Footer num / count | Latin number only; count missing | DIFFER |

## Other
- Keynote ignores `[$-N000000]` prefixes in charts: all chart numbers (labels, axis, pie) are Latin in all five decks.
- Keynote footer shows only the slide-number field, " / 5" literal run dropped everywhere (also in ar-SA-u-nu-latn).
- ar-SA, ar-SA-u-nu-latn, fa-IR slide 4: tblPr rtl="1" table (gridCols 2384693/4089104/4620923 EMU, frame 11094720 wide) collapses in Keynote to one narrow clipped column at the right edge. hi/bn (LTR) tables are fine.
- RTL charts: Keynote puts value axis and title on the LTR side (axis left, title centered); preview mirrors (axis right). Category order matches.
- Latin deck pie: format General gives "50" with no percent sign in Keynote.

## Summary
1. Keynote honors native digits only where the text is literal (metric, hi/bn table, ar/fa metric); chart values, axis and pie percents are always Latin (the [$-N000000] hint is ignored).
2. Footer loses " / 5" in every deck; list markers Latin match.
3. Biggest defect: RTL (ar-SA, nu-latn, fa-IR) table collapses to one clipped column in Keynote.
