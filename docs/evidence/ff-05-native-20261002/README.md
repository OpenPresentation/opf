# FF-05 native root cause: Presentation.Fonts probes (2026-10-02)

Native readings of `Presentation.Fonts` and a few `Font2` properties, taken by the root agent in PowerPoint 365 on Windows
(2026-10-02, desktop PowerPoint opened from the supervising session). The decks were built by the opf-pptx exporter from the
fix branch ([opf-pptx#152](https://github.com/OpenPresentation/opf-pptx/pull/152), `codex/ff-05-notes-theme`), with at most one
stated post-edit per probe; no deck is stored here. This record is a table of probe, edit and reading, in the order they ran.
It supersedes the open question of the [E6](../windows-native-calibri-control-20260929/README.md),
[E7](../windows-native-explicit-slots-20260929/README.md) and [E8](../windows-native-font-query-order-20260929/README.md)
controls: the nameless font and `Aptos` those controls read had three package causes, all in the exporter.

Reading convention: `[]` lists the names in `Presentation.Fonts` order. `""` is an entry with an empty name. The decks use
Georgia (English), Meiryo (Japanese, scheme `meiryo`) or Georgia with Japanese text ("mixed"). A read opened the deck
read-only; a windowed open and a windowless open gave the same list.

## Findings

1. **`Aptos`: `p:notesMasterIdLst` is out of schema order.** The vendored PptxGenJS writes it after `p:sldIdLst`; CT_Presentation is a
   sequence (`sldMasterIdLst`, `notesMasterIdLst`, `handoutMasterIdLst`, `sldIdLst`, ...). PowerPoint ignores the misplaced list and
   synthesises a default notes master (default Office theme, Aptos). In schema order the Aptos entry is gone.
2. **The notes master needs its own theme.** With the list in schema order and the notes master still sharing `theme1.xml` with the
   slide master, PowerPoint refuses the package (0x80070570, "corrupted and unreadable"). PowerPoint-authored decks give the notes master
   `theme2.xml`; the exporter now copies the final deck theme into it.
3. **Explicit run-level `a:ea`/`a:cs` typefaces list as an empty-name font** and hide the real font, with or without the charset
   (-122/-120 that PptxGenJS wrote) and with or without `pitchFamily`. PowerPoint's own runs name only the Latin face. The exporter
   writes no run `ea`/`cs` in slides and notes; the faces come from the theme slots (`+mn-ea`/`+mn-cs`). Chart text keeps its
   latin/ea/cs (read clean).
4. **An empty theme `ea` slot is listed as an empty-name font through every paragraph end mark (`a:endParaRPr`).** Filling the deck
   theme's `ea` clears it (the notes theme alone does not; `cs` does not matter). PowerPoint's own deck leaves `ea` empty and lists no
   empty name because its simple paragraphs carry no `endParaRPr`; removing `endParaRPr` from the exporter's slides also clears the
   entry, but the end mark carries the empty-paragraph size, so it stays and the theme `ea` is filled instead.
5. **East Asian text in a Latin-language deck read `NameFarEast = +mn-ea`, an unresolved theme reference**, while the empty slot was
   in place; with a named `ea` it resolves.

## Probes

| Round | Probe (edit applied to exporter output) | Reading |
| --- | --- | --- |
| 1 | `a` current export, `b` own notes theme, `c` b + empty `ea`/`cs` filled, `d` c + a handout master (Georgia and Meiryo decks) | `["", "Aptos"]` for a to d |
| 1 | `e` d + `p:presentation` children in schema order | `[""]` (Georgia, Meiryo) |
| 2 | control: a deck PowerPoint created (Georgia text box), saved, reopened | `["Georgia", "Aptos"]`; windowed and windowless reads equal |
| 2 | bisect decks (title only, text, text + notes, list, table, chart), all as `e` | `[""]` for each: not content specific |
| 2 | master bullet font made explicit | `[""]` |
| 2 | `e` without run `ea`/`cs` and without any `charset` | `["Georgia"]` |
| 2 | schema-order fix only (notes master still sharing `theme1.xml`) | PowerPoint cannot open it (finding 2) |
| 3 | own notes theme + order, Georgia, Meiryo and mixed decks: run `ea`/`cs` kept (7b), charset removed (7h1), typeface only (7h2), no run `ea`/`cs` (7h3) | 7b, 7h1, 7h2: `[""]` everywhere; 7h3: Meiryo `["Meiryo"]`, mixed `["Meiryo"]` (`NameFarEast` Meiryo, Latin `Name` Georgia), Georgia `[""]` |
| 4 | Georgia, 7h3 + theme `ea`/`cs` filled (g1); no charset anywhere (g2); no chart slide (g3); latin typeface only (g5) | g1 `["Georgia"]`; g2, g3, g5 `[""]` |
| 4 | mixed deck, `cs` filled (m1); English deck with Japanese text, 7h3 (m2) | m1 `["Meiryo"]`; m2 `[""]`, Japanese `NameFarEast` `+mn-ea` |
| 5 | filled notes theme only (g8); deck theme only (g9); `ea` only in both (g10); m2 with both filled (m4) | g8 `[""]`; g9, g10 `["Georgia"]`; m4 `["Georgia"]`, Japanese `NameFarEast` Georgia |
| 5 | PowerPoint-made Georgia deck plus speaker notes | `["Georgia", "Aptos"]` (no empty name): the notes master is not the carrier |
| 6 | no `endParaRPr` (g11); panose on Georgia latin (g12); both (g13) | g11 `["Georgia"]`; g12 `[""]`; g13 `["Georgia"]` |
| final | exporter output of the fix: Georgia deck with a chart | `["Georgia"]` (also with the chart's `ea`/`cs` removed) |
| final | Japanese deck, Meiryo scheme | `["Meiryo"]`, Japanese `NameFarEast` Meiryo |
| final | Georgia scheme, deck language `ja`, Latin and Japanese in runs | `["Meiryo"]`, `NameFarEast` Meiryo, Latin `Name` Georgia |
| final | Georgia scheme, English deck, Japanese text in runs | `["Meiryo"]`, `NameFarEast` Meiryo (before: `+mn-ea`) |

## What this does and does not establish

- The package causes are established for PowerPoint 365 (Windows, 2026-10-02) and the probe decks above; Office-made decks with
  `endParaRPr` and an empty theme `ea` were not read, so finding 4 is stated for exporter output.
- The mixed deck lists only the Japanese face: PowerPoint did not list the Latin Georgia in that deck (Latin `Name` read Georgia). That
  is recorded as observed behaviour; it is not a blocker for the check, which asks that no foreign font is listed.
- A passing read says which fonts the collection lists, not which glyph faces are drawn; the allowlist and embedding gates are separate.
- The East Asian theme slot for kana, hangul or Han text found in a Latin-language deck is resolved by the exporter, not by core or the
  preview (core has no content-based resolver); see [Theme slots](../../programs/font-fidelity-everywhere/script-font-model.md#theme-slots-ff-49).
