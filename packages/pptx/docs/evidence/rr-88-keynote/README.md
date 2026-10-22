# RR-88 Keynote check (Keynote Creator Studio 15.1.1, 2026-10-17)

Read-only: the exports were copied to `~/Documents/opf-keynote-check/`, opened, inspected and exported to PNG by AppleScript, and closed with `saving no`; nothing was saved. Desktop and Keynote were checked for leftover restore prompts before and after (none, 0 open documents).

`deck2.opf.json` exported with `toPptx(deck, {bodyText: 'native'})`, `title showing` / `body showing` per slide:

| slide | title showing | body showing |
| --- | --- | --- |
| 1 (wrapped title, no body) | true | false |
| 2 (wrapped title + bullets) | true | true |
| 3 chart | true | false |
| 4 table | true | false |
| 5 picture + text | true | true |
| 6 bullets | true | true |

Before this change (rr-86 branch) slides 1 and 2 reported `title showing=false`.

- `native-6slide-N.png`: the six slides as Keynote draws them.
- `slide2-bullet-lengthened-reflow.png`: in an open copy the first bullet of slide 2 was replaced by a three-line one; it wraps and the next bullets move down instead of overlapping.
- `deck3.opf.json` (wrapped title + list, two text regions, numbered list, picture + text): title and body showing on all four slides; `extension-N.png`.
