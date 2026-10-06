# RR-05 / FF-12: bounded native font sample (2026-10-05)

This is the native sample from [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 1. It uses 12 decks
(the cap is 12) built with the published `@openpresentation/opf` 0.12.1, `@openpresentation/opf-pptx` 0.12.3 and
`@openpresentation/opf-render` 0.12.0 (Node 24.21.0). It includes a re-run of `lang-ja-meiryo`, which failed in
[rr-05-cjk-native-20261002](../rr-05-cjk-native-20261002/README.md) because PowerPoint added `Aptos`. That is the FF-05
behaviour, fixed in opf-pptx 0.12.1.

**FF-12 criterion** (opf#323): each deck's `Presentation.Fonts` names only its chosen families, theme references
resolve to them, and any other name fails. **All 12 decks meet it**: no deck lists a family outside its chosen ones,
and every theme slot and every run reads back a chosen family.

The comparison script is stricter than the criterion. It also requires every used family to appear in
`Presentation.Fonts`. Under that extra rule it reports **PASS 11, FAIL 1**. The FAIL is `08-cjk-in-latin`, explained
below. The raw output is kept unchanged in [compare.md](compare.md) and [compare.json](compare.json).

## Host and method

- Windows 11 with desktop PowerPoint 365, `Application.Version` 16.0 build 20430.
- The supervisor session ran Office. An agent built the decks and scripts without opening Office.
- Before the run, all 12 deck sha256 values were checked against the set's manifest ([decks.json](decks.json)).
- Each deck was read in its own `powershell.exe` with a 90 s deadline and no retries.
  - The reader attaches with `GetActiveObject` and opens read-only with `Presentations.Open(path, -1, 0, 0)`.
  - It reads `Presentation.Fonts`, the theme font slots of every master and of the notes master (major and minor, Latin,
    East Asian and complex script), and every run's `Name`, `NameFarEast` and `NameComplexScript`. It also exports the
    slide PNGs, then closes the deck.
  - It never saves, quits or kills PowerPoint.
  - All 12 reads exited 0 and reached `stage: done` ([run.json](run.json)).

## Results

| Deck | Covers | `Presentation.Fonts` (native) | FF-12 criterion |
| --- | --- | --- | --- |
| 01-carlito-code-chart-table-notes | Carlito with code, chart, table and notes | Carlito, Roboto Mono | pass |
| 02-carlito-code-family-carlito | same, `code.family` Carlito | Carlito | pass |
| 03-default-aptos | the default scheme | Aptos Display, Aptos, Roboto Mono | pass |
| 04-ja-meiryo | re-run of `lang-ja-meiryo` | Meiryo | pass (the 2026-10-02 run also listed Aptos) |
| 05-ar-rtl | Arabic, right to left | Aptos Display, Aptos | pass |
| 06-monospace-consolas | monospace scheme | Consolas | pass |
| 07-per-slide-override | Calibri deck, Georgia slide 2, Courier New slide 4 | Calibri, Georgia, Courier New | pass |
| 08-cjk-in-latin | Japanese and Chinese inside a Latin deck | Aptos Display, Aptos | pass (script FAIL, see below) |
| 09-ko-malgun | Korean | Malgun Gothic | pass |
| 10-hi-mangal | Hindi | Aptos Display, Aptos | pass |
| 11-he-rtl | Hebrew, right to left | Aptos Display, Aptos | pass |
| 12-serif-georgia | serif scheme | Georgia | pass |

Roboto Mono is the documented code fallback (core `docs/design-resolution.md`, "Code font"), so it is a chosen family
in decks with code and no `code.family`.

## Finding: PowerPoint does not list a theme-only script family

In `08-cjk-in-latin`, every slot that references Meiryo resolves to it:

- the theme East Asian slots, major and minor, of the slide master and of the notes master read `Meiryo`;
- every run with Japanese or Chinese text reads `NameFarEast` = `Meiryo`.

But `Presentation.Fonts` lists only `Aptos Display, Aptos`. The same happens for the complex-script slot in decks 05,
10 and 11:

- Arabic Typesetting, Mangal and David resolve on every run and theme slot;
- none of them is listed.

PowerPoint's font list names the Latin families of the runs. When a deck's Latin family differs from its East Asian
or complex-script theme family, it leaves out the theme-only script family. In deck 04, Meiryo is both the Latin and
the East Asian family, and PowerPoint lists it.

This is not a foreign or substituted name, so it does not fail the FF-12 criterion. The script marks the
complex-script cases as "soft" (allowed to be absent) and East Asian Meiryo in deck 08 as required, which is why only
deck 08 fails. A reviewer can accept this reading, or keep the stricter rule and leave FF-12 open.

## Host fonts

The reader also records which chosen families are installed on this host. Carlito, Roboto Mono, Aptos, Aptos Display,
Meiryo, Mangal and David were not installed as local font files. PowerPoint still reports the selected names, and the
check is about names, not drawn glyphs.

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the comparison output (raw, with the stricter rule).
- [run.json](run.json): one record per deck (child process id, exit code, timeout).
- [decks.json](decks.json): the set manifest. Per deck it lists the sha256, expected and soft families, the theme
  slots written to `theme1.xml`, and fonts by package part.

The decks, the raw read-outs and the PNGs are not committed.

## Decision (2026-10-05, Windows supervisor, vetoable)

**Accepted: FF-12 passes on all 12 decks.** PowerPoint's `Presentation.Fonts` lists the Latin families of the runs. It
leaves out a theme-only East Asian or complex-script family when the deck's Latin family is different. The FF-12
criterion is about foreign names, and this sample has none. The chosen script family is proven by the theme slots and
by every run's `NameFarEast` or `NameComplexScript` reading it back.

The stricter "must be listed" rule in the comparison script applied to East Asian Meiryo in deck 08, but not to the
complex-script families of decks 05, 10 and 11. Under the accepted reading, both cases are treated alike. The raw
script output stays unchanged above as measured. This closes FF-12 and, with it, RR-05.
