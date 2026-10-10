# FF-46 / opf#361: size-adjust and line-ascent rows, measured and checked natively (2026-10-10)

[opf#361](https://github.com/OpenPresentation/opf/issues/361) asks for `sizeAdjust` rows for the families whose open replacement
is far wider or narrower than the real font. This folder holds the measurements, the rule the release supervisor set, two native
PowerPoint runs, and the `font-policy.json` rows that follow from them.

Rows changed:

| Family | Replacement | `sizeAdjust` | `lineAscent` / `lineAscentMixed` |
| --- | --- | ---: | --- |
| Angsana New | Noto Sans Thai | **0.75** | **0.83 / 0.86** |
| DilleniaUPC | Noto Sans Thai | **0.68** | **0.82 / 0.85** |
| Sakkal Majalla | Noto Naskh Arabic | **0.89** | **0.76 / 0.81** |
| Malgun Gothic | Noto Sans KR | **1.07** | none |
| Nirmala UI | Noto Sans Devanagari | **1.07** | **0.97 / 0.94** |
| Arabic Typesetting | Noto Naskh Arabic | 0.64 (unchanged) | **0.74 / 0.80**, corrected from 0.70 / 0.78 |

These families stay without a factor:
- **Traditional Arabic:** its rule factor is 1.02, inside the 1 ± 0.03 band. Its letters, digits and Latin need factors from 0.71 to
  1.02, so no single one fits (opf#523).
- **Ebrima:** its rule factor is 0.99, inside the band.
- **MS Gothic:** dropped. Its 1.19 sample fails the rule at 1.04, and its fixed-pitch Latin would need 1.33.

Every value here is measured on this host; none is estimated. The real fonts were read in place from `C:\Windows\Fonts` and never
copied. Only the root session ran PowerPoint; an agent built the decks and scripts.

## 1. The rule and the measurements ([measurements.md](measurements.md), [measurements.json](measurements.json), [rule.json](rule.json))

**The rule (release supervisor, 2026-10-10).** A family's factor is the smallest single factor, in steps of 0.01 rounded up, at
which no line of the line model overhangs by more than 3 % natively.
- **The lines:** the FF-44 corpus samples of the family's script that the real font covers (letters, digits, punctuation and mixed
  text), plus the Latin of a scheme set to the family (the corpus Latin group and the 300 FF-31 strings), in regular and bold.
- **Ship or not:** a family whose factor lies within 1 ± 0.03 ships no `sizeAdjust`.

**The line model.** The published opf-render 0.18.0 planner lays out every line for a deck whose font scheme is the family.
- The factor scales every run drawn in the replacement, Latin runs included. I checked this against Arabic Typesetting's 0.64.
- The native width is the real font's fontkit advance width.
- The basis matches RR-38 and reproduces the 2026-10-05 corpus factors to four decimals.

| Family | Advance ratio, regular / bold | Rule factor (exact) | Worst line at the shipped factor | Latin of the scheme at the factor |
| --- | --- | ---: | --- | --- |
| Angsana New 5.06 | 0.703 / 0.668 | 0.75 (0.7401) | +1.6 % (`thai-digits`, regular) | 23.8 % slack (native / preview 0.72 to 0.84) |
| DilleniaUPC 5.05 | 0.640 / 0.622 | 0.68 (0.6704) | +1.6 % (`thai-digits`, regular) | 14.0 % slack (0.79 to 0.96) |
| Sakkal Majalla 7.00 | 0.803 / 0.796 | 0.89 (0.8866) | +2.6 % (`arab-fa-digits`, regular) | 27.1 % slack (0.70 to 0.80) |
| Malgun Gothic 6.69 | 1.063 / 1.061 | 1.07 (precomposed Hangul 1.0557; with the jamo sample 1.0669) | +1.6 % (`kore-sentence`, regular; jamo excluded, see 4) | 8.0 % slack (0.87 to 0.96) |
| Nirmala UI 1.46 | 1.067 / 1.067 | 1.07 (1.0695) | +2.9 % (`deva-matras`, regular) | 12.1 % slack (0.85 to 0.96) |

The digit samples drive the factor for the Thai and Arabic families. The plain corpus factors (0.70, 0.64 and 0.80) would let those
lines overhang by 8 to 14 %.

## 2. Native re-run with the factors (attempt 2: [compare-attempt-2.md](compare-attempt-2.md), [compare-attempt-2.json](compare-attempt-2.json))

**Setup.**
- PowerPoint 365 16.0 build 20430 on Windows 11 (`Microsoft Windows NT 10.0.26200.0`). Every deck was opened read-only, one child
  process per deck with a 90 s deadline, and all 11 decks exited 0 ([runs.json](runs.json)).
- The seven FF-46 decks of these families were built with the published 0.18 packages: Angsana New, DilleniaUPC, Sakkal Majalla in
  Arabic, Urdu and Persian, Malgun Gothic and Nirmala UI.
- The rule factors (and the line ascents measured on 2026-10-05) were applied through a scratch copy of the font policy that was
  never committed, so the composition and the previews both carry the factors.
- The comparison uses the FF-46 criterion: names, one native line per box, no overflow that only PowerPoint shows (beyond 0.5 pt),
  and native / preview ink width on lines of at least 200 pt within 0.80 to 1.01.

| Family | Ink (native / preview, long lines) | Result |
| --- | ---: | --- |
| Angsana New | 0.949 | pass |
| DilleniaUPC | 0.947 | pass |
| Sakkal Majalla (ar, ur, fa) | 0.909, 0.902, 0.912 | pass |
| Malgun Gothic | 1.023 (1.021 without the jamo lines) | finding: one box overflows by 82 pt only in PowerPoint; it is the decomposed-jamo line (see 4) |
| Nirmala UI | 1.003 | strict-check edge, accepted (see 5) |

Before the factors, set 2 read 0.697, 0.639, 0.805, 1.049 and 1.027 for these families.

## 3. Line ascents (attempt 2 [probe](compare-attempt-2-probe-corrected.md), attempt 3 [mixed lines](compare-attempt-3.md))

**The probe uses the RR-38 setup.**
- Each row is a one-line text box: no wrap, zero insets, top anchor, 100 % line spacing, box height 1.22 × the size, black on white.
- Each deck has one slide per size (18, 24 and 32 pt), exported at 2880 px.
- Each family has a regular row, a bold row, and a mixed row (the script around an Aptos "PowerPoint 365" run).
- PowerPoint puts every line's top at its box top and makes every line 1.20 em high. Line boxes exported by opf-pptx are written the
  same way.

**How the baseline is read.** The baseline is the bottom edge of the last pixel row that holds at least 35 % of the darkest row's ink.
- For a headline script (Devanagari), the darkest row is the headline near the top. There the baseline is the most common bottom
  of the letter stems instead.
- A synthetic test with known baselines recovers them exactly.

| Family | Regular, 18 / 24 / 32 pt | Bold | With a Latin run | Rows |
| --- | --- | ---: | --- | --- |
| DilleniaUPC | 0.815 / 0.819 / 0.813 | 0.811 | 0.856 / 0.852 / 0.841 | 0.82 / 0.85 |
| Malgun Gothic | 1.056 / 1.056 / 1.042 | 1.058 | 1.004 / 0.991 / 0.998 | none: the baseline is below core's 1.0, and the renderer only moves runs up |
| Nirmala UI | 0.981 / 0.972 / 0.969 | 0.974 | 0.930 / 0.935 / 0.935 | 0.97 / 0.94 |
| Angsana New (attempt 3) | 0.833 / 0.833 / 0.833 | 0.836 | 0.856 / 0.866 / 0.862 | 0.83 / 0.86 |
| Sakkal Majalla (attempt 3) | 0.759 / 0.764 / 0.760 | 0.761 | 0.819 / 0.810 / 0.810 | 0.76 / 0.81 |
| Arabic Typesetting (attempt 3) | 0.741 / 0.736 / 0.740 | 0.738 | 0.801 / 0.810 / 0.800 | 0.74 / 0.80 |

**Controls.** Attempt 2's controls deck read Angsana New 0.833, Sakkal Majalla 0.761 and Arabic Typesetting 0.741. Attempt 3
reproduces all three within 0.005.
- **Angsana New and Sakkal Majalla.** The 2026-10-05 readings of 0.85 and 0.78 came from 1280 px PNGs of 18.75 pt lines, where one
  pixel is 0.04 em. Re-reading those PNGs with this rule gives 0.84 to 0.85 and 0.75 to 0.77. The probe is the finer measurement,
  and the rows use it.

## 4. Arabic Typesetting: the line-ascent correction ([rr38-rereading.json](rr38-rereading.json))

The shipped `lineAscent 0.70` and `lineAscentMixed 0.78` come from the RR-38 probe of 2026-10-02 (`probe-arabic.pptx`). It recorded
0.68 / 0.71 / 0.72 with an earlier estimator, the most common ink-bottom row.

I re-read RR-38's own native PNGs (2560 px) with the rule above:

| Reading | 18 pt | 24 pt | 32 pt |
| --- | ---: | ---: | ---: |
| Regular, this rule | 0.743 | 0.745 | 0.746 |
| Regular, RR-38's own script (top edge of the row) | 0.722 | 0.729 | 0.734 |
| Mixed, this rule | 0.794 | 0.797 | 0.796 |

The new probe agrees with the first and third rows: 0.741 / 0.736 / 0.740 regular, 0.801 / 0.810 / 0.800 mixed. The rows become
0.74 and 0.80.

**This moves the preview baseline of every Arabic Typesetting deck, including the default `arabic` language**, down by 0.04 em on
lines in Arabic Typesetting alone and by 0.02 em on mixed lines: about 0.7 pt and 0.4 pt at 18 pt. The changelog fragment says so.

## 5. Recorded limitations and edges

- **Decomposed conjoining Hangul jamo (Malgun Gothic and every Korean family).**
  - The FF-44 sample `kore-jamo` writes 한글 once as six conjoining jamo (U+1112 1161 11AB 1100 1173 11AF). PowerPoint draws these
    unshaped, up to 1.9 times wider than shaped text, and no row factor can fix that.
  - Release supervisor decision (2026-10-10): lines containing U+1100 to U+11FF, U+A960 to U+A97F or U+D7B0 to U+D7FF are a
    documented limitation and do not count toward the row decision. Precomposed Hangul, which real text uses, sets the factor.
  - In the re-run, every jamo line had ink of 1.08 to 1.81. Lines without jamo had 0.98 to 1.04, with a long-line median of 1.021,
    and none overflowed only in PowerPoint.
- **Nirmala UI, 4.16 pt.** The preview composed paragraph line 0 (all Devanagari, drawn by PowerPoint in Nirmala UI) to 864.75 pt of
  an 873.6 pt box, 99 % full. Its ink ratio is 1.0078, inside the tolerance, so PowerPoint draws it 4.16 pt past the box. This is an
  edge of the strict 0.5 pt overflow check on an almost full line, not a factor error, and the release supervisor accepted it.
  Nirmala UI's other Indic scripts draw in their own Noto faces, which this row does not reach.

## Files

| File | What |
| --- | --- |
| [measurements.md](measurements.md), [measurements.json](measurements.json) | Factors, per-sample spread, the Latin effect, every scenario's per-line ratios, and the rule section. |
| [rule.json](rule.json) | The rule computation per family: lines counted, exact and rounded factor, worst line, top needs, lines out of the row's reach. |
| [compare-attempt-2.md](compare-attempt-2.md), [compare-attempt-2.json](compare-attempt-2.json) | The factor-applied FF-46 re-run, and the probe as first read. |
| [compare-attempt-2-probe-corrected.md](compare-attempt-2-probe-corrected.md), [compare-attempt-2-probe-corrected.json](compare-attempt-2-probe-corrected.json) | The probe with the corrected rule. |
| [compare-attempt-3.md](compare-attempt-3.md), [compare-attempt-3.json](compare-attempt-3.json) | The mixed-line probe for Angsana New, Sakkal Majalla and Arabic Typesetting. |
| [rr38-rereading.json](rr38-rereading.json) | RR-38's own PNGs re-read. |
| [runs.json](runs.json) | Attempts 2 and 3: host, PowerPoint version, one record per deck with its real exit code (the harness fix of opf#583). |

The decks, previews, native PNGs, raw read-outs and the scratch policy copy are not committed. Paths are written as `<set>`.
