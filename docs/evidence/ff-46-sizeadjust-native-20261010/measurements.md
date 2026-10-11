# opf#361: size-adjust measurements for the eight FF-46 families (2026-10-10)

Measured on the Windows host with the **published** packages (`@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `fontkit` 2.0.4; Node v24.21.0). The real fonts were read in place from `%SystemRoot%\Fonts`; nothing was copied. No PowerPoint or Office was opened. Nothing in core or `font-policy.json` was changed.

**Basis (RR-38):** the sum of the real font's shaped advances over the sum of the replacement's (fontkit 2.0.4, each sample's OpenType language, regular), on the FF-44 corpus samples of the family's script that the real font covers. The replacement faces are the files the published renderer loads. This reproduces the 2026-10-05 numbers in the opf#361 comments to four decimals.

**Line model (new):** every corpus line and the 300 FF-31 Latin strings were planned by opf-render 0.18.0's own script planner for a deck whose font scheme is the family (major = minor = family, as the gallery font-scheme records write it). Policy `sizeAdjust` scales every run drawn in the replacement, **Latin included** (checked on Arabic Typesetting's published 0.64: a Latin line in that scheme measures exactly 0.640 of Noto Naskh Arabic, and a mixed Arabic and Latin line is one Noto Naskh run at 0.64). The ratio below is native / preview of the same line; above 1 means PowerPoint draws it longer than the box the preview composed (overhang).

## Summary

| Family | Replacement | Factor regular / bold (samples) | Per-sample min / median / max | Latin: real / replacement | Latin native / preview at the factor | No-overhang factor | Native set 2 (at 1) | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Angsana New 5.06 | Noto Sans Thai | 0.703 / 0.668 (7) | 0.632 / 0.708 / 0.762 | 0.571 (per string 0.54 to 0.63) | -18.4 % at 0.70 | 0.762 | 0.697 | single **0.70** |
| DilleniaUPC 5.05 | Noto Sans Thai | 0.640 / 0.622 (7) | 0.608 / 0.637 / 0.691 | 0.600 (per string 0.56 to 0.65) | -6.2 % at 0.64 | 0.691 | 0.639 | single **0.64** |
| Sakkal Majalla 7.00 | Noto Naskh Arabic | 0.803 / 0.796 (12) | 0.734 / 0.798 / 0.913 | 0.645 (per string 0.62 to 0.67) | -19.3 % at 0.80 | 0.913 | 0.805 | single **0.80** |
| Traditional Arabic 6.85 | Noto Naskh Arabic | 0.789 / 0.800 (9) | 0.709 / 0.741 / 1.015 | 0.843 (per string 0.81 to 0.95) | +6.7 % at 0.79 | 1.015 | 0.815 | **no sizeAdjust** |
| Malgun Gothic 6.69 | Noto Sans KR | 1.063 / 1.061 (4) | 1.031 / 1.062 / 1.099 | 0.987 (per string 0.93 to 1.02) | -6.9 % at 1.06 | 1.099 | 1.049 | single **1.06** |
| Nirmala UI 1.46 | Noto Sans Devanagari | 1.067 / 1.067 (9) | 1.021 / 1.062 / 1.102 | 0.937 (per string 0.91 to 0.96) | -12.4 % at 1.07 | 1.102 | 1.027 | single **1.07** |
| Ebrima 5.19 | Noto Sans | 0.943 / 0.949 (11) | 0.933 / 0.943 / 0.957 | 0.939 (per string 0.91 to 0.96) | -0.1 % at 0.94 | 0.970 | 1.074 | single **0.94** |
| MS Gothic 5.32 | Noto Sans JP | 1.035 / - (no bold) (7) | 0.995 / 1.012 / 1.194 | 1.048 (per string 0.89 to 1.18) | +0.8 % at 1.04 | 1.366 | 1.024 | single **1.04** (fixed-pitch Latin caveat) |

Latin native / preview: positive means Latin lines of that scheme overhang natively by that much on the median string; negative means slack (the preview composes them wider than PowerPoint draws them).

## Lines per scenario (native / preview: min / median / max; worst overhang)

| Family | Line set | Lines | Factor 1 (today) | Single factor | Per-script factor (Latin at 1) | Per-script, letters only (digits and Latin at 1) |
| --- | --- | ---: | --- | --- | --- | --- |
| Angsana New | corpus-Thai | 7 | 0.632 / 0.708 / 0.762; no overhang | 0.903 / 1.012 / 1.089; **4 over 1 %, worst +8.9 % (74.9 pt on 842 pt, thai-digits)** | 0.734 / 1.005 / 1.038; **3 over 1 %, worst +3.8 % (31.8 pt on 842 pt, thai-pali)** | 0.734 / 1.005 / 1.038; **3 over 1 %, worst +3.8 % (31.8 pt on 842 pt, thai-pali)** |
| Angsana New | corpus-Latn | 3 | 0.563 / 0.592 / 0.604; no overhang | 0.804 / 0.817 / 0.864; no overhang | 0.563 / 0.592 / 0.604; no overhang | 0.563 / 0.592 / 0.604; no overhang |
| Angsana New | latin-ff31 | 300 | 0.541 / 0.573 / 0.630; no overhang | 0.773 / 0.818 / 0.900; no overhang | 0.541 / 0.573 / 0.630; no overhang | 0.541 / 0.573 / 0.630; no overhang |
| DilleniaUPC | corpus-Thai | 7 | 0.608 / 0.637 / 0.691; no overhang | 0.950 / 0.995 / 1.079; **3 over 1 %, worst +7.9 % (66.5 pt on 842 pt, thai-digits)** | 0.729 / 0.984 / 1.038; **2 over 1 %, worst +3.8 % (32.4 pt on 842 pt, thai-tone-marks)** | 0.729 / 0.984 / 1.038; **2 over 1 %, worst +3.8 % (32.4 pt on 842 pt, thai-tone-marks)** |
| DilleniaUPC | corpus-Latn | 3 | 0.584 / 0.599 / 0.603; no overhang | 0.872 / 0.936 / 0.942; no overhang | 0.584 / 0.599 / 0.603; no overhang | 0.584 / 0.599 / 0.603; no overhang |
| DilleniaUPC | latin-ff31 | 300 | 0.560 / 0.600 / 0.651; no overhang | 0.875 / 0.937 / 1.017; **1 over 1 %, worst +1.7 % (14 pt on 842 pt, ff31-245)** | 0.560 / 0.600 / 0.651; no overhang | 0.560 / 0.600 / 0.651; no overhang |
| Sakkal Majalla | corpus-Arab | 12 | 0.734 / 0.798 / 0.913; no overhang | 0.917 / 0.997 / 1.141; **4 over 1 %, worst +14.1 % (119.1 pt on 842 pt, arab-fa-digits)** | 0.871 / 0.997 / 1.141; **3 over 1 %, worst +14.1 % (119.1 pt on 842 pt, arab-fa-digits)** | 0.871 / 0.979 / 1.014; **1 over 1 %, worst +1.4 % (11.7 pt on 842 pt, arab-joining)** |
| Sakkal Majalla | corpus-Latn | 7 | 0.633 / 0.648 / 0.719; no overhang | 0.791 / 0.806 / 0.880; no overhang | 0.633 / 0.648 / 0.719; no overhang | 0.633 / 0.648 / 0.719; no overhang |
| Sakkal Majalla | latin-ff31 | 300 | 0.620 / 0.645 / 0.667; no overhang | 0.774 / 0.807 / 0.833; no overhang | 0.620 / 0.645 / 0.667; no overhang | 0.620 / 0.645 / 0.667; no overhang |
| Traditional Arabic | corpus-Arab | 9 | 0.709 / 0.741 / 1.015; **1 over 1 %, worst +1.5 % (12.9 pt on 842 pt, arab-fa-digits)** | 0.897 / 0.938 / 1.285; **3 over 1 %, worst +28.5 % (240.1 pt on 842 pt, arab-fa-digits)** | 0.897 / 0.938 / 1.285; **2 over 1 %, worst +28.5 % (240.1 pt on 842 pt, arab-fa-digits)** | 0.897 / 0.938 / 1.036; **1 over 1 %, worst +3.6 % (30.4 pt on 842 pt, arab-fa-digits)** |
| Traditional Arabic | corpus-Latn | 3 | 0.817 / 0.830 / 0.921; no overhang | 1.035 / 1.051 / 1.140; **3 over 1 %, worst +14 % (117.7 pt on 842 pt, latn-numerals)** | 0.817 / 0.830 / 0.921; no overhang | 0.817 / 0.830 / 0.921; no overhang |
| Traditional Arabic | latin-ff31 | 300 | 0.805 / 0.843 / 0.954; no overhang | 1.020 / 1.067 / 1.207; **300 over 1 %, worst +20.7 % (174.5 pt on 842 pt, ff31-245)** | 0.805 / 0.843 / 0.954; no overhang | 0.805 / 0.843 / 0.954; no overhang |
| Malgun Gothic | corpus-Kore | 4 | 1.031 / 1.062 / 1.099; **4 over 1 %, worst +9.9 % (83.3 pt on 842 pt, kore-jamo)** | 0.972 / 1.002 / 1.037; **2 over 1 %, worst +3.7 % (30.9 pt on 842 pt, kore-jamo)** | 1.012 / 1.022 / 1.037; **4 over 1 %, worst +3.7 % (30.9 pt on 842 pt, kore-jamo)** | 1.012 / 1.022 / 1.037; **4 over 1 %, worst +3.7 % (30.9 pt on 842 pt, kore-jamo)** |
| Malgun Gothic | corpus-Latn | 3 | 0.988 / 1.014 / 1.027; **2 over 1 %, worst +2.7 % (22.8 pt on 842 pt, latn-numerals)** | 0.932 / 0.957 / 0.969; no overhang | 0.988 / 1.014 / 1.027; **2 over 1 %, worst +2.7 % (22.8 pt on 842 pt, latn-numerals)** | 0.988 / 1.014 / 1.027; **2 over 1 %, worst +2.7 % (22.8 pt on 842 pt, latn-numerals)** |
| Malgun Gothic | latin-ff31 | 300 | 0.927 / 0.985 / 1.017; **3 over 1 %, worst +1.7 % (14.5 pt on 842 pt, ff31-12)** | 0.874 / 0.929 / 0.960; no overhang | 0.927 / 0.985 / 1.017; **3 over 1 %, worst +1.7 % (14.5 pt on 842 pt, ff31-12)** | 0.927 / 0.985 / 1.017; **3 over 1 %, worst +1.7 % (14.5 pt on 842 pt, ff31-12)** |
| Nirmala UI | corpus-Deva | 9 | 1.021 / 1.062 / 1.102; **9 over 1 %, worst +10.2 % (85.5 pt on 842 pt, deva-matras)** | 0.954 / 0.992 / 1.030; **3 over 1 %, worst +3 % (24.8 pt on 842 pt, deva-matras)** | 0.985 / 0.993 / 1.030; **3 over 1 %, worst +3 % (24.8 pt on 842 pt, deva-matras)** | 0.985 / 1.008 / 1.030; **4 over 1 %, worst +3 % (24.8 pt on 842 pt, deva-matras)** |
| Nirmala UI | corpus-Beng | 6 | 1.064 / 1.076 / 1.096; **6 over 1 %, worst +9.6 % (80.9 pt on 842 pt, beng-conjuncts)** | 1.064 / 1.076 / 1.096; **6 over 1 %, worst +9.6 % (80.9 pt on 842 pt, beng-conjuncts)** | 1.064 / 1.076 / 1.096; **6 over 1 %, worst +9.6 % (80.9 pt on 842 pt, beng-conjuncts)** | 1.064 / 1.076 / 1.096; **6 over 1 %, worst +9.6 % (80.9 pt on 842 pt, beng-conjuncts)** |
| Nirmala UI | corpus-Guru | 3 | 1.065 / 1.068 / 1.097; **3 over 1 %, worst +9.7 % (82 pt on 842 pt, guru-marks)** | 1.065 / 1.068 / 1.097; **3 over 1 %, worst +9.7 % (82 pt on 842 pt, guru-marks)** | 1.065 / 1.068 / 1.097; **3 over 1 %, worst +9.7 % (82 pt on 842 pt, guru-marks)** | 1.065 / 1.068 / 1.097; **3 over 1 %, worst +9.7 % (82 pt on 842 pt, guru-marks)** |
| Nirmala UI | corpus-Gujr | 3 | 1.120 / 1.127 / 1.128; **3 over 1 %, worst +12.8 % (108 pt on 842 pt, gujr-marks)** | 1.120 / 1.127 / 1.128; **3 over 1 %, worst +12.8 % (108 pt on 842 pt, gujr-marks)** | 1.120 / 1.127 / 1.128; **3 over 1 %, worst +12.8 % (108 pt on 842 pt, gujr-marks)** | 1.120 / 1.127 / 1.128; **3 over 1 %, worst +12.8 % (108 pt on 842 pt, gujr-marks)** |
| Nirmala UI | corpus-Orya | 3 | 0.960 / 0.967 / 0.972; no overhang | 0.960 / 0.967 / 0.972; no overhang | 0.960 / 0.967 / 0.972; no overhang | 0.960 / 0.967 / 0.972; no overhang |
| Nirmala UI | corpus-Taml | 5 | 0.977 / 1.045 / 1.057; **4 over 1 %, worst +5.7 % (48.3 pt on 842 pt, taml-pulli)** | 0.977 / 1.045 / 1.057; **4 over 1 %, worst +5.7 % (48.3 pt on 842 pt, taml-pulli)** | 0.977 / 1.045 / 1.057; **4 over 1 %, worst +5.7 % (48.3 pt on 842 pt, taml-pulli)** | 0.977 / 1.045 / 1.057; **4 over 1 %, worst +5.7 % (48.3 pt on 842 pt, taml-pulli)** |
| Nirmala UI | corpus-Telu | 4 | 1.111 / 1.168 / 1.327; **4 over 1 %, worst +32.7 % (275.5 pt on 842 pt, telu-conjuncts)** | 1.111 / 1.168 / 1.327; **4 over 1 %, worst +32.7 % (275.5 pt on 842 pt, telu-conjuncts)** | 1.111 / 1.168 / 1.327; **4 over 1 %, worst +32.7 % (275.5 pt on 842 pt, telu-conjuncts)** | 1.111 / 1.168 / 1.327; **4 over 1 %, worst +32.7 % (275.5 pt on 842 pt, telu-conjuncts)** |
| Nirmala UI | corpus-Knda | 3 | 1.148 / 1.151 / 1.188; **3 over 1 %, worst +18.8 % (158.5 pt on 842 pt, knda-title)** | 1.148 / 1.151 / 1.188; **3 over 1 %, worst +18.8 % (158.5 pt on 842 pt, knda-title)** | 1.148 / 1.151 / 1.188; **3 over 1 %, worst +18.8 % (158.5 pt on 842 pt, knda-title)** | 1.148 / 1.151 / 1.188; **3 over 1 %, worst +18.8 % (158.5 pt on 842 pt, knda-title)** |
| Nirmala UI | corpus-Mlym | 4 | 1.063 / 1.094 / 1.129; **4 over 1 %, worst +12.9 % (108.4 pt on 842 pt, mlym-title)** | 1.063 / 1.094 / 1.129; **4 over 1 %, worst +12.9 % (108.4 pt on 842 pt, mlym-title)** | 1.063 / 1.094 / 1.129; **4 over 1 %, worst +12.9 % (108.4 pt on 842 pt, mlym-title)** | 1.063 / 1.094 / 1.129; **4 over 1 %, worst +12.9 % (108.4 pt on 842 pt, mlym-title)** |
| Nirmala UI | corpus-Sinh | 3 | 0.905 / 0.943 / 0.994; no overhang | 0.905 / 0.943 / 0.994; no overhang | 0.905 / 0.943 / 0.994; no overhang | 0.905 / 0.943 / 0.994; no overhang |
| Nirmala UI | corpus-Latn | 3 | 0.939 / 0.940 / 0.994; no overhang | 0.878 / 0.879 / 0.934; no overhang | 0.939 / 0.940 / 0.994; no overhang | 0.939 / 0.940 / 0.994; no overhang |
| Nirmala UI | latin-ff31 | 300 | 0.914 / 0.937 / 0.957; no overhang | 0.854 / 0.875 / 0.894; no overhang | 0.914 / 0.937 / 0.957; no overhang | 0.914 / 0.937 / 0.957; no overhang |
| Ebrima | corpus-Latn | 12 | 0.933 / 0.944 / 0.970; no overhang | 0.992 / 1.004 / 1.032; **3 over 1 %, worst +3.2 % (26.7 pt on 842 pt, latn-numerals)** | 0.970 / 1.003 / 1.018; **2 over 1 %, worst +1.8 % (14.9 pt on 842 pt, latn-mi)** | 0.970 / 1.003 / 1.018; **2 over 1 %, worst +1.8 % (14.9 pt on 842 pt, latn-mi)** |
| Ebrima | corpus-Ethi | 3 | 1.066 / 1.076 / 1.088; **3 over 1 %, worst +8.8 % (73.8 pt on 842 pt, ethi-words)** | 1.066 / 1.076 / 1.088; **3 over 1 %, worst +8.8 % (73.8 pt on 842 pt, ethi-words)** | 1.066 / 1.076 / 1.088; **3 over 1 %, worst +8.8 % (73.8 pt on 842 pt, ethi-words)** | 1.066 / 1.076 / 1.088; **3 over 1 %, worst +8.8 % (73.8 pt on 842 pt, ethi-words)** |
| Ebrima | latin-ff31 | 300 | 0.915 / 0.939 / 0.959; no overhang | 0.973 / 0.999 / 1.020; **8 over 1 %, worst +2 % (16.8 pt on 842 pt, ff31-245)** | 0.973 / 0.999 / 1.020; **5 over 1 %, worst +2 % (16.8 pt on 842 pt, ff31-245)** | 0.973 / 0.999 / 1.020; **5 over 1 %, worst +2 % (16.8 pt on 842 pt, ff31-245)** |
| MS Gothic | corpus-Jpan | 7 | 0.995 / 1.012 / 1.194; **5 over 1 %, worst +19.4 % (163.2 pt on 842 pt, jpan-combining-dakuten)** | 0.957 / 0.973 / 1.148; **3 over 1 %, worst +14.8 % (124.5 pt on 842 pt, jpan-combining-dakuten)** | 0.964 / 0.991 / 1.148; **3 over 1 %, worst +14.8 % (124.5 pt on 842 pt, jpan-combining-dakuten)** | 0.964 / 0.991 / 1.148; **3 over 1 %, worst +14.8 % (124.5 pt on 842 pt, jpan-combining-dakuten)** |
| MS Gothic | corpus-Latn | 7 | 0.986 / 1.064 / 1.367; **5 over 1 %, worst +36.7 % (308.6 pt on 842 pt, latn-ligatures)** | 0.948 / 1.048 / 1.314; **4 over 1 %, worst +31.4 % (264.3 pt on 842 pt, latn-ligatures)** | 0.986 / 1.064 / 1.367; **5 over 1 %, worst +36.7 % (308.6 pt on 842 pt, latn-ligatures)** | 0.986 / 1.064 / 1.367; **5 over 1 %, worst +36.7 % (308.6 pt on 842 pt, latn-ligatures)** |
| MS Gothic | latin-ff31 | 300 | 0.891 / 1.043 / 1.179; **223 over 1 %, worst +18 % (151.1 pt on 842 pt, ff31-216)** | 0.857 / 1.002 / 1.134; **139 over 1 %, worst +13.4 % (113 pt on 842 pt, ff31-216)** | 0.891 / 1.043 / 1.179; **223 over 1 %, worst +18 % (151.1 pt on 842 pt, ff31-216)** | 0.891 / 1.043 / 1.179; **223 over 1 %, worst +18 % (151.1 pt on 842 pt, ff31-216)** |

## Recommendations (agent judgement, vetoable)

- **Angsana New** (single 0.70): Thai lines at 0.70: native / preview 0.90 / 1.01 / 1.09 (the worst is the Thai-digit sample, +8.9 %; 0.76 would remove every overhang). The Latin of the scheme is narrower still (0.57 of Noto Sans Thai), so it keeps 10 to 23 % slack and never overhangs; leaving Latin at 1 (per-script) would make that 37 to 46 % slack, worse than the single factor.
- **DilleniaUPC** (single 0.64): Thai lines at 0.64: 0.95 / 0.99 / 1.08 (Thai digits +7.9 %). Latin 0.88 / 0.94 / 1.02 (one of 300 strings +1.7 %). Single factor is right; per-script would leave Latin 35 to 44 % slack.
- **Sakkal Majalla** (single 0.80): Arabic lines at 0.80: 0.92 / 1.00 / 1.14; the two digit samples (Arabic-Indic and Persian digits) overhang 13 to 14 %, the letter samples are within +4 %. Latin of the scheme (0.65) keeps 17 to 23 % slack. Native set 2: 0.805. A letters-only per-script factor would fix the digits (Arabic 0.87 / 0.98 / 1.01) but leave Latin 33 to 38 % slack, so single 0.80 now.
- **Traditional Arabic** (none): No single factor works. Arabic letters are 0.71 to 0.74 of Noto Naskh Arabic, but its digits are 0.90 to 1.02, Arabic with Latin 0.84 and the Latin of the scheme 0.84 (0.81 to 0.95). At 0.79 every one of the 300 Latin strings overhangs (median +6.7 %, worst +20.7 %, 175 pt on an 842 pt line) and the Persian-digit sample +28.5 %. The smallest single factor without overhang is 1.015, so keep 1 (the wide-erring proxy opf#523 documents). The right fix is a per-script, letters-only factor (0.79 on Arabic letters, digits and Latin at 1: Arabic lines 0.90 / 0.94 / 1.04, Latin 0.81 to 0.95 slack), which the policy format cannot express today.
- **Malgun Gothic** (single 1.06): Korean lines at 1.06: 0.97 / 1.00 / 1.04 (the jamo sample +3.7 %; decomposed jamo draw up to 1.9 times natively, which no factor fixes). Latin of the scheme (0.99) keeps 4 to 13 % slack, the safe direction. Native set 2: 1.049.
- **Nirmala UI** (single 1.07): Devanagari lines at 1.07: 0.95 / 0.99 / 1.03. Latin of the scheme (0.94 of Noto Sans Devanagari) gets 11 to 15 % slack (safe direction; per-script Deva-only would make it 4 to 9 %). Not reachable by this row: the other Indic scripts draw in their own Noto faces and already overhang at 1 (Telugu up to +33 %, Kannada +19 %, Gujarati and Malayalam +13 %, Bengali and Gurmukhi +10 %, Tamil +6 %); that needs factors on those routes, a separate item.
- **Ebrima** (single 0.94): The row replacement (Noto Sans) only draws Latin: 0.943 on the corpus Latin, 0.939 on the 300 FF-31 strings; at 0.94 Latin lines are 0.97 / 1.00 / 1.03. Ethiopic (Ebrima is 1.07 to 1.09 of Noto Sans Ethiopic on the corpus; native set 2: 1.074) falls back to Noto Sans Ethiopic, which this row cannot reach; that needs a route change or a factor on the Ethiopic route.
- **MS Gothic** (single-with-caveat 1.04): Japanese lines at 1.04: 0.96 / 0.97 / 1.15 (combining dakuten +14.8 %). MS Gothic is fixed-pitch, so its Latin cannot follow any proportional factor: at 1.04, 139 of 300 Latin strings overhang over 1 % (worst +13.4 %), against 223 (worst +18 %) today. 1.04 improves both; full fidelity for its Latin needs a fixed-pitch preview route.

## Traditional Arabic in detail (the supervisor's flag)

- Corpus factor 0.789 on 9 of 12 Arabic samples (the font lacks the letters of arab-ur-letters, arab-ps-letters, arab-pa-shahmukhi). Per sample (real / Noto Naskh Arabic): arab-joining 0.724, arab-lam-alef 0.741, arab-harakat 0.709, arab-digits 0.901, arab-bidi-latin 0.837, arab-punctuation 0.797, arab-fa-letters 0.714, arab-fa-digits 1.015, arab-ur-title 0.712.
- So the spread has a cause: Arabic letters are 0.71 to 0.74, the punctuation sample 0.80, Arabic with a Latin word 0.84, Arabic-Indic digits 0.90 and Persian digits 1.02. The corpus mean of 0.79 is a mix of these, not a property of running text. The opf#523 native lines (0.68 to 0.90) show the same range.
- Latin of the scheme: the replacement draws it (the gallery scheme sets major = minor = Traditional Arabic, and policy sizeAdjust reaches every run drawn in Noto Naskh Arabic). Real / replacement 0.843 (per string 0.805 to 0.954). At 0.79 all 300 strings overhang natively: median +6.7 %, worst +20.7 % (174.5 pt on an 842 pt line). This confirms the supervisor's flag; the "about 9 %" used the policy's mean of inverse ratios (0.864), the sum basis gives 0.843 and +6.7 % median.
- Arabic lines at a single 0.79: 0.897 / 0.938 / 1.285, 3 over 1 %, worst +28.5 % (arab-fa-digits). Letters-only per-script 0.79 (digits and Latin at 1): 0.897 / 0.938 / 1.036, Latin unchanged at 0.805 / 0.843 / 0.954 (slack only).
- The smallest single factor with no measured overhang is 1.015: effectively 1.
- Recommendation: **no sizeAdjust** for Traditional Arabic today. If the per-script mechanism below lands, use a letters-only Arabic factor of about 0.79 (or 0.74 if the native line set confirms the letter samples), and re-check natively before it ships.

## Policy format

- spec/reference/font-policy.schema.json: replacement.sizeAdjust is one number per row; opf-render sizeAdjustFor applies it to every run drawn in the row replacement, whatever its script. A per-script factor is not expressible today.
- A per-script factor would need: a schema field (for example `replacement.sizeAdjustScripts: ["Thai"]`, or `sizeAdjust` as `{ "Arab": 0.79 }`), and in opf-render `sizeAdjustFor(row, drawnFamily, script)` plus a split of the planned run at script boundaries (today a mixed Arabic and Latin line is one Noto Naskh run). It should scope the factor to the letters and marks of the script (digits and punctuation at 1): in this set that is what fixes Traditional Arabic, and it would also remove the digit overhang of Sakkal Majalla and the Thai families. Leaving Latin at 1 helps only Traditional Arabic and Nirmala UI; for the Thai families and Sakkal Majalla the Latin of the scheme is narrower still, so their Latin would want its own factor (Angsana New 0.57, DilleniaUPC 0.60, Sakkal Majalla 0.65), not 1.

## Line metrics (em, regular; hhea ascent / descent / gap, win ascent / descent)

| Family | Real hhea | Real win | Replacement hhea | Replacement win |
| --- | --- | --- | --- | --- |
| Angsana New | 0.923 / -0.239 / 0 | 0.941 / 0.41 | 1.061 / -0.45 / 0 | 1.061 / 0.45 |
| DilleniaUPC | 0.471 / -0.129 / 0 | 0.885 / 0.42 | 1.061 / -0.45 / 0 | 1.061 / 0.45 |
| Sakkal Majalla | 0.884 / -0.513 / 0 | 0.884 / 0.513 | 1.069 / -0.634 / 0 | 1.405 / 0.634 |
| Traditional Arabic | 0.994 / -0.5 / 0 | 0.994 / 0.5 | 1.069 / -0.634 / 0 | 1.405 / 0.634 |
| Malgun Gothic | 1.088 / -0.242 / 0 | 1.088 / 0.242 | 1.16 / -0.288 / 0 | 1.16 / 0.288 |
| Nirmala UI | 1.079 / -0.251 / 0 | 1.079 / 0.251 | 0.896 / -0.408 / 0 | 1.348 / 0.558 |
| Ebrima | 1.079 / -0.251 / 0.028 | 1.079 / 0.251 | 1.069 / -0.293 / 0 | 1.124 / 0.395 |
| MS Gothic | 0.859 / -0.141 / 0 | 0.859 / 0.141 | 1.16 / -0.288 / 0 | 1.16 / 0.288 |

`lineAscent` stays as proposed in the opf#361 comments (Angsana New 0.85, Sakkal Majalla 0.78 / mixed 0.78 measured natively; the others need the RR-38-style native probe). This pass measured no baselines.

## Reproduce

```
cd <set>\measure
<node24> measure-sizeadjust.mjs ff46-sizeadjust-raw.json
<node24> analyze-sizeadjust.mjs
```

Raw per-line data: `measure/ff46-sizeadjust-raw.json`; per-line ratios per scenario: `ff46-sizeadjust-measurements.json` (`families[].sets[].rows`).

## Rule (release supervisor, 2026-10-10)

**Rule.** Per family, the factor is the SMALLEST single factor (0.01 steps, rounded up) at which the worst line-model overhang is at most 3 %. Overhang means native / preview plan > 1. The corpus is every FF-44 sample of the family script that the real font covers (letters, digits, punctuation and mixed text), plus the scheme Latin (corpus Latn and the 300 FF-31 strings), in regular and bold. A family whose rule factor is within 1 +/- 0.03 ships no sizeAdjust.

Method: the line model above (published opf-render 0.18.0 planner, a scheme of major = minor = family; the factor scales every run drawn in the row replacement, Latin included). For each line, the needed factor is (native / 1.03 - other runs) / replacement runs, and the rule factor is the largest need. Script: `measure/rule-sizeadjust.mjs`.

| Family | Lines (reg + bold) | Median factor (per line) | Sum factor reg / bold | Rule factor | Worst overhang at rule | Set by | Script lines at rule (min / median / max) | Latin effect at rule (median slack, range) | Proposed earlier, worst overhang there | Decision |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- | --- | --- |
| Angsana New | 310 + 310 | 0.690 | 0.703 / 0.668 | **0.75** | +1.6 % | corpus-Thai/thai-digits regular | 0.840 / 0.920 / 1.016 | 23.8 % slack (native/preview 0.72 to 0.84) | 0.70: +8.9 % (corpus-Thai/thai-digits regular) | **ships**: sizeAdjust 0.75 |
| DilleniaUPC | 310 + 310 | 0.631 | 0.640 / 0.622 | **0.68** | +1.6 % | corpus-Thai/thai-digits regular | 0.878 / 0.928 / 1.016 | 14.0 % slack (native/preview 0.79 to 0.96) | 0.64: +7.9 % (corpus-Thai/thai-digits regular) | **ships**: sizeAdjust 0.68 |
| Sakkal Majalla | 319 + 319 | 0.794 | 0.803 / 0.796 | **0.89** | +2.6 % | corpus-Arab/arab-fa-digits regular | 0.817 / 0.892 / 1.026 | 27.1 % slack (native/preview 0.70 to 0.80) | 0.80: +14.1 % (corpus-Arab/arab-fa-digits regular) | **ships**: sizeAdjust 0.89 |
| Traditional Arabic | 312 + 312 | 0.745 | 0.789 / 0.800 | **1.02** | +2.5 % | corpus-Arab/arab-fa-digits bold | 0.695 / 0.730 / 1.025 | 14.8 % slack (native/preview 0.79 to 0.94) | 0.79: +32.4 % (corpus-Arab/arab-fa-digits bold) | **no sizeAdjust**: rule factor 1.02 is inside the 1 +/- 0.03 band (and confirmed by the supervisor) |
| Malgun Gothic | 307 + 307 | 1.061 | 1.063 / 1.061 | **1.07** | +2.7 % | corpus-Kore/kore-jamo regular | 0.963 / 0.992 / 1.027 | 8.0 % slack (native/preview 0.87 to 0.96) | 1.06: +3.7 % (corpus-Kore/kore-jamo regular) | **ships**: sizeAdjust 1.07 |
| Nirmala UI | 312 + 312 | 1.065 | 1.067 / 1.067 | **1.07** | +2.9 % | corpus-Deva/deva-matras regular | 0.954 / 0.995 / 1.030 | 12.1 % slack (native/preview 0.85 to 0.96) | 1.07: +2.9 % (corpus-Deva/deva-matras regular) | **ships**: sizeAdjust 1.07; the other Indic scripts are not reached by the row (see unreachable) |
| Ebrima | 312 + 312 | 0.947 | 0.945 / 0.954 | **0.99** | +2.7 % | corpus-Latn/latn-numerals bold | 0.941 / 0.957 / 1.027 | 4.8 % slack (native/preview 0.92 to 1.03) | 0.94: +8.2 % (corpus-Latn/latn-numerals bold) | **no sizeAdjust**: rule factor 0.99 is inside the band; Ethiopic is not reached by the row |
| MS Gothic | 314 + 314 | 1.011 | 1.035 / 1.032 | **1.33** | +2.7 % | corpus-Latn/latn-ligatures regular | 0.744 / 0.760 / 0.898 | 23.9 % slack (native/preview 0.64 to 1.03) | 1.04: +31.4 % (corpus-Latn/latn-ligatures regular) | **dropped**: the 1.19 sample (jpan-combining-dakuten) fails the rule at 1.04 (+14.8 %) and alone needs 1.16; the fixed-pitch Latin (latn-ligatures, 1.37 at factor 1) pushes the rule factor to 1.33, which would leave Japanese lines 10 to 26 % slack |

Notes:
- The rule factor is driven by digits for the Thai and Arabic families (`thai-digits`, `arab-fa-digits`, `arab-digits`): the corpus-sum factors (0.70, 0.64, 0.80) let those lines overhang 8 to 14 %.
- Not reached by any row factor, so not counted (native / preview at the rule factor): Nirmala UI Bengali to Sinhala, worst 1.33 (Telugu); Ebrima Ethiopic, worst 1.12. They need factors on their own routes.
- MS Gothic: bold uses the regular advances (synthetic bold). Its needs, largest first: latn-ligatures 1.33 (regular) and 1.23 (bold), latn-central-europe 1.16, latn-baltic 1.16; jpan-combining-dakuten alone needs 1.16.
- Shipping set under the rule: Angsana New 0.75, DilleniaUPC 0.68, Sakkal Majalla 0.89, Malgun Gothic 1.07, Nirmala UI 1.07. No sizeAdjust: Traditional Arabic, Ebrima. Dropped: MS Gothic.
- lineAscent rows are unchanged by this rule (Angsana New 0.85 and Sakkal Majalla 0.78 / 0.78 measured natively; the others still need the native probe).
