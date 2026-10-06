# RR-54: `/` and other Excel special characters in number-format units, native check (2026-10-05)

[opf#387](https://github.com/OpenPresentation/opf/pull/387) left one failure. Core's `excelNumberFormat` wrote `0.0 m/s`
as `0.0 "m"/"s"`. A bare `/` is Excel's fraction bar, so PowerPoint dropped the code to General on load, and the labels
lost "m/s".

Core [opf#376](https://github.com/OpenPresentation/opf/pull/376) `d955d600` now quotes each literal run as one string,
for example `0.0 "m/s"`. This check covers that fix and the other Excel special characters.

**Result: PASS, 12 of 12.** PowerPoint keeps every exported code and none falls back to General. The labels display as
authored.

## Host and method

- **Host:** Windows 11, desktop PowerPoint 365, `Application.Version` 16.0 build 20430.
- **Deck:** `rr54-slash.pptx`, sha256 `2d091e65e54918f4ff2e82e4feb475ef56c6d5e0c6fb4a3767e4a727f2514e30`. It was built on
  the Mac by opf-pptx#171 `b076bb6` with core `d955d600`, then taken from the probe branch `codex/probe-sets-20261005`
  (`b8655025`, folder `rr54-slash/`).
  - The sha256 was checked before and after the read and is unchanged.
  - The manifest is [decks.json](decks.json).
- **Read:** the deck was read once, read-only, in one child `powershell.exe` with a 90 s deadline and no retries.
  - The reader was `rr54-recheck/read-deck.ps1`: `Presentations.Open(path, -1, 0, 0)`, then the chart format codes and
    slide PNGs, then close.
  - It never saves, quits or kills PowerPoint, and never reads `Series.Formula`
    ([opf#385](https://github.com/OpenPresentation/opf/pull/385)).
- **Check:** `check.mjs` ran offline against a core build at `d955d600`. A slide passes when the data-label
  `NumberFormat` is not General and maps back to the authored format.

## Results

| Slide | Format | Exported code | PowerPoint label format | Result |
| --- | --- | --- | --- | --- |
| 1 | `$#,##0.0` (control) | `$#,##0.0` | `\$#,##0.0` | PASS |
| 2 | `0.0 m/s` | `0.0 "m/s"` | `0.0 "m/s"` | PASS |
| 3 | `km/h 0` | `"km/h "0` | `"km/h "0` | PASS |
| 4 | `#,##0 items/day` | `#,##0 "items/day"` | `#,##0 "items/day"` | PASS |
| 5 | `0.0 E+3 m` | `0.0 "E+3 m"` | `0.0 "E+3 m"` | PASS |
| 6 | `#,##0 @HQ` | `#,##0 "@HQ"` | `#,##0 "@HQ"` | PASS |
| 7 | `#,##0 *est` | `#,##0 "*est"` | `#,##0 "*est"` | PASS |
| 8 | `#,##0 net_rev` | `#,##0 "net_rev"` | `#,##0 "net_rev"` | PASS |
| 9 | `#,##0 ok?` | `#,##0 "ok?"` | `#,##0 "ok?"` | PASS |
| 10 | `0.0% p.a.` | `0.0% "p.a."` | `0.0% "p.a."` | PASS |
| 11 | `#,##0 (est)` | `#,##0 ("est)"` | `#,##0 ("est)"` | PASS |
| 12 | `0 "q"` | `0 \""q"\"` | `0 \""q"\"` | PASS |

The reader records the format codes, not the label strings. The supervisor checked the exported slide PNGs for the
highest-risk slides:

- Slide 2 shows `3.3 m/s`, `4.8 m/s` and `12.5 m/s`, with axis ticks `0.0 m/s` to `14.0 m/s`.
- Slide 12 shows `3 "q"`, `5 "q"` and `13 "q"`, with axis ticks `0 "q"` to `14 "q"`.

The full output is in [check.md](check.md) and [check.json](check.json); the raw read is [read.json](read.json).

With this, the opf#387 failure is fixed on core `d955d600`.

The deck and the PNGs are not committed.
